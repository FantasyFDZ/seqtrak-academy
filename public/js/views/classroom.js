// 小课堂：乐理、节奏、效果、DJ 四条线的小关。路由（都走 main.js 里那两条 #/classroom 的路由）：
//   #/classroom          四条线的列表
//   #/classroom/route    推荐路线：跨四条线的一条路，每一站配一段主线课程
//   #/classroom/cards    知识卡册：学完一关拿一张卡，铜 / 银 / 金三种边；金卡 = 啾啾窝里一根羽毛
//   #/classroom/daily    每日五分钟：间隔复习（classroom-review.js），做完算当天练过
//   #/classroom/<关>     一关：一句话 → 玩一玩 → 挑战（铜 / 银 / 金）→ 用在机器上，按关的种类换说法（content/classroom.js 的 KINDS）
// 进度存在进度文件的 classroom 字段里：{ T1: { done, stars, at, times, box, due, last } }（stars = 拿到的最好的牌：1 铜、2 银、3 金，0 = 跳过了挑战）；
// 每日五分钟记在 classroomDaily 字段里。经验值和徽章都是从这两个字段算的（levels.js），首页地图上每章开头的小关也看 classroom（classroom-minis.js）。
import { h, clear, rich } from '../util.js';
import { store, today } from '../store.js';
import { ctx } from '../context.js';
import { coach } from '../coach.js';
import { mirror } from '../mirror.js';
import { coachFace } from '../coach-face.js';
import { quizPerfect } from '../jiu-eggs.js';
import { sfx } from '../sfx.js';
import { confetti, pop, typeOut } from '../fx.js';
import { LINES, LEVELS, OPEN_LEVELS, KINDS, ROUTE, UNITS, levelById, isOpen, nextOpen, stepsOf, routeNext, stopOf, lineOf } from '../content/classroom.js';
import { findLesson } from '../content/curriculum.js';
import { chartById } from '../content/charts.js';
import { SONGS } from '../content/songs.js';
import { arrangementFor } from '../content/song-arrangements.js';
import { createToy, tierSpec } from '../classroom-toys.js';
import { createBench } from '../classroom-bench.js';
import { askQuiz } from '../classroom-ear.js';
import { createGuide } from '../theory-guide.js';
import { firstReview, afterReview, dailyPlan, dailyDone, dailyCount } from '../classroom-review.js';
import { streaks } from '../levels.js';

// 样式是这一页自己带来的（public/css/classroom.css），不用改 index.html
if (!document.querySelector('link[data-classroom]')) {
  document.head.append(h('link', { rel: 'stylesheet', href: '/css/classroom.css', 'data-classroom': '' }));
}

/** 三档：过了哪一档就拿哪一块牌。金那一档还要“几乎不出错”（玩具给的表现星至少 2 颗） */
export const TIERS = [
  { n: 1, name: '铜', sub: '入门', say: '先拿下它' },
  { n: 2, name: '银', sub: '标准', say: '更难一点' },
  { n: 3, name: '金', sub: '高手', say: '几乎不能错' },
];
const MEDAL = ['', '铜', '银', '金'];
const saved = () => store.data.classroom || {};
const starText = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
const medalChip = (n) => h('span', { class: ['cl-medal', `m${n}`], 'aria-label': n ? `${MEDAL[n]}牌，${n} 颗星` : '学完了，还没拿牌' }, n ? `${starText(n)}` : '☆☆☆');
/** 列表上用的小圆牌：一个字（铜 / 银 / 金），学完了没拿牌是 ✓ */
const medalDot = (n) => h('span', { class: ['cl-mdot', `m${n}`], 'aria-label': n ? `${MEDAL[n]}牌` : '学完了，还没拿牌' }, MEDAL[n] || '✓');
const DEV = new URLSearchParams(location.search);

/**
 * 记下这一关学完了。星星（牌）只增不减。第一次学完时排上复习（明天到期）。
 * 经验值不用另外记：它是从 classroom 这个字段算出来的（levels.js），所以再学一遍不会重复给，拿到更好的牌会补上差额。
 * 返回这一下一共涨了多少经验（当天第一次练习的那一份也在里面；没涨就是 0）。
 */
function complete(id, stars) {
  const before = store.progress().xp;
  store.update((d) => {
    d.classroom ||= {};
    const cur = d.classroom[id] || {};
    // done / stars / at / times 排在前面（tools/mac-check.sh 按这个顺序读），复习安排（box / due / last）跟在后面
    const review = cur.done ? { box: cur.box, due: cur.due, last: cur.last } : firstReview(today());
    d.classroom[id] = { done: true, stars: Math.max(cur.stars || 0, stars), at: cur.at || new Date().toISOString(), times: (cur.times || 0) + 1 };
    for (const [k, v] of Object.entries(review)) if (v !== undefined) d.classroom[id][k] = v;
  });
  store.markPracticed();
  return store.progress().xp - before;
}

// ───────────── 链到别处：课程、曲目、音游 ─────────────

function linkChips(level, { max = 6 } = {}) {
  const L = level.links || {};
  const out = [];
  for (const id of L.lessons || []) {
    const f = findLesson(id);
    if (f) out.push(h('a', { class: 'cl-link k-lesson', href: `#/lesson/${id}` }, h('small', {}, '课程'), `${id.replace('-', '.')} ${f.lesson.title}`));
  }
  for (const id of L.full || []) {
    const s = SONGS.find((x) => x.id === id);
    if (s && arrangementFor(id)) out.push(h('a', { class: 'cl-link k-song', href: `#/songs/${id}/full` }, h('small', {}, '完整版'), s.title));
  }
  for (const id of L.songs || []) {
    const s = SONGS.find((x) => x.id === id);
    if (s) out.push(h('a', { class: 'cl-link k-song', href: `#/songs/${id}` }, h('small', {}, '曲目'), s.title));
  }
  for (const id of L.charts || []) {
    const c = chartById(id);
    if (c) out.push(h('a', { class: 'cl-link k-chart', href: `#/arcade/${id}` }, h('small', {}, '音游'), c.title));
  }
  return out.slice(0, max);
}

// ───────────── 页头：四个入口 ─────────────

function head(now) {
  const done = saved();
  const lit = OPEN_LEVELS.filter((l) => done[l.id]?.done);
  const stars = lit.reduce((n, l) => n + (done[l.id].stars || 0), 0);
  const gold = lit.filter((l) => done[l.id].stars >= 3).length;
  const daily = dailyDone(store.data.classroomDaily, today());
  const tab = (id, href, label, extra) => h('a', { class: ['cl-tab', now === id && 'on'], href, 'data-sfx': 'press' }, label, extra);
  return h('header', { class: 'cl-list-head' },
    h('div', { class: 'cl-head-words' }, h('h1', {}, '小课堂'), h('p', {}, '每关三五分钟，只讲一件事。挑战分铜、银、金三档。')),
    h('nav', { class: 'cl-tabs', 'aria-label': '小课堂的几个入口' },
      tab('lines', '#/classroom', '四条线'),
      tab('route', '#/classroom/route', '推荐路线'),
      tab('cards', '#/classroom/cards', '卡册', h('b', {}, String(lit.length))),
      tab('daily', '#/classroom/daily', '每日五分钟', h('i', { class: ['cl-dot', daily && 'on'], 'aria-label': daily ? '今天做过了' : '今天还没做' }))),
    h('div', { class: 'cl-total' }, h('b', {}, String(lit.length)), ` / ${OPEN_LEVELS.length} 关`, h('span', { class: 'stars' }, `★ ${stars}`), gold ? h('span', { class: 'cl-gold' }, `金 ${gold}`) : null));
}

/** 列表和路线页顶上那一条：路线上的下一关 + 今天的五分钟 */
function nextBar() {
  const done = saved();
  const [nx] = routeNext((id) => !!done[id]?.done, 1);
  const day = dailyDone(store.data.classroomDaily, today());
  const st = streaks(store.data.practiceDays || [], today());
  return h('div', { class: 'cl-nextbar' },
    nx ? h('a', { class: 'cl-next', href: `#/classroom/${nx.id}`, 'data-sfx': 'press', style: { '--c': `var(--${lineOf(nx).color})` } },
      h('span', { class: 'label' }, '按路线，下一关'), h('span', { class: 'no' }, nx.id), h('b', {}, nx.title), h('span', { class: 'muted' }, `${stopOf(nx.id)?.name} · ${KINDS[nx.kind].label}`), h('span', { class: 'go' }, '→'))
      : h('div', { class: 'cl-next' }, h('b', {}, '路线上的关都学完了，啾！'), h('span', { class: 'muted' }, '去卡册把铜卡、银卡升成金卡吧。')),
    h('a', { class: ['cl-daily-mini', day && 'done'], href: '#/classroom/daily', 'data-sfx': 'press' },
      h('span', { class: 'label' }, '每日五分钟'),
      h('b', {}, day ? '今天做完了 ✓' : '今天还没做'),
      h('span', { class: 'muted' }, st.current ? `连续 ${st.current} 天` : '做完算今天练过')));
}

// ───────────── 列表：四条线 ─────────────

function listPage(view) {
  const done = saved();
  const lit = OPEN_LEVELS.filter((l) => done[l.id]?.done);
  ctx.set('小课堂（乐理、节奏、效果、DJ 四条线的小关）', `一共 ${OPEN_LEVELS.length} 关，学完了 ${lit.length} 关${lit.length ? `：${lit.map((l) => `${l.id}「${l.title}」${MEDAL[done[l.id].stars || 0] || ''}`).join('、')}` : ''}。挑战分铜银金三档；另有推荐路线、知识卡册、每日五分钟复习。`);

  const column = (line) => {
    const levels = LEVELS.filter((l) => l.line === line.id);
    const got = levels.filter((l) => done[l.id]?.done).length;
    const nodes = [];
    let unit = null;
    for (const l of levels) {
      // 乐理线按单元分组（关上写 unit）：换了单元先摆一行小标题
      if (l.unit && l.unit !== unit) {
        unit = l.unit;
        const u = UNITS.find((x) => x.id === unit);
        if (u) nodes.push(h('div', { class: 'cl-unit' }, u.name, u.sub && h('small', {}, u.sub)));
      }
      const rec = done[l.id];
      nodes.push(h('a', { class: ['cl-node', `kind-${l.kind}`, rec?.done && 'done', l.kind === 'boss' && 'boss'], href: `#/classroom/${l.id}`, 'data-sfx': 'press' },
        h('span', { class: 'no' }, l.id),
        h('div', { class: 'words' }, h('b', {}, l.title), h('span', {}, `${KINDS[l.kind].label} · ${l.about}`)),
        rec?.done ? medalDot(rec.stars || 0) : h('span', { class: 'go' }, `${l.minutes || 3}′`)));
    }
    return h('section', { class: 'cl-line', style: { '--c': `var(--${line.color})` } },
      h('header', {},
        h('div', { class: 'cl-line-name' }, h('h2', {}, line.name), h('span', { class: 'count' }, `${got} / ${levels.length}`)),
        h('p', {}, line.sub),
        h('div', { class: 'cl-line-bar' }, h('i', { style: { width: `${levels.length ? (got / levels.length) * 100 : 0}%` } }))),
      h('div', { class: 'cl-nodes' }, nodes));
  };

  view.append(h('div', { class: 'cl-page cl-list' }, head('lines'), nextBar(), h('div', { class: 'cl-lines' }, LINES.map(column))));
  return null;
}

// ───────────── 推荐路线 ─────────────

function routePage(view) {
  const done = saved();
  const [nx] = routeNext((id) => !!done[id]?.done, 1);
  ctx.set('小课堂 · 推荐路线', `跨四条线的一条路，一共 ${ROUTE.length} 站：${ROUTE.map((s) => `${s.name}（${s.with}）`).join('、')}。下一关：${nx ? `${nx.id}「${nx.title}」` : '都学完了'}。`);
  const stops = ROUTE.map((s, si) => {
    const got = s.ids.filter((id) => done[id]?.done).length;
    const f = findLesson(s.lesson);
    return h('section', { class: ['cl-stop', got === s.ids.length && 'done'] },
      h('div', { class: 'cl-stop-name' },
        h('span', { class: 'n' }, String(si + 1)),
        h('div', {}, h('b', {}, s.name), h('span', {}, `${s.with} · ${got} / ${s.ids.length}`)),
        f && h('a', { class: 'cl-link k-lesson', href: `#/lesson/${s.lesson}` }, h('small', {}, '课程'), `${s.lesson.replace('-', '.')} ${f.lesson.title}`)),
      h('ol', { class: 'cl-stop-path' }, s.ids.map((id) => {
        const l = levelById(id);
        const rec = done[id];
        return h('li', {}, h('a', {
          class: ['cl-chip', rec?.done && 'done', nx?.id === id && 'next', l.kind === 'boss' && 'boss'],
          href: `#/classroom/${id}`, 'data-sfx': 'press', style: { '--c': `var(--${lineOf(l).color})` },
        }, h('span', { class: 'no' }, id), h('b', {}, l.title), rec?.done ? medalChip(rec.stars || 0) : nx?.id === id ? h('span', { class: 'tag' }, '下一关') : null));
      })));
  });
  view.append(h('div', { class: 'cl-page cl-list cl-route' }, head('route'), nextBar(),
    h('div', { class: 'cl-stops' }, h('p', { class: 'cl-route-tip' }, '不用照着走：想学哪关点哪关。这条路是把四条线穿起来的一种顺序，每一站和主线的一段课配着学最顺。'), stops)));
  return null;
}

// ───────────── 知识卡册 ─────────────

function cardsPage(view) {
  const done = saved();
  const lit = OPEN_LEVELS.filter((l) => done[l.id]?.done);
  const gold = lit.filter((l) => done[l.id].stars >= 3);
  ctx.set('小课堂 · 知识卡册', `收集了 ${lit.length} / ${OPEN_LEVELS.length} 张卡，金卡 ${gold.length} 张（每张金卡 = 啾啾窝里一根羽毛）。`);
  let open = null;
  const detail = h('div', { class: 'cl-card-detail', hidden: true });
  const close = () => {
    open?.destroy?.();
    open = null;
    detail.hidden = true;
    clear(detail);
  };
  function show(l) {
    close();
    const rec = done[l.id];
    const line = lineOf(l);
    const body = h('div', { class: 'cl-cd-body' });
    const quizBtn = h('button', { class: 'btn', type: 'button' }, '考考我');
    quizBtn.addEventListener('click', () => {
      open?.destroy?.();
      open = askQuiz({ items: l.ask || [], need: Math.min(2, (l.ask || []).length) }, { tier: 1, touched() {}, done() { sfx.play('star'); } });
      body.replaceChildren(open.el);
    });
    body.append(h('div', { class: 'cl-take' }, h('span', { class: 'label' }, '带走的话'), h('p', { html: rich(l.takeaway) })));
    detail.replaceChildren(h('div', { class: ['cl-cd', rec?.done && `m${rec.stars || 0}`], style: { '--c': `var(--${line.color})` } },
      h('header', {}, h('span', { class: 'no' }, l.id), h('div', {}, h('b', {}, l.title), h('span', {}, `${line.name} · ${KINDS[l.kind].label} · ${l.about}`)),
        rec?.done ? medalChip(rec.stars || 0) : h('span', { class: 'tag' }, '还没拿到'),
        h('button', { class: 'btn ghost sm', type: 'button', onclick: close, 'aria-label': '合上' }, '✕')),
      rec?.done && rec.stars >= 3 ? h('p', { class: 'cl-feather-note' }, '金卡：啾啾为它叼了一根羽毛回窝里。') : rec?.done ? h('p', { class: 'cl-feather-note muted' }, `再拿${rec.stars >= 2 ? '金牌' : rec.stars ? '银牌、金牌' : '一块牌'}，这张卡就会升级${rec.stars >= 2 ? '成金卡（啾啾会叼一根羽毛）' : ''}。`) : null,
      rec?.done ? body : h('p', { class: 'muted' }, '学完这一关就能拿到这张卡。'),
      h('div', { class: 'cl-cd-links' }, linkChips(l)),
      h('div', { class: 'cl-cd-actions' }, rec?.done && (l.ask || []).length ? quizBtn : null, h('a', { class: 'btn primary', href: `#/classroom/${l.id}` }, rec?.done ? (rec.stars >= 3 ? '再玩一次' : '去拿更好的牌 →') : '去学这一关 →'))));
    detail.hidden = false;
    pop(detail.firstChild);
  }
  const sections = LINES.map((line) => h('section', { class: 'cl-cardset', style: { '--c': `var(--${line.color})` } },
    h('h2', {}, line.name, h('small', {}, `${LEVELS.filter((l) => l.line === line.id && done[l.id]?.done).length} / ${LEVELS.filter((l) => l.line === line.id).length}`)),
    h('div', { class: 'cl-cardgrid' }, LEVELS.filter((l) => l.line === line.id).map((l) => {
      const rec = done[l.id];
      const c = h('button', {
        class: ['cl-kcard', rec?.done ? `got m${rec.stars || 0}` : 'locked', l.kind === 'boss' && 'boss'],
        type: 'button',
        'data-sfx': rec?.done ? 'press' : 'tick',
        onpointermove: rec?.done ? (e) => {
          if (e.pointerType !== 'mouse') return;
          const r = c.getBoundingClientRect();
          c.style.setProperty('--mx', `${Math.round(((e.clientX - r.left) / r.width) * 100)}%`);
          c.style.setProperty('--my', `${Math.round(((e.clientY - r.top) / r.height) * 100)}%`);
        } : null,
      },
        h('span', { class: 'no' }, l.id),
        h('b', {}, l.title),
        h('span', { class: 'about' }, rec?.done ? l.about : '？'),
        rec?.done ? medalChip(rec.stars || 0) : h('span', { class: 'lock' }, '没拿到'),
        rec?.stars >= 3 && h('i', { class: 'cl-feather', 'aria-label': '有一根羽毛' }));
      c.addEventListener('click', () => show(l));
      return c;
    }))));
  view.append(h('div', { class: 'cl-page cl-list cl-cards-page' }, head('cards'),
    h('div', { class: 'cl-cards-sum' },
      h('b', {}, `${lit.length}`), ` / ${OPEN_LEVELS.length} 张`,
      h('span', {}, `金卡 ${gold.length} · 银卡 ${lit.filter((l) => done[l.id].stars === 2).length} · 铜卡 ${lit.filter((l) => done[l.id].stars === 1).length}`),
      h('span', { class: 'muted' }, '学完一关拿一张卡；牌越好，卡的边越亮。每张金卡，啾啾都会叼一根羽毛回窝里。')),
    h('div', { class: 'cl-cardsets' }, sections), detail));
  return { destroy: close };
}

// ───────────── 每日五分钟 ─────────────

// 复习用的短版：听辨类答对 2 题、排顺序 / 配对 / 听写 / 学舌做 1 轮；铜那一档
const SHORT = { order: 1, progorder: 1, resoorder: 1, energyorder: 1, memory: 1, intervalmem: 1, modmem: 1, griddict: 1, subdict: 1, pentaecho: 1, phrasecatch: 1, dropcatch: 1, keymatch: 1 };
function reviewSpec(level) {
  const spec = tierSpec(level.quiz, 1);
  if (spec.toy === 'steady') return { ...spec, challenge: 6 };
  if (spec.toy === 'memory' || spec.toy === 'intervalmem' || spec.toy === 'modmem') return { ...spec, pairs: 3 };
  if (SHORT[spec.toy]) return { ...spec, need: 1 };
  if (spec.toy === 'oddchord' || spec.toy === 'duckodd') return { ...spec, need: 2 };
  return { ...spec, need: Math.min(spec.need || 2, 2) };
}

function dailyPage(view) {
  const day = today();
  const plan = dailyPlan(saved(), day);
  const already = dailyDone(store.data.classroomDaily, day);
  const results = [];
  let i = 0;
  let toy = null;
  let finished = false;
  let t0 = Date.now();
  const clock = h('b', { class: 'cl-clock' }, '0:00');
  const tick = setInterval(() => {
    const s = Math.floor((Date.now() - t0) / 1000);
    clock.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    clock.classList.toggle('over', s > 300);
  }, 500);
  const dots = h('div', { class: 'cl-daily-dots' });
  const stage = h('section', { class: 'cl-stage' });
  const face = coachFace({ size: 46, follow: false });
  const sayText = h('p', {});
  const which = h('div', { class: 'cl-do' });
  const next = h('button', { class: 'btn lg', type: 'button' }, '下一题 →');
  const skip = h('button', { class: 'btn ghost sm', type: 'button' }, '这题先跳过');
  const side = h('aside', { class: 'cl-side' }, h('div', { class: 'cl-say' }, face.el, sayText), which, h('div', { class: 'cl-side-more' }, skip), h('div', { class: 'cl-side-foot' }, next));
  const page = h('div', { class: 'cl-page cl-lesson cl-daily', style: { '--c': 'var(--accent)' } },
    h('header', { class: 'cl-top' },
      h('a', { class: 'btn ghost cl-back', href: '#/classroom' }, '← 小课堂'),
      h('div', { class: 'cl-title' }, h('span', { class: 'no' }, '5′'), h('b', {}, '每日五分钟'), h('span', { class: 'about' }, already ? '今天已经做过一次了：再做一次只是多练，不再记次数' : '复习学过的，做完算今天练过')),
      dots, clock),
    h('div', { class: 'cl-body' }, stage, side));
  view.append(page);
  ctx.set('小课堂 · 每日五分钟', `今天的复习：${plan.map((p) => `${p.id}（${p.why === 'due' ? '到期' : p.why === 'old' ? '好久没碰' : '尝鲜'}）`).join('、')}。`);

  const paintDots = () => dots.replaceChildren(...plan.map((p, j) => h('i', { class: [j === i && 'now', results[j] === true && 'ok', results[j] === false && 'miss'] }, p.id)));
  const say = (text) => {
    sayText.innerHTML = rich(text);
  };

  function mount() {
    toy?.destroy();
    toy = null;
    clear(stage);
    if (i >= plan.length) return finish();
    const p = plan[i];
    const l = levelById(p.id);
    const line = lineOf(l);
    page.style.setProperty('--c', `var(--${line.color})`);
    which.replaceChildren(h('span', { class: 'label' }, p.why === 'due' ? '到期了' : p.why === 'old' ? '好久没碰' : '尝个鲜'),
      h('p', { html: rich(`**${l.id}「${l.title}」**：${p.mode === 'ask' ? '快问快答。' : l.quiz.ask || ''}`) }));
    say(p.why === 'taste' ? `这关你还没学，先尝一口，啾。答不上来也没关系。` : i === 0 ? `${already ? '再来一轮，啾！' : '早，啾！今天的五分钟：'}一共 ${plan.length} 题，做完算今天练过。` : pickLine());
    next.textContent = i === plan.length - 1 ? '做完了 →' : '下一题 →';
    next.classList.remove('primary');
    const env = {
      tier: 1, live: mirror.available, touched() {},
      done(stars) {
        if (results[i] !== undefined) return;
        results[i] = stars >= 2;
        paintDots();
        next.classList.add('primary');
        pop(next);
        face.set('happy');
        setTimeout(() => face.set('idle'), 1500);
        say(results[i] ? '对了，啾！点「下一题」。' : '过了，不过错了几下：这关过两天再来一次。');
      },
    };
    toy = p.mode === 'ask' ? askQuiz({ items: l.ask || [], need: 1 }, env) : createToy(reviewSpec(l), env, l);
    stage.append(toy.el);
    page.toy = toy; // 给走查脚本用
    paintDots();
  }
  const pickLine = () => ['下一题，啾。', '保持住！', '一题一题来，不急。', '手感来了吧？'][i % 4];

  next.addEventListener('click', () => {
    if (results[i] === undefined) results[i] = false;
    i++;
    mount();
  });
  skip.addEventListener('click', () => {
    results[i] = null;
    i++;
    mount();
  });

  function finish() {
    if (finished) return;
    finished = true;
    clearInterval(tick);
    const before = store.progress().xp;
    store.update((d) => {
      d.classroom ||= {};
      plan.forEach((p, j) => {
        const cur = d.classroom[p.id];
        if (!cur?.done || results[j] === null || results[j] === undefined) return;
        d.classroom[p.id] = { ...cur, ...afterReview(cur, results[j], day) };
      });
      d.classroomDaily ||= { days: {} };
      d.classroomDaily.days ||= {};
      if (!d.classroomDaily.days[day]) d.classroomDaily.days[day] = { at: new Date().toISOString(), n: plan.length, right: results.filter(Boolean).length };
    });
    store.markPracticed();
    const gained = store.progress().xp - before;
    const st = streaks(store.data.practiceDays || [], day);
    const right = results.filter(Boolean).length;
    const s = Math.round((Date.now() - t0) / 1000);
    page.dataset.step = 'done';
    const card = h('div', { class: 'cl-done' },
      coachFace({ size: 84, follow: false, mood: 'cheer', act: 'flip' }).el,
      h('h1', {}, '今天的五分钟，做完了'),
      gained > 0 && h('p', { class: 'cl-gain' }, h('b', {}, `+${gained}`), ' 经验'),
      h('div', { class: 'cl-take' }, h('span', { class: 'label' }, '今天'), h('p', { html: rich(`${plan.length} 题里对了 **${right}** 题，用了 ${Math.floor(s / 60)} 分 ${s % 60} 秒。${st.current > 1 ? `已经**连续 ${st.current} 天**了，啾！` : '明天再来，连续天数就接上了。'}对了的关，下次隔得更久再来；错了的，明天再见。`) })),
      h('p', { class: 'muted small' }, `一共做过 ${dailyCount(store.data.classroomDaily)} 天。`),
      h('div', { class: 'cl-done-actions' },
        h('a', { class: 'btn', href: '#/classroom/cards' }, '去看卡册'),
        h('a', { class: 'btn primary lg', href: '#/classroom' }, '回小课堂')));
    page.querySelector('.cl-body').replaceChildren(card);
    confetti(card, 30);
    sfx.play('star');
    quizPerfect();
  }

  mount();
  return {
    destroy() {
      clearInterval(tick);
      toy?.destroy();
    },
  };
}

// ───────────── 一关 ─────────────

function lessonPage(view, level) {
  const line = lineOf(level);
  const STEPS = stepsOf(level);
  const QUIZ = STEPS.findIndex(([k]) => k === 'quiz');
  const kind = KINDS[level.kind] || KINDS.explain;
  let step = 1; // STEPS 里的下标。0 = 一句话：进来就说了，所以从 1 开始
  let reached = 1;
  let cleanup = [];
  let medal = 0; // 这一次挑战拿到的最好的牌
  let tier = Math.min(3, Math.max(1, Number(DEV.get('cltier')) || defaultTier()));
  let finished = false;
  const tidy = () => cleanup.splice(0).forEach((f) => f());

  /** 一进来挑哪一档：已经拿到的那块牌的下一档（金了就还是金） */
  function defaultTier() {
    const s = saved()[level.id]?.stars || 0;
    return Math.min(3, s + 1);
  }

  const face = coachFace({ size: 46, follow: false });
  const sayText = h('p', {});
  const sayBox = h('div', { class: 'cl-say' }, face.el, sayText);
  const doLabel = h('span', { class: 'label' });
  const doText = h('p', {});
  const doBox = h('div', { class: 'cl-do' }, doLabel, doText);
  const nameBox = h('div', { class: 'cl-name', hidden: true });
  const prev = h('button', { class: 'btn ghost', type: 'button' }, '← 上一步');
  const next = h('button', { class: 'btn lg', type: 'button' });
  const skip = h('button', { class: 'btn ghost sm cl-skip', type: 'button' }, '先跳过');
  const ask = h('button', { class: 'btn ghost sm', type: 'button', 'data-sfx': 'none', onclick: () => coach.toggle(true) }, '问啾啾');
  const foot = h('div', { class: 'cl-side-foot' }, prev, next);
  const side = h('aside', { class: 'cl-side' }, sayBox, doBox, nameBox, h('div', { class: 'cl-side-more' }, skip, ask), foot);
  const stage = h('section', { class: 'cl-stage' });
  const stepsBar = h('ol', { class: 'cl-steps' });
  const page = h('div', { class: ['cl-page', 'cl-lesson', `kind-${level.kind}`], style: { '--c': `var(--${line.color})` } },
    h('header', { class: 'cl-top' },
      h('a', { class: 'btn ghost cl-back', href: '#/classroom' }, '← 小课堂'),
      h('div', { class: 'cl-title' }, h('span', { class: 'no' }, level.id), h('b', {}, level.title), h('span', { class: 'about' }, `${line.name} · ${kind.label} · ${level.about}`)),
      stepsBar),
    h('div', { class: 'cl-body' }, stage, side));
  view.append(page);

  const last = STEPS.length - 1;
  prev.addEventListener('click', () => go(step - 1));
  next.addEventListener('click', () => (step >= last ? finish() : go(step + 1)));
  skip.addEventListener('click', () => (step >= last ? finish() : go(step + 1)));

  function paintSteps() {
    stepsBar.replaceChildren(...STEPS.map(([, label], i) => {
      const li = h('li', { class: i === step ? 'now' : i < step || i <= reached ? 'done' : '' }, h('i', {}, i < step ? '✓' : String(i + 1)), label);
      if (i >= 1 && i <= reached && i !== step) {
        li.setAttribute('role', 'button');
        li.addEventListener('click', () => go(i));
      }
      return li;
    }));
  }

  function setNext(label, ready) {
    next.textContent = label;
    next.classList.toggle('primary', ready);
    next.disabled = false;
  }
  const afterQuizLabel = () => (STEPS[QUIZ + 1] ? `${STEPS[QUIZ + 1][1]} →` : '完成这一关 →');

  function go(i) {
    tidy();
    step = Math.min(last, Math.max(1, i));
    reached = Math.max(reached, step);
    const key = STEPS[step][0];
    page.dataset.step = key;
    clear(stage);
    paintSteps();
    prev.style.visibility = step === 1 ? 'hidden' : '';
    ctx.set(`小课堂 · ${line.name}线 ${level.id}「${level.title}」（${kind.label}）· ${STEPS[step][1]}`, `这一关的一句话：${level.say.replace(/\*\*/g, '')}\n教学要点：${level.coach}\n带走的话：${level.takeaway.replace(/\*\*/g, '')}`);
    nameBox.hidden = true;
    skip.hidden = key === 'play';
    if (key === 'guide') showGuide();
    else if (key === 'play') showPlay();
    else if (key === 'quiz') showQuiz();
    else showMachine();
  }

  function showPlay() {
    const spec = level.play;
    let touches = 0;
    doLabel.textContent = STEPS[step][1];
    doText.innerHTML = rich((mirror.available && spec.liveTip) || spec.tip);
    setNext(`${STEPS[step + 1][1]} →`, false);
    const toy = createToy(spec, {
      live: mirror.available,
      tier: 0,
      done() {},
      touched() {
        touches++;
        if (touches === 1) setNext(`${STEPS[step + 1][1]} →`, true);
        // 玩出点感觉了，再把它的名字说出来
        if (touches === 3 && nameBox.hidden) {
          nameBox.innerHTML = rich(spec.name);
          nameBox.hidden = false;
          pop(nameBox);
          sfx.play('on');
          face.set('happy');
          setTimeout(() => face.set('idle'), 1600);
        }
      },
    }, level);
    stage.append(toy.el);
    page.toy = toy; // 给走查脚本用
    cleanup.push(() => toy.destroy());
  }

  /** 跟啾啾学（乐理线重做之后的关）：5–8 个小步，都在乐理台上做；啾啾每一步说一句（theory-guide.js） */
  function showGuide() {
    doLabel.textContent = '跟啾啾学';
    doText.innerHTML = rich(level.say);
    setNext(`${STEPS[step + 1][1]} →`, false);
    const guide = createGuide(level, {
      say: (text, mood) => speak(text, mood),
      progress: (i, n) => (doLabel.textContent = `跟啾啾学 · 第 ${i + 1} / ${n} 小步`),
      done: () => setNext(`${STEPS[step + 1][1]} →`, true),
      next: () => go(step + 1),
    });
    stage.append(guide.el);
    page.guide = guide; // 给走查脚本用
    cleanup.push(() => guide.destroy());
  }

  /** 挑战：上面一排铜 / 银 / 金，下面是这一档的玩具（动手关是一台机器） */
  function showQuiz() {
    const spec = level.quiz;
    doLabel.textContent = kind.quiz;
    doText.innerHTML = rich(spec.ask || '');
    setNext(afterQuizLabel(), medal > 0);
    const best = () => Math.max(medal, saved()[level.id]?.stars || 0);
    const bar = h('div', { class: 'cl-tiers', role: 'group', 'aria-label': '挑哪一档' });
    const host = h('div', { class: 'cl-tier-host' });
    const paintBar = () => bar.replaceChildren(
      h('span', { class: 'cl-tiers-label' }, '挑一档'),
      ...TIERS.map((t) => h('button', {
        type: 'button', class: ['cl-tier', `t${t.n}`, t.n === tier && 'on', best() >= t.n && 'got'], 'data-sfx': 'tick',
        onclick: () => {
          if (t.n === tier) return;
          tier = t.n;
          paintBar();
          mountToy();
        },
      }, h('b', {}, t.name), h('span', {}, best() >= t.n ? '✓ 拿到了' : t.sub))),
      h('span', { class: 'cl-tiers-say' }, TIERS[tier - 1].say));
    let toy = null;
    function award(t, perf, note = '') {
      // 金那一档还要“几乎不出错”：表现星不到 2 颗，先给银
      const got = t === 3 && perf < 2 ? 2 : t;
      if (got <= medal && medal) {
        nameBox.innerHTML = `<span class="cl-medal m${medal}">${starText(medal)}</span> 这一次又过了。现在的最好成绩是${MEDAL[medal]}牌。`;
      } else {
        medal = Math.max(medal, got);
        if (medal >= 3) quizPerfect(); // 金牌：啾啾唱一段
        nameBox.innerHTML = `<span class="cl-medal m${medal}">${starText(medal)}</span> 拿到${MEDAL[medal]}牌！${got < t ? '金牌要几乎不出错：再来一次就是金。' : medal < 3 ? `想要${MEDAL[medal + 1]}牌？点上面的「${MEDAL[medal + 1]}」。` : '金牌到手，啾！'}${note}`;
      }
      nameBox.hidden = false;
      pop(nameBox);
      face.set('happy');
      setTimeout(() => face.set('idle'), 1800);
      setNext(afterQuizLabel(), true);
      skip.hidden = true;
      paintBar();
    }
    function mountToy() {
      toy?.destroy();
      clear(host);
      const t = tier;
      if (spec.toy === 'hands') {
        const bench = createBench(level, {
          tier: t,
          onDone(report) {
            const live = mirror.available;
            if (report.manual && !live) award(1, 1, ` 有 ${report.manual} 步是点“我做了”过去的：全靠机器自己认出来，才给${MEDAL[t]}牌。`);
            else award(t, 3);
          },
        });
        host.append(bench.el);
        page.bench = bench;
        toy = bench;
      } else {
        toy = createToy(tierSpec(spec, t), { live: mirror.available, tier: t, touched() {}, done: (perf) => award(t, perf) }, level);
        host.append(toy.el);
      }
      page.toy = toy; // 给走查脚本用
    }
    stage.append(bar, host);
    paintBar();
    mountToy();
    cleanup.push(() => toy?.destroy());
  }

  function showMachine() {
    const done = h('button', { class: 'btn lg', type: 'button', onclick: finish }, '先到这儿，完成这一关');
    const back = h('button', { class: 'btn ghost', type: 'button', onclick: () => go(step - 1) }, '← 上一步');
    const bench = createBench(level, {
      actions: h('div', { class: 'cl-bench-actions' }, back, done),
      onDone() {
        done.textContent = '完成这一关 ✓';
        done.classList.add('primary');
        pop(done);
        face.set('happy');
      },
    });
    stage.append(bench.el);
    cleanup.push(() => bench.destroy());
    page.bench = bench; // 给走查脚本用
  }

  function finish() {
    if (finished) return;
    finished = true;
    tidy();
    const was = saved()[level.id]?.stars || 0;
    const wasDone = !!saved()[level.id]?.done;
    const gained = complete(level.id, medal);
    const stars = Math.max(was, medal);
    page.dataset.step = 'done';
    ctx.set(`小课堂 · 刚学完 ${level.id}「${level.title}」`, `这一次拿到：${MEDAL[medal] || '没拿牌（跳过了挑战）'}。带走的话：${level.takeaway.replace(/\*\*/g, '')}\n教学要点：${level.coach}`);
    stepsBar.replaceChildren(...STEPS.map(([, label]) => h('li', { class: 'done' }, h('i', {}, '✓'), label)));
    const starRow = h('div', { class: 'cl-stars' }, [0, 1, 2].map((i) => h('span', { class: i < medal ? 'on' : '' }, '★')));
    const upNext = routeNext((id) => id === level.id || !!saved()[id]?.done, 1)[0] || nextOpen(level.id);
    const bigFace = coachFace({ size: 84, follow: false, mood: 'cheer', act: 'flip' });
    const links = linkChips(level, { max: 5 });
    const card = h('div', { class: 'cl-done' },
      bigFace.el,
      starRow,
      h('h1', {}, `${level.title} · ${medal ? `${MEDAL[medal]}牌` : '点亮了'}`),
      gained > 0 && h('p', { class: 'cl-gain' }, h('b', {}, `+${gained}`), ' 经验'), // 升级、拿徽章由全页面的提示条说（main.js）
      h('div', { class: 'cl-take' }, h('span', { class: 'label' }, '带走的话'), h('p', { html: rich(level.takeaway) })),
      h('p', { class: 'cl-card-got' }, !wasDone ? '这张卡收进了卡册。' : stars > was ? `卡册里这张卡升成了${MEDAL[stars]}卡。` : '', stars >= 3 && stars > was ? '金卡：啾啾去叼一根羽毛回窝里。' : '', !wasDone ? '过一两天，“每日五分钟”会把它拿出来复习。' : ''),
      !medal && h('p', { class: 'muted small' }, '挑战那一步跳过了，所以还没有牌。回来过一档，星星会补上。'),
      links.length && h('div', { class: 'cl-done-links' }, h('span', { class: 'label' }, '接着去哪'), links),
      h('div', { class: 'cl-done-actions' },
        h('button', {
          class: 'btn', type: 'button',
          onclick: () => coach.ask(`我刚学完小课堂的「${level.title}」（${level.about}）。请换一个我打碟或者生活里的例子，再给我讲一遍，两三句话就够。`),
        }, '让啾啾再举个例子'),
        h('a', { class: 'btn', href: '#/classroom' }, '回小课堂'),
        upNext && h('a', { class: 'btn primary lg', href: `#/classroom/${upNext.id}` }, `下一关：${upNext.title} →`)));
    page.querySelector('.cl-body').replaceChildren(card);
    // 星星一颗一颗砸下来
    [...starRow.children].slice(0, medal).forEach((s, i) => setTimeout(() => {
      s.classList.add('in');
      sfx.play('star');
      if (i === medal - 1) confetti(starRow, 32);
    }, 250 + i * 260));
  }

  // 啾啾在右边说一句（一个字一个字打出来）。一进来说的是这一关的那句话；“跟啾啾学”里每个小步换一句
  let stopTyping = () => {};
  function speak(text, mood = 'talk') {
    stopTyping();
    face.set(mood);
    stopTyping = typeOut(sayText, text.split('**').join(''), {
      onDone: () => {
        sayText.innerHTML = rich(text);
        face.set('idle');
      },
    });
  }
  speak(level.say);
  // 开发用：地址里带 ?clstep=quiz / machine / done 时直接从那一步开始（给截图和走查用），?cltier=1/2/3 挑一档。
  // done 会把这一关记成学完，只在测试数据上用
  const jump = DEV.get('clstep');
  const at = jump === 'quiz' ? QUIZ : jump === 'machine' || jump === 'done' ? last : 1;
  go(at);
  if (jump === 'done') finish();
  return {
    destroy() {
      stopTyping();
      tidy();
    },
  };
}

// ───────────── 入口 ─────────────

export function classroomView(view, id) {
  view.classList.add('cl-host');
  const leave = () => view.classList.remove('cl-host');
  const wrap = (r) => ({
    destroy() {
      r?.destroy?.();
      leave();
    },
  });
  if (!id) return wrap(listPage(view));
  if (id === 'route') return wrap(routePage(view));
  if (id === 'cards') return wrap(cardsPage(view));
  if (id === 'daily') return wrap(dailyPage(view));
  const level = levelById(id.toUpperCase());
  if (!level || !isOpen(level)) {
    leave();
    location.hash = '#/classroom';
    return null;
  }
  if (level.id !== id.toUpperCase()) {
    // 合并掉的旧关（T3、T4、T13）：换到它并进去的那一关
    leave();
    location.hash = `#/classroom/${level.id}`;
    return null;
  }
  return wrap(lessonPage(view, level));
}
