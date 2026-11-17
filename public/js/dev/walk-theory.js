// 开发测试用（2026-11-17 乐理线重做）：把“跟啾啾学”的每个小步用**真的按键**做一遍——先故意按错一下，看啾啾的提示出不出来，再按对。
// （walk-classroom2.js 走这一步用的是 guide.auto()，直接把小步记成做完，不经过按键的判断；这个脚本补的就是那一块。）
// 第二期加的任务（走跳、画线、学舌、改尾巴、改长短、叠和弦、亮暗地图、配贝斯、三盏灯、选最后一格、找邻居、回家圈、挪音）也都有真按键的走法：
// 键盘上的键、机器的键、回家圈的站是 pointerdown；格子里是带坐标的 pointerdown / pointermove / pointerup（拖把手、画线）。
// 平时应用不会加载它。用法（浏览器控制台，或自动化脚本里）：
//   const w = await import('/js/dev/walk-theory.js');
//   await w.run('T15');          // 走一关的“跟啾啾学”，返回每个小步的结果
//   w.start(['T5', 'T6']);       // 不等它，一关一关走；走完 window.__thWalkDone = true，结果在 window.__thWalk
// 结果里每个小步：ok = 做完了；miss = 故意按错的那一下有没有出提示（没有“按错”这回事的小步不写）；said = 按错时啾啾说的头几个字。
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
const ptr = (type, node, x = 10, y = 10) => node?.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, clientX: x, clientY: y }));
const down = (node) => ptr('pointerdown', node);
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const RING = [1, 4, 7, 3, 6, 2, 5];
const wrap7 = (d) => ((((d - 1) % 7) + 7) % 7) + 1;

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
  const R = B.roll;
  const key = (m) => down(B.key(m));
  const idle = () => until(() => !B.busy && !B.locked, 16000);
  const bad = () => !!$('.tg-note.bad');
  const said = () => $('.tg-note').textContent.slice(0, 46);
  const ctlBtn = (text) => $$('.tg-ctl .btn').find((b) => b.textContent.includes(text));
  /** 格子里：在第 step 格、键号 m 那一行按下 / 挪到 / 松开 */
  const cell = (type, step, m, dx) => {
    const p = R.pointOf(step, m, dx);
    ptr(type, R.grid, p.x, p.y);
  };
  /** 拖第 k 个音右边的小把手，拉成 len 格 */
  const dragLen = (k, len) => {
    const n = R.mel[k];
    const grip = R.noteEl(k).querySelector('.tr-grip');
    const a = R.pointOf(n.s + n.l - 1, n.m, 0.9);
    ptr('pointerdown', grip, a.x, a.y);
    cell('pointermove', n.s + len - 1, n.m);
    cell('pointerup', n.s + len - 1, n.m);
  };
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
            r.said = said();
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
          r.said = said();
          for (const m of midis.slice(1)) {
            key(m);
            await sleep(60);
          }
        } else if (t.type === 'freeladder') {
          key(t.root + 5);
          r.miss = bad();
          r.said = said();
          for (const o of [2, 3, 5, 7, 9, 10, 12]) {
            key(t.root + o);
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
          const accept = t.accept || [1];
          const wrong = [1, 3, 5, 4, 6].find((d) => !accept.includes(d) && d <= B.state.ladder.offsets.length);
          key(B.degMidi(wrong));
          await sleep(200);
          await idle();
          r.miss = bad();
          r.said = said();
          key(B.degMidi(accept[0]));
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
        } else if (t.type === 'walk') {
          key(B.degMidi(t.from + (t.want === 'step' ? 2 : 1)));
          r.miss = bad();
          r.said = said();
          key(B.degMidi(t.from + (t.want === 'step' ? 1 : 2)));
        } else if (t.type === 'draw') {
          ctlBtn('画好了').click();
          r.miss = bad();
          r.said = said();
          const unit = t.unit || 2;
          const line = t.demo || [1, 2, 3, 5, 4, 3, 2, 1];
          cell('pointerdown', 0, B.degMidi(line[0]));
          for (let c = 1; c < line.length; c++) {
            cell('pointermove', c * unit, B.degMidi(line[c]));
            await sleep(30);
          }
          cell('pointerup', (line.length - 1) * unit, B.degMidi(line[line.length - 1]));
          r.drawn = R.mel.length;
          ctlBtn('画好了').click();
        } else if (t.type === 'repeat') {
          const want = t.motif.map((d) => B.degMidi(d));
          key(want[0] + 2);
          r.miss = bad();
          r.said = said();
          for (const m of want) {
            key(m);
            await sleep(60);
          }
        } else if (t.type === 'vary') {
          const want = t.motif.map((d) => B.degMidi(d));
          const keep = t.keep ?? 2;
          key(want[0] + 2);
          r.miss = bad();
          // 先原样弹一遍：要被打回来（“这回尾巴要改”）
          for (const m of want) {
            key(m);
            await sleep(60);
          }
          r.said = said();
          r.miss2 = bad();
          const tail = Array.from({ length: want.length - keep }, (_, j) => (j === want.length - keep - 1 ? B.degMidi(1) : B.degMidi(2)));
          for (const m of tail) {
            key(m);
            await sleep(60);
          }
        } else if (t.type === 'lengths') {
          // 先动一个不该动的音：第 1 个音右边顶着第 2 个，拉不动
          const targets = Object.keys(t.want).map(Number);
          const other = [0, 1, 2].find((x) => !targets.includes(x));
          down(R.noteEl(other));
          ctlBtn('长一格').click();
          r.miss = bad();
          r.said = said();
          for (const x of targets) {
            down(R.noteEl(x));
            await sleep(40);
            if (x % 2 === 0) dragLen(x, t.want[x]); // 一半用拖的
            else for (let n = 0; n < 8 && R.mel[x].l !== t.want[x]; n++) ctlBtn(R.mel[x].l < t.want[x] ? '长一格' : '短一格').click(); // 一半用按钮
            await sleep(60);
          }
        } else if (t.type === 'sketch') {
          ctlBtn('长一格').click();
          r.miss = bad();
          cell('pointerdown', 0, B.degMidi(3));
          cell('pointerup', 0, B.degMidi(3));
          await sleep(60);
          r.placed = R.mel.length;
          dragLen(0, t.long);
        } else if (t.type === 'pair') {
          const base = t.base || 1;
          const wrongGap = [1, 2, 4].find((x) => !t.gap.includes(x));
          key(B.degMidi(base + wrongGap));
          r.miss = bad();
          r.said = said();
          await sleep(120);
          key(B.degMidi(base + t.gap[0]));
        } else if (t.type === 'stack') {
          const size = t.size || 3;
          const have = t.have || 1;
          key(B.degMidi(t.root + 2 * (have - 1) + 1));
          r.miss = bad();
          r.said = said();
          for (let j = have; j < size; j++) {
            key(B.degMidi(t.root + 2 * j));
            await sleep(80);
          }
        } else if (t.type === 'chordmap') {
          key(L.root + 1);
          r.miss = bad();
          for (let d = 1; d <= 7; d++) {
            if (d % 2) down(B.synthKey(d));
            else key(B.degMidi(d));
            await sleep(60);
          }
        } else if (t.type === 'bassline') {
          const chords = R.state.chords;
          key(chords[0].notes[1]);
          r.miss = bad();
          r.said = said();
          for (const c of chords) {
            key(c.notes[0]);
            await sleep(80);
          }
        } else if (t.type === 'lamps') {
          const btns = $$('.tg-ctl .btn').filter((x) => !x.classList.contains('tg-listen'));
          for (const x of btns) {
            x.click();
            await sleep(200);
            await idle();
            if (!r.said) r.said = said();
          }
          r.lit = $$('.tb-lamp.on').length;
        } else if (t.type === 'cadence') {
          const accept = t.accept || (t.want === 'home' ? [1] : [5]);
          key(B.degMidi(t.want === 'home' ? 5 : 1));
          await sleep(200);
          await idle();
          r.miss = bad();
          r.said = said();
          key(B.degMidi(accept[0]));
        } else if (t.type === 'shared') {
          const from = t.prog ? t.prog[t.slot] : t.from;
          key(B.degMidi(wrap7(from + 1)));
          await sleep(200);
          await idle();
          r.miss = bad();
          r.said = said();
          const near = [wrap7(from + 2), wrap7(from - 2)].find((d) => !t.prog || (d !== t.prog[t.slot - 1] && d !== t.prog[t.slot + 1]));
          key(B.degMidi(near));
        } else if (t.type === 'ringwalk') {
          down(B.ring.station(t.from === 2 ? 1 : 2));
          r.miss = bad();
          r.said = said();
          for (let j = RING.indexOf(t.from) + 1; ; j++) {
            const d = RING[j % 7];
            if (j % 2) down(B.ring.station(d));
            else key(B.degMidi(d));
            await sleep(80);
            if (d === 1) break;
          }
        } else if (t.type === 'note') {
          const cur = R.mel[t.idx];
          const c = R.state.chords.find((x) => x.s <= cur.s && cur.s < x.s + x.l);
          const inC = (m) => c.notes.some((x) => (x - m) % 12 === 0);
          const rows = R.state.rows.filter((m) => B.rungOf(m) !== null);
          if (t.rule === 'pass') {
            const a = R.mel[t.idx - 1].m;
            const z = R.mel[t.idx + 1].m;
            key(a); // 和弦里的音：是踩上去，不是路过
            r.miss = bad();
            r.said = said();
            key(rows.find((m) => m > Math.min(a, z) && m < Math.max(a, z) && !inC(m)));
          } else {
            key(rows.find((m) => !inC(m) && m !== cur.m && Math.abs(m - cur.m) < 6));
            r.miss = bad();
            r.said = said();
            key(rows.filter(inC).sort((x, y) => Math.abs(x - cur.m) - Math.abs(y - cur.m))[0]);
          }
        }
      }
    } catch (e) {
      r.crash = String(e.stack || e).slice(0, 300);
    }
    r.ok = !!(await until(() => $('.tg-note.ok'), 18000));
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
