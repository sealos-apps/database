import { ApiReferenceReact } from '@scalar/api-reference-react';
import { getUserKubeConfig } from '@/implementations/kb08/utils/user';
import { document } from '@/implementations/kb08/types/apis/v2alpha/index';

import '@scalar/api-reference-react/style.css';

export default function ApiV2AlphaDocs() {
  const config = {
    content: document,
    authentication: {
      preferredSecurityScheme: ['kubeconfigAuth'],
      securitySchemes: {
        kubeconfigAuth: {
          in: 'header' as const,
          name: 'Authorization',
          value: encodeURIComponent(getUserKubeConfig() || '')
        }
      }
    }
  };

  return <ApiReferenceReact configuration={config} />;
}
