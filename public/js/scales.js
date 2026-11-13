// SEQTRAK 出厂的 8 个音阶（官方 Data List p.133–134 的默认值，以 C3 = 60 为根音）。
// 7 个 Synth keys 依次对应表里的 7 个音；再加上 KEY（移调）和 OCTAVE（八度）就是实际发出的音。
// 音阶可以在官方 App 里改，所以这是“默认值”，不保证和机器里的一致。

export const SCALES = [
  { id: 0, name: 'MINOR', zh: '小调', offsets: [0, 2, 3, 5, 7, 8, 10], mood: '偏暗、带点忧郁，电子音乐里最常用' },
  { id: 1, name: 'MAJOR', zh: '大调', offsets: [0, 2, 4, 5, 7, 9, 11], mood: '明亮、开朗' },
  { id: 2, name: 'MINOR PENTATONIC', zh: '小调五声', offsets: [0, 3, 5, 7, 10, 12, 15], mood: '只有 5 个音，怎么按都不难听；蓝调、摇滚、Hip-hop 的味道' },
  { id: 3, name: 'MAJOR PENTATONIC', zh: '大调五声', offsets: [0, 2, 4, 7, 9, 12, 14], mood: '同样是 5 个音，明亮版；很多中国风旋律就是它' },
  { id: 4, name: 'LYDIAN', zh: 'Lydian', offsets: [0, 2, 4, 6, 7, 9, 11], mood: '大调里升高一个音，梦幻、漂浮' },
  { id: 5, name: 'DORIAN', zh: 'Dorian', offsets: [0, 2, 3, 5, 7, 9, 10], mood: '小调里亮一点的那种，House 和 Funk 爱用' },
  { id: 6, name: 'MIXOLYDIAN', zh: 'Mixolydian', offsets: [0, 2, 4, 5, 7, 9, 10], mood: '大调里带点“痞”，放克、蓝调摇滚' },
  { id: 7, name: 'PHRYGIAN', zh: 'Phrygian', offsets: [0, 1, 3, 5, 7, 8, 10], mood: '很暗，有点异域和紧张感，Techno 里常见' },
];

export const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** 第 degree 个 Synth key（1–7）在给定音阶 / 调 / 八度下的 MIDI 音符号。 */
export function synthKeyNote(degree, { scale = 0, key = 0, octave = 0 } = {}) {
  const s = SCALES[scale] || SCALES[0];
  return 60 + s.offsets[(degree - 1) % 7] + key + 12 * octave;
}

/** 7 个 Synth keys 的音符号。 */
export function synthKeyNotes(opts) {
  return [1, 2, 3, 4, 5, 6, 7].map((d) => synthKeyNote(d, opts));
}

// ───────────── 和弦（MONO / POLY / CHORD 里的 CHORD） ─────────────

/** 一条合成器轨的三种“弹法”，编号就是机器里存的值（31 1p 23）和 CC 26 的值。 */
export const POLY_MODES = [
  { id: 0, name: 'MONO', zh: '单音', what: '一次只出一个音，按下一个，上一个就断' },
  { id: 1, name: 'POLY', zh: '复音', what: '可以同时出好几个音' },
  { id: 2, name: 'CHORD', zh: '和弦', what: '一个键就是一整个和弦' },
];

const MINOR_CHORDS = [[60, 63, 67, 70], [62, 65, 68, 72], [63, 67, 70, 74], [65, 68, 72, 75], [67, 70, 74, 77], [68, 72, 75, 79], [70, 74, 77, 80]];
const MAJOR_CHORDS = [[60, 64, 67, 71], [62, 65, 69, 72], [64, 67, 71, 74], [65, 69, 72, 76], [67, 71, 74, 77], [69, 72, 76, 79], [71, 74, 77, 81]];

/**
 * CHORD 状态下，7 个 Synth keys 各弹出哪几个音（以 C3 = 60 为基准，还没算 KEY 和 OCTAVE）。每个音阶一行，每个键最多 4 个音。
 * 这是出厂值：官方 Data List p.136–137；2026-11-10 在用户这台机器（V2.00）上只读查询 30 6p xx / 30 7p xx，
 * 三条合成器轨读到的都和这张表一样（tools/probe-chords.py）。和弦可以在机器上或官方 App 里改，所以不保证永远一致。
 * 小调和大调（以及用了同一组和弦的两种五声音阶）是“从这个键起，隔一个音拿一个，拿 4 个”；后四种音阶的和弦是另配的。
 */
export const CHORD_PRESETS = [
  MINOR_CHORDS,
  MAJOR_CHORDS,
  MINOR_CHORDS,
  MAJOR_CHORDS,
  [[60, 64, 67, 71], [62, 66, 69], [62, 64, 67, 71], [60, 62, 67, 69], [62, 66, 67, 71], [60, 64, 67, 69], [62, 66, 69, 71]],
  [[60, 63, 67, 70], [60, 62, 65, 69], [62, 63, 67, 70], [60, 65, 69], [62, 65, 67, 70], [60, 63, 65, 70], [62, 65, 69, 70]],
  [[60, 64, 67], [60, 62, 65, 69], [60, 65, 67, 70], [60, 64, 65, 69], [62, 65, 67, 70], [60, 64, 67, 69], [62, 65, 69, 70]],
  [[60, 63, 67, 70], [60, 61, 65, 68], [63, 67, 70], [60, 63, 65, 68], [61, 63, 68, 70], [60, 63, 67, 68], [61, 65, 68, 70]],
];

/** CHORD 状态下第 degree 个 Synth key（1–7）弹出的那几个音。size = 只要前几个音（3 = 三和弦）。 */
export function chordNotes(degree, { scale = 0, key = 0, octave = 0, size = 4 } = {}) {
  const preset = (CHORD_PRESETS[scale] || CHORD_PRESETS[0])[(degree - 1) % 7];
  return preset.slice(0, size).map((n) => n + key + 12 * octave);
}

/** 给一组音起个最简单的名字：根音 + 是大是小。[60, 63, 67, 70] → 'Cm'；[63, 67, 70, 74] → 'D#'；认不出就只给根音。 */
export function chordName(notes) {
  if (!notes?.length) return '';
  const root = KEY_NAMES[((notes[0] % 12) + 12) % 12];
  const third = notes.length > 1 ? notes[1] - notes[0] : 0;
  const fifth = notes.length > 2 ? notes[2] - notes[0] : 7;
  if (third === 3) return `${root}${fifth === 6 ? '°' : 'm'}`;
  return root;
}

/** 这个和弦听起来偏哪边：'minor' 暗、'major' 亮、'dim' 紧（减和弦）、'other'。 */
export function chordMood(notes) {
  if (!notes || notes.length < 3) return 'other';
  const third = notes[1] - notes[0];
  const fifth = notes[2] - notes[0];
  if (third === 3 && fifth === 6) return 'dim';
  if (third === 3 && fifth === 7) return 'minor';
  if (third === 4 && fifth === 7) return 'major';
  return 'other';
}

/**
 * 把“第 step 步按一下第 degree 个键的和弦，持续 len 步”展开成循环播放器（looper.js）认的音符条目。
 * opts: scale / key / octave / size（同 chordNotes），voice（音色，默认 keys），vel（每个音的力度，默认 0.5：几个音叠在一起，单个要轻一些）。
 */
export function chordAt(step, degree, len = 4, { voice = 'keys', vel = 0.5, ...opts } = {}) {
  return chordNotes(degree, opts).map((n) => [step, n, len, voice, vel]);
}
