# AGENTS.md

## 发版流程（每次发版都必须按此执行）

版本号格式 `MAJOR.MINOR.PATCH`，标签格式 `vX.Y.Z`（例如 `v0.1.1`）。

### 顺序不能调换：先出包，再提交和打标签

安装包是构建产物、不进仓库，但**标签必须指向与安装包完全一致的那次提交**。
先 commit 再打包的话，一旦打包失败（文件被占用、编译报错），标签要么指向一个
没有产物的提交，要么得删了重打。所以固定顺序是 **1 → 6**：任何一步失败都停在
推送之前，不会留下半成品标签。

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

### 3. 打安装包（自动复制到工作区根目录）

**打包前先退出正在运行的抹茶泡芙。** 构建会覆盖 `target/release/matcha_puff.exe`，
进程还开着时报 `failed to remove file ... (os error 5)`，整个打包直接失败。
确认没有进程后启动打包（不能靠任务管理器点，要用 `Stop-Process` / `taskkill` 确认）：

```powershell
Get-Process matcha_puff -ErrorAction SilentlyContinue | Stop-Process -Force
pnpm desktop:bundle
```

`desktop:bundle` 出包后会自动执行 `release:copy`，把安装包复制到**固定的工作区根目录**（仓库的上一级，即 `g:\抹茶泡芙开发\`）：

```
g:\抹茶泡芙开发\matcha-puff_<version>_x64-setup.exe
```

复制逻辑在 `scripts/copy-installer.ts`：Tauri 原生产物是中文名，脚本复制时统一改成 ASCII 文件名 `matcha-puff_<version>_x64-setup.exe`，本地工作区与 GitHub Release 都使用这个名字。目标目录固定为仓库上一级，不依赖手动拖拽或临时目录。安装包属于构建产物，不提交进仓库（`target/` 已在 `.gitignore` 中忽略），只放在工作区根目录。

安装包外观素材固定在 `desktop/src-tauri/icons/nsis/`：`header.bmp`（150×57）、`sidebar.bmp`（164×314）；安装包与卸载器图标使用 `icons/icon.ico`；配置见 `desktop/src-tauri/tauri.conf.json` 的 `bundle.windows.nsis`。

### 4. 确认安装包落点

```powershell
Get-Item "..\matcha-puff_<version>_x64-setup.exe"
```

必须确认文件存在、版本号与本次发布一致。没有看到文件就是打包或复制失败，先执行 `pnpm release:copy` 补齐；仍然失败就停止发布，不要提交或打标签。

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

### 6. 发布 GitHub Release（正文必须为空）

```powershell
gh release create vX.Y.Z --title "vX.Y.Z" --notes-file <空文件>
gh release upload vX.Y.Z "..\matcha-puff_<version>_x64-setup.exe"
```

Release 正文必须完全为空：不写任何说明、变更列表、校验结果或其它文字，什么都不要写。

安装包文件名统一使用 `matcha-puff_<version>_x64-setup.exe`，本地工作区与 GitHub Release 同名，不使用中文文件名，也不需要上传后再改名。

发布后确认：`body` 为空，附件存在且名为 `matcha-puff_<version>_x64-setup.exe`。
