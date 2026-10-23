import { z } from 'zod';

// Canonical server-side release-v5.1 configuration.
export const AppConfigSchema = z.strictObject({
  cloud: z.strictObject({
    domain: z.string(),
    desktopDomain: z.string(),
    port: z.string(),
    disableHttps: z.boolean()
  }),
  database: z.strictObject({
    features: z.strictObject({
      guide: z.boolean(),
      showDocument: z.boolean(),
      fileImport: z.boolean(),
      logs: z.boolean(),
      kafka: z.boolean(),
      managedDb: z.boolean()
    }),
    ui: z.strictObject({
      customScripts: z.array(z.record(z.string(), z.string()))
    }),
    storage: z.strictObject({
      forcedClassName: z.string(),
      maxSize: z.number().int().positive()
    }),
    components: z.strictObject({
      monitoring: z.strictObject({
        url: z.string()
      }),
      alerting: z.strictObject({
        url: z.string()
      }),
      billing: z.strictObject({
        url: z.string()
      }),
      logging: z.strictObject({
        url: z.string()
      }),
      storage: z.strictObject({
        url: z.string(),
        port: z.number().int().positive(),
        useSSL: z.boolean(),
        bucketName: z.string(),
        accessKey: z.string(),
        secretKey: z.string()
      }),
      eventAnalysis: z.strictObject({
        fastGPTKey: z.string()
      })
    }),
    migration: z.strictObject({
      importDataImage: z.string()
    }),
    backup: z.strictObject({
      enabled: z.boolean()
    })
  })
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

declare global {
  var __APP_CONFIG__: AppConfig | undefined;
}
