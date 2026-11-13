// 配色、动效档位、节拍：把「设置」里选的落到页面上，并给画布提供读颜色的办法。
//   <html data-skin="body|neon">   两套配色只是 app.css 里两组变量值
//   <html data-fx="rich|calm">     克制 = 去掉循环动效和粒子，只留状态变化；系统开了“减少动效”时也按克制处理
//   --beat                          一拍多长（60 秒 ÷ BPM）；“活着的东西”跟着它呼吸。没连真机时按 120
// 地址里加 ?skin=neon / ?fx=calm 可以临时看另一种（不改设置；手动切一次之后以设置为准）。
import { Emitter, clamp } from './util.js';

const LS_KEY = 'seqtrak-academy-ui'; // 只为开页面那一瞬间不闪：index.html 开头的小脚本读它
const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)') || null;
const params = new URLSearchParams(location.search);
const root = document.documentElement;

class Theme extends Emitter {
  skin = 'body';
  motion = 'rich'; // 设置里选的；实际生效的看 fx
  bpm = 120;
  #override = { skin: params.get('skin'), fx: params.get('fx') };
  #cache = new Map();
  #painted = false;
  #kept = '';

  constructor() {
    super();
    reduced?.addEventListener?.('change', () => this.#paint());
  }

  /** 系统开着“减少动效” */
  get systemReduced() {
    return !!reduced?.matches;
  }

  /** 实际生效的动效档位 */
  get fx() {
    if (this.#override.fx === 'calm' || this.#override.fx === 'rich') return this.#override.fx;
    return this.motion === 'calm' || this.systemReduced ? 'calm' : 'rich';
  }

  get rich() {
    return this.fx === 'rich';
  }

  /** 按设置里的选择上色。settings = store.settings */
  apply(settings) {
    const o = this.#override.skin;
    const saved = settings.skin === 'neon' ? 'neon' : 'body';
    this.skin = o === 'neon' || o === 'body' ? o : saved;
    this.motion = settings.motion === 'calm' ? 'calm' : 'rich';
    // 留给下次开页面用的是设置里的选择，不是地址里临时看的那种
    const keep = JSON.stringify({ skin: saved, motion: this.motion });
    if (keep !== this.#kept) {
      this.#kept = keep;
      try {
        localStorage.setItem(LS_KEY, keep);
      } catch {
        /* 存不下就算了，只是开页面时可能闪一下 */
      }
    }
    this.#paint();
  }

  /** 用户手动切了：从这一刻起不再理会地址里的临时参数 */
  clearOverride(key) {
    this.#override[key] = null;
  }

  #paint() {
    const changed = root.dataset.skin !== this.skin || root.dataset.fx !== this.fx;
    if (!changed && this.#painted) return;
    this.#painted = true;
    root.dataset.skin = this.skin;
    root.dataset.fx = this.fx;
    this.#cache.clear();
    if (changed) this.emit('change', { skin: this.skin, fx: this.fx });
  }

  /** 机器的速度变了：界面的呼吸跟着变。太快太慢都收一收，免得晃眼或者像没在动。 */
  setBpm(bpm) {
    const v = clamp(Math.round(Number(bpm) || 120), 60, 180);
    if (v === this.bpm) return;
    this.bpm = v;
    root.style.setProperty('--beat', `${(60 / v).toFixed(3)}s`);
  }

  /** 读一个 CSS 变量现在的值，例如 css('--accent') → '#f0562b' */
  css(name) {
    if (!this.#cache.has(name)) this.#cache.set(name, getComputedStyle(root).getPropertyValue(name).trim());
    return this.#cache.get(name);
  }

  /** 把字符串里的 var(--x) 换成现在的值：画布不认 var()，要先换掉 */
  resolve(color) {
    return String(color).replace(/var\((--[\w-]+)\)/g, (_, name) => this.css(name));
  }
}

export const theme = new Theme();
