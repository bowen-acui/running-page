# Running Page Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 修正跑步网站的数据误导与同步风险，让手机上能迅速找到单次跑步，并让分析、分享和热力图与实际数据一致。

**Architecture:** 保留现有 React/Vite 页面、GitHub Pages 部署和暖色卡片视觉。`src/static/activities.json` 是网站的活动数据源；本地增量导入只追加新活动，SVG、首页和 `/summary` 都从这份数据更新。远程工作流在没有输入文件时直接失败，不再假装完成同步。

**Tech Stack:** React 19、TypeScript 6、Vite 8、CSS Modules、Python 3.11、现有 GPX 解析器、GitHub Actions。

---

## 边界与实施顺序

- 本计划只覆盖 2026-10-03 网站审查中列出的七类问题。不重做视觉、不迁移框架、不修改旧活动的距离、时间、路线或心率。
- 本计划不假设已经配置了 Strava API 应用或 OAuth 授权。第一阶段提供安全的本地 GPX 增量导入命令；真正无人值守的 Strava 同步需要先核实并完成授权，不能靠静态 GitHub Pages 按钮实现。
- 每个任务作为独立小改动提交。任务 1 和 2 是数据安全前置条件；任务 3 依赖任务 2；任务 4 至 11 可在数据边界稳定后依次完成。
- 计划中的命令是实施时的验收步骤；编写本计划时没有运行测试、导入或部署。

## 当前基线与文件职责

撰写前 `main` 工作区干净。`activities.json` 有 64 条活动，其中 62 条为 Run、2 条为其他类型；最近一条是 2026-09-28。现有 GPX 解析器以轨迹起始时间的毫秒时间戳生成 `run_id`。首页由 `src/pages/index.tsx` 组合统计、表格与懒加载地图；`/summary` 由 `src/components/ActivityList/` 组合分析面板；分享封面在 `src/components/SharePoster/`。`gh-pages.yml` 从 `main` 构建发布。

| 工作包 | 主要文件 | 单一职责 |
| --- | --- | --- |
| 数据文案 | `src/static/site-metadata.ts`、`src/components/DataStatusBar/index.tsx`、`src/components/LocationStat/LocationSummary.tsx` | 只显示有证据的数据 |
| 同步防护 | `.github/workflows/run_data_sync.yml` | 拒绝空输入与意外提交 |
| 增量导入 | 新建 `run_page/import_incremental_gpx.py`、修改 `package.json`、`README-CN.md` | 解析本地 GPX，审计差异，只追加新活动 |
| SVG 一致性 | `scripts/refresh-svg-stats.mjs`、`.github/workflows/gh-pages.yml` | 从活动 JSON 更新统计和日期图点 |
| 手机首页 | `src/components/LocationStat/index.tsx`、`src/components/RunTable/RunRow.tsx`、`src/components/RunTable/style.module.css` | 把总览和活动日期放到手机可见位置 |
| 分析页 | `src/components/ActivityList/index.tsx`、`chrome.tsx`、`panels.tsx`、`style.module.css` | 合理的月视图默认值、信息层级和可点热力图 |
| 分享与语言 | `src/components/SharePoster/index.tsx`、`index.html`、`src/components/Layout/index.tsx`、`src/pages/index.tsx`、`src/pages/total.tsx`、`src/main.tsx` | 焦点、页面语言及加载文案 |

## 阶段一：数据可信度和同步安全

### Task 1：修正数据来源和空地点统计

**Files:** `src/static/site-metadata.ts`、`src/components/DataStatusBar/index.tsx`、`src/components/LocationStat/LocationSummary.tsx`

- [x] **Step 1：去掉未经数据支持的 Garmin 标签。** 现有活动只有 `run_id`、时间、路线等字段，没有可靠的逐条来源字段。先把 `activitySource` 改为“导入的运动记录”，`DataStatusBar` 仍显示最近活动时间和跑步条数；不要推断所有记录都来自 Strava。
- [x] **Step 2：地点全部缺失时不渲染地点摘要。** `countries`、`provinces` 和 `cities` 是空集合时，`LocationSummary` 返回 `null`；有部分地点时只显示有值的国家、省份、城市，不显示没有资料的类别。判断必须用 `.length` 或 `Object.keys(...).length`，不能再用数组／对象的真值。
- [x] **Step 3：检查显示。** 桌面和手机首页不再写“Garmin”或“0 个国家／省份／城市”；活动数仍是 62，最近活动仍是 2026-09-28。用有地点资料的输入时，非零地点统计仍能出现。

### Task 2：给现有远程同步按钮加硬性防护

**Files:** `.github/workflows/run_data_sync.yml`

- [x] **Step 1：在 `only_gpx` 同步前加输入检查。** GitHub checkout 后只会得到 `GPX_OUT/.gitkeep`，没有本机忽略的 `.gpx`。在 `python run_page/gpx_sync.py` 前检查至少存在一个 GPX；没有时以非零退出并输出“没有 GPX 输入，未改动活动数据”。示意命令：

  ```bash
  find GPX_OUT -maxdepth 1 -type f -name '*.gpx' -print -quit | grep -q . || {
    echo '::error::No GPX input; activities.json was not changed'
    exit 1
  }
  ```

- [x] **Step 2：限制提交范围。** 将当前的 `git add .` 收紧为该同步流程实际生成的活动 JSON 和 SVG 文件；在提交前核对新 `activities.json` 不为空、跑步条数不低于 checkout 时的数量。若数量下降，直接失败，不提交也不触发 Pages 部署。保留非跑步活动。
- [x] **Step 3：验证空输入场景。** 在与 GitHub runner 等价的干净 checkout 中，没有 GPX 时工作流应在导入前失败，`src/static/activities.json` 保持原样。不要把失败的工作流显示成“同步完成”。

### Task 3：提供可重复执行的本地增量 GPX 导入

**Files:** 新建 `run_page/import_incremental_gpx.py`；修改 `package.json`、`README-CN.md`

- [x] **Step 1：输入保持明确。** 命令接收一个含 `.gpx` 的本地目录，例如 `python3 run_page/import_incremental_gpx.py /path/to/new-gpx`。先验证目录、文件数量和现有 `activities.json` 均有效；没有文件或解析结果为空时非零退出，不写任何仓库文件。不要假设已删除的旧导出目录仍存在。
- [x] **Step 2：复用现有解析器，在临时目录里解析。** 使用 `tempfile.TemporaryDirectory()` 给 `make_activities_file(temp_db, input_dir, temp_json)` 提供临时数据库和临时 JSON；不要调用会从零覆盖正式 JSON 的 `gpx_sync.py`。先逐个验证 GPX 有起始时间和轨迹点，因为现有解析器会跳过坏文件；解析成功数与有效输入文件数不一致时列出未导入文件并停止。
- [x] **Step 3：按 `run_id` 合并。** 现有对象原样保留；已存在的 `run_id` 计为跳过，不覆盖旧字段；新 `run_id` 还要与现有活动比对 `start_date`、类型和近似距离，疑似跨来源重复时报告冲突并停止，让实施者核对。最终按 `start_date_local` 升序排列。新活动的 `streak` 由合并后的跑步日期计算；不回写旧活动。
- [x] **Step 4：先汇总，后写入。** 打印 `旧活动数 / 解析数 / 新增数 / 重复数 / 冲突数 / 新活动数`。允许 `--dry-run` 只输出报告；实际写入使用同目录临时文件加 `os.replace`，确保解析失败不会留下半份 JSON。`新增数 = 0` 时不改写文件。
- [x] **Step 5：暴露一个本地入口并写清用法。** `package.json` 加 `data:import:gpx`，在 `README-CN.md` 写出创建 Python 环境、放入新的 GPX、执行命令、核对报告、提交发布的短流程。说明网站内的按钮不能直接读取 Strava；本命令是当前无需账号授权的路径。
- [x] **Step 6：验收四个输入场景。** 相同 GPX 重跑不增加记录；两个新 GPX 只增加两条；空目录不改文件；与旧活动时间和距离相同但 ID 不同的输入被标记为冲突。旧 64 条对象的字段值逐条保持一致，路线 `summary_polyline` 仍存在。

### Task 4：让 SVG 图点和数字从同一份 JSON 更新

**Files:** `scripts/refresh-svg-stats.mjs`、`.github/workflows/gh-pages.yml`、`assets/github.svg`、`assets/year_summary_*.svg`

- [x] **Step 1：从 `activities.json` 建立日期到跑步距离的索引。** 只统计 `type === 'Run'`；同一天多次跑步累计距离。保留当前脚本已有的次数、总里程、配速等文字计算。
- [x] **Step 2：刷新 SVG 日期图点。** `github.svg` 的 `<rect>` 和 `year_summary_YYYY.svg` 的 `<circle>` 都带有 `<title>YYYY-MM-DD…</title>`。按日期定位图点，更新 `fill` 与标题里的距离；没有跑步的日期使用空状态色。沿用现有 SVG 生成器的颜色阈值与格式，不改坐标、尺寸或其他装饰。找不到某个日期的 SVG 图点时失败并报告日期，避免静默漏更。
- [x] **Step 3：让脚本变更可发布。** `gh-pages.yml` 的 `on.push.paths` 当前只列出 `scripts/generate-ai-summary.mjs`；加入 `scripts/refresh-svg-stats.mjs`，保证以后单独修图点逻辑也能触发部署。
- [x] **Step 4：验收一致性。** 用一条新增活动模拟导入后，活动表、首页统计、`/summary` 热力图以及 `assets/github.svg`、对应年份 `year_summary` 的日期图点都包含该日；第二次刷新 SVG 无文件差异。发布前再核对首页和 `/summary` 的次数、距离一致。

## 阶段二：手机首页和分析页

### Task 5：让手机首屏先看到跑步总览

**Files:** `src/components/LocationStat/index.tsx`、必要时同目录局部样式文件、`src/pages/index.tsx`

- [x] **Step 1：调整手机内容顺序。** 在 `<=768px` 时，`YearStat year="Total"` 放到时段分布 `PeriodStat` 前面；桌面继续保留当前侧栏样式。若 Task 1 隐藏了空地点摘要，手机首屏应直接进入总览卡，而非先看四组“午后／清晨”等分类。
- [x] **Step 2：保留现有交互。** 年度卡、时段筛选、地图展开与统计切换仍用原回调；不要复制第二份总览数据组件或改变 URL hash。
- [x] **Step 3：验收 390px 与桌面。** 手机首次加载在首屏看见跑步次数、总里程和平均配速，且不出现地点零值；桌面仍能使用原侧栏筛选。选中一次跑步后，地图仍自动展开并定位到该路线。

### Task 6：活动表先显示日期，再显示重复的跑步名称

**Files:** `src/components/RunTable/RunRow.tsx`、`src/components/RunTable/index.tsx`、`src/components/RunTable/style.module.css`

- [x] **Step 1：确定手机行的最小识别信息。** 将日期以短格式 `YYYY-MM-DD` 放在每行固定可见区域，名称作为次要文字；完整时间保留在行的可访问名称或详情里。桌面表格的排序列和完整日期保持当前行为。
- [x] **Step 2：只改手机布局。** `<=768px` 下第一列固定显示日期和跑步名称；其余距离、配速、心率、时长仍可横向滚动。避免只把日期列移到最左边而让桌面列标题与单元格错位。
- [x] **Step 3：验收选择状态。** 不横向滚动即可区分 2026-09-27 与 2026-09-28 两条“午后跑步”；点任一行，选中行、URL `#run_...`、地图日期、距离和配速指向同一条；键盘 Enter/Space 仍可选中。

### Task 7：整理分析页默认月份和热力图层级

**Files:** `src/components/ActivityList/index.tsx`、`chrome.tsx`、`panels.tsx`、`style.module.css`

- [x] **Step 1：月视图默认最近有跑步的月份。** 用已按时间排序的 `yearRuns[0]?.month` 替代当前 `peakMonth` 作为首次点击“月”的选择；增加 `lastSelectedMonth` 状态，在用户点击月份柱时更新它，切到“年”时只清空可见的 `selectedMonth`，切回“月”时优先恢复 `lastSelectedMonth`。月度跑量柱状图仍可以突出最高跑量月，不混同于默认月份。
- [x] **Step 2：去掉首屏重复。** 顶部 `ContextStrip` 保留月份／全年、次数、距离、配速；`FrequencyPanel` 的默认 `overviewDetail` 不再重复展示六项指标。用户点击日期或图表元素后，`DetailCard` 才显示该元素的具体数据。最长连续与最长断档继续留在已有的习惯分析面板。
- [x] **Step 3：扩大手机热力图的可点区域。** 当前手机 CSS 虽声明 `--heat-cell-min: 12px`，实际 grid 列仍是 `minmax(0, 1fr)`，图点可以缩得更小。给月视图和年视图设置真实的最小列宽与横向滚动；保留清楚的月份或日期提示，不让 31 天挤在 390px 一行。空白占位仍不可点击。
- [x] **Step 4：验收。** 最新活动在 9 月时，第一次点“月”进入 9 月；点 8 月柱后切回年、再切月仍是 8 月。手机首屏可见热力图的一部分，点击 9 月 28 日后详情显示该日次数和距离；横向滚动不带动整个页面。

## 阶段三：文案和无障碍

### Task 8：让训练建议的来源标签跟着内容走

**Files:** `src/components/ActivityList/index.tsx`、`src/components/ActivityList/panels.tsx`

- [x] **Step 1：给 `InsightPanel` 传当前内容的来源。** 年度视图在 `ai-summary.json` 有可用结果时用其 `source/model`；月度视图既然调用 `getAiSummary(...)`，就明确显示“本月数据整理”，不沿用年度 DeepSeek 标签。若年度结果也由本地规则生成，使用普通用户看得懂的“基于跑步记录生成”，不显示“配置 DeepSeek 后会自动替换”这类实现说明。
- [x] **Step 2：验收两种年度来源。** 本地 `source: local` 时显示本地说明；CI 生成 `source: deepseek` 时年度显示 DeepSeek；两种情况下的月度都不声称由 DeepSeek 生成。训练目标文案只在年度视图按现有逻辑出现。

### Task 9：修复分享弹窗焦点

**Files:** `src/components/SharePoster/index.tsx`

- [x] **Step 1：打开时把焦点移入弹窗。** 在挂载 effect 中保存 `document.activeElement`，将焦点放到关闭按钮或弹窗标题；在关闭／卸载时将焦点返回“生成封面”按钮。保留现有 Esc、点击遮罩关闭和滚动锁定。
- [x] **Step 2：限制 Tab 在弹窗内部循环。** 列出弹窗中可用的按钮，首尾循环；隐藏在背景里的首页或分析页控件不能在弹窗开启时接收 Tab。`aria-modal="true"` 已有，无需加第二个 dialog。
- [x] **Step 3：验收键盘和手机。** 仅用键盘打开弹窗，焦点进入弹窗；Tab/Shift+Tab 只遍历比例、配色和保存控件；Esc 后焦点回到“生成封面”。390px 手机视口中预览和两个保存动作仍可见、可点。

### Task 10：统一中文页面语义与加载文案

**Files:** `index.html`、`src/components/Layout/index.tsx`、`src/pages/index.tsx`、`src/pages/total.tsx`、`src/main.tsx`、`src/components/SVGStat/index.tsx`、`src/static/site-metadata.ts`

- [x] **Step 1：统一语言。** 把各处 `<html lang="en">` 改为 `lang="zh-CN"`；不删除现有 `data-theme` 设置。
- [x] **Step 2：改正站点描述与等待文案。** 把 `Personal site and blog` 改成准确的跑步网站描述；把首次路由加载的 `Loading view...` 和 SVG 的 `Loading...` 改成简短中文。保留 `Running Journal` 等刻意作为视觉风格的栏目标题。
- [x] **Step 3：验收。** 首页和 `/summary` 的文档语言都是 `zh-CN`，浏览器标题与描述指向跑步记录；慢速加载时不出现英语系统占位。浅色／深色切换和直接打开 `/summary` 仍正常。

## 阶段四：性能核对与发布

### Task 11：核对地图按需加载，而不先做猜测式拆包

**Files:** 先只检查 `src/pages/index.tsx`、`vite.config.ts` 和构建产物；只有失败时才修改对应文件。

- [x] **Step 1：在构建后检查资源关系。** 当前 Mapbox 文件约 1.7 MB，但地图组件已懒加载。用 `dist/.vite/manifest.json` 和手机浏览器 Network 确认：首页地图折叠时没有请求 Mapbox 包，用户展开地图或选中跑步后才请求。
- [x] **Step 2：记录真实体验。** 在普通手机网速下记录首页可操作时间与首次打开地图的等待时间；若地图折叠时已下载 Mapbox，修复静态导入边界；若只在地图打开后下载，则保留现有分包，优先改善加载提示，不因包体积单独重构。
- [x] **Step 3：验收。** 修改前后 `pnpm run build` 均成功；折叠状态的首页能完成统计、表格和 `/summary` 导航，地图资源不阻塞这些操作。

### Task 12：按增量发布并核对线上结果

**Files:** 本计划涉及的所有修改文件；不改旧活动对象。

- [x] **Step 1：每个阶段提交前看 diff。** `git diff --check`、`git diff --stat`、`git status --short`；特别确认没有把 GPX 原始轨迹、`run_page/data.db`、临时目录或密钥加入版本库。
- [x] **Step 2：运行仓库现有检查。** `pnpm run check`、`pnpm run lint`、`pnpm run build`；发布前运行现有 `pnpm test:smoke`。如果 Python CI 仍失败，单独记录原因，不用 Pages 构建成功代替整套 CI 结果。
- [x] **Step 3：逐条人工验收。** 桌面和 390px 手机检查：首页首屏、同名跑步日期、点选路线、年／月切换、单日详情、分享弹窗焦点、中文文案、空 GPX 保护以及数据条数。深色主题检查一次。首页和 `/summary` 的跑步次数、里程必须相同；显示最近活动日期的地方都与 JSON 最新记录一致。
- [ ] **Step 4：有发布授权时再推送。** `main` 推送后等待 GitHub Pages 完成，并实际打开线上首页和 `/summary` 核对同样的数字与交互；记录部署的提交 SHA。仅本地构建成功不算线上完成。

## 最终完成标准

1. 旧 64 条活动的原始字段不变；两条新 GPX 只新增两条，重复执行零新增，空输入零改动。
2. 首页、表格、地图、分析页、两个 SVG 对新增日期和总数一致；没有“Garmin”或缺失地点的“0”误导。
3. 390px 手机首屏可见跑步总览，活动日期无需横向滚动即可识别；点击记录能看到对应路线。
4. 月视图首次打开是最近有记录的月份，热力图可点；月度本地建议不标作 DeepSeek。
5. 分享弹窗键盘焦点正确，中文页面使用 `zh-CN`，地图包仍只在需要时加载。

## 不在本计划内的后续选择

如果目标是“跑完后完全不用导出文件就自动同步”，下一份独立计划需要先确定 Strava 授权方式、令牌保存位置和运行平台，再考虑定时增量拉取。当前 GitHub Pages 前端不能直接承担持久化同步；本计划先把现有数据和文件导入路径做稳。
