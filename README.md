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
