/// <reference types="next" />
/// <reference types="next/image-types/global" />

import { AppConfig } from './src/types/config';

declare global {
  var __APP_CONFIG__: Readonly<AppConfig> | undefined;
}
export {};
