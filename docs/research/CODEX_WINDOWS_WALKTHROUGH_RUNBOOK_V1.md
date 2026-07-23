# Codex Windows 桌面走查执行包 V1

状态：Preflight blocked on a qualified Windows 11 environment

本文是 [Codex Windows 桌面产品走查计划](CODEX_WINDOWS_WALKTHROUGH_PLAN_V1.md)的现场执行与证据归档入口。它不会把公开文档推断、当前 Codex 会话内容或未执行案例写成“已观察”。

## 1. 当前执行状态

| 日期 | 环境 | 预检结果 | 可作为正式证据 | 说明 |
|---|---|---|---|---|
| 2026-07-20 | 当前开发机 | Windows API 返回 `10.0.19045`；客户端产品版本未取得 | 否 | 不符合计划要求的 Windows 11 x64；未执行 UI 案例 |

本轮未自动化操作 Codex/ChatGPT 桌面 UI。正式案例必须由人工操作员在合成 Workspace 中完成，并把观察写入模板。当前公开产品基准仍单独保存在 [Codex 产品基准](CODEX_PRODUCT_BASELINE_2026-07.md)，不能替代真实客户端证据。

## 2. 正式环境预检

每台机器创建一个 Session ID：标准用户 `W11-STD-01`，开发机临时用户 `W11-DEV-01`。

- [ ] Windows 11 x64，记录 Edition、Build、补丁日期和显示缩放；
- [ ] 客户端 About/Settings 中的版本和更新通道可见并已记录；
- [ ] 使用研究专用账号，不读取真实 `.codex`、浏览器会话或凭据；
- [ ] 准备 `clean-git`、`dirty-git` 和 `non-git` 三个合成 Workspace；
- [ ] dirty Workspace 中预置一处“用户改动”，并保存基线 Hash；
- [ ] Canary Skill 和无害 MCP Server 只返回固定合成值；
- [ ] 截图、录屏、Process Monitor、文件快照和代理日志时钟一致；
- [ ] 网络代理只记录合成测试 Endpoint，不记录 Authorization 或请求正文；
- [ ] 原始证据进入受限研究目录，仓库只提交脱敏观察和重绘示意；
- [ ] 操作员知道遇到真实账号、权限、安全或隐私提示时立即停止。

任一项不满足，Session 标记 `invalid_preflight`，不得进入正式矩阵。

## 3. 证据命名与记录规则

证据 ID 使用：

```text
<session>-<case>-<step>-<kind>-<UTC timestamp>
W11-STD-01-W30-02-S03-SCREEN-20260721T031522Z
```

每个案例至少记录：

1. 操作前界面与资源快照；
2. 参与者执行的单一动作；
3. 可见界面状态和用户决策点；
4. 文件、进程、网络和凭据四类副作用；
5. 操作后快照与异常；
6. 证据 ID、结果和 ArcForge 启示。

`observed` 只写可见事实；解释写入 `arcforge_implication`。没有证据填 `not_observed`，不能依据预期补全。截图必须遮蔽账号、邮箱、组织、订阅、Token、Cookie、设备标识、真实路径和真实业务内容。

## 4. 人工执行顺序

### Session A：G0 主路径

1. W00 首启、登录外状态、断网和 Folder Trust；
2. W10 Workspace/Task 切换与隔离；
3. W20 Plan 下的文件、Shell、网络、MCP、Memory 和子任务请求；
4. W30 文件、网络、Shell、MCP 和凭据审批的创建、失效、拒绝与恢复；
5. W40 Review、外部编辑、部分 Apply、取消与重启恢复。

### Session B：异常与 G1 实验能力

1. W50 Provider、Model、Skills、MCP 和 Memory；
2. W60 文件锁、磁盘/权限错误、进程树、网络和 Broker 异常；
3. 重复 Session A 的 P0/P1 发现，确认可复现性；
4. 归纳模式矩阵、安全偏差和 G0 UX 验收测试。

案例明细使用 [走查案例日志](templates/CODEX_WALKTHROUGH_CASE_LOG.csv)。一个案例可以有多个证据，但一个结果只能是 `pass / fail / blocked / not_observed`。

## 5. 停止与隔离条件

立即停止当前案例并隔离证据：

- 出现真实源码、真实 `.codex`、凭据、账号或业务材料；
- 客户端要求改变 Windows 安全/隐私设置；
- 无害 MCP/Canary Skill 之外的第三方进程或 Endpoint 被触发；
- 网络代理开始记录 Authorization、Cookie 或请求正文；
- 合成 Workspace 之外发生文件写入或删除；
- 操作结果未知，重复动作可能造成二次 Effect。

停止后记录 `blocked` 或 `unexpected_effect`，不要用第二次点击掩盖第一次的未知结果。

## 6. 证据到产品变更的门

每条建议必须满足：

```text
Case → Evidence Ref → Observed Pattern/Deviation
→ ArcForge Contract → PRD/Wireframe Change → Acceptance Test
```

优先级：

- P0：可能造成材料越界、未经授权 Effect、错误成功或恢复误导；
- P1：使多数用户误解 Workspace、Provider、Review、Apply 或 Task 状态；
- P2：效率、信息层级、布局或文案改进；
- P3：偏好性或非英雄场景建议。

单个竞品模式不能直接成为 ArcForge 需求。只有同时符合 ArcForge 英雄场景、信任合同，并在 Pilot 或走查中有证据，才进入 PRD/UI 修订。

## 7. 六项产出与完成定义

| 计划产出 | 文件 | 完成条件 |
|---|---|---|
| Walkthrough Evidence Log | `templates/CODEX_WALKTHROUGH_CASE_LOG.csv` | 两个有效 Session 的 G0 案例均有结果和证据引用 |
| Interaction Pattern Matrix | `templates/CODEX_INTERACTION_PATTERN_MATRIX.csv` | 每个模式区分观察、推断和 ArcForge 决策 |
| Security Deviation Register | `templates/CODEX_SECURITY_DEVIATION_REGISTER.csv` | 所有非预期 Effect 和边界差异均已分级 |
| G0 UX Acceptance Tests | `templates/CODEX_G0_UX_ACCEPTANCE_TESTS.csv` | 每个 P0/P1 发现有可复现验收测试 |
| G1 Experimental Audit | 案例日志 W50/W60 行 | 不阻塞 G0，只形成 Capability 审计 |
| PRD/Wireframe 变更建议 | 模式矩阵 `target_docs` 列 | 建议可追溯且尚未冒充已采纳 |

走查完成的最低门：两个 Windows 11 Session 预检有效；W00–W40 全部执行；P0/P1 发现至少在第二环境复现或明确标为单环境；原始证据已脱敏；四份模板已评审；PRD/UI 修订只引用证据 ID。
