import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { AppConfigSchema } from '@/types/config';
import { handleAxiosStream } from '@/services/handleStream';

const sdk = vi.hoisted(() => ({ query: vi.fn(), rawQuery: vi.fn(), options: vi.fn() }));
vi.mock('@/config', () => ({
  Config: () => ({
    dbprovider: {
      components: {
        metrics: {
          url: 'http://metrics.example/prometheus',
          whitelistKubernetesHosts: []
        }
      }
    }
  })
}));
vi.mock('sealos-metrics-sdk', () => ({
  MetricsClient: class {
    database = { query: sdk.query, rawQuery: sdk.rawQuery };
    constructor(options: unknown) {
      sdk.options(options);
    }
  }
}));

beforeEach(() => vi.clearAllMocks());

describe('database metrics adapter', () => {
  it('normalizes legacy range query arrays including epoch zero', async () => {
    sdk.rawQuery.mockResolvedValue({ status: 'success' });
    await handleAxiosStream(
      {
        url: '/query',
        params: { query: ['up{}'], namespace: ['ns-demo'], start: ['0'], end: ['60'], step: ['1m'] }
      },
      'test'
    );
    expect(sdk.rawQuery).toHaveBeenCalledWith({
      query: 'up{}',
      namespace: 'ns-demo',
      range: { start: 0, end: 60, step: '1m' }
    });
    expect(sdk.options).toHaveBeenCalledWith({
      kubeconfig: 'test',
      metricsURL: 'http://metrics.example/prometheus',
      whitelistKubernetesHosts: []
    });
  });

  it('maps typed database queries and rejects unsupported database types', async () => {
    await handleAxiosStream(
      { url: '/q', params: { query: 'cpu', app: 'demo', type: 'postgresql' } },
      'test'
    );
    expect(sdk.query).toHaveBeenCalledWith({ query: 'cpu', app: 'demo', type: 'postgresql' });
    await expect(
      handleAxiosStream(
        { url: '/q', params: { query: 'cpu', app: 'demo', type: 'unknown' } },
        'test'
      )
    ).rejects.toThrow('Unsupported database type');
  });

  it('propagates denied access and rejects unsupported endpoints', async () => {
    sdk.rawQuery.mockRejectedValue(new Error('forbidden'));
    await expect(
      handleAxiosStream({ url: '/query', params: { query: 'up{}' } }, 'test')
    ).rejects.toThrow('forbidden');
    await expect(handleAxiosStream({ url: '/other' }, 'test')).rejects.toThrow(
      'Unsupported monitor endpoint'
    );
  });

  it('accepts imported configs without metrics settings', () => {
    const example = yaml.load(readFileSync('data/config.example.yaml', 'utf8')) as any;
    delete example.dbprovider.components.metrics;
    expect(AppConfigSchema.parse(example).dbprovider.components.metrics.url).toContain(
      '/prometheus'
    );
  });
});
