// 把小课堂的几关挂到首页闯关地图上：每章开头的“小关”（章对象上的 minis，首页怎么画见 views/home.js 开头）。
// 首页会 import 这个文件，所以地图画之前这里一定执行过。学没学过、几颗星是每次画首页时现问进度的。
import { CHAPTERS } from './content/curriculum.js';
import { levelById, isOpen } from './content/classroom.js';
import { store } from './store.js';

// 哪一章的开头挂哪几关（方案在 docs/training-plan.md 的“放在哪”）。一章最多三个：地图上一行排 5 个点，四节课的章挂两个、三个都是两行
// （3 + 3、4 + 3），区域一样高；再多，头一行就全是小关了。
// 挂的是**配这一章**的关，不是每一关都挂：没挂出来的从挂着的那一关进去，一关接一关就到（R10 在 R9 后面，R13、R14 在 R12 后面）。
// 写了还没开放的关也没事：不会挂出来，等它开放了自己出现。
export const CHAPTER_MINIS = {
  ch1: ['R1', 'R9'], // 节拍与鼓：跟稳、重音挪一挪（2026-11-18：T1 要并进 R1 了，这个位置换成节奏线第一批新开的 R9）
  // 乐理线重做之后按单元挂（2026-11-18）：每章开头挂的是配这一章的单元的第一关，从它进去一关接一关
  ch2: ['T5', 'T15'], // 低音与音高：单元 1「音高」的高和低、单元 2「梯子」的搭一把梯子
  ch3: ['T9', 'T28'], // 和弦与和声：单元 4「和声」的两个音的距离、单元 5「拆歌」的找到家
  ch4: ['F2', 'F4'], // 合成与音色设计：把声音捂住、那一声“喵”
  // 2026-11-18：节奏线后面两批的关在第 1 章前只挂得下 R9，另挑两关挂到配它们的章前面（这两关完成卡上的“接着去哪”里本来就有这两节课）
  ch6: ['D1', 'D4', 'R12'], // 编曲：乐句和小节、能量曲线（2026-11-15 开了 DJ 线之后加的）；不断拍（配 6.2 复制一段再改一点：边放边改）
  ch7: ['F5', 'F6', 'R11'], // 效果与现场：房间有多大（混响）、踩在拍子上的回声（延迟）；腾出一只手（配 7.2 触摸条：一只手守着，一只手去演）
  ch8: ['D3', 'D5'], // 毕业演出：过渡、对拍
};

for (const [chapterId, ids] of Object.entries(CHAPTER_MINIS)) {
  const chapter = CHAPTERS.find((c) => c.id === chapterId);
  if (!chapter) continue;
  chapter.minis = ids.map(levelById).filter(isOpen).map((level) => ({
    id: level.id,
    no: level.id,
    title: level.title,
    minutes: level.minutes || 3,
    href: `#/classroom/${level.id}`,
    done: () => !!store.data.classroom?.[level.id]?.done,
    stars: () => store.data.classroom?.[level.id]?.stars || 0,
  }));
}
