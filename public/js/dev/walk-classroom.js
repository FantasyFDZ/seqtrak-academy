// 开发测试用：把小课堂的一关从头走到尾（玩一玩 → 试一试 → 用在机器上 → 完成），看有没有卡住、有没有报错。
// 平时应用不会加载它。用法（浏览器控制台，或自动化脚本里）：
//   const w = await import('/js/dev/walk-classroom.js');
//   await w.run('T1');        // 走一关，返回结果；结果也存在 window.__clWalk 里
//   w.start(['T1', 'R1']);    // 不等它，一关一关走；走完看 window.__clWalk（每关 10–40 秒，自动化工具一次等不了那么久时用）
// 地址带 ?fake 时走的是“接着假真机”的那条路（真机镜像）；不带就是模拟机，效果关是效果模拟机。
// 结果里：play.sounds = 玩的时候排了多少个声音；play.fx = 效果实验台上原声和加了效果之后量到的差别；
//   quiz.stars = 小挑战拿了几颗星；tasks[i].auto = 这一项是不是自己认出来打的勾（false = 靠点“我做了”）。
// 拍垫子的那几样（T1、R1、R6）靠真实的时间，要在开着、看得见的浏览器里跑；页面被挡住时定时器会变慢，拍不准。
// 它会把这一关记成学完：只在测试数据上跑，不要对着 Mac 上的正式服务（4747，真实进度）用。
import { install } from './walkthrough.js';
import { audio } from '../audio.js';
import { midi } from '../midi.js';
import { store } from '../store.js';
import { simulator } from '../simulator.js';
import { mirror } from '../mirror.js';
import { fxsim } from '../classroom-bench.js';
import { levelById, OPEN_LEVELS } from '../content/classroom.js';
import { TRACKS } from '../tracks.js';

const w = install();
const { sleep } = w;
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const click = (s) => $(s)?.click();
const trackIndex = (id) => TRACKS.findIndex((t) => t.id === id);

async function until(cond, ms = 3000, every = 60) {
  const end = performance.now() + ms;
  for (;;) {
    if (cond()) return true;
    if (performance.now() > end) return false;
    await sleep(every);
  }
}

// 记下应用排进时钟的每一个声音：既用来数“出声了没有”，也用来知道拍子落在哪一刻，好替学生去拍垫子
const sched = [];
let hooked = false;
function hook() {
  if (hooked) return;
  hooked = true;
  const click0 = audio.click.bind(audio);
  const drum0 = audio.drum.bind(audio);
  const note0 = audio.note.bind(audio);
  audio.click = (t, accent) => {
    sched.push({ what: 'click', t, accent: !!accent });
    return click0(t, accent);
  };
  audio.drum = (lane, t, ...rest) => {
    sched.push({ what: lane, t });
    return drum0(lane, t, ...rest);
  };
  audio.note = (m, t, ...rest) => {
    sched.push({ what: 'note', t });
    return note0(m, t, ...rest);
  };
}

const down = (node, y) => node?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, clientY: y ?? 0 }));
const up = (node) => node?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));

/** 在音频时钟的 t 那一刻拍一下垫子 */
function tapAt(t) {
  const wait = audio.ctxToPerf(t) - performance.now();
  setTimeout(() => down($('.cl-pad')), Math.max(0, wait));
}

/** 等下一个符合条件、还没到的声音（比如下一个重音），返回它的时刻 */
async function nextBeat(match, used, ms = 6000) {
  let found = null;
  await until(() => (found = sched.find((e) => match(e) && !used.has(e) && e.t > audio.now() + 0.05)), ms, 20);
  if (found) used.add(found);
  return found;
}

/** 把一条竖着的触摸条推到 v（0–1） */
function slide(node, v) {
  const r = (node.querySelector('rect') || node).getBoundingClientRect();
  const pad = node.classList?.contains('fx-strip-track') ? 14 : 0;
  down(node, r.top + pad + (r.height - pad * 2) * (1 - v));
  up(node);
}

const energy = (an, from = 0) => {
  const a = new Uint8Array(an.frequencyBinCount);
  an.getByteFrequencyData(a);
  let s = 0;
  for (let i = Math.floor(a.length * from); i < a.length; i++) s += a[i];
  return s;
};

/** 效果实验台：原声和加了效果，各量一阵（整体的能量，和高音那一段的能量） */
async function fxProbe(lab) {
  if (!lab.engine.nodes) return { built: false };
  const measure = async () => {
    let all = 0;
    let high = 0;
    for (let i = 0; i < 16; i++) {
      all += energy(lab.engine.nodes.after);
      high += energy(lab.engine.nodes.after, 0.18);
      await sleep(70);
    }
    return { all: Math.round(all / 16), high: Math.round(high / 16) };
  };
  // 混响、延迟是“另外加进来的一路”：直接在那一路上听一阵，开着的时候该有声音，拨回“原声”该没有
  const an = audio.ctx.createAnalyser();
  lab.engine.nodes.wet.connect(an);
  const wave = new Uint8Array(an.fftSize);
  const peak = async (ms) => {
    let top = 0;
    const end = performance.now() + ms;
    while (performance.now() < end) {
      an.getByteTimeDomainData(wave);
      for (const v of wave) top = Math.max(top, Math.abs(v - 128));
      await sleep(40);
    }
    return top;
  };
  lab.set({ on: true, amount: 0.85 });
  await sleep(500);
  const wet = await measure();
  const added = await peak(2600);
  lab.set({ on: false });
  await sleep(700);
  const dry = await measure();
  const addedOff = await peak(900);
  lab.set({ on: true });
  lab.engine.nodes?.wet.disconnect(an);
  return { built: true, effect: lab.engine.state.effect, wet, dry, changed: wet.all !== dry.all || wet.high !== dry.high, added, addedOff };
}

// ───────────── 玩一玩 ─────────────

async function play(level) {
  const toy = level.play.toy;
  const from = sched.length;
  click('.cl-play') || click('.fx-play');
  await sleep(700);
  const used = new Set();
  if (toy === 'beatwalk') {
    for (let i = 0; i < 2; i++) {
      const b = await nextBeat((e) => e.what === 'click' && e.accent, used);
      if (b) tapAt(b.t);
    }
    await sleep(2600);
    $$('.cl-seg button')[1]?.click();
    $$('.cl-seg button')[0]?.click();
  } else if (toy === 'octaves') {
    for (const i of [0, 4, 7]) {
      down($$('.cl-wkey')[i]);
      await sleep(150);
    }
    click('.cl-oct .cl-row .btn');
  } else if (toy === 'brightdark') {
    for (const i of [1, 0, 1]) {
      $$('.cl-mood button')[i]?.click();
      await sleep(300);
    }
  } else if (toy === 'stack') {
    for (const i of [2, 5, 0]) {
      $$('.cl-skey')[i]?.click();
      await sleep(200);
    }
  } else if (toy === 'steady') {
    for (let i = 0; i < 4; i++) {
      const b = await nextBeat((e) => e.what === 'click', used);
      if (b) tapAt(b.t);
    }
    await sleep(900);
  } else if (toy === 'gridplay') {
    for (const i of [2, 6, 2]) {
      $$('.cl-key')[i]?.click();
      await sleep(150);
    }
  } else if (toy === 'swingfeel') {
    for (const v of [15, 30, 45]) {
      const r = $('.cl-range');
      r.value = String(v);
      r.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(200);
    }
  } else if (toy === 'grooves') {
    for (const c of $$('.cl-groove')) {
      c.click();
      await sleep(600);
    }
  } else if (toy === 'fxlab') {
    slide($('.fx-strip-track'), 0.8);
    await sleep(200);
    $$('.fx-ab button')[0]?.click();
    $$('.fx-ab button')[1]?.click();
    $$('.fx-seg button')[1]?.click();
    $$('.fx-seg button')[0]?.click();
  }
  await sleep(500);
  const lab = $('.cl-stage .fxlab')?.__lab;
  return {
    toy,
    sounds: sched.length - from,
    named: !$('.cl-name').hidden,
    nextLit: $('.cl-side-foot .btn.lg').classList.contains('primary'),
    ...(lab ? { fx: await fxProbe(lab) } : {}),
  };
}

// ───────────── 试一试 ─────────────

async function quiz(level) {
  const toy = level.quiz.toy;
  const used = new Set();
  let note = '';
  if ($('.cl-cards')) {
    for (let n = 0; n < 6 && !$('.cl-pass'); n++) {
      for (const c of $$('.cl-card')) c.click();
      await sleep(250);
      $$('.cl-cardbox').find((b) => b.__odd)?.querySelector('.btn').click();
      await sleep(2200);
    }
  } else if ($('.cl-opts')) {
    click('.cl-listen');
    await sleep(600);
    // 头一题故意答错一次：错了以后换题、再答对，这条路也要走得通
    const fresh = () => $$('.cl-opt').filter((b) => !b.classList.contains('right') && !b.classList.contains('wrong'));
    fresh().find((b) => !b.__right)?.click();
    for (let n = 0; n < 8 && !$('.cl-pass'); n++) {
      await until(() => fresh().length === $$('.cl-opt').length && fresh().length > 0, 4000);
      fresh().find((b) => b.__right)?.click();
      await sleep(400);
    }
  } else if (toy === 'findone') {
    click('.cl-play');
    const end = performance.now() + 22000;
    while ($$('.cl-lamps i.on').length < (level.quiz.need || 4) && performance.now() < end) {
      const b = await nextBeat((e) => e.what === 'click' && e.accent, used);
      if (!b) break;
      tapAt(b.t);
      await sleep(400);
    }
    await sleep(900);
  } else if (toy === 'steady') {
    click('.cl-play');
    const end = performance.now() + 16000;
    while (!$('.cl-meter .dot.keep') && performance.now() < end) {
      const b = await nextBeat((e) => e.what === 'click', used);
      if (!b) break;
      tapAt(b.t);
      await sleep(120);
    }
    await sleep(900);
    note = $('.cl-note')?.innerText.replace(/\s+/g, ' ').slice(0, 90);
  } else if (toy === 'swingtap') {
    click('.cl-play');
    const beat = 60 / (level.quiz.bpm || 84);
    const end = performance.now() + 30000;
    while (!/两遍都拍出来了/.test($('.cl-note').textContent) && performance.now() < end) {
      const b = await nextBeat((e) => e.what === 'KICK', used);
      if (!b) break;
      const swung = /晃的/.test($('.cl-phase').textContent);
      tapAt(b.t);
      tapAt(b.t + beat * (swung ? 0.66 : 0.5));
      await sleep(150);
    }
    note = $('.cl-note')?.innerText.replace(/\s+/g, ' ').slice(0, 90);
  } else if (toy === 'matchcut') {
    for (let n = 0; n < 3; n++) {
      click('.cl-match .cl-row .btn.primary');
      await sleep(3600);
      slide($('.fx-strip-track'), 0.3 + n * 0.25);
      await sleep(150);
      $$('.cl-match .cl-row .btn.lg')[1]?.click();
      await sleep(300);
    }
    note = $('.cl-note')?.innerText.replace(/\s+/g, ' ').slice(0, 90);
  }
  await sleep(300);
  const stars = ($('.cl-name:not([hidden]) .stars')?.textContent.match(/★/g) || []).length;
  return { toy, stars, passed: stars > 0, ...(note ? { note } : {}) };
}

// ───────────── 用在机器上 ─────────────

const report = (addr, data) => midi.simulate([0xf0, 0x43, 0x10, 0x7f, 0x1c, 0x0c, ...addr, ...data, 0xf7]);

/** 照这一项的条件，在摆着的那台机器上把动作做出来 */
async function drive(kind, d, bench) {
  if (!d) return;
  const fake = window.__app.fake;
  const live = kind === 'mirror';
  switch (d.kind) {
    case 'start':
      return live ? fake.play() : w.tap('PLAY');
    case 'stop':
      return live ? fake.stop() : w.tap('PLAY');
    case 'track':
      return live ? fake.selectTrack(trackIndex(d.track || 'HAT1')) : w.tap(d.track || 'HAT1');
    case 'note':
      for (let i = 0; i < (d.count || 1); i++) {
        if (live) fake.synthKey(i + 1, trackIndex(d.track) + 1);
        else await w.tap(`SK${i + 1}`);
        await sleep(160);
      }
      return;
    case 'octave':
      return live ? fake.octave(7, (fake.st.oct[7] || 0) + 1) : w.tap('OCTAVE');
    case 'scale':
      if (live) return fake.scaleKey(d.scale, fake.st.key);
      for (let i = 0; i < 8 && simulator.proj.scale !== d.scale; i++) await w.tap('SCALE');
      return;
    case 'steps': {
      const p = trackIndex(d.track);
      const cur = live ? [...fake.st.steps[fake.st.project][p][fake.st.pat[p]]] : simulator.stepsOf(d.track);
      const flip = [...d.steps.filter((s) => !cur.includes(s)), ...(d.atLeast ? [] : cur.filter((s) => !d.steps.includes(s)))];
      for (const s of flip) {
        if (live) fake.toggleStep(p, s);
        else await w.tap(`DK${s + 1}`);
      }
      return;
    }
    case 'swing':
      if (live) return fake.swing(d.zero ? 0 : 20);
      if (!d.zero) return w.tap('SWING');
      await w.hold('DELETE');
      return w.tap('SWING');
    case 'tempo':
      if (live) return fake.setTempo(124);
      for (let i = 0; i < 40 && (simulator.proj.tempo < d.min || simulator.proj.tempo > d.max); i++) await w.tap(simulator.proj.tempo < d.min ? 'BPM+' : 'BPM-');
      return;
    case 'polymode':
      return live ? fake.polyMode(trackIndex(d.track), d.mode) : w.turn('SD2', 1, 2);
    case 'chord':
      for (let i = 0; i < (d.count || 1); i++) {
        if (live) fake.chordKey(i + 1, trackIndex(d.track) + 1);
        else await w.tap(`SK${i + 1}`);
        await sleep(260);
      }
      return;
    case 'metronome':
      if (live) return; // 真机上节拍器开没开读不出来：这一项就是要自己点“开了”
      await w.hold('ALL');
      return w.tap('BPM+');
    case 'master':
      return; // 效果模拟机一开始就在 MASTER；真机上读不出来
    case 'fxlevel':
      // 真机：照官方的 CC 表发一条控制器消息（主效果的参数 1，通道 1）
      return live ? midi.simulate([0xb0, 102, 90]) : slide($('.sim [data-id="FXLEVEL"]'), 0.7);
    case 'clearfx':
      if (!live) return w.tap('CLEARFX');
      await sleep(700); // 真机：等过了头半秒，再照实测的样子把主效果那块参数报上来
      return report([0x30, 0x43, 0x05], [0]);
    case 'fxtype':
      if (live) return;
      for (let i = 0; i < 64 && fxsim.cat[0] !== d.cat; i++) await w.turn('FX', 1, 1);
      return;
    case 'sdpage':
      return live ? fake.sdPage(d.page) : w.tap('SDPAGE');
    case 'filter':
      return live ? midi.simulate([0xb0 | Math.max(0, fake.st.track), 74, 30]) : w.turn('SD3', -1, 4);
    default:
      return bench;
  }
}

async function machine(level) {
  const bench = $('.cl-lesson').bench;
  const kind = bench.model === mirror ? 'mirror' : bench.model === fxsim ? 'fxsim' : 'sim';
  if (kind === 'mirror') {
    window.__app.fake.setProject(3); // 4 号工程：空白的练习本
    await sleep(1500); // 镜像在换工程后的 1.2 秒里不把变化算成“你的操作”，等它过去
  }
  const tasks = [];
  for (let i = 0; i < level.machine.tasks.length; i++) {
    const d = level.machine.tasks[i].detect;
    let note;
    if (bench.current === i) {
      try {
        await drive(kind, d, bench);
      } catch (e) {
        note = String(e.message || e);
      }
    }
    // 页面在后台时定时器会变慢，镜像读状态也跟着慢：多等一会儿，免得把“认得出”的误记成“靠手点”
    const auto = await until(() => bench.current > i, 6000);
    if (!auto) {
      $('.cl-bench-btns .btn:last-child')?.click();
      await sleep(250);
    }
    tasks.push({ i, kind: d?.kind || '（自己点）', auto, ...(note ? { note } : {}) });
  }
  return { kind, tasks, finished: bench.current >= level.machine.tasks.length, warn: $('.cl-bench-warn')?.style.display !== 'none' };
}

// ───────────── 入口 ─────────────

export async function run(id) {
  hook();
  if (location.port === '4747') return { id, refused: '这是正式的服务（真实进度），走查会把这一关记成学完，不在这里跑。' };
  const level = levelById(id);
  const out = { id, live: mirror.available };
  const errAt = w.errors.length;
  try {
    location.hash = '#/classroom';
    await sleep(250);
    location.hash = `#/classroom/${id}`;
    await until(() => !!$('.cl-lesson .cl-toy'), 3000);
    if (!$('.cl-lesson .cl-toy')) throw new Error('没进到这一关');
    out.play = await play(level);
    click('.cl-side-foot .btn.lg');
    await sleep(500);
    out.quiz = await quiz(level);
    click('.cl-side-foot .btn.lg');
    await until(() => !!$('.cl-bench'), 2000);
    await sleep(500);
    out.machine = await machine(level);
    click('.cl-bench-actions .btn.lg');
    await sleep(1500);
    out.done = !!$('.cl-done');
    out.saved = store.data.classroom?.[id] || null;
  } catch (e) {
    out.crashed = String(e.stack || e).slice(0, 300);
  }
  out.errors = w.errors.slice(errAt);
  (window.__clWalk ||= {})[id] = out;
  return out;
}

/** 一关一关走，不等：走完的结果陆续出现在 window.__clWalk 里，全部走完后 window.__clWalkDone = true */
export function start(ids = OPEN_LEVELS.map((l) => l.id)) {
  window.__clWalkDone = false;
  (async () => {
    for (const id of ids) await run(id);
    window.__clWalkDone = true;
  })();
  return ids;
}
