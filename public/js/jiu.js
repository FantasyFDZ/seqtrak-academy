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
import { controlInfo } from './controls.js';

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
const calmFx = () => document.documentElement.dataset.fx === 'calm' || matchMedia('(prefers-reduced-motion: reduce)').matches;
let lapping = false; // 正在绕圈飞（彩蛋）：这时候不管该在哪儿
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
  if (spot.mode === 'free') return spot.feet; // 被你放下的地方：爪子就在那一点
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
    landed();
    return;
  }
  flying = true;
  // 飞之前先把对话框收起来（用户 2026-11-13）：停稳了再弹出来
  if (talk?.classList.contains('on')) talk.classList.remove('pop');
  talk?.classList.add('away');
  (hover ? bird.hoverAt(x, y) : bird.flyTo(x, y)).then(() => {
    if (me !== moves) return;
    flying = false;
    settle(spot);
    landed();
  });
}

/** 停稳了：收着的对话框弹回来，等着它停稳再开口的人接着说 */
const landWaiters = [];
function landed() {
  if (talk?.classList.contains('away')) {
    talk.classList.remove('away');
    if (talk.classList.contains('on')) {
      void talk.offsetWidth;
      talk.classList.add('pop');
      placeTalk();
    }
  }
  landWaiters.splice(0).forEach((f) => f());
}

/**
 * 等它停稳（飞到要指的键上、落到位置上）。刚让它去一个新地方（point / perch）就调：
 * 它要过一小会儿才起飞，所以先等一下再看；一直停不下来（比如窗口藏着，画面不动）最多等 2.5 秒。
 */
export function settled() {
  return new Promise((resolve) => {
    const cap = setTimeout(resolve, 2500);
    setTimeout(() => {
      if (!flying) {
        clearTimeout(cap);
        resolve();
      } else landWaiters.push(() => {
        clearTimeout(cap);
        resolve();
      });
    }, 40);
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
  if (!bird || lapping || dragging) return;
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
  const want = playMood || talkMood || current?.mood || mood;
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
 *   mood / call / act   这一句的神态、叫声（bird-voice.js 的叫法；'speak' = 照着这句话“说”一段）、动作（bird.js 的 ACTIONS）
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
  talk.classList.toggle('away', flying); // 正在飞：先收着，停稳了再弹出来（landed）
  if ((!quiet || !wasOn) && !flying) {
    talk.classList.remove('pop');
    void talk.offsetWidth;
    talk.classList.add('pop');
  }
  talkMood = m;
  applyMood();
  if (act && !quiet) bird.act(act);
  // 'speak' = 照着这句话的样子“说”出来（长短、句尾的语气）
  if (call && !quiet) chirp(call, call === 'speak' ? { text: talkBody.querySelector('.jiu-line')?.textContent || '' } : undefined);
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
  if (talk) talk.classList.remove('on', 'pop', 'away');
  kind = '';
  talkMood = null;
  applyMood();
  settlePending('hushed');
}

/** 气泡开着的话，是哪一种：'talk' / 'nudge'；没开是 '' */
export const talking = () => (talk?.classList.contains('on') ? kind : '');

// ───────────── 叫声、神态、动作 ─────────────

/** 叫一声（叫法见 bird-voice.js；opts 给 speak 传这句话）。界面音效关着、音游打着的时候只动嘴不出声 */
export function chirp(call, opts) {
  if (!bird) return;
  voice.enabled = store.settings.uiSound !== false && !sfx.held;
  return bird.sing(call, opts); // 每个音的 [开始毫秒, 时长秒]
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
let playingSince = 0;
function applyGroove() {
  if (!bird) return;
  if (grooveBpm) bird.el.style.setProperty('--beat', `${(60 / grooveBpm).toFixed(3)}s`);
  else bird.el.style.removeProperty('--beat');
  const playing = !!midi.playing;
  if (playing && !playingSince) playingSince = performance.now();
  if (!playing) playingSince = 0;
  bird.el.classList.toggle('jiu-groove', grooveBpm > 0 || playing);
  // 彩蛋：机器放了半分钟以上，从点头变成跟着拍子蹦（音游里不蹦）
  bird.el.classList.toggle('jiu-dance', playing && !grooveBpm && performance.now() - playingSince > 30000);
}

// ───────────── 彩蛋用的几样（什么时候用见 jiu-eggs.js） ─────────────

/**
 * 绕着一块地方飞一圈（一节课三星、升级、连续练了好几天）。getRect = 那一块的矩形（视口坐标）。
 * 克制档、截图用的“直接到位”、音游打着的时候不飞。飞完回到原来该在的地方。
 */
export function lap(getRect, { turns = 1, ms = 2200, song = true } = {}) {
  return new Promise((resolve) => {
    const r = getRect?.();
    if (!bird || lapping || !visible(r) || still() || sfx.held || calmFx()) return resolve();
    lapping = true;
    moves++; // 正在飞的那一趟作废
    flying = true;
    talk?.classList.add('away');
    const size = bird.el.offsetWidth;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2 + size * 0.4; // 爪子绕着转，身子正好绕着中心
    const rx = Math.min(innerWidth / 2 - size, r.width / 2 + size * 0.7);
    const ry = Math.min(innerHeight / 2 - size, r.height / 2 + size * 0.6);
    const [sx, sy] = feetNow();
    const a0 = Math.atan2((sy - cy) / ry, (sx - cx) / rx);
    const at = (p) => {
      const a = a0 - p * Math.PI * 2 * turns;
      return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
    };
    bird.setAir('fly');
    if (song) chirp('song');
    const t0 = performance.now();
    let last = [sx, sy];
    const step = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      let [x, y] = at(p);
      if (p < 0.15) {
        const k = p / 0.15;
        const e = k * k * (3 - 2 * k);
        x = sx + (x - sx) * e;
        y = sy + (y - sy) * e;
      }
      if (Math.abs(x - last[0]) > 0.5) bird.face(x < last[0] ? 'left' : 'right');
      const pitch = Math.atan2(y - last[1], Math.abs(x - last[0]) + 0.01) * (180 / Math.PI) * 0.5;
      bird.el.style.setProperty('--pitch', `${Math.max(-20, Math.min(20, pitch)).toFixed(1)}deg`);
      bird.placeAt(x, y);
      last = [x, y];
      if (p < 1) requestAnimationFrame(step);
      else {
        lapping = false;
        flying = false;
        current = null; // 飞回该在的地方
        sync();
        resolve();
      }
    };
    requestAnimationFrame(step);
  });
}

/** 嘴里叼着一样东西（一根羽毛）；null = 放下 */
export function carry(node) {
  if (!bird) return;
  bird.el.querySelector('.jiu-carry')?.remove();
  if (node) bird.el.append(h('span', { class: 'jiu-carry', 'aria-hidden': 'true' }, node));
}

/** 回窝一趟（比如叼羽毛回去）：返回“走了”的函数 */
export function goNest() {
  return addSpot({ mode: 'perch', size: NEST, rect: nest.rect });
}

/** 连点它 5 下：晕了 */
function dizzy(line = '别戳啦，啾……头好晕。') {
  hush();
  bird.act('dizzy');
  chirp('surprised');
  setTimeout(() => say({ kind: 'nudge', html: line, mood: 'oops', ms: 2400 }), 1000);
}

// ───────────── 拎起来玩（用户 2026-11-13：鼠标可以拖着啾啾挪到任何地方，随意把玩，它会有各种反应） ─────────────
//   拎起来：吓一跳，扑腾着翅膀、腿悬着，跟着手走；拎着走一会儿不晃，它当是坐飞机，高兴起来。
//   放下：就站在那儿（这一页上，直到换页、双击它、或者把它拖回窝）。站在机器的某个键上，它说脚下是哪个键，可以让它讲讲。
//   用力一甩：被甩出去一截，扑腾几下稳住。来回猛晃：晃晕了。拖到窝里：回家。拖到屏幕最上沿：有点怕高。
//   不按键、用鼠标在它身上来回蹭：舒服地理理羽毛。音游打着的时候拎不起来。
let dragging = null;
let dragged = false; // 刚拖完：紧跟着的那个 click 不算点它
let freeSpot = null;
let playMood = null;
let playTimer = 0;
let onKey = null;
const DROP_LINES = ['这儿视野不错，啾～', '就待这儿吧，啾。', '新地方，啾！', '嗯？这是哪儿，啾？', '挺好，啾～'];

function setPlayMood(m, ms = 0) {
  clearTimeout(playTimer);
  playMood = m;
  applyMood();
  if (ms) playTimer = setTimeout(() => setPlayMood(null), ms);
}

/** 不再站在被放下的地方：回到该在的地方（窝或者页面给它留的位置） */
function dropFree() {
  if (!freeSpot) return;
  const i = spots.indexOf(freeSpot);
  if (i >= 0) spots.splice(i, 1);
  if (current === freeSpot) current = null;
  freeSpot = null;
  syncSoon();
}
/** 叫它回来（双击它、双击窝、双击首页问候卡的圆盘）：被挪到别处了就回到该在的地方；本来就在，就应一声 */
export function callBack() {
  if (!bird) return;
  if (freeSpot) return goHome();
  hush();
  bird.act('hop');
  say({ kind: 'nudge', html: '在呢，啾！', mood: 'happy', call: 'greet', ms: 1400 });
}
/** 被你挪到别处了吗 */
export const isFree = () => !!freeSpot;
/** 回窝（或者回页面给它留的位置） */
export function goHome() {
  if (!freeSpot) return;
  dropFree();
  say({ kind: 'nudge', html: '回窝啦，啾。', mood: 'happy', call: 'greet', ms: 1800 });
}

function clampFeet(x, y) {
  const s = bird.el.offsetWidth;
  return [clamp(x, s * 0.45, innerWidth - s * 0.45), clamp(y, s * 0.95, innerHeight - 2)];
}

function beginDrag(e, start) {
  dragging = { ox: start.fx - start.x, oy: start.fy - start.y, samples: [], flips: 0, lastSign: [0, 0], since: performance.now(), happy: false };
  moves++; // 正在飞的那一趟作废
  flying = false;
  hush();
  bird.el.classList.add('jiu-held');
  document.documentElement.classList.add('jiu-dragging');
  bird.setAir('hover');
  setPlayMood('surprised');
  chirp('surprised');
  moveDrag(e);
}

function moveDrag(e) {
  const d = dragging;
  const [x, y] = clampFeet(e.clientX + d.ox, e.clientY + d.oy);
  const now = performance.now();
  const prev = d.samples[d.samples.length - 1];
  if (prev) {
    const dx = x - prev[1];
    const dy = y - prev[2];
    if (Math.abs(dx) > 1) bird.face(dx < 0 ? 'left' : 'right');
    // 数来回晃了几下：同一个方向上走了 6 像素以上又掉头，算一下
    [dx, dy].forEach((v, k) => {
      if (Math.abs(v) < 6) return;
      const sign = Math.sign(v);
      if (d.lastSign[k] && sign !== d.lastSign[k]) d.flips++;
      d.lastSign[k] = sign;
    });
  }
  d.samples.push([now, x, y]);
  if (d.samples.length > 12) d.samples.shift();
  bird.placeAt(x, y);
  // 拎着慢慢走一会儿：当是坐飞机；猛晃：不高兴
  if (d.flips >= 4) setPlayMood('oops');
  else if (!d.happy && now - d.since > 1500) {
    d.happy = true;
    setPlayMood('happy');
  }
}

async function endDrag() {
  const d = dragging;
  dragging = null;
  bird.el.classList.remove('jiu-held');
  document.documentElement.classList.remove('jiu-dragging');
  dragged = true;
  setTimeout(() => (dragged = false), 0);
  // 松手那一下的速度（最近 100 毫秒）
  const now = performance.now();
  const last = d.samples[d.samples.length - 1];
  const first = d.samples.find(([t]) => now - t < 100) || d.samples[0];
  const dt = Math.max(16, last[0] - first[0]);
  const vx = (last[1] - first[1]) / dt;
  const vy = (last[2] - first[2]) / dt;
  let [x, y] = [last[1], last[2]];
  const thrown = Math.hypot(vx, vy) > 1.4 && !calmFx(); // 松手时还快得像在甩（每毫秒 1.4 像素以上）
  if (thrown) [x, y] = clampFeet(x + vx * 260, y + vy * 260);
  // 拖回窝里：回家
  const n = nest.rect();
  if (n && x > n.left - 20 && x < n.right + 20 && y > n.top - 30 && y < n.bottom + 30) {
    dropFree();
    current = null;
    syncSoon();
    setPlayMood(null);
    say({ kind: 'nudge', html: '回家啦，啾～', mood: 'happy', call: 'ok', ms: 1800 });
    return;
  }
  // 放在这儿：以后就待在这儿（这一页上）
  if (freeSpot) {
    const i = spots.indexOf(freeSpot);
    if (i >= 0) spots.splice(i, 1);
  }
  const spot = { mode: 'free', feet: [x, y], size: bird.el.offsetWidth, born: performance.now(), rect: () => ({ left: x - 1, top: y - 1, right: x + 1, bottom: y + 1, width: 2, height: 2 }) };
  spots.push(spot);
  freeSpot = spot;
  current = spot;
  if (thrown) {
    const me = ++moves;
    flying = true;
    setPlayMood('surprised');
    say({ kind: 'nudge', html: '哇——！', mood: 'surprised', ms: 900 });
    await bird.flyTo(x, y, { duration: 480 });
    if (me !== moves) return;
    flying = false;
    landed();
  } else {
    bird.setAir(null);
  }
  bird.act('flap');
  setPlayMood(null);
  react(x, y, { thrown, shaken: d.flips >= 6, rode: now - d.since > 1500 });
}

/** 放下以后说点什么 */
function react(x, y, { thrown, shaken, rode }) {
  if (shaken) return dizzy('晃晕了，啾……');
  if (thrown) return say({ kind: 'nudge', html: '好险，啾！差点没抓住。', mood: 'surprised', call: 'surprised', ms: 2600 });
  // 脚下踩着机器上的哪个键
  const under = document.elementsFromPoint(x, y + 3).find((n) => !layer.contains(n));
  const key = under?.closest?.('.panel-wrap [data-id]');
  const info = key && controlInfo(key.dataset.id);
  if (info) {
    bird.act('peck');
    return say({ kind: 'nudge', html: `踩在 <b>${info.en}</b> 上啦，啾！`, mood: 'happy', call: 'look', ms: 6000, chips: [['讲讲它', () => onKey?.(key.dataset.id), { primary: true }], ['好', null, { ghost: true }]] });
  }
  if (y < bird.el.offsetWidth * 1.6) return say({ kind: 'nudge', html: '好高，啾！有点怕。', mood: 'surprised', call: 'surprised', ms: 2400 });
  if (rode) return say({ kind: 'nudge', html: '坐飞机咯，啾～', mood: 'happy', call: 'ok', ms: 2200 });
  bird.act(Math.random() < 0.5 ? 'preen' : 'hop');
  return say({ kind: 'nudge', html: DROP_LINES[Math.floor(Math.random() * DROP_LINES.length)], mood: 'listen', call: 'look', ms: 2200 });
}

/** 装上拎、放、蹭这几样 */
function installPlay(passingNow) {
  let press = null;
  bird.el.addEventListener('pointerdown', (e) => {
    if (passingNow() || sfx.held || e.button > 0) return; // 身后的键收到了这一下；音游打着的时候拎不起来
    const [fx, fy] = feetNow();
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, fx, fy };
    const move = (ev) => {
      if (ev.pointerId !== press?.id) return;
      if (!dragging) {
        if (Math.hypot(ev.clientX - press.x, ev.clientY - press.y) < 6) return;
        beginDrag(ev, press);
        return;
      }
      ev.preventDefault();
      moveDrag(ev);
    };
    const up = (ev) => {
      if (ev.pointerId !== press?.id) return;
      removeEventListener('pointermove', move, true);
      removeEventListener('pointerup', up, true);
      removeEventListener('pointercancel', up, true);
      press = null;
      if (dragging) endDrag();
    };
    addEventListener('pointermove', move, true);
    addEventListener('pointerup', up, true);
    addEventListener('pointercancel', up, true);
  });
  // 双击它：回到该在的地方
  bird.el.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    callBack();
  });
  // 不按键、在它身上来回蹭：舒服
  let rub = 0;
  let rubFlips = 0;
  let rubSign = 0;
  let rubAt = 0;
  let lastPet = 0;
  let petted = false;
  bird.el.addEventListener('pointermove', (e) => {
    if (e.buttons || dragging || e.pointerType !== 'mouse') return;
    const now = performance.now();
    if (now - rubAt > 1200) {
      rub = 0;
      rubFlips = 0;
    }
    rubAt = now;
    rub += Math.abs(e.movementX) + Math.abs(e.movementY);
    const sign = Math.sign(e.movementX);
    if (sign && rubSign && sign !== rubSign) rubFlips++;
    if (sign) rubSign = sign;
    if (rub > 160 && rubFlips >= 2 && now - lastPet > 3000) {
      lastPet = now;
      rub = 0;
      rubFlips = 0;
      setPlayMood('happy', 1800);
      bird.act(Math.random() < 0.6 ? 'preen' : 'hop');
      chirp('chatter');
      if (!petted) {
        petted = true;
        say({ kind: 'nudge', html: '好舒服，啾～', mood: 'happy', ms: 1800 });
      }
    }
  });
  // 换了一页：从被放下的地方回去
  addEventListener('hashchange', () => dropFree());
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
export function mount(nestHost, { tap, explain } = {}) {
  if (layer) return;
  nestEl = nestHost;
  onTap = tap;
  onKey = explain; // 站在一个键上时点“讲讲它”
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
  // 点它的身体：开 / 关对话框（等 0.26 秒看是不是双击：双击是叫它回去，不开对话框）。
  // 连着快点的那几下不来回开关；2.5 秒里点满 5 下，它就晕了（彩蛋）
  let pokes = [];
  let tapTimer = 0;
  installPlay(() => passing);
  bird.el.addEventListener('click', (e) => {
    e.stopPropagation();
    if (passing || dragged) return;
    const now = performance.now();
    pokes = pokes.filter((t) => now - t < 2500);
    pokes.push(now);
    if (pokes.length >= 5) {
      pokes = [];
      clearTimeout(tapTimer);
      dizzy();
      return;
    }
    clearTimeout(tapTimer);
    if (pokes.length >= 2 && now - pokes[pokes.length - 2] < 500) return; // 双击的第二下、连着快点
    tapTimer = setTimeout(() => onTap?.(), 260);
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

  // 点对话框以外的地方，对话框就收起来（用户 2026-11-13）。不算“以外”的：小鸟自己、导航栏里它的窝（那两处是开 / 关它）、
  // “指哪讲哪”时等你点的那张机器图（那一下交给 coach.js 去讲那个键）
  addEventListener('pointerdown', (e) => {
    if (!talk.classList.contains('on')) return;
    const t = e.target;
    if (talk.contains(t) || bird.el.contains(t) || t.closest?.('#coach-toggle, .jiu-picking')) return;
    hush();
  }, true);
  midi.on('noteon', wake);
  setInterval(() => {
    applyGroove(); // 机器放够半分钟了没有（跳舞）
    if (sfx.held || talking() || mood !== 'idle' || document.hidden) return;
    if (performance.now() - lastInput > SLEEP_AFTER) setMood('sleepy');
  }, 5000);
}
