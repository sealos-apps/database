import { jsonRes } from '@/implementations/kb08/services/backend/response';
import { document } from '@/implementations/kb08/types/apis/index';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return res.json(document);
  }

  return jsonRes(res, {
    code: 405,
    message: 'Method not allowed'
  });
}
