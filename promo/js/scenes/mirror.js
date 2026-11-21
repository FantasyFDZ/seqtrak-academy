// D 贝斯·音色 → 真机镜像（第 7–8 小节）
// 整台机器（应用里的 device-panel.js）：贝斯弹到哪个 Synth key，哪个键就亮；滤波器旋钮跟着声音一点点拧开，
// 机器上方浮出应用里那块“虚拟小屏”（showHud）。下面是应用里的解说条和三项任务，做到了自动打勾。
import { h, put, setVar, toggle } from '../engine.js';
import { createPanel } from '/js/device-panel.js';
import { SCORE } from '../score.js';
import { at, ease, prog, lerp, clamp, pulse, lastAt } from '../time.js';

const NAMES = { 1: 'D', 2: 'E', 3: 'F♯', 4: 'G', 5: 'A', 6: 'B', 7: 'C♯' };

export function mirrorScene() {
  const T0 = at(7);
  const T1 = at(9);
  const bass = SCORE.bass.filter((n) => n.t >= T0 - 1e-6 && n.t < T1);
  const bt = bass.map((n) => n.t);

  const panel = createPanel({});
  const wrap = h('div', { class: 'mr-panel' }, panel.el);
  const dot = h('i');
  const sayText = h('span', {}, '');
  const say = h('div', { class: 'mr-say' }, dot, sayText);
  const TASKS = [
    { text: '选中 SYNTH 1 这条轨道', at: at(7, 1, 2) },
    { text: '弹出贝斯：键 1 → 键 5', at: at(8, 1, 2) },
    { text: '把滤波器拧开，听它变亮', at: at(8, 3, 2) },
  ];
  const tasks = TASKS.map((tk) => {
    const box = h('i', { class: 'mr-box' });
    const el = h('div', { class: 'mr-task' }, box, h('span', {}, tk.text), h('em', {}, '自动打勾'));
    return { ...tk, el, box };
  });
  const card = h('div', { class: 'mr-card' }, h('div', { class: 'mr-card-t' }, h('b', {}, '现在做什么'), h('span', {}, '第 2 章 · 会走路的贝斯')), tasks.map((t) => t.el), say);
  const el = h('div', { class: 's-mirror' }, wrap, card);

  let lastKey = '';
  function update(t) {
    const kin = ease.outCubic(prog(t, T0 - 0.05, T0 + 0.6));
    const push = ease.inOutCubic(prog(t, T0, T1));
    put(wrap, { y: lerp(-60, 0, kin) + push * 10, s: lerp(0.92, 1, kin) + push * 0.05, o: clamp(kin * 1.4) });
    put(card, { x: lerp(90, 0, ease.outCubic(prog(t, T0 + 0.3, T0 + 0.9))), o: prog(t, T0 + 0.3, T0 + 0.9) });

    // 刚弹的贝斯音
    const i = lastAt(bt, t);
    const n = i >= 0 ? bass[i] : null;
    const held = n && t < n.t + n.dur + 0.04;
    const map = { 'SYNTH1.1': 'green', 'SYNTH1.2': held ? 'green' : null, 'INDEX.FILTER': t >= at(7, 2) ? 'white' : null };
    if (held) map[`SK${n.key}`] = 'green';
    // 滤波器旋钮：从闷到亮
    const k = ease.inOutCubic(prog(t, at(7, 2), at(8, 4)));
    const deg = lerp(-130, 110, k);
    panel.setKnob('SD1', deg);
    const hlNow = t < at(7, 2) ? ['SYNTH1'] : ['SD1'];
    const key = JSON.stringify([map, hlNow]);
    if (key !== lastKey) {
      panel.setLit(map);
      panel.setHighlight(hlNow);
      lastKey = key;
    }
    if (t >= at(7, 2) - 0.2) {
      const v = Math.round(lerp(-50, -6, k));
      panel.showHud('FILTER', v > 0 ? `+${v}` : String(v), clamp(lerp(0.12, 0.95, k)));
    }
    // 解说条
    let text = '在机器上选中 SYNTH 1';
    if (n) text = `SYNTH 1 · 你按了 Synth key ${n.key}（${NAMES[n.key]}）`;
    if (t >= at(7, 3) && n) text = `滤波器 ${Math.round(lerp(8, 95, k))}% · Synth key ${n.key}（${NAMES[n.key]}）`;
    if (sayText.textContent !== text) sayText.textContent = text;
    setVar(dot, '--p', (n ? pulse(t, n.t, 0.2) : 0).toFixed(3));
    // 任务：到点自动打勾
    for (const tk of tasks) {
      const done = t >= tk.at;
      toggle(tk.el, 'done', done);
      const p = ease.outBack(prog(t, tk.at, tk.at + 0.3), 2.4);
      put(tk.box, { s: done ? lerp(0.5, 1, p) : 1 });
    }
  }

  return { id: 'D', t0: T0, t1: T1, el, update };
}
