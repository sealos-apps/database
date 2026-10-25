import type { NextApiRequest, NextApiResponse } from 'next';
import { ApiResp } from '@/services/kubernet';
import { authSession } from '@/implementations/kb08/services/backend/auth';
import { getK8s } from '@/implementations/kb08/services/backend/kubernetes';
import { jsonRes } from '@/implementations/kb08/services/backend/response';
import { crLabelKey } from '@/implementations/kb08/constants/db';
import { adaptBackup } from '@/implementations/kb08/utils/adapt';

export type Props = {
  dbName: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResp>) {
  const group = 'dataprotection.kubeblocks.io';
  const version = 'v1alpha1';
  const plural = 'backups';

  const { k8sCustomObjects, namespace } = await getK8s({
    kubeconfig: await authSession(req)
  });

  const { body } = (await k8sCustomObjects.listNamespacedCustomObject(
    group,
    version,
    namespace,
    plural
  )) as { body: { items: any[] } };

  try {
    jsonRes(res, {
      data: body.items.map(adaptBackup)
    });
  } catch (err: any) {
    jsonRes(res, {
      code: 500,
      error: err
    });
  }
}
