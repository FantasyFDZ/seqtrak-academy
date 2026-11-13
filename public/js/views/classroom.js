// 小课堂：乐理、节奏、效果三条线的小关。#/classroom 是列表，#/classroom/<关的 id> 是一关。
// 一关固定四步：一句话 → 玩一玩 → 试一试 → 用在机器上。一句话一进来就摆在右边，不用为它单点一下：
// 这位学生是先玩再看字的人，所以能玩的东西第一屏就在。
// 进度存在进度文件的 classroom 字段里：{ T1: { done, stars, at, times } }。经验值和徽章就是从这个字段算的（levels.js），
// 首页地图上每章开头的小关也是看它点亮的（classroom-minis.js）。
import { h, clear, rich } from '../util.js';
import { store } from '../store.js';
import { ctx } from '../context.js';
import { coach } from '../coach.js';
import { mirror } from '../mirror.js';
import { coachFace } from '../coach-face.js';
import { quizPerfect } from '../jiu-eggs.js';
import { sfx } from '../sfx.js';
import { confetti, pop, typeOut } from '../fx.js';
import { LINES, LEVELS, OPEN_LEVELS, levelById, isOpen, nextOpen } from '../content/classroom.js';
import { createToy } from '../classroom-toys.js';
import { createBench } from '../classroom-bench.js';

// 样式是这一页自己带来的（public/css/classroom.css），不用改 index.html
if (!document.querySelector('link[data-classroom]')) {
  document.head.append(h('link', { rel: 'stylesheet', href: '/css/classroom.css', 'data-classroom': '' }));
}

const STEPS = [['say', '一句话'], ['play', '玩一玩'], ['quiz', '试一试'], ['machine', '用在机器上']];
const lineOf = (level) => LINES.find((l) => l.id === level.line);
const saved = () => store.data.classroom || {};
const starText = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

/**
 * 记下这一关学完了。星星只增不减。
 * 经验值不用另外记：它是从 classroom 这个字段算出来的（levels.js：一关 1 星 20 / 2 星 25 / 3 星 30），所以再学一遍不会重复给，
 * 拿到更多星会补上差额。返回这一下一共涨了多少经验（当天第一次练习的那一份也在里面；没涨就是 0）。
 */
function complete(id, stars) {
  const before = store.progress().xp;
  store.update((d) => {
    d.classroom ||= {};
    const cur = d.classroom[id] || {};
    d.classroom[id] = { done: true, stars: Math.max(cur.stars || 0, stars), at: cur.at || new Date().toISOString(), times: (cur.times || 0) + 1 };
  });
  store.markPracticed();
  return store.progress().xp - before;
}

// ───────────── 列表 ─────────────

function listPage(view) {
  const done = saved();
  const lit = OPEN_LEVELS.filter((l) => done[l.id]?.done);
  const stars = lit.reduce((n, l) => n + (done[l.id].stars || 0), 0);
  ctx.set('小课堂（乐理、节奏、效果三条线的小关）', `已经开放 ${OPEN_LEVELS.length} 关，学完了 ${lit.length} 关${lit.length ? `：${lit.map((l) => `${l.id}「${l.title}」`).join('、')}` : ''}。每关三五分钟：一句话 → 玩一玩 → 试一试 → 用在机器上。`);

  const column = (line) => {
    const levels = LEVELS.filter((l) => l.line === line.id);
    const open = levels.filter(isOpen);
    const got = open.filter((l) => done[l.id]?.done).length;
    const nodes = levels.map((l) => {
      const no = h('span', { class: 'no' }, l.id);
      const words = h('div', { class: 'words' }, h('b', {}, l.title), h('span', {}, l.about));
      if (!isOpen(l)) {
        const row = h('div', { class: 'cl-node soon', role: 'button', 'aria-disabled': 'true', tabindex: '0' }, no, words, h('span', { class: 'tag' }, '还没开放'));
        row.addEventListener('click', () => {
          sfx.play('nope');
          row.classList.remove('shake');
          void row.offsetWidth;
          row.classList.add('shake');
        });
        return row;
      }
      const rec = done[l.id];
      return h('a', { class: ['cl-node', rec?.done && 'done'], href: `#/classroom/${l.id}`, 'data-sfx': 'press' },
        no, words,
        rec?.done ? h('span', { class: 'stars', 'aria-label': `${rec.stars} 颗星` }, starText(rec.stars || 1)) : h('span', { class: 'go' }, `${l.minutes || 3} 分钟 →`));
    });
    return h('section', { class: 'cl-line', style: { '--c': `var(--${line.color})` } },
      h('header', {},
        h('div', { class: 'cl-line-name' }, h('h2', {}, line.name), h('span', { class: 'count' }, `${got} / ${open.length}`)),
        h('p', {}, line.sub),
        h('div', { class: 'cl-line-bar' }, h('i', { style: { width: `${open.length ? (got / open.length) * 100 : 0}%` } }))),
      h('div', { class: 'cl-nodes' }, nodes));
  };

  view.append(h('div', { class: 'cl-page cl-list' },
    h('header', { class: 'cl-list-head' },
      h('div', {}, h('h1', {}, '小课堂'), h('p', {}, '每关三五分钟，只讲一件事。不分先后，想学哪关点哪关。')),
      h('div', { class: 'cl-total' }, h('b', {}, String(lit.length)), ` / ${OPEN_LEVELS.length} 关点亮`, h('span', { class: 'stars' }, `★ ${stars}`))),
    h('div', { class: 'cl-lines' }, LINES.map(column))));
  return null;
}

// ───────────── 一关 ─────────────

function lessonPage(view, level) {
  const line = lineOf(level);
  let step = 1; // STEPS 里的下标。0 = 一句话：进来就说了，所以从 1 开始
  let reached = 1;
  let cleanup = [];
  let quizStars = 0;
  let finished = false;
  const tidy = () => cleanup.splice(0).forEach((f) => f());

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
  const page = h('div', { class: 'cl-page cl-lesson', style: { '--c': `var(--${line.color})` } },
    h('header', { class: 'cl-top' },
      h('a', { class: 'btn ghost cl-back', href: '#/classroom' }, '← 小课堂'),
      h('div', { class: 'cl-title' }, h('span', { class: 'no' }, level.id), h('b', {}, level.title), h('span', { class: 'about' }, `${line.name} · ${level.about}`)),
      stepsBar),
    h('div', { class: 'cl-body' }, stage, side));
  view.append(page);

  prev.addEventListener('click', () => go(step - 1));
  next.addEventListener('click', () => (step >= 3 ? finish() : go(step + 1)));
  skip.addEventListener('click', () => (step >= 3 ? finish() : go(step + 1)));

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

  function go(i) {
    tidy();
    step = Math.min(3, Math.max(1, i));
    reached = Math.max(reached, step);
    const key = STEPS[step][0];
    page.dataset.step = key;
    clear(stage);
    paintSteps();
    prev.style.visibility = step === 1 ? 'hidden' : '';
    ctx.set(`小课堂 · ${line.name}线 ${level.id}「${level.title}」· ${STEPS[step][1]}`, `这一关的一句话：${level.say.replace(/\*\*/g, '')}\n教学要点：${level.coach}\n带走的话：${level.takeaway.replace(/\*\*/g, '')}`);
    nameBox.hidden = true;
    skip.hidden = step === 1;
    if (key === 'play') showPlay();
    else if (key === 'quiz') showQuiz();
    else showMachine();
  }

  function showPlay() {
    const spec = level.play;
    let touches = 0;
    doLabel.textContent = '玩一玩';
    doText.innerHTML = rich((mirror.available && spec.liveTip) || spec.tip);
    setNext('试一试 →', false);
    const toy = createToy(spec, {
      live: mirror.available,
      done() {},
      touched() {
        touches++;
        if (touches === 1) setNext('试一试 →', true);
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
    cleanup.push(() => toy.destroy());
  }

  function showQuiz() {
    const spec = level.quiz;
    doLabel.textContent = '试一试';
    doText.innerHTML = rich(spec.ask);
    setNext('用在机器上 →', quizStars > 0);
    const toy = createToy(spec, {
      live: mirror.available,
      touched() {},
      done(stars) {
        quizStars = Math.max(quizStars, stars);
        if (stars >= 3) quizPerfect(); // 三星：啾啾唱一段
        nameBox.innerHTML = `<span class="stars">${starText(quizStars)}</span> 这一步拿到了 ${quizStars} 颗星。`;
        nameBox.hidden = false;
        pop(nameBox);
        face.set('happy');
        setTimeout(() => face.set('idle'), 1800);
        setNext('用在机器上 →', true);
        skip.hidden = true;
      },
    }, level);
    stage.append(toy.el);
    cleanup.push(() => toy.destroy());
  }

  function showMachine() {
    const done = h('button', { class: 'btn lg', type: 'button', onclick: finish }, '先到这儿，完成这一关');
    const back = h('button', { class: 'btn ghost', type: 'button', onclick: () => go(2) }, '← 上一步');
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
    const stars = Math.max(1, quizStars);
    const gained = complete(level.id, stars);
    page.dataset.step = 'done';
    ctx.set(`小课堂 · 刚学完 ${level.id}「${level.title}」`, `带走的话：${level.takeaway.replace(/\*\*/g, '')}\n教学要点：${level.coach}`);
    stepsBar.replaceChildren(...STEPS.map(([, label]) => h('li', { class: 'done' }, h('i', {}, '✓'), label)));
    const starRow = h('div', { class: 'cl-stars' }, [0, 1, 2].map((i) => h('span', { class: i < stars ? 'on' : '' }, '★')));
    const upNext = nextOpen(level.id);
    const bigFace = coachFace({ size: 84, follow: false, mood: 'cheer', act: 'flip' });
    const card = h('div', { class: 'cl-done' },
      bigFace.el,
      starRow,
      h('h1', {}, `${level.title} · 点亮了`),
      gained > 0 && h('p', { class: 'cl-gain' }, h('b', {}, `+${gained}`), ' 经验'), // 升级、拿徽章由全页面的提示条说（main.js）
      h('div', { class: 'cl-take' }, h('span', { class: 'label' }, '带走的话'), h('p', { html: rich(level.takeaway) })),
      !quizStars && h('p', { class: 'muted small' }, '“试一试”那一步跳过了，所以先给一颗星。回来再玩一次，星星会补上。'),
      h('div', { class: 'cl-done-actions' },
        h('button', {
          class: 'btn', type: 'button',
          onclick: () => coach.ask(`我刚学完小课堂的「${level.title}」（${level.about}）。请换一个我打碟或者生活里的例子，再给我讲一遍，两三句话就够。`),
        }, '让啾啾再举个例子'),
        h('a', { class: 'btn', href: '#/classroom' }, '回小课堂'),
        upNext && h('a', { class: 'btn primary lg', href: `#/classroom/${upNext.id}` }, `下一关：${upNext.title} →`)));
    page.querySelector('.cl-body').replaceChildren(card);
    // 星星一颗一颗砸下来
    [...starRow.children].slice(0, stars).forEach((s, i) => setTimeout(() => {
      s.classList.add('in');
      sfx.play('star');
      if (i === stars - 1) confetti(starRow, 32);
    }, 250 + i * 260));
  }

  // 一句话：一进来教练就说了
  const plain = level.say.replace(/\*\*/g, '');
  face.set('talk');
  const stopTyping = typeOut(sayText, plain, {
    onDone: () => {
      sayText.innerHTML = rich(level.say);
      face.set('idle');
    },
  });
  // 开发用：地址里带 ?clstep=quiz / machine / done 时直接从那一步开始（给 tools/classroom-shots.sh 截图用）。
  // done 会把这一关记成学完，只在测试数据上用
  const jump = new URLSearchParams(location.search).get('clstep');
  go(jump === 'quiz' ? 2 : jump === 'machine' || jump === 'done' ? 3 : 1);
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
  if (!id) {
    listPage(view);
    return { destroy: leave };
  }
  const level = levelById(id.toUpperCase());
  if (!level || !isOpen(level)) {
    leave();
    location.hash = '#/classroom';
    return null;
  }
  const page = lessonPage(view, level);
  return {
    destroy() {
      page.destroy();
      leave();
    },
  };
}
