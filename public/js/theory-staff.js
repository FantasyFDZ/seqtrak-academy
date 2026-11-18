// 谱子：乐理台最上面那一层的又一种样子（乐理线重做第三期，选学单元“看懂谱子”；方案见 docs/training-plan.md “选学单元”）。
// 主路上不出现五线谱；只有选学的那 4 关用它。玩法是“谱子和格子互相翻译”，所以这块东西上下两层、横着对齐：
//   上面  五线谱：谱号、拍号、音符（长短写在长相上）、休止符、小节线、反复记号、轻重的记号
//   下面  机器的格子：一格 = 十六分 = 机器上的一个方键。谱上的一个音占几格，下面就亮几格（开头那一格最实）
// 横着是按时间等分的（真的乐谱不是）：这样谱上的每个音符正对着它在格子里的那一格。
// 只管画和告诉外面“点了哪儿”，不出声。键号和乐理台一样（60 = 最左边的 C = 谱子下面加的那条短线）。
// 音符的长短（占几格）→ 长相：16 全音符、8 二分、4 四分、2 八分、1 十六分；12 / 6 / 3 是加了点的（长一半）。
// 别的格数拆成两个用连线连起来。不画连梁（几个八分音符的尾巴连成一条的那种），每个音符各带各的尾巴。
import { h } from './util.js';

const SVG = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, kids = []) => {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined && v !== false) el.setAttribute(k, String(v));
  for (const kid of [].concat(kids)) if (kid) el.append(kid);
  return el;
};
/** 谱子画多宽（画布上的单位）：格子少就画窄一点，同样的地方音符就大一点 */
const widthOf = (steps) => (steps <= 16 ? 440 : steps <= 24 ? 520 : steps <= 32 ? 600 : 620);
const G = 10; // 线和线隔多远
const Y0 = 78; // 最下面那条线（E）
const STRIP_Y = 122;
const STRIP_H = 30;
const LENS = [16, 12, 8, 6, 4, 3, 2, 1];
const SHARP_POS = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const FLAT_POS = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6];
const BLACK = [1, 3, 6, 8, 10];
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const WHITE = [0, 2, 4, 5, 7, 9, 11];

/** 键号 → 谱上的位置（0 = 下面加的那条短线上的 C，每往上一个白键加 1：偶数在线上，奇数在缝里） */
export function posOf(m, flats = false) {
  const pc = ((m % 12) + 12) % 12;
  return (flats ? FLAT_POS : SHARP_POS)[pc] + 7 * (Math.floor(m / 12) - 5);
}
/** 谱上的位置 → 白键的键号 */
export const midiAt = (pos) => 60 + 12 * Math.floor(pos / 7) + WHITE[((pos % 7) + 7) % 7];
export const letterAt = (pos) => LETTERS[((pos % 7) + 7) % 7];
/** 这个位置用大白话怎么说 */
export function posWord(pos) {
  if (pos === 0) return '谱子下面加的那条短线上';
  if (pos === 1) return '最下面那条线的下面，贴着它';
  if (pos >= 12) return pos % 2 ? '谱子上面加的短线旁边的缝里' : '谱子上面加的短线上';
  if (pos === 11) return '最上面那条线的上面，贴着它';
  return pos % 2 === 0 ? `从下往上数第 ${pos / 2} 条线上` : `从下往上数第 ${(pos - 1) / 2} 个缝里`;
}
/** 一个占 l 格的音，拆成几个写得出来的长短（一个音符写不出来的长短，拆开来用连线连起来） */
export function pieces(l) {
  const out = [];
  let rest = l;
  while (rest > 0) {
    const p = LENS.find((x) => x <= rest);
    out.push(p);
    rest -= p;
  }
  return out;
}
export const LEN_WORD = { 16: '全音符', 12: '加点的二分音符', 8: '二分音符', 6: '加点的四分音符', 4: '四分音符', 3: '加点的八分音符', 2: '八分音符', 1: '十六分音符' };
export const REST_WORD = { 16: '全休止符', 8: '二分休止符', 4: '四分休止符', 2: '八分休止符', 1: '十六分休止符' };

const y = (pos) => Y0 + G - pos * (G / 2);

/** 一个音符的长相（符头在 cx, cy）。up = 尾巴朝上 */
function glyph(cx, cy, l, up, cls = '') {
  const g = s('g', { class: `ts-note ${cls}` });
  const hollow = l >= 8;
  g.append(s('ellipse', { cx, cy, rx: l === 16 ? 6.6 : 5.6, ry: 4, transform: `rotate(-18 ${cx} ${cy})`, class: hollow ? 'ts-head hollow' : 'ts-head' }));
  if (l < 16) {
    const sx = up ? cx + 5.1 : cx - 5.1;
    const sy = up ? cy - 29 : cy + 29;
    g.append(s('line', { x1: sx, y1: up ? cy - 1.5 : cy + 1.5, x2: sx, y2: sy, class: 'ts-stem' }));
    const flags = l <= 1 ? 2 : l <= 3 ? 1 : 0;
    for (let k = 0; k < flags; k++) {
      const fy = sy + (up ? 1 : -1) * k * 7;
      g.append(s('path', { d: up ? `M${sx},${fy} c1,7 9,9 6.5,19` : `M${sx},${fy} c1,-7 9,-9 6.5,-19`, class: 'ts-flag' }));
    }
  }
  if (l === 12 || l === 6 || l === 3) g.append(s('circle', { cx: cx + 10.5, cy: cy - 2.5, r: 1.8, class: 'ts-ink' }));
  return g;
}
/** 一个休止符的长相（摆在 cx 上） */
function restGlyph(cx, l, cls = '') {
  const g = s('g', { class: `ts-note ts-rest ${cls}` });
  const mid = Y0 - 2 * G; // 中间那条线
  if (l >= 16) g.append(s('rect', { x: cx - 5.5, y: mid - G, width: 11, height: 4.6, class: 'ts-ink' }));
  else if (l >= 8) g.append(s('rect', { x: cx - 5.5, y: mid - 4.6, width: 11, height: 4.6, class: 'ts-ink' }));
  else if (l >= 4) g.append(s('path', { d: `M${cx - 3},${mid - 13} l6.5,8 l-5.5,5.5 l5.5,7.5 c-6,-3 -9.5,1 -5,6.5`, class: 'ts-squig' }));
  else {
    const dots = l >= 2 ? 1 : 2;
    for (let k = 0; k < dots; k++) g.append(s('circle', { cx: cx - 3 - k * 1.6, cy: mid - 5 + k * 7, r: 2.3, class: 'ts-ink' }));
    g.append(s('path', { d: `M${cx - 2},${mid - 4} q3.5,0.5 6,-2.5 l-5.5,${dots > 1 ? 21 : 16}`, class: 'ts-squig thin' }));
    if (dots > 1) g.append(s('path', { d: `M${cx - 3.6},${mid + 3} q3.5,0.5 5.2,-2`, class: 'ts-squig thin' }));
  }
  if (l === 12 || l === 6 || l === 3) g.append(s('circle', { cx: cx + 9, cy: mid - 2.5, r: 1.8, class: 'ts-ink' }));
  return g;
}

/** 按钮上用的小图：一个占 l 格的音符（rest：休止符）。挑“这是哪种音符”的牌子用 */
export function noteIcon(l, rest = false) {
  const svg = s('svg', { viewBox: '0 0 30 44', class: 'ts-icon', 'aria-hidden': 'true' });
  const g = rest ? restGlyph(15, l) : glyph(13, 34, l, true);
  if (rest) g.setAttribute('transform', `translate(0 ${-(Y0 - 2 * G) + 24})`);
  svg.append(g);
  return svg;
}

/**
 * createStaff({ onNote, onSpot, onCell, onLine, onBar }) → { el, set(patch), state, now(i), reset() }
 * set() 认的：
 *   steps（一共几格）、bar（一小节几格：16 = 4/4，12 = 3/4）、time（[上面的数, 下面的数]，null = 不写拍号）、clef（画不画谱号）
 *   notes [{ s, l, m（没有 m = 休止符）, cls?, dyn?（'p' / 'mf' / 'f'：写在音符下面）, vel?（1 轻 / 2 中 / 3 重：格子里柱子的高矮） }]
 *   lines（小节线画在第几格前面：'auto' = 照 bar 自己画，[] = 一条都不画）、end（最后画不画收尾的粗线）
 *   repeats [[从第几格, 到第几格]]（反复记号：|: 和 :|）、voltas [[从, 到, '1.']]（“第一遍 / 第二遍”的房子）、hairpins [[从, 到, '<' 或 '>']]（渐强、渐弱）
 *   names（线和缝旁边写不写音名）、flats（黑键写成降号）
 *   strip（下面摆不摆机器的格子：true / false）、lit（[第几格…]：学生自己点亮的格子）、showCells（false = 格子先空着，不照谱子亮）、
 *   cells（[{ s, l, vel? }]：格子里亮的不照谱上的音、另给一份：把格子读成谱子的时候用）、cellCls（{ 第几格: 'cur' / 'miss' / 'extra' }）
 *   spot（{ s, pos }：一个还没放定的音符，虚线的）、cuts（[第几格…]：学生放的小节线）
 *   barLabels（['A', 'B'…]：小节上面的字母）、barCls（{ 第几小节: 'now' / 'done' }）
 *   pick：现在能点什么：'note'（点一个音符）/ 'spot'（点谱面，把 spot 挪过去）/ 'cell'（点下面的格子）/ 'line'（点一拍的边上，放小节线）/ 'bar'（点一整小节）
 */
export function createStaff(on = {}) {
  const blank = () => ({ steps: 16, bar: 16, time: [4, 4], clef: true, notes: [], lines: 'auto', end: true, repeats: [], voltas: [], hairpins: [], names: false, flats: false, strip: false, lit: [], spot: null, cuts: [], barLabels: null, barCls: {}, pick: null, cells: null, showCells: true, cellCls: {} });
  let st = blank();
  let noteEls = [];
  const svg = s('svg', { class: 'ts-svg', role: 'img', 'aria-label': '谱子' });
  const el = h('div', { class: 'ts' }, svg);

  function paint() {
    const H = st.strip ? STRIP_Y + STRIP_H + 14 : 126;
    const W = widthOf(st.steps);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const LEFT = (st.clef ? 46 : 16) + (st.time ? 22 : 0);
    const sw = (W - LEFT - (st.names ? 34 : 12)) / st.steps;
    const xs = (step) => LEFT + step * sw;
    const xc = (step) => LEFT + (step + 0.5) * sw;
    const kids = [];
    const hot = []; // 透明的“能点的地方”，摆在最上面
    // 五条线
    for (let k = 0; k < 5; k++) kids.push(s('line', { x1: 8, x2: W - 6, y1: Y0 - k * G, y2: Y0 - k * G, class: 'ts-line' }));
    // 线和缝旁边的音名（从最下面那条线的 E 到最上面的 F，外加下面那个 C、D）
    if (st.names) for (let p = 0; p <= 10; p++) kids.push(s('text', { x: W - (p % 2 ? 9 : 21), y: y(p) + 3.4, class: `ts-name${p % 2 ? ' gap' : ''}`, 'text-anchor': 'middle' }, letterAt(p)));
    // 谱号：那个卷卷绕着的是从下往上第 2 条线（G）
    if (st.clef) {
      const gy = Y0 - G;
      kids.push(s('g', { transform: `translate(24 ${gy})`, class: 'ts-clef' }, [
        s('path', { d: 'M2,-44 C11,-40 10,-27 2,-18 C-8,-7 -15,1 -12,10 C-9,19 8,18 10,8 C11,-1 3,-6 -3,-2 C-7,1 -6,7 -1,9' }),
        s('path', { d: 'M2,-44 C-3,-37 -1,-22 1,-10 L5,22 C6,31 -4,33 -7,27' }),
        s('circle', { cx: -5.4, cy: 27.4, r: 2.8, class: 'ts-ink' }),
      ]));
    }
    if (st.time) {
      const tx = (st.clef ? 46 : 16) + 9;
      kids.push(s('text', { x: tx, y: Y0 - 2 * G - 1.5, class: 'ts-time', 'text-anchor': 'middle' }, String(st.time[0])));
      kids.push(s('text', { x: tx, y: Y0 - 1.5, class: 'ts-time', 'text-anchor': 'middle' }, String(st.time[1])));
    }
    // 小节线
    const top = Y0 - 4 * G;
    const lines = st.lines === 'auto' ? Array.from({ length: Math.max(0, Math.ceil(st.steps / st.bar) - 1) }, (_, k) => (k + 1) * st.bar) : st.lines || [];
    const starts = new Set(st.repeats.map((r) => r[0]));
    const ends = new Set(st.repeats.map((r) => r[1]));
    for (const at of lines) if (!starts.has(at) && !ends.has(at)) kids.push(s('line', { x1: xs(at), x2: xs(at), y1: top, y2: Y0, class: 'ts-barline' }));
    for (const at of st.cuts) kids.push(s('line', { x1: xs(at), x2: xs(at), y1: top - 6, y2: Y0 + 6, class: 'ts-barline mine' }));
    if (st.end && !ends.has(st.steps)) {
      kids.push(s('line', { x1: xs(st.steps) - 5, x2: xs(st.steps) - 5, y1: top, y2: Y0, class: 'ts-barline' }));
      kids.push(s('line', { x1: xs(st.steps) - 1, x2: xs(st.steps) - 1, y1: top, y2: Y0, class: 'ts-barline thick' }));
    }
    // 反复记号：|: 在 from 前面，:| 在 to 后面
    for (const [from, to] of st.repeats) {
      const a = xs(from) + (from === 0 ? 2 : 0);
      const b = xs(to) - 1;
      kids.push(s('g', { class: 'ts-repeat' }, [
        s('line', { x1: a, x2: a, y1: top, y2: Y0, class: 'ts-barline thick' }), s('line', { x1: a + 4.5, x2: a + 4.5, y1: top, y2: Y0, class: 'ts-barline' }),
        s('circle', { cx: a + 9.5, cy: Y0 - 1.5 * G, r: 2, class: 'ts-ink' }), s('circle', { cx: a + 9.5, cy: Y0 - 2.5 * G, r: 2, class: 'ts-ink' }),
        s('line', { x1: b, x2: b, y1: top, y2: Y0, class: 'ts-barline thick' }), s('line', { x1: b - 4.5, x2: b - 4.5, y1: top, y2: Y0, class: 'ts-barline' }),
        s('circle', { cx: b - 9.5, cy: Y0 - 1.5 * G, r: 2, class: 'ts-ink' }), s('circle', { cx: b - 9.5, cy: Y0 - 2.5 * G, r: 2, class: 'ts-ink' }),
      ]));
    }
    for (const [from, to, label] of st.voltas) {
      kids.push(s('path', { d: `M${xs(from) + 4},${top - 8} V${top - 20} H${xs(to) - 5}`, class: 'ts-volta' }));
      kids.push(s('text', { x: xs(from) + 9, y: top - 9, class: 'ts-volta-n' }, label));
    }
    // 小节上面的字母、小节的底色
    const bars = Math.ceil(st.steps / st.bar);
    for (let k = 0; k < bars; k++) {
      const x0 = xs(k * st.bar);
      const wBar = Math.min(st.bar, st.steps - k * st.bar) * sw;
      if (st.barCls[k]) kids.unshift(s('rect', { x: x0 + 1, y: top - 6, width: wBar - 2, height: 4 * G + 26, rx: 6, class: `ts-barbg ${st.barCls[k]}` }));
      if (st.barLabels?.[k]) kids.push(s('text', { x: x0 + wBar / 2, y: Y0 + 38, class: 'ts-barname', 'text-anchor': 'middle' }, st.barLabels[k]));
      if (st.pick === 'bar') hot.push(s('rect', { x: x0, y: 4, width: wBar, height: H - 8, class: 'ts-hot', 'data-bar': k, tabindex: 0, role: 'button', 'aria-label': `第 ${k + 1} 小节` }));
    }
    // 音符
    noteEls = [];
    st.notes.forEach((n, i) => {
      const g = s('g', { class: `ts-n ${n.cls || ''}`, 'data-i': i });
      const parts = pieces(n.l);
      let at = n.s;
      const rest = n.m === undefined || n.m === null;
      const pos = rest ? 6 : posOf(n.m, st.flats);
      const cy = y(pos);
      const up = pos < 6;
      parts.forEach((l, k) => {
        const cx = xc(at);
        if (rest) g.append(restGlyph(cx, l));
        else {
          for (let p = 0; p >= pos; p -= 2) g.append(s('line', { x1: cx - 9.5, x2: cx + 9.5, y1: y(p), y2: y(p), class: 'ts-ledger' }));
          for (let p = 12; p <= pos; p += 2) g.append(s('line', { x1: cx - 9.5, x2: cx + 9.5, y1: y(p), y2: y(p), class: 'ts-ledger' }));
          if (k === 0 && BLACK.includes(((n.m % 12) + 12) % 12)) g.append(s('text', { x: cx - 13, y: cy + 4.5, class: 'ts-acc', 'text-anchor': 'middle' }, st.flats ? '♭' : '♯'));
          g.append(glyph(cx, cy, l, up));
          if (k > 0) {
            const px = xc(at - parts[k - 1]);
            const ty = up ? cy + 7 : cy - 7;
            g.append(s('path', { d: `M${px + 5},${ty} Q${(px + cx) / 2},${ty + (up ? 8 : -8)} ${cx - 5},${ty}`, class: 'ts-tie' }));
          }
        }
        at += l;
      });
      if (n.dyn) g.append(s('text', { x: xc(n.s), y: Y0 + 30, class: 'ts-dyn', 'text-anchor': 'middle' }, n.dyn));
      kids.push(g);
      noteEls[i] = g;
      if (st.pick === 'note') hot.push(s('rect', { x: xs(n.s), y: 6, width: Math.max(n.l * sw, 26), height: H - 10, class: 'ts-hot', 'data-note': i }));
    });
    for (const [from, to, dir] of st.hairpins) {
      // 口子从第一个音的记号右边起（别压在 p、f 那个字上），张到最后一个音
      const a = xc(from) + 13;
      const b = xc(to) + 4;
      const [x1, x2] = dir === '<' ? [a, b] : [b, a];
      kids.push(s('path', { d: `M${x2},${Y0 + 20} L${x1},${Y0 + 25} L${x2},${Y0 + 30}`, class: 'ts-hairpin' }));
    }
    // 还没放定的那个音符（虚线的）
    if (st.spot) {
      const cx = xc(st.spot.s);
      const cy = y(st.spot.pos);
      for (let p = 0; p >= st.spot.pos; p -= 2) kids.push(s('line', { x1: cx - 9.5, x2: cx + 9.5, y1: y(p), y2: y(p), class: 'ts-ledger' }));
      for (let p = 12; p <= st.spot.pos; p += 2) kids.push(s('line', { x1: cx - 9.5, x2: cx + 9.5, y1: y(p), y2: y(p), class: 'ts-ledger' }));
      kids.push(s('g', { class: `ts-n ts-spot ${st.spot.cls || ''}` }, glyph(cx, cy, 4, st.spot.pos < 6)));
    }
    if (st.pick === 'spot') hot.push(s('rect', { x: LEFT, y: 2, width: W - LEFT - 6, height: 120, class: 'ts-hot', 'data-spot': 1 }));
    // 放小节线
    if (st.pick === 'line') {
      // 小节线只会落在一拍的边上：每 4 格一处，能点的地方以它为中心、左右各 2 格（手指点得准）
      for (let at = 4; at < st.steps; at += 4) hot.push(s('rect', { x: xs(at - 2), y: 4, width: 4 * sw, height: 108, class: 'ts-hot', 'data-line': at }));
    }
    // 机器的格子
    if (st.strip) {
      const src = st.cells || st.notes.filter((n) => n.m !== undefined && n.m !== null);
      const starts2 = new Map(src.map((n) => [n.s, n]));
      const held = new Set();
      for (const n of src) for (let k = 1; k < n.l; k++) held.add(n.s + k);
      kids.push(s('text', { x: LEFT - 6, y: STRIP_Y + STRIP_H / 2 + 4, class: 'ts-cap', 'text-anchor': 'end' }, '格子'));
      for (let k = 0; k < st.steps; k++) {
        const n = st.showCells === false ? null : starts2.get(k);
        const cls = ['ts-cell', k % 4 === 0 && 'beat', n && 'on', st.showCells !== false && held.has(k) && 'tail', st.lit.includes(k) && 'lit', st.cellCls?.[k]].filter(Boolean).join(' ');
        kids.push(s('rect', { x: xs(k) + 1.5, y: STRIP_Y, width: sw - 3, height: STRIP_H, rx: 4, class: cls }));
        if (n && n.vel) kids.push(s('rect', { x: xs(k) + 5, y: STRIP_Y + STRIP_H - 3 - n.vel * 8, width: Math.max(4, sw - 10), height: n.vel * 8, rx: 2, class: `ts-vel v${n.vel}` }));
        if (k % 4 === 0) kids.push(s('text', { x: xs(k) + 3, y: STRIP_Y + STRIP_H + 11, class: 'ts-beatno' }, String(k / 4 + 1)));
        if (st.pick === 'cell') hot.push(s('rect', { x: xs(k), y: STRIP_Y - 8, width: sw, height: STRIP_H + 20, class: 'ts-hot', 'data-cell': k }));
      }
    }
    svg.replaceChildren(...kids, ...hot);
    el.dataset.pick = st.pick || '';
  }

  svg.addEventListener('pointerdown', (e) => {
    const t = e.target.closest?.('.ts-hot');
    if (!t) return;
    e.preventDefault();
    const d = t.dataset;
    if (d.note !== undefined) return on.onNote?.(Number(d.note));
    if (d.cell !== undefined) return on.onCell?.(Number(d.cell));
    if (d.line !== undefined) return on.onLine?.(Number(d.line));
    if (d.bar !== undefined) return on.onBar?.(Number(d.bar));
    if (d.spot !== undefined) {
      const r = svg.getBoundingClientRect();
      const vy = ((e.clientY - r.top) / Math.max(1, r.height)) * svg.viewBox.baseVal.height;
      return on.onSpot?.(Math.max(0, Math.min(14, Math.round((Y0 + G - vy) / (G / 2)))));
    }
  });

  const api = {
    el,
    get state() {
      return st;
    },
    set(patch = {}) {
      Object.assign(st, patch);
      paint();
      return api;
    },
    /** 从头摆一张新的（没写的都回到默认） */
    show(spec = {}) {
      st = { ...blank(), ...spec };
      paint();
      return api;
    },
    reset() {
      st = blank();
      paint();
    },
    /** 正在响的是第几个音符（-1 = 都不亮） */
    now(i) {
      noteEls.forEach((g, k) => g?.classList.toggle('now', k === i));
    },
    noteEl: (i) => noteEls[i],
    /** 第 step 格、谱上第 pos 个位置在屏幕上的哪儿（走查脚本用它算该点哪里） */
    pointOf(step, pos = 6) {
      const r = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      const LEFT = (st.clef ? 46 : 16) + (st.time ? 22 : 0);
      const W = widthOf(st.steps);
      const sw = (W - LEFT - (st.names ? 34 : 12)) / st.steps;
      return { x: r.left + ((LEFT + (step + 0.5) * sw) / vb.width) * r.width, y: r.top + (y(pos) / vb.height) * r.height };
    },
    hot: (sel) => svg.querySelector(`.ts-hot${sel}`),
    svg,
  };
  paint();
  return api;
}
