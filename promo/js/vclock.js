// 渲染用的“假时钟”：逐帧截图时，页面里的时间不再自己走，而是一帧一帧往前拨。
// 换掉 setTimeout / setInterval / requestAnimationFrame / performance.now / Date.now，
// 这样应用里的组件（啾啾的嘴、音符、飞行……它们用定时器和 rAF）在渲染时也严格按帧走，每次渲染结果都一样。
// 网页动画（CSS 动画、element.animate）在 syncAnimations 里按假时钟对齐。只在 ?render 时装上。

let now = 0; // 毫秒
let nextId = 1;
const timers = new Map(); // id → { at, fn, args, every }
const rafs = new Map();
const START = Date.UTC(2026, 10, 21, 9, 0, 0); // 片子里的“今天”：上午九点（啾啾说“早，啾！”）
export const realRaf = window.requestAnimationFrame.bind(window);
const realSetTimeout = window.setTimeout.bind(window);

export function install() {
  window.setTimeout = (fn, ms = 0, ...args) => {
    const id = nextId++;
    timers.set(id, { at: now + Math.max(0, Number(ms) || 0), fn, args, every: 0 });
    return id;
  };
  window.setInterval = (fn, ms = 0, ...args) => {
    const id = nextId++;
    const every = Math.max(1, Number(ms) || 0);
    timers.set(id, { at: now + every, fn, args, every });
    return id;
  };
  window.clearTimeout = (id) => timers.delete(id);
  window.clearInterval = (id) => timers.delete(id);
  window.requestAnimationFrame = (fn) => {
    const id = nextId++;
    rafs.set(id, fn);
    return id;
  };
  window.cancelAnimationFrame = (id) => rafs.delete(id);
  performance.now = () => now;
  Date.now = () => START + now;
}

/** 把时钟拨到 toMs：途中到点的定时器按先后触发，最后跑一轮 rAF */
export function advance(toMs) {
  for (;;) {
    let pick = null;
    for (const [id, tm] of timers) if (tm.at <= toMs && (!pick || tm.at < pick[1].at)) pick = [id, tm];
    if (!pick) break;
    const [id, tm] = pick;
    now = tm.at;
    if (tm.every) tm.at += tm.every;
    else timers.delete(id);
    try {
      typeof tm.fn === 'function' ? tm.fn(...tm.args) : null;
    } catch (err) {
      console.error(err);
    }
  }
  now = toMs;
  const list = [...rafs];
  rafs.clear();
  for (const [, fn] of list) {
    try {
      fn(now);
    } catch (err) {
      console.error(err);
    }
  }
}

export const vnow = () => now;

/** 页面上所有的网页动画按假时钟对齐：第一次见到时记下“它从哪一刻开始”，之后 currentTime = 现在 - 开始 */
export function syncAnimations(ms) {
  for (const a of document.getAnimations()) {
    if (a.__v0 === undefined) a.__v0 = ms;
    if (a.playState !== 'paused') a.pause();
    const d = (ms - a.__v0) * (a.playbackRate || 1);
    const end = a.effect?.getComputedTiming?.().endTime;
    if (Number.isFinite(end) && d >= end) {
      a.finish(); // 播完了：fill: forwards 的留着最后的样子，其它的从列表里消失
      continue;
    }
    a.currentTime = d;
  }
}

/** 给 Promise 让个路（渲染时不能用 setTimeout 等） */
export const tick = () => new Promise((r) => realSetTimeout(r, 0));
