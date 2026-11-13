// 动效的公共工具：彩带、数字滚动、键帽按下的行程、打字机、“蹦一下”。
// 缓动和时长是 app.css 里的变量（--out / --pop，--t-press / --t-move / --t-show）。
// 克制档（设置里选的，或者系统开了“减少动效”）下：彩带不放，数字和文字直接到位。
import { h } from './util.js';
import { theme } from './theme.js';
import { sfx } from './sfx.js';

let layer = null;
function fxLayer() {
  if (!layer?.isConnected) {
    layer = h('div', { class: 'fx-layer', 'aria-hidden': 'true' });
    document.body.append(layer);
  }
  return layer;
}

const CONFETTI = ['var(--accent)', 'var(--yellow)', 'var(--cyan)', 'var(--lamp-ok)', 'var(--confetti-ink)'];

/**
 * 彩带：从 origin 炸开。origin 是一个元素（取它的中心）或 { x, y }（视口坐标）；n = 多少片；spread = 飞多远（像素）。
 * 克制档不放。返回放了多少片。
 */
export function confetti(origin, n = 26, { spread = 170 } = {}) {
  if (!theme.rich) return 0;
  let { x, y } = origin || {};
  if (origin instanceof Element) {
    const r = origin.getBoundingClientRect();
    x = r.left + r.width / 2;
    y = r.top + r.height / 2;
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    x = innerWidth / 2;
    y = innerHeight * 0.4;
  }
  const host = fxLayer();
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = spread * (0.5 + Math.random());
    const c = h('i', { class: 'confetti' });
    c.style.cssText = `left:${x}px;top:${y}px;background:${CONFETTI[i % CONFETTI.length]};--dx:${(Math.cos(a) * r).toFixed(0)}px;--dy:${(Math.sin(a) * r - spread * 0.35).toFixed(0)}px;--r:${(Math.random() * 720 - 360).toFixed(0)}deg`;
    host.append(c);
    setTimeout(() => c.remove(), 1200);
  }
  return n;
}

/**
 * 数字滚动：把 el 里的数字从 from 滚到 to。fmt 决定怎么显示（默认取整）。
 * 页面在后台时逐帧的回调不跑，所以最后一定再设一次终值。
 */
export function countUp(el, to, { from = Number(el.dataset.n) || 0, ms = 700, fmt = (v) => String(Math.round(v)) } = {}) {
  el.dataset.n = String(to);
  // 克制档、数没变、或者是截图用的静止模式（?still）：直接到位
  if (!theme.rich || from === to || document.documentElement.hasAttribute('data-still')) {
    el.textContent = fmt(to);
    return;
  }
  const t0 = performance.now();
  let settled = false;
  const tick = (now) => {
    if (settled || el.dataset.n !== String(to)) return; // 已经到位了，或者中途又来了新的目标
    const p = Math.min(1, (now - t0) / ms);
    el.textContent = fmt(from + (to - from) * (1 - (1 - p) ** 3));
    if (p < 1) requestAnimationFrame(tick);
  };
  el.textContent = fmt(from);
  requestAnimationFrame(tick);
  setTimeout(() => {
    settled = true;
    if (el.dataset.n === String(to)) el.textContent = fmt(to);
  }, ms + 80);
}

/** 键帽按下的行程：给不是用鼠标按下去的情况用（键盘触发、程序替你按）。样式见 app.css 的 .is-down */
export function press(el, ms = 110) {
  if (!el) return;
  el.classList.add('is-down');
  setTimeout(() => el.classList.remove('is-down'), ms);
}

/** 让一个元素“蹦”一下（带过冲的出现）：用在刚拿到的东西上 */
export function pop(el) {
  if (!el) return;
  el.classList.remove('fx-pop');
  void el.offsetWidth;
  el.classList.add('fx-pop');
  setTimeout(() => el.classList.remove('fx-pop'), 600);
}

/**
 * 打字机：把 text 一个字一个字写进 el。克制档直接写完。返回一个函数，调用它就立刻写完（并停下）。
 * onDone 在写完时调一次。
 */
export function typeOut(el, text, { cps = 36, onDone } = {}) {
  let timer = null;
  let i = 0;
  const finish = () => {
    if (timer === null && i >= text.length) return;
    clearInterval(timer);
    timer = null;
    i = text.length;
    el.textContent = text;
    onDone?.();
  };
  el.setAttribute('aria-label', text);
  if (!theme.rich) {
    i = text.length;
    el.textContent = text;
    onDone?.();
    return () => {};
  }
  el.textContent = '';
  timer = setInterval(() => {
    i = Math.min(text.length, i + 1);
    el.textContent = text.slice(0, i);
    if (i >= text.length) finish();
  }, 1000 / cps);
  return finish;
}

// 哪些东西按下去要有一声：键帽一样的按钮、导航、开关、关卡、徽章。
// 不算的：模拟机和真机镜像（它们自己发声）、音游舞台、步进格子、琴键。
const CLICKY = 'button, a.btn, .rail a, .chip, [role="button"], .lesson-card, .chart-card > a, .map-node, .far-node, .badge, .hstat[role]';
const QUIET = '.panel-wrap, .game-stage, .piano, .cell, [data-sfx="none"]';

function soundFor(el) {
  if (el.dataset.sfx) return el.dataset.sfx;
  if (el.matches('.locked, [aria-disabled="true"]')) return 'nope';
  if (el.matches('.btn.primary, .map-node')) return 'press';
  return 'tick';
}

/** 全页面的“按下有一声”。只装一次。 */
export function installPressSounds() {
  const hit = (target) => {
    const el = target?.closest?.(CLICKY);
    if (!el || el.disabled || el.closest(QUIET)) return;
    sfx.play(soundFor(el));
  };
  document.addEventListener('pointerdown', (e) => e.button === 0 && hit(e.target), true);
  document.addEventListener('keydown', (e) => {
    if ((e.key !== 'Enter' && e.key !== ' ') || e.repeat || e.isComposing) return;
    const el = e.target?.closest?.(CLICKY);
    if (!el || el !== e.target) return; // 在输入框里敲回车不算
    hit(el);
    press(el);
  }, true);
}
