// 把 score.js 的谱放出来。发声全用应用自带的合成器（/js/audio.js）和啾啾的叫声（/js/bird-voice.js），不带任何音频文件。
//
// 两种放法：
//   live     预览页：实时放，跟着播放头边放边排（提前 0.35 秒排进声音引擎的时钟）
//   offline  渲染：用 OfflineAudioContext 一口气算完整首，编成 WAV（renderOffline）
//
// 两个模块各开各的 AudioContext（audio.js 一个，bird-voice.js 一个）。这里把 window.AudioContext 换掉，让它俩用同一个：
//   第一次 new 的（audio.js）拿到真的那个；第二次（bird-voice.js）拿到一层“代理”，它的 destination 换成混音台上啾啾那一路，
//   这样鸟叫也进同一个压缩器、同一个混响，和音乐在一个时钟上。代理还能临时改 currentTime（fakeNow）：
//   bird-voice 的叫声都是“从现在起”排的，提前排一声 = 把“现在”假装成那一刻。
import { audio } from '/js/audio.js';
import { voice } from '/js/bird-voice.js';
import { SCORE } from './score.js';
import { DURATION, at } from './time.js';

const NativeAC = window.AudioContext || window.webkitAudioContext;
let shared = null; // 真的那个 context（AudioContext 或 OfflineAudioContext）
let offlineMode = false;
let fakeNow = null;
let birdBus = null;
let mix = null;

function proxyOf(ctx, { bird = false } = {}) {
  return new Proxy(ctx, {
    get(target, prop) {
      if (prop === 'currentTime' && fakeNow !== null) return fakeNow;
      if (bird && prop === 'destination') return birdBus;
      if (offlineMode && prop === 'state') return 'running';
      if (offlineMode && (prop === 'resume' || prop === 'suspend')) return () => Promise.resolve();
      const v = Reflect.get(target, prop, target);
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
}

function install(factory) {
  function PromoAudioContext() {
    if (!shared) {
      shared = factory();
      return offlineMode ? proxyOf(shared) : shared;
    }
    return proxyOf(shared, { bird: true });
  }
  window.AudioContext = PromoAudioContext;
  window.webkitAudioContext = PromoAudioContext;
}

/** 一段指数衰减的噪声当混响 */
function makeIR(ctx, secs = 2.4, decay = 2.8) {
  const len = Math.floor(ctx.sampleRate * secs);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = rnd() * (1 - i / len) ** decay;
  }
  return ir;
}

/** 在应用的混音（audio.master → 压缩 → 输出）外面再搭几路：贝斯、铺底、和弦短音、旋律、啾啾；高通扫频；混响；“压一下” */
function setupMix(ctx) {
  const master = audio.master;
  master.disconnect();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 8;
  comp.ratio.value = 3.5;
  comp.attack.value = 0.004;
  comp.release.value = 0.18;
  const kill = ctx.createGain(); // 预览时停下来用
  master.gain.value = 0.8;
  master.connect(comp).connect(kill).connect(ctx.destination);

  const hp = ctx.createBiquadFilter(); // 蓄力时把整首往上扫
  hp.type = 'highpass';
  hp.frequency.value = 20;
  hp.Q.value = 1.1;
  hp.connect(master);

  const verb = ctx.createConvolver();
  verb.buffer = makeIR(ctx);
  const verbRet = ctx.createGain();
  verbRet.gain.value = 0.36;
  verb.connect(verbRet).connect(master);

  const duckers = [];
  const bus = (name, level, send = 0, duck = false) => {
    const g = ctx.createGain();
    g.gain.value = level;
    let out = g;
    if (duck) {
      const d = ctx.createGain();
      g.connect(d);
      duckers.push(d);
      out = d;
    }
    out.connect(hp);
    if (send) {
      const s = ctx.createGain();
      s.gain.value = send;
      out.connect(s).connect(verb);
    }
    audio.buses[name] = g;
    return g;
  };
  bus('bass', 0.95);
  bus('pad', 0.9, 0.4, true);
  bus('stab', 0.85, 0.3, true);
  bus('lead', 0.9, 0.3);
  // 鼓也走高通（蓄力时一起变薄），军鼓的那点混响
  audio.buses.drums.disconnect();
  audio.buses.drums.connect(hp);
  const drumSend = ctx.createGain();
  drumSend.gain.value = 0.08;
  audio.buses.drums.connect(drumSend).connect(verb);

  birdBus = ctx.createGain();
  birdBus.gain.value = 3.3; // 鸟叫本来就轻（bird-voice 里每声 0.1–0.2），宣传片里它是主角，抬上来
  birdBus.connect(master);
  const birdSend = ctx.createGain();
  birdSend.gain.value = 0.25;
  birdBus.connect(birdSend).connect(verb);

  mix = { ctx, comp, kill, hp, verb, duckers, drumSend };
  return mix;
}

function noiseBuffer(ctx, secs) {
  const len = Math.floor(ctx.sampleRate * secs);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let seed = 11;
  for (let i = 0; i < len; i++) d[i] = ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  return buf;
}

/** 放一个事件。at = 声音引擎时钟上的哪一刻 */
function play(e, at) {
  const ctx = mix.ctx;
  switch (e.type) {
    case 'drum':
      audio.drum(e.lane, at, e.vel);
      break;
    case 'note':
      audio.note(e.midi, at, e.dur, { voice: e.voice, vel: e.vel, bus: e.bus, tweak: e.tweak || null });
      break;
    case 'voice':
      fakeNow = at - 0.02;
      try {
        voice.play(e.call, e.opts);
      } finally {
        fakeNow = null;
      }
      break;
    case 'auto':
      if (e.what === 'hp') {
        const f = mix.hp.frequency;
        f.cancelScheduledValues(at);
        f.setValueAtTime(e.from, at);
        if (e.to !== e.from) f.exponentialRampToValueAtTime(e.to, at + e.dur);
      } else if (e.what === 'drumverb') {
        // 鼓送进混响的量：前奏很大（空房间），进了律动收回来
        mix.drumSend.gain.cancelScheduledValues(at);
        mix.drumSend.gain.setTargetAtTime(e.to, at, 0.15);
      } else if (e.what === 'duck') {
        for (const d of mix.duckers) {
          d.gain.setValueAtTime(0.38, at);
          d.gain.setTargetAtTime(1, at + 0.01, 0.07);
        }
      } else if (e.what === 'riser') {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer(ctx, e.dur + 0.2);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = 2.2;
        bp.frequency.setValueAtTime(300, at);
        bp.frequency.exponentialRampToValueAtTime(7000, at + e.dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(0.22, at + e.dur * 0.95);
        g.gain.exponentialRampToValueAtTime(0.0001, at + e.dur + 0.02);
        src.connect(bp).connect(g).connect(audio.master);
        src.start(at);
        src.stop(at + e.dur + 0.1);
      }
      break;
    default:
  }
}

// ───────────── 预览：实时放 ─────────────

let timer = 0;
let t0 = 0; // 声音引擎时钟 - 播放头 = t0
let idx = 0;
let playing = false;

async function ensureLive() {
  if (shared) return;
  install(() => new NativeAC({ latencyHint: 'playback' }));
  await audio.init();
  setupMix(shared);
}

export const music = {
  get playing() {
    return playing;
  },
  /** 从第 from 秒开始放（要在一次点击里第一次调用） */
  async start(from = 0) {
    await ensureLive();
    this.stop();
    const ctx = shared;
    if (ctx.state !== 'running') await ctx.resume();
    const begin = ctx.currentTime + 0.12;
    t0 = begin - from;
    mix.kill.gain.cancelScheduledValues(ctx.currentTime);
    mix.kill.gain.setValueAtTime(1, begin - 0.02);
    mix.hp.frequency.cancelScheduledValues(ctx.currentTime);
    const b0 = at(17);
    const b1 = at(18, 4);
    mix.hp.frequency.setValueAtTime(from > b0 && from < b1 ? 30 * (1400 / 30) ** ((from - b0) / (b1 - b0)) : 20, ctx.currentTime);
    const ev = SCORE.events;
    idx = ev.findIndex((e) => e.t >= from - 1e-6);
    if (idx < 0) idx = ev.length;
    playing = true;
    const pump = () => {
      const horizon = ctx.currentTime + 0.35;
      while (idx < ev.length && ev[idx].t + t0 < horizon) {
        play(ev[idx], ev[idx].t + t0);
        idx++;
      }
    };
    pump();
    timer = setInterval(pump, 40);
  },
  stop() {
    clearInterval(timer);
    timer = 0;
    if (playing && mix) {
      const now = shared.currentTime;
      mix.kill.gain.cancelScheduledValues(now);
      mix.kill.gain.setTargetAtTime(0, now, 0.015);
    }
    playing = false;
  },
  /** 播放头（秒）：按“此刻扬声器里正在响的那一帧”算 */
  now() {
    if (!shared) return 0;
    const lat = shared.outputLatency || shared.baseLatency || 0;
    return shared.currentTime - lat - t0;
  },
};

// ───────────── 渲染：离线算完整首 ─────────────

/** 算完整首，返回 AudioBuffer。页面只能用一次（AudioContext 换不回来） */
export async function renderOffline({ sampleRate = 48000, solo = null } = {}) {
  if (shared) throw new Error('这个页面已经开过声音了');
  offlineMode = true;
  const length = Math.ceil(DURATION * sampleRate);
  install(() => new OfflineAudioContext({ numberOfChannels: 2, length, sampleRate }));
  await audio.init();
  setupMix(shared);
  // 只听一路（检查混音用）：'bird' 只有鸟叫，'music' 只有音乐
  if (solo === 'bird') for (const b of ['drums', 'bass', 'pad', 'stab', 'lead']) audio.buses[b].gain.value = 0;
  if (solo === 'music') birdBus.gain.value = 0;
  for (const e of SCORE.events) play(e, e.t);
  // 最后 0.8 秒淡出
  mix.kill.gain.setValueAtTime(1, DURATION - 0.8);
  mix.kill.gain.linearRampToValueAtTime(0, DURATION - 0.02);
  return shared.startRendering();
}

/** AudioBuffer → 16 位 WAV（峰值拉到 peakDb）。顺带量一下响度 */
export function toWav(buf, { peakDb = -1, raw = false } = {}) {
  const ch = [0, 1].map((c) => buf.getChannelData(Math.min(c, buf.numberOfChannels - 1)));
  const n = buf.length;
  let peak = 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    for (const d of ch) {
      const a = Math.abs(d[i]);
      if (a > peak) peak = a;
      sum += d[i] * d[i];
    }
  }
  const gain = raw ? 1 : peak > 0 ? 10 ** (peakDb / 20) / peak : 1;
  const rmsDb = 20 * Math.log10(Math.sqrt(sum / (n * 2)) * gain + 1e-12);
  const out = new DataView(new ArrayBuffer(44 + n * 4));
  const str = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  out.setUint32(4, 36 + n * 4, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true);
  out.setUint16(22, 2, true);
  out.setUint32(24, buf.sampleRate, true);
  out.setUint32(28, buf.sampleRate * 4, true);
  out.setUint16(32, 4, true);
  out.setUint16(34, 16, true);
  str(36, 'data');
  out.setUint32(40, n * 4, true);
  let o = 44;
  let seed = 3;
  const dither = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) / 32768;
  for (let i = 0; i < n; i++) {
    for (const d of ch) {
      const v = Math.max(-1, Math.min(1, d[i] * gain + dither()));
      out.setInt16(o, Math.round(v * 32767), true);
      o += 2;
    }
  }
  return { blob: new Blob([out.buffer], { type: 'audio/wav' }), peak, gainDb: 20 * Math.log10(gain), rmsDb };
}

/** 给画面用：叫声的时长表（不出声）。bird.sing 自己会调 voice.play，这里让它只返回时间、不出声 */
export function quietly(fn) {
  const was = voice.enabled;
  voice.enabled = false;
  try {
    return fn();
  } finally {
    voice.enabled = was;
  }
}
