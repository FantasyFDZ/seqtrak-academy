// 把小课堂的几关挂到首页闯关地图上：每章开头的“小关”（章对象上的 minis，首页怎么画见 views/home.js 开头）。
// 首页会 import 这个文件，所以地图画之前这里一定执行过。学没学过、几颗星是每次画首页时现问进度的。
import { CHAPTERS } from './content/curriculum.js';
import { levelById, isOpen } from './content/classroom.js';
import { store } from './store.js';

// 哪一章的开头挂哪几关（方案在 docs/training-plan.md 的“放在哪”）。一章最多两个：地图上一行排 5 个点，再多这一章就太长了。
// 写了还没开放的关也没事：不会挂出来，等它开放了自己出现。
export const CHAPTER_MINIS = {
  ch1: ['T1', 'R1'], // 节拍与鼓：四个一组、跟稳
  ch2: ['T5', 'T7'], // 低音与音高：高和低、亮和暗
  ch3: ['T10'], // 和弦与和声：三个音叠起来
  ch4: ['F2', 'F4'], // 合成与音色设计：把声音捂住、那一声“喵”（F4 还没开放，开放了会自己挂出来）
  ch7: ['F5', 'F6'], // 效果与现场：房间有多大（混响）、踩在拍子上的回声（延迟）
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
