// G 蓄力 → 键盘学习方式（第 25–26 小节，48–51.5 秒）
// 上面是机器的 16 个 Drum keys，旁边标着电脑上对应的键（应用里键盘学习方式的样子：setKeys）；
// 下面是电脑键盘的两排：Q–I、A–K。军鼓滚奏一下一下按下去，越来越密，画面越推越近；最后一拍全停（啾啾“咦！”在 bird-track.js）。
import { h, put, setVar, toggle } from '../engine.js';
import { createPanel } from '/js/device-panel.js';
import { SCORE } from '../score.js';
import { at, ease, prog, lerp, clamp, pulse } from '../time.js';

const ROWS = ['QWERTYUI', 'ASDFGHJK'];

export function keysScene() {
  const T0 = at(17);
  const T1 = at(18, 4);
  const rolls = SCORE.drums.filter((d) => d.lane === 'SNARE' && d.t >= T0 - 1e-6 && d.t < T1);

  const panel = createPanel({});
  panel.focus(['DRUMKEYS'], { pad: 20, aspect: 3.2 });
  const map = {};
  ROWS.join('').split('').forEach((k, i) => (map[`DK${i + 1}`] = k));
  panel.setKeys(map);
  const top = h('div', { class: 'kb-panel' }, panel.el);
  const caps = ROWS.map((row) => row.split('').map((k) => h('div', { class: 'kb-cap' }, k)));
  const kbd = h('div', { class: 'kb-board' }, caps.map((row, r) => h('div', { class: 'kb-row', style: { '--r': String(r) } }, row)));
  const group = h('div', { class: 'kb-group' }, top, kbd);
  const el = h('div', { class: 's-keys' }, group);

  let lastLit = '';
  function update(t) {
    const kin = ease.outCubic(prog(t, T0 - 0.05, T0 + 0.5));
    const push = ease.inCubic(prog(t, T0, T1));
    const shake = push > 0.6 ? Math.sin(t * 90) * (push - 0.6) * 8 : 0;
    put(group, { y: lerp(80, 0, kin) + shake, x: shake * 0.6, s: lerp(0.94, 1, kin) + push * 0.16, o: clamp(kin * 1.5) });
    let lastI = -1;
    rolls.forEach((r, i) => {
      if (r.t <= t) lastI = i;
    });
    const flat = caps.flat();
    flat.forEach((c, i) => {
      // 第 i 个键最近一次被按是哪一下
      let hit = -9;
      rolls.forEach((r, j) => {
        if (j % 16 === i && r.t <= t) hit = r.t;
      });
      const p = pulse(t, hit, 0.3);
      setVar(c, '--hit', p.toFixed(3));
      put(c, { y: p * 6 });
      toggle(c, 'on', p > 0.02);
    });
    const lit = {};
    if (lastI >= 0 && t - rolls[lastI].t < 0.2) lit[`DK${(lastI % 16) + 1}`] = 'orange';
    rolls.forEach((r, j) => {
      if (r.t <= t && t - r.t < 0.12) lit[`DK${(j % 16) + 1}`] = 'orange';
    });
    const key = JSON.stringify(lit);
    if (key !== lastLit) {
      panel.setLit(lit);
      lastLit = key;
    }
    setVar(el, '--heat', push.toFixed(3));
  }

  return { id: 'G', t0: T0, t1: T1, el, update };
}
