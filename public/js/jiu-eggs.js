// 啾啾的彩蛋（用户 2026-11-13：“启动的时候、测验通过的时候、过了一关的时候、掌握一个知识点的时候……”）。小鸟本身的本事在 jiu.js，这里管什么时候用：
//   1 每天第一次打开：首页的问候按时间换个开头，它唱一小段、翻个跟头（home.js 调 homeHello()）
//   2 连续练到 3 / 7 / 30 天：绕着屏幕飞一圈、唱一段（同一段连续里每个天数只庆祝一次）
//   3 小测全对：用机器当前的调唱一段（lesson.js 的小测、小课堂的“试一试”拿三星时调 quizPerfect()）
//   4 一节课三星、升级：绕着庆祝卡飞一圈（celebrate.js 直接调 jiu.lap）
//   5 掌握一个知识点（小课堂一关拿三星、学完一整章）：叼一根羽毛回窝里。窝里的羽毛越攒越多，点开啾啾有“窝里的羽毛”
//   6 连点它 5 下：晕了（jiu.js）
//   7 学舌：不在上课、音游、设备页的时候，在机器的 Synth keys 上弹一小句，它学着叫回来
//   8 机器放了半分钟以上：从点头变成跟着拍子蹦（jiu.js）
// 记在进度文件的 jiu 字段：{ day: 今天打过招呼了（'YYYY-MM-DD'）, feathers: [送过的羽毛], streaks: ['7:连续开始的那天', …] }
import { h } from './util.js';
import { store, today } from './store.js';
import { streaks } from './levels.js';
import { LEVELS } from './content/classroom.js';
import { CHAPTERS } from './content/curriculum.js';
import { midi } from './midi.js';
import { seqtrak } from './seqtrak.js';
import { SCALES } from './scales.js';
import { sfx } from './sfx.js';
import { celebrating } from './celebrate.js';
import { coach } from './coach.js';
import * as jiu from './jiu.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (ok) => {
  while (!ok()) await sleep(500);
};
const free = () => !celebrating() && !sfx.held && !jiu.talking();
const saveJiu = (patch) => store.update((d) => {
  d.jiu = { ...(d.jiu || {}), ...patch(d.jiu || {}) };
});

// ───── 1 每天第一次打开 ─────
let greetedThisVisit = false;
function timeLine() {
  const hr = new Date().getHours();
  if (hr >= 5 && hr < 11) return '早，啾！';
  if (hr < 13 && hr >= 11) return '中午好，啾！';
  if (hr < 18 && hr >= 13) return '下午好，啾～';
  if (hr < 23 && hr >= 18) return '晚上好，啾！';
  return '这么晚还来练，啾？我陪你，别太累。';
}
/** 首页问候：今天第一次打开就返回一句按时间的开头，它唱一段、翻个跟头；不是第一次就只在这次打开时叫一声 */
export function homeHello() {
  if (greetedThisVisit) return '';
  greetedThisVisit = true;
  if (store.data.jiu?.day === today()) {
    setTimeout(() => jiu.chirp('greet'), 700);
    return '';
  }
  saveJiu(() => ({ day: today() }));
  setTimeout(() => {
    jiu.chirp('song');
    jiu.act('flip');
  }, 1300);
  return timeLine();
}

// ───── 2 连续练习的天数 ─────
async function checkStreak() {
  const st = streaks(store.data.practiceDays || [], today());
  if (!st.today) return;
  const m = [30, 7, 3].find((n) => st.current >= n);
  if (!m) return;
  const start = new Date(`${today()}T00:00:00`);
  start.setDate(start.getDate() - (st.current - 1));
  const key = `${m}:${start.toLocaleDateString('sv')}`;
  if ((store.data.jiu?.streaks || []).includes(key)) return;
  saveJiu((j) => ({ streaks: [...(j.streaks || []), key].slice(-20) }));
  await sleep(Math.max(0, bootAt + 5000 - performance.now())); // 刚打开时先让首页的问候唱完
  await until(free);
  await jiu.lap(() => document.querySelector('#view')?.getBoundingClientRect(), { ms: 2600 });
  jiu.say({ kind: 'nudge', html: m >= 30 ? '连续练了 <b>30 天</b>，啾！你已经是老鸟了。' : m >= 7 ? '连续练了 <b>7 天</b>，啾～一整周没断过。' : '连续练了 <b>3 天</b>，啾！手感要来了。', mood: 'cheer', act: 'flap', ms: 4200 });
}

// ───── 3 小测全对 ─────
/** 小测全对：用机器当前的调唱一段（没接机器就用它自己的调） */
export function quizPerfect() {
  const s = seqtrak.state;
  const opts = midi.connected && s.synced !== false ? { tonic: 60 + (s.key || 0), minor: /MINOR/.test(SCALES[s.scale]?.name || '') } : undefined;
  jiu.setMood('cheer', 2000);
  jiu.act('flap');
  jiu.chirp('song', opts);
}

// ───── 5 羽毛 ─────
const COLORS = { chapter: '#EC3A2A', theory: '#FFC61F', rhythm: '#8DB83A', fx: '#3FA9F5' };
const KIND = { chapter: '学完一章', theory: '乐理', rhythm: '节奏', fx: '效果' };
function featherSvg(f) {
  const c = COLORS[f.kind] || '#FF8A24';
  return h('svg', { viewBox: '0 0 10 24', html: `<path d="M5 .8 C 9.4 6, 9.6 15, 5.2 23.2 C .6 15, .8 6, 5 .8 Z" fill="${c}" stroke="rgba(0,0,0,.18)" stroke-width=".5"/><path d="M5 3 L 5.1 23.4" stroke="rgba(0,0,0,.35)" stroke-width=".8" fill="none"/><path d="M5 9 L 8 7 M5 13 L 8.4 11 M5 9 L 2 7 M5 13 L 1.6 11" stroke="rgba(255,255,255,.5)" stroke-width=".6" fill="none"/>` });
}
/** 掌握了的知识点：学完的整章、小课堂里拿了三星的关 */
export function feathers() {
  const out = [];
  for (const c of CHAPTERS) {
    if (c.soon || !c.lessons?.length) continue;
    if (c.lessons.every((l) => store.data.lessons[l.id]?.done)) out.push({ id: `ch:${c.no}`, kind: 'chapter', title: `第 ${c.no} 章 ${c.title}` });
  }
  for (const l of LEVELS) {
    if ((store.data.classroom?.[l.id]?.stars || 0) >= 3) out.push({ id: `cl:${l.id}`, kind: l.line, title: `${l.id} ${l.title}`, sub: l.about });
  }
  return out;
}
const shown = new Set(); // 窝里已经摆上的
function drawNest(fresh) {
  const nest = document.querySelector('#coach-toggle .jiu-nest');
  if (!nest) return;
  let box = nest.querySelector('.jiu-feathers');
  if (!box) nest.append((box = h('span', { class: 'jiu-feathers', 'aria-hidden': 'true' })));
  const list = feathers().filter((f) => shown.has(f.id)).slice(-11);
  const n = list.length;
  box.replaceChildren(...list.map((f, i) => {
    const a = n === 1 ? 0 : -62 + (124 * i) / (n - 1);
    return h('i', { class: f.id === fresh ? 'new' : '', style: { '--a': `${a.toFixed(1)}deg` } }, featherSvg(f));
  }));
  const all = feathers().filter((f) => shown.has(f.id)).length;
  document.querySelector('#coach-toggle')?.setAttribute('title', `啾啾的窝${all ? `（${all} 根羽毛）` : ''}：点啾啾和它说话，双击这里叫它回来`);
}
/** 叼一根羽毛回窝里 */
async function deliver(f) {
  jiu.carry(featherSvg(f));
  const leave = jiu.goNest();
  await jiu.settled();
  await sleep(300);
  jiu.carry(null);
  shown.add(f.id);
  drawNest(f.id);
  jiu.chirp('ok');
  jiu.act('nod');
  jiu.say({ kind: 'nudge', html: `叼回来一根羽毛，啾！<b>${f.title}</b>，${f.kind === 'chapter' ? '这一章学完啦。' : '这个你掌握了。'}`, mood: 'happy', ms: 2800 });
  await sleep(3000); // 话说完了再飞回去（不然对话框会跟着飞回去再冒一下）
  leave();
}
let delivering = false;
async function checkFeathers() {
  if (delivering) return;
  const seen = new Set(store.data.jiu?.feathers || []);
  const fresh = feathers().filter((f) => !seen.has(f.id) && !shown.has(f.id));
  if (!fresh.length) return;
  delivering = true;
  saveJiu((j) => ({ feathers: [...new Set([...(j.feathers || []), ...fresh.map((f) => f.id)])] }));
  try {
    await until(free);
    await sleep(800);
    for (const f of fresh) await deliver(f);
  } finally {
    delivering = false;
  }
}
function showFeathers() {
  const list = feathers().filter((f) => shown.has(f.id));
  jiu.say({
    paper: {
      title: `窝里的羽毛 · ${list.length} 根`,
      node: h('div', {},
        h('p', { class: 'jiu-paper-tip', style: { margin: '0 0 8px' } }, '你每掌握一个知识点（小课堂一关拿三星，或者学完一整章），我就叼一根羽毛回窝里。'),
        h('ul', { class: 'jiu-feather-list' }, list.map((f) => h('li', {}, h('i', {}, featherSvg(f)), h('b', {}, f.title), h('small', {}, f.sub || KIND[f.kind] || ''))))),
    },
    mood: 'happy',
    chips: [['合上', null, { primary: true }]],
  });
}

// ───── 7 学舌 ─────
const MIMIC_CH = new Set([8, 9, 10]); // SYNTH 1、SYNTH 2、DX
let phrase = [];
let phraseTimer = 0;
let lastEcho = 0;
let mimicked = false;
const mimicOk = () => {
  const at = location.hash;
  return !midi.playing && !seqtrak.state.playing && !sfx.held && !jiu.talking() && !/^#\/(lesson|device|arcade\/|classroom\/)/.test(at);
};
function echoBack() {
  const list = phrase.slice(-10);
  phrase = [];
  if (list.length < 3 || performance.now() - lastEcho < 6000 || !mimicOk()) return;
  lastEcho = performance.now();
  const notes = list.map((n, i) => [(n.at - list[0].at) / 1000, n.note, Math.min(0.25, ((list[i + 1]?.at ?? n.at + 220) - n.at) / 1000 * 0.8)]);
  const span = notes[notes.length - 1][0];
  if (span > 2.6) for (const n of notes) n[0] = (n[0] * 2.6) / span;
  jiu.setMood('listen');
  setTimeout(() => {
    jiu.setMood('happy', 1800);
    jiu.chirp('echo', { notes });
    if (!mimicked) {
      mimicked = true;
      jiu.say({ kind: 'nudge', html: '学你的，啾！', mood: 'happy', ms: 1800 });
    }
  }, 450);
}
function onNote(m) {
  if (!MIMIC_CH.has(m.ch) || !mimicOk()) return;
  const now = performance.now();
  const last = phrase[phrase.length - 1];
  if (last && now - last.at < 35) {
    if (m.note > last.note) last.note = m.note; // 一下按了个和弦：取最高的那个音
    return;
  }
  phrase.push({ at: now, note: m.note });
  clearTimeout(phraseTimer);
  phraseTimer = setTimeout(echoBack, 1300);
}

// ───── 装上 ─────
let started = false;
let bootAt = 0;
export function initEggs() {
  if (started) return;
  started = true;
  bootAt = performance.now();
  // 第一次有这一段：以前学会的都算已经在窝里了，不用一根一根叼
  if (!Array.isArray(store.data.jiu?.feathers)) saveJiu(() => ({ feathers: feathers().map((f) => f.id) }));
  for (const id of store.data.jiu?.feathers || []) shown.add(id);
  drawNest();
  coach.offerTail(() => (shown.size ? [[`窝里的羽毛 · ${feathers().filter((f) => shown.has(f.id)).length}`, showFeathers]] : []));
  let t = 0;
  store.on('change', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      checkFeathers();
      checkStreak();
    }, 700);
  });
  setTimeout(checkStreak, 4000);
  midi.on('noteon', onNote);
}
