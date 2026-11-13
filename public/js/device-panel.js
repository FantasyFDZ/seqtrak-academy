// SEQTRAK 面板（SVG）。控件位置依据官方手册的整机图（docs/seqtrak-operation-reference.md 1.8 节），
// 是帮助你找到按键的示意图，不是精确外观。既能当“会高亮的地图”，也能当模拟机的外壳（可点、可长按、可转）。
// 有意和实物不同的一处：实物的方键颜色跟着所在面板走（灰区是灰键），照那样画在屏幕上分不清键和机身，
// 所以这里一律画成浅色键帽。用户确认过这样可以，不要“改回去”。
//
// 控件 id：
//   旋钮  ALL KICK SNARE CLAP HAT1 HAT2 PERC1 PERC2 SYNTH1 SYNTH2 DX SAMPLER / SD1–SD4 / FX
//   键    DK1–DK16（Drum keys）、REC（Record key）、SK1–SK7（Synth keys）
//   左侧  VOL+ VOL- DELETE MUTE SOLO PAGE PLAY
//   右侧  USB PHONES AUDIOIN MIDI BPM+ BPM- SWING PROJECT
//   上缘  BARLENGTH OCTAVE SCALE KEY RECSAMPLE UNDO CLEARFX      下缘  SDPAGE FXPAGE
//   其它  MASTERSINGLE FXLEVEL HIGHPASS REPEATER INDEX METER SPEAKER
//   组    DRUMKEYS SYNTHKEYS DRUMKNOBS SYNTHKNOBS TRACKKNOBS SDKNOBS LEFTSIDE RIGHTBUTTONS JACKS TOPKEYS SLIDERS
//         ZONE_DRUM ZONE_SYNTH ZONE_FX
import { h } from './util.js';

const W = 1000;
const H = 280;
const C = {
  body: '#f0562b',
  bodyDark: '#d9441b',
  gray: '#d3d5d9',
  grayDark: '#b3b7bd',
  knob: '#2b2e34',
  knobTop: '#454951',
  key: '#f1f2f3',
  keyEdge: '#9da2aa',
  ink: '#3d4148', // 印在灰色机身（左、中）上的字
  inkGray: '#4a1d0e', // 印在桔红机身（右）上的字
  out: '#3f444c',
  outDim: '#8a9099',
  led: '#9a9ea6',
  orangeDim: '#a93612', // 桔红区里没亮的文字
  orangeDeep: '#8f2c10',
  hl: '#00b8d9',
};
const LED = { yellow: '#ffd21f', white: '#ffffff', cyan: '#18d7e0', blue: '#3d7bff', purple: '#b56bff', red: '#ff3b30', green: '#34d058', orange: '#ff8a3d' };

const TRACK_KNOBS = [
  ['ALL', 78, 47, 'ALL'], ['KICK', 172, 47, 'KICK'], ['SNARE', 266, 47, 'SNARE'], ['CLAP', 361, 47, 'CLAP'],
  ['HAT1', 78, 141, 'HAT 1'], ['HAT2', 172, 141, 'HAT 2'], ['PERC1', 266, 141, 'PERC 1'], ['PERC2', 361, 141, 'PERC 2'],
  ['SYNTH1', 453, 47, 'SYNTH 1'], ['SYNTH2', 548, 47, 'SYNTH 2'], ['DX', 453, 141, 'DX'], ['SAMPLER', 548, 141, 'SAMPLER'],
];
const DRUM_X = [54, 101, 148, 195, 242, 289, 336, 383];
const SYNTH_X = [432, 478, 524, 572];
const ROW_Y = [212, 259];
const LEFT = [['VOL+', 'VOL +', 25], ['VOL-', 'VOL −', 64], ['DELETE', 'DELETE', 105], ['MUTE', 'MUTE', 144], ['SOLO', 'SOLO', 181], ['PAGE', 'PAGE', 220], ['PLAY', '⏻ / PLAY', 259]];
const RIGHT = [['USB', 'USB', 28, 'jack'], ['PHONES', 'PHONES', 64, 'jack'], ['AUDIOIN', 'AUDIO IN', 97, 'jack'], ['MIDI', 'MIDI', 130, 'jack'], ['BPM+', 'BPM +', 168, 'btn'], ['BPM-', 'BPM −', 198, 'btn'], ['SWING', 'SWING', 230, 'btn'], ['PROJECT', 'PROJECT ↑', 261, 'btn']];
const TOP = [['BARLENGTH', 'BAR LENGTH', 432, 0], ['OCTAVE', 'OCTAVE', 466, 1], ['SCALE', 'SCALE', 501, 0], ['KEY', 'KEY', 536, 1], ['RECSAMPLE', 'REC SAMPLE', 570, 0], ['UNDO', 'UNDO/REDO', 725, 0], ['CLEARFX', 'CLEAR FX', 796, 1]];
export const INDEX_LABELS = ['SOUND', 'PITCH', 'MONO/POLY', 'CHORD', 'PAN', 'VOLUME', 'ATTACK', 'DECAY', 'MICROTIMING', 'FILTER', 'RESONANCE', 'REVERB', 'DELAY', 'COMP', 'DISTORTION', 'MODULATION', 'DUCKER', 'OTHER', 'MIXER', 'SONG'];
const METER_Y = [48, 74, 101, 127, 155, 181, 208, 234];
const SD_Y = [48, 109, 171, 233];

export const GROUPS = {
  DRUMKEYS: Array.from({ length: 16 }, (_, i) => `DK${i + 1}`),
  SYNTHKEYS: Array.from({ length: 7 }, (_, i) => `SK${i + 1}`),
  DRUMKNOBS: ['KICK', 'SNARE', 'CLAP', 'HAT1', 'HAT2', 'PERC1', 'PERC2'],
  SYNTHKNOBS: ['SYNTH1', 'SYNTH2', 'DX', 'SAMPLER'],
  TRACKKNOBS: ['KICK', 'SNARE', 'CLAP', 'HAT1', 'HAT2', 'PERC1', 'PERC2', 'SYNTH1', 'SYNTH2', 'DX', 'SAMPLER'],
  SDKNOBS: ['SD1', 'SD2', 'SD3', 'SD4'],
  LEFTSIDE: ['VOL+', 'VOL-', 'DELETE', 'MUTE', 'SOLO', 'PAGE', 'PLAY'],
  RIGHTBUTTONS: ['BPM+', 'BPM-', 'SWING', 'PROJECT'],
  JACKS: ['USB', 'PHONES', 'AUDIOIN', 'MIDI'],
  TOPKEYS: ['BARLENGTH', 'OCTAVE', 'SCALE', 'KEY', 'RECSAMPLE'],
  SLIDERS: ['FXLEVEL', 'HIGHPASS', 'REPEATER'],
};
const KNOB_IDS = new Set(['ALL', ...GROUPS.TRACKKNOBS, ...GROUPS.SDKNOBS, 'FX']);

const text = (x, y, s, opts = {}) =>
  h('text', { x, y, 'font-size': opts.size || 8, 'font-weight': opts.weight || 700, fill: opts.fill || C.ink, 'text-anchor': opts.anchor || 'middle', 'font-family': 'ui-monospace, "SF Mono", Menlo, Consolas, monospace', 'letter-spacing': opts.spacing || 0, 'pointer-events': 'none' }, s);

/**
 * opts:
 *   highlight, lit        初始的高亮与亮灯
 *   onPick(id)            只当地图用时：点了哪个控件
 *   onDown(id) / onUp(id, 按住的毫秒数, 是否转过) / onTurn(id, ±1)   当模拟机外壳用时的原始手势
 */
export function createPanel({ highlight = [], lit = {}, onPick, onDown, onUp, onTurn } = {}) {
  const parts = new Map(); // id → { node, ring }
  const leds = new Map();
  const knobLines = new Map();
  const interactive = !!(onPick || onDown || onUp || onTurn);

  const reg = (id, node, ring) => {
    parts.set(id, { node, ring });
    node.dataset.id = id;
    if (!interactive) return node;
    node.setAttribute('class', 'ctl');
    let downAt = 0;
    let lastY = 0;
    let turned = false;
    node.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try {
        node.setPointerCapture(e.pointerId); // 手指滑出去也能收到松开
      } catch {
        /* 有的输入方式不支持捕获，不影响使用 */
      }
      downAt = performance.now();
      lastY = e.clientY;
      turned = false;
      node.classList.add('down');
      onPick?.(id);
      onDown?.(id);
    });
    node.addEventListener('pointermove', (e) => {
      if (!downAt || !KNOB_IDS.has(id) || !onTurn) return;
      const dy = lastY - e.clientY; // 往上拖 = 顺时针
      if (Math.abs(dy) >= 14) {
        turned = true;
        lastY = e.clientY;
        node.classList.remove('down');
        onTurn(id, dy > 0 ? 1 : -1);
      }
    });
    const up = () => {
      if (!downAt) return;
      const ms = performance.now() - downAt;
      downAt = 0;
      node.classList.remove('down');
      onUp?.(id, ms, turned);
    };
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', up);
    if (KNOB_IDS.has(id) && onTurn) {
      node.addEventListener('wheel', (e) => {
        e.preventDefault();
        onTurn(id, e.deltaY < 0 ? 1 : -1);
      }, { passive: false });
    }
    return node;
  };

  const svg = h('svg', { class: 'panel-svg', viewBox: `-84 -40 ${W + 178} ${H + 66}`, role: 'img', 'aria-label': 'SEQTRAK 面板' });
  const layer = h('g');
  const rings = h('g', { 'pointer-events': 'none' });
  const holds = h('g', { 'pointer-events': 'none' });

  // 机身：左边和中间（鼓区、合成器区）是灰色，右边（音色与效果区）是桔红；下面一道投影
  layer.append(
    h('rect', { x: 3, y: 7, width: W, height: H, rx: 16, fill: '#00000022' }),
    h('rect', { x: 0, y: 0, width: W, height: H, rx: 14, fill: C.gray }),
    h('path', { d: `M596 0 H${W - 14} a14 14 0 0 1 14 14 V${H - 14} a14 14 0 0 1 -14 14 H596 Z`, fill: C.body }),
    h('rect', { x: 0, y: 0, width: W, height: H, rx: 14, fill: 'none', stroke: '#00000040', 'stroke-width': 1.5 }),
    h('line', { x1: 407, y1: 8, x2: 407, y2: H - 8, stroke: C.grayDark, 'stroke-width': 1.5 }),
    h('rect', { x: 83, y: -20, width: 84, height: 20, rx: 3, fill: '#1c1d20' }),
    text(125, -6, 'YAMAHA', { size: 9, fill: '#e9ebee', spacing: 1.5 }),
  );

  for (const [id, x, w] of [['ZONE_DRUM', 33, 372], ['ZONE_SYNTH', 410, 185], ['ZONE_FX', 599, 369]]) {
    parts.set(id, { node: null, ring: { type: 'rect', x, y: 4, w, h: H - 8, r: 10 } });
  }

  // Track knobs + 各自的 3 个 LED
  for (const [id, x, y, label] of TRACK_KNOBS) {
    const g = h('g');
    const line = h('line', { x1: x, y1: y - 15, x2: x, y2: y - 8, stroke: '#f1f2f3', 'stroke-width': 2.2, 'stroke-linecap': 'round' });
    knobLines.set(id, { line, x, y });
    g.append(
      h('circle', { cx: x, cy: y + 2, r: 17.5, fill: '#00000030' }),
      h('circle', { cx: x, cy: y, r: 17, fill: C.knob }),
      h('circle', { cx: x, cy: y, r: 11, fill: C.knobTop }),
      line,
    );
    [-15, 0, 16].forEach((dy, i) => {
      const led = h('circle', { cx: x + 31, cy: y + dy, r: 2.8, fill: C.led });
      leds.set(`${id}.${i + 1}`, led);
      g.append(led);
    });
    g.append(text(x, y < 100 ? y + 31 : y - 25, label, { size: 8.5 }));
    layer.append(reg(id, g, { type: 'circle', x, y, r: 23 }));
  }

  // 方形键
  const key = (id, x, y, kind, label) => {
    const g = h('g');
    g.append(
      h('rect', { x: x - 20, y: y - 18, width: 40, height: 40, rx: 6, fill: '#00000026' }),
      h('rect', { x: x - 20, y: y - 20, width: 40, height: 40, rx: 6, fill: C.key, stroke: C.keyEdge, 'stroke-width': 1 }),
    );
    const led = kind === 'rec'
      ? h('circle', { cx: x, cy: y, r: 5, fill: '#c3c6cb' })
      : h('rect', { x: x - 10, y: y - 3, width: 20, height: 6, rx: 3, fill: '#c3c6cb' });
    leds.set(id, led);
    g.append(led);
    if (label) g.append(text(x, y + 16, label, { size: 7, fill: '#8a8f98', weight: 600 }));
    layer.append(reg(id, g, { type: 'rect', x: x - 23, y: y - 23, w: 46, h: 46, r: 8 }));
  };
  for (let r = 0; r < 2; r++) for (let c = 0; c < 8; c++) key(`DK${r * 8 + c + 1}`, DRUM_X[c], ROW_Y[r], 'drum', String(r * 8 + c + 1));
  key('REC', SYNTH_X[0], ROW_Y[0], 'rec', '');
  for (let i = 1; i <= 3; i++) key(`SK${i}`, SYNTH_X[i], ROW_Y[0], 'synth', String(i));
  for (let i = 4; i <= 7; i++) key(`SK${i}`, SYNTH_X[i - 4], ROW_Y[1], 'synth', String(i));

  // 左侧面：7 个按钮（画得比实物大一些，方便点）
  for (const [id, label, y] of LEFT) {
    const g = h('g');
    g.append(h('rect', { x: -16, y: y - 12, width: 18, height: 24, rx: 4, fill: C.grayDark, stroke: '#00000055' }), text(-22, y + 3, label, { size: 8.5, anchor: 'end', fill: C.out }));
    layer.append(reg(id, g, { type: 'rect', x: -20, y: y - 16, w: 26, h: 32, r: 6 }));
  }
  // 右侧面：4 个接口 + 4 个按钮
  for (const [id, label, y, kind] of RIGHT) {
    const g = h('g');
    if (kind === 'jack') g.append(h('rect', { x: W - 4, y: y - 7, width: 8, height: 14, rx: 2, fill: '#15161a', stroke: '#0008' }));
    else g.append(h('rect', { x: W - 2, y: y - 11, width: 18, height: 22, rx: 4, fill: C.bodyDark, stroke: '#00000055' }));
    g.append(text(W + 22, y + 3, label, { size: 8.5, anchor: 'start', fill: kind === 'jack' ? C.outDim : C.out }));
    layer.append(reg(id, g, { type: 'rect', x: W - 8, y: y - 15, w: 28, h: 30, r: 6 }));
  }
  // 上缘按钮
  for (const [id, label, x, row] of TOP) {
    const g = h('g');
    g.append(h('rect', { x: x - 12, y: -12, width: 24, height: 14, rx: 4, fill: x > 596 ? C.bodyDark : C.grayDark, stroke: '#00000055' }), text(x, row ? -17 : -28, label, { size: 7.5, fill: C.out }));
    if (!row) g.append(h('line', { x1: x, y1: -25, x2: x, y2: -14, stroke: C.outDim, 'stroke-width': 0.8 }));
    layer.append(reg(id, g, { type: 'rect', x: x - 16, y: -16, w: 32, h: 22, r: 6 }));
  }
  // 下缘按钮
  for (const [id, label, x] of [['SDPAGE', 'SOUND DESIGN PAGE', 725], ['FXPAGE', 'FX PAGE', 796]]) {
    const g = h('g');
    g.append(h('rect', { x: x - 12, y: H - 2, width: 24, height: 14, rx: 4, fill: C.bodyDark, stroke: '#00000055' }), text(id === 'SDPAGE' ? x - 14 : x + 6, H + 23, label, { size: 7.5, fill: C.out }));
    layer.append(reg(id, g, { type: 'rect', x: x - 16, y: H - 6, w: 32, h: 22, r: 6 }));
  }

  // Index（一列会亮的文字）与 Global Meter
  const indexG = h('g');
  indexG.append(h('rect', { x: 600, y: 10, width: 62, height: 262, rx: 6, fill: '#00000000' }));
  INDEX_LABELS.forEach((s, i) => {
    const t = text(631, 23.5 + i * 12.68, s, { size: 6, fill: C.orangeDim, weight: 700 });
    leds.set(`INDEX.${s}`, t);
    indexG.append(t);
  });
  layer.append(reg('INDEX', indexG, { type: 'rect', x: 600, y: 10, w: 62, h: 262, r: 6 }));
  const meterG = h('g');
  meterG.append(h('rect', { x: 668, y: 36, width: 20, height: 210, rx: 8, fill: '#00000000' }));
  METER_Y.forEach((y, i) => {
    const led = h('circle', { cx: 678, cy: y, r: 3.4, fill: C.orangeDim });
    leds.set(`METER.${8 - i}`, led); // METER.8 是最上面那个
    meterG.append(led);
  });
  layer.append(reg('METER', meterG, { type: 'rect', x: 668, y: 36, w: 20, h: 210, r: 8 }));

  // Sound Design knobs、FX 旋钮
  const smallKnob = (id, x, y, label) => {
    const g = h('g');
    const line = h('line', { x1: x, y1: y - 13, x2: x, y2: y - 7, stroke: '#f1f2f3', 'stroke-width': 2.2, 'stroke-linecap': 'round' });
    knobLines.set(id, { line, x, y });
    g.append(h('circle', { cx: x, cy: y + 2, r: 15, fill: '#00000030' }), h('circle', { cx: x, cy: y, r: 14.5, fill: C.knob }), h('circle', { cx: x, cy: y, r: 9, fill: C.knobTop }), line);
    if (label) g.append(text(x, y + 26, label, { size: 7.5, fill: C.inkGray }));
    layer.append(reg(id, g, { type: 'circle', x, y, r: 20 }));
  };
  SD_Y.forEach((y, i) => smallKnob(`SD${i + 1}`, 725, y, i === 0 ? 'SOUND' : ''));
  smallKnob('FX', 796, 48, 'FX');

  // MASTER / SINGLE 开关
  const sw = h('g');
  sw.append(h('rect', { x: 782, y: 104, width: 28, height: 12, rx: 6, fill: C.orangeDeep }), h('circle', { cx: 789, cy: 110, r: 5, fill: C.knob }), text(796, 99, 'MASTER  SINGLE', { size: 5.6, fill: C.inkGray }));
  layer.append(reg('MASTERSINGLE', sw, { type: 'rect', x: 776, y: 92, w: 40, h: 28, r: 6 }));

  // 三条触摸滑条
  const slider = (id, x, label) => {
    const g = h('g');
    g.append(h('rect', { x: x - 14, y: 170, width: 28, height: 84, rx: 7, fill: C.bodyDark, stroke: '#b93a14' }));
    for (let i = 0; i < 7; i++) g.append(h('line', { x1: x - 8, y1: 180 + i * 10.6, x2: x + 8, y2: 180 + i * 10.6, stroke: C.orangeDeep, 'stroke-width': 1.4, 'stroke-linecap': 'round' }));
    g.append(text(x, 162, label, { size: 6.8, fill: C.inkGray }));
    layer.append(reg(id, g, { type: 'rect', x: x - 18, y: 152, w: 36, h: 106, r: 9 }));
  };
  slider('FXLEVEL', 796, 'FX LEVEL');
  slider('HIGHPASS', 865, 'HIGH PASS');
  slider('REPEATER', 935, 'REPEATER');

  // 扬声器 / 麦克风
  const spk = h('g');
  spk.append(h('rect', { x: 833, y: 8, width: 135, height: 128, rx: 8, fill: C.bodyDark }));
  for (let r = 0; r < 9; r++) for (let c = 0; c < 10; c++) spk.append(h('circle', { cx: 846 + c * 12.2, cy: 22 + r * 12.4, r: 2.2, fill: C.orangeDeep }));
  spk.append(text(956, 19, 'MIC', { size: 6, fill: C.inkGray }));
  layer.append(reg('SPEAKER', spk, { type: 'rect', x: 829, y: 4, w: 143, h: 136, r: 10 }));

  svg.append(layer, holds, rings);

  const resolve = (ids) => (ids || []).flatMap((id) => GROUPS[id] || [id]);

  const ringNode = (ring, attrs) => (ring.type === 'circle'
    ? h('circle', { cx: ring.x, cy: ring.y, r: ring.r, fill: 'none', ...attrs })
    : h('rect', { x: ring.x, y: ring.y, width: ring.w, height: ring.h, rx: ring.r, fill: 'none', ...attrs }));

  /** 闪烁的青色圈：“看这里 / 按这里” */
  function setHighlight(ids) {
    rings.replaceChildren();
    for (const id of resolve(ids)) {
      const ring = parts.get(id)?.ring;
      if (!ring) continue;
      rings.append(
        ringNode(ring, { stroke: '#ffffff', 'stroke-width': 6, opacity: 0.85, class: 'hl' }),
        ringNode(ring, { stroke: C.hl, 'stroke-width': 3.5, class: 'hl' }),
      );
    }
  }

  /** 常亮的深色圈：这个键正被“按住” */
  function setHeld(ids) {
    holds.replaceChildren();
    for (const id of resolve(ids)) {
      const ring = parts.get(id)?.ring;
      if (!ring) continue;
      holds.append(ringNode(ring, { stroke: '#ffffff', 'stroke-width': 7 }), ringNode(ring, { stroke: '#1b1d21', 'stroke-width': 3.5 }));
    }
  }

  /** 短暂闪一下某个控件（答对 / 答错的反馈） */
  function flash(id, color = '#34d058', ms = 700) {
    const ring = parts.get(id)?.ring;
    if (!ring) return;
    const nodes = [ringNode(ring, { stroke: '#ffffff', 'stroke-width': 8 }), ringNode(ring, { stroke: color, 'stroke-width': 4.5 })];
    holds.append(...nodes);
    setTimeout(() => nodes.forEach((n) => n.remove()), ms);
  }

  /** 点亮指示灯：{ DK1: 'yellow', 'KICK.1': 'yellow', 'METER.8': 'white', 'INDEX.SOUND': 'white' } */
  function setLit(map) {
    for (const [id, node] of leds) {
      const color = LED[map?.[id]] || null;
      const isText = id.startsWith('INDEX.');
      const base = isText || id.startsWith('METER.') ? C.orangeDim : id.includes('.') ? C.led : '#c3c6cb';
      node.setAttribute('fill', color ? (isText ? '#ffffff' : color) : base);
      if (isText) node.setAttribute('font-weight', color ? 900 : 700);
      else node.style.filter = color ? `drop-shadow(0 0 3.5px ${color})` : '';
    }
  }

  /** 把旋钮的指示线转到某个角度（度，0 = 朝上） */
  function setKnob(id, deg) {
    const k = knobLines.get(id);
    if (k) k.line.setAttribute('transform', `rotate(${deg} ${k.x} ${k.y})`);
  }

  const FULL_VIEW = svg.getAttribute('viewBox');

  // 左侧那一列键的字印在键的左边：取景的时候要把字也框进来
  const LABEL_ON_LEFT = new Set(GROUPS.LEFTSIDE);

  /** 这几个控件合起来占的那块地方（图上的单位）；一个也认不得就返回 null。labels = 连印在旁边的字一起算 */
  function boxOf(ids, labels = false) {
    const list = resolve(ids).map((id) => [id, parts.get(id)?.ring]).filter(([, r]) => r);
    if (!list.length) return null;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [id, r] of list) {
      const [a, b, c, d] = r.type === 'circle' ? [r.x - r.r, r.y - r.r, r.x + r.r, r.y + r.r] : [r.x, r.y, r.x + r.w, r.y + r.h];
      x0 = Math.min(x0, labels && LABEL_ON_LEFT.has(id) ? a - 58 : a);
      y0 = Math.min(y0, b);
      x1 = Math.max(x1, c);
      y1 = Math.max(y1, d);
    }
    return { x0, y0, x1, y1 };
  }

  /**
   * 这几个控件现在在屏幕上的哪儿（视口坐标的矩形，和 getBoundingClientRect 一样的字段）。
   * 气泡要指着某个键的时候用。图还没画到页面上、或者一个也认不得，返回 null。
   */
  function spot(ids) {
    const box = boxOf(ids);
    const m = box && svg.getScreenCTM();
    if (!m) return null;
    const left = m.a * box.x0 + m.e;
    const top = m.d * box.y0 + m.f;
    const right = m.a * box.x1 + m.e;
    const bottom = m.d * box.y1 + m.f;
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  }

  /**
   * 只看这几个控件所在的那一块：把它们放大到占满这张图。不传（或传空）就看回整台。
   * 位置窄、键又要看清的场合用（比如音游旁边那面镜子只需要 7 个 Synth keys）。图本身不变，变的只是取景。
   *   pad    控件外面留多少边
   *   minW   取景至少这么宽（图上的单位，整台是 1000）：只有一个键的时候不至于放得太大、看不出它在哪
   *   aspect 取景的宽 / 高：给了就把短的那一边补足，这样不管圈的是哪几个键，这张图占的地方一样大
   */
  function focus(ids, { pad = 24, minW = 0, aspect = 0 } = {}) {
    const box = boxOf(ids, true);
    el.classList.toggle('zoomed', !!box);
    if (!box) {
      svg.setAttribute('viewBox', FULL_VIEW);
      return;
    }
    const { x0, y0, x1, y1 } = box;
    let x = x0 - pad;
    let y = y0 - pad;
    let w = x1 - x0 + 2 * pad;
    let hh = y1 - y0 + 2 * pad;
    const grow = (nw, nh) => {
      x -= (nw - w) / 2;
      y -= (nh - hh) / 2;
      w = nw;
      hh = nh;
    };
    if (w < minW) grow(minW, hh);
    if (aspect) {
      if (w / hh > aspect) grow(w, w / aspect);
      else grow(hh * aspect, hh);
    }
    // 不取到整台外面去
    const [fx, fy, fw, fh] = FULL_VIEW.split(' ').map(Number);
    w = Math.min(w, fw);
    hh = Math.min(hh, fh);
    x = Math.max(fx, Math.min(x, fx + fw - w));
    y = Math.max(fy, Math.min(y, fy + fh - hh));
    svg.setAttribute('viewBox', `${Math.round(x)} ${Math.round(y)} ${Math.round(w)} ${Math.round(hh)}`);
  }

  setHighlight(highlight);
  setLit(lit);
  const el = h('div', { class: 'panel-wrap' }, svg);
  const panel = { el, svg, setHighlight, setHeld, setLit, setKnob, flash, focus, spot, has: (id) => parts.has(id) };
  recent.push(panel);
  if (recent.length > 24) recent.shift();
  return panel;
}

// 最近画出来的几张面板：啾啾要知道“屏幕上有没有机器的图”（指哪讲哪、回答里说到某个键时飞过去），见 coach.js
const recent = [];

/** 现在屏幕上看得见的面板，大的在前 */
export function shownPanels() {
  const out = [];
  for (const p of recent) {
    if (!p.el.isConnected) continue;
    const r = p.svg.getBoundingClientRect();
    const w = Math.min(r.right, innerWidth) - Math.max(r.left, 0);
    const ht = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
    if (w > 160 && ht > 60) out.push([w * ht, p]);
  }
  return out.sort((a, b) => b[0] - a[0]).map(([, p]) => p);
}

/** 把节奏串变成“该亮哪些 Drum keys”：'x---x---x---x---' → { DK1:'yellow', DK5:'yellow', … } */
export function patternToLit(pattern, color = 'yellow') {
  const out = {};
  const p = String(pattern).replace(/[\s|]/g, '');
  for (let i = 0; i < Math.min(16, p.length); i++) if (p[i] === 'x' || p[i] === 'X') out[`DK${i + 1}`] = color;
  return out;
}
