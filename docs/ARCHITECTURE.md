# ArcForge 目标架构

## 1. 架构目标

ArcForge 的核心不是某个模型或 Runtime，而是一个可信的 Work Kernel：它能够组织任务、选择 Agent Backend、调用受控能力、生成交付物、验证结果并治理记忆。

Grok Build 是 Coding `AgentBackend` 的候选实现，不是系统总控。

## 2. 总体架构

```text
ArcForge Desktop UI
        │ DesktopCommand / DesktopEvent
        ▼
Application Core / Work Orchestrator
├── Workspace / Thread / Task
├── Plan / AgentRun / Delegation
├── Artifact / Evidence / Effect
├── Policy / Approval / Budget
├── Memory Candidate
├── Event Projection
└── Storage Broker / DomainStoreWriter
        │
        ├──────── Agent Backend Registry ──────────┐
        │   ├── NativeWorkAdapter                  │
        │   ├── GrokBuildCodingAdapter             │
        │   └── FutureRemoteAgentAdapter            │
        │                                           │
        └──────── Trusted Execution Broker ─────────┘
            ├── File / Workspace Broker
            ├── Process / Shell Broker
            ├── Browser / Computer-use Broker
            ├── Document / Spreadsheet Broker
            ├── MCP Broker
            ├── Network / Provider Broker
            └── Secret Broker
```

## 3. 两类扩展接口

### 3.1 AgentBackend

具有独立 Agent 循环、上下文和任务执行能力的后端：

```text
initialize
capabilities
start_run
resume_run
cancel_run
event_stream
dispose
```

示例：

- NativeWorkAdapter；
- GrokBuildCodingAdapter；
- FutureRemoteAgentAdapter。

### 3.2 CapabilityProvider

提供原子能力，不拥有完整 Agent 循环：

- 文件；
- 文档；
- 表格；
- Shell；
- 浏览器；
- Computer Use；
- MCP；
- 外部 SaaS Connector。

Browser、Document、Spreadsheet 和 Computer Use 默认是 CapabilityProvider，不应该各自被设计成完整 Runtime。

## 4. 去编码化领域模型

```text
Workspace
└── Thread
    └── Task
        ├── Goal / AcceptanceCriteria
        ├── Plan
        ├── AgentRun
        │   ├── Step
        │   ├── ToolIntent
        │   └── Delegation
        ├── Artifact
        ├── Evidence
        ├── Effect
        ├── Approval
        └── MemoryCandidate
```

### Workspace

一组受控资源，可以是本地目录、Git 仓库、文档集合、虚拟项目或 Connector 资源集合。

### Task

用户希望完成的工作结果，不等于一次模型调用。

### AgentRun

某个 AgentBackend 对 Task 的一次执行尝试。失败后的重试产生新的 Run。

### Artifact

可版本化、可预览、可审查的交付物：报告、表格、代码补丁、邮件草稿、图像或结构化数据。

### Evidence

证明任务结果的材料：引用、文件哈希、测试结果、截图、校验规则和动作回执。

### Effect

对用户文件、进程、网络或外部系统产生的真实变化。

## 5. Effect 生命周期

```text
Proposed
├── PolicyDenied
├── AwaitingApproval → Authorized / Rejected / Expired
└── Authorized → Executing / Canceled / Expired

Executing → Applied / PartiallyApplied / Failed / Unknown
PartiallyApplied → Compensating / ManualResolutionRequired
Unknown → Applied / Failed / ManualResolutionRequired
ManualResolutionRequired → Applied / Failed / AbandonedWithUncertainty
Applied → Compensating → Compensated / CompensationFailed / Unknown
```

`PolicyChecked` 是 PolicyDecision 事实，不是 Effect 状态；`Reconciled` 是对账过程，必须落到上述明确结果。完整状态机以 [Domain Model V1](specs/DOMAIN_MODEL_V1.md) 为准。

通用工作中，很多 Effect 无法像代码一样回滚。产品必须区分：

- `Draft`：只生成草稿；
- `Preview`：展示即将执行的内容；
- `Apply`：产生真实变化；
- `Compensate`：能力支持时执行补偿；
- `Irreversible`：明确不可撤销。

任务完成不能依赖模型自报，必须由 Acceptance Criteria 与 Evidence 决定。

## 6. Trusted Execution Broker

AgentBackend 只能提交 `ToolIntent`，无权自行提升权限。

每次授权绑定：

- Task、AgentRun 和 Runtime；
- 规范化参数哈希；
- 资源范围；
- 风险等级；
- 允许次数和有效期；
- Policy 版本；
- 审批者。

安全规则：

- Runtime 不直接获得 `.arcforge` 根目录。
- Runtime 不直接枚举 Secret。
- Skill 不携带额外权限。
- MCP Tool metadata 不是可信安全事实。
- STDIO MCP Server 的启动本身是高风险进程动作。
- UI 已校验不代表可信；Rust Core/Broker 必须重新鉴权。

### 6.1 进程信任等级

Task Workspace 只提供变更审查和冲突隔离，不是 Windows 安全 Sandbox。进程按以下等级治理：

```text
TrustedInProcess
RestrictedSidecar
SandboxedThirdParty
ExecutionDenied
```

- 内建 Rust 模块可以在受信任进程内运行，但仍通过窄接口访问领域状态。
- Sidecar 若只能提交结构化 ToolIntent，且没有真实 Workspace、通用网络、Secret 或进程权限，可以作为 RestrictedSidecar。
- 能直接访问文件系统、Shell、网络或子进程的 Grok Build/STDIO MCP 必须置于经验证的受限 Token、AppContainer、Windows Sandbox 或 VM 等 OS 强制边界；Job Object 只负责生命周期。
- 不能证明 Broker 不可绕过、又没有 OS 隔离时，`Plan` 也不能作为降级逃生通道，必须禁止启动该 Runtime。

### 6.2 Run Mode 强制规则

V1 只有 `Plan | Execute`。`run_mode` 与 `mode_policy_hash` 必须进入 RunSpec、ToolIntent、PolicyDecision、Authorization 和审计事件。

- Plan 只允许不可变 Snapshot 读取、ArcForge 内部 Plan Artifact，以及绑定有效 DataBoundaryGrant 的 Provider Egress；
- Plan 必须拒绝真实 Workspace 写入、Process/Shell、STDIO MCP、脚本、Memory Persist 和外部业务系统修改；
- Execute 也只能写隔离 Task Workspace，真实 Apply 仍是独立 Effect。

## 7. 隔离 Task Workspace

所有可写 Task 使用独立 Workspace/Overlay：

```text
真实资源基线
→ 创建 Task Workspace
→ Agent 生成 Artifact/变更
→ 生成 ChangeSet
→ 用户审查
→ 校验目标资源未变化
→ Apply / Merge / Reject
```

这套机制同时支持文档、表格、报告和代码，不只服务 Git。

外部 SaaS Effect 无法放入文件 Overlay，因此必须通过幂等键、预览、确认、回执与补偿策略治理。

## 8. Grok Build Adapter

Grok Build 只注册编码相关能力：

- Repository investigation；
- Patch generation；
- Test execution；
- Coding Agent loop。

进入受控 Code Mode 的门槛：

1. ACP 关键结构化事件完整。
2. 文件、Shell、网络和 Secret 操作能够全部经过不可绕过的 Broker；若 Runtime 仍保留直接环境能力，则必须处于真正的 OS Sandbox。
3. Sidecar 可取消、崩溃可识别、子进程可回收。
4. 不解析 TUI、ANSI 或自然语言判断状态。
5. 固定版本、二进制校验、SBOM、许可证和再分发审查通过。
6. 模型、辅助模型和真实数据 Endpoint 可审计。

失败时的顺序：

1. 只有 Runtime 不持有任何环境直接权限时，才可保留 Plan；隔离 Coding Workspace 本身不构成安全 Sandbox；
2. 最小受控 Fork；
3. 替换 Runtime。

## 9. Model、Skill、MCP、Memory

### Model

- Provider 与 Model 分离。
- 每个 Run 保存实际模型、配置版本、Endpoint 和能力快照。
- Run Mode 与模型认证分离。模型使用 `Connectivity Checked / Plan Eligible / Research & Report Certified / Coding Certified` 等 Work Pack 认证等级。
- 不静默跨 Provider 或数据边界切换。

### Skill

- Skill 是带版本和来源的工作流/知识包。
- 内置、用户和 Workspace Skill 不静默覆盖。
- 脚本、网络和 MCP 仍需 Broker 授权。
- Run 使用不可变内容快照。

### MCP

- 支持用户级和 Workspace 级配置。
- Secret 只保存引用。
- Server、Origin、可执行文件、Schema 或描述变化后重新审批。
- 工具名必须包含 Server namespace。

### Memory

- Chat history 与 Memory 分开。
- Memory 有来源、作用域、置信度、敏感等级、保留期限和用户同意状态。
- 默认由 Agent 提议，用户可以编辑、拒绝、删除和导出。
- Provider Embedding 或远程检索必须经过 Data Egress Policy。

## 10. 事件模型

EventEnvelope 规范以 [Protocol V1](specs/PROTOCOL_V1.md) 为唯一来源，至少包含 `event_id`、`global_position`、`stream_id`、`aggregate_sequence`、`occurred_at`、`recorded_at`、Scope、Causation、Correlation、Sensitivity 和 Payload。其他文档不得另建字段含义不同的事件信封。

事件需要支持去重、乱序、断流、未知类型和恢复对账。UI 不得把模型文本、终端文本或 MCP 描述当作状态源。

Task、AgentRun、Artifact、Evidence、Effect、Approval 和 MemoryCandidate 的完整状态及合法迁移以 Domain Model V1 为唯一规范；本架构文档不维护第二份简化状态表。

## 11. 多 Agent 演进门

首版预留：

- `agent_id`；
- `parent_run_id`；
- `delegation_id`；
- `workspace_id`；
- `resource_lease_id`；
- Agent 级预算、取消、权限和配置快照。

规则：

- 子 Agent 权限只能继承或缩小。
- 取消父 Task 必须递归取消子 Run。
- 多 Agent 可以对不可变 Snapshot 并行读取。
- 同一文件、文档、浏览器会话或业务对象不能并行写入。
- 外部 Effect 必须由 Broker 串行化并使用幂等键。

首版不实现未使用的完整 spawn/handoff API；通过版本化 capability 保持扩展性。

## 12. 建议代码模块

以下是目标模块边界，不代表现在开始创建生产代码：

```text
apps/desktop
crates/domain
crates/application-core
crates/protocol
crates/event-store
crates/runtime-api
crates/runtime-native
crates/runtime-grok
crates/broker
crates/capability-api
crates/capability-files
crates/capability-process
crates/capability-browser
crates/capability-documents
crates/mcp-host
crates/provider-service
crates/skill-service
crates/memory-service
crates/artifact-service
crates/workspace-service
crates/secret-service
schemas
```

Rust 与 TypeScript 类型由 `schemas/` 中的版本化 Schema 生成或互相验证，避免维护两套不一致协议。

## 13. Tauri 安全要求

- React/WebView 内容全部视为不可信输入。
- Markdown 严格清洗，不渲染任意 HTML。
- 禁止远程脚本和非允许的 WebView 导航。
- Tauri IPC 不暴露通用 `runCommand`、任意文件读取或任意 URL 请求。
- CSP、Capability Scope 和外部链接 Allowlist。
- 过滤终端 OSC 52、恶意链接和危险控制序列。
- Sidecar 使用绝对、已签名和已校验路径启动。
