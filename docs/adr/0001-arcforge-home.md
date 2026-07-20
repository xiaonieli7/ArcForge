# ADR-0001：ArcForge Home

状态：Proposed

## 背景

ArcForge 需要统一保存用户配置、运行状态、Thread、Task、Memory、Skills、MCP、Runtime 和审计数据，同时支持项目级可共享配置。

## 决策

- 默认 `ARCFORGE_HOME=%USERPROFILE%\.arcforge`。
- 允许通过 `ARCFORGE_HOME` 或显式启动参数覆盖。
- Windows 通过 Known Folder API 解析用户目录，不硬编码盘符或用户名。
- Private Alpha 只接受绝对、本地、NTFS 且不位于 Workspace 内的 Home；网络共享、可移动介质和 reparse/junction 目标默认拒绝。
- 创建后验证当前用户/SYSTEM 专用 DACL；覆盖路径后必须重新检查权限。
- 全局 Home 是用户私有运行数据，整体不提交 Git。
- Workspace 内可选 `.arcforge/` 只保存无 Secret 的可共享配置。
- 不复制 Codex 内部格式，ArcForge 使用独立 Schema 和迁移策略。

## 后果

- 安装、CLI、Desktop 和 Runtime 必须使用同一个 Home Resolver。
- 测试可以使用临时 Home，避免污染真实用户数据。
- Home 版本升级必须有 migration journal、备份和失败回滚。
- Runtime 与扩展不得直接访问 Home，只能使用窄 Capability。
