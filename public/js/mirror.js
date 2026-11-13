// 真机镜像：把屏幕上的面板变成真机的镜子——你在机器上按什么，这里就亮什么，并用一句话告诉你刚才发生了什么。
//
// 怎么做到的：每 0.3 秒把机器的状态读一遍（选中的轨道、每条轨道第几段乐句、静音 / 独奏、当前鼓轨亮着哪几步、
// 速度、摇摆、音阶、调、八度、音量、是否在播放 / 录音），和上一次比较，变了的地方就是你刚做的事；
// 再加上机器主动发来的音符、旋钮（CC）、换音色、开始 / 停止消息。地址与实测依据见 docs/hardware-findings.md。
//
// 机器自己也会主动报不少事（用户做“按键体检”时录到的）：按轨道旋钮、转旋钮换乐句、进出打鼓模式、按住 [PROJECT↑]、
// 按了第几个 Synth key、播放 / 录音。这些一到就处理，比轮询快；轮询负责兜底和读步进格子。
//
// 还做不到的：单独按下 [DELETE] [MUTE] [SOLO] [PAGE]（按住时机器报什么还没测过），只能看到组合键生效后的结果；
// 合成器轨上的步进内容读不出来；合成器轨在不在“步进输入”模式里、步进键翻到了第几页也读不出来。
//
// 第 3 章（和弦）用到的几样，2026-11-10 在真机上测过（tools/probe-chords.py、verify-chord-mode.py、verify-length.py）：
// 三条合成器轨的“单音 / 复音 / 和弦”（31 1p 23）、当前乐句有多长（30 5p 16…）、右边 4 个旋钮翻到第几页（01 10 30）、
// 每条轨道现在用的音色叫什么（01 1p 35）都读得出来。机器没有屏幕，音色名只有在这里才看得到。
import { Emitter, h, rich, clamp } from './util.js';
import { midi } from './midi.js';
import { seqtrak } from './seqtrak.js';
import { createPanel } from './device-panel.js';
import { TRACKS } from './tracks.js';
import { SCALES, KEY_NAMES, POLY_MODES, synthKeyNotes, chordName } from './scales.js';
import { midiToName } from './audio.js';
import { controlInfo } from './controls.js';

const A = {
  project: [0x01, 0x10, 0x15],
  track: [0x01, 0x10, 0x27],
  playing: [0x01, 0x10, 0x20],
  recording: [0x01, 0x10, 0x21],
  solo: [0x30, 0x40, 0x68],
  tempo: [0x30, 0x40, 0x76],
  swing: [0x30, 0x40, 0x7c],
  scale: [0x30, 0x40, 0x7e],
  key: [0x30, 0x40, 0x7f],
  speaker: [0x00, 0x00, 0x00],
  phones: [0x00, 0x00, 0x01],
  // 下面三个是 2026-11-10 用户做“按键体检”时机器主动报上来的，随后只读查询确认能问到（docs/hardware-findings.md）
  rt: [0x01, 0x10, 0x19], // 打鼓模式（鼓的实时输入）开着没有
  hold: [0x01, 0x10, 0x18], // 1 = 正按住 [PROJECT↑]
  patMode: [0x30, 0x40, 0x79], // 0 = 每轨 3 段乐句，1 = 6 段
  sdPage: [0x01, 0x10, 0x30], // 右边 4 个 Sound Design 旋钮现在在第几页（0 = 第 1 页）
};
const SYNTH_PARTS = [7, 8, 9]; // SYNTH 1、SYNTH 2、DX
const polyAddr = (p) => [0x31, 0x10 | p, 0x23]; // 0 MONO / 1 POLY / 2 CHORD。存在音色里：换音色它会跟着变
// 第 4 章：右边 4 个旋钮第 2 页的起音、衰减，和 DX 第 5 页的 FM 三样，存在音色的公共参数里（31 1p xx，0x40 = 原样）。
// 2026-11-12 在用户的机器上用官方 CC 写进去再读回来找到的（tools/verify-sound-design.py，做完都设回了原值）：
//   SYNTH 1 / SYNTH 2：起音 31 1p 2C、衰减 31 1p 00；DX：起音 31 19 01、衰减 31 19 02、调制量 03、调制频率 04、反馈 05；FM 算法 48 09 00（0–11）。
// 滤波器（CC 74）和共鸣（CC 71）在扫过的地址里都没找到：只能等机器自己发 CC 来认（机器转旋钮时发不发，还没人试过）。
export const PARAM_ADDR = {
  // 第 7 章：混响、延迟送多少（进阶第 3 页旋钮 1、2；CC 91 / 94）。2026-11-12 在 SYNTH 2 上实测 31 18 19 / 31 18 1A，SYNTH 1 照 AWM2 同一排法；DX 没测
  7: { attack: [0x31, 0x17, 0x2c], decay: [0x31, 0x17, 0x00], rev: [0x31, 0x17, 0x19], dly: [0x31, 0x17, 0x1a] },
  8: { attack: [0x31, 0x18, 0x2c], decay: [0x31, 0x18, 0x00], rev: [0x31, 0x18, 0x19], dly: [0x31, 0x18, 0x1a] },
  9: { attack: [0x31, 0x19, 0x01], decay: [0x31, 0x19, 0x02], fmAmt: [0x31, 0x19, 0x03], fmFreq: [0x31, 0x19, 0x04], fmFb: [0x31, 0x19, 0x05], fmAlg: [0x48, 0x09, 0x00] },
};
// CC 号 → 参数名（官方 CC 表；FM 那四个只在 DX 的通道上）
const CC_PARAM = { 73: 'attack', 75: 'decay', 74: 'cutoff', 71: 'reso', 91: 'rev', 94: 'dly', 116: 'fmAlg', 117: 'fmAmt', 118: 'fmFreq', 119: 'fmFb' };
// 这几样存的是 0–127 的原值（不是“0x40 = 原样”的拧多少）
const RAW_PARAMS = new Set(['fmAlg', 'rev', 'dly']);
const PARAM_SAY = {
  attack: ['ATTACK', '起音', '往大拧，声音慢慢浮上来；往小拧，一按就出来'],
  decay: ['DECAY', '衰减', '往大拧，落得慢、松手后拖得长；往小拧，一下就没了'],
  cutoff: ['FILTER', '滤波器', '一边是闷、一边是薄，正中间是原样'],
  reso: ['RESONANCE', '共鸣', '往大拧，滤波器切口上那一下“喵”更尖'],
  fmAmt: ['OTHER', 'FM 调制量', '越大越亮、越硬'],
  fmFreq: ['OTHER', 'FM 调制频率', '换的是“摇它的那个音”是几倍音高：不是整数倍时像铃铛'],
  fmFb: ['OTHER', 'FM 反馈', '越大越毛、越沙'],
  fmAlg: ['OTHER', 'FM 算法', '4 个“算子”换一种接法（12 种）'],
  rev: ['REVERB', '混响送多少', '往大拧，这条轨道进混响的越多，听着越远、越大'],
  dly: ['DELAY', '延迟送多少', '往大拧，回声越多'],
};
const SD_MODE = [0x00, 0x00, 0x21]; // 右边 4 个旋钮是不是在“进阶设置”里（长按翻页键 2 秒进出）：0 普通 / 1 进阶。官方 System 参数，可查询
const lengthAddr = (p, pat = 0) => [0x30, 0x50 | p, 0x16 + 2 * pat]; // 这条轨道第 pat 段乐句有多少步（两个字节）
const nameAddr = (p) => [0x01, 0x10 | p, 0x35]; // 这条轨道现在用的音色的名字
const noteNames = (notes) => notes.map((n) => midiToName(n).replace(/-?\d+$/, '')).join(' ');
const SD_PAGES = ['第 1 页：音色、单音 / 复音 / 和弦（鼓轨上是音高）、声像、音量', '第 2 页：声音起得快慢、消失得快慢、滤波器、共鸣', '第 3 页（进阶）：混响、延迟送多少，高频、低频', '第 4 页（进阶）：滑音，琶音器的类型、长短、快慢', '第 5 页（进阶，DX 才有）：FM 的算法、调制量、调制频率、反馈'];
/** 一个参数的值用人话说（−64 … +63，0 = 原样） */
export function paramWords(param, v) {
  if (param === 'fmAlg') return `第 ${v + 1} 种`;
  if (param === 'rev' || param === 'dly') return v < 8 ? '几乎不送' : v < 50 ? '送一点' : v < 95 ? '送不少' : '送很多';
  if (v === 0) return '原样';
  switch (param) {
    case 'attack': return v < -30 ? '一下就出来' : v < 0 ? '快一点' : v < 36 ? '慢慢起来' : '像雾一样浮上来';
    case 'decay': return v < -30 ? '一下就没了' : v < 0 ? '短一点' : v < 36 ? '拖一会儿' : '拖得很长';
    case 'reso': return v < 0 ? '更平' : v < 36 ? '有点“喵”' : '很尖';
    case 'fmAmt': return v < -40 ? '几乎是纯的' : v < 0 ? '圆一点' : v < 36 ? '更亮' : '又亮又硬';
    case 'fmFb': return v < 0 ? '更干净' : v < 30 ? '有点毛' : '很沙';
    default: return `${v > 0 ? '+' : ''}${v}`;
  }
}
const NATURALS = [0, 2, 4, 5, 7, 9, 11];
// 正按住某个功能键时，告诉你接下来按什么（依据 docs/seqtrak-operation-reference.md）
const HOLD_NAME = { PROJECT: 'PROJECT↑' };
const HOLD_NEXT = {
  PROJECT: '这时按上排第 1–8 个步进键，就是切到那个工程（1–3 是演示曲，4–8 是空白的）。',
  DELETE: '这时按一下某条轨道的旋钮，就是**清空它当前这段乐句**，不能撤销。不想删就直接松手；别碰 [ALL] 旋钮，那会把 11 条轨道一起清空。',
  MUTE: '这时按一下某条轨道的旋钮，就是把它静音；同样的动作再做一次，它就回来。',
  SOLO: '这时按一下某条轨道的旋钮，就是只听它一个；同样的动作再做一次取消。',
  PAGE: '这时按一下合成器轨的旋钮，是进入 / 退出步进输入。别转鼓轨的旋钮（会改这段乐句的长度），也别按方键（那是粘贴）。',
};
// 轨道灯的“显示方式”（01 1p 39 的第一个字节）→ 正按住哪个功能键。1 = 平时。2026-11-10 在用户的机器上实测，每个键一次。
const HELD_BY_LED = { 2: 'DELETE', 3: 'MUTE', 4: 'SOLO', 5: 'PAGE' };
const HELLO ='这是**真机的镜子**：你在机器上按什么，这里就显示什么，并告诉你刚才发生了什么。试着按一下机器上的任意一个轨道旋钮。';
// 控制器编号 → [屏幕上哪个控件, 哪行文字会亮, 它调的是什么]
const CC_INFO = {
  7: ['SD4', 'VOLUME', '这条轨道的音量'],
  10: ['SD3', 'PAN', '声像：声音偏左还是偏右'],
  25: ['SD2', 'PITCH', '这面鼓的音高'],
  26: ['SD2', 'MONO/POLY', '单音 / 复音 / 和弦'],
  73: ['SD1', 'ATTACK', '声音起来得快还是慢'],
  75: ['SD2', 'DECAY', '声音消失得快还是慢'],
  74: ['SD3', 'FILTER', '滤波器：声音是亮还是闷'],
  71: ['SD4', 'RESONANCE', '滤波器的共鸣'],
  91: ['SD1', 'REVERB', '混响加多少'],
  94: ['SD2', 'DELAY', '延迟（回声）加多少'],
  20: ['SD3', 'OTHER', '高频多一点还是少一点'],
  21: ['SD4', 'OTHER', '低频多一点还是少一点'],
  102: ['FXLEVEL', null, '效果加多少'],
  107: ['FXLEVEL', null, '这条轨道的效果加多少'],
  105: ['HIGHPASS', null, '高通滤波：低频正在被削掉，手一离开就复原'],
  106: ['REPEATER', null, '重复器：声音被切碎重复，手一离开就复原'],
};

class DeviceMirror extends Emitter {
  /** 当前读到的机器状态：project / track / playing / … / 'pat:3' / 'mute:0' / 'oct:7' */
  v = new Map();
  /** 7 条鼓轨当前乐句里亮着的步 */
  steps = Array.from({ length: 7 }, () => new Set());
  /** 最近解说过的操作，给 AI 教练当上下文 */
  log = [];
  /**
   * 要不要定时去问机器的状态。音游打着的时候关掉：免得一大串问答和你敲的音挤在同一根线上。
   * 关着的时候，机器主动报上来的事（敲了哪面鼓、按了第几个键、开始播放、进出打鼓模式）照样看得到。
   */
  polling = true;
  lastSay = HELLO;
  #stepsKnown = Array(7).fill(0); // 每条鼓轨已经读到了哪些步（位图），读全之前不解说变化
  #offs = [];
  #timer = null;
  #sweep = 0;
  #quietUntil = 0;
  #lastTrackAt = 0;
  #lastAgainAt = 0;
  #lastSynth = null;
  #heldShown = '';
  #patFrom = {};
  #stepQuiet = Array(7).fill(0);
  #playStep = -1;
  #meter = null;
  #index = null;
  #keyFlash = {};
  #ccAt = {};
  #timers = {};
  #frame = 0;
  #stepBurst = null;
  #held = new Map(); // 合成器轨的通道 → 现在按着没松的音
  #group = null; // 合成器轨上紧挨着响的一串音，算“按了一次”
  #lastKeyAt = 0;
  #soundAt = {}; // 轨道号 → 上一次换音色的时刻
  #polyBefore = {}; // 轨道号 → 这一轮换音色之前它的弹法

  /** 需要浏览器授予 SysEx 权限才能读机器状态。 */
  get available() {
    return midi.connected && midi.sysex && !!midi.output;
  }

  // ───────────── 给课程用的统一接口（和模拟机相同） ─────────────

  get project() {
    return this.v.get('project') ?? -1;
  }

  get proj() {
    return { scale: this.v.get('scale'), key: this.v.get('key') };
  }

  /** 某条鼓轨当前乐句里有音的步（从 0 起）；合成器轨读不到，返回 null。 */
  stepsOf(track) {
    const p = TRACKS.findIndex((t) => t.id === track);
    if (p < 0 || p > 6 || this.#stepsKnown[p] !== 0xffff) return null;
    return [...this.steps[p]].sort((a, b) => a - b);
  }

  /** 打鼓模式（鼓的实时输入）开着没有 */
  get rtDrum() {
    return !!this.v.get('rt');
  }

  /**
   * 现在正按住哪个功能键（'PROJECT' / 'DELETE' / 'MUTE' / 'SOLO' / 'PAGE'），没有就是 null。
   * 实测（2026-11-10 用户做的功能键测试）：按住 [PROJECT↑] 时 01 10 18 = 1；按住另外四个键时，
   * 机器把每条轨道灯的“显示方式”（01 1p 39 的第一个字节）从 1 换成 2 / 3 / 4 / 5，松手换回 1。
   * 后面这个值问不出来，只能等机器主动报。
   */
  heldKey(hold = this.v.get('hold'), led = this.v.get('led')) {
    if (hold === 1) return 'PROJECT';
    return HELD_BY_LED[led] || null;
  }

  /** 镜像下面那行小字里关于功能键的一句 */
  #holdTip() {
    return '**按住** [PROJECT↑]、[DELETE]、[MUTE]、[SOLO]、[PAGE] 这几个功能键时，屏幕上被按住的那个会画上黑圈，下面那行字会提示接下来按什么。';
  }

  /** 机器是不是正在播放 */
  get playing() {
    return !!this.v.get('playing');
  }

  /** 现在选中的是哪条轨道（'KICK'、'SYNTH1'…）；还没读到时是 null */
  get selectedTrack() {
    return TRACKS[this.v.get('track')]?.id ?? null;
  }

  /** 最基本的几样状态读到了没有（刚挂上去的头零点几秒还没有） */
  get known() {
    return ['track', 'playing', 'rt', 'scale', 'key'].every((k) => this.v.has(k));
  }

  /** 某条轨道现在在第几段乐句（从 0 起）；还没读到时返回 0 */
  patternOf(track) {
    const p = TRACKS.findIndex((t) => t.id === track);
    return (p >= 0 && this.v.get(`pat:${p}`)) || 0;
  }

  /** 某条合成器轨现在的弹法：0 MONO / 1 POLY / 2 CHORD；还没读到（或者不是合成器轨）时是 undefined */
  polyOf(track) {
    return this.v.get(`poly:${TRACKS.findIndex((t) => t.id === track)}`);
  }

  /** 某条合成器轨当前这段乐句有几小节；还没读到时是 null */
  barsOf(track) {
    const steps = this.v.get(`len:${TRACKS.findIndex((t) => t.id === track)}`);
    return steps ? steps / 16 : null;
  }

  /** 某条轨道现在用的音色叫什么；还没读到时是 '' */
  soundName(track) {
    return this.v.get(`name:${TRACKS.findIndex((t) => t.id === track)}`) || '';
  }

  /**
   * 第 4 章：某条合成器轨上某个参数现在拧到哪（−64 … +63，0 = 原样；FM 算法是 0–11）。还没读到时是 undefined。
   * 起音、衰减、DX 的 FM 是轮询读的；滤波器、共鸣只有机器自己发 CC 来的时候才知道
   */
  paramOf(track, name) {
    return this.v.get(`${name}:${TRACKS.findIndex((t) => t.id === track)}`);
  }

  /** 某条轨道静音了没有 */
  mutedOf(track) {
    return !!this.v.get(`mute:${TRACKS.findIndex((t) => t.id === track)}`);
  }

  /** 采样器第 key 个采样位（1–7）名字的头 7 个字母（读 50 eA 01–07；还没读到时是 ''） */
  sampleName(key) {
    return this.v.get(`smp:${key - 1}`) || '';
  }

  /** 右边 4 个旋钮现在在第几页（0 = 第 1 页）；还没读到时是 undefined */
  get sdPage() {
    return this.v.get('sdPage');
  }

  /** 是不是在“进阶设置”里（长按翻页键 2 秒进出） */
  get sdAdvanced() {
    return this.v.get('sdmode') === 1;
  }

  /** 替你把某条合成器轨切到 MONO / POLY / CHORD（官方 CC 26，实测有效）。返回发没发出去。 */
  setPoly(track, mode) {
    const p = TRACKS.findIndex((t) => t.id === track);
    if (!SYNTH_PARTS.includes(p) || !midi.cc(p + 1, 26, mode)) return false;
    setTimeout(() => seqtrak.poll([polyAddr(p)], 0), 120);
    return true;
  }

  /** 替你把某条合成器轨当前这段乐句设成几小节（官方地址 30 5p 16…，实测有效）。 */
  setBars(track, bars) {
    const p = TRACKS.findIndex((t) => t.id === track);
    if (!SYNTH_PARTS.includes(p)) return false;
    const addr = lengthAddr(p, this.v.get(`pat:${p}`) || 0);
    const steps = clamp(Math.round(bars * 16), 1, 128);
    if (!seqtrak.write(addr, [steps >> 7, steps & 0x7f])) return false;
    setTimeout(() => seqtrak.poll([addr], 0), 120);
    return true;
  }

  /** 这类条件在真机上认不认得出来 */
  can(d) {
    if (['start', 'stop', 'track', 'note', 'tempo', 'swing', 'sound', 'mute', 'solo', 'volume', 'octave', 'pattern', 'project', 'scale', 'polymode', 'chord'].includes(d.kind)) return true;
    // 乐句长度只读合成器轨的（鼓轨的长度没在轮询里）
    if (d.kind === 'length') return ['SYNTH1', 'SYNTH2', 'DX', 'SAMPLER'].includes(d.track);
    // 完整版的课：6 段乐句（30 40 79）、几条轨道各在第几段 + 静音（Song 模式里选中一个 scene 时就是它记下的样子）、
    // 鼓轨第 pattern 段的前 16 步（只读得到前 16 步，再往后的、要核对小节数的认不出）
    if (d.kind === 'patmode' || d.kind === 'combo') return true;
    if (d.kind === 'patsteps') return TRACKS.findIndex((t) => t.id === d.track) < 7 && (d.to ?? 999) <= 16 && d.bars === undefined;
    // 第 4 章：翻页、进阶设置、音色名（存过的带 _edit）读得出；参数里起音、衰减、DX 的 FM 读得出，滤波器和共鸣靠机器发 CC（没人试过发不发）。
    // [FX LEVEL] 靠 CC 107 / 102（同样没人试过）；[MASTER/SINGLE] 开关、[FX] 转到了哪一类机器不上报，认不出
    if (['sdpage', 'sdmode', 'soundname', 'param', 'fxlevel'].includes(d.kind)) return true;
    // 第 5–7 章：几条轨道在第几段、静音（轮询读得出）；采样位换了声音（读采样位的名字）；选了第几个采样位（机器报“按了第几个键”）；
    // [HIGH PASS] / [REPEATER] 靠 CC 105 / 106（第三方实测过发）。Song / Scene 模式、静音模式、复制粘贴、临时保存，机器怎么报还不知道，认不出
    if (['patterns', 'patternat', 'muted', 'sampled', 'samplesel', 'highpass', 'repeater'].includes(d.kind)) return true;
    if (d.kind === 'mode') return d.mode === 'realtime'; // 合成器轨的“步进输入”模式还读不出来
    const p = TRACKS.findIndex((t) => t.id === d.track);
    return ['steps', 'hassteps'].includes(d.kind) && p >= 0 && p < 7; // 只有鼓轨的步读得出来
  }

  highlight(ids) {
    this.panel?.setHighlight(ids);
  }

  flash(id, color) {
    this.panel?.flash(id, color);
  }

  /** 最近两分钟里在真机上做过的事（给 AI 教练） */
  recentActions() {
    const since = Date.now() - 120000;
    return this.log.filter((l) => l.at >= since).slice(-8).map((l) => l.text.replace(/\*\*/g, ''));
  }

  // ───────────── 挂到页面上 ─────────────

  mount({ tips = true } = {}) {
    this.unmount();
    this.panel = createPanel({
      onPick: (id) => {
        const info = controlInfo(id);
        if (info) this.#say(`${info.en}（${info.zh}）：${info.what.split('。')[0]}。屏幕上这台只是镜子，要操作请按真机上的它。`, false);
        this.emit('info', id);
      },
    });
    this.sayText = h('span', { html: rich(this.lastSay) });
    this.el = h('div', { class: 'sim' },
      this.panel.el,
      h('div', { class: 'sim-bar' }, h('div', { class: 'sim-say' }, h('span', { class: 'led' }), this.sayText)),
      tips && h('div', { class: 'sim-tips', html: rich(`这是**真机的实时镜像**：灯和真机同步，每个动作会有一句解说。屏幕上点它不会操作真机，只会告诉你那个键是什么。${this.#holdTip()}`) }),
    );
    this.#start();
    return this.el;
  }

  unmount() {
    this.#stop();
    this.el?.remove();
    this.el = null;
    this.panel = null;
  }

  #start() {
    this.v.clear();
    this.v.set('led', 1); // 轨道灯的显示方式：1 = 平时。这个值问不出来，挂上去时先当它是平时的样子
    this.steps.forEach((s) => s.clear());
    this.#stepsKnown.fill(0);
    this.#sweep = 0;
    this.#playStep = -1;
    this.#offs = [
      seqtrak.on('param', (p) => this.#onParam(p)),
      midi.on('noteon', (m) => this.#onNote(m)),
      midi.on('noteoff', (m) => this.#held.get(m.ch)?.delete(m.note)),
      midi.on('cc', (m) => this.#onCc(m)),
      midi.on('pc', (m) => this.#onProgram(m)),
      midi.on('start', () => this.#put('playing', 1)),
      midi.on('stop', () => this.#put('playing', 0)),
      midi.on('clock', ({ tick, playing }) => {
        const step = playing && tick >= 0 ? Math.floor(tick / 6) % 16 : -1;
        if (step !== this.#playStep) {
          this.#playStep = step;
          this.#render();
        }
      }),
      midi.on('state', () => this.#render()),
    ];
    this.#tick(true);
    this.#timer = setInterval(() => this.#tick(false), 300);
    this.#render();
  }

  #stop() {
    clearInterval(this.#timer);
    this.#timer = null;
    this.#offs.splice(0).forEach((f) => f());
    Object.values(this.#timers).forEach((t) => clearTimeout(t));
    this.#timers = {};
    cancelAnimationFrame(this.#frame);
    this.#frame = 0; // 不清零的话，下次挂载后 #render 会以为还有一帧在排队，灯就再也不刷新了
    this.#heldShown = '';
    this.#patFrom = {};
    this.polling = true;
    this.#stepBurst = null;
    this.#meter = null;
    this.#index = null;
    this.#keyFlash = {};
    this.#held.clear();
    this.#group = null;
    this.#soundAt = {};
    this.#polyBefore = {};
  }

  /** 把机器的状态问一遍。first = 第一次，把 7 条鼓轨的步都读全。 */
  #tick(first) {
    if (!this.available || (!first && (document.hidden || !this.polling))) return;
    // 机器正在播放时少问一些，别跟它的音序器抢时间：乐句 / 静音隔一次问一回，没选中的轨道先不读
    const busy = !first && !!this.v.get('playing');
    const list = [A.track, A.playing, A.recording, A.project, A.solo, A.tempo, A.swing, A.speaker, A.phones, A.rt, A.hold];
    if (!busy || this.#sweep % 2 === 0) for (let p = 0; p < 11; p++) list.push([0x30, 0x50 | p, 0x0f], [0x30, 0x50 | p, 0x29]);
    const sel = this.v.get('track');
    const tracks = new Set();
    if (first) for (let p = 0; p < 7; p++) tracks.add(p);
    else {
      if (sel !== undefined && sel < 7) tracks.add(sel); // 正在编的那条每次都读，其余的轮流读
      if (!busy) tracks.add(this.#sweep % 7);
    }
    for (const p of tracks) for (let s = 0; s < 16; s++) list.push([0x70, 0x40 | p, s]);
    if (first || this.#sweep % 3 === 0) list.push(A.scale, A.key, A.patMode, [0x30, 0x57, 0x0c], [0x30, 0x58, 0x0c], [0x30, 0x59, 0x0c]);
    // 三条合成器轨的弹法（单音 / 复音 / 和弦）每次都问：转旋钮 2、换音色都会改它，而机器不一定主动报
    for (const p of SYNTH_PARTS) list.push(polyAddr(p));
    if (first || this.#sweep % 3 === 1) {
      for (const p of SYNTH_PARTS) list.push(lengthAddr(p, this.v.get(`pat:${p}`) || 0));
      list.push(SD_MODE);
    }
    // 右边 4 个旋钮在第几页：01 10 30 之外，再问一下选中那条轨道自己的（第三方资料写的是 01 1p 30，每条轨道一个；
    // 是整台一个还是每条轨道各一个，还没人在机器上翻页验证过：两个都问，哪个变了信哪个，见 #onParam）
    if (first || this.#sweep % 2 === 1) {
      list.push(A.sdPage);
      if (sel !== undefined && sel > 0) list.push([0x01, 0x10 | sel, 0x30]);
    }
    // 第 4 章：选中的合成器轨上拧到哪（起音、衰减；DX 加上 FM 那几样）。每轮都问：拧旋钮机器不一定发 CC
    const tuning = first ? SYNTH_PARTS : SYNTH_PARTS.includes(sel) ? [sel] : [];
    for (const p of tuning) list.push(...Object.values(PARAM_ADDR[p]));
    // 第 5 章：选中采样器时，每隔两三轮把 7 个采样位名字的头 7 个字母读一遍（50 eA 01–07，e = 0–6，2026-11-12 只读查到的）：
    // 录完一个采样，那个位上的名字会变，镜像据此认出“录好了”
    // 第一轮也读一遍：先有个“原来叫什么”，录完再读到不一样的才认得出（不然录完之后第一次读到的会被当成原样）
    if (first || (sel === 10 && this.#sweep % 3 === 0)) for (let e = 0; e < 7; e++) for (let i = 1; i < 8; i++) list.push([0x50, (e << 4) | 0x0a, i]);
    // 音色的名字：刚挂上去时把三条合成器轨的读一遍；之后选中了哪条、给哪条换了音色，再单独去读（见 #readName）。
    // 选中的合成器轨隔两秒再读一遍：存音色（按住 [ALL] 再按 SOUND 旋钮）之后名字会变成“原名_editNN”，机器不会主动说
    if (first) for (const p of SYNTH_PARTS) list.push(nameAddr(p));
    else if (sel !== undefined && !this.v.has(`name:${sel}`) && this.#sweep % 3 === 2) list.push(nameAddr(sel));
    else if (SYNTH_PARTS.includes(sel) && this.#sweep % 7 === 3) list.push(nameAddr(sel));
    this.#sweep++;
    seqtrak.poll(list, 2.5);
  }

  // ───────────── 机器的回答与上报 ─────────────

  #onParam({ addr: [hi, mid, lo], data, reply }) {
    const d0 = data[0];
    if (hi === 0x01 && (mid & 0xf0) === 0x10 && lo === 0x35) {
      // 这条轨道现在的音色名。每 8 个字节的第 1 个是另外 7 个的最高位（名字是英文时全是 0），去掉它剩下的就是字母
      const text = String.fromCharCode(...data.filter((b, i) => i % 8 !== 0 && b >= 0x20 && b < 0x7f)).trim();
      this.#gotName(mid & 0x0f, text);
    } else if (hi === 0x31 && (mid & 0xf0) === 0x10 && lo === 0x23) {
      this.#put(`poly:${mid & 0x0f}`, d0);
    } else if (hi === 0x01 && (mid & 0xf0) === 0x10 && lo === 0x30) {
      // 4 个旋钮在第几页。01 10 30 和选中那条轨道的 01 1p 30 都问了：头一次读到的是 01 10 30 的；之后哪一个变了，就信哪一个
      const p = mid & 0x0f;
      const was = this.v.get(`sdp:${p}`);
      this.v.set(`sdp:${p}`, d0);
      if (was === undefined ? p === 0 : was !== d0) this.#put('sdPage', d0);
    } else if (hi === 0x50 && (mid & 0x0f) === 0x0a && lo >= 1 && lo < 8) {
      this.#onSampleByte(mid >> 4, lo, d0);
    } else if (hi === 0x00 && mid === 0x00 && lo === 0x21) {
      this.#put('sdmode', d0 ? 1 : 0);
    } else if ((hi === 0x31 || hi === 0x48) && this.#onTuning(hi, mid, lo, d0)) {
      // 起音、衰减、FM（见 PARAM_ADDR）
    } else if (hi === 0x30 && (mid & 0xf0) === 0x50 && lo >= 0x16 && lo <= 0x20) {
      // 乐句长度：每段乐句各有一个地址，只认这条轨道当前那一段的
      const p = mid & 0x0f;
      if (lo === lengthAddr(p, this.v.get(`pat:${p}`) || 0)[2] && data.length >= 2) this.#put(`len:${p}`, data[0] * 128 + data[1]);
    } else if (hi === 0x01 && mid === 0x10) {
      if (lo === 0x15) this.#put('project', d0);
      else if (lo === 0x27) {
        // reply = 这是对我们查询的回答；不是的话，就是机器因为你按了旋钮（或敲了鼓）主动报上来的
        if (!reply && this.v.get('track') === d0) this.#again(d0);
        else this.#put('track', d0);
      } else if (lo === 0x20) this.#put('playing', d0);
      else if (lo === 0x21) this.#put('recording', d0);
      else if (lo === 0x19) this.#put('rt', d0);
      else if (lo === 0x18) this.#put('hold', d0);
      else if (lo === 0x39 && !reply) this.#put('led', d0); // KICK 轨的灯换了显示方式（11 条轨道同时换，看一条就够）
      else if (lo === 0x2c && !reply) this.#onSynthKey(d0);
    } else if (hi === 0x30 && mid === 0x40) {
      if (lo === 0x68) this.#put('solo', d0);
      else if (lo === 0x79) this.#put('patMode', d0);
      else if (lo === 0x76) this.#put('tempo', data[0] * 128 + data[1]);
      else if (lo === 0x7c) this.#put('swing', data[0] * 128 + data[1] - 128);
      else if (lo === 0x7e) this.#put('scale', d0);
      else if (lo === 0x7f) this.#put('key', d0 - 0x40);
    } else if (hi === 0x30 && (mid & 0xf0) === 0x50) {
      const p = mid & 0x0f;
      if (lo === 0x0f) this.#put(`pat:${p}`, d0);
      else if (lo === 0x29) this.#put(`mute:${p}`, d0 ? 1 : 0);
      else if (lo === 0x0c) this.#put(`oct:${p}`, d0 - 0x40);
    } else if (hi === 0x00 && mid === 0x00) {
      if (lo === 0x00) this.#put('speaker', d0);
      else if (lo === 0x01) this.#put('phones', d0);
    } else if (hi === 0x70 && (mid & 0xf0) === 0x40) {
      this.#putStep(mid & 0x0f, lo, data.length > 0);
    }
  }

  /** 采样位名字的一个字节到了：凑齐 7 个再比；和上一次读到的不一样，就是这个位上录了（或换了）声音 */
  #smpBytes = {};
  #onSampleByte(e, i, b) {
    const bytes = (this.#smpBytes[e] ||= []);
    bytes[i] = b;
    if (bytes.filter((x) => x !== undefined).length < 7) return;
    const name = String.fromCharCode(...bytes.slice(1, 8).filter((x) => x >= 0x20 && x < 0x7f)).trim();
    this.#smpBytes[e] = [];
    const key = `smp:${e}`;
    const old = this.v.get(key);
    this.v.set(key, name);
    if (old === undefined || old === name) return;
    this.#act([`SK${e + 1}`], `采样位 ${e + 1} 换了声音（名字现在是「${name}…」）：刚才录好了，或者换了一个采样。按 Synth key ${e + 1} 听听。`, { type: 'sampled', key: e + 1, name });
  }

  /** 读回来的是不是某条合成器轨上的起音 / 衰减 / FM：是的话记下来（换成 −64 … +63；算法是 0–11），返回 true */
  #onTuning(hi, mid, lo, d0) {
    for (const [p, map] of Object.entries(PARAM_ADDR)) {
      for (const [name, a] of Object.entries(map)) {
        if (a[0] === hi && a[1] === mid && a[2] === lo) {
          this.#put(`${name}:${p}`, RAW_PARAMS.has(name) ? d0 : d0 - 64);
          return true;
        }
      }
    }
    return false;
  }

  #put(key, value) {
    const old = this.v.get(key);
    if (old === value) return;
    this.v.set(key, value);
    // 换工程后的那一小会儿，跟着一起变的一大批状态不算你的操作；但“又换了工程”和“按住了哪个功能键”任何时候都算
    // 开始播放也任何时候都算：换工程只会让机器停下、不会自己放起来，换完马上按 [PLAY]（第 8.3 课教的就是这个）不能被这段“安静期”吞掉
    if (old !== undefined && (performance.now() >= this.#quietUntil || key === 'project' || key === 'hold' || key === 'led' || (key === 'playing' && value === 1))) this.#changed(key, old, value);
    this.#render();
  }

  #putStep(p, step, on) {
    if (p > 6 || step > 15) return;
    const bit = 1 << step;
    const known = this.#stepsKnown[p] & bit;
    const had = this.steps[p].has(step);
    this.#stepsKnown[p] |= bit;
    if (had === on) return;
    if (on) this.steps[p].add(step);
    else this.steps[p].delete(step);
    this.#render();
    const now = performance.now();
    // 刚换过乐句 / 工程的那一小会儿，读回来的格子有新有旧，对不上的不算“你按了步进键”
    if (!known || now < this.#quietUntil || now < this.#stepQuiet[p]) return;
    // 一次扫描里可能有好几步变了（比如整段被清空），攒一下再解说
    this.emit('event', { type: 'step', track: TRACKS[p].id, step, on, steps: [...this.steps[p]].sort((a, b) => a - b) });
    const burst = (this.#stepBurst ||= { p, on: [], off: [] });
    if (burst.p !== p) return;
    (on ? burst.on : burst.off).push(step);
    clearTimeout(this.#timers.steps);
    this.#timers.steps = setTimeout(() => this.#sayStepBurst(), 140);
  }

  #sayStepBurst() {
    const b = this.#stepBurst;
    this.#stepBurst = null;
    if (!b) return;
    const t = TRACKS[b.p];
    const now = [...this.steps[b.p]].sort((x, y) => x - y).map((s) => s + 1);
    const flash = [...b.on, ...b.off].map((s) => `DK${s + 1}`);
    if (b.off.length >= 2 && now.length === 0) {
      this.#act([t.id, 'DELETE'], `**${t.label} 这段乐句被清空了**（按住 [DELETE] 再按它的旋钮就是这个效果）。这一步不能撤销。`, null);
      this.emit('event', { type: 'delete', track: t.id });
    } else if (b.on.length + b.off.length === 1) {
      const step = (b.on[0] ?? b.off[0]) + 1;
      const beat = step % 4 === 1 ? `（第 ${(step + 3) / 4} 拍的正拍）` : step % 4 === 3 ? '（反拍）' : '';
      this.#act(flash, b.on.length ? `在 ${t.label} 的**第 ${step} 步**放了一个音${beat}。现在亮着：${now.join('、')}。` : `拿掉了 ${t.label} 第 ${step} 步的音。现在亮着：${now.join('、') || '没有'}。`, null);
    } else {
      this.#act(flash, `${t.label} 改了 ${b.on.length + b.off.length} 步。现在亮着：${now.join('、') || '没有'}。`, null);
    }
  }

  #invalidateSteps(p) {
    const list = p === undefined ? [0, 1, 2, 3, 4, 5, 6] : [p];
    for (const i of list) {
      if (i > 6) continue;
      this.#stepsKnown[i] = 0;
      this.#stepQuiet[i] = performance.now() + 400;
      this.steps[i].clear();
    }
  }

  /** 某个状态变了：这就是你刚才在机器上做的事 */
  #changed(key, old, v) {
    const [name, pStr] = key.split(':');
    const p = Number(pStr);
    const t = TRACKS[name === 'track' ? v : p];
    switch (name) {
      case 'track':
        this.#lastTrackAt = performance.now();
        if (!this.v.has(`name:${v}`)) this.#readName(v); // 这条轨道用的是什么音色，第一次选中时去问一下
        if (this.v.get('rt') && v < 7) {
          // 打鼓模式里敲哪面鼓，机器就把哪条轨道选中
          this.#pressKey(v + 1);
          this.#act([], `打鼓模式：**${t.label}** 响了（Synth key ${v + 1}），机器同时选中了它。`, { type: 'track', track: t.id }, false);
        } else {
          this.#act([t.id], `选中了 **${t.label}**（${t.name}）。${t.kind === 'drum' ? '现在步进键显示的是它的格子。' : '现在 7 个 Synth keys 弹的是它。'}`, { type: 'track', track: t.id });
        }
        break;
      case 'rt':
        this.#act(v ? ['SK1', 'SK2', 'SK3', 'SK4', 'SK5', 'SK6', 'SK7'] : [], v
          ? '**进入了打鼓模式**：现在 7 个 Synth keys 是 7 面鼓——上排 1 KICK、2 SNARE、3 CLAP，下排 4 HAT 1、5 HAT 2、6 PERC 1、7 PERC 2。同样的组合（按住任意鼓轨旋钮，再按一个 Synth key）再做一次就退出。'
          : '**退出了打鼓模式**：Synth keys 变回琴键。', { type: 'mode', mode: 'realtime', on: !!v });
        break;
      case 'hold':
      case 'led': {
        // 两个读数合起来看：现在正按住哪个功能键（见 heldKey）
        const key = this.heldKey();
        const was = name === 'hold' ? this.heldKey(old, this.v.get('led')) : this.heldKey(this.v.get('hold'), old);
        if (key === was) break;
        clearTimeout(this.#timers.hold);
        if (key) this.#say(`你正**按住 [${HOLD_NAME[key] || key}]**：${HOLD_NEXT[key]}`, false);
        else if (was) {
          // 松手了。要是这半秒里没有别的事发生（解说还停在“你正按住…”），说明只是按了一下又松开
          this.#timers.hold = setTimeout(() => {
            if (!this.lastSay.startsWith('你正**按住')) return;
            this.#say(was === 'PROJECT'
              ? '松开了 [PROJECT↑]，工程没有换。要换工程：**按住它不放**，再按一个步进键。'
              : `松开了 [${was}]，什么都没有改。它要和别的键一起按才起作用：先按住它不放，再按另一个。`, false);
          }, 450);
        }
        break;
      }
      case 'patMode':
        this.#act([], v ? '每条轨道可选的乐句从 3 段变成了 **6 段**（第 4–6 段的灯是青色的）。' : '每条轨道可选的乐句变回了 3 段。', null);
        break;
      case 'pat': {
        this.#invalidateSteps(p);
        this.v.delete(`len:${p}`); // 换了一段乐句，长度要重新读（每段各有各的长度）
        // 转旋钮时会一口气经过好几段：等它停下来，只说最后落在哪
        this.#patFrom[p] ??= old;
        clearTimeout(this.#timers[`pat${p}`]);
        this.#timers[`pat${p}`] = setTimeout(() => {
          const from = this.#patFrom[p];
          const now = this.v.get(`pat:${p}`);
          delete this.#patFrom[p];
          if (now === undefined || now === from) return; // 转过去又转回来了：等于没动
          this.#act([t.id], now === 0
            ? `${t.label} 回到了**第 1 段乐句**。`
            : `**${t.label} 换到了第 ${now + 1} 段乐句**——它的旋钮被转动了。每条轨道有好几段乐句，转旋钮就是在它们之间换。不是故意的话，往回转到第 ${from + 1} 段，原来的内容还在。`, { type: 'pattern', track: t.id, pattern: now });
        }, 250);
        break;
      }
      case 'mute':
        this.#act(['MUTE', t.id], v ? `**静音**了 ${t.label}（它旁边的灯变绿）。按住 [MUTE] 再按一次它的旋钮就恢复。` : `${t.label} 恢复出声。`, { type: 'mute', track: t.id, on: !!v });
        break;
      case 'solo':
        this.#act(['SOLO', ...(v ? [TRACKS[v - 1].id] : [])], v ? `**独奏** ${TRACKS[v - 1].label}：现在只听得到它一个。同样的操作再做一次取消。` : '取消了独奏，大家都回来了。', { type: 'solo', track: v ? TRACKS[v - 1].id : null });
        break;
      case 'project':
        this.#quietUntil = performance.now() + 1200; // 换工程会带着一大批状态一起变，那些不算你的操作
        this.#invalidateSteps();
        this.#act(['PROJECT', `DK${v + 1}`], `切到了 **${v + 1} 号工程**${v < 3 ? '（出厂演示曲）' : ''}。换工程时机器会自动保存上一个。`, { type: 'project', index: v });
        break;
      case 'playing':
        this.#act(['PLAY'], v ? '**开始播放**：11 条轨道各自的乐句一起循环。再短按一次 [PLAY] 停下。' : '停下了。', { type: v ? 'start' : 'stop' });
        break;
      case 'recording':
        this.#act(['REC'], v ? '**正在录音**（录音键红灯）：现在弹的音会被记进当前轨道。' : '录音结束。', { type: 'recording', on: !!v });
        break;
      case 'tempo':
        this.#showBar(Math.max(1, Math.round((v / 300) * 8)));
        this.#act([v > old ? 'BPM+' : 'BPM-'], `速度 **${v} BPM**。${Math.abs(v - old) === 1 ? '按住不放会连续变。' : ''}`, { type: 'tempo', bpm: v });
        break;
      case 'swing':
        this.#showBar(Math.round(4 + (v / 58) * 4));
        this.#act(v === 0 && old !== 0 ? ['DELETE', 'SWING'] : ['SWING'], v === 0 ? '摇摆归零：节奏变回笔直的了。' : `摇摆 ${v}（范围 −58 到 58）：每对十六分音符里的后一个被往后推了。`, { type: 'swing', value: v });
        break;
      case 'scale':
        this.#showDots([8 - v]);
        this.#act(['SCALE'], `音阶换成了 **${SCALES[v]?.zh || v + 1}**${SCALES[v] ? `：${SCALES[v].mood}` : ''}。`, { type: 'scalekey', scale: v, key: this.v.get('key') });
        break;
      case 'key': {
        const i = NATURALS.indexOf(v);
        const lower = NATURALS.filter((n) => n < v).length;
        this.#showDots(i >= 0 ? [i + 1] : [lower, lower + 1]);
        this.#act(['KEY'], `调换成了 **${KEY_NAMES[v] || v}**：7 个 Synth keys 整体移了位置。`, { type: 'scalekey', scale: this.v.get('scale'), key: v });
        break;
      }
      case 'oct':
        this.#showDots([v + 4]);
        this.#act(['OCTAVE'], `${t.label} 的八度：${v > 0 ? `+${v}` : v}。数字越小声音越低。`, { type: 'octave', track: t.id, value: v });
        break;
      case 'poly': {
        // 单音 / 复音 / 和弦。这个开关存在音色里（实测）：转旋钮 2 会改它，换音色也会把它换成新音色自己的设定
        const mode = POLY_MODES[v];
        if (!mode || !t) break;
        const bySound = performance.now() - (this.#soundAt[p] ?? -1e9) < 900; // 刚换完音色紧跟着变的，是音色带来的，不是你转的旋钮
        this.#showDots([8 - v]); // 右边那列小灯最上面三个：MONO、POLY、CHORD
        this.#index = v === 2 ? 'CHORD' : 'MONO/POLY';
        const what = v === 2 ? '现在每个 Synth key 弹出来的是**一整个和弦**。' : v === 1 ? '可以同时按好几个键，一个键出一个音。' : '一次只出一个音，按下一个，上一个就断：适合贝斯和主旋律。';
        const text = bySound
          ? `换了音色之后，${t.label} 的弹法跟着变成了 **${mode.name}（${mode.zh}）**：这个开关是存在音色里的。${v === 2 ? what : '想要和弦，再转一次旋钮 2（右边那列从上往下数第 2 个），转到 “CHORD” 亮。'}`
          : `**${t.label} 切到了 ${mode.name}（${mode.zh}）**：${what}${v === 2 ? '以后给它换音色，这个开关会跟着变，要重新转一次。' : ''}`;
        this.#act(bySound ? [] : ['SD2'], text, { type: 'polymode', track: t.id, mode: v });
        break;
      }
      case 'len':
        if (!t) break;
        this.#showBar(clamp(Math.ceil(v / 16), 1, 8));
        this.#act(['BARLENGTH'], `${t.label} 这段乐句现在长 **${v % 16 === 0 ? `${v / 16} 小节` : `${v} 步`}**${v === 16 ? '（16 步）' : v % 16 === 0 ? `（${v} 步，步进键一页只显示 16 步，用 [PAGE] 翻页）` : ''}。`, { type: 'length', track: t.id, steps: v, bars: v / 16 });
        break;
      case 'sdPage':
        this.#showDots([8 - v]);
        this.#act(['SDPAGE'], `右边那 4 个旋钮翻到了**${SD_PAGES[v] || `第 ${v + 1} 页`}**。${v === 0 ? '' : '换音色、切和弦都要在第 1 页：接着按那个翻页键，直到这里说回到了第 1 页。'}`, { type: 'sdpage', page: v });
        break;
      case 'sdmode':
        this.#act(['SDPAGE'], v
          ? '**进了进阶设置**（长按翻页键 2 秒）：现在单按翻页键能翻到更多页——合成器轨一共 4 页，DX 5 页（第 5 页是 FM）。用完再长按 2 秒出来。'
          : '**出了进阶设置**：翻页键又只在第 1、2 页之间换了。', { type: 'sdmode', advanced: !!v });
        break;
      case 'attack':
      case 'decay':
      case 'cutoff':
      case 'reso':
      case 'fmAmt':
      case 'fmFreq':
      case 'fmFb':
      case 'rev':
      case 'dly':
      case 'fmAlg': {
        if (!t) break;
        const [index, zh, how] = PARAM_SAY[name];
        // 刚换完音色紧跟着变的，是新音色自己的值，不是你拧的（和弹法一样：这些都存在音色里）
        const bySound = performance.now() - (this.#soundAt[p] ?? -1e9) < 1500;
        const knob = { attack: 'SD1', decay: 'SD2', cutoff: 'SD3', reso: 'SD4', rev: 'SD1', dly: 'SD2', fmAlg: 'SD1', fmAmt: 'SD2', fmFreq: 'SD3', fmFb: 'SD4' }[name];
        this.#index = index;
        this.#showBar(name === 'fmAlg' ? Math.round(((v + 1) / 12) * 8) : RAW_PARAMS.has(name) ? Math.round((v / 127) * 8) : Math.round(((v + 64) / 127) * 8), index);
        this.#act(bySound ? [] : [knob], bySound
          ? `换了音色，${t.label} 的${zh}也跟着变成了新音色自己的（${paramWords(name, v)}）：这些都是存在音色里的。`
          : `${t.label} 的**${zh}**：${paramWords(name, v)}${name === 'fmAlg' ? '' : RAW_PARAMS.has(name) ? `（${v} / 127）` : v === 0 ? '' : `（${v > 0 ? '+' : ''}${v}）`}。${how}。`, bySound ? null : { type: 'param', track: t.id, param: name, value: v });
        break;
      }
      case 'speaker':
      case 'phones':
        this.#showBar(Math.round((v / 127) * 8), 'VOLUME');
        this.#act([v > old ? 'VOL+' : 'VOL-'], `${name === 'phones' ? '耳机' : '扬声器'}音量 ${v}（最大 127）。`, { type: 'volume', value: v });
        break;
      default:
        break;
    }
  }

  #onNote(m) {
    const t = TRACKS[m.ch - 1];
    if (!t) return;
    const now = performance.now();
    if (m.ch >= 8) this.#lastSynth = { note: m.note, at: now }; // 留给紧跟着到的“按了第几个 Synth key”那条上报
    // 播放中分不出这个音是你按的还是音序器放的；你按的键机器会另外上报（见 #onSynthKey 和 #again）
    if (this.v.get('playing')) return;
    if (m.ch >= 8 && m.ch <= 10) return this.#onSynthNote(m, t, now);
    this.emit('event', { type: 'note', track: t.id, note: m.note });
    clearTimeout(this.#timers.note);
    if (now - this.#lastAgainAt < 250 || now - this.#lastTrackAt < 250) return; // 这一声是刚才按旋钮 / 敲鼓带出来的，已经解说过
    if (this.v.get('track') === m.ch - 1) {
      // 响的就是选中的那条轨道。合成器键：机器紧跟着会上报按的是第几个，等它 40 毫秒，等不到再自己推算
      this.#timers.note = setTimeout(() => this.#sayNote(m, t), m.ch >= 8 ? 40 : 0);
      return;
    }
    // 响的不是选中的那条：可能是你刚按了它的旋钮（选中 + 试听），也可能是打鼓模式。
    // 马上问一下机器现在选中的是谁，等回答到了再解说，免得把“选中”说成“打鼓”。
    seqtrak.poll([A.track], 0);
    this.#timers.note = setTimeout(() => {
      if (this.v.get('track') === m.ch - 1) return; // 确实是刚选中它：那一声是试听，“选中了某某”已经说过
      this.#sayNote(m, t);
    }, 150);
  }

  /**
   * 合成器轨上响了一个音（机器停着的时候）。CHORD 状态下按一个键，会一口气出来好几个音；
   * POLY 状态下也可以几个键一起按。所以把紧挨着的一串音（加上还按着没松的）算成“按了一次”：
   * 只报一次“弹了一下”，等这一串到齐了再解说——是一个音，还是一个和弦。
   */
  #onSynthNote(m, t, now) {
    let held = this.#held.get(m.ch);
    if (!held) this.#held.set(m.ch, (held = new Set()));
    held.add(m.note);
    const g = this.#group;
    if (g && g.ch === m.ch && now - g.last < 60) {
      g.notes.add(m.note);
      g.last = now;
    } else {
      this.#group = { ch: m.ch, notes: new Set(held), first: m, last: now };
      this.emit('event', { type: 'note', track: t.id, note: m.note });
    }
    clearTimeout(this.#timers.group);
    this.#timers.group = setTimeout(() => this.#endGroup(t), 60);
  }

  #endGroup(t) {
    const g = this.#group;
    this.#group = null;
    if (!g) return;
    const now = performance.now();
    const p = g.ch - 1;
    const notes = [...g.notes].sort((a, b) => a - b);
    const fromKnob = now - this.#lastAgainAt < 320 || now - this.#lastTrackAt < 320; // 刚按了旋钮：这一声是试听，已经解说过
    if (notes.length < 2) {
      if (fromKnob || now - this.#lastKeyAt < 150) return; // “按了第几个 Synth key”那条上报已经解说过了
      if (this.v.get('track') === p) return this.#sayNote(g.first, t);
      // 响的不是选中的那条：多半是你刚按了它的旋钮（选中 + 试听）。问一下机器现在选中的是谁，再决定说什么
      seqtrak.poll([A.track], 0);
      clearTimeout(this.#timers.note);
      this.#timers.note = setTimeout(() => {
        if (this.v.get('track') !== p) this.#sayNote(g.first, t);
      }, 150);
      return;
    }
    // 两个以上的音一起响：一个和弦
    this.emit('event', { type: 'chord', track: t.id, notes, count: notes.length });
    if (fromKnob) return;
    const keys = synthKeyNotes({ scale: this.v.get('scale') ?? 0, key: this.v.get('key') ?? 0, octave: this.v.get(`oct:${p}`) ?? 0 });
    const keyOf = (n) => keys.findIndex((k) => k % 12 === n % 12) + 1;
    if (this.v.get(`poly:${p}`) === 2) {
      // CHORD：一个键出一组音，最低的那个音就是这个键本来的音
      const n = keyOf(notes[0]);
      if (n) this.#pressKey(n);
      this.#act([], `${n ? `Synth key ${n}` : t.label} 的和弦：**${noteNames(notes)}**——${notes.length} 个音一起响${chordName(notes) ? `（${chordName(notes)} 和弦）` : ''}。`, null, false);
    } else {
      const pressed = notes.map(keyOf).filter(Boolean);
      pressed.forEach((n) => this.#pressKey(n));
      this.#act([], `${pressed.length === notes.length ? `Synth key ${pressed.join('、')} 一起响` : `${notes.length} 个音一起响`}：**${noteNames(notes)}**。几个音同时响，就是一个**和弦**。`, null, false);
    }
  }

  #sayNote(m, t) {
    if (m.ch <= 7) {
      // 鼓的声音有两种来路：按了它的轨道旋钮（试听），或者在打鼓模式里按了对应的 Synth key
      if (this.v.get('track') === m.ch - 1) {
        this.#again(m.ch - 1);
      } else {
        this.#pressKey(m.ch);
        this.#act([], `**${t.label}**（${t.name}）——打鼓模式下，Synth key ${m.ch} 就是这面鼓。`, null, false);
      }
    } else if (m.ch <= 10) {
      const notes = synthKeyNotes({ scale: this.v.get('scale') ?? 0, key: this.v.get('key') ?? 0, octave: this.v.get(`oct:${m.ch - 1}`) ?? 0 });
      const i = notes.findIndex((n) => n % 12 === m.note % 12);
      if (i >= 0) this.#pressKey(i + 1);
      this.#act([], i >= 0 ? `Synth key ${i + 1}：**${midiToName(m.note)}**，当前音阶里的第 ${i + 1} 个音。` : `${t.label} 响了一个音：${midiToName(m.note)}。`, null, false);
    } else {
      this.#act([], '采样器的一个采样响了。', null, false);
    }
  }

  /**
   * 又按了一次已经选中的那条轨道的旋钮（或者在打鼓模式里又敲了同一面鼓）。
   * 实测机器这时会再上报一次“选中了它”，停着的话还带一声试听。算作一次“选中”，
   * 这样“按一下某某旋钮”的练习不会因为它早就选中而卡住。
   */
  #again(p) {
    const t = TRACKS[p];
    if (!t) return;
    const rt = !!this.v.get('rt') && p < 7;
    if (rt) this.#pressKey(p + 1);
    const now = performance.now();
    if (now - this.#lastTrackAt < 250 || now - this.#lastAgainAt < 250) return;
    this.#lastAgainAt = now;
    if (rt) this.#act([], `打鼓模式：**${t.label}** 响了（Synth key ${p + 1}）。`, { type: 'track', track: t.id, again: true }, false);
    else this.#act([t.id], `又按了一下 **${t.label}** 的旋钮，它本来就是选中的。${this.v.get('playing') ? '' : '机器停着的时候，按旋钮会让这条轨道响一声给你听。'}`, { type: 'track', track: t.id, again: true });
  }

  /** 机器上报：你按了第几个 Synth key。音序器自己放的音不带这条，所以播放中也认得出是你按的。 */
  #onSynthKey(i) {
    const n = i + 1;
    if (n < 1 || n > 7) return;
    clearTimeout(this.#timers.note);
    this.#lastKeyAt = performance.now();
    this.#pressKey(n);
    const last = this.#lastSynth;
    const note = !this.v.get('playing') && last && performance.now() - last.at < 80 ? last.note : null;
    if (this.v.get('track') === 10) {
      this.#act([], `采样器：按了采样位 **${n}**（选中它：接下来按 [REC SAMPLE] 就录到这个位上）。`, { type: 'samplesel', key: n }, false);
      return;
    }
    this.#act([], note === null ? `按了 **Synth key ${n}**。` : `Synth key ${n}：**${midiToName(note)}**，当前音阶里的第 ${n} 个音。`, { type: 'key', key: n }, false);
  }

  #pressKey(n) {
    const id = `SK${n}`;
    this.#keyFlash[id] = true;
    this.#render();
    setTimeout(() => {
      delete this.#keyFlash[id];
      this.#render();
    }, 180);
  }

  #onCc(m) {
    // 合成器轨上的 CC 26 就是“单音 / 复音 / 和弦”的新值（官方 CC 表：0 MONO、1 POLY、2 CHORD），和轮询读到的是同一样东西
    if (m.cc === 26 && SYNTH_PARTS.includes(m.ch - 1) && m.val <= 2) return this.#put(`poly:${m.ch - 1}`, m.val);
    // 第 4 章：合成器轨上第 2 页的四样、DX 的 FM。和轮询读到的是同一样东西（CC 的 64 = 原样）；滤波器和共鸣只有这一条路
    const pname = CC_PARAM[m.cc];
    const part = m.ch - 1;
    if (pname && SYNTH_PARTS.includes(part) && (m.cc < 116 || part === 9)) {
      const key = `${pname}:${part}`;
      if (!this.v.has(key)) this.v.set(key, 0); // 头一次听到：当它原来在“原样”上，这样这一下也算一次变化
      this.emit('event', { type: 'cc', cc: m.cc, value: m.val });
      return this.#put(key, RAW_PARAMS.has(pname) ? m.val : m.val - 64);
    }
    const info = CC_INFO[m.cc];
    if (!info) return; // 0 / 32 是换音色的一部分，等下面的 Program Change 再说
    const now = performance.now();
    this.emit('event', { type: 'cc', cc: m.cc, value: m.val });
    if (now - (this.#ccAt[m.cc] || 0) < 350) return;
    this.#ccAt[m.cc] = now;
    this.#index = info[1];
    this.#showBar(Math.round((m.val / 127) * 8), info[1]);
    this.#act([info[0]], `你在动 ${controlInfo(info[0])?.en || info[0]}：调的是**${info[2]}**。`, null);
  }

  #onProgram(m) {
    const t = TRACKS[m.ch - 1];
    if (!t) return;
    this.#index = 'SOUND';
    this.#later();
    const p = m.ch - 1;
    // 这一轮换音色开始之前，这条轨道是什么弹法：留着，等读到新音色的名字时一起交代（CHORD 有没有被冲掉）
    if (performance.now() - (this.#soundAt[p] ?? -1e9) > 700) this.#polyBefore[p] = this.v.get(`poly:${p}`);
    this.#soundAt[p] = performance.now();
    this.#act(['SD1'], `给 ${t.label} **换了一个音色**（转的是右边最上面那个 Sound Design 旋钮）。`, { type: 'sound', track: t.id });
    // 等旋钮停下来，去问新音色叫什么；合成器轨的弹法（单音 / 复音 / 和弦）是跟着音色走的，顺便一起问
    clearTimeout(this.#timers[`name${p}`]);
    this.#timers[`name${p}`] = setTimeout(() => this.#readName(p), 380);
  }

  /** 去问第 p 条轨道现在的音色名（合成器轨顺便问弹法）。刚换完音色的那两秒多里读到新名字，会说一句（见 #gotName） */
  #readName(p) {
    if (!this.available || !this.polling) return;
    // 先问弹法（和起音、衰减、FM 这些同样存在音色里的）：名字到的时候，它们已经是新的了
    seqtrak.poll([...(SYNTH_PARTS.includes(p) ? [polyAddr(p), ...Object.values(PARAM_ADDR[p])] : []), nameAddr(p)], 4);
  }

  #gotName(p, text) {
    const t = TRACKS[p];
    if (!t || !text) return;
    const old = this.v.get(`name:${p}`);
    this.v.set(`name:${p}`, text);
    this.#render();
    if (old !== text) this.emit('event', { type: 'soundname', track: t.id, name: text });
    // 第 4 章：名字从“原名”变成了“原名_editNN”、又没换过音色——是刚存了音色（按住 [ALL] 再按 SOUND 旋钮）
    if (old && old !== text && /_edit\d+$/i.test(text) && text.replace(/_edit\d+$/i, '').trim() === old.replace(/_edit\d+$/i, '').trim()) {
      this.#index = 'SOUND';
      this.#showBar(8);
      this.#act(['SD1', 'ALL'], `**存好了**：${t.label} 现在的音色存成了「**${text}**」。它排在原来那个音色后面，也自动放进了收藏（按住 SOUND 旋钮再按第 16 个方键能跳到它）。`, { type: 'soundsave', track: t.id, name: text });
      return;
    }
    if (old === text || performance.now() - (this.#soundAt[p] ?? -1e9) > 2500) return; // 只在刚换完音色时说，平时读到不出声
    // 合成器轨的弹法是跟着音色变的：先把它重新问一遍，稍等一下再连名字一起说
    // （这个名字也可能是页面上别处先读回来的，那一刻镜像手里的弹法还是旧的）
    if (SYNTH_PARTS.includes(p)) seqtrak.poll([polyAddr(p)], 0);
    clearTimeout(this.#timers[`said${p}`]);
    this.#timers[`said${p}`] = setTimeout(() => this.#saySound(p), SYNTH_PARTS.includes(p) ? 90 : 0);
  }

  /** 换完音色后的那句总结：新音色叫什么；合成器轨再交代它自带的弹法，特别是“刚才切好的 CHORD 被冲掉了” */
  #saySound(p) {
    const t = TRACKS[p];
    const text = this.v.get(`name:${p}`);
    if (!t || !text) return;
    const mode = POLY_MODES[this.v.get(`poly:${p}`)];
    const lost = this.#polyBefore[p] === 2 && mode && mode.id !== 2;
    const about = !mode ? ''
      : /\[Chord\]/i.test(text) && mode.id === 2 ? '名字里带 [Chord] 的音色，一选上就是和弦弹法。'
        : lost ? `它自带的弹法是 ${mode.name}（${mode.zh}），**刚才的 CHORD 被冲掉了**：想要和弦，再转一次旋钮 2（右边那列从上往下数第 2 个），转到 “CHORD” 亮。`
          : `它自带的弹法是 ${mode.name}（${mode.zh}）。`;
    this.#act([], `${t.label} 现在的音色：**${text}**。${about}`, { type: 'soundname', track: t.id, name: text });
  }

  // ───────────── 显示 ─────────────

  /** record = false：只更新解说条，不记进“刚才发生了什么”（弹琴、敲鼓这类连续的动作，记了会刷屏） */
  #act(flashIds, text, event, record = true) {
    for (const id of flashIds) this.panel?.flash(id, '#00b8d9', 900);
    this.#say(text, record);
    if (event) this.emit('event', event);
    this.#render();
  }

  #say(text, record) {
    this.lastSay = text;
    if (this.sayText) this.sayText.innerHTML = rich(text);
    if (record) {
      this.log.push({ at: Date.now(), text });
      if (this.log.length > 40) this.log.shift();
    }
    this.emit('say', text);
  }

  #later() {
    clearTimeout(this.#timers.meter);
    this.#timers.meter = setTimeout(() => {
      this.#meter = null;
      this.#index = null;
      this.#render();
    }, 1800);
  }

  #showBar(n, index = null) {
    this.#meter = Object.fromEntries(Array.from({ length: clamp(n, 0, 8) }, (_, i) => [`METER.${i + 1}`, 'white']));
    if (index) this.#index = index;
    this.#later();
  }

  #showDots(indices) {
    this.#meter = Object.fromEntries(indices.map((i) => [`METER.${clamp(i, 1, 8)}`, 'cyan']));
    this.#later();
  }

  #render() {
    if (!this.panel) return;
    // “状态变了”的通知不跟着画面刷新走：页面被挡住、不刷新画面时，旁边的状态栏和清单也要跟上
    this.#timers.change ||= setTimeout(() => {
      this.#timers.change = 0;
      this.emit('change');
    }, 40);
    if (this.#frame) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0;
      this.panel?.setLit(this.lit());
      // 正按住的键画一个黑圈（和模拟机上“长按”的样子一致）
      const held = this.heldKey() || '';
      if (held !== this.#heldShown) {
        this.#heldShown = held;
        this.panel?.setHeld(held ? [held] : []);
      }
    });
  }

  /** 机器现在的样子，一项一项列出来：[名称, 值] */
  status() {
    const g = (k) => this.v.get(k);
    const t = TRACKS[g('track')];
    const muted = TRACKS.filter((_, p) => g(`mute:${p}`)).map((x) => x.label);
    const pat = t ? g(`pat:${g('track')}`) : undefined;
    // 选中的是合成器轨时多两样：它现在的弹法（单音 / 复音 / 和弦）和这段乐句有多长
    const sel = g('track');
    const mode = POLY_MODES[g(`poly:${sel}`)];
    const len = g(`len:${sel}`);
    const tune = (n) => (g(`${n}:${sel}`) === undefined ? '—' : paramWords(n, g(`${n}:${sel}`)));
    const synthRows = t && SYNTH_PARTS.includes(sel) ? [
      ['弹法', mode ? `${mode.name}（${mode.zh}）` : '—'],
      ['乐句长度', len ? (len % 16 === 0 ? `${len / 16} 小节` : `${len} 步`) : '—'],
      ['起音 / 衰减', `${tune('attack')} / ${tune('decay')}`],
      ...(sel === 9 ? [['FM 调制量 / 频率 / 反馈', `${tune('fmAmt')} / ${tune('fmFreq')} / ${tune('fmFb')}`]] : []),
    ] : [];
    const page = g('sdPage');
    const pageRow = [['右边 4 个旋钮', page === undefined ? '—' : `第 ${page + 1} 页${g('sdmode') ? '（进阶设置里）' : ''}`]];
    return [
      ['工程', g('project') === undefined ? '—' : `${g('project') + 1} 号${g('project') < 3 ? '（演示曲）' : ''}`],
      ['选中的轨道', t ? `${t.label}${pat === undefined ? '' : ` · 第 ${pat + 1} 段乐句${g('patMode') ? '（共 6 段）' : ''}`}` : '—'],
      ['音色', (t && g(`name:${sel}`)) || '—'],
      ...synthRows,
      ...pageRow,
      ['播放', g('recording') ? '录音中' : g('playing') === undefined ? '—' : g('playing') ? '播放中' : '停着'],
      ['速度', g('tempo') ? `${g('tempo')} BPM` : '—'],
      ['摇摆', g('swing') === undefined ? '—' : String(g('swing'))],
      ['音阶 / 调', SCALES[g('scale')] ? `${SCALES[g('scale')].zh} / ${KEY_NAMES[g('key')] ?? '?'}` : '—'],
      ['静音', muted.length ? muted.join('、') : '没有'],
      ['独奏', g('solo') ? TRACKS[g('solo') - 1].label : '没有'],
      ['打鼓模式', g('rt') === undefined ? '—' : g('rt') ? '开着：Synth keys 是 7 面鼓' : '关着'],
    ];
  }

  /** 现在哪些灯该亮 */
  lit() {
    const lit = {};
    const sel = this.v.get('track');
    const solo = this.v.get('solo');
    TRACKS.forEach((t, p) => {
      const pat = this.v.get(`pat:${p}`);
      if (pat === undefined) return;
      const led = (pat % 3) + 1;
      const color = pat >= 3 ? 'cyan' : 'yellow';
      if (solo === p + 1) [1, 2, 3].forEach((i) => (lit[`${t.id}.${i}`] = 'cyan'));
      else if (this.v.get(`mute:${p}`)) [1, 2, 3].forEach((i) => (lit[`${t.id}.${i}`] = i === led ? color : 'green'));
      else lit[`${t.id}.${led}`] = p === sel ? 'white' : color;
    });
    if (sel !== undefined && sel < 7) for (const s of this.steps[sel]) lit[`DK${s + 1}`] = 'yellow';
    if (this.v.get('playing') && this.#playStep >= 0) lit[`DK${this.#playStep + 1}`] = 'white';
    if (this.v.get('recording')) lit.REC = 'red';
    for (const k of Object.keys(this.#keyFlash)) lit[k] = 'yellow';
    Object.assign(lit, this.#meter || {});
    if (this.#index) lit[`INDEX.${this.#index}`] = 'white';
    return lit;
  }
}

export const mirror = new DeviceMirror();
