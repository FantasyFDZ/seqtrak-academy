// 生成宣传片截图用的“演示进度”（promo/data/progress.json）：一个认真练了十几天的人——第 0–3 章学完、第 4 章学到一半、
// 小课堂过了二十多关、连续练了 12 天。只给截图用，不碰 data/ 里的真实进度。
// 用法：node promo/make-data.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { CHAPTERS } from '../public/js/content/curriculum.js';

const TODAY = '2026-11-21';
const day = (n) => {
  const d = new Date(`${TODAY}T10:00:00+08:00`);
  d.setDate(d.getDate() - n);
  return d;
};
const iso = (n, h = 20) => {
  const d = day(n);
  d.setHours(h, 12, 0, 0);
  return d.toISOString();
};

// 每节课得几颗星（没写的 = 还没学）
const STARS = {
  '0-1': 3, '0-2': 3, '0-3': 3,
  '1-1': 3, '1-2': 3, '1-3': 3, '1-4': 2, '1-5': 3,
  '2-1': 3, '2-2': 2, '2-3': 3,
  '3-1': 3, '3-2': 3, '3-3': 2, '3-4': 3,
  '4-1': 3, '4-2': 3,
};
const lessons = {};
let n = 26;
for (const ch of CHAPTERS) {
  for (const l of ch.lessons || []) {
    const stars = STARS[l.id];
    const steps = (l.steps || []).length || 5;
    if (stars) {
      const ago = Math.max(1, Math.round(n / 2.2));
      lessons[l.id] = { stepIndex: steps - 1, done: true, stars, lastAt: iso(ago), completedAt: iso(ago), stepStars: {} };
      n--;
    }
  }
}
lessons['4-3'] = { stepIndex: 3, done: false, stars: 0, lastAt: iso(0, 9) };

// 小课堂过的关：{ done, stars, at, times }
const CL = {
  T5: 3, T6: 3, T14: 2, T15: 3, T7: 3, T16: 2, T8: 3, T12: 2, T17: 3, T18: 3, T19: 2, T20: 3, T9: 3, T10: 2,
  R1: 3, R2: 3, R3: 3, R4: 2, R5: 3, R6: 2, R7: 1, R8: 3,
  F1: 3, F2: 3, F3: 2, F4: 3, D1: 3, D2: 2,
};
const classroom = {};
Object.entries(CL).forEach(([id, stars], i) => {
  classroom[id] = { done: true, stars, at: iso(Math.round(i / 3)), times: 1 + (i % 3) };
});

const charts = {
  'house-kit': { plays: 14, bestAccuracy: 0.98, bestStars: 3, lastAt: iso(1) },
  'pulse-kick': { plays: 9, bestAccuracy: 1, bestStars: 3, lastAt: iso(6) },
  'chord-two': { plays: 11, bestAccuracy: 0.96, bestStars: 3, lastAt: iso(3) },
  'chord-stab': { plays: 8, bestAccuracy: 0.94, bestStars: 3, lastAt: iso(2) },
};

const practiceDays = Array.from({ length: 12 }, (_, i) => day(11 - i).toLocaleDateString('sv'));

const progress = {
  version: 1,
  profile: { createdAt: iso(26, 9), placement: null },
  lessons,
  charts,
  songs: { picked: ['levels', 'blinding-lights', 'faded'] },
  settings: { inputOffsetMs: 0, metronome: true, speak: false, unlockAll: false, engine: 'fast', skin: 'neon', motion: 'rich', uiSound: false, intro: 'off', learnMode: 'device' },
  practiceDays,
  lastResult: { chartId: 'house-kit', title: 'House 鼓组', bpm: 120, bars: 1, loops: 4, assist: 'guide', speed: 1, source: 'midi', total: 40, counts: { perfect: 38, great: 2, ok: 0, miss: 0 }, extras: 0, accuracy: 0.985, maxCombo: 40, stars: 3, passed: true, meanMs: 9.8, stdMs: 6.1, driftMs: -2 },
  drills: [],
  notes: [],
  classroom,
  classroomDaily: practiceDays.slice(-8),
  jiu: { day: TODAY, feathers: Object.keys(CL).slice(0, 9), streaks: ['3:2026-11-10', '7:2026-11-10'] },
};

mkdirSync(new URL('./data/', import.meta.url), { recursive: true });
writeFileSync(new URL('./data/progress.json', import.meta.url), `${JSON.stringify(progress, null, 2)}\n`);
console.log(`写好了：${Object.keys(lessons).length} 节课、${Object.keys(classroom).length} 关小课堂、连续 ${practiceDays.length} 天`);
