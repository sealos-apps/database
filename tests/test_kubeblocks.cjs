// Offline compatibility tests: no Kubernetes connection and no database writes.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const { createRequire, Module } = require('node:module');
const { execFileSync, spawnSync } = require('node:child_process');
const { deploymentRoot, examplePath, appRoot, sourceRoot, sourceFile, originalAlias } = require('./support/source.cjs');
const requireApp = createRequire(resolve(appRoot, 'package.json'));
const ts = requireApp('typescript');
const yaml = requireApp('js-yaml');

function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    const target = [file, `${file}.ts`, `${file}/index.ts`].find(p => existsSync(p) && /\.ts$/.test(p));
    if (!target) throw Error(`Missing fixture module: ${file}`);
    if (cache.has(target)) return cache.get(target).exports;
    const mod = new Module(target, module);
    mod.filename = target;
    mod.paths = Module._nodeModulePaths(dirname(target));
    cache.set(target, mod);
    mod.require = id => {
      if (id.startsWith('.')) {
        const alias = '@/'+require('node:path').relative(sourceRoot, resolve(dirname(target), id));
        if (originalAlias(alias) in mocks) return mocks[originalAlias(alias)];
      }
      if (id in mocks) return mocks[id];
      if (originalAlias(id) in mocks) return mocks[originalAlias(id)];
      if (id.startsWith('@/')) return load(resolve(sourceRoot, id.slice(2)));
      if (id.startsWith('.')) return load(resolve(dirname(target), id));
      return requireApp(id);
    };
    mod._compile(ts.transpileModule(readFileSync(target, 'utf8'), {
      compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
    }).outputText, target);
    return mod.exports;
  }
  return load;
}
const load = loader();
const { AppConfigSchema } = load(resolve(sourceRoot, 'types/config.ts'));
const { versionedHandler, versionedServerSideProps } = load(resolve(sourceRoot, 'services/backend/kubeblocks.ts'));
function fixture(channel) {
  return yaml.load(readFileSync(examplePath(channel), 'utf8'));
}

for (const [channel, expected] of [['main', '0.9'], ['release-v5.1', '0.8']]) {
  test(`${channel}: defaults and old mounted YAML preserve the operator version`, () => {
    const config = fixture(channel);
    assert.equal(AppConfigSchema.parse(config).database.kubeblocks.version, expected);
    delete config.database.kubeblocks;
    assert.equal(AppConfigSchema.parse(config).database.kubeblocks.version, expected);
    config.database.kubeblocks = { version: expected === '0.8' ? '0.9' : '0.8' };
    assert.equal(AppConfigSchema.parse(config).database.kubeblocks.version, config.database.kubeblocks.version);
  });
  test(`${channel}: both version overrides reach the validated mounted config`, () => {
    for (const version of ['0.8', '0.9']) {
      const output = execFileSync('helm', ['template', 'dbprovider-frontend',
        resolve(deploymentRoot(channel), 'charts/database-frontend'),
        '--set-string', `dbproviderConfig.kubeblocksVersion=${version}`], { encoding: 'utf8' });
      const cm = yaml.loadAll(output).find(doc => doc?.kind === 'ConfigMap');
      assert.equal(AppConfigSchema.parse(yaml.load(cm.data['config.yaml'])).database.kubeblocks.version, version);
    }
  });
  test(`${channel}: invalid Helm version fails before deployment`, () => {
    const result = spawnSync('helm', ['template', 'dbprovider-frontend',
      resolve(deploymentRoot(channel), 'charts/database-frontend'),
      '--set-string', 'dbproviderConfig.kubeblocksVersion=1.0'], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /kubeblocksVersion/);
  });
}

test('invalid and numeric runtime versions are rejected instead of using another adapter', () => {
  for (const version of ['0.7', '1.0', '', 0.8, null]) {
    const config = fixture('main');
    config.database.kubeblocks.version = version;
    assert.equal(AppConfigSchema.safeParse(config).success, false);
  }
});

test('API and SSR dispatch use deployment config, ignore request overrides, and fail closed', async () => {
  const handler = versionedHandler({ '0.8': () => 'old', '0.9': () => 'new' });
  const ssr = versionedServerSideProps({ '0.8': async () => ({ props: { mode: 'old' } }) });
  for (const [version, expected] of [['0.8', 'old'], ['0.9', 'new']]) {
    globalThis.__APP_CONFIG__ = { database: { kubeblocks: { version } } };
    assert.equal(handler({ query: { kubeblocksVersion: '1.0' }, headers: { 'x-kubeblocks-version': '1.0' } }, {}), expected);
  }
  assert.deepEqual(await ssr({}), { notFound: true });
  let status, body;
  const only08 = versionedHandler({ '0.8': () => assert.fail('must not fall through') });
  only08({}, { status(code) { status = code; return this; }, json(value) { body = value; } });
  assert.equal(status, 404);
  assert.equal(body.code, 404);
  globalThis.__APP_CONFIG__.database.kubeblocks.version = '1.0';
  assert.throws(() => handler({}, {}), /must be/);
  delete globalThis.__APP_CONFIG__;
});

for (const [channel, version] of [['main', '0.9'], ['release-v5.1', '0.8']]) {
  test(`${version}: real version route discovers the correct CRs`, async () => {
    const calls = [];
    const api = { listClusterCustomObject: async (_group, _version, plural) => {
      calls.push(plural);
      return { body: { items: plural === 'clusterversions'
        ? [{ metadata: { name: 'mongodb-5.0.14' }, spec: { clusterDefinitionRef: 'mongodb' } }]
        : [{ metadata: { name: 'mongodb' }, status: { serviceVersions: ['6.0.16'] } }] } };
    } };
    const loadRoute = loader({
      '@/services/backend/kubernetes': { K8sApi: () => ({ makeApiClient: () => api }), K8sApiDefault: () => ({ makeApiClient: () => api }) },
      '@/store/static': { DBVersionMap: {} },
      '@kubernetes/client-node': { CustomObjectsApi: class {} }
    });
    globalThis.__APP_CONFIG__ = AppConfigSchema.parse(fixture(channel));
    let result;
    const handler = loadRoute(resolve(sourceRoot, 'pages/api/platform/getVersion.ts')).default;
    await handler({}, { json(value) { result = value; } });
    assert.deepEqual(calls, version === '0.8' ? ['clusterversions'] : ['clusterversions', 'componentversions']);
    assert.equal(result.data.mongodb[0].id, version === '0.8' ? 'mongodb-5.0.14' : 'mongodb-6.0.16');
    delete globalThis.__APP_CONFIG__;
  });

  test(`${version}: Redis templates retain the original resource model`, () => {
    const loadYaml = loader({
      '@/utils/user': { getUserNamespace: () => 'ns-fixture' },
      '@/utils/tools': { str2Num: Number, formatNumber: Number, encodeToHex: x => Buffer.from(x).toString('hex') },
      '@/utils/kubeFileSystem': {},
      '@/store/env': { StorageClassName: 'fixture-storage' },
      nanoid: { customAlphabet: () => () => 'fixture' },
      '@kubernetes/client-node': {}
    });
    const { json2CreateCluster } = loadYaml(sourceFile(channel, 'utils/json2Yaml.ts'));
    const output = json2CreateCluster({ dbName: 'fixture', dbType: 'redis', dbVersion: version === '0.8' ? 'redis-7.0.6' : 'redis-7.2.7',
      cpu: 1000, memory: 1024, storage: 3, replicas: 1, terminationPolicy: 'Delete' }, undefined, { storageClassName: 'fixture-storage' });
    const docs = (Array.isArray(output) ? output : [output]).flatMap(value => yaml.loadAll(value));
    const cluster = docs.find(doc => doc?.kind === 'Cluster');
    assert.ok(cluster);
    if (version === '0.8') {
      assert.equal(cluster.spec.clusterVersionRef, 'redis-7.0.6');
      assert.equal(cluster.spec.componentSpecs[0].componentDefRef, 'redis');
    } else {
      assert.equal(cluster.spec.componentSpecs[0].componentDef, 'redis-7');
      assert.equal(cluster.spec.componentSpecs[0].serviceVersion, '7.2.7');
      assert.equal(cluster.spec.clusterVersionRef, undefined);
    }
  });
}

test('configuration schema remains exportable for operator tooling', () => {
  const schema = requireApp('zod').z.toJSONSchema(AppConfigSchema);
  assert.deepEqual(schema.properties.database.properties.kubeblocks.properties.version.enum, ['0.8', '0.9']);
});

test('invalid installer version fails before either service installer runs', () => {
  for (const script of ['deploy/install.sh', 'database/deploy/database-frontend-entrypoint.sh',
    'deploy/kubeblocks-0.8/database-frontend-entrypoint.sh']) {
    const result = spawnSync('bash', [resolve(script)], {
      encoding: 'utf8', env: { ...process.env, KUBEBLOCKS_VERSION: '1.0' }
    });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /^KUBEBLOCKS_VERSION must be 0\.8 or 0\.9\n$/);
  }
});
