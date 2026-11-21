// 宣传片的音乐：一首原创的小曲，从开屏的律动（splash.js）长出来。D 大调，120 BPM，前奏三下心跳 + 30 小节。
// “一层层叠起来”：一声底鼓 → 四踩 → 镲、拍手 → 音游段的完整鼓组 → 贝斯（滤波器慢慢打开）→ 和弦铺底
//   → 啾啾登场、学舌、用它的叫声当采样 → 蓄力 → Drop → 收回开屏的律动，按 PLAY，啾啾唱声音标志，落一个 D 大三和弦。
// 这里只有“谱”（纯数据），怎么发声在 music.js，画面也从这里读鼓点、音符的时间，所以画面和声音一定对得上。
import { S, STEP, BAR } from './time.js';

// 前奏的心跳：底鼓由慢到快的三下（秒）。下一下就是第 1 小节第一拍（time.js 的 INTRO = 2）
export const HEART = [0.12, 0.92, 1.5];

// 和弦：D – A – Bm – G，第 7 小节（贝斯进来）是 D，之后四小节一圈
export const PROG = [
  { name: 'D', root: 38, pad: [62, 66, 69], deg: 1 },
  { name: 'A', root: 33, pad: [61, 64, 69], deg: 5 },
  { name: 'Bm', root: 35, pad: [62, 66, 71], deg: 6 },
  { name: 'G', root: 31, pad: [62, 67, 71], deg: 4 },
];
export const chordAt = (bar) => PROG[(((bar - 7) % 4) + 4) % 4];

// 旋律：四小节一句，从开屏那句（D F♯ A B A F♯ E）长出来。[第几格, MIDI, 几格长]
export const MEL = [
  [[0, 74, 2], [3, 78, 2], [6, 81, 2], [8, 83, 2], [10, 81, 2], [12, 78, 2], [14, 76, 2]], // D
  [[0, 76, 2], [3, 81, 2], [6, 83, 2], [8, 81, 2], [10, 76, 5]], // A
  [[0, 78, 2], [3, 83, 2], [6, 86, 2], [8, 88, 2], [10, 86, 2], [12, 83, 2], [14, 81, 2]], // Bm
  [[0, 83, 2], [3, 81, 2], [6, 78, 2], [8, 76, 3], [12, 74, 4]], // G
];

// 机器上的 7 个 Synth key：调 = D、音阶 = 大调时，键 1–7 是 D E F♯ G A B C♯
const DEG = { 0: 1, 2: 2, 4: 3, 5: 4, 7: 5, 9: 6, 11: 7 };
export const synthKey = (midi) => DEG[(((midi - 62) % 12) + 12) % 12] || 1;

// 贝斯的节奏型（一小节）：[第几格, 比根音高几个半音, 几格长]
const BASS_PAT = [[0, 0, 3], [3, 0, 1], [6, 12, 1], [8, 0, 2], [11, 0, 1], [14, 12, 1.6]];

/**
 * 整首谱。返回：
 *   events  发声的事件（按时间排好）：
 *     { t, type: 'drum', lane, vel }
 *     { t, type: 'note', midi, dur, voice, vel, bus, tweak? }
 *     { t, type: 'voice', call, opts }          啾啾叫一声（bird-voice.js）
 *     { t, type: 'auto', what, ... }            自动化：hp 高通扫频、riser 噪声上扬、duck 压一下
 *   drums   只有鼓（画面用）：{ t, lane, vel, bar, step }
 *   bass / lead / chords / calls   画面用的几条
 */
export function buildScore() {
  const ev = [];
  const drums = [];
  const bass = [];
  const lead = [];
  const chords = [];
  const calls = [];

  const drum = (bar, step, lane, vel = 1) => {
    const t = S(bar, step);
    ev.push({ t, type: 'drum', lane, vel });
    drums.push({ t, lane, vel, bar, step });
  };
  const note = (bar, step, midi, steps, voice, vel, bus = 'synth', extra = {}) => {
    const t = S(bar, step);
    const n = { t, type: 'note', midi, dur: steps * STEP, voice, vel, bus, ...extra };
    ev.push(n);
    return n;
  };
  const call = (bar, step, name, opts = {}) => {
    const t = S(bar, step);
    const c = { t, type: 'voice', call: name, opts };
    ev.push(c);
    calls.push(c);
  };
  const auto = (bar, step, what, more = {}) => ev.push({ t: S(bar, step), type: 'auto', what, ...more });
  const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);
  const four = (bar, vel = 1) => [0, 4, 8, 12].forEach((s) => drum(bar, s, 'KICK', vel));

  // 贝斯：一小节。cutoff = 滤波器（负数 = 低通，越接近 0 越亮；undefined = 全开）
  const bassBar = (bar, { vel = 0.62, cutoff, reso } = {}) => {
    const c = chordAt(bar);
    for (const [s, up, len] of BASS_PAT) {
      const tweak = cutoff === undefined ? null : { cutoff, reso: reso ?? 18 };
      note(bar, s, c.root + up, len, 'bass', vel, 'bass', tweak ? { tweak } : {});
      bass.push({ t: S(bar, s), dur: len * STEP, midi: c.root + up, key: synthKey(c.root + up), bar, step: s });
    }
  };
  const padBar = (bar, vel = 0.2, bus = 'pad') => {
    const c = chordAt(bar);
    for (const m of c.pad) note(bar, 0, m, 16, 'wide', vel, bus);
    chords.push({ t: S(bar, 0), dur: BAR, bar, ...c });
  };
  const melBar = (bar, phraseBar, voices) => {
    for (const [s, m, len] of MEL[phraseBar]) {
      for (const [voice, vel, shift = 0] of voices) note(bar, s, m + shift, len, voice, vel, 'lead');
      lead.push({ t: S(bar, s), dur: len * STEP, midi: m, key: synthKey(m), bar, step: s });
    }
  };

  // ── 前奏：三下心跳，只有底鼓（用户：开头除了鼓不要别的声音）。由慢到快（间隔 0.8 → 0.58 → 0.5 秒），第四下就是第 1 小节第一拍。
  //    鼓带一点房间混响，进了第 1 小节收回来。
  const raw = (t, e) => ev.push({ t, ...e });
  HEART.forEach((t, i) => {
    const vel = 0.8 + i * 0.08;
    raw(t, { type: 'drum', lane: 'KICK', vel });
    drums.push({ t, lane: 'KICK', vel, bar: 0, step: -1, heart: i });
  });
  raw(0, { type: 'auto', what: 'drumverb', to: 0.32 });
  auto(1, 0, 'drumverb', { to: 0.08 });

  // ── A 品牌（1–2）：第 1 小节第一拍亮出标志（镲），四踩；第 2 小节进反拍闭镲
  drum(1, 0, 'CRASH', 0.8);
  for (const bar of [1, 2]) {
    four(bar);
    if (bar === 2) [2, 6, 10, 14].forEach((s) => drum(bar, s, 'HAT1', 0.38));
  }

  // ── B 主角（3–4）：整台机器。鼓组叠满：四踩、反拍闭镲、拍手；末尾一个小过门
  for (const bar of [3, 4]) {
    four(bar);
    [2, 6, 10, 14].forEach((s) => drum(bar, s, 'HAT1', 0.4));
    [4, 12].forEach((s) => drum(bar, s, 'CLAP', 0.62));
  }
  [13, 14, 15].forEach((s, i) => drum(4, s, 'SNARE', 0.42 + i * 0.12));

  // ── C 音游（5–6）：完整的鼓组。音游里要打的就是 KICK / CLAP / HAT1 这三条
  for (const bar of [5, 6]) {
    four(bar);
    [4, 12].forEach((s) => drum(bar, s, 'CLAP', 0.66));
    [2, 6, 10, 14].forEach((s) => drum(bar, s, 'HAT1', 0.42));
    if (bar === 5) [3, 11].forEach((s) => drum(bar, s, 'PERC1', 0.22));
  }
  [8, 10, 12, 13, 14, 15].forEach((s, i) => drum(6, s, 'SNARE', 0.45 + i * 0.1));

  // ── D 真机镜像（7–8）：贝斯进来，滤波器从闷到亮
  drum(7, 0, 'CRASH', 0.55);
  for (const bar of [7, 8]) {
    four(bar);
    [4, 12].forEach((s) => drum(bar, s, 'CLAP', 0.6));
    [2, 6, 10, 14].forEach((s) => drum(bar, s, 'HAT1', 0.38));
    const k = bar - 7; // 0 → 1
    bassBar(bar, { cutoff: Math.round(-48 + k * 30), reso: 26 - k * 10 });
  }

  // ── E 乐理台（9–10）：和弦铺底，贝斯全开，闭镲换成开镲
  for (const bar of [9, 10]) {
    four(bar);
    [4, 12].forEach((s) => drum(bar, s, 'CLAP', 0.6));
    [2, 6, 10, 14].forEach((s) => drum(bar, s, 'HAT2', 0.26));
    bassBar(bar);
    padBar(bar, 0.2);
  }

  // ── F 啾啾·采样（11–16）
  for (const bar of range(11, 17)) {
    four(bar, 0.95);
    [4, 12].forEach((s) => drum(bar, s, 'CLAP', 0.58));
    [2, 6, 10, 14].forEach((s) => drum(bar, s, 'HAT1', 0.36));
    bassBar(bar, { vel: 0.56 });
    padBar(bar, 0.15);
  }
  call(11, 0, 'greet'); // “早，啾！”
  call(12, 8, 'look'); // 飞到键上：“看这儿”
  // 学舌：你弹四个音（前两拍），啾啾学回来（后两拍）
  const ECHO = [[74, 78, 81, 83], [83, 81, 78, 74]];
  ECHO.forEach((ms, i) => {
    const bar = 13 + i;
    ms.forEach((m, j) => {
      note(bar, j * 2, m, 1.6, 'pluck', 0.5, 'lead');
      lead.push({ t: S(bar, j * 2), dur: 1.6 * STEP, midi: m, key: synthKey(m), bar, step: j * 2, echo: 'you' });
    });
    call(bar, 8, 'echo', { notes: ms.map((m, j) => [j * 0.25, m, 0.2]) });
  });
  // 采样：一边弹旋律，一边用啾啾的叫声当音色高八度叠上去
  [15, 16].forEach((bar, i) => {
    melBar(bar, i, [['pluck', 0.42]]);
    call(bar, 0, 'echo', { notes: MEL[i].map(([s, m, len]) => [s * STEP, m + 12, Math.min(0.3, len * STEP)]) });
  });

  // ── G 蓄力（17–18）：军鼓越来越密，整首往上扫（高通），最后一拍全停，啾啾“咦！”
  four(17, 0.9);
  [0, 4, 8].forEach((s) => drum(18, s, 'KICK', 0.85));
  range(0, 8).forEach((i) => drum(17, i * 2, 'SNARE', 0.26 + i * 0.03));
  range(0, 12).forEach((s) => drum(18, s, 'SNARE', 0.5 + s * 0.045));
  for (const bar of [17, 18]) {
    const c = chordAt(bar);
    range(0, bar === 17 ? 8 : 6).forEach((i) => {
      note(bar, i * 2, c.root, 1.5, 'bass', 0.5, 'bass');
      bass.push({ t: S(bar, i * 2), dur: 1.5 * STEP, midi: c.root, key: synthKey(c.root), bar, step: i * 2 });
    });
    for (const m of c.pad) note(bar, 0, m, bar === 17 ? 16 : 12, 'wide', 0.17, 'pad');
    chords.push({ t: S(bar, 0), dur: BAR, bar, ...c });
  }
  auto(17, 0, 'hp', { from: 30, to: 1400, dur: BAR * 2 - STEP * 4 });
  auto(17, 0, 'riser', { dur: BAR * 2 - STEP * 4 });
  call(18, 12, 'surprised');
  auto(19, 0, 'hp', { from: 20, to: 20, dur: 0.01 });

  // ── H Drop（19–26）：全部一起。旋律两遍；每两小节的末尾啾啾接一句
  for (const bar of range(19, 27)) {
    four(bar);
    [4, 12].forEach((s) => drum(bar, s, 'CLAP', 0.7));
    [2, 6, 10, 14].forEach((s) => drum(bar, s, 'HAT2', 0.3));
    [1, 3, 5, 7, 9, 11, 13, 15].forEach((s) => drum(bar, s, 'HAT1', 0.15));
    bassBar(bar, { vel: 0.64 });
    padBar(bar, 0.12, 'pad');
    const c = chordAt(bar);
    [2, 6, 10, 14].forEach((s) => c.pad.forEach((m) => note(bar, s, m + 12, 0.9, 'keys', 0.22, 'stab')));
    melBar(bar, (bar - 19) % 4, [['supersaw', 0.24], ['pluck', 0.3, 12]]);
    for (const s of [0, 4, 8, 12]) auto(bar, s, 'duck');
  }
  drum(19, 0, 'CRASH', 0.8);
  drum(23, 0, 'CRASH', 0.75);
  call(20, 12, 'ok');
  call(22, 13, 'look');
  call(24, 12, 'ok');
  [12, 13, 14, 15].forEach((s, i) => drum(26, s, 'SNARE', 0.55 + i * 0.12));

  // ── I 收尾（27–30）：收回开屏的律动 → 按 PLAY → 一小节“进入”，第三拍啾啾唱声音标志 → D 大三和弦
  const SPL_BASS = { 0: [38, 2.8], 7: [38, 0.8], 10: [45, 1.6], 14: [43, 1] };
  const SPL_LEAD = { 0: 74, 3: 78, 6: 81, 8: 83, 10: 81, 12: 78, 14: 76 };
  for (const bar of [27, 28]) {
    four(bar, 0.92);
    [2, 6, 10, 14].forEach((s) => drum(bar, s, 'HAT1', 0.36));
    if (bar === 28) [4, 12].forEach((s) => drum(bar, s, 'CLAP', 0.55));
    for (const [s, [m, len]] of Object.entries(SPL_BASS)) {
      note(bar, Number(s), m, len, 'bass', 0.5, 'bass');
      bass.push({ t: S(bar, Number(s)), dur: len * STEP, midi: m, key: synthKey(m), bar, step: Number(s) });
    }
    if (bar === 27) for (const [s, m] of Object.entries(SPL_LEAD)) {
      note(bar, Number(s), m, 1.6, 'pluck', 0.45, 'lead');
      lead.push({ t: S(bar, Number(s)), dur: 1.6 * STEP, midi: m, key: synthKey(m), bar, step: Number(s) });
    }
  }
  drum(27, 0, 'CRASH', 0.45);
  // “进入”：四下底鼓、拍手，第三拍唱声音标志
  four(29, 0.95);
  [4, 12].forEach((s) => drum(29, s, 'CLAP', 0.6));
  call(29, 8, 'logo');
  // 落一个 D 大三和弦
  drum(30, 0, 'KICK', 1);
  drum(30, 0, 'CRASH', 0.5);
  for (const m of [50, 62, 66, 69, 74]) note(30, 0, m, 30, 'wide', 0.24, 'pad');
  note(30, 0, 38, 12, 'bass', 0.5, 'bass');
  note(30, 0, 26, 24, 'sub', 0.5, 'bass');

  ev.sort((a, b) => a.t - b.t);
  drums.sort((a, b) => a.t - b.t);
  bass.sort((a, b) => a.t - b.t);
  lead.sort((a, b) => a.t - b.t);
  return { events: ev, drums, bass, lead, chords, calls };
}

export const SCORE = buildScore();
