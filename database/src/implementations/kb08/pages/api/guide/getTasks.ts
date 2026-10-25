import { Config } from '@/implementations/kb08/config';
import { authAppToken } from '@/implementations/kb08/services/backend/auth';
import { jsonRes } from '@/implementations/kb08/services/backend/response';
import { ApiResp } from '@/services/kubernet';
import { UserTask } from '@/implementations/kb08/types/user';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResp>) {
  try {
    if (!Config().database.features.guide) {
      return jsonRes(res, {
        data: {
          needGuide: false
        }
      });
    }

    const token = await authAppToken(req.headers);
    if (!token) {
      return jsonRes(res, { code: 401, message: 'token is valid' });
    }

    const domain = Config().cloud.desktopDomain;
    const response = await fetch(`https://${domain}/api/account/getTasks`, {
      method: 'GET',
      headers: {
        Authorization: token
      }
    });

    const result: {
      code: number;
      data: UserTask[];
      message: string;
    } = await response.json();

    if (result.code !== 200) {
      return jsonRes(res, {
        code: 500,
        message: 'desktop api is err'
      });
    }

    const launchpadTask = result.data.find((task) => task.taskType === 'DATABASE');
    const needGuide = launchpadTask ? !launchpadTask.isCompleted : false;

    jsonRes(res, {
      code: 200,
      data: { needGuide, task: launchpadTask }
    });
  } catch (err: any) {
    console.log(err);
    jsonRes(res, {
      code: 500,
      error: err
    });
  }
}
