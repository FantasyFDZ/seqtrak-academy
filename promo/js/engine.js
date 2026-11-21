// 画面引擎：舞台（1920 × 1080）、一段一段的场景、到点触发的“提示”（cue）、字幕、啾啾的飞行轨迹。
// 场景的样子尽量写成“时间的函数”（update(t) 只看 t），这样预览里随便拖进度条都对；
// 只有一下就完的动作（啾啾翻跟头、叫一声）用 cue：播放头往前走过那一刻时触发一次（往回拖、跳着走不触发）。
import { createBird } from '/js/bird.js';
import { quietly } from './music.js';
import { clamp, ease, prog, lerp } from './time.js';

export const W = 1920;
export const H = 1080;

/** 小工具：建元素。h('div', { class: 'x', style: {...} }, 子元素…) */
export function h(tag, props = {}, ...kids) {
  const svgTags = new Set(['svg', 'g', 'path', 'rect', 'circle', 'line', 'text', 'defs', 'linearGradient', 'radialGradient', 'stop', 'polyline', 'polygon', 'ellipse', 'clipPath', 'mask', 'filter', 'feGaussianBlur', 'use', 'tspan']);
  const el = svgTags.has(tag) ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'style' && typeof v === 'object') for (const [sk, sv] of Object.entries(v)) sk.startsWith('--') ? el.style.setProperty(sk, sv) : (el.style[sk] = sv);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'class') el.setAttribute('class', Array.isArray(v) ? v.filter(Boolean).join(' ') : v);
    else el.setAttribute(k, v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}

/** 设 transform / opacity 的简写（只在变了的时候写，省得每帧都改样式） */
export function put(el, { x = 0, y = 0, s = 1, sx, sy, r = 0, o = 1 } = {}) {
  const tf = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${(sx ?? s).toFixed(4)}, ${(sy ?? s).toFixed(4)}) rotate(${r.toFixed(2)}deg)`;
  if (el.__tf !== tf) {
    el.style.transform = tf;
    el.__tf = tf;
  }
  const op = o.toFixed(3);
  if (el.__op !== op) {
    el.style.opacity = op;
    el.__op = op;
  }
}
export function setVar(el, name, v) {
  const key = `__v${name}`;
  if (el[key] === v) return;
  el[key] = v;
  el.style.setProperty(name, v);
}
export function toggle(el, cls, on) {
  if (el.classList.contains(cls) !== !!on) el.classList.toggle(cls, !!on);
}

/** 元素在舞台上的位置（舞台坐标，不受预览缩放影响） */
export function stageBox(el, stage) {
  const s = stage.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const k = s.width / W;
  return { x: (r.left - s.left) / k, y: (r.top - s.top) / k, w: r.width / k, h: r.height / k, cx: (r.left - s.left + r.width / 2) / k, cy: (r.top - s.top + r.height / 2) / k };
}

export function createEngine(stage) {
  const scenes = [];
  const cues = [];
  let cur = -1;
  const engine = {
    stage,
    scenes,
    add(scene) {
      scenes.push(scene);
      if (scene.el) {
        scene.el.classList.add('scene');
        scene.el.style.display = 'none';
        (scene.layer || stage).append(scene.el);
      }
      for (const [t, fn] of scene.cues || []) engine.cue(t, fn);
      return scene;
    },
    cue(t, fn) {
      cues.push({ t, fn });
      cues.sort((a, b) => a.t - b.t);
    },
    /** 跳到 t 秒。从前一刻连续往前走（< 0.5 秒）时触发途中的 cue */
    seek(t) {
      const prev = cur;
      cur = t;
      if (prev >= 0 && t > prev && t - prev < 0.5) {
        for (const c of cues) if (c.t > prev && c.t <= t) c.fn(t);
      }
      for (const s of scenes) {
        const vis = t >= s.t0 && t < s.t1;
        if (vis !== !!s.visible) {
          s.visible = vis;
          if (s.el) s.el.style.display = vis ? '' : 'none';
          if (vis) s.enter?.(t);
          else s.exit?.(t);
        }
        if (vis) s.update?.(t);
      }
    },
    get t() {
      return cur;
    },
  };
  return engine;
}

// ───────────── 字幕 ─────────────
// 一条：{ t0, t1, kicker, main, at: 'left' | 'center' | 'right', y, quiet }。main 里 [方括号] 括起来的字是桔红的重点词。
// 进场（要有冲击力，用户 2026-11-21）：一块桔红的色块从左往右扫过去，字跟着它一个个“砸”出来——从放大、模糊、红青错开收到清楚；
// 小标题从左往右划开。出场：字往上一甩、糊掉。quiet 的（片尾署名）只淡入淡出。
export function createCaptions(layer, list) {
  const nodes = list.map((c) => {
    const parts = [];
    let hl = false;
    for (const ch of c.main) {
      if (ch === '[') hl = true;
      else if (ch === ']') hl = false;
      else parts.push([ch, hl]);
    }
    const chs = parts.map(([ch, on]) => h('span', { class: ['cap-ch', on && 'hl'] }, ch === ' ' ? ' ' : ch));
    const wipe = h('i', { class: 'cap-wipe' });
    const main = h('div', { class: 'cap-main' }, chs, wipe);
    const el = h('div', { class: ['cap', `cap-${c.at || 'left'}`, c.cls] },
      c.kicker ? h('div', { class: 'cap-kicker' }, h('i'), h('span', {}, c.kicker)) : null,
      main,
      c.sub ? h('div', { class: 'cap-sub' }, c.sub) : null);
    if (c.y != null) el.style.top = `${c.y}px`;
    if (c.x != null) el.style.left = `${c.x}px`;
    layer.append(el);
    return { c, el, chs, wipe, kick: el.querySelector('.cap-kicker'), kbar: el.querySelector('.cap-kicker i'), ktext: el.querySelector('.cap-kicker span'), sub: el.querySelector('.cap-sub') };
  });
  return {
    update(t) {
      for (const n of nodes) {
        const { t0, t1, quiet } = n.c;
        const vis = t >= t0 - 0.1 && t < t1 + 0.5;
        n.el.style.display = vis ? '' : 'none';
        if (!vis) continue;
        if (quiet) {
          const k = prog(t, t0, t0 + 0.6);
          n.chs.forEach((ch) => put(ch, { o: k }));
          n.wipe.style.display = 'none';
          continue;
        }
        const N = n.chs.length;
        // 色块：0.16 秒从左长满，再 0.2 秒往右收走
        const g = prog(t, t0, t0 + 0.16);
        const r = prog(t, t0 + 0.16, t0 + 0.38);
        n.wipe.style.transformOrigin = g < 1 ? '0 50%' : '100% 50%';
        put(n.wipe, { sx: g < 1 ? ease.outCubic(g) : 1 - ease.inOutCubic(r), sy: 1, o: t < t0 || r >= 1 ? 0 : 1 });
        n.chs.forEach((ch, i) => {
          const a = t0 + 0.08 + (i / Math.max(1, N - 1)) * 0.16; // 色块扫到它的那一刻
          const k = prog(t, a, a + 0.3);
          const e = ease.outExpo(k);
          const o0 = t1 + i * 0.012;
          const out = ease.inCubic(prog(t, o0, o0 + 0.22));
          put(ch, { s: lerp(1.75, 1, e) + out * 0.12, y: out * -38, o: (t >= a ? clamp(k * 4) : 0) * (1 - out) });
          setVar(ch, '--blur', `${((1 - e) * 12 + out * 10).toFixed(1)}px`);
          setVar(ch, '--split', `${((1 - e) * 9).toFixed(1)}px`);
        });
        if (n.kick) {
          const k = ease.outCubic(prog(t, t0 - 0.08, t0 + 0.28));
          const out = prog(t, t1, t1 + 0.25);
          put(n.kbar, { sx: k, sy: 1 });
          n.ktext.style.clipPath = `inset(0 ${((1 - k) * 100).toFixed(1)}% 0 0)`;
          put(n.kick, { x: out * -30, o: 1 - out });
        }
        if (n.sub) {
          const k = ease.outCubic(prog(t, t0 + 0.3, t0 + 0.8));
          put(n.sub, { y: lerp(16, 0, k), o: k * (1 - prog(t, t1, t1 + 0.3)) });
        }
      }
    },
  };
}

// ───────────── 啾啾 ─────────────
// 全片一只（应用里的 bird.js，原样用）。它在哪、什么姿态都按时间算：
//   moves  [{ t, dur, to: [x, y] | () => [x, y], end: 'land' | 'hover', arc }]   从上一个位置飞过去（爪子的位置，舞台坐标）
//   show   [[t0, t1], …]   什么时候在画面上
//   moods  [[t, 神态], …]
//   acts   [[t, 动作], …]   翻跟头、点头、啄……（bird.js 的 act）
//   sings  [[t, 叫法, opts], …]   张嘴、飘音符（声音在 music.js 里另外排，这里不出声）
//   says   [[t0, t1, 一句话], …]   头顶的气泡
//   sizes  [[t, 多大], …]   换大小（线性过渡 0.4 秒）
//   grooves [[t0, t1], …]   跟着拍子点头
export function createBird2(layer, track, engine) {
  const size0 = track.size || 160;
  const b = createBird({ size: size0, mood: 'idle' });
  b.el.classList.add('promo-bird');
  b.el.style.position = 'absolute';
  const say = h('div', { class: 'promo-say' }, h('div', { class: 'promo-say-in' }));
  layer.append(b.el, say);
  const sayIn = say.firstChild;
  const cache = new Map();
  const target = (m) => {
    if (typeof m.to !== 'function') return m.to;
    if (!cache.has(m)) cache.set(m, m.to());
    return cache.get(m);
  };
  const moves = [...(track.moves || [])].sort((a, z) => a.t - z.t);
  const spawn = track.spawn || [W + 200, 300];

  // 每一段的起点 = 前一段的终点
  function from(i) {
    return i <= 0 ? spawn : target(moves[i - 1]);
  }

  function sizeAt(t) {
    const list = track.sizes || [];
    let s = size0;
    for (const [t0, v] of list) {
      if (t < t0) break;
      const prevS = s;
      s = lerp(prevS, v, ease.inOutCubic(prog(t, t0, t0 + 0.4)));
    }
    return s;
  }

  for (const [t, name] of track.acts || []) engine.cue(t, () => b.act(name));
  for (const [t, call, opts] of track.sings || []) engine.cue(t, () => quietly(() => b.sing(call, opts)));

  let lastSay = null;
  let lastSize = size0;
  const api = {
    bird: b,
    /** 此刻爪子的位置 */
    pos: [0, 0],
    update(t) {
      const shown = (track.show || []).some(([a, z]) => t >= a && t < z);
      b.el.style.display = shown ? '' : 'none';
      if (!shown) {
        say.style.display = 'none';
        return;
      }
      const sz = sizeAt(t);
      if (Math.abs(sz - lastSize) > 0.2) {
        b.el.style.width = b.el.style.height = `${sz.toFixed(1)}px`;
        lastSize = sz;
      }
      // 神态
      let mood = 'idle';
      for (const [t0, m] of track.moods || []) if (t >= t0) mood = m;
      if (b.el.dataset.mood !== mood) b.setMood(mood);
      // 跟拍
      const groove = (track.grooves || []).some(([a, z]) => t >= a && t < z);
      toggle(b.el, 'promo-groove', groove);
      // 位置
      let i = -1;
      for (let k = 0; k < moves.length; k++) if (t >= moves[k].t) i = k;
      let x;
      let y;
      let air = null;
      let pitch = 0;
      if (i < 0) {
        [x, y] = spawn;
        air = 'fly';
      } else {
        const m = moves[i];
        const [x0, y0] = from(i);
        const [x1, y1] = target(m);
        const k = m.dur ? prog(t, m.t, m.t + m.dur) : 1;
        const dist = Math.hypot(x1 - x0, y1 - y0);
        if (k < 1) {
          const e = (m.ease || ease.inOutCubic)(k);
          const cx = (x0 + x1) / 2;
          const cy = Math.min(y0, y1) - (m.arc ?? clamp(dist * 0.3, 30, 160));
          const pt = (u) => [(1 - u) ** 2 * x0 + 2 * (1 - u) * u * cx + u * u * x1, (1 - u) ** 2 * y0 + 2 * (1 - u) * u * cy + u * u * y1];
          [x, y] = pt(e);
          const [qx, qy] = pt(Math.min(1, e + 0.02));
          const ang = Math.atan2(qy - y, Math.abs(qx - x) + 0.001) * (180 / Math.PI);
          air = 'fly';
          pitch = clamp(ang * 0.55 - 6, -26, 22);
          if (dist > 260 && k > 0.08 && k < 0.8) {
            const ph = ((t - m.t) % 0.56) / 0.56;
            air = ph < 0.66 ? 'fly' : 'glide';
            y += ph < 0.66 ? -5 * Math.sin((ph / 0.66) * Math.PI) : 4 * Math.sin(((ph - 0.66) / 0.34) * Math.PI);
          }
          if (m.end !== 'hover' && k > 0.8) {
            air = 'land';
            pitch = 0;
          }
          if (m.end === 'hover' && k > 0.86) {
            air = 'hover';
            pitch = 0;
          }
          b.face(x1 < x0 ? 'left' : 'right');
        } else {
          [x, y] = [x1, y1];
          air = m.end === 'hover' ? 'hover' : null;
          if (m.face) b.face(m.face);
        }
      }
      for (const [t0, dir] of track.faces || []) if (t >= t0 && (i < 0 || t0 >= moves[i].t)) b.face(dir);
      setVar(b.el, '--pitch', `${pitch.toFixed(1)}deg`);
      if ((b.el.dataset.air || null) !== air) b.setAir(air);
      b.placeAt(x, y);
      api.pos = [x, y];
      // 气泡
      const cur = (track.says || []).find(([a, z]) => t >= a && t < z);
      if (cur) {
        if (lastSay !== cur) {
          sayIn.innerHTML = cur[2];
          lastSay = cur;
        }
        say.style.display = '';
        const kIn = ease.outBack(prog(t, cur[0], cur[0] + 0.32), 1.8);
        const kOut = prog(t, cur[1] - 0.2, cur[1]);
        const side = cur[3] || 'up';
        const bx = x + (side === 'left' ? -sz * 0.2 : side === 'right' ? sz * 0.15 : 0);
        const by = y - sz * 0.92;
        say.dataset.side = side;
        put(say, { x: bx, y: by, s: lerp(0.4, 1, kIn) * (1 - kOut * 0.1), o: clamp(kIn * 2) * (1 - kOut) });
      } else {
        say.style.display = 'none';
        lastSay = null;
      }
    },
  };
  return api;
}
