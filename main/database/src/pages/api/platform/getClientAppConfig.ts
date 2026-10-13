import { Config } from '@/config';
import { jsonRes } from '@/services/backend/response';
import { resolveDataflowEnabled } from '@/services/backend/dataflow';
import { ClientAppConfigSchema } from '@/types/config';
import {
  isServerMisconfiguredError,
  validateClientAppConfigOrThrow
} from '@sealos/shared/server/config';
import type { NextApiRequest, NextApiResponse } from 'next';

export async function getClientAppConfigServer() {
  const cfg = Config();
  const dataflowEnabled = await resolveDataflowEnabled();

  return validateClientAppConfigOrThrow(ClientAppConfigSchema, {
    domain: cfg.cloud.domain,
    desktopDomain: cfg.cloud.desktopDomain,
    currencySymbol: cfg.database.ui.currencySymbol,
    guideEnabled: cfg.database.features.guide,
    showDocument: cfg.database.features.showDocument,
    fileImportEnabled: cfg.database.features.fileImport,
    forcedStorageClassName: cfg.database.storage.forcedClassName,
    storageMaxSize: cfg.database.storage.maxSize,
    monitoringUrl: cfg.database.components.monitoring.url,
    migrationJobCpuMillicores: cfg.database.migration.jobCpuMillicores,
    migrationJobMemoryMiB: cfg.database.migration.jobMemoryMiB,
    dumpImportJobCpuMillicores: cfg.database.migration.dumpImportCpuMillicores,
    dumpImportJobMemoryMiB: cfg.database.migration.dumpImportMemoryMiB,
    backupEnabled: cfg.database.backup.enabled,
    backupJobCpuMillicores: cfg.database.backup.jobCpuMillicores,
    backupJobMemoryMiB: cfg.database.backup.jobMemoryMiB,
    billingUrl: cfg.database.components.billing.url,
    dataflowEnabled,
    eventAnalysisEnabled: cfg.database.components.eventAnalysis.enabled,
    customScripts: cfg.database.ui.customScripts
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    jsonRes(res, {
      code: 200,
      data: await getClientAppConfigServer()
    });
  } catch (error) {
    if (isServerMisconfiguredError(error)) {
      return jsonRes(res, { code: 500, message: 'Server misconfigured' });
    }
    console.error('[Client App Config] Unexpected server error:', error);
    return jsonRes(res, { code: 500, message: 'Internal Server Error' });
  }
}
