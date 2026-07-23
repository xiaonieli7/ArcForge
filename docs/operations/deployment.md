# CI、Windows 手动构建与 Gateway 部署

本仓库只使用 GitHub Actions 做持续集成检查，不自动发布桌面安装包或 Gateway 镜像。ArcForge 桌面端当前只支持 Windows x64，由维护者在 Windows 本机手动构建；Gateway 仍可通过 Docker 或 Go 交叉编译部署到 Linux。

## 持续集成

唯一保留的 workflow 是 `.github/workflows/ci.yml`。PR 与主分支 push 会运行 Gateway、WebUI、GUI、Tauri Rust、Proto 一致性和本地 Docker smoke 检查，但不会创建版本、上传安装包或推送容器镜像。

建议提交前执行与改动范围对应的检查：

```bash
pnpm --dir crates/agent-gui test:frontend
pnpm --dir crates/agent-gui test:release
cargo check --manifest-path crates/agent-gui/src-tauri/Cargo.toml --tests
go -C crates/agent-gateway test ./...
```

## Windows 桌面端手动构建

### 环境要求

- Windows 10/11 x64
- Visual Studio Build Tools（MSVC 与 Windows SDK）
- WebView2 Runtime
- Rust stable 与 `x86_64-pc-windows-msvc` target
- Node.js 22 与 pnpm

首次准备：

```powershell
pnpm --dir crates/agent-gui install --frozen-lockfile
rustup target add x86_64-pc-windows-msvc
```

直接调用 Tauri：

```powershell
pnpm --dir crates/agent-gui tauri build --config src-tauri/tauri.windows.conf.json --target x86_64-pc-windows-msvc
```

如果 Windows 环境中已安装 GNU Make（例如通过 Git Bash），可使用：

```bash
make desktop-build-windows
```

默认版本来自 `crates/agent-gui/package.json`。需要只为本次本机构建指定版本时，可运行：

```bash
make desktop-build-windows DESKTOP_VERSION=0.1.0
```

该命令使用 `scripts/release/prepare-app-version-from-tag.mjs` 生成未提交的 Tauri version overlay，并通过 `LIVEAGENT_APP_VERSION` 让前端、Rust 运行时和安装包使用同一个版本。它只准备本地构建，不创建 tag 或远程版本。

Tauri 构建结果位于 Cargo 的 `target/.../release/bundle/` 目录。仓库不会自动上传这些文件；如需对外分发，请在自己的 Windows 环境中接入代码签名、制品存储与审核流程。

## Gateway 本地 Docker 镜像

根目录 `Dockerfile` 是 Gateway 的生产镜像：

| 阶段 | 内容 |
|---|---|
| `webui` | 用 Node 22 和 pnpm 构建 `crates/agent-gateway/web/dist`。 |
| `gateway-builder` | 用 Go 编译 `cmd/gateway`，WebUI 静态资源通过 `go:embed` 打进二进制。 |
| `runtime` | Debian slim + CA certificates，使用非 root 用户运行。 |

本地构建与健康检查：

```bash
make gateway-docker-build
make gateway-docker-smoke
```

手动运行：

```bash
docker build -t arcforge-gateway:local .
docker run -d \
  --name arcforge-gateway \
  --restart unless-stopped \
  -p 3000:8080 \
  -e LIVEAGENT_GATEWAY_TOKEN=<long-random-token> \
  arcforge-gateway:local
```

## Gateway Linux 二进制

Windows-only 只约束桌面应用，不影响 Gateway 服务端。以下目标继续保留：

```bash
make build-linux       # Gateway Linux amd64
make build-linux-arm   # Gateway Linux arm64
```

产物写入 `crates/agent-gateway/bin/`。这些目标会先生成 Proto 代码并构建嵌入式 WebUI。

## Gateway 运行时变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `LIVEAGENT_GATEWAY_TOKEN` | 是 | WebUI、HTTP API、桌面端 v2 WebSocket 的共享访问 token。 |
| `PORT` | 平台相关 | HTTP/WebUI/WebSocket 监听端口；Dockerfile 默认 `8080`。 |
| `LIVEAGENT_GATEWAY_GRPC_ADDR` | 否 | 已弃用 no-op，仅为兼容旧启动脚本。 |
| `LIVEAGENT_GATEWAY_CHAT_PREPARE_TIMEOUT` | 否 | 命令提交前桌面 Agent 探活等待时间，默认 `2s`。 |
| `LIVEAGENT_GATEWAY_CHAT_DELIVERY_TIMEOUT` | 否 | accepted 后投递到桌面 stream 的上限，默认 `5s`。 |
| `LIVEAGENT_GATEWAY_CHAT_START_TIMEOUT` | 否 | 远程命令启动 watchdog 第一阶段，默认 `5s`。 |
| `LIVEAGENT_GATEWAY_CHAT_RENDER_START_TIMEOUT` | 否 | 第一阶段后的附加等待窗口，默认 `10s`。 |

`LIVEAGENT_*` 变量当前作为既有部署契约保留。若后续增加 `ARCFORGE_*`，应先实现新变量优先、旧变量回退，再更新部署示例。

## Railway 或其他平台自部署

仓库不提供预构建 Gateway 镜像。平台应直接从包含根目录 `Dockerfile` 和 `railway.json` 的分支构建：

1. 在平台创建项目并连接自己的仓库或 fork。
2. 选择包含当前 `Dockerfile` 的分支。
3. 设置 `LIVEAGENT_GATEWAY_TOKEN=<long-random-token>`。
4. 部署后访问 `/healthz` 验证服务。
5. 为服务配置 HTTPS 域名，并在桌面端 Remote 设置中填写 `https://<service-domain>` 与端口 `443`。

WebUI、HTTP API 与 `/ws/v2*` WebSocket 链路使用同一个 HTTPS 域名和端口，不需要独立的 gRPC 入口。Gateway 的短时 replay 与请求去重是进程内有界状态，不需要 SQLite 持久卷。
