// 开发测试用（2026-11-15 小课堂丰富版）：把小课堂的一关从头走到尾——玩一玩 → 挑一档 → 挑战（每种题型都会自己答）→ 用在机器上 → 完成。
// 平时应用不会加载它。用法（浏览器控制台，或自动化脚本里）：
//   const w = await import('/js/dev/walk-classroom2.js');
//   await w.run('T2', { tier: 2 });      // 走一关（挑银），返回结果；结果也存在 window.__clWalk2 里
//   w.start(['T1', 'T2'], { tier: 1 });  // 不等它，一关一关走；走完 window.__clWalk2Done = true
//   await w.daily();                     // 走一遍每日五分钟
// 会把关记成学完：只在测试数据上跑（虚拟机里的 4752 / data-dev），不要对着 Mac 上的正式服务（4747）用。
// 结果里：play.touched / named = 玩一玩点亮了没有、名字出来没有；quiz.medal = 拿到第几档的牌；machine.tasks[i].auto = 自己认出来的。
import { install } from './walkthrough.js';
import { audio } from '../audio.js';
import { store } from '../store.js';
import { simulator } from '../simulator.js';
import { mirror } from '../mirror.js';
import { fxsim } from '../classroom-bench.js';
import { levelById, OPEN_LEVELS } from '../content/classroom.js';

const w = install();
const { sleep } = w;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const page = () => $('.cl-lesson, .cl-daily');

async function until(cond, ms = 3000, every = 60) {
  const end = performance.now() + ms;
  for (;;) {
    const v = cond();
    if (v) return v;
    if (performance.now() > end) return false;
    await sleep(every);
  }
}
const ev = (type, node, extra = {}) => node?.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, clientX: 10, clientY: 10, ...extra }));
const press = (node) => {
  ev('pointerdown', node);
  ev('pointerup', node);
};
const tapAtPerf = (perf, fn) => setTimeout(fn, Math.max(0, perf - performance.now()));

// 记下应用排进时钟的声音：拍垫子的几样（T1、R1、R6）要知道拍子落在哪一刻
const sched = [];
let hooked = false;
function hook() {
  if (hooked) return;
  hooked = true;
  const click0 = audio.click.bind(audio);
  const drum0 = audio.drum.bind(audio);
  audio.click = (t, accent) => {
    sched.push({ what: 'click', t, accent: !!accent });
    return click0(t, accent);
  };
  audio.drum = (lane, t, ...rest) => {
    sched.push({ what: lane, t });
    return drum0(lane, t, ...rest);
  };
}
async function nextBeat(match, used, ms = 6000) {
  let found = null;
  await until(() => (found = sched.find((e) => match(e) && !used.has(e) && e.t > audio.now() + 0.05)), ms, 20);
  if (found) used.add(found);
  return found;
}
const padAt = (t) => tapAtPerf(audio.ctxToPerf(t), () => ev('pointerdown', $('.cl-pad')));

/** 竖着的触摸条：推到 v（0–1）。keep = 不松手 */
function strip(node, v, keep = false) {
  const r = (node.querySelector('rect') || node).getBoundingClientRect();
  const pad = node.classList?.contains('fx-strip-track') ? 14 : 0;
  const y = r.top + pad + (r.height - pad * 2) * (1 - v);
  ev('pointerdown', node, { clientY: y });
  if (!keep) ev('pointerup', node, { clientY: y });
}

// ───────────── 玩一玩 ─────────────

async function play() {
  const stage = $('.cl-stage');
  const toy = $('.cl-lesson').toy;
  if (toy?.__autoPlay) {
    // “玩一玩”里分了几小段、要一段一段做到的玩具（2026-11-17 节奏线第一批，classroom-rhythm2.js）：它们自己会做
    const segs = await toy.__autoPlay();
    await sleep(300);
    return { touched: $('.cl-side-foot .btn.lg').classList.contains('primary'), named: !$('.cl-name').hidden, segs };
  }
  $('.cl-play, .fx-play', stage)?.click();
  await sleep(500);
  const strips = $$('.fx-strip-track', stage);
  if (strips.length) {
    strip(strips[0], 0.7);
    await sleep(150);
  }
  // 点几样能点的东西：大部分玩具“动一下”就是点它的键、格子、开关
  const things = $$('.cl-mood button, .cl-skey, .cl-chrom, .cl-wkey, .cl-key, .cl-ptile, .cl-groove, .cl-tl-block[role="button"], .cl-seg button, .fx-ab button, .fx-seg button, .cl-row .btn:not(.cl-play):not(.primary)', stage).slice(0, 6);
  for (const t of things) {
    press(t);
    t.click();
    await sleep(180);
  }
  const range = $('.cl-range', stage);
  if (range) {
    range.value = String(Math.round((Number(range.max) || 58) * 0.6));
    range.dispatchEvent(new Event('input', { bubbles: true }));
  }
  if ($('.cl-pad', stage)) for (let i = 0; i < 3; i++) (ev('pointerdown', $('.cl-pad', stage)), await sleep(120));
  await sleep(400);
  return { touched: $('.cl-side-foot .btn.lg').classList.contains('primary'), named: !$('.cl-name').hidden };
}

// ───────────── 挑战：每种题型怎么答 ─────────────

const passed = () => !!$('.cl-pass') || !!$('.cl-name:not([hidden]) .cl-medal');

async function solveOpts(root) {
  $('.cl-listen', root)?.click();
  await sleep(400);
  const fresh = () => $$('.cl-opt', root).filter((b) => !b.classList.contains('right') && !b.classList.contains('wrong'));
  for (let n = 0; n < 10 && !$('.cl-pass', root); n++) {
    await until(() => fresh().length === $$('.cl-opt', root).length && fresh().length > 0, 4500);
    fresh().find((b) => b.__right)?.click();
    await sleep(450);
  }
}

async function solveOrder(root) {
  for (let n = 0; n < 5 && !$('.cl-pass', root); n++) {
    await until(() => $$('.cl-order-pool .cl-cardbox', root).length > 0, 3000);
    $('.cl-order .btn.primary:not([hidden])', root)?.click(); // 听原句（有的话）
    const boxes = $$('.cl-order-pool .cl-cardbox', root).sort((a, b) => a.__rank - b.__rank);
    for (const b of boxes) {
      $('.cl-card', b)?.click();
      await sleep(120);
      $('.btn', b).click();
      await sleep(80);
    }
    $$('.cl-order .btn.primary', root).find((x) => x.textContent === '对一下')?.click();
    await sleep(2300);
  }
}

async function solveOdd(root) {
  for (let n = 0; n < 6 && !$('.cl-pass', root); n++) {
    await until(() => $$('.cl-cardbox', root).some((b) => b.__odd !== undefined), 3000);
    for (const c of $$('.cl-card', root)) c.click();
    await sleep(300);
    $$('.cl-cardbox', root).find((b) => b.__odd)?.querySelector('.btn').click();
    await sleep(2400);
  }
}

async function solveMemory(root) {
  const cards = $$('.cl-memcard', root);
  const groups = {};
  for (const c of cards) (groups[c.__group] ||= []).push(c);
  for (const pair of Object.values(groups)) {
    pair[0].click();
    await sleep(250);
    pair[1].click();
    await sleep(350);
  }
  await sleep(300);
}

async function solveDict(root) {
  const el = $('.cl-dict', root);
  for (let n = 0; n < 4 && !$('.cl-pass', root); n++) {
    const r = el.__round();
    $('.cl-dict .btn.primary.lg', root)?.click(); // 听题目
    const cells = $$('.cl-dict .cl-key', root);
    const want = r.target.replace(/[^x-]/gi, '').toLowerCase();
    cells.forEach((c, i) => {
      if (c.classList.contains('on') !== (want[i] === 'x')) c.click();
    });
    $$('.cl-dict .btn.primary', root).find((x) => x.textContent === '对一下')?.click();
    await sleep(2900);
  }
}

async function solveEcho(root) {
  const el = $('.cl-echo', root);
  for (let n = 0; n < 6 && !$('.cl-pass', root); n++) {
    const r = el.__round();
    $('.cl-echo .btn.primary', root).click();
    await sleep(r.degrees.length * 450 + 300);
    for (const d of r.degrees) {
      ev('pointerdown', $(`.cl-echo .cl-skey[data-key="${d}"]`, root));
      await sleep(180);
    }
    await sleep(1900);
  }
}

/**
 * 到点了打这一下。临到跟前（半秒以内）才把音频时钟换算成页面时钟：一开局就把整局全排好的话，长一点的谱面（二三十秒以上）
 * 两只钟会漂开几十毫秒（2026-11-18 在虚拟机里量到 24 秒漂 30 多毫秒），打出来就从 PERFECT 掉成 GREAT，金那一档会差一口气
 */
function hitAt(game, t) {
  const wait = audio.ctxToPerf(game.clock.ctxAtBeat(t.beat)) - performance.now();
  if (wait > 500) return setTimeout(() => hitAt(game, t), wait - 400);
  setTimeout(() => game.hit(t.lane, performance.now(), 'keyboard'), Math.max(0, wait));
}

async function solveRhythm(toy) {
  const game = toy.game;
  $$('.game-card .btn.primary').find((b) => /开始/.test(b.textContent))?.click();
  await until(() => game.clock && game.state !== 'idle', 3000);
  for (const t of game.targets) if (!t.rest) hitAt(game, t); // 灰音符（心里数、不许按）不打
  await until(() => game.state === 'done', 60000, 200);
  await sleep(500);
  return { accuracy: Math.round((game.result?.accuracy || 0) * 100), combo: game.result?.maxCombo };
}

async function solveCatch(toy, root) {
  for (let n = 0; n < 6 && !$('.cl-pass', root); n++) {
    $('.cl-dj .btn.primary.lg', root)?.click();
    const t = await until(() => toy.__target, 6000, 40);
    if (!t) continue;
    await new Promise((res) => tapAtPerf(t + 4, () => {
      ev('pointerdown', $('.cl-dj-tap', root));
      res();
    }));
    await sleep(3600);
  }
}

async function solveTransition(toy, root, tier) {
  const need = tier >= 3 ? 2 : 1;
  const P = (tier >= 3 ? 8 : 4) * 16;
  const bass = tier >= 2;
  for (let n = 0; n < need + 1 && !$('.cl-pass', root); n++) {
    const mix = toy.__mix;
    $('.cl-mixer .cl-play', root).click();
    await until(() => mix.player.playing && mix.count > 0, 3000);
    const lows = $$('.cl-low', root);
    if (bass) lows[1].click(); // 先关 B 的低音
    await until(() => mix.count >= P, 40000, 10);
    const fader = $('.cl-xfader', root);
    for (let v = 100; v <= 1000; v += 60) {
      fader.value = String(v);
      fader.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(110);
    }
    fader.value = '1000';
    fader.dispatchEvent(new Event('input', { bubbles: true }));
    if (bass) {
      lows[0].click(); // 关 A
      await sleep(60);
      lows[1].click(); // 开 B
    }
    await until(() => /干净|过关/.test($('.cl-mixer .cl-note', root)?.textContent || ''), 15000, 100);
    await sleep(2200);
  }
}

async function solveBeatmatch(toy, root, tier) {
  const need = tier >= 2 ? 2 : 1;
  const btn = (text) => $$('.cl-match2 .btn', root).find((b) => b.textContent.trim() === text);
  for (let n = 0; n < need + 1 && !$('.cl-pass', root); n++) {
    const { A, B, phase } = toy.__b;
    if (!A.playing) btn('▶ 放').click();
    await sleep(1200);
    for (let k = 0; k < 40 && Math.abs(A.bpm - B.bpm) > 0.05; k++) {
      const d = A.bpm - B.bpm;
      btn(Math.abs(d) >= 0.5 ? (d > 0 ? '+ 快一点' : '− 慢一点') : (d > 0 ? '+0.1' : '−0.1')).click();
      await sleep(30);
    }
    await sleep(900);
    for (let k = 0; k < 14 && Math.abs(phase()) > 15; k++) {
      btn(phase() > 0 ? '◀ 往前' : '往后 ▶').click();
      await sleep(700);
    }
    btn('对上了').click();
    await sleep(600);
  }
}

async function solveKey(toy, root, tier) {
  const need = tier >= 3 ? 3 : tier;
  for (let n = 0; n < need + 1 && !$('.cl-pass', root); n++) {
    const k = toy.__k;
    let target = null;
    for (let s = -6; s <= 6 && target === null; s++) if (k.clashes(s) === 0) target = s;
    const btn = (text) => $$('.cl-keym .btn', root).find((b) => b.textContent.trim() === text);
    for (let i = 0; i < 14 && k.shift !== target; i++) btn(k.shift < target ? '+ 高一格' : '− 低一格').click();
    btn('不打架了').click();
    await sleep(500);
  }
}

async function solveBuild(toy, root) {
  const hp = $$('.cl-build .fx-strip-track', root)[0];
  const rep = $$('.cl-build .fx-strip-track', root)[1];
  $('.cl-build .btn.primary.lg', root).click();
  await until(() => toy.__g >= 64, 20000, 10);
  const r = hp.getBoundingClientRect();
  ev('pointerdown', hp, { clientY: r.bottom - 30 });
  for (let i = 0; i < 12 && toy.__g < 112; i++) {
    ev('pointermove', hp, { clientY: r.bottom - 30 - i * ((r.height - 60) / 12) });
    await sleep(250);
  }
  await until(() => toy.__g >= 112, 10000, 10);
  ev('pointerdown', rep, { clientY: rep.getBoundingClientRect().top + 30 });
  const drop = await until(() => toy.__g >= 120 && toy.__at(128), 10000, 10);
  await new Promise((res) => tapAtPerf(drop + 6, () => {
    ev('pointerup', hp);
    ev('pointerup', rep);
    res();
  }));
  await until(() => /✓|再来一遍|漂亮/.test($('.cl-build .cl-note', root)?.textContent || ''), 8000, 100);
}

async function solveTimed(toy, root, kind) {
  const used = new Set();
  if (kind === 'findone') {
    $('.cl-play', root).click();
    const end = performance.now() + 30000;
    while (!$('.cl-name:not([hidden]) .cl-medal') && performance.now() < end) {
      const b = await nextBeat((e) => e.what === 'click' && e.accent, used);
      if (!b) break;
      padAt(b.t);
      await sleep(400);
    }
  } else if (kind === 'steady') {
    $('.cl-play', root).click();
    const end = performance.now() + 20000;
    while (!$('.cl-meter .dot.keep', root) && performance.now() < end) {
      const b = await nextBeat((e) => e.what === 'click', used);
      if (!b) break;
      padAt(b.t);
      await sleep(120);
    }
  } else if (kind === 'swingtap') {
    $('.cl-play', root).click();
    const beat = 60 / 84;
    const end = performance.now() + 30000;
    while (!/两遍都拍出来了/.test($('.cl-tap .cl-note', root)?.textContent || '') && performance.now() < end) {
      const b = await nextBeat((e) => e.what === 'KICK', used);
      if (!b) break;
      const swung = /晃的/.test($('.cl-phase', root).textContent);
      padAt(b.t);
      padAt(b.t + beat * (swung ? 0.66 : 0.5));
      await sleep(150);
    }
  } else if (kind === 'matchcut') {
    const lab = $('.cl-match .fxlab', root).__lab;
    for (let n = 0; n < 3; n++) {
      $('.cl-match .cl-row .btn.primary', root).click();
      await sleep(400);
      const target = lab.engine.state.amount;
      await sleep(3200);
      strip($('.cl-match .fx-strip-track', root), target);
      await sleep(150);
      $$('.cl-match .cl-row .btn.lg', root)[1]?.click();
      await sleep(300);
    }
  }
  await sleep(800);
}

/** 认出摆着的是哪种题，答掉。返回一点结果 */
async function solve(toy, root, tier) {
  hook();
  await sleep(300);
  if (toy?.__auto) return { theory: await toy.__auto() }; // 乐理台上的新挑战（theory-toys.js）：它们自己会答
  if (toy?.game) return { rhythm: await solveRhythm(toy) };
  if ($('.cl-relay', root)) {
    const out = [];
    for (let i = 0; i < 6; i++) {
      out.push(await solve(toy.__stage, $('.cl-relay-host', root), tier));
      const go = $('.cl-relay-bar .btn.primary', root);
      if (!go) break;
      go.click();
      await sleep(600);
    }
    return { relay: out };
  }
  if ($('.cl-bench', root)) return { bench: await bench($('.cl-lesson').bench) };
  if ($('.cl-order', root)) return (await solveOrder(root), { type: 'order' });
  if ($('.cl-memory', root)) return (await solveMemory(root), { type: 'memory' });
  if ($('.cl-dict', root)) return (await solveDict(root), { type: 'dictate' });
  if ($('.cl-echo', root)) return (await solveEcho(root), { type: 'echo' });
  if ($('.cl-mixer', root)) return (await solveTransition(toy, root, tier), { type: 'transition' });
  if ($('.cl-match2', root)) return (await solveBeatmatch(toy, root, tier), { type: 'beatmatch' });
  if ($('.cl-keym', root)) return (await solveKey(toy, root, tier), { type: 'keymatch' });
  if ($('.cl-build', root)) return (await solveBuild(toy, root), { type: 'buildup' });
  if ($('.cl-dj-tap', root)) return (await solveCatch(toy, root), { type: 'catch' });
  if ($('.cl-cards', root)) return (await solveOdd(root), { type: 'odd' });
  if ($('.cl-opts', root)) return (await solveOpts(root), { type: 'pick' });
  if ($('.cl-match', root)) return (await solveTimed(toy, root, 'matchcut'), { type: 'matchcut' });
  if ($('.cl-steady', root)) return (await solveTimed(toy, root, 'steady'), { type: 'steady' });
  if ($('.cl-tap', root)) return (await solveTimed(toy, root, 'swingtap'), { type: 'swingtap' });
  if ($('.cl-beat.blind', root)) return (await solveTimed(toy, root, 'findone'), { type: 'findone' });
  return { type: '认不出' };
}

// ───────────── 机器（模拟机、效果模拟机、假真机） ─────────────

async function drive(d, task) {
  if (!d) return;
  const sim = $('.cl-bench .sim');
  const node = (id) => $(`.sim [data-id="${id}"]`);
  switch (d.kind) {
    case 'start':
    case 'stop':
      return w.tap('PLAY');
    case 'track':
      return w.tap(d.track || 'HAT1');
    case 'note':
    case 'chord':
      if (d.kind === 'chord' && simulator.polyOf?.(d.track) !== 2) {
        // POLY 弹法下自己叠一摞（乐理线选学的 T35、T36）：一秒之内把这一步圈着的几个键连着点一遍
        for (const id of (task?.panel || ['SK1', 'SK3', 'SK5']).slice(0, d.min || 3)) await w.tap(id);
        return;
      }
      for (let i = 0; i < (d.count || 1); i++) {
        await w.tap(`SK${(i % 7) + 1}`);
        await sleep(200);
      }
      return;
    case 'octave':
      return w.tap('OCTAVE');
    case 'scale':
      for (let i = 0; i < 8 && simulator.proj.scale !== d.scale; i++) await w.tap('SCALE');
      return;
    case 'key':
      if (d.key === undefined) return w.tap('KEY');
      for (let i = 0; i < 12 && simulator.proj.key !== d.key; i++) await w.tap('KEY');
      return;
    case 'steps': {
      const cur = simulator.stepsOf(d.track);
      const flip = [...d.steps.filter((s) => !cur.includes(s)), ...(d.atLeast ? [] : cur.filter((s) => !d.steps.includes(s)))];
      for (const s of flip) await w.tap(`DK${s + 1}`);
      return;
    }
    case 'swing':
      if (!d.zero) return w.tap('SWING');
      await w.hold('DELETE');
      return w.tap('SWING');
    case 'tempo':
      for (let i = 0; i < 40 && (simulator.proj.tempo < d.min || simulator.proj.tempo > d.max); i++) await w.tap(simulator.proj.tempo < d.min ? 'BPM+' : 'BPM-');
      return;
    case 'polymode':
      // 转到要的那一种弹法（0 MONO / 1 POLY / 2 CHORD）：一格一格转，转到为止
      for (let i = 0; i < 6 && simulator.polyOf(d.track) !== d.mode; i++) await w.turn('SD2', simulator.polyOf(d.track) < d.mode ? 1 : -1, 1);
      return;
    case 'metronome':
      await w.hold('ALL');
      return w.tap('BPM+');
    case 'fxlevel':
      return strip(node('FXLEVEL'), 0.7);
    case 'clearfx':
      return w.tap('CLEARFX');
    case 'fxtype':
      for (let i = 0; i < 64 && fxsim.cat[0] !== d.cat; i++) await w.turn('FX', 1, 1);
      return;
    case 'sdpage':
      return w.tap('SDPAGE');
    case 'filter':
      return w.turn('SD3', -1, 4);
    case 'reso':
      return w.turn('SD4', 1, 6);
    case 'highpass':
    case 'repeater': {
      const id = d.kind === 'highpass' ? 'HIGHPASS' : 'REPEATER';
      if (d.release) return ev('pointerup', sim?.querySelector('svg') || node(id));
      return strip(node(id), 0.7, true);
    }
    default:
  }
}

async function bench(b) {
  const tasks = [];
  const n = $$('.cl-bench-dots i').length;
  for (let i = 0; i < n; i++) {
    const level = levelById($('.cl-title .no').textContent);
    const d = level.machine.tasks[i]?.detect;
    let note;
    if (b.current === i) {
      try {
        await drive(d, level.machine.tasks[i]);
      } catch (e) {
        note = String(e.message || e);
      }
    }
    const auto = await until(() => b.current > i, 5000);
    if (!auto) {
      $('.cl-bench-btns .btn:last-child')?.click();
      await sleep(250);
    }
    tasks.push({ kind: d?.kind || '（自己点）', auto: !!auto, ...(note ? { note } : {}) });
  }
  return { model: b.model === mirror ? 'mirror' : b.model === fxsim ? 'fxsim' : 'sim', tasks, finished: b.current >= n };
}

// ───────────── 入口 ─────────────

export async function run(id, { tier = 1, machineStep = true } = {}) {
  if (location.port === '4747') return { id, refused: '这是正式的服务（真实进度），不在这里跑。' };
  const level = levelById(id);
  const out = { id, kind: level.kind, tier };
  const errAt = w.errors.length;
  const t0 = performance.now();
  try {
    location.hash = '#/classroom';
    await sleep(250);
    location.hash = `#/classroom/${id}`;
    await until(() => $('.cl-lesson .cl-stage > *'), 3000);
    if (level.guide) {
      // 跟啾啾学（theory-guide.js）：把每个小步做掉
      out.guide = await $('.cl-lesson').guide.auto();
      $('.cl-side-foot .btn.lg').click();
      await sleep(500);
    } else if (level.play) {
      out.play = await play();
      $('.cl-side-foot .btn.lg').click();
      await sleep(500);
    }
    // 挑一档
    const pill = $(`.cl-tier.t${tier}`);
    if (pill && !pill.classList.contains('on')) {
      pill.click();
      await sleep(400);
    }
    out.quiz = await solve($('.cl-lesson').toy, $('.cl-stage'), tier);
    await until(() => $('.cl-name:not([hidden]) .cl-medal'), 4000);
    const m = $('.cl-name:not([hidden]) .cl-medal');
    out.quiz.medal = m ? Number((m.className.match(/m(\d)/) || [])[1]) : 0;
    out.quiz.say = $('.cl-name:not([hidden])')?.innerText.replace(/\s+/g, ' ').slice(0, 80);
    $('.cl-side-foot .btn.lg').click();
    await sleep(600);
    if ($('.cl-lesson[data-step="machine"]')) {
      if (machineStep) out.machine = await bench($('.cl-lesson').bench);
      $('.cl-bench-actions .btn.lg')?.click();
      await sleep(1200);
    }
    out.done = !!$('.cl-done');
    out.saved = store.data.classroom?.[id] || null;
    out.links = $$('.cl-done-links .cl-link').length;
  } catch (e) {
    out.crashed = String(e.stack || e).slice(0, 400);
  }
  out.sec = Math.round((performance.now() - t0) / 1000);
  out.errors = w.errors.slice(errAt);
  (window.__clWalk2 ||= {})[`${id}@${tier}`] = out;
  return out;
}

export function start(ids = OPEN_LEVELS.map((l) => l.id), opts = {}) {
  window.__clWalk2Done = false;
  (async () => {
    for (const id of ids) await run(id, opts);
    window.__clWalk2Done = true;
  })();
  return ids;
}

/** 走一遍小本子（2026-11-17 乐理线第二期）：打开最新的一件、放、送到模拟机上按 [PLAY]、再删掉它（点两下才真删） */
export async function works() {
  if (location.port === '4747') return { refused: '这是正式的服务（真实进度），不在这里跑。' };
  const errAt = w.errors.length;
  location.hash = '#/classroom';
  await sleep(250);
  location.hash = '#/classroom/works';
  await until(() => $('.tw-page'), 3000);
  const before = (store.data.works || []).length;
  const out = { before, cards: $$('.tw-card').length };
  if (!before) return { ...out, empty: !$('.tw-empty').hidden, errors: w.errors.slice(errAt) };
  $('.tw-card').click();
  await sleep(300);
  out.title = $('.tw-title b')?.textContent;
  out.notes = $$('.tw-stage .tr-n').length;
  $('.tw-stage header .btn.primary').click();
  await sleep(500);
  out.playing = $('.tw-page').works.bench.busy;
  $$('.tw-stage header .btn')[1].click();
  await sleep(500);
  out.sim = !!$('.tw-sim .sim');
  out.simSteps = { SYNTH1: simulator.stepsOf('SYNTH1').length, SYNTH2: simulator.stepsOf('SYNTH2').length, DX: simulator.stepsOf('DX').length };
  await w.tap('PLAY');
  await sleep(900);
  out.simPlaying = simulator.playing;
  await w.tap('PLAY');
  $('.tw-card .btn').click();
  await sleep(120);
  out.armed = $('.tw-card .btn').textContent;
  $('.tw-card .btn').click();
  await sleep(250);
  out.after = (store.data.works || []).length;
  out.errors = w.errors.slice(errAt);
  return out;
}

/** 走一遍每日五分钟 */
export async function daily() {
  const errAt = w.errors.length;
  location.hash = '#/classroom';
  await sleep(250);
  location.hash = '#/classroom/daily';
  await until(() => $('.cl-daily .cl-stage > *'), 3000);
  const items = [];
  for (let i = 0; i < 6 && !$('.cl-daily .cl-done'); i++) {
    const p = $('.cl-daily');
    const r = await solve(p.toy, $('.cl-daily .cl-stage'), 1);
    items.push({ which: $('.cl-daily .cl-do')?.innerText.replace(/\s+/g, ' ').slice(0, 40), ...r, ok: $('.cl-daily-dots i.now')?.className });
    $('.cl-daily .cl-side-foot .btn.lg')?.click();
    await sleep(700);
  }
  return { items, done: !!$('.cl-daily .cl-done'), text: $('.cl-daily .cl-done')?.innerText.replace(/\s+/g, ' ').slice(0, 200), saved: store.data.classroomDaily, errors: w.errors.slice(errAt) };
}
