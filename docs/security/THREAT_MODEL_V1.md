# ArcForge Security Threat Model V1

状态：Draft for G0 review

## 1. 范围与承诺

适用：

- Windows 11 x64；
- 本地 NTFS Workspace；
- Research & Report Work Pack V1；
- 自定义 Provider；
- 实验性 Skills、MCP 和 Grok Build Coding Adapter；
- `%USERPROFILE%\.arcforge`；
- Private Alpha。

其中 Skills、MCP 与 Grok Build 只作为默认关闭的 Experimental 威胁面纳入 fail-closed 设计，不是 Core Private Alpha 的发布能力或 Go 条件。

安全目标：

> 即使 Workspace、附件、模型输出、AgentBackend、Skill、MCP、Plugin 或 WebView 内容不可信，它们也不能自行读取未授权资源、获取 Secret、扩大权限或产生未经授权的 Effect。

非目标：

- 防御已控制 Windows 内核、管理员账户或当前用户会话的恶意软件；
- 保证用户选择的 Provider 收到数据后不保存；
- 阻止用户在看到完整风险后主动批准危险操作；
- 将 Job Object 宣传为 Sandbox；
- 使用 Checkpoint 撤销邮件、SaaS 或其他外部 Effect。

## 2. 安全不变量

1. 只有 Trusted Execution Broker 可以执行真实 Effect。
2. WebView、模型、Runtime、Skill、MCP 和 Plugin 都是不可信主体。
3. AgentBackend 只能提交 ToolIntent。
4. 授权绑定 Task/Run、主体、参数 Hash、资源范围、Policy Hash、期限、次数、nonce 和审批者。
5. Intent、目标、模型、Endpoint 或资源范围变化后旧授权失效。
6. Runtime 不直接访问真实 Workspace、`.arcforge` 根目录或 Secret。
7. Secret 不通过普通配置、命令行、Event、Memory、日志或诊断传播。
8. Provider Egress 默认拒绝，不静默跨数据边界回退。
9. 所有文件写入先进入 Task Workspace，Apply 独立审批。
10. Unknown Effect 不自动重试，也不显示为成功。
11. Memory 是不可信上下文，不是权限或系统指令。
12. 未识别协议、Capability 或关键 Schema fail closed。
13. 更新包、Runtime 和扩展执行前验证来源、版本和 Hash。
14. 子 Agent 权限和预算只能继承或缩小。

## 3. Plan 语义

V1 的 Plan 定义为“零资源变更模式”：

> 不改变用户真实 Workspace，不启动或修改用户进程、Shell、MCP 或第三方能力进程，不持久化长期 Memory，也不改变外部业务系统。

Plan 仍可能读取用户选择的不可变资料快照，并在有效 DataBoundaryGrant 下向用户明确选择的模型 Endpoint 发送内容。该请求属于 `DataEgress` Effect，会产生网络、费用和 Provider 日志；它不是 Workspace/业务系统 Mutation。UI 不得宣传“完全无网络副作用”。

`run_mode` 与 `mode_policy_hash` 必须进入 RunSpec、ToolIntent、PolicyDecision、Authorization 和审计。Broker 必须拒绝 Plan 中除已确认 Provider Egress 外的所有 Effect 分类；不能只信任 UI 标签或 Runtime 自报模式。

如果未来提供全零外部副作用模式，只能使用本地模型并禁止网络。

## 4. 关键资产

| 资产 | 主要风险 |
|---|---|
| Workspace 文件 | 越界读取、覆盖、删除、泄露 |
| Task Workspace/ChangeSet | 伪造 Diff、污染 Apply、敏感残留 |
| Artifact/Evidence/Citation | 篡改来源、伪造完成证据 |
| Effect/EffectReceipt | 未授权或重复执行、错误恢复 |
| Provider/Egress Policy | Endpoint 替换、外传、费用失控 |
| Secret/OAuth | 日志泄露、跨主体滥用 |
| Event Store/Approval | 状态伪造、授权重放 |
| Memory | 投毒、跨 Workspace 泄露、过度保留 |
| Skill/MCP/Plugin | 供应链、提权、外传、持久化 |
| Runtime/Grok | 绕过 Broker、协议欺骗、任意进程 |
| 更新包 | 恶意升级、降级、依赖污染 |
| 日志/Crash/诊断 | 二次泄露、未经同意上传 |

数据分类：`Public | Internal | Confidential | Secret`。

- Secret 永不进入模型、Memory、普通 Event 或诊断包；
- Confidential 只发往明确允许该等级的 Provider；
- 自动敏感识别只是提示，不宣传完整 DLP。

## 5. 信任边界

```text
不可信 Workspace/附件
        ↓
受限 Parser / Source Index
        ↓
Application Core
        ↓
Policy Engine → Approval
        ↓
Trusted Execution Broker
├── Workspace/File Broker
├── Provider Egress Broker
├── Secret Broker
├── Process Broker
└── MCP Broker
        ↓
OS / Provider / External System

WebView ─ typed IPC → Rust Core
AgentBackend ─ ToolIntent → Core/Broker
Extension ─ Capability API → Broker
Updater ─ signed manifest → Verified Install
```

## 6. 威胁主体

- 带 Prompt Injection 或恶意结构的 PDF/DOCX/XLSX；
- 恶意或被攻陷的模型 Provider；
- Buggy/过度授权的 Runtime；
- 恶意 Skill、MCP Server、Plugin；
- 伪装的 Provider Endpoint、MCP Tool 或二进制；
- 网络中间人、恶意代理和 DNS 重绑定；
- 同一用户下的恶意进程；
- 供应链和更新服务器攻击者；
- 外部编辑器并发修改；
- 磁盘满、断电、崩溃和协议断流。

## 7. Workspace、文件与 Parser

主要威胁：

- junction、symlink、reparse point、hardlink、ADS、UNC、device path；
- TOCTOU：审查后目标被替换；
- PDF/ZIP bomb、巨型表格、无限解析；
- Office 宏、OLE、外部关系和 Parser RCE；
- 临时副本长期残留。

控制：

- 使用 Handle 获取最终路径、Volume/File ID；
- Apply 前重新验证身份和 Hash；
- 拒绝未批准 UNC、设备路径和外部关系；
- 限制大小、页数、压缩倍率、解析时间、内存和输出；
- 禁止宏执行；
- Parser 尽可能低权限、进程外运行；
- Task Workspace 使用私有 DACL 和保留策略。

`.arcforgeignore` 是产品选择机制，不是安全边界。真正边界由 Broker Allowlist 强制。

## 8. Provider Egress

威胁：SSRF、私网探测、Redirect、DNS 重绑定、隐蔽外传、静默换模和费用失控。

控制：

- 仅允许 HTTP(S)，HTTP 默认只允许明确的 Loopback 开发配置；
- 拒绝 link-local、metadata、multicast 和设备地址；
- 私有网段 Endpoint 必须显式启用；
- 默认禁止跨 Origin Redirect；
- Task 保存 Provider、Model、Endpoint、配置版本和能力快照；
- Provider/Data Boundary 变化需要重新确认；
- 每次 Provider Invocation 绑定 Task 范围的 DataBoundaryGrant，包括 SourceSet/Hash、数据等级、Provider、Model、Canonical Endpoint Origin、Redirect/Egress Policy 和 Consent 版本；任一项变化立即失效；
- 不静默切换到不同费用或数据边界；
- Egress Audit 记录元数据、字节数和数据等级，不记录 Secret 或全文。

## 9. Secrets

- Credential Manager 为首选；必要时使用 DPAPI 密封 Blob；
- 配置只保存 `secret_ref`；
- Raw Secret 只通过窄类型、非 Durable SecretSubmission 交给 Rust Secret Broker；不得进入可持久化 ApplicationCommand 或 WebView Local Storage；
- 禁止通用 `getSecret()`；
- Provider Broker 在发送点消费 Secret；
- Runtime 优先通过受控 Provider Proxy，避免持有 API Key；
- STDIO MCP 只注入该 Server 需要的 Secret，并清理继承环境；
- Secret 不进入命令行；
- 使用 Canary Secret 扫描 Event、Memory、日志、Crash、诊断和备份。

## 10. Skills、MCP 与 Plugin

### Skill

- Skill 不拥有权限；
- Run 使用不可变 Skill Snapshot 和 Hash；
- Registry 保存来源、版本、签名、commit 和 Capability；
- 更新不影响运行中 Task；
- 项目/第三方 Skill 默认显式启用。

### MCP

- MCP Server ID 包含 namespace 和身份指纹；
- `readOnly`/`destructive` 只是提示；
- STDIO 启动是高风险 Process Effect；
- 使用绝对可执行路径和 Hash；
- 展示 Args、CWD、Secret 引用和网络范围；
- Server Origin、Binary 或 Tool Schema 变化后撤销旧审批；
- 限制 Tool 输出大小、频率和嵌套。
- STDIO 连接测试本身就是一次 Process Effect；未通过 Process Broker、一次性审批和 OS 隔离门时，只允许静态配置校验，不得启动进程。

### Plugin

Private Alpha 不加载不受控进程内原生 Plugin，只保留 Registry/Schema 门。

## 11. Runtime 与 Grok Build

- Grok Build 按不可信 Sidecar 处理；
- 固定版本、绝对路径、Hash、签名状态、SBOM 和许可证；
- 只接收结构化协议，不解析 TUI；
- 未知事件、缺失 Run ID 或顺序异常时停止 Effect 能力；
- Sidecar 使用 Job Object 管理生命周期；
- Job Object 不替代 Sandbox；
- Task Workspace 只隔离变更与审查，不是安全 Sandbox；
- Runtime 分为 `TrustedInProcess / RestrictedSidecar / SandboxedThirdParty / ExecutionDenied`；
- Code Mode 只允许两种架构：工具全部经过不可绕过的 Broker，或仍有环境直接能力的 Runtime 位于经验证的受限 Token、AppContainer、Windows Sandbox 或 VM 等 OS 隔离中；
- 两者都无法实现时禁止启动该 Runtime；只有完全没有环境直接权限的 Adapter 才能降级用于 Plan；
- Runtime 风险标记不可信，Broker 重新规范化和分类 ToolIntent。

## 12. Tauri/WebView

- 不加载远程脚本；
- Markdown 严格清洗，禁用任意 HTML；
- 默认禁止远程图片；
- Source 预览使用 Opaque Resource ID；
- CSP、导航 Allowlist、外部链接确认；
- IPC 只提供窄、类型化命令；
- Provider 测试、STDIO MCP 测试、打开文件/文件夹和恢复操作也必须使用窄类型 ApplicationCommand；禁止设置页或 WebView 影子 IPC；
- Rust Core 重验所有参数；
- 过滤 OSC 52、双向文本控制符、危险链接和终端控制序列；
- Broker 生成 sealed InvocationSpec，并由可信 Renderer 根据实际执行字节、二进制 Hash、Args/CWD、Secret 引用、Endpoint 和目标资源生成 Approval 卡片；Provider/Runtime 提供的 Preview 不可信。

XSS 能调用高风险 IPC 是 Stop Ship。

## 13. Memory

- Candidate 默认隔离，确认后才进入长期 Memory；
- Memory 有来源、作用域、敏感等级、置信度、同意状态和期限；
- Memory 作为引用数据，不作为系统指令；
- Memory 不携带 Capability、Approval 或 Secret；
- Workspace Memory 不跨 Workspace 检索；
- 临时 Thread 不读写长期 Memory；
- 远程 Embedding 经过 Egress Policy；
- 删除清理 Blob、索引和缓存并保留无内容 Tombstone。

## 14. 更新与供应链

- App、Runtime、Skill 和 Plugin 使用不同信任清单；
- 更新清单与安装包签名并验证 Hash；
- 禁止未经签名的降级；
- 验证失败继续使用最后已验证版本；
- Runtime 更新不改变运行中的 Task；
- 维护锁文件、SBOM、许可证、漏洞扫描和发布 Provenance；
- 发布前演练密钥轮换、撤销和 Kill Switch；
- 首版不允许任意 URL 更新源。

## 15. Event、日志与诊断

- Event 有 Schema、Sequence、Causation、Correlation 和 Sensitivity；
- Approval、Policy、Effect Prepared/Started/EffectReceipt 必须持久化；V1 的 `Prepared` 精确定义为同一 SQLite 事务中已提交的 `effect.authorized` DomainEvent、Authorization Ledger 与 Effect Outbox，不增加第二套领域状态；
- 普通日志不含 Prompt、文档摘录、Secret 和完整绝对路径；
- Audit/Security 与普通 App Log 分开；
- 诊断包由用户主动创建，可预览和删减，不自动上传；
- Event Store 损坏或协议断流时不得猜测 Effect 成功。
- Outbox 与 Authorization Ledger 只是投递/fencing 操作表，不是第二事实源，不能覆盖已提交 DomainEvent。

## 16. Effect 持久化与恢复

```text
Intent
→ PolicyDecision
→ ApprovalGrant
→ Prepared（`effect.authorized` Event + Authorization Ledger + Effect Outbox 同事务持久化）
→ Execute
→ EffectReceipt | Unknown（持久化）
→ Reconcile
```

- Event Append 与 Effect Outbox 在同一 SQLite 事务；
- 外部 Effect 不承诺 exactly-once；
- Execute 与 EffectReceipt 之间崩溃时为 Unknown；
- Unknown 不自动重试；
- 文件 Apply 使用同目录临时文件、Flush、原子替换和 Journal；
- 多文件 Apply 不宣传全局原子，部分成功逐项对账；
- 已知部分成功进入 `PartiallyApplied`，保存逐资源 EffectReceipt/Evidence，禁止显示全局成功；
- Effectful Task 重启后默认暂停。
- Broker 对账只能依据 Provider EffectReceipt、Apply Journal 和目标资源身份/Hash，结果为 `Applied | NotApplied | PartiallyApplied | Conflict | StillUnknown`；
- 人工无法证明结果时只能记录 `AbandonedWithUncertainty`，不得伪造 EffectReceipt、把旧 Effect 标为可重试或产生新 Authorization；
- 存在 Unknown、Storage Corrupt、NeedsUpgrade 或 Projection Incomplete 时，全局 Effect Gate 关闭，只读查看按状态开放。

## 17. ApprovalGrant

```text
approval_id
scope: TaskRun(task_id, run_id) | SettingsDiagnostic(settings_operation_id) | Recovery(effect_id)
principal_id
intent_hash / preview_hash
resource_scope
policy_snapshot_hash
risk_level / reversibility
nonce / expires_at / max_uses
approved_by
```

规则：

- Artifact 接受与 Apply 是两个动作；
- 高风险 Shell、网络写、STDIO MCP 和不可逆 Effect 不允许永久授权；
- Intent 变化不得复用旧授权；
- 防止双击、重放和多窗口重复提交。

## 18. Feature Flags

```text
workspace.apply
process.spawn
shell.execute
network.external
mcp.stdio
mcp.http
browser.act
computer.use
memory.persist
runtime.grok
external.irreversible
checkpoint
```

每项必须可以独立关闭和紧急 Kill Switch。

## 19. 必做测试

1. junction、reparse、hardlink、UNC、ADS、device path、Unicode 和 TOCTOU；
2. Policy 下层只能缩小权限；
3. Approval 参数替换、过期、重放、跨 Run 和多窗口；
4. 恶意 PDF/DOCX/XLSX、压缩炸弹、宏和解析超时；
5. 文档 Prompt Injection、Citation 投毒和 Memory 持久化；
6. Provider SSRF、DNS 重绑定、Redirect、TLS 和静默回退；
7. MCP 假 Tool、Schema 漂移、输出洪泛、子进程逃逸和 Secret 读取；
8. Runtime 协议乱序、重复、未知事件、断流、崩溃和孤儿进程；
9. WebView XSS、恶意 Markdown、危险链接和 IPC Fuzz；
10. Canary Secret 全链路扫描；
11. SQLite/WAL 损坏、磁盘满和迁移失败；
12. Apply 各状态点崩溃注入；
13. Unknown Effect 对账；
14. 更新签名、Hash、降级和撤销；
15. Memory 跨 Workspace、删除、过期和 Embedding Egress；
16. 大文件、Event 洪泛、费用和磁盘 DoS 上限。

## 20. Stop Ship

出现任一项即禁止发布相关能力：

- 未经授权真实 Effect；
- Workspace 外读写或路径逃逸；
- Plan 修改用户资源或外部业务系统；
- Approval 可替换、重放或跨 Run；
- Secret 进入不允许的存储或错误 Endpoint；
- Runtime/Skill/MCP/Plugin 绕过 Broker；
- Unknown Effect 自动重试或显示成功；
- PartiallyApplied 批次显示为全局成功或丢失逐资源结果；
- 未签名/Hash 不符二进制被执行；
- WebView/XSS 能调用高风险 IPC；
- Memory 未经同意持久化或跨 Workspace 泄露；
- Apply 覆盖审查后已变化的目标；
- Sidecar/MCP 子进程无法回收；
- Event Store 损坏后仍猜测状态执行；
- 诊断数据未经确认自动上传；
- UI 展示的目标、Endpoint、Preview 或风险与 Broker 实际执行不一致。
