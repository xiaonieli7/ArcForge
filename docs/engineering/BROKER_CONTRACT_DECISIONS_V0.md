# Broker 合同 G0.5 设计决策 V0

状态：Independently reviewed；BC-01 至 BC-08 已完成 G0.5 设计闭合，G1 验证待执行

本文关闭的是 G0.5 设计歧义，不代表实现已验证或 G1 Contract Frozen。每项决定仍需 G1 测试证据。

## BC-01 Canonical serialization 与 Hash

决定：安全绑定对象使用 RFC 8785 JCS 的 UTF-8 canonical JSON，加对象类型与版本域分隔后计算 SHA-256。

```text
spec_hash = SHA-256(
  UTF8("ArcForge") || 0x00 ||
  UTF8(canonicalization_version) || 0x00 ||
  UTF8(object_type) || 0x00 ||
  UTF8(schema_version) || 0x00 ||
  JCS(object_without_hash)
)
```

约束：

- 输入必须是 I-JSON：禁止重复属性名、lone surrogate、NaN、Infinity 和负零；
- JCS 不做 Unicode normalization，字符串按原值保持；安全枚举、字段名和 ID 限 ASCII；
- 路径不靠 Unicode/字符串 Hash 授权，而靠 BC-04 ResourceIdentity；
- JSON number 只允许安全范围整数；64 位计数、版本、金额、精确小数和 fencing token 使用无前导零十进制字符串；拒绝所有浮点数；时间使用 UTC RFC 3339 字符串；
- 二进制优先使用 `{content_ref, sha256, byte_length}`；确需内嵌时只用 base64url no-padding；最终执行参数另存 exact bytes SHA-256，不能由显示字符串重建；
- `spec_hash` 字段自身不参与 Hash；未知字段由 BC-07 拒绝；
- Approval、Preview、PolicyDecision、Authorization、Outbox 和 invoke 都绑定同一 Hash；
- Preview Hash 绑定结构化 Preview、InvocationSpec Hash 和可信 Renderer 版本，不能 Hash HTML 或 Provider 文本；
- 发布固定 test vector，Rust 实现与独立测试实现字节级一致。

G1 验证：属性顺序、Unicode 等价外观但不同码点、长整数、`-0`、非法 surrogate、二进制和参数字节变更。任何跨实现 Hash 不一致即 Stop。

## BC-02 Trusted clock 与 Expiry

决定：授权安全判断不相信 UI/Backend 时间。进程内使用 Broker 选择并验证的 monotonic clock 和 `clock_epoch_id`；UTC 只用于持久化审计、跨重启过期和时钟异常检测。

规则：

- Approval/Grant/Authorization 保存 `issued_at_utc_trusted`、`issued_monotonic_ticks`、`ttl_ms`、`expires_monotonic_ticks` 和 `clock_epoch_id`；实际有效期取 Policy、Approval、Authorization、DataBoundaryGrant 与调用 deadline 的最小值；
- 创建时 Broker 把 lifetime 映射为 monotonic deadline，执行时同时要求 monotonic 和 UTC 校验通过；
- 每次安全事务持久化 `last_trusted_utc`；检测到 UTC 回拨超过 2 秒、不可读取或超出允许漂移时进入 `ClockUncertain`，关闭 Effect Gate；
- Broker 重启、系统恢复或 clock epoch 改变后所有 `AuthorizationGrant` 和 Secret Handle 立即失效，不从剩余 UTC 时间恢复；
- Pending Approval 和 DataBoundaryGrant 只有在 UTC 不早于持久化下界且未过期时才可恢复，否则 Expired/Invalidated；
- sleep/resume 后先重新取时并验证；G1 若不能证明 monotonic source 在 sleep/hibernate 下的语义，所有在途 Authorization 过期；
- 用户修改显示时间不能延长次数或 lifetime。

G1 验证：回拨、快进、sleep、hibernate、重启、时区/DST 变化和 UI 伪造时间。任何授权因回拨延长即 Stop。

## BC-03 Fencing token 签发与恢复

决定：由 Event Store 内的单写 `fencing_counters` 按 `fencing_scope` 分配无符号 64 位单调 token；分配与 Effect Authorized Event、Authorization Ledger、Outbox 在 T2 同一事务。

Authorization fencing 与 Outbox `claim_generation` 是两个独立控制。`fencing_scope`：

- WorkspaceMutation：`workspace:{workspace_id}`，同一 Workspace 同时只允许一个非终态 Workspace Effect；
- ProviderEgress：`task:{task_id}:provider:{provider_profile_id}`；
- Settings：`settings:{settings_operation_id}`；
- Recovery：`recovery:{effect_id}`；
- 其他未来 Capability 必须定义不可扩大的资源 scope，未定义即 FeatureDisabled。

执行条件：token 等于 scope durable high-water、Authorization Active、remaining uses=1、spec hash 相同、broker epoch 相同且 claim generation 当前。worker 在同一事务 CAS 为 `effect.execution_started/Executing` 后才可外调。消费、撤销、取消或重新授权都会推进 scope token，使旧 worker/token 失效；Unknown 持续占用相应 gate。

只有存在可证明的 `NotStarted` 观察、无 `effect.execution_started` Event，并完成旧 worker 终止/隔离后，才可使用新 token 重新派发。Executing/Unknown 永不因 claim expiry 自动派发。外部系统未必理解 fencing，因此仍必须使用 Idempotency Key、Receipt 和 Reconcile；fencing 只证明 ArcForge 内部的派发所有权。

G1 验证：旧 token、部分重叠资源、并发 claim、双进程、旧进程复活、T2 每个崩溃点和计数溢出。token 溢出时永久关闭该 scope，不回绕。

## BC-04 Windows ResourceIdentity

决定：Core Alpha 只认证本地 NTFS。现有文件/目录身份使用：

```text
volume_serial_number + FILE_ID_128
```

由打开的 Handle 获取 `FILE_ID_INFO`；最终规范路径只用于显示和审计，不作为授权主键。

V1 规则：

- Workspace 选择后打开并保留 Root Handle/identity；拒绝 UNC、Device Path、非 NTFS 和 Workspace Root reparse point；
- 对每个路径分量检查 reparse 属性；Alpha 拒绝 Workspace 下的 symlink、junction、mount point 和其他 reparse point；
- 禁止 ADS、保留设备名、尾随空格/点和无法往返的名称；
- 拒绝启用 per-directory case sensitivity 的目录；8.3/case alias 最终统一到 File ID；
- 写入/Apply 的现有目标若 link count > 1，V1 拒绝，避免通过 hardlink 改变边界外名称指向的内容；
- 现有资源 revision 绑定 File ID、content SHA-256、size、last-write 和可用时的 USN；Apply 前重新打开并全部比较；
- 新文件绑定 parent directory identity、严格校验的 UTF-16 leaf name 和 preview 时的 absence proof；Apply 前重新确认同名/大小写别名均不存在；
- 原子替换后记录新的 File ID/hash，不能假设 replace 保留旧身份。

ResourceIdentity 至少保存 workspace root/parent/target 的 Volume/File ID、relative locator、空 stream name、空 reparse chain、expected size/change time/content hash/revision。无法证明 race-free 时返回 Conflict 或 FeatureDisabled，不能降级为字符串 containment。

G1 验证：`..`、UNC、Device Path、ADS、Unicode、8.3、case-sensitive directory、hardlink、symlink/junction、File ID reuse、root/parent swap、外部编辑器替换和 preview/apply TOCTOU。任何边界外读写即 Stop。

## BC-05 Late EffectReceipt

决定：Receipt 到达时总是先作为不可变 Observation/Evidence 保存，再依据当前 Effect 状态决定是否允许 reconciliation transition。

- Effect 为 Unknown/ManualResolutionRequired：Broker 只有在 Receipt 身份、签名/来源、spec/idempotency/resource 绑定全部通过时，才追加明确 reconciliation Event 并转 Applied/Failed；
- Effect 已 Applied/Failed/Compensated：一致 Receipt 记为 duplicate observation；矛盾 Receipt 产生 P0 security incident，状态不静默改写；
- Effect 已 `AbandonedWithUncertainty`：追加 `LateEffectReceiptObserved` Evidence 和 Recovery alert，但 Effect/Task 终态不改变，也不产生新 Authorization；
- Runtime completion 或用户陈述不属于可信 Receipt；
- 任何 Late Receipt 都不能触发自动重试或把 Task 直接设为 Succeeded。

G1 验证：每个终态的重复/矛盾/迟到 Receipt，以及 abandon 后 Receipt。任何终态静默改变即 Stop。

## BC-06 Multi-resource EffectReceipt

决定：Batch Receipt 包含稳定排序的逐资源记录：

```text
resource_operation_id
resource_identity_before / expected_revision
operation
outcome: Applied | NotApplied | Conflict | StillUnknown
resource_identity_after / content_hash_after
provider_error_code / receipt_ref / evidence_ref
```

逐资源 outcome 收敛为 `Applied | NotApplied | Conflict | StillUnknown`；操作错误若能证明未发生归为 NotApplied，无法证明则 StillUnknown。expected resource set 必须与 sealed InvocationSpec 完全相等，每个资源恰好一次；缺失、重复或额外资源使 Receipt 无效并保持 Unknown。

聚合与领域映射：

1. 全部 `Applied` → Effect `Applied`；
2. 全部 `NotApplied` → Effect `Failed`，明确未发生变化；
3. 至少一项 Applied 且存在任意非 Applied → Effect `PartiallyApplied`；
4. 无 Applied 且存在 `StillUnknown` → Effect `Unknown`；
5. 无 Applied/StillUnknown 且存在 `Conflict` → Effect `Unknown`，随后进入 ManualResolutionRequired。

资源数组按 `resource_operation_id` 排序后进入 canonical Hash。Unknown 与 PartiallyApplied 都阻断 Task Succeeded 和后续 Effectful 操作；只有 Broker 对账能推进。UI 的 batch 标题必须取聚合状态，不能以已成功资源数量推断全局成功。

G1 验证：全成功、全失败、首项成功后失败、成功+Unknown、Conflict、重复 resource ID、乱序 Receipt 和崩溃点。

## BC-07 Schema negotiation 与未知字段

决定：安全/权威消息使用封闭 Schema，不进行宽松 coercion。

- Envelope 携带 `protocol_major`、`protocol_minor`、`schema_id`、`schema_version` 和 `required_features[]`；
- Command、DomainEvent、ToolIntent、InvocationSpec、PolicyDecision、Approval、Authorization、Receipt 的未知 major/schema/required feature 一律拒绝或进入 NeedsUpgrade/ProjectionIncomplete；
- 上述对象 `additionalProperties=false`，未知字段不能参与“忽略后继续执行”；
- Backend initialize 先协商双方明确支持的版本交集；无交集即 FeatureDisabled；
- DomainEvent 永不原地迁移；每个 reducer 显式支持版本，迁移使用可审计 upcaster/新事件并验证投影 Hash；
- 只有非权威 DesktopEvent/诊断显示对象可在 minor 版本忽略标为 optional 的字段，且不能由此产生命令或 Effect；
- 未知关键 Schema 时 Projection `complete=false`，全局 Effect Gate 关闭。

G1 验证：未知 major/minor/schema、额外字段、缺字段、类型 coercion、required feature 和 replay 中途遇到未知 Event。

## BC-08 Secret Handle 生命周期

决定：持久化层只保存 `secret_ref`。运行时 Secret Handle 是 SecretBroker 私有表中的随机 256-bit opaque nonce，不可序列化，不提供给 AgentBackend/UI。

`secret_ref` 是可持久化且不含 Secret 的系统凭据引用；下述 `secret_handle` 只是 Broker 内部临时能力。Handle 必须绑定：

```text
purpose + target_identity
workspace/task/run/invocation/effect
invocation_spec_hash
capability_provider_id/version
max_uses=1
monotonic_deadline
```

规则：

- SecretBroker 在 TCB 内完成 Header/协议注入；CapabilityProvider 只获得已封装调用能力，默认不获得 Raw Secret bytes；
- 若某认证 Provider 必须短暂访问 bytes，只能在同进程受信任模块的 zeroizing locked buffer 中使用，退出路径全部清零；
- Handle 在使用、拒绝、取消、scope/spec 变化、Broker restart 或 deadline 后失效；
- 不进入 Command、Event、Outbox payload、Fixture、Args、Env、URL、普通日志、Panic、Crash dump、WebView 或剪贴板；
- 跨 Run、跨 Target、重放和并发第二次消费均拒绝并产生安全事件。

清零承诺限定为受控 buffer zeroize、生命周期审计和 Canary 扫描证据，不宣称物理绝对清除。

G1 验证：canary 全盘/数据库/日志/诊断/备份搜索、过期、跨 Run/Target/Purpose、并发双消费、cancel race、panic 和 crash 注入。任何 canary 持久化或越界即 Stop。

## 决策状态

| ID | G0.5 设计决定 | 仍需 G1 证明 | 建议状态 |
|---|---|---|---|
| BC-01 | JCS + domain-separated SHA-256 | 跨实现 test vectors | Resolved for G0.5 review |
| BC-02 | monotonic deadline + UTC rollback fail-closed | sleep/restart/clock fault injection | Resolved for G0.5 review |
| BC-03 | durable per-scope monotonic fencing | crash/concurrency/old worker tests | Resolved for G0.5 review |
| BC-04 | NTFS Handle identity + reparse/hardlink restrictions | Windows negative tests | Resolved for G0.5 review |
| BC-05 | append late observation; explicit reconciliation only | terminal-state receipt fixtures | Resolved for G0.5 review |
| BC-06 | per-resource closed outcomes + deterministic aggregation | partial/crash fixtures | Resolved for G0.5 review |
| BC-07 | closed authoritative schemas + exact negotiation | version/replay fixtures | Resolved for G0.5 review |
| BC-08 | one-use Broker-private scoped secret handle | canary and crash tests | Resolved for G0.5 review |

## 官方设计依据

- [RFC 8785 JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785.html)及其[已验证勘误](https://www.rfc-editor.org/errata/rfc8785)；
- [FILE_ID_INFO](https://learn.microsoft.com/en-us/windows/win32/api/winbase/ns-winbase-file_id_info)；
- [GetFinalPathNameByHandleW](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfinalpathnamebyhandlew)；
- [CreateFileW 的 symbolic link 行为](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilew)；
- [Reparse Points and File Operations](https://learn.microsoft.com/en-us/windows/win32/fileio/reparse-points-and-file-operations)；
- [BY_HANDLE_FILE_INFORMATION](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/ns-fileapi-by_handle_file_information)；
- [Windows per-directory case sensitivity](https://learn.microsoft.com/en-us/windows/wsl/case-sensitivity)。
