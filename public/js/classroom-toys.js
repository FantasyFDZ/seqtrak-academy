// 小课堂里能玩的东西：每关的“玩一玩”和“挑战”。内容（每关用哪个、参数是什么）在 content/classroom.js。
// 约定：createToy(spec, env, level) → { el, destroy() }，env 的几样见 classroom-kit.js 开头（env.tier 是铜 1 / 银 2 / 金 3）。
// 这个文件是乐理、节奏、效果三条线的玩具和入口（createToy、tierSpec）；几种听辨题的骨架在 classroom-ear.js，
// 节奏挑战（音游引擎）在 classroom-rhythm.js，DJ 线在 classroom-dj.js。
// 都按手指的大小做：能点的东西至少 44 像素，不靠悬停，不靠键盘。声音全是应用自己合成的。
import { h, rich, clamp, mean, stddev } from './util.js';
import { audio } from './audio.js';
import { LoopPlayer } from './looper.js';
import { midi } from './midi.js';
import { store } from './store.js';
import { sfx } from './sfx.js';
import { confetti, pop } from './fx.js';
import { segmented } from './ui.js';
import { SCALES, chordNotes, chordMood, synthKeyNotes, synthKeyNote, chordName, KEY_NAMES } from './scales.js';
import { createFxLab, FxEngine, ROOMS, ECHOES, EFFECTS } from './fxlab.js';
import {
  NAMES, pick, shuffle, tapTime, ms, byTier, playButton, tapPad, pad16, keys16, playNotes, playChord, playChords, listenQuiz, playLoopOnce, starsByWrong, passLine, synthKeyRow,
} from './classroom-kit.js';
import { orderQuiz, oddQuiz, memoryQuiz, dictateQuiz, echoQuiz, askQuiz, randomPhrase } from './classroom-ear.js';
import { RHYTHM_TOYS } from './classroom-rhythm.js';
import { DJ_TOYS } from './classroom-dj.js';
import { THEORY_TOYS } from './theory-toys.js';

// 公用的小零件（按钮、垫子、16 个格子、放音、“听一听选一个”的骨架）在 classroom-kit.js

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

  const accentSeg = segmented(
    [{ value: true, label: '重音：开' }, { value: false, label: '关' }],
    accent,
    (v) => {
      accent = v;
      env.touched();
      if (!v) say.textContent = '四下一模一样：数不出哪个是 1 了。';
    },
  );
  accentSeg.classList.add('cl-seg');
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
  const sizeSeg = segmented([1, 2, 3].map((n) => ({ value: n, label: `${n} 层` })), state.size, (n) => {
    state.size = n;
    paint(true);
  });
  sizeSeg.classList.add('cl-seg');
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
  slider.style.setProperty('--attr-min', '0');
  slider.style.setProperty('--attr-max', '58');
  slider.style.setProperty('--control-value', '0');
  slider.setAttribute('aria-valuetext', '0');
  slider.addEventListener('input', () => {
    const v = Number(slider.value);
    slider.style.setProperty('--control-value', String(v));
    slider.setAttribute('aria-valuetext', String(v));
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

// ── T2 把一拍切开：格子听写 ──

const SUB = { 1: 'x---', 2: 'x-x-', 4: 'xxxx', and: '--x-', ea: 'x-xx', rest: '----' };
function subdict(spec, env) {
  return dictateQuiz(spec, env, () => {
    let beats;
    if ((env.tier || 1) <= 1) {
      const [a, b] = pick([[1, 2], [2, 1], [2, 4], [4, 2], [1, 4]]);
      beats = [a, a, b, b];
    } else if (env.tier === 2) {
      do beats = [0, 0, 0, 0].map(() => pick([1, 2, 4])); while (new Set(beats).size < 2);
    } else {
      do beats = [0, 0, 0, 0].map(() => pick([1, 2, 4, 'and', 'ea'])); while (new Set(beats).size < 3);
    }
    return {
      target: beats.map((b) => SUB[b]).join(''),
      track: 'HAT1', label: '闭镲', bpm: 84, bars: 2,
      backing: { KICK: 'x---x---x---x---' },
      say: '底鼓每拍一下，帮你数拍子。听镲在每一拍里响了几下，在格子上点出来（每 4 格是一拍）。',
    };
  });
}

// ── T6 一格和两格 ──

const BLACK = new Set([1, 3, 6, 8, 10]);
/** 13 个键排成一排（C 到高一层的 C），黑键白键都在：一格就是挨着的下一个键，不管黑白 */
function chromatic(spec, env) {
  let at = 0;
  const keys = Array.from({ length: 13 }, (_, i) => {
    const k = h('button', { class: ['cl-chrom', BLACK.has(i % 12) && 'black'], type: 'button', 'data-sfx': 'none' }, h('b', {}, NAMES[i % 12]), h('span', {}, String(i)));
    k.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      go(i, true);
    });
    return k;
  });
  const say = h('div', { class: 'cl-note' }, '点一个键当起点，再点“走一格”“走两格”。');
  function go(i, tap) {
    const from = at;
    at = clamp(i, 0, 12);
    playNotes(tap ? [60 + at] : [60 + from, 60 + at], { gap: 0.42, len: 0.5 });
    keys.forEach((k, j) => {
      k.classList.toggle('here', j === at);
      k.classList.toggle('from', !tap && j === from);
    });
    const d = Math.abs(at - from);
    if (!tap && d === 0) return (say.textContent = '到头了：换个方向走。');
    say.innerHTML = rich(tap ? `起点：**${NAMES[at % 12]}**。` : `从 ${NAMES[from % 12]} 到 ${NAMES[at % 12]}：**${d === 1 ? '一格，叫半音' : d === 2 ? '两格，叫全音' : `${d} 格`}**。${d === 1 && !BLACK.has(from % 12) && !BLACK.has(at % 12) ? '两个白键挨着，中间没有黑键：它们也只差一格。' : ''}`);
    env.touched();
  }
  keys[0].classList.add('here');
  const el = h('div', { class: 'cl-toy cl-chromatic' },
    h('div', { class: 'cl-row' },
      h('button', { class: 'btn', type: 'button', onclick: () => go(at - 2) }, '← 退两格'),
      h('button', { class: 'btn', type: 'button', onclick: () => go(at - 1) }, '← 退一格'),
      h('button', { class: 'btn primary', type: 'button', onclick: () => go(at + 1) }, '走一格 →'),
      h('button', { class: 'btn primary', type: 'button', onclick: () => go(at + 2) }, '走两格 →')),
    h('div', { class: 'cl-cap' }, '一个八度里一共 12 格：C 到高一层的 C 正好走 12 格'),
    h('div', { class: 'cl-chroms' }, keys), say);
  return { el, destroy() {} };
}

function steps12(spec, env) {
  const gold = (env.tier || 1) >= 3;
  return listenQuiz({
    need: spec.need, env,
    make() {
      const d = pick(gold ? [1, 2, 3] : [1, 2]);
      const base = 60 + Math.floor(Math.random() * 9);
      const up = Math.random() < 0.6;
      const notes = up ? [base, base + d] : [base + d, base];
      const words = { 1: '一格（半音）', 2: '两格（全音）', 3: '三格' };
      return {
        play: () => playNotes(notes, { gap: 0.6, len: 0.55 }),
        options: (gold ? [1, 2, 3] : [1, 2]).map((n) => ({ label: words[n], right: n === d })),
        say: { right: `${NAMES[notes[0] % 12]} → ${NAMES[notes[1] % 12]}：${words[d]}。`, wrong: `是**${words[d]}**：${NAMES[notes[0] % 12]} → ${NAMES[notes[1] % 12]}。半音听着“挤”，全音宽一点。` },
      };
    },
  });
}

// ── T8 怎么按都不难听：五声 ──

const PENTA = SCALES[2].offsets; // MINOR PENTATONIC：0 3 5 7 10 12 15
function pentajam(spec, env) {
  let mode = 'penta';
  const player = new LoopPlayer({ bpm: 92 }).set({ KICK: 'x-------x-x-----', SNARE: '----x-------x---', HAT1: 'x-x-x-x-x-x-x-x-' }, [[0, 36, 6], [8, 36, 3], [11, 43, 2], [14, 34, 2]]);
  const box = h('div', { class: 'cl-penta-keys' });
  const say = h('div', { class: 'cl-note' });
  const keysFor = () => (mode === 'penta' ? [0, 1, 2, 3, 4, 5].map((i) => 60 + PENTA[i]) : Array.from({ length: 13 }, (_, i) => 60 + i));
  let glissOn = false;
  let lastM = null;
  const triggerPenta = (m, b) => {
    audio.init().then((ok) => ok && audio.note(m + 12, audio.now() + 0.01, 0.45, { voice: 'pluck', vel: 0.85 }));
    b.classList.add('down');
    setTimeout(() => b.classList.remove('down'), 150);
    env.touched();
  };
  const keyMap = new Map();
  const paint = () => {
    keyMap.clear();
    box.replaceChildren(...keysFor().map((m) => {
      const b = h('button', { class: ['cl-wkey', BLACK.has(m % 12) && 'black'], type: 'button', 'data-sfx': 'none' }, h('b', {}, NAMES[m % 12]));
      keyMap.set(b, m);
      b.addEventListener('pointerdown', (e) => {
        if (e.button > 0) return;
        e.preventDefault();
        glissOn = true;
        lastM = m;
        triggerPenta(m, b);
        const end = () => { glissOn = false; lastM = null; };
        window.addEventListener('pointerup', end, { once: true, passive: true });
        window.addEventListener('pointercancel', end, { once: true, passive: true });
      });
      b.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && !e.repeat && triggerPenta(m, b));
      return b;
    }));
    box.style.gridTemplateColumns = `repeat(${keysFor().length}, minmax(0, 1fr))`;
    say.innerHTML = rich(mode === 'penta' ? '这几个键是 **C 小调五声**：C、D#、F、G、A#，再加一个高一层的 C。点「播放」，跟着鼓**乱按或横扫滑奏**：怎么弹都不难听。' : '现在是 **12 个键全上**。再乱按试试：有的音会“酸”，跟伴奏打架。');
  };
  box.addEventListener('pointermove', (e) => {
    if (!glissOn) return;
    if (e.pointerType === 'mouse' && !(e.buttons & 1)) { glissOn = false; return; }
    const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest('.cl-wkey');
    const m = hit && keyMap.get(hit);
    if (m !== undefined && m !== lastM) {
      lastM = m;
      triggerPenta(m, hit);
    }
  });
  const seg = segmented(
    [{ value: 'penta', label: '五声：5 个音' }, { value: 'all', label: '12 个全上' }],
    mode,
    (v) => { mode = v; paint(); env.touched(); },
  );
  seg.classList.add('cl-seg');
  paint();
  const el = h('div', { class: 'cl-toy cl-penta' }, h('div', { class: 'cl-row' }, playButton(player), seg), box, say);
  return { el, destroy: () => player.stop() };
}

function pentaecho(spec, env) {
  return echoQuiz(spec, env, (len) => ({
    degrees: randomPhrase([1, 2, 3, 4, 5], len, 2),
    keys: [1, 2, 3, 4, 5, 6],
    scale: 2, key: 0, octave: 0,
    names: Object.fromEntries([1, 2, 3, 4, 5, 6].map((d) => [d, NAMES[(60 + PENTA[d - 1]) % 12]])),
  }));
}

// ── T9 两个音的距离 ──

const INTERVALS = [
  { n: 2, name: '二度', mood: '挤', semis: 2, say: '挨着的两个音：挤、有点紧张。' },
  { n: 3, name: '三度', mood: '甜', semis: 4, say: '隔一个：甜，最常见的“和声”。' },
  { n: 5, name: '五度', mood: '稳', semis: 7, say: '隔三个：稳、空旷，力量感。' },
  { n: 8, name: '八度', mood: '空', semis: 12, say: '同一个名字，高一层：几乎合成一个音。' },
  { n: 6, name: '六度', mood: '宽', semis: 9, say: '比三度再宽一点：也甜，更开阔。' },
];
function intervals(spec, env) {
  const MINOR = SCALES[0].offsets;
  const note = (d) => 60 + MINOR[(d - 1) % 7] + (d > 7 ? 12 : 0);
  const say = h('div', { class: 'cl-note' }, '地基是键 1。点上面任何一个键：它和地基一起响。');
  const badge = h('div', { class: 'cl-badge' });
  let last = 0;
  const row = synthKeyRow({
    keys: [2, 3, 4, 5, 6, 7, 8],
    label: (d) => `${d === 8 ? '高 1' : `键 ${d}`}`,
    sub: (d) => NAMES[note(d) % 12],
    onPress: (d, b) => {
      last = d;
      const ns = [note(1), note(d)];
      playChord(ns, { spread: true });
      const iv = INTERVALS.find((x) => x.n === d);
      badge.textContent = iv ? `${iv.name} · ${iv.mood}` : `${d} 度`;
      badge.dataset.mood = iv?.mood === '甜' ? 'major' : iv?.mood === '稳' ? 'minor' : '';
      say.innerHTML = rich(iv ? `键 1 和键 ${d === 8 ? '高 1' : d}：**${iv.name}**，${iv.say}` : `键 1 和键 ${d}：${d} 度。`);
      row.btns.forEach((x) => x.classList.toggle('on', x === b));
      env.touched();
    },
  });
  const base = h('div', { class: 'cl-ground' }, h('b', {}, '地基 · 键 1'), h('span', {}, NAMES[note(1) % 12]));
  const el = h('div', { class: 'cl-toy cl-iv' },
    h('div', { class: 'cl-row' }, h('button', { class: 'btn', type: 'button', onclick: () => last && (playChord([note(1), note(last)]), env.touched()) }, '▶ 再一起响一下'), h('span', { class: 'spacer' }), badge),
    row.el, base, say);
  return { el, destroy() {} };
}

function intervalmem(spec, env) {
  const tier = env.tier || 1;
  return memoryQuiz(spec, env, (pairs) => ({
    groups: INTERVALS.slice(0, pairs).map((iv) => {
      const same = 60 + pick([0, 2, 5, 7]);
      return {
        id: iv.name, name: `${iv.name} · ${iv.mood}`, say: iv.say,
        play: () => {
          const r = tier <= 1 ? same : 57 + Math.floor(Math.random() * 8);
          playChord([r, r + iv.semis], { spread: true });
        },
      };
    }),
  }));
}

// ── T11 四个和弦走天下 ──

const PROGS = [
  { keys: [1, 6, 3, 7], songs: ['wake-me-up', 'faded'], name: 'Wake Me Up、Faded' },
  { keys: [6, 4, 5, 1], songs: ['gangstas-paradise'], name: "Gangsta's Paradise" },
  { keys: [6, 7, 1, 7], songs: ['something-just-like-this'], name: 'Something Just Like This' },
  { keys: [1, 7, 6, 7], songs: ['starboy'], name: 'Starboy' },
];
const chordOf = (k) => chordNotes(k, { scale: 0, size: 4 });

function progression(spec, env) {
  let prog = [...PROGS[0].keys];
  const player = new LoopPlayer({ bpm: 100, steps: 64 });
  let head = -1;
  player.onSchedule = (step, t) => {
    if (step % 4 === 0) audio.drum('KICK', t, 0.8);
    if (step % 8 === 4) audio.drum('SNARE', t, 0.6);
    if (step % 16 === 0) {
      const k = prog[step / 16];
      chordOf(k).forEach((n, i) => audio.note(n, t + i * 0.008, (60 / 100) * 4 * 0.95, { voice: 'keys', vel: 0.42 }));
      audio.note(chordOf(k)[0] - 24, t, (60 / 100) * 3.6, { voice: 'bass', vel: 0.8 });
    }
  };
  const tiles = h('div', { class: 'cl-prog' });
  const say = h('div', { class: 'cl-note' });
  player.onStep((s) => {
    head = s < 0 ? -1 : Math.floor(s / 16);
    [...tiles.children].forEach((t, i) => t.classList.toggle('now', i === head));
  });
  const presets = segmented(
    PROGS.map((p) => ({ value: p.keys.join('-'), label: p.keys.join('-') })),
    PROGS[0].keys.join('-'),
    (val) => {
      const found = PROGS.find((p) => p.keys.join('-') === val);
      if (found) {
        prog = [...found.keys];
        paint();
        env.touched();
      }
    },
  );
  presets.classList.add('cl-seg');
  function paint() {
    tiles.replaceChildren(...prog.map((k, i) => {
      const t = h('button', { class: 'cl-ptile', type: 'button', 'data-sfx': 'none' }, h('b', {}, `键 ${k}`), h('span', {}, chordName(chordOf(k))), h('em', {}, '点一下换'));
      t.addEventListener('click', () => {
        prog[i] = (prog[i] % 7) + 1;
        paint();
        playChord(chordOf(prog[i]));
        env.touched();
      });
      return t;
    }));
    const hit = PROGS.find((p) => p.keys.join() === prog.join());
    presets.set(hit ? hit.keys.join('-') : null);
    say.innerHTML = rich(hit ? `这一套是 **${prog.join(' → ')}**：${hit.name} 用的就是它。` : `现在是 ${prog.join(' → ')}。点上面的预设听听熟悉的那几套。`);
  }
  paint();
  const el = h('div', { class: 'cl-toy cl-progtoy' },
    h('div', { class: 'cl-row' }, playButton(player), presets),
    h('div', { class: 'cl-cap' }, '一个和弦一小节，四个转一圈。机器上就是 CHORD 弹法下按这几个 Synth key'),
    tiles, say);
  return { el, destroy: () => player.stop() };
}

function progorder(spec, env) {
  const tier = env.tier || 1;
  // 和弦进行就 4 个和弦：金那一档也是 4 张牌（换成随便拼的 4 个）
  return orderQuiz({ cards: byTier(tier, [3, 4, 4]), ...spec, each: 1.1 }, env, (n) => {
    let keys;
    if (tier >= 3) {
      keys = shuffle([1, 2, 3, 4, 5, 6, 7]).slice(0, 4);
    } else {
      keys = [...pick(PROGS.filter((p) => new Set(p.keys).size === 4)).keys].slice(0, n);
    }
    keys = keys.slice(0, n);
    const order = shuffle(keys.map((k, i) => [k, i]));
    return {
      items: order.map(([k]) => ({ tag: '点我听', play: () => playChord(chordOf(k)) })),
      rank: order.map(([, i]) => i),
      ends: ['第一个', '最后一个'],
      target: () => playChords(keys.map(chordOf), { beat: 1 }),
      say: { right: `这一串是键 ${keys.join(' → ')}。` },
    };
  });
}

// ── T12 整首歌搬个家 ──

function transpose(spec, env) {
  let key = 0;
  const riff = [1, 3, 5, 3, 6, 5, 3, 1];
  const player = new LoopPlayer({ bpm: 104, steps: 16 });
  player.onSchedule = (step, t) => {
    if (step % 4 === 0) audio.drum('KICK', t, 0.7);
    if (step % 2 === 0) audio.note(synthKeyNote(riff[step / 2], { scale: 0, key }), t, 0.26, { voice: 'pluck', vel: 0.85 });
    if (step === 0) audio.note(synthKeyNote(1, { scale: 0, key, octave: -2 }), t, 1.6, { voice: 'bass', vel: 0.8 });
  };
  const row = synthKeyRow({ keys: [1, 2, 3, 4, 5, 6, 7], label: (d) => `键 ${d}`, onPress: (d) => { playNotes([synthKeyNote(d, { scale: 0, key })]); env.touched(); } });
  const name = h('b', {});
  const say = h('div', { class: 'cl-note' });
  const paint = () => {
    name.textContent = `${KEY_NAMES[(key + 12) % 12]} 小调`;
    row.btns.forEach((b, i) => (b.querySelector('span').textContent = NAMES[synthKeyNote(i + 1, { scale: 0, key }) % 12]));
    say.innerHTML = rich(key === 0 ? '现在在 **C**。点「播放」，再按 KEY −/+：旋律还是那一串键，整首一起搬家。' : `往${key > 0 ? '上' : '下'}搬了 **${Math.abs(key)} 格**（${Math.abs(key)} 个半音）：每个键下面的音名都跟着变了，弹的还是同一串键。`);
  };
  const move = (d) => {
    key = clamp(key + d, -6, 6);
    paint();
    env.touched();
  };
  paint();
  const el = h('div', { class: 'cl-toy cl-trans' },
    h('div', { class: 'cl-row' }, playButton(player), h('button', { class: 'btn', type: 'button', onclick: () => move(-1) }, 'KEY − 低一格'), h('div', { class: 'cl-big' }, name), h('button', { class: 'btn', type: 'button', onclick: () => move(1) }, 'KEY + 高一格')),
    h('div', { class: 'cl-cap' }, '7 个 Synth keys：下面的字是它现在弹出来的音名'),
    row.el, say);
  return { el, destroy: () => player.stop() };
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
  let i = 0;
  let got = [];
  let cur = null;
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
      done(stars) {
        got[i] = Math.max(got[i] || 0, stars);
        paint();
        if (i < stages.length - 1) {
          const go = h('button', { class: 'btn primary', type: 'button' }, `下一段：${stages[i + 1].title || ''} →`);
          go.addEventListener('click', () => {
            i++;
            mount();
          });
          bar.replaceChildren(h('span', { class: 'cl-pass' }, `第 ${i + 1} 段过了。`), go);
        } else {
          env.done(Math.min(...got));
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
  beatwalk, findone: (s, e, l) => beatwalk(s, e, l, true), octaves, samename, brightdark, majorminor, stack, oddchord,
  steady, gridplay, pickpattern, swingfeel, swingtap, grooves, guessgroove,
  fxlab, drywet, matchcut, whichroom, whichecho,
  // 2026-11-15
  subdict, chromatic, steps12, pentajam, pentaecho, intervals, intervalmem, progression, progorder, transpose,
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
};

// 三档的默认规矩：铜 / 银 / 金。新的几种题自己会看 env.tier；老的几种在这里换参数。关里写了 quiz.tiers 的以它为准
const TIER_DEFAULTS = {
  findone: (t) => ({ need: byTier(t, [3, 4, 6]) }),
  samename: (t) => ({ need: byTier(t, [3, 4, 5]) }),
  majorminor: (t) => ({ need: byTier(t, [3, 4, 5]) }),
  pickpattern: (t) => ({ need: byTier(t, [3, 4, 5]) }),
  guessgroove: (t) => ({ need: byTier(t, [3, 4, 5]) }),
  whichroom: (t) => ({ need: byTier(t, [3, 4, 5]) }),
  whichecho: (t) => ({ need: byTier(t, [3, 4, 5]) }),
  whichfx: (t) => ({ need: byTier(t, [3, 4, 5]) }),
  steps12: (t) => ({ need: byTier(t, [3, 4, 5]) }),
  drywet: (t) => ({ need: byTier(t, [3, 4, 5]), subtle: byTier(t, [1, 0.75, 0.5]) }),
  oddchord: (t) => ({ need: byTier(t, [2, 3, 4]) }),
  steady: (t) => ({ challenge: byTier(t, [6, 8, 12]) }),
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
