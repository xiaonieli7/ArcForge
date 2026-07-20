# Codex 桌面产品基准与 ArcForge 对齐分析

状态：G0 research baseline

基准日期：2026-07-17

## 1. 目的与证据边界

本文回答三个问题：

1. 当前公开 Codex/ChatGPT 桌面体验中，哪些产品模式值得 ArcForge 借鉴；
2. 哪些模式是 Coding/Git 特有实现，不能直接复制到通用 Work Agent；
3. ArcForge V1 应对齐到什么程度，哪些能力必须延后或重新定义。

证据来自 2026-07-17 获取并校验为 current 的官方 Codex Manual 及其引用页面。官方公开资料能够证明功能与安全语义，但不能替代真实客户端的像素、动效、空态和异常态走查。因此本文是产品/交互基准，不是视觉抄袭说明，也不声称掌握 Codex 内部协议或私有文件格式。

## 2. 当前 Codex 产品模式

### 2.1 项目、Chat 与 Composer 是桌面主骨架

官方桌面命令文档公开了打开文件夹、切换 Sidebar、打开 Review Tab/Panel、切换底部 Terminal、新建/搜索 Chat，以及 Composer 中的命令入口。这说明 Codex 的桌面骨架不是单一聊天窗，而是“项目上下文 + 多 Chat + 工作面板 + Composer”。

ArcForge 对齐：

- 左侧使用 Workspace / Thread / Task，而不是只显示对话标题；
- 中间保留 Goal、Plan 和结构化 Activity；
- 右侧从 Coding Diff 扩展为 Artifact / Source / Evidence / Action；
- 底部 Composer 保持轻量，模型和能力放入二级入口；
- Core MVP 不默认展示 Terminal，因为首发英雄场景不是编码。

证据：[ChatGPT desktop app commands](https://learn.chatgpt.com/docs/reference/commands)

### 2.2 Plan 是工作流，不自动等于安全边界

官方 Best Practices 将 Plan Mode 定义为先收集上下文、提问并形成实施计划；安全文档则把 sandbox mode 和 approval policy 作为独立控制，并建议在只聊天或规划且不希望修改时使用 read-only 权限。

ArcForge 不能只复制一个 `Plan` 标签。V1 必须把 `run_mode` 和 `mode_policy_hash` 送入 Core/Broker，由 Policy 强制：

- 允许不可变 Snapshot 读取；
- 允许有效 DataBoundaryGrant 下的 Provider Egress；
- 拒绝真实 Workspace 写入、Process/Shell、STDIO MCP、外部业务系统修改和 Memory Persist。

因此 ArcForge 的差异不是“也有 Plan Mode”，而是“Plan 的零资源变更可以由协议和 Broker 验证”。

证据：[Best practices](https://learn.chatgpt.com/guides/best-practices)、[Agent approvals & security](https://learn.chatgpt.com/docs/agent-approvals-security)

### 2.3 Review/Diff 是 Codex 的核心信任界面

官方 Code Review 文档说明 Review Pane 可以查看变更、给出行级反馈，并决定 stage、revert、commit 或 push；它展示整个 Git 工作区状态，而不只是 Codex 产生的改动。这一设计把“生成”与“用户判断”分开，也显式面对用户/工具并发修改。

ArcForge 对齐：

- 把 Review Pane 抽象为类型化 Deliverable Inspector；
- 代码使用 Diff Renderer，报告使用文档/Citation Renderer，表格使用 Grid/Cell Change Renderer；
- Review 绑定精确 ArtifactVersion 和 Content Hash；
- Artifact Accept 不等于 Apply，Apply 不等于 Task Succeeded；
- Source 或目标变化后旧 Preview/Approval 失效。

ArcForge 不复制 Git stage/revert 作为通用语义，而使用 ArtifactVersion、ChangeSet、ApplyReceipt 和 Evidence。

证据：[Code review](https://learn.chatgpt.com/docs/code-review)

### 2.4 Worktree 证明了“任务隔离环境”的产品价值

官方 Worktrees 文档说明 Codex 可以为同一 Git 项目的多个 Chat 创建独立工作树，支持 Local/Worktree Handoff、后台工作、快照恢复和清理；同时它明确依赖 Git。

ArcForge 借鉴的是“一个工作执行对应一个隔离环境”，而不是把 Git Worktree 直接提升为通用领域对象：

- Research & Report 使用只读 Source Snapshot + 隔离输出目录；
- Coding Work Pack 可以使用 Git Worktree；
- 其他文档任务可使用受控副本或 Overlay；
- 所有模式统一映射到 `task_workspace_id` 和 ChangeSet；
- Task Workspace 解决审查、冲突和恢复，不被宣传为 OS Sandbox。

证据：[Worktrees](https://learn.chatgpt.com/docs/environments/git-worktrees)

### 2.5 Sandbox 与 Approval 是两个不同控制面

官方安全文档区分 sandbox（能接触什么）与 approval policy（何时停下来问用户），并说明本地客户端使用 OS 强制机制、默认网络受限；桌面 Windows 文档还区分 native PowerShell Windows sandbox 与 WSL2 sandbox。

ArcForge 对齐并进一步收窄：

- UI 审批不是安全边界；
- Trusted Execution Broker 重新规范化 ToolIntent；
- Approval 绑定 sealed InvocationSpec、资源版本、Preview Hash、次数和期限；
- Task Workspace、DACL 和 Job Object 都不等于 Sandbox；
- 具有直接环境能力的 Grok Build/STDIO MCP 未进入经验证 OS 隔离时禁止启动。

证据：[Agent approvals & security](https://learn.chatgpt.com/docs/agent-approvals-security)、[ChatGPT desktop app for Windows](https://learn.chatgpt.com/docs/windows/windows-app)、[Windows sandbox](https://learn.chatgpt.com/docs/windows/windows-sandbox)

### 2.6 配置、Home 与自定义 Provider 是分层系统

官方配置文档将 `$CODEX_HOME` 定义为 config、auth、logs、sessions、skills 等状态根，并区分用户配置与受信任项目的 `.codex/config.toml`。官方文档也支持自定义 model provider、Base URL、wire API 和认证方式。

ArcForge 对齐：

- 使用独立的 `%USERPROFILE%\.arcforge`，不复制 Codex Schema；
- 分离用户私有状态、Workspace 可共享配置和 Task 快照；
- Secret 真值进入 Windows Credential Manager/DPAPI 系统密钥库；
- 支持自定义 Provider 配置，但不把“能连接”宣传为“能完成 Work Pack”；
- 使用 `Connectivity Checked / Plan Eligible / Research & Report Certified / Coding Certified` 能力分级。

证据：[Advanced configuration](https://learn.chatgpt.com/docs/config-file/config-advanced)、[Environment variables](https://learn.chatgpt.com/docs/config-file/environment-variables)

### 2.7 Skills、MCP 与 Memory 是互补扩展面

官方 Customization 文档将 `AGENTS.md`、Memories、Skills、MCP 和 Subagents 作为不同层：Skills 封装可复用流程，MCP 提供外部工具/上下文。官方 MCP 文档支持本地 STDIO 和 Streamable HTTP；官方 Memories 文档说明本地 Memory 默认关闭、存于 Codex Home，并可按 Chat 控制使用/生成。

ArcForge 的产品调整：

- Skill 是工作流/知识，不拥有额外权限；
- Skill Script 在 Core Alpha 关闭；
- MCP 配置成功、连接成功、Tool 可用和单次执行授权必须是四个不同事实；
- STDIO 的连接本身就是 Process Effect；
- Memory 默认由 Agent 提议为 MemoryCandidate，用户确认后才持久化；
- Memory 不能成为系统指令、Capability 或 Secret 容器。

ArcForge 选择比当前 Codex 自动 Memory 更保守的显式确认模型，这是安全与可解释性差异，不是功能缺失。

证据：[Customization](https://learn.chatgpt.com/docs/customization/overview)、[Build skills](https://learn.chatgpt.com/docs/build-skills)、[Model Context Protocol](https://learn.chatgpt.com/docs/extend/mcp)、[Memories](https://learn.chatgpt.com/docs/customization/memories)

### 2.8 多 Agent 已是 Codex 可见能力，但不应成为 ArcForge MVP 门槛

官方 Subagents 文档说明当前本地 Codex 客户端可以显示子 Agent Activity/Thread，并支持不同模型、sandbox、MCP 和 Skills 配置；同时每个子 Agent 会增加 Token、资源和协调成本。

ArcForge 只借鉴可归因性和上下文隔离：

- V1 Event 预留 `agent_id`、`parent_run_id`、`delegation_id`；
- 子 Agent 权限、预算和数据范围只能缩小；
- Core Private Alpha 默认 capability=`none`；
- 不提前实现可见 spawn/handoff/wait API；
- 先验证只读并行，再考虑独立 Task Workspace 写入和合并。

证据：[Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)

## 3. 功能对齐矩阵

| 产品能力 | Codex 公开体验 | ArcForge 决策 | 阶段 |
|---|---|---|---|
| Project/Folder | 以项目/本地路径组织 Chat | Workspace 是受控资源边界 | Core |
| Chat/Thread | 多 Chat、搜索、归档、并行 | Thread 承载协作，Task 承载可验收目标 | Core |
| Composer | Prompt、附件、模式与快捷入口 | 默认只保留任务输入、Plan/Execute、上下文摘要 | Core |
| Plan | 先收集上下文与形成实施计划 | Broker 强制零资源变更；数据外发需 DataBoundaryGrant | Core |
| Activity | 显示 Agent/子 Agent/工具工作 | 只显示结构化、聚合、可解释 Activity | Core |
| Review Pane | Git Diff、行级反馈、stage/revert/commit/push | 类型化 Artifact/Source/Evidence/Action Inspector | Core |
| Worktree | Git Chat 隔离、Handoff、快照恢复 | 通用 Task Workspace；Coding 才使用 Git Worktree | Core foundation |
| Sandbox/Approval | OS sandbox 与 approval policy 分离 | Trusted Broker + OS 隔离 + sealed Approval | Core foundation |
| Integrated Terminal | 桌面一级工作面板 | Core MVP 不展示，安全认证后再开放 | Post-Core |
| Model/Profile | 模型选择、配置和自定义 Provider | 一个认证模型；自定义 Provider Beta 分级 | Core + Experimental |
| Skills | 全局/Repo Skill，可带脚本/引用 | 发现和显式启用；脚本关闭 | Experimental |
| MCP | STDIO/HTTP/OAuth/Tool | 配置/静态校验先行，连接和执行逐能力认证 | Experimental |
| Memory | 本地、按 Chat 控制、后台生成 | 显式 MemoryCandidate 审查后持久化 | Core conservative |
| Multi Agent | 可见子 Agent Thread 与活动 | Schema/权限门预留，默认关闭 | Post-MVP |
| Browser/Computer Use | 桌面独有能力与网站确认 | 非 Core，未来作为 CapabilityProvider | Post-MVP |
| Scheduled tasks | 可在 Local/Worktree 后台运行 | 关闭应用即停止，自动化后置 | Post-MVP |
| Coding Runtime | Codex 自身 Coding Agent | Grok Build 仅为候选 Adapter | Independent certification |

## 4. UI 对齐边界

### 必须对齐

- 项目/Workspace 与 Chat/Task 的快速切换；
- Composer 的低认知负担；
- Plan 与 Execute 的明显状态；
- 运行中的聚合 Activity、取消和后续输入；
- 右侧 Review/Inspector 的可展开深度；
- 草稿、真实修改和恢复状态的持续可见性；
- 设置中的模型、Skills、MCP、Memory 与安全边界。

### 必须重新设计

- Codex Diff 只能覆盖代码；ArcForge 需要 Artifact Renderer Registry；
- Git Worktree 只能覆盖 Git；ArcForge 需要通用 Task Workspace；
- Codex 的代码完成判断偏向测试/Diff；ArcForge 必须使用 AcceptanceCriteria + Evidence + EffectReceipt；
- 通用 Work 的外部 Effect 往往不可回滚，不能用 Checkpoint 暗示全局撤销；
- Provider Egress 需要作为独立数据边界，而不是藏在模型选择里。

### 明确不复制

- OpenAI/Codex 商标、名称、图标、配色、字体、视觉资产或 `codex://` 深链；
- Codex 私有 Schema、Session 格式、内部协议和未公开行为；
- 把 Terminal、Git、Diff 或某个 Runtime 作为所有 Work 的中心；
- 未经认证就宣称与任意 Provider、Skill、MCP 或任务兼容。

## 5. G0 尚需完成的真实客户端调研

官方文档不足以冻结 Hi-Fi UI。进入 G1 前还需在当前 Windows 客户端完成并记录：

1. 新建 Workspace/Chat、切换 Plan、执行、取消和恢复的完整录屏；
2. Sidebar、Composer、Review Panel、Terminal 和 Settings 的尺寸/折叠/空态；
3. Diff 行级反馈、Stage/Revert/Commit/Push 的信息层级；
4. Worktree 创建、Handoff、冲突、清理和恢复提示；
5. 模型切换、MCP 连接、Skill 启用、Memory 控制和审批卡的异常路径；
6. Windows Sandbox、网络审批和 Workspace 外动作的实际提示；
7. 至少 5 名目标用户使用 ArcForge 线框完成同类任务的对比测试。

验收结果应更新 UI Wireframes，而不是把 Codex 截图直接转成 ArcForge 视觉稿。

## 6. 产品结论

ArcForge 应对齐 Codex 的“任务上下文、Plan、可见执行、Review、扩展配置”产品骨架，但不做 Codex 的通用外壳。

真正值得形成独立价值的部分是：

> Windows-first、Provider-neutral、Review-first 的通用 Work Kernel：用 Artifact、Evidence、DataBoundary 和 EffectReceipt，把非编码工作也变成可审查、可验证、可恢复的完成闭环。

若隔离 Task Workspace、Trusted Broker、DataBoundaryGrant 和恢复对账无法做好，ArcForge 就不应开放 Execute；仅靠复制 Codex 的三栏 UI 或换成 Grok Build Runtime，不足以成立。

## 7. 官方来源

- [ChatGPT desktop app commands](https://learn.chatgpt.com/docs/reference/commands)
- [ChatGPT desktop app settings](https://learn.chatgpt.com/docs/reference/settings)
- [Best practices](https://learn.chatgpt.com/guides/best-practices)
- [Agent approvals & security](https://learn.chatgpt.com/docs/agent-approvals-security)
- [Code review](https://learn.chatgpt.com/docs/code-review)
- [Worktrees](https://learn.chatgpt.com/docs/environments/git-worktrees)
- [ChatGPT desktop app for Windows](https://learn.chatgpt.com/docs/windows/windows-app)
- [Windows sandbox](https://learn.chatgpt.com/docs/windows/windows-sandbox)
- [Advanced configuration](https://learn.chatgpt.com/docs/config-file/config-advanced)
- [Customization](https://learn.chatgpt.com/docs/customization/overview)
- [Build skills](https://learn.chatgpt.com/docs/build-skills)
- [Model Context Protocol](https://learn.chatgpt.com/docs/extend/mcp)
- [Memories](https://learn.chatgpt.com/docs/customization/memories)
- [Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)
