// 开屏（启动动画）——“按 PLAY 开机”。用户 2026-11-15：按商业软件的标准要有一个开场动画，配一段有特色的音效或旋律，用啾啾的形象或声音。
// 同一天他又定了顺序：“打开项目就有格子跳动、节奏律动，这个是背景音；啾啾带着欢快的声音飞了进来；如果点击 PLAY，就进入了学习画面，
// 啾啾又开心地飞了进去。如果一直不点 PLAY，背景律动就一直播放。”
//
// 背景律动（一打开就开始，一直循环到你按 PLAY）：120 BPM，两小节一个来回。一排 16 个步进键跟着播放线一格一格跳，
//   每拍第一格亮成桔红；四踩底鼓、反拍闭镲，单数小节加拍手，第二小节起加贝斯（D–A–G），双数小节有一句拨弦的旋律
//   （D、F♯、A、B、A、F♯、E，D 大调五声）。
//   第二小节第一拍，项目的标志（四根条）从中间长出来，落一个淡淡的 D 大三和弦；标题和副标题从中间往两边展开，下面是一颗跟着拍子闪的 PLAY 键。
//   （用户 2026-11-15：“频谱和下面的字应当是从中间长出来的感觉，而不是现在的飞进来”——原来是四个亮着的灯飞上去变成四根条、字从下面浮上来。）
//   啾啾（他又说“飞进来可以慢一些，四处盘旋悬停一段时间”）：第一小节扫到一半叫着从右边慢慢飞进来，在标志右上方悬停；
//   第四小节换到左上方再悬停；第六小节绕着标志盘旋一圈；第九小节（约 8.5 秒）落到最高那根条上，之后跟着拍子点头，隔一会儿嘀咕一声。
//   没等它落下就按了 PLAY：它直接落下来。
// 按 PLAY（点那颗键、空格 / 回车，或者在接着的 SEQTRAK 上按 PLAY）：从下一拍起一小节“进入”——四下底鼓、拍手，
//   第三拍啾啾唱“声音标志”（bird-voice.js 的 logo：D–F♯–A，再从 B 滑上高八度的 D、拖长带颤音），冒一句按时间的招呼（“早，啾！”）；
//   下一小节第一拍落 D 大三和弦，标志缩回左上角导航栏那个标志的位置，啾啾开心地蹦一下、飞回它该在的地方，开屏淡出。
//   在真机上按的 PLAY：机器自己在放节奏，“进入”这一小节就不打鼓了。
// 浏览器不让网页在用户点之前出声（自动播放的规矩）：出不了声时画面照常动，右下角一个“开声音”，点它或者点页面别处，律动就响起来；
//   直接点 PLAY 也行（“进入”那一小节有声音）。设置里点“现在看一遍”时已经点过页面了，一开始就有声音。
// 跳过：右上角“跳过”或者 Esc，直接进，不出声。界面音效关着：只有画面。
// 短版（mode: 'short'）：标志和标题一闪、缩回导航栏，不出声，不用按键，一秒左右。
// 克制档 / 系统“减少动效”：格子不跳、啾啾不飞，标志直接摆好；律动和“进入”的声音照样有。
// 什么时候放（main.js，用户 2026-11-15 定的）：每次从首页进（打开应用时第一页是首页）都放完整版，在某一页里刷新不放；
// 设置里可以改成“每天第一次”（当天第一次完整、再开短版）或“不放”，设置页还有“现在看一遍”。
// 地址带 ?splash / ?splash=short 就照它放；带着开发用的参数（截图、走查）不放。
import { h } from './util.js';
import { audio } from './audio.js';
import { store } from './store.js';
import { midi } from './midi.js';
import * as jiu from './jiu.js';
import { timeLine, markIntro } from './jiu-eggs.js';

const BEAT = 0.5; // 120 BPM，一拍半秒
const STEP = BEAT / 4; // 一格（十六分音符）
const BIRD = 64; // 站在标志上的啾啾多大
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const calm = () => document.documentElement.dataset.fx === 'calm' || matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.hasAttribute('data-still');

// 背景律动的谱（一格 = 十六分音符，一小节 16 格）
const KICK = [0, 4, 8, 12];
const HAT = [2, 6, 10, 14];
const CLAP = [4, 12]; // 单数小节
const BASS = { 0: [38, 0.35], 7: [38, 0.1], 10: [45, 0.2], 14: [43, 0.12] }; // D2、A2、G2，第二小节起
const LEAD = { 0: 74, 3: 78, 6: 81, 8: 83, 10: 81, 12: 78, 14: 76 }; // 双数小节：D5 F♯5 A5 B5 A5 F♯5 E5

function build() {
  const bars = [1, 2, 3, 4].map((n) => h('i', { class: `spl-bar spl-bar${n}` }));
  const perch = h('span', { class: 'spl-perch' });
  const logo = h('div', { class: 'spl-logo', 'aria-hidden': 'true' }, bars, perch);
  const keys = Array.from({ length: 16 }, (_, i) => h('span', { class: ['spl-key', i % 4 === 0 && 'beat'], style: { '--i': String(i) } }, h('i')));
  const steps = h('div', { class: 'spl-steps', 'aria-hidden': 'true' }, keys);
  const title = h('h1', { class: 'spl-title' }, 'SEQTRAK ', h('b', {}, 'Academy'));
  const sub = h('p', { class: 'spl-sub' }, '跟着啾啾，一格一格学会 SEQTRAK');
  const play = h('button', { class: 'spl-play', type: 'button', 'data-sfx': 'none', 'aria-label': '按 PLAY 进入' }, h('small', {}, '⏻ / PLAY'), h('span', { class: 'spl-cap' }, h('i')));
  const hint = h('p', { class: 'spl-hint' }, h('b', {}, '按 PLAY 进入'), h('span', {}, '也可以按空格'));
  const skip = h('button', { class: 'spl-skip', type: 'button', 'data-sfx': 'none' }, '跳过');
  const sound = h('button', { class: 'spl-sound', type: 'button', 'data-sfx': 'none', hidden: true }, h('span', { 'aria-hidden': 'true' }, '🔈'), '开声音');
  const el = h('div', { class: 'splash', role: 'dialog', 'aria-label': 'SEQTRAK Academy' },
    h('div', { class: 'spl-center' }, logo, steps, title, sub, h('div', { class: 'spl-go' }, play, hint)), skip, sound);
  return { el, logo, bars, perch, keys, steps, title, sub, play, hint, skip, sound };
}

/** 标志的四根条从中间长出来：每根条就在自己的位置上，从腰部往上下两头长，长过头一点再回落；中间两根先长，两边两根跟上 */
function rise(ui) {
  ui.bars.forEach((bar, n) => {
    const o = { transformOrigin: '50% 50%', opacity: 1 };
    bar.animate([
      { ...o, transform: 'scaleY(0)', easing: 'cubic-bezier(.25, .6, .4, 1)' }, // 长：一开始快、越长越慢
      { ...o, transform: 'scaleY(1.12)', offset: 0.62, easing: 'ease-in-out' }, // 长过头一点，回落
      { ...o, transform: 'scaleY(1)' },
    ], { duration: 700, delay: n === 1 || n === 2 ? 0 : 120, fill: 'backwards' });
  });
}

/** 标志跟着这一拍蹦一下 */
function bounce(ui) {
  if (calm()) return;
  ui.bars.forEach((bar, n) => bar.animate([{ transform: 'scaleY(1)' }, { transform: `scaleY(${1.14 + n * 0.05})`, offset: 0.25 }, { transform: 'scaleY(1)' }], { duration: 340, delay: n * 22, easing: 'cubic-bezier(.3, .7, .4, 1)' }));
}

/** 标志缩回导航栏左上角那个标志的位置 */
function morphOut(ui) {
  const target = document.querySelector('.rail-brand .brand-mark')?.getBoundingClientRect();
  const r = ui.logo.getBoundingClientRect();
  if (!target || !r.width || calm()) return;
  const s = target.height / r.height;
  ui.logo.animate([
    { transform: 'translate(0, 0) scale(1)', opacity: 1 },
    { transform: `translate(${target.left - r.left}px, ${target.top - r.top}px) scale(${s})`, opacity: 1, offset: 0.85 },
    { transform: `translate(${target.left - r.left}px, ${target.top - r.top}px) scale(${s})`, opacity: 0 },
  ], { duration: 640, easing: 'cubic-bezier(.6, 0, .2, 1)', fill: 'forwards' });
}

/** 不用点就能出声吗（浏览器的自动播放规矩：点过页面、或者装成了应用，才肯）。最多等 250 毫秒 */
async function canSound() {
  if (store.settings.uiSound === false) return false;
  if (navigator.userActivation?.hasBeenActive) return audio.init();
  const ok = await Promise.race([audio.init(), wait(250).then(() => false)]);
  return !!ok && audio.ready;
}

/**
 * 背景律动：一格一格地往前走，一直循环到 stop()。声音用声音引擎的时钟提前一点排好（这样不抖）；还不能出声的时候用页面的时钟只走画面。
 * onStep(s) 在第 s 格真正响起的那一刻调（画面跟着它动）。
 */
function groove(onStep) {
  let step = 0;
  let nextT = null;
  let useAudio = false;
  let stopped = false;
  const now = () => (useAudio ? audio.now() : performance.now() / 1000);
  const play = (s, t) => {
    if (!useAudio || store.settings.uiSound === false) return;
    const bar = Math.floor(s / 16);
    const p = s % 16;
    if (KICK.includes(p)) audio.drum('KICK', t, 0.95);
    if (HAT.includes(p)) audio.drum('HAT1', t, 0.36);
    if (bar % 2 === 1 && CLAP.includes(p)) audio.drum('CLAP', t, 0.55);
    if (bar >= 1 && BASS[p]) audio.note(BASS[p][0], t, BASS[p][1], { voice: 'bass', vel: 0.5 });
    if (bar % 2 === 0 && LEAD[p]) audio.note(LEAD[p], t, 0.2, { voice: 'pluck', vel: 0.45 });
    if (s === 16) for (const m of [62, 66, 69]) audio.note(m, t, 1.8, { voice: 'wide', vel: 0.2 });
  };
  const tick = () => {
    if (stopped) return;
    if (nextT === null) nextT = now() + 0.05;
    while (nextT < now() + 0.12) {
      const s = step;
      play(s, nextT);
      setTimeout(() => !stopped && onStep(s), Math.max(0, (nextT - now()) * 1000));
      nextT += STEP;
      step++;
    }
  };
  const timer = setInterval(tick, 25);
  tick();
  return {
    /** 能出声了：换到声音引擎的时钟，从下一格起有声音 */
    sound() {
      if (useAudio) return;
      useAudio = true;
      nextT = audio.now() + 0.06;
    },
    get audible() {
      return useAudio;
    },
    /** 停下，返回下一拍在声音时钟里是什么时候（没声音时是 null） */
    stop() {
      stopped = true;
      clearInterval(timer);
      let s = step;
      let t = nextT ?? now();
      while (s % 4 !== 0) {
        s++;
        t += STEP;
      }
      return useAudio ? t : null;
    },
  };
}

/** “进入”的一小节：从 t 起四拍底鼓（拍手在第二、四拍）、反拍闭镲，第五拍落 D 大三和弦。drums = false：机器自己在放节奏，不打鼓 */
function enterSound(t, { drums = true } = {}) {
  if (t === null || store.settings.uiSound === false) return;
  if (drums) {
    for (let k = 0; k < 4; k++) {
      audio.drum('KICK', t + k * BEAT, 1);
      audio.drum('HAT1', t + (k + 0.5) * BEAT, 0.45);
      if (k % 2 === 1) audio.drum('CLAP', t + k * BEAT, 0.6);
    }
    audio.drum('KICK', t + 4 * BEAT, 1);
    audio.drum('HAT2', t + 4 * BEAT, 0.5);
  }
  for (const m of [50, 62, 66, 69]) audio.note(m, t + 4 * BEAT, m < 60 ? 0.9 : 1.6, { voice: m < 60 ? 'sub' : 'wide', vel: m < 60 ? 0.7 : 0.45 });
}

/**
 * 放开屏。mode: 'full' 完整版 / 'short' 短版。放完（或者被跳过）时 resolve。
 * 调它的时候应用已经在开屏后面画好了（main.js 先放开屏、再画页面），这样最后缩回导航栏、啾啾飞回去，落点都是真的。
 */
export async function playSplash({ mode = 'full' } = {}) {
  const ui = build();
  document.body.append(ui.el);
  document.documentElement.classList.remove('splashing'); // index.html 里先盖着的那块底色可以撤了
  const quiet = calm();
  ui.el.classList.toggle('calm', quiet);
  ui.el.classList.add(mode === 'short' ? 'short' : 'full');
  void ui.el.offsetWidth;
  ui.el.classList.add('on');

  const finish = async (fast) => {
    ui.el.classList.add('out');
    if (!fast) morphOut(ui);
    await wait(fast ? 260 : 680);
    ui.el.remove();
  };

  // ── 短版：一闪就进 ──
  if (mode === 'short') {
    ui.el.classList.add('formed', 'titled');
    await wait(quiet ? 200 : 380);
    await finish(false);
    return;
  }

  // ── 完整版：背景律动 + 啾啾飞进来，一直等到按 PLAY ──
  markIntro(); // 要唱声音标志了：首页这次不再另外叫 / 唱（短版没声音，首页照常叫一声）
  let release = null;
  let releaseHold = null;
  let releaseHover = null;
  const landBird = (opts = {}) => {
    if (release) return;
    release = jiu.perch(ui.perch, { size: BIRD, mood: 'happy', top: true, ...opts }).release;
    releaseHold?.();
    releaseHold = null;
    releaseHover?.();
    releaseHover = null;
  };
  /** 飞到屏幕上 (fx, fy) 那一点（占屏幕宽高的比例）悬停着；dur = 飞多久（慢慢飞） */
  const hoverAt = (fx, fy, dur) => {
    if (release) return;
    const prev = releaseHover;
    releaseHover = jiu.point(() => ({ left: innerWidth * fx - 1, top: innerHeight * fy, right: innerWidth * fx + 1, bottom: innerHeight * fy + 2, width: 2, height: 2 }), { size: BIRD, mood: 'happy', top: true, dur });
    prev?.();
    releaseHold?.();
    releaseHold = null;
  };
  if (quiet) {
    ui.keys.forEach((k, i) => k.classList.toggle('lit', i % 4 === 0));
    ui.el.classList.add('formed', 'titled', 'ready');
    landBird();
  } else {
    jiu.teleport(innerWidth + 70, innerHeight * 0.3);
    releaseHold = jiu.hold(innerWidth + 70, innerHeight * 0.3);
  }

  const beat = groove((s) => {
    const p = s % 16;
    if (!quiet) {
      ui.keys[(p + 15) % 16].classList.remove('now');
      ui.keys[p].classList.add('now');
      if (p % 4 === 0) ui.keys[p].classList.add('lit');
    }
    // 啾啾（用户 2026-11-15：飞进来可以慢一些，四处盘旋悬停一段时间）：第一小节扫到一半，叫着从右边慢慢飞进来，
    // 在标志右上方悬停；第四小节换到左上方再悬停一会儿；第六小节绕着标志盘旋一圈；第九小节落到最高那根条上，之后跟着拍子点头
    if (!quiet && !release) {
      if (s === 8) {
        hoverAt(0.66, 0.24, 1800);
        jiu.chirp('greet');
      }
      if (s === 14) jiu.chirp('ok');
      if (s === 28) {
        hoverAt(0.33, 0.2, 1500);
        jiu.chirp('chatter');
      }
      if (s === 44) {
        jiu.lap(() => ui.logo.getBoundingClientRect(), { ms: 2800, song: false });
        jiu.chirp('ok');
      }
      if (s === 68) {
        landBird({ act: 'hop' });
        jiu.chirp('greet');
      }
    }
    if (s === 16 && !quiet) {
      ui.el.classList.add('formed');
      rise(ui); // 标志从中间长出来
    }
    if (s === 18) ui.el.classList.add('titled');
    if (s === 21) ui.el.classList.add('ready');
    if (s >= 24 && p % 4 === 0) bounce(ui); // 等标志长完（约 0.82 秒）再跟着拍子蹦，不然蹦一下会把还在长的条打断
    if (s === 80) jiu.groove(120); // 落稳了，跟着拍子点头
    if (s > 32 && s % 64 === 40) jiu.chirp('chatter'); // 等着的时候隔一会儿嘀咕一声
  });

  // 能出声就从一开始有声音；不能就亮出“开声音”，点它（或者点页面别处）再出
  const unlock = async () => {
    if (beat.audible || store.settings.uiSound === false) return;
    if (await audio.init()) {
      beat.sound();
      ui.sound.hidden = true;
    }
  };
  canSound().then((ok) => {
    if (ok) beat.sound();
    else if (store.settings.uiSound !== false && ui.el.isConnected) ui.sound.hidden = false;
  });

  // ── 等你按 PLAY ──
  const how = await new Promise((resolve) => {
    const done = (v) => {
      removeEventListener('keydown', onKey, true);
      ui.el.removeEventListener('click', onClick);
      offMidi?.();
      resolve(v);
    };
    const onClick = (e) => {
      if (e.target.closest('.spl-skip')) done('skip');
      else if (e.target.closest('.spl-play')) done('play');
      else unlock(); // 点别处：开声音（浏览器要先有一次点击）
    };
    const onKey = (e) => {
      if (e.key === 'Escape') done('skip');
      else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        done('play');
      }
    };
    const offMidi = midi.on('start', () => done('machine'));
    ui.el.addEventListener('click', onClick);
    addEventListener('keydown', onKey, true);
  });
  // 律动还没走到出 PLAY 的那一步就按了：直接摆成走完的样子（还在空中的啾啾直接落下来）
  ui.keys.forEach((k, i) => k.classList.toggle('lit', i % 4 === 0));
  ui.el.classList.add('formed', 'titled', 'ready');
  landBird();
  jiu.groove(0);

  if (how === 'skip') {
    beat.stop();
    release?.();
    await finish(true);
    return;
  }

  // ── 按了 PLAY：从下一拍起一小节“进入” ──
  ui.el.classList.add('playing');
  ui.sound.hidden = true;
  if (!beat.audible && how !== 'machine') await unlock(); // 这一下就是点击：现在能出声了
  const t = beat.stop();
  const t0 = t ?? performance.now() / 1000;
  const clock = () => (t === null ? performance.now() / 1000 : audio.now());
  enterSound(t, { drums: how !== 'machine' });
  const at = (beats, fn) => setTimeout(fn, Math.max(0, (t0 + beats * BEAT - clock()) * 1000));
  for (let k = 0; k < 4; k++) at(k, () => bounce(ui));
  at(2, () => {
    jiu.chirp('logo');
    jiu.say({ kind: 'nudge', html: timeLine(), mood: 'cheer', ms: 1500 });
  });
  await new Promise((r) => at(4, r));
  bounce(ui);
  jiu.act('hop'); // 开心地蹦一下，飞回它该在的地方
  release?.();
  await finish(false);
}
