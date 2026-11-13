// 界面小部件：提示条、分段开关。
import { h, $ } from './util.js';

export function toast(text, kind = '', ms = 2800) {
  const el = h('div', { class: ['toast', kind] }, text);
  $('#toasts').append(el);
  setTimeout(() => el.remove(), ms);
}

/** 分段开关。options: [{ value, label }]，onChange(value)。 */
export function segmented(options, value, onChange, label) {
  const wrap = h('div', { class: 'seg' });
  // fresh = 刚点过去的那一格：底板“蹦”一下落位（第一次画出来时不蹦）
  const render = (v, fresh) => {
    wrap.replaceChildren(
      ...options.map((o) =>
        h('button', { type: 'button', class: [o.value === v && 'on', o.value === v && fresh && 'fresh'], 'aria-pressed': String(o.value === v), onclick: () => { render(o.value, o.value !== v); onChange(o.value); } }, o.label),
      ),
    );
  };
  render(value);
  return label ? h('div', { class: 'row', style: { gap: '0' } }, h('span', { class: 'seg-label' }, label), wrap) : wrap;
}
