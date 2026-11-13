// 啾啾主动说一句：它在哪儿（窝里，或者正指着一个键），气泡就从哪儿冒出来，过一会儿自己收。
// 用在：一个步骤卡了一阵子没进展、连着做偏了好几回、连着两局没过、一道题答错了两回（都在 lesson.js 里触发）。
// 话是就地写好的，不调 AI；带着 ask 的气泡上有个“帮我看看”，点了才把问题替你问出去。
// 什么时候不出来：音游打着的时候（sfx.held）、全屏的庆祝盖着的时候、你正和啾啾说着话的时候。
// 同一件事（key 相同）一次打开页面只说一遍，免得烦。
import { sfx } from './sfx.js';
import { coach } from './coach.js';
import { celebrating } from './celebrate.js';

const said = new Set();

/** 把它主动说的那句收起来（换了一步、离开这一页的时候调） */
export function hushNudge() {
  coach.hushNudge();
}

/**
 * 说一句。返回 true = 说出来了。
 *   key   同一个 key 只说一遍       mood  这时候的神态（默认“说话”，鼓劲用 'cheer'）
 *   ms    多久之后自己收起来         ask   点“帮我看看”时替你问出去的那句话（不给就是打开和啾啾的对话）
 */
export function nudge(text, { key, mood = 'talk', ms = 14000, ask } = {}) {
  if (key && said.has(key)) return false;
  if (sfx.held || celebrating() || coach.open) return false;
  if (key) said.add(key);
  coach.nudge(text, { mood, ms, ask });
  return true;
}
