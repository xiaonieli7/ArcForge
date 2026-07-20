# G1 Trusted Execution Broker 技术 Spike 计划 V1

状态：Planned，须在 G0 产品证据达到最低门后启动

## 1. 目标与时间盒

G1 是“可信执行可行性门”，不是用户 MVP。时间盒为 5 周，最多 6 周，用 Mock AgentBackend 证明：

```text
Tauri Harness → Application Core → Mock AgentBackend
→ Trusted Execution Broker → Task Workspace / Provider Stub / Secret Stub
→ ChangeSet + Evidence → Apply Approval → ApplyReceipt
→ SQLite append-only Event Store → Recovery/Reconciliation
```

G1 不接 Grok Build、真实 LLM、真实 MCP/Skills/多 Agent，不制作正式 UI，也不承诺安装发布。

建议 Spike Workspace：

```text
apps/desktop-spike/
crates/arcforge-contracts/
crates/arcforge-core/
crates/arcforge-eventstore/
crates/arcforge-broker/
crates/arcforge-win/
crates/mock-agent-backend/
fixtures/g1/
```

Core 不依赖 Tauri 或 OS API；UI 和 AgentBackend 均不属于 TCB；Tauri 只接受窄类型 DTO；Plan Effect Gate 位于 Broker。

## 2. WP0：合同与威胁，第 1 周前半

冻结 `AgentBackend`、`ExecutionBroker`、`EventStore`、`WorkspaceBroker`、`ProcessBroker`、`ProviderEgress`、`SecretResolver`，以及 `InvocationSpec`、`AuthorizationGrant`、`DataBoundaryGrant`、`ChangeSet`、`ApplyReceipt` 和 `ObservedOutcome`。

命令包含幂等键、Run/Invocation/Workspace/Authorization ID 与 fencing token。威胁矩阵覆盖路径穿越、Reparse Point、TOCTOU、进程树逃逸、环境泄密、网络旁路、凭据落盘、重复 Apply、崩溃和 Unknown。

停止条件：授权后 InvocationSpec 仍可修改，或无法区分 Event Store 事实与 Runtime 观察。

## 3. WP1：Core 与 Event Store，第 1–2 周

SQLite 最小表包括 append-only `events`、幂等 `commands`、可重建 `snapshots/projections` 和可选 `outbox`。

验证单事务追加、Optimistic concurrency、确定性重放、未知 Schema fail closed、WAL、锁竞争、磁盘满、只读和崩溃重开。JSONL 只用于诊断。

停止条件：重放不确定，或 Command success 与 Event append 可分裂提交。

## 4. WP2：Mock Backend 与 Golden Fixtures，第 2 周

Mock Backend 只输出声明式 AgentIntent，不获得文件、Shell、网络或 Secret handle。

Fixture 覆盖正常执行、Plan 越权、重复/乱序、过期授权、错误 Workspace、Cancel 后继续、Crash/Reconnect，以及 Backend 声称成功但 Broker 无证据。同一 Fixture 重放 100 次必须产生相同规范事件序列。

## 5. WP3：Workspace、File 与 Apply，第 3 周

仅认证 Windows 11 x64、本地 NTFS。Task Workspace 可用受控复制，但不宣称 OS Sandbox。

负测 `..`、UNC、Device Path、ADS、8.3、大小写混淆、Symlink、Junction 和其他 Reparse Point。ChangeSet 保存 Baseline/Candidate Hash、Operation、Encoding 和 Line Ending。Apply 前检测并发修改；多文件失败必须产生逐资源 Receipt 和 `PartiallyApplied`；在写入、Rename、Event 和 Receipt 前后注入 Crash。

停止条件：路径逃逸，或中断后无法确定资源级状态。

## 6. WP4：Process、Network 与 Secret，第 4 周

Process 只 Allowlist 固定测试命令，使用 Job Object、Env Allowlist、固定 CWD、Timeout 和 Output limit，并测试 Profile/Autorun/PATH 劫持、批处理和重定向逃逸。无法限制时 Shell 为 No-Go。

网络架构只允许 ProviderEgress Stub，负测 DNS、IPv4/IPv6、Loopback、Proxy、Direct IP 和 Redirect。任何绕过即触发 Code Mode Stop。

Secret 只使用 Credential Manager/DPAPI 测试值；不得进入 Event、日志、Fixture、Panic、子进程 Env 或 Args。Handle 过期、跨 Run 和重放必须拒绝。

## 7. WP5：Tauri Harness 与恢复，第 5 周

Harness 仅选择 Fixture、切换 Plan/Execute、展示 Intent/Approval/ChangeSet/Apply/Receipt/Recovery，并注入 Crash、Cancel、Retry 和 Duplicate Command。

在 10–15 个故障点 Kill 进程，重启后 Reconcile。Effect/Apply 结果必须是可证明的 Applied、Failed、PartiallyApplied 或 AbandonedWithUncertainty；Task 是否 Succeeded 另行判断，禁止默认成功。

## 8. 验收物

1. 非产品化 Tauri Harness；
2. Rust Contracts 与 Threat-to-Test 矩阵；
3. SQLite Schema、Migration 0→1 和 Replay 工具；
4. 至少 20 个 Golden Fixtures；
5. 至少 30 个 Windows 负测试；
6. 10–15 个 Crash/Recovery 记录；
7. Audit Log 脱敏报告；
8. Event replay、ChangeSet 和 Apply 性能基线；
9. 每项 Capability 的 Go/Conditional Go/No-Go；
10. Grok Build G5 Adapter 前置合同清单。

## 9. 决策门

G1 Go：Plan 资源变更均被拒绝；未授权、过期、重复 Invocation 无 Effect；Event Store 确定性重放；Apply 冲突、部分成功和崩溃不误报；UI/Backend 无法绕过 Broker；Secret 不落盘；Windows 文件边界可重复证明。

Conditional Go：文件/Apply 通过，但 Process/Network 隔离未通过。只继续资料工作域，Shell、第三方进程和 STDIO MCP 保持关闭。

No-Go：Broker bypass；Effect 无法对账；Unknown 自动成功或自动重试；Apply 覆盖用户变化；Secret 泄漏；安全依赖 UI/Backend 自觉。

Grok Build Adapter 只能在 Broker 合同冻结后开始，避免 Runtime 反向塑造安全边界。
