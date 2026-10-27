# AGENTS.md

## 发版流程（每次发版都必须按此执行）

版本号格式 `MAJOR.MINOR.PATCH`，标签格式 `vX.Y.Z`（例如 `v0.1.1`）。

### 1. 改版本号

`desktop/src-tauri/tauri.conf.json` 的 `version` 是应用版本的唯一来源（前端通过 `vite.config.ts` 注入），必须与下面这些文件保持一致：

- `package.json`
- `desktop/package.json`
- `packages/*/package.json`
- `desktop/src-tauri/Cargo.toml`

改完后 `Cargo.lock` 会在打包时由 cargo 自动同步。

### 2. 校验

```powershell
pnpm check
```

类型检查、单测、插件定义校验任一失败就停下，修复后再继续。

### 3. 打安装包

```powershell
pnpm desktop:bundle
```

产物路径：

```
desktop/src-tauri/target/release/bundle/nsis/抹茶泡芙_<version>_x64-setup.exe
```

打包会重新构建前端并执行 `tauri build --bundles nsis`，安装包内置的是当前工作区的源码与前端产物。

### 4. 把安装包放到工作区根目录

把上一步的 exe 复制到工作区根目录（仓库的上一级，即 `g:\抹茶泡芙开发\`），保留版本号：

```
g:\抹茶泡芙开发\抹茶泡芙_<version>_x64-setup.exe
```

安装包属于构建产物，不提交进仓库（`target/` 已在 `.gitignore` 中忽略），只放在工作区根目录。

### 5. 提交、打标签、推送

```powershell
git add -A
git commit -m "chore: release vX.Y.Z"
git tag vX.Y.Z
git push origin main
git push origin vX.Y.Z
```

要求：

- 标签必须打在与安装包完全一致的提交上；
- 推送前确认 `git status` 干净、版本号各处一致；
- 任一步失败都不要推标签，修复后重新打包再走完流程。
