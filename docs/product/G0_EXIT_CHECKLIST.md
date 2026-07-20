# ArcForge G0 Exit Checklist

状态：In Review

目标：在进入生产代码前，证明 Core Private Alpha 的产品范围、信任边界和验收口径已经收敛。本文不是功能愿望清单，而是 G0 的 Go/No-Go 记录。

## 1. 已收敛的决策方向

| ID | 决策 | 规范来源 | G0 状态 |
|---|---|---|---|
| D-01 | Core Private Alpha 唯一英雄场景为“资料文件夹 → 带引用报告 → 审查 → ApplyReceipt” | MVP PRD / Work Pack | 待签署 |
| D-02 | Coding 是下一认证工作域；Grok Build 仅为候选 Adapter，不阻塞 Core | Product Vision / ADR-0006 | 待签署 |
| D-03 | V1 Run Mode 只有 `Plan | Execute`；Plan 是零资源变更而不是零网络 | Domain / Protocol / Threat Model | 待签署 |
| D-04 | 可写 Task 使用隔离 Task Workspace；它不是 OS Sandbox | ADR-0003 | 待签署 |
| D-05 | Runtime 只提交 ToolIntent；真实动作只由 Trusted Execution Broker 执行 | ADR-0004 | 待签署 |
| D-06 | Provider 外发必须绑定 DataBoundaryGrant；范围或 Endpoint 变化立即失效 | Domain / Protocol | 待签署 |
| D-07 | SQLite append-only Event Table 是唯一领域事实源；Storage Broker 单写 | ADR-0002 | 待签署 |
| D-08 | `%USERPROFILE%\.arcforge` 是默认 Home；Secret 真值进入 Windows 系统凭据库 | ADR-0001 / ADR-0005 | 待签署 |
| D-09 | 自定义 Provider、Skills、MCP、Checkpoint 是非阻塞 Experimental | MVP PRD / Roadmap | 待签署 |
| D-10 | 多 Agent 只预留 ID、预算、权限和 Capability 门，不实现可见 API | ADR-0007 | 待签署 |
| D-11 | Artifact 接受、Apply 和 Task 成功是三个独立事实 | Domain / UI | 待签署 |
| D-12 | Unknown 不自动重试；无法证明结果时只能带不确定性终止 | Domain / Protocol | 待签署 |

“待签署”表示方向已经写入草案，但 ADR 仍为 Proposed；不等同于已通过 G0。

## 2. 文档完整性门

- [ ] PRD、Work Pack、Domain、Protocol、Threat Model、UI 和 Roadmap 对 Core 范围无 P0 矛盾；
- [ ] Domain Model 是状态机唯一规范，其他文档只做映射；
- [ ] Protocol 覆盖所有 UI 中会产生文件、网络、进程、Secret 或 OS 动作的窄类型命令；
- [ ] 每个真实动作都能追溯 `Command → PolicyDecision → Approval（如需）→ Authorization → Effect → EffectReceipt`；
- [ ] 所有 ADR 的决策、替代方案、后果和发布门可审查；
- [ ] 术语表冻结：Workspace、Thread、Task、AgentRun、Artifact、Evidence、Effect、Approval、Source、Citation、ChangeSet、ApplyReceipt、MemoryCandidate；
- [ ] README 能从单一入口发现所有控制文档；
- [ ] Codex 产品基准、功能对齐矩阵、[真实 Windows 客户端走查计划](../research/CODEX_WINDOWS_WALKTHROUGH_PLAN_V1.md)和[执行证据包](../research/CODEX_WINDOWS_WALKTHROUGH_RUNBOOK_V1.md)可追溯；
- [ ] Markdown 校验、链接检查和术语搜索通过。

## 3. 产品证据门

- [ ] 按 [G0 用户研究计划](../research/USER_RESEARCH_PLAN_V1.md)完成 12–15 名 Windows 专业用户的访谈与真实工作观察；
- [ ] 先按 [三人 Pilot 执行手册](../research/G0_PILOT_RUNBOOK_V1.md)完成工具校准；Pilot 结果不计作 G0 Go；
- [ ] 标准夹具的排除项、解析失败、10 条金标准和 Citation 审计经双人复核；
- [ ] 至少 8/12 有效样本每月真实发生资料整合与来源核验任务两次以上；
- [ ] 至少 8/12 对英雄场景价值评分达到 5/7，并能指出被替代的现有步骤；
- [ ] 至少 6/12 愿意在 14 天内带第二个真实任务继续使用；
- [ ] 至少 5 名设计伙伴愿意使用真实材料参加 Private Alpha；
- [ ] 获得至少 10 个可脱敏或可授权使用的真实 Workspace 样本；
- [ ] 记录当前人工流程的耗时、返工点、来源错误和工具切换基线；
- [ ] 验证首个英雄场景相对“聊天模型 + 文件管理器 + Word”有可感知优势；
- [ ] 若价值证据不足，先调整场景或用户群，不进入 G1 扩大平台能力。

## 4. 原型理解度门

使用 UI Wireframes 完成至少 5 次可用性走查：

- [ ] ≥90% 能指出资料将发送到哪个 Provider/Endpoint；
- [ ] ≥90% 能区分“草稿已生成”“内容已接受”“已保存到 Workspace”；
- [ ] ≥90% 能正确解释 Apply Preview 的资源范围；
- [ ] 不把 MCP “连接成功”误认为“已授权执行”；
- [ ] 不把 Plan 理解为完全无网络、无费用；
- [ ] 能理解 Unknown 时为什么不能直接重试；
- [ ] 重复任务的目标阻塞审查路径不超过两次：DataBoundary+Plan Review、Apply Review。

## 5. 安全与可行性门

- [ ] TCB 清单完成：Desktop Rust Core、Storage Broker、Policy Engine、Trusted Execution Broker、Updater；
- [ ] 明确 Task Workspace、Job Object、DACL 与 OS Sandbox 的不同保证；
- [ ] 完成 DataBoundaryGrant、sealed InvocationSpec、Authorization fencing 和 Effect Outbox 的时序评审；
- [ ] 完成 Apply 崩溃点与多文件部分成功的对账演练设计；
- [ ] 完成 Secret canary、路径逃逸、WebView IPC 和 Provider SSRF 测试计划；
- [ ] [Grok Build Runtime Adapter 接纳评估](../runtime/GROK_BUILD_ADAPTER_ASSESSMENT_V1.md)只批准独立 Spike；未证明 Broker/OS 隔离前不进入 Code Execute；
- [ ] Windows 安全门未达标时，Shell、STDIO MCP、任意进程和真实写入保持 Feature Disabled。

## 6. G0 Go / Conditional Go / No-Go

### Go

同时满足：

1. 文档完整性门全部通过；
2. 产品证据门全部通过；
3. 原型没有未关闭的 P0 理解偏差；
4. Trusted Execution Boundary Spike 有可行路径；
5. 负责人接受 22 周是目标窗口而不是公开发布日期。

### Conditional Go

只允许进入 G1 Mock/PoC，且不得读取真实敏感 Workspace 或开放真实 Effect：

- 产品证据已达到最低门，但部分指标仍需 G1/G2 基线；
- Broker 或 Windows Sandbox 方案仍需 PoC；
- 自定义 Provider、Skills、MCP、Checkpoint 或 Grok Build 仍未认证。

### No-Go

任一成立即停止扩大开发：

- 找不到 5 名真实设计伙伴；
- 英雄场景相对现有组合工具没有明确价值；
- Runtime/扩展可以绕过 Broker；
- DataBoundary、Apply Preview 或 Unknown 对账无法由协议强制；
- Windows 路径逃逸、Secret 泄露或未经授权 Effect 不能形成可测试的零容忍门；
- 需要把 Experimental 能力重新塞回 Core 才能让产品看起来有价值。

## 7. 签署记录

| 角色 | 负责人 | 决定 | 日期 | 未关闭条件 |
|---|---|---|---|---|
| Product | 待定 | Pending | — | — |
| Architecture | 待定 | Pending | — | — |
| Security | 待定 | Pending | — | — |
| UX | 待定 | Pending | — | — |
| Engineering | 待定 | Pending | — | — |

所有角色签署后，ADR 可从 Proposed 转为 Accepted，并按 Roadmap 进入 G1。签署不允许覆盖未关闭的 Stop Ship 条件。
