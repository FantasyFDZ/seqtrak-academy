// Web MIDI：找到 SEQTRAK、解析它发来的消息、跟踪它的时钟，并能向它发消息。
import { Emitter } from './util.js';

const hex = (bytes) => [...bytes].map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

class Midi extends Emitter {
  supported = typeof navigator !== 'undefined' && !!navigator.requestMIDIAccess;
  /** idle | unsupported | denied | no-device | connected */
  state = 'idle';
  access = null;
  input = null;
  output = null;
  sysex = false;
  otherInputs = [];
  identity = null;

  /** 最近收到/发出的消息（不含时钟），给设备页的监视器看。 */
  log = [];

  // 时钟跟踪
  playing = false;
  tick = -1; // 自上次 Start 以来的 tick 序号（24 个 = 1 拍）
  tempo = 0; // 由时钟间隔估算出的 BPM；0 表示没有收到时钟
  #sent = []; // 最近发出的消息，用来识别回声
  #expect = new Map(); // 正在等回答的参数地址 → 过期时间
  #clockTimes = [];
  #ticks = [];
  #clockCount = 0;
  #lastClockAt = 0;
  #watchdog = null;

  constructor() {
    super();
    if (!this.supported) this.state = 'unsupported';
  }

  get connected() {
    return this.state === 'connected';
  }

  async connect() {
    if (!this.supported) {
      this.#setState('unsupported');
      return false;
    }
    if (!this.access) {
      try {
        this.access = await navigator.requestMIDIAccess({ sysex: true });
        this.sysex = true;
      } catch {
        try {
          this.access = await navigator.requestMIDIAccess();
          this.sysex = false;
        } catch {
          this.#setState('denied');
          return false;
        }
      }
      this.access.onstatechange = () => this.#scan();
    }
    this.#scan();
    return this.connected;
  }

  #scan() {
    const live = (ports) => [...ports.values()].filter((p) => p.state === 'connected');
    const ins = live(this.access.inputs);
    const outs = live(this.access.outputs);
    const isSeqtrak = (p) => /seqtrak/i.test(p.name || '');
    const input = ins.find(isSeqtrak) || null;
    const output = outs.find(isSeqtrak) || null;
    this.otherInputs = ins.filter((p) => !isSeqtrak(p)).map((p) => p.name);

    if (input !== this.input) {
      if (this.input) this.input.onmidimessage = null;
      this.input = input;
      if (input) input.onmidimessage = (e) => this.#onMessage(e.data, e.timeStamp || performance.now());
    }
    this.output = output;
    if (input) {
      this.#setState('connected');
      if (!this.#watchdog) this.#watchdog = setInterval(() => this.#checkClock(), 500);
      if (this.sysex && !this.identity) this.identify().catch(() => {});
    } else {
      this.identity = null;
      this.#resetClock();
      this.#setState('no-device');
    }
  }

  #setState(state) {
    if (state === this.state) return;
    this.state = state;
    this.emit('state', state);
  }

  // ───────────── 接收 ─────────────

  /** 机器会把我们发过去的音符和 Start/Stop 原样送回来（USB Thru），这里把这些回声认出来丢掉。 */
  #isEcho(d, time) {
    const list = this.#sent;
    if (!list.length) return false;
    while (list.length && list[0].at < time - 600) list.shift();
    const key = Array.prototype.join.call(d, ',');
    const i = list.findIndex((e) => e.key === key && time - e.at > -30 && time - e.at < 200);
    if (i < 0) return false;
    list.splice(i, 1);
    return true;
  }

  #onMessage(d, time) {
    const s = d[0];
    if (s === 0xf8) return this.#onClock(time);
    if (s === 0xfe) return;
    if (s !== 0xf0 && this.#isEcho(d, time)) {
      // 回声里的 Start/Stop 仍然代表机器的真实状态，只是不当作“用户按了 PLAY”
      if (s === 0xfa) {
        this.playing = true;
        this.tick = -1;
        this.#ticks.length = 0;
      } else if (s === 0xfc) {
        this.playing = false;
      }
      return;
    }

    let msg;
    if (s === 0xfa) {
      this.playing = true;
      this.tick = -1; // 紧接着的第一个 clock 才是第 0 个 tick
      this.#ticks.length = 0;
      msg = { type: 'start' };
    } else if (s === 0xfb) {
      this.playing = true;
      msg = { type: 'continue' };
    } else if (s === 0xfc) {
      this.playing = false;
      msg = { type: 'stop' };
    } else if (s === 0xf0) {
      msg = { type: 'sysex' };
      // 这是不是我们刚才主动去“问”的那个参数的回答？（否则就是机器自己上报的变化）
      if (d[1] === 0x43 && (d[2] & 0xf0) === 0x10 && d[5] === 0x0c && this.#expect.size) {
        const key = (d[6] << 16) | (d[7] << 8) | d[8];
        const until = this.#expect.get(key);
        if (until !== undefined) {
          this.#expect.delete(key);
          if (time <= until) msg.reply = true;
        }
      }
    } else if (s >= 0x80 && s < 0xf0) {
      const ch = (s & 0x0f) + 1;
      const kind = s & 0xf0;
      const d1 = d[1] ?? 0;
      const d2 = d[2] ?? 0;
      if (kind === 0x90 && d2 > 0) msg = { type: 'noteon', ch, note: d1, vel: d2 };
      else if (kind === 0x80 || kind === 0x90) msg = { type: 'noteoff', ch, note: d1, vel: d2 };
      else if (kind === 0xb0) msg = { type: 'cc', ch, cc: d1, val: d2 };
      else if (kind === 0xc0) msg = { type: 'pc', ch, pc: d1 };
      else if (kind === 0xe0) msg = { type: 'bend', ch, val: ((d2 << 7) | d1) - 8192 };
      else if (kind === 0xd0) msg = { type: 'pressure', ch, val: d1 };
      else msg = { type: 'other', ch };
    } else {
      msg = { type: 'other' };
    }
    msg.time = time;
    msg.data = d;
    msg.tick = this.tick;
    if (!msg.reply) this.#record('in', msg); // 轮询的问答不进监视器，免得刷屏
    this.emit('message', msg);
    this.emit(msg.type, msg);
  }

  #onClock(time) {
    this.#lastClockAt = time;
    if (this.playing) {
      this.tick++;
      this.#ticks.push({ i: this.tick, t: time });
      if (this.#ticks.length > 96) this.#ticks.shift();
    }
    const arr = this.#clockTimes;
    arr.push(time);
    if (arr.length > 48) arr.shift();
    if (arr.length >= 24 && ++this.#clockCount % 12 === 0) {
      const span = arr[arr.length - 1] - arr[0];
      const bpm = span > 0 ? 60000 / ((span / (arr.length - 1)) * 24) : 0;
      if (bpm >= 4 && bpm <= 400 && Math.abs(bpm - this.tempo) > 0.25) {
        this.tempo = bpm;
        this.emit('tempo', bpm);
      }
    }
    this.emit('clock', { time, tick: this.tick, playing: this.playing });
  }

  #checkClock() {
    if (this.tempo && performance.now() - this.#lastClockAt > 600) this.#resetClock();
  }

  #resetClock() {
    this.#clockTimes.length = 0;
    this.#ticks.length = 0;
    if (this.tempo !== 0) {
      this.tempo = 0;
      this.emit('tempo', 0);
    }
  }

  /** 机器的速度，取整到最接近的常用值，方便显示。 */
  get tempoRounded() {
    if (!this.tempo) return 0;
    const r = Math.round(this.tempo);
    return Math.abs(this.tempo - r) < 0.6 ? r : Math.round(this.tempo * 10) / 10;
  }

  /**
   * 外部时钟模式用：某个时刻（performance 时基，毫秒）对应机器的第几拍。
   * 对最近的 tick 做最小二乘拟合，抹平 USB 传输的抖动。没有足够数据时返回 null。
   */
  beatAtPerf(perfMs) {
    const pts = this.#ticks;
    if (pts.length < 6) return null;
    const n = pts.length;
    let sx = 0;
    let sy = 0;
    let sxx = 0;
    let sxy = 0;
    const x0 = pts[0].i;
    const y0 = pts[0].t;
    for (const p of pts) {
      const x = p.i - x0;
      const y = p.t - y0;
      sx += x;
      sy += y;
      sxx += x * x;
      sxy += x * y;
    }
    const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx); // 每个 tick 多少毫秒
    if (!Number.isFinite(slope) || slope <= 0) return null;
    const intercept = (sy - slope * sx) / n;
    const tick = x0 + (perfMs - y0 - intercept) / slope;
    return tick / 24;
  }

  // ───────────── 发送 ─────────────

  send(bytes, perfTime) {
    if (!this.output) return false;
    try {
      this.output.send(bytes, perfTime);
    } catch (e) {
      console.warn('[midi] send failed', e);
      return false;
    }
    const at = perfTime || performance.now();
    if (bytes[0] !== 0xf0 && bytes[0] !== 0xf8) {
      this.#sent.push({ key: bytes.join(','), at });
      if (this.#sent.length > 256) this.#sent.shift();
    }
    if (bytes[0] !== 0xf8) this.#record('out', { type: 'out', data: bytes, time: at });
    return true;
  }

  /** 发一条不进监视器的消息（给高频的状态轮询用）。 */
  sendQuiet(bytes, perfTime) {
    if (!this.output) return false;
    try {
      this.output.send(bytes, perfTime);
      return true;
    } catch {
      return false;
    }
  }

  /** 登记“接下来会收到这个地址的回答”，这样收到时能和机器主动上报的变化区分开。 */
  expectReply(addr, untilPerf = performance.now() + 800) {
    this.#expect.set((addr[0] << 16) | (addr[1] << 8) | addr[2], untilPerf);
    if (this.#expect.size > 600) this.#expect.clear();
  }

  /** 远程启动 / 停止机器的音序器。 */
  start() {
    const ok = this.send([0xfa]);
    if (ok) {
      // 机器收到后从下一个时钟开始算第 0 个 tick；回声到达时会再对齐一次
      this.playing = true;
      this.tick = -1;
      this.#ticks.length = 0;
    }
    return ok;
  }

  stop() {
    const ok = this.send([0xfc]);
    if (ok) this.playing = false;
    return ok;
  }

  noteOn(ch, note, vel = 100, perfTime) {
    return this.send([0x90 | ((ch - 1) & 0x0f), note & 0x7f, vel & 0x7f], perfTime);
  }

  noteOff(ch, note, perfTime) {
    return this.send([0x80 | ((ch - 1) & 0x0f), note & 0x7f, 0], perfTime);
  }

  /** 在指定时刻让机器发一个固定时长的音。 */
  playNote(ch, note, vel = 100, perfTime = performance.now(), durMs = 120) {
    return this.noteOn(ch, note, vel, perfTime) && this.noteOff(ch, note, perfTime + durMs);
  }

  cc(ch, cc, val, perfTime) {
    return this.send([0xb0 | ((ch - 1) & 0x0f), cc & 0x7f, val & 0x7f], perfTime);
  }

  /** 发一条 SysEx 并等待第一条满足条件的回复。 */
  request(bytes, match, timeoutMs = 800) {
    return new Promise((resolve, reject) => {
      if (!this.output || !this.sysex) return reject(new Error('没有 SysEx 权限或没有输出端口'));
      const off = this.on('sysex', (msg) => {
        if (!match(msg.data)) return;
        clearTimeout(timer);
        off();
        resolve(msg.data);
      });
      const timer = setTimeout(() => {
        off();
        reject(new Error('机器没有回复'));
      }, timeoutMs);
      this.send(bytes);
    });
  }

  /** 通用的“你是谁”查询，回复里带厂商码和固件版本。 */
  async identify() {
    const d = await this.request([0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7], (r) => r[1] === 0x7e && r[3] === 0x06 && r[4] === 0x02);
    // 第 10 个字节 mm =（版本号 − 1.0）× 10：V1.20 → 2，V2.00 → 10
    const mm = d[10] ?? 0;
    this.identity = {
      yamaha: d[5] === 0x43,
      versionNumber: 1 + mm / 10,
      version: `V${(1 + mm / 10).toFixed(2)}`,
      raw: hex(d),
    };
    this.emit('identity', this.identity);
    return this.identity;
  }

  // ───────────── 记录 / 调试 ─────────────

  #record(dir, msg) {
    this.log.push({ dir, type: msg.type, text: describe(msg), hex: hex(msg.data).slice(0, 96), time: msg.time });
    if (this.log.length > 300) this.log.shift();
    this.emit('log', this.log[this.log.length - 1]);
  }

  /** 开发/演示用：假装机器发来了一条消息。 */
  simulate(bytes, time = performance.now()) {
    this.#onMessage(Uint8Array.from(bytes), time);
  }

  /** 开发用：在没有真机的环境里把状态置为“已连接”，以便测试依赖连接的界面。 */
  simulateConnect(on = true) {
    this.#setState(on ? 'connected' : 'no-device');
  }
}

export function describe(msg) {
  switch (msg.type) {
    case 'noteon': return `Note On  · 通道 ${msg.ch} · 音符 ${msg.note} · 力度 ${msg.vel}`;
    case 'noteoff': return `Note Off · 通道 ${msg.ch} · 音符 ${msg.note}`;
    case 'cc': return `CC ${msg.cc} = ${msg.val} · 通道 ${msg.ch}`;
    case 'pc': return `Program ${msg.pc} · 通道 ${msg.ch}`;
    case 'bend': return `Pitch Bend ${msg.val} · 通道 ${msg.ch}`;
    case 'start': return 'Start（开始播放）';
    case 'stop': return 'Stop（停止）';
    case 'continue': return 'Continue（继续）';
    case 'sysex': return `SysEx · ${msg.data.length} 字节`;
    case 'out': return '→ 发给机器';
    default: return msg.type;
  }
}

export const midi = new Midi();
export { hex };
