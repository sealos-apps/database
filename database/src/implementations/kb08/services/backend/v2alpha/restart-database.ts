import { restartDatabaseSchemas } from '@/implementations/kb08/types/apis/v2alpha/index';
import { getK8s } from '../kubernetes';
import { z } from 'zod';
import { getCluster } from '@/implementations/kb08/pages/api/getDBByName';
import { json2BasicOps } from '@/implementations/kb08/utils/json2Yaml';
import { NextApiRequest } from 'next';
import { adaptDBDetail } from '@/implementations/kb08/utils/adapt';
import { raw2schema } from './get-database';

export async function restartDatabase(
  k8s: Awaited<ReturnType<typeof getK8s>>,
  request: {
    params: z.infer<typeof restartDatabaseSchemas.pathParams>;
  },
  req: NextApiRequest
) {
  const body = await getCluster(req, request.params.databaseName);
  const rawDbType = body?.metadata?.labels['clusterdefinition.kubeblocks.io/name'];
  if (!rawDbType) {
    throw new Error('Unable to determine database type from cluster metadata');
  }
  const dbType = (rawDbType as string) === 'mysql' ? 'apecloud-mysql' : rawDbType;
  const yaml = json2BasicOps({
    dbName: request.params.databaseName,
    dbType: dbType,
    type: 'Restart'
  });
  await k8s.applyYamlList([yaml], 'update');

  return { data: raw2schema(adaptDBDetail(body)) };
}
