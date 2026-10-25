import { versionedHandler } from '@/services/backend/kubeblocks';
import handler09 from '@/implementations/kb09/pages/api/backup/getBackups';
import handler08 from '@/implementations/kb08/pages/api/backup/getBackups';
export default versionedHandler({ '0.9': handler09, '0.8': handler08 });
