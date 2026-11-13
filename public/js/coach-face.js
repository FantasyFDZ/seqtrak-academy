// 教练在页面上“露脸”的地方。教练现在是一只小鸟（啾啾，jiu.js），全应用只有一只：
// coachFace() 不再画一张脸，而是在页面上给它留一块蹲着的地方（一小截树枝），啾啾会飞过来蹲在那儿。
// 同时留了好几块的话，它去最后留的那块；那块没了（页面换走、卡片关了），它回到前一块，最后回导航栏里的窝。
// 神态：idle 待机 / think 在想 / talk 说话 / happy 高兴 / cheer 给你打气（bird.js 里还有 oops、surprised、sleepy、listen）。
import { h } from './util.js';
import * as jiu from './jiu.js';

export const MOODS = ['idle', 'think', 'talk', 'happy', 'cheer', 'oops', 'surprised', 'sleepy', 'listen'];

/**
 * 留一块地方给啾啾。size = 多大（像素）；follow = 跟不跟着全局的神态（默认跟；不跟就一直是 mood）；
 * act = 它飞到这儿时做一下的动作（bird.js 的 ACTIONS，比如 'flip' 翻个跟头）。
 * 返回 { el, set(mood), release() }：页面换走、这块不要了的时候调 release()（忘了调也行：这块从页面上拿掉之后它自己会走）。
 */
export function coachFace({ size = 64, mood, follow = true, act } = {}) {
  const el = h('span', { class: 'face jiu-perch', style: { width: `${size}px`, height: `${size}px` }, 'aria-hidden': 'true' });
  const spot = jiu.perch(el, { size, mood: follow ? null : MOODS.includes(mood) ? mood : 'idle', act });
  return {
    el,
    set(m) {
      spot.set(MOODS.includes(m) ? m : null);
    },
    release: spot.release,
  };
}

/** 换啾啾的神态。ms = 过这么久自己回到待机（不传就一直保持） */
export function setCoachMood(mood, ms = 0) {
  jiu.setMood(MOODS.includes(mood) ? mood : 'idle', ms);
  if (mood === 'happy' || mood === 'cheer') jiu.act('hop');
}

export const coachMood = () => jiu.getMood();
