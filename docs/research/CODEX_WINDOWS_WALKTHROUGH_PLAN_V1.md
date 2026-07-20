# Codex Windows 桌面产品走查计划 V1

状态：Ready for black-box walkthrough

## 1. 目的与边界

验证当前 Codex Windows 客户端可观察的信息架构、审批节奏、Review-first 闭环和异常恢复，为 ArcForge 产品合同提供证据。它不是像素级复刻、逆向工程或私有协议研究。

可以借鉴 Workspace/Task、Composer、Plan/Execute、结构化审批、Review Pane、隔离 Workspace、Skills/MCP 配置和恢复入口，但必须使用 ArcForge 自有品牌、视觉、协议与安全语义。

不得复制 Codex 名称、Logo、图标、插画、品牌文案、截图资产、声音动效、私有 Schema、内部 Prompt、文件格式或原始 Thought Stream。

## 2. 环境与记录

- 两台 Windows 11 x64：干净标准用户和开发机临时用户；
- 三个合成 Workspace：`clean-git`、`dirty-git`、`non-git`；
- 专用测试账号和低权限凭据；
- 自建无害 MCP Server 与 Canary Skill；
- Process Monitor、文件快照和测试 HTTP 代理只记录合成数据。

每个案例记录版本、Windows build、前置状态、操作、可见状态、用户决策点、文件/进程/网络/凭据副作用、异常、证据时间戳和 ArcForge 启示。

## 3. G0 主流程

### 首启与信任

- 未登录、无模型、断网和证书异常；
- 默认目录、更新、隐私和遥测提示；
- 首次打开文件夹时的路径、Folder Trust、Shell 和写入解释；
- 重启后哪些项目、任务和敏感上下文被恢复。

ArcForge 门：未完成 Workspace Trust 和 DataBoundary 时最多进入不触发 Provider Egress 的本地 Plan。

### Workspace、Task 与 Run 隔离

- 添加、移除、重命名和切换 Workspace；
- 路径不存在、权限不足、网络盘、OneDrive、Symlink 和 Junction；
- 多任务切换时 Composer、审批、Run、Review 和模型是否串线；
- 外部修改、dirty Git 和用户原有变更如何显示。

ArcForge 门：`workspace_id/task_id/run_id` 必须隔离，所有审批始终显示真实作用域。

### Plan 零资源变更

在 Plan 下要求读取、联网、写文件、Shell 重定向、启动进程、测试、MCP、Memory 和子 Agent。使用文件、进程和网络证据验证结果，不能只相信 UI。

ArcForge 门：除有效 DataBoundaryGrant 下的 Provider Egress 外，写入、Shell、MCP、第三方进程、Memory Persist 和外部系统变更全部由 Effect Gate 拒绝。

### Approval

- 分别触发文件、Apply、Shell、网络、MCP STDIO 和凭据请求；
- 记录 Who/What/Target/Args/Scope/Duration 是否清晰；
- 测试过期、参数变化、任务切换、重启、撤销和拒绝；
- 统计典型任务阻塞审批次数。

ArcForge 目标：重复英雄任务核心阻塞审批不超过两次，但不提供宽泛 Yolo 或 Full Access。

### Review、Apply 与恢复

- 新增、修改、删除、重命名、二进制、大文件和行级导航；
- dirty Workspace 中区分用户变化与 Agent ChangeSet；
- Review 时外部编辑同一文件，验证冲突与基线失效；
- Apply all、部分 Apply、Discard、强杀和中断恢复。

ArcForge 门：Artifact Accepted、Effect Applied 和 Task Succeeded 分离；部分成功为 `PartiallyApplied`，无法证明时为 `AbandonedWithUncertainty`，并产生 ApplyReceipt。

## 4. G1 实验能力走查

- Model/Provider：Run 级切换、费用、能力、限流、上下文溢出、错误证书、Redirect 和不兼容 Tool Call；
- Skills：发现、作用域、启停、更新、Hash，以及 Canary Skill 的权限诱导；
- MCP：HTTP/STDIO、第三方进程提示、Schema 变化、Secret、CWD、网络、子进程和清理；
- Memory：创建、来源、作用域、删除、禁用、跨 Workspace 泄漏和删除残留。

这些能力只形成 Experimental 审计，不阻塞 G0。

## 5. 故障与 Windows 安全案例

- 在模型流、Tool 请求、审批、进程、Diff 和 Apply 阶段执行 Cancel、关闭、强杀和断网；
- 重复 Retry/Apply，测试幂等；
- 磁盘满、文件锁、权限撤销和状态损坏；
- Sandbox/GPO/WDAC/杀软拦截、Job Object 失败；
- 子进程 breakaway、GUI、计划任务、服务、注册表、Named Pipe、COM、其他盘、UNC 和 WSL；
- DNS、IPv4/IPv6、Proxy、Loopback、Redirect 和 Provider 直连；
- Broker 崩溃、版本不匹配、心跳丢失、Token 过期和旧 fencing token 重放。

ArcForge 安全能力不足时必须降级为 Plan 或禁用对应 Capability，并醒目标识；不得警告后继续 Execute。

## 6. 证据采集规则

允许采集合成 Workspace 中的界面、操作顺序、状态、错误、自制 Prompt/Canary/MCP，以及 Project/Task、Review、Approval 等抽象产品模式。

禁止或遮蔽账号、邮箱、组织、订阅、API Key、Cookie、设备标识、真实 `.codex` 内容、真实源码/业务材料、Authorization、请求正文、Crash dump、未脱敏日志和原始内部推理。不得反编译、解包或复制客户端二进制和私有格式。

原始截图/录屏保存在受限研究目录；仓库只提交脱敏文字结论、重绘线框和必要裁剪示意。

## 7. 产出物

1. Walkthrough Evidence Log；
2. Interaction Pattern Matrix；
3. Security Deviation Register；
4. G0 UX Acceptance Tests；
5. G1 Experimental Audit；
6. 对 UI Wireframes 与 PRD 的变更建议。

## 8. 执行资产

[Codex Windows 桌面走查执行包](CODEX_WINDOWS_WALKTHROUGH_RUNBOOK_V1.md)定义环境预检、证据命名、人工执行顺序、停止条件和完成门。现场数据分别写入：

- [Walkthrough Evidence Log](templates/CODEX_WALKTHROUGH_CASE_LOG.csv)；
- [Interaction Pattern Matrix](templates/CODEX_INTERACTION_PATTERN_MATRIX.csv)；
- [Security Deviation Register](templates/CODEX_SECURITY_DEVIATION_REGISTER.csv)；
- [G0 UX Acceptance Tests](templates/CODEX_G0_UX_ACCEPTANCE_TESTS.csv)。

公开文档基准、非 Windows 11 环境观察和未执行案例不得填为 `observed`。
