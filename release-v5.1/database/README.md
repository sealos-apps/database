# sealos app launchpad

## Deployment configuration

`dbproviderConfig.kafkaEnabled` controls whether Kafka is available in the database creation
form. It defaults to `"true"`. Set it to `"false"` in the user values file to hide Kafka while
leaving existing Kafka instances manageable:

```yaml
dbproviderConfig:
  kafkaEnabled: 'false'
```

`dbproviderConfig.dataImportEnabled` controls whether the Data Import tab appears on supported
database detail pages. It defaults to `"true"`. Set it to `"false"` in the user values file to hide
the tab and redirect direct Data Import detail views back to Overview:

```yaml
dbproviderConfig:
  dataImportEnabled: 'false'
```

`dbproviderConfig.logEnabled` controls whether the Log Analysis tab appears on supported database
detail pages. It defaults to `"false"` and is independent of `backupEnabled`:

```yaml
dbproviderConfig:
  logEnabled: 'true'
```

The installer seeds `/root/.sealos/cloud/values/apps/database/dbprovider-values.yaml` from
`dbprovider-frontend-values.yaml` only when the user values file does not exist. Existing
installations must update their persisted user values explicitly. This setting does not block
Kafka creation through the database APIs, and the Data Import setting only hides the tab in the
database detail UI.

## project tree

```bash
.
├── Dockerfile
├── Makefile
├── README.md
├── deploy
│   └── manifests
│       └── frontend.yaml
├── next-env.d.ts
├── next.config.js
├── package.json
├── pnpm-lock.yaml
├── public
│   └── favicon.ico
├── src
│   ├── api # FE api
│   ├── components # global components
│   │   ├── DBStatusTag
│   │   ├── ButtonGroup
│   │   ├── FormControl
│   │   ├── Icon
│   │   │   ├── icons # svg icon
│   │   │   └── index.tsx
│   │   ├── PodLineChart
│   │   ├── RangeInput
│   │   ├── RangeSlider
│   │   ├── Slider
│   │   └── YamlCode
│   ├── constants # global constant data
│   │   ├── app.ts
│   │   ├── editApp.ts
│   │   └── theme.ts
│   ├── hooks # global hooks
│   │   ├── useConfirm.tsx
│   │   ├── useLoading.tsx
│   │   ├── useScreen.ts
│   ├── mock
│   ├── pages
│   │   ├── 404.tsx
│   │   ├── _app.tsx
│   │   ├── _document.tsx
│   │   ├── api # server api
│   │   ├── app
│   │   │   ├── detail
│   │   │   └── edit
│   │   └── apps
│   │       └── index.tsx
│   ├── services # server function
│   │   ├── backend
│   │   │   ├── auth.ts
│   │   │   ├── kubernetes.ts
│   │   │   └── response.ts
│   │   ├── error.ts
│   │   ├── kubernet.ts
│   │   └── request.ts
│   ├── store # FE store
│   │   ├── app.ts
│   │   ├── global.ts
│   │   └── static.ts
│   ├── styles
│   │   └── reset.scss
│   ├── types
│   │   ├── app.d.ts
│   │   ├── index.d.ts
│   │   └── user.d.ts
│   └── utils
│       ├── adapt.ts # format api data
│       ├── deployYaml2Json.ts # form data to yaml
│       ├── tools.ts
│       └── user.ts
└── tsconfig.json
```


## Runtime configuration (release-v5.1)

Application settings are loaded and validated at server startup from the ConfigMap
mounted at `/app/data/config.yaml`, using the same `cloud` / `database` layout as
main. The release schema retains its own feature flags and migration image; a main
configuration file is not a drop-in replacement. `.env` application settings are no
longer read. Node.js, Kubernetes service discovery, TLS and development mock-user
environment variables remain environment variables.

For local development, copy `data/config.example.yaml` to `data/config.local.yaml`
and edit its fields. The example lists the default chart configuration. For Helm,
set the corresponding `dbproviderConfig` key in
`/root/.sealos/cloud/values/apps/database/dbprovider-values.yaml`, or pass
`--set` (boolean/number) / `--set-string` (string). Existing Helm key names and
persisted user values are retained. The bundled user values still override Kafka
to disabled and set the cluster logging URL. The installer accepts the existing
camelCase inputs and legacy uppercase names shown below (except cloud domains/port
and custom scripts); these populate YAML,
not container environment variables. For custom scripts, use a YAML list in Helm
values. Helm extra arguments override installer inputs as before.

Before upgrading, migrate any manually added `.env`/Deployment application
variables into the corresponding Helm values. Deploy the new image and ConfigMap
together. Helm config changes trigger a rollout through the existing checksum;
manual ConfigMap edits require a Deployment restart because the file uses a
`subPath` mount. The legacy `deploy/manifests/deploy.yaml.tmpl` also mounts YAML;
when using that path, edit its configuration fields and restart explicitly.

| Previous env / installer alias | YAML field (purpose) | Helm key | Default |
| --- | --- | --- | --- |
| `SEALOS_DOMAIN` | `cloud.domain` | `dbproviderConfig.cloudDomain` | `"127.0.0.1.nip.io"` |
| `DESKTOP_DOMAIN` | `cloud.desktopDomain` | `dbproviderConfig.cloudDomain` | `"127.0.0.1.nip.io"` |
| `SEALOS_PORT` | `cloud.port` | `dbproviderConfig.cloudPort` | `""` |
| `DISABLE_HTTPS` | `cloud.disableHttps` | `dbproviderConfig.disableHttps` | `false` |
| `GUIDE_ENABLED` | `database.features.guide` | `dbproviderConfig.guideEnabled` | `true` |
| `SHOW_DOCUMENT` | `database.features.showDocument` | `dbproviderConfig.showDocument` | `true` |
| `DATA_IMPORT_ENABLED` | `database.features.fileImport` | `dbproviderConfig.dataImportEnabled` | `false` |
| `LOG_ENABLED` | `database.features.logs` | `dbproviderConfig.logEnabled` | `false` |
| `KAFKA_ENABLED` | `database.features.kafka` | `dbproviderConfig.kafkaEnabled` | `true` |
| `MANAGED_DB_ENABLED` | `database.features.managedDb` | `dbproviderConfig.managedDbEnabled` | `false` |
| `CUSTOM_SCRIPTS` | `database.ui.customScripts` | `dbproviderConfig.customScripts` | `[]` |
| `STORAGE_CLASSNAME` | `database.storage.forcedClassName` | `dbproviderConfig.forcedStorageClassName` | `""` |
| `STORAGE_MAX_SIZE` | `database.storage.maxSize` | `dbproviderConfig.storageMaxSize` | `300` |
| `METRICS_URL` | `database.components.monitoring.url` | `dbproviderConfig.metricsUrl` | `"http://vmselect-vm-stack-victoria-metrics-k8s-stack.vm.svc.cluster.local:8481/select/0/prometheus"` |
| `DATABASE_ALERT_URL` | `database.components.alerting.url` | `dbproviderConfig.alertingUrl` | `"http://database-alert.sealos.svc:8000"` |
| `BILLING_URL` | `database.components.billing.url` | `dbproviderConfig.billingUrl` | `"http://account-service.account-system.svc:2333"` |
| `VLOGS_BASE_URL` | `database.components.logging.url` | `dbproviderConfig.vlogsBaseUrl` | `""` |
| `MINIO_URL` | `database.components.storage.url` | `dbproviderConfig.minioUrl` | `""` |
| `MINIO_PORT` | `database.components.storage.port` | `dbproviderConfig.minioPort` | `443` |
| `MINIO_USE_SSL` | `database.components.storage.useSSL` | `dbproviderConfig.minioUseSSL` | `true` |
| `MINIO_BUCKET_NAME` | `database.components.storage.bucketName` | `dbproviderConfig.minioBucketName` | `"database-test"` |
| `MINIO_ACCESS_KEY` | `database.components.storage.accessKey` | `dbproviderConfig.minioAccessKey` | `""` |
| `MINIO_SECRET_KEY` | `database.components.storage.secretKey` | `dbproviderConfig.minioSecretKey` | `""` |
| `FASTGPT_KEY` | `database.components.eventAnalysis.fastGPTKey` | `dbproviderConfig.eventAnalysisFastGPTKey` | `""` |
| `MIGRATE_FILE_IMAGE` | `database.migration.importDataImage` | `dbproviderConfig.migrateFileImage` | `""` |
| `BACKUP_ENABLED` | `database.backup.enabled` | `dbproviderConfig.backupEnabled` | `true` |

`cloud.port` is the external port (empty uses the protocol default), and
`cloud.disableHttps` controls the CostCenter fallback protocol. `storage.maxSize`
is the UI storage limit in GiB; `forcedClassName` empty leaves PVC selection to the
existing release logic. `migration.importDataImage` is the existing release
`MIGRATE_FILE_IMAGE` (not main's separate fetch/import image pair). MinIO `useSSL`
is a real boolean: `false` enables HTTP. Keep storage credentials server-side;
public configuration endpoints only return their existing explicit field lists.
Invalid types or unknown YAML keys fail startup rather than silently using env.

Cloud domains and port continue to use `sealos-config` discovery and the existing
`cloudDomain` / `cloudPort` installer inputs. Both domains use `cloudDomain` in
Helm; standalone YAML can set `desktopDomain` separately.

Offline validation:

```sh
node --test tests/test_release_config.cjs  # from repository root
```
