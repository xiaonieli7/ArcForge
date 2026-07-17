# ArcForge 产品愿景

## 1. 一句话定位

ArcForge 是一款面向 Windows 专业用户的、本地优先 Work Agent 桌面工作台：帮助用户把数字化工作目标转化为可审查、可验证、可追溯的交付结果。

## 2. 为什么不只做编码

用户的真实工作通常跨越：

- 阅读本地文件和外部资料；
- 形成分析、方案和报告；
- 处理表格与结构化数据；
- 修改代码并运行测试；
- 更新工单、邮件或业务系统；
- 委派、跟踪和汇总多个子任务。

代码只是 `Artifact` 的一种，Shell 只是 `Effect` 的一种，测试结果只是 `Evidence` 的一种。产品模型不能被 Git、终端或 Grok Build 限制。

## 3. Work 的边界

ArcForge 只承诺完成可界定、可交付、可验证的数字工作。

| Work 类型 | 示例 | 结果 |
|---|---|---|
| Understand | 阅读、搜索、比较、分析 | 结论、引用、证据 |
| Create | 报告、表格、代码补丁、邮件草稿 | 可审查 Artifact |
| Act | 写文件、运行命令、更新 SaaS | Effect 与 Action Receipt |
| Coordinate | 拆解、委派、等待、汇总 | Work Graph 与汇总结果 |

“Agent 输出了一段话”不自动等于完成工作。任务完成必须满足用户定义的 Acceptance Criteria，并有 Artifact、Evidence 或 Effect Receipt 支撑。

## 4. 首发用户

首发用户按工作方式而不是职业划分：

- 使用 Windows 11 处理本地文件、网页或 SaaS；
- 工作以项目或任务组织；
- 愿意审查计划、来源、交付物和高风险操作；
- 对隐私、权限、成本和结果可追溯有要求；
- 能理解 Workspace、Provider 和外部数据边界。

典型用户可以是产品经理、分析师、顾问、研究人员、运营人员和开发者。第一版不面向需要完全无人值守自治的普通消费者。

## 5. 第一版英雄场景

### 5.1 主场景：文件夹到报告

用户选择包含 PDF、Markdown、文本、CSV/XLSX 等材料的 Workspace，并给出目标。ArcForge：

1. 建立材料清单和来源索引；
2. 与用户确认计划、验收标准和数据边界；
3. 调查、归纳和交叉核对；
4. 在隔离 Task Workspace 中生成报告草稿；
5. 展示交付物、引用、缺失信息和检查结果；
6. 用户审查后保存到真实 Workspace；
7. 提议可复用的 Workspace Memory。

### 5.2 第二认证场景：Issue 到代码补丁

1. 调查代码与约束；
2. 形成计划；
3. 在隔离 Workspace 修改代码；
4. 运行受控构建或测试；
5. 展示 Diff 与测试 Evidence；
6. 用户应用、修改或放弃 ChangeSet。

Grok Build 是这一场景的 Candidate Coding Runtime，必须通过协议、安全、取消、恢复和模型兼容认证后才能进入 Code Mode。

## 6. 产品原则

1. 以结果为中心，而不是以聊天为中心。
2. 所有真实副作用必须可见、可授权、可审计。
3. 先在隔离 Workspace 生成交付物，再应用到真实目标。
4. UI 状态来自结构化事件，不解析模型文本推断状态。
5. 本地工作区执行不等于数据绝不出网；Provider 和 Connector 数据边界必须可见。
6. Memory 不等于聊天记录，长期记忆必须有来源、作用域、敏感级别和删除能力。
7. Skill 是可复用工作流，不是额外权限。
8. MCP、Browser、Computer Use 和 Runtime 都必须经过统一 Capability Policy。
9. 不宣传任意模型、任意 MCP 或任意任务都兼容；按能力矩阵认证。
10. 子 Agent 权限只能继承或缩小，不能扩大。

## 7. UI 信息架构

```text
左侧：Workspaces / Threads / Tasks
中间：Goal / Plan / Activity Timeline
右侧：Deliverables / Evidence / Actions
底部：Composer / Mode / Enabled Capabilities
```

Artifacts 使用类型化 Renderer：

- 报告：文档预览、修订和引用；
- 表格：Sheet/Grid 与单元格变化；
- 代码：Diff；
- 浏览器：页面快照与来源；
- 邮件：正文、收件人和发送前预览；
- Computer Use：截图、目标控件和待执行动作。

建议执行策略：

- Ask：不调用工作工具；
- Plan：不改变用户资源和外部业务系统；
- Research：允许受控读取及明确的数据来源；
- Execute：允许经过审批的 Effect。

## 8. 首版范围

### Core

- Workspace、Thread、Task、AgentRun。
- Goal、Acceptance Criteria 和 Plan。
- 结构化 Activity Timeline。
- Artifact、Evidence、Effect 和 Approval。
- 隔离 Task Workspace。
- 一个认证模型与一个自定义 Provider Beta 入口。
- 本地资料读取和带引用报告。
- 任务取消、失败、重启对账和诊断。
- `%USERPROFILE%\.arcforge` 本地状态中心。

### Experimental

- 按下一 Task 切换模型。
- 项目/用户 Skills 的发现、查看和显式启用。
- 少量认证 MCP Server。
- Grok Build Coding Adapter。
- 实验性 Checkpoint。
- 只读多 Agent 调查。

### 后置

- 全桌面无约束 Computer Use。
- 自动发送邮件或修改生产业务系统。
- 任意第三方 Skill/MCP 自动安装。
- 后台长期自治。
- 多 Agent 并行写同一资源。
- 团队、计费、市场和云同步。

## 9. 产品指标

北极星指标：

> Verified Work Completed / Weekly Active User。

任务只有在满足验收标准且交付物/证据已被用户接受后才计入。

配套指标：

- Time to First Verified Outcome；
- Artifact 无需大改接受率；
- Evidence 覆盖率；
- 7 天后交付物保留率；
- 用户人工返工时间；
- 每任务审批次数与等待时间；
- Provider/Runtime 成本与失败率；
- W2/W4 留存；
- 未经授权 Effect、数据越界和凭据泄漏必须为 0。

## 10. 防止通用 Agent 失控

每个可发布场景必须定义：

```text
Input
Output / Artifact
Tools / Capabilities
Potential Effects
Evaluator / Acceptance Criteria
Certified Model + Runtime + Platform
```

ArcForge 的策略是：

> 通用架构、窄场景首发、逐能力认证。
