// 曲目的 SEQTRAK 版分轨怎么放：把 content/song-parts.js 里的一首歌排成每一步的声音，整首叠起来放，每条轨道可以独奏 / 静音。
// 曲目卡片上的试听键、一首歌的“分轨”页（views/song-parts.js）用它；以后“一轨一轨照着搭”的课也可以直接用。
// 发声用应用自带的合成器（audio.js），不是让机器自己响；速度和摇摆交给循环播放器（looper.js），和模拟机一样按 swing / 120 摇。
//
// 混响和延迟照机器上的“发送效果”做（操作参考 3.12.1）：全机只有一个混响、一个延迟，每条轨道各自决定往里送多少
// （分轨上的 send，机器上是 Sound Design 第 3 页的旋钮 1、2）。混响的长短、延迟隔几拍写在一首歌的 space 上。
import { LoopPlayer } from './looper.js';
import { audio } from './audio.js';
import { cleanPattern } from './chart.js';
import { synthKeyNote, chordNotes } from './scales.js';
import { LAYERS } from './content/song-parts.js';
import { TRACKS } from './tracks.js';

// 每种层的默认力度：和弦一次响 4 个音，单个要轻一些；旋律要浮在和弦上面。单首要调就在分轨上写 vel。
const VEL = { bass: 0.75, chords: 0.28, lead: 0.9 };
// 一首歌没写 space 时：混响 2.6 秒、延迟隔附点八分（0.75 拍）、回授 0.35
const SPACE = { reverb: 2.6, delay: 0.75, feedback: 0.35 };

/** 合成器分轨里一个音实际发出的 MIDI 音符号（CHORD 弹法时是一组）。note = [步, 第几个键, 持续几步, 八度偏移?] */
export function partPitches(song, part, note) {
  const [, key, , shift = 0] = note;
  const opts = { scale: song.scale, key: song.key, octave: (part.octave || 0) + shift };
  return part.mode === 'chord' ? chordNotes(key, opts) : [synthKeyNote(key, opts)];
}

/** 一条分轨自己有几步（鼓轨看节奏串，合成器轨按整首的长度；比整首短的会自己重复） */
export function partLength(song, part) {
  return part.steps ? cleanPattern(part.steps).length || 16 : (part.bars || song.bars) * 16;
}

/** 一条分轨在整首循环里（或一段 n 步长的 Scene 里）每一步发什么：byStep[步] = [{ drum, vel } 或 { midis, len, voice, vel }] */
function partEvents(song, part, n = song.bars * 16) {
  const own = partLength(song, part);
  const byStep = Array.from({ length: n }, () => []);
  if (part.steps) {
    const p = cleanPattern(part.steps);
    for (let s = 0; s < n; s++) {
      const c = p[s % own];
      if (c === 'x' || c === 'X') byStep[s].push({ drum: part.drum || part.track, vel: (c === 'X' ? 1 : 0.85) * (part.vel ?? 1) });
    }
  }
  for (const note of part.notes || []) {
    const [step, , len = 1] = note;
    const e = { midis: partPitches(song, part, note), len, voice: part.voice || 'keys', vel: part.vel ?? VEL[part.layer] ?? 0.8 };
    for (let s = step; s < n; s += own) byStep[s].push(e);
  }
  return byStep;
}

// ───────────── 混响和延迟（全机共用，只建一次） ─────────────

let space = null;

/** 一段假的“房间回声”：左右两路不一样的噪声，越往后越轻（立体声的混响靠它） */
function impulse(ctx, sec) {
  const len = Math.max(1, Math.round(ctx.sampleRate * sec));
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  }
  return buf;
}

function spaceFor(song) {
  const ctx = audio.ctx;
  if (!space || space.ctx !== ctx) {
    const reverb = ctx.createConvolver();
    const revIn = ctx.createGain();
    const revOut = ctx.createGain();
    revOut.gain.value = 0.9;
    revIn.connect(reverb).connect(revOut).connect(audio.master);
    // 延迟：回授一圈比一圈暗一点（回授里过一个低通），出来以后再带一点进混响，听着不那么“干”
    const delay = ctx.createDelay(4);
    const fb = ctx.createGain();
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 3200;
    const delIn = ctx.createGain();
    const delOut = ctx.createGain();
    delOut.gain.value = 0.8;
    delIn.connect(delay).connect(tone);
    tone.connect(fb).connect(delay);
    tone.connect(delOut).connect(audio.master);
    const delToRev = ctx.createGain();
    delToRev.gain.value = 0.3;
    delOut.connect(delToRev).connect(revIn);
    space = { ctx, reverb, revIn, delay, fb, delIn, sec: 0, buses: new WeakMap(), fx: new Map() };
  }
  const sp = { ...SPACE, ...(song.space || {}) };
  if (space.sec !== sp.reverb) {
    space.reverb.buffer = impulse(ctx, sp.reverb);
    space.sec = sp.reverb;
  }
  space.delay.delayTime.setValueAtTime((60 / song.bpm) * sp.delay, ctx.currentTime);
  space.fb.gain.setValueAtTime(sp.feedback, ctx.currentTime);
  return space;
}

/**
 * 每条分轨一条自己的线：干声接到鼓 / 合成器的总线上，另外按 send 分出两路送进混响和延迟。
 * 同一首歌的线只建一次（卡片试听每点一次都会新建一个播放器，线不跟着越建越多）。返回 audio.buses 里的名字。
 */
let busSeq = 0;
function busesFor(song) {
  const sp = spaceFor(song);
  if (sp.buses.has(song)) return sp.buses.get(song);
  const ctx = audio.ctx;
  const id = ++busSeq;
  const names = song.parts.map((part, i) => {
    const name = `song${id}:${i}`;
    const g = ctx.createGain();
    // 应用自带的拍手声很薄（量出来比别的鼓低 10 dB 以上），曲目里的拍手统一放大；单条要调就在分轨上写 gain
    g.gain.value = part.gain ?? (part.track === 'CLAP' ? 4 : 1);
    // 再过一个滤波器（平时全开；完整版里“现场转滤波器”时慢慢开、慢慢关）和一个音量（DUCKER：跟着底鼓一下一下压下去），送混响、延迟的也在它们后面
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 20000;
    lp.Q.value = 0;
    const dk = ctx.createGain();
    g.connect(lp).connect(dk);
    dk.connect(audio.buses[part.steps ? 'drums' : 'synth']);
    const rev = ctx.createGain();
    rev.gain.value = part.send?.reverb || 0;
    dk.connect(rev).connect(sp.revIn);
    const del = ctx.createGain();
    del.gain.value = part.send?.delay || 0;
    dk.connect(del).connect(sp.delIn);
    audio.buses[name] = g;
    sp.fx.set(name, { lp, dk });
    return name;
  });
  sp.buses.set(song, names);
  return names;
}

/** 一首歌有哪几层，按“照着搭”的先后排（鼓 → 贝斯 → 和弦 → 旋律） */
export const layerOrder = (song) => [...new Set(song.parts.map((p) => p.layer))].sort((a, b) => LAYERS[a].order - LAYERS[b].order);

/** 属于这几层的那些分轨（下标） */
export const partsIn = (song, layers) => new Set(song.parts.map((p, i) => (layers.includes(p.layer) ? i : -1)).filter((i) => i >= 0));

export class SongPlayer {
  #player = null;
  #stepCb = null;

  constructor(song) {
    this.song = song;
    this.steps = song.bars * 16;
    this.events = song.parts.map((p) => partEvents(song, p));
    this.muted = new Set(); // 静音的那几条（下标）
    this.solo = null; // 独奏的那一条：同一时间只有一条，和机器一样；独奏优先于静音
    this.only = null; // “一层层加上去”时现在响的那几条（Set）；null = 不在这个模式
    this.onLap = null; // 每要开始新的一圈时调用（排声音的时候，比听到早 0.1 秒左右）：(第几圈，从 0 起) => {}
  }

  get playing() {
    return !!this.#player?.playing;
  }

  audible(i) {
    if (this.solo !== null) return this.solo === i;
    if (this.only) return this.only.has(i);
    return !this.muted.has(i);
  }

  /**
   * 一层层加上去：先只放第一层（鼓），每 laps 圈加一层，加满了就整首放下去（这时调 onFull）。
   * 会清掉独奏和静音。分轨页和课里“先听一遍”的小部件都用它。
   */
  startBuild(laps = 1, onFull = null) {
    const order = layerOrder(this.song);
    const at = (lap) => order.slice(0, Math.min(order.length, Math.floor(lap / laps) + 1));
    this.solo = null;
    this.muted.clear();
    this.only = partsIn(this.song, at(0));
    this.onLap = (lap) => {
      const on = at(lap);
      this.only = partsIn(this.song, on);
      if (on.length === order.length) {
        this.only = null;
        this.onLap = null;
        onFull?.();
      }
    };
    return this.start();
  }

  /** 播放头：cb(第几步, 第几圈)，跟着听到的声音走；停下时 cb(-1) */
  onStep(cb) {
    this.#stepCb = cb;
    return this;
  }

  start() {
    this.stop();
    const stepSec = 60 / this.song.bpm / 4;
    const p = new LoopPlayer({ bpm: this.song.bpm, steps: this.steps, swing: (this.song.swing || 0) / 120 });
    let lap = -1;
    let buses = null;
    p.onSchedule = (s, t) => {
      if (s === 0) this.onLap?.(++lap);
      if (this.#player !== p) return; // 刚被 onLap 停掉了
      buses ??= busesFor(this.song); // 到这里声音已经开了（audio.ctx 有了）
      this.events.forEach((byStep, i) => {
        if (!this.audible(i)) return;
        for (const e of byStep[s]) {
          if (e.drum) audio.drum(e.drum, t, e.vel, buses[i]);
          else for (const m of e.midis) audio.note(m, t, e.len * stepSec * 0.92, { voice: e.voice, vel: e.vel, bus: buses[i] });
        }
      });
    };
    let heard = 0;
    let last = -1;
    p.onStep((s) => {
      if (s >= 0 && s < last) heard++; // 画面可能跳过几步（页面被挡住时），所以看“绕回来了”而不是看第 0 步
      if (s >= 0) last = s;
      this.#stepCb?.(s, heard);
    });
    this.#player = p;
    return p.start();
  }

  stop() {
    const p = this.#player;
    this.#player = null;
    p?.stop();
  }
}

// ───────────── 完整版：按段落（Scene）一段段放 ─────────────
// 数据在 content/song-arrangements.js：每条轨道有几段乐句（1 = 分轨里那一段），一首歌按顺序排的几个 Scene，
// 每个 Scene 写着每条轨道放第几段乐句（没写的那条在这个 Scene 里静音）。机器上就是 Song 模式（操作参考 3.14）。

const ORDER = Object.fromEntries(TRACKS.map((t, i) => [t.id, i]));

/** 完整版用到的全部轨道，一条一个（分轨里的 + 完整版加的），按机器上的先后排（KICK … DX） */
export function arrangementTracks(spec, arr) {
  return [...spec.parts, ...(arr.extra || [])]
    .map((p) => (arr.tracks?.[p.track] ? { ...p, ...arr.tracks[p.track] } : p)) // 完整版改了这条轨道的设置（换音色、开 DUCKER……）
    .sort((a, b) => ORDER[a.track] - ORDER[b.track]);
}

/**
 * 一条轨道的第 no 段乐句，排成和分轨一样的样子：1 = 分轨里那一段（arr.patterns 里也可以重写它），别的写在 arr.patterns 里。
 * 没写的（八度、弹法、音色、往混响送多少、音色挑什么）都跟着这条轨道。没有这一段就返回 null。
 */
export function patternOf(spec, arr, track, no) {
  const base = arrangementTracks(spec, arr).find((p) => p.track === track);
  const pat = arr.patterns?.[track]?.[no];
  if (!base || (!pat && no !== 1)) return null;
  if (!pat) return base;
  const part = { ...base, ...pat };
  if (pat.steps) delete part.notes;
  if (pat.notes) {
    delete part.steps;
    part.bars = pat.bars || base.bars || spec.bars;
  }
  return part;
}

/** 一条轨道一共有几段乐句（1 到最大的那个编号） */
export function patternCount(spec, arr, track) {
  return Math.max(1, ...Object.keys(arr.patterns?.[track] || {}).map(Number));
}

/** 每个 Scene 从第几步开始、有几步（16 步一小节） */
export function arrangementTimeline(arr) {
  let at = 0;
  return arr.scenes.map((sc, i) => {
    const s = { ...sc, i, start: at, steps: sc.bars * 16 };
    at += s.steps;
    return s;
  });
}

// 完整版的每条轨道也要一条自己的线（往混响、延迟里送多少）：按完整版建一个“歌”给 busesFor，只建一次
const arrSongs = new WeakMap();
function arrSong(spec, arr) {
  if (!arrSongs.has(arr)) arrSongs.set(arr, { ...spec, parts: arrangementTracks(spec, arr) });
  return arrSongs.get(arr);
}

export class ArrangementPlayer {
  #player = null;
  #stepCb = null;

  constructor(spec, arr) {
    this.spec = spec;
    this.arr = arr;
    this.tracks = arrangementTracks(spec, arr);
    this.scenes = arrangementTimeline(arr);
    this.total = this.scenes.reduce((n, s) => n + s.steps, 0);
    // events[第几个 Scene][第几条轨道] = 这个 Scene 里每一步发什么；这条轨道在这个 Scene 里静音就是 null
    this.events = this.scenes.map((sc) => this.tracks.map((p) => {
      const part = sc.play[p.track] ? patternOf(spec, arr, p.track, sc.play[p.track]) : null;
      if (!part) return null;
      // 乐句按它自己的长度在这个 Scene 里重复（分轨里的那段没写 bars，就是整首循环的长度，不是这个 Scene 的长度）
      return partEvents(spec, part.notes ? { ...part, bars: part.bars || spec.bars } : part, sc.steps);
    }));
    this.muted = new Set(); // 静音的那几条轨道（下标）
    this.solo = null; // 独奏的那一条
    this.loop = null; // 只循环第几个 Scene（机器上的 Scene 模式）；null = 从头往后一段段放，放完就停（Song 模式）
    this.onEnd = null; // 整首放完了
  }

  get playing() {
    return !!this.#player?.playing;
  }

  audible(i) {
    if (this.solo !== null) return this.solo === i;
    return !this.muted.has(i);
  }

  /** 第几步在第几个 Scene */
  sceneAt(step) {
    return this.scenes.findLastIndex((s) => s.start <= step);
  }

  /** 播放头：cb(从整首开头数的第几步)；停下时 cb(-1) */
  onStep(cb) {
    this.#stepCb = cb;
    return this;
  }

  /** 从第 from 个 Scene 开始放；this.loop 不是 null 时只循环那一个 */
  start(from = 0) {
    this.stop();
    const first = this.scenes[this.loop ?? from];
    const begin = first.start;
    const steps = this.loop !== null ? first.steps : this.total - begin;
    const stepSec = 60 / this.spec.bpm / 4;
    const song = arrSong(this.spec, this.arr);
    const p = new LoopPlayer({ bpm: this.spec.bpm, steps, swing: (this.spec.swing || 0) / 120 });
    let lap = -1;
    let buses = null;
    p.onSchedule = (s, t) => {
      if (s === 0 && ++lap > 0 && this.loop === null) {
        // Song 模式放到头就停（机器上默认也不从头循环）
        this.stop();
        this.onEnd?.();
        return;
      }
      if (this.#player !== p) return;
      if (!buses) {
        buses = busesFor(song);
        this.#resetFx(buses, t);
      }
      const g = begin + s;
      const si = this.sceneAt(g);
      const sc = this.scenes[si];
      const local = g - sc.start;
      if (local === 0) this.#sceneFx(sc, buses, t, sc.steps * stepSec);
      this.events[si].forEach((byStep, i) => {
        if (!byStep || !this.audible(i)) return;
        for (const e of byStep[local]) {
          if (e.drum) {
            audio.drum(e.drum, t, e.vel, buses[i]);
            if (e.drum === 'KICK') this.#duck(buses, t);
          } else for (const m of e.midis) audio.note(m, t, e.len * stepSec * 0.92, { voice: e.voice, vel: e.vel, bus: buses[i] });
        }
      });
    };
    p.onStep((s) => this.#stepCb?.(s < 0 ? -1 : begin + s));
    this.#player = p;
    return p.start();
  }

  stop() {
    const p = this.#player;
    this.#player = null;
    p?.stop();
  }

  // 每次开始放：滤波器全开、音量回到 1（上一次停在一半的“喘气”、开到一半的滤波器不留下来）
  #resetFx(buses, t) {
    for (const name of buses) {
      const fx = space.fx.get(name);
      fx.lp.frequency.cancelScheduledValues(0);
      fx.lp.frequency.setValueAtTime(20000, t);
      fx.dk.gain.cancelScheduledValues(0);
      fx.dk.gain.setValueAtTime(1, t);
    }
  }

  // 一个 Scene 开始时：写了“现场转滤波器”（scene.moves）的轨道，滤波器在这一段里从 from 慢慢转到 to；别的轨道全开
  #sceneFx(sc, buses, t, dur) {
    this.tracks.forEach((p, i) => {
      const f = space.fx.get(buses[i]).lp.frequency;
      const mv = sc.moves?.[p.track];
      f.cancelScheduledValues(t);
      f.setValueAtTime(mv ? mv[0] : 20000, t);
      if (mv) f.exponentialRampToValueAtTime(mv[1], t + dur);
    });
  }

  // 底鼓响一下：开了 DUCKER 的轨道（分轨上的 duck = 压下去多少，0–1）马上压低，再慢慢回来——听起来就是跟着底鼓“喘气”
  #duck(buses, t) {
    this.tracks.forEach((p, i) => {
      if (!p.duck) return;
      const g = space.fx.get(buses[i]).dk.gain;
      g.cancelScheduledValues(t);
      g.setTargetAtTime(1 - p.duck, t, 0.004);
      g.setTargetAtTime(1, t + 0.04, 0.09);
    });
  }
}
