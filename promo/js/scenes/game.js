// C 音游（第 5–6 小节）
// 照应用里音游舞台的样子画（game.js：三条轨道、下落的音符、判定线、连击、判定字、步进条），
// 音符就是这几小节里真的鼓点，落到判定线的那一刻正好是声音响的那一刻。右边一栏是“镜子”：机器上被敲的那个键亮一下。
import { h, put, setVar, toggle } from '../engine.js';
import { createPanel } from '/js/device-panel.js';
import { SCORE } from '../score.js';
import { at, BEAT, STEP, INTRO, stepIn, ease, prog, lerp, clamp, pulse, lastAt } from '../time.js';

const LANES = [
  { lane: 'KICK', label: 'KICK', name: '底鼓', key: 'SK1' },
  { lane: 'CLAP', label: 'CLAP', name: '拍手', key: 'SK3' },
  { lane: 'HAT1', label: 'HAT 1', name: '闭镲', key: 'SK4' },
];
const SW = 720; // 舞台宽
const SH = 800; // 画布高
const LOOK = 2.0; // 音符从出现到落地 2 秒
const JUDGE = SH - 92; // 判定线
const GRADES = { perfect: 'PERFECT', great: 'GREAT' };

export function gameScene() {
  const T0 = at(5);
  const T1 = at(7);
  const notes = SCORE.drums
    .filter((d) => d.t >= T0 - 1e-6 && d.t < T1 && LANES.some((l) => l.lane === d.lane))
    .map((d, i) => ({ ...d, li: LANES.findIndex((l) => l.lane === d.lane), i }));
  // 两下 GREAT，别的都是 PERFECT（看起来像真人在打）
  notes.forEach((n) => (n.grade = n.i === 13 || n.i === 29 ? 'great' : 'perfect'));
  const times = notes.map((n) => n.t);

  const canvas = h('canvas', { width: SW, height: SH, class: 'gm-canvas' });
  const ctx = canvas.getContext('2d');
  const comboNum = h('b', {}, '0');
  const combo = h('div', { class: 'gm-combo' }, comboNum, h('span', {}, '连击'));
  const banner = h('div', { class: 'gm-banner' });
  const flies = LANES.map(() => h('div', { class: 'gm-fly' }));
  const keys = LANES.map((l) => h('div', { class: 'gm-key', style: { '--c': `var(--t-${l.lane})` } }, h('b', {}, l.label), h('span', {}, l.name)));
  const tallyP = h('b', {}, '0');
  const tallyG = h('b', {}, '0');
  const acc = h('b', {}, '—');
  const head = h('div', { class: 'gm-head' },
    h('span', { class: 'gm-sub' }, '120 BPM · 跟打'),
    h('span', { class: 'gm-tally' }, h('i', { class: 'p' }, 'PERFECT ', tallyP), h('i', { class: 'g' }, 'GREAT ', tallyG)),
    h('span', { class: 'gm-acc' }, h('small', {}, '准确率'), acc));
  // 步进条：三条轨道 × 16 格，打中的那一格亮
  const cells = LANES.map((l) => Array.from({ length: 16 }, (_, s) => h('i', { class: ['gm-cell', s % 4 === 0 && 'beat'], style: { '--c': `var(--t-${l.lane})` } })));
  const steps = h('div', { class: 'gm-steps' }, LANES.map((l, li) => h('div', { class: 'gm-row' }, h('em', { style: { color: `var(--t-${l.lane})` } }, l.label), cells[li])));
  const stageEl = h('div', { class: 'gm-stage' }, head, h('div', { class: 'gm-pit' }, canvas, h('div', { class: 'gm-keys' }, keys), flies, combo, banner), steps);

  // 右边：镜子（机器上打鼓模式时，Synth keys 1 / 3 / 4 是 KICK / CLAP / HAT 1）
  const panel = createPanel({});
  panel.focus(['SYNTHKEYS'], { pad: 26, aspect: 2.4 });
  const mirrorNote = h('div', { class: 'gm-note' }, h('i'), h('span', {}, ''));
  const mirror = h('div', { class: 'gm-mirror' }, h('div', { class: 'gm-mirror-t' }, h('b', {}, '镜子'), h('span', {}, '你在 SEQTRAK 上敲哪个键，这里就亮哪个')), panel.el, mirrorNote);
  const el = h('div', { class: 's-game' }, stageEl, mirror);

  let pal = null;
  const css = (name) => getComputedStyle(el).getPropertyValue(name).trim();
  let lastLit = '';

  function draw(t) {
    if (!pal) {
      pal = {
        lane: LANES.map((l) => css(`--t-${l.lane}`)),
        a: css('--stage-lane-a'),
        b: css('--stage-lane-b'),
        ink: css('--stage-ink'),
        accent: css('--accent'),
        perfect: css('--g-perfect'),
      };
    }
    ctx.clearRect(0, 0, SW, SH);
    const lw = SW / LANES.length;
    LANES.forEach((_, i) => {
      ctx.fillStyle = i % 2 ? pal.b : pal.a;
      ctx.fillRect(i * lw, 0, lw, SH);
      // 打中的那一下，这条轨道整条亮一下
      const ni = lastAt(times.filter((_, k) => notes[k].li === i), t);
      const lt = ni >= 0 ? times.filter((_, k) => notes[k].li === i)[ni] : -9;
      const p = pulse(t, lt, 0.3);
      if (p > 0.01) {
        const g = ctx.createLinearGradient(0, JUDGE, 0, JUDGE - 420);
        g.addColorStop(0, hexA(pal.lane[i], 0.32 * p));
        g.addColorStop(1, hexA(pal.lane[i], 0));
        ctx.fillStyle = g;
        ctx.fillRect(i * lw, JUDGE - 420, lw, 420);
      }
    });
    // 拍线、小节线
    const y = (tn) => JUDGE - ((tn - t) / LOOK) * (JUDGE + 40);
    const b0 = Math.floor((t - INTRO - 0.4) / BEAT);
    for (let b = b0; b < b0 + 8; b++) {
      const tb = INTRO + b * BEAT;
      const yy = y(tb);
      if (yy < -10 || yy > SH) continue;
      const bar = b % 4 === 0;
      ctx.fillStyle = `rgba(${pal.ink}, ${bar ? 0.28 : 0.1})`;
      ctx.fillRect(0, yy - (bar ? 1 : 0.5), SW, bar ? 2 : 1);
      if (bar) {
        ctx.font = '700 18px Consolas, monospace';
        ctx.fillStyle = `rgba(${pal.ink}, .4)`;
        ctx.fillText(String(((b / 4) % 4) + 1), 10, yy - 8);
      }
    }
    // 判定线
    ctx.save();
    ctx.shadowColor = pal.accent;
    ctx.shadowBlur = 24;
    ctx.fillStyle = pal.accent;
    ctx.fillRect(0, JUDGE - 2, SW, 4);
    ctx.restore();
    // 音符
    for (const n of notes) {
      const dt = n.t - t;
      if (dt < -0.02 || dt > LOOK + 0.1) continue;
      const yy = y(n.t);
      const x = n.li * lw + lw * 0.14;
      const w = lw * 0.72;
      ctx.save();
      ctx.shadowColor = pal.lane[n.li];
      ctx.shadowBlur = 20;
      ctx.fillStyle = pal.lane[n.li];
      roundRect(ctx, x, yy - 13, w, 26, 13);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      roundRect(ctx, x + 10, yy - 9, w - 20, 5, 2.5);
      ctx.fill();
    }
    // 打中的那一下：一圈 + 溅出去的碎片
    for (const n of notes) {
      const age = t - n.t;
      if (age < 0 || age > 0.45) continue;
      const k = age / 0.45;
      const cx = n.li * lw + lw / 2;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = n.grade === 'perfect' ? pal.perfect : pal.lane[n.li];
      ctx.lineWidth = 6 * (1 - k) + 1;
      ctx.beginPath();
      ctx.ellipse(cx, JUDGE, lw * 0.3 + k * lw * 0.35, 18 + k * 30, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = pal.lane[n.li];
      for (let s = 0; s < 9; s++) {
        const a = -Math.PI * (0.1 + 0.8 * rnd(n.i * 31 + s));
        const v = 220 + 380 * rnd(n.i * 17 + s * 3);
        const px = cx + Math.cos(a) * v * age;
        const py = JUDGE + Math.sin(a) * v * age + 900 * age * age;
        ctx.fillRect(px - 3, py - 3, 6, 6);
      }
      ctx.restore();
    }
  }

  function update(t) {
    // 镜头：进场时舞台从下面推上来，之后慢慢往前推一点
    const kin = ease.outCubic(prog(t, T0 - 0.05, T0 + 0.5));
    const push = prog(t, T0, T1);
    put(stageEl, { y: lerp(120, 0, kin), s: 1 + push * 0.04, o: clamp(kin * 1.5) });
    put(mirror, { x: lerp(80, 0, ease.outCubic(prog(t, T0 + 0.25, T0 + 0.8))), o: prog(t, T0 + 0.25, T0 + 0.8) });
    draw(t);

    const hi = lastAt(times, t);
    const done = hi + 1;
    const greats = notes.slice(0, done).filter((n) => n.grade === 'great').length;
    comboNum.textContent = String(done);
    tallyP.textContent = String(done - greats);
    tallyG.textContent = String(greats);
    acc.textContent = done ? `${Math.round(((done - greats * 0.3) / done) * 100)}%` : '—';
    const cp = hi >= 0 ? pulse(t, times[hi], 0.25) : 0;
    put(combo, { s: 1 + cp * 0.18, o: done ? 1 : 0 });
    const heat = done >= 32 ? 3 : done >= 16 ? 2 : done >= 8 ? 1 : 0;
    stageEl.dataset.heat = String(heat);
    // 里程碑横幅：到 16、32 连击
    const ms = [16, 32].map((m) => (notes[m - 1] ? notes[m - 1].t : 99));
    const mt = ms.filter((x) => x <= t).pop();
    if (mt !== undefined && t - mt < 1.1) {
      banner.textContent = `${t >= ms[1] ? 32 : 16} 连击！`;
      const k = (t - mt) / 1.1;
      put(banner, { s: lerp(1.6, 1, ease.outBack(Math.min(1, k * 4))), o: k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25 });
    } else put(banner, { o: 0 });
    // 每条轨道的判定字和键
    LANES.forEach((l, li) => {
      let last = null;
      for (const n of notes) if (n.li === li && n.t <= t) last = n;
      const age = last ? t - last.t : 9;
      const f = flies[li];
      if (age < 0.5) {
        if (f.textContent !== GRADES[last.grade]) f.textContent = GRADES[last.grade];
        f.dataset.g = last.grade;
        const k = age / 0.5;
        put(f, { x: li * (SW / 3) + SW / 6, y: JUDGE - 70 - k * 50, s: lerp(1.35, 1, ease.outBack(Math.min(1, k * 3))), o: k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3 });
      } else put(f, { o: 0 });
      const p = last ? pulse(t, last.t, 0.25) : 0;
      setVar(keys[li], '--hit', p.toFixed(3));
      put(keys[li], { y: p * 4 });
    });
    // 步进条：播放线 + 打中过的格子
    const stepNow = stepIn(t);
    LANES.forEach((l, li) => {
      cells[li].forEach((c, s) => {
        const hit = notes.some((n) => n.li === li && n.step === s && n.t <= t && n.t > t - 2);
        toggle(c, 'on', hit);
        toggle(c, 'now', s === stepNow);
      });
    });
    // 镜子：刚敲的键亮一下
    const map = { SK1: 'cyan', SK3: 'cyan', SK4: 'cyan' };
    let say = '';
    for (const l of LANES) {
      const li = LANES.indexOf(l);
      const last = [...notes].reverse().find((n) => n.li === li && n.t <= t);
      if (last && t - last.t < 0.14) map[l.key] = 'white';
    }
    const ln = hi >= 0 ? notes[hi] : null;
    if (ln) say = `你敲了 ${LANES[ln.li].key.replace('SK', 'Synth key ')} → ${LANES[ln.li].label}`;
    const key = JSON.stringify(map);
    if (key !== lastLit) {
      panel.setLit(map);
      panel.setHighlight(['SK1', 'SK3', 'SK4']);
      lastLit = key;
    }
    const sp = mirrorNote.querySelector('span');
    if (sp.textContent !== say) sp.textContent = say;
  }

  return { id: 'C', t0: T0, t1: T1, el, update };
}

function roundRect(ctx, x, y, w, hh, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + hh, r);
  ctx.arcTo(x + w, y + hh, x, y + hh, r);
  ctx.arcTo(x, y + hh, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function rnd(n) {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}
function hexA(hex, a) {
  const m = hex.replace('#', '');
  const n = parseInt(m.length === 3 ? m.split('').map((c) => c + c).join('') : m.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a.toFixed(3)})`;
}
