// 乐理线重做之后的挑战（2026-11-17，方案见 docs/training-plan.md “乐理线重做”）：都在乐理台（theory-bench.js）上做，
// 用键盘回答，不再是“二选一”。约定和别的玩具一样：make(spec, env) → { el, destroy() }，env.tier 是铜 1 / 银 2 / 金 3，
// 过了调 env.done(几颗星)。每一种另外带一个 __auto()：开发用的走查脚本靠它把这一档答完。
//   octavehunt  T5  亮一个键，点出高一层 / 低一层的它
//   stepecho    T6  听两个音（第一个亮着），在键盘上点出第二个
//   keymatch    T14 键盘上的键 ↔ 机器的 7 个键，配对
//   buildscale  T15 从一个起点搭出大调
//   ladderfix   T7  把梯子修成亮的 / 暗的；金：听啾啾的梯子，把自己的调成一样
//   homeward    T16 一句话差最后一个音：让它回家
//   movehome    T12 啾啾在别的调上弹了一句，把你的梯子搬过去
//   finishline  T17 小作品：给一句没写完的旋律收尾，收进小本子
import { h, rich } from './util.js';
import { sfx } from './sfx.js';
import { store } from './store.js';
import { confetti } from './fx.js';
import { lampRow, passLine, starsByWrong, byTier, pick } from './classroom-kit.js';
import { createTheoryBench, MAJOR, MINOR, PENTA, nameOf, LO, HI } from './theory-bench.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const STEPS = [2, 2, 1, 2, 2, 2, 1];
const STEP_WORD = { 1: '一格', 2: '两格' };
const WHITE = [0, 2, 4, 5, 7, 9, 11];
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
/** 梯子的第 d 级（8 = 高一层的家）是哪个键 */
const degOf = (root, offsets, d) => root + offsets[(d - 1) % offsets.length] + 12 * Math.floor((d - 1) / offsets.length);

/**
 * 这些挑战共用的架子：上面一行（再听 + 答对了几题的灯），一句“要做什么”，乐理台，一行按钮，一行反馈。
 * start(make)：make() → 一轮 { ask, hint?, start(), replay?(), onKey?(m, from, d), solve() }。
 * 轮里用 f.good(话) / f.bad(话, 键) 报对错；答对 need 轮过关，星星看一共错了几次。
 */
function frame(env, need, { listenLabel = '▶ 再听' } = {}) {
  const bench = createTheoryBench();
  const lamps = lampRow(need);
  const ask = h('div', { class: 'tq-ask' });
  const listen = h('button', { class: 'btn primary lg', type: 'button', 'data-sfx': 'none' }, listenLabel);
  const row = h('div', { class: 'tq-row' });
  const note = h('div', { class: 'tq-note', 'aria-live': 'polite' });
  const el = h('div', { class: 'cl-toy tq' }, h('div', { class: 'tq-top' }, listen, lamps.el), ask, bench.el, row, note);
  let right = 0;
  let wrong = 0;
  let round = null;
  let timer = 0;
  let over = false;
  let make = null;
  const f = {
    el, bench, row,
    say(html, bad = false) {
      note.className = `tq-note${bad ? ' bad' : ''}`;
      note.innerHTML = rich(html || '');
    },
    good(msg) {
      if (over) return;
      right++;
      lamps.set(right);
      sfx.play('ok');
      f.say(`✓ ${msg || '对了。'}`);
      if (right >= need) return finish();
      timer = setTimeout(next, 1300);
    },
    bad(msg, m) {
      wrong++;
      sfx.play('nope');
      f.say(msg || '不是这个。', true);
      if (m !== undefined) {
        bench.key(m)?.classList.add('bad');
        setTimeout(() => bench.key(m)?.classList.remove('bad'), 600);
      }
    },
    start(fn) {
      make = fn;
      next();
      return f;
    },
    get round() {
      return round;
    },
    /** 开发用：把这一档答完 */
    async __auto() {
      for (let k = 0; k < need + 2 && !over; k++) {
        await wait(160);
        await round.solve();
        await wait(1450);
      }
      return { right, wrong, over };
    },
    destroy() {
      clearTimeout(timer);
      over = true;
      bench.destroy();
    },
  };
  function next() {
    clearTimeout(timer);
    bench.stop();
    bench.unmark();
    bench.ghostSet([]);
    bench.trailClear();
    bench.locked = false;
    row.replaceChildren();
    round = make();
    ask.innerHTML = rich(round.ask || '');
    f.say(round.hint || '');
    round.start?.();
  }
  function finish() {
    over = true;
    env.done(starsByWrong(wrong));
    confetti(lamps.el, 18);
    note.append(passLine(`过关。${wrong ? `中间错了 ${wrong} 次，不要紧。` : '一次都没错。'}`, () => {
      right = 0;
      wrong = 0;
      over = false;
      lamps.set(0);
      next();
    }));
  }
  listen.addEventListener('click', () => !over && round?.replay?.());
  bench.onKey = (m, from, d) => !over && round?.onKey?.(m, from, d);
  return f;
}

/** 不亮键、只出声地放几个音（挑战里“听了再找”的时候用：亮了就等于告诉答案） */
function blind(bench, midis, gap = 0.6) {
  midis.forEach((m, i) => m !== null && bench.tone(m, { at: i * gap, len: gap * 1.1 }));
}

// ───────────── T5 高一层、低一层 ─────────────

function octavehunt(spec, env) {
  const tier = env.tier || 1;
  const f = frame(env, spec.need || byTier(tier, [3, 4, 6]));
  f.bench.set({ names: tier === 1, keys: false, trail: false });
  let last = -1;
  return f.start(() => {
    let w;
    do w = LO + 12 * rnd(0, 1) + pick(WHITE); while (w === last);
    last = w;
    const opts = [w + 12, w - 12].filter((m) => m >= LO && m <= HI);
    const target = pick(opts);
    const up = target > w;
    const show = () => {
      f.bench.mark(w, 'ref');
      f.bench.tone(w);
      if (tier === 3) setTimeout(() => f.bench.unmark('ref'), 900); // 金：起点只亮一下，要自己记住
    };
    return {
      ask: `${tier === 1 ? `亮着的是 **${nameOf(w)}**` : tier === 2 ? '看亮着的键' : '起点只亮一下，记住它'}。点出**${up ? '高' : '低'}一层**的它。`,
      start: show,
      replay: show,
      onKey(m) {
        if (m === target) {
          f.bench.mark(m, 'good');
          return f.good(`都是 ${nameOf(w)}：${up ? '高' : '低'}了一层，正好一个八度。`);
        }
        if (m === w) return f.bad('这就是起点。要的是另一层的它。', m);
        if ((m - w) % 12 === 0) return f.bad(`名字对了，方向反了：要**${up ? '高' : '低'}**一层的。`, m);
        f.bad('不是同名的。窍门：同名的键“长相”一样，看它左右的黑键是怎么排的。', m);
      },
      solve: () => f.round.onKey(target),
    };
  });
}

// ───────────── T6 听出走了几格 ─────────────

function stepecho(spec, env) {
  const tier = env.tier || 1;
  const f = frame(env, spec.need || byTier(tier, [3, 4, 5]));
  f.bench.set({ keys: false, trail: false });
  const spans = byTier(tier, [[1, 2], [1, 2, 3], [-4, -3, -2, -1, 1, 2, 3, 4]]);
  return f.start(() => {
    const k = pick(spans);
    const s0 = rnd(LO + 5, HI - 6);
    const target = s0 + k;
    const play = () => {
      f.bench.unmark('ref');
      f.bench.mark(s0, 'ref');
      blind(f.bench, [s0, target]);
    };
    return {
      ask: `先响的是亮着的键。**第二个音**是哪个键？点出来。${tier === 3 ? '可能更高，也可能更低。' : '（它比第一个高。）'}`,
      hint: '可以点「再听」。你按的键也会响：和第二个音比一比。',
      start: play,
      replay: play,
      onKey(m) {
        const n = Math.abs(k);
        if (m === target) {
          f.bench.mark(m, 'good');
          return f.good(`走了 **${n} 格**${k < 0 ? '（往左）' : ''}${n === 1 ? '：一格，半音。' : n === 2 ? '：两格，全音。' : '。'}`);
        }
        if (m === s0) return f.bad('这是起点。第二个音是另一个键。', m);
        f.bad(`你按的离起点 ${Math.abs(m - s0)} 格。点「再听」，再比一比。`, m);
      },
      solve: () => f.round.onKey(target),
    };
  });
}

// ───────────── T14 键盘 ↔ 机器的键 ─────────────

function keymatch(spec, env) {
  const tier = env.tier || 1;
  const f = frame(env, spec.need || byTier(tier, [4, 5, 6]));
  let lastD = 0;
  return f.start(() => {
    const root = tier === 3 ? rnd(LO, LO + 7) : LO;
    f.bench.set({ ladder: { root, offsets: MINOR }, home: true, keys: true, degrees: tier === 1, names: false, trail: false });
    let d;
    do d = rnd(1, 7); while (d === lastD);
    lastD = d;
    const p2k = Math.random() < 0.5;
    const m = f.bench.machineNote(d);
    const show = () => {
      f.bench.unmark('target');
      f.bench.tone(m);
      if (p2k) f.bench.mark(m, 'target');
      else f.bench.synthKey(d).classList.add('target');
    };
    return {
      ask: p2k ? '键盘上圈出来的这个，是机器的**键几**？按下面那排。' : `机器的**键 ${d}**亮了。在上面的键盘上点出它。`,
      hint: tier === 3 ? '金：家每一轮都会搬。桔红的是家（键 1），从它往上数。' : '',
      start: show,
      replay: show,
      onKey(pm, from, pd) {
        const ok = p2k ? from === 'synth' && pd === d : from === 'piano' && pm === m;
        if (ok) return f.good(`键 ${d} 就是 ${nameOf(m)}。`);
        if (p2k) return f.bad(from === 'synth' ? `这是键 ${pd}。从桔红的家（键 1）往上数：圈出来的是第几级？` : '用**下面那排**机器的键回答。');
        f.bad(from === 'piano' ? '不是它。从桔红的家往上数亮着的键：第 1 个是键 1。' : '在**上面的键盘**上点。', from === 'piano' ? pm : undefined);
      },
      solve: () => (p2k ? f.round.onKey(m, 'synth', d) : f.round.onKey(m, 'piano', 0)),
    };
  });
}

// ───────────── T15 搭出大调 ─────────────

function buildscale(spec, env) {
  const tier = env.tier || 1;
  const roots = byTier(tier, [[60, 67], [65, 62], [69, 64, 70]]);
  const f = frame(env, spec.need || roots.length, { listenLabel: '▶ 听搭到哪了' });
  f.bench.set({ keys: false, degrees: true, trail: true });
  f.bench.autoTrail = false;
  let n = 0;
  return f.start(() => {
    const root = roots[n++ % roots.length];
    const midis = [root];
    STEPS.forEach((s) => midis.push(midis[midis.length - 1] + s));
    let k = 1;
    const cards = h('div', { class: 'tg-steps' }, STEPS.map((s) => h('span', { class: `s${s}` }, STEP_WORD[s])));
    const paint = () => {
      f.bench.set({ ladder: { root, offsets: midis.slice(0, k).map((m) => m - root).filter((o) => o < 12), noTop: k < midis.length }, home: true });
      [...cards.children].forEach((c, j) => {
        c.classList.toggle('now', j === k - 1);
        c.classList.toggle('done', j < k - 1);
      });
    };
    const done = async () => {
      f.bench.locked = true;
      await f.bench.playLine(midis, { gap: 0.24 });
      f.bench.locked = false;
      f.good(`${nameOf(root)} 大调搭好了${midis.some((m) => [1, 3, 6, 8, 10].includes(m % 12)) ? '：用到了黑键。' : '：全是白键。'}`);
    };
    return {
      ask: `从 **${nameOf(root)}** 出发，搭一把亮的梯子（大调）：一级一级点上去，点到高一层的 ${nameOf(root)}。${tier === 1 ? '' : tier === 2 ? '步子：两格、两格、一格、两格、两格、两格、一格。' : '步子自己记。'}`,
      start() {
        if (tier === 1) f.row.append(cards);
        paint();
      },
      replay: () => f.bench.playLine(midis.slice(0, k), { gap: 0.24 }),
      onKey(m) {
        if (k >= midis.length) return;
        if (m === midis[k]) {
          k++;
          paint();
          f.say(k < midis.length ? `第 ${k} 级到手。` : '');
          if (k === midis.length) done();
          return;
        }
        const from = midis[k - 1];
        f.bad(m <= from ? '要往**右**走。' : tier === 3 ? `不对。你从 ${nameOf(from)} 走了 ${m - from} 格。` : `这一步是**${STEP_WORD[STEPS[k - 1]]}**。你从 ${nameOf(from)} 走了 ${m - from} 格。`, m);
      },
      async solve() {
        k = midis.length;
        paint();
        await done();
      },
    };
  });
}

// ───────────── T7 把梯子修亮 / 修暗 ─────────────

const MOVE = [3, 6, 7];
const MIXES = [MAJOR, MINOR, [0, 2, 3, 5, 7, 9, 10], [0, 2, 4, 5, 7, 9, 10], [0, 2, 3, 5, 7, 9, 11], [0, 2, 4, 5, 7, 8, 10]];
const same = (a, b) => a.every((x, i) => x === b[i]);

function ladderfix(spec, env) {
  const tier = env.tier || 1;
  const f = frame(env, spec.need || byTier(tier, [2, 3, 3]), { listenLabel: tier === 3 ? '▶ 听啾啾的' : '▶ 听这把梯子' });
  f.bench.silent = true;
  f.bench.autoTrail = false;
  let n = 0;
  let lastTarget = null;
  return f.start(() => {
    const root = tier === 1 ? LO : pick([60, 62, 65, 67]);
    let target;
    let offs;
    if (tier === 3) {
      do target = pick(MIXES); while (target === lastTarget || same(target, MAJOR));
      offs = [...MAJOR];
    } else {
      target = n % 2 === 0 ? MINOR : MAJOR;
      if (tier === 1) offs = [...(target === MINOR ? MAJOR : MINOR)];
      else do offs = MAJOR.map((o, i) => (MOVE.includes(i + 1) && Math.random() < 0.5 ? MINOR[i] : o)); while (same(offs, target));
    }
    n++;
    lastTarget = target;
    const line = (o) => [...o.map((x) => root + x), root + 12];
    const set = () => f.bench.set({ ladder: { root, offsets: [...offs] }, home: true, degrees: tier === 1, keys: false, trail: true });
    const check = async () => {
      if (!same(offs, target)) return f.bad('还不一样。两边各听一遍，找找差在哪一级。');
      f.bench.locked = true;
      await f.bench.playLine(line(offs), { gap: 0.22 });
      f.bench.locked = false;
      f.good(tier === 3 ? '一模一样。' : target === MINOR ? '暗下来了：第 3、6、7 级都往左挪了一格。' : '亮回来了：第 3、6、7 级都在原位。');
    };
    return {
      ask: tier === 3
        ? '点「听啾啾的」：啾啾有一把梯子，不给你看。把你的梯子调成**一样的**：第 3、6、7 级，点一下挪一格。'
        : `把这把梯子修成**${target === MINOR ? '暗' : '亮'}**的。点第 3、6、7 级，它们会在两个位置之间来回挪。`,
      hint: tier === 2 ? '银：键上不标第几级了，从桔红的家往上数。' : '',
      start() {
        set();
        if (tier === 3) {
          f.row.append(
            h('button', { class: 'btn', type: 'button', 'data-sfx': 'none', onclick: () => f.bench.playLine(line(offs), { gap: 0.22 }) }, '▶ 听我的'),
            h('button', { class: 'btn primary', type: 'button', 'data-sfx': 'none', onclick: check }, '对一下'));
        }
      },
      replay: () => (tier === 3 ? blind(f.bench, line(target), 0.24) : f.bench.playLine(line(offs), { gap: 0.22 })),
      onKey(m) {
        const k = offs.findIndex((o) => root + o === m);
        if (k < 0) return f.say('点**亮着的键**。', true);
        if (!MOVE.includes(k + 1)) {
          f.bench.tone(m);
          return f.say(`第 ${k + 1} 级不动。能挪的是第 3、6、7 级。`, true);
        }
        offs[k] = offs[k] === MAJOR[k] ? MINOR[k] : MAJOR[k];
        set();
        f.bench.tone(root + offs[k]);
        f.say(`第 ${k + 1} 级${offs[k] === MINOR[k] ? '往左挪了一格' : '挪回去了'}。`);
        if (tier < 3 && same(offs, target)) check();
      },
      async solve() {
        offs = [...target];
        set();
        await check();
      },
    };
  });
}

// ───────────── T16 让它回家 ─────────────

const HOME_LINES = [[1, 2, 3, 5, 4, 3, 2], [5, 4, 3, 4, 5, 7], [3, 4, 5, 3, 2, 7], [8, 7, 5, 4, 3, 2], [1, 3, 5, 8, 7, 5, 2], [5, 6, 5, 4, 3, 2], [3, 2, 1, 2, 3, 5, 7]];

function homeward(spec, env) {
  const tier = env.tier || 1;
  const f = frame(env, spec.need || byTier(tier, [3, 4, 5]), { listenLabel: '▶ 再听这一句' });
  f.bench.silent = true;
  f.bench.autoTrail = false;
  let lastLine = null;
  return f.start(() => {
    const root = tier === 1 ? LO : tier === 2 ? pick([60, 62, 65, 67]) : rnd(60, 69);
    let degs;
    do degs = pick(HOME_LINES); while (degs === lastLine);
    lastLine = degs;
    const head = degs.map((d) => degOf(root, MINOR, d));
    f.bench.set({ ladder: tier === 3 ? null : { root, offsets: MINOR }, home: tier === 1, degrees: tier === 1, keys: false, trail: true });
    const play = async (extra) => {
      f.bench.locked = true;
      await f.bench.playLine(extra === undefined ? head : [...head, extra], { gap: 0.32 });
      f.bench.locked = false;
    };
    return {
      ask: '这一句差最后一个音。点一个键，让它**回家**。',
      hint: tier === 1 ? '家是桔红的那个键。' : tier === 2 ? '银：家没标出来，而且每一轮都会搬。哼一哼：这句话最想停在哪个音上？' : '金：梯子也不亮了。全靠耳朵：哼出它想停下来的那个音，在键盘上找到它。',
      start: () => play(),
      replay: () => play(),
      async onKey(m) {
        if ((m - root) % 12 === 0 && m >= root) {
          await play(m);
          f.bench.trailMarkLast('good');
          return f.good(`回家了：家是 ${nameOf(root)}。`);
        }
        f.bench.tone(m);
        f.bad(tier === 1 ? '还悬着：这不是家。家是桔红的那个。' : '还悬着。点「再听这一句」，哼出它最想停下来的那个音。', m);
      },
      solve: () => f.round.onKey(root + (head[head.length - 1] > root + 6 ? 12 : 0)),
    };
  });
}

// ───────────── T12 把梯子搬过去 ─────────────

const MOVE_LINES = [[1, 3, 5, 4, 3, 2, 1], [5, 3, 1, 2, 3, 5, 8], [1, 2, 3, 1, 5, 4, 3], [8, 7, 5, 3, 4, 2, 1]];

function movehome(spec, env) {
  const tier = env.tier || 1;
  const f = frame(env, spec.need || byTier(tier, [2, 3, 3]), { listenLabel: '▶ 听啾啾的' });
  f.bench.silent = true;
  f.bench.autoTrail = false;
  let lastT = LO;
  return f.start(() => {
    let root = LO;
    let t;
    do t = rnd(LO + 1, LO + 9); while (t === lastT);
    lastT = t;
    const degs = pick(MOVE_LINES);
    const line = (r) => degs.map((d) => degOf(r, MINOR, d));
    const read = h('b', { class: 'tg-key-read' });
    const paint = () => {
      f.bench.set({ ladder: { root, offsets: MINOR }, home: true, keys: false, trail: true, degrees: false });
      read.textContent = `家在 ${nameOf(root)}`;
    };
    const move = (dir) => {
      root = Math.max(LO, Math.min(LO + 11, root + dir));
      paint();
      f.bench.tone(root);
    };
    const hear = async () => {
      if (tier === 1) f.bench.ghostSet(line(t));
      if (tier === 2) f.bench.flash(line(t)[0], 500, 'down');
      blind(f.bench, line(t), 0.32);
    };
    const mine = () => f.bench.playLine(line(root), { gap: 0.32 });
    const check = async () => {
      if (root !== t) return f.bad(root < t ? '你的比啾啾的**低**。再往上挪。' : '你的比啾啾的**高**。往下挪。');
      await mine();
      f.good(`对上了：家搬到了 ${nameOf(t)}。同一句，换了个调。`);
    };
    return {
      ask: '啾啾在另一个调上弹了这一句。用 **KEY − / +** 把你的梯子搬过去，搬到两边听着一样高，再点「对一下」。',
      hint: tier === 1 ? '铜：上面那条虚线是啾啾的。把你的那条挪到和它重合。' : tier === 2 ? '银：啾啾的第一个音会在键盘上亮一下。' : '金：只能听。',
      start() {
        f.row.append(
          h('button', { class: 'btn tg-keybtn', type: 'button', 'data-sfx': 'detent', onclick: () => move(-1) }, 'KEY −'), read,
          h('button', { class: 'btn tg-keybtn', type: 'button', 'data-sfx': 'detent', onclick: () => move(1) }, 'KEY +'),
          h('button', { class: 'btn', type: 'button', 'data-sfx': 'none', onclick: mine }, '▶ 听我的'),
          h('button', { class: 'btn primary', type: 'button', 'data-sfx': 'none', onclick: check }, '对一下'));
        paint();
        hear();
      },
      replay: hear,
      async solve() {
        root = t;
        paint();
        await check();
      },
    };
  });
}

// ───────────── T17 小作品：让它回家 ─────────────

const OPENINGS = [
  { name: '往上走的', degs: [1, 2, 3, 4] }, // 梯子是小调五声：这里的 1 2 3 4 5 是它的第 1–5 个键（标签是 1 3 4 5 7）
  { name: '从高处来的', degs: [6, 5, 4, 5] },
  { name: '原地踏步的', degs: [1, 1, 3, 3] },
];

function finishline(spec, env) {
  const tier = env.tier || 1;
  const count = byTier(tier, [2, 4, 6]);
  const f = frame(env, 1, { listenLabel: '▶ 听整句' });
  const root = LO;
  f.bench.set({ ladder: { root, offsets: PENTA, degrees: [1, 3, 4, 5, 7] }, home: true, degrees: true, keys: false, trail: true });
  f.bench.autoTrail = false;
  f.bench.silent = true;
  return f.start(() => {
    let open = OPENINGS[0];
    let mine = [];
    const given = () => open.degs.map((d) => degOf(root, PENTA, d));
    const slots = h('div', { class: 'tq-slots' });
    const paint = () => {
      const g = given();
      slots.replaceChildren(
        ...g.map((m) => h('i', { class: 'given' }, nameOf(m))),
        ...Array.from({ length: count }, (_, i) => (mine[i] === undefined ? h('i', { class: 'empty' }, '?') : h('i', { class: ['mine', (mine[i] - root) % 12 === 0 && 'home'] }, nameOf(mine[i])))));
      f.bench.trailSet([...g, ...mine]);
    };
    const play = () => f.bench.playLine([...given(), ...mine], { gap: 0.34 });
    const landed = () => mine.length === count && (mine[count - 1] - root) % 12 === 0;
    const save = async () => {
      if (mine.length < count) return f.bad(`还差 ${count - mine.length} 个音。`);
      if (!landed()) return f.bad('最后一个音还没回家：按「退一个」，换成**桔红的键**（家）再收。');
      await play();
      const notes = [...given(), ...mine];
      store.update((d) => {
        d.works ||= [];
        d.works.push({ at: new Date().toISOString(), level: 'T17', root, scale: 'penta', notes });
        if (d.works.length > 30) d.works.splice(0, d.works.length - 30);
      });
      const leap = notes.some((m, i) => i > 0 && Math.abs(m - notes[i - 1]) >= 5);
      f.good(`收进小本子了。${leap ? '里面有一个大跳，挺抓耳，啾。' : '一步一步走回家，很顺，啾。'}`);
    };
    return {
      ask: `啾啾起了个头（灰色的 4 个音）。你来接 **${count} 个音**，让这句话**回家**。只用亮着的键。`,
      hint: '写着玩，没有标准答案。只有一条：最后一个音落在家上。',
      start() {
        const pickOpen = h('div', { class: 'tq-row' }, h('span', { class: 'tb-cap' }, '啾啾的开头'), ...OPENINGS.map((o) => {
          const b = h('button', { class: ['btn sm', o === open && 'primary'], type: 'button', 'data-sfx': 'tick' }, o.name);
          b.addEventListener('click', () => {
            open = o;
            mine = [];
            [...pickOpen.querySelectorAll('.btn')].forEach((x) => x.classList.toggle('primary', x === b));
            paint();
            play();
          });
          return b;
        }));
        f.row.append(pickOpen, slots,
          h('button', { class: 'btn', type: 'button', 'data-sfx': 'none', onclick: () => { mine.pop(); paint(); } }, '⌫ 退一个'),
          h('button', { class: 'btn primary', type: 'button', 'data-sfx': 'none', onclick: save }, '收进小本子'));
        paint();
      },
      replay: play,
      onKey(m) {
        if (!f.bench.degreeOf(m)) return f.say('只用**亮着的键**。', true);
        if (mine.length >= count) return f.say('写满了。点「听整句」听一遍，或者「退一个」改。', true);
        f.bench.tone(m);
        mine.push(m);
        paint();
        f.say(mine.length < count ? `${mine.length} / ${count}` : landed() ? '落在家上了。点「听整句」，满意就「收进小本子」。' : '写满了，可最后一个音还悬着。');
      },
      async solve() {
        mine = Array.from({ length: count }, (_, i) => degOf(root, PENTA, i === count - 1 ? 1 : 3 - (i % 3)));
        paint();
        await save();
      },
    };
  });
}

export const THEORY_TOYS = { octavehunt, stepecho, keymatch, buildscale, ladderfix, homeward, movehome, finishline };
