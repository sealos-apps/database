import type { NextApiRequest, NextApiResponse } from 'next';
import { ApiResp } from '@/services/kubernet';
import { authSession } from '@/implementations/kb08/services/backend/auth';
import { getK8s } from '@/implementations/kb08/services/backend/kubernetes';
import { jsonRes } from '@/implementations/kb08/services/backend/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResp>) {
  try {
    const { name } = req.query as { name: string };
    const { k8sEvents, namespace } = await getK8s({
      kubeconfig: await authSession(req)
    });

    const response = await k8sEvents.listNamespacedEvent(
      namespace,
      undefined,
      undefined,
      undefined
      // `metadata.name=${name}`
    );

    jsonRes(res, { data: response?.body?.items });
  } catch (err: any) {
    jsonRes(res, {
      code: 500,
      error: err
    });
  }
}
