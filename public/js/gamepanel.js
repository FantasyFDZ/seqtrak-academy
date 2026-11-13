// 一局音游外面的那层：速度/模式选择、“示范 → 跟打 → 独奏”三段式、成绩记录、叫教练点评。
// 版式（样式在 app.css 的“音游外面那层”）：地方够宽时左右两栏，左边是舞台，右边一栏是“现在做什么”
// （分段、开打之前的检查、真机的镜子、速度和模式、这一关练什么、最好成绩）；窄的时候叠成一列，镜子排到舞台下面。
import { h, clear } from './util.js';
import { RhythmGame } from './game.js';
import { normalizeChart } from './chart.js';
import { store } from './store.js';
import { BADGES } from './levels.js';
import { midi } from './midi.js';
import { ctx } from './context.js';
import { coach } from './coach.js';
import { segmented } from './ui.js';
import { mirror } from './mirror.js';
import { gameMirror } from './game-mirror.js';

const STAGE_NAME = { demo: '看示范', guide: '跟打', solo: '独奏' };
const START_TITLE = { demo: '先看一遍示范', guide: '跟着示范音一起打', solo: '关掉示范，自己来' };
const START_TEXT = {
  demo: '音符落到橙线的那一刻，就是该出声的时刻。这一遍只看、只听。',
  guide: '示范音会小声陪着你。你的声音和它叠在一起、听不出先后，就是对上了。',
  solo: '只剩节拍器。先在心里把节奏哼出来，再下手。',
};

// 开发用（截图、检查版式，见 tools/shots.sh）：地址带 ?freeze=第几拍 → 舞台停在打到一半的样子；
// ?result 或 ?result=几颗星 → 直接摆出结算卡片。都不真的打，也不记成绩。
const DEV = new URLSearchParams(location.search);

/**
 * opts:
 *   stages   [{ assist, pass?, text? }]  课程里的分段；不传就是自由模式（自己选示范/跟打/独奏）
 *   onPass(result)   全部通过后点“继续”时调用
 *   onResult(result) 每打完一局调用
 *   fill     true = 外面给了固定的高度，舞台把它占满（练习场的那一页）；不传 = 舞台用自己的高度
 *   aside    放在右边那一栏里、设置下面的东西（一个节点或一组节点）：这个谱面练什么、教练的提示
 */
export function mountGame(container, chartDef, opts = {}) {
  const chart = normalizeChart(chartDef);
  const stages = opts.stages || null;
  const devStage = stages && (DEV.has('freeze') || DEV.has('result')) ? Math.min(1, stages.length - 1) : 0; // 截图时跳过“看示范”那一段
  const state = {
    stage: devStage,
    done: stages ? stages.map(() => false) : [],
    speed: opts.speed || 1,
    assist: stages ? stages[devStage].assist : opts.assist || 'guide',
  };
  let game = null;
  let last = null;

  const pills = h('div', { class: 'stage-pills' });
  const setup = h('div', { class: 'game-setup' });
  const check = h('div', { class: 'gp-check' }); // 接着真机时：“开打之前”的检查
  const holder = h('div', { class: 'gp-stage' });
  const hint = h('p', { class: 'small muted gp-hint' });
  const bench = h('div', { class: 'gp-bench' }); // 接着真机时：它的镜子，你敲哪个键哪个键亮
  const bestBox = h('div', { class: 'gp-best' }); // 这个谱面的最好成绩（打过才有）
  const notReady = h('p', { class: 'small', style: { marginTop: '10px', color: 'var(--accent-text)', fontWeight: '650', display: 'none' } }, '真机还没准备好：先照“开打之前”那张卡片做。');
  const root = h('div', { class: ['game-panel', opts.fill && 'fill'] },
    h('div', { class: 'gp-main' }, holder),
    // 这里的先后就是右边那一栏从上到下的顺序（窄的时候怎么散开，见样式）
    h('div', { class: 'gp-side' }, pills, check, bench, setup, h('div', { class: 'gp-aside' }, opts.aside || null), bestBox, hint));
  const wrap = h('div', { class: ['game-wrap', opts.fill && 'fill'] }, root);
  container.append(wrap);

  // ───────────── 真机镜像 ─────────────
  let gm = null;
  const showNotReady = () => {
    notReady.style.display = gm && gm.known && !gm.ready && state.assist !== 'demo' ? '' : 'none';
  };
  function mountMirror() {
    gm?.destroy();
    gm = null;
    clear(check);
    clear(bench);
    if (mirror.available) {
      gm = gameMirror(chartDef, chart);
      check.append(gm.card);
      bench.append(gm.panel);
      gm.onChange(showNotReady);
    }
    showNotReady();
  }
  // 打着的时候不去定时问机器，免得问答和你敲的音挤在一起
  const busyTimer = setInterval(() => gm?.setBusy(!!game && (game.state === 'countin' || game.state === 'playing')), 200);

  function renderBest() {
    const best = store.data.charts[chart.id];
    bestBox.replaceChildren(...(best ? [
      h('span', { class: 'label' }, '最好成绩'),
      h('span', { class: 'stars' }, [0, 1, 2].map((i) => h('span', { class: i < best.bestStars ? 'on' : '' }, '★'))),
      h('b', {}, `${Math.round((best.bestAccuracy || 0) * 100)}%`),
      h('span', { class: 'small muted' }, `打过 ${best.plays} 次`),
    ] : []));
  }

  function renderPills() {
    clear(pills);
    if (!stages) return;
    stages.forEach((s, i) => {
      pills.append(h('button', {
        type: 'button',
        class: ['stage-pill', i === state.stage && 'now', state.done[i] && 'done'],
        onclick: () => goStage(i),
      }, h('span', { class: 'n' }, state.done[i] ? '✓' : String(i + 1)), STAGE_NAME[s.assist]));
    });
  }

  function renderSetup() {
    clear(setup);
    setup.append(segmented([{ value: 0.7, label: '70%' }, { value: 0.85, label: '85%' }, { value: 1, label: '100%' }], state.speed, (v) => {
      state.speed = v;
      build();
    }, '速度'));
    if (!stages) {
      setup.append(segmented([{ value: 'demo', label: '示范' }, { value: 'guide', label: '跟打' }, { value: 'solo', label: '独奏' }], state.assist, (v) => {
        state.assist = v;
        build();
      }, '模式'));
    }
    setup.append(segmented([{ value: true, label: '开' }, { value: false, label: '关' }], store.settings.metronome, (v) => {
      store.update((d) => (d.settings.metronome = v));
      build();
    }, '节拍器'));
  }

  /** 开始卡片上的一行：这一局用什么打。没接机器时把键盘上的键一个个写出来（触屏上换成“点键帽”） */
  function howToPlay() {
    if (state.assist === 'demo') return null;
    if (midi.connected) return h('p', { class: 'how-keys' }, '直接在 SEQTRAK 上打。');
    const keys = chart.lanes.filter((l) => l.key);
    return [
      h('p', { class: 'how-keys key-only' },
        h('b', {}, '用键盘打'),
        keys.map((l) => h('span', {}, h('kbd', {}, l.key === ' ' ? '空格' : l.key.toUpperCase()), ' ', l.label)),
        h('span', { class: 'muted' }, '也可以点舞台底下的键帽')),
      h('p', { class: 'how-keys touch-only' }, '点舞台底下那排键帽来打，可以几根手指一起点。'),
    ];
  }

  function startCard() {
    const stage = stages?.[state.stage];
    game.showCard(h('div', { class: 'game-card' },
      h('h3', { style: { marginTop: '0' } }, START_TITLE[state.assist]),
      h('p', {}, stage?.text || START_TEXT[state.assist]),
      howToPlay(),
      h('div', { class: 'game-actions' }, h('button', { class: 'btn primary lg', onclick: () => game.start() }, state.assist === 'demo' ? '播放示范' : '开始')),
      h('p', { class: 'small muted key-only', style: { marginTop: '10px' } }, '也可以按 Enter'),
      notReady,
    ));
    showNotReady();
  }

  function build() {
    game?.destroy();
    const stage = stages?.[state.stage];
    game = new RhythmGame(chart, {
      assist: state.assist,
      speed: state.speed,
      metronome: store.settings.metronome,
      inputOffsetMs: store.settings.inputOffsetMs,
      passAccuracy: stage?.pass ?? opts.pass ?? 0.6,
      showKeyHints: !midi.connected,
    });
    game.mount(holder).attachKeyboard();
    if (midi.connected) game.attachMidi(opts.midiMapper);
    game.on('done', onDone);
    game.on('continue', next);
    renderPills();
    startCard();
    hint.textContent = !midi.connected ? '没接机器：点每条轨道底下那块键帽来打（电脑上也可以按键帽下面标的键盘键）。接上 SEQTRAK 后会自动改成听机器。'
      : gm ? '已连接 SEQTRAK：直接在机器上打。镜子上只留了要用的那一块，你敲哪个键，哪个键就亮一下。'
        : '已连接 SEQTRAK：直接在机器上弹，应用听得到。';
    devPreview();
  }

  function devPreview() {
    if (DEV.has('freeze')) game.preview('stage', Number(DEV.get('freeze')) || 6);
    if (!DEV.has('result')) return;
    const stars = DEV.get('result') === '' ? 3 : Number(DEV.get('result'));
    game.preview('result', stars);
    const lv = store.progress().level;
    game.showReward({ gained: 11, from: { ...lv, pct: Math.max(0, (lv.pct || 0) - 0.1) }, to: lv, badges: stars === 3 ? [BADGES[2]] : [] });
  }

  function onDone(result) {
    if (result.demo) return;
    last = result;
    // 这一局涨的经验、升没升级、拿没拿徽章，由结算卡片自己亮出来：先按住全页面的提示条，免得同一件事说两遍
    const before = store.progress();
    const badges = [];
    const offBadge = store.on('badge', (b) => badges.push(b));
    const unhush = store.hush();
    store.recordResult(result);
    unhush();
    offBadge();
    const after = store.progress();
    renderBest();
    game.showReward({ gained: after.xp - before.xp, from: before.level, to: after.level, badges });
    ctx.lastResult = result;
    coach.renderQuick();
    if (stages && result.passed) {
      state.done[state.stage] = true;
      renderPills();
    }
    game.resultExtra?.append(h('button', {
      class: 'btn sm',
      onclick: () => coach.ask('请点评我刚才这一局，告诉我最该改进的一点，以及接下来怎么练。', { note: true }),
    }, '让啾啾深度点评'));
    opts.onResult?.(result);
  }

  function goStage(i) {
    state.stage = i;
    state.assist = stages[i].assist;
    build();
  }

  function next() {
    if (stages && state.stage < stages.length - 1) {
      goStage(state.stage + 1);
      game.start();
    } else {
      opts.onPass?.(last);
    }
  }

  const onKey = (e) => {
    if (e.key !== 'Enter' || e.isComposing || !game) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON' || t.isContentEditable)) return;
    if (game.state === 'idle' || game.state === 'done') {
      e.preventDefault();
      game.start();
    }
  };
  window.addEventListener('keydown', onKey);

  renderSetup();
  renderBest();
  mountMirror();
  build();
  // 真机中途接上 / 拔掉：镜像跟着出现 / 消失；不在打的时候顺便把这一局重新摆好（换成听机器 / 听键盘）
  const offState = midi.on('state', () => {
    mountMirror();
    if (game.state !== 'countin' && game.state !== 'playing') build();
  });

  return {
    get game() {
      return game;
    },
    /** 课程里：是否已经完成了所有需要自己打的阶段 */
    passed: () => (stages ? stages.every((s, i) => s.assist === 'demo' || state.done[i]) : !!last?.passed),
    destroy() {
      window.removeEventListener('keydown', onKey);
      clearInterval(busyTimer);
      offState();
      gm?.destroy();
      game?.destroy();
      wrap.remove();
    },
  };
}
