// 课程播放器：把一节课的步骤（讲解 / 导览 / 动手 / 找按键 / 音游 / 小测 / 编程挑战 / 自由创作）依次呈现出来。
// 需要动手的地方，屏幕上都有一台机器：没接真机时是模拟机，在它上面练；接了真机就变成真机的实时镜像，
// 你在真机上做的每一步都会显示出来、被认出来，做偏了还会提示。
//
// 版式（样式在 app.css 的“课程播放器”）：页面不整页滚动，最上面一行和最下面的“下一步”固定。
// 要动手的步骤（动手 / 编程挑战 / 练习）一屏放下：左边是机器或舞台，右边是“现在做什么”；
// 讲解、小测这些往下读的步骤在中间自己滚。
// 反馈：做完一项有一声、一小撮彩带，教练小鸟啾啾高兴得蹦一下；过一节课是全屏的庆祝（celebrate.js，克制档只在页面上摆出来）；
// 动手的步骤里啾啾飞到要按的键上方指着，做偏了它摇摇头；卡住了、连着做错了，它冒出来问一声（coach-nudge.js）。
import { h, clear, rich, clamp } from './util.js';
import { findLesson } from './content/curriculum.js';
import { chartById } from './content/charts.js';
import { store } from './store.js';
import { ctx } from './context.js';
import { coach } from './coach.js';
import { midi } from './midi.js';
import { seqtrak, PatternMirror, stepsToPattern, ADDR, TRACK_ADDR, decodeSoundName } from './seqtrak.js';
import { TRACK, TRACKS } from './tracks.js';
import { createWidget } from './widgets.js';
import { createPanel, patternToLit } from './device-panel.js';
import { simulator } from './simulator.js';
import { mirror, PARAM_ADDR, paramWords } from './mirror.js';
import { levelById } from './content/classroom.js';
import { riffBlock } from './device-riff.js';
import { panelTour, panelQuiz } from './panel-widgets.js';
import { mountGame } from './gamepanel.js';
import { patternBoard } from './board.js';
import { LoopPlayer } from './looper.js';
import { toast } from './ui.js';
import { connectDevice } from './device-connect.js';
import { SCALES, KEY_NAMES, POLY_MODES, chordNotes } from './scales.js';
import { theme } from './theme.js';
import { sfx } from './sfx.js';
import { confetti } from './fx.js';
import { setCoachMood } from './coach-face.js';
import { nudge, hushNudge } from './coach-nudge.js';
import * as jiu from './jiu.js';
import { controlInfo } from './controls.js';
import { celebrateLesson, closeCelebration, xpLine, badgeChip } from './celebrate.js';
import { BENCH_VIEW, PROG_VIEW, fitView, benchView, refitOnResize } from './bench-view.js';

const KIND_LABEL = { read: '讲解', tour: '导览', do: '动手', findkeys: '找按键', game: '练习', quiz: '小测', program: '编程挑战', free: '自由创作', reflect: '写下来' };
const CALLOUT_TITLE = { dj: '用 DJ 的经验来理解', tip: '小贴士', warn: '注意', theory: '一点乐理' };

// ───────────── 通用内容块 ─────────────

function renderBlocks(blocks, cleanup) {
  return (blocks || []).map((b) => {
    if (typeof b === 'string') return h('p', { html: rich(b) });
    if (b.callout) return h('div', { class: ['callout', b.callout] }, h('b', { class: 'label' }, b.title || CALLOUT_TITLE[b.callout]), h('span', { html: rich(b.text) }));
    if (b.list) return h('ul', {}, b.list.map((i) => h('li', { html: rich(i) })));
    if (b.widget) {
      const w = createWidget(b);
      cleanup.push(() => w.destroy());
      return h('div', { class: 'step-widget' }, w.el);
    }
    if (b.panel) {
      const p = createPanel({ highlight: b.panel, lit: b.lit || {} });
      return h('div', { class: 'step-widget' }, p.el, b.caption && h('div', { class: 'panel-legend', html: rich(b.caption) }));
    }
    if (b.connect) return connectBlock(cleanup);
    if (b.device) return deviceStateBlock(b.device, cleanup);
    if (b.action) return actionBlock(b);
    if (b.classroom) return classroomLink(b);
    if (b.riff) return riffBlock(b, cleanup); // 第 4 章：让机器替你弹一段（device-riff.js），接着真机时才有
    return null;
  });
}

/** 指到小课堂的某一关（第 4 章起用）：一张小卡片，点了去那一关；那一关还没开放就只写一句 */
function classroomLink(b) {
  const level = levelById(b.classroom);
  if (!level) return null;
  const done = store.data.classroom?.[b.classroom]?.done;
  const open = !!level.play;
  const card = h(open ? 'a' : 'div', { class: ['callout', 'classroom-link'], href: open ? `#/classroom/${b.classroom}` : null },
    h('b', { class: 'label' }, `小课堂 · ${b.classroom} ${level.name || level.title || ''}${done ? ' · 学过了' : open ? '' : ' · 还没开放'}`),
    h('span', { html: rich(b.text || '') }),
    open && h('span', { class: 'classroom-go' }, done ? '再去玩一下 →' : '去玩一下 →'));
  return card;
}

/** “连接 SEQTRAK”按钮 + 连上后显示固件版本。 */
function connectBlock(cleanup) {
  const el = h('div', { class: 'widget' });
  const render = () => {
    if (midi.connected) {
      const v = midi.identity;
      el.replaceChildren(
        h('div', { class: 'row' }, h('span', { class: 'tag ok' }, '已连接'), h('b', {}, 'SEQTRAK'), v && h('span', { class: 'muted' }, `固件 ${v.version}`)),
        v && v.versionNumber < 2 ? h('div', { class: 'callout warn', style: { marginBottom: '0' } }, h('b', { class: 'label' }, '固件可以更新'),
          h('span', { html: rich(`你的机器是 **${v.version}**，官方最新是 **V2.00**。已经做好的这几章用到的操作两个版本都一样，可以放心继续；后面章节会用到 V2.00 才有的功能。想更新的话：先把电充满，用 USB 线连着电脑，打开官方的 SEQTRAK App，按它的提示操作。`) })) : '',
      );
    } else if (midi.state === 'unsupported') {
      el.replaceChildren(h('p', {}, '这个浏览器不支持 Web MIDI。请用 Chrome 或 Edge 打开本页面；在那之前可以先在模拟机上练。'));
    } else {
      el.replaceChildren(
        h('div', { class: 'row' },
          h('button', { class: 'btn primary', type: 'button', onclick: () => connectDevice() }, '连接 SEQTRAK'),
          h('span', { class: 'muted small' }, '浏览器会弹出一个权限窗口，选“允许”。'),
        ),
      );
    }
  };
  render();
  cleanup.push(midi.on('state', render), midi.on('identity', render));
  return h('div', { class: 'step-widget' }, el);
}

const DEVICE_FIELDS = {
  tempo: () => ['速度', midi.tempoRounded ? `${midi.tempoRounded} BPM` : '—'],
  track: () => ['选中的轨道', seqtrak.track.label],
  playing: () => ['状态', midi.playing ? '播放中' : '已停止'],
  project: () => ['Project', String(seqtrak.state.project + 1)],
  scale: () => ['SCALE', SCALES[seqtrak.state.scale] ? `${SCALES[seqtrak.state.scale].zh}（第 ${seqtrak.state.scale + 1} 个）` : '—'],
  key: () => ['KEY', KEY_NAMES[seqtrak.state.key] || '—'],
  swing: () => ['Swing', `${seqtrak.state.swing} ticks`],
  // 第 4 章：右边 4 个旋钮在第几页、在不在进阶设置里（这两样是镜像读的：动手步骤里镜像一直挂着）
  sdpage: () => ['右边 4 个旋钮', mirror.sdPage === undefined ? '—' : `第 ${mirror.sdPage + 1} 页`],
  sdmode: () => ['进阶设置', mirror.v.has('sdmode') ? (mirror.sdAdvanced ? '开着' : '关着') : '—'],
};
// 第 4 章的参数读数：起音、衰减、FM（地址见 mirror.js 的 PARAM_ADDR；读回来 0x40 = 原样）
const PARAM_FIELD_LABEL = { attack: '起音', decay: '衰减', fmAmt: 'FM 调制量', fmFreq: 'FM 调制频率', fmFb: 'FM 反馈', fmAlg: 'FM 算法' };
const paramField = (name) => ({
  addr: (p) => PARAM_ADDR[p]?.[name],
  show: (t, d) => [`${t.label} 的${/^[A-Z]/.test(PARAM_FIELD_LABEL[name]) ? ' ' : ''}${PARAM_FIELD_LABEL[name]}`, d?.length ? paramWords(name, name === 'fmAlg' ? d[0] : d[0] - 64) : '—'],
});

// 跟着某条轨道走的读数，写成 '名字:轨道'，例如 'poly:SYNTH2'。每一样：去哪个地址读、读回来的字节怎么显示。
const TRACK_FIELDS = {
  poly: {
    addr: (p) => TRACK_ADDR.poly(p),
    show: (t, d) => [`${t.label} 的弹法`, POLY_MODES[d?.[0]] ? `${POLY_MODES[d[0]].name}（${POLY_MODES[d[0]].zh}）` : '—'],
  },
  bars: {
    addr: (p) => TRACK_ADDR.length(p, seqtrak.state.patterns[p] || 0),
    show: (t, d) => {
      const steps = d?.length >= 2 ? d[0] * 128 + d[1] : 0;
      return [`${t.label} 这段乐句`, steps ? (steps % 16 === 0 ? `${steps / 16} 小节` : `${steps} 步`) : '—'];
    },
  },
  sound: {
    addr: (p) => TRACK_ADDR.soundName(p),
    show: (t, d) => [`${t.label} 的音色`, (d && decodeSoundName(d)) || '—'],
  },
  ...Object.fromEntries(Object.keys(PARAM_FIELD_LABEL).map((n) => [n, paramField(n)])),
};

/** 一行实时读数：真机现在的速度、选中的轨道等。真机没有屏幕，这里就是它的屏幕。 */
function deviceStateBlock(fields, cleanup) {
  const el = h('div', { class: 'widget' });
  const poll = fields.filter((f) => ['project', 'scale', 'key', 'swing'].includes(f));
  const perTrack = fields.filter((f) => f.includes(':')).map((f) => {
    const [name, track] = f.split(':');
    return { f, spec: TRACK_FIELDS[name], track: TRACK[track], p: TRACKS.findIndex((t) => t.id === track) };
  }).filter((x) => x.spec && x.p >= 0);
  const got = new Map(); // '名字:轨道' → 最近一次读回来的字节
  const render = () => {
    if (!midi.connected) {
      el.replaceChildren(h('span', { class: 'muted small' }, '接上真机后，这里会实时显示它的读数。在模拟机上练的话，看模拟机下面那行字就行。'));
      return;
    }
    el.replaceChildren(h('div', { class: 'row', style: { gap: '10px 24px' } }, fields.map((f) => {
      const tf = perTrack.find((x) => x.f === f);
      if (!tf && !DEVICE_FIELDS[f]) return null;
      const [label, value] = tf ? tf.spec.show(tf.track, got.get(f)) : DEVICE_FIELDS[f]();
      return h('div', {}, h('div', { class: 'label' }, `真机 · ${label}`), h('div', { class: 'big-num', style: { fontSize: fields.length > 2 ? '18px' : '22px', marginTop: '4px' } }, value)); // 第 4 章一次摆三样读数：小一号，免得把右边那一栏撑得太长
    })));
  };
  render();
  const timer = setInterval(async () => {
    if (!midi.connected) return;
    for (const f of poll) {
      try {
        await seqtrak.read(ADDR[f]);
      } catch {
        /* 读不到就等下一轮 */
      }
    }
    for (const tf of perTrack) {
      try {
        got.set(tf.f, await seqtrak.read(tf.spec.addr(tf.p)));
      } catch {
        /* 读不到就等下一轮 */
      }
    }
    render();
  }, 600);
  cleanup.push(() => clearInterval(timer), midi.on('state', render), seqtrak.on('state', render));
  return h('div', { class: 'step-widget' }, el);
}

/** 让应用替你把真机设好（速度 / 音阶和调）。没连真机时不显示。 */
function actionBlock(b) {
  if (!midi.connected) return null;
  const btn = h('button', { class: 'btn sm', type: 'button' }, b.label);
  btn.addEventListener('click', () => {
    if (b.action === 'tempo') seqtrak.setTempo(b.value);
    if (b.action === 'scalekey') {
      seqtrak.write(ADDR.scale, [b.scale]);
      seqtrak.write(ADDR.key, [0x40 + b.key]);
    }
    // 把某条合成器轨切到 MONO / POLY / CHORD：官方 CC 26，在那条轨道自己的通道上发（实测有效）
    if (b.action === 'polymode') midi.cc(TRACK[b.track].ch, 26, b.mode);
    // 第 4 章：把某条合成器轨上拧过的参数设回原样（或设成 value，−64 … +63）：官方 CC，2026-11-12 实测写得进去
    if (b.action === 'param') {
      const cc = { attack: 73, decay: 75, cutoff: 74, reso: 71, fmAmt: 117, fmFreq: 118, fmFb: 119 };
      for (const name of [].concat(b.param)) if (cc[name]) midi.cc(TRACK[b.track].ch, cc[name], clamp((b.value ?? 0) + 64, 0, 127));
    }
    // 把某条合成器轨当前这段乐句设成几小节（官方地址，实测有效）
    if (b.action === 'bars') {
      const p = TRACKS.findIndex((t) => t.id === b.track);
      const steps = b.bars * 16;
      seqtrak.write(TRACK_ADDR.length(p, seqtrak.state.patterns[p] || 0), [steps >> 7, steps & 0x7f]);
    }
    toast('已发送给机器', 'ok');
  });
  return h('p', {}, btn);
}

function plainText(step) {
  const parts = [];
  for (const b of step.blocks || []) {
    if (typeof b === 'string') parts.push(b);
    else if (b.callout) parts.push(b.text);
    else if (b.list) parts.push(b.list.join('；'));
  }
  for (const t of step.tasks || []) parts.push(`操作：${t.text}`);
  if (step.coach) parts.push(`教学要点：${step.coach}`);
  return parts.join('\n').replace(/\*\*/g, '').slice(0, 1800);
}

// ───────────── 认出“你做了那一步” ─────────────

function counter(d, onHit, onProgress) {
  let count = 0;
  let done = false;
  const need = d.count || 1;
  return {
    get done() {
      return done;
    },
    stop() {
      done = true;
    },
    hit() {
      if (done) return;
      count++;
      onProgress?.(count, need);
      if (count >= need) {
        done = true;
        onHit();
      }
    },
  };
}

/** 真机：从它发来的 MIDI 里认。返回取消函数。 */
function watchDevice(d, onHit, onProgress) {
  const offs = [];
  const c = counter(d, () => {
    stop();
    onHit();
  }, onProgress);
  const stop = () => {
    c.stop();
    offs.splice(0).forEach((f) => f());
  };
  const every = (ms, fn) => {
    const id = setInterval(fn, ms);
    offs.push(() => clearInterval(id));
  };

  switch (d.kind) {
    case 'connected':
      if (midi.connected) setTimeout(() => c.hit(), 0);
      else offs.push(midi.on('state', (s) => s === 'connected' && c.hit()));
      break;
    case 'scale':
      every(700, async () => {
        try {
          await seqtrak.read(ADDR.scale);
          await seqtrak.read(ADDR.key);
        } catch {
          return;
        }
        if (seqtrak.state.scale === d.scale && seqtrak.state.key === d.key) c.hit();
      });
      break;
    case 'start':
      offs.push(midi.on('start', () => c.hit()));
      break;
    case 'stop':
      offs.push(midi.on('stop', () => c.hit()));
      break;
    case 'note':
      offs.push(midi.on('noteon', (m) => {
        if (d.track && TRACK[d.track].ch !== m.ch) return;
        if (d.tracks && !d.tracks.some((t) => TRACK[t].ch === m.ch)) return;
        c.hit();
      }));
      break;
    case 'track': {
      // 选中某条轨道：机器会广播“当前轨道”，停止状态下还会发一个试听音
      const index = TRACKS.findIndex((t) => t.id === d.track);
      offs.push(seqtrak.on('param', ({ addr, data, reply }) => {
        // 只认机器主动上报的（reply = 对我们查询的回答，不代表你刚按了它）
        if (!reply && addr[0] === 0x01 && addr[1] === 0x10 && addr[2] === 0x27 && data[0] === index) c.hit();
      }));
      offs.push(midi.on('noteon', (m) => {
        if (!midi.playing && m.ch === index + 1) c.hit();
      }));
      break;
    }
    case 'tempo': {
      // 机器一直在发时钟，速度是从时钟间隔算出来的
      const ok = (v) => v && v >= (d.min ?? d.value) - 0.6 && v <= (d.max ?? d.value) + 0.6;
      let since = 0;
      every(250, () => {
        if (ok(midi.tempo)) {
          since ||= performance.now();
          if (performance.now() - since > 700) c.hit();
        } else {
          since = 0;
        }
      });
      break;
    }
    case 'project':
      every(900, async () => {
        try {
          await seqtrak.read(ADDR.project);
        } catch {
          return;
        }
        const p = seqtrak.state.project;
        if (d.in ? d.in.includes(p) : p !== d.not) c.hit();
      });
      break;
    case 'swing':
      every(700, async () => {
        try {
          await seqtrak.read(ADDR.swing);
        } catch {
          return;
        }
        const s = seqtrak.state.swing;
        if (d.zero ? s === 0 : Math.abs(s) >= (d.min || 1)) c.hit();
      });
      break;
    case 'sound':
      // 换音色时机器会发 Program Change
      offs.push(midi.on('pc', (m) => {
        if (!d.track || TRACK[d.track].ch === m.ch) c.hit();
      }));
      break;
    default:
      break;
  }
  return stop;
}

const DEVICE_KINDS = new Set(['connected', 'scale', 'start', 'stop', 'note', 'track', 'tempo', 'project', 'swing', 'sound']);
const sameSteps = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

/** 屏幕上陪练的那台机器：接了真机并且读得到它的状态，就是真机的实时镜像；否则是模拟机。 */
const bench = () => (mirror.available ? mirror : simulator);

/** 这个条件在这台机器上认不认得出来 */
const canWatch = (model, d) => !!d && d.kind !== 'connected' && (model === simulator || mirror.can(d));

/** 从模拟机或真机镜像里认出“这一步做到了”。返回取消函数。 */
function watchModel(model, d, onHit, onProgress) {
  let stop = () => {};
  const c = counter(d, () => {
    stop();
    onHit();
  }, onProgress);
  // 第 4 章的 param / soundname：和这一项刚开始时比。镜像刚挂上去的头零点几秒还没读到，等读到了再记下“开始时的样子”；
  // 滤波器、共鸣在真机上只有机器发 CC 才知道（见 mirror.js），开始时当它在原样（0）
  let base;
  if (d.kind === 'param') base = model.paramOf?.(d.track, d.param) ?? (model === mirror && ['cutoff', 'reso'].includes(d.param) ? 0 : undefined);
  else if (d.kind === 'soundname') base = model.soundName?.(d.track) || undefined;
  const baseline = (now) => {
    if (base === undefined && now !== undefined && now !== null) base = now;
    return base;
  };
  // 完整版的课：条件上写了 pattern（0 起）的，还得在那一段乐句上
  const onPat = () => d.pattern === undefined || (model.patternOf?.(d.track) ?? 0) === d.pattern;
  // stepkeys / stepnotes 写了 from / to：这一页（[from, to) 这几步）里有音的步数也得正好一样——只要“按灭”的那一页，不然一轮到就算做到了
  const rangeOk = (cur, want) => {
    if (d.from === undefined) return true;
    const inside = (s) => Number(s) >= d.from && Number(s) < (d.to ?? 999);
    return Object.keys(cur).filter(inside).length === Object.keys(want).filter(inside).length;
  };
  // “状态型”的条件看机器现在的样子；其它的看刚发生的动作
  const state = () => {
    switch (d.kind) {
      case 'project': return d.in ? d.in.includes(model.project) : model.project >= 0 && model.project !== d.not;
      case 'scale': return model.proj.scale === d.scale && model.proj.key === d.key;
      // 八度本来就在要的那一格（写了 value 才看）：直接算做到；不在的话照旧等“八度变了”的动作
      case 'octave': {
        if (d.value === undefined) return null;
        const p = TRACKS.findIndex((t) => t.id === d.track);
        const v = model === mirror ? mirror.v.get(`oct:${p}`) : model.proj?.octave?.[d.track];
        return v === d.value ? true : null;
      }
      // 速度本来就在这个数上（完整版的课：回到搭好的工程，速度早就设好了）：直接算做到；不在的话照旧等“速度变了”的动作
      case 'tempo': {
        const v = model === mirror ? mirror.v.get('tempo') : model.proj?.tempo;
        return typeof v === 'number' && v >= (d.min ?? d.value) && v <= (d.max ?? d.value) ? true : null;
      }
      case 'steps': {
        const cur = model.stepsOf(d.track);
        return !!cur && sameSteps(cur, d.steps);
      }
      // 第 6 章：这几步都亮着就行（别的步有没有不管）——比如“在复制过来的那段上，再加三下过门”
      case 'hassteps': {
        const cur = model.stepsOf(d.track);
        return !!cur && d.steps.every((x) => cur.includes(x));
      }
      case 'mode': return d.mode === 'realtime' ? model.rtDrum === (d.on ?? true) : (model.stepMode === d.track) === (d.on ?? true);
      // 第 3 章：合成器轨的弹法（0 单音 / 1 复音 / 2 和弦）、这段乐句有几小节
      case 'polymode': return model.polyOf(d.track) === d.mode;
      case 'length': return onPat() && model.barsOf(d.track) === d.bars;
      // 下面两样只有模拟机认得出来（真机上合成器轨的格子读不出）：每一步放的是第几个键、某一步的音有多长
      // stepkeys: keys 里列出的每一步都得是那个键；exact = 别的步还必须是空的
      case 'stepkeys': {
        if (!onPat()) return false;
        const cur = model.keysOf?.(d.track);
        return !!cur && rangeOk(cur, d.keys) && (!d.exact || Object.keys(cur).length === Object.keys(d.keys).length) && Object.entries(d.keys).every(([s, k]) => cur[s] === k);
      }
      case 'notelen': return onPat() && (model.lenOf?.(d.track, d.step) || 0) >= (d.min || 2);
      // 摇摆归零：看现在是不是 0（本来就是 0 时按 [DELETE] + [SWING] 机器上什么也不变、不会有动作上报，只看动作就永远等不到）。别的摇摆条件还是看动作
      case 'swing': return d.zero ? (model === mirror ? model.v.get('swing') === 0 : model.proj?.swing === 0) : null;
      // stepnotes: 和 stepkeys 一样，但核对的是实际的音（MIDI 音符号），认得出八度。曲目的课用（旋律里有高一个八度的音）
      case 'stepnotes': {
        if (!onPat()) return false;
        const cur = model.notesOf?.(d.track);
        return !!cur && rangeOk(cur, d.notes) && (!d.exact || Object.keys(cur).length === Object.keys(d.notes).length) && Object.entries(d.notes).every(([s, n]) => cur[s]?.length === 1 && cur[s][0] === n);
      }
      // 第 4 章：右边 4 个旋钮翻到第几页（0 = 第 1 页）、在不在进阶设置里
      case 'sdpage': return model.sdPage === d.page;
      case 'sdmode': return !!model.sdAdvanced === (d.on ?? true);
      // 音色名：match = 名字要对得上的样子（比如存过的 “_edit\d+$”）；不写 match 就是“和刚开始时不一样了”
      case 'soundname': {
        const name = model.soundName?.(d.track) || '';
        if (!name) return null;
        const was = baseline(name);
        // fresh = 名字要对得上，而且得是这一项开始之后才变成这样的（重学这一课时，上次存过的 _edit01 不算）
        if (d.match) return new RegExp(d.match, 'i').test(name) && (!d.fresh || name !== was);
        return name !== was;
      }
      // 某个参数拧了多少：dir = 1 往大、−1 往小、不写 = 哪边都行；by = 至少拧动多少（默认 12，满格是 ±64）；
      // atLeast / atMost = 拧到某个位置以上 / 以下（不管开始时在哪）
      case 'param': {
        const v = model.paramOf?.(d.track, d.param);
        if (v === undefined || v === null) return null;
        if (d.atLeast !== undefined) return v >= d.atLeast;
        if (d.atMost !== undefined) return v <= d.atMost;
        if (d.near !== undefined) return Math.abs(v - d.near) <= (d.within ?? 6); // 拧回到某个位置附近（比如正中间的“原样”）
        const was = baseline(v);
        const by = d.by ?? 12;
        return d.dir ? (v - was) * d.dir >= by : Math.abs(v - was) >= by;
      }
      // 只有模拟机认得出的：[MASTER/SINGLE] 拨在哪、选中这条轨道的单轨效果是哪一类
      case 'fxswitch': return model === simulator ? simulator.fxSingle === (d.single ?? true) : null;
      // 第 5–7 章：几条轨道都在第几段乐句、某条轨道在第几段、静音了没有；只有模拟机读得出的：Song / Scene 模式、几个 scene、静音模式、采样位和采样源
      case 'patterns': return (d.tracks || TRACKS.map((t) => t.id)).every((t) => (model.patternOf?.(t) ?? 0) === d.pattern);
      case 'patternat': return (model.patternOf?.(d.track) ?? 0) === d.pattern;
      case 'muted': return model.mutedOf ? model.mutedOf(d.track) === (d.on ?? true) : null;
      case 'songmode': return model === simulator ? simulator.songMode === d.mode : null;
      case 'scenes': return model === simulator ? simulator.sceneCount >= (d.min || 1) : null;
      case 'sceneat': return model === simulator ? simulator.songMode > 0 && simulator.sceneIndex === d.index : null;
      case 'mutemode': return model === simulator ? simulator.muteMode === (d.on ?? true) : null;
      // 完整版的课（content/arrangement-lessons.js）：
      // patsteps：这条鼓轨在第 pattern 段上，[from, to) 这几步里亮着的正好是 steps（bars 写了的话，这段还得是这么多小节）。真机只读得到前 16 步
      case 'patsteps': {
        if (!onPat()) return false;
        if (d.bars !== undefined && model.barsOf?.(d.track) !== d.bars) return false;
        const cur = model.stepsOf(d.track);
        if (!cur) return null;
        const from = d.from ?? 0;
        const to = d.to ?? 999;
        const inside = (x) => x >= from && x < to;
        return sameSteps(cur.filter(inside), d.steps.filter(inside));
      }
      // patmode：每条轨道能选 6 段乐句了（模拟机的 patSlots；真机读 30 40 79，整个工程一个）
      case 'patmode': return model === simulator ? simulator.patSlots === ((d.six ?? true) ? 6 : 3) : model === mirror ? mirror.v.get('patMode') === ((d.six ?? true) ? 1 : 0) : null;
      // combo：几条轨道各在第几段（pat，0 起）、哪几条静音（mute）、哪几条出声（unmute）。Song 模式里选中一个 scene 时，轨道就是它记下的样子；
      // scene 写了的话（0 起，只有模拟机认得出）还得是选中的那个 scene
      case 'combo': {
        if (d.scene !== undefined && model === simulator && !(simulator.songMode > 0 && simulator.sceneIndex === d.scene)) return false;
        if (!Object.entries(d.pat || {}).every(([t, n]) => (model.patternOf?.(t) ?? 0) === n)) return false;
        if (!model.mutedOf) return null;
        return (d.mute || []).every((t) => model.mutedOf(t) === true) && (d.unmute || []).every((t) => model.mutedOf(t) === false);
      }
      // scenelen：选中的那个 scene（index 写了就得是它）有 steps 步；auto = 要的是 AUTO
      case 'scenelen': {
        if (model !== simulator) return null;
        if (!simulator.songMode || (d.index !== undefined && simulator.sceneIndex !== d.index)) return false;
        const sc = simulator.sceneOf();
        return !!sc && (d.auto ? sc.auto : sc.len === d.steps);
      }
      case 'samplesrc': return model === simulator ? simulator.sampleSrc === d.src : null;
      case 'masterfx': return model === simulator ? simulator.masterFxCat === d.cat : null;
      case 'samplesel': return model === simulator && d.key ? simulator.sampleKey === d.key && simulator.sel === 'SAMPLER' : null;
      case 'fxtype': {
        const fx = model === simulator ? simulator.fxOf(d.track || simulator.sel) : null;
        return model === simulator ? !!fx && fx.cat === d.cat && (d.preset === undefined || fx.preset === d.preset) : null;
      }
      default: return null;
    }
  };
  const match = (e) => {
    switch (d.kind) {
      case 'start':
      case 'stop': return e.type === d.kind;
      case 'track': return e.type === 'track' && e.track === d.track;
      case 'note': return e.type === 'note' && (!d.track || e.track === d.track) && (!d.tracks || d.tracks.includes(e.track));
      case 'tempo': return e.type === 'tempo' && e.bpm >= (d.min ?? d.value) && e.bpm <= (d.max ?? d.value);
      case 'swing': return e.type === 'swing' && (d.zero ? e.value === 0 : Math.abs(e.value) >= (d.min || 1));
      case 'sound': return e.type === 'sound' && (!d.track || e.track === d.track);
      case 'mute': return e.type === 'mute' && e.track === d.track && e.on === (d.on ?? true);
      case 'solo': return e.type === 'solo' && (d.any || e.track === (d.track ?? null));
      case 'power': return e.type === 'power' && e.on === d.on;
      // 几个音一起响（POLY 下同时按几个键，或者 CHORD 下按一个键）。min = 至少几个音；key = 必须是第几个 Synth key 的和弦（只有模拟机报得出）
      case 'chord': return e.type === 'chord' && (!d.track || e.track === d.track) && e.count >= (d.min || 2) && (!d.key || !e.key || e.key === d.key);
      case 'page': return e.type === 'page' && (d.page === undefined || e.page === d.page);
      // 第 4 章：[FX LEVEL] 动了（模拟机报 fxlevel；真机靠 CC 107 单轨 / 102 主效果，没人在机器上试过发不发）、[UNDO/REDO]
      case 'fxlevel': return e.type === 'fxlevel' ? (d.min === undefined || e.value >= d.min) : e.type === 'cc' && [102, 107].includes(e.cc);
      case 'undo': return e.type === 'undo';
      // 第 5–7 章
      case 'samplesel': return e.type === 'samplesel' && (!d.key || e.key === d.key);
      case 'sampled': return e.type === 'sampled' && (!d.key || e.key === d.key);
      case 'sampling': return e.type === 'sampling' && e.on === (d.on ?? true) && !!e.cancelled === !!d.cancelled;
      case 'patterncopy':
      case 'patternpaste':
      case 'patternreserve': return e.type === d.kind && (!d.track || e.track === d.track) && (d.pattern === undefined || e.pattern === d.pattern);
      case 'scene': return e.type === 'scene' && (d.added === undefined || !!e.added === d.added);
      // on: false = 手松开了（模拟机报得出；真机松手发不发 CC、发什么不知道）
      case 'highpass': return d.on === false ? e.type === 'highpass' && e.on === false : (e.type === 'highpass' && e.on) || (e.type === 'cc' && e.cc === 105);
      case 'repeater': return d.on === false ? e.type === 'repeater' && e.on === false : (e.type === 'repeater' && e.on) || (e.type === 'cc' && e.cc === 106);
      // 第 7 章：混音台模式里选了哪一样、转轨道旋钮调了哪条轨道的哪一样（dir = 往大 1 / 往小 −1；count = 转几格）、[CLEAR FX]
      case 'mixparam': return e.type === 'mixparam' && (!d.param || e.param === d.param);
      case 'mix': return e.type === 'mix' && (!d.track || e.track === d.track) && (!d.param || e.param === d.param) && (!d.dir || Math.sign(e.delta) === d.dir);
      case 'clearfx': return e.type === 'clearfx';
      case 'plock': return e.type === 'plock';
      case 'soundsave': return e.type === 'soundsave' && (!d.track || e.track === d.track);
      case 'tempsave':
      case 'temprestore':
      case 'mixer': return e.type === d.kind && (d.on === undefined || e.on === d.on);
      case 'volume':
      case 'octave':
      case 'delete':
      case 'pattern':
      case 'metronome': return e.type === d.kind && (!d.track || e.track === d.track);
      default: return false;
    }
  };
  const check = (e) => {
    const s = state();
    if (s === true || (s === null && e && match(e))) c.hit();
  };
  const offEvent = model.on('event', check);
  // 状态型的条件隔半秒再看一眼：进来时就满足也算；真机的状态是陆续读回来的。
  // 刚轮到这一项时马上先看一眼（第 4 章“已经在 4 号工程 / 已经在第 2 页就会自己打勾”）：不然要等半秒，这半秒里按的下一个键会被算在这一项头上
  const timer = setInterval(() => check(null), 500);
  const soon = setTimeout(() => check(null), 30);
  stop = () => {
    clearInterval(timer);
    clearTimeout(soon);
    offEvent();
  };
  return () => {
    c.stop();
    stop();
  };
}

/** 真机停在出厂演示曲上时，提醒先换到空白工程：演示曲里已经有很多内容，填格子的练习会对不上。 */
const demoWarning = (model) => (model === mirror && model.project >= 0 && model.project < 3
  ? `真机现在在 **${model.project + 1} 号工程**，是出厂演示曲，里面已经有很多内容。先翻到练习本：**按住 [PROJECT↑]，再按上排第 4 个步进键**（4 号空白工程）。`
  : null);

/** 真机上这条轨道不在第 1 段乐句时提醒一句：课程里的内容都写在第 1 段。 */
const patternWarning = (model, track) => {
  const pat = model === mirror ? mirror.patternOf(track) : 0;
  return pat > 0 ? `${TRACK[track]?.label || track} 现在停在**第 ${pat + 1} 段乐句**（它的旋钮被转过）。把旋钮往回转到第 1 段再填，转的时候看屏幕上那行字。` : null;
};

// 第 4 章：每个参数在第几页（0 起）、从上往下第几个旋钮、中文叫什么
const PARAM_HINT = {
  attack: { page: 1, knob: 1, zh: '起音（ATTACK）' },
  decay: { page: 1, knob: 2, zh: '衰减（DECAY）' },
  cutoff: { page: 1, knob: 3, zh: '滤波器（FILTER）' },
  reso: { page: 1, knob: 4, zh: '共鸣（RESONANCE）' },
  fmAlg: { page: 4, knob: 1, zh: 'FM 算法' },
  fmAmt: { page: 4, knob: 2, zh: 'FM 调制量' },
  fmFreq: { page: 4, knob: 3, zh: 'FM 调制频率' },
  fmFb: { page: 4, knob: 4, zh: 'FM 反馈' },
  rev: { page: 2, knob: 1, zh: '混响送多少（REVERB）' },
  dly: { page: 2, knob: 2, zh: '延迟送多少（DELAY）' },
};
// 拧对了参数、方向也对、只是还不够多的时候不唠叨：只有往反方向拧的时候才说
const base0 = (e, d) => (d.dir && e.value !== undefined && Math.sign(e.value) === -Math.sign(d.dir) ? e.value : null);

/** 做偏了的时候，说一句有用的话（没什么可说的就返回 null）。 */
function hintFor(d, e, model) {
  const name = (id) => TRACK[id]?.label || id;
  if (d.kind === 'steps' && e.type === 'project') return demoWarning(model) || `现在是 ${e.index + 1} 号工程，可以填格子了。`;
  // 第 6 章那些本来就要换段的任务（换到第几段、复制粘贴、scene）：换段不是做偏了，不提醒
  const PATTERN_KINDS = ['pattern', 'patternat', 'patterns', 'patternreserve', 'patterncopy', 'patternpaste', 'hassteps', 'scene', 'scenes', 'sceneat', 'songmode', 'patmode', 'combo', 'scenelen', 'patsteps'];
  // 完整版的课：这一项要在第几段上做，转到了别的段就说一声
  if (e.type === 'pattern' && d.pattern !== undefined && e.track === d.track && e.pattern !== d.pattern) return `${name(e.track)} 现在在第 ${e.pattern + 1} 段，这一项要在**第 ${d.pattern + 1} 段**上做：把 ${name(e.track)} 旋钮转回去。`;
  if (e.type === 'pattern' && !PATTERN_KINDS.includes(d.kind) && d.pattern === undefined && e.track !== 'ALL') {
    return e.pattern === 0
      ? `${name(e.track)} 回到第 1 段乐句了，接着做。`
      : `${name(e.track)} 的旋钮被**转动**了，换到了第 ${e.pattern + 1} 段乐句。往回转到第 1 段再继续。`;
  }
  if (d.kind === 'track' && e.type === 'track' && e.track !== d.track) return `你选中的是 ${name(e.track)}，要找的是 **${name(d.track)}**（蓝圈那个）。`;
  if (d.kind === 'steps') {
    if (e.type === 'track' && e.track !== d.track) return `现在选中的是 ${name(e.track)}，步进键会填到它上面。先按一下 **${name(d.track)} 旋钮**。`;
    if (e.type === 'step' || e.type === 'delete') {
      if (e.track !== d.track) return `这一下填到了 ${name(e.track)} 上。先按一下 **${name(d.track)} 旋钮**，再填。`;
      const cur = model.stepsOf(d.track) || [];
      const missing = d.steps.filter((s) => !cur.includes(s)).map((s) => s + 1);
      const extra = cur.filter((s) => !d.steps.includes(s)).map((s) => s + 1);
      if (!missing.length && !extra.length) return null;
      return `${[missing.length ? `还差第 ${missing.join('、')} 步` : '', extra.length ? `第 ${extra.join('、')} 步是多出来的，再按一下把它按灭` : ''].filter(Boolean).join('；')}。`;
    }
  }
  if (d.kind === 'hassteps' && e.type === 'step') {
    if (e.track !== d.track) return `这一下填到了 ${name(e.track)} 上。先按一下 **${name(d.track)} 旋钮**，再填。`;
    const cur = model.stepsOf(d.track) || [];
    const missing = d.steps.filter((x) => !cur.includes(x)).map((x) => x + 1);
    return missing.length ? `还差第 ${missing.join('、')} 步。` : null;
  }
  if (d.kind === 'patternat' && e.type === 'pattern' && e.track === d.track && e.pattern !== d.pattern) return `${name(d.track)} 现在在第 ${e.pattern + 1} 段，要的是**第 ${d.pattern + 1} 段**：接着转一格看看（转过头了就往回转），旋钮旁边那 3 个小灯亮的位置会跟着换。`;
  if (d.kind === 'mute' && e.type === 'mute' && e.track !== d.track) return `刚才动的是 ${name(e.track)} 的静音，这一步要的是 **${name(d.track)}**。`;
  // 想换工程，却没按住 [PROJECT↑] 就按了方键：那一下改的是当前这条鼓轨的格子
  if (d.kind === 'project' && e.type === 'step' && d.in) {
    return `刚才没按住 [PROJECT↑]：这一下把 ${name(e.track)} 的第 ${e.step + 1} 步${e.on ? '按亮' : '按灭'}了。再按一次那个方键把它${e.on ? '按灭' : '按亮'}，然后**先按住 [PROJECT↑] 不放**，再按上排第 ${d.in[0] + 1} 个方键。`;
  }
  if (d.kind === 'project' && e.type === 'project' && d.in && !d.in.includes(e.index)) return `现在是 ${e.index + 1} 号工程，要去的是 **${d.in[0] + 1} 号**：按住 [PROJECT↑]，再按上排第 ${d.in[0] + 1} 个步进键。`;
  if (d.kind === 'tempo' && e.type === 'tempo' && d.value && e.bpm !== d.value) return `现在 ${e.bpm} BPM，目标 ${d.value}：${e.bpm < d.value ? '继续按 [BPM+]' : '按 [BPM-] 往回调'}。`;
  if (d.kind === 'scale' && e.type === 'scalekey') return `现在是 ${SCALES[e.scale]?.zh || '?'} / ${KEY_NAMES[e.key] ?? '?'}，目标是 **${SCALES[d.scale].zh} / ${KEY_NAMES[d.key]}**。`;
  // 换音色、切弹法用的都是第 1 页上的旋钮：被翻到别的页了就先提醒
  if ((d.kind === 'polymode' || d.kind === 'sound') && e.type === 'sdpage' && e.page > 0) {
    return `右边那 4 个旋钮被翻到了第 ${e.page + 1} 页，这一页上它们调的是别的东西。按 **Sound Design Page** 键（那一列旋钮正下方、靠近你这一边的边沿上，印着一排三个小点的那个），翻回第 1 页。`;
  }
  if (d.kind === 'sound' && e.type === 'sound' && d.track && e.track !== d.track) return `刚才换的是 ${name(e.track)} 的音色，这一步要换的是 **${name(d.track)}**：先按一下 ${name(d.track)} 旋钮选中它。`;
  if (d.kind === 'polymode') {
    const want = POLY_MODES[d.mode];
    if (e.type === 'polymode' && e.track !== d.track) return `刚才变的是 ${name(e.track)} 的弹法，这一步要调的是 **${name(d.track)}**：先按一下 ${name(d.track)} 旋钮选中它，再转旋钮 2。`;
    if (e.type === 'polymode' && e.mode !== d.mode) return `${name(d.track)} 现在是 **${POLY_MODES[e.mode]?.name}**，目标是 **${want.name}**：接着慢慢转旋钮 2，转到那列文字里 “${want.name === 'CHORD' ? 'CHORD' : 'MONO/POLY'}” 亮${d.mode === 2 ? '、小灯从上往下数第 3 个亮' : ''}。`;
    if (e.type === 'track' && e.track !== d.track) return `现在选中的是 ${name(e.track)}，旋钮 2 调的是它。先按一下 **${name(d.track)} 旋钮**。`;
    if (e.type === 'sound' && e.track === d.track) return `给 ${name(d.track)} 换了音色。弹法是存在音色里的，换完看一眼：不是 ${want.name} 的话，再转一次旋钮 2。`;
  }
  if (d.kind === 'chord') {
    if (e.type === 'chord' && e.track === d.track && e.count < (d.min || 2)) return `这次一起响了 ${e.count} 个音，要 **${d.min} 个**：几个键尽量同时按下去，按住别松。`;
    if (e.type === 'note' && d.track && e.track !== d.track) return `这一声是 ${name(e.track)} 的。先按一下 **${name(d.track)} 旋钮**选中它。`;
    if (e.type === 'note' && model.polyOf?.(d.track) === 0) return `${name(d.track)} 现在是 **MONO（单音）**，一次只能出一个音，叠不出和弦。把旋钮 2 转到 POLY（或 CHORD）再试。`;
  }
  // 第 4 章：拧参数、翻页
  if (d.kind === 'param') {
    const want = PARAM_HINT[d.param];
    if (e.type === 'track' && e.track !== d.track) return `现在选中的是 ${name(e.track)}，右边那 4 个旋钮调的是它。先按一下 **${name(d.track)} 旋钮**（只按，别转）。`;
    if (e.type === 'sdpage' && want && e.page !== want.page) return `右边那 4 个旋钮现在在**第 ${e.page + 1} 页**，${want.zh}在**第 ${want.page + 1} 页**：${want.page === 4 ? '进阶设置里，' : ''}接着按翻页键（那一列正下方、印着三个小点的那个），看那列小灯从上往下第 ${want.page + 1} 个亮。`;
    if (e.type === 'sound' && e.track === d.track) return `刚才**换了音色**：这一页上的旋钮是第 1 页的 SOUND 那个在动？换音色会把拧过的冲掉。先按翻页键翻到第 ${(want?.page ?? 1) + 1} 页再拧。`;
    if (e.type === 'param' && e.track !== d.track) return `刚才拧的是 ${name(e.track)} 的，这一步要拧的是 **${name(d.track)}**：先按一下它的旋钮选中它。`;
    if (e.type === 'param' && e.param !== d.param && want) return `刚才拧的是**${PARAM_HINT[e.param]?.zh || e.param}**（从上往下第 ${PARAM_HINT[e.param]?.knob || '?'} 个），这一步要拧的是**${want.zh}**：从上往下数第 ${want.knob} 个。`;
    if (e.type === 'param' && e.param === d.param && d.dir && base0(e, d) !== null) return d.dir > 0 ? `${want?.zh || ''}还要再往大拧一些（往另一边转）。` : `${want?.zh || ''}还要再往小拧一些（往另一边转）。`;
  }
  if (d.kind === 'sdpage' && e.type === 'sdpage' && e.page !== d.page) return `现在是**第 ${e.page + 1} 页**，要的是**第 ${d.page + 1} 页**：${d.page >= 2 && !model.sdAdvanced ? '第 3 页以后要先进进阶设置（长按翻页键 2 秒）；' : ''}接着单按翻页键，看那列小灯从上往下第 ${d.page + 1} 个亮。`;
  if (d.kind === 'length' && e.type === 'length' && e.track === d.track && e.bars !== d.bars) return `${name(d.track)} 现在是 ${e.bars} 小节，目标是 **${d.bars} 小节**：接着按 [BAR LENGTH]，看这里的读数。`;
  if (d.kind === 'length' && e.type === 'length' && e.track !== d.track) return `刚才变长的是 ${name(e.track)} 的乐句。这一步要的是 **${name(d.track)}**：先按一下它的旋钮，再按 [BAR LENGTH]。`;
  if (d.kind === 'stepnotes' && (e.type === 'step' || e.type === 'note' || e.type === 'octave')) {
    const cur = model.notesOf?.(d.track) || {};
    const at = (s) => (Number(s) < 16 ? `第 ${Number(s) + 1} 步` : `第 ${Math.floor(s / 16) + 1} 页的第 ${(s % 16) + 1} 个`);
    const off = [];
    for (const [s, n] of Object.entries(d.notes)) {
      const got = cur[s];
      if (!got) continue;
      if (got.length > 1) off.push(`${at(s)}里叠了 ${got.length} 个音（按住步进键再按 Synth key 是“加一个音”），先把它按灭重放`);
      else if (got[0] !== n && (got[0] - n) % 12 === 0) off.push(`${at(s)}：音对了，但${got[0] > n ? '高' : '低'}了${Math.abs(got[0] - n) / 12 > 1 ? ` ${Math.abs(got[0] - n) / 12} 个` : '一个'}八度：按灭，调好八度（按住 [OCTAVE] 转 [ALL]），再按一下 Synth key、按亮`);
      else if (got[0] !== n) off.push(`${at(s)}放的不是这个音：按灭，按对的 Synth key，再按亮`);
    }
    const missing = Object.keys(d.notes).filter((s) => !cur[s]).map(at);
    const extra = d.exact ? Object.keys(cur).filter((s) => d.notes[s] === undefined).map(at) : [];
    const parts = [...off, missing.length ? `还差${missing.join('、')}` : '', extra.length ? `${extra.join('、')}是多出来的` : ''].filter(Boolean);
    return parts.length ? `${parts.join('；')}。` : null;
  }
  if (d.kind === 'stepkeys' && (e.type === 'step' || e.type === 'note')) {
    const cur = model.keysOf?.(d.track) || {};
    // 第 17 步以后在步进键的第 2 页上：说成“第 2 页的第几个”，和手上按的对得上
    const at = (s) => (Number(s) < 16 ? `第 ${Number(s) + 1} 步` : `第 ${Math.floor(s / 16) + 1} 页的第 ${(s % 16) + 1} 个`);
    const wrong = Object.entries(d.keys).filter(([s, k]) => cur[s] !== undefined && cur[s] !== k).map(([s, k]) => `${at(s)}现在是键 ${cur[s] || '?'}，应该是键 ${k}`);
    const missing = Object.keys(d.keys).filter((s) => cur[s] === undefined).map(at);
    const extra = d.exact ? Object.keys(cur).filter((s) => d.keys[s] === undefined).map(at) : [];
    const parts = [...wrong, missing.length ? `还差${missing.join('、')}` : '', extra.length ? `${extra.join('、')}是多出来的` : ''].filter(Boolean);
    return parts.length ? `${parts.join('；')}。` : null;
  }
  return null;
}

/** 刚轮到这一项时，机器当下的状态要是明摆着不对，先提醒一句（没什么可说的就返回 null）。 */
function stateWarning(d, model) {
  if (d.kind === 'steps') return demoWarning(model) || patternWarning(model, d.track);
  // 完整版的课：要在第 pattern 段上做的那几项，轨道停在别的段上
  if (d.pattern !== undefined && d.track && model.patternOf && model.patternOf(d.track) !== d.pattern) return `${TRACK[d.track]?.label || d.track} 现在在第 ${model.patternOf(d.track) + 1} 段乐句，这一项要在**第 ${d.pattern + 1} 段**上做：先把它的旋钮转过去（看旋钮旁边的小灯）。`;
  if (d.kind === 'sound' && model === mirror && mirror.v.get('sdPage') > 0) return `右边那 4 个旋钮现在在第 ${mirror.v.get('sdPage') + 1} 页，换音色要在第 1 页。先按 **Sound Design Page** 键（那一列旋钮正下方、靠近你这一边的边沿上，印着一排三个小点的那个）翻回第 1 页。`;
  if (d.kind === 'param') {
    const sel = model === mirror ? mirror.selectedTrack : model.sel;
    const want = PARAM_HINT[d.param];
    if (d.track && sel && sel !== d.track) return `现在选中的是 ${TRACK[sel]?.label || sel}。先按一下 **${TRACK[d.track]?.label || d.track} 旋钮**选中它（只按，别转）。`;
    if (want?.page >= 2 && model.sdAdvanced === false) return `这一样在**进阶设置**里：先**长按**翻页键（右边那一列旋钮正下方、印着三个小点的那个）**2 秒**，再单按它翻到第 ${want.page + 1} 页。`;
    if (want && model.sdPage !== undefined && model.sdPage !== want.page) return `右边那 4 个旋钮现在在第 ${model.sdPage + 1} 页，${want.zh}在**第 ${want.page + 1} 页**：先按翻页键（那一列正下方、印着三个小点的那个）翻过去。`;
  }
  if (d.kind === 'polymode' || d.kind === 'chord' || d.kind === 'length') {
    const sel = model === mirror ? mirror.selectedTrack : model.sel;
    const label = TRACK[d.track]?.label || d.track;
    if (d.track && sel && sel !== d.track) return `现在选中的是 ${TRACK[sel]?.label || sel}。先按一下 **${label} 旋钮**选中它（只按，别转）。`;
    if (d.kind === 'polymode' && model === mirror && mirror.v.get('sdPage') > 0) return `右边那 4 个旋钮现在在第 ${mirror.v.get('sdPage') + 1} 页，弹法在第 1 页。按 **Sound Design Page** 键（那一列旋钮正下方、靠近你这一边的边沿上，印着一排三个小点的那个）翻回第 1 页，再转旋钮 2。`;
    if (d.kind === 'chord' && (d.min || 2) > 1 && model.polyOf?.(d.track) === 0) return `${label} 现在是 **MONO（单音）**，一次只能出一个音。先把旋钮 2 转到 POLY 或 CHORD。`;
  }
  return null;
}

// ───────────── 各种步骤 ─────────────

/**
 * 讲解页的排法：正文在左边一栏（一行三十几个字，读着不累），紧跟着它的“小贴士 / 注意 / 一点乐理”放到右边当旁注；
 * 小部件和面板图占满整行。blocks 的先后不变，只是把旁注挪到它前面那段正文的旁边。
 */
function readRows(blocks, cleanup) {
  const rows = [];
  let cur = null;
  for (const b of blocks || []) {
    const node = renderBlocks([b], cleanup)[0];
    if (!node) continue;
    if (typeof b === 'string' || b.list) {
      if (!cur || cur.notes.length) rows.push((cur = { text: [], notes: [] }));
      cur.text.push(node);
    } else if (b.callout) {
      if (!cur) rows.push((cur = { text: [], notes: [] }));
      cur.notes.push(node);
    } else {
      rows.push({ full: node });
      cur = null;
    }
  }
  // --i = 第几块：丰富档下一块一块依次出现
  return rows.map((r, i) => (r.full
    ? h('div', { class: 'read-row full', style: { '--i': String(i) } }, r.full)
    : h('div', { class: ['read-row', !r.notes.length && 'solo', !r.text.length && 'notes-only'], style: { '--i': String(i) } },
      h('div', { class: 'read-text' }, r.text),
      r.notes.length ? h('aside', { class: 'read-notes' }, r.notes) : null)));
}

function stepRead(step, env, cleanup) {
  env.setReady(true);
  return h('div', { class: 'step-body read' }, readRows(step.blocks, cleanup));
}

/** 导览：左边机器，镜头跟着正在讲的那一块走；右边是这一步的课文和每一站讲什么（版式在 panel-widgets.js）。 */
function stepTour(step, env, cleanup) {
  const tour = panelTour({ onDone: () => env.setReady(true), intro: renderBlocks(step.blocks, cleanup).filter(Boolean) });
  cleanup.push(() => tour.destroy());
  tour.el.classList.add('step-body');
  return tour.el;
}

function stepFindKeys(step, env, cleanup) {
  const quiz = panelQuiz({
    count: step.count || 10,
    mode: step.mode || 'mixed',
    pass: step.pass || 7,
    showStars: true,
    onNext: () => env.next(),
    onDone: (score, total, passed, stars) => {
      if (!passed) return; // 没过关的一轮不记星（这一步没做完，跳过的话按一颗算）
      env.stars(stars);
      env.setReady(true);
    },
  });
  cleanup.push(() => quiz.destroy());
  return h('div', { class: 'step-body' }, renderBlocks(step.blocks, cleanup), h('div', { class: 'step-widget' }, quiz.el));
}

/** 让一个一次性的动画重新播一遍 */
function retrigger(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

/**
 * 动手：一串操作，逐项自动打勾。旁边那台机器：没接真机时是模拟机，接了真机就是它的实时镜像。
 * 版式是左右两栏：左边是机器，现在该做的那一项是贴在它上面的一个气泡，尾巴指着要按的键，啾啾飞到那个键的上方悬停着；
 * 右边是这一步的说明和整张清单。没摆机器的步骤只有右边这一栏，气泡也待在那里（啾啾回窝）。
 * 点啾啾会多两个选项：“我卡住了”（它先指一遍现在这一项，再替你问）、“示范一下”（按顺序飞到要按的几个键上）。
 * 课文里可以用的开关：
 *   step.bench = 'sim'   只用模拟机；'live' = 只在接着真机时摆出镜像，没接就不摆机器
 *   step.optional        不做也能进下一步（比如“先把真机接上”，没带机器的人直接跳过）
 *   step.liveBlocks      接着真机时换用的课文；task.liveText / task.liveWait 同理（模拟机和真机的手势说法不一样）
 *   task.liveSkip        这一项只在模拟机上做，接着真机时不用做
 *   task.live            接着真机时优先用的条件（detect / sim 的写法相同）
 */
function stepDo(step, env, cleanup) {
  const tasks = step.tasks || [];
  const useBench = step.panel !== false;
  const list = h('ol');
  const status = h('div', { class: 'task-status' });
  const box = h('div', { class: 'task' }, list, status);
  const holder = h('div', { class: 'do-machine' });
  const bubble = h('div', { class: 'do-bubble' });
  const bubbleRow = h('div', { class: 'do-bubble-row' }, bubble);
  const intro = h('div', { class: 'do-intro' });
  let introFor = null;
  let introCleanup = [];
  let model = null;
  let current = 0;
  let unwatch = [];
  const stopWatching = () => unwatch.splice(0).forEach((f) => f());
  const isLive = () => model === mirror;
  const skipped = (t) => isLive() && !!t.liveSkip;
  const textOf = (i) => (isLive() && tasks[i].liveText) || tasks[i].text;

  const items = tasks.map(() => {
    const text = h('span');
    const mark = h('span', { class: 'tag ok', style: { marginLeft: '8px', display: 'none' } }, '✓');
    const li = h('li', {}, text, mark);
    list.append(li);
    return { li, mark, text };
  });

  /** 啾啾飞到现在这一项要按的键上方指着；做完了、没摆机器、这一项不用按键，它就回去 */
  let unpoint = null;
  let pointKey = '';
  function pointBird() {
    const ids = (current < tasks.length && model && tasks[current].panel) || [];
    const key = ids.join(',');
    if (key === pointKey) return;
    unpoint?.();
    unpoint = null;
    pointKey = key;
    if (ids.length) unpoint = jiu.point(() => (model?.panel?.el.isConnected ? model.panel.spot(ids) : null));
  }

  /** 气泡的尾巴对准要按的键：量出那个键在屏幕上的位置，把气泡挪到它的正上方 */
  function placeBubble() {
    pointBird();
    const t = tasks[current];
    const row = bubbleRow.getBoundingClientRect();
    const spot = model && t && row.width ? model.panel?.spot(t.panel || []) : null;
    bubble.classList.toggle('loose', !spot);
    if (!spot) {
      bubble.style.marginLeft = '';
      return;
    }
    const w = bubble.offsetWidth;
    const x = clamp((spot.left + spot.right) / 2 - row.left, 22, row.width - 22);
    const left = clamp(x - 46, 0, Math.max(0, row.width - w));
    bubble.style.marginLeft = `${Math.round(left)}px`;
    bubble.style.setProperty('--tail', `${Math.round(clamp(x - left, 22, w - 22))}px`);
  }
  const benchCol = h('div', { class: 'do-bench' }, bubbleRow, holder);
  const view = benchView(() => model?.panel, () => (current < tasks.length ? tasks[current].panel : []), placeBubble, () => fitView(benchCol, BENCH_VIEW, 250));
  const side = h('div', { class: 'do-side' }, intro, box);
  const el = h('div', { class: 'step-body split' }, benchCol, side);
  // 这一步刚画出来时还没挂到页面上，量不到大小和位置：等挂上、入场的动画走完，各再取一次景、摆一次气泡；之后这一栏的大小变了也重来
  const stopRefit = refitOnResize(benchCol, () => view.apply());
  const placeLater = [setTimeout(() => view.apply(), 0), setTimeout(placeBubble, 480)];

  const pickBench = () => {
    if (!useBench) return null;
    if (step.bench === 'sim') return simulator;
    if (step.bench === 'live') return mirror.available ? mirror : null;
    return bench();
  };

  /** 把陪练的那台机器摆上去（或换一台），课文和每一项的说法也跟着换 */
  function mountBench() {
    model?.unmount();
    model = pickBench();
    clear(holder);
    el.classList.toggle('no-bench', !model);
    // 没摆机器：气泡挪到右边那一栏，放在清单上面
    if (model) benchCol.prepend(bubbleRow);
    else side.insertBefore(bubbleRow, box);
    if (model) view.dock(holder.appendChild(model.mount()));
    const blocks = isLive() && step.liveBlocks ? step.liveBlocks : step.blocks;
    if (blocks !== introFor) {
      introFor = blocks;
      introCleanup.splice(0).forEach((f) => f());
      intro.replaceChildren(...renderBlocks(blocks, introCleanup).filter(Boolean));
    }
    items.forEach((it, i) => {
      it.text.innerHTML = rich(textOf(i));
    });
  }

  /** 做完一项：一个勾、一小撮彩带、一声；整步做完的那一下大一点 */
  function cheer(t, last) {
    sfx.play(last ? 'star' : 'ok');
    setCoachMood('happy', last ? 2600 : 1200);
    if (last) jiu.act('flip'); // 整步做完：啾啾翻个跟头
    for (const id of t.panel || []) model?.flash(id);
    confetti(bubble, last ? 28 : 8, { spread: last ? 170 : 80 });
  }

  function activate(i) {
    stopWatching();
    while (i < tasks.length && skipped(tasks[i])) i++; // 只在模拟机上做的项目，接着真机时跳过去
    current = i;
    items.forEach((it, j) => {
      const skip = skipped(tasks[j]);
      it.li.className = skip ? 'skip' : j < i ? 'done' : j === i ? 'now' : 'todo';
      it.mark.style.display = skip || j < i ? '' : 'none';
      it.mark.textContent = skip ? '真机上不用做' : '✓';
      it.mark.className = skip ? 'tag' : 'tag ok';
    });
    bubble.classList.toggle('ok', i >= tasks.length);
    if (i >= tasks.length) {
      model?.highlight([]);
      view.apply();
      box.classList.add('done');
      bubble.replaceChildren(h('span', { class: 'n' }, '做到了'), h('span', {}, step.done || '这一步的操作都做完了。'));
      status.replaceChildren(h('span', { class: 'pulse' }), step.done || '做到了。');
      retrigger(bubble, 'in');
      placeBubble();
      env.setReady(true);
      return;
    }
    const t = tasks[i];
    const doable = tasks.map((x, j) => j).filter((j) => !skipped(tasks[j]));
    bubble.replaceChildren(
      h('span', { class: 'n' }, doable.length > 1 ? `第 ${doable.indexOf(i) + 1} 步 / 共 ${doable.length} 步` : '现在做这个'),
      h('span', { html: rich(textOf(i)) }));
    retrigger(bubble, 'in');
    items[i].li.scrollIntoView?.({ block: 'nearest' });
    model?.highlight(t.panel || []);
    view.apply(); // 镜头转到这一项要按的键上（里面会重新摆气泡）
    const done = () => {
      cheer(t, !tasks.slice(i + 1).some((x) => !skipped(x)));
      activate(i + 1);
    };
    const progress = h('span', {});
    const live = isLive();
    const waitText = (live && t.liveWait) || t.wait;
    const onProgress = (c, n) => {
      if (n > 1) progress.textContent = `${waitText || '继续'}（${c}/${n}）`;
    };
    let watching = false;
    let d = null;
    if (t.detect?.kind === 'connected') {
      unwatch.push(watchDevice(t.detect, done, onProgress));
      watching = true;
    } else if (t.detect?.kind === 'check') {
      // detect.test() 返回 true 就算做到了（隔 0.7 秒看一次）：不看机器，看应用里的进度
      const timer = setInterval(() => {
        try {
          if (t.detect.test()) {
            clearInterval(timer);
            done();
          }
        } catch {
          /* 读进度出错就等下一次 */
        }
      }, 700);
      unwatch.push(() => clearInterval(timer));
      watching = true;
    } else if (model) {
      // 优先用更完整的条件（sim），这台机器认不出来再退到 detect。
      // task.live = 接着真机时优先用的条件（有的事真机上能直接认，模拟机上只能换个办法做，比如“几个键同时按”）
      d = [live ? t.live : null, t.sim, t.detect].find((x) => canWatch(model, x)) || null;
      if (d) {
        unwatch.push(watchModel(model, d, done, onProgress));
        watching = true;
      }
    }
    // 接了真机但读不到它的状态（浏览器没给 SysEx 权限）：退回到只听它主动发来的消息
    if (!watching && midi.connected && !live && t.detect && DEVICE_KINDS.has(t.detect.kind)) {
      unwatch.push(watchDevice(t.detect, done, onProgress));
      watching = true;
    }
    progress.textContent = !watching ? (midi.connected && (t.detect || t.sim) ? '这一步机器不会上报：做完后点右边。' : '照着做，然后点右边。')
      : t.detect?.kind === 'connected' ? (t.wait || '等待连接…')
        : live ? `${waitText || '等你操作…'}（在真机上做，屏幕上这台是它的镜子）`
          : (t.wait || '在左边的模拟机上做这一步…');
    // 做偏了的时候给一句提示；连着偏了三回，教练出来问一声
    const nudgeKey = `${env.id}:${env.index}:${i}`;
    const askHelp = `我在做「${String(textOf(i)).replace(/\*\*/g, '').slice(0, 60)}」这一步，没做对，帮我看看可能是哪里出了问题。`;
    let spoke = false; // 这一项里教练已经主动出来过一次了：同一项不再出来第二次
    if (model && d) {
      let off = 0;
      unwatch.push(model.on('event', (e) => {
        const hint = hintFor(d, e, model);
        if (!hint) return;
        progress.innerHTML = rich(hint);
        jiu.oops();
        if (++off === 3 && !spoke) spoke = nudge('试了几回都没对上。先看提示那一行说的是哪里不一样；还是不行，我来帮你看。', { key: `off:${nudgeKey}`, mood: 'cheer', ask: askHelp });
      }));
      // 真机的状态要过一会儿才读回来：读到之后，要是明摆着不对（停在演示曲上、这条轨道不在第 1 段乐句、
      // 选中的不是要操作的那条轨道、旋钮不在第 1 页……），先提醒
      const timer = setTimeout(() => {
        const warn = stateWarning(d, model);
        if (warn) progress.innerHTML = rich(warn);
      }, 900);
      unwatch.push(() => clearTimeout(timer));
    }
    // 这一项 45 秒都没动静：教练出来问一声。“没动静”是真的什么都没按——在机器上按了任何一下都重新计时
    // （原来从进这一项就开始算，一直在点、只是点错的时候，到点了它也说“停了有一会儿”）
    if (watching && t.detect?.kind !== 'connected') {
      let stuck = 0;
      const arm = () => {
        clearTimeout(stuck);
        stuck = setTimeout(() => {
          if (!spoke) spoke = nudge('这一步停了有一会儿了。卡住的话点我，我看看你停在哪儿。', { key: `stuck:${nudgeKey}`, mood: 'cheer', ask: askHelp });
        }, 45000);
      };
      arm();
      if (model) unwatch.push(model.on('event', arm));
      unwatch.push(() => clearTimeout(stuck));
    }
    const manual = h('button', { class: 'btn sm', type: 'button', onclick: done }, watching ? '我已经做了' : '做好了');
    status.replaceChildren(h('span', { class: 'pulse' }), progress, h('span', { class: 'spacer' }), manual);
  }

  // 点啾啾时多出来的两个选项
  const taskText = () => String(current < tasks.length ? textOf(current) : '');
  const plainTask = () => taskText().replace(/\*\*/g, '').replace(/\[([^\]]+)\]/g, '$1');
  const keyName = (id) => controlInfo(id)?.en || id;
  cleanup.push(coach.offer(() => (current >= tasks.length ? [] : [
    ['我卡住了', () => {
      const ids = (model && tasks[current].panel) || [];
      coach.walk([
        { html: `你现在在做：${rich(taskText())}`, mood: 'think', call: 'think' },
        ...(ids.length ? [{ html: ids.length > 1 ? '要按的是这几个，我就在它们上面。' : '要按的是这个，就在我脚下。', act: 'peck', call: 'look' }] : []),
      ], [
        ['还是不行，帮我看看', () => coach.ask(`我在做「${plainTask().slice(0, 60)}」这一步，卡住了，帮我看看可能是哪里出了问题。`), { primary: true }],
        ['好，我再试试', null, { ghost: true }],
      ]);
    }],
    model && tasks[current].panel?.length ? ['示范一下', () => {
      const ids = tasks[current].panel;
      coach.walk([
        ...ids.map((id, k) => ({
          html: `${k === 0 ? (ids.length > 1 ? '看我的：先是' : '看我的：就是') : '然后是'} <b>${keyName(id)}</b>。`,
          point: () => (model?.panel?.el.isConnected ? model.panel.spot([id]) : null),
          act: 'peck', call: 'look',
        })),
        { html: `这一项是：${rich(taskText())}`, mood: 'happy' },
      ], [['轮到我了', null, { primary: true }]]);
    }] : null,
  ])));

  mountBench();
  cleanup.push(() => unpoint?.());
  cleanup.push(stopWatching, stopRefit, () => placeLater.forEach(clearTimeout), () => model?.unmount(), () => introCleanup.splice(0).forEach((f) => f()));
  activate(0);
  if (step.optional) env.setReady(true);
  // 真机中途接上 / 拔掉：换一台陪练的机器，并回到当前这一项
  const connectAt = tasks.findIndex((t) => t.detect?.kind === 'connected');
  cleanup.push(midi.on('state', () => {
    if (pickBench() !== model) mountBench();
    if (connectAt >= 0 && !midi.connected && current > connectAt) {
      // 线被拔了：回到“把机器接上”那一项
      box.classList.remove('done');
      activate(connectAt);
    } else if (current < tasks.length) activate(current);
  }));
  return el;
}

function realtimeHint(chart) {
  const drums = chart.lanes && Object.keys(chart.lanes).length;
  if (drums) {
    return h('div', { class: 'callout tip' }, h('b', { class: 'label' }, '在真机上怎么打鼓'),
      h('span', { html: rich('**按住任意一个鼓轨旋钮**（比如 KICK）的同时**按一下任意一个 Synth key**，进入实时输入模式。之后 7 个 Synth keys 就是 7 面鼓：上排 1 = KICK、2 = SNARE、3 = CLAP，下排 4 = HAT 1、5 = HAT 2、6 = PERC 1、7 = PERC 2。练完用同样的操作退出。') }));
  }
  if (chart.chords) {
    const label = TRACK[chart.chords.track || 'SYNTH2']?.label || 'SYNTH 2';
    return h('div', { class: 'callout tip' }, h('b', { class: 'label' }, '在真机上怎么按和弦'),
      h('span', { html: rich(`先**按一下 ${label} 旋钮**选中它，再把右边桔红色区域那一列旋钮里**从上往下数第 2 个**慢慢转到 “CHORD” 亮。之后一个 Synth key 就是一整个和弦。屏幕上每条轨道写着它是第几个键。`) }));
  }
  return h('div', { class: 'callout tip' }, h('b', { class: 'label' }, '在真机上怎么弹'),
    h('span', { html: rich('先**按一下 SYNTH 1 旋钮**选中它，7 个 Synth keys 就是音阶里的 7 个音。屏幕上每条轨道下面写着它对应第几个 Synth key。') }));
}

function stepGame(step, env, cleanup) {
  const def = typeof step.chart === 'string' ? chartById(step.chart) : step.chart;
  const host = h('div', { class: 'game-host' });
  // 这一步的说明放进音游右边那一栏。读得到真机状态时，音游自己带着“开打之前”的检查和镜像（game-mirror.js）；读不到时退回一段文字说明
  const aside = [...renderBlocks(step.blocks, cleanup), midi.connected && !mirror.available && realtimeHint(def)].filter(Boolean);
  const stages = step.stages || [{ assist: 'demo' }, { assist: 'guide', pass: 0.6 }, { assist: 'solo', pass: 0.6 }];
  let best = 0;
  let fails = 0; // 连着没过的局数
  const panel = mountGame(host, { ...def, title: step.gameTitle || def.title }, {
    stages,
    speed: step.speed,
    fill: true,
    aside,
    onResult: (r) => {
      best = Math.max(best, r.stars);
      env.stars(best);
      if (panel.passed()) env.setReady(true);
      // 连着两局没过：结算卡片上的话说完之后，教练再出来提一句（打着的时候它不出来）
      fails = r.passed ? 0 : fails + 1;
      if (fails === 2) setTimeout(() => nudge('连着两局没过。把右边的速度调到 70% 再来，打稳了再提回去；想听我细说就点我。', { key: `slow:${env.id}:${env.index}`, mood: 'cheer', ask: '这个练习我连着两局没过，告诉我最该先改的一点，以及怎么练。' }), 1800);
    },
    onPass: () => {
      env.setReady(true);
      env.next();
    },
  });
  cleanup.push(() => panel.destroy());
  return h('div', { class: 'step-body fill' }, host);
}

/** 小测：一次只摆一题。选项是一排键帽，按下去马上知道对错；答对了才出“下一题”。全部答对才能继续。 */
function stepQuiz(step, env, cleanup) {
  const player = new LoopPlayer();
  cleanup.push(() => player.stop());
  const total = step.questions.length;
  const solved = step.questions.map(() => false);
  const show = (i) => items.forEach((item, j) => (item.hidden = j !== i));
  const items = step.questions.map((q, qi) => {
    const explain = h('div', { class: 'quiz-explain' });
    const more = h('button', { class: 'btn primary', type: 'button', onclick: () => show(qi + 1) }, '下一题 →');
    more.hidden = true;
    let wrongs = 0;
    const options = q.options.map((text, oi) => {
      const btn = h('button', { class: 'quiz-opt', type: 'button', dataset: { sfx: 'none' } }, h('i', {}, 'ABCDEF'[oi] || ''), h('span', { html: rich(text) }));
      btn.addEventListener('click', () => {
        const right = oi === q.answer;
        btn.classList.add(right ? 'right' : 'wrong');
        explain.className = `quiz-explain ${right ? 'right' : 'wrong'}`;
        explain.innerHTML = right ? rich(`✓ ${q.explain || '对了。'}`) : rich(q.wrong?.[oi] || '不是这个，再想想。');
        if (right) {
          solved[qi] = true;
          options.forEach((b) => (b.disabled = true));
          sfx.play('ok');
          confetti(btn, 10, { spread: 90 });
          setCoachMood('happy', 1400);
          more.hidden = qi >= total - 1;
          if (solved.every(Boolean)) env.setReady(true);
        } else {
          btn.disabled = true; // 按错的那个灰掉，剩下的接着选
          sfx.play('nope');
          retrigger(btn, 'shake');
          if (++wrongs === 2) nudge('这题绕住了？点我，我换个说法讲给你。', { key: `quiz:${env.id}:${env.index}:${qi}`, mood: 'cheer', ask: `这道小测我没想明白：「${String(q.q).replace(/\*\*/g, '').slice(0, 80)}」。别直接说答案，换个说法给我讲讲该怎么想。` });
        }
      });
      return btn;
    });
    const listen = q.play && h('div', { class: 'row', style: { marginBottom: '12px' } },
      (Array.isArray(q.play) ? q.play : [q.play]).map((p) => h('button', {
        class: 'btn', type: 'button', dataset: { sfx: 'none' },
        onclick: () => {
          player.stop();
          player.bpm = p.bpm || 100;
          player.swing = p.swing || 0;
          player.steps = p.steps || 16; // 两小节的例子写 steps: 32
          player.set(p.tracks || {}, p.notes || [], p.voice || 'bass');
          player.start();
          setTimeout(() => player.stop(), (p.seconds || 5) * 1000);
        },
      }, `▶ ${p.label || '听一听'}`)));
    const item = h('div', { class: 'quiz-item' },
      total > 1 && h('div', { class: 'quiz-n' }, `第 ${qi + 1} 题 / 共 ${total} 题`),
      h('div', { class: 'quiz-q', html: rich(q.q) }), listen, h('div', { class: 'quiz-opts' }, options), explain, more);
    item.hidden = qi !== 0;
    return item;
  });
  return h('div', { class: 'step-body quiz' }, renderBlocks(step.blocks, cleanup), items);
}

const isDrumTrack = (t) => TRACK[t]?.kind === 'drum';

/** 某台机器（模拟机或真机镜像）上现在的内容，按轨道读成节奏串。 */
const benchPattern = (model, tracks) => Object.fromEntries(tracks.map((t) => [t, stepsToPattern(model.stepsOf(t) || [])]));

/** 编程挑战：把目标节奏编进机器（模拟机或真机），应用来核对。 */
function stepProgram(step, env, cleanup) {
  const tracks = step.tracks || Object.keys(step.target);
  const bpm = step.bpm || 100;
  const player = new LoopPlayer({ bpm, swing: step.swing || 0 });
  cleanup.push(() => player.stop());

  const targetBoard = step.hidden ? null : patternBoard({ tracks, pattern: step.target, caption: '目标' });
  const single = tracks.length === 1 ? tracks[0] : null;
  const targetKeys = single && !step.hidden ? Object.keys(patternToLit(step.target[single])) : [];
  const result = h('div', { class: 'task-status' });
  const tipLine = h('p', { class: 'small muted prog-tip' }); // 在这台机器上怎么编（模拟机和真机的说法不一样，由下面摆机器的地方填）
  const host = h('div', { class: 'prog-main' });
  const nowHost = h('div', { class: 'prog-now-host' }); // 机器上现在编成了什么样（放在目标下面，上下对着看）
  // 左边：机器；右边：说明、目标（能听）、现在的、核对的结果
  const el = h('div', { class: 'step-body split' },
    host,
    h('div', { class: 'prog-side' },
    renderBlocks(step.blocks, cleanup),
    h('div', { class: 'widget prog-target' },
      h('div', { class: 'row', style: { marginBottom: '6px' } },
        h('button', {
          class: 'btn', type: 'button',
          onclick: () => {
            player.stop();
            // step.listen = “听目标”时放什么（合成器轨的目标只有位置，要另外给出音来：{ tracks, notes, voice }）
            player.set(step.listen?.tracks ?? step.target, step.listen?.notes || [], step.listen?.voice || 'bass').onStep((s) => targetBoard?.setHead(s));
            player.start();
            setTimeout(() => player.stop(), (60 / bpm) * 4 * 2 * 1000 + 100);
          },
        }, step.hidden ? '▶ 听目标（可以反复听）' : '▶ 听一听目标'),
        h('span', { class: 'muted small' }, `${bpm} BPM · ${step.hidden ? '这次不给你看答案，靠耳朵' : '亮着的格子 = 有声音的步'}`),
      ),
      targetBoard?.el,
    ),
    nowHost,
    result,
    tipLine,
    ),
  );

  let solved = false;
  let failedChecks = 0; // 自己点“检查”却没过的次数：听写题一次都没有，就是“一次过”（徽章“金耳朵”用）
  let diffShown = '';
  const showDiff = (r) => {
    const sig = `${r.missing}|${r.extra}`;
    if (sig === diffShown) return;
    diffShown = sig;
    const parts = [];
    if (r.missing) parts.push(`少了 ${r.missing} 个（空心框的位置）`);
    if (r.extra) parts.push(`多了 ${r.extra} 个（红色的格子）`);
    result.replaceChildren(h('span', { class: 'pulse' }), `还差一点：${parts.join('，')}。`);
  };
  /**
   * step.keys = 位置之外还想顺便看一眼的：每一步放的是第几个 Synth key，例如 { SYNTH2: { 0: 1, 8: 6 } }。
   * 位置对了就算过关；键不对只是提醒一句（now = 机器上现在每一步是第几个键，认不出的步不说）。
   */
  const keyNotes = (now) => {
    const off = [];
    for (const [t, want] of Object.entries(step.keys || {})) {
      for (const [s, k] of Object.entries(want)) {
        const got = now?.[t]?.[s];
        if (got && got !== k) off.push(`${TRACK[t].label} 第 ${Number(s) + 1} 步放的是键 ${got}，谱子上是键 ${k}`);
      }
    }
    return off;
  };
  const finish = (board, keysNow, manual = false) => {
    const r = board.mark(step.target);
    if (r.ok) {
      if (!solved && step.hidden && !failedChecks) store.noteFeat('dictationAce');
      if (!solved) {
        // 编对了：一声、一把彩带，教练高兴一下
        sfx.play('star');
        setCoachMood('happy', 2600);
        confetti(result, 28);
      }
      solved = true;
      const off = keyNotes(keysNow);
      result.replaceChildren(h('span', { class: 'pulse', style: { background: 'var(--lamp-ok)', animation: 'none' } }),
        h('span', { style: { color: 'var(--ok)' } }, off.length ? '位置全对，过关。' : step.done || '完全一致！'),
        off.length ? h('span', { style: { marginLeft: '8px' }, html: rich(`不过，${off.join('；')}。想改：把那一步按灭，按一下对的 Synth key，再把它按亮。`) }) : '');
      env.stars(3);
      env.setReady(true);
    } else {
      // 自己点“检查”两回都没过：教练出来问一声
      if (manual && ++failedChecks === 2) {
        nudge(step.hidden ? '听不出来的话，多放几遍目标，先只数底鼓落在第几拍。要不要我带你数一遍？' : '差在哪儿图上标着：空心框是少了的，红的是多出来的。还是对不上就点我。',
          { key: `prog:${env.id}:${env.index}`, mood: 'cheer', ask: '这个编程挑战我核对了两次都没过，帮我看看这个节奏该怎么数。' });
      }
      diffShown = '';
      showDiff(r);
    }
    return r.ok;
  };

  let teardown = () => {};

  // 在屏幕上陪练的那台机器上编：模拟机，或者真机的实时镜像（鼓轨的格子读得出来，你在机器上改一格，这里就跟着变）
  function mountBench(model) {
    const live = model === mirror;
    const board = patternBoard({ tracks, caption: live ? '真机上现在的（实时）' : '模拟机上现在的' });
    const warn = h('div', { class: 'callout warn', style: { display: 'none' } });
    let warned = null;
    let shown = '';
    const keysOnBench = () => Object.fromEntries(tracks.map((t) => [t, model.keysOf?.(t) || {}])); // 只有模拟机报得出每一步是第几个键
    const refresh = () => {
      const w = demoWarning(model);
      if (w !== warned) {
        warned = w;
        warn.style.display = w ? '' : 'none';
        warn.replaceChildren(h('b', { class: 'label' }, '先翻到练习本'), h('span', { html: rich(w || '') }));
      }
      const pat = benchPattern(model, tracks);
      const ready = !live || tracks.every((t) => model.stepsOf(t)); // 真机的格子要过一会儿才读全
      const sig = JSON.stringify([pat, ready, solved]);
      if (sig === shown) return; // 内容没变：上一次“检查”留下的标记先留着
      shown = sig;
      board.set(pat);
      if (solved) {
        board.mark(step.target);
        return;
      }
      if (!ready) return;
      // 每改一格就核对一次：全对了自动过关。真机上（听写题除外）还会一直标出差在哪：空心框 = 少了，红格 = 多了
      const r = board.mark(step.target);
      if (r.ok) finish(board, keysOnBench());
      else if (step.hidden || !live) board.clearMarks();
      else showDiff(r);
    };
    const off = model.on('event', refresh);
    const timer = setInterval(refresh, 400);
    const benchEl = model.mount({ tips: false });
    model.highlight(single ? [single, ...targetKeys] : tracks);
    // 镜头只对着要用的那一块：这几条轨道的旋钮和 16 个步进键（合成器轨还要用 Synth keys）
    const view = benchView(() => model.panel, () => [...tracks, 'DRUMKEYS', ...(tracks.every(isDrumTrack) ? [] : ['SYNTHKEYS'])], null, () => fitView(host, PROG_VIEW, 80));
    view.dock(benchEl);
    view.apply();
    const refit = setTimeout(() => view.apply(), 0); // 挂到页面上之后量得到高矮了，再取一次景
    refresh();
    tipLine.textContent = live
      ? '在真机上：先按轨道旋钮选中它，再按亮步进键。每改一格，上面“现在的”那一排都会跟着变，全对了自动过关。'
      : '在左边的模拟机上先点轨道旋钮选中它，再按亮步进键；想听就点“看整台”，短按左下角的 [PLAY]。接上真机后，左边会变成真机的实时镜像。';
    host.append(
      warn,
      h('div', { class: 'do-machine' }, benchEl),
      step.legend ? h('div', { class: 'panel-legend', html: rich(step.legend) }) : '',
    );
    nowHost.replaceChildren(h('div', { class: 'widget prog-now' },
      board.el,
      h('div', { class: 'row', style: { marginTop: '10px' } },
        h('button', { class: 'btn primary', type: 'button', onclick: () => { board.set(benchPattern(model, tracks)); finish(board, keysOnBench(), true); } }, '检查'))));
    teardown = () => {
      off();
      clearTimeout(refit);
      clearInterval(timer);
      model.unmount();
    };
  }

  // 真机上合成器轨的格子读不出来：让机器播一遍，把它发出来的音还原成网格
  function mountPlayback() {
    const panel = single && !step.hidden ? createPanel({ highlight: [single, 'DRUMKEYS'], lit: patternToLit(step.target[single], step.litColor || 'yellow') }) : null;
    const board = patternBoard({ tracks, caption: '真机上现在的（播放时更新）' });
    const show = (snap) => {
      board.set(Object.fromEntries(tracks.map((t) => [t, stepsToPattern(snap[t])])));
      if (solved) board.mark(step.target);
    };
    const pm = new PatternMirror(16).attach();
    pm.on('update', () => show(pm.live()));
    pm.on('step', (s) => board.setHead(s));
    const offStop = midi.on('stop', () => board.setHead(-1));
    // 机器播出来的每一步是第几个 Synth key：看那一步最低的音落在音阶的第几个键上（和弦的最低音就是那个键本来的音）
    const keysPlayed = () => {
      const sk = { scale: seqtrak.state.scale, key: seqtrak.state.key };
      const roots = [1, 2, 3, 4, 5, 6, 7].map((k) => chordNotes(k, sk)[0] % 12);
      return Object.fromEntries(Object.entries(pm.notes()).map(([t, row]) => [t, Object.fromEntries(Object.entries(row).map(([s, ns]) => [s, roots.indexOf(ns[0] % 12) + 1]))]));
    };
    // 你自己按 [PLAY] 播放时：每播完一圈自动核对一次
    pm.on('loop', (loop) => {
      if (loop >= 1 && !solved) {
        show(pm.snapshot(loop - 1));
        finish(board, keysPlayed());
      }
    });
    const check = h('button', { class: 'btn primary', type: 'button' }, '让机器播一遍并检查');
    check.addEventListener('click', async () => {
      check.disabled = true;
      player.stop();
      try {
        show(await seqtrak.capture({ steps: 16 }));
        finish(board, keysPlayed(), true);
      } catch (e) {
        toast(e.message, 'bad', 4000);
      }
      board.setHead(-1);
      check.disabled = false;
    });
    panel?.focus([single, 'DRUMKEYS'], PROG_VIEW);
    tipLine.textContent = '合成器轨的格子机器不上报，所以要播一遍来核对。也可以自己按 [PLAY]：每播完一小节，这里会自动核对。';
    host.append(panel ? h('div', { class: 'do-machine' }, panel.el, h('div', { class: 'panel-legend', html: rich(step.legend || `先按一下 ${TRACK[single].label} 旋钮选中它，再把图上亮着的 Drum keys 按亮。`) })) : '');
    nowHost.replaceChildren(h('div', { class: 'widget prog-now' },
      board.el,
      h('div', { class: 'row', style: { marginTop: '10px' } }, check)));
    teardown = () => {
      pm.detach();
      offStop();
    };
  }

  const remount = () => {
    teardown();
    clear(host);
    clear(nowHost);
    const model = bench();
    if (midi.connected && (model !== mirror || !tracks.every(isDrumTrack))) mountPlayback();
    else mountBench(model);
  };
  remount();
  cleanup.push(midi.on('state', remount), () => teardown());
  return el;
}

/** 自由创作：做一个自己的节奏，交给教练点评。 */
function stepFree(step, env, cleanup) {
  const tracks = step.tracks || ['KICK', 'SNARE', 'CLAP', 'HAT1', 'HAT2'];
  const model = bench();
  const live = model === mirror;
  const board = patternBoard({ tracks, caption: live ? '真机上现在的（实时）' : '模拟机上现在的' });
  const refresh = () => board.set(benchPattern(model, tracks));
  // 左边是机器：镜头对着这次要用的轨道旋钮、步进键和 [PLAY]（用到合成器轨的话还有 Synth keys）
  const machine = model.mount({ tips: false });
  const col = h('div', { class: 'prog-main' }, h('div', { class: 'do-machine' }, machine));
  const lookAt = [...tracks, ...(step.synthTracks || []), 'DRUMKEYS', 'PLAY', ...(step.synthTracks?.length ? ['SYNTHKEYS'] : [])];
  const view = benchView(() => model.panel, () => lookAt, null, () => fitView(col, PROG_VIEW, 80));
  view.dock(machine);
  view.apply();
  const refit = setTimeout(() => view.apply(), 0);
  const timer = setInterval(refresh, 400);
  cleanup.push(model.on('event', refresh), () => clearInterval(timer), () => clearTimeout(refit), () => model.unmount());
  refresh();

  // step.synthTracks = 这次创作里还用到了哪几条合成器轨。它们放了什么，模拟机读得出来；
  // 真机读不出（合成器轨的格子机器不上报），就请学生自己写一句，一起交给教练
  const synthTracks = step.synthTracks || [];
  const synthLines = () => synthTracks.map((t) => {
    const keys = model.keysOf?.(t);
    const parts = Object.entries(keys || {}).map(([s, k]) => `第${Number(s) + 1}步=键${k || '?'}`);
    return parts.length ? `${TRACK[t].label}（${POLY_MODES[model.polyOf(t)]?.name || ''}）${parts.join('，')}` : null;
  }).filter(Boolean);
  const note = synthTracks.length && live ? h('input', { class: 'input', type: 'text', maxlength: '160', placeholder: step.notePlaceholder || '例如：和弦 1 6 3 7，每两拍换一个；贝斯跟着弹根音' }) : null;

  const ask = h('button', { class: 'btn primary', type: 'button' }, '请啾啾点评');
  ask.addEventListener('click', () => {
    refresh();
    const lines = Object.entries(board.get()).filter(([, v]) => v.includes('x')).map(([k, v]) => `${k} ${v}`);
    const synth = synthLines();
    const said = note?.value.trim() || '';
    if (!lines.length && !synth.length && !said) {
      toast('先做点什么出来再叫啾啾。', '', 3000);
      return;
    }
    const parts = [
      lines.length ? `学生自己写的节奏（x=有音，-=空，一小节 16 步）：\n${lines.join('\n')}` : '',
      synth.length ? `合成器轨上放的（第几步放了第几个 Synth key；C 小调，CHORD 轨上一个键是一个和弦）：\n${synth.join('\n')}` : '',
      said ? `学生自己对合成器轨的描述（真机上合成器轨的内容应用读不出来）：${said}` : '',
    ].filter(Boolean);
    ctx.detail = `${ctx.detail}\n${parts.join('\n')}`.slice(-2400);
    store.noteFeat('ownBeat'); // 写出了自己的东西（徽章“原创”用）
    coach.ask(step.ask || '这是我自己写的节奏，请你点评：它像哪种风格？哪里可以更好听？只给一条最值得试的修改建议。', { note: true });
    env.setReady(true);
  });
  const skip = h('button', { class: 'btn ghost', type: 'button', onclick: () => env.setReady(true) }, '先跳过');
  return h('div', { class: 'step-body split' },
    col,
    h('div', { class: 'prog-side' },
    renderBlocks(step.blocks, cleanup),
    h('div', { class: 'widget prog-now' },
      board.el,
      note && h('div', { style: { marginTop: '14px' } },
        h('div', { class: 'label', style: { marginBottom: '6px' } }, '合成器轨上你放了什么（真机不会把它报给应用，写一句给啾啾看）'),
        note),
      h('div', { class: 'row', style: { marginTop: '14px' } }, ask, skip),
    ),
    ),
  );
}

/**
 * 写下来，请啾啾点评（第 6–8 章：编排、排练、演出）。啾啾听不到机器，看的是学生写的：
 * step.blocks 课文，step.fields = [{ label, placeholder }] 几个文本框，step.ask = 发给啾啾的那句话。写了东西点“请啾啾点评”或者“先跳过”都能往下走。
 */
function stepReflect(step, env, cleanup) {
  const fields = (step.fields || [{ label: '写下来', placeholder: '' }]).map((f) => ({
    ...f,
    input: h('textarea', { class: 'input reflect-input', rows: String(f.rows || 3), maxlength: '600', placeholder: f.placeholder || '' }),
  }));
  const ask = h('button', { class: 'btn primary', type: 'button' }, '请啾啾点评');
  ask.addEventListener('click', () => {
    const parts = fields.map((f) => [f.label, f.input.value.trim()]).filter(([, v]) => v);
    if (!parts.length) {
      toast('先写几句再叫啾啾。', '', 3000);
      return;
    }
    ctx.detail = `${ctx.detail}\n学生写的：\n${parts.map(([k, v]) => `${k}：${v}`).join('\n')}`.slice(-2400);
    coach.ask(step.ask || '这是我写下来的，请你点评，只给一条最值得试的建议。', { note: true });
    env.setReady(true);
  });
  const skip = h('button', { class: 'btn ghost', type: 'button', onclick: () => env.setReady(true) }, '先跳过');
  return h('div', { class: 'step-body' },
    ...renderBlocks(step.blocks, cleanup),
    h('div', { class: 'widget reflect' },
      fields.map((f) => h('label', { class: 'reflect-field' }, h('span', { class: 'label' }, f.label), f.input)),
      h('div', { class: 'row', style: { marginTop: '14px' } }, ask, skip)));
}

const RENDERERS = { read: stepRead, tour: stepTour, do: stepDo, findkeys: stepFindKeys, game: stepGame, quiz: stepQuiz, program: stepProgram, free: stepFree, reflect: stepReflect };
const HINTS = { tour: '把导览走完再继续', do: '完成上面的操作后继续', findkeys: '过关后继续', game: '通过练习后继续', quiz: '答对后继续', program: '核对通过后继续' };
// 计分的步骤：做完会得 1–3 颗星的那几种（找按键看对了几题、练习看准确率、编程挑战过了就是三颗）。
// 一节课的星数是这几步里最低的那个，跳过没做的按一颗算（见 finishLesson）
const SCORED = new Set(['findkeys', 'game', 'program']);
// 要动手的步骤一屏放下（左边机器 / 舞台，右边“现在做什么”）；别的步骤（讲解、小测、找按键）是一页往下读的，在页头和“下一步”之间自己滚
const LAYOUT = { do: 'stage', program: 'stage', game: 'stage', tour: 'stage', free: 'stage' };
// 过一节课时教练说的那一句（按星数挑，不问 AI）。星数取的是各个计分步骤里最低的那个，没拿满时点名是哪一步拉低的：
// 各节课计分的步骤不一样（练习、找按键、编程挑战），笼统地说“把练习再打一遍”在没有练习的课上就说错了
const weakStep = (title) => (title ? `「${title}」那一步` : '计分的那几步');
const FINISH_SAY = {
  3: () => '三颗星，每一步都做扎实了。',
  2: (title) => `过了。想把星星补满，把${weakStep(title)}再做一遍就行。`,
  1: (title) => `过了就是过了。回头把${weakStep(title)}再做做，星星会涨。`,
};

// ───────────── 播放器 ─────────────
// 页面不整页滚动：最上面一行（回路线图、课名、一格一步的进度条）和最下面一行（上一步 / 下一步）固定，中间是这一步。

export function lessonView(view, lessonId) {
  const found = findLesson(lessonId);
  if (!found) {
    location.hash = '#/';
    return null;
  }
  const { chapter, lesson, next } = found;
  const back = lesson.back || { href: '#/', label: '← 路线图', done: '回到路线图' }; // 曲目的课回到那首歌的分轨页
  // 曲目的课：左边导航栏亮“曲目”那一格（路由表里课程一律算在“路线图”下面）
  if (back.nav) document.querySelectorAll('.rail a[data-nav]').forEach((x) => x.classList.toggle('active', x.dataset.nav === back.nav));
  const saved = store.lesson(lessonId);
  let index = saved.done ? 0 : clamp(saved.stepIndex || 0, 0, lesson.steps.length - 1);
  let reached = saved.done ? lesson.steps.length - 1 : index;
  let cleanup = [];
  let ready = false;
  let finished = false;
  let enteredAt = 0; // 进到这一步的时刻
  // 计分的步骤各得了几颗星（第几步 → 几颗）。存在进度里，刷新页面、改天接着学都还在
  const starByStep = new Map(Object.entries(saved.stepStars || {}).map(([i, n]) => [Number(i), n]));

  // 这节课在模拟机上用哪个工程（真机上由课文引导你自己切）
  // 曲目的课（simFresh）从第 1 步开始时，模拟机上那个工程先清空：几首歌共用 5 号工程，上一首搭的东西别带进来
  if (Number.isInteger(lesson.simProject) && lesson.simFresh && index === 0) simulator.blankProject(lesson.simProject);
  if (Number.isInteger(lesson.simProject)) simulator.gotoProject(lesson.simProject);
  // 第 4 章：模拟机上这个工程还是空的（没在这一次打开页面时学过第 3 章），先把第 3 章最后那段循环摆进去，拧音色的时候才有东西听
  if (Number.isInteger(lesson.simProject) && lesson.simSeed) simulator.seedProject(lesson.simProject, typeof lesson.simSeed === 'function' ? lesson.simSeed(index) : lesson.simSeed);

  const dots = h('div', { class: 'step-dots' });
  const body = h('div', { class: 'step' });
  const prev = h('button', { class: 'btn ghost', type: 'button', onclick: () => go(index - 1) }, '← 上一步');
  const nextBtn = h('button', { class: 'btn primary lg', type: 'button' });
  const hint = h('span', { class: 'hint' });
  const skip = h('button', { class: 'btn ghost sm', type: 'button', onclick: () => advance(true) }, '跳过这一步');
  nextBtn.addEventListener('click', () => advance(false));

  view.classList.add('fixed');
  const wrap = h('div', { class: 'lesson' },
    h('div', { class: 'lesson-top' }, h('a', { class: 'back', href: back.href }, back.label), h('h2', {}, `${chapter.title} · ${lesson.no} ${lesson.title}`), dots),
    body,
    h('div', { class: 'step-actions' }, prev, hint, h('span', { class: 'spacer' }), skip, nextBtn),
  );
  view.append(wrap);

  function setReady(v) {
    const was = ready;
    ready = v;
    nextBtn.disabled = !v;
    skip.style.display = v ? 'none' : '';
    const type = lesson.steps[index].type;
    // 计分的步骤还没做过：把跳过的代价写在“跳过这一步”旁边
    hint.textContent = v ? '' : `${HINTS[type] || ''}${SCORED.has(type) && !starByStep.get(index) ? ' · 跳过算一颗星' : ''}`;
    // 这一步是你动手做完的（不是一进来就能走的讲解）：“下一步”亮起来的时候蹦一下，告诉你可以走了
    if (v && !was && !finished && performance.now() - enteredAt > 600) retrigger(nextBtn, 'go');
  }

  function advance(force) {
    if (finished) {
      location.hash = next ? `#/lesson/${next.id}` : back.href;
      return;
    }
    if (!ready && !force) return;
    if (index < lesson.steps.length - 1) return go(index + 1);
    finishLesson();
  }

  // 进度条：一格一步，到过的可以点回去。格子画得细，能点到的范围是整条页头那么高
  function renderDots() {
    dots.replaceChildren(...lesson.steps.map((s, i) => h('i', {
      class: i === index ? 'now' : i <= reached ? 'done' : '',
      role: i <= reached ? 'button' : null,
      'aria-label': `第 ${i + 1} 步：${s.title}`,
      onclick: () => i <= reached && go(i),
    })));
  }

  function go(i) {
    index = clamp(i, 0, lesson.steps.length - 1);
    reached = Math.max(reached, index);
    store.setLessonStep(lessonId, index);
    cleanup.splice(0).forEach((f) => f());
    hushNudge();
    clear(body);
    const step = lesson.steps[index];
    ctx.set(`${chapter.title} · ${lesson.no}「${lesson.title}」· 第 ${index + 1}/${lesson.steps.length} 步「${step.title}」（${KIND_LABEL[step.type]}）`, plainText(step));
    ready = false;
    enteredAt = performance.now();
    setReady(false);
    const env = {
      id: lessonId,
      index,
      setReady,
      next: () => advance(false),
      stars: (n) => {
        starByStep.set(index, Math.max(starByStep.get(index) || 0, n));
        store.setStepStars(lessonId, index, starByStep.get(index));
      },
    };
    body.dataset.kind = step.type;
    body.dataset.layout = LAYOUT[step.type] || 'flow';
    body.append(
      h('div', { class: 'step-top' },
        h('div', { class: 'step-kind' }, `${KIND_LABEL[step.type]} · ${index + 1} / ${lesson.steps.length}`),
        h('h1', {}, step.title)),
      RENDERERS[step.type](step, env, cleanup),
    );
    cleanup.push(coach.offer([['这步没懂', () => coach.ask('这一步我没太懂，能换个说法再讲一遍吗？')]]));
    retrigger(body, 'enter');
    prev.style.visibility = index === 0 ? 'hidden' : '';
    nextBtn.textContent = index === lesson.steps.length - 1 ? '完成这一课 ✓' : '下一步 →';
    renderDots();
    body.scrollTop = 0;
  }

  function finishLesson() {
    cleanup.splice(0).forEach((f) => f());
    hushNudge();
    // 星数 = 这节课里计分的步骤中最低的那个；跳过没做的按一颗算（用户定的：原来跳过的不算数，全跳过反而是三颗）。
    // 没有计分步骤的课是三颗。星只涨不降：重学一节以前学完的课，不会比当时拿到的少
    const scored = lesson.steps.map((s, i) => [i, Math.max(1, starByStep.get(i) || 1)]).filter(([i]) => SCORED.has(lesson.steps[i].type));
    const weakest = scored.sort((a, b) => a[1] - b[1])[0]; // [第几步, 几颗星]：星最少的那一步
    const stars = Math.max(saved.done ? saved.stars || 0 : 0, weakest ? weakest[1] : 3);
    // 这节课涨的经验、升没升级、拿没拿徽章，由这一页自己亮出来：记的时候按住全页面的提示条，免得同一件事说两遍
    const before = store.progress();
    const badges = [];
    const offBadge = store.on('badge', (b) => badges.push(b));
    const release = store.hush();
    store.completeLesson(lessonId, stars);
    release();
    offBadge();
    const after = store.progress();
    const reward = { gained: after.xp - before.xp, from: before.level, to: after.level };
    const up = after.level.lv > before.level.lv;
    ctx.set(`刚完成 ${lesson.no}「${lesson.title}」`, lesson.takeaway || '');
    finished = true;

    // 页面上的完成页：两档动效都有。丰富档在它上面再盖一张全屏的庆祝
    clear(body);
    body.dataset.kind = 'done';
    body.dataset.layout = 'flow';
    const xp = xpLine(reward);
    body.append(
      h('div', { class: 'step-top' }, h('div', { class: 'step-kind' }, '完成'), h('h1', {}, `${lesson.no} ${lesson.title} · 拿下`)),
      h('div', { class: 'step-body done' },
        h('div', { class: 'done-top' },
          h('div', { class: 'stars big-stars' }, [0, 1, 2].map((i) => h('span', { class: i < stars ? 'on' : '' }, '★'))),
          h('div', { class: 'done-xp' }, xp.el, up && h('div', { class: 'done-up' }, `升到 Lv ${after.level.lv} ${after.level.name}`))),
        badges.length ? h('div', { class: 'cel-badges' }, badges.map(badgeChip)) : null,
        lesson.takeaway && h('div', { class: 'callout tip' }, h('b', { class: 'label' }, '这节课你带走的'), h('span', { html: rich(lesson.takeaway) })),
        lesson.homework && h('div', { class: 'callout' }, h('b', { class: 'label' }, '下次练习前可以玩玩'), h('span', { html: rich(lesson.homework) })),
      ),
    );
    setTimeout(xp.fill, 80);
    dots.replaceChildren(...lesson.steps.map(() => h('i', { class: 'done' })));
    prev.style.visibility = 'hidden';
    skip.style.display = 'none';
    hint.textContent = '';
    nextBtn.disabled = false;
    nextBtn.textContent = next ? `下一课：${next.no} ${next.title} →` : back.done;

    if (theme.rich) {
      celebrateLesson({
        no: lesson.no, title: lesson.title, stars, ...reward, badges, say: FINISH_SAY[stars](lesson.steps[weakest?.[0]]?.title),
        primary: nextBtn.textContent,
        onPrimary: () => advance(false),
      });
    } else {
      // 克制档：不盖全屏，一声就够
      sfx.play(up ? 'levelup' : badges.length ? 'badge' : 'ok');
      setCoachMood('happy', 3000);
    }
  }

  go(index);
  // 开发用（截图、检查版式）：地址带 ?finish 直接摆出这节课的完成页（丰富档下连同全屏的庆祝）。
  // ?finish 或 ?finish=3：计分的步骤都当作拿了三颗星；?finish=2：都当作两颗；?finish=1：都当作跳过了。
  // 它会把这节课记成学完，所以只在测试数据上用；正式服务（4747，存着真实进度）上不认。
  const dev = new URLSearchParams(location.search);
  if (location.port !== '4747' && dev.has('finish')) {
    const n = clamp(Number(dev.get('finish')) || 3, 1, 3);
    if (n > 1) lesson.steps.forEach((s, i) => SCORED.has(s.type) && starByStep.set(i, n));
    finishLesson();
  }
  return {
    destroy() {
      cleanup.splice(0).forEach((f) => f());
      hushNudge();
      closeCelebration();
      view.classList.remove('fixed');
    },
  };
}
