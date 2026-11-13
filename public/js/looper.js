// 循环播放器：把节奏串和音符表按速度循环播放。课程里的小部件和“听一听目标”都用它。
import { audio, nameToMidi } from './audio.js';
import { sound } from './sound.js';
import { cleanPattern } from './chart.js';

export class LoopPlayer {
  #timer = null;
  #raf = 0;
  #queue = []; // 已经排进音频时钟的步：{ step, time }
  #stepCb = null;
  // 开始播放时记下两个时钟。音频时钟要是一直不走（无界面的浏览器里就是这样；声音被系统挂起时也会），
  // 过了 0.4 秒就改用页面时钟往下数步：声音排不进去（反正也出不来），但灯、步、“到下一小节再换”照常走
  #clock = null;

  constructor({ bpm = 100, steps = 16, swing = 0, click = false } = {}) {
    this.bpm = bpm;
    this.steps = steps;
    this.swing = swing;
    this.click = click;
    this.tracks = {};
    this.notes = [];
    this.voice = 'bass';
    this.playing = false;
  }

  /**
   * tracks: { KICK: 'x---…' }；notes: [[步, 音名或音符号, 持续几步, 音色?, 力度?]]
   * 音色和力度可以不写（用 voice 和默认力度）。贝斯上面叠和弦时，和弦的那几个音各自写上音色（见 scales.js 的 chordAt）。
   * 循环比节奏串长（steps = 32 而节奏串只有 16 格）时，节奏串会自己重复。
   */
  set(tracks = {}, notes = [], voice = 'bass') {
    this.tracks = Object.fromEntries(Object.entries(tracks).map(([k, v]) => [k, cleanPattern(v)]));
    this.notes = notes.map(([step, n, len = 1, v, vel]) => ({ step, midi: typeof n === 'number' ? n : nameToMidi(n), len, voice: v, vel }));
    this.voice = voice;
    return this;
  }

  onStep(cb) {
    this.#stepCb = cb;
    return this;
  }

  #now() {
    const a = audio.now();
    const c = this.#clock;
    if (!c) return a;
    if (c.frozen) {
      const virt = c.audio + (performance.now() - c.perf) / 1000;
      // 后来声音起来了（音频时钟真的在走）：换回音频时钟，排好的下一步跟着挪过去
      if (audio.ready && a > c.audio + 0.05) {
        this.nextTime += a - virt;
        for (const q of this.#queue) q.time += a - virt;
        c.frozen = false;
        return a;
      }
      return virt;
    }
    if (a - c.audio < 0.005 && performance.now() - c.perf > 400) c.frozen = true;
    return c.frozen ? c.audio + (performance.now() - c.perf) / 1000 : a;
  }

  #stepSeconds(step) {
    const beat = 60 / this.bpm;
    return beat * 0.25 * (step % 2 === 0 ? 1 + this.swing : 1 - this.swing);
  }

  async start() {
    if (this.playing) return;
    this.playing = true;
    // 没有用户手势时（无界面的浏览器）让音频恢复的那一步可能一直不回来：最多等 0.4 秒，等不到就当声音没起来，下面改用页面时钟
    const ok = await Promise.race([audio.init(), new Promise((r) => setTimeout(() => r(false), 400))]);
    if (!this.playing) return; // 等待期间已经被停掉了
    if (!ok && !audio.ctx) {
      this.playing = false;
      return;
    }
    this.nextStep = 0;
    // 声音起不来（浏览器还没让出声、无界面的浏览器）：照样按页面时钟往下走——灯和步、“到下一小节再换”都不停，只是没声音（各个音色在音频没开时什么都不做）
    this.#clock = { perf: performance.now(), audio: audio.now(), frozen: !ok };
    this.nextTime = audio.now() + 0.08;
    this.#queue = [];
    this.#timer = setInterval(() => this.#pump(), 25);
    this.#pump();
    const frame = () => {
      if (!this.playing) return;
      const now = this.#clock?.frozen ? this.#now() : audio.heardNow();
      let current = null;
      while (this.#queue.length && this.#queue[0].time <= now) current = this.#queue.shift();
      if (current) this.#stepCb?.(current.step);
      this.#raf = requestAnimationFrame(frame);
    };
    this.#raf = requestAnimationFrame(frame);
  }

  #pump() {
    while (this.nextTime < this.#now() + 0.12) {
      const step = this.nextStep % this.steps;
      const t = this.nextTime;
      this.onSchedule?.(step, t); // 调用方可以在这里按精确时间排自己的声音（模拟机用）
      if (this.click && step % 4 === 0) sound.click(t, step === 0);
      for (const [track, pattern] of Object.entries(this.tracks)) {
        const c = pattern[step % (pattern.length || 1)];
        if (c === 'x' || c === 'X') sound.drum(track, t, c === 'X' ? 1 : 0.85);
      }
      for (const n of this.notes) {
        if (n.step === step) sound.note(n.midi, t, n.len * (60 / this.bpm) * 0.25 * 0.92, n.voice || this.voice, n.vel ?? 0.85);
      }
      this.#queue.push({ step, time: t });
      this.nextTime += this.#stepSeconds(step);
      this.nextStep++;
    }
  }

  stop() {
    this.playing = false;
    clearInterval(this.#timer);
    cancelAnimationFrame(this.#raf);
    this.#stepCb?.(-1);
  }

  toggle() {
    if (this.playing) this.stop();
    else this.start();
    return this.playing;
  }
}
