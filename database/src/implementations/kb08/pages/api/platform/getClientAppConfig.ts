import { Config } from '@/implementations/kb08/config';
import { jsonRes } from '@/implementations/kb08/services/backend/response';
import type { NextApiRequest, NextApiResponse } from 'next';

// Public compatibility endpoint for clients using main's database creation and settings forms.
// Keep the legacy /api/getEnv contract while reading the server-side YAML config.
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const storageMaxSize = Number(Config().database.storage.maxSize) || 300;
  if (!Number.isFinite(storageMaxSize) || storageMaxSize <= 0) {
    return jsonRes(res, { code: 500, message: 'Server misconfigured' });
  }
  return jsonRes(res, {
    data: {
      domain: Config().cloud.domain || 'cloud.sealos.io',
      storageMaxSize
    }
  });
}
