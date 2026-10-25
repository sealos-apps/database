import { authSession } from '@/implementations/kb08/services/backend/auth';
import { getK8s } from '@/implementations/kb08/services/backend/kubernetes';
import { databaseMonitorFetch } from '@/implementations/kb08/services/monitorFetch';
import { ApiResp } from '@/services/kubernet';
import { AdapterChartDataType, MonitorDBResult } from '@/types/monitor';
import type { NextApiRequest, NextApiResponse } from 'next';
import { sendError, ErrorType, ErrorCode } from '@/types/v2alpha/error';

const AdapterChartData: AdapterChartDataType = {
  disk: (data: MonitorDBResult) => {
    const temp = data?.data?.result;
    let XTimePoint: number[] = [];
    const desiredResult = temp.map((dataObject, index) => {
      const name = dataObject.metric?.persistentvolumeclaim;
      if (index === 0) {
        XTimePoint = dataObject.values.map((timePoint) => timePoint[0]);
      }
      const data = dataObject.values.map((item) => parseFloat(item[1]));
      return { name, data };
    });
    return {
      xData: XTimePoint,
      yData: desiredResult
    };
  },
  cpu: (data: MonitorDBResult) => {
    const temp = data?.data?.result;
    let XTimePoint: number[] = [];
    const desiredResult = temp.map((dataObject, index) => {
      const name = dataObject.metric?.pod;
      if (index === 0) {
        XTimePoint = dataObject.values.map((timePoint) => timePoint[0]);
      }
      const data = dataObject.values.map((item) => parseFloat(item[1]));
      return { name, data };
    });
    return {
      xData: XTimePoint,
      yData: desiredResult
    };
  },
  memory: (data: MonitorDBResult) => {
    const temp = data?.data?.result;
    let XTimePoint: number[] = [];
    const desiredResult = temp.map((dataObject, index) => {
      const name = dataObject.metric?.pod;
      if (index === 0) {
        XTimePoint = dataObject.values.map((timePoint) => timePoint[0]);
      }
      const data = dataObject.values.map((item) => parseFloat(item[1]));
      return { name, data };
    });
    return {
      xData: XTimePoint,
      yData: desiredResult
    };
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResp>) {
  try {
    const kubeconfig = await authSession(req).catch(() => null);
    if (!kubeconfig) {
      return sendError(res, {
        status: 401,
        type: ErrorType.AUTHENTICATION_ERROR,
        code: ErrorCode.AUTHENTICATION_REQUIRED,
        message: 'Unauthorized, please login again.'
      });
    }

    const k8s = await getK8s({ kubeconfig }).catch(() => null);
    if (!k8s) {
      return sendError(res, {
        status: 401,
        type: ErrorType.AUTHENTICATION_ERROR,
        code: ErrorCode.AUTHENTICATION_REQUIRED,
        message: 'Unauthorized, please login again.'
      });
    }
    const { namespace } = k8s;
    const { dbName, dbType, queryKey, start, end, step } = req.query;
    const endTime = Date.now();
    const startTime = endTime - 60 * 60 * 1000;

    const params = {
      query: queryKey,
      app: dbName,
      type: dbType,
      namespace: namespace,
      start: start ? Number(start) : startTime / 1000,
      end: end ? Number(end) : endTime / 1000,
      step: '1m'
    };

    const result = await databaseMonitorFetch(params, kubeconfig).then((res) => {
      const adapter =
        typeof queryKey === 'string'
          ? AdapterChartData[queryKey as keyof typeof AdapterChartData]
          : undefined;
      return adapter ? adapter(res as MonitorDBResult) : res;
    });

    return res.status(200).json({
      code: 200,
      data: { result }
    } as any);
  } catch (error: any) {
    // SDK 0.2.0 uses plain errors for denied namespace access (wrapped on first check).
    if (
      error?.message === 'Authentication failed: No permission for this namespace' ||
      error?.message === 'No permission for this namespace'
    ) {
      return sendError(res, {
        status: 403,
        type: ErrorType.AUTHORIZATION_ERROR,
        code: ErrorCode.PERMISSION_DENIED,
        message: 'Insufficient permissions to access monitor data in this namespace.'
      });
    }
    return sendError(res, {
      status: 500,
      type: ErrorType.INTERNAL_ERROR,
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Failed to retrieve monitor data.',
      details: error?.message || String(error)
    });
  }
}
