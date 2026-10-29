# GitHub 与 Cloudflare Pages 部署

## 2.2 预览验收（2026-10-10）

开发分支 `feature/composition-2.2`，功能提交 `3f5c334593a6e9be722032a558af596c65b9d9cc`；[GitHub Linux/Chromium CI](https://github.com/13914491579/powerplot-studio/actions/runs/38020378597) 全部成功。本地完整检查：53 项单元、24 组 Edge 浏览器、TypeScript 和构建均通过。

Cloudflare 构建日志确认资产发布与部署成功，实际预览为 [7341209a](https://7341209a.powerplot-studio.pages.dev)。对预览执行全部 24 组测试：首轮 15 组首次通过、8 组连接/等待超时重试后通过，1 组首页连接连续关闭而失败；该项随后单独重跑首次通过。因此全部场景已完成验收，不声称公网首轮整体退出码为 0。公网验收包括本地文件导入无上传、刷新、原有 2.1 功能与三种跨文件组合导出/ZIP。后续补充浏览器数据明确使用 .001、.02、.5 的首段采样间隔；本地完整 53/24 检查再次通过，并对同一公网预览补验数据保留/同源多实例场景，首页超时一次后重试通过。产品代码保持不变。

正式入口保持 [powerplot-studio.pages.dev](https://powerplot-studio.pages.dev)。预览通过后合并 main，继续使用现有 Pages Git 集成；最终正式提交及发布状态见交付结果。

## 2.1 发布记录（2026-10-10）

开发分支 `feature/grid-layout-2.1`；在既有 2.0 项目增量升级，原始解析器及导出管线继续使用，无依赖升级、无新服务或密钥。完整本地 `pnpm.cmd check` 已通过：45 项单元测试、18 组 Edge 端到端测试及生产构建。版本为 `2.1.0`。

- 功能提交 `611d4c6a0377af393093eb862fc62e2644929799` 的 [GitHub Chromium CI](https://github.com/13914491579/powerplot-studio/actions/runs/38016262378) 成功。
- 实际预览：https://ec60076c.powerplot-studio.pages.dev 。Cloudflare 预览构建与资产发布成功，正式站点在此期间保持 2.0。
- 对上述公网预览执行全部 18 组 Edge 测试，最终通过；14 组首次通过，4 组因首页 `ERR_CONNECTION_CLOSED` / `ERR_TIMED_OUT` 重试后成功，退出码为 0。此次网络不稳定与此前部署验收相同，不声称公网全部首次通过。
- 公网八种布局、独立/按列/全部 X、编号、配置恢复、尺寸推荐/手动保护、空坐标系、PNG/SVG/PDF、批量与旧工作流均通过。代表性 PNG、SVG 与 PDF 下载产物已检查；导入不触发上传请求，刷新正常。
- 验收通过后将开发分支合并 `main`，由既有 Git 集成部署正式版；正式入口保持 https://powerplot-studio.pages.dev 。功能代码在预览验收后没有变化，后续仅补充发布记录。

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

## 2.2 正式发布补充记录（2026-10-10）

- [PR #1](https://github.com/13914491579/powerplot-studio/pull/1) 已在最新分支三项检查通过后合并，正式功能提交为 `150c4087356bea197813fbcc3a0d73442d13ac71`；本地 main 已快进同步，无强制推送。
- 最新分支提交 `9c7a115` 的 [GitHub CI](https://github.com/13914491579/powerplot-studio/actions/runs/38022001079) 成功。实际预览 [710ab0f2](https://710ab0f2.powerplot-studio.pages.dev) 验收七组场景：五组首次通过、一组连接中断重试通过、一组 3×1 首页连接中断失败后单独补验首次通过。未将网络失败隐瞒为首轮全绿。
- Cloudflare 正式部署 `b9b1f14f-7f10-454d-863d-582339e1e56b` 日志确认 `150c408` 构建、资产发布、站点部署均成功；正式入口 https://powerplot-studio.pages.dev 显示 2.2 COMPOSE。
- 对正式网址运行七组 Edge 上线验收，退出码 0：六组首次通过，一组首页 ERR_TIMED_OUT 后重试通过。包含三文件按文件/按信号组合、不同采样间隔、同源多实例样式、同名文件、删除及模式隔离、容量提示、1×3/3×1/2×2 的 PNG/SVG/矢量 PDF/ZIP，以及刷新、严重错误和本地数据无上传检查。
- 正式站点实际示例组合截图已检查，独立时间轴和编号正确。测试产物仅保留在忽略目录 `.qa/`。本条发布记录为文档更新，产品代码与已验收预览一致。

## 2.3 正式发布（2026-10-28）

- [PR #2](https://github.com/13914491579/powerplot-studio/pull/2) 已合并，功能发布提交 `586651ad737efb0fbe0a0697cd3e759d0188b7eb`；正式入口 https://powerplot-studio.pages.dev 显示 2.3 LEGEND。
- 本地完整检查：57 项单元、30 组 Edge、TypeScript 和构建通过。增强的六组精细图例场景另行通过；原有全部 24 组浏览器场景保留。
- 实际预览 https://ee50b0d6.powerplot-studio.pages.dev 七组公网验收首次通过；分支两次 GitHub CI 与 Cloudflare 检查均通过后合并。
- 正式部署 `118a6eb3-f911-47f9-a5da-72c9aff8f53e` 成功，main CI 成功；正式站点七组验收全部首次通过，包括实际三个项目拖动、配置与显隐交互、四种多子图中文 SVG、PNG/PDF 以及本地处理隐私和刷新。
- PDF 已用 Poppler 渲染检查手动图例位置；浏览器测试验证无图片对象、存在文字 BT 与矢量路径。Poppler 本机标准替代字体提示未影响本次标签显示。
- Git HTTPS 连接持续重置，使用已授权 gh/GitHub Git API 上传：远程文件树 SHA 与本地功能提交逐一核对一致，保留 main 历史并通过 PR 合并，未强制推送。API 创建提交会重新生成提交 SHA：本地功能提交 1bcfcd5 对应远程 b4b3a68，内容一致。原先未推送的 2.2 发布补充记录也已包含在本次发布中。
- 详见 LEGEND23.md 的操作说明与字号/字体/空间限制。测试截图和导出文件保留在忽略目录 .qa/。

## 2.4 发布（2026-10-29）

新增独立 WebGL 瀑布/轨迹模块，保留全部二维模块与原测试。完整本地 pnpm.cmd check 59 项单元、33 组 Edge、TypeScript 与构建通过；最后相机修复后再次完整通过。实际预览 2bfffb89 的四组公网验收通过，修复版 49673c0e 三组三维验收通过；分支 CI 全绿后合并 PR #3/#4。实际真实 PSCAD 示例在三维绘图中仍为 501 点、1.9495–2.1995，不同文件的 11 点数组继续独立。

主功能提交 5ad392b，相机修复提交 5690dcf，最终功能合并 d51af126b564d11017886120fefd93fdc706ff06。Git HTTPS 网络连接重置，采用已有 gh 授权的 Git API 提交增量文件并通过 PR 合并，无强制推送或改写 main。三维 PNG 实测 300/600 DPI；原有二维 PNG/SVG/矢量 PDF/ZIP 回归通过。三维 SVG/PDF 首版不提供，避免将 WebGL 栅格绘图区误称矢量；百万点、不同显卡尚未压力认证。

正式站点 https://powerplot-studio.pages.dev 的四组上线验收全部首次通过（20.7s）；最终功能部署 bd6ffa63-6444-4e4b-aba6-49006a30de5f 成功，main CI 成功。验证包含三维交互/导出、时间轴拒绝、二维返回及本地处理隐私/刷新。

## 2.5 发布（2026-10-29）

PR #5 已合并，功能合并提交 `189611f238b73b4f699c345c9e44b5e492162cee`。开发分支 feature/three-d-layout-2.5，远程功能提交 5517a6b / 3bc5e25（本地 f4046e5 / dec32d8 / 7ad29b1；通过已授权 Git API 创建增量提交，保留 main 历史，无强制推送）。

完整本地 pnpm.cmd check：59 项单元、36 组 Edge、TypeScript 与 Vite 构建全部通过。原 33 组二维/三维浏览器场景保留。实际 WebGL 矩阵投影验证 X 正方向从左到右，原时间数组不变；验证单项图例拖动、相机与图例状态隔离、PNG 像素中有图例线段及自定义 400 DPI/1.5 倍预览不改变物理像素尺寸。

预览 https://f4cde476.powerplot-studio.pages.dev 七组验收全部首次通过；分支两次 CI 和 Cloudflare 检查成功后合并。正式部署 72679e07-0465-48d6-a461-2fa6ad87509c 成功，main CI 成功。正式 https://powerplot-studio.pages.dev 七组上线验收全部首次通过（40.5s），含真实 PSCAD、投影方向、图例/相机/PNG、轨迹时间校验及隐私刷新。

默认视角最终调整为 (1.6,-1.6,1.2)，为轴标签保留空间，实际 PNG 已查看；截图/导出产物保留在忽略目录 .qa/production25。使用说明与限制见 LAYOUT25.md。3D 仍只提供 PNG，二维 PNG/SVG/矢量 PDF/ZIP 均保持。
