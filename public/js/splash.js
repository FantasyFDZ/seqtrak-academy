// 开屏（启动动画）——“按 PLAY 开机”。用户 2026-11-15：按商业软件的标准要有一个开场动画，配一段有特色的音效或旋律，用啾啾的形象或声音。
//
// 第一段（自动、没声音，约 2.8 秒）：一排 16 个步进键浮出来，一条播放线从左扫到右，第 1、5、9、13 格亮成桔红（四踩）；
//   扫到一半，啾啾从右边飞进来；扫完，四个亮着的灯升上去，变成项目的标志（四根条），啾啾落在最高的那根上；
//   标题浮上来，下面是一颗 PLAY 键，跟着拍子一闪一闪。
// 等你按 PLAY：点哪儿都行、空格 / 回车，或者在接着的 SEQTRAK 上按 PLAY。浏览器要先有一次点击才肯出声，这一下正好。
// 第二段（有声，约 2.7 秒，120 BPM 一小节）：四下底鼓、反拍的闭镲，标志跟着拍子蹦；第三拍啾啾唱“声音标志”
//   （bird-voice.js 的 logo：D–F♯–A，再从 B 滑上高八度的 D、拖长带颤音），冒一句按时间的招呼（“早，啾！”）；
//   下一小节的第一拍落一个 D 大三和弦，标志缩回左上角导航栏那个标志的位置，啾啾飞回它该在的地方，开屏淡出——
//   开屏里的东西变成了应用里的东西，不是突然切过去。
// 跳过：右上角“跳过”或者 Esc，直接进，不出声。在真机上按的 PLAY：机器自己在放节奏，这边就不打鼓了，只有啾啾唱和那个和弦。
// 短版（mode: 'short'）：标志和标题一闪、缩回导航栏，不出声，不用按键，一秒左右。
// 克制档 / 系统“减少动效”：没有扫描和飞，标志直接摆好；按 PLAY 之后照样有声音，然后直接淡出。界面音效关着：不出声。
// 什么时候放（main.js，用户 2026-11-15 定的）：每次从首页进（打开应用时第一页是首页）都放完整版，在某一页里刷新不放；
// 设置里可以改成“每天第一次”（当天第一次完整、再开短版）或“不放”，
// 设置页还有“现在看一遍”。地址带 ?splash / ?splash=short 就照它放；带着开发用的参数（截图、走查）不放。
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

function build() {
  const bars = [1, 2, 3, 4].map((n) => h('i', { class: `spl-bar spl-bar${n}` }));
  const perch = h('span', { class: 'spl-perch' });
  const logo = h('div', { class: 'spl-logo', 'aria-hidden': 'true' }, bars, perch);
  const keys = Array.from({ length: 16 }, (_, i) => h('span', { class: ['spl-key', i % 4 === 0 && 'beat'], style: { '--i': String(i) } }, h('i')));
  const steps = h('div', { class: 'spl-steps', 'aria-hidden': 'true' }, keys);
  const title = h('h1', { class: 'spl-title' }, 'SEQTRAK ', h('b', {}, 'Academy'));
  const sub = h('p', { class: 'spl-sub' }, '跟着啾啾，一格一格学会 SEQTRAK');
  const play = h('button', { class: 'spl-play', type: 'button', 'data-sfx': 'none', 'aria-label': '按 PLAY 开始' }, h('small', {}, '⏻ / PLAY'), h('span', { class: 'spl-cap' }, h('i')));
  const hint = h('p', { class: 'spl-hint' }, h('b', {}, '按 PLAY 开始'), h('span', {}, '点哪儿都行，也可以按空格'));
  const skip = h('button', { class: 'spl-skip', type: 'button', 'data-sfx': 'none' }, '跳过');
  const el = h('div', { class: 'splash', role: 'dialog', 'aria-label': 'SEQTRAK Academy' },
    h('div', { class: 'spl-center' }, logo, steps, title, sub, h('div', { class: 'spl-go' }, play, hint)), skip);
  return { el, logo, bars, perch, keys, steps, title, sub, play, hint, skip };
}

/** 四个亮着的灯升上去变成标志的四根条（FLIP：从灯的位置和大小，变回条自己的位置和大小） */
function rise(ui) {
  ui.bars.forEach((bar, n) => {
    const led = ui.keys[n * 4].querySelector('i').getBoundingClientRect();
    const r = bar.getBoundingClientRect();
    const dx = led.left + led.width / 2 - (r.left + r.width / 2);
    const dy = led.bottom - r.bottom;
    bar.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(${led.width / r.width}, ${led.height / r.height})`, opacity: 1 },
      { transform: 'translate(0, 0) scale(1, 1)', opacity: 1 },
    ], { duration: 520, delay: n * 60, easing: 'cubic-bezier(.34, 1.4, .64, 1)', fill: 'backwards' });
  });
}

/** 标志跟着这一拍蹦一下 */
function bounce(ui) {
  if (calm()) return;
  ui.bars.forEach((bar, n) => bar.animate([{ transform: 'scaleY(1)' }, { transform: `scaleY(${1.18 + n * 0.06})`, offset: 0.25 }, { transform: 'scaleY(1)' }], { duration: 360, delay: n * 22, easing: 'cubic-bezier(.3, .7, .4, 1)' }));
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

/** 一小节的开场声音：四下底鼓、反拍的闭镲，下一小节第一拍一个 D 大三和弦。drums = false：机器自己在放节奏，不打鼓 */
async function jingle({ drums = true } = {}) {
  if (store.settings.uiSound === false) return 0;
  const ok = await audio.init();
  if (!ok) return 0;
  const t = audio.now() + 0.06;
  if (drums) {
    for (let k = 0; k < 4; k++) {
      audio.drum('KICK', t + k * BEAT, 1);
      audio.drum('HAT1', t + (k + 0.5) * BEAT, 0.45);
    }
    audio.drum('KICK', t + 4 * BEAT, 1);
    audio.drum('HAT2', t + 4 * BEAT, 0.5);
  }
  for (const m of [50, 62, 66, 69]) audio.note(m, t + 4 * BEAT, m < 60 ? 0.9 : 1.6, { voice: m < 60 ? 'sub' : 'wide', vel: m < 60 ? 0.7 : 0.45 });
  return 60; // 声音比画面晚这么多毫秒开始，画面跟着它对齐
}

/**
 * 放开屏。mode: 'full' 完整版（要按 PLAY） / 'short' 短版。放完（或者被跳过）时 resolve。
 * 调它的时候应用已经在开屏后面画好了（main.js 先放开屏、再画页面），这样最后缩回导航栏、啾啾飞回窝，落点都是真的。
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

  // ── 完整版第一段：扫描、拼出标志、啾啾飞进来 ──
  markIntro(); // 要唱声音标志了：首页这次不再另外叫 / 唱（短版没声音，首页照常叫一声）
  let release = null;
  let releaseHold = null;
  if (quiet) {
    ui.el.classList.add('formed', 'titled', 'ready');
    release = jiu.perch(ui.perch, { size: BIRD, mood: 'happy', top: true }).release;
  } else {
    jiu.teleport(innerWidth + 70, innerHeight * 0.3);
    releaseHold = jiu.hold(innerWidth + 70, innerHeight * 0.3);
    const sweep = (async () => {
      await wait(350);
      for (let i = 0; i < 16; i++) {
        ui.keys[i - 1]?.classList.remove('now');
        ui.keys[i].classList.add('now');
        if (i % 4 === 0) ui.keys[i].classList.add('lit');
        if (i === 8) release = jiu.perch(ui.perch, { size: BIRD, mood: 'happy', act: 'hop', top: true }).release; // 扫到一半，啾啾飞进来
        await wait(STEP * 1000);
      }
      ui.keys[15].classList.remove('now');
      ui.el.classList.add('formed');
      rise(ui);
      await wait(260);
      ui.el.classList.add('titled');
      await wait(420);
      ui.el.classList.add('ready');
    })();
    // 第一段没放完就按了 PLAY：直接摆成放完的样子
    ui.el.addEventListener('splash:hurry', () => {
      ui.keys.forEach((k, i) => k.classList.toggle('lit', i % 4 === 0));
      ui.el.classList.add('formed', 'titled', 'ready');
      release ||= jiu.perch(ui.perch, { size: BIRD, mood: 'happy', top: true }).release;
    }, { once: true });
    void sweep;
  }

  // ── 等你按 PLAY ──
  const how = await new Promise((resolve) => {
    const done = (v) => {
      removeEventListener('keydown', onKey, true);
      ui.el.removeEventListener('click', onClick);
      offMidi?.();
      resolve(v);
    };
    const onClick = (e) => done(e.target.closest('.spl-skip') ? 'skip' : 'play');
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
  if (!ui.el.classList.contains('ready')) ui.el.dispatchEvent(new Event('splash:hurry'));
  releaseHold?.();

  if (how === 'skip') {
    release?.();
    await finish(true);
    return;
  }

  // ── 第二段：一小节的开场 ──
  ui.el.classList.add('playing');
  const lag = await jingle({ drums: how !== 'machine' });
  const at = (beats, fn) => setTimeout(fn, lag + beats * BEAT * 1000);
  for (let k = 0; k < 4; k++) at(k, () => bounce(ui));
  at(2, () => {
    jiu.chirp('logo');
    jiu.say({ kind: 'nudge', html: timeLine(), mood: 'cheer', ms: 1500 });
  });
  await wait(lag + 4 * BEAT * 1000);
  bounce(ui);
  release?.(); // 啾啾飞回它该在的地方
  await finish(false);
}
