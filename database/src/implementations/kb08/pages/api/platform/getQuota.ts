import type { NextApiRequest, NextApiResponse } from 'next';
import { getK8s } from '@/implementations/kb08/services/backend/kubernetes';
import { jsonRes } from '@/implementations/kb08/services/backend/response';
import { authSession } from '@/implementations/kb08/services/backend/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { getUserQuota } = await getK8s({
      kubeconfig: await authSession(req)
    });

    const quota = await getUserQuota();

    jsonRes(res, {
      data: {
        quota
      }
    });
  } catch (error) {
    console.log(error);
    jsonRes(res, { code: 500, message: 'get price error' });
  }
}
