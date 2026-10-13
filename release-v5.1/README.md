# Database workspace

This source workspace contains the Database application in `dbprovider/` and its
shared dependencies in `packages/`. Run commands from this directory.

## Development

Use the Node and pnpm versions declared in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm dev-db
pnpm build-dbprovider
```


## Images and deployment packaging

```sh
make image-build-dbprovider
make image-push-dbprovider DOCKER_USERNAME=your-registry IMAGE_TAG=your-tag
bash -n dbprovider/deploy/dbprovider-frontend-entrypoint.sh
helm lint dbprovider/deploy/charts/dbprovider-frontend
helm template dbprovider-frontend dbprovider/deploy/charts/dbprovider-frontend \
  --namespace dbprovider-frontend >/dev/null
```

Images target `linux/amd64` and `linux/arm64`. CI and publication details are in
[the repository README](../README.md).
