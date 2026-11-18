// 小课堂 · 节奏线“一心多用”第二批（2026-11-18，方案见 docs/training-plan.md 的“从两门课里借什么”和“节奏线第二批”）。
//   autopilot    R11 腾出一只手：一只手守着一条不变的循环，谱面慢慢淡掉；另一只手去拧屏幕上的旋钮、点方键、数灯。判的是守循环的那只手：漏没漏、晃了多少
//   readblocks   R3 的热身：点格子 → 把重复的小块圈出来 → 两下一组还是三下一组
//   swingthirds  R6 的热身：一拍两下 → 一拍切三份 → 把中间那下拿掉 → 滑条（第二下从正中间推到“三份的最后一份”）
//   layers       R8 的热身：三种律动，一层一层放出来认声部
// R10「不出声的那一拍」用的是音游引擎自己的两样新东西（灰音符、静的那一段：game.js / chart.js），玩具在 classroom-rhythm.js（rhythm、rhythmsteps）。
// 约定同 classroom-kit.js 开头；每个玩具带 __autoPlay()（把“玩一玩”的几小段做完）或 __auto()（把这一档答完），dev/walk-classroom2.js 会认。
// 类名一律带 rh- 前缀（app.css 里有一条不带前缀的 .say，别撞上）。样式在 public/css/rhythm.css。
import { h, rich, clamp, stddev } from './util.js';
import { audio } from './audio.js';
import { LoopPlayer } from './looper.js';
import { midi } from './midi.js';
import { store } from './store.js';
import { sfx } from './sfx.js';
import { confetti, pop } from './fx.js';
import { RhythmGame } from './game.js';
import { normalizeChart } from './chart.js';
import { byTier, playButton, keys16, pad16, shuffle } from './classroom-kit.js';
import { TOUCH, sleep, until, shotSeg, shotLater, onePad, steadyWord } from './classroom-rhythm2.js';

const btn = (text, fn, primary) => h('button', { class: ['btn', 'sm', primary && 'primary'], type: 'button', onclick: fn }, text);
const EIGHTS = 'x-x-x-x-x-x-x-x-';

// ───────────── R11 腾出一只手 ─────────────

// 守着的那条循环：铜每拍一下，银“咚 · 咚咚 · 咚 · 咚咚”，金三、三、二
const AUTO_LOOPS = ['x---x---x---x---', 'x---x-x-x---x-x-', 'x--x--x-x--x--x-'];
const AUTO_RULE = [{ speed: 0.85, assist: 'guide' }, { speed: 1, assist: 'guide' }, { speed: 1, assist: 'solo' }];
// fadeAt = 第几小节（从 0 数）开始淡，淡一小节；floor = 淡到多少（0 = 一点不剩）；tasks = 右手的活，从淡完的那个小节头开始，平均摊在剩下的小节里；
// need = 至少做成几件；miss = 守循环的那只手最多能漏几成
const AUTO_TIERS = [
  { loop: 0, bars: 8, fadeAt: 2, floor: 0.22, tasks: ['knob', 'knob', 'knob'], need: 2, miss: 0.25 },
  { loop: 1, bars: 8, fadeAt: 2, floor: 0, tasks: ['knob', 'key', 'knob', 'key'], need: 3, miss: 0.2 },
  { loop: 2, bars: 10, fadeAt: 2, floor: 0, tasks: ['knob', 'key', 'count', 'knob', 'key'], need: 4, miss: 0.15 },
];
const AUTO_PLAY = [
  { title: '先把循环打顺', how: '跟着落下来的音符打底鼓，每拍一下。一共 **4 小节**。', loop: 0, bars: 4, miss: 0.3, after: '就这一条。后面它不再变了。' },
  { title: '谱面淡掉', how: '还是这一条。打到第 3 小节，落下来的音符会**慢慢淡掉**。手别停，照刚才的样子接着打。', loop: 0, bars: 6, fadeAt: 2, floor: 0, miss: 0.3, after: '看不见谱面也没乱：这一条已经在你手上了。' },
  {
    title: '手别停，右手去拧', loop: 0, bars: 8, fadeAt: 2, floor: 0, tasks: ['knob', 'knob'], need: 1, miss: 0.3,
    how: '左手照旧。谱面淡掉以后，右边会亮出一个旋钮：**右手把它拧到亮着的那一段**。左手一下都别变。',
    oneHow: '手上照旧。谱面淡掉以后，右边的方键会**一个一个亮起来**：别停手，用眼睛记住亮过哪几个，打完再点出来。',
    after: '手上那条自己在走，另一只手才腾得出来。这一条就**在手上了**。',
  },
];
const ONE_HAND_GOLD = ' 这是只用一只手的版本：金这一档它最多拿银牌。想要金牌，换回“右手干活”。';

/** 右手的活 ①：把旋钮拧到亮着的那一段（按住上下拖；松手时在里面、或者在里面停一下，就算拧到了） */
function knobTask(onDone) {
  const TOL = 9;
  const c = 18 + Math.round(Math.random() * 64);
  let v = clamp(c > 50 ? c - 36 - Math.random() * 12 : c + 36 + Math.random() * 12, 0, 100);
  let done = false;
  let drag = null;
  let timer = 0;
  const knob = h('div', { class: 'rh-knob', role: 'slider', tabindex: '0', 'aria-label': '旋钮', 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('i'));
  const inside = () => Math.abs(v - c) <= TOL;
  const finish = () => {
    if (done) return;
    done = true;
    knob.classList.add('ok');
    onDone();
  };
  const paint = () => {
    knob.style.setProperty('--v', v.toFixed(1));
    knob.classList.toggle('in', inside());
    knob.setAttribute('aria-valuenow', String(Math.round(v)));
    clearTimeout(timer);
    if (!done && inside()) timer = setTimeout(finish, 260);
  };
  knob.style.setProperty('--t0', String(c - TOL));
  knob.style.setProperty('--t1', String(c + TOL));
  knob.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try {
      knob.setPointerCapture(e.pointerId);
    } catch { /* 合成的事件抓不住指针，不碍事 */ }
    drag = { x: e.clientX, y: e.clientY, v };
  });
  knob.addEventListener('pointermove', (e) => {
    if (!drag || done) return;
    v = clamp(drag.v + (drag.y - e.clientY + (e.clientX - drag.x)) * 0.5, 0, 100);
    paint();
  });
  const up = () => {
    if (!drag) return;
    drag = null;
    if (inside()) finish();
  };
  knob.addEventListener('pointerup', up);
  knob.addEventListener('pointercancel', up);
  knob.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (done) return;
    v = clamp(v - Math.sign(e.deltaY) * 4, 0, 100);
    paint();
  }, { passive: false });
  knob.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 4 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -4 : 0;
    if (!d || done) return;
    e.preventDefault();
    v = clamp(v + d, 0, 100);
    paint();
  });
  paint();
  return {
    kind: 'knob',
    el: h('div', { class: 'rh-task-one' }, knob, h('p', { html: rich('把旋钮**拧到亮着的那一段**：按住它上下拖。') })),
    get done() {
      return done;
    },
    solve() {
      v = c;
      paint();
      finish();
    },
    destroy: () => clearTimeout(timer),
  };
}

/** 右手的活 ②：点亮指定的那个方键（两排，每排 4 个） */
function keyTask(onDone) {
  const want = Math.floor(Math.random() * 8);
  let done = false;
  const press = (i, b) => {
    if (done) return;
    if (i === want) {
      done = true;
      b.classList.add('on');
      onDone();
    } else {
      b.classList.add('wrong');
      setTimeout(() => b.classList.remove('wrong'), 300);
    }
  };
  const keys = Array.from({ length: 8 }, (_, i) => {
    const b = h('button', { class: 'rh-tkey', type: 'button', 'data-sfx': 'none', 'aria-label': `第 ${i + 1} 个方键` }, h('span', {}, String(i + 1)));
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      press(i, b);
    });
    return b;
  });
  return {
    kind: 'key',
    el: h('div', { class: 'rh-task-one' }, h('div', { class: 'rh-tkeys' }, keys), h('p', { html: rich(`点亮**第 ${want + 1} 个**方键。`) })),
    get done() {
      return done;
    },
    solve: () => press(want, keys[want]),
    destroy() {},
  };
}

/** 右手的活 ③：数一数亮了几盏灯，点那个数 */
function countTask(onDone) {
  const n = 3 + Math.floor(Math.random() * 4);
  const lit = new Set(shuffle([0, 1, 2, 3, 4, 5, 6, 7]).slice(0, n));
  let done = false;
  const answers = shuffle([n - 1, n, n + 1]).map((k) => {
    const b = h('button', { class: 'rh-tans', type: 'button', 'data-sfx': 'none' }, String(k));
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (done) return;
      if (k === n) {
        done = true;
        b.classList.add('on');
        onDone();
      } else {
        b.classList.add('wrong');
        setTimeout(() => b.classList.remove('wrong'), 300);
      }
    });
    b.__right = k === n;
    return b;
  });
  return {
    kind: 'count',
    el: h('div', { class: 'rh-task-one' },
      h('div', { class: 'rh-tkeys lamps' }, Array.from({ length: 8 }, (_, i) => h('i', { class: ['rh-tlamp', lit.has(i) && 'on'] }))),
      h('p', { html: rich('**亮了几盏？**') }), h('div', { class: 'rh-tanswers' }, answers)),
    get done() {
      return done;
    },
    solve: () => answers.find((b) => b.__right).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })),
    destroy() {},
  };
}
const TASKS = { knob: knobTask, key: keyTask, count: countTask };

/** 只用一只手的版本：方键一个一个亮起来，用眼睛记；打完再点出亮过的那几个 */
function memoBoard(count) {
  const seq = shuffle([0, 1, 2, 3, 4, 5, 6, 7]).slice(0, count);
  const picked = new Set();
  let asking = false;
  let scored = false;
  const keys = Array.from({ length: 8 }, (_, i) => {
    const b = h('button', { class: 'rh-tkey', type: 'button', 'data-sfx': 'none', 'aria-label': `第 ${i + 1} 个方键` }, h('span', {}, String(i + 1)));
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (!asking || scored) return;
      if (picked.has(i)) picked.delete(i);
      else picked.add(i);
      b.classList.toggle('sel', picked.has(i));
    });
    return b;
  });
  const words = h('p', { html: rich('别停手。**记住亮过哪几个**，打完再点出来。') });
  const foot = h('div', { class: 'rh-tanswers' });
  return {
    el: h('div', { class: 'rh-task-one' }, h('div', { class: 'rh-tkeys' }, keys), words, foot),
    seq,
    /** 亮第 i 个（-1 = 都灭着） */
    show(i) {
      keys.forEach((b, k) => b.classList.toggle('flash', i >= 0 && k === seq[i]));
    },
    /** 打完了：点出亮过的那几个。onDone(记对了几个) */
    ask(onDone) {
      asking = true;
      this.show(-1);
      words.innerHTML = rich(`刚才亮过 **${count}** 个。点出来，再点「就这几个」。`);
      const go = h('button', { class: 'btn primary', type: 'button', onclick: () => {
        if (scored) return;
        scored = true;
        const right = seq.filter((i) => picked.has(i)).length;
        const extra = [...picked].filter((i) => !seq.includes(i)).length;
        keys.forEach((b, i) => {
          b.classList.remove('sel');
          b.classList.toggle('on', seq.includes(i) && picked.has(i));
          b.classList.toggle('missed', seq.includes(i) && !picked.has(i));
          b.classList.toggle('wrong', !seq.includes(i) && picked.has(i));
        });
        words.innerHTML = rich(`记对了 **${right}** 个${extra ? `，多点了 ${extra} 个` : ''}。`);
        foot.replaceChildren();
        onDone(Math.max(0, right - extra));
      } }, '就这几个');
      foot.replaceChildren(go);
      this.solve = () => {
        seq.forEach((i) => keys[i].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })));
        go.click();
      };
    },
    solve() {},
  };
}

/**
 * 一只手守着一条不变的循环（音游的舞台，一条轨道，电脑上是 F），谱面慢慢淡掉；右边的面板上是“右手的活”。
 * “玩一玩”分三小段带着做（打顺 → 谱面淡掉 → 加上右手的活）；挑战一局 8–10 小节，过不过看守循环的那只手漏了几成、右手做成几件，
 * 星星看谱面淡掉以后那只手前后晃多少。只用鼠标的人换成“一只手版”：右手的活换成用眼睛记（金那一档最多拿银牌）。
 */
function autopilot(spec, env) {
  const tier = env.tier || 0;
  const bpm = spec.bpm || 92;
  const rule = byTier(tier, AUTO_RULE);
  const segs = tier ? [{ ...byTier(tier, AUTO_TIERS) }] : AUTO_PLAY.map((s) => ({ ...s }));
  let one = onePad.get();
  let si = 0;
  let game = null;
  let poll = 0;
  let task = null;
  let taskIdx = -1;
  let made = 0; // 右手做成了几件
  let memo = null;
  let result = null;
  let touches = 0;
  const seg = () => segs[si];
  const taskCount = () => (seg().tasks || []).length;

  const head = h('div', { class: 'rh-move' });
  const host = h('div', { class: 'cl-rhythm-host' });
  const lamps = h('div', { class: 'cl-lamps', 'aria-label': '右手做成了几件' });
  const sideBody = h('div', { class: 'rh-task-body' });
  const side = h('aside', { class: 'rh-task' }, h('header', {}, h('b', {}, '右手的活'), lamps), sideBody);
  const say = h('div', { class: 'cl-note' });
  const el = h('div', { class: ['cl-toy', 'rh-auto', tier && 'challenge'] }, head, h('div', { class: 'rh-autobody' }, host, side), say);

  const paintLamps = () => lamps.replaceChildren(...Array.from({ length: taskCount() }, (_, i) => h('i', { class: i < made ? 'on' : '' })));
  const idle = (text) => sideBody.replaceChildren(h('p', { class: 'rh-task-idle', html: rich(text) }));
  function clearTask() {
    task?.destroy();
    task = null;
  }
  function paintHead() {
    const s = seg();
    if (tier) {
      head.replaceChildren(h('small', {}, ['铜', '银', '金'][tier - 1]), h('b', {}, ['每拍一下', '咚 · 咚咚', '三、三、二'][s.loop]),
        h('span', { html: rich(`${rule.assist === 'solo' ? '只剩节拍器。' : rule.speed < 1 ? '慢一点，有示范音。' : '原速，有示范音。'}第 ${s.fadeAt + 1} 小节起谱面${s.floor ? '淡成影子' : '淡到没有'}。${one ? `记住亮过的 ${taskCount()} 个方键，记对 ${s.need} 个` : `右手的活 ${taskCount()} 件，做成 ${s.need} 件`}才过。`) }));
    } else head.replaceChildren(h('small', {}, `第 ${si + 1} / ${segs.length} 步`), h('b', {}, s.title), h('span', { html: rich((one && s.oneHow) || s.how) }));
    side.firstChild.firstChild.textContent = one ? '用眼睛记' : '右手的活';
  }

  /** 只用一只手的小开关（和 R7、R9 的“一块垫子版”记在同一处：这台设备上只用鼠标） */
  function oneSwitch() {
    const b = h('button', { class: ['btn', 'sm', 'rh-onepad', one && 'on'], type: 'button', 'data-sfx': 'tick' }, one ? '一只手版 · 换回右手干活' : '只有一只手能用？换成用眼睛记');
    b.addEventListener('click', () => {
      one = !one;
      onePad.set(one);
      build();
    });
    return b;
  }

  function build() {
    game?.destroy();
    clearInterval(poll);
    clearTask();
    memo = null;
    result = null;
    made = 0;
    taskIdx = -1;
    const s = seg();
    const loop = AUTO_LOOPS[s.loop || 0];
    const def = { bpm, bars: s.bars, loops: 1, lanes: { KICK: loop.repeat(s.bars) }, ...(rule.assist === 'guide' ? { backing: { HAT1: EIGHTS.repeat(s.bars) } } : {}) };
    const chart = normalizeChart({ title: '腾出一只手', ...def, id: 'classroom-rh-auto' });
    chart.lanes[0].key = 'f'; // 守循环的是左手：右手留给右边那块面板
    const fadeFrom = s.fadeAt === undefined ? Infinity : s.fadeAt * 4;
    const g = new RhythmGame(chart, {
      assist: rule.assist, speed: rule.speed, metronome: true, inputOffsetMs: store.settings.inputOffsetMs, passAccuracy: 0, countInBeats: 4, showKeyHints: !midi.connected,
      fade: (t) => 1 - (1 - (s.floor || 0)) * clamp((t.beat - fadeFrom) / 4, 0, 1),
    });
    game = g;
    g.fadeFrom = fadeFrom;
    g.mount(host).attachKeyboard();
    if (midi.connected) g.attachMidi();
    g.elStage.classList.add('compact');
    paintHead();
    paintLamps();
    side.classList.toggle('off', !taskCount());
    idle(!taskCount() ? '这一步右手先歇着。' : one ? '等谱面淡掉，方键会一个一个亮。' : '等谱面淡掉，活就来了。');
    say.textContent = '';
    g.showCard(h('div', { class: 'game-card' },
      h('p', { html: rich(midi.connected ? '在 SEQTRAK 上打底鼓也行。' : TOUCH ? '音符落到线上的那一刻，左手点轨道底下的键帽。' : '音符落到线上的那一刻，左手按 〔F〕（或者点轨道底下的键帽）。') }),
      h('div', { class: 'game-actions' }, taskCount() && !midi.connected ? oneSwitch() : null, h('button', { class: 'btn primary lg', type: 'button', onclick: () => g.start() }, '开始'))));
    g.on('start', () => {
      clearTask();
      made = 0;
      taskIdx = -1;
      result = null;
      paintLamps();
      memo = one && taskCount() ? memoBoard(taskCount()) : null;
      if (memo) sideBody.replaceChildren(memo.el);
      else idle(!taskCount() ? '这一步右手先歇着。' : '等谱面淡掉，活就来了。');
      clearInterval(poll);
      poll = setInterval(tick, 50);
    });
    g.on('done', (r) => {
      clearInterval(poll);
      clearTask();
      if (memo) {
        // 一只手版：先把记住的点出来，再看结果
        g.showCard(h('div', { class: 'game-card' }, h('h3', { style: { marginTop: '0' } }, '打完了'), h('p', {}, '右边：刚才亮过哪几个方键？点出来。')));
        memo.ask((n) => {
          made = n;
          paintLamps();
          finish(r);
        });
      } else finish(r);
    });
    shotLater((words) => {
      if (words.includes('one') && !one) {
        one = true;
        return build();
      }
      if (words.includes('mid')) {
        g.preview('stage', (s.fadeAt ?? 1) * 4 + 9);
        made = 1;
        paintLamps();
        if (one) {
          memo = memoBoard(taskCount());
          sideBody.replaceChildren(memo.el);
          memo.show(1);
        } else {
          const kind = words.find((x) => TASKS[x]) || (s.tasks || ['knob'])[0];
          task = TASKS[kind](() => {});
          sideBody.replaceChildren(task.el);
        }
      }
      if (words.includes('result')) {
        g.preview('stage', s.bars * 4);
        made = Math.max(0, taskCount() - 1);
        paintLamps();
        finish({ total: g.targets.length, counts: { miss: 1 } });
      }
    });
  }

  /** 走到第几拍了：右手的活按时间表一件一件来（一只手版：方键按同一张时间表亮） */
  function tick() {
    if (!game?.clock || (game.state !== 'playing' && game.state !== 'countin')) return;
    const s = seg();
    const n = taskCount();
    if (!n) return;
    const b = game.clock.nowBeat();
    const from = (s.fadeAt + 1) * 4;
    const L = Math.max(4, Math.floor((s.bars * 4 - from) / n));
    const i = b < from ? -1 : Math.floor((b - from) / L);
    if (memo) return memo.show(i >= 0 && i < n && b - from - i * L < L * 0.6 ? i : -1);
    if (i === taskIdx) return;
    taskIdx = i;
    clearTask();
    if (i < 0 || i >= n) return idle(i < 0 ? '等谱面淡掉，活就来了。' : '右手的活完了。左手打到底。');
    task = TASKS[s.tasks[i]](() => {
      made++;
      paintLamps();
      pop(lamps.children[made - 1]);
    });
    sideBody.replaceChildren(task.el);
  }

  /** 一局打完：看守循环的那只手 */
  function finish(r) {
    const s = seg();
    const g = game;
    const total = r.total || 1;
    const miss = r.counts.miss;
    const missRate = miss / total;
    const deltas = (lo, hi) => g.targets.filter((t) => t.result && t.result.grade !== 'miss' && t.result.deltaMs !== undefined && t.beat >= lo && t.beat < hi).map((t) => t.result.deltaMs);
    const before = Math.round(stddev(deltas(0, g.fadeFrom)));
    const afterList = g.fadeFrom === Infinity ? [] : deltas(g.fadeFrom + 4, Infinity);
    const after = afterList.length >= 3 ? Math.round(stddev(afterList)) : null;
    const n = taskCount();
    const okMiss = missRate <= s.miss;
    const okTask = !n || made >= s.need;
    const spread = after ?? before;
    const stars = !okMiss || !okTask ? 0 : Math.min(spread <= 30 ? 3 : spread <= 50 ? 2 : 1, missRate > 0.08 ? 2 : 3);
    result = { stars, miss, total, before, after, made, need: s.need || 0 };
    const gap = after === null ? '' : after <= before + 10 ? '几乎没受影响：它真的自己在走' : after <= before + 25 ? '晃了一点' : '另一边一忙，这只手就飘了';
    const lines = [
      `${total} 下里漏了 **${miss}** 下。`,
      after === null ? `前后晃 **±${before} 毫秒**（${steadyWord(before)}）。` : `谱面在的时候前后晃 **±${before} 毫秒**，淡掉以后 **±${after} 毫秒**：${gap}。`,
      n ? (one ? `方键记对了 **${made}** / ${n} 个。` : `右手的活做成了 **${made}** / ${n} 件。`) : '',
    ];
    const why = okMiss ? (okTask ? '' : one ? `要记对 ${s.need} 个。手上稳住以后，眼睛再多留一点给右边。` : `右手要做成 ${s.need} 件。左手稳住以后，右手再快一点。`) : `漏得多了（最多能漏 ${Math.floor(total * s.miss)} 下）。${n ? '右边忙的时候手停了：先别管右边做得快不快，手不能停。' : '手别停，一拍一下。'}`;
    g.showCard(h('div', { class: ['game-card', 'rh-autocard', stars ? 'pass' : 'fail'] },
      h('h3', { style: { marginTop: '0' } }, stars ? '稳住了' : '还差一点'),
      ...lines.filter(Boolean).map((t) => h('p', { html: rich(t) })),
      why && h('p', { class: 'muted', html: rich(why) }),
      h('div', { class: 'game-actions' }, h('button', { class: ['btn', !stars && 'primary'], type: 'button', onclick: () => g.start() }, '再来一次'))));
    if (!stars) {
      sfx.play('nope');
      say.innerHTML = rich(`${lines[0]}${why}`);
      return;
    }
    if (tier) {
      sfx.play('star');
      confetti(host, 18);
      const capped = tier === 3 && one ? Math.min(stars, 1) : stars;
      say.innerHTML = rich(`✓ ${lines.filter(Boolean).join('')}${tier === 3 && one ? '一只手版在金这一档最多拿银牌。' : ''}`);
      if (tier === 3 && one) env.done(capped, ONE_HAND_GOLD);
      else env.done(capped);
      return;
    }
    // 玩一玩：这一小段做到了
    const lastOne = si >= segs.length - 1;
    sfx.play(lastOne ? 'star' : 'ok');
    if (!s.done) {
      s.done = true;
      do {
        touches++;
        env.touched();
      } while (lastOne && touches < 3);
    }
    say.innerHTML = rich(`✓ ${s.after}`);
    if (lastOne) {
      confetti(host, 18);
      say.append(' ', btn('从头再来一遍', () => enter(0)));
      return;
    }
    const go = btn(`下一步：${segs[si + 1].title} →`, () => enter(si + 1), true);
    say.append(' ', go);
    pop(go);
  }

  function enter(i) {
    si = i;
    build();
  }
  enter(tier ? 0 : Math.max(0, Math.min(segs.length - 1, shotSeg(shotWords()))));

  /** 开发用：把现在这一局打掉（循环按音频时钟去打，右手的活出来一件做一件） */
  async function autoRun() {
    const g = game;
    [...el.querySelectorAll('.game-card .btn.primary')].find((b) => /开始|再来/.test(b.textContent))?.click();
    await until(() => g.clock && g.state !== 'idle', 3000);
    for (const t of g.targets) setTimeout(() => g.hit(t.lane, performance.now(), 'keyboard'), Math.max(0, audio.ctxToPerf(g.clock.ctxAtBeat(t.beat)) - performance.now()));
    const iv = setInterval(() => task && !task.done && task.solve(), 450);
    await until(() => g.state === 'done', 90000, 150);
    clearInterval(iv);
    await sleep(200);
    memo?.solve();
    await until(() => result, 3000);
    return { ...result };
  }
  return {
    el,
    get game() {
      return game;
    },
    __auto: autoRun,
    async __autoPlay() {
      const out = [];
      for (let i = si; i < segs.length; i++) {
        out.push(await autoRun());
        const go = say.querySelector('.btn.primary');
        if (!go) break;
        go.click();
        await sleep(200);
      }
      return out;
    },
    destroy() {
      clearInterval(poll);
      clearTask();
      game?.destroy();
    },
  };
}
const shotWords = () => (typeof location !== 'undefined' ? (new URLSearchParams(location.search).get('rhshot') || '').split('-').filter(Boolean) : []);

// ───────────── R3 的热身：点格子 → 圈出重复的小块 → 两下一组还是三下一组 ─────────────

// 一小节四拍，每拍一个小块（4 格）。每条里都有几拍长得一模一样
const BLOCK_BARS = [
  ['x--x', 'x--x', 'x-x-', 'x--x'],
  ['x-x-', 'x---', 'x-x-', 'x-xx'],
  ['x---', 'x---', 'x---', 'x-x-'],
  ['xx--', 'x---', 'xx--', 'xx--'],
];
// 一串 8 下镲（一格半拍）：重的那一下隔两下来一次，还是隔三下来一次（8 格里放不满三个三下，最后剩两下：三、三、二）
const GROUPS = { 2: { acc: [0, 2, 4, 6], name: '两下一组', cuts: [2, 2, 2, 2] }, 3: { acc: [0, 3, 6], name: '三下一组', cuts: [3, 3, 2] } };

function readblocks(spec, env) {
  const bpm = spec.bpm || 104;
  const segs = [
    { title: '点格子', how: '点「播放」，再点格子：点亮一格，那里就多一下底鼓。这两排 16 个格子，和机器上那两排方键一模一样。', after: '亮的格子有声音。上排是前两拍，下排是后两拍。' },
    { title: '圈出重复的小块', how: '一小节四拍，每拍是一个 4 格的小块。第 1 拍已经圈好了：把和它**长得一模一样**的拍都圈出来。' },
    { title: '几下一组', how: '点「听」：一串镲，有的重、有的轻。重的那一下是**隔两下**来一次，还是**隔三下**来一次？' },
  ];
  let si = 0;
  let touches = 0;
  let edits = 0;
  let stop = () => {};
  const timers = new Set();
  const later = (fn, n) => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, n);
    timers.add(id);
  };
  const seg = () => segs[si];
  const player = new LoopPlayer({ bpm });
  const head = h('div', { class: 'rh-move' });
  const body = h('div', { class: 'rh-rbody' });
  const say = h('div', { class: 'cl-note' });
  const el = h('div', { class: 'cl-toy rh-read3' }, head, body, say);

  function pass(text) {
    const s = seg();
    if (s.done) return;
    s.done = true;
    const lastOne = si >= segs.length - 1;
    sfx.play(lastOne ? 'star' : 'ok');
    do {
      touches++;
      env.touched();
    } while (lastOne && touches < 3);
    say.innerHTML = rich(`✓ ${text}`);
    if (lastOne) {
      confetti(body, 16);
      return say.append(' ', btn('从头再来一遍', () => enter(0)));
    }
    const go = btn(`下一步：${segs[si + 1].title} →`, () => enter(si + 1), true);
    say.append(' ', go);
    pop(go);
  }

  // ① 点格子
  function showGrid() {
    const grid = keys16({ pattern: spec.pattern || 'x---x---x-x-----', editable: true, onChange: (p) => {
      player.set({ KICK: p, HAT1: '--x---x---x---x-' });
      if (++edits >= 2) pass(seg().after);
    } });
    player.set({ KICK: grid.get(), HAT1: '--x---x---x---x-' });
    player.onStep((s) => grid.setHead(s));
    const playBtn = playButton(player);
    body.replaceChildren(h('div', { class: 'cl-row' }, playBtn, h('button', { class: 'btn ghost', type: 'button', onclick: () => {
      grid.set('');
      player.set({ KICK: grid.get(), HAT1: '--x---x---x---x-' });
    } }, '清空'), h('span', { class: 'cl-cap' }, '底鼓 · 上排 1–8，下排 9–16')), grid.el);
    say.textContent = '点两格试试。';
    seg().auto = async () => {
      playBtn.click();
      for (const i of [2, 6]) {
        grid.cells[i].click();
        await sleep(150);
      }
    };
  }

  // ② 圈出重复的小块
  function showBlocks() {
    player.stop();
    const bar = BLOCK_BARS[Math.floor(Math.random() * BLOCK_BARS.length)];
    const same = bar.map((b) => b === bar[0]);
    const picked = new Set([0]);
    const blocks = bar.map((b, i) => {
      const node = h('button', { class: ['rh-blk', i === 0 && 'picked'], type: 'button', 'data-sfx': 'none', 'aria-label': `第 ${i + 1} 拍` },
        h('div', {}, [...b].map((c) => h('i', { class: c === 'x' ? 'on' : '' }))), h('span', {}, `第 ${i + 1} 拍`));
      node.addEventListener('click', () => {
        if (seg().done || picked.has(i)) return;
        if (!same[i]) {
          node.classList.add('wrong');
          later(() => node.classList.remove('wrong'), 420);
          sfx.play('nope');
          const more = [...b].filter((c) => c === 'x').length - [...bar[0]].filter((c) => c === 'x').length;
          say.textContent = `第 ${i + 1} 拍不一样：${more > 0 ? '它多了一下' : more < 0 ? '它少了一下' : '亮的格子换了地方'}。`;
          return;
        }
        picked.add(i);
        node.classList.add('picked');
        sfx.play('on');
        if (picked.size === same.filter(Boolean).length) {
          const n = picked.size;
          pass(`四拍里有 **${n}** 拍是同一个小块。不用记 16 格：记“一个小块，重复 ${n} 遍，${4 - n === 1 ? `第 ${same.indexOf(false) + 1} 拍变一下` : '另外两拍变一下'}”就行。`);
        }
      });
      return node;
    });
    player.set({ KICK: bar.join(''), HAT1: '--x---x---x---x-' });
    player.onStep((s) => blocks.forEach((b, i) => b.classList.toggle('now', s >= 0 && Math.floor(s / 4) === i)));
    body.replaceChildren(h('div', { class: 'cl-row' }, playButton(player), h('span', { class: 'cl-cap' }, '一小节 · 每 4 格一拍，一拍一个小块')), h('div', { class: 'rh-blks' }, blocks));
    say.textContent = '点一拍 = 把它圈上。';
    seg().auto = async () => {
      for (const [i, b] of blocks.entries()) {
        if (same[i] && i) b.click();
        await sleep(120);
      }
    };
  }

  // ③ 两下一组，还是三下一组
  function showGroups() {
    player.stop();
    const order = shuffle([2, 3]);
    let at = 0;
    let wrong = 0;
    const cells = Array.from({ length: 8 }, () => h('i', { class: 'rh-g' }, h('u')));
    const row = h('div', { class: 'rh-groups' }, cells);
    const listen = h('button', { class: 'btn primary lg', type: 'button' }, '▶ 听');
    const lampsEl = h('div', { class: 'cl-lamps' }, h('i'), h('i'));
    const opts = [2, 3].map((k) => {
      const b = h('button', { class: 'cl-opt', type: 'button' }, GROUPS[k].name);
      b.__k = k;
      b.addEventListener('click', () => choose(k, b));
      return b;
    });
    let locked = false;
    const cur = () => GROUPS[order[at]];
    const play = () => {
      stop();
      const acc = cur().acc;
      const p = new LoopPlayer({ bpm: 96 });
      p.onSchedule = (step, t) => {
        if (step % 4 === 0) audio.drum('KICK', t, 0.45);
        if (step % 2 === 0) audio.drum('HAT1', t, acc.includes(step / 2) ? 1.15 : 0.3);
      };
      p.onStep((s) => cells.forEach((c, i) => c.classList.toggle('now', s >= 0 && Math.floor(s / 2) === i)));
      p.start();
      const id = setTimeout(() => p.stop(), (60 / 96) * 8 * 1000 + 80);
      stop = () => {
        clearTimeout(id);
        p.stop();
      };
    };
    listen.addEventListener('click', play);
    function reveal(show) {
      const g = cur();
      let k = 0;
      cells.forEach((c) => {
        c.className = 'rh-g';
      });
      if (!show) return;
      g.cuts.forEach((len, gi) => {
        for (let j = 0; j < len; j++, k++) cells[k].className = ['rh-g', j === 0 ? 'loud' : 'soft', gi % 2 ? 'gb' : 'ga', j === 0 && 'gs', j === len - 1 && 'ge'].filter(Boolean).join(' ');
      });
    }
    function choose(k, b) {
      if (locked || seg().done) return;
      locked = true;
      const right = k === order[at];
      b.classList.add(right ? 'right' : 'wrong');
      reveal(true);
      if (right) {
        sfx.play('ok');
        lampsEl.children[at].classList.add('on');
        at++;
        if (at >= order.length) {
          at = order.length - 1;
          return pass(`数**重的那一下**隔几下来一次。三下一组在 8 格里放不满，最后剩两下：这就是“**三、三、二**”。${wrong ? '' : '两题都对。'}`);
        }
        say.innerHTML = rich(`✓ ${GROUPS[k].name}：${k === 2 ? '重、轻、重、轻……' : '重、轻、轻、重、轻、轻、重、轻。'}再来一条。`);
      } else {
        wrong++;
        sfx.play('nope');
        say.innerHTML = rich(`这条是**${cur().name}**：看格子，高的是重的那一下。再听一遍，换一条试试。`);
        order.reverse(); // 没答对的这一种留到后面再来
      }
      if (shotWords().includes('mid')) return; // 开发用（截图）：答完的样子留着
      later(() => {
        locked = false;
        opts.forEach((o) => o.classList.remove('right', 'wrong'));
        reveal(false);
        if (seg().done) return;
        if (!right) say.textContent = '换了一条。再听一遍：重的那一下隔几下来一次？';
        play();
      }, right ? 1700 : 3200);
    }
    body.replaceChildren(h('div', { class: 'cl-row' }, listen, h('span', { class: 'cl-cap' }, '8 下镲 · 答完才给看哪几下是重的'), h('span', { class: 'spacer' }), lampsEl), row, h('div', { class: 'cl-opts' }, opts));
    say.textContent = '先点「听」。可以反复听。';
    seg().auto = async () => {
      for (let n = 0; n < 4 && !seg().done; n++) {
        await until(() => !locked, 4000);
        opts.find((o) => o.__k === order[at]).click();
        await sleep(300);
      }
    };
  }

  function enter(i) {
    si = i;
    stop();
    player.stop();
    seg().done = false;
    edits = 0;
    head.replaceChildren(h('small', {}, `第 ${si + 1} / ${segs.length} 步`), h('b', {}, seg().title), h('span', { html: rich(seg().how) }));
    [showGrid, showBlocks, showGroups][si]();
  }
  enter(Math.max(0, Math.min(segs.length - 1, shotSeg(shotWords()))));
  shotLater((words) => {
    if (!words.includes('mid')) return;
    if (si === 1) body.querySelectorAll('.rh-blk')[1]?.click();
    if (si === 2) body.querySelector('.cl-opt')?.click();
  });
  return {
    el,
    async __autoPlay() {
      const out = [];
      for (let i = si; i < segs.length; i++) {
        await seg().auto();
        const ok = await until(() => seg().done, 6000, 60);
        out.push({ seg: i, done: !!ok });
        const go = say.querySelector('.btn.primary');
        if (!ok || !go) break;
        go.click();
        await sleep(150);
      }
      return out;
    },
    destroy() {
      stop();
      player.stop();
      timers.forEach(clearTimeout);
    },
  };
}

// ───────────── R6 的热身：一拍切三份，摇摆就是把第二下往三份的最后一份推 ─────────────

const THIRD = 200 / 3; // 第二下落在一拍的百分之几：正中间 50，三份的最后一份 66.7
const SWING_AT_THIRD = 40; // 摇摆的量到 40，第二下正好落在三份的最后一份上（一步 120 个刻度：(120 + 40) / 240 = 2 / 3）

function swingthirds(spec, env) {
  const bpm = spec.bpm || 92;
  const beat = 60 / bpm;
  const segs = [
    { mode: 'straight', title: '直的', how: '点「播放」。一拍两下，第二下落在**正中间**：嗒-嗒、嗒-嗒。', after: '两下一样匀：笔直，像机器。' },
    { mode: 'triplet', title: '一拍切三份', how: '现在把一拍切成**三份**，每份一下：嗒-嗒-嗒、嗒-嗒-嗒。', after: '一拍三下，叫**三连音**。' },
    { mode: 'triplet', title: '拿掉中间那下', how: '点一下**中间那个点**，把它拿掉。只剩第一下和第三下。', after: '嗒——嗒、嗒——嗒：一长一短。这就是**晃**。' },
    { mode: 'swing', title: '从直到晃', how: '拖滑条：第二下从正中间往后躲。把它推到**三份的最后一份**那条线上，停一下。', after: '摇摆，就是把每一对里的第二下，从正中间往“三份的最后一份”推。推不到那么远是“松一点”，推过头就更晃。' },
  ];
  let si = 0;
  let mode = 'straight';
  let laps = 0;
  let touches = 0;
  let holdTimer = 0;
  const timers = new Set();
  const later = (fn, n) => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, Math.max(0, n));
    timers.add(id);
  };
  const seg = () => segs[si];
  // 这里把“一步”当成半拍来用（速度减半）：摇摆就落在每拍的第二下上
  const player = new LoopPlayer({ bpm: bpm / 2, steps: 8 });
  const head = h('div', { class: 'rh-move' });
  const first = h('b', { class: 'rh-hit first', style: { left: '0%' } });
  const mid = h('button', { class: 'rh-hit mid', type: 'button', 'data-sfx': 'none', 'aria-label': '中间那一下', style: { left: `${100 / 3}%` } });
  const second = h('b', { class: 'rh-hit second' });
  const bar = h('div', { class: 'rh-pair' },
    h('i', { class: 'rh-tk', style: { left: '0%' } }), h('i', { class: 'rh-tk half', style: { left: '50%' } }), h('i', { class: 'rh-tk third', style: { left: `${100 / 3}%` } }), h('i', { class: 'rh-tk third goal', style: { left: `${THIRD}%` } }), h('i', { class: 'rh-tk', style: { left: '100%' } }),
    h('span', { style: { left: '0%' } }, '第一下'), h('span', { class: 'half', style: { left: '50%' } }, '正中间'), h('span', { class: 'third', style: { left: `${THIRD}%` } }, '三份的最后一份'), h('span', { style: { left: '100%' } }, '下一拍'),
    first, mid, second);
  const num = h('b', {}, '0');
  const big = h('div', { class: 'cl-big' }, num, h('small', {}, '摇摆'));
  const slider = h('input', { class: 'cl-range', type: 'range', min: 0, max: 58, step: 1, value: 0, 'aria-label': '摇摆的量' });
  slider.style.setProperty('--attr-min', '0');
  slider.style.setProperty('--attr-max', '58');
  const sliderRow = h('div', { class: 'cl-sliderow' }, h('span', {}, '笔直'), slider, h('span', {}, '摇晃'));
  const say = h('div', { class: 'cl-note' });
  const flash = (node, t) => later(() => {
    node.classList.add('on');
    later(() => node.classList.remove('on'), 110);
  }, audio.ctxToPerf(t) - performance.now());

  player.onSchedule = (step, t) => {
    if (step % 2 === 0) {
      if (step === 0) {
        laps++;
        const need = si === 2 ? (mode === 'holed' ? 2 : Infinity) : si === 3 ? Infinity : 3;
        if (laps >= need && !seg().done) later(() => pass(), audio.ctxToPerf(t) - performance.now());
      }
      audio.drum('KICK', t, 0.8);
      audio.drum('HAT1', t, 0.7);
      flash(first, t);
      if (mode === 'triplet') {
        audio.drum('HAT1', t + beat / 3, 0.5);
        flash(mid, t + beat / 3);
      }
      if (mode === 'triplet' || mode === 'holed') {
        audio.drum('HAT1', t + (beat * 2) / 3, 0.6);
        flash(second, t + (beat * 2) / 3);
      }
    } else if (mode === 'straight' || mode === 'swing') {
      audio.drum('HAT1', t, 0.6);
      flash(second, t);
    }
  };

  function setSwing(v) {
    slider.value = String(v);
    slider.style.setProperty('--control-value', String(v));
    slider.setAttribute('aria-valuetext', String(v));
    player.swing = v / 120; // 和 SEQTRAK 一样：一步 120 个刻度，摇摆最多 58
    num.textContent = String(v);
    second.style.left = `${((1 + v / 120) / 2) * 100}%`;
  }
  slider.addEventListener('input', () => {
    const v = Number(slider.value);
    setSwing(v);
    const near = Math.abs(v - SWING_AT_THIRD) <= 4;
    bar.classList.toggle('there', near);
    say.textContent = v === 0 ? '0：正中间，笔直。' : v < 20 ? '松了一点点，有人味了。' : v < 36 ? '在“晃”了。再往后一点。' : near ? '就是这儿：第二下落在三份的最后一份上。' : '推过头了：比三连音还晃。';
    clearTimeout(holdTimer);
    if (near && !seg().done) holdTimer = setTimeout(() => pass(), 700);
  });

  function paint() {
    const s = seg();
    head.replaceChildren(h('small', {}, `第 ${si + 1} / ${segs.length} 步`), h('b', {}, s.title), h('span', { html: rich(s.how) }));
    bar.dataset.mode = mode;
    bar.classList.toggle('thirds', si >= 1);
    bar.classList.toggle('pick', si === 2 && mode === 'triplet');
    sliderRow.hidden = si !== 3;
    big.hidden = si !== 3;
    if (mode !== 'swing') second.style.left = `${mode === 'straight' ? 50 : THIRD}%`;
  }
  function enter(i) {
    si = i;
    seg().done = false;
    mode = seg().mode;
    laps = 0;
    clearTimeout(holdTimer);
    bar.classList.remove('there');
    setSwing(0);
    paint();
    say.textContent = si === 2 ? '点中间那个点。' : si === 3 ? '拖滑条。' : player.playing ? '听两小节。' : '点「播放」。';
  }
  function pass() {
    const s = seg();
    if (s.done) return;
    s.done = true;
    const lastOne = si >= segs.length - 1;
    sfx.play(lastOne ? 'star' : 'ok');
    do {
      touches++;
      env.touched();
    } while (lastOne && touches < 3);
    say.innerHTML = rich(`✓ ${s.after}`);
    if (lastOne) {
      confetti(bar, 16);
      return say.append(' ', btn('从头再来一遍', () => enter(0)));
    }
    const go = btn(`下一步：${segs[si + 1].title} →`, () => enter(si + 1), true);
    say.append(' ', go);
    pop(go);
  }
  mid.addEventListener('click', () => {
    if (si !== 2 || mode !== 'triplet') return;
    mode = 'holed';
    laps = 0;
    sfx.play('off');
    paint();
    say.textContent = player.playing ? '听一小节。' : '拿掉了。点「播放」听一听。';
  });
  const playBtn = playButton(player, {
    onToggle(on) {
      laps = 0;
      if (on && !seg().done && si < 2) say.textContent = '听两小节。';
    },
  });
  const el = h('div', { class: 'cl-toy rh-swing3' },
    h('div', { class: 'cl-row' }, playBtn, h('span', { class: 'cl-cap' }, '这一条是一拍：从这一下“咚”到下一下“咚”'), h('span', { class: 'spacer' }), big),
    head, bar, sliderRow, say);
  enter(Math.max(0, Math.min(segs.length - 1, shotSeg(shotWords()))));
  shotLater((words) => {
    if (!words.includes('mid')) return;
    if (si === 2) mid.click();
    if (si === 3) {
      slider.value = '40';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  return {
    el,
    async __autoPlay() {
      const out = [];
      if (!player.playing) playBtn.click();
      for (let i = si; i < segs.length; i++) {
        if (i === 2) mid.click();
        if (i === 3) {
          slider.value = String(SWING_AT_THIRD);
          slider.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const ok = await until(() => seg().done, 16000, 80);
        out.push({ seg: i, done: !!ok });
        const go = say.querySelector('.btn.primary');
        if (!ok || !go) break;
        go.click();
        await sleep(150);
      }
      return out;
    },
    destroy() {
      player.stop();
      clearTimeout(holdTimer);
      timers.forEach(clearTimeout);
    },
  };
}

// ───────────── R8 的热身：三种律动，一层一层放出来认声部 ─────────────

const LAYER_ROWS = [['KICK', '底鼓'], ['SNARE', '军鼓'], ['CLAP', '拍手'], ['HAT1', '闭镲'], ['HAT2', '开镲'], ['PERC1', '敲击']];
const LAYER_SAY = {
  KICK: '**底鼓**：最低的那一下“咚”。先找它：它落在哪几格，拍子就在哪。',
  SNARE: '**军鼓**：“啪”。看它是不是守着第 2、4 拍。',
  CLAP: '**拍手**：和军鼓干的是同一件事，守着第 2、4 拍。',
  HAT1: '**闭镲**：细碎的“嚓”。它管密不密。',
  HAT2: '**开镲**：长一点的“嚓——”，夹在两下底鼓中间。',
  PERC1: '**敲击**：点缀，落在别人都空着的地方。',
};

function layers(spec, env, level) {
  const list = Object.entries(level.grooves);
  const player = new LoopPlayer();
  const BARS = spec.bars || 2; // 每一层听几小节，再加下一层
  let now = null;
  let on = new Set(); // 在响的层
  let rows = []; // [{ id, el, cells }]
  let stack = null; // 正在一层一层放：{ at, laps }
  let heard = false;
  let touches = 0;
  const chart = h('div', { class: 'cl-chart rh-layers' });
  const say = h('div', { class: 'cl-note' }, '点一张牌。');
  const stackBtn = h('button', { class: 'btn primary', type: 'button', disabled: true }, '▶ 一层一层放');
  const cards = list.map(([id, g]) => {
    const c = h('button', { class: 'cl-groove', type: 'button', 'data-sfx': 'none' }, h('b', {}, g.name), h('span', {}, `${g.bpm} BPM`));
    c.addEventListener('click', () => choose(id));
    return c;
  });
  const apply = () => {
    const g = level.grooves[now];
    player.set(Object.fromEntries(Object.entries(g.tracks).filter(([t]) => on.has(t))));
    rows.forEach((r) => r.el.classList.toggle('off', !on.has(r.id)));
  };
  player.onStep((s) => rows.forEach((r) => r.cells.forEach((c, i) => c.classList.toggle('head', i === s))));
  player.onSchedule = (step) => {
    if (step !== 0 || !stack) return;
    stack.laps++;
    if (stack.laps <= BARS) return;
    stack.laps = 1;
    stack.at++;
    if (stack.at >= rows.length) {
      // 都放出来了
      stack = null;
      rows.forEach((r) => r.el.classList.remove('fresh'));
      stackBtn.textContent = '▶ 一层一层放';
      say.innerHTML = rich(`全了：这就是 **${level.grooves[now].name}**。听不清一段鼓的时候就这么拆：先找底鼓，再找第 2、4 拍那一下，最后听镲。`);
      if (!heard) {
        heard = true;
        while (touches < 3) {
          touches++;
          env.touched();
        }
      }
      return;
    }
    addLayer(stack.at);
  };
  function addLayer(i) {
    const r = rows[i];
    on.add(r.id);
    apply();
    rows.forEach((x) => x.el.classList.toggle('fresh', x === r));
    say.innerHTML = rich(`${i ? '加进来的是' : '先只放'}${LAYER_SAY[r.id] || r.id}`);
  }
  function startStack() {
    if (!now) return;
    if (stack) {
      // 再点一下 = 不拆了，全放出来
      stack = null;
      on = new Set(rows.map((r) => r.id));
      rows.forEach((r) => r.el.classList.remove('fresh'));
      apply();
      stackBtn.textContent = '▶ 一层一层放';
      return;
    }
    player.stop();
    on = new Set();
    stack = { at: 0, laps: 0 };
    addLayer(0);
    stackBtn.textContent = '■ 全放出来';
    player.start();
    touches++;
    env.touched();
  }
  stackBtn.addEventListener('click', startStack);
  function choose(id) {
    player.stop();
    stack = null;
    stackBtn.textContent = '▶ 一层一层放';
    cards.forEach((c, i) => c.classList.toggle('on', list[i][0] === id && now !== id));
    if (now === id) {
      now = null;
      stackBtn.disabled = true;
      return;
    }
    now = id;
    stackBtn.disabled = false;
    const g = level.grooves[id];
    player.bpm = g.bpm;
    player.swing = g.swing || 0;
    rows = LAYER_ROWS.filter(([t]) => g.tracks[t]).map(([t, zh]) => {
      const cells = [...pad16(g.tracks[t])].map((ch, i) => h('i', { class: [ch === 'x' && 'on', i % 4 === 0 && 'beat'], style: { '--c': `var(--t-${t})` } }));
      const name = h('button', { class: 'rh-layer', type: 'button', 'data-sfx': 'tick', 'aria-label': `${zh}：点一下关掉或打开` }, zh);
      const row = h('div', { class: 'cl-chart-row' }, name, h('div', {}, cells));
      name.addEventListener('click', () => {
        if (stack) return;
        if (on.has(t)) on.delete(t);
        else on.add(t);
        apply();
        say.innerHTML = rich(on.has(t) ? LAYER_SAY[t] : `关掉了${zh}。少了它，少了什么？`);
        touches++;
        env.touched();
      });
      return { id: t, el: row, cells };
    });
    on = new Set(rows.map((r) => r.id));
    chart.replaceChildren(...rows.map((r) => r.el));
    apply();
    say.innerHTML = rich(`**${g.name}**：${g.mark}。点「一层一层放」，听它是怎么搭起来的；也可以点左边的名字，关掉一层。`);
    player.start();
    touches++;
    env.touched();
  }
  const el = h('div', { class: 'cl-toy cl-grooves' }, h('div', { class: 'cl-groove-cards' }, cards), h('div', { class: 'cl-row' }, stackBtn, h('span', { class: 'cl-cap' }, '每一层听两小节，再加下一层')), chart, say);
  shotLater((words) => {
    choose(list[0][0]);
    if (!words.includes('mid')) return;
    player.stop();
    on = new Set();
    stack = { at: 1, laps: 1 };
    on.add(rows[0].id);
    addLayer(1);
    stackBtn.textContent = '■ 全放出来';
    stack = null;
  });
  return {
    el,
    async __autoPlay() {
      cards[0].click();
      await sleep(300);
      stackBtn.click();
      const ok = await until(() => heard, 40000, 100);
      return [{ layers: rows.length, heard: !!ok }];
    },
    destroy: () => player.stop(),
  };
}

export const RHYTHM3_TOYS = { autopilot, readblocks, swingthirds, layers };
