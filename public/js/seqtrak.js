// SEQTRAK 设备层：用 SysEx 读写参数、跟踪机器状态、远程启停，以及把机器正在播放的 pattern“镜像”出来。
// 地址来自官方 Data List；01 xx xx 区是第三方逆向得到的只读状态，本文件只读不写。
// 依据与实测记录见 docs/seqtrak-midi-reference.md、docs/hardware-findings.md。
import { midi } from './midi.js';
import { Emitter, sleep, clamp } from './util.js';
import { TRACKS, trackByChannel } from './tracks.js';

const PARAM_CHANGE = [0xf0, 0x43, 0x10, 0x7f, 0x1c, 0x0c];
const PARAM_REQUEST = [0xf0, 0x43, 0x30, 0x7f, 0x1c, 0x0c];

export const ADDR = {
  tempo: [0x30, 0x40, 0x76],
  swing: [0x30, 0x40, 0x7c],
  scale: [0x30, 0x40, 0x7e],
  key: [0x30, 0x40, 0x7f],
  padVelocity: [0x00, 0x00, 0x20],
  // 只读状态（第三方地址）
  playing: [0x01, 0x10, 0x20],
  recording: [0x01, 0x10, 0x21],
  track: [0x01, 0x10, 0x27],
  project: [0x01, 0x10, 0x15],
  battery: [0x01, 0x10, 0x02],
};

const TICKS_PER_STEP = 6;

class Seqtrak extends Emitter {
  state = {
    synced: false,
    firmware: '',
    firmwareNumber: 0,
    tempo: 0,
    swing: 0,
    scale: 0, // 0–7 = Scale 1–8
    key: 0, // 0–11 个半音
    padVelocity: 100,
    playing: false,
    recording: false,
    track: 0, // 当前选中的轨道 0–10
    project: 0, // 0–7
    battery: null,
    patterns: Array(11).fill(0),
  };

  constructor() {
    super();
    midi.on('sysex', (m) => this.#onSysex(m.data, !!m.reply));
    midi.on('start', () => this.#set({ playing: true }));
    midi.on('stop', () => this.#set({ playing: false }));
    midi.on('identity', (id) => this.#set({ firmware: id.version, firmwareNumber: id.versionNumber }));
    midi.on('state', (s) => {
      if (s === 'connected') this.sync();
      else this.#set({ synced: false });
    });
  }

  get track() {
    return TRACKS[this.state.track] || TRACKS[0];
  }

  #set(patch) {
    let changed = false;
    for (const [k, v] of Object.entries(patch)) {
      if (this.state[k] !== v) {
        this.state[k] = v;
        changed = true;
      }
    }
    if (changed) this.emit('state', this.state);
  }

  #onSysex(d, reply) {
    if (d[1] !== 0x43 || (d[2] & 0xf0) !== 0x10 || d[3] !== 0x7f || d[4] !== 0x1c || d[5] !== 0x0c) return;
    const addr = [d[6], d[7], d[8]];
    const data = Array.from(d.slice(9, -1));
    this.#apply(addr, data);
    // reply = true：这是对我们查询的回答；false：机器自己上报的变化
    this.emit('param', { addr, data, reply });
  }

  /**
   * 一口气查询一批参数（不等回答）。回答会陆续以 'param' 事件到来。
   * 实测机器每秒应答 500 条没有丢失；这里默认每 3 毫秒发一条。
   */
  poll(addrs, spacingMs = 3) {
    if (!midi.output || !midi.sysex) return false;
    const now = performance.now();
    addrs.forEach((addr, i) => {
      const at = now + i * spacingMs;
      midi.expectReply(addr, at + 700);
      midi.sendQuiet([...PARAM_REQUEST, ...addr, 0xf7], at);
    });
    return true;
  }

  #apply([h, m, l], data) {
    const v = data[0];
    if (h === 0x30 && m === 0x40) {
      if (l === 0x76) this.#set({ tempo: data[0] * 128 + data[1] });
      else if (l === 0x7c) this.#set({ swing: data[0] * 128 + data[1] - 128 });
      else if (l === 0x7e) this.#set({ scale: v });
      else if (l === 0x7f) this.#set({ key: v - 0x40 });
    } else if (h === 0x30 && (m & 0xf0) === 0x50 && l === 0x0f) {
      const patterns = [...this.state.patterns];
      patterns[m & 0x0f] = v;
      this.#set({ patterns });
    } else if (h === 0x01 && m === 0x10) {
      if (l === 0x20) this.#set({ playing: v === 1 });
      else if (l === 0x21) this.#set({ recording: v === 1 });
      else if (l === 0x27) this.#set({ track: v });
      else if (l === 0x15) this.#set({ project: v });
      else if (l === 0x02) this.#set({ battery: v });
    } else if (h === 0 && m === 0 && l === 0x20) {
      this.#set({ padVelocity: v });
    }
  }

  /** 读一个参数，返回数据字节。 */
  async read(addr, timeoutMs = 400) {
    midi.expectReply(addr, performance.now() + timeoutMs + 100);
    const d = await midi.request(
      [...PARAM_REQUEST, ...addr, 0xf7],
      (r) => r[1] === 0x43 && (r[2] & 0xf0) === 0x10 && r[5] === 0x0c && r[6] === addr[0] && r[7] === addr[1] && r[8] === addr[2],
      timeoutMs,
    );
    return Array.from(d.slice(9, -1));
  }

  write(addr, bytes) {
    return midi.send([...PARAM_CHANGE, ...addr, ...bytes, 0xf7]);
  }

  /** 连接后把机器当前的状态读一遍。 */
  async sync() {
    if (!midi.sysex || !midi.output) return false;
    for (const name of ['tempo', 'swing', 'scale', 'key', 'padVelocity', 'playing', 'recording', 'track', 'project', 'battery']) {
      try {
        await this.read(ADDR[name]); // 应答会经由 #onSysex 更新 state
      } catch {
        try {
          await this.read(ADDR[name]);
        } catch {
          /* 读不到就保持原值 */
        }
      }
      await sleep(4);
    }
    if (!midi.identity) await midi.identify().catch(() => {});
    this.#set({ synced: true });
    return true;
  }

  // ───────────── 远程控制（会改变机器状态） ─────────────

  /** 把机器当前 project 的速度改成 bpm（5–300）。 */
  setTempo(bpm) {
    const v = clamp(Math.round(bpm), 5, 300);
    const ok = this.write(ADDR.tempo, [v >> 7, v & 0x7f]);
    if (ok) this.#set({ tempo: v });
    return ok;
  }

  play() {
    return midi.start();
  }

  stop() {
    return midi.stop();
  }

  /**
   * 让机器把当前的 pattern 播一圈，记下每条轨道在哪些步上发了音，然后停下。
   * 返回 PatternMirror 的快照。机器会出声。
   */
  async capture({ steps = 16 } = {}) {
    if (!midi.connected) throw new Error('没有连接 SEQTRAK');
    if (midi.playing) {
      this.stop();
      await sleep(180);
    }
    const mirror = new PatternMirror(steps).attach();
    this.play();
    const stepMs = 60000 / (this.state.tempo || midi.tempo || 120) / 4;
    const deadline = performance.now() + stepMs * steps * 1.6 + 1500;
    while (midi.tick < steps * TICKS_PER_STEP + 1 && performance.now() < deadline) await sleep(15);
    this.stop();
    mirror.detach();
    if (midi.tick < steps * TICKS_PER_STEP) throw new Error('机器没有按预期播放，检查它是否开着并连着 USB');
    return mirror.snapshot(0);
  }
}

/**
 * 把机器正在播放的内容还原成步进网格。
 * 机器播放时每条轨道的音符都会从 USB 发出来；结合时钟就知道每个音落在第几步。
 */
export class PatternMirror extends Emitter {
  #off = [];

  constructor(steps = 16) {
    super();
    this.steps = steps;
    this.loop = -1;
    /** trackId → Map(step → { loop, vel, notes:Set }) */
    this.cells = new Map();
  }

  attach() {
    this.#off.push(
      midi.on('noteon', (m) => this.#onNote(m)),
      midi.on('clock', ({ tick, playing }) => {
        if (!playing || tick < 0) return;
        const loop = Math.floor(tick / (this.steps * TICKS_PER_STEP));
        if (loop !== this.loop) {
          this.loop = loop;
          this.emit('loop', loop);
        }
        if (tick % TICKS_PER_STEP === 0) this.emit('step', (tick / TICKS_PER_STEP) % this.steps);
      }),
      midi.on('start', () => this.reset()),
    );
    return this;
  }

  detach() {
    this.#off.forEach((f) => f());
    this.#off = [];
  }

  reset() {
    this.cells.clear();
    this.loop = -1;
    this.emit('update');
  }

  #onNote(m) {
    if (!midi.playing || m.tick < 0) return;
    const track = trackByChannel(m.ch);
    if (!track) return;
    // 往后偏的音（swing、micro timing）归到它所属的那一步；允许略微提前
    const abs = Math.floor((m.tick + 1.5) / TICKS_PER_STEP);
    const step = abs % this.steps;
    const loop = Math.floor(abs / this.steps);
    let row = this.cells.get(track.id);
    if (!row) this.cells.set(track.id, (row = new Map()));
    const cell = row.get(step);
    if (cell && cell.loop === loop) cell.notes.add(m.note);
    else row.set(step, { loop, vel: m.vel, notes: new Set([m.note]) });
    this.emit('update');
  }

  /** 某一圈（默认最近完整的一圈）里每条轨道的步：{ KICK: [0,4,8,12], SYNTH1: [...] } */
  snapshot(loop = Math.max(0, this.loop - 1)) {
    const out = {};
    for (const [trackId, row] of this.cells) {
      const steps = [...row.entries()].filter(([, c]) => c.loop === loop).map(([s]) => s).sort((a, b) => a - b);
      if (steps.length) out[trackId] = steps;
    }
    return out;
  }

  /** 每一步上最近一次响的是哪几个音（从低到高）：{ SYNTH2: { 0: [60, 63, 67, 70], 8: [...] } }。和弦的一步会有好几个音。 */
  notes() {
    const out = {};
    for (const [trackId, row] of this.cells) out[trackId] = Object.fromEntries([...row].map(([s, c]) => [s, [...c.notes].sort((a, b) => a - b)]));
    return out;
  }

  /** 实时视图：最近一圈之内出现过的步。 */
  live() {
    const out = {};
    for (const [trackId, row] of this.cells) {
      const steps = [...row.entries()].filter(([, c]) => c.loop >= this.loop - 1).map(([s]) => s).sort((a, b) => a - b);
      if (steps.length) out[trackId] = steps;
    }
    return out;
  }
}

/**
 * 2026-11-10 在真机上测过、课程里会直接读的几个地址（p = 轨道号 0–10；合成器轨是 7 SYNTH 1、8 SYNTH 2、9 DX）。
 * 依据见 docs/hardware-findings.md 的“第 3 章开工前的探测”。
 */
export const TRACK_ADDR = {
  /** 单音 / 复音 / 和弦：0 MONO、1 POLY、2 CHORD（官方 Data List 的 Mono/Poly Mode）。存在音色里，换音色会变 */
  poly: (p) => [0x31, 0x10 | p, 0x23],
  /** 这条轨道第 pattern 段乐句的长度，两个字节，单位是步（官方 Data List：Pattern n Step） */
  length: (p, pattern = 0) => [0x30, 0x50 | p, 0x16 + 2 * pattern],
  /** 这条轨道现在用的音色的名字（第三方地址，只读） */
  soundName: (p) => [0x01, 0x10 | p, 0x35],
};

/** 把 01 1p 35 回来的数据还原成音色名：每 8 个字节的第 1 个是另外 7 个的最高位（英文名时是 0），去掉它就是字母 */
export function decodeSoundName(data) {
  return String.fromCharCode(...data.filter((b, i) => i % 8 !== 0 && b >= 0x20 && b < 0x7f)).trim();
}

/** [0,4,8,12] → 'x---x---x---x---' */
export function stepsToPattern(steps, len = 16) {
  const arr = Array(len).fill('-');
  for (const s of steps || []) if (s >= 0 && s < len) arr[s] = 'x';
  return arr.join('');
}

export const seqtrak = new Seqtrak();
