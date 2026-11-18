// 小课堂每一关的封面：一张从“这一关讲的东西”里画出来的小图（选曲台的列表和舞台、推荐路线页的卡片在用）。
// 规矩：
//   · 纯 SVG，视框 100 × 100，只用 currentColor（深浅靠透明度），没有外部资源；颜色由放它的地方定。
//   · 一关一张，照内容画：节奏线有图案 / 谱面的用真的图案，别的按这一关讲什么来画；四个大关一个样子，颜色跟各自的线。
//     不用随机数凑：新加了关，就在下面的 DRAW 里给它画一张（没画的先用这条线的图标顶着，tools 里的总览页会标出来）。
//   · 只有大封面会动：coverSvg(level, { anim: true }) 给会动的部件带上 cva-* 的类名，怎么动写在
//     public/css/classroom-select.css 里（只在“丰富”档、系统没开减少动态、地址不带 ?still 时才动）。
// 这个文件是纯函数（Node 里也能跑）。总览页：public/js/dev/covers.html。

let live = false; // 这一张要不要带动效的类名（coverSvg 里设）

const n = (v) => Math.round(v * 10) / 10;
const op = (o) => (o == null || o === 1 ? '' : ` opacity="${o}"`);
/** 会动的部件：cls = 哪一种动法（step / pulse / spin / spinc / bob / slide / ring / flow / wig），i = 第几个（错开的相位），steps = 一圈几步 */
const a = (cls, i, steps) => (live ? ` class="cva-${cls}"${i == null ? '' : ` style="--i:${i}${steps ? `;--n:${steps}` : ''}"`}` : '');
const rect = (x, y, w, h, r = 2, o, more = '') => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${r}" fill="currentColor"${op(o)}${more}/>`;
const box = (x, y, w, h, r = 2, sw = 2.5, o, more = '') => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${r}" fill="none" stroke="currentColor" stroke-width="${sw}"${op(o)}${more}/>`;
const dot = (cx, cy, r, o, more = '') => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${r}" fill="currentColor"${op(o)}${more}/>`;
const ring = (cx, cy, r, sw = 3, o, more = '') => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${r}" fill="none" stroke="currentColor" stroke-width="${sw}"${op(o)}${more}/>`;
const line = (d, sw = 3, o, more = '') => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${op(o)}${more}/>`;
const shape = (d, o, more = '') => `<path d="${d}" fill="currentColor"${op(o)}${more}/>`;
const group = (inner, more = '') => `<g${more}>${inner}</g>`;
const DASH = ' stroke-dasharray="5 5"';

// ───────────── 几样常用的零件 ─────────────

/** 一排格子：pat = 'x---x-…'，一格一步。亮的实、暗的淡；会动时一格一格走 */
function cells(pat, { x = 7, y, w, h, gap = 1.4, r = 2.5, on = 1, dim = 0.15, from = 0, steps, still = false } = {}) {
  const k = pat.length;
  const cw = w ?? (86 - gap * (k - 1)) / k;
  return [...pat].map((c, i) => rect(x + i * (cw + gap), y, cw, h, r, c === 'x' ? on : dim, still ? '' : a('step', from + i, steps || k))).join('');
}

/** 键盘的简笔：下排白键、上排是它们缝里的黑键（不重叠，所以只靠深浅就分得清）。lit / litB = 亮哪几个白键 / 黑键 */
function keys({ x = 8, y = 24, w = 84, whites = 7, h = 60, lit = [], litB = [], pulse = true }) {
  const kw = w / whites;
  let out = '';
  let k = 0;
  for (let i = 0; i < whites; i++) {
    const on = lit.includes(i);
    out += rect(x + i * kw + 1, y + h * 0.42, kw - 2, h * 0.58, 2.5, on ? 1 : 0.22, on && pulse ? a('pulse', k++) : '');
  }
  for (let i = 0; i < whites - 1; i++) {
    if ([2, 6].includes(i % 7)) continue; // E–F、B–C 中间没有黑键
    const on = litB.includes(i);
    out += rect(x + (i + 1) * kw - kw * 0.31, y, kw * 0.62, h * 0.36, 2, on ? 1 : 0.5, on && pulse ? a('pulse', k++) : '');
  }
  return out;
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];

/** 一摞横块（和弦）：cx = 中线，top = 最上面一层的 y，ops = 每一层的深浅（从上到下） */
function stack(cx, top, ops, { w = 44, h = 11, gap = 4, r = 4, more = () => '' } = {}) {
  return ops.map((o, i) => rect(cx - w / 2, top + i * (h + gap), w, h, r, o, more(i))).join('');
}

/** 小房子：家（第 1 级）。x、y = 左上角，s = 宽 */
const house = (x, y, s = 22, o, more = '') => shape(`M${n(x - 2)} ${n(y + s * 0.46)} L${n(x + s / 2)} ${n(y)} L${n(x + s + 2)} ${n(y + s * 0.46)} L${n(x + s - 1)} ${n(y + s * 0.46)} V${n(y + s)} H${n(x + 1)} V${n(y + s * 0.46)} Z`, o, more);

/** 箭头的头：尖在 (x, y)，朝 deg 度（0 = 朝右） */
const tip = (x, y, deg, s = 6, o) => shape(`M0 0 L${-s} ${-s * 0.62} L${-s} ${s * 0.62} Z`, o, ` transform="translate(${n(x)} ${n(y)}) rotate(${deg})"`);

/** 右上角一支小铅笔：小作品（要自己写点东西）的关 */
const pencil = () => shape('M80.5 20.5 L90 11 L94 15 L84.5 24.5 L79 26 Z', 0.9) + line('M88 13 L92 17', 1.6, 0.35);

/** 五线谱 */
const staff = (top, gap, x1 = 6, x2 = 94, o = 0.45) => [0, 1, 2, 3, 4].map((i) => line(`M${x1} ${top + i * gap} H${x2}`, 1.6, o)).join('');
/** 音符的头（斜着的小椭圆）。hollow = 空心 */
const head = (cx, cy, { hollow = false, s = 1, more = '' } = {}) => (hollow
  ? `<ellipse cx="${cx}" cy="${cy}" rx="${n(5.2 * s)}" ry="${n(3.7 * s)}" fill="none" stroke="currentColor" stroke-width="2.4" transform="rotate(-18 ${cx} ${cy})"${more}/>`
  : `<ellipse cx="${cx}" cy="${cy}" rx="${n(5.8 * s)}" ry="${n(4.2 * s)}" fill="currentColor" transform="rotate(-18 ${cx} ${cy})"${more}/>`);

// ───────────── 四个大关：一个样子 ─────────────

function star(cx, cy, R, o, more = '') {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const t = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? R * 0.45 : R;
    d += `${i ? 'L' : 'M'}${n(cx + rr * Math.cos(t))} ${n(cy + rr * Math.sin(t))}`;
  }
  return shape(`${d}Z`, o, more);
}
const boss = () => star(50, 40, 25, 1, a('pulse', 0)) + star(21, 70, 11, 0.55, a('pulse', 1)) + star(79, 70, 11, 0.55, a('pulse', 2)) + rect(22, 88, 56, 4, 2, 0.35);

// ───────────── 四条线的图标（切线的那一行用；没画封面的新关也先用它顶着） ─────────────

const ICON = {
  theory: () => keys({ y: 20, h: 62, lit: [0, 2, 4], pulse: false }),
  rhythm: () => ['x--x', '--x-', 'x---', '-x-x'].map((p, row) => cells(p, { x: 8, y: 8 + row * 22, w: 18, h: 18, gap: 4, r: 4.5, dim: 0.2, still: true })).join(''),
  fx: () => line('M6 66 C26 66 32 30 48 34 S68 74 94 58', 5) + line('M6 86 H94', 2, 0.3) + ring(76, 24, 13, 4) + line('M76 24 L84 16', 4),
  dj: () => [27, 73].map((cx) => ring(cx, 42, 19, 4) + ring(cx, 42, 10.5, 1.5, 0.5) + dot(cx, 42, 3.6) + line(`M${cx} 24 V30`, 3)).join('') + line('M18 82 H82', 3, 0.35) + rect(55, 75, 14, 14, 4),
};

// ───────────── 每一关 ─────────────

const DRAW = {
  // ── 乐理 · 单元 1 音高：键盘上亮的键 ──
  // 高和低：隔着一个八度的两个同名音，一条弧把它们连起来
  T5: () => keys({ y: 30, h: 56, whites: 8, lit: [0, 7] }) + line('M13 24 C28 4 72 4 87 24', 3, 0.6) + tip(87, 24, 62, 6, 0.6),
  // 一格和两格：一个八度 12 格；E–F 挨着（一格），G–A 隔一个（两格）
  T6: () => {
    const black = [1, 3, 6, 8, 10];
    const lit = [4, 5, 7, 9];
    let out = '';
    for (let i = 0; i < 12; i++) out += rect(8 + i * 7.1, 26, 5.9, black.includes(i) ? 26 : 40, 2, lit.includes(i) ? 1 : black.includes(i) ? 0.5 : 0.2, lit.includes(i) ? a('pulse', lit.indexOf(i) < 2 ? 0 : 1) : '');
    return out + line('M37.5 74 v6 h11.6 v-6', 2.6) + line('M58.8 74 v6 h18.7 v-6', 2.6) + dot(43.3, 89, 2.4) + dot(64.5, 89, 2.4) + dot(71.8, 89, 2.4);
  },
  // 机器的 7 个键：键盘那 12 格里挑出 7 个，对到下面 7 个 Synth key 上
  T14: () => {
    const white = [0, 2, 4, 5, 7, 9, 11];
    let out = '';
    for (let i = 0; i < 12; i++) out += rect(8 + i * 7.1, 10, 5.9, white.includes(i) ? 24 : 15, 2, white.includes(i) ? 0.85 : 0.25);
    white.forEach((w, k) => {
      const x1 = 8 + w * 7.1 + 2.95;
      const x2 = 12.5 + k * 12.5;
      out += line(`M${n(x1)} 37 L${n(x2)} 60`, 1.5, 0.4) + rect(x2 - 5, 62, 10, 22, 3.5, 1, a('step', k, 7));
    });
    return out;
  },

  // ── 乐理 · 单元 2 梯子：阶梯 ──
  // 搭一把梯子：两格、两格、一格……一级一级搭上去（大调的步子）
  T15: () => [...MAJOR, 12].map((s, i) => rect(8 + i * 10.8, 80 - s * 5.4, 8.4, 10 + s * 5.4, 3, i === 0 || i === 7 ? 1 : 0.55, a('step', i, 8))).join(''),
  // 亮和暗：同一把梯子的两个版本并排，暗的那把第 3、6、7 级矮半步
  T7: () => MAJOR.map((s, i) => rect(8 + i * 12.4, 80 - s * 5.6, 4.8, 10 + s * 5.6, 2.4, 1, a('pulse', 0)) + rect(13.6 + i * 12.4, 80 - MINOR[i] * 5.6, 4.8, 10 + MINOR[i] * 5.6, 2.4, 0.36, a('pulse', 1))).join(''),
  // 家：第 1 级是家，走到高处还要落回来
  T16: () => house(8, 64, 24, 1, a('pulse', 0)) + MAJOR.slice(1).map((s, i) => rect(38 + i * 9.6, 80 - s * 5, 7.2, 8 + s * 5, 3, 0.28)).join('') + line('M86 16 C60 0 30 20 22 54', 3, 0.7, DASH) + tip(22, 55, 104, 7, 0.9),
  // 怎么按都不难听：7 级里只留 5 级，挤着的那两级拿掉
  T8: () => MINOR.map((s, i) => ([1, 5].includes(i) ? dot(13 + i * 12.4, 84, 2.2, 0.4) : rect(8 + i * 12.4, 78 - s * 5.4, 10, 10 + s * 5.4, 3.5, 0.9, a('step', [0, 0, 1, 2, 3, 3, 4][i], 5)))).join(''),
  // 整首歌搬个家：同一段楼梯，原样挪到另一个地方
  T12: () => {
    const steps = (x, y, o, more = '') => group([0, 1, 2, 3].map((i) => rect(x + i * 9.5, y - 12 - i * 9, 7.5, 12 + i * 9, 2.5, o)).join(''), more);
    return steps(8, 90, 0.26) + line('M34 44 L48 34', 3, 0.7) + tip(50, 32.5, -36, 7, 0.9) + steps(54, 62, 1, a('bob'));
  },
  // 让它回家（小作品）：一句旋律，最后一个音落在家上
  T17: () => line('M12 44 L28 30 L44 50 L60 36 L79 62', 3, 0.42) + [[12, 44], [28, 30], [44, 50], [60, 36]].map((p) => dot(p[0], p[1], 5)).join('') + house(68, 64, 22, 1, a('pulse', 0)) + pencil(),

  // ── 乐理 · 单元 3 旋律：走跳的折线、问答的两句 ──
  // 走和跳：挨着走三步，一下跳上去，再往回走
  T18: () => line('M10 80 L24 72 L38 64', 3, 0.42) + line('M38 64 L56 22', 3, 0.7, DASH) + line('M56 22 L72 30 L88 38', 3, 0.42)
    + [[10, 80], [24, 72], [38, 64], [72, 30], [88, 38]].map((p) => dot(p[0], p[1], 4.8)).join('') + dot(56, 22, 7.5, 1, a('pulse', 0)),
  // 问和答：前半句停在高处悬着（空心），后半句落回家（实心，踩在底线上）
  T19: () => line('M50 12 V88', 2, 0.3, ' stroke-dasharray="3 5"') + line('M10 66 L21 54 L32 60 L42 36', 3, 0.42) + [[10, 66], [21, 54], [32, 60]].map((p) => dot(p[0], p[1], 4.6)).join('') + ring(42, 34, 6, 3, 1, a('pulse', 0))
    + line('M58 40 L68 52 L78 62 L89 78', 3, 0.42) + [[58, 40], [68, 52], [78, 62]].map((p) => dot(p[0], p[1], 4.6)).join('') + dot(89, 78, 7, 1, a('pulse', 2)) + line('M78 89 H98', 3),
  // 重复，再变一点：一个小点子说一遍、再说一遍，第三遍改了尾巴
  T20: () => [8, 38, 68].map((x, k) => {
    const end = k === 2 ? [x + 20, 26] : [x + 20, 58];
    return line(`M${x + 2} 64 L${x + 11} 44 L${end[0]} ${end[1]}`, 3, 0.42) + dot(x + 2, 64, 4.6) + dot(x + 11, 44, 4.6) + dot(end[0], end[1], k === 2 ? 6.5 : 4.6, 1, k === 2 ? a('pulse', 0) : '')
      + line(`M${x} 80 H${x + 22}`, 3, k === 2 ? 1 : 0.4, k === 2 ? DASH : '');
  }).join(''),
  // 长和短：同样几个音，有的占一格，有的拉得很长；句尾的那个最长
  T21: () => [[8, 60, 9], [20, 48, 9], [32, 36, 24], [60, 48, 9], [72, 60, 20]].map((b, i) => rect(b[0], b[1], b[2], 9, 4.5, b[2] > 12 ? 1 : 0.6, b[2] > 12 ? a('pulse', i > 2 ? 1 : 0) : '')).join('')
    + Array.from({ length: 16 }, (_, i) => dot(10.5 + i * 5.3, 84, i % 4 ? 1.2 : 2, i % 4 ? 0.3 : 0.6)).join(''),
  // 一问一答（小作品）：两小节的一句，中间一条小节线；问句往上悬着，答句回来、句尾拉长
  T22: () => line('M50 30 V88', 2.4, 0.4) + [[8, 70], [18, 60], [28, 50], [38, 38]].map((b) => rect(b[0], b[1], 8, 8, 4, 0.7)).join('') + [[56, 50], [66, 60]].map((b) => rect(b[0], b[1], 8, 8, 4, 0.7)).join('')
    + rect(76, 72, 18, 8, 4, 1, a('pulse', 0)) + line('M8 88 H46', 2.6, 0.5, DASH) + line('M56 88 H94', 2.6) + pencil(),

  // ── 乐理 · 单元 4 和声：叠起来的块，贝斯在下面 ──
  // 两个音的距离：挨着（挤）、隔一个（甜）、隔三个（稳）
  T9: () => [[20, 12], [50, 28], [80, 50]].map(([x, d], i) => line(`M${x} 78 V${78 - d}`, 3, 0.4) + dot(x, 78, 7.5) + dot(x, 78 - d, 7.5, i === 0 ? 0.6 : 1, a('pulse', i))).join('') + line('M8 92 H92', 2, 0.3),
  // 三个音叠起来：隔一个拿一个（左边那一列），叠成三层
  T10: () => [0, 1, 2, 3, 4].map((i) => (i % 2 ? dot(14, 78 - i * 14, 2.4, 0.4) : rect(9, 73 - i * 14, 10, 10, 3))).join('')
    + stack(62, 22, [0.5, 0.75, 1], { w: 52, h: 15, gap: 6, r: 5, more: (i) => a('step', 2 - i, 3) }),
  // 第四层：三层上面再叠一层
  T23: () => box(22, 12, 56, 12, 5, 2.8, 1, `${DASH}${a('pulse', 0)}`) + line('M50 14.5 V21.5 M46.5 18 H53.5', 2.2) + stack(50, 30, [0.5, 0.7, 1], { w: 56, h: 12, gap: 5, r: 5 }) + line('M14 86 H86', 2.4, 0.35),
  // 贝斯站在地基上：一摞和弦的正下方，贝斯踩着最底下那一层的音
  T24: () => stack(50, 12, [0.3, 0.3, 0.7], { w: 44, h: 10, gap: 4 }) + line('M50 54 V66', 2.4, 0.5, ' stroke-dasharray="2 4"') + rect(14, 68, 72, 15, 6, 1, a('pulse', 0)) + line('M8 92 H92', 2, 0.3),
  // 出门和回家：左边那一摞是逗号（悬着），右边那一摞有屋顶，是句号（到家）
  T25: () => stack(27, 34, [0.5, 0.5, 0.5], { w: 30, h: 9, gap: 3.5 }) + dot(26, 82, 4, 0.7) + line('M28.5 83 Q30 89 23 92', 2.6, 0.7)
    + group(line('M54 30 L73 15 L92 30', 4) + stack(73, 34, [1, 1, 1], { w: 30, h: 9, gap: 3.5 }), a('pulse', 0)) + dot(73, 84, 4.8) + line('M36 22 Q46 10 56 20', 2.4, 0.5, ' stroke-dasharray="3 4"'),
  // 四个和弦转圈：四摞摆成一圈，转回开头
  T11: () => [[50, 9], [80, 39], [50, 69], [20, 39]].map(([x, y], k) => stack(x, y, Array(3).fill([1, 0.75, 0.55, 0.4][k]), { w: 22, h: 5.4, gap: 2.6, r: 2.5, more: () => a('step', k, 4) })).join('')
    + group(line('M50 37 A12 12 0 1 1 38.3 46.2', 3, 0.75) + tip(38.3, 45, -100, 6.5, 0.9) + `<circle cx="50" cy="49" r="14" fill="none"/>`, a('spin')),
  // 踩上去，和路过：长音踩在和弦的色带上（大点），带子外面的只是路过（小点）
  T26: () => [26, 48, 70].map((y) => rect(6, y, 88, 10, 5, 0.2)).join('') + line('M12 75 L27 63 L42 53 L57 41 L72 31 L88 53', 2.6, 0.42)
    + [[12, 75], [42, 53], [72, 31], [88, 53]].map((p, i) => dot(p[0], p[1], 6.6, 1, a('pulse', i))).join('') + [[27, 63], [57, 41]].map((p) => dot(p[0], p[1], 3)).join(''),
  // 搭一段（小作品）：三层——上面一句旋律，中间四个和弦，下面贝斯
  T27: () => line('M12 30 L26 20 L40 27 L54 14 L68 24', 2.4, 0.42) + [[12, 30], [26, 20], [40, 27], [54, 14], [68, 24]].map((p) => dot(p[0], p[1], 3.4)).join('')
    + [9, 31, 53, 75].map((x, k) => stack(x + 8, 40 + [3, 0, 5, 1][k], [0.75, 0.75, 0.75], { w: 16, h: 5, gap: 2.4, r: 2.5, more: () => a('step', k, 4) })).join('')
    + [9, 31, 53, 75].map((x, k) => rect(x, [84, 76, 88, 80][k], 16, 7, 3.5)).join('') + pencil(),

  // ── 乐理 · 单元 5 拆歌：一首歌的色块 ──
  // 找到家：一首歌（上面那两条色块），停在键盘的哪个键上最踏实
  T28: () => [[8, 22], [33, 14], [50, 28], [81, 11]].map((b, i) => rect(b[0], 10, b[1], 11, 4, i % 2 ? 0.3 : 0.6)).join('') + [[8, 14], [25, 26], [54, 16], [73, 19]].map((b, i) => rect(b[0], 25, b[1], 11, 4, i % 2 ? 0.6 : 0.3)).join('')
    + [0, 1, 2, 3, 4, 5, 6].map((i) => rect(9 + i * 12, 68, 9.6, 22, 3, i === 2 ? 1 : 0.22, i === 2 ? a('pulse', 0) : '')).join('') + line('M24 62 L37.8 49 L51.6 62', 3.6) + line('M37.8 41 V46', 2.4, 0.5, ' stroke-dasharray="2 3"'),
  // 找到和弦：四格和弦，每一格下面贝斯站的那个音就是地基
  T29: () => [8, 30, 52, 74].map((x, k) => rect(x, 10, 19, 44, 5, k % 2 ? 0.16 : 0.28) + stack(x + 9.5, 18 + [10, 0, 14, 4][k], [0.9, 0.9, 0.9], { w: 12, h: 4, gap: 2.2, r: 2 }) + line(`M${x + 9.5} 58 V${[80, 66, 86, 72][k] - 3}`, 1.6, 0.4, ' stroke-dasharray="2 3"')
    + rect(x, [80, 66, 86, 72][k], 19, 8, 4, 1, a('step', k, 4))).join(''),
  // 找到旋律：同一个小点子出现了两回（上面的两个括号）；前一句悬着，后一句回家
  T30: () => [8, 30, 52, 74].map((x, k) => rect(x, 24, 19, 64, 5, k % 2 ? 0.1 : 0.17)).join('') + line('M10 16 v-5 h34 v5', 2.4, 0.7) + line('M54 16 v-5 h34 v5', 2.4, 0.7)
    + line('M12 62 L22 46 L32 54', 2.6, 0.42) + line('M32 54 L42 40', 2.6, 0.42) + line('M56 62 L66 46 L76 54 L88 76', 2.6, 0.42)
    + [[12, 62], [22, 46], [32, 54], [56, 62], [66, 46], [76, 54]].map((p, i) => dot(p[0], p[1], 4.4, 1, a('step', i < 3 ? i : i + 1, 8))).join('') + ring(42, 38, 5, 2.8, 1, a('step', 3, 8)) + dot(88, 76, 6.4, 1, a('step', 7, 8)),

  // ── 乐理 · 选学：看懂谱子（五线谱） ──
  // 五条线：音高写在线上和缝里，越往上越高；最左边那个记号绕着的线是 G
  T31: () => staff(28, 11) + line('M19 14 V86', 3) + ring(19, 61, 8, 3) + [[40, 72], [54, 66.5], [68, 61], [82, 55.5]].map((p, i) => head(p[0], p[1], { more: a('step', i, 4) })).join(''),
  // 长短的写法：音符长什么样，就占几格（下面那几条越来越短）
  T32: () => head(14, 34, { hollow: true, more: a('step', 0, 4) }) + group(head(38, 34, { hollow: true }) + line('M43.4 32 V10', 2.4), a('step', 1, 4)) + group(head(62, 34) + line('M67.6 32 V10', 2.4), a('step', 2, 4))
    + group(head(84, 34) + line('M89.6 32 V10 q7 5 4 15', 2.4), a('step', 3, 4)) + [84, 42, 21, 10.5].map((w, i) => rect(8, 54 + i * 10, w, 6, 3, 1 - i * 0.2)).join(''),
  // 拍号和小节线：最前面两个数说怎么数，小节线把音切成一样长的段，每一段都要正好装满
  T33: () => {
    const four = (x, y) => line(`M${x + 3} ${y - 8} L${x - 5} ${y + 3} H${x + 6} M${x + 3} ${y - 8} V${y + 8}`, 2.8);
    return staff(28, 10) + four(15, 38) + four(15, 58) + line('M28 28 V68', 2, 0.6) + line('M61 28 V68', 2.6, 1, a('pulse', 0)) + line('M93 28 V68', 4.4)
      + [34, 41.5, 49, 56.5].map((x) => head(x, 53, { s: 0.64 })).join('') + head(69, 43, { hollow: true }) + head(83, 43, { hollow: true })
      + line('M30 80 H59', 2.4, 0.5) + line('M63 80 H91', 2.4, 0.5);
  },
  // 轻重，和再来一遍：上面是反复记号（两头的粗线和两个点），下面是渐强（越张越开）
  T34: () => staff(14, 7, 8, 92) + line('M10 14 V42', 4) + line('M15.5 14 V42', 1.6) + dot(21, 24.5, 2.2) + dot(21, 31.5, 2.2) + line('M90 14 V42', 4) + line('M84.5 14 V42', 1.6) + dot(79, 24.5, 2.2) + dot(79, 31.5, 2.2)
    + [[36, 31.5], [50, 24.5], [64, 35]].map((p) => head(p[0], p[1], { s: 0.76 })).join('') + group(line('M12 73 L88 58 M12 73 L88 88', 3.2), a('pulse', 0)) + dot(8, 73, 2),

  // ── 乐理 · 选学：和弦进阶 ──
  // 换个站法：同一摞和弦，把最底下那块搬到最上面去
  T35: () => stack(26, 40, [0.42, 0.42, 1], { w: 30, h: 10, gap: 4 }) + line('M45 54 H53', 3, 0.7) + tip(56, 54, 0, 6.5, 0.9)
    + rect(59, 26, 30, 10, 4, 1, a('bob')) + stack(74, 40, [0.42, 0.42], { w: 30, h: 10, gap: 4 }) + box(59, 68, 30, 10, 4, 2, 0.5, ' stroke-dasharray="3 3"') + line('M93 73 C101 60 100 44 93 34', 2.4, 0.6) + tip(92.5, 33, -122, 5.5, 0.8),
  // 加点颜色：中间那层挂到隔壁去（虚线是它原来的位置），顶上再添一个
  T36: () => rect(40, 12, 20, 9, 4, 1, a('pulse', 0)) + line('M30 16.5 H36 M33 13.5 V19.5', 2.2, 0.8) + rect(24, 27, 52, 11, 4, 0.5) + box(24, 48, 52, 11, 4, 2, 0.45, ' stroke-dasharray="3 3"')
    + rect(34, 41, 52, 11, 4, 1, a('slide')) + rect(24, 66, 52, 11, 4, 0.8) + line('M14 86 H86', 2.4, 0.35),
  TB: boss,

  // ── 节奏：有图案 / 谱面的画真的那一圈，别的按这一关讲什么来画 ──
  // 跟稳：四拍一组，第一下重；下面是偏早偏晚的那根表，小点稍微晚了一点
  R1: () => [17, 39, 61, 83].map((x, i) => dot(x, 28, i ? 7 : 9.5, i ? 0.5 : 1, a('step', i, 4))).join('') + box(8, 60, 84, 20, 10, 2.4, 0.5) + line('M50 54 V86', 3) + dot(59, 70, 5.2, 1, a('pulse', 0)),
  // 数出来：一拍整的、切两半、切四块
  R2: () => rect(8, 12, 84, 20, 5) + [0, 1].map((i) => rect(8 + i * 43, 40, 41, 20, 5, 0.7)).join('') + [0, 1, 2, 3].map((i) => rect(8 + i * 21.5, 68, 19.5, 20, 5, i ? 0.42 : 1, a('step', i, 4))).join(''),
  // 听一段，选图案：这一关热身的那一圈（16 格，四个一行）
  R3: (level) => {
    const pat = (level?.play?.pattern || 'x---x---x-x-----').replace(/[^x-]/gi, '').padEnd(16, '-').slice(0, 16);
    return [...pat].map((c, i) => rect(7 + (i % 4) * 22.5, 7 + Math.floor(i / 4) * 22.5, 18.5, 18.5, 4.5, c.toLowerCase() === 'x' ? 1 : 0.16, a('step', i, 16))).join('');
  },
  // 只打缝里：下面一行是底鼓（在拍上），上面一行的镲全落在两下底鼓的正中间
  R4: () => cells('-x-x-x-x', { y: 20, h: 24 }) + cells('x-x-x-x-', { y: 56, h: 24, on: 0.5 }),
  // 故意错开：这一关挑战的谱面——三格、三格、两格（下面的短线是分组）
  R5: (level) => {
    const pat = (level?.quiz?.chart?.lanes?.KICK || 'x--x--x-x--x--x-').padEnd(16, '-');
    const under = (y) => line(`M7 ${y} H37.2`, 2.6, 0.55) + line(`M39.8 ${y} H70`, 2.6, 0.55) + line(`M72.6 ${y} H93`, 2.6, 0.55);
    return cells(pat.slice(0, 8), { y: 14, h: 22, steps: 16 }) + under(42) + cells(pat.slice(8, 16), { y: 54, h: 22, from: 8, steps: 16 }) + under(82);
  },
  // 晃起来：上面是直的（两下一样长），下面是晃的（一长一短）
  R6: () => [8, 30, 52, 74].map((x) => rect(x, 18, 18, 16, 5, 0.42)).join('') + line('M50 42 V50', 2.6, 0.5) + tip(50, 53, 90, 5.5, 0.6)
    + [8, 52].map((x, k) => rect(x, 62, 27, 18, 5, 0.55) + rect(x + 30, 62, 10, 18, 5, 1, a('pulse', k))).join(''),
  // 两只手：上面那只手不动，下面那只手一格一格往后挪
  R7: () => [8, 30, 52, 74].map((x) => rect(x, 16, 18, 20, 5)).join('') + box(31.2, 59.2, 15.6, 17.6, 5, 2.2, 0.5, ' stroke-dasharray="3 3"') + rect(52, 58, 18, 20, 5, 1, a('slide'))
    + box(75.2, 59.2, 15.6, 17.6, 5, 2.2, 0.28, ' stroke-dasharray="3 3"') + line('M36 90 H60', 2.6, 0.6) + tip(64, 90, 0, 6, 0.8) + line('M8 46 H92', 1.6, 0.25),
  // 听律动，猜风格：一层一层拆——底鼓、第 2、4 拍那一下、镲
  R8: () => ['x---x---x---x---', '----x-------x---', 'x-x-x-x-x-x-x-x-'].map((p, row) => group([...p].map((c, i) => rect(8 + i * 5.3, 16 + row * 25, 4.2, 18, 1.6, c === 'x' ? 1 : 0.13)).join(''), a('pulse', 2 - row))).reverse().join(''),
  // 重音挪一挪：8 下镲，重的那两下换了地方
  R9: () => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ([2, 5].includes(i) ? rect(9 + i * 10.6, 30, 7.6, 58, 3.5, 1, a('pulse', i === 2 ? 0 : 1)) : rect(9 + i * 10.6, 66, 7.6, 22, 3.5, 0.38))).join('')
    + line('M13 22 Q23.5 6 33 20', 2.4, 0.6, ' stroke-dasharray="3 4"') + tip(34, 22, 58, 5.5, 0.8),
  // 不出声的那一拍：四拍里有一拍是空的；手停住，心里照样数（下面的四个点一个不少）
  R10: () => [9, 31, 53, 75].map((x, i) => (i === 2 ? box(x + 1.3, 25.3, 14.4, 30.4, 5, 2.6, 0.7, `${DASH}${a('step', i, 4)}`) : rect(x, 24, 17, 33, 5, 1, a('step', i, 4)))).join('')
    + [17.5, 39.5, 61.5, 83.5].map((x) => dot(x, 76, 3.4)).join('') + line('M8 88 H92', 2, 0.3),
  // 腾出一只手：一只手守着循环（左边那一圈），另一只手去拧旋钮
  R11: () => group(line('M32 36 A22 22 0 1 0 54 58', 3, 0.7) + tip(54, 56.5, -88, 6.5, 0.9) + '<circle cx="32" cy="58" r="22" fill="none"/>', a('spin'))
    + rect(23, 49, 8, 8, 2.5) + rect(33, 49, 8, 8, 2.5, 0.3) + rect(23, 59, 8, 8, 2.5, 0.3) + rect(33, 59, 8, 8, 2.5)
    + ring(74, 30, 16, 4) + group(line('M74 30 L74 18', 4) + '<circle cx="74" cy="30" r="16" fill="none"/>', a('wig')) + [0, 1, 2].map((i) => dot(64 + i * 10, 58, 2, 0.5)).join(''),
  // 不断拍：谱面一条一条换，每条只比上一条多动一格（描圈的是新亮的）
  R12: () => ['x---x---', 'x---x-x-', 'x-x-x-x-'].map((p, row) => group([...p].map((c, i) => rect(20 + i * 9.6, 12 + row * 27, 7.6, 18, 3, c === 'x' ? 1 : 0.16)).join('')
    + (row ? box(20 + [0, 6, 2][row] * 9.6 - 1.6, 12 + row * 27 - 1.6, 10.8, 21.2, 4.5, 1.6, 0.9) : ''), ` opacity="${[1, 0.62, 0.36][row]}"${a('pulse', row)}`)).join('')
    + line('M9 14 V78', 2.6, 0.6) + tip(9, 83, 90, 6, 0.8),
  // 三格一圈：每 3 格响一下，转过小节线不重新起头——三行（三小节）才转回原位
  R13: (level) => {
    const pat = (level?.quiz?.chart?.lanes?.HAT1 || '').padEnd(48, '-');
    const real = /x/.test(pat);
    let out = '';
    for (let g = 0; g < 48; g++) {
      const on = real ? pat[g] === 'x' : g % 3 === 0;
      out += dot(9.5 + (g % 16) * 5.4, 24 + Math.floor(g / 16) * 26, on ? 3.3 : 1.3, on ? 1 : 0.28, on ? a('step', g % 16, 16) : '');
    }
    return out + [0, 1, 2].map((row) => line(`M6 ${37 + row * 26} H94`, 1.4, 0.2)).join('');
  },
  // 三对二：同样长的一圈（12 格，像钟面），一只手匀匀地 3 下（三角），另一只手 2 下（竖着的那条线）
  R14: () => {
    const at = (k, r) => [50 + r * Math.sin((k * Math.PI) / 6), 50 - r * Math.cos((k * Math.PI) / 6)];
    let out = '';
    for (let k = 0; k < 12; k++) out += dot(...at(k, 40), 1.8, 0.4);
    const tri = [0, 4, 8].map((k) => at(k, 40));
    out += line(`M${tri.map((p) => `${n(p[0])} ${n(p[1])}`).join(' L')} Z`, 2.6, 0.5) + line('M50 10 V90', 2.6, 0.5);
    out += tri.map((p) => dot(p[0], p[1], 6.2)).join('') + rect(44.5, 84.5, 11, 11, 3) + ring(50, 10, 10, 2.2, 0.6);
    return out + group(line('M50 50 V20', 3.4) + dot(50, 50, 4), a('spinc'));
  },
  RB: boss,

  // ── 效果：照这个效果把声音变成什么样来画 ──
  // 干的和湿的：左边是原声，右边是同一个声音加了效果（带着一圈圈尾巴）
  F1: () => dot(26, 50, 13) + line('M50 14 V86', 2, 0.35, ' stroke-dasharray="3 5"') + dot(73, 50, 13) + ring(73, 50, 18.5, 3, 0.55, a('ring', 0)) + ring(73, 50, 24.5, 2.6, 0.26, a('ring', 1)),
  // 把声音捂住：低通——高的那一头被削掉
  F2: () => shape('M6 36 H46 C62 36 68 52 76 88 H6 Z', 0.16) + line('M6 36 H46 C62 36 68 52 76 88', 5) + dot(50, 36, 6, 1, a('slide')) + line('M82 40 V88 M90 52 V88', 2.4, 0.16),
  // 把低音抽走：高通——低的那一头没了；左边是机器上那条 [HIGH PASS] 触摸条
  F3: () => box(8, 12, 15, 76, 7.5, 2.4, 0.6) + rect(11, 50, 9, 35, 4.5, 0.9) + dot(15.5, 50, 5.4, 1, a('bob')) + shape('M38 88 C46 52 52 36 68 36 H94 V88 Z', 0.16) + line('M38 88 C46 52 52 36 68 36 H94', 5),
  // 那一声“喵”：滤波器截断的地方顶出一个尖尖的峰
  F4: () => shape('M6 56 H38 C49 56 51 16 57 16 C63 16 65 60 78 88 H6 Z', 0.16) + line('M6 56 H38 C49 56 51 16 57 16 C63 16 65 60 78 88', 5) + ring(57, 17, 8.5, 2.4, 0.5, a('ring', 0)),
  // 房间有多大：声音在小、中、大三个房间里一圈一圈传出去
  F5: () => dot(50, 52, 5.5) + box(36, 38, 28, 28, 7, 3.2, 1, a('ring', 0)) + box(23, 25, 54, 54, 11, 3, 0.55, a('ring', 1)) + box(10, 12, 80, 80, 15, 2.8, 0.28, a('ring', 2)),
  // 踩在拍子上的回声：一下比一下小、一下比一下淡，都踩在拍子的刻度上
  F6: () => [[14, 9.5, 1], [34, 7.6, 0.7], [52, 6, 0.48], [68, 4.6, 0.32], [83, 3.4, 0.2]].map(([x, r, o], i) => dot(x, 42, r, o, a('step', i, 6)) + line(`M${x} 70 V80`, 2.4, 0.5)).join('') + line('M6 80 H94', 2.4, 0.5),
  // 弄脏它：圆圆的波（虚线）被削平了头
  F7: () => line('M6 50 C12 4 22 4 28 50 S44 96 50 50 S66 4 72 50 S88 96 94 50', 2.4, 0.4, ` stroke-dasharray="4 5"${a('flow')}`) + line('M6 50 L11 28 H23 L28 50 L33 72 H45 L50 50 L55 28 H67 L72 50 L77 72 H89 L94 50', 5),
  // 让底鼓先走：底鼓一响（上面的竖条），别的声音就被按下去、再浮上来
  F8: () => [10, 32, 54, 76].map((x, i) => rect(x, 12, 7, 22, 3.5, 1, a('step', i, 4))).join('') + line('M10 84 Q13 50 30 48 L32 84 Q35 50 52 48 L54 84 Q57 50 74 48 L76 84 Q79 50 94 48', 4.2),
  // 切碎了重复：上面是原来的一整段，下面被切成越来越碎的小块
  F9: () => rect(8, 18, 84, 16, 5, 0.32) + line('M8 42 V52 M36 42 V52 M66 42 V52', 1.8, 0.4, ' stroke-dasharray="2 3"') + rect(8, 58, 25, 22, 5) + [37, 51.5].map((x, i) => rect(x, 58, 12, 22, 4, 1, a('step', i, 6))).join('')
    + [66, 73, 80, 87].map((x, i) => rect(x, 58, 5, 22, 2.5, 1, a('step', 2 + i, 6))).join(''),
  // 晃动的声音：几个一样的声音微微错开，一起晃
  F10: () => group(line('M4 30 q11.5 -15 23 0 t23 0 t23 0 t23 0', 4.4), a('slide', 0)) + group(line('M4 52 q11.5 15 23 0 t23 0 t23 0 t23 0', 3.6, 0.6), a('slide', 1)) + group(line('M-2 73 q7 -9 14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0', 3, 0.34), a('slide', 2)),
  // 做一次铺垫：两条触摸条越推越高，然后一把放开
  F11: () => box(8, 12, 14, 76, 7, 2.4, 0.6) + rect(11, 50, 8, 35, 4, 0.9, a('bob', 0)) + box(29, 12, 14, 76, 7, 2.4, 0.6) + rect(32, 30, 8, 55, 4, 0.9, a('bob', 1))
    + group(dot(72, 46, 7) + [0, 1, 2, 3, 4, 5, 6, 7].map((k) => { const t = (k * Math.PI) / 4; const r1 = 13; const r2 = k % 2 ? 20 : 26; return line(`M${n(72 + r1 * Math.cos(t))} ${n(46 + r1 * Math.sin(t))} L${n(72 + r2 * Math.cos(t))} ${n(46 + r2 * Math.sin(t))}`, 3.4); }).join(''), a('pulse', 0)),
  FB: boss,

  // ── DJ ──
  // 乐句和小节：8 小节是一句，数到 8 就换一段
  D1: () => line('M8 22 v-7 h84.5 v7', 2.4, 0.5) + [0, 1, 2, 3, 4, 5, 6, 7].map((i) => rect(8 + i * 10.85, 30, 8.6, 38, 3.5, i === 0 ? 1 : i === 4 ? 0.62 : 0.36, a('step', i, 8))).join('') + line('M8 80 H92', 2.4, 0.4) + shape('M5 86 L8 80 L11 86 Z') + shape('M89 86 L92 80 L95 86 Z', 0.5),
  // 预判 Drop：铺垫越推越高、越来越密，然后砸下来一大块
  D2: () => [0, 1, 2, 3, 4, 5].map((i) => rect(8 + i * 8.6, 72 - i * 9, 5.6, 12 + i * 9, 2.8, 0.34 + i * 0.12, a('step', i, 8))).join('') + line('M62 12 V88', 2, 0.4, ' stroke-dasharray="3 5"') + rect(68, 30, 26, 54, 6, 1, a('step', 6, 8)) + shape('M74 12 H88 L81 23 Z'),
  // 过渡：一个推子推上去，一个拉下来；底下那根横推子从一边换到另一边
  D3: () => line('M26 12 V60', 4, 0.3) + line('M74 12 V60', 4, 0.3) + rect(15, 17, 22, 11, 4, 1, a('bob', 0)) + rect(63, 44, 22, 11, 4, 1, a('bob', 1)) + line('M14 80 H86', 4, 0.3) + rect(33, 73, 13, 14, 4, 1, a('slide')),
  // 能量曲线：一首歌的高高低低，底下是它的一段一段
  D4: () => shape('M6 76 C16 76 20 68 28 64 S40 34 48 30 S62 30 66 58 S78 28 94 22 V80 H6 Z', 0.16) + line('M6 76 C16 76 20 68 28 64 S40 34 48 30 S62 30 66 58 S78 28 94 22', 4.4)
    + [[6, 20], [28, 18], [48, 16], [66, 10], [78, 16]].map((b, i) => rect(b[0], 86, b[1], 6, 3, i % 2 ? 0.45 : 0.85, a('step', i, 5))).join(''),
  // 对拍：两张唱盘，下面两排底鼓还差一点没叠上
  D5: () => [28, 72].map((cx) => group(ring(cx, 36, 20, 4) + ring(cx, 36, 11, 1.5, 0.5) + dot(cx, 36, 3.6) + line(`M${cx} 17 V24`, 3), a('spin'))).join('')
    + [14, 36, 58, 80].map((x) => dot(x, 72, 3.6)).join('') + group([14, 36, 58, 80].map((x) => dot(x + 5, 86, 3.6, 0.5)).join(''), a('slide')),
  // 调性：两首歌各有一把梯子，横档对不上的地方就“打架”
  D6: () => {
    const ladder = (x, rungs, o) => line(`M${x} 10 V90 M${x + 24} 10 V90`, 3, o) + rungs.map((y) => line(`M${x} ${y} H${x + 24}`, 3, o)).join('');
    return ladder(10, [82, 70, 58, 52, 40, 28, 16], 1) + ladder(66, [86, 74, 62, 50, 44, 32, 20], 0.55) + group(line('M53 30 L45 46 H55 L47 62', 3.4), a('pulse', 0));
  },
  DB: boss,
};

/** 这一关有没有自己的封面（总览页标“还没画”用） */
export const hasCover = (level) => !!DRAW[level?.id];

/**
 * 一关的封面。level = content/classroom.js 里的一关；anim = 大封面才给 true（会动的部件带上 cva-* 的类名）。
 * 返回一段 <svg class="cl-cover" viewBox="0 0 100 100">…</svg>。
 */
export function coverSvg(level, { anim = false } = {}) {
  live = !!anim;
  let inner;
  try {
    inner = (DRAW[level?.id] || (level?.kind === 'boss' ? boss : ICON[level?.line] || ICON.theory))(level);
  } finally {
    live = false;
  }
  return `<svg class="cl-cover${anim ? ' anim' : ''}" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${inner}</svg>`;
}

/** 一条线的图标（切线的那一行用）：theory / rhythm / fx / dj */
export function lineIcon(lineId) {
  return `<svg class="cl-cover" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${(ICON[lineId] || ICON.theory)()}</svg>`;
}
