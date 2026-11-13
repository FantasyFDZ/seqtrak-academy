// 啾啾：住在应用里的教练小鸟（一只红嘴相思鸟）。样子、神态、动作在 bird.js，叫声在 bird-voice.js，样稿页是 /bird-lab.html。
// 全应用只有一只。它待在一层盖在最上面的透明层里（.jiu-layer），自己飞来飞去：
//   · 平时蹲在左边导航栏最下面它的窝里（#coach-toggle 里的 .jiu-nest）。
//   · 页面上给它留了位置（perch：首页的问候卡、音游的结算卡、过关的庆祝卡……都是 coach-face.js 的 coachFace() 留的），它就飞过去蹲着。
//   · 动手的步骤要按哪个键，它就飞到那个键的上方悬停着指给你看（point）。
//   后留的位置优先；位置没了（页面换走、卡片关了、滚出了屏幕），它就回到前一个，都没了就回窝。
// 它说的话从它身边冒出来（say）：一句话，可以带几个选项、一个输入框，或者干脆是一张“小纸条”（paper）。说什么由 coach.js 管。
// 叫声跟“界面音效”开关走；音游打着的时候（sfx.held）不出声、不乱飞。
import { createBird } from './bird.js';
import { voice } from './bird-voice.js';
import { h, clamp } from './util.js';
import { store } from './store.js';
import { sfx } from './sfx.js';
import { midi } from './midi.js';

const FOOT_X = 102 / 200; // 爪子在小鸟那张图里的位置（bird.js 的 FOOT）
const FOOT_Y = 184 / 200;
const NEST = 46; // 在窝里时多大
const SLEEP_AFTER = 180000; // 这么久什么都没碰就打瞌睡

let layer = null;
let bird = null;
let talk = null;
let talkBody = null;
let nestEl = null;
let onTap = null;
const spots = [];
let current = null; // 现在要去（或已经在）的那个位置
let flying = false;
let moves = 0;
let mood = 'idle'; // 全局的神态（setMood）
let moodTimer = 0;
let talkMood = null; // 正在说的这句话要的神态，盖过全局的
let talkTimer = 0;
let pending = null; // 这句话在等什么：{ resolve, next }
let kind = ''; // 气泡开着的话：'talk' 和你说着话 / 'nudge' 它主动说的一句
let says = 0; // 说过几句（选项点完之后看看有没有接着说话，没有就收起气泡）
let lastInput = performance.now();
let lastOops = 0;
let following = false;

const still = () => document.documentElement.hasAttribute('data-still');
const nest = { mode: 'perch', size: NEST, rect: () => (nestEl?.isConnected ? nestEl.getBoundingClientRect() : null) };

const visible = (r) => !!r && r.width > 0 && r.height > 0 && r.bottom > 4 && r.top < innerHeight - 4 && r.right > 4 && r.left < innerWidth - 4;

/** 现在该去哪儿：后留的、还在屏幕上的那个位置；都不在就回窝 */
function pick() {
  const now = performance.now();
  for (let i = spots.length - 1; i >= 0; i--) {
    const s = spots[i];
    // 留位置的那块已经从页面上拿掉了（页面换走时没来得及 release）：清掉；一直没挂上页面的，过一阵也清掉
    if (s.el) {
      if (s.el.isConnected) s.seen = true;
      else if (s.seen || now - s.born > 10000) {
        spots.splice(i, 1);
        continue;
      }
    }
    const r = s.rect();
    if (visible(r)) return [s, r];
  }
  return [nest, nest.rect()];
}

const sizeOf = (spot) => Math.round(clamp(spot.size || NEST, 40, 96));

/** 在这个位置时，爪子该落在哪儿 */
function feetFor(spot, r, size) {
  const cx = r.left + r.width / 2;
  if (spot.mode === 'hover') {
    // 悬停在键的正上方；键上面没地方了（贴着屏幕上沿），就停到它下面
    if (r.top - size < 6) return [cx, r.bottom + size * 0.98];
    return [cx, r.top - 4];
  }
  // 蹲在留的那块地方里：小鸟整个图框和那一块对齐
  const cy = r.top + r.height / 2;
  return [cx - size / 2 + FOOT_X * size, cy - size / 2 + FOOT_Y * size];
}

function feetNow() {
  const s = bird.el.offsetWidth;
  return [bird.el.offsetLeft + FOOT_X * s, bird.el.offsetTop + FOOT_Y * s];
}

function go(spot, r) {
  const size = sizeOf(spot);
  if (bird.el.style.width !== `${size}px`) bird.el.style.width = bird.el.style.height = `${size}px`;
  const [x, y] = feetFor(spot, r, size);
  const hover = spot.mode === 'hover';
  const me = ++moves;
  // 截图用的“直接到位”、音游打着的时候：不飞，直接过去
  if (still() || sfx.held) {
    bird.placeAt(x, y);
    bird.setAir(hover ? 'hover' : null);
    flying = false;
    settle(spot);
    return;
  }
  flying = true;
  (hover ? bird.hoverAt(x, y) : bird.flyTo(x, y)).then(() => {
    if (me !== moves) return;
    flying = false;
    settle(spot);
  });
}

/** 到了：对齐（飞的途中个头在变，最后一帧可能差一点），朝着屏幕中间，换上这个位置要的神态，要做的动作做一下 */
function settle(spot) {
  snap();
  if (spot.mode !== 'hover') bird.face(feetNow()[0] > innerWidth * 0.6 ? 'left' : 'right');
  applyMood();
  if (spot.act && !spot.acted) {
    spot.acted = true;
    bird.act(spot.act);
  }
  placeTalk();
}

/** 看一眼该在哪儿：换了位置就飞过去；位置跟着页面挪了一点（滚动、版式变了）就直接跟上 */
function sync() {
  if (!bird) return;
  const [spot, r] = pick();
  if (!r) return;
  if (spot !== current) {
    current = spot;
    go(spot, r);
    return;
  }
  if (flying) return;
  const size = sizeOf(spot);
  const [x, y] = feetFor(spot, r, size);
  const [bx, by] = feetNow();
  const d = Math.hypot(x - bx, y - by);
  if (d > 80 && !still() && !sfx.held) go(spot, r);
  else if (d > 0.5) bird.placeAt(x, y);
}
/** 不飞，直接对齐到现在这个位置上 */
function snap() {
  if (!current || flying) return;
  const r = current.rect();
  if (!visible(r)) return;
  const [x, y] = feetFor(current, r, bird.el.offsetWidth);
  bird.placeAt(x, y);
}
let syncQueued = false;
function syncSoon() {
  if (syncQueued) return;
  syncQueued = true;
  setTimeout(() => {
    syncQueued = false;
    sync();
  }, 0);
}

function addSpot(spot) {
  spot.born = performance.now();
  spots.push(spot);
  syncSoon();
  return () => {
    const i = spots.indexOf(spot);
    if (i >= 0) spots.splice(i, 1);
    if (current === spot) current = null;
    syncSoon();
  };
}

function applyMood() {
  if (!bird) return;
  const want = talkMood || current?.mood || mood;
  if (bird.mood !== want) bird.setMood(want);
}

// ───────────── 说话的气泡 ─────────────

/** 气泡摆在小鸟旁边：在导航栏的窝里时摆右边，平时摆上面，放不下就换一边；小尖角指着小鸟 */
function placeTalk() {
  if (!talk?.classList.contains('on')) return;
  const b = bird.el.getBoundingClientRect();
  const s = b.width;
  // 小鸟身子占的那一块（图框四周是空的）
  const body = { left: b.left + s * 0.18, right: b.left + s * 0.88, top: b.top + s * 0.22, bottom: b.top + s * 0.94 };
  const cx = (body.left + body.right) / 2;
  const cy = (body.top + body.bottom) / 2;
  const w = talk.offsetWidth;
  const ht = talk.offsetHeight;
  const vw = innerWidth;
  const vh = innerHeight;
  const m = 10;
  const gap = 14;
  const at = {
    above: () => ({ left: clamp(cx - w / 2, m, vw - m - w), top: body.top - gap - ht, tail: 'bottom' }),
    right: () => ({ left: body.right + gap, top: clamp(cy - ht + 34, m, vh - m - ht), tail: 'left' }),
    left: () => ({ left: body.left - gap - w, top: clamp(cy - ht + 34, m, vh - m - ht), tail: 'right' }),
    below: () => ({ left: clamp(cx - w / 2, m, vw - m - w), top: body.bottom + gap, tail: 'top' }),
  };
  const order = cx < 150 ? ['right', 'above', 'below', 'left'] : cx > vw - 220 ? ['left', 'above', 'below', 'right'] : ['above', 'right', 'left', 'below'];
  const fits = (p) => p.left >= m - 0.5 && p.top >= m - 0.5 && p.left + w <= vw - m + 0.5 && p.top + ht <= vh - m + 0.5;
  let p = null;
  for (const k of order) {
    const c = at[k]();
    if (fits(c)) {
      p = c;
      break;
    }
  }
  p ||= { left: clamp(cx - w / 2, m, vw - m - w), top: clamp(body.top - gap - ht, m, vh - m - ht), tail: 'bottom' };
  talk.style.left = `${Math.round(p.left)}px`;
  talk.style.top = `${Math.round(p.top)}px`;
  talk.dataset.tail = p.tail;
  const along = p.tail === 'bottom' || p.tail === 'top' ? cx - p.left : cy - p.top;
  talk.style.setProperty('--tail', `${Math.round(clamp(along, 20, (p.tail === 'bottom' || p.tail === 'top' ? w : ht) - 20))}px`);
}

/** 气泡开着的时候每一帧摆一次（小鸟在飞、页面在滚，它都跟着） */
function follow() {
  if (following) return;
  following = true;
  const step = () => {
    if (!talk.classList.contains('on')) {
      following = false;
      return;
    }
    placeTalk();
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function settlePending(why) {
  const p = pending;
  pending = null;
  p?.resolve(why);
}

/**
 * 说一句，气泡从小鸟身边冒出来。返回一个 Promise，这句话说完了就 resolve，值是怎么说完的：
 *   'tap' 点了一下（下一句）  'timeout' 到时间了  'chip' 点了选项  'replaced' 被下一句顶掉了  'hushed' 气泡收起来了
 * 参数：
 *   html     要说的话（HTML）
 *   paper    { title, html | node }：不是一句话，是一张小纸条（黄色的纸），用在小纸条的回答和纸条本里
 *   chips    [[文字, 点了做什么, { primary, ghost }], …]：点了就做；做的事里没有接着说话，气泡就收起来
 *   ask      { placeholder, onSubmit(text, asNote) }：带一个输入框；“问”= 一句一句地答，“写张小纸条”= asNote 为 true
 *   next     后面还有话：右下角一个 ▸，点一下气泡看下一句
 *   ms       多久之后往下走（next）或收起来；0 = 一直留着
 *   mood / call / act   这一句的神态、叫声（bird-voice.js 的叫法）、动作（bird.js 的 ACTIONS）
 *   kind     'talk' 和你说着话（默认）/ 'nudge' 它主动冒出来说的一句
 *   quiet    内容和刚才一样、只是换了选项：不再弹一下、不再叫
 */
export function say({ html = '', paper = null, chips = [], ask = null, next = false, ms = 0, mood: m = null, call = null, act = null, kind: k = 'talk', quiet = false } = {}) {
  if (!talk) return Promise.resolve('hushed');
  settlePending('replaced');
  clearTimeout(talkTimer);
  says++;
  kind = k;
  talk.dataset.kind = k;
  const parts = [];
  if (paper) {
    parts.push(h('div', { class: 'jiu-paper-title' }, paper.title || '啾啾的小纸条'));
    parts.push(paper.node || h('div', { class: 'jiu-paper-body', html: paper.html || '' }));
  } else {
    parts.push(h('div', { class: 'jiu-line', html }));
  }
  if (ask) parts.push(askForm(ask));
  if (chips.length) {
    parts.push(h('div', { class: 'jiu-chips' }, chips.filter(Boolean).map(([label, fn, o = {}]) => h('button', {
      class: ['btn', 'sm', o.primary && 'primary', o.ghost && 'ghost'], type: 'button', 'data-sfx': 'none',
      onclick: (e) => {
        e.stopPropagation();
        const before = says;
        settlePending('chip');
        fn?.();
        if (says === before) hush();
      },
    }, label))));
  }
  if (next) parts.push(h('span', { class: 'jiu-next', 'aria-hidden': 'true' }, '▸'));
  talkBody.replaceChildren(...parts);
  talk.classList.toggle('paper', !!paper);
  talk.classList.toggle('has-next', !!next);
  const wasOn = talk.classList.contains('on');
  talk.classList.add('on');
  if (!quiet || !wasOn) {
    talk.classList.remove('pop');
    void talk.offsetWidth;
    talk.classList.add('pop');
  }
  talkMood = m;
  applyMood();
  if (act && !quiet) bird.act(act);
  if (call && !quiet) chirp(call);
  placeTalk();
  follow();
  if (ask) setTimeout(() => talk.querySelector('textarea')?.focus(), 60);
  return new Promise((resolve) => {
    pending = { resolve, next };
    if (ms) talkTimer = setTimeout(() => (next ? settlePending('timeout') : hush()), ms);
  });
}

function askForm({ placeholder = '想问什么，直接写', onSubmit }) {
  const input = h('textarea', { rows: '2', placeholder, maxlength: '600' });
  const send = (deep) => {
    const text = input.value.trim();
    if (!text) return input.focus();
    input.blur();
    const before = says;
    settlePending('chip');
    onSubmit?.(text, deep);
    if (says === before) hush();
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      send(false);
    }
    e.stopPropagation(); // 别让快捷键（模拟机的电脑键盘）收到
  });
  return h('form', { class: 'jiu-ask', onsubmit: (e) => { e.preventDefault(); send(false); } },
    input,
    h('div', { class: 'jiu-ask-row' },
      h('button', { class: 'btn sm primary', type: 'submit', 'data-sfx': 'none' }, '问'),
      h('button', { class: 'btn sm', type: 'button', 'data-sfx': 'none', title: '写得细一点，可以收进纸条本', onclick: () => send(true) }, '写张小纸条')));
}

/** 把气泡收起来 */
export function hush() {
  clearTimeout(talkTimer);
  if (talk) talk.classList.remove('on', 'pop');
  kind = '';
  talkMood = null;
  applyMood();
  settlePending('hushed');
}

/** 气泡开着的话，是哪一种：'talk' / 'nudge'；没开是 '' */
export const talking = () => (talk?.classList.contains('on') ? kind : '');

// ───────────── 叫声、神态、动作 ─────────────

/** 叫一声（叫法见 bird-voice.js）。界面音效关着、音游打着的时候只动嘴不出声 */
export function chirp(call) {
  if (!bird) return;
  voice.enabled = store.settings.uiSound !== false && !sfx.held;
  bird.sing(call);
}

/** 换全局的神态；ms = 过这么久回到待机 */
export function setMood(m, ms = 0) {
  clearTimeout(moodTimer);
  mood = m || 'idle';
  applyMood();
  if (ms > 0) moodTimer = setTimeout(() => setMood('idle'), ms);
}
export const getMood = () => mood;

/** 做一个动作（bird.js 的 ACTIONS） */
export function act(name) {
  if (bird && !sfx.held) bird.act(name);
}

/** 做偏了：摇摇头（不出声，你可能正听着机器；隔几秒才摇一次） */
export function oops() {
  const now = performance.now();
  if (!bird || now - lastOops < 3500 || talking()) return;
  lastOops = now;
  bird.act('shake');
  if (mood === 'idle') setMood('oops', 1100);
}

let grooveBpm = 0;
/** 音游打着的时候跟着它的拍子点头（不出声、不乱飞）；bpm = 0 停下 */
export function groove(bpm) {
  grooveBpm = bpm > 0 ? bpm : 0;
  applyGroove();
}
function applyGroove() {
  if (!bird) return;
  if (grooveBpm) bird.el.style.setProperty('--beat', `${(60 / grooveBpm).toFixed(3)}s`);
  else bird.el.style.removeProperty('--beat');
  bird.el.classList.toggle('jiu-groove', grooveBpm > 0 || !!midi.playing);
}

// ───────────── 位置 ─────────────

/** 在 el 那一块蹲着（coachFace 用）。返回 { set(mood), release() } */
export function perch(el, { size, mood: m = null, act: a = null } = {}) {
  const spot = { mode: 'perch', el, size, mood: m, act: a, rect: () => (el.isConnected ? el.getBoundingClientRect() : null) };
  const release = addSpot(spot);
  return {
    set(next) {
      spot.mood = next;
      if (current === spot) applyMood();
    },
    release,
  };
}

/** 飞到 rect() 那里（视口坐标的矩形；返回 null = 现在指不了）的上方悬停着，指给你看。返回“不指了”的函数 */
export function point(rect, { size = 44, mood: m = null } = {}) {
  return addSpot({ mode: 'hover', rect, size, mood: m });
}

// ───────────── 装上 ─────────────

/** 装上小鸟。nest = 导航栏里给它留的窝；tap = 点了小鸟要做什么 */
export function mount(nestHost, { tap } = {}) {
  if (layer) return;
  nestEl = nestHost;
  onTap = tap;
  bird = createBird({ size: NEST });
  bird.el.setAttribute('title', '啾啾：点一下和它说话');
  // 它悬停着指键的时候，身子会挡住后面的键（比如指着第 9 个方键时挡住第 1 个）：点到它身上、身后正好是机器图上的一个键，
  // 就把这一下（按下、拖、松开）原样转给那个键，不当成点它。想和它说话就点导航栏里它的窝
  let passing = false;
  bird.el.addEventListener('pointerdown', (e) => {
    if (current?.mode !== 'hover') return;
    const under = document.elementsFromPoint(e.clientX, e.clientY).find((n) => !layer.contains(n));
    const node = under?.closest?.('.panel-wrap [data-id]');
    if (!node) return;
    e.preventDefault();
    e.stopPropagation();
    passing = true;
    const init = (ev, buttons) => ({ bubbles: true, cancelable: true, clientX: ev.clientX, clientY: ev.clientY, pointerId: e.pointerId, pointerType: e.pointerType, isPrimary: true, button: 0, buttons });
    node.dispatchEvent(new PointerEvent('pointerdown', init(e, 1)));
    const move = (ev) => node.dispatchEvent(new PointerEvent('pointermove', init(ev, 1)));
    const up = (ev) => {
      removeEventListener('pointermove', move, true);
      removeEventListener('pointerup', up, true);
      removeEventListener('pointercancel', up, true);
      node.dispatchEvent(new PointerEvent(ev.type, init(ev, 0)));
      setTimeout(() => (passing = false), 0); // 紧跟着的那个 click 也不算点它
    };
    addEventListener('pointermove', move, true);
    addEventListener('pointerup', up, true);
    addEventListener('pointercancel', up, true);
  });
  bird.el.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!passing) onTap?.();
  });
  talkBody = h('div', { class: 'jiu-body' });
  talk = h('div', { class: 'jiu-talk', role: 'status', 'aria-live': 'polite' }, h('i', { class: 'jiu-tail', 'aria-hidden': 'true' }), talkBody);
  talk.addEventListener('click', (e) => {
    if (e.target.closest('button, a, textarea, input, form, .jiu-notes')) return;
    if (pending?.next) settlePending('tap');
    else if (!talk.querySelector('.jiu-chips, .jiu-ask')) hush(); // 光一句话：点一下就收
  });
  layer = h('div', { class: 'jiu-layer' }, bird.el, talk);
  document.body.append(layer);
  current = nest;
  const r = nest.rect();
  if (r) {
    const [x, y] = feetFor(nest, r, NEST);
    bird.placeAt(x, y);
  }
  // 位置每隔一会儿看一眼；滚动、窗口大小变了马上看
  setInterval(sync, 220);
  bird.el.addEventListener('transitionend', snap); // 个头变完了再对齐一次
  addEventListener('scroll', syncSoon, { capture: true, passive: true });
  addEventListener('resize', () => {
    syncSoon();
    placeTalk();
  });
  window.visualViewport?.addEventListener('resize', syncSoon);

  // 跟着拍子点头：机器在放的时候（跟着机器的速度），音游打着的时候（groove(bpm)，跟着谱面的速度）
  midi.on('start', applyGroove);
  midi.on('stop', applyGroove);
  midi.on('state', applyGroove);

  // 好久没动静就打瞌睡；一碰就醒
  const wake = () => {
    lastInput = performance.now();
    if (mood === 'sleepy') setMood('surprised', 700);
  };
  addEventListener('pointerdown', wake, true);
  addEventListener('keydown', wake, true);
  midi.on('noteon', wake);
  setInterval(() => {
    if (sfx.held || talking() || mood !== 'idle' || document.hidden) return;
    if (performance.now() - lastInput > SLEEP_AFTER) setMood('sleepy');
  }, 5000);
}
