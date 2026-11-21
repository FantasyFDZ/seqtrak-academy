// I 收尾（第 35–38 小节，68 秒到最后）：照着应用的开屏（splash.js）收——
//   35–36  一排 16 个步进键跟着播放线一格一格跳，每拍第一格亮成桔红；下面一颗 PLAY 键跟着拍子闪
//   36 第 4 拍  PLAY 被按下（绿灯、荡开一圈）
//   37     标志的四根条从中间长出来；啾啾飞进来落在最高那根条上，第三拍唱它的声音标志：“早，啾！”
//   38     D 大三和弦落下：片名和标语从中间往两边展开；之后标志跟着拍子蹦，啾啾跟着点头
import { h, put, setVar, toggle } from '../engine.js';
import { at, BEAT, STEP, DURATION, ease, prog, lerp, clamp, pulse } from '../time.js';

const K = 2.2; // 标志放大多少倍（应用里四根条是 16 像素宽）
const BARS = [47, 104, 66, 85];
const BW = 16 * K;
const GAP = 10 * K;
const LOGO_W = 4 * BW + 3 * GAP;
const LOGO_X = 960 - LOGO_W / 2;
const LOGO_BOTTOM = 490; // 往下放一点：啾啾落在最高那根条上时，它头顶的气泡不会顶出画面（用户 2026-11-21 指出被切了）

export function endScene(engine) {
  const T0 = at(27);
  const T1 = DURATION + 1;
  const PRESS = at(28, 4);
  const RISE = at(29);
  const TITLE = at(30);

  const keys = Array.from({ length: 16 }, (_, i) => h('span', { class: ['en-key', i % 4 === 0 && 'beat'] }, h('i')));
  const steps = h('div', { class: 'en-steps' }, keys);
  const cap = h('div', { class: 'en-cap' }, h('i', { class: 'en-led' }),
    h('svg', { class: 'en-glyph', viewBox: '0 0 32 14', html: '<path d="M8 2.2v4.6M5.2 4a4.5 4.5 0 1 0 5.6 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><line x1="16.5" y1="3" x2="15" y2="11" stroke="currentColor" stroke-width="1.2" opacity=".45" stroke-linecap="round"/><path d="M20.5 3.2l7 3.8-7 3.8z" fill="currentColor"/>' }),
    h('span', { class: 'en-wave' }));
  const play = h('div', { class: 'en-play' }, h('small', {}, '⏻ / PLAY'), cap, h('b', { class: 'en-hint' }, '按 PLAY'));
  const bars = BARS.map((hh, i) => h('i', { class: `en-bar en-bar${i + 1}`, style: { left: `${LOGO_X + i * (BW + GAP)}px`, top: `${LOGO_BOTTOM - hh * K}px`, height: `${hh * K}px`, width: `${BW}px` } }));
  const title = h('h1', { class: 'en-title' }, 'SEQTRAK ', h('b', {}, 'Academy'));
  const slogan = h('p', { class: 'en-slogan' }, '按下 ', h('b', {}, 'PLAY'), '，玩出第一首歌'); // 用户 2026-11-21 定的（原来的“从一声‘咚’，到一首歌”开头改版后接不上了）
  const el = h('div', { class: 's-end' }, bars, title, slogan, steps, play);

  // 啾啾落在最高那根条（第 2 根）上
  engine.spots.logo = () => [LOGO_X + BW + GAP + BW / 2, LOGO_BOTTOM - BARS[1] * K];

  function update(t) {
    // 步进键：进场、播放线、每拍第一格亮
    const formed = ease.inOutCubic(prog(t, RISE, RISE + 0.6));
    put(steps, { y: lerp(0, 340, formed), s: lerp(1, 0.8, formed), o: lerp(1, 0.35, formed) * (1 - prog(t, TITLE + 1, TITLE + 2) * 0.6) });
    const step = Math.floor((t - T0) / STEP + 1e-6) % 16;
    keys.forEach((k, i) => {
      const ap = T0 + i * 0.03;
      const ka = ease.outBack(prog(t, ap - 0.05, ap + 0.25), 2);
      put(k, { y: lerp(16, 0, ka), o: clamp(ka * 1.6) });
      const now = step === i && t < TITLE + 2;
      toggle(k, 'now', now);
      const hitT = T0 + Math.floor((t - T0) / (BEAT * 4)) * BEAT * 4 + i * STEP;
      toggle(k, 'lit', i % 4 === 0 && t >= T0 + i * STEP);
      setVar(k, '--hit', i % 4 === 0 && step >= i ? pulse(t, hitT, 0.3).toFixed(3) : '0');
    });
    // PLAY：跟着拍子闪，按下去
    const pressed = t >= PRESS;
    toggle(cap, 'down', pressed);
    const beatK = 1 - (((t - T0) / BEAT) % 1);
    setVar(cap, '--blink', pressed ? '1' : (0.35 + 0.65 * beatK ** 2).toFixed(3));
    const wave = prog(t, PRESS, PRESS + 0.65);
    const wv = cap.querySelector('.en-wave');
    put(wv, { s: lerp(1, 1.6, ease.outCubic(wave)), o: pressed ? 1 - wave : 0 });
    const kp = ease.outCubic(prog(t, T0 + 0.3, T0 + 0.8));
    const gone = ease.inCubic(prog(t, RISE + 0.1, RISE + 0.5));
    put(play, { y: lerp(30, 0, kp) + gone * 40, o: kp * (1 - gone) });

    // 标志：中间两根先长，两边两根跟上；长过头一点再回落。之后每拍蹦一下
    bars.forEach((b, i) => {
      const d = i === 1 || i === 2 ? 0 : 0.12;
      const k = prog(t, RISE + d, RISE + d + 0.7);
      let sy = k < 0.62 ? 1.12 * ease.outCubic(k / 0.62) : lerp(1.12, 1, ease.inOutCubic((k - 0.62) / 0.38));
      if (t >= TITLE) {
        const lb = TITLE + Math.floor((t - TITLE) / BEAT) * BEAT + i * 0.022;
        const a = t >= lb ? (t - lb) / 0.34 : 9;
        if (a < 1) sy *= 1 + (0.14 + i * 0.05) * (a < 0.25 ? a / 0.25 : 1 - (a - 0.25) / 0.75);
      }
      put(b, { sy, sx: 1, o: k > 0 ? 1 : 0 });
    });
    // 片名、标语：从中间往两边展开（字距从大收到正常，模糊变清楚）
    const kt = ease.outCubic(prog(t, TITLE, TITLE + 0.62));
    const ks = ease.outCubic(prog(t, TITLE + 0.12, TITLE + 0.74));
    setVar(title, '--k', kt.toFixed(3));
    setVar(slogan, '--k', ks.toFixed(3));
    put(title, { o: kt, sx: lerp(0.7, 1, kt), sy: 1 });
    put(slogan, { o: ks, sx: lerp(0.7, 1, ks), sy: 1 });
  }

  return { id: 'I', t0: T0, t1: T1, el, update };
}
