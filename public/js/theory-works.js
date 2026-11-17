// 小本子：乐理线的小作品都收在这里（#/classroom/works）。能重放、能删，还能送到屏幕上的模拟机里，按 [PLAY] 听它在机器上转。
// 作品存在进度文件的 works 里（theory-toys.js 的 saveWork 写的，最多留 30 条）：
//   第一期（T17）  { at, level, root, scale, notes }                 notes = 一串键号，没有长短
//   第二期         再加 cells [[第几格起, 占几格, 键号]]、steps、bpm；T27 还有 chords（四格各是第几级）、bass [[起, 长, 键号]]、end（收尾落在哪个键上）
// 旧的没有 cells：按“每个音两格”摆。
import { h, clear, rich } from './util.js';
import { store } from './store.js';
import { ctx } from './context.js';
import { sfx } from './sfx.js';
import { simulator } from './simulator.js';
import { SCALES } from './scales.js';
import { levelById } from './content/classroom.js';
import { createTheoryBench, LADDERS, nameOf } from './theory-bench.js';

const SCALE_WORD = { minor: '小调', major: '大调', penta: '小调五声' };
const SCALE_ID = { minor: 0, major: 1, penta: 2 }; // 机器的 [SCALE]：从上往下第几盏（0 起）
const SIM_PROJECT = 7; // 送到模拟机的 8 号工程：前面几个留给课程
const when = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getMonth() + 1} 月 ${d.getDate()} 日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** 一件作品里的旋律：[{ s, l, m }]（旧的只有 notes：每个音占两格） */
export const cellsOf = (w) => (w.cells ? w.cells.map(([s, l, m]) => ({ s, l, m })) : (w.notes || []).map((m, i) => ({ s: i * 2, l: 2, m })));
const stepsOf = (w) => w.steps || Math.max(16, Math.ceil(((w.notes || []).length * 2) / 16) * 16);

/**
 * 把一件作品翻成模拟机认的一段循环（simulator.seedProject 的写法）：旋律一条轨、和弦一条轨（CHORD 弹法）、贝斯一条轨。
 * 音都在梯子上，所以都能写成“第几个 Synth key + 高低几层”。翻不了的音（不在梯子上）跳过。
 */
export function simSeed(w) {
  const offsets = SCALES[SCALE_ID[w.scale] ?? 0].offsets;
  const key = (((w.root ?? 60) - 60) % 12 + 12) % 12;
  const keyOf = (m, base = 0) => {
    const rel = m - 60 - key - 12 * base;
    const oct = Math.floor(rel / 12);
    const k = offsets.slice(0, w.scale === 'penta' ? 5 : 7).indexOf(rel - 12 * oct);
    return k < 0 ? null : [k + 1, oct];
  };
  const steps = stepsOf(w);
  const bars = steps > 16 ? 2 : 1;
  const mel = cellsOf(w).map((n) => [n, keyOf(n.m)]).filter(([, k]) => k).map(([n, [k, oct]]) => [n.s, k, n.l, oct]);
  const hasChords = Array.isArray(w.chords) && w.chords.some(Boolean);
  const melTrack = hasChords ? 'DX' : 'SYNTH1';
  const seed = { settings: { tempo: w.bpm || 96, scale: SCALE_ID[w.scale] ?? 0, key }, poly: { [melTrack]: 1 }, octave: { [melTrack]: 0 }, bars: { [melTrack]: bars }, keys: { [melTrack]: mel } };
  if (hasChords) {
    const len = steps / w.chords.length;
    seed.poly.SYNTH2 = 2;
    seed.octave.SYNTH2 = 0;
    seed.bars.SYNTH2 = bars;
    seed.keys.SYNTH2 = w.chords.map((d, i) => (d ? [i * len, d, len] : null)).filter(Boolean);
    seed.poly.SYNTH1 = 0;
    seed.octave.SYNTH1 = -1;
    seed.bars.SYNTH1 = bars;
    seed.keys.SYNTH1 = (w.bass || []).filter((b) => b[2] !== null).map(([s, l, m]) => [[s, l], keyOf(m, -1)]).filter(([, k]) => k).map(([[s, l], [k, oct]]) => [s, k, l, oct]);
  }
  return seed;
}

export function worksPage(view, headEl) {
  const list = () => store.data.works || [];
  const bench = createTheoryBench({ top: 'roll' });
  bench.locked = false;
  let cur = -1; // 现在摆在台子上的是第几件（works 里的下标）
  let armed = -1; // 点了一次“删”的那一件：再点一次才真删
  const cards = h('div', { class: 'tw-list' });
  const title = h('b', {}, '点左边的一件作品');
  const sub = h('span', { class: 'muted' });
  const playBtn = h('button', { class: 'btn primary lg', type: 'button', 'data-sfx': 'none' }, '▶ 放');
  const simBtn = h('button', { class: 'btn', type: 'button' }, '送到模拟机上放');
  const note = h('p', { class: 'tw-note' });
  const simHost = h('div', { class: 'tw-sim' });
  const stage = h('section', { class: 'tw-stage', hidden: true }, h('header', {}, h('div', { class: 'tw-title' }, title, sub), playBtn, simBtn), bench.el, note, simHost);
  const empty = h('div', { class: 'tw-empty' }, h('p', { html: rich('小本子还是空的，啾。乐理线每个单元的最后一关是一件**小作品**：写好了点「收进小本子」，它就在这儿了。') }),
    h('div', { class: 'row' }, h('a', { class: 'btn primary', href: '#/classroom/T17' }, '去写第一件：让它回家 →'), h('a', { class: 'btn', href: '#/classroom/T22' }, '一问一答'), h('a', { class: 'btn', href: '#/classroom/T27' }, '搭一段')));
  const page = h('div', { class: 'cl-page cl-list tw-page', style: { '--c': 'var(--violet)' } }, headEl, h('div', { class: 'tw-body' }, cards, stage, empty));
  view.append(page);

  /** 把一件作品摆到台子上：梯子、格子里的旋律、和弦、贝斯（有收尾的，接在最后） */
  function scoreOf(w) {
    bench.set({ ladder: { root: w.root ?? 60, offsets: LADDERS[w.scale] || LADDERS.minor, degrees: w.scale === 'penta' ? [1, 3, 4, 5, 7] : undefined }, home: true, degrees: true, top: 'roll' });
    const steps = stepsOf(w);
    const sc = { steps, bpm: w.bpm || 96, chords: [], bass: [], mel: cellsOf(w) };
    if (Array.isArray(w.chords)) {
      const len = steps / w.chords.length;
      sc.chords = w.chords.map((d, i) => (d ? { s: i * len, l: len, notes: bench.chordOf(d) } : null)).filter(Boolean);
      sc.bass = (w.bass || []).filter((b) => b[2] !== null).map(([s, l, m]) => ({ s, l, m }));
      if (w.end && sc.chords[0]) {
        // 收尾：转回第 1 格，停住
        sc.chords.push({ s: steps, l: len, notes: sc.chords[0].notes });
        if (sc.bass[0]) sc.bass.push({ s: steps, l: len, m: sc.bass[0].m });
        sc.mel.push({ s: steps, l: len, m: w.end });
        sc.steps = steps + len;
      }
    }
    return sc;
  }
  const nameOfWork = (w) => levelById(w.level)?.title || '小作品';

  function open(i, play = true) {
    const w = list()[i];
    if (!w) return;
    cur = i;
    armed = -1;
    simulator.unmount();
    clear(simHost);
    const sc = scoreOf(w);
    bench.rollShow(sc, { tone: sc.chords.length > 0 });
    bench.chord(null);
    title.textContent = `${nameOfWork(w)} · ${when(w.at)}`;
    sub.textContent = `家在 ${nameOf(w.root ?? 60)} · ${SCALE_WORD[w.scale] || ''} · ${cellsOf(w).length} 个音${w.chords ? ` · 和弦 ${w.chords.join(' → ')}` : ''}`;
    note.innerHTML = rich(w.cells ? '' : '这一件写的时候没有分长短：每个音都按两格摆。');
    stage.hidden = false;
    paint();
    if (play) playIt();
  }
  function playIt() {
    const w = list()[cur];
    if (!w) return;
    const sc = scoreOf(w);
    bench.rollShow(sc, { tone: sc.chords.length > 0 });
    bench.playScore(sc);
  }
  function remove(i) {
    if (armed !== i) {
      armed = i;
      return paint();
    }
    store.update((d) => {
      d.works.splice(i, 1);
    });
    sfx.play('tick');
    armed = -1;
    if (cur === i) {
      bench.stop();
      simulator.unmount();
      clear(simHost);
      cur = -1;
      stage.hidden = true;
    } else if (cur > i) cur--;
    paint();
  }
  /** 送到模拟机上：摆进 8 号工程，机器就摆在下面，按 [PLAY] 听 */
  function toSim() {
    const w = list()[cur];
    if (!w) return;
    bench.stop();
    simulator.blankProject(SIM_PROJECT);
    simulator.seedProject(SIM_PROJECT, simSeed(w));
    simulator.gotoProject(SIM_PROJECT);
    simHost.replaceChildren(simulator.mount({ tips: false }));
    simulator.highlight(['PLAY']);
    const tracks = w.chords ? '旋律在 **DX**，和弦在 **SYNTH 2**（CHORD 弹法，机器的一摞是四层），贝斯在 **SYNTH 1**' : '旋律在 **SYNTH 1**';
    note.innerHTML = rich(`摆进了模拟机的 **8 号工程**：${tracks}。按一下左侧面最下面的 **[PLAY]** 听它转起来；按 SYNTH 1 这些旋钮，能看到方键上亮着你写的格子。真机上应用不往机器里写东西：想在真机上听，就照着模拟机亮的格子自己填一遍。`);
    simHost.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  /** 卡片上的小图：音高连成的一条线 */
  function spark(w) {
    const mel = cellsOf(w);
    if (!mel.length) return null;
    const steps = Math.max(stepsOf(w), ...mel.map((n) => n.s + n.l));
    const lo = Math.min(...mel.map((n) => n.m));
    const hi = Math.max(...mel.map((n) => n.m));
    const y = (m) => 22 - ((m - lo) / Math.max(1, hi - lo)) * 18;
    return h('svg', { viewBox: '0 0 120 26', class: 'tw-spark', 'aria-hidden': 'true' }, mel.map((n) => h('line', { x1: (n.s / steps) * 120 + 1, x2: ((n.s + n.l) / steps) * 120 - 1, y1: y(n.m), y2: y(n.m), class: (n.m - (w.root ?? 60)) % 12 === 0 ? 'home' : '' })));
  }

  function paint() {
    const works = list();
    empty.hidden = works.length > 0;
    cards.hidden = !works.length;
    cards.replaceChildren(...works.map((w, i) => ({ w, i })).reverse().map(({ w, i }) => {
      const del = h('button', { class: ['btn ghost sm', armed === i && 'danger'], type: 'button', 'data-sfx': 'none' }, armed === i ? '再点一次，真的删' : '删');
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        remove(i);
      });
      const card = h('div', { class: ['tw-card', i === cur && 'on'], role: 'button', tabindex: 0, 'data-i': i },
        h('span', { class: 'no' }, w.level || '?'),
        h('div', { class: 'words' }, h('b', {}, nameOfWork(w)), h('span', {}, `${when(w.at)} · ${cellsOf(w).length} 个音`)),
        spark(w), del);
      card.addEventListener('click', () => open(i));
      card.addEventListener('keydown', (e) => e.key === 'Enter' && open(i));
      return card;
    }));
    ctx.set('小课堂 · 小本子（乐理线的小作品）', works.length ? `一共 ${works.length} 件：${works.map((w) => `${w.level}「${nameOfWork(w)}」`).join('、')}。能重放、删掉、送到模拟机的 8 号工程里按 [PLAY] 听。` : '还没有作品。每个单元最后一关（T17、T22、T27）写好了会收进来。');
  }

  playBtn.addEventListener('click', playIt);
  simBtn.addEventListener('click', toSim);
  paint();
  if (list().length) open(list().length - 1, false);
  page.works = { open, remove, toSim, bench, simSeed, list }; // 给走查脚本用
  return {
    destroy() {
      bench.destroy();
      simulator.unmount();
    },
  };
}
