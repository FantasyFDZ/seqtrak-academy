// 首页：闯关地图。
// 最上面是“接着练”（教练在里面打招呼、说今天练什么），旁边是等级、连续天数、本周目标：这一排固定在上面，一直看得见。
// 下面是自己滚动的一块：一排徽章，然后是地图。一章一个区域，一节课一个关卡，沿一条弯路排开；
// 每章最后一节课是大一号的“章节挑战”；还没做好的章节是路尽头那几个淡淡的点。
//
// 地图上每章的开头还可以挂一两个“小关”：小课堂里和这一章有关的关。数据是课程表那一章的对象上的 minis
// （public/js/content/curriculum.js 的 CHAPTERS 里的章），由 ../classroom-minis.js 挂上去，哪一章挂哪几关也写在那里：
//   chapter.minis = [{ id: 'T1', no: 'T1', title: '四个一组', minutes: 3, href: '#/classroom/T1', done: () => 学过没有, stars: () => 几颗星 }]
// done / stars 可以是值，也可以是函数（每次画首页时现问）。小关不参与“学完前一关才解锁”，随时能点。
import { h, rich, clamp, pct } from '../util.js';
import { CHAPTERS, allLessons } from '../content/curriculum.js';
import '../classroom-minis.js'; // 给章对象挂上小关（只为它的副作用）
import { store } from '../store.js';
import { ctx } from '../context.js';
import { midi } from '../midi.js';
import { coach } from '../coach.js';
import { toast } from '../ui.js';
import { countUp, typeOut } from '../fx.js';
import { coachFace, setCoachMood } from '../coach-face.js';
import { homeHello } from '../jiu-eggs.js';
import { callBack } from '../jiu.js';
import { firmwareBehind } from '../device-connect.js';

const svg = (cls, box, inner) => h('svg', { class: cls, viewBox: box, 'aria-hidden': 'true', html: inner });
const LOCK = '<path fill-rule="evenodd" d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2H12a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h.5zM6 7h4V5a2 2 0 0 0-4 0v2z"/>';
const FLAME = '<path d="M12 2c.7 3.6 5 5.2 5 10.2a5 5 0 0 1-10 0c0-1.8.7-3.1 1.7-4.1.3 1.5 1.1 2.4 2.1 2.4 0-3.2.3-5.7 1.2-8.5z"/>';
const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
// 每一章的区域染一点自己的颜色（借用轨道的颜色：两套配色各有一组）
const REGION_TINT = ['var(--t-SYNTH2)', 'var(--t-KICK)', 'var(--t-SYNTH1)', 'var(--t-PERC1)', 'var(--t-SNARE)', 'var(--t-HAT2)', 'var(--t-PERC2)', 'var(--t-HAT1)', 'var(--t-DX)'];

// ───────────── 教练说的话 ─────────────
// 这几句是按进度就地拼出来的，不问 AI：进首页不该等，也不该每次都花一次调用。想细问，点它的脸。

function hello() {
  const hr = new Date().getHours();
  // 啾啾的口头禅：短话后面带一个“啾”（用户 2026-11-13 定的说法）
  return hr < 5 ? '夜深了，啾' : hr < 11 ? '早，啾' : hr < 13 ? '中午好，啾' : hr < 18 ? '下午好，啾' : '晚上好，啾';
}

function daysSince(day) {
  if (!day) return Infinity;
  const ms = new Date(`${new Date().toLocaleDateString('sv')}T00:00:00`) - new Date(`${day}T00:00:00`);
  return Math.round(ms / 86400000);
}

/** 返回 { text, mood }：mood 是说完之后脸上的神态。 */
function greeting(p, nextUp, started) {
  const last = store.data.lastResult;
  const days = store.data.practiceDays;
  const away = daysSince(days[days.length - 1]);
  const parts = [`${hello()}！`];
  let mood = 'idle';

  if (p.intro && p.xp > 0) {
    // 旧的进度文件第一次被算成经验值
    parts.push(`你之前练的我都记上了：${p.xp} 经验${p.got ? `，${p.got} 个徽章` : ''}。`);
    mood = 'happy';
  } else if (p.streak.current >= 2) {
    parts.push(p.streak.today ? `已经连着练了 ${p.streak.current} 天。` : `你连着练了 ${p.streak.current} 天，今天练一下就是第 ${p.streak.current + 1} 天。`);
    mood = p.streak.today ? 'happy' : 'cheer';
  } else if (away >= 3 && away < 400) {
    parts.push(`有 ${away} 天没见了，先找找手感。`);
    mood = 'cheer';
  } else if (last && !last.demo) {
    const off = Math.abs(last.meanMs) >= 20 ? `，整体偏${last.meanMs < 0 ? '早' : '晚'} ${Math.abs(Math.round(last.meanMs))} 毫秒` : ''; // meanMs 是早晚相抵之后的数，只能说“偏哪边”，不能说成“平均偏差”
    const word = last.accuracy >= 0.95 ? '稳' : last.accuracy >= 0.8 ? '不错' : last.passed ? '过了，还能更准' : '还没过，放慢一点再来';
    parts.push(`上一局「${last.title}」${pct(last.accuracy)}${off}，${word}。`);
    mood = last.accuracy >= 0.9 ? 'happy' : last.passed ? 'idle' : 'cheer';
  }

  if (!nextUp) {
    parts.push('做好的课你都学完了：去练习场刷几个三星，或者到「曲目」页把想学的歌定下来。');
  } else {
    const { lesson } = nextUp;
    const at = store.lesson(lesson.id).stepIndex || 0;
    if (at > 0) parts.push(`今天接着 ${lesson.no}「${lesson.title}」，上次停在第 ${at + 1} 步。`);
    else if (!started) parts.push(`${parts.length > 1 ? '' : '我是啾啾，你的陪练小鸟。'}今天从 ${lesson.no}「${lesson.title}」开始，大约 ${lesson.minutes} 分钟。`);
    else parts.push(`今天学 ${lesson.no}「${lesson.title}」，大约 ${lesson.minutes} 分钟。`);
  }
  return { text: parts.join(''), mood };
}

// ───────────── 地图怎么排 ─────────────

const BASE = 124; // 一个区域里，第一行关卡的中线离区域顶边多远
const WAVE = 18; // 关卡一上一下，偏离中线多少：路就弯起来了
const ROW_H = 204; // 一个区域里要排两行时，行与行隔多远（窗口窄的时候）
const TAIL = 156; // 最后一行中线以下留多少（放课名和星星）
const GAP = 48; // 区域之间（章节的铭牌骑在区域的上边线上，占掉一半）
const EDGE = 38; // 换行、换区域时，路贴着边拐弯：离边多远

/**
 * 算出每个区域、每个关卡的位置和路要经过的点。W = 地图的宽度，counts = 每章几节课，far = 还没开放的章节有几个。
 * 关卡是蛇形排的：一行从左到右，下一行从右到左。每章最后一节课是“章节挑战”，站在中线上。
 * 返回的 nodes / farNodes 里每一项是 { x, y, at }，at = 它是路上的第几个点。
 */
function plan(W, counts, far) {
  const m = clamp(W * 0.13, 84, 150); // 一行里第一关、最后一关离左右两边多远
  const perRow = clamp(Math.floor((W - 2 * m) / 148) + 1, 2, 5); // 关卡的名字占 144 宽：1024 的平板上内容区 900，正好排 5 关
  const xAt = (dir, t) => (dir > 0 ? m + t * (W - 2 * m) : W - m - t * (W - 2 * m));
  const pts = [];
  let prev = null;
  const visit = (x, y) => {
    if (!prev) pts.push([Math.max(14, x - 96), y + 8]); // 路的起点：第一关的左边
    else if (Math.abs(prev.y - y) > 110) {
      // 和上一个点不在同一行：贴着边拐个弯下来。隔得远（换区域）拐两下，隔得近（同一个区域里换行）拐一下就够
      const edge = prev.x > W / 2 ? W - EDGE : EDGE;
      if (y - prev.y > 250) pts.push([edge, prev.y + 66], [edge, y - 66]);
      else pts.push([edge + (edge > W / 2 ? -14 : 14), (prev.y + y) / 2]);
    }
    pts.push([x, y]);
    prev = { x, y, at: pts.length - 1 };
    return prev;
  };

  const nodes = [];
  const regions = [];
  let dir = 1;
  let top = 0;
  for (const n of counts) {
    const rows = Math.ceil(n / perRow);
    for (let r = 0, i = 0; r < rows; r++) {
      // 要排几行就分得匀一点：章开头挂了两个小关的第 1 章有 7 个点，排成 4 + 3，不是 5 + 2（第二行只剩两个点，中间空一大段路）
      const k = Math.ceil((n - i) / (rows - r));
      const mid = top + BASE + r * ROW_H;
      for (let j = 0; j < k; j++, i++) {
        const boss = i === n - 1;
        nodes.push(visit(xAt(dir, k === 1 ? 0 : j / (k - 1)), boss ? mid : mid + (j % 2 ? WAVE : -WAVE)));
      }
      if (k > 1) dir = -dir;
    }
    const height = BASE + (rows - 1) * ROW_H + TAIL;
    regions.push({ top, height });
    top += height + GAP;
  }

  // 远处：还没开放的章节，小一号，越远越淡
  const farTop = top - 14;
  const farPer = W >= 860 ? far : 3;
  const farNodes = [];
  let bottom = top - GAP;
  for (let r = 0, i = 0; i < far; r++) {
    const k = Math.min(farPer, far - r * farPer);
    const mid = farTop + 96 + r * 150;
    for (let j = 0; j < k; j++, i++) farNodes.push(visit(xAt(dir, k === 1 ? 0 : j / (k - 1)), mid + (j % 2 ? 12 : -12)));
    if (k > 1) dir = -dir;
    bottom = mid + 108; // 给下面那一位的名字和两行小字留够地方
  }
  if (far) pts.push([clamp(prev.x - dir * 130, 10, W - 10), prev.y + 34]); // 再往前画一小段：路还没完
  return { nodes, regions, pts, farNodes, farTop, height: bottom };
}

/** 一串点连成一条圆滑的路：返回每一段的曲线，第 i 段是从第 i 个点到第 i + 1 个点。 */
function curves(pts) {
  const r = (v) => Math.round(v * 10) / 10;
  return pts.slice(0, -1).map((p1, i) => {
    const p0 = pts[i - 1] || p1;
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    return `C${r(p1[0] + (p2[0] - p0[0]) / 6)} ${r(p1[1] + (p2[1] - p0[1]) / 6)} ${r(p2[0] - (p3[0] - p1[0]) / 6)} ${r(p2[1] - (p3[1] - p1[1]) / 6)} ${r(p2[0])} ${r(p2[1])}`;
  });
}

// ───────────── 页面 ─────────────


export function homeView(view) {
  ctx.set('路线图首页');
  const isDone = (id) => !!store.data.lessons[id]?.done;
  const unlockAll = !!store.settings.unlockAll;
  const lessons = allLessons();
  const nextUp = lessons.find((x) => !isDone(x.lesson.id)) || null;
  const doneCount = lessons.filter((x) => isDone(x.lesson.id)).length;
  const started = doneCount > 0 || Object.keys(store.data.lessons).length > 0;
  const p = store.progress();
  const cleanup = [];

  // ── 接着练：啾啾飞过来打招呼 + 下一关 ──
  const face = coachFace({ size: 64 });
  cleanup.push(() => face.release());
  // 问候卡上那个圆盘：鼠标单击不开对话框（点啾啾的身体才开），双击叫它回来；键盘按回车还是打开对话框
  const openCoach = (e) => {
    if (e.detail === 0) coach.toggle(true);
  };
  const askPlan = () => coach.ask('看看我的进度和最近几局的数据：今天这半小时我该怎么练？给我一个三步的小计划。', { format: 'plan' });
  cleanup.push(coach.offer([['今天怎么练？', askPlan]]));
  // 这次打开应用第一次来首页：它叫一声打招呼（之后回首页就不叫了，免得烦）；今天第一次打开还是个彩蛋：按时间换个开头、唱一段（jiu-eggs.js）
  const hello = homeHello();
  const said = greeting(p, nextUp, started);
  if (hello) said.text = said.text.replace(/^[^。]*。/, hello); // 换掉开头那句“早上好。”
  const sayText = h('span', { class: 'say-text' });
  const say = h('div', { class: 'say' }, sayText,
    h('button', { class: 'say-more', type: 'button', onclick: askPlan }, '今天怎么练？让啾啾写张小纸条 →'));
  setCoachMood('talk');
  cleanup.push(typeOut(sayText, said.text, { onDone: () => setCoachMood(said.mood, said.mood === 'idle' ? 0 : 5000) }), () => setCoachMood('idle'));

  let resumeBody;
  if (nextUp) {
    const { chapter, lesson } = nextUp;
    const at = store.lesson(lesson.id).stepIndex || 0;
    resumeBody = [
      h('div', { class: 'resume-row' },
        h('div', { class: 'resume-what' },
          h('div', { class: 'label' }, `${started ? '接着练' : '从这里开始'} · 第 ${chapter.no} 章 ${chapter.title}`),
          h('h1', {}, h('span', { class: 'no' }, lesson.no), lesson.title)),
        h('a', { class: 'btn primary lg', href: `#/lesson/${lesson.id}` }, started ? '继续 →' : '开始第一课 →')),
      h('p', { class: 'sum' }, lesson.summary),
      h('div', { class: 'resume-foot' },
        h('span', { class: 'small' }, `约 ${lesson.minutes} 分钟${at > 0 ? ` · 第 ${at + 1} / ${lesson.steps.length} 步` : ` · ${lesson.steps.length} 步`}`),
        h('div', { class: 'resume-steps', 'aria-hidden': 'true' }, lesson.steps.map((_, i) => h('i', { class: i < at ? 'on' : i === at ? 'now' : '' }))),
      ),
    ];
  } else {
    resumeBody = [
      h('div', { class: 'resume-row' },
        h('div', { class: 'resume-what' },
          h('div', { class: 'label' }, '做好的课都学完了'),
          h('h1', {}, '去练习场刷几个三星')),
        h('a', { class: 'btn', href: '#/songs' }, '挑曲目'),
        h('a', { class: 'btn primary lg', href: '#/arcade' }, '去练习场 →')),
      h('p', { class: 'sum' }, '已经做好的几章你都学完了。练习场里每个谱面都能换速度、换模式；也可以到「曲目」页把想学的歌定下来，后面的章节会围绕它们展开。'),
    ];
  }
  const resume = h('section', { class: 'resume' },
    h('div', { class: 'greet' },
      h('button', { class: 'greet-face', type: 'button', 'data-sfx': 'none', title: '点啾啾和它说话；双击这里叫它回来', 'aria-label': '和啾啾说话', onclick: openCoach, ondblclick: () => callBack() }, face.el),
      say),
    resumeBody,
  );

  // ── 等级、连续天数、本周目标 ──
  const { level, streak, week } = p;
  const xpNum = h('b', {}, '0');
  const xpFrom = `${p.xp} 经验 = 课程 ${p.xpFrom.lessons} + 每天练习 ${p.xpFrom.days} + 音游 ${p.xpFrom.plays}${p.xpFrom.classroom ? ` + 小课堂 ${p.xpFrom.classroom}` : ''}${p.xpFrom.extra ? ` + 其它 ${p.xpFrom.extra}` : ''}`;
  const levelCard = h('div', { class: 'hstat', role: 'button', tabindex: '0', 'aria-label': `等级：Lv ${level.lv} ${level.name}。点一下看经验是怎么来的`,
    onclick: () => toast(xpFrom, '', 4200), onkeydown: (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toast(xpFrom, '', 4200)) },
    h('div', { class: 'ring', style: { '--p': String(Math.round(level.pct * 100)) } }, h('span', {}, String(level.lv))),
    h('div', {},
      h('div', { class: 'what' }, `Lv ${level.lv} · ${level.name}`),
      h('div', { class: 'hint' }, xpNum, ' 经验', level.next ? h('span', {}, ` · 再攒 ${level.next.at - p.xp} 升到 `, h('b', {}, level.next.name)) : ' · 已经是最高一级')),
  );
  levelCard.firstChild.style.setProperty('--p', String(Math.round(level.pct * 100)));
  countUp(xpNum, p.xp);

  const streakNum = h('span', {}, '0');
  const streakCard = h('div', { class: 'hstat' },
    h('div', { class: ['flame', streak.current > 0 && 'lit'] }, svg('', '0 0 24 24', FLAME)),
    h('div', {},
      h('div', { class: 'big' }, streakNum, h('small', {}, '天连续练习')),
      h('div', { class: 'hint' }, streak.current === 0 ? '今天练一下，把火点起来'
        : streak.today ? (streak.longest > streak.current ? `今天已经练过了 · 最长 ${streak.longest} 天` : '今天已经练过了，这就是你的最长纪录')
          : '今天还没练：练一下就续上')),
  );
  countUp(streakNum, streak.current);

  const weekFull = week.count >= week.goal;
  const weekCard = h('div', { class: 'hstat' },
    h('div', { class: ['ring', weekFull && 'full'] }, h('small', {}, `${week.count}/${week.goal}`)),
    h('div', {},
      h('div', { class: 'what' }, weekFull ? '本周目标达成' : `本周目标 · 还差 ${week.goal - week.count} 天`),
      h('div', { class: 'week-dots' }, week.days.map((on, i) => h('i', { class: [on && 'on', i === week.today && 'today'] }, WEEKDAYS[i])))),
  );
  weekCard.firstChild.style.setProperty('--p', String(Math.min(100, Math.round((week.count / week.goal) * 100))));

  const top = h('div', { class: 'home-top' }, resume, h('div', { class: 'hstats' }, levelCard, streakCard, weekCard));

  // ── 徽章 ──
  const when = (at) => new Date(at).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
  // 说明写在徽章下面那一行里，点哪个说哪个（不靠悬停：平板上没有悬停）。一进来先说新拿到的，没有就说下一个能拿的
  const badgeNote = h('div', { class: 'badge-note', 'aria-live': 'polite' });
  const badgeEls = new Map();
  const tell = (b, lead) => {
    badgeNote.replaceChildren(h('b', {}, `${lead}${b.name}`), `　${b.how}`, b.at ? h('span', { class: 'muted' }, `　${when(b.at)}拿到`) : '');
    for (const [id, el] of badgeEls) el.classList.toggle('picked', id === b.id);
  };
  for (const b of p.badges) {
    badgeEls.set(b.id, h('button', {
      class: ['badge', b.at && 'got', b.fresh && 'fresh'], type: 'button', dataset: { tone: b.tone, sfx: b.at ? 'star' : 'tick' },
      'aria-label': `徽章「${b.name}」：${b.at ? '已经拿到' : '还没拿到'}。${b.how}`,
      onclick: () => tell(b, b.at ? '' : '还没拿到 · '),
    },
      svg('', '0 0 24 24', b.icon),
      b.mark && h('span', { class: 'mark' }, b.mark)));
  }
  const firstUp = p.badges.find((b) => b.fresh) || p.badges.find((b) => !b.at) || p.badges[0];
  tell(firstUp, firstUp.fresh ? '新拿到 · ' : firstUp.at ? '' : '下一个 · ');
  const badges = h('section', { class: 'badges' },
    h('div', { class: 'badges-main' },
      h('div', { class: 'badges-head' }, h('div', { class: 'label' }, '徽章'), h('b', {}, String(p.got), h('small', {}, ` / ${p.badges.length}`))),
      h('div', { class: 'badge-row' }, [...badgeEls.values()])),
    badgeNote,
  );

  const firmwareNote = firmwareBehind()
    ? h('div', { class: 'callout warn', style: { marginTop: '16px' } }, h('b', { class: 'label' }, '固件可以更新'),
      h('span', { html: rich(`你的 SEQTRAK 是 **${midi.identity.version}**，官方最新是 **V2.00**。已经做好的这几章不受影响；想更新的话，先充满电，用 USB 线连着电脑，打开官方 SEQTRAK App 按提示操作。详情见「设备」页。`) }))
    : null;

  // ── 地图 ──
  const chapters = CHAPTERS.filter((c) => !c.soon);
  const soon = CHAPTERS.filter((c) => c.soon);
  const road = h('svg', { class: 'map-road', 'aria-hidden': 'true' });
  const bed = h('path', { class: 'road-bed' });
  const mid = h('path', { class: 'road-mid' });
  const walked = h('path', { class: 'road-done' });
  const farRoads = soon.map((_, i) => h('path', { class: 'road-far', style: { opacity: String(Math.max(0.25, 0.9 - i * 0.16)) } }));
  road.append(bed, mid, ...farRoads, walked);

  let prevDone = true;
  let activeMarked = false;
  let nowNode = -1; // 现在这一关是地图上的第几个点（章开头挂了小关的话，它和“第几节课”就不是一回事了）
  const regionEls = [];
  const nodeEls = [];
  for (const chapter of chapters) {
    const done = chapter.lessons.filter((l) => isDone(l.id)).length;
    const cleared = done === chapter.lessons.length;
    const isActive = !activeMarked && !cleared;
    if (isActive) activeMarked = true;
    regionEls.push(h('section', { class: ['region', cleared && 'clear', isActive && 'active'], 'aria-label': `第 ${chapter.no} 章 ${chapter.title}`, style: { '--tint': REGION_TINT[chapter.no % REGION_TINT.length], '--gx': regionEls.length % 2 ? '92%' : '8%' } },
      h('div', { class: 'region-head' },
        h('div', { class: 'region-no' }, String(chapter.no)),
        h('h2', {}, chapter.title),
        h('span', { class: 'sub' }, chapter.subtitle),
        h('div', { class: 'region-count' },
          h('span', { class: 'cells' }, chapter.lessons.map((l) => h('i', { class: isDone(l.id) ? 'on' : '' }))),
          cleared ? '通关 ✓' : `${done} / ${chapter.lessons.length}`),
      )));
    // 这一章开头挂着的小关（没有就什么都不画）
    for (const mini of chapter.minis || []) {
      const val = (v) => (typeof v === 'function' ? v() : v);
      const got = !!val(mini.done);
      const stars = Math.max(1, Math.min(3, val(mini.stars) || 1));
      nodeEls.push(h('a', { class: ['map-node', 'mini', got && 'done'], href: mini.href, 'aria-label': `小关 ${mini.title}：${got ? '学过了' : '可以学'}` },
        h('span', { class: 'cap' }, h('span', { class: 'no' }, mini.no || mini.id), h('span', { class: 'lamp' })),
        h('span', { class: 'kind' }, mini.kind || '小课堂'),
        h('span', { class: 'name' }, mini.title),
        h('span', { class: 'meta' }, got ? h('span', { class: 'stars' }, h('b', {}, '★'.repeat(stars)), '★'.repeat(3 - stars)) : `约 ${mini.minutes || 4} 分钟`)));
    }
    chapter.lessons.forEach((lesson, i) => {
      const state = store.lesson(lesson.id);
      const locked = !unlockAll && !prevDone && !state.done;
      const isNow = nextUp?.lesson.id === lesson.id;
      const boss = i === chapter.lessons.length - 1;
      const stars = state.stars || 1;
      const whyLocked = () => toast(`${lesson.no}「${lesson.title}」还没解锁：先学完前一关。想跳着看，可以在「设置」里打开“全部课程解锁”。`, '', 4200);
      nodeEls.push(h(locked ? 'div' : 'a', {
        class: ['map-node', state.done ? 'done' : isNow ? 'now' : locked ? 'locked' : 'open', boss && 'boss'],
        href: locked ? null : `#/lesson/${lesson.id}`,
        tabindex: locked ? '0' : null,
        role: locked ? 'button' : null,
        'aria-disabled': locked ? 'true' : null,
        onclick: locked ? whyLocked : null,
        onkeydown: locked ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), whyLocked()) : null,
        'aria-label': `${lesson.no} ${lesson.title}${boss ? '（章节挑战）' : ''}：${state.done ? `已通关，${stars} 颗星` : locked ? '还没解锁' : isNow ? '现在这一关' : '可以学'}`,
      },
        isNow && h('span', { class: 'flag' }, started ? '继续' : '从这里开始'),
        h('span', { class: 'cap' }, h('span', { class: 'no' }, lesson.no), locked && !boss ? svg('lock', '0 0 16 16', LOCK) : h('span', { class: 'lamp' })),
        boss && h('span', { class: 'kind' }, '章节挑战'),
        h('span', { class: 'name' }, lesson.title),
        h('span', { class: 'meta' }, state.done ? h('span', { class: 'stars' }, h('b', {}, '★'.repeat(stars)), '★'.repeat(3 - stars)) : locked ? '未解锁' : `约 ${lesson.minutes} 分钟`),
        h('span', { class: 'tip' }, h('b', {}, `${lesson.no} ${lesson.title}`), lesson.summary,
          h('small', {}, locked ? '先学完前一关（或者在设置里打开“全部课程解锁”）' : `约 ${lesson.minutes} 分钟 · ${lesson.steps.length} 步${state.done ? ' · 学过了，可以再来一遍' : ''}`)),
      ));
      if (isNow) nowNode = nodeEls.length - 1;
      prevDone = state.done;
    });
  }
  const farLabel = h('div', { class: 'label far-label' }, `前面还有 ${soon.length} 个区域 · 制作中`);
  const farBox = h('div', { class: 'far' }, soon.length ? farLabel : null);
  const farNote = h('p', { class: 'far-note', 'aria-live': 'polite' }, soon.length ? '路的尽头还有几个区域在做。点一个，看看里面会学什么。' : '');
  const farEls = soon.map((chapter, i) => h('button', {
    class: 'far-node', type: 'button', style: { '--o': String(Math.max(0.45, 1 - i * 0.13)) }, 'aria-label': `第 ${chapter.no} 章 ${chapter.title}：制作中。点一下看里面会学什么`,
    onclick: () => {
      farNote.replaceChildren(h('b', {}, `第 ${chapter.no} 章 · ${chapter.title}（制作中）`), `　${chapter.teaser}`);
      farEls.forEach((el, j) => el.classList.toggle('picked', j === i));
    },
  },
    h('span', { class: 'cap' }, String(chapter.no)),
    h('span', { class: 'name' }, chapter.title),
    h('span', { class: 'sub' }, chapter.subtitle)));

  const map = h('div', { class: 'map' }, regionEls, farBox, road, nodeEls, farEls);
  // 整页不滚动：上面那一排固定，徽章和地图在 .home-scroll 里自己滚
  view.classList.add('fixed');
  cleanup.push(() => view.classList.remove('fixed'));
  view.append(h('div', { class: 'home' }, top, h('div', { class: 'home-scroll' }, badges, firmwareNote, map, farNote)));

  const nowIndex = nowNode >= 0 ? nowNode : nodeEls.length - 1; // 全学完了：路一直亮到最后一关
  let laidFor = 0;
  function lay() {
    const W = Math.round(map.clientWidth) || 1056;
    if (W === laidFor) return;
    laidFor = W;
    const L = plan(W, chapters.map((c) => (c.minis || []).length + c.lessons.length), soon.length);
    map.style.height = `${L.height}px`;
    road.setAttribute('width', W);
    road.setAttribute('height', L.height);
    road.setAttribute('viewBox', `0 0 ${W} ${L.height}`);
    const seg = curves(L.pts);
    const from = (a, b) => `M${L.pts[a][0]} ${L.pts[a][1]} ${seg.slice(a, b).join(' ')}`;
    const lastLesson = L.nodes[L.nodes.length - 1].at;
    bed.setAttribute('d', from(0, lastLesson));
    mid.setAttribute('d', from(0, lastLesson));
    walked.setAttribute('d', from(0, L.nodes[nowIndex].at));
    farRoads.forEach((el, i) => el.setAttribute('d', from(i ? L.farNodes[i - 1].at : lastLesson, i === farRoads.length - 1 ? L.pts.length - 1 : L.farNodes[i].at)));
    L.regions.forEach((r, i) => Object.assign(regionEls[i].style, { top: `${r.top}px`, height: `${r.height}px` }));
    L.nodes.forEach((n, i) => Object.assign(nodeEls[i].style, { left: `${n.x}px`, top: `${n.y}px` }));
    L.farNodes.forEach((n, i) => Object.assign(farEls[i].style, { left: `${n.x}px`, top: `${n.y}px` }));
    farBox.style.top = `${L.farTop}px`;
  }
  lay();
  // 窗口变宽变窄、教练的侧栏开合：地图跟着重排
  const ro = new ResizeObserver(lay);
  ro.observe(map);
  cleanup.push(() => ro.disconnect());

  // 这一眼看过了：徽章上的“新”和教练那句“都记上了”下次不再出现
  // （地址带 ?still 的时候不记：那是给截图用的静帧，只看不动数据）
  const seenTimer = document.documentElement.hasAttribute('data-still') ? 0 : setTimeout(() => store.markSeen(), 2500);
  cleanup.push(() => clearTimeout(seenTimer));

  return { destroy: () => cleanup.forEach((f) => f()) };
}
