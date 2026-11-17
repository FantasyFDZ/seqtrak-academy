// 格子：乐理台最上面那一层的另一种样子（乐理线重做第二期，方案见 docs/training-plan.md “乐理线重做”）。
// 横着是时间：一格 = 一个十六分音符，16 格一小节，和机器上那 16 个 Drum keys 是同一把尺子。竖着是梯子上的音（一行一级）。
// 三样东西叠在同一张图上：
//   和弦   一摞半透明的色带（每一层一条，最底下那条是地基，颜色深一点）
//   贝斯   最下面一条蓝的线
//   旋律   一个个小块：占几格就多长；踩在和弦上的是实心，路过的是空心（tone: true 时才分）
// 旋律可以改（mode）：
//   'place'  点空格子放一个音，点已有的音选中它，拖它右边的小把手拉长
//   'len'    只能改长短（拖把手，或者选中以后由外面的按钮改）
//   'draw'   按住拖过去：经过的每一拍都落一个音（“画一条线，变成旋律”）
//   'pick'   只能点一个音（告诉外面点了第几个）
// 这个文件只管画和改，不出声：要响的时候调 onTone(键号)。键号和乐理台一样（60 = 最左边的 C）。
import { h } from './util.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * createRoll({ onTone, onEdit, onPick }) → { el, set(patch), mel, sel, select(i), setLen(i, l), remove(i), move(i, m), head(step), pointOf(step, m), noteEl(i) }
 * set() 认的：steps（一共几格）、rows（从高到低的键号）、labels（{ 键号: 行首写什么 }）、homes（哪几行是家）、
 *   chords [{ s, l, notes }]、bass [{ s, l, m }]、mel [{ s, l, m, fixed?, cls? }]、ghost [{ s, l, m }]（淡淡的另一句：要对上的那一句）、
 *   mode、unit（新放的音占几格）、snap（落点吸到几格的整数倍上）、tone（旋律要不要分“踩上去 / 路过”）。
 */
export function createRoll({ onTone, onEdit, onPick } = {}) {
  const st = { steps: 16, rows: [], labels: {}, homes: [], chords: [], bass: [], mel: [], ghost: [], mode: null, unit: 2, snap: 2, tone: false };
  let sel = -1;
  let drag = null; // { kind: 'len' | 'draw', i }
  const grid = h('div', { class: 'tr-grid' });
  const gutter = h('div', { class: 'tr-gutter', 'aria-hidden': 'true' });
  const headEl = h('i', { class: 'tr-head', hidden: true });
  const el = h('div', { class: 'tr' }, gutter, grid);

  const R = () => Math.max(1, st.rows.length);
  const rowOf = (m) => st.rows.indexOf(m);
  const pct = (a, b) => `${(a / b) * 100}%`;
  const box = (s, l, r, cls) => h('i', { class: cls, style: { left: pct(s, st.steps), width: pct(l, st.steps), top: pct(r, R()), height: pct(1, R()) } });
  const chordAt = (s) => st.chords.find((c) => c.s <= s && s < c.s + c.l) || null;
  const inChord = (n) => {
    const c = chordAt(n.s);
    return !!c && c.notes.some((x) => (x - n.m) % 12 === 0);
  };
  const isHome = (m) => st.homes.some((x) => (x - m) % 12 === 0);

  function paint() {
    el.classList.toggle('editable', !!st.mode);
    el.dataset.mode = st.mode || '';
    gutter.replaceChildren(...st.rows.map((m) => h('span', { class: isHome(m) ? 'home' : '' }, st.labels[m] ?? '')));
    const kids = [];
    st.rows.forEach((m, r) => kids.push(h('i', { class: ['tr-row', r % 2 ? 'alt' : '', isHome(m) ? 'home' : ''], style: { top: pct(r, R()), height: pct(1, R()) } })));
    for (let s = 0; s <= st.steps; s += 4) kids.push(h('i', { class: ['tr-bar', s % 16 === 0 ? 'bar' : ''], style: { left: pct(s, st.steps) } }));
    for (const c of st.chords) {
      c.notes.forEach((m, k) => {
        const r = rowOf(m);
        if (r >= 0) kids.push(box(c.s, c.l, r, ['tr-ch', k === 0 ? 'root' : '', c.cls || '']));
      });
    }
    for (const b of st.bass) {
      const r = rowOf(b.m);
      if (r >= 0) kids.push(box(b.s, b.l, r, ['tr-bs', b.cls || '']));
    }
    for (const g of st.ghost) {
      const r = rowOf(g.m);
      if (r >= 0) kids.push(box(g.s, g.l, r, 'tr-n ghost'));
    }
    st.mel.forEach((n, i) => {
      const r = rowOf(n.m);
      if (r < 0) return;
      const node = box(n.s, n.l, r, ['tr-n', n.fixed ? 'fixed' : '', i === sel ? 'sel' : '', isHome(n.m) ? 'home' : '', st.tone ? (inChord(n) ? 'in' : 'out') : '', n.cls || '']);
      node.dataset.i = String(i);
      if ((st.mode === 'place' || st.mode === 'len') && !n.fixed) node.append(h('b', { class: 'tr-grip' }));
      kids.push(node);
    });
    kids.push(headEl);
    grid.replaceChildren(...kids);
  }

  /** 指针在第几格、第几行 */
  function at(e) {
    const r = grid.getBoundingClientRect();
    const step = clamp(Math.floor(((e.clientX - r.left) / Math.max(1, r.width)) * st.steps), 0, st.steps - 1);
    const row = clamp(Math.floor(((e.clientY - r.top) / Math.max(1, r.height)) * R()), 0, R() - 1);
    return { step, row, m: st.rows[row] };
  }
  const sortMel = (keep) => {
    st.mel.sort((a, b) => a.s - b.s);
    sel = keep ? st.mel.indexOf(keep) : -1;
  };
  /** 第 i 个音最长能拉到几格：到下一个音开头，或者到最后一格 */
  const maxLen = (i) => (st.mel[i + 1] ? st.mel[i + 1].s : st.steps) - st.mel[i].s;

  /** 在第 step 格放一个音（吸到 snap 的整数倍上）。那里有不能动的音就不放 */
  function place(step, m, { quiet = false } = {}) {
    const s = Math.floor(step / st.snap) * st.snap;
    const l = Math.min(st.unit, st.steps - s);
    if (st.mel.some((n) => n.fixed && n.s < s + l && n.s + n.l > s)) return false;
    st.mel = st.mel.filter((n) => !(n.s >= s && n.s < s + l));
    for (const n of st.mel) if (n.s < s && n.s + n.l > s) n.l = s - n.s;
    const note = { s, l, m };
    st.mel.push(note);
    sortMel(note);
    if (!quiet) onTone?.(m);
    paint();
    onEdit?.(st.mel, 'place');
    return true;
  }

  grid.addEventListener('pointerdown', (e) => {
    if (!st.mode) return;
    e.preventDefault();
    const p = at(e);
    const node = e.target.closest?.('.tr-n:not(.ghost)');
    const i = node ? Number(node.dataset.i) : -1;
    const grip = !!e.target.closest?.('.tr-grip');
    try {
      grid.setPointerCapture(e.pointerId);
    } catch { /* 走查脚本造的指针没有这一步 */ }
    if (st.mode === 'draw') {
      drag = { kind: 'draw', last: -1 };
      return drawAt(p);
    }
    if (st.mode === 'pick') return i >= 0 && onPick?.(i);
    if (i >= 0) {
      if (st.mel[i].fixed) return onPick?.(i, true);
      sel = i;
      if (grip) drag = { kind: 'len', i };
      else onTone?.(st.mel[i].m);
      paint();
      return onPick?.(i);
    }
    if (st.mode === 'place') place(p.step, p.m);
  });
  function drawAt(p) {
    const s = Math.floor(p.step / st.snap) * st.snap;
    const cur = st.mel.find((n) => n.s === s);
    if (drag.last === s && cur?.m === p.m) return;
    drag.last = s;
    if (cur && cur.m === p.m) return;
    place(p.step, p.m);
  }
  grid.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = at(e);
    if (drag.kind === 'draw') return drawAt(p);
    const n = st.mel[drag.i];
    const l = clamp(p.step - n.s + 1, 1, maxLen(drag.i));
    if (l === n.l) return;
    n.l = l;
    paint();
    onEdit?.(st.mel, 'len');
  });
  const end = () => {
    if (drag?.kind === 'len') onTone?.(st.mel[drag.i].m);
    drag = null;
  };
  grid.addEventListener('pointerup', end);
  grid.addEventListener('pointercancel', end);

  const api = {
    el,
    get state() {
      return st;
    },
    get mel() {
      return st.mel;
    },
    get sel() {
      return sel;
    },
    set(patch = {}) {
      Object.assign(st, patch);
      if ('mel' in patch) {
        st.mel = (patch.mel || []).map((n) => ({ ...n }));
        sortMel(null);
      }
      paint();
      return api;
    },
    select(i) {
      sel = i;
      paint();
    },
    place,
    maxLen,
    /** 把第 i 个音改成 l 格长（超出去的截到下一个音前面） */
    setLen(i, l) {
      const n = st.mel[i];
      if (!n || n.fixed) return false;
      n.l = clamp(l, 1, maxLen(i));
      paint();
      onEdit?.(st.mel, 'len');
      return true;
    },
    remove(i) {
      if (!st.mel[i] || st.mel[i].fixed) return false;
      st.mel.splice(i, 1);
      sel = -1;
      paint();
      onEdit?.(st.mel, 'remove');
      return true;
    },
    /** 把第 i 个音挪到另一行（长短、位置不变） */
    move(i, m) {
      const n = st.mel[i];
      if (!n || rowOf(m) < 0) return false;
      n.m = m;
      paint();
      onEdit?.(st.mel, 'move');
      return true;
    },
    /** 播放头走到第几格（null = 收起来） */
    head(step) {
      headEl.hidden = step === null || step === undefined;
      if (!headEl.hidden) headEl.style.left = pct(step, st.steps);
    },
    /** 第 step 格、键号 m 那一行的正中间在屏幕上的哪儿（走查脚本用它算该点哪里） */
    pointOf(step, m, dx = 0.5) {
      const r = grid.getBoundingClientRect();
      const row = Math.max(0, rowOf(m));
      return { x: r.left + ((step + dx) / st.steps) * r.width, y: r.top + ((row + 0.5) / R()) * r.height };
    },
    noteEl: (i) => grid.querySelector(`.tr-n[data-i="${i}"]`),
    grid,
  };
  paint();
  return api;
}
