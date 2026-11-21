// 宣传片入口。三种用法（看地址）：
//   /promo/            预览：实时放（带声音），能拖进度条、按段跳
//   /promo/?render     渲染：没有控制条，舞台 1920 × 1080；render.mjs 一帧一帧调 __promo.frame(i) 再截图
//   /promo/?audio      渲染音频：__promo.renderAudio() 离线算完整首，把 WAV 送回服务（promo/out/audio.wav）
//   /promo/?t=36.5     预览时直接跳到某一秒（截图检查用）
import { createEngine, createCaptions, createBird2, W, H, put } from './engine.js';
import { DURATION, FPS, SECTIONS, BAR, barAt, at, prog, ease, pulse, lastAt, lerp } from './time.js';
import { music, renderOffline, toWav } from './music.js';
import * as vclock from './vclock.js';
import { SCORE } from './score.js';
import { CAPTIONS } from './captions.js';
import { BIRD_TRACK } from './bird-track.js';
import { buildScenes } from './scenes/index.js';
import { analyze, loadSpectrum } from './spectrum.js';

const params = new URLSearchParams(location.search);
const MODE = params.has('render') ? 'render' : params.has('audio') ? 'audio' : 'preview';
document.documentElement.classList.add(MODE);
if (MODE === 'render') vclock.install();

const stage = document.getElementById('stage');
const layers = {
  bg: document.getElementById('bg'),
  scenes: document.getElementById('scenes'),
  caps: document.getElementById('caps'),
  birds: document.getElementById('birds'),
  fx: document.getElementById('fx'),
};
const engine = createEngine(layers.scenes);
engine.layers = layers;
engine.loading = []; // 场景里要等它加载好的东西（截图）
engine.stageEl = stage;

// 场景
for (const s of buildScenes(engine)) engine.add(s);
// 字幕
const caps = createCaptions(layers.caps, CAPTIONS);
// 啾啾
const bird = createBird2(layers.birds, BIRD_TRACK(engine), engine);
engine.bird = bird;

// 背景：底鼓一响，下面亮一下；配色：Drop 的后半（第 31–34 小节）切到机身
const kicks = SCORE.drums.filter((d) => d.lane === 'KICK').map((d) => d.t);
const bgKick = layers.bg.querySelector('.bg-kick');
const flash = layers.fx.querySelector('.fx-flash');
const fade = layers.fx.querySelector('.fx-fade');
const grain = layers.fx.querySelector('.fx-grain');
const dark = layers.fx.querySelector('.fx-dark');
const SKIN_BODY = [at(23), at(27)];
function global(t) {
  const ki = lastAt(kicks, t);
  const kp = ki >= 0 ? pulse(t, kicks[ki], 0.35) : 0;
  // 背景不再跟着每一下底鼓泵（video-shotcraft 审美准则 R4：整画面级的节拍冲击全片 ≤3 处）
  const strength = 0;
  bgKick.style.opacity = (kp * strength).toFixed(3);
  const skin = t >= SKIN_BODY[0] && t < SKIN_BODY[1] ? 'body' : 'neon';
  if (document.documentElement.dataset.skin !== skin) document.documentElement.dataset.skin = skin;
  // 白闪：蓄力完那一拍的空白之后、Drop 落下的那一刻；切配色的两下
  // 整画面的白闪只有三处：标志亮出来、Drop 落下、切配色（切回去那下很轻）
  const fl = Math.max(pulse(t, at(1), 0.45) * 0.55, pulse(t, at(19), 0.5) * 0.85, pulse(t, SKIN_BODY[0], 0.35) * 0.5, pulse(t, SKIN_BODY[1], 0.35) * 0.25);
  // 开场：胶片颗粒、四周压暗（神秘一点），第 3 小节砸进来以后散掉
  const intro = 1 - prog(t, at(1), at(1) + 0.4);
  // 前奏四周压暗，把视线聚到正中长出来的标志上（胶片颗粒和心跳的画面第四版去掉了）
  grain.style.opacity = '0';
  dark.style.opacity = intro.toFixed(3);
  flash.style.opacity = fl.toFixed(3);
  // 最后淡出
  fade.style.opacity = prog(t, DURATION - 0.8, DURATION - 0.05).toFixed(3);
}

function seek(t) {
  engine.seek(t);
  global(t);
  caps.update(t);
  bird.update(t);
}

// ───────────── 预览 ─────────────
function preview() {
  const ui = document.getElementById('ui');
  ui.hidden = false;
  const btn = document.getElementById('play');
  const scrub = document.getElementById('scrub');
  const time = document.getElementById('time');
  const barEl = document.getElementById('bar');
  const marks = document.getElementById('marks');
  scrub.max = String(DURATION);
  for (const s of SECTIONS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = `${s.id} ${s.name}`;
    b.style.left = `${(s.t0 / DURATION) * 100}%`;
    b.addEventListener('click', () => jump(s.t0));
    marks.append(b);
  }
  const fit = () => {
    const vw = innerWidth;
    const vh = innerHeight - 64;
    const k = Math.min(vw / W, vh / H);
    stage.style.transform = `translate(${(vw - W * k) / 2}px, ${(vh - H * k) / 2}px) scale(${k})`;
  };
  fit();
  addEventListener('resize', fit);

  let playhead = Number(params.get('t')) || 0;
  let playing = false;
  const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;
  const show = () => {
    time.textContent = fmt(playhead);
    const bar = Math.floor(barAt(Math.min(playhead, at(31) - 0.001)));
    barEl.textContent = bar < 1 ? '前奏' : `第 ${bar} 小节`;
    if (document.activeElement !== scrub) scrub.value = String(playhead);
    btn.textContent = playing ? '❚❚' : '▶';
  };
  async function play() {
    if (playhead >= DURATION - 0.05) playhead = 0;
    playing = true;
    await music.start(playhead);
  }
  function pause() {
    playing = false;
    music.stop();
  }
  function jump(t) {
    playhead = Math.max(0, Math.min(DURATION, t));
    seek(playhead);
    if (playing) music.start(playhead);
    show();
  }
  btn.addEventListener('click', () => (playing ? pause() : play()));
  scrub.addEventListener('input', () => jump(Number(scrub.value)));
  addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      playing ? pause() : play();
    } else if (e.code === 'ArrowRight') jump(playhead + (e.shiftKey ? BAR * 4 : BAR));
    else if (e.code === 'ArrowLeft') jump(playhead - (e.shiftKey ? BAR * 4 : BAR));
  });
  const loop = () => {
    if (playing) {
      playhead = Math.max(0, music.now());
      if (playhead >= DURATION) {
        playhead = DURATION;
        pause();
      }
    }
    seek(playhead);
    show();
    requestAnimationFrame(loop);
  };
  seek(playhead);
  loop();
  window.__promo = { seek: jump, get t() { return playhead; }, duration: DURATION };
}

// ───────────── 渲染 ─────────────
function render() {
  stage.style.transform = 'none';
  let last = -1;
  window.__promo = {
    duration: DURATION,
    fps: FPS,
    frames: Math.round(DURATION * FPS),
    /** 拨到第 i 帧（必须从 0 开始一帧一帧往后） */
    frame(i) {
      const t = i / FPS;
      if (i < last) throw new Error('只能往后走');
      last = i;
      vclock.advance(t * 1000);
      seek(t);
      vclock.syncAnimations(t * 1000);
      return t;
    },
  };
}

async function renderAudio({ solo = null, name = 'audio.wav', normalize = true } = {}) {
  const buf = await renderOffline({ solo });
  const { blob, ...stats } = toWav(buf, { peakDb: normalize ? -1 : 0, raw: !normalize });
  // 每一段的响度（dBFS，均方根），检查混音用
  const ch = buf.getChannelData(0);
  const sections = SECTIONS.map((s) => {
    const a = Math.floor(s.t0 * buf.sampleRate);
    const z = Math.min(ch.length, Math.floor(s.t1 * buf.sampleRate));
    let sum = 0;
    for (let i = a; i < z; i++) sum += ch[i] * ch[i];
    return [s.id, Math.round(20 * Math.log10(Math.sqrt(sum / Math.max(1, z - a)) + 1e-9) * 10) / 10];
  });
  const res = await fetch(`/promo/out/${name}`, { method: 'POST', body: blob });
  if (!res.ok) throw new Error(`送回音频失败：${res.status}`);
  // 完整混音才顺带算频谱（画面里跟着鼓声跳的那一排）
  if (!solo) {
    const spec = analyze(buf);
    const r2 = await fetch('/promo/out/spectrum.bin', { method: 'POST', body: spec });
    if (!r2.ok) throw new Error(`送回频谱失败：${r2.status}`);
  }
  return { ...stats, sections, seconds: buf.duration, bytes: blob.size };
}

await document.fonts.ready;
await Promise.all(engine.loading);
if (MODE !== 'audio') await loadSpectrum();
if (MODE === 'preview') preview();
else if (MODE === 'render') render();
else window.__promo = { renderAudio };
window.__promoReady = true;
