// 乐理线重做 · 第三期的挑战（2026-11-18，方案见 docs/training-plan.md “乐理线重做”）。都在乐理台上做，架子是 theory-toys.js 的 frame()。
// 约定照旧：make(spec, env) → { el, destroy() }，env.tier 是铜 1 / 银 2 / 金 3，过了调 env.done(几颗星)；__auto() 给走查脚本用。
// 单元 5「拆歌」（歌从曲目库里取，翻到乐理台上：theory-songs.js）：
//   findhome    T28 听一圈，在键盘上找出它的家（你点的键，会让这一圈停在它上面）
//   findchords  T29 跟着贝斯，一格一格点出地基，填出四格和弦
//   findmelody  T30 一句旋律：踩过哪几级（铜、银）/ 最后停在哪个键上（金）
//   songladder  大关的第二段：把梯子修成这首歌用的那一把
//   pentaback   T8  啾啾唱一句，你在安全区的键上弹回来（第一期留下的：原来是一排键，这回搬到乐理台上）
// 乐理大关（TB）是这四样接力，拆的是同一首歌（spec.boss：一段只做一首，歌由第一段挑）。
// 选学「看懂谱子」「和弦进阶」的挑战在文件后半。
import { byTier, pick, shuffle } from './classroom-kit.js';
import { MAJOR, MINOR, PENTA, LADDERS, nameOf } from './theory-bench.js';
import { progSlots } from './theory-guide.js';
import { frame, locked, btn, blind } from './theory-toys.js';
import { BENCH_SONGS, benchSong, tuneScore, sliceScore, sameProg } from './theory-songs.js';
import { songLadder, asBass, stopOn, whyNotHome, keyName, askThird } from './theory-tasks3.js';
import { QUIZ } from './theory-quiz3.js';

const same = (a, b) => a.every((x, i) => x === b[i]);

// 大关拆哪一首：铜是这个单元里拆过的三首，银是没拆过的三首，金是六首里随便一首。第一段挑，后面三段接着拆它
const BOSS_POOL = [['faded', 'gangstas-paradise', 'shape-of-you'], ['save-your-tears', 'dance-monkey', 'the-nights'], BENCH_SONGS];
let bossPick = null;
function bossSong(tier, fresh) {
  if (fresh || !bossPick) {
    const pool = byTier(tier, BOSS_POOL).filter((id) => id !== bossPick?.id);
    bossPick = benchSong(pick(pool));
  }
  return bossPick;
}
/** 这一档的歌一首一首来（不连着重样）；大关里是那一首 */
function songs(spec, tier, fresh = false) {
  let order = [];
  return () => {
    if (spec.boss) return bossSong(tier, fresh);
    if (!order.length) order = shuffle(spec.songs || BENCH_SONGS);
    return benchSong(order.shift());
  };
}

// ───────────── T28 找到家 ─────────────

function findhome(spec, env) {
  const tier = env.tier || 1;
  const f = frame(env, spec.boss ? 1 : spec.need || byTier(tier, [2, 3, 3]), { listenLabel: '▶ 听这一圈' });
  const B = f.bench;
  B.autoTrail = false;
  B.silent = true;
  const next = songs(spec, tier, true);
  return f.start(() => {
    const song = next();
    songLadder(B, song, { dark: tier >= 2, home: false, degrees: false });
    const sc = B.score(tuneScore(song.id));
    B.set({ top: 'roll', trail: tier < 3 });
    if (tier < 3) B.rollShow(sc, { anon: true });
    else B.rollClear();
    let stage = 'home';
    let onThird = null;
    const hear = () => locked(B, () => B.playScore(sc, { keys: false }));
    const done = () => {
      stage = 'done';
      songLadder(B, song);
      if (tier < 3) B.rollShow(sc);
      B.mark(song.root, 'good');
      f.good(`家是 **${song.homeName}**。${song.name}是 ${keyName(song)}。`);
    };
    return {
      ask: `${song.name}的一圈。它的**家**是哪个键？点一个键试试：这一圈的最后会停在它上面。${tier === 3 ? '找到家，再点出它的**第 3 级**。' : ''}`,
      hint: tier === 1 ? '铜：亮着的是这首歌用的 7 个键，家就在里面。先看格子最底下那条蓝线：贝斯常常从家出发，可不一定。' : tier === 2 ? '银：键不亮了。先听贝斯的第一下，再用“试停”验一验。' : '金：只能听。停在哪个键上最踏实，哪个就是家。',
      start: hear,
      replay: hear,
      async onKey(m) {
        if (stage === 'third') return onThird(m);
        if (stage !== 'home') return;
        await locked(B, () => stopOn(B, sc, m));
        if (B.degOf(m) !== 1) return f.bad(whyNotHome(B, m, tier === 3), m);
        if (tier < 3) return done();
        stage = 'third';
        f.say(`✓ 家是 **${song.homeName}**（桔红的）。再认梯子：它的**第 3 级**离家 3 格，还是 4 格？点出来。`);
        onThird = askThird(B, song, { miss: (msg, key) => f.bad(msg, key), lock: (fn) => locked(B, fn), done });
      },
      async solve() {
        await f.round.onKey(song.root);
        if (tier === 3) await f.round.onKey(song.root + LADDERS[song.ladder][2]);
      },
    };
  });
}

// ───────────── 大关第二段：把梯子修成这首歌的 ─────────────

const MOVE = [3, 6, 7];

function songladder(spec, env) {
  const tier = env.tier || 1;
  const f = frame(env, spec.boss ? 1 : spec.need || 2, { listenLabel: '▶ 听这首歌' });
  const B = f.bench;
  B.autoTrail = false;
  B.silent = true;
  const next = songs(spec, tier);
  return f.start(() => {
    const song = next();
    const root = song.root;
    const target = LADDERS[song.ladder];
    songLadder(B, song);
    const sc = B.score(tuneScore(song.id)); // 键号要照这首歌自己的梯子算：先算好，再把台子上的梯子换成“你的”
    let offs;
    if (tier === 1) offs = [...(song.ladder === 'minor' ? MAJOR : MINOR)];
    else do offs = MAJOR.map((o, i) => (MOVE.includes(i + 1) && Math.random() < 0.5 ? MINOR[i] : o)); while (same(offs, target));
    const line = () => [...offs.map((o) => root + o), root + 12];
    const set = () => {
      B.set({ ladder: { root, offsets: [...offs] }, home: true, degrees: tier === 1, dark: false, top: 'roll', trail: tier < 3 });
      if (tier < 3) B.rollShow(sc, { anon: tier === 2 });
      else B.rollClear();
    };
    const hear = () => locked(B, () => B.playScore(sc, { keys: false }));
    const check = async () => {
      const k = offs.findIndex((o, i) => o !== target[i]);
      if (k >= 0) {
        const n = offs.filter((o, i) => o !== target[i]).length;
        return f.bad(tier === 1 ? `第 ${k + 1} 级对不上：歌里唱的是 **${nameOf(root + target[k])}**，你的梯子上是 ${nameOf(root + offs[k])}。点它，挪一格。`
          : tier === 2 ? `还有 ${n} 级和这首歌对不上。先听歌，再听你的梯子：哪一级别扭？` : '还不一样。先听歌，再听你的梯子。');
      }
      await locked(B, () => B.playLine(line(), { gap: 0.22, trail: false }));
      f.good(`${MOVE.map((d) => `第 ${d} 级`).join('、')}都${song.ladder === 'minor' ? '靠左' : '靠右'}：${song.ladder === 'minor' ? '暗' : '亮'}的梯子。${song.name}是 **${keyName(song)}**。`);
    };
    return {
      ask: `${song.name}的家找到了（桔红的）。把梯子修成它用的那一把：点第 **3、6、7** 级，它们会在两个位置之间来回挪。`,
      hint: tier === 1 ? '铜：看格子。行首没有数字的那几行，是歌里唱了、你的梯子上却没有的音。' : tier === 2 ? '银：格子不标级了，键上也不标。听歌，再点「听我的梯子」比。修好了点「对一下」。' : '金：只能听。修好了点「对一下」。',
      start() {
        f.row.append(btn('▶ 听我的梯子', () => locked(B, () => B.playLine(line(), { gap: 0.22, trail: false }))), btn('对一下', check, 'primary'));
        set();
        hear();
      },
      replay: hear,
      onKey(m) {
        const k = offs.findIndex((o) => root + o === m);
        if (k < 0) return f.say('点**亮着的键**。', true);
        if (!MOVE.includes(k + 1)) {
          B.tone(m);
          return f.say(`第 ${k + 1} 级两把梯子都一样，不用动。能挪的是第 3、6、7 级。`, true);
        }
        offs[k] = offs[k] === MAJOR[k] ? MINOR[k] : MAJOR[k];
        set();
        B.tone(root + offs[k]);
        f.say(`第 ${k + 1} 级${offs[k] === MINOR[k] ? '往左挪了一格' : '往右挪了一格'}。`);
        if (tier === 1 && same(offs, target)) check();
      },
      async solve() {
        offs = [...target];
        set();
        await check();
      },
    };
  });
}

// ───────────── T29 找到和弦 ─────────────

function findchords(spec, env) {
  const tier = env.tier || 1;
  const f = frame(env, spec.boss ? 1 : spec.need || 2, { listenLabel: '▶ 听整圈' });
  const B = f.bench;
  B.autoTrail = false;
  B.silent = true;
  const next = songs(spec, tier);
  return f.start(() => {
    const song = next();
    songLadder(B, song, { degrees: tier === 1 });
    const sc = B.score(tuneScore(song.id));
    const spans = sc.chords;
    const filled = [];
    const prog = spans.map(() => 0);
    const slots = progSlots(B, prog);
    const hide = tier === 1 ? [] : ['bass'];
    let cur = 0;
    B.set({ top: 'roll', trail: tier < 3 });
    const show = () => (tier < 3 ? B.rollShow({ ...sc, chords: filled }, { fit: spans.flatMap((c) => c.notes), hide }) : B.rollClear());
    const focus = () => {
      slots.now(cur);
      B.roll.head(spans[cur].s);
      B.chord(null);
    };
    const hearOne = () => locked(B, async () => {
      const c = spans[Math.min(cur, spans.length - 1)];
      await B.playScore(sliceScore(sc, c.s, c.s + c.l), { keys: false, offset: c.s });
      if (cur < spans.length) B.roll.head(spans[cur].s);
    });
    const hearAll = () => locked(B, async () => {
      await B.playScore(sc, { keys: false });
      if (cur < spans.length) B.roll.head(spans[cur].s);
    });
    return {
      ask: `${song.name}（${keyName(song)}）：一圈 ${spans.length} 格和弦。一格一格点出**贝斯站的键**：它就是这一格的地基。`,
      hint: tier === 1 ? '铜：格子最底下那条蓝线是贝斯。它停在标着几的那一行，就在键盘上找标着几的键。' : tier === 2 ? '银：贝斯不画了，只能听；键上也不标级，从桔红的家往上数。' : '金：格子收起来了。全靠听：你点的键会当贝斯，和这一格一起响。',
      start() {
        f.row.append(btn('▶ 听这一格', hearOne, 'primary'), slots.el);
        show();
        focus();
        hearAll();
      },
      replay: hearAll,
      async onKey(m) {
        if (cur >= spans.length) return;
        const c = spans[cur];
        const d = B.degOf(m);
        if (!d) return f.bad('这个键不在这首歌的梯子上。只在**亮着的键**里找。', m);
        if (d === c.deg) {
          filled.push(c);
          prog[cur] = d;
          slots.set(prog);
          show();
          B.playChord(c.notes, { bass: true, len: 0.8 });
          cur++;
          if (cur < spans.length) {
            focus();
            return f.say(`第 ${cur} 格是第 ${d} 级。下一格。`);
          }
          slots.now(-1);
          await locked(B, async () => {
            await new Promise((r) => setTimeout(r, 800));
            await B.playScore(sc);
          });
          const twins = sameProg(song.prog, song.id);
          return f.good(`**${song.prog.join(' → ')}**：填出来了。${twins.length ? `${twins.join('、')}转的也是这一套。` : song.prog[song.prog.length - 1] === 1 ? '最后一格才回家。' : '最后一格悬着，所以转得起来。'}`);
        }
        const mine = asBass(B, m);
        const real = sc.bass.find((b) => b.s >= c.s && b.s < c.s + c.l)?.m ?? c.notes[0] - 12;
        const part = sliceScore(sc, c.s, c.s + c.l);
        await locked(B, () => B.playScore({ ...part, bass: [{ s: 0, l: part.steps, m: mine }] }, { keys: false, offset: c.s }));
        B.roll.head(c.s);
        const inside = c.notes.some((x) => (x - m) % 12 === 0);
        f.bad(`第 ${cur + 1} 格的贝斯不在 **${nameOf(m)}** 上：你点的站上去，${inside ? '飘，像踮着脚' : '和上面打架'}。真的贝斯比它**${real > mine ? '高' : '低'}**。`, m);
      },
      async solve() {
        while (cur < spans.length) await f.round.onKey(spans[cur].notes[0]);
      },
    };
  });
}

// ───────────── T30 找到旋律 ─────────────

// 每首歌拿来问的那一句：从第几格到第几格
const PHRASES = { faded: [0, 64], 'gangstas-paradise': [0, 32], 'shape-of-you': [0, 32], 'save-your-tears': [48, 64], 'dance-monkey': [0, 32], 'the-nights': [0, 16] };

function findmelody(spec, env) {
  const tier = env.tier || 1;
  const f = frame(env, spec.boss ? 1 : spec.need || byTier(tier, [2, 3, 3]), { listenLabel: '▶ 听这一句' });
  const B = f.bench;
  B.autoTrail = false;
  const next = songs(spec, tier);
  return f.start(() => {
    const song = next();
    songLadder(B, song, { degrees: tier === 1 });
    const [a, b] = PHRASES[song.id] || [0, song.steps];
    const sc = sliceScore(B.score(tuneScore(song.id)), a, b);
    B.set({ top: 'roll', trail: tier < 3 });
    if (tier < 3) B.rollShow(sc, { tone: true, anon: tier === 2 });
    else B.rollClear();
    const hear = () => locked(B, () => B.playScore(sc, { parts: ['mel', 'bass'], keys: false }));
    if (tier === 3) {
      const last = [...sc.mel].sort((x, y) => x.s - y.s).pop();
      const d = B.degOf(last.m);
      return {
        ask: `${song.name}里的一句，不给你看。它**最后停在哪个键上**？点出来。`,
        hint: '金：桔红的是家。你点的键也会响：和最后那个音比一比高低。',
        start: hear,
        replay: hear,
        onKey(m) {
          if (!B.degOf(m)) return f.bad('这个键不在这首歌的梯子上。只在**亮着的键**里找。', m);
          if (B.degOf(m) !== d) return f.bad(`不是它。它最后停的那个音，比你点的**${last.m > m ? '高' : '低'}**。`, m);
          B.mark(m, 'good');
          f.good(d === 1 ? '最后落在**家**上：这一句是答，说完了。' : `最后停在**第 ${d} 级**：悬着，像在问，等着下一句。`);
        },
        solve: () => f.round.onKey(last.m >= 60 ? last.m : last.m + 12),
      };
    }
    const want = [...new Set(sc.mel.map((n) => B.degOf(n.m)))].sort((x, y) => x - y);
    const got = new Set();
    const markDeg = (d) => {
      for (let m = 60; m <= 84; m++) if (B.degOf(m) === d) B.mark(m, 'good');
    };
    const ends = [...sc.mel].sort((x, y) => x.s - y.s).pop();
    return {
      ask: `${song.name}里的一句。把它**踩过的级**在键盘上都点出来：一共 ${want.length} 个，哪一层楼的都算。`,
      hint: tier === 1 ? '铜：格子行首的数字是第几级，键上也标着：对着找。' : '银：都不标了。桔红的那一行（那个键）是家：从它往上数。',
      start: hear,
      replay: hear,
      onKey(m) {
        const d = B.degOf(m);
        if (!d) return f.bad('这个键不在梯子上：这句旋律没踩过它。', m);
        if (!want.includes(d)) return f.bad(`这一句没踩过${tier === 1 ? `**第 ${d} 级**` : `这一级（${nameOf(m)}）`}：格子里它那一行是空的。`, m);
        if (got.has(d)) return f.say(`这一级点过了。还差 ${want.length - got.size} 个。`);
        got.add(d);
        markDeg(d);
        if (got.size < want.length) return f.say(`找到 ${got.size} / ${want.length}。`);
        const e = B.degOf(ends.m);
        f.good(`只踩了第 ${want.join('、')} 级。句尾${e === 1 ? '落在家上：是答' : `停在第 ${e} 级：悬着，是在问`}。`);
      },
      async solve() {
        for (const d of want) if (!got.has(d)) await f.round.onKey(B.degMidi(d));
      },
    };
  });
}

// ───────────── T8 啾啾唱一句，你弹回来 ─────────────
// 第一期留下的一处：T8 的挑战原来是一排 6 个键（classroom-ear.js 的 pentaecho，2026-11-18 清掉了），不在乐理台上。这回搬过来：同样的玩法，换到键盘上答。

function pentaback(spec, env) {
  const tier = env.tier || 1;
  const n = byTier(tier, [2, 3, 4]);
  const f = frame(env, spec.need || 3, { listenLabel: '▶ 听啾啾唱' });
  const B = f.bench;
  B.autoTrail = false;
  let lastKey = '';
  return f.start(() => {
    B.set({ ladder: { root: 60, offsets: PENTA, degrees: [1, 3, 4, 5, 7] }, home: true, degrees: tier === 1, keys: false, top: 'trail', trail: true, piano: true, dark: false });
    // 安全区的 6 个键（5 个音，加上高一层的家）里走一句：一步最多隔一个键
    let rungs;
    do {
      rungs = [Math.floor(Math.random() * 5)];
      while (rungs.length < n) {
        const nx = rungs[rungs.length - 1] + pick([-2, -1, 1, 1, 2]);
        if (nx >= 0 && nx <= 5) rungs.push(nx);
      }
    } while (rungs.join() === lastKey);
    lastKey = rungs.join();
    const want = rungs.map((r) => B.degMidi(r + 1));
    const mine = [];
    const hear = () => {
      if (tier === 1) B.ghostSet(want);
      B.unmark('ref');
      if (tier === 2) B.mark(want[0], 'ref');
      blind(B, want, 0.42);
    };
    return {
      ask: `啾啾唱了 ${n} 个音。在亮着的键上照着**弹回来**。`,
      hint: tier === 1 ? '铜：上面那条虚线是啾啾唱的。照着它的高低弹。' : tier === 2 ? '银：只亮第一个音。后面的靠耳朵：你按的键也会响，和啾啾的比一比。' : '金：只能听。',
      start: hear,
      replay: hear,
      onKey(m) {
        const k = mine.length;
        if (k >= n) return;
        if (B.rungOf(m) === null) return f.bad('只按**亮着的键**：安全区的那几个。', m);
        if (m !== want[k]) return f.bad(`第 ${k + 1} 个音不一样：你的${m > want[k] ? '**高**了' : '**低**了'}。${tier === 1 ? '看上面那条虚线。' : '点「听啾啾唱」再听一遍。'}`, m);
        mine.push(m);
        B.trailSet(mine);
        if (mine.length < n) return f.say(`${mine.length} / ${n}`);
        f.good('一个音不差。安全区里怎么接都顺。');
      },
      solve() {
        for (const m of want.slice(mine.length)) f.round.onKey(m);
      },
    };
  });
}

// ═════════════ 选学：看懂谱子、和弦进阶 ═════════════
// 题都在 theory-quiz3.js 里（小步里的“你来”用的是同一批）；这里只管每一档出哪种题、出几道。

/** 把 theory-quiz3.js 的一道题接成挑战里的一轮 */
function quizRound(f, type, q, words) {
  const z = QUIZ[type](f.bench, q, { good: (msg) => f.good(msg), bad: (msg, key) => f.bad(msg, key), say: (msg) => f.say(msg), lock: (fn) => locked(f.bench, fn) });
  return {
    ...words,
    start() {
      if (z.row) f.row.append(...z.row);
    },
    replay: z.replay,
    onKey: z.onKey,
    onStaff: z.onStaff,
    solve: () => z.solve(),
  };
}
/** 谱子上的题要知道“点了谱子的哪儿”：架子只接了键盘，这里补上 */
function staffFrame(env, need, opts) {
  const f = frame(env, need, opts);
  f.bench.onStaff = (kind, v) => f.round?.onStaff?.(kind, v);
  return f;
}
/** 一个一个出、不连着重样 */
function deck(list) {
  let pile = [];
  let last = null;
  return () => {
    if (!pile.length) pile = shuffle(list);
    if (pile.length > 1 && pile[0] === last) pile.push(pile.shift());
    last = pile.shift();
    return last;
  };
}
const whites = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, k) => lo + k).filter((m) => [0, 2, 4, 5, 7, 9, 11].includes(m % 12));
const blacks = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, k) => lo + k).filter((m) => [1, 3, 6, 8, 10].includes(m % 12));

// ───────────── T31 谱子 ↔ 键盘 ─────────────

function staffread(spec, env) {
  const tier = env.tier || 1;
  const f = staffFrame(env, spec.need || byTier(tier, [4, 5, 3]), { listenLabel: '▶ 听' });
  const inside = deck(whites(64, 77)); // 五条线里面的：E 到高一层的 F
  const wide = deck(whites(60, 81)); // 加上下面、上面带短线的
  const sharp = deck(blacks(61, 78));
  let n = 0;
  return f.start(() => {
    n++;
    if (tier === 1) return quizRound(f, 'staffkey', { notes: [inside()], names: true }, { ask: '谱上这个音符，是键盘上的哪个键？点出来。', hint: '铜：谱子右边写着每条线、每个缝的名字。' });
    if (tier === 2) {
      if (n % 2) return quizRound(f, 'staffkey', { notes: [wide()] }, { ask: '谱上这个音符，是键盘上的哪个键？点出来。', hint: '银：没有名字了。起点是那个卷卷绕着的线：G。' });
      return quizRound(f, 'keystaff', { m: wide() }, { ask: '键盘上圈着一个键。把谱上那个蓝色的音符**挪到它的位置上**，再点「放这儿」。', hint: '点谱面，或者用「高一级」「低一级」。挪的时候它会响：和圈着的键比一比。' });
    }
    const list = shuffle([wide(), wide(), sharp()]);
    return quizRound(f, 'staffkey', { notes: list }, { ask: '三个音连着读：从左到右，一个一个在键盘上点出来。', hint: '金：有一个带 **#** 的：它右边紧挨着的那个黑键。' });
  });
}

// ───────────── T32 谱子 ↔ 格子 ─────────────

const R_EASY = [[[0, 4], [4, 4], [8, 2], [10, 2], [12, 4]], [[0, 8], [8, 4], [12, 4]], [[0, 2], [2, 2], [4, 4], [8, 8]], [[0, 4], [4, 2], [6, 2], [8, 4], [12, 2], [14, 2]], [[0, 4], [4, 4], [8, 8]]];
const R_SPELL = [
  [[0, 6], [6, 2], [8, 4], [12, 4, 'r']],
  [[0, 4], [4, 4, 'r'], [8, 2], [10, 2], [12, 4]],
  [[0, 3], [3, 1], [4, 4], [8, 8]],
  [[0, 2], [2, 2, 'r'], [4, 4], [8, 6], [14, 2]],
  [[0, 8], [8, 2, 'r'], [10, 2], [12, 4]],
];
const R_HARD = [
  [[0, 3], [3, 1], [4, 2], [6, 2], [8, 1], [9, 1], [10, 2], [12, 4]],
  [[0, 2], [2, 1], [3, 1], [4, 6], [10, 2], [12, 2, 'r'], [14, 2]],
  [[0, 1], [1, 1], [2, 2], [4, 3], [7, 1], [8, 4, 'r'], [12, 4]],
  [[0, 6], [6, 1], [7, 1], [8, 3], [11, 1], [12, 4]],
];

function rhythmread(spec, env) {
  const tier = env.tier || 1;
  const f = staffFrame(env, spec.need || byTier(tier, [2, 2, 3]), { listenLabel: '▶ 听' });
  const easy = deck(R_EASY);
  const mid = deck(R_SPELL);
  const hard = deck(R_HARD);
  const toGrid = { ask: '这一小节谱子，在机器上要按亮哪几个方键？在下面的格子上点亮每个音**开头**的那一格，再点「对一下」。' };
  const toStaff = { ask: '下面的格子亮着一小节。从左到右，一个一个挑牌子，把它**写成谱子**。' };
  let n = 0;
  return f.start(() => {
    n++;
    if (tier === 1) return quizRound(f, 'onsets', { notes: easy() }, { ...toGrid, hint: '铜：只有二分、四分、八分三种音符：8 格、4 格、2 格。' });
    if (tier === 2) return quizRound(f, 'spell', { notes: mid() }, { ...toStaff, hint: '银：有带点的音符，还有休止符。蓝框圈着的是下一个要写的。' });
    if (n % 2) return quizRound(f, 'onsets', { notes: hard() }, { ...toGrid, hint: '金：有十六分音符（1 格）和带点的八分音符（3 格），还有休止符。' });
    return quizRound(f, 'spell', { notes: hard(), plain: true }, { ...toStaff, hint: '金：牌子上不写占几格了。' });
  });
}

// ───────────── T33 小节线和拍号 ─────────────

const B44 = [
  [[0, 4], [4, 4], [8, 8], [16, 2], [18, 2], [20, 4], [24, 8]],
  [[0, 8], [8, 4], [12, 4], [16, 4], [20, 4], [24, 4], [28, 4]],
  [[0, 2], [2, 2], [4, 4], [8, 4], [12, 4], [16, 8], [24, 4], [28, 4]],
  [[0, 4], [4, 2], [6, 2], [8, 8], [16, 6], [22, 2], [24, 8]],
];
const B34 = [
  [[0, 4], [4, 4], [8, 4], [12, 8], [20, 4]],
  [[0, 8], [8, 4], [12, 2], [14, 2], [16, 4], [20, 4]],
  [[0, 4], [4, 2], [6, 2], [8, 4], [12, 12]],
  [[0, 6], [6, 2], [8, 4], [12, 4], [16, 8]],
];
const FILLS = [
  { bar: 16, time: [4, 4], notes: [[0, 4], [4, 4], [8, 4]] },
  { bar: 16, time: [4, 4], notes: [[0, 8], [8, 2]] },
  { bar: 16, time: [4, 4], notes: [[0, 4], [4, 4], [8, 2], [10, 3]] },
  { bar: 12, time: [3, 4], notes: [[0, 4], [4, 6]] },
  { bar: 12, time: [3, 4], notes: [[0, 4]] },
  { bar: 16, time: [4, 4], notes: [[0, 6], [6, 2], [8, 4], [12, 3]] },
  { bar: 12, time: [3, 4], notes: [[0, 2], [2, 2], [4, 2]] },
];

function barcount(spec, env) {
  const tier = env.tier || 1;
  const f = staffFrame(env, spec.need || byTier(tier, [2, 3, 3]), { listenLabel: '▶ 听' });
  const four = deck(B44);
  const three = deck(B34);
  const fill = deck(FILLS);
  const cut = { ask: '这一串音符还没有小节线。看最前面的拍号，在两个音符之间点一下，把**小节线**放进去（再点一下拿掉），放好了点「对一下」。' };
  let n = 0;
  return f.start(() => {
    n++;
    if (tier === 1) return quizRound(f, 'barlines', { notes: four(), steps: 32, bar: 16, time: [4, 4], strip: true }, { ...cut, hint: '铜：都是 4/4：一小节 4 拍，也就是 16 格。下面的格子帮你数。' });
    if (tier === 2) {
      const waltz = n % 2 === 1;
      return quizRound(f, 'barlines', waltz ? { notes: three(), steps: 24, bar: 12, time: [3, 4] } : { notes: four(), steps: 32, bar: 16, time: [4, 4] }, { ...cut, hint: '银：先看拍号。上面的数是一小节几拍：3 拍是 12 格，4 拍是 16 格。' });
    }
    return quizRound(f, 'fillbar', { ...fill(), plain: true }, { ask: '这一小节还没满。看拍号，挑一个音符，**正好**把它补满。', hint: '金：牌子上不写占几格。蓝框是还空着的格子。' });
  });
}

// ───────────── T34 轻重、反复 ─────────────

const TUNE4 = [[[0, 4, 60], [4, 4, 64], [8, 8, 67]], [[0, 4, 65], [4, 4, 69], [8, 8, 72]], [[0, 4, 67], [4, 4, 71], [8, 8, 74]], [[0, 8, 72], [8, 8, 60]]].flatMap((b, k) => b.map(([s, l, m]) => [s + 16 * k, l, m]));
const MAPS = [{ repeats: [[0, 1]] }, { repeats: [[1, 2]] }, { repeats: [[2, 3]] }, { repeats: [[0, 3]] }, { repeats: [[1, 1]] }, { repeats: [[0, 0]] }];
const MAPS_HOUSE = [
  { repeats: [[0, 1]], voltas: [[1, '1.'], [2, '2.']] },
  { repeats: [[0, 2]], voltas: [[2, '1.'], [3, '2.']] },
  { repeats: [[1, 2]], voltas: [[2, '1.'], [3, '2.']] },
];
const DYNS = [
  { notes: [[0, 4, 60], [4, 4, 62], [8, 4, 64], [12, 4, 65]], marks: { 0: 'p', 2: 'f' } },
  { notes: [[0, 4, 67], [4, 4, 65], [8, 4, 64], [12, 4, 60]], marks: { 0: 'f', 3: 'p' } },
  { notes: [[0, 4, 60], [4, 4, 64], [8, 4, 67], [12, 4, 72]], marks: { 0: 'p', 3: 'f' }, hairpin: [0, 2] },
  { notes: [[0, 2, 60], [2, 2, 62], [4, 4, 64], [8, 4, 62], [12, 4, 60]], marks: { 0: 'mf', 2: 'f', 4: 'p' } },
];

function scoremarks(spec, env) {
  const tier = env.tier || 1;
  const f = staffFrame(env, spec.need || 2, { listenLabel: '▶ 听谱子' });
  const map = deck(tier === 3 ? MAPS_HOUSE : MAPS);
  const dyn = deck(DYNS);
  return f.start(() => {
    if (tier === 2) return quizRound(f, 'dynamics', dyn(), { ask: '音符下面写着轻重：**p** 轻、**mf** 中、**f** 重，一个记号管到下一个记号为止。点音符，把格子里每个音的轻重**摆成谱上写的**，再点「对一下」。', hint: '银：格子里那根白柱子越高，这一下越重。张开的口子（<）是渐强：一个比一个重。' });
    return quizRound(f, 'roadmap', { bars: 4, notes: TUNE4, ...map(), blind: tier === 3 }, { ask: '这张谱只写了 4 小节，可带着反复记号。照**实际走的先后**，一小节一小节点。', hint: tier === 1 ? '铜：走到 **:|** 就跳回 **|:**，只跳一次。没有 |: 的话，跳回最开头。' : '金：有“房子”。写着 1. 的只走第一遍，第二遍跳过它进 2.。走几小节，自己数。' });
  });
}

// ───────────── T35 换个站法 ─────────────

/** 一摞（[基, 中, 上]）换个站法：最底下的搬到最上面，搬 inv 次 */
function voiced(base, inv) {
  const out = [...base];
  for (let k = 0; k < inv; k++) out[out.indexOf(Math.min(...out))] += 12;
  return out;
}
const NEAR = [[1, 0, 4], [1, 0, 5], [1, 0, 6], [4, 0, 5], [6, 0, 4], [5, 0, 1], [1, 1, 4], [4, 2, 1], [5, 1, 6]]; // [上一摞是第几级, 它的站法, 下一摞是第几级]
const LAYERS = ['地基', '中间那层', '上面那层'];

function voicing(spec, env) {
  const tier = env.tier || 1;
  const f = frame(env, spec.need || byTier(tier, [3, 3, 4]), { listenLabel: tier === 2 ? '▶ 听上一摞' : '▶ 再听' });
  const B = f.bench;
  const easy = deck([[1, 1], [1, 2], [4, 1], [4, 2], [5, 1], [5, 2], [6, 1]]);
  const near = deck(NEAR);
  const ear = deck([[1, 0], [1, 1], [1, 2], [4, 0], [4, 1], [4, 2], [5, 1], [5, 2]]);
  const names = (list) => list.map(nameOf).join('、');
  return f.start(() => {
    B.set({ ladder: { root: 60, offsets: MAJOR }, home: true, degrees: tier === 1, keys: false, top: 'trail', trail: false, piano: true, dark: false });
    if (tier === 1) {
      const [deg, want] = easy();
      return quizRound(f, 'invert', { deg, want }, { ask: `这一摞是 ${names(B.chordOf(deg))}。让**${LAYERS[want]}**站到最底下。`, hint: '铜：点最底下的那个键，它会跳到最上面去。键上写着它是哪一层。' });
    }
    if (tier === 2) {
      const [fromDeg, inv, to] = near();
      const from = voiced(B.chordOf(fromDeg), inv);
      return quizRound(f, 'nearest', { from, to }, { ask: `上一摞（青色的那三个）是 ${names([...from].sort((a, b) => a - b))}。下一摞是 **${names(B.chordOf(to))}**：点三个键，挑**离上一摞最近**的站法，再点「对一下」。`, hint: '银：两摞共用的音，留在原地最省事。' });
    }
    const [deg, want] = ear();
    return quizRound(f, 'bottomear', { deg, want }, { ask: '啾啾弹了这一摞（键盘上摆的是它原来的样子），可换了个站法，不给你看。**最底下**是哪一层？点那一层的键。', hint: '金：你点的键会单独响一下：和那一摞里最低的声音比。' });
  });
}

// ───────────── T36 加点颜色 ─────────────

function colorchord(spec, env) {
  const tier = env.tier || 1;
  const f = frame(env, spec.need || 3, { listenLabel: '▶ 再听' });
  const B = f.bench;
  const names = (list) => list.map(nameOf).join('、');
  const jobs = deck([['up', 1], ['up', 5], ['up', 6], ['down', 1], ['down', 5], ['down', 4], ['back', 1], ['back', 5], ['add', 1], ['add', 4], ['add', 5]]);
  const ears = deck([{ at: 'mid', add: false }, { at: 'up', add: false }, { at: 'down', add: false }, { at: 'mid', add: true }, { at: 'up', add: true }]);
  return f.start(() => {
    B.set({ ladder: { root: 60, offsets: MAJOR }, home: true, degrees: tier === 1, keys: false, top: 'trail', trail: false, piano: true, dark: false });
    if (tier === 3) return quizRound(f, 'colorear', { deg: pick([1, 5]), want: ears() }, { ask: '啾啾弹了一摞，不给你看。它可能是原样，可能中间那层挂着，也可能顶上加了音。把你的这一摞**摆成一样**，再点「对一下」。', hint: '金：中间那层能上下各挪一级；高一层的、地基隔壁的那个键，点一下加上、再点一下拿掉。' });
    const [job, deg] = jobs();
    const chord = names(B.chordOf(deg));
    const hint = tier === 1 ? '铜：键上标着第几级。' : '银：键上不标级了。认青色的那一摞：写着“中”的是中间那层。';
    if (job === 'add') return quizRound(f, 'addtone', { deg }, { ask: `这一摞是 ${chord}。三层不动，在顶上**加一个**：高一层的、地基隔壁的那个音。`, hint });
    if (job === 'back') return quizRound(f, 'suspend', { deg, want: 'back', start: 'up' }, { ask: '中间那层现在挂在上面一级，悬着。让它**落回去**。', hint });
    return quizRound(f, 'suspend', { deg, want: job }, { ask: `这一摞是 ${chord}。把**中间那层**挂到**${job === 'up' ? '上面' : '下面'}**一级。`, hint });
  });
}

export const THEORY_TOYS3 = { pentaback, findhome, songladder, findchords, findmelody, staffread, rhythmread, barcount, scoremarks, voicing, colorchord };
