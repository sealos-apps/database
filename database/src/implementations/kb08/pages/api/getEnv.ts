import { Config } from '@/implementations/kb08/config';
import { jsonRes } from '@/implementations/kb08/services/backend/response';
import { ApiResp } from '@/services/kubernet';
import { resolveDataflowEnabled } from '@/implementations/kb08/services/backend/dataflow';
import type { NextApiRequest, NextApiResponse } from 'next';

export type SystemEnvResponse = {
  domain: string;
  desktopDomain: string;
  env_storage_className: string;
  migrate_file_image: string;
  minio_url: string;
  BACKUP_ENABLED: boolean;
  LOG_ENABLED: boolean;
  SHOW_DOCUMENT: boolean;
  DATA_IMPORT_ENABLED: boolean;
  KAFKA_ENABLED: boolean;
  STORAGE_MAX_SIZE: number;
  DATAFLOW_ENABLED: boolean;
};

process.on('unhandledRejection', (reason, promise) => {
  console.error(`Caught unhandledRejection:`, reason, promise);
});

process.on('uncaughtException', (err) => {
  console.error(`Caught uncaughtException:`, err);
});

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResp>) {
  const DATAFLOW_ENABLED = await resolveDataflowEnabled();

  jsonRes<SystemEnvResponse>(res, {
    data: {
      domain: Config().cloud.domain || 'cloud.sealos.io',
      desktopDomain: Config().cloud.desktopDomain || 'cloud.sealos.io',
      env_storage_className: Config().database.storage.forcedClassName || 'openebs-backup',
      migrate_file_image: Config().database.migration.importDataImage || 'ghcr.io/wallyxjh/test:7.1',
      minio_url: Config().database.components.storage.url || '',
      BACKUP_ENABLED: Config().database.backup.enabled,
      LOG_ENABLED: Config().database.features.logs,
      SHOW_DOCUMENT: Config().database.features.showDocument,
      DATA_IMPORT_ENABLED: Config().database.features.fileImport,
      KAFKA_ENABLED: Config().database.features.kafka,
      STORAGE_MAX_SIZE: Number(Config().database.storage.maxSize) || 300,
      DATAFLOW_ENABLED
    }
  });
}
