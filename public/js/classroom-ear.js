// 小课堂的几种听辨题（2026-11-15 加的，原来只有“听一听，选一个”）。这里只有题型的骨架，题目从哪来（听什么）由调用的一方给：
//   orderQuiz   排顺序：几张牌各是一段声音，按“从暗到亮 / 从低到高 / 从冷到热”排好
//   oddQuiz     找不同：几张牌里只有一张和别的不一样
//   memoryQuiz  记忆配对：翻牌，两张一样的声音配成一对
//   dictateQuiz 格子听写：听一段节奏，在 16 个格子（机器上那两排方键）上点出来
//   echoQuiz    啾啾唱一句，你弹回来：在屏幕上的几个键上（或真机的 Synth keys 上）照着弹
//   askQuiz     快问快答：一句话的选择题（每日五分钟、关底大关用）
// 约定和别的玩具一样，见 classroom-kit.js 开头。每种题都是“答对几轮过关”，答错不扣分、马上下一轮，星星看错了几次。
import { h, rich } from './util.js';
import { audio } from './audio.js';
import { LoopPlayer } from './looper.js';
import { midi } from './midi.js';
import { sfx } from './sfx.js';
import { confetti, pop } from './fx.js';
import { synthKeyNote, SCALES } from './scales.js';
import * as jiu from './jiu.js';
import { shuffle, keys16, pad16, starsByWrong, passLine, byTier, synthKeyRow, asStop } from './classroom-kit.js';

const LETTERS = 'ABCDEFGH';

/** 每种题自己的那一排小灯 + 一行字 + 过关之后的“再玩一轮” */
function frame(need) {
  let right = 0;
  let wrong = 0;
  const lamps = h('div', { class: 'cl-lamps', 'aria-label': '答对了几轮' });
  const note = h('div', { class: 'cl-note' });
  const paint = () => lamps.replaceChildren(...Array.from({ length: need }, (_, i) => h('i', { class: i < right ? 'on' : '' })));
  paint();
  return {
    lamps,
    note,
    get right() {
      return right;
    },
    get wrong() {
      return wrong;
    },
    hit() {
      right++;
      paint();
      pop(lamps.children[right - 1]);
      sfx.play('ok');
      return right >= need;
    },
    miss() {
      wrong++;
      sfx.play('nope');
    },
    reset() {
      right = 0;
      wrong = 0;
      paint();
    },
    say(html) {
      note.innerHTML = rich(html);
    },
    /** 过关：给星，撒彩带，摆“再玩一轮” */
    pass(env, again, extra = '') {
      env.done(starsByWrong(wrong));
      confetti(lamps, 18);
      note.append(passLine(`过关。${wrong ? `中间错了 ${wrong} 次，不要紧。` : '一次都没错。'}${extra}`, () => {
        right = 0;
        wrong = 0;
        paint();
        again();
      }));
    },
  };
}

// ───────────── 排顺序 ─────────────

/**
 * make(n) → { items: [{ play() → 停止函数?, tag? }], rank: [每张牌的名次 0…n-1], ends: ['最暗', '最亮'], say?: { right, wrong } }
 * spec.cards = 几张牌（按档：铜 3、银 4、金 5，没写就看 spec.n），spec.need = 排对几轮
 */
export function orderQuiz(spec, env, make) {
  const n = spec.cards || byTier(env.tier, [3, 4, 5]);
  const need = spec.need || byTier(env.tier, [2, 2, 3]);
  const f = frame(need);
  let round = null;
  let slots = [];
  let stop = () => {};
  let timer = 0;
  let locked = false;
  const pool = h('div', { class: 'cl-order-pool' });
  const row = h('div', { class: 'cl-order-slots' });
  const axis = h('div', { class: 'cl-order-axis' });
  const listenAll = h('button', { class: 'btn', type: 'button' }, '▶ 按我排的听一遍');
  const target = h('button', { class: 'btn primary', type: 'button', hidden: true }, '▶ 听原句');
  const check = h('button', { class: 'btn primary', type: 'button', disabled: true }, '对一下');
  const clearBtn = h('button', { class: 'btn ghost', type: 'button' }, '重排');
  const el = h('div', { class: 'cl-toy cl-order' },
    h('div', { class: 'cl-row' }, target, h('span', { class: 'cl-cap' }, '点牌听，再点“放进去”。排好了点“对一下”'), h('span', { class: 'spacer' }), f.lamps),
    pool, axis, row,
    h('div', { class: 'cl-row' }, listenAll, clearBtn, h('span', { class: 'spacer' }), check),
    f.note);

  const play = (i) => {
    stop();
    stop = asStop(round.items[i].play());
    const card = pool.children[i];
    card?.classList.add('heard');
    pop(card?.querySelector('.cl-card'));
  };

  function paint() {
    [...pool.children].forEach((box, i) => box.classList.toggle('used', slots.includes(i)));
    row.replaceChildren(...Array.from({ length: n }, (_, k) => {
      const i = slots[k];
      const s = h('button', { class: ['cl-slot', i !== undefined && 'full'], type: 'button', 'data-sfx': 'none' }, i === undefined ? String(k + 1) : LETTERS[i]);
      s.addEventListener('click', () => {
        if (locked || i === undefined) return;
        slots.splice(k, 1);
        paint();
      });
      return s;
    }));
    check.disabled = slots.length < n || locked;
  }

  function next() {
    clearTimeout(timer);
    stop();
    locked = false;
    round = make(n);
    slots = [];
    target.hidden = !round.target;
    axis.replaceChildren(h('span', {}, `← ${round.ends[0]}`), h('span', {}, `${round.ends[1]} →`));
    pool.replaceChildren(...round.items.map((it, i) => {
      const face = h('button', { class: 'cl-card', type: 'button', 'data-sfx': 'none' }, h('b', {}, LETTERS[i]), h('span', {}, it.tag || '点我听'));
      face.addEventListener('click', () => play(i));
      const put = h('button', { class: 'btn sm', type: 'button' }, '放进去');
      put.addEventListener('click', () => {
        if (locked || slots.includes(i) || slots.length >= n) return;
        slots.push(i);
        paint();
        if (slots.length === n) f.say('排满了。可以先“按我排的听一遍”，再点“对一下”。');
      });
      return Object.assign(h('div', { class: 'cl-cardbox' }, face, put), { __rank: round.rank[i] }); // __rank：给走查脚本用
    }));
    pool.style.gridTemplateColumns = `repeat(${n}, minmax(0, 1fr))`;
    row.style.gridTemplateColumns = `repeat(${n}, minmax(0, 1fr))`;
    paint();
    f.say(f.right || f.wrong ? '下一轮。' : round.target ? '先点「听原句」，再点牌一张张听，按听到的顺序放进下面的格子。' : `每张牌点一下听听，按“${round.ends[0]} → ${round.ends[1]}”排。`);
  }

  listenAll.addEventListener('click', () => {
    if (!slots.length) return f.say('先把牌放进下面的格子里。');
    stop();
    let k = 0;
    const each = spec.each || 1.6;
    const go = () => {
      if (k >= slots.length) return;
      play(slots[k]);
      row.children[k]?.classList.add('now');
      const at = k;
      setTimeout(() => row.children[at]?.classList.remove('now'), each * 900);
      k++;
      timer = setTimeout(go, each * 1000);
    };
    go();
    stop = ((prev) => () => {
      clearTimeout(timer);
      prev();
    })(stop);
  });
  target.addEventListener('click', () => {
    stop();
    round.target?.();
  });
  clearBtn.addEventListener('click', () => {
    if (locked) return;
    slots = [];
    paint();
  });
  check.addEventListener('click', () => {
    if (slots.length < n || locked) return;
    locked = true;
    const ok = slots.every((i, k) => round.rank[i] === k);
    [...row.children].forEach((s, k) => s.classList.add(round.rank[slots[k]] === k ? 'right' : 'wrong'));
    const answer = round.rank.map((r, i) => [r, i]).sort((a, b) => a[0] - b[0]).map(([, i]) => LETTERS[i]).join(' → ');
    if (ok) {
      const done = f.hit();
      f.say(`✓ ${round.say?.right || '排对了。'}`);
      if (done) return f.pass(env, next);
      timer = setTimeout(next, 1800);
    } else {
      f.miss();
      f.say(`对的顺序是 **${answer}**。${round.say?.wrong || ''}再点牌听听区别。`);
      paint();
      const again = h('button', { class: 'btn sm', type: 'button', onclick: next }, '下一轮');
      f.note.append(' ', again);
    }
  });

  next();
  return {
    el,
    destroy() {
      clearTimeout(timer);
      stop();
      round?.destroy?.();
    },
  };
}

// ───────────── 找不同 ─────────────

/**
 * make(n) → { cards: [{ play() → 停止函数? }], odd: 第几张不一样, say: { right, wrong } }
 * spec.cards = 几张牌（铜 3、银 3、金 4），spec.need = 找对几次
 */
export function oddQuiz(spec, env, make) {
  const n = spec.cards || byTier(env.tier, [3, 3, 4]);
  const need = spec.need || byTier(env.tier, [2, 3, 4]);
  const f = frame(need);
  let round = null;
  let stop = () => {};
  let timer = 0;
  let locked = false;
  const cards = h('div', { class: 'cl-cards' });
  const el = h('div', { class: 'cl-toy cl-odd' }, h('div', { class: 'cl-row' }, h('span', { class: 'cl-cap' }, spec.cap || '每张都点一下，把不一样的那张找出来'), h('span', { class: 'spacer' }), f.lamps), cards, f.note);

  function next() {
    clearTimeout(timer);
    stop();
    locked = false;
    round?.destroy?.();
    round = make(n);
    cards.style.gridTemplateColumns = `repeat(${n}, minmax(0, 1fr))`;
    cards.replaceChildren(...round.cards.map((c, i) => {
      const face = h('button', { class: 'cl-card', type: 'button', 'data-sfx': 'none' }, h('b', {}, LETTERS[i]), h('span', {}, '点我听'));
      const choose = h('button', { class: 'btn sm', type: 'button' }, '就是它');
      face.addEventListener('click', () => {
        stop();
        stop = asStop(c.play());
        face.classList.add('heard');
        pop(face);
      });
      choose.addEventListener('click', () => {
        if (locked) return;
        locked = true;
        stop();
        const ok = i === round.odd;
        [...cards.children].forEach((x, j) => x.classList.add(j === round.odd ? 'right' : j === i ? 'wrong' : 'dim'));
        if (ok) {
          const done = f.hit();
          f.say(`✓ ${round.say.right}`);
          if (done) return f.pass(env, next);
          timer = setTimeout(next, 2000);
        } else {
          f.miss();
          f.say(round.say.wrong);
          timer = setTimeout(next, 4200);
        }
      });
      return Object.assign(h('div', { class: 'cl-cardbox' }, face, choose), { __odd: i === round.odd });
    }));
    f.say(spec.hint || '三张都点一下，听出哪张和别的不一样。');
  }

  next();
  return {
    el,
    destroy() {
      clearTimeout(timer);
      stop();
      round?.destroy?.();
    },
  };
}

// ───────────── 记忆配对 ─────────────

/**
 * make(pairs) → { groups: [{ id, name, play() → 停止函数? }] }：给几组，每组两张牌一样的声音
 * spec.pairs = 几对（铜 3、银 4、金 5）
 */
export function memoryQuiz(spec, env, make) {
  const pairs = spec.pairs || byTier(env.tier, [3, 4, 5]);
  let deck = [];
  let open = [];
  let matched = 0;
  let misses = 0;
  let busy = false;
  let stop = () => {};
  let timer = 0;
  let set = null;
  const grid = h('div', { class: 'cl-mem' });
  const count = h('div', { class: 'cl-count' });
  const note = h('div', { class: 'cl-note' });
  const el = h('div', { class: 'cl-toy cl-memory' },
    h('div', { class: 'cl-row' }, h('span', { class: 'cl-cap' }, spec.cap || '翻两张：声音一样就配成一对'), h('span', { class: 'spacer' }), count),
    grid, note);
  const paintCount = () => (count.textContent = `${matched} / ${pairs} 对`);

  function deal() {
    clearTimeout(timer);
    stop();
    set?.destroy?.();
    set = make(pairs);
    deck = shuffle(set.groups.flatMap((g) => [g, g])).map((g, i) => ({ g, i, done: false }));
    open = [];
    matched = 0;
    misses = 0;
    busy = false;
    const cols = deck.length <= 6 ? 3 : deck.length <= 8 ? 4 : 5;
    grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    grid.replaceChildren(...deck.map((c) => {
      const b = h('button', { class: 'cl-memcard', type: 'button', 'data-sfx': 'none' }, h('b', {}, String(c.i + 1)), h('span', {}));
      b.__group = c.g.id; // 给走查脚本用
      b.addEventListener('click', () => flip(c, b));
      c.btn = b;
      return b;
    }));
    paintCount();
    note.innerHTML = rich(spec.hint || '点一张牌，听它；再点一张，看是不是一样的。');
  }

  function flip(c, b) {
    if (busy || c.done || open.includes(c)) return;
    stop();
    stop = asStop(c.g.play());
    b.classList.add('open');
    pop(b);
    open.push(c);
    if (open.length < 2) return;
    const [a, z] = open;
    if (a.g.id === z.g.id) {
      a.done = z.done = true;
      matched++;
      sfx.play('ok');
      for (const x of [a, z]) {
        x.btn.classList.add('done');
        x.btn.querySelector('span').textContent = x.g.name;
      }
      open = [];
      paintCount();
      note.innerHTML = rich(`✓ 一对：**${a.g.name}**。${a.g.say || ''}`);
      if (matched === pairs) {
        const stars = misses <= Math.floor(pairs / 2) ? 3 : misses <= pairs ? 2 : 1;
        env.done(stars);
        confetti(count, 20);
        note.append(passLine(`全配上了。翻错了 ${misses} 次。`, deal));
      }
      return;
    }
    misses++;
    busy = true;
    timer = setTimeout(() => {
      for (const x of open) x.btn.classList.remove('open');
      open = [];
      busy = false;
    }, 1300);
    note.textContent = '不是一对。记住它们的位置。';
  }

  deal();
  return {
    el,
    destroy() {
      clearTimeout(timer);
      stop();
      set?.destroy?.();
    },
  };
}

// ───────────── 格子听写 ─────────────

/**
 * make() → { target: 节奏串, track: 'KICK', bpm, backing: { 轨道: 节奏串 }, given?: 先摆好的（答案里的几格）, say? }
 * spec.need = 写对几段；点“对一下”错了不算一轮，只记一次错，可以接着改
 */
export function dictateQuiz(spec, env, make) {
  const need = spec.need || byTier(env.tier, [1, 2, 3]);
  const f = frame(need);
  let round = null;
  let stop = () => {};
  let timer = 0;
  let solved = false;
  const player = new LoopPlayer({ bpm: 100, click: true });
  const grid = keys16({ editable: true, onChange: () => { grid.unmark(); solved = false; } });
  const target = h('button', { class: 'btn primary lg', type: 'button' }, '▶ 听题目');
  const mine = h('button', { class: 'btn', type: 'button' }, '▶ 听我写的');
  const check = h('button', { class: 'btn primary', type: 'button' }, '对一下');
  const cap = h('div', { class: 'cl-cap' });
  const el = h('div', { class: 'cl-toy cl-dict' },
    h('div', { class: 'cl-row' }, target, mine, h('span', { class: 'spacer' }), f.lamps),
    cap, grid.el,
    h('div', { class: 'cl-row' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => { grid.set(round.given || ''); grid.unmark(); } }, '清空'), h('span', { class: 'spacer' }), check),
    f.note);
  player.onStep((s) => grid.setHead(s));
  el.__round = () => round; // 给走查脚本用

  const run = (pattern) => {
    stop();
    player.bpm = round.bpm || 100;
    player.set({ ...(round.backing || {}), [round.track]: pattern });
    player.stop();
    player.start();
    const id = setTimeout(() => player.stop(), (60 / player.bpm) * 4 * (round.bars || 2) * 1000 + 60);
    stop = () => {
      clearTimeout(id);
      player.stop();
    };
  };
  target.addEventListener('click', () => run(round.target));
  mine.addEventListener('click', () => run(grid.get()));

  function next() {
    clearTimeout(timer);
    stop();
    solved = false;
    round = make();
    grid.set(round.given || '');
    grid.unmark();
    cap.textContent = round.cap || `${round.label || '底鼓'} · 和机器上那两排方键一样：上排 1–8，下排 9–16`;
    f.say(round.say || '点「听题目」，听它在哪几格响，再把格子点亮。可以反复听。');
  }

  check.addEventListener('click', () => {
    if (solved) return;
    const t = pad16(round.target);
    const p = grid.get();
    grid.mark(t);
    if (p === t) {
      solved = true;
      const done = f.hit();
      f.say('✓ 一格不差。再听一遍，看着格子走。');
      run(t);
      if (done) return f.pass(env, next);
      timer = setTimeout(next, 2600);
    } else {
      f.miss();
      const miss = [...t].filter((c, i) => c === 'x' && p[i] !== 'x').length;
      const extra = [...p].filter((c, i) => c === 'x' && t[i] !== 'x').length;
      f.say(`还差一点：${miss ? `少了 ${miss} 下（虚线框）` : ''}${miss && extra ? '，' : ''}${extra ? `多了 ${extra} 下（红框）` : ''}。改一改再对。`);
    }
  });

  next();
  return {
    el,
    destroy() {
      clearTimeout(timer);
      stop();
    },
  };
}

// ───────────── 啾啾唱一句，你弹回来 ─────────────

/**
 * make(len) → { degrees: [键…], keys: 屏幕上摆哪几个键, scale, key, octave, gap }：啾啾唱的那一句（第几个 Synth key）
 * spec.len = 一句几个音（铜 2、银 3、金 4），spec.need = 弹对几句
 * 真机：音阶要和这一题一样（比如五声那一关要先把 [SCALE] 换到 MINOR PENTATONIC），按的音按音名认
 */
export function echoQuiz(spec, env, make) {
  const len = spec.len || byTier(env.tier, [2, 3, 4]);
  const need = spec.need || byTier(env.tier, [2, 3, 3]);
  const f = frame(need);
  let round = null;
  let got = [];
  let timer = 0;
  let listening = false;
  let singing = 0;
  const sing = h('button', { class: 'btn primary lg', type: 'button' }, '▶ 啾啾唱一句');
  const typed = h('div', { class: 'cl-echo-typed' });
  const keysBox = h('div', { class: 'cl-echo-keys' });
  let row = null;
  const el = h('div', { class: 'cl-toy cl-echo' },
    h('div', { class: 'cl-row' }, sing, h('span', { class: 'spacer' }), f.lamps),
    h('div', { class: 'cl-cap' }, `啾啾唱几个音，你在下面的键上照着弹（${len} 个音）`),
    typed, keysBox, f.note);

  el.__round = () => round; // 给走查脚本用
  const noteOf = (d) => synthKeyNote(d, { scale: round.scale ?? 0, key: round.key || 0, octave: round.octave ?? -1 });
  const paintTyped = () => typed.replaceChildren(...Array.from({ length: len }, (_, i) => h('i', { class: got[i] !== undefined ? 'on' : '' }, got[i] !== undefined ? String(got[i]) : '·')));

  function singNow() {
    clearTimeout(singing);
    audio.init().then((ok) => {
      if (!ok) return;
      const gap = round.gap || 0.42;
      const t0 = audio.now() + 0.05;
      round.degrees.forEach((d, i) => audio.note(noteOf(d), t0 + i * gap, gap * 0.85, { voice: 'keys', vel: 0.7 }));
      jiu.chirp('echo', { notes: round.degrees.map((d, i) => [i * gap, noteOf(d) + 12, gap * 0.8]) });
      jiu.setMood('happy', 1500);
    });
    listening = true;
    got = [];
    paintTyped();
    f.say('该你了：照着弹。');
  }
  sing.addEventListener('click', singNow);

  function press(d, btn) {
    audio.init().then((ok) => ok && audio.note(noteOf(d), audio.now() + 0.01, 0.4, { voice: 'keys', vel: 0.85 }));
    if (!listening) return f.say('先点「啾啾唱一句」。');
    got.push(d);
    paintTyped();
    if (btn) pop(btn);
    if (got.length < len) return;
    listening = false;
    const ok = got.every((x, i) => x === round.degrees[i]);
    if (ok) {
      const done = f.hit();
      f.say(`✓ 一模一样：键 ${round.degrees.join(' → ')}。`);
      jiu.chirp('ok');
      if (done) return f.pass(env, next);
      timer = setTimeout(() => {
        next();
        singNow();
      }, 1600);
    } else {
      f.miss();
      f.say(`啾啾唱的是 **键 ${round.degrees.join(' → ')}**，你弹的是 ${got.join(' → ')}。点「啾啾唱一句」再来。`);
      row?.btns.forEach((b) => b.classList.toggle('hint', round.degrees.includes(Number(b.dataset.key))));
      setTimeout(() => row?.btns.forEach((b) => b.classList.remove('hint')), 1800);
    }
  }

  function next() {
    clearTimeout(timer);
    round = make(len);
    got = [];
    listening = false;
    row = synthKeyRow({ keys: round.keys, label: (d) => String(d), sub: (d) => round.names?.[d] || '', onPress: (d, b) => press(d, b) });
    keysBox.replaceChildren(row.el);
    paintTyped();
    f.say(f.right || f.wrong ? '下一句。' : '点「啾啾唱一句」，听完在下面照着弹。');
  }

  // 真机上弹也算：按音名对回这一题的键
  const off = midi.on('noteon', (m) => {
    if (!round) return;
    const pc = ((m.note % 12) + 12) % 12;
    const d = round.keys.find((k) => ((noteOf(k) % 12) + 12) % 12 === pc);
    if (d) press(d, row?.btns.find((b) => Number(b.dataset.key) === d));
  });

  next();
  return {
    el,
    destroy() {
      clearTimeout(timer);
      clearTimeout(singing);
      off();
    },
  };
}

/** 一句旋律的常用写法：在 keys 这几个键里随机走 len 步，相邻两个音最多跳 maxJump 个键 */
export function randomPhrase(keys, len, maxJump = 2) {
  const out = [keys[Math.floor(Math.random() * Math.min(3, keys.length))]];
  while (out.length < len) {
    const at = keys.indexOf(out[out.length - 1]);
    const near = keys.filter((_, i) => Math.abs(i - at) <= maxJump && i !== at);
    out.push(near[Math.floor(Math.random() * near.length)]);
  }
  return out;
}

export const SCALE_NAME = (i) => SCALES[i]?.name || '';

// ───────────── 快问快答 ─────────────

/** spec.items = [{ q, a: [对的, 错的…], why? }]；need = 答对几题 */
export function askQuiz(spec, env) {
  const items = shuffle(spec.items || []);
  const need = Math.min(items.length, spec.need || byTier(env.tier, [2, 3, 3]));
  const f = frame(need);
  let i = -1;
  let timer = 0;
  const q = h('div', { class: 'cl-ask-q' });
  const opts = h('div', { class: 'cl-opts cl-ask-opts' });
  const el = h('div', { class: 'cl-toy cl-ask' }, h('div', { class: 'cl-row' }, h('span', { class: 'cl-cap' }, '快问快答'), h('span', { class: 'spacer' }), f.lamps), q, opts, f.note);

  function next() {
    clearTimeout(timer);
    i = (i + 1) % items.length;
    const it = items[i];
    q.innerHTML = rich(it.q);
    let locked = false;
    const list = shuffle(it.a.map((text, k) => ({ text, right: k === 0 })));
    opts.style.gridAutoFlow = 'row';
    opts.style.gridTemplateColumns = '1fr';
    opts.replaceChildren(...list.map((o) => {
      const b = h('button', { class: 'cl-opt', type: 'button', html: rich(o.text) });
      b.__right = o.right;
      b.addEventListener('click', () => {
        if (locked) return;
        locked = true;
        b.classList.add(o.right ? 'right' : 'wrong');
        [...opts.children].forEach((x) => x.__right && x.classList.add('right'));
        if (o.right) {
          const done = f.hit();
          f.say(`✓ ${it.why || '对。'}`);
          if (done) return f.pass(env, next);
          timer = setTimeout(next, 1500);
        } else {
          f.miss();
          f.say(it.why || '是绿框那个。');
          timer = setTimeout(next, 3200);
        }
      });
      return b;
    }));
    f.say('');
  }

  next();
  return { el, destroy: () => clearTimeout(timer) };
}
