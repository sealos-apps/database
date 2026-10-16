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
published `@labring/sealos-desktop-sdk@0.1.24` via the `sealos-desktop-sdk` npm alias.
The duplicated local `packages/client-sdk` workspaces have been removed; SDK
updates now come from the published package. HostConfig is requested once per page
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
