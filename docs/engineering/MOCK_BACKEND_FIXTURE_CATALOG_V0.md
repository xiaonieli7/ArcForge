# Mock AgentBackend Fixture Catalog V0

状态：G0.5 input catalog；G1 中实现

Mock Backend 只能输出声明式 BackendEvent/ToolIntent，不获得文件、Shell、网络、Secret 或数据库句柄。每个 Fixture 在 G1 中必须固定 RunSpec、输入序列、预期 DomainEvent 类型序列、Effect 数量、终态和 projection hash；同一 Fixture 重放 100 次结果相同。

## Fixture 目录

| ID | 场景 | 输入/扰动 | 预期结果 | 关键断言 |
|---|---|---|---|---|
| MB-001 | Plan 正常 | 提议内部 Plan Artifact | Plan 可审查 | 0 个真实 Effect |
| MB-002 | Execute 正常草稿 | 提议 Task Workspace Draft | Artifact Proposed | 真实 Workspace 不变 |
| MB-003 | Plan 请求文件写入 | WorkspaceMutation ToolIntent | PolicyDenied | 0 文件写入 |
| MB-004 | Plan 请求进程 | ProcessExecution ToolIntent | PolicyDenied | 0 子进程 |
| MB-005 | Plan 合法 Egress | 有效 DataBoundaryGrant | Authorized/Applied | Endpoint 与 source hash 匹配 |
| MB-006 | Egress 无 Grant | 缺失 Grant | PolicyDenied | 0 网络 |
| MB-007 | Grant 已失效 | SourceSet version 改变 | Denied + invalidated | 旧 Grant 不可复用 |
| MB-008 | 重复 BackendEvent | 同 instance/event ID 两次 | 单次处理 | Event 去重 |
| MB-009 | BackendEvent 乱序 | source sequence 3/1/2 | 缓冲或结构化失败 | 投影确定 |
| MB-010 | ToolIntent 错 Run | 使用其他 run ID | SecurityDenied | 0 Effect |
| MB-011 | ToolIntent 错 Workspace | 其他 Workspace Handle | SecurityDenied | 0 跨 Workspace 访问 |
| MB-012 | Mode Policy 不一致 | ToolIntent hash 与 RunSpec 不同 | SecurityDenied | 记录安全事件 |
| MB-013 | Cancel 后继续 | cancel generation 后发 ToolIntent | Rejected stale generation | 0 新 Effect |
| MB-014 | Backend 虚假成功 | 未完成 Criterion 时 completion | Task 不 Succeeded | completion 非权威 |
| MB-015 | 过期 Approval | expiry 后 authorize | Expired | 0 invoke |
| MB-016 | 参数审批后变化 | 修改 args/target | Approval Superseded | 新 Preview 必需 |
| MB-017 | 旧 fencing 重放 | consumed token 再次 invoke | StaleAuthorization | 0 重复 Effect |
| MB-018 | Crash/Reconnect | source sequence 从 checkpoint 继续 | 去重并恢复 | 无重复 DomainEvent |
| MB-019 | Effect 后无 Receipt | operation 可能发生后断流 | Unknown | 不自动重试 |
| MB-020 | 迟到 Receipt | Unknown 后收到可验证 Receipt | Reconciliation | 显式追加事件 |
| MB-021 | 部分 Apply | 第二资源失败 | PartiallyApplied | 逐资源 Receipt |
| MB-022 | 未知 Backend Schema | 不支持的 event schema | Fail closed | Run 不继续 |
| MB-023 | 重复命令同 payload | 相同 command ID/hash | Duplicate Receipt | 单一转移 |
| MB-024 | 重复命令异 payload | 相同 ID/不同 hash | IdempotencyConflict | 永久拒绝 |

## 每个 Fixture 的实现清单

- [ ] `fixture.json` 只含合成 ID、声明事件和 ContentRef hash；
- [ ] `expected-events.json` 使用已冻结 Event Catalog；
- [ ] `expected-projection.json` 包含 schema version 和 canonical hash；
- [ ] `expected-effects.json` 明确 `0/1/N` 与逐资源结果；
- [ ] 不包含 Secret、真实绝对路径、真实 Endpoint 或用户材料；
- [ ] 支持单步注入 Cancel、Duplicate、Reorder、Disconnect 和 Crash marker；
- [ ] 100 次 replay 输出字节级一致的规范结果。

G0.5 不实现 Fixture Runner。若合同必须依赖解析自然语言、TUI/ANSI、Grok Build 私有事件或真实 OS Effect 才能表达，立即触发 Stop。
