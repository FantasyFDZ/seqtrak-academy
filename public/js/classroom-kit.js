// 小课堂的公用零件：几种玩具（classroom-toys.js）、几种听辨题（classroom-ear.js）、节奏挑战（classroom-rhythm.js）、
// DJ 线（classroom-dj.js）都从这里拿。原来都写在 classroom-toys.js 里，2026-11-15 拆出来，免得几个文件互相 import。
// 约定（所有玩具都一样）：make(spec, env, level) → { el, destroy() }
//   env.touched()      学生动过一下了（玩一玩用：动过几下之后，页面才把这个东西的名字说出来）
//   env.done(stars)    这一档过了，表现给几颗星（1–3）。可以再玩，取最好的一次。页面再按“铜 / 银 / 金”换成牌（见 views/classroom.js）
//   env.live           是不是接着真机
//   env.tier           现在挑的是第几档：1 铜、2 银、3 金（“玩一玩”是 0）
// 都按手指的大小做：能点的东西至少 44 像素，不靠悬停，不靠键盘。声音全是应用自己合成的。
import { h, rich } from './util.js';
import { audio } from './audio.js';
import { midi } from './midi.js';
import { store } from './store.js';
import { sfx } from './sfx.js';
import { confetti, pop } from './fx.js';

export const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const shuffle = (arr) => arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
/** 一次敲击落在音频时钟的哪一刻（算上「设备」页校准出来的输入延迟） */
export const tapTime = (perfMs) => audio.perfToCtx(perfMs - (store.settings.inputOffsetMs || 0));
export const ms = (sec) => Math.round(sec * 1000);
/** play() 的返回值：是函数就是“停止”，别的（没返回、返回了时长）当成不用停 */
export const asStop = (x) => (typeof x === 'function' ? x : () => {});
/** 第 tier 档的值：arr = [铜, 银, 金]；“玩一玩”（tier 0）和没写的都按铜 */
export const byTier = (tier, arr) => arr[Math.max(0, Math.min(arr.length - 1, (tier || 1) - 1))];

export function playButton(player, { onToggle } = {}) {
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
export function tapPad(label, onHit, sub = '') {
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

export const pad16 = (p) => String(p || '').replace(/[^xX-]/g, '').toLowerCase().padEnd(16, '-').slice(0, 16);

/** 16 个格子，摆成机器上那两排方键的样子（上排 1–8，下排 9–16）。editable = 可以点 */
export function keys16({ pattern = '', editable = false, onChange, small = false } = {}) {
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
    cells,
    get: () => p,
    set(v) {
      p = pad16(v);
      paint();
    },
    setHead(s) {
      cells.forEach((c, i) => c.classList.toggle('head', i === s));
    },
    /** 核对之后：哪几格对了、哪几格错了（target 是答案） */
    mark(target) {
      const t = pad16(target);
      cells.forEach((c, i) => {
        c.classList.toggle('miss', t[i] === 'x' && p[i] !== 'x');
        c.classList.toggle('extra', t[i] !== 'x' && p[i] === 'x');
      });
    },
    unmark() {
      cells.forEach((c) => c.classList.remove('miss', 'extra'));
    },
  };
}

/** 一串音，隔 gap 秒一个地放出来。返回大约要放多久（秒） */
export function playNotes(notes, { gap = 0.3, len = 0.42, voice = 'keys', vel = 0.85 } = {}) {
  audio.init().then((ok) => {
    if (!ok) return;
    const t0 = audio.now() + 0.04;
    notes.forEach((n, i) => n !== null && audio.note(n, t0 + i * gap, len, { voice, vel }));
  });
  return notes.length * gap + len;
}

/** 几个音一起响；spread = 先一个一个，再一起 */
export function playChord(notes, { spread = false, voice = 'keys', at = 0, len = 1.1 } = {}) {
  audio.init().then((ok) => {
    if (!ok) return;
    const t0 = audio.now() + 0.03 + at;
    if (spread) notes.forEach((n, i) => audio.note(n, t0 + i * 0.32, 0.4, { voice, vel: 0.8 }));
    const start = spread ? t0 + notes.length * 0.32 + 0.1 : t0;
    notes.forEach((n, i) => audio.note(n, start + i * 0.012, len, { voice, vel: notes.length > 1 ? 0.55 : 0.85 }));
  });
}

/** 一排和弦，一个接一个（每个 beat 秒） */
export function playChords(list, { beat = 0.9, voice = 'keys' } = {}) {
  audio.init().then((ok) => {
    if (!ok) return;
    const t0 = audio.now() + 0.04;
    list.forEach((notes, i) => notes.forEach((n, j) => audio.note(n, t0 + i * beat + j * 0.01, beat * 0.92, { voice, vel: 0.5 })));
  });
  return list.length * beat;
}

/** 放一小段循环，放满 bars 小节自己停。返回停止函数 */
export function playLoopOnce(player, bars = 2) {
  player.stop();
  player.start();
  const id = setTimeout(() => player.stop(), (60 / player.bpm) * 4 * bars * 1000 + 60);
  return () => {
    clearTimeout(id);
    player.stop();
  };
}

/** 一排“答对了几题”的小灯 */
export function lampRow(need) {
  const el = h('div', { class: 'cl-lamps', 'aria-label': '答对了几题' });
  let on = 0;
  const marks = [];
  const paint = () => el.replaceChildren(...Array.from({ length: need }, (_, i) => h('i', { class: i < on ? 'on' : marks[i] === false ? 'miss' : '' })));
  paint();
  return {
    el,
    set(n) {
      on = n;
      paint();
      if (n > 0) pop(el.children[n - 1]);
    },
    get on() {
      return on;
    },
    setNeed(n) {
      need = n;
      paint();
    },
  };
}

/** 答错几次给几颗星：0 → 3，1 → 2，再多 → 1 */
export const starsByWrong = (wrong) => (wrong === 0 ? 3 : wrong === 1 ? 2 : 1);

/** 过关那一行：“过关。……” + 再玩一轮 */
export function passLine(text, again) {
  const btn = h('button', { class: 'btn sm', type: 'button', onclick: again }, '再玩一轮');
  return h('div', { class: 'cl-pass' }, text, btn);
}

/**
 * “听一听，选一个”的公用骨架。答对 need 题过关；答错不扣分，马上换下一题。星星看错了几次。
 * make() → { play(auto) → 停止函数, options: [{ label 或 node, right }], say: { right, wrong }, reveal?() }
 * stage：摆在题目上面的东西（比如一台实验台）。
 */
export function listenQuiz({ need = 3, env, make, stage = null, listenLabel = '▶ 听' }) {
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
    stopPlay = asStop(round.play(auto));
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
    opts.style.gridAutoFlow = round.options.length > 4 ? 'row' : '';
    opts.style.gridTemplateColumns = round.options.length > 4 ? `repeat(${Math.ceil(round.options.length / 2)}, minmax(0, 1fr))` : '';
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
    const stars = starsByWrong(wrong);
    env.done(stars);
    confetti(lamps, 18);
    note.append(passLine(`过关。${wrong ? `中间错了 ${wrong} 次，不要紧。` : '一次都没错。'}`, () => {
      right = 0;
      wrong = 0;
      paintLamps();
      next(true);
    }));
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

/** 一排 7 个 Synth key 的样子（中间两排键）：点它出声。keys = 要摆的键（1–7），notes(d) = 这个键发什么音 */
export function synthKeyRow({ keys = [1, 2, 3, 4, 5, 6, 7], label = (d) => `键 ${d}`, sub = () => '', onPress } = {}) {
  const btns = keys.map((d) => {
    const b = h('button', { class: 'cl-skey', type: 'button', 'data-sfx': 'none', 'data-key': String(d) }, h('b', {}, label(d)), h('span', {}, sub(d)), h('em', {}));
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      b.classList.add('down');
      setTimeout(() => b.classList.remove('down'), 160);
      onPress?.(d, b);
    });
    b.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && !e.repeat && onPress?.(d, b));
    return b;
  });
  return { el: h('div', { class: 'cl-skeys', style: { gridTemplateColumns: `repeat(${keys.length}, minmax(0, 1fr))` } }, btns), btns };
}
