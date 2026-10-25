import { ApiReferenceReact } from '@scalar/api-reference-react';
import { document } from '@/implementations/kb08/types/apis/index';

import '@scalar/api-reference-react/style.css';

export default function ApiDocs() {
  const config = {
    content: document
  };
  return <ApiReferenceReact configuration={config} />;
}
