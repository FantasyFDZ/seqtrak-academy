// “让机器替你弹一段”（第 4 章用）：接着真机时，应用把一小段循环的音符从 USB 发给机器的某条合成器轨，
// 声音是机器自己用它现在的音色发出来的——你一边听，一边拧右边那 4 个旋钮，马上就听得到变化。
// 为什么要它：第 4 章的课是拿第 3 章那段循环（4 号工程）来练的，没学过第 3 章的话工程里没有音符，拧了也听不见。
//
// 发的音和你在 Synth keys 上按出来的一样：按机器现在的音阶、调、这条轨道的八度算（读数来自真机镜像）。
// 弹法在 CHORD 上时只发根音（一个音进去机器会不会自己变成和弦，还没确认；只发根音的话，最坏也就是单音）。
// 规矩：机器在录音时不弹（免得把音录进去）；离开这一步、页面被切到后台、点“停”、弹满 3 分钟，都会停，并把音收干净。
import { h, rich, clamp } from './util.js';
import { midi } from './midi.js';
import { mirror } from './mirror.js';
import { TRACK } from './tracks.js';
import { synthKeyNote, chordNotes } from './scales.js';

// 一小节的样子：[第几步, 第几个 Synth key, 持续几步]
const RIFFS = {
  SYNTH1: { say: '贝斯', steps: [[0, 1, 2], [3, 1, 1], [6, 3, 2], [8, 1, 2], [11, 5, 1], [14, 7, 2]] },
  SYNTH2: { say: '和弦', steps: [[0, 1, 7], [8, 6, 7]] },
  DX: { say: '旋律', steps: [[0, 1, 2], [2, 3, 2], [4, 5, 3], [8, 4, 2], [10, 3, 2], [12, 1, 3]] },
};
const LIMIT_MS = 3 * 60 * 1000;

let active = null; // 同一时间只弹一段

function stopActive() {
  active?.stop();
}

/** 现在按机器的设置，第 n 个 Synth key 在这条轨道上该发哪几个音 */
function notesFor(track, n) {
  const p = TRACK[track].ch - 1; // 轨道号 = 通道 − 1
  const opts = { scale: mirror.v.get('scale') ?? 0, key: mirror.v.get('key') ?? 0, octave: mirror.v.get(`oct:${p}`) ?? 0 };
  const poly = mirror.polyOf(track);
  if (track === 'SYNTH2' && poly === 1) return chordNotes(n, opts).slice(0, 3); // 复音：自己叠三个音
  return [synthKeyNote(n, opts)]; // 单音、和弦弹法（交给机器自己）
}

function startRiff(track, onState) {
  stopActive();
  const riff = RIFFS[track] || RIFFS.SYNTH1;
  const ch = TRACK[track].ch;
  const sounding = new Map(); // 音符号 → 什么时候松开
  const t0 = performance.now() + 80;
  const bpm = clamp(mirror.v.get('tempo') || 100, 70, 140);
  const stepMs = 60000 / bpm / 4;
  let next = 0; // 下一个要排的是第几步（从开始算）
  const tick = () => {
    if (!midi.output) return stop();
    const until = performance.now() + 140;
    while (t0 + next * stepMs < until) {
      const at = t0 + next * stepMs;
      for (const [s, key, len] of riff.steps) {
        if (s !== next % 16) continue;
        for (const n of notesFor(track, key)) {
          midi.noteOn(ch, n, 96, at);
          const off = at + len * stepMs * 0.92;
          midi.noteOff(ch, n, off);
          sounding.set(n, off);
        }
      }
      next++;
    }
    if (performance.now() - t0 > LIMIT_MS) stop();
  };
  const timer = setInterval(tick, 30);
  const onHide = () => document.hidden && stop();
  document.addEventListener('visibilitychange', onHide);
  let stopped = false;
  function stop() {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onHide);
    // 已经排出去、还没松开的音：再补一个松开，最后来一条“全部松开”（CC 123，官方 CC 表：接收）
    const now = performance.now();
    for (const n of sounding.keys()) midi.noteOff(ch, n, now);
    midi.cc(ch, 123, 0, now + 5);
    if (active?.stop === stop) active = null;
    onState(false);
  }
  tick();
  active = { stop, track };
  onState(true);
  return stop;
}

/**
 * 课文块 { riff: 'SYNTH1' | 'SYNTH2' | 'DX', label }：一个按钮，点了让机器弹这一段，再点停。没接真机时不显示。
 * 离开这一步时（cleanup）自动停。
 */
export function riffBlock(b, cleanup) {
  if (!midi.connected) return null;
  const track = b.riff in RIFFS ? b.riff : 'SYNTH1';
  const label = TRACK[track].label;
  const btn = h('button', { class: 'btn sm', type: 'button' });
  const note = h('span', { class: 'muted small' });
  let stop = null;
  const paint = (on) => {
    btn.textContent = on ? `■ 停（机器正在弹 ${label} 的${RIFFS[track].say}）` : (b.label || `▶ 让机器替你弹一段（${label} 的${RIFFS[track].say}）`);
    btn.classList.toggle('primary', on);
  };
  btn.addEventListener('click', () => {
    if (stop) {
      stop();
      return;
    }
    if (mirror.v.get('recording')) {
      note.innerHTML = rich('机器现在在**录音**：先按录音键停下来，免得这几个音被录进去。');
      return;
    }
    note.textContent = '';
    stop = startRiff(track, (on) => {
      paint(on);
      if (!on) stop = null;
    });
  });
  paint(false);
  cleanup.push(() => stop?.());
  return h('p', { class: 'riff-row' }, btn, ' ', note);
}

export { stopActive as stopRiff };
