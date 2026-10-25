import { serviceSideProps } from '@/utils/i18n';
export async function getServerSideProps(context: any) {
  const dbName = context?.query?.name || '';
  const dbType = context?.query?.dbType || '';
  const tabType = context?.query?.type || 'form';

  return {
    props: { ...(await serviceSideProps(context)), dbName, tabType, dbType }
  };
}
