// 开发期：拿一份进度文件，按 public/js/levels.js 的规则算一遍经验值、等级和徽章，打印出来。只读，不写任何东西。
// 用来确认“旧的进度文件（里面没有 game 这一段）读得进来、回算得出来”。
// 用法：node tools/xp-check.mjs [数据目录]      默认是 data/（Mac 上的真实进度）
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BADGES, LEVELS, backfillGame, blankGame, awardBadges, xpBreakdown, levelOf, streaks } from '../public/js/levels.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.resolve(root, process.argv[2] || 'data');
const today = new Date().toLocaleDateString('sv');

const data = JSON.parse(await readFile(path.join(dir, 'progress.json'), 'utf8'));
let sessions = [];
try {
  sessions = (await readFile(path.join(dir, 'sessions.jsonl'), 'utf8')).trim().split('\n').map((l) => JSON.parse(l)).slice(-200);
} catch {
  /* 没有练习记录 */
}

const had = !!data.game;
data.lessons ||= {};
data.charts ||= {};
data.practiceDays ||= [];
if (had) {
  data.game = { ...blankGame(), ...data.game };
  awardBadges(data, today);
} else {
  backfillGame(data, sessions);
}

const xp = xpBreakdown(data);
const lv = levelOf(xp.total);
const st = streaks(data.practiceDays, today);
console.log(`数据目录：${dir}`);
console.log(`进度文件里${had ? '已经有' : '没有'} game 这一段${had ? '' : `，从已有进度回算（练习记录 ${sessions.length} 条）`}`);
console.log(`课程：完成 ${Object.values(data.lessons).filter((l) => l.done).length} 节，碰过 ${Object.keys(data.lessons).length} 节；谱面 ${Object.keys(data.charts).length} 个，共 ${Object.values(data.charts).reduce((n, c) => n + (c.plays || 0), 0)} 局；练习 ${data.practiceDays.length} 天`);
const rooms = Object.entries(data.classroom || {}).filter(([, s]) => s?.done);
console.log(`小课堂：学完 ${rooms.length} 关${rooms.length ? `（${rooms.map(([id, s]) => `${id} ${s.stars || 1} 星`).join('、')}）` : ''}`);
console.log(`经验：${xp.total}（课程 ${xp.lessons} + 每天 ${xp.days} + 音游 ${xp.plays} + 小课堂 ${xp.classroom} + 其它 ${xp.extra}）`);
console.log(`等级：Lv ${lv.lv} ${lv.name}${lv.next ? `，离 Lv ${lv.next.lv} ${lv.next.name} 还差 ${lv.next.at - xp.total}` : '（满级）'}`);
console.log(`连续：现在 ${st.current} 天，最长 ${st.longest} 天`);
console.log(`累计：${JSON.stringify(data.game.stats)}`);
console.log(`徽章 ${Object.keys(data.game.badges).length} / ${BADGES.length}：`);
for (const b of BADGES) console.log(`  ${data.game.badges[b.id] ? '●' : '○'} ${b.name}${data.game.badges[b.id] ? `  ${data.game.badges[b.id]}` : ''}`);
console.log(`等级表：${LEVELS.map((l) => `${l.lv} ${l.name} ${l.at}`).join(' / ')}`);
