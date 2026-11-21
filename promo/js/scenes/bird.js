// F 啾啾·采样（第 19–24 小节，36–48 秒）
//   19：啾啾从右上飞进来，“早，啾！”
//   20：飞到机器的 Synth key 5 上方悬停、啄一下——指哪讲哪
//   21–22：学舌：你弹四个音（键亮），它落在机器边上一模一样地唱回来
//   23–24：采样：机器换成“采样台”，波形是它的一声“啾”，7 个垫子跟着旋律亮；它站在台子上跟着拍子点头
// 啾啾本身在 bird-track.js 里排走位，这里只放机器、采样台、音符，并告诉它几个“落脚点”在哪。
import { h, put, setVar, toggle, stageBox } from '../engine.js';
import { createPanel } from '/js/device-panel.js';
import { SCORE, synthKey } from '../score.js';
import { at, S, STEP, ease, prog, lerp, clamp, pulse } from '../time.js';

export function birdScene(engine) {
  const T0 = at(11);
  const T1 = at(17);
  const SAMP = at(15) - 0.5; // 换成采样台
  const you = SCORE.lead.filter((n) => n.echo === 'you');
  const melody = SCORE.lead.filter((n) => n.t >= at(15) - 1e-6 && n.t < T1);
  const echoes = SCORE.calls.filter((c) => c.call === 'echo' && c.t >= T0 && c.t < T1)
    .flatMap((c) => c.opts.notes.map(([dt, m]) => ({ t: c.t + dt, midi: m, key: synthKey(m) })));

  // ── 机器（只看合成器那一块）
  const panel = createPanel({});
  panel.focus(['SYNTH1', 'SYNTH2', 'DX', 'SAMPLER', 'SYNTHKEYS'], { pad: 30, aspect: 2.2 });
  const card = h('div', { class: 'bd-card' }, panel.el);

  // ── 采样台：一声“啾”的波形 + 7 个垫子
  const WAVE_W = 1120;
  const pts = [];
  for (let i = 0; i <= 280; i++) {
    const x = i / 280;
    const env = x < 0.04 ? x / 0.04 : Math.exp(-(x - 0.04) * 3.2) * (1 + 0.25 * Math.sin(x * 40));
    pts.push([x * WAVE_W, env * (0.75 + 0.25 * Math.sin(i * 1.7)) * Math.sin(i * 2.3)]);
  }
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${(70 - y * 60).toFixed(1)}`).join(' ');
  const wave = h('svg', { class: 'sp-wave', viewBox: `0 0 ${WAVE_W} 140`, preserveAspectRatio: 'none' },
    h('path', { d: `${d}`, fill: 'none', 'stroke-width': 3 }),
    h('rect', { class: 'sp-head', x: 0, y: 0, width: 4, height: 140 }));
  const head = wave.querySelector('.sp-head');
  const pads = Array.from({ length: 7 }, (_, i) => h('div', { class: 'sp-pad' }, h('b', {}, String(i + 1)), h('small', {}, ['D', 'E', 'F♯', 'G', 'A', 'B', 'C♯'][i])));
  const sampler = h('div', { class: 'sp-card' },
    h('div', { class: 'sp-top' }, h('span', { class: 'sp-rec' }, h('i'), 'REC SAMPLE'), h('b', {}, '采样台'), h('span', { class: 'sp-name' }, '一声“啾” · 0.4 秒')),
    wave, h('div', { class: 'sp-pads' }, pads));

  // ── 学舌时的小标签
  const tagYou = h('div', { class: 'bd-tag' }, '你弹');
  const tagBird = h('div', { class: 'bd-tag by-bird' }, '它学');
  // 飘出来的音符
  const notes = echoes.map((e, i) => h('span', { class: 'bd-note' }, ['♪', '♫', '♩', '♬'][i % 4]));
  const el = h('div', { class: 's-bird' }, card, sampler, tagYou, tagBird, notes);

  // 给啾啾的落脚点（舞台坐标；第一次用到时量）
  const stage = engine.stageEl;
  engine.spots.sk5 = () => {
    const r = stageBox(panel.svg.querySelector('[data-id="SK5"]'), stage);
    return [r.cx + 6, r.y - 34];
  };
  engine.spots.perch = () => {
    const r = stageBox(card, stage);
    return [r.x + r.w - 170, r.y + 4];
  };
  engine.spots.sampler = () => {
    const r = stageBox(sampler, stage);
    return [r.x + r.w - 190, r.y + 4];
  };

  let lastKey = '';
  function update(t) {
    const kin = ease.outCubic(prog(t, T0 - 0.1, T0 + 0.6));
    const swap = ease.inOutCubic(prog(t, SAMP, SAMP + 0.45));
    put(card, { y: lerp(90, 0, kin) + swap * 60, o: clamp(kin * 1.4) * (1 - swap), s: 1 - swap * 0.04 });
    put(sampler, { y: lerp(60, 0, swap), o: swap, s: lerp(0.96, 1, swap) });
    sampler.style.display = t >= SAMP ? '' : 'none';
    card.style.display = swap < 1 ? '' : 'none';
    const out = ease.inCubic(prog(t, at(16, 4), T1));
    if (out > 0) put(sampler, { y: out * 80, o: 1 - out });

    // 机器上的键：你弹的亮绿色，它学的亮黄色；第 20 小节啾啾指着键 5
    const map = {};
    for (const n of you) if (t >= n.t && t < n.t + 0.2) map[`SK${n.key}`] = 'green';
    for (const e of echoes) if (e.t < at(15) && t >= e.t && t < e.t + 0.18) map[`SK${e.key}`] = 'yellow';
    const hl = t >= at(12, 2) && t < at(13) ? ['SK5'] : [];
    const key = JSON.stringify([map, hl]);
    if (key !== lastKey && t < SAMP + 0.5) {
      panel.setLit(map);
      panel.setHighlight(hl);
      lastKey = key;
    }
    // 标签
    const youOn = t >= at(13) - 0.1 && t < at(15) - 0.2 && ((t - at(13)) % 2) < 1.0;
    const birdOn = t >= at(13, 3) - 0.1 && t < at(15) - 0.2 && ((t - at(13)) % 2) >= 1.0;
    put(tagYou, { o: youOn ? 1 : 0, y: youOn ? 0 : 10 });
    put(tagBird, { o: birdOn ? 1 : 0, y: birdOn ? 0 : 10 });
    // 飘出来的音符（从啾啾的嘴边）
    const [bx, by] = engine.bird?.pos || [0, 0];
    echoes.forEach((e, i) => {
      const age = t - e.t;
      const n = notes[i];
      if (age < 0 || age > 1.1) return put(n, { o: 0 });
      const k = age / 1.1;
      put(n, { x: bx + 40 + (i % 3) * 18 + k * 60, y: by - 190 - k * 120, s: lerp(0.7, 1.3, k), r: lerp(-10, 14, k), o: k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85 });
    });
    // 采样台：播放线跟着每个音从头扫一遍；垫子跟着旋律亮
    let cur = null;
    for (const n of melody) if (t >= n.t) cur = n;
    const age = cur ? t - cur.t : 9;
    head.setAttribute('x', String(clamp(age / 0.5) * (WAVE_W - 4)));
    pads.forEach((p, i) => {
      const on = cur && cur.key === i + 1 && age < cur.dur + 0.05;
      toggle(p, 'on', !!on);
      setVar(p, '--hit', on ? pulse(t, cur.t, 0.3).toFixed(3) : '0');
    });
    setVar(wave, '--hit', cur ? pulse(t, cur.t, 0.3).toFixed(3) : '0');
  }

  return { id: 'F', t0: T0, t1: T1, el, update };
}
