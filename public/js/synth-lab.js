// 音色实验台（第 4 章「合成与音色设计」）：一小段一直循环的音，旁边一列照着机器右边做的桔红旋钮，拧哪个听哪个。
// 全部用 Web Audio 现做（audio.js 的 note() 带 tweak），不带音频文件。和小课堂的效果实验台（fxlab.js）是一家：
// 频谱画面直接用 fxlab 的 createScope，“滤波器只管一条轨道”那一台直接用 fxlab 的 FxEngine。
//
// 课程里当小部件用（widgets.js 里登记的名字）：
//   { widget: 'synthlab', lab: 'filter' | 'envelope' | 'lfo' | 'fm' | 'presets', … }   见 createSynthLab 的说明
//   { widget: 'trackfilter' }    一整段鼓 + 贝斯，只给贝斯那条轨道拧滤波器 / 给整台拧：机器上两个不同的地方
//   { widget: 'catkeys' }        机器上 16 个方键对应的 16 类音色，点一个听个大概
// 旋钮的值和机器上 CC 的写法一样：−64 … +63，0 = 这个音色本来的样子（audio.js 的 TWEAK_RANGE）。
import { h, clamp, Emitter } from './util.js';
import { audio, lphpCutoff } from './audio.js';
import { LoopPlayer } from './looper.js';
import { createScope, FxEngine } from './fxlab.js';
import { theme } from './theme.js';

if (!document.querySelector('link[data-synthlab]')) {
  document.head.append(h('link', { rel: 'stylesheet', href: '/css/synthlab.css', 'data-synthlab': '' }));
}

// ───────────── 一个旋钮（照机器上 Sound Design 那几个做的：黑色、一道白线） ─────────────

/**
 * label = 上面那行亮着的字（照机器的 Index：FILTER、ATTACK…）；readout(v) = 下面那行用人话说的值。
 * 上下拖、滚轮、方向键都能转；双击回到 0（原样）。返回 { el, set(v), value }。
 */
export function knob({ label, value = 0, min = -64, max = 63, onInput, readout = (v) => String(v), title = '' } = {}) {
  let v = clamp(Math.round(value), min, max);
  const mark = h('i', { class: 'sl-knob-mark' });
  const body = h('div', { class: 'sl-knob', role: 'slider', tabindex: '0', 'aria-label': title || label, 'aria-valuemin': String(min), 'aria-valuemax': String(max) }, h('i', { class: 'sl-knob-cap' }, mark));
  const read = h('div', { class: 'sl-knob-read' });
  const word = h('div', { class: 'sl-knob-label' }, label);
  const paint = () => {
    const turn = ((v - min) / (max - min)) * 270 - 135; // 和机器上一样：最左 −135°，正中间朝上，最右 +135°
    mark.parentNode.style.transform = `rotate(${turn}deg)`;
    body.setAttribute('aria-valuenow', String(v));
    read.textContent = readout(v);
    el.classList.toggle('moved', v !== 0);
  };
  const setTo = (next, quiet = false) => {
    const n = clamp(Math.round(next), min, max);
    if (n === v) return;
    v = n;
    paint();
    if (!quiet) onInput?.(v);
  };
  let drag = null;
  body.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    drag = { y: e.clientY, v };
    try {
      body.setPointerCapture(e.pointerId);
    } catch {
      /* 有的输入方式不支持捕获 */
    }
    el.classList.add('touch');
  });
  body.addEventListener('pointermove', (e) => {
    if (!drag) return;
    setTo(drag.v + (drag.y - e.clientY) / 2.2); // 往上推 = 顺时针
  });
  const end = () => {
    drag = null;
    el.classList.remove('touch');
  };
  body.addEventListener('pointerup', end);
  body.addEventListener('pointercancel', end);
  body.addEventListener('wheel', (e) => {
    e.preventDefault();
    setTo(v + (e.deltaY < 0 ? 4 : -4));
  }, { passive: false });
  body.addEventListener('keydown', (e) => {
    const d = { ArrowUp: 4, ArrowRight: 4, ArrowDown: -4, ArrowLeft: -4 }[e.key];
    if (!d) return;
    e.preventDefault();
    setTo(v + d);
  });
  body.addEventListener('dblclick', () => setTo(0));
  const el = h('div', { class: 'sl-knob-box' }, word, body, read);
  paint();
  return {
    el,
    get value() {
      return v;
    },
    set: (next, quiet = true) => setTo(next, quiet),
    setLabel(text) {
      word.textContent = text;
    },
  };
}

// ───────────── 声音 ─────────────

let engines = 0;
// 几段循环（都在 C 小调，和机器上课程一直用的一样）。音符是 [第几步, MIDI 音符号, 持续几步]
const RIFFS = {
  bass: { bpm: 104, steps: 16, notes: [[0, 36, 2], [3, 36, 1], [6, 39, 2], [8, 36, 2], [11, 43, 1], [14, 34, 2]] },
  // 同一串音给三种音色用：贝斯低一个八度、主旋律高一个八度
  line: { bpm: 100, steps: 16, notes: [[0, 48, 2], [2, 48, 1], [4, 55, 2], [7, 51, 1], [8, 53, 2], [10, 51, 1], [12, 48, 3]] },
  // 两个长和弦（Cm7 → G#maj7），各占半小节：听起音、听摆动
  chords: { bpm: 92, steps: 16, notes: [[0, 48, 8], [0, 51, 8], [0, 55, 8], [0, 58, 8], [8, 44, 8], [8, 48, 8], [8, 51, 8], [8, 55, 8]] },
  // 一拍一个和弦，短的：听衰减（拨一下 / 拖着）
  stabs: { bpm: 96, steps: 16, notes: [[0, 48, 2], [0, 51, 2], [0, 55, 2], [4, 48, 2], [4, 51, 2], [4, 55, 2], [8, 44, 2], [8, 48, 2], [8, 51, 2], [12, 46, 2], [12, 50, 2], [12, 53, 2]] },
  // 一段主旋律（FM、Lead 用）
  melody: { bpm: 100, steps: 16, notes: [[0, 72, 2], [2, 75, 2], [4, 79, 3], [8, 77, 2], [10, 75, 2], [12, 72, 4]] },
};
export { RIFFS };

/**
 * 一台小合成器：一段循环（或手按着的一个音）→ 现在拧的这些参数 → 喇叭。旁边另走一路“原样”的（不出声），只拿来画灰色那层。
 * 对外长得和 fxlab 的 FxEngine 一样（nodes.before / nodes.after / cutoff / state），所以 fxlab 的 createScope 能直接画它。
 */
export class SynthLabEngine extends Emitter {
  constructor({ riff = 'bass', voice = 'saw', transpose = 0 } = {}) {
    super();
    this.id = `synthlab${++engines}`;
    this.riff = RIFFS[riff] || RIFFS.bass;
    this.voice = voice;
    this.transpose = transpose;
    this.tweak = { cutoff: 0, reso: 0, attack: 0, decay: 0, fm: { amount: 0, freq: 0, feedback: 0 }, lfo: null };
    this.player = new LoopPlayer({ bpm: this.riff.bpm, steps: this.riff.steps });
    this.player.onSchedule = (step, t) => this.#schedule(step, t);
    this.nodes = null;
    this.held = null;
  }

  /** 给 fxlab 的画面用：现在是低通还是高通、截止在哪 */
  get state() {
    return { effect: this.tweak.cutoff > 0 ? 'highpass' : 'lowpass', playing: this.player.playing || !!this.held };
  }

  get cutoff() {
    return lphpCutoff(this.tweak.cutoff);
  }

  #build() {
    const ctx = audio.ctx;
    const an = () => {
      const a = ctx.createAnalyser();
      a.fftSize = 2048;
      a.smoothingTimeConstant = 0.7;
      return a;
    };
    const wet = ctx.createGain();
    const dry = ctx.createGain();
    const mute = ctx.createGain();
    mute.gain.value = 0;
    const out = ctx.createGain();
    out.gain.value = 0.9;
    const before = an();
    const after = an();
    dry.connect(before).connect(mute).connect(out);
    wet.connect(after).connect(out).connect(audio.master);
    audio.buses[`${this.id}:wet`] = wet;
    audio.buses[`${this.id}:dry`] = dry;
    this.nodes = { before, after, out, wet, dry };
  }

  #schedule(step, t) {
    const stepSec = 60 / this.riff.bpm / 4;
    for (const [s, note, len] of this.riff.notes) {
      if (s !== step) continue;
      const dur = len * stepSec * 0.94;
      audio.note(note + this.transpose, t, dur, { voice: this.voice, vel: 0.8, bus: `${this.id}:wet`, tweak: this.tweak });
      audio.note(note + this.transpose, t, dur, { voice: this.voice, vel: 0.8, bus: `${this.id}:dry` });
    }
  }

  /** 改参数：{ cutoff, reso, attack, decay, fm: {…}, lfo }，给哪样改哪样。下一个音起就是新的 */
  set(patch = {}) {
    const { fm, ...rest } = patch;
    this.tweak = { ...this.tweak, ...rest, fm: { ...this.tweak.fm, ...(fm || {}) } };
    this.emit('change', this.tweak);
    return this;
  }

  async #ready() {
    if (!(await audio.init())) return false;
    if (!this.nodes) this.#build();
    return true;
  }

  async start() {
    if (this.player.playing) return true;
    if (!(await this.#ready())) return false;
    await this.player.start();
    this.emit('play', true);
    return true;
  }

  stop() {
    if (!this.player.playing) return;
    this.player.stop();
    this.emit('play', false);
  }

  toggle() {
    if (this.player.playing) this.stop();
    else this.start();
  }

  /** 按住一个音（包络那一台的“按住听”）。返回松手的函数 */
  async press(note = 60) {
    if (!(await this.#ready())) return () => {};
    this.release();
    const opts = { voice: this.voice, vel: 0.85 };
    const offs = [audio.note(note, 0, null, { ...opts, bus: `${this.id}:wet`, tweak: this.tweak }), audio.note(note, 0, null, { ...opts, bus: `${this.id}:dry` })];
    this.held = { at: audio.now(), off: () => offs.forEach((f) => f()) };
    this.emit('press', true);
    return () => this.release();
  }

  release() {
    if (!this.held) return;
    this.held.off();
    this.lastRelease = audio.now();
    this.held = null;
    this.emit('press', false);
  }

  destroy() {
    this.stop();
    this.release();
    const n = this.nodes;
    if (!n) return;
    delete audio.buses[`${this.id}:wet`];
    delete audio.buses[`${this.id}:dry`];
    n.out.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.08);
    setTimeout(() => n.out.disconnect(), 700);
    this.nodes = null;
  }
}

// ───────────── 几样读数：用人话说旋钮在哪 ─────────────

const say = {
  cutoff: (v) => (v === 0 ? '原样' : v < -44 ? '只剩闷闷的低音' : v < -20 ? '闷' : v < 0 ? '暗了一点' : v < 20 ? '低音少了一点' : v < 44 ? '薄' : '只剩沙沙的高音'),
  reso: (v) => (v === 0 ? '原样' : v < 0 ? '更平' : v < 36 ? '有点“喵”' : '很尖'),
  attack: (v) => (v === 0 ? '原样' : v < -30 ? '一下就出来' : v < 0 ? '快一点' : v < 36 ? '慢慢起来' : '像雾一样浮上来'),
  decay: (v) => (v === 0 ? '原样' : v < -30 ? '一下就没了' : v < 0 ? '短一点' : v < 36 ? '拖一会儿' : '拖得很长'),
  amount: (v) => (v === 0 ? '原样' : v < -40 ? '几乎是纯的' : v < 0 ? '圆一点' : v < 36 ? '更亮' : '又亮又硬'),
  freq: (v) => {
    const n = Math.round(v / 9); // 和 audio.js 一样：9 格换一档倍数
    return n === 0 ? '原样' : `${n > 0 ? '高' : '低'} ${Math.abs(n)} 档`;
  },
  feedback: (v) => (v === 0 ? '原样' : v < 0 ? '更干净' : v < 30 ? '有点毛' : '很沙'),
  rate: (v) => `${lfoRate(v).toFixed(1)} 次 / 秒`,
  depth: (v) => (v < -54 ? '不摆' : v < -10 ? '轻轻摆' : v < 30 ? '明显' : '摆得很凶'),
};
const lfoRate = (v) => 0.4 * 2 ** ((v + 64) / 25); // −64 → 0.4 次 / 秒，+63 → 13 次 / 秒
const lfoDepth = (v) => clamp((v + 64) / 127, 0, 1);

// ───────────── 实验台的外壳 ─────────────

function seg(items, current, pick, label) {
  const box = h('div', { class: 'seg sl-seg', role: 'group', 'aria-label': label });
  const paint = (now) => box.replaceChildren(...items.map((it, i) => h('button', { type: 'button', class: i === now ? 'on' : '', onclick: () => { paint(i); pick(i); } }, it)));
  paint(current);
  return box;
}

/** 右边那一列：照着机器的 Sound Design 那一列，桔红底、黑旋钮、上面一行亮着的字 */
function knobColumn(knobs, caption) {
  return h('div', { class: 'sl-column' }, caption && h('div', { class: 'sl-col-cap' }, caption), knobs.map((k) => k.el));
}

/** 包络画面：起音、衰减（以及松手之后）的形状；按着的时候一个点沿着它走 */
function envelopeView(engine) {
  const canvas = h('canvas', { class: 'sl-env-view', 'aria-label': '声音的形状：横着是时间，竖着是音量' });
  const g = canvas.getContext('2d');
  let raf = 0;
  let colors = {};
  const pick = () => {
    colors = { line: theme.css('--accent'), ink: theme.css('--text'), grid: theme.css('--line'), dry: theme.css('--line-3'), muted: theme.css('--muted') };
  };
  pick();
  const offTheme = theme.on('change', pick);
  // 和 audio.js 里同样的换算（polysynth 一类的音色：a 0.012、d 0.45、s 0.42、r 0.35）
  const shape = (tw, base = { a: 0.012, d: 0.45, s: 0.42, r: 0.35 }) => ({
    a: clamp(base.a * 2 ** ((tw.attack || 0) / 9), 0.001, 6),
    d: clamp(base.d * 2 ** ((tw.decay || 0) / 11), 0.02, 8),
    r: clamp(base.r * 2 ** ((tw.decay || 0) / 11), 0.02, 8),
    s: base.s,
  });
  function draw() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(10, Math.round(r.width * dpr));
    const hh = Math.max(10, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== hh) {
      canvas.width = w;
      canvas.height = hh;
    }
    g.clearRect(0, 0, w, hh);
    const total = 4; // 画 4 秒：按住 2 秒、松手后 2 秒
    const hold = 2;
    const x = (sec) => (sec / total) * (w - 20 * dpr) + 10 * dpr;
    const top = 16 * dpr;
    const base = hh - 26 * dpr;
    const y = (lv) => base - lv * (base - top);
    const path = (e) => {
      const pts = [];
      for (let i = 0; i <= 200; i++) {
        const sec = (i / 200) * total;
        let lv;
        if (sec < e.a) lv = sec / e.a;
        else if (sec < hold) lv = e.s + (1 - e.s) * Math.exp(-(sec - e.a) / (e.d / 3));
        else {
          const at = sec < e.a ? sec / e.a : e.s + (1 - e.s) * Math.exp(-(hold - e.a) / (e.d / 3));
          lv = at * Math.exp(-(sec - hold) / (e.r / 3));
        }
        pts.push([x(sec), y(clamp(lv, 0, 1))]);
      }
      return pts;
    };
    // 松手的那一刻
    g.fillStyle = colors.grid;
    g.fillRect(x(hold) - dpr / 2, top, dpr, base - top);
    g.font = `${12 * dpr}px ${theme.css('--font') || 'sans-serif'}`;
    g.fillStyle = colors.muted;
    g.textBaseline = 'bottom';
    g.textAlign = 'left';
    g.fillText('按下', x(0), hh - 4 * dpr);
    g.textAlign = 'center';
    g.fillText('松手', x(hold), hh - 4 * dpr);
    const stroke = (pts, color, width) => {
      g.strokeStyle = color;
      g.lineWidth = width * dpr;
      g.beginPath();
      pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
      g.stroke();
    };
    stroke(path(shape({})), colors.dry, 2);
    const now = path(shape(engine.tweak));
    stroke(now, colors.line, 3.5);
    // 按着（或刚松手）的时候，一个点沿着形状走
    const t0 = engine.held?.at;
    const playing = t0 !== undefined && t0 !== null;
    if (playing || (engine.lastRelease && audio.now() - engine.lastRelease < 2.2)) {
      const sec = playing ? Math.min(hold, audio.now() - t0) : hold + (audio.now() - engine.lastRelease);
      const i = clamp(Math.round((sec / total) * 200), 0, 200);
      g.fillStyle = colors.ink;
      g.beginPath();
      g.arc(now[i][0], now[i][1], 6 * dpr, 0, Math.PI * 2);
      g.fill();
    }
  }
  const frame = () => {
    draw();
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  const backup = setInterval(draw, 200); // 页面被挡住时浏览器不给逐帧的回调
  return { el: canvas, destroy: () => (cancelAnimationFrame(raf), clearInterval(backup), offTheme()) };
}

/** LFO 画面：一只“手”替你来回拧一个旋钮；下面一条波浪是它拧的样子 */
function lfoView(engine, getTarget) {
  const canvas = h('canvas', { class: 'sl-lfo-view', 'aria-label': '一只自动来回拧旋钮的手' });
  const g = canvas.getContext('2d');
  let raf = 0;
  let colors = {};
  const pick = () => {
    colors = { line: theme.css('--accent'), ink: theme.css('--text'), grid: theme.css('--line'), knob: theme.css('--knob'), mark: theme.css('--knob-mark'), muted: theme.css('--muted') };
  };
  pick();
  const offTheme = theme.on('change', pick);
  const born = performance.now();
  function draw() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(10, Math.round(r.width * dpr));
    const hh = Math.max(10, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== hh) {
      canvas.width = w;
      canvas.height = hh;
    }
    g.clearRect(0, 0, w, hh);
    const lfo = engine.tweak.lfo || { rate: 1, depth: 0 };
    const moving = engine.player.playing;
    const sec = (performance.now() - born) / 1000;
    const phase = moving ? Math.sin(2 * Math.PI * lfo.rate * sec) : 0;
    // 左边：被拧的那个旋钮
    const R = Math.min(hh * 0.3, 60 * dpr);
    const cx = R + 18 * dpr;
    const cy = hh * 0.45;
    g.fillStyle = colors.knob;
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.fill();
    const ang = (-90 + phase * lfo.depth * 120) * (Math.PI / 180);
    g.strokeStyle = colors.mark;
    g.lineWidth = 5 * dpr;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(ang) * R * 0.85, cy + Math.sin(ang) * R * 0.85);
    g.stroke();
    g.font = `700 ${13 * dpr}px ${theme.css('--font') || 'sans-serif'}`;
    g.fillStyle = colors.ink;
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.fillText(getTarget(), cx, cy + R + 10 * dpr);
    // 右边：一条波浪，表示这只手在怎么拧（往右是时间）
    const x0 = cx + R + 30 * dpr;
    const ww = w - x0 - 12 * dpr;
    g.strokeStyle = colors.grid;
    g.lineWidth = dpr;
    g.beginPath();
    g.moveTo(x0, cy);
    g.lineTo(x0 + ww, cy);
    g.stroke();
    g.strokeStyle = colors.line;
    g.lineWidth = 3 * dpr;
    g.beginPath();
    const span = 3; // 画 3 秒
    for (let i = 0; i <= 160; i++) {
      const s = sec - span + (i / 160) * span;
      const yv = cy - Math.sin(2 * Math.PI * lfo.rate * s) * lfo.depth * R;
      const px = x0 + (i / 160) * ww;
      if (i) g.lineTo(px, yv);
      else g.moveTo(px, yv);
    }
    g.stroke();
    g.fillStyle = colors.muted;
    g.font = `${12 * dpr}px ${theme.css('--font') || 'sans-serif'}`;
    g.textAlign = 'right';
    g.fillText(moving ? '它一直在替你拧' : '点「播放」，手就动起来', x0 + ww, 6 * dpr);
  }
  const frame = () => {
    draw();
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  const backup = setInterval(draw, 120);
  return { el: canvas, destroy: () => (cancelAnimationFrame(raf), clearInterval(backup), offTheme()) };
}

// 几台实验台各自的“配方”：用哪种原料、哪段循环、哪几个旋钮
const RECIPES = {
  bass: { label: '贝斯', voice: 'bass', transpose: -12, tweak: { cutoff: -22, reso: 10, attack: -20, decay: -14 }, say: '闷一点、短一点、站在最底下。bad guy 里那条低音就是这一路：高的部分几乎全被削掉了。' },
  pad: { label: 'Pad', voice: 'wide', transpose: 0, tweak: { cutoff: -12, reso: 0, attack: 34, decay: 30 }, say: '慢慢浮上来、拖得很长，像一层雾铺在后面。很多歌开头那种“空气感”就是它。' },
  lead: { label: 'Lead', voice: 'supersaw', transpose: 12, tweak: { cutoff: 0, reso: 6, attack: -24, decay: 0 }, say: '亮、起得快、站在最前面。Animals、Faded 里那条一听就记住的主旋律，都是这一路。' },
};

/**
 * spec:
 *   lab: 'filter'    一条循环 + FILTER / RESONANCE 两个旋钮 + 频谱。waves: true 时可以换原料（锯齿 / 方波 / 正弦）；sweep: true 时有“自动扫一遍”
 *        'envelope'  ATTACK / DECAY 两个旋钮 + 声音的形状 + 一个“按住听”的大键；循环用短和弦（stabs）或长和弦（chords）
 *        'lfo'       一只自动来回拧旋钮的手：拧的是音量 / 左右 / 滤波器 / 音高，SPEED 和 DEPTH 两个旋钮
 *        'fm'        DX 的那一路：AMOUNT / FREQUENCY / FEEDBACK 三个旋钮 + 频谱，可以换电钢琴 / 铃铛 / 贝斯 / Lead
 *        'presets'   同一串音，三种配方（贝斯 / Pad / Lead），旋钮摆在各自的位置上，可以接着拧
 *   knobs: 只摆哪几个（filter 那台默认 ['cutoff', 'reso']）
 *   riff / voice: 换循环和原料
 */
export function createSynthLab(spec = {}) {
  const lab = spec.lab || 'filter';
  const cleanup = [];
  const defaults = {
    filter: { riff: 'bass', voice: spec.waves ? 'saw' : 'bass', transpose: 0 },
    envelope: { riff: 'stabs', voice: 'polysynth', transpose: 0 },
    lfo: { riff: 'chords', voice: 'wide', transpose: 0 },
    fm: { riff: 'melody', voice: 'fmep', transpose: -12 },
    presets: { riff: 'line', voice: RECIPES.bass.voice, transpose: RECIPES.bass.transpose },
  }[lab] || {};
  const engine = new SynthLabEngine({ riff: spec.riff || defaults.riff, voice: spec.voice || defaults.voice, transpose: spec.transpose ?? defaults.transpose });
  cleanup.push(() => engine.destroy());

  const play = h('button', { class: 'btn primary lg sl-play', type: 'button' }, '▶ 播放');
  play.addEventListener('click', () => engine.toggle());
  const el = h('div', { class: ['sl', `sl-${lab}`] });
  cleanup.push(engine.on('play', (p) => {
    play.textContent = p ? '■ 停' : '▶ 播放';
    el.classList.toggle('playing', p);
  }));
  const reset = h('button', { class: 'btn ghost sl-reset', type: 'button' }, '都回到原样');
  const note = h('div', { class: 'sl-note' });
  const controls = h('div', { class: 'sl-controls' }, play);
  let screen;
  let column;
  const knobs = {};
  const mk = (key, label, title, apply) => {
    knobs[key] = knob({ label, title, readout: say[key] || String, onInput: (v) => apply(v) });
    return knobs[key];
  };

  if (lab === 'filter' || lab === 'presets') {
    const scope = createScope(engine, { kind: 'spectrum' });
    cleanup.push(() => scope.destroy());
    screen = h('div', { class: 'sl-screen' }, scope.el, h('div', { class: 'fx-legend' }, h('span', { class: 'dry' }, '原样'), h('span', { class: 'now' }, '现在听到的')));
    const want = lab === 'presets' ? ['attack', 'decay', 'cutoff', 'reso'] : spec.knobs || ['cutoff', 'reso'];
    const LABEL = { attack: ['ATTACK', '起音'], decay: ['DECAY', '衰减'], cutoff: ['FILTER', '滤波器'], reso: ['RESONANCE', '共鸣'] };
    column = knobColumn(want.map((k) => mk(k, LABEL[k][0], LABEL[k][1], (v) => engine.set({ [k]: v }))), lab === 'presets' ? '第 2 页' : null);
    if (lab === 'filter' && spec.waves) {
      const WAVES = [['锯齿波', 'saw'], ['方波', 'square'], ['正弦波', 'sine']];
      controls.append(seg(WAVES.map((w) => w[0]), 0, (i) => {
        engine.voice = WAVES[i][1];
        note.textContent = ['锯齿波：泛音最多，又亮又刺。滤波器削起来变化最大。', '方波：泛音少一半（只有单数的那些），有点空、有点“木”。', '正弦波：只有一个本音，没有泛音。滤波器往闷里拧几乎没变化——没有东西可削。'][i];
      }, '换一种原料'));
      note.textContent = '锯齿波：泛音最多，又亮又刺。滤波器削起来变化最大。';
    }
    if (lab === 'filter' && spec.sweep) {
      const sweep = h('button', { class: 'btn sl-sweep', type: 'button' }, '自动扫一遍');
      let timer = 0;
      sweep.addEventListener('click', async () => {
        clearInterval(timer);
        await engine.start();
        const t0 = performance.now();
        const from = knobs.cutoff.value;
        timer = setInterval(() => {
          const p = (performance.now() - t0) / 4200;
          if (p >= 1) {
            clearInterval(timer);
            knobs.cutoff.set(from);
            engine.set({ cutoff: from });
            return;
          }
          const v = Math.round(-56 * Math.sin(Math.PI * p)); // 从原样慢慢捂到底，再慢慢放开
          knobs.cutoff.set(v);
          engine.set({ cutoff: v });
        }, 40);
      });
      cleanup.push(() => clearInterval(timer));
      controls.append(sweep);
    }
    if (lab === 'presets') {
      const names = Object.keys(RECIPES);
      const choose = (i) => {
        const r = RECIPES[names[i]];
        engine.voice = r.voice;
        engine.transpose = r.transpose;
        engine.set(r.tweak);
        for (const [k, v] of Object.entries(r.tweak)) knobs[k]?.set(v);
        note.textContent = r.say;
        el.dataset.recipe = names[i];
      };
      controls.append(seg(names.map((n) => RECIPES[n].label), 0, choose, '换一种配方'));
      choose(0);
    }
  } else if (lab === 'envelope') {
    const env = envelopeView(engine);
    cleanup.push(env.destroy);
    const hold = h('button', { class: 'btn sl-hold', type: 'button' }, '按住听');
    let down = false;
    hold.addEventListener('pointerdown', async (e) => {
      e.preventDefault();
      engine.stop();
      down = true;
      hold.classList.add('down');
      await engine.press(60);
      if (!down) engine.release(); // 声音还没准备好手就松了：别让它一直响着
    });
    const up = () => {
      down = false;
      hold.classList.remove('down');
      engine.release();
    };
    hold.addEventListener('pointerup', up);
    hold.addEventListener('pointercancel', up);
    hold.addEventListener('pointerleave', up);
    screen = h('div', { class: 'sl-screen' }, env.el, h('div', { class: 'fx-legend' }, h('span', { class: 'dry' }, '原样'), h('span', { class: 'now' }, '现在的形状')), hold);
    column = knobColumn([mk('attack', 'ATTACK', '起音', (v) => engine.set({ attack: v })), mk('decay', 'DECAY', '衰减', (v) => engine.set({ decay: v }))]);
    const SHAPES = [['拨一下', { attack: -40, decay: -26 }, '起音最快、一下就落下去：一个个“拨”出来的声音（Pluck）。'], ['原样', { attack: 0, decay: 0 }, '这个音色本来的样子。'], ['铺底', { attack: 40, decay: 34 }, '慢慢浮上来、松手后拖很久：一层铺在后面的雾（Pad）。']];
    controls.append(seg(SHAPES.map((s) => s[0]), 1, (i) => {
      engine.set(SHAPES[i][1]);
      knobs.attack.set(SHAPES[i][1].attack);
      knobs.decay.set(SHAPES[i][1].decay);
      note.textContent = SHAPES[i][2];
    }, '换一种形状'));
    note.textContent = '按住下面那个键听一个音（看那个点沿着形状走），或者点「播放」听一段。';
  } else if (lab === 'lfo') {
    const TARGETS = [['音量', 'amp', 'VOLUME', '音量一大一小：颤音（Tremolo）。'], ['左右', 'pan', 'PAN', '声音在左右两边来回跑：自动声像（Auto Pan）。戴耳机听最明显。'], ['滤波器', 'filter', 'FILTER', '滤波器一开一合：“哇哇”的声音（Auto Wah）。'], ['音高', 'pitch', 'PITCH', '音高一高一低：揉弦（Vibrato）。摆得狠就成了警报声。']];
    let target = 0;
    const view = lfoView(engine, () => TARGETS[target][2]);
    cleanup.push(view.destroy);
    screen = h('div', { class: 'sl-screen' }, view.el);
    const apply = () => engine.set({ lfo: { to: TARGETS[target][1], rate: lfoRate(knobs.rate.value), depth: lfoDepth(knobs.depth.value) } });
    column = knobColumn([mk('rate', 'SPEED', '摆得多快', apply), mk('depth', 'DEPTH', '摆得多深', apply)]);
    knobs.rate.set(-10);
    knobs.depth.set(10);
    apply();
    controls.append(seg(TARGETS.map((t) => t[0]), 0, (i) => {
      target = i;
      apply();
      note.textContent = TARGETS[i][3];
    }, '这只手拧哪个'));
    note.textContent = TARGETS[0][3];
  } else if (lab === 'fm') {
    const scope = createScope(engine, { kind: 'spectrum' });
    cleanup.push(() => scope.destroy());
    screen = h('div', { class: 'sl-screen' }, scope.el, h('div', { class: 'fx-legend' }, h('span', { class: 'dry' }, '原样'), h('span', { class: 'now' }, '现在听到的')));
    const fmSet = (k) => (v) => engine.set({ fm: { [k]: v } });
    column = knobColumn([mk('amount', 'AMOUNT', '调制量', fmSet('amount')), mk('freq', 'FREQUENCY', '调制频率', fmSet('freq')), mk('feedback', 'FEEDBACK', '反馈', fmSet('feedback'))], '第 5 页');
    const KINDS = [['电钢琴', 'fmep', -12, '80 年代那种亮晶晶的电钢琴：一按下去最亮，然后慢慢变圆。'], ['铃铛', 'fmbell', 0, '调制器的音高不是整数倍：出来的泛音“不和谐”，像敲铃、敲金属。'], ['贝斯', 'fmbass', -24, '摇得很狠、再加一点反馈：又硬又冲的低音。'], ['Lead', 'fmlead', 0, '一直摇着不松：一条有点像管乐、有点像电子游戏的主旋律。']];
    controls.append(seg(KINDS.map((k) => k[0]), 0, (i) => {
      engine.voice = KINDS[i][1];
      engine.transpose = KINDS[i][2];
      note.textContent = KINDS[i][3];
    }, '换一个起点'));
    note.textContent = KINDS[0][3];
  }

  reset.addEventListener('click', () => {
    for (const [k, kn] of Object.entries(knobs)) {
      if (['rate', 'depth'].includes(k)) continue;
      kn.set(0);
    }
    engine.set({ cutoff: 0, reso: 0, attack: 0, decay: 0, fm: { amount: 0, freq: 0, feedback: 0 } });
  });
  if (lab !== 'lfo' && lab !== 'presets') controls.append(reset);
  el.append(h('div', { class: 'sl-main' }, screen, controls, note), column);
  if (spec.title) el.prepend(h('div', { class: 'sl-title' }, spec.title));
  const api = {
    el,
    engine,
    knobs,
    destroy: () => cleanup.splice(0).forEach((f) => f()),
  };
  el.__lab = api; // 走查脚本、调试用
  return api;
}

// ───────────── 滤波器只管一条轨道 / 管整台 ─────────────

/**
 * 一整段鼓 + 贝斯（fxlab 的那段循环）。一个旋钮，两种接法：
 *   只管贝斯：机器上右边 4 个旋钮第 2 页的 FILTER（每条轨道各有一个，管的是选中的那一条）
 *   管整台：  机器上 [MASTER/SINGLE] 拨到 MASTER、[FX] 旋钮转到 FILTER 这一类（小课堂 F1 用的是这一路；F2 在机器上拧的是第 2 页那个）
 */
export function createTrackFilter(spec = {}) {
  const engine = new FxEngine({ loop: 'full' });
  const scope = createScope(engine, { kind: 'spectrum' });
  let where = 0;
  let v = 0;
  const apply = () => {
    if (where === 0) {
      engine.set({ effect: 'none', on: false });
      engine.setTrackFilter('SYNTH1', v / 64);
    } else {
      engine.setTrackFilter('SYNTH1', 0);
      engine.set({ effect: v > 0 ? 'highpass' : 'lowpass', amount: Math.abs(v) / 64, on: Math.abs(v) > 1 });
    }
  };
  const k = knob({ label: 'FILTER', title: '滤波器', readout: say.cutoff, onInput: (x) => { v = x; apply(); } });
  const play = h('button', { class: 'btn primary lg sl-play', type: 'button' }, '▶ 播放');
  play.addEventListener('click', () => engine.toggle());
  const el = h('div', { class: 'sl sl-track' });
  const offPlay = engine.on('play', (p) => {
    play.textContent = p ? '■ 停' : '▶ 播放';
    el.classList.toggle('playing', p);
  });
  const note = h('div', { class: 'sl-note' });
  const SAY = ['只有贝斯变了：鼓一点没动。这就是第 2 页那个 FILTER——它跟着轨道走，管的是你选中的那一条。', '整台机器一起被捂住 / 削薄：鼓也变了。这是 [FX] 旋钮里的 FILTER，开关拨在 MASTER 时管全部轨道。'];
  note.textContent = SAY[0];
  const where2 = seg(['只管贝斯', '管整台'], 0, (i) => {
    where = i;
    apply();
    note.textContent = SAY[i];
    k.setLabel(i ? 'FX · FILTER' : 'FILTER');
  }, '滤波器接在哪');
  el.append(
    h('div', { class: 'sl-main' },
      h('div', { class: 'sl-screen' }, scope.el, h('div', { class: 'fx-legend' }, h('span', { class: 'dry' }, '原样'), h('span', { class: 'now' }, '现在听到的'))),
      h('div', { class: 'sl-controls' }, play, where2),
      note),
    knobColumn([k]));
  if (spec.title) el.prepend(h('div', { class: 'sl-title' }, spec.title));
  const api = { el, engine, knob: k, destroy: () => (offPlay(), scope.destroy(), engine.destroy()) };
  el.__lab = api;
  return api;
}

// ───────────── 16 个方键 = 16 类音色 ─────────────

// 合成器轨上“按住 SOUND 旋钮 + 按一个方键”跳到的那一类（docs/seqtrak-operation-reference.md 2.4）。
// 每一类配一段应用自己合成的声音，只是个大概：机器上每一类里有几十上百个音色
const CATS = [
  ['BASS', '贝斯', 'bass', [36, 36, 43, 36], -12], ['SYNTH LEAD', '合成器主旋律', 'supersaw', [72, 75, 79, 77], 0], ['PIANO', '钢琴', 'piano', [60, 63, 67, 72], 0], ['KEYBOARD', '电钢琴', 'fmep', [60, 63, 67, 70], 0],
  ['ORGAN', '风琴', 'reed', [60, 63, 67, 72], 0], ['PAD', '铺底', 'wide', [60, 63, 67, 70], 0], ['STRINGS', '弦乐', 'pad', [60, 63, 67, 72], 0], ['BRASS', '铜管', 'lead', [60, 63, 67, 60], 0],
  ['WOODWIND', '木管', 'reed', [72, 74, 75, 79], 0], ['GUITAR', '吉他', 'pluck', [48, 55, 60, 63], 0], ['WORLD', '民族乐器', 'pluck', [72, 74, 79, 77], 0], ['MALLET', '马林巴一类', 'fmbell', [72, 75, 79, 84], -12],
  ['BELL', '铃', 'fmbell', [72, 79, 84, 79], 0], ['RHYTHMIC', '带节奏的', 'pluck', [60, 67, 72, 67], 0], ['SFX', '音效', 'fmbell', [96, 91, 86, 81], 0], ['FAVORITE', '收藏', null, [], 0],
];

export function createCategoryKeys() {
  const note = h('div', { class: 'sl-note' }, '点一个方键，听听这一类大概是什么声音。');
  const keys = CATS.map(([en, zh, voice, notes, tr], i) => {
    const b = h('button', { class: 'sl-cat', type: 'button' }, h('span', { class: 'n' }, String(i + 1)), h('b', {}, en), h('span', { class: 'zh' }, zh));
    b.addEventListener('click', async () => {
      await audio.init();
      keysEl.querySelectorAll('.sl-cat.on').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      if (!voice) {
        note.innerHTML = '**第 16 个是 FAVORITE（收藏）**：你自己存过的音色都会自动放进这里。一个都没存过的时候，机器上这个键不亮。'.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        return;
      }
      const t = audio.now() + 0.05;
      const step = 60 / 110 / 2;
      notes.forEach((n, j) => audio.note(n + tr, t + j * step, voice === 'wide' || voice === 'pad' ? step * 3.6 : step * 0.9, { voice, vel: 0.8 }));
      note.textContent = `第 ${i + 1} 个：${en}（${zh}）。这是应用自己合成的大概样子，机器上这一类里有很多个，跳过去之后转 SOUND 旋钮一个一个听。`;
    });
    return b;
  });
  const keysEl = h('div', { class: 'sl-cats' }, h('div', { class: 'sl-cat-row' }, keys.slice(0, 8)), h('div', { class: 'sl-cat-row' }, keys.slice(8)));
  return { el: h('div', { class: 'widget sl-catbox' }, keysEl, note), destroy() {} };
}

export const SOUND_DESIGN_WIDGETS = {
  synthlab: (spec) => {
    const lab = createSynthLab(spec);
    return { el: h('div', { class: 'widget sl-box' }, lab.el), destroy: lab.destroy };
  },
  trackfilter: (spec) => {
    const lab = createTrackFilter(spec);
    return { el: h('div', { class: 'widget sl-box' }, lab.el), destroy: lab.destroy };
  },
  catkeys: () => createCategoryKeys(),
};
