// 认识面板的几样东西：自由探索（点哪儿讲哪儿）、导览（一站一站认）、找按键（小游戏）、灯色速查、真机镜像。
// 自由探索、导览、真机镜像是左右两栏（样式是课程里那套 .split）：左边机器，镜头只对着正在说的那一块；右边是文字。
import { h, rich, clear } from './util.js';
import { simulator } from './simulator.js';
import { mirror } from './mirror.js';
import { midi } from './midi.js';
import { createPanel, GROUPS } from './device-panel.js';
import { CONTROLS, TOUR, LED_LEGEND, controlInfo } from './controls.js';
import { store } from './store.js';
import { segmented } from './ui.js';
import { sfx } from './sfx.js';
import { confetti } from './fx.js';
import { BENCH_VIEW, fitView, benchView, refitOnResize } from './bench-view.js';

// ───────────── 百科卡片 ─────────────

function infoCard() {
  const el = h('div', { class: 'ctl-card' });
  const show = (id) => {
    const info = controlInfo(id);
    clear(el);
    if (!info) {
      el.append(h('div', { class: 'label' }, '按键百科'), h('p', { style: { marginTop: '10px' } }, '点机器上的任何一个地方，这里会告诉你它叫什么、是干什么的。'));
      return;
    }
    el.append(
      h('div', { class: 'label' }, '按键百科'),
      h('div', { class: 'en', style: { marginTop: '8px' } }, info.en),
      h('div', { class: 'zh' }, info.zh),
      h('p', { html: rich(info.what) }),
      info.tips?.length ? h('ul', {}, info.tips.map((t) => h('li', { html: rich(t) }))) : '',
    );
  };
  show(null);
  return { el, show };
}

// 自由探索时镜头对着哪儿：整台放进半个屏幕宽，键太小点不中，所以分成三块来看（左侧那一列键跟着鼓区）
const ZONES = [
  { value: 'drum', label: '鼓区', ids: ['LEFTSIDE', 'ZONE_DRUM'] },
  { value: 'synth', label: '合成器区', ids: ['ZONE_SYNTH', 'TOPKEYS'] },
  { value: 'fx', label: '音色与效果', ids: ['ZONE_FX', 'RIGHTBUTTONS', 'JACKS', 'UNDO', 'CLEARFX'] },
  { value: 'all', label: '整台', ids: [] },
];
const ZONE_VIEW = { pad: 12, minW: 300, aspect: 1.5 };

/** 自由探索：左边是能玩的模拟机（一次看一块，键才够大），右边是百科：点哪儿讲哪儿。 */
export function panelExplore() {
  const card = infoCard();
  const off = simulator.on('info', (id) => card.show(id));
  let zone = 'drum';
  const machine = h('div', { class: 'do-machine' }, simulator.mount());
  const col = h('div', { class: 'do-bench' });
  const look = () => simulator.panel?.focus(ZONES.find((z) => z.value === zone).ids, fitView(col, ZONE_VIEW, 190));
  col.append(
    h('div', { class: 'zone-pick' }, segmented(ZONES, zone, (v) => {
      zone = v;
      look();
    }, '看哪一块')),
    machine);
  const reset = h('button', { class: 'btn sm', type: 'button', onclick: () => { simulator.reset(); look(); } }, '把模拟机恢复成刚开箱的样子');
  const el = h('div', { class: 'split' }, col,
    h('div', { class: 'do-side' },
      card.el,
      h('p', { class: 'small muted', style: { margin: '0' } }, '这台模拟机能播放、能填格子、能静音、能换工程。随便玩，玩不坏。'),
      h('div', {}, reset)));
  look();
  const first = setTimeout(look, 0); // 挂到页面上之后量得到高矮了，再取一次景
  const stopRefit = refitOnResize(col, look);
  return {
    el,
    destroy() {
      off();
      clearTimeout(first);
      stopRefit();
      simulator.unmount();
    },
  };
}

// ───────────── 导览 ─────────────

/**
 * 一站一站认面板。左边是机器，镜头跟着正在讲的那一块走；右边是这一站讲什么、上一站 / 下一站。
 * 接着真机时，屏幕上那台是真机的镜子，每一站多一句“在真机上试试”；没接真机就是模拟机，可以直接点。
 * intro = 放在右边最上面的东西（课程里这一步的课文）。
 */
export function panelTour({ onDone, intro } = {}) {
  let index = 0;
  let seen = 0;
  let model = null;
  const label = h('div', { class: 'label' });
  const title = h('h3', {});
  const body = h('p', { class: 'tour-text' });
  const tryIt = h('div', { class: 'callout tip', style: { margin: '0' } });
  const holder = h('div', { class: 'do-machine' });
  const count = h('span', { class: 'tour-count' });
  const dots = h('div', { class: 'tour-dots' });
  const prev = h('button', { class: 'btn', type: 'button', onclick: () => go(index - 1) }, '← 上一站');
  const next = h('button', { class: 'btn primary', type: 'button', onclick: () => go(index + 1) }, '下一站 →');
  const isLive = () => model === mirror;
  const col = h('div', { class: 'do-bench' }, holder);
  const view = benchView(() => model?.panel, () => TOUR[index].show, null, () => fitView(col, BENCH_VIEW, 130));

  /** 讲解和“试试看”那一句：跟着是不是接着真机、以及真机此刻的状态变 */
  let shown = '';
  function renderText() {
    const stop = TOUR[index];
    const live = isLive() ? (typeof stop.live === 'function' ? stop.live(mirror) : stop.live) || '' : '';
    const text = stop.text + (!isLive() && stop.sim ? stop.sim : '');
    if (`${text}|${live}` === shown) return;
    shown = `${text}|${live}`;
    body.innerHTML = rich(text);
    tryIt.style.display = live ? '' : 'none';
    tryIt.replaceChildren(h('b', { class: 'label' }, '在真机上试试'), h('span', { html: rich(live) }));
  }

  function mountBench() {
    model?.unmount();
    model = mirror.available ? mirror : simulator;
    const machine = model.mount({ tips: false });
    holder.replaceChildren(machine);
    view.dock(machine);
    label.textContent = isLive()
      ? '面板导览 · 蓝圈圈出来的就是正在讲的部分。左边这台是真机的镜子：在真机上按一按，它会跟着亮'
      : '面板导览 · 蓝圈圈出来的就是正在讲的部分，可以随手点一点';
    model.highlight(TOUR[index].show);
    view.apply();
    renderText();
  }

  function go(i) {
    index = Math.max(0, Math.min(TOUR.length - 1, i));
    seen = Math.max(seen, index);
    const stop = TOUR[index];
    title.textContent = stop.title;
    count.textContent = `${index + 1} / ${TOUR.length}`;
    model?.highlight(stop.show);
    view.apply(); // 镜头转到这一站讲的那一块
    renderText();
    dots.replaceChildren(...TOUR.map((_, j) => h('i', { class: j <= index ? 'on' : '', role: 'button', 'aria-label': `第 ${j + 1} 站：${TOUR[j].title}`, onclick: () => go(j) })));
    prev.disabled = index === 0;
    next.disabled = index === TOUR.length - 1;
    if (seen === TOUR.length - 1) onDone?.();
  }

  const el = h('div', { class: 'split tour' }, col,
    h('div', { class: 'do-side' },
      intro ? h('div', { class: 'do-intro' }, intro) : null,
      h('div', { class: 'widget tour-card' }, label, title, body, tryIt,
        h('div', { class: 'tour-nav' }, dots, h('div', { class: 'row' }, prev, count, h('span', { class: 'spacer' }), next)))));
  mountBench();
  go(0);
  const first = setTimeout(() => view.apply(), 0);
  const offs = [
    // 真机中途接上 / 拔掉：换一台机器
    midi.on('state', () => {
      if ((mirror.available ? mirror : simulator) !== model) mountBench();
    }),
    // “试试看”里有的建议要看真机现在在哪个工程
    mirror.on('change', renderText),
    refitOnResize(col, () => view.apply()),
    () => clearTimeout(first),
  ];
  return {
    el,
    destroy: () => {
      offs.forEach((f) => f());
      model?.unmount();
    },
  };
}

// ───────────── 找按键 ─────────────

const NAME_POOL = ['PLAY', 'VOL+', 'VOL-', 'DELETE', 'MUTE', 'SOLO', 'PAGE', 'ALL', 'KICK', 'SNARE', 'CLAP', 'HAT1', 'HAT2', 'PERC1', 'PERC2', 'SYNTH1', 'SYNTH2', 'DX', 'SAMPLER', 'REC', 'BPM+', 'BPM-', 'SWING', 'PROJECT', 'OCTAVE', 'SCALE', 'KEY', 'BARLENGTH', 'RECSAMPLE', 'SD1', 'UNDO', 'FXLEVEL', 'HIGHPASS', 'REPEATER', 'INDEX', 'METER', 'PHONES', 'USB', 'DK1', 'DK5', 'DK9', 'DK13', 'DK16', 'SK1', 'SK4', 'SK7'];
const ASK_TARGET = { DRUMKEYS: 'DK5', SYNTHKEYS: 'SK1' };

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeQuestions(count, mode) {
  const byName = shuffle(NAME_POOL).map((id) => {
    const info = controlInfo(id);
    return { target: id, kind: '按名字找', prompt: `${info.en}`, sub: info.zh };
  });
  const byFunc = shuffle(Object.entries(CONTROLS).filter(([, c]) => c.ask)).map(([id, c]) => ({ target: ASK_TARGET[id] || id, kind: '按用途找', prompt: c.ask, sub: '' }));
  if (mode === 'name') return byName.slice(0, count);
  if (mode === 'func') return byFunc.slice(0, count);
  const half = Math.ceil(count / 2);
  const used = new Set();
  const out = [];
  for (const q of [...byName.slice(0, half), ...byFunc]) {
    if (out.length >= count) break;
    if (used.has(q.target)) continue;
    used.add(q.target);
    out.push(q);
  }
  return out;
}

/**
 * 找按键：屏幕上给出名字或用途，你在面板上把它点出来。
 * opts: count 题数，mode 'name' | 'func' | 'mixed'，pass 通过需要答对几题，
 *       onDone(score, total, passed, stars)  stars：过关时几颗星（全对三颗、错一题两颗、其余一颗），没过是 0
 *       onNext    给了就在过关的结果上放一个“下一步 →”（课程里用：结果卡片上就能接着走，不用去找页面角上的按钮）
 *       showStars 结果上画星星，并说怎么多拿星（课程里用）
 */
export function panelQuiz({ count = 10, mode = 'mixed', pass = 7, onDone, onNext, showStars = false } = {}) {
  let questions = [];
  let qi = 0;
  let score = 0;
  let locked = false;
  let wrongNow = false; // 这一题已经点错了（正确的那个正被蓝圈圈着）
  let missed = [];
  let startedAt = 0;
  const need = () => Math.min(pass, questions.length);

  const ask = h('div', { class: 'pq-ask' });
  const scoreEl = h('div', { class: 'pq-score' });
  const feedback = h('div', { class: 'pq-feedback' });
  const nextBtn = h('button', { class: 'btn primary', type: 'button', style: { display: 'none' }, onclick: () => advance() }, '下一题 →');
  const panel = createPanel({ onPick: (id) => pick(id) });
  const body = h('div', {}, h('div', { class: 'pq-head' }, ask, scoreEl), panel.el, h('div', { class: 'row', style: { marginTop: '10px' } }, feedback, h('span', { class: 'spacer' }), nextBtn));
  const el = h('div', { class: 'widget' }, h('div', { class: 'label', style: { marginBottom: '12px' } }, '找按键'), body);

  const sameControl = (picked, target) => picked === target;

  function render() {
    const q = questions[qi];
    ask.replaceChildren(h('small', {}, `${q.kind} · 第 ${qi + 1} / ${questions.length} 题`), q.prompt, q.sub ? h('span', { class: 'muted', style: { fontWeight: '500', fontSize: '15px', marginLeft: '10px' } }, q.sub) : '');
    renderScore();
    feedback.className = 'pq-feedback';
    feedback.textContent = '在这张面板图上把它点出来。';
    nextBtn.style.display = 'none';
    panel.setHighlight([]);
    locked = false;
    wrongNow = false;
  }

  // 右上角：对了几题，下面一行小字写着过关要几题
  const renderScore = () => scoreEl.replaceChildren(h('b', {}, `${score} 分`), h('small', {}, `过关要 ${need()} 分`));

  function pick(id) {
    if (!questions.length) return;
    const q = questions[qi];
    if (locked) {
      // 点错之后又去点蓝圈里那个：说一声这题已经记过了，免得以为改对了也算分
      if (wrongNow && sameControl(id, q.target)) feedback.innerHTML = rich('对，就是它。不过这一题已经记成错了，点右边的「下一题」接着来。');
      return;
    }
    const info = controlInfo(q.target);
    locked = true;
    if (sameControl(id, q.target)) {
      score++;
      panel.flash(id, '#34d058', 900);
      feedback.className = 'pq-feedback right';
      feedback.innerHTML = rich(`✓ 对了。${info.what.split('。')[0]}。`);
      renderScore();
      setTimeout(advance, 1300);
    } else {
      const wrong = controlInfo(id);
      wrongNow = true;
      missed.push(q.target);
      panel.flash(id, '#ff3b30', 900);
      panel.setHighlight([q.target]);
      feedback.className = 'pq-feedback wrong';
      feedback.innerHTML = rich(`✗ 你点的是 ${wrong ? `${wrong.en}（${wrong.zh}）` : '别的地方'}。正确的在蓝圈那里：${info.what.split('。')[0]}。`);
      nextBtn.style.display = '';
    }
  }

  function advance() {
    if (qi < questions.length - 1) {
      qi++;
      render();
      return;
    }
    finish();
  }

  // 结果：过没过关要一眼看出来。原来只有一行小绿字“过关”、唯一的按钮是“再来一轮”，用户对了 7 题以为没过
  function finish() {
    const total = questions.length;
    const secs = Math.round((performance.now() - startedAt) / 1000);
    const passed = score >= need();
    const stars = !passed ? 0 : score === total ? 3 : score >= total - 1 ? 2 : 1;
    store.update((d) => {
      const cur = d.panelQuiz || { best: 0, plays: 0 };
      d.panelQuiz = { best: Math.max(cur.best, score), plays: cur.plays + 1, lastAt: new Date().toISOString() };
    });
    body.style.display = 'none';
    const names = [...new Set(missed)].map((id) => controlInfo(id)).filter(Boolean).map((i) => `${i.en}（${i.zh}）`);
    const note = !passed ? `要对 ${need()} 题才过关，还差 ${need() - score} 题。`
      : showStars && stars < 3 ? `用时 ${secs} 秒。全对是三颗星，错一题是两颗；想多拿星可以再来一轮。`
        : `用时 ${secs} 秒。`;
    const again = h('button', { class: ['btn', !(passed && onNext) && 'primary'], type: 'button', onclick: () => { summary.remove(); body.style.display = ''; start(); } }, '再来一轮');
    const summary = h('div', { class: ['pq-result', passed ? 'pass' : 'fail'] },
      h('div', { class: 'pq-verdict' }, !passed ? '还没过关' : score === total ? '全对，过关' : '过关'),
      showStars && passed && h('div', { class: 'stars big-stars' }, [0, 1, 2].map((i) => h('span', { class: i < stars ? 'on' : '' }, '★'))),
      h('div', { class: 'pq-final' }, `对了 ${score} 题 / 共 ${total} 题`),
      h('p', { class: 'pq-note' }, note),
      names.length ? h('p', { class: 'pq-missed' }, `${passed ? '这几个再留意一下' : '这几个没找对'}：${names.join('、')}`) : null,
      h('div', { class: 'game-actions' }, passed && onNext && h('button', { class: 'btn primary', type: 'button', onclick: () => onNext() }, '下一步 →'), again),
    );
    el.append(summary);
    if (passed) {
      sfx.play(stars === 3 ? 'star' : 'ok');
      confetti(summary, stars === 3 ? 40 : 18, { spread: 160 });
    }
    onDone?.(score, total, passed, stars);
  }

  function start() {
    questions = makeQuestions(count, mode);
    qi = 0;
    score = 0;
    missed = [];
    startedAt = performance.now();
    render();
  }

  start();
  return { el, destroy() {} };
}

// ───────────── 灯色速查 ─────────────

export function ledLegend() {
  return {
    el: h('div', { class: 'widget' }, h('h4', {}, '灯的颜色在说什么'), h('div', { class: 'led-legend' }, LED_LEGEND.map(([color, text]) => h('span', {}, h('i', { style: { background: color } }), text)))),
    destroy() {},
  };
}

// ───────────── 真机镜像 ─────────────

// 照着试的清单：做到哪条勾哪条，不分先后。state = 看机器现在的样子；ok = 看刚发生的动作。
const MIRROR_TRY = [
  { text: '先翻到练习本：**按住 [PROJECT↑]，再按上排第 4 个步进键**（4 号空白工程，随便改不心疼）', panel: ['PROJECT', 'DK4'], state: (m) => m.project >= 3 },
  { text: '按一下 **KICK 旋钮**：选中底鼓，机器停着时会响一声', panel: ['KICK'], ok: (e) => e.type === 'track' && e.track === 'KICK' },
  { text: '按亮任意一个**步进键**：在那一步放一个底鼓', panel: ['DRUMKEYS'], ok: (e) => e.type === 'step' && e.on },
  { text: '短按 **[PLAY]**：开始循环播放', panel: ['PLAY'], ok: (e) => e.type === 'start' },
  { text: '**按住 [MUTE] 再按 KICK 旋钮**：把底鼓静音', panel: ['MUTE', 'KICK'], ok: (e) => e.type === 'mute' && e.on },
  { text: '同样的操作再做一次：让它回来', panel: ['MUTE', 'KICK'], ok: (e) => e.type === 'mute' && !e.on },
  { text: '按几下 **[BPM+]** 或 **[BPM-]**：改速度', panel: ['BPM+', 'BPM-'], ok: (e) => e.type === 'tempo' },
  { text: '再短按 **[PLAY]**：停下', panel: ['PLAY'], ok: (e) => e.type === 'stop' },
];

// 在机器上刚动的是哪一块（镜像报上来的动作 → ZONES 里的哪一块）。'all' = 两头都碰到了（换工程：右侧面的 [PROJECT↑] + 鼓区的方键），看整台
const DRUM_TRACKS = new Set(GROUPS.DRUMKNOBS);
function zoneOfEvent(e) {
  switch (e.type) {
    case 'track': case 'mute': case 'solo': case 'pattern': case 'delete': case 'octave': case 'length':
      return e.track ? (DRUM_TRACKS.has(e.track) ? 'drum' : 'synth') : null;
    case 'step': case 'start': case 'stop': case 'volume':
      return 'drum'; // 步进键在鼓区；[PLAY]、音量在左侧面，那一列跟着鼓区
    case 'note': case 'chord':
      // 鼓轨响的那一声多半是停着的时候按旋钮试听（紧跟在“选中”后面，镜头已经转过去了）：不跟
      return e.track && DRUM_TRACKS.has(e.track) ? null : 'synth';
    case 'key': case 'scalekey': case 'recording':
      return 'synth'; // Synth keys、录音键、上缘那几个键
    case 'tempo': case 'sound': case 'sdpage': case 'polymode':
      return 'fx'; // 右侧面的 [BPM±]、右边那几个旋钮
    case 'project':
      return 'all';
    default:
      return null;
  }
}

/**
 * 真机镜像：左边是真机的镜子（灯同步 + 一句解说），右边是照着试的清单、机器现在的状态、刚才发生过什么。
 * 镜头：一打开看整台（用户定的，2026-11-11）；在机器上按了哪一块，就转到哪一块（鼓区 / 合成器区 / 音色与效果，和“模拟机”那一栏的分法一样），
 * 解说条右边的“看整台”看回去。清单里下一步要按的键始终用蓝圈圈着，镜头不跟着它跑。
 */
export function panelMirror() {
  const statusEl = h('dl', { class: 'mirror-status' });
  const tryEl = h('ul', { class: 'mirror-try' });
  const logEl = h('ol', { class: 'mirror-log' });
  const done = new Set();
  let statusSig = '';
  let trySig = '';
  let next = 0;
  let zone = null; // 现在看的那一块；null = 整台

  const mirrorEl = mirror.mount();
  const col = h('div', { class: 'do-bench' }, h('div', { class: 'do-machine' }, mirrorEl));
  const wholeBtn = h('button', { class: 'btn sm bench-view', type: 'button', onclick: () => { zone = null; look(); } }, '看整台');
  const look = () => {
    mirror.panel?.focus(zone ? ZONES.find((z) => z.value === zone).ids : [], fitView(col, ZONE_VIEW, 170));
    wholeBtn.style.display = zone ? '' : 'none';
  };
  mirrorEl.querySelector('.sim-bar')?.append(wholeBtn);

  const renderStatus = () => {
    const rows = mirror.status();
    const sig = JSON.stringify(rows);
    if (sig === statusSig) return;
    statusSig = sig;
    statusEl.replaceChildren(...rows.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]));
  };
  const renderTry = () => {
    MIRROR_TRY.forEach((t, i) => {
      if (t.state?.(mirror)) done.add(i);
    });
    next = MIRROR_TRY.findIndex((_, i) => !done.has(i));
    const sig = `${[...done].sort().join()}|${next}`;
    if (sig !== trySig) {
      trySig = sig;
      tryEl.replaceChildren(...MIRROR_TRY.map((t, i) => h('li', { class: done.has(i) ? 'done' : i === next ? 'next' : '' },
        h('span', { class: 'tick' }, done.has(i) ? '✓' : ''), h('span', { html: rich(t.text) }))));
      if (next < 0) tryEl.append(h('li', { class: 'all' }, '都做到了。这几样就是这台机器最日常的操作。'));
      mirror.highlight(next >= 0 ? MIRROR_TRY[next].panel : []);
    }
  };
  const renderLog = () => {
    const items = mirror.log.slice(-10).reverse();
    logEl.replaceChildren(...(items.length
      ? items.map((l) => h('li', {}, h('time', {}, new Date(l.at).toLocaleTimeString('zh-CN', { hour12: false })), h('span', { html: rich(l.text) })))
      : [h('li', { class: 'empty' }, '还没有动作。按一下机器上的任意一个轨道旋钮试试。')]));
  };

  const first = setTimeout(look, 0); // 挂到页面上之后量得到高矮了，再取一次景
  const offs = [
    mirror.on('change', () => {
      renderStatus();
      renderTry();
    }),
    mirror.on('event', (e) => {
      MIRROR_TRY.forEach((t, i) => {
        if (t.ok?.(e)) done.add(i);
      });
      renderTry();
      const z = zoneOfEvent(e);
      const want = z === 'all' ? null : z;
      if (z && want !== zone) {
        zone = want;
        look();
      }
    }),
    mirror.on('say', renderLog),
    refitOnResize(col, look),
    () => clearTimeout(first),
  ];
  renderStatus();
  renderTry();
  renderLog();

  const el = h('div', { class: 'split' }, col,
    h('div', { class: 'do-side' },
      h('p', { class: 'small muted', style: { margin: '0' }, html: rich('左边这台是**真机的镜子**：在机器上按什么，它就亮什么。屏幕上点它不会操作真机，只会告诉你那个键是干什么的。') }),
      h('div', { class: 'mirror-card' }, h('div', { class: 'label' }, '照着试一遍（蓝圈是下一步）'), tryEl),
      h('div', { class: 'mirror-card' }, h('div', { class: 'label' }, '机器现在的样子'), statusEl),
      h('div', { class: 'mirror-card' }, h('div', { class: 'label' }, '刚才发生了什么（最新的在最上面）'), logEl)));
  return {
    el,
    destroy() {
      offs.forEach((f) => f());
      mirror.unmount();
    },
  };
}

/** 只放一台模拟机（课文中间用）。 */
export function simWidget() {
  return { el: simulator.mount(), destroy: () => simulator.unmount() };
}
