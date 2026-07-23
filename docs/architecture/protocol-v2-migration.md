# v2 协议迁移与 v1 移除记录（已完成）

本文档归档 v1 → v2（WebSocket+Protobuf 统一线协议）迁移的删除记录。
**v1 已于 2026-07 整体移除**，网关、桌面端与 WebUI 只保留 v2；协议合同见
[protocols.md](./protocols.md)。

## 移除内容（2026-07 执行）

Go 网关：

- [x] 删除 `internal/server/websocket*.go` 全部 v1 文件（envelope/路由表/
      16 个 handler/payloads/terminal_stream/roundtrip）及其测试；
      `publicHistoryShare` 依赖的 proto→JSON 塑形迁至 `internal/server/proto_json.go`
- [x] 删除 `internal/server/grpc.go` 与 `cmd/gateway` 中 gRPC 监听、TLS、
      keepalive、拦截器（`internal/auth/grpc_interceptor.go`）与 `shutdown.go`
- [x] `internal/chatwire` 甄别结果：全部为 v2/session 入口塑形复用，原样保留
- [x] `http.go` 移除 `/ws`、`/ws/terminal` 路由与 `?terminal=1` 分支；
      `http_origin.go` 包装层删除（v2 直接调 `shared.OriginAllowed`）
- [x] `proto/v1/gateway.proto` 删除 `service AgentGateway`（消息全部保留，
      它们是 v2 的载荷）；`buf.gen.yaml` 移除 `protoc-gen-go-grpc` 插件并
      重新生成（`gateway_grpc.pb.go` 删除、TS 侧 service 导出消失）
- [x] `go.mod` 移除 `google.golang.org/grpc`（`go mod tidy` 后零残留）
- [x] `-grpc-addr` 转弃用 no-op（保护既有启动脚本），下个版本删除；
      `GRPCMaxMessageBytes`/`-heartbeat-period` 为 v2 沿用配置，保留
- [x] 移除 `.golangci.yml` 中 v1 路径的 SA1019 豁免
- [x] 移除 `observability/protousage.go` 中全部 v1 计数器（`protocol_usage`
      只余 v2 键）
- [x] Makefile/CI/Dockerfile/mise 移除 gRPC 端口、`protoc-gen-go-grpc` 钉栓

桌面端 Rust：

- [x] 删除 `connect_and_serve_grpc`、`build_grpc_url`、`build_endpoint`、
      `insert_bearer_metadata`、gRPC 终端流与回退调度分支（v2 握手失败不再
      回退，按普通连接错误退避重连）
- [x] `Cargo.toml` 移除 `tonic`/`tonic-prost` 运行时依赖；`build.rs` 改
      `build_client(false)` 纯消息生成，`include_proto!` 改为直接 `include!`
      （`tonic-prost-build` 仍作 build 依赖驱动 prost 生成）
- [x] 设置界面移除失效的 "gRPC Endpoint" 覆盖项（两端 RemoteSection 同步）；
      `grpc_port`/`grpcEndpoint` 存量字段保留（前者即 v2 网关端口，命名遗留）

WebUI：

- [x] 甄别结果：`web/src` 无手写 v1 线格式残留；生成物中的 `AgentGateway`
      service 导出随 proto 重新生成消失

文档：

- [x] `protocols.md` 删除 v1 附录与弃用行；`gateway.md`/`overview.md`/
      `gui.md`/`development.md`/`deployment.md`/`source-map.md` 同步；本文件归档

## 删除复审补充（同批修正）

- v2 直通 `GitRequest` 补上 `enable_web_git` 写操作门控（v1 handler 删除后
  该设置一度失去唯一执行点；`pbws/guard.go` + v2 测试恢复同款语义）
- `/ws`、`/ws/terminal` 显式回 410 Gone（避免旧客户端落进 SPA fallback
  拿到 index.html）
- 桌面端默认网关端口 50051 → 443（gRPC 监听已删，50051 上无任何服务；
  两端 settings 默认值/占位符/预览同步）
- 网关启动时对非空 `-grpc-addr` 打印弃用警告
- `proto_json.go` 数字矫正链恢复单测（公开分享页 JSON 合同）
- `protocol_usage` 的 7 个 `v1_*` 键保留一个版本、恒为 0（给外部监控/升级
  门禁过渡窗口，语义真实——v1 流量确为零），下个版本随 `-grpc-addr` 一并删除
- 桌面端 `WsServeError`/`WsHandshakeError` 分类层塌缩为 `Result<_, String>`
  （分类只为 v1 回退决策服务，回退已删即为死抽象；错误消息原样保留）
- 两端 `buildGrpcEndpoint` 更名 `buildGatewayEndpointPreview`（预览的是 v2
  网关连接地址，与 gRPC 无关）

## 版本偏斜（移除后）

| 客户端 | 网关 | 行为 |
|---|---|---|
| 新桌面端 / 新 WebUI | 新网关 | v2，正常工作。 |
| 旧桌面端（仅 gRPC） | 新网关 | 无法连接，需升级桌面端。 |
| 新桌面端 | 旧网关（无 `/ws/v2/agent`） | 握手失败按普通错误退避重连（回退已删），需升级网关。 |

移除前提在观察窗内已满足：`/api/status` `protocol_usage` 的 v1 计数停增、
active 归零，网关日志无 `deprecated v1 ... established` WARN。
