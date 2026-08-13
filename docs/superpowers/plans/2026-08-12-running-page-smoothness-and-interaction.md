# Running Page Smoothness and Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不新增功能、不改变首页与 Summary 页面框架的前提下，完成未验证改动的收口，降低首页地图带来的初始加载与重复工作，并修复快速交互和资源清理中的逻辑风险。

**Architecture:** 保留当前 React/Vite 页面结构与现有数据模型。首页只保留轻量地图状态和类型，地图计算与 Mapbox 运行时代码在地图真正需要显示时按需加载；地图内部统一生命周期与异步选择的所有权，避免重复监听、重复换肤和过期异步结果覆盖当前状态。Summary 只做回归验证与必要的交互缺陷修复，不改视觉结构。

**Tech Stack:** React 19、TypeScript 6、Vite 8、Mapbox GL / react-map-gl、CSS Modules、ESLint、Prettier、GitHub Actions。

---

## Scope and guardrails

- 不新增页面、图表、筛选、动画或数据字段。
- 不改变首页、地图、数据表和 Summary 的现有视觉框架。
- 不删除当前工作区里来源不明的改动；特别是已有删除项必须先确认归属。
- 不把 Mapbox 大包本身当作缺陷；目标是让它只在地图实际挂载时下载。
- 不在本计划执行过程中自动 commit 或 push；完成本地预览并由用户确认后再处理 Git。

## Current evidence

- `pnpm exec eslint ...` 已通过。
- `npm run build` 已通过。
- 当前 Mapbox chunk 为约 `1.77 MB` minified / `482 KB` gzip。
- 当前 manifest 仍显示 `src/pages/index.tsx` 的静态 imports 包含 Mapbox；懒加载拆分尚未达到验收目标。
- `src/pages/index.tsx`、`src/utils/geoUtils.ts`、`src/utils/mapTypes.ts` 的最后一轮拆分此前没有做过浏览器回归。
- `RunMap` 当前存在两个明确的生命周期风险：切换开灯状态可能触发整套地图样式重载；ref 回调内注册的 `data` 监听器没有稳定清理。
- 首页路线选择使用异步 `import()` 后没有请求序号，快速连续点击可能让较早请求覆盖较新选择。

## Files in scope

**Modify:**

- `src/pages/index.tsx`：地图按需加载、选择竞态、动画和过滤状态。
- `src/components/RunMap/index.tsx`：地图主题、图层开关、监听器和动画生命周期。
- `src/utils/geoUtils.ts`：只保留地图运行时几何实现。
- `src/utils/mapTypes.ts`：保留不引入运行时代码的地图共享类型。
- `src/hooks/useInterval.ts`：仅在验证发现动画闭包或清理问题时修改。
- `src/components/ActivityList/index.tsx` 及其同目录辅助文件：仅修复回归中确认的交互问题。
- `src/pages/total.tsx`：仅修复回归中确认的滚动或主题问题。
- `vite.config.ts`：只调整可验证的分包规则。
- `package.json`：让本地与 CI 的检查命令不隐式改写源码。
- `.github/workflows/ci.yml`：调用只读检查命令。

**Do not modify unless a regression requires it:**

- `src/static/activities.json`
- `src/static/ai-summary.json`
- `run_page/**`
- `.github/workflows/gh-pages.yml`
- `.github/workflows/run_data_sync.yml`
- 首页与 Summary 的布局样式文件

---

### Task 1: Freeze the worktree boundary and verify the interrupted diff

**Files:**

- Inspect: all changed and untracked files from `git status --short`
- Test: `src/pages/index.tsx`, `src/components/RunMap/index.tsx`, `src/utils/geoUtils.ts`, `src/utils/mapTypes.ts`

- [ ] **Step 1: Record the exact dirty-worktree boundary**

Run:

```bash
git status --short
git diff --stat
git diff -- src/pages/index.tsx src/components/RunMap/index.tsx src/utils/geoUtils.ts src/utils/mapTypes.ts vite.config.ts
```

Expected: the map lazy-loading diff is visible; unrelated deletions and `src/utils/colorUtils.ts` remain untouched.

- [ ] **Step 2: Run read-only formatting, lint, and build checks**

Run:

```bash
pnpm run check
pnpm exec eslint src/pages/index.tsx src/components/RunMap/index.tsx src/components/ActivityList src/pages/total.tsx src/utils/geoUtils.ts src/utils/mapTypes.ts --ext .ts,.tsx
pnpm run build
```

Expected: all commands exit `0`. If formatting fails, format only files changed by this optimization, never the whole repository.

- [ ] **Step 3: Inspect the production chunk graph**

Run:

```bash
node -e "const m=require('./dist/.vite/manifest.json'); for (const k of ['src/pages/index.tsx','src/components/RunMap/index.tsx','src/pages/total.tsx']) console.log(k, JSON.stringify(m[k], null, 2));"
```

Expected before the fix: the homepage entry still lists the Mapbox chunk. Save this as the failing performance assertion.

---

### Task 2: Make map runtime loading genuinely lazy

**Files:**

- Modify: `src/pages/index.tsx`
- Modify: `src/utils/geoUtils.ts`
- Modify: `src/utils/mapTypes.ts`
- Modify if proven necessary: `vite.config.ts`

- [ ] **Step 1: Trace the remaining static Mapbox edge**

Run:

```bash
rg -n "from ['\"](?:mapbox-gl|react-map-gl|@mapbox|@math.gl|gcoord)|geoUtils" src --glob '*.{ts,tsx}'
```

Expected: all Mapbox/runtime geometry imports are limited to `RunMap` and dynamically loaded `geoUtils`; shared homepage types come only from `mapTypes.ts` using `import type`.

- [ ] **Step 2: Keep homepage map state runtime-free**

Implement the smallest change required so `src/pages/index.tsx` contains:

```ts
import type { FeatureCollection, LineString } from 'geojson';
import type { IViewState } from '@/utils/mapTypes';

type GeoUtilsModule = typeof import('@/utils/geoUtils');

const loadGeoUtils = () => import('@/utils/geoUtils');
```

No runtime export from `geoUtils.ts` may be statically imported by the homepage. Do not duplicate geometry algorithms in the page.

- [ ] **Step 3: Keep Mapbox component loading behind the existing map gate**

Retain:

```ts
const RunMap = lazy(() => import('@/components/RunMap'));
```

Render it only when the existing `shouldDisplayMap` condition is true. The collapsed mobile map placeholder must not import `RunMap` or `geoUtils`.

- [ ] **Step 4: Rebuild and verify the chunk assertion**

Run:

```bash
pnpm run build
node -e "const m=require('./dist/.vite/manifest.json'); console.log(JSON.stringify(m['src/pages/index.tsx'], null, 2));"
```

Expected: `src/pages/index.tsx.imports` does not contain `_mapbox-*.js`; Mapbox appears only under the dynamic `RunMap` path. If Vite still hoists it, inspect the chunk graph before changing `manualChunks`; do not suppress the warning as a substitute.

---

### Task 3: Prevent stale route selections from winning

**Files:**

- Modify: `src/pages/index.tsx`

- [ ] **Step 1: Add a monotonically increasing selection request token**

Add one ref next to the existing map refs:

```ts
const locateRequestRef = useRef(0);
```

At the start of `locateActivity`, capture the current request number:

```ts
const requestId = ++locateRequestRef.current;
```

- [ ] **Step 2: Ignore stale async geometry results**

Immediately after `await loadGeoUtils()` and before every map-state update, require:

```ts
if (requestId !== locateRequestRef.current) return;
```

Increment the token when filters clear the current route selection. This ensures rapid row clicks end on the last clicked route.

- [ ] **Step 3: Keep URL, table highlight, detail card, and map updates atomic**

The accepted request must update these values from the same `selectedRuns` snapshot:

```ts
setRunIndex(nextRunIndex);
setSelectedRun(nextSelectedRun);
setAnimatedGeoData(selectedGeoData);
setViewState(selectedBounds);
setTitle(titleForShow(lastRun));
```

Do not add loading overlays or new UI.

- [ ] **Step 4: Verify rapid selection behavior in a browser**

Test:

1. Open the homepage.
2. Expand the map if using a mobile viewport.
3. Click three different table rows quickly.
4. Use browser Back once, then Forward once.

Expected: the final row, URL hash, map route, date, distance, pace, and time all refer to the same run; Back clears or restores selection consistently.

---

### Task 4: Remove redundant map style reloads and leaked listeners

**Files:**

- Modify: `src/components/RunMap/index.tsx`

- [ ] **Step 1: Separate theme-style changes from lights visibility changes**

The `map.setStyle(mapStyle)` effect must depend on `mapStyle`, not on every `lights` change. Preserve the latest lights value with a ref:

```ts
const lightsRef = useRef(lights);
lightsRef.current = lights;
```

Inside `style.load`, call:

```ts
switchLayerVisibility(map, lightsRef.current);
```

The existing dedicated lights effect remains responsible for visibility toggles. Expected result: pressing the light control does not reload tiles or reset the map style.

- [ ] **Step 2: Replace the anonymous persistent `data` listener**

Use a named handler and register it only until initial style setup is complete:

```ts
const handleInitialStyleData = (event: MapDataEvent) => {
  if (event.dataType !== 'style') return;
  // existing label removal and visibility setup
  map.off('data', handleInitialStyleData);
};
```

Ensure the listener is also removed when the ref changes or the component unmounts. Do not register a new language control on every callback invocation.

- [ ] **Step 3: Stop animation and timers on route change/unmount**

Keep one cleanup path that:

```ts
routeAnimatorRef.current?.stop();
routeAnimatorRef.current = null;
```

Verify all `setTimeout`, `fullscreenchange`, map `error`, map `tileerror`, `style.load`, and initial `data` listeners have paired cleanup.

- [ ] **Step 4: Verify map lifecycle behavior**

Test in a real browser:

1. Toggle light/dark mode five times.
2. Toggle the map light control five times.
3. Select and replay several routes.
4. Collapse and reopen the mobile map.
5. Enter and exit fullscreen.

Expected: no duplicated controls, no repeated style flash when only lights change, no stale route animation, no console listener warnings, and the current center/zoom is preserved across theme changes.

---

### Task 5: Stabilize homepage filtering and animation work

**Files:**

- Modify: `src/pages/index.tsx`
- Modify only if required: `src/hooks/useInterval.ts`

- [ ] **Step 1: Ensure one source of truth for the current full geometry**

Keep `currentGeoDataRef.current` as the completed geometry and `animatedGeoData` as presentation state. When filtering changes:

```ts
currentGeoDataRef.current = nextGeoData;
setAnimatedGeoData(nextGeoData);
```

Start animation only after the geometry module is loaded and only for the current filter request.

- [ ] **Step 2: Correct async effect cancellation**

Create the animation frame only while the effect is active and store its ID outside the async callback:

```ts
let frameId: number | null = null;
let cancelled = false;

// after await and cancelled check
frameId = requestAnimationFrame(...);

return () => {
  cancelled = true;
  if (frameId !== null) cancelAnimationFrame(frameId);
};
```

This replaces the current cleanup that cannot cancel a frame created after cleanup has already run.

- [ ] **Step 3: Avoid replaying expensive animations for invisible maps**

Animation may start only when `shouldDisplayMap` is true. `prefers-reduced-motion` continues to show the final static route immediately.

- [ ] **Step 4: Verify filter transitions**

Test year, city, title, single-route hash, and browser navigation.

Expected: each transition ends with the correct bounds and dataset; no animation continues after switching filters; the mobile page opens at the top rather than retaining a stale mid-page position.

---

### Task 6: Audit Summary interactions without changing its design

**Files:**

- Inspect/modify only if failing: `src/components/ActivityList/index.tsx`
- Inspect/modify only if failing: `src/components/ActivityList/panels.tsx`
- Inspect/modify only if failing: `src/components/ActivityList/chrome.tsx`
- Inspect/modify only if failing: `src/components/ActivityList/style.module.css`
- Inspect/modify only if failing: `src/pages/total.tsx`

- [ ] **Step 1: Verify year/month state transitions**

Test:

1. Open `/summary` directly.
2. Click the peak month bar.
3. Click the selected month again.
4. Switch with the `全年 / 月视角` controls.
5. Click a month with no data if available.

Expected: chart scope, context strip, heatmap, detail card, and AI summary scope agree; empty months use the existing quiet empty state.

- [ ] **Step 2: Verify all chart elements are keyboard operable**

Check heatmap cells, month bars, pace points, heart-rate points, weekday dots, and time-of-day dots.

Expected: each interactive element is a native button or supports Enter/Space, has visible focus, and exposes a meaningful `aria-label`. Fix only confirmed omissions.

- [ ] **Step 3: Verify mobile overflow and scroll restoration**

Test at widths `320`, `375`, `390`, and `430` px.

Expected: no page-level horizontal overflow; internal graphs may use their intentional scrolling behavior; direct navigation to `/summary` starts at the top; returning home also starts in a consistent position.

---

### Task 7: Make local and CI checks deterministic

**Files:**

- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Split read-only lint from automatic fixes**

Change scripts to this behavior:

```json
{
  "lint": "eslint src --ext .ts,.tsx",
  "lint:fix": "eslint src --ext .ts,.tsx --fix"
}
```

CI must call `pnpm run lint`; local cleanup may explicitly call `pnpm run lint:fix`. This prevents CI from silently rewriting source before building it.

- [ ] **Step 2: Keep the existing CI matrix and functionality**

Do not remove Python or Node versions in this pass. Only ensure the node job performs:

```bash
pnpm run check
pnpm run lint
pnpm run build
```

Expected: checks are read-only and reproduce local results.

- [ ] **Step 3: Run the exact CI-equivalent commands locally**

Run:

```bash
pnpm run check
pnpm run lint
pnpm run test:ai-summary
pnpm run build
```

Expected: every command exits `0`; generated activity and AI summary data remain unchanged.

---

### Task 8: Real-browser visual and interaction regression

**Files:**

- No code changes unless a reproducible regression is found

- [ ] **Step 1: Start one clean preview server**

Run:

```bash
pnpm dev --host 127.0.0.1
```

Expected: one reachable local URL; record the actual port rather than assuming a previous port remains active.

- [ ] **Step 2: Desktop regression**

Verify homepage and `/summary` at approximately `1440 × 900`:

- header and page background remain visually continuous;
- homepage map, run table, heatmap and summary cards preserve their layout;
- map selection and browser history remain synchronized;
- no new console errors.

- [ ] **Step 3: Mobile regression**

Verify at `390 × 844` and `320 × 700`:

- initial page position is the top;
- collapsed map does not load Mapbox until opened or intentionally prefetched at idle;
- opening the map does not force page-width overflow;
- table horizontal scrolling remains internal;
- Summary has no clipped labels, chart cells, AI heading, or detail text.

- [ ] **Step 4: Reduced-motion and theme regression**

Enable reduced motion and test both themes.

Expected: route and chart presentation remains usable without animation; theme switching does not move content, reset map position, or leave mismatched colors.

---

### Task 9: Final review and user checkpoint

**Files:**

- Review: all files changed while executing Tasks 1-8

- [ ] **Step 1: Review the final diff for scope creep**

Run:

```bash
git diff --check
git diff --stat
git status --short
```

Expected: every new line maps to lazy loading, lifecycle cleanup, interaction correctness, deterministic checks, or a confirmed regression fix. Unrelated existing changes remain intact.

- [ ] **Step 2: Repeat the full verification gate**

Run:

```bash
pnpm run check
pnpm run lint
pnpm run test:ai-summary
pnpm run build
```

Expected: all pass, and manifest confirms the homepage no longer statically imports Mapbox.

- [ ] **Step 3: Hand the local preview to the user**

Report the preview URL, the exact verified behaviors, remaining bundle-size limitation, and any pre-existing dirty changes excluded from the work.

Do not commit or push until the user confirms the preview.

---

## Acceptance criteria

- Homepage initial entry does not statically import the Mapbox chunk.
- Mobile collapsed-map entry does not download or initialize Mapbox before the map is requested or deliberately idle-prefetched.
- Rapid route clicks always end with one consistent row/hash/map/detail selection.
- Light control changes layer visibility without reloading the whole map style.
- Theme changes preserve map center and zoom and leave no duplicate listeners or controls.
- No route animation, timer, animation frame, media query, DOM event, or Mapbox event survives its owning component/effect.
- Summary keeps its current structure and visuals, with year/month/detail interactions consistent and keyboard accessible.
- Mobile homepage and Summary have no page-level horizontal overflow and open at the top.
- `pnpm run check`, `pnpm run lint`, `pnpm run test:ai-summary`, and `pnpm run build` pass.
- No commit, push, deployment, data regeneration, or unrelated cleanup occurs before user confirmation.
