// 练习场的谱面库。写法见 js/chart.js 顶部的说明。
// 节奏串每小节 16 格：1 e & a 2 e & a 3 e & a 4 e & a

const FOUR = 'x---x---x---x---'; // 四踩：每拍一下
const BACK = '----x-------x---'; // 二、四拍
const EIGHTHS = 'x-x-x-x-x-x-x-x-'; // 八分音符
const OFF = '--x---x---x---x-'; // 反拍（每拍的 &）

export const PATTERNS = { FOUR, BACK, EIGHTHS, OFF };
const C_MINOR = { scale: 0, key: 0 }; // SCALE 第 1 个（MINOR），KEY = C

export const CHART_GROUPS = ['基础节奏', 'House / Techno', 'Lo-fi / Hip-hop', 'Synthwave', '其它律动', '低音线', '和弦', '歌里的和弦'];

// 和弦谱面的写法：hits 里是 [第几步, 第几个 Synth key, 持续几步]。机器上要选中 SYNTH 2 并切到 CHORD（一个键 = 一个和弦）。
const chords = (hits, voice = 'keys') => ({ voice, track: 'SYNTH2', scale: C_MINOR, hits });
const KICK2 = 'x---x---x---x---x---x---x---x---';
const BACK2 = '----x-------x-------x-------x---';

export const CHARTS = [
  // ── 基础节奏 ──
  { id: 'pulse-kick', group: '基础节奏', level: 1, title: '四踩底鼓', desc: '每一拍一下。舞曲的心跳，也是你对拍时一直在数的那个“咚”。', bpm: 100, bars: 1, loops: 4, lanes: { KICK: FOUR } },
  { id: 'backbeat', group: '基础节奏', level: 1, title: '二、四拍军鼓', desc: '底鼓替你打着，你只负责第 2、4 拍的“啪”。这就是让人想点头的地方。', bpm: 96, bars: 1, loops: 4, lanes: { SNARE: BACK }, backing: { KICK: FOUR } },
  { id: 'hat-eighths', group: '基础节奏', level: 1, title: '八分镲', desc: '把每一拍切成两半：“1 & 2 & 3 & 4 &”。', bpm: 90, bars: 1, loops: 4, lanes: { HAT1: EIGHTHS }, backing: { KICK: FOUR, SNARE: BACK } },
  { id: 'kick-snare', group: '基础节奏', level: 2, title: '底鼓 + 军鼓', desc: '左右手第一次分工：咚 — 啪 — 咚 — 啪。', bpm: 92, bars: 1, loops: 4, lanes: { KICK: 'x-------x-------', SNARE: BACK }, backing: { HAT1: EIGHTHS } },
  { id: 'pop-basic', group: '基础节奏', level: 3, title: '流行基本鼓', desc: '三样一起来。第 3 拍后面多出来的那一下底鼓，是它“往前走”的原因。', bpm: 92, bars: 1, loops: 4, lanes: { KICK: 'x-------x-x-----', SNARE: BACK, HAT1: EIGHTHS } },

  // ── House / Techno ──
  { id: 'hat-offbeat', group: 'House / Techno', level: 2, title: '反拍镲', desc: 'House 的灵魂：镲只落在两拍之间，“咚-嚓-咚-嚓”。', bpm: 116, bars: 1, loops: 4, lanes: { HAT1: OFF }, backing: { KICK: FOUR, CLAP: BACK } },
  { id: 'house-kit', group: 'House / Techno', level: 3, title: 'House 鼓组', desc: '四踩 + 二四拍手 + 反拍镲，三条轨道拼出一个完整的 House 律动。', bpm: 120, bars: 1, loops: 4, lanes: { KICK: FOUR, CLAP: BACK, HAT1: OFF } },
  { id: 'techno-drive', group: 'House / Techno', level: 3, title: 'Techno 推进', desc: '开镲放在反拍，再用一个打击乐填在缝里，机器感就出来了。', bpm: 128, bars: 1, loops: 4, lanes: { KICK: FOUR, HAT2: OFF, PERC1: '---x--x----x--x-' } },

  // ── Lo-fi / Hip-hop ──
  { id: 'boombap', group: 'Lo-fi / Hip-hop', level: 3, title: 'Boom Bap', desc: '底鼓故意不踩在拍子上，带一点摇摆。慢，但是每一下都要“懒得刚好”。', bpm: 86, bars: 1, loops: 4, swing: 0.3, lanes: { KICK: 'x------x--x-----', SNARE: BACK }, backing: { HAT1: EIGHTHS } },
  { id: 'lofi-lazy', group: 'Lo-fi / Hip-hop', level: 2, title: 'Lo-fi 慵懒鼓', desc: '两小节一个循环，第二小节的底鼓换了位置：循环开始有“句子”的感觉。', bpm: 78, bars: 2, loops: 2, swing: 0.25, lanes: { KICK: 'x---------x-----x-----x---x-----', SNARE: '----x-------x-------x-------x---' }, backing: { HAT1: 'x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-x-' } },

  // ── Synthwave ──
  { id: 'synthwave-beat', group: 'Synthwave', level: 2, title: 'Synthwave 鼓', desc: '80 年代的大军鼓：简单、有力、每一下都砸实。', bpm: 104, bars: 1, loops: 4, lanes: { KICK: FOUR, SNARE: '----X-------X---' }, backing: { HAT1: EIGHTHS } },

  // ── 其它律动 ──
  { id: 'two-step', group: '其它律动', level: 3, title: 'Two-step', desc: '底鼓不再四踩，中间空出一大块。UK Garage 和 Drum & Bass 的骨架。', bpm: 130, bars: 1, loops: 4, lanes: { KICK: 'x---------x-----', SNARE: BACK }, backing: { HAT1: EIGHTHS } },
  { id: 'dembow', group: '其它律动', level: 4, title: 'Dembow', desc: '“3 + 3 + 2”的军鼓压在四踩上，雷鬼顿的标志律动。', bpm: 94, bars: 1, loops: 4, lanes: { KICK: FOUR, SNARE: '---x--x----x--x-' } },

  // ── 低音线 ──
  // 这一组都写在 C 小调里：机器上把 SCALE 设成 MINOR（第 1 个）、KEY 设成 C，Synth key 1–7 依次是 C D D# F G G# A#
  { id: 'bass-root', group: '低音线', level: 1, title: '根音贝斯', desc: '只弹一个音，跟着底鼓走。贝斯最重要的工作就是这个。', bpm: 108, bars: 1, loops: 4, melody: { voice: 'bass', track: 'SYNTH1', scale: C_MINOR, notes: [[0, 'C1', 3], [4, 'C1', 3], [8, 'C1', 3], [12, 'C1', 3]] }, backing: { KICK: FOUR, HAT1: OFF } },
  { id: 'bass-offbeat', group: '低音线', level: 2, title: '反拍贝斯', desc: '底鼓响的时候贝斯闭嘴，底鼓停的时候贝斯出声。House 贝斯的经典写法。', bpm: 120, bars: 1, loops: 4, melody: { voice: 'bass', track: 'SYNTH1', scale: C_MINOR, notes: [[2, 'C1', 2], [6, 'C1', 2], [10, 'C1', 2], [14, 'C1', 2]] }, backing: { KICK: FOUR, CLAP: BACK } },
  { id: 'bass-fifth', group: '低音线', level: 2, title: '根音与五音', desc: '在第 1 个键和第 5 个键之间来回：最稳的两个音，怎么跳都好听。', bpm: 108, bars: 1, loops: 4, melody: { voice: 'bass', track: 'SYNTH1', scale: C_MINOR, notes: [[0, 'C1', 2], [4, 'G1', 2], [8, 'C1', 2], [12, 'G1', 2]] }, backing: { KICK: FOUR, SNARE: BACK, HAT1: EIGHTHS } },
  { id: 'bass-bounce', group: '低音线', level: 3, title: '会跳的贝斯', desc: '根音和五音换成八分音符，贝斯开始“蹦”起来。Disco 和 Synthwave 的味道。', bpm: 108, bars: 1, loops: 4, melody: { voice: 'bass', track: 'SYNTH1', scale: C_MINOR, notes: [[0, 'C1', 2], [2, 'C1', 2], [4, 'G1', 2], [6, 'C1', 2], [8, 'C1', 2], [10, 'C1', 2], [12, 'G1', 2], [14, 'A#1', 2]] }, backing: { KICK: FOUR, SNARE: BACK } },
  { id: 'bass-four-roots', group: '低音线', level: 3, title: '四个根音', desc: '两小节换四个音：C – G# – D# – A#（键 1 – 6 – 3 – 7）。无数电子和流行歌的地基。', bpm: 100, bars: 2, loops: 2, melody: { voice: 'bass', track: 'SYNTH1', scale: C_MINOR, notes: [[0, 'C1', 3], [4, 'C1', 3], [8, 'G#0', 3], [12, 'G#0', 3], [16, 'D#1', 3], [20, 'D#1', 3], [24, 'A#0', 3], [28, 'A#0', 3]] }, backing: { KICK: 'x---x---x---x---x---x---x---x---', SNARE: '----x-------x-------x-------x---' } },

  // ── 和弦 ──
  // 也都在 C 小调里。CHORD 状态下 7 个键的和弦（出厂值）：1 Cm、2 D°、3 D#、4 Fm、5 Gm、6 G#、7 A#，每个都是 4 个音。
  // 贝斯由应用替你弹着（每个和弦的根音），你只管按和弦。
  { id: 'chord-two', group: '和弦', level: 1, title: '两个和弦来回', desc: '键 1（暗）和键 6（亮），每两拍换一个，按下去让它响满。贝斯在下面替你弹着根音。', bpm: 96, bars: 1, loops: 4,
    chords: chords([[0, 1, 7], [8, 6, 7]]),
    backing: { KICK: FOUR, SNARE: BACK }, backingMelody: { voice: 'bass', notes: [[0, 'C1', 3], [4, 'C1', 3], [8, 'G#0', 3], [12, 'G#0', 3]] } },
  { id: 'chord-stab', group: '和弦', level: 2, title: '反拍和弦', desc: '只用键 1，但落在两拍之间，短促地“戳”一下就松手。House 里那种一跳一跳的和弦就是这么来的。', bpm: 116, bars: 1, loops: 4,
    chords: chords([[2, 1, 1], [6, 1, 1], [10, 1, 1], [14, 1, 1]]),
    backing: { KICK: FOUR, CLAP: BACK }, backingMelody: { voice: 'bass', notes: [[0, 'C1', 2], [4, 'C1', 2], [8, 'C1', 2], [12, 'C1', 2]] } },
  { id: 'chord-four', group: '和弦', level: 2, title: '四个和弦', desc: '第 2 章那四个根音，每个上面盖一个和弦：键 1 – 6 – 3 – 7，两小节一圈。无数电子和流行歌用的就是这一套。', bpm: 100, bars: 2, loops: 2,
    chords: chords([[0, 1, 7], [8, 6, 7], [16, 3, 7], [24, 7, 7]]),
    backing: { KICK: KICK2, SNARE: BACK2 }, backingMelody: { voice: 'bass', notes: [[0, 'C1', 3], [4, 'C1', 3], [8, 'G#0', 3], [12, 'G#0', 3], [16, 'D#1', 3], [20, 'D#1', 3], [24, 'A#0', 3], [28, 'A#0', 3]] } },

  // ── 歌里的和弦 ──
  // 2026-11-12 换成用户听过的三首（原来是 Sweet Dreams、Still D.R.E.、Clint Eastwood，他没听过）。和弦和 content/song-parts.js 里这几首的分轨一致
  // （那是查过资料、他听过并认了的版本）；都搬到 C 小调、用机器现成的 7 个和弦，是简化版，不是逐音扒谱。
  { id: 'song-gangstas-paradise', group: '歌里的和弦', level: 2, title: 'Gangsta\'s Paradise 的四个和弦', desc: '原曲就在 C 小调，和你机器上的设置一样：键 6 → 4 → 5 → 1，每个两拍，两小节一圈。（原曲第三个和弦是更亮的 G 大和弦，机器键 5 的预设差一个音。）', bpm: 80, bars: 2, loops: 2,
    chords: chords([[0, 6, 7], [8, 4, 7], [16, 5, 7], [24, 1, 7]]),
    backing: { KICK: 'x-------x-x-----x-------x-x-----', SNARE: BACK2 }, backingMelody: { voice: 'bass', notes: [[0, 'G#0', 7], [8, 'F0', 7], [16, 'G0', 7], [24, 'C1', 7]] } },
  { id: 'song-starboy', group: '歌里的和弦', level: 1, title: 'Starboy 的四个和弦', desc: '一小节一个和弦，慢慢换：键 1 → 7 → 6 → 7，四小节一圈。原曲在 A 小调，搬到 C 小调就是这四个键。', bpm: 93, bars: 4, loops: 2,
    chords: chords([[0, 1, 15], [16, 7, 15], [32, 6, 15], [48, 7, 15]]),
    backing: { KICK: 'x-------x-------'.repeat(4), SNARE: BACK2 + BACK2 }, backingMelody: { voice: 'bass', notes: [[0, 'C1', 6], [8, 'C1', 6], [16, 'A#0', 6], [24, 'A#0', 6], [32, 'G#0', 6], [40, 'G#0', 6], [48, 'A#0', 6], [56, 'A#0', 6]] } },
  { id: 'song-something-just-like-this', group: '歌里的和弦', level: 2, title: 'Something Just Like This 的四个和弦', desc: '从亮的地方起：键 6 → 7 → 1 → 7，每个两拍，两小节一圈。原曲在 B 小调，搬到 C 小调就是这四个键。', bpm: 103, bars: 2, loops: 2,
    chords: chords([[0, 6, 7], [8, 7, 7], [16, 1, 7], [24, 7, 7]]),
    backing: { KICK: KICK2, SNARE: BACK2 }, backingMelody: { voice: 'bass', notes: [[0, 'G#0', 3], [4, 'G#0', 3], [8, 'A#0', 3], [12, 'A#0', 3], [16, 'C1', 3], [20, 'C1', 3], [24, 'A#0', 3], [28, 'A#0', 3]] } },
];

export const chartById = (id, extra = []) => [...CHARTS, ...extra].find((c) => c.id === id) || null;
