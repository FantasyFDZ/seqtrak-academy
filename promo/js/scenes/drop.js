// H Drop（第 27–34 小节，52–68 秒）：卡点的蒙太奇，用的是真实界面的截图（promo/capture.mjs 截的，在 promo/shots/）
//   27–28  闯关地图往下走；左边一拍砸一个字：节奏 / 旋律 / 和弦 / 采样 / 编曲 / 现场
//   29–30  小课堂 66 关的封面墙（应用里真的封面，classroom-covers.js），一格十六分地铺开
//   31     白闪，整个片子换成“机身”配色：两套配色的首页叠在一起
//   32     首页的上半截：等级、连续天数、本周目标、徽章，一拍点亮一个
//   33     曲目完整版：多轨时间线，播放线扫过去
//   34     四个数字一拍一个：35 节课 / 66 关 / 24 个谱面 / 27 首曲目
import { h, put, setVar, toggle } from '../engine.js';
import { coverSvg } from '/js/classroom-covers.js';
import { LEVELS, LINES } from '/js/content/classroom.js';
import { at, BEAT, ease, prog, lerp, clamp, pulse } from '../time.js';
import { createSpectrum } from '../spectrum.js';

const SHOT = (name) => `/promo/shots/${name}.png`;

function img(engine, name) {
  const el = h('img', { src: SHOT(name), alt: '', draggable: 'false' });
  engine.loading.push(el.decode().catch(() => {}));
  return el;
}

function label(kicker, main) {
  return h('div', { class: 'dp-label' }, h('span', {}, kicker), h('b', {}, main));
}

export function dropScene(engine) {
  const T0 = at(19);
  const T1 = at(27);
  const parts = [];

  // ── H1 闯关地图 + 六个字
  const WORDS = ['节奏', '旋律', '和弦', '采样', '编曲', '现场'];
  const words = WORDS.map((w, i) => h('div', { class: 'dp-word' }, h('i', {}, String(i).padStart(2, '0')), w));
  const mapImg = img(engine, 'home-long-neon');
  const mapFrame = h('div', { class: 'dp-frame dp-map' }, mapImg);
  const sum1 = label('9 章 · 35 节课', '一条闯关路线，从开箱到毕业演出');
  const h1 = h('div', { class: 'dp-part' }, h('div', { class: 'dp-persp' }, mapFrame), h('div', { class: 'dp-words' }, words), sum1);
  parts.push({ el: h1, t0: T0, t1: at(21) });

  // ── H2 封面墙
  const lineColor = Object.fromEntries(LINES.map((l) => [l.id, `var(--${l.color})`]));
  const tiles = LEVELS.map((lv, i) => {
    const c = i % 11;
    const r = Math.floor(i / 11);
    const el = h('div', { class: 'dp-tile', style: { left: `${100 + c * 158}px`, top: `${76 + r * 158}px`, '--c': lineColor[lv.line] || 'var(--accent)' }, html: coverSvg(lv, { anim: true }) });
    el.append(h('small', {}, lv.id));
    return { el, c, r, i };
  });
  const count = h('b', {}, '0');
  const wallPill = h('div', { class: 'dp-pill' }, count, h('span', {}, '关小课堂'), h('small', {}, '乐理 · 节奏 · 效果 · DJ，每关三五分钟'));
  const wall = h('div', { class: 'dp-wall' }, tiles.map((t) => t.el));
  const h2 = h('div', { class: 'dp-part' }, wall, wallPill);
  parts.push({ el: h2, t0: at(21), t1: at(23) });

  // ── H3 两套配色
  const neonFrame = h('div', { class: 'dp-frame dp-skin-n' }, img(engine, 'home-neon'));
  const bodyFrame = h('div', { class: 'dp-frame dp-skin-b' }, img(engine, 'home-body'));
  const sum3 = label('两套配色', '机身 · 霓虹，一键切换');
  const h3 = h('div', { class: 'dp-part' }, h('div', { class: 'dp-persp' }, neonFrame, bodyFrame), sum3);
  parts.push({ el: h3, t0: at(23), t1: at(24) });

  // ── H4 等级、连续天数、本周目标、徽章（首页上半截；框的位置按截图的像素量的，截图 2880 × 1800）
  const headImg = img(engine, 'home-body');
  const crop = h('div', { class: 'dp-crop' }, headImg);
  const SPOTS = [
    { x: 1786, y: 50, w: 850, h: 180, k: 'Lv 9 · 采样师' },
    { x: 1786, y: 256, w: 850, h: 176, k: '连续 12 天' },
    { x: 1786, y: 460, w: 850, h: 180, k: '本周目标达成' },
    { x: 396, y: 678, w: 2240, h: 232, k: '8 枚徽章' },
  ];
  const marks = SPOTS.map((s) => h('div', { class: 'dp-mark', style: { left: `${s.x}px`, top: `${s.y}px`, width: `${s.w}px`, height: `${s.h}px` } }, h('span', {}, s.k)));
  crop.append(...marks);
  const sum4 = label('练一次，涨一次', '升级、徽章、连续天数');
  const h4 = h('div', { class: 'dp-part' }, h('div', { class: 'dp-cropbox' }, crop), sum4);
  parts.push({ el: h4, t0: at(24), t1: at(25) });

  // ── H5 曲目完整版
  const songImg = img(engine, 'songfull-body');
  const songBox = h('div', { class: 'dp-song' }, songImg);
  const songHead = h('i', { class: 'dp-songhead' });
  songBox.append(songHead);
  const sum5 = label('27 首曲目', '热门曲目，拆好分轨');
  const h5 = h('div', { class: 'dp-part' }, h('div', { class: 'dp-frame dp-songframe' }, songBox), sum5);
  parts.push({ el: h5, t0: at(25), t1: at(26) });

  // ── H6 四个数字
  const STATS = [['35', '节课'], ['24', '个谱面'], ['27', '首曲目'], ['12', '级成长等级']]; // 66 关小课堂前面的封面墙讲过了，不重复
  const stats = STATS.map(([n, u]) => h('div', { class: 'dp-stat' }, h('b', {}, n), h('span', {}, u)));
  const h6 = h('div', { class: 'dp-part dp-stats' }, stats);
  parts.push({ el: h6, t0: at(26), t1: T1 });

  // 底边一排频谱（真的音频算出来的），Drop 一路跟着跳
  const floor = createSpectrum({ mode: 'floor', width: 1920, height: 170, bars: 60 });
  floor.el.style.left = '0px';
  floor.el.style.bottom = '0px';
  const el = h('div', { class: 's-drop' }, floor.el, parts.map((p) => p.el));
  // 标签砸进来：放大、模糊收到清楚
  const slam = (node, t, t0) => {
    const k = ease.outExpo(prog(t, t0, t0 + 0.35));
    put(node, { s: lerp(1.25, 1, k), o: clamp(prog(t, t0, t0 + 0.12)) });
    setVar(node, '--blur', `${((1 - k) * 12).toFixed(1)}px`);
  };

  function update(t) {
    for (const p of parts) p.el.style.display = t >= p.t0 && t < p.t1 ? '' : 'none';
    floor.draw(t, { gain: 1.05, alpha: 0.5 * prog(t, T0, T0 + 0.2) * (1 - prog(t, T1 - 0.3, T1)) });

    if (t < at(21)) {
      // 地图从上往下走；整块随拍子轻轻一顿
      const k = ease.inOutCubic(prog(t, T0, at(21)));
      put(mapImg, { y: -lerp(0, 1362, k) });
      const kin = ease.outExpo(prog(t, T0, T0 + 0.5));
      put(mapFrame, { x: lerp(300, 0, kin), r: 0, s: 1 + pulse(t, at(20), 0.3) * 0.015 });
      words.forEach((w, i) => {
        const t0 = T0 + i * BEAT;
        const k2 = ease.outExpo(prog(t, t0, t0 + 0.3));
        const hit = pulse(t, t0, 0.35);
        put(w, { x: lerp(-40, 0, k2), s: lerp(2.1, 1, k2) + hit * 0.06, o: t >= t0 ? clamp(prog(t, t0, t0 + 0.08)) : 0 });
        setVar(w, '--blur', `${((1 - k2) * 16).toFixed(1)}px`);
        setVar(w, '--split', `${(hit * 9).toFixed(1)}px`);
        toggle(w, 'now', t >= t0 && t < t0 + BEAT);
      });
      slam(sum1, t, at(20, 3));
    } else if (t < at(23)) {
      tiles.forEach((tl) => {
        const t0 = at(21) + (tl.c + tl.r) * 0.0625;
        const k = ease.outBack(prog(t, t0, t0 + 0.3), 1.8);
        // 第 30 小节：每拍有一张跳出来
        const pick = (Math.floor((t - at(22)) / BEAT) * 17 + 5) % 66;
        const popT = at(22) + Math.floor((t - at(22)) / BEAT) * BEAT;
        const pop = t >= at(22) && tl.i === pick ? pulse(t, popT, 0.5) : 0;
        put(tl.el, { y: lerp(40, 0, k), s: lerp(0.6, 1, k) + pop * 0.28, o: clamp(k * 2) });
        toggle(tl.el, 'pop', pop > 0.05);
      });
      const n = Math.round(66 * ease.outCubic(prog(t, at(21), at(21, 3))));
      if (count.textContent !== String(n)) count.textContent = String(n);
      const kp = ease.outBack(prog(t, at(21, 1, 2), at(21, 2)), 1.6);
      put(wallPill, { s: lerp(0.7, 1, kp) + pulse(t, at(22), 0.3) * 0.04, o: clamp(kp * 2) });
      put(wall, { s: 1 + (t - at(21)) * 0.012 });
    } else if (t < at(24)) {
      const k = ease.outExpo(prog(t, at(23), at(23) + 0.6));
      put(bodyFrame, { x: lerp(260, 120, k), y: lerp(60, 30, k), s: lerp(1.08, 0.92, k), r: lerp(4, 2, k) });
      put(neonFrame, { x: lerp(-60, -260, k), y: lerp(-20, -50, k), s: 0.8, r: lerp(-2, -5, k), o: 0.9 });
      slam(sum3, t, at(23, 2));
    } else if (t < at(25)) {
      const k = ease.outExpo(prog(t, at(24), at(24) + 0.5));
      const sc = lerp(0.9, 0.8, k) + (t - at(24)) * 0.008;
      put(crop, { x: -396 * sc, y: -24 * sc, s: sc, o: 1 });
      marks.forEach((m, i) => {
        const t0 = at(24) + i * BEAT;
        const on = t >= t0;
        toggle(m, 'on', on);
        toggle(m, 'now', on && t < t0 + BEAT);
        put(m, { s: on ? lerp(1.12, 1, ease.outCubic(prog(t, t0, t0 + 0.25))) : 1, o: on ? 1 : 0 });
      });
      slam(sum4, t, at(24) + 0.1);
    } else if (t < at(26)) {
      const k = ease.inOutCubic(prog(t, at(25), at(26)));
      const ox = lerp(-330, -600, k);
      put(songImg, { x: ox, y: -400, s: 1 });
      songHead.style.left = `${ox + lerp(760, 2100, k)}px`;
      const ki = ease.outExpo(prog(t, at(25), at(25) + 0.5));
      put(songBox.parentElement, { s: lerp(1.1, 1, ki), o: 1 });
      slam(sum5, t, at(25) + 0.1);
    } else {
      stats.forEach((s, i) => {
        const t0 = at(26) + i * BEAT;
        const k = ease.outExpo(prog(t, t0, t0 + 0.3));
        put(s, { s: lerp(1.7, 1, k) + pulse(t, t0, 0.3) * 0.05, o: t >= t0 ? clamp(prog(t, t0, t0 + 0.08)) : 0 });
        setVar(s, '--blur', `${((1 - k) * 14).toFixed(1)}px`);
        toggle(s, 'now', t >= t0 && t < t0 + BEAT);
      });
    }
  }

  return { id: 'H', t0: T0, t1: T1, el, update };
}
