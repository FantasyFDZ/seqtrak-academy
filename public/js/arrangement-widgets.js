// 完整版的课（content/arrangement-lessons.js）讲解里用的两个小部件，在 widgets.js 里登记：
//   { widget: 'arrangement', song }          一排 scene（按真实长短、按段落的种类上色），从头放 / 点一段从那里放，放到哪一段哪一段亮
//   { widget: 'arrpattern', song, track, no } 一条轨道的第 no 段乐句画成格子（和完整版页面下面那一栏同一种画法），照着按
// 放音借完整版页面的（song-player.js 的 ArrangementPlayer）；格子是一页一排，照着机器上的 16 个方键画。
import { h } from './util.js';
import { songParts } from './content/song-parts.js';
import { arrangementFor, SECTION_KINDS } from './content/song-arrangements.js';
import { ArrangementPlayer, patternOf, partLength, partEvents } from './song-player.js';
import { LoopPlayer } from './looper.js';
import { audio } from './audio.js';
import { keyLegend } from './views/song-parts.js';
import { TRACK } from './tracks.js';

const mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
const lenWord = (sc) => (sc.steps % 16 ? `${sc.steps / 4} 拍` : `${sc.bars} 小节`);

function arrangement(spec) {
  const data = songParts(spec.song);
  const arr = arrangementFor(spec.song);
  if (!data || !arr) return { el: h('div', { class: 'widget muted' }, '（这首歌还没有完整版）'), destroy() {} };
  const player = new ArrangementPlayer(data, arr);
  const total = (player.total * 60) / data.bpm / 4;
  const blocks = player.scenes.map((sc, i) => {
    const kind = SECTION_KINDS[sc.kind] || SECTION_KINDS.verse;
    return h('button', {
      class: 'arrw-sc', type: 'button', style: { flexGrow: String(Math.max(sc.steps, 6)), '--k': kind.color },
      title: `scene ${i + 1}「${sc.name}」${lenWord(sc)}：点一下从这里放`, dataset: { sfx: 'none' }, onclick: () => from(i),
    }, h('i', {}, String(i + 1)), h('b', {}, sc.name), h('small', {}, lenWord(sc)));
  });
  const playBtn = h('button', { class: 'btn primary', type: 'button', dataset: { sfx: 'none' }, onclick: () => (player.playing ? stop() : from(0)) });
  const now = h('span', { class: 'muted small mono' });
  let at = -1;
  const refresh = () => {
    const si = at >= 0 ? player.sceneAt(at) : -1;
    blocks.forEach((b, i) => {
      const isNow = i === si;
      b.classList.toggle('now', isNow);
      if (isNow) {
        const sc = player.scenes[si];
        b.style.setProperty('--sc-p', `${Math.round(((at - sc.start + 1) / sc.steps) * 100)}%`);
      } else {
        b.style.removeProperty('--sc-p');
      }
    });
    playBtn.textContent = player.playing ? '■ 停' : '▶ 从头放';
    const elapsed = at >= 0 ? ((at + 1) * 60) / data.bpm / 4 : 0;
    now.textContent = si >= 0
      ? `正在放：scene ${si + 1}「${player.scenes[si].name}」 · ${mmss(elapsed)} / ${mmss(total)}`
      : `${player.scenes.length} 个 scene · 从头放完约 ${mmss(total)}`;
  };
  player.onStep((g) => {
    at = g;
    refresh();
  });
  player.onEnd = () => {
    at = -1;
    refresh();
  };
  const from = (i) => {
    player.loop = null;
    player.start(i).then(refresh);
    refresh();
  };
  const stop = () => {
    player.stop();
    at = -1;
    refresh();
  };
  refresh();
  const el = h('div', { class: 'widget arrw' },
    h('div', { class: 'arrw-strip' }, blocks),
    h('div', { class: 'row', style: { marginTop: '8px', gap: '10px', alignItems: 'center' } }, playBtn, now));
  return { el, destroy: () => player.stop() };
}

/**
 * 一段乐句的格子：一排就是机器上的一页（16 个方键），几小节就几排。鼓是亮着的格子（重音深一点）；
 * 合成器写第几个 Synth key（↑ 高一个八度、↓ 低一个八度），拖长的音后面接一截浅色的尾巴；右上角可点试听这段循环
 */
function arrpattern(spec) {
  const data = songParts(spec.song);
  const arr = arrangementFor(spec.song);
  const part = data && arr ? patternOf(data, arr, spec.track, spec.no) : null;
  if (!part) return { el: h('div', { class: 'widget muted' }, '（没有这段乐句）'), destroy() {} };
  const len = partLength(data, part);
  const bars = Math.max(1, Math.ceil(len / 16));
  const totalSteps = bars * 16;
  const cells = Array.from({ length: totalSteps }, () => null);
  if (part.steps) {
    [...part.steps.replace(/[\s|]/g, '')].forEach((c, i) => {
      if (c === 'x' || c === 'X') cells[i] = { hit: true, acc: c === 'X' };
    });
  } else {
    for (const [st, key, n = 1, sh = 0] of part.notes) {
      if (st >= cells.length) continue;
      cells[st] = { key, sh };
      for (let k = 1; k < n && st + k < cells.length && !part.notes.some((x) => x[0] === st + k); k++) cells[st + k] ??= { tail: true };
    }
  }
  const cellNodes = [];
  const rows = Array.from({ length: bars }, (_, b) => h('div', { class: 'arrw-row' },
    h('span', { class: 'arrw-pg' }, `第 ${b + 1} 页`),
    cells.slice(b * 16, b * 16 + 16).map((c, i) => {
      const node = h('i', { class: ['arrw-c', i % 4 === 0 && 'beat', c?.hit && 'hit', c?.acc && 'acc', c?.key && 'note', c?.tail && 'tail'] },
        c?.key ? `${c.key}${c.sh > 0 ? '↑' : c.sh < 0 ? '↓' : ''}` : '');
      cellNodes.push(node);
      return node;
    })));
  const events = partEvents(data, part, totalSteps);
  const stepSec = 60 / data.bpm / 4;
  const player = new LoopPlayer({ bpm: data.bpm, steps: totalSteps, swing: (data.swing || 0) / 120 });
  player.onSchedule = (s, t) => {
    for (const e of events[s] || []) {
      if (e.drum) audio.drum(e.drum, t, e.vel);
      else for (const m of e.midis) audio.note(m, t, e.len * stepSec * 0.92, { voice: e.voice, vel: e.vel });
    }
  };
  let litAt = -1;
  player.onStep((s) => {
    if (litAt >= 0) cellNodes[litAt]?.classList.remove('play-at');
    litAt = s;
    if (s >= 0) cellNodes[s]?.classList.add('play-at');
  });
  const playBtn = h('button', {
    class: 'btn sm arrw-play',
    type: 'button',
    dataset: { sfx: 'none' },
    'aria-pressed': 'false',
    onclick: () => {
      player.toggle();
      playBtn.textContent = player.playing ? '■ 停' : '▶ 试听这段';
      playBtn.classList.toggle('primary', player.playing);
      playBtn.setAttribute('aria-pressed', String(player.playing));
    },
  }, '▶ 试听这段');
  const el = h('div', { class: 'widget arrw-pat', style: { '--c': TRACK[spec.track]?.color || 'var(--accent)' } },
    h('div', { class: 'arrw-pat-head' }, h('b', {}, `${TRACK[spec.track]?.label || spec.track} · 第 ${spec.no} 段`), h('small', {}, `${bars} 小节 · 一排是一页（16 个方键）`), playBtn),
    h('div', { class: 'arrw-rows' }, rows),
    part.notes && h('p', { class: 'muted small', style: { margin: '6px 0 0' } }, `${keyLegend(data, part).replace('上面那一行再高一个八度', '带 ↑ 的再高一个八度').replace('下面那一行再低一个八度', '带 ↓ 的再低一个八度')}`));
  return { el, destroy: () => player.stop() };
}

export const ARRANGEMENT_WIDGETS = { arrangement, arrpattern };
