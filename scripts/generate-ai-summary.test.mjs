import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFallbackSummary,
  buildPrompt,
  normalizeDeepSeekSummary,
  summarizeActivities,
} from './generate-ai-summary.mjs';

const sampleActivities = [
  {
    run_id: 1,
    name: 'Afternoon Run',
    distance: 5000,
    moving_time: '0:25:00',
    type: 'Run',
    start_date_local: '2026-05-01 16:00:00',
    average_heartrate: 168,
  },
  {
    run_id: 2,
    name: 'Morning Walk',
    distance: 2000,
    moving_time: '0:28:00',
    type: 'Walk',
    start_date_local: '2026-05-02 07:00:00',
    average_heartrate: 110,
  },
  {
    run_id: 3,
    name: 'Morning Run',
    distance: 6500,
    moving_time: '0:32:30',
    type: 'Run',
    start_date_local: '2026-05-03 07:30:00',
    average_heartrate: 172,
  },
];

test('summarizeActivities uses latest-year running activities only', () => {
  const summary = summarizeActivities(sampleActivities);

  assert.equal(summary.year, 2026);
  assert.equal(summary.count, 2);
  assert.equal(summary.distanceKm, 11.5);
  assert.equal(summary.averageHeartRate, 170);
  assert.equal(summary.heartRateSampleSize, 2);
  assert.equal(summary.heartRateCoverage, 1);
  assert.equal(summary.monthly.length, 1);
  assert.equal(summary.recentRuns.length, 2);
});

test('buildFallbackSummary returns concise static advice', () => {
  const fallback = buildFallbackSummary(summarizeActivities(sampleActivities));

  assert.equal(fallback.source, 'local');
  assert.ok(fallback.items.length > 0);
  assert.ok(fallback.items.length <= 3);
  assert.match(fallback.items[0], /2026/);
  assert.match(fallback.items[2], /心率记录不足/);
});

test('normalizeDeepSeekSummary keeps at most three useful lines', () => {
  const normalized = normalizeDeepSeekSummary(
    '1. 第一条建议\n2. 第二条建议\n3. 第三条建议\n4. 第四条建议'
  );

  assert.deepEqual(normalized, ['第一条建议', '第二条建议', '第三条建议']);
});

test('buildPrompt constrains DeepSeek to data-backed short advice', () => {
  const prompt = buildPrompt(summarizeActivities(sampleActivities));

  assert.match(prompt, /只根据给定 JSON/);
  assert.match(prompt, /heartRateSampleSize < 3/);
  assert.match(prompt, /不要标题/);
});
