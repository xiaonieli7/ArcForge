# ArcForge MVP PRD V1

状态：Draft for G0 review

目标：Private Alpha

平台：Windows 11 x64、本地 NTFS Workspace

首发 Work Pack：Research & Report V1

## 1. 产品定义

ArcForge MVP 帮助专业用户把本地资料文件夹转化为一份带可追溯引用、可审查、可验证，并经用户批准后保存的报告。

它不承诺完成任意 Work。首版证明以下闭环：

```text
本地 Workspace
→ Goal 与 Acceptance Criteria
→ 数据边界与 Plan
→ 受控读取和调查
→ 隔离生成 Report Artifact
→ 审查报告、引用和 Evidence
→ 用户批准保存
→ ApplyReceipt
→ 用户决定是否形成长期 Memory
```

## 2. 用户问题

- 在 PDF、DOCX、Markdown、TXT、CSV/XLSX 中反复查找；
- 手工记录结论与来源；
- 在聊天、文件管理器和文档工具间切换；
- 无法判断 AI 结论是否来自真实资料；
- 不清楚资料发往哪个模型服务；
- 难以区分 AI 草稿与真实文件修改；
- 难以复用已确认的 Workspace 背景和报告偏好。

ArcForge 的价值不是“上传文件后总结”，而是可追溯、可审查、可恢复的本地工作闭环。

## 3. 目标与非目标用户

主要用户：产品经理、分析师、顾问、研究人员、运营人员和技术项目负责人。

用户需要理解：

- Workspace 是资料边界；
- Provider 可能接收提取后的资料；
- 草稿尚未写入真实 Workspace；
- Citation/Evidence 用于验证；
- 保存、外部 Effect 和长期 Memory 需要授权。

非目标：

- 完全无人值守的普通消费者；
- 企业级多人知识库团队；
- 依赖 OCR、复杂 Excel 或完整 Office 保真编辑的用户；
- 期望自动发送邮件、修改生产系统或操作整个桌面的用户。

## 4. MVP 目标

- 无需逐个打开资料即可生成结构化报告草稿；
- 每个关键 Finding 可追溯到具体文件位置；
- 假设、矛盾、缺失和失效引用清晰可见；
- 文件先在隔离 Task Workspace 生成；
- 真实 Workspace 只在明确审批后写入；
- Apply 中断与外部变化不会导致静默覆盖；
- Core 使用一个 Research & Report Certified 模型；自定义 Provider Beta 只承诺配置、Secret 引用、连接测试和能力检测；
- Memory Candidate 可查看、编辑、拒绝和删除；
- Skills/MCP 有受控实验入口，但不扩大 Work Pack 权限。

## 5. 非目标

- 通用自主 Agent；
- Coding Work Pack；
- 可见多 Agent；
- Web Research；
- OCR、扫描 PDF、PPTX、音视频；
- 编辑源 CSV/XLSX；
- Shell、Computer Use、邮件发送或 SaaS 写入；
- 第三方 Skill/MCP 自动安装执行；
- Checkpoint 核心恢复承诺；
- 云同步、团队、计费和市场。

## 6. 范围

### 6.1 Core

| 模块 | 范围 |
|---|---|
| Home | 初始化 `%USERPROFILE%\.arcforge` |
| Workspace | 添加、扫描、重扫和归档本地文件夹 |
| Source | 格式识别、解析、索引、Hash 与 Citation Locator |
| Task | Goal、Criteria、Plan、AgentRun、取消和恢复 |
| Artifact | 结构化报告、版本、预览和修改请求 |
| Evidence | Citation、验证、警告、假设和矛盾 |
| Execute | 隔离 Workspace 生成 Markdown/DOCX |
| Apply | 路径预览、冲突、审批、Journal 和 ApplyReceipt |
| Provider | 一个 Research & Report Certified Profile |
| Recovery | Event 重放、Apply 对账和诊断 |
| Memory | Candidate 提议、编辑、批准、拒绝和删除 |
| UI | Workspace/Thread/Task、Timeline、Inspector、Composer |

### 6.2 Experimental

| 模块 | Private Alpha 范围 |
|---|---|
| 模型切换 | 只影响下一 Task，当前 Run 快照不可变 |
| 自定义 Provider Beta | 配置、Secret 引用、连接测试和能力检测；未认证模型不得执行 Work Pack |
| Skills | 本地发现、来源/版本/权限、显式启用；脚本禁用 |
| MCP | 配置、Secret 引用和静态校验；HTTP 连接测试等待 Egress Broker，STDIO 连接/Discovery 等待 Process Broker 与 OS 隔离认证；任务执行关闭 |
| Checkpoint | 诊断实验，不代替 Workspace/Apply Journal |
| 多 Agent | Schema 预留 ID，无可见入口 |

### 6.3 禁止能力

```text
shell.execute
process.spawn
computer.use
browser.act
email.send
saas.write
mcp.unverified
workspace.external_read
workspace.source_overwrite_without_approval
```

## 7. 默认决策

- 在隔离区 Render Markdown + DOCX，保存到真实路径统一走 Apply；
- 只支持文本型 PDF；
- CSV/XLSX 只读；
- Web Research 后置；
- 默认输出到 `<Workspace>\ArcForge Output\<任务标题>-<YYYYMMDD-HHmm>\`；
- 默认不覆盖已有文件；
- `ArcForge Output` 默认排除在后续 Source 扫描外；
- 已知 Secret、私钥和 `.arcforgeignore` 命中项默认排除；
- 敏感识别只是提示，不宣传完整 DLP；
- 第一次模型调用前展示 Provider、Endpoint、Model 和发送范围；
- 关闭应用后不后台执行。

## 8. 用户用语

| 内部实体 | UI 用语 |
|---|---|
| Workspace | 工作区 |
| Task Workspace | 隔离草稿区 |
| DocumentArtifact | 报告 |
| Citation | 引用 |
| Evidence | 验证依据 |
| ApplyEffect | 保存到工作区 |
| ApplyReceipt | 保存记录 |
| MemoryCandidate | 待确认记忆 |
| Capability Snapshot | 已启用能力 |
| AgentRun | 本次执行 |

用户状态文案必须区分：

```text
报告已生成，尚未保存
报告已保存到工作区
保存状态未知，需要对账
```

## 9. 核心流程

### 9.1 首次使用

```text
启动
→ 创建/校验 Home
→ 展示本地与 Provider 数据边界
→ 配置模型
→ 连接测试
→ 选择 Workspace
```

### 9.2 Workspace 扫描

```text
选择文件夹
→ 本地扫描
→ 分类支持/不支持/失败/忽略/敏感风险
→ 用户调整并保存 SourceSet
→ 进入任务与 Plan Review
```

扫描不调用模型，保存 SourceSet 也不构成数据外发授权。

### 9.3 任务与 Plan

```text
输入 Goal
→ 提议 Acceptance Criteria
→ 用户编辑确认
→ 通过 `task.prepare_local_plan` 使用本地 Work Pack 模板生成 Plan
→ 用户一次确认 Plan、SourceSet、数据等级、Provider、Model、Endpoint 与 Egress Policy
→ Execute
```

确认成功后形成 Task 范围的 DataBoundaryGrant。第一次 Provider 请求前必须已经持久化该 Grant；任一绑定项变化后重新确认。若未来使用远程模型辅助生成 Plan，也必须先经过相同硬门。

### 9.4 审查与保存

```text
解析/索引
→ 调查/交叉核对
→ 生成结构化报告
→ 验证 Citation/Source Hash
→ 报告可审查
→ 用户接受或要求修改
→ 预览目标/ChangeSet
→ Apply Journal
→ ApplyReceipt
→ Memory Candidate 决策
```

## 10. Task 状态

下列名称是面向用户的 UI Projection，不是第二套领域状态机；合法命令、事件与迁移以 [Domain Model V1](../specs/DOMAIN_MODEL_V1.md) 为准。

| UI Projection | Domain 状态 |
|---|---|
| `draft` | Task `Draft` |
| `scope_review / planning / plan_review` | Task `Planning / Ready` + DataBoundary/Plan Projection |
| `running / validating` | Task `Running` + AgentRun/Artifact Validation Projection |
| `review_ready / apply_review / artifact_stale / apply_conflict` | Task `WaitingReview` + Artifact/Effect Projection |
| `applying` | Task `Running` + Effect `Executing` |
| `completed / failed / canceled` | Task `Succeeded / Failed / Canceled` |
| `recovery_required / effect_unknown` | Task `Unknown` 或 Application Recovery Projection |

```text
draft → scope_review → planning → plan_review
→ running → validating → review_ready
→ apply_review → applying → completed
```

终止：`canceled | failed | discarded`

恢复：`recovery_required | effect_unknown | artifact_stale | apply_conflict`

| 状态 | 主要操作 |
|---|---|
| draft | 编辑 Goal、资料和模式 |
| scope_review | 排除资料、确认、取消 |
| planning | 取消 |
| plan_review | 编辑、确认、取消 |
| running | 取消、查看来源 |
| validating | 取消 |
| review_ready | 审查、修改、保存、放弃 |
| artifact_stale | 查看变化、重验证、重新生成 |
| apply_review | 修改目标、批准、取消 |
| applying | 禁止重复提交 |
| completed | 打开文件、记录、Memory |
| apply_conflict | 重命名、重新审查、取消 |
| recovery_required | 检查恢复摘要、对账；仅无 Effect 歧义时可创建新 Run |
| effect_unknown | 对账或带不确定性放弃；禁止该 Task 的全部 Effectful 操作 |
| failed | 重试、诊断、放弃 |

## 11. 核心用户故事

### US-01 首次启动

显示 `.arcforge` 路径、本地/远程数据边界和 Secret 存储。未配置模型时 Execute 不可用，但不强迫启用 Skills、MCP 或 Memory。

### US-02 添加 Workspace

展示支持、不支持、失败、忽略和敏感风险；可以排除文件；扫描不发送内容；路径逃逸被阻止且可见。

### US-03 确认数据范围

模型调用前展示 SourceSet/Hash、数据等级、Provider、Canonical Endpoint、Model、文件数量、提取规模和 Egress Policy。确认必须形成协议事实；Provider、Endpoint、Model、Redirect Policy 或范围变化后立即失效并重新确认。

### US-04 定义任务

Goal 必填；可提议 2–6 条 Criteria；用户可以编辑排序；至少一条 Criteria 才能执行。

### US-05 审查 Plan

Plan 展示读取范围、步骤、交付物、验证、Provider 数据外发和潜在 Effect，不展示私有推理。Plan 是零资源变更模式，不是零网络模式：远程模型请求仍会产生网络、费用和 Provider 日志。Execute 前真实 Workspace 写入为 0。

### US-06 查看进度

高频文件 Event 聚合；展示阶段、处理数量、警告和耗时；取消 2 秒内反馈；关闭应用时提示停止。

### US-07 审查报告

章节导航、Citation、Assumption、Question、Warning；修改请求产生新 ArtifactVersion；持续显示“尚未保存”。

### US-08 核验 Citation

展示相对路径、页码/章节/行号/单元格、短摘录和 Hash；Source 变化立即 stale；无来源内容标记为假设。

### US-09 保存报告

审批显示 ArtifactVersion/Content Hash、每个目标文件的完整 Workspace 相对路径、操作、格式、大小、目标 Revision/Hash 与新内容 Hash；默认新建；不静默覆盖；Apply 前重校验；成功后有 ApplyReceipt。更改目标、版本、覆盖策略或 Policy 会废弃旧审批。

### US-10 恢复

从 Event Store 恢复；不自动重跑模型或 Effect；Effect Unknown 时先对账，禁止该 Task 的全部 Effectful 操作。

### US-11 模型

Provider/Protocol/Base URL/Model/Secret Ref；连接测试不发送 Workspace 内容；显示认证等级；运行中不换模。

### US-12 Skills/MCP

显示来源、版本、Hash、权限和信任；第三方默认关闭；Skill Script 禁用；MCP 连接成功不等于可以执行。

### US-13 Memory

Candidate 默认待确认；用户可编辑作用域、敏感等级和期限；临时 Thread 不读写长期 Memory；Secret 不得进入。

## 12. 异常与降级

| 异常 | 行为 | 不变量 |
|---|---|---|
| 无 Provider | 阻止 Execute，打开设置 | 不静默换模 |
| 鉴权失败 | 显示错误类别 | 不记录 Secret |
| 超时/限流 | 保留 Task Workspace | 不重复 Effect |
| 模型能力不足 | 显示未认证 | 不伪造成功 |
| 不支持/解析失败 | 显示具体来源 | 不静默忽略 |
| 无有效来源 | 阻止生成 | 不生成无依据报告 |
| Context 超限 | 展示检索/分段策略 | 不静默截断 |
| 敏感风险 | 默认排除 | 需要单独确认 |
| Source 变化 | Artifact stale | 禁止直接 Apply |
| 目标已存在 | 冲突页 | 不静默覆盖 |
| 磁盘满/权限失败 | 逐文件结果 | ApplyReceipt 如实记录 |
| Apply 崩溃 | 启动对账 | 不重复写入 |
| Event Store 损坏 | 只读恢复 | 不继续 Effect |
| Workspace 丢失 | 重新定位/移除 | 不猜测路径 |

## 13. 验收门

### 功能

- 支持格式正确进入 SourceSet；
- 不支持/忽略/失败 100% 可见；
- 报告形成结构化 Artifact；
- Markdown/DOCX 符合人工基线；
- Finding 可跳转来源；
- 修改和放弃不改变真实 Workspace；
- Apply 全部状态有 ApplyReceipt/对账；
- 重启不自动重复 Provider 请求或 Effect。

### 质量

- Citation 覆盖率 ≥95%：有至少一个有效 Citation 的关键事实 Finding / 人工标注的全部关键事实 Finding；
- Citation 错误来源 <2%：来源不能支持对应 Claim 的 Citation / 人工审计 Citation；认证样本至少审计约 200 条 Citation；
- Acceptance Criteria 覆盖率 ≥90%；
- 无来源事实标记率 100%；
- Artifact 保留或小改后保留率目标 ≥70%；“仅小改”按预定义结构修改 Rubric 和编辑时长判断。

### 安全 Stop Ship

- 未审批 Workspace 写入：0；
- Workspace 外读取：0；
- 路径逃逸：0；
- Plan 外部业务 Effect：0；
- Secret 泄露：0；
- Unknown 状态重复 Apply：0；
- PartiallyApplied 批次显示为全局成功：0；
- 外部修改静默覆盖：0。

### 体验

- ≥80% 无帮助完成 Workspace → Report → Review → Save；
- ≥90% 判断是否已经保存；
- ≥90% 指出 Provider/Endpoint；
- 重复任务阻塞审查中位数 ≤2：合并的数据边界/Plan Review 与 Apply Review；首次 Provider Onboarding 单独统计；
- 首次 UI 反馈 <500ms；
- 取消反馈 P95 ≤2 秒；
- 10,000 Event 投影目标 ≤5 秒。

## 14. 指标

北极星：`Verified Work Completed / Weekly Active User`。

计数条件：Artifact 通过必需验证、用户接受、对应 Apply Effect 为 `Applied`，且 ApplyReceipt 中每个目标资源均为 `Applied`、Criteria 可追溯。V1 不提供绕过 Apply 的“合规导出”捷径。

核心漏斗：

```text
workspace_added → source_set_saved → data_boundary_and_plan_accepted
→ artifact_review_ready → artifact_reviewed_accepted
→ apply_succeeded
```

`artifact_reviewed_accepted` 是对领域事件 `artifact.reviewed { decision: accepted }` 的指标投影，不是另一种领域事件。

`memory_decided` 是 Apply 后的可选分支，单独统计，不是任务完成条件。

遥测默认不含 Goal、文件名、内容、摘录、Memory 或 Secret。

## 15. 阶段

| 阶段 | 交付 | Go 条件 |
|---|---|---|
| G1 | Mock Runtime、Event Store、UI、投影恢复 | UI 只用结构化 Event |
| G2 | Read/Provider Egress/Secret Broker、文件读取、索引、报告、引用、认证模型 | 真实写入、Runtime 通用网络和第三方执行为 0 |
| G3 | Task Workspace、Apply、冲突、Journal | 未授权写入和重复 Effect 为 0 |
| Private Alpha | 5–10 名设计伙伴、至少 10 个真实 Workspace 和 20 个可计量任务 | 质量、安全、理解度达标 |
