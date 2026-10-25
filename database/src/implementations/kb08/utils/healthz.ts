import { Config } from '@/implementations/kb08/config';

export const HEALTHZ_SERVICE = 'database';

export function assertReady() {
  const config = Config();
  if (
    !config.cloud.domain.trim() ||
    !config.cloud.desktopDomain.trim() ||
    !config.database.components.billing.url.trim()
  ) {
    throw new Error('Cloud domains and billing URL must be configured');
  }
}
