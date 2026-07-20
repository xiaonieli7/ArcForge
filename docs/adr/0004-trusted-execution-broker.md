# ADR-0004：Trusted Execution Broker

状态：Proposed

## 背景

通用 Work Agent 可能访问文件、进程、网络、浏览器、文档、MCP、Secret 和外部业务系统。不能让某个模型或 Runtime 同时拥有这些能力的直接控制权。

## 决策

- Agent Backend 只能提出 `ToolIntent`。
- 文件、进程、网络、MCP、Secret 和外部 Effect 必须由 Trusted Execution Broker 执行。
- 授权绑定参数 Hash、资源范围、Task/Run、Policy 版本、次数和期限。
- 未认证 Capability 默认不可调用。
- UI 的校验不是安全边界，Rust Core/Broker 必须重新鉴权。
- V1 Run Mode 只有 `Plan | Execute`；Plan 只允许不可变读取、内部 Plan Artifact 和有效 DataBoundaryGrant 下的 Provider Egress。
- Task Workspace、DACL 和 Job Object 都不能替代第三方进程的 OS Sandbox。

## 后果

- Runtime 集成难度增加，但 Runtime 可以替换且权限行为一致。
- Grok Build 若无法交出副作用执行权，必须进入经验证的 OS Sandbox；若同时拥有环境直接权限且无法隔离，则连 Plan 都不得启动。
- 每个 Capability 需要独立风险分类、审计、幂等和故障恢复。
