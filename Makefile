DOCKER_USERNAME ?=
IMAGE_TAG ?= dev
PLATFORMS ?= linux/amd64,linux/arm64
IMAGE := $(if $(DOCKER_USERNAME),$(DOCKER_USERNAME)/)sealos-database:$(IMAGE_TAG)

.PHONY: all push-images fetch-deps build-database dev-database image-build-database image-push-database
all: image-build-database
push-images: image-push-database
fetch-deps:
	pnpm fetch
build-database: fetch-deps
	pnpm --offline --frozen-lockfile install
	pnpm --filter ./database run build
dev-database: fetch-deps
	pnpm --offline --frozen-lockfile install
	pnpm --filter ./database run dev
image-build-database:
	docker buildx build --platform=$(PLATFORMS) -t $(IMAGE) --build-arg path=database --build-arg name=database .
image-push-database:
	docker buildx build --platform=$(PLATFORMS) --push -t $(IMAGE) --build-arg path=database --build-arg name=database .
