import { versionedHandler } from '@/services/backend/kubeblocks';
import handler08 from '@/implementations/kb08/pages/api/platform/getQuota';
export default versionedHandler({ '0.8': handler08 });
