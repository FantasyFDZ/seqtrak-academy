// 字幕：没有旁白，信息全靠这几行字和啾啾的气泡。每一条在哪一刻出来、哪一刻走（秒，按小节算）。
// 写法：main 里用 [方括号] 括起来的字标成桔红（重点词）。quiet = 不要冲击感的进场（片尾署名）。
// 口吻是产品介绍，不是上课（用户 2026-11-21：“一格一格，排出第一个鼓组”教学味太浓）；
// 每条写具体的功能名和好处（video-shotcraft 审美准则 C2）。片名和定位在开场的品牌镜头里（scenes/brand.js），不在这里。
import { at, DURATION } from './time.js';

export const CAPTIONS = [
  // B 主角：这台机器
  { t0: at(3, 1, 2), t1: at(5) - 0.4, kicker: 'YAMAHA SEQTRAK', main: '专为 [SEQTRAK] 打造', sub: '零基础，也能玩转这台机器' },
  // C 音游
  { t0: at(5, 1, 2), t1: at(7) - 0.45, kicker: '01 · 音游式练习', main: '像打[音游]一样练节奏', at: 'right' },
  // D 真机镜像
  { t0: at(7, 1, 2), t1: at(9) - 0.45, kicker: '02 · 真机镜像', main: '你在机器上按，屏幕[跟着亮]' },
  // E 乐理台
  { t0: at(9, 1, 2), t1: at(11) - 0.45, kicker: '03 · 乐理台', main: '乐理，也能[一眼看懂]' },
  // F 啾啾
  { t0: at(11, 3), t1: at(15) - 0.65, kicker: '04 · AI 教练', main: '一只会飞的教练：[啾啾]', y: 96 },
  { t0: at(15, 1, 2), t1: at(17) - 0.65, kicker: '05 · 采样', main: '连它的叫声，都能变成[乐器]', y: 96 },
  // G 蓄力
  { t0: at(17, 1, 2), t1: at(18, 4), kicker: '06 · 键盘学习方式', main: '没有机器？[电脑键盘]也能学', at: 'center', y: 820 },
  // I 收尾（片名和标语在 end 场景里，这里只有署名）
  { t0: at(30, 3), t1: DURATION + 1, main: '啾啾的形象参考 huashu-bird-sticker（花叔），CC BY 4.0', at: 'center', y: 1000, cls: 'credit', quiet: true },
];
