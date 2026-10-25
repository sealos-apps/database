import { versionedHandler } from '@/services/backend/kubeblocks';
import handler09 from '@/implementations/kb09/pages/api/monitor/getRollback';
import handler08 from '@/implementations/kb08/pages/api/monitor/getRollback';
export default versionedHandler({ '0.9': handler09, '0.8': handler08 });
