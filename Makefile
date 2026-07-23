.DEFAULT_GOAL := dev

AGENT_GUI_DIR := crates/agent-gui
AGENT_GATEWAY_DIR := crates/agent-gateway
AGENT_GATEWAY_WEB_DIR := $(AGENT_GATEWAY_DIR)/web

DESKTOP_WINDOWS_TARGET ?= x86_64-pc-windows-msvc
DESKTOP_WINDOWS_TAURI_CONFIG ?= src-tauri/tauri.windows.conf.json
DESKTOP_VERSION ?=
DESKTOP_VERSION_CONFIG ?= src-tauri/tauri.version.generated.conf.json
DESKTOP_VERSION_CONFIG_PATH := $(AGENT_GUI_DIR)/$(DESKTOP_VERSION_CONFIG)

DEV_GATEWAY_TOKEN ?= dev-token
DEV_GATEWAY_HTTP_ADDR ?= :50052
DEV_WEBUI_PROXY_API ?= http://localhost:50052
GATEWAY_DOCKER_IMAGE ?= arcforge-gateway:local

.PHONY: all dev build desktop-build-windows help
.PHONY: dev-gateway dev-webui
.PHONY: proto proto-check webui gateway-build gateway-docker-build gateway-docker-run gateway-docker-smoke
.PHONY: build-linux build-linux-amd build-linux-arm build-windows gateway-build-windows
.PHONY: clean check-rust-target-%

all: desktop-build-windows gateway-build

## Windows desktop app
dev:
	pnpm --dir $(AGENT_GUI_DIR) tauri dev

build: desktop-build-windows

desktop-build-windows: check-rust-target-$(DESKTOP_WINDOWS_TARGET)
ifeq ($(strip $(DESKTOP_VERSION)),)
	pnpm --dir $(AGENT_GUI_DIR) tauri build --config $(DESKTOP_WINDOWS_TAURI_CONFIG) --target $(DESKTOP_WINDOWS_TARGET)
else
	node scripts/release/prepare-app-version-from-tag.mjs "v$(DESKTOP_VERSION)" --tauri-config $(DESKTOP_VERSION_CONFIG_PATH)
	ARCFORGE_APP_VERSION="$(DESKTOP_VERSION)" pnpm --dir $(AGENT_GUI_DIR) tauri build --config $(DESKTOP_WINDOWS_TAURI_CONFIG) --config $(DESKTOP_VERSION_CONFIG) --target $(DESKTOP_WINDOWS_TARGET)
endif

## Gateway development
dev-gateway:
	go -C $(AGENT_GATEWAY_DIR) run ./cmd/gateway --token=$(DEV_GATEWAY_TOKEN) --http-addr=$(DEV_GATEWAY_HTTP_ADDR)

dev-webui:
	npm_config_proxy_api=$(DEV_WEBUI_PROXY_API) pnpm --dir $(AGENT_GATEWAY_WEB_DIR) dev

## Gateway build and generated assets
proto:
	@command -v buf >/dev/null || (echo "buf is required. Run: mise install" && exit 1)
	cd $(AGENT_GATEWAY_DIR) && buf generate

BUF_BREAKING_AGAINST ?= ../../.git#subdir=$(AGENT_GATEWAY_DIR)

proto-check:
	@command -v buf >/dev/null || (echo "buf is required. Run: mise install" && exit 1)
	cd $(AGENT_GATEWAY_DIR) && buf lint
	cd $(AGENT_GATEWAY_DIR) && buf breaking --against '$(BUF_BREAKING_AGAINST)'

webui:
	pnpm --dir $(AGENT_GATEWAY_WEB_DIR) install --offline
	pnpm --dir $(AGENT_GATEWAY_WEB_DIR) build

gateway-build: proto webui
	CGO_ENABLED=0 go -C $(AGENT_GATEWAY_DIR) build -o bin/arcforge-gateway ./cmd/gateway

gateway-docker-build:
	docker build -t $(GATEWAY_DOCKER_IMAGE) .

gateway-docker-run:
	docker run --rm -p 8080:8080 -e ARCFORGE_GATEWAY_TOKEN=$(DEV_GATEWAY_TOKEN) $(GATEWAY_DOCKER_IMAGE)

gateway-docker-smoke: gateway-docker-build
	@set -e; \
	name="arcforge-gateway-smoke"; \
	docker rm -f "$$name" >/dev/null 2>&1 || true; \
	docker run -d --name "$$name" -p 18080:8080 -e ARCFORGE_GATEWAY_TOKEN=$(DEV_GATEWAY_TOKEN) $(GATEWAY_DOCKER_IMAGE) >/dev/null; \
	trap 'docker rm -f "$$name" >/dev/null 2>&1 || true' EXIT; \
	for _ in $$(seq 1 30); do \
		if curl -fsS http://127.0.0.1:18080/healthz | grep -q '"ok":true'; then \
			echo "Gateway Docker smoke test passed: http://127.0.0.1:18080/healthz"; \
			exit 0; \
		fi; \
		sleep 1; \
	done; \
	echo "Gateway Docker smoke test failed; container logs:"; \
	docker logs "$$name" || true; \
	exit 1

# Gateway server binaries; these are not desktop application targets.
build-linux: proto webui
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go -C $(AGENT_GATEWAY_DIR) build -o bin/arcforge-gateway-linux-amd64 ./cmd/gateway

build-linux-amd: build-linux

build-linux-arm: proto webui
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go -C $(AGENT_GATEWAY_DIR) build -o bin/arcforge-gateway-linux-arm64 ./cmd/gateway

build-windows: proto webui
	CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go -C $(AGENT_GATEWAY_DIR) build -o bin/arcforge-gateway-windows-amd64.exe ./cmd/gateway

gateway-build-windows: build-windows

clean:
	rm -rf $(AGENT_GATEWAY_DIR)/bin/ $(AGENT_GATEWAY_WEB_DIR)/dist/

check-rust-target-%:
	@rustup target list --installed | grep -qx "$*" || (echo "Rust target $* is not installed. Run: rustup target add $*" && exit 1)

help:
	@printf "\n%s\n" "Windows desktop"
	@printf "  %-48s %s\n" "make / make dev" "Start the Tauri development environment"
	@printf "  %-48s %s\n" "make build" "Build the Windows desktop application"
	@printf "  %-48s %s\n" "make desktop-build-windows" "Build Windows bundles using package.json version"
	@printf "  %-48s %s\n" "make desktop-build-windows DESKTOP_VERSION=X.Y.Z" "Build Windows bundles with an explicit local version"
	@printf "\n%s\n" "Gateway development"
	@printf "  %-48s %s\n" "make dev-gateway" "Start the agent-gateway Go service"
	@printf "  %-48s %s\n" "make dev-webui" "Start the agent-gateway WebUI development service"
	@printf "\n%s\n" "Gateway build"
	@printf "  %-48s %s\n" "make proto" "Regenerate agent-gateway protobuf code"
	@printf "  %-48s %s\n" "make webui" "Build the agent-gateway WebUI"
	@printf "  %-48s %s\n" "make gateway-build" "Build the local agent-gateway binary"
	@printf "  %-48s %s\n" "make gateway-docker-build" "Build the local agent-gateway Docker image"
	@printf "  %-48s %s\n" "make gateway-docker-run" "Run the local agent-gateway Docker image"
	@printf "  %-48s %s\n" "make gateway-docker-smoke" "Build and health-check the Gateway image"
	@printf "  %-48s %s\n" "make build-linux" "Build the Gateway Linux amd64 binary"
	@printf "  %-48s %s\n" "make build-linux-arm" "Build the Gateway Linux arm64 binary"
	@printf "  %-48s %s\n" "make build-windows" "Build the Gateway Windows amd64 binary"
	@printf "\n%s\n" "Maintenance"
	@printf "  %-48s %s\n" "make all" "Build the Windows desktop app and local Gateway"
	@printf "  %-48s %s\n" "make clean" "Clean Gateway build artifacts"
	@printf "  %-48s %s\n" "make help" "Show available commands"
