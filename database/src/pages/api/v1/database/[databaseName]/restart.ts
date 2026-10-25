import { versionedHandler } from '@/services/backend/kubeblocks';
import handler09 from '@/implementations/kb09/pages/api/v1/database/[databaseName]/restart';
export default versionedHandler({ '0.9': handler09 });
