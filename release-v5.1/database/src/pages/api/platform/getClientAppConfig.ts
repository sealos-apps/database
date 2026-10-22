import { jsonRes } from '@/services/backend/response';
import type { NextApiRequest, NextApiResponse } from 'next';

// Public compatibility endpoint for clients using main's database creation and settings forms.
// Keep release's environment configuration and the legacy /api/getEnv contract.
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const storageMaxSize = Number(process.env.STORAGE_MAX_SIZE) || 300;
  if (!Number.isFinite(storageMaxSize) || storageMaxSize <= 0) {
    return jsonRes(res, { code: 500, message: 'Server misconfigured' });
  }
  return jsonRes(res, {
    data: {
      domain: process.env.SEALOS_DOMAIN || 'cloud.sealos.io',
      storageMaxSize
    }
  });
}
