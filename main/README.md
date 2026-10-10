# Database workspace

This source workspace contains the Database application in `database/` and its
shared dependencies in `packages/`. Run commands from this directory.

## Development

Use the Node and pnpm versions declared in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm dev-db
pnpm build-database
```

Local configuration uses `database/data/config.yaml`; copy
`database/data/config.example.yaml` and fill in your environment's values.
The application configuration key is `database`.

## Images and deployment packaging

```sh
make image-build-database
make image-push-database DOCKER_USERNAME=your-registry IMAGE_TAG=your-tag
bash -n database/deploy/database-frontend-entrypoint.sh
helm lint database/deploy/charts/database-frontend
helm template database-frontend database/deploy/charts/database-frontend \
  --namespace database-frontend >/dev/null
```

Images target `linux/amd64` and `linux/arm64`. CI and publication details are in
[the repository README](../README.md).
