# ArcForge UI Wireframes V1

状态：Low-fidelity draft for G0 review

## 1. 原则

1. 结果优先于聊天。
2. 默认只显示当前任务需要的信息。
3. 一级模式只有 `Plan / Execute`。
4. 模型与能力是二级摘要，不把 Composer 变成控制面板。
5. 真实 Effect 只在执行前出现审批。
6. “已生成”和“已保存”始终是不同状态。
7. 高频活动聚合，不显示私有推理。
8. 错误必须提供下一步。
9. 不仅依赖颜色表达风险和状态。
10. 用户随时能回答：正在做什么、使用哪些资料/服务、真实 Workspace 是否变化。

## 2. 信息架构

```text
ArcForge
├── Home
├── Workspaces
│   └── Workspace
│       ├── Threads / Tasks
│       └── Workspace Settings
├── Task Workbench
│   ├── Goal / Plan / Activity
│   ├── Deliverable
│   ├── Sources
│   ├── Evidence
│   └── Actions
└── Settings
    ├── Models
    ├── Skills
    ├── MCP
    ├── Memory
    ├── Privacy & Storage
    └── Diagnostics
```

## 3. 全局框架

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│ ArcForge                         当前 Workspace                 设置  窗口控制 │
├───────────────────┬───────────────────────────────────────┬───────────────────┤
│ Workspaces        │ Task Workbench                        │ Inspector         │
│                   │                                       │                   │
│ Workspace A       │ Goal / Plan / Activity / Artifact     │ Deliverable       │
│  ├ Thread 1       │                                       │ Sources           │
│  │  ├ Task A      │                                       │ Evidence          │
│  │  └ Task B      │                                       │ Actions           │
│  └ + 新任务       │                                       │                   │
│                   ├───────────────────────────────────────┤                   │
│ + 添加工作区      │ [输入目标或修改要求……]        [发送] │                   │
│                   │ Plan | Execute · 模型 · 已启用能力    │                   │
└───────────────────┴───────────────────────────────────────┴───────────────────┘
```

- 左栏默认 240px，可折叠；
- 右栏默认 340px，无内容时隐藏；
- 小于约 1100px 时右栏变为抽屉；
- Composer 默认只显示输入、模式和发送；
- 模型/能力点击后展开。

## 4. 欢迎页

```text
┌──────────────────────────────────────────────────────────────────────┐
│ ArcForge                                                  设置       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                 把本地资料变成可验证的交付结果                       │
│                                                                      │
│                      [ 选择资料文件夹 ]                              │
│                                                                      │
│ 文件只会在确认范围后发送给当前模型服务。                             │
│ 报告先生成在隔离草稿区，保存前不会修改原文件夹。                     │
│                                                                      │
│ 最近工作区                                                           │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ 产品规划资料  E:\Work\Product  2 个进行中任务         打开      │ │
│ │ 客户调研      D:\Research      上次使用 2 天前         打开      │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│ 模型状态：已连接 · My Provider / model-x              [管理模型]   │
└──────────────────────────────────────────────────────────────────────┘
```

状态：`first_run_no_provider / first_run_ready / returning_empty / returning_recent / home_migration_required`。

欢迎页不展示 Skills、MCP、多 Agent 或 Grok Build。

## 5. Workspace 扫描与范围确认

```text
┌───────────────────┬───────────────────────────────────────┬───────────────────┐
│ 产品规划资料      │ 扫描资料                              │ 数据边界          │
│                   │                                       │                   │
│ 支持        18    │ 正在本地扫描……                        │ 将发送到          │
│ 不支持       2    │ 已处理 18 / 24                        │ My Provider       │
│ 解析失败     1    │                                       │ api.example.com   │
│ 已忽略       3    │ 12 Markdown · 3 PDF · 2 DOCX · 1 XLSX│ model-x           │
│                   │                                       │                   │
│ [查看全部文件]    │ ! 2 个文件可能包含敏感信息            │ 当前不发送内容    │
│                   │ ! 2 个格式不受支持                    │                   │
│                   │                                       │ [更改模型]        │
│                   │ [.arcforgeignore]                     │                   │
│                   │ [取消]        [保存资料选择并继续]    │                   │
└───────────────────┴───────────────────────────────────────┴───────────────────┘
```

范围列表：

```text
24 个文件：18 纳入 · 2 不支持 · 1 失败 · 3 忽略

[✓] requirements.docx             可读取
[✓] research\market.pdf           可读取
[ ] secrets\credentials.txt       可能敏感 · 已排除
[ ] slides.pptx                    不受支持
[ ] broken.pdf                     解析失败

[返回]                               [保存 18 个资料来源]
```

状态：`scan_idle / running / canceling / complete / partial / failed / scope_needs_confirmation`。

此页只选择 SourceSet，不产生数据外发。第一次数据外发前的硬门位于 Plan Review：用户必须同时看到并确认 SourceSet、数据等级、Provider、Model、Canonical Endpoint 和 Egress Policy。协议成功提交 `task.data_boundary.confirmed` 前，Provider Egress Broker 必须拒绝请求。

## 6. 新任务与 Plan

```text
┌───────────────────┬───────────────────────────────────────┬───────────────────┐
│ 产品规划资料      │ 新任务                                │ 任务范围          │
│                   │                                       │                   │
│ + 新任务          │ 目标                                  │ 18 个资料来源     │
│                   │ ┌───────────────────────────────────┐ │ 0 个外部来源     │
│ 最近任务          │ │ 分析当前产品需求、风险和待确认项 │ │                   │
│  · 市场报告       │ │ 输出一份带来源的评审报告。       │ │ My Provider      │
│  · 需求梳理       │ └───────────────────────────────────┘ │ model-x           │
│                   │                                       │                   │
│                   │ 验收标准                              │ 输出              │
│                   │ [✓] 主要需求都有来源                  │ Markdown + DOCX   │
│                   │ [✓] 风险和待确认事项独立分组          │                   │
│                   │ [✓] 标出资料矛盾                      │ 真实工作区不修改  │
│                   │ [+ 添加标准]                          │                   │
│                   │ [预览计划与数据边界]                  │                   │
├───────────────────┴───────────────────────────────────────┴───────────────────┤
│ [继续说明任务……]                                             [发送]          │
│ Plan · model-x · 18 个资料 · Provider 请求会产生网络/费用/日志                 │
└───────────────────────────────────────────────────────────────────────────────┘
```

Plan 卡：

```text
计划
1. 建立资料索引并识别时间、版本和术语
2. 提取需求、风险和待确认事项
3. 交叉核对冲突并生成引用
4. 生成报告并运行引用/结构检查

将读取：18 个本地资料
将生成：Markdown、DOCX 草稿
将发送到：https://api.example.com:443 · My Provider / model-x
数据范围：所选来源中的必要摘录 · Internal
真实 Workspace：不会修改；ArcForge 会保存任务状态
Provider 请求：会产生网络、费用和服务商日志

[修改目标] [重新生成]              [确认数据边界并开始执行]
```

Research & Report V1 的初始 Plan 通过 `task.prepare_local_plan` 使用本地 Work Pack 模板生成，从而把 SourceSet、Provider 数据边界和 Plan 合并为一次阻塞审查。若未来使用远程模型辅助生成 Plan，必须先展示并提交同等 DataBoundaryGrant，不能把 `task.request_plan` 作为绕过确认的通道。

## 7. 执行中

```text
┌───────────────────┬───────────────────────────────────────┬───────────────────┐
│ 当前任务  运行中  │ 分析产品需求与风险                    │ 当前执行          │
│                   │                                       │                   │
│                   │ ● 建立资料索引                        │ 阶段              │
│                   │   已处理 18 / 24                      │ 调查与交叉核对    │
│                   │   2 个文件不受支持                    │                   │
│                   │                                       │ 资料              │
│                   │ ✓ 已提取需求条目                      │ 18 个来源         │
│                   │   32 条候选需求                       │ 2 个警告          │
│                   │                                       │                   │
│                   │ ● 正在交叉核对                        │ 模型              │
│                   │   14 条 Finding · 3 处可能冲突        │ Provider/model-x  │
│                   │                                       │                   │
│                   │ ○ 生成报告                            │ 真实 Workspace    │
│                   │ ○ 验证引用                            │ 未修改            │
│                   │                                       │                   │
│                   │ [停止任务]                            │ [查看数据边界]    │
└───────────────────┴───────────────────────────────────────┴───────────────────┘
```

- 每阶段一张聚合 Activity 卡；
- 不展示逐文件刷屏、原始 RPC 或私有推理；
- Stop 先进入 Canceling；
- 运行中禁止换模和扩大能力。

## 8. 报告审查

```text
┌───────────────────┬───────────────────────────────────────┬───────────────────┐
│ 当前任务 可审查   │ 产品需求与风险评审                    │ 报告 来源 证据 操作│
│                   │ 草稿 v2 · 尚未保存                    │                   │
│                   │                                       │ ✓ 引用 18/18      │
│                   │ 1. 执行摘要                           │ ✓ Criteria 4/4    │
│                   │ 2. 已确认需求                         │ ! 3 个待确认问题  │
│                   │ 3. 主要风险                           │ ! 2 处资料矛盾    │
│                   │ 4. 待确认事项                         │                   │
│                   │                                       │ 输出              │
│                   │ 当前方案需要自定义 Provider。[1]      │ [✓] Markdown      │
│                   │ Windows 安全仍是发布门槛。[2][3]      │ [✓] DOCX          │
│                   │                                       │ 内容：未确认 v2   │
│                   │ [假设] 首批用户有稳定网络。           │ 保存：尚未应用    │
│                   │                                       │ [接受此版本]      │
│                   │                                       │ [保存到工作区]    │
├───────────────────┴───────────────────────────────────────┴───────────────────┤
│ [要求修改报告……]                                             [发送]          │
└───────────────────────────────────────────────────────────────────────────────┘
```

- 持续显示 `草稿 vN · 尚未保存`；
- 修改产生新 ArtifactVersion；
- Artifact Accept 只确认精确内容版本，不产生真实写入；Apply 只保存指定版本，也不隐式接受内容；Research & Report Work Pack 默认要求先接受当前版本再启用保存；
- Source stale 或验证失败时禁用保存。

## 9. Citation/Evidence

```text
┌────────────────────────────────────────────────────┐
│ 引用 [2]                                    [关闭] │
├────────────────────────────────────────────────────┤
│ 来源                                               │
│ docs\SECURITY.md                                  │
│ “Windows 安全”章节 · 第 3 段                       │
│                                                    │
│ 摘录                                               │
│ “Windows 安全能力未达门槛时……”                    │
│                                                    │
│ ✓ 文件未变化                                      │
│ SHA-256 8ab3…19fd                                  │
│ Parser docx-parser 1.0                             │
│                                                    │
│ [在原文件中打开] [查看同来源引用]                  │
└────────────────────────────────────────────────────┘
```

Source 变化：

```text
! 来源已在报告生成后发生变化
该引用不再计入已验证结论。
[查看变化] [重新验证]
```

Evidence 只展示 Criteria、Citation、Hash、矛盾、结构和导出验证，不展示伪精确的“AI 可信度百分比”。

“在原文件中打开”只使用 Broker 签发的 Opaque ResourceHandle 和窄类型 `resource.reveal` 命令，不接受 WebView 传入的任意绝对路径或 URL。

## 10. 保存审批

```text
┌──────────────────────────────────────────────────────────────────┐
│ 保存报告到真实工作区                                             │
├──────────────────────────────────────────────────────────────────┤
│ 审批对象：草稿 v2 · SHA-256 5c21…91ae · 10 分钟后过期            │
│ 将创建 2 个新文件：                                              │
│                                                                  │
│ CREATE ArcForge Output\...\report.md                             │
│        Markdown · 48 KB · SHA-256 10a2…9cf1 · 目标：不存在       │
│ CREATE ArcForge Output\...\report.docx                           │
│        Word · 126 KB · SHA-256 8bd3…1e22 · 目标：不存在          │
│                                                                  │
│ [查看 report.md 内容] [查看 DOCX 预览]                            │
│                                                                  │
│ 来源校验       ✓ 18 个来源未变化                                 │
│ 目标冲突       ✓ 目标文件不存在                                  │
│ 原始资料       不会修改                                          │
│ 本次保存       只写入以上本地文件，不调用外部业务系统            │
│                                                                  │
│ [更改位置]                              [取消] [保存 2 个文件]    │
└──────────────────────────────────────────────────────────────────┘
```

目标冲突：

```text
目标文件已存在，并在任务开始后变化。

(•) 使用新文件名
( ) 查看现有文件后重新审查
( ) 覆盖现有文件（需要再次确认）

[取消] [继续]
```

- 不提供永久允许；
- Approval 绑定 ArtifactVersion/Content Hash、逐项操作、规范化 Workspace 相对路径、目标 Revision/Hash、新内容 Hash、Policy 和过期时间；
- 更改位置、覆盖方式、草稿版本、来源验证、目标 Revision 或 Policy 会立即关闭并废弃旧审批，必须由 Broker 重新生成 Preview；
- 执行瞬间仍重新验证目标身份和 Hash；
- 提交后按钮立即禁用；
- 多文件部分成功逐项显示。

## 11. 成功

```text
✓ 报告已保存到工作区

2 个文件已创建
保存记录：2026-07-17 15:46

[打开文件夹] [查看保存记录] [完成任务]
```

“打开文件夹”同样使用 `resource.reveal`，是用户发起的窄 OS 动作，不向 Agent 暴露通用 `process.spawn`。

## 12. 模型设置

```text
设置 / 模型

● My Provider / model-x                       默认
  连接可用 · 报告认证

Profile 名称  [My Provider]
协议          [OpenAI-compatible]
Base URL      [https://api.example.com/v1]
Model ID      [model-x]
API Key       已安全保存                       [更新]

能力：✓ 流式  ✓ 长上下文  ? 报告质量  × 未认证工具调用

[测试连接]                              [保存为新版本]

更改只影响下一任务。
```

状态：`unconfigured / credential_missing / untested / connection_ok / connection_failed / report_certified / capability_limited`。

连接测试不发送 Workspace 内容。

连接测试使用窄类型 `provider_profile.test_connection`，只发送固定健康检查负载并经过 Provider Egress Broker；不能由设置页直接请求任意 URL。

API Key 更新通过非 Durable `SecretSubmission` 直接交给 Rust Secret Broker；持久化 Profile 只接收 `secret_ref`，Raw Secret 不进入 ApplicationCommand、Event 或 WebView Local Storage。

## 13. Skills 与 MCP

Skills：

```text
[开] 产品评审报告
     Workspace · v1.2 · 完整性 Hash 匹配（不代表来源可信）
     需要 workspace.read、artifact.create · 脚本无

[关] 第三方研究助手
     用户级 · 未签名 · 需要 Web/MCP/脚本
     当前 Work Pack 不允许
```

MCP：

```text
Report V1 默认不允许 MCP Tool 参与任务。

○ Local Helper · STDIO · 已配置/未启用
  C:\Tools\helper.exe
  [静态校验]；“启动一次”会创建受审批的本地进程
  6 个 Tool · 0 个已认证

○ Internal API · HTTPS · 连接正常
  3 个 Tool · Report V1 禁用
```

“连接正常”和“任务可用”必须分开。

STDIO 的“启动一次”必须展示规范化可执行路径、Hash、签名、Args、CWD、Secret 引用、网络范围及进程/子进程期限；禁止永久授权。Process Broker 或 OS 隔离未认证时按钮不可用。

## 14. Memory

```text
待确认记忆

报告默认使用“执行摘要 / 风险 / 待确认事项”结构。
类型：偏好 · 作用域：用户 · 来源：当前任务
敏感等级：内部 · 有效期：长期

[编辑] [拒绝] [保存记忆]
```

Memory 详情显示来源、作用域、敏感等级、同意状态、期限，并支持删除和导出。

删除使用 `memory_entry.delete` 并清理内容/索引后保留无内容 Tombstone；导出先生成受控 MemoryExport Artifact，再经标准 Apply 保存，不提供任意路径写入 IPC。

## 15. 失败与恢复

普通失败：

```text
报告生成中断

模型在生成第 3 节时超时。
草稿仍在隔离区，真实工作区未修改。

[查看诊断] [放弃任务] [使用同一配置重试]
```

Effect Unknown：

```text
需要确认保存结果

保存时应用意外关闭，不能确认所有文件状态。
完成对账前不能再次保存。

report.md    待确认
report.docx  待确认

[打开目标文件夹] [查看恢复记录（只读、脱敏）] [开始对账]
```

- 无 Effect 失败可创建新 Run；
- 已开始 Effect 必须先对账；
- Unknown 无“直接重试”；
- 任一 Unknown 会禁用该 Task 的全部 Effectful 操作，不只禁用再次保存；
- 对账逐文件显示 `Applied / NotApplied / Conflict / StillUnknown`，混合结果不得进入全局成功页；
- 查看恢复记录前提示：对账完成前修改目标文件可能使结果转为 Conflict；
- 恢复不能静默换模或放宽权限。

应用级安全状态必须全局可见：

```text
Recovering                 正在恢复，真实动作暂不可用
EffectsBlockedUnknown      存在未对账动作，真实动作已暂停
ReadOnlyNeedsUpgrade       需要升级，只读打开
ReadOnlyStorageCorrupt     状态存储损坏，只读恢复
ProjectionIncomplete       视图不完整，等待重建
```

Core 发布 `application.ready { effects_enabled: true }` 前，Apply、进程、MCP、网络写和设置诊断按钮全部禁用。

## 16. Event → UI

| Event | UI |
|---|---|
| `workspace.scan.started` | 扫描页 |
| `source.discovered/unsupported/parse_failed` | 聚合计数与列表 |
| `workspace.scan.completed` | 资料范围确认 |
| `task.acceptance_criteria.proposed` | Criteria 编辑器 |
| `task.data_boundary.confirmed/invalidated` | 数据边界生效/强制重新确认 |
| `plan.updated` | Plan 卡 |
| `activity.progress_updated` | 聚合 Activity |
| `artifact.version_created` | 报告版本和预览 |
| `artifact.validated` | Evidence 结果 |
| `artifact.validation_failed/invalidated` | 禁用 Apply 并要求重验证 |
| `artifact.reviewed { decision: accepted/rejected }` | 内容已接受/拒绝；不得显示为已保存或 Task 成功 |
| `evidence.stale` | stale 警告与 Apply 阻断 |
| `effect.proposed` | 保存审批 |
| `effect.applied` | 成功与 EffectReceipt/ApplyReceipt |
| `effect.failed/unknown` | 失败或强制对账 |
| `recovery.* / application.effect_gate_changed` | 全局恢复条与 Effect Gate |
| `memory_candidate.proposed` | 待确认 Memory |
| Task 终态 Event | 明确终态 |

## 17. 原型验收任务

1. 配置模型并添加 Workspace；
2. 扫描不支持、敏感和失败文件；
3. 排除资料并确认 Endpoint；
4. 编辑 Criteria 和 Plan；
5. 执行中取消；
6. 审查报告和 Citation；
7. Source 变化后重验证；
8. 新文件 Apply；
9. 目标冲突；
10. Apply 中断恢复；
11. Memory 决策；
12. Skill 权限；
13. MCP STDIO 测试风险；
14. 确认换模只影响下一 Task。

通过门：

- ≥80% 无帮助完成主流程；
- ≥90% 区分草稿和已保存；
- ≥90% 找到 Provider/Endpoint；
- ≥90% 理解 Apply 范围；
- 不把“连接成功 MCP”误认为“已授权执行”。
