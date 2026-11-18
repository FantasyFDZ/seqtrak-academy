// 乐理线重做 · 第三期，选学的两个单元（看懂谱子、和弦进阶）里的“题”。同一道题，小步里的“你来”（theory-tasks3.js）和挑战（theory-toys3.js）都用，
// 所以单独放一个文件：QUIZ[题型](bench, q, on) → { row?（一排按钮）, replay?（再听）, onKey?(键), onStaff?(点了谱子的哪儿, 值), solve() }
//   q   这道题（各题型要什么见各自上面的说明）
//   on  { good(话), bad(话, 键?), say(话), lock(fn) }：做对了、做错了（要说差在哪）、说一句、放声音的时候锁住
// 看懂谱子（玩法是谱子和格子互相翻译；主路上不出现五线谱，只有选学这 4 关有）：
//   staffkey   谱 → 键：谱上的音符，在键盘上点出来
//   keystaff   键 → 谱：键盘上圈一个键，把谱上那个音符挪到对的线 / 缝上
//   onsets     谱 → 格子：一小节谱子，在两排 16 个方键上点亮每个音开头的那一格（方键和机器上一样：上排 1–8，下排 9–16；
//              谱子下面那条对齐的小格子跟着亮，只是看的，不用点：它一格才三十来像素，手指点不准）
//   spell      格子 → 谱：格子里亮着一小节，一个一个挑音符的牌子，把它拼成谱子
//   barlines   一串没有小节线的音符，照拍号把小节线放进去
//   fillbar    一小节还差一块，挑一个正好补满的音符
//   dynamics   谱上写着轻重的记号，把格子里每个音的轻重摆成一样
//   roadmap    带反复记号的谱：照实际走的先后，一小节一小节点
// 和弦进阶（都在键盘上）：
//   invert     换个站法：把最底下的音搬到最上面（或者反过来），让指定的那一层站到最底下
//   nearest    上一摞站在这儿，下一摞挑离它最近的站法
//   suspend    把中间那层挂到上面 / 下面一级，或者落回去
//   addtone    三层不动，顶上再加一个
//   bottomear  只听：啾啾这一摞，最底下是哪一层
//   colorear   只听：啾啾这一摞是原样、挂着的，还是加了音的，把自己的摆成一样
import { h } from './util.js';
import { keys16 } from './classroom-kit.js';
import { nameOf } from './theory-bench.js';
import { posOf, midiAt, letterAt, posWord, noteIcon, LEN_WORD, REST_WORD } from './theory-staff.js';

/** 谱上的音：[[第几格起, 占几格, 键号?, { 别的 }]]，或者已经是 { s, l, m } 的，都换成对象（没写键号 = 休止符） */
export const staffNotes = (list = []) => list.map((n) => (Array.isArray(n) ? { s: n[0], l: n[1], ...(n[2] !== undefined && n[2] !== null ? { m: n[2] } : {}), ...(n[3] || {}) } : { ...n }));
/** 只管长短的谱：[[起, 长]] 是音符（都摆在中间那条线上），[[起, 长, 'r']] 是休止符，[[起, 长, 键号]] 指定音高 */
export const rhythm = (list = [], m = 71) => list.map(([s, l, r]) => (r === 'r' ? { s, l } : { s, l, m: typeof r === 'number' ? r : m }));
const sounding = (n) => n.m !== undefined && n.m !== null;
const btn = (label, fn, cls = '') => h('button', { class: `btn ${cls}`, type: 'button', 'data-sfx': 'none', onclick: fn }, label);
const up = (list) => [...list].sort((a, b) => a - b);
const VEL = [0, 0.36, 0.68, 1];
const VEL_WORD = { 1: '轻', 2: '中', 3: '重' };
const DYN = { p: 1, mf: 2, f: 3 };
const LAYER_WORD = ['地基', '中间那层', '上面那层'];

/** 一排“挑一种音符”的牌子：cards = [[占几格, 'r'?]]；plain = 牌子上不写占几格 */
function cardRow(cards, pick, plain = false) {
  return h('div', { class: 'tn-cards' }, cards.map(([l, r]) => {
    const b = h('button', { class: 'btn tn-card', type: 'button', 'data-sfx': 'none', 'data-len': l, 'data-rest': r ? '1' : '', 'aria-label': (r ? REST_WORD : LEN_WORD)[l] }, noteIcon(l, !!r), !plain && h('small', {}, `${l} 格`));
    b.addEventListener('click', () => pick(l, !!r));
    return b;
  }));
}

// ───────────── 看懂谱子 ─────────────

/** q = { notes: [键号…]（一个一个读）, names（线和缝旁边写着音名）, flats（黑键写成降号） } */
function staffkey(bench, q, on) {
  const S = bench.staff;
  const list = q.notes;
  let i = 0;
  bench.set({ top: 'staff', trail: true, piano: true, ladder: null, names: false, keys: false });
  bench.autoTrail = false;
  const draw = () => S.show({
    steps: Math.max(4, list.length * 4), time: null, end: false, lines: [], names: !!q.names, flats: !!q.flats,
    notes: list.map((m, k) => ({ s: k * 4 + (list.length === 1 ? 1 : 0), l: 4, m, cls: k < i ? 'good' : k === i ? 'target' : '' })),
  });
  draw();
  const self = {
    onKey(m) {
      if (i >= list.length) return;
      const want = list[i];
      if (m === want) {
        i++;
        draw();
        bench.mark(m, 'good');
        if (i >= list.length) return on.good(`${list.map(nameOf).join('、')}：读对了。`);
        return on.say(`第 ${i} 个对了。下一个：蓝色的那个。`);
      }
      if ((m - want) % 12 === 0) return on.bad(`名字对了（${nameOf(m)}），楼层不对：谱上那个比你点的${want > m ? '高' : '低'}一层。`, m);
      on.bad(`你点的是 **${nameOf(m)}**。谱上那个音在${posWord(posOf(want, q.flats))}：比你点的${want > m ? '高' : '低'}。从卷卷绕着的那条线（G）数过去：往上一个位置，就往右一个白键。`, m);
    },
    solve() {
      for (const m of list.slice(i)) self.onKey(m);
    },
  };
  return self;
}

/** q = { m: 键号（白键）, names } */
function keystaff(bench, q, on) {
  const S = bench.staff;
  const want = posOf(q.m);
  let pos = q.start ?? (want >= 6 ? 2 : 10);
  let over = false;
  bench.set({ top: 'staff', trail: true, piano: true, ladder: null, names: false, keys: false });
  bench.silent = true;
  bench.autoTrail = false;
  bench.unmark('target');
  bench.mark(q.m, 'target');
  const draw = (cls) => S.show({ steps: 4, time: null, end: false, lines: [], names: !!q.names, notes: [], spot: { s: 1, pos, cls }, pick: over ? null : 'spot' });
  const move = (p) => {
    if (over) return;
    pos = Math.max(0, Math.min(14, p));
    draw();
    bench.tone(midiAt(pos), { len: 0.3 });
  };
  const check = () => {
    if (over) return;
    if (pos === want) {
      over = true;
      draw('good');
      bench.unmark('target');
      bench.mark(q.m, 'good');
      return on.good(`**${nameOf(q.m)}** 就写在${posWord(pos)}。`);
    }
    const n = Math.abs(pos - want);
    on.bad(`你放的位置是 **${letterAt(pos)}**：比圈着的键${pos > want ? '高' : '低'}了 ${n} 级。往${pos > want ? '下' : '上'}挪 ${n} 下。`);
  };
  draw();
  bench.tone(q.m);
  return {
    row: [btn('↑ 高一级', () => move(pos + 1), 'tn-step'), btn('↓ 低一级', () => move(pos - 1), 'tn-step'), btn('放这儿', check, 'primary')],
    replay: () => bench.tone(q.m),
    onStaff(kind, v) {
      if (kind === 'spot') move(v);
    },
    onKey(m) {
      bench.tone(m);
      on.say('这回不点键盘。把谱上那个蓝色的音符挪到对的位置：点谱面，或者用「高一级」「低一级」，挪好了点「放这儿」。');
    },
    solve() {
      pos = want;
      draw();
      check();
    },
  };
}

/** q = { notes: 只管长短的谱（见 rhythm()）, steps = 16, bar, time, m } */
function onsets(bench, q, on) {
  const S = bench.staff;
  const notes = rhythm(q.notes, q.m);
  const steps = q.steps || 16;
  const tone = q.m || 71;
  let lit = [];
  bench.set({ top: 'staff', trail: true, piano: false, keys: false });
  const base = { steps, bar: q.bar || 16, time: q.time || [4, 4], notes, strip: true };
  const draw = (cellCls = {}) => S.show({ ...base, showCells: false, lit, cellCls });
  const want = notes.filter(sounding).map((n) => n.s);
  const pattern = (list) => Array.from({ length: 16 }, (_, k) => (list.includes(k) ? 'x' : '-')).join('');
  const pad = keys16({
    editable: true,
    onChange(p, i) {
      lit = [...p].map((ch, k) => (ch === 'x' ? k : -1)).filter((k) => k >= 0);
      pad.unmark();
      draw();
      if (p[i] === 'x') bench.tone(tone, { len: 0.12 });
    },
  });
  pad.el.classList.add('tn-pad');
  const check = () => {
    const miss = want.filter((x) => !lit.includes(x));
    const extra = up(lit.filter((x) => !want.includes(x)));
    if (!miss.length && !extra.length) {
      S.show(base);
      pad.unmark();
      return on.good(`${want.length} 个音，开头在第 ${want.map((x) => x + 1).join('、')} 格。在机器上按亮的，就是每个音**开头**的那一格；它占几格，是另外拉长的。`);
    }
    const cls = {};
    miss.forEach((x) => (cls[x] = 'miss'));
    extra.forEach((x) => (cls[x] = 'extra'));
    draw(cls);
    pad.mark(pattern(want));
    if (extra.length && (!miss.length || extra[0] < miss[0])) {
      const k = extra[0];
      const owner = notes.find((n) => n.s <= k && k < n.s + n.l);
      return on.bad(!owner ? `第 ${k + 1} 格上没有音符。` : sounding(owner) ? `第 ${k + 1} 格不用亮：它前面那个${LEN_WORD[owner.l] || '长音'}占 ${owner.l} 格，这一格还是它的。只亮每个音**开头**的那一格。` : `第 ${k + 1} 格是空的：谱上那儿是休止符，没有声音。`);
    }
    const k = miss[0];
    const idx = notes.filter(sounding).findIndex((n) => n.s === k);
    on.bad(k === 0 ? '第 1 个音符就在最前面：**第 1 格**，还没亮。' : `第 ${idx + 1} 个音符从第 **${k + 1}** 格开始，还没亮。数一数它前面的东西一共占了几格：${k} 格。`);
  };
  draw();
  return {
    row: [pad.el, btn('▶ 听我亮的', () => up(lit).forEach((k) => bench.tone(tone, { at: (k * 60) / 92 / 4, len: 0.12 }))), btn('对一下', check, 'primary')],
    replay: () => on.lock(() => bench.playStaff(notes, { bpm: 92, steps })),
    solve() {
      lit = [...want];
      pad.set(pattern(want));
      draw();
      check();
    },
  };
}

/** q = { notes: 一整小节，音和休止都写明（见 rhythm()）, cards: [[占几格, 'r'?]]（能挑的牌子）, plain（牌子上不写占几格）, steps, bar, time } */
function spell(bench, q, on) {
  const S = bench.staff;
  const target = rhythm(q.notes, q.m);
  const steps = q.steps || 16;
  const cards = q.cards || [[8], [4], [2], [1], [6], [3], [4, 'r'], [2, 'r']];
  const cells = target.filter(sounding).map((n) => ({ s: n.s, l: n.l }));
  let i = 0;
  bench.set({ top: 'staff', trail: true, piano: false, keys: false });
  const draw = () => {
    const cellCls = {};
    if (i < target.length) for (let k = 0; k < target[i].l; k++) cellCls[target[i].s + k] = 'cur';
    S.show({ steps, bar: q.bar || 16, time: q.time || [4, 4], notes: target.slice(0, i), strip: true, cells, cellCls });
  };
  const pick = (l, rest) => {
    if (i >= target.length) return;
    const seg = target[i];
    const isRest = !sounding(seg);
    if (isRest !== rest) return on.bad(isRest ? `蓝框里的 ${seg.l} 格是空的：没有声音。这里要挑**休止符**。` : '蓝框里的格子亮着：这里有声音。要挑**音符**，不是休止符。');
    if (seg.l !== l) return on.bad(`蓝框里${isRest ? '空了' : '这个音占'} **${seg.l} 格**。你挑的${(rest ? REST_WORD : LEN_WORD)[l]}是 ${l} 格。${seg.l === 6 || seg.l === 3 ? `${seg.l} 格是${seg.l === 6 ? '四分' : '八分'}音符再长一半：找带**点**的那个。` : ''}`);
    i++;
    draw();
    if (!isRest) bench.tone(seg.m, { len: 0.25 });
    if (i >= target.length) return on.good(`拼出来了：${target.map((n) => (sounding(n) ? LEN_WORD : REST_WORD)[n.l]).join('、')}。加起来正好 ${steps} 格。`);
    on.say(`第 ${i} 个对了。下一个：蓝框里的那 ${target[i].l} 格。`);
  };
  draw();
  return {
    row: [cardRow(cards, pick, !!q.plain)],
    replay: () => on.lock(() => bench.playStaff(target, { bpm: 92, steps })),
    solve() {
      while (i < target.length) pick(target[i].l, !sounding(target[i]));
    },
  };
}

/** q = { notes, steps（一共几格）, bar（一小节几格）, time: [上, 下], strip（下面摆不摆格子，帮着数） } */
function barlines(bench, q, on) {
  const S = bench.staff;
  const notes = rhythm(q.notes, q.m);
  const bar = q.bar || 16;
  const time = q.time || [4, 4];
  const steps = q.steps;
  let cuts = [];
  bench.set({ top: 'staff', trail: true, piano: false, keys: false });
  const base = { steps, bar, time, notes, strip: !!q.strip };
  const draw = () => S.show({ ...base, lines: [], pick: 'line', cuts });
  const want = [];
  for (let x = bar; x < steps; x += bar) want.push(x);
  const check = () => {
    const mine = up(cuts);
    if (mine.length === want.length && mine.every((x, k) => x === want[k])) {
      S.show(base);
      return on.good(`每一小节正好 ${time[0]} 拍（${bar} 格）。小节线就是这么来的：把一长串音切成一样长的段。`);
    }
    const edges = [0, ...mine, steps];
    for (let k = 0; k < edges.length - 1; k++) {
      const len = edges[k + 1] - edges[k];
      if (len !== bar) return on.bad(`第 ${k + 1} 小节现在占 **${len} 格**${len % 4 === 0 ? `（${len / 4} 拍）` : ''}。拍号写的是一小节 ${time[0]} 拍，也就是 ${bar} 格：${len > bar ? '太长了，里面还得切一刀' : '太短了，线要往右挪'}。`);
    }
  };
  draw();
  return {
    row: [btn('对一下', check, 'primary')],
    replay: () => on.lock(() => bench.playStaff(notes, { bpm: 104, steps })),
    onStaff(kind, at) {
      if (kind !== 'line') return;
      cuts = cuts.includes(at) ? cuts.filter((x) => x !== at) : [...cuts, at];
      draw();
    },
    solve() {
      cuts = [...want];
      draw();
      check();
    },
  };
}

/** q = { notes（这一小节已经有的，后面空着）, bar, time, cards: [占几格…], plain } */
function fillbar(bench, q, on) {
  const S = bench.staff;
  const notes = rhythm(q.notes, q.m);
  const bar = q.bar || 16;
  const time = q.time || [4, 4];
  const used = Math.max(...notes.map((n) => n.s + n.l));
  const gap = bar - used;
  const tone = q.m || 71;
  let over = false;
  bench.set({ top: 'staff', trail: true, piano: false, keys: false });
  const draw = (extra) => {
    const cellCls = {};
    if (!extra) for (let k = used; k < bar; k++) cellCls[k] = 'cur';
    S.show({ steps: bar, bar, time, notes: extra ? [...notes, extra] : notes, strip: true, cellCls });
  };
  const pick = (l) => {
    if (over) return;
    if (l !== gap) return on.bad(`这一小节还空着 **${gap} 格**。${LEN_WORD[l]}占 ${l} 格：${l > gap ? '放不下，会挤到下一小节去' : `放进去还空 ${gap - l} 格`}。`);
    over = true;
    draw({ s: used, l, m: tone, cls: 'good' });
    bench.tone(tone, { len: 0.3 });
    on.good(`补上一个${LEN_WORD[l]}（${l} 格）：正好 ${time[0]} 拍，一格不多、一格不少。`);
  };
  draw();
  return {
    row: [cardRow((q.cards || [8, 6, 4, 3, 2, 1]).map((l) => [l]), (l) => pick(l), !!q.plain)],
    replay: () => on.lock(() => bench.playStaff(notes, { bpm: 92, steps: bar })),
    solve: () => pick(gap),
  };
}

/**
 * q = { notes: [[起, 长, 键号]], marks: { 第几个音（0 起）: 'p' / 'mf' / 'f' }（管到下一个记号为止；一开始没写按 mf）,
 *       hairpin: [从第几个音, 到第几个音]（渐强：这几个音一个比一个重，轻 → 中 → 重） }
 */
function dynamics(bench, q, on) {
  const S = bench.staff;
  const base = staffNotes(q.notes);
  const steps = q.steps || 16;
  const want = [];
  const ruler = []; // 管着每个音的是哪个记号
  let cur = 'mf';
  base.forEach((n, i) => {
    if (q.marks?.[i]) cur = q.marks[i];
    ruler[i] = cur;
    want[i] = DYN[cur];
  });
  const inPin = (i) => !!q.hairpin && i >= q.hairpin[0] && i <= q.hairpin[1];
  if (q.hairpin) for (let i = q.hairpin[0]; i <= q.hairpin[1]; i++) want[i] = Math.min(3, 1 + i - q.hairpin[0]);
  let mine = base.map(() => 2);
  bench.set({ top: 'staff', trail: true, piano: false, keys: false });
  const withVel = (v) => base.map((n, i) => ({ ...n, dyn: q.marks?.[i], vel: v[i] }));
  const draw = () => S.show({ steps, time: q.time || [4, 4], notes: withVel(mine), hairpins: q.hairpin ? [[base[q.hairpin[0]].s, base[q.hairpin[1]].s, '<']] : [], strip: true, pick: 'note' });
  const check = async () => {
    const k = mine.findIndex((v, i) => v !== want[i]);
    if (k >= 0) return on.bad(inPin(k) ? `第 ${k + 1} 个音在那个张开的口子（渐强）里：这几个音要一个比一个重。它该是**${VEL_WORD[want[k]]}**，你摆的是${VEL_WORD[mine[k]]}。` : `第 ${k + 1} 个音：管着它的记号是 **${ruler[k]}**（${VEL_WORD[want[k]]}），你摆的是${VEL_WORD[mine[k]]}。点它，换一换。`);
    await on.lock(() => bench.playStaff(withVel(mine), { bpm: 92, steps }));
    on.good('轻重和谱上写的一样了。在机器上，这就是每一格的力度。');
  };
  draw();
  return {
    row: [btn('▶ 听我摆的', () => on.lock(() => bench.playStaff(withVel(mine), { bpm: 92, steps }))), btn('对一下', check, 'primary')],
    replay: () => on.lock(() => bench.playStaff(withVel(want), { bpm: 92, steps })),
    onStaff(kind, i) {
      if (kind !== 'note' || !sounding(base[i])) return;
      mine[i] = (mine[i] % 3) + 1;
      draw();
      bench.tone(base[i].m, { len: 0.3, vel: VEL[mine[i]] });
      on.say(`第 ${i + 1} 个音：**${VEL_WORD[mine[i]]}**。再点一下换下一种。`);
    },
    solve() {
      mine = [...want];
      draw();
      return check();
    },
  };
}

/** 带反复记号的谱实际走哪几小节。repeats = [[从第几小节, 到第几小节]]（0 起，含），voltas = [[第几小节, '1.' / '2.']] */
export function unroll(n, repeats = [], voltas = []) {
  const out = [];
  const used = new Set();
  const v1 = voltas.find((v) => v[1] === '1.');
  const v2 = voltas.find((v) => v[1] === '2.');
  let i = 0;
  let second = false;
  while (i < n && out.length < 32) {
    if (second && v1 && v2 && i === v1[0]) {
      i = v2[0];
      second = false;
      continue;
    }
    out.push(i);
    const k = repeats.findIndex((r, j) => r[1] === i && !used.has(j));
    if (k >= 0) {
      used.add(k);
      second = true;
      i = repeats[k][0];
    } else i++;
  }
  return out;
}

/** q = { bars: 几小节, bar（一小节几格）, notes: [[起, 长, 键号]], repeats, voltas（见 unroll()）, labels: ['A', 'B'…], blind（不告诉一共要走几小节） } */
function roadmap(bench, q, on) {
  const S = bench.staff;
  const bar = q.bar || 16;
  const n = q.bars;
  const notes = staffNotes(q.notes);
  const L = q.labels || ['A', 'B', 'C', 'D', 'E', 'F'].slice(0, n);
  const reps = q.repeats || [];
  const vol = q.voltas || [];
  const route = unroll(n, reps, vol);
  const trail = h('div', { class: 'tn-route' });
  let i = 0;
  bench.set({ top: 'staff', trail: true, piano: false, keys: false });
  const draw = () => {
    const barCls = {};
    route.slice(0, i).forEach((b) => (barCls[b] = 'done'));
    if (i > 0) barCls[route[i - 1]] = 'now';
    S.show({ steps: n * bar, bar, time: q.time || [4, 4], notes, repeats: reps.map(([a, b]) => [a * bar, (b + 1) * bar]), voltas: vol.map(([b, label]) => [b * bar, (b + 1) * bar, label]), barLabels: L, barCls, pick: i < route.length ? 'bar' : null });
    trail.replaceChildren(h('span', { class: 'tb-cap' }, '实际走的'), ...route.slice(0, q.blind ? i : route.length).map((b, k) => h('i', { class: k < i ? '' : 'todo' }, k < i ? L[b] : '?')));
  };
  const self = {
    row: [trail],
    onStaff(kind, b) {
      if (kind !== 'bar' || i >= route.length) return;
      const want = route[i];
      if (b === want) {
        i++;
        draw();
        bench.playStaff(notes, { bpm: q.bpm || 112, from: b * bar, steps: bar });
        if (i >= route.length) return on.good(`实际走的是 ${route.map((x) => L[x]).join(' ')}：一共 ${route.length} 小节，谱上只写了 ${n} 小节。`);
        return on.say(`${L[b]}。下一小节走哪儿？`);
      }
      const prev = route[i - 1];
      if (i === 0) return on.bad(`从最左边开始：第一小节是 **${L[want]}**。`);
      if (want <= prev) return on.bad(`${L[prev]} 的后面是 **:|**（两个点朝左的反复记号）：要跳回 **|:** 那里，再来一遍。下一小节是 **${L[want]}**。`);
      if (want > prev + 1) return on.bad(`这是第二遍了：写着 **1.** 的那一小节只走第一遍。这回跳过它，进写着 **2.** 的：是 **${L[want]}**。`);
      on.bad(`${b <= prev ? '反复记号只管一次：第二遍走到它，就直接往右了。' : ''}顺着往右，下一小节是 **${L[want]}**。`);
    },
    solve() {
      while (i < route.length) self.onStaff('bar', route[i]);
    },
  };
  draw();
  return self;
}

// ───────────── 和弦进阶 ─────────────

/** q = { deg: 第几级的和弦, want: 0 / 1 / 2（让地基 / 中间那层 / 上面那层站到最底下）, from: 一开始哪一层在最底下（默认 0） } */
function invert(bench, q, on) {
  const base = bench.chordOf(q.deg || 1); // [基, 中, 上]
  const cur = [...base];
  const lowest = () => cur.indexOf(Math.min(...cur));
  for (let k = 0; k < (q.from || 0); k++) cur[lowest()] += 12;
  bench.silent = true;
  bench.autoTrail = false;
  const draw = () => bench.chord(cur);
  const sound = () => bench.playChord(up(cur), { show: false });
  draw();
  const self = {
    replay: sound,
    onKey(m) {
      const k = cur.indexOf(m);
      if (k < 0) return on.bad('点这一摞里的键：青色的那三个。', m);
      const lo = Math.min(...cur);
      const hi = Math.max(...cur);
      if (m === lo && m + 12 <= 84) cur[k] += 12;
      else if (m === hi && m - 12 >= 60) cur[k] -= 12;
      else return on.bad(m === lo || m === hi ? '再挪就出键盘了。挪另一头的那个。' : '夹在中间的这个先不动。点**最底下**的那个，它会跳到最上面去；点最上面的，它跳到最底下。', m);
      draw();
      sound();
      if (lowest() === q.want) return on.good(`现在最底下是**${LAYER_WORD[q.want]}**（${nameOf(Math.min(...cur))}）。还是 ${base.map(nameOf).join('、')} 这三个音：名字没变，换了个站法。`);
      on.say(`现在最底下是${LAYER_WORD[lowest()]}。要的是：**${LAYER_WORD[q.want]}**站到最底下。`);
    },
    solve() {
      for (let n = 0; n < 4 && lowest() !== q.want; n++) self.onKey(Math.min(...cur));
    },
  };
  return self;
}

/** q = { from: [键号…]（上一摞现在站着的三个键，先后是 基、中、上）, to: 下一摞是第几级的和弦 } */
function nearest(bench, q, on) {
  const from = q.from;
  const target = bench.chordOf(q.to);
  const pcs = target.map((m) => m % 12);
  let sel = [];
  const cost = (a, b) => up(a).reduce((sum, x, k) => sum + Math.abs(x - up(b)[k]), 0); // 三个音各就近挪，一共挪几格
  const where = (pc) => Array.from({ length: 25 }, (_, k) => 60 + k).filter((m) => m % 12 === pc);
  let best = Infinity;
  let bestSet = null;
  for (const a of where(pcs[0])) for (const b of where(pcs[1])) for (const c of where(pcs[2])) {
    const v = cost(from, [a, b, c]);
    if (v < best) {
      best = v;
      bestSet = [a, b, c];
    }
  }
  bench.autoTrail = false;
  // 上一摞是青色的色块（写着基 / 中 / 上）；你选的键描绿边
  const draw = () => {
    bench.unmark();
    bench.chord(from);
    bench.mark(sel, 'good');
  };
  const check = () => {
    if (sel.length < 3) return on.bad(`下一摞要三个音，现在选了 ${sel.length} 个。`);
    const off = sel.find((m) => !pcs.includes(m % 12));
    if (off !== undefined) return on.bad(`下一摞是 ${target.map(nameOf).join('、')}。**${nameOf(off)}** 不在里面。`, off);
    if (new Set(sel.map((m) => m % 12)).size < 3) return on.bad(`三个音名要齐：${target.map(nameOf).join('、')}。有一个重了。`);
    const mine = cost(from, sel);
    if (mine > best) return on.bad(`音是对的，可三个音一共挪了 **${mine} 格**。有个站法只用挪 ${best} 格：两摞**共用的音留在原地**，别的就近挪一步。`);
    bench.playChords([up(from), up(sel)], { gap: 0.8, show: false });
    const keep = sel.filter((m) => from.includes(m));
    on.good(`一共只挪了 ${mine} 格${keep.length ? `，**${keep.map(nameOf).join('、')}** 留在原地没动` : ''}。同一摞和弦，挑离上一摞最近的站法，接起来就顺。`);
  };
  draw();
  bench.playChord(up(from), { show: false });
  return {
    row: [btn('▶ 听我选的', () => sel.length && bench.playChord(up(sel), { show: false })), btn('清掉重选', () => {
      sel = [];
      draw();
    }), btn('对一下', check, 'primary')],
    replay: () => bench.playChord(up(from), { show: false }),
    onKey(m) {
      if (sel.includes(m)) sel = sel.filter((x) => x !== m);
      else if (sel.length < 3) sel = [...sel, m];
      else return on.say('已经选了三个。想换：再点一下选中的键，把它放掉。');
      draw();
    },
    solve() {
      sel = [...bestSet];
      draw();
      check();
    },
  };
}

/** q = { deg, want: 'up'（中间那层挂到上面一级）/ 'down'（挂到下面一级）/ 'back'（落回原位）, start: 'mid' / 'up' / 'down' } */
function suspend(bench, q, on) {
  const d = q.deg || 1;
  const [r, t, f] = bench.chordOf(d);
  const spot = { mid: t, up: bench.degMidi(d + 3), down: bench.degMidi(d + 1) };
  const goal = q.want === 'back' ? 'mid' : q.want;
  const WORD = { mid: '回到了原位', up: '挂到了上面一级', down: '挂到了下面一级' };
  let at = q.start || 'mid';
  bench.silent = true;
  bench.autoTrail = false;
  const notes = () => [r, spot[at], f];
  const sound = () => bench.playChord(up(notes()), { show: false });
  bench.chord(notes());
  const self = {
    replay: sound,
    onKey(m) {
      const to = Object.keys(spot).find((k) => spot[k] === m);
      if (!to) return on.bad(m === r || m === f ? '地基和最上面那层不动。挪的是**中间那层**。' : '中间那层只挪一级：点它隔壁亮着的键，上面一个，或者下面一个。', m);
      at = to;
      bench.chord(notes());
      sound();
      if (at === goal) return on.good(at === 'mid' ? '落回去了：亮暗回来了，踏实。' : `中间那层${WORD[at]}：不亮也不暗，悬着，等着落回去。`);
      on.say(`中间那层${WORD[at]}。要的是：${goal === 'mid' ? '**落回**原位' : goal === 'up' ? '挂到**上面**一级' : '挂到**下面**一级'}。`);
    },
    solve: () => self.onKey(spot[goal]),
  };
  return self;
}

/** q = { deg }：三层不动，顶上加一个从地基数第 9 个的音（高一层的、地基隔壁的那个） */
function addtone(bench, q, on) {
  const d = q.deg || 1;
  const base = bench.chordOf(d);
  const target = bench.degMidi(d + 8);
  let over = false;
  bench.silent = true;
  bench.autoTrail = false;
  bench.chord(base);
  const self = {
    replay: () => bench.playChord(base, { show: false }),
    onKey(m) {
      if (over) return;
      if (m === target) {
        over = true;
        bench.chord([...base, m], ['基', '中', '上', '加']);
        bench.playChord([...base, m], { show: false });
        return on.good('三层一个没动，顶上多了一个：亮晶晶的。它不管亮暗，只添颜色。');
      }
      bench.playChord(up([...base, m]), { show: false });
      if (base.includes(m)) return on.bad('这个音这一摞里已经有了。要**加**一个新的。', m);
      if (m === bench.degMidi(d + 6)) return on.bad('这是第四层（“第四层”那一关叠过的）。这回加的是它再上面那个：高一层的、地基**隔壁**的那个音。', m);
      if (m === bench.degMidi(d + 1)) return on.bad('音名对了，可它夹在地基和中间那层的缝里：挤。把它搬到**高一层**去。', m);
      on.bad('不是它。要加的是：高一层的、地基**隔壁**的那个音。', m);
    },
    solve: () => self.onKey(target),
  };
  return self;
}

/** 只听：q = { deg, want: 0 / 1 / 2 }。键盘上摆着这一摞原来的样子（基 / 中 / 上），啾啾弹的是换了站法的：最底下是哪一层？ */
function bottomear(bench, q, on) {
  const base = bench.chordOf(q.deg || 1);
  const voiced = [...base];
  for (let k = 0; k < q.want; k++) voiced[voiced.indexOf(Math.min(...voiced))] += 12;
  let over = false;
  bench.silent = true;
  bench.autoTrail = false;
  bench.chord(base);
  const hear = () => bench.playChord(up(voiced), { show: false });
  hear();
  const self = {
    replay: hear,
    onKey(m) {
      if (over) return;
      const k = base.findIndex((x) => (x - m) % 12 === 0);
      if (k < 0) return on.bad('点青色的那三个键里的一个。', m);
      bench.tone(m, { len: 0.5 });
      if (k !== q.want) return on.bad(`不是${LAYER_WORD[k]}。再听：那一摞里**最低**的那个声音，和你点的这个，是不是同一个音？`, m);
      over = true;
      bench.chord(voiced);
      on.good(`最底下是**${LAYER_WORD[k]}**（${nameOf(m)}）。${k === 0 ? '地基在最底下：最稳的站法。' : '地基不在最底下：听着轻一点、飘一点。'}`);
    },
    solve: () => self.onKey(base[q.want]),
  };
  return self;
}

/** 只听：q = { deg, want: { at: 'mid' / 'up' / 'down', add: 加没加顶上那个音 } }。把自己的一摞摆成和啾啾的一样 */
function colorear(bench, q, on) {
  const d = q.deg || 1;
  const [r, t, f] = bench.chordOf(d);
  const spot = { mid: t, up: bench.degMidi(d + 3), down: bench.degMidi(d + 1) };
  const nine = bench.degMidi(d + 8);
  const want = q.want;
  let at = 'mid';
  let add = false;
  bench.silent = true;
  bench.autoTrail = false;
  const build = (a, ad) => [r, spot[a], f, ...(ad ? [nine] : [])];
  const draw = () => bench.chord(build(at, add), ['基', '中', '上', '加']);
  const mine = () => bench.playChord(up(build(at, add)), { show: false });
  const hear = () => bench.playChord(up(build(want.at, want.add)), { show: false });
  const check = () => {
    if (at === want.at && add === want.add) return on.good(`一样了：${want.at === 'mid' ? '中间那层在原位' : want.at === 'up' ? '中间那层挂在上面' : '中间那层挂在下面'}${want.add ? '，顶上加了一个' : ''}。`);
    on.bad(add !== want.add ? '还不一样。两边各听一遍：顶上那一点亮晶晶的，有，还是没有？' : '还不一样。两边各听一遍：中间那层是亮暗分明，还是悬着？悬着的话，是往上挂，还是往下挂？');
  };
  draw();
  hear();
  return {
    row: [btn('▶ 听我的', mine), btn('对一下', check, 'primary')],
    replay: hear,
    onKey(m) {
      const to = Object.keys(spot).find((k) => spot[k] === m);
      if (to) at = to;
      else if (m === nine) add = !add;
      else return on.bad(m === r || m === f ? '地基和最上面那层不动。能挪的是中间那层（上下各一级），能加的是高一层的、地基隔壁的那个。' : '这个键用不上。能挪的是中间那层（上下各一级），能加的是高一层的、地基隔壁的那个。', m);
      draw();
      mine();
    },
    solve() {
      at = want.at;
      add = want.add;
      draw();
      check();
    },
  };
}

export const QUIZ = { staffkey, keystaff, onsets, spell, barlines, fillbar, dynamics, roadmap, invert, nearest, suspend, addtone, bottomear, colorear };
