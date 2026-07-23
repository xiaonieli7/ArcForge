# ArcForge G0 用户研究与英雄场景验证计划 V1

状态：Ready for execution

## 1. 研究目标

验证唯一英雄场景：

> 本地资料文件夹 → 带引用报告 → 审查 → 保存并获得 ApplyReceipt。

研究重点不是用户是否“喜欢 AI 报告”，而是 ArcForge 相比“文件管理器 + Word/Markdown + 当前聊天模型”是否显著降低完成或核验成本，并且用户能正确理解资料范围、Provider 外发、Artifact、真实 Workspace 和 Apply 状态。

必须回答：

1. 目标用户是否稳定发生多资料整合、来源核验和报告交付任务；
2. 价值来自初稿速度，还是 Citation、Evidence、Review 和安全 Apply；
3. 两次核心阻塞审查是否可接受；
4. 用户能否区分 Artifact Accepted、Effect Applied 与 Task Succeeded；
5. 用户是否愿意用真实但可脱敏材料进入 Private Alpha。

## 2. 样本与筛选

招募 15 人，目标获得至少 12 份有效样本：

- 5 名软件/产品研发人员；
- 4 名产品、项目、咨询人员；
- 3 名研究、运营或分析人员；
- 最多追加 3 名企业 IT、安全或合规协作角色。

硬筛选条件：

- Windows 11 x64 为主要工作环境，每周使用不少于 20 小时；
- 每月至少两次从 5 个以上本地文件形成报告或评审材料；
- 最近 30 天实际使用过文件管理器、Word/Markdown、搜索或 AI 工具完成类似任务；
- 能提供真实、可授权且可脱敏的资料包；
- 愿意录屏、Think Aloud，并允许记录操作级事件。

排除只表达兴趣但过去 60 天无真实任务、主要使用其他操作系统、材料禁止录屏/模型处理，或核心需求实际为 Coding/SaaS 自动化的参与者。

筛选必须询问最近一次任务的时间、文件数、格式、耗时、工具、核验方式和返工点，不能只问意愿。

## 3. 两周执行流程

### 阶段 0：招募与材料审核，30 分钟

- 签署研究参与、录屏和材料处理三份独立同意；
- 检查资料是否符合首轮安全等级；
- 记录现有工作流和最近一次基线；
- 完成脱敏、SourceSet 与数据边界确认。

### 阶段 1：情境访谈与基线任务，60–90 分钟

- 重建最近一次真实任务；
- 使用现有工具完成缩小但完整的任务，或回放真实证据；
- 记录时间、工具切换、核验动作、错误、返工和主观负担。

### 阶段 2：ArcForge 概念验证，90–120 分钟

未有运行产品时使用可点击原型与 Wizard-of-Oz，但人工模拟步骤和耗时必须单独标记，不能计入性能指标。

任务路径：

1. 导入真实脱敏资料；
2. 创建 Goal 和 Acceptance Criteria；
3. 审查 SourceSet、DataBoundary、Provider/Endpoint 和 Plan；
4. 观察执行、Citation 和 Evidence；
5. 审查报告并主动寻找问题；
6. 接受或拒绝 Artifact；
7. 审查 Apply 目标与冲突；
8. 保存并查看 ApplyReceipt；
9. 回答当前真实 Workspace、外发范围和 Task 状态。

### 阶段 3：5–7 天 Diary

选择至少 6–8 人使用 1–2 个额外真实任务，记录耗时、材料数、引用问题、修改次数、阻塞审批和替代工具；结束后进行复访。

## 4. 任务材料

每人使用两类任务：

- 真实脱敏任务：5–30 个文件、至少两种格式，包含版本、重复或矛盾之一；
- 标准夹具：8–12 个文件，包含 2 个版本冲突、1 个过期资料、1 个解析失败、1 个敏感或排除项，以及 8–10 个带 locator 的金标准结论。

标准夹具用于跨用户比较准确率；真实任务用于验证价值和迁移意愿，二者不得混算。

## 5. 测量指标

- 总时间、主动时间、等待时间和达到可交付质量时间；
- 打开文件、搜索、复制粘贴和应用切换次数；
- 正确结论、遗漏、矛盾发现和返工次数；
- 正确引用、错引、漏引、过期引用和 locator 可打开率；
- 最终采用比例、阻塞审查次数和每次耗时；
- 7 分认知负担与信任校准；
- Provider/Endpoint、外发范围和 Apply 前 Workspace 状态理解；
- Accepted、Applied、Succeeded、PartiallyApplied 和 Unknown 的理解。

若基线来自回忆，必须标记 `recalled`，不得与现场测量混算。

## 6. 数据授权与保留

首轮只允许 L0 合成/公开资料和 L1 已脱敏内部资料。L2 机密或个人数据，以及 L3 法律、医疗、财务监管或客户秘密禁止进入。

- 用户与研究员共同确认 SourceSet；
- 姓名、邮箱、Token、客户名、合同号、内部 URL 等由用户脱敏；
- 使用研究专用账号、Windows 用户和工作目录；
- 明确 Provider、Model、Endpoint、保留和训练政策；
- 原始资料建议 7 天内删除，脱敏记录保留 90 天；
- Raw Secret、文件全文和真实身份不进入遥测；
- 删除覆盖材料、录屏、转录、导出与备份索引，并保留删除证明；
- 不读取或复制参与者真实 `.codex`、浏览器会话或凭据。

## 7. G0 决策门

至少 12 个有效样本后，全部满足才建议 G0 产品方向 Go：

- 至少 8/12 每月真实发生该任务两次以上；
- 至少 8/12 对英雄场景价值评分达到 5/7，并能指出被替代步骤；
- 至少 6/12 愿意在 14 天内带第二个真实任务继续使用；
- 至少 5 人同意以真实脱敏材料加入 Private Alpha；
- Citation precision 不低于 90%，locator 可打开率不低于 95%；
- 至少 90% 正确理解 Provider/Endpoint、外发范围和 Apply 前 Workspace 状态；
- 至少 90% 区分 Accepted、Applied 与 Succeeded；
- 100% 不把部分成功或 Unknown 解释为全局成功；
- 重复任务核心阻塞审查中位数不超过两次；
- 无未经确认的材料外发、真实写入或严重边界误导。

价值强信号至少满足一项：

- 达到可交付质量的中位时间降低至少 25%；
- 引用核验主动时间降低至少 40%；
- 时间相当时，金标准事实覆盖率提升至少 20 个百分点且严重错引不增加。

Conditional Go：价值成立但边界理解只有 80–89%，或质量未达认证线。No-Go/Pivot：稳定需求或再次使用意愿低于 50%；价值主要只是快速摘要；两轮后边界理解仍低于 80%；或出现未经授权外发、写入、错误成功提示。

## 8. 单场记录模板

```text
participant_id / date / researcher / observer
role / industry / Windows setup
frequency / last real task date
materials: count, formats, size, sensitivity
consents / provider / model / endpoint

Baseline
active / wait time / tools and versions
files opened / searches / app switches
findings and citations / rework / adopted / workload

ArcForge
onboarding / boundary / plan / execute / review / apply time
blocking reviews / artifact decision
apply state / receipt ref / task state
findings / citations / conflicts / rework / adopted

Comprehension, verbatim answer and pass/fail
what was read / what left device / endpoint
where draft exists / workspace changed before apply
accepted vs applied vs succeeded
partial or unknown interpretation

Outcome
value / trust / named next task
private alpha consent / replacement signal
key quote / researcher interpretation
```

## 9. 研究纪律

- 首次边界理解回答前不得解释正确概念；
- 任务完成前不问“是否喜欢”；
- Wizard-of-Oz 人工操作必须显式标记；
- 每 3 人归类问题，但不在样本中途修改成功阈值；
- 至少 25% 样本进行双人编码复核；
- 所有失败案例保留，只按预定义无效条件排除；
- 开始前登记样本、排除规则、指标公式和 Go/No-Go。

## 10. 执行资产

- [G0 加速决策](../product/G0_ACCELERATION_DECISION_2026-07-20.md)：本轮跳过三人外部 Pilot，改为两次内部 Dry Run；不替代正式 12 人证据门；
- [三人 Pilot 执行手册](G0_PILOT_RUNBOOK_V1.md)：保留为未来研究参考；
- [内部 Dry Run 记录表](templates/G0_INTERNAL_DRY_RUN_LOG.csv)：仅校准流程和计分，不进入产品指标；
- [匿名探索性筛选记录](records/EXPLORATORY_SCREENING_LOG.csv)：只保存无身份信息的筛选结论，不计入样本；
- [参与者记录表](templates/G0_PILOT_PARTICIPANT_LOG.csv)：保存参与者级基线、ArcForge 指标和理解度结果；
- [Citation 审计表](templates/G0_CITATION_AUDIT.csv)：保存 Claim、来源支持、Locator 和排除项审计；
- `fixtures/g0/report-pilot/source`：参与者可见的 11 文件合成 Workspace；
- `fixtures/g0/report-pilot/gold`：研究员专用的夹具清单和 10 条金标准结论。
