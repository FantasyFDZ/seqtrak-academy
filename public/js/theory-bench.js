// 乐理台：乐理线所有关共用的一块舞台（用户 2026-11-17：“乐理部分……界面和内容都不够系统和有趣”，方案见 docs/training-plan.md “乐理线重做”）。
// 从上到下三层，每一关只是在同一张图上多亮一层，不再每关换一套长相：
//   音高轨迹   弹过、放过的音画成一条线（横着是先后，竖着是高低）；“家”是一条桔红的虚线。旋律看得见。
//   钢琴键盘   两个八度（C–C–C，25 个键，黑白都有）。梯子（音阶）= 亮着的键，家 = 桔红；要找的、对的、错的各有记号。
//   机器的键   7 个 Synth keys，和上面亮着的键一一对应（键 1 = 家）。电脑键盘的 1–7 也能弹它们。
// 这个文件只管“摆出来、亮起来、响起来、告诉你按了哪个”；一小步一小步怎么教在 theory-guide.js，挑战在 theory-toys.js。
// 第二期（单元 3「旋律」、4「和声」）加的几样，都还在这同一块台子上：
//   格子     最上面那一层可以换成格子（theory-roll.js）：一格 = 十六分，和弦是色带、贝斯是一条线、旋律是能拉长的小块。set({ top: 'roll' })
//   回家圈   7 个级数排成一圈，箭头一站一站指向家（每一步地基都跳一大步）。set({ top: 'ring' })，格子里有东西时并排摆
//   和弦     键盘上叠起来的色块（青）：最底下那层是地基。chord([键号…])
//   三盏灯   句号圆不圆看三样：和弦到家、贝斯站稳、旋律到家。lamps([…])
//   亮暗牌   机器的 7 个键上各挂一块小牌：从这一级叠起来的和弦是亮、暗，还是挤。moods(true)
import { h } from './util.js';
import { audio } from './audio.js';
import { createRoll } from './theory-roll.js';
import { createStaff } from './theory-staff.js';

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
/** 回家圈上 7 个站的先后（顺时针，最上面是家）：顺着箭头走，每一步地基都往下跳一大步 */
export const RING = [1, 4, 7, 3, 6, 2, 5];
const LAYER = ['基', '中', '上', '四'];
export const MOOD_WORD = { major: '亮', minor: '暗', dim: '挤' };
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
 *   top      最上面那一层摆什么：'trail'（音高轨迹，默认）/ 'roll'（格子）/ 'ring'（回家圈；格子里有东西时并排摆）
 *   chordKeys 机器的键一个键弹几个音：0（一个音，默认）/ 3 / 4（CHORD 弹法：从这一级起隔一个拿一个）
 *   dark     梯子在（第几级照样数得出），可键盘上不亮：拆歌的时候还没找到家、还不知道它用哪 7 个键（第三期）
 *   piano    键盘摆不摆（默认摆；选学“看懂谱子”里只对着谱子和格子的那几步收起来）
 *   big      格子加高、键盘压矮（拆歌：一首歌的贝斯、和弦、旋律摞在一张格子里，行多）。这时格子里贝斯那一层只留它踩过的几行
 *   top 还可以是 'staff'：五线谱（theory-staff.js），下面带一条机器的格子
 * onKey(midi, from, degree)：学生按了一个键。from = 'piano' / 'synth'（机器的键，degree = 第几个）。
 */
export function createTheoryBench(init = {}) {
  const st = { ladder: null, home: false, names: false, degrees: false, keys: false, trail: true, machine: null, top: 'trail', chordKeys: 0, dark: false, piano: true, big: false, ...init };
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
    const el = h('button', { class: ['tb-key', black ? 'b' : 'w'], type: 'button', 'data-sfx': 'none', 'data-m': String(m), 'aria-label': nameOf(m) }, h('i', { class: 'tb-deg' }), h('span', { class: 'tb-nm' }, nameOf(m)), h('em', { class: 'tb-blk' }));
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
    const el = h('button', { class: 'tb-skey', type: 'button', 'data-sfx': 'none', 'data-key': String(d) }, h('b', {}, `键 ${d}`), h('span', {}), h('em', { class: 'tb-mood' }));
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

  // ── 格子（theory-roll.js）──
  const roll = createRoll({
    onTone: (m) => !api.silent && tone(m),
    onEdit: (mel, what) => api.onRoll?.(mel, what),
    onPick: (i, fixed) => api.onPick?.(i, fixed),
  });
  const rollBox = h('div', { class: 'tb-roll' }, roll.el);

  // ── 谱子（theory-staff.js；选学“看懂谱子”）──
  const staffHit = (kind) => (v) => !api.locked && api.onStaff?.(kind, v);
  const staff = createStaff({ onNote: staffHit('note'), onSpot: staffHit('spot'), onCell: staffHit('cell'), onLine: staffHit('line'), onBar: staffHit('bar') });
  const staffBox = h('div', { class: 'tb-staff' }, staff.el);

  // ── 回家圈 ──
  const RW = 200;
  const ringSvg = s('svg', { viewBox: `0 0 ${RW} ${RW}`, class: 'tb-ring-svg' });
  const ringBox = h('div', { class: 'tb-ring' }, ringSvg);
  const polar = (deg, r = 72) => [RW / 2 + r * Math.cos((deg * Math.PI) / 180), RW / 2 + r * Math.sin((deg * Math.PI) / 180)];
  const stationEls = new Map();
  const arrowEls = new Map(); // '6>2' → 那一段箭头
  const defs = s('defs');
  const tip = s('marker', { id: 'tb-arrow', viewBox: '0 0 8 8', refX: 6, refY: 4, markerWidth: 5, markerHeight: 5, orient: 'auto' });
  tip.append(s('path', { d: 'M0,0 L8,4 L0,8 z', class: 'tb-ring-tip' }));
  defs.append(tip);
  ringSvg.append(defs);
  RING.forEach((d, k) => {
    const to = RING[(k + 1) % 7];
    const [x0, y0] = polar(-90 + (k * 360) / 7 + 17);
    const [x1, y1] = polar(-90 + ((k + 1) * 360) / 7 - 19);
    const arc = s('path', { d: `M${x0.toFixed(1)},${y0.toFixed(1)} A72,72 0 0 1 ${x1.toFixed(1)},${y1.toFixed(1)}`, class: `tb-ring-arc${to === 1 ? ' home' : ''}${d === 1 ? ' out' : ''}`, 'marker-end': 'url(#tb-arrow)' });
    arrowEls.set(`${d}>${to}`, arc);
    ringSvg.append(arc);
  });
  RING.forEach((d, k) => {
    const [cx, cy] = polar(-90 + (k * 360) / 7);
    const g = s('g', { class: 'tb-st', 'data-deg': d, tabindex: 0, role: 'button', 'aria-label': `第 ${d} 级的和弦` });
    g.append(s('circle', { cx: cx.toFixed(1), cy: cy.toFixed(1), r: 17 }));
    const t = s('text', { x: cx.toFixed(1), y: (cy + 5.5).toFixed(1), 'text-anchor': 'middle' });
    t.textContent = String(d);
    g.append(t);
    g.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (!api.locked) api.onRing?.(d);
    });
    stationEls.set(d, g);
    ringSvg.append(g);
  });
  const ringCap = s('text', { x: RW / 2, y: RW / 2 + 5, 'text-anchor': 'middle', class: 'tb-ring-cap' });
  ringCap.textContent = '回家圈';
  ringSvg.append(ringCap);

  // ── 三盏灯 ──
  const lampEls = ['和弦到家', '贝斯站稳', '旋律到家'].map((t) => h('span', { class: 'tb-lamp' }, h('i', {}), t));
  const lampRow = h('div', { class: 'tb-lamps', hidden: true }, h('span', { class: 'tb-cap' }, '句号圆不圆'), lampEls);

  const topBox = h('div', { class: 'tb-top' }, trailBox, ringBox, rollBox, staffBox);
  const el = h('div', { class: 'tb' }, topBox, lampRow, piano, synthRow);

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
  /** 梯子的第 d 级是哪个键（8 = 高一层的家，0 = 家下面那一级；按 offsets 的先后数，不看标签） */
  function degMidi(d) {
    const L = st.ladder || { root: LO, offsets: MINOR };
    const n = L.offsets.length;
    const k = (((d - 1) % n) + n) % n;
    return L.root + L.offsets[k] + 12 * Math.floor((d - 1) / n);
  }
  /** 从第 d 级起隔一个拿一个，叠 size 层：这一级的和弦 */
  const chordOf = (d, size = 3) => Array.from({ length: size }, (_, k) => degMidi(d + 2 * k));
  /** 这一摞是亮（major）、暗（minor）还是挤（dim） */
  function moodOf(notes) {
    const a = notes[1] - notes[0];
    const b = notes[2] - notes[0];
    return a === 4 && b === 7 ? 'major' : a === 3 && b === 7 ? 'minor' : a === 3 && b === 6 ? 'dim' : 'other';
  }
  let moodsOn = false;
  let chordNow = [];

  function paint() {
    const lit = new Set(st.dark ? [] : ladderMidis());
    if (!st.dark && st.ladder && !st.ladder.noTop && st.ladder.root + 12 <= HI) lit.add(st.ladder.root + 12); // 梯子顶上那一级：高一层的家（noTop：还在搭，先不亮）
    el.classList.toggle('show-names', !!st.names);
    el.classList.toggle('show-degrees', !!st.degrees);
    el.classList.toggle('no-keys', !st.keys);
    el.classList.toggle('no-trail', !st.trail);
    el.classList.toggle('no-piano', st.piano === false);
    el.classList.toggle('big-roll', !!st.big);
    // 格子里还没摆东西的时候先摆着轨迹，别亮出一块空格子
    const filled = roll.state.rows.length > 0;
    el.dataset.top = !st.trail ? 'none' : st.top === 'roll' && !filled ? 'trail' : st.top;
    el.classList.toggle('has-roll', filled && (st.top === 'roll' || st.top === 'ring'));
    for (const [m, k] of keyEls) {
      const on = lit.has(m);
      k.classList.toggle('lit', on);
      k.classList.toggle('home', on && st.home && isHome(m));
      k.firstChild.textContent = on ? String(degreeOf(m) || '') : '';
    }
    synthEls.forEach((b, i) => {
      const m = machineNote(i + 1);
      b.children[1].textContent = nameOf(m);
      b.classList.toggle('home', !!st.home && !!machine() && i === 0);
      const show = Array.isArray(moodsOn) ? moodsOn.includes(i + 1) : moodsOn;
      const mood = show && st.ladder && st.ladder.offsets.length >= 7 ? moodOf(chordOf(i + 1)) : '';
      b.dataset.mood = mood;
      b.lastChild.textContent = MOOD_WORD[mood] || '';
    });
    for (const [d, g] of stationEls) {
      g.dataset.mood = st.ladder && st.ladder.offsets.length >= 7 ? moodOf(chordOf(d)) : '';
      g.classList.toggle('home', d === 1);
    }
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

  /** 几个音一起响，键盘上叠成色块（地基在最下面）。bass：再垫一个低一层的地基 */
  function playChord(notes, { len = 1.1, vel = 0.6, at = 0, bass = false, show = true, voice = 'keys' } = {}) {
    audio.init().then((ok) => {
      if (!ok) return;
      const t = audio.now() + 0.03 + at;
      notes.forEach((m) => audio.note(m, t, len, { voice, vel }));
      if (bass) audio.note(notes[0] - 12, t, len, { voice: 'bass', vel: 0.7 });
    });
    if (!show) return;
    if (at) timers.push(setTimeout(() => api.chord(notes), at * 1000));
    else api.chord(notes); // 马上摆：后面紧跟着换下一摞的话，不会被这一摞盖回去
  }

  function press(m, from, degree = 0) {
    if (api.locked) return;
    if (from === 'synth' && st.chordKeys && !api.silent) playChord(chordOf(degree, st.chordKeys));
    else if (!api.silent) tone(m);
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
    degMidi,
    chordOf,
    moodOf,
    playChord,
    roll,
    staff,
    /**
     * 放谱子上的音（notes = [{ s, l, m, vel? }]，没有 m 的是休止；vel：1 轻 / 2 中 / 3 重）：谱上正在响的那个音符变色，键跟着亮。
     * from + steps：只放从第 from 格起的 steps 格（一小节一小节放的时候用）。放完 resolve（被 stop() 打断也会）。
     */
    playStaff(notes, { bpm = 92, steps = staff.state.steps, voice = 'keys', keys = true, from = 0 } = {}) {
      api.stop();
      busy = true;
      const sd = 60 / bpm / 4;
      const sounding = notes.map((n, i) => ({ ...n, i })).filter((n) => n.m !== undefined && n.m !== null && n.s >= from && n.s < from + steps);
      audio.init().then((ok) => {
        if (!ok) return;
        const t0 = audio.now() + 0.06;
        for (const n of sounding) audio.note(n.m, t0 + (n.s - from) * sd, Math.max(0.12, n.l * sd * 0.92), { voice, vel: n.vel ? [0, 0.36, 0.68, 1][n.vel] : 0.85 });
      });
      return new Promise((resolve) => {
        for (const n of sounding) timers.push(setTimeout(() => {
          staff.now(n.i);
          if (keys) flash(n.m, Math.max(140, n.l * sd * 800));
        }, 60 + (n.s - from) * sd * 1000));
        const done = () => {
          busy = false;
          staff.now(-1);
          resolve();
        };
        timers.push(setTimeout(done, 60 + steps * sd * 1000 + 160));
        api._resolve = done;
      });
    },
    /** 键盘上叠一摞色块（null = 收起来）。第一个是地基。labels：每一块上写什么（默认 基 / 中 / 上 / 四） */
    chord(notes, labels) {
      for (const m of chordNow) keyEls.get(m)?.classList.remove('ch', 'ch1');
      chordNow = notes ? [...notes] : [];
      chordNow.forEach((m, k) => {
        const key = keyEls.get(m);
        if (!key) return;
        key.classList.add('ch');
        key.classList.toggle('ch1', k === 0);
        // 第四个音离地基不是 10、11 格（不是“第四层”）：它是顶上另加的，写“加”
        key.lastChild.textContent = (labels || (k === 3 && ![10, 11].includes(notes[3] - notes[0]) ? ['', '', '', '加'] : LAYER))[k] || '';
      });
    },
    /** 三盏灯：[和弦到家, 贝斯站稳, 旋律到家]；null = 收起来 */
    lamps(list) {
      lampRow.hidden = !list;
      lampEls.forEach((x, i) => x.classList.toggle('on', !!list?.[i]));
      lampRow.classList.toggle('all', !!list && list.every(Boolean));
    },
    /** 一句话（score）的最后：和弦是不是家、贝斯是不是站在这个和弦的地基上、旋律是不是落在家上 */
    lampsOf(score) {
      const last = (list) => [...(list || [])].sort((a, b) => a.s + a.l - (b.s + b.l)).pop();
      const c = last(score.chords);
      const b = last(score.bass);
      const n = last(score.mel);
      const root = st.ladder?.root ?? LO;
      const same = (x, y) => x !== undefined && y !== undefined && (x - y) % 12 === 0;
      return [!!c && same(c.notes[0], root), !!c && !!b && same(b.m, c.notes[0]), !!n && same(n.m, root)];
    },
    /**
     * 把用“第几级”写的一段换成键号的 score（关里的内容都用级数写，换了梯子、搬了家照样对）：
     *   chords [[第几格起, 占几格, 第几级, 叠几层 = 3]]   bass 'root'（每个和弦底下垫它的地基）或 [[起, 长, 第几级]]（低一层）
     *   mel [[起, 长, 第几级, 记号?]]（0 = 家下面那一级，8 = 高一层的家）
     */
    score(spec = {}) {
      const chords = (spec.chords || []).map(([sx, l, d, size = 3]) => ({ s: sx, l, deg: d, notes: chordOf(d, size) }));
      const bass = spec.bass === 'root' ? chords.map((c) => ({ s: c.s, l: c.l, m: c.notes[0] - 12, deg: c.deg })) : (spec.bass || []).map(([sx, l, d]) => ({ s: sx, l, m: degMidi(d) - 12, deg: d }));
      const mel = (spec.mel || []).map(([sx, l, d, cls]) => ({ s: sx, l, m: degMidi(d), ...(cls ? { cls } : {}) }));
      return { steps: spec.steps || 16, bpm: spec.bpm || 96, chords, bass, mel };
    },
    /** 梯子上从 lo 到 hi 的键，从高到低（extra：不在梯子上也要摆出来的） */
    ladderRows(lo, hi, extra = []) {
      const L = st.ladder;
      const on = (m) => !L || L.offsets.some((o) => (m - L.root - o) % 12 === 0);
      const rows = [];
      for (let m = hi; m >= lo; m--) if (on(m) || extra.includes(m)) rows.push(m);
      return rows;
    },
    /**
     * 把一段 score 摆到格子上。rows 不写就照里面的音自己定（上下各留一行）；别的原样交给格子（mode、unit、snap、tone、ghost）。
     * 行首标的是梯子上的第几级，家那一行是桔红的。anon：行首不标、家也不标（还没找到家的时候）；
     * hide：['chords' / 'bass' / 'mel'] 这几样不画（照样给它们留着行：声音里有，只是不给看）。
     */
    rollShow(score, { rows, range, fit = [], anon = false, hide = [], ...rest } = {}) {
      // fit：现在还没有、等会儿要放进来的音（比如还没配上的贝斯），先给它们留好行
      const all = [...(score.chords || []).flatMap((c) => c.notes), ...(score.bass || []).map((b) => b.m), ...(score.mel || []).map((n) => n.m), ...(rest.ghost || []).map((n) => n.m), ...fit];
      const L = st.ladder;
      const lo = range ? range[0] : Math.min(...all, L ? L.root : LO) - 2;
      const hi = range ? range[1] : Math.max(...all, L ? L.root + 7 : LO + 7) + 2;
      let list = rows || api.ladderRows(lo, hi, all);
      if (!rows && !range && st.big && L) {
        // 拆歌：上面（和弦、旋律）照梯子一行一级摆全；贝斯在低一层，只留它踩过的那几行，省地方
        const low = all.filter((m) => m < L.root - 4);
        const high = all.filter((m) => m >= L.root - 4);
        list = [...api.ladderRows(Math.min(...high, L.root) - 1, Math.max(...high, L.root + 7) + 1, high), ...[...new Set(low)].sort((a, b) => b - a)];
      }
      const labels = {};
      if (L) {
        for (const m of list) {
          const k = L.offsets.findIndex((o) => (m - L.root - o) % 12 === 0);
          if (k >= 0) labels[m] = String(L.degrees ? L.degrees[k] : k + 1);
        }
      }
      const part = (k) => (hide.includes(k) ? [] : score[k] || []);
      roll.set({ steps: score.steps, chords: part('chords'), bass: part('bass'), mel: part('mel'), ghost: [], mode: null, tone: false, unit: 2, snap: 2, pickCol: false, rows: list, labels: anon ? {} : labels, homes: L && st.home && !anon ? [L.root] : [], ...rest });
      paint();
      return api;
    },
    rollClear() {
      roll.set({ rows: [], chords: [], bass: [], mel: [], ghost: [], mode: null });
      paint();
    },
    /** 这个键在梯子上排第几（0 = 家，7 = 高一层的家，-1 = 家下面那一级……）；不在梯子上是 null。数“走了几级”用它 */
    rungOf(m) {
      const L = st.ladder;
      if (!L) return null;
      const oct = Math.floor((m - L.root) / 12);
      const k = L.offsets.indexOf(m - L.root - 12 * oct);
      return k < 0 ? null : oct * L.offsets.length + k;
    },
    /** 这个键是梯子的第几级（哪一层楼的都算；不在梯子上是 0） */
    degOf(m) {
      const r = api.rungOf(m);
      if (r === null) return 0;
      const n = st.ladder.offsets.length;
      const k = ((r % n) + n) % n;
      return st.ladder.degrees ? st.ladder.degrees[k] : k + 1;
    },
    /** 一摞接一摞地放：list 里一项是一摞键号。degs（每一摞是第几级）给了的话，回家圈上跟着亮。放完 resolve（被 stop() 打断也会） */
    playChords(list, { gap = 0.9, len = gap * 0.96, bass = false, degs = null, voice = 'keys', onStep = null, show = true } = {}) {
      api.stop();
      busy = true;
      audio.init().then((ok) => {
        if (!ok) return;
        const t0 = audio.now() + 0.05;
        list.forEach((notes, i) => {
          notes.forEach((m) => audio.note(m, t0 + i * gap, len, { voice, vel: notes.length > 2 ? 0.55 : 0.7 }));
          if (bass) audio.note(notes[0] - 12, t0 + i * gap, len, { voice: 'bass', vel: 0.72 });
        });
      });
      return new Promise((resolve) => {
        list.forEach((notes, i) => timers.push(setTimeout(() => {
          if (show) {
            api.chord(notes);
            notes.forEach((m) => flash(m, Math.max(200, gap * 600)));
          }
          onStep?.(i);
          if (degs) {
            for (const g of stationEls.values()) g.classList.remove('now');
            stationEls.get(degs[i])?.classList.add('now', 'on');
            api.ring.path(degs.slice(0, i + 1));
          }
        }, 50 + i * gap * 1000)));
        const done = () => {
          busy = false;
          resolve();
        };
        timers.push(setTimeout(done, 50 + list.length * gap * 1000 + 150));
        api._resolve = done;
      });
    },
    /** 机器的 7 个键上挂不挂亮暗牌：true / false，或者只挂其中几个（[级…]） */
    moods(on) {
      moodsOn = Array.isArray(on) ? on : !!on;
      paint();
    },
    /** 回家圈：station(级) 那一站的节点、mark(级, 记号)、path([级…]) 把走过的几段箭头描出来、clear() */
    ring: {
      station: (d) => stationEls.get(d),
      mark(d, cls = 'on') {
        stationEls.get(d)?.classList.add(cls);
      },
      path(degs = []) {
        for (const a of arrowEls.values()) a.classList.remove('on');
        degs.forEach((d, i) => i > 0 && arrowEls.get(`${degs[i - 1]}>${d}`)?.classList.add('on'));
      },
      clear() {
        for (const g of stationEls.values()) g.classList.remove('on', 'now', 'good', 'bad', 'target');
        for (const a of arrowEls.values()) a.classList.remove('on');
      },
    },
    /**
     * 放一段格子里的东西：score = { steps, bpm?, chords, bass, mel }（键号的，见 theory-roll.js）。播放头跟着走，旋律的键跟着亮，和弦叠成色块。
     * parts：只放其中几样（['chords', 'bass', 'mel']）；times：转几圈；keys: false 键盘上不跟着亮（只听）；
     * offset：放的是切出来的一段时，播放头从第几格走起。放完 resolve（被 stop() 打断也会）。
     */
    playScore(score, { parts = ['chords', 'bass', 'mel'], times = 1, bpm = score.bpm || 96, keys = true, offset = 0 } = {}) {
      api.stop();
      busy = true;
      const sd = 60 / bpm / 4;
      const has = (p) => parts.includes(p);
      audio.init().then((ok) => {
        if (!ok) return;
        const t0 = audio.now() + 0.06;
        for (let r = 0; r < times; r++) {
          const base = t0 + r * score.steps * sd;
          if (has('chords')) for (const c of score.chords || []) c.notes.forEach((m) => audio.note(m, base + c.s * sd, c.l * sd * 0.97, { voice: 'pad', vel: 0.5 }));
          if (has('bass')) for (const b of score.bass || []) audio.note(b.m, base + b.s * sd, b.l * sd * 0.92, { voice: 'bass', vel: 0.78 });
          if (has('mel')) for (const n of score.mel || []) audio.note(n.m, base + n.s * sd, Math.max(0.12, n.l * sd * 0.94), { voice: 'keys', vel: 0.92 });
        }
      });
      return new Promise((resolve) => {
        for (let r = 0; r < times; r++) {
          for (let k = 0; k < score.steps; k++) {
            timers.push(setTimeout(() => {
              roll.head(k + offset);
              if (keys && has('chords')) {
                const c = (score.chords || []).find((x) => x.s === k);
                if (c) api.chord(c.notes);
              }
              if (keys && has('mel')) for (const n of score.mel || []) if (n.s === k) flash(n.m, Math.max(140, n.l * sd * 800));
            }, 60 + (r * score.steps + k) * sd * 1000));
          }
        }
        const done = () => {
          busy = false;
          roll.head(null);
          resolve();
        };
        timers.push(setTimeout(done, 60 + times * score.steps * sd * 1000 + 160));
        api._resolve = done;
      });
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
      roll.head(null);
      staff.now(-1);
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
  // Object.assign 只会把 get busy() 当时的值抄过来（永远是 false）：这里重新定义成真的“现在是不是正在放”
  Object.defineProperty(api, 'busy', { get: () => busy });
  paint();
  return api;
}
