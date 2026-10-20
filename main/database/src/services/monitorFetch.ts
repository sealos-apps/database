import { MetricsClient } from '@labring/sealos-metrics-sdk';
import type { DatabaseQueryParams, TimeRange } from '@labring/sealos-metrics-sdk';
import { Config } from '@/config';

interface MonitorParams extends TimeRange {
  namespace: string;
  query: unknown;
  app?: unknown;
  type?: unknown;
}

const requireString = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || !value) {
    throw new Error(`Invalid monitoring ${name}`);
  }
  return value;
};

// Bind each client to this request's credentials; never share it between users.
const createClient = (kubeconfig: string) =>
  new MetricsClient({
    kubeconfig,
    metricsURL: process.env.METRICS_URL || Config().database.components.monitoring.url
  });

export const databaseMonitorFetch = (params: MonitorParams, kubeconfig: string) => {
  const { namespace, start, end, step, time } = params;
  const app = requireString(params.app, 'database name');
  if (!/^[a-z0-9](?:[-a-z0-9]*[a-z0-9])?$/.test(app)) {
    throw new Error('Invalid monitoring database name');
  }
  return createClient(kubeconfig).database.query({
    namespace,
    app,
    type: requireString(params.type, 'database type') as DatabaseQueryParams['type'],
    query: requireString(params.query, 'query'),
    range: { start, end, step, time }
  });
};

// Only route-owned PromQL is accepted here; the SDK scopes selectors to namespace.
export const rawMonitorFetch = (params: MonitorParams, kubeconfig: string) => {
  const { namespace, start, end, step, time } = params;
  return createClient(kubeconfig).raw.query({
    namespace,
    query: requireString(params.query, 'query'),
    range: { start, end, step, time }
  });
};
