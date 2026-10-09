# PowerPlot Studio 2.0

面向电力系统仿真的浏览器本地科研波形编辑器。在第一阶段项目上迭代，保留原始解析器、文件导入、分别 / 合并绘图与默认红黄蓝配色，新增 IEEE 尺寸模板、自由编辑、多子图、物理尺寸导出、矢量 PDF、批量 ZIP 与样式同步。项目保存和大数据降采样仍属第三阶段。

## 安装与运行

推荐 Node.js 24 和 pnpm 11.25.0。项目使用 `pnpm-lock.yaml` 固定已验证依赖。

```powershell
cd powerplot-studio # 进入下载或克隆后的项目目录
# 若未安装 pnpm：npm install -g pnpm@11.25.0
pnpm install --frozen-lockfile
pnpm dev
```

打开终端显示的地址（默认 `http://127.0.0.1:5173`）。首次安装需要联网；应用运行不依赖第三方 API。Windows PowerShell 若拦截 pnpm 的脚本，可使用 `pnpm.cmd` 执行相同命令。

```powershell
pnpm test       # Vitest 数据解析与曲线映射测试
pnpm build      # TypeScript 检查与 Vite 生产构建
pnpm preview    # 预览 dist 生产产物，默认端口 4173
pnpm test:e2e   # 本机已安装的 Microsoft Edge，自动启动生产预览
pnpm.cmd check  # 依次执行单元测试、构建、浏览器测试
```

浏览器测试需先构建，Windows 本地默认使用已安装的 Edge；其他系统和 CI 使用 Chromium，先执行 `pnpm exec playwright install chromium`。GitHub Actions 会安装浏览器及系统依赖并运行完整 `pnpm check`。可设置 `PLAYWRIGHT_BASE_URL` 对实际部署地址运行同一套验收，不会启动本地预览服务器。

## 使用方法

1. 点击“导入数据”或将一个 / 多个 TXT、CSV 文件拖入窗口，导入后自动绘图。
2. 默认分别绘图；左侧切换“合并绘图”可叠加不同采样间隔的曲线。
3. 点击图表右上角“编辑”或在右侧“当前图表”选择编辑对象。每张独立图表拥有自己的配置，合并模式拥有单独配置。曲线名称、颜色与显示状态跟随原始文件，在模式间共享。
4. 右侧七类面板调整模板、坐标轴、曲线、字体与排版、图例、子图和导出。左侧基础标题 / 网格快捷设置作用于当前图表；标题留空时自动读取表头。
5. 拖动图表框选缩放，滚轮缩放，双击或点击“复位所有图表视图”恢复全范围。
6. 在“模板”设置 mm / inch 物理宽高，在“导出”选择 DPI。点击图表 PNG / SVG / PDF 按钮或面板“导出当前图表”；“全部图表打包 ZIP”导出当前模式的所有图表。缩放窗口、颜色、标题、显示状态一致，导出不包含网站工具栏。
7. 在“子图”选择上下双 / 三子图并点击“顺序分配曲线到子图”，也可在各曲线“样式”中手动分配。Y 轴独立编辑，共享 X 可开关。
8. 选择源图表后点击“应用格式到其他图表”。默认保护目标名称、颜色、范围；可勾选颜色与范围同步。

详细操作与浏览器验收路线见 [第二阶段使用说明](docs/PHASE2.md)。

“加载示例数据”会载入真实 PSCAD 示例以及三信号非等间隔示例。真实示例复制自原文件 `新建 文本文档1.txt`，原文件没有被修改。

## 数据规则

```csv
Time/s,Idc/pu
1.399,0.73515647689
1.400,0.733760958357
1.401,0.732487377526
```

- 第一列是原始时间；其余列各生成一条信号曲线。
- 自动识别逗号、Tab、空格；支持负数、科学计数法、BOM、不同换行格式。
- 文本首行自动识别为表头；纯数值首行视为数据，无表头时命名 `Curve 1`、`Curve 2`。无表头的时间轴使用 `Time`，不推断单位。
- 空行允许存在，任何非空无效行都会拒绝该文件，并报告原始行列位置；不会静默删除坏数据。批次内其他有效文件仍会导入。
- 支持非零起点、非等间隔、重复及非顺序时间；按输入顺序连接采样点，不排序、不重建时间、不统一采样。
- 每份文件的首三条信号默认为 `#E53935`、`#D4A000`、`#2563EB`，后续使用绿、紫、橙、青；合并图例包含文件名和信号名。
- 当前支持 UTF-8 / ASCII 的简单分隔文本。空格分隔的表头字段不能包含空格；本版不处理带引号的 CSV 字段、多行字段、小数逗号、注释行。建议从仿真软件导出简单数值表。

数据使用 JavaScript 双精度数值表示。原始时间与波形数值完整保留在内存中；不做插值、平均、平滑、滤波或数值缩放。原始文件不写回、不上传，刷新页面后需重新导入。

## 架构与目录

```text
src/
  parser.ts          独立纯解析器与后续数据适配器接口
  import.worker.ts   后台线程读取与解析
  importFile.ts      File API 与 Worker 调度
  model.ts           原始数据到 Plotly 曲线映射
  config.ts          每图配置、IEEE 默认值、物理尺寸与格式同步
  layout.ts          统一论文画布、刻度与多子图布局
  Editor.tsx         七类参数面板
  export.ts          SVG 快照、PNG、矢量 PDF 与 ZIP
  png.ts             PNG DPI 元数据
  Chart.tsx          预览生命周期、图例联动与图片导出
  App.tsx            文件管理、中文工作区与基础参数
  styles.css         Tailwind CSS 与界面样式
  *.test.ts          解析与数据映射单元测试
e2e/
  workspace.spec.ts  真实浏览器工作流测试
  paper.spec.ts      第二阶段模板、多子图、PDF、同步与 ZIP 验收
public/examples/
  pscad-real.txt     501 点真实 PSCAD 导出
  multi-signal.csv  三曲线、非等间隔时间与尖峰
  no-header.txt     无表头与科学计数法
  invalid.csv       错误提示示例
docs/
  PHASE2.md          第二阶段功能说明与浏览器验收方法
  ROADMAP.md         第三阶段规划
  VALIDATION.md      当前验收结果与限制
dist/               生产构建输出
```

纯前端 React + TypeScript + Vite，Plotly 基础发行包绘制 SVG 曲线，Tailwind CSS 样式，Vitest 与 Playwright 测试。解析在 Web Worker 中运行；Plotly 在首次导入后按需加载。jsPDF / svg2pdf.js / JSZip 按需加载用于导出。无需服务器、数据库、账户、环境密钥或在线绘图服务。

## 导出与当前边界

IEEE 单栏默认 3.5 × 2.2 inch，双栏宽度 7.16 inch。模板为可编辑起点，不保证符合全部期刊要求。尺寸单位可在 mm / inch 之间保持物理长度换算；曲线线宽默认 1.5 pt，字体字号与边距均以 pt 配置。

预览以 96 CSS px / inch 建立规范画布，然后整体等比例放大显示。导出先冻结当前图表的布局与范围，三种格式共用这份 SVG：PNG 栅格化到精确像素尺寸并写入 pHYs DPI 元数据，SVG 标明物理 inch 尺寸，PDF 使用同样布局和真实 pt 页面大小。**3.5 × 2.2 inch、600 DPI → 2100 × 1320 px**。原始数组完整保留，关闭线段简化，不降采样、不平滑。

PDF 经 svg2pdf.js / jsPDF 转换，曲线、网格、坐标轴为矢量路径，文字保持文字元素。拉丁字体使用标准 Times / Helvetica / Courier，中文、非 ASCII 字符嵌入 SIL OFL 的 Noto Sans SC 字形子集；未捆绑受限的系统 Times New Roman 文件。因此 PDF 的系统字体外观及混合文字宽度可能略有差异，正式投稿前请检查。字体缺失的字符、Emoji / 超出 BMP 的字符会明确拒绝 PDF，可改用 SVG。

选择 Noto Sans SC 后预览会加载同源字体，SVG 会内嵌整份字体以便独立打开，文件较大（约 14 MB）；默认系统字体的 SVG 不嵌入字体，接收设备需安装对应字体。PDF 字体按使用字形子集嵌入。字体源与许可见 `public/fonts/README.md`、`OFL.txt`。

支持简单数值轴与普通文本；不包含 MathJax 公式渲染、复杂富文本字体嵌入、任意外部 SVG 转换。图内 / 手动图例可能遮挡数据，需用户调整；极长标题、多图例和密集刻度需要增大物理尺寸或减小字号。绘图区不足时明确报错，避免默默生成不可读图片。

图片宽高范围 1–30 inch，DPI 72–1200；PNG 单边不超过 16000 px，总像素不超过 4000 万。ZIP 按顺序渲染图表，失败时提示，不静默遗漏。

本版尚未针对百万点做交互降采样或压力测试。Worker 减少解析对主线程的阻塞，但全量 Plotly SVG 绘图 / 导出可能占用较多内存并影响流畅度。第三阶段将增加按可视范围保留极值的预览与导出策略，原始数组始终保留。

Vite 会提示 Plotly 绘图模块大于 500 kB；它已从首屏主包分离并延迟加载，这是体积提示，构建成功。基础发行包避免引入本工具不需要的 3D、地图功能。

## Cloudflare Pages 部署

项目为静态网站，本项目采用 Pages 的 Git 集成自动构建。首次公开发布需项目所有者确认，目前尚未发布；实际仓库和网站地址在完成部署后记录到 [部署说明](docs/DEPLOYMENT.md)。Git 集成配置：

- 构建命令：`pnpm build`
- 输出目录：`dist`
- 根目录：本项目目录
- 正式分支：`main`；其他分支启用预览部署
- Node.js：24.19.0（项目附 `.node-version`，也可设置 `NODE_VERSION`）
- 包管理器：设置 `PNPM_VERSION=11.25.0`，与项目 `packageManager` 保持一致

无需 Pages Functions、数据库、后端或运行时密钥。随项目附带的示例已获所有者公开许可；用户在浏览器导入的数据不会进入构建产物。网站仅请求同源示例和字体，不含分析埋点或数据上传接口；托管服务仍会接收到正常的网页、字体和示例下载请求。

后续更新：创建开发分支、修改并执行 `pnpm check`、提交并推送、验收 Pages 预览后合并到 `main`。GitHub Actions 检查与 Pages 构建独立运行；若要禁止失败测试进入正式分支，需在 GitHub 配置分支规则要求 `check` 成功。Pages 使用 `pnpm build`，不会自动等待另一套 CI。具体登录、授权、构建设置、回退和公网验收步骤见 [部署说明](docs/DEPLOYMENT.md)。

官方资料：[React / Pages](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/)、[构建配置](https://developers.cloudflare.com/pages/configuration/build-configuration/)、[构建工具版本](https://developers.cloudflare.com/pages/configuration/build-image/)、[Plotly 图片导出](https://plotly.com/javascript/static-image-export/)。本次未进行远程部署。

## 开源依赖

React、Plotly.js、Vite、Tailwind CSS、Vitest、jsPDF、svg2pdf.js 为 MIT 许可；JSZip 使用 MIT / GPLv3 双许可，本项目按 MIT 使用；TypeScript 和 Playwright 为 Apache-2.0，Noto 字体为 SIL OFL 1.1。发布时保留相应依赖许可，可通过各包内的 LICENSE 查看完整条款。项目自身许可证尚未选定，公开可读不代表已授予开源许可；本项目未新增 LICENSE。
