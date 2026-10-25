import { getK8s, K8sApi } from '@/implementations/kb08/services/backend/kubernetes';
import { handleK8sError, jsonRes } from '@/implementations/kb08/services/backend/response';
import type { NextApiRequest, NextApiResponse } from 'next';
import { versionListSchema } from '@/implementations/kb08/types/schemas/db';
import { DBTypeEnum } from '@/implementations/kb08/constants/db';
import z from 'zod';
import { DBVersionMap } from '@/implementations/kb08/store/static';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const kc = K8sApi();

  const k8s = (await getK8s({ kubeconfig: kc.exportConfig() }))!;

  if (req.method === 'GET') {
    try {
      const DBVersion: z.Infer<typeof versionListSchema> = {
        [DBTypeEnum.postgresql]: [],
        [DBTypeEnum.mongodb]: [],
        [DBTypeEnum.mysql]: [],
        [DBTypeEnum.polardbx]: [],
        [DBTypeEnum.redis]: [],
        [DBTypeEnum.kafka]: [],
        [DBTypeEnum.qdrant]: [],
        [DBTypeEnum.nebula]: [],
        [DBTypeEnum.weaviate]: [],
        [DBTypeEnum.milvus]: [],
        [DBTypeEnum.pulsar]: [],
        [DBTypeEnum.clickhouse]: []
      };

      // source price
      const { k8sCustomObjects } = k8s;

      const { body } = (await k8sCustomObjects.listClusterCustomObject(
        'apps.kubeblocks.io',
        'v1alpha1',
        'clusterversions'
      )) as any;

      body.items.forEach((item: any) => {
        const clusterDefinitionRef = item?.spec?.clusterDefinitionRef as string;
        const db =
          clusterDefinitionRef === 'mysql' || clusterDefinitionRef === 'apecloud-mysql'
            ? DBTypeEnum.mysql
            : (clusterDefinitionRef as `${DBTypeEnum}`);
        if (DBVersion[db] && item?.metadata?.name && !DBVersion[db].includes(item.metadata.name)) {
          DBVersion[db].unshift(item.metadata.name);
        }
      });

      jsonRes(res, {
        data: DBVersion
      });
    } catch (err) {
      console.log('error get db by name', err);
      jsonRes(res, handleK8sError(err));
    }
  } else {
    return jsonRes(res, {
      code: 405,
      message: 'Method not allowed'
    });
  }
}
