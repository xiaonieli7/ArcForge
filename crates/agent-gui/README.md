# ArcForge Desktop

ArcForge 是基于 Tauri + React 的 Windows 本地优先桌面 Work Agent。

## 开发

- 安装依赖：`pnpm install --frozen-lockfile`
- 前端开发：`pnpm dev`
- 桌面开发：`pnpm tauri dev`
- 前端构建：`pnpm build`
- Windows 安装包：`pnpm tauri build --config src-tauri/tauri.windows.conf.json --target x86_64-pc-windows-msvc`

桌面端当前仅面向 Windows x64。本仓库不配置在线更新，也不通过 GitHub Releases 自动发布安装包。
