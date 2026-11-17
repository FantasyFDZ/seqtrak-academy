// 开发测试用（2026-11-17 乐理线重做）：把“跟啾啾学”的每个小步用**真的按键**做一遍——先故意按错一下，看啾啾的提示出不出来，再按对。
// （walk-classroom2.js 走这一步用的是 guide.auto()，直接把小步记成做完，不经过按键的判断；这个脚本补的就是那一块。）
// 平时应用不会加载它。用法（浏览器控制台，或自动化脚本里）：
//   const w = await import('/js/dev/walk-theory.js');
//   await w.run('T15');          // 走一关的“跟啾啾学”，返回每个小步的结果
//   w.start(['T5', 'T6']);       // 不等它，一关一关走；走完 window.__thWalkDone = true，结果在 window.__thWalk
// 结果里每个小步：ok = 做完了；miss = 故意按错的那一下有没有出提示（没有“按错”这回事的小步不写）。
import { levelById } from '../content/classroom.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
async function until(cond, ms = 4000, every = 50) {
  const end = performance.now() + ms;
  for (;;) {
    const v = cond();
    if (v) return v;
    if (performance.now() > end) return false;
    await sleep(every);
  }
}
const down = (node) => node?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1 }));
const MINOR = [0, 2, 3, 5, 7, 8, 10];

export async function run(id) {
  if (location.port === '4747') return { id, refused: '这是正式的服务（真实进度），不在这里跑。' };
  const level = levelById(id);
  const errors = [];
  const onErr = (e) => errors.push(String(e.message || e.reason));
  addEventListener('error', onErr);
  addEventListener('unhandledrejection', onErr);
  location.hash = '#/classroom';
  await sleep(250);
  location.hash = `#/classroom/${id}`;
  await until(() => $('.cl-lesson')?.guide, 3000);
  const g = $('.cl-lesson').guide;
  const B = g.bench;
  const key = (m) => down(B.key(m));
  const idle = () => until(() => !B.busy && !B.locked, 9000);
  const bad = () => !!$('.tg-note.bad');
  const out = [];
  for (let k = 0; k < level.guide.beats.length; k++) {
    const b = level.guide.beats[k];
    if (g.index !== k) g.go(k);
    await sleep(150);
    const r = { k: k + 1, kind: b.kind };
    try {
      if (b.kind === 'listen' || b.kind === 'song') {
        $('.tg-listen').click();
      } else if (b.kind === 'compare') {
        for (const btn of $$('.tg-ab')) {
          btn.click();
          await sleep(200);
          await idle();
        }
      } else if (b.kind === 'pick') {
        const wrong = $$('.tg-opt').find((o) => !o.__right);
        wrong?.click();
        r.miss = bad();
        $$('.tg-opt').find((o) => o.__right).click();
      } else if (b.kind === 'do') {
        const t = b.task;
        r.type = t.type;
        const L = B.state.ladder;
        if (t.type === 'press') {
          if (t.key) {
            key(L.root);
            r.miss = bad();
            down(B.synthKey(t.key));
          } else if (t.rel) {
            key(t.rel === 'higher' ? t.ref - 3 : t.ref + 3);
            r.miss = bad();
            key(t.rel === 'higher' ? t.ref + 3 : t.ref - 3);
          } else {
            key(t.any[0] + (t.any[0] < 84 ? 1 : -1));
            r.miss = bad();
            r.said = $('.tg-note').textContent.slice(0, 40);
            key(t.any[0]);
          }
        } else if (t.type === 'all') {
          const want = [];
          for (let m = 60; m <= 84; m++) if (m % 12 === t.pc) want.push(m);
          key(want[0] + 1);
          r.miss = bad();
          want.forEach(key);
        } else if (t.type === 'seq') {
          const midis = [t.root];
          t.steps.forEach((n) => midis.push(midis[midis.length - 1] + n));
          key(midis[1] + 1);
          r.miss = bad();
          r.said = $('.tg-note').textContent.slice(0, 50);
          for (const m of midis.slice(1)) {
            key(m);
            await sleep(60);
          }
        } else if (t.type === 'rungs') {
          key(L.root + 2);
          r.miss = bad();
          for (const d of [3, 6, 7]) {
            key(B.state.ladder.root + B.state.ladder.offsets[d - 1]);
            await sleep(60);
          }
        } else if (t.type === 'drop') {
          key(L.root);
          r.miss = bad();
          for (const d of t.degrees) {
            key(L.root + MINOR[d - 1]);
            await sleep(60);
          }
        } else if (t.type === 'last') {
          $('.tg-listen').click();
          await sleep(200);
          await idle();
          key(B.degMidi(B.state.ladder.offsets.length >= 7 ? 5 : 4));
          await sleep(200);
          await idle();
          r.miss = bad();
          r.said = $('.tg-note').textContent.slice(0, 40);
          key(B.state.ladder.root);
        } else if (t.type === 'home') {
          for (let n = 0; n < 12 && !$('.tg-note.ok'); n++) {
            $$('.tg-keybtn')[1].click();
            await sleep(40);
          }
        } else if (t.type === 'match') {
          for (let n = 0; n < t.rounds + 1 && !$('.tg-note.ok'); n++) {
            const hit = await until(() => $('.tb-key.target') || $('.tb-skey.target'), 2500);
            if (!hit) break;
            if (hit.classList.contains('tb-key')) {
              const m = Number(hit.dataset.m);
              const d = [1, 2, 3, 4, 5, 6, 7].find((x) => B.machineNote(x) === m);
              if (n === 0) {
                down(B.synthKey(d === 1 ? 2 : 1));
                r.miss = bad();
              }
              down(B.synthKey(d));
            } else {
              const d = Number(hit.dataset.key);
              if (n === 0) {
                key(B.machineNote(d) + 1);
                r.miss = bad();
              }
              key(B.machineNote(d));
            }
            await sleep(750);
          }
        } else if (t.type === 'free') {
          key(L.root + 1);
          r.miss = bad();
          for (let n = 0; n < t.count; n++) {
            key(B.degMidi(1 + (n % 5)));
            await sleep(40);
          }
        } else if (t.type === 'answer') {
          key(L.root);
          r.miss = bad();
          $('.tg-listen').click();
          await sleep(200);
          await idle();
          for (const d of [3, 2, 2, 1]) {
            key(B.degMidi(d));
            await sleep(60);
          }
        }
      }
    } catch (e) {
      r.crash = String(e.stack || e).slice(0, 300);
    }
    r.ok = !!(await until(() => $('.tg-note.ok'), 9000));
    if (!r.ok) r.note = $('.tg-note')?.textContent.slice(0, 60);
    out.push(r);
  }
  removeEventListener('error', onErr);
  removeEventListener('unhandledrejection', onErr);
  const res = { id, beats: out, allOk: out.every((x) => x.ok), next: $('.cl-side-foot .btn.lg')?.classList.contains('primary'), errors };
  (window.__thWalk ||= {})[id] = res;
  return res;
}

export function start(ids) {
  window.__thWalkDone = false;
  (async () => {
    for (const id of ids) await run(id);
    window.__thWalkDone = true;
  })();
  return ids;
}
