# database

The `main/` and `release-v5.1/` directories contain independent Database
workspaces. Both are built by `.github/workflows/ci.yml`; these names refer to
source directories, not the branch that triggers CI.

## CI and publishing

| Trigger | Validation | Image publication | OSS upload |
| --- | --- | --- | --- |
| Pull request to `main` | Both workspaces, Helm and runtime builds | No | No |
| Push to `main` | Both workspaces | Yes | Yes |
| Push a `v*` tag | Both workspaces | Yes | Yes |
| Manual run | Both workspaces | `publish_images` or `upload_oss` | `upload_oss` |

Every runtime image and cluster image supports `linux/amd64` and `linux/arm64`.
Runtime builds use each workspace's root Dockerfile with `name=database` and
`path=database`. Cluster images include the Helm chart, entrypoint
and the runtime image saved by Sealos for the selected architecture.

Images are published to:

- `ghcr.io/sealos-apps/database/database-frontend:<tag>`
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

- Release destination: `oss://<OSS_BUCKET>/release/<git-tag>/<source>/`
- Branch/manual destination: `oss://<OSS_BUCKET>/ci/<source>/<sha7>/`

To publish without creating a tag, run **database-ci** in Actions with
`publish_images` enabled; enable `upload_oss` to upload archives as well (this
also enables image publication). A default manual run only validates builds.
PRs do not use publishing credentials. CI does not deploy to a cluster or modify
databases. Cluster packaging and OSS upload are only exercised on publishing
runs; a passing PR build alone does not verify those integrations.

## Deployment compatibility

Both source workspaces use `database/` and the `database` package name. Runtime
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

Both `main/` and `release-v5.1/` now read the display symbol from Sealos Desktop
HostConfig after SDK initialization. The application and shared UI use the same
published `@labring/sealos-desktop-sdk@0.1.24` directly.
Only `packages/ui` remains local. Shared (`1.0.3`), driver (`1.0.0`), GTM (`1.1.0`),
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

Local regression checks (install both workspaces with pnpm 8.9.0 first):

```sh
node --test tests/test_host_config.cjs
python3 tests/test_deployment_compatibility.py
pnpm --dir main/database typecheck
pnpm --dir release-v5.1/database typecheck
```

Run `helm lint` and `helm template` for each workspace's
`database/deploy/charts/database-frontend` chart as well. These checks do not replace
an embedded Desktop integration test.

## Sealox compatibility on release-v5.1

The release workspace exposes public `GET /api/platform/getClientAppConfig`
with `{ code: 200, data: { storageMaxSize: number } }`, using the existing
`STORAGE_MAX_SIZE` environment variable (default 300 GiB). This is the subset
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

Both source workspaces use `@labring/sealos-metrics-sdk@0.2.0` in server-side
monitoring routes. Database templates use `database.query`; existing custom
PromQL uses `raw.query`. API authentication and chart conversions remain in the
application. The SDK additionally checks Kubernetes readiness and permission to
get Pods in the requested namespace. Clients are created per request and are
never shared across users. The frontend no longer calls `database-monitor`.

The metrics endpoint must expose Prometheus `/api/v1/query` and
`/api/v1/query_range`, for example the default VictoriaMetrics endpoint:
`http://vmselect-vm-stack-victoria-metrics-k8s-stack.vm.svc.cluster.local:8481/select/0/prometheus`.

- Helm: set `dbproviderConfig.metricsUrl` in persisted user values or pass
  `--set-string dbproviderConfig.metricsUrl=<endpoint>` to Helm. Both charts
  inject `METRICS_URL`; main also writes `database.components.monitoring.url`
  in its mounted `config.yaml`.
- Install script: supply `metricsUrl=<endpoint>` or `METRICS_URL=<endpoint>`;
  `metricsUrl` takes precedence. The default is the endpoint above.
- Local runtime: configure `METRICS_URL` in `database/.env.local` (see
  `database/.env.template`). Main falls back to
  `database.components.monitoring.url` in `data/config.yaml`; release-v5.1 falls
  back to the SDK's default endpoint above.

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
