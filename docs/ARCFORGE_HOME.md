# ArcForge Home 本地数据规范

## 1. 决策

ArcForge 借鉴 `CODEX_HOME` 的本地状态中心思想，但不复制 Codex 的私有文件格式。

```text
默认：%USERPROFILE%\.arcforge
覆盖：ARCFORGE_HOME=<absolute-path>
临时：arcforge --home <absolute-path>
```

不能硬编码 `C:` 或具体用户名。Windows 应通过 Known Folder API 获取用户目录。

当前用户为 Administrator 时，默认路径通常表现为：

```text
C:\Users\Administrator\.arcforge
```

## 2. 核心原则

1. `.arcforge` 是用户私有运行数据目录，整体默认不可提交 Git。
2. Application Core 内的 Storage Broker（`DomainStoreWriter`）是领域状态唯一写入者；Trusted Execution Broker 负责真实 Effect，两者职责不同。
3. Runtime、Skill、MCP 和 Plugin 不获得根目录访问权，只使用受限 Capability API。
4. Secret 不明文落盘，目录内只保存 Windows Credential Manager 引用。
5. SQLite append-only Event Table 是唯一领域事实源，UI State 和索引是可重建投影。
6. Memory 与 Chat History 分开治理。
7. Cache 可删除，Audit 不与普通日志混放。
8. 项目内 `.arcforge/` 仅保存用户明确选择的可共享配置。

## 3. 目录结构

```text
%USERPROFILE%\.arcforge\
├── home.json
├── README.txt
├── config\
│   ├── settings.toml
│   ├── policy.toml
│   ├── privacy.toml
│   └── ui.json
├── state\
│   ├── arcforge.sqlite
│   └── snapshots\
├── profiles\
│   ├── models\
│   ├── agents\
│   └── execution\
├── workspaces\
│   └── <workspace_id>\
├── threads\
│   └── <thread_id>\
│       └── tasks\<task_id>\
│           ├── task.json
│           ├── projection.json
│           ├── artifacts.json
│           ├── evidence.json
│           └── effects.json
├── memories\
│   ├── search.sqlite
│   ├── entries\
│   ├── content\sha256\
│   ├── pending\
│   └── tombstones\
├── skills\
│   ├── registry.json
│   ├── installed\<publisher>\<skill>\<version>\
│   └── state\
├── mcp\
│   ├── servers\
│   ├── permissions\
│   ├── schemas\
│   └── state\
├── plugins\
│   ├── registry.json
│   ├── installed\
│   ├── data\<plugin_id>\
│   └── permissions\
├── task-workspaces\
│   └── <task_workspace_id>\
│       ├── workspace.json
│       ├── root\
│       ├── overlay\
│       └── changeset.json
├── checkpoints\
├── attachments\
│   ├── metadata\
│   ├── blobs\sha256\
│   └── quarantine\
├── logs\
│   ├── app\
│   ├── runtime\
│   ├── audit\
│   └── security\
├── cache\
├── runtimes\
│   ├── bin\
│   ├── manifests\
│   ├── pids\
│   ├── locks\
│   └── temp\
├── secrets\
│   └── references.json
├── migrations\
│   ├── journal.json
│   └── history\
└── backups\
    └── manifests\
```

真正的备份包写入用户选择的外部目录；`backups` 只保存清单，避免递归备份。

## 4. Home 版本

```json
{
  "product": "ArcForge",
  "formatVersion": 1,
  "createdByVersion": "0.1.0",
  "lastOpenedByVersion": "0.1.0",
  "installId": "uuid",
  "createdAt": "2026-07-17T00:00:00Z",
  "migrationState": "clean"
}
```

- 根格式使用整数 `formatVersion`。
- 每类实体和 Event 有独立 `schemaVersion`。
- 遇到更高且不兼容的格式时只读打开，禁止自动降级覆盖。
- SQLite 使用 `PRAGMA user_version`。
- 迁移使用 journal，可重入、可恢复，失败不得删除旧数据。

## 5. 配置分层

```text
系统/企业策略
→ 用户全局配置
→ Agent/Profile
→ Workspace 共享配置
→ Workspace 本地配置
→ Thread/Task 临时选择
```

下层只能缩小安全权限，不能突破上层策略。

Profile 分类：

- `models`：Provider、Endpoint、Model、能力和 Secret 引用；
- `agents`：系统指令、Memory 策略、Skills/MCP 允许集合；
- `execution`：`Plan | Execute` Run Mode、文件、网络和外部 Effect 策略。Research 是 Work Pack 内部阶段，Ask 不启动 AgentRun。

每个 Task 必须保存不可变配置快照和 Hash。运行中的 AgentRun 不允许静默换模或扩大权限。

## 6. Event 与投影

EventEnvelope 字段以 [Protocol V1](specs/PROTOCOL_V1.md) 为唯一规范，使用 `global_position` 和每个 Aggregate Stream 的 `aggregate_sequence` 排序；时间戳只用于展示与审计。

规则：

- `state/arcforge.sqlite` 的 append-only Event Table 是唯一领域事实源。
- Event、Effect Outbox 与关键授权状态使用同一 SQLite 事务提交。
- Effect Outbox 与 Authorization Ledger 只用于投递、claim、fencing 和恢复，不是第二事实源，也不得覆盖领域 Event。
- `projection.json`、Memory Search Index 和 UI State 是查询投影，可以重建。
- JSONL 只作为用户主动导出或脱敏诊断格式，不参与在线恢复决策。
- 每个 Aggregate Stream 的 `aggregate_sequence` 严格递增，数据库同时分配 `global_position`。
- 普通运行禁止原地修改或删除已提交 Event；敏感删除使用 Tombstone、可擦除 Blob 和受控 Compaction。
- SQLite 使用 WAL、完整性检查和一致性快照；损坏时只读恢复，禁止继续 Effect。
- 多窗口通过 Storage Broker 协调，禁止多个写入者。

## 7. Memory

Memory 不能等同于聊天记录。建议类型：

- `preference`：用户偏好；
- `fact`：经确认的事实；
- `procedure`：可复用工作方法；
- `episodic`：历史任务摘要；
- `workspace`：工作空间知识；
- `resource`：联系人或业务资源引用。

每条 Memory 至少包含：

```text
memory_id
scope: user | workspace
type
content/content_ref
source/provenance
confidence
sensitivity
created_at/last_used_at/expires_at
consent_state
derived_from
```

产品规则：

- Agent 只提议 Memory，用户可以确认、编辑或拒绝。
- 原始聊天不自动升级为长期 Memory。
- API Key、Cookie、Token 和高风险推断禁止进入 Memory。
- 提供临时 Thread：不读取或生成长期 Memory。
- 支持“忘记这件事”、按 Workspace 清理和完整导出。
- 删除 Thread 时提示是否删除其派生 Memory。

第一版本地检索可以使用 SQLite FTS。向外部 Embedding Provider 发送内容必须经过 Egress Policy。

## 8. Skills、MCP 与 Plugin

### Skill

Skill 使用不可变版本目录，Registry 记录：

- 来源、版本和 commit；
- 内容 Hash 和签名状态；
- 所需 Capability；
- 安装与信任状态。

Skill 是工作流说明，不拥有额外权限。Skill Script 仍需要文件、Shell、网络和 MCP Policy。

### MCP

MCP 配置只保存命令、URL、参数模板、Tool Allowlist 和 `secret_ref`。

```text
MCP Config → MCP Broker → Policy Engine → Server/Tool
```

STDIO MCP 的启动是高风险进程动作；启用前展示可执行文件、参数、CWD、环境引用和网络范围。

### Plugin

Plugin 默认只能访问：

```text
plugins\data\<plugin_id>
```

访问其他资源必须通过 Capability Token，不能直接读取全局 Memory、Secrets 或 Event Store。

Private Alpha 不加载不受控进程内原生 Plugin；上述目录只保留未来 Registry/Schema 门。

## 9. Secrets

`secrets/references.json` 只保存引用：

```json
{
  "secretId": "uuid",
  "target": "ArcForge:<install-id>:provider:<profile-id>",
  "kind": "api-key",
  "updatedAt": "UTC"
}
```

真实值存入 Windows Credential Manager 或 DPAPI 保护的系统密钥库。

禁止：

- TOML/JSON/JSONL 明文密钥；
- 命令行参数携带密钥；
- 普通子进程环境继承全部密钥；
- 日志、诊断包和备份包含 Secret 真值；
- Runtime、Skill、MCP 或 Plugin 枚举全部 Secret。

跨机器恢复后保留引用配置，但要求重新认证。

## 10. 附件与隔离 Workspace

附件使用 SHA-256 内容寻址；外部下载内容先进入 `quarantine`。

每个可写 Task 使用独立 `task_workspace_id`：

- Agent 先在 Overlay 中生成结果；
- 用户审查后由 Trusted Broker Apply 到真实目标；
- 多 Agent 并行写入必须使用不同 Task Workspace；
- Workspace 可以丢弃，不等同于 Checkpoint；
- Checkpoint 不承诺恢复邮件、SaaS、支付或其他不可逆 Effect。

Task Workspace 只隔离变更与审查，不是 Windows 安全 Sandbox。具备直接文件、网络、Shell 或子进程能力的第三方 Runtime/MCP 必须处于经验证的 OS 强制隔离中，否则禁止启动。

## 11. Windows 权限

首次创建时设置 DACL：

- 当前 Windows 用户：完全控制；
- SYSTEM：必要管理权限；
- 其他普通用户：无访问权限。

还必须做到：

- Named Pipe 绑定当前用户 SID；
- 拒绝 junction/reparse point 逃逸；
- 配置写入使用同目录临时文件和原子替换；
- Job Object 只用于进程生命周期，不宣传为 Sandbox；
- Runtime 与 Broker 使用最小能力 Token；
- 企业敏感数据场景增加本地加密，不能只依赖 NTFS ACL。

## 12. 保留、备份与迁移

建议默认保留：

| 数据 | 默认策略 |
|---|---|
| Thread/Task/Artifact | 用户主动删除 |
| 应用日志 | 14 天 |
| 安全审计 | 90 天，可配置 |
| Runtime 临时文件 | 正常退出清理 |
| Cache | LRU + 总量上限 |
| 未引用附件 | 7 天宽限后清理 |
| 实验 Checkpoint | 30 天或每 Workspace 最多 10 个 |

备份默认包含 Config、Profiles、Workspace 注册信息、Threads、Events、Memories 和扩展清单；默认排除 Secret、Runtime、Cache、Logs、临时 Workspace 和可重新下载二进制。

迁移流程：

1. 获取全局迁移锁；
2. 生成一致性快照；
3. 写 migration journal；
4. 在临时副本迁移；
5. 校验 Event、索引和附件；
6. 原子切换；
7. 保留旧版本回滚副本。

## 13. 项目级 `.arcforge`

全局 `%USERPROFILE%\.arcforge` 整体不可提交 Git。根目录可以自动创建保护性 `.gitignore`：

```gitignore
*
!.gitignore
!README.txt
```

Workspace 内可选择创建可共享配置：

```text
<workspace>\.arcforge\
```

允许提交：

- `workspace.toml`；
- `policy.toml`；
- `.arcforgeignore`；
- `skills.lock`、`plugins.lock`；
- `mcp.example.toml`；
- `agents/*.toml`；
- `workflows/*.md`；
- 不含 Secret 的团队约定。

禁止提交：

- `local.toml`、`*.local.toml`；
- Secret、Token、Cookie；
- Thread、Task、Event、Memory；
- Attachment、Task Workspace、Checkpoint；
- Logs、Cache、Runtime；
- 用户绝对路径和个人 Provider Profile。

## 14. ADR 候选

- `ADR-LS-001`：`ARCFORGE_HOME=%USERPROFILE%\.arcforge`，允许显式覆盖。
- `ADR-LS-002`：全局 Home 是私有状态，Workspace `.arcforge` 只放可共享配置。
- `ADR-LS-003`：Storage Broker 是唯一写入者。
- `ADR-LS-004`：SQLite append-only Event Table 是唯一事实，JSONL 仅用于导出，UI/索引是投影。
- `ADR-LS-005`：Secret 永不明文落盘。
- `ADR-LS-006`：扩展只能通过最小 Capability 访问资源。
- `ADR-LS-007`：可写 Task 使用隔离 Task Workspace。
- `ADR-LS-008`：Memory 独立治理并需要来源、作用域和同意状态。
- `ADR-LS-009`：备份不包含 Secret 真值。
- `ADR-LS-010`：首版预留 AgentRun/Workspace 边界，子 Agent 不得提权。

## 15. Codex 参考边界

官方 Codex 文档将 `CODEX_HOME` 定义为 config、auth、logs、sessions、skills 等状态的根目录；同时区分用户配置与受信任项目的项目级配置，并建议使用系统凭据存储。ArcForge 借鉴这种“用户 Home + 项目共享配置 + 系统凭据”的分层，但使用独立目录、Schema 和安全模型。

参考：

- [Codex config and state locations](https://learn.chatgpt.com/docs/config-file/config-advanced#config-and-state-locations)
- [Codex customization](https://learn.chatgpt.com/docs/customization/overview)
- [Codex skills](https://learn.chatgpt.com/docs/build-skills)
- [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp)
