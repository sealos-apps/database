import { DBTypeEnum } from '@/implementations/kb08/constants/db';
import { ServiceLogConfigs } from '@/implementations/kb08/constants/log';
import { authSession } from '@/implementations/kb08/services/backend/auth';
import { getK8s } from '@/implementations/kb08/services/backend/kubernetes';
import { jsonRes } from '@/implementations/kb08/services/backend/response';
import { ApiResp } from '@/services/kubernet';
import { SupportReconfigureDBType } from '@/implementations/kb08/types/db';
import { LogTypeEnum } from '@/implementations/kb08/constants/log';
import { DatabaseLogService } from '@/implementations/kb08/utils/logParsers/LogParser';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResp>) {
  try {
    const { namespace, k8sExec, k8sCore } = await getK8s({
      kubeconfig: await authSession(req)
    });

    const {
      podName,
      dbType,
      logType,
      logPath,
      page = 1,
      pageSize = 100,
      startTime,
      endTime
    } = req.body as {
      podName: string;
      dbType: SupportReconfigureDBType;
      logType: LogTypeEnum;
      logPath: string;
      page?: number;
      pageSize?: number;
      startTime?: number;
      endTime?: number;
    };

    if (!podName || !dbType || !logType || !logPath) {
      throw new Error('Missing required parameters: podName, dbType, logType or logPath');
    }

    const logConfig = ServiceLogConfigs[dbType][logType];

    if (!logConfig) {
      throw new Error('Invalid log type');
    }

    const logService = new DatabaseLogService(k8sExec, k8sCore, namespace);

    const result = await logService.readLogs({
      podName,
      containerNames: logConfig.containerNames,
      logPath,
      page,
      pageSize,
      dbType: dbType as DBTypeEnum,
      logType,
      startTime,
      endTime
    } as any);

    jsonRes(res, { data: result });
  } catch (err: any) {
    jsonRes(res, {
      code: 500,
      error: err
    });
  }
}
