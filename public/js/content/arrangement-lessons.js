// 完整版的课：照着 content/song-arrangements.js 里一首歌的完整版，在机器上把它排成一整首。每首两节：
//   ① 备料：把每一段要用的乐句做出来（6 段乐句、复制粘贴、[BAR LENGTH] 加长让机器照抄、一页页改）——第 6.1、6.2 课的做法；
//   ② 排成一首：Song 模式里一个个加 scene（每个 scene = 每条轨道放第几段、谁静音、多长），从头放一遍，边放边做现场动作（滤波器开 / 关）——第 6.3、7 章的做法。
// 前提：这首歌的“一轨一轨搭出来”（song-lessons.js）已经搭进了机器的一个工程（5–8 号），那就是每条轨道的第 1 段。
// 模拟机上不用先搭：课一开始就把那个样子摆进 5 号工程（① 摆分轨那一段，② 摆完整版的全部乐句）。
//
// 课文、核对的目标、每一项“怎么做”都是从完整版的数据算出来的（改完整版，课跟着变）：
//   每段新乐句挑最省事的做法——从空白做（先做第 1 小节、按 [BAR LENGTH] 加长让机器照抄、再一页页改；或者先加长再一页页填），
//   或者复制这条轨道已经做好的一段、贴过来再改。按几下键都算出来比一比（planPattern）。
//   每一项上挂着 act（给 dev/walk-arr.js 的通用走法用：它照着 act 在模拟机 / 假真机上把课走一遍）。
// 机器操作的依据（docs/seqtrak-operation-reference.md）：3.7.1 转轨道旋钮换段、3.7.3 3 ⇔ 6 段（真机上实测是整个工程一起换，30 40 79）、
// 3.7.4 [BAR LENGTH]（加长时新的小节照抄前面的；V2.00 起鼓轨也能用）、3.7.7 复制粘贴、3.4.2 / 3.5.10 翻页和步进输入、3.5.3 八度、
// 3.14 Song 模式（加 scene = 照抄选中的那个；按住 [PAGE] 转 [ALL] 改长度，按下去转一次一小节）、3.8.1 静音、3.11 滤波器（第 2 页旋钮 3）、
// 3.12 单轨效果（[MASTER/SINGLE]、[FX] 的 DUCKER）、3.15.1 混音台。
import { ARRANGEMENTS } from './song-arrangements.js';
import { SONG_PARTS } from './song-parts.js';
import { SONGS } from './songs.js';
import { patternOf, patternCount, arrangementTracks, arrangementTimeline } from '../song-player.js';
import { cleanPattern } from '../chart.js';
import { synthKeyNote, chordNotes, SCALES, KEY_NAMES } from '../scales.js';
import { TRACK, TRACKS } from '../tracks.js';

const DRUMS = ['KICK', 'SNARE', 'CLAP', 'HAT1', 'HAT2', 'PERC1', 'PERC2'];
const ORDER = TRACKS.map((t) => t.id);
const WHERE = {
  KICK: '鼓区上排第 2 个', SNARE: '鼓区上排第 3 个', CLAP: '鼓区上排第 4 个',
  HAT1: '鼓区下排第 1 个', HAT2: '鼓区下排第 2 个', PERC1: '鼓区下排第 3 个', PERC2: '鼓区下排第 4 个',
  SYNTH1: '合成器区上排左边', SYNTH2: '合成器区上排右边', DX: '合成器区下排左边', SAMPLER: '合成器区下排右边',
};
// 模拟机空白工程里三条合成器轨一开始的八度、弹法（simulator.js 的 makeProject）；真机上不一定，课文里让他看一眼
const SIM_OCT = { SYNTH1: -2, SYNTH2: 0, DX: 0 };
const SIM_POLY = { SYNTH1: 0, SYNTH2: 1, DX: 1 };
// 音色的类别：按住 SOUND 旋钮再按第几个方键（和模拟机、第 4 章一样的表）
const DRUM_CATS = ['KICK', 'SNARE', 'RIM', 'CLAP', 'SNAP', '闭镲', '开镲', '沙锤/铃鼓', 'RIDE', 'CRASH', 'TOM', 'BELL', '康加/邦戈', 'WORLD', 'SFX'];
const SYNTH_CATS = ['BASS', 'SYNTH LEAD', 'PIANO', 'KEYBOARD', 'ORGAN', 'PAD', 'STRINGS', 'BRASS', 'WOODWIND', 'GUITAR', 'WORLD', 'MALLET', 'BELL', 'RHYTHMIC', 'SFX'];
const CAT_ALIAS = { CYMBAL: 'CRASH', 'SYNTH PAD': 'PAD', SHAKER: '沙锤/铃鼓', PERC: '康加/邦戈' };
// 鼓轨出厂的那一类：完整版要的就是这一类，不用换
const HOME_CAT = { KICK: 'KICK', SNARE: 'SNARE', CLAP: 'CLAP', HAT1: '闭镲', HAT2: '开镲' };
const STRETCH_MONO = 8; // 单音轨上至少这么长（步）的音要拉长；和弦一律拉到它该有的长度
const SPLIT = 16; // 一步里最多放几项，多了按乐句拆成几步

const pretty = (name) => name.replace('#', '♯');
const list = (xs) => xs.join('、');
const at = (s) => (s % 16) + 1; // 一页里第几个方键
const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
const label = (t) => TRACK[t].label;
const isDrum = (t) => DRUMS.includes(t);
const ZH = ['零', '一', '两', '三', '四', '五', '六', '七', '八'];
const LIGHT_POS = ['最上面', '中间', '最下面'];
/** 旋钮旁边那 3 个小灯：第几段亮在哪、什么颜色（手册 3.7.1；位置是从插图读出来的） */
const light = (n) => `旁边那 3 个小灯**${LIGHT_POS[(n - 1) % 3]}**那个亮${n > 3 ? '**青蓝色**（第 4–6 段是青蓝）' : '黄色'}`;
const PAGE_LIGHTS = '翻到第几页，看右边那列小灯里**青蓝色闪**的那个：最下面 = 第 1 页，往上依次是第 2、3、4……页。';
const lenWord = (steps) => (steps % 16 ? `${steps / 4} 拍` : `${steps / 16} 小节`);

// ───────────── 机器上的样子：一段乐句里每一步有什么 ─────────────
// 鼓：map 步 → true；合成器：map 步 → { key, shift（相对这条轨道的 OCTAVE）, len, pitch: [音…] }。bars = 这段几小节。
// 内容按 128 步记（比 bars 长的部分就是“藏着的”：缩短不丢，和机器一样）

const emptyContent = (drum, chord) => ({ drum, chord, bars: 1, map: new Map() });
const clone = (c) => ({ ...c, map: new Map([...c.map].map(([k, v]) => [k, v === true ? true : { ...v, pitch: [...v.pitch] }])) });
const samePitch = (a, b) => a.pitch.length === b.pitch.length && a.pitch.every((x, i) => x === b.pitch[i]);

function drumContent(part) {
  const s = cleanPattern(part.steps);
  const map = new Map();
  [...s].forEach((c, i) => (c === 'x' || c === 'X') && map.set(i, true));
  return { drum: true, chord: false, bars: Math.max(1, Math.ceil(s.length / 16)), map };
}

/** 一段合成器乐句；oct = 机器上这条轨道的 OCTAVE（shift 按它算） */
function synthContent(song, part, oct) {
  const chord = part.mode === 'chord';
  const map = new Map();
  for (const [st, key, len = 1, sh = 0] of part.notes) {
    const o = { scale: song.scale, key: song.key, octave: (part.octave || 0) + sh };
    map.set(st, { key, shift: (part.octave || 0) + sh - oct, abs: (part.octave || 0) + sh, len, pitch: chord ? chordNotes(key, o) : [synthKeyNote(key, o)] });
  }
  return { drum: false, chord, bars: part.bars || song.bars, map };
}

/** 按一下 [BAR LENGTH]：1 → 2 → 4 → 8 → 1。加长时新的那几小节里没东西，就照抄前面的（和模拟机一样整块看；手册是一小节一小节看） */
function pressBars(c) {
  const next = c.bars >= 8 ? 1 : c.bars * 2;
  if (next > c.bars) {
    const from = c.bars * 16;
    const busy = [...c.map.keys()].some((s) => s >= from && s < next * 16);
    if (!busy) for (const [s, v] of [...c.map]) if (s < from) for (let k = 1; k < next / c.bars; k++) c.map.set(s + k * from, v === true ? true : { ...v, pitch: [...v.pitch] });
  }
  c.bars = next;
}

/** 单音轨上这个音要不要拉到它的长度；和弦都要 */
const wantLen = (c, t) => (c.chord ? t.len > 1 : t.len >= STRETCH_MONO);

/** 把第 b 小节改成和目标一样：要做的事（按灭 / 按亮 / 按 Synth key / 换和弦 / 拉长）和要按几下 */
function barOps(X, T, b) {
  const from = b * 16;
  const to = from + 16;
  const steps = new Set([...X.map.keys(), ...T.map.keys()].filter((s) => s >= from && s < to));
  if (X.drum) {
    const on = [];
    const off = [];
    for (const s of [...steps].sort((a, c) => a - c)) {
      if (T.map.has(s) && !X.map.has(s)) on.push(s);
      if (!T.map.has(s) && X.map.has(s)) off.push(s);
    }
    return { on, off, cost: on.length + off.length };
  }
  const off = [];
  const add = [];
  const swap = [];
  const stretch = [];
  for (const s of [...steps].sort((a, c) => a - c)) {
    const x = X.map.get(s);
    const t = T.map.get(s);
    let len = x?.len || 1;
    if (!t) off.push(s);
    else if (!x) {
      add.push({ step: s, key: t.key, shift: t.shift });
      len = 1;
    } else if (!samePitch(x, t)) {
      if (X.chord) swap.push({ step: s, key: t.key, shift: t.shift });
      else {
        off.push(s);
        add.push({ step: s, key: t.key, shift: t.shift });
        len = 1;
      }
    }
    if (t && len !== t.len && (wantLen(X, t) || len >= STRETCH_MONO)) stretch.push({ step: s, len: t.len, was: len });
  }
  // 一样的键、一样的八度放在一起：按一次 Synth key 放好几步
  const groups = [];
  for (const a of add) {
    const g = groups.find((x) => x.key === a.key && x.shift === a.shift);
    if (g) g.steps.push(a.step);
    else groups.push({ key: a.key, shift: a.shift, steps: [a.step] });
  }
  groups.sort((a, c) => Math.abs(a.shift) - Math.abs(c.shift) || a.steps[0] - c.steps[0]);
  const shifts = new Set([...groups, ...swap].map((g) => g.shift).filter(Boolean));
  const cost = off.length + add.length + groups.length + swap.length * 2 + stretch.length * 2 + shifts.size * 2;
  return { off, add: groups, swap, stretch, cost };
}

/** 照着 barOps 改 X 的第 b 小节 */
function applyBar(X, T, b, ops) {
  for (let s = b * 16; s < b * 16 + 16; s++) {
    const t = T.map.get(s);
    if (!t) X.map.delete(s);
    else if (X.drum) X.map.set(s, true);
    else {
      const x = X.map.get(s);
      const keep = x && samePitch(x, t);
      const st = ops.stretch.find((z) => z.step === s);
      const len = st ? st.len : keep || (X.chord && x) ? x.len : 1;
      X.map.set(s, { key: t.key, shift: t.shift, abs: t.abs, len, pitch: [...t.pitch] });
    }
  }
}

/**
 * 从 X0（null = 空白的一段）做到目标 T：先把长度弄到 L0、改好这几小节，再一次次加长（照抄）、改新的小节。
 * X0 比 T 长：按 [BAR LENGTH] 轮一圈缩到 T 的长度（后面的没丢，只是不放），再改。
 * 返回 { cost, ops: [{ type: 'bars', to, presses, copied }, { type: 'bar', b, ...barOps }], result }
 */
function runPath(X0, T, L0) {
  const X = X0 ? clone(X0) : emptyContent(T.drum, T.chord);
  const ops = [];
  let cost = 0;
  const lengthen = (target) => {
    let presses = 0;
    let copied = false;
    while (X.bars !== target) {
      const before = X.map.size;
      const was = X.bars;
      pressBars(X);
      if (X.bars > was && X.map.size > before) copied = true;
      presses++;
      if (presses > 6) throw new Error('长度转不过去');
    }
    if (presses) {
      ops.push({ type: 'bars', to: target, presses, copied, shorter: !!X0 && target < X0.bars });
      cost += presses;
    }
  };
  const fix = (bars) => {
    for (const b of bars) {
      const o = barOps(X, T, b);
      if (!o.cost) continue;
      applyBar(X, T, b, o);
      ops.push({ type: 'bar', b, ...o });
      cost += o.cost + 1; // 翻页 + 看一眼也算一下
    }
  };
  if (X.bars > T.bars) {
    lengthen(T.bars);
    fix([...Array(T.bars).keys()]);
  } else {
    lengthen(Math.max(X.bars, L0));
    fix([...Array(X.bars).keys()]);
    while (X.bars < T.bars) {
      const was = X.bars;
      lengthen(was * 2);
      fix([...Array(X.bars - was).keys()].map((i) => was + i));
    }
  }
  return { cost, ops, result: X };
}

/** 一段新乐句最省事的做法：从空白做（几种先后），或者复制这条轨道已经做好的某一段 */
function planPattern(T, sources) {
  const levels = (from) => [1, 2, 4, 8].filter((l) => l >= from && l <= Math.max(from, T.bars));
  let best = null;
  const consider = (p) => {
    if (!best || p.cost < best.cost) best = p;
  };
  for (const L0 of levels(1)) consider({ ...runPath(null, T, L0), from: null });
  const fresh = best.cost;
  for (const [no, c] of sources) {
    for (const L0 of levels(c.bars)) {
      const p = runPath(c, T, L0);
      // 复制、粘贴本身要按两下组合键：至少省 4 下才值得
      if (p.cost + 4 + 3 <= fresh) consider({ ...p, cost: p.cost + 4, from: no });
    }
  }
  return best;
}

// ───────────── 一首歌在机器上的完整样子 ─────────────

/** 完整版每条轨道：八度、弹法、几段乐句（机器上的样子），和课开头时这条轨道已经有的（分轨那一段） */
function machinePlan(song, spec, arr) {
  const tracks = arrangementTracks(spec, arr);
  return tracks.map((p) => {
    const t = p.track;
    const part = spec.parts.find((x) => x.track === t) || null;
    const drum = isDrum(t);
    const oct = drum ? 0 : p.octave || 0;
    const n = patternCount(spec, arr, t);
    const pats = {};
    for (let no = 1; no <= n; no++) {
      const pp = patternOf(spec, arr, t, no);
      if (!pp) continue;
      pats[no] = drum ? drumContent(pp) : synthContent(spec, pp, oct);
      pats[no].role = pp.role;
      pats[no].part = pp;
    }
    // 课开头机器上已经有的：分轨那一段（曲目课搭的）就是第 1 段；完整版加的轨道是空的
    const startOct = drum ? 0 : part ? part.octave || 0 : SIM_OCT[t] ?? 0;
    const start = part ? (drum ? drumContent(part) : synthContent(spec, part, startOct)) : null;
    const used = new Set(arr.scenes.flatMap((sc) => (sc.play[t] ? [sc.play[t]] : [])));
    return { track: t, info: p, part, drum, chord: p.mode === 'chord', oct, startOct, pats, start, used };
  });
}

const sortedSteps = (c) => [...c.map.keys()].filter((s) => s < c.bars * 16).sort((a, b) => a - b);
const notesOfContent = (c, from = 0, to = 999) => Object.fromEntries([...c.map].filter(([s]) => s >= from && s < to && s < c.bars * 16).map(([s, v]) => [s, v.pitch[0]]));
const keysOfContent = (c, from = 0, to = 999) => Object.fromEntries([...c.map].filter(([s]) => s >= from && s < to && s < c.bars * 16).map(([s, v]) => [s, v.key]));

/** 给模拟机摆的样子（simulator.seedProject 的写法）：pats = { 轨道: { 第几段: 内容 } } */
function seedSpec(spec, plan, pats, { octOf, slots }) {
  const out = { settings: { tempo: spec.bpm, swing: spec.swing || 0, scale: spec.scale, key: spec.key }, octave: {}, poly: {}, slots, drums: {}, keys: {}, bars: {}, patterns: {} };
  for (const tp of plan) {
    if (!tp.drum) {
      out.octave[tp.track] = octOf(tp);
      out.poly[tp.track] = tp.chord ? 2 : SIM_POLY[tp.track];
    }
  }
  const fill = (dst, tp, c) => {
    if (tp.drum) dst.drums = { ...dst.drums, [tp.track]: sortedSteps({ ...c, bars: 8 }) };
    else {
      const o = octOf(tp);
      dst.keys = { ...dst.keys, [tp.track]: [...c.map].map(([s, v]) => [s, v.key, v.len, v.abs - o]) };
    }
    dst.bars = { ...dst.bars, [tp.track]: c.bars };
  };
  for (const tp of plan) {
    for (const [no, c] of Object.entries(pats[tp.track] || {})) {
      const i = Number(no) - 1;
      if (i === 0) fill(out, tp, c);
      else fill((out.patterns[i] ??= {}), tp, c);
    }
  }
  return out;
}

// ───────────── 课文里常用的几项 ─────────────

const SELECT = (t) => ({ text: `按一下 **${label(t)} 旋钮**（${WHERE[t]}），只按不转：选中它。`, panel: [t], detect: { kind: 'track', track: t }, wait: `点一下 ${label(t)} 旋钮…`, liveWait: `等你按 ${label(t)} 旋钮…`, act: { do: 'select', track: t } });
const PLAY = (text = '短按 [PLAY]（左侧面最下面）听听。') => ({ text, panel: ['PLAY'], detect: { kind: 'start' }, wait: '点 [PLAY]…', liveWait: '等你按 [PLAY]…', act: { do: 'play' } });
const STOP = (text = '听够了按 [PLAY] 停下。') => ({ text, panel: ['PLAY'], detect: { kind: 'stop' }, wait: '再点 [PLAY]…', liveWait: '等你停止…', act: { do: 'stop' } });

function catOf(track, cat) {
  const name = CAT_ALIAS[cat] || cat;
  const cats = isDrum(track) ? DRUM_CATS : SYNTH_CATS;
  const i = cats.indexOf(name);
  return i < 0 ? null : { i, name };
}

// ───────────── ① 备料 ─────────────

function listenStep(song, spec, arr, plan, ctx) {
  const rows = plan.filter((tp) => ctx.work[tp.track]?.length).map((tp) => {
    const ns = ctx.work[tp.track];
    return `**${label(tp.track)}**：${tp.start ? '第 1 段是分轨那一段，' : '完整版新加的轨道，'}要做第 ${list(ns)} 段`;
  });
  return {
    type: 'read', title: '先听完整版，看要备哪些料', role: 'listen',
    blocks: [
      `《${song.title}》的完整版有 ${arr.scenes.length} 段（${[...new Set(arr.scenes.map((s) => s.name))].join('、')}），每段每条轨道放的乐句不一样。先听一遍：`,
      { widget: 'arrangement', song: song.id },
      '这节课只做一件事：**把每一段要用的乐句都做出来**，排进机器的第 2、3……段里（下一节课再把它们排成 scene、从头演一遍）。要做的是这些：',
      { list: rows },
      { callout: 'theory', text: '一条轨道的几段乐句互不影响：**转一下轨道旋钮**就换一段（第 6.1 课）。做新的一段有三种省事的办法，每一段课里都替你挑好了：**复制**一段像的、贴过来再改（第 6.2 课）；先做第 1 小节、按 **[BAR LENGTH]** 加长，让机器把它照抄到后面，再一页页改；或者先加长，再一页页填。' },
      ctx.six && { callout: 'warn', text: `这首有的轨道要用到第 ${ctx.most} 段：机器出厂每条轨道只有 3 段，下一步先换成 6 段。` },
      { callout: 'tip', text: `大约 ${ctx.minutes} 分钟，可以分好几次做：进度会记着，下次从停下的那一步接着来。做完一条轨道就可以停。` },
    ].filter(Boolean),
    coach: `完整版的课 ①《${song.title}》备料：在搭好分轨（每条轨道第 1 段）的工程里，把完整版要用的其余乐句做出来。${arr.summary} 要做的：${rows.join('；').replace(/\*\*/g, '')}。`,
  };
}

function prepStep(song, spec, arr, plan, ctx) {
  const scale = SCALES[spec.scale];
  const tasks = [
    { text: '换到你搭这首歌的工程：**先按住 [PROJECT↑] 不放，再按上排第 5–8 个方键**里那一个（曲目课用的 5–8 号）。已经在了会自己打勾。', panel: ['PROJECT', 'DK5'], detect: { kind: 'project', in: [4, 5, 6, 7] }, wait: '长按 [PROJECT↑] 出现黑圈，再点上排第 5 个方键…', liveWait: '等你换到 5–8 号里搭这首歌的那个工程…', act: { do: 'project' } },
    { text: `速度是 **${spec.bpm} BPM**（不是就按右侧面的 [BPM −] / [BPM +] 调）。`, panel: ['BPM-', 'BPM+'], detect: { kind: 'tempo', value: spec.bpm }, wait: `按 [BPM −] / [BPM +]，调到 ${spec.bpm}…`, liveWait: `等速度是 ${spec.bpm}…`, act: { do: 'tempo', value: spec.bpm } },
    { text: `音阶和调是 **${scale.name} / ${pretty(KEY_NAMES[spec.key])}**（不是就按 [SCALE]、[KEY] 调）。`, panel: ['SCALE', 'KEY', 'METER'], detect: { kind: 'scale', scale: spec.scale, key: spec.key }, wait: '点 [SCALE]、[KEY]，看模拟机下面那行字…', liveWait: `等读数是 ${scale.zh} / ${KEY_NAMES[spec.key]}…`, act: { do: 'scale', scale: spec.scale, key: spec.key } },
  ];
  if (ctx.six) {
    tasks.push({
      text: '把乐句换成 **6 段**：**先按住 KICK 旋钮不放**，方键 1–6 会亮起来（黄 = 现在这段，白 = 能用的，**蓝 = 还没打开的 4–6**），**再按一下亮蓝色的第 4 个方键**。4–6 变成白色就好了。已经是 6 段的会自己打勾。',
      panel: ['KICK', 'DK4', 'DK5', 'DK6'], detect: { kind: 'patmode', six: true }, wait: '长按 KICK 旋钮出现黑圈，再点第 4 个方键…', liveWait: '按住 KICK 旋钮，按亮蓝色的第 4 个方键…', act: { do: 'patmode' },
    });
  }
  return {
    type: 'do', title: '准备：回到搭好的那个工程', role: 'prep',
    blocks: [
      `回到搭《${song.title}》分轨的那个工程：每条轨道的**第 1 段**就是分轨里那一段，这节课在它的后面加新的段。`,
      { callout: 'tip', text: `模拟机已经替你在 5 号工程里摆好了分轨那一段（${spec.bpm} BPM、${pretty(KEY_NAMES[spec.key])} ${scale.zh}），前几项会自己打勾。` },
    ],
    liveBlocks: [
      `回到搭《${song.title}》分轨的那个工程：每条轨道的**第 1 段**就是分轨里那一段，这节课在它的后面加新的段。`,
      { callout: 'warn', text: `还没搭过的话，先上这首歌的「一轨一轨搭出来」（分轨页右边，[去那节课](#/lesson/song-${song.id})），再回来。` },
      { device: ['project', 'tempo', 'scale', 'key'] },
      { action: 'tempo', value: spec.bpm, label: `让应用直接把速度设成 ${spec.bpm}` },
      { action: 'scalekey', scale: spec.scale, key: spec.key, label: `让应用直接设成 ${scale.name} / ${KEY_NAMES[spec.key]}` },
    ],
    tasks,
    done: `准备好了${ctx.six ? '：每条轨道能放 6 段了' : ''}。`,
    coach: `完整版 ① 的准备：回到搭《${song.title}》分轨的 5–8 号工程（按住 [PROJECT↑] + 上排方键），确认 ${spec.bpm} BPM、${scale.name} / ${KEY_NAMES[spec.key]}。${ctx.six ? `要用到第 ${ctx.most} 段，先把乐句数从 3 换成 6：按住一条轨道的旋钮，按亮蓝色的方键 4–6（手册 3.7.3；用户这台机器上实测 30 40 79 是整个工程一个开关，换了全部轨道都是 6 段，应用读得出来）。` : ''}`,
  };
}

/** 换音色、八度、弹法、DUCKER、混响：完整版改了这条轨道的样子，先改好再做乐句（弹法、单轨效果都跟着音色走，所以先换音色） */
function soundStep(song, spec, arr, plan) {
  const tasks = [];
  const lines = [];
  let single = false;
  for (const tp of plan) {
    const t = tp.track;
    const snd = tp.info.sound && (arr.tracks?.[t]?.sound || !tp.part) ? tp.info.sound : null;
    const cat = snd && catOf(t, snd.cat);
    const homeOk = cat && isDrum(t) && HOME_CAT[t] === cat.name;
    const needSound = cat && !homeOk;
    const needOct = !tp.drum && tp.oct !== tp.startOct;
    const startPoly = tp.part ? (tp.part.mode === 'chord' ? 2 : SIM_POLY[t]) : SIM_POLY[t];
    const needPoly = !tp.drum && tp.chord && (needSound || startPoly !== 2);
    const needDuck = !tp.drum && tp.info.duck;
    if (!needSound && !needOct && !needPoly && !needDuck) continue;
    tasks.push(SELECT(t));
    if (needSound) {
      tasks.push({
        text: `换音色：**先按住 SOUND 旋钮**（右边桔红色那一列最上面）**不放，再按第 ${cat.i + 1} 个方键**，跳到「${cat.name}」这一类；再转 SOUND 旋钮挑一个：${snd.hint}。`,
        panel: ['SD1', `DK${cat.i + 1}`], detect: { kind: 'sound', track: t }, wait: `长按 SOUND 旋钮出现黑圈，再点第 ${cat.i + 1} 个方键…`, liveWait: '按住 SOUND 旋钮再按方键，然后转着挑（换了音色会自己打勾）…',
        act: { do: 'sound', track: t, cat: cat.i },
      });
      lines.push(`**${label(t)}** 换成「${cat.name}」：${snd.hint}`);
    }
    if (needOct) {
      tasks.push({
        text: `把 ${label(t)} 的八度设成 **${signed(tp.oct)}**：**先按住 [OCTAVE] 不放，再转 [ALL] 旋钮**，看右边那列小灯（自下而上是 −3 到 +2），然后松开。`,
        panel: ['OCTAVE', 'ALL', 'METER'], detect: { kind: 'octave', track: t, value: tp.oct }, wait: '长按 [OCTAVE] 出现黑圈，再拖 ALL 旋钮…', liveWait: '按住 [OCTAVE] 转 [ALL]，看右边那列小灯…',
        act: { do: 'octave', track: t, from: tp.startOct, to: tp.oct },
      });
      lines.push(`**${label(t)}** 的八度 ${signed(tp.startOct)} → ${signed(tp.oct)}（已经放进去的音不会跟着变，只管接下来按的）`);
    }
    if (needPoly) {
      tasks.push({ text: '**慢慢转**右边桔红色那一列**从上往下数第 2 个**旋钮，转到 **CHORD**（那列文字里 “CHORD” 亮）。', panel: ['SD2', 'INDEX', 'METER'], detect: { kind: 'polymode', track: t, mode: 2 }, wait: '往上拖第 2 个旋钮，直到 CHORD 亮…', liveWait: '慢慢转第 2 个旋钮，直到读数变成 CHORD…', act: { do: 'poly', track: t, mode: 2 } });
      lines.push(`**${label(t)}** 切到 CHORD（一个键一个和弦）`);
    }
    if (needDuck) {
      if (!single) {
        tasks.push({ text: '[MASTER/SINGLE]（[FX] 旋钮下面那个横着拨的小开关）拨到右边的 **SINGLE**：[FX] 现在只管选中的这条轨道。', panel: ['MASTERSINGLE'], sim: { kind: 'fxswitch', single: true }, wait: '点一下那个小开关…', act: { do: 'single', on: true } });
        single = true;
      }
      tasks.push({ text: '[FX] 旋钮**一直往一个方向**转，看 Index 上的字一行行往下走，转到 **DUCKER**（停在它的第 1 个就行）。', panel: ['FX', 'INDEX', 'METER'], sim: { kind: 'fxtype', cat: 'DUCKER', track: t }, wait: '把 [FX] 旋钮一直往上拖，拖到 DUCKER…', liveWait: '转 [FX] 到 DUCKER（做完点“我已经做了”）…', act: { do: 'fx', track: t, cat: 'DUCKER' } });
      tasks.push({ text: `手指在 **[FX LEVEL]**（开关下面那条触摸条）上往上滑到${tp.info.duck >= 0.55 ? '大半' : '一半'}：底鼓一响，${label(t)} 就被压下去一下。`, panel: ['FXLEVEL'], sim: { kind: 'fxlevel', min: 0.3 }, live: { kind: 'fxlevel' }, wait: '在 [FX LEVEL] 上按住往上推…', liveWait: '在 [FX LEVEL] 上往上滑（没打勾就点“我已经做了”）…', act: { do: 'fxlevel', level: tp.info.duck >= 0.55 ? 0.7 : 0.5 } });
      lines.push(`**${label(t)}** 开 DUCKER（单轨效果）：跟着底鼓“喘气”`);
    }
  }
  if (single) tasks.push({ text: '[MASTER/SINGLE] **拨回 MASTER**（DUCKER 留在那几条轨道的音色里）。', panel: ['MASTERSINGLE'], sim: { kind: 'fxswitch', single: false }, wait: '再点一下那个小开关…', act: { do: 'single', on: false } });
  // 完整版新加的轨道往混响里送一点（和分轨那节课一样在混音台里调；应用看不见，做完点“做好了”）
  const wet = plan.filter((tp) => !tp.part && tp.info.send?.reverb);
  if (wet.length) {
    tasks.push({ text: '进混音台：**先按住 [ALL] 旋钮不放，再按一下左侧面的 [VOL +]**（最上面那个），那列文字里 “MIXER” 亮。', panel: ['ALL', 'VOL+', 'INDEX'], sim: { kind: 'mixer', on: true }, wait: '长按 ALL 旋钮出现黑圈，再点 [VOL +]…', act: { do: 'mixer', on: true } });
    tasks.push({ text: `按一下右边那一列**第 3 个**旋钮（“REVERB” 亮），再把 ${list(wet.map((tp) => `**${label(tp.track)}** 旋钮${tp.info.send.reverb >= 0.4 ? '转一些' : '转一点'}`))}（往混响里送）。`, panel: ['SD3', ...wet.map((tp) => tp.track)], act: { do: 'mixsend', tracks: wet.map((tp) => tp.track) } });
    tasks.push({ text: '退出混音台：再**按住 [ALL] 按一下 [VOL +]**。', panel: ['ALL', 'VOL+'], sim: { kind: 'mixer', on: false }, wait: '再长按 ALL 旋钮，点 [VOL +]…', act: { do: 'mixer', on: false } });
    lines.push(`${list(wet.map((tp) => label(tp.track)))} 往混响里送一点`);
  }
  if (!tasks.length) return null;
  return {
    type: 'do', title: '音色和效果：先改好几条轨道', role: 'sound',
    blocks: [
      '完整版改了几条轨道的样子。**先改这些、再做乐句**：弹法和单轨效果都存在音色里，先做了再换音色会被冲掉。',
      { list: lines },
      { callout: 'tip', text: '模拟机上：组合键都是先**长按**第一个键出现黑圈，再点第二个；[FX LEVEL] 按住往上推。模拟机的鼓轨只有一种声音，换鼓的音色那几项点一下就算。' },
    ],
    liveBlocks: [
      '完整版改了几条轨道的样子。**先改这些、再做乐句**：弹法和单轨效果都存在音色里，先做了再换音色会被冲掉。',
      { list: lines },
      { callout: 'warn', title: '这几样机器不一定告诉应用', text: '[MASTER/SINGLE] 拨在哪、[FX] 转到了哪一类、混音台，机器不上报：做完自己点“我已经做了 / 做好了”。换音色、八度、弹法应用读得出来。[FX] 往哪边转是往下走，一格一格转、看 Index 上的字。' },
    ],
    tasks,
    done: '几条轨道的样子都改好了。',
    coach: `完整版 ① 里先改轨道的样子：${lines.join('；').replace(/\*\*/g, '')}。换音色：选中轨道，按住 SOUND 旋钮（Sound Design 旋钮 1）再按方键跳类别，再转 SOUND 挑；八度：按住 [OCTAVE] 转 [ALL]；CHORD：Sound Design 旋钮 2；DUCKER：[MASTER/SINGLE] 拨 SINGLE、[FX] 转到 DUCKER、[FX LEVEL] 推（手册 3.12，单轨效果跟着音色走）；混音台：按住 [ALL] + [VOL+]，旋钮 3 = 送混响。`,
  };
}

/** 一段乐句的“做法”说成一句话（讲解里用） */
function howWord(pl, tp, no) {
  const T = tp.pats[no];
  const B = T.bars;
  const firstBars = pl.ops.find((o) => o.type === 'bars');
  const grow = pl.ops.some((o) => o.type === 'bars' && o.copied);
  if (pl.from) return `复制第 ${pl.from} 段，贴过来再改${pl.ops.filter((o) => o.type === 'bar').length ? `（改 ${pl.ops.filter((o) => o.type === 'bar').length} 页）` : ''}`;
  if (no === 1 && tp.start) return `在分轨那一段上直接改`;
  if (B === 1) return '从空白开始，一页就放下';
  if (grow) return `从空白开始：先做第 1${firstBars && firstBars.to > 1 && !pl.ops.some((o, i) => o.type === 'bar' && i < pl.ops.indexOf(firstBars)) ? '–' + firstBars.to : ''} 小节，按 [BAR LENGTH] 加长让机器照抄，再改不一样的`;
  return `从空白开始：先加长到 ${B} 小节，再一页页填`;
}

/** 一页（一小节）上要按的，说成一句话 */
function barText(tp, o, { flip, single }) {
  const where = flip ? '' : single ? '' : `第 ${o.b + 1} 页：`;
  if (tp.drum) {
    const parts = [];
    if (o.on.length === 16) parts.push('按亮**全部 16 个**方键');
    else if (o.on.length) parts.push(`按亮第 **${list(o.on.map(at))}** 个方键`);
    if (o.off.length) parts.push(`按灭第 **${list(o.off.map(at))}** 个（照抄过来、这里不要的）`);
    return `${where}${parts.join('；')}。`;
  }
  const parts = [];
  if (o.off.length) parts.push(`先按灭第 **${list(o.off.map(at))}** 个`);
  const byShift = new Map();
  for (const g of o.add) {
    if (!byShift.has(g.shift)) byShift.set(g.shift, []);
    byShift.get(g.shift).push(`按 **Synth key ${g.key}**，按亮第 **${list(g.steps.map(at))}** 个`);
  }
  for (const [sh, gs] of byShift) {
    if (!sh) parts.push(gs.join('；'));
    else parts.push(`八度${sh > 0 ? '升' : '降'}${ZH[Math.abs(sh)]}格（**按住 [OCTAVE] 转 [ALL]**），${gs.join('；')}，再${sh > 0 ? '降' : '升'}回来`);
  }
  for (const w of o.swap) parts.push(`${w.shift ? `八度${w.shift > 0 ? '升' : '降'}${ZH[Math.abs(w.shift)]}格，` : ''}**按住第 ${at(w.step)} 个步进键不放，再按 Synth key ${w.key}**（整个换成这个和弦）${w.shift ? '，再改回来' : ''}`);
  return `${where}${parts.join('；')}。`;
}

/** 一条轨道（或它的几段）的“做乐句”那一步 */
function trackStep(song, spec, tp, nos, plans, model, ctx, part) {
  const t = tp.track;
  const L = label(t);
  const tasks = [];
  const ms = model[t]; // 这条轨道在课里这一刻的样子：{ cur: 现在在第几段, si: 在不在步进输入, page }
  if (tp.drum) tasks.push(SELECT(t));
  for (const no of nos) {
    const pl = plans[t][no];
    const T = tp.pats[no];
    const P = no - 1;
    const exitSI = !tp.drum && ms.si;
    if (pl.from) {
      tasks.push({
        text: `${exitSI ? `先退出步进输入（**按住 [PAGE] 再按一下 ${L} 旋钮**，和进去一样的按法），再` : ''}**复制第 ${pl.from} 段**：**先按住 ${L} 旋钮不放**，再**长按**第 ${pl.from} 个方键 **2 秒**，小灯白色闪一下就好了。`,
        panel: [t, `DK${pl.from}`], sim: { kind: 'patterncopy', track: t, pattern: pl.from - 1 }, wait: `长按 ${L} 旋钮出现黑圈，再在第 ${pl.from} 个方键上按住 2 秒…`, liveWait: `按住 ${L} 旋钮，长按第 ${pl.from} 个方键 2 秒（做完点“我已经做了”）…`,
        act: { do: 'copy', track: t, from: pl.from, exitSI },
      });
      ms.si = false;
      tasks.push({
        text: `**贴到第 ${no} 段**：**先按住 ${L} 旋钮，再按住 [PAGE]**（左侧面从上往下第 6 个），两个都不放，按一下**第 ${no} 个**方键（它闪一下 = 贴好了）。`,
        panel: [t, 'PAGE', `DK${no}`], sim: { kind: 'patternpaste', track: t, pattern: P }, wait: `长按 ${L} 旋钮，点 [PAGE]，再点第 ${no} 个方键…`, liveWait: `按住 ${L} 和 [PAGE]，按第 ${no} 个方键（做完点“我已经做了”）…`,
        act: { do: 'paste', track: t, to: no },
      });
    }
    if (ms.cur !== no) {
      const steps = Math.abs(no - ms.cur);
      tasks.push({
        text: `${!tp.drum && ms.si ? `先退出步进输入（**按住 [PAGE] 再按一下 ${L} 旋钮**），再` : ''}**转** ${L} 旋钮，从第 ${ms.cur} 段转到**第 ${no} 段**（${steps === 1 ? '一格' : `${ZH[steps] || steps} 格`}）：${light(no)}。${!pl.from && !(no === 1) ? '这一段现在是空的。' : ''}`,
        panel: [t], detect: { kind: 'patternat', track: t, pattern: P }, wait: `在 ${L} 旋钮上往${no > ms.cur ? '上' : '下'}拖 ${steps} 格…`, liveWait: `转 ${L} 旋钮到第 ${no} 段，看小灯…`,
        act: { do: 'turn', track: t, to: no, exitSI: !tp.drum && ms.si },
      });
      ms.si = false;
      ms.cur = no;
      ms.page = 0;
    }
    if (!tp.drum && !ms.si) {
      tasks.push({ text: `进 ${L} 的步进输入：**先按住 [PAGE] 不放，再按一下 ${L} 旋钮**。`, panel: ['PAGE', t], detect: { kind: 'track', track: t }, sim: { kind: 'mode', mode: 'stepinput', track: t, on: true }, wait: `长按 [PAGE] 出现黑圈，再点 ${L} 旋钮…`, liveWait: `按住 [PAGE] 再按 ${L} 旋钮…`, act: { do: 'si', track: t, on: true } });
      ms.si = true;
      ms.page = 0;
    }
    // 这一段最后那一下（可能是改一页，也可能是按 [BAR LENGTH] 让机器照抄完）：核对整段一模一样
    const lastOp = pl.ops[pl.ops.length - 1];
    const whole = tp.drum ? { kind: 'patsteps', track: t, pattern: P, steps: sortedSteps(T), bars: T.bars }
      : tp.chord ? { kind: 'stepkeys', track: t, pattern: P, keys: keysOfContent(T), exact: true }
        : { kind: 'stepnotes', track: t, pattern: P, notes: notesOfContent(T), exact: true };
    for (const o of pl.ops) {
      if (o.type === 'bars') {
        const how = o.shorter
          ? `按 **[BAR LENGTH]**，轮到 **${o.to} 小节**（1 → 2 → 4 → 8 → 1 轮着换，要按 ${o.presses} 下）：后面那几小节没丢，只是不放了`
          : `按 **[BAR LENGTH]**${o.presses > 1 ? ` ${o.presses} 下` : ''}，加长到 **${o.to} 小节**${o.copied ? '：新加的小节，机器会照着前面的抄一份（手册 3.7.4）' : ''}`;
        tasks.push({
          text: `${how}。`, panel: ['BARLENGTH', 'METER'],
          ...(tp.drum ? { sim: o === lastOp ? whole : { kind: 'length', track: t, bars: o.to, pattern: P } } : { detect: { kind: 'length', track: t, bars: o.to, pattern: P }, ...(o === lastOp ? { sim: whole } : {}) }),
          wait: '点 [BAR LENGTH]…', liveWait: `按 [BAR LENGTH]，直到读数是 ${o.to} 小节…`, act: { do: 'bars', track: t, bars: o.to },
        });
        if (ms.page >= o.to) ms.page = 0;
        continue;
      }
      // 一页
      const flip = ms.page !== o.b;
      const last = o === lastOp;
      const from = o.b * 16;
      let sim;
      let detect;
      if (tp.drum) {
        const all = sortedSteps(T);
        sim = last ? { kind: 'patsteps', track: t, pattern: P, steps: all, bars: T.bars } : { kind: 'patsteps', track: t, pattern: P, steps: all, from, to: from + 16 };
        if (o.b === 0) detect = { kind: 'patsteps', track: t, pattern: P, steps: all.filter((s) => s < 16), from: 0, to: 16 };
      } else if (tp.chord) {
        sim = { kind: 'stepkeys', track: t, pattern: P, keys: last ? keysOfContent(T) : keysOfContent(T, from, from + 16), ...(last ? { exact: true } : { from, to: from + 16 }) };
      } else {
        sim = { kind: 'stepnotes', track: t, pattern: P, notes: last ? notesOfContent(T) : notesOfContent(T, from, from + 16), ...(last ? { exact: true } : { from, to: from + 16 }) };
      }
      const panel = [...(flip ? ['PAGE'] : []), ...(tp.drum ? [...o.on, ...o.off] : [...o.off, ...o.add.flatMap((g) => g.steps), ...o.swap.map((w) => w.step)]).map((s) => `DK${at(s)}`)];
      if (!tp.drum) panel.push(...new Set([...o.add, ...o.swap].map((g) => `SK${g.key}`)));
      if (!tp.drum && [...o.add, ...o.swap].some((g) => g.shift)) panel.push('OCTAVE', 'ALL');
      const head = flip ? `单按 [PAGE] 翻到**第 ${o.b + 1} 页**：` : '';
      const pageText = barText(tp, o, { flip, single: T.bars === 1 });
      const hasNotes = tp.drum ? o.on.length || o.off.length : o.off.length || o.add.length || o.swap.length;
      if (hasNotes) {
        tasks.push({
          text: `${head}${pageText}`, panel: [...new Set(panel)], sim, ...(detect ? { detect } : {}),
          wait: `${flip ? '短按 [PAGE] 翻页，' : ''}照着按…`, liveWait: tp.drum && o.b === 0 ? '照着按，方键的灯和屏幕上应该一样…' : undefined,
          act: tp.drum ? { do: 'drumpage', track: t, page: o.b, on: o.on, off: o.off, target: sortedSteps(T).filter((s) => s >= from && s < from + 16) } : { do: 'synthpage', track: t, page: o.b, off: o.off, add: o.add, swap: o.swap },
        });
      }
      if (!tp.drum && o.stretch.length) {
        const say = o.stretch.length === 1 ? `第 ${at(o.stretch[0].step)} 个拉到 **${o.stretch[0].len} 步**` : o.stretch.every((z) => z.len === o.stretch[0].len) ? `第 ${list(o.stretch.map((z) => at(z.step)))} 个都拉到 **${o.stretch[0].len} 步**` : o.stretch.map((z) => `第 ${at(z.step)} 个拉到 ${z.len} 步`).join('、');
        const first = o.stretch[0];
        tasks.push({
          text: `${hasNotes ? '' : head}把这一页的${tp.chord ? '和弦' : '长音'}拉到该有的长度：**按住那个步进键不放，转 [ALL]**（往上拉长、往下缩短），${say}。`,
          panel: [...new Set(o.stretch.map((z) => `DK${at(z.step)}`)), 'ALL'], sim: { kind: 'notelen', track: t, pattern: P, step: first.step, min: first.len },
          wait: '长按那个步进键出现黑圈，再拖 ALL 旋钮…', act: { do: 'stretch', track: t, page: o.b, stretch: o.stretch },
        });
      }
      ms.page = o.b;
    }
    // 一页都不用改的（比如复制过来正好一样）：也核对一下
    if (!pl.ops.length && pl.from) {
      tasks.push({ text: `这一段和第 ${pl.from} 段一样长、一样的音，不用改。`, panel: [t], sim: whole, act: { do: 'none' } });
    }
  }
  tasks.push(PLAY(`短按 [PLAY]（左侧面最下面）听：现在放的是 ${L} 的第 ${ms.cur} 段${nos.length > 1 ? `；放着的时候转 ${L} 旋钮，几段换着听` : ''}。`));
  tasks.push(STOP());
  const blocks = [
    `${part ? `${L} 的第 ${list(nos)} 段` : `${L} 要做第 ${list(nos)} 段`}${tp.start || nos[0] > 1 ? '' : '（完整版新加的轨道，第 1 段也是空的）'}：`,
    { list: nos.map((no) => `**第 ${no} 段**（${tp.pats[no].bars} 小节）：${tp.pats[no].role} ——${howWord(plans[t][no], tp, no)}。`) },
    ...nos.map((no) => ({ widget: 'arrpattern', song: song.id, track: t, no })),
    tp.drum
      ? { callout: 'tip', text: '鼓轨不用进步进输入：选中它，方键就是这一段的格子。超过 1 小节的段，**单按 [PAGE]** 翻页，一页 16 步。' }
      : { callout: 'tip', text: '步进输入里放进去的是“你最后按过的那个音”：先按 Synth key，再按步进键。同一个音连着放几下，按一次 Synth key 就够了。转旋钮换段之前，先退出步进输入（和进去一样：按住 [PAGE] 再按旋钮）。' },
  ];
  const live = [
    blocks[0], blocks[1], ...blocks.slice(2, 2 + nos.length),
    !tp.drum && { device: [`bars:${t}`] },
    { callout: 'warn', text: tp.drum ? '应用读得到每条轨道在第几段、这一段**第 1 页**的格子；复制粘贴、长度、第 2 页以后的格子读不出来，那几项做完自己点“做好了 / 我已经做了”。' : `应用读得到 ${L} 在第几段、这一段有几小节；复制粘贴、步进输入、格子里放的音读不出来，那几项做完自己点“做好了 / 我已经做了”。${PAGE_LIGHTS}` },
    blocks[blocks.length - 1],
  ].filter(Boolean);
  const plansWord = nos.map((no) => `第 ${no} 段 ${tp.pats[no].bars} 小节：${howWord(plans[t][no], tp, no)}`).join('；');
  return {
    type: 'do', title: `${L}：第 ${list(nos)} 段`, role: 'track', track: t, nos,
    blocks, liveBlocks: live, tasks,
    done: `${L} 的第 ${list(nos)} 段做好了。`,
    coach: `完整版 ①《${song.title}》：学生在做 ${L} 的乐句（${tp.drum ? '鼓轨' : tp.chord ? 'CHORD 弹法' : '单音'}${tp.drum ? '' : `，OCTAVE ${signed(tp.oct)}`}）。${plansWord}。做法：换段 = 转轨道旋钮（3 个小灯：黄 = 第 1–3 段，青蓝 = 第 4–6 段，上中下）；复制 = 按住轨道旋钮长按方键 2 秒；粘贴 = 按住轨道旋钮和 [PAGE] 再按目标方键；[BAR LENGTH] 1 → 2 → 4 → 8 → 1，加长时新的小节照抄前面的；单按 [PAGE] 翻页${tp.drum ? '' : '；合成器轨要先按住 [PAGE] + 旋钮进步进输入，先按 Synth key 再按步进键，按住步进键转 [ALL] 改音长'}。真机上应用读得出在第几段${tp.drum ? '、第 1 页的格子' : '、几小节'}，别的要他自己点“做好了”。`,
  };
}

function wrapStep(song, arr, plan, ctx) {
  const rows = plan.map((tp) => `**${label(tp.track)}**：${Object.keys(tp.pats).map((no) => `${no}${tp.used.has(Number(no)) ? '' : '（没用上）'}`).join(' / ')}`);
  return {
    type: 'read', title: '料都备齐了', role: 'wrap',
    blocks: [
      `《${song.title}》完整版要用的乐句都在机器里了。每条轨道有这几段：`,
      { list: rows },
      `下一节课把它们排成 ${arr.scenes.length} 个 scene（前奏、主歌……每一段放哪几条、各放第几段），在 Song 模式里从头演一遍。`,
      { callout: 'warn', text: '机器关机时会自动保存；换工程之前也可以先用临时保存（第 7.4 课）。别用 [DELETE] + 旋钮：那会清掉这条轨道当前这一段。' },
    ],
    coach: `完整版 ①《${song.title}》做完了：每条轨道的乐句都在机器里。下一节是 ②：Song 模式排 ${arr.scenes.length} 个 scene、从头放一遍。`,
  };
}

// ───────────── ② 排成一首 ─────────────

/** 每个 scene 在机器上的样子：每条（完整版用到的）轨道放第几段（0 起）、谁静音、多长；和要不要自己设长度 */
function sceneStates(spec, arr, plan) {
  const tl = arrangementTimeline(arr);
  const tracks = plan.map((tp) => tp.track);
  const pat = Object.fromEntries(tracks.map((t) => [t, 0]));
  return tl.map((sc) => {
    for (const t of tracks) if (sc.play[t]) pat[t] = sc.play[t] - 1; // 静音的轨道就停在上一个 scene 的那一段
    const mute = tracks.filter((t) => !sc.play[t]);
    const barsOf = (t) => plan.find((tp) => tp.track === t).pats[pat[t] + 1]?.bars || 1;
    const autoAll = Math.max(1, ...tracks.map(barsOf)) * 16;
    const playing = tracks.filter((t) => sc.play[t]);
    const autoOn = Math.max(1, ...(playing.length ? playing : tracks).map(barsOf)) * 16;
    return { ...sc, pat: { ...pat }, mute, needLen: !(sc.steps === autoAll && sc.steps === autoOn) };
  });
}

function sceneTable(states) {
  return states.map((sc, i) => `**scene ${i + 1}「${sc.name}」**（${lenWord(sc.steps)}）：${Object.entries(sc.play).map(([t, n]) => `${label(t)} 第 ${n} 段`).join('、') || '全部静音'}`);
}

function arrListen(song, arr, states) {
  return {
    type: 'read', title: '排法：一个 scene 一段', role: 'listen',
    blocks: [
      `《${song.title}》完整版在机器上是 **${states.length} 个 scene**，Song 模式从 scene 1 一个个往下放。先听一遍：`,
      { widget: 'arrangement', song: song.id },
      '每个 scene 记着三样：**每条轨道放第几段**、**谁静音**（这一段里不响的那几条）、**多长**。没写的轨道在这个 scene 里静音：',
      { list: sceneTable(states) },
      { callout: 'theory', text: '加 scene 的规矩（第 6.3 课）：Song 模式里**按一个不亮的方键**，就加一个新的，它**先照抄选中的那个**。所以排的时候每次只改和上一个不一样的地方：换几条轨道的段、静音几条、放出来几条，长度不对再改长度。' },
      { callout: 'tip', text: '静音的轨道停在哪一段不要紧（它不响），所以课里不让你转它。' },
    ],
    coach: `完整版 ②《${song.title}》：用 Song 模式排 ${states.length} 个 scene。${sceneTable(states).join('；').replace(/\*\*/g, '')}。`,
  };
}

function arrPrep(song, spec, plan, ctx) {
  const tracks = plan.map((tp) => tp.track);
  const scale = SCALES[spec.scale];
  return {
    type: 'do', title: '准备：从“大家都在第 1 段”开始', role: 'prep',
    blocks: [
      'scene 1 照抄的是进 Song 模式那一刻机器的样子。先让每条轨道都回到第 1 段、都出声，再进 Song 模式。',
      { callout: 'tip', text: '模拟机已经在 5 号工程里摆好了上一节课备的全部乐句。组合键：先长按第一个键出现黑圈，再点第二个。' },
    ],
    liveBlocks: [
      'scene 1 照抄的是进 Song 模式那一刻机器的样子。先让每条轨道都回到第 1 段、都出声，再进 Song 模式。',
      { callout: 'warn', text: `用的是上一节课备好料的那个工程（5–8 号）。Song 模式、加 scene、scene 长度，机器报不报给应用还不知道：没打勾就点“我已经做了”。每条轨道在第几段、静音了没有，应用读得出来。` },
      { device: ['project', 'tempo'] },
    ],
    tasks: [
      { text: '在备好料的那个工程里（5–8 号：**按住 [PROJECT↑] 再按上排第 5–8 个方键**）。', panel: ['PROJECT', 'DK5'], detect: { kind: 'project', in: [4, 5, 6, 7] }, wait: '长按 [PROJECT↑] 出现黑圈，再点上排第 5 个方键…', liveWait: '等你在备好料的那个工程…', act: { do: 'project' } },
      ctx.six && { text: '这首要用到第 4 段以上：确认每条轨道是 **6 段**（按住 KICK 旋钮时方键 4–6 是白色的）。上一节课换过了会自己打勾；是蓝色的就按一下第 4 个方键（还按着 KICK）。', panel: ['KICK', 'DK4', 'DK5', 'DK6'], detect: { kind: 'patmode', six: true }, wait: '长按 KICK 旋钮出现黑圈，再点第 4 个方键…', liveWait: '按住 KICK 旋钮，看方键 4–6 是不是白色…', act: { do: 'patmode' } },
      { text: `**转 [ALL] 旋钮**（鼓区左上角），让 11 条轨道都回到**第 1 段**（各个旋钮旁边亮的小灯都在最上面、黄色）。`, panel: ['ALL'], detect: { kind: 'combo', pat: Object.fromEntries(tracks.map((t) => [t, 0])) }, wait: '在 ALL 旋钮上往下拖…', liveWait: '转 [ALL]，让大家都回到第 1 段…', act: { do: 'allpat', to: 1 } },
      { text: '**按住 [MUTE]**（左侧面第 4 个）**不放，再按 [ALL] 旋钮**：一次取消全部静音（本来就没有静音的会自己打勾）。', panel: ['MUTE', 'ALL'], detect: { kind: 'combo', unmute: tracks }, wait: '长按 [MUTE] 出现黑圈，再点 ALL 旋钮…', liveWait: '按住 [MUTE] 再按 [ALL]…', act: { do: 'unmuteall' } },
      { text: '进 **Song 模式**：**先按住 [ALL] 旋钮不放，再按 [PROJECT↑]**（右侧面最下面）。Index 最下面的 **SONG** 亮了就对了。', panel: ['ALL', 'PROJECT', 'INDEX'], sim: { kind: 'songmode', mode: 1 }, wait: '长按 ALL 旋钮出现黑圈，再点 [PROJECT↑]…', liveWait: '按住 [ALL] 再按 [PROJECT↑]（看 SONG 亮；做完点“我已经做了”）…', act: { do: 'songmode', mode: 1 } },
      { text: '看第 1 个方键：亮**紫色** = scene 1 已经有了、是选中的。**不亮**就按一下它，加上第一个 scene（以前在这个工程里排过 scene 的话，按住 [DELETE] 再按亮红色的方键，删到只剩一个）。', panel: ['DK1'], sim: { kind: 'sceneat', index: 0 }, wait: '第 1 个方键亮紫色就对了…', liveWait: '第 1 个方键亮紫色了吗？（不亮就按一下；做完点“我已经做了”）', act: { do: 'scene', index: 0 } },
    ].filter(Boolean),
    done: `准备好了：scene 1 现在是“大家都在第 1 段”，接下来一个个改。${spec.bpm} BPM、${pretty(KEY_NAMES[spec.key])} ${scale.zh}。`,
    coach: `完整版 ② 的准备：在备好料的工程里，转 [ALL] 让 11 条轨道回到 pattern 1，按住 [MUTE] + [ALL] 取消全部静音，再按住 [ALL] + [PROJECT↑] 进 Song mode（Index SONG 亮）。Drum key 1 紫色 = scene 1（没有 scene 时不亮，要按一下加上；以前排过的用 [DELETE] + 方键删）。`,
  };
}

/** 排几个 scene 的那一步 */
function scenesStep(song, states, from, to, plan, prevOf) {
  const tasks = [];
  for (let i = from; i < to; i++) {
    const sc = states[i];
    const prev = prevOf(i);
    const n = i + 1;
    if (i > 0) {
      tasks.push({ text: `按第 **${n}** 个方键（不亮的那个）：**加 scene ${n}**，它先照抄 scene ${i}。这个是「${sc.name}」。`, panel: [`DK${n}`], sim: { kind: 'sceneat', index: i }, wait: `点第 ${n} 个方键…`, liveWait: `按第 ${n} 个方键（它变紫 = 加好了；做完点“我已经做了”）…`, act: { do: 'scene', index: i } });
    }
    const changes = Object.entries(sc.play).filter(([t, no]) => prev.pat[t] !== no - 1);
    if (changes.length) {
      tasks.push({
        text: `scene ${n}「${sc.name}」换段：${list(changes.map(([t, no]) => `**${label(t)}** 转到第 ${no} 段`))}（转那条轨道的旋钮，看小灯）。`,
        panel: changes.map(([t]) => t), detect: { kind: 'combo', scene: i, pat: Object.fromEntries(changes.map(([t, no]) => [t, no - 1])) },
        wait: '转那几条轨道的旋钮…', liveWait: '转那几条轨道的旋钮，看屏幕上的段号…', act: { do: 'scenepat', pat: Object.fromEntries(changes.map(([t, no]) => [t, no])) },
      });
    }
    const mute = sc.mute.filter((t) => !prev.mute.includes(t));
    const unmute = prev.mute.filter((t) => !sc.mute.includes(t));
    if (mute.length || unmute.length) {
      const say = [mute.length && `静音 ${list(mute.map((t) => `**${label(t)}**`))}`, unmute.length && `把 ${list(unmute.map((t) => `**${label(t)}**`))} 放出来`].filter(Boolean).join('，');
      tasks.push({
        text: `scene ${n}「${sc.name}」：${say}——都是**先按住 [MUTE] 不放，再按那条轨道的旋钮**（静音的灯变绿，再按一次就回来）。`,
        panel: ['MUTE', ...mute, ...unmute], detect: { kind: 'combo', scene: i, mute: sc.mute, unmute: plan.map((tp) => tp.track).filter((t) => !sc.mute.includes(t)) },
        wait: '长按 [MUTE] 出现黑圈，再点轨道旋钮（一条一条来）…', liveWait: '按住 [MUTE] 再按那几条轨道的旋钮…', act: { do: 'mute', mute, unmute },
      });
    }
    if (sc.needLen) {
      const bars = sc.steps % 16 === 0;
      tasks.push({
        text: bars
          ? `scene ${n} 的长度设成 **${sc.steps / 16} 小节**：**先按住 [PAGE] 不放，再按下 [ALL] 旋钮转**（按下去转 = 一次一小节），看右边那列小灯亮到第 ${sc.steps / 16} 格。`
          : `scene ${n} 的长度设成 **${sc.steps / 4} 拍**（${sc.steps} 步）：**先按住 [PAGE] 不放，再转 [ALL] 旋钮**（不按下去转 = 一次一步），转到方键亮 ${sc.steps} 个。`,
        panel: ['PAGE', 'ALL', 'METER'], sim: { kind: 'scenelen', index: i, steps: sc.steps }, wait: `长按 [PAGE] 出现黑圈，再拖 ALL 旋钮到 ${lenWord(sc.steps)}…`, liveWait: `按住 [PAGE] 转 [ALL] 到 ${lenWord(sc.steps)}（做完点“我已经做了”）…`,
        act: { do: 'scenelen', steps: sc.steps },
      });
    }
    if (i > 0 && !changes.length && !mute.length && !unmute.length && !sc.needLen) {
      tasks.push({ text: `scene ${n}「${sc.name}」和 scene ${i} 一模一样（16 小节的一段拆成两个），不用改。`, panel: [`DK${n}`], sim: { kind: 'sceneat', index: i }, act: { do: 'none' } });
    }
  }
  const names = states.slice(from, to).map((sc) => sc.name);
  return {
    type: 'do', title: `排 scene ${to - from > 1 ? `${from + 1}–${to}` : to}：${[...new Set(names)].join('、')}`, role: 'scenes', from, to,
    blocks: [
      `一个个加、一个个改。每个 scene 放什么：`,
      { list: sceneTable(states).slice(from, to) },
      { callout: 'tip', text: '模拟机上：方键就是 scene（白 = 有，紫 = 选中）；静音是长按 [MUTE] 出现黑圈再点旋钮；改长度是长按 [PAGE] 出现黑圈，再上下拖 ALL 旋钮（模拟机上一格一小节，不到一小节时一格一拍，转到最左是 AUTO）。' },
    ],
    liveBlocks: [
      `一个个加、一个个改。每个 scene 放什么：`,
      { list: sceneTable(states).slice(from, to) },
      { callout: 'warn', text: '加 scene、改长度机器不一定告诉应用：没打勾就点“我已经做了”。选中一个 scene 时，每条轨道在第几段、静音了没有应用读得出来——换段、静音那几项会自己打勾。按 [PAGE] + [ALL] 时 scene 是 AUTO 长度的话，方键全亮青蓝。' },
    ],
    tasks,
    done: `scene ${to - from > 1 ? `${from + 1}–${to}` : to} 排好了。`,
    coach: `完整版 ②《${song.title}》：学生在 Song mode 里排 scene ${from + 1}–${to}。${sceneTable(states).slice(from, to).join('；').replace(/\*\*/g, '')}。做法：按不亮的 Drum key 加 scene（照抄选中的）；转轨道旋钮换段（记进选中的 scene）；按住 [MUTE] 再按旋钮静音 / 取消；scene 长度：按住 [PAGE] 转 [ALL]（按下转 = 一小节一格，不按下 = 一步一格；转到最左 = AUTO，手册 3.14.8）。机器报不报加 scene、长度不知道；轨道在第几段、静音应用读得出。`,
  };
}

/** 从头放一遍：现场转滤波器 */
function playStep(song, arr, states) {
  const moved = states.filter((sc) => sc.moves);
  const tasks = [
    { text: '按**第 1 个方键**，选中 scene 1（它变紫）。', panel: ['DK1'], sim: { kind: 'sceneat', index: 0 }, wait: '点第 1 个方键…', liveWait: '按第 1 个方键（做完点“我已经做了”）…', act: { do: 'scene', index: 0 } },
  ];
  // 第一个要转滤波器的轨道：先翻到第 2 页、把它的滤波器摆到开始的位置
  const firstMove = moved[0] && Object.entries(moved[0].moves)[0];
  if (firstMove) {
    const [t, [a, b]] = firstMove;
    tasks.push(SELECT(t));
    tasks.push({ text: '右边 4 个旋钮翻到**第 2 页**：**单按**翻页键（那一列旋钮正下方、印着三个小点），那列小灯从上往下**第 2 个**亮。', panel: ['SDPAGE', 'METER'], detect: { kind: 'sdpage', page: 1 }, wait: '单按一下翻页键…', liveWait: '单按翻页键，翻到第 2 页…', act: { do: 'sdpage', page: 1 } });
    if (b > a || a === b) {
      tasks.push({ text: `先把 ${label(t)} 的滤波器（第 2 页**第 3 个**旋钮，FILTER）**往闷的那边转到快到头**：一会儿「${moved[0].name}」里再慢慢打开。`, panel: ['SD3', 'INDEX'], sim: { kind: 'param', track: t, param: 'cutoff', atMost: -40 }, live: { kind: 'param', track: t, param: 'cutoff', dir: -1, by: 20 }, wait: '把第 3 个旋钮往下拖到快到头…', liveWait: '往闷的那边转（没打勾就点“我已经做了”）…', act: { do: 'cutoff', track: t, to: -48 } });
    }
  }
  tasks.push(PLAY(`短按 [PLAY]：从 scene 1 开始，一个个往下放（整首约 ${Math.round(states.reduce((n, s) => n + s.steps, 0) * 15 / SONG_PARTS[song.id].bpm)} 秒）。`));
  let sel = firstMove?.[0];
  // 每条轨道的滤波器上一次停在哪（赫兹；没转过 = 全开）：这一段要从闷开始、而它现在是亮的，进这一段先往闷的那边转一大截
  const lastAt = {};
  if (firstMove) lastAt[firstMove[0]] = firstMove[1][0];
  for (const sc of moved) {
    const [t, [a, b]] = Object.entries(sc.moves)[0];
    const was = lastAt[t] ?? 16000;
    lastAt[t] = b;
    if (a * 3 < was) {
      tasks.push({
        text: `「${sc.name}」（scene ${sc.i + 1}）一开始：${sel === t ? '' : `先按一下 **${label(t)} 旋钮**选中它（第 2 页还在），`}把 ${label(t)} 的滤波器（第 2 页第 3 个旋钮）**往闷的那边转一大截**——这一段从闷开始。`,
        panel: [t, 'SD3', 'INDEX'], sim: { kind: 'param', track: t, param: 'cutoff', dir: -1, by: 24 }, live: { kind: 'param', track: t, param: 'cutoff', dir: -1 },
        wait: '往下拖第 3 个旋钮…', liveWait: '往闷的那边转（没打勾就点“我已经做了”）…', act: { do: 'cutoff', track: t, by: -32, select: sel !== t },
      });
      sel = t;
    }
    const others = Object.keys(sc.moves).slice(1);
    const end = b >= 9000 ? '差不多全开' : b >= 3000 ? '开到一大半' : b >= 1200 ? '开到一半' : '还是有点闷';
    const shut = b <= 400 ? '几乎关死' : b <= 1500 ? '很闷' : '暗下来一些';
    const word = a === b ? '转到一半就不动（压暗）' : b > a ? `**慢慢往亮的那边转**，到这一段结束时${end}` : `**慢慢往闷的那边转**，到这一段结束时${shut}`;
    const pre = sel === t ? '' : `先按一下 **${label(t)} 旋钮**选中它（第 2 页还在），`;
    const needSel = sel !== t;
    sel = t;
    tasks.push({
      text: `放到「${sc.name}」（scene ${sc.i + 1}）：${pre}${label(t)} 的滤波器（第 2 页第 3 个旋钮）${word}。${others.length ? `（完整版里 ${list(others.map(label))} 也一起${b > a ? '开' : '关'}；只有两只手，先转 ${label(t)} 就够了。）` : ''}`,
      panel: [t, 'SD3', 'INDEX'], sim: { kind: 'param', track: t, param: 'cutoff', ...(a === b ? { near: -20, within: 16 } : { dir: b > a ? 1 : -1, by: 24 }) }, live: { kind: 'param', track: t, param: 'cutoff', ...(a === b ? { near: -20, within: 16 } : { dir: b > a ? 1 : -1 }) },
      wait: `${b >= a ? '往上' : '往下'}拖第 3 个旋钮…`, liveWait: '一边听一边转（没打勾就点“我已经做了”）…',
      act: { do: 'cutoff', track: t, select: needSel, ...(a === b ? { to: -20 } : { by: b > a ? 28 : -28 }) },
    });
  }
  tasks.push(STOP('整首放完会自己停（没停就按 [PLAY] 停下）。'));
  return {
    type: 'do', title: '从头放一遍，边放边转滤波器', role: 'play',
    blocks: [
      `排好了：从 scene 1 按 [PLAY]，机器一个个往下放。完整版里还有几处**现场动作**：在某几段里慢慢转一条轨道的滤波器（右边 4 个旋钮第 2 页的第 3 个），让声音由闷变亮、或者由亮变闷：`,
      { list: moved.map((sc) => `**${sc.name}**：${Object.entries(sc.moves).map(([t, [a, b]]) => `${label(t)} ${a === b ? '压暗不动' : b > a ? '慢慢打开' : '慢慢关上'}`).join('、')}`) },
      { callout: 'tip', text: '模拟机上：滤波器往下拖是闷、往上拖是亮。放的时候可以先只听，第二遍再动手。' },
    ],
    liveBlocks: [
      `排好了：从 scene 1 按 [PLAY]，机器一个个往下放。完整版里还有几处**现场动作**：在某几段里慢慢转一条轨道的滤波器（右边 4 个旋钮第 2 页的第 3 个），让声音由闷变亮、或者由亮变闷：`,
      { list: moved.map((sc) => `**${sc.name}**：${Object.entries(sc.moves).map(([t, [a, b]]) => `${label(t)} ${a === b ? '压暗不动' : b > a ? '慢慢打开' : '慢慢关上'}`).join('、')}`) },
      { callout: 'warn', title: '滤波器：应用不一定看得见', text: '滤波器转到哪，应用读不出来，只有机器自己发出控制信号才认得出（第 4 章说过）：转着听就行，没打勾就点“我已经做了”。往哪边是闷，手册没写——第 4.2 课转着听过的那边。' },
      { callout: 'tip', text: '想现场多放几遍某一段：放着的时候**双击**它的方键，就一直循环它（紫色和青蓝交替闪）；再按一下它就接着往下放（手册 3.14.5）。两只手忙不过来的话，可以按住录音键把滤波器转一遍录进那段乐句（Motion，手册 3.6.3），以后每次放都会自己转。' },
    ],
    tasks,
    done: `《${song.title}》完整版，在你的机器上从头到尾演了一遍。`,
    coach: `完整版 ②《${song.title}》的最后一步：Song mode 从 scene 1 按 [PLAY] 放整首，边放边转滤波器（选中轨道，Sound Design 第 2 页旋钮 3 FILTER）：${moved.map((sc) => `${sc.name} ${Object.entries(sc.moves).map(([t, [a, b]]) => `${TRACK[t].label} ${a === b ? '压暗' : b > a ? '开' : '关'}`).join('、')}`).join('；')}。播放中双击 scene 的 Drum key = 循环它（3.14.5）；也可以用 Motion Recording 把旋钮录进乐句（3.6.3）。真机上滤波器只能靠机器发 CC 才认得出。`,
  };
}

function arrWrap(song, arr) {
  return {
    type: 'read', title: '演出小贴士', role: 'wrap',
    blocks: [
      `《${song.title}》在机器上是一首完整的歌了：前奏一层层进来，铺垫推上去，${arr.scenes.some((s) => s.kind === 'drop') ? 'Drop 炸开' : '副歌最满'}，最后退下去。`,
      { list: [
        '**Song 模式**照着排好的放；**Scene 模式**（再按一次 [ALL] + [PROJECT↑]）只循环选中的那个，你按方键决定下一段——想让前奏多铺一会儿就多放几圈（第 6.3 课）。',
        '某一段没排对：在 Song 模式里按它的方键选中，再转旋钮、静音来改。',
        '现场想临时抽掉一条：**静音模式**（[ALL] + [MUTE]）里直接按旋钮就是静音 / 放出来（第 7.3 课）。',
        '演之前先临时保存（第 7.4 课），演砸了一键回来。',
      ] },
      { callout: 'dj', text: '这就是一套“自己的 Live Set”：和打碟一样，一首歌的能量曲线在你手里——只是这一次，每一层都是你自己搭的。' },
    ],
    coach: `完整版 ②《${song.title}》做完了：学生在 Song mode 里排好、演了一遍。可以建议他用 Scene mode 现场演、或者改编一段（比如前奏多放一圈、换一条乐句）。`,
  };
}

// ───────────── 生成一首歌的两节课 ─────────────

function arrangementLessons(song) {
  const spec = SONG_PARTS[song.id];
  const arr = ARRANGEMENTS[song.id];
  const plan = machinePlan(song, spec, arr);
  const most = Math.max(...plan.map((tp) => Math.max(...Object.keys(tp.pats).map(Number))));
  const six = most > 3;

  // ① 每条轨道要做哪几段、怎么做
  const plans = {};
  const work = {};
  const built = {}; // 课结束时每条轨道每一段的样子（模拟机摆 ② 的时候用）
  for (const tp of plan) {
    const t = tp.track;
    plans[t] = {};
    work[t] = [];
    built[t] = {};
    const have = new Map(); // 已经做好的段（复制的来源）
    if (tp.start) {
      have.set(1, tp.start);
      built[t][1] = tp.start;
    }
    for (const no of Object.keys(tp.pats).map(Number).sort((a, b) => a - b)) {
      const T = tp.pats[no];
      if (no === 1 && tp.start) {
        // 分轨那一段：完整版要是改了它（音不一样），就在它上面直接改
        const pl = runPath(tp.start, T, tp.start.bars);
        if (pl.cost) {
          plans[t][1] = { ...pl, from: null };
          work[t].push(1);
        }
        have.set(1, pl.result);
        built[t][1] = pl.result;
        continue;
      }
      const pl = planPattern(T, [...have].filter(([n]) => n !== no));
      pl.src = pl.from ? have.get(pl.from) : null;
      plans[t][no] = pl;
      work[t].push(no);
      have.set(no, pl.result);
      built[t][no] = pl.result;
    }
  }
  const pages = Object.values(plans).flatMap((p) => Object.values(p)).reduce((n, pl) => n + pl.cost, 0);
  const minutes = Math.round((10 + pages * 0.12) / 5) * 5;
  const ctx = { six, most, work, minutes };

  // 每条轨道一步；太长的按乐句拆开
  const model = Object.fromEntries(plan.map((tp) => [tp.track, { cur: 1, si: false, page: 0 }]));
  const trackSteps = [];
  const order = [...plan].sort((a, b) => (a.drum === b.drum ? ORDER.indexOf(a.track) - ORDER.indexOf(b.track) : a.drum ? -1 : 1));
  for (const tp of order) {
    const nos = work[tp.track];
    if (!nos.length) continue;
    const trial = trackStep(song, spec, tp, nos, plans, { [tp.track]: { ...model[tp.track] } }, ctx, false);
    if (trial.tasks.length <= SPLIT || nos.length === 1) trackSteps.push(trackStep(song, spec, tp, nos, plans, model, ctx, false));
    else {
      // 一段一段来；连着几段加起来不长的放在一起
      let group = [];
      const flush = () => {
        if (group.length) trackSteps.push(trackStep(song, spec, tp, group, plans, model, ctx, true));
        group = [];
      };
      for (const no of nos) {
        const probe = trackStep(song, spec, tp, [...group, no], plans, { [tp.track]: { ...model[tp.track] } }, ctx, true);
        if (group.length && probe.tasks.length > SPLIT) flush();
        group.push(no);
      }
      flush();
    }
  }

  // 模拟机：① 开头摆分轨那一段（第 1 段；完整版加的轨道是空的）；中途接着学的话，前面几步做好的段也摆上
  const startPats = Object.fromEntries(plan.filter((tp) => tp.start).map((tp) => [tp.track, { 1: tp.start }]));
  const soundAt = 2; // 第几步之后八度换成了完整版的
  const steps1 = [listenStep(song, spec, arr, plan, ctx), prepStep(song, spec, arr, plan, ctx), soundStep(song, spec, arr, plan), ...trackSteps, wrapStep(song, arr, plan, ctx)].filter(Boolean);
  const hasSound = steps1[2]?.role === 'sound';
  const seed1 = (index) => {
    const out = {};
    for (const [t, ps] of Object.entries(startPats)) out[t] = { ...ps };
    for (const st of steps1.slice(0, index)) if (st.role === 'track') for (const no of st.nos) (out[st.track] ??= {})[no] = built[st.track][no];
    const after = hasSound && index > soundAt;
    return seedSpec(spec, plan, out, { octOf: (tp) => (after ? tp.oct : tp.startOct), slots: six && index > 1 ? 6 : 3 });
  };

  const back = { href: `#/songs/${song.id}/full`, label: `← ${song.title} 完整版`, done: `回到《${song.title}》完整版`, nav: 'songs' };
  const one = {
    id: `arr-${song.id}-1`, song: song.id, arrangement: 1, no: song.title, title: '完整版 ① 备料：把每段乐句做出来',
    minutes, simProject: 4, simFresh: true, simSeed: seed1, back, generated: 'arrangement',
    summary: `在搭好《${song.title}》分轨的工程里，把完整版要用的其余乐句做出来：${six ? '换成 6 段乐句，' : ''}复制粘贴、加长让机器照抄、一页页改。`,
    takeaway: `做新的一段乐句，先想“它和哪一段像”：像就**复制**过来再改（按住旋钮长按方键 2 秒；按住旋钮和 [PAGE] 再按目标方键）；不像就从空白做，**先做第 1 小节、按 [BAR LENGTH] 加长**，机器会照着抄，再一页页改不一样的。${six ? '每条轨道出厂只有 3 段，按住轨道旋钮按亮蓝色的方键 4–6 换成 6 段。' : ''}转旋钮换段之前，合成器轨先退出步进输入。`,
    homework: '用转旋钮的办法把每条轨道的几段换着听一遍：同一条轨道，主歌那段和 Drop 那段差在哪？',
    steps: steps1,
  };

  // ② 排成一首
  const states = sceneStates(spec, arr, plan);
  const startState = { pat: Object.fromEntries(plan.map((tp) => [tp.track, 0])), mute: [] };
  const prevOf = (i) => (i === 0 ? startState : states[i - 1]);
  const groups = [];
  let cur = [];
  const cost = (i) => 1 + (Object.entries(states[i].play).some(([t, n]) => prevOf(i).pat[t] !== n - 1) ? 1 : 0) + (states[i].mute.join() !== prevOf(i).mute.join() ? 1 : 0) + (states[i].needLen ? 1 : 0);
  let load = 0;
  states.forEach((_, i) => {
    if (cur.length && (load + cost(i) > 10 || cur.length >= 4)) {
      groups.push(cur);
      cur = [];
      load = 0;
    }
    cur.push(i);
    load += cost(i);
  });
  if (cur.length) groups.push(cur);
  const seed2 = () => seedSpec(spec, plan, built, { octOf: (tp) => tp.oct, slots: six ? 6 : 3 });
  const two = {
    id: `arr-${song.id}-2`, song: song.id, arrangement: 2, no: song.title, title: '完整版 ② 排成一首、从头演一遍',
    minutes: 15 + states.length * 3, simProject: 4, simFresh: true, simSeed: seed2, back, generated: 'arrangement',
    summary: `用 Song 模式把《${song.title}》排成 ${states.length} 个 scene，从头放一遍，边放边转滤波器。`,
    takeaway: `一个 scene = **每条轨道放第几段 + 谁静音 + 多长**。Song 模式里按不亮的方键加一个（照抄选中的），只改不一样的地方：转旋钮换段、按住 [MUTE] 再按旋钮静音、按住 [PAGE] 转 [ALL] 改长度。排完从 scene 1 按 [PLAY]，机器一个个往下放；现场再转转滤波器，就是一场演出。`,
    homework: '换到 Scene 模式（再按一次 [ALL] + [PROJECT↑]），自己决定什么时候换段：前奏多铺两圈，Drop 前空一下再进。',
    steps: [
      arrListen(song, arr, states),
      arrPrep(song, spec, plan, ctx),
      ...groups.map((g) => scenesStep(song, states, g[0], g[g.length - 1] + 1, plan, prevOf)),
      playStep(song, arr, states),
      arrWrap(song, arr),
    ],
  };
  one.next = two.id;
  return [one, two];
}

export const ARR_LESSONS = SONGS.filter((s) => ARRANGEMENTS[s.id] && SONG_PARTS[s.id]).flatMap(arrangementLessons);

/** 这首歌的完整版配的课（两节；没有就是空的） */
export const arrangementLessonsFor = (songId) => ARR_LESSONS.filter((l) => l.song === songId);
