// 学习方式：手边有 SEQTRAK（MIDI）/ 没有，用电脑键盘 + 屏幕上的模拟机（键盘学习方式，docs/design-direction.md 有一节）。
// 这里只放一个“现在是不是键盘方式”的开关和变化通知，不引别的模块：课文（content/*.js）也读它，课文要能在 node 里单独加载（tools 里的脚本）。
// 谁来拨这个开关：main.js 按设置里的 learnMode 和 MIDI 连没连上算出来（连着 SEQTRAK 时一律按真机方式），变了就 set()。
import { Emitter } from './util.js';

class LearnMode extends Emitter {
  keyboard = false;

  set(keyboard) {
    const v = !!keyboard;
    if (v === this.keyboard) return;
    this.keyboard = v;
    this.emit('change', v);
  }
}

export const learn = new LearnMode();
export const isKeyboard = () => learn.keyboard;

/**
 * 课文里给键盘方式换一套说法：obj.kbd 里写了的字段，键盘方式下盖过原来的（课、步骤、任务都能用）。
 * 用 getter 做：谁读、什么时候读，拿到的都是当下这种方式的，不用到处判断。
 */
export function withKbd(obj) {
  const alt = obj?.kbd;
  if (!alt) return obj;
  const out = {};
  for (const k of new Set([...Object.keys(obj), ...Object.keys(alt)])) {
    if (k === 'kbd') continue;
    Object.defineProperty(out, k, { enumerable: true, get: () => (learn.keyboard && k in alt ? alt[k] : obj[k]) });
  }
  return out;
}
