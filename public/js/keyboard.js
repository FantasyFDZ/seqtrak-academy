// 键盘学习方式的“手”：电脑键盘按下 / 松开 → 屏幕上那台模拟机的键按下 / 松开（键位在 keymap.js，模拟机那头是 simulator.js 的 kbd*）。
//
// 什么时候接管键盘：学习方式是键盘（learn-mode.js），模拟机在屏幕上看得见，没在输入框里打字，上面没盖着全屏的东西（过关和升级的庆祝、开屏）。
// 不接管的时候一个键都不碰，别的地方自己的按键照常：
//   音游（和模拟机不同屏）、延迟校准、开屏的空格 / 回车、庆祝（Esc 合上）、啾啾的输入框（输入框拿着焦点）。
//   拿着焦点、自己会听方向键 / 空格 / 回车的东西（OWN_KEYS：音色、效果实验台的旋钮和滑条，小课堂的敲击板、琴键）：这几个键给它们。
// 接管的键：preventDefault + stopPropagation（在 window 的捕获阶段），页面上别处就收不到了；松手（keyup）不管当时接不接管都送到模拟机，免得按着的键卡住。
// 焦点：用 Tab 走到页面上某个按钮再按回车，照常是按那个按钮（kbFocus）；空格一律是 [PLAY]（按钮还留着焦点时也是）。
// Tab 走到模拟机上没有专门电脑键的控件（[VOL+]、右边 4 个旋钮……）时：回车 = 按它（按住回车 = 按住它），↑ ↓ = 转它。
// ? = 弹出整张键位图（键盘方式下哪一页都行）。
import { h, clamp, rich } from './util.js';
import { simulator } from './simulator.js';
import { learn } from './learn-mode.js';
import { idOfCode, keyLabels, TURNABLE, keymapView, KEYMAP_LINES } from './keymap.js';
import { controlInfo } from './controls.js';
import { TRACK } from './tracks.js';

// 模拟机上没有专门电脑键的控件：能用 Tab 选中
const TAB_IDS = ['VOL+', 'VOL-', 'RECSAMPLE', 'UNDO', 'CLEARFX', 'MASTERSINGLE', 'FXPAGE', 'SD1', 'SD2', 'SD3', 'SD4', 'FX', 'FXLEVEL'];
const OWN_KEYS = '[role="slider"], input[type="range"], .cl-pad, .cl-wkey, .cl-skey, [data-keys="own"]';
const STRIP_START = 0.2; // ← / → 按下去时手指按在触摸条的多高（REPEATER：一拍一拍地重复）
const STRIP_STEP = 0.2;

let kbFocus = false; // 最近一次焦点是用键盘（Tab）挪过去的
let hover = null; // 鼠标正指着模拟机上的哪个控件
const down = new Map(); // 正按着的电脑键：event.code → 控件 id
const strips = new Map(); // 正按着的触摸条：id → 手指的高度
let lastTurn = 0;
let pop = null; // 弹出来的整张键位图
let lastSkip = null; // 最近一次没接的键和原因（走查卡住时看，见 kbdDebug）

/** 开发用：最近一次没接管的键和原因（dev/walk-ch4.js 卡住时写进结果里） */
export const kbdDebug = () => ({ lastSkip, down: [...down.entries()], held: simulator.kbdHeld });

function simVisible() {
  const p = simulator.panel;
  if (!p?.el.isConnected) return false;
  const r = p.svg.getBoundingClientRect();
  return r.width > 120 && r.height > 40 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
}
const covered = () => !!document.querySelector('.celebrate, .splash');
const typing = (el) => !!el?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
/** 拿着焦点的是模拟机上的哪个控件 */
function simFocus() {
  const n = document.activeElement?.closest?.('[data-id]');
  return n && simulator.panel?.svg.contains(n) ? n.dataset.id : null;
}
/** 拿着焦点的是页面上别的东西（按钮、链接……），不是页面本身，也不是模拟机 */
function foreignFocus() {
  const a = document.activeElement;
  if (!a || a === document.body || a === document.documentElement || a.id === 'view' || simulator.panel?.svg.contains(a)) return null;
  return a;
}

/** ↑ ↓：转哪个旋钮。返回 true = 转了（页面不滚） */
function turn(dir) {
  // 触摸条按着：手指往上推 / 往下拉（最后按下的那条）
  const strip = [...strips.keys()].pop();
  if (strip) {
    const v = clamp(strips.get(strip) + dir * STRIP_STEP, 0.05, 1);
    strips.set(strip, v);
    simulator.kbdTouch(strip, v);
    return true;
  }
  const focusId = simFocus();
  if (focusId && TURNABLE.has(focusId)) {
    simulator.kbdTurn(focusId, dir);
    return true;
  }
  const held = simulator.kbdHeld;
  // 按着轨道键（或 ALL）：转的就是它
  const knob = [...held].reverse().find((id) => TRACK[id] || id === 'ALL');
  if (knob) {
    simulator.kbdTurn(knob, dir);
    return true;
  }
  // 鼠标指着的旋钮（按着步进键时指着旋钮 2 = 只给这一步锁音高）
  if (hover && TURNABLE.has(hover)) {
    simulator.kbdTurn(hover, dir);
    return true;
  }
  // 按着 [OCTAVE]、步进键、[PAGE]：转的是 ALL（升降八度、改音长、改 scene 的长度）；
  // 鼓轨上按着方键时转的是右边第 4 个旋钮（按住亮着的一步，只改这一步的力度）：哪一个由模拟机说（kbdArrowKnob）
  if (held.some((id) => id === 'OCTAVE' || id === 'PAGE' || /^DK/.test(id))) {
    simulator.kbdTurn(simulator.kbdArrowKnob, dir);
    return true;
  }
  return false;
}

function onKeyDown(e) {
  if (!learn.keyboard || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
  if (typing(e.target)) return;
  if (e.key === '?' || e.key === '？' || (e.code === 'Slash' && e.shiftKey)) {
    e.preventDefault();
    if (!e.repeat) toggleKeymap();
    return;
  }
  if (pop) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeKeymap();
      return;
    }
    // 键位图开着时：如果底下正好有模拟机，就允许边看键位图边按响它（只有合上按钮拿焦点按回车时留给合上按钮）
    if (!simVisible() || (e.code === 'Enter' && document.activeElement?.closest?.('.km-pop button'))) return;
  }
  if (!simVisible() || covered()) {
    lastSkip = { code: e.code, why: !simulator.panel?.el.isConnected ? 'no-panel' : covered() ? 'covered' : `hidden ${JSON.stringify(simulator.panel.svg.getBoundingClientRect())}` };
    return;
  }
  const code = e.code;
  // 拿着焦点的是自己会听方向键 / 空格 / 回车的东西（音色、效果实验台的旋钮和滑条，小课堂的敲击板、琴键）：这几个键给它
  if (e.target?.closest?.(OWN_KEYS) && /^(Arrow|Space$|Enter$)/.test(code)) return;
  const take = () => {
    e.preventDefault();
    e.stopPropagation();
  };
  if (code === 'ArrowUp' || code === 'ArrowDown') {
    const now = performance.now();
    if (e.repeat && now - lastTurn < 70) return take(); // 按着不放：一秒十几格，别太快
    if (turn(code === 'ArrowUp' ? 1 : -1)) {
      lastTurn = now;
      take();
    }
    return;
  }
  const focusId = simFocus();
  // Tab 选中了模拟机上的一个控件：回车 = 按它
  const id = code === 'Enter' && focusId ? focusId : idOfCode(code);
  if (!id) return;
  // Tab 走到了页面上别的按钮：回车照常给它（按那个按钮）。空格不给：模拟机在屏幕上时空格一律是 [PLAY]——
  // 不然用 Tab + 回车点了“下一步”之后焦点还留在它上面，再按空格想播放，又点了一次“下一步”
  const other = foreignFocus();
  if (other && kbFocus && code === 'Enter') return;
  take();
  if (e.repeat || down.has(code)) {
    if (!e.repeat) lastSkip = { code, why: 'already-down' };
    return;
  }
  down.set(code, id);
  if (id === 'HIGHPASS' || id === 'REPEATER') {
    strips.delete(id);
    strips.set(id, STRIP_START);
    simulator.kbdTouch(id, STRIP_START);
    return;
  }
  simulator.kbdDown(id);
}

function onKeyUp(e) {
  const id = down.get(e.code);
  if (!id) return;
  down.delete(e.code);
  e.preventDefault();
  e.stopPropagation();
  if (strips.has(id)) {
    strips.delete(id);
    simulator.kbdUntouch(id);
    return;
  }
  simulator.kbdUp(id);
}

/** 切到别的窗口、页面藏起来：按着的都当松开了（不然松手的那一下收不到，模拟机上一直按着） */
function releaseAll() {
  down.clear();
  strips.clear();
  simulator.kbdReleaseAll();
}

/** 模拟机挂上去、学习方式变了：键帽上标电脑键、没专门键的能用 Tab 选中 */
function applyPanel() {
  const p = simulator.panel;
  simulator.setKeyboard(learn.keyboard);
  if (!p) return;
  p.setKeys(learn.keyboard ? keyLabels() : null);
  p.setFocusable(learn.keyboard ? Object.fromEntries(TAB_IDS.filter((id) => p.has(id)).map((id) => [id, controlInfo(id)?.en || id])) : null);
  p.el.classList.toggle('kbd-mode', learn.keyboard);
}

// ───── 整张键位图（按 ? 弹出来） ─────

function toggleKeymap() {
  if (pop) return closeKeymap();
  const close = h('button', { class: 'btn sm', type: 'button', onclick: () => closeKeymap() }, '合上（Esc）');
  pop = h('div', { class: 'km-pop', role: 'dialog', 'aria-modal': 'true', 'aria-label': '键位图', onpointerdown: (e) => e.target === pop && closeKeymap() },
    h('div', { class: 'km-card' },
      h('div', { class: 'row km-head' }, h('h3', {}, '键位图：电脑键盘 = 机器上的键'), h('span', { class: 'spacer' }), close),
      keymapView(),
      h('ul', { class: 'km-lines' }, KEYMAP_LINES.map((t) => h('li', { html: rich(t) })))));
  document.body.append(pop);
  close.focus({ preventScroll: true });
}

function closeKeymap() {
  pop?.remove();
  pop = null;
}

/** main.js 开机时调一次 */
export function initKeyboard() {
  addEventListener('keydown', onKeyDown, true);
  addEventListener('keyup', onKeyUp, true);
  addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => document.hidden && releaseAll());
  addEventListener('keydown', (e) => {
    if (e.key === 'Tab') kbFocus = true;
  }, true);
  addEventListener('pointerdown', () => {
    kbFocus = false;
  }, true);
  document.addEventListener('pointerover', (e) => {
    const n = e.target?.closest?.('[data-id]');
    hover = n && simulator.panel?.svg.contains(n) ? n.dataset.id : null;
  });
  simulator.on('mount', applyPanel);
  learn.on('change', () => {
    if (!learn.keyboard) {
      releaseAll();
      closeKeymap();
    }
    applyPanel();
  });
  applyPanel();
}

export { toggleKeymap as showKeymap };
