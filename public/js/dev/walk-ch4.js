// 开发测试用：把第 4 章（合成与音色设计）的一节课从头到尾走一遍，确认每一步都能完成、没有报错。平时应用不会加载它。
// 用法和 walk-ch3.js 一样：
//   const ch4 = await import('/js/dev/walk-ch4.js');
//   await ch4.run('4-1');          // 没接真机时：在模拟机上走
//   await ch4.run('4-3');          // 地址里带 ?fake 时：接着假真机走（认不出的任务替你点“做好了”）
//   地址里写 ?walk=4-2（加 ?fake 就是假真机）也行：页面加载完自动走，结果写进页面里 id 为 walk-result 的元素。
// 第 4 章没有音游，四节课在无界面的浏览器里都能整节走完：tools/mac-check.sh 每次在模拟机、假真机上各走一遍。
// 返回 { lesson, mode, steps: [{ i, title, ok, tasks, note }], done, errors }。
// 注意：走查会把课标记成“完成”，只在测试数据上跑；在正式服务的端口（4747）上它会拒绝。
import { install } from './walkthrough.js';
import { findLesson } from '../content/curriculum.js';
import { simulator } from '../simulator.js';
import { midi } from '../midi.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SYNTH1 = 7; // 假真机里的轨道号
const SYNTH2 = 8;
const DX = 9;

// ───────────── 几段会重复用到的动作 ─────────────

async function taps(w, ids, gap = 60) {
  for (const id of ids) {
    await w.tap(id);
    if (gap) await sleep(gap);
  }
}

/** 模拟机：先长按 a（出现黑圈），再点 b */
async function combo(w, a, b) {
  await w.hold(a);
  await w.tap(b);
  await sleep(150);
}

/** 模拟机：转旋钮。n 格（每格是参数上的 4） */
const turn = (w, id, dir, n) => w.turn(id, dir, n);

/** 模拟机：翻到第 page 页（单按翻页键，一页一页翻） */
async function toPage(w, page) {
  for (let i = 0; i < 6 && simulator.sdPage !== page; i++) {
    await w.tap('SDPAGE');
    await sleep(120);
  }
}

/** 模拟机：长按翻页键 2 秒（进 / 出进阶设置） */
async function longPage(w) {
  await w.tap('SDPAGE', 2150);
  await sleep(200);
}

/** 模拟机：在触摸条上从下往上推到 frac（0–1） */
async function slide(id, frac) {
  const node = document.querySelector(`.sim [data-id="${id}"]`);
  if (!node) throw new Error(`屏幕上没有控件 ${id}`);
  const r = (node.querySelector('rect') || node).getBoundingClientRect();
  const at = (f) => ({ bubbles: true, pointerId: 1, clientX: r.left + r.width / 2, clientY: r.top + r.height * (1 - f) });
  node.dispatchEvent(new PointerEvent('pointerdown', at(0.1)));
  for (const f of [0.3, 0.5, frac]) {
    await sleep(40);
    node.dispatchEvent(new PointerEvent('pointermove', at(f)));
  }
  await sleep(40);
  node.dispatchEvent(new PointerEvent('pointerup', at(frac)));
  await sleep(200);
}

async function playStop(w, ms = 900) {
  await w.tap('PLAY');
  await sleep(ms);
  await w.tap('PLAY');
  await sleep(400);
}

/** 假真机：一项一项做。函数 = 让假真机做这一下（再等镜像读到）；'manual' = 这一项认不出，替你点“做好了” */
async function fakeTasks(w, acts, wait = 1300) {
  for (const act of acts) {
    if (act === 'manual') await w.manual();
    else {
      await act();
      await sleep(wait);
    }
  }
}

// ───────────── 每节课的“动手”步骤怎么做：下标 = 第几步（从 0 数）。讲解、小测是通用的，不用写 ─────────────

const PLANS = {
  '4-1': {
    2: {
      async sim(w) {
        await w.tap('SYNTH2');
        await sleep(300);
        await combo(w, 'SD1', 'DK6');
        await sleep(300);
        await taps(w, ['SK1', 'SK3', 'SK5'], 1100); // 一个一个听：隔一秒以上，不算“一起按”
        await turn(w, 'SD1', 1, 1);
        await sleep(400);
        await turn(w, 'SD2', 1, 2 - simulator.polyOf('SYNTH2'));
        await sleep(600);
        await playStop(w);
      },
      async fake(w, f) {
        await fakeTasks(w, [
          () => f.selectTrack(SYNTH2),
          () => f.changeSound(9, { name: 'Fake Pad 1', poly: 1 }),
          async () => {
            for (const k of [1, 3, 5]) {
              f.synthKey(k, 9);
              await sleep(300);
            }
          },
          () => f.changeSound(9, { name: 'Fake Pad 2', poly: 1 }),
          () => f.polyMode(SYNTH2, 2),
          async () => {
            f.play();
            await sleep(600);
            f.stop();
          },
        ]);
      },
    },
    4: {
      async sim(w) {
        await toPage(w, 1);
        await sleep(300);
        await turn(w, 'SD1', 1, 3);
        await sleep(400);
        await turn(w, 'SD3', -1, 3);
        await sleep(400);
        await toPage(w, 0);
        await sleep(500);
      },
      async fake(w, f) {
        await fakeTasks(w, [
          () => f.sdPage(1),
          () => f.turnSD(SYNTH2, 'attack', 12),
          () => f.turnSD(SYNTH2, 'cutoff', -14, { cc: true }),
          () => f.sdPage(0),
        ]);
      },
    },
  },
  '4-2': {
    1: {
      async sim(w) {
        await w.tap('SYNTH1');
        await sleep(300);
        await toPage(w, 1);
        await sleep(300);
        await w.tap('PLAY');
        await sleep(500);
        const now = simulator.paramOf('SYNTH1', 'cutoff');
        await turn(w, 'SD3', -1, Math.ceil((now + 24) / 4)); // 拧到 −24 左右
        await sleep(500);
        await turn(w, 'SD3', 1, 12); // 再往上拧过正中间到 +24
        await sleep(500);
        await turn(w, 'SD3', -1, simulator.paramOf('SYNTH1', 'cutoff') / 4); // 回到 0
        await sleep(500);
        await w.tap('PLAY');
        await sleep(400);
      },
      async fake(w, f) {
        await fakeTasks(w, [
          () => f.selectTrack(SYNTH1),
          () => f.sdPage(1),
          () => f.play(),
          () => f.turnSD(SYNTH1, 'cutoff', -24, { cc: true }),
          () => f.turnSD(SYNTH1, 'cutoff', 24, { cc: true }),
          () => f.turnSD(SYNTH1, 'cutoff', 0, { cc: true }),
          () => f.stop(),
        ]);
      },
    },
    4: {
      async sim(w) {
        await w.tap('SYNTH1');
        await sleep(300);
        await toPage(w, 1);
        await sleep(300);
        await w.tap('PLAY');
        await sleep(500);
        await turn(w, 'SD4', 1, 7);
        await sleep(500);
        await turn(w, 'SD3', -1, 7);
        await sleep(500);
        await w.tap('PLAY');
        await sleep(400);
      },
      async fake(w, f) {
        await fakeTasks(w, [
          () => f.selectTrack(SYNTH1),
          () => f.sdPage(1),
          () => f.play(),
          () => f.turnSD(SYNTH1, 'reso', 24, { cc: true }),
          () => f.turnSD(SYNTH1, 'cutoff', -28, { cc: true }),
          () => f.stop(),
        ]);
      },
    },
  },
  '4-3': {
    1: {
      async sim(w) {
        await w.tap('SYNTH2');
        await sleep(300);
        await toPage(w, 1);
        await sleep(300);
        await w.tap('PLAY');
        await sleep(500);
        await turn(w, 'SD1', -1, 5);
        await sleep(500);
        await turn(w, 'SD2', -1, 5);
        await sleep(500);
        await w.tap('PLAY');
        await sleep(400);
      },
      async fake(w, f) {
        await fakeTasks(w, [
          () => f.selectTrack(SYNTH2),
          () => f.sdPage(1),
          () => f.play(),
          () => f.turnSD(SYNTH2, 'attack', -20),
          () => f.turnSD(SYNTH2, 'decay', -20),
          () => f.stop(),
        ]);
      },
    },
    2: {
      async sim(w) {
        await w.tap('PLAY');
        await sleep(500);
        await turn(w, 'SD1', 1, 9);
        await sleep(500);
        await turn(w, 'SD2', 1, 7);
        await sleep(500);
        await w.tap('PLAY');
        await sleep(400);
      },
      async fake(w, f) {
        await fakeTasks(w, [
          () => f.play(),
          () => f.turnSD(SYNTH2, 'attack', 16),
          () => f.turnSD(SYNTH2, 'decay', 10),
          () => f.stop(),
        ]);
      },
    },
    4: {
      async sim(w) {
        await w.tap('SYNTH2');
        await sleep(300);
        await w.tap('MASTERSINGLE');
        await sleep(400);
        const fx = simulator.fxOf('SYNTH2');
        await turn(w, 'FX', 1, 45 - (fx ? fx.preset + ['FILTER', 'REVERB', 'DELAY', 'COMP', 'DISTORTION', 'MODULATION', 'DUCKER', 'OTHER'].indexOf(fx.cat) * 8 : -1));
        await sleep(600);
        await w.tap('PLAY');
        await sleep(500);
        await slide('FXLEVEL', 0.75);
        await sleep(600);
        await w.tap('PLAY');
        await sleep(400);
        await w.tap('MASTERSINGLE');
        await sleep(500);
      },
      async fake(w, f) {
        await fakeTasks(w, [
          () => f.selectTrack(SYNTH2),
          'manual', // [MASTER/SINGLE] 拨在哪，机器不上报
          'manual', // [FX] 转到了哪一类，机器不上报
          () => f.play(),
          () => midi.simulate([0xb0 | SYNTH2, 107, 90]), // [FX LEVEL] 在 SINGLE 上：官方 CC 表是 CC 107（真机发不发没人试过）
          () => f.stop(),
          'manual',
        ]);
      },
    },
  },
  '4-4': {
    1: {
      async sim(w) {
        await w.tap('DX');
        await sleep(300);
        await taps(w, ['SK1', 'SK2'], 300);
        await sleep(300);
        if (!simulator.sdAdvanced) await longPage(w);
        await sleep(300);
        await toPage(w, 4);
        await sleep(500);
      },
      async fake(w, f) {
        await fakeTasks(w, [
          () => f.selectTrack(DX),
          async () => {
            f.synthKey(1, 10);
            await sleep(300);
            f.synthKey(2, 10);
          },
          () => f.sdMode(true),
          () => f.sdPage(4),
        ]);
      },
    },
    2: {
      async sim(w) {
        await turn(w, 'SD2', 1, 6);
        await sleep(400);
        await turn(w, 'SD3', 1, 3);
        await sleep(400);
        await turn(w, 'SD4', 1, 4);
        await sleep(400);
        await longPage(w);
        await sleep(300);
        await toPage(w, 0);
        await sleep(500);
      },
      async fake(w, f) {
        await fakeTasks(w, [
          () => f.turnSD(DX, 'fmAmt', 24),
          () => f.turnSD(DX, 'fmFreq', 12),
          () => f.turnSD(DX, 'fmFb', 16),
          () => f.sdMode(false),
          () => f.sdPage(0),
        ]);
      },
    },
    4: {
      async sim(w) {
        await w.tap('SYNTH1');
        await sleep(300);
        await toPage(w, 0);
        await sleep(300);
        await combo(w, 'SD1', 'DK1');
        await sleep(400);
        await toPage(w, 1);
        await sleep(300);
        await turn(w, 'SD2', -1, 4);
        await sleep(400);
        await turn(w, 'SD3', -1, 4 + Math.max(0, simulator.paramOf('SYNTH1', 'cutoff') / 4));
        await sleep(400);
        await combo(w, 'ALL', 'SD1');
        await sleep(600);
      },
      async fake(w, f) {
        await fakeTasks(w, [
          () => f.selectTrack(SYNTH1),
          () => f.sdPage(0),
          () => f.changeSound(8, { name: 'Fake Bass', poly: 0 }),
          () => f.sdPage(1),
          () => f.turnSD(SYNTH1, 'decay', -16),
          () => f.turnSD(SYNTH1, 'cutoff', -16, { cc: true }),
          () => f.saveSound(SYNTH1),
        ], 1300);
        // 存完音色，镜像隔两秒才重读一次名字
        for (let i = 0; i < 12 && !document.querySelector('.step-actions .btn.primary.lg:not([disabled])'); i++) await sleep(500);
      },
    },
    5: {
      async sim(w) {
        await w.tap('SYNTH2');
        await sleep(300);
        await combo(w, 'ALL', 'SD1');
        await sleep(500);
        await w.tap('DX');
        await sleep(300);
        await toPage(w, 0);
        await sleep(300);
        await turn(w, 'SD2', -1, simulator.polyOf('DX'));
        await sleep(500);
        await taps(w, ['SK1', 'SK2', 'SK3', 'SK4'], 200);
        await sleep(400);
        await combo(w, 'ALL', 'SD1');
        await sleep(600);
      },
      async fake(w, f) {
        const waitTicked = async (n) => {
          for (let i = 0; i < 12 && document.querySelectorAll('.task ol li.done').length < n; i++) await sleep(500);
        };
        await fakeTasks(w, [() => f.selectTrack(SYNTH2), () => f.saveSound(SYNTH2)]);
        await waitTicked(2);
        await fakeTasks(w, [
          () => f.selectTrack(DX),
          () => f.sdPage(0),
          () => f.polyMode(DX, 0),
          async () => {
            for (const k of [1, 2, 3, 4]) {
              f.synthKey(k, 10);
              await sleep(250);
            }
          },
          () => f.saveSound(DX),
        ]);
        for (let i = 0; i < 12 && !document.querySelector('.step-actions .btn.primary.lg:not([disabled])'); i++) await sleep(500);
      },
    },
  },
};

function quiz(step) {
  [...document.querySelectorAll('.quiz-item')].forEach((item, i) => item.querySelectorAll('.quiz-opt')[step.questions[i].answer].click());
}

/**
 * 走一节课。from / to = 只走第几步到第几步（从 0 数，两头都算）；from 不是 0 时，页面要已经停在那一步上。
 * 走到哪一步没能完成就停下，那一步的 note 里是当时任务旁边那行提示。
 */
export const run = (id, from, to, opts) => runPlan(PLANS, id, from, to, opts);

/** 第 5–8 章的走查（walk-ch5.js）也用这一套：plans 的写法和上面的 PLANS 一样 */
export const helpers = { sleep, taps, combo, turn, toPage, longPage, slide, playStop, fakeTasks };

export async function runPlan(plans, id, from = 0, to = Infinity, { force = false } = {}) {
  if (location.port === '4747' && !force) return { lesson: id, refused: '这里是 4747（正式服务，存着真实的学习进度）：走查会改进度，换到测试用的服务上跑。' };
  const found = findLesson(id);
  if (!found) return { lesson: id, refused: '没有这节课' };
  const { lesson } = found;
  const w = install();
  const fake = window.__app.fake || null;
  const plan = plans[id] || {};
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
  const says = [];
  const offSay = fake ? () => {} : simulator.on('say', (t) => says.push(String(t).slice(0, 80)));
  for (let i = from; i <= Math.min(to, lesson.steps.length - 1); i++) {
    const step = lesson.steps[i];
    const title = w.step().title;
    if (title !== step.title) {
      steps.push({ i, title: step.title, ok: false, note: `页面现在停在「${title}」上` });
      break;
    }
    if (step.type === 'quiz') quiz(step);
    else if ((step.type === 'free' || step.type === 'reflect') && !plan[i]) [...document.querySelectorAll('.step-body .btn')].find((b) => b.textContent.trim() === '先跳过')?.click();
    else if (plan[i]) await (fake ? plan[i].fake(w, fake) : plan[i].sim(w));
    else if (step.type === 'do') steps.push({ i, title: step.title, note: '这一步走查里没写怎么做' });
    await sleep(500);
    const now = w.step();
    const sim = !now.ready && !fake ? { sel: simulator.sel, page: simulator.sdPage, adv: simulator.sdAdvanced, held: simulator.held, says: says.slice(-12), audio: { state: window.__app.audio?.ctx?.state, now: window.__app.audio?.now?.(), playing: simulator.playing, player: simulator.player?.playing, step: simulator.step } } : null;
    steps.push({ i, title: step.title, ok: now.ready, ...(now.tasks ? { tasks: now.tasks } : {}), ...(now.ready ? {} : { note: now.status || w.result() }), ...(sim ? { sim } : {}) });
    if (!now.ready) break;
    await w.next();
  }
  offSay();
  return { lesson: id, mode: fake ? '假真机' : '模拟机', steps, done: document.querySelector('.step-kind')?.textContent === '完成', errors: [...w.errors] };
}
