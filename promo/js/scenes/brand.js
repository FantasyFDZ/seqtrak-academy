// A 品牌 + B 主角（前奏 + 第 1–4 小节，0–10 秒）
// 第三版（用户 2026-11-21：前半段观众不知道片子在干嘛、对产品的提示不足；前面的鼓太长）。参照 video-shotcraft 的宣传片骨架：
// 先亮品牌、字标停满 1 秒以上，再用一个主角镜头交代“它是为什么做的”，之后才进功能。
//   前奏（三下心跳，只有鼓）+ 第 1 小节第一拍：用鼓声把产品名这一页一步步“敲”出来——标志的四根条一下鼓长出一根
//   （用户 2026-11-21：开头那几声鼓配的键和频谱不好，不要了，用鼓声把产品名称这一页逐渐引入）。心跳时标志在画面正中、大一点；
//   第四下（第 1 小节第一拍）最后一根长出来，“SEQTRAK Academy”砸下来，标志收到片名上方，下面一句定位。
//   第 2 小节：四个功能标签一拍一个亮起（音游式练习 / 真机镜像 / AI 教练啾啾 / 电脑键盘也能学）。
//   第 3–4 小节：主角——整台 SEQTRAK（应用里的 device-panel.js），镜头从鼓键拉到整台，键跟着鼓点亮。字幕在 captions.js。
// 按审美准则：不震屏（Q3），整画面的白闪只在标志亮出来那一下（R4）。
import { h, put, setVar, toggle } from '../engine.js';
import { createPanel } from '/js/device-panel.js';
import { SCORE, HEART } from '../score.js';
import { at, BEAT, stepIn, ease, prog, lerp, clamp, pulse, lastAt } from '../time.js';

const CX = 960;
const K = 2.0; // 标志放大多少倍（应用里四根条是 16 像素宽）
const BARS = [47, 104, 66, 85];
const BW = 16 * K;
const GAP = 10 * K;
const LOGO_W = 4 * BW + 3 * GAP;
const LOGO_X = CX - LOGO_W / 2;
const LOGO_BOTTOM = 400;
const TAGS = ['音游式练习', '真机镜像', 'AI 教练啾啾', '电脑键盘也能学'];

export function brandScene() {
  const T1 = at(5);
  const B1 = at(1);
  const B3 = at(3);
  const kicks = SCORE.drums.filter((d) => d.lane === 'KICK' && d.t < T1).map((d) => d.t);
  const laneHits = Object.fromEntries(['CLAP', 'HAT1'].map((l) => [l, SCORE.drums.filter((d) => d.lane === l && d.t < T1).map((d) => d.t)]));

  // ── 品牌：标志、片名、定位、功能标签
  const bars = BARS.map((hh, i) => h('i', { class: `en-bar en-bar${i + 1}`, style: { left: `${LOGO_X + i * (BW + GAP)}px`, top: `${LOGO_BOTTOM - hh * K}px`, height: `${hh * K}px`, width: `${BW}px`, borderRadius: `${BW / 2}px` } }));
  // 四根条各在哪一下鼓长出来：前奏的三下心跳 + 第 1 小节第一拍
  const HITS = [...HEART, at(1)];
  const LOGO_CY = LOGO_BOTTOM - (BARS[1] * K) / 2; // 标志的中线
  const glow = h('i', { class: 'br-glow' });
  const logo = h('div', { class: 'br-logo', style: { transformOrigin: `${CX}px ${LOGO_CY}px` } }, glow, bars);
  const title = h('h1', { class: 'br-title' }, 'SEQTRAK ', h('b', {}, 'Academy'));
  const line = h('p', { class: 'br-line' }, 'Yamaha SEQTRAK 的互动学习 App');
  const tags = TAGS.map((t) => h('span', { class: 'br-tag' }, t));
  const tagRow = h('div', { class: 'br-tags' }, tags);
  const brand = h('div', { class: 'br-brand' }, logo, title, line, tagRow);

  // ── 主角：整台机器
  const panel = createPanel({});
  const panelBox = h('div', { class: 'br-panel' }, panel.el);
  const FULL = [-84, -40, 1178, 346];
  const DRUM = [24, 160, 390, 130]; // 两排 Drum keys 那一块（图上的单位）
  const el = h('div', { class: 's-brand' }, brand, panelBox);

  let lastLit = '';
  function update(t) {
    // ── 标志：一下鼓长出一根（长过头一点再回落）；后面每一下鼓，已经长出来的条跟着轻轻一跳
    const out = ease.inCubic(prog(t, B3 - 0.22, B3)); // 拍前收掉，主角在拍点上硬切进来
    const ki = lastAt(kicks, t);
    const tk = ki >= 0 ? kicks[ki] : -9;
    bars.forEach((b, i) => {
      const k = prog(t, HITS[i], HITS[i] + 0.5);
      let sy = k < 0.55 ? 1.15 * ease.outCubic(k / 0.55) : lerp(1.15, 1, ease.inOutCubic((k - 0.55) / 0.45));
      const a = t >= HITS[i] + 0.5 && t >= tk ? (t - tk) / 0.34 : 9;
      if (a < 1) sy *= 1 + (0.07 + i * 0.03) * (a < 0.22 ? a / 0.22 : 1 - (a - 0.22) / 0.78);
      put(b, { sy, sx: 1, o: t >= HITS[i] ? 1 : 0 });
    });
    // 心跳时标志在画面正中、放大；第四下片名砸下来，标志收到片名上方
    const settle = ease.outExpo(prog(t, B1, B1 + 0.5));
    put(logo, { y: lerp(540 - LOGO_CY, 0, settle), s: lerp(1.45, 1, settle) });
    // 标志底下一团光：每一下鼓亮一下
    put(glow, { x: CX, y: LOGO_BOTTOM, s: 0.8 + pulse(t, tk, 0.4) * 0.5, o: (t >= HITS[0] ? 0.35 : 0) + pulse(t, tk, 0.4) * 0.6 });
    // 片名砸下来：放大、模糊、红青错开收到清楚
    const kt = ease.outExpo(prog(t, B1 + 0.12, B1 + 0.5));
    put(title, { s: lerp(1.6, 1, kt), o: t >= B1 + 0.12 ? clamp(prog(t, B1 + 0.12, B1 + 0.2)) : 0 });
    setVar(title, '--blur', `${((1 - kt) * 16).toFixed(1)}px`);
    setVar(title, '--split', `${((1 - kt) * 12).toFixed(1)}px`);
    const kl = ease.outCubic(prog(t, B1 + 0.45, B1 + 0.85));
    put(line, { y: lerp(24, 0, kl), o: kl });
    tags.forEach((tg, i) => {
      const t0 = at(2, i + 1);
      const k = ease.outBack(prog(t, t0, t0 + 0.3), 2);
      put(tg, { y: lerp(26, 0, k), s: lerp(0.7, 1, k), o: t >= t0 ? clamp(k * 2) : 0 });
      toggle(tg, 'now', t >= t0 && t < t0 + BEAT);
    });
    put(brand, { s: 1 - out * 0.08, o: 1 - out });
    brand.style.display = t >= HITS[0] - 0.05 && t < B3 ? '' : 'none';

    // ── 主角：镜头从鼓键拉到整台机器
    const pin = ease.outExpo(prog(t, B3, B3 + 0.5));
    const pz = ease.inOutCubic(prog(t, B3 + 0.2, B3 + 1.6));
    const vb = DRUM.map((v, i) => lerp(v, FULL[i], pz));
    panel.svg.setAttribute('viewBox', vb.map((v) => v.toFixed(1)).join(' '));
    put(panelBox, { s: lerp(1.12, 1, pin), o: 1 });
    panelBox.style.display = t >= B3 ? '' : 'none';
    if (t >= B3) {
      const step = stepIn(t);
      const map = {};
      [0, 4, 8, 12].forEach((i) => (map[`DK${i + 1}`] = 'orange'));
      map[`DK${step + 1}`] = [0, 4, 8, 12].includes(step) ? 'yellow' : 'white';
      for (const [lane, hits] of [['KICK', kicks], ['CLAP', laneHits.CLAP], ['HAT1', laneHits.HAT1]]) {
        const hi = lastAt(hits, t);
        if (hi >= 0 && t - hits[hi] < 0.12) {
          map[`${lane}.1`] = 'green';
          map[`${lane}.2`] = 'green';
        }
      }
      const k2 = JSON.stringify(map);
      if (k2 !== lastLit) {
        panel.setLit(map);
        lastLit = k2;
      }
    }
  }

  return { id: 'AB', t0: 0, t1: T1, el, update };
}
