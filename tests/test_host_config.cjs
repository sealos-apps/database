const { appRoot, sourceFile, originalAlias } = require('./support/source.cjs');
// Run with: node --test tests/test_host_config.cjs (after installing both workspaces).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const { createRequire, Module } = require('node:module');

function loadTypeScript(filename, workspace, mocks = {}) {
  const requireWorkspace = createRequire(resolve(appRoot, 'package.json'));
  const ts = requireWorkspace('typescript');
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(dirname(filename));
  const requireModule = mod.require.bind(mod);
  mod.require = id => originalAlias(id) in mocks ? mocks[originalAlias(id)] : requireModule(id);
  mod._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText, filename);
  return mod.exports;
}

for (const workspace of ['main', 'release-v5.1']) {
  const { createHostConfigStore } = loadTypeScript(
    sourceFile(workspace, 'store/hostConfig.ts'), workspace
  );
  const host = { cloud: { domain: 'example.com', port: '', regionUid: 'test' },
    features: { subscription: false } };
  for (const currencySymbol of ['shellCoin', 'cny', 'usd', undefined]) {
    test(`${workspace}: ${currencySymbol ?? 'old Desktop without currency'} updates shared state`, async () => {
      const store = createHostConfigStore();
      assert.equal(store.getState().currencySymbol, 'shellCoin');
      let observed;
      const unsubscribe = store.subscribe(state => { observed = state.currencySymbol; });
      await store.getState().loadHostConfig(async () => ({ ...host, currencySymbol }));
      assert.equal(store.getState().currencySymbol, currencySymbol ?? 'shellCoin');
      assert.equal(observed, currencySymbol ?? 'shellCoin');
      assert.equal(store.getState().subscriptionEnabled, false);
      unsubscribe();
    });
  }
  test(`${workspace}: failed/standalone requests fall back without retrying`, async () => {
    for (const getter of [() => Promise.reject(new Error('timeout')), () => { throw Error('standalone'); }]) {
      const store = createHostConfigStore();
      await store.getState().loadHostConfig(getter);
      assert.equal(store.getState().currencySymbol, 'shellCoin');
      assert.equal(store.getState().subscriptionEnabled, true);
      await store.getState().loadHostConfig(() => { assert.fail('must not request again'); });
    }
  });
  test(`${workspace}: concurrent calls and effect replay request only once`, async () => {
    const store = createHostConfigStore();
    let calls = 0;
    let complete;
    const getter = () => { calls++; return new Promise(resolve => { complete = resolve; }); };
    const first = store.getState().loadHostConfig(getter);
    const second = store.getState().loadHostConfig(getter);
    assert.equal(first, second);
    await Promise.resolve();
    assert.equal(calls, 1);
    complete({ ...host, currencySymbol: 'usd' });
    await first;
    await store.getState().loadHostConfig(getter);
    assert.equal(calls, 1);
    assert.equal(store.getState().currencySymbol, 'usd');
    // A new page/store does not inherit the previous host's settings.
    assert.equal(createHostConfigStore().getState().currencySymbol, 'shellCoin');
  });
}

test('main: mounted config accepts removed currency field only after migration', () => {
  const { AppConfigSchema } = loadTypeScript(resolve('database/src/types/config.ts'), 'main');
  const requireMain = createRequire(resolve('database/package.json'));
  const config = requireMain('js-yaml').load(readFileSync('database/data/config.example.yaml', 'utf8'));
  assert.equal(AppConfigSchema.safeParse(config).success, true);
  config.database.ui.currencySymbol = 'usd';
  assert.equal(AppConfigSchema.safeParse(config).success, false);
});

for (const workspace of ['main', 'release-v5.1']) {
  test(`${workspace}: application and shared UI resolve the same published SDK`, () => {
    const appRequire = createRequire(resolve(appRoot, 'package.json'));
    const sharedRequire = createRequire(appRequire.resolve('@labring/sealos-shared-sdk'));
    assert.equal(appRequire.resolve('@labring/sealos-desktop-sdk/app'), sharedRequire.resolve('@labring/sealos-desktop-sdk/app'));
    const sdkPackage = JSON.parse(readFileSync(resolve(dirname(appRequire.resolve('@labring/sealos-desktop-sdk/app')), '../package.json'), 'utf8'));
    assert.equal(sdkPackage.name, '@labring/sealos-desktop-sdk');
    assert.equal(sdkPackage.version, '0.1.24');
  });
}
