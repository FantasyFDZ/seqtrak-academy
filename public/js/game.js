// 节奏音游引擎：下落式音符 + 判定 + 偏差仪 + 步进条。
// 输入从哪来它不关心：键盘、屏幕点击、SEQTRAK 的 MIDI 都通过 hit(lane, 时间戳) 进来。
//
// 舞台怎么分工：轨道、音符、判定线、光和溅出来的碎片画在画布上；连击数、判定字、里程碑的横幅、
// 四种判定的计数是盖在画布上面的普通元素（样式在 app.css 的“音游”一段），这样字清楚，动效也好调。
// 丰富 / 克制两档动效：这里用 theme.rich 决定放不放碎片、震不震；元素上的动效由样式里的 [data-fx] 管。
import { Emitter, h, clear, clamp, mean, stddev, pct } from './util.js';
import { audio } from './audio.js';
import { midi } from './midi.js';
import { sound } from './sound.js';
import { TRACK } from './tracks.js';
import { summarize, leanText } from './feedback.js';
import { theme } from './theme.js';
import { sfx } from './sfx.js';
import { confetti, countUp } from './fx.js';
import { coachFace } from './coach-face.js';
import * as jiu from './jiu.js';

const WINDOWS = { perfect: 40, great: 80, ok: 130 }; // 毫秒，音符稀疏时的判定窗口
const SCORE = { perfect: 100, great: 70, ok: 40, miss: 0 };
// 颜色全部跟着配色走：判定的四种颜色、舞台上的“墨色”、轨道色都是 app.css 里的变量（两套配色各一组值）。
// 写进样式的地方直接用 var()；画布不认 var()，画之前用 theme.resolve() / theme.css() 换成当下的值。
const GRADE_COLOR = { perfect: 'var(--g-perfect)', great: 'var(--g-great)', ok: 'var(--g-ok)', miss: 'var(--g-miss)' };
const INK = (a) => `rgba(${theme.css('--stage-ink')},${a})`; // 舞台上的“墨色”：浅色舞台上是深的，深色舞台上是浅的
const ASSIST_LABEL = { demo: '示范', guide: '跟打', solo: '独奏' };
const FONT = '"SF Pro Text", "PingFang SC", "Segoe UI", "Microsoft YaHei", system-ui, sans-serif';

function alpha(raw, a) {
  const color = theme.resolve(raw);
  if (color.startsWith('#')) {
    const n = parseInt(color.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  if (color.startsWith('hsl(')) return color.replace(')', ` / ${a})`);
  return color;
}

/** 以应用自己的音频时钟为准的节拍时钟。第 0 拍 = 正式开始的那一下。 */
class InternalClock {
  constructor(bpm) {
    this.bpm = bpm;
    this.spb = 60 / bpm;
    this.t0 = 0;
  }
  start(secondsUntilBeat0) {
    this.t0 = audio.now() + secondsUntilBeat0;
  }
  beatAtCtx(t) {
    return (t - this.t0) / this.spb;
  }
  ctxAtBeat(b) {
    return this.t0 + b * this.spb;
  }
  beatAtPerf(p) {
    return this.beatAtCtx(audio.perfToCtx(p));
  }
  nowBeat() {
    return this.beatAtCtx(audio.heardNow());
  }
}

/** SEQTRAK 发来的音符该算到哪条 lane 上。 */
export function defaultMidiMapper(chart) {
  return (msg) => {
    if (chart.lanes.length === 1) return 0; // 只有一条轨道：机器上按出任何一个音都算
    const byChannel = chart.lanes.findIndex((l) => l.kind === 'drum' && TRACK[l.track]?.ch === msg.ch);
    if (byChannel >= 0) return byChannel;
    return chart.lanes.findIndex((l) => l.kind === 'pitch' && l.midi % 12 === msg.note % 12);
  };
}

/**
 * 和弦谱面的真机输入：机器在 CHORD 状态下按一个键，会在同一条通道上一口气发出好几个音。
 * 这里把紧挨着的一串音算成“按了一次”，用其中最低的那个音（和弦的根音）认出按的是哪个键，
 * 时间按这一串里最早到的那个音算。返回一个函数：把收到的音交给它，它认领了就返回 true。
 * 机器还在 POLY / MONO（一个键只出一个音）时也认得出来，只是听起来不是和弦。
 */
export function chordCollector(chart, onHit) {
  const lanes = chart.lanes.map((l, i) => ({ l, i })).filter((x) => x.l.kind === 'chord');
  // 三条合成器轨（通道 8–10）上按的都认：谱面写的是 SYNTH 2，你要是在 DX 上弹，也照样算
  const channels = new Set([TRACK.SYNTH1.ch, TRACK.SYNTH2.ch, TRACK.DX.ch]);
  const pending = new Map(); // 通道 → 正在收的这一串
  const lastAt = new Map(); // 通道 → 上一次按键的时刻
  const pick = (notes) => {
    if (lanes.length === 1) return lanes[0].i;
    const low = Math.min(...notes) % 12;
    const byRoot = lanes.find((x) => x.l.notes[0] % 12 === low);
    if (byRoot) return byRoot.i;
    // 根音对不上（机器里的和弦被改过，或者同时按了好几个键）：挑音重合得最多的那个
    let best = -1;
    let most = 0;
    for (const x of lanes) {
      const pcs = new Set(x.l.notes.map((n) => n % 12));
      const n = notes.filter((m) => pcs.has(m % 12)).length;
      if (n > most) {
        best = x.i;
        most = n;
      }
    }
    return best;
  };
  return (msg) => {
    if (!channels.has(msg.ch)) return false;
    const open = pending.get(msg.ch);
    if (open) {
      open.notes.push(msg.note);
      return true;
    }
    if (msg.time - (lastAt.get(msg.ch) ?? -1e9) < 45) return true; // 同一次按键里晚到的音
    const entry = { time: msg.time, notes: [msg.note] };
    pending.set(msg.ch, entry);
    setTimeout(() => {
      pending.delete(msg.ch);
      lastAt.set(msg.ch, entry.time);
      const i = pick(entry.notes);
      if (i >= 0) onHit(i, entry.time);
    }, 14);
    return true;
  };
}

const GRADE_NAME = { perfect: 'PERFECT', great: 'GREAT', ok: 'OK', miss: 'MISS' };
// 连击到这几个数是“里程碑”：舞台变色、震一下、连击数放大（克制档下只换颜色、出一行小字）
const MILESTONES = { 8: '稳住了', 16: '火热', 32: '停不下来' };
const heatOf = (combo) => (combo >= 32 ? 3 : combo >= 16 ? 2 : combo >= 8 ? 1 : 0);
// 触屏设备上，轨道下面那行小字写“点这里”，不写键盘上的哪个键。
// 判断的办法和样式里的 .key-only / .touch-only 是同一个，免得开始卡片说“点键帽”、键帽底下却写着“按 J”
const TOUCH = !!window.matchMedia?.('(hover: none)').matches;

/** 让一个一次性的动画重新播一遍 */
function retrigger(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

export class RhythmGame extends Emitter {
  #onKey = null;
  #offMidi = null;
  #ro = null;
  #timer = null;
  #raf = 0;
  #pal = null; // 这一刻的颜色（换配色时作废重取）
  #offTheme = null;
  #quiet = null; // 打着的时候按住界面音效的那只手
  #later = []; // 结算仪式里排着的定时器：重开、销毁时要清掉

  /**
   * opts:
   *   assist  'demo' 看示范 | 'guide' 有示范音跟打 | 'solo' 只有节拍器
   *   speed   速度倍率（0.7 = 七成速）
   *   metronome, hitSound, inputOffsetMs, countInBeats, passAccuracy
   */
  constructor(chart, opts = {}) {
    super();
    this.chart = chart;
    this.opts = { assist: 'guide', speed: 1, metronome: true, hitSound: true, inputOffsetMs: 0, countInBeats: 4, passAccuracy: 0.6, ...opts };
    this.state = 'idle';
    this.usedMidi = false;
    this.#configure();
    this.#build();
    this.#resetRun();
  }

  #configure() {
    const { chart } = this;
    this.bpm = Math.max(40, Math.round(chart.bpm * this.opts.speed));
    this.spb = 60 / this.bpm;
    this.spbMs = this.spb * 1000;
    // 音符越密，判定窗口越要收紧，否则分不清你打的是哪一个
    const gapMs = chart.minGapBeats * this.spbMs;
    const scale = clamp((gapMs * 0.45) / WINDOWS.ok, 0.5, 1);
    this.win = { perfect: Math.max(25, WINDOWS.perfect * scale), great: WINDOWS.great * scale, ok: WINDOWS.ok * scale };
    this.lookahead = clamp(Math.round(1.9 / this.spb), 2, 6); // 音符从出现到落地大约 2 秒
  }

  setOptions(patch) {
    Object.assign(this.opts, patch);
    this.#configure();
    this.elSub.textContent = this.#subtitle();
  }

  #subtitle() {
    return `${this.bpm} BPM · ${ASSIST_LABEL[this.opts.assist]}${this.opts.speed !== 1 ? ` · ${Math.round(this.opts.speed * 100)}% 速度` : ''}`;
  }

  // ───────────── DOM ─────────────

  #build() {
    const { chart } = this;
    this.canvas = h('canvas', { class: 'game-canvas' });
    this.overlay = h('div', { class: 'game-overlay' });
    this.elAcc = h('b', {}, '—');
    this.elProgress = h('i');
    this.elSub = h('div', { class: 'game-sub' }, this.#subtitle());

    // 舞台上的字，都是盖在画布上面的普通元素：连击、四种判定各打了几个、里程碑的横幅、飞出来的判定字
    this.elComboNum = h('b', {}, '0');
    this.elCombo = h('div', { class: 'stage-combo' }, this.elComboNum, h('span', {}, '连击'));
    this.tally = {};
    this.elTally = h('div', { class: 'stage-tally' }, ['perfect', 'great', 'ok', 'miss'].map((g) => h('span', { class: `g-${g}` }, GRADE_NAME[g], (this.tally[g] = h('b', {}, '0')))));
    this.elBanner = h('div', { class: 'stage-banner' });
    this.elFly = h('div', { class: 'stage-fly' });
    this.elStage = h('div', { class: 'game-stage', dataset: { heat: '0' } },
      this.canvas,
      h('div', { class: 'stage-hud', 'aria-hidden': 'true' }, this.elCombo, this.elTally, this.elBanner, this.elFly),
      this.overlay);

    // 偏差仪：一条横轴，正中那条粗线是“分毫不差”，往左是早、往右是晚。
    // 轴上分三档区域，和三种判定一一对应、同一种颜色：中间 PERFECT，两边 GREAT，最外面 OK；下面一行写着是哪一档。
    // 每打中一下落一根小竖条。最近几下用两个数说（为什么是两个，见 feedback.js 开头）：
    // 右边第一行“平均偏差”不分早晚；上面的三角和右边第二行是早晚相抵之后整体偏哪边。
    this.elTicks = h('div', { class: 'meter-ticks' });
    this.elAvg = h('div', { class: 'meter-avg' });
    this.elMeterAbs = h('b', {}, '—');
    this.elMeterLean = h('small', {});
    this.elMeterText = h('span', { class: 'meter-text' }, this.elMeterAbs, this.elMeterLean);
    const perfectW = (this.win.perfect / this.win.ok) * 100;
    const greatW = (this.win.great / this.win.ok) * 100;
    const zone = (cls, w) => h('div', { class: `meter-zone ${cls}`, style: { width: `${w}%` } });
    const scaleCols = [(100 - greatW) / 2, (greatW - perfectW) / 2, perfectW, (greatW - perfectW) / 2, (100 - greatW) / 2].map((w) => `${w}fr`).join(' ');
    const meter = h('div', { class: 'game-meter' },
      h('span', { class: 'meter-label' }, '早'),
      h('div', { class: 'meter-body' },
        h('div', { class: 'meter-track' }, zone('great', greatW), zone('perfect', perfectW), this.elTicks),
        h('div', { class: 'meter-center' }),
        this.elAvg,
        h('div', { class: 'meter-scale', 'aria-hidden': 'true', style: { gridTemplateColumns: scaleCols } },
          ['ok', 'great', 'perfect', 'great', 'ok'].map((g) => h('span', { class: `g-${g}` }, GRADE_NAME[g])))),
      h('span', { class: 'meter-label' }, '晚'),
      this.elMeterText,
    );

    // 步进条：和机器上那排 Drum keys 是同一个东西
    this.stepCells = [];
    this.headCells = [];
    const cols = `repeat(${chart.stepsPerLoop}, 1fr)`;
    const head = h('div', { class: 'steps-grid steps-head', style: { gridTemplateColumns: cols } });
    for (let s = 0; s < chart.stepsPerLoop; s++) {
      const c = h('i', { class: ['step-head', s % 4 === 0 && 'beat'] }, s % 4 === 0 ? String((s / 4) % 4 + 1) : '');
      this.headCells.push(c);
      head.append(c);
    }
    const rows = chart.lanes.map((lane, li) => {
      const cells = [];
      const grid = h('div', { class: 'steps-grid', style: { gridTemplateColumns: cols } });
      for (let s = 0; s < chart.stepsPerLoop; s++) {
        const c = h('i', { class: ['gstep', s % 4 === 0 && 'beat'] });
        cells.push(c);
        grid.append(c);
      }
      for (const t of chart.loopTargets) {
        if (t.lane !== li) continue;
        cells[t.step].classList.add('on');
        cells[t.step].style.setProperty('--c', lane.color);
      }
      this.stepCells.push(cells);
      return h('div', { class: 'steps-row' }, h('span', { class: 'steps-label', style: { color: lane.color } }, lane.label), grid);
    });
    const steps = h('div', { class: 'game-steps' }, h('div', { class: 'steps-row' }, h('span', { class: 'steps-label' }, ''), head), rows);

    this.el = h('div', { class: 'game' },
      h('div', { class: 'game-hud' },
        h('div', {}, h('div', { class: 'game-title' }, chart.title), this.elSub),
        h('div', { class: 'game-stats' }, h('div', { class: 'stat' }, this.elAcc, h('span', {}, '准确率'))),
      ),
      h('div', { class: 'game-progress' }, this.elProgress),
      this.elStage,
      meter,
      steps,
    );

    // 没接机器时，轨道就是鼓垫：点哪条轨道就打哪条（手指、鼠标都行，可以几根手指一起）
    this.canvas.addEventListener('pointerdown', (e) => {
      const lay = this.layout;
      if (!lay) return;
      const rect = this.canvas.getBoundingClientRect();
      const i = Math.floor((e.clientX - rect.left - lay.x0) / lay.laneW);
      if (i >= 0 && i < chart.lanes.length) {
        e.preventDefault();
        this.hit(i, e.timeStamp, 'pointer');
      }
    });
  }

  mount(container) {
    container.append(this.el);
    this.#ro = new ResizeObserver(() => this.#resize());
    this.#ro.observe(this.canvas.parentElement);
    this.#resize();
    // 换了配色：舞台跟着换（没在打的时候顺手重画一帧）
    this.#offTheme = theme.on('change', () => {
      this.#pal = null;
      if (this.state !== 'countin' && this.state !== 'playing') this.#draw(this.frozenBeat ?? -1);
    });
    return this;
  }

  #palette() {
    this.#pal ||= {
      lanes: this.chart.lanes.map((l) => theme.resolve(l.color)),
      laneA: theme.css('--stage-lane-a'),
      laneB: theme.css('--stage-lane-b'),
      key: theme.css('--stage-key'),
      keyInk: theme.css('--on-bright'),
      accent: theme.css('--accent'),
      yellow: theme.css('--yellow'),
      cyan: theme.css('--lamp-cyan'),
      bad: theme.css('--g-miss'),
      grade: Object.fromEntries(Object.entries(GRADE_COLOR).map(([k, v]) => [k, theme.resolve(v)])),
      glow: Number(theme.css('--stage-glow')) || 8,
    };
    return this.#pal;
  }

  #resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = rect.width;
    this.H = rect.height || 400;
    this.canvas.width = Math.round(this.W * dpr);
    this.canvas.height = Math.round(this.H * dpr);
    this.g = this.canvas.getContext('2d');
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 轨道排在中间，尽量宽（手指要点得中）；舞台够宽时两边留出地方：左边放连击，右边放四种判定的计数
    const n = this.chart.lanes.length;
    const wide = this.W >= 520;
    const side = wide ? Math.max(96, this.W * 0.17) : 16;
    const laneW = Math.min(n === 1 ? 260 : n === 2 ? 190 : n <= 4 ? 150 : 112, (this.W - side * 2) / n);
    const x0 = (this.W - laneW * n) / 2;
    this.layout = { laneW, totalW: laneW * n, x0, hitY: this.H - 92, padH: 44 };
    this.elStage.classList.toggle('compact', !wide);
    this.elStage.style.setProperty('--side', `${Math.round(x0)}px`);
    if (this.state !== 'countin' && this.state !== 'playing') this.#draw(this.frozenBeat ?? -1);
  }

  /** 在舞台中央放一张卡片（例如开始前的说明）。传 null 收起。 */
  showCard(node) {
    this.#clearLater(); // 结算卡片被换掉了：它排着的星星声、彩带就不放了
    this.#setOverlay(node);
  }

  #setOverlay(node) {
    clear(this.overlay);
    this.overlay.classList.toggle('show', !!node);
    if (node) this.overlay.append(node);
  }

  // ───────────── 一局的生命周期 ─────────────

  #resetRun() {
    this.targets = this.chart.targets.map((t) => ({ ...t, result: null }));
    this.byLane = this.chart.lanes.map((_, i) => this.targets.filter((t) => t.lane === i));
    this.lanePtr = this.chart.lanes.map(() => 0);
    this.laneFlash = this.chart.lanes.map(() => -1e9); // 上一次按下是很久以前：一开局键帽都是抬着的（写 0 的话，页面刚打开的头 0.1 秒里会被当成正按着）
    this.missPtr = 0;
    this.drawPtr = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.extras = 0;
    this.fx = [];
    this.recent = [];
    this.countIdx = -1;
    this.loopIdx = -1;
    this.headIdx = -1;
    this.usedMidi = false;
    this.frozenBeat = null;
    this.frozenNow = null; // 静帧时用的“现在”（见 preview）
    if (this.elTicks) {
      clear(this.elTicks);
      clear(this.elFly);
      this.elAvg.style.opacity = 0;
      this.elMeterAbs.textContent = '—';
      this.elMeterLean.textContent = '';
      this.elAcc.textContent = '—';
      this.elProgress.style.width = '0%';
      this.elBanner.classList.remove('go', 'hold');
      this.elStage.classList.remove('shake');
      this.#comboChanged();
      this.#updateHud();
      this.#clearStepMarks();
      this.headCells.forEach((c) => c.classList.remove('now'));
    }
  }

  #clearStepMarks() {
    for (const row of this.stepCells) for (const c of row) delete c.dataset.r;
  }

  #clearLater() {
    this.#later.splice(0).forEach(clearTimeout);
  }

  async start() {
    this.stop();
    this.#clearLater();
    const ok = await audio.init();
    if (!ok) {
      this.#setOverlay(h('div', { class: 'game-card' }, h('p', {}, '浏览器需要你先点一下页面才能出声。'), h('button', { class: 'btn primary', onclick: () => this.start() }, '开始')));
      return;
    }
    this.#resetRun();
    this.clock = new InternalClock(this.bpm);
    this.clock.start(0.25 + this.opts.countInBeats * this.spb);
    this.#buildEvents();
    this.state = 'countin';
    this.#quiet = sfx.hold(); // 打着的时候不放界面音效，免得干扰判定
    jiu.groove(this.bpm); // 啾啾在窝里跟着拍子点头，不出声
    this.elStage.classList.add('live'); // 打着的时候轨道是鼓垫：手指在上面不带着页面滚（样式里的 touch-action）
    this.#setOverlay(h('div', { class: 'countin' }, h('div', { class: 'countin-label' }, '预备'), this.elCount = h('div', { class: 'countin-num' }, ''), this.elDots = h('div', { class: 'countin-dots' }, Array.from({ length: this.opts.countInBeats }, () => h('i')))));
    this.#timer = setInterval(() => this.#schedule(), 25);
    this.#schedule();
    this.#raf = requestAnimationFrame(this.#frame);
    this.emit('start');
  }

  stop() {
    clearInterval(this.#timer);
    cancelAnimationFrame(this.#raf);
    this.#timer = null;
    this.#quiet?.();
    this.#quiet = null;
    jiu.groove(0);
    this.elStage.classList.remove('live');
    if (this.state === 'countin' || this.state === 'playing') this.state = 'idle';
  }

  destroy() {
    this.stop();
    this.#clearLater();
    this.detachInputs();
    this.#offTheme?.();
    this.#ro?.disconnect();
    this.el.remove();
  }

  #buildEvents() {
    const { chart } = this;
    const { countInBeats, metronome, assist } = this.opts;
    const ev = [];
    for (let b = -countInBeats; b < chart.totalBeats; b++) {
      if (b < 0 || metronome) ev.push({ beat: b, type: 'click', accent: ((b % 4) + 4) % 4 === 0 });
    }
    ev.push({ beat: chart.totalBeats, type: 'click', accent: true });
    for (const b of chart.backing) ev.push({ beat: b.beat, type: 'backing', b });
    if (assist !== 'solo') for (const t of this.targets) ev.push({ beat: t.beat, type: 'guide', t });
    ev.sort((a, b) => a.beat - b.beat);
    this.events = ev;
    this.evIdx = 0;
  }

  #schedule() {
    const horizon = this.clock.beatAtCtx(audio.now() + 0.14);
    while (this.evIdx < this.events.length && this.events[this.evIdx].beat < horizon) {
      const e = this.events[this.evIdx++];
      const t = this.clock.ctxAtBeat(e.beat);
      if (e.type === 'click') {
        sound.click(t, e.accent);
      } else if (e.type === 'backing') {
        if (e.b.kind === 'drum') sound.drum(e.b.sound, t, e.b.vel, 'backing');
        else sound.note(e.b.midi, t, e.b.lenBeats * this.spb * 0.92, e.b.voice, e.b.vel, 'backing');
      } else if (e.type === 'guide') {
        const role = this.opts.assist === 'demo' ? 'backing' : 'guide';
        if (e.t.kind === 'drum') sound.drum(e.t.sound, t, e.t.vel, role);
        else if (e.t.kind === 'chord') this.#chord(e.t.notes, t, e.t.lenBeats * this.spb * 0.92, e.t.voice, e.t.vel, role);
        else sound.note(e.t.midi, t, e.t.lenBeats * this.spb * 0.92, e.t.voice, e.t.vel, role);
      }
    }
  }

  /** 一个和弦 = 几个音同时响；每个音放轻一些，叠起来才不会比贝斯和鼓响出一大截 */
  #chord(notes, t, dur, voice, vel, role) {
    for (const n of notes) sound.note(n, t, dur, voice, vel * 0.55, role);
  }

  #frame = () => {
    if (this.state !== 'countin' && this.state !== 'playing') return;
    const { chart } = this;
    const nowBeat = this.clock.nowBeat();

    if (this.state === 'countin') {
      if (nowBeat >= 0) {
        this.state = 'playing';
        this.#setOverlay(null);
      } else {
        const idx = Math.floor(nowBeat + this.opts.countInBeats);
        if (idx !== this.countIdx && idx >= 0) {
          this.countIdx = idx;
          this.elCount.textContent = String(idx + 1);
          retrigger(this.elCount, 'tick');
          [...this.elDots.children].forEach((d, i) => d.classList.toggle('on', i <= idx));
        }
      }
    }

    // 漏音检测 / 示范模式自动命中
    const okBeats = this.win.ok / this.spbMs;
    for (let i = this.missPtr; i < this.targets.length && this.targets[i].beat <= nowBeat; i++) {
      const t = this.targets[i];
      if (t.result) continue;
      if (this.opts.assist === 'demo') this.#judge(t, 0, true);
      else if (nowBeat - t.beat > okBeats) this.#miss(t);
    }
    while (this.missPtr < this.targets.length && this.targets[this.missPtr].result) this.missPtr++;

    // 步进条播放头
    if (nowBeat >= 0 && nowBeat < chart.totalBeats) {
      const loop = Math.floor(nowBeat / chart.beatsPerLoop);
      if (loop !== this.loopIdx) {
        this.loopIdx = loop;
        this.#clearStepMarks();
      }
      const step = Math.floor((nowBeat - loop * chart.beatsPerLoop) * 4);
      if (step !== this.headIdx) {
        this.headCells[this.headIdx]?.classList.remove('now');
        this.headCells[step]?.classList.add('now');
        this.headIdx = step;
      }
    }

    this.elProgress.style.width = `${clamp(nowBeat / chart.totalBeats, 0, 1) * 100}%`;
    this.#draw(nowBeat);

    if (nowBeat >= chart.totalBeats + 0.8) return this.#finish();
    this.#raf = requestAnimationFrame(this.#frame);
  };

  // ───────────── 判定 ─────────────

  /** 一次击打。perfTime 是事件发生的时刻（performance.now() 时基）。 */
  hit(laneIndex, perfTime = performance.now(), source = 'keyboard') {
    const lane = this.chart.lanes[laneIndex];
    if (!lane) return;
    const live = this.state === 'countin' || this.state === 'playing';
    if (source === 'midi') this.usedMidi = true;
    this.laneFlash[laneIndex] = performance.now();

    // 你打出来的声音：机器自己会响，所以只有键盘/屏幕输入时才由应用发声
    if (this.opts.hitSound && source !== 'midi' && audio.ready && this.opts.assist !== 'demo') {
      if (lane.kind === 'drum') sound.drum(lane.track, 0, 1, 'hit');
      else if (lane.kind === 'chord') this.#chord(lane.notes, 0, 0.3, this.chart.def.chords?.voice || 'keys', 0.9, 'hit');
      else sound.note(lane.midi, 0, 0.22, this.chart.def.melody?.voice || 'bass', 0.9, 'hit');
    }
    if (!live) {
      if (this.state !== 'done') this.#draw(this.frozenBeat ?? -1);
      return;
    }
    if (this.opts.assist === 'demo') return;

    const beat = this.clock.beatAtPerf(perfTime - this.opts.inputOffsetMs);
    const list = this.byLane[laneIndex];
    let best = null;
    let bestDelta = 0;
    for (let i = this.lanePtr[laneIndex]; i < list.length; i++) {
      const t = list[i];
      const d = (beat - t.beat) * this.spbMs;
      if (d < -this.win.ok) break; // 之后的都还没到
      if (t.result) continue;
      if (!best || Math.abs(d) < Math.abs(bestDelta)) {
        best = t;
        bestDelta = d;
      }
    }
    if (best && Math.abs(bestDelta) <= this.win.ok) {
      this.#judge(best, bestDelta, false);
    } else if (beat > -0.3 && beat < this.chart.totalBeats + 0.3) {
      this.extras++;
      this.#fly(laneIndex, '多了', 'extra');
    }
    while (this.lanePtr[laneIndex] < list.length && list[this.lanePtr[laneIndex]].result) this.lanePtr[laneIndex]++;
  }

  #judge(t, deltaMs, auto) {
    const abs = Math.abs(deltaMs);
    const grade = abs <= this.win.perfect ? 'perfect' : abs <= this.win.great ? 'great' : 'ok';
    t.result = { grade, deltaMs, auto };
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const now = performance.now();
    if (auto) this.laneFlash[t.lane] = now;
    // 判定线上炸开一圈，丰富档再溅出几片；判定字从你打的那条轨道上飞出来
    this.fx.push({ type: 'burst', lane: t.lane, t0: now, grade });
    if (theme.rich) this.#sparks(t.lane, grade === 'perfect' ? 8 : grade === 'great' ? 5 : 3, grade, now);
    if (!auto) this.#fly(t.lane, grade === 'perfect' ? 'PERFECT' : `${deltaMs < 0 ? '早' : '晚'} ${Math.round(abs)}`, grade);
    this.#markStep(t, grade);
    if (!auto) this.#meterTick(deltaMs, grade);
    this.#comboChanged();
    this.#updateHud();
  }

  #miss(t) {
    t.result = { grade: 'miss' };
    const had = this.combo;
    this.combo = 0;
    this.fx.push({ type: 'miss', lane: t.lane, t0: performance.now() });
    this.#fly(t.lane, 'MISS', 'miss');
    this.#markStep(t, 'miss');
    this.#comboChanged(had);
    this.#updateHud();
  }

  #sparks(lane, n, grade, now) {
    for (let i = 0; i < n; i++) {
      this.fx.push({ type: 'spark', lane, t0: now, grade, vx: (Math.random() - 0.5) * 260, vy: -(140 + Math.random() * 220), size: 4 + Math.random() * 4, spin: Math.random() * 6 });
    }
  }

  /** 判定字从轨道上飞出来（克制档下只是原地淡掉，样式里管） */
  #fly(lane, text, grade, keep = false) {
    const lay = this.layout;
    if (!lay) return;
    const el = h('span', { class: ['fly', `g-${grade}`, keep && 'keep'], style: { left: `${lay.x0 + lane * lay.laneW + lay.laneW / 2}px`, top: `${lay.hitY - 34}px` } }, text);
    this.elFly.append(el);
    while (this.elFly.children.length > 10) this.elFly.firstChild.remove();
    if (!keep) setTimeout(() => el.remove(), 720);
  }

  /** 连击数变了：数字跳一下；到 8 / 16 / 32 舞台换一种颜色、震一下。dropped = 刚断掉的那一串有多长 */
  #comboChanged(dropped = 0) {
    const show = this.opts.assist !== 'demo';
    const heat = show ? heatOf(this.combo) : 0;
    this.elComboNum.textContent = String(this.combo);
    this.elCombo.classList.toggle('show', show && this.combo >= 2);
    this.elCombo.dataset.heat = String(heat);
    this.elStage.dataset.heat = String(heat);
    if (show && this.combo >= 2) retrigger(this.elCombo, 'bump');
    if (show && MILESTONES[this.combo]) {
      this.elBanner.replaceChildren(h('b', {}, `×${this.combo}`), MILESTONES[this.combo]);
      this.elBanner.dataset.heat = String(heat);
      retrigger(this.elBanner, 'go');
      if (theme.rich) {
        retrigger(this.elStage, 'shake');
        const now = performance.now();
        this.chart.lanes.forEach((_, i) => this.#sparks(i, 6, heat === 3 ? 'cyan' : heat === 2 ? 'yellow' : 'accent', now));
      }
    } else if (show && dropped >= 8) {
      this.elBanner.replaceChildren(`连击断在 ${dropped}`);
      this.elBanner.dataset.heat = 'lost';
      retrigger(this.elBanner, 'go');
    }
  }

  #markStep(t, grade) {
    const cell = this.stepCells[t.lane]?.[t.step];
    if (cell && t.loop === this.loopIdx) cell.dataset.r = grade;
  }

  #meterTick(deltaMs, grade) {
    const x = clamp(50 + (deltaMs / this.win.ok) * 50, 1, 99);
    const tick = h('i', { style: { left: `${x}%`, background: GRADE_COLOR[grade] } });
    this.elTicks.append(tick);
    while (this.elTicks.children.length > 28) this.elTicks.firstChild.remove();
    this.recent.push(deltaMs);
    if (this.recent.length > 8) this.recent.shift();
    const lean = mean(this.recent); // 带着早晚一起平均：早的晚的会互相抵掉，只说明整体偏哪边
    const off = mean(this.recent.map((d) => Math.abs(d))); // 不分早晚：平均每一下离正拍多远
    this.elAvg.style.opacity = 1;
    this.elAvg.style.left = `${clamp(50 + (lean / this.win.ok) * 50, 1, 99)}%`;
    this.elMeterAbs.textContent = `平均偏差 ${Math.round(off)}ms`; // 这个叫法是用户定的（“平均每下偏”里“下偏”会连着读）
    this.elMeterLean.textContent = leanText(lean);
  }

  #updateHud() {
    const counts = { perfect: 0, great: 0, ok: 0, miss: 0 };
    let judged = 0;
    let score = 0;
    for (const t of this.targets) {
      if (!t.result) continue;
      judged++;
      score += SCORE[t.result.grade];
      counts[t.result.grade]++;
    }
    this.elAcc.textContent = judged ? pct(score / (judged * 100)) : '—';
    for (const g of Object.keys(counts)) this.tally[g].textContent = String(counts[g]);
    this.elTally.classList.toggle('show', judged > 0 && this.opts.assist !== 'demo');
  }

  // ───────────── 画面 ─────────────

  #draw(nowBeat) {
    const g = this.g;
    if (!g) return;
    const { W, H } = this;
    const { laneW, totalW, x0, hitY, padH } = this.layout;
    const { lanes } = this.chart;
    const ppb = (hitY - 10) / this.lookahead;
    const yOf = (beat) => hitY - (beat - nowBeat) * ppb;
    const now = this.frozenNow ?? performance.now();
    const pal = this.#palette();
    const rich = theme.rich;

    g.clearRect(0, 0, W, H);

    // 舞台的光：判定线那里一团光，跟着节拍亮一下（下拍更亮）；连击到了里程碑换一种颜色
    const live = this.state === 'countin' || this.state === 'playing' || this.state === 'frozen';
    const phase = nowBeat - Math.floor(nowBeat);
    const downbeat = ((Math.floor(nowBeat) % 4) + 4) % 4 === 0;
    const pulse = live && rich ? (1 - phase) ** 2 * (downbeat ? 1 : 0.6) : 0;
    const heat = Number(this.elStage.dataset.heat) || 0;
    const glow = heat === 3 ? pal.cyan : heat === 2 ? pal.yellow : pal.accent;
    const light = g.createRadialGradient(W / 2, hitY, 0, W / 2, hitY, Math.max(W * 0.62, 260));
    light.addColorStop(0, alpha(glow, 0.08 + 0.2 * pulse + 0.05 * heat));
    light.addColorStop(1, alpha(glow, 0));
    g.fillStyle = light;
    g.fillRect(0, 0, W, H);

    // 轨道：越靠近判定线越带一点它自己的颜色；击打时一根光柱，漏了闪一下红
    lanes.forEach((lane, i) => {
      const x = x0 + i * laneW;
      g.fillStyle = i % 2 ? pal.laneB : pal.laneA;
      g.fillRect(x, 0, laneW, H);
      const tint = g.createLinearGradient(0, 0, 0, hitY);
      tint.addColorStop(0, alpha(pal.lanes[i], 0));
      tint.addColorStop(1, alpha(pal.lanes[i], 0.09));
      g.fillStyle = tint;
      g.fillRect(x, 0, laneW, hitY);
      const age = now - this.laneFlash[i];
      if (age < 240) {
        const beam = g.createLinearGradient(0, hitY - 220, 0, hitY);
        beam.addColorStop(0, alpha(pal.lanes[i], 0));
        beam.addColorStop(1, alpha(pal.lanes[i], 0.4 * (1 - age / 240)));
        g.fillStyle = beam;
        g.fillRect(x, hitY - 220, laneW, 220);
      }
    });
    for (const f of this.fx) {
      if (f.type !== 'miss' || now - f.t0 > 260) continue;
      g.fillStyle = alpha(pal.bad, 0.22 * (1 - (now - f.t0) / 260));
      g.fillRect(x0 + f.lane * laneW, 0, laneW, hitY);
    }
    // 轨道两边各一道边：跟着节拍亮
    g.strokeStyle = alpha(glow, 0.28 + 0.6 * pulse);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x0 - 1, 0);
    g.lineTo(x0 - 1, hitY + 4);
    g.moveTo(x0 + totalW + 1, 0);
    g.lineTo(x0 + totalW + 1, hitY + 4);
    g.stroke();

    // 节拍线：小节线最亮，拍线次之，半拍最淡
    g.font = `600 12px ${FONT}`;
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    for (let b = Math.ceil((nowBeat - 0.4) * 2) / 2; b <= nowBeat + this.lookahead + 0.01; b += 0.5) {
      const y = yOf(b);
      if (y < -2) break;
      const whole = Math.abs(b - Math.round(b)) < 1e-6;
      const inBar = ((Math.round(b) % 4) + 4) % 4;
      const isBar = whole && inBar === 0;
      g.strokeStyle = isBar ? INK(0.4) : whole ? INK(0.17) : INK(0.07);
      g.lineWidth = isBar ? 1.5 : 1;
      g.beginPath();
      g.moveTo(x0, y);
      g.lineTo(x0 + totalW, y);
      g.stroke();
      if (whole) {
        g.fillStyle = b < 0 || b >= this.chart.totalBeats ? INK(0.25) : isBar ? INK(0.9) : INK(0.5);
        g.fillText(String(inBar + 1), x0 - 10, y);
      }
    }

    // 音符
    while (this.drawPtr < this.targets.length && yOf(this.targets[this.drawPtr].beat + (this.targets[this.drawPtr].lenBeats || 0)) > H + 30) this.drawPtr++;
    for (let i = this.drawPtr; i < this.targets.length; i++) {
      const t = this.targets[i];
      if (t.beat - nowBeat > this.lookahead + 0.3) break;
      const missed = t.result?.grade === 'miss';
      if (t.result && !missed) continue;
      const color = pal.lanes[t.lane];
      const y = yOf(t.beat);
      const cx = x0 + t.lane * laneW + laneW / 2;
      const w = laneW * 0.74;
      const hh = 18;
      if (t.lenBeats > 0.26) {
        const tail = t.lenBeats * ppb - 6;
        g.fillStyle = alpha(color, missed ? 0.1 : 0.26);
        g.beginPath();
        g.roundRect(cx - w * 0.3, y - tail, w * 0.6, tail, 6);
        g.fill();
      }
      g.fillStyle = missed ? INK(0.16) : color;
      if (!missed) {
        g.shadowColor = alpha(color, 0.45);
        g.shadowBlur = pal.glow;
        g.shadowOffsetY = 2;
      }
      g.beginPath();
      g.roundRect(cx - w / 2, y - hh / 2, w, hh, 8);
      g.fill();
      g.shadowBlur = 0;
      g.shadowOffsetY = 0;
      if (!missed && t.vel >= 1) {
        g.strokeStyle = INK(0.9);
        g.lineWidth = 2;
        g.stroke();
      }
    }

    // 判定线：跟着节拍更亮一点
    g.strokeStyle = glow;
    g.lineWidth = 4;
    g.shadowColor = alpha(glow, 0.5 + 0.4 * pulse);
    g.shadowBlur = pal.glow + 10 * pulse;
    g.beginPath();
    g.moveTo(x0 - 10, hitY);
    g.lineTo(x0 + totalW + 10, hitY);
    g.stroke();
    g.shadowBlur = 0;

    // 每条轨道底部是一块键帽：按下去会往下走一截
    g.textAlign = 'center';
    lanes.forEach((lane, i) => {
      const x = x0 + i * laneW;
      const active = now - this.laneFlash[i] < 110;
      const top = hitY + 14;
      if (!active) {
        g.fillStyle = alpha(pal.lanes[i], 0.5); // 键帽的厚度
        g.beginPath();
        g.roundRect(x + 6, top + 4, laneW - 12, padH, 11);
        g.fill();
      }
      g.fillStyle = active ? pal.lanes[i] : pal.key;
      g.strokeStyle = pal.lanes[i];
      g.lineWidth = 2;
      g.beginPath();
      g.roundRect(x + 6, top + (active ? 4 : 0), laneW - 12, padH, 11);
      g.fill();
      g.stroke();
      g.fillStyle = active ? pal.keyInk : pal.lanes[i];
      g.font = `700 ${laneW < 76 ? 12 : 14}px ${FONT}`;
      g.fillText(lane.label, x + laneW / 2, top + padH / 2 + (active ? 4 : 0));
      // 键帽下面那一行：没接机器、又不是触屏的时候，写“按”加一颗小键帽（这条轨道用键盘上的哪个键打）；
      // 触屏上写“点这里”；接着机器时写这条轨道在机器上是哪个键
      const hintY = top + padH + 21;
      const cx = x + laneW / 2;
      if (this.opts.showKeyHints !== false && lane.key && !TOUCH) {
        g.font = `600 12px ${FONT}`;
        g.fillStyle = INK(0.72);
        g.textAlign = 'right';
        g.fillText('按', cx - 7, hintY);
        g.strokeStyle = INK(0.6);
        g.lineWidth = 1.3;
        g.fillStyle = INK(0.08);
        g.beginPath();
        g.roundRect(cx - 2, hintY - 11, 24, 21, 5);
        g.fill();
        g.stroke();
        g.fillStyle = INK(0.95);
        g.font = `800 13px ${FONT}`;
        g.textAlign = 'center';
        g.fillText(lane.key === ' ' ? '␣' : lane.key.toUpperCase(), cx + 10, hintY);
      } else {
        g.fillStyle = INK(0.62);
        g.font = `500 12px ${FONT}`;
        g.fillText(this.opts.showKeyHints !== false && lane.key ? '点这里' : lane.name, cx, hintY);
      }
    });

    // 命中特效：一圈炸开，几片溅出去
    this.fx = this.fx.filter((f) => now - f.t0 < (f.type === 'spark' ? 460 : 320));
    for (const f of this.fx) {
      const cx = x0 + f.lane * laneW + laneW / 2;
      const color = pal.grade[f.grade] || pal[f.grade] || pal.accent;
      if (f.type === 'burst') {
        const p = (now - f.t0) / 320;
        g.strokeStyle = alpha(color, 1 - p);
        g.lineWidth = 4 * (1 - p) + 1;
        g.beginPath();
        g.ellipse(cx, hitY, 16 + p * laneW * 0.42, 8 + p * 16, 0, 0, Math.PI * 2);
        g.stroke();
      } else if (f.type === 'spark') {
        const s = (now - f.t0) / 1000;
        const p = s / 0.46;
        g.save();
        g.translate(cx + f.vx * s, hitY + f.vy * s + 520 * s * s);
        g.rotate(f.spin * s * 4);
        g.globalAlpha = 1 - p * p;
        g.fillStyle = color;
        g.fillRect(-f.size / 2, -f.size / 2, f.size, f.size * 1.5);
        g.restore();
      }
    }
    g.globalAlpha = 1;
  }

  // ───────────── 结算 ─────────────

  #finish() {
    this.stop();
    this.state = 'done';
    this.headCells[this.headIdx]?.classList.remove('now');
    this.elStage.dataset.heat = '0';
    this.elCombo.classList.remove('show');
    this.elBanner.classList.remove('go'); // 最后一下正好到里程碑：横幅不留到结算卡片上
    if (this.opts.assist === 'demo') {
      this.result = { demo: true };
      this.#setOverlay(h('div', { class: 'game-card' },
        h('h3', {}, '示范结束'),
        h('p', {}, '听清楚节奏了吗？接下来换你，示范音会小声陪着你。'),
        h('div', { class: 'game-actions' },
          h('button', { class: 'btn', onclick: () => this.start() }, '再看一遍'),
          h('button', { class: 'btn primary', onclick: () => this.emit('continue', this.result) }, '换我来'),
        ),
      ));
    } else {
      this.result = this.#computeResult();
      this.#showResult(this.result);
    }
    this.emit('done', this.result);
  }

  #computeResult() {
    const { chart } = this;
    const counts = { perfect: 0, great: 0, ok: 0, miss: 0 };
    const byLane = {};
    const byPos = { down: { total: 0, hit: 0 }, up: { total: 0, hit: 0 }, sub: { total: 0, hit: 0 } };
    const missByStep = new Map();
    const deltas = [];
    let score = 0;
    for (const t of this.targets) {
      const grade = t.result?.grade || 'miss';
      const hitOk = grade !== 'miss';
      counts[grade]++;
      score += SCORE[grade];
      const laneId = chart.lanes[t.lane].label;
      const bl = (byLane[laneId] ||= { total: 0, hit: 0, deltas: [] });
      bl.total++;
      const pos = t.step % 4 === 0 ? 'down' : t.step % 4 === 2 ? 'up' : 'sub';
      byPos[pos].total++;
      if (hitOk) {
        bl.hit++;
        bl.deltas.push(t.result.deltaMs);
        byPos[pos].hit++;
        deltas.push(t.result.deltaMs);
      } else {
        missByStep.set(t.step, (missByStep.get(t.step) || 0) + 1);
      }
    }
    for (const v of Object.values(byLane)) {
      v.meanMs = mean(v.deltas);
      v.absMs = mean(v.deltas.map((d) => Math.abs(d)));
      delete v.deltas;
    }
    const total = this.targets.length;
    // 乱按一通也能“碰中”，所以多按的要折进分母里
    const accuracy = total ? score / ((total + this.extras * 0.5) * 100) : 0;
    const half = Math.floor(deltas.length / 2);
    const driftMs = deltas.length >= 6 ? mean(deltas.slice(half)) - mean(deltas.slice(0, half)) : 0;
    const pattern = [
      ...Object.entries(chart.def.lanes || {}).map(([k, v]) => `${k} ${v}`),
      chart.def.melody ? `旋律 ${chart.def.melody.notes.map(([s, n]) => `${n}@${s + 1}`).join(' ')}` : '',
      chart.def.chords ? `和弦（第几个 Synth key@第几步）${chart.def.chords.hits.map(([s, k]) => `键${k}@${s + 1}`).join(' ')}` : '',
    ].filter(Boolean).join('；');
    return {
      chartId: chart.id,
      title: chart.title,
      bpm: this.bpm,
      bars: chart.bars,
      loops: chart.loops,
      assist: this.opts.assist,
      speed: this.opts.speed,
      source: this.usedMidi ? 'midi' : 'keyboard',
      total,
      counts,
      extras: this.extras,
      accuracy,
      maxCombo: this.maxCombo,
      stars: accuracy >= 0.9 ? 3 : accuracy >= 0.75 ? 2 : accuracy >= this.opts.passAccuracy ? 1 : 0,
      passed: accuracy >= this.opts.passAccuracy,
      // 时间偏差的三个数（负 = 早）。准不准看 absMs；meanMs 早晚会互相抵掉，只用来说整体偏哪边（延迟校准扣的也是它）
      absMs: mean(deltas.map((d) => Math.abs(d))),
      meanMs: mean(deltas),
      stdMs: stddev(deltas),
      driftMs,
      byLane,
      byPos,
      missSteps: [...missByStep.entries()].map(([step, count]) => ({ step, count })).sort((a, b) => b.count - a.count),
      pattern,
    };
  }

  /**
   * 结算。丰富档是一段小仪式：星星一颗一颗砸下来、准确率滚上去、过了关撒彩带；克制档直接摆好。
   * 教练的脸在旁边说一句（这句是按数据挑的，不问 AI）。经验条由外面拿到数之后调 showReward() 填进来。
   */
  #showResult(r) {
    const s = summarize(r);
    const rich = theme.rich;
    this.#clearLater();
    /** 外层可以往这里加按钮（例如“让 AI 点评”） */
    this.resultExtra = h('div', { class: 'game-actions extra' });
    this.elReward = h('div', { class: 'result-xp' });
    const acc = h('div', { class: 'result-acc', dataset: { final: pct(r.accuracy) } }, pct(r.accuracy));
    const card = h('div', { class: ['game-card', 'result', s.tone, rich && 'ceremony'] },
      h('div', { class: 'stars big-stars' }, [0, 1, 2].map((i) => h('span', { class: i < r.stars ? 'on' : '', style: { '--i': String(i) } }, '★'))),
      acc,
      h('div', { class: 'result-counts' }, ['perfect', 'great', 'ok', 'miss'].map((g) => h('span', { class: `g-${g}` }, `${GRADE_NAME[g]} ${r.counts[g]}`))),
      h('div', { class: 'result-timing' }, r.total - r.counts.miss ? `平均偏差 ${Math.round(r.absMs)}ms · ${leanText(r.meanMs)} · 最高连击 ${r.maxCombo}` : ''),
      h('div', { class: 'result-say' },
        coachFace({ size: 44, follow: false, mood: r.stars === 3 ? 'happy' : r.passed ? 'idle' : 'cheer', act: r.stars === 3 ? 'flip' : r.passed ? 'nod' : 'hop' }).el,
        h('div', {}, h('h3', {}, s.headline), h('p', {}, s.detail))),
      this.elReward,
      h('div', { class: 'game-actions' },
        h('button', { class: ['btn', !r.passed && 'primary'], onclick: () => { this.emit('retry'); this.start(); } }, '再来一次'),
        r.passed && h('button', { class: 'btn primary', onclick: () => this.emit('continue', r) }, '继续'),
      ),
      this.resultExtra,
    );
    this.#setOverlay(card);
    this.elTally.classList.remove('show'); // 计数已经写在卡片上了
    if (rich) {
      // 星星一颗一响；准确率从 0 滚上去；过了关撒彩带（三星撒得多）
      for (let i = 0; i < r.stars; i++) this.#later.push(setTimeout(() => sfx.play('star'), 260 + i * 210));
      countUp(acc, Math.round(r.accuracy * 100), { from: 0, ms: 800, fmt: (v) => `${Math.round(v)}%` });
      if (r.passed) this.#later.push(setTimeout(() => card.isConnected && confetti(card, r.stars === 3 ? 44 : 20), 300 + r.stars * 210));
    } else if (r.passed) {
      sfx.play('ok');
    }
  }

  /**
   * 结算卡片上的“这一局给了多少经验”：gained = 涨了多少，from / to = 打之前和之后的等级（store.progress().level），
   * badges = 这一局拿到的徽章（levels.js 里的定义）。卡片已经不在了就什么也不做。
   */
  showReward({ gained = 0, from, to, badges = [] } = {}) {
    const box = this.elReward;
    if (!box || !this.overlay.contains(box) || !to) return; // 结算卡片已经被换掉了
    const up = from && to.lv > from.lv;
    const bar = h('i', { style: { width: `${Math.round((up || !from ? 0 : from.pct) * 100)}%` } });
    box.replaceChildren(
      h('b', {}, `+${gained} 经验`),
      h('span', { class: 'xp-bar' }, bar),
      h('span', { class: up ? 'xp-up' : '' }, up ? `升到 Lv ${to.lv} ${to.name}` : `Lv ${to.lv} ${to.name}`),
      ...badges.map((b) => h('span', { class: 'xp-badge' }, h('span', { class: 'badge got', dataset: { tone: b.tone } }, h('svg', { viewBox: '0 0 24 24', html: b.icon })), `拿到徽章「${b.name}」`)),
    );
    box.classList.add('show');
    // 经验条涨上去（页面在后台时逐帧的回调不跑，所以用定时器，不用下一帧）
    this.#later.push(setTimeout(() => {
      bar.style.width = `${Math.round(to.pct * 100)}%`;
      if (up) sfx.play('levelup');
      else if (badges.length) sfx.play('badge');
      if ((up || badges.length) && theme.rich) confetti(box, up ? 36 : 18);
    }, theme.rich ? 900 : 30));
  }

  /**
   * 开发用（截图、检查版式）：不真的打，直接摆出一个静止的画面。
   *   preview('stage', 第几拍)  打到一半的舞台：这一拍之前的音都算打过了（只漏第 3 个，所以拍数越大连击越长，
   *                             能看到 8 / 16 / 32 三档的样子），连击、飞字、横幅、特效都在
   *   preview('result', 几颗星)  结算卡片，成绩是按星数编的（0 = 没过）。不发 done 事件，不会被记成一局
   */
  preview(kind, n) {
    this.stop();
    this.#resetRun();
    const hitUntil = kind === 'stage' ? Number(n) || 6 : Infinity;
    const stars = kind === 'result' && Number.isFinite(Number(n)) ? clamp(Number(n), 0, 3) : 3;
    const past = this.targets.filter((t) => t.beat <= hitUntil);
    this.loopIdx = Math.max(0, Math.floor(Math.min(hitUntil, this.chart.totalBeats - 0.01) / this.chart.beatsPerLoop));
    // 结算：按星数定打中几成（没过 / 一星 / 两星 / 三星），漏掉的均匀地散在中间
    const quota = kind === 'result' ? Math.round(past.length * [0.45, 0.7, 0.88, 1][stars]) : 0;
    const hitAt = (i) => Math.floor(((i + 1) * quota) / past.length) > Math.floor((i * quota) / past.length);
    past.forEach((t, i) => {
      const miss = kind === 'stage' ? i === 2 && past.length > 4 : !hitAt(i);
      const deltaMs = [-9, 14, -22, 5, 31, -4, 48, -12][i % 8] * (stars === 3 || kind === 'stage' ? 1 : 0.5);
      if (miss) {
        t.result = { grade: 'miss' };
        this.combo = 0;
      } else {
        const abs = Math.abs(deltaMs);
        t.result = { grade: abs <= this.win.perfect ? 'perfect' : abs <= this.win.great ? 'great' : 'ok', deltaMs, auto: false };
        this.combo++;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        if (t.beat > hitUntil - 6) this.#meterTick(deltaMs, t.result.grade);
      }
      this.#markStep(t, t.result.grade);
    });
    this.#updateHud();
    if (kind === 'result') {
      this.state = 'done';
      this.result = this.#computeResult();
      this.#showResult(this.result);
      return this.result;
    }
    this.state = 'frozen';
    this.frozenBeat = hitUntil + 0.12;
    this.#setOverlay(null);
    this.elProgress.style.width = `${clamp(hitUntil / this.chart.totalBeats, 0, 1) * 100}%`;
    this.#comboChanged();
    const reached = [32, 16, 8].find((m) => this.combo >= m);
    this.elBanner.classList.toggle('hold', !!reached);
    if (reached) {
      this.elBanner.replaceChildren(h('b', {}, `×${reached}`), MILESTONES[reached]);
      this.elBanner.dataset.heat = String(heatOf(reached));
    }
    const last = past[past.length - 1];
    if (last?.result?.deltaMs !== undefined) {
      const now = performance.now() - 110;
      this.frozenNow = now + 110;
      this.laneFlash[last.lane] = now + 40;
      this.fx.push({ type: 'burst', lane: last.lane, t0: now, grade: last.result.grade });
      this.#sparks(last.lane, 8, last.result.grade, now);
      this.#fly(last.lane, last.result.grade === 'perfect' ? 'PERFECT' : `${last.result.deltaMs < 0 ? '早' : '晚'} ${Math.abs(Math.round(last.result.deltaMs))}`, last.result.grade, true);
    }
    this.#draw(this.frozenBeat);
    return null;
  }

  // ───────────── 输入 ─────────────

  attachKeyboard() {
    if (this.#onKey) return this;
    this.#onKey = (e) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      const k = e.key.toLowerCase();
      let i = this.chart.lanes.findIndex((l) => l.key === k);
      if (i < 0 && k === ' ' && this.chart.lanes.length === 1) i = 0;
      if (i < 0) return;
      e.preventDefault();
      this.hit(i, e.timeStamp, 'keyboard');
    };
    window.addEventListener('keydown', this.#onKey);
    return this;
  }

  attachMidi(mapper = defaultMidiMapper(this.chart)) {
    this.#offMidi?.();
    const chords = this.chart.lanes.some((l) => l.kind === 'chord') ? chordCollector(this.chart, (i, time) => this.hit(i, time, 'midi')) : null;
    this.#offMidi = midi.on('noteon', (msg) => {
      if (chords?.(msg)) return;
      const i = mapper(msg);
      if (i >= 0) this.hit(i, msg.time, 'midi');
    });
    return this;
  }

  detachInputs() {
    if (this.#onKey) window.removeEventListener('keydown', this.#onKey);
    this.#onKey = null;
    this.#offMidi?.();
    this.#offMidi = null;
  }
}
