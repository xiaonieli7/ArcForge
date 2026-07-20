# Broker 合同冻结清单 V0

状态：G0.5 review resolved；机器化合同达到 `G1 contract review candidate`；仍为 Draft，尚未 Contract Frozen

本文不重新定义领域状态机。状态与不变量以 [Domain Model](../specs/DOMAIN_MODEL_V1.md)为唯一规范，命令和跨进程语义以 [Protocol](../specs/PROTOCOL_V1.md)为唯一规范，安全门以 [Threat Model](../security/THREAT_MODEL_V1.md)为准。

## 1. 信任与接口清单

| 接口 | 信任级别 | 允许输入 | 允许输出 | 禁止能力 | 规范来源 | 状态 |
|---|---|---|---|---|---|---|
| `AgentBackend` | Untrusted | `RunSpec`、不可变 Snapshot Handle、用户输入 | `BackendEvent`、`ToolIntent`、Artifact/Evidence Proposal | Raw Secret、真实路径、Capability Token、领域写入 | Protocol §6 | Ready for review |
| `ExecutionBroker` | TCB | ToolIntent、Policy/资源快照、Capability Descriptor | sealed InvocationSpec、Preview、Authorization、EffectReceipt/Evidence | 依据 Agent 文本判成功、授权后改参数 | Protocol §7–10 | Resolved for G0.5 review |
| `EventStore/DomainStoreWriter` | TCB single writer | ApplicationCommand、Expected Version、Domain transaction | CommandReceipt、DomainEvent、Projection input | UI/Backend 直写、未知 Schema 猜测 | Protocol §3–4/§8 | Resolved for G0.5 review |
| `WorkspaceBroker` | TCB capability | Opaque Selection/Snapshot/Resource Handle | Snapshot、ChangeSet、Apply Journal、逐资源 Receipt | WebView 路径、静默覆盖、路径逃逸 | Protocol §3/§7/§11 | Resolved for G0.5 review |
| `ProviderEgress` | TCB capability | DataBoundaryGrant、canonical Endpoint、sealed payload refs | Provider Receipt、Usage、脱敏 Evidence | 通用网络、Redirect 扩权、无 Grant 外发 | Protocol §5/§7 | Resolved for G0.5 review |
| `SecretResolver` | TCB capability | `secret_ref`、Purpose、Target、Run/Invocation scope | 短期 Secret Handle 或 Broker 内部使用结果 | 返回 Raw Secret、写日志/Args/Env/Event | Protocol §3.5 | Resolved for G0.5 review |

ProcessBroker、MCP、Browser/Computer Use 和真实 ExternalBusinessMutation 不进入 G0.5；这里只保留 Effect 分类和 `FeatureDisabled` 行为。

## 2. 核心值对象最低字段

### 2.1 CommandEnvelope

- protocol/schema version；
- command ID、client instance/session、actor、issued time；
- Global/Workspace/Thread/Task/Run/SettingsDiagnostic/Recovery 联合 Scope；
- expected aggregate versions；
- command type、payload hash、correlation ID。

冻结规则：同 ID/同 payload 返回原 Receipt；同 ID/不同 payload 永久拒绝；UI 时间不参与安全判断。

### 2.2 ToolIntent

- backend instance/event/source sequence；
- task/run/agent ID；
- run mode 与 mode policy hash；
- DataBoundaryGrant 引用；
- capability、operation、声明参数和资源引用；
- intent schema/version、deadline 和 trace。

ToolIntent 不是 InvocationSpec，也不是授权。任何缺失、范围扩大或与 RunSpec 不一致都必须 fail closed。

### 2.3 Sealed InvocationSpec

- invocation/effect/task/run/workspace ID；
- run mode、mode policy hash、policy snapshot version；
- capability ID/version/hash 与 operation；
- Broker 规范化后的 canonical args bytes/hash；
- ResourceHandle、资源身份、expected revision/hash；
- CWD/Endpoint/Redirect Policy 等适用的规范化目标；
- 仅含 `secret_ref`，不含 Raw Secret；
- timeout、output/size/resource limits；
- idempotency key、created/expires、canonical spec hash。

冻结规则：Preview、PolicyDecision、Approval、Authorization 和最终 invoke 使用同一 spec hash；任何字段变化创建新 InvocationSpec。

### 2.4 PolicyDecision

- decision ID、policy version/hash；
- InvocationSpec hash、risk/effect class；
- `Deny | RequireApproval | Allow`；
- reason codes、required constraints、evaluated resource versions；
- decision time 与 expiry。

`Allow` 只免去人工 Approval，不能免去 AuthorizationGrant。

### 2.5 Approval 与 AuthorizationGrant

Approval 绑定 Scope、Effect、Intent/Invocation/Preview Hash、Policy、资源版本、次数、期限和审批者。

AuthorizationGrant 还必须绑定：

- authorization/effect/invocation/policy decision ID；
- optional approval ID；
- task/run/workspace、run mode/mode policy；
- capability provider version/hash；
- ResourceHandle/Endpoint/SecretRef scope；
- idempotency key、remaining uses、expiry；
- monotonically issued fencing token。

冻结规则：执行前重新校验所有绑定；Approval 消费、Effect Authorized Event、Authorization Ledger 和 Outbox 入队同一事务。

### 2.6 DataBoundaryGrant

- TaskSpec 和 SourceSet version/hash set；
- data classification、extraction policy hash；
- Provider Profile version、model ID；
- canonical endpoint origin、redirect policy hash；
- egress policy hash、consent version、expiry。

任一字段变化先持久化 invalidated，再拒绝 Provider Invocation。

### 2.7 EffectReceipt 与 ObservedOutcome

EffectReceipt 至少包含 effect/invocation/authorization/idempotency ID、provider operation ID、开始/结束时间、逐资源 outcome、资源前后身份/hash、receipt source、`SanitizedReceiptRef`、Broker attestation 和 reconciliation status。原始 Receipt bytes 不持久化。

ObservedOutcome 使用封闭联合类型：

```text
Applied | NotApplied | PartiallyApplied | Conflict | StillUnknown
```

Agent/Provider 的 completion 文本不能生成 Applied。迟到 Receipt 只能进入对账流程，不能静默改写终态。

## 3. 必须冻结的不变量

- [ ] UI、Backend、Skill、MCP 和 Provider 均不能写 DomainEvent；
- [ ] AgentBackend 不能获得 Raw Secret、真实路径或通用 Capability Token；
- [ ] Authorization 后 InvocationSpec 不可变；
- [ ] Plan 仅允许不可变读取、内部 Plan Artifact 和有效 Grant 下的 DataEgress；
- [ ] 每个 Effect 都有 PolicyDecision 和 AuthorizationGrant；
- [ ] 所有可执行 Outbox 记录都能追溯已提交 Effect Authorized Event；
- [ ] Unknown 不自动重试、不默认成功、不允许新 Effect；
- [ ] 多资源 Effect 仅全 Applied 才能成为 Applied；
- [ ] Secret 不进入 Command、Event、Args、Env、Fixture、Panic 或普通日志；
- [ ] Task Workspace、DACL 和 Job Object 不被称为 OS Sandbox；
- [ ] Grok Build 行为不能改变上述合同。

## 4. 未决冻结项

| ID | 问题 | 所需决定 | Stop 条件 | Owner | 状态 |
|---|---|---|---|---|---|
| BC-01 | Canonical serialization/hash | JCS closed schema、域分离 SHA-256、exact bytes hash | 同一 spec 跨进程 hash 不一致 | Architecture | Resolved for G0.5 review |
| BC-02 | Trusted clock | Broker epoch、monotonic TTL、UTC rollback fail-closed | UI/Backend 时间可延长授权 | Security | Resolved for G0.5 review |
| BC-03 | Fencing issuance | durable per-scope counter；与 claim generation 分离 | 旧 token 可执行新 Effect | Storage | Resolved for G0.5 review |
| BC-04 | Windows resource identity | NTFS Handle Volume/File ID、reparse/hardlink fail-closed | 路径别名可绕过授权 | Windows | Resolved for G0.5 review |
| BC-05 | Late receipt | late observation append；只允许显式 reconciliation | 迟到 receipt 静默变成功 | Core | Resolved for G0.5 review |
| BC-06 | Multi-resource receipt | 封闭 leaf outcome 与确定性领域映射 | Partial 被显示为 Applied | Core | Resolved for G0.5 review |
| BC-07 | Schema negotiation | 权威对象 closed schema；未知关键版本 fail closed | 未知 schema 被容错执行 | Core | Resolved for G0.5 review |
| BC-08 | Secret handle lifetime | Broker-private one-use handle 与可审计 zeroization | handle 跨 Run 或重放可用 | Security | Resolved for G0.5 review |
| BC-09 | Operation-specific postcondition | 冻结 Capability/Operation Descriptor、输入/Preview/Receipt Schema 与 create/replace/delete/DataEgress 后置条件 | 改写 operation 后仍能以矛盾 after-state 通过 Applied | Contracts/Core | Open — Contract Frozen blocker |

详细设计与 G1 验证义务见 [Broker Contract Decisions V0](BROKER_CONTRACT_DECISIONS_V0.md)和[机器化合同评审](G1_CONTRACT_REVIEW_V1.md)。BC-01 至 BC-08 已完成 G0.5 设计闭合；独立机器化审查新增 BC-09 冻结阻断项。当前只能输出 `G1 contract review candidate`，不能输出 Contract Frozen。
