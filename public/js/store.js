// 学习进度：存在本地服务的 data/progress.json 里，浏览器里再留一份备份。
// 经验值、等级、徽章也在这里（规则在 levels.js）：经验值大部分是从进度算出来的，所以旧的进度文件不用迁移。
import { api } from './api.js';
import { Emitter, debounce } from './util.js';
import { BADGES, blankGame, backfillGame, awardBadges, statsFromResult, playXp, xpBreakdown, totalXp, levelOf, streaks } from './levels.js';

const LS_KEY = 'seqtrak-academy-progress';
export const WEEK_GOAL = 4; // 每周练几天算达标

const blank = () => ({
  version: 1,
  profile: { createdAt: new Date().toISOString(), placement: null },
  lessons: {}, // 课程 id → { stepIndex, done, stars, completedAt, stepStars（计分的步骤各得了几颗星，旧文件里没有） }
  charts: {}, // 谱面 id → { plays, bestAccuracy, bestStars, lastAt }
  songs: { picked: [] },
  // skin：配色，'body' 机身（浅）/ 'neon' 霓虹（深）；motion：动效，'rich' 丰富 / 'calm' 克制；uiSound：界面音效
  settings: { inputOffsetMs: 0, metronome: true, speak: false, unlockAll: false, engine: 'fast', skin: 'body', motion: 'rich', uiSound: true },
  practiceDays: [], // 'YYYY-MM-DD'
  lastResult: null,
  drills: [], // AI 出过的定制练习
  notes: [], // 啾啾的纸条本：收下的小纸条 { id, at, title, body, q }（coach.js）
  game: blankGame(), // 音游攒的经验、徽章、和徽章有关的累计数（见 levels.js）
  // 另有两个用到才出现的字段：panelQuiz（“找按键”的成绩）、classroom（小课堂学过的关：{ T1: { done, stars, at, times } }，算经验和徽章）
});

function merge(base, saved) {
  if (!saved || typeof saved !== 'object') return base;
  const out = { ...base, ...saved };
  for (const k of ['profile', 'lessons', 'charts', 'songs', 'settings']) out[k] = { ...base[k], ...(saved[k] || {}) };
  out.practiceDays = Array.isArray(saved.practiceDays) ? saved.practiceDays : [];
  out.drills = Array.isArray(saved.drills) ? saved.drills : [];
  out.notes = Array.isArray(saved.notes) ? saved.notes : [];
  // 旧文件里没有 game：先放一份空的，load() 里会从已有进度把它回算出来
  const g = saved.game && typeof saved.game === 'object' ? saved.game : {};
  out.game = {
    ...base.game,
    ...g,
    stats: { ...base.game.stats, ...(g.stats || {}) },
    badges: { ...(g.badges || {}) },
    seen: { ...base.game.seen, ...(g.seen || {}), badges: Array.isArray(g.seen?.badges) ? g.seen.badges : [] },
  };
  if (out.settings.skin !== 'neon') out.settings.skin = 'body';
  if (out.settings.motion !== 'calm') out.settings.motion = 'rich';
  out.settings.uiSound = out.settings.uiSound !== false;
  return out;
}

export const today = () => new Date().toLocaleDateString('sv');

class Store extends Emitter {
  data = blank();
  loaded = false;
  quiet = 0; // 大于 0：有人正自己把“涨经验 / 升级 / 拿徽章”亮给用户看，全页面的提示条先别出（见 hush）

  /**
   * 按住全页面的提示条（main.js 里那几条）：经验、等级、徽章照常记，事件照常发，只是不再另外弹一条。
   * 音游的结算卡片自己会亮这一局涨了多少，用它免得同一件事说两遍。返回的函数调一下就松手。
   */
  hush() {
    this.quiet++;
    let held = true;
    return () => {
      if (held) this.quiet--;
      held = false;
    };
  }

  async load() {
    let saved = null;
    try {
      saved = await api.get('/api/progress');
    } catch {
      /* 服务没开也能用，退回浏览器里的备份 */
    }
    if (!saved || !Object.keys(saved).length) {
      try {
        saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      } catch {
        saved = null;
      }
    }
    this.data = merge(blank(), saved);
    if (!saved?.game) await this.#backfill(!!saved && Object.keys(saved).length > 0);
    else awardBadges(this.data, today()); // 规则里后来加的徽章，够得上的这时补上；不庆祝，首页上会标“新”
    this.loaded = true;
    this.emit('change');
  }

  /** 旧的进度文件：把经验值和已经够得上的徽章从已有进度回算出来。 */
  async #backfill(hadProgress) {
    let sessions = [];
    if (hadProgress) {
      try {
        sessions = (await api.get('/api/sessions?limit=200')).sessions || [];
      } catch {
        /* 读不到练习记录就只看进度文件 */
      }
    }
    const game = backfillGame(this.data, sessions);
    // 回算出来的等级是“本来就有的”，不当成升级来庆祝；徽章留着没看过的状态，首页上教练会介绍一次
    game.seen.level = levelOf(totalXp(this.data)).lv;
    game.seen.intro = totalXp(this.data) === 0 && !Object.keys(game.badges).length;
    if (hadProgress) this.#persist();
  }

  #persist = debounce(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(this.data));
    } catch {
      /* 存不下就算了 */
    }
    api.put('/api/progress', this.data).catch(() => {});
  }, 400);

  update(fn) {
    const before = totalXp(this.data);
    fn(this.data);
    const fresh = awardBadges(this.data, today());
    const after = totalXp(this.data);
    this.#persist();
    this.emit('change');
    // 涨了经验、升了级、拿了徽章：告诉界面（main.js 负责提示，首页负责展示）
    if (after > before) {
      this.emit('xp', { gained: after - before, total: after });
      const from = levelOf(before);
      const to = levelOf(after);
      if (to.lv > from.lv) this.emit('levelup', { from, to });
    }
    for (const badge of fresh) this.emit('badge', badge);
  }

  get settings() {
    return this.data.settings;
  }

  lesson(id) {
    return this.data.lessons[id] || { stepIndex: 0, done: false, stars: 0 };
  }

  setLessonStep(id, stepIndex) {
    this.update((d) => {
      const cur = d.lessons[id] || { stepIndex: 0, done: false, stars: 0 };
      d.lessons[id] = { ...cur, stepIndex: Math.max(cur.done ? 0 : cur.stepIndex, stepIndex), lastAt: new Date().toISOString() };
    });
  }

  /**
   * 课里一个计分的步骤（找按键、练习、编程挑战）得了几颗星：只记最好的一次，存在这节课的 stepStars 里（第几步 → 几颗）。
   * 存下来是因为一节课的星数要看每个计分步骤：不存的话，中途刷新一下页面、改天接着学，前面做过的就成了“没做”。
   */
  setStepStars(id, stepIndex, stars) {
    if ((this.data.lessons[id]?.stepStars?.[stepIndex] || 0) >= stars) return;
    this.update((d) => {
      const cur = d.lessons[id] || { stepIndex: 0, done: false, stars: 0 };
      d.lessons[id] = { ...cur, stepStars: { ...(cur.stepStars || {}), [stepIndex]: stars } };
    });
  }

  completeLesson(id, stars = 3) {
    this.update((d) => {
      const cur = d.lessons[id] || {};
      d.lessons[id] = { ...cur, done: true, stars: Math.max(cur.stars || 0, stars), completedAt: cur.completedAt || new Date().toISOString() };
    });
    this.markPracticed();
  }

  /** 记一局音游的成绩。 */
  recordResult(result) {
    this.update((d) => {
      const cur = d.charts[result.chartId] || { plays: 0, bestAccuracy: 0, bestStars: 0 };
      d.charts[result.chartId] = {
        plays: cur.plays + 1,
        bestAccuracy: Math.max(cur.bestAccuracy, result.accuracy),
        bestStars: Math.max(cur.bestStars, result.stars),
        lastAt: new Date().toISOString(),
      };
      d.lastResult = result;
      d.game.playXp += playXp(result.accuracy);
      statsFromResult(d.game.stats, result);
    });
    this.markPracticed();
    api.post('/api/sessions', { kind: 'game', result }).catch(() => {});
  }

  /** 课程里发生了一件徽章用得上、但进度里别处不记的事：'dictationAce' 听写题一次过 / 'ownBeat' 写了自己的鼓点。 */
  noteFeat(name) {
    if (!(name in this.data.game.stats)) return;
    this.update((d) => {
      d.game.stats[name]++;
    });
  }

  /**
   * 课程、小课堂、音游、每天练习之外的经验：加到 game.extraXp 里。眼下没有人用，是给以后的新内容留的口子。
   * 别的经验都是从进度算出来的、不会重复给（小课堂也是：看 classroom 字段，见 levels.js）；
   * 这一种是记账，防重复由调用的一方负责（比如第一次通过才给）。
   */
  addXp(amount) {
    const n = Math.round(Number(amount) || 0);
    if (n <= 0) return;
    this.update((d) => {
      d.game.extraXp = (d.game.extraXp || 0) + n;
    });
  }

  markPracticed() {
    const day = today();
    if (this.data.practiceDays.includes(day)) return;
    this.update((d) => {
      d.practiceDays = [...d.practiceDays, day].slice(-400);
    });
  }

  /** 本周（周一到周日）练了几天。 */
  weekCount() {
    return this.weekDays().filter(Boolean).length;
  }

  /** 本周一到周日，哪几天练了：[true, false, …] 共 7 项。 */
  weekDays() {
    const monday = new Date();
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const days = new Set(this.data.practiceDays);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return days.has(d.toLocaleDateString('sv'));
    });
  }

  /** 首页和导航栏要看的那几样：经验、等级、连续天数、本周、徽章。 */
  progress() {
    const { game } = this.data;
    const xp = xpBreakdown(this.data);
    const week = this.weekDays();
    const seen = new Set(game.seen.badges);
    const badges = BADGES.map((b) => ({ ...b, at: game.badges[b.id] || null, fresh: !!game.badges[b.id] && !seen.has(b.id) }));
    return {
      xp: xp.total,
      xpFrom: xp,
      level: levelOf(xp.total),
      streak: streaks(this.data.practiceDays, today()),
      week: { days: week, count: week.filter(Boolean).length, goal: WEEK_GOAL, today: (new Date().getDay() + 6) % 7 },
      badges,
      got: badges.filter((b) => b.at).length,
      intro: !game.seen.intro,
    };
  }

  /** 首页已经把现在的等级和徽章给用户看过了：下次不再标“新”。 */
  markSeen() {
    const { game } = this.data;
    const lv = levelOf(totalXp(this.data)).lv;
    const ids = Object.keys(game.badges);
    if (game.seen.intro && game.seen.level === lv && ids.every((id) => game.seen.badges.includes(id))) return;
    this.update((d) => {
      d.game.seen = { level: lv, badges: ids, intro: true };
    });
  }

  /** 清空学习进度（设置留着）。 */
  resetProgress() {
    this.update((d) => {
      d.lessons = {};
      d.charts = {};
      d.practiceDays = [];
      d.drills = [];
      d.lastResult = null;
      d.songs = { picked: [] };
      delete d.panelQuiz;
      delete d.classroom; // 小课堂学过的关（views/classroom.js 写的）
      d.game = blankGame();
      d.game.seen.intro = true;
    });
  }
}

export const store = new Store();
