// 宣传片的时间：全片 120 BPM（和开屏、和“没连真机时”的应用一样），一小节 2 秒，一格（十六分音符）0.125 秒。
// 画面和音乐都从这里取时间，所以永远卡在拍子上。小节、拍都从 1 数（和乐谱一样），格从 0 数。

export const BPM = 120;
export const BEAT = 60 / BPM; // 0.5 秒
export const STEP = BEAT / 4; // 0.125 秒
export const BAR = BEAT * 4; // 2 秒
export const BARS = 30;
export const TAIL = 2.5; // 最后一小节之后留给和弦的尾巴、片尾署名
// 前奏：第 1 小节之前三下“心跳”——底鼓由慢到快，第四下正好是第 1 小节第一拍（用户 2026-11-21：开头要有冲击力、节奏由慢到快；
// 第二版之后又说前面的鼓太长、拖沓，开头除了鼓不要别的声音，所以从五下 4.8 秒缩成三下 2 秒）。
// 前奏不在小节网格上，所以 at() / S() 都从它后面算起。
export const INTRO = 2;
export const DURATION = INTRO + BARS * BAR + TAIL; // 64.5 秒
export const FPS = 60;

/** 第 bar 小节第 beat 拍再往后 step 格，是第几秒 */
export const at = (bar, beat = 1, step = 0) => INTRO + (bar - 1) * BAR + (beat - 1) * BEAT + step * STEP;
/** 第 bar 小节的第 step 格（0–15） */
export const S = (bar, step = 0) => INTRO + (bar - 1) * BAR + step * STEP;
/** 这一刻在第几小节（从 1 数，带小数；前奏里是负的） */
export const barAt = (t) => (t - INTRO) / BAR + 1;
/** 这一刻是这一小节的第几格（0–15） */
export const stepIn = (t) => Math.floor((((t - INTRO) % BAR) + BAR) % BAR / STEP + 1e-6) % 16;

// 每一段：第几小节到第几小节（不含 to）。和分镜一一对应。
// 第三版（用户 2026-11-21）：前半段观众不知道片子在讲什么、鼓太长——改成先亮品牌，主角镜头一下交代“为 SEQTRAK 打造”，
// 三个功能各 2 小节；鼓 → 贝斯 → 和弦 → 旋律的递进和后半段（F–I）照旧，只是整体往前挪了 8 小节。
export const SECTIONS = [
  { id: 'A', name: '品牌', from: 1, to: 3 },
  { id: 'B', name: '主角', from: 3, to: 5 },
  { id: 'C', name: '音游', from: 5, to: 7 },
  { id: 'D', name: '真机镜像', from: 7, to: 9 },
  { id: 'E', name: '乐理', from: 9, to: 11 },
  { id: 'F', name: '啾啾·采样', from: 11, to: 17 },
  { id: 'G', name: '蓄力', from: 17, to: 19 },
  { id: 'H', name: 'Drop', from: 19, to: 27 },
  { id: 'I', name: '收尾', from: 27, to: 31 },
].map((s) => ({ ...s, t0: s.id === 'A' ? 0 : at(s.from), t1: s.id === 'I' ? DURATION : at(s.to) }));

// ───────────── 缓动 ─────────────
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, k) => a + (b - a) * k;
/** t 在 a→b 之间走了多少（0–1，夹住） */
export const prog = (t, a, b) => clamp((t - a) / (b - a));
export const ease = {
  linear: (x) => x,
  inQuad: (x) => x * x,
  outQuad: (x) => 1 - (1 - x) * (1 - x),
  inCubic: (x) => x * x * x,
  outCubic: (x) => 1 - (1 - x) ** 3,
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2),
  outQuart: (x) => 1 - (1 - x) ** 4,
  outExpo: (x) => (x >= 1 ? 1 : 1 - 2 ** (-10 * x)),
  inExpo: (x) => (x <= 0 ? 0 : 2 ** (10 * x - 10)),
  inOutExpo: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 2 ** (20 * x - 10) / 2 : (2 - 2 ** (-20 * x + 10)) / 2),
  outBack: (x, s = 1.70158) => 1 + (s + 1) * (x - 1) ** 3 + s * (x - 1) ** 2,
  outElastic: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 2 ** (-10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};
/** 一下“砰”然后衰减：t0 时为 1，过 len 秒衰减到接近 0（拿来做打击的闪光、缩放） */
export const pulse = (t, t0, len = 0.25) => (t < t0 ? 0 : Math.exp(-(t - t0) / (len / 4)));
/** 最近一次（≤ t）的事件时间；没有返回 -Infinity。list 要按时间排好 */
export function lastAt(list, t, key = (x) => x) {
  let lo = 0;
  let hi = list.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (key(list[mid]) <= t) {
      best = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return best;
}
