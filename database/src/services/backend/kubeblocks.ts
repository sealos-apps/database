import { Config } from '@/config';
import { parseKubeBlocksVersion, type KubeBlocksVersion } from '@/kubeblocks/version';
import type { NextApiHandler, GetServerSideProps } from 'next';

export function getKubeBlocksVersion(): KubeBlocksVersion {
  return parseKubeBlocksVersion(Config().database.kubeblocks.version);
}

// Never fall through to another version for a missing operation.
export function versionedHandler(
  handlers: Partial<Record<KubeBlocksVersion, NextApiHandler>>
): NextApiHandler {
  return (req, res) => {
    const handler = handlers[getKubeBlocksVersion()];
    if (!handler)
      return res
        .status(404)
        .json({ code: 404, message: 'Not supported by this KubeBlocks version' });
    return handler(req, res);
  };
}

export function versionedServerSideProps(
  handlers: Partial<Record<KubeBlocksVersion, GetServerSideProps>>
): GetServerSideProps {
  return (context) => {
    const handler = handlers[getKubeBlocksVersion()];
    return handler ? handler(context) : Promise.resolve({ notFound: true });
  };
}
