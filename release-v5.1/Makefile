DOCKER_USERNAME ?=
IMAGE_TAG ?= dev
PLATFORMS ?= linux/amd64,linux/arm64
IMAGE := $(if $(DOCKER_USERNAME),$(DOCKER_USERNAME)/)sealos-dbprovider:$(IMAGE_TAG)

.PHONY: all push-images fetch-deps build-packages build-dbprovider dev-dbprovider image-build-dbprovider image-push-dbprovider
all: image-build-dbprovider
push-images: image-push-dbprovider
fetch-deps:
	pnpm fetch
build-packages: fetch-deps
	pnpm -r --offline --filter='./packages/*' install
	pnpm -r --filter='./packages/*' run build
build-dbprovider: build-packages
	pnpm --offline --filter ./dbprovider install
	pnpm --filter ./dbprovider run build
dev-dbprovider: build-packages
	pnpm --offline --filter ./dbprovider install
	pnpm --filter ./dbprovider run dev
image-build-dbprovider:
	docker buildx build --platform=$(PLATFORMS) -t $(IMAGE) --build-arg path=dbprovider --build-arg name=dbprovider .
image-push-dbprovider:
	docker buildx build --platform=$(PLATFORMS) --push -t $(IMAGE) --build-arg path=dbprovider --build-arg name=dbprovider .
