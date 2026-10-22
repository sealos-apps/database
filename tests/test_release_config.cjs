// Offline configuration contract: real Helm output, YAML parser, schema and API handlers.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { resolve, dirname } = require('node:path');
const { createRequire, Module } = require('node:module');
const root = resolve('release-v5.1/database');
const requireApp = createRequire(resolve(root, 'package.json'));
const ts = requireApp('typescript');
const yaml = requireApp('js-yaml');
function load(file, mocks = {}) {
  const mod = new Module(file, module);
  mod.filename = file;
  mod.paths = Module._nodeModulePaths(dirname(file));
  mod.require = id => {
    if (id in mocks) return mocks[id];
    if (id.startsWith('@/')) return load(resolve(root, 'src', id.slice(2) + '.ts'), mocks);
    return requireApp(id);
  };
  mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText, file);
  return mod.exports;
}
const { AppConfigSchema } = load(resolve(root, 'src/types/config.ts'));
function render(...args) {
  const text = execFileSync('helm', ['template', 'dbprovider-frontend',
    resolve(root, 'deploy/charts/database-frontend'), ...args], { encoding: 'utf8' });
  const docs = yaml.loadAll(text).filter(Boolean);
  const cm = docs.find(d => d.kind === 'ConfigMap');
  const config = AppConfigSchema.parse(yaml.load(cm.data['config.yaml']));
  return { config, cm, deployment: docs.find(d => d.kind === 'Deployment') };
}

test('default and bundled Helm values produce valid mounted release config', () => {
  for (const args of [[], ['-f', resolve(root, 'deploy/charts/database-frontend/database-frontend-values.yaml')]]) {
    const { config, cm, deployment } = render(...args);
    assert.deepEqual(Object.keys(cm.data), ['config.yaml']);
    assert.equal(config.database.storage.maxSize, 300);
    const mount = deployment.spec.template.spec.containers[0].volumeMounts[0];
    assert.equal(mount.mountPath, '/app/data/config.yaml');
    assert.equal(mount.subPath, 'config.yaml');
    assert.ok(deployment.spec.template.metadata.annotations['checksum/config']);
  }
});

test('legacy string flags, false, quotes, custom scripts and limits survive Helm YAML', () => {
  const { config, deployment } = render('--set-string', 'dbproviderConfig.backupEnabled=false',
    '--set-string', 'dbproviderConfig.minioUseSSL=false', '--set', 'dbproviderConfig.storageMaxSize=500',
    '--set-string', 'dbproviderConfig.minioSecretKey=a:#"b',
    '--set-json', 'dbproviderConfig.customScripts=[{"src":"https://example.test/a.js"}]');
  assert.equal(config.database.backup.enabled, false);
  assert.equal(config.database.components.storage.useSSL, false);
  assert.equal(config.database.components.storage.secretKey, 'a:#"b');
  assert.equal(config.database.storage.maxSize, 500);
  assert.equal(config.database.ui.customScripts[0].src, 'https://example.test/a.js');
  assert.notEqual(deployment.spec.template.metadata.annotations['checksum/config'],
    render().deployment.spec.template.metadata.annotations['checksum/config']);
});

test('example validates; wrong types and unknown settings are rejected', () => {
  const config = yaml.load(readFileSync(resolve(root, 'data/config.example.yaml'), 'utf8'));
  assert.ok(AppConfigSchema.safeParse(config).success);
  config.database.features.fileImport = 'false';
  assert.equal(AppConfigSchema.safeParse(config).success, false);
  config.database.features.fileImport = false;
  config.database.components.storage.port = 0;
  assert.equal(AppConfigSchema.safeParse(config).success, false);
  config.database.components.storage.port = 443;
  config.database.unknown = true;
  assert.equal(AppConfigSchema.safeParse(config).success, false);
});

test('public API and readiness use loaded config without exposing credentials', async () => {
  const { config } = render('--set', 'dbproviderConfig.storageMaxSize=700',
    '--set-string', 'dbproviderConfig.cloudDomain=config.example.test',
    '--set-string', 'dbproviderConfig.minioSecretKey=private-test-secret');
  globalThis.__APP_CONFIG__ = config;
  const { assertReady } = load(resolve(root, 'src/utils/healthz.ts'));
  assertReady();
  const mocks = { '@/services/backend/response': { jsonRes: (_res, body) => { response = body; } } };
  let response;
  const handler = load(resolve(root, 'src/pages/api/platform/getClientAppConfig.ts'), mocks).default;
  await handler({}, {});
  assert.deepEqual(response.data, { domain: 'config.example.test', storageMaxSize: 700 });
  assert.equal(JSON.stringify(response).includes('private-test-secret'), false);
  config.cloud.domain = '';
  assert.throws(assertReady, /must be configured/);
  delete globalThis.__APP_CONFIG__;
});
