const { appRoot, sourceRoot, sourceFile, originalAlias } = require('./support/source.cjs');
// Run with: node --test tests/test_sealox_compatibility.cjs
// Real release schemas and YAML generation; Kubernetes and backup writes are mocked.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const { createRequire, Module } = require('node:module');
const root = sourceRoot;
const requireApp = createRequire(resolve(appRoot, 'package.json'));
const ts = requireApp('typescript');
const yaml = requireApp('js-yaml');
const config = yaml.load(readFileSync(resolve('database/data/config.kb08.example.yaml'), 'utf8'));
globalThis.__APP_CONFIG__ = config;

function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    file = resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const mod = new Module(file, module);
    mod.filename = file;
    mod.paths = Module._nodeModulePaths(dirname(file));
    cache.set(file, mod);
    mod.require = id => {
      const alias = originalAlias(id);
      const originalFile = file.replace(/implementations\/kb0[89]\//, '');
      const target = alias.startsWith('@/') ? resolve(sourceRoot, alias.slice(2)) : null;
      let relative = target ? require('node:path').relative(dirname(originalFile), target) : id;
      if (!relative.startsWith('.')) relative = './' + relative;
      if (alias in mocks || relative in mocks) return { ...mocks[alias], ...mocks[relative] };
      if (id.startsWith('@labring/sealos-shared-sdk/')) return load(requireApp.resolve(id));
      if (id.startsWith('@/') || id.startsWith('.')) {
        const base = id.startsWith('@/') ? resolve(root, id.slice(2)) : resolve(dirname(file), id);
        const target = [base, `${base}.ts`, resolve(base, 'index.ts')].find(p => existsSync(p) && /\.[jt]s$/.test(p));
        if (target) return load(target);
      }
      return requireApp(id);
    };
    mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
    }).outputText, file);
    return mod.exports;
  }
  return load;
}

function setup() {
  const writes = [], backups = [];
  const apiSchemas = {};
  const load = loader({
    '@/types/apis/v2alpha': apiSchemas,
    '@/services/backend/auth': { authSession: async () => 'test-kubeconfig' },
    '@/services/backend/kubernetes': { getK8s: async () => k8s },
    '@/services/backend/v2alpha/list-database': {},
    nanoid: { customAlphabet: () => () => 'testid' },
    '@/store/env': { StorageClassName: '' },
    './user': { getUserNamespace: () => 'test-namespace' },
    './kubeFileSystem': {},
    '../kubernetes': { K8sApi: () => { throw Error('use mock client'); } },
    '@/utils/adapt': { adaptDBDetail: value => value, convertBackupFormToSpec: value => value.autoBackup },
    '@/pages/api/backup/updatePolicy': { updateBackupPolicyApi: async value => { backups.push(value); } },
    '@/utils/tools': { getScore: () => 350, encodeToHex: value => Buffer.from(value).toString('hex'), str2Num: Number },
    './tools': { formatNumber: Number, str2Num: Number }
  });
  const { body } = load(sourceFile('release-v5.1', 'types/apis/v2alpha/database/create-database.ts'));
  apiSchemas.createDatabaseSchemas = { body };
  const { createDatabase } = load(sourceFile('release-v5.1', 'services/backend/v2alpha/create-database.ts'));
  const k8s = {
    namespace: 'test-namespace',
    applyYamlList: async (list, action) => {
      writes.push({ action, resources: list.flatMap(text => yaml.loadAll(text)) });
    },
    k8sCustomObjects: {
      listClusterCustomObject: async () => ({ body: { items: [
        { metadata: { name: 'mysql-5.7.42' }, spec: { clusterDefinitionRef: 'mysql' } },
        { metadata: { name: 'ac-mysql-8.0.30-1' }, spec: { clusterDefinitionRef: 'apecloud-mysql' } }
      ] } }),
      getNamespacedCustomObject: async () => ({ body: { metadata: { uid: 'test-uid' } } })
    }
  };
  return { body, createDatabase, k8s, writes, backups,
    handler: () => load(sourceFile('release-v5.1', 'pages/api/v2alpha/databases.ts')).default };
}
const request = (type, version) => ({
  name: 'test-db', type, ...(version ? { version } : {}),
  quota: { cpu: 0.5, memory: 0.5, storage: 3, replicas: 1 },
  autoBackup: { start: true, type: 'day', week: [], hour: '12', minute: '00', saveTime: 14, saveType: 'days' }
});

for (const [type, version, definition, hasConfig] of [
  ['mysql', 'mysql-5.7.42', 'mysql', false],
  ['apecloud-mysql', 'mysql-5.7.42', 'mysql', false],
  ['apecloud-mysql', 'ac-mysql-8.0.30-1', 'apecloud-mysql', true]
]) {
  test(`create ${type}/${version}: correct Cluster, account and backup`, async () => {
    const { body, createDatabase, k8s, writes, backups } = setup();
    await createDatabase(k8s, { body: body.parse(request(type, version)) });
    const resources = writes[0].resources;
    const cluster = resources.find(r => r.kind === 'Cluster');
    assert.equal(cluster.spec.clusterDefinitionRef, definition);
    assert.equal(cluster.spec.clusterVersionRef, version);
    assert.equal(cluster.spec.componentSpecs[0].name, 'mysql');
    assert.deepEqual(cluster.spec.componentSpecs[0].resources.limits, { cpu: '500m', memory: '512Mi' });
    assert.equal(cluster.spec.terminationPolicy, 'Delete');
    assert.equal(resources.some(r => r.kind === 'Configuration'), hasConfig);
    assert.equal(backups.length, 1);
    assert.equal(backups[0].dbType, 'apecloud-mysql');
    const account = writes[1].resources[0];
    assert.equal(account.metadata.ownerReferences[0].uid, 'test-uid');
  });
}

test('mysql without a version selects the release MySQL version, not ApeCloud', async () => {
  const { body, createDatabase, k8s, writes } = setup();
  await createDatabase(k8s, { body: body.parse(request('mysql')) });
  const cluster = writes[0].resources.find(r => r.kind === 'Cluster');
  assert.equal(cluster.spec.clusterVersionRef, 'mysql-5.7.42');
  assert.equal(cluster.spec.clusterDefinitionRef, 'mysql');
});

test('release-only polardbx remains accepted; invalid engines are rejected', () => {
  const { body } = setup();
  assert.equal(body.safeParse(request('polardbx', 'polardbx-test')).success, true);
  assert.equal(body.safeParse(request('unknown', 'unknown')).success, false);
});

test('public config returns the numeric storage limit without authentication or private env', async () => {
  const load = loader();
  const handler = load(sourceFile('release-v5.1', 'pages/api/platform/getClientAppConfig.ts')).default;
  const previous = config.database.storage.maxSize;
  try {
    for (const expected of [300, 500]) {
      config.database.storage.maxSize = expected;
      let response;
      await handler({ headers: {} }, { json: value => { response = value; } });
      assert.equal(response.code, 200);
      assert.deepEqual(response.data, { domain: config.cloud.domain, storageMaxSize: expected });
    }
  } finally {
    config.database.storage.maxSize = previous;
  }
});


test('POST route accepts the Sealox MySQL payload and returns 201', async () => {
  const context = setup();
  let status, response;
  const res = {
    status(value) { status = value; return this; },
    json(value) { response = value; return this; }
  };
  await context.handler()({ method: 'POST', body: request('mysql', 'mysql-5.7.42') }, res);
  assert.equal(status, 201);
  assert.deepEqual(response, { name: 'test-db', status: 'creating' });
  assert.equal(context.writes.length, 2);
});

test('POST route rejects unknown engines before any Kubernetes write', async () => {
  const context = setup();
  let status;
  const res = { status(value) { status = value; return this; }, json() { return this; } };
  await context.handler()({ method: 'POST', body: request('unknown', 'unknown') }, res);
  assert.equal(status, 400);
  assert.equal(context.writes.length, 0);
});
