import { versionedHandler } from '@/services/backend/kubeblocks';
import handler09 from '@/implementations/kb09/pages/api/restoreBackup';
export default versionedHandler({ '0.9': handler09 });
