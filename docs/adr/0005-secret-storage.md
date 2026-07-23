# ADR-0005：Secret 不明文落盘

状态：Proposed

## 背景

自定义模型、MCP 和外部 Connector 需要 API Key、OAuth Token 或 Cookie。将其写入 TOML、SQLite、日志或子进程环境会扩大泄露面。

## 决策

- Windows 使用 Credential Manager 或 DPAPI 保护的系统密钥库保存真实 Secret。
- `.arcforge` 只保存不含真值的 `secret_ref`。
- Runtime、Skill、MCP 和 Plugin 不能枚举全部 Secret。
- Secret 使用由 Broker 按 Capability 和目标 Endpoint 注入。
- 备份、普通日志和诊断包不包含 Secret 真值。

## 后果

- 跨机器恢复后需要重新认证。
- 需要 Secret Broker、引用生命周期、撤销和审计。
- 不能仅靠环境变量作为生产 Secret 传递机制。
