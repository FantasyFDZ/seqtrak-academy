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
import { progSlots } from './theory-guide.js';

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
export function frame(env, need, { listenLabel = '▶ 再听' } = {}) {
  const bench = createTheoryBench();
  const lamps = lampRow(need);
  const ask = h('div', { class: 'tq-ask' });
  const listen = h('button', { class: 'btn primary lg', type: 'button', 'data-sfx': 'none' }, listenLabel);
  const row = h('div', { class: 'tq-row' });
  const tools = h('div', { class: 'tq-tools' }); // 写一写（小作品）的工具按钮摆在「听」旁边：省一行
  const note = h('div', { class: 'tq-note', 'aria-live': 'polite' });
  const el = h('div', { class: 'cl-toy tq' }, h('div', { class: 'tq-top' }, listen, tools, lamps.el), ask, bench.el, row, note);
  let right = 0;
  let wrong = 0;
  let round = null;
  let timer = 0;
  let over = false;
  let make = null;
  const f = {
    el, bench, row, tools,
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
    bench.chord(null);
    bench.lamps(null);
    bench.locked = false;
    row.replaceChildren();
    tools.replaceChildren();
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
  bench.onPick = (i) => !over && round?.onPick?.(i);
  return f;
}

/** 不亮键、只出声地放几个音（挑战里“听了再找”的时候用：亮了就等于告诉答案） */
export function blind(bench, midis, gap = 0.6) {
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

// ═════════════ 第二期：单元 3「旋律」、单元 4「和声」 ═════════════

const rungIn = (root, offsets, m) => {
  const oct = Math.floor((m - root) / 12);
  const k = offsets.indexOf(m - root - 12 * oct);
  return k < 0 ? null : oct * offsets.length + k;
};
const names = (notes) => notes.map(nameOf).join(' ');
export const btn = (label, fn, cls = '') => h('button', { class: `btn ${cls}`, type: 'button', 'data-sfx': 'none', onclick: fn }, label);
/** 放的时候按键没反应 */
export async function locked(bench, fn) {
  bench.locked = true;
  try {
    await fn();
  } finally {
    bench.locked = false;
  }
}
/** 小作品存进进度文件的 works（小本子）。旧的只有 { at, level, root, scale, notes }；第二期多了 cells（格子里的音）、steps、bpm、chords、bass、end */
function saveWork(work) {
  store.update((d) => {
    d.works ||= [];
    d.works.push({ at: new Date().toISOString(), ...work });
    if (d.works.length > 30) d.works.splice(0, d.works.length - 30);
  });
}

// ───────────── T18 跳完，往回走一步 ─────────────

function leapback(spec, env) {
  const tier = env.tier || 1;
  const f = frame(env, spec.need || byTier(tier, [3, 4, 5]), { listenLabel: '▶ 再听' });
  f.bench.autoTrail = false;
  let last = '';
  return f.start(() => {
    const root = tier === 1 ? LO : pick([60, 62, 65, 67]);
    f.bench.set({ ladder: { root, offsets: MINOR }, home: true, degrees: tier === 1, keys: false, trail: tier < 3 });
    let a;
    let b;
    do {
      a = rnd(0, 7);
      b = a + pick([-4, -3, -2, 2, 3, 4]);
    } while (b < 0 || b > 7 || `${a}${b}` === last);
    last = `${a}${b}`;
    const up = b > a;
    const key = (r) => f.bench.degMidi(r + 1);
    const target = key(up ? b - 1 : b + 1);
    const play = async () => {
      f.bench.unmark('ref');
      if (tier < 3) return locked(f.bench, () => f.bench.playLine([key(a), key(b)], { gap: 0.5 }));
      f.bench.mark(key(a), 'ref');
      blind(f.bench, [key(a), key(b)], 0.55);
    };
    return {
      ask: tier === 3 ? '第一个音亮着，第二个只能听。先听出它跳到了哪，再点第三个音：**往回走一步**。' : `啾啾跳了一下：往${up ? '上' : '下'}。点第三个音：**往回走一步**。`,
      hint: tier === 2 ? '银：键上不标第几级了。往回，就是朝第一个音那边，到挨着的那一级。' : tier === 3 ? '金：你按的键也会响，可以和第二个音比一比。' : '',
      start: play,
      replay: play,
      onKey(m) {
        const r = f.bench.rungOf(m);
        if (m === target) {
          f.bench.addPoint(m);
          f.bench.mark(m, 'good');
          return f.good(`跳${up ? '上' : '下'}去，再往回走一步：接住了。`);
        }
        if (r === null) return f.bad('这个不在梯子上。只在**亮着的键**里挑。', m);
        if (m === key(b)) return f.bad('这是它跳到的那个音。第三个音在它**隔壁**。', m);
        const d = r - b;
        if (Math.sign(d) === (up ? 1 : -1)) return f.bad('这是接着往同一边去了。要**往回**：朝第一个音那边。', m);
        if (tier === 3) return f.bad('不是它。再听：第二个音跳到了哪？第三个音就在它隔壁，靠第一个音这边。', m);
        f.bad('方向对了，可离得太远：这是又跳了一下。只走**一步**。', m);
      },
      solve: () => f.round.onKey(target),
    };
  });
}

// ───────────── T19 啾啾问，你答 ─────────────

const ASKS = [[1, 3, 4, 5], [3, 2, 3, 5], [5, 4, 3, 2], [1, 2, 3, 2], [3, 5, 4, 2], [1, 3, 5, 7], [5, 3, 4, 5]];

function askanswer(spec, env) {
  const tier = env.tier || 1;
  const count = byTier(tier, [2, 3, 4]);
  const f = frame(env, spec.need || byTier(tier, [3, 3, 4]), { listenLabel: '▶ 听啾啾问' });
  f.bench.autoTrail = false;
  let lastAsk = null;
  return f.start(() => {
    const root = tier === 1 ? LO : pick([60, 62, 63, 65]);
    let degs;
    do degs = pick(ASKS); while (degs === lastAsk);
    lastAsk = degs;
    const ask = degs.map((d) => degOf(root, MINOR, d));
    let mine = [];
    let busy = false;
    f.bench.set({ ladder: tier === 3 ? null : { root, offsets: MINOR }, home: tier === 1, degrees: tier === 1, keys: false, trail: true });
    const play = () => {
      mine = [];
      return locked(f.bench, () => f.bench.playLine(ask, { gap: 0.34 }));
    };
    const isHome = (m) => (m - root) % 12 === 0 && m >= root;
    return {
      ask: `啾啾问了一句，停在半空。你答 **${count} 个音**，最后落在**家**上。${tier === 3 ? '最后一步要**走**着回家。' : ''}`,
      hint: tier === 1 ? '家是桔红的那个键。' : tier === 2 ? '银：家没标出来，每一轮都会搬。哼一哼：这句话最想停在哪个音上？' : '金：梯子不亮了。答句的倒数第二个音，放在家的隔壁。',
      start: play,
      replay: play,
      async onKey(m) {
        if (busy) return;
        mine.push(m);
        f.bench.addPoint(m);
        if (mine.length < count) return f.say(`${mine.length} / ${count}`);
        const answer = mine;
        mine = [];
        const r = rungIn(root, MINOR, answer[count - 1]);
        const p = rungIn(root, MINOR, answer[count - 2]);
        if (!isHome(answer[count - 1])) {
          f.bench.trailSet(ask);
          return f.bad(tier === 1 ? '最后一个音没落在家上（桔红的键）。从头再答一遍。' : '最后一个音还悬着，没到家。点「听啾啾问」再听一遍，哼出它想停下来的那个音。');
        }
        if (tier === 3 && (p === null || Math.abs(p - r) !== 1)) {
          f.bench.trailSet(ask);
          return f.bad('到家了，可最后一步是跳回来的。金档要**走**着回家：倒数第二个音放在家的隔壁。从头再答一遍。');
        }
        busy = true;
        await locked(f.bench, () => f.bench.playLine([...ask, null, ...answer], { gap: 0.32 }));
        busy = false;
        f.bench.trailMarkLast('good');
        f.good(`一问一答：家是 ${nameOf(root)}。`);
      },
      async solve() {
        // 高一层的家，倒数第二个音放在它隔壁（第 7 级）：走着回家
        const seq = Array.from({ length: count }, (_, i) => (i === count - 1 ? root + 12 : i === count - 2 ? degOf(root, MINOR, 7) : degOf(root, MINOR, 5)));
        for (const m of seq) await f.round.onKey(m);
      },
    };
  });
}

// ───────────── T20 再说一遍 ─────────────

function motifecho(spec, env) {
  const tier = env.tier || 1;
  const n = byTier(tier, [3, 4, 4]);
  const f = frame(env, spec.need || 3, { listenLabel: '▶ 听小点子' });
  f.bench.autoTrail = false;
  let lastKey = '';
  return f.start(() => {
    const root = LO;
    f.bench.set({ ladder: { root, offsets: MINOR }, home: true, degrees: tier === 1, keys: false, trail: true });
    let rungs;
    do {
      rungs = [rnd(0, 4)];
      while (rungs.length < n) {
        const nx = rungs[rungs.length - 1] + pick([-2, -1, 1, 1, 2, 2]);
        if (nx >= 0 && nx <= 7 && nx !== rungs[rungs.length - 1]) rungs.push(nx);
      }
    } while (rungs.join() === lastKey || (tier === 3 && rungs[n - 1] % 7 === 0));
    lastKey = rungs.join();
    const want = rungs.map((r) => f.bench.degMidi(r + 1));
    let mine = [];
    let busy = false;
    const hear = () => {
      if (tier === 1) f.bench.ghostSet(want);
      f.bench.unmark('ref');
      if (tier >= 2) f.bench.mark(want[0], 'ref');
      blind(f.bench, want, 0.36);
    };
    const back = (k) => {
      mine = mine.slice(0, k);
      f.bench.trailSet(mine);
    };
    return {
      ask: tier === 3 ? `啾啾说了一个小点子（${n} 个音）。你再说一遍：**前 2 个音照旧，后 2 个音要改**，最后落在**家**上。` : `啾啾说了一个小点子（${n} 个音）。照原样**再说一遍**。`,
      hint: tier === 1 ? '铜：上面那条虚线是啾啾的。' : '第一个音亮着。后面的靠耳朵：你按的键也会响，和啾啾的比一比。',
      start: hear,
      replay: hear,
      async onKey(m) {
        if (busy) return;
        const k = mine.length;
        const exact = tier < 3 || k < 2;
        if (exact && m !== want[k]) return f.bad(`第 ${k + 1} 个音不一样：你的${m > want[k] ? '**高**了' : '**低**了'}。${tier === 1 ? '看上面那条虚线。' : '点「听小点子」再听一遍。'}`, m);
        if (f.bench.rungOf(m) === null) return f.bad('只按**亮着的键**。', m);
        mine.push(m);
        f.bench.trailSet(mine);
        if (mine.length < n) return f.say(`${mine.length} / ${n}`);
        if (tier === 3) {
          if (mine.every((x, i) => x === want[i])) {
            back(2);
            return f.bad('和小点子一模一样了。金档要**改尾巴**：后 2 个音再弹一次，换掉一两个。');
          }
          if ((m - root) % 12 !== 0) {
            back(2);
            return f.bad('尾巴改了，可没落在家上。后 2 个音再弹一次：最后一个落在**桔红的键**上。');
          }
        }
        busy = true;
        await locked(f.bench, () => f.bench.playLine(tier === 3 ? [...want, null, ...mine] : [...want, ...mine], { gap: 0.3 }));
        busy = false;
        f.good(tier === 3 ? '开头认得出，尾巴换了，还回了家。' : '一个音不差：说了两遍，就记住了。');
      },
      async solve() {
        const tail = tier === 3 ? [want[0], want[1], f.bench.degMidi(2), root] : want;
        for (const m of tail) await f.round.onKey(m);
      },
    };
  });
}

// ───────────── T21 把长短摆成一样 ─────────────

function lengthcopy(spec, env) {
  const tier = env.tier || 1;
  const f = frame(env, spec.need || byTier(tier, [2, 3, 3]), { listenLabel: '▶ 听啾啾的' });
  f.bench.autoTrail = false;
  f.bench.silent = true;
  let lastKey = '';
  return f.start(() => {
    const root = LO;
    f.bench.set({ ladder: { root, offsets: MINOR }, home: true, degrees: false, keys: false, top: 'roll' });
    // 每个音的起点是定好的：铜、银 4 个音各占一拍的位置；金 5 个音，头两个挤在一拍里
    const starts = tier === 3 ? [0, 2, 4, 8, 12] : [0, 4, 8, 12];
    const gaps = starts.map((s, i) => (starts[i + 1] ?? 16) - s);
    let lens;
    do lens = gaps.map((g) => pick((tier === 1 ? [2, 4] : [1, 2, 4]).filter((x) => x <= g))); while (lens.every((l) => l === 1) || lens.join() === lastKey);
    lastKey = lens.join();
    let r = rnd(0, 3);
    const pitches = starts.map(() => {
      r = Math.max(0, Math.min(6, r + pick([-1, 1, 1, 2])));
      return f.bench.degMidi(r + 1);
    });
    const target = starts.map((s, i) => ({ s, l: lens[i], m: pitches[i] }));
    f.bench.rollShow({ steps: 16, mel: starts.map((s, i) => ({ s, l: 1, m: pitches[i] })) }, { range: [root, root + 12], mode: 'len', ghost: tier === 1 ? target : [] });
    f.bench.roll.select(0);
    const hear = () => locked(f.bench, () => f.bench.playScore({ steps: 16, mel: target, bpm: 92 }, { parts: ['mel'], keys: false }));
    const mine = () => locked(f.bench, () => f.bench.playScore({ steps: 16, mel: f.bench.roll.mel, bpm: 92 }, { parts: ['mel'], keys: false }));
    const nudge = (d) => {
      const k = f.bench.roll.sel;
      if (k < 0) return f.say('先在格子里点一下要改的那个音。', true);
      const cur = f.bench.roll.mel[k];
      if (d > 0 && cur.l >= f.bench.roll.maxLen(k)) return f.say('右边顶到下一个音了，拉不动。', true);
      if (d < 0 && cur.l <= 1) return f.say('一格是最短的了。', true);
      f.bench.roll.setLen(k, cur.l + d);
    };
    const check = async () => {
      const mel = f.bench.roll.mel;
      const k = mel.findIndex((x, i) => x.l !== lens[i]);
      if (k >= 0) return f.bad(`第 ${k + 1} 个音不一样：啾啾的比你的**${lens[k] > mel[k].l ? '长' : '短'}**。${tier === 1 ? '照着虚线框拉。' : '两边各听一遍，盯着这一个。'}`);
      await mine();
      f.good('长短一模一样。');
    };
    return {
      ask: '把每个音的**长短**摆成和啾啾的一样：点一个音，拖它右边的小把手，或者点「长一格」「短一格」。摆好了点「对一下」。',
      hint: tier === 1 ? '铜：虚线框是啾啾的。' : tier === 2 ? '银：只能听。音是连着的，还是断开的？' : '金：有的音后面留着空。',
      start() {
        f.row.append(btn('▶ 听我的', mine), btn('− 短一格', () => nudge(-1)), btn('＋ 长一格', () => nudge(1)), btn('对一下', check, 'primary'));
        hear();
      },
      replay: hear,
      async solve() {
        lens.forEach((l, i) => (f.bench.roll.mel[i].l = l));
        f.bench.roll.set({});
        await check();
      },
    };
  });
}

// ───────────── T22 小作品：一问一答 ─────────────

const QUESTIONS = [
  { name: '往上走的', cells: [[0, 2, 1], [2, 2, 2], [4, 2, 3], [6, 2, 5], [8, 4, 4], [12, 4, 2]] },
  { name: '从高处来的', cells: [[0, 2, 8], [2, 2, 7], [4, 4, 5], [8, 2, 4], [10, 2, 3], [12, 4, 5]] },
  { name: '一跳一停的', cells: [[0, 4, 1], [4, 2, 5], [6, 2, 4], [8, 2, 3], [10, 2, 4], [12, 4, 5]] },
];

/** 写一写里公用的那块格子：两小节 32 格，点格子或者点键盘放音（键盘放在“下一个空位”），能拉长、能删 */
function scribble(f, { root, lo = 1, hi = 10, from = 0 }) {
  const B = f.bench;
  const cursor = () => Math.max(from, ...B.roll.mel.map((x) => x.s + x.l));
  const nudge = (d) => {
    const k = B.roll.sel;
    if (k < 0 || B.roll.mel[k]?.fixed) return f.say('先在格子里点一下你写的那个音。', true);
    const cur = B.roll.mel[k];
    if (d > 0 && cur.l >= B.roll.maxLen(k)) return f.say('右边顶到下一个音了，拉不动。', true);
    if (d < 0 && cur.l <= 1) return f.say('一格是最短的了。', true);
    B.roll.setLen(k, cur.l + d);
  };
  return {
    rows: () => B.ladderRows(B.degMidi(lo), B.degMidi(hi)),
    buttons: () => [
      btn('− 短一格', () => nudge(-1)), btn('＋ 长一格', () => nudge(1)),
      btn('删这个音', () => (B.roll.sel >= 0 && !B.roll.mel[B.roll.sel]?.fixed ? B.roll.remove(B.roll.sel) : f.say('先点一下要删的那个音。', true))),
    ],
    /** 点键盘：放在最后一个音后面 */
    key(m) {
      if (B.rungOf(m) === null) return f.say('只用**亮着的键**。', true);
      const s = cursor();
      if (s >= B.roll.state.steps) return f.say('写满了。想改：在格子里点一个音，再删掉或者拉长。', true);
      B.roll.place(s, m, { quiet: true }); // 键盘自己已经响过了
    },
    root,
  };
}

function phrase(spec, env) {
  const tier = env.tier || 1;
  const f = frame(env, 1, { listenLabel: '▶ 听整句' });
  const B = f.bench;
  const root = LO;
  f.el.classList.add('make');
  B.set({ ladder: { root, offsets: MINOR }, home: true, degrees: true, keys: false, top: 'roll' });
  B.autoTrail = false;
  return f.start(() => {
    let q = QUESTIONS[0];
    const pad = scribble(f, { root, from: tier === 1 ? 16 : 0 });
    const given = () => (tier === 1 ? q.cells.map(([s, l, d]) => ({ s, l, m: B.degMidi(d), fixed: true })) : []);
    const list = h('ul', { class: 'tq-checks' });
    const rung = (x) => B.rungOf(x.m);
    const isHome = (x) => (x.m - root) % 12 === 0;
    /** 清单：一条一个 [说法, 过没过, 没过时说什么] */
    const checks = () => {
      const mel = B.roll.mel;
      const ask = mel.filter((x) => x.s < 16);
      const ans = mel.filter((x) => x.s >= 16);
      const end = ans[ans.length - 1];
      const out = [];
      if (tier >= 2) {
        out.push(['问句（第 1 小节）至少 3 个音', ask.length >= 3, '第 1 小节还太空：问句至少写 3 个音。']);
        out.push(['问句最后悬着：别停在家上', ask.length > 0 && !isHome(ask[ask.length - 1]), '问句的最后一个音停在家上了：那是句号。换成第 5 级或者第 2 级。']);
      }
      out.push(['答句（第 2 小节）至少 3 个音', ans.length >= 3, '第 2 小节还太空：答句至少写 3 个音。']);
      out.push(['答句最后落在家上', !!end && isHome(end), '答句的最后一个音没落在家上（桔红的那一行）。']);
      out.push(['句尾的音拉长：至少 4 格', !!end && end.l >= 4, '最后一个音太短：把它拉到至少 4 格，这句话才收得住。']);
      if (tier >= 3) {
        const r = mel.map(rung);
        const d = r.slice(1).map((x, i) => x - r[i]);
        const ok = d.some((x, i) => Math.abs(x) >= 2 && i + 1 < d.length && Math.sign(d[i + 1]) === -Math.sign(x) && Math.abs(d[i + 1]) === 1);
        out.push(['有一处跳，而且跳完往回走一步', ok, d.some((x) => Math.abs(x) >= 2) ? '有跳了，可跳完没有往回走一步：跳过去以后的下一个音，放在它隔壁、靠回来的那一边。' : '整句都在走：找一处让它跳一下（隔开至少一级），再往回走一步。']);
        out.push(['答句的头两个音，照着问句的头两个音', ask.length >= 2 && ans.length >= 2 && ask[0].m === ans[0].m && ask[1].m === ans[1].m, '答句的开头和问句不一样：让第 2 小节的头两个音，和第 1 小节的头两个音一样。']);
      }
      return out;
    };
    const paint = () => list.replaceChildren(...checks().map(([text, ok]) => h('li', { class: ok ? 'ok' : '' }, text)));
    const show = (mel) => {
      B.rollShow({ steps: 32, mel }, { rows: pad.rows(), mode: 'place', unit: 2, snap: 2 });
      paint();
    };
    const play = () => locked(B, () => B.playScore({ steps: 32, mel: B.roll.mel, bpm: 96 }, { parts: ['mel'] }));
    const save = async () => {
      const bad = checks().find((c) => !c[1]);
      if (bad) return f.bad(bad[2]);
      await play();
      const mel = B.roll.mel;
      saveWork({ level: 'T22', root, scale: 'minor', notes: mel.map((x) => x.m), cells: mel.map((x) => [x.s, x.l, x.m]), steps: 32, bpm: 96 });
      f.good('收进小本子了：一问一答，是你自己的一句，啾。');
    };
    B.onRoll = paint;
    return {
      ask: tier === 1 ? '灰色的是啾啾写的问句。你在**第 2 小节**写答句：在格子里点，或者点下面的键盘。' : '两小节都归你：**第 1 小节问，第 2 小节答**。在格子里点，或者点下面的键盘。',
      hint: '没有标准答案。下面的清单都打上勾，就能收进小本子。',
      start() {
        const picks = tier === 1 ? h('div', { class: 'tq-row' }, h('span', { class: 'tb-cap' }, '啾啾的问句'), ...QUESTIONS.map((o) => {
          const b = h('button', { class: ['btn sm', o === q && 'primary'], type: 'button', 'data-sfx': 'tick' }, o.name);
          b.addEventListener('click', () => {
            q = o;
            [...picks.querySelectorAll('.btn')].forEach((x) => x.classList.toggle('primary', x === b));
            show(given());
            play();
          });
          return b;
        })) : null;
        f.tools.append(...pad.buttons(), btn('清空', () => show(given())), btn('收进小本子', save, 'primary'));
        if (picks) f.row.append(picks);
        f.row.append(list);
        show(given());
      },
      replay: play,
      onKey: (m) => pad.key(m),
      async solve() {
        const head = tier === 1 ? given() : [[0, 2, 1], [2, 2, 3], [4, 2, 6], [6, 2, 5], [8, 4, 4], [12, 4, 2]].map(([s, l, d]) => ({ s, l, m: B.degMidi(d) }));
        const a0 = head[0].m;
        const a1 = head[1].m;
        const tail = [[16, 2, a0], [18, 2, a1], [20, 2, B.degMidi(6)], [22, 2, B.degMidi(5)], [24, 2, B.degMidi(3)], [26, 2, B.degMidi(2)], [28, 4, root]].map(([s, l, m]) => ({ s, l, m }));
        show([...head, ...tail]);
        await save();
      },
    };
  });
}

// ───────────── T9 上面那个音 ─────────────

const FLAVOR = { 1: '挤', 2: '甜', 3: '有点空', 4: '稳', 5: '宽宽的甜', 7: '同名，高了一层' };

function pairhunt(spec, env) {
  const tier = env.tier || 1;
  const f = frame(env, spec.need || byTier(tier, [3, 4, 5]), { listenLabel: '▶ 再听' });
  f.bench.autoTrail = false;
  f.bench.silent = true;
  let last = '';
  return f.start(() => {
    f.bench.set({ ladder: { root: LO, offsets: MAJOR }, home: true, degrees: tier === 1, keys: false, trail: false });
    let b;
    let gap;
    do {
      b = tier === 3 ? rnd(0, 4) : 0;
      gap = pick(byTier(tier, [[1, 2, 4], [1, 2, 3, 4, 7], [1, 2, 3, 4, 5, 7]]));
    } while (`${b}${gap}` === last);
    last = `${b}${gap}`;
    const base = f.bench.degMidi(b + 1);
    const target = f.bench.degMidi(b + 1 + gap);
    const hear = () => {
      f.bench.chord([base]);
      f.bench.playChord([base, target], { show: false });
    };
    return {
      ask: tier === 1 ? `地基是青色的那个键。啾啾在它上面叠了一个**${FLAVOR[gap]}**的：点出来。` : '地基是青色的那个键。啾啾在它上面叠了一个音，两个一起响：点出**上面那个**。',
      hint: tier === 1 ? '挤 = 挨着；甜 = 隔一个；稳 = 隔三个。' : '你按的键会和地基一起响：和啾啾的比一比，哪个更宽、哪个更窄。',
      start: hear,
      replay: hear,
      onKey(m) {
        const r = f.bench.rungOf(m);
        if (m === base) return f.bad('这是地基自己。要的是它**上面**那个。');
        if (r === null || r < b) {
          f.bench.tone(m);
          return f.bad(r === null ? '这个不在梯子上。在**亮着的键**里挑。' : '往地基的**右边**找。', m);
        }
        f.bench.playChord([base, m]);
        if (m === target) return f.good(`隔${gap === 1 ? '壁' : gap === 7 ? '了一层楼' : ` ${gap - 1} 个`}：${FLAVOR[gap]}。`);
        f.bad(tier === 1 ? `这一对是“${FLAVOR[r - b] || '更远的'}”。要的是**${FLAVOR[gap]}**的。` : `你叠的这一对比啾啾的${r - b < gap ? '**窄**：往右再找' : '**宽**：往左再找'}。`, m);
      },
      solve: () => f.round.onKey(target),
    };
  });
}

// ───────────── T10 / T23 把和弦叠出来 ─────────────

function chordbuild(spec, env) {
  const tier = env.tier || 1;
  const size = spec.size || 3;
  const f = frame(env, spec.need || 3, { listenLabel: tier === 3 ? '▶ 听啾啾的' : '▶ 听叠到哪了' });
  f.bench.autoTrail = false;
  f.bench.silent = true;
  let last = '';
  return f.start(() => {
    // 三层的银档、和两种金档：梯子不亮，按格子数（或者靠耳朵）找
    const dark = tier === 3 || (tier === 2 && size === 3);
    let want;
    let label = '';
    let key = '';
    do {
      if (dark) {
        const root = rnd(LO, LO + 7);
        const kind = pick(size === 3 ? ['major', 'minor'] : ['maj7', 'min7', 'dom7']);
        want = { major: [0, 4, 7], minor: [0, 3, 7], maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], dom7: [0, 4, 7, 10] }[kind].map((o) => root + o);
        label = kind === 'major' ? '亮' : kind === 'minor' ? '暗' : '';
        f.bench.set({ ladder: null, home: false, degrees: false, keys: false, trail: false });
      } else {
        const root = tier === 1 ? LO : pick([60, 62, 65]);
        f.bench.set({ ladder: { root, offsets: size === 3 ? MAJOR : MINOR }, home: true, degrees: tier === 1, keys: false, trail: false });
        want = f.bench.chordOf(rnd(1, 6), size);
      }
      key = want.join();
    } while (key === last);
    last = key;
    const have = [want[0]];
    const found = new Set([want[0]]);
    const hear = () => (tier === 3 ? f.bench.playChord(want, { show: false }) : f.bench.playChord(have));
    return {
      ask: tier === 3
        ? `地基是青色的那个键。啾啾在它上面叠了${size === 3 ? '两' : '三'}层，不给你看：听，把它们**都点出来**。`
        : dark ? `从青色的地基（${nameOf(want[0])}）叠一个**${label}**的和弦。${label === '亮' ? '亮：往上 4 格，再 3 格。' : '暗：往上 3 格，再 4 格。'}黑键白键都算一格。`
          : `地基是青色的那个键。往上**隔一个拿一个**，叠满${size === 3 ? '三' : '四'}层。`,
      hint: tier === 3 ? '金：你按的键会响。按对了的会留下来。' : tier === 2 && !dark ? '银：键上不标第几级了，家也搬了。只看亮着的键：隔一个，拿一个。' : '',
      start() {
        f.bench.chord(have);
        if (tier === 3) hear();
      },
      replay: hear,
      onKey(m) {
        if (tier === 3) {
          if (found.has(m)) return f.say('这个已经找到了。');
          if (!want.includes(m)) {
            f.bench.tone(m);
            return f.bad(m < want[0] ? '往地基的**右边**找。' : '这个不在啾啾的那一摞里。再听。', m);
          }
          found.add(m);
          f.bench.chord(want.filter((x) => found.has(x)));
          f.bench.playChord(want.filter((x) => found.has(x)), { show: false });
          if (found.size < size) return f.say(`找到 ${found.size - 1} / ${size - 1}。`);
          return f.good(`${names(want)}：${size === 3 ? (want[1] - want[0] === 4 ? '亮的。' : '暗的。') : '四层都在了。'}`);
        }
        if (have.length >= size) return;
        const next = want[have.length];
        if (m === next) {
          have.push(m);
          f.bench.playChord(have);
          if (have.length < size) return f.say(`第 ${have.length} 层到手。`);
          return f.good(`${names(want)}：${f.bench.state.ladder ? MOOD_SAY[f.bench.moodOf(want)] : label === '亮' ? '亮的。' : '暗的。'}`);
        }
        f.bench.tone(m);
        const prev = have[have.length - 1];
        if (dark) return f.bad(m <= prev ? '往**右**叠。' : `从 ${nameOf(prev)} 往上要走 **${next - prev} 格**。你走了 ${m - prev} 格。`, m);
        const r = f.bench.rungOf(m);
        if (r === null) return f.bad('这个不在梯子上。在**亮着的键**里挑。', m);
        const gap = r - f.bench.rungOf(prev);
        f.bad(gap <= 0 ? '往上叠：在最上面那层的**右边**找。' : gap === 1 ? '这是**挨着**的那个：叠上去会挤。要**隔一个**。' : `隔得太远了：中间跳过了 ${gap - 1} 个。只隔**一个**。`, m);
      },
      async solve() {
        for (const m of want.slice(1)) await f.round.onKey(m);
      },
    };
  });
}
const MOOD_SAY = { major: '亮的。', minor: '暗的。', dim: '挤的。', other: '叠好了。' };

// ───────────── T24 找地基 ─────────────

const PROGS_MAJOR = [[1, 4, 5, 1], [1, 6, 4, 5], [1, 5, 6, 4], [6, 4, 1, 5], [1, 4, 1, 5], [4, 5, 1, 6]];

function bassfind(spec, env) {
  const tier = env.tier || 1;
  const f = frame(env, spec.need || byTier(tier, [3, 2, 4]), { listenLabel: '▶ 再听' });
  const B = f.bench;
  B.autoTrail = false;
  B.silent = true;
  let last = '';
  /** 这个键在这一摞的第几层（0 = 地基，-1 = 不在里面） */
  const layerOf = (notes, m) => notes.findIndex((x) => (x - m) % 12 === 0);
  const wrong = (notes, m) => {
    const layer = layerOf(notes, m);
    B.playChord(notes, { show: false, len: 0.7, vel: 0.45 });
    B.tone(m - 12, { voice: 'bass', len: 0.7 });
    return layer > 0 ? `**${nameOf(m)}** 在这一摞的${layer === 1 ? '中间' : '上面'}那层：贝斯站上去，飘。地基是最底下那个。` : `**${nameOf(m)}** 不在这一摞里：贝斯站上去会和它打架。`;
  };
  return f.start(() => {
    B.set({ ladder: { root: LO, offsets: MAJOR }, home: true, degrees: tier === 1, keys: false, top: tier === 2 ? 'roll' : 'trail', trail: tier === 2 });
    B.rollClear();
    if (tier === 2) {
      let prog;
      do prog = pick(PROGS_MAJOR); while (prog.join() === last);
      last = prog.join();
      const sc = B.score({ steps: 32, chords: prog.map((d, i) => [i * 8, 8, d]) });
      const bass = [];
      let k = 0;
      const focus = () => {
        B.chord(sc.chords[k].notes);
        B.roll.head(sc.chords[k].s);
      };
      const hear = () => locked(B, async () => {
        await B.playScore({ ...sc, bass });
        if (k < 4) focus();
      });
      return {
        ask: '四个和弦连着来（格子里的色带）。一格一格点出贝斯该站的键：每一摞的**地基**。',
        hint: '银：键上不标第几级。竖线停在哪一格，键盘上青色的就是那一格的和弦。',
        start() {
          B.rollShow(sc, { fit: sc.chords.map((c) => c.notes[0] - 12) });
          focus();
        },
        replay: hear,
        async onKey(m) {
          if (k >= 4) return;
          const c = sc.chords[k];
          if (layerOf(c.notes, m) !== 0) return f.bad(wrong(c.notes, m), m);
          bass.push({ s: c.s, l: c.l, m: c.notes[0] - 12 });
          B.roll.set({ bass: [...bass] });
          B.playChord(c.notes, { bass: true, len: 0.7 });
          k++;
          if (k < 4) {
            focus();
            return f.say(`第 ${k} 格站稳了。下一格。`);
          }
          await locked(B, async () => {
            await wait(700);
            await B.playScore({ ...sc, bass });
          });
          f.good('四格都站在地基上：有底了。');
        },
        async solve() {
          for (let i = k; i < 4; i++) await f.round.onKey(sc.chords[i].notes[0]);
        },
      };
    }
    let d;
    do d = rnd(1, 6); while (String(d) === last);
    last = String(d);
    const notes = B.chordOf(d);
    const hear = () => {
      if (tier === 1) B.chord(notes);
      B.playChord(notes, { show: tier === 1 });
    };
    return {
      ask: tier === 1 ? '键盘上青色的这一摞，贝斯站哪个键？点出它的**地基**。' : '啾啾放了一摞和弦，不给你看。贝斯该站哪个键？点出它的**地基**。',
      hint: tier === 3 ? '金：你点的键会当贝斯，和那一摞一起响。站对了最稳；站错了，飘，或者打架。' : '',
      start() {
        B.chord(null);
        hear();
      },
      replay: hear,
      onKey(m) {
        if (B.rungOf(m) === null) return f.bad('只用**亮着的键**。', m);
        if (layerOf(notes, m) !== 0) return f.bad(wrong(notes, m), m);
        B.chord(notes);
        B.playChord(notes, { bass: true });
        f.good(`地基是 **${nameOf(notes[0])}**：${names(notes)}。`);
      },
      solve: () => f.round.onKey(notes[0]),
    };
  });
}

// ───────────── T25 逗号，还是句号 ─────────────

const HEADS = [[1, 4, 5], [1, 6, 4], [6, 4, 5], [1, 4, 2], [4, 6, 5], [1, 6, 5]];
const END_WORD = { 1: '句号：回家了', 5: '逗号：悬着，最想回家', 6: '假装回家：像家，又不是', 4: '悬着，软软的' };

function cadence(spec, env) {
  const tier = env.tier || 1;
  const f = frame(env, spec.need || byTier(tier, [3, 4, 4]), { listenLabel: tier === 3 ? '▶ 再听' : '▶ 听前面几格' });
  const B = f.bench;
  B.autoTrail = false;
  B.silent = true;
  let n = 0;
  let last = '';
  return f.start(() => {
    const root = tier === 2 ? pick([60, 62, 65]) : LO;
    B.set({ ladder: { root, offsets: MAJOR }, home: true, degrees: tier !== 2, keys: false, top: 'roll', trail: tier < 3 });
    let head;
    do head = pick(HEADS); while (head.join() === last);
    last = head.join();
    if (tier === 3) {
      const end = pick([1, 5, 6, 1, 5]);
      const list = [...head, end].map((d) => B.chordOf(d));
      const hear = () => locked(B, () => B.playChords(list, { gap: 0.85, bass: true, show: false }));
      return {
        ask: '啾啾放了四个和弦，不给你看。它最后停在**第几级**的和弦上？在键盘上点出那一级。',
        hint: '金：听最后那一下。稳稳到家是第 1 级；最想回家的是第 5 级；像家又不是家的是第 6 级。你点的那一级也会响。',
        start() {
          B.chord(null);
          B.lamps(null);
          hear();
        },
        replay: hear,
        onKey(m) {
          const d = B.degOf(m);
          if (!d) return f.bad('点**亮着的键**。', m);
          B.playChord(B.chordOf(d), { bass: true });
          if (d === end) return f.good(`停在第 ${end} 级：${END_WORD[end]}。`);
          f.bad(`不是第 ${d} 级。再听最后那一下：它${end === 1 ? '踏实吗？' : '悬着吗？想不想往家走？'}`, m);
        },
        solve: () => f.round.onKey(B.degMidi(end)),
      };
    }
    const want = n++ % 2 === 0 ? 'home' : 'comma';
    const accept = want === 'home' ? 1 : 5;
    const base = B.score({ steps: 16, chords: head.map((d, i) => [i * 4, 4, d]), bass: 'root' });
    const show = (d) => {
      const sc = { ...base, chords: [...base.chords], bass: [...base.bass] };
      if (d) {
        const notes = B.chordOf(d);
        sc.chords.push({ s: 12, l: 4, notes });
        sc.bass.push({ s: 12, l: 4, m: notes[0] - 12 });
      }
      B.rollShow(sc);
      return sc;
    };
    let sc = base;
    const hear = () => locked(B, () => B.playScore(sc));
    return {
      ask: `前三格是第 ${head.join('、')} 级。最后一格空着：点一级放个和弦进去，要**${want === 'home' ? '句号' : '逗号'}**。`,
      hint: tier === 2 ? '银：键上不标第几级，家也搬了。从桔红的家往上数。' : want === 'home' ? '句号：回到家。' : '逗号：停在最想回家的那一级上。',
      start() {
        sc = show(0);
        hear();
      },
      replay: hear,
      async onKey(m) {
        const d = B.degOf(m);
        if (!d) return f.bad('点**亮着的键**：点哪一级，就在那一级上叠一摞。', m);
        sc = show(d);
        await hear();
        if (d === accept) return f.good(want === 'home' ? '回家了：句号。' : '停在第 5 级：悬着，等下一句。');
        f.bad(want === 'home'
          ? (d === 6 ? '第 6 级：像回了家，又不是家。这是“假装回家”。句号要落在**家**上。' : d === 5 ? '停在第 5 级：这是逗号。要句号。' : `停在第 ${d} 级：没回家，话还悬着。`)
          : (d === 1 ? '这是家：句号。这回要**逗号**：停在最想回家的那一级上。' : `第 ${d} 级也悬着，可最像逗号的是**第 5 级**。`));
      },
      solve: () => f.round.onKey(B.degMidi(accept)),
    };
  });
}

// ───────────── T11 把空着的格子填出来 ─────────────

const PROGS_MINOR = [[1, 6, 3, 7], [1, 7, 6, 7], [6, 4, 5, 1], [6, 7, 1, 7], [1, 4, 7, 3], [1, 6, 4, 5], [1, 3, 7, 4], [1, 4, 6, 5]];

function progear(spec, env) {
  const tier = env.tier || 1;
  const f = frame(env, spec.need || byTier(tier, [3, 3, 2]), { listenLabel: '▶ 听这一圈' });
  const B = f.bench;
  B.autoTrail = false;
  B.silent = true;
  let last = '';
  return f.start(() => {
    const root = tier === 3 ? pick([60, 62, 63]) : LO;
    B.set({ ladder: { root, offsets: MINOR }, home: true, degrees: tier === 1, keys: false, trail: false });
    B.chord(null);
    let prog;
    do prog = pick(PROGS_MINOR); while (prog.join() === last);
    last = prog.join();
    const blanks = tier === 1 ? [rnd(1, 3)] : tier === 2 ? pick([[1, 2], [2, 3], [1, 3]]) : [1, 2, 3];
    const mine = prog.map((d, i) => (blanks.includes(i) ? 0 : d));
    const chords = prog.map((d) => B.chordOf(d));
    const slots = progSlots(B, mine);
    const cur = () => mine.findIndex((d) => !d);
    const hear = () => locked(B, () => B.playChords(chords, { gap: 0.85, bass: true, show: false, onStep: (k) => slots.playing(k) }).then(() => slots.playing(-1)));
    return {
      ask: `啾啾转了一圈四个和弦。空着的${blanks.length > 1 ? `那 ${blanks.length} 格` : '那一格'}是第几级？在键盘上点地基，一格一格填。`,
      hint: tier === 1 ? '铜：盯着最低的那个音（贝斯）：它就是地基。' : tier === 2 ? '银：键上不标第几级。从桔红的家往上数。' : '金：家也搬了。你点的那一级会响：和啾啾的比。',
      start() {
        f.row.append(slots.el);
        slots.now(cur());
        hear();
      },
      replay: hear,
      async onKey(m) {
        const k = cur();
        if (k < 0) return;
        const d = B.degOf(m);
        if (!d) return f.bad('点**亮着的键**当地基。', m);
        B.playChord(B.chordOf(d), { bass: true });
        if (d !== prog[k]) {
          const up = B.chordOf(d)[0] < chords[k][0];
          return f.bad(`第 ${k + 1} 格不是第 ${d} 级。再听这一格的贝斯：啾啾的比你点的**${up ? '高' : '低'}**。`, m);
        }
        mine[k] = d;
        slots.set(mine);
        slots.now(cur());
        if (cur() >= 0) return f.say(`第 ${k + 1} 格对了。下一格。`);
        await wait(600);
        await hear();
        f.good(`${prog.join(' → ')}：填出来了。${prog[3] !== 1 ? '最后一格悬着，所以转得起来。' : '这一套最后才回家。'}`);
      },
      async solve() {
        while (cur() >= 0) await f.round.onKey(B.degMidi(prog[cur()]));
      },
    };
  });
}

// ───────────── T26 把踩空的音挪到和弦上 ─────────────

// 一小节一个和弦，旋律的最后一个音是长的、踩空了（off 是它现在在第几级）
const LANDS = [
  { ch: 1, degs: [1, 2, 3, 5, 4] }, { ch: 4, degs: [4, 5, 6, 8, 7] }, { ch: 5, degs: [7, 6, 5, 7, 8] },
  { ch: 6, degs: [6, 7, 8, 10, 9] }, { ch: 1, degs: [5, 4, 3, 1, 2] }, { ch: 4, degs: [8, 6, 5, 4, 5] },
];

function landing(spec, env) {
  const tier = env.tier || 1;
  const f = frame(env, spec.need || 3, { listenLabel: '▶ 听这一句' });
  const B = f.bench;
  B.autoTrail = false;
  B.silent = true;
  let lastLine = null;
  return f.start(() => {
    B.set({ ladder: { root: LO, offsets: MAJOR }, home: true, degrees: false, keys: false, top: 'roll' });
    let line;
    do line = pick(LANDS); while (line === lastLine);
    lastLine = line;
    const chord = B.chordOf(line.ch);
    const inC = (m) => chord.some((x) => (x - m) % 12 === 0);
    const base = { steps: 16, chords: [[0, 16, line.ch]], bass: 'root' };
    const play = () => locked(B, async () => {
      await B.playScore({ ...B.score(base), mel: B.roll.mel });
      if (tier === 1) B.chord(chord);
    });
    const flag = (k, cls) => {
      B.roll.mel[k].cls = cls;
      B.roll.set({});
    };
    if (tier === 3) {
      // 故意踩空，再滑进去：前半小节给好了，后面两个空位自己填
      const head = line.degs.slice(0, 4).map((d, i) => ({ s: i * 2, l: 2, m: B.degMidi(d), fixed: true }));
      let picked = [];
      const paint = () => B.rollShow({ ...B.score(base), mel: [...head, ...picked.map((m, i) => ({ s: 8 + i * 2, l: i ? 6 : 2, m, cls: i ? '' : 'out' }))] }, { tone: true, range: [LO, LO + 17] });
      return {
        ask: '后半小节空着。**先踩空，再滑进去**：点两个键，第一个不在色带上，第二个是它隔壁、踩在色带上的。',
        hint: '金：键盘上不给你亮和弦了。看格子里的色带在哪几行。',
        start() {
          B.chord(null);
          paint();
          play();
        },
        replay: play,
        async onKey(m) {
          if (B.rungOf(m) === null) return f.bad('只用**亮着的键**。', m);
          B.tone(m);
          if (!picked.length) {
            if (inC(m)) return f.bad(`**${nameOf(m)}** 在色带上：这是踩实了。第一个音要**故意踩空**。`, m);
            picked = [m];
            paint();
            return f.say('踩空了。现在走一步，滑到隔壁踩实的那个音上。');
          }
          const step = Math.abs(B.rungOf(m) - B.rungOf(picked[0]));
          if (!inC(m) || step !== 1) {
            picked = [];
            paint();
            return f.bad(!inC(m) ? `**${nameOf(m)}** 也不在色带上：第二个音要踩实。从头再点两个。` : '第二个音踩实了，可离第一个太远：要**走一步**滑进去。从头再点两个。', m);
          }
          picked.push(m);
          paint();
          await play();
          f.good('先踩空，再滑进去：这一下最有味道。');
        },
        async solve() {
          const land = chord[1];
          await f.round.onKey(B.degMidi(B.rungOf(land) + 2)); // 它上面挨着的那一级：不在和弦里
          await f.round.onKey(land);
        },
      };
    }
    const sc = B.score({ ...base, mel: [...line.degs.slice(0, 4).map((d, i) => [i * 2, 2, d]), [8, 8, line.degs[4]]] });
    let found = tier === 1;
    return {
      ask: tier === 1 ? '红的那个长音踩空了。在键盘上点一个键，把它挪到**和弦**上（青色的键）。' : '这一句里有一个音又长、又踩空。先在**格子里点出它**，再在键盘上点一个键把它挪到和弦上。',
      hint: tier === 2 ? '银：没有标红。看哪个小块又长、又没落在色带上。' : '',
      start() {
        B.rollShow(sc, { tone: tier === 1, mode: tier === 2 ? 'pick' : null });
        B.chord(tier === 1 ? chord : null);
        if (tier === 1) flag(4, 'bad');
        play();
      },
      replay: play,
      onPick(k) {
        if (found) return;
        if (k !== 4) return f.bad(inC(B.roll.mel[k].m) ? '这个音踩在色带上，没事。找那个**又长又踩空**的。' : '这个音是踩空了，可它很短：只是路过，没事。找那个**长**的。');
        found = true;
        flag(4, 'bad');
        B.chord(chord);
        f.say('就是它。现在在键盘上点一个青色的键，把它挪过去。');
      },
      async onKey(m) {
        if (!found) return f.say('先在上面的格子里，点出那个踩空的长音。', true);
        if (B.rungOf(m) === null) return f.bad('只用**亮着的键**。', m);
        if (!B.roll.move(4, m)) return f.bad('离得太远了。在它附近找。', m);
        if (!inC(m)) {
          flag(4, 'bad');
          B.tone(m);
          return f.bad(`**${nameOf(m)}** 也不在这一格的和弦里。这一格是 ${names(chord)}。`, m);
        }
        flag(4, 'good');
        await play();
        f.good(`挪到了 **${nameOf(m)}**：踩实了。`);
      },
      async solve() {
        if (!found) f.round.onPick(4);
        await f.round.onKey(chord.find((x) => Math.abs(B.rungOf(x) - B.rungOf(B.roll.mel[4].m)) === 1) ?? chord[0]);
      },
    };
  });
}

// ───────────── T27 小作品：搭一段 ─────────────

const SETS = [{ name: '1 → 6 → 3 → 7', prog: [1, 6, 3, 7] }, { name: '1 → 7 → 6 → 7', prog: [1, 7, 6, 7] }, { name: '1 → 4 → 6 → 5', prog: [1, 4, 6, 5] }];

function songlet(spec, env) {
  const tier = env.tier || 1;
  const f = frame(env, 1, { listenLabel: '▶ 听这一段' });
  const B = f.bench;
  const root = LO;
  f.el.classList.add('make');
  B.set({ ladder: { root, offsets: MINOR }, home: true, degrees: true, keys: false, top: 'roll' });
  B.autoTrail = false;
  B.silent = true;
  return f.start(() => {
    let tab = 'chords';
    let prog = tier === 1 ? [...SETS[0].prog] : [0, 0, 0, 0];
    let bassDeg = tier === 1 ? [...prog] : [0, 0, 0, 0]; // 每一格贝斯站在第几级上（0 = 还没定）
    let mel = [];
    let end = tier === 1 ? root : 0; // 收尾：转回第 1 格停住，旋律最后落在哪个键上
    let slot = 0;
    const pad = scribble(f, { root });
    const chordAt = (i) => (prog[i] ? B.chordOf(prog[i]) : null);
    const bassOf = (i) => (bassDeg[i] ? B.degMidi(bassDeg[i]) - 12 : null);
    const inC = (i, m) => !!chordAt(i) && chordAt(i).some((x) => (x - m) % 12 === 0);
    /** 现在搭成什么样了（键号的）。closing：再接上收尾那一格（转回第 1 格，停住） */
    const score = (closing = false) => {
      const chords = prog.map((d, i) => (d ? { s: i * 8, l: 8, notes: chordAt(i) } : null)).filter(Boolean);
      const bass = prog.map((d, i) => (bassOf(i) !== null && d ? { s: i * 8, l: 8, m: bassOf(i) } : null)).filter(Boolean);
      const out = { steps: 32, bpm: 96, chords, bass, mel: mel.map((x) => ({ ...x })) };
      if (!closing || !prog[0]) return out;
      out.steps = 40;
      out.chords.push({ s: 32, l: 8, notes: chordAt(0) });
      if (bassOf(0) !== null) out.bass.push({ s: 32, l: 8, m: bassOf(0) });
      if (end) out.mel.push({ s: 32, l: 8, m: end });
      return out;
    };
    const lit = () => {
      const c = chordAt(0);
      return [!!c && (c[0] - root) % 12 === 0, !!c && bassOf(0) !== null && (bassOf(0) - c[0]) % 12 === 0, !!end && (end - root) % 12 === 0];
    };
    const list = h('ul', { class: 'tq-checks' });
    const checks = () => {
      const longs = mel.filter((x) => x.l >= 4);
      const out = [
        ['四格和弦都放了', prog.every(Boolean), '还有空着的格子：点「① 和弦」，把四格都放上。'],
        ['最后一格悬着（不是家）：圈才转得起来', !!prog[3] && prog[3] !== 1, '最后一格放的是家：那是句号，圈每转一次就停一次。换成第 5 级或者第 7 级。'],
        ['贝斯都站在地基上', prog.every((d, i) => d && bassDeg[i] === d), '有的格子里贝斯没站在地基上：点「② 贝斯」，红的那一格重新点。'],
        ['旋律至少 5 个音', mel.length >= 5, '旋律还太少：点「③ 旋律」，至少写 5 个音。'],
        ['旋律的长音（4 格以上）都踩在色带上', longs.length > 0 && longs.every((x) => inC(Math.floor(x.s / 8), x.m)), longs.length ? '有个长音踩空了（格子里空心的长块）：把它挪到色带上，或者缩短它。' : '旋律里还没有长音：把某个音拉到 4 格以上，让它踩在色带上。'],
      ];
      if (tier >= 3) {
        out.push(['旋律里有路过的音（短的、不在色带上）', mel.some((x) => x.l <= 2 && !inC(Math.floor(x.s / 8), x.m)), '旋律全踩在色带上了：有点平。在两个踩实的音中间，填一个短的、路过的。']);
        out.push(['收尾三盏灯全亮', lit().every(Boolean), '收尾的三盏灯没全亮：第 1 格要是家，贝斯站在它的地基上，「④ 收尾」的最后一个音落在家上。']);
      }
      return out;
    };
    const slots = progSlots(B, prog, {
      onPick(i) {
        slot = i;
        paint();
      },
    });
    const tabs = h('div', { class: 'tq-tabs' });
    const tools = h('div', { class: 'tq-row' });
    const TABS = [['chords', '① 和弦'], ['bass', '② 贝斯'], ['mel', '③ 旋律'], ...(tier >= 2 ? [['end', '④ 收尾']] : [])];
    const TIP = {
      chords: tier === 1 ? '挑一套和弦。' : '点一格，再在键盘上点一级：就在那一级上叠一摞，放进这一格。',
      bass: tier === 1 ? '贝斯已经站在每一摞的地基上了。去写旋律吧。' : '点一格，再在键盘上点贝斯站的键：站在地基上最稳。',
      mel: '在格子里点，或者点键盘：写一句旋律。长音踩在色带上。',
      end: '转两圈以后回到第 1 格，停住。在键盘上点旋律的最后一个音。',
    };
    function paint() {
      list.replaceChildren(...checks().map(([text, ok]) => h('li', { class: ok ? 'ok' : '' }, text)));
      tabs.replaceChildren(...TABS.map(([id, label]) => {
        const done = id === 'chords' ? prog.every(Boolean) : id === 'bass' ? bassDeg.every(Boolean) : id === 'mel' ? mel.length >= 5 : !!end;
        return h('button', { class: ['btn sm', id === tab && 'on', done && 'done'], type: 'button', 'data-sfx': 'tick', onclick: () => go(id) }, label);
      }));
      slots.set(prog);
      slots.el.hidden = tab === 'mel' || tab === 'end'; // 写旋律的时候和弦看格子里的色带就行，这一行让给工具按钮
      slots.now(tab === 'chords' || tab === 'bass' ? slot : -1);
      if (tab === 'bass') prog.forEach((d, i) => d && bassDeg[i] && bassDeg[i] !== d && slots.flag(i, 'bad'));
      B.lamps(tab === 'end' || (tier >= 3 && end) ? lit() : null);
      const sc = score(tab === 'end');
      if (tab === 'mel') B.rollShow(sc, { rows: pad.rows(), mode: 'place', unit: 2, snap: 2, tone: true });
      else B.rollShow(sc, { tone: true });
      B.chord(tab === 'mel' || tab === 'end' ? null : chordAt(slot));
    }
    function go(id) {
      tab = id;
      B.silent = id !== 'mel'; // 写旋律的时候键盘自己响；别的几步由这里决定放什么
      tools.replaceChildren(...(id === 'chords' && tier === 1 ? SETS.map((o) => btn(o.name, () => {
        prog = [...o.prog];
        bassDeg = [...o.prog];
        paint();
        play();
      }, o.prog.join() === prog.join() ? 'primary sm' : 'sm')) : id === 'mel' ? [...pad.buttons(), btn('清空旋律', () => {
        mel = [];
        paint();
      })] : []));
      f.say(TIP[id]);
      paint();
    }
    const play = () => locked(B, () => B.playScore(score(tab === 'end'), { times: tab === 'end' ? 1 : 2 }));
    const save = async () => {
      const bad = checks().find((c) => !c[1]);
      if (bad) return f.bad(bad[2]);
      // 转一圈，再接上收尾那一格（回到第 1 格，停住）
      const whole = score(true);
      B.rollShow(whole, { tone: true });
      B.lamps(lit());
      await locked(B, () => B.playScore(whole));
      saveWork({ level: 'T27', root, scale: 'minor', notes: mel.map((x) => x.m), cells: mel.map((x) => [x.s, x.l, x.m]), steps: 32, bpm: 96, chords: [...prog], bass: prog.map((_, i) => [i * 8, 8, bassOf(i)]), end: end || root });
      f.good(`收进小本子了：${prog.join(' → ')}，是你搭的一段，啾。`);
    };
    B.onRoll = (m) => {
      mel = m.map((x) => ({ s: x.s, l: x.l, m: x.m }));
      list.replaceChildren(...checks().map(([text, ok]) => h('li', { class: ok ? 'ok' : '' }, text)));
    };
    return {
      ask: '**先和弦，再贝斯，再旋律**：点上面的小牌子换步骤。清单都打上勾就能收。',
      start() {
        f.tools.append(tabs, btn('收进小本子', save, 'primary'));
        f.row.append(slots.el, tools, list);
        go('chords');
      },
      replay: play,
      onKey(m) {
        const d = B.degOf(m);
        if (tab === 'mel') return pad.key(m);
        if (!d) return f.say('只用**亮着的键**。', true);
        if (tab === 'end') {
          end = m;
          B.tone(m);
          paint();
          return f.say((m - root) % 12 === 0 ? '落在家上：第三盏灯亮了。' : `停在第 ${d} 级上：旋律还悬着。想收住，落在**家**上。`);
        }
        if (tier === 1) return f.say(tab === 'chords' ? '铜：和弦从上面三套里挑。' : '铜：贝斯已经站好了。点「③ 旋律」去写。', true);
        if (tab === 'chords') {
          prog[slot] = d;
          bassDeg[slot] = 0; // 和弦换了，这一格的贝斯要重新点
          B.playChord(B.chordOf(d));
          if (slot < 3) slot++;
          paint();
          return f.say(prog.every(Boolean) ? (prog[3] === 1 ? '四格都放了。最后一格是家：圈会卡一下，换一个悬着的更好。' : '四格都放了。点「② 贝斯」。') : `放了第 ${d} 级。下一格。`);
        }
        if (!prog[slot]) return f.say('这一格还没有和弦。先点「① 和弦」。', true);
        bassDeg[slot] = d;
        B.playChord(chordAt(slot), { show: false, len: 0.8, vel: 0.45 });
        B.tone(B.degMidi(d) - 12, { voice: 'bass', len: 0.8 });
        const good = d === prog[slot];
        if (good && slot < 3) slot++;
        paint();
        f.say(good ? '站在地基上：稳。' : `第 ${d} 级不是这一摞的地基（地基是第 ${prog[slot]} 级）：听着飘。可以再点一次。`, !good);
      },
      async solve() {
        prog = [1, 6, 3, 7];
        bassDeg = [1, 6, 3, 7];
        mel = [[0, 2, 5], [2, 2, 3], [4, 2, 4], [6, 2, 5], [8, 4, 8], [12, 4, 6], [16, 2, 7], [18, 2, 5], [20, 4, 3], [24, 4, 4], [28, 4, 2]].map(([s, l, d]) => ({ s, l, m: B.degMidi(d) }));
        end = root;
        go('mel');
        await save();
      },
    };
  });
}

export const THEORY_TOYS = {
  octavehunt, stepecho, keymatch, buildscale, ladderfix, homeward, movehome, finishline,
  leapback, askanswer, motifecho, lengthcopy, phrase, pairhunt, chordbuild, bassfind, cadence, progear, landing, songlet,
};
