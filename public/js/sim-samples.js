// 模拟机的“采样”（第 5 章）：模拟机不会真的用麦克风录音，按 [REC SAMPLE] 录下来的是这里现做的几段声音之一。
// 都是用 Web Audio 的采样数据一点一点算出来的，不带音频文件。每一段都有个“像什么”的名字，课文里拿它们当“你录的声音”来剪、变调、循环。
// 也给“采样实验台”（sample-lab.js）用。

const SR = 44100;

function make(ctx, seconds, fill) {
  const len = Math.floor(SR * seconds);
  const buf = ctx.createBuffer(1, len, SR);
  const d = buf.getChannelData(0);
  fill(d, len);
  // 归一化（机器上采样完也会自动把音量拉满：手册 3.13.8 auto-normalize）
  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]));
  if (peak > 0) for (let i = 0; i < len; i++) d[i] = (d[i] / peak) * 0.9;
  return buf;
}

// 一个简单的“元音”：带抖动的锯齿波过三个共振峰，像一声拖长的“啊——”
function vowel(d, len) {
  const f0 = 196; // G3
  const formants = [[800, 80, 1], [1150, 90, 0.5], [2900, 120, 0.25]];
  const state = formants.map(() => [0, 0]);
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const vib = 1 + 0.012 * Math.sin(2 * Math.PI * 5.2 * t);
    phase += (f0 * vib) / SR;
    const src = 2 * (phase % 1) - 1;
    let out = 0;
    formants.forEach(([fc, bw, g], k) => {
      // 两极点的共振滤波器
      const r = Math.exp((-Math.PI * bw) / SR);
      const c = 2 * r * Math.cos((2 * Math.PI * fc) / SR);
      const [y1, y2] = state[k];
      const y = (1 - r) * src + c * y1 - r * r * y2;
      state[k] = [y, y1];
      out += y * g;
    });
    const env = Math.min(1, t / 0.06) * Math.min(1, (len / SR - t) / 0.25);
    d[i] = out * env;
  }
}

// 一声关门：低沉的“咚” + 一下木头的“咔”
function door(d, len) {
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const thump = Math.sin(2 * Math.PI * (70 - 30 * Math.min(1, t * 4)) * t) * Math.exp(-t * 9);
    const knock = (Math.random() * 2 - 1) * Math.exp(-t * 60) * 0.7;
    const wood = Math.sin(2 * Math.PI * 310 * t) * Math.exp(-t * 25) * 0.35;
    d[i] = thump + knock + wood;
  }
}

// 用筷子敲玻璃杯：几个不成整数倍的泛音，慢慢消失
function glass(d, len) {
  const parts = [[1180, 1], [2890, 0.5], [5210, 0.3], [7330, 0.15]];
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    let s = 0;
    for (const [f, g] of parts) s += Math.sin(2 * Math.PI * f * t) * g * Math.exp(-t * (2 + f / 2500));
    d[i] = s * Math.min(1, t / 0.002);
  }
}

// “重采样”：把一小节鼓（底鼓、军鼓、闭镲）录成一段，像从机器自己正在放的声音里截下来的
function loopAt(bpm) {
  return (d, len) => {
    const step = (60 / bpm / 4) * SR;
    for (let s = 0; s < 16; s++) {
      const at = Math.floor(s * step);
      const kick = s % 4 === 0;
      const snare = s === 4 || s === 12;
      for (let i = 0; at + i < len && i < step * 2; i++) {
        const t = i / SR;
        let v = (Math.random() * 2 - 1) * Math.exp(-t * 90) * 0.25; // 闭镲
        if (kick) v += Math.sin(2 * Math.PI * (55 + 90 * Math.exp(-t * 30)) * t) * Math.exp(-t * 8);
        if (snare) v += (Math.random() * 2 - 1) * Math.exp(-t * 18) * 0.6 + Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 20) * 0.4;
        d[at + i] += v;
      }
    }
  };
}

/** 几段“录下来的声音”。name = 课文和模拟机解说里怎么叫它 */
export const RECORDINGS = [
  { id: 'vowel', name: '一声“啊——”', seconds: 1.4, fill: vowel },
  { id: 'door', name: '一声关门', seconds: 0.9, fill: door },
  { id: 'glass', name: '敲一下玻璃杯', seconds: 1.6, fill: glass },
];

const cache = new WeakMap();

/** 取一段录音的采样数据（同一个音频上下文里只算一次） */
export function recordingBuffer(ctx, id, bpm = 100) {
  let m = cache.get(ctx);
  if (!m) cache.set(ctx, (m = new Map()));
  const key = id === 'resample' ? `resample:${Math.round(bpm)}` : id;
  if (!m.has(key)) {
    const rec = RECORDINGS.find((r) => r.id === id);
    m.set(key, id === 'resample' ? make(ctx, (60 / bpm) * 4, loopAt(bpm)) : make(ctx, rec.seconds, rec.fill));
  }
  return m.get(key);
}

/**
 * 放一段采样。opts: { pitch（半音）, start, end（0–1，从哪儿到哪儿）, loop, dur（秒；循环时放多久）, vel, bus }
 * 返回松开的函数。机器上采样的“音高”是变速的：高一个八度，同时也快一倍、短一半（和这里一样）
 */
export function playBuffer(audio, buffer, time, { pitch = 0, start = 0, end = 1, loop = false, dur = null, vel = 0.9, bus } = {}) {
  const ctx = audio.ctx;
  const t = Math.max(time || 0, ctx.currentTime);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const rate = 2 ** (pitch / 12);
  src.playbackRate.value = rate;
  const a = Math.max(0, Math.min(start, end - 0.01)) * buffer.duration;
  const b = Math.max(a + 0.01, Math.min(1, end) * buffer.duration);
  const g = ctx.createGain();
  g.gain.value = vel;
  src.connect(g).connect(audio.buses[bus] || audio.buses.synth);
  let length = (b - a) / rate;
  if (loop) {
    src.loop = true;
    src.loopStart = a;
    src.loopEnd = b;
    length = dur || Math.max(0.6, length);
  }
  src.start(t, a);
  const stop = (at) => {
    const end2 = Math.max(at ?? ctx.currentTime, t + 0.01);
    g.gain.setTargetAtTime(0, end2, 0.015);
    try {
      src.stop(end2 + 0.08);
    } catch {
      /* 已经停了 */
    }
  };
  stop(t + length);
  return stop;
}
