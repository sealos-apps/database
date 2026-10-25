import { createContext, useContext, type ComponentType } from 'react';
import ErrorPage from 'next/error';
import type { KubeBlocksVersion } from './version';

export const KubeBlocksContext = createContext<KubeBlocksVersion | null>(null);

export function versionedPage(pages: Partial<Record<KubeBlocksVersion, ComponentType<any>>>) {
  return function KubeBlocksPage(props: any) {
    const version = useContext(KubeBlocksContext);
    if (!version) throw new Error('KubeBlocks version was not initialized');
    const Page = pages[version];
    return Page ? <Page {...props} /> : <ErrorPage statusCode={404} />;
  };
}
