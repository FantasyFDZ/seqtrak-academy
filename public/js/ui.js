// 界面小部件：提示条、分段开关。
import { h, $ } from './util.js';

export function toast(text, kind = '', ms = 2800) {
  const el = h('div', { class: ['toast', kind] }, text);
  $('#toasts').append(el);
  setTimeout(() => el.remove(), ms);
}

/** 分段开关：保留按钮焦点不断裂，选中的实体拨片沿着滑槽平滑移过去。options: [{ value, label }]，onChange(value)。 */
export function segmented(options, value, onChange, label) {
  let cur = value;
  const thumb = h('i', { class: 'seg-thumb', 'aria-hidden': 'true' });
  const btns = options.map((o) =>
    h('button', {
      type: 'button',
      class: [o.value === cur && 'on'],
      'aria-pressed': String(o.value === cur),
      onclick: () => {
        if (o.value === cur) return;
        cur = o.value;
        paint(false);
        onChange(o.value);
      },
    }, o.label),
  );
  const wrap = h('div', { class: 'seg' }, thumb, ...btns);
  const syncThumb = (instant) => {
    const active = btns[options.findIndex((o) => o.value === cur)];
    if (!active) {
      wrap.classList.remove('has-thumb');
      return;
    }
    if (!active.offsetWidth) return;
    if (instant) thumb.classList.add('instant');
    thumb.style.width = `${active.offsetWidth}px`;
    thumb.style.height = `${active.offsetHeight}px`;
    thumb.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
    wrap.classList.add('has-thumb');
    if (instant) requestAnimationFrame(() => thumb.classList.remove('instant'));
  };
  const paint = (instant) => {
    btns.forEach((b, i) => {
      const isOn = options[i].value === cur;
      b.classList.toggle('on', isOn);
      b.setAttribute('aria-pressed', String(isOn));
    });
    syncThumb(instant);
  };
  requestAnimationFrame(() => syncThumb(true));
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(() => {
      if (!wrap.isConnected) return ro.disconnect();
      syncThumb(true);
    });
    ro.observe(wrap);
  }
  const out = label ? h('div', { class: 'row', style: { gap: '0' } }, h('span', { class: 'seg-label' }, label), wrap) : wrap;
  out.set = (v, instant = false) => {
    cur = v;
    paint(instant);
  };
  return out;
}
