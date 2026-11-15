// 小课堂的“每日五分钟”：间隔复习。纯函数，只看进度数据，Node 里也能跑。
// 学过的每一关有个“盒子”（1–5，莱特纳盒子那种）：复习做对了往后挪一个盒子，下一次隔得更久（1、2、4、8、16 天）；
// 做错了回到第 1 个盒子，明天再来。盒子和下一次的日子存在进度的 classroom[关的 id] 里：{ box, due: 'YYYY-MM-DD' }。
// 每天的五分钟：先挑到期的（最早到期的先来），不够 5 题就挑“好久没碰”的学过的关，再不够就从还没学的关里挑几道“尝个鲜”。
// 做完了记在进度的 classroomDaily 字段里：{ days: { 'YYYY-MM-DD': { at, n, right } } }，也算当天练过（接上连续天数）。
import { LEVELS, levelById, ROUTE_ORDER, isOpen } from './content/classroom.js';

export const BOX_DAYS = [0, 1, 2, 4, 8, 16];
export const DAILY_SIZE = 5;

export function addDays(day, n) {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('sv');
}

/** 第一次学完一关时的复习安排：第 1 个盒子，明天到期 */
export const firstReview = (today) => ({ box: 1, due: addDays(today, 1) });

/** 复习一次之后：对了往后挪，错了回到第 1 个 */
export function afterReview(state, ok, today) {
  const box = ok ? Math.min(5, (state?.box || 1) + 1) : 1;
  return { box, due: addDays(today, BOX_DAYS[box]), last: today };
}

/** 学过的关里，今天到期的（没有安排过的也算到期），最早到期的在前 */
export function dueLevels(classroom = {}, today) {
  return Object.entries(classroom)
    .filter(([id, s]) => s?.done && isOpen(levelById(id)) && levelById(id).id === id && (!s.due || s.due <= today))
    .sort((a, b) => (a[1].due || '').localeCompare(b[1].due || ''))
    .map(([id]) => id);
}

/**
 * 今天这五分钟做哪几题：[{ id, why: 'due' 到期了 | 'old' 学过、好久没碰 | 'taste' 还没学、尝个鲜, mode: 'sound' | 'ask' }]
 * 关底大关不出（太长）；节奏挑战、动手关出它的快问快答（它们的挑战三五分钟一局）。其余的出它自己的挑战（短版）。
 */
export function dailyPlan(classroom = {}, today, n = DAILY_SIZE) {
  const out = [];
  const used = new Set();
  const add = (id, why) => {
    const lv = levelById(id);
    if (!lv || used.has(id) || lv.kind === 'boss' || out.length >= n) return;
    used.add(id);
    out.push({ id, why, mode: lv.kind === 'rhythm' || lv.kind === 'hands' ? 'ask' : 'sound' });
  };
  for (const id of dueLevels(classroom, today)) add(id, 'due');
  const done = Object.entries(classroom).filter(([id, s]) => s?.done && levelById(id)?.id === id);
  // 最久没碰的在前：按“上次复习的日子”或“学完的那天”比（只比日期）；今天刚复习过的排到最后
  const day = (st) => st.last || (st.at || '').slice(0, 10);
  done.sort((a, b) => (a[1].last === today) - (b[1].last === today) || day(a[1]).localeCompare(day(b[1])));
  for (const [id, st] of done) if (st.last !== today) add(id, 'old');
  for (const id of ROUTE_ORDER) if (!classroom[id]?.done) add(id, 'taste');
  for (const [id] of done) add(id, 'old'); // 一天里做第二轮、又没有别的可挑时，才轮到今天刚复习过的
  return out;
}

/** 今天的五分钟做过没有 */
export const dailyDone = (daily, today) => !!daily?.days?.[today];

/** 一共做过几天 */
export const dailyCount = (daily) => Object.keys(daily?.days || {}).length;

/** 每一关的快问快答（每日五分钟用：从这一关自己的 ask 里挑一题） */
export const askOf = (id) => levelById(id)?.ask || [];

/** 全部关里有快问快答的那几题，按关排（关底大关的“考考我”用） */
export const ALL_ASK = LEVELS.flatMap((l) => (l.ask || []).map((a) => ({ ...a, id: l.id })));
