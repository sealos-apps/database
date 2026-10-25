export const KUBEBLOCKS_VERSIONS = ['0.8', '0.9'] as const;
export type KubeBlocksVersion = (typeof KUBEBLOCKS_VERSIONS)[number];

export function parseKubeBlocksVersion(value: unknown): KubeBlocksVersion {
  if (value === '0.8' || value === '0.9') return value;
  throw new Error('database.kubeblocks.version must be "0.8" or "0.9"');
}
