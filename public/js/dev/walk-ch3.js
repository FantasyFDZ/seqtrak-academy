// 开发测试用：把第 3 章的一节课从头到尾走一遍，确认每一步都能完成、没有报错。平时应用不会加载它。
// 用法（浏览器控制台，或自动化脚本）：
//   const ch3 = await import('/js/dev/walk-ch3.js');
//   await ch3.run('3-1');          // 没接真机时：在模拟机上走
//   await ch3.run('3-2');          // 地址里带 ?fake 时：接着假真机走（认不出的任务替你点“做好了”）
//   await ch3.run('3-4', 4, 5);    // 只走第 5、6 步（从 0 数）；要求页面已经停在第 5 步上
// 返回 { lesson, mode, steps: [{ i, title, ok, … }], errors }：ok = 这一步做完之后“下一步”亮了（音游是“两段都过了”）。
// 音游要等真实时间，一局十几二十秒；一节课里有两三局的，分几次调用更稳。
// 改了课程、模拟机、镜像或音游之后，用它在两种情况下各重走一遍。
// 也可以直接在地址里写 ?walk=3-1（加 ?fake 就是假真机）：页面加载完自动走，结果写进页面里 id 为 walk-result 的元素。
// tools/mac-check.sh 就是这样在 Mac 的无界面 Chrome 里走 3.1 和 3.3 的（这两节没有音游；音游在无界面的浏览器里跑不了）。
// 注意：走查会把课标记成“完成”、写入假的成绩，只在测试数据上跑；在正式服务的端口（4747）上它会拒绝。
import { install } from './walkthrough.js';
import { findLesson } from '../content/curriculum.js';
import { simulator } from '../simulator.js';
import { SONG_PARTS } from '../content/song-parts.js';
import { TRACKS } from '../tracks.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SYNTH1 = 7; // 假真机里的轨道号
const SYNTH2 = 8;
const DX = 9;

// ───────────── 几段会重复用到的动作 ─────────────

/** 模拟机：把一串键挨个点一遍 */
async function taps(w, ids, gap = 0) {
  for (const id of ids) {
    await w.tap(id);
    if (gap) await sleep(gap);
  }
}

/** 模拟机：先长按 a（出现黑圈），再点 b */
async function combo(w, a, b) {
  await w.hold(a);
  await w.tap(b);
}

/** 假真机：一项一项做。函数 = 让假真机做这一下（再等镜像读到）；'manual' = 这一项认不出，替你点“做好了” */
async function fakeTasks(w, acts) {
  for (const act of acts) {
    if (act === 'manual') await w.manual();
    else {
      act();
      await sleep(1300);
    }
  }
}

/** 模拟机：短按 [PLAY] 听一下再停 */
async function playStop(w) {
  await w.tap('PLAY');
  await sleep(700);
  await w.tap('PLAY');
  await sleep(500);
}

/** 假真机：按 [PLAY] 再停 */
async function fakePlayStop(f) {
  f.play();
  await sleep(600);
  f.stop();
  await sleep(600);
}

/** 假真机认不出的任务：替学生点 n 次“做好了” */
async function manuals(w, n) {
  for (let i = 0; i < n; i++) await w.manual();
}

/** 模拟机：贝斯 1 1 6 6（SYNTH 1 的第 1、5、9、13 步） */
async function simBass(w) {
  await w.tap('SYNTH1');
  await sleep(300);
  if (simulator.stepMode !== 'SYNTH1') await combo(w, 'PAGE', 'SYNTH1');
  await sleep(600);
  await taps(w, ['SK1', 'DK1', 'DK5']);
  await sleep(600);
  await taps(w, ['SK6', 'DK9', 'DK13']);
  await sleep(600);
}

/** 模拟机：SYNTH 2 切到 CHORD，第 1 步放键 1、第 9 步放键 6 */
async function simChords(w) {
  await w.tap('SYNTH2');
  await sleep(700);
  if (simulator.polyOf('SYNTH2') !== 2) await w.turn('SD2', 1, 2 - simulator.polyOf('SYNTH2'));
  await sleep(700);
  if (simulator.stepMode !== 'SYNTH2') await combo(w, 'PAGE', 'SYNTH2');
  await sleep(600);
  await taps(w, ['SK1', 'DK1']);
  await sleep(600);
  await taps(w, ['SK6', 'DK9']);
  await sleep(600);
}

// ───────────── 每节课的“动手”步骤怎么做：下标 = 第几步（从 0 数）。讲解、小测、音游、自由创作是通用的，不用写 ─────────────

const PLANS = {
  // 曲目的课《Faded》（content/song-lessons.js）：没有音游，无界面的浏览器里也能整节走完（tools/mac-check.sh 走模拟机和假真机两遍）。
  // 假真机认不出合成器轨的格子：那几项替你点“做好了”（manual），认得出的（选轨、长度、弹法、八度、播放、独奏、静音）真的去做
  'song-faded': {
    1: {
      async sim(w) {
        for (let i = 0; i < 30; i++) await w.tap('BPM-');
        await sleep(600);
        await combo(w, 'DELETE', 'SWING');
        await sleep(600);
        await taps(w, ['KEY', 'KEY', 'KEY']);
        await sleep(900);
      },
      async fake(w, f) {
        f.setProject(4);
        await sleep(1200);
        f.setTempo(90);
        await sleep(1200);
        f.swing(0);
        await sleep(1000);
        f.scaleKey(0, 3);
        await sleep(1200);
      },
    },
    2: {
      async sim(w) {
        await taps(w, ['KICK', 'DK9', 'SNARE', 'DK5', 'DK13', 'HAT1', 'DK3', 'DK7', 'DK11', 'DK15']);
        await sleep(900);
      },
      async fake(w, f) {
        for (const [t, steps] of [[0, [0, 8]], [1, [4, 12]], [3, [2, 6, 10, 14]]]) {
          f.clearPattern(t);
          for (const st of steps) f.toggleStep(t, st);
        }
        // 镜像是一条一条轨道轮着读格子的，三条都读回来要几秒
        for (let i = 0; i < 20 && !document.querySelector('.step-actions .btn.primary.lg:not([disabled])'); i++) await sleep(500);
      },
    },
    3: {
      async sim(w) {
        await combo(w, 'PAGE', 'SYNTH1');
        await taps(w, ['SK1', 'DK1', 'DK9', 'BARLENGTH', 'BARLENGTH']);
        for (const k of [6, 3, 7]) await taps(w, ['PAGE', 'DK1', 'DK9', `SK${k}`, 'DK1', 'DK9']);
        await sleep(600);
        await taps(w, ['PAGE', 'PLAY']);
        await sleep(800);
        await w.tap('PLAY');
        await sleep(600);
      },
      async fake(w, f) {
        await fakeTasks(w, [() => f.selectTrack(SYNTH1), 'manual', () => f.barLength(SYNTH1, 4), 'manual', 'manual', 'manual', () => f.play(), () => f.stop()]);
      },
    },
    4: {
      async sim(w) {
        await w.tap('SYNTH2');
        await w.turn('SD2', 1, 1);
        await combo(w, 'PAGE', 'SYNTH2');
        await taps(w, ['SK1', 'DK1']);
        await w.hold('DK1');
        await w.turn('ALL', 1, 16);
        await w.tap('DK1');
        await taps(w, ['BARLENGTH', 'BARLENGTH']);
        for (const k of [6, 3, 7]) {
          await w.tap('PAGE');
          await combo(w, 'DK1', `SK${k}`);
        }
        await sleep(600);
        await taps(w, ['PAGE', 'PLAY']);
        await sleep(800);
        await w.tap('PLAY');
        await sleep(600);
      },
      async fake(w, f) {
        await fakeTasks(w, [() => f.selectTrack(SYNTH2), () => f.polyMode(SYNTH2, 2), 'manual', 'manual', 'manual', () => f.barLength(SYNTH2, 4), 'manual', 'manual', 'manual', () => f.play(), () => f.stop()]);
      },
    },
    5: {
      async sim(w) {
        await combo(w, 'PAGE', 'DX');
        await taps(w, ['BARLENGTH', 'BARLENGTH', 'SK3', 'DK1', 'DK5', 'DK9', 'SK5', 'DK13', 'PAGE']);
        await w.hold('OCTAVE');
        await w.turn('ALL', 1, 1);
        await taps(w, ['SK1', 'DK1', 'DK5', 'DK9']);
        await w.hold('OCTAVE');
        await w.turn('ALL', -1, 1);
        await taps(w, ['SK7', 'DK13', 'PAGE', 'SK5', 'DK1', 'DK5', 'DK9', 'DK13', 'PAGE', 'SK2', 'DK1', 'DK5', 'DK9', 'SK1', 'DK13']);
        await sleep(600);
        await taps(w, ['PAGE', 'PLAY']);
        await sleep(800);
        await w.tap('PLAY');
        await sleep(600);
      },
      async fake(w, f) {
        await fakeTasks(w, [() => f.selectTrack(DX), () => f.barLength(DX, 4), 'manual', 'manual', () => f.octave(DX, 1), 'manual', 'manual', 'manual', 'manual', () => f.play(), () => f.stop()]);
      },
    },
    6: {
      async sim(w) {
        for (let i = 0; i < 5; i++) await w.manual();
      },
      async fake(w, f) {
        await fakeTasks(w, ['manual', 'manual', 'manual', () => f.play(), 'manual']);
        f.stop();
        await sleep(600);
      },
    },
    7: {
      async sim(w) {
        await w.tap('PLAY');
        await sleep(400);
        for (const [a, b] of [['SOLO', 'DX'], ['SOLO', 'DX'], ['MUTE', 'SYNTH1'], ['MUTE', 'SYNTH1']]) {
          await combo(w, a, b);
          await sleep(400);
        }
        await w.tap('PLAY');
      },
      async fake(w, f) {
        await fakeTasks(w, [() => f.play(), () => f.solo(DX), () => f.solo(DX), () => f.mute(SYNTH1), () => f.mute(SYNTH1)]);
        f.stop();
        await sleep(600);
      },
    },
  },
  '3-1': {
    2: {
      async sim(w) {
        await w.tap('SYNTH2');
        await sleep(300);
        await taps(w, ['SK1', 'SK3', 'SK5'], 1100); // 一个一个听：隔一秒以上，才不会被当成“一起按”
        await sleep(300);
        await taps(w, ['SK1', 'SK3', 'SK5']); // 一秒之内连点 = 叠在一起
        await sleep(1500);
        await taps(w, ['SK3', 'SK5', 'SK7']);
        await sleep(400);
      },
      async fake(w, f) {
        f.selectTrack(SYNTH2);
        await sleep(700);
        for (const k of [1, 3, 5]) {
          f.synthKey(k, 9);
          await sleep(350);
        }
        f.pressKeys([1, 3, 5], 9, 15);
        await sleep(700);
        f.pressKeys([3, 5, 7], 9, 15);
        await sleep(700);
      },
    },
  },
  '3-2': {
    1: {
      async sim(w) {
        await w.tap('SYNTH2');
        await sleep(250);
        await combo(w, 'SD1', 'DK3');
        await sleep(250);
        await w.turn('SD2', 1, 2 - simulator.polyOf('SYNTH2'));
        await sleep(600);
        await taps(w, [1, 2, 3, 4, 5, 6, 7].map((k) => `SK${k}`), 120);
        await sleep(300);
      },
      async fake(w, f) {
        f.selectTrack(SYNTH2);
        await sleep(700);
        f.changeSound(9, { name: 'CP80 Layer', poly: 1 });
        await sleep(1500);
        f.polyMode(SYNTH2, 2);
        await sleep(800);
        for (let k = 1; k <= 7; k++) {
          f.synthKey(k, 9);
          await sleep(260);
        }
        await sleep(300);
      },
    },
    5: {
      async sim(w) {
        await w.tap('DX');
        await sleep(250);
        await combo(w, 'SD1', 'DK4');
        await sleep(250);
        await w.turn('SD2', 1, 2 - simulator.polyOf('DX'));
        await sleep(600);
        await taps(w, ['SK1', 'SK4', 'SK6'], 150);
        await sleep(300);
      },
      async fake(w, f) {
        f.selectTrack(DX);
        await sleep(700);
        f.changeSound(10, { name: 'FM Legend EP', poly: 1 });
        await sleep(1500);
        f.polyMode(DX, 2);
        await sleep(800);
        for (const k of [1, 4, 6]) {
          f.synthKey(k, 10);
          await sleep(300);
        }
        await sleep(300);
      },
    },
  },
  '3-3': {
    1: {
      async sim(w) {
        await simBass(w);
        await playStop(w);
      },
      async fake(w, f) {
        f.selectTrack(SYNTH1);
        await sleep(700);
        await manuals(w, 3); // 进步进输入、键 1、键 6：真机上读不出来
        await fakePlayStop(f);
      },
    },
    2: {
      async sim(w) {
        await simChords(w);
        await playStop(w);
      },
      async fake(w, f) {
        f.selectTrack(SYNTH2);
        f.polyMode(SYNTH2, 2);
        await sleep(1100);
        await manuals(w, 3);
        await fakePlayStop(f);
      },
    },
    3: {
      async sim(w) {
        for (const key of ['DK1', 'DK9']) {
          await w.hold(key); // 按住亮着的那一步
          await w.turn('ALL', 1, 7); // 拉长到 8 步
          await w.tap(key); // 再点一下松开
          await sleep(600);
        }
        await playStop(w);
      },
      async fake(w, f) {
        await manuals(w, 2);
        await fakePlayStop(f);
      },
    },
    4: {
      // 编程挑战。模拟机上格子对了会自己过；假真机上要“播一遍”才核对得了
      async sim() {
        await sleep(900);
      },
      async fake(w) {
        await w.fakePlay({ 0: [1, 9], 8: [6, 9] }, 2.1);
      },
    },
    5: {
      async sim(w) {
        await w.tap('PLAY');
        await sleep(500);
        for (const [a, b] of [['SOLO', 'SYNTH2'], ['SOLO', 'SYNTH2'], ['MUTE', 'SYNTH1'], ['MUTE', 'SYNTH1']]) {
          await combo(w, a, b);
          await sleep(500);
        }
        await w.tap('PLAY');
        await sleep(300);
      },
      async fake(w, f) {
        f.play();
        await sleep(700);
        for (const act of [() => f.solo(SYNTH2), () => f.solo(SYNTH2), () => f.mute(SYNTH1), () => f.mute(SYNTH1)]) {
          act();
          await sleep(1100);
        }
        f.stop();
        await sleep(400);
      },
    },
  },
  '3-4': {
    2: {
      async sim(w) {
        // 这一步接着 3.3 留下的内容做；模拟机是空的话（单独跑这一节课）先铺上
        if (simulator.keysOf('SYNTH1')[0] !== 1) await simBass(w);
        if (simulator.keysOf('SYNTH2')[0] !== 1) await simChords(w);
        await w.tap('SYNTH2');
        await sleep(300);
        if (simulator.stepMode !== 'SYNTH2') await combo(w, 'PAGE', 'SYNTH2');
        await sleep(700);
        await w.tap('BARLENGTH');
        await sleep(700);
        await w.tap('PAGE'); // 短按 = 翻到第 2 页
        await sleep(700);
        await combo(w, 'DK1', 'SK3'); // 按住那一步，再按新的键 = 整个换成那个和弦
        await sleep(700);
        await combo(w, 'DK9', 'SK7');
        await sleep(700);
        await w.tap('PAGE');
        await sleep(700);
      },
      async fake(w, f) {
        f.selectTrack(SYNTH2);
        await sleep(800);
        f.barLength(SYNTH2, 2);
        await sleep(1300);
        await manuals(w, 4); // 翻页、换两个和弦、翻回来
      },
    },
    3: {
      async sim(w) {
        await combo(w, 'PAGE', 'SYNTH1');
        await sleep(700);
        await w.tap('BARLENGTH');
        await sleep(700);
        await w.tap('PAGE');
        await sleep(700);
        await taps(w, ['DK1', 'DK5', 'SK3', 'DK1', 'DK5']); // 按灭 → 按新的键 → 再按亮
        await sleep(700);
        await taps(w, ['DK9', 'DK13', 'SK7', 'DK9', 'DK13']);
        await sleep(700);
        await w.tap('PAGE');
        await playStop(w);
      },
      async fake(w, f) {
        f.selectTrack(SYNTH1);
        await sleep(800);
        f.barLength(SYNTH1, 2);
        await sleep(1300);
        await manuals(w, 3);
        await fakePlayStop(f);
      },
    },
  },
};

// ───────────── 通用的几种步骤 ─────────────

const canContinue = () => [...document.querySelectorAll('.game-card .btn.primary')].some((b) => b.textContent.trim() === '继续');

/** 音游：跳过“看示范”，把“跟打”和“独奏”各打过。两段都过了，课程会自己进下一步。返回每一局的成绩。 */
async function game(w, chartId, hit) {
  const scores = [];
  const play = async (opts) => scores.push((await w.playStage(chartId, hit, opts)).accuracy);
  await w.pill(1);
  await play();
  for (let i = 0; i < 2 && !canContinue(); i++) await play(); // 没过就再来（见 walkthrough.js 里关于头一局的说明）
  await play({ via: /^继续$/ }); // 点“继续”进独奏，接着打
  for (let i = 0; i < 2 && !canContinue(); i++) await play();
  await w.cont();
  await sleep(500);
  return scores;
}

function quiz(step) {
  [...document.querySelectorAll('.quiz-item')].forEach((item, i) => item.querySelectorAll('.quiz-opt')[step.questions[i].answer].click());
}


// ───────────── 从分轨生成的曲目课（content/song-lesson-gen.js）：照着分轨数据走 ─────────────
// 模拟机：真的去按（速度、摇摆、音阶和调、鼓的格子、每页的音、八度、和弦的长度、独奏和静音）。
// 假真机：认得出的那几项（选轨、弹法、八度、长度、播放、独奏、静音……）让假真机去做，认不出的替你点“做好了”。

const trackIndex = (id) => TRACKS.findIndex((t) => t.id === id);
const SIM_OCT = { SYNTH1: -2, SYNTH2: 0, DX: 0 };

async function simPrep(w, spec) {
  const d = spec.bpm - simulator.proj.tempo;
  for (let i = 0; i < Math.abs(d); i++) await w.tap(d > 0 ? 'BPM+' : 'BPM-');
  await sleep(600);
  if (spec.swing > 0) for (let i = 0; i < Math.ceil(spec.swing / 10); i++) await w.tap('SWING');
  else await combo(w, 'DELETE', 'SWING');
  await sleep(600);
  for (let i = 0; i < spec.scale; i++) await w.tap('SCALE');
  for (let i = 0; i < spec.key; i++) await w.tap('KEY');
  await sleep(900);
}

async function simDrums(w, step) {
  for (const [track, pattern] of Object.entries(step.target)) {
    await w.tap(track);
    const want = [...pattern].map((c, i) => (c === 'x' || c === 'X' ? i : -1)).filter((i) => i >= 0);
    const now = simulator.stepsOf(track);
    for (const st of [...want.filter((x) => !now.includes(x)), ...now.filter((x) => !want.includes(x))]) await w.tap(`DK${st + 1}`);
  }
  await sleep(900);
}

async function simOctave(w, by) {
  if (!by) return;
  if (simulator.held !== 'OCTAVE') await w.hold('OCTAVE'); // 还按着（刚转过、没到自动松开）就直接转
  await w.turn('ALL', Math.sign(by), Math.abs(by));
}

async function simSynth(w, spec, part) {
  const tr = part.track;
  const bars = part.bars || spec.bars;
  if (part.mode === 'chord') {
    await w.tap(tr);
    await w.turn('SD2', 1, 2 - simulator.polyOf(tr));
  }
  await combo(w, 'PAGE', tr);
  await sleep(300);
  await simOctave(w, (part.octave || 0) - (SIM_OCT[tr] ?? 0));
  for (let b = simulator.barsOf(tr) || 1; b < bars; b *= 2) await w.tap('BARLENGTH');
  await sleep(400);
  let page = 0;
  for (let p = 0; p < bars; p++) {
    const notes = part.notes.filter(([st]) => st >= p * 16 && st < p * 16 + 16);
    if (!notes.length) continue;
    while (page !== p) {
      await w.tap('PAGE');
      page = (page + 1) % bars;
    }
    const groups = new Map();
    for (const [st, k, , shift = 0] of notes) {
      const g = `${shift}|${k}`;
      if (!groups.has(g)) groups.set(g, { k, shift, steps: [] });
      groups.get(g).steps.push(st);
    }
    for (const g of groups.values()) {
      await simOctave(w, g.shift);
      await w.tap(`SK${g.k}`);
      for (const st of g.steps) await w.tap(`DK${(st % 16) + 1}`);
      await simOctave(w, -g.shift);
    }
    if (part.mode === 'chord') {
      for (const [st, , len = 1] of notes) {
        if (len <= 1) continue;
        await w.hold(`DK${(st % 16) + 1}`);
        await w.turn('ALL', 1, len - 1);
        await w.tap(`DK${(st % 16) + 1}`);
      }
    }
    await sleep(500);
  }
  while (page !== 0) {
    await w.tap('PAGE');
    page = (page + 1) % bars;
  }
  await w.tap('PLAY');
  await sleep(800);
  await w.tap('PLAY');
  await sleep(600);
}

async function simLayers(w, step) {
  await w.tap('PLAY');
  await sleep(400);
  for (const t of step.tasks.slice(1)) {
    await combo(w, t.panel[0], t.panel[1]);
    await sleep(400);
  }
  await w.tap('PLAY');
}

/** 假真机：照着这一步每一项的条件去做；认不出的点“做好了” */
async function fakeStep(w, f, step, spec) {
  if (step.type === 'program') {
    for (const [track, pattern] of Object.entries(step.target)) {
      const i = trackIndex(track);
      f.clearPattern(i);
      [...pattern].forEach((c, st) => (c === 'x' || c === 'X') && f.toggleStep(i, st));
    }
    for (let i = 0; i < 20 && !document.querySelector('.step-actions .btn.primary.lg:not([disabled])'); i++) await sleep(500);
    return;
  }
  let soloOn = null;
  const acts = step.tasks.map((t) => {
    const d = t.detect || {};
    const sim = t.sim || {};
    const part = spec.parts.find((p) => p.track === (d.track || sim.track));
    switch (d.kind || sim.kind) {
      case 'project': return () => f.setProject(4);
      case 'tempo': return () => f.setTempo(d.value);
      case 'swing': return () => f.swing(d.zero ? 0 : d.min + 6);
      case 'scale': return () => f.scaleKey(d.scale, d.key);
      case 'track': return () => f.selectTrack(trackIndex(d.track));
      case 'polymode': return () => f.polyMode(trackIndex(d.track), d.mode);
      case 'octave': return () => f.octave(trackIndex(d.track), part?.octave || 0);
      case 'length': return () => f.barLength(trackIndex(d.track), d.bars);
      case 'start': return () => f.play();
      case 'stop': return () => f.stop();
      case 'solo': return () => {
        const i = sim.track ? trackIndex(sim.track) : soloOn;
        soloOn = sim.track ? i : null;
        f.solo(i);
      };
      case 'mute': return () => f.mute(trackIndex(sim.track));
      default: return 'manual';
    }
  });
  await fakeTasks(w, acts);
  f.stop();
  await sleep(400);
}

function songPlan(lesson) {
  const spec = SONG_PARTS[lesson.song];
  const plan = {};
  lesson.steps.forEach((step, i) => {
    const sim = {
      prep: (w) => simPrep(w, spec),
      drums: (w) => simDrums(w, step),
      synth: (w) => simSynth(w, spec, spec.parts.find((p) => p.track === step.part)),
      space: async (w) => { for (const _ of step.tasks) await w.manual(); },
      layers: (w) => simLayers(w, step),
    }[step.role];
    if (sim) plan[i] = { sim, fake: (w, f) => fakeStep(w, f, step, spec) };
  });
  return plan;
}

/**
 * 走一节课。from / to = 只走第几步到第几步（从 0 数，两头都算）；from 不是 0 时，页面要已经停在那一步上。
 * 走到哪一步没能完成就停下，那一步的 note 里是当时任务旁边那行提示。
 */
export async function run(id, from = 0, to = Infinity, { force = false } = {}) {
  // 走查会把这节课标记成“完成”，还会往成绩里写假的音游记录：只能在测试数据上跑
  // （虚拟机里的预览用 data-dev/，mac-check.sh 起的临时服务用临时目录）。Mac 上的正式服务在 4747，存的是真实进度，默认不让跑。
  if (location.port === '4747' && !force) return { lesson: id, refused: '这里是 4747（正式服务，存着真实的学习进度）：走查会改进度和成绩，换到测试用的服务上跑。' };
  const found = findLesson(id);
  if (!found) return { lesson: id, refused: '没有这节课' };
  const { lesson } = found;
  const w = install();
  const fake = window.__app.fake || null;
  const plan = PLANS[id] || (lesson.generated ? songPlan(lesson) : {});
  if (from === 0) {
    if (!fake) simulator.reset();
    await w.go('#/');
    await w.go(`#/lesson/${id}`);
    document.querySelector('.step-dots i')?.click(); // 上次停在半路的话，回到第 1 步
    await sleep(400);
    if (fake) {
      fake.setProject(3);
      await sleep(500);
    }
  }
  const steps = [];
  const says = []; // 模拟机每一下说了什么（卡住时带上最后几句，好查是哪一下没按对）
  const offSay = fake ? () => {} : simulator.on('say', (t) => says.push(String(t).slice(0, 70)));
  for (let i = from; i <= Math.min(to, lesson.steps.length - 1); i++) {
    const step = lesson.steps[i];
    const title = w.step().title;
    if (title !== step.title) {
      steps.push({ i, title: step.title, ok: false, note: `页面现在停在「${title}」上` });
      break;
    }
    if (step.type === 'game') {
      // 假真机：先摆成能打的样子（选中 SYNTH 2、在 CHORD 上），再让它来“按键”
      if (fake) {
        fake.selectTrack(SYNTH2);
        fake.polyMode(SYNTH2, 2);
        await sleep(1200);
      }
      const check = fake ? w.check().head : undefined;
      const scores = await game(w, step.chart, fake ? (lane) => fake.chordKey(lane.degree, 9) : undefined);
      const ok = w.step().title !== step.title;
      steps.push({ i, title: step.title, ok, scores, check });
      if (!ok) break;
      continue;
    }
    if (step.type === 'quiz') quiz(step);
    else if (step.type === 'free') [...document.querySelectorAll('.step-body .btn')].find((b) => b.textContent.trim() === '先跳过')?.click();
    else if (plan[i]) await (fake ? plan[i].fake(w, fake) : plan[i].sim(w));
    await sleep(400);
    const now = w.step();
    // 卡住了：把模拟机当时的样子也带上（选中哪条、在不在步进输入、第几页、这条轨道每一步的音、八度），好查是哪一下没按对
    const simState = !now.ready && !fake && step.part ? { sel: simulator.sel, stepMode: simulator.stepMode, page: simulator.page, held: simulator.held, octave: simulator.proj.octave[step.part], bars: simulator.barsOf(step.part), notes: simulator.notesOf(step.part) } : null;
    steps.push({ i, title: step.title, ok: now.ready, ...(now.tasks ? { tasks: now.tasks } : {}), ...(now.ready ? {} : { note: now.status || w.result() }), ...(simState ? { sim: simState, says: says.slice(-25) } : {}) });
    if (!now.ready) break;
    await w.next();
  }
  offSay();
  return { lesson: id, mode: fake ? '假真机' : '模拟机', steps, done: document.querySelector('.step-kind')?.textContent === '完成', errors: [...w.errors] };
}
