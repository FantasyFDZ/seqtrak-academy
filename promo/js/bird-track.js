// 啾啾在整部片子里的“走位”。场景里需要它飞到某个键上的，在这里用函数取那个键的位置（第一次用到时才量）。
// 格式见 engine.js 的 createBird2。
import { at, DURATION } from './time.js';
import { SCORE } from './score.js';

export function BIRD_TRACK(engine) {
  const spot = (name) => () => engine.spots?.[name]?.() || [960, 500];
  return {
    size: 190,
    spawn: [2140, 260],
    show: [
      [at(11) - 0.6, at(17)], // F
      [at(18, 4) - 0.05, at(19)], // G 最后一拍的空白：“咦！”
      [at(20, 4) - 0.35, at(21) + 0.5], [at(22, 4) - 0.35, at(23) + 0.5], [at(24, 4) - 0.35, at(25) + 0.5], // Drop 里穿过画面
      [at(28, 4), DURATION + 1], // I
    ],
    moves: [
      // F：从右上飞进来，在画面中间偏右悬停打招呼
      { t: at(11) - 0.6, dur: 1.5, to: [1320, 400], end: 'hover', arc: 60 },
      // 飞到机器的 Synth key 5 上方，指着它
      { t: at(12, 2), dur: 0.9, to: spot('sk5'), end: 'hover', arc: 90 },
      // 学舌：落到机器上沿站着唱
      { t: at(13, 3) - 0.5, dur: 0.6, to: spot('perch'), end: 'land', arc: 70 },
      // 采样：跳到采样台上面
      { t: at(15) - 0.4, dur: 0.7, to: spot('sampler'), end: 'land', arc: 120 },
      // 飞出画面
      { t: at(16, 4), dur: 0.5, to: [2200, 120], end: 'hover', arc: 40 },
      // G：最后一拍的空白里，正中间“咦！”
      { t: at(18, 4) - 0.06, dur: 0, to: [960, 640], end: 'land' },
      // Drop：三次穿过画面，各叫一声
      { t: at(20, 4) - 0.36, dur: 0, to: [-220, 780], end: 'hover' },
      { t: at(20, 4) - 0.35, dur: 1.3, to: [2160, 360], end: 'hover', arc: 200, ease: (x) => x },
      { t: at(22, 4) - 0.36, dur: 0, to: [2160, 840], end: 'hover' },
      { t: at(22, 4) - 0.35, dur: 1.3, to: [-220, 320], end: 'hover', arc: 200, ease: (x) => x },
      { t: at(24, 4) - 0.36, dur: 0, to: [-220, 300], end: 'hover' },
      { t: at(24, 4) - 0.35, dur: 1.3, to: [2160, 720], end: 'hover', arc: 120, ease: (x) => x },
      // I：按下 PLAY 之后飞进来，落在标志最高那根条上
      { t: at(28, 4) - 0.01, dur: 0, to: [2160, 200], end: 'hover' },
      { t: at(28, 4), dur: 0.75, to: [1260, 300], end: 'hover', arc: 60 },
      { t: at(29) + 0.15, dur: 0.8, to: spot('logo'), end: 'land', arc: 120 },
    ],
    sizes: [[at(13, 3) - 0.5, 170], [at(15) - 0.4, 180], [at(18, 4) - 0.5, 230], [at(20, 4) - 0.6, 170], [at(28, 4) - 0.5, 150], [at(29) + 0.15, 120]],
    moods: [[0, 'happy'], [at(12, 2), 'talk'], [at(13), 'listen'], [at(13, 3), 'happy'], [at(15), 'idle'], [at(18, 4) - 0.1, 'surprised'], [at(19), 'cheer'], [at(28, 4), 'happy'], [at(29, 3), 'cheer'], [at(30, 2), 'idle']],
    grooves: [[at(15) + 0.3, at(16, 4)], [at(30, 2), DURATION + 1]],
    acts: [[at(11, 2), 'flap'], [at(12, 3), 'peck'], [at(14, 4), 'flip'], [at(30, 1), 'hop']],
    // 张嘴、飘音符：和 score.js 里排的叫声一一对应（声音在 music.js 里另排，这里不出声）
    sings: SCORE.calls.map((c) => [c.t, c.call, c.opts]),
    says: [
      [at(11) + 0.1, at(12, 2) - 0.1, '早，啾！'],
      [at(12, 3), at(13, 2), '这个键是干嘛的？问我，啾。'],
      [at(13, 3), at(14) - 0.05, '学你的，啾！', 'left'],
      [at(14, 3), at(15) - 0.1, '再来，啾！', 'left'],
      [at(18, 4), at(19) - 0.03, '咦！'],
      [at(29, 3), at(30) - 0.1, '早，啾！'],
    ],
  };
}
