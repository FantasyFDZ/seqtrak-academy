// 小课堂 · 节奏线“一心多用”第一批（2026-11-17，方案见 docs/training-plan.md 的“从两门课里借什么”和“节奏线第一批”）。
// 练的不是“听懂、跟上、编出来”，是另一件事：像打碟——已经推上去的那首让它自己转，耳朵和心思只给正在接进来的那一首；节拍器是拿来对表的，不是拿来跟的。
//   metro      R1 跟稳：节拍器三招（越放越稀 / 消失再回来 / 反过来听），反馈里多了“漂移”（越拍越快还是越慢）
//   accents    R9 重音挪一挪：一排 8 格镲，一个键轻、一个键重；格子不变，重音挪一格律动就变
//   handshift  R7 两只手（热身）：左手每拍一下不变，右手那一下往后挪一格
//   saycount   R2 数出来（热身）和 saywords（挑战的第一段）：“只念开头”的读法：一个音占几格，只念第一格的字
// 约定同 classroom-kit.js 开头：make(spec, env) → { el, destroy() }；env.tier 0 = 玩一玩（一小段一小段带着做），1 / 2 / 3 = 铜 / 银 / 金。
// 每个玩具另带两个开发用的口子（dev/walk-classroom2.js 会认）：__auto() 把这一档答完，__autoPlay() 把“玩一玩”的几小段做完。
// 判“准不准”一律用按下那一刻的时间（tapTime，已经算上输入延迟校准）；定时器只用来排“下一段什么时候开始”这类不算分的事。
import { h, rich, clamp, mean, stddev } from './util.js';
import { audio } from './audio.js';
import { LoopPlayer } from './looper.js';
import { midi } from './midi.js';
import { TRACK } from './tracks.js';
import { sfx } from './sfx.js';
import { confetti, pop } from './fx.js';
import { byTier, playButton, tapPad, tapTime, ms } from './classroom-kit.js';

// 样式是自己带来的（public/css/rhythm.css），不用改 index.html
if (typeof document !== 'undefined' && !document.querySelector('link[data-rhythm]')) {
  document.head.append(h('link', { rel: 'stylesheet', href: '/css/rhythm.css', 'data-rhythm': '' }));
}

const TOUCH = typeof window !== 'undefined' && !!window.matchMedia?.('(hover: none)').matches;
const typing = (el) => !!el?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
const sleep = (n) => new Promise((r) => setTimeout(r, n));
/** 把一个元素里的东西整个换掉（空的不放：原生的 replaceChildren 会把 null 写成“null”两个字） */
const fill = (el, ...kids) => el.replaceChildren(...kids.filter((k) => k !== null && k !== undefined && k !== false));
async function until(cond, limit = 4000, every = 50) {
  const end = performance.now() + limit;
  for (;;) {
    const v = cond();
    if (v) return v;
    if (performance.now() > end) return false;
    await sleep(every);
  }
}
/** 开发用：到音频时钟的 t 那一刻，在 node 上按一下（和 dev/walk-classroom2.js 的 padAt 一个做法：走的是真的按下事件） */
function pressAt(node, t, jitter = 14) {
  const wait = audio.ctxToPerf(t) - performance.now() + (Math.random() - 0.5) * jitter;
  return setTimeout(() => node.isConnected && node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1 })), Math.max(0, wait));
}

// 开发用（截图、看版式）：地址里带 ?rhshot=… 时，玩具摆好之后直接摆出某个画面，不用真的打（tools/rhythm-shots.sh 在无界面的浏览器里用）。
// 值是用 - 连起来的几个词，每个玩具认自己懂的：s2 = 玩一玩的第 3 小段，mid = 做到一半，result = 结果，one = 一块垫子版，
// thin / gone / flip = R1 的哪一招，next = 这一段算过了、进接力的下一段，stage = 音游打到一半
const SHOT = typeof location !== 'undefined' ? (new URLSearchParams(location.search).get('rhshot') || '').split('-').filter(Boolean) : [];
export const shotLater = (fn) => SHOT.length && setTimeout(() => fn(SHOT), 80);
const shotSeg = (words) => {
  const w = words.find((x) => /^s\d$/.test(x));
  return w ? Number(w[1]) : -1;
};

const offWords = (v) => (Math.abs(v) < 15 ? '正好' : `${v < 0 ? '早了' : '晚了'} ${Math.abs(Math.round(v))} 毫秒`);
const steadyWord = (spread) => (spread <= 30 ? '很稳' : spread <= 50 ? '挺稳' : spread <= 85 ? '还行' : '有点飘');

/** 一串 [第几下, 偏了多少毫秒] 的走势：每一下比上一下多偏多少（最小二乘的斜率），和从头到尾一共漂了多少 */
function trend(points) {
  if (points.length < 3) return { slope: 0, total: 0 };
  const mx = mean(points.map((p) => p[0]));
  const my = mean(points.map((p) => p[1]));
  let num = 0;
  let den = 0;
  for (const [x, y] of points) {
    num += (x - mx) * (y - my);
    den += (x - mx) ** 2;
  }
  const slope = den ? num / den : 0;
  return { slope, total: slope * (points[points.length - 1][0] - points[0][0]) };
}
// 越来越早 = 每一下都比节拍器抢一点 = 越拍越快。不到 30 毫秒的当成没漂：八下里每下晃二三十毫秒，凑出这么点“走势”很平常
const DRIFT_MIN = 30;
const driftWords = (total) => (Math.abs(total) < DRIFT_MIN ? '没怎么漂' : `**${total < 0 ? '越拍越快' : '越拍越慢'}**（到最后${total < 0 ? '早' : '晚'}了 ${Math.abs(Math.round(total))} 毫秒）`);

// ───────────── R1 跟稳：节拍器三招 ─────────────

const MOVES = {
  every: { name: '先跟上', how: '每“嘀”一声拍一下，连着拍 **8 下**。', short: '每拍都响' },
  thin: { name: '越放越稀', how: '“嘀”越来越少：每拍一声 → 两拍一声 → 一小节一声。你别停，照样**每拍一下**。', short: '放稀' },
  gone: { name: '消失再回来', how: '“嘀”响两小节，再**静两小节**。你别停。它回来的那一下，看你还在不在点上。', short: '消失再回来' },
  flip: { name: '反过来听', how: '这回它不踩拍子，只在缝里“嚓”。你拍的是两声“嚓”中间的那一下“**咚**”。', short: '只给“嚓”' },
};

/** 一招的计划，一拍一项。s：这一拍出什么声（'t' 嘀 / '' 不出声 / 'o' 只在后半拍“嚓”一声）；back：静完之后回来的那一下 */
function planOf(kind, rounds = 2) {
  const of = (str) => [...str].map((c) => ({ s: c === '-' ? '' : c }));
  if (kind === 'thin') return of('tttt' + 't-t-' + 't---' + 't---');
  if (kind === 'flip') return of('oooooooo');
  if (kind === 'gone') {
    const plan = of('tttttttt--------'.repeat(rounds) + 'tttt');
    for (let r = 1; r <= rounds; r++) plan[16 * r].back = true;
    return plan;
  }
  return of('tttttttt');
}

/** 这一招拍得怎么样。offs[k] = 第 k 拍偏了多少毫秒（没拍到是 undefined）。返回 { stars（0 = 没过）, html, drift } */
function assess(kind, plan, offs) {
  const pts = plan.map((_, k) => [k, offs[k]]).filter((p) => p[1] !== undefined);
  const vals = pts.map((p) => p[1]);
  const n = plan.length;
  if (vals.length < Math.ceil(n * 0.75)) {
    return { stars: 0, html: `${n} 拍里只拍到 ${vals.length} 下：中间停了。每一拍都要拍，“嘀”不响也拍。` };
  }
  const spread = stddev(vals);
  const all = trend(pts);
  if (kind === 'gone') {
    const loud = pts.filter(([k]) => plan[k].s === 't' && !plan[k].back).map((p) => p[1]);
    const base = mean(loud); // 你平时偏多少（屏幕和鼠标的延迟也在里面）：回来那一下要减掉它再看
    const backs = plan.map((b, k) => (b.back ? offs[k] : null)).filter((v) => v !== null);
    const quiet = plan.map((b, k) => k).filter((k) => plan[k].s === '');
    const quietHit = quiet.filter((k) => offs[k] !== undefined);
    const rounds = backs.length;
    const drifts = Array.from({ length: rounds }, (_, r) => trend(pts.filter(([k]) => k >= 16 * r + 7 && k < 16 * r + 16)).total);
    const drift = mean(drifts);
    if (backs.some((v) => v === undefined)) return { stars: 0, drift, html: '它回来的那一下你没拍到。静的那两小节心里接着数：1、2、3、4……' };
    const errs = backs.map((v) => v - base);
    const err = mean(errs.map(Math.abs));
    const stars = quietHit.length < quiet.length * 0.75 ? 0 : err <= 35 ? 3 : err <= 60 ? 2 : err <= 100 ? 1 : 0;
    const word = err <= 35 ? '几乎没动：钟在你心里' : err <= 60 ? '差一点点' : err <= 100 ? '跑了一些' : '跑远了';
    return {
      stars, drift,
      html: `静的 ${quiet.length} 拍你拍到了 ${quietHit.length} 下。它回来的那一下：${errs.map((v) => `**${offWords(v)}**`).join('、')}——${word}。没有它的时候你${driftWords(drift)}。`,
    };
  }
  if (kind === 'thin') {
    const dense = stddev(pts.filter(([k]) => k < 4).map((p) => p[1]));
    const sparse = stddev(pts.filter(([k]) => k >= 8).map((p) => p[1]));
    const stars = spread <= 35 ? 3 : spread <= 55 ? 2 : spread <= 90 ? 1 : 0;
    return {
      stars, drift: all.total,
      html: `每拍都有“嘀”时你前后晃 **±${Math.round(dense)} 毫秒**，一小节才一声时晃 **±${Math.round(sparse)} 毫秒**——${steadyWord(spread)}。漂移：${driftWords(all.total)}。`,
    };
  }
  const stars = spread <= 30 ? 3 : spread <= 50 ? 2 : spread <= 85 ? 1 : 0;
  const avg = mean(vals);
  return {
    stars, drift: all.total,
    html: `${vals.length} 下：平均**${offWords(avg)}**，前后晃 **±${Math.round(spread)} 毫秒**——${steadyWord(spread)}。漂移：${driftWords(all.total)}。${Math.abs(avg) > 45 && spread <= 50 ? '每一下偏得都差不多，说明你是稳的，多出来的是屏幕和鼠标的延迟。' : ''}`,
  };
}

/**
 * 只有节拍器，每拍拍一下。“玩一玩”里一招一招带着做（先跟上 → 越放越稀 → 消失再回来 → 反过来听），
 * 挑战：铜每拍都响、银放稀、金消失再回来。spec.move 可以指定只做哪一招。
 */
function metro(spec, env) {
  const bpm = spec.bpm || 92;
  const beat = 60 / bpm;
  const tier = env.tier || 0;
  const list = spec.move ? [spec.move] : tier ? [byTier(tier, ['every', 'thin', 'gone'])] : ['every', 'thin', 'gone', 'flip'];
  const RANGE = 160; // 偏差仪两头各是多少毫秒
  let mi = 0; // 现在是第几招
  let run = null; // 正在做的这一招：{ kind, plan, start（它的第 0 拍是全局第几拍）, offs, over }
  let sched = []; // 排进时钟的拍：{ g, t, k }
  let g = -1; // 排到了全局第几拍
  let shown = -1;
  let passed = 0; // 玩一玩里过了几招
  let result = null; // 最近一招的结果（走查用）
  let auto = false;
  const timers = new Set();
  const later = (fn, n) => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, n);
    timers.add(id);
  };

  const player = new LoopPlayer({ bpm });
  const head = h('div', { class: 'rh-move' });
  const line = h('div', { class: 'rh-line' });
  const meter = h('div', { class: 'cl-meter' }, h('i', { class: 'zone' }), h('i', { class: 'mid' }), h('span', { class: 'l' }, '早'), h('span', { class: 'r' }, '晚'));
  const count = h('div', { class: 'cl-count' });
  const say = h('div', { class: 'cl-note' }, '点「播放」。');
  let dots = [];

  const paintHead = () => {
    const m = MOVES[list[mi]];
    fill(head,
      list.length > 1 ? h('small', {}, mi ? `第 ${mi} 招` : '热身') : null,
      h('b', {}, m.name),
      h('span', { html: rich(m.how) }),
      list.length > 1 ? h('span', { class: 'rh-pips', 'aria-label': `一共 ${list.length} 段` }, list.map((_, i) => h('i', { class: i < passed ? 'on' : i === mi ? 'now' : '' }))) : null);
  };
  function buildLine(plan) {
    dots = plan.map((b) => h('i', { class: ['rh-b', b.s === 't' ? 't' : b.s === 'o' ? 'o' : 'q', b.back && 'back'] }, h('em')));
    const bars = [];
    for (let i = 0; i < dots.length; i += 4) bars.push(h('div', { class: 'rh-bar' }, dots.slice(i, i + 4)));
    line.classList.remove('shown');
    line.classList.toggle('long', plan.length > 20);
    line.replaceChildren(h('span', { class: 'rh-axis up' }, '早'), h('span', { class: 'rh-axis down' }, '晚'), ...bars);
  }
  const dot = (v, cls = '') => {
    const d = h('i', { class: `dot ${cls}`, style: { left: `${50 + (clamp(v, -RANGE, RANGE) / RANGE) * 50}%` } });
    meter.append(d);
    return d;
  };
  const clearDots = () => meter.querySelectorAll('.dot').forEach((d) => d.remove());
  /** 这一拍拍到了。reveal = 把偏了多少也摆出来（时间线上的点往上是早、往下是晚） */
  function mark(k, v, reveal) {
    const d = dots[k];
    if (!d) return;
    d.classList.add('hit');
    if (!reveal) return;
    d.classList.add(Math.abs(v) <= 35 ? 'good' : v < 0 ? 'early' : 'late');
    d.firstChild.style.setProperty('--dy', `${Math.round(clamp(v / 90, -1, 1) * 26)}px`); // 上下各 90 毫秒到头：比偏差仪放大一些，走势才看得出来
  }

  /** 排上这一招：从至少两拍以后的那个小节头开始，前面照常每拍一声（预备） */
  function arm() {
    const kind = list[mi];
    const plan = planOf(kind, spec.rounds || 2);
    run = { kind, plan, start: Math.ceil((g + 2) / 4) * 4, offs: [], over: false };
    result = null;
    buildLine(plan);
    clearDots();
    paintHead();
    count.textContent = `0 / ${plan.length}`;
    say.innerHTML = rich(player.playing ? '预备……下一小节开始。' : '点「播放」。先给你一小节预备。');
  }

  player.onSchedule = (step, t) => {
    const k4 = step % 4;
    if (k4 === 2 && run && !run.over) {
      const k = g - run.start;
      if (k >= 0 && k < run.plan.length && run.plan[k].s === 'o') audio.drum('HAT1', t, 0.85);
    }
    if (k4) return;
    g++;
    const k = run ? g - run.start : -1;
    const b = run && !run.over && k >= 0 && k < run.plan.length ? run.plan[k] : null;
    sched.push({ g, t, k: b ? k : -1 });
    if (sched.length > 48) sched.shift();
    // 预备的那几拍、两招之间：照常每拍一声。“反过来听”的预备也照常响，让人先找到拍子
    if (!b || b.s === 't') audio.click(t, step === 0);
    if (auto && run && !run.over && k >= -1 && k < run.plan.length) timers.add(pressAt(padCtl.el, t));
    if (run && !run.over && k === run.plan.length) later(finish, 0); // 最后一拍过去大半拍了：收
  };
  player.onStep((step) => {
    if (step < 0 || !audio.ctx) return; // 停下来的那一下（声音可能根本没起来过）
    const now = audio.heardNow();
    let cur = null;
    for (const s of sched) if (s.t <= now) cur = s;
    if (!cur || cur.g === shown) return;
    shown = cur.g;
    dots.forEach((d, i) => d.classList.toggle('now', i === cur.k && (tier === 0 || run?.plan[i].s !== '')));
    if (run && !run.over && cur.k < 0 && cur.g < run.start) say.innerHTML = rich(`预备……**${run.start - cur.g}**`);
    else if (run && !run.over && cur.k === 0) say.innerHTML = rich(run.kind === 'flip' ? '走！“嚓”在缝里，你拍“咚”。' : '走！');
  });

  function finish() {
    if (!run || run.over) return;
    run.over = true;
    const { kind, plan, offs } = run;
    const r = assess(kind, plan, offs);
    result = { kind, ...r, offs: [...offs] };
    dots.forEach((d) => d.classList.remove('now'));
    plan.forEach((_, k) => (offs[k] === undefined ? dots[k]?.classList.add('miss') : mark(k, offs[k], true)));
    line.classList.add('shown');
    clearDots();
    offs.forEach((v) => v !== undefined && dot(v, 'keep'));
    const btn = (text, fn, primary) => h('button', { class: ['btn', 'sm', primary && 'primary'], type: 'button', onclick: fn }, text);
    const again = () => {
      arm();
    };
    if (tier) {
      say.innerHTML = rich(r.stars ? r.html : `${r.html} 这一档还没过。`);
      say.append(' ', btn(r.stars ? '再来一次' : '再试一次', again));
      if (r.stars) {
        env.done(r.stars);
        sfx.play('star');
        confetti(meter, 16);
      } else sfx.play('nope');
      return;
    }
    // 玩一玩：做到了才给下一招
    if (!r.stars) {
      sfx.play('nope');
      say.innerHTML = rich(`${r.html} 这一招再来一次。`);
      say.append(' ', btn('再来一次', again, true));
      return;
    }
    sfx.play('ok');
    passed = Math.max(passed, mi + 1);
    paintHead();
    env.touched();
    const lastOne = mi >= list.length - 1;
    const tail = { every: '', thin: '“嘀”少了就开始晃、开始漂，说明刚才是你在跟着它走，心里的钟还没走起来。', gone: '没有它的时候还在点上，才是真的稳。', flip: '“咚”在你手上，“嚓”在它那儿：合起来就是咚-嚓。' }[kind];
    say.innerHTML = rich(`✓ ${r.html}${tail}`);
    if (lastOne) {
      confetti(meter, 18);
      say.append(' ', btn('从头再走一遍', () => {
        mi = 0;
        arm();
      }));
    } else {
      const go = btn(`下一招：${MOVES[list[mi + 1]].name} →`, () => {
        mi++;
        arm();
      }, true);
      say.append(' ', go, ' ', btn('这一招再来', again));
      pop(go);
    }
  }

  function onTap(perfMs) {
    const kind = list[mi];
    if (kind === 'flip') audio.drum('KICK', 0, 0.9); // 这一招你拍的是“咚”
    if (!player.playing || !sched.length) return (say.textContent = '先点「播放」，等“嘀”声出来。');
    const t = tapTime(perfMs);
    const near = sched.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));
    const v = ms(t - near.t);
    if (Math.abs(v) > beat * 1000 * 0.42) {
      if (tier === 0 || !run || run.over) say.textContent = '这一下落在两拍中间了，不算。';
      return;
    }
    if (!run || run.over || near.k < 0) {
      // 预备、两招之间：随便拍，只落个点看看
      if (tier === 0) {
        const d = dot(v);
        later(() => d.classList.add('old'), 30);
        later(() => d.remove(), 5200);
      }
      return;
    }
    if (run.offs[near.k] !== undefined) return;
    run.offs[near.k] = v;
    count.textContent = `${run.offs.filter((x) => x !== undefined).length} / ${run.plan.length}`;
    mark(near.k, v, tier === 0);
    if (tier === 0) {
      const d = dot(v);
      later(() => d.classList.add('old'), 30);
      later(() => d.remove(), 5200);
    }
  }

  const padCtl = tapPad('拍', onTap, env.live ? '或者按真机上任意一个 Synth key' : TOUCH ? '' : '也可以按空格键');
  const onKey = (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
    const k = e.key.toLowerCase();
    if (k !== ' ' && k !== 'j') return;
    if (k === ' ' && e.target?.closest?.('.cl-pad')) return; // 垫子自己拿着焦点时，空格归它管（tapPad），这里不重复算
    e.preventDefault();
    padCtl.el.classList.add('hit');
    setTimeout(() => padCtl.el.classList.remove('hit'), 90);
    onTap(e.timeStamp);
  };
  window.addEventListener('keydown', onKey);

  const playBtn = playButton(player, {
    onToggle(on) {
      g = -1;
      shown = -1;
      sched = [];
      if (on) {
        arm();
        padCtl.el.focus({ preventScroll: true }); // 接下来的空格归垫子，别让还拿着焦点的「播放」跟着动
      } else {
        if (run) run.over = true;
        dots.forEach((d) => d.classList.remove('now'));
        say.textContent = '停了。点「播放」从这一招重新来。';
      }
    },
  });
  paintHead();
  buildLine(planOf(list[0], spec.rounds || 2));
  const el = h('div', { class: ['cl-toy', 'rh-metro', tier && 'challenge'] },
    h('div', { class: 'cl-row' }, playBtn, h('span', { class: 'spacer' }), count),
    head, line, meter, padCtl.el, say);

  /** 开发用：把现在这一招拍完（按音频时钟去按垫子），返回结果 */
  async function autoMove() {
    auto = true;
    if (!player.playing) playBtn.click();
    else if (!run || run.over) arm();
    await until(() => result, (planOf(list[mi]).length + 12) * beat * 1000 + 4000, 100);
    auto = false;
    return result ? { kind: result.kind, stars: result.stars, drift: Math.round(result.drift || 0) } : { kind: list[mi], timeout: true };
  }
  shotLater((words) => {
    const kind = words.find((x) => MOVES[x] && list.includes(x));
    if (kind) mi = list.indexOf(kind);
    passed = mi;
    const plan = planOf(list[mi], spec.rounds || 2);
    run = { kind: list[mi], plan, start: 0, offs: [], over: false };
    buildLine(plan);
    paintHead();
    const whole = words.includes('result');
    const upto = whole ? plan.length : Math.floor(plan.length * 0.62);
    const fake = (k) => Math.round(Math.sin(k * 1.7) * 26 - 6 + (plan[k].s === '' ? ((k % 16) - 7) * 7 : 0)); // 静的那几拍越拍越快
    for (let k = 0; k < upto; k++) {
      if (k % 11 === 9) continue;
      run.offs[k] = fake(k);
      mark(k, fake(k), tier === 0);
      if (tier === 0) dot(fake(k));
    }
    count.textContent = `${run.offs.filter((x) => x !== undefined).length} / ${plan.length}`;
    if (whole) finish();
    else {
      dots[upto]?.classList.add('now');
      say.textContent = '走！';
    }
  });
  return {
    el,
    __auto: autoMove,
    async __autoPlay() {
      const out = [];
      for (let i = 0; i < list.length; i++) {
        out.push(await autoMove());
        const go = say.querySelector('.btn.primary');
        if (!go) break;
        go.click();
        await sleep(120);
      }
      return out;
    },
    destroy() {
      player.stop();
      padCtl.destroy();
      window.removeEventListener('keydown', onKey);
      timers.forEach(clearTimeout);
    },
  };
}

// ───────────── 两只手用的公用零件：两个键 / 一块垫子、一条 8 格的循环 ─────────────

// 只有鼠标的人一次只点得到一处：降级成“一块垫子 + 自动伴奏”。选了哪种记在这台设备上（不进学习进度）
const ONE_KEY = 'seqtrak.cl.onepad';
export const onePad = {
  get() {
    try {
      return localStorage.getItem(ONE_KEY) === '1';
    } catch {
      return false;
    }
  },
  set(v) {
    try {
      localStorage.setItem(ONE_KEY, v ? '1' : '0');
    } catch { /* 存不了就只管这一次 */ }
  },
};
/** 一块垫子版在金那一档过了：只给银牌，这句话交给页面说（env.done 的第二个参数） */
export const ONE_PAD_GOLD = ' 这是一块垫子版：金这一档它最多拿银牌。想要金牌，换回两个键。';
/** “两个键 / 一块垫子”的小开关 */
export function onePadSwitch(onChange) {
  const btn = h('button', { class: 'btn sm rh-onepad', type: 'button', 'data-sfx': 'tick' });
  let one = onePad.get();
  const paint = () => {
    btn.textContent = one ? `一块垫子版 · 换回${TOUCH ? '两块垫子' : '两个键'}` : '只用鼠标？换成一块垫子';
    btn.classList.toggle('on', one);
  };
  btn.addEventListener('click', () => {
    one = !one;
    onePad.set(one);
    paint();
    onChange(one);
  });
  paint();
  /** 开发用（截图）：只换按钮的样子，不记下来 */
  btn.show = (v) => {
    one = v;
    paint();
  };
  return btn;
}

/**
 * 两块垫子（左 F、右 J），或者只要右边那一块（一块垫子版：J 或空格）。onHit('L' | 'R', 按下那一刻的时间)。
 * 手指、鼠标、键盘都行；接着真机时 fromMidi(msg) 说这一声算哪只手（不算就返回 null）。
 */
function handPads({ L, R, one = false, onHit, fromMidi }) {
  const tags = {};
  const make = (id, def, key) => {
    const tag = (tags[id] = h('em', { class: 'cl-pad-tag', 'aria-hidden': 'true' }));
    const el = h('button', { class: ['cl-pad', 'rh-pad', `rh-${id}`], type: 'button', 'data-sfx': 'none', 'data-keys': 'own' },
      h('b', {}, def.label), h('span', {}, def.sub, !TOUCH && h('kbd', { class: 'pc' }, key)), tag);
    const hit = (perfMs, src) => {
      el.classList.add('hit');
      setTimeout(() => el.classList.remove('hit'), 90);
      onHit(id, perfMs, src);
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      hit(e.timeStamp, e.pointerType || 'mouse');
    });
    el.addEventListener('keydown', (e) => (e.key === ' ' || e.key === 'Enter') && e.preventDefault()); // 垫子拿着焦点时，空格 / 回车由下面那一个监听管
    return { el, hit };
  };
  const pads = { R: make('R', R, 'J') };
  if (!one) pads.L = make('L', L, 'F');
  const onKey = (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
    const k = e.key.toLowerCase();
    const id = k === 'j' || (one && k === ' ') ? 'R' : k === 'f' && !one ? 'L' : null;
    if (!id) return;
    e.preventDefault();
    pads[id].hit(e.timeStamp, 'key');
  };
  window.addEventListener('keydown', onKey);
  const offMidi = fromMidi ? midiOn((m) => {
    const id = fromMidi(m);
    if (id && pads[id]) pads[id].hit(m.time ?? performance.now(), 'midi');
  }) : () => {};
  const timers = {};
  return {
    el: h('div', { class: ['rh-pads', one && 'one'] }, pads.L?.el, pads.R.el),
    pads,
    /** 垫子右上角闪一下判定：tone = ok / warn / bad */
    flash(id, text, tone, keep = false) {
      const tag = tags[id];
      if (!tag) return;
      tag.textContent = text;
      tag.dataset.tone = tone;
      tag.classList.add('on');
      clearTimeout(timers[id]);
      if (!keep) timers[id] = setTimeout(() => tag.classList.remove('on'), 620);
    },
    destroy() {
      window.removeEventListener('keydown', onKey);
      offMidi();
      Object.values(timers).forEach(clearTimeout);
    },
  };
}
const midiOn = (fn) => midi.on('noteon', fn);

/**
 * 一条 8 格（八分音符）的循环，一直转。只管三件事：到了哪一格（onCell：在这里按精确时间排声音）、
 * 一下敲在哪一格上算不算数（tap）、过了的格漏没漏（onSettle）。要打哪几格由 want(全局第几格, 哪只手) 说。
 */
function gridRunner({ bpm, onCell, want, hands = ['L', 'R'], onSettle, onHead }) {
  const player = new LoopPlayer({ bpm });
  const d = 60 / bpm / 2;
  const WIN = Math.min(0.115, d * 0.42) * 1000;
  let n = -1;
  let sched = [];
  let settled = -1;
  let shown = -1;
  const marks = new Map();
  const key = (m, hd) => `${m}${hd}`;
  player.onSchedule = (step, t) => {
    if (step % 2) return;
    n++;
    sched.push({ n, c: n % 8, t });
    if (sched.length > 40) sched.shift();
    onCell?.(n, n % 8, t);
    // 两格以前的那些：敲它的窗口早过了，没敲的算漏
    for (let m = settled + 1; m <= n - 2; m++) {
      for (const hd of hands) {
        if (want(m, hd) && !marks.get(key(m, hd))) {
          marks.set(key(m, hd), 'miss');
          onSettle?.(m, hd, 'miss');
        }
      }
      settled = m;
    }
    if (marks.size > 400) for (const k of marks.keys()) if (parseInt(k, 10) < n - 80) marks.delete(k);
  };
  player.onStep((step) => {
    if (step < 0 || !audio.ctx) return; // 停下来的那一下（声音可能根本没起来过）
    const now = audio.heardNow();
    let cur = null;
    for (const s of sched) if (s.t <= now) cur = s;
    if (!cur || cur.n === shown) return;
    shown = cur.n;
    onHead?.(cur.n, cur.c);
  });
  return {
    player, d,
    get n() {
      return n;
    },
    reset() {
      n = -1;
      sched = [];
      settled = -1;
      shown = -1;
      marks.clear();
    },
    mark: (m, hd) => marks.get(key(m, hd)),
    set: (m, hd, v) => marks.set(key(m, hd), v),
    /** 一下敲击 → { result: 'idle' 没在放 | 'far' 不在格上 | 'ok' | 'wrong' 这一格不该这只手 | 'dup' 这一格记过了, v 偏了多少毫秒, n, c } */
    tap(hand, perfMs) {
      if (!player.playing || !sched.length) return { result: 'idle' };
      const t = tapTime(perfMs);
      const near = sched.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));
      const v = ms(t - near.t);
      const out = { v, n: near.n, c: near.c };
      if (Math.abs(v) > WIN) return { ...out, result: 'far' };
      if (!want(near.n, hand)) return { ...out, result: 'wrong' };
      if (marks.get(key(near.n, hand))) return { ...out, result: 'dup' };
      marks.set(key(near.n, hand), 'ok');
      onSettle?.(near.n, hand, 'ok', v);
      return { ...out, result: 'ok' };
    },
  };
}

const CELL_NAMES = ['1', '&', '2', '&', '3', '&', '4', '&'];
const shiftSet = (base, by) => base.map((c) => (c + by) % 8).sort((a, b) => a - b);
const sameSet = (set, arr) => set.size === arr.length && arr.every((c) => set.has(c));
const cellList = (arr) => arr.map((c) => `第 **${c + 1}**`).join('、') + ' 格';
const timingTag = (v) => (Math.abs(v) <= 35 ? ['准 !', 'ok'] : v < 0 ? [`早 ${Math.abs(v)}`, 'warn'] : [`晚 ${v}`, 'warn']);

// ───────────── R9 重音挪一挪 ─────────────

// “玩一玩”的几小段：先听平的 → 放两个重音 → 整体挪一格 → 自己打
const ACCENT_PLAY = [
  { type: 'listen', acc: [], title: '先听平的', how: '点「播放」。8 下镲一样轻，底鼓替你踩着拍子。', after: '8 下一模一样：平平的，像打字机。' },
  { type: 'place', target: [0, 4], title: '放两个重音', how: '点**第 1 格**和**第 5 格**（上面有小三角的）：那两下变重。', after: '有了轻有了重，它就不平了。' },
  { type: 'place', target: [1, 5], title: '挪一格', how: '把两个重音都**往后挪一格**：拖过去，或者点成第 2、第 6 格。', after: '还是 8 下镲，格子一个没动。重的换了个地方，味道全变了。' },
  { type: 'drill', loops: 2, pass: 0.6, title: '你来打', how: '跟着格子打两遍。', after: '轻的轻、重的重，手上就有律动了。' },
];
// 挑战每一档从哪几格起（之后每条整体往后挪一格）、一共几条：铜是“每拍都重 → 全挪进缝里”，银两个重音，金三个（三、三、二）
const ACCENT_TIERS = [{ base: [0, 2, 4, 6], count: 2 }, { base: [0, 4], count: 3 }, { base: [0, 3, 6], count: 3 }];

/**
 * 一排 8 格镲，一个键轻（F）、一个键重（J），底鼓自动。先在格子上把重音摆到指定的格，再跟着打出来，每条打 4 遍。
 * 一块垫子版：轻的那些自动放，你只打重音。spec.base / spec.count / spec.loops 可以改每一档的图案。
 */
function accents(spec, env) {
  const tier = env.tier || 0;
  const bpm = Math.round((spec.bpm || 92) * (tier === 1 ? 0.85 : 1));
  const PASS = byTier(tier, [0.6, 0.72, 0.85]);
  const guide = tier < 3; // 金：没有示范的镲，开打以后重音记号也藏起来
  let one = onePad.get();
  const segs = [];
  if (tier) {
    const rule = { ...byTier(tier, ACCENT_TIERS), ...(spec.base ? { base: spec.base } : {}), ...(spec.count ? { count: spec.count } : {}) };
    for (let i = 0; i < rule.count; i++) {
      const target = shiftSet(rule.base, i);
      segs.push({ type: 'place', target, item: i, title: i ? '挪一格' : '摆重音', how: i ? '把重音**整体往后挪一格**（拖过去，或者一个一个点）。' : `把重音放到${cellList(target)}。` });
      segs.push({ type: 'drill', loops: spec.loops || 4, pass: PASS, item: i, title: '打出来' });
    }
  } else segs.push(...ACCENT_PLAY);
  const ITEMS = segs.filter((s) => s.type === 'drill').length;

  let si = 0;
  let acc = new Set(segs[0].acc || []);
  let run = null; // 正在打的这一条：{ start, len, ok, bad, miss, extra, combo, over }
  let listenFrom = -1;
  let touches = 0;
  let stars = [];
  let result = null;
  let auto = false;
  let lift = null; // 正拎着哪一格的重音
  const timers = new Set();
  const later = (fn, n = 0) => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, n);
    timers.add(id);
  };
  const seg = () => segs[si];
  const placing = () => seg().type === 'place' && !seg().done;
  const touched = (toThree) => {
    do {
      touches++;
      env.touched();
    } while (toThree && touches < 3);
  };

  const head = h('div', { class: 'rh-move' });
  const hud = h('div', { class: 'cl-count rh-hud' });
  const say = h('div', { class: 'cl-note' });
  const cells = CELL_NAMES.map((name, c) => h('button', { class: ['rh-cell', c % 2 === 0 && 'beat'], type: 'button', 'data-sfx': 'none', 'aria-label': `第 ${c + 1} 格` },
    h('em', { class: 'rh-aim', 'aria-hidden': 'true' }), h('i', { class: 'rh-vel' }), h('u'), h('span', {}, name), h('small', {}, String(c + 1))));
  const grid = h('div', { class: 'rh-cells' }, cells);

  const runner = gridRunner({
    bpm,
    want: (n, hd) => !!run && !run.over && n >= run.start && n < run.start + run.len && (hd === 'R' ? acc.has(n % 8) : !one && !acc.has(n % 8)),
    onCell(n, c, t) {
      if (c % 2 === 0) audio.drum('KICK', t, 0.8);
      const live = run && !run.over;
      const inDrill = live && n >= run.start && n < run.start + run.len;
      const loud = acc.has(c);
      if (live && n < run.start && c % 2 === 0) audio.click(t, c === 0); // 预备的那一小节：嘀四下
      if (!live) audio.drum('HAT1', t, loud ? 1.1 : 0.3); // 听、摆的时候：照格子上的样子放
      else if (inDrill && one && !loud) audio.drum('HAT1', t, 0.3); // 一块垫子版：轻的自动
      else if (inDrill && guide) audio.drum('HAT1', t, loud ? 0.42 : one ? 0 : 0.13); // 示范音小声陪着
      if (auto && inDrill && (loud || !one)) timers.add(pressAt(pads.pads[loud ? 'R' : 'L'].el, t));
      if (live && n === run.start + run.len + 1) later(finishDrill);
      if (!live && seg().type === 'listen' && !seg().done) {
        if (listenFrom < 0 && c === 0) listenFrom = n;
        else if (listenFrom >= 0 && n >= listenFrom + 8) later(() => pass(seg().after));
      }
    },
    onSettle(n, hd, r) {
      if (!run || run.over) return;
      if (r === 'ok') {
        run.ok++;
        run.combo++;
        run.best = Math.max(run.best, run.combo);
      } else {
        run.miss++;
        run.combo = 0;
      }
      flag(n % 8, r);
      paintHud();
    },
    onHead(n, c) {
      cells.forEach((cell, i) => cell.classList.toggle('now', i === c));
      if (!run || run.over) return;
      if (n < run.start) say.innerHTML = rich(`预备……**${Math.ceil((run.start - n) / 2)}**`);
      else if (n === run.start) say.textContent = '走！';
      if (n >= run.start && c === 0) paintHud();
    },
  });
  /** 这一格判完了：在格子上闪一下（对了 / 轻重反了 / 漏了） */
  function flag(c, r) {
    cells[c].dataset.r = r;
    later(() => cells[c].dataset.r === r && delete cells[c].dataset.r, 520);
  }

  function paintHead() {
    const s = seg();
    const how = s.type === 'drill' ? (one ? '轻的镲自动走。**重的那几下**你来打，其余别碰。' : '**轻**的格打左边，**重**的格打右边。') + (s.how || `打 ${s.loops} 遍。`) : s.how;
    head.replaceChildren(
      h('small', {}, tier ? `第 ${s.item + 1} / ${ITEMS} 条` : `第 ${si + 1} / ${segs.length} 步`),
      h('b', {}, s.title), h('span', { html: rich(how) }));
  }
  function paint() {
    const s = seg();
    const aim = s.type === 'place' && !s.done && (tier < 3 || s.item === 0) ? s.target : null;
    const hide = tier === 3 && run && !run.over; // 金：开打以后不给看重音在哪
    grid.classList.toggle('editing', placing());
    grid.classList.toggle('blind', !!hide);
    cells.forEach((cell, c) => {
      cell.classList.toggle('loud', acc.has(c));
      cell.classList.toggle('aim', !!aim?.includes(c));
      cell.classList.toggle('lift', lift === c);
    });
  }
  function paintHud() {
    if (!run) return (hud.textContent = '');
    const lap = Math.min(seg().loops, Math.max(1, Math.floor((runner.n - run.start) / 8) + 1));
    fill(hud, runner.n >= run.start ? `第 ${lap} / ${seg().loops} 遍` : '预备', run.combo >= 2 ? h('b', {}, `×${run.combo}`) : null);
  }
  const btn = (text, fn, primary) => h('button', { class: ['btn', 'sm', primary && 'primary'], type: 'button', onclick: fn }, text);

  function enter(i) {
    si = i;
    run = null;
    result = null;
    listenFrom = -1;
    const s = seg();
    s.done = false;
    if (s.acc) acc = new Set(s.acc);
    cells.forEach((cell) => delete cell.dataset.r);
    paintHead();
    paint();
    paintHud();
    if (s.type === 'drill') say.innerHTML = rich(`准备好了点「开打」：先给你一小节预备。${one || TOUCH ? '' : '左手 〔F〕 = 轻，右手 〔J〕 = 重。'}`), say.append(' ', btn('开打 ▶', arm, true));
    else if (s.type === 'place') say.textContent = sameSet(acc, s.target) ? '' : player.playing ? '点格子：轻的变重，重的变轻。重的也可以直接拖走。' : '点格子摆重音。想边听边摆，点「播放」。';
    else say.textContent = player.playing ? '听一小节。' : '点「播放」。';
    if (s.type === 'place') checkPlaced();
  }
  /** 这一小段做到了 */
  function pass(text) {
    const s = seg();
    if (s.done) return;
    s.done = true;
    paint();
    sfx.play('ok');
    const lastOne = si >= segs.length - 1;
    if (!tier) touched(lastOne);
    say.innerHTML = rich(`✓ ${text || ''}`);
    if (lastOne) return;
    const nx = segs[si + 1];
    const go = btn(nx.type === 'drill' ? '下一步：打出来 →' : `下一步：${nx.title} →`, () => enter(si + 1), true);
    say.append(' ', go);
    pop(go);
  }
  function checkPlaced() {
    const s = seg();
    if (s.type !== 'place' || s.done || !sameSet(acc, s.target)) return;
    pass(s.after || `摆好了：重音在${cellList(s.target).replace(/\*\*/g, '')}。`);
  }

  /** 开打：从下一个小节头开始（没在放就先放起来，第一小节当预备） */
  function arm() {
    const s = seg();
    if (s.type !== 'drill') return;
    result = null;
    cells.forEach((cell) => delete cell.dataset.r);
    const start = () => {
      run = { start: Math.ceil((runner.n + 4) / 8) * 8, len: 8 * s.loops, ok: 0, miss: 0, bad: 0, extra: 0, combo: 0, best: 0, over: false };
      paint();
      paintHud();
      say.textContent = '预备……';
    };
    if (player.playing) start();
    else {
      playBtn.click();
      start();
    }
  }
  function finishDrill() {
    if (!run || run.over) return;
    run.over = true;
    const s = seg();
    const total = (one ? acc.size : 8) * s.loops;
    const rate = total ? run.ok / total : 0;
    const got = rate >= s.pass ? (rate >= 0.92 ? 3 : rate >= s.pass + 0.08 ? 2 : 1) : 0;
    result = { rate: Math.round(rate * 100), stars: got, ok: run.ok, total, bad: run.bad, miss: run.miss };
    paint();
    hud.textContent = '';
    const words = `${total} 下打对 **${run.ok}** 下（${result.rate}%）${run.bad ? `，轻重反了 ${run.bad} 下` : ''}${run.miss - run.bad > 0 ? `，漏了 ${run.miss - run.bad} 下` : ''}${run.extra ? `，多敲了 ${run.extra} 下` : ''}。`;
    if (!got) {
      sfx.play('nope');
      say.innerHTML = rich(`${words}这一条要 ${Math.round(s.pass * 100)}%。${run.bad > run.miss - run.bad ? '盯着格子：高的打重，矮的打轻。' : '别急，一格一下。'}`);
      say.append(' ', btn('这一条再来', arm, true));
      return;
    }
    if (!tier) {
      // 玩一玩：过了就点亮；已经过了再打，只报这一次的数
      if (s.done) say.innerHTML = rich(`✓ ${words}`);
      else pass(`${words}${s.after || ''}`);
      say.append(' ', btn('再打一次', arm));
      return;
    }
    stars[s.item] = Math.max(stars[s.item] || 0, got);
    s.done = true;
    if (si < segs.length - 1) {
      sfx.play('ok');
      say.innerHTML = rich(`✓ ${words}最高连对 ${run.best} 下。`);
      const go = btn('下一条：重音挪一格 →', () => enter(si + 1), true);
      say.append(' ', go, ' ', btn('这一条再来', arm));
      pop(go);
      return;
    }
    const perf = Math.min(...stars.filter(Boolean));
    const capped = tier === 3 && one ? Math.min(perf, 1) : perf; // 一块垫子版只打了一半的活：金那一档最多给到银
    sfx.play('star');
    confetti(grid, 20);
    say.innerHTML = rich(`✓ ${words}${ITEMS} 条都打下来了。${tier === 3 && one ? '一块垫子版在金这一档最多拿银牌：两个键才是全套。' : ''}`);
    say.append(' ', btn('再玩一轮', () => {
      stars = [];
      acc = new Set();
      enter(0);
    }));
    if (tier === 3 && one) env.done(capped, ONE_PAD_GOLD);
    else env.done(capped);
  }

  function onHit(id, perfMs, src) {
    const heavy = id === 'R';
    if (src !== 'midi') audio.drum('HAT1', 0, heavy ? 1.15 : 0.32);
    if (!run || run.over) return;
    const r = runner.tap(id, perfMs);
    if (r.result === 'ok') pads.flash(id, ...timingTag(r.v));
    else if (r.result === 'wrong' && r.n >= run.start && r.n < run.start + run.len) {
      // 这一格要的是另一只手：轻重反了。这一格就算丢了，不能补
      const other = heavy ? 'L' : 'R';
      if (!one && !runner.mark(r.n, other)) {
        runner.set(r.n, other, 'swap');
        run.bad++;
        run.miss++;
        run.combo = 0;
        flag(r.c, 'swap');
        paintHud();
      } else if (one) run.extra++;
      pads.flash(id, one ? '这格是轻的' : heavy ? '这格要轻' : '这格要重', 'bad');
    } else if (r.result === 'far' && r.n >= run.start && r.n < run.start + run.len) {
      run.extra++;
      pads.flash(id, '不在格上', 'bad');
    }
  }

  // 摆重音：点轻的格 = 变重；按住重的格拖到别的格 = 挪过去，原地松手 = 变轻
  const cellAt = (e) => {
    const node = e.clientX || e.clientY ? document.elementFromPoint(e.clientX, e.clientY) : e.target;
    const cell = node?.closest?.('.rh-cell');
    return cell ? cells.indexOf(cell) : -1;
  };
  const changed = () => {
    sfx.play('on');
    paint();
    if (seg().type === 'place' && !seg().done) say.textContent = '';
    checkPlaced();
  };
  cells.forEach((cell, c) => cell.addEventListener('pointerdown', (e) => {
    if (!placing() || e.button > 0) return;
    e.preventDefault();
    if (acc.has(c)) lift = c;
    else {
      acc.add(c);
      changed();
    }
    paint();
  }));
  const onUp = (e) => {
    if (lift === null) return;
    const from = lift;
    const to = cellAt(e);
    lift = null;
    acc.delete(from);
    if (to >= 0 && to !== from) acc.add(to);
    changed();
  };
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  let pads = null;
  const padHost = h('div', { class: 'rh-padhost' });
  function buildPads() {
    pads?.destroy();
    pads = handPads({
      one, onHit,
      L: { label: '轻', sub: '左手 ' },
      R: { label: '重', sub: one ? '只打重音 ' : '右手 ' },
      // 接着真机：HAT 2 的键算“重”，别的鼓键、琴键都算“轻”（没在真机上试过）
      fromMidi: env.live ? (m) => (one || m.ch === TRACK.HAT2.ch ? 'R' : 'L') : null,
    });
    padHost.replaceChildren(pads.el);
  }
  const player = runner.player;
  const playBtn = playButton(player, {
    onToggle(on) {
      runner.reset();
      listenFrom = -1;
      if (on) pads.pads.R.el.focus({ preventScroll: true });
      if (!on) {
        cells.forEach((cell) => cell.classList.remove('now'));
        if (run && !run.over) {
          run = null;
          paint();
          paintHud();
          say.textContent = '停了。';
          say.append(' ', btn('开打 ▶', arm, true));
        }
      } else if (seg().type === 'listen' && !seg().done) say.textContent = '听一小节。';
    },
  });
  const sw = onePadSwitch((v) => {
    one = v;
    if (run && !run.over) run = null;
    buildPads();
    enter(si);
  });
  buildPads();
  const el = h('div', { class: ['cl-toy', 'rh-accents', tier && 'challenge'] },
    h('div', { class: 'cl-row' }, playBtn, sw, h('span', { class: 'spacer' }), hud),
    head,
    h('div', { class: 'cl-cap' }, '一小节 8 格镲：柱子高的是重，矮的是轻。下面那排小点是自动的底鼓'),
    grid, padHost, say);
  enter(0);

  /** 开发用：把现在这一小段做掉 */
  async function autoSeg() {
    const s = seg();
    if (s.type === 'listen') {
      if (!player.playing) playBtn.click();
      await until(() => s.done, 12000, 80);
    } else if (s.type === 'place') {
      for (const c of [...acc].filter((x) => !s.target.includes(x))) {
        cells[c].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
        cells[c].dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
      }
      for (const c of s.target.filter((x) => !acc.has(x))) cells[c].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
      await until(() => s.done, 2000, 40);
    } else {
      auto = true;
      arm();
      await until(() => result, (8 * s.loops + 24) * runner.d * 1000 + 4000, 100);
      auto = false;
    }
    return { type: s.type, done: !!s.done, ...(result || {}) };
  }
  async function autoAll() {
    const out = [];
    for (let guard = 0; guard < segs.length + 2; guard++) {
      out.push(await autoSeg());
      const go = say.querySelector('.btn.primary');
      if (si >= segs.length - 1 || !go || !seg().done) break;
      go.click();
      await sleep(120);
    }
    return out;
  }
  shotLater((words) => {
    if (words.includes('one')) {
      one = true;
      sw.show(true);
      buildPads();
      enter(si);
    }
    const at = shotSeg(words);
    if (at >= 0 && at < segs.length) {
      for (let i = 0; i < at; i++) if (segs[i].target) acc = new Set(segs[i].target);
      enter(at);
    }
    if (!words.includes('mid') && !words.includes('result')) return;
    const i = segs.findIndex((s, j) => j >= si && s.type === 'drill');
    acc = new Set(segs[i - 1]?.target || [1, 5]);
    enter(i);
    run = { start: 0, len: 8 * seg().loops, ok: 13, miss: 2, bad: 1, extra: 0, combo: 6, best: 9, over: false };
    if (words.includes('result')) {
      run.ok = Math.round((one ? acc.size : 8) * seg().loops * 0.88);
      return finishDrill();
    }
    paint();
    hud.replaceChildren(`第 2 / ${seg().loops} 遍`, h('b', {}, '×6'));
    cells[3].classList.add('now');
    cells[0].dataset.r = 'ok';
    cells[1].dataset.r = 'swap';
    cells[2].dataset.r = 'ok';
    pads.flash('R', '晚 22', 'warn', true);
    say.textContent = '走！';
  });
  return {
    el,
    __auto: autoAll,
    __autoPlay: autoAll,
    destroy() {
      player.stop();
      pads.destroy();
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      timers.forEach(clearTimeout);
    },
  };
}

// ───────────── R7 两只手（热身）：一只手不动，一只手在挪 ─────────────

const FIXED = [0, 2, 4, 6]; // 左手：每拍一下，从头到尾不变
const HANDS_PLAY = [
  { shift: null, title: '左手先走', how: '点「播放」。左手每拍一下“咚”，跟着上面那排格子拍。', oneHow: '点「播放」。这一版左手交给机器：听它每拍一下“咚”，稳稳的。', after: '左手就这么一直走，后面不再变了。' },
  { shift: 0, title: '右手加进来', how: '左手别停。右手在**第 1、第 5 格**加一下“啪”：和左手同时落下。', oneHow: '右手在**第 1、第 5 格**拍一下“啪”：和“咚”同时落下。', after: '两只手一起落：最容易的一种。' },
  { shift: 1, title: '右手挪一格', how: '左手照旧，**一下都别变**。右手那一下往后挪一格，落进两下“咚”的缝里。', oneHow: '“咚”照旧。右手那一下往后挪一格，落进两下“咚”的缝里。', after: '右手一挪，左手最容易跟着乱：它没乱，才算真的分开了。' },
  { shift: 2, title: '再挪一格', how: '左手照旧。右手再往后一格：落在**第 2、第 4 拍**上。', oneHow: '“咚”照旧。右手再往后一格：落在**第 2、第 4 拍**上。', after: '咚-啪-咚-啪：这一条你一定听过。' },
];

/**
 * 两块垫子：左手“咚”（F）每拍一下不变，右手“啪”（J）那一下每一段往后挪一格（一格 = 半拍）。一直循环，连着两小节都对了就算做到。
 * 一块垫子版：左手交给机器，只打右手。
 */
function handshift(spec, env) {
  const bpm = spec.bpm || 88;
  let one = onePad.get();
  const segs = HANDS_PLAY.map((s) => ({ ...s }));
  let si = 0;
  let from = 0; // 这一段从全局第几格开始算（一个小节头）
  let streak = 0;
  let touches = 0;
  let auto = false;
  const bars = new Map(); // 第几小节 → { L, R, wrong }
  const timers = new Set();
  const later = (fn, n = 0) => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, n);
    timers.add(id);
  };
  const seg = () => segs[si];
  const moving = () => (seg().shift === null ? [] : shiftSet([0, 4], seg().shift));
  const stat = (b) => bars.get(b) || bars.set(b, { L: 0, R: 0, wrong: 0 }).get(b);
  const NEED = () => (one && seg().shift === null ? 1 : 2);

  const head = h('div', { class: 'rh-move' });
  const hud = h('div', { class: 'cl-count rh-hud' });
  const say = h('div', { class: 'cl-note' }, '点「播放」。');
  const makeRow = (id) => {
    const cs = CELL_NAMES.map((_, c) => h('i', { class: ['rh-sq', c % 2 === 0 && 'beat'] }, h('u')));
    const name = h('span', { class: 'rh-rowname' });
    return { cs, name, el: h('div', { class: ['rh-row', `rh-row${id}`] }, name, h('div', { class: 'rh-sqs' }, cs)) };
  };
  const rows = { L: makeRow('L'), R: makeRow('R') };
  const names = h('div', { class: 'rh-row rh-names' }, h('span', { class: 'rh-rowname' }), h('div', { class: 'rh-sqs' }, CELL_NAMES.map((nm, c) => h('b', { class: c % 2 === 0 ? 'beat' : '' }, nm))));
  const flag = (hd, c, r) => {
    const cell = rows[hd].cs[c];
    cell.dataset.r = r;
    later(() => cell.dataset.r === r && delete cell.dataset.r, 480);
  };

  const runner = gridRunner({
    bpm,
    want: (n, hd) => n >= from && (hd === 'L' ? !one && FIXED.includes(n % 8) : moving().includes(n % 8)),
    onCell(n, c, t) {
      const fix = FIXED.includes(c);
      const mov = moving().includes(c);
      if (fix) audio.drum('KICK', t, one ? 0.85 : 0.3); // 两个键：示范音小声陪着；一块垫子版：左手是机器在打
      if (mov) audio.drum('SNARE', t, 0.3);
      if (auto && n >= from) {
        if (fix && !one) timers.add(pressAt(pads.pads.L.el, t));
        if (mov) timers.add(pressAt(pads.pads.R.el, t));
      }
      if (c === 2 && n >= from + 10) later(() => judgeBar(Math.floor(n / 8) - 1));
    },
    onSettle(n, hd, r) {
      if (r === 'ok') stat(Math.floor(n / 8))[hd]++;
      flag(hd, n % 8, r);
    },
    onHead(n, c) {
      for (const r of Object.values(rows)) r.cs.forEach((cell, i) => cell.classList.toggle('now', i === c));
    },
  });

  /** 刚过去的那一小节打得怎么样：连着两小节都对，这一段就做到了 */
  function judgeBar(b) {
    const s = seg();
    if (s.done) return;
    const st = stat(b);
    const needR = moving().length;
    const good = (one || st.L >= 3) && st.R === needR && st.wrong <= 1;
    streak = good ? streak + 1 : 0;
    paintHud();
    if (streak >= NEED()) return pass();
    if (!good && !one && st.L < 3 && st.R === needR && needR) say.textContent = '右手对了，左手掉了几下：左手每拍一下，别跟着右手跑。';
    else if (!good && needR && st.R < needR) say.textContent = one ? '右手那一下还没对上：看下面那排亮着的格。' : '右手那一下还没对上。左手让它自己走，眼睛只盯下面那排。';
  }
  const paintHud = () => (hud.textContent = seg().done ? '' : `稳住 ${Math.min(streak, NEED())} / ${NEED()} 小节`);
  function paintHead() {
    const s = seg();
    head.replaceChildren(h('small', {}, `第 ${si + 1} / ${segs.length} 步`), h('b', {}, s.title), h('span', { html: rich((one && s.oneHow) || s.how) }));
  }
  function paint() {
    const mov = moving();
    rows.L.cs.forEach((cell, c) => cell.classList.toggle('on', FIXED.includes(c)));
    rows.R.cs.forEach((cell, c) => cell.classList.toggle('on', mov.includes(c)));
    rows.L.name.replaceChildren(h('b', {}, '左手 · 咚'), one ? '机器替你打' : TOUCH ? '每拍一下，不变' : h('kbd', { class: 'pc' }, 'F'));
    rows.R.name.replaceChildren(h('b', {}, '右手 · 啪'), TOUCH ? '这一只在挪' : h('kbd', { class: 'pc' }, 'J'));
  }
  const btn = (text, fn, primary) => h('button', { class: ['btn', 'sm', primary && 'primary'], type: 'button', onclick: fn }, text);

  function enter(i) {
    si = i;
    seg().done = false;
    streak = 0;
    bars.clear();
    from = Math.ceil((runner.n + 2) / 8) * 8;
    paintHead();
    paint();
    paintHud();
    say.textContent = player.playing ? (seg().shift === null ? '跟上。' : '下一小节开始算。') : '点「播放」。';
  }
  function pass() {
    const s = seg();
    if (s.done) return;
    s.done = true;
    const lastOne = si >= segs.length - 1;
    sfx.play(lastOne ? 'star' : 'ok');
    touches++;
    env.touched();
    while (lastOne && touches < 3) {
      touches++;
      env.touched();
    }
    paintHud();
    say.innerHTML = rich(`✓ 做到了。${s.after}`);
    if (lastOne) {
      confetti(pads.el, 18);
      say.append(' ', btn('从头再来一遍', () => enter(0)));
      return;
    }
    const go = btn(`下一步：${segs[si + 1].title} →`, () => enter(si + 1), true);
    say.append(' ', go);
    pop(go);
  }

  function onHit(id, perfMs, src) {
    if (src !== 'midi') audio.drum(id === 'L' ? 'KICK' : 'SNARE', 0, 0.9);
    const r = runner.tap(id, perfMs);
    if (r.result === 'idle') return (say.textContent = '先点「播放」。');
    if (r.n < from) return;
    if (r.result === 'ok') pads.flash(id, ...timingTag(r.v));
    else if (r.result === 'wrong') {
      stat(Math.floor(r.n / 8)).wrong++;
      const others = id === 'L' ? moving().includes(r.c) : FIXED.includes(r.c);
      pads.flash(id, others && !one ? '串手了' : '这格歇着', 'bad');
    } else if (r.result === 'far') pads.flash(id, '不在格上', 'bad');
  }

  let pads = null;
  const padHost = h('div', { class: 'rh-padhost' });
  function buildPads() {
    pads?.destroy();
    pads = handPads({
      one, onHit,
      L: { label: '咚', sub: '左手 · 底鼓 ' },
      R: { label: '啪', sub: '右手 · 军鼓 ' },
      fromMidi: env.live ? (m) => (m.ch === TRACK.KICK.ch ? 'L' : m.ch === TRACK.SNARE.ch ? 'R' : null) : null,
    });
    padHost.replaceChildren(pads.el);
  }
  const player = runner.player;
  const playBtn = playButton(player, {
    onToggle(on) {
      runner.reset();
      bars.clear();
      streak = 0;
      from = 8; // 第一小节先听着找拍子
      if (on) pads.pads.R.el.focus({ preventScroll: true });
      paintHud();
      if (!on) for (const r of Object.values(rows)) r.cs.forEach((cell) => cell.classList.remove('now'));
      say.textContent = on ? '第一小节先听，第二小节开始算。' : '停了。点「播放」接着来。';
    },
  });
  const sw = onePadSwitch((v) => {
    one = v;
    buildPads();
    enter(si);
  });
  buildPads();
  const el = h('div', { class: 'cl-toy rh-hands' },
    h('div', { class: 'cl-row' }, playBtn, sw, h('span', { class: 'spacer' }), hud),
    head,
    h('div', { class: 'rh-grid2' }, rows.L.el, rows.R.el, names),
    padHost, say);
  enter(0);
  shotLater((words) => {
    if (words.includes('one')) {
      one = true;
      sw.show(true);
      buildPads();
    }
    enter(Math.max(0, Math.min(segs.length - 1, shotSeg(words))));
    if (!words.includes('mid')) return;
    streak = 1;
    paintHud();
    for (const r of Object.values(rows)) r.cs[3].classList.add('now');
    rows.L.cs[0].dataset.r = 'ok';
    rows.L.cs[2].dataset.r = 'ok';
    rows.R.cs[1].dataset.r = 'ok';
    pads.flash('R', '准 !', 'ok', true);
    say.textContent = '右手那一下还没对上。左手让它自己走，眼睛只盯下面那排。';
  });

  return {
    el,
    async __autoPlay() {
      const out = [];
      auto = true;
      if (!player.playing) playBtn.click();
      for (let i = si; i < segs.length; i++) {
        const ok = await until(() => seg().done, 22000, 100);
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

// ───────────── R2 数出来：“只念开头”的读法 ─────────────

const SAY = ['', 'e', '&', 'a'];
const cleanP = (p) => [...String(p || '').replace(/[^xX-]/g, '').toLowerCase()];

/**
 * 读法条：上面每个音画成一条（占几格就有几格长），下面是“1 e & a”。一个音不管多长，只念它开头那一格的字，后面几格的字不出声（在心里过）。
 *   mode    full 字都在、不念的是淡的 | said 只显示要念的 | none 不显示字 | pick 字是按钮，点出要念的（哪个该念不露出来）
 *   rowLen  一行几格：16 一条到底，8 折成两行（和机器上那两排方键一样），4 只有一拍
 */
export function readStrip(pattern, { mode = 'full', rowLen = 16, onPick = null, firstBeat = 1 } = {}) {
  const p = cleanP(pattern);
  const notes = [];
  let cur = null;
  p.forEach((c, i) => {
    if (c === 'x') notes.push((cur = { at: i, len: 1, els: [] }));
    else if (cur) cur.len++;
  });
  const word = (i) => (i % 4 === 0 ? String(firstBeat + Math.floor(i / 4)) : SAY[i % 4]);
  const wordEls = [];
  const rowEls = [];
  for (let r = 0; r < p.length; r += rowLen) {
    const row = h('div', { class: 'rh-readrow', style: { gridTemplateColumns: `repeat(${rowLen}, minmax(0, 1fr))` } });
    for (const n of notes) {
      const a = Math.max(n.at, r);
      const b = Math.min(n.at + n.len, r + rowLen);
      if (a >= b) continue; // 这个音不在这一行
      const bar = h('i', { class: ['rh-n', n.at < r && 'cont'], style: { gridColumn: `${a - r + 1} / span ${b - a}` } });
      n.els.push(bar);
      row.append(bar);
    }
    for (let i = r; i < Math.min(p.length, r + rowLen); i++) {
      const w = h(onPick ? 'button' : 'i', {
        class: ['rh-w', i % 4 === 0 && 'beat', mode !== 'pick' && (p[i] === 'x' ? 'spoken' : 'mute')], type: onPick ? 'button' : null, 'data-sfx': onPick ? 'none' : null, style: { gridColumn: String(i - r + 1) },
      }, word(i));
      if (onPick) w.addEventListener('click', () => onPick(i, w));
      wordEls[i] = w;
      row.append(w);
    }
    rowEls.push(row);
  }
  return {
    el: h('div', { class: ['rh-read', `m-${mode}`, `w${rowLen}`] }, rowEls),
    notes, wordEls,
    said: notes.map((n) => n.at),
    /** 嘴里该念的那一串字 */
    text: notes.map((n) => word(n.at)).join(' '),
    /** 走到第几格了（-1 = 没在放）：正在响的那个音和它的字亮着 */
    setHead(step) {
      for (const n of notes) {
        const on = step >= n.at && step < n.at + n.len;
        n.els.forEach((e) => e.classList.toggle('on', on));
        wordEls[n.at].classList.toggle('on', on);
      }
    },
  };
}

/** 点出要念的字：点对的亮起来，点到不念的字会晃一下、不算；全点出来就过。onDone() */
function wordPicker(pattern, { rowLen, firstBeat = 1, onDone, onWrong }) {
  const picked = new Set();
  let done = false;
  const strip = readStrip(pattern, {
    mode: 'pick', rowLen, firstBeat,
    onPick(i, w) {
      if (done || picked.has(i)) return;
      if (!strip.said.includes(i)) {
        w.classList.add('wrong');
        setTimeout(() => w.classList.remove('wrong'), 520);
        sfx.play('nope');
        onWrong?.(w.textContent);
        return;
      }
      picked.add(i);
      w.classList.add('picked');
      strip.notes.find((n) => n.at === i).els.forEach((e) => e.classList.add('on'));
      sfx.play('on');
      if (picked.size === strip.said.length) {
        done = true;
        onDone?.();
      }
    },
  });
  return {
    el: strip.el, strip,
    auto() {
      strip.said.forEach((i) => strip.wordEls[i].click());
    },
  };
}

// 一拍 4 格有 8 种切法（把 4 拆成几段）。越靠后越绕：前 5 种只有“一格”和“两格”，后面的带三格的长音
const CUTS = [[4], [2, 2], [1, 1, 1, 1], [2, 1, 1], [1, 1, 2], [3, 1], [1, 2, 1], [1, 3]];
const cutPattern = (cut) => cut.map((n) => 'x' + '-'.repeat(n - 1)).join('');
const cutPool = (tier) => CUTS.slice(0, byTier(tier, [5, 7, 8]));
/** 随机编一小节：每拍从这一档的切法里抽一种，相邻两拍不重样 */
function randomBar(tier) {
  const pool = cutPool(tier);
  const out = [];
  for (let b = 0; b < 4; b++) {
    let c;
    do c = pool[Math.floor(Math.random() * pool.length)];
    while (c === out[b - 1] || (b === 0 && c.length === 1));
    out.push(c);
  }
  return out.map(cutPattern).join('');
}
/** 把一段节奏放一遍（一格 d 秒）：每个音有多长就响多长，每拍开头垫一下底鼓 */
function playBarOnce(pattern, d) {
  const p = cleanP(pattern);
  const strip = readStrip(pattern);
  audio.init().then((ok) => {
    if (!ok) return;
    const t0 = audio.now() + 0.06;
    for (let i = 0; i < p.length; i += 4) audio.drum('KICK', t0 + i * d, 0.7);
    for (const n of strip.notes) audio.note(67, t0 + n.at * d, n.len * d * 0.9, { voice: 'keys', vel: 0.8 });
  });
  return p.length * d;
}

const SAY_PLAY = [
  { p: 'xxxxxxxxxxxxxxxx', title: '一格一个音', how: '点「播放」。16 格都有音，16 个字全念出来。', after: '一拍四个字：“1 e & a”。' },
  { p: 'x-x-x-x-x-x-x-x-', title: '一个音占两格', how: '现在每个音占两格。**只念它开头那个字**，后面那个字不出声，在心里过。', after: '嘴里剩下“1 & 2 & 3 & 4 &”：e 和 a 不出声了。' },
  { p: 'x-x-xxxxx---x--x', title: '长长短短', how: '有长有短混着来。还是那一条：一个音不管多长，只念开头那个字。', after: '长音后面的字都不出声：“1 & 2 e & a 3 4 a”。' },
  { quiz: 3, title: '你来点', how: '看这一拍里的音：该念哪几个字？点出来。' },
];

/** R2 的热身：先听满的，再听“一个音占两格”，再听混着的，最后点 3 拍（这一拍该念哪几个字） */
function saycount(spec, env) {
  const bpm = spec.bpm || 84;
  const d = 60 / bpm / 4;
  const segs = SAY_PLAY.map((s) => ({ ...s }));
  let si = 0;
  let laps = 0;
  let touches = 0;
  let strip = null;
  let picker = null;
  let quizLeft = [];
  let right = 0;
  const timers = new Set();
  const later = (fn, n = 0) => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, n);
    timers.add(id);
  };
  const seg = () => segs[si];
  const player = new LoopPlayer({ bpm });
  const head = h('div', { class: 'rh-move' });
  const host = h('div', { class: 'rh-readhost' });
  const big = h('div', { class: 'rh-sayline' });
  const say = h('div', { class: 'cl-note' });
  const lamps = h('div', { class: 'cl-lamps' });
  const btn = (text, fn, primary) => h('button', { class: ['btn', 'sm', primary && 'primary'], type: 'button', onclick: fn }, text);

  player.onSchedule = (step, t) => {
    if (step !== 0 || seg().quiz || seg().done) return;
    laps++;
    if (laps >= 2) later(() => pass(seg().after), Math.max(0, (t - audio.now()) * 1000));
  };
  player.onStep((s) => strip?.setHead(s));

  function paintHead() {
    const s = seg();
    head.replaceChildren(h('small', {}, `第 ${si + 1} / ${segs.length} 步`), h('b', {}, s.title), h('span', { html: rich(s.how) }));
  }
  function enter(i) {
    si = i;
    const s = seg();
    s.done = false;
    laps = 0;
    paintHead();
    el.classList.toggle('quiz', !!s.quiz);
    if (s.quiz) {
      player.stop();
      playBtn.paint();
      strip = null;
      right = 0;
      quizLeft = [CUTS[1], CUTS[3], CUTS[5], CUTS[4]].sort(() => Math.random() - 0.5).slice(0, s.quiz); // 三种不一样的切法
      nextBeat();
      return;
    }
    strip = readStrip(s.p, { mode: 'full', rowLen: 8 });
    host.replaceChildren(strip.el);
    player.set({ KICK: 'x---x---x---x---' }, strip.notes.map((n) => [n.at, 67, n.len]), 'keys');
    big.innerHTML = rich(`跟着念：**${strip.text}**`);
    say.textContent = player.playing ? '听一小节，嘴里跟着念。' : '点「播放」，嘴里跟着念。';
  }
  function pass(text) {
    const s = seg();
    if (s.done) return;
    s.done = true;
    const lastOne = si >= segs.length - 1;
    sfx.play(lastOne ? 'star' : 'ok');
    touches++;
    env.touched();
    while (lastOne && touches < 3) {
      touches++;
      env.touched();
    }
    say.innerHTML = rich(`✓ ${text || ''}`);
    if (lastOne) {
      confetti(host, 16);
      say.append(' ', btn('从头再来一遍', () => enter(0)));
      return;
    }
    const go = btn(`下一步：${segs[si + 1].title} →`, () => enter(si + 1), true);
    say.append(' ', go);
    pop(go);
  }
  /** “你来点”的下一拍 */
  function nextBeat() {
    const cut = quizLeft[right];
    const beatNo = 1 + Math.floor(Math.random() * 4);
    const pat = cutPattern(cut);
    lamps.replaceChildren(...Array.from({ length: seg().quiz }, (_, i) => h('i', { class: i < right ? 'on' : '' })));
    picker = wordPicker(pat, {
      rowLen: 4, firstBeat: beatNo,
      onWrong: (w) => (say.innerHTML = rich(`“${w}”那一格被前面的音占着：**不念**。`)),
      onDone() {
        right++;
        lamps.children[right - 1]?.classList.add('on');
        if (right >= seg().quiz) return pass('三拍都点对了。长音后面的字，一个都不念。');
        say.innerHTML = rich(`✓ 念“**${picker.strip.text}**”。下一拍。`);
        later(nextBeat, 900);
      },
    });
    host.replaceChildren(picker.el);
    big.replaceChildren(btn('▶ 听这一拍', () => playBarOnce(pat, d)), lamps);
    if (!right) say.textContent = '上面一条是一个音。点它下面该念的字；不念的不点。';
  }

  const playBtn = playButton(player, {
    onToggle(on) {
      laps = 0;
      if (!on) strip?.setHead(-1);
      else if (!seg().quiz && !seg().done) say.textContent = '听一小节，嘴里跟着念。';
    },
  });
  const el = h('div', { class: 'cl-toy rh-say' },
    h('div', { class: 'cl-row' }, playBtn, h('span', { class: 'cl-cap' }, '上面一条 = 一个音，占几格就有几格长；下面是每一格的名字')),
    head, host, big, say);
  enter(0);
  shotLater((words) => {
    enter(Math.max(0, Math.min(segs.length - 1, shotSeg(words))));
    if (!words.includes('mid')) return;
    if (seg().quiz) picker.strip.wordEls[0].click();
    else strip.setHead(5);
  });

  return {
    el,
    async __autoPlay() {
      const out = [];
      for (let i = si; i < segs.length; i++) {
        if (seg().quiz) {
          for (let k = 0; k < seg().quiz && !seg().done; k++) {
            picker.auto();
            await sleep(1100);
          }
        } else if (!player.playing) playBtn.click();
        const ok = await until(() => seg().done, 14000, 80);
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
      timers.forEach(clearTimeout);
    },
  };
}

/**
 * R2 挑战的第一段：一整小节，点出要念的字（自动判）。第一条是 spec.pattern（等会儿要打的那一条），后面的是随机编的。
 * spec.need：一共几条（默认铜 1、银 2、金 2）。星星看点错了几次。
 */
function saywords(spec, env) {
  const tier = env.tier || 1;
  const need = spec.need || byTier(tier, [1, 2, 2]);
  const d = 60 / (spec.bpm || 84) / 4;
  let right = 0;
  let wrong = 0;
  let picker = null;
  let pat = '';
  let timer = 0;
  const host = h('div', { class: 'rh-readhost' });
  const say = h('div', { class: 'cl-note' });
  const lamps = h('div', { class: 'cl-lamps', 'aria-label': '点对了几条' });
  const paintLamps = () => lamps.replaceChildren(...Array.from({ length: need }, (_, i) => h('i', { class: i < right ? 'on' : '' })));
  const listen = h('button', { class: 'btn primary lg', type: 'button', onclick: () => playBarOnce(pat, d) }, '▶ 听这一小节');

  function next() {
    pat = right === 0 && spec.pattern ? spec.pattern : randomBar(tier);
    picker = wordPicker(pat, {
      rowLen: 8,
      onWrong(w) {
        wrong++;
        say.innerHTML = rich(`“${w}”那一格被前面的音占着：**不念**。`);
      },
      onDone() {
        right++;
        paintLamps();
        if (right >= need) {
          sfx.play('star');
          confetti(lamps, 16);
          say.innerHTML = rich(`✓ 念“**${picker.strip.text}**”。${wrong ? `中间点错了 ${wrong} 次，不要紧。` : '一个都没点错。'}`);
          say.append(' ', h('button', { class: 'btn sm', type: 'button', onclick: () => { right = 0; wrong = 0; paintLamps(); next(); } }, '再玩一轮'));
          env.done(wrong === 0 ? 3 : wrong <= 2 ? 2 : 1);
          return;
        }
        sfx.play('ok');
        say.innerHTML = rich(`✓ 念“**${picker.strip.text}**”。再来一条。`);
        timer = setTimeout(next, 1300);
      },
    });
    host.replaceChildren(picker.el);
    if (!right) say.textContent = '上面一条是一个音，占几格就有几格长。每个音只点它开头那一格的字。';
  }
  paintLamps();
  next();
  shotLater((words) => {
    if (words.includes('next')) {
      // 这一段算过了，进接力的下一段（音游 + 读法条）
      env.done(3);
      return setTimeout(() => document.querySelector('.cl-relay-bar .btn.primary')?.click(), 60);
    }
    if (!words.includes('mid')) return;
    picker.strip.said.slice(0, 4).forEach((i) => picker.strip.wordEls[i].click());
    picker.strip.wordEls.find((w, i) => !picker.strip.said.includes(i))?.classList.add('wrong');
    say.innerHTML = rich('“e”那一格被前面的音占着：**不念**。');
  });
  return {
    el: h('div', { class: 'cl-toy rh-say rh-sayq' }, h('div', { class: 'cl-row' }, listen, h('span', { class: 'spacer' }), lamps), host, say),
    async __auto() {
      for (let i = 0; i < need + 1 && right < need; i++) {
        picker.auto();
        await sleep(1500);
      }
      return { type: 'saywords', right, wrong };
    },
    destroy() {
      clearTimeout(timer);
    },
  };
}

export const RHYTHM2_TOYS = { metro, accents, handshift, saycount, saywords };
