// 通用小工具：DOM 构建、事件总线、数学与格式化。

/**
 * 创建 DOM 节点。
 *   h('button', { class: 'btn', onclick: fn }, '开始')
 * props 里：class / style(对象) / dataset(对象) / html / on* 事件，其余当作属性。
 */
export function h(tag, props, ...children) {
  const el = tag === 'svg' || SVG_TAGS.has(tag) ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.setAttribute('class', Array.isArray(v) ? v.filter(Boolean).join(' ') : v);
      else if (k === 'style' && typeof v === 'object') {
        // '--x' 这样的 CSS 变量不能直接赋值，要用 setProperty
        for (const [p, val] of Object.entries(v)) {
          if (p.startsWith('--')) el.style.setProperty(p, val);
          else el.style[p] = val;
        }
      }
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  append(el, children);
  return el;
}

const SVG_TAGS = new Set(['g', 'rect', 'circle', 'ellipse', 'line', 'path', 'text', 'tspan', 'defs', 'linearGradient', 'radialGradient', 'stop', 'polygon', 'polyline', 'use', 'clipPath', 'filter', 'feGaussianBlur', 'feDropShadow', 'title']);

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export class Emitter {
  #map = new Map();
  on(type, fn) {
    if (!this.#map.has(type)) this.#map.set(type, new Set());
    this.#map.get(type).add(fn);
    return () => this.#map.get(type)?.delete(fn);
  }
  emit(type, data) {
    const set = this.#map.get(type);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(data);
      } catch (e) {
        console.error(`[emit ${type}]`, e);
      }
    }
  }
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const uid = () => Math.random().toString(36).slice(2, 10);

export function mean(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

export function stddev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(mean(arr.map((x) => (x - m) ** 2)));
}

export function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** 带符号的毫秒：+12ms / −35ms */
export function fmtMs(ms) {
  const r = Math.round(ms);
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r)}ms`;
}

export const pct = (x) => `${Math.round(x * 100)}%`;

/** 把轻量标记转成 HTML：**加粗**、`代码`、[按键]、换行；先做转义。用于课程文案与 AI 回复。 */
export function rich(text) {
  const esc = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return esc
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([A-Z][A-Z0-9 /+\-↑↓]{1,22})\]/g, '<kbd>$1</kbd>')
    .replace(/\n/g, '<br>');
}

/** 把 AI 的回复（可能含短列表）转成 HTML。 */
export function richBlocks(text) {
  const lines = String(text).split('\n');
  const out = [];
  let list = null;
  for (const line of lines) {
    if (/^\s*[-—_*=]{3,}\s*$/.test(line)) continue; // 分隔线不显示
    const m = line.match(/^\s*(?:[-•*]|\d+[.)、])\s+(.*)$/);
    if (m) {
      if (!list) {
        list = [];
        out.push(list);
      }
      list.push(m[1]);
    } else {
      list = null;
      if (line.trim()) out.push(line.replace(/^#+\s*/, ''));
    }
  }
  return out
    .map((b) => (Array.isArray(b) ? `<ul>${b.map((i) => `<li>${rich(i)}</li>`).join('')}</ul>` : `<p>${rich(b)}</p>`))
    .join('');
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
