// 效果实验台：一段一直循环的鼓和贝斯，经过一个效果再出来。全部用浏览器自带的 Web Audio 现做，不带任何音频文件。
// 三样东西，可以分开用：
//   FxEngine      声音：循环 + 效果链（低通 / 高通 / 混响 / 延迟）+ “原声 / 加效果”对比 + 每条轨道自己的滤波器
//   createScope   画面：让人看见声音变了（灰色 = 原声，彩色 = 现在听到的）
//   createFxLab   一整台实验台：画面 + 播放 + 对比开关 + 一条竖着的触摸条（样子照着机器上的 [FX LEVEL]）
// 小课堂的效果线在用；以后讲音色（第 4 章）、讲效果（第 7 章）的课也可以直接嵌。
// 鼓和贝斯用的是应用自己的合成声音（audio.js），只是不直接送去喇叭，而是先送进这里的效果链。
import { h, clamp, Emitter } from './util.js';
import { audio } from './audio.js';
import { LoopPlayer } from './looper.js';
import { theme } from './theme.js';

if (!document.querySelector('link[data-fxlab]')) {
  document.head.append(h('link', { rel: 'stylesheet', href: '/css/fxlab.css', 'data-fxlab': '' }));
}

/** 能选的几种“房间”（混响）：声音拖多长的尾巴 */
export const ROOMS = [
  { id: 'small', label: '小房间', seconds: 0.45, decay: 2.2 },
  { id: 'hall', label: '大厅', seconds: 2.1, decay: 2.6 },
  { id: 'cave', label: '山洞', seconds: 5, decay: 2.1 },
];

/** 能选的几种“回声”（延迟）：隔多久回来一次，按拍子算 */
export const ECHOES = [
  { id: 'beat', label: '一拍一次', beats: 1 },
  { id: 'half', label: '半拍一次', beats: 0.5 },
  { id: 'dot', label: '错开着回', beats: 0.75 },
];

// 循环的素材。send: false = 这一样不进效果（像机器上那条轨道的发送量是 0）；音符是 [第几步, MIDI 音符号, 持续几步]
const LOOPS = {
  // 鼓 + 贝斯，什么都有：滤波器类的效果用它
  full: {
    bpm: 108,
    parts: [
      { track: 'KICK', pattern: 'x---x---x---x---' },
      { track: 'SNARE', pattern: '----x-------x---' },
      { track: 'HAT1', pattern: 'x-x-x-x-x-xxx-x-', vel: 0.75 },
      { track: 'SYNTH1', notes: [[0, 36, 2], [3, 36, 1], [6, 39, 2], [8, 36, 2], [11, 43, 1], [14, 34, 2]] },
    ],
  },
  // 稀一点，留出空当：听得见混响拖的尾巴
  room: {
    bpm: 92,
    parts: [
      { track: 'KICK', pattern: 'x---------x-----', send: false },
      { track: 'CLAP', pattern: '----x-------x---' },
      { track: 'HAT1', pattern: '--x---x---x---x-', vel: 0.5 },
      { track: 'SYNTH1', notes: [[0, 36, 3], [10, 39, 2]], send: false },
    ],
  },
  // 每小节只“嗒”一下，后面空着：回声回来几次、踩在哪儿，数得出来
  echo: {
    bpm: 100,
    parts: [
      { track: 'KICK', pattern: 'x---x---x---x---', vel: 0.7, send: false },
      { track: 'PERC1', pattern: 'x---------------' },
      { track: 'SYNTH1', notes: [[0, 36, 2], [8, 36, 2]], vel: 0.6, send: false },
    ],
  },
};

let engines = 0;

export class FxEngine extends Emitter {
  /** loop: 'full' | 'room' | 'echo' */
  constructor({ loop = 'full' } = {}) {
    super();
    this.id = `fxlab${++engines}`;
    this.state = { effect: 'none', amount: 0.6, on: true, room: 1, echo: 0, loop, playing: false };
    this.loop = LOOPS[loop] || LOOPS.full;
    this.trackFilter = {}; // 轨道 → −1…1：负 = 低通（越小越闷），正 = 高通（越大越薄），0 = 不动
    this.player = new LoopPlayer({ bpm: this.loop.bpm, steps: 16 });
    this.player.onSchedule = (step, t) => this.#schedule(step, t);
    this.nodes = null;
  }

  get bpm() {
    return this.loop.bpm;
  }

  /** 现在这种效果，截止频率在哪（赫兹）；不是滤波器时返回 0。画面上那条线用它 */
  get cutoff() {
    const { effect, amount, on } = this.state;
    if (!on) return 0;
    if (effect === 'lowpass') return 18000 * (130 / 18000) ** amount;
    if (effect === 'highpass') return 30 * (4000 / 30) ** amount;
    return 0;
  }

  #build() {
    const ctx = audio.ctx;
    const g = (v = 1) => {
      const n = ctx.createGain();
      n.gain.value = v;
      return n;
    };
    const an = () => {
      const a = ctx.createAnalyser();
      a.fftSize = 2048;
      a.smoothingTimeConstant = 0.72;
      return a;
    };
    const n = {
      fxIn: g(), dryIn: g(), mix: g(), out: g(0.95), send: g(), wet: g(0),
      insert: ctx.createBiquadFilter(), before: an(), after: an(), mute: g(0),
      conv: ctx.createConvolver(), delay: ctx.createDelay(2.5), fb: g(0.4), fbTone: ctx.createBiquadFilter(),
      tracks: {}, filters: {},
    };
    n.insert.type = 'lowpass';
    n.insert.frequency.value = 20000;
    n.insert.Q.value = 0.8;
    n.fbTone.type = 'lowpass';
    n.fbTone.frequency.value = 3200;
    // 每条轨道先过自己的滤波器（机器上每条轨道也各有一个），再一起进效果
    for (const part of this.loop.parts) {
      if (part.send === false) continue;
      const input = g();
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 20000;
      f.Q.value = 0.8;
      input.connect(f).connect(n.fxIn);
      n.tracks[part.track] = input;
      n.filters[part.track] = f;
      audio.buses[`${this.id}:${part.track}`] = input;
    }
    audio.buses[`${this.id}:dry`] = n.dryIn;
    // “原声”那一路只拿来画，不出声
    n.fxIn.connect(n.before);
    n.dryIn.connect(n.before);
    n.before.connect(n.mute).connect(n.mix);
    n.dryIn.connect(n.mix);
    n.fxIn.connect(n.insert).connect(n.mix);
    n.insert.connect(n.send);
    n.conv.connect(n.wet);
    n.delay.connect(n.wet);
    n.delay.connect(n.fbTone).connect(n.fb).connect(n.delay);
    n.wet.connect(n.mix);
    n.mix.connect(n.after).connect(n.out).connect(audio.master);
    this.nodes = n;
    this.#route();
    this.#apply(true);
    for (const [track, v] of Object.entries(this.trackFilter)) this.setTrackFilter(track, v);
  }

  #impulse(room) {
    const ctx = audio.ctx;
    const len = Math.floor(ctx.sampleRate * room.seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** room.decay;
    }
    return buf;
  }

  /** 把“发送”那一路接到现在这种效果上 */
  #route() {
    const n = this.nodes;
    if (!n) return;
    n.send.disconnect();
    const { effect, room } = this.state;
    if (effect === 'reverb') {
      this.impulses ||= {};
      const r = ROOMS[room] || ROOMS[1];
      n.conv.buffer = this.impulses[r.id] ||= this.#impulse(r);
      n.send.connect(n.conv);
    } else if (effect === 'delay') {
      n.send.connect(n.delay);
    }
  }

  #apply(now = false) {
    const n = this.nodes;
    if (!n) return;
    const t = audio.ctx.currentTime;
    const tc = now ? 0.001 : 0.03;
    const { effect, amount, on, echo } = this.state;
    const filt = effect === 'lowpass' || effect === 'highpass';
    if (n.insert.type !== (effect === 'highpass' ? 'highpass' : 'lowpass')) n.insert.type = effect === 'highpass' ? 'highpass' : 'lowpass';
    n.insert.frequency.setTargetAtTime(filt && on ? this.cutoff : effect === 'highpass' ? 20 : 20000, t, tc);
    // 混响那一路要补很多：卷积出来的尾巴是摊在几秒里的，量到的峰值只有进去时的 8% 左右，补到 5 倍才到三四成
    const wet = !on ? 0 : effect === 'reverb' ? amount * 5 : effect === 'delay' ? amount * 0.9 : 0;
    n.wet.gain.setTargetAtTime(wet, t, tc);
    if (effect === 'delay') {
      n.delay.delayTime.setTargetAtTime((60 / this.bpm) * (ECHOES[echo] || ECHOES[0]).beats, t, 0.01);
      n.fb.gain.setTargetAtTime(0.32 + amount * 0.26, t, tc);
    }
  }

  #schedule(step, t) {
    const stepSec = 60 / this.bpm / 4;
    for (const p of this.loop.parts) {
      const bus = `${this.id}:${p.send === false ? 'dry' : p.track}`;
      const c = p.pattern?.[step];
      if (c === 'x' || c === 'X') audio.drum(p.track, t, (c === 'X' ? 1 : 0.85) * (p.vel ?? 1), bus);
      for (const [s, note, len] of p.notes || []) {
        if (s === step) audio.note(note, t, len * stepSec * 0.92, { voice: p.voice || 'bass', vel: p.vel ?? 0.85, bus });
      }
    }
  }

  /** 改设置：{ effect, amount, on, room, echo } 里给哪样改哪样 */
  set(patch) {
    const before = this.state;
    this.state = { ...before, ...patch, amount: clamp(patch.amount ?? before.amount, 0, 1) };
    if (this.state.effect !== before.effect || this.state.room !== before.room) this.#route();
    this.#apply();
    this.emit('change', this.state);
    return this;
  }

  /** 某条轨道自己的滤波器：v 从 −1 到 1，负的往闷里走（低通），正的往薄里走（高通），0 是原样 */
  setTrackFilter(track, v) {
    const value = clamp(v, -1, 1);
    this.trackFilter[track] = value;
    const f = this.nodes?.filters[track];
    if (!f) return;
    const type = value > 0.04 ? 'highpass' : 'lowpass';
    if (f.type !== type) f.type = type;
    const freq = Math.abs(value) <= 0.04 ? (type === 'highpass' ? 20 : 20000) : value < 0 ? 18000 * (160 / 18000) ** -value : 30 * (5000 / 30) ** value;
    f.frequency.setTargetAtTime(freq, audio.ctx.currentTime, 0.03);
  }

  async start() {
    if (this.state.playing) return true;
    if (!(await audio.init())) return false;
    if (!this.nodes) this.#build();
    this.state.playing = true;
    await this.player.start();
    this.emit('play', true);
    return true;
  }

  stop() {
    if (!this.state.playing) return;
    this.state.playing = false;
    this.player.stop();
    this.emit('play', false);
  }

  toggle() {
    if (this.state.playing) this.stop();
    else this.start();
  }

  destroy() {
    this.stop();
    const n = this.nodes;
    if (!n) return;
    for (const key of Object.keys(audio.buses)) if (key.startsWith(`${this.id}:`)) delete audio.buses[key];
    // 尾巴（混响、回声）让它自己收完，再把这条链从喇叭上拔下来
    n.out.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.08);
    setTimeout(() => n.out.disconnect(), 600);
    this.nodes = null;
  }
}

// ───────────── 画面 ─────────────

const BARS = 44;
const F_LO = 40;
const F_HI = 16000;

/**
 * 一块实时的画面。kind:
 *   'spectrum'  一排柱子，左边是低音、右边是高音。滤波器把哪一段削掉了，一眼看得出
 *   'trail'     声音大小随时间留下的痕迹，从右往左流。混响的尾巴、回声的一串小峰都在上面
 * 灰色的是原声，彩色的是现在听到的。
 */
export function createScope(engine, { kind = 'spectrum' } = {}) {
  const canvas = h('canvas', { class: 'fx-scope', 'aria-label': '声音的实时画面：灰色是原声，彩色是现在听到的' });
  const g = canvas.getContext('2d');
  let mode = kind;
  let raf = 0;
  let lastDraw = 0;
  let lastCol = 0;
  let hidden = false;
  const trail = { before: [], after: [] };
  let freq = null;
  let wave = null;
  let colors = {};
  const pick = () => {
    colors = { before: theme.css('--line-3'), after: theme.css('--accent'), ink: theme.css('--text'), grid: theme.css('--line'), mask: theme.css('--panel-3') };
  };
  pick();
  const offTheme = theme.on('change', () => {
    pick();
    draw();
  });

  function size() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(10, Math.round(r.width * dpr));
    const hh = Math.max(10, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== hh) {
      canvas.width = w;
      canvas.height = hh;
    }
    return { w, hh, dpr };
  }

  const xOfFreq = (f, w) => (Math.log(clamp(f, F_LO, F_HI) / F_LO) / Math.log(F_HI / F_LO)) * w;

  function bars(an) {
    freq ||= new Uint8Array(an.frequencyBinCount);
    an.getByteFrequencyData(freq);
    const nyq = audio.ctx.sampleRate / 2;
    const out = [];
    for (let i = 0; i < BARS; i++) {
      const lo = F_LO * (F_HI / F_LO) ** (i / BARS);
      const hi = F_LO * (F_HI / F_LO) ** ((i + 1) / BARS);
      const a = Math.floor((lo / nyq) * freq.length);
      const b = Math.max(a + 1, Math.ceil((hi / nyq) * freq.length));
      let peak = 0;
      for (let k = a; k < b && k < freq.length; k++) peak = Math.max(peak, freq[k]);
      out.push(peak / 255);
    }
    return out;
  }

  function level(an) {
    wave ||= new Uint8Array(an.fftSize);
    an.getByteTimeDomainData(wave);
    let peak = 0;
    for (let i = 0; i < wave.length; i += 2) peak = Math.max(peak, Math.abs(wave[i] - 128));
    // 开个方再画：尾巴和回声比直接响的那一下小得多，照原样画就成了贴着中线的一条细线，看不出来
    return Math.min(1, Math.sqrt(peak / 128) * 1.3);
  }

  function drawSpectrum(n, w, hh, dpr) {
    const gap = 2 * dpr;
    const bw = (w - gap * (BARS - 1)) / BARS;
    const base = hh - 18 * dpr;
    const before = n ? bars(n.before) : Array(BARS).fill(0);
    const after = n ? bars(n.after) : Array(BARS).fill(0);
    for (let i = 0; i < BARS; i++) {
      const x = i * (bw + gap);
      g.fillStyle = colors.before;
      g.globalAlpha = 0.5;
      g.fillRect(x, base - Math.max(2 * dpr, before[i] * base * 0.94), bw, Math.max(2 * dpr, before[i] * base * 0.94));
      g.fillStyle = colors.after;
      g.globalAlpha = 1;
      g.fillRect(x, base - after[i] * base * 0.94, bw, after[i] * base * 0.94);
    }
    // 滤波器在哪儿下刀：一条竖线，被削掉的那一侧蒙上一层
    const cut = engine.cutoff;
    if (cut) {
      const x = xOfFreq(cut, w);
      const high = engine.state.effect === 'highpass';
      g.globalAlpha = 0.55;
      g.fillStyle = colors.mask;
      if (high) g.fillRect(0, 0, x, base);
      else g.fillRect(x, 0, w - x, base);
      g.globalAlpha = 1;
      g.fillStyle = colors.ink;
      g.fillRect(x - dpr, 0, 2 * dpr, base);
    }
    g.globalAlpha = 1;
    g.fillStyle = colors.ink;
    g.font = `${12 * dpr}px ${theme.css('--font') || 'sans-serif'}`;
    g.textBaseline = 'bottom';
    g.textAlign = 'left';
    g.fillText('低音', 2 * dpr, hh);
    g.textAlign = 'right';
    g.fillText('高音', w - 2 * dpr, hh);
  }

  function drawTrail(n, w, hh, dpr, now) {
    const colW = 3 * dpr;
    const cols = Math.ceil(w / colW);
    // 按时间往前推，不按帧数：画面被挡住、掉帧的时候，痕迹的速度也不变
    const stepMs = 14;
    if (!lastCol) lastCol = now;
    let add = engine.state.playing ? Math.min(cols, Math.floor((now - lastCol) / stepMs)) : 0;
    if (add) lastCol += add * stepMs;
    else if (!engine.state.playing) lastCol = now;
    const b = n ? level(n.before) : 0;
    const a = n ? level(n.after) : 0;
    while (add-- > 0) {
      trail.before.push(b);
      trail.after.push(a);
    }
    while (trail.before.length > cols) {
      trail.before.shift();
      trail.after.shift();
    }
    const mid = hh / 2;
    g.fillStyle = colors.grid;
    g.fillRect(0, mid - dpr / 2, w, dpr);
    const offset = cols - trail.before.length;
    for (let i = 0; i < trail.before.length; i++) {
      const x = (offset + i) * colW;
      const hb = trail.before[i] * mid * 0.92;
      const ha = trail.after[i] * mid * 0.92;
      g.fillStyle = colors.after;
      g.globalAlpha = 1;
      g.fillRect(x, mid - ha, colW - dpr, ha * 2 || dpr);
      g.fillStyle = colors.before;
      g.globalAlpha = 0.85;
      g.fillRect(x, mid - hb, colW - dpr, hb * 2 || dpr);
    }
    g.globalAlpha = 1;
  }

  function draw() {
    const now = performance.now();
    lastDraw = now;
    const { w, hh, dpr } = size();
    g.clearRect(0, 0, w, hh);
    if (hidden) return;
    if (mode === 'trail') drawTrail(engine.nodes, w, hh, dpr, now);
    else drawSpectrum(engine.nodes, w, hh, dpr);
  }

  const frame = () => {
    draw();
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  // 页面被挡住的时候浏览器不给逐帧的回调：隔一阵自己补一帧，免得画面停在很久以前
  const backup = setInterval(() => {
    if (performance.now() - lastDraw > 150) draw();
  }, 120);

  return {
    el: canvas,
    draw,
    setKind(k) {
      mode = k;
      trail.before.length = 0;
      trail.after.length = 0;
      lastCol = 0;
    },
    /** 盲听的时候把画面盖住（看得见就不用听了） */
    setHidden(v) {
      hidden = !!v;
      canvas.classList.toggle('blind', hidden);
    },
    destroy() {
      cancelAnimationFrame(raf);
      clearInterval(backup);
      offTheme();
    },
  };
}

// ───────────── 竖着的触摸条 ─────────────

/**
 * 样子照着机器上的触摸滑条：竖着的一条，上面 7 道横线，手指按上去上下滑。
 * 返回 { el, set(v), value }；onInput(v) 里 v 从 0（最下）到 1（最上）。
 */
export function touchStrip({ label = 'FX LEVEL', value = 0.5, onInput, readout = (v) => `${Math.round(v * 100)}%` } = {}) {
  let v = clamp(value, 0, 1);
  const fill = h('i', { class: 'fx-strip-fill' });
  const thumb = h('i', { class: 'fx-strip-thumb' });
  const text = h('div', { class: 'fx-strip-read' });
  const track = h('div', { class: 'fx-strip-track', role: 'slider', tabindex: '0', 'aria-label': label, 'aria-valuemin': '0', 'aria-valuemax': '100' },
    fill, Array.from({ length: 7 }, () => h('b')), thumb);
  const paint = () => {
    fill.style.height = `${v * 100}%`;
    thumb.style.bottom = `${v * 100}%`;
    track.setAttribute('aria-valuenow', String(Math.round(v * 100)));
    text.textContent = readout(v);
  };
  const setFromEvent = (e) => {
    const r = track.getBoundingClientRect();
    const pad = 14; // 上下各留一点：手指按在最边上也够得到 0 和 100
    v = clamp(1 - (e.clientY - r.top - pad) / (r.height - pad * 2), 0, 1);
    paint();
    onInput?.(v);
  };
  let dragging = false;
  track.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    dragging = true;
    try {
      track.setPointerCapture(e.pointerId);
    } catch {
      /* 有的输入方式不支持捕获 */
    }
    track.classList.add('touch');
    setFromEvent(e);
  });
  track.addEventListener('pointermove', (e) => dragging && setFromEvent(e));
  const end = () => {
    dragging = false;
    track.classList.remove('touch');
  };
  track.addEventListener('pointerup', end);
  track.addEventListener('pointercancel', end);
  track.addEventListener('keydown', (e) => {
    const d = { ArrowUp: 0.05, ArrowRight: 0.05, ArrowDown: -0.05, ArrowLeft: -0.05 }[e.key];
    if (!d) return;
    e.preventDefault();
    v = clamp(v + d, 0, 1);
    paint();
    onInput?.(v);
  });
  paint();
  const el = h('div', { class: 'fx-strip' }, h('div', { class: 'fx-strip-label' }, label), track, text);
  return {
    el,
    get value() {
      return v;
    },
    set(next, quiet = true) {
      v = clamp(next, 0, 1);
      paint();
      if (!quiet) onInput?.(v);
    },
    setReadout(fn) {
      readout = fn;
      paint();
    },
    setDisabled(off) {
      el.classList.toggle('off', !!off);
    },
  };
}

// ───────────── 一整台实验台 ─────────────

/** 每种效果在台子上长什么样：用哪段循环、哪种画面、触摸条叫什么、读数怎么说 */
export const EFFECTS = {
  lowpass: { name: '捂住', loop: 'full', scope: 'spectrum', strip: 'FILTER', read: (v) => (v < 0.08 ? '全开' : v < 0.4 ? '捂了一点' : v < 0.75 ? '闷' : '只剩咚咚') },
  highpass: { name: '抽走低音', loop: 'full', scope: 'spectrum', strip: 'HIGH PASS', read: (v) => (v < 0.08 ? '全在' : v < 0.5 ? '低音少了' : '只剩沙沙') },
  reverb: { name: '房间', loop: 'room', scope: 'trail', strip: 'FX LEVEL', read: (v) => (v < 0.05 ? '没加' : v < 0.4 ? '一点点' : v < 0.75 ? '明显' : '泡在里面') },
  delay: { name: '回声', loop: 'echo', scope: 'trail', strip: 'FX LEVEL', read: (v) => (v < 0.05 ? '没加' : v < 0.4 ? '轻轻的' : v < 0.75 ? '明显' : '回个不停') },
};

/**
 * opts:
 *   effect     'lowpass' | 'highpass' | 'reverb' | 'delay'
 *   choices    给一组效果让人换着试，例如 ['delay', 'reverb', 'lowpass']（循环用 loop 指定的那一段）
 *   loop       用哪段循环（不写就按效果自己的）
 *   amount     触摸条一开始的位置（0–1）
 *   on         一开始是“加效果”还是“原声”
 *   rooms / echoes   要不要摆出“房间大小”/“回声间隔”那一排
 *   onChange(state, what)   状态变了。what = 'amount' | 'on' | 'effect' | 'room' | 'echo' | 'play'
 */
export function createFxLab({ effect = 'lowpass', choices = null, loop, amount = 0.5, on = true, rooms = false, echoes = false, onChange } = {}) {
  const first = choices?.[0] || effect;
  const engine = new FxEngine({ loop: loop || EFFECTS[first].loop });
  engine.set({ effect: first, amount, on });
  const scope = createScope(engine, { kind: EFFECTS[first].scope });
  const cleanup = [() => scope.destroy(), () => engine.destroy()];
  const tell = (what) => onChange?.(engine.state, what);

  const strip = touchStrip({
    label: EFFECTS[first].strip,
    value: amount,
    readout: EFFECTS[first].read,
    onInput: (v) => {
      // 一动滑条就算“加效果”：不然在“原声”那一档上拖半天没反应，会以为坏了
      engine.set({ amount: v, on: true });
      paintAb();
      tell('amount');
    },
  });

  const play = h('button', { class: 'btn primary lg fx-play', type: 'button' }, '▶ 播放');
  play.addEventListener('click', () => engine.toggle());
  cleanup.push(engine.on('play', (p) => {
    play.textContent = p ? '■ 停' : '▶ 播放';
    el.classList.toggle('playing', p);
    tell('play');
  }));

  const ab = h('div', { class: 'fx-ab', role: 'group', 'aria-label': '原声和加效果对比' },
    h('button', { type: 'button', 'data-sfx': 'off', onclick: () => setOn(false) }, '原声'),
    h('button', { type: 'button', 'data-sfx': 'on', onclick: () => setOn(true) }, '加效果'));
  const paintAb = () => {
    ab.children[0].classList.toggle('on', !engine.state.on);
    ab.children[1].classList.toggle('on', engine.state.on);
    el?.classList.toggle('wet', engine.state.on);
  };
  function setOn(v) {
    engine.set({ on: v });
    paintAb();
    tell('on');
  }

  const seg = (items, current, pick, label) => {
    const box = h('div', { class: 'seg fx-seg', role: 'group', 'aria-label': label });
    const paint = (now) => box.replaceChildren(...items.map((it, i) => h('button', { type: 'button', class: i === now ? 'on' : '', onclick: () => { paint(i); pick(i); } }, it)));
    paint(current);
    return box;
  };
  const extras = [];
  if (choices) {
    extras.push(seg(choices.map((c) => EFFECTS[c].name), 0, (i) => {
      const def = EFFECTS[choices[i]];
      engine.set({ effect: choices[i], on: true });
      scope.setKind(def.scope);
      strip.setReadout(def.read);
      paintAb();
      tell('effect');
    }, '换一种效果'));
  }
  if (rooms) extras.push(seg(ROOMS.map((r) => r.label), engine.state.room, (i) => { engine.set({ room: i, on: true }); paintAb(); tell('room'); }, '房间有多大'));
  if (echoes) extras.push(seg(ECHOES.map((e) => e.label), engine.state.echo, (i) => { engine.set({ echo: i, on: true }); paintAb(); tell('echo'); }, '回声多久回来一次'));

  const legend = h('div', { class: 'fx-legend' }, h('span', { class: 'dry' }, '原声'), h('span', { class: 'now' }, '现在听到的'));
  const el = h('div', { class: 'fxlab' },
    h('div', { class: 'fx-main' },
      h('div', { class: 'fx-screen' }, scope.el, legend),
      h('div', { class: 'fx-controls' }, play, ab, extras)),
    strip.el);
  paintAb();

  const api = {
    el,
    engine,
    scope,
    strip,
    start: () => engine.start(),
    stop: () => engine.stop(),
    /** 从外面改设置（盲听出题、听目标用）：滑条和开关跟着动 */
    set(patch) {
      engine.set(patch);
      if (patch.amount !== undefined) strip.set(patch.amount);
      paintAb();
    },
    /** 出题的时候把旋钮都藏起来，只留“播放” */
    setBlind(v) {
      el.classList.toggle('blind', !!v);
      scope.setHidden(v);
    },
    destroy() {
      cleanup.splice(0).forEach((f) => f());
    },
  };
  el.__lab = api; // 从页面上的节点找回这台实验台（走查脚本、调试用）
  return api;
}
