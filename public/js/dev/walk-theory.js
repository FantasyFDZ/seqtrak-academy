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
import { benchSong } from '../theory-songs.js';
import { posOf } from '../theory-staff.js';
import { unroll } from '../theory-quiz3.js';

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
        } else if (t.type === 'tryhome' || t.type === 'third') {
          // 第三期 · 拆歌：试停找家（先停在第 5 级上，要被说“还悬着”），认梯子（先点另一个第 3 级，要被说“打架”）
          const song = benchSong(t.tune);
          const off3 = song.ladder === 'minor' ? [3, 4] : [4, 3]; // [对的, 另一个]
          if (t.type === 'tryhome') {
            key(song.root + 7);
            await sleep(200);
            await idle();
            r.miss = bad();
            r.said = said();
            key(song.root + 1); // 不在梯子上的：要被说“打架”
            await sleep(200);
            await idle();
            r.miss2 = bad();
            key(song.root);
            await sleep(200);
            await idle();
          }
          if (t.type === 'third' || t.third) {
            key(song.root + off3[1]);
            await sleep(200);
            await idle();
            r.miss3 = bad();
            r.said3 = said();
            key(song.root + off3[0]);
          }
        } else if (t.type === 'rootfill') {
          const song = benchSong(t.tune);
          key(B.degMidi(wrap7(song.prog[0] + 1)));
          await sleep(200);
          await idle();
          r.miss = bad();
          r.said = said();
          for (const d of song.prog) {
            key(B.degMidi(d));
            await sleep(150);
            await idle();
          }
          r.filled = $$('.tp-slot:not(.empty)').length;
        } else if (t.type === 'usedkeys') {
          const want = [...new Set(R.mel.map((n) => B.degOf(n.m)))];
          const no = [1, 2, 3, 4, 5, 6, 7].find((d) => !want.includes(d));
          if (no) {
            key(B.degMidi(no));
            r.miss = bad();
            r.said = said();
          }
          for (const d of want) {
            key(B.degMidi(d));
            await sleep(60);
          }
        } else if (t.type === 'marknote') {
          const tap = (i) => {
            const n = R.mel[i];
            cell('pointerdown', n.s, n.m);
            cell('pointerup', n.s, n.m);
          };
          if (t.accept) {
            tap(R.mel.findIndex((_, i) => !t.accept.includes(i)));
            r.miss = bad();
            r.said = said();
            await sleep(100);
            tap(t.accept[0]);
          } else {
            tap(R.mel.findIndex((_, i) => !t.ends.includes(i)));
            r.miss = bad();
            await sleep(100);
            const home = (i) => B.degOf(R.mel[i].m) === 1;
            tap(t.ends.find((i) => home(i) !== (t.want === 'home')));
            r.miss2 = bad();
            r.said = said();
            await sleep(100);
            tap(t.ends.find((i) => home(i) === (t.want === 'home')));
          }
        } else if (t.type === 'staffkey') {
          // 第三期 · 选学：谱子上的题。谱面上能点的地方是一块块透明的方块（.ts-hot），按下去和真的手指一样
          key(t.notes[0] + (t.notes[0] % 12 === 4 || t.notes[0] % 12 === 11 ? 1 : 2));
          r.miss = bad();
          r.said = said();
          for (const m of t.notes) {
            key(m);
            await sleep(80);
          }
        } else if (t.type === 'keystaff') {
          ctlBtn('放这儿').click();
          r.miss = bad();
          r.said = said();
          const want = posOf(t.m);
          const p = B.staff.pointOf(1, want);
          ptr('pointerdown', B.staff.hot('[data-spot]'), p.x, p.y); // 直接点谱面上那个位置
          await sleep(80);
          r.spot = B.staff.state.spot.pos === want;
          if (!r.spot) for (let n = 0; n < 14 && B.staff.state.spot.pos !== want; n++) ctlBtn(B.staff.state.spot.pos < want ? '高一级' : '低一级').click();
          ctlBtn('放这儿').click();
        } else if (t.type === 'onsets') {
          const hit = (k) => $$('.tn-pad .cl-key')[k].click(); // 两排 16 个方键
          const want = t.notes.filter((n) => n[2] !== 'r').map((n) => n[0]);
          const wrong = [1, 2, 3, 5].find((k) => !want.includes(k));
          hit(wrong);
          ctlBtn('对一下').click();
          r.miss = bad();
          r.said = said();
          hit(wrong); // 再点一下：拿掉
          want.forEach(hit);
          ctlBtn('对一下').click();
        } else if (t.type === 'spell' || t.type === 'fillbar') {
          const card = (l, rest) => $(`.tn-card[data-len="${l}"][data-rest="${rest ? '1' : ''}"]`).click();
          if (t.type === 'fillbar') {
            const gap = (t.bar || 16) - Math.max(...t.notes.map((n) => n[0] + n[1]));
            card(gap === 8 ? 4 : 8, false);
            r.miss = bad();
            r.said = said();
            card(gap, false);
          } else {
            const first = t.notes[0];
            card(first[1] === 4 ? 2 : 4, first[2] === 'r');
            r.miss = bad();
            r.said = said();
            for (const n of t.notes) {
              card(n[1], n[2] === 'r');
              await sleep(60);
            }
          }
        } else if (t.type === 'barlines') {
          ctlBtn('对一下').click();
          r.miss = bad();
          r.said = said();
          for (let at = t.bar; at < t.steps; at += t.bar) ptr('pointerdown', B.staff.hot(`[data-line="${at}"]`));
          ctlBtn('对一下').click();
        } else if (t.type === 'dynamics') {
          ctlBtn('对一下').click();
          r.miss = bad();
          r.said = said();
          const DYN = { p: 1, mf: 2, f: 3 };
          let mark = 'mf';
          const want = t.notes.map((_, i) => DYN[(mark = t.marks?.[i] || mark)]);
          if (t.hairpin) for (let i = t.hairpin[0]; i <= t.hairpin[1]; i++) want[i] = Math.min(3, 1 + i - t.hairpin[0]);
          for (let i = 0; i < want.length; i++) {
            for (let n = 0; n < (want[i] - 2 + 3) % 3; n++) {
              ptr('pointerdown', B.staff.hot(`[data-note="${i}"]`));
              await sleep(40);
            }
          }
          ctlBtn('对一下').click();
        } else if (t.type === 'roadmap') {
          const route = unroll(t.bars, t.repeats, t.voltas);
          const tap = (b) => ptr('pointerdown', B.staff.hot(`[data-bar="${b}"]`));
          tap(route[0] === 0 ? 1 : 0);
          r.miss = bad();
          // 走到反复记号那儿故意接着往右：要被说“跳回去”
          for (let n = 0; n < route.length; n++) {
            if (n > 0 && route[n] <= route[n - 1] && !r.miss2) {
              tap(Math.min(t.bars - 1, route[n - 1] + 1));
              r.miss2 = bad();
              r.said = said();
            }
            tap(route[n]);
            await sleep(120);
          }
        } else if (t.type === 'invert') {
          const now = () => $$('.tb-key.ch').map((x) => Number(x.dataset.m)).sort((a, b) => a - b);
          key(now()[1]);
          r.miss = bad();
          r.said = said();
          for (let n = 0; n < 4 && !$('.tg-note.ok'); n++) {
            key(now()[0]);
            await sleep(120);
          }
        } else if (t.type === 'nearest') {
          ctlBtn('对一下').click();
          r.miss = bad();
          const target = B.chordOf(t.to);
          const far = target.map((m) => (m + 12 <= 84 ? m + 12 : m)); // 高一层的原样：音对了，可挪得远
          far.forEach(key);
          ctlBtn('对一下').click();
          r.miss2 = bad();
          r.said = said();
          ctlBtn('清掉重选').click();
          const up = (list) => [...list].sort((a, b) => a - b);
          const cost = (a, b) => up(a).reduce((sum, x, j) => sum + Math.abs(x - up(b)[j]), 0);
          const where = (pc) => Array.from({ length: 25 }, (_, j) => 60 + j).filter((m) => m % 12 === pc % 12);
          let best = null;
          for (const a of where(target[0])) for (const b2 of where(target[1])) for (const c of where(target[2])) if (!best || cost(t.from, [a, b2, c]) < cost(t.from, best)) best = [a, b2, c];
          best.forEach(key);
          ctlBtn('对一下').click();
        } else if (t.type === 'suspend') {
          const d = t.deg || 1;
          const spot = { mid: B.chordOf(d)[1], up: B.degMidi(d + 3), down: B.degMidi(d + 1) };
          key(B.chordOf(d)[0]);
          r.miss = bad();
          r.said = said();
          key(spot[t.want === 'back' ? 'mid' : t.want]);
        } else if (t.type === 'addtone') {
          const d = t.deg || 1;
          key(B.degMidi(d + 6));
          r.miss = bad();
          r.said = said();
          await sleep(100);
          key(B.degMidi(d + 8));
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

/**
 * 量版式（2026-11-18 第三期）：把一关的每个小步、挑战的三档挨个摆出来，量有没有要滚的、出框的、小于 44 像素的按钮。
 * 浏览器面板藏着的时候截图不可信，尺寸照样量得准。窗口先调成要量的大小（比如 1024 × 768）。
 *   const w = await import('/js/dev/walk-theory.js'); await w.measure(['T28', 'T31']);   // 返回有问题的那几屏；一屏都没有就是 []
 * 钢琴键和格子里的小块本来就窄（前两期就这样），不报。
 */
export async function measure(ids) {
  const out = [];
  for (const id of ids) {
    location.hash = '#/classroom';
    await sleep(200);
    location.hash = `#/classroom/${id}`;
    await until(() => $('.cl-lesson .cl-stage > *'), 3000);
    const level = levelById(id);
    const check = (where) => {
      const stage = $('.cl-stage');
      const sr = stage.getBoundingClientRect();
      const probs = [];
      const scrolls = (el, name) => {
        if (!el) return;
        if (el.scrollHeight > el.clientHeight + 1) probs.push(`${name}要滚 ${el.scrollHeight - el.clientHeight}`);
        if (el.scrollWidth > el.clientWidth + 1) probs.push(`${name}横着溢出 ${el.scrollWidth - el.clientWidth}`);
      };
      scrolls(document.documentElement, '整页');
      scrolls(stage, '舞台');
      scrolls($('.tg-panel'), '小步那一块');
      scrolls($('.cl-side'), '右边栏');
      for (const el of $$('.cl-stage .tb, .cl-stage .tg-panel, .cl-stage .tg-foot, .cl-stage .tq-row, .cl-stage .tq-note, .cl-stage .cl-relay-bar')) {
        const r = el.getBoundingClientRect();
        if (r.height && (r.bottom > sr.bottom + 1 || r.right > sr.right + 1)) probs.push(`${el.className.split(' ')[0]} 出框 ${Math.round(Math.max(r.bottom - sr.bottom, r.right - sr.right))}`);
      }
      for (const b of $$('.cl-stage button, .cl-stage .ts-hot, .cl-side button')) {
        const r = b.getBoundingClientRect();
        if (!r.width || !r.height || b.closest('[hidden]') || b.classList.contains('tb-key')) continue;
        if (r.height < 43.5 || r.width < 43.5) probs.push(`${(b.textContent || [...b.classList].join('.') || b.tagName).trim().slice(0, 8)} ${Math.round(r.width)}×${Math.round(r.height)}`);
      }
      if (probs.length) out.push({ id, where, probs: [...new Set(probs)] });
    };
    if (level.guide) {
      const g = $('.cl-lesson').guide;
      for (let k = 0; k < level.guide.beats.length; k++) {
        g.go(k);
        await sleep(250);
        check(`小步 ${k + 1}`);
      }
      $('.cl-side-foot .btn.lg').click();
      await sleep(400);
    }
    for (const tier of [1, 2, 3]) {
      const pill = $(`.cl-tier.t${tier}`);
      if (!pill) break;
      pill.click();
      await sleep(500);
      check(`挑战 ${['铜', '银', '金'][tier - 1]}`);
    }
  }
  return out;
}
