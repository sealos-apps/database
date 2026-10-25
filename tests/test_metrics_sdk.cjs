const { appRoot, sourceFile, originalAlias } = require('./support/source.cjs');
// Offline integration: real SDK, fictional Kubernetes/Prometheus HTTP fixtures.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { readFileSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const { createRequire, Module } = require('node:module');

function loadHelper(workspace, relative = 'services/monitorFetch.ts', mocks = {}) {
  const filename = sourceFile(workspace, relative);
  const requireWorkspace = createRequire(resolve(appRoot, 'package.json'));
  const ts = requireWorkspace('typescript');
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(dirname(filename));
  const originalRequire = mod.require.bind(mod);
  mod.require = id => originalAlias(id) in mocks ? mocks[originalAlias(id)] : originalAlias(id) === '@/config'
    ? { Config: () => ({ database: { components: { monitoring: { url: process.env.METRICS_URL } } } }) }
    : originalRequire(id);
  mod._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText, filename);
  return mod.exports;
}

for (const workspace of ['main', 'release-v5.1']) {
  test(`${workspace}: SDK authenticates and queries metrics directly`, async t => {
    const requests = [];
    const server = http.createServer(async (req, res) => {
      let body = '';
      for await (const chunk of req) body += chunk;
      const url = new URL(req.url, 'http://fixture');
      requests.push({ url, auth: req.headers.authorization, body });
      res.setHeader('Content-Type', 'application/json');
      if (url.pathname === '/readyz') return res.end('ok');
      if (url.pathname.endsWith('/selfsubjectaccessreviews')) {
        const allowed = req.headers.authorization !== 'Bearer denied';
        return res.end(JSON.stringify({ status: { allowed } }));
      }
      const range = url.pathname.endsWith('/query_range');
      res.end(JSON.stringify({ status: 'success', data: {
        resultType: range ? 'matrix' : 'vector', result: [{ metric: { pod: 'demo-postgresql-0' },
          ...(range ? { values: [[0, '12.5']] } : { value: [0, '12.5'] }) }]
      } }));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const address = `http://127.0.0.1:${server.address().port}`;
    const previous = { METRICS_URL: process.env.METRICS_URL,
      WHITELIST_KUBERNETES_HOSTS: process.env.WHITELIST_KUBERNETES_HOSTS };
    process.env.METRICS_URL = workspace === 'main' ? 'http://unused-env.invalid' : address;
    process.env.WHITELIST_KUBERNETES_HOSTS = address;
    t.after(() => { for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    } });
    const kubeconfig = token => JSON.stringify({ apiVersion: 'v1', kind: 'Config',
      clusters: [{ name: 'fixture', cluster: { server: address } }],
      users: [{ name: 'fixture', user: { token } }],
      contexts: [{ name: 'fixture', context: { cluster: 'fixture', user: 'fixture', namespace: 'ns-demo' } }],
      'current-context': 'fixture' });
    const helper = loadHelper(workspace, 'services/monitorFetch.ts', {
      '@/config': { Config: () => ({
        database: { components: { monitoring: { url: address } } }
      }) }
    });
    const result = await helper.databaseMonitorFetch({ namespace: 'ns-demo', app: 'demo',
      type: 'postgresql', query: 'cpu', start: 0, end: 60, step: '1m' }, kubeconfig('allowed'));
    assert.deepEqual(result.data.result[0].values, [[0, '12.5']]);
    const range = requests.find(r => r.url.pathname === '/api/v1/query_range');
    assert.ok(range);
    assert.equal(new URLSearchParams(range.body).get('start'), '0');
    assert.equal(new URLSearchParams(range.body).get('step'), '1m');
    assert.match(new URLSearchParams(range.body).get('query'), /namespace=~"ns-demo"/);
    assert.equal(range.auth, undefined); // Never forward kubeconfig/token to metrics.
    assert.equal(JSON.parse(requests.find(r => r.url.pathname.endsWith("/selfsubjectaccessreviews")).body).spec.resourceAttributes.namespace, 'ns-demo');
    const instant = await helper.rawMonitorFetch({ namespace: 'ns-demo',
      query: 'mysql_global_status_uptime{$,pod="demo-mysql-0"}' }, kubeconfig('allowed'));
    assert.deepEqual(instant.data.result[0].value, [0, '12.5']);
    const query = requests.find(r => r.url.pathname === '/api/v1/query');
    assert.match(new URLSearchParams(query.body).get('query'), /namespace="ns-demo"/);
    for (const relative of ['monitor/getMonitorData.ts', 'v1/monitor/data.ts', 'v2alpha/monitor/data.ts']) {
      let output;
      const route = loadHelper(workspace, `pages/api/${relative}`, {
        '@/services/backend/auth': { authSession: async () => kubeconfig('allowed') },
        '@/services/backend/kubernetes': { getK8s: async () => ({ namespace: 'ns-demo' }) },
        '@/services/backend/response': { jsonRes: (_res, data) => { output = data; } },
        '@/types/v2alpha/error': { sendError: () => assert.fail('unexpected route error') },
        '@/types/response': { ResponseCode: { UNAUTHORIZED: 401 }, ResponseMessages: {} },
        '@/services/monitorFetch': helper
      }).default;
      const res = { status: () => res, json: data => { output = data; } };
      await route({ query: { dbName: 'demo', dbType: 'postgresql', queryKey: 'cpu', start: '0', end: '60' } }, res);
      assert.equal(output.code, 200);
      assert.deepEqual(output.data.result, { xData: [0], yData: [{ name: 'demo-postgresql-0', data: [12.5] }] });
    }
    const count = requests.filter(r => r.url.pathname.startsWith('/api/v1/query')).length;
    const requireWorkspace = createRequire(resolve(appRoot, 'package.json'));
    // The shared SDK ships TypeScript; transpile it just like the route fixtures.
    const sharedErrors = loadHelper(workspace,
      requireWorkspace.resolve('@labring/sealos-shared-sdk/server/v2alpha'));
    const errors = loadHelper(workspace, 'types/v2alpha/error.ts', {
      '@labring/sealos-shared-sdk/server/v2alpha': sharedErrors
    });
    const monitorRequest = { query: { dbName: 'demo', dbType: 'postgresql', queryKey: 'cpu' } };
    const callV2Monitor = async (credentials, monitor = helper) => {
      let status, body;
      const route = loadHelper(workspace, 'pages/api/v2alpha/monitor/data.ts', {
        '@/services/backend/auth': { authSession: async () => credentials },
        '@/services/backend/kubernetes': { getK8s: async () => ({ namespace: 'ns-demo' }) },
        '@/services/monitorFetch': monitor,
        '@/types/v2alpha/error': errors
      }).default;
      const res = { status: value => { status = value; return res; }, json: value => { body = value; } };
      await route(monitorRequest, res);
      return { status, body };
    };
    // Exercise the real SDK's access review rejection through the API response serializer.
    const denied = await callV2Monitor(kubeconfig('denied'));
    assert.equal(denied.status, 403);
    assert.equal(denied.body.error.type, errors.ErrorType.AUTHORIZATION_ERROR);
    assert.equal(denied.body.error.code, errors.ErrorCode.PERMISSION_DENIED);
    assert.equal(denied.body.data, undefined);
    const anonymous = await callV2Monitor(null);
    assert.equal(anonymous.status, 401);
    assert.equal(anonymous.body.error.code, errors.ErrorCode.AUTHENTICATION_REQUIRED);
    for (const [message, expectedStatus] of [
      ['No permission for this namespace', 403],
      ['Authentication failed: Kubernetes unavailable', 500],
      ['Metrics query failed', 500]
    ]) {
      const result = await callV2Monitor(kubeconfig('allowed'), {
        databaseMonitorFetch: async () => { throw new Error(message); }
      });
      assert.equal(result.status, expectedStatus);
      assert.equal(result.body.error.code, expectedStatus === 403
        ? errors.ErrorCode.PERMISSION_DENIED : errors.ErrorCode.INTERNAL_ERROR);
    }
    await assert.rejects(helper.rawMonitorFetch({ namespace: 'ns-demo', query: 'up{$}' }, kubeconfig('denied')));
    await assert.rejects(helper.rawMonitorFetch({ namespace: 'ns-demo', query: 'up{namespace="other"}' }, kubeconfig('allowed')));
    assert.equal(requests.filter(r => r.url.pathname.startsWith('/api/v1/query')).length, count);
    assert.throws(() => helper.databaseMonitorFetch({ namespace: 'ns-demo', type: 'mysql',
      app: 'demo"} or up{', query: 'cpu' }, kubeconfig('allowed')), /database name/);
    assert.ok(requests.every(r => !['/q', '/query'].includes(r.url.pathname)));
  });
}
