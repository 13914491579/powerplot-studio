# GitHub 与 Cloudflare Pages 部署

## 2.1 发布记录（2026-10-10）

开发分支 `feature/grid-layout-2.1`；在既有 2.0 项目增量升级，原始解析器及导出管线继续使用，无依赖升级、无新服务或密钥。完整本地 `pnpm.cmd check` 已通过：45 项单元测试、18 组 Edge 端到端测试及生产构建。版本为 `2.1.0`。开发分支推送后先验收 Pages 预览，再合并 `main`，正式网站仍为 https://powerplot-studio.pages.dev 。本节将在公网验收后记录真实预览结果。

## 当前状态（2026-10-09）

- 本地项目已初始化 Git，发布分支为 `main`，已推送并关联 `origin/main`；首个提交为 `7281510c504ab91eebffdf7722d589337de3ba4e`。
- GitHub 账号 `13914491579` 的公开仓库已创建；未添加项目许可证。
- 实际 GitHub 仓库地址：https://github.com/13914491579/powerplot-studio
- 实际 Pages 正式地址：https://powerplot-studio.pages.dev
- 所有者已完成 GitHub / Cloudflare 登录及授权，GitHub App 仅访问 `powerplot-studio`；Pages Git 集成已创建并发布成功。
- 首次正式部署对应 `01a1e3861d88aeeca58f59069543087e24b4efa2`，不可变地址：https://dc801a66.powerplot-studio.pages.dev 。构建日志确认 Node `24.19.0`、pnpm `11.25.0`、锁文件未变化、构建和资产发布成功。
- 推送 `deployment-preview` 后自动产生预览：https://dd5a12a8.powerplot-studio.pages.dev 。正式域名未被预览替换。
- 公网 Edge 验收 10 项最终全部通过（5 项首次通过、5 项访问超时或连接关闭后重试通过）；无最终失败。包括 TXT/CSV、独立/合并、非等间隔与尖峰、IEEE 模板、轴刻度、双三子图、PNG/SVG/矢量 PDF、ZIP、格式同步及刷新。新增隐私测试确认导入期间只有同源 GET 请求，无上传请求，刷新前后无严重控制台或页面错误。当前网络访问 `pages.dev` 存在间歇性连接问题，不将重试结果表述为全部首次通过。
- 已保留全部第二阶段绘图逻辑；无项目许可证新增。
- 最终执行 `pnpm.cmd check`：33 项单元测试、生产构建、10 项 Edge 浏览器测试全部首次通过。新增内嵌 SVG 网站图标，消除本地预览的 favicon 404。
- 部署准备修改后执行 `pnpm.cmd check`：33 项单元测试、9 项 Edge 浏览器测试和生产构建全部通过。`git diff --cached --check` 通过；忽略规则验证通过，公开候选文件的常见凭据与个人绝对路径扫描未发现匹配。首个提交的 GitHub Ubuntu/Chromium CI 已全部成功：[运行结果](https://github.com/13914491579/powerplot-studio/actions/runs/37894096423)。

## 首次发布操作

1. 确认使用账号 `13914491579` 创建公开仓库 `powerplot-studio` 并首次公开发布。登录 GitHub 后再次核对同名仓库；已有仓库先复用并检查历史。新建空仓库，不自动添加 README、LICENSE 或 `.gitignore`，避免重复初始化历史。
2. 在本地检查 `git status` 和 `git diff --cached`，配置本人 Git 提交身份，提交项目。将 `origin` 设置为 GitHub 页面给出的实际克隆地址，再执行 `git push -u origin main`。禁止强制推送；已有历史应先拉取并整合。
3. 登录 Cloudflare Dashboard，在 Workers & Pages 中创建 **Pages** 项目并选择连接 Git（不同控制台版本入口文字可能不同）。连接 GitHub；只给 Cloudflare GitHub App 授权所需仓库。账号密码、API Token 均不通过聊天发送。
4. 选择已确认的仓库，核对下面的配置，确认后点击保存和部署。不要选择 Workers 部署或 Direct Upload；本任务需要 Pages Git 集成。

| 设置 | 值 |
| --- | --- |
| 项目名称 | `powerplot-studio`（名称是否可用以控制台为准） |
| Framework preset | React (Vite) |
| Production branch | `main` |
| Build command | `pnpm build` |
| Build output directory | `dist` |
| Root directory | 留空，使用仓库根目录 |
| Build environment | v3 |
| NODE_VERSION | `24.19.0` |
| PNPM_VERSION | `11.25.0` |
| Preview branches | 全部非正式分支 |

版本变量需同时用于 Production 与 Preview。提交现有 `pnpm-lock.yaml`，不生成其他包管理器锁文件。Cloudflare 自动依赖安装需使用该锁文件；首次构建必须核对日志中的 Node、pnpm 版本及安装结果。若日志不能确认冻结锁文件，可设置 `SKIP_DEPENDENCY_INSTALL=1` 并将构建命令改为 `pnpm install --frozen-lockfile && pnpm build`；这是明确锁文件策略的备用配置，需要在控制台实际验证。

## 自动检查、预览与回退

`.github/workflows/ci.yml` 在推送、PR 和手动触发时运行：固定 Node/pnpm、冻结锁文件安装、Vitest、生产构建、Chromium 工作流验收。失败诊断上传为短期 artifact；不会上传真实用户导入数据。

Cloudflare Git 集成负责部署：推送 `main` 构建正式版本，其他分支生成预览。两套流程独立；Pages 的 `pnpm build` 失败不会产生可替换正式站点的成功部署，但 GitHub 测试失败不能自动阻止 Pages 构建。建议设置 GitHub `main` 分支规则：要求 PR 与 `check` 成功，禁止强制推送，验收预览后合并。

发生问题时在 Pages 的 Deployments 选择之前成功的正式部署执行 Rollback；预览部署不是正式回退目标。随后用 `git revert` 提交修复以保持代码与网站一致，避免下一次推送恢复问题。非正式分支自动预览已实测；未故意制造失败构建或执行回退，失败保留与回退依据 Pages 的产品机制及官方说明。

## 上线验收

部署成功后记录控制台给出的实际 HTTPS 地址和对应 commit SHA。不能根据建议项目名猜测网址。

在项目根目录使用 PowerShell：

```powershell
$env:PLAYWRIGHT_BASE_URL = 'https://powerplot-studio.pages.dev'
pnpm.cmd exec playwright test --retries=2
Remove-Item Env:PLAYWRIGHT_BASE_URL
```

这套测试对公网地址验证：真实 TXT 原始数组及时间范围、三列 CSV、非等间隔、尖峰、多文件分别/合并、轴范围和刻度、IEEE 单双栏、双三子图、颜色线型线宽、PNG/SVG/PDF 与 ZIP、样式同步、运行时错误。Windows 使用已安装的 Edge；其他系统先安装 Playwright Chromium。

另外人工核对：无登录情况下打开首页，刷新后仍可访问；DevTools Console 无严重错误；Network 中导入本地文件不会触发上传请求；示例与字体从网站同源加载。推送开发分支检查预览地址，再将验证过的变更合并到 main，核对正式部署 commit 和 Pages/GitHub 状态。

## 公开文件审查与限制

`.gitignore` 排除依赖、构建、测试截图/导出产物、环境文件、常见密钥文件和本地 Cloudflare 状态。没有运行时凭据；代码仅 fetch 同源示例、字体和内存 data URL，原始输入由 File API / Worker 在浏览器解析。示例仿真数据经所有者允许公开。

字体保留 SIL OFL 文件。Times 系列 SVG 可能依赖接收设备字体；PDF 中文使用 Noto 字体替代，相关限制见 README。百万点性能优化仍属后续阶段。公开仓库的源代码会被他人读取，许可证尚未选择。

同源 Noto 字体约 10 MB，公网首次加载可能较慢；公网测试单独延长等待时间，不改变产品绘图逻辑或断言。本地回归仍保留原等待阈值。GitHub 尚未设置强制要求测试成功的分支保护。

官方参考：[Git 集成](https://developers.cloudflare.com/pages/get-started/git-integration/)、[构建版本](https://developers.cloudflare.com/pages/configuration/build-image/)、[分支构建](https://developers.cloudflare.com/pages/configuration/branch-build-controls/)、[回退](https://developers.cloudflare.com/pages/configuration/rollbacks/)。
