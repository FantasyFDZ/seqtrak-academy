// 应用自带的声音：合成鼓、几种合成器音色、节拍器。
// 没接 SEQTRAK 时靠它发声；接了以后它负责节拍器和示范音。
import { Emitter, clamp } from './util.js';

const midiToFreq = (m) => 440 * 2 ** ((m - 69) / 12);

/** 合成器音色表。oscs 里 ratio 是相对基频的倍数，detune 单位是音分。 */
const VOICES = {
  bass: {
    oscs: [{ type: 'sawtooth', ratio: 1, gain: 0.55 }, { type: 'square', ratio: 0.5, gain: 0.35 }],
    filter: { q: 7, base: 160, peakMul: 7, peakMin: 500, peakMax: 2200, decay: 0.16, sustain: 300 },
    amp: { a: 0.004, d: 0.12, s: 0.75, r: 0.07 },
    level: 0.75,
  },
  sub: {
    oscs: [{ type: 'sine', ratio: 1, gain: 0.9 }, { type: 'triangle', ratio: 2, gain: 0.12 }],
    filter: { q: 0.7, base: 900, peakMul: 1, peakMin: 900, peakMax: 900, decay: 0.1, sustain: 900 },
    amp: { a: 0.006, d: 0.1, s: 0.9, r: 0.08 },
    level: 0.8,
  },
  lead: {
    oscs: [{ type: 'sawtooth', ratio: 1, gain: 0.4 }, { type: 'sawtooth', ratio: 1, detune: 9, gain: 0.4 }],
    filter: { q: 1.5, base: 900, peakMul: 6, peakMin: 1800, peakMax: 5200, decay: 0.25, sustain: 2200 },
    amp: { a: 0.008, d: 0.15, s: 0.7, r: 0.12 },
    level: 0.5,
  },
  keys: {
    oscs: [{ type: 'triangle', ratio: 1, gain: 0.7 }, { type: 'sine', ratio: 2, gain: 0.22 }, { type: 'sine', ratio: 3, gain: 0.08 }],
    filter: { q: 0.7, base: 1200, peakMul: 8, peakMin: 2400, peakMax: 6000, decay: 0.3, sustain: 1500 },
    amp: { a: 0.003, d: 0.35, s: 0.28, r: 0.22 },
    level: 0.6,
  },
  pad: {
    oscs: [{ type: 'sawtooth', ratio: 1, detune: -9, gain: 0.3 }, { type: 'sawtooth', ratio: 1, gain: 0.3 }, { type: 'sawtooth', ratio: 1, detune: 9, gain: 0.3 }],
    filter: { q: 0.8, base: 500, peakMul: 3, peakMin: 900, peakMax: 1800, decay: 0.8, sustain: 1100 },
    amp: { a: 0.22, d: 0.4, s: 0.8, r: 0.5 },
    level: 0.4,
  },
  // 有点像口风琴：方波为主、起音稍慢、带一点气声（曲目分轨的旋律试听用，content/song-parts.js）
  reed: {
    oscs: [{ type: 'square', ratio: 1, gain: 0.3 }, { type: 'sawtooth', ratio: 1, detune: 7, gain: 0.2 }, { type: 'sine', ratio: 2, gain: 0.1 }],
    filter: { q: 1.2, base: 700, peakMul: 4, peakMin: 1500, peakMax: 3400, decay: 0.3, sustain: 2000 },
    amp: { a: 0.035, d: 0.2, s: 0.8, r: 0.12 },
    level: 0.5,
  },
  // 下面两种是曲目分轨的试听用的（content/song-parts.js），比 pad / keys 厚，配上 song-player.js 的混响更像机器上挑出来的音色。
  // 又宽又厚的铺底：五把错开一点音高的锯齿波分散在左右（pan），再垫一把低八度的；起音慢、尾巴长
  wide: {
    oscs: [
      { type: 'sawtooth', ratio: 1, detune: -16, gain: 0.17, pan: -0.8 },
      { type: 'sawtooth', ratio: 1, detune: -7, gain: 0.17, pan: -0.4 },
      { type: 'sawtooth', ratio: 1, gain: 0.17 },
      { type: 'sawtooth', ratio: 1, detune: 7, gain: 0.17, pan: 0.4 },
      { type: 'sawtooth', ratio: 1, detune: 16, gain: 0.17, pan: 0.8 },
      { type: 'sawtooth', ratio: 0.5, gain: 0.1 },
    ],
    filter: { q: 0.7, base: 600, peakMul: 3, peakMin: 1400, peakMax: 2600, decay: 1.2, sustain: 1700 },
    amp: { a: 0.35, d: 0.6, s: 0.85, r: 1.2 },
    level: 0.85, // 几把错开音高的锯齿波会互相抵掉一些，单听比 pad 轻得多，所以这里给得大
  },
  // 又宽又亮的主旋律合成器（Future Bass / Alan Walker 那种）：五把错开音高、分散左右的锯齿波，再加一点高八度的方波，起音快；
  // 曲目完整版的 Drop 用（content/song-arrangements.js，2026-11-12 用户说 Drop 的旋律要换成合成器）
  supersaw: {
    oscs: [
      { type: 'sawtooth', ratio: 1, detune: -18, gain: 0.3, pan: -0.7 },
      { type: 'sawtooth', ratio: 1, detune: -7, gain: 0.3, pan: -0.3 },
      { type: 'sawtooth', ratio: 1, gain: 0.34 },
      { type: 'sawtooth', ratio: 1, detune: 7, gain: 0.3, pan: 0.3 },
      { type: 'sawtooth', ratio: 1, detune: 18, gain: 0.3, pan: 0.7 },
      { type: 'square', ratio: 2, gain: 0.1 },
    ],
    filter: { q: 1.2, base: 1400, peakMul: 5, peakMin: 3000, peakMax: 7500, decay: 0.35, sustain: 2600 },
    amp: { a: 0.006, d: 0.25, s: 0.7, r: 0.3 },
    level: 0.9, // 几把错开音高的锯齿波会互相抵掉一些（和 wide 一样）：量过，每把 0.15、总 0.75 时比钢琴轻 8 dB，所以给大
  },
  // 亮一点的钢琴：一下敲出来很亮，然后慢慢变暗、变轻（滤波器和音量一起往下走），尾巴比 keys 长
  piano: {
    oscs: [{ type: 'triangle', ratio: 1, gain: 0.6 }, { type: 'sawtooth', ratio: 1, gain: 0.16 }, { type: 'sine', ratio: 2, gain: 0.22 }, { type: 'sine', ratio: 3, gain: 0.07 }],
    filter: { q: 0.8, base: 900, peakMul: 10, peakMin: 2600, peakMax: 7000, decay: 0.9, sustain: 900 },
    amp: { a: 0.002, d: 1.4, s: 0.14, r: 0.5 },
    level: 0.62,
  },
  // 第 4 章「合成与音色设计」用的几种“原料”：只有一把波形、滤波器全开，拿来听滤波器到底削掉了什么（synth-lab.js）
  saw: {
    oscs: [{ type: 'sawtooth', ratio: 1, gain: 0.5 }],
    filter: { q: 0.5, base: 18000, peakMul: 1, peakMin: 18000, peakMax: 18000, decay: 0.1, sustain: 18000 },
    amp: { a: 0.004, d: 0.3, s: 0.85, r: 0.12 },
    level: 0.5,
  },
  square: {
    oscs: [{ type: 'square', ratio: 1, gain: 0.42 }],
    filter: { q: 0.5, base: 18000, peakMul: 1, peakMin: 18000, peakMax: 18000, decay: 0.1, sustain: 18000 },
    amp: { a: 0.004, d: 0.3, s: 0.85, r: 0.12 },
    level: 0.5,
  },
  sine: {
    oscs: [{ type: 'sine', ratio: 1, gain: 0.9 }],
    filter: { q: 0.5, base: 18000, peakMul: 1, peakMin: 18000, peakMax: 18000, decay: 0.1, sustain: 18000 },
    amp: { a: 0.004, d: 0.3, s: 0.85, r: 0.12 },
    level: 0.6,
  },
  // 两把锯齿波的合成器：起音、衰减都在中间，拿来听“起音 / 衰减”两个旋钮（往两头拧都听得出来）
  polysynth: {
    oscs: [{ type: 'sawtooth', ratio: 1, detune: -6, gain: 0.32 }, { type: 'sawtooth', ratio: 1, detune: 6, gain: 0.32 }],
    filter: { q: 0.9, base: 2600, peakMul: 6, peakMin: 3000, peakMax: 6000, decay: 0.4, sustain: 2600 },
    amp: { a: 0.012, d: 0.45, s: 0.42, r: 0.35 },
    level: 0.5,
  },
  // 一下拨出来就变轻的“拨弦”合成器（Pluck）：起音极快、很快落下去
  pluck: {
    oscs: [{ type: 'sawtooth', ratio: 1, gain: 0.38 }, { type: 'sawtooth', ratio: 1, detune: 8, gain: 0.3 }, { type: 'square', ratio: 2, gain: 0.08 }],
    filter: { q: 2, base: 700, peakMul: 9, peakMin: 2600, peakMax: 7000, decay: 0.18, sustain: 900 },
    amp: { a: 0.002, d: 0.22, s: 0.08, r: 0.14 },
    level: 0.6,
  },
  // FM（DX 轨的发声办法）：一个正弦波去“摇”另一个正弦波。ratio = 摇它的那个音是几倍的音高，index = 摇得多狠，fb = 加一点自己摇自己的毛刺。
  // index 会跟着音量的包络一起往下走（idx: 从多狠落到多狠），所以按下去那一下最亮——80 年代电钢琴、铃声那种声音就是这样来的
  fmep: { fm: { ratio: 1, index: 1.8, fb: 0, idx: 0.25 }, amp: { a: 0.002, d: 1.3, s: 0.22, r: 0.45 }, level: 0.55 },
  fmbell: { fm: { ratio: 3.5, index: 2.4, fb: 0, idx: 0.15 }, amp: { a: 0.002, d: 2.4, s: 0.1, r: 1.4 }, level: 0.42 },
  fmbass: { fm: { ratio: 1, index: 2.6, fb: 0.25, idx: 0.3 }, amp: { a: 0.003, d: 0.35, s: 0.5, r: 0.09 }, level: 0.7 },
  fmlead: { fm: { ratio: 2, index: 1.4, fb: 0.1, idx: 0.75 }, amp: { a: 0.01, d: 0.3, s: 0.8, r: 0.18 }, level: 0.42 },
};

// 第 4 章小测里“听一听”用的几种：同一种声音拧过一下的样子（音色上带着 tweak，note() 没给 tweak 时用它）
Object.assign(VOICES, {
  bassdark: { ...VOICES.bass, tweak: { cutoff: -42 } },
  bassreso: { ...VOICES.bass, tweak: { cutoff: -24, reso: 52 } },
  synthslow: { ...VOICES.polysynth, tweak: { attack: 46, decay: 32 } },
  synthpluck: { ...VOICES.polysynth, tweak: { attack: -40, decay: -30 } },
  padtrem: { ...VOICES.wide, tweak: { lfo: { to: 'amp', rate: 6, depth: 0.95 } } },
  padpan: { ...VOICES.wide, tweak: { lfo: { to: 'pan', rate: 0.8, depth: 1 } } },
  fmsoft: { ...VOICES.fmep, tweak: { fm: { amount: -50 } } },
  fmhard: { ...VOICES.fmep, tweak: { fm: { amount: 40, feedback: 30 } } },
});

// FM 的“摇它的那个音是几倍音高”：一格一格往上走。整数倍听起来是乐音，带 .5 的听起来像铃铛、像敲金属
const FM_RATIOS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8];

/**
 * 第 4 章：音色上能拧的那几样，写法和机器上 CC 的值一样，都是 −64 … +63，0 = 这个音色本来的样子。
 *   cutoff     LP-HP 滤波器（机器上右边 4 个旋钮第 2 页的第 3 个）：负 = 往闷里走（低通收紧），正 = 往薄里走（高通把低音削掉）
 *   reso       共鸣：切口上那个尖峰有多高（第 2 页的第 4 个）
 *   attack     声音起来要多久（第 2 页的第 1 个）
 *   decay      声音落下去、松手后拖多久（第 2 页的第 2 个；机器把两样放在同一个旋钮上）
 *   fm         DX 才有：{ amount, freq, feedback }，第 5 页（进阶）的第 2–4 个
 *   lfo        让声音自己摆起来：{ to: 'amp' | 'pan' | 'filter' | 'pitch', rate: 每秒几次, depth: 0–1 }（机器上是 [FX] 旋钮里的 MODULATION 效果）
 * 这几样的“听感”是应用自己合成的近似，和机器上同一个位置的声音不会一模一样。
 */
export const TWEAK_RANGE = 64;
const tw2 = (v, per) => 2 ** ((v || 0) / per);
/** LP-HP 滤波器在这个位置的截止频率（赫兹）；正中间 0 时不下刀，返回 0 */
export function lphpCutoff(cutoff = 0) {
  if (Math.abs(cutoff) < 1) return 0;
  return cutoff < 0 ? clamp(19000 * tw2(cutoff, 9.4), 120, 19000) : clamp(24 * tw2(cutoff, 9.2), 24, 3000);
}

class AudioEngine extends Emitter {
  ctx = null;
  buses = {};
  #noiseBuf = null;

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** 必须在一次用户点击/按键里调用（浏览器不允许页面自己开声）。 */
  async init() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx({ latencyHint: 'interactive' });
      this.#build();
    }
    if (this.ctx.state !== 'running') {
      try {
        await this.ctx.resume();
      } catch {
        /* 还没有用户手势 */
      }
    }
    if (this.ready) this.emit('ready');
    return this.ready;
  }

  #build() {
    const ctx = this.ctx;
    const master = ctx.createGain();
    master.gain.value = 0.85;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 8;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.16;
    master.connect(comp).connect(ctx.destination);
    this.master = master;
    for (const [name, level] of [['drums', 0.9], ['synth', 0.8], ['click', 0.55], ['guide', 0.8]]) {
      const g = ctx.createGain();
      g.gain.value = level;
      g.connect(master);
      this.buses[name] = g;
    }
    const len = ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.#noiseBuf = buf;
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /** 把 performance.now() 时基的毫秒换成音频时钟的秒（对应“此刻扬声器正在发出的那一帧”）。 */
  perfToCtx(perfMs) {
    const ctx = this.ctx;
    const ts = ctx.getOutputTimestamp?.();
    if (ts && ts.performanceTime > 0 && ts.contextTime > 0) {
      return ts.contextTime + (perfMs - ts.performanceTime) / 1000;
    }
    return ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0) + (perfMs - performance.now()) / 1000;
  }

  ctxToPerf(ctxTime) {
    const ctx = this.ctx;
    const ts = ctx.getOutputTimestamp?.();
    if (ts && ts.performanceTime > 0 && ts.contextTime > 0) {
      return ts.performanceTime + (ctxTime - ts.contextTime) * 1000;
    }
    return performance.now() + (ctxTime - ctx.currentTime + (ctx.outputLatency || ctx.baseLatency || 0)) * 1000;
  }

  /** 此刻“听到的”音频时间。画面要和它对齐，而不是和 currentTime 对齐。 */
  heardNow() {
    return this.perfToCtx(performance.now());
  }

  setBusLevel(name, level) {
    const bus = this.buses[name];
    if (bus) bus.gain.setTargetAtTime(clamp(level, 0, 1.5), this.ctx.currentTime, 0.02);
  }

  // ───────────── 节拍器 ─────────────

  click(time, accent = false) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = Math.max(time ?? 0, ctx.currentTime);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = accent ? 1760 : 1175;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(accent ? 0.9 : 0.6, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    o.connect(g).connect(this.buses.click);
    o.start(t);
    o.stop(t + 0.06);
  }

  // ───────────── 鼓 ─────────────

  #noise(t, { dur, gain, type = 'highpass', freq = 6000, q = 0.7, attack = 0.001, bus = 'drums' }) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.#noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.buses[bus]);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  #tone(t, { type = 'sine', from, to, sweep = 0.1, dur, gain, attack = 0.002, bus = 'drums' }) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    if (to && to !== from) o.frequency.exponentialRampToValueAtTime(to, t + sweep);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.buses[bus]);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** lane: KICK / SNARE / CLAP / HAT1 / HAT2 / PERC1 / PERC2 */
  drum(lane, time, vel = 1, bus = 'drums') {
    if (!this.ready) return;
    const t = Math.max(time ?? 0, this.ctx.currentTime);
    const v = clamp(vel, 0.05, 1.2);
    switch (lane) {
      case 'KICK':
        this.#tone(t, { from: 165, to: 46, sweep: 0.11, dur: 0.42, gain: 1.0 * v, attack: 0.004, bus });
        this.#noise(t, { dur: 0.012, gain: 0.3 * v, freq: 3000, bus });
        break;
      case 'SNARE':
        this.#tone(t, { type: 'triangle', from: 200, to: 140, sweep: 0.08, dur: 0.12, gain: 0.5 * v, bus });
        this.#noise(t, { dur: 0.2, gain: 0.55 * v, freq: 1400, bus });
        break;
      case 'CLAP':
        for (const dt of [0, 0.011, 0.023]) this.#noise(t + dt, { dur: 0.018, gain: 0.5 * v, type: 'bandpass', freq: 1150, q: 1.4, bus });
        this.#noise(t + 0.032, { dur: 0.19, gain: 0.5 * v, type: 'bandpass', freq: 1150, q: 1.1, bus });
        break;
      case 'HAT1':
        this.#noise(t, { dur: 0.05, gain: 0.34 * v, freq: 8200, bus });
        break;
      case 'HAT2':
        this.#noise(t, { dur: 0.34, gain: 0.28 * v, freq: 7200, bus });
        break;
      case 'PERC1':
        this.#tone(t, { type: 'triangle', from: 860, to: 800, sweep: 0.03, dur: 0.05, gain: 0.5 * v, bus });
        this.#noise(t, { dur: 0.02, gain: 0.2 * v, type: 'bandpass', freq: 2400, q: 2, bus });
        break;
      case 'PERC2':
        this.#tone(t, { type: 'square', from: 545, dur: 0.22, gain: 0.16 * v, bus });
        this.#tone(t, { type: 'square', from: 815, dur: 0.22, gain: 0.16 * v, bus });
        break;
      // 镲片（Crash）：不是轨道名，是曲目分轨里鼓轨可以借用的声音（分轨上写 drum: 'CRASH'；机器上是那条鼓轨挑一个镲片音色）
      case 'CRASH':
        this.#noise(t, { dur: 1.9, gain: 0.26 * v, freq: 4800, bus });
        this.#noise(t, { dur: 0.5, gain: 0.16 * v, type: 'bandpass', freq: 3000, q: 0.7, bus });
        break;
      default:
        this.#noise(t, { dur: 0.05, gain: 0.3 * v, bus });
    }
  }

  // ───────────── 合成器 ─────────────

  /**
   * 播放一个有固定时长的音。midi 是 MIDI 音符号（60 = 中央 C）。
   * dur 传 null 表示按住不放，返回的函数用来松开。
   */
  note(midi, time, dur = 0.25, { voice = 'keys', vel = 0.9, bus = 'synth', tweak = null } = {}) {
    if (!this.ready) return () => {};
    const ctx = this.ctx;
    const def = VOICES[voice] || VOICES.keys;
    if (!tweak && def.tweak) tweak = def.tweak; // 小测里那几种“拧过一下”的声音自己带着
    const t = Math.max(time ?? 0, ctx.currentTime);
    const freq = midiToFreq(midi);
    const tw = tweak || {};
    // 起音、衰减按音色自己的值等比放大缩小（不给 tweak 时和原来一模一样）
    const a = tweak ? clamp(def.amp.a * tw2(tw.attack, 9), 0.001, 6) : def.amp.a;
    const d = tweak ? clamp(def.amp.d * tw2(tw.decay, 11), 0.02, 8) : def.amp.d;
    const r = tweak ? clamp(def.amp.r * tw2(tw.decay, 11), 0.02, 8) : def.amp.r;
    const s = def.amp.s;
    const peak = def.level * clamp(vel, 0.05, 1.2);
    const out = this.buses[bus] || this.buses.synth;
    const stopAt = []; // 松手之后跟着停的振荡器（LFO 也在里面）

    // 第 4 章的 LP-HP 滤波器（机器上每条轨道一个，接在音色后面）：只在拧过的时候才接上
    let post = out;
    let lphp = null;
    if (tweak && (Math.abs(tw.cutoff || 0) >= 1 || tw.lfo?.to === 'filter')) {
      lphp = ctx.createBiquadFilter();
      const hz = lphpCutoff(tw.cutoff);
      lphp.type = (tw.cutoff || 0) > 0 ? 'highpass' : 'lowpass';
      lphp.frequency.value = hz || (tw.lfo?.to === 'filter' ? 1400 : 19000);
      const reso = tw.reso || 0;
      lphp.Q.value = reso >= 0 ? 0.7 + (reso / 63) * 17 : clamp(0.7 * tw2(reso, 40), 0.3, 0.7);
      lphp.connect(post);
      post = lphp;
    }
    // 会自己摆的那只手（LFO）：机器上是 [FX] 旋钮里 MODULATION 那一类效果。接在最后面，管音量 / 左右 / 滤波器 / 音高
    const lfo = tweak?.lfo && tw.lfo.depth > 0.01 ? (() => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = clamp(tw.lfo.rate || 4, 0.05, 40);
      const g = ctx.createGain();
      o.connect(g);
      o.start(t);
      stopAt.push(o);
      return { o, g, to: tw.lfo.to, depth: clamp(tw.lfo.depth, 0, 1) };
    })() : null;
    if (lfo?.to === 'amp') {
      const trem = ctx.createGain();
      trem.gain.value = 1 - lfo.depth * 0.5;
      lfo.g.gain.value = lfo.depth * 0.5;
      lfo.g.connect(trem.gain);
      trem.connect(post);
      post = trem;
    } else if (lfo?.to === 'pan' && ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner();
      lfo.g.gain.value = lfo.depth;
      lfo.g.connect(pan.pan);
      pan.connect(post);
      post = pan;
    } else if (lfo?.to === 'filter' && lphp) {
      const center = lphp.frequency.value;
      lfo.g.gain.value = center * 0.85 * lfo.depth;
      lfo.g.connect(lphp.frequency);
      lphp.Q.value = Math.max(lphp.Q.value, 3.5);
    }

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(peak, t + a);
    amp.gain.exponentialRampToValueAtTime(Math.max(peak * s, 0.0002), t + a + d);
    amp.connect(post);

    if (def.fm) return this.#fmVoice({ t, freq, def, tw, amp, a, d, r, dur, stopAt, lfo });

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = def.filter.q;
    const fPeak = clamp(freq * def.filter.peakMul, def.filter.peakMin, def.filter.peakMax);
    filter.frequency.setValueAtTime(def.filter.base, t);
    filter.frequency.exponentialRampToValueAtTime(fPeak, t + 0.008);
    filter.frequency.exponentialRampToValueAtTime(def.filter.sustain, t + 0.008 + def.filter.decay);
    filter.connect(amp);

    const oscs = def.oscs.map((spec) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = spec.type;
      o.frequency.value = freq * spec.ratio;
      if (spec.detune) o.detune.value = spec.detune;
      g.gain.value = spec.gain;
      // 音色表里写了 pan（−1 左 … 1 右）的那一把单独摆位置；后面的滤波器和音量是两个声道各管各的，左右就散开了
      if (spec.pan && ctx.createStereoPanner) {
        const p = ctx.createStereoPanner();
        p.pan.value = spec.pan;
        o.connect(g).connect(p).connect(filter);
      } else {
        o.connect(g).connect(filter);
      }
      if (lfo?.to === 'pitch') lfo.g.connect(o.detune);
      o.start(t);
      return o;
    });
    if (lfo?.to === 'pitch') lfo.g.gain.value = 45 * lfo.depth; // 音分：摆到 ±45 音分就很明显了

    return this.#releaser({ t, a, r, dur, amp, oscs: [...oscs, ...stopAt] });
  }

  /** 松手：音量按 r 落下去，振荡器随后停掉。dur 给了就到点自己松 */
  #releaser({ t, a, r, dur, amp, oscs }) {
    const ctx = this.ctx;
    let released = false;
    const release = (at) => {
      if (released) return;
      released = true;
      const end = Math.max(at ?? ctx.currentTime, t + a);
      amp.gain.cancelScheduledValues(end);
      amp.gain.setTargetAtTime(0.0001, end, r / 3);
      for (const o of oscs) o.stop(end + r * 2 + 0.05);
    };
    if (dur !== null && dur !== undefined) release(t + Math.max(dur, 0.03));
    return release;
  }

  /**
   * FM 的一个音：载波（听到的那个正弦波）被调制器（另一个正弦波，ratio 倍的音高）摇着。
   * 调制量（index）越大，泛音越多、越亮；ratio 不是整数时出来的是铃铛、金属那种不和谐的泛音；
   * 反馈（fb）用一把锯齿波的调制器来近似，加了就有毛刺、发沙。
   * tweak.fm 里的三样是机器 DX 第 5 页那几个旋钮的写法（−64 … +63，0 = 音色本来的样子）
   */
  #fmVoice({ t, freq, def, tw, amp, a, d, r, dur, stopAt, lfo }) {
    const ctx = this.ctx;
    const f = def.fm;
    const fm = tw.fm || {};
    const base = FM_RATIOS.indexOf(f.ratio);
    const ratio = FM_RATIOS[clamp((base < 0 ? 1 : base) + Math.round((fm.freq || 0) / 9), 0, FM_RATIOS.length - 1)];
    const index = clamp(f.index * tw2(fm.amount, 13), 0, 40);
    const fb = clamp(f.fb + (fm.feedback || 0) / 63, 0, 1);
    const car = ctx.createOscillator();
    car.type = 'sine';
    car.frequency.value = freq;
    const mod = ctx.createOscillator();
    mod.type = 'sine';
    mod.frequency.value = freq * ratio;
    const dev = ctx.createGain(); // 调制深度：频率偏移多少赫兹 = index × 调制器的频率
    const peakDev = Math.max(index * freq * ratio, 0.0001);
    dev.gain.setValueAtTime(peakDev, t);
    dev.gain.exponentialRampToValueAtTime(Math.max(peakDev * f.idx, 0.0001), t + a + d);
    mod.connect(dev).connect(car.frequency);
    const oscs = [car, mod, ...stopAt];
    if (fb > 0.01) {
      const buzz = ctx.createOscillator();
      buzz.type = 'sawtooth';
      buzz.frequency.value = freq * ratio;
      const bg = ctx.createGain();
      bg.gain.value = fb * freq * 1.6;
      buzz.connect(bg).connect(car.frequency);
      buzz.start(t);
      oscs.push(buzz);
    }
    if (lfo?.to === 'pitch') {
      lfo.g.gain.value = 45 * lfo.depth;
      lfo.g.connect(car.detune);
      lfo.g.connect(mod.detune);
    }
    car.connect(amp);
    car.start(t);
    mod.start(t);
    return this.#releaser({ t, a, r, dur, amp, oscs });
  }

  /** 给选择音频输出设备用（例如把节拍器送进 SEQTRAK 的 USB 音频）。Chrome 110+。 */
  async setSink(deviceId) {
    if (this.ctx?.setSinkId) await this.ctx.setSinkId(deviceId || '');
  }
}

export const audio = new AudioEngine();
export { midiToFreq };

// ───────────── 音名工具 ─────────────

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** 60 → "C3"（按 Yamaha 的叫法，中央 C 是 C3） */
export function midiToName(m) {
  return `${NOTE_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 2}`;
}

/** "C3" → 60；"F#1" → 42。 */
export function nameToMidi(name) {
  const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(String(name).trim());
  if (!m) return null;
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1].toUpperCase()];
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return (Number(m[3]) + 2) * 12 + base + acc;
}
