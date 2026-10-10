# database

The `main/` and `release-v5.1/` directories contain independent Database
workspaces. Both are built by `.github/workflows/ci.yml`; these names refer to
source directories, not the branch that triggers CI.

## CI and publishing

| Trigger | Validation | Image publication | OSS upload |
| --- | --- | --- | --- |
| Pull request to `main` | Both workspaces, Helm and runtime builds | No | No |
| Push to `main` | Both workspaces | Yes | No |
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
| `OSS_BUCKET` | Actions variable |

Each source produces two `.tar.gz` cluster image archives and matching `.sha256`
files. Checksums are verified before upload and contain portable basenames.
Archives are also retained as GitHub Actions artifacts for seven days.

- Release destination: `oss://<bucket>/release/<git-tag>/<source>/`
- Manual destination: `oss://<bucket>/ci/<source>/<sha7>/`

To publish without creating a tag, run **database-ci** in Actions with
`publish_images` enabled; enable `upload_oss` to upload archives as well (this
also enables image publication). A default manual run only validates builds.
PRs do not use publishing credentials. CI does not deploy to a cluster or modify
databases. Cluster packaging and OSS upload are only exercised on publishing
runs; a passing PR build alone does not verify those integrations.

## Naming migration

Both source workspaces use `database/` and the `database` package name. Helm
charts, releases, namespaces and frontend resources use `database-frontend`;
the Desktop application key is `system-database`, and the application resource
is `database`. The default application hostname is `database.<cloud-domain>`.
Existing installations must coordinate these names with Desktop integrations,
DNS, saved configuration and existing `sealos-database-cr` resource labels before upgrading. The main configuration section
and Helm values key are `database` and `databaseConfig`, respectively. This
source change does not rename existing cluster resources or migrate data.
