import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { getKubeBlocksVersion } from '@/services/backend/kubeblocks';
import { LANG_KEY } from './cookieUtils';

export const serviceSideProps = (content: any) => {
  return serverSideTranslations(
    content.req.cookies[LANG_KEY] || 'zh',
    ['common'],
    {
      i18n: { defaultLocale: 'zh', locales: ['en', 'zh'] },
      localePath: getKubeBlocksVersion() === '0.8' ? './public/locales-kb08' : './public/locales'
    },
    content.locales
  );
};
