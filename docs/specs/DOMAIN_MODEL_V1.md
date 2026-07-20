# ArcForge Domain Model V1

状态：Draft for G0 review

## 1. 目的

本文定义 ArcForge Work Kernel 的稳定领域语言、状态机和跨实体不变量。UI、AgentBackend、CapabilityProvider、Skill、MCP 和具体 Work Pack 不得自行改变这些语义。

规范词：

- 必须：发布门要求；
- 不得：违反即为安全或一致性缺陷；
- 建议：允许通过 ADR 调整；
- V1：Research & Report Private Alpha 合同范围。

## 2. 核心关系

```text
Workspace
└── Thread
    └── Task
        ├── TaskSpec / AcceptanceCriteria / Plan
        ├── TaskWorkspace
        ├── AgentRun[]
        │   └── Delegation[]
        ├── Artifact[]
        │   └── ArtifactVersion[]
        ├── Evidence[]
        ├── Effect[]
        │   ├── Approval[]
        │   └── AuthorizationGrant[]
        └── MemoryCandidate[]
```

| 实体 | 定义 |
|---|---|
| Workspace | 一组受控资源，不等同于 Git 项目 |
| Thread | 连续协作上下文，不携带额外权限 |
| Task | 需要满足验收标准的工作目标，不等于模型请求 |
| AgentRun | 某个 AgentBackend 对 Task 的一次执行尝试 |
| Artifact | 可预览、版本化、审查的交付物 |
| Evidence | 支持验收判断的可验证证据 |
| Effect | 对文件、进程、网络或外部系统产生的真实变化 |
| Approval | 对精确 Effect 的授权决定 |
| AuthorizationGrant | Broker 执行精确 sealed InvocationSpec 的短期许可 |
| MemoryCandidate | 尚未进入长期记忆的候选内容 |

## 3. ID、版本与时间

### 3.1 ID

Application Core 使用 UUIDv7 生成主实体 ID：

```text
workspace_id / thread_id / task_id / run_id / agent_id
artifact_id / evidence_id / effect_id / approval_id
memory_candidate_id / delegation_id / task_workspace_id
resource_lease_id / authorization_id / policy_decision_id
invocation_id / command_id / event_id
```

规则：

- ID 不包含用户名、路径、Provider 或敏感业务内容；
- Runtime/MCP/SaaS 外部 ID 作为带 namespace 的映射保存；
- UI 不根据 ID 格式推导实体类型或权限；
- 内容与参数使用 SHA-256：`content_hash`、`intent_hash`、`preview_hash`、`config_snapshot_hash`。

### 3.2 版本

| 版本 | 用途 |
|---|---|
| `protocol_version` | 进程间协议 `major.minor` |
| `schema_version` | Command/Event/Entity Payload 整数版本 |
| `aggregate_version` | 实体事件流版本，单调递增 |
| `task_spec_version` | Goal、验收标准和模式修订 |
| `plan_version` | Plan 修订 |
| `artifact_version` | Artifact 内容修订 |
| `resource_revision` | Workspace 资源基线 |
| `policy_version` | 权限判断策略版本 |
| `config_snapshot_id` | Model、Skill、MCP、Backend 快照 |

运行中的 AgentRun 必须绑定不可变 TaskSpec、Plan、Policy、Model、Skill、MCP 和 Capability 快照。配置变更只影响后续 Run。

### 3.3 时间与排序

- 时间统一保存为 UTC RFC3339；
- 时间戳只用于审计和展示；
- 排序使用 Event Store 的 `global_position` 和实体流的 `aggregate_sequence`。

## 4. TaskSpec 与 AcceptanceCriterion

### TaskSpec

包含：

- Goal；
- AcceptanceCriteria；
- `run_mode: Plan | Execute`；
- Provider 与数据目的地；
- 允许的数据范围；
- 交付要求与用户约束；
- Spec 版本。

Run 开始后 TaskSpec 不可就地修改。用户改变 Goal 或验收标准时，停止当前 Run、创建新版本并重新规划。

### AcceptanceCriterion

```text
criterion_id
description
required
verification_method
status: Pending | Satisfied | Unsatisfied | Unverifiable
evidence_refs[]
```

验证方式可以是用户审查、Artifact Validator、Evidence Query 或 EffectReceipt。模型声明“已完成”不能直接将 Criterion 设为 `Satisfied`。

### DataBoundaryGrant

任何可能向 Provider 发送 Goal、文件内容、摘录或派生内容的操作，必须绑定仍有效的 DataBoundaryGrant：

```text
data_boundary_id / version
task_id / task_spec_version
source_set_version / source_hash_set
data_classification / extraction_policy_hash
provider_profile_version / model_id
canonical_endpoint_origin / redirect_policy_hash
egress_policy_hash / consent_version
confirmed_by / confirmed_at / expires_at
```

规则：

- 资料范围、Hash 集合、数据等级、Provider、Model、Endpoint、Redirect Policy 或 Egress Policy 任一变化，Grant 立即失效；
- Provider Egress Broker 必须在每次请求前重新验证 Grant，不得只依赖 UI 曾显示过确认页；
- Grant 是 Task 范围的数据边界授权，不授权 Workspace 写入、进程、MCP、外部业务系统或 Memory Persist；
- DataBoundaryGrant 及其失效必须成为 DomainEvent，不能只保存在 WebView 状态。

## 5. ResourceHandle

AgentBackend 和 UI 不直接获得无限制绝对路径。Broker 签发 ResourceHandle：

```text
resource_type
workspace_scope
relative_locator
resource_revision/content_hash
allowed_operations
policy_version
expires_at
```

Handle 目标或版本变化后，旧授权立即失效。

## 6. Workspace

V1 认证 `local_ntfs_directory`；Git、虚拟 Workspace 和 Connector 集合保留类型门。

生命周期：

```text
Registering → Ready | Degraded | Unavailable
Ready / Degraded / Unavailable → Archived
Archived → Ready | Removed
```

索引状态独立：

```text
NotIndexed → Scanning → Indexed | Partial | Failed
Indexed / Partial → Stale → Scanning
```

不变量：

1. V1 Workspace 只绑定一个受控根目录。
2. 根目录重新绑定增加 `resource_revision`，使旧 Snapshot、Citation 和未执行 Effect 失效。
3. 路径必须通过规范化、Handle 级边界及 reparse/junction 检查。
4. Archived Workspace 不得启动新 Task 或 Effect。
5. Thread 不得扩大 Workspace 权限。

## 7. Thread

```text
Active → Archived → Active | Removed
```

不变量：

- Thread 永久属于一个 Workspace；
- Thread 是协作和导航容器，不是安全边界；
- Archive 不删除 Task、Artifact、Evidence 或 Audit；
- Thread 历史不自动升级为 Memory。

## 8. Task

状态机：

```text
Draft → Planning → Ready → Running
Running → WaitingUser | WaitingReview | Paused | Failed | CancelRequested
WaitingUser → Running
WaitingReview → Running | Succeeded
Paused → Running
Failed → Ready（显式 Retry）
CancelRequested → Canceled | Unknown
Running / WaitingUser / WaitingReview → Unknown
Unknown → WaitingReview | Failed | Canceled | Ready（完成对账后）
```

`Unknown` 不得直接恢复为 Running。必须完成 Effect 对账，并转入上述明确状态；任何仍不确定的 Effect 都会阻止 Task 离开 Unknown。

### Task 成功门

Task 只有同时满足以下条件才能进入 `Succeeded`：

1. 所有 Required AcceptanceCriteria 已满足；
2. 所需 Artifact 精确版本已接受；
3. 所需 Effect 已有 `Applied` EffectReceipt，或用户明确接受只保留草稿；
4. 不存在任何可派发、非终态或带未解决不确定性的 Effect，包括 `Proposed`、`AwaitingApproval`、`Authorized`、`Executing`、`PartiallyApplied`、`Unknown`、`ManualResolutionRequired`、`Compensating` 和 `AbandonedWithUncertainty`；
5. 没有未消费 Authorization、未处理 Approval 或待派发 Effect Outbox；
6. AgentRun 已结束；
7. V1 用户明确接受结果。

进入 `Succeeded` 的同一事务必须冻结新 ToolIntent，并撤销该 Task 所有剩余 Authorization。

不变量：

- 一个 AgentRun 绑定一个不可变 TaskSpec；
- V1 同一 Task 最多一个活动写入 Run；
- Backend 完成不等于 Task 成功；
- Artifact 生成不等于写入真实 Workspace；
- Cancel 不等于回滚。

## 9. AgentRun

每个 Run 至少保存：`run_mode`、`mode_policy_hash`、DataBoundaryGrant 引用、Task/Plan/Provider/Model/Skill/MCP/Capability 快照、预算、取消代和 Backend 身份。

状态机：

```text
Queued → Starting → Running
Running → WaitingCapability | WaitingApproval | WaitingUser
Running → Completed | Failed | CancelRequested
WaitingCapability / WaitingApproval / WaitingUser → Running
CancelRequested → Canceled | Completed | Lost
Starting / Running → Lost
```

不变量：

1. Retry 创建新 `run_id`。
2. `Completed` 只表示 Backend 正常结束。
3. AgentBackend 只能提交 ToolIntent。
4. Backend Capability 声明不构成授权。
5. Resume 只在 Resume Handle 可验证、配置快照一致且无未对账 Effect 时允许。
6. 否则旧 Run 为 `Lost`，重试创建新 Run。

## 10. Artifact

```text
Draft → ReadyForReview
ReadyForReview → Accepted | Rejected | Superseded | Discarded
Accepted → Superseded
```

Validation 独立：

```text
NotRun → Validating → Passed | Failed | Stale
```

不变量：

- ArtifactVersion 内容不可变，修改产生新版本；
- Review 绑定精确版本和 `content_hash`；
- 接受 Artifact 不产生 Workspace 写入；
- Render 与 Apply 是独立操作：Render 只在 Task Workspace 形成不可变表示，属于 Draft；Apply 才是对真实目标的 Effect；
- 大内容使用内容寻址 Blob，Event 只存引用和 Hash。

## 11. Evidence

类型：Citation、Source Hash、Artifact Validation、Test Result、Screenshot、File Diff、EffectReceipt、User Confirmation、ExternalReceipt。

状态：

```text
Captured → Valid | Invalid
Valid → Stale | Superseded
Stale → Valid | Superseded
```

不变量：

- Evidence 内容不可就地修改；
- 模型自报不能成为 `Valid` Evidence；
- Citation 绑定 Source Hash 和 Locator；
- Source 变化时相关 Evidence 为 `Stale`；
- EffectReceipt 不能只引用 Agent 文本。

## 12. Effect

Effect 必须声明分类：

```text
DataEgress
WorkspaceMutation
ProcessExecution
ExternalBusinessMutation
MemoryPersistence
```

本地不可变 Snapshot 读取和仅在 Task Workspace 内创建草稿属于 `Read`/`Draft` 操作，不是对真实资源的 Effect。远程模型请求属于 `DataEgress`：即使不修改 Workspace，也会产生数据传输、费用和 Provider 日志。

状态机：

```text
Proposed → PolicyDenied | AwaitingApproval | Authorized
AwaitingApproval → Authorized | Rejected | Expired
Authorized → Executing | Canceled | Expired
Executing → Applied | PartiallyApplied | Failed | Unknown
PartiallyApplied → Compensating | ManualResolutionRequired
Unknown → Applied | Failed | ManualResolutionRequired
ManualResolutionRequired → Applied | Failed | AbandonedWithUncertainty
Applied → Compensating
Compensating → Compensated | CompensationFailed | Unknown
```

不变量：

1. 参数、目标、Policy 或 Preview 变化后旧 Approval/Authorization 失效。
2. `Authorized` 不等于 `Applied`。
3. 执行中取消不得直接标记 Canceled；无法确认时为 Unknown。
4. Unknown Effect 禁止自动重试。
5. 外部 Effect 不承诺 Exactly Once。
6. 本地文件 Apply 使用 Journal、目标 Hash 和原子替换。
7. 所有 Effect 经过 Trusted Execution Broker。
8. Plan 只允许绑定有效 DataBoundaryGrant 的 `DataEgress`；必须拒绝其他 Effect 分类、Process/Shell、STDIO MCP、脚本和 Memory Persist。
9. `AbandonedWithUncertainty` 是明确的未解决终止，不得被解释为 Applied、Failed 或可重试。
10. `ManualResolutionRequired → Applied | Failed` 只能由 Broker 基于 Provider EffectReceipt、Apply Journal 与资源身份/Hash 的对账证据驱动；用户人工记录只能进入 `AbandonedWithUncertainty`。
11. 多资源 Effect 只有全部资源 Applied 才能进入 Applied；已知部分成功必须进入 PartiallyApplied 并逐资源保存 EffectReceipt/Evidence。

## 13. Approval

```text
Pending → Approved | Rejected | Expired | Superseded
Approved → Consumed | Revoked | Expired
```

Approval 包含 Intent/Preview Hash、资源范围、风险、可逆性、次数、期限、Policy 版本和审批者。

Approval Scope 是显式联合类型：`TaskRun(task_id, run_id) | SettingsDiagnostic(settings_operation_id) | Recovery(effect_id)`，不得用空 Task/Run 表示设置或恢复操作。

每个 Effect 都必须有 `AuthorizationGrant`。如果 Policy 对低风险操作或已确认 DataBoundaryGrant 内的 Provider Egress 自动允许，`approval_id` 可以为空，但 `policy_decision_id` 必须存在；需要用户决定的 Effect 必须绑定 Approval。

不变量：

- 只绑定用户看到的精确 Preview；
- V1 默认单 Effect、单次授权；
- Skill、MCP 和 Backend 不能扩大范围；
- Policy 收紧或资源版本变化后重新审批；
- 已消费 Approval 不可伪造成“从未执行”。
- Approval 消费、Effect Authorized Event、带 fencing token 的 Authorization 和 Effect Outbox 入队必须在同一 SQLite 事务完成；
- 执行前必须重新校验 Policy、资源版本、sealed InvocationSpec、Preview Hash、期限和剩余次数。

## 14. MemoryCandidate

```text
Proposed → InReview
InReview → Accepted | Rejected | Expired | Superseded
```

不变量：

- Accepted 前不注入后续 Agent 上下文；
- 编辑产生新版本并使旧批准失效；
- Accepted 创建独立 MemoryEntry 并保留来源链；
- Secret、Token、Cookie、未确认推断不得进入 Memory；
- 删除使用 Tombstone 并移除检索索引。

## 15. 跨实体不变量

1. Application Core 内的 Storage Broker（`DomainStoreWriter`）是领域状态唯一写入者，与 Trusted Execution Broker 分离。
2. UI、Runtime、Skill、MCP 和 CapabilityProvider 都是非权威输入。
3. 所有状态变化由已提交 DomainEvent 驱动。
4. UI 不从模型、终端或 MCP 文本推断状态。
5. Artifact 接受、Effect 应用和 Task 成功是三个事实。
6. 子 Agent 权限、预算和资源范围只能缩小。
7. Task 为 Unknown 时禁止产生新 Effect。
8. 真实动作必须可追溯：`Command → PolicyDecision → Approval（如需）→ Authorization → Effect → EffectReceipt`。
9. Raw Secret 不进入 Command、Event、Artifact Metadata、Memory、普通日志或诊断包。
10. 高敏感内容不直接进入 Event Payload，只保存 ContentRef。
11. 终态不得被迟到 Runtime Event 静默改写。
12. 跨 Aggregate 使用 Saga/Process Manager，不假设外部 Effect 能进入数据库事务。
13. `run_mode` 必须由 Broker 强制，不能只作为 UI 标签或 Backend 自报字段。
14. Task Workspace 是变更隔离，不是 OS Sandbox；有环境直接权限的第三方进程必须处于经验证的 OS 强制边界，否则禁止启动。

## 16. WorkPackDefinition

每个可发布 Work Pack 必须声明：

```text
work_pack_id / version
supported_inputs
artifact_types
required_capabilities
possible_effects
required_evidence
evaluators
ui_renderers
certified_models/backends/platforms
limits
```

UI 只展示当前 Model × Backend × Capability × Platform 组合真正认证的能力。
