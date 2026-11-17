// 啾啾带着走：乐理关的“学”这一步不再是“一个玩具 + 一段说明”，而是 5–8 个小步，每一步啾啾说一句、你做一件有目标的小事
// （用户 2026-11-17：“交互也简单了一些，要多一些指导教学的内容”；方案见 docs/training-plan.md “乐理线重做”）。
// 小步的种类（关里写在 guide.beats 里，一项一个小步）：
//   listen   听：放一段，键跟着亮、轨迹跟着画                { say, deg | line, gap?, slide?, after }
//   song     听一首歌里的一句（和 listen 一样，多一个歌名）    { song, … }
//   compare  比：A、B 两段来回听，只差一处                    { say, a: { label, deg | line, show? }, b: {…}, after }
//   do       做：一个有目标的小任务，自动判                    { say, goal, task: { type, … }, ok }
//   pick     选：听完选一个（少用，一关最多两个）              { say, goal, deg | line?, options: [{ label, right?, why }] }
//   name     点破：做出来了，才说它叫什么                      { say, term, means }
// 每个小步都可以带 show：这一步开始时乐理台摆成什么样（只写要改的；见 applyShow）。
// deg 是“梯子上的第几级”（8 = 高一层的家，数组 = 几个音一起，null = 空一拍），line 直接写键号（60 = 最左边的 C）。
// 任务（task.type）有哪几种见下面的 TASKS。
// createGuide(level, env) → { el, bench, auto(), destroy() }
//   env.say(text, mood)   啾啾在右边说这一句        env.progress(i, n)   现在是第几小步
//   env.done()            小步都做完了              env.next()           学生点了“去挑战”
import { h, rich } from './util.js';
import { audio } from './audio.js';
import { sfx } from './sfx.js';
import { pop } from './fx.js';
import { LoopPlayer } from './looper.js';
import { createTheoryBench, LADDERS, MAJOR, MINOR, nameOf, LO, HI } from './theory-bench.js';

const STEP_WORD = { 1: '一格', 2: '两格', 3: '三格' };
const KIND_WORD = { listen: '听', song: '听一首歌', compare: '比一比', do: '你来', pick: '选一个', name: '它叫什么' };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function createGuide(level, env) {
  const beats = level.guide.beats;
  const bench = createTheoryBench();
  let i = 0;
  let cur = null; // 现在这一小步：{ auto(), destroy() }
  let alive = true;
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

  /** 这一小步开始时把乐理台摆好：ladder（'major' / 'minor' / 'penta' / 一串格数 / null）、root、home、names、degrees、keys、trail、mark */
  function applyShow(show = {}) {
    const patch = {};
    const st = bench.state;
    if ('ladder' in show) {
      patch.ladder = show.ladder === null ? null : {
        root: show.root ?? st.ladder?.root ?? LO,
        offsets: typeof show.ladder === 'string' ? LADDERS[show.ladder] : show.ladder,
        degrees: show.degreeLabels || (show.ladder === 'penta' ? [1, 3, 4, 5, 7] : undefined),
      };
    } else if ('root' in show && st.ladder) patch.ladder = { ...st.ladder, root: show.root };
    for (const k of ['home', 'names', 'degrees', 'keys', 'trail', 'machine']) if (k in show) patch[k] = show[k];
    bench.set(patch);
  }
  /** 回到第 k 小步开始时的样子：从头把每一步的 show 摆一遍（这样往回翻也对） */
  function resetTo(k) {
    bench.stop();
    bench.set({ ladder: null, home: false, names: false, degrees: false, keys: false, trail: true, machine: null });
    applyShow(level.guide.start);
    for (let j = 0; j <= k; j++) applyShow(beats[j].show);
    bench.unmark();
    bench.trailClear();
    bench.ghostSet([]);
    bench.locked = false;
    bench.silent = false;
    bench.autoTrail = true;
    bench.onKey = null;
    if (beats[k].show?.mark) bench.mark(beats[k].show.mark, 'ref');
  }

  const lineOf = (spec) => (spec.line ? spec.line : (spec.deg || []).map((d) => (d === null ? null : Array.isArray(d) ? d.map((x) => bench.degMidi(x)) : bench.degMidi(d))));

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
  /** 放一句（放的时候按键没反应） */
  async function playSpec(spec, opts = {}) {
    bench.locked = true;
    if (spec.show) applyShow(spec.show);
    if (spec.slide !== undefined) await bench.slideTo(spec.slide);
    await bench.playLine(lineOf(spec), { gap: spec.gap || 0.36, ...opts });
    bench.locked = false;
  }

  // ───────────── 小步的几种 ─────────────

  function beatListen(b) {
    const btn = listenBtn(b.kind === 'song' ? '▶ 听这一句' : '▶ 听', async () => {
      await playSpec(b);
      if (alive && cur === me) finishBeat(b.after);
    });
    ctl.append(btn);
    const me = { auto: async () => finishBeat(b.after), destroy() {} };
    return me;
  }

  function beatCompare(b) {
    const heard = new Set();
    const make = (key) => {
      const side = b[key];
      const btn = h('button', { class: 'btn lg tg-ab', type: 'button', 'data-sfx': 'none' }, h('small', {}, key.toUpperCase()), side.label);
      btn.addEventListener('click', async () => {
        [...ctl.children].forEach((x) => x.classList.remove('on'));
        btn.classList.add('on');
        await playSpec(side);
        heard.add(key);
        btn.classList.add('heard');
        if (alive && cur === me && heard.size === 2) finishBeat(b.after);
      });
      return btn;
    };
    ctl.append(make('a'), make('b'));
    tell('两个都听一遍。可以来回听。');
    const me = { auto: async () => finishBeat(b.after), destroy() {} };
    return me;
  }

  function beatPick(b) {
    if (b.deg || b.line) ctl.append(listenBtn('▶ 听', () => playSpec(b)));
    const opts = h('div', { class: 'tg-opts' }, b.options.map((o) => {
      const btn = h('button', { class: 'btn lg tg-opt', type: 'button', 'data-sfx': 'none' }, o.label);
      btn.__right = !!o.right;
      btn.addEventListener('click', () => {
        if (o.right) {
          btn.classList.add('right');
          finishBeat(o.why);
        } else {
          btn.classList.add('wrong');
          miss(o.why || '不是这个，再想想。');
        }
      });
      return btn;
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
    /** 一句话差最后一个音：点一个键补上，整句连你补的那个再放一遍；补的是 accept 里的级（默认是家）就过 */
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
        const d = bench.degreeOf(m);
        if (!d) return miss('这个音不在梯子上。在**亮着的键**里挑。', m);
        bench.locked = true;
        await bench.playLine([...head(), m], { gap: t.gap || 0.34 });
        bench.locked = false;
        if (accept.includes(d)) {
          bench.trailMarkLast('good');
          return ok();
        }
        bench.trailMarkLast('bad');
        miss(t.why?.[d] || `停在第 ${d} 级上，还悬着。换一个试试。`);
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
      const btn = (label, dir) => h('button', { class: 'btn lg tg-keybtn', type: 'button', 'data-sfx': 'detent', onclick: () => move(dir) }, label);
      ctl.append(btn('KEY −', -1), read, btn('KEY +', 1));
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
    /** 接一句：啾啾问一句（ask），你答 count 个音；落在家上是一句完整的话，没落也算做完（话不一样） */
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
        if (!bench.degreeOf(m)) return miss('只按**亮着的键**。', m);
        mine.push(m);
        if (mine.length < t.count) return tell(`${mine.length} / ${t.count}`);
        asked = false;
        const home = bench.degreeOf(m) === 1;
        ok(home ? '最后落在家上：一问一答，话说完了。' : `你停在了第 ${bench.degreeOf(m)} 级上，像是还想接着说。想收住，就让最后一个音落在**家**（键 1）上。再点「听啾啾问」可以重答。`);
      };
      tell('先点「听啾啾问」。');
      return { solve: () => ok('最后落在家上：一问一答，话说完了。') };
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
