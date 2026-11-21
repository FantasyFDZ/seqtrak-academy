// E 和弦 → 乐理台（第 9–10 小节）
// 照应用里“乐理台”的样子：上面一层是格子（和弦是色带、贝斯是一串小块），下面是两个八度的钢琴键，
// 调里的 7 个音标着 1–7，家（主音 D）是桔红。右边是机器的 7 个 Synth key：CHORD 弹法下一个键就是一个和弦。
import { h, put, setVar, toggle } from '../engine.js';
import { SCORE, chordAt } from '../score.js';
import { at, S, BAR, STEP, ease, prog, lerp, clamp, pulse, lastAt } from '../time.js';

const LOW = 60; // 钢琴从 C4 起，两个八度
const HIGH = 83;
const DEG = { 2: 1, 4: 2, 6: 3, 7: 4, 9: 5, 11: 6, 1: 7 }; // 音级（按 MIDI % 12）→ D 大调第几级
const DEG_NAME = { 1: 'D', 2: 'E', 3: 'F♯', 4: 'G', 5: 'A', 6: 'B', 7: 'C♯' };
const CHORD_INFO = {
  D: { roman: '1 级', kind: '大三和弦', color: 'var(--accent)' },
  A: { roman: '5 级', kind: '大三和弦', color: 'var(--cyan)' },
  Bm: { roman: '6 级', kind: '小三和弦', color: 'var(--violet)' },
  G: { roman: '4 级', kind: '大三和弦', color: 'var(--ok)' },
};
const isBlack = (m) => [1, 3, 6, 8, 10].includes(m % 12);

export function theoryScene() {
  const T0 = at(9);
  const T1 = at(11);
  const BARS = [9, 10];
  const bass = SCORE.bass.filter((n) => n.t >= T0 - 1e-6 && n.t < T1);

  // ── 格子：4 小节，一格 = 十六分
  const RW = 1040;
  const cellW = RW / 32;
  const bands = BARS.map((bar) => {
    const c = chordAt(bar);
    const info = CHORD_INFO[c.name];
    return h('div', { class: 'th-band', style: { left: `${(bar - 9) * 16 * cellW}px`, width: `${16 * cellW - 6}px`, '--c': info.color } }, h('b', {}, c.name), h('span', {}, info.roman));
  });
  const bassBlocks = bass.map((n) => {
    const x = ((n.t - T0) / STEP) * cellW;
    const pc = ((n.midi % 12) + 12) % 12;
    const y = 74 - (DEG[pc] || 1) * 8;
    return h('i', { class: 'th-bass', style: { left: `${x}px`, top: `${y}px`, width: `${Math.max(8, (n.dur / STEP) * cellW - 3)}px` } });
  });
  const head = h('i', { class: 'th-head' });
  const roll = h('div', { class: 'th-roll' },
    h('div', { class: 'th-lane th-lane-mel' }, h('em', {}, '旋律'), h('span', {}, '下一段')),
    h('div', { class: 'th-lane th-lane-ch' }, h('em', {}, '和弦'), bands),
    h('div', { class: 'th-lane th-lane-bass' }, h('em', {}, '贝斯'), bassBlocks),
    Array.from({ length: 9 }, (_, i) => h('i', { class: ['th-beat', i % 4 === 0 && 'bar'], style: { left: `${i * 4 * cellW}px` } })),
    head);

  // ── 钢琴
  const whites = [];
  const blacks = [];
  for (let m = LOW; m <= HIGH; m++) (isBlack(m) ? blacks : whites).push(m);
  const WW = RW / whites.length;
  const keyEls = new Map();
  whites.forEach((m, i) => {
    const d = DEG[m % 12];
    const el = h('div', { class: ['th-w', d === 1 && 'home'], style: { left: `${i * WW}px`, width: `${WW - 4}px` } },
      d ? h('span', { class: 'th-deg' }, String(d)) : null, h('small', {}, d ? DEG_NAME[d] : ''));
    keyEls.set(m, el);
  });
  blacks.forEach((m) => {
    const wi = whites.indexOf(m - 1);
    const d = DEG[m % 12];
    const el = h('div', { class: 'th-b', style: { left: `${(wi + 1) * WW - WW * 0.32 - 2}px`, width: `${WW * 0.64}px` } }, d ? h('span', { class: 'th-deg' }, String(d)) : null);
    keyEls.set(m, el);
  });
  const piano = h('div', { class: 'th-piano' }, [...keyEls.values()].sort((a, b) => a.classList.contains('th-b') - b.classList.contains('th-b')));
  const bench = h('div', { class: 'th-bench' },
    h('div', { class: 'th-top' }, h('b', {}, '乐理台'), h('span', {}, 'D 大调 · 家是 D')),
    roll, piano);

  // ── 右边：现在这个和弦，和机器上的 7 个键
  const chName = h('b', {}, 'D');
  const chRoman = h('span', {}, '1 级');
  const chKind = h('small', {}, '大三和弦');
  const notesRow = h('div', { class: 'th-notes' });
  const sks = Array.from({ length: 7 }, (_, i) => h('div', { class: 'th-sk' }, h('i'), h('b', {}, String(i + 1)), h('small', {}, DEG_NAME[i + 1])));
  const side = h('div', { class: 'th-side' },
    h('div', { class: 'th-chord' }, h('div', { class: 'th-chord-top' }, chRoman, chKind), chName, notesRow),
    h('div', { class: 'th-machine' }, h('div', { class: 'th-machine-t' }, h('b', {}, 'CHORD 弹法'), h('span', {}, '机器上一个键，就是一个和弦')), h('div', { class: 'th-sks' }, sks)));
  const el = h('div', { class: 's-theory' }, bench, side);

  let lastName = '';
  function update(t) {
    const kin = ease.outCubic(prog(t, T0 - 0.05, T0 + 0.6));
    put(bench, { y: lerp(80, 0, kin), o: clamp(kin * 1.4) });
    put(side, { x: lerp(80, 0, ease.outCubic(prog(t, T0 + 0.2, T0 + 0.8))), o: prog(t, T0 + 0.2, T0 + 0.8) });
    const bar = Math.min(10, Math.floor((t - T0) / BAR) + 9);
    const c = chordAt(bar);
    const info = CHORD_INFO[c.name];
    const tb = S(bar, 0);
    const p = pulse(t, tb, 0.35);
    // 播放线
    head.style.left = `${((t - T0) / STEP) * cellW}px`;
    bands.forEach((b, i) => {
      toggle(b, 'now', i === bar - 9);
      toggle(b, 'past', i < bar - 9);
      const k = ease.outBack(prog(t, S(9 + i, 0) - 0.4 + i * 0.06, S(9 + i, 0) - 0.1 + i * 0.06), 1.6);
      put(b, { sy: lerp(0.3, 1, i === 0 ? ease.outBack(prog(t, T0, T0 + 0.35)) : k), o: i === 0 ? 1 : clamp(k * 2) });
    });
    bassBlocks.forEach((b, i) => toggle(b, 'on', bass[i].t <= t));
    // 钢琴：这个和弦的三个音亮；贝斯的根音（搬到这两个八度里）跟着拍子闪
    const bi = lastAt(bass.map((n) => n.t), t);
    const bn = bi >= 0 ? bass[bi] : null;
    const bassPc = bn ? bn.midi % 12 : -1;
    for (const [m, el2] of keyEls) {
      const on = c.pad.includes(m);
      toggle(el2, 'on', on);
      setVar(el2, '--c', info.color);
      setVar(el2, '--hit', on ? p.toFixed(3) : '0');
      const bassHere = m < 72 && m % 12 === bassPc && bn && t < bn.t + bn.dur;
      toggle(el2, 'bass', !!bassHere);
    }
    // 右边
    if (lastName !== c.name) {
      chName.textContent = c.name;
      chRoman.textContent = info.roman;
      chKind.textContent = info.kind;
      notesRow.replaceChildren(...c.pad.map((m) => h('i', {}, DEG_NAME[DEG[m % 12]])));
      lastName = c.name;
    }
    setVar(side, '--c', info.color);
    put(chName, { s: 1 + p * 0.22 });
    sks.forEach((k, i) => {
      toggle(k, 'on', i + 1 === c.deg);
      setVar(k, '--hit', i + 1 === c.deg ? p.toFixed(3) : '0');
    });
  }

  return { id: 'E', t0: T0, t1: T1, el, update };
}
