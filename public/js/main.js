// 入口：路由、左边的导航栏（设备状态、等级、配色、教练小鸟啾啾的窝）、全页面的按键声和升级 / 徽章提示。
import { h, $, $$, clear } from './util.js';
import { store, today } from './store.js';
import { midi } from './midi.js';
import { seqtrak } from './seqtrak.js';
import { audio } from './audio.js';
import { coach } from './coach.js';
import { theme } from './theme.js';
import { sfx } from './sfx.js';
import { confetti, installPressSounds } from './fx.js';
import { setCoachMood } from './coach-face.js';
import { celebrateLevel } from './celebrate.js';
import { LEVELS } from './levels.js';
import { nudge } from './coach-nudge.js';
import { initEggs } from './jiu-eggs.js';
import { callBack, isFree, say as jiuSay, talking as jiuTalking } from './jiu.js';
import { rich } from './util.js';
import { learn } from './learn-mode.js';
import { initKeyboard, showKeymap } from './keyboard.js';
import { playSplash } from './splash.js';
import { registerApp } from './install.js';
import { toast } from './ui.js';
import { connectDevice } from './device-connect.js';
import { homeView } from './views/home.js';
import { arcadeView } from './views/arcade.js';
import { panelView } from './views/panel.js';
import { songsView } from './views/songs.js';
import { deviceView } from './views/device.js';
import { settingsView } from './views/settings.js';
import { classroomView } from './views/classroom.js';
import { lessonView } from './lesson.js';

const routes = [
  { re: /^\/?$/, nav: 'home', view: homeView },
  { re: /^\/lesson\/([\w-]+)$/, nav: 'home', view: lessonView },
  // 小课堂：乐理、节奏、效果三条线的小关（列表，和单独的一关）
  { re: /^\/classroom$/, nav: 'classroom', view: classroomView },
  { re: /^\/classroom\/([\w-]+)$/, nav: 'classroom', view: classroomView },
  { re: /^\/panel$/, nav: 'panel', view: panelView },
  { re: /^\/arcade(?:\/([\w-]+))?$/, nav: 'arcade', view: arcadeView },
  // 曲目（列表，一首歌的 SEQTRAK 版分轨，和有段落的完整版 /songs/<id>/full）
  { re: /^\/songs(?:\/([\w-]+)(?:\/(full))?)?$/, nav: 'songs', view: songsView },
  { re: /^\/device$/, nav: 'device', view: deviceView },
  { re: /^\/settings$/, nav: 'settings', view: settingsView },
];

let current = null;
let renderSeq = 0;

async function render() {
  const seq = ++renderSeq;
  const path = location.hash.replace(/^#/, '') || '/';
  let ran = false;
  const doSwap = async () => {
    if (ran) return;
    ran = true;
    current?.destroy?.();
    current = null;
    coach.hushNudge(); // 啾啾主动说的那句是说给上一页的
    const view = $('#view');
    clear(view);
    view.scrollTop = 0;
    for (const route of routes) {
      const m = route.re.exec(path);
      if (!m) continue;
      $$('.rail a[data-nav]').forEach((a) => {
        const on = a.dataset.nav === route.nav;
        a.classList.toggle('active', on);
        if (on) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
      try {
        const result = (await route.view(view, ...m.slice(1))) || null;
        if (seq === renderSeq) current = result;
        else result?.destroy?.(); // 加载期间又切走了
      } catch (e) {
        console.error(e);
        view.append(h('div', { class: 'card' }, h('h3', {}, '这一页出错了'), h('p', { class: 'muted' }, String(e.message || e))));
      }
      return;
    }
    location.hash = '#/';
  };
  const canTransition = booted && theme.rich && typeof document.startViewTransition === 'function'
    && !document.documentElement.hasAttribute('data-still')
    && !/[?&](still|walk|fake|raf|clstep|tab)\b/.test(location.search);
  if (canTransition) {
    try {
      await document.startViewTransition(doSwap).updateCallbackDone;
      return;
    } catch {
      /* 浏览器不支持或标签页不可见时直接回退 */
    }
  }
  await doSwap();
}

// ───────────── 左边的导航栏 ─────────────
// index.html 里的导航入口，路由表里没有对应页面的先不亮出来：以后加页面只要在 routes 里添一行（nav 写入口的 data-nav）。
$$('.rail a[data-nav]').forEach((a) => (a.hidden = !routes.some((r) => r.nav === a.dataset.nav)));

// 「设备」那一格：右上角一颗灯，连上了下面的字换成机器的速度
const deviceDot = $('#device-chip .dot');
const deviceText = $('#device-chip span');

// 「设备」那一格的图标：平时是插头；键盘学习方式下换成一块小键盘
const chipIcon = $('#device-chip svg');
const PLUG_ICON = chipIcon.innerHTML;
const KEYS_ICON = '<rect x="3" y="7" width="18" height="11" rx="2"/><path d="M6.5 10.5h1M10 10.5h1M13.5 10.5h1M17 10.5h.5M6.5 14h1M9 14.5h6M17 14h.5"/>';

function renderChip() {
  const el = $('#device-chip');
  const icon = learn.keyboard && !midi.connected ? KEYS_ICON : PLUG_ICON;
  if (chipIcon.innerHTML !== icon) chipIcon.innerHTML = icon;
  if (midi.state === 'connected') {
    const bpm = midi.tempoRounded || seqtrak.state.tempo;
    deviceDot.className = 'dot ok';
    deviceText.className = bpm ? 'bpm' : '';
    deviceText.textContent = bpm ? `${bpm}` : '已连接';
    el.title = `SEQTRAK 已连接${bpm ? `，${bpm} BPM` : ''}。点一下看设备页`;
  } else if (learn.keyboard) {
    // 键盘学习方式：这一格是键位图（设备页在键盘方式下就是键位图）
    deviceDot.className = 'dot kbd';
    deviceText.className = '';
    deviceText.textContent = '键盘';
    el.title = '键盘学习方式：用电脑键盘按屏幕上的模拟机。点一下看键位图（随时按 ? 也行）';
  } else if (midi.state === 'unsupported') {
    deviceDot.className = 'dot off';
    deviceText.className = '';
    deviceText.textContent = '设备';
    el.title = '这个浏览器不支持 Web MIDI，现在是模拟模式';
  } else {
    deviceDot.className = 'dot';
    deviceText.className = '';
    deviceText.textContent = '设备';
    el.title = '还没连上 SEQTRAK。点一下去连接；没接机器时用屏幕上的模拟机';
  }
  el.setAttribute('aria-label', el.title);
  // 界面的“呼吸”跟着机器的速度走；没连就按 120
  theme.setBpm(midi.state === 'connected' ? midi.tempoRounded || seqtrak.state.tempo || 120 : 120);
}

// 「跳到正文」：应用用 #hash 管路由，拦截默认锚点跳转以免把当前路由冲回首页
$('.skip-link')?.addEventListener('click', (e) => {
  e.preventDefault();
  $('#view')?.focus();
});

// 还没连上的时候，点「设备」顺手就连（连接要用户亲手点一下才行，所以放在这一下里）；页面照常进设备页
$('#device-chip').addEventListener('click', () => {
  if (!midi.connected && midi.state !== 'unsupported' && !learn.keyboard) connectDevice();
});

// 学习方式：设置里选了键盘、又没连着 SEQTRAK，就是键盘方式（连着机器时一律按真机方式）。变了的话当前这一页重画一遍：
// 第 0 章的前两课在两种方式下是两套课，设备页也是两个样子
const syncLearn = () => learn.set(!midi.connected && store.settings.learnMode === 'keyboard');
let booted = false; // 开机时第一次读设置也会拨这个开关：那时页面还没画，不用重画
learn.on('change', () => {
  renderChip();
  if (booted) render();
});
midi.on('state', syncLearn);

midi.on('state', renderChip);
midi.on('tempo', renderChip);
seqtrak.on('state', renderChip);

// 等级（一圈经验条）、配色、教练

const SKIN_NAME = { body: '机身', neon: '霓虹' };
const levelRing = h('span', { class: 'ring' }, h('span', {}, '1'));
const levelName = h('span', { class: 'lv-name' });
$('#level-chip').append(levelRing, levelName);

function renderLevel() {
  const { level, xp } = store.progress();
  levelRing.firstChild.textContent = String(level.lv);
  levelRing.style.setProperty('--p', String(Math.round(level.pct * 100)));
  levelName.textContent = level.name;
  const title = `Lv ${level.lv} ${level.name}，${xp} 经验。${level.next ? `再攒 ${level.next.at - xp} 升到 Lv ${level.next.lv} ${level.next.name}` : '已经是最高一级'}`;
  $('#level-chip').title = title;
  $('#level-chip').setAttribute('aria-label', title);
}

function renderSkin() {
  const label = `现在是${SKIN_NAME[theme.skin]}配色，点一下换成${SKIN_NAME[theme.skin === 'neon' ? 'body' : 'neon']}`;
  $('#skin-toggle').title = label;
  $('#skin-toggle').setAttribute('aria-label', label);
}

/** 设置变了（或者刚读进来）：落到页面上。 */
function applySettings() {
  syncLearn();
  theme.apply(store.settings);
  sfx.setEnabled(store.settings.uiSound);
  renderSkin();
  renderLevel();
}

$('#skin-toggle').addEventListener('click', () => {
  const next = theme.skin === 'neon' ? 'body' : 'neon';
  theme.clearOverride('skin');
  store.update((d) => (d.settings.skin = next));
});

// 啾啾的窝：单击打开 / 收起对话（如果啾啾被拖到了别处，单击就顺手叫它回窝）；双击叫它回来并应一声；键盘回车立即响应
let nestTap = 0;
$('#coach-toggle').addEventListener('click', (e) => {
  clearTimeout(nestTap);
  if (e.detail === 0) return isFree() ? callBack() : coach.toggle();
  if (e.detail > 1) return;
  nestTap = setTimeout(() => (isFree() ? callBack() : coach.toggle()), 170);
});
$('#coach-toggle').addEventListener('dblclick', () => {
  clearTimeout(nestTap);
  callBack();
});

// ───────────── 涨经验、升级、拿徽章 ─────────────
// 升级是全屏的庆祝（celebrate.js；克制档是一条提示条），徽章和整节课这样的大数是提示条 + 彩带。
// 过一节课、音游结算这两处自己会亮涨了多少、升没升级、拿没拿徽章（它们记的时候按着 store.hush()），这里就不再出：
// 所以音游打着的时候不会走到这里，过一节课时的升级也并在那张庆祝里。

const bumpLevel = () => {
  const chip = $('#level-chip');
  chip.classList.remove('bump');
  void chip.offsetWidth;
  chip.classList.add('bump');
};

let cheers = 0; // 同时来了好几样（升级 + 徽章）：一样一样来，声音不叠在一起
const cheer = (fn) => {
  setTimeout(() => {
    fn();
    cheers = Math.max(0, cheers - 1);
  }, 700 * cheers++);
};

store.on('xp', ({ gained }) => {
  bumpLevel();
  // 小的（走完一步、打完一局）只让导航栏上的等级圈涨一下；整节课这样的大数才出提示条
  if (gained >= 50 && !store.quiet) toast(h('span', {}, h('b', {}, `+${gained}`), ' 经验'), 'gain', 3200);
});

store.on('levelup', ({ from, to }) => !store.quiet && cheer(() => {
  // 丰富档：全屏的庆祝（声音、彩带它自己放）；克制档：一条提示条
  if (theme.rich) return celebrateLevel({ from, to });
  toast(h('span', {}, h('b', {}, `升到 Lv ${to.lv}`), ` ${to.name}`), 'gain', 5000);
  sfx.play('levelup');
  setCoachMood('happy', 4000);
  confetti({ x: innerWidth / 2, y: innerHeight - 90 }, 44, { spread: 220 });
}));

store.on('badge', (badge) => !store.quiet && cheer(() => {
  toast(h('span', { class: 'row', style: { gap: '10px', flexWrap: 'nowrap' } },
    h('span', { class: 'badge got', dataset: { tone: badge.tone } }, h('svg', { viewBox: '0 0 24 24', html: badge.icon })),
    h('span', {}, h('b', {}, '拿到徽章'), ` ${badge.name}`)), 'gain', 5000);
  sfx.play('badge');
  setCoachMood('happy', 3000);
  confetti({ x: innerWidth / 2, y: innerHeight - 90 }, 22);
}));

// 屏幕键盘弹出来的时候（平板上向教练提问、填设置）：把整个应用缩到键盘上面看得见的那一块里，输入框不被挡住。
// 只在输入框拿着焦点时这样做，免得用户两指放大页面时版式跟着缩。高度写在 --app-h 上（app.css 的 #app 用它）。
const vv = window.visualViewport;
if (vv) {
  const fitKeyboard = () => {
    const typing = document.activeElement?.matches?.('input, textarea, [contenteditable="true"]');
    const covered = typing && vv.height < window.innerHeight - 120;
    if (covered) {
      document.documentElement.style.setProperty('--app-h', `${Math.round(vv.height)}px`);
      window.scrollTo(0, 0);
    } else {
      document.documentElement.style.removeProperty('--app-h');
    }
  };
  vv.addEventListener('resize', fitKeyboard);
  document.addEventListener('focusin', fitKeyboard);
  document.addEventListener('focusout', () => setTimeout(fitKeyboard, 80));
}

// 浏览器要求先有一次点击或按键才允许出声
const unlockAudio = () => audio.init();
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });

/**
 * 第一次打开：开屏放完、首页的问候打完字之后，啾啾问一句“你手边有 SEQTRAK 吗，啾？”，点选项回答（存进设置的 learnMode，设置页随时能改）。
 * 连着 SEQTRAK 就不问，直接记成真机方式。点了“先不说”或者点开了：这次打开就不再问，下次打开再问。
 * 带着开发用的参数（截图、走查）不问，除非地址里有 ?ask。
 */
async function askLearnMode(splashDone, skip) {
  if (store.settings.learnMode || skip) return;
  await splashDone;
  if (midi.connected) return store.update((d) => (d.settings.learnMode = 'device'));
  const onHome = ['', '#', '#/'].includes(location.hash);
  await new Promise((r) => setTimeout(r, onHome ? 4200 : 1600)); // 首页的问候是一个字一个字打出来的，等它打完
  for (let i = 0; i < 20 && jiuTalking(); i++) await new Promise((r) => setTimeout(r, 1000)); // 它正说着别的：等它说完
  if (store.settings.learnMode || midi.connected) return;
  const pick = async (mode) => {
    store.update((d) => (d.settings.learnMode = mode));
    await new Promise((r) => setTimeout(r, 700)); // 换了学习方式，当前这一页会重画一遍（第 0 章换课）：画完再说，免得这句被冲掉
    if (mode === 'keyboard') {
      jiuSay({
        html: rich('好，啾！那就用**电脑键盘**按屏幕上的模拟机：字母上两排是步进键，最下一排是轨道，〔空格〕是 [PLAY]，按住电脑上的键就是按住机器上的键。忘了哪个键是哪个，按 〔?〕 看键位图。'),
        mood: 'happy', call: 'ok', act: 'hop',
        chips: [['看键位图', () => showKeymap(), { primary: true }], ['好', null, { ghost: true }]],
      });
    } else {
      jiuSay({
        html: rich('好，啾！用 USB 线把它接上电脑，点左下角的「设备」连上，屏幕上的机器就成了它的镜子。哪天没带机器，到「设置」里换成键盘方式就行。'),
        mood: 'happy', call: 'ok', act: 'hop', chips: [['好', null, { primary: true }]],
      });
    }
  };
  jiuSay({
    html: rich('问你一件事：你手边有 **SEQTRAK** 吗，啾？没有也能学——用电脑键盘按屏幕上的模拟机，一样走完整套课。'),
    mood: 'listen', call: 'greet', act: 'hop',
    chips: [['有，用真机', () => pick('device'), { primary: true }], ['没有，用键盘', () => pick('keyboard'), { primary: true }], ['先不说', null, { ghost: true }]],
  });
}

async function boot() {
  renderChip();
  await store.load();
  applySettings();
  store.on('change', applySettings);
  theme.on('change', renderSkin);
  installPressSounds();
  coach.mount();
  initEggs(); // 啾啾的彩蛋：窝里的羽毛、学舌、连续练习的天数……
  registerApp(); // 能装成应用（install.js）
  // 开屏（splash.js）：先放上去，页面在它后面接着画。用户 2026-11-15 定的默认：每次从首页进（打开应用时第一页是首页）都放完整版
  // （按 PLAY 开机）；在某一页里刷新、直接打开别的页面不放。设置里可以改成“每天第一次”（当天第一次完整、再开短版）或“不放”。
  // 地址带 ?splash / ?splash=short 就照它放；
  // 带着开发用的参数（截图的 ?still、走查的 ?walk、假真机……）不放，免得挡住截图和走查
  const params0 = new URLSearchParams(location.search);
  const asked = params0.get('splash');
  const devRun = /[?&](still|walk|fake|raf|nudge|talk|celebrate|finish|freeze|result|clstep|unfold|tab)\b/.test(location.search);
  let splashMode = asked === null ? null : asked === 'short' ? 'short' : 'full';
  const intro = store.settings.intro;
  const onHome = ['', '#', '#/'].includes(location.hash);
  if (asked === null && !devRun && intro !== 'off') {
    if (intro === 'daily') splashMode = store.data.jiu?.splashDay !== today() ? 'full' : 'short';
    else splashMode = onHome ? 'full' : null;
    if (splashMode === 'full') store.update((d) => (d.jiu = { ...(d.jiu || {}), splashDay: today() }));
  }
  const splashDone = splashMode ? playSplash({ mode: splashMode }) : Promise.resolve();
  if (!splashMode) document.documentElement.classList.remove('splashing');
  initKeyboard(); // 键盘学习方式：电脑键盘 → 屏幕上的模拟机（keyboard.js；不是键盘方式时它什么都不接）
  window.addEventListener('hashchange', render);
  await render();
  booted = true;
  askLearnMode(splashDone, devRun && !params0.has('ask'));
  // 开发用：地址里带 ?fake 时接上一台“假真机”（js/dev/fake-seqtrak.js），没有硬件也能测真机镜像；?fake=demo 还会自动演一段，
  // ?fake=chords 演的是第 3 章那几样（选中 SYNTH 2、换音色、切到 CHORD、按两个和弦）
  const params = new URLSearchParams(location.search);
  const fake = params.get('fake');
  if (fake !== null) {
    const { attachFakeDevice, demo, demoChords } = await import('./dev/fake-seqtrak.js');
    window.__app.fake = attachFakeDevice();
    if (fake === 'demo') demo(window.__app.fake);
    if (fake === 'chords') demoChords(window.__app.fake);
  }
  // 开发用：?walk=3-1 自动把那一节课从头走一遍（js/dev/walk-ch3.js；和 ?fake 一起用就是在假真机上走），
  // 结果写在页面最下面。给 tools/mac-check.sh 用；它会把课标记成完成，所以只在测试数据上跑
  const walk = params.get('walk');
  if (walk) {
    const show = (result) => document.body.append(h('pre', { id: 'walk-result', style: { display: 'none' } }, JSON.stringify(result)));
    // ?walkkeys = 同一份走查改用电脑键盘走（键盘学习方式；js/dev/walkthrough.js）：先把学习方式设成键盘
    if (params.has('walkkeys') && store.settings.learnMode !== 'keyboard') store.update((d) => (d.settings.learnMode = 'keyboard'));
    // 第 4 章的课（?walk=4-1 … 4-4）走 js/dev/walk-ch4.js，第 5–8 章走 walk-ch5.js，别的照旧走 walk-ch3.js
    // 第 0–2 章（键盘学习方式做的时候补上的）走 walk-ch0.js
    import(walk.startsWith('4-') ? './dev/walk-ch4.js' : /^[5-8]-/.test(walk) ? './dev/walk-ch5.js' : /^[0-2]-/.test(walk) ? './dev/walk-ch0.js' : walk.startsWith('arr-') ? './dev/walk-arr.js' : './dev/walk-ch3.js').then((m) => m.run(walk)).then(show, (e) => show({ lesson: walk, crashed: String(e?.message || e) }));
  }
  // 开发用（截图、检查版式）：?celebrate=level 摆出升级的全屏庆祝；?nudge 让啾啾冒出来说一句；?talk 点开啾啾（截图用）
  if (params.get('celebrate') === 'level') {
    const to = store.progress().level;
    const prev = LEVELS.find((l) => l.lv === to.lv - 1); // 上一级叫什么（现在是 1 级就没有）
    celebrateLevel({ from: prev ? { lv: prev.lv, name: prev.name } : null, to });
  }
  if (params.has('talk')) setTimeout(() => coach.toggle(true), 300);
  if (params.has('keymap')) setTimeout(() => showKeymap(), 300); // 开发用（截图）：弹出整张键位图
  if (params.has('nudge')) nudge('停了有一会儿了，啾？卡住的话点我，我看看你停在哪儿。', { mood: 'cheer', ask: '我卡在这一步了，帮我看看可能是哪里没做对。', ms: 600000 });
  if (fake !== null) return;
  // 以前授权过就自动连上，不再弹窗
  try {
    const perm = await navigator.permissions?.query({ name: 'midi', sysex: true });
    if (perm?.state === 'granted') connectDevice({ quiet: true });
  } catch {
    /* 有的浏览器不支持查询 MIDI 权限 */
  }
}

window.__app = { midi, seqtrak, audio, store, coach, theme, sfx, learn };

boot();
