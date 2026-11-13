// 和啾啾说话。小鸟本身（飞到哪儿、气泡怎么摆、怎么叫）在 jiu.js；这里管“说什么、怎么说”。
// 不是聊天窗口（用户 2026-11-13：前端要体现啾啾的特点，不要像传统的 coding agent）：
//   · 点一下啾啾（或者左下角它的窝），它问“啾！怎么啦？”，脚下是几个按现在场合挑的选项（页面用 coach.offer() 给）；打字问是最后一个选项。
//   · 即时回答一句一句从它身边冒出来（点一下看下一句）；说到机器上的哪个键、屏幕上又正好有机器的图，它就飞过去指着。
//   · “这个键是干嘛的？”：点哪个键，它飞过去讲（用按键百科 controls.js，不调 AI，马上就有）。
//   · 要细说、要留下来的（点评、排计划、“写张小纸条”）：它歪着头想一会儿，递一张小纸条，可以收进“啾啾的纸条本”，以后随时翻。
//   · 它也会自己冒出来说一句（coach-nudge.js → nudge()）。
// 全都走即时引擎（DeepSeek / Kimi 这类；用户 2026-11-13：“全都走即时引擎吧，我们也没什么特别难的问题”）：一句一句和小纸条只是说法不同，
// 小纸条在服务器那边按 format: 'note' / 'plan' 换写法。即时引擎没配好时服务器会换成深度引擎（Codex），那样就慢一些。
// 对话里不露引擎名（用户 2026-11-11：对话里该是教练，不是 GPT）。
// 聊过的话不摆出来（没有聊天记录那一栏），只留最近几轮给 AI 当上下文；要留下来的东西进纸条本（store.data.notes）。
import { h, rich, richBlocks, clamp, uid } from './util.js';
import { api } from './api.js';
import { ctx } from './context.js';
import { store } from './store.js';
import { sfx } from './sfx.js';
import { shownPanels } from './device-panel.js';
import { CONTROLS, controlInfo } from './controls.js';
import * as jiu from './jiu.js';
import { findLesson } from './content/curriculum.js';
import { levelById } from './content/classroom.js';

const REVIEW = '请点评我刚才这一局，告诉我最该改进的一点，以及接下来怎么练。';
const plain = (s) => String(s).replace(/<[^>]+>/g, '').replace(/\*\*/g, '');
const readMs = (s) => clamp(1500 + plain(s).length * 130, 2400, 9000);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function speak(text) {
  if (!store.settings.speak || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text.replace(/[*`[\]#]/g, ''));
  u.lang = 'zh-CN';
  u.rate = 1.05;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

/** 屏幕上最大的那一张机器的图（没有就是 null） */
export function findPanel() {
  return shownPanels()[0] || null;
}

// 回答里提到了哪个键：按键百科里的英文名（MUTE、KICK、BPM + …），还有 Drum key 5、Synth key 3 这种
const NAMES = (() => {
  const list = [];
  for (const [id, c] of Object.entries(CONTROLS)) {
    for (const n of new Set([id, String(c.en || '').replace(/\s*旋钮$/, '')])) {
      if (n.length >= 3 && /^[A-Z][A-Z0-9 +\-−/↑]*$/.test(n)) list.push([new RegExp(`(^|[^A-Za-z0-9])${n.replace(/[+\-−/↑ ]/g, (ch) => (ch === ' ' ? '\\s?' : `\\${ch}`))}(?![A-Za-z0-9])`), id]);
    }
  }
  return list.sort((a, b) => b[0].source.length - a[0].source.length);
})();
function mentionedKey(text, panel) {
  if (!panel) return null;
  const t = plain(text);
  const dk = t.match(/Drum key\s*(\d{1,2})/i);
  if (dk && panel.has(`DK${dk[1]}`)) return `DK${dk[1]}`;
  const sk = t.match(/Synth key\s*(\d)/i);
  if (sk && panel.has(`SK${sk[1]}`)) return `SK${sk[1]}`;
  // 一句里提到好几个键：先飞去先提到的那个
  let best = null;
  for (const [re, id] of NAMES) {
    const m = re.exec(t);
    if (m && panel.has(id) && (!best || m.index < best[0])) best = [m.index, id];
  }
  return best ? best[1] : null;
}

/** 把攒着的字切成一句一句：在句号、问号、叹号、分号、换行处断开。final = 后面没有了，剩下的也算一句 */
function takeSentences(buf, final) {
  const out = [];
  let rest = buf;
  for (;;) {
    const m = rest.match(/^[\s\S]*?[。！？!?；;\n]/);
    if (!m) break;
    let s = m[0];
    rest = rest.slice(s.length);
    const tail = rest.match(/^[”’」』）)\]。！？!?…]+/);
    if (tail) {
      s += tail[0];
      rest = rest.slice(tail[0].length);
    }
    s = s.replace(/^\s*(?:[-•*]|\d+[.)、])\s+/, '· ').trim();
    if (s) out.push(s);
  }
  if (final && rest.trim()) {
    out.push(rest.replace(/^\s*(?:[-•*]|\d+[.)、])\s+/, '· ').trim());
    rest = '';
  }
  return [out, rest];
}

/** 小纸条的标题：深度回答的第一行（服务器让它这样写）；没有就从问题里截一段 */
function splitTitle(text, question) {
  const lines = String(text).trim().split('\n');
  const first = (lines[0] || '').replace(/^#+\s*|^标题[:：]\s*|\*\*/g, '').trim();
  if (lines.length > 1 && first && first.length <= 22 && !/[。！？，,]$/.test(first)) return { title: first, body: lines.slice(1).join('\n').trim() };
  const q = plain(question).replace(/^请|[，。？！,.?!].*$/g, '').trim();
  return { title: q ? q.slice(0, 16) : '啾啾的小纸条', body: String(text).trim() };
}

// ───── 小纸条上能点的东西（用户 2026-11-13 要的）─────
// 课号（1.2、5.1 → 那节课）、小课堂的关（T1、R2、F1 → 那一关）、“练习场”、机器上的按键（[REC SAMPLE]、SAMPLER、Drum key 5 → 啾啾飞过去讲它）。
// 服务器让 AI 照这个样子写（server/coach.mjs 的 PERSONA）。只认得出确实存在的课和关；同一样东西一张纸条上只变一次链接，免得满纸都是下划线。
const KEY_NAMES = (() => {
  const map = new Map();
  for (const [id, c] of Object.entries(CONTROLS)) {
    for (const n of [id, String(c.en || '').replace(/\s*旋钮$/, '')]) {
      if (n.length >= 3 && /^[A-Z][A-Z0-9 +\-−/↑]*$/.test(n) && !map.has(n)) map.set(n, id);
    }
  }
  return map;
})();
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');
const LINK_RE = new RegExp([
  '(?<lesson>(?<![\\w.])[0-8]\\.\\d{1,2}(?![\\d.])(?!\\s*(?:秒|毫秒|ms|%|倍|BPM|Hz|拍|小节|分钟|版|格)))',
  '(?<level>(?<![A-Za-z0-9])[TRF]\\d{1,2}(?![A-Za-z0-9]))',
  '(?<page>练习场)',
  `(?<key>(?<![A-Za-z0-9])(?:Drum key\\s?\\d{1,2}|Synth key\\s?\\d|${[...KEY_NAMES.keys()].sort((a, b) => b.length - a.length).map(escRe).join('|')})(?![A-Za-z0-9]))`,
].join('|'), 'g');

function keyIdOf(text) {
  const t = String(text).replace(/\s+/g, ' ').trim();
  const dk = t.match(/^Drum key\s?(\d{1,2})$/i);
  if (dk) return Number(dk[1]) >= 1 && Number(dk[1]) <= 16 ? `DK${dk[1]}` : null;
  const sk = t.match(/^Synth key\s?(\d)$/i);
  if (sk) return Number(sk[1]) >= 1 && Number(sk[1]) <= 7 ? `SK${sk[1]}` : null;
  return KEY_NAMES.get(t) || KEY_NAMES.get(t.toUpperCase()) || null;
}

/** 把一段纸条正文里认得出的课、关、按键变成能点的 */
export function linkify(root) {
  const seen = new Set();
  const once = (k) => !seen.has(k) && seen.add(k);
  const keyAttrs = (id) => ({ dataset: { key: id }, role: 'button', tabindex: '0', title: '点一下，啾啾讲讲这个键' });
  // [PLAY] 这样的键帽
  for (const k of root.querySelectorAll('kbd')) {
    const id = keyIdOf(k.textContent);
    if (!id) continue;
    seen.add(`key:${id}`);
    k.classList.add('jiu-key');
    for (const [a, v] of Object.entries({ role: 'button', tabindex: '0', title: '点一下，啾啾讲讲这个键' })) k.setAttribute(a, v);
    k.dataset.key = id;
  }
  // 正文里的字
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest('a, kbd, code, [data-key]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const texts = [];
  while (walker.nextNode()) texts.push(walker.currentNode);
  let any = seen.size > 0;
  for (const node of texts) {
    const s = node.nodeValue;
    const parts = [];
    let last = 0;
    for (const m of s.matchAll(LINK_RE)) {
      const g = m.groups;
      let el = null;
      if (g.lesson) {
        const id = g.lesson.replace('.', '-');
        if (findLesson(id) && once(`lesson:${id}`)) el = h('a', { class: 'jiu-link', href: `#/lesson/${id}`, title: '去这节课' }, g.lesson);
      } else if (g.level) {
        if (levelById(g.level) && once(`level:${g.level}`)) el = h('a', { class: 'jiu-link', href: `#/classroom/${g.level}`, title: '去小课堂的这一关' }, g.level);
      } else if (g.page) {
        if (once('page:arcade')) el = h('a', { class: 'jiu-link', href: '#/arcade', title: '去练习场' }, g.page);
      } else if (g.key) {
        const id = keyIdOf(g.key);
        if (id && once(`key:${id}`)) el = h('span', { class: 'jiu-link', ...keyAttrs(id) }, g.key);
      }
      if (!el) continue;
      parts.push(s.slice(last, m.index), el);
      last = m.index + m[0].length;
    }
    if (!parts.length) continue;
    any = true;
    parts.push(s.slice(last));
    node.replaceWith(...parts.filter((p) => p !== ''));
  }
  if (any) root.append(h('p', { class: 'jiu-paper-tip' }, '画线的能点：课和小关点了直接过去，按键点了我飞过去讲。'));
  return root;
}

const notes = () => (Array.isArray(store.data.notes) ? store.data.notes : []);

class Coach {
  status = null;
  #history = []; // 最近几轮（不显示，只给 AI 当上下文）
  #offers = [];
  #busy = null; // 'fast' 一句一句的 / 'note' 小纸条：正在等哪种回答
  #run = 0; // 第几次开口；开始新的一次，旧的那次不再往下说
  #stopPick = null;

  /** 正在和你说着话（气泡开着，而且不是它主动冒出来的那一句） */
  get open() {
    return jiu.talking() === 'talk';
  }

  mount() {
    jiu.mount(document.querySelector('#coach-toggle .jiu-nest'), { tap: () => this.toggle() });
    this.refreshStatus();
  }

  toggle(force) {
    const want = force ?? !this.open;
    if (want) this.menu();
    else this.close();
  }

  close() {
    this.#stopPick?.();
    this.#run++;
    jiu.hush();
  }

  /** 旧的侧栏刷新快捷按钮用的；选项现在是点开啾啾时现挑的，这里什么都不用做 */
  renderQuick() {}

  /**
   * 页面按场合给啾啾的选项（点开它时排在最前面）。list = [[文字, 点了做什么], …]，或者返回它的函数（每次点开时现算）。
   * 返回“不给了”的函数（页面换走、这一步做完时调）。
   */
  offer(list) {
    this.#offers.push(list);
    return () => {
      const i = this.#offers.indexOf(list);
      if (i >= 0) this.#offers.splice(i, 1);
    };
  }

  async refreshStatus() {
    try {
      this.status = (await api.get('/api/status')).ai;
    } catch {
      this.status = null;
    }
    return this.status;
  }

  #chips() {
    const out = [];
    for (const o of this.#offers) for (const c of (typeof o === 'function' ? o() : o) || []) if (c) out.push(c);
    if (ctx.lastResult && !out.some((c) => c[2]?.review)) out.push(['点评刚才那局', () => this.ask(REVIEW, { note: true })]);
    if (findPanel()) out.push(['这个键是干嘛的？', () => this.pickKey()]);
    if (out.length < 3) out.push(['打个比方', () => this.ask('用生活里的例子或者 DJ 的经验给我打个比方，讲讲我现在在学的东西。')]);
    out.push(['打字问…', () => this.typeAsk()]);
    if (notes().length) out.push([`纸条本 · ${notes().length}`, () => this.notebook()]);
    out.push(['没事', () => this.close(), { ghost: true }]);
    return out;
  }

  /** 点开啾啾：“啾！怎么啦？”加上按场合挑的几个选项 */
  menu() {
    this.#stopPick?.();
    this.#run++;
    const line = this.#busy === 'note' ? '啾！刚才那张纸条我还在写，马上给你。现在要什么？' : '啾！怎么啦？';
    jiu.say({ html: line, chips: this.#chips(), mood: 'listen', call: 'greet', act: 'hop' });
  }

  typeAsk() {
    jiu.say({
      html: '想问什么？直接写。想听细一点、能留下来的，就点“写张小纸条”。',
      ask: { placeholder: '比如：swing 是什么意思？', onSubmit: (text, asNote) => this.ask(text, { note: asNote }) },
      mood: 'listen',
    });
  }

  #remember(role, content) {
    if (!content) return;
    this.#history.push({ role, content });
    this.#history = this.#history.slice(-10);
  }

  /**
   * 向啾啾提问。默认一句一句地答；note: true = 写成一张小纸条（细一点，可以收进纸条本）；format: 'plan' = 排一份计划（也是小纸条）。
   * engine: 'deep' 是旧的写法，现在当作 note: true（不再专门用深度引擎）
   */
  ask(text, { note = false, format, engine } = {}) {
    this.#stopPick?.();
    if (this.#busy) {
      jiu.say({ html: this.#busy === 'note' ? '刚才那张纸条我还在写呢，马上给你，等我一下！' : '等我说完这个～', mood: 'think', ms: 3200 });
      return;
    }
    if (this.status && !this.status.fast.ready && !this.status.deep.ready) {
      jiu.say({ html: '我现在想不了事情：还没有可用的 AI 引擎。去设置里填好 key 就行；按键是干嘛的，我还是能讲。', mood: 'oops', call: 'oops', chips: [['去设置', () => (location.hash = '#/settings'), { primary: true }], ['好', null, { ghost: true }]] });
      this.refreshStatus();
      return;
    }
    this.#remember('user', text);
    if (note || format === 'plan' || engine === 'deep') this.#note(text, { format: format === 'plan' ? 'plan' : 'note' });
    else this.#fast(text);
  }

  /** 即时回答：一句一句地说 */
  #fast(text) {
    const run = ++this.#run;
    this.#busy = 'fast';
    const queue = [];
    let buf = '';
    let full = '';
    let done = false;
    let deep = false; // 即时引擎没配好，服务器换成了深度引擎（要十几秒）：那就改成写小纸条
    let wake = null;
    const poke = () => {
      wake?.();
      wake = null;
    };
    let unpoint = null;
    let pointed = null;
    const finish = () => {
      this.#busy = null;
      if (deep) jiu.setMood('idle');
    };
    jiu.say({ html: '嗯……', mood: 'think', call: 'think' });

    const play = async () => {
      let first = true;
      let last = '';
      for (;;) {
        if (run !== this.#run) break;
        if (!queue.length) {
          if (done) break;
          await new Promise((r) => (wake = r));
          continue;
        }
        let s = queue.shift();
        while (queue.length && plain(s).length < 10) s += queue.shift(); // 太短的并到下一句
        const panel = findPanel();
        const key = mentionedKey(s, panel);
        if (key && key !== pointed) {
          unpoint?.();
          pointed = key;
          unpoint = jiu.point(() => (panel.el.isConnected ? panel.spot([key]) : null));
          panel.flash?.(key);
        }
        last = s;
        const why = await jiu.say({ html: rich(s), mood: 'talk', call: first ? 'chatter' : null, act: key ? 'peck' : null, next: true, ms: readMs(s) });
        first = false;
        if (why === 'replaced' || why === 'hushed') {
          run === this.#run && this.#run++;
          break;
        }
      }
      if (run === this.#run && last) {
        // 最后一句留着，下面给几个选项
        const why = await jiu.say({
          html: rich(last), quiet: true, mood: 'idle',
          chips: [['懂了', () => this.close(), { primary: true }], ['写成小纸条', () => this.ask(text, { note: true })], ['再问一句', () => this.typeAsk()]],
          ms: 30000,
        });
        void why;
      }
      unpoint?.();
    };

    api.chat({
      engine: 'fast',
      messages: this.#history,
      contextText: ctx.describe(),
      onEvent: (e) => {
        if (e.engine === 'deep' && !deep) {
          deep = true;
          this.#busy = 'note';
          jiu.setMood('think');
          jiu.say({ html: '这个我得多想一会儿……想好了给你一张小纸条。', mood: 'think', call: 'think', ms: 4200 });
        }
        if (e.delta) {
          full += e.delta;
          if (deep) return;
          buf += e.delta;
          const [out, rest] = takeSentences(buf, false);
          buf = rest;
          queue.push(...out);
          poke();
        }
        if (e.done) {
          finish();
          this.#remember('assistant', full);
          speak(full);
          if (deep) {
            if (run === this.#run) this.#run++;
            done = true;
            poke();
            this.#paper(text, full);
            return;
          }
          const [out] = takeSentences(buf, true);
          buf = '';
          queue.push(...out);
          done = true;
          poke();
        }
        if (e.error) {
          finish();
          done = true;
          queue.length = 0;
          poke();
          this.#history.pop();
          if (run === this.#run) this.#run++;
          unpoint?.();
          this.#failed(e);
        }
      },
    });
    play();
  }

  /** 写成一张小纸条：歪着头想一会儿（即时引擎几秒钟），递一张小纸条 */
  #note(text, { format = 'note' } = {}) {
    this.#busy = 'note';
    jiu.setMood('think');
    jiu.say({ html: format === 'plan' ? '好，我来排一排……排好了写在小纸条上给你。' : '我把它写成一张小纸条，稍等一下。', mood: 'think', call: 'think', ms: 4200 });
    let full = '';
    api.chat({
      engine: 'fast',
      format,
      messages: this.#history,
      contextText: ctx.describe(),
      onEvent: (e) => {
        if (e.delta) full += e.delta;
        if (e.done) {
          this.#busy = null;
          jiu.setMood('idle');
          this.#remember('assistant', full);
          speak(full);
          this.#paper(text, full);
        }
        if (e.error) {
          this.#busy = null;
          jiu.setMood('idle');
          this.#history.pop();
          this.#failed(e);
        }
      },
    });
  }

  #failed(e) {
    jiu.say({ html: `啾……${esc(e.error || '出了点问题')}`, mood: 'oops', call: 'oops', chips: [['好', null, { primary: true }]] });
    if (e.code === 'NO_AI') this.refreshStatus();
  }

  /**
   * 递一张小纸条；音游打着的时候先揣着，打完再给。
   * 纸条上的课号、小课堂的关、按键能点（linkify）：课和关直接跳过去，纸条跟着啾啾留着；按键是啾啾飞过去讲，讲完能“回到纸条”。
   */
  #paper(question, text) {
    const { title, body } = splitTitle(text, question);
    let saved = false;
    const show = (fresh) => {
      this.#run++;
      jiu.say({
        paper: { title, node: this.#noteBody(body, () => show(false)) },
        mood: fresh ? 'happy' : 'talk', call: fresh ? 'ok' : null, act: fresh ? 'hop' : null,
        chips: saved ? [['合上', null, { primary: true }]] : [
          ['收进纸条本', () => {
            saved = true;
            store.update((d) => {
              d.notes = [...(Array.isArray(d.notes) ? d.notes : []), { id: uid(), at: new Date().toISOString(), title, body, q: plain(question).slice(0, 200) }].slice(-80);
            });
            jiu.say({ html: `收好啦。纸条本里现在有 ${notes().length} 张，点我就能翻。`, mood: 'happy', call: 'ok', act: 'nod', ms: 3200 });
          }, { primary: true }],
          ['先不收', null, { ghost: true }],
        ],
      });
    };
    const wait = () => (sfx.held ? setTimeout(wait, 1200) : show(true));
    wait();
  }

  /** 纸条的正文：能点的地方变成链接。back = 讲完一个键之后“回到纸条”怎么回来 */
  #noteBody(body, back) {
    const node = linkify(h('div', { class: 'jiu-paper-body', html: richBlocks(body) }));
    const keyAt = (target) => target.closest?.('[data-key]');
    node.addEventListener('click', (e) => {
      const k = keyAt(e.target);
      if (!k) return; // 课、小课堂、练习场是普通链接：照常跳过去
      e.preventDefault();
      e.stopPropagation();
      this.#keyFromNote(k.dataset.key, back);
    });
    node.addEventListener('keydown', (e) => {
      const k = keyAt(e.target);
      if (!k || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      this.#keyFromNote(k.dataset.key, back);
    });
    return node;
  }

  /** 纸条上点了一个键：这一页有机器的图就在这儿讲，没有就去面板页讲 */
  #keyFromNote(id, back) {
    const panel = findPanel();
    if (panel?.has(id)) {
      this.explain(id, panel, { back });
      return;
    }
    jiu.say({ html: '去面板那一页，我指给你看。', mood: 'talk', call: 'look' });
    location.hash = '#/panel';
    setTimeout(() => this.explain(id, findPanel(), { back }), 800);
  }

  /** 纸条本：收过的小纸条，新的在上面 */
  notebook() {
    const list = notes().slice().reverse();
    if (!list.length) {
      jiu.say({ html: '纸条本还是空的。我认真想过的回答会写成小纸条，你收下的都在这里。', mood: 'talk', ms: 4000 });
      return;
    }
    const day = (iso) => {
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? '' : `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
    };
    jiu.say({
      paper: {
        title: `啾啾的纸条本 · ${list.length} 张`,
        node: h('ol', { class: 'jiu-notes' }, list.map((n) => h('li', {},
          h('button', { type: 'button', 'data-sfx': 'none', onclick: () => this.showNote(n.id) }, h('b', {}, n.title), h('small', {}, day(n.at)))))),
      },
      mood: 'happy',
      chips: [['合上', null, { primary: true }]],
    });
  }

  showNote(id) {
    const n = notes().find((x) => x.id === id);
    if (!n) return this.notebook();
    jiu.say({
      paper: { title: n.title, node: this.#noteBody(n.body, () => this.showNote(id)) },
      mood: 'talk',
      chips: [
        ['回纸条本', () => this.notebook(), { primary: true }],
        ['扔掉这张', () => {
          store.update((d) => {
            d.notes = (Array.isArray(d.notes) ? d.notes : []).filter((x) => x.id !== id);
          });
          this.notebook();
        }, { ghost: true }],
      ],
    });
  }

  /** 指哪讲哪：点机器图上的一个键，啾啾飞过去讲它是干什么的 */
  pickKey() {
    const panel = findPanel();
    if (!panel) {
      jiu.say({ html: '这一页上没有机器的图。去「面板」那一页，点哪个键我讲哪个。', chips: [['去面板', () => (location.hash = '#/panel'), { primary: true }], ['好', null, { ghost: true }]] });
      return;
    }
    this.#stopPick?.();
    const onDown = (e) => {
      const node = e.target.closest?.('[data-id]');
      if (node && panel.el.contains(node)) {
        e.preventDefault();
        e.stopPropagation();
        stop();
        this.explain(node.dataset.id, panel);
        return;
      }
      if (e.target.closest?.('.jiu-layer')) return;
      stop();
      jiu.hush();
    };
    const stop = () => {
      panel.el.classList.remove('jiu-picking');
      removeEventListener('pointerdown', onDown, true);
      if (this.#stopPick === stop) this.#stopPick = null;
    };
    this.#stopPick = stop;
    panel.el.classList.add('jiu-picking');
    addEventListener('pointerdown', onDown, true);
    jiu.say({ html: '点一下你想问的那个键，我飞过去讲。', mood: 'listen', call: 'look', chips: [['算了', () => stop(), { ghost: true }]] });
  }

  /** 讲一个键：飞过去，一句一句说（按键百科里写的），最后给几个选项。back = 从小纸条点过来的：最后多一个“回到纸条” */
  async explain(id, panel = findPanel(), { back } = {}) {
    const info = controlInfo(id) || { en: id, zh: '', what: '' };
    const lines = [`这是 <b>${esc(info.en)}</b>${info.zh ? `：${esc(info.zh)}` : ''}。`,
      ...String(info.what || '').split(/(?<=。)/).map((s) => s.trim()).filter(Boolean).map(rich),
      ...(info.tips || []).slice(0, 1).map((t) => rich(`小提醒：${t}`))];
    const run = ++this.#run;
    const unpoint = panel ? jiu.point(() => (panel.el.isConnected ? panel.spot([id]) : null)) : null;
    panel?.flash?.(id);
    try {
      for (let i = 0; i < lines.length; i++) {
        const lastOne = i === lines.length - 1;
        const why = await jiu.say({
          html: lines[i], mood: 'talk', call: i === 0 ? 'look' : null, act: i === 0 ? 'peck' : null,
          next: !lastOne, ms: lastOne ? 30000 : readMs(lines[i]),
          chips: !lastOne ? [] : back ? [['回到纸条', back, { primary: true }], ['再问一个键', () => this.pickKey()]] : [['再问一个键', () => this.pickKey(), { primary: true }], ['懂了', null, { ghost: true }]],
        });
        if (run !== this.#run || why === 'replaced' || why === 'hushed' || why === 'chip') break;
      }
    } finally {
      unpoint?.();
    }
  }

  /**
   * 一句一句地说一串写好的话（示范、卡住时指位置这些，不调 AI）。
   * beats = [{ html, point: () => rect | null, mood, call, act }, …]；end = 最后一句下面的选项
   */
  async walk(beats, end = [['懂了', null, { primary: true }]]) {
    const run = ++this.#run;
    let unpoint = null;
    try {
      for (let i = 0; i < beats.length; i++) {
        const b = beats[i];
        const lastOne = i === beats.length - 1;
        if (b.point) {
          unpoint?.();
          unpoint = jiu.point(b.point);
          await new Promise((r) => setTimeout(r, 380)); // 先飞过去，再开口
          if (run !== this.#run) return;
        }
        const why = await jiu.say({
          html: b.html, mood: b.mood || 'talk', call: b.call ?? (i === 0 ? 'chatter' : null), act: b.act || null,
          next: !lastOne, ms: lastOne ? 30000 : readMs(b.html), chips: lastOne ? end : [],
        });
        if (run !== this.#run || why === 'replaced' || why === 'hushed' || why === 'chip') return;
      }
    } finally {
      unpoint?.();
    }
  }

  /** 它主动冒出来说一句（coach-nudge.js 用） */
  nudge(text, { mood = 'talk', ms = 14000, ask } = {}) {
    jiu.say({
      kind: 'nudge', html: rich(text), mood, call: 'look', act: 'hop', ms,
      chips: [[ask ? '帮我看看' : '和啾啾说说', () => (ask ? this.ask(ask) : this.menu()), { primary: true }], ['知道了', null, { ghost: true }]],
    });
  }

  hushNudge() {
    if (jiu.talking() === 'nudge') jiu.hush();
  }
}

export const coach = new Coach();
