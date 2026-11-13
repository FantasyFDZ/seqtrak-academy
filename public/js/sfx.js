// 界面音效：全部用 Web Audio 现场合成，不带音频文件。音量明显低于机器和音游的声音。
// 音游打着的时候不出声（game.js 开打时调 sfx.hold()），免得干扰判定；「设置」里可以整个关掉。
import { audio } from './audio.js';

let enabled = true;
let holds = 0;
let bus = null;

function out() {
  if (!bus) {
    bus = audio.ctx.createGain();
    bus.gain.value = 0.5;
    bus.connect(audio.master);
  }
  return bus;
}

/** 一个滑音：type 波形，f0 → f1 赫兹，dur 秒，vol 音量，at 推后多少秒 */
function tone(type, f0, f1, dur, vol = 0.2, at = 0) {
  const ctx = audio.ctx;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out());
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** 一小段噪声：dur 秒，hp 高通频率，vol 音量 */
function noise(dur, hp, vol = 0.15, at = 0) {
  const ctx = audio.ctx;
  const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
  const s = ctx.createBufferSource();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  f.type = 'highpass';
  f.frequency.value = hp;
  g.gain.value = vol;
  s.buffer = buf;
  s.connect(f).connect(g).connect(out());
  s.start(ctx.currentTime + at);
}

const run = (notes, type, dur, vol, gap) => notes.forEach((f, i) => tone(type, f, f, dur, vol, i * gap));

const SOUNDS = {
  tick: () => tone('square', 900, 500, 0.04, 0.05), // 轻触：导航、分段开关、小按钮
  press: () => { tone('triangle', 300, 170, 0.07, 0.16); noise(0.02, 3000, 0.05); }, // 键帽按到底：主按钮、关卡
  on: () => tone('square', 620, 930, 0.06, 0.05), // 开关拨到“开”
  off: () => tone('square', 760, 480, 0.06, 0.05), // 开关拨到“关”
  nope: () => tone('sawtooth', 160, 90, 0.12, 0.05), // 还不能点：没解锁的关
  open: () => tone('sine', 330, 660, 0.14, 0.1), // 教练出来
  close: () => tone('sine', 560, 300, 0.12, 0.08),
  skin: () => { noise(0.22, 1800, 0.05); tone('sine', 220, 440, 0.2, 0.08); }, // 换配色
  ok: () => run([523, 659, 784], 'triangle', 0.22, 0.12, 0.07), // 做完一项
  star: () => { tone('sine', 1320, 1320, 0.3, 0.1); tone('sine', 2640, 2640, 0.18, 0.04); },
  badge: () => { run([784, 1175], 'triangle', 0.3, 0.13, 0.11); tone('sine', 2350, 2350, 0.4, 0.04, 0.11); }, // 拿到徽章
  levelup: () => { run([523, 659, 784, 1047], 'triangle', 0.24, 0.13, 0.08); run([523, 784, 1047], 'sine', 0.6, 0.06, 0); tone('sine', 1568, 1568, 0.5, 0.05, 0.34); }, // 升级
};

export const sfx = {
  names: Object.keys(SOUNDS),

  get enabled() {
    return enabled;
  },

  setEnabled(v) {
    enabled = !!v;
  },

  /** 音游开打：这期间不放界面音效。返回的函数用来放开（重复调用没关系）。 */
  hold() {
    holds++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      holds = Math.max(0, holds - 1);
    };
  },

  get held() {
    return holds > 0;
  },

  /** 播一个界面音效。返回这次有没有出声（关着、音游打着、名字不对都是 false）。 */
  play(name) {
    const fn = SOUNDS[name];
    if (!fn || !enabled || holds > 0) return false;
    if (audio.ready) fn();
    // 浏览器要先有一次点击才让出声：第一下通常就是在点击里调到这儿的，等它醒了再补上
    else audio.init().then((ok) => ok && enabled && !holds && fn());
    return true;
  },
};
