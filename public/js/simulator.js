// 屏幕上的模拟 SEQTRAK：能点、能长按、能转，会亮灯、会出声，而且每做一个动作，都用一句话告诉你刚才发生了什么。
// 行为照官方手册的基础操作来做（docs/seqtrak-operation-reference.md），只覆盖前几章会用到的部分。
// 和真机的差别：鼓轨只有一种音色；“按住”用长按锁定来代替。乐句：每条轨道 3 段，按住轨道旋钮按蓝色的方键 4–6 换成 6 段（整个工程一起换，
// 和用户那台真机上实测的 30 40 79 一样是工程级的）；每段 1–8 小节（[BAR LENGTH]，V2.00 起鼓轨也能用），超过 16 步单按 [PAGE] 翻页。
// 第 3 章加进来的：合成器轨的 单音 / 复音 / 和弦（Sound Design 旋钮 2）、把和弦放进格子、按住步进键改音长或换和弦、
// [BAR LENGTH] 把乐句加长到 2 小节、[PAGE] 翻页。弹法跟着音色走（换音色会把 CHORD 冲掉）这一点照真机实测做了。
// 第 4 章加进来的（合成与音色设计）：三条合成器轨真的能换音色（每一类几个“模拟”音色，DX 的都是 FM 的）；
// 右边 4 个旋钮的翻页（单按翻页键在第 1、2 页之间换，长按 2 秒进出进阶设置，进阶里合成器轨 4 页、DX 5 页）；
// 第 2 页的起音、衰减、滤波器、共鸣和 DX 第 5 页的 FM 三样真的会改声音；按住 [ALL] 再按 SOUND 旋钮存音色（名字加 _edit01）；
// [UNDO/REDO]；[MASTER/SINGLE] 拨到 SINGLE 时，[FX] 旋钮的 MODULATION 那一类加在选中的轨道上会让它摆起来。
// 和真机一样：拧过的这些都跟着音色走，换了音色就换成新音色自己的样子。声音是应用自己合成的近似，不是真机的音色。
// 第 5–7 章加进来的：
//   采样（第 5 章）：SAMPLER 的 7 个采样位、选位、[REC SAMPLE] 录一段（模拟机不用麦克风，录到的是 sim-samples.js 里现做的几段声音之一）、
//     长按 [REC SAMPLE] 2 秒换采样源（含重采样）、第 1 页旋钮 2 变调、进阶第 4 页的起点 / 终点 / 循环、[DELETE] + Synth key 删这个采样的格子；
//   编曲（第 6 章）：按住轨道旋钮（或 ALL）时方键 1–3 = 换乐句（单按预约到下一小节、双击立即；停着时都是立即）、长按 2 秒 = 复制、
//     再按住 [PAGE] 按方键 = 粘贴；[ALL] + [PROJECT↑] 在 普通 → Song → Scene 之间换，方键是 scene（空位 = 新加一个，复制当前的），Song 模式按顺序放；
//     Song 模式里按住 [PAGE] 转 [ALL] 改选中那个 scene 的长度（手册 3.14.8；模拟机上一格一小节，不到一小节时一格一拍，转到最左 = AUTO）；
//   现场（第 7 章）：模拟机的声音先过一串整台的效果（[FX] 旋钮在 MASTER 上的 FILTER / REVERB / DELAY、[HIGH PASS]、[REPEATER] 触摸条，
//     手一松就复原）；[ALL] + [MUTE] 静音模式；[PROJECT↑] + 当前工程的方键 = 临时保存，+ 它正下方的方键 = 恢复；[ALL] + [VOL+] 混音台模式（只做演示）。
import { Emitter, h, clamp, rich } from './util.js';
import { createPanel } from './device-panel.js';
import { LoopPlayer } from './looper.js';
import { audio, midiToName } from './audio.js';
import { sound } from './sound.js';
import { TRACK } from './tracks.js';
import { SCALES, KEY_NAMES, POLY_MODES, synthKeyNote, chordNotes, chordName } from './scales.js';
import { controlInfo } from './controls.js';
import { RECORDINGS, recordingBuffer, playBuffer } from './sim-samples.js';

const DRUMS = ['KICK', 'SNARE', 'CLAP', 'HAT1', 'HAT2', 'PERC1', 'PERC2'];
const SYNTHS = ['SYNTH1', 'SYNTH2', 'DX', 'SAMPLER'];
const KEYED = ['SYNTH1', 'SYNTH2', 'DX']; // 有音高、有“单音 / 复音 / 和弦”的三条
const ALL_TRACKS = [...DRUMS, ...SYNTHS];
const HOLDABLE = new Set(['ALL', ...ALL_TRACKS, 'PROJECT', 'DELETE', 'MUTE', 'SOLO', 'PAGE', 'SD1', 'OCTAVE']);

// ───────────── 第 4 章：模拟机的音色表 ─────────────
// 机器上每一类有几十上百个音色；模拟机每一类只放一两个，名字都写着“模拟”，免得和真机的音色名混在一起。
// 一行 = [类别号（和 16 个方键一一对应，见 SYNTH_CATEGORIES）, 名字, audio.js 里的哪种声音, 自带的弹法 0 单音 / 1 复音]
const AWM_SOUNDS = [
  [0, '模拟 · 锯齿贝斯', 'bass', 0], [0, '模拟 · 圆贝斯', 'sub', 0], [0, '模拟 · 方波贝斯', 'square', 0],
  [1, '模拟 · 亮主奏', 'supersaw', 0], [1, '模拟 · 双锯齿主奏', 'lead', 0],
  [2, '模拟 · 钢琴', 'piano', 1], [3, '模拟 · 电钢琴', 'keys', 1], [4, '模拟 · 风琴', 'reed', 1],
  [5, '模拟 · 宽铺底', 'wide', 1], [5, '模拟 · 暖铺底', 'pad', 1], [5, '模拟 · 锯齿铺底', 'polysynth', 1],
  [6, '模拟 · 弦乐', 'pad', 1], [7, '模拟 · 铜管', 'lead', 1], [8, '模拟 · 木管', 'reed', 0], [9, '模拟 · 拨弦', 'pluck', 1],
  [10, '模拟 · 民族拨弦', 'pluck', 1], [11, '模拟 · 木琴', 'piano', 1], [12, '模拟 · 铃', 'keys', 1], [13, '模拟 · 节奏拨弦', 'pluck', 1], [14, '模拟 · 音效', 'saw', 1],
];
// DX 是 FM 的：用的都是 audio.js 里带 fm 的那几种
const DX_SOUNDS = [
  [0, '模拟 FM · 贝斯', 'fmbass', 0], [1, '模拟 FM · 主奏', 'fmlead', 0], [2, '模拟 FM · 钢琴', 'fmep', 1], [3, '模拟 FM · 电钢琴', 'fmep', 1],
  [4, '模拟 FM · 风琴', 'fmlead', 1], [5, '模拟 FM · 铺底', 'fmep', 1], [11, '模拟 FM · 木琴', 'fmbell', 1], [12, '模拟 FM · 铃', 'fmbell', 1], [14, '模拟 FM · 音效', 'fmbell', 1],
];
// 空白工程里三条合成器轨一开始的音色（和以前的模拟机一样：SYNTH 1 贝斯、单音；SYNTH 2 复音；DX 复音）
const DEFAULT_SOUND = { SYNTH1: 0, SYNTH2: 6, DX: 3 };
const PARAMS = ['attack', 'decay', 'cutoff', 'reso', 'rev', 'dly', 'eqHi', 'eqLo', 'porta', 'arp', 'arpGate', 'arpSpeed', 'fmAlg', 'fmAmt', 'fmFreq', 'fmFb'];
const zeroEdits = () => Object.fromEntries(PARAMS.map((k) => [k, 0]));
/** 用人话说一个参数现在在哪（和音色实验台 synth-lab.js 的说法一样） */
function paramWords(param, v) {
  if (v === 0 && param !== 'fmAlg') return '原样';
  switch (param) {
    case 'cutoff': return v < -44 ? '只剩闷闷的低音' : v < -20 ? '闷' : v < 0 ? '暗了一点' : v < 20 ? '低音少了一点' : v < 44 ? '薄' : '只剩沙沙的高音';
    case 'reso': return v <= -20 ? '更平' : v < 12 ? '差不多原样' : v < 36 ? '有点“喵”' : '很尖';
    case 'attack': return v < -30 ? '一下就出来' : v < 0 ? '快一点' : v < 36 ? '慢慢起来' : '像雾一样浮上来';
    case 'decay': return v < -30 ? '一下就没了' : v < 0 ? '短一点' : v < 36 ? '拖一会儿' : '拖得很长';
    case 'fmAmt': return v < -40 ? '几乎是纯的' : v < 0 ? '圆一点' : v < 36 ? '更亮' : '又亮又硬';
    case 'fmFreq': return `${v > 0 ? '高' : '低'} ${Math.abs(Math.round(v / 9))} 档`;
    case 'fmFb': return v < 0 ? '更干净' : v < 30 ? '有点毛' : '很沙';
    case 'fmAlg': return `第 ${v + 1} 种`;
    case 'arp': return v === 0 ? '关' : `第 ${v} 种`;
    default: return `${v > 0 ? '+' : ''}${v}`;
  }
}
// 右边 4 个旋钮每一页管什么（docs/seqtrak-operation-reference.md 3.11.2）。[参数, Index 上亮的字, 用人话说]
const SD_PAGE_PARAMS = [
  null, // 第 1 页：音色 / 弹法（鼓轨是音高）/ 声像 / 音量，照以前的写法
  [['attack', 'ATTACK', '声音起来得快还是慢'], ['decay', 'DECAY', '声音落下去、松手后拖多久'], ['cutoff', 'FILTER', '滤波器：一边是闷、一边是薄，正中间是原样'], ['reso', 'RESONANCE', '共鸣：滤波器切口上那一下“喵”']],
  [['rev', 'REVERB', '送多少去混响'], ['dly', 'DELAY', '送多少去延迟'], ['eqHi', 'OTHER', '高频多一点还是少一点'], ['eqLo', 'OTHER', '低频多一点还是少一点']],
  [['porta', 'OTHER', '滑音：从一个音滑到下一个音要多久（单音时才有）'], ['arp', 'OTHER', '琶音器的类型（转到头是关）'], ['arpGate', 'OTHER', '琶音器每个音有多长'], ['arpSpeed', 'OTHER', '琶音器有多快']],
  [['fmAlg', 'OTHER', 'FM 的算法：4 个“算子”怎么接（12 种）'], ['fmAmt', 'OTHER', 'FM 调制量：摇得多狠，越大越亮、越硬'], ['fmFreq', 'OTHER', 'FM 调制频率：摇它的那个音是几倍音高，不是整数倍时像铃铛'], ['fmFb', 'OTHER', 'FM 反馈：自己摇自己，加了就发毛、发沙']],
];
// [FX] 旋钮的 8 类效果（每类 8 个预设）；SINGLE 时 MODULATION 那一类在模拟机上是真的会摆的（照小课堂效果模拟机的写法）
// 混音台模式里 Sound Design 旋钮 1–4 选的四样（手册 3.15.1）
const MIX_PARAMS = [['pan', 'PAN', '声像（偏左偏右）'], ['vol', 'VOLUME', '音量'], ['rev', 'REVERB', '混响送多少'], ['dly', 'DELAY', '延迟送多少']];
const FX_CATS = ['FILTER', 'REVERB', 'DELAY', 'COMP', 'DISTORTION', 'MODULATION', 'DUCKER', 'OTHER'];
const MOD_PRESETS = ['SPX CHORUS', 'TEMPO FLANGER', 'TEMPO PHASER', 'ENSEMBLE DETUNE', 'AUTO PAN', 'TREMOLO', 'VCM AUTO WAH', 'RING MODULATOR'];
const MOD_ZH = ['合唱：声音变厚、轻轻晃', '镶边：一阵一阵“嗖”的扫', '相位：慢慢转着的“哇”', '合奏：几把稍稍走音的叠在一起', '自动声像：在左右之间来回跑', '颤音：音量一大一小', '自动哇音：滤波器一开一合', '环形调制：变成金属、机器人那种声音'];
const SAMPLE_SOUNDS = ['PERC1', 'PERC2', 'CLAP', 'HAT2', 'SNARE', 'KICK', 'HAT1'];
const DRUM_CATEGORIES = ['KICK', 'SNARE', 'RIM', 'CLAP', 'SNAP', '闭镲', '开镲', '沙锤/铃鼓', 'RIDE', 'CRASH', 'TOM', 'BELL', '康加/邦戈', 'WORLD', 'SFX', '收藏'];
const SYNTH_CATEGORIES = ['BASS', 'SYNTH LEAD', 'PIANO', 'KEYBOARD', 'ORGAN', 'PAD', 'STRINGS', 'BRASS', 'WOODWIND', 'GUITAR', 'WORLD', 'MALLET', 'BELL', 'RHYTHMIC', 'SFX', '收藏'];
const NATURALS = [0, 2, 4, 5, 7, 9, 11];
const PAT_MAX = 6; // 每条轨道最多 6 段乐句（出厂 3 段）
const LOOP_STEPS = 128; // 播放器按 8 小节转（乐句最长 8 小节）；短的乐句在里面自己走好几圈
const HELLO = '这是一台**模拟机**，点它就会响。先短按左下角的 [PLAY] 听听看。';

const isStepKey = (id) => /^DK\d+$/.test(id || '');
const noteNames = (notes) => notes.map((n) => midiToName(n).replace(/-?\d+$/, '')).join(' ');
const sameNotes = (a, b) => a.length === b.length && [...a].sort().every((n, i) => n === [...b].sort()[i]);

const nameOf = (id) =>
  /^DK/.test(id) ? `Drum key ${id.slice(2)}`
    : /^SK/.test(id) ? `Synth key ${id.slice(2)}`
      : TRACK[id] ? `**${TRACK[id].label} 旋钮**`
        : id === 'ALL' ? '**ALL 旋钮**'
          : id === 'PROJECT' ? '[PROJECT↑]'
            : id === 'SD1' ? '**Sound Design 旋钮 1**'
              : id === 'REC' ? '**录音键**' : `[${id}]`;

function makeProject(seed = {}) {
  const p = { tempo: 120, swing: 0, scale: 0, key: 0, pat: {}, drums: {}, synth: {}, octave: {}, poly: {}, bars: {}, mute: new Set(), solo: null, ...seed.settings };
  for (const t of DRUMS) {
    p.drums[t] = [new Set(seed.drums?.[t] || []), ...Array.from({ length: PAT_MAX - 1 }, () => new Set())];
    p.bars[t] = Array(PAT_MAX).fill(1);
    p.pat[t] = 0;
  }
  for (const t of SYNTHS) {
    // 合成器轨的一步：{ notes: [音符号…], key: 是用第几个 Synth key 放进去的, len: 持续几步 }
    p.synth[t] = [new Map(Object.entries(seed.synth?.[t] || {}).map(([k, v]) => [Number(k), { notes: [v], key: 0, len: 1 }])), ...Array.from({ length: PAT_MAX - 1 }, () => new Map())];
    p.bars[t] = Array(PAT_MAX).fill(1);
    p.pat[t] = 0;
    p.octave[t] = t === 'SYNTH1' ? -2 : 0;
  }
  // 弹法：0 单音 / 1 复音 / 2 和弦。和用户那台真机的空白工程一样：SYNTH 1 是贝斯音色（单音），SYNTH 2 和 DX 是复音
  p.poly = { SYNTH1: 0, SYNTH2: 1, DX: 1 };
  // 第 4 章：三条合成器轨现在用的音色，和在它上面拧过的参数、单轨效果（都跟着音色走，换音色就换成新音色自己的）
  p.snd = Object.fromEntries(KEYED.map((t) => [t, soundAt(t, DEFAULT_SOUND[t])]));
  // 第 5 章：采样器的 7 个采样位。一开始放的是现成的打击乐（模拟机用鼓的声音代替）；录过的换成一段采样数据，能变调、剪、循环
  p.samples = SAMPLE_SOUNDS.map((drum, i) => ({ name: `模拟 · 预置采样 ${i + 1}`, drum, rec: null, pitch: 0, start: 0, end: 1, loop: false }));
  // 第 6 章：每条轨道能选几段乐句（3 或 6，整个工程一起换，手册 3.7.3）
  p.slots = 3;
  // 第 6 章：Song 模式里的 scene（最多 16 个）：每个 scene 记下 11 条轨道各用第几段乐句、哪几条静音、多长（len = 几步，null = AUTO）
  p.scenes = [];
  p.scene = 0;
  // 第 7 章：混音台模式里调的四样（0–127，声像 64 = 正中）。合成器轨的混响 / 延迟另外还有音色里的那一份（进阶第 3 页的旋钮 1、2，跟着音色走）
  p.mix = Object.fromEntries([...DRUMS, ...SYNTHS].map((t) => [t, { pan: 64, vol: 100, rev: 20, dly: 0 }]));
  return p;
}

/** 音色表里第 i 个音色，拿出来是一份新的：参数都在“原样”（0），单轨效果没有 */
function soundAt(track, i) {
  const list = track === 'DX' ? DX_SOUNDS : AWM_SOUNDS;
  const [cat, name, voice, poly] = list[((i % list.length) + list.length) % list.length];
  return { i: ((i % list.length) + list.length) % list.length, cat, name, voice, poly, edits: zeroEdits(), fx: { idx: -1, level: 0 }, saved: false };
}

// 1–3 号是演示曲（简化版），4–8 号是空白工程：和真机一样，只放了孤零零的一下底鼓
const blank = () => makeProject({ drums: { KICK: [0] } });
const makeProjects = () => [
  makeProject({ settings: { tempo: 122 }, drums: { KICK: [0, 4, 8, 12], CLAP: [4, 12], HAT1: [2, 6, 10, 14], PERC1: [3, 11] }, synth: { SYNTH1: { 2: 36, 6: 36, 10: 36, 14: 39 }, DX: { 0: 72, 3: 70, 6: 67, 8: 72, 11: 70, 14: 63 } } }),
  makeProject({ settings: { tempo: 88, swing: 30 }, drums: { KICK: [0, 7, 10], SNARE: [4, 12], HAT1: [0, 2, 4, 6, 8, 10, 12, 14] }, synth: { SYNTH1: { 0: 36, 7: 36, 10: 39 } } }),
  makeProject({ settings: { tempo: 104 }, drums: { KICK: [0, 4, 8, 12], SNARE: [4, 12], HAT1: [0, 2, 4, 6, 8, 10, 12, 14] }, synth: { SYNTH1: { 0: 36, 2: 36, 4: 43, 6: 36, 8: 36, 10: 36, 12: 43, 14: 46 } } }),
  blank(), blank(), blank(), blank(), blank(),
];

/** 一个工程的深拷贝（临时保存用）：Set、Map 都另起一份 */
function cloneProject(p) {
  const c = { ...p, pat: { ...p.pat }, octave: { ...p.octave }, poly: { ...p.poly }, mute: new Set(p.mute), drums: {}, synth: {}, bars: {} };
  for (const t of Object.keys(p.drums)) {
    c.drums[t] = p.drums[t].map((set) => new Set(set));
    c.bars[t] = [...p.bars[t]];
  }
  for (const t of Object.keys(p.synth)) {
    c.synth[t] = p.synth[t].map((m) => new Map([...m].map(([k, v]) => [k, { ...v, notes: [...v.notes] }])));
    c.bars[t] = [...p.bars[t]];
  }
  c.snd = Object.fromEntries(Object.entries(p.snd).map(([t, v]) => [t, { ...v, edits: { ...v.edits }, fx: { ...v.fx } }]));
  c.samples = p.samples.map((x) => ({ ...x }));
  c.scenes = p.scenes.map((x) => ({ pat: { ...x.pat }, mute: [...x.mute], len: x.len ?? null }));
  c.mix = Object.fromEntries(Object.entries(p.mix).map(([t, v]) => [t, { ...v }]));
  return c;
}

class Simulator extends Emitter {
  power = true;
  projects = makeProjects();
  project = 0;
  sel = 'KICK';
  playing = false;
  recording = false;
  step = -1;
  rtDrum = false; // 鼓的实时输入模式
  stepMode = null; // 正处于“步进输入”的合成器轨道
  page = 0; // 步进键现在显示的是第几页（一页 16 步）
  metronome = false;
  volume = 6;
  held = null;
  lastPlayed = {}; // 每条合成器轨最后弹过的东西：{ notes, key }
  // 第 4 章：右边 4 个旋钮翻到第几页（0 = 第 1 页）、是不是在进阶设置里；[MASTER/SINGLE] 拨在哪边；整台的效果；存过的音色
  sdPage = 0;
  sdAdvanced = false;
  fxSingle = false;
  masterFx = { idx: -1, level: 0 };
  favorites = [];
  // 第 5–7 章：采样器选中的是第几个采样位、正在不在采样、采样源；Song / Scene 模式；静音模式；混音台模式；按住的第二个功能键
  sampleKey = 1;
  sampling = null;
  sampleSrc = 0; // 0 MIC / AUDIO IN、1 USB、2 RESAMPLING（手册 3.13.3）
  songMode = 0; // 0 普通、1 Song、2 Scene
  muteMode = false;
  mixer = false;
  mixParam = 1; // 混音台里现在调的是哪一样：0 声像 / 1 音量 / 2 混响送多少 / 3 延迟送多少
  held2 = null;
  clip = null; // 复制下来的乐句（第 6 章）
  live = { hp: 0, rep: 0 }; // 手指正按在 [HIGH PASS] / [REPEATER] 上的位置（0 = 没按）
  lastSay = HELLO;
  #meter = null;
  #index = null;
  #flash = {};
  #red = null;
  #timers = {};
  #consumed = null;
  #powerToggled = false;
  #pendingStep = null; // 按下了一个已经有音的步：松手才关，长按则是“按住它”
  #tapOnUp = null; // 松手时才算“单按一下”的键（[PAGE]：它既能单按翻页，又能按住当功能键）
  #lenShow = null; // 正在调哪一步的音长：{ step, len }
  #mono = {}; // 单音轨上正在响的那个音的“掐断”函数
  #cluster = null; // 复音轨上一秒之内连着点的几个键（屏幕上没法真的同时按）
  #undo = []; // 拧过的参数：[{ track, param, before, after }]，[UNDO/REDO] 用
  #redo = null;
  #undoBurst = null; // 连着拧同一个旋钮的那一阵，算一次（撤销时一下退回拧之前）
  #slide = null; // 正在 [FX LEVEL] 上滑的手指
  #fx = null; // 第 7 章：模拟机整台声音后面那一串效果（见 #ensureFx）
  #dkHold = null; // 按住轨道旋钮时按下的方键：长按 2 秒是复制，短按是换乐句
  #lastPatTap = null;
  #pendingPat = null; // 预约的换乐句：下一小节开头再换
  #songPos = 0; // Song / Scene 模式下，这个 scene 已经放了几步
  #songEnd = false;
  #pendingScene = null; // 放着的时候按了别的 scene：Scene 模式等到下一小节开头、Song 模式等这个 scene 放完再换（手册 3.14.4）
  #rep = null; // [REPEATER] 按着时：从哪一步起、几步一循环
  #srcPick = 0; // 长按 [REC SAMPLE] 2 秒之后，到什么时候还能选采样源
  #tempSave = null; // [PROJECT↑] + 当前工程方键的临时保存：{ project, data }
  #recNo = 0;

  constructor() {
    super();
    this.player = new LoopPlayer({ bpm: 120, steps: LOOP_STEPS });
    this.player.onSchedule = (step, t) => this.#schedule(step, t);
    this.player.onStep((s) => {
      this.step = s;
      this.#render();
    });
  }

  get proj() {
    return this.projects[this.project];
  }

  // ───────────── 给课程用的统一接口（和真机镜像相同） ─────────────

  /** 某条轨道当前这段乐句有几步 */
  #lenOfTrack(track) {
    const p = this.proj;
    return (p.bars[track]?.[p.pat[track]] || 1) * 16;
  }

  /** 某条轨道当前这段乐句里有音的步（从 0 起） */
  stepsOf(track) {
    const p = this.proj;
    const src = DRUMS.includes(track) ? p.drums[track][p.pat[track]] : p.synth[track][p.pat[track]];
    const len = this.#lenOfTrack(track);
    return [...(src.keys ? src.keys() : src)].filter((s) => s < len).sort((a, b) => a - b);
  }

  /** 合成器轨每一步是用第几个 Synth key 放进去的：{ 步: 键 } */
  keysOf(track) {
    const p = this.proj;
    if (!SYNTHS.includes(track)) return {};
    const map = p.synth[track][p.pat[track]];
    return Object.fromEntries(this.stepsOf(track).map((s) => [s, map.get(s).key || 0]));
  }

  /** 合成器轨每一步放的是哪几个音（MIDI 音符号）：{ 步: [音…] }。keysOf 只说是第几个键，认不出八度；这个认得出 */
  notesOf(track) {
    const p = this.proj;
    if (!SYNTHS.includes(track)) return {};
    const map = p.synth[track][p.pat[track]];
    return Object.fromEntries(this.stepsOf(track).map((s) => [s, [...map.get(s).notes]]));
  }

  /** 合成器轨某一步的音有多长（几步）；那一步没有音时是 0 */
  lenOf(track, step) {
    const p = this.proj;
    return (SYNTHS.includes(track) && p.synth[track][p.pat[track]].get(step)?.len) || 0;
  }

  /** 某条合成器轨的弹法：0 单音 / 1 复音 / 2 和弦 */
  polyOf(track) {
    return this.proj.poly[track];
  }

  /** 某条轨道当前这段乐句有几小节（鼓轨也有：V2.00 起 [BAR LENGTH] 也管鼓轨） */
  barsOf(track) {
    const p = this.proj;
    return p.bars[track]?.[p.pat[track]] ?? null;
  }

  // 第 4 章（和真机镜像同名）：音色名、拧过的参数（−64 … +63，0 = 原样）、单轨效果

  /** 某条合成器轨现在的音色名（存过的带 _edit01）；采样器是选中那个采样位的名字 */
  soundName(track) {
    if (track === 'SAMPLER') return this.sampleName(this.sampleKey);
    return this.proj.snd[track]?.name || '';
  }

  /** 某条合成器轨上某个参数现在拧到哪：attack / decay / cutoff / reso / fmAmt / fmFreq / fmFb / fmAlg …；
   *  采样器（第 5 章）是选中那个采样位的 pitch（半音）/ start / end（0–100）/ loop（0 或 1） */
  paramOf(track, name) {
    if (track === 'SAMPLER') {
      const s = this.proj.samples[this.sampleKey - 1];
      if (!s) return null;
      return name === 'pitch' ? s.pitch : name === 'start' ? Math.round(s.start * 100) : name === 'end' ? Math.round(s.end * 100) : name === 'loop' ? (s.loop ? 1 : 0) : null;
    }
    return this.proj.snd[track]?.edits[name] ?? null;
  }

  // ───── 第 5–7 章（和真机镜像同名的那几个，镜像读不出的就只有模拟机有） ─────

  /** 采样器第 key 个采样位（1–7）的名字 */
  sampleName(key) {
    return this.proj.samples[key - 1]?.name || '';
  }

  /** 某条轨道现在在第几段乐句（从 0 起） */
  patternOf(track) {
    return this.proj.pat[track] ?? 0;
  }

  /** 每条轨道能选几段乐句：3 或 6（整个工程一起换） */
  get patSlots() {
    return this.proj.slots;
  }

  /** 第 i 个 scene：{ pat: { 轨道: 第几段（0 起） }, mute: [轨道…], len: 几步（AUTO 时是算出来的）, auto } */
  sceneOf(i = this.proj.scene) {
    const sc = this.proj.scenes[i];
    if (!sc) return null;
    return { pat: { ...sc.pat }, mute: [...sc.mute], len: sc.len ?? this.#autoLen(sc), auto: !sc.len };
  }

  /** Song 模式里一共有几个 scene、现在选的是第几个（从 0 起） */
  get sceneCount() {
    return this.proj.scenes.length;
  }

  get sceneIndex() {
    return this.proj.scene;
  }

  /** 某条轨道静音了没有 */
  mutedOf(track) {
    return this.proj.mute.has(track);
  }

  /** 第 7 章：整台的效果（[MASTER/SINGLE] 拨在 MASTER 时 [FX] 选的）是哪一类；没选是 null */
  get masterFxCat() {
    const fx = this.masterFx;
    return fx.idx >= 0 ? FX_CATS[Math.floor(fx.idx / 8)] : null;
  }

  /** 选中的那条轨道上的单轨效果：{ cat: 'MODULATION', preset: 5, level: 0–1 }；没有就是 null */
  fxOf(track) {
    const fx = this.proj.snd[track]?.fx;
    return fx && fx.idx >= 0 ? { cat: FX_CATS[Math.floor(fx.idx / 8)], preset: fx.idx % 8, level: fx.level } : null;
  }

  /** 这条轨道在进阶设置里一共有几页（不在进阶里是 2 页） */
  #pages(track = this.sel) {
    if (!this.sdAdvanced) return 2;
    return track === 'DX' ? 5 : KEYED.includes(track) ? 4 : track === 'SAMPLER' ? 5 : 3;
  }

  /** 把 ch3 那样的一段循环摆进某个工程（课程开头用；那个工程里合成器轨已经有东西就不动）。spec 见 lesson 的 simSeed */
  seedProject(i, spec = {}) {
    const p = this.projects[clamp(i, 0, 7)];
    if (!p) return false;
    const first = !KEYED.some((t) => p.synth[t][0].size); // 第 1 段的合成器轨已经有东西：第 1 段（和弹法）不动，别的段照样看
    if (first) {
      for (const [t, poly] of Object.entries(spec.poly || {})) p.poly[t] = poly;
      // 完整版的课：先把速度、音阶和调、每条合成器轨的八度摆好，再放音（音是照着这些算出来的）
      for (const k of ['tempo', 'swing', 'scale', 'key']) if (spec.settings?.[k] !== undefined) p[k] = spec.settings[k];
      for (const [t, o] of Object.entries(spec.octave || {})) p.octave[t] = o;
    }
    if (spec.slots) p.slots = Math.max(p.slots, spec.slots);
    const fill = (pat, part) => {
      for (const [t, steps] of Object.entries(part.drums || {})) p.drums[t][pat] = new Set(steps);
      for (const [t, bars] of Object.entries(part.bars || {})) p.bars[t][pat] = bars;
      for (const [t, list] of Object.entries(part.keys || {})) {
        const map = p.synth[t][pat];
        for (const [step, key, len = 1, shift = 0] of list) {
          const opts = { scale: p.scale, key: p.key, octave: p.octave[t] + shift };
          map.set(step, { notes: p.poly[t] === 2 ? chordNotes(key, opts) : [synthKeyNote(key, opts)], key, len });
        }
      }
    };
    if (first) fill(0, spec);
    // 第 6 章：别的几段乐句也可以预先摆好（spec.patterns = { 1: { drums, keys, bars }, 2: … }，下标从 0 数，到 5）。那一段已经有东西就不动
    for (const [pat, part] of Object.entries(spec.patterns || {})) {
      const i = Number(pat);
      if (KEYED.some((t) => p.synth[t][i].size) || DRUMS.some((t) => p.drums[t][i].size)) continue;
      fill(i, part);
    }
    if (first && spec.tempo) p.tempo = spec.tempo;
    if (this.project === i) this.#render();
    return first;
  }

  // ───────────── 挂到页面上 ─────────────

  mount({ tips = true } = {}) {
    this.unmount();
    this.panel = createPanel({ onDown: (id) => this.#down(id), onUp: (id, ms) => this.#up(id, ms), onTurn: (id, dir) => this.#turn(id, dir) });
    // [FX LEVEL] 触摸条要跟着手指走：面板本身只报“按下 / 松开”，这里自己听移动（和小课堂的效果模拟机一样）
    const svg = this.panel.svg;
    svg.addEventListener('pointerdown', (e) => {
      const node = e.target.closest?.('[data-id]');
      if (!node || !['FXLEVEL', 'HIGHPASS', 'REPEATER'].includes(node.dataset.id) || !this.power) return;
      this.#ensureFx();
      this.#slide = { id: node.dataset.id, rect: (node.querySelector('rect') || node).getBoundingClientRect() };
      this.#slideFx(e);
    }, true);
    svg.addEventListener('pointermove', (e) => this.#slide && this.#slideFx(e));
    const endSlide = () => {
      if (this.#slide) this.#endLive(this.#slide.id);
      this.#slide = null;
      this.#render();
    };
    svg.addEventListener('pointerup', endSlide);
    svg.addEventListener('pointercancel', endSlide);
    this.sayText = h('span', { html: rich(this.lastSay) });
    this.el = h('div', { class: 'sim' },
      this.panel.el,
      h('div', { class: 'sim-bar' }, h('div', { class: 'sim-say' }, h('span', { class: 'led' }), this.sayText)),
      tips && h('div', { class: 'sim-tips', html: rich('**短按** = 按一下。**长按半秒** = “按住”：出现黑圈后再点第二个键，就是组合键。旋钮可以**上下拖**（或用滚轮）来转。模拟机的鼓轨只有一种音色，合成器轨每一类只有一两个“模拟”音色；白色的轨道灯表示当前选中的是哪一条（真机没有这个区分）。') }),
    );
    this.#render();
    return this.el;
  }

  unmount() {
    if (this.playing) {
      this.player.stop();
      this.playing = false;
      this.recording = false;
      this.step = -1;
    }
    Object.values(this.#timers).forEach((t) => { clearTimeout(t); clearInterval(t); });
    this.#timers = {};
    this.held = null;
    this.#pendingStep = null;
    this.#tapOnUp = null;
    this.#lenShow = null;
    this.#cluster = null;
    this.el?.remove();
    this.el = null;
    this.panel = null;
  }

  highlight(ids) {
    this.panel?.setHighlight(ids);
  }

  flash(id, color) {
    this.panel?.flash(id, color);
  }

  /** 直接翻到某个工程（课程开头用，不算一次“操作”）。 */
  gotoProject(i) {
    const target = clamp(i, 0, 7);
    if (this.project === target) return;
    if (this.playing) this.player.stop();
    Object.assign(this, { project: target, playing: false, recording: false, step: -1, stepMode: null, page: 0 });
    this.#render();
  }

  /** 把某个工程清成空白的（曲目的课从第 1 步开始时用：模拟机上一首歌搭过的东西，别带进下一首） */
  blankProject(i) {
    const target = clamp(i, 0, 7);
    if (this.project === target && this.playing) {
      this.player.stop();
      this.playing = false;
      this.step = -1;
    }
    this.projects[target] = blank();
    if (this.project === target) Object.assign(this, { stepMode: null, page: 0 });
    this.#render();
  }

  /** 把模拟机恢复成刚开箱的样子 */
  reset() {
    const mounted = !!this.panel;
    if (this.playing) this.player.stop();
    Object.assign(this, { power: true, projects: makeProjects(), project: 0, sel: 'KICK', playing: false, recording: false, step: -1, rtDrum: false, stepMode: null, page: 0, metronome: false, held: null, lastPlayed: {} });
    Object.assign(this, { sdPage: 0, sdAdvanced: false, fxSingle: false, masterFx: { idx: -1, level: 0 }, favorites: [] });
    Object.assign(this, { sampleKey: 1, sampling: null, sampleSrc: 0, songMode: 0, muteMode: false, mixer: false, mixParam: 1, held2: null, live: { hp: 0, rep: 0 } });
    this.#pendingPat = null;
    this.#rep = null;
    this.#tempSave = null;
    this.#pendingScene = null;
    this.#applyFx();
    this.#undo = [];
    this.#redo = null;
    this.#lenShow = null;
    this.panel?.setHeld([]);
    this.#say(HELLO);
    if (mounted) this.#render();
  }

  #say(text) {
    this.lastSay = text;
    if (this.sayText) this.sayText.innerHTML = rich(text);
    this.emit('say', text);
  }

  #event(type, data = {}) {
    this.emit('event', { type, ...data });
  }

  // ───────────── 声音与音序 ─────────────

  #audible(t) {
    const p = this.proj;
    return p.solo ? p.solo === t : !p.mute.has(t);
  }

  /** 让一条合成器 / 采样器轨发出一组音。几个音一起响（和弦）时每个音放轻一些。 */
  #sound(track, notes, time, dur = 0.3) {
    if (track === 'SAMPLER') {
      for (const v of notes) this.#playSample(v + 1, time, dur);
      return;
    }
    const vel = notes.length > 1 ? 0.5 : 0.9;
    const voice = this.#voiceOf(track);
    const tweak = this.#tweakOf(track);
    for (const n of notes) audio.note(n, time, dur, { voice, vel, tweak, bus: this.#bus('synth', track) });
  }

  /** 放采样器第 key 个采样位：预置的用鼓的声音代替；录过的是一段采样数据，按这一位的变调、起点、终点、循环来放 */
  #playSample(key, time, dur = 0.6, lock) {
    const smp = this.proj.samples[key - 1];
    if (!smp || !audio.ready) return;
    if (!smp.rec) return audio.drum(smp.drum, time, 0.9, this.#bus('drums', 'SAMPLER'));
    const buf = recordingBuffer(audio.ctx, smp.rec, this.proj.tempo);
    playBuffer(audio, buf, time, { pitch: lock ?? smp.pitch, start: smp.start, end: smp.end, loop: smp.loop, dur: Math.max(dur, 0.25), bus: this.#bus('synth', 'SAMPLER') });
  }

  /** 参数锁：步进输入里按住的那一步（采样器），只改这一步的音高。这一步亮紫色（手册 3.6.1） */
  #lockPitch(dir) {
    const p = this.proj;
    const step = this.page * 16 + Number(this.held.slice(2)) - 1;
    const e = p.synth.SAMPLER[p.pat.SAMPLER].get(step);
    if (!e) return this.#say('按住的这一步是空的：先把它按亮（放进一个采样），再按住它转旋钮。');
    const base = this.proj.samples[(e.notes[0] ?? 0)]?.pitch ?? 0;
    e.lock = clamp((e.lock ?? base) + dir, -24, 24);
    this.#armLatchTimeout();
    this.#playSample((e.notes[0] ?? 0) + 1, 0, 0.5, e.lock);
    this.#index = 'PITCH';
    this.#meterLater();
    this.#say(`第 ${step + 1} 步锁了一个音高：**${e.lock > 0 ? '+' : ''}${e.lock} 个半音**（这一步亮紫色，别的步不变）。这叫**参数锁**：一步一个音高，一声关门也能弹出一段旋律。调好了，再点一下被按住的那个键松开。`);
    this.#event('plock', { track: 'SAMPLER', step, value: e.lock });
    this.#render();
  }

  /** 模拟机的声音走哪条总线：整台效果那一串搭好了就走它（第 7 章），没搭好就走原来的 */
  #bus(fallback = 'synth', track = null) {
    if (!this.#fx) return fallback;
    return track && audio.buses[`sim:${track}`] ? `sim:${track}` : 'sim';
  }

  /** 第 7 章：一条轨道送多少去混响 / 延迟（0–127）：混音台里调的那一份，合成器轨再加上音色里的（进阶第 3 页） */
  #sendOf(tr, which) {
    const p = this.proj;
    const base = p.mix?.[tr]?.[which] ?? 0;
    const edit = KEYED.includes(tr) ? p.snd[tr]?.edits[which] || 0 : 0;
    return clamp(base + edit, 0, 127);
  }

  /** 把每条轨道的音量、混响 / 延迟送多少落到声音上 */
  #applyMix() {
    const n = this.#fx;
    if (!n?.tracks) return;
    const t = audio.now();
    for (const [tr, node] of Object.entries(n.tracks)) {
      const m = this.proj.mix?.[tr];
      if (!m) continue;
      node.vol.gain.setTargetAtTime(m.vol / 100, t, 0.03);
      node.rev.gain.setTargetAtTime((this.#sendOf(tr, 'rev') / 127) * 0.9, t, 0.03);
      node.dly.gain.setTargetAtTime((this.#sendOf(tr, 'dly') / 127) * 0.7, t, 0.03);
    }
  }

  /**
   * 第 7 章：模拟机整台声音后面那一串效果（和真机的主效果一样接在最后）：
   *   进来 → [HIGH PASS]（手指按着才削低音）→ [FX] 的 FILTER → 原声 + 混响 + 延迟 → 出去
   * 音频上下文有了才搭；搭好之后模拟机所有的声音都从这里过（总线名 sim）。
   */
  #ensureFx() {
    if (this.#fx || !audio.ctx) return;
    const ctx = audio.ctx;
    const g = (v = 1) => {
      const n = ctx.createGain();
      n.gain.value = v;
      return n;
    };
    const n = { input: g(), hp: ctx.createBiquadFilter(), filt: ctx.createBiquadFilter(), out: g(), rev: g(0), dly: g(0), conv: ctx.createConvolver(), delay: ctx.createDelay(2), fb: g(0.35) };
    n.hp.type = 'highpass';
    n.hp.frequency.value = 10;
    n.filt.type = 'lowpass';
    n.filt.frequency.value = 20000;
    const len = Math.floor(ctx.sampleRate * 1.8);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.4;
    }
    n.conv.buffer = ir;
    n.input.connect(n.hp).connect(n.filt).connect(n.out);
    n.filt.connect(n.rev).connect(n.conv).connect(n.out);
    n.filt.connect(n.dly).connect(n.delay).connect(n.out);
    n.delay.connect(n.fb).connect(n.delay);
    n.out.connect(audio.master);
    audio.buses.sim = n.input;
    n.sconv = ctx.createConvolver();
    n.sconv.buffer = ir;
    n.sconv.connect(n.input);
    n.sdelay = ctx.createDelay(2);
    n.sdelay.delayTime.value = (60 / (this.proj.tempo || 120)) * 0.75;
    n.sfb = g(0.38);
    n.sdelay.connect(n.input);
    n.sdelay.connect(n.sfb).connect(n.sdelay);
    n.tracks = {};
    for (const tr of [...DRUMS, ...SYNTHS]) {
      const node = { vol: g(1), rev: g(0), dly: g(0) };
      node.vol.connect(n.input);
      node.vol.connect(node.rev).connect(n.sconv);
      node.vol.connect(node.dly).connect(n.sdelay);
      n.tracks[tr] = node;
      audio.buses[`sim:${tr}`] = node.vol;
    }
    this.#fx = n;
    this.#applyFx();
    this.#applyMix();
  }

  /** 把 [FX] 旋钮（MASTER）和三条触摸条现在的样子落到那一串效果上 */
  #applyFx() {
    const n = this.#fx;
    if (!n) return;
    const t = audio.now();
    const fx = this.masterFx;
    const cat = fx.idx >= 0 ? FX_CATS[Math.floor(fx.idx / 8)] : null;
    const preset = fx.idx % 8;
    const lv = fx.level;
    // [FX] 的 FILTER：前 4 个是低通（越推越闷），后 4 个是高通（越推越薄）；没选它就全开
    const lp = cat === 'FILTER' && preset < 4 && lv > 0.02;
    const hpf = cat === 'FILTER' && preset >= 4 && lv > 0.02;
    if (n.filt.type !== (hpf ? 'highpass' : 'lowpass')) n.filt.type = hpf ? 'highpass' : 'lowpass';
    n.filt.frequency.setTargetAtTime(lp ? 18000 * (130 / 18000) ** lv : hpf ? 30 * (4000 / 30) ** lv : hpf ? 20 : 20000, t, 0.03);
    n.filt.Q.value = cat === 'FILTER' ? [0.7, 2, 5, 9][preset % 4] : 0.7;
    n.rev.gain.setTargetAtTime(cat === 'REVERB' ? lv * 3 : 0, t, 0.04);
    n.dly.gain.setTargetAtTime(cat === 'DELAY' ? lv * 0.8 : 0, t, 0.04);
    const beat = 60 / this.proj.tempo;
    n.delay.delayTime.setTargetAtTime(beat * [1, 1, 0.75, 0.5, 0.5, 0.25, 0.75, 0.75][preset] || beat, t, 0.01);
    // [HIGH PASS]：手指按着才削，越往上削得越多；松手回到不削
    n.hp.frequency.setTargetAtTime(this.live.hp > 0 ? 20 * (3000 / 20) ** this.live.hp : 10, t, 0.02);
  }

  #voiceOf(track) {
    return this.proj.snd[track]?.voice || 'keys';
  }

  /**
   * 这条轨道上拧过的东西，换成 audio.js 的 tweak（都在原样时返回 null，声音和以前一模一样）。
   * SINGLE 时加在这条轨道上的 MODULATION 效果，在这里变成一只来回拧的手（LFO），速度跟着工程的 BPM 走
   */
  #tweakOf(track) {
    const s = this.proj.snd[track];
    if (!s) return null;
    const e = s.edits;
    const beat = this.proj.tempo / 60; // 每秒几拍
    let lfo = null;
    if (s.fx.idx >= 40 && s.fx.idx < 48 && s.fx.level > 0.02) {
      const k = s.fx.idx - 40;
      const d = s.fx.level;
      lfo = [
        { to: 'pitch', rate: 0.9, depth: d * 0.25 }, { to: 'filter', rate: beat / 4, depth: d }, { to: 'filter', rate: beat / 8, depth: d * 0.8 }, { to: 'pitch', rate: 0.5, depth: d * 0.18 },
        { to: 'pan', rate: beat / 2, depth: d }, { to: 'amp', rate: beat * 2, depth: d }, { to: 'filter', rate: beat, depth: d }, { to: 'amp', rate: 28, depth: d },
      ][k];
    }
    const fm = { amount: e.fmAmt, freq: e.fmFreq, feedback: e.fmFb };
    if (!lfo && !e.attack && !e.decay && !e.cutoff && !e.reso && !e.fmAmt && !e.fmFreq && !e.fmFb) return null;
    return { attack: e.attack, decay: e.decay, cutoff: e.cutoff, reso: e.reso, fm, lfo };
  }

  #schedule(rawStep, t) {
    const p = this.proj;
    let step = rawStep;
    // 第 6 章：预约的换乐句，等到下一小节的开头（手册：Launch Quantize 默认 16 步）
    if (this.#pendingPat && step % 16 === 0) {
      const { tracks, pat } = this.#pendingPat;
      this.#pendingPat = null;
      setTimeout(() => this.#switchPattern(tracks, pat, '到了下一小节的开头，'), 0);
      for (const tr of tracks) p.pat[tr] = pat;
    }
    // 第 6 章：Song / Scene 模式里按 scene 走，自己数这个 scene 放到了第几步
    if (this.songMode && p.scenes.length) {
      if (this.#songEnd) return;
      const turn = (i) => {
        p.scene = i;
        this.#pendingScene = null;
        this.#applyScene(i);
        this.#songPos = 0;
        setTimeout(() => {
          this.#say(`到了${this.songMode === 2 ? '下一小节的开头' : '这个 scene 的结尾'}，换到了 **scene ${i + 1}**。`);
          this.#event('scene', { index: i, count: p.scenes.length, playing: true });
        }, 0);
      };
      if (this.songMode === 2 && this.#pendingScene !== null && this.#songPos % 16 === 0) turn(this.#pendingScene);
      else if (this.#songPos >= this.#sceneLen()) {
        this.#songPos = 0;
        if (this.songMode === 1 && this.#pendingScene !== null) turn(this.#pendingScene);
        else if (this.songMode === 1) {
          if (p.scene + 1 >= p.scenes.length) {
            this.#songEnd = true;
            setTimeout(() => {
              if (this.playing) this.#togglePlay();
              this.#say('Song 模式：最后一个 scene 放完了，停了下来（真机默认也是这样，要循环得在 App 里改）。');
            }, 0);
            return;
          }
          p.scene++;
          this.#applyScene(p.scene);
          setTimeout(() => this.#event('scene', { index: p.scene, count: p.scenes.length, playing: true }), 0);
        }
      }
      step = this.#songPos++;
    }
    // 第 7 章：[REPEATER] 按着的时候，反复放刚才那几步
    if (this.#rep) step = this.#rep.from + (this.#rep.n++ % this.#rep.len);
    if (this.metronome && step % 4 === 0) sound.click(t, step % 16 === 0);
    const stepSec = 60 / p.tempo / 4;
    if (step % 16 === 0) this.#applyMix(); // 换了工程、恢复了临时保存：每小节开头对一次混音
    for (const tr of DRUMS) if (this.#audible(tr) && p.drums[tr][p.pat[tr]].has(step % this.#lenOfTrack(tr))) audio.drum(tr, t, 0.9, this.#bus('drums', tr));
    for (const tr of SYNTHS) {
      if (!this.#audible(tr)) continue;
      const e = p.synth[tr][p.pat[tr]].get(step % this.#lenOfTrack(tr));
      if (e && tr === 'SAMPLER') for (const v of e.notes) this.#playSample(v + 1, t, stepSec * (e.len > 1 ? e.len * 0.95 : 1.7), e.lock);
      else if (e) this.#sound(tr, e.notes, t, stepSec * (e.len > 1 ? e.len * 0.95 : 1.7));
    }
  }

  #applyTransport() {
    this.player.bpm = this.proj.tempo;
    this.player.swing = this.proj.swing / 120;
    if (audio.master) audio.master.gain.setTargetAtTime((this.volume / 8) * 0.95, audio.now(), 0.02);
  }

  #togglePlay() {
    if (this.playing) {
      this.player.stop();
      this.playing = false;
      this.recording = false;
      this.step = -1;
      this.#say('停下了。');
      this.#event('stop');
    } else {
      this.#applyTransport();
      this.#songPos = 0;
      this.#songEnd = false;
      this.player.start();
      this.playing = true;
      this.#say('播放中：11 条轨道各自的乐句一起循环。再短按一次 [PLAY] 停下。');
      this.#event('start');
    }
  }

  #togglePower() {
    this.power = !this.power;
    if (!this.power) {
      if (this.playing) this.player.stop();
      this.playing = false;
      this.recording = false;
      this.step = -1;
      this.#release();
      this.#say('**关机了**（真机会在这时自动保存）。再按住 [PLAY] 2 秒开机。看，按久了就是这个结果。');
    } else {
      this.#say('开机了。记住：[PLAY] **短按**是播放 / 停止，**按住 2 秒**才是开关机。');
    }
    this.#event('power', { on: this.power });
  }

  // ───────────── 手势 ─────────────

  /** 步进输入里，这个步进键对应的那一步现在有没有音 */
  #stepHas(id) {
    const tr = this.sel;
    if (!isStepKey(id) || this.stepMode !== tr) return false;
    // 选采样源的那几秒里方键 1–3 是采样源、Song 模式里方键是 scene：都不当“按住这一步”
    if (this.songMode || (this.#srcPick > performance.now() && /^DK[1-3]$/.test(id))) return false;
    return this.proj.synth[tr][this.proj.pat[tr]].has(this.page * 16 + Number(id.slice(2)) - 1);
  }

  #down(id) {
    audio.init();
    this.#ensureFx();
    this.emit('info', id);
    this.#consumed = null;
    if (!this.power) {
      if (id === 'PLAY') this.#armPower();
      else this.#say('机器关着。**按住 [PLAY] 2 秒**开机。');
      return;
    }
    // 正按住一个步进键（步进输入里的某一步）时去碰 ALL 旋钮：那是要转它来改音长，步进键继续按着
    if (isStepKey(this.held) && id === 'ALL') {
      this.#consumed = id;
      this.#say('现在**上下拖**这个 ALL 旋钮（或者用滚轮）：往上是把这个音拉长，往下是缩短。');
      return;
    }
    if (this.held === 'PAGE' && id === 'ALL' && this.songMode) {
      this.#consumed = id;
      this.#say('现在**上下拖**这个 ALL 旋钮（或者用滚轮）：改选中的这个 scene 有多长。模拟机上一格一小节（不到一小节时一格一拍），转到最左是 AUTO。');
      return;
    }
    if (this.held === 'OCTAVE' && id === 'ALL') {
      this.#consumed = id;
      this.#say('现在**上下拖**这个 ALL 旋钮（或者用滚轮）：往上升八度，往下降八度。');
      return;
    }
    // 真机上转完松手就行；模拟机上“按住”是锁着的：调完八度直接去按别的键，就当已经松开了 [OCTAVE]，那个键照常起作用
    if (this.held === 'OCTAVE' && id !== 'OCTAVE') this.#release();
    // 第 6 章：按住轨道旋钮（或 ALL）时——再按住 [PAGE] 准备粘贴；方键 1–6 先不动，松手时才知道是单按（换乐句）还是长按 2 秒（复制）
    const patMod = (TRACK[this.held] && !this.rtDrum) || this.held === 'ALL';
    if (patMod && id === 'PAGE' && !this.held2) {
      this.held2 = 'PAGE';
      this.#consumed = id;
      this.panel?.setHeld([this.held, 'PAGE']);
      this.#armLatchTimeout();
      this.#say(`按住了 ${nameOf(this.held)} 和 [PAGE]（两个黑圈）：现在点一个方键 = 把复制的乐句贴到那一段。`);
      return this.#render();
    }
    if (patMod && /^DK[1-6]$/.test(id)) {
      const mod = this.held;
      const n = Number(id.slice(2));
      this.#consumed = id;
      clearTimeout(this.#timers.patRelease);
      if (this.held2 === 'PAGE') {
        this.#release();
        this.#pastePattern(mod, n);
        return this.#render();
      }
      this.#dkHold = { mod, n, id, copied: false };
      this.#timers.dkcopy = setTimeout(() => {
        if (!this.#dkHold) return;
        this.#dkHold.copied = true;
        this.#release();
        this.#copyPattern(mod, n);
        this.#render();
      }, 2000);
      this.#say(`（按着第 ${n} 个方键……松手 = 换到第 ${n} 段；按满 2 秒 = 复制这一段。）`);
      return this.#render();
    }
    if (this.held && this.held !== id) {
      const mod = this.held;
      this.#release();
      this.#consumed = id;
      this.#combo(mod, id);
      this.#render();
      return;
    }
    if (this.held === id) {
      this.#release();
      this.#consumed = id;
      this.#say(`松开了 ${nameOf(id)}。`);
      this.#render();
      return;
    }
    // 步进输入里一个已经有音的步：和真机一样，按下去先不动，松手才把它关掉；长按半秒 = “按住它”
    if (this.#stepHas(id)) {
      this.#pendingStep = id;
      this.#timers.hold = setTimeout(() => this.#latch(id), 450);
      this.#render();
      return;
    }
    if (HOLDABLE.has(id)) this.#timers.hold = setTimeout(() => this.#latch(id), 450);
    if (id === 'PLAY') {
      this.#armPower();
      return;
    }
    if (id === 'PAGE' || id === 'OCTAVE') {
      this.#tapOnUp = id; // 松手时没变成“按住”，才算单按一下（[PAGE] 翻页、[OCTAVE] 升一格）；按住了就是功能键
      this.#render();
      return;
    }
    // 第 5 章：[REC SAMPLE] 单按 = 开始 / 结束采样；按满 2 秒 = 换采样源（亮起来的方键里选一个）
    if (id === 'RECSAMPLE') {
      this.#tapOnUp = id;
      this.#timers.reclong = setTimeout(() => {
        this.#tapOnUp = null;
        this.#srcPick = performance.now() + 8000;
        this.#say('按满了 2 秒：方键上亮着三个，是**采样源**——从左到右 内置麦克风 / AUDIO IN、USB、RESAMPLING（重采样），黄色是现在用的。点一个换过去。（真机上是哪三个方键手册没标，看哪三个亮；模拟机上是 1–3。）');
        this.#render();
      }, 2000);
      return;
    }
    // 右边 4 个旋钮的翻页键：单按 = 翻一页；长按 2 秒 = 进 / 出进阶设置（手册 3.11.1）
    if (id === 'SDPAGE') {
      this.#tapOnUp = id;
      this.#say('（按着翻页键……按满 2 秒是进出“进阶设置”，单按一下是翻页。）');
      this.#timers.sdlong = setTimeout(() => {
        this.#tapOnUp = null;
        this.#toggleAdvanced();
        this.#render();
      }, 2000);
      return;
    }
    this.#single(id);
    this.#render();
  }

  #up(id) {
    clearTimeout(this.#timers.hold);
    clearTimeout(this.#timers.repeatDelay);
    clearInterval(this.#timers.repeat);
    clearTimeout(this.#timers.sdlong);
    clearTimeout(this.#timers.reclong);
    if (this.#dkHold && this.#dkHold.id === id) {
      clearTimeout(this.#timers.dkcopy);
      const { mod, n, copied } = this.#dkHold;
      this.#dkHold = null;
      if (!copied) {
        // 真机上手还按着旋钮，可以接着双击：模拟机上“按住”再留半秒，半秒内再点同一个方键就是双击（手册 3.7.2）
        this.#tapPattern(mod, n);
        clearTimeout(this.#timers.patRelease);
        this.#timers.patRelease = setTimeout(() => {
          if (this.held === mod && !this.#dkHold) {
            this.#release();
            this.#render();
          }
        }, 600);
      }
      return this.#render();
    }
    if (id === 'PLAY') {
      clearTimeout(this.#timers.power);
      if (!this.#powerToggled && this.#consumed !== id) {
        if (this.power) this.#togglePlay();
        else this.#say('没开机：要**按住**满 2 秒才行。');
      }
      this.#powerToggled = false;
    }
    if (this.#pendingStep === id) {
      this.#pendingStep = null;
      if (this.held !== id && this.#consumed !== id) this.#drumKey(Number(id.slice(2)) - 1);
    }
    if (this.#tapOnUp === id) {
      this.#tapOnUp = null;
      if (this.held !== id && this.#consumed !== id && this.power) {
        if (id === 'PAGE') this.#pageTap();
        else if (id === 'SDPAGE') this.#sdPageTap();
        else if (id === 'RECSAMPLE') this.#recSample();
        else this.#single(id);
      }
    }
    this.#render();
  }

  #armPower() {
    this.#powerToggled = false;
    this.#timers.power = setTimeout(() => {
      this.#powerToggled = true;
      this.#togglePower();
      this.#render();
    }, 2000);
  }

  #latch(id) {
    clearTimeout(this.#timers.octave); // 新按住的，不受上一次转八度留下的“自己松开”影响
    this.held = id;
    this.panel?.setHeld([id]);
    this.#say(isStepKey(id)
      ? `已按住第 ${this.page * 16 + Number(id.slice(2))} 步（黑圈）。现在可以：**上下拖左上角的 ALL 旋钮** = 改这个音有多长；**点一个 Synth key** = 把这一步换成那个键的音。想放开就再点它一下。`
      : id === 'OCTAVE' ? '已按住 [OCTAVE]（黑圈）。现在**上下拖 ALL 旋钮**（或用滚轮）升降八度；想放开就再点它一下。'
        : `已按住 ${nameOf(id)}（黑圈）。现在点第二个键；想放开就再点它一下。`);
    this.#armLatchTimeout();
    this.#render();
  }

  #armLatchTimeout() {
    clearTimeout(this.#timers.latch);
    this.#timers.latch = setTimeout(() => {
      this.#release();
      this.#say('按住太久没有下一步，已经松开。');
      this.#render();
    }, 9000);
  }

  #release() {
    this.held = null;
    this.held2 = null;
    if (this.#lenShow) this.#meter = null; // 调音长时亮着的那几个小灯，松手就灭
    this.#lenShow = null;
    clearTimeout(this.#timers.latch);
    // 转完八度留下的“停 1.2 秒自己松开”也作废：不然很快地放完几个音、又按住 [OCTAVE] 时，它才到点，把新按住的也松开了，
    // 接着转 ALL 就成了“11 条轨道一起换乐句”（2026-11-11 走查 One Kiss 等四首时踩到的）
    clearTimeout(this.#timers.octave);
    this.panel?.setHeld([]);
  }

  #repeat(fn) {
    fn();
    this.#timers.repeatDelay = setTimeout(() => {
      this.#timers.repeat = setInterval(() => {
        fn();
        this.#render();
      }, 70);
    }, 400);
  }

  // ───────────── 单按 ─────────────

  #single(id) {
    const p = this.proj;
    // 第 7 章：混音台模式里按右边 4 个旋钮 = 选要调的是声像 / 音量 / 混响送多少 / 延迟送多少（手册 3.15.1）
    if (this.mixer && /^SD[1-4]$/.test(id)) return this.#mixSelect(Number(id.slice(2)) - 1);
    // 第 7 章：静音模式里直接按旋钮就是静音 / 取消（手册 3.15.2）
    if (this.muteMode && TRACK[id]) {
      const on = !p.mute.has(id);
      if (on) p.mute.add(id);
      else p.mute.delete(id);
      if (this.songMode) this.#storeScene();
      this.#say(on ? `静音了 ${TRACK[id].label}（灯变绿）。再按一下它就回来。` : `${TRACK[id].label} 回来了。`);
      return this.#event('mute', { track: id, on });
    }
    if (this.muteMode && id === 'ALL') {
      p.mute.clear();
      if (this.songMode) this.#storeScene();
      this.#say('静音模式里按 [ALL]：全部取消静音。');
      return this.#event('mute', { track: 'ALL', on: false });
    }
    if (this.muteMode && id === 'MUTE') return this.#setMuteMode(false);
    // 第 5 章：长按 [REC SAMPLE] 之后的那几秒里，方键 1–3 是采样源
    if (this.#srcPick > performance.now() && /^DK[1-3]$/.test(id)) return this.#pickSource(Number(id.slice(2)));
    // 第 6 章：Song / Scene 模式里方键是 scene
    if (this.songMode && isStepKey(id)) return this.#sceneKey(Number(id.slice(2)) - 1);
    if (TRACK[id]) {
      this.sel = id;
      this.page = 0;
      if (this.sdPage >= this.#pages(id)) this.sdPage = 0; // 比如从 DX 的第 5 页换到 SYNTH 1：它没有第 5 页
      if (this.stepMode && this.stepMode !== id) this.stepMode = null;
      if (!this.playing) {
        if (DRUMS.includes(id)) sound.drum(id, 0, 1);
        else this.#sound(id, [id === 'SAMPLER' ? 0 : synthKeyNote(1, { scale: p.scale, key: p.key, octave: p.octave[id] })], 0);
      }
      this.#say(`选中了 ${TRACK[id].label}（${TRACK[id].name}）。${this.playing ? '' : '机器停着的时候按旋钮，会试听它的声音。'}`);
      return this.#event('track', { track: id });
    }
    if (isStepKey(id)) return this.#drumKey(Number(id.slice(2)) - 1);
    if (/^SK\d$/.test(id) && this.sel === 'SAMPLER' && !this.rtDrum) return this.#selectSample(Number(id.slice(2)));
    if (/^SK\d$/.test(id)) return this.#synthKey(Number(id.slice(2)));
    switch (id) {
      case 'ALL':
        return this.#say('**ALL 旋钮**单按一下没有效果。它是“功能键”：长按把它按住，再点别的键；转动它，则是 11 条轨道一起换乐句。');
      case 'REC':
        this.recording = !this.recording;
        if (this.recording && !this.playing) this.#togglePlay();
        return this.#say(this.recording ? '**开始录音**（红灯）：现在按 Synth keys，弹的音会被记进当前这一步。再按一次录音键结束。' : '录音结束。');
      case 'VOL+':
      case 'VOL-':
        return this.#repeat(() => {
          this.volume = clamp(this.volume + (id === 'VOL+' ? 1 : -1), 0, 8);
          this.#applyTransport();
          this.#showBar(this.volume, 'VOLUME');
          this.#say(`音量 ${this.volume} / 8。右边那列小灯亮几个，就是多大声。`);
          this.#event('volume', { value: this.volume });
        });
      case 'BPM+':
      case 'BPM-':
        return this.#repeat(() => {
          p.tempo = clamp(p.tempo + (id === 'BPM+' ? 1 : -1), 5, 300);
          this.#applyTransport();
          this.#showBar(Math.max(1, Math.round((p.tempo / 300) * 8)));
          this.#say(`速度 **${p.tempo} BPM**。按住不放会连续变。`);
          this.#event('tempo', { bpm: p.tempo });
        });
      case 'SWING':
        p.swing = Math.min(58, p.swing + 10);
        this.#applyTransport();
        this.#showBar(Math.round(4 + (p.swing / 58) * 4));
        this.#say(`摇摆 ${p.swing}（最大 58）。每对十六分音符里的后一个被往后推了。想归零：长按 [DELETE]，再点 [SWING]。`);
        return this.#event('swing', { value: p.swing });
      case 'OCTAVE': {
        if (!KEYED.includes(this.sel)) return this.#say('八度只对合成器轨道有效。先点一下 **SYNTH 1 旋钮**。');
        const o = p.octave[this.sel] >= 2 ? -3 : p.octave[this.sel] + 1;
        p.octave[this.sel] = o;
        this.#showDots([o + 4]);
        this.#say(`${TRACK[this.sel].label} 的八度：${o > 0 ? `+${o}` : o}。数字越小声音越低，贝斯通常放在 −2 左右。`);
        return this.#event('octave', { track: this.sel, value: o });
      }
      case 'SCALE':
        p.scale = (p.scale + 1) % 8;
        this.#showDots([8 - p.scale]);
        this.#say(`音阶换成了 **${SCALES[p.scale].zh}**（${SCALES[p.scale].name}）：${SCALES[p.scale].mood}。`);
        return this.#event('scalekey', { scale: p.scale, key: p.key });
      case 'KEY': {
        p.key = (p.key + 1) % 12;
        const i = NATURALS.indexOf(p.key);
        const lower = NATURALS.filter((n) => n < p.key).length;
        this.#showDots(i >= 0 ? [i + 1] : [lower, lower + 1]);
        this.#say(`调换成了 **${KEY_NAMES[p.key]}**。小灯自下而上是 C D E F G A B；带 # 的调用相邻两个灯一起亮来表示。`);
        return this.#event('scalekey', { scale: p.scale, key: p.key });
      }
      case 'BARLENGTH':
        return this.#barLength();
      case 'MASTERSINGLE':
        this.fxSingle = !this.fxSingle;
        this.#say(this.fxSingle
          ? '[MASTER/SINGLE] 拨到了 **SINGLE**：现在 [FX] 旋钮、[FX LEVEL] 管的是**选中的那一条轨道**自己的效果（单轨效果）。它跟着音色走：换了音色，它也换成新音色自己的。'
          : '[MASTER/SINGLE] 拨回了 **MASTER**：[FX] 旋钮、[FX LEVEL] 又管整台机器了。');
        return this.#event('fxswitch', { single: this.fxSingle });
      case 'CLEARFX': {
        const fx = this.fxSingle ? this.proj.snd[this.sel]?.fx : this.masterFx;
        if (fx) fx.level = 0;
        this.#applyFx();
        this.#showBar(0);
        this.#say(`[CLEAR FX]：${this.fxSingle ? `${TRACK[this.sel].label} 的单轨效果` : '整台的效果'}收到了最小。`);
        return this.#event('clearfx', { single: this.fxSingle });
      }
      case 'UNDO':
        return this.#undoRedo();
      case 'FXLEVEL':
      case 'HIGHPASS':
      case 'REPEATER':
        return; // 触摸条要跟着手指走，见 mount() 里的 #slideFx
      default: {
        const info = controlInfo(id);
        return this.#say(info ? `${info.en}（${info.zh}）：${info.what.split('。')[0]}。模拟机里它只做介绍。` : '这个控件在模拟机里没有功能。');
      }
    }
  }

  /**
   * [BAR LENGTH]：当前这段乐句在 1 → 2 → 4 → 8 小节之间轮着换（和真机一样）。
   * 加长时，新的那几小节照着原来的抄一份（1 → 2 抄第 1 小节，2 → 4 抄前两小节……；那里已经有内容就不抄）。
   */
  #barLength() {
    const p = this.proj;
    const tr = this.sel;
    const pat = p.pat[tr];
    const was = p.bars[tr][pat];
    const next = was >= 8 ? 1 : was * 2;
    if (next > was) {
      const from = was * 16;
      if (DRUMS.includes(tr)) {
        const set = p.drums[tr][pat];
        const hasMore = [...set].some((s) => s >= from && s < next * 16);
        if (!hasMore) for (const s of [...set]) if (s < from) for (let k = 1; k < next / was; k++) set.add(s + k * from);
      } else {
        const map = p.synth[tr][pat];
        const hasMore = [...map.keys()].some((s) => s >= from && s < next * 16);
        if (!hasMore) for (const [s, e] of [...map]) if (s < from) for (let k = 1; k < next / was; k++) map.set(s + k * from, { ...e, notes: [...e.notes] });
      }
    }
    if (this.page >= next) this.page = 0;
    p.bars[tr][pat] = next;
    this.#showBar(next);
    this.#say(next > was
      ? `${TRACK[tr].label} 这段乐句加长到了 **${next} 小节**（${next * 16} 步）。新加的 ${next - was} 小节先照着前面抄了一份。步进键一页只显示 16 步：按一下 [PAGE] 翻到下一页。${next < 8 ? '再按 [BAR LENGTH] 还会接着加长（1、2、4、8 小节轮着换）。' : '再按一次就变回 1 小节。'}`
      : `${TRACK[tr].label} 这段乐句变回了 **1 小节**。后面几小节里的内容没有丢，再加长回来还在。`);
    this.#event('length', { track: tr, bars: next, steps: next * 16 });
  }

  /** 单按 [PAGE]：乐句超过 16 步时，换一页显示 */
  #pageTap() {
    const tr = this.sel;
    const bars = this.barsOf(tr) || 1;
    if (bars < 2) return this.#say(`${TRACK[tr].label} 这段乐句只有 16 步，一页就放得下。乐句加长到 2 小节以后，[PAGE] 才用来翻页。它更常用的是当“功能键”：长按把它按住，再点合成器轨的旋钮，进入步进输入。`);
    this.page = (this.page + 1) % bars;
    this.#showDots([this.page + 1]);
    this.#say(`${DRUMS.includes(tr) ? '方键' : '步进键'}翻到了**第 ${this.page + 1} 页**：现在这 16 个键是第 ${this.page * 16 + 1}–${this.page * 16 + 16} 步（第 ${this.page + 1} 小节）。${this.page + 1 < bars ? '再按一次 [PAGE] 翻到下一页。' : '再按一次 [PAGE] 回到第 1 页。'}`);
    this.#event('page', { page: this.page });
  }

  /** 现在弹第 n 个 Synth key，这条轨道会出哪几个音 */
  #notesFor(track, n) {
    const p = this.proj;
    if (track === 'SAMPLER') return [n - 1];
    const opts = { scale: p.scale, key: p.key, octave: p.octave[track] };
    return p.poly[track] === 2 ? chordNotes(n, opts) : [synthKeyNote(n, opts)];
  }

  #drumKey(i) {
    const p = this.proj;
    const tr = this.sel;
    if (DRUMS.includes(tr)) {
      const set = p.drums[tr][p.pat[tr]];
      const st = this.page * 16 + i;
      const on = !set.has(st);
      if (on) set.add(st);
      else set.delete(st);
      this.#say(on ? `在 ${TRACK[tr].label} 的**第 ${st + 1} 步**放了一个音（黄灯）。${this.playing ? '' : '短按 [PLAY] 听听看。'}` : `拿掉了 ${TRACK[tr].label} 第 ${st + 1} 步的音。`);
      return this.#event('step', { track: tr, step: st, on, steps: this.stepsOf(tr) });
    }
    if (this.stepMode === tr) {
      const step = this.page * 16 + i;
      const map = p.synth[tr][p.pat[tr]];
      const on = !map.has(step);
      if (on) {
        const last = this.lastPlayed[tr] || { notes: this.#notesFor(tr, 1), key: 1 };
        map.set(step, { notes: [...last.notes], key: last.key, len: 1 });
        this.#say(last.notes.length > 1
          ? `在 ${TRACK[tr].label} 的第 ${step + 1} 步放了“你最后按过的那个和弦”（Synth key ${last.key}：${noteNames(last.notes)}）。青蓝灯。`
          : `在 ${TRACK[tr].label} 的第 ${step + 1} 步放了“你最后按过的那个音”（青蓝灯）。`);
      } else {
        map.delete(step);
        this.#say(`拿掉了第 ${step + 1} 步的音。`);
      }
      return this.#event('step', { track: tr, step, on, steps: this.stepsOf(tr) });
    }
    return this.#say(`现在选中的是 ${TRACK[tr].label}，步进键不能直接给它填格子。先长按 [PAGE]，再点 **${TRACK[tr].label} 旋钮**，进入“步进输入”。`);
  }

  #synthKey(n) {
    const p = this.proj;
    this.#flash[`SK${n}`] = true;
    setTimeout(() => {
      delete this.#flash[`SK${n}`];
      this.#render();
    }, 160);
    let track = this.sel;
    if (this.rtDrum) {
      track = DRUMS[n - 1];
      sound.drum(track, 0, 1);
      if (this.recording && this.playing) p.drums[track][p.pat[track]].add(Math.max(0, this.step) % this.#lenOfTrack(track));
      this.#say(`${TRACK[track].label}（${TRACK[track].name}）。打鼓模式下，7 个键就是 7 面鼓。`);
      return this.#event('note', { track, key: n });
    }
    if (DRUMS.includes(track)) {
      return this.#say('现在选中的是鼓轨，这 7 个键没有声音。想用它们打鼓：长按任意一个鼓轨旋钮，再点一个 Synth key，进入“实时输入模式”。想弹旋律：先点 **SYNTH 1 旋钮**。');
    }
    const notes = this.#notesFor(track, n);
    const mode = p.poly[track];
    this.lastPlayed[track] = { notes, key: n };
    if (this.recording && this.playing) p.synth[track][p.pat[track]].set(Math.max(0, this.step) % this.#lenOfTrack(track), { notes: [...notes], key: n, len: 1 });
    const rec = this.recording ? '（已录进当前这一步）' : '';
    if (track === 'SAMPLER') {
      this.#sound(track, notes, 0);
      this.#say(`采样 ${n}。采样器的 7 个键各放一段录下来的声音。`);
      return this.#event('note', { track, key: n });
    }
    if (mode === 0) {
      // 单音：新的一个音响起来，上一个就被掐断
      this.#mono[track]?.();
      const off = audio.note(notes[0], 0, null, { voice: this.#voiceOf(track), tweak: this.#tweakOf(track) });
      const timer = setTimeout(off, 380);
      this.#mono[track] = () => {
        clearTimeout(timer);
        off();
      };
    } else {
      this.#sound(track, notes, 0, mode === 2 ? 0.7 : 1.1);
    }
    this.#event('note', { track, key: n });
    if (mode === 2) {
      this.#say(`Synth key ${n} 的和弦：**${noteNames(notes)}**——${notes.length} 个音一起响${chordName(notes) ? `（${chordName(notes)} 和弦）` : ''}。CHORD 状态下，一个键就是一整个和弦。${rec}`);
      return this.#event('chord', { track, notes, count: notes.length, key: n });
    }
    if (mode === 1) {
      // 复音：屏幕上没法几个键同时按，一秒之内连着点的就算“一起按”
      const now = performance.now();
      const c = this.#cluster && this.#cluster.track === track && now - this.#cluster.at < 1000 ? this.#cluster : (this.#cluster = { track, keys: new Set(), notes: new Set() });
      c.at = now;
      const grew = !c.keys.has(n);
      c.keys.add(n);
      c.notes.add(notes[0]);
      if (grew && c.keys.size >= 2) {
        const all = [...c.notes].sort((a, b) => a - b);
        this.#say(`Synth key ${[...c.keys].join('、')} 叠在一起：**${noteNames(all)}**。几个音同时响，就是一个**和弦**。${rec}`);
        return this.#event('chord', { track, notes: all, count: all.length });
      }
    }
    this.#say(`音阶的第 ${n} 个音（${midiToName(notes[0]).replace(/-?\d+$/, '')}）。7 个键从 1 到 7，由低到高。${mode === 1 ? '这条轨道是复音：一秒之内再点别的键，余音会叠在一起。' : ''}${rec}`);
  }

  // ───────────── 转动 ─────────────

  #turn(id, dir) {
    clearTimeout(this.#timers.hold);
    if (!this.power) return;
    const p = this.proj;
    this.emit('info', id);
    // 按住步进输入里的一步，再转 ALL：改这一步的音有多长
    if (id === 'ALL' && isStepKey(this.held) && this.stepMode) return this.#stepLength(dir);
    // 第 5 章：按住采样器步进输入里亮着的一步，再转第 1 页的旋钮 2 = 只给这一步锁一个音高（紫色）
    if (id === 'SD2' && isStepKey(this.held) && this.stepMode === 'SAMPLER' && this.sdPage === 0) return this.#lockPitch(dir);
    // 按住 [OCTAVE] 再转 ALL：八度一格一格升降（V2.00 的做法，手册 3.5.3；单按 [OCTAVE] 只会往上走、到 +2 绕回 −3）
    if (id === 'ALL' && this.held === 'OCTAVE') return this.#octaveTurn(dir);
    if (id === 'ALL' && this.held === 'PAGE' && this.songMode) return this.#sceneLength(dir);
    if (this.mixer && (TRACK[id] || id === 'ALL')) return this.#mixTurn(id, dir);
    if (TRACK[id]) {
      p.pat[id] = clamp(p.pat[id] + dir, 0, p.slots - 1);
      this.page = 0;
      this.panel?.setKnob(id, p.pat[id] * 45);
      if (this.songMode) this.#storeScene();
      this.#say(`${TRACK[id].label} 换到了**第 ${p.pat[id] + 1} 段乐句**。${this.songMode ? `（记进了 scene ${p.scene + 1}）` : '每条轨道有好几段，互不影响；刚才的内容还在第 1 段，往回转就能找到。'}`);
      this.#event('pattern', { track: id, pattern: p.pat[id] });
    } else if (id === 'ALL') {
      for (const t of ALL_TRACKS) {
        p.pat[t] = clamp(p.pat[t] + dir, 0, p.slots - 1);
        this.panel?.setKnob(t, p.pat[t] * 45);
      }
      this.page = 0;
      if (this.songMode) this.#storeScene();
      this.#say('11 条轨道一起换了一段乐句。现场演出时，这就是从“主歌”切到“副歌”的办法。');
      this.#event('pattern', { track: 'ALL', pattern: p.pat.KICK });
    } else if (/^SD[1-4]$/.test(id) && this.sdPage > 0) {
      // 翻到第 2 页以后（或进阶设置里的第 3–5 页），4 个旋钮管的是别的参数
      this.#turnParam(Number(id.slice(2)) - 1, dir);
    } else if (id === 'SD1' && KEYED.includes(this.sel)) {
      // 合成器轨：真的换到音色表里的下一个 / 上一个
      this.#loadSound(this.sel, soundAt(this.sel, p.snd[this.sel].i + dir), `给 ${TRACK[this.sel].label} **换了一个音色**（“SOUND”亮了）`);
    } else if (id === 'SD1') {
      this.#index = 'SOUND';
      this.#meterLater();
      this.#say(this.sel === 'SAMPLER'
        ? `给采样位 ${this.sampleKey} **换了一个预置采样**（“SOUND”亮了）。模拟机里采样器的预置声音换不出变化；真机上有 392 个预置采样可以挑（人声、音效、打击乐……）。`
        : `给 ${TRACK[this.sel].label} **换了一个音色**（“SOUND”亮了）。模拟机里鼓轨只有一种声音，真机上这里有几百个可以挑。`);
      this.#event('sound', { track: this.sel });
    } else if (id === 'SD2' && KEYED.includes(this.sel)) {
      // 合成器轨第 1 页的旋钮 2：单音 / 复音 / 和弦
      const mode = clamp(p.poly[this.sel] + dir, 0, 2);
      p.poly[this.sel] = mode;
      this.#cluster = null;
      this.#showDots([8 - mode]); // 最上面三个灯：MONO、POLY、CHORD
      this.#index = mode === 2 ? 'CHORD' : 'MONO/POLY';
      const m = POLY_MODES[mode];
      this.#say(`${TRACK[this.sel].label} 的弹法：**${m.name}（${m.zh}）**——${m.what}。${mode === 2 ? '按一个 Synth key 试试。' : '继续往上拖，可以转到 CHORD。'}（右边那列文字里亮的是 “${mode === 2 ? 'CHORD' : 'MONO/POLY'}”，小灯最上面三个从上到下是 MONO、POLY、CHORD。）`);
      this.#event('polymode', { track: this.sel, mode });
    } else if (id === 'SD2' && this.sel === 'SAMPLER') {
      this.#turnSamplePitch(dir);
    } else if (id === 'SD2' || id === 'SD3' || id === 'SD4') {
      const param = { SD2: ['PITCH', '音高'], SD3: ['PAN', '声像（偏左还是偏右）'], SD4: ['VOLUME', '这条轨道的音量'] }[id];
      this.#index = param[0];
      this.#meterLater();
      this.#say(`这个旋钮现在调的是**${param[1]}**，所以“${param[0]}”亮了。模拟机里只做演示。`);
    } else if (id === 'FX') {
      this.#turnFx(dir);
    }
    this.#render();
  }

  // ───────────── 第 4 章：音色、4 个旋钮的翻页、参数、存音色、单轨效果 ─────────────

  /** 给某条合成器轨换上一个音色。拧过的参数、单轨效果、弹法都换成新音色自己的（和真机一样，见文件开头） */
  #loadSound(track, sound, how) {
    const p = this.proj;
    const before = p.snd[track];
    const lost = !!before && (PARAMS.some((k) => before.edits[k]) || (before.fx.idx >= 0 && before.fx.level > 0.02));
    p.snd[track] = sound;
    this.#undo = this.#undo.filter((u) => u.track !== track); // [UNDO/REDO] 撤不回换音色（手册 3.9），也别撤到旧音色的参数上去
    this.#redo = null;
    const note = this.#soundResetsPoly(sound.poly);
    this.#index = 'SOUND';
    this.#meterLater();
    this.#say(`${how}：**${sound.name}**。${lost ? '刚才在旧音色上拧过的（第 2 页那几样、单轨效果）都换成了新音色自己的样子——想留着，换之前先存下来：按住 [ALL] 再按 SOUND 旋钮。' : ''}${note}`);
    this.#event('sound', { track });
    this.#event('soundname', { track, name: sound.name });
  }

  /** 单按翻页键：在这条轨道能翻的几页之间轮着换（不在进阶设置里是 2 页） */
  #sdPageTap() {
    const pages = this.#pages();
    this.sdPage = (this.sdPage + 1) % pages;
    this.#showDots([8 - this.sdPage]); // 那列小灯：最上面 = 第 1 页，往下一个 = 第 2 页……
    const smp = this.sel === 'SAMPLER';
    const what = [smp ? '换预置采样、变调（PITCH）、声像、音量' : '音色、弹法（鼓轨上是音高）、声像、音量', '起音、衰减、滤波器、共鸣', '混响、延迟送多少，高频、低频',
      KEYED.includes(this.sel) ? '滑音，琶音器的类型、长短、快慢' : smp ? '采样的起点（START）、终点（END）、循环开关（LOOP）、循环长度（Index 亮 OTHER）' : '（这条轨道没有这一页）',
      smp ? '音高包络（PEG：音高随时间怎么变；模拟机里只做演示）' : 'DX 的 FM：算法、调制量、调制频率、反馈'][this.sdPage];
    this.#say(`右边 4 个旋钮翻到了**第 ${this.sdPage + 1} 页**（那列小灯从上往下第 ${this.sdPage + 1} 个亮）：${what}。${this.sdPage === 0 ? '' : '换音色、切弹法要回到第 1 页。'}${pages > 2 ? '' : '再按一下回到第 ' + (this.sdPage === 0 ? 2 : 1) + ' 页。'}`);
    this.#event('sdpage', { page: this.sdPage });
  }

  /** 长按翻页键 2 秒：进 / 出进阶设置（多出第 3 页起的几页） */
  #toggleAdvanced() {
    this.sdAdvanced = !this.sdAdvanced;
    const pageWas = this.sdPage;
    if (!this.sdAdvanced && this.sdPage >= 2) this.sdPage = 0;
    this.#say(this.sdAdvanced
      ? '按满了 2 秒：进了**进阶设置**。现在单按翻页键能翻到更多页——合成器轨一共 4 页，**DX 5 页**（第 5 页是 FM），采样器也是 5 页（第 4 页剪头尾、循环）。用完再长按 2 秒出来。'
      : '又按满了 2 秒：出了进阶设置，翻页键又只在第 1、2 页之间换了。');
    this.#event('sdmode', { advanced: this.sdAdvanced });
    if (pageWas !== this.sdPage) this.#event('sdpage', { page: this.sdPage });
  }

  /** 第 2 页起的旋钮：拧一个参数。合成器轨上真的会变声音；鼓轨、采样器在模拟机里只做演示 */
  #turnParam(k, dir) {
    const tr = this.sel;
    const page = this.sdPage;
    if (tr === 'SAMPLER' && page === 3) return this.#turnSampleParam(k, dir);
    const def = SD_PAGE_PARAMS[page]?.[k];
    if (!def) return;
    const [param, index, what] = def;
    this.#index = index;
    if (!KEYED.includes(tr)) {
      this.#meterLater();
      return this.#say(`第 ${page + 1} 页的旋钮 ${k + 1} 调的是**${what}**（${index} 亮了）。模拟机里鼓和采样器的声音不跟着变，三条合成器轨上才真的会变。`);
    }
    const s = this.proj.snd[tr];
    const whole = param === 'fmAlg' || param === 'arp';
    const [min, max] = whole ? [0, param === 'fmAlg' ? 11 : 15] : [-64, 63];
    const before = s.edits[param];
    const v = clamp(before + dir * (whole ? 1 : 4), min, max);
    if (v === before) {
      this.#meterLater();
      return this.#say(`${index} 已经拧到头了。`);
    }
    s.edits[param] = v;
    if (param === 'rev' || param === 'dly') this.#applyMix(); // 第 7 章：送多少去混响 / 延迟，模拟机里听得出来
    this.#remember(tr, param, before, v);
    this.#meter = Object.fromEntries(Array.from({ length: clamp(Math.round(((v - min) / (max - min)) * 8), 1, 8) }, (_, i) => [`METER.${i + 1}`, 'white']));
    this.#meterLater();
    const demo = ['rev', 'dly', 'eqHi', 'eqLo', 'porta', 'arp', 'arpGate', 'arpSpeed', 'fmAlg'].includes(param) ? '模拟机里这一样只做演示，声音不变。' : '';
    const way = param === 'cutoff' && !this.#toldFilter ? '（模拟机上往下拖是闷、往上拖是薄；真机上那个旋钮往哪边是哪边，手册没写，转着听。）' : '';
    if (param === 'cutoff') this.#toldFilter = true;
    this.#say(`${TRACK[tr].label} · **${index}**：${what}。现在 **${paramWords(param, v)}**${v === 0 ? '' : `（${v > 0 ? '+' : ''}${v}）`}。${way}${demo}${this.playing ? '' : '按 Synth keys 或 [PLAY] 听。'}`);
    this.#event('param', { track: tr, param, value: v });
  }

  #toldFilter = false;

  /** 记下拧了什么，给 [UNDO/REDO]。连着拧同一个旋钮的那一阵算一下 */
  #remember(track, param, before, after) {
    const now = performance.now();
    const b = this.#undoBurst;
    if (b && b.track === track && b.param === param && now - b.at < 1500 && this.#undo.at(-1) === b) {
      b.after = after;
      b.at = now;
    } else {
      this.#undoBurst = { track, param, before, after, at: now };
      this.#undo.push(this.#undoBurst);
      if (this.#undo.length > 30) this.#undo.shift();
    }
    this.#redo = null;
  }

  /** [UNDO/REDO]：按一次撤销刚才拧的那一下，再按一次重做（真机上具体怎么分，手册没写） */
  #undoRedo() {
    const set = (u, v) => {
      const s = this.proj.snd[u.track];
      if (!s) return;
      s.edits[u.param] = v;
      this.#event('param', { track: u.track, param: u.param, value: v });
    };
    if (this.#redo) {
      const u = this.#redo;
      this.#redo = null;
      set(u, u.after);
      this.#undo.push(u);
      this.#say(`[UNDO/REDO] 又按了一次：刚才撤销的那一下**重做**回来了（${paramWords(u.param, u.after)}）。`);
      return this.#event('undo', { redo: true });
    }
    const u = this.#undo.pop();
    this.#undoBurst = null;
    if (!u) return this.#say('[UNDO/REDO]：现在没有可以撤销的。它只管拧音色和效果的参数——撤不回“换音色”，也救不回删掉的音符。');
    set(u, u.before);
    this.#redo = u;
    this.#say(`[UNDO/REDO]：**撤销**了刚才拧的 ${TRACK[u.track].label} 的那一下，回到了“${paramWords(u.param, u.before)}”。再按一次是重做。（模拟机上是这样分的；真机上一个键怎么分撤销和重做，手册没写。）`);
    this.#event('undo', { redo: false });
  }

  /** 按住 [ALL] 再按 SOUND 旋钮：把这条轨道现在的音色（连同拧过的）存成一个新的，名字加 _edit01（手册 3.11.4） */
  #saveSound() {
    const tr = this.sel;
    if (tr === 'SAMPLER') {
      // 采样器存的是选中的那个采样位（手册 3.13.9：编辑完记得存）
      const smp = this.proj.samples[this.sampleKey - 1];
      smp.name = `${smp.name.replace(/_edit\d+$/, '')}_edit01`;
      this.#meter = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`METER.${i + 1}`, 'white']));
      this.#meterLater();
      this.#say(`**存好了**：采样位 ${this.sampleKey} 的「${smp.name}」存了下来（小灯白色闪一下）。不存的话，往这个位上再录一段，刚才那段就没了。`);
      this.#event('soundsave', { track: tr, name: smp.name });
      return this.#event('soundname', { track: tr, name: smp.name });
    }
    const s = this.proj.snd[tr];
    if (!s) return this.#say('模拟机里只有三条合成器轨（SYNTH 1、SYNTH 2、DX）能存音色。先选中其中一条。');
    const base = s.name.replace(/_edit\d+$/, '');
    const n = this.favorites.filter((f) => f.name.startsWith(`${base}_edit`)).length + 1;
    const name = `${base}_edit${String(n).padStart(2, '0')}`;
    const copy = { ...s, name, edits: { ...s.edits }, fx: { ...s.fx }, saved: true };
    this.proj.snd[tr] = copy;
    this.favorites.push({ ...copy, dx: tr === 'DX', edits: { ...copy.edits }, fx: { ...copy.fx } });
    this.#meter = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`METER.${i + 1}`, 'white']));
    this.#meterLater();
    this.#say(`**存好了**：${TRACK[tr].label} 现在的音色存成了「**${name}**」（右边那列小灯白色闪一下 = 存好了）。它排在原来那个音色后面，也自动放进了收藏：以后按住 SOUND 旋钮再按第 16 个方键，就能跳到它。`);
    this.#event('soundsave', { track: tr, name });
    this.#event('soundname', { track: tr, name });
  }

  /** [FX] 旋钮：在 8 类 × 8 个效果预设里一格一格走。SINGLE 时改的是选中这条轨道的单轨效果，MASTER 时是整台的 */
  #turnFx(dir) {
    const target = this.fxSingle ? this.proj.snd[this.sel]?.fx : this.masterFx;
    if (!target) return this.#say('模拟机里只有三条合成器轨有单轨效果。先选一条合成器轨（SYNTH 1、SYNTH 2 或 DX），或者把 [MASTER/SINGLE] 拨回 MASTER。');
    target.idx = clamp(target.idx + dir, 0, 63);
    if (!this.fxSingle) this.#applyFx();
    const cat = FX_CATS[Math.floor(target.idx / 8)];
    const preset = target.idx % 8;
    this.#index = cat;
    this.#meter = { [`METER.${preset + 1}`]: 'cyan' };
    this.#meterLater();
    const mod = cat === 'MODULATION';
    const whose = this.fxSingle ? `${TRACK[this.sel].label} 的单轨效果` : '整台的效果（MASTER）';
    const masterHeard = !this.fxSingle && ['FILTER', 'REVERB', 'DELAY'].includes(cat);
    this.#say(`${whose}：**${cat}** 这一类的第 ${preset + 1} 个${mod ? `（${MOD_PRESETS[preset]}：${MOD_ZH[preset]}）` : ''}。${mod && this.fxSingle ? '用 [FX LEVEL] 加多少。' : mod ? '要只加在一条轨道上，先把 [MASTER/SINGLE] 拨到 SINGLE。' : masterHeard ? '用 [FX LEVEL] 加多少。' : '一直往一个方向转，Index 上的字会一行一行往下走。模拟机里能听的是 MASTER 上的 FILTER、REVERB、DELAY，和 SINGLE 上的 MODULATION。'}`);
    this.#event('fxtype', { cat, preset, single: this.fxSingle });
  }

  /** 手指在 [FX LEVEL] 上滑：加多少 */
  #slideFx(e) {
    const { rect, id } = this.#slide;
    const v = clamp(1 - (e.clientY - rect.top) / rect.height, 0, 1);
    if (id === 'HIGHPASS' || id === 'REPEATER') return this.#slideLive(id, v);
    const target = this.fxSingle ? this.proj.snd[this.sel]?.fx : this.masterFx;
    if (!target) return this.#say('模拟机里只有三条合成器轨有单轨效果。先选一条合成器轨，或者把 [MASTER/SINGLE] 拨回 MASTER。');
    target.level = v;
    const cat = target.idx >= 0 ? FX_CATS[Math.floor(target.idx / 8)] : null;
    this.#index = cat;
    this.#meter = Object.fromEntries(Array.from({ length: Math.round(v * 8) }, (_, i) => [`METER.${i + 1}`, 'white']));
    this.#meterLater();
    const pct = Math.round(v * 100);
    if (!this.fxSingle) this.#applyFx();
    const heard = !this.fxSingle && ['FILTER', 'REVERB', 'DELAY'].includes(cat);
    this.#say(!cat ? `[FX LEVEL] 推到了 ${pct}%，可现在还没选效果：先转 [FX] 旋钮。`
      : cat === 'MODULATION' && this.fxSingle ? `${TRACK[this.sel].label} 的 ${MOD_PRESETS[target.idx % 8]} 加到了 **${pct}%**。${this.playing ? '' : '按 [PLAY] 或弹 Synth keys 听它摆。'}`
        : heard ? `整台的 ${cat} 加到了 **${pct}%**。${this.playing ? '' : '按 [PLAY] 听。'}这个推上去就留在那儿；想一下收回，按 [CLEAR FX]。`
          : `[FX LEVEL] 推到了 ${pct}%（${cat}）。模拟机里这一类只做演示，听不出变化（模拟机能听的是 MASTER 上的 FILTER、REVERB、DELAY，和 SINGLE 上的 MODULATION）。`);
    this.#event('fxlevel', { value: v, single: this.fxSingle });
    this.#render();
  }

  /**
   * 真机上“单音 / 复音 / 和弦”是存在音色里的：换了音色，它就变成新音色自己的设定（实测）。
   * 模拟机照这个规矩来：换音色后把弹法设成 mode，并返回一句要补在解说后面的话。
   */
  #soundResetsPoly(mode) {
    const tr = this.sel;
    if (!KEYED.includes(tr)) return '';
    const was = this.proj.poly[tr];
    this.proj.poly[tr] = mode;
    this.#cluster = null;
    if (was === mode) return '';
    this.#event('polymode', { track: tr, mode });
    return was === 2
      ? `**注意：弹法变回了 ${POLY_MODES[mode].name}。**这个开关是存在音色里的，换了音色它就跟着新音色走：想要和弦，再转一次旋钮 2。`
      : `这个音色自己的弹法是 ${POLY_MODES[mode].name}（${POLY_MODES[mode].zh}）。`;
  }

  #octaveTurn(dir) {
    const p = this.proj;
    if (!KEYED.includes(this.sel)) return this.#say('八度只对合成器轨道有效。先点一下 **SYNTH 1 旋钮**（或 SYNTH 2、DX）。');
    const o = clamp(p.octave[this.sel] + dir, -3, 2);
    if (o === p.octave[this.sel]) return this.#say(`已经到头了：八度只能在 −3 到 +2 之间。`);
    p.octave[this.sel] = o;
    this.#showDots([o + 4]);
    this.#armLatchTimeout();
    // 真机上转完手一松就结束了；模拟机上“按住”是锁着的，停 1.2 秒没再转就自己松开——不然紧接着再长按 [OCTAVE]（比如马上要降回来）
    // 反而是把它松开，接着转 ALL 就成了“11 条轨道一起换乐句”（2026-11-11 走查时踩到的）
    clearTimeout(this.#timers.octave);
    this.#timers.octave = setTimeout(() => {
      if (this.held !== 'OCTAVE') return;
      this.#release();
      this.#render();
    }, 1200);
    this.#say(`${TRACK[this.sel].label} 的八度：**${o > 0 ? `+${o}` : o}**（右边那列小灯，自下而上是 −3 到 +2）。停一下就当松开了；接着按别的键也行。`);
    this.#event('octave', { track: this.sel, value: o });
    this.#render();
  }

  #stepLength(dir) {
    const p = this.proj;
    const tr = this.stepMode;
    const step = this.page * 16 + Number(this.held.slice(2)) - 1;
    const e = p.synth[tr][p.pat[tr]].get(step);
    if (!e) return;
    e.len = clamp((e.len || 1) + dir, 1, this.#lenOfTrack(tr));
    this.#lenShow = { step, len: e.len };
    this.#meter = Object.fromEntries(Array.from({ length: clamp(Math.ceil(e.len / 2), 1, 8) }, (_, i) => [`METER.${i + 1}`, 'cyan']));
    this.#armLatchTimeout();
    this.#say(`第 ${step + 1} 步的音现在长 **${e.len} 步**${e.len % 4 === 0 ? `（${e.len / 4} 拍）` : ''}：亮着的那一串步进键就是它占的地方。调好了，再点一下被按住的那个键松开。`);
    this.#event('notelen', { track: tr, step, len: e.len });
    this.#render();
  }

  // ───────────── 组合键：先按住 mod，再点 id ─────────────

  #combo(mod, id) {
    const p = this.proj;
    // 第 7 章：[PROJECT↑] + 当前工程的方键 = 临时保存；+ 它正下方那个 = 恢复（手册 3.10.3）
    if (mod === 'PROJECT' && id === `DK${this.project + 1}`) return this.#tempSaveProject();
    if (mod === 'PROJECT' && id === `DK${this.project + 9}`) return this.#tempRestore();
    if (mod === 'PROJECT' && /^DK[1-8]$/.test(id)) {
      const n = Number(id.slice(2));
      if (this.playing) {
        this.player.stop();
        this.playing = false;
        this.recording = false;
        this.step = -1;
      }
      this.project = n - 1;
      this.stepMode = null;
      this.page = 0;
      this.#applyTransport();
      ALL_TRACKS.forEach((t) => this.panel?.setKnob(t, this.proj.pat[t] * 45));
      this.#say(`切到了 **${n} 号工程**${n <= 3 ? '（演示曲）' : '（空白的：只有孤零零的一下底鼓）'}。换工程会停止播放。`);
      return this.#event('project', { index: n - 1 });
    }
    // 步进输入里：按住一步，再按 Synth key = 把那个键的音加进这一步 / 拿掉；CHORD 状态下是整个换成那个和弦（手册 7.9）
    if (isStepKey(mod) && /^SK\d$/.test(id) && this.stepMode) return this.#stepAssign(this.page * 16 + Number(mod.slice(2)) - 1, Number(id.slice(2)));
    if (mod === 'DELETE' && TRACK[id]) {
      (DRUMS.includes(id) ? p.drums[id] : p.synth[id])[p.pat[id]].clear();
      this.#red = id;
      setTimeout(() => {
        this.#red = null;
        this.#render();
      }, 700);
      this.#say(`清空了 ${TRACK[id].label} 当前这段乐句（灯闪红）。真机上这一步不能撤销。`);
      return this.#event('delete', { track: id });
    }
    if (mod === 'DELETE' && id === 'ALL') {
      for (const t of ALL_TRACKS) (DRUMS.includes(t) ? p.drums[t] : p.synth[t])[p.pat[t]].clear();
      this.#say('清空了全部轨道当前的乐句。');
      return this.#event('delete', { track: 'ALL' });
    }
    if (mod === 'DELETE' && id === 'SWING') {
      p.swing = 0;
      this.#applyTransport();
      this.#showBar(4);
      this.#say('摇摆归零：节奏又变回笔直的了。');
      return this.#event('swing', { value: 0 });
    }
    if (mod === 'MUTE' && TRACK[id]) {
      const on = !p.mute.has(id);
      if (on) p.mute.add(id);
      else p.mute.delete(id);
      if (this.songMode) this.#storeScene();
      this.#say(on ? `**静音**了 ${TRACK[id].label}（灯变绿）。同样的操作再做一次就恢复。${this.songMode ? `（记进了 scene ${p.scene + 1}）` : ''}` : `${TRACK[id].label} 恢复出声。${this.songMode ? `（记进了 scene ${p.scene + 1}）` : ''}`);
      return this.#event('mute', { track: id, on });
    }
    if (mod === 'MUTE' && id === 'ALL') {
      p.mute.clear();
      if (this.songMode) this.#storeScene();
      this.#say('全部取消静音。');
      return this.#event('mute', { track: 'ALL', on: false });
    }
    if (mod === 'SOLO' && TRACK[id]) {
      p.solo = p.solo === id ? null : id;
      this.#say(p.solo ? `**独奏** ${TRACK[id].label}（灯变青蓝）：现在只听得到它一个。再做一次取消。` : '取消独奏，大家都回来了。');
      return this.#event('solo', { track: p.solo });
    }
    if (DRUMS.includes(mod) && /^SK\d$/.test(id)) {
      this.rtDrum = !this.rtDrum;
      this.#say(this.rtDrum ? '进入**实时输入模式**：现在 7 个 Synth keys 是 7 面鼓——上排 1 底鼓、2 军鼓、3 拍手，下排 4 闭镲、5 开镲、6 和 7 打击乐。用同样的操作退出。' : '退出了实时输入模式，Synth keys 变回琴键。');
      return this.#event('mode', { mode: 'realtime', on: this.rtDrum });
    }
    if (mod === 'PAGE' && SYNTHS.includes(id)) {
      this.stepMode = this.stepMode === id ? null : id;
      this.sel = id;
      this.page = 0;
      const chord = p.poly[id] === 2;
      this.#say(this.stepMode ? `${TRACK[id].label} 进入**步进输入**：先按一个 Synth key 定下“放${chord ? '哪个和弦' : '哪个音'}”，再按步进键把它放进格子（青蓝灯）。同样的操作退出。` : '退出了步进输入。');
      return this.#event('mode', { mode: 'stepinput', on: !!this.stepMode, track: id });
    }
    if (mod === 'ALL' && id === 'BPM+') {
      this.metronome = !this.metronome;
      this.#showBar(this.metronome ? 8 : 0);
      this.#say(this.metronome ? '**节拍器开了**：播放时每拍“嘀”一声，小节的第 1 拍音更高。' : '节拍器关了。');
      return this.#event('metronome', { on: this.metronome });
    }
    if (mod === 'ALL' && id === 'PLAY') {
      this.#showBar(7);
      return this.#say('这是看电量的组合键。模拟机永远有电；真机上白灯 = 没在充电，青蓝 = 正在充电。');
    }
    if (mod === 'ALL' && id === 'REC') return this.#say('这是开关“量化”的组合键：量化开着时，录进去的音会自动对齐到最近的格子。默认是开的。');
    if (mod === 'ALL' && id === 'SD1') return this.#saveSound();
    if (mod === 'ALL' && id === 'PROJECT') return this.#cycleSongMode();
    if (mod === 'ALL' && id === 'MUTE') return this.#setMuteMode(!this.muteMode);
    if (mod === 'ALL' && id === 'VOL+') {
      this.mixer = !this.mixer;
      this.#say(this.mixer
        ? '进了**混音台模式**（Index 上 MIXER 亮）：按右边 4 个旋钮里的一个选要调的（自上而下 声像 / 音量 / 混响送多少 / 延迟送多少），再转各条轨道的旋钮调它。模拟机里这个模式只做演示，声音不变。同样的组合键退出。'
        : '退出了混音台模式：轨道旋钮又是换乐句了。');
      return this.#event('mixer', { on: this.mixer });
    }
    if (mod === 'ALL' && id === 'RECSAMPLE') return this.#say('这是开关“采样前的预备拍（count-in）”的组合键：开着的话，按 [REC SAMPLE] 之后先响几下节拍再开始录。小灯白色亮 = 开。模拟机里只做演示。');
    if (mod === 'RECSAMPLE' && id === 'VOL+') return this.#say('这是“监听模式”：采样器的三个灯白色闪，右边那列小灯显示进来的声音有多大，录之前先试试音量。模拟机里只做演示。');
    if (mod === 'DELETE' && id === 'RECSAMPLE') return this.#cancelSample();
    if (mod === 'DELETE' && /^SK\d$/.test(id) && this.sel === 'SAMPLER') return this.#deleteSampleSeq(Number(id.slice(2)));
    if (mod === 'DELETE' && isStepKey(id) && this.songMode) {
      const i = Number(id.slice(2)) - 1;
      const p2 = this.proj;
      if (i >= p2.scenes.length) return this.#say('那个方键上没有 scene。');
      if (this.playing && i === p2.scene) return this.#say('正在放的 scene 不能删（手册 3.14.7）：先停下来，或者先选别的。');
      p2.scenes.splice(i, 1);
      p2.scene = Math.min(p2.scene, Math.max(0, p2.scenes.length - 1));
      this.#say(`删掉了 scene ${i + 1}，后面的往前挪了一位。`);
      return this.#event('scene', { index: p2.scene, count: p2.scenes.length, deleted: true });
    }
    if (mod === 'ALL' && /^SK\d$/.test(id)) {
      return this.#say(KEYED.includes(this.sel) && p.poly[this.sel] === 2
        ? '这是“编辑和弦”的组合键：真机上，CHORD 状态下按住 ALL 再按一个 Synth key，步进键会变成一排琴键，可以改这个和弦里有哪几个音（最多 4 个）。模拟机里没有做这个功能，这一章也用不到。'
        : '按住 ALL 再按 Synth key，是 CHORD 状态下“编辑和弦”的组合键。现在这条轨道不在 CHORD 上，没有效果。');
    }
    if (mod === 'SD1' && isStepKey(id) && KEYED.includes(this.sel)) {
      // 合成器轨：跳到这一类的第一个模拟音色；第 16 个是收藏（存过的音色）
      const n = Number(id.slice(2));
      const tr = this.sel;
      const cat = SYNTH_CATEGORIES[n - 1];
      if (n === 16) {
        const fav = this.favorites.find((f) => f.dx === (tr === 'DX'));
        if (!fav) return this.#say('第 16 个方键是 **FAVORITE（收藏）**：你存过的音色都在这里。现在一个都还没存过（真机上这时这个键不亮）。存音色：按住 [ALL] 再按 SOUND 旋钮。');
        return this.#loadSound(tr, { ...fav, edits: { ...fav.edits }, fx: { ...fav.fx } }, '跳到了「收藏」里你存过的音色');
      }
      const list = tr === 'DX' ? DX_SOUNDS : AWM_SOUNDS;
      const i = list.findIndex((s) => s[0] === n - 1);
      if (i < 0) return this.#say(`模拟机的 ${TRACK[tr].label} 里没有「${cat}」这一类（真机上 DX 只有 FM 的音色，有的类别可能没有，那个键就不亮）。换一类试试。`);
      return this.#loadSound(tr, soundAt(tr, i), `跳到了「${cat}」这一类的第一个音色`);
    }
    if (mod === 'SD1' && isStepKey(id)) {
      const n = Number(id.slice(2));
      const drum = DRUMS.includes(this.sel);
      const cat = (drum ? DRUM_CATEGORIES : SYNTH_CATEGORIES)[n - 1];
      this.#index = 'SOUND';
      this.#meterLater();
      // 贝斯和主奏这两类音色多半是单音的，别的多半是复音（真机上每个音色各有各的设定，以屏幕上的读数为准）
      const note = drum ? '' : this.#soundResetsPoly(n <= 2 ? 0 : 1);
      this.#say(`跳到了「${cat}」这一类的第一个音色。音色太多转不过来时，就用这个办法按类别跳。${note}`);
      return this.#event('sound', { track: this.sel });
    }
    this.#say(`${nameOf(mod)} + ${nameOf(id)} 这个组合在模拟机里没有效果。`);
  }

  #stepAssign(step, n) {
    const p = this.proj;
    const tr = this.stepMode;
    const map = p.synth[tr][p.pat[tr]];
    const e = map.get(step);
    const notes = this.#notesFor(tr, n);
    this.#sound(tr, notes, 0, 0.6);
    this.lastPlayed[tr] = { notes, key: n };
    if (tr !== 'SAMPLER' && p.poly[tr] === 2) {
      if (e && sameNotes(e.notes, notes)) {
        map.delete(step);
        this.#say(`第 ${step + 1} 步里放的本来就是 Synth key ${n} 的和弦：照机器的规矩，再按一次就是把它**拿掉**。想放回去，再做一次。`);
      } else {
        map.set(step, { notes: [...notes], key: n, len: e?.len || 1 });
        this.#say(`第 ${step + 1} 步**换成了** Synth key ${n} 的和弦（${noteNames(notes)}）：原来放的被清掉了。`);
      }
    } else if (e?.notes.includes(notes[0])) {
      e.notes = e.notes.filter((x) => x !== notes[0]);
      if (!e.notes.length) map.delete(step);
      this.#say(`从第 ${step + 1} 步里**拿掉了** Synth key ${n} 的那个音。${e.notes.length ? `这一步还剩 ${e.notes.length} 个音。` : '这一步现在空了。'}`);
    } else {
      if (e) {
        e.notes.push(notes[0]);
        e.key = n;
      } else {
        map.set(step, { notes: [...notes], key: n, len: 1 });
      }
      this.#say(`把 Synth key ${n} 的音**加进了**第 ${step + 1} 步：这一步现在有 ${map.get(step).notes.length} 个音。（不是和弦弹法时，按住步进键再按 Synth key 是“加一个音 / 拿掉一个音”。）`);
    }
    this.#event('step', { track: tr, step, on: map.has(step), steps: this.stepsOf(tr) });
  }

  // ───────────── 第 6 章：乐句的换、复制、粘贴；Song / Scene ─────────────

  /** 把几条轨道换到第 pat 段乐句（立即）。Song / Scene 模式里同时记进当前的 scene */
  #switchPattern(tracks, pat, prefix = '') {
    const p = this.proj;
    for (const tr of tracks) {
      p.pat[tr] = pat;
      this.panel?.setKnob(tr, pat * 45);
    }
    this.page = 0;
    if (this.songMode) this.#storeScene();
    const all = tracks.length > 1;
    this.#say(`${prefix}${all ? '11 条轨道一起' : TRACK[tracks[0]].label}换到了**第 ${pat + 1} 段乐句**。`);
    for (const tr of tracks) this.#event('pattern', { track: tr, pattern: pat });
    if (all) this.#event('pattern', { track: 'ALL', pattern: pat });
  }

  /** 按住轨道旋钮（或 ALL）时单按方键 1–3：停着时立即换；放着时预约到下一小节的开头，双击则立即换（手册 3.7.2） */
  #tapPattern(mod, n) {
    const tracks = mod === 'ALL' ? ALL_TRACKS : [mod];
    const pat = n - 1;
    if (pat >= this.proj.slots) {
      if (mod === 'ALL') return this.#say('方键 4–6 是蓝色的：每条轨道现在只能选 3 段。要换成 6 段，**按住一条轨道的旋钮**（不是 ALL），再按亮蓝色的方键 4–6 里的一个。');
      this.proj.slots = PAT_MAX;
      this.#say(`乐句数换成了 **6 段**：方键 4–6 从蓝色变成了白色（整个工程一起换）。现在每条轨道都能选第 1–6 段；选到第 4–6 段时，旋钮旁边的小灯是**青蓝色**的。（真机上要换回 3 段：按住轨道旋钮，把方键 4、5、6 一起按下去。）`);
      return this.#event('patmode', { six: true });
    }
    const now = performance.now();
    const dbl = this.#lastPatTap && this.#lastPatTap.mod === mod && this.#lastPatTap.n === n && now - this.#lastPatTap.at < 450;
    this.#lastPatTap = { mod, n, at: now };
    if (!this.playing || dbl) {
      this.#pendingPat = null;
      return this.#switchPattern(tracks, pat, dbl ? '双击：立即' : '');
    }
    this.#pendingPat = { tracks, pat };
    this.#say(`预约好了：${mod === 'ALL' ? '11 条轨道' : TRACK[mod].label}会在**下一小节的开头**换到第 ${n} 段（现场换段不会切在半拍上）。想马上换：双击这个方键。`);
    this.#event('patternreserve', { track: mod, pattern: pat });
  }

  /** 按住轨道旋钮（或 ALL）时长按方键 2 秒：复制那一段乐句（手册 3.7.7） */
  #copyPattern(mod, n) {
    const p = this.proj;
    const tracks = mod === 'ALL' ? ALL_TRACKS : [mod];
    const pat = n - 1;
    if (pat >= p.slots) return this.#say('方键 4–6 是蓝色的：现在每条轨道只有 3 段，只能复制第 1–3 段。');
    this.clip = { tracks, data: tracks.map((tr) => (DRUMS.includes(tr) ? { tr, drums: new Set(p.drums[tr][pat]), bars: p.bars[tr][pat] } : { tr, synth: new Map([...p.synth[tr][pat]].map(([k, v]) => [k, { ...v, notes: [...v.notes] }])), bars: p.bars[tr][pat] })) };
    this.#meter = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`METER.${i + 1}`, 'white']));
    this.#meterLater();
    this.#say(`**复制好了**：${mod === 'ALL' ? '11 条轨道' : TRACK[mod].label}的第 ${n} 段乐句（小灯白色闪一下）。接下来：按住这个旋钮，**再按住 [PAGE]**，按目标方键 = 粘贴过去。`);
    this.#event('patterncopy', { track: mod, pattern: pat });
  }

  /** 按住轨道旋钮（或 ALL）+ [PAGE]，再按方键：把复制的那一段贴过去 */
  #pastePattern(mod, n) {
    const p = this.proj;
    const pat = n - 1;
    if (!this.clip) return this.#say('还没有复制过乐句。先按住旋钮，长按要复制的那一段的方键 2 秒。');
    if (pat >= p.slots) return this.#say('方键 4–6 是蓝色的：现在每条轨道只有 3 段，只能贴到第 1–3 段。先换成 6 段（按住轨道旋钮，按亮蓝色的方键 4–6）。');
    let pasted = 0;
    for (const d of this.clip.data) {
      const tr = mod === 'ALL' ? d.tr : mod;
      if (mod !== 'ALL' && (DRUMS.includes(tr) !== !!d.drums || (!d.drums && (tr === 'SAMPLER') !== (d.tr === 'SAMPLER')))) continue; // 鼓轨贴不进合成器轨（手册 3.7.7 的兼容表）
      if (d.drums) {
        p.drums[tr][pat] = new Set(d.drums);
        p.bars[tr][pat] = d.bars || 1;
      } else {
        p.synth[tr][pat] = new Map([...d.synth].map(([k, v]) => [k, { ...v, notes: [...v.notes] }]));
        p.bars[tr][pat] = d.bars;
      }
      pasted++;
    }
    if (!pasted) return this.#say('这两条轨道类型不一样，贴不过去（手册：鼓轨和合成器轨之间不能复制粘贴）。');
    this.#flash[`DK${n}`] = true;
    setTimeout(() => {
      delete this.#flash[`DK${n}`];
      this.#render();
    }, 1000);
    this.#say(`**贴好了**：贴到了${mod === 'ALL' ? ' 11 条轨道的' : ` ${TRACK[mod].label} 的`}第 ${n} 段（目标方键闪一下）。转旋钮到第 ${n} 段就能听到。`);
    this.#event('patternpaste', { track: mod, pattern: pat });
  }

  /** 这个 scene 有多长（步）：自己设过就是设的那么长，AUTO = 里面最长的那段乐句（手册 3.14.8） */
  #sceneLen() {
    const sc = this.proj.scenes[this.proj.scene];
    return sc?.len || (sc ? this.#autoLen(sc) : Math.max(16, ...ALL_TRACKS.map((tr) => this.#lenOfTrack(tr))));
  }

  /** AUTO：这个 scene 里 11 条轨道各放的那一段，最长的那段有几步（静音的也算：静音只是不出声，乐句还在走） */
  #autoLen(sc) {
    const p = this.proj;
    return Math.max(16, ...ALL_TRACKS.map((tr) => (p.bars[tr]?.[sc.pat[tr] ?? 0] || 1) * 16));
  }

  /**
   * Song 模式里按住 [PAGE] 转 [ALL]：改选中那个 scene 的长度。最左是 AUTO，往右依次是 1 拍、2 拍、3 拍、1 小节、2 小节……8 小节
   * （手册：不按下转一次一步、按下去转一次一小节；模拟机上不好“按下去转”，就把不到一小节的按拍走、一小节以上按小节走）
   */
  #sceneLength(dir) {
    const p = this.proj;
    if (!p.scenes.length) p.scenes.push({ pat: { ...p.pat }, mute: [...p.mute], len: null });
    const sc = p.scenes[p.scene];
    const STOPS = [null, 4, 8, 12, ...Array.from({ length: 8 }, (_, i) => (i + 1) * 16)];
    const i = sc.len ? Math.max(1, STOPS.findIndex((x) => x && x >= sc.len)) : 0;
    const next = STOPS[clamp(i + dir, 0, STOPS.length - 1)];
    sc.len = next;
    const len = next || this.#autoLen(sc);
    this.#meter = Object.fromEntries(Array.from({ length: clamp(Math.ceil(len / 16), 1, 8) }, (_, i) => [`METER.${i + 1}`, 'white']));
    this.#meterLater();
    const words = len % 16 ? `${len / 4} 拍（${len} 步）` : `${len / 16} 小节`;
    this.#say(next ? `scene ${p.scene + 1} 的长度：**${words}**。放到这么长就换下一个 scene。` : `scene ${p.scene + 1} 的长度：**AUTO**（方键全亮青蓝）——跟着里面最长的那段乐句走，现在是 ${words}。`);
    this.#event('scenelen', { index: p.scene, steps: len, auto: !next });
  }

  /** 把第 i 个 scene 记下的乐句和静音摆到 11 条轨道上 */
  #applyScene(i) {
    const p = this.proj;
    const sc = p.scenes[i];
    if (!sc) return;
    for (const tr of ALL_TRACKS) {
      p.pat[tr] = sc.pat[tr] ?? 0;
      this.panel?.setKnob(tr, p.pat[tr] * 45);
    }
    p.mute = new Set(sc.mute);
  }

  /** Song 模式里改了乐句 / 静音：记进当前这个 scene */
  #storeScene() {
    const p = this.proj;
    if (!p.scenes.length) p.scenes.push({ pat: {}, mute: [], len: null });
    p.scenes[p.scene] = { pat: { ...p.pat }, mute: [...p.mute], len: p.scenes[p.scene]?.len ?? null };
  }

  /** [ALL] + [PROJECT↑]：普通 → Song → Scene → 普通（手册 3.14.1） */
  #cycleSongMode() {
    const p = this.proj;
    this.songMode = (this.songMode + 1) % 3;
    if (this.songMode === 1) {
      if (this.playing) this.#togglePlay(); // 进 Song 模式会停下来
      if (!p.scenes.length) p.scenes.push({ pat: { ...p.pat }, mute: [...p.mute], len: null });
      p.scene = Math.min(p.scene, p.scenes.length - 1);
      this.#applyScene(p.scene);
    }
    this.#say([
      '出了 Scene 模式，回到普通状态（正在放的话不会停；乐句和静音保持现在的样子）。',
      `进了 **Song 模式**（Index 上 SONG 亮）：方键现在是 scene——白色的是已有的（${p.scenes.length} 个），紫色是选中的那个。按一个不亮的方键 = 加一个新的（复制当前这个）。按 [PLAY] 从选中的 scene 起按顺序放。`,
      '进了 **Scene 模式**：方键是 scene（青蓝色），按 [PLAY] 只循环选中的那一个，换别的 scene 等到下一小节。再按一次 [ALL] + [PROJECT↑] 回到普通状态。',
    ][this.songMode]);
    this.#event('songmode', { mode: this.songMode });
  }

  /** Song / Scene 模式里按方键：选一个 scene；按的是紧挨着最后一个的空位 = 加一个新的（复制当前这个） */
  #sceneKey(i) {
    const p = this.proj;
    if (i < p.scenes.length && this.playing && i !== p.scene) {
      this.#pendingScene = i;
      this.#say(`预约好了：${this.songMode === 2 ? '**下一小节的开头**' : '**这个 scene 放完**'}换到 scene ${i + 1}。`);
      return this.#event('scenereserve', { index: i });
    }
    if (i < p.scenes.length) {
      p.scene = i;
      this.#applyScene(i);
      this.#songPos = 0;
      this.#songEnd = false;
      this.#say(`选了 **scene ${i + 1}**（紫色）：11 条轨道换成了它记下的乐句。${this.playing ? (this.songMode === 1 ? '从这里接着往后放。' : '在这里循环。') : '按 [PLAY] 听。'}这时转轨道旋钮，就是在改这个 scene。`);
      return this.#event('scene', { index: i, count: p.scenes.length });
    }
    if (p.scenes.length >= 16) return this.#say('最多 16 个 scene，已经满了。');
    const copy = p.scenes[p.scene] || { pat: { ...p.pat }, mute: [...p.mute], len: null };
    p.scenes.push({ pat: { ...copy.pat }, mute: [...copy.mute], len: copy.len ?? null });
    p.scene = p.scenes.length - 1;
    this.#applyScene(p.scene);
    this.#say(`**加了 scene ${p.scene + 1}**（复制了刚才那个）。现在转轨道旋钮换乐句、按住 [MUTE] 再按旋钮静音，就是在改它。${i > p.scenes.length - 1 ? '' : ''}`);
    this.#event('scene', { index: p.scene, count: p.scenes.length, added: true });
  }

  // ───────────── 第 5 章：采样器 ─────────────

  /** 选中采样器时按 Synth key：放这个采样位，并且选中它（采样、变调、剪都对着选中的这一个） */
  #selectSample(n) {
    this.sampleKey = n;
    this.#playSample(n, 0, 0.6);
    const smp = this.proj.samples[n - 1];
    this.lastPlayed.SAMPLER = { notes: [n - 1], key: n };
    this.#say(`采样位 **${n}**：「${smp.name}」。${this.sampling ? '' : '现在按 [REC SAMPLE] 就是录到这个位上。'}`);
    this.#event('note', { track: 'SAMPLER', key: n });
    this.#event('samplesel', { key: n });
  }

  /** [REC SAMPLE]：开始采样，再按一次结束（最长 16 秒）。模拟机不用麦克风：录到的是现做的一段声音（sim-samples.js） */
  #recSample() {
    if (this.sel !== 'SAMPLER') return this.#say('[REC SAMPLE] 是给采样器录声音的：先按一下 **SAMPLER 旋钮**（合成器区下排右边），再按一个 Synth key 选好录到哪个位上。');
    if (!this.sampling) {
      this.sampling = { key: this.sampleKey, at: performance.now() };
      this.#timers.sample = setTimeout(() => this.sampling && this.#finishSample(true), 16000);
      this.#say(`**开始采样**，录到采样位 ${this.sampleKey} 上（${['内置麦克风 / AUDIO IN', 'USB 音频', '重采样：机器自己正在放的声音'][this.sampleSrc]}）。真机上这时对着麦克风出声就行；**模拟机不会真的录音**，会给你一段现成的声音。再按一次 [REC SAMPLE] 结束。`);
      return this.#event('sampling', { on: true, key: this.sampleKey });
    }
    this.#finishSample(false);
  }

  #finishSample(auto) {
    clearTimeout(this.#timers.sample);
    const { key } = this.sampling;
    this.sampling = null;
    const smp = this.proj.samples[key - 1];
    const rec = this.sampleSrc === 2 ? { id: 'resample', name: '重采样下来的一小节鼓' } : RECORDINGS[this.#recNo++ % RECORDINGS.length];
    Object.assign(smp, { rec: rec.id, name: `你录的：${rec.name}（模拟）`, pitch: 0, start: 0, end: 1, loop: false });
    this.#playSample(key, 0, 1.2);
    this.#say(`${auto ? '录满 16 秒，自动停了。' : '**采样结束**。'}采样位 ${key} 现在是「${smp.name}」：按 Synth key ${key} 听听。真机会把音量自动拉满（auto-normalize）。`);
    this.#event('sampling', { on: false, key });
    this.#event('sampled', { key, name: smp.name });
  }

  #cancelSample() {
    if (!this.sampling) return this.#say('[DELETE] + [REC SAMPLE] 是取消正在进行的采样；现在没在采样。');
    clearTimeout(this.#timers.sample);
    const { key } = this.sampling;
    this.sampling = null;
    this.#say(`取消了采样：采样位 ${key} 还是原来的声音。`);
    this.#event('sampling', { on: false, key, cancelled: true });
  }

  /** 长按 [REC SAMPLE] 2 秒后按亮着的方键：换采样源（手册 3.13.3；是第几个方键手册没标，模拟机上是 1–3） */
  #pickSource(n) {
    this.#srcPick = 0;
    this.sampleSrc = n - 1;
    this.#say(`采样源换成了 **${['内置麦克风 / AUDIO IN', 'USB 音频（从电脑送进来的声音）', '重采样（RESAMPLING：录机器自己正在放的声音）'][n - 1]}**。${n === 3 ? '先让机器放起来，再按 [REC SAMPLE] 录。' : ''}`);
    this.#event('samplesrc', { src: n - 1 });
  }

  /** 采样器第 1 页旋钮 2：变调（半音）。机器上采样的变调也是变速：高八度 = 快一倍 */
  #turnSamplePitch(dir) {
    const smp = this.proj.samples[this.sampleKey - 1];
    smp.pitch = clamp(smp.pitch + dir, -24, 24);
    this.#index = 'PITCH';
    this.#meterLater();
    this.#playSample(this.sampleKey, 0, 0.6);
    this.#say(`采样位 ${this.sampleKey} 的音高：**${smp.pitch > 0 ? '+' : ''}${smp.pitch} 个半音**${smp.pitch % 12 === 0 && smp.pitch ? `（${Math.abs(smp.pitch / 12)} 个八度）` : ''}。${smp.rec ? '变高也变快、变短；变低也变慢、变长。' : '（模拟机里预置的采样是用鼓的声音代替的，变调听不出来：先录一段自己的。）'}`);
    this.#event('param', { track: 'SAMPLER', param: 'pitch', value: smp.pitch, key: this.sampleKey });
  }

  /** 采样器进阶第 4 页：起点、终点、循环开关、循环长度（模拟机里循环长度不单独做） */
  #turnSampleParam(k, dir) {
    const smp = this.proj.samples[this.sampleKey - 1];
    this.#index = 'OTHER';
    this.#meterLater();
    const name = ['start', 'end', 'loop', 'looplen'][k];
    if (name === 'start') smp.start = clamp(Math.round((smp.start + dir * 0.04) * 100) / 100, 0, smp.end - 0.04);
    else if (name === 'end') smp.end = clamp(Math.round((smp.end + dir * 0.04) * 100) / 100, smp.start + 0.04, 1);
    else if (name === 'loop') smp.loop = dir > 0;
    if (name !== 'looplen') this.#playSample(this.sampleKey, 0, 1.2);
    const what = { start: `起点：从 **${Math.round(smp.start * 100)}%** 处开始放（把前面不要的剪掉）`, end: `终点：放到 **${Math.round(smp.end * 100)}%** 就停（把后面拖着的剪掉）`, loop: smp.loop ? '循环：**开**——按着键不放，它就在起点和终点之间一直转' : '循环：**关**——按一下放一遍', looplen: '循环长度：从循环点到终点有多长（模拟机里这一样只做演示）' }[name];
    this.#say(`采样位 ${this.sampleKey} 的${what}。${smp.rec ? '' : '（预置的采样在模拟机里剪不出变化：先录一段自己的。）'}`);
    const value = name === 'start' ? Math.round(smp.start * 100) : name === 'end' ? Math.round(smp.end * 100) : smp.loop ? 1 : 0;
    this.#event('param', { track: 'SAMPLER', param: name, value, key: this.sampleKey });
  }

  /** 选中采样器时 [DELETE] + Synth key：删掉这个采样位在格子里的音（手册 3.13.11） */
  #deleteSampleSeq(n) {
    const p = this.proj;
    const map = p.synth.SAMPLER[p.pat.SAMPLER];
    for (const [s, e] of [...map]) {
      e.notes = e.notes.filter((v) => v !== n - 1);
      if (!e.notes.length) map.delete(s);
    }
    this.#say(`删掉了采样位 ${n} 在这段乐句里的所有音（采样本身还在，按 Synth key ${n} 照样响）。`);
    this.#event('delete', { track: 'SAMPLER', key: n });
  }

  // ───────────── 第 7 章：静音模式、临时保存、三条触摸条、混音台 ─────────────

  #setMuteMode(on) {
    this.muteMode = on;
    this.#say(on
      ? '进了**静音模式**（[ALL] 旁边的灯变绿）：现在**直接按**轨道旋钮就是静音 / 取消静音，不用再按住 [MUTE]；按一下 [ALL] 是全部取消静音。按一下 [MUTE] 退出。'
      : '退出了静音模式：轨道旋钮又是“选中这条轨道”了。');
    this.#event('mutemode', { on });
  }

  /** 第 7 章：手指在 [HIGH PASS] / [REPEATER] 上（v = 0–1，越往上越多）。松手就复原（手册 3.12.4） */
  #slideLive(id, v) {
    if (id === 'HIGHPASS') {
      this.live.hp = Math.max(0.01, v);
      this.#applyFx();
      this.#say(`[HIGH PASS]：低音被削掉了 ${v < 0.3 ? '一点' : v < 0.7 ? '一大半' : '几乎全部'}。**手一松就复原**——这是给现场“抽掉低音、再一把放回来”用的。`);
      return this.#event('highpass', { on: true, value: v });
    }
    const len = v < 0.34 ? 4 : v < 0.67 ? 2 : 1;
    const from = Math.max(0, this.step);
    if (!this.#rep || this.#rep.len !== len) this.#rep = { from: from - (from % len), len, n: 0 };
    this.live.rep = v;
    this.#say(`[REPEATER]：反复放刚才那 ${len === 4 ? '一拍' : len === 2 ? '半拍' : '四分之一拍'}，越往上切得越碎。**手一松就接着往下放**。${this.playing ? '' : '（先按 [PLAY]，让机器放起来才有东西可以重复。）'}`);
    this.#event('repeater', { on: true, len });
  }

  #endLive(id) {
    if (id === 'HIGHPASS' && this.live.hp) {
      this.live.hp = 0;
      this.#applyFx();
      this.#say('松手了：[HIGH PASS] 复原，低音回来了。');
      this.#event('highpass', { on: false });
    } else if (id === 'REPEATER' && this.#rep) {
      this.#rep = null;
      this.live.rep = 0;
      this.#say('松手了：[REPEATER] 复原，接着往下放。');
      this.#event('repeater', { on: false });
    }
  }

  /** 混音台模式里按 Sound Design 旋钮 1–4：选参数 */
  #mixSelect(k) {
    this.mixParam = k;
    const [, index, zh] = MIX_PARAMS[k];
    this.#index = index;
    this.#say(`混音台：现在转轨道旋钮调的是**${zh}**（Index 上 ${index} 亮）。${k >= 2 ? '混响、延迟是大家共用的“送出效果”：每条轨道决定送多少过去。' : ''}`);
    this.#event('mixparam', { param: MIX_PARAMS[k][0] });
    this.#render();
  }

  /** 混音台模式里转轨道旋钮：调这条轨道的那一样；转 [ALL] 调整个工程的（模拟机里 [ALL] 只做演示） */
  #mixTurn(id, dir) {
    const [param, index, zh] = MIX_PARAMS[this.mixParam];
    this.#index = index;
    if (id === 'ALL') {
      this.#meterLater();
      return this.#say(`混音台里转 [ALL]：调的是整个工程的${param === 'rev' ? '混响回来多少（RETURN）' : param === 'dly' ? '延迟回来多少（RETURN）' : zh}。模拟机里这一下只做演示。`);
    }
    const p = this.proj;
    const m = p.mix[id];
    let v;
    if (KEYED.includes(id) && (param === 'rev' || param === 'dly')) {
      // 合成器轨的混响 / 延迟送多少和进阶第 3 页的旋钮 1、2 是同一样东西
      const s = p.snd[id];
      s.edits[param] = clamp((s.edits[param] || 0) + dir * 4, -64, 63);
      v = this.#sendOf(id, param);
    } else {
      m[param] = clamp(m[param] + dir * 4, 0, 127);
      v = m[param];
    }
    this.#applyMix();
    this.#showBar(Math.round((v / 127) * 8), index);
    this.#say(`${TRACK[id].label} 的${zh}：**${v}** / 127。${param === 'pan' ? '（模拟机里声像只做演示）' : this.playing ? '' : '按 [PLAY] 听。'}`);
    this.#event('mix', { track: id, param, value: v, delta: dir });
    this.#render();
  }

  /** [PROJECT↑] + 当前工程的方键：临时保存；+ 它正下方那个（青蓝色）：恢复到临时保存的样子（手册 3.10.3） */
  #tempSaveProject() {
    this.#tempSave = { project: this.project, data: cloneProject(this.proj) };
    this.#say(`**临时保存好了**：${this.project + 1} 号工程现在的样子存了一份（只能存 1 份，换工程或关机就没了）。它正下方那个方键（第 ${this.project + 9} 个）会亮青蓝色：演砸了，按住 [PROJECT↑] 再按它，就回到现在这样。`);
    this.#event('tempsave', { project: this.project });
  }

  #tempRestore() {
    if (!this.#tempSave || this.#tempSave.project !== this.project) return this.#say('这个工程还没有临时保存过（按住 [PROJECT↑]，再按当前工程那个黄色的方键）。');
    if (this.playing) this.#togglePlay();
    this.projects[this.project] = cloneProject(this.#tempSave.data);
    this.stepMode = null;
    this.page = 0;
    ALL_TRACKS.forEach((t) => this.panel?.setKnob(t, this.proj.pat[t] * 45));
    this.#say('**恢复了**：工程回到了临时保存时的样子。演出前存一份、演砸了一键回去——这是现场的保险。');
    this.#event('temprestore', { project: this.project });
  }

  // ───────────── 灯 ─────────────

  #meterLater() {
    clearTimeout(this.#timers.meter);
    this.#timers.meter = setTimeout(() => {
      this.#meter = null;
      this.#index = null;
      this.#render();
    }, 1700);
  }

  #showBar(n, index = null) {
    this.#meter = Object.fromEntries(Array.from({ length: clamp(n, 0, 8) }, (_, i) => [`METER.${i + 1}`, 'white']));
    this.#index = index;
    this.#meterLater();
  }

  #showDots(indices) {
    this.#meter = Object.fromEntries(indices.map((i) => [`METER.${clamp(i, 1, 8)}`, 'cyan']));
    this.#index = null;
    this.#meterLater();
  }

  #render() {
    if (!this.panel) return;
    this.panel.svg.classList.toggle('off', !this.power);
    if (!this.power) return this.panel.setLit({});
    const p = this.proj;
    const lit = {};
    for (const t of ALL_TRACKS) {
      const n = (p.pat[t] % 3) + 1; // 3 个小灯：上中下 = 第 1、2、3 段（第 4–6 段同样的位置，亮青蓝）
      const col = p.pat[t] > 2 ? 'cyan' : 'yellow';
      if (this.#red === t) [1, 2, 3].forEach((i) => (lit[`${t}.${i}`] = 'red'));
      else if (p.solo === t) [1, 2, 3].forEach((i) => (lit[`${t}.${i}`] = 'cyan'));
      else if (p.mute.has(t)) [1, 2, 3].forEach((i) => (lit[`${t}.${i}`] = i === n ? col : 'green'));
      else lit[`${t}.${n}`] = t === this.sel ? 'white' : col;
    }
    const onPage = (s) => Math.floor(s / 16) === this.page;
    if (this.held === 'PROJECT') {
      for (let i = 0; i < 8; i++) lit[`DK${i + 1}`] = i === this.project ? 'yellow' : 'white';
      if (this.#tempSave?.project === this.project) lit[`DK${this.project + 9}`] = 'cyan'; // 临时保存过：正下方那个亮青蓝
    } else if (this.#srcPick > performance.now()) {
      for (let i = 0; i < 3; i++) lit[`DK${i + 1}`] = i === this.sampleSrc ? 'yellow' : 'white';
    } else if (this.songMode) {
      // Song 模式：有 scene 的白、Scene 模式：青蓝；选中的紫
      if (this.held === 'PAGE' && p.scenes[p.scene]) {
        const sc = p.scenes[p.scene];
        const len = sc.len || this.#autoLen(sc);
        for (let i = 0; i < 16; i++) if (!sc.len || i < (len % 16 || 16)) lit[`DK${i + 1}`] = sc.len ? 'white' : 'cyan';
      } else p.scenes.forEach((_, i) => (lit[`DK${i + 1}`] = i === p.scene ? 'purple' : this.songMode === 1 ? 'white' : 'cyan'));
    } else if ((TRACK[this.held] && !this.rtDrum) || this.held === 'ALL') {
      // 按住轨道旋钮（或 ALL）：方键 1–6 是乐句，黄色是现在这一段，白色是别的（4–6 没开时是蓝色）
      const cur = this.held === 'ALL' ? p.pat.KICK : p.pat[this.held];
      for (let i = 0; i < 6; i++) lit[`DK${i + 1}`] = i < p.slots ? (i === cur ? 'yellow' : 'white') : 'blue';
    } else if (this.#lenShow) {
      // 正在调音长：只亮这个音占的那一串
      for (let i = 0; i < this.#lenShow.len; i++) if (onPage(this.#lenShow.step + i)) lit[`DK${((this.#lenShow.step + i) % 16) + 1}`] = 'cyan';
    } else {
      if (DRUMS.includes(this.sel)) for (const s of this.stepsOf(this.sel)) if (onPage(s)) lit[`DK${(s % 16) + 1}`] = 'yellow';
      else if (this.stepMode === this.sel) for (const s of this.stepsOf(this.sel)) if (onPage(s)) lit[`DK${(s % 16) + 1}`] = p.synth[this.sel][p.pat[this.sel]].get(s)?.lock !== undefined ? 'purple' : 'cyan';
      if (this.playing && this.step >= 0) {
        const pos = this.step % this.#lenOfTrack(this.sel);
        if (onPage(pos)) lit[`DK${(pos % 16) + 1}`] = 'white';
      }
    }
    if (this.recording) lit.REC = 'red';
    if (this.muteMode) [1, 2, 3].forEach((i) => (lit[`ALL.${i}`] = 'green'));
    if (this.sel === 'SAMPLER' && !this.rtDrum) lit[`SK${this.sampleKey}`] = this.sampling ? 'red' : 'orange'; // 选中的采样位；采样中红色
    if (this.songMode) lit['INDEX.SONG'] = 'white';
    if (this.mixer) {
      lit['INDEX.MIXER'] = 'white';
      lit[`INDEX.${MIX_PARAMS[this.mixParam][1]}`] = 'white';
    }
    for (const k of Object.keys(this.#flash)) lit[k] = 'yellow';
    Object.assign(lit, this.#meter || {});
    if (this.#index) lit[`INDEX.${this.#index}`] = 'white';
    this.panel.setLit(lit);
  }
}

export const simulator = new Simulator();
export { DRUMS as SIM_DRUMS, SYNTHS as SIM_SYNTHS };
