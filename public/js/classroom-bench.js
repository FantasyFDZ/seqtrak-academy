// 小课堂每一关的最后一步“用在机器上”：一串小动作，旁边摆着一台机器，做到一项勾一项。
//   接着真机        → 真机的实时镜像（mirror.js）。你在机器上做，屏幕上的镜子跟着亮
//   没接真机        → 模拟机（simulator.js），放大到手指点得准；面板可以左右滑
//   没接真机的效果关 → 这里的“效果模拟机”（FxSim）：模拟机不会做效果，所以另做了一台只懂效果的，
//                     [FX] 旋钮、[FX LEVEL]、[CLEAR FX]、右边 4 个旋钮的翻页和滤波器都是真的会响的
// 认不认得出“这一步做到了”，各种条件见 watch()。认不出的（以及怕认错的）每一项都留着“我做了”的按钮。
import { h, rich, clamp, Emitter } from './util.js';
import { midi } from './midi.js';
import { seqtrak } from './seqtrak.js';
import { mirror } from './mirror.js';
import { simulator } from './simulator.js';
import { createPanel, GROUPS } from './device-panel.js';
import { controlInfo } from './controls.js';
import { TRACK } from './tracks.js';
import { FxEngine } from './fxlab.js';
import { sfx } from './sfx.js';
import { confetti } from './fx.js';

// ───────────── 效果模拟机 ─────────────

// [FX] 旋钮转一圈会经过的 8 类效果，每类 8 个预设（名字照官方手册，见 docs/seqtrak-operation-reference.md 3.12.3）
const FX_CATS = [
  ['FILTER', '滤波器', ['LPF - NO RESONANCE', 'LPF - LOW RESONANCE', 'LPF - MID RESONANCE', 'LPF - HIGH RESONANCE', 'HPF - NO RESONANCE', 'HPF - LOW RESONANCE', 'HPF - MID RESONANCE', 'HPF - HIGH RESONANCE']],
  ['REVERB', '混响', ['SMALL ROOM 1', 'SMALL ROOM 2', 'MID ROOM', 'SMALL HALL', 'MID HALL', 'STAGE', 'GATED REVERB', 'REVERSE REVERB']],
  ['DELAY', '延迟', ['TEMPO DELAY 4TH', 'PING PONG DELAY 4TH', 'TEMPO DELAY 8TH DOT', 'TEMPO DELAY 8TH', 'PING PONG DELAY 8TH', 'TEMPO DELAY 16TH', 'ANALOG DELAY - MODERN', 'ANALOG DELAY RETRO']],
  ['COMP', '压缩', null], ['DISTORTION', '失真', null], ['MODULATION', '调制', null], ['DUCKER', '躲闪', null], ['OTHER', '其它', null],
];
// 模拟机里每个预设大致听起来像什么（只做了小课堂讲到的三类）
const ROOM_OF = [0, 0, 1, 1, 1, 1, 2, 2];
const ECHO_OF = [0, 0, 2, 1, 1, 1, 1, 0];
const SLIDERS = ['FXLEVEL', 'HIGHPASS', 'REPEATER'];
const SIM_HELLO = '这是一台**只懂效果的模拟机**。先短按左下角的 [PLAY] 让它出声，再动右边桔红色那块。';

class FxSim extends Emitter {
  panel = null;
  el = null;
  lastSay = SIM_HELLO;
  #drag = null;
  #step = -1;
  #flashMeter = null;
  #timers = {};

  constructor() {
    super();
    this.#reset();
  }

  #reset() {
    Object.assign(this, { playing: false, sel: 'KICK', master: true, fx: 0, level: 0, sdPage: 0, filter: {} });
  }

  get cat() {
    return FX_CATS[Math.floor(this.fx / 8)];
  }

  mount() {
    this.unmount();
    this.#reset();
    this.engine = new FxEngine({ loop: 'full' });
    this.engine.player.onStep((s) => {
      this.#step = s;
      this.#render();
    });
    this.panel = createPanel({
      onUp: (id, ms, turned) => this.#up(id, ms, turned),
      onTurn: (id, dir) => this.#turn(id, dir),
    });
    // 触摸条要跟着手指走：面板本身只报“按下 / 松开”，这里自己听移动
    const svg = this.panel.svg;
    svg.addEventListener('pointerdown', (e) => {
      const node = e.target.closest?.('[data-id]');
      if (!node || !SLIDERS.includes(node.dataset.id)) return;
      this.#drag = { id: node.dataset.id, rect: (node.querySelector('rect') || node).getBoundingClientRect() };
      this.#slide(e);
    }, true);
    svg.addEventListener('pointermove', (e) => this.#drag && this.#slide(e));
    const end = () => {
      this.#drag = null;
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    this.sayText = h('span', { html: rich(this.lastSay) });
    this.el = h('div', { class: 'sim' }, this.panel.el, h('div', { class: 'sim-bar' }, h('div', { class: 'sim-say' }, h('span', { class: 'led' }), this.sayText)));
    this.#apply();
    this.#render();
    return this.el;
  }

  unmount() {
    Object.values(this.#timers).forEach(clearTimeout);
    this.#timers = {};
    this.engine?.destroy();
    this.engine = null;
    this.el?.remove();
    this.el = null;
    this.panel = null;
    this.playing = false;
    this.#step = -1;
  }

  highlight(ids) {
    this.panel?.setHighlight(ids);
  }

  #say(text) {
    this.lastSay = text;
    if (this.sayText) this.sayText.innerHTML = rich(text);
  }

  #event(type, data = {}) {
    this.emit('event', { type, ...data });
  }

  /** 把现在选的效果和触摸条的位置落到声音上 */
  #apply() {
    const [name] = this.cat;
    const preset = this.fx % 8;
    const on = this.level > 0.02;
    if (name === 'FILTER') this.engine.set({ effect: preset < 4 ? 'lowpass' : 'highpass', amount: this.level, on });
    else if (name === 'REVERB') this.engine.set({ effect: 'reverb', room: ROOM_OF[preset], amount: this.level, on });
    else if (name === 'DELAY') this.engine.set({ effect: 'delay', echo: ECHO_OF[preset], amount: this.level, on });
    else this.engine.set({ effect: 'none', on: false });
  }

  #meter(map, ms = 1800) {
    this.#flashMeter = map;
    clearTimeout(this.#timers.meter);
    this.#timers.meter = setTimeout(() => {
      this.#flashMeter = null;
      this.#index = null;
      this.#render();
    }, ms);
  }

  #index = null;

  #bar(n) {
    return Object.fromEntries(Array.from({ length: clamp(n, 0, 8) }, (_, i) => [`METER.${i + 1}`, 'white']));
  }

  #slide(e) {
    const { id, rect } = this.#drag;
    const v = clamp(1 - (e.clientY - rect.top) / rect.height, 0, 1);
    if (id !== 'FXLEVEL') {
      this.#say(id === 'HIGHPASS'
        ? '这条是 [HIGH PASS]：手指按上去，低音就被抽走；一松手马上复原。小课堂里以后有一关专门玩它，模拟机里先不出声。'
        : '这条是 [REPEATER]：手指按上去，声音被切碎了重复；一松手马上复原。小课堂里以后有一关专门玩它，模拟机里先不出声。');
      return;
    }
    this.level = v;
    this.#apply();
    const [name, zh, presets] = this.cat;
    this.#index = name;
    this.#meter(this.#bar(Math.round(v * 8)));
    this.#say(presets
      ? `[FX LEVEL] 推到了 **${Math.round(v * 100)}%**：现在加的是${zh}（${presets[this.fx % 8]}）。${this.playing ? '' : '还没出声：先短按左下角的 [PLAY]。'}`
      : `[FX LEVEL] 推到了 ${Math.round(v * 100)}%。现在选的是“${zh}”这一类，小课堂还没讲到，模拟机里听不出变化：转 [FX] 旋钮换到 FILTER、REVERB 或 DELAY。`);
    this.#event('fxlevel', { value: v });
    this.#render();
  }

  #up(id, ms, turned) {
    if (turned || SLIDERS.includes(id)) return;
    if (id === 'PLAY') {
      if (ms > 1500) return this.#say('按太久了：真机上按住 [PLAY] 2 秒是**关机**。播放和停止要**短按**。');
      if (this.playing) {
        this.engine.stop();
        this.playing = false;
        this.#step = -1;
        this.#say('停下了。');
        this.#event('stop');
      } else {
        this.engine.start();
        this.playing = true;
        this.#say('播放中：一段鼓和贝斯在循环。现在去动右边桔红色那块，听它怎么变。');
        this.#event('start');
      }
    } else if (TRACK[id]) {
      this.sel = id;
      this.#say(`选中了 **${TRACK[id].label}**（${TRACK[id].name}）。右边那 4 个竖着的旋钮，现在调的是它。`);
      this.#event('track', { track: id });
    } else if (id === 'MASTERSINGLE') {
      this.master = !this.master;
      this.#say(this.master
        ? '开关在 **MASTER**：[FX] 旋钮和 [FX LEVEL] 动的是**整台机器**的声音。'
        : '开关在 **SINGLE**：[FX] 旋钮和 [FX LEVEL] 只管**当前选中的那一条轨道**。小课堂这几关用 MASTER，再点一下拨回去。');
      this.#event('master', { master: this.master });
    } else if (id === 'CLEARFX') {
      this.level = 0;
      this.#apply();
      this.#meter({});
      this.#say('[CLEAR FX]：效果收到了最小，现在听到的是**原声**。');
      this.#event('clearfx');
    } else if (id === 'SDPAGE') {
      this.sdPage = this.sdPage ? 0 : 1;
      this.#meter({ [`METER.${8 - this.sdPage}`]: 'cyan' }, 2600);
      this.#say(this.sdPage
        ? '那 4 个旋钮翻到了**第 2 页**（小灯从上往下第 2 盏）：现在它们是 声音起得快慢、消失得快慢、**滤波器**、共鸣。'
        : '那 4 个旋钮翻回了**第 1 页**（最上面那盏小灯）：音色、音高或弹法、声像、音量。');
      this.#event('sdpage', { page: this.sdPage });
    } else {
      const info = controlInfo(id);
      this.#say(info ? `${info.en}（${info.zh}）：${info.what.split('。')[0]}。这台效果模拟机里它只做介绍。` : '这个控件在效果模拟机里没有功能。');
    }
    this.#render();
  }

  #turn(id, dir) {
    if (id === 'FX') {
      this.fx = clamp(this.fx + dir, 0, 63);
      const [name, zh, presets] = this.cat;
      const n = (this.fx % 8) + 1;
      this.#apply();
      this.#index = name;
      this.#meter({ [`METER.${n}`]: 'cyan' }, 2600);
      this.#say(presets
        ? `效果换成了 **${name}（${zh}）** 这一类的第 ${n} 种：${presets[n - 1]}。${this.level > 0.02 ? '' : '还听不出来：把下面的 [FX LEVEL] 往上推。'}`
        : `转到了 **${name}（${zh}）** 这一类的第 ${n} 种。这一类小课堂还没讲到，模拟机里听不出变化。`);
      this.#event('fxtype', { cat: name, preset: n });
    } else if (id === 'SD3') {
      if (!this.sdPage) {
        this.#index = 'PAN';
        this.#meter({});
        this.#say('现在在**第 1 页**，这个旋钮调的是声像（偏左还是偏右）。滤波器在第 2 页：先按一下正下方那个印着三个小点的键。');
      } else {
        const v = clamp((this.filter[this.sel] || 0) + dir * 0.125, -1, 1);
        this.filter[this.sel] = v;
        this.engine.setTrackFilter(this.sel, v);
        this.#index = 'FILTER';
        this.#meter(this.#bar(Math.round(((v + 1) / 2) * 8)));
        const heard = this.engine.loop.parts.some((p) => p.track === this.sel);
        this.#say(`${Math.abs(v) < 0.05 ? `**${TRACK[this.sel].label}** 的滤波器回到了中间：原样。`
          : v < 0 ? `**${TRACK[this.sel].label}** 被捂住了 ${Math.round(-v * 100)}%：亮的那部分没了（低通）。`
            : `**${TRACK[this.sel].label}** 的低音被抽走了 ${Math.round(v * 100)}%（高通）。`}${heard ? '' : '不过这段循环里没有它的声音：按一下 KICK、SNARE、HAT 1 或 SYNTH 1 的旋钮再试。'}`);
        this.#event('filter', { track: this.sel, value: v });
      }
    } else if (id === 'SD1' || id === 'SD2' || id === 'SD4') {
      const names = this.sdPage ? { SD1: ['ATTACK', '声音起来得快还是慢'], SD2: ['DECAY', '声音消失得快还是慢'], SD4: ['RESONANCE', '滤波器的共鸣'] }
        : { SD1: ['SOUND', '换音色'], SD2: ['PITCH', '音高（合成器轨上是单音 / 复音 / 和弦）'], SD4: ['VOLUME', '这条轨道的音量'] };
      this.#index = names[id][0];
      this.#meter({});
      this.#say(`这个旋钮现在管的是**${names[id][1]}**。效果模拟机里它只做介绍。`);
    } else if (TRACK[id] || id === 'ALL') {
      this.#say('轨道旋钮**转**是换一段乐句，这里用不上。要选中一条轨道，**按**它一下就行。');
    }
    this.#render();
  }

  #render() {
    if (!this.panel) return;
    const lit = { ...(this.#flashMeter || {}) };
    if (this.#index) lit[`INDEX.${this.#index}`] = 'white';
    lit[`${this.sel}.1`] = 'white';
    const part = this.engine?.loop.parts.find((p) => p.track === this.sel && p.pattern);
    if (part) [...part.pattern].forEach((c, i) => c !== '-' && (lit[`DK${i + 1}`] = 'yellow'));
    if (this.#step >= 0) lit[`DK${this.#step + 1}`] = 'white';
    this.panel.setLit(lit);
  }
}

export const fxsim = new FxSim();

// ───────────── 认出“这一步做到了” ─────────────

const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const tempoOf = (model) => (model === mirror ? mirror.v.get('tempo') : model === simulator ? simulator.proj.tempo : 0);

/** 这一项现在是不是已经满足了。只有“看状态”的条件才有答案，“看动作”的返回 null */
function stateOf(model, d) {
  switch (d.kind) {
    case 'scale': return model.proj?.scale === d.scale;
    case 'steps': {
      const cur = model.stepsOf?.(d.track);
      if (!cur) return false;
      return d.atLeast ? d.steps.every((s) => cur.includes(s)) : same(cur, d.steps);
    }
    case 'polymode': return model.polyOf?.(d.track) === d.mode;
    case 'tempo': {
      const t = tempoOf(model);
      return !!t && t >= d.min && t <= d.max;
    }
    case 'master': return model === fxsim ? fxsim.master : null;
    case 'sdpage': return model === fxsim ? fxsim.sdPage === d.page : model === mirror ? mirror.v.get('sdPage') === d.page : null;
    default: return null;
  }
}

function matches(d, e) {
  switch (d.kind) {
    case 'start':
    case 'stop': return e.type === d.kind;
    case 'track': return e.type === 'track' && (!d.track || e.track === d.track);
    case 'note': return e.type === 'note' && (!d.track || e.track === d.track);
    case 'octave': return e.type === 'octave';
    case 'swing': return e.type === 'swing' && (d.zero ? e.value === 0 : Math.abs(e.value) >= (d.min || 1));
    case 'chord': return e.type === 'chord' && (!d.track || e.track === d.track) && e.count >= (d.min || 2);
    case 'metronome': return e.type === 'metronome' && e.on === d.on;
    // 下面几样在真机上靠的是机器发不发控制器消息（官方 CC 表：102–104 主效果、107–109 单轨效果、74 滤波器）。
    // 这台机器的 USB 上发不发、设置里开没开，都还没有人对着真机确认过，所以认不出也不奇怪：旁边有“我做了”
    case 'fxlevel': return e.type === 'fxlevel' || (e.type === 'cc' && [102, 103, 104, 107, 108, 109].includes(e.cc));
    case 'filter': return e.type === 'filter' || (e.type === 'cc' && e.cc === 74);
    case 'clearfx': return e.type === 'clearfx';
    case 'fxtype': return e.type === 'fxtype' && e.cat === d.cat;
    default: return false;
  }
}

/** 真机上这一类条件有没有办法认。认不了的只显示“我做了” */
function canWatch(model, d) {
  if (!d) return false;
  if (model !== mirror) return !(model === simulator && ['master', 'sdpage', 'filter', 'fxlevel', 'clearfx', 'fxtype'].includes(d.kind));
  if (['scale', 'tempo', 'sdpage', 'fxlevel', 'filter', 'clearfx'].includes(d.kind)) return true;
  if (d.kind === 'track' && !d.track) return true;
  return ['start', 'stop', 'track', 'note', 'octave', 'swing', 'chord', 'polymode', 'steps'].includes(d.kind) && mirror.can(d);
}

/**
 * 盯着这一项，做到了就调 hit()。返回取消函数。
 * onCount(已经几次, 一共要几次)：要做好几次的那种（“挨个按 5 个键”）用来报进度。
 */
function watch(model, d, hit, onCount) {
  let n = 0;
  let over = false;
  const offs = [];
  const stop = () => {
    over = true;
    offs.splice(0).forEach((f) => f());
  };
  const count = () => {
    if (over) return;
    n++;
    onCount?.(n, d.count || 1);
    if (n >= (d.count || 1)) {
      stop();
      hit();
    }
  };
  const check = (e) => {
    const s = stateOf(model, d);
    if (s === true || (s === null && e && matches(d, e))) count();
  };
  offs.push(model.on('event', check));
  const timer = setInterval(() => check(null), 400);
  offs.push(() => clearInterval(timer));
  // 真机上动效果：实测触摸滑条会把主效果那几块参数（30 43–46）主动报上来，报了就算。刚轮到这一项的头半秒不算，
  // 免得上一项收尾时的上报把这一项也带过去
  if (model === mirror && ['fxlevel', 'clearfx'].includes(d.kind)) {
    const armedAt = performance.now() + 600;
    offs.push(seqtrak.on('param', ({ addr, reply }) => {
      if (!reply && addr[0] === 0x30 && addr[1] >= 0x43 && addr[1] <= 0x46 && performance.now() > armedAt) count();
    }));
  }
  return stop;
}

/** 做偏了的时候说一句有用的（没什么可说的就返回 null） */
function hintFor(model, d, e) {
  const name = (id) => TRACK[id]?.label || id;
  if (d.kind === 'steps') {
    if (e?.type === 'track' && e.track !== d.track) return `现在选中的是 ${name(e.track)}，方键会填到它上面。先按一下 **${name(d.track)} 旋钮**。`;
    if (e?.type === 'step' && e.track !== d.track) return `这一下填到了 ${name(e.track)} 上。先按一下 **${name(d.track)} 旋钮**，再填。`;
    const cur = model.stepsOf?.(d.track);
    if (!cur) return null;
    const missing = d.steps.filter((s) => !cur.includes(s)).map((s) => s + 1);
    const extra = d.atLeast ? [] : cur.filter((s) => !d.steps.includes(s)).map((s) => s + 1);
    if (!missing.length && !extra.length) return null;
    return `${[missing.length ? `还差第 ${missing.join('、')} 个` : '', extra.length ? `第 ${extra.join('、')} 个是多出来的，按一下把它按灭` : ''].filter(Boolean).join('；')}。`;
  }
  if (!e) return null;
  if (d.kind === 'track' && d.track && e.type === 'track' && e.track !== d.track) return `你选中的是 ${name(e.track)}，要找的是 **${name(d.track)}**（蓝圈那个）。`;
  if (d.kind === 'tempo' && e.type === 'tempo') return `现在 **${e.bpm} BPM**，目标是 ${d.min}–${d.max}：${e.bpm < d.min ? '接着按 [BPM+]' : e.bpm > d.max ? '按 [BPM-] 往回调' : '到了。'}`;
  if (d.kind === 'scale' && e.type === 'scalekey' && e.scale !== d.scale) return `现在是从上往下第 ${e.scale + 1} 盏，要的是**第 ${d.scale + 1} 盏**：接着按 [SCALE]。`;
  if (d.kind === 'polymode' && e.type === 'polymode' && e.track === d.track && e.mode !== d.mode) return '还没到 “CHORD”：接着慢慢转那个旋钮。';
  if (d.kind === 'polymode' && e.type === 'track' && e.track !== d.track) return `现在选中的是 ${name(e.track)}，那个旋钮调的是它。先按一下 **${name(d.track)} 旋钮**。`;
  if ((d.kind === 'chord' || d.kind === 'note') && e.type === 'note' && d.track && e.track !== d.track) return `这一声是 ${name(e.track)} 的。先按一下 **${name(d.track)} 旋钮**选中它。`;
  if (d.kind === 'filter' && e.type === 'sdpage' && e.page === 0) return '4 个旋钮回到了第 1 页，滤波器在第 2 页：再按一下那个三个小点的键。';
  if (d.kind === 'fxtype' && e.type === 'fxtype' && e.cat !== d.cat) return `现在亮的是 ${e.cat}，要的是 **${d.cat}**：接着往同一个方向转。`;
  return null;
}

// ───────────── 那一屏 ─────────────

/**
 * level：这一关（content/classroom.js）。onDone()：全部做完了。onStep(i, total)：轮到第几项。
 * actions：页面自己的按钮（上一步、完成这一关），摆在这一屏的右下角，省得另占一行。
 * 返回 { el, destroy }。
 */
export function createBench(level, { onDone, onStep, actions = null } = {}) {
  const spec = level.machine;
  const tasks = spec.tasks;
  let model = null;
  let current = 0;
  let unwatch = [];
  let finished = false;
  const stopWatching = () => unwatch.splice(0).forEach((f) => f());
  const pick = () => (mirror.available ? mirror : spec.fx ? fxsim : simulator);
  const live = () => model === mirror;

  const host = h('div', { class: 'cl-bench-panel' });
  const dots = h('div', { class: 'cl-bench-dots' });
  const text = h('div', { class: 'cl-bench-text' });
  const status = h('div', { class: 'cl-bench-status' });
  const buttons = h('div', { class: 'cl-bench-btns' });
  const warn = h('div', { class: 'cl-bench-warn', style: { display: 'none' } });
  const slide = h('div', { class: 'cl-bench-slide' }, '← 面板可以左右滑 →');
  const el = h('div', { class: 'cl-bench' }, warn, host,
    h('div', { class: 'cl-bench-task' },
      h('div', { class: 'cl-bench-head' }, dots, h('span', { class: 'spacer' }), buttons),
      text,
      h('div', { class: 'cl-bench-foot' }, status, h('span', { class: 'spacer' }), actions)));

  const wording = (t) => (live() ? t.liveText : t.simText) || t.text;

  /** 模拟机上把面板滑到要按的那几个键 */
  function focus(ids) {
    const wrap = host.querySelector('.panel-wrap');
    if (!wrap || wrap.scrollWidth <= wrap.clientWidth + 4) return;
    const nodes = (ids || []).flatMap((id) => GROUPS[id] || [id]).map((id) => wrap.querySelector(`[data-id="${CSS.escape(id)}"]`)).filter(Boolean);
    if (!nodes.length) return;
    const base = wrap.getBoundingClientRect().left - wrap.scrollLeft;
    const xs = nodes.map((n) => n.getBoundingClientRect()).map((r) => [r.left - base, r.right - base]);
    const lo = Math.min(...xs.map((x) => x[0]));
    const hi = Math.max(...xs.map((x) => x[1]));
    // 几个键离得太远、一屏放不下时，先对准第一个
    const target = hi - lo > wrap.clientWidth - 60 ? xs[0][0] - 60 : (lo + hi) / 2 - wrap.clientWidth / 2;
    wrap.scrollTo({ left: clamp(target, 0, wrap.scrollWidth), behavior: 'smooth' });
  }

  function mount() {
    stopWatching();
    model?.unmount();
    model = pick();
    if (model === simulator) simulator.gotoProject(3); // 4 号工程：空白的练习本
    host.replaceChildren(model === fxsim ? model.mount() : model.mount({ tips: false }), slide);
    el.classList.toggle('live', live());
    const wrap = host.querySelector('.panel-wrap');
    requestAnimationFrame(() => slide.classList.toggle('show', !!wrap && wrap.scrollWidth > wrap.clientWidth + 4));
    activate(current);
  }

  /** 真机停在出厂演示曲上，而这一关要往格子里填东西：先提醒翻到空白工程 */
  function checkProject() {
    const bad = live() && spec.edits && mirror.project >= 0 && mirror.project < 3;
    warn.style.display = bad ? '' : 'none';
    if (bad) warn.innerHTML = rich(`真机现在在 **${mirror.project + 1} 号工程**，那是出厂演示曲，往里填会把它改掉。先翻到练习本：**按住**右侧面最下面的 [PROJECT↑] **不放**，再按上排第 4 个方键。`);
  }

  function activate(i) {
    stopWatching();
    current = i;
    onStep?.(Math.min(i, tasks.length), tasks.length);
    dots.replaceChildren(...tasks.map((_, j) => h('i', { class: j < i ? 'done' : j === i ? 'now' : '' })));
    checkProject();
    if (i >= tasks.length) {
      model?.highlight([]);
      el.classList.add('done');
      text.innerHTML = rich(spec.done || '做到了。');
      status.replaceChildren(h('span', { class: 'cl-tick' }, '✓'), '这一关在机器上的部分做完了。');
      buttons.replaceChildren();
      if (!finished) {
        finished = true;
        onDone?.();
      }
      return;
    }
    el.classList.remove('done');
    const t = tasks[i];
    const done = () => {
      sfx.play('ok');
      confetti(dots.children[i], 10, { spread: 70 });
      activate(i + 1);
    };
    text.innerHTML = rich(wording(t));
    model.highlight(t.panel || []);
    focus(t.panel);
    const watching = canWatch(model, t.detect);
    const say = h('span', {});
    const idle = !watching ? '照着做，做完点右上角的按钮。' : live() ? `${t.wait || '等你操作…'}（在真机上做）` : t.wait || '在上面这台机器上做…';
    say.textContent = idle;
    status.replaceChildren(h('span', { class: 'pulse' }), say);
    const setHint = (html) => {
      if (html) say.innerHTML = rich(html);
    };
    if (watching) {
      unwatch.push(watch(model, t.detect, done, (n, need) => {
        if (need > 1 && n < need) say.textContent = `${t.wait || '继续'}（${n}/${need}）`;
      }));
      unwatch.push(model.on('event', (e) => {
        setHint(hintFor(model, t.detect, e));
        if (e.type === 'project') checkProject();
      }));
      // 进来时先看一眼：格子本来就不对的话，直接说差在哪
      const timer = setTimeout(() => setHint(hintFor(model, t.detect, null)), 900);
      unwatch.push(() => clearTimeout(timer));
    }
    const manual = h('button', { class: 'btn sm', type: 'button', onclick: done }, t.manual || '我做了');
    const assist = t.assist && live() ? h('button', {
      class: 'btn sm ghost', type: 'button',
      onclick: () => {
        if (t.assist.polymode) mirror.setPoly(...t.assist.polymode);
      },
    }, t.assist.label) : null;
    buttons.replaceChildren(...[assist, manual].filter(Boolean));
  }

  mount();
  const offState = midi.on('state', () => {
    if (pick() !== model) mount();
  });
  const projectTimer = setInterval(checkProject, 1200);

  return {
    el,
    /** 给走查脚本用：现在摆着的是哪台机器、轮到第几项 */
    get model() {
      return model;
    },
    get current() {
      return current;
    },
    destroy() {
      stopWatching();
      offState();
      clearInterval(projectTimer);
      model?.unmount();
    },
  };
}
