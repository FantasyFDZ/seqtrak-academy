// 机器的图怎么取景：只看要按的那几个键所在的那一块。平板上整台只有半个屏幕宽，键太小、手指点不中。
// 课程的动手 / 编程挑战 / 自由创作、面板页的导览和镜像都用它（图本身是 device-panel.js 画的，这里只管镜头）。
import { h, clamp } from './util.js';

// minW 定了键有多大（取景越窄键越大），aspect（宽 / 高）定了这张图占多高。
export const BENCH_VIEW = { pad: 26, minW: 430, aspect: 1.85 };
// 要同时看到轨道旋钮和两排步进键的场合（编程挑战、自由创作）：取景方一些，步进键才够手指点
export const PROG_VIEW = { pad: 18, minW: 400, aspect: 1.4 };

/**
 * 按左边那一栏现在的宽和高，算这张图该取多扁：屏幕高（大平板）就取得方一些，把高度用上、能看到的范围也大；
 * 屏幕矮就扁一些，保证这一栏不用滚。reserve = 这一栏里图以外的东西（气泡、解说条……）要占的高度。
 * 还没挂到页面上、量不到的时候用 base 自己的比例。
 */
export function fitView(col, base, reserve) {
  const w = col.clientWidth;
  const hh = col.clientHeight - reserve;
  // 这一栏的高度是跟着内容走的（窗口太窄、叠成一列的时候）：没有“高矮”可言，用 base 的
  if (!w || hh < 120 || getComputedStyle(col).overflowY === 'visible') return base;
  return { ...base, aspect: clamp(w / hh, 1.25, base.aspect) };
}

/**
 * “看整台 / 只看要按的那一块”的开关。getPanel = 现在那张面板图（可能还没有），getIds = 现在该看哪几个控件。
 * opts 是取景的参数，也可以是一个函数（每次取景时现算，比如配合 fitView）。
 * 返回 { el, apply(), dock(机器的元素) }：换了机器、换了要看的键之后调一下 apply()；
 * dock 把开关放到机器下面解说条那一行的右边（省一行的高度）。
 */
export function benchView(getPanel, getIds, onChange, opts = BENCH_VIEW) {
  const viewNow = () => (typeof opts === 'function' ? opts() : opts);
  let whole = false;
  const btn = h('button', { class: 'btn sm bench-view', type: 'button' });
  const apply = () => {
    const ids = getIds() || [];
    getPanel()?.focus(!whole && ids.length ? ids : [], viewNow());
    btn.textContent = whole ? '只看要按的那一块' : '看整台';
    btn.style.display = ids.length ? '' : 'none';
    onChange?.();
  };
  btn.addEventListener('click', () => {
    whole = !whole;
    apply();
  });
  return { el: btn, apply, dock: (root) => root?.querySelector('.sim-bar')?.append(btn) };
}

/**
 * 这一栏的大小变了就重新取景。重新取景会改这一栏里的高度，不能在量尺寸的回调里当场做（浏览器会报“量不完”）：
 * 隔一小会儿再做，大小没变就不做。返回停止的函数。
 */
export function refitOnResize(col, apply) {
  let sized = '';
  let timer = 0;
  const ro = new ResizeObserver(() => {
    const now = `${col.clientWidth}x${col.clientHeight}`;
    if (now === sized) return;
    sized = now;
    clearTimeout(timer);
    timer = setTimeout(apply, 80);
  });
  ro.observe(col);
  return () => {
    ro.disconnect();
    clearTimeout(timer);
  };
}
