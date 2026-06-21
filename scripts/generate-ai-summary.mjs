import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const activitiesPath = resolve(rootDir, 'src/static/activities.json');
const outputPath = resolve(rootDir, 'src/static/ai-summary.json');
const deepSeekUrl = 'https://api.deepseek.com/chat/completions';
const defaultTrainingGoal =
  '为了健康体态和长期体能维护而跑步：不追求成绩、距离或提速，优先关注心率是否过高、恢复是否充分、跑步是否轻松可持续。';

const toSeconds = (movingTime) => {
  if (!movingTime) return 0;
  const parts = movingTime.split(', ');
  const dayPart = parts.length === 2 ? Number.parseInt(parts[0], 10) : 0;
  const [hours, minutes, seconds] = parts[parts.length - 1]
    .split(':')
    .map(Number);
  return ((dayPart * 24 + hours) * 60 + minutes) * 60 + seconds;
};

const formatPace = (secondsPerKm) => {
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return '-';
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60);
  return `${minutes}'${seconds.toString().padStart(2, '0')}"`;
};

const getMondayFirstWeekday = (date) => (date.getDay() + 6) % 7;

const getTimeBand = (hour) => {
  if (hour < 9) return '清晨';
  if (hour < 12) return '上午';
  if (hour < 18) return '午后';
  return '夜间';
};

const getAverage = (values) =>
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;

const getStandardDeviation = (values) => {
  if (values.length < 2) return 0;
  const average = getAverage(values);
  const variance = getAverage(
    values.map((value) => (value - average) ** 2)
  );
  return Math.sqrt(variance);
};

const getLongestStreak = (runs) => {
  const dayTimes = Array.from(
    new Set(
      runs.map((run) => {
        const date = new Date(run.date);
        date.setHours(0, 0, 0, 0);
        return date.getTime();
      })
    )
  ).sort((a, b) => a - b);

  let longest = 0;
  let current = 0;
  let previous = 0;
  dayTimes.forEach((time) => {
    current = previous && time - previous === 86400000 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = time;
  });
  return longest;
};

const getLongestGap = (runs) => {
  const dayTimes = Array.from(
    new Set(
      runs.map((run) => {
        const date = new Date(run.date);
        date.setHours(0, 0, 0, 0);
        return date.getTime();
      })
    )
  ).sort((a, b) => a - b);

  let longest = 0;
  for (let index = 1; index < dayTimes.length; index += 1) {
    const gap =
      Math.round((dayTimes[index] - dayTimes[index - 1]) / 86400000) - 1;
    longest = Math.max(longest, gap);
  }
  return longest;
};

const pickTopLabels = (items) => {
  const maxCount = Math.max(...items.map((item) => item.count), 0);
  return items
    .filter((item) => item.count === maxCount && item.count > 0)
    .slice(0, 2)
    .map((item) => item.label);
};

export const summarizeActivities = (activities) => {
  const runs = activities
    .filter(
      (activity) => activity.type === 'Run' || activity.type === 'running'
    )
    .map((activity) => {
      const date = new Date(activity.start_date_local.replace(' ', 'T'));
      const distanceKm = activity.distance / 1000;
      const seconds = toSeconds(activity.moving_time);
      return {
        date,
        dateKey: activity.start_date_local.slice(0, 10),
        distanceKm,
        seconds,
        paceSeconds: distanceKm > 0 ? seconds / distanceKm : 0,
        heartRate:
          typeof activity.average_heartrate === 'number' &&
          activity.average_heartrate > 0
            ? activity.average_heartrate
            : null,
        weekday: getMondayFirstWeekday(date),
        timeBand: getTimeBand(date.getHours()),
      };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const year = runs[0]?.date.getFullYear() ?? new Date().getFullYear();
  const yearRuns = runs.filter((run) => run.date.getFullYear() === year);
  const totalSeconds = yearRuns.reduce((sum, run) => sum + run.seconds, 0);
  const distanceKm = Number(
    yearRuns.reduce((sum, run) => sum + run.distanceKm, 0).toFixed(1)
  );
  const heartRates = yearRuns
    .map((run) => run.heartRate)
    .filter((rate) => rate !== null);
  const monthCounts = Array.from({ length: 12 }, (_, index) => {
    const monthRuns = yearRuns.filter((run) => run.date.getMonth() === index);
    return {
      label: `${index + 1}月`,
      count: monthRuns.length,
      distanceKm: Number(
        monthRuns.reduce((sum, run) => sum + run.distanceKm, 0).toFixed(1)
      ),
      averagePace: formatPace(
        monthRuns.reduce((sum, run) => sum + run.distanceKm, 0) > 0
          ? monthRuns.reduce((sum, run) => sum + run.seconds, 0) /
              monthRuns.reduce((sum, run) => sum + run.distanceKm, 0)
          : 0
      ),
    };
  });
  const weekdayCounts = [
    '周一',
    '周二',
    '周三',
    '周四',
    '周五',
    '周六',
    '周日',
  ].map((label, index) => ({
    label,
    count: yearRuns.filter((run) => run.weekday === index).length,
  }));
  const timeBandCounts = ['清晨', '上午', '午后', '夜间'].map((label) => ({
    label,
    count: yearRuns.filter((run) => run.timeBand === label).length,
  }));
  const peakMonth = monthCounts.reduce((best, item) =>
    item.distanceKm > best.distanceKm ? item : best
  );

  return {
    year,
    count: yearRuns.length,
    distanceKm,
    averagePace: formatPace(distanceKm > 0 ? totalSeconds / distanceKm : 0),
    paceStabilitySeconds: Math.round(
      getStandardDeviation(
        yearRuns
          .map((run) => run.paceSeconds)
          .filter((pace) => Number.isFinite(pace) && pace > 0)
      )
    ),
    averageHeartRate: heartRates.length
      ? Math.round(getAverage(heartRates))
      : null,
    heartRateSampleSize: heartRates.length,
    heartRateCoverage: yearRuns.length
      ? Number((heartRates.length / yearRuns.length).toFixed(2))
      : 0,
    longestStreak: getLongestStreak(yearRuns),
    longestGap: getLongestGap(yearRuns),
    peakMonth: peakMonth.count ? peakMonth.label : null,
    monthly: monthCounts.filter((month) => month.count > 0),
    recentRuns: yearRuns.slice(0, 6).map((run) => ({
      date: run.dateKey,
      distanceKm: Number(run.distanceKm.toFixed(2)),
      pace: formatPace(run.paceSeconds),
      heartRate: run.heartRate ? Math.round(run.heartRate) : null,
      timeBand: run.timeBand,
    })),
    highFrequencyDays: pickTopLabels(weekdayCounts),
    highFrequencyTimeBands: pickTopLabels(timeBandCounts),
  };
};

export const buildFallbackSummary = (
  summary,
  fallbackReason = null,
  trainingGoal = defaultTrainingGoal
) => {
  const hasHeartRateSignal =
    summary.heartRateSampleSize >= 3 && summary.averageHeartRate;
  const items = [
    summary.count < 12
      ? '样本还少，先保持轻松可持续，不用追求距离或速度。'
      : `今年已有 ${summary.count} 次记录，继续以轻松跑维持体能即可。`,
    summary.longestStreak < 3
      ? `连续跑最长 ${summary.longestStreak} 天，不需要补跑；跑后舒服比连续天数更重要。`
      : `连续跑已有 ${summary.longestStreak} 天，留出恢复日比继续叠加更健康。`,
    hasHeartRateSignal
      ? `心率样本覆盖 ${Math.round(summary.heartRateCoverage * 100)}%，若跑后疲劳明显，下次主动放慢。`
      : `心率记录不足；优先观察跑后恢复感和第二天是否疲劳。`,
  ];

  return {
    generatedAt: new Date().toISOString(),
    source: 'local',
    model: 'rule-based',
    fallbackReason,
    trainingGoal,
    items: items.slice(0, 3),
  };
};

export const normalizeDeepSeekSummary = (content) =>
  content
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*]?\s*\d*[.)、]?\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 3);

export const buildPrompt = (summary, trainingGoal = defaultTrainingGoal) =>
  [
    '你是克制、准确的健康跑步观察助手，目标是把跑步数据转成健康维护建议。',
    `用户目标：${trainingGoal}`,
    '请只根据给定 JSON 生成 3 条以内中文短句，每条 18-42 个汉字。',
    '每条必须包含：数据依据 + 下一步行动。不要只复述数据。',
    '优先建议：心率是否偏高、跑后恢复、轻松跑比例、是否需要降强度、是否需要休息。',
    '不要建议追求速度、PB、配速进步、距离增长、训练计划升级或比赛目标。',
    '心率规则：heartRateSampleSize < 3 时必须写“心率记录不足”，不得判断强度；样本不足或覆盖率低时只能弱提示。',
    '如果 averageHeartRate 偏高，只能建议放慢、缩短、改走跑结合或增加恢复日，不要医疗诊断。',
    '禁止：鸡汤、医疗诊断、夸张警告、排行榜语气、空泛鼓励、重复首页总距离/总次数。',
    '风格：安静、具体、像年度跑步手账。只输出短句，不要标题。',
    `数据：${JSON.stringify(summary)}`,
  ].join('\n');

const requestDeepSeekSummary = async (apiKey, summary, trainingGoal) => {
  const response = await fetch(deepSeekUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content:
            '你只做跑步训练观察，不做医疗建议。输出必须可从用户数据直接推导。',
        },
        {
          role: 'user',
          content: buildPrompt(summary, trainingGoal),
        },
      ],
      temperature: 0.2,
      max_tokens: 320,
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek request failed: ${response.status}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  const items = normalizeDeepSeekSummary(content || '');
  if (!items.length) {
    throw new Error('DeepSeek returned empty summary');
  }

  return {
    generatedAt: new Date().toISOString(),
    source: 'deepseek',
    model: payload?.model || process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    fallbackReason: null,
    trainingGoal,
    items,
  };
};

export const generateAiSummary = async ({
  apiKey = process.env.DEEPSEEK_API_KEY,
  trainingGoal = process.env.RUNNING_TRAINING_GOAL || defaultTrainingGoal,
  inputPath = activitiesPath,
  targetPath = outputPath,
} = {}) => {
  const activities = JSON.parse(await readFile(inputPath, 'utf8'));
  const summary = summarizeActivities(activities);
  let result = buildFallbackSummary(summary, null, trainingGoal);

  if (apiKey) {
    try {
      result = await requestDeepSeekSummary(apiKey, summary, trainingGoal);
    } catch (error) {
      result = buildFallbackSummary(
        summary,
        error instanceof Error ? error.message : 'DeepSeek request failed',
        trainingGoal
      );
    }
  }

  await writeFile(targetPath, `${JSON.stringify(result, null, 2)}\n`);
  return result;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateAiSummary()
    .then((result) => {
      console.log(`AI summary generated from ${result.source}`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
