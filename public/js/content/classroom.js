// 小课堂：乐理、节奏、效果、DJ 四条线，每关三五分钟，只讲一件事。
// 2026-11-15 改版（方案见 docs/training-plan.md 最后一节“小课堂丰富版”）：
//   关卡分五种（kind）：
//     explain 讲解关    一句话 → 玩一玩 → 试一试 → 用在机器上（原来那 12 关的样子）
//     rhythm  节奏挑战  一句话 → 热身 → 挑战（音游的引擎，有连击）→ 用在机器上
//     ear     听辨关    一句话 → 玩一玩 → 听辨（排顺序 / 找不同 / 记忆配对 / 格子听写 / 啾啾唱你弹回来 / 选一个）→ 用在机器上
//     hands   动手关    一句话 → 看一看 → 动手（在模拟机或真机上做一遍，自动判对错；有的动手关是混音台、对拍台）
//     boss    关底大关  一句话 → 大关（几段接力），每条线一个
//     learn   带着学    一句话 → 跟啾啾学（5–8 个小步，都在乐理台上）→ 挑战 → 用在机器上（2026-11-17 乐理线重做，见 cl-theory-units.js）
//     make    小作品    一句话 → 跟啾啾学 → 写一写（写出一点东西，收进小本子）
//   挑战那一步分铜、银、金三档（views/classroom.js 的 TIERS）：过了哪一档就拿哪一块牌，铜 1 星、银 2 星、金 3 星。
//   金牌 = 啾啾窝里一根羽毛（jiu-eggs.js），也是卡册里的一张金卡。
// 四条线的关分在四个文件里：cl-theory.js、cl-rhythm.js、cl-fx.js、cl-dj.js；“用在机器上”的常用句子在 classroom-bits.js。
// 这个文件是纯数据（Node 里也能跑：levels.js 和 tools/xp-check.mjs 要用）。
//
// 一关的写法：
//   id, line, kind, title, about, minutes
//   say        一进关啾啾说的那一句
//   play       玩一玩：{ toy, …玩具的参数, tip（右边那段“怎么玩”）, liveTip?（接着真机时换用）, name（玩过几下之后才出现的那句“这个叫……”）}
//   quiz       挑战：{ toy, …参数, ask（右边那段“要做什么”）, tiers?: [铜, 银, 金]（只写要改的参数） }；动手关写 toy: 'hands'（挑战就是 machine）
//   machine    用在机器上：{ tasks: [...], done, fx?（没接真机时用效果模拟机）, edits?（要往格子里填，真机得在练习本上）}
//   takeaway   带走的话（也是卡册里那张卡的正面）
//   coach      给啾啾（AI 教练）看的教学要点
//   links      相关的：{ lessons: 课程 id, charts: 音游谱面 id, songs: 曲目 id（分轨页）, full: 曲目 id（完整版页）}
//   ask        快问快答：[{ q, a: [对的, 错的…], why }]（每日五分钟、卡册里“考考我”用）
//   optional   true = 选学（乐理线的“看懂谱子”“和弦进阶”）：不在推荐路线上，列表、卡册上带“选学”的小标签
// 写法上的规矩：短句、口语；先玩出感觉，再给它起名字；不出现五线谱，不先下定义；啾啾的话里可以带“啾”。

import { THEORY, THEORY_UNITS } from './cl-theory.js';
import { RHYTHM } from './cl-rhythm.js';
import { FX } from './cl-fx.js';
import { DJ } from './cl-dj.js';

export const LINES = [
  { id: 'theory', name: '乐理', sub: '音的高低、亮暗，和它们怎么叠', color: 'violet' },
  { id: 'rhythm', name: '节奏', sub: '跟稳、数出来、打出来', color: 'accent' },
  { id: 'fx', name: '效果', sub: '同一个声音，换个样子', color: 'cyan' },
  { id: 'dj', name: 'DJ', sub: '乐句、Drop、过渡、对拍', color: 'blue' },
];

/** 五种关：列表上的小标签、挑战那一步叫什么、玩一玩那一步叫什么 */
export const KINDS = {
  explain: { label: '讲解', quiz: '试一试', play: '玩一玩' },
  rhythm: { label: '节奏挑战', quiz: '挑战', play: '热身' },
  ear: { label: '听辨', quiz: '听辨', play: '玩一玩' },
  hands: { label: '动手', quiz: '动手', play: '看一看' },
  boss: { label: '关底大关', quiz: '大关', play: '' },
  learn: { label: '带着学', quiz: '挑战', play: '' },
  make: { label: '小作品', quiz: '写一写', play: '' },
};

/** 乐理线的单元（列表上分组用）：关上写 unit */
export const UNITS = THEORY_UNITS;

export const LEVELS = [...THEORY, ...RHYTHM, ...FX, ...DJ];

/**
 * 合并掉的旧关：旧 id → 并进了哪一关。旧链接（#/classroom/T1）会跳到并进去的那一关；进度里旧 id 的记录留着不删，
 * 但不再算经验、不出卡、不进复习（levels.js、classroom-review.js 都只认“清单里还有的 id”）。
 * 2026-11-18：T1「四个一组」并进了 R1，T2「把一拍切开」并进了 R2。
 */
export const MERGED = { T1: 'R1', T2: 'R2', T3: 'R5', T4: 'R6', T13: 'D4' };

export const levelById = (id) => LEVELS.find((l) => l.id === id) || LEVELS.find((l) => l.id === MERGED[id]) || null;
export const isOpen = (level) => !!level?.quiz;
export const OPEN_LEVELS = LEVELS.filter(isOpen);
export const lineOf = (level) => LINES.find((l) => l.id === level?.line) || null;
export const isBoss = (level) => level?.kind === 'boss';

/** 一关有哪几步：[['say', '一句话'], ['play', …], ['quiz', …], ['machine', '用在机器上']] */
export function stepsOf(level) {
  const k = KINDS[level.kind] || KINDS.explain;
  const out = [['say', '一句话']];
  if (level.guide) out.push(['guide', '跟啾啾学']);
  else if (level.play) out.push(['play', k.play || '玩一玩']);
  out.push(['quiz', k.quiz]);
  if (level.machine && level.quiz?.toy !== 'hands') out.push(['machine', '用在机器上']);
  return out;
}

/** 同一条线上，这一关后面第一个开放了的关（没有就是 null） */
export function nextOpen(id) {
  const i = LEVELS.findIndex((l) => l.id === id);
  if (i < 0) return null;
  return LEVELS.slice(i + 1).find((l) => l.line === LEVELS[i].line && isOpen(l)) || null;
}

// ───────────── 推荐路线：跨四条线的一条路，每一站配一段主线课程 ─────────────

export const ROUTE = [
  { id: 'beat', name: '先认拍子', with: '配第 0–1 章', lesson: '1-1', ids: ['R1', 'R2', 'F1'] }, // 原来打头的 T1、T2 并进了 R1、R2
  // R9（重音挪一挪）接在反拍、切分后面：它的“挪进缝里”用得上那两关；R10（不出声的那一拍）跟着它：都是“同样的格子，这一下换个打法”；
  // R11（腾出一只手）排在这些后面：它要的是前面的循环都已经在手上；
  // 第三批的三关压在大关前面：R12（不断拍）一条轨道，先打顺；R13（三格一圈）接着 R5 的“三、三、二”往下讲；R14（三对二）要两只手，放最后
  { id: 'drums', name: '鼓怎么摆', with: '配第 1 章', lesson: '1-2', ids: ['R3', 'R7', 'R4', 'R5', 'R9', 'R10', 'R6', 'R8', 'R11', 'R12', 'R13', 'R14', 'RB'] },
  { id: 'pitch', name: '音的高低', with: '配第 2 章', lesson: '2-1', ids: ['T5', 'T6', 'T14', 'T15', 'T7', 'T16', 'T8', 'T12', 'T17'] },
  { id: 'melody', name: '写一句旋律', with: '配第 2 章', lesson: '2-3', ids: ['T18', 'T19', 'T20', 'T21', 'T22'] },
  { id: 'stack', name: '叠起来', with: '配第 3 章', lesson: '3-1', ids: ['T9', 'T10', 'T23', 'T24', 'T25', 'T11', 'T26', 'T27'] },
  { id: 'songs', name: '把歌拆开', with: '配第 3 章', lesson: '3-4', ids: ['T28', 'T29', 'T30', 'TB'] }, // 乐理线单元 5（2026-11-18 第三期）：拆曲目库里的歌，大关是它的最后一关
  { id: 'shape', name: '捏声音', with: '配第 4 章', lesson: '4-2', ids: ['F2', 'F3', 'F4', 'F7'] },
  { id: 'space', name: '空间和现场', with: '配第 7 章', lesson: '7-1', ids: ['F5', 'F6', 'F8', 'F10', 'F9', 'F11', 'FB'] },
  { id: 'dj', name: '上台打碟', with: '配第 6、8 章', lesson: '6-4', ids: ['D1', 'D4', 'D2', 'D5', 'D3', 'D6', 'DB'] },
];
/**
 * 选学的关（关上写着 optional: true）：不在这条路上。路线页把它们单独摆在最下面当“岔路”；“按路线，下一关”永远不会指到它们，
 * 每日五分钟也不拿它们“尝鲜”（学过了才会来复习），关底大关不考。
 */
export const ROUTE_SIDE = [
  { id: 'read', name: '看懂谱子', with: '想读五线谱再来', ids: ['T31', 'T32', 'T33', 'T34'] },
  { id: 'voice', name: '和弦进阶', with: '自己按和弦时用得上', ids: ['T35', 'T36'] },
];
export const ROUTE_ORDER = ROUTE.flatMap((s) => s.ids);
export const stopOf = (id) => ROUTE.find((s) => s.ids.includes(id)) || null;

/** 路线上还没学的前 k 关（done(id) → 学没学过） */
export function routeNext(done, k = 1) {
  return ROUTE_ORDER.filter((id) => !done(id)).slice(0, k).map(levelById).filter(Boolean);
}
