// 小课堂里能玩的东西：每关的“玩一玩”和“挑战”。内容（每关用哪个、参数是什么）在 content/classroom.js。
// 约定：createToy(spec, env, level) → { el, destroy() }，env 的几样见 classroom-kit.js 开头（env.tier 是铜 1 / 银 2 / 金 3）。
// 这个文件是节奏、效果两条线的几样玩具、关底的接力和入口（createToy、tierSpec）；几种听辨题的骨架在 classroom-ear.js，
// 节奏挑战（音游引擎）在 classroom-rhythm.js，DJ 线在 classroom-dj.js，乐理线的在 theory-toys.js / theory-toys3.js。
// 2026-11-18：没有关在用的老玩具清掉了（乐理线重做之前的那一批、节奏线换掉的几样热身）；有没有新的漏网，跑 tools/toy-check.mjs。
// 都按手指的大小做：能点的东西至少 44 像素，不靠悬停，不靠键盘。声音全是应用自己合成的。
import { h, rich, clamp, mean } from './util.js';
import { audio } from './audio.js';
import { LoopPlayer } from './looper.js';
import { midi } from './midi.js';
import { store } from './store.js';
import { sfx } from './sfx.js';
import { confetti } from './fx.js';
import { createFxLab, FxEngine, ROOMS, ECHOES, EFFECTS } from './fxlab.js';
import {
  pick, shuffle, tapTime, byTier, playButton, tapPad, keys16, listenQuiz, playLoopOnce, starsByWrong, passLine,
} from './classroom-kit.js';
import { orderQuiz, oddQuiz, memoryQuiz, dictateQuiz, askQuiz } from './classroom-ear.js';
import { RHYTHM_TOYS } from './classroom-rhythm.js';
import { DJ_TOYS } from './classroom-dj.js';
import { THEORY_TOYS } from './theory-toys.js';
import { THEORY_TOYS3 } from './theory-toys3.js';

// 公用的小零件（按钮、垫子、16 个格子、放音、“听一听选一个”的骨架）在 classroom-kit.js

// ───────────── R3 听一段，选图案 ─────────────

function pickpattern(spec, env) {
  const player = new LoopPlayer({ bpm: spec.bpm || 104, click: true });
  let i = -1;
  let order = shuffle(spec.rounds);
  const quiz = listenQuiz({
    need: spec.need, env,
    make() {
      i++;
      if (i >= order.length) {
        order = shuffle(spec.rounds);
        i = 0;
      }
      const round = order[i];
      const options = shuffle([round.answer, ...round.others]).map((p) => {
        const g = keys16({ pattern: p, small: true });
        return { node: g.el, right: p === round.answer, grid: g };
      });
      const answer = options.find((o) => o.right);
      player.set({ KICK: round.answer });
      player.onStep((s) => answer.shown && answer.grid.setHead(s));
      let stop = () => {};
      const run = (bars) => {
        stop();
        stop = playLoopOnce(player, bars);
        return () => stop();
      };
      return {
        play: () => run(2),
        options,
        say: { right: '就是这张。再放一遍，看着它走。', wrong: '是亮着绿边的那张。再放一遍，对着图听。' },
        reveal() {
          answer.shown = true;
          run(1);
        },
      };
    },
  });
  return { el: h('div', { class: 'cl-toy cl-pick' }, quiz.el), destroy: () => { quiz.destroy(); player.stop(); } };
}

// ───────────── R6 晃起来 ─────────────

/** 跟着底鼓每拍拍两下：直的一遍，晃的一遍。看的是第二下落在一拍的百分之几 */
function swingtap(spec, env) {
  const bpm = spec.bpm || 84;
  const beat = 60 / bpm;
  const PHASES = [
    { id: 'straight', name: '直的', swing: 0, lo: 0.42, hi: 0.565, how: '两下一样匀：嗒-嗒、嗒-嗒。' },
    { id: 'swung', name: '晃的', swing: 0.3, lo: 0.585, hi: 0.82, how: '第二下晚一点：嗒——嗒、嗒——嗒。' },
  ];
  let phase = 0;
  let guide = spec.guide !== false;
  let retries = 0;
  let beats = [];
  let lastDown = null;
  let pairs = [];
  // 这里把“一步”当成半拍来用：速度减半，摇摆就落在每拍的第二下上
  const player = new LoopPlayer({ bpm: bpm / 2, steps: 8 });
  player.onSchedule = (step, t) => {
    if (step % 2 === 0) {
      beats.push(t);
      if (beats.length > 16) beats.shift();
      audio.drum('KICK', t, 0.9);
    }
    if (guide) audio.drum('HAT1', t, step % 2 ? 0.75 : 0.5);
  };
  const bar = h('div', { class: 'cl-ratio' }, h('i', { class: 'zone' }), h('i', { class: 'tick', style: { left: '50%' } }), h('i', { class: 'tick', style: { left: '66.6%' } }),
    h('span', { style: { left: '50%' } }, '正中间'), h('span', { style: { left: '66.6%' } }, '很晃'));
  const zone = bar.firstChild;
  const title = h('div', { class: 'cl-phase' });
  const say = h('div', { class: 'cl-note' });
  const guideBtn = h('button', { class: 'btn', type: 'button' });
  const paint = () => {
    const p = PHASES[phase];
    player.swing = p.swing;
    title.innerHTML = rich(`第 ${phase + 1} 遍，共 2 遍：拍一遍**${p.name}**`);
    zone.style.left = `${p.lo * 100}%`;
    zone.style.width = `${(p.hi - p.lo) * 100}%`;
    guideBtn.textContent = guide ? '示范的镲：开着' : '示范的镲：关了';
    bar.querySelectorAll('.dot').forEach((d) => d.remove());
    pairs = [];
    lastDown = null;
  };
  guideBtn.addEventListener('click', () => {
    guide = !guide;
    guideBtn.textContent = guide ? '示范的镲：开着' : '示范的镲：关了';
  });

  function judge() {
    const p = PHASES[phase];
    const avg = mean(pairs);
    const pct = Math.round(avg * 100);
    if (avg >= p.lo && avg <= p.hi) {
      sfx.play('ok');
      if (phase === PHASES.length - 1) {
        say.innerHTML = rich(`✓ 第二下平均落在 **${pct}%**：晃起来了。两遍都拍出来了。`);
        confetti(bar, 20);
        env.done(retries === 0 ? 3 : retries <= 2 ? 2 : 1);
        phase = 0;
        const again = h('button', { class: 'btn sm', type: 'button', onclick: () => { retries = 0; paint(); say.textContent = PHASES[0].how; } }, '再来一次');
        say.append(' ', again);
        pairs = [];
        return;
      }
      phase++;
      const was = pct;
      paint();
      say.innerHTML = rich(`✓ 第二下平均落在 **${was}%**：直的。现在换一遍**晃的**：${PHASES[phase].how}`);
    } else {
      retries++;
      sfx.play('nope');
      const tip = p.id === 'straight' ? (avg > p.hi ? '有点晃了。直的要两下一样匀。' : '第二下来得太早了。') : (avg < p.lo ? '还是太直。第二下再等一等。' : '晚过头了，快撞上下一拍了。');
      say.innerHTML = rich(`第二下平均落在 **${pct}%**：${tip}再拍 4 拍。`);
      bar.querySelectorAll('.dot').forEach((d) => d.classList.add('old'));
      pairs = [];
    }
  }

  const padCtl = tapPad('拍', (perfMs) => {
    if (!player.playing || !beats.length) return (say.textContent = '先点「播放」，跟着底鼓拍。');
    audio.drum('PERC1', 0, 0.5);
    const t = tapTime(perfMs);
    const near = beats.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a));
    env.touched();
    if (Math.abs(t - near) <= beat * 0.2) {
      lastDown = t;
      return;
    }
    if (lastDown === null) return;
    const r = (t - lastDown) / beat;
    lastDown = null;
    if (r < 0.25 || r > 0.9) return;
    pairs.push(r);
    bar.append(h('i', { class: 'dot', style: { left: `${r * 100}%` } }));
    if (pairs.length >= 4) judge();
    else say.textContent = `记下了 ${pairs.length} 拍，还要 ${4 - pairs.length} 拍。`;
  }, '每拍两下');

  paint();
  say.textContent = `点「播放」。${PHASES[0].how}`;
  const el = h('div', { class: 'cl-toy cl-tap' },
    h('div', { class: 'cl-row' }, playButton(player), guideBtn, h('span', { class: 'spacer' }), title),
    h('div', { class: 'cl-cap' }, '你的第二下，落在一拍的哪儿（亮的那一段是这一遍的目标）'),
    bar, padCtl.el, say,
  );
  return {
    el,
    destroy() {
      player.stop();
      padCtl.destroy();
    },
  };
}

// ───────────── R8 听律动，猜风格 ─────────────

function guessgroove(spec, env, level) {
  const player = new LoopPlayer();
  let last = '';
  const quiz = listenQuiz({
    need: spec.need, env,
    make() {
      const v = pick(level.variants.filter((x) => x.is !== last));
      last = v.is;
      player.bpm = v.bpm;
      player.swing = v.swing || 0;
      player.set(v.tracks);
      const g = level.grooves[v.is];
      return {
        play: () => playLoopOnce(player, 2),
        options: Object.entries(level.grooves).map(([id, x]) => ({ label: x.name, right: id === v.is })),
        say: { right: `${g.name}：${g.mark}。`, wrong: `这段是 **${g.name}**：${g.mark}。` },
      };
    },
  });
  return { el: h('div', { class: 'cl-toy' }, quiz.el), destroy: () => { quiz.destroy(); player.stop(); } };
}

// ───────────── 效果线：都在效果实验台上 ─────────────

function fxlab(spec, env) {
  const lab = createFxLab({ ...spec.lab, onChange: (_s, what) => what !== 'play' && env.touched() });
  return { el: h('div', { class: 'cl-toy cl-fx' }, lab.el), destroy: () => lab.destroy() };
}

/** 盲听：把旋钮和画面都盖住，只留声音。make() → { patch, options, say } */
function fxQuiz(spec, env, labOpts, make) {
  const lab = createFxLab(labOpts);
  lab.setBlind(true);
  const quiz = listenQuiz({
    need: spec.need, env, stage: lab.el, listenLabel: '▶ 听 / 停',
    make() {
      const r = make();
      lab.set(r.patch);
      lab.setBlind(true);
      return {
        // 循环一直放着；换题时接着放，学生自己点才是“停 / 再放”
        play: (auto) => {
          if (auto) lab.start();
          else lab.engine.toggle();
        },
        options: r.options,
        say: r.say,
        reveal: () => lab.setBlind(false),
      };
    },
  });
  return { el: h('div', { class: 'cl-toy cl-fx' }, quiz.el), destroy: () => { quiz.destroy(); lab.destroy(); } };
}

function drywet(spec, env) {
  return fxQuiz(spec, env, { choices: ['delay', 'reverb', 'lowpass'], loop: 'room' }, () => {
    const on = Math.random() < 0.55;
    const effect = pick(['delay', 'reverb', 'lowpass']);
    return {
      patch: { effect, on, amount: (effect === 'lowpass' ? 0.72 : 0.8) * (spec.subtle || 1), room: 1, echo: 0 },
      options: [{ label: '原声', right: !on }, { label: '加了效果', right: on }],
      say: on
        ? { right: `加了“${EFFECTS[effect].name}”。看画面：彩色比灰色多出来的那部分就是它。`, wrong: `其实加了“${EFFECTS[effect].name}”。看画面：彩色和灰色不一样的地方就是它。` }
        : { right: '是原声：彩色和灰色完全叠在一起。', wrong: '这回是原声，什么都没加：彩色和灰色完全叠在一起。' },
    };
  });
}

function whichroom(spec, env) {
  return fxQuiz(spec, env, { effect: 'reverb' }, () => {
    const room = Math.floor(Math.random() * ROOMS.length);
    return {
      patch: { effect: 'reverb', on: true, amount: 0.8, room },
      options: ROOMS.map((r, i) => ({ label: r.label, right: i === room })),
      say: { right: `是${ROOMS[room].label}。看尾巴拖了多长。`, wrong: `是**${ROOMS[room].label}**。看每一下后面那片彩色拖了多长：越长，房间越大。` },
    };
  });
}

function whichecho(spec, env) {
  return fxQuiz(spec, env, { effect: 'delay' }, () => {
    const echo = Math.floor(Math.random() * ECHOES.length);
    const how = ['回声正好落在底鼓上', '每两下底鼓之间多回来一次', '回声落在底鼓的缝里，一前一后错开着'][echo];
    return {
      patch: { effect: 'delay', on: true, amount: 0.8, echo },
      options: ECHOES.map((e, i) => ({ label: e.label, right: i === echo })),
      say: { right: `${ECHOES[echo].label}：${how}。`, wrong: `是**${ECHOES[echo].label}**：${how}。` },
    };
  });
}

/** 先听目标，再把竖条推到一样闷的地方。三次 */
function matchcut(spec, env) {
  const fxName = spec.effect || 'lowpass';
  const word = spec.word || '闷';
  const tol = spec.tol || 0.13;
  const lab = createFxLab({ effect: fxName, amount: 0, on: true });
  const TARGETS = [[0.3, 0.45], [0.52, 0.68], [0.76, 0.92]];
  let order = shuffle(TARGETS);
  let round = 0;
  let hits = 0;
  let target = 0;
  let previewing = 0;
  const lamps = h('div', { class: 'cl-lamps' });
  const note = h('div', { class: 'cl-note' });
  const hear = h('button', { class: 'btn primary lg', type: 'button' }, '▶ 听目标');
  const here = h('button', { class: 'btn lg', type: 'button', disabled: true }, '就是这儿');
  const marks = [];
  const paintLamps = () => lamps.replaceChildren(...marks.map((ok) => h('i', { class: ok ? 'on' : 'miss' })), ...Array.from({ length: 3 - marks.length }, () => h('i')));

  const endPreview = () => {
    clearTimeout(previewing);
    previewing = 0;
    lab.strip.setDisabled(false);
    lab.scope.setHidden(false);
    lab.set({ amount: lab.strip.value, on: true });
  };
  function start() {
    target = order[round][0] + Math.random() * (order[round][1] - order[round][0]);
    note.textContent = `第 ${round + 1} 次：点「听目标」，记住它有多${word}。`;
    here.disabled = true;
    lab.set({ amount: 0 });
  }
  hear.addEventListener('click', async () => {
    await lab.start();
    clearTimeout(previewing);
    const mine = lab.strip.value;
    lab.strip.setDisabled(true);
    lab.scope.setHidden(true); // 画面上有那条线，看得见就不用听了
    lab.engine.set({ amount: target, on: true });
    note.textContent = '正在放目标…';
    previewing = setTimeout(() => {
      previewing = 0;
      lab.strip.setDisabled(false);
      lab.scope.setHidden(false);
      lab.engine.set({ amount: mine, on: true });
      here.disabled = false;
      note.textContent = `现在是你的。推竖条，推到和刚才一样${word}，再点「就是这儿」。目标可以反复听。`;
    }, 3200);
  });
  here.addEventListener('click', () => {
    if (previewing) endPreview();
    const mine = lab.strip.value;
    const diff = Math.abs(mine - target);
    const ok = diff <= tol;
    marks.push(ok);
    if (ok) hits++;
    sfx.play(ok ? 'ok' : 'nope');
    paintLamps();
    const where = `目标在 ${Math.round(target * 100)}%，你推到了 ${Math.round(mine * 100)}%`;
    round++;
    if (round >= 3) {
      here.disabled = true;
      const stars = hits === 3 ? 3 : hits === 2 ? 2 : 1;
      env.done(stars);
      if (hits >= 2) confetti(lamps, 18);
      note.innerHTML = rich(`${where}。三次里对上了 **${hits}** 次。`);
      const again = h('button', { class: 'btn sm', type: 'button', onclick: () => { round = 0; hits = 0; marks.length = 0; order = shuffle(TARGETS); paintLamps(); start(); } }, '再来三次');
      note.append(' ', again);
      return;
    }
    const lead = ok ? `✓ 很近：${where}。` : `${where}：${mine < target ? `还不够${word}` : `${word}过头了`}。`;
    start();
    note.textContent = `${lead} 下一次：点「听目标」。`;
  });
  paintLamps();
  start();
  const el = h('div', { class: 'cl-toy cl-fx cl-match' }, lab.el, h('div', { class: 'cl-row' }, hear, here, h('span', { class: 'spacer' }), lamps), note);
  return { el, destroy: () => { clearTimeout(previewing); lab.destroy(); } };
}

// ───────────── 2026-11-15 新开的关用的玩具 ─────────────

/** 一个只出声、不带界面的效果引擎：做题时每张牌放两小节就停 */
function fxClip(loop) {
  const engine = new FxEngine({ loop });
  let timer = 0;
  const stop = () => {
    clearTimeout(timer);
    engine.stop();
  };
  return {
    engine,
    play(patch, bars = 2) {
      stop();
      engine.set(patch);
      engine.start();
      timer = setTimeout(stop, (60 / engine.bpm) * 4 * bars * 1000 + 80);
      return stop;
    },
    stop,
    destroy() {
      stop();
      engine.destroy();
    },
  };
}

// ── F4 那一声“喵”：按共鸣排顺序 ──

function resoorder(spec, env) {
  const clip = fxClip('acid');
  const quiz = orderQuiz({ ...spec, each: 4.2 }, env, (n) => {
    const all = [0, 0.3, 0.55, 0.8, 1];
    const amounts = n >= 5 ? all : shuffle(all).slice(0, n).sort((a, b) => a - b);
    const order = shuffle(amounts.map((a, i) => [a, i]));
    return {
      items: order.map(([a]) => ({ tag: '点我听', play: () => clip.play({ effect: 'reso', amount: a, on: true }) })),
      rank: order.map(([, i]) => i),
      ends: ['不喵', '最喵'],
      say: { right: '越往后，滤波器扫过去时那一声“喵——”越尖。' },
    };
  });
  return { el: quiz.el, destroy: () => { quiz.destroy(); clip.destroy(); } };
}

// ── F8 让底鼓先走：哪张在“吸” ──

function duckodd(spec, env) {
  const clip = fxClip('pump');
  const amount = byTier(env.tier, [0.9, 0.75, 0.55]);
  const quiz = oddQuiz({ ...spec, hint: '每张都点一下：哪一张的和弦跟着底鼓一吸一吸？（也可能反过来：只有一张不吸）' }, env, (n) => {
    const odd = Math.floor(Math.random() * n);
    const oddDucks = Math.random() < 0.6;
    return {
      cards: Array.from({ length: n }, (_, i) => ({ play: () => clip.play({ effect: 'duck', amount, on: i === odd ? oddDucks : !oddDucks }) })),
      odd,
      say: oddDucks
        ? { right: '只有它在吸：底鼓一响，和弦就被压下去。', wrong: `是 ${'ABCD'[odd]}：只有它跟着底鼓一吸一吸。` }
        : { right: '别的都在吸，只有它是平的。', wrong: `是 ${'ABCD'[odd]}：别的都在跟着底鼓吸，只有它是平的。` },
    };
  });
  return { el: quiz.el, destroy: () => { quiz.destroy(); clip.destroy(); } };
}

// ── F10 晃动的声音：配对 ──

const MODS = [
  { id: 'tremolo', name: '颤音', say: '音量一抖一抖。' },
  { id: 'flanger', name: '镶边', say: '像飞机从头顶飞过的“嗖——”。' },
  { id: 'chorus', name: '合唱', say: '一个声音变成好几个，宽了、软了。' },
  { id: 'none', name: '原声', say: '什么都没加。' },
  { id: 'drive', name: '失真', say: '毛了、脏了。' },
];
function modmem(spec, env) {
  const clip = fxClip('shimmer');
  const quiz = memoryQuiz(spec, env, (pairs) => ({
    groups: MODS.slice(0, pairs).map((m) => ({ id: m.id, name: m.name, say: m.say, play: () => clip.play({ effect: m.id === 'none' ? 'none' : m.id, amount: 0.8, on: m.id !== 'none' }) })),
  }));
  return { el: quiz.el, destroy: () => { quiz.destroy(); clip.destroy(); } };
}

/** 关底：一段循环放出来，它加的是哪种效果 */
function whichfx(spec, env) {
  const tier = env.tier || 1;
  const pool = byTier(tier, [['lowpass', 'reverb', 'delay'], ['lowpass', 'reverb', 'delay', 'drive'], ['lowpass', 'reverb', 'delay', 'drive', 'tremolo', 'chorus']]);
  return fxQuiz(spec, env, { choices: ['lowpass', 'reverb', 'delay'], loop: 'room' }, () => {
    const effect = pick(pool);
    return {
      patch: { effect, on: true, amount: effect === 'lowpass' ? 0.75 : 0.8, room: 1, echo: 0 },
      options: pool.map((x) => ({ label: EFFECTS[x].name, right: x === effect })),
      say: { right: `是“${EFFECTS[effect].name}”。`, wrong: `是**${EFFECTS[effect].name}**。看画面上彩色和灰色哪里不一样。` },
    };
  });
}

// ── F11 做一次铺垫：演一遍 ──

/** 竖着的“按住才有”的触摸条（HIGH PASS、REPEATER 那种）：手指在上面，值跟着走；一松开就回 0 */
function holdStrip(label, onChange) {
  let v = 0;
  const fill = h('i', { class: 'fx-strip-fill' });
  const thumb = h('i', { class: 'fx-strip-thumb' });
  const read = h('div', { class: 'fx-strip-read' }, '没按');
  const track = h('div', { class: 'fx-strip-track', role: 'slider', tabindex: '0', 'aria-label': label }, fill, Array.from({ length: 7 }, () => h('b')), thumb);
  const paint = () => {
    fill.style.height = `${v * 100}%`;
    thumb.style.bottom = `${v * 100}%`;
    read.textContent = v > 0 ? `${Math.round(v * 100)}%` : '没按';
  };
  const at = (e) => {
    const r = track.getBoundingClientRect();
    v = clamp(1 - (e.clientY - r.top - 14) / (r.height - 28), 0.04, 1);
    paint();
    onChange(v, e.timeStamp);
  };
  let down = false;
  track.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    down = true;
    try {
      track.setPointerCapture(e.pointerId);
    } catch {
      /* 有的输入方式不支持捕获 */
    }
    track.classList.add('touch');
    at(e);
  });
  track.addEventListener('pointermove', (e) => down && at(e));
  const up = (e) => {
    if (!down) return;
    down = false;
    track.classList.remove('touch');
    v = 0;
    paint();
    onChange(0, e.timeStamp);
  };
  track.addEventListener('pointerup', up);
  track.addEventListener('pointercancel', up);
  paint();
  return { el: h('div', { class: 'fx-strip' }, h('div', { class: 'fx-strip-label' }, label), track, read), get value() { return v; } };
}

/**
 * 10 小节：1–4 平常放，5–8 是铺垫（军鼓越来越密），第 9 小节 Drop。
 * 要做的：第 5 小节起按住 [HIGH PASS] 慢慢往上推；第 8 小节按住 [REPEATER]；第 9 小节第 1 拍两只手一起松开。
 * 铜：松手差 1 拍以内就行，重复器可以不用；银：半拍以内，第 8 小节要用重复器；金：1/3 拍以内，还不给看时间线。
 */
function buildup(spec, env) {
  const free = !env.tier;
  const tier = env.tier || 1;
  const tol = free ? 1 : byTier(tier, [1, 0.5, 0.34]);
  const needRep = !free && tier >= 2;
  const showTl = free || tier <= 2;
  const engine = new FxEngine({ loop: 'full' });
  engine.set({ effect: 'none', on: false });
  const TOTAL = 10 * 16;
  let g = -1;
  let log = [];
  let seen = null;
  let release = null;
  let running = false;
  const base = engine.player.onSchedule;
  engine.player.onSchedule = (st, t) => {
    g++;
    if (g >= TOTAL) {
      if (g === TOTAL) setTimeout(finish, 0);
      return;
    }
    base(st, t);
    const bar = Math.floor(g / 16);
    const bus = `${engine.id}:SNARE`;
    // 铺垫：第 7 小节军鼓八分、第 8 小节十六分，越来越响
    if (bar === 6 && g % 2 === 0) audio.drum('SNARE', t, 0.4 + (g % 16) / 40, bus);
    if (bar === 7) audio.drum('SNARE', t, 0.5 + (g % 16) / 30, bus);
    if (g === 8 * 16) {
      audio.drum('CRASH', t, 1, 'drums');
      audio.drum('KICK', t, 1.2, 'drums');
    }
    log[g] = { hp: engine.live.hp, rep: engine.live.rep };
  };
  engine.player.onStep((s) => {
    if (s < 0 || g < 0) return;
    // 听到的是一小节里的第 s 步；排程比听到的早一两步，所以从排到的那一步往回找最近的第 s 步
    const heard = Math.max(0, g - ((((g % 16) - s) % 16) + 16) % 16);
    seen = { step: heard, perf: performance.now() };
    cnt.set(heard);
    tl?.set(heard);
  });
  const at = (step) => (seen ? seen.perf + (step - seen.step) * (60000 / engine.bpm / 4) : null);
  const hp = holdStrip('HIGH PASS', (v, ts) => {
    engine.setLive({ hp: v });
    if (v === 0) release = ts;
    env.touched();
  });
  const rep = holdStrip('REPEATER', (v, ts) => {
    engine.setLive({ rep: v });
    if (v === 0) release = ts;
    env.touched();
  });
  const cnt = (() => {
    const lamps = [1, 2, 3, 4].map((n) => h('i', { class: n === 1 ? 'one' : '' }, String(n)));
    const bar = h('b', {}, '–');
    const el = h('div', { class: 'cl-dj-count' }, h('div', { class: 'cl-beats sm' }, lamps), h('div', { class: 'cl-dj-bar' }, bar, h('small', {}, '/ 10 小节')));
    return { el, set: (step) => { lamps.forEach((l, i) => l.classList.toggle('on', Math.floor(step / 4) % 4 === i)); bar.textContent = String(Math.floor(step / 16) + 1); } };
  })();
  const scenes = [{ name: '平常', kind: 'verse', bars: 4 }, { name: '铺垫：按住 HIGH PASS', kind: 'build', bars: 3 }, { name: 'REPEATER', kind: 'pre', bars: 1 }, { name: 'Drop：松手！', kind: 'drop', bars: 2 }];
  let tl = null;
  const tlBox = h('div', { class: 'cl-tl-box' });
  if (showTl) {
    const total = 10;
    const blocks = scenes.map((sc) => h('div', { class: 'cl-tl-block', style: { flexGrow: String(sc.bars), '--k': ({ verse: '#3fbfa8', build: '#f0b03a', pre: '#4a9fe0', drop: '#ff6b3d' })[sc.kind] } }, h('span', {}, sc.name)));
    const head = h('div', { class: 'cl-tl-head' });
    tlBox.append(h('div', { class: 'cl-tl' }, h('div', { class: 'cl-tl-row' }, blocks), head));
    tl = {
      set(step) {
        head.style.display = step < 0 ? 'none' : 'block';
        head.style.left = `${clamp(step / 16 / total, 0, 1) * 100}%`;
      },
    };
  }
  const play = h('button', { class: 'btn primary lg', type: 'button' }, '▶ 开始（10 小节）');
  const note = h('div', { class: 'cl-note' }, free ? '点「开始」，照着上面的时间线试一遍。' : '点「开始」。第 5 小节起按住 HIGH PASS 往上推，第 8 小节按住 REPEATER，第 9 小节第 1 拍一起松手。');
  const stop = () => {
    running = false;
    engine.stop();
    engine.setLive({ hp: 0, rep: 0 });
    play.textContent = '▶ 开始（10 小节）';
  };
  play.addEventListener('click', async () => {
    if (running) return stop();
    g = -1;
    log = [];
    release = null;
    seen = null;
    running = true;
    await engine.start();
    play.textContent = '■ 停';
    env.touched();
  });
  function finish() {
    if (!running) return;
    const dropPerf = at(8 * 16);
    stop();
    const frac = (from, to, key) => {
      const xs = log.slice(from, to).filter(Boolean);
      return xs.length ? xs.filter((x) => x[key] > 0.03).length / xs.length : 0;
    };
    const avg = (from, to, key) => mean(log.slice(from, to).filter(Boolean).map((x) => x[key]));
    const probs = [];
    if (frac(0, 64, 'hp') > 0.2) probs.push('前 4 小节就按了 HIGH PASS：平常的时候让它原样放');
    // 第 8 小节可以换一只手（鼠标只有一个指针）去按 REPEATER，所以 HIGH PASS 看第 5–7 小节
    if (frac(64, 112, 'hp') < 0.6) probs.push('第 5–7 小节要一直按着 HIGH PASS');
    else if (avg(96, 112, 'hp') < avg(64, 80, 'hp') + 0.08) probs.push('HIGH PASS 要越推越高（第 7 小节比第 5 小节高）');
    if (needRep && frac(112, 128, 'rep') < 0.4) probs.push('第 8 小节要按住 REPEATER');
    // 排程比听到的早一两步：正点松手时，Drop 头一两步排进去的时候手还在上面。所以看 Drop 之后半拍以后还按没按着
    const stillOn = log.slice(131, 136).filter(Boolean).some((x) => x.hp > 0.03 || x.rep > 0.03);
    let beats = null;
    if (release !== null && dropPerf !== null) beats = (release - (store.settings.inputOffsetMs || 0) - dropPerf) / (60000 / engine.bpm);
    if (stillOn || beats === null) probs.push('Drop 来的时候要松手');
    else if (Math.abs(beats) > tol) probs.push(`松手${beats < 0 ? '早' : '晚'}了 ${Math.round(Math.abs(beats) * 10) / 10} 拍（这一档要 ${tol >= 1 ? '1 拍' : tol >= 0.5 ? '半拍' : '1/3 拍'}以内）`);
    if (free) {
      note.innerHTML = rich(probs.length ? `${probs.join('；')}。再来一遍？` : '漂亮：憋住，再一把放开。');
      return;
    }
    if (probs.length) {
      sfx.play('nope');
      note.innerHTML = rich(`${probs.join('；')}。再来一遍。`);
      return;
    }
    sfx.play('star');
    confetti(play, 24);
    const stars = Math.abs(beats) <= 0.25 ? 3 : Math.abs(beats) <= 0.5 ? 2 : 1;
    env.done(stars);
    note.innerHTML = rich(`✓ 铺垫推上去了，松手${Math.abs(beats) < 0.12 ? '正好踩在 Drop 上' : `差 ${Math.round(Math.abs(beats) * 10) / 10} 拍`}。`);
  }
  const el = h('div', { class: 'cl-toy cl-build' },
    h('div', { class: 'cl-row' }, play, h('span', { class: 'spacer' }), cnt.el),
    tlBox,
    h('div', { class: 'cl-build-strips' }, hp.el, rep.el, h('div', { class: 'cl-build-how', html: rich(spec.how || '**HIGH PASS**：按住往上推，低音被抽走，越推越“薄”。\n**REPEATER**：按住，最后那一下被切碎了反复（用鼠标的话，第 8 小节从 HIGH PASS 换过去就行）。\n**松手**：两条都回原样，Drop 一下砸下来。') })),
    note);
  return {
    el,
    // 给走查脚本用：排到第几步了、某一步什么时候被听到
    get __g() {
      return g;
    },
    __at: at,
    destroy() {
      stop();
      engine.destroy();
    },
  };
}

// ── 关底大关：几段接力 ──

/** spec.stages = [{ toy, title, ... }, …]：一段过了才能进下一段；全过了，星星按最差的那一段给 */
function relay(spec, env, level) {
  const stages = spec.stages || [];
  let i = Math.max(0, Math.min(stages.length - 1, (Number(new URLSearchParams(location.search).get('clstage')) || 1) - 1)); // 开发用（截图）：?clstage=3 直接从第 3 段开始
  let got = [];
  let cur = null;
  let extra = ''; // 某一段过关时带的补充的话（见 views/classroom.js 的 award）
  const chips = h('ol', { class: 'cl-relay-chips' });
  const host = h('div', { class: 'cl-relay-host' });
  const bar = h('div', { class: 'cl-relay-bar' });
  const paint = () => chips.replaceChildren(...stages.map((st, j) => h('li', { class: j === i ? 'now' : got[j] ? 'done' : '' }, h('i', {}, got[j] ? '✓' : String(j + 1)), st.title || `第 ${j + 1} 段`)));
  function mount() {
    cur?.destroy();
    const st = stages[i];
    bar.replaceChildren(h('span', { html: rich(st.ask || '') }));
    const sp = tierSpec(st, env.tier);
    if (st.needs) sp.need = byTier(env.tier, st.needs);
    cur = createToy(sp, {
      ...env,
      touched: env.touched,
      done(stars, note) {
        got[i] = Math.max(got[i] || 0, stars);
        if (note) extra = note;
        paint();
        if (i < stages.length - 1) {
          const go = h('button', { class: 'btn primary', type: 'button' }, `下一段：${stages[i + 1].title || ''} →`);
          go.addEventListener('click', () => {
            i++;
            mount();
          });
          bar.replaceChildren(h('span', { class: 'cl-pass' }, `第 ${i + 1} 段过了。`), go);
        } else {
          env.done(Math.min(...got), extra);
          bar.replaceChildren(h('span', { class: 'cl-pass' }, '全部过关！'));
        }
      },
    }, level);
    host.replaceChildren(cur.el);
    paint();
  }
  mount();
  return {
    el: h('div', { class: 'cl-toy cl-relay' }, chips, bar, host),
    get __stage() {
      return cur;
    },
    destroy: () => cur?.destroy(),
  };
}

// ───────────── 入口 ─────────────

const TOYS = {
  pickpattern, swingtap, guessgroove,
  fxlab, drywet, matchcut, whichroom, whichecho,
  // 2026-11-15
  resoorder, duckodd, modmem, whichfx, buildup, relay,
  // 听写节奏图案（R3 的金、节奏大关）
  griddict: (s, e) => dictateQuiz(s, e, () => {
    const pool = s.patterns || ['x---x---x-x-----', 'x-----x---x-----', 'x--x--x---x-----', 'x-------x-x-----', 'x---x---x---x---', 'x-x---x---x---x-'];
    return { target: pick(pool), track: s.track || 'KICK', label: s.label || '底鼓', bpm: s.bpm || 100, bars: 2, backing: s.backing || { HAT1: '--x---x---x---x-' } };
  }),
  ask: (s, e) => askQuiz(s, e),
  ...RHYTHM_TOYS,
  ...DJ_TOYS,
  ...THEORY_TOYS, // 乐理线重做之后的挑战：都在乐理台上做（theory-toys.js）
  ...THEORY_TOYS3, // 第三期：拆歌、大关的四段、选学的两个单元（theory-toys3.js）
};

// 三档的默认规矩：铜 / 银 / 金。新的几种题自己会看 env.tier；老的几种在这里换参数。关里写了 quiz.tiers 的以它为准
const TIER_DEFAULTS = {
  pickpattern: (t) => ({ need: byTier(t, [3, 4, 5]) }),
  guessgroove: (t) => ({ need: byTier(t, [3, 4, 5]) }),
  whichroom: (t) => ({ need: byTier(t, [3, 4, 5]) }),
  whichecho: (t) => ({ need: byTier(t, [3, 4, 5]) }),
  whichfx: (t) => ({ need: byTier(t, [3, 4, 5]) }),
  drywet: (t) => ({ need: byTier(t, [3, 4, 5]), subtle: byTier(t, [1, 0.75, 0.5]) }),
  swingtap: (t) => ({ guide: t < 3 }),
  matchcut: (t) => ({ tol: byTier(t, [0.17, 0.13, 0.09]) }),
};

/** 这一档实际用的参数 */
export function tierSpec(spec, tier) {
  const d = TIER_DEFAULTS[spec.toy]?.(tier || 1) || {};
  const own = spec.tiers ? byTier(tier, spec.tiers) : {};
  return { ...spec, ...d, ...own };
}

export const hasToy = (name) => !!TOYS[name];

export function createToy(spec, env, level) {
  const make = TOYS[spec.toy];
  if (!make) return { el: h('div', { class: 'cl-toy muted' }, `（还没有这个玩具：${spec.toy}）`), destroy() {} };
  return make(spec, env, level);
}
