// 乐理台：乐理线所有关共用的一块舞台（用户 2026-11-17：“乐理部分……界面和内容都不够系统和有趣”，方案见 docs/training-plan.md “乐理线重做”）。
// 从上到下三层，每一关只是在同一张图上多亮一层，不再每关换一套长相：
//   音高轨迹   弹过、放过的音画成一条线（横着是先后，竖着是高低）；“家”是一条桔红的虚线。旋律看得见。
//   钢琴键盘   两个八度（C–C–C，25 个键，黑白都有）。梯子（音阶）= 亮着的键，家 = 桔红；要找的、对的、错的各有记号。
//   机器的键   7 个 Synth keys，和上面亮着的键一一对应（键 1 = 家）。电脑键盘的 1–7 也能弹它们。
// 这个文件只管“摆出来、亮起来、响起来、告诉你按了哪个”；一小步一小步怎么教在 theory-guide.js，挑战在 theory-toys.js。
import { h } from './util.js';
import { audio } from './audio.js';

// 样式是自己带来的（public/css/theory.css），不用改 index.html
if (typeof document !== 'undefined' && !document.querySelector('link[data-theory]')) {
  document.head.append(h('link', { rel: 'stylesheet', href: '/css/theory.css', 'data-theory': '' }));
}

export const LO = 60; // 最左边的键：C
export const HI = 84; // 最右边的键：高两层的 C
export const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const MAJOR = [0, 2, 4, 5, 7, 9, 11];
export const MINOR = [0, 2, 3, 5, 7, 8, 10];
export const PENTA = [0, 3, 5, 7, 10]; // 小调五声：小调拿掉第 2、6 级
export const LADDERS = { major: MAJOR, minor: MINOR, penta: PENTA };
const BLACK = [1, 3, 6, 8, 10];
const isBlack = (m) => BLACK.includes(((m % 12) + 12) % 12);
export const nameOf = (m) => NAMES[((m % 12) + 12) % 12];
const WHITES = [];
for (let m = LO; m <= HI; m++) if (!isBlack(m)) WHITES.push(m);
const SVG = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}) => {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
};

/**
 * 摆一块乐理台。
 * 状态用 set() 改（只写要改的几样，别的不动）：
 *   ladder   梯子：{ root, offsets, degrees? }（root = 家是哪个键；offsets = 每一级离家几格；degrees = 每一级标几，默认 1 2 3…）或 null（不亮梯子）
 *   home     家要不要标出来（桔红的键 + 轨迹上的虚线）
 *   names    键上写不写音名          degrees  亮着的键上标不标第几级
 *   keys     下面那排机器的键摆不摆   trail    上面的轨迹摆不摆
 *   machine  机器的 7 个键发什么音：{ root, offsets }；不写就是梯子的前 7 级
 * onKey(midi, from, degree)：学生按了一个键。from = 'piano' / 'synth'（机器的键，degree = 第几个）。
 */
export function createTheoryBench(init = {}) {
  const st = { ladder: null, home: false, names: false, degrees: false, keys: false, trail: true, machine: null, ...init };
  let timers = [];
  let points = []; // 轨迹上的点：{ m, cls }
  let ghost = []; // 淡淡的另一条线（要对上的那一句）
  let busy = false;
  const api = { onKey: null };

  // ── 钢琴键盘 ──
  const keyEls = new Map();
  const piano = h('div', { class: 'tb-piano' });
  const ww = 100 / WHITES.length;
  for (let m = LO; m <= HI; m++) {
    const black = isBlack(m);
    const el = h('button', { class: ['tb-key', black ? 'b' : 'w'], type: 'button', 'data-sfx': 'none', 'data-m': String(m), 'aria-label': nameOf(m) }, h('i', { class: 'tb-deg' }), h('span', { class: 'tb-nm' }, nameOf(m)));
    if (black) el.style.left = `${WHITES.filter((x) => x < m).length * ww}%`;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      press(m, 'piano');
    });
    el.addEventListener('keydown', (e) => (e.key === 'Enter') && !e.repeat && press(m, 'piano'));
    keyEls.set(m, el);
    piano.append(el);
  }

  // ── 机器的 7 个键 ──
  const synthEls = [1, 2, 3, 4, 5, 6, 7].map((d) => {
    const el = h('button', { class: 'tb-skey', type: 'button', 'data-sfx': 'none', 'data-key': String(d) }, h('b', {}, `键 ${d}`), h('span', {}));
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      press(machineNote(d), 'synth', d);
    });
    return el;
  });
  const synthRow = h('div', { class: 'tb-skeys' }, h('span', { class: 'tb-cap' }, '机器的 7 个键'), h('div', { class: 'tb-skeys-row' }, synthEls));

  // ── 音高轨迹 ──
  const W = 600;
  const H = 96;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  const trailBox = h('div', { class: 'tb-trail' }, h('span', { class: 'tb-cap' }, '音高轨迹'), svg);
  const y = (m) => H - 8 - ((m - (LO - 2)) / (HI + 2 - (LO - 2))) * (H - 16);

  const el = h('div', { class: 'tb' }, trailBox, piano, synthRow);

  // ── 状态 → 画面 ──
  const ladderMidis = () => (st.ladder ? st.ladder.offsets.map((o) => st.ladder.root + o).filter((m) => m >= LO && m <= HI) : []);
  const machine = () => st.machine || (st.ladder && st.ladder.offsets.length >= 7 ? st.ladder : null);
  function machineNote(d) {
    const mc = machine();
    if (!mc) return LO + MINOR[d - 1];
    return mc.root + mc.offsets[d - 1];
  }
  /** 这个音在梯子上是第几级（标签），不在就是 0 */
  function degreeOf(m) {
    if (!st.ladder) return 0;
    const L = st.ladder;
    for (let i = 0; i < L.offsets.length; i++) {
      const base = L.root + L.offsets[i];
      if (m === base) return L.degrees ? L.degrees[i] : i + 1;
      if (m === base + 12 && L.offsets[i] === 0) return L.degrees ? L.degrees[i] : 1; // 高一层的家
    }
    return 0;
  }
  const isHome = (m) => !!st.ladder && (m - st.ladder.root) % 12 === 0 && m >= st.ladder.root;

  function paint() {
    const lit = new Set(ladderMidis());
    if (st.ladder && !st.ladder.noTop && st.ladder.root + 12 <= HI) lit.add(st.ladder.root + 12); // 梯子顶上那一级：高一层的家（noTop：还在搭，先不亮）
    el.classList.toggle('show-names', !!st.names);
    el.classList.toggle('show-degrees', !!st.degrees);
    el.classList.toggle('no-keys', !st.keys);
    el.classList.toggle('no-trail', !st.trail);
    for (const [m, k] of keyEls) {
      const on = lit.has(m);
      k.classList.toggle('lit', on);
      k.classList.toggle('home', on && st.home && isHome(m));
      k.firstChild.textContent = on ? String(degreeOf(m) || '') : '';
    }
    synthEls.forEach((b, i) => {
      const m = machineNote(i + 1);
      b.lastChild.textContent = nameOf(m);
      b.classList.toggle('home', !!st.home && !!machine() && i === 0);
    });
    paintTrail();
  }

  function paintTrail() {
    svg.replaceChildren();
    if (st.ladder && st.home) {
      for (const m of [st.ladder.root, st.ladder.root + 12]) {
        if (m < LO || m > HI) continue;
        svg.append(s('line', { x1: 0, x2: W, y1: y(m), y2: y(m), class: 'tb-homeline' }));
      }
    }
    const draw = (list, cls) => {
      const n = list.length;
      if (!n) return;
      const dx = Math.min(44, (W - 48) / Math.max(1, n - 1));
      const xs = list.map((_, i) => 24 + i * dx);
      const pts = list.map((p, i) => (p.m === null ? null : [xs[i], y(p.m)]));
      let run = [];
      const flush = () => {
        if (run.length > 1) svg.append(s('polyline', { points: run.map((p) => p.join(',')).join(' '), class: `tb-line ${cls}` }));
        run = [];
      };
      pts.forEach((p) => (p ? run.push(p) : flush()));
      flush();
      pts.forEach((p, i) => p && svg.append(s('circle', { cx: p[0], cy: p[1], r: i === n - 1 && cls !== 'ghost' ? 6 : 4, class: `tb-dot ${cls} ${list[i].cls || ''} ${st.home && st.ladder && isHome(list[i].m) ? 'home' : ''}` })));
    };
    draw(ghost, 'ghost');
    draw(points, 'mine');
  }

  // ── 出声、亮一下 ──
  function tone(m, { len = 0.5, vel = 0.85, at = 0, voice = 'keys' } = {}) {
    audio.init().then((ok) => ok && audio.note(m, audio.now() + 0.03 + at, len, { voice, vel }));
  }
  function flash(m, ms = 220, cls = 'down') {
    const k = keyEls.get(m);
    if (k) {
      k.classList.add(cls);
      timers.push(setTimeout(() => k.classList.remove(cls), ms));
    }
    const mc = machine();
    if (mc) {
      const d = mc.offsets.findIndex((o) => mc.root + o === m);
      if (d >= 0 && d < 7) {
        synthEls[d].classList.add('down');
        timers.push(setTimeout(() => synthEls[d].classList.remove('down'), ms));
      }
    }
  }
  function addPoint(m, cls = '') {
    points.push({ m, cls });
    if (points.length > 24) points = points.slice(-24);
    paintTrail();
  }

  function press(m, from, degree = 0) {
    if (api.locked) return;
    if (!api.silent) tone(m);
    flash(m);
    if (api.autoTrail !== false) addPoint(m);
    api.onKey?.(m, from, degree);
  }

  // 电脑键盘的 1–7：机器的键 1–7（哪种学习方式都行；模拟机不在这一页上，不会和它抢）
  const onKeydown = (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || !el.isConnected || !st.keys) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) return;
    const d = /^Digit([1-7])$/.exec(e.code)?.[1];
    if (!d) return;
    e.preventDefault();
    synthEls[d - 1].classList.add('down');
    setTimeout(() => synthEls[d - 1].classList.remove('down'), 160);
    press(machineNote(Number(d)), 'synth', Number(d));
  };
  window.addEventListener('keydown', onKeydown);

  Object.assign(api, {
    el,
    locked: false, // true：按键没反应（放示范的时候）
    silent: false, // true：按键不出声（由调用的人自己决定放什么）
    autoTrail: true, // 学生按的音要不要自己画到轨迹上
    get state() {
      return st;
    },
    get busy() {
      return busy;
    },
    set(patch = {}) {
      Object.assign(st, patch);
      paint();
      return api;
    },
    ladderMidis,
    machineNote,
    degreeOf,
    /** 梯子的第 d 级是哪个键（8 = 高一层的家；按 offsets 的先后数，不看标签） */
    degMidi(d) {
      const L = st.ladder || { root: LO, offsets: MINOR };
      const n = L.offsets.length;
      return L.root + L.offsets[(d - 1) % n] + 12 * Math.floor((d - 1) / n);
    },
    key: (m) => keyEls.get(m),
    synthKey: (d) => synthEls[d - 1],
    tone,
    flash,
    /** 给几个键加记号：target（要找的，蓝圈）/ good / bad / ref（起点） */
    mark(midis, cls = 'target') {
      for (const m of [].concat(midis)) keyEls.get(m)?.classList.add(cls);
    },
    unmark(cls) {
      const list = cls ? [cls] : ['target', 'good', 'bad', 'ref', 'dim'];
      for (const k of keyEls.values()) k.classList.remove(...list);
      synthEls.forEach((b) => b.classList.remove(...list));
    },
    trailClear() {
      points = [];
      paintTrail();
    },
    trailSet(midis) {
      points = midis.map((m) => ({ m, cls: '' }));
      paintTrail();
    },
    trailPop() {
      points.pop();
      paintTrail();
    },
    trailMarkLast(cls) {
      if (points.length) points[points.length - 1].cls = cls;
      paintTrail();
    },
    ghostSet(midis) {
      ghost = (midis || []).map((m) => ({ m, cls: '' }));
      paintTrail();
    },
    addPoint,
    /**
     * 放一句：items 里一项是一个音（数字）、一拍空（null）、几个音一起（数组）。键跟着亮，轨迹跟着画。
     * 返回的 Promise 在放完时 resolve（被 stop() 打断也会）。
     */
    playLine(items, { gap = 0.36, len = gap * 1.15, trail = true, clear = true, voice = 'keys', vel = 0.85 } = {}) {
      api.stop();
      if (clear && trail) points = [];
      busy = true;
      audio.init().then((ok) => {
        if (!ok) return;
        const t0 = audio.now() + 0.05;
        items.forEach((it, i) => {
          if (it === null) return;
          const list = [].concat(it);
          list.forEach((m) => audio.note(m, t0 + i * gap, len, { voice, vel: list.length > 1 ? vel * 0.7 : vel }));
        });
      });
      return new Promise((resolve) => {
        items.forEach((it, i) => timers.push(setTimeout(() => {
          if (it === null) {
            if (trail) addPoint(null);
            return;
          }
          const list = [].concat(it);
          list.forEach((m) => flash(m, Math.max(160, gap * 700)));
          if (trail) addPoint(list[list.length - 1]);
        }, 50 + i * gap * 1000)));
        const end = setTimeout(() => {
          busy = false;
          resolve();
        }, 50 + items.length * gap * 1000 + 120);
        timers.push(end);
        api._resolve = () => {
          busy = false;
          resolve();
        };
      });
    },
    /** 把梯子的家一格一格挪到 root（看得见它在滑），挪完 resolve */
    slideTo(root, { ms = 110 } = {}) {
      return new Promise((resolve) => {
        const step = () => {
          const cur = st.ladder?.root;
          if (cur === undefined || cur === root) return resolve();
          st.ladder = { ...st.ladder, root: cur + Math.sign(root - cur) };
          paint();
          timers.push(setTimeout(step, ms));
        };
        step();
      });
    },
    stop() {
      timers.forEach(clearTimeout);
      timers = [];
      for (const k of keyEls.values()) k.classList.remove('down');
      synthEls.forEach((b) => b.classList.remove('down'));
      const r = api._resolve;
      api._resolve = null;
      busy = false;
      r?.();
    },
    destroy() {
      api.stop();
      window.removeEventListener('keydown', onKeydown);
    },
  });
  paint();
  return api;
}
