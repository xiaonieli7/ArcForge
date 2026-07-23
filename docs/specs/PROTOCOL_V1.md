# ArcForge Protocol V1

状态：Draft for G0 review

## 1. 边界

```text
Desktop UI
    │ ApplicationCommand / DesktopEvent
    ▼
Application Core
    │ AgentBackend Contract
    ├──────────────── AgentBackend
    │ CapabilityProvider Contract
    └──────────────── Trusted Execution Broker / Providers
```

信任规则：

- UI 不能调用通用 Shell、文件或任意 URL 接口；所有 OS、网络和进程动作都必须映射为窄类型 ApplicationCommand，Raw Secret 只使用 3.5 节的 SecretSubmission，不允许影子 IPC；
- AgentBackend 不能直接调用 CapabilityProvider；
- CapabilityProvider 不能决定自己是否获准执行；
- Backend/Provider 原始事件不得直接发送到 UI；
- Application Core 负责归一化、鉴权、持久化、脱敏和投影。

## 2. 版本与握手

握手交换：

```text
protocol major/minor
schema registry digest
feature flags
required features
backend/capability manifest
ARCFORGE_HOME format/migration state
client_session_id
event_store global_position
```

兼容规则：

1. Major 不兼容：拒绝写入，可只读打开。
2. Minor 只能在明确声明的非语义 `extensions` 容器或 DesktopEvent 中增加可选字段/事件。
3. 未知可选字段只可在上述非权威扩展面忽略但保留；ApplicationCommand、DomainEvent、ToolIntent、InvocationSpec、PreviewBinding、PolicyDecision、DataBoundaryGrant、Approval、Authorization 和 EffectReceipt 使用封闭 Schema，未知字段直接 `UnsupportedSchema`，不得忽略后继续执行。
4. 未知且影响状态机的事件进入 `NeedsUpgrade`，不得猜测执行。
5. Runtime 私有扩展必须在 Adapter 内转换。

## 3. ApplicationCommand

### 3.1 CommandEnvelope

```text
protocol_version / schema_version
command_id
client_instance_id / client_session_id
issued_at
actor
scope: Global | Workspace | Thread | Task | AgentRun | SettingsDiagnostic | Recovery
workspace_id / thread_id / task_id / run_id
settings_operation_id / effect_id
command_type
expected_versions
correlation_id
payload / payload_hash
```

规则：

- `command_id` 是命令幂等键；
- 高风险命令必须包含相关 Aggregate 的 `expected_versions`；
- 相同 Command ID + Payload Hash 返回原 Receipt；
- 相同 ID 携带不同 Payload 必须拒绝；
- UI 时间戳不参与权限或并发判断。

### 3.2 CommandReceipt

```text
Accepted | Rejected | Conflict | Duplicate | Unavailable
```

Receipt 包含命令 ID、结构化错误码、是否可重试、接受位置和当前 Aggregate 版本。

`Accepted` 只表示命令已安全记录，不表示 Task、Artifact 或 Effect 已完成。

### 3.3 V1 命令目录

Workspace：

```text
workspace.pick_directory / register / scan / rescan / archive / restore
```

Thread：

```text
thread.create / rename / archive
```

Task：

```text
task.create / update_spec / prepare_local_plan / request_plan / accept_plan
task.confirm_data_boundary / configure_execution / start / provide_input
task.request_revision / cancel / retry / request_reconciliation
```

Artifact：

```text
artifact.accept / reject / discard / request_render / request_apply
```

Approval 与 Memory：

```text
approval.decide
memory_candidate.revise / accept / reject
memory_entry.delete
```

Recovery：

```text
recovery.request_reconcile / record_manual_resolution
```

设置与窄 OS 动作：

```text
provider_profile.create / update / delete / test_connection / set_default
skill.discover / enable / disable
mcp_server.configure / validate / test_connection / disable
resource.reveal
```

- `provider_profile.test_connection` 只能发送固定健康检查负载，不得包含 Workspace、Goal 或 Memory 内容；
- `workspace.pick_directory` 由受信任桌面层调用系统选择器并返回一次性 Opaque SelectionHandle；`workspace.register` 只消费该 Handle，不接受 WebView 任意路径；
- `mcp_server.test_connection` 若为 STDIO，会产生一次 Process Effect，必须经过 Process Broker、一次性 Approval 和 OS 隔离门；未认证时返回 `FeatureDisabled`；
- `resource.reveal` 只接受 Broker 签发的 Opaque ResourceHandle，用于用户明确点击后在 Explorer/已注册应用中显示资源，不接受 WebView 提供的任意路径或 URL；
- SettingsDiagnostic 和 Recovery Scope 必须包含对应 `settings_operation_id` 或 `effect_id`，不得使用空 Task/Run Scope。

禁止提供：

- 任意 Shell IPC；
- 任意文件读写 IPC；
- UI 直接执行 MCP Tool；
- UI 直接提交“已应用”状态；
- 跳过 Preview 的 Effect；
- 通用数据库修改命令。

### 3.4 高风险绑定

| 命令 | 必须绑定 |
|---|---|
| `workspace.register` | Opaque SelectionHandle、规范化最终路径身份、Volume/File ID、Policy 与有效期 |
| `task.confirm_data_boundary` | TaskSpec、SourceSet/Hash 集、数据等级、Provider Profile、Model、Canonical Endpoint Origin、Redirect/Egress Policy 与 Consent 版本 |
| `task.prepare_local_plan` | TaskSpec、SourceSet 与 Work Pack Template 版本；不得调用 Provider 或外部 Capability |
| `task.request_plan` | TaskSpec、SourceSet、仍有效的 DataBoundaryGrant、Provider/Model/Endpoint 快照 |
| `task.accept_plan` | TaskSpec、Plan、SourceSet 与仍有效的 DataBoundaryGrant |
| `task.start` | TaskSpec、Plan、RunMode、ModePolicy、ExecutionProfile、DataBoundaryGrant、Provider/Model/Endpoint、Policy |
| `artifact.accept/reject` | ArtifactVersion + Content Hash |
| `artifact.request_apply` | ArtifactVersion、Target Revision、Preview Hash |
| `approval.decide` | Approval Version、Intent Hash、Preview Hash |
| `memory_candidate.accept` | Candidate Version、Content Hash、Scope |
| `memory_entry.delete` | MemoryEntry Version、Content Hash、Scope 与派生索引快照 |
| `recovery.record_manual_resolution` | Effect Version、Expected Unknown State、Journal/EffectReceipt Snapshot Hash、逐资源观察结果、Evidence、Actor 与 Reason |
| `mcp_server.test_connection` | Server Config Version、Binary/Origin、Schema Hash、Args/CWD/Secret 引用、网络范围、进程期限与 Preview Hash |

`recovery.record_manual_resolution` 只能记录用户对不确定状态的观察、理由和放弃决定，并转入 `AbandonedWithUncertainty`；不得伪造 EffectReceipt、产生 `effect.applied/effect.failed`、重新生成 Authorization 或使原 Effect 可重试。只有 Broker 基于 Provider EffectReceipt、Apply Journal 与目标资源 Hash 的对账，才能确认 Applied 或 Failed。

### 3.5 SecretSubmission

Raw Secret 不得进入可持久化 ApplicationCommand。桌面层使用单独的窄类型、非 Durable `SecretSubmission`：

```text
secret_submission_id
purpose: Provider | MCP | Connector
target_identity
expires_at
secret_bytes
```

- Rust Secret Broker 在内存中消费后立即写入 Windows Credential Manager/DPAPI 系统密钥库，并只返回 `secret_ref`；
- `secret_bytes` 不进入 Event、Command Receipt、日志、Crash、遥测或诊断包，处理后清零可控内存；
- Profile/MCP 的持久化命令只接受 `secret_ref`；
- 重试必须创建新的 submission ID，禁止将 Secret 放入命令行、URL、普通环境或 WebView Local Storage。

## 4. DomainEvent 与 DesktopEvent

- DomainEvent 是 SQLite append-only Event Store 中的权威事实。
- DesktopEvent 是由 DomainEvent 确定性生成的脱敏 UI 事件。
- DesktopEvent 不是第二事实源。
- JSONL 仅用于用户主动导出或诊断，不作为在线事实源。

### 4.1 EventEnvelope

```text
protocol_version / schema_version
event_id / event_type
global_position
stream_id / aggregate_sequence
occurred_at / recorded_at
scope
workspace_id / thread_id / task_id / run_id
agent_id / parent_run_id / delegation_id
causation_id / correlation_id
origin
sensitivity / redaction_flags
durability: Durable | Transient
payload
```

Transient Event 只能用于流式文字和实时进度，不能驱动终态。流结束后必须产生 Durable Message 或 Artifact Event。

### 4.2 交付语义

- DesktopEvent 至少投递一次；
- UI 按 `event_id` 去重；
- 订阅按 `global_position` 单调交付；
- 重连使用 `after_position`；
- 发现缺口时要求 Projection Snapshot，不静默跳过；
- UI 不以时间戳跨流排序。

### 4.3 V1 事件目录

系统与恢复：

```text
application.ready
recovery.started/completed/attention_required
projection.snapshot_available/snapshot_required
application.effect_gate_changed
```

Application Projection 必须显式处于以下状态之一：

```text
Ready
Recovering
EffectsBlockedUnknown
ReadOnlyNeedsUpgrade
ReadOnlyStorageCorrupt
ProjectionIncomplete
```

在 Core 发布 `application.ready { effects_enabled: true }` 前，Apply、进程、MCP、外部网络写和 SettingsDiagnostic 全部禁用；只读查看可以按状态继续。

Workspace/Source：

```text
workspace.registered/availability_changed/resource_revision_changed
workspace.archived/restored/removed
workspace.scan.started/progressed/completed/failed
source.discovered/unsupported/parse_failed/indexed/stale
```

Thread：

```text
thread.created/renamed/archived
```

Task/Plan：

```text
task.created/spec_updated/status_changed
task.acceptance_criteria.proposed/accepted
task.data_boundary.confirmed/invalidated
plan.created/updated/accepted
task.cancel_requested/completed/failed/canceled/unknown
```

AgentRun：

```text
agent_run.queued/started/status_changed/usage_updated
agent_run.completed/failed/cancel_requested/canceled/lost
```

活动：

```text
activity.recorded/progress_updated
assistant_message.delta/committed
tool_intent.proposed/rejected
tool_result.available
```

Artifact/Evidence：

```text
artifact.created/version_created/validation_started/validated
artifact.validation_failed/validation_invalidated
artifact.reviewed/superseded
evidence.captured/validated/stale/invalidated
evidence.superseded
finding.created/updated
citation.created/invalidated
```

`artifact.reviewed` 必须携带 `decision: accepted | rejected`、Artifact Version、Content Hash 与 Actor。它只表达内容审查决定，不表示已 Apply，也不表示 Task 成功。

Effect/Approval：

```text
effect.proposed/policy_checked/authorized/execution_started
effect.policy_denied/rejected/expired/canceled
effect.applied/partially_applied/failed/unknown/manual_resolution_required/abandoned_with_uncertainty
effect.reconciliation_started/reconciled
effect.compensation_started/compensated/compensation_failed
approval.requested/decided/consumed/revoked/expired/superseded
authorization.issued/revoked/expired
```

Memory：

```text
memory_candidate.proposed/review_started/revised/accepted/rejected/expired/superseded
memory_entry.created/deleted
```

设置诊断与窄 OS 动作：

```text
provider_profile.created/updated/deleted/default_changed/test_started/test_completed
skill.discovered/enabled/disabled
mcp_server.configured/validated/test_started/test_completed/disabled
resource.reveal_requested/reveal_completed/reveal_failed
```

UI 不展示模型私有推理，只展示可解释的行动、进度、输入、输出和证据。

## 5. Projection Query

命令与读取分离。受限查询包括：

- Workspace/Thread/Task Snapshot；
- 指定 ArtifactVersion 内容；
- Citation Source Preview；
- ChangeSet/Diff；
- Approval Preview。

Snapshot 包含：

```text
as_of_global_position
aggregate_versions
projection_schema_version
complete
recovery_or_upgrade_required
```

大文件和正文通过 ContentRef 流读取，不内嵌 Event。

### 5.1 DataBoundaryGrant

`task.confirm_data_boundary` 成功后，Core 持久化 Task 范围的 DataBoundaryGrant。Provider Egress Broker 在每次请求前必须验证：

```text
task_spec_version
source_set_version / source_hash_set
data_classification / extraction_policy_hash
provider_profile_version / model_id
canonical_endpoint_origin / redirect_policy_hash
egress_policy_hash / consent_version / expiry
```

任一字段变化时先提交 `task.data_boundary.invalidated`，后续 Provider Invocation fail closed。`task.request_plan` 不得成为绕过数据边界确认的特殊通道。

## 6. AgentBackend Contract

### 6.1 BackendDescriptor

声明：

- Backend/Adapter/Runtime ID 和版本 Hash；
- 支持的协议范围和 Work Pack；
- Plan/Execute；
- ToolIntent、取消、暂停、恢复、Artifact、Delegation 能力；
- 模型路由方式；
- 并发、预算和已知限制。

Capability 声明不构成授权。

### 6.2 概念接口

```text
describe
initialize
start_run
deliver_input
request_cancel
inspect_run
resume_run
subscribe_events
dispose
```

### 6.3 RunSpec

RunSpec 包含：

- Task/Run/Agent ID；
- `run_mode: Plan | Execute` 与 `mode_policy_hash`；
- TaskSpec 与 Plan 精确版本；
- 仍有效的 DataBoundaryGrant 引用；
- Task Workspace Snapshot Handle；
- Backend/Model/Skill/MCP 配置快照引用；
- 可提议的 Capability Manifest；
- Policy 摘要；
- 预算、Deadline、父子关系和 Trace。

不得包含 Raw Secret、`.arcforge` 根权限、永久 Shell 或可自行扩大的 Capability Token。

Plan Run 只允许不可变 Workspace Snapshot 读取、ArcForge 内部 Plan Artifact，以及绑定 DataBoundaryGrant 的 Provider Egress。Core/Broker 必须拒绝真实 Workspace Draft/Apply、Process/Shell、MCP、脚本、Memory Persist 和外部业务系统写入；Runtime 自报“Plan”不构成安全控制。

### 6.4 BackendEvent

必须包含 Backend Instance ID、Backend Event ID、Run ID、单调 Source Sequence、Schema 和 Payload。

允许：生命周期、消息、进度、ToolIntent、Artifact/Evidence Proposal、用户输入请求、Delegation Proposal、Usage 和 Completion。ToolIntent 必须携带 RunMode、ModePolicy Hash 和 DataBoundaryGrant 引用；与 RunSpec 不一致时拒绝并产生安全事件。

Adapter 不得解析 TUI、ANSI、自然语言或终端文本判断权限、完成或 Tool 状态。

## 7. CapabilityProvider Contract

Provider Descriptor 为每个 Operation 声明：

```text
capability name/version
input/output schema
Read | Draft | Effect
effect_class: DataEgress | WorkspaceMutation | ProcessExecution | ExternalBusinessMutation | MemoryPersistence
resource types
preview support
idempotency/cancel/reconcile/compensate support
timeout/resource limits
risk hints
```

MCP Metadata 或第三方描述不能直接成为 Policy 事实。

Capability/Operation Descriptor 必须为每个 operation 固定输入、结构化 Preview、Receipt Schema Hash 和 postcondition。`create | replace | delete | DataEgress` 不得共用会接受矛盾 after-state 的泛化 `Applied` 规则；该合同冻结前 operation 保持评审态或 `FeatureDisabled`。

调用阶段：

```text
ToolIntent
→ Broker Normalize & Validate
→ Sealed InvocationSpec
→ Trusted Preview Renderer
→ Policy Check
→ Approval（Policy 要求时）
→ AuthorizedInvocation
→ Execute
→ EffectReceipt/Evidence
→ Reconcile/Compensate
```

概念接口：

```text
describe
propose_normalization
invoke
request_cancel
inspect_invocation
reconcile
compensate
dispose
```

CapabilityProvider 提供的规范化结果、风险提示和 Preview 内容都不可信。Broker 必须生成或验证最终 `InvocationSpec`，并由可信 Renderer 根据实际执行字节、二进制 Hash、Args、CWD、Secret 引用、Endpoint 和目标资源生成 Preview。Authorization 绑定 sealed InvocationSpec Hash；Provider 只能执行该对象，不能在 invoke 阶段重新解释参数。

Authorization 必须绑定 Effect、Scope、RunMode、ModePolicy、Provider、Capability 版本、InvocationSpec Hash、ResourceHandle、PolicyDecision、次数、期限、fencing token 和 Idempotency Key。需要用户决定时还必须绑定 Approval；策略自动授权时 `approval_id` 可为空，但 PolicyDecision 不可为空。

## 8. 幂等与重试

| 层级 | 规则 |
|---|---|
| ApplicationCommand | 同 ID/同 Payload 返回原 Receipt |
| DomainEvent | Event ID 与 Stream Sequence 唯一 |
| BackendEvent | Backend Instance + Event ID 去重 |
| Provider Event | Invocation + Source Sequence 去重 |
| Approval | 单次授权原子消费 |
| Artifact | Content Hash 去重，版本保留 |
| Local Apply | Journal + Target Revision + 原子替换 |
| External Effect | Idempotency Key + EffectReceipt + Reconcile |

不变量：

- Unknown Effect 永不自动重试；
- 不支持幂等的操作只能明确批准后执行一次；
- Retry Task 创建新 AgentRun；
- Event append 与 Effect Outbox 在同一 SQLite 事务；
- Approval 消费、Effect Authorized Event、Authorization/fencing token 与 Outbox 入队在同一事务；
- Exactly Once 不用于承诺任意外部系统。

SQLite Event Table 是唯一领域事实源。Effect Outbox 与 Authorization Ledger 是投递、claim、fencing 和恢复操作表，不得覆盖领域状态，也不得作为第二事实源。恢复时不能仅依据 Outbox 自动重放 Executing/Unknown Effect。

## 9. 取消

```text
task.cancel
→ 持久化 cancel_requested
→ 冻结新 ToolIntent/Effect
→ 递归取消子 Run
→ 撤销未消费 Authorization
→ 取消 Capability Invocation
→ 超时后回收 Sidecar/子进程
→ 对账 Executing Effect
→ Canceled | Unknown
```

- 取消异步，不撤销已应用 Effect；
- 迟到 Event 进入审计但不得产生新 Effect；
- 迟到 EffectReceipt 用于对账；
- 任一 Effect 无法确认时 Task 为 Unknown；
- 使用 `cancellation_generation` 拒绝旧代后续意图。

## 10. 崩溃恢复

启动顺序：

1. 获取 `.arcforge` 唯一写锁；
2. 校验 Home/Migration；
3. SQLite integrity check、重放 Projection；
4. 检查 Task Workspace、Apply Journal、Runtime PID 和 Lease；
5. 原 Running Run 暂记 Lost/PendingInspection；
6. 对账 Executing/Unknown Effect；
7. 撤销过期 Authorization；
8. 检查 Artifact、Evidence 和 Source Hash；
9. 生成 Recovery Summary；
10. 仅无歧义 Task 可继续。

恢复不得根据日志或模型文本推断完成，不自动重放 ToolIntent、Provider 请求或 Effect。

Broker 对账结果必须结构化：

```text
Applied | NotApplied | PartiallyApplied | Conflict | StillUnknown

resources[]:
  resource_id
  outcome: Applied | NotApplied | Conflict | StillUnknown
  observed_revision / observed_hash
  sanitized_receipt_ref / evidence_ref
```

- `Applied` 使 Effect 进入 Applied；`NotApplied` 使 Effect 进入 Failed，并明确未发生目标变化；
- expected resource set 必须与 sealed InvocationSpec 完全相等，每个资源恰好出现一次；缺失、重复或额外资源使 Receipt 无效并保持 Unknown；
- 原始 Receipt bytes 只允许在 TCB 内短暂验证、脱敏和 canary 扫描后丢弃；Event/Evidence 只持久化 `SanitizedReceiptRef` 和 Broker attestation；
- 全部 Applied 才聚合为 Applied；全部 NotApplied 聚合为 Failed；有 Applied 且存在任意非 Applied 聚合为 PartiallyApplied；无 Applied 且存在 StillUnknown 聚合为 Unknown；剩余 Conflict 聚合为 Unknown 并进入人工对账；
- `PartiallyApplied` 必须逐资源记录结果，不能进入全局成功；`Conflict` 与 `StillUnknown` 保持 Effectful 操作全局阻断，直到安全终结；
- 人工无法证明结果时只能 `AbandonedWithUncertainty`，不得把旧 Effect 变为可重试；
- Task 完成对账后可以从 Unknown 进入 WaitingReview、Failed、Canceled 或 Ready，但不得直接回到 Running。

## 11. 多 Agent 扩展门

V1 预留：

```text
agent_id / parent_run_id / delegation_id
task_workspace_id / resource_lease_id
Agent 级 Policy/Capability/Model/Skill/MCP 快照
Agent 级预算和取消
```

能力等级：

```text
none | read_parallel | isolated_write | handoff
```

Private Alpha 默认 `none`。

不变量：

- 子 Agent 权限和预算只能缩小；
- 并行读取只针对不可变 Snapshot；
- 不并行写同一资源；
- 写入 Run 需要独立 Workspace 或排他 Lease；
- 子 Agent 只能提议 Effect；
- 成果保留 Provenance；
- 不可见 Worker 不得调用 Capability 或产生 Effect；
- V1 不暴露空的 spawn/handoff UI/API。

## 12. 合同验收

1. 非法状态迁移全部拒绝。
2. 同一事件集重复回放产生相同 Projection Hash。
3. 重复 Command/BackendEvent/ProviderEvent 不产生重复 Effect。
4. 任意崩溃点恢复后不自动重放副作用。
5. 取消父 Task 终止全部子进程和子 Run。
6. Artifact Accepted 不触发隐式 Workspace 写入。
7. 参数变化或过期 Approval 无法执行。
8. Unknown 或 PartiallyApplied Effect 阻断 Task 成功与后续 Effectful 操作。
9. UI 不解析自然语言判断状态。
10. Raw Secret、敏感绝对路径和大段源内容不进入 DesktopEvent。
11. 未知关键 Schema 触发升级或只读。
12. 多 Agent 字段为空时与单 Agent 行为一致。
13. 未确认 DataBoundaryGrant 时任何 Provider Egress 都被拒绝；范围或 Endpoint 变化会立即失效。
14. Plan ToolIntent 无法获得 WorkspaceMutation、ProcessExecution、ExternalBusinessMutation 或 MemoryPersistence Authorization。
15. Preview 与执行使用同一 sealed InvocationSpec；参数变化必须生成新 Preview 和 Approval。
16. Unknown/人工放弃不能重新授权或重试原 Effect。
