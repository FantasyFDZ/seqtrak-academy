// 教练小鸟的叫声：全部用 Web Audio 现场合成，不用音频文件。
//
// 想让它“好听”，做了四件事：
//   1. 音高都落在一个五声音阶上（默认 D 大调五声），怎么叫都不跑调；可以换成机器当前的调。
//   2. 音域放在 1.1–3 kHz：像真的小鸟，但不刺耳。
//   3. 每个音是“滑进去”的（起音比目标高或低一点再滑到位），加一点颤音，再叠一层很轻的二次泛音，声音圆一些。
//   4. 后面挂一个很短的混响，像在小房间里叫，不干巴。
//
// 叫法（一种情绪一种）：
//   greet 打招呼   ok 做对了   look 看这里   oops 可惜   think 在想   surprised 吃惊   sleepy 困了   song 唱一段（过关、欢呼）
//   chatter 小声嘀咕（说话时）
//
//   voice.play('ok')                         → 返回每个音的 [开始的毫秒, 时长秒]，小鸟用它来张嘴
//   voice.play('song', { tonic: 62 })        → 换一个调（这里是 D；MIDI 音符号，会自动搬到小鸟的音域）
//   voice.enabled = false                    → 不出声（嘴照样动）
const PENTA = [0, 2, 4, 7, 9]; // 大调五声
const MINOR_PENTA = [0, 3, 5, 7, 10];
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

let ctx = null;
let out = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    out = ctx.createGain();
    out.gain.value = 0.55;
    // 短混响：一段指数衰减的噪声当作房间
    const verb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 1.3);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.8;
    }
    verb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.2;
    // 高频收一点，叫声不扎耳朵
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 5200;
    out.connect(tone);
    tone.connect(ctx.destination);
    tone.connect(verb);
    verb.connect(wet);
    wet.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** 一个音：从 f0 滑到 f1，dur 秒；vib = 颤音深度（相对频率），vol = 音量 */
function tweet(t, f0, f1, dur, { vol = 0.16, vib = 0.012, vibRate = 28, attack = 0.012 } = {}) {
  const o = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  const g = ctx.createGain();
  const g2 = ctx.createGain();
  o.type = 'sine';
  o2.type = 'sine';
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.7);
  o2.frequency.setValueAtTime(f0 * 2, t);
  o2.frequency.exponentialRampToValueAtTime(f1 * 2, t + dur * 0.7);
  g2.gain.value = 0.1;
  if (vib) {
    const l = ctx.createOscillator();
    const lg = ctx.createGain();
    const lg2 = ctx.createGain();
    l.frequency.value = vibRate;
    lg.gain.value = f1 * vib;
    lg2.gain.value = f1 * vib * 2;
    l.connect(lg).connect(o.frequency);
    l.connect(lg2).connect(o2.frequency);
    l.start(t);
    l.stop(t + dur + 0.05);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.setValueAtTime(vol, t + Math.max(attack, dur * 0.45));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  o2.connect(g2).connect(g);
  g.connect(out);
  o.start(t);
  o2.start(t);
  o.stop(t + dur + 0.03);
  o2.stop(t + dur + 0.03);
}

// 每种叫法：[开始的秒, 从第几级, 到第几级, 时长秒, 选项]。级数是五声音阶里的位置，0 = 主音，5 = 高八度的主音，负数往下。
const CALLS = {
  // 两声往上扬的口哨：“嘿——你好”
  greet: () => [[0, 0, 3, 0.2, { vib: 0.008 }], [0.27, 2, 5, 0.26, { vib: 0.018 }]],
  // 一串往上走的短音，最后停在高处：“做对啦”
  ok: () => [[0, 0, 0, 0.07], [0.075, 1, 1, 0.07], [0.15, 2, 2, 0.07], [0.225, 3, 3, 0.07], [0.3, 4, 5, 0.18, { vib: 0.02 }]],
  // 两下清脆的“啾啾”，从高处往下点：“看这儿”
  look: () => [[0, 7, 4, 0.07, { vib: 0, attack: 0.005, vol: 0.14 }], [0.13, 7, 4, 0.07, { vib: 0, attack: 0.005, vol: 0.14 }]],
  // 轻轻往下滑，声音小：“哎呀，没关系”
  oops: () => [[0, 3, 1, 0.34, { vol: 0.11, vib: 0.016, vibRate: 9 }], [0.4, 1, -1, 0.3, { vol: 0.09, vib: 0.016, vibRate: 9 }]],
  // 低低的三声咕噜，像在嘀咕：“让我想想”
  think: () => [[0, -2, -1, 0.13, { vol: 0.07, vib: 0.03, vibRate: 18 }], [0.21, -1, -2, 0.13, { vol: 0.07, vib: 0.03, vibRate: 18 }], [0.42, -2, -1, 0.15, { vol: 0.06, vib: 0.03, vibRate: 18 }]],
  // 一下往上蹿：“咦！”
  surprised: () => [[0, -1, 6, 0.16, { vib: 0, attack: 0.006 }], [0.19, 6, 5, 0.07, { vib: 0 }]],
  // 慢慢的两声，越来越低：“好困”
  sleepy: () => [[0, -1, -3, 0.46, { vol: 0.06, vib: 0.01, vibRate: 5 }], [0.62, -2, -4, 0.5, { vol: 0.05, vib: 0.01, vibRate: 5 }]],
  // 小声嘀咕几下（说话时）
  chatter: () => {
    const n = 4 + Math.floor(Math.random() * 3);
    const seq = [];
    let t = 0;
    for (let i = 0; i < n; i++) {
      const a = Math.floor(Math.random() * 5);
      seq.push([t, a, a + (Math.random() < 0.5 ? 1 : -1), 0.06, { vol: 0.06, vib: 0 }]);
      t += 0.08 + Math.random() * 0.05;
    }
    return seq;
  },
  // 唱一段：几个现成的乐句里挑一个，有重复、有颤音、最后落回主音
  song: () => {
    const PHRASES = [
      // 啾啾 啾——啦啦啦啦 嘀——
      [[0, 4, 4, 0.08], [0.1, 5, 5, 0.08], [0.2, 3, 4, 0.16], [0.4, 2, 2, 0.05], [0.46, 3, 3, 0.05], [0.52, 2, 2, 0.05], [0.58, 3, 3, 0.05], [0.66, 6, 5, 0.12], [0.82, 7, 7, 0.08], [0.92, 5, 5, 0.3, { vib: 0.022 }]],
      // 嘀哩 嘀哩 嘟——嘀嘀嘀 哩——
      [[0, 2, 4, 0.1], [0.12, 3, 2, 0.08], [0.24, 2, 4, 0.1], [0.36, 3, 2, 0.08], [0.48, 0, 1, 0.2, { vib: 0.02 }], [0.74, 4, 4, 0.06], [0.82, 5, 5, 0.06], [0.9, 6, 6, 0.06], [1.0, 7, 5, 0.32, { vib: 0.024 }]],
      // 啾—— 哩哩哩哩哩 啾啾 嘀——
      [[0, 3, 5, 0.18], [0.24, 4, 4, 0.045], [0.29, 5, 5, 0.045], [0.34, 4, 4, 0.045], [0.39, 5, 5, 0.045], [0.44, 4, 4, 0.045], [0.54, 7, 6, 0.08], [0.66, 7, 6, 0.08], [0.8, 4, 5, 0.34, { vib: 0.022 }]],
    ];
    return PHRASES[Math.floor(Math.random() * PHRASES.length)];
  },
};

export const voice = {
  enabled: true,
  /** 主音（MIDI）；会搬到 1.1–2.3 kHz 这一段（D6 附近） */
  tonic: 86,
  minor: false,
  names: Object.keys(CALLS),

  /** 叫一声，返回 [[开始毫秒, 时长秒], …]（不出声时也返回，小鸟照样张嘴） */
  play(name, { tonic, minor } = {}) {
    const make = CALLS[name];
    if (!make) return [];
    const seq = make();
    const scale = (minor ?? this.minor) ? MINOR_PENTA : PENTA;
    let base = tonic ?? this.tonic;
    while (base < 81) base += 12; // 搬到小鸟的音域：主音落在 A5–G#6
    while (base > 92) base -= 12;
    const deg = (i) => base + Math.floor(i / 5) * 12 + scale[((i % 5) + 5) % 5];
    const onsets = seq.map(([t, , , dur]) => [Math.round(t * 1000), dur]);
    if (!this.enabled) return onsets;
    const c = audio();
    if (!c) return onsets;
    const t0 = c.currentTime + 0.02;
    for (const [t, a, b, dur, opts] of seq) {
      // 起音从目标音旁边一点点滑进来，更像鸟
      const to = mtof(deg(b));
      const from = a === b ? to * 1.035 : mtof(deg(a));
      tweet(t0 + t, from, to, dur, opts);
    }
    return onsets;
  },
};
