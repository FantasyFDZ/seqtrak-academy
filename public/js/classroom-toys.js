// 小课堂里能玩的东西：每关的“玩一玩”和“试一试”。内容（每关用哪个、参数是什么）在 content/classroom.js。
// 约定：createToy(spec, env, level) → { el, destroy() }
//   env.touched()      学生动过一下了（玩一玩用：动过几下之后，页面才把这个东西的名字说出来）
//   env.done(stars)    小挑战过关了，给几颗星（1–3）。可以再玩，取最好的一次
//   env.live           是不是接着真机
// 都按手指的大小做：能点的东西至少 44 像素，不靠悬停，不靠键盘。声音全是应用自己合成的。
import { h, rich, clamp, mean, stddev } from './util.js';
import { audio } from './audio.js';
import { LoopPlayer } from './looper.js';
import { midi } from './midi.js';
import { store } from './store.js';
import { sfx } from './sfx.js';
import { confetti, pop } from './fx.js';
import { SCALES, chordNotes, chordMood, synthKeyNotes } from './scales.js';
import { createFxLab, ROOMS, ECHOES, EFFECTS } from './fxlab.js';

// ───────────── 公用的小零件 ─────────────

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
/** 一次敲击落在音频时钟的哪一刻（算上「设备」页校准出来的输入延迟） */
const tapTime = (perfMs) => audio.perfToCtx(perfMs - (store.settings.inputOffsetMs || 0));
const ms = (sec) => Math.round(sec * 1000);

function playButton(player, { onToggle } = {}) {
  const btn = h('button', { class: 'btn primary lg cl-play', type: 'button' }, '▶ 播放');
  const paint = () => (btn.textContent = player.playing ? '■ 停' : '▶ 播放');
  btn.addEventListener('click', () => {
    player.toggle();
    paint();
    onToggle?.(player.playing);
  });
  return Object.assign(btn, { paint });
}

/** 一块大垫子：拍它。手指、鼠标、空格键、真机上的任何一个音都算一下 */
function tapPad(label, onHit, sub = '') {
  const el = h('button', { class: 'cl-pad', type: 'button', 'data-sfx': 'none' }, h('b', {}, label), sub && h('span', {}, sub));
  const hit = (perfMs) => {
    el.classList.add('hit');
    setTimeout(() => el.classList.remove('hit'), 90);
    onHit(perfMs);
  };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    hit(e.timeStamp);
  });
  el.addEventListener('keydown', (e) => {
    if ((e.key !== ' ' && e.key !== 'Enter') || e.repeat) return;
    e.preventDefault();
    hit(e.timeStamp);
  });
  const off = midi.on('noteon', (m) => hit(m.time ?? performance.now()));
  return { el, destroy: off };
}

const pad16 = (p) => String(p || '').replace(/[^xX-]/g, '').toLowerCase().padEnd(16, '-').slice(0, 16);

/** 16 个格子，摆成机器上那两排方键的样子（上排 1–8，下排 9–16）。editable = 可以点 */
function keys16({ pattern = '', editable = false, onChange, small = false } = {}) {
  let p = pad16(pattern);
  const cells = Array.from({ length: 16 }, (_, i) => h(editable ? 'button' : 'i', { class: 'cl-key', type: editable ? 'button' : null, 'data-sfx': 'none', 'aria-label': `第 ${i + 1} 格` }, small ? null : h('span', {}, String(i + 1))));
  const el = h('div', { class: ['cl-keys', small && 'small'] }, cells);
  const paint = () => cells.forEach((c, i) => c.classList.toggle('on', p[i] === 'x'));
  if (editable) {
    cells.forEach((c, i) => c.addEventListener('click', () => {
      p = p.slice(0, i) + (p[i] === 'x' ? '-' : 'x') + p.slice(i + 1);
      paint();
      onChange?.(p, i);
    }));
  }
  paint();
  return {
    el,
    get: () => p,
    set(v) {
      p = pad16(v);
      paint();
    },
    setHead(s) {
      cells.forEach((c, i) => c.classList.toggle('head', i === s));
    },
  };
}

/** 一串音，隔 gap 秒一个地放出来 */
function playNotes(notes, { gap = 0.3, len = 0.42, voice = 'keys', vel = 0.85 } = {}) {
  audio.init().then((ok) => {
    if (!ok) return;
    const t0 = audio.now() + 0.04;
    notes.forEach((n, i) => n !== null && audio.note(n, t0 + i * gap, len, { voice, vel }));
  });
}

/** 几个音一起响；spread = 先一个一个，再一起 */
function playChord(notes, { spread = false, voice = 'keys' } = {}) {
  audio.init().then((ok) => {
    if (!ok) return;
    const t0 = audio.now() + 0.03;
    if (spread) notes.forEach((n, i) => audio.note(n, t0 + i * 0.32, 0.4, { voice, vel: 0.8 }));
    const at = spread ? t0 + notes.length * 0.32 + 0.1 : t0;
    notes.forEach((n, i) => audio.note(n, at + i * 0.012, 1.1, { voice, vel: notes.length > 1 ? 0.55 : 0.85 }));
  });
}

/**
 * “听一听，选一个”的公用骨架。答对 need 题过关；答错不扣分，马上换下一题。星星看错了几次。
 * make() → { play() → 停止函数, options: [{ label 或 node, right }], say: { right, wrong }, reveal?() }
 * stage：摆在题目上面的东西（比如一台实验台）。
 */
function listenQuiz({ need = 3, env, make, stage = null, listenLabel = '▶ 听' }) {
  let right = 0;
  let wrong = 0;
  let round = null;
  let locked = false;
  let stopPlay = () => {};
  let timer = 0;
  let fresh = true;
  const lamps = h('div', { class: 'cl-lamps', 'aria-label': '答对了几题' });
  const listen = h('button', { class: 'btn primary lg cl-listen', type: 'button' }, listenLabel);
  const opts = h('div', { class: 'cl-opts' });
  const note = h('div', { class: 'cl-note' });
  const el = h('div', { class: ['cl-quiz', stage && 'has-stage'] }, stage, h('div', { class: 'cl-quiz-top' }, listen, lamps), opts, note);

  const paintLamps = () => lamps.replaceChildren(...Array.from({ length: need }, (_, i) => h('i', { class: i < right ? 'on' : '' })));
  // auto = 换题之后自己接着放的那一次（不是学生点的）
  const play = (auto) => {
    stopPlay();
    stopPlay = round.play(auto) || (() => {});
  };
  listen.addEventListener('click', () => play(false));

  function next(auto) {
    clearTimeout(timer);
    locked = false;
    round = make();
    opts.replaceChildren(...round.options.map((o) => {
      const btn = h('button', { class: ['cl-opt', o.node && 'card'], type: 'button' }, o.node || o.label);
      btn.addEventListener('click', () => choose(o, btn));
      btn.__right = !!o.right; // 给走查脚本用（dev/walk-classroom.js）
      o.btn = btn;
      return btn;
    }));
    note.textContent = fresh ? '先点「听」。可以反复听。' : '下一题。';
    if (auto) play();
  }

  function choose(o, btn) {
    if (locked) return;
    locked = true;
    fresh = false;
    round.reveal?.();
    btn.classList.add(o.right ? 'right' : 'wrong');
    round.options.forEach((x) => x.right && x.btn.classList.add('right'));
    if (o.right) {
      right++;
      sfx.play('ok');
      pop(lamps.children[right - 1]);
    } else {
      wrong++;
      sfx.play('nope');
    }
    paintLamps();
    note.innerHTML = rich(o.right ? `✓ ${round.say?.right || '对了。'}` : round.say?.wrong || '不是这个。');
    if (right >= need) return finish();
    timer = setTimeout(() => next(true), o.right ? 1500 : 2800);
  }

  function finish() {
    const stars = wrong === 0 ? 3 : wrong === 1 ? 2 : 1;
    env.done(stars);
    confetti(lamps, 18);
    const again = h('button', { class: 'btn sm', type: 'button' }, '再玩一轮');
    again.addEventListener('click', () => {
      right = 0;
      wrong = 0;
      paintLamps();
      next(true);
    });
    note.append(h('div', { class: 'cl-pass' }, `过关。${wrong ? `中间错了 ${wrong} 次，不要紧。` : '一次都没错。'}`, again));
  }

  paintLamps();
  next(false);
  return {
    el,
    destroy() {
      clearTimeout(timer);
      stopPlay();
    },
  };
}

/** 放一小段循环，放满 bars 小节自己停。返回停止函数 */
function playLoopOnce(player, bars = 2) {
  player.stop();
  player.start();
  const id = setTimeout(() => player.stop(), (60 / player.bpm) * 4 * bars * 1000 + 60);
  return () => {
    clearTimeout(id);
    player.stop();
  };
}

// ───────────── T1 四个一组 ─────────────

/** 拍子在走，四个灯轮流亮。blind = 不亮灯、不给看（“试一试”）：靠耳朵找出第 1 拍 */
function beatwalk(spec, env, _level, blind = false) {
  const bpm = spec.bpm || 100;
  let accent = true;
  let hits = 0;
  let wrong = 0;
  let beats = []; // 已经排进时钟的拍：{ t, n }，n = 第几拍（0–3）
  const need = spec.need || 4;
  const player = new LoopPlayer({ bpm });
  player.onSchedule = (step, t) => {
    if (step % 4) return;
    const n = step / 4;
    beats.push({ t, n, used: false });
    if (beats.length > 24) beats.shift();
    const strong = accent && n === 0;
    audio.drum('KICK', t, strong ? 1.1 : accent ? 0.55 : 0.8);
    if (strong) audio.click(t, true);
  };
  const lamps = [1, 2, 3, 4].map((n) => h('i', { class: n === 1 ? 'one' : '' }, blind ? '?' : String(n)));
  const grid = keys16({ small: true });
  const tally = h('div', { class: 'cl-lamps' });
  const say = h('div', { class: 'cl-note' }, blind ? '点「播放」，听出最重的那一下。' : '点「播放」。');
  const paintTally = () => tally.replaceChildren(...Array.from({ length: need }, (_, i) => h('i', { class: i < hits ? 'on' : '' })));
  player.onStep((s) => {
    if (blind) return;
    lamps.forEach((l, i) => l.classList.toggle('on', s >= 0 && Math.floor(s / 4) === i));
    grid.setHead(s);
  });

  const padCtl = tapPad('拍！', (perfMs) => {
    audio.drum('CLAP', 0, 0.7);
    if (!player.playing || !beats.length) return (say.textContent = '先点「播放」。');
    const t = tapTime(perfMs);
    const near = beats.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));
    const off = t - near.t;
    env.touched();
    if (Math.abs(off) > (60 / bpm) * 0.34) return (say.textContent = '落在两拍中间了。跟着“咚”拍。');
    if (near.n === 0) {
      if (near.used) return;
      near.used = true;
      hits++;
      paintTally();
      lamps[0].classList.add('got');
      setTimeout(() => lamps[0].classList.remove('got'), 260);
      say.textContent = hits >= need ? '' : `拍在 1 上了。${blind ? `还要 ${need - hits} 次。` : ''}`;
      if (hits === need) {
        sfx.play('star');
        confetti(padCtl.el, 20);
        if (blind) {
          say.textContent = `过关：${need} 次都拍在了 1 上${wrong ? `，中间拍偏了 ${wrong} 次` : ''}。`;
          env.done(wrong === 0 ? 3 : wrong <= 2 ? 2 : 1);
        } else {
          say.textContent = '你听出“1”了。想继续拍也行。';
        }
      }
    } else {
      wrong++;
      say.textContent = `这是第 ${near.n + 1} 拍。等最重的那一下。`;
    }
  });

  const accentSeg = h('div', { class: 'seg cl-seg' });
  const paintSeg = () => accentSeg.replaceChildren(
    h('button', { type: 'button', class: accent ? 'on' : '', onclick: () => { accent = true; paintSeg(); env.touched(); } }, '重音：开'),
    h('button', { type: 'button', class: accent ? '' : 'on', onclick: () => { accent = false; paintSeg(); env.touched(); say.textContent = '四下一模一样：数不出哪个是 1 了。'; } }, '关'),
  );
  paintSeg();
  paintTally();
  const el = h('div', { class: ['cl-toy', 'cl-beat', blind && 'blind'] },
    h('div', { class: 'cl-row' }, playButton(player, { onToggle: (p) => el.classList.toggle('playing', p) }), !blind && accentSeg, h('span', { class: 'spacer' }), tally),
    h('div', { class: 'cl-beats' }, lamps),
    !blind && h('div', { class: 'cl-cap' }, '机器上，这四拍就是那 16 个方键：每 4 个键一拍'),
    !blind && grid.el,
    padCtl.el,
    say,
  );
  return {
    el,
    destroy() {
      player.stop();
      padCtl.destroy();
    },
  };
}

// ───────────── T5 高和低 ─────────────

const WHITES = [0, 2, 4, 5, 7, 9, 11];
const FLOOR = ['一楼', '二楼', '三楼'];

/** 三层楼，每层 7 个键：同名的音上下对齐。点一个，楼上楼下的“它”一起亮 */
function octaves(spec, env) {
  const notes = [];
  for (let o = 0; o < 3; o++) for (const s of WHITES) notes.push(60 + o * 12 + s);
  const say = h('div', { class: 'cl-note' }, '点一个键。');
  let picked = -1;
  const keys = notes.map((m) => {
    const k = h('button', { class: 'cl-wkey', type: 'button', 'data-sfx': 'none', style: { '--c': `var(--t-${['KICK', 'SNARE', 'CLAP', 'HAT1', 'HAT2', 'PERC1', 'PERC2'][WHITES.indexOf(m % 12)]})` } },
      h('b', {}, NAMES[m % 12]));
    k.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      press(m);
    });
    k.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && !e.repeat && press(m));
    return k;
  });
  const same = () => notes.filter((m) => m % 12 === picked);
  function press(m) {
    picked = m % 12;
    playNotes([m], { len: 0.7 });
    keys.forEach((k, i) => {
      k.classList.toggle('same', notes[i] % 12 === picked);
      k.classList.toggle('down', notes[i] === m);
    });
    setTimeout(() => keys[notes.indexOf(m)].classList.remove('down'), 180);
    say.innerHTML = rich(`这一列的 3 个都叫 **${NAMES[picked]}**：楼上的比楼下的高一层。`);
    run.disabled = false;
    env.touched();
  }
  const run = h('button', { class: 'btn', type: 'button', disabled: true }, '▶ 同名的连着听');
  run.addEventListener('click', () => {
    const list = same();
    playNotes(list, { gap: 0.5, len: 0.6 });
    list.forEach((m, i) => setTimeout(() => {
      const k = keys[notes.indexOf(m)];
      k.classList.add('down');
      setTimeout(() => k.classList.remove('down'), 300);
    }, 40 + i * 500));
    env.touched();
  });
  // 三楼摆在最上面
  const floors = [2, 1, 0].map((o) => h('div', { class: 'cl-floor' }, h('span', {}, FLOOR[o]), h('div', { class: 'cl-wkeys' }, keys.slice(o * 7, o * 7 + 7))));
  return { el: h('div', { class: 'cl-toy cl-oct' }, h('div', { class: 'cl-floors' }, floors), h('div', { class: 'cl-row' }, run, say)), destroy() {} };
}

function samename(spec, env) {
  const quiz = listenQuiz({
    need: spec.need, env,
    make() {
      const base = 60 + pick(WHITES);
      const octave = Math.random() < 0.5;
      const step = octave ? 12 : pick([4, 5, 7, 9, 14]);
      return {
        play: () => playNotes([base, base + step], { gap: 0.75, len: 0.65 }),
        options: [{ label: '是，同一个名字', right: octave }, { label: '不是，换了个音', right: !octave }],
        say: octave
          ? { right: `两个都叫 **${NAMES[base % 12]}**，第二个高了一个八度。`, wrong: `其实是同一个：两个都叫 **${NAMES[base % 12]}**，只是高了一层。` }
          : { right: `第一个是 ${NAMES[base % 12]}，第二个是 ${NAMES[(base + step) % 12]}：换了名字。`, wrong: `这回不是：第一个是 ${NAMES[base % 12]}，第二个是 ${NAMES[(base + step) % 12]}。同名的两个音听起来会像“叠”在一起。` },
      };
    },
  });
  return { el: h('div', { class: 'cl-toy' }, quiz.el), destroy: quiz.destroy };
}

// ───────────── T7 亮和暗 ─────────────

const MAJOR = SCALES[1].offsets;
const MINOR = SCALES[0].offsets;
/** 音阶的第几级（1–7，8 = 高一层的 1）→ 音符号 */
const degree = (d, minor, root = 60) => root + (minor ? MINOR : MAJOR)[(d - 1) % 7] + (d > 7 ? 12 : 0);

function brightdark(spec, env) {
  let minor = false;
  const melody = spec.melody;
  const player = new LoopPlayer({ bpm: spec.bpm || 104, steps: melody.length * 2 });
  player.onSchedule = (step, t) => {
    if (step % 2 || !melody[step / 2]) return;
    audio.note(degree(melody[step / 2], minor), t, 0.36, { voice: 'keys', vel: 0.85 });
  };
  const keys = [1, 2, 3, 4, 5, 6, 7, 8].map((d) => {
    const k = h('button', { class: ['cl-rung', [3, 6, 7].includes(d) && 'moves'], type: 'button', 'data-sfx': 'none' }, h('b', {}, d === 8 ? '1' : String(d)), h('span', {}));
    k.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      playNotes([degree(d, minor)], { len: 0.5 });
      flash(d);
      env.touched();
    });
    return k;
  });
  const flash = (d) => {
    const k = keys[d - 1];
    k.classList.add('down');
    setTimeout(() => k.classList.remove('down'), 170);
  };
  player.onStep((s) => s >= 0 && s % 2 === 0 && melody[s / 2] && flash(melody[s / 2]));
  const say = h('div', { class: 'cl-note' });
  const sw = h('div', { class: 'cl-mood', role: 'group', 'aria-label': '亮还是暗' });
  const el = h('div', { class: 'cl-toy cl-bd' });
  const paint = () => {
    el.classList.toggle('dark', minor);
    sw.replaceChildren(
      h('button', { type: 'button', class: minor ? '' : 'on', 'data-sfx': 'on', onclick: () => set(false) }, '☀ 亮'),
      h('button', { type: 'button', class: minor ? 'on' : '', 'data-sfx': 'off', onclick: () => set(true) }, '☾ 暗'),
    );
    keys.forEach((k, i) => (k.lastChild.textContent = NAMES[degree(i + 1, minor) % 12]));
    say.innerHTML = rich(minor ? '第 **3、6、7** 级各往下挪了半格：同一段旋律，暗下来了。' : '第 3、6、7 级在原位：亮堂。');
  };
  function set(v) {
    minor = v;
    paint();
    env.touched();
  }
  paint();
  el.append(h('div', { class: 'cl-row' }, playButton(player), sw), h('div', { class: 'cl-rungs' }, keys), say);
  return { el, destroy: () => player.stop() };
}

function majorminor(spec, env) {
  const quiz = listenQuiz({
    need: spec.need, env,
    make() {
      const minor = Math.random() < 0.5;
      const root = 60 + pick([0, 2, 5, -3]);
      const line = pick(spec.melodies);
      return {
        play: () => playNotes(line.map((d) => (d ? degree(d, minor, root) : null)), { gap: 0.3, len: 0.4 }),
        options: [{ label: '☀ 亮', right: !minor }, { label: '☾ 暗', right: minor }],
        say: minor ? { right: '是暗的：小调。', wrong: '这段是**暗**的（小调）。留意中间那几个音，往下沉了一点。' } : { right: '是亮的：大调。', wrong: '这段是**亮**的（大调）。' },
      };
    },
  });
  return { el: h('div', { class: 'cl-toy' }, quiz.el), destroy: quiz.destroy };
}

// ───────────── T10 三个音叠起来 ─────────────

const MOODS = { minor: ['暗', '小和弦'], major: ['亮', '大和弦'], dim: ['紧', '像悬着没落地'], other: ['', ''] };

function stack(spec, env) {
  const state = { start: 1, size: 3 };
  const scale = synthKeyNotes({ scale: 0 }); // C 小调的 7 个音，和机器出厂时一样
  const used = () => Array.from({ length: state.size }, (_, i) => ((state.start - 1 + 2 * i) % 7) + 1);
  const notes = () => chordNotes(state.start, { scale: 0, size: state.size });
  const tower = h('div', { class: 'cl-tower' });
  const badge = h('div', { class: 'cl-badge' });
  const say = h('div', { class: 'cl-note' });
  const keys = [1, 2, 3, 4, 5, 6, 7].map((d) => {
    const k = h('button', { class: 'cl-skey', type: 'button', 'data-sfx': 'none' }, h('b', {}, NAMES[scale[d - 1] % 12]), h('span', {}, `键 ${d}`), h('em', {}));
    k.addEventListener('click', () => {
      state.start = d;
      paint(true);
    });
    return k;
  });
  const sizeSeg = h('div', { class: 'seg cl-seg' });
  function paint(sound) {
    const u = used();
    const ns = notes();
    keys.forEach((k, i) => {
      const layer = u.indexOf(i + 1);
      k.classList.toggle('on', layer >= 0);
      k.classList.toggle('skip', layer < 0 && u.length > 1 && isBetween(i + 1, u));
      k.querySelector('em').textContent = layer >= 0 ? `第 ${layer + 1} 层` : '';
      k.dataset.layer = layer >= 0 ? String(layer + 1) : '';
    });
    tower.replaceChildren(...ns.map((n, i) => h('div', { class: 'cl-brick', 'data-layer': String(i + 1) }, h('b', {}, NAMES[n % 12]), h('span', {}, `键 ${u[i]}`))).reverse());
    const mood = state.size === 3 ? chordMood(ns) : 'other';
    badge.textContent = MOODS[mood][0] ? `${MOODS[mood][0]} · ${MOODS[mood][1]}` : '';
    badge.dataset.mood = mood;
    sizeSeg.replaceChildren(...[1, 2, 3].map((n) => h('button', { type: 'button', class: n === state.size ? 'on' : '', onclick: () => { state.size = n; paint(true); } }, `${n} 层`)));
    say.innerHTML = rich(state.size === 1 ? '只有地基：一个音，一根线。' : state.size === 2 ? `从键 ${u[0]} 起，**跳过一个**，拿键 ${u[1]}。有点颜色了。` : `键 ${u.join('、')}：隔一个拿一个，三层。${MOODS[mood][0] ? `听起来**${MOODS[mood][0]}**。` : ''}`);
    if (sound) {
      playChord(ns);
      [...tower.children].forEach((b) => pop(b));
      env.touched();
    }
  }
  const isBetween = (d, u) => u.slice(0, -1).some((a, i) => {
    const b = u[i + 1];
    return a < b ? d > a && d < b : d > a || d < b;
  });
  const spread = h('button', { class: 'btn', type: 'button', onclick: () => { playChord(notes(), { spread: true }); env.touched(); } }, '▶ 一个一个，再一起');
  paint(false);
  const el = h('div', { class: 'cl-toy cl-stack' },
    h('div', { class: 'cl-row' }, sizeSeg, spread, h('span', { class: 'spacer' }), badge),
    h('div', { class: 'cl-tower-wrap' }, tower),
    h('div', { class: 'cl-skeys' }, keys),
    say,
  );
  return { el, destroy() {} };
}

/** 三张牌，两张一个味道，一张不一样：把它找出来 */
function oddchord(spec, env) {
  const need = spec.need || 3;
  let right = 0;
  let wrong = 0;
  let timer = 0;
  let locked = false;
  const lamps = h('div', { class: 'cl-lamps' });
  const cards = h('div', { class: 'cl-cards' });
  const note = h('div', { class: 'cl-note' });
  const paintLamps = () => lamps.replaceChildren(...Array.from({ length: need }, (_, i) => h('i', { class: i < right ? 'on' : '' })));
  const triad = (root, major) => [root, root + (major ? 4 : 3), root + 7];

  function next() {
    clearTimeout(timer);
    locked = false;
    const oddMajor = Math.random() < 0.5;
    const odd = Math.floor(Math.random() * 3);
    const roots = shuffle([57, 58, 60, 62, 63, 65]).slice(0, 3);
    const heard = new Set();
    cards.replaceChildren(...roots.map((root, i) => {
      const major = i === odd ? oddMajor : !oddMajor;
      const face = h('button', { class: 'cl-card', type: 'button', 'data-sfx': 'none' }, h('b', {}, 'ABC'[i]), h('span', {}, '点我听'));
      const choose = h('button', { class: 'btn sm', type: 'button' }, '就是它');
      face.addEventListener('click', () => {
        playChord(triad(root, major));
        heard.add(i);
        face.classList.add('heard');
        pop(face);
      });
      choose.addEventListener('click', () => {
        if (locked) return;
        locked = true;
        const ok = i === odd;
        [...cards.children].forEach((c, j) => c.classList.add(j === odd ? 'right' : j === i ? 'wrong' : 'dim'));
        const kind = oddMajor ? '**亮**的（大和弦）' : '**暗**的（小和弦）';
        if (ok) {
          right++;
          sfx.play('ok');
          note.innerHTML = rich(`✓ ${'ABC'[odd]} 是唯一${kind}，另外两张是${oddMajor ? '暗' : '亮'}的。`);
        } else {
          wrong++;
          sfx.play('nope');
          note.innerHTML = rich(`不一样的是 ${'ABC'[odd]}：只有它是${kind}。再点三张牌听听区别。`);
        }
        paintLamps();
        if (right >= need) {
          env.done(wrong === 0 ? 3 : wrong === 1 ? 2 : 1);
          confetti(lamps, 18);
          const again = h('button', { class: 'btn sm', type: 'button', onclick: () => { right = 0; wrong = 0; paintLamps(); next(); } }, '再玩一轮');
          note.append(h('div', { class: 'cl-pass' }, '过关。', again));
        } else {
          timer = setTimeout(next, ok ? 1900 : 4200);
        }
      });
      return Object.assign(h('div', { class: 'cl-cardbox' }, face, choose), { __odd: i === odd }); // __odd：给走查脚本用
    }));
    note.textContent = '三张都点一下，听出哪张的味道和另外两张不一样。';
  }
  paintLamps();
  next();
  return { el: h('div', { class: 'cl-toy cl-odd' }, h('div', { class: 'cl-row' }, h('span', { class: 'spacer' }), lamps), cards, note), destroy: () => clearTimeout(timer) };
}

// ───────────── R1 跟稳 ─────────────

/** 只有节拍器。每拍一下，看偏早还是偏晚。spec.challenge = 连着拍几下（“试一试”：不给看点，拍完再出结果） */
function steady(spec, env) {
  const bpm = spec.bpm || 92;
  const total = spec.challenge || 0;
  const beat = 60 / bpm;
  let beats = [];
  let offs = []; // 每一下偏了多少毫秒（正 = 晚）
  const player = new LoopPlayer({ bpm, click: true });
  player.onSchedule = (step, t) => {
    if (step % 4) return;
    beats.push(t);
    if (beats.length > 24) beats.shift();
  };
  const lamps = [1, 2, 3, 4].map((n) => h('i', { class: n === 1 ? 'one' : '' }, String(n)));
  player.onStep((s) => lamps.forEach((l, i) => l.classList.toggle('on', s >= 0 && Math.floor(s / 4) === i)));
  const meter = h('div', { class: 'cl-meter' }, h('i', { class: 'zone' }), h('i', { class: 'mid' }), h('span', { class: 'l' }, '早'), h('span', { class: 'r' }, '晚'));
  const say = h('div', { class: 'cl-note' }, total ? `点「播放」，然后连着拍 ${total} 下。` : '点「播放」。');
  const count = h('div', { class: 'cl-count' });
  const RANGE = 160; // 偏差仪两头各是多少毫秒

  const dot = (v, cls = '') => {
    const d = h('i', { class: `dot ${cls}`, style: { left: `${50 + (clamp(v, -RANGE, RANGE) / RANGE) * 50}%` } });
    meter.append(d);
    return d;
  };
  const clearDots = () => meter.querySelectorAll('.dot').forEach((d) => d.remove());
  const words = (v) => (Math.abs(v) < 15 ? '正好' : `${v < 0 ? '早了' : '晚了'} ${Math.abs(Math.round(v))} 毫秒`);

  function result() {
    const avg = mean(offs);
    const spread = stddev(offs);
    clearDots();
    offs.forEach((v) => dot(v, 'keep'));
    const stars = spread <= 30 ? 3 : spread <= 50 ? 2 : spread <= 85 ? 1 : 0;
    const steadyWord = spread <= 30 ? '很稳' : spread <= 50 ? '挺稳' : spread <= 85 ? '还行' : '有点飘';
    say.innerHTML = rich(`${total} 下：平均**${words(avg)}**，前后晃动 **±${Math.round(spread)} 毫秒**——${steadyWord}。${Math.abs(avg) > 45 && spread <= 50 ? '每一下偏得都差不多，说明你是稳的，多出来的是屏幕和鼠标的延迟。' : ''}`);
    if (stars) {
      env.done(stars);
      sfx.play('star');
      confetti(meter, 16);
    }
    const again = h('button', { class: 'btn sm', type: 'button', onclick: () => { offs = []; clearDots(); count.textContent = ''; say.textContent = '再来：连着拍，别停。'; } }, stars ? '再来一次' : '再试一次');
    say.append(' ', again);
    offs = [];
  }

  const padCtl = tapPad('拍', (perfMs) => {
    if (!player.playing || !beats.length) return (say.textContent = '先点「播放」，等“嘀”声出来。');
    const t = tapTime(perfMs);
    const near = beats.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a));
    const v = ms(t - near);
    if (Math.abs(v) > beat * 1000 * 0.42) return (say.textContent = '这一下落在两拍中间了，不算。每“嘀”一声拍一下。');
    env.touched();
    offs.push(v);
    if (total) {
      count.textContent = `${offs.length} / ${total}`;
      if (offs.length >= total) result();
      return;
    }
    // 玩一玩：每一下都落一个点，旧的慢慢淡掉
    const d = dot(v);
    setTimeout(() => d.classList.add('old'), 30);
    setTimeout(() => d.remove(), 5200);
    if (offs.length > 8) offs.shift();
    say.innerHTML = rich(offs.length >= 4 ? `这一下**${words(v)}**。最近 ${offs.length} 下：平均${words(mean(offs))}，晃动 ±${Math.round(stddev(offs))} 毫秒。` : `这一下**${words(v)}**。`);
  }, env.live ? '或者按真机上任意一个 Synth key' : '');

  const el = h('div', { class: ['cl-toy', 'cl-steady', total && 'challenge'] },
    h('div', { class: 'cl-row' }, playButton(player), h('span', { class: 'spacer' }), count),
    h('div', { class: 'cl-beats sm' }, lamps),
    meter, padCtl.el, say,
  );
  return {
    el,
    destroy() {
      player.stop();
      padCtl.destroy();
    },
  };
}

// ───────────── R3 听一段，选图案 ─────────────

function gridplay(spec, env) {
  const presets = [spec.pattern, 'x---x---x---x---', 'x-----x---x-----'];
  let at = 0;
  const player = new LoopPlayer({ bpm: spec.bpm || 104 });
  const grid = keys16({ pattern: spec.pattern, editable: true, onChange: (p) => { apply(p); env.touched(); } });
  const apply = (p) => player.set({ KICK: p, HAT1: '--x---x---x---x-' });
  apply(grid.get());
  player.onStep((s) => grid.setHead(s));
  const say = h('div', { class: 'cl-note' }, '亮的格子有底鼓。上排是前两拍，下排是后两拍。');
  const el = h('div', { class: 'cl-toy cl-grid' },
    h('div', { class: 'cl-row' }, playButton(player),
      h('button', { class: 'btn', type: 'button', onclick: () => { at = (at + 1) % presets.length; grid.set(presets[at]); apply(grid.get()); env.touched(); } }, '换一张图'),
      h('button', { class: 'btn ghost', type: 'button', onclick: () => { grid.set(''); apply(grid.get()); env.touched(); } }, '清空')),
    h('div', { class: 'cl-cap' }, '底鼓 · 和机器上那两排方键一样：上排 1–8，下排 9–16'),
    grid.el, say,
  );
  return { el, destroy: () => player.stop() };
}

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

function swingfeel(spec, env) {
  const player = new LoopPlayer({ bpm: spec.bpm || 92 }).set({ KICK: 'x-------x-x-----', SNARE: '----x-------x---', HAT1: 'xxxxxxxxxxxxxxxx' });
  const dots = Array.from({ length: 16 }, (_, i) => h('i', { class: i % 4 === 0 ? 'beat' : i % 2 ? 'late' : '' }));
  const row = h('div', { class: 'cl-swingrow' }, dots);
  player.onStep((s) => dots.forEach((d, i) => d.classList.toggle('on', i === s)));
  const num = h('b', {}, '0');
  const say = h('div', { class: 'cl-note' }, '0：笔直，像机器。');
  const slider = h('input', { class: 'cl-range', type: 'range', min: 0, max: 58, step: 1, value: 0, 'aria-label': '摇摆的量' });
  slider.addEventListener('input', () => {
    const v = Number(slider.value);
    player.swing = v / 120; // 和 SEQTRAK 一样：一步 = 120 ticks，摇摆最多 58
    row.style.setProperty('--swing', String(v / 120));
    num.textContent = String(v);
    say.textContent = v === 0 ? '0：笔直，像机器。' : v < 20 ? '松了一点点，有人味了。' : v < 42 ? '明显在“晃”了。Hip-hop、House 常在这一带。' : '很晃：每一对都是一长一短，快成三连音了。';
    env.touched();
  });
  const el = h('div', { class: 'cl-toy cl-swing' },
    h('div', { class: 'cl-row' }, playButton(player), h('span', { class: 'spacer' }), h('div', { class: 'cl-big' }, num, h('small', {}, '摇摆'))),
    h('div', { class: 'cl-cap' }, '一小节里的 16 下镲：每一对里的第二个（空心的）会往后躲'),
    row,
    h('div', { class: 'cl-sliderow' }, h('span', {}, '笔直'), slider, h('span', {}, '摇晃')),
    say,
  );
  return { el, destroy: () => player.stop() };
}

/** 跟着底鼓每拍拍两下：直的一遍，晃的一遍。看的是第二下落在一拍的百分之几 */
function swingtap(spec, env) {
  const bpm = spec.bpm || 84;
  const beat = 60 / bpm;
  const PHASES = [
    { id: 'straight', name: '直的', swing: 0, lo: 0.42, hi: 0.565, how: '两下一样匀：嗒-嗒、嗒-嗒。' },
    { id: 'swung', name: '晃的', swing: 0.3, lo: 0.585, hi: 0.82, how: '第二下晚一点：嗒——嗒、嗒——嗒。' },
  ];
  let phase = 0;
  let guide = true;
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

const ROWS = [['KICK', '底鼓'], ['SNARE', '军鼓'], ['CLAP', '拍手'], ['HAT1', '闭镲'], ['HAT2', '开镲'], ['PERC1', '敲击']];

function grooves(spec, env, level) {
  const list = Object.entries(level.grooves);
  const player = new LoopPlayer();
  let now = null;
  let heads = [];
  const chart = h('div', { class: 'cl-chart' });
  const say = h('div', { class: 'cl-note' }, '点一张牌。');
  const cards = list.map(([id, g]) => {
    const c = h('button', { class: 'cl-groove', type: 'button', 'data-sfx': 'none' }, h('b', {}, g.name), h('span', {}, `${g.bpm} BPM`));
    c.addEventListener('click', () => choose(id));
    return c;
  });
  player.onStep((s) => heads.forEach((row) => row.forEach((c, i) => c.classList.toggle('head', i === s))));
  function choose(id) {
    player.stop();
    cards.forEach((c, i) => c.classList.toggle('on', list[i][0] === id && now !== id));
    if (now === id) {
      now = null;
      return;
    }
    now = id;
    const g = level.grooves[id];
    player.bpm = g.bpm;
    player.swing = g.swing || 0;
    player.set(g.tracks);
    heads = [];
    chart.replaceChildren(...ROWS.filter(([t]) => g.tracks[t]).map(([t, zh]) => {
      const cells = [...pad16(g.tracks[t])].map((ch, i) => h('i', { class: [ch === 'x' && 'on', i % 4 === 0 && 'beat'], style: { '--c': `var(--t-${t})` } }));
      heads.push(cells);
      return h('div', { class: 'cl-chart-row' }, h('span', {}, zh), h('div', {}, cells));
    }));
    say.innerHTML = rich(`**${g.name}**：${g.mark}。`);
    player.start();
    env.touched();
  }
  const el = h('div', { class: 'cl-toy cl-grooves' }, h('div', { class: 'cl-groove-cards' }, cards), chart, say);
  return { el, destroy: () => player.stop() };
}

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
      patch: { effect, on, amount: effect === 'lowpass' ? 0.72 : 0.8, room: 1, echo: 0 },
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
  const lab = createFxLab({ effect: 'lowpass', amount: 0, on: true });
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
    note.textContent = `第 ${round + 1} 次：点「听目标」，记住它有多闷。`;
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
      note.textContent = '现在是你的。推竖条，推到和刚才一样闷，再点「就是这儿」。目标可以反复听。';
    }, 3200);
  });
  here.addEventListener('click', () => {
    if (previewing) endPreview();
    const mine = lab.strip.value;
    const diff = Math.abs(mine - target);
    const ok = diff <= 0.13;
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
    const lead = ok ? `✓ 很近：${where}。` : `${where}：${mine < target ? '还不够闷' : '捂过头了'}。`;
    start();
    note.textContent = `${lead} 下一次：点「听目标」。`;
  });
  paintLamps();
  start();
  const el = h('div', { class: 'cl-toy cl-fx cl-match' }, lab.el, h('div', { class: 'cl-row' }, hear, here, h('span', { class: 'spacer' }), lamps), note);
  return { el, destroy: () => { clearTimeout(previewing); lab.destroy(); } };
}

// ───────────── 入口 ─────────────

const TOYS = {
  beatwalk, findone: (s, e, l) => beatwalk(s, e, l, true), octaves, samename, brightdark, majorminor, stack, oddchord,
  steady, gridplay, pickpattern, swingfeel, swingtap, grooves, guessgroove,
  fxlab, drywet, matchcut, whichroom, whichecho,
};

export function createToy(spec, env, level) {
  const make = TOYS[spec.toy];
  if (!make) return { el: h('div', { class: 'cl-toy muted' }, `（还没有这个玩具：${spec.toy}）`), destroy() {} };
  return make(spec, env, level);
}
