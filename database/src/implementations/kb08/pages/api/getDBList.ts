import type { NextApiRequest, NextApiResponse } from 'next';
import { ApiResp } from '@/services/kubernet';
import { authSession } from '@/implementations/kb08/services/backend/auth';
import { getK8s } from '@/implementations/kb08/services/backend/kubernetes';
import { jsonRes } from '@/implementations/kb08/services/backend/response';
import { adaptDBListItem } from '@/implementations/kb08/utils/adapt';
import { KbPgClusterType } from '@/implementations/kb08/types/cluster';

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResp>) {
  try {
    const { k8sCustomObjects, namespace } = await getK8s({
      kubeconfig: await authSession(req)
    });

    const response = (await k8sCustomObjects.listNamespacedCustomObject(
      'apps.kubeblocks.io',
      'v1alpha1',
      namespace,
      'clusters',
      undefined,
      undefined,
      undefined,
      undefined,
      `clusterdefinition.kubeblocks.io/name`
    )) as {
      body: {
        items: KbPgClusterType[];
      };
    };
    const data = (response?.body?.items || []).map(adaptDBListItem);

    jsonRes(res, { data });
  } catch (err: any) {
    jsonRes(res, {
      code: 500,
      error: err
    });
  }
}
