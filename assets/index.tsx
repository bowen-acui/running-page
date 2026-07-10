// Only globs that are actually rendered somewhere belong here — every matched
// file becomes a build chunk, so unused patterns silently bloat the bundle.
export const yearSummaryStats = import.meta.glob('./year_summary_*.svg', {
  import: 'ReactComponent',
});
export const totalStat = import.meta.glob('./github.svg', {
  import: 'ReactComponent',
});
