// 练习场：谱面库 + 让 AI 按你的弱点出题。
// 列表页：每个谱面一张卡片，封面就是它一圈的图案（彩色 = 要你打的，灰 = 伴奏），封面右下角的圆键是试听。
// 打谱面的那一页：不整页滚动，左边舞台、右边“这一关练什么”和设置（版式在 gamepanel.js 和 app.css）。
import { h } from '../util.js';
import { CHARTS, CHART_GROUPS, chartById } from '../content/charts.js';
import { mountGame } from '../gamepanel.js';
import { normalizeChart, drillToChartDef } from '../chart.js';
import { LoopPlayer } from '../looper.js';
import { sound } from '../sound.js';
import { TRACK } from '../tracks.js';
import { store } from '../store.js';
import { ctx } from '../context.js';
import { api } from '../api.js';
import { toast } from '../ui.js';

const ICON_PLAY = 'M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5Z';
const ICON_STOP = 'M7 6h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z';
const icon = (d) => h('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, h('path', { d }));

const diffDots = (level) => h('span', { class: 'diff', role: 'img', 'aria-label': `难度 ${level}，最高 4` }, [1, 2, 3, 4].map((i) => h('i', { class: i <= level ? 'on' : '' })));

// ───────────── 试听 ─────────────
// 同一时间只放一个谱面；放两圈自己停，再点一下那颗键也停。放的是整个谱面（你要打的 + 伴奏），和“看示范”听到的一样。

const AUDITION_LAPS = 2;
let audition = null; // 正在试听的那一张：{ stop() }

function stopAudition() {
  audition?.stop();
  audition = null;
}

function startAudition(chart, { card, cover, cells, button }) {
  stopAudition();
  const spb = 60 / chart.bpm;
  const byStep = Array.from({ length: chart.stepsPerLoop }, () => []);
  for (const e of [...chart.loopTargets, ...chart.loopBacking]) byStep[e.step]?.push(e);
  const player = new LoopPlayer({ bpm: chart.bpm, steps: chart.stepsPerLoop, swing: chart.swing });
  player.onSchedule = (step, t) => {
    for (const e of byStep[step]) {
      const dur = (e.lenBeats || 0.25) * spb * 0.92;
      if (e.kind === 'drum') sound.drum(e.sound, t, e.vel);
      else if (e.kind === 'chord') for (const n of e.notes) sound.note(n, t, dur, e.voice, e.vel * 0.55);
      else sound.note(e.midi, t, dur, e.voice, e.vel);
    }
  };
  let lit = [];
  const unlight = () => {
    for (const c of lit) c.classList.remove('hit');
    lit = [];
  };
  // 播放头跟着听到的声音走，正响的格子亮一下
  player.onStep((step) => {
    unlight();
    if (step < 0) return;
    cover.style.setProperty('--at', String(step));
    lit = cells[step] || [];
    for (const c of lit) c.classList.add('hit');
  });
  // 放够了自己停（用定时器数，不靠画面刷新：页面被挡住时也停得下来）
  const timer = setTimeout(() => audition === me && stopAudition(), (AUDITION_LAPS * chart.beatsPerLoop * spb + 0.25) * 1000);
  const me = {
    stop() {
      clearTimeout(timer);
      player.stop();
      unlight();
      card.classList.remove('playing');
      cover.style.removeProperty('--at');
      button.replaceChildren(icon(ICON_PLAY));
      button.setAttribute('aria-pressed', 'false');
    },
  };
  audition = me;
  card.classList.add('playing');
  button.replaceChildren(icon(ICON_STOP));
  button.setAttribute('aria-pressed', 'true');
  player.start();
}

// ───────────── 谱面卡片 ─────────────

/** 封面：一行一条轨道，一格一步。返回 { el, cells }，cells[第几步] = 这一步上有音的那些格子（试听时点亮用） */
function coverOf(chart) {
  const n = chart.stepsPerLoop;
  const rows = chart.lanes.map((lane, li) => ({ color: lane.color, steps: new Set(chart.loopTargets.filter((t) => t.lane === li).map((t) => t.step)) }));
  // 伴奏：每种声音一行；行太多（封面放不下）就并成一行
  const backs = new Map();
  for (const b of chart.loopBacking) {
    const key = b.kind === 'drum' ? b.sound : 'note';
    if (!backs.has(key)) backs.set(key, new Set());
    backs.get(key).add(b.step);
  }
  let backRows = [...backs.values()];
  if (rows.length + backRows.length > 5 && backRows.length > 1) backRows = [new Set(backRows.flatMap((s) => [...s]))];
  const cells = Array.from({ length: n }, () => []);
  const row = (steps, color) => h('div', { class: ['cover-row', !color && 'back'] }, Array.from({ length: n }, (_, s) => {
    const on = steps.has(s);
    const cell = h('i', { class: [s % 4 === 0 && 'beat', on && 'on'], style: on && color ? { '--c': color } : {} });
    if (on) cells[s].push(cell);
    return cell;
  }));
  const el = h('div', { class: 'cover', dataset: { n: String(n) }, style: { '--n': String(n), '--loop': `${((chart.beatsPerLoop * 60) / chart.bpm).toFixed(2)}s` } },
    rows.map((r) => row(r.steps, r.color)),
    backRows.map((steps) => row(steps, null)),
    h('span', { class: 'cover-head' }));
  return { el, cells };
}

function chartCard(def) {
  const chart = normalizeChart(def);
  const best = store.data.charts[def.id];
  const tracks = [...Object.keys(def.lanes || {}).map((t) => TRACK[t]?.label || t), def.melody ? '贝斯' : null, def.chords ? '和弦' : null].filter(Boolean);
  const { el: cover, cells } = coverOf(chart);
  const button = h('button', { class: 'cover-play', type: 'button', 'aria-label': `试听「${def.title}」`, 'aria-pressed': 'false', dataset: { sfx: 'none' } }, icon(ICON_PLAY));
  const card = h('div', { class: ['chart-card', best?.bestStars && 'done'] },
    h('a', { href: `#/arcade/${def.id}` },
      cover,
      h('div', { class: 'chart-body' },
        h('div', { class: 'chart-kicker' }, '难度', diffDots(def.level || 1), def.ai && h('span', { class: 'tag accent' }, 'AI 定制')),
        h('h3', {}, def.title),
        h('p', {}, def.desc || ''),
        h('div', { class: 'chart-foot' },
          h('span', { class: 'tag' }, `${def.bpm} BPM`),
          h('span', { class: 'tracks' }, tracks.join(' · ')),
          best && h('span', { class: 'best' },
            h('span', { class: 'stars' }, [0, 1, 2].map((i) => h('span', { class: i < best.bestStars ? 'on' : '' }, '★'))),
            `${Math.round((best.bestAccuracy || 0) * 100)}%`),
        ),
      ),
    ),
    button,
  );
  button.addEventListener('click', () => {
    if (card.classList.contains('playing')) stopAudition();
    else startAudition(chart, { card, cover, cells, button });
  });
  return card;
}

function listView(view) {
  ctx.set('练习场（谱面列表）');
  const request = h('input', { class: 'input', placeholder: '可以不填；也可以说“想练反拍”“来个 Techno 的”“慢一点”', maxlength: '120' });
  const button = h('button', { class: 'btn primary' }, '出一个练习');
  button.addEventListener('click', async () => {
    button.disabled = true;
    const label = button.textContent;
    button.textContent = '啾啾正在出题…';
    try {
      const { drill } = await api.post('/api/coach/drill', { contextText: ctx.describe(), request: request.value.trim() });
      const def = { ...drillToChartDef(drill), group: 'AI 定制', level: 2, desc: drill.why, tip: drill.tip, ai: true };
      store.update((d) => (d.drills = [def, ...d.drills].slice(0, 12)));
      location.hash = `#/arcade/${def.id}`;
    } catch (e) {
      toast(e.code === 'NO_AI' ? '还没有可用的 AI 引擎，先去设置里配置一下。' : e.message, 'bad', 5000);
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  });

  view.append(
    h('div', { class: 'page-head' }, h('h1', {}, '练习场'), h('p', {}, '不赶进度的时候来这里。卡片上面那块就是这个谱面的图案：彩色的格子要你打，灰的是伴奏；右下角的圆键可以先听一遍。进去以后能选“示范 / 跟打 / 独奏”和速度，成绩会记下来给啾啾参考。')),
    h('div', { class: 'card' },
      h('h3', {}, '让啾啾按你的弱点出题'),
      h('p', { class: 'muted', style: { margin: '6px 0 14px' } }, '啾啾会看你最近几局的数据（哪里漏、偏早还是偏晚），写一个专门针对它的节奏，几秒钟就好。'),
      h('div', { class: 'row' }, h('div', { style: { flex: '1', minWidth: '240px' } }, request), button),
    ),
  );

  const section = (title, items) => view.append(
    h('h2', { class: 'group-title' }, title, h('span', {}, `${items.length} 个`)),
    h('div', { class: 'charts' }, items.map(chartCard)));
  const drills = store.data.drills || [];
  if (drills.length) section('AI 定制', drills);
  for (const group of CHART_GROUPS) {
    const items = CHARTS.filter((c) => c.group === group);
    if (items.length) section(group, items);
  }
  return { destroy: stopAudition };
}

function playView(view, id) {
  const def = chartById(id, store.data.drills);
  if (!def) {
    location.hash = '#/arcade';
    return null;
  }
  ctx.set(`练习场 · ${def.title}`, `谱面说明：${def.desc || ''}`);
  // 这一页不整页滚动：标题一行，剩下的高度都给舞台
  view.classList.add('fixed');
  const wrap = h('div', { class: 'play' },
    h('div', { class: 'play-head' },
      h('a', { class: 'back', href: '#/arcade' }, '← 练习场'),
      h('h1', {}, def.title),
      h('div', { class: 'meta' },
        def.ai && h('span', { class: 'tag accent' }, 'AI 定制'),
        h('span', { class: 'small muted' }, '难度'), diffDots(def.level || 1)),
    ),
  );
  view.append(wrap);
  const aside = [
    def.desc && h('p', { class: 'gp-desc' }, def.desc),
    def.tip && h('div', { class: 'callout tip' }, h('b', { class: 'label' }, '啾啾提示'), def.tip),
  ].filter(Boolean);
  const panel = mountGame(wrap, def, { fill: true, aside, onPass: () => (location.hash = '#/arcade') });
  return {
    destroy() {
      panel.destroy();
      view.classList.remove('fixed');
    },
  };
}

export function arcadeView(view, id) {
  return id ? playView(view, id) : listView(view);
}
