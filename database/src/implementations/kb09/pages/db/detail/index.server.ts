import { serviceSideProps } from '@/utils/i18n';
export async function getServerSideProps(context: any) {
  const dbType = context.query?.dbType || '';
  const dbName = context.query?.name || '';
  const listType = context.query?.listType || 'overview';

  return {
    props: { ...(await serviceSideProps(context)), dbName, listType, dbType }
  };
}
