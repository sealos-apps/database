# database

The repository root is the single Database source workspace and image build
context. The application in `database/` supports KubeBlocks 0.8 and 0.9,
selected at runtime by mounted configuration. The 0.8 deployment profile lives
in `deploy/kubeblocks-0.8/`; the 0.9 profile lives in `database/deploy/`.
Historical publishing channel names are retained for installation compatibility
and do not correspond to source directories.

## KubeBlocks compatibility

```yaml
# /app/data/config.yaml (production), database/data/config.local.yaml (development)
database:
  kubeblocks:
    version: "0.9" # "0.8" for a KubeBlocks 0.8 cluster
```

- Helm value: `dbproviderConfig.kubeblocksVersion`, quoted `"0.8"` or `"0.9"`.
  The main deployment profile defaults to 0.9 and release-v5.1 defaults to 0.8.
- Installer override: `KUBEBLOCKS_VERSION=0.8 bash install.sh`, or export it
  before invoking Sealos. See [deploy/env.template](deploy/env.template).
  An empty/unset value preserves persisted Helm values and profile defaults.
  Explicit `HELM_OPTIONS`/`HELM_OPTS` arguments take precedence over this input.
- Direct Helm override: `--set-string dbproviderConfig.kubeblocksVersion=0.8`.
  Helm renders the setting into the mounted ConfigMap; the application does not
  read `KUBEBLOCKS_VERSION` from its process environment. There is no build-time
  version flag, so the same built runtime image can run either mode.
- Restart the application after changing configuration. Use the version that
  matches the installed operator. Changing this setting does not upgrade
  KubeBlocks, migrate existing instances, or convert their resources.

Old manually mounted main YAML defaults to 0.9. Old release YAML without the
new setting is recognized by its existing `cloud.port`, `cloud.disableHttps`
and `database.features.logs/kafka/managedDb` fields and retains 0.8. This is
configuration-format compatibility, not operator detection. Add an explicit
version to custom configurations; unsupported versions fail startup validation.

Routes select one complete version implementation, including SSR and client
navigation, so old resource operations are not mixed with new UI models.
Missing operations return 404 rather than falling through to the other version.
The 0.8 implementation retains PolarDB-X, ClusterVersion discovery, legacy
parameter history, backup behavior, and Sealox MySQL compatibility. The 0.9
implementation retains ComponentVersion discovery and newer resource templates.
Shared modules live under `database/src`; version-specific modules live
under `src/implementations/kb08` and `kb09`. Version-specific UI and API contracts
are deliberately retained in this first consolidation; they are not yet one
normalized API/model. Database resource and data migrations are outside this change.

Only one dependency tree (Node 20.20.2, pnpm 8.9.0, Next 14) is installed:

```sh
pnpm install --frozen-lockfile
# Pick one example; both run from the same application directory.
cp database/data/config.kb08.example.yaml database/data/config.local.yaml
pnpm dev-db
```

Both deployment profiles retain their existing release, namespace, resource
identity and persisted values paths. Reuse the deployment profile originally
used to install the service. An explicit runtime version override does not
change those installation paths or migrate saved values.

## CI and publishing

| Trigger | Validation | Image publication | OSS upload |
| --- | --- | --- | --- |
| Pull request to `main` | Both deployment profiles and unified runtime | No | No |
| Push to `main` | Unified runtime and both profiles | Yes | Yes |
| Push a `v*` tag | Unified runtime and both profiles | Yes | Yes |
| Manual run | Unified runtime and both profiles | `publish_images` or `upload_oss` | `upload_oss` |

DataFlow is imported once under `dataflow/` (provenance in
[dataflow/IMPORT.md](dataflow/IMPORT.md)). Both source channels build the same
DataFlow source alongside their respective Database frontend. Their cluster
images install both services using [deploy/install.sh](deploy/install.sh).

Every runtime image and cluster image supports `linux/amd64` and `linux/arm64`.
All Database runtime builds use `Dockerfile` with `name=database` and
`path=database`. Cluster images include the Helm chart, entrypoint
and the runtime image saved by Sealos for the selected architecture.

Images are published to:

- `ghcr.io/sealos-apps/database/database-frontend:<tag>`
- `ghcr.io/sealos-apps/database/dataflow:<tag>`
- `ghcr.io/sealos-apps/database/database-cluster:<tag>`

Tags are `<source>-<sha7>` for branch/manual builds and
`<source>-<git-tag>` for releases. Branch build examples are `main-f90323a`
and `release-v5.1-f90323a`; release examples are `main-v1.0.0` and
`release-v5.1-v1.0.0`. Successful builds on the `main` branch also update the
separate `main` and `release-v5.1` image channel tags. There is no shared `latest`
tag. Rebuilding the same commit updates the same versioned tag. Cluster images
additionally have `-amd64` and `-arm64` tags.

## Repository configuration

GHCR uses `GITHUB_TOKEN` with `packages: write`. Allow Actions to create/write
these packages (or grant repository access if the packages already exist).

OSS follows the `sealos-apps/template` configuration:

| Setting | Type |
| --- | --- |
| `OSS_ENDPOINT` | Actions secret |
| `OSS_ACCESS_KEY_ID` | Actions secret |
| `OSS_ACCESS_KEY_SECRET` | Actions secret |
| `OSS_BUCKET` | Actions variable (`sealos-io/offline/sealos-apps/database`) |

Each source produces two `.tar.gz` cluster image archives and matching `.sha256` and `.md5`
files. Checksums are verified before upload and contain portable basenames.
Archives are also retained as GitHub Actions artifacts for seven days.

For `v*` tag pushes, after both source builds and OSS uploads succeed, CI also
attaches all four archives and their SHA-256/MD5 files to the GitHub Release.
If the release does not exist, CI creates it with generated notes; tags containing
a hyphen (such as `v5.2.0-beta1`) are marked as prereleases. Reruns replace assets
with the same names. This job requires `contents: write` for `GITHUB_TOKEN`.

- Release destination: `oss://<OSS_BUCKET>/release/<git-tag>/<source>/`
- Branch/manual destination: `oss://<OSS_BUCKET>/ci/<source>/<sha7>/`

To publish without creating a tag, run **database-ci** in Actions with
`publish_images` enabled; enable `upload_oss` to upload archives as well (this
also enables image publication). A default manual run only validates builds.
PRs do not use publishing credentials. CI does not deploy to a cluster or modify
databases. Cluster packaging and OSS upload are only exercised on publishing
runs; a passing PR build alone does not verify those integrations.

## Deployment compatibility

The unified source workspace uses `database/` and the `database` package name. Runtime
and cluster image names use `database`. Deployment identity
remains `dbprovider-frontend`: Helm release, namespace, resource names and selectors.
The chart directory remains `charts/database-frontend`.

The Desktop application key remains `system-dbprovider`, the App resource is
`dbprovider`, and the default hostname is `dbprovider.<cloud-domain>`. Helm values
use `dbproviderConfig`; the main runtime configuration section is `database`.
User values are persisted at:

- main: `/root/.sealos/cloud/values/core/dbprovider-frontend-values.yaml`
- release-v5.1: `/root/.sealos/cloud/values/apps/database/dbprovider-values.yaml`

Existing user values are retained. The installer refuses to adopt resources owned
by a different Helm release. No namespace or database-data migration is performed.

## Currency display upgrade

Both KubeBlocks implementations read the display symbol from Sealos Desktop
HostConfig after SDK initialization. The application and shared UI use the same
published `@labring/sealos-desktop-sdk@0.1.24` directly.
UI components and theme come from `@labring/sealos-chakra-ui@1.0.0`; there are no local UI packages. Shared (`1.0.3`), driver (`1.0.0`), GTM (`1.1.0`),
and Desktop SDKs come from npm. Each application owns its host-config store; main
also owns the quota-dialog adapter that reuses this store. HostConfig is requested once per page
lifetime and kept only in memory. Price
estimates and database details use this shared symbol; pricing, billing units,
conversions and backend billing are unchanged.

Upgrade Desktop first in environments using `cny` or `usd`, and configure
`desktop.layout.currencySymbol` there. An older Desktop that omits the field, or a
failed request (including standalone use), falls back to `shellCoin`. Reload the
Database page after changing Desktop settings; host configuration is not persisted.

For manually mounted main `config.yaml`, remove `database.ui.currencySymbol`
**before starting the upgraded Database**, retaining other `database.ui` fields
such as `customScripts`. The strict configuration schema rejects the obsolete key.
Chart-generated ConfigMaps already omit it. Remove `dbproviderConfig.currencySymbol`
from custom values and stop passing the installer variable `currencySymbol` or
`CURRENCY_SYMBOL` environment variable. Existing persisted Helm values may retain
the old key harmlessly; it is ignored and no longer injected. The legacy `getEnv`
response no longer returns `CurrencySymbol`.

No release, namespace, selector, hostname or `dbproviderConfig` contract is renamed.

Local regression checks (install the root workspace with pnpm 8.9.0 first):

```sh
node --test tests/test_host_config.cjs
python3 tests/test_deployment_compatibility.py
pnpm --dir database typecheck
pnpm --dir database test:ci
node --test tests/test_*.cjs
```

Run `helm lint` and `helm template` for both `database/deploy/charts/database-frontend`
and `deploy/kubeblocks-0.8/charts/database-frontend` as well. These checks do not replace
an embedded Desktop integration test.

## Sealox compatibility on release-v5.1

The release workspace exposes public `GET /api/platform/getClientAppConfig`
with `{ code: 200, data: { domain: string, storageMaxSize: number } }`, using the existing
`database.storage.maxSize` ConfigMap setting (default 300 GiB). This is the subset
needed by Sealox's database creation form, not the full main configuration API.
The legacy `/api/getEnv` remains available.

`POST /api/v2alpha/databases` also accepts `type: "mysql"`. The creation service
maps it to release's internal `apecloud-mysql` type so existing account,
parameter, and automatic backup handling is reused. The requested version still
selects the release template (including native `mysql-5.7.42`). When `mysql`
omits a version, discovery selects a MySQL ClusterVersion, not an ApeCloud
version. Existing `apecloud-mysql` requests retain their version selection.
Use versions advertised by the target release deployment; this does not add
new KubeBlocks engines, ComponentVersion support, or change existing detail
response types and resource accounting.

Regression check (Kubernetes writes are mocked):

```sh
node --test tests/test_sealox_compatibility.cjs
```

## Direct metrics SDK

Both KubeBlocks implementations use `@labring/sealos-metrics-sdk@0.2.0` in server-side
monitoring routes. Database templates use `database.query`; existing custom
PromQL uses `raw.query`. API authentication and chart conversions remain in the
application. The SDK additionally checks Kubernetes readiness and permission to
get Pods in the requested namespace. Clients are created per request and are
never shared across users. The frontend no longer calls `database-monitor`.

The metrics endpoint must expose Prometheus `/api/v1/query` and
`/api/v1/query_range`, for example the default VictoriaMetrics endpoint:
`http://vmselect-vm-stack-victoria-metrics-k8s-stack.vm.svc.cluster.local:8481/select/0/prometheus`.

- Main: application settings come from the ConfigMap mounted at
  `/app/data/config.yaml`. Set `dbproviderConfig.metricsUrl` in persisted Helm
  user values or pass `--set-string dbproviderConfig.metricsUrl=<endpoint>`;
  the chart writes `database.components.monitoring.url`. The install script
  also accepts `metricsUrl=<endpoint>`. The default is the endpoint above.
  For local development, copy `database/data/config.example.yaml` to
  `database/data/config.local.yaml` and edit the same setting.
  Restart the application after changing the mounted configuration.
- Release-v5.1: the chart mounts `/app/data/config.yaml` and writes
  `database.components.monitoring.url` from `dbproviderConfig.metricsUrl`.
  The install script accepts `metricsUrl=<endpoint>` or `METRICS_URL=<endpoint>`,
  with `metricsUrl` taking precedence. For local development, copy
  `database/data/config.kb08.example.yaml` to `database/data/config.local.yaml` and edit the same YAML field. Application environment
  variables are no longer read. See [the 0.8 deployment profile README](deploy/kubeblocks-0.8/README.md) for the
  complete migration table; deploy the new image and ConfigMap together.

On upgrade, replace custom `dbproviderConfig.monitorUrl` with `metricsUrl` and
point it at the metrics backend, not the old monitor proxy. `MONITOR_URL`, the
installer variable `monitorUrl`, and the Helm value `monitorUrl` are no longer
used. Existing persisted values are retained, so add `metricsUrl` explicitly if
your cluster uses a non-default endpoint. For a manually mounted main
`config.yaml`, change `database.components.monitoring.url` to the direct metrics
endpoint. Keep the old service available for any other consumers until they
have migrated.

In a Pod, Kubernetes service discovery supplies the API server address used by
the SDK. For local development, the SDK's `WHITELIST_KUBERNETES_HOSTS` environment
variable can allow the exact API server URL from your kubeconfig; without an
allowlist the SDK uses `KUBERNETES_SERVICE_HOST` / `KUBERNETES_SERVICE_PORT`.
Do not allow arbitrary user-supplied API servers in a hosted deployment.

Offline integration checks use fictional local HTTP fixtures and never contact
a cluster or write database data:

```sh
node --test tests/test_metrics_sdk.cjs
python3 tests/test_deployment_compatibility.py
```

## Combined Database + DataFlow installation

The cluster package stages the selected Database chart and the shared DataFlow
chart under its root `charts/` directory so Sealos can discover both runtime
images. The installer subdirectories link to this shared chart directory. Runtime references are pinned to the same source/version tag. Install
keeps two independent Helm releases and Deployments:

| Component | Default release | Default namespace | Persisted user values |
| --- | --- | --- | --- |
| Database | `dbprovider-frontend` | `dbprovider-frontend` | main: `/root/.sealos/cloud/values/core/dbprovider-frontend-values.yaml`; release-v5.1: `/root/.sealos/cloud/values/apps/database/dbprovider-values.yaml` |
| DataFlow | `dataflow` | `dataflow-system` | `/root/.sealos/cloud/values/apps/dataflow/dataflow-values.yaml` |

Database retains its existing `RELEASE_NAME`, `RELEASE_NAMESPACE`, `HELM_OPTS`
and `HELM_OPTIONS` controls. DataFlow uses `DATAFLOW_RELEASE_NAME`,
`DATAFLOW_NAMESPACE`, `DATAFLOW_HELM_OPTS` and optionally
`DATAFLOW_USER_VALUES_DIR`. Both use the Sealos cloud configuration; a
`SEALOS_CLOUD_DOMAIN` override applies to both. DataFlow installs first. A
failure stops installation before Database is upgraded. The two Helm upgrades
are not a transaction: if Database fails afterward, DataFlow remains upgraded.

See [deploy/env.template](deploy/env.template) for defaults, purposes and the
shell environment override method; the installer does not load it automatically.

DataFlow keeps the hidden `app-system/dataflow` Desktop App and internal
`dataflow.sealos.io/health-url` annotation. Existing Database “Manage data”
buttons continue opening `system-dataflow` with resource name, database type,
language and theme. No React dependency merge or new cross-service API is needed.

### Upgrading an existing installation

Use the existing DataFlow release and namespace, and preserve the user values
file. If that file is absent but the release exists, the installer recovers
its effective Helm values before upgrading. This preserves external metadata
DSNs, custom resource names, storage settings and custom runtime Secrets.
The installer resolves the configured runtime Secret from the chart and reuses
its session encryption key; it stops if an existing release's key or values
cannot be read. Fresh installations generate a key once. Recovered files use
restricted permissions because Helm values may contain credentials.

The combined package supplies versioned image pins even when saved values
contain older image references. `DATAFLOW_HELM_OPTS` remains an explicit override
for DataFlow; Database always uses the bundled runtime image. Existing custom
DataFlow App names must match Database's `app-system/dataflow` discovery contract.

Keep the DataFlow release, PostgreSQL resource/PVC and Secret in place. Do not
uninstall the old DataFlow release: it is now upgraded by the combined package,
not replaced by a new release. Existing charts can delete their metadata cluster
on uninstall. No SQL/data-copy migration is performed by this source migration.
Rolling back requires rolling back the two Helm releases separately, with the
same storage and encryption key; application schema compatibility must be checked
before downgrading DataFlow.

### Local validation

```bash
python3 scripts/test-bundle.py
bash scripts/prepare-bundle.sh main /tmp/database-bundle \
  ghcr.io/sealos-apps/database/database-frontend \
  ghcr.io/sealos-apps/database/dataflow main-<sha7>
```

The output directory must not exist. The tests use fake Helm/kubectl for upgrade
checks and real Helm rendering for both source packages; they never access a
cluster or write to a database. CI runs these checks and builds both runtime
architectures. Actual installation may initialize/upgrade DataFlow metadata;
local source/build checks do not prove live storage, authentication or browser
acceptance. Live deployment requires a chosen cluster and a separately authorized
metadata modification if initialization or schema migration is needed.

## Published UI package

The application imports `@labring/sealos-chakra-ui@1.0.0` directly. Its 86 source
files match the former local UI implementation. Next.js transpiles this source
package via `transpilePackages`. Root `postinstall` generates Chakra theme types
from the installed package, so local development and container builds use the
same theme without retaining a local component library.
