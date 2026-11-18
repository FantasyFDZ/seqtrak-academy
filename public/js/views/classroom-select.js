// 小课堂进门的两页（2026-11-18 改版；为什么改、取舍、没验证的，见 docs/design-direction.md「小课堂进门：选曲台，和一条路」）：
//   #/classroom          选曲台：上面四条线的大切换，左边这条线的关，右边是选中这一关的“舞台”（封面、啾啾的一句话、三块牌、「开始」）
//   #/classroom/route    推荐路线：一条蜿蜒的路，9 站 + 最下面两段选学的岔路；点一个节点，旁边出这一关的卡片
// 两页都是“先选中、再进去”：点一下 = 选中（右边换，页面不重画），再点一下选中的、点「开始」、按回车 = 进这一关。
// 键盘：选曲台 ↑ ↓ 换关、← → 换线；路线页 ← → / ↑ ↓ 沿着路走；回车进关。只是加分项，不抢输入框、啾啾的对话、别的按钮的键。
// 页头是 views/classroom.js 的 head() 给的（卡册、小本子也用它）；每一关的封面在 classroom-covers.js。
// 开发用的参数（给截图和 tools/mac-check.sh 用，只在进来的第一次生效）：?clline=theory|rhythm|fx|dj 直接打开某条线，?clpick=<关> 直接选中某一关。
import { h, clamp, rich } from '../util.js';
import { store } from '../store.js';
import { ctx } from '../context.js';
import { coachFace } from '../coach-face.js';
import { sfx } from '../sfx.js';
import { LINES, OPEN_LEVELS, KINDS, ROUTE, ROUTE_SIDE, UNITS, levelById, isOpen, stepsOf, routeNext, stopOf, lineOf } from '../content/classroom.js';
import { findLesson } from '../content/curriculum.js';
import { coverSvg, lineIcon } from '../classroom-covers.js';

// 样式是这两页自己带来的（public/css/classroom-select.css），不用改 index.html
if (!document.querySelector('link[data-classroom-select]')) {
  document.head.append(h('link', { rel: 'stylesheet', href: '/css/classroom-select.css', 'data-classroom-select': '' }));
}

const MEDAL = ['', '铜', '银', '金'];
const DEV = new URLSearchParams(location.search);
const saved = () => store.data.classroom || {};
const colorOf = (level) => `var(--${lineOf(level).color})`;
const levelsOf = (lineId) => OPEN_LEVELS.filter((l) => l.line === lineId);
const minutes = (level) => level.minutes || 3;
const still = () => document.documentElement.hasAttribute('data-still');

// 这次打开应用期间，选曲台停在哪条线、每条线停在哪一关（从一关里返回进门页，要回到刚才那一关，不是跳回“接着学”）
const pick = { line: null, byLine: {} };
// 推荐路线页也一样：这次打开应用期间在路上停在哪一关（点过、沿路走到过，或者进过的关）。离开再回来还在它上面
let roadPick = null;
/** 进了一关：记下来，回选曲台、回路线页的时候停在它上面（views/classroom.js 进关时调） */
export function rememberPick(level) {
  if (!level?.line) return;
  pick.line = level.line;
  pick.byLine[level.line] = level.id;
  roadPick = level.id;
}
let devUsed = false;
function applyDev() {
  if (devUsed) return;
  devUsed = true;
  const line = LINES.find((l) => l.id === DEV.get('clline'));
  if (line) pick.line = line.id;
  const level = levelById((DEV.get('clpick') || '').toUpperCase());
  if (level && isOpen(level)) rememberPick(level);
}

/** 这些时候键盘不归这两页管：按着修饰键、在打字、焦点在啾啾的对话里、啾啾正等着你回话（有选项、有输入框、摊着小纸条）、上面盖着全屏的东西 */
function keysBusy(e) {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return true;
  if (e.target?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="dialog"], .jiu-layer')) return true;
  if (document.querySelector('.jiu-talk.on:not(.away) :is(.jiu-chips, .jiu-ask, .jiu-paper-body)')) return true; // 它只是说了一句话的时候不算
  return !!document.querySelector('.celebrate, .splash, .km-pop');
}
/** 焦点在一个自己会响应回车的东西上（别的按钮、链接）：回车留给它 */
const enterTaken = (e, mine) => {
  const el = e.target?.closest?.('a[href], button, [role="button"], summary');
  return !!el && !mine?.(el);
};

// ───────────── 两页共用的小件 ─────────────

/** 三个小点：铜、银、金，拿到哪一档亮到哪一档；学完了没拿牌是一个勾加三个空点 */
const medalDots = (n) => h('span', { class: 'cs-medals', role: 'img', 'aria-label': n ? `${MEDAL[n]}牌` : '学完了，还没拿牌' },
  !n && h('b', {}, '✓'), [1, 2, 3].map((k) => h('i', { class: n >= k ? 'on' : null })));

/** 三个大槽 + 下面一句话。返回 { el, set(这一关的进度记录) } */
function tierSlots() {
  const slots = [1, 2, 3].map((k) => h('span', { class: ['cs-tier', `t${k}`] }, MEDAL[k]));
  const note = h('small', {});
  const row = h('div', { class: 'row', role: 'img' }, slots);
  return {
    el: h('div', { class: 'cs-tiers' }, row, note),
    set(rec) {
      const n = rec?.done ? rec.stars || 0 : 0;
      slots.forEach((s, i) => s.classList.toggle('got', n >= i + 1));
      note.textContent = !rec?.done ? '挑战分三档，还没打过' : !n ? '学完了；挑战跳过了，还没有牌' : n >= 3 ? '金牌到手了' : `拿到了${MEDAL[n]}牌，下一档是${MEDAL[n + 1]}`;
      row.setAttribute('aria-label', !rec?.done ? '铜、银、金三块牌，都还没拿' : n ? `拿到了${MEDAL[n]}牌` : '学完了，还没拿牌');
    },
  };
}

const goLabel = (rec) => `${rec?.done ? '再来一遍' : '开始'} →`;
const enter = (level) => {
  location.hash = `#/classroom/${level.id}`;
};
/** 这一关在推荐路线上的哪儿：{ text, stop, side } */
function whereOf(level) {
  const stop = stopOf(level.id);
  if (stop) return { stop, text: `推荐路线第 ${ROUTE.indexOf(stop) + 1} 站「${stop.name}」` };
  const side = ROUTE_SIDE.find((s) => s.ids.includes(level.id));
  return { side, text: side ? `选学的关，不在推荐路线上（岔路「${side.name}」）` : '不在推荐路线上' };
}
const progressLine = (done) => {
  const lit = OPEN_LEVELS.filter((l) => done[l.id]?.done);
  return `小课堂一共 ${OPEN_LEVELS.length} 关，学完了 ${lit.length} 关${lit.length ? `：${lit.map((l) => `${l.id}「${l.title}」${MEDAL[done[l.id].stars || 0] || ''}`).join('、')}` : ''}。挑战分铜银金三档；另有推荐路线、知识卡册、每日五分钟复习。`;
};
const stateOf = (rec) => (!rec?.done ? '还没学' : rec.stars ? `学过了，拿到${MEDAL[rec.stars]}牌` : '学过了，还没拿牌');

// ───────────── 选曲台 ─────────────

export function selectPage(view, headEl) {
  const done = saved();
  const [nx] = routeNext((id) => !!done[id]?.done, 1);
  const firstOf = (lineId) => {
    const ls = levelsOf(lineId);
    return (nx?.line === lineId ? nx : ls.find((l) => !done[l.id]?.done && !l.optional) || ls[0]).id;
  };
  // 进来停在哪：这次打开应用期间停过的（从一关里返回也是它）→ 路线上的下一关 → 第一条线第一关
  applyDev();
  if (!LINES.some((l) => l.id === pick.line)) pick.line = (nx || levelsOf(LINES[0].id)[0]).line;
  let cur = null; // 现在选中的关
  let rows = [];
  let touched = false; // 用户自己滚过 / 选过了：之后版式变了也不再替他把列表滚回去

  // 上面：四条线
  const tabs = LINES.map((line) => {
    const ls = levelsOf(line.id);
    const got = ls.filter((l) => done[l.id]?.done).length;
    return h('button', {
      class: 'cs-line', type: 'button', role: 'tab', id: `cs-tab-${line.id}`, 'aria-selected': 'false', 'aria-controls': 'cs-list', tabindex: -1,
      'data-line': line.id, 'data-sfx': 'tick', style: { '--c': `var(--${line.color})` },
      onclick: () => setLine(line.id),
    },
      h('span', { class: 'ic', html: lineIcon(line.id) }),
      h('span', { class: 'w' }, h('b', {}, line.name), h('small', {}, line.sub)),
      h('span', { class: 'n', 'aria-label': `学了 ${got} 关，共 ${ls.length} 关` }, h('em', {}, String(got)), ` / ${ls.length}`),
      h('span', { class: 'bar', 'aria-hidden': 'true' }, h('i', { style: { width: `${ls.length ? (got / ls.length) * 100 : 0}%` } })));
  });

  // 左边：这条线的关
  const list = h('div', { class: 'cs-list', id: 'cs-list', role: 'listbox', tabindex: 0, 'aria-label': '这条线的关' });
  const rowOf = (level) => {
    const rec = done[level.id];
    const next = nx?.id === level.id;
    return h('div', {
      class: ['cs-row', rec?.done ? 'done' : 'todo', level.kind === 'boss' && 'boss', level.optional && 'optional', next && 'next'],
      role: 'option', id: `cs-opt-${level.id}`, 'aria-selected': 'false', 'data-id': level.id,
    },
      h('span', { class: 'cv', html: coverSvg(level, { small: true }) }),
      h('span', { class: 't' },
        h('b', {}, h('span', { class: 'cs-no' }, level.id), level.title),
        // 小字只放这一关讲什么：前面再挂“节奏挑战 · ”这样的种类，窄一点的屏上一多半的字就被截掉了。种类在右边舞台的标签上，鼠标停在这一行上也看得到
        h('span', { title: `${KINDS[level.kind].label} · ${level.about}` }, `${level.optional ? '选学 · ' : ''}${level.about}`)),
      rec?.done ? medalDots(rec.stars || 0) : h('span', { class: 'min', 'aria-label': `约 ${minutes(level)} 分钟` }, `${minutes(level)}′`),
      next && h('em', { class: 'cs-flag' }, '接着学'));
  };

  // 右边：舞台。只搭一次，换关的时候往里换字、换图（啾啾蹲的那一截树枝不动，它就不用重飞）
  const face = coachFace({ size: 52, follow: false });
  const tiers = tierSlots();
  const el = {
    no: h('span', { class: 'cs-no' }),
    kind: h('span', { class: 'kind' }),
    mins: h('span', { class: 'mins' }),
    flow: h('ol', { class: 'cs-flow', 'aria-label': '这一关的几步' }),
    title: h('h2', {}),
    about: h('p', {}),
    fig: h('div', { class: 'cs-fig' }),
    hint: h('div', { class: 'hint', hidden: true }),
    say: h('p', {}),
    go: h('button', { class: 'btn primary lg cs-go', type: 'button', onclick: () => enter(cur) }),
    where: h('span', { class: 'where' }),
    chapter: h('a', { hidden: true }),
  };
  const stage = h('section', { class: 'cs-stage', 'aria-label': '选中的这一关' },
    h('div', { class: 'cs-art' },
      h('div', { class: 'cs-tag' }, el.no, el.kind, el.mins),
      h('div', { class: 'cs-words' }, el.flow, el.title, el.about),
      el.fig),
    h('div', { class: 'cs-info' },
      h('div', { class: 'cs-say' }, face.el, h('div', { class: 'bubble' }, el.hint, el.say)),
      tiers.el,
      h('div', { class: 'cs-start' }, el.go)),
    h('div', { class: 'cs-foot' }, el.where, el.chapter,
      h('span', { class: 'cs-keys', 'aria-hidden': 'true' }, h('kbd', {}, '↑'), h('kbd', {}, '↓'), ' 换关', h('span', { class: 'more' }, ' · ', h('kbd', {}, '←'), h('kbd', {}, '→'), ' 换线'), ' · ', h('kbd', {}, '回车'), ' 开始')));

  const root = h('div', { class: 'cl-page cl-list cl-select' }, headEl,
    h('div', { class: 'cs-lines', role: 'tablist', 'aria-label': '四条线' }, tabs),
    h('div', { class: 'cs-body' }, list, stage));

  let moodTimer = 0;
  function paintStage() {
    const line = lineOf(cur);
    const rec = done[cur.id];
    const where = whereOf(cur);
    el.no.textContent = cur.id;
    el.kind.textContent = `${line.name} · ${KINDS[cur.kind].label}${cur.optional ? ' · 选学' : ''}`;
    el.mins.textContent = `约 ${minutes(cur)} 分钟`;
    el.flow.replaceChildren(...stepsOf(cur).map(([, label], i) => h('li', {}, h('span', {}, `${i + 1} ${label}`))));
    el.title.textContent = cur.title;
    el.about.textContent = cur.about;
    el.fig.innerHTML = coverSvg(cur, { anim: true });
    // “接着学”不另外摆一条：默认选中的就是它，啾啾在它上面多说半句
    const isNext = nx?.id === cur.id;
    el.hint.hidden = !(isNext || !nx);
    el.hint.replaceChildren(...(isNext ? [h('em', { class: 'cs-flag' }, '接着学'), h('small', {}, '按推荐路线，下一关就是它')] : [h('small', {}, '路线上的关都学完了，啾！挑一关把牌升成金的')]));
    el.say.innerHTML = rich(cur.say);
    tiers.set(rec);
    el.go.textContent = goLabel(rec);
    el.where.textContent = where.text;
    const f = where.stop && findLesson(where.stop.lesson);
    el.chapter.hidden = !f;
    if (f) {
      el.chapter.href = `#/lesson/${where.stop.lesson}`;
      el.chapter.textContent = `${where.stop.with} →`;
      el.chapter.title = `去主线的 ${where.stop.lesson.replace('-', '.')}「${f.lesson.title}」`;
      el.chapter.setAttribute('aria-label', `${where.stop.with}：去主线的 ${where.stop.lesson.replace('-', '.')}「${f.lesson.title}」`);
    }
    ctx.set(`小课堂 · 选关（${line.name}线）`, `学生正看着 ${cur.id}「${cur.title}」（${KINDS[cur.kind].label}，约 ${minutes(cur)} 分钟，${stateOf(rec)}；${where.text}）：${cur.about}。这一关的一句话：${cur.say.replace(/\*\*/g, '')}\n${nx ? `按推荐路线，下一关是 ${nx.id}「${nx.title}」。` : '推荐路线上的关都学完了。'}${progressLine(done)}`);
    // 啾啾换一句话的时候张张嘴（它不挪地方）
    clearTimeout(moodTimer);
    if (!still()) {
      face.set('talk');
      moodTimer = setTimeout(() => face.set('idle'), 900);
    }
  }

  /** 把选中的那一行留在列表看得见的地方。center = 摆到中间偏上（刚进来、换了一条线） */
  function reveal(center = false) {
    const row = rows.find((r) => r.dataset.id === cur.id);
    if (!row) return;
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    if (center) {
      const y = top - Math.max(48, list.clientHeight * 0.3);
      list.scrollTop = y < 80 ? 0 : y; // 差不了几行就从头摆：别把最上面的小标题切掉一半
    }
    else if (top < list.scrollTop + 34) list.scrollTop = Math.max(0, top - 34);
    else if (bottom > list.scrollTop + list.clientHeight - 52) list.scrollTop = bottom - list.clientHeight + 52;
  }

  function select(id, { center = false } = {}) {
    const level = levelById(id);
    if (!level) return;
    cur = level;
    rememberPick(cur);
    for (const r of rows) r.setAttribute('aria-selected', String(r.dataset.id === id));
    list.setAttribute('aria-activedescendant', `cs-opt-${id}`);
    paintStage();
    reveal(center);
  }

  function setLine(id, { focus = false } = {}) {
    const line = LINES.find((l) => l.id === id);
    if (!line) return;
    pick.line = id;
    root.style.setProperty('--c', `var(--${line.color})`);
    for (const t of tabs) {
      const on = t.dataset.line === id;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus({ preventScroll: true });
    }
    list.setAttribute('aria-label', `${line.name}线的关`);
    // 乐理线按单元分组（关上写 unit）：换了单元先摆一行小标题
    const nodes = [];
    let unit = null;
    for (const l of levelsOf(id)) {
      if (l.unit && l.unit !== unit) {
        unit = l.unit;
        const u = UNITS.find((x) => x.id === unit);
        if (u) nodes.push(h('div', { class: ['cs-unit', u.optional && 'optional'], role: 'presentation' }, u.name, u.sub && h('small', {}, u.sub)));
      }
      nodes.push(rowOf(l));
    }
    list.replaceChildren(...nodes);
    rows = nodes.filter((n) => n.classList.contains('cs-row'));
    const want = levelById(pick.byLine[id]);
    select(want && want.line === id && isOpen(want) ? want.id : firstOf(id), { center: true });
  }

  list.addEventListener('click', (e) => {
    const row = e.target.closest('.cs-row');
    if (!row) return;
    touched = true;
    if (row.dataset.id === cur.id) {
      sfx.play('press');
      enter(cur);
    } else {
      sfx.play('tick');
      select(row.dataset.id);
    }
  });
  for (const type of ['wheel', 'touchmove']) list.addEventListener(type, () => (touched = true), { passive: true });

  function step(d) {
    const ls = levelsOf(pick.line);
    const i = clamp(ls.findIndex((l) => l.id === cur.id) + d, 0, ls.length - 1);
    if (ls[i].id === cur.id) return false;
    touched = true;
    select(ls[i].id);
    return true;
  }
  function onKey(e) {
    if (keysBusy(e) || !root.isConnected) return;
    const k = e.key;
    if (k === 'ArrowDown' || k === 'ArrowUp') {
      if (step(k === 'ArrowDown' ? 1 : -1) && !e.repeat) sfx.play('tick');
    } else if (k === 'ArrowRight' || k === 'ArrowLeft') {
      const i = LINES.findIndex((l) => l.id === pick.line) + (k === 'ArrowRight' ? 1 : -1);
      if (i >= 0 && i < LINES.length) {
        setLine(LINES[i].id, { focus: tabs.includes(document.activeElement) });
        if (!e.repeat) sfx.play('tick');
      }
    } else if (k === 'Home' || k === 'End') {
      const ls = levelsOf(pick.line);
      touched = true;
      select(ls[k === 'Home' ? 0 : ls.length - 1].id);
    } else if (k === 'Enter') {
      if (e.repeat || enterTaken(e)) return; // 「开始」拿着焦点时回车就是点它，一样进这一关
      sfx.play('press');
      enter(cur);
    } else return;
    e.preventDefault();
  }
  document.addEventListener('keydown', onKey);

  view.append(root);
  setLine(pick.line);
  // 样式表是这一页自己带来的，头一回打开可能晚一步到：版式定下来以后，再把选中的那一行摆回看得见的地方
  const ro = new ResizeObserver(() => !touched && reveal(true));
  ro.observe(list);

  return {
    destroy() {
      document.removeEventListener('keydown', onKey);
      clearTimeout(moodTimer);
      ro.disconnect();
      face.release();
    },
  };
}

// ───────────── 推荐路线：一条路 ─────────────

const BASE = 102; // 一块地的上边到第一行关的中线（站牌骑在上边线上，下一关头上还有一块“接着学”）
const ROW = 132; // 同一站里行和行的距离
const TAIL = 92; // 最后一行的中线到这块地的下边（关的名字两行、一行星）
const GAP = 42; // 两块地之间
const EDGE = 26; // 换行时路贴着边拐弯：离边多远
const WAVE = 6; // 一行里的关一高一低，路才有点弯

/**
 * 算出每一站那块地、每一关的位置，和路要经过的点。W = 路线图的宽度；stops = 每站几关；hot = 下一关是整条路上的第几关（它头上有小标，那一行多让出一点）。
 * 关是蛇形排的：一行从左到右，下一行从右到左；每站另起一行，关多的站折成几行。
 */
function planRoad(W, stops, sides, hot) {
  const pad = clamp(W * 0.1, 62, 104);
  const per = clamp(Math.floor((W - 2 * pad) / 106) + 1, 3, 8);
  const xs = (k, dir) => {
    const g = k > 1 ? Math.min((W - 2 * pad) / (k - 1), 168) : 0;
    const x0 = (W - g * (k - 1)) / 2;
    return Array.from({ length: k }, (_, j) => (dir > 0 ? x0 + j * g : W - x0 - j * g));
  };
  const pts = [];
  const nodes = [];
  const regions = [];
  let prev = null;
  let dir = 1;
  let top = 0;
  const visit = (x, y) => {
    if (!prev) pts.push([Math.max(14, x - 84), y + 8]); // 路的起点：第一关的左边
    else if (Math.abs(prev.y - y) > 60) {
      // 换行：先顺着原来的方向走到边上，贴着边拐下来，再走进下一行
      const right = prev.dir > 0;
      const edge = right ? W - EDGE : EDGE;
      const inset = right ? -38 : 38;
      if (Math.abs(prev.x - edge) > 64) pts.push([edge + inset, prev.y]);
      if (y - prev.y > 190) pts.push([edge, prev.y + 50], [edge, y - 50]);
      else pts.push([edge, (prev.y + y) / 2]);
      if (Math.abs(x - edge) > 64) pts.push([edge + inset, y]);
    }
    pts.push([x, y]);
    prev = { x, y, dir, at: pts.length - 1 };
    return prev;
  };
  let seen = 0;
  for (const n of stops) {
    const rows = Math.ceil(n / per);
    let mid = top + BASE;
    for (let r = 0, i = 0; r < rows; r++) {
      const k = Math.ceil((n - i) / (rows - r)); // 分得匀一点：13 关排成 5 + 4 + 4，不是 5 + 5 + 3
      if (r) mid += ROW + (hot >= seen + i && hot < seen + i + k ? 30 : 0);
      xs(k, dir).forEach((x, j) => nodes.push(visit(x, mid + (k > 1 ? (j % 2 ? WAVE : -WAVE) : 0))));
      i += k;
      dir = -dir;
    }
    seen += n;
    regions.push({ top, height: mid + TAIL - top });
    top = mid + TAIL + GAP;
  }
  // 岔路：选学的关，一段一行，不接在大路上
  const noteTop = top - GAP + 18;
  top += 34;
  const sideRoads = [];
  for (const n of sides) {
    const mid = top + BASE - 14;
    const row = xs(Math.min(n, per), 1);
    const from = nodes.length;
    for (let i = 0; i < n; i++) nodes.push({ x: row[i % row.length], y: mid + Math.floor(i / row.length) * ROW + (i % 2 ? WAVE : -WAVE) });
    const last = nodes[nodes.length - 1];
    sideRoads.push(nodes.slice(from).map((p) => [p.x, p.y]));
    regions.push({ top, height: last.y + TAIL - 10 - top });
    top = last.y + TAIL - 10 + GAP;
  }
  return { pts, nodes, regions, sideRoads, noteTop, height: top - GAP + 6 };
}

/** 一串点连成一条圆滑的路：返回每一段的曲线，第 i 段是从第 i 个点到第 i + 1 个点（和首页地图一个画法） */
function curves(pts) {
  const r = (v) => Math.round(v * 10) / 10;
  return pts.slice(0, -1).map((p1, i) => {
    const p0 = pts[i - 1] || p1;
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    return `C${r(p1[0] + (p2[0] - p0[0]) / 6)} ${r(p1[1] + (p2[1] - p0[1]) / 6)} ${r(p2[0] - (p3[0] - p1[0]) / 6)} ${r(p2[1] - (p3[1] - p1[1]) / 6)} ${r(p2[0])} ${r(p2[1])}`;
  });
}

export function routePage(view, headEl) {
  const done = saved();
  const [nx] = routeNext((id) => !!done[id]?.done, 1);
  const open = (ids) => ids.map(levelById).filter(isOpen);
  const stops = ROUTE.map((s) => ({ ...s, levels: open(s.ids) }));
  const sides = ROUTE_SIDE.map((s) => ({ ...s, levels: open(s.ids) }));
  const main = stops.flatMap((s) => s.levels);
  const order = [...main, ...sides.flatMap((s) => s.levels)]; // 路上的先后：大路 60 关，然后两段岔路
  const hot = nx ? main.findIndex((l) => l.id === nx.id) : -1;
  applyDev(); // 地址里带 ?clpick=<关> 的话，它这时已经记进 roadPick 了
  // 卡片上摆的是哪一关：这次打开应用期间在路上停过的那一关（从它那里进了关再回来也是它）→ 下一关 → 都学完了就是最后一关
  let cur = order.find((l) => l.id === roadPick) || nx || main[main.length - 1];
  let touched = false;

  // 一站一块地，站牌骑在它的上边线上
  const regionEls = [];
  const headEls = [];
  stops.forEach((s, si) => {
    const got = s.levels.filter((l) => done[l.id]?.done).length;
    const all = got === s.levels.length;
    const f = findLesson(s.lesson);
    regionEls.push(h('div', { class: 'cr-region', style: { '--c': colorOf(s.levels[0]), '--gx': si % 2 ? '90%' : '10%' } }));
    headEls.push(h('div', { class: 'cr-head' },
      h('div', { class: ['cr-stop', all && 'done', !all && s.levels.some((l) => l.id === nx?.id) && 'now'] },
        h('span', { class: 'n', 'aria-label': `第 ${si + 1} 站` }, String(si + 1)),
        h('b', {}, s.name), h('span', { class: 'with' }, s.with),
        h('span', { class: 'count', 'aria-label': `学了 ${got} 关，共 ${s.levels.length} 关${all ? '，这一站走完了' : ''}` }, `${got} / ${s.levels.length}${all ? ' ✓' : ''}`)),
      f && h('a', { class: 'cl-link k-lesson', href: `#/lesson/${s.lesson}`, title: `这一站配着学的课：${s.lesson.replace('-', '.')} ${f.lesson.title}` }, h('small', {}, '课程'), h('span', {}, `${s.lesson.replace('-', '.')} ${f.lesson.title}`))));
  });
  sides.forEach((s) => {
    const got = s.levels.filter((l) => done[l.id]?.done).length;
    regionEls.push(h('div', { class: 'cr-region side' }));
    headEls.push(h('div', { class: 'cr-head' }, h('div', { class: ['cr-stop-side', 'cr-stop', got === s.levels.length && 'done'] },
      h('b', {}, `岔路 · ${s.name}`), h('span', { class: 'with' }, s.with), h('span', { class: 'count' }, `${got} / ${s.levels.length}${got === s.levels.length ? ' ✓' : ''}`))));
  });
  const note = h('p', { class: 'cr-note' }, '岔路：选学的关。不在这条路上，大关也不考；想学的时候再拐进来。');

  // 路：底、中间的虚线、走过的那一段；岔路是虚线
  const svgPath = (cls) => h('path', { class: cls });
  const bed = svgPath('cr-bed');
  const mid = svgPath('cr-mid');
  const walked = svgPath('cr-walked');
  const sideBeds = sides.map(() => svgPath('cr-sidebed'));
  const roads = h('svg', { class: 'cr-roads', 'aria-hidden': 'true' }, bed, mid, walked, sideBeds);

  // 路上的每一关
  const nodeOf = (level, side) => {
    const rec = done[level.id];
    const next = nx?.id === level.id;
    const n = rec?.stars || 0;
    return h('button', {
      class: ['cr-node', rec?.done && 'done', level.kind === 'boss' && 'boss', side && 'optional', next && 'next'],
      type: 'button', 'data-id': level.id, 'data-sfx': 'tick', tabindex: -1, style: { '--c': colorOf(level) },
      'aria-label': `${level.id} ${level.title}，${lineOf(level).name}线${level.kind === 'boss' ? '的大关' : ''}${side ? '，选学' : ''}，${stateOf(rec)}${next ? '，接着学这一关' : ''}`,
    },
      next && h('em', { class: 'cs-flag' }, '接着学'),
      h('span', { class: 'dot' }, level.id),
      h('span', { class: 'ttl' }, level.title),
      rec?.done && (n ? h('span', { class: 'stars' }, h('b', {}, '★'.repeat(n)), '★'.repeat(3 - n)) : h('span', { class: 'stars none' }, '✓ 学过了')));
  };
  const nodeEls = [...main.map((l) => nodeOf(l, false)), ...sides.flatMap((s) => s.levels.map((l) => nodeOf(l, true)))];
  const nodeBy = new Map(nodeEls.map((n) => [n.dataset.id, n]));

  // 啾啾：全应用只有一只。先在卡片上给它留一块（路上那块滚出去了，它就回卡片上），再在下一关旁边留一块——后留的优先
  const cardFace = coachFace({ size: 44, follow: false });
  cardFace.el.hidden = true; // 平时收着：卡片上不摆一截空树枝
  const birdAt = nx || main[main.length - 1];
  const roadFace = coachFace({ size: 54, follow: false, mood: nx ? 'idle' : 'cheer' });
  const bird = h('div', { class: 'cr-bird' }, roadFace.el);

  const canvas = h('div', { class: 'cr-canvas' }, regionEls, roads, nodeEls, bird, headEls, note); // 关排在站牌前面：按 Tab 先到路上选中的那一关，再到各站的课程链接
  const map = h('div', { class: 'cr-map', role: 'group', 'aria-label': `推荐路线：${ROUTE.length} 站，${main.length} 关；最下面是 ${sides.length} 段选学的岔路` }, canvas);

  // 右边：选中那一关的卡片（搭一次，换关的时候往里换）
  const tiers = tierSlots();
  const el = {
    no: h('span', { class: 'cs-no' }),
    where: h('span', { class: 'where' }),
    fig: h('div', { class: 'cr-fig' }),
    title: h('h2', {}),
    about: h('p', {}),
    say: h('p', { class: 'say' }),
    kind: h('span', { class: 'kind' }),
    mins: h('span', {}),
    go: h('button', { class: 'btn primary lg cs-go', type: 'button', onclick: () => enter(cur) }),
  };
  const card = h('aside', { class: 'cr-card', 'aria-label': '选中的这一关' },
    h('div', { class: 'cr-art' }, el.fig, el.no, el.where, cardFace.el),
    h('div', { class: 'cr-bd' }, el.title, el.about, el.say, h('div', { class: 'cr-meta' }, el.kind, el.mins), tiers.el, el.go,
      h('div', { class: 'cs-keys', 'aria-hidden': 'true' }, h('kbd', {}, '←'), h('kbd', {}, '→'), ' 沿着路走 · ', h('kbd', {}, '回车'), ' 开始')));

  const root = h('div', { class: 'cl-page cl-list cl-road' }, headEl,
    h('p', { class: 'cr-tip' }, '不用照着走：想学哪关点哪关。这条路是把四条线穿起来的一种顺序，每一站和主线的一段课配着学最顺。'),
    h('div', { class: 'cr-body' }, map, card));

  function paintCard() {
    const rec = done[cur.id];
    const line = lineOf(cur);
    const where = whereOf(cur);
    card.style.setProperty('--c', colorOf(cur));
    el.no.textContent = cur.id;
    el.where.textContent = where.stop ? `第 ${ROUTE.indexOf(where.stop) + 1} 站 · ${where.stop.name}` : where.side ? `岔路 · ${where.side.name}` : '';
    el.fig.innerHTML = coverSvg(cur, { anim: true });
    const mark = nx?.id === cur.id ? h('em', { class: 'cs-flag' }, '接着学') : cur.optional ? h('em', { class: 'cs-opt' }, '选学') : null;
    el.title.replaceChildren(cur.title, ...(mark ? [' ', mark] : []));
    el.about.textContent = cur.about;
    el.say.innerHTML = rich(cur.say);
    el.kind.textContent = KINDS[cur.kind].label;
    el.mins.textContent = `${line.name}线 · 约 ${minutes(cur)} 分钟`;
    tiers.set(rec);
    el.go.textContent = goLabel(rec);
    for (const n of nodeEls) {
      const on = n.dataset.id === cur.id;
      if (on) n.setAttribute('aria-current', 'true');
      else n.removeAttribute('aria-current');
      n.tabIndex = on ? 0 : -1;
      n.dataset.sfx = on ? 'press' : 'tick'; // 再点一下选中的 = 进这一关：键帽按到底的那一声
    }
    ctx.set('小课堂 · 推荐路线', `跨四条线的一条路，一共 ${ROUTE.length} 站：${ROUTE.map((s) => `${s.name}（${s.with}）`).join('、')}。下一关：${nx ? `${nx.id}「${nx.title}」` : '都学完了'}。学生正看着 ${cur.id}「${cur.title}」（${line.name}线，${KINDS[cur.kind].label}，${stateOf(rec)}；${where.text}）：${cur.about}。`);
  }

  // 排位置：路线图多宽就按多宽排（窗口变了、教练的栏开合，跟着重排）
  let L = null;
  let laidFor = 0;
  function lay() {
    const W = Math.round(canvas.clientWidth);
    if (!W || W === laidFor) return;
    laidFor = W;
    L = planRoad(W, stops.map((s) => s.levels.length), sides.map((s) => s.levels.length), hot);
    canvas.style.height = `${L.height}px`;
    roads.setAttribute('width', W);
    roads.setAttribute('height', L.height);
    roads.setAttribute('viewBox', `0 0 ${W} ${L.height}`);
    const seg = curves(L.pts);
    const from = (a, b) => `M${L.pts[a][0]} ${L.pts[a][1]} ${seg.slice(a, b).join(' ')}`;
    const N = main.length;
    const whole = from(0, L.nodes[N - 1].at);
    bed.setAttribute('d', whole);
    mid.setAttribute('d', whole);
    // 走过的路。一关学过了，它前后各半段路就亮；下一关（还没学）前面那半段也亮，路走到它为止。
    // 按顺序学的人看到的和原来一样：从头亮到下一关，都学完了亮到头。跳着学的，学过的那几关脚下也是亮的（原来只有圆键是实的，路是灰的）。
    // 画法：整条路一条线，亮的几段用虚线的“实 / 空”摆出来。量的是沿着路的长度，换行拐弯的那一长段也是从正中间分。
    const len = main.map((_, i) => {
      walked.setAttribute('d', from(0, L.nodes[i].at));
      return walked.getTotalLength();
    });
    walked.setAttribute('d', whole);
    const halfway = (i) => (len[i] + len[i + 1]) / 2;
    const lit = []; // [从, 到]
    for (let i = 0; i < N; i++) {
      if (i !== hot && !done[main[i].id]?.done) continue;
      const a = i ? halfway(i - 1) : 0;
      const b = i === hot || i === N - 1 ? len[i] : halfway(i);
      const last = lit[lit.length - 1];
      if (last && a <= last[1] + 0.5) last[1] = b;
      else lit.push([a, b]);
    }
    const r1 = (v) => Math.round(v * 10) / 10;
    // 最后一个“空”比整条路还长：图案不会绕回来再画一遍。头一段不是从起点开始的，就把整个图案往后推（负的 dashoffset）
    const cut = lit.map(([a, b]) => [r1(a), r1(b)]); // 先把每一段的两头取整到一位小数，再算长短：一段段加起来不会越差越多
    const dash = cut.flatMap(([a, b], k) => [r1(b - a), k < cut.length - 1 ? r1(cut[k + 1][0] - b) : r1(len[N - 1] + 40)]);
    walked.setAttribute('stroke-dasharray', dash.length ? dash.join(' ') : `0 ${r1(len[N - 1] + 40)}`);
    walked.setAttribute('stroke-dashoffset', String(-(cut[0]?.[0] || 0)));
    walked.dataset.lit = String(cut.length); // 亮着的有几段（按顺序学的人是 1 段）：检查脚本看它
    L.sideRoads.forEach((p, i) => sideBeds[i].setAttribute('d', `M${p[0][0] - 44} ${p[0][1] + 4} L${p.map((q) => q.join(' ')).join(' L')} L${p[p.length - 1][0] + 44} ${p[p.length - 1][1] - 4}`));
    L.regions.forEach((r, i) => {
      Object.assign(regionEls[i].style, { top: `${r.top}px`, height: `${r.height}px` });
      headEls[i].style.top = `${r.top}px`;
    });
    note.style.top = `${L.noteTop}px`;
    L.nodes.forEach((n, i) => Object.assign(nodeEls[i].style, { left: `${n.x}px`, top: `${n.y}px` }));
    const b = L.nodes[order.findIndex((l) => l.id === birdAt.id)];
    Object.assign(bird.style, { left: `${b.x}px`, top: `${b.y}px` });
    bird.classList.toggle('left', b.x > W - 150);
    if (!touched) bring(cur, true);
  }
  /** 路上的第 i 关在第几块地上（大路的 9 站在前，两段岔路在后；和 planRoad 排 regions 的顺序一样） */
  const regionOf = (i) => {
    let acc = 0;
    return [...stops, ...sides].findIndex((s) => (acc += s.levels.length) > i);
  };
  /**
   * 把一关滚到看得见的地方。center = 刚进来：从这一关所在那一站的站牌摆起（站牌不会被切掉半截）；
   * 这一站太高、那样摆看不到这一关，就把这一关摆到中间偏上
   */
  function bring(level, center = false) {
    const i = order.findIndex((l) => l.id === level.id);
    const n = L?.nodes[i];
    if (!n) return;
    const y = n.y + canvas.offsetTop;
    if (center) {
      const r = L.regions[regionOf(i)];
      const fromStop = r ? canvas.offsetTop + r.top - 44 : -1; // 站牌骑在这块地的上边线上（高 44）：连它带上面一点空一起露出来
      map.scrollTop = Math.max(0, r && y + 110 <= fromStop + map.clientHeight ? fromStop : y - map.clientHeight * 0.42);
    } else if (y - 96 < map.scrollTop) map.scrollTop = Math.max(0, y - 96);
    else if (y + 104 > map.scrollTop + map.clientHeight) map.scrollTop = y + 104 - map.clientHeight;
  }

  function select(id, { focus = false } = {}) {
    const level = order.find((l) => l.id === id);
    if (!level) return;
    cur = level;
    roadPick = level.id;
    paintCard();
    bring(cur);
    if (focus) nodeBy.get(id)?.focus({ preventScroll: true });
  }
  canvas.addEventListener('click', (e) => {
    const node = e.target.closest('.cr-node');
    if (!node) return;
    touched = true;
    if (node.dataset.id === cur.id) enter(cur);
    else select(node.dataset.id);
  });
  for (const type of ['wheel', 'touchmove']) map.addEventListener(type, () => (touched = true), { passive: true });

  function onKey(e) {
    if (keysBusy(e) || !root.isConnected) return;
    const k = e.key;
    const d = k === 'ArrowRight' || k === 'ArrowDown' ? 1 : k === 'ArrowLeft' || k === 'ArrowUp' ? -1 : 0;
    if (d) {
      const i = clamp(order.findIndex((l) => l.id === cur.id) + d, 0, order.length - 1);
      if (order[i].id !== cur.id) {
        touched = true;
        select(order[i].id, { focus: nodeEls.includes(document.activeElement) });
        if (!e.repeat) sfx.play('tick');
      }
    } else if (k === 'Enter') {
      if (e.repeat || enterTaken(e)) return; // 路上的关、「开始」、站牌上的链接拿着焦点时，回车是点它们自己
      sfx.play('press');
      enter(cur);
    } else return;
    e.preventDefault();
  }
  document.addEventListener('keydown', onKey);

  view.append(root);
  paintCard();
  lay();
  const ro = new ResizeObserver(lay);
  ro.observe(canvas);
  // 下一关滚出路线图了：路上给啾啾留的那一块收起来，它就回卡片上；滚回来再放出来
  const io = new IntersectionObserver(([entry]) => {
    bird.hidden = !entry.isIntersecting;
    cardFace.el.hidden = entry.isIntersecting;
  }, { root: map, threshold: 0.5 });
  io.observe(nodeBy.get(birdAt.id));

  return {
    destroy() {
      document.removeEventListener('keydown', onKey);
      ro.disconnect();
      io.disconnect();
      roadFace.release();
      cardFace.release();
    },
  };
}
