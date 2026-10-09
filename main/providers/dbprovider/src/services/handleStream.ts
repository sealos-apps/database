import { Config } from '@/config';
import { AxiosRequestConfig } from 'axios';
import { MetricsClient } from 'sealos-metrics-sdk';
import type { DatabaseQueryParams, DatabaseType, RawQueryParams } from 'sealos-metrics-sdk';

type LegacyMonitorParams = {
  query?: string | string[];
  namespace?: string | string[];
  start?: string | number | string[];
  end?: string | number | string[];
  step?: string | string[];
  app?: string | string[];
  type?: string | string[];
};

const normalizeParam = (value: unknown): string | undefined => {
  if (Array.isArray(value)) return value.length > 0 ? String(value[0]) : undefined;
  if (value === undefined || value === null) return undefined;
  return String(value);
};

const parseRange = (params: LegacyMonitorParams): RawQueryParams['range'] => {
  const startRaw = normalizeParam(params.start);
  if (!startRaw) return undefined;

  const endRaw = normalizeParam(params.end);
  const step = normalizeParam(params.step);

  return {
    start: Number(startRaw),
    ...(endRaw ? { end: Number(endRaw) } : {}),
    ...(step ? { step } : {})
  };
};

const isSupportedDatabaseType = (value: string): value is DatabaseType =>
  ['apecloud-mysql', 'postgresql', 'mongodb', 'redis', 'kafka', 'milvus'].includes(value);

export const handleAxiosStream = async (props: AxiosRequestConfig, kubeconfig: string) => {
  try {
    const url = normalizeParam(props.url) || '';
    const params = (props.params || {}) as LegacyMonitorParams;
    const { url: metricsURL, whitelistKubernetesHosts } = Config().dbprovider.components.metrics;

    const client = new MetricsClient({
      kubeconfig,
      metricsURL,
      whitelistKubernetesHosts
    });

    if (url === '/query') {
      const query = normalizeParam(params.query);
      if (!query) {
        throw new Error('monitor query is required');
      }

      const namespace = normalizeParam(params.namespace);
      const range = parseRange(params);
      const request: RawQueryParams = {
        query,
        ...(namespace ? { namespace } : {}),
        ...(range ? { range } : {})
      };

      return client.database.rawQuery(request);
    }

    if (url === '/q') {
      const query = normalizeParam(params.query);
      const app = normalizeParam(params.app);
      const type = normalizeParam(params.type);
      if (!query || !app || !type) {
        throw new Error('monitor query/app/type are required');
      }
      if (!isSupportedDatabaseType(type)) {
        throw new Error(`Unsupported database type: ${type}`);
      }

      const namespace = normalizeParam(params.namespace);
      const range = parseRange(params);
      const request: DatabaseQueryParams = {
        query,
        app,
        type,
        ...(namespace ? { namespace } : {}),
        ...(range ? { range } : {})
      };

      return client.database.query(request);
    }

    throw new Error(`Unsupported monitor endpoint: ${url}`);
  } catch (error) {
    console.log('===monitor===\n', error);
    throw error;
  }
};
