import { versionedPage } from '@/kubeblocks/page';
import Page09 from '@/implementations/kb09/pages/redirect';
import Page08 from '@/implementations/kb08/pages/redirect';
export default versionedPage({ '0.9': Page09, '0.8': Page08 });
