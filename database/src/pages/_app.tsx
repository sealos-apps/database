import '@labring/sealos-driver-sdk/src/driver.css';
import '@/styles/reset.scss';
import 'nprogress/nprogress.css';
import type { AppContext, AppProps } from 'next/app';
import App08, { getAppInitialProps as getProps08 } from '@/implementations/kb08/pages/_app';
import App09, { getAppInitialProps as getProps09 } from '@/implementations/kb09/pages/_app';
import { KubeBlocksContext } from '@/kubeblocks/page';
import { parseKubeBlocksVersion, type KubeBlocksVersion } from '@/kubeblocks/version';
import Router from 'next/router';
import NProgress from 'nprogress';

Router.events.on('routeChangeStart', () => NProgress.start());
Router.events.on('routeChangeComplete', () => NProgress.done());
Router.events.on('routeChangeError', () => NProgress.done());

// Deployment configuration is immutable for the lifetime of a browser page.
// Initial SSR supplies it; client navigation retains it without trusting URL/query input.
let browserVersion: KubeBlocksVersion | undefined;

type Props = AppProps & { kubeblocksVersion: KubeBlocksVersion; [key: string]: any };
function DatabaseApp(props: Props) {
  const version = parseKubeBlocksVersion(props.kubeblocksVersion);
  if (typeof window !== 'undefined') browserVersion = version;
  const App = version === '0.8' ? App08 : App09;
  return (
    <KubeBlocksContext.Provider value={version}>
      <App {...(props as any)} />
    </KubeBlocksContext.Provider>
  );
}

DatabaseApp.getInitialProps = async (context: AppContext) => {
  let version: KubeBlocksVersion;
  if (typeof window === 'undefined') {
    const { getKubeBlocksVersion } = await import('@/services/backend/kubeblocks');
    version = getKubeBlocksVersion();
  } else {
    version = parseKubeBlocksVersion(browserVersion);
  }
  const getProps = version === '0.8' ? getProps08 : getProps09;
  const props = await getProps(context);
  return { ...props, kubeblocksVersion: version };
};
export default DatabaseApp;
