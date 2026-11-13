// 经验值、等级、徽章的规则。
// 这里全是纯函数：只看进度数据（progress.json 的内容），不碰页面、不碰网络，所以 Node 里也能直接跑
// （tools/xp-check.mjs 用它给一份旧进度文件回算）。规则的说明在 docs/design-direction.md 的“经验值、等级、徽章”一节，改这里要同步改那里。
//
// 经验值大部分是“算出来的”，不是“记下来的”：课程那部分看 lessons，小课堂那部分看 classroom，每天那部分看 practiceDays，
// 只有音游那部分是每打完一局往 game.playXp 里加。这样旧的进度文件不用迁移就有经验值，也不会重复给。
import { CHAPTERS, allLessons, SONG_CHAPTER } from './content/curriculum.js';
import { LINES as CLASS_LINES, levelById as classLevel } from './content/classroom.js';

// ───────────── 经验值 ─────────────

export const XP = {
  step: 10, // 课程里每走完一步
  lesson: [0, 60, 80, 100], // 完成一节课，按星数给（下标 = 几颗星）
  classroom: [0, 20, 25, 30], // 学完小课堂的一关，按星数给。一关三五分钟，大约是主线课程两三步的量
  playBase: 2, // 打完一局音游（看示范不算）
  playAccuracy: 10, // 再加 准确率 × 10，所以一局是 2–12（一局只有十几秒，给多了就成了刷分）
  day: 20, // 每天第一次练习
  streakStep: 5, // 连续练习的第 n 天再加 (n − 1) × 5 …
  streakCap: 25, // … 最多加到 25（连续第 6 天起）
};

/** 一局音游值多少经验。 */
export const playXp = (accuracy) => XP.playBase + Math.round(Math.max(0, Math.min(1, accuracy || 0)) * XP.playAccuracy);

const DAY_MS = 86400000;
const dayNum = (s) => Math.round(Date.parse(`${s}T00:00:00Z`) / DAY_MS);
const cleanDays = (days) => [...new Set((days || []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort();

/** 把练习过的日子切成一段段连续的：[[第一天, …], …]，每一项是 { day, n }，n = 这一天是连续的第几天。 */
function runs(days) {
  const out = [];
  let prev = null;
  let n = 0;
  for (const day of cleanDays(days)) {
    const num = dayNum(day);
    n = prev !== null && num - prev === 1 ? n + 1 : 1;
    prev = num;
    out.push({ day, n });
  }
  return out;
}

/** 连续天数：current = 到今天（或昨天）为止连着练了几天；longest = 历史最长；today = 今天练过没有。 */
export function streaks(days, today) {
  const list = runs(days);
  const longest = list.reduce((m, x) => Math.max(m, x.n), 0);
  const last = list[list.length - 1];
  const gap = last ? dayNum(today) - dayNum(last.day) : Infinity;
  return { current: gap <= 1 ? last.n : 0, longest, today: gap === 0, longestEndedOn: list.find((x) => x.n === longest)?.day || null };
}

function daysXp(days) {
  return runs(days).reduce((sum, x) => sum + XP.day + Math.min(XP.streakCap, (x.n - 1) * XP.streakStep), 0);
}

// 曲目的课（不属于哪一章）也算经验，和普通的课一样
const LESSONS = [...allLessons(), ...SONG_CHAPTER.lessons.map((lesson) => ({ chapter: SONG_CHAPTER, lesson }))];
const STEP_COUNT = Object.fromEntries(LESSONS.map((x) => [x.lesson.id, x.lesson.steps.length]));

function lessonsXp(lessons) {
  let sum = 0;
  for (const [id, state] of Object.entries(lessons || {})) {
    const total = STEP_COUNT[id];
    if (!total || !state) continue; // 课程表里已经没有的课不算
    // 没学完的课：stepIndex 是现在停在第几步（从 0 数），也就是已经走完了几步
    const steps = state.done ? total : Math.max(0, Math.min(total - 1, state.stepIndex || 0));
    sum += steps * XP.step;
    if (state.done) sum += XP.lesson[Math.max(1, Math.min(3, state.stars || 1))];
  }
  return sum;
}

/** 小课堂的一关值多少经验：state 是进度里 classroom[id] 那一项，没学完是 0。重学拿到更多星，多出来的差额自然就补上了。 */
export const classroomLevelXp = (state) => (state?.done ? XP.classroom[Math.max(1, Math.min(3, state.stars || 1))] : 0);

function classroomXp(classroom) {
  let sum = 0;
  for (const [id, state] of Object.entries(classroom || {})) {
    if (!classLevel(id)) continue; // 清单里已经没有的关不算
    sum += classroomLevelXp(state);
  }
  return sum;
}

/** 总经验值，以及它是怎么凑出来的。 */
export function xpBreakdown(data) {
  const lessons = lessonsXp(data.lessons);
  const days = daysXp(data.practiceDays);
  const plays = Math.max(0, Math.round(data.game?.playXp || 0));
  const classroom = classroomXp(data.classroom); // 小课堂：和课程一样是从进度算出来的，所以学过的关不用补记、也不会重复给
  const extra = Math.max(0, Math.round(data.game?.extraXp || 0)); // 以上都不是的（store.addXp() 记的账；眼下没有人用）
  return { lessons, days, plays, classroom, extra, total: lessons + days + plays + classroom + extra };
}

export const totalXp = (data) => xpBreakdown(data).total;

// ───────────── 等级 ─────────────

// at = 到这一级需要的总经验。认真练一次（一节课，连同课里的几局音游）大约 200 经验：前两级一次一级，之后逐级变慢。
// 学完现有的第 0–3 章大约到 8、9 级；后面五章做出来、全部学完，差不多正好到顶。
export const LEVELS = [
  { lv: 1, name: '学徒', at: 0 },
  { lv: 2, name: '按键手', at: 150 },
  { lv: 3, name: '节拍手', at: 400 },
  { lv: 4, name: '鼓手', at: 750 },
  { lv: 5, name: '律动手', at: 1200 },
  { lv: 6, name: '贝斯手', at: 1750 },
  { lv: 7, name: '和弦手', at: 2400 },
  { lv: 8, name: '音色师', at: 3200 },
  { lv: 9, name: '采样师', at: 4200 },
  { lv: 10, name: '编曲人', at: 5400 },
  { lv: 11, name: '制作人', at: 6800 },
  { lv: 12, name: '现场演出者', at: 8500 },
];

/** 这么多经验是几级：{ lv, name, xp, into（这一级里已经攒了多少）, span（这一级一共要多少）, pct, next（下一级，满级时是 null）} */
export function levelOf(xp) {
  let i = 0;
  while (i < LEVELS.length - 1 && xp >= LEVELS[i + 1].at) i++;
  const cur = LEVELS[i];
  const next = LEVELS[i + 1] || null;
  const span = next ? next.at - cur.at : 0;
  const into = xp - cur.at;
  return { lv: cur.lv, name: cur.name, xp, into, span, pct: next ? Math.min(1, into / span) : 1, next };
}

// ───────────── 徽章 ─────────────

const blankStats = () => ({ plays: 0, maxCombo: 0, fullPerfect: 0, midiPlays: 0, dictationAce: 0, ownBeat: 0 });

export const blankGame = () => ({
  v: 1,
  playXp: 0, // 音游攒下的经验
  extraXp: 0, // 课程、小课堂、音游、每天练习之外的经验（store.addXp() 记的账）
  stats: blankStats(), // 判定徽章要用、但别处没存的累计数
  badges: {}, // 徽章 id → 拿到的时刻
  seen: { level: 1, badges: [], intro: false }, // 已经给用户看过的等级和徽章；intro = 从旧进度回算之后有没有介绍过
});

/** 一局音游的结果里，和徽章有关的那几样。 */
export function statsFromResult(stats, result) {
  if (!result || result.demo) return stats;
  stats.plays++;
  stats.maxCombo = Math.max(stats.maxCombo, result.maxCombo || 0);
  if (result.total > 0 && result.counts?.perfect === result.total && !result.extras) stats.fullPerfect++;
  if (result.source === 'midi') stats.midiPlays++;
  return stats;
}

const done = (data, id) => !!data.lessons?.[id]?.done;
const doneAt = (data, id) => data.lessons?.[id]?.completedAt || true;
const chapterDone = (data, chapter) => !!chapter.lessons?.length && chapter.lessons.every((l) => done(data, l.id));

const FLAME = '<path d="M12 3c.6 3.2 4.5 4.6 4.5 9a4.5 4.5 0 0 1-9 0c0-1.6.6-2.8 1.5-3.7.3 1.3 1 2.2 1.9 2.2 0-2.9.3-5 1.1-7.5z"/>';

// icon 是 24×24 的线条图（徽章底座由样式画）；mark 是角标上的数字；tone 决定拿到之后是什么颜色。
// test(data, ctx) 返回 false（还没有）、true 或拿到的时刻（有据可查时）。ctx = { streak }。
export const BADGES = [
  {
    id: 'first-sound', name: '第一声', tone: 'accent',
    how: '第一次在真机上出声：用 SEQTRAK 打完一局音游，或者学完 0.2「让真机出声」',
    icon: '<path d="M4 10v4h3l5 4V6L7 10H4z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M18.6 6.4a8 8 0 0 1 0 11.2"/>',
    test: (d) => d.game.stats.midiPlays > 0 || (done(d, '0-2') && doneAt(d, '0-2')),
  },
  {
    id: 'four-floor', name: '四踩', tone: 'accent',
    how: '编出第一个四踩：学完 1.2「16 个格子」',
    icon: '<circle cx="4.5" cy="12" r="1.9" fill="currentColor"/><circle cx="9.5" cy="12" r="1.9" fill="currentColor"/><circle cx="14.5" cy="12" r="1.9" fill="currentColor"/><circle cx="19.5" cy="12" r="1.9" fill="currentColor"/><path d="M3 18h18"/>',
    test: (d) => done(d, '1-2') && doneAt(d, '1-2'),
  },
  {
    id: 'all-perfect', name: '一下不差', tone: 'yellow',
    how: '一局音游全是 PERFECT，一下没多按',
    icon: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
    test: (d) => d.game.stats.fullPerfect > 0,
  },
  {
    id: 'combo-16', name: '连击 16', tone: 'cyan', mark: '16',
    how: '一局里连着打中 16 下',
    icon: '<path d="M13 3 5 13h5l-1 8 8-11h-5l1-7z"/>',
    test: (d) => d.game.stats.maxCombo >= 16,
  },
  {
    id: 'combo-50', name: '连击 50', tone: 'violet', mark: '50',
    how: '一局里连着打中 50 下',
    icon: '<path d="M13 3 5 13h5l-1 8 8-11h-5l1-7z"/>',
    test: (d) => d.game.stats.maxCombo >= 50,
  },
  {
    id: 'streak-3', name: '连练 3 天', tone: 'accent', mark: '3',
    how: '连续 3 天都练了',
    icon: FLAME,
    test: (d, c) => c.streak.longest >= 3,
  },
  {
    id: 'streak-7', name: '连练 7 天', tone: 'yellow', mark: '7',
    how: '连续 7 天都练了',
    icon: FLAME,
    test: (d, c) => c.streak.longest >= 7,
  },
  {
    id: 'streak-30', name: '连练 30 天', tone: 'violet', mark: '30',
    how: '连续 30 天都练了',
    icon: FLAME,
    test: (d, c) => c.streak.longest >= 30,
  },
  {
    id: 'dictation', name: '金耳朵', tone: 'cyan',
    how: '听写题一次过：只靠耳朵，第一次核对就全对',
    icon: '<path d="M5 14v-2a7 7 0 0 1 14 0v2"/><path d="M5 14h3v5H6a1 1 0 0 1-1-1v-4z"/><path d="M19 14h-3v5h2a1 1 0 0 0 1-1v-4z"/>',
    test: (d) => d.game.stats.dictationAce > 0,
  },
  {
    id: 'own-beat', name: '原创', tone: 'ok',
    how: '写出第一个自己的鼓点，交给啾啾点评（学完 1.5 也算）',
    icon: '<path d="M4 20l1-4L16 5l3 3L8 19l-4 1z"/><path d="M13.5 7.5l3 3"/>',
    test: (d) => d.game.stats.ownBeat > 0 || (done(d, '1-5') && doneAt(d, '1-5')),
  },
  {
    id: 'find-keys', name: '指哪按哪', tone: 'ok',
    how: '“找按键”10 题全对',
    icon: '<circle cx="12" cy="12" r="6"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
    test: (d) => (d.panelQuiz?.best || 0) >= 10 && (d.panelQuiz.lastAt || true),
  },
  {
    id: 'chapter', name: '通关一章', tone: 'yellow',
    how: '把任意一章的课全部学完',
    icon: '<path d="M6 21V4"/><path d="M6 4h11l-2.5 4L17 12H6"/>',
    test: (d) => CHAPTERS.some((c) => chapterDone(d, c)),
  },
  {
    id: 'three-lines', name: '三线齐亮', tone: 'violet',
    how: '小课堂的乐理、节奏、效果三条线，各学完一关',
    icon: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2.3" fill="currentColor"/><circle cx="15.5" cy="12" r="2.3" fill="currentColor"/><circle cx="10.5" cy="18" r="2.3" fill="currentColor"/>',
    test: (d) => {
      // 每条线最早学完的那一关是什么时候学完的；三条线都有了，徽章的时刻就是最后凑齐的那一下
      const firsts = CLASS_LINES.map((line) => Object.entries(d.classroom || {})
        .filter(([id, state]) => state?.done && classLevel(id)?.line === line.id)
        .map(([, state]) => state.at || '')
        .sort()[0]);
      return firsts.every((at) => at !== undefined) && (firsts.sort().pop() || true);
    },
  },
];

export const badgeById = (id) => BADGES.find((b) => b.id === id) || null;

/**
 * 看看现在够得上哪些还没拿的徽章，写进 data.game.badges，返回新拿到的那几个（徽章的定义）。
 * 拿到的徽章不会被收回：比如“连练 3 天”拿到之后断了，徽章还在。
 */
export function awardBadges(data, today, now = new Date().toISOString()) {
  const ctx = { streak: streaks(data.practiceDays, today) };
  const fresh = [];
  for (const badge of BADGES) {
    if (data.game.badges[badge.id]) continue;
    const got = badge.test(data, ctx);
    if (!got) continue;
    data.game.badges[badge.id] = typeof got === 'string' ? got : now;
    fresh.push(badge);
  }
  return fresh;
}

/**
 * 旧的进度文件里没有 game 这一段：从已有的进度把它回算出来。
 * sessions 是练习记录（data/sessions.jsonl 里的每一局），读得到就用它把每一局的经验和连击、全 PERFECT、是不是真机打的算准；
 * 读不到（比如服务没开）就退回 charts 里存的“每个谱面打了几局、最好成绩多少”来估，这时连击和全 PERFECT 只看得到最近一局。
 */
export function backfillGame(data, sessions = []) {
  const game = blankGame();
  const results = sessions.filter((s) => s?.kind === 'game' && s.result && !s.result.demo);
  const recorded = Object.values(data.charts || {}).reduce((n, c) => n + (c.plays || 0), 0);
  const firstAt = {}; // 徽章用得上的“第一次”发生在什么时候
  if (results.length && results.length >= recorded) {
    for (const s of results) {
      const before = { ...game.stats };
      statsFromResult(game.stats, s.result);
      game.playXp += playXp(s.result.accuracy);
      if (game.stats.midiPlays && !before.midiPlays) firstAt['first-sound'] = s.at;
      if (game.stats.fullPerfect && !before.fullPerfect) firstAt['all-perfect'] = s.at;
      if (game.stats.maxCombo >= 16 && before.maxCombo < 16) firstAt['combo-16'] = s.at;
      if (game.stats.maxCombo >= 50 && before.maxCombo < 50) firstAt['combo-50'] = s.at;
    }
  } else {
    // 练习记录不全：每个谱面按“局数 × 最好那一局的经验”估，再把手头有的几局（练习记录里的、最近一局）用来认徽章
    for (const c of Object.values(data.charts || {})) game.playXp += (c.plays || 0) * playXp(c.bestAccuracy);
    for (const r of [...results.map((s) => s.result), data.lastResult].filter(Boolean)) statsFromResult(game.stats, r);
    game.stats.plays = recorded;
  }
  data.game = game;
  const fresh = awardBadges(data, new Date().toLocaleDateString('sv'));
  for (const b of fresh) if (firstAt[b.id]) game.badges[b.id] = firstAt[b.id];
  return game;
}
