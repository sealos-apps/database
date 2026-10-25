import { Config } from '@/implementations/kb08/config';
export const VLOGS_CONFIG = {
  get BASE_URL() {
    return Config().database.components.logging.url;
  },

  ENDPOINTS: {
    QUERY_LOGS: '/queryLogsByPod',
    QUERY_PODS: '/queryPodList'
  },

  get QUERY_LOGS_URL() {
    return `${this.BASE_URL}${this.ENDPOINTS.QUERY_LOGS}`;
  },

  get QUERY_PODS_URL() {
    return `${this.BASE_URL}${this.ENDPOINTS.QUERY_PODS}`;
  }
};
