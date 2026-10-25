import { serviceSideProps } from '@/utils/i18n';
import { Config } from '@/config';
export async function getServerSideProps(context: any) {
  const dbType = context.query?.dbType || '';
  const dbName = context.query?.name || '';
  const queryListType = context.query?.listType || 'overview';
  const dataImportEnabled = Config().database.features.fileImport;
  const dataImportSupported =
    ['postgresql', 'apecloud-mysql', 'mongodb', 'redis'].includes(dbType) && dataImportEnabled;
  const listType =
    queryListType === 'dataImport' && !dataImportSupported ? 'overview' : queryListType;

  return {
    props: { ...(await serviceSideProps(context)), dbName, listType, dbType }
  };
}
