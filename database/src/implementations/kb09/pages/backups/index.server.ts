import { serviceSideProps } from '@/utils/i18n';
export async function getServerSideProps(content: any) {
  return {
    props: {
      ...(await serviceSideProps(content))
    }
  };
}
