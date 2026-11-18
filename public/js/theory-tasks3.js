// 乐理线重做 · 第三期的“你来”（小步里的任务）。theory-guide.js 的 TASKS 里找不到的任务到这里找（beatDo 里那个口子）。
// 写法和那边一样：TASKS3[类型](t, ok, k) → { solve(), destroy?() }。t 是关里写的任务；做成了调 ok(一句话)；
// k 是 theory-guide.js 递过来的几样东西：{ bench, ctl（按钮那一行）, tell(话, 'ok' | 'bad'), miss(话, 键), locked(fn), btn, listenBtn, showScore, setScore, wait, progSlots }。
// 单元 5「拆歌」：
//   tryhome   试停找家：点一个键，这一圈的最后就停在它上面；停在家上才踏实。third: true 找到家以后接着认梯子
//   third     认梯子：家标着，点出第 3 级（离家 3 格是暗、4 格是亮）
//   rootfill  跟着贝斯找地基：一格一格点出贝斯站的键，把四格和弦填出来
//   usedkeys  这一句旋律踩过哪几级，在键盘上都点出来
//   marknote  在格子里点一个音：回家的句尾 / 悬着的句尾 / 改了的那一段
// 选学「看懂谱子」「和弦进阶」的任务是 theory-quiz3.js 里的那些题（小步里和挑战里是同一道），在文件最后接进来：任务的名字就是题型的名字。
// 前面几个带 export 的小函数，挑战那边（theory-toys3.js）也用。
import { LADDERS, nameOf } from './theory-bench.js';
import { benchSong, tuneScore, sliceScore, sameProg } from './theory-songs.js';
import { QUIZ, staffNotes } from './theory-quiz3.js';

export { staffNotes };

const LADDER_WORD = { minor: '小调', major: '大调' };
const MOOD = { minor: '暗', major: '亮' };

/** 把乐理台的梯子摆成这首歌的。dark：键不亮、家不标（还没找到家） */
export function songLadder(bench, song, { dark = false, home = !dark, degrees = !dark } = {}) {
  bench.set({ ladder: { root: song.root, offsets: LADDERS[song.ladder] }, dark, home, degrees, big: true });
}

/** 点的这个键拿去当贝斯：和歌里的贝斯摆在同一层（第 6、7 级在家的下面） */
export function asBass(bench, m) {
  const d = bench.degOf(m);
  if (d) return bench.degMidi(d >= 6 ? d - 7 : d) - 12;
  let b = m;
  while (b >= bench.state.ladder.root - 4) b -= 12;
  return b;
}

/** 试停：放这一圈的最后半小节，然后让旋律和贝斯都停在 m 上，听它踏不踏实 */
export function stopOn(bench, sc, m) {
  const a = Math.max(0, sc.steps - 8);
  const tail = sliceScore(sc, a, sc.steps);
  const n = tail.steps;
  return bench.playScore({ steps: n + 8, bpm: sc.bpm, chords: tail.chords, bass: [...tail.bass, { s: n, l: 8, m: asBass(bench, m) }], mel: [...tail.mel, { s: n, l: 8, m }] }, { keys: false, offset: a });
}

const HANG = {
  2: '第 2 级，就在家的隔壁：再往下挪一级',
  3: '第 3 级：稳了一半，像“先这样吧”，可没收住',
  4: '第 4 级：悬着',
  5: '第 5 级：最想往家走，可还没到',
  6: '第 6 级：像家，又不是家',
  7: '第 7 级，就在家的隔壁：再往上挪一级',
};
/** 停在 m 上为什么不踏实。plain：不说是第几级（金档：只说悬着还是打架） */
export function whyNotHome(bench, m, plain = false) {
  const d = bench.degOf(m);
  if (!d) return `**${nameOf(m)}** 不在这首歌用的 7 个音里：一停上去就打架。`;
  return plain ? `停在 **${nameOf(m)}** 上：不打架，可还悬着。再找。` : `停在 **${nameOf(m)}** 上，还悬着。它是这首歌的${HANG[d]}。`;
}

/** 这首歌的调怎么叫：“D# 小调” */
export const keyName = (song) => `${song.homeName} ${LADDER_WORD[song.ladder]}`;

/**
 * 认梯子：家已经找到了（只亮着家），点出这首歌的第 3 级。离家 3 格是暗梯子，4 格是亮梯子。
 * 点了另一个：它和这首歌真正的第 3 级只差一格，叠在家的那一摞上一起响，听得出打架。
 * on = { miss(话, 键), done(话), lock(fn) }。返回“点了一个键”时要调的函数（由调用的人接到乐理台上）。
 */
export function askThird(bench, song, on) {
  const root = song.root;
  const want = LADDERS[song.ladder][2];
  const home = [0, 2, 4].map((i) => root + LADDERS[song.ladder][i]);
  bench.set({ ladder: { root, offsets: [0], degrees: [1] }, dark: false, home: true, degrees: true });
  bench.silent = true;
  return async (m) => {
    const rel = (((m - root) % 12) + 12) % 12;
    if (rel === 0) return on.miss('这是家。从它往右数格子，黑键白键都算：第 3 格，还是第 4 格？', m);
    if (rel !== 3 && rel !== 4) return on.miss(`这个键离家 ${rel} 格。第 3 级只有两种可能：离家 **3 格**（暗梯子），或者 **4 格**（亮梯子）。`, m);
    if (rel !== want) {
      await on.lock(() => bench.playChords([[...home, root + rel + 12]], { gap: 1.3, bass: true, show: false }));
      return on.miss(`**${nameOf(m)}** 离家 ${rel} 格。可这首歌唱的是它隔壁的 **${nameOf(root + want)}**：两个叠在一起，打架。换另一个。`, m);
    }
    await on.lock(() => bench.playChords([home], { gap: 1.1, bass: true, show: false }));
    songLadder(bench, song);
    on.done(`离家 **${want} 格**：${MOOD[song.ladder]}的梯子。${song.name}是 **${keyName(song)}**。`);
  };
}

export const TASKS3 = {
  /** 试停找家。tune = 曲目的 id；says = { 第几级: 点到这一级时说什么 }；third: true = 找到家以后接着认梯子 */
  tryhome(t, ok, k) {
    const { bench } = k;
    const song = benchSong(t.tune);
    songLadder(bench, song, { dark: true });
    const sc = bench.score(tuneScore(t.tune));
    k.setScore(sc);
    bench.set({ top: 'roll' });
    bench.rollShow(sc, { anon: true });
    bench.silent = true;
    bench.autoTrail = false;
    let stage = 'home';
    k.ctl.append(k.listenBtn('▶ 听这一圈', () => k.locked(() => bench.playScore(sc, { keys: false }))));
    const reveal = () => {
      songLadder(bench, song);
      bench.rollShow(sc);
    };
    const third = () => {
      stage = 'third';
      bench.rollShow(sc, { anon: true });
      k.tell(`✓ 家是 **${song.homeName}**（桔红的）。再认梯子：从家往右数格子，它的**第 3 级**在离家 3 格的地方，还是 4 格？点出来。`, 'ok');
      onThird = askThird(bench, song, {
        miss: k.miss,
        lock: k.locked,
        done(msg) {
          stage = 'done';
          bench.rollShow(sc);
          ok(t.ok || msg);
        },
      });
    };
    let onThird = null;
    bench.onKey = async (m) => {
      if (stage === 'third') return onThird(m);
      if (stage !== 'home') return;
      await k.locked(() => stopOn(bench, sc, m));
      const d = bench.degOf(m);
      if (d !== 1) return k.miss(t.says?.[d] || whyNotHome(bench, m), m);
      if (t.third) return third();
      stage = 'done';
      reveal();
      ok(t.ok || `停在 **${nameOf(m)}** 上：踏实了。${song.name}的家是 **${song.homeName}**。`);
    };
    k.tell('点一个键试试：这一圈的最后会停在它上面。');
    return {
      solve() {
        stage = 'done';
        reveal();
        ok(t.ok || `${song.name}的家是 **${song.homeName}**。`);
      },
    };
  },

  /** 认梯子（家已经找到了）：点出第 3 级 */
  third(t, ok, k) {
    const { bench } = k;
    const song = benchSong(t.tune);
    songLadder(bench, song);
    const sc = bench.score(tuneScore(t.tune));
    k.setScore(sc);
    bench.set({ top: 'roll' });
    bench.rollShow(sc, { anon: true });
    bench.autoTrail = false;
    k.ctl.append(k.listenBtn('▶ 听这一圈', () => k.locked(() => bench.playScore(sc, { keys: false }))));
    const done = (msg) => {
      bench.rollShow(sc);
      ok(t.ok || msg);
    };
    bench.onKey = askThird(bench, song, { miss: k.miss, lock: k.locked, done });
    k.tell('桔红的是家。从它往右数：第 3 格，还是第 4 格？点一个，它会和家一起响。');
    return {
      solve() {
        songLadder(bench, song);
        done(`${song.name}是 **${keyName(song)}**。`);
      },
    };
  },

  /** 跟着贝斯找地基：一格一格点出贝斯站的键，填出四格和弦。hide: ['bass'] = 格子里不画贝斯（只听） */
  rootfill(t, ok, k) {
    const { bench } = k;
    const song = benchSong(t.tune);
    songLadder(bench, song);
    const sc = bench.score(tuneScore(t.tune));
    k.setScore(sc);
    const spans = sc.chords;
    const filled = [];
    const prog = spans.map(() => 0);
    const slots = k.progSlots(bench, prog);
    bench.set({ top: 'roll' });
    bench.silent = true;
    bench.autoTrail = false;
    let cur = 0;
    const show = () => bench.rollShow({ ...sc, chords: filled }, { fit: spans.flatMap((c) => c.notes), hide: t.hide || [] });
    const focus = () => {
      slots.now(cur);
      bench.roll.head(spans[cur].s);
      k.tell(`第 ${cur + 1} / ${spans.length} 格：竖线停着的那一格。`);
    };
    const hearOne = () => k.locked(async () => {
      const c = spans[cur];
      await bench.playScore(sliceScore(sc, c.s, c.s + c.l), { keys: false, offset: c.s });
      bench.roll.head(c.s);
    });
    const hearAll = () => k.locked(async () => {
      await bench.playScore(sc, { keys: false });
      if (cur < spans.length) bench.roll.head(spans[cur].s);
    });
    const done = () => {
      const same = sameProg(song.prog, song.id);
      ok(t.ok || `**${song.prog.join(' → ')}**：四格的地基都找到了。${same.length ? `${same.join('、')}转的也是这一套。` : ''}`);
    };
    k.ctl.append(k.listenBtn('▶ 听这一格', hearOne), k.btn('▶ 听整圈', hearAll), slots.el);
    bench.onKey = async (m) => {
      if (cur >= spans.length) return;
      const c = spans[cur];
      const d = bench.degOf(m);
      if (!d) return k.miss('这个键不在这首歌的梯子上。只在**亮着的键**里找。', m);
      if (d === c.deg) {
        filled.push(c);
        prog[cur] = d;
        slots.set(prog);
        show();
        bench.playChord(c.notes, { bass: true, len: 0.8 });
        cur++;
        if (cur < spans.length) return focus();
        slots.now(-1);
        await k.locked(async () => {
          await k.wait(850);
          await bench.playScore(sc);
        });
        return done();
      }
      // 你点的拿去当贝斯，和这一格一起响：站不站得住，一听就知道
      const mine = asBass(bench, m);
      const real = sc.bass.find((b) => b.s >= c.s && b.s < c.s + c.l)?.m ?? c.notes[0] - 12;
      const part = sliceScore(sc, c.s, c.s + c.l);
      await k.locked(() => bench.playScore({ ...part, bass: [{ s: 0, l: part.steps, m: mine }] }, { keys: false, offset: c.s }));
      bench.roll.head(c.s);
      const inside = c.notes.some((x) => (x - m) % 12 === 0);
      k.miss(`这一格的贝斯不在第 ${d} 级（${nameOf(m)}）上：你点的站上去，${inside ? '飘，像踮着脚' : '和上面打架'}。真的贝斯比它**${real > mine ? '高' : '低'}**。${(t.hide || []).includes('bass') ? '再听这一格。' : '看格子最底下那条蓝线，停在标着几的那一行。'}`, m);
    };
    show();
    focus();
    return {
      solve() {
        spans.forEach((c, i) => (prog[i] = c.deg));
        filled.push(...spans.slice(filled.length));
        cur = spans.length;
        slots.set(prog);
        slots.now(-1);
        show();
        done();
      },
    };
  },

  /** 这一句旋律踩过哪几级：在键盘上都点出来（哪一层楼的都算）。score 是级数写的一段（梯子由这一小步的 show 摆好） */
  usedkeys(t, ok, k) {
    const { bench } = k;
    const sc = k.showScore(t.score, { tone: !!t.tone, ...(t.roll || {}) });
    const want = [...new Set(sc.mel.map((n) => bench.degOf(n.m)))].sort((a, b) => a - b);
    const got = new Set();
    bench.autoTrail = false;
    k.ctl.append(k.listenBtn('▶ 听这一句', () => k.locked(() => bench.playScore(sc, { parts: t.parts }))));
    const markDeg = (d) => {
      for (let m = 60; m <= 84; m++) if (bench.degOf(m) === d) bench.mark(m, 'good');
    };
    const done = () => ok(t.ok || `踩过的是第 ${want.join('、')} 级：一共 ${want.length} 个。`);
    bench.onKey = (m) => {
      const d = bench.degOf(m);
      if (!d) return k.miss('这个键不在梯子上：这句旋律没踩过它。', m);
      if (!want.includes(d)) return k.miss(`这一句没踩过**第 ${d} 级**。看格子：行首标着 ${d} 的那一行是空的。`, m);
      if (got.has(d)) return k.tell(`第 ${d} 级点过了。还差 ${want.length - got.size} 个。`);
      got.add(d);
      markDeg(d);
      if (got.size === want.length) return done();
      k.tell(`找到 ${got.size} / ${want.length}。`);
    };
    k.tell(`0 / ${want.length}。格子行首的数字是第几级：在键盘上找标着同一个数的键。`);
    return {
      solve() {
        want.forEach(markDeg);
        done();
      },
    };
  },

  /**
   * 在格子里点一个音。两种用法：
   *   ends + want：ends 是句尾那几个音（第几个，0 起），先描上蓝边；want = 'home'（落在家上的）/ 'hang'（悬着的）
   *   accept：点到这几个音里的任意一个就算（“改了的那一段”），miss = 点到别的时说什么
   */
  marknote(t, ok, k) {
    const { bench } = k;
    const sc = k.showScore(t.score, { mode: 'pick', pickCol: true, tone: !!t.tone, ...(t.roll || {}) });
    const ends = t.ends || [];
    const mel = () => bench.roll.mel;
    ends.forEach((i) => (mel()[i].cls = 'cand'));
    bench.roll.set({});
    bench.autoTrail = false;
    let finished = false;
    k.ctl.append(k.listenBtn('▶ 听这一句', () => k.locked(() => bench.playScore(sc, { parts: t.parts }))));
    const win = (list, msg) => {
      finished = true;
      list.forEach((j) => (mel()[j].cls = 'good'));
      bench.roll.set({});
      ok(t.ok || msg);
    };
    bench.onPick = (i) => {
      if (finished) return;
      const n = mel()[i];
      bench.tone(n.m);
      bench.flash(n.m, 300);
      if (t.accept) return t.accept.includes(i) ? win(t.accept, '') : k.miss(t.miss || '不是这一段。再看看。');
      if (!ends.includes(i)) return k.miss('这个音在句子中间。找**句尾**：描着蓝边的那几个。');
      const d = bench.degOf(n.m);
      if (t.want === 'home') return d === 1 ? win([i], '落在家上：这一句答上了。') : k.miss(`这个句尾停在第 ${d} 级上：悬着，是在问。找落在**家**上的那个（桔红的那一行）。`);
      return d !== 1 ? win([i], `停在第 ${d} 级上：悬着，是在问。`) : k.miss('这个句尾落在家上了：是答。找一个**悬着**的。');
    };
    k.tell(t.accept ? '在上面的格子里点。' : '在上面的格子里，点描着蓝边的音。');
    return {
      solve() {
        const hit = t.accept || [ends.find((i) => (bench.degOf(mel()[i].m) === 1) === (t.want === 'home'))];
        win(hit, '');
      },
    };
  },
};

// 选学的两个单元：theory-quiz3.js 里的每一种题都是一种任务。关里这样写：task: { type: 'staffkey', notes: [67], ok: '……', tip: '一进来说的那句' }
for (const [type, make] of Object.entries(QUIZ)) {
  TASKS3[type] = (t, ok, k) => {
    const q = make(k.bench, t, { good: (msg) => ok(t.ok || msg), bad: k.miss, say: (msg) => k.tell(msg), lock: k.locked });
    k.bench.onKey = (m, from, d) => q.onKey?.(m, from, d);
    k.bench.onStaff = (kind, v) => q.onStaff?.(kind, v);
    if (q.replay) k.ctl.append(k.listenBtn(t.listen || '▶ 听', q.replay));
    if (q.row) k.ctl.append(...q.row);
    if (t.tip) k.tell(t.tip);
    return { solve: () => q.solve(), destroy: () => q.destroy?.() };
  };
}
