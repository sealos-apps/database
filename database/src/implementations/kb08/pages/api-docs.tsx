import dynamic from 'next/dynamic';

const ApiDocs = dynamic(() => import('@/implementations/kb08/components/ApiDocs'), { ssr: false });

export default function References() {
  return <ApiDocs />;
}
