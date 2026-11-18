// 小课堂 · 节奏线第三批（2026-11-18，方案见 docs/training-plan.md 的“节奏线第三批”）。
//   nonstop   R12 不断拍：六到八条只差一两格的一小节谱面连成一局，每条连打两遍、不停顿直接换下一条；按条记分，
//             错得最多的那一条可以“放慢重练”，练顺了算补上。用的是音游引擎的“分段”（game.js / chart.js 的 sections）
//   cycle3    R13 三格一圈（热身）：16 格一行，3 格的小圈在上面滚，跨过小节线接着转；圈长能换成 4、5、6 格；
//             每 8 格截断一次，就是 R5 的“三、三、二”
//   threetwo  R14 三对二（热身）：一圈 12 格，先只听“二”、再只听“三”、再合起来；最后用一块垫子把合起来的四下当成一句拍出来
// R13、R14 的挑战直接用 classroom-rhythm.js 的 rhythm（音游）：R14 的谱面一圈 12 格（chart.js 的 stepsPerBar）。
// 约定同 classroom-kit.js 开头；每个玩具带 __autoPlay()（把“玩一玩”的几小段做完）或 __auto()（把这一档答完），dev/walk-classroom2.js 会认。
// 类名一律带 rh- 前缀。样式在 public/css/rhythm.css。
import { h, rich } from './util.js';
import { audio } from './audio.js';
import { LoopPlayer } from './looper.js';
import { midi } from './midi.js';
import { store } from './store.js';
import { sfx } from './sfx.js';
import { confetti, pop } from './fx.js';
import { RhythmGame } from './game.js';
import { normalizeChart } from './chart.js';
import { byTier, playButton, tapTime, ms } from './classroom-kit.js';
import { TOUCH, sleep, until, fill, pressAt, shotSeg, shotLater, handPads, timingTag } from './classroom-rhythm2.js';

const btn = (text, fn, primary) => h('button', { class: ['btn', 'sm', primary && 'primary'], type: 'button', onclick: fn }, text);
const shotWords = () => (typeof location !== 'undefined' ? (new URLSearchParams(location.search).get('rhshot') || '').split('-').filter(Boolean) : []);
const FOUR = 'x---x---x---x---';
const BACK = '----x-------x---';
const EIGHTS = 'x-x-x-x-x-x-x-x-';

// ───────────── R12 不断拍 ─────────────

// 一条 = 一小节（16 格）的底鼓。相邻两条只差一两格；每条都从第 1 格起
// 铜：都落在“1 & 2 & …”这 8 个位置上
const CHAIN_EASY = [
  'x---x---x---x---',
  'x---x---x-x-x---',
  'x---x---x-x---x-',
  'x-x-x---x-x---x-',
  'x-x-----x-x---x-',
  'x-x---x-x-x---x-',
];
// 银、金：从第 4 条起挪进更细的缝里，最后一条落在“三、三、二”上
const CHAIN_FULL = [
  'x---x---x---x---',
  'x---x---x-x-x---',
  'x---x-----x-x---',
  'x--x------x-x---',
  'x--x--x---x-x---',
  'x--x--x---x---x-',
  'x--x--x-x-----x-',
  'x--x--x-x--x--x-',
];
// 过关线同别的音游关（classroom-rhythm.js 的 TIER_RULE）
const CHAIN_RULE = [
  { speed: 0.85, assist: 'guide', pass: 0.6, say: '慢一点（85% 速度），有示范音。准确率到 60% 就过。' },
  { speed: 1, assist: 'guide', pass: 0.72, say: '原速，示范音还在；后面几条会挪进更细的缝里。准确率到 72% 才过。' },
  { speed: 1, assist: 'solo', pass: 0.85, say: '没有示范音，每小节都换。准确率到 85% 才过。' },
];
// reps = 每条连打几遍；rounds = 整串走几轮
const CHAIN_TIERS = [
  { list: CHAIN_EASY, reps: 2, rounds: 1 },
  { list: CHAIN_FULL, reps: 2, rounds: 1 },
  { list: CHAIN_FULL, reps: 1, rounds: 2 },
];
const CHAIN_PLAY = [
  {
    title: '打两遍，就换', list: CHAIN_EASY.slice(0, 2), reps: 2,
    how: '每一条连打**两遍**，打完不停，直接换下一条。舞台下面那一行：左边是**现在**这一条，右边是**下一条**。',
    after: '换了一条，手没停。',
  },
  {
    title: '眼睛先走', list: CHAIN_EASY.slice(0, 3), reps: 2,
    how: '打第二遍的时候手上照旧，**眼睛先去看右边的下一条**：描了边的格子，就是要变的那一下。',
    after: '手还在这一条，眼睛已经到了下一条：窍门就这一个。',
  },
  {
    title: '错了也不停', list: CHAIN_EASY.slice(0, 4), reps: 1, rounds: 2,
    how: '这回每条只打**一遍**就换，走两轮。打错一下没关系：**别停、别回头**，下一下接着打。',
    after: '错了一下，拍子没断：这比哪一下都要紧。',
  },
];
const DRILL_SPEED = 0.7; // 放慢重练：七成速度
const DRILL_LOOPS = 4; // 这一条循环几遍
const DRILL_PASS = 0.6; // 重练打对六成，这一条就算补上
const PATCH_GOLD = ' 这一局有一条是放慢以后补上的：金这一档先给银牌。想要金牌，整局一口气打下来。';

/** 一条的小图：16 格一行。prev = 上一条（给了就把要变的格子描出来：add 新亮的，del 要灭的） */
function chainGrid(pattern, prev) {
  return h('div', { class: 'rh-cg' }, [...pattern].map((c, i) => h('i', {
    class: [i % 4 === 0 && 'beat', c === 'x' && 'on', prev && c === 'x' && prev[i] !== 'x' && 'add', prev && c !== 'x' && prev[i] === 'x' && 'del'],
  })));
}

/**
 * 一条轨道（底鼓；电脑上按 J 或空格，或者点轨道底下的键帽）。一局是几条小谱面连起来，舞台下面一行写着“现在 / 下一条”。
 * “玩一玩”分三小段带着做（都按铜的规矩）；挑战打完，那一行换成每条一格的成绩，错得最多的那一条可以放慢重练。
 */
function nonstop(spec, env) {
  const tier = env.tier || 0;
  const bpm = spec.bpm || 96;
  const rule = byTier(tier, CHAIN_RULE);
  const segs = tier ? [{ ...byTier(tier, CHAIN_TIERS) }] : CHAIN_PLAY.map((s) => ({ ...s }));
  let si = 0;
  let game = null;
  let run = null; // 整局打完的账：{ acc, denom, secs, worst, passed, patched }
  let drill = -1; // 正在放慢重练第几条（-1 = 没在重练）
  let touches = 0;
  let outcome = null; // 开发用：最近打完的那一局
  const seg = () => segs[si];
  const passLine = () => (tier ? rule.pass : 0.6);
  const starsOf = (acc) => (acc >= 0.92 ? 3 : acc >= passLine() + 0.08 ? 2 : 1);

  const head = h('div', { class: 'rh-move' });
  const pips = h('span', { class: 'rh-pips', 'aria-hidden': 'true' });
  const host = h('div', { class: 'cl-rhythm-host' });
  const strip = h('div', { class: 'rh-chain' });
  const say = h('div', { class: 'cl-note' });
  const el = h('div', { class: ['cl-toy', 'cl-rhythm', 'rh-nonstop', tier && 'challenge'] }, head, host, strip, say);

  /** 整局每一小节是第几条 */
  function orderOf(s) {
    const out = [];
    for (let r = 0; r < (s.rounds || 1); r++) s.list.forEach((_, i) => out.push(...Array(s.reps || 2).fill(i)));
    return out;
  }

  function paintHead() {
    const s = seg();
    if (drill >= 0) {
      head.replaceChildren(h('small', {}, '重练'), h('b', {}, `第 ${drill + 1} 条`), h('span', { html: rich(`只有这一条，循环 **${DRILL_LOOPS} 遍**，速度放慢到七成。打对六成，这一条就算补上。`) }));
      return;
    }
    pips.replaceChildren(...s.list.map(() => h('i')));
    if (tier) {
      head.replaceChildren(h('small', {}, ['铜', '银', '金'][tier - 1]),
        h('b', {}, `${s.list.length} 条 · ${(s.reps || 2) > 1 ? '每条两遍' : '每条一遍，走两轮'}`), h('span', { html: rich(rule.say) }), pips);
    } else head.replaceChildren(h('small', {}, `第 ${si + 1} / ${segs.length} 步`), h('b', {}, s.title), h('span', { html: rich(s.how) }), pips);
  }

  /** 舞台下面那一行：现在是第几条、下一条长什么样。bar = 整局第几小节 */
  function paintStrip(bar) {
    const s = seg();
    strip.className = 'rh-chain';
    if (drill >= 0) {
      strip.classList.add('drill');
      strip.replaceChildren(
        h('div', { class: 'rh-chain-card now' }, h('small', {}, h('b', {}, `重练 · 第 ${drill + 1} 条`)), chainGrid(s.list[drill])),
        h('div', { class: 'rh-chain-card last' }, h('small', {}, h('b', {}, `循环 ${DRILL_LOOPS} 遍`)), h('p', {}, '就这一条，慢慢来。')));
      return;
    }
    const order = game.order;
    const at = Math.max(0, Math.min(order.length - 1, bar));
    const sec = order[at];
    let nb = at + 1;
    while (nb < order.length && order[nb] === sec) nb++;
    let pb = at;
    while (pb > 0 && order[pb - 1] === sec) pb--;
    const next = nb < order.length ? order[nb] : -1;
    const reps = s.reps || 2;
    strip.replaceChildren(
      h('div', { class: 'rh-chain-card now' }, h('small', {}, h('b', {}, `现在 · 第 ${sec + 1} 条`), reps > 1 ? `第 ${at - pb + 1} / ${reps} 遍` : ''), chainGrid(s.list[sec])),
      h('span', { class: 'rh-chain-arrow', 'aria-hidden': 'true' }, '→'),
      next < 0
        ? h('div', { class: 'rh-chain-card next last' }, h('small', {}, h('b', {}, '最后一条')), h('p', {}, '打完这一条就结束。'))
        : h('div', { class: ['rh-chain-card', 'next', nb - at === 1 && 'soon'] }, h('small', {}, h('b', {}, `下一条 · 第 ${next + 1} 条`), '描边的格子要变'), chainGrid(s.list[next], s.list[sec])));
    [...pips.children].forEach((p, i) => (p.className = i === sec ? 'now' : order.slice(0, pb).includes(i) ? 'on' : ''));
  }

  /** 打完了：那一行换成每条一格的成绩；错得最多的那一条可以放慢重练（只在挑战里，一局补一条） */
  function paintResult() {
    strip.className = 'rh-chain result';
    const cells = run.secs.map((s) => h('i', {
      class: ['rh-sec', s.index === run.worst && 'worst', s.patched && 'patched'],
      dataset: { r: s.accuracy >= 0.85 ? 'good' : s.accuracy >= 0.6 ? 'ok' : 'bad' },
      style: { '--v': String(Math.max(0.06, s.accuracy)) },
    }, h('u'), h('b', {}, `${Math.round(s.accuracy * 100)}%`), h('span', {}, s.patched ? `第 ${s.index + 1} 条 · 补` : `第 ${s.index + 1} 条`)));
    const redo = tier && run.worst >= 0 && !run.patched
      ? h('button', { class: ['btn', 'rh-redo', !run.passed && 'primary'], type: 'button', onclick: () => startDrill(run.worst) }, `放慢重练第 ${run.worst + 1} 条`)
      : null;
    fill(strip, h('div', { class: 'rh-secs' }, cells), redo);
    [...pips.children].forEach((p) => (p.className = 'on'));
  }

  function startCard(g) {
    const keys = midi.connected ? '在 SEQTRAK 上打底鼓也行。' : TOUCH ? '音符落到线上的那一刻，点轨道底下的键帽。' : '音符落到线上的那一刻，按 〔J〕 或者 〔空格〕（也可以点轨道底下的键帽）。';
    g.showCard(h('div', { class: 'game-card' },
      drill >= 0 ? h('h3', { style: { marginTop: '0' } }, `放慢重练 · 第 ${drill + 1} 条`) : tier ? h('h3', { style: { marginTop: '0' } }, '不断拍') : null,
      drill < 0 && tier ? h('p', { html: rich('一条接一条，**不停**。手上打着这一条，眼睛先去看下面那一行的“下一条”。') }) : null,
      h('p', { class: 'small muted', html: rich(keys) }),
      h('div', { class: 'game-actions' },
        drill >= 0 ? h('button', { class: 'btn', type: 'button', onclick: backToRun }, '不练了，回整局') : null,
        h('button', { class: 'btn primary lg', type: 'button', onclick: () => g.start() }, '开始'))));
  }

  function build() {
    game?.destroy();
    const s = seg();
    const drilling = drill >= 0;
    const order = drilling ? [drill] : orderOf(s);
    const n = order.length;
    const def = drilling
      ? { bpm, bars: 1, loops: DRILL_LOOPS, lanes: { KICK: s.list[drill] }, backing: { HAT1: EIGHTS, CLAP: BACK } }
      : { bpm, bars: n, loops: 1, lanes: { KICK: order.map((i) => s.list[i]).join('') }, backing: { HAT1: EIGHTS.repeat(n), CLAP: BACK.repeat(n) }, sections: order };
    const chart = normalizeChart({ title: drilling ? `放慢重练 · 第 ${drill + 1} 条` : '不断拍', ...def, id: drilling ? 'classroom-r12-drill' : 'classroom-r12' });
    const g = new RhythmGame(chart, {
      assist: drilling ? 'guide' : rule.assist, speed: drilling ? DRILL_SPEED : rule.speed, metronome: true,
      inputOffsetMs: store.settings.inputOffsetMs, passAccuracy: drilling ? DRILL_PASS : passLine(), countInBeats: 4, showKeyHints: !midi.connected,
    });
    game = g;
    g.order = order;
    g.mount(host).attachKeyboard();
    if (midi.connected) g.attachMidi();
    g.elStage.classList.add('compact');
    paintHead();
    paintStrip(0);
    startCard(g);
    g.on('start', () => {
      outcome = null;
      if (!drilling) run = null; // 整局重新打：上一局的账作废
      paintStrip(0);
      say.textContent = '';
    });
    g.on('section', ({ bar }) => paintStrip(bar));
    g.on('continue', () => g.showCard(null));
    g.on('done', (r) => {
      if (r.demo) return;
      if (drilling) doneDrill(r);
      else doneRun(r);
    });
  }

  /** 整局打完 */
  function doneRun(r) {
    const s = seg();
    const secs = (r.sections || []).map((x) => ({ ...x }));
    const low = secs.filter((x) => x.accuracy < 0.999).sort((a, b) => a.accuracy - b.accuracy || a.index - b.index)[0];
    run = { acc: r.accuracy, denom: Math.max(1, r.total + r.extras * 0.5), secs, worst: low ? low.index : -1, passed: r.passed, patched: false };
    outcome = { accuracy: Math.round(r.accuracy * 100), sections: secs.map((x) => Math.round(x.accuracy * 100)), worst: run.worst, passed: r.passed };
    paintResult();
    const pctOf = (v) => `${Math.round(v * 100)}%`;
    const weak = low ? `最弱的是**第 ${low.index + 1} 条**（打对 ${pctOf(low.accuracy)}）` : '每一条都没掉';
    if (!r.passed) {
      say.innerHTML = rich(`准确率 ${pctOf(r.accuracy)}，这一${tier ? '档' : '步'}要 ${pctOf(passLine())}。${low ? `错得最多的是**第 ${low.index + 1} 条**（打对 ${pctOf(low.accuracy)}）${tier ? '：点「放慢重练」，练顺了算补上' : ''}。` : ''}${tier > 1 ? '先拿下低一档也行。' : ''}`);
      return;
    }
    if (tier) {
      env.done(starsOf(r.accuracy));
      say.innerHTML = rich(`准确率 **${pctOf(r.accuracy)}**，最高连击 **${r.maxCombo}**：过了。${weak}。`);
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
    game.showCard(null);
    say.innerHTML = rich(`✓ ${s.after}${lastOne ? '下面那一行：每条一格，是你每一条打对了几成。' : ''}`);
    if (lastOne) {
      confetti(host, 18);
      say.append(' ', btn('从头再来一遍', () => enter(0)));
      return;
    }
    const go = btn(`下一步：${segs[si + 1].title} →`, () => enter(si + 1), true);
    say.append(' ', go);
    pop(go);
  }

  /** 放慢重练打完：过了六成，这一条按重练的成绩记（比原来高才换），整局的准确率跟着重算 */
  function doneDrill(r) {
    const k = drill;
    const sec = run.secs[k];
    const pctOf = (v) => `${Math.round(v * 100)}%`;
    const was = run.passed;
    if (r.passed) {
      if (r.accuracy > sec.accuracy) {
        run.acc += ((r.accuracy - sec.accuracy) * sec.total) / run.denom;
        sec.accuracy = r.accuracy;
      }
      sec.patched = true;
      run.patched = true;
      if (!run.passed && run.acc >= passLine() - 1e-9) {
        run.passed = true;
        env.done(1, tier === 3 ? PATCH_GOLD : '');
      }
    }
    outcome = { drill: k, drillAccuracy: Math.round(r.accuracy * 100), patched: !!sec.patched, accuracy: Math.round(run.acc * 100), passed: run.passed };
    paintResult();
    const again = btn('整局再来一次', backToRun, !run.passed);
    if (!r.passed) say.innerHTML = rich(`重练打对 ${pctOf(r.accuracy)}，要 ${pctOf(DRILL_PASS)} 才算补上：点卡片上的「再来一次」。`);
    else if (run.passed && !was) say.innerHTML = rich(`✓ 第 ${k + 1} 条补上了。整局算下来 **${pctOf(run.acc)}**：过了。`);
    else if (run.passed) say.innerHTML = rich(`✓ 第 ${k + 1} 条练顺了（重练打对 ${pctOf(r.accuracy)}）。`);
    else say.innerHTML = rich(`第 ${k + 1} 条补上了。整局算下来 ${pctOf(run.acc)}，要 ${pctOf(passLine())}：还差一点。`);
    say.append(' ', again);
  }

  function startDrill(k) {
    drill = k;
    build();
  }
  function backToRun() {
    drill = -1;
    run = null;
    build();
  }
  function enter(i) {
    si = i;
    drill = -1;
    run = null;
    build();
    say.textContent = '';
  }
  enter(tier ? 0 : Math.max(0, Math.min(segs.length - 1, shotSeg(shotWords()))));

  // 开发用（截图）：?rhshot=stage[-b22] 打到一半；result 整局的成绩；drill 放慢重练的开始卡片
  shotLater((words) => {
    if (words.includes('stage')) {
      const b = Number((words.find((x) => /^b\d+$/.test(x)) || 'b22').slice(1));
      game.preview('stage', b);
      paintStrip(Math.floor(b / 4));
    }
    if (words.includes('result') || words.includes('drill')) {
      const r = game.preview('result', words.includes('fail') ? 0 : 2);
      doneRun(r);
      if (words.includes('drill') && run.worst >= 0) startDrill(run.worst);
    }
  });

  /**
   * 开发用：把现在摆着的这一局打掉。到点了就按这条轨道的键：发的是真的 keydown，由音游自己的键盘监听去接。skip(音符) 说 true 的那些故意漏掉。
   * 每个音临到跟前（半秒以内）才把音频时钟换算成页面时钟：一局四十来秒，一开局就全排好的话，两只钟会漂开几十毫秒（虚拟机里量到过 24 秒漂 30 多毫秒）
   */
  async function autoRun(skip = () => false) {
    const g = game;
    [...el.querySelectorAll('.game-card .btn.primary')].find((b) => /开始|再来/.test(b.textContent))?.click();
    await until(() => g.clock && g.state !== 'idle', 3000);
    const live = () => g === game && (g.state === 'countin' || g.state === 'playing');
    const arm = (t) => {
      if (!live()) return;
      const wait = audio.ctxToPerf(g.clock.ctxAtBeat(t.beat)) - performance.now();
      if (wait > 500) return setTimeout(() => arm(t), wait - 400);
      setTimeout(() => live() && window.dispatchEvent(new KeyboardEvent('keydown', { key: g.chart.lanes[t.lane].key || ' ', bubbles: true, cancelable: true })), Math.max(0, wait));
    };
    for (const t of g.targets) if (!skip(t)) arm(t);
    await until(() => g.state === 'done', 120000, 150);
    await sleep(300);
    return { ...outcome };
  }
  return {
    el,
    get game() {
      return game;
    },
    __auto: () => autoRun(),
    /** 开发用：故意把第 k 条打烂（每小节只打第一下；every > 0 时别的条每 every 下再漏一下），再点“放慢重练”把它补上。返回 { before, after } */
    async __autoFlub(k = 1, every = 0) {
      const before = await autoRun((t) => (t.sec === k ? t.step % 16 !== 0 : every > 0 && t.id % every === 0));
      const redo = strip.querySelector('.rh-redo');
      if (!redo) return { before, redo: false };
      redo.click();
      await sleep(200);
      const after = await autoRun();
      return { before, after, say: say.textContent };
    },
    async __autoPlay() {
      const out = [];
      for (let i = si; i < segs.length; i++) {
        const r = await autoRun();
        out.push({ seg: i, done: !!seg().done, ...r });
        const go = say.querySelector('.btn.primary');
        if (!seg().done || !go) break;
        go.click();
        await sleep(200);
      }
      return out;
    },
    destroy: () => game?.destroy(),
  };
}

// ───────────── R13 三格一圈（热身） ─────────────

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const LENS = [3, 4, 5, 6];
const CYCLE_PLAY = [
  {
    title: '四格一圈', set: { len: 4, cut: false }, bars: 2, ok: (s) => s.len === 4 && !s.cut,
    how: '点「播放」。镲**每 4 格一下**，正好和底鼓踩在一起。听两小节。', hint: '先听 4 格一圈的：点上面的「4 格」。',
    after: () => '4 格一圈，16 格里正好放下 4 圈：每一小节都落在同样的格上，**不错位**。',
  },
  {
    title: '三格一圈', bars: 3, ok: (s) => s.len === 3 && !s.cut,
    how: '把圈长换成 **3 格**（点上面的「3 格」）。盯着那个小圈：滚到小节线它不停，**跨过去接着转**。听它转完一轮。', hint: '点上面的「3 格」。',
    after: () => '3 格的圈在 16 格里放不整齐，每小节错开一点。转满 **3 小节**（48 格），才又回到第 1 格。',
  },
  {
    title: '换个圈长', bars: 2, ok: (s) => (s.len === 5 || s.len === 6) && !s.cut,
    how: '再换成 **5 格**或者 **6 格**听听：它要几小节才转回来？数一数下面有几行。', hint: '点上面的「5 格」或者「6 格」。',
    after: (s) => `${s.len} 格一圈：要 **${s.len === 5 ? 5 : 3} 小节**才回到原位。圈长和 16 对不上，镲和底鼓就各转各的。`,
  },
  {
    title: '把圈截断', set: { len: 3, cut: false }, bars: 2, ok: (s) => s.len === 3 && s.cut,
    how: '换回 3 格了。点「**每 8 格重新起头**」：圈转到第 8 格就被截断，第 9 格从头再来。', hint: '点上面的「每 8 格重新起头」。',
    after: () => '三格、三格，剩下两格被截断：**三、三、二**。R5「故意错开」里打的就是它。',
  },
];

/**
 * 一条 N 格的小圈压在 16 格的小节上：镲在每一圈的头上响，底鼓每拍一下。一行 = 一小节，转回原位要几小节就画几行；
 * 圈画成格子底下的一截色带，跨过小节线的那一圈在行尾不封口、下一行接着画。“每 8 格重新起头”只在 3 格一圈时能开：3 + 3 + 2。
 */
function cycle3(spec, env) {
  const bpm = spec.bpm || 100;
  const segs = CYCLE_PLAY.map((s) => ({ ...s }));
  const st = { len: 4, cut: false };
  let si = 0;
  let told = 0; // 跟页面说了几次“动过一下了”：说到第 3 次，页面才把那句“这个叫……”亮出来
  let heard = 0; // 现在这种圈长听了几小节（数的是小节头）
  let period = 16;
  let cells = []; // 整轮每一格的元素
  let ringOf = []; // 每一格在第几圈
  let lastRing = -1;
  const timers = new Set();
  const later = (fn, n = 0) => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, Math.max(0, n));
    timers.add(id);
  };
  const seg = () => segs[si];
  const tell = () => {
    told++;
    env.touched();
  };
  const player = new LoopPlayer({ bpm, steps: 16 });
  const head = h('div', { class: 'rh-move' });
  const rows = h('div', { class: 'rh-cyc' });
  const say = h('div', { class: 'cl-note' }, '点「播放」。');
  const lenBtns = LENS.map((n) => {
    const b = h('button', { class: 'rh-len', type: 'button', 'data-sfx': 'tick' }, `${n} 格`);
    b.addEventListener('click', () => {
      st.len = n;
      if (n !== 3) st.cut = false;
      apply();
    });
    return b;
  });
  const cutBtn = h('button', { class: 'btn rh-cut', type: 'button', 'data-sfx': 'tick' }, '每 8 格重新起头');
  cutBtn.addEventListener('click', () => {
    if (st.len !== 3) return;
    st.cut = !st.cut;
    apply();
  });

  /** 一轮里的每一圈：[从第几格起, 几格长] */
  function rings() {
    const out = [];
    if (st.cut) for (let base = 0; base < 16; base += 8) for (let p = 0; p < 8; p += st.len) out.push([base + p, Math.min(st.len, 8 - p)]);
    else for (let p = 0; p < period; p += st.len) out.push([p, st.len]);
    return out;
  }

  function draw() {
    const list = rings();
    ringOf = [];
    const kind = [];
    list.forEach(([from, len], r) => {
      for (let k = 0; k < len; k++) {
        ringOf[from + k] = r;
        kind[from + k] = [`c${r % 2}`, k === 0 && 'hd', k === 0 && 'gs', k === len - 1 && 'ge', len < st.len && 'short'];
      }
    });
    cells = Array.from({ length: period }, (_, p) => h('i', { class: ['rh-cy', p % 4 === 0 && 'beat', ...kind[p]] }, h('u')));
    const n = period / 16;
    rows.replaceChildren(...Array.from({ length: n }, (_, r) => h('div', { class: 'rh-cyc-row' },
      h('span', {}, n > 1 ? `第 ${r + 1} 小节` : '每一小节'), h('div', { class: 'rh-cyc-cells' }, cells.slice(r * 16, r * 16 + 16)))));
    rows.dataset.rows = String(n);
    lastRing = -1;
    lenBtns.forEach((b, i) => {
      b.classList.toggle('on', LENS[i] === st.len);
      b.setAttribute('aria-pressed', String(LENS[i] === st.len));
    });
    cutBtn.disabled = st.len !== 3;
    cutBtn.classList.toggle('on', st.cut);
    cutBtn.setAttribute('aria-pressed', String(st.cut));
  }

  /** 圈长或者截不截断变了：重新排一轮（正在放的话从头接着放） */
  function apply() {
    const was = player.playing;
    if (was) player.stop();
    period = st.cut ? 16 : (st.len * 16) / gcd(st.len, 16);
    player.steps = period;
    draw();
    player.set({ KICK: FOUR, HAT1: cells.map((c) => (c.classList.contains('hd') ? 'x' : '-')).join('') });
    heard = 0;
    if (was) player.start();
    hint();
  }
  function hint() {
    const s = seg();
    if (s.done) return;
    if (!s.ok(st)) say.textContent = s.hint;
    else say.textContent = player.playing ? `听 ${s.bars} 小节。` : '点「播放」。';
  }

  player.onSchedule = (step, t) => {
    if (step % 16) return;
    heard++;
    const s = seg();
    if (!s.done && s.ok(st) && heard > s.bars) later(() => pass(), audio.ctxToPerf(t) - performance.now());
  };
  player.onStep((s) => {
    cells.forEach((c, i) => c.classList.toggle('now', i === s));
    const r = s < 0 ? -1 : ringOf[s];
    if (r === lastRing) return;
    lastRing = r;
    cells.forEach((c, i) => c.classList.toggle('cur', r >= 0 && ringOf[i] === r));
  });

  function pass() {
    const s = seg();
    if (s.done || !s.ok(st)) return;
    s.done = true;
    const lastOne = si >= segs.length - 1;
    sfx.play(lastOne ? 'star' : 'ok');
    // 第一小步做完，“下一步”的按钮就亮；那句“这个叫……”等到最后一小步（被截断的圈 = 三、三、二）做完才出来
    if (!told) tell();
    while (lastOne && told < 3) tell();
    say.innerHTML = rich(`✓ ${s.after(st)}`);
    if (lastOne) {
      confetti(rows, 16);
      return say.append(' ', btn('从头再来一遍', () => enter(0)));
    }
    const go = btn(`下一步：${segs[si + 1].title} →`, () => enter(si + 1), true);
    say.append(' ', go);
    pop(go);
  }
  function enter(i) {
    si = i;
    const s = seg();
    s.done = false;
    head.replaceChildren(h('small', {}, `第 ${si + 1} / ${segs.length} 步`), h('b', {}, s.title), h('span', { html: rich(s.how) }));
    if (s.set) Object.assign(st, s.set);
    apply();
  }
  const playBtn = playButton(player, {
    onToggle() {
      heard = 0;
      hint();
    },
  });
  const el = h('div', { class: 'cl-toy rh-cycle' },
    h('div', { class: 'cl-row' }, playBtn, h('div', { class: 'rh-lens', role: 'group', 'aria-label': '圈长' }, lenBtns), cutBtn),
    head,
    h('div', { class: 'cl-cap' }, '一行 = 一小节 · 亮的格是镲 · 上面的小点是底鼓 · 下面一截色带是一圈'),
    rows, say);
  enter(Math.max(0, Math.min(segs.length - 1, shotSeg(shotWords()))));
  // 开发用（截图）：?rhshot=s1-mid 第 2 小步、换成了 3 格、转到一半；s3-mid 截断以后
  shotLater((words) => {
    if (!words.includes('mid')) return;
    if (si === 1) lenBtns[0].click();
    if (si === 2) lenBtns[2].click();
    if (si === 3) cutBtn.click();
    const at = si === 3 ? 9 : 19 % period;
    cells.forEach((c, i) => {
      c.classList.toggle('now', i === at);
      c.classList.toggle('cur', ringOf[i] === ringOf[at]);
    });
  });
  return {
    el,
    async __autoPlay() {
      const out = [];
      if (!player.playing) playBtn.click();
      for (let i = si; i < segs.length; i++) {
        await sleep(150);
        if (i === 1) lenBtns[0].click();
        if (i === 2) lenBtns[2].click();
        if (i === 3) cutBtn.click();
        const ok = await until(() => seg().done, 20000, 80);
        out.push({ seg: i, done: !!ok, len: st.len, cut: st.cut, rows: period / 16 });
        const go = say.querySelector('.btn.primary');
        if (!ok || !go) break;
        go.click();
      }
      return out;
    },
    destroy() {
      player.stop();
      timers.forEach(clearTimeout);
    },
  };
}

// ───────────── R14 三对二（热身） ─────────────

const RING = 12; // 一圈 12 格
const TWO = [0, 6]; // “二”：底鼓，每 6 格一下
const THREE = [0, 4, 8]; // “三”：军鼓，每 4 格一下
const SUM = [0, 4, 6, 8]; // 合起来响的那四格
const SUM_WORD = { 0: '一起', 4: '啪', 6: '咚', 8: '啪' };
const RING_PLAY = [
  { show: '2', laps: 2, title: '先只听“二”', how: '点「播放」。一圈 12 格，每圈开头“嘀”一声。底鼓“咚”在一圈里**匀匀地响 2 下**：第 1 格和第 7 格。', after: '一圈 2 下：每 6 格一下。' },
  { show: '3', laps: 2, title: '再只听“三”', how: '换成军鼓“啪”。圈还是那么长，这回**匀匀地响 3 下**：第 1、5、9 格。', after: '一圈 3 下：每 4 格一下。圈一样长，步子不一样大。' },
  { show: 'both', laps: 3, title: '合起来', how: '两条一起放。每圈开头它们**一起**落下，然后各走各的。看最下面那一行：合起来只有四下。', after: '第 1 格一起，第 5 格“啪”，第 7 格“咚”，第 9 格“啪”：**一起、啪、咚、啪**。' },
  {
    show: 'both', tap: true, laps: 2, title: '当成一句来拍',
    how: '先别分两只手。照最下面那一行，用一块垫子把这四下拍出来：**一起、啪、咚、啪**。连着两圈都对就过。',
    after: '这一句拍顺了，就有底了。等会儿把“咚”分给左手、“啪”分给右手。',
  },
];
const RING_WIN = 110; // 拍在点上前后 110 毫秒以内算对

/**
 * 一圈 12 格，三行格子：“三”（军鼓，第 1、5、9 格）、“二”（底鼓，第 1、7 格）、合起来（一起、啪、咚、啪）。
 * 前三小步只听、只看；第四小步用一块垫子把合起来的那一句拍出来（J、空格、点垫子都行；接着真机时任何一个音都算）。
 */
function threetwo(spec, env) {
  const bpm = spec.bpm || 90;
  const segs = RING_PLAY.map((s) => ({ ...s }));
  let si = 0;
  let told = 0; // 跟页面说了几次“动过一下了”：说到第 3 次，页面才把那句“这个叫……”亮出来
  let auto = false;
  let lap = -1; // 现在排到第几圈（从点「播放」起数）
  let from = 1; // 从第几圈起算
  let heard = 0;
  let streak = 0;
  let sched = []; // 排进时钟的每一格：{ lap, step, t }
  const hits = new Set(); // 拍对了的：`${lap}:${step}`
  const stray = new Map(); // 第几圈 → 没拍在点上的有几下
  const timers = new Set();
  const later = (fn, n = 0) => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, Math.max(0, n));
    timers.add(id);
  };
  const seg = () => segs[si];
  const tell = () => {
    told++;
    env.touched();
  };
  const player = new LoopPlayer({ bpm, steps: RING });
  const head = h('div', { class: 'rh-move' });
  const hud = h('div', { class: 'cl-count rh-hud' });
  const say = h('div', { class: 'cl-note' }, '点「播放」。');
  const makeRow = (id, name, sub, on, word) => {
    const cs = Array.from({ length: RING }, (_, i) => h('i', { class: ['rh-rc', i % 4 === 0 && 'beat', on.includes(i) && 'on'] }, word ? h('em', {}, word[i] || '') : null, h('u')));
    return { cs, el: h('div', { class: ['rh-ring-row', `rh-ring-${id}`] }, h('span', { class: 'rh-rowname' }, h('b', {}, name), sub), h('div', { class: 'rh-rcs' }, cs)) };
  };
  const row3 = makeRow('three', '三 · 啪', '军鼓，每 4 格一下', THREE);
  const row2 = makeRow('two', '二 · 咚', '底鼓，每 6 格一下', TWO);
  const rowSum = makeRow('sum', '合起来', '一圈只有四下', SUM, SUM_WORD);
  const nums = h('div', { class: 'rh-ring-row rh-ring-nums' }, h('span', { class: 'rh-rowname' }), h('div', { class: 'rh-rcs' }, Array.from({ length: RING }, (_, i) => h('b', { class: i % 4 === 0 ? 'beat' : '' }, String(i + 1)))));
  const padHost = h('div', { class: 'rh-padhost' });
  const pads = handPads({
    one: true, R: { label: '拍', sub: '一起、啪、咚、啪 ' },
    onHit: (id, perfMs, src) => tap(perfMs, src),
    fromMidi: env.live ? () => 'R' : null,
  });
  padHost.append(pads.el);

  player.onSchedule = (step, t) => {
    const s = seg();
    if (step === 0) {
      lap++;
      audio.click(t, true); // 每圈开头一声“嘀”
      if (!s.tap) {
        heard++;
        if (!s.done && heard > s.laps) later(() => pass(), audio.ctxToPerf(t) - performance.now());
      }
    }
    sched.push({ lap, step, t });
    if (sched.length > 80) sched.shift();
    if (s.show !== '3' && TWO.includes(step)) audio.drum('KICK', t, s.tap ? 0.3 : 0.9);
    if (s.show !== '2' && THREE.includes(step)) audio.drum('SNARE', t, s.tap ? 0.28 : 0.8);
    if (s.tap && auto && lap >= from && SUM.includes(step)) timers.add(pressAt(pads.pads.R.el, t));
    // 上一圈拍得怎么样：它最后一下的窗口早过了
    if (s.tap && step === 2 && lap - 1 >= from) later(() => judgeLap(lap - 1));
  };
  player.onStep((s) => {
    for (const r of [row3, row2, rowSum]) r.cs.forEach((c, i) => c.classList.toggle('now', i === s));
  });

  /** 刚过去的那一圈：四下都拍到了、多出来的不超过一下，算对；连着两圈都对就做到了 */
  function judgeLap(l) {
    const s = seg();
    if (s.done || !s.tap) return;
    const got = SUM.filter((st) => hits.has(`${l}:${st}`)).length;
    const good = got === SUM.length && (stray.get(l) || 0) <= 1;
    streak = good ? streak + 1 : 0;
    paintHud();
    if (streak >= s.laps) return pass();
    if (!good) say.textContent = got < SUM.length ? `这一圈拍到了 ${got} 下，要 4 下：一起、啪、咚、啪。` : '多拍了几下：一圈只有四下。';
  }
  function tap(perfMs, src) {
    const s = seg();
    if (!s.tap) return;
    const marks = sched.filter((e) => SUM.includes(e.step));
    if (!player.playing || !marks.length) {
      if (src !== 'midi') audio.drum('PERC1', 0, 0.4);
      return (say.textContent = '先点「播放」。');
    }
    const t = tapTime(perfMs);
    const near = marks.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));
    const v = ms(t - near.t);
    const key = `${near.lap}:${near.step}`;
    if (Math.abs(v) <= RING_WIN && !hits.has(key)) {
      hits.add(key);
      if (src !== 'midi') {
        // 你拍出来的就是合起来的那一句：一起 = 咚加啪
        if (near.step === 0 || near.step === 6) audio.drum('KICK', 0, 0.9);
        if (near.step !== 6) audio.drum('SNARE', 0, 0.85);
      }
      if (near.lap >= from) pads.flash('R', ...timingTag(v));
      const cell = rowSum.cs[near.step];
      cell.dataset.r = 'ok';
      later(() => delete cell.dataset.r, 420);
    } else {
      if (src !== 'midi') audio.drum('PERC1', 0, 0.4);
      const l = sched.filter((e) => e.t <= t).pop()?.lap ?? near.lap;
      stray.set(l, (stray.get(l) || 0) + 1);
      if (l >= from) pads.flash('R', '不在点上', 'bad');
    }
  }

  const paintHud = () => (hud.textContent = seg().tap && !seg().done ? `稳住 ${Math.min(streak, seg().laps)} / ${seg().laps} 圈` : '');
  function paint() {
    const s = seg();
    head.replaceChildren(h('small', {}, `第 ${si + 1} / ${segs.length} 步`), h('b', {}, s.title), h('span', { html: rich(s.how) }));
    row3.el.classList.toggle('off', s.show === '2');
    row2.el.classList.toggle('off', s.show === '3');
    rowSum.el.classList.toggle('off', s.show !== 'both');
    padHost.hidden = !s.tap;
    paintHud();
  }
  function enter(i) {
    si = i;
    seg().done = false;
    heard = 0;
    streak = 0;
    from = player.playing ? lap + 2 : 1;
    paint();
    say.textContent = !player.playing ? '点「播放」。' : seg().tap ? '下一圈开始算。' : `听 ${seg().laps} 圈。`;
    if (seg().tap && player.playing) pads.pads.R.el.focus({ preventScroll: true });
  }
  function pass() {
    const s = seg();
    if (s.done) return;
    s.done = true;
    const lastOne = si >= segs.length - 1;
    sfx.play(lastOne ? 'star' : 'ok');
    // 第一小步做完，“下一步”的按钮就亮；那句“这个叫……”等“合起来”那一小步做完才出来
    if (!told) tell();
    while (si >= 2 && told < 3) tell();
    paintHud();
    say.innerHTML = rich(`✓ ${s.after}`);
    if (lastOne) {
      confetti(pads.el, 18);
      return say.append(' ', btn('从头再来一遍', () => enter(0)));
    }
    const go = btn(`下一步：${segs[si + 1].title} →`, () => enter(si + 1), true);
    say.append(' ', go);
    pop(go);
  }
  const playBtn = playButton(player, {
    onToggle(on) {
      lap = -1;
      sched = [];
      hits.clear();
      stray.clear();
      heard = 0;
      streak = 0;
      from = 1; // 第一圈先听着找拍子
      paintHud();
      if (on && seg().tap) pads.pads.R.el.focus({ preventScroll: true });
      if (!seg().done) say.textContent = !on ? '停了。点「播放」接着来。' : seg().tap ? '第一圈先听，第二圈开始算。' : `听 ${seg().laps} 圈。`;
    },
  });
  const el = h('div', { class: 'cl-toy rh-three2' },
    h('div', { class: 'cl-row' }, playBtn, h('span', { class: 'cl-cap' }, '一圈 12 格 · 每圈开头“嘀”一声'), h('span', { class: 'spacer' }), hud),
    head,
    h('div', { class: 'rh-ring' }, row3.el, row2.el, rowSum.el, nums),
    padHost, say);
  enter(Math.max(0, Math.min(segs.length - 1, shotSeg(shotWords()))));
  // 开发用（截图）：?rhshot=s2-mid 合起来、走到一半；s3-mid 拍到一半
  shotLater((words) => {
    if (!words.includes('mid')) return;
    for (const r of [row3, row2, rowSum]) r.cs[6].classList.add('now');
    if (!seg().tap) return;
    streak = 1;
    paintHud();
    rowSum.cs[0].dataset.r = 'ok';
    rowSum.cs[4].dataset.r = 'ok';
    pads.flash('R', '准 !', 'ok', true);
  });
  return {
    el,
    async __autoPlay() {
      const out = [];
      auto = true;
      if (!player.playing) playBtn.click();
      for (let i = si; i < segs.length; i++) {
        const ok = await until(() => seg().done, 24000, 80);
        out.push({ seg: i, done: !!ok });
        const go = say.querySelector('.btn.primary');
        if (!ok || !go) break;
        go.click();
        await sleep(120);
      }
      auto = false;
      return out;
    },
    destroy() {
      player.stop();
      pads.destroy();
      timers.forEach(clearTimeout);
    },
  };
}

export const RHYTHM4_TOYS = { nonstop, cycle3, threetwo };
