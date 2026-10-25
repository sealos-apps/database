import { serviceSideProps } from '@/utils/i18n';
export async function getServerSideProps(context: any) {
  const dbName = context?.query?.name || '';
  const dbType = context?.query?.dbType || '';
  const tabType = context?.query?.type || 'form';

  if (dbType === 'redis') {
    return {
      redirect: {
        destination: `/db/detail?name=${dbName}&dbType=${dbType}&listType=dataImport`,
        permanent: false
      }
    };
  }

  return {
    props: { ...(await serviceSideProps(context)), dbName, tabType, dbType }
  };
}
