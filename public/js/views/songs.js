// 曲目：从候选歌单里挑出最终要掌握的 5–10 首。
// 版式：这一页不整页滚动。歌在中间自己滚（一种风格一段，一首歌一张带封面的卡片）；
// 最下面一行固定：选了几首、请教练排顺序，滚到哪儿都够得着。
import { h, debounce } from '../util.js';
import { SONGS, SONG_STYLES } from '../content/songs.js';
import { CHAPTERS } from '../content/curriculum.js';
import { store } from '../store.js';
import { ctx } from '../context.js';
import { coach } from '../coach.js';
import { toast } from '../ui.js';
import { songParts, SONG_PARTS } from '../content/song-parts.js';
import { SongPlayer } from '../song-player.js';
import { songPartsView } from './song-parts.js';
import { songFullView } from './song-full.js';
import { arrangementFor } from '../content/song-arrangements.js';

/**
 * 封面：一排 16 根“音柱”，高矮是拿这首歌的 id 算出来的（每首不一样，每次打开都一样），每拍第一根高一些。
 * 颜色跟着风格走，四种风格四种排法（样式里的 .s-house / .s-hiphop / .s-synth / .s-ambient）。选中的歌，音柱会跟着节拍动。
 */
function cover(song) {
  let seed = [...song.id].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  return h('div', { class: ['song-cover', `s-${song.style}`], 'aria-hidden': 'true' },
    Array.from({ length: 16 }, (_, i) => {
      const beat = i % 4 === 0;
      return h('i', { style: { height: `${Math.round((beat ? 46 : 18) + rand() * (beat ? 50 : 54))}%`, '--i': String(i) } });
    }),
    h('span', { class: 'bpm' }, `约 ${song.bpm} BPM`));
}

// ───────────── 试听 SEQTRAK 版 ─────────────
// 拆好了分轨的歌（content/song-parts.js），封面上有一颗圆键：整首叠起来放 8 小节左右自己停，再点一下也停，同一时间只放一首。
// 放的是“最后在机器上能做出来的样子”，不是原曲。点它不会勾选这首歌。一轨一轨地听在“分轨”那一页（views/song-parts.js）。

const AUDITION_BARS = 8; // 按整圈算：两小节一圈的歌放 4 圈，四小节的放 2 圈
const ICON_PLAY = 'M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5Z';
const ICON_STOP = 'M7 6h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z';
const icon = (d) => h('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, h('path', { d }));
let audition = null; // 正在试听的那一首：{ stop() }

function stopAudition() {
  audition?.stop();
  audition = null;
}

function startAudition(spec, { card, bars, button }) {
  stopAudition();
  const player = new SongPlayer(spec);
  let lit = null;
  // 封面上的 16 根音柱跟着播放头一根根亮（两小节的歌，一小节走一遍）
  player.onStep((s) => {
    lit?.classList.remove('hit');
    lit = s >= 0 ? bars[s % bars.length] : null;
    lit?.classList.add('hit');
  });
  const laps = Math.max(1, Math.round(AUDITION_BARS / spec.bars));
  player.onLap = (lap) => lap >= laps && audition === me && stopAudition();
  const me = {
    stop() {
      player.stop();
      card.classList.remove('playing');
      button.replaceChildren(icon(ICON_PLAY));
      button.setAttribute('aria-pressed', 'false');
    },
  };
  audition = me;
  card.classList.add('playing');
  button.replaceChildren(icon(ICON_STOP));
  button.setAttribute('aria-pressed', 'true');
  player.start();
}

// 学到第几章能开始这首（从“第 2 章后可以开始”这样的字里取；取不到排到最后）
const chapterOf = (song) => Number(/第\s*(\d+)\s*章/.exec(song.ready)?.[1] ?? 99);
// 一种风格里的先后：难度低的在前，难度一样时能开始得早的在前（用户 2026-11-11 要的）
const byEase = (a, b) => a.level - b.level || chapterOf(a) - chapterOf(b);

// “请啾啾帮我排顺序”：排的规则写死在这里（用户 2026-11-11 定的“跟着课程排”），和每首的数据一起放进“当前现场”；
// 侧栏里替学生问出去的只是一句话（规则塞进问题里，对话里看着像学生念了一段规章）
const ORDER_RULES = `排学习顺序的规则（学生点了“请啾啾帮我排顺序”时用）：
1. 先看“学到第几章能开始”：能开始得早的排前面，跟着课程走；
2. 能开始的章一样时，难度低的在前；
3. 再一样时，尽量让不同风格穿插着来，别连着几首同一种风格；
4. 对照学生现在学到哪、课程现在做到第几章，标出哪几首现在就能开始、哪几首要等学完第几章（还没上线的章照实说）。
每首一行：歌名、什么时候能开始、一句话说它主要练什么。学生自己加的歌（如果有）也排进去：先判断适不适合在 SEQTRAK 上做、大概相当于第几章的难度，不适合的直接说。最后用一句话说为什么第一首是它。`;
const ORDER_ASK = '这是我想学的歌，帮我排一个学习顺序吧。';

export function songsView(view, id, full) {
  if (id && full) return songFullView(view, id);
  if (id) return songPartsView(view, id);
  const picked = new Set(store.data.songs.picked || []);
  const counter = h('b', {});
  // 交给啾啾的“当前现场”：每首选中的歌的全部信息，加上学生学到哪、课程做到哪（排顺序全靠这几样）
  const describe = () => {
    const list = SONGS.filter((s) => picked.has(s.id));
    const line = (s) => `- 《${s.title}》${s.artist}：${SONG_STYLES[s.style].label}，约 ${s.bpm} BPM，难度 ${s.level}（满分 4），主要练${s.learn.join('、')}；${s.ready}`;
    const live = CHAPTERS.filter((c) => !c.soon).map((c) => c.no);
    const doneCh = CHAPTERS.filter((c) => !c.soon && c.lessons?.length && c.lessons.every((l) => store.lesson(l.id).done)).map((c) => c.no);
    ctx.set('曲目页（挑选要学的歌）', [
      `学生目前选中的歌：${list.length ? `\n${list.map(line).join('\n')}` : '还没有选'}`,
      store.data.songs.wish ? `学生自己想加的歌：${store.data.songs.wish}` : '',
      `课程现在上线到第 ${Math.max(...live)} 章（第 ${Math.max(...live) + 1}–8 章还没做）；学生已经学完的章：${doneCh.length ? doneCh.map((n) => `第 ${n} 章`).join('、') : '还没有'}。`,
      '候选单是学生自己挑的：原来 11 首是他勾过“听过、能哼出来”的（Hip-hop 他只听过一首）；后来他要“进过排行榜的”，又加了 16 首（他全勾了，不一定都听过）。推荐别的歌时，挑流行度高、上过排行榜的。',
      `已经拆好 SEQTRAK 版分轨、能在这一页试听的歌：${SONGS.filter((s) => SONG_PARTS[s.id]).map((s) => `《${s.title}》`).join('、')}（每首都有一节“一轨一轨搭出来”的课，从分轨页进；都是凭资料写的简化版。原来那 11 首学生听过、认了编曲；后加的 16 首还没听）。`,
      ORDER_RULES,
    ].filter(Boolean).join('\n'));
  };
  const save = () => {
    store.update((d) => (d.songs.picked = [...picked]));
    counter.textContent = `已选 ${picked.size} 首`;
    describe();
  };

  const card = (song) => {
    const style = SONG_STYLES[song.style];
    const spec = songParts(song.id);
    const art = cover(song);
    // 拆好了分轨的歌：封面上一颗试听键，正文里一行“一轨一轨听 →”（这两样都不勾选这首歌，见下面的 own()）
    const play = spec && h('button', { class: 'cover-play', type: 'button', 'aria-label': `试听「${song.title}」在 SEQTRAK 上做出来的样子`, 'aria-pressed': 'false', dataset: { sfx: 'none' } }, icon(ICON_PLAY));
    const el = h('div', { class: ['song', picked.has(song.id) && 'picked'], role: 'button', tabindex: '0', 'aria-pressed': String(picked.has(song.id)), style: { '--c': style.color } },
      art,
      play,
      h('span', { class: 'check' }, '✓'),
      h('div', { class: 'song-body' },
        h('h3', {}, song.title),
        h('div', { class: 'artist' }, `${song.artist} · ${song.year}`),
        h('p', {}, song.why),
        h('div', { class: 'song-learn' }, h('b', {}, '主要练'), song.learn.join(' · ')),
        spec && h('div', { class: 'song-parts' },
          h('span', {}, h('b', {}, 'SEQTRAK 版'), `已拆成 ${spec.parts.length} 条分轨`),
          h('span', { class: 'song-parts-go' },
            h('a', { class: 'btn sm', href: `#/songs/${song.id}` }, '一轨一轨听 →'),
            // 有段落的完整版（content/song-arrangements.js）：多一个入口
            arrangementFor(song.id) && h('a', { class: 'btn sm primary', href: `#/songs/${song.id}/full` }, '完整版 →'))),
        h('div', { class: 'song-foot' },
          h('span', { class: 'lv' }, '难度', h('span', { class: 'diff', role: 'img', 'aria-label': `难度 ${song.level}，最高 4` }, [1, 2, 3, 4].map((i) => h('i', { class: i <= song.level ? 'on' : '' })))),
          h('span', { class: 'when' }, song.ready)),
      ),
    );
    const toggle = () => {
      if (picked.has(song.id)) picked.delete(song.id);
      else picked.add(song.id);
      el.classList.toggle('picked', picked.has(song.id));
      el.setAttribute('aria-pressed', String(picked.has(song.id)));
      save();
    };
    // 卡片里自己的按钮和链接（试听、一轨一轨听）点了只做它们自己的事，不勾选。
    // 看事件路过的那一串元素，不看 e.target.closest()：试听键点下去会换掉自己里面的图标，事件冒到卡片时 e.target 已经不在页面上了
    const own = (e) => e.composedPath().some((n) => n !== el && n instanceof Element && n.matches('button, a') && el.contains(n));
    play?.addEventListener('click', () => {
      if (el.classList.contains('playing')) stopAudition();
      else startAudition(spec, { card: el, bars: [...art.querySelectorAll('i')], button: play });
    });
    el.addEventListener('click', (e) => {
      if (!own(e)) toggle();
    });
    el.addEventListener('keydown', (e) => {
      if (own(e)) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });
    return el;
  };

  const wish = h('textarea', { class: 'input', placeholder: '候选里没有、但你特别想学的歌或艺人，写在这里（一行一个）。啾啾会评估难度，告诉你放在哪个阶段合适。' }, store.data.songs.wish || '');
  wish.addEventListener('input', debounce(() => {
    store.update((d) => (d.songs.wish = wish.value.trim()));
    describe();
  }, 500));

  const scroll = h('div', { class: 'songs-scroll' },
    h('div', { class: 'page-head' },
      h('h1', {}, '曲目'),
      h('p', {}, '这些都是你挑的歌——你听过的，和上过排行榜的热门——按五种风格分好了，都是结构清楚、层次不多、适合在 SEQTRAK 上一层层搭出来的。点卡片勾选你最想学的，目标是最后留下 5–10 首，可以随时回来改。封面上带圆键的，是已经拆成 SEQTRAK 分轨的歌：听到的是最后在机器上能做出来的样子，不是原曲。'),
    ),
    Object.entries(SONG_STYLES).map(([key, style]) => {
      const songs = SONGS.filter((s) => s.style === key).sort(byEase);
      return [
        h('h2', { class: 'group-title', style: { '--c': style.color } }, h('i', { class: 'dot' }), style.label, h('span', {}, songs.length > 1 ? `${songs.length} 首 · 由易到难` : `${songs.length} 首`)),
        h('div', { class: 'songs' }, songs.map(card)),
      ];
    }),
    h('div', { class: 'card songs-wish' },
      h('h3', {}, '还想学别的？'),
      wish),
  );

  view.classList.add('fixed');
  view.append(h('div', { class: 'songs-page' },
    scroll,
    h('div', { class: 'songs-bar' },
      counter,
      h('span', { class: 'muted small' }, '建议 5–10 首；先少选几首也没关系。'),
      h('span', { class: 'spacer' }),
      h('button', {
        class: 'btn primary', type: 'button',
        onclick: () => {
          if (!picked.size && !store.data.songs.wish) {
            toast('先勾几首再问啾啾。', '', 3000);
            return;
          }
          describe();
          coach.ask(ORDER_ASK, { format: 'plan' });
        },
      }, '请啾啾帮我排顺序'),
    ),
  ));
  save();
  return {
    destroy() {
      stopAudition();
      view.classList.remove('fixed');
    },
  };
}
