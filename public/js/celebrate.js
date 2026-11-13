// 全屏的庆祝：过一节课、升级。星星一颗一颗砸下来、经验条涨上去、有新徽章就亮出来、教练说一句。
// 只在丰富档用：克制档下调用的一方给页内的小反馈（课程的完成页、main.js 的提示条），不盖全屏。
// 一次只有一张，新的会把旧的换掉。点按钮、点卡片外面、按 Esc 都能收起。样式在 app.css 的“全屏的庆祝”。
import { h } from './util.js';
import { sfx } from './sfx.js';
import { confetti } from './fx.js';
import { coachFace, setCoachMood } from './coach-face.js';

let current = null; // 现在盖着的那一张：{ el, close }

// 节奏（毫秒）。用户觉得原来太快（2026-11-11），整体放慢到原来的 1.8 倍上下：过一节课从开始到经验条涨满大约 4 秒。
// 想再调快慢就改这里——样式里的动画（app.css“全屏的庆祝”）读的是写在卡片上的同一组数（--cel-*），声音和彩带也按它排
const PACE = {
  pop: 600, // 卡片弹出来
  first: 500, // 第一颗星开始砸
  beat: 420, // 星星之间隔多久
  slam: 560, // 一颗星从开始砸到落定
  rise: 600, // 下面几样浮上来
  fill: 1400, // 经验条涨上去
};
/** 写到卡片上的 --cel-* 变量。at = 各样东西开始浮上来的时刻 */
const paceVars = (at) => ({
  '--cel-pop': `${PACE.pop}ms`, '--cel-first': `${PACE.first}ms`, '--cel-beat': `${PACE.beat}ms`,
  '--cel-slam': `${PACE.slam}ms`, '--cel-rise': `${PACE.rise}ms`, '--cel-fill': `${PACE.fill}ms`,
  ...Object.fromEntries(Object.entries(at).map(([k, v]) => [`--cel-${k}`, `${Math.round(v)}ms`])),
});

function show(card) {
  current?.close();
  const el = h('div', { class: 'celebrate', role: 'dialog', 'aria-modal': 'true' }, card);
  const timers = [];
  const onKey = (e) => {
    if (e.key === 'Escape') me.close();
  };
  const me = {
    el,
    close() {
      if (current !== me) return;
      current = null;
      timers.forEach(clearTimeout);
      window.removeEventListener('keydown', onKey);
      el.remove();
    },
    /** 仪式里排着的事（声音、彩带、经验条）：收起来之后就不做了 */
    later(fn, ms) {
      timers.push(setTimeout(() => current === me && fn(), ms));
    },
  };
  el.addEventListener('pointerdown', (e) => {
    if (e.target === el) me.close();
  });
  window.addEventListener('keydown', onKey);
  document.body.append(el);
  current = me;
  return me;
}

/** 现在有没有庆祝盖着（别的提示看到有就先不出） */
export const celebrating = () => !!current;

/** 把盖着的庆祝收起来（离开这一页的时候调） */
export function closeCelebration() {
  current?.close();
}

/** 一行经验：涨了多少、经验条、现在是几级。from / to = 之前和之后的等级（store.progress().level）；gained 传 null = 不说涨了多少，只说现在一共多少 */
export function xpLine({ gained = 0, from, to }) {
  const up = !!from && to.lv > from.lv;
  const bar = h('i', { style: { width: `${Math.round((up || !from ? 0 : from.pct) * 100)}%` } });
  const el = h('div', { class: 'xp-line' },
    h('b', {}, gained == null ? `${to.xp} 经验` : gained > 0 ? `+${gained} 经验` : '经验没变'), // 重学一节以前拿满的课，不会再给一遍
    h('span', { class: 'xp-bar' }, bar),
    h('span', { class: up ? 'xp-up' : '' }, to.next ? `Lv ${to.lv} ${to.name} · 离下一级还差 ${to.next.at - to.xp}` : `Lv ${to.lv} ${to.name}`));
  return { el, fill: () => (bar.style.width = `${Math.round(to.pct * 100)}%`) };
}

/** 徽章：一颗圆章加名字 */
export const badgeChip = (b) => h('span', { class: 'cel-badge' },
  h('span', { class: 'badge got', dataset: { tone: b.tone } }, h('svg', { viewBox: '0 0 24 24', html: b.icon })),
  h('span', {}, h('small', {}, '拿到徽章'), h('b', {}, b.name)));

const levelBlock = (to) => h('div', { class: 'cel-level' },
  h('span', { class: 'ring', style: { '--p': String(Math.round(to.pct * 100)) } }, h('span', {}, String(to.lv))),
  h('div', {}, h('small', {}, '升级了'), h('b', {}, `Lv ${to.lv} ${to.name}`)));

/**
 * 过了一节课。
 *   no / title  课的编号和名字          stars  几颗星
 *   gained, from, to  这节课涨的经验、之前和之后的等级（升级了会一起亮出来）
 *   badges      这一下拿到的徽章        say    教练说的那一句
 *   primary / onPrimary  主按钮上的字和点了之后做什么（下一课 / 回路线图）
 */
export function celebrateLesson({ no, title, stars = 3, gained = 0, from, to, badges = [], say, primary = '继续', onPrimary }) {
  const up = !!from && !!to && to.lv > from.lv;
  const xp = to ? xpLine({ gained, from, to }) : null;
  // 时间线：星星一颗一颗砸下来、每颗落地响一声 → 都落定了撒彩带，下面几样依次浮上来 → 经验条涨上去 → 升级 / 徽章各一声
  const land = (i) => PACE.first + i * PACE.beat + PACE.slam * 0.55; // 第 i 颗星落地的那一刻（砸下来的动画在 55% 处到位）
  const after = land(Math.max(1, stars) - 1) + 160; // 最后一颗落定
  const fillAt = after + PACE.rise; // 经验条那一行浮上来之后再涨
  const card = h('div', { class: 'cel-card ceremony', style: paceVars({ rest: after, xp: after + 120, say: after + 300, act: after + 480 }) },
    h('div', { class: 'cel-kicker' }, '拿下'),
    h('h1', {}, `${no} ${title}`),
    h('div', { class: 'stars big-stars' }, [0, 1, 2].map((i) => h('span', { class: i < stars ? 'on' : '', style: { '--i': String(i) } }, '★'))),
    up && levelBlock(to),
    xp?.el,
    badges.length ? h('div', { class: 'cel-badges' }, badges.map(badgeChip)) : null,
    h('div', { class: 'cel-say' }, coachFace({ size: 48, follow: false, mood: stars === 3 ? 'happy' : 'cheer', act: stars === 3 ? 'flip' : 'hop' }).el, h('p', {}, say)),
    h('div', { class: 'cel-actions' },
      h('button', { class: 'btn primary lg', type: 'button', dataset: { sfx: 'none' }, onclick: () => { me.close(); onPrimary?.(); } }, primary),
      h('button', { class: 'btn ghost', type: 'button', onclick: () => me.close() }, '留在这一页')),
  );
  const me = show(card);
  for (let i = 0; i < stars; i++) me.later(() => sfx.play('star'), land(i));
  me.later(() => confetti(card, stars === 3 ? 64 : 34, { spread: 280 }), after);
  me.later(() => xp?.fill(), fillAt);
  // 升级的那一声等经验条快涨满；徽章的那一声在它涨到一半
  if (up) me.later(() => { sfx.play('levelup'); confetti(card, 40, { spread: 220 }); }, fillAt + PACE.fill * 0.85);
  else if (badges.length) me.later(() => sfx.play('badge'), fillAt + PACE.fill * 0.6);
  setCoachMood('happy', fillAt + PACE.fill + 1500);
  return me;
}

/** 升级了（不在过一节课的那一下）。from / to = 之前和之后的等级 */
export function celebrateLevel({ from, to }) {
  const xp = xpLine({ gained: null, from: null, to });
  // 时间线：卡片弹出来 → 新等级那一块浮上来，落定时响一声、撒彩带 → 经验条、教练的话、按钮依次出来，经验条再涨上去
  const card = h('div', { class: 'cel-card ceremony', style: paceVars({ rest: 450, xp: 750, say: 1000, act: 1200 }) },
    h('div', { class: 'cel-kicker' }, '升级'),
    h('div', { class: 'cel-level big' },
      h('span', { class: 'ring', style: { '--p': String(Math.round(to.pct * 100)) } }, h('span', {}, String(to.lv))),
      h('div', {}, h('small', {}, from ? `Lv ${from.lv} ${from.name} →` : '现在是'), h('b', {}, `Lv ${to.lv} ${to.name}`))),
    xp.el,
    h('div', { class: 'cel-say' }, coachFace({ size: 48, follow: false, mood: 'happy', act: 'flip' }).el,
      h('p', {}, to.next ? `「${to.name}」到手。下一级是「${to.next.name}」，接着练就到。` : `「${to.name}」，到顶了。接下来就是上台的事。`)),
    h('div', { class: 'cel-actions' }, h('button', { class: 'btn primary lg', type: 'button', onclick: () => me.close() }, '继续')),
  );
  const me = show(card);
  me.later(() => { sfx.play('levelup'); confetti(card, 56, { spread: 260 }); }, 450 + PACE.rise * 0.5);
  me.later(() => xp.fill(), 750 + PACE.rise);
  setCoachMood('happy', 750 + PACE.rise + PACE.fill + 1500);
  return me;
}
