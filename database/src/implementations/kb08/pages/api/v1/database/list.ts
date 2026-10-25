import { authSession } from '@/implementations/kb08/services/backend/auth';
import { getK8s } from '@/implementations/kb08/services/backend/kubernetes';
import { handleK8sError, jsonRes } from '@/implementations/kb08/services/backend/response';
import { NextApiRequest, NextApiResponse } from 'next';
import { ResponseCode, ResponseMessages } from '@/types/response';
import { updateDatabaseSchemas } from '@/implementations/kb08/types/apis/index';
import { updateDatabase } from '@/implementations/kb08/services/backend/apis/update-database';
import { KbPgClusterType } from '@/implementations/kb08/types/cluster';
import { adaptDBListItem } from '@/implementations/kb08/utils/adapt';
import { getDatabaseList } from '@/implementations/kb08/services/backend/apis/list-database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const kubeconfig = await authSession(req).catch(() => null);
    if (!kubeconfig) {
      return jsonRes(res, {
        code: ResponseCode.UNAUTHORIZED,
        message: ResponseMessages[ResponseCode.UNAUTHORIZED]
      });
    }

    const k8s = await getK8s({ kubeconfig }).catch(() => null);
    if (!k8s) {
      return jsonRes(res, {
        code: ResponseCode.UNAUTHORIZED,
        message: ResponseMessages[ResponseCode.UNAUTHORIZED]
      });
    }
    const data = await getDatabaseList(k8s);

    return jsonRes(res, { data });
  } catch (err) {
    console.log('error list db', err);
    jsonRes(res, handleK8sError(err));
  }
}
