// 步进网格：一行一条轨道、一格一步。可以点按或按住横扫涂抹（屏幕上编），可以只读（显示目标或镜像机器）。
import { h } from './util.js';
import { TRACK } from './tracks.js';
import { cleanPattern } from './chart.js';
import { audio } from './audio.js';
import { sfx } from './sfx.js';

const DRUM_LANES = new Set(['KICK', 'SNARE', 'CLAP', 'HAT1', 'HAT2', 'PERC1', 'PERC2']);

/**
 * tracks: ['KICK', 'SNARE', …]
 * 返回 { el, get(), set(pattern), setGhost(pattern), mark(target), clearMarks(), setHead(step) }
 * pattern 的形式：{ KICK: 'x---x---x---x---' }
 */
export function patternBoard({ tracks, steps = 16, editable = false, audition = true, pattern = {}, onChange, caption } = {}) {
  const state = Object.fromEntries(tracks.map((t) => [t, Array(steps).fill(false)]));
  const cells = {};
  const cellMeta = new Map();
  let paintVal = null;
  let skipClickCell = null;

  const applyStep = (id, s, val, sound = true) => {
    if (state[id][s] === val) return;
    state[id][s] = val;
    const cell = cells[id][s];
    cell.classList.toggle('on', val);
    cell.setAttribute('aria-pressed', String(val));
    if (sound && audition) {
      if (val && DRUM_LANES.has(id)) audio.init().then((ok) => ok && audio.drum(id, 0, 0.55));
      else sfx.play(val ? 'on' : 'off');
    }
    onChange?.(api.get(), id, s);
  };

  const rows = tracks.map((id) => {
    const track = TRACK[id] || { label: id, name: '', color: 'var(--accent)' };
    cells[id] = [];
    const grid = h('div', { class: 'grid-cells', style: { gridTemplateColumns: `repeat(${steps}, 1fr)` } });
    for (let s = 0; s < steps; s++) {
      const cell = h(editable ? 'button' : 'i', {
        class: 'cell',
        type: editable ? 'button' : null,
        'data-sfx': editable ? 'none' : null,
        'aria-pressed': editable ? 'false' : null,
        title: `${track.label} 第 ${s + 1} 步`,
        style: { '--c': track.color },
      });
      cell.style.setProperty('--c', track.color);
      if (editable) {
        cellMeta.set(cell, { id, s });
        cell.addEventListener('pointerdown', (e) => {
          if (e.button > 0) return;
          paintVal = !state[id][s];
          skipClickCell = cell;
          applyStep(id, s, paintVal, true);
          const end = () => {
            paintVal = null;
            setTimeout(() => { skipClickCell = null; }, 0);
          };
          window.addEventListener('pointerup', end, { once: true, passive: true });
          window.addEventListener('pointercancel', end, { once: true, passive: true });
        });
        cell.addEventListener('click', () => {
          if (skipClickCell === cell) {
            skipClickCell = null;
            return;
          }
          applyStep(id, s, !state[id][s], true);
        });
      }
      cells[id].push(cell);
      grid.append(cell);
    }
    return h('div', { class: 'grid-row' }, h('div', { class: 'name', style: { color: track.color } }, track.label, h('small', {}, track.name)), grid);
  });

  const nums = h('div', { class: 'grid-nums' }, h('span'), h('div', { style: { gridTemplateColumns: `repeat(${steps}, 1fr)` } },
    Array.from({ length: steps }, (_, s) => (s % 4 === 0 ? h('b', {}, String(s + 1)) : h('span', {}, String(s + 1))))));

  const boardEl = h('div', { class: 'grid-board' }, nums, rows);
  if (editable) {
    boardEl.addEventListener('pointermove', (e) => {
      if (paintVal === null) return;
      if (e.pointerType === 'mouse' && !(e.buttons & 1)) {
        paintVal = null;
        return;
      }
      const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest('button.cell');
      const meta = hit && cellMeta.get(hit);
      if (meta) applyStep(meta.id, meta.s, paintVal, true);
    });
  }
  const el = h('div', {}, caption && h('div', { class: 'grid-caption' }, caption), boardEl);
  let head = -1;

  const api = {
    el,
    get() {
      return Object.fromEntries(tracks.map((t) => [t, state[t].map((on) => (on ? 'x' : '-')).join('')]));
    },
    set(p = {}) {
      for (const t of tracks) {
        const str = cleanPattern(p[t] || '');
        for (let s = 0; s < steps; s++) {
          state[t][s] = str[s] === 'x' || str[s] === 'X';
          cells[t][s].classList.toggle('on', state[t][s]);
          if (editable) cells[t][s].setAttribute('aria-pressed', String(state[t][s]));
        }
      }
    },
    /** 用空心框标出“应该在这里”的位置 */
    setGhost(p = {}) {
      for (const t of tracks) {
        const str = cleanPattern(p[t] || '');
        for (let s = 0; s < steps; s++) cells[t][s].classList.toggle('ghost', str[s] === 'x' || str[s] === 'X');
      }
    },
    /** 和目标逐格比较并上色；返回 { ok, missing, extra } */
    mark(target = {}) {
      let missing = 0;
      let extra = 0;
      for (const t of tracks) {
        const str = cleanPattern(target[t] || '');
        for (let s = 0; s < steps; s++) {
          const want = str[s] === 'x' || str[s] === 'X';
          const have = state[t][s];
          const cell = cells[t][s];
          cell.classList.toggle('good', want && have);
          cell.classList.toggle('bad', want !== have);
          cell.classList.toggle('ghost', want && !have);
          if (want && !have) missing++;
          if (!want && have) extra++;
        }
      }
      return { ok: missing === 0 && extra === 0, missing, extra };
    },
    clearMarks() {
      for (const t of tracks) for (const c of cells[t]) c.classList.remove('good', 'bad', 'ghost');
    },
    setHead(step) {
      if (step === head) return;
      for (const t of tracks) {
        cells[t][head]?.classList.remove('head');
        if (step >= 0) cells[t][step]?.classList.add('head');
      }
      head = step;
    },
  };
  api.set(pattern);
  return api;
}
