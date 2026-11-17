// 啾啾带着走：乐理关的“学”这一步不再是“一个玩具 + 一段说明”，而是 5–8 个小步，每一步啾啾说一句、你做一件有目标的小事
// （用户 2026-11-17：“交互也简单了一些，要多一些指导教学的内容”；方案见 docs/training-plan.md “乐理线重做”）。
// 小步的种类（关里写在 guide.beats 里，一项一个小步）：
//   listen   听：放一段，键跟着亮、轨迹跟着画                { say, deg | line | score | chords, gap?, slide?, after }
//   song     听一首歌里的一句（和 listen 一样，多一个歌名）    { song, … }
//   compare  比：A、B（还可以有 C）几段来回听，只差一处        { say, a: { label, deg | line | score | chords, show? }, b: {…}, c?, after }
//   do       做：一个有目标的小任务，自动判                    { say, goal, task: { type, … }, ok }
//   pick     选：听完选一个（少用，一关最多两个）              { say, goal, deg | line?, options: [{ label, right?, why }] }
//   name     点破：做出来了，才说它叫什么                      { say, term, means }
// 每个小步都可以带 show：这一步开始时乐理台摆成什么样（只写要改的；见 applyShow）。
// 放的东西有四种写法：
//   deg     梯子上的第几级（8 = 高一层的家，0 = 家下面那一级；数组 = 几个音一起，null = 空一拍）
//   line    直接写键号（60 = 最左边的 C）
//   chords  一摞接一摞：一项是第几级（从它起隔一个拿一个，叠三层）、[第几级, 叠几层]、或者 { degs: [第几级…] }（就这几个音一起响）；bass: true 再垫上贝斯
//   score   格子里的一段：{ steps, chords: [[起, 长, 第几级, 层数?]], bass: 'root' | [[起, 长, 第几级]], mel: [[起, 长, 第几级]] }（一格 = 十六分），
//           parts 只放其中几样、times 转几圈、lamps 放的时候亮三盏灯
// 任务（task.type）有哪几种见下面的 TASKS：第一期十种，第二期（旋律、和声）又加了十五种。
// createGuide(level, env) → { el, bench, auto(), destroy() }
//   env.say(text, mood)   啾啾在右边说这一句        env.progress(i, n)   现在是第几小步
//   env.done()            小步都做完了              env.next()           学生点了“去挑战”
import { h, rich } from './util.js';
import { audio } from './audio.js';
import { sfx } from './sfx.js';
import { pop } from './fx.js';
import { LoopPlayer } from './looper.js';
import { SCALES } from './scales.js';
import { createTheoryBench, LADDERS, MAJOR, MINOR, RING, MOOD_WORD, nameOf, LO, HI } from './theory-bench.js';

const STEP_WORD = { 1: '一格', 2: '两格', 3: '三格' };
const KIND_WORD = { listen: '听', song: '听一首歌', compare: '比一比', do: '你来', pick: '选一个', name: '它叫什么' };
const MOOD_SAY = { major: '亮的', minor: '暗的', dim: '挤的：三层之间都只隔三格', other: '说不上亮暗' };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const names = (notes) => notes.map(nameOf).join(' ');

/** 四格和弦：一格一个，写着第几级。set(prog) 换内容，now(i) 圈出一格，playing(i) 正在响的那一格 */
export function progSlots(bench, prog, { onPick } = {}) {
  const el = h('div', { class: 'tp-slots' });
  let list = [...prog];
  let cur = -1;
  const paint = () => el.replaceChildren(...list.map((d, i) => {
    const b = h('button', { class: ['tp-slot', !d && 'empty', i === cur && 'now'], type: 'button', 'data-sfx': 'none' }, h('b', {}, d ? String(d) : '?'), h('span', {}, d ? `${MOOD_WORD[bench.moodOf(bench.chordOf(d))] || ''} · ${nameOf(bench.chordOf(d)[0])}` : `第 ${i + 1} 格`));
    b.addEventListener('click', () => onPick?.(i));
    return b;
  }));
  paint();
  return {
    el,
    set(p) {
      list = [...p];
      paint();
    },
    now(i) {
      cur = i;
      paint();
    },
    playing(i) {
      [...el.children].forEach((x, j) => x.classList.toggle('playing', j === i));
    },
    flag(i, cls) {
      el.children[i]?.classList.add(cls);
    },
  };
}

export function createGuide(level, env) {
  const beats = level.guide.beats;
  const bench = createTheoryBench();
  let i = 0;
  let cur = null; // 现在这一小步：{ auto(), destroy() }
  let alive = true;
  let curScore = null; // 格子里现在摆着的那一段（键号的）
  const done = beats.map(() => false);

  const dots = h('ol', { class: 'tg-dots', 'aria-label': '这一关的小步' });
  const chip = h('span', { class: 'tg-kind' });
  const goal = h('div', { class: 'tg-goal' });
  const ctl = h('div', { class: 'tg-ctl' });
  const note = h('div', { class: 'tg-note', 'aria-live': 'polite' });
  const prev = h('button', { class: 'btn ghost sm', type: 'button' }, '← 上一小步');
  const next = h('button', { class: 'btn', type: 'button' }, '下一小步 →');
  const el = h('div', { class: 'cl-toy tg' },
    h('div', { class: 'tg-top' }, dots),
    bench.el,
    h('div', { class: 'tg-panel' }, h('div', { class: 'tg-head' }, chip, goal), ctl, note),
    h('div', { class: 'tg-foot' }, prev, next));

  prev.addEventListener('click', () => enter(i - 1));
  next.addEventListener('click', () => (i >= beats.length - 1 ? env.next?.() : enter(i + 1)));

  const paintDots = () => dots.replaceChildren(...beats.map((b, j) => {
    const li = h('li', { class: j === i ? 'now' : done[j] ? 'done' : '', title: KIND_WORD[b.kind] || '' }, done[j] && j !== i ? '✓' : String(j + 1));
    if (done[j] || j <= i) li.addEventListener('click', () => j !== i && enter(j));
    return li;
  }));

  /** 把一段用级数写的 score 摆到格子上（最上面那层还是轨迹的话，换成格子） */
  function showScore(spec, rollOpts) {
    if (bench.state.top === 'trail') bench.set({ top: 'roll' });
    curScore = bench.score(spec);
    bench.rollShow(curScore, rollOpts || {});
    return curScore;
  }
  /**
   * 这一小步开始时把乐理台摆好：ladder（'major' / 'minor' / 'penta' / 一串格数 / null）、root、home、names、degrees、keys、trail、mark，
   * 第二期加的：top（'trail' / 'roll' / 'ring'）、score + roll（格子里摆一段）、chord（键盘上叠一摞：第几级，或 [第几级, 层数]）、
   * lamps（true = 照格子里那一段算）、moods（机器的键上挂亮暗牌）、chordKeys（机器的键一个键弹一摞）。
   */
  function applyShow(show = {}) {
    const patch = {};
    const st = bench.state;
    if ('ladder' in show) {
      patch.ladder = show.ladder === null ? null : {
        root: show.root ?? st.ladder?.root ?? LO,
        offsets: typeof show.ladder === 'string' ? LADDERS[show.ladder] : show.ladder,
        degrees: show.degreeLabels || (show.ladder === 'penta' ? [1, 3, 4, 5, 7] : undefined),
        noTop: show.noTop,
      };
    } else if ('root' in show && st.ladder) patch.ladder = { ...st.ladder, root: show.root };
    for (const k of ['home', 'names', 'degrees', 'keys', 'trail', 'machine', 'top', 'chordKeys']) if (k in show) patch[k] = show[k];
    bench.set(patch);
    if ('moods' in show) bench.moods(show.moods);
    if ('score' in show) {
      if (show.score) showScore(show.score, show.roll);
      else {
        curScore = null;
        bench.rollClear();
      }
    }
    if ('chord' in show) bench.chord(show.chord ? bench.chordOf(...[].concat(show.chord)) : null);
    if ('lamps' in show) bench.lamps(show.lamps === true ? (curScore ? bench.lampsOf(curScore) : null) : show.lamps);
  }
  /** 回到第 k 小步开始时的样子：从头把每一步的 show 摆一遍（这样往回翻也对） */
  function resetTo(k) {
    bench.stop();
    bench.set({ ladder: null, home: false, names: false, degrees: false, keys: false, trail: true, machine: null, top: 'trail', chordKeys: 0 });
    bench.moods(false);
    bench.chord(null);
    bench.lamps(null);
    bench.rollClear();
    bench.ring.clear();
    curScore = null;
    applyShow(level.guide.start);
    for (let j = 0; j <= k; j++) applyShow(beats[j].show);
    bench.unmark();
    bench.trailClear();
    bench.ghostSet([]);
    bench.locked = false;
    bench.silent = false;
    bench.autoTrail = true;
    bench.onKey = null;
    bench.onRoll = null;
    bench.onPick = null;
    bench.onRing = null;
    if (beats[k].show?.mark) bench.mark(beats[k].show.mark, 'ref');
  }

  const lineOf = (spec) => (spec.line ? spec.line : (spec.deg || []).map((d) => (d === null ? null : Array.isArray(d) ? d.map((x) => bench.degMidi(x)) : bench.degMidi(d))));
  const chordSpec = (c) => (typeof c === 'number' ? bench.chordOf(c) : Array.isArray(c) ? bench.chordOf(c[0], c[1]) : c.degs.map((d) => bench.degMidi(d)));
  const hasSound = (spec) => !!(spec.deg || spec.line || spec.score || spec.chords);

  function say(text, mood) {
    env.say?.(text, mood);
  }
  function tell(html, cls = '') {
    note.className = `tg-note ${cls}`;
    note.innerHTML = rich(html || '');
  }
  function finishBeat(text) {
    if (!alive) return;
    const first = !done[i];
    done[i] = true;
    tell(text ? `✓ ${text}` : '✓', 'ok');
    if (first) sfx.play('ok');
    next.classList.add('primary');
    next.disabled = false;
    pop(next);
    paintDots();
    if (done.every(Boolean)) env.done?.();
  }
  function miss(html, m) {
    sfx.play('nope');
    tell(html, 'bad');
    if (m !== undefined) {
      bench.key(m)?.classList.add('bad');
      setTimeout(() => bench.key(m)?.classList.remove('bad'), 600);
    }
  }
  const listenBtn = (label, fn) => {
    const b = h('button', { class: 'btn primary lg tg-listen', type: 'button', 'data-sfx': 'none' }, label);
    b.addEventListener('click', fn);
    return b;
  };
  const btn = (label, fn, cls = '') => h('button', { class: `btn ${cls}`, type: 'button', 'data-sfx': 'none', onclick: fn }, label);
  /** 放的时候按键没反应；放完再松开 */
  async function locked(fn) {
    bench.locked = true;
    try {
      await fn();
    } finally {
      bench.locked = false;
    }
  }
  /** 放一段（放的时候按键没反应）：四种写法见文件开头 */
  async function playSpec(spec, opts = {}) {
    bench.locked = true;
    if (spec.show) applyShow(spec.show);
    if (spec.slide !== undefined) await bench.slideTo(spec.slide);
    if (spec.score) {
      const sc = showScore(spec.score, spec.roll);
      if (spec.lamps) bench.lamps(bench.lampsOf(sc));
      await bench.playScore(sc, { parts: spec.parts, times: spec.times || 1 });
    } else if (spec.chords) {
      const degs = spec.chords.map((c) => (typeof c === 'number' ? c : Array.isArray(c) ? c[0] : null));
      const list = spec.chords.map(chordSpec);
      const times = spec.times || 1;
      await bench.playChords(Array.from({ length: times }, () => list).flat(), { gap: spec.gap || 0.9, bass: !!spec.bass, degs: degs.every(Boolean) && bench.state.top === 'ring' ? Array.from({ length: times }, () => degs).flat() : null });
    } else await bench.playLine(lineOf(spec), { gap: spec.gap || 0.36, ...opts });
    bench.locked = false;
  }

  // ───────────── 小步的几种 ─────────────

  function beatListen(b) {
    const btnEl = listenBtn(b.kind === 'song' ? '▶ 听这一句' : '▶ 听', async () => {
      await playSpec(b);
      if (alive && cur === me) finishBeat(b.after);
    });
    ctl.append(btnEl);
    const me = { auto: async () => finishBeat(b.after), destroy() {} };
    return me;
  }

  function beatCompare(b) {
    const heard = new Set();
    const sides = ['a', 'b', 'c'].filter((k) => b[k]);
    const make = (key) => {
      const side = b[key];
      const one = h('button', { class: 'btn lg tg-ab', type: 'button', 'data-sfx': 'none' }, h('small', {}, key.toUpperCase()), side.label);
      one.addEventListener('click', async () => {
        [...ctl.children].forEach((x) => x.classList.remove('on'));
        one.classList.add('on');
        await playSpec(side);
        heard.add(key);
        one.classList.add('heard');
        if (alive && cur === me && heard.size === sides.length) finishBeat(b.after);
      });
      return one;
    };
    ctl.append(...sides.map(make));
    tell(sides.length > 2 ? '三个都听一遍。可以来回听。' : '两个都听一遍。可以来回听。');
    const me = { auto: async () => finishBeat(b.after), destroy() {} };
    return me;
  }

  function beatPick(b) {
    if (hasSound(b)) ctl.append(listenBtn('▶ 听', () => playSpec(b)));
    const opts = h('div', { class: 'tg-opts' }, b.options.map((o) => {
      const one = h('button', { class: 'btn lg tg-opt', type: 'button', 'data-sfx': 'none' }, o.label);
      one.__right = !!o.right;
      one.addEventListener('click', () => {
        if (o.right) {
          one.classList.add('right');
          finishBeat(o.why);
        } else {
          one.classList.add('wrong');
          miss(o.why || '不是这个，再想想。');
        }
      });
      return one;
    }));
    ctl.append(opts);
    return { auto: async () => finishBeat(b.options.find((o) => o.right)?.why), destroy() {} };
  }

  function beatName(b) {
    ctl.append(h('div', { class: 'tg-term' }, h('b', {}, b.term), h('p', { html: rich(b.means || '') })));
    const t = setTimeout(() => {
      if (cur === me) finishBeat('');
      sfx.play('on');
    }, 500);
    const me = { auto: async () => finishBeat(''), destroy: () => clearTimeout(t) };
    return me;
  }

  // ───────────── “做”的几种任务 ─────────────

  const TASKS = {
    /** 按一个键：any（这几个里的一个）/ rel + ref（比 ref 高 / 低）/ key（机器的第几个键）/ from（'piano' 只认上面的键盘）/ stepsFrom（从哪个键数格子，说错了几格） */
    press(t, ok) {
      bench.onKey = (m, from, d) => {
        if (t.key) {
          if (from !== 'synth') return miss('这回用**下面那排**机器的键按。', m);
          if (d !== t.key) return miss(`这是键 ${d}，要的是**键 ${t.key}**。`);
          return ok();
        }
        if (t.from === 'piano' && from !== 'piano') return miss('这回在**上面的键盘**上点。');
        if (t.rel) {
          if (m === t.ref) return miss('这就是亮着的那个。换一个。', m);
          if (t.rel === 'higher' ? m > t.ref : m < t.ref) return ok(m);
          return miss(t.rel === 'higher' ? '这个更**低**：它在亮着的键左边。往右找。' : '这个更**高**：它在亮着的键右边。往左找。', m);
        }
        if (t.any?.includes(m)) return ok(m);
        if (t.stepsFrom !== undefined) {
          const n = m - t.stepsFrom;
          const want = t.any[0] - t.stepsFrom;
          if (n === 0) return miss('这是起点。往右走。', m);
          return miss(n < 0 ? '往左走了。梯子往**右**是往上。' : `你走了 **${n} 格**，要走 ${want} 格。黑键白键都算一格。`, m);
        }
        if (t.any?.some((x) => (x - m) % 12 === 0)) return miss('名字对了，楼层不对。', m);
        return miss(t.hint || '不是这个。', m);
      };
      return { solve: () => ok(t.any?.[0]) };
    },
    /** 把这些键全找出来：pc（这个名字的所有键）或 midis */
    all(t, ok) {
      const want = t.midis || Array.from({ length: HI - LO + 1 }, (_, k) => LO + k).filter((m) => m % 12 === t.pc);
      const got = new Set();
      const show = () => tell(`找到 ${got.size} / ${want.length}。`);
      bench.onKey = (m) => {
        if (!want.includes(m)) return miss(`这个是 **${nameOf(m)}**，不是要找的。`, m);
        got.add(m);
        bench.mark(m, 'good');
        if (got.size === want.length) return ok();
        show();
      };
      show();
      return { solve: () => (want.forEach((m) => bench.mark(m, 'good')), ok()) };
    },
    /** 搭梯子：从 root 出发，照 steps（每一步几格）一级一级点上去。搭好了自己放一遍 */
    seq(t, ok) {
      const midis = [t.root];
      t.steps.forEach((n) => midis.push(midis[midis.length - 1] + n));
      let k = 1;
      const cards = h('div', { class: 'tg-steps' }, t.steps.map((n) => h('span', { class: `s${n}` }, STEP_WORD[n])));
      if (!t.hideSteps) ctl.append(cards);
      const paint = () => {
        bench.set({ ladder: { root: t.root, offsets: midis.slice(0, k).map((m) => m - t.root).filter((o) => o < 12), noTop: k < midis.length }, home: true });
        [...cards.children].forEach((c, j) => {
          c.classList.toggle('now', j === k - 1);
          c.classList.toggle('done', j < k - 1);
        });
      };
      const finish = async () => {
        bench.set({ ladder: { root: t.root, offsets: midis.slice(0, -1).map((m) => m - t.root) }, home: true });
        bench.locked = true;
        await bench.playLine(midis, { gap: 0.26 });
        bench.locked = false;
        ok();
      };
      bench.autoTrail = false;
      bench.onKey = (m) => {
        if (k >= midis.length) return;
        if (m === midis[k]) {
          k++;
          paint();
          tell(k < midis.length ? `第 ${k} 级到手。下一步：**${STEP_WORD[t.steps[k - 1]]}**。` : '');
          if (k === midis.length) finish();
          return;
        }
        const from = midis[k - 1];
        const n = m - from;
        miss(n <= 0 ? `要往**右**走。这一步是${STEP_WORD[t.steps[k - 1]]}。` : `这一步是**${STEP_WORD[t.steps[k - 1]]}**：从 ${nameOf(from)} 往右数 ${t.steps[k - 1]} 个键（黑键也算）。你走了 ${n} 格。`, m);
      };
      paint();
      tell(`起点 **${nameOf(t.root)}** 已经亮了。第一步：**${STEP_WORD[t.steps[0]]}**。`);
      return { solve: () => ((k = midis.length), finish()) };
    },
    /** 自己搭一把梯子：从 root 出发，每一步一格、两格或三格，走 7 步，正好落在高一层的家上。搭完看机器的 [SCALE] 里有没有这一把 */
    freeladder(t, ok) {
      const root = t.root ?? LO;
      const top = root + 12;
      let midis = [root];
      const cards = h('div', { class: 'tg-steps' });
      const paint = () => {
        bench.set({ ladder: { root, offsets: midis.filter((m) => m < top).map((m) => m - root), noTop: midis[midis.length - 1] !== top }, home: true, degrees: true });
        cards.replaceChildren(...midis.slice(1).map((m, j) => h('span', { class: `s${m - midis[j]} done` }, STEP_WORD[m - midis[j]])));
      };
      const finish = async () => {
        const offs = midis.slice(0, -1).map((m) => m - root);
        await locked(() => bench.playLine(midis, { gap: 0.26 }));
        const hit = SCALES.find((sc) => sc.offsets.every((o, j) => o === offs[j]));
        ok(hit ? `这一把机器上有：**${hit.zh.toUpperCase() === hit.name ? hit.name : `${hit.zh}（${hit.name}）`}**，按 [SCALE] 到从上往下第 ${hit.id + 1} 盏灯就是它。` : '这一把，机器那 8 盏灯里没有：它是你自己的。怪不怪都行，啾。');
      };
      bench.autoTrail = false;
      bench.onKey = (m) => {
        const last = midis[midis.length - 1];
        if (last === top) return;
        const n = m - last;
        const left = 7 - midis.length; // 走完这一步以后还剩几步
        if (n <= 0) return miss('往**右**走：梯子是一级一级往上的。', m);
        if (n > 3) return miss(`这一步走了 ${n} 格，太大了。一步最多**三格**。`, m);
        if (m > top) return miss('走过头了：最后要正好落在高一层的家上（右边那个桔红的）。', m);
        const rest = top - m;
        if (left === 0 && rest !== 0) return miss(`这是第 7 步，要正好踩到高一层的家：还差 ${rest} 格。`, m);
        if (left > 0 && rest < left) return miss(`后面还要走 ${left} 步，可只剩 ${rest} 格了。这一步走**小**一点。`, m);
        if (left > 0 && rest > left * 3) return miss(`后面只剩 ${left} 步，却还有 ${rest} 格要走。这一步走**大**一点。`, m);
        midis.push(m);
        paint();
        if (m === top) return finish();
        tell(`第 ${midis.length} 级到手，这一步是${STEP_WORD[n]}。还要走 ${7 - midis.length + 1} 步。`);
      };
      ctl.append(cards, btn('⌫ 退一步', () => {
        if (midis.length > 1 && midis[midis.length - 1] !== top) midis.pop();
        paint();
        tell(`退到第 ${midis.length} 级。`);
      }));
      paint();
      tell('家已经亮了。一步一步往右点：每一步**一格、两格或三格**，随你。');
      return {
        solve() {
          midis = [0, 2, 3, 5, 7, 9, 10, 12].map((o) => root + o);
          paint();
          return finish();
        },
      };
    },
    /** 挪梯级：点亮着的第 move 级，它在大调 / 小调的位置之间来回挪；挪成 to 的样子就过 */
    rungs(t, ok) {
      const root = bench.state.ladder.root;
      const offs = [...bench.state.ladder.offsets];
      const target = LADDERS[t.to];
      const move = t.move || [3, 6, 7];
      bench.silent = true;
      bench.autoTrail = false;
      const check = () => offs.every((o, k) => o === target[k]) && ok();
      bench.onKey = (m) => {
        const k = offs.findIndex((o) => root + o === m);
        if (k < 0) return miss('点**亮着的键**：梯子上的那几级。', m);
        if (!move.includes(k + 1)) {
          bench.tone(m);
          return miss(`第 ${k + 1} 级不用动。要挪的是第 **${move.join('、')}** 级。`);
        }
        offs[k] = offs[k] === MAJOR[k] ? MINOR[k] : MAJOR[k];
        bench.set({ ladder: { ...bench.state.ladder, offsets: [...offs] } });
        bench.tone(root + offs[k]);
        tell(`第 ${k + 1} 级${offs[k] === MINOR[k] ? '往左挪了一格' : '挪回去了'}。`);
        check();
      };
      return {
        solve() {
          target.forEach((o, k) => (offs[k] = o));
          bench.set({ ladder: { ...bench.state.ladder, offsets: [...offs] } });
          ok();
        },
      };
    },
    /** 拿掉几级：点亮着的第 degrees 级，把它们从梯子上拿走 */
    drop(t, ok) {
      let L = { ...bench.state.ladder, degrees: bench.state.ladder.degrees || bench.state.ladder.offsets.map((_, k) => k + 1) };
      const left = new Set(t.degrees);
      bench.silent = true;
      bench.autoTrail = false;
      const remove = (d) => {
        const k = L.degrees.indexOf(d);
        L = { ...L, offsets: L.offsets.filter((_, j) => j !== k), degrees: L.degrees.filter((_, j) => j !== k) };
        bench.set({ ladder: L });
        left.delete(d);
      };
      bench.onKey = (m) => {
        const k = L.offsets.findIndex((o) => L.root + o === m);
        if (k < 0) return miss('点**亮着的键**。', m);
        const d = L.degrees[k];
        bench.tone(m);
        if (!left.has(d)) return miss(`第 ${d} 级留着：要拿走的是第 **${t.degrees.join('、')}** 级。`);
        remove(d);
        if (!left.size) return ok();
        tell(`第 ${d} 级拿走了。还有一个。`);
      };
      return { solve: () => ([...left].forEach(remove), ok()) };
    },
    /**
     * 一句话差最后一个音：点一个键补上，整句连你补的那个再放一遍；补的是 accept 里的级（默认是家）就过。
     * why：补成第几级时说什么；miss：别的级说什么；tail：补对了以后接着放的几个音（“你问，啾啾答”）
     */
    last(t, ok) {
      const head = () => t.deg.map((d) => (d === null ? null : bench.degMidi(d)));
      const accept = t.accept || [1];
      bench.silent = true;
      bench.autoTrail = false;
      ctl.append(listenBtn('▶ 听这一句', async () => {
        bench.locked = true;
        await bench.playLine(head(), { gap: t.gap || 0.34 });
        bench.locked = false;
        tell('停在这儿了。点一个键，补上最后一个音。');
      }));
      bench.onKey = async (m) => {
        const d = bench.degOf(m);
        if (!d) return miss('这个音不在梯子上。在**亮着的键**里挑。', m);
        const good = accept.includes(d);
        const mine = head().length;
        bench.locked = true;
        await bench.playLine([...head(), m, ...(good && t.tail ? [null, ...t.tail.map((x) => bench.degMidi(x))] : [])], { gap: t.gap || 0.34 });
        bench.locked = false;
        if (good) {
          if (!t.tail) bench.trailMarkLast('good');
          return ok(t.says?.[d]);
        }
        if (mine) bench.trailMarkLast('bad');
        miss(t.why?.[d] || (t.miss ? t.miss.replace('{d}', d) : `停在第 ${d} 级上，还悬着。换一个试试。`));
      };
      tell('先点「听这一句」。');
      return { solve: () => ok() };
    },
    /** 搬家：用 KEY − / + 把家挪到 to（音名的序号，0 = C） */
    home(t, ok) {
      const read = h('b', { class: 'tg-key-read' });
      const move = (dir) => {
        const L = bench.state.ladder;
        const root = LO + ((((L.root - LO + dir) % 12) + 12) % 12);
        bench.set({ ladder: { ...L, root } });
        bench.tone(root);
        paint();
        if (root % 12 === t.to) ok();
      };
      const paint = () => (read.textContent = `家在 ${nameOf(bench.state.ladder.root)}`);
      const keyBtn = (label, dir) => h('button', { class: 'btn lg tg-keybtn', type: 'button', 'data-sfx': 'detent', onclick: () => move(dir) }, label);
      ctl.append(keyBtn('KEY −', -1), read, keyBtn('KEY +', 1));
      paint();
      return {
        solve() {
          bench.set({ ladder: { ...bench.state.ladder, root: LO + t.to } });
          paint();
          ok();
        },
      };
    },
    /** 配对：上面亮一个键就按机器上对应的键，机器的键亮了就在键盘上点出它。做对 rounds 次 */
    match(t, ok) {
      let right = 0;
      let want = null;
      let lastD = 0;
      const round = () => {
        bench.unmark();
        let d;
        do d = 1 + Math.floor(Math.random() * 7); while (d === lastD);
        lastD = d;
        const dir = Math.random() < 0.5 ? 'p2k' : 'k2p';
        want = { d, dir, m: bench.machineNote(d) };
        bench.tone(want.m);
        if (dir === 'p2k') {
          bench.mark(want.m, 'target');
          tell(`第 ${right + 1} / ${t.rounds} 次：键盘上圈出来的这个，是机器的**键几**？按下面那排。`);
        } else {
          bench.synthKey(d).classList.add('target');
          tell(`第 ${right + 1} / ${t.rounds} 次：机器的**键 ${d}**亮了。在上面的键盘上点出它。`);
        }
      };
      bench.onKey = (m, from, d) => {
        if (!want) return;
        const good = want.dir === 'p2k' ? from === 'synth' && d === want.d : from === 'piano' && m === want.m;
        if (!good) {
          return miss(want.dir === 'p2k'
            ? (from === 'synth' ? `这是键 ${d}（${nameOf(m)}）。圈出来的是 **${nameOf(want.m)}**。` : '用**下面那排**机器的键回答。')
            : (from === 'piano' ? `这个是 ${nameOf(m)}。键 ${want.d} 是 **${nameOf(want.m)}**。` : '在**上面的键盘**上点。'), from === 'piano' ? m : undefined);
        }
        right++;
        sfx.play('tick');
        if (right >= t.rounds) {
          bench.unmark();
          return ok();
        }
        setTimeout(round, 500);
      };
      const t0 = setTimeout(round, 300);
      return { solve: () => ok(), destroy: () => clearTimeout(t0) };
    },
    /** 随便弹：在梯子上按 count 下（可以配一段伴奏） */
    free(t, ok) {
      let n = 0;
      let player = null;
      if (t.backing) {
        player = new LoopPlayer({ bpm: t.bpm || 96 });
        player.set({ KICK: 'x---x---x---x---', HAT1: '--x---x---x---x-' });
        const root = bench.state.ladder.root;
        player.onSchedule = (step, time) => {
          if (step % 8 === 0) audio.note(root - 24, time, 0.5, { voice: 'bass', vel: 0.6 });
          if (step % 16 === 6) audio.note(root - 24 + 7, time, 0.2, { voice: 'bass', vel: 0.45 });
        };
        const b = h('button', { class: 'btn primary lg', type: 'button', 'data-sfx': 'none' }, '▶ 放伴奏');
        b.addEventListener('click', () => {
          player.toggle();
          b.textContent = player.playing ? '■ 停伴奏' : '▶ 放伴奏';
        });
        ctl.append(b);
      }
      bench.onKey = (m) => {
        if (!bench.degreeOf(m)) return miss('这个不在梯子上。只按**亮着的键**。', m);
        n++;
        if (n >= t.count) return ok();
        tell(`${n} / ${t.count}`);
      };
      tell(`0 / ${t.count}`);
      return { solve: () => ok(), destroy: () => player?.stop() };
    },
    /** 接一句：啾啾问一句（ask），你答 count 个音；落在家上是一句完整的话，没落也算做完（话不一样；land：停在第几级时说什么） */
    answer(t, ok) {
      let mine = [];
      let asked = false;
      const ask = () => t.ask.map((d) => bench.degMidi(d));
      ctl.append(listenBtn('▶ 听啾啾问', async () => {
        mine = [];
        bench.locked = true;
        await bench.playLine(ask(), { gap: 0.34 });
        bench.locked = false;
        asked = true;
        tell(`该你了：答 **${t.count} 个音**。`);
      }));
      bench.onKey = (m) => {
        if (!asked) return miss('先点「听啾啾问」。');
        if (!bench.degOf(m)) return miss('只按**亮着的键**。', m);
        mine.push(m);
        if (mine.length < t.count) return tell(`${mine.length} / ${t.count}`);
        asked = false;
        const d = bench.degOf(m);
        ok(d === 1 ? '最后落在家上：一问一答，话说完了。' : t.land?.[d] || `你停在了第 ${d} 级上，像是还想接着说。想收住，就让最后一个音落在**家**（键 1）上。再点「听啾啾问」可以重答。`);
      };
      tell('先点「听啾啾问」。');
      return { solve: () => ok('最后落在家上：一问一答，话说完了。') };
    },

    // ── 第二期 · 旋律 ──

    /** 走一步 / 跳一下：从亮着的第 from 级出发，want = 'step'（到挨着的一级）或 'leap'（隔开至少一级） */
    walk(t, ok) {
      const from = bench.degMidi(t.from);
      bench.mark(from, 'ref');
      bench.autoTrail = false;
      bench.trailSet([from]);
      bench.onKey = (m) => {
        const r = bench.rungOf(m);
        bench.trailSet([from, m]);
        if (r === null) return miss('这个不在梯子上。只在**亮着的键**里挑。', m);
        const n = Math.abs(r - bench.rungOf(from));
        if (!n) return miss('这是起点。往旁边去。', m);
        if (t.want === 'step') return n === 1 ? ok() : miss(`中间隔开了 ${n - 1} 级：这是**跳**。走，是到**挨着**的那一级。`, m);
        return n >= 2 ? ok() : miss('这是挨着的那一级：算**走**。跳，要中间至少隔开一级。', m);
      };
      return { solve: () => ok() };
    },
    /**
     * 画一条线，变成旋律：在格子里按住拖过去，每一拍落一个音。cols 拍（一拍占 unit 格），行是梯子的第 lo 级到第 hi 级。
     * rule：不写 = 随便画，画完数一数走了几步、跳了几下；'steps' = 全是走；'leapback' = 至少跳一下，而且跳完往回走一步
     */
    draw(t, ok) {
      const unit = t.unit || 2;
      const cols = t.cols || 8;
      const steps = cols * unit;
      bench.set({ top: 'roll' });
      bench.rollShow({ steps, mel: [] }, { rows: bench.ladderRows(bench.degMidi(t.lo ?? 0), bench.degMidi(t.hi ?? 9)), mode: 'draw', unit, snap: unit });
      const play = () => locked(() => bench.playScore({ steps, mel: bench.roll.mel, bpm: 96 }, { parts: ['mel'] }));
      const check = async () => {
        const mel = bench.roll.mel;
        if (mel.length < cols) return miss(`还有 ${cols - mel.length} 拍空着。按住，从左到右**画满**。`);
        const r = mel.map((n) => bench.rungOf(n.m));
        const d = r.slice(1).map((x, k) => x - r[k]);
        const walks = d.filter((x) => Math.abs(x) === 1).length;
        const leaps = d.filter((x) => Math.abs(x) >= 2).length;
        if (t.rule === 'steps') {
          const k = d.findIndex((x) => Math.abs(x) >= 2);
          if (k >= 0) return miss(`第 ${k + 1} 个音到第 ${k + 2} 个音，中间隔开了 ${Math.abs(d[k]) - 1} 级：这是跳。这回要**全是走**，把它们挪近。`);
        }
        if (t.rule === 'leapback') {
          if (!leaps) return miss('这条线里还没有跳。让它在某一处**跳一下**：中间至少隔开一级。');
          const k = d.findIndex((x, j) => Math.abs(x) >= 2 && !(j + 1 < d.length && Math.sign(d[j + 1]) === -Math.sign(x) && Math.abs(d[j + 1]) === 1));
          if (k >= 0) return miss(`第 ${k + 2} 个音是跳${d[k] > 0 ? '上' : '下'}去的。${k + 1 >= d.length ? '它是最后一个音了：跳要放在前面，后面留一个音' : '它后面那个音要'}**往回走一步**（往${d[k] > 0 ? '下' : '上'}，到挨着的那一级）。`);
        }
        await play();
        ok(t.rule ? undefined : `你这条线：走了 **${walks}** 步，跳了 **${leaps}** 下${d.length - walks - leaps ? `，原地踏了 ${d.length - walks - leaps} 步` : ''}。${leaps === 0 ? '全是走：很顺，像说话。' : walks === 0 ? '全是跳：很抓耳，也有点慌。' : '有走有跳：这就对了。'}`);
      };
      ctl.append(btn('▶ 听我画的', play), btn('擦掉', () => bench.roll.set({ mel: [] })), btn('画好了', check, 'primary'));
      tell('在上面的格子里**按住，拖过去**：经过的每一拍落一个音。线往上，音就往高走。');
      return {
        solve() {
          bench.roll.set({ mel: (t.demo || [1, 2, 3, 5, 4, 3, 2, 1]).map((dg, k) => ({ s: k * unit, l: unit, m: bench.degMidi(dg) })) });
          ok();
        },
      };
    },
    /** 再说一遍：照着啾啾的小点子（motif，上面那条虚线）一个音一个音弹出来 */
    repeat(t, ok) {
      const want = t.motif.map((d) => bench.degMidi(d));
      const mine = [];
      bench.ghostSet(want);
      bench.autoTrail = false;
      ctl.append(listenBtn('▶ 听小点子', () => locked(async () => {
        await bench.playLine(want, { gap: t.gap || 0.34, trail: false });
        bench.trailSet(mine);
      })));
      bench.onKey = async (m) => {
        const k = mine.length;
        if (k >= want.length) return;
        if (m !== want[k]) return miss(`第 ${k + 1} 个音不一样：${bench.rungOf(m) === null ? '这个不在梯子上。' : m > want[k] ? '你的**高**了。' : '你的**低**了。'}照着上面那条虚线：它在第 ${bench.degOf(want[k])} 级。`, m);
        mine.push(m);
        bench.trailSet(mine);
        if (mine.length < want.length) return tell(`${mine.length} / ${want.length}`);
        await locked(() => bench.playLine([...want, ...want], { gap: 0.3 }));
        ok();
      };
      tell('上面那条虚线是啾啾的小点子。照着它，一个音一个音弹出来。');
      return { solve: () => ok() };
    },
    /** 再说一遍，改个尾巴：前 keep 个音和小点子一样，后面的要改，最后落在 end 里的级上（默认是家） */
    vary(t, ok) {
      const want = t.motif.map((d) => bench.degMidi(d));
      const keep = t.keep ?? 2;
      const end = t.end || [1];
      let mine = [];
      bench.ghostSet(want);
      bench.autoTrail = false;
      const back = (n) => {
        mine = mine.slice(0, n);
        bench.trailSet(mine);
      };
      ctl.append(listenBtn('▶ 听小点子', () => locked(async () => {
        await bench.playLine(want, { gap: t.gap || 0.34, trail: false });
        bench.trailSet(mine);
      })), btn('↺ 重来', () => {
        back(0);
        tell('从头来。前面几个音照着虚线弹。');
      }));
      bench.onKey = async (m) => {
        const k = mine.length;
        if (k >= want.length) return;
        if (bench.rungOf(m) === null) return miss('只按**亮着的键**。', m);
        if (k < keep && m !== want[k]) return miss(`开头 ${keep} 个音要和小点子**一样**，耳朵才认得出是同一个点子。第 ${k + 1} 个音${m > want[k] ? '高了' : '低了'}。`, m);
        mine.push(m);
        bench.trailSet(mine);
        if (mine.length < want.length) return tell(mine.length < keep ? `${mine.length} / ${want.length}` : `${mine.length} / ${want.length}：从这儿起，可以不照着虚线走了。`);
        if (mine.every((x, j) => x === want[j])) {
          back(keep);
          return miss('和小点子一模一样了。这回尾巴要**改**：后面几个音再弹一次，换掉一两个。');
        }
        if (!end.includes(bench.degOf(m))) {
          const d = bench.degOf(m);
          back(keep);
          return miss(`尾巴改了，可停在了第 ${d} 级上，还悬着。后面几个音再弹一次：最后落在**家**上。`);
        }
        await locked(() => bench.playLine([...want, null, ...mine], { gap: 0.3 }));
        ok();
      };
      tell(`开头 ${keep} 个音照着虚线弹，后面的你来改，最后落在家上。`);
      return { solve: () => ok() };
    },
    /**
     * 改长短：格子里的音高已经摆好了，把其中几个音拉长 / 缩短。want：{ 第几个音（0 起）: 要几格 }。
     * 拖音右边的小把手，或者点「长一格」「短一格」（改的是选中的那个音）
     */
    lengths(t, ok) {
      const sc = showScore(t.score, { mode: 'len', ...(t.roll || {}) });
      const want = t.want;
      const targets = Object.keys(want).map(Number);
      let finished = false;
      bench.roll.select(targets[0]);
      const good = () => targets.every((k) => bench.roll.mel[k]?.l === want[k]);
      const play = () => locked(() => bench.playScore({ ...sc, mel: bench.roll.mel }, { parts: t.parts }));
      bench.onRoll = async () => {
        if (finished) return;
        if (good()) {
          finished = true;
          await play();
          return ok();
        }
        const k = bench.roll.sel >= 0 ? bench.roll.sel : targets[0];
        const n = bench.roll.mel[k];
        if (want[k] === undefined) return tell(`第 ${k + 1} 个音不用动。要改的是第 **${targets.map((x) => x + 1).join('、')}** 个。`, 'bad');
        tell(n.l === want[k] ? `第 ${k + 1} 个音好了。还有别的要改。` : `第 ${k + 1} 个音：现在 **${n.l} 格**，要 **${want[k]} 格**。${n.l < want[k] ? '再拉长。' : '再缩短。'}`);
      };
      const nudge = (d) => {
        const k = bench.roll.sel;
        if (k < 0) return miss('先在格子里点一下要改的那个音。');
        const n = bench.roll.mel[k];
        if (d > 0 && n.l >= bench.roll.maxLen(k)) return miss('右边顶到下一个音了，拉不动。');
        if (d < 0 && n.l <= 1) return miss('一格是最短的了。');
        bench.roll.setLen(k, n.l + d);
      };
      ctl.append(btn('▶ 听', play), btn('− 短一格', () => nudge(-1)), btn('＋ 长一格', () => nudge(1)));
      tell('点一个音选中它（描黑边的那个）。**拖它右边的小把手**，或者点「长一格」「短一格」。');
      return {
        solve() {
          targets.forEach((k) => (bench.roll.mel[k].l = want[k]));
          bench.roll.set({});
          finished = true;
          ok();
        },
      };
    },

    /** 练手：在格子里点一下放一个音，再把它拉到 long 格长（小作品开写之前） */
    sketch(t, ok) {
      let finished = false;
      bench.set({ top: 'roll' });
      bench.rollShow({ steps: t.steps || 16, mel: [] }, { rows: bench.ladderRows(bench.degMidi(t.lo ?? 1), bench.degMidi(t.hi ?? 8)), mode: 'place', unit: 2, snap: 2 });
      bench.onRoll = (mel) => {
        if (finished) return;
        if (!mel.length) return tell('格子空了。点一下，放一个音。');
        if (mel.some((n) => n.l >= t.long)) {
          finished = true;
          return ok();
        }
        const k = bench.roll.sel >= 0 ? bench.roll.sel : 0;
        tell(`放了 ${mel.length} 个音。选中的那个现在 **${mel[k].l} 格**：拖它右边的小把手，拉到 ${t.long} 格。`);
      };
      ctl.append(btn('＋ 长一格', () => {
        const k = bench.roll.sel;
        if (k < 0) return miss('先在格子里点一下，放一个音。');
        if (bench.roll.mel[k].l >= bench.roll.maxLen(k)) return miss('右边顶到头了，拉不动。');
        bench.roll.setLen(k, bench.roll.mel[k].l + 1);
      }), btn('擦掉', () => bench.roll.set({ mel: [] })));
      tell('在上面的格子里点一下：点在哪一行，就是哪个音。');
      return {
        solve() {
          bench.roll.set({ mel: [{ s: 0, l: t.long, m: bench.degMidi(1) }] });
          finished = true;
          ok();
        },
      };
    },

    // ── 第二期 · 和声 ──

    /** 在地基上叠一个：地基是第 base 级，点另一个亮着的键，两个一起响。gap = 要的距离（在梯子上隔几级：1 挨着、2 隔一个、4 隔三个） */
    pair(t, ok) {
      const base = bench.degMidi(t.base || 1);
      bench.silent = true;
      bench.autoTrail = false;
      bench.chord([base]);
      bench.onKey = (m) => {
        const r = bench.rungOf(m);
        if (m === base || r === null || r < bench.rungOf(base)) {
          bench.tone(m);
          return miss(m === base ? '这是地基自己。在它**右边**再叠一个。' : r === null ? '这个不在梯子上。在**亮着的键**里挑。' : '往地基的**右边**叠。', m === base ? undefined : m);
        }
        const gap = r - bench.rungOf(base);
        bench.playChord([base, m]);
        if (t.gap.includes(gap)) return ok();
        miss(t.why?.[gap] || t.hint || '不是这个味道。换一个再听。');
      };
      return { solve: () => ok() };
    },
    /** 叠和弦：地基是第 root 级（已经叠好 have 层），再往上隔一个拿一个，叠满 size 层 */
    stack(t, ok) {
      const size = t.size || 3;
      const want = bench.chordOf(t.root, size);
      const have = want.slice(0, t.have || 1);
      bench.silent = true;
      bench.autoTrail = false;
      bench.chord(have);
      bench.onKey = (m) => {
        if (have.length >= size) return;
        if (m === want[have.length]) {
          have.push(m);
          bench.playChord(have);
          if (have.length === size) return ok();
          return tell(`第 ${have.length} 层到手。再往上，**隔一个**拿一个。`);
        }
        bench.tone(m);
        const r = bench.rungOf(m);
        if (r === null) return miss('这个不在梯子上。在**亮着的键**里挑。', m);
        const gap = r - bench.rungOf(have[have.length - 1]);
        miss(gap <= 0 ? '往上叠：在最上面那层的**右边**找。' : gap === 1 ? '这是**挨着**的那个：叠上去会挤。要**隔一个**。' : `隔得太远了：中间跳过了 ${gap - 1} 个。只隔**一个**。`, m);
      };
      return {
        solve() {
          bench.chord(want);
          ok();
        },
      };
    },
    /** 亮暗地图：梯子的每一级都当一次地基（点键盘上亮着的键，或者按机器的键），叠出来的和弦响一下，机器的键上挂上牌子。7 个都试过就过 */
    chordmap(t, ok) {
      const got = new Set();
      bench.silent = true;
      bench.autoTrail = false;
      bench.moods([]);
      const hit = (d) => {
        const notes = bench.chordOf(d);
        bench.playChord(notes);
        got.add(d);
        bench.moods([...got]);
        if (got.size === 7) return ok();
        tell(`${got.size} / 7。从第 ${d} 级叠起来：**${MOOD_SAY[bench.moodOf(notes)]}**。`);
      };
      bench.onKey = (m, from, d) => {
        if (from === 'synth') return hit(d);
        const r = bench.rungOf(m);
        if (r === null) return miss('点**亮着的键**当地基，或者按下面机器的键。', m);
        hit((((r % 7) + 7) % 7) + 1);
      };
      tell('0 / 7。每试一级，下面机器的键上就挂一块牌子。');
      return {
        solve() {
          bench.moods(true);
          ok();
        },
      };
    },
    /** 给和弦配贝斯：格子里摆着几个和弦（score），一格一格点出贝斯该站的那个键（地基）。点错了说它在哪一层 */
    bassline(t, ok) {
      const sc = bench.score(t.score);
      const chords = sc.chords;
      curScore = sc;
      if (bench.state.top === 'trail') bench.set({ top: 'roll' });
      bench.rollShow(sc, { ...(t.roll || {}), fit: chords.map((c) => c.notes[0] - 12) }); // 给贝斯留好最底下那几行
      const bass = [];
      let k = 0;
      bench.silent = true;
      bench.autoTrail = false;
      const focus = () => {
        bench.chord(chords[k].notes);
        bench.roll.head(chords[k].s);
        tell(`第 ${k + 1} / ${chords.length} 格：这一格的和弦是 **${names(chords[k].notes)}**。贝斯站哪个？`);
      };
      bench.onKey = async (m) => {
        if (k >= chords.length) return;
        const c = chords[k];
        const layer = c.notes.findIndex((x) => (x - m) % 12 === 0);
        if (layer === 0) {
          bass.push({ s: c.s, l: c.l, m: c.notes[0] - 12 });
          bench.roll.set({ bass: [...bass] });
          bench.playChord(c.notes, { bass: true, len: 0.7 });
          k++;
          if (k < chords.length) return focus();
          await locked(async () => {
            await wait(750);
            await bench.playScore({ ...sc, bass });
          });
          return ok();
        }
        bench.playChord(c.notes, { show: false, len: 0.7, vel: 0.45 });
        bench.tone(m - 12, { voice: 'bass', len: 0.7 });
        miss(layer > 0 ? `**${nameOf(m)}** 在这一摞的${layer === 1 ? '中间' : '上面'}那层。贝斯要站在最底下：写着“基”的那个键。` : `**${nameOf(m)}** 不在这一格的和弦里。这一格是 ${names(c.notes)}：贝斯站在写着“基”的那个键上。`, m);
      };
      focus();
      return {
        solve() {
          bench.roll.set({ bass: chords.map((c) => ({ s: c.s, l: c.l, m: c.notes[0] - 12 })) });
          ok();
        },
      };
    },
    /**
     * 三盏灯：score 是三盏都亮的那一版（最后停在家的和弦、贝斯在地基、旋律在家）。一开始三样都“没到位”（off：和弦换成第几级、旋律换成第几级；
     * 贝斯没到位 = 站在中间那层），点按钮一样一样换，每换一样听一遍。三盏都亮就过
     */
    lamps(t, ok) {
      const on = { chord: false, bass: false, mel: false };
      const off = { chord: 6, mel: 3, ...(t.off || {}) };
      const WORD = { chord: [`和弦：拐去了第 ${off.chord} 级`, '和弦：回到家'], bass: ['贝斯：站在中间那层', '贝斯：站在地基上'], mel: [`旋律：停在第 ${off.mel} 级`, '旋律：落在家上'] };
      const btns = {};
      let sc = null;
      let finished = false;
      const build = () => {
        sc = bench.score(t.score);
        const c = sc.chords[sc.chords.length - 1];
        if (!on.chord) c.notes = bench.chordOf(off.chord);
        sc.bass[sc.bass.length - 1].m = (on.bass ? c.notes[0] : c.notes[1]) - 12;
        if (!on.mel) sc.mel[sc.mel.length - 1].m = bench.degMidi(off.mel);
        if (bench.state.top === 'trail') bench.set({ top: 'roll' });
        bench.rollShow(sc, t.roll || {});
        const lit = bench.lampsOf(sc);
        bench.lamps(lit);
        for (const k of Object.keys(on)) {
          btns[k].textContent = WORD[k][on[k] ? 1 : 0];
          btns[k].classList.toggle('primary', on[k]);
        }
        return lit;
      };
      const play = () => locked(() => bench.playScore(sc));
      const flip = async (k) => {
        if (finished || bench.locked) return;
        on[k] = !on[k];
        const lit = build();
        await play();
        if (lit.every(Boolean)) {
          finished = true;
          return ok();
        }
        const lack = ['和弦', '贝斯', '旋律'].filter((_, j) => !lit[j]);
        tell(`亮了 ${3 - lack.length} 盏。还差：**${lack.join('、')}**。${lack.length === 1 ? '就差这一样了：听得出它“还能接着说”吗？' : ''}`);
      };
      ctl.append(listenBtn('▶ 听', play));
      for (const k of Object.keys(on)) {
        btns[k] = btn('', () => flip(k), 'sm');
        ctl.append(btns[k]);
      }
      build();
      tell('三盏灯都灭着。点右边的按钮，一样一样换；每换一样，听一遍。');
      return {
        solve() {
          Object.keys(on).forEach((k) => (on[k] = true));
          build();
          finished = true;
          ok();
        },
      };
    },
    /**
     * 给一句话选最后一个和弦：score 是前面几格，slot = [第几格起, 占几格] 空着。在键盘上点一级，就在那一级上叠一摞放进去。
     * want = 'home'（句号：回到家）/ 'comma'（逗号：停在第 5 级）；accept 可以自己写；why：选了第几级时说什么
     */
    cadence(t, ok) {
      const base = bench.score(t.score);
      const [s0, l0] = t.slot;
      const accept = t.accept || (t.want === 'home' ? [1] : [5]);
      bench.silent = true;
      bench.autoTrail = false;
      const show = (d) => {
        const sc = { ...base, chords: [...base.chords], bass: [...base.bass] };
        if (d) {
          const notes = bench.chordOf(d);
          sc.chords.push({ s: s0, l: l0, notes, deg: d });
          sc.bass.push({ s: s0, l: l0, m: notes[0] - 12 });
        }
        if (bench.state.top === 'trail') bench.set({ top: 'roll' });
        bench.rollShow(sc, t.roll || {});
        if (t.want === 'home') bench.lamps(d ? bench.lampsOf(sc) : [false, false, false]);
        return sc;
      };
      let sc = show(0);
      ctl.append(listenBtn('▶ 听前面几格', () => locked(() => bench.playScore(sc))));
      bench.onKey = async (m) => {
        const d = bench.degOf(m);
        if (!d) return miss('点**亮着的键**：点哪一级，就在那一级上叠一摞。', m);
        sc = show(d);
        await locked(() => bench.playScore(sc));
        if (accept.includes(d)) return ok(t.says?.[d]);
        miss(t.why?.[d] || (t.miss ? t.miss.replace('{d}', d) : t.want === 'home' ? `停在第 ${d} 级的和弦上：没回家，话还悬着。句号要落在**家**上。` : `第 ${d} 级也悬着。可最像逗号的是**第 5 级**：它最想回家。`));
      };
      tell('最后一格空着。在键盘上点一级，就在那一级上叠一摞，放进最后一格。');
      return {
        solve() {
          show(accept[0]);
          ok();
        },
      };
    },
    /**
     * 找邻居：和第 from 级的和弦共用两个音的和弦。在键盘上点一个地基，两摞先后响，共用的键描绿边。
     * 写了 prog + slot 就是“换一格”：把这一套里的第 slot 格（0 起）换成它的邻居
     */
    shared(t, ok) {
      const prog = t.prog ? [...t.prog] : null;
      const from = prog ? prog[t.slot] : t.from;
      const a = bench.chordOf(from);
      bench.silent = true;
      bench.autoTrail = false;
      bench.chord(a);
      const slots = prog ? progSlots(bench, prog) : null;
      const playProg = (p) => locked(() => bench.playChords(p.map((d) => bench.chordOf(d)), { gap: 0.85, bass: true, onStep: (k) => slots.playing(k) }).then(() => slots.playing(-1)));
      if (slots) {
        slots.now(t.slot);
        ctl.append(slots.el, btn('▶ 听这一套', () => playProg(prog)));
      }
      bench.onKey = async (m) => {
        const d = bench.degOf(m);
        if (!d) return miss('点**亮着的键**当地基。', m);
        const b = bench.chordOf(d);
        const common = b.filter((x) => a.some((y) => (x - y) % 12 === 0));
        bench.unmark('good');
        await locked(() => bench.playChords([a, b], { gap: 0.8, bass: true }));
        bench.mark(common, 'good');
        if (d === from) return miss('这就是它自己。换一个地基。');
        if (prog && (d === prog[t.slot - 1] || d === prog[t.slot + 1])) return miss('和隔壁那一格一样了：等于没换。再找一个。');
        if (common.length >= 2) {
          if (prog) {
            prog[t.slot] = d;
            slots.set(prog);
            await playProg(prog);
          }
          return ok(`第 ${d} 级（${names(b)}）和第 ${from} 级（${names(a)}）共用 **${names(common)}**：只换了一个音。`);
        }
        miss(`第 ${d} 级是 ${names(b)}：和 ${names(a)} ${common.length ? `只共用 ${names(common)} 一个音` : '一个音都不共用'}。找共用**两个**的：地基往上或往下**隔一个**。`);
      };
      tell(prog ? `圈着的那一格是第 ${from} 级。在键盘上点一个地基，把它换成共用两个音的邻居。` : `青色的是第 ${from} 级的和弦。在键盘上再点一个地基：找一摞和它共用**两个音**的。`);
      return { solve: () => ok() };
    },
    /** 回家圈：从第 from 站出发，顺着箭头一站一站点到家（点圈上的站，或者在键盘上点那一级） */
    ringwalk(t, ok) {
      const path = [t.from];
      const cur = () => path[path.length - 1];
      const nextOf = (d) => RING[(RING.indexOf(d) + 1) % 7];
      bench.set({ top: 'ring' });
      bench.silent = true;
      bench.autoTrail = false;
      const paint = () => {
        bench.ring.clear();
        path.forEach((d) => bench.ring.mark(d, 'on'));
        bench.ring.mark(cur(), 'now');
        bench.ring.path(path);
        bench.chord(bench.chordOf(cur()));
      };
      const go = (d) => {
        if (cur() === 1 && path.length > 1) return;
        const want = nextOf(cur());
        if (d !== want) {
          bench.playChord(bench.chordOf(d), { bass: true, show: false });
          return miss(d === cur() ? '你就在这一站。顺着箭头，去下一站。' : `顺着箭头走：第 ${cur()} 级的下一站是**第 ${want} 级**。`);
        }
        path.push(d);
        paint();
        bench.playChord(bench.chordOf(d), { bass: true });
        if (d === 1) return ok();
        tell(`到第 ${d} 站：地基又往下跳了一大步。接着走。`);
      };
      bench.onRing = go;
      bench.onKey = (m) => {
        const d = bench.degOf(m);
        if (d) go(d);
        else miss('点圈上的站，或者键盘上**亮着的键**。', m);
      };
      paint();
      tell(`你在第 ${t.from} 站（青色的）。顺着箭头，一站一站点到**家**。`);
      return {
        solve() {
          while (cur() !== 1) path.push(nextOf(cur()));
          paint();
          ok();
        },
      };
    },
    /**
     * 改格子里的一个音（第 idx 个，0 起）：在键盘上点一个键，它就挪过去，整句再放一遍。
     * rule = 'chord'（把踩空的音挪到这一格的和弦上）/ 'pass'（填一个路过的音：不在和弦里，夹在前后两个音中间）
     */
    note(t, ok) {
      const sc = showScore(t.score, { tone: true, ...(t.roll || {}) });
      const k = t.idx;
      const flag = (cls) => {
        bench.roll.mel[k].cls = cls;
        bench.roll.set({});
      };
      const idle = t.rule === 'pass' ? 'slot' : 'bad';
      flag(idle);
      const n0 = bench.roll.mel[k];
      const c = sc.chords.find((x) => x.s <= n0.s && n0.s < x.s + x.l);
      bench.chord(c.notes);
      bench.silent = true;
      bench.autoTrail = false;
      const play = () => locked(async () => {
        await bench.playScore({ ...sc, mel: bench.roll.mel });
        bench.chord(c.notes);
      });
      ctl.append(listenBtn('▶ 听这一句', play));
      bench.onKey = async (m) => {
        const r = bench.rungOf(m);
        if (r === null) {
          bench.tone(m);
          return miss('只用**亮着的键**。', m);
        }
        if (!bench.roll.move(k, m)) return miss('离得太远了。在它附近找。', m);
        const inC = c.notes.some((x) => (x - m) % 12 === 0);
        if (t.rule === 'pass') {
          const a = bench.rungOf(bench.roll.mel[k - 1].m);
          const b = bench.rungOf(bench.roll.mel[k + 1].m);
          if (!inC && r > Math.min(a, b) && r < Math.max(a, b)) {
            flag('good');
            await play();
            return ok();
          }
          flag(idle);
          bench.tone(m);
          return miss(inC ? `**${nameOf(m)}** 是和弦里的音：这是踩上去，不是路过。要一个**不在**色带上的。` : '路过，是从前一个音**走**到后一个音：它要夹在那两个音中间。', m);
        }
        if (inC) {
          flag('good');
          await play();
          return ok(`挪到了 **${nameOf(m)}**：踩在色带上，稳了。`);
        }
        flag(idle);
        bench.tone(m);
        miss(`**${nameOf(m)}** 也不在这一格的和弦里。这一格是 ${names(c.notes)}：键盘上青色的那几个。`, m);
      };
      tell(t.rule === 'pass' ? '虚线框是空着的那个音。在键盘上点一个键，把它填上。' : '红的那个音踩空了。在键盘上点一个键，把它挪过去。');
      return {
        solve() {
          flag('good');
          ok();
        },
      };
    },
  };

  function beatDo(b) {
    const make = TASKS[b.task.type];
    let finished = false;
    const ok = (extra) => {
      if (finished) return;
      finished = true;
      finishBeat(typeof extra === 'string' ? extra : b.ok);
    };
    const task = make(b.task, ok);
    return { auto: async () => task.solve(), destroy: () => task.destroy?.() };
  }

  const KINDS = { listen: beatListen, song: beatListen, compare: beatCompare, do: beatDo, pick: beatPick, name: beatName };

  function enter(k) {
    if (!alive) return;
    cur?.destroy();
    i = Math.max(0, Math.min(beats.length - 1, k));
    const b = beats[i];
    resetTo(i);
    // 这一步要放的是格子里的一段：先摆出来，别让台子空着
    const first = b.score || (b.kind === 'compare' && b.a.score);
    if (first) showScore(first, b.score ? b.roll : b.a.roll);
    chip.textContent = b.kind === 'song' ? `♪ ${b.song}` : KIND_WORD[b.kind] || '';
    chip.className = `tg-kind k-${b.kind}`;
    goal.innerHTML = rich(b.goal || '');
    ctl.replaceChildren();
    tell('');
    prev.style.visibility = i === 0 ? 'hidden' : '';
    next.textContent = i >= beats.length - 1 ? '学完了，去挑战 →' : '下一小步 →';
    next.classList.toggle('primary', done[i]);
    next.disabled = !done[i];
    paintDots();
    say(b.say, b.kind === 'name' ? 'happy' : 'talk');
    env.progress?.(i, beats.length, KIND_WORD[b.kind] || '');
    cur = KINDS[b.kind](b);
  }

  enter(0);
  return {
    el,
    bench,
    get index() {
      return i;
    },
    /** 开发用：直接跳到第 k 小步（走查脚本 dev/walk-theory.js） */
    go: (k) => enter(k),
    /** 开发用（走查脚本）：把每一小步都做掉，走到最后 */
    async auto() {
      for (let k = i; k < beats.length; k++) {
        if (k !== i) enter(k);
        await wait(60);
        await cur.auto();
        await wait(60);
      }
      return { beats: beats.length, done: done.filter(Boolean).length };
    },
    destroy() {
      alive = false;
      cur?.destroy();
      bench.destroy();
    },
  };
}
