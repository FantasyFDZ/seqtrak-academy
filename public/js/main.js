// 入口：路由、左边的导航栏（设备状态、等级、配色、教练小鸟啾啾的窝）、全页面的按键声和升级 / 徽章提示。
import { h, $, $$, clear } from './util.js';
import { store } from './store.js';
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
import { callBack } from './jiu.js';
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
  current?.destroy?.();
  current = null;
  coach.hushNudge(); // 啾啾主动说的那句是说给上一页的
  const view = $('#view');
  clear(view);
  view.scrollTop = 0;
  for (const route of routes) {
    const m = route.re.exec(path);
    if (!m) continue;
    $$('.rail a[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === route.nav));
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
}

// ───────────── 左边的导航栏 ─────────────
// index.html 里的导航入口，路由表里没有对应页面的先不亮出来：以后加页面只要在 routes 里添一行（nav 写入口的 data-nav）。
$$('.rail a[data-nav]').forEach((a) => (a.hidden = !routes.some((r) => r.nav === a.dataset.nav)));

// 「设备」那一格：右上角一颗灯，连上了下面的字换成机器的速度
const deviceDot = $('#device-chip .dot');
const deviceText = $('#device-chip span');

function renderChip() {
  const el = $('#device-chip');
  if (midi.state === 'connected') {
    const bpm = midi.tempoRounded || seqtrak.state.tempo;
    deviceDot.className = 'dot ok';
    deviceText.className = bpm ? 'bpm' : '';
    deviceText.textContent = bpm ? `${bpm}` : '已连接';
    el.title = `SEQTRAK 已连接${bpm ? `，${bpm} BPM` : ''}。点一下看设备页`;
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

// 还没连上的时候，点「设备」顺手就连（连接要用户亲手点一下才行，所以放在这一下里）；页面照常进设备页
$('#device-chip').addEventListener('click', () => {
  if (!midi.connected && midi.state !== 'unsupported') connectDevice();
});

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

// 啾啾的窝：用鼠标单击不开对话框（点啾啾的身体才开，用户 2026-11-13），双击是叫它回来；
// 用键盘按回车 / 空格（click 的 detail 是 0）还是打开对话框，免得只用键盘的时候找不到它
$('#coach-toggle').addEventListener('click', (e) => {
  if (e.detail === 0) coach.toggle();
});
$('#coach-toggle').addEventListener('dblclick', () => callBack());

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

async function boot() {
  renderChip();
  await store.load();
  applySettings();
  store.on('change', applySettings);
  theme.on('change', renderSkin);
  installPressSounds();
  coach.mount();
  initEggs(); // 啾啾的彩蛋：窝里的羽毛、学舌、连续练习的天数……
  window.addEventListener('hashchange', render);
  await render();
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
    // 第 4 章的课（?walk=4-1 … 4-4）走 js/dev/walk-ch4.js，第 5–8 章走 walk-ch5.js，别的照旧走 walk-ch3.js
    import(walk.startsWith('4-') ? './dev/walk-ch4.js' : /^[5-8]-/.test(walk) ? './dev/walk-ch5.js' : walk.startsWith('arr-') ? './dev/walk-arr.js' : './dev/walk-ch3.js').then((m) => m.run(walk)).then(show, (e) => show({ lesson: walk, crashed: String(e?.message || e) }));
  }
  // 开发用（截图、检查版式）：?celebrate=level 摆出升级的全屏庆祝；?nudge 让啾啾冒出来说一句；?talk 点开啾啾（截图用）
  if (params.get('celebrate') === 'level') {
    const to = store.progress().level;
    const prev = LEVELS.find((l) => l.lv === to.lv - 1); // 上一级叫什么（现在是 1 级就没有）
    celebrateLevel({ from: prev ? { lv: prev.lv, name: prev.name } : null, to });
  }
  if (params.has('talk')) setTimeout(() => coach.toggle(true), 300);
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

window.__app = { midi, seqtrak, audio, store, coach, theme, sfx };

boot();
