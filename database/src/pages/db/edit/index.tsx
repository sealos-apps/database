import { versionedPage } from '@/kubeblocks/page';
import Page09 from '@/implementations/kb09/pages/db/edit/index';
import Page08 from '@/implementations/kb08/pages/db/edit/index';
export default versionedPage({ '0.9': Page09, '0.8': Page08 });
import { versionedServerSideProps } from '@/services/backend/kubeblocks';
import { getServerSideProps as props09 } from '@/implementations/kb09/pages/db/edit/index.server';
import { getServerSideProps as props08 } from '@/implementations/kb08/pages/db/edit/index.server';
export const getServerSideProps = versionedServerSideProps({ '0.9': props09, '0.8': props08 });
