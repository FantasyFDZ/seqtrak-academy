// 步进网格：一行一条轨道、一格一步。可以点（屏幕上编），可以只读（显示目标或镜像机器）。
import { h } from './util.js';
import { TRACK } from './tracks.js';
import { cleanPattern } from './chart.js';

/**
 * tracks: ['KICK', 'SNARE', …]
 * 返回 { el, get(), set(pattern), setGhost(pattern), mark(target), clearMarks(), setHead(step) }
 * pattern 的形式：{ KICK: 'x---x---x---x---' }
 */
export function patternBoard({ tracks, steps = 16, editable = false, pattern = {}, onChange, caption } = {}) {
  const state = Object.fromEntries(tracks.map((t) => [t, Array(steps).fill(false)]));
  const cells = {};
  const rows = tracks.map((id) => {
    const track = TRACK[id] || { label: id, name: '', color: 'var(--accent)' };
    cells[id] = [];
    const grid = h('div', { class: 'grid-cells', style: { gridTemplateColumns: `repeat(${steps}, 1fr)` } });
    for (let s = 0; s < steps; s++) {
      const cell = h(editable ? 'button' : 'i', { class: 'cell', type: editable ? 'button' : null, title: `${track.label} 第 ${s + 1} 步`, style: { '--c': track.color } });
      cell.style.setProperty('--c', track.color);
      if (editable) {
        cell.addEventListener('click', () => {
          state[id][s] = !state[id][s];
          cell.classList.toggle('on', state[id][s]);
          onChange?.(api.get(), id, s);
        });
      }
      cells[id].push(cell);
      grid.append(cell);
    }
    return h('div', { class: 'grid-row' }, h('div', { class: 'name', style: { color: track.color } }, track.label, h('small', {}, track.name)), grid);
  });

  const nums = h('div', { class: 'grid-nums' }, h('span'), h('div', { style: { gridTemplateColumns: `repeat(${steps}, 1fr)` } },
    Array.from({ length: steps }, (_, s) => (s % 4 === 0 ? h('b', {}, String(s + 1)) : h('span', {}, String(s + 1))))));

  const el = h('div', {}, caption && h('div', { class: 'grid-caption' }, caption), h('div', { class: 'grid-board' }, nums, rows));
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
