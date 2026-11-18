// 把曲目库里的歌搬到乐理台上（乐理线重做第三期：单元 5「拆歌」和乐理大关，方案见 docs/training-plan.md “乐理线重做”）。
// 曲目的 SEQTRAK 版分轨（content/song-parts.js）是按“第几个 Synth key + 高低几层”写的；乐理台上的东西是按“梯子上的第几级”写的
// （theory-bench.js 的 score()）。这里只做翻译，不加新的音：
//   家     = 这首歌的 KEY（60 = 最左边的 C，往右数）
//   梯子   = 这首歌的 SCALE（只收小调、大调两种：机器的 CHORD 在这两种上正好是“隔一个拿一个”）
//   和弦   = 和弦轨按了第几个键、按到什么时候换（断开来一下一下弹的，合成一段）
//   贝斯   = 贝斯轨按了第几个键（楼层不要了，都摆在家下面那一层：第 6、7 级放在家的下面，线连得起来）
//   旋律   = 旋律轨（第几个键 + 高低几层 → 第几级，8 = 高一层的家，0 = 家下面那一级）
// 对这些歌的“拆法”（家在哪、哪一套和弦、旋律怎么走）是我们自己照这份分轨数出来的。
// 纯数据、纯函数：Node 里也能跑（content/cl-theory-units3.js 要用，levels.js 和 tools/xp-check.mjs 会间接 import 到）。
import { SONG_PARTS } from './content/song-parts.js';
import { SONGS } from './content/songs.js';

const LADDER = { 0: 'minor', 1: 'major' };
const OFFSETS = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11] };
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** 乐理台上拆得了的歌：小调或大调，家在 G 以下（7 个和弦在两个八度的键盘上都摆得全），和弦、贝斯、旋律三样都有 */
export const BENCH_SONGS = ['faded', 'gangstas-paradise', 'shape-of-you', 'save-your-tears', 'dance-monkey', 'the-nights'];

/** 一条轨道自己转一圈是几格（按 16 格一小节取整） */
const loopOf = (notes) => Math.max(16, Math.ceil(Math.max(...notes.map((n) => n[0] + n[2])) / 16) * 16);
/** 比整首短的轨道自己重复，铺满 steps 格 */
function tile(notes, steps) {
  const loop = loopOf(notes);
  const out = [];
  for (let at = 0; at < steps; at += loop) for (const [s, k, l, o = 0] of notes) if (at + s < steps) out.push([at + s, k, Math.min(l, steps - at - s), o]);
  return out;
}

const cache = new Map();

/**
 * 一首歌在乐理台上的样子：
 *   { id, title, artist, name（《……》）, bpm, key（0 = C）, root（家是哪个键）, homeName, ladder（'minor' / 'major'）, steps,
 *     chords [[第几格起, 占几格, 第几级]], bass [[起, 长, 第几级]], mel [[起, 长, 第几级]], prog [每一格和弦是第几级] }
 * chords / bass / mel 就是 theory-bench.js 的 score() 认的写法。拆不了的歌返回 null。
 */
export function benchSong(id) {
  if (cache.has(id)) return cache.get(id);
  const p = SONG_PARTS[id];
  const meta = SONGS.find((s) => s.id === id);
  const part = (layer) => p?.parts.find((x) => x.layer === layer && x.notes);
  let out = null;
  if (p && meta && LADDER[p.scale] && part('chords') && part('bass') && part('lead')) {
    const steps = p.bars * 16;
    // 和弦：同一个键连着按的合成一段，一直铺到换下一个和弦
    const hits = tile(part('chords').notes, steps).sort((a, b) => a[0] - b[0]);
    const chords = [];
    for (const [s, k] of hits) {
      const last = chords[chords.length - 1];
      if (last && last[2] === k) continue;
      if (last) last[1] = s - last[0];
      chords.push([s, steps - s, k]);
    }
    const low = (k) => (k >= 6 ? k - 7 : k); // 第 6、7 级摆到家的下面
    const bass = tile(part('bass').notes, steps).map(([s, k, l]) => [s, l, low(k)]);
    const mel = tile(part('lead').notes, steps).map(([s, k, l, o]) => [s, l, k + 7 * o]);
    // 旋律有音掉到键盘左边外面去了（最左边的键是 C）：整句抬高一层楼，级数不变
    const offs = OFFSETS[LADDER[p.scale]];
    const midi = (d) => 60 + p.key + offs[(((d - 1) % 7) + 7) % 7] + 12 * Math.floor((d - 1) / 7);
    while (Math.min(...mel.map((n) => midi(n[2]))) < 60) for (const n of mel) n[2] += 7;
    out = {
      id, title: meta.title, artist: meta.artist, name: `《${meta.title}》`, bpm: p.bpm, key: p.key, root: 60 + p.key, homeName: NAMES[p.key], ladder: LADDER[p.scale], steps,
      chords, bass, mel, prog: chords.map((c) => c[2]),
    };
  }
  cache.set(id, out);
  return out;
}

/** 关里的小步用：这首歌的一段（score 的写法）。parts 只留其中几样（['chords', 'bass', 'mel']），别的不摆也不响 */
export function tuneScore(id, parts = ['chords', 'bass', 'mel']) {
  const s = benchSong(id);
  return { steps: s.steps, bpm: s.bpm, chords: parts.includes('chords') ? s.chords : [], bass: parts.includes('bass') ? s.bass : [], mel: parts.includes('mel') ? s.mel : [] };
}

/** 小步的 show 里摆这首歌的梯子：{ ladder, root } */
export const tuneShow = (id) => ({ ladder: benchSong(id).ladder, root: benchSong(id).root });

/** 从一段键号的 score 里切出第 a 格到第 b 格（不含 b）：切到一半的音只留里面那一截 */
export function sliceScore(sc, a, b) {
  const clip = (list) => (list || []).filter((x) => x.s < b && x.s + x.l > a).map((x) => ({ ...x, s: Math.max(x.s, a) - a, l: Math.min(x.s + x.l, b) - Math.max(x.s, a) }));
  return { steps: b - a, bpm: sc.bpm, chords: clip(sc.chords), bass: clip(sc.bass), mel: clip(sc.mel) };
}

/** 一套和弦在曲目库里还有谁在用（按级数比）：['《Faded》', …]，不算 except 那一首 */
export function sameProg(prog, except) {
  return BENCH_SONGS.filter((id) => id !== except && benchSong(id)?.prog.join() === prog.join()).map((id) => benchSong(id).name);
}
