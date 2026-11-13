// 开发测试用：把第 5–8 章的一节课从头到尾走一遍，确认每一步都能完成、没有报错。平时应用不会加载它。
// 用法和 walk-ch4.js 一样（跑法、返回值都是同一套，见那个文件的开头）：
//   const late = await import('/js/dev/walk-ch5.js');
//   await late.run('5-2');          // 没接真机时：在模拟机上走
//   地址里写 ?walk=6-1（加 ?fake 就是假真机）也行。
// 这几章没有音游，每节课在无界面的浏览器里都能整节走完：tools/mac-check.sh 每次在模拟机、假真机上各走一遍。
// 注意：走查会把课标记成“完成”，只在测试数据上跑；在正式服务的端口（4747）上它会拒绝。
import { runPlan, helpers } from './walk-ch4.js';
import { simulator } from '../simulator.js';
import { midi } from '../midi.js';

const { sleep, taps, combo, turn, toPage, longPage, slide, playStop } = helpers;

/** 清单上已经打了几个勾（真机上不用做的那几项也算） */
const ticked = () => document.querySelectorAll('.task ol li.done, .task ol li.skip').length;

/**
 * 假真机：一项一项做。函数 = 让假真机做这一下；'manual' = 这一项认不出，替你点“做好了 / 我已经做了”。
 * 每做一下就等到清单上多出一个勾（最多 4 秒）：镜像是轮询读的，快慢看机器（和浏览器）
 */
async function fakeTasks(w, acts) {
  // 先等一会儿：一轮到就满足的那几项（已经在 4 号工程……）让镜像读到、自己打勾，别被下面第一下“做好了”顶掉
  await sleep(1500);
  for (const act of acts) {
    const before = ticked();
    if (act === 'manual') await w.manual();
    else await act();
    for (let i = 0; i < 40 && ticked() <= before; i++) await sleep(100);
    await sleep(200);
  }
}
const SAMPLER = 10; // 假真机里的轨道号

/** 模拟机：长按 [REC SAMPLE] 2 秒，再点第 n 个方键（换采样源） */
async function pickSource(w, n) {
  await w.tap('RECSAMPLE', 2150);
  await sleep(150);
  await w.tap(`DK${n}`);
  await sleep(200);
}

/** 模拟机：在 SAMPLER 的第 key 个位上录一段（[REC SAMPLE] 两下） */
async function record(w, key) {
  await w.tap(`SK${key}`);
  await sleep(200);
  await w.tap('RECSAMPLE');
  await sleep(500);
  await w.tap('RECSAMPLE');
  await sleep(400);
}

/** 假真机：按一下第 n 个 Synth key（选中采样器时 = 选采样位） */
const fakeSlot = (f, n) => f.synthKey(n, 11);

/** 假真机：机器发一个 CC（第三方资料说 [HIGH PASS] 105、[REPEATER] 106、[FX LEVEL] 102 / 107） */
const fakeCc = (cc, val = 100, ch = 0) => midi.simulate([0xb0 | ch, cc, val]);
const SYNTH2 = 8;

/** 第 8 章：这一步只看应用里的进度（曲目单、曲目课、录音）——走查里点“我已经做了 / 做好了” n 次 */
async function manuals(w, n) {
  for (let i = 0; i < n; i++) {
    await w.manual();
    await sleep(400);
  }
}

/** 第 8 章：在曲目单小部件里点前 n 首（已经在单子里的就不点） */
async function pickSongs(n) {
  for (let i = 0; i < 12 && document.querySelectorAll('.setl-item').length < n; i++) {
    const free = [...document.querySelectorAll('.setl-song:not(.on):not([disabled])')][0];
    if (!free) break;
    free.click();
    await sleep(200);
  }
  await sleep(1000); // 那一项隔 0.7 秒看一次曲目单
}

const PLANS = {
  // ───────────── 第 5 章 ─────────────
  '5-1': {
    2: {
      async sim(w) {
        await w.tap('SAMPLER');
        await sleep(300);
        await taps(w, ['SK1', 'SK2', 'SK3', 'SK4', 'SK5', 'SK6', 'SK7'], 150);
        await sleep(300);
        await w.tap('SK7');
        await sleep(300);
        await turn(w, 'SD1', 1, 1);
        await sleep(300);
        await turn(w, 'SD2', 1, 3);
        await sleep(400);
      },
      async fake(w, f) {
        await fakeTasks(w, [
          () => f.selectTrack(SAMPLER),
          async () => {
            for (const k of [1, 2, 3, 4, 5]) {
              fakeSlot(f, k);
              await sleep(200);
            }
          },
          () => fakeSlot(f, 7),
          () => f.changeSound(11, { name: 'Laser 2' }),
          'manual',
        ]);
      },
    },
  },
  '5-2': {
    1: {
      async sim(w) {
        await w.tap('SAMPLER');
        await sleep(300);
        await w.tap('SK5');
        await sleep(300);
        await w.tap('RECSAMPLE');
        await sleep(600);
        await w.tap('RECSAMPLE');
        await sleep(500);
        await w.tap('SK5');
        await sleep(400);
        await combo(w, 'ALL', 'SD1');
        await sleep(300);
      },
      async fake(w, f) {
        await fakeTasks(w, [
          () => f.selectTrack(SAMPLER),
          () => fakeSlot(f, 5),
          'manual',
          async () => {
            f.recordSample(5, 'Smp0517');
            await sleep(3500); // 镜像每 3 圈才读一次采样位的名字
          },
          () => fakeSlot(f, 5),
          'manual',
        ]);
      },
    },
    2: {
      async sim(w) {
        await w.tap('SK4');
        await sleep(300);
        await w.tap('RECSAMPLE');
        await sleep(500);
        await combo(w, 'DELETE', 'RECSAMPLE');
        await sleep(300);
        await w.tap('SK4');
        await sleep(400);
      },
      async fake(w, f) {
        await fakeTasks(w, [() => fakeSlot(f, 4), 'manual', 'manual', () => fakeSlot(f, 4)]);
      },
    },
  },
  '5-3': {
    1: {
      async sim(w) {
        await w.tap('SAMPLER');
        await sleep(300);
        // 模拟机每节课从头开始：第 5 个位上先录一段（真机上是上节课录的）
        await record(w, 5);
        await sleep(300);
        await w.tap('SK5');
        await sleep(300);
        await longPage(w);
        await toPage(w, 3);
        await sleep(300);
        await turn(w, 'SD1', 1, 3);
        await sleep(300);
        await turn(w, 'SD2', -1, 3);
        await sleep(300);
        await turn(w, 'SD3', 1, 1);
        await sleep(400);
        await longPage(w);
        await sleep(300);
      },
      async fake(w, f) {
        await fakeTasks(w, [
          () => f.selectTrack(SAMPLER),
          () => fakeSlot(f, 5),
          () => f.sdMode(true),
          () => f.sdPage(3),
          'manual',
          'manual',
          'manual',
          () => f.sdMode(false),
        ]);
      },
    },
    2: {
      async sim(w) {
        await toPage(w, 0);
        await sleep(300);
        await turn(w, 'SD2', -1, 12);
        await sleep(300);
        await turn(w, 'SD2', 1, 24);
        await sleep(300);
        await combo(w, 'ALL', 'SD1');
        await sleep(300);
      },
      async fake(w, f) {
        await fakeTasks(w, [() => f.sdPage(0), 'manual', 'manual', 'manual']);
      },
    },
  },
  '5-4': {
    0: {
      async sim(w) {
        await w.tap('SAMPLER');
        await sleep(300);
        await combo(w, 'PAGE', 'SAMPLER');
        await sleep(300);
        await record(w, 5); // 模拟机每节课从头开始：先在第 5 个位上录一段
        await taps(w, ['DK1', 'DK5', 'DK9', 'DK13'], 120);
        await sleep(300);
        await playStop(w);
      },
      async fake(w, f) {
        await fakeTasks(w, [
          () => f.selectTrack(SAMPLER),
          'manual',
          'manual',
          async () => {
            f.play();
            await sleep(500);
            f.stop();
          },
        ], 900);
      },
    },
    1: {
      async sim(w) {
        await w.tap('PLAY');
        await sleep(400);
        await w.hold('DK9');
        await sleep(100);
        await turn(w, 'SD2', -1, 3);
        await sleep(300);
        await w.tap('DK9'); // 松开
        await sleep(300);
        await w.hold('DK13');
        await sleep(100);
        await turn(w, 'SD2', 1, 3);
        await sleep(300);
        await w.tap('DK13');
        await sleep(600);
        await w.tap('PLAY');
        await sleep(400);
      },
      async fake(w, f) {
        await fakeTasks(w, [() => f.play(), 'manual', 'manual', () => f.stop()], 900);
      },
    },
    3: {
      async sim(w) {
        await pickSource(w, 3);
        await w.tap('PLAY');
        await sleep(300);
        await w.tap('SK6');
        await sleep(300);
        await w.tap('RECSAMPLE');
        await sleep(700);
        await w.tap('RECSAMPLE');
        await sleep(400);
        await w.tap('PLAY');
        await sleep(400);
        await pickSource(w, 1);
      },
      async fake(w, f) {
        await fakeTasks(w, [
          'manual',
          () => f.play(),
          () => fakeSlot(f, 6),
          async () => {
            f.recordSample(6, 'Resmp06');
            await sleep(3500);
          },
          () => f.stop(),
          'manual',
        ], 900);
      },
    },
  },

  // ───────────── 第 6 章 ─────────────
  '6-1': {
    1: {
      async sim(w) {
        await w.tap('KICK');
        await sleep(300);
        await turn(w, 'KICK', 1, 1);
        await sleep(300);
        await taps(w, ['DK1', 'DK5', 'DK9', 'DK11', 'DK13'], 100);
        await sleep(300);
        await w.tap('PLAY');
        await sleep(600);
        await turn(w, 'KICK', -1, 1);
        await sleep(500);
        await turn(w, 'KICK', 1, 1);
        await sleep(500);
        await w.tap('PLAY');
        await sleep(400);
      },
      async fake(w, f) {
        await fakeTasks(w, [
          () => f.selectTrack(0),
          () => f.turnKnob(0, 1),
          () => [0, 4, 8, 10, 12].forEach((s) => f.toggleStep(0, s)),
          () => f.play(),
          () => f.turnKnob(0, -1),
          () => f.turnKnob(0, 1),
          () => f.stop(),
        ]);
      },
    },
    2: {
      async sim(w) {
        await w.tap('PLAY');
        await sleep(500);
        await w.hold('KICK');
        await w.tap('DK1');
        await sleep(3200); // 等到下一小节的开头（100 BPM 一小节 2.4 秒）
        await w.hold('KICK');
        await w.tap('DK2');
        await w.tap('DK2');
        await sleep(700);
        await w.tap('PLAY');
        await sleep(400);
      },
      async fake(w, f) {
        await fakeTasks(w, [() => f.play(), () => f.turnKnob(0, -1), () => f.turnKnob(0, 1), () => f.stop()]);
      },
    },
  },
  '6-2': {
    1: {
      async sim(w) {
        await w.tap('SNARE');
        await sleep(400);
        await w.hold('SNARE');
        await w.tap('DK1', 2150);
        await sleep(400);
        await w.hold('SNARE');
        await w.tap('PAGE');
        await w.tap('DK2');
        await sleep(400);
        await turn(w, 'SNARE', 1, 1);
        await sleep(400);
        await taps(w, ['DK14', 'DK15', 'DK16'], 100);
        await sleep(300);
        await playStop(w);
      },
      async fake(w, f) {
        await fakeTasks(w, [
          () => f.selectTrack(1),
          'manual',
          'manual',
          () => f.turnKnob(1, 1),
          () => [13, 14, 15].forEach((s) => f.toggleStep(1, s)),
          async () => {
            f.play();
            await sleep(500);
            f.stop();
          },
        ]);
      },
    },
    2: {
      async sim(w) {
        await turn(w, 'SNARE', -1, 1);
        await sleep(400);
        await w.hold('ALL');
        await w.tap('DK1', 2150);
        await sleep(400);
        await w.hold('ALL');
        await w.tap('PAGE');
        await w.tap('DK3');
        await sleep(400);
        await turn(w, 'ALL', 1, 2);
        await sleep(400);
        await w.tap('HAT2');
        await sleep(300);
        await taps(w, ['DK3', 'DK7', 'DK11', 'DK15'], 100);
        await sleep(300);
        await playStop(w);
      },
      async fake(w, f) {
        await fakeTasks(w, [
          () => f.turnKnob(1, -1),
          'manual',
          'manual',
          () => Array.from({ length: 11 }, (_, i) => f.turnKnob(i, 2)),
          () => f.selectTrack(4),
          () => [2, 6, 10, 14].forEach((s) => f.toggleStep(4, s)),
          async () => {
            f.play();
            await sleep(500);
            f.stop();
          },
        ]);
      },
    },
  },
  '6-3': {
    1: {
      async sim(w) {
        await combo(w, 'ALL', 'PROJECT');
        await sleep(500);
        await turn(w, 'ALL', -1, 2);
        await sleep(300);
        await combo(w, 'MUTE', 'KICK');
        await combo(w, 'MUTE', 'SNARE');
        await sleep(300);
        await w.tap('DK2');
        await sleep(300);
        await combo(w, 'MUTE', 'ALL');
        await sleep(300);
        await w.tap('DK3');
        await sleep(300);
        await turn(w, 'ALL', 1, 2);
        await sleep(300);
        await w.tap('DK1');
        await sleep(300);
        await playStop(w, 1200);
      },
      async fake(w, f) {
        await fakeTasks(w, [
          'manual',
          'manual',
          () => Array.from({ length: 11 }, (_, i) => f.turnKnob(i, -2)),
          () => f.mute(0),
          () => f.mute(1),
          'manual',
          () => {
            f.mute(0);
            f.mute(1);
          },
          'manual',
          () => Array.from({ length: 11 }, (_, i) => f.turnKnob(i, 2)),
          'manual',
          () => f.play(),
          () => f.stop(),
        ]);
      },
    },
    2: {
      async sim(w) {
        await combo(w, 'ALL', 'PROJECT');
        await sleep(300);
        await w.tap('PLAY');
        await sleep(500);
        await w.tap('DK3');
        await sleep(3000); // Scene 模式：等到下一小节的开头才换
        await w.tap('DK1');
        await sleep(3000);
        await w.tap('PLAY');
        await sleep(400);
        await combo(w, 'ALL', 'PROJECT');
        await sleep(300);
      },
      async fake(w, f) {
        await fakeTasks(w, ['manual', () => f.play(), 'manual', 'manual', () => f.stop(), 'manual']);
      },
    },
  },
  '6-4': {
    2: {
      async sim(w) {
        await combo(w, 'ALL', 'PROJECT');
        await sleep(400);
        await taps(w, ['DK2', 'DK3'], 250);
        await turn(w, 'SNARE', 1, 1);
        await sleep(400);
        await taps(w, ['DK4', 'DK5'], 250);
        await sleep(300);
        await w.tap('DK1');
        await sleep(300);
        await playStop(w, 1000);
      },
      async fake(w, f) {
        await fakeTasks(w, ['manual', () => f.turnKnob(1, -5) || f.turnKnob(1, 1), 'manual', 'manual', () => f.play(), () => f.stop()]);
      },
    },
  },

  // ───────────── 第 7 章 ─────────────
  '7-1': {
    1: {
      async sim(w) {
        await w.tap('SYNTH2');
        await sleep(300);
        await longPage(w);
        await toPage(w, 2);
        await sleep(300);
        await w.tap('PLAY');
        await sleep(400);
        await turn(w, 'SD1', 1, 3);
        await sleep(300);
        await turn(w, 'SD2', 1, 3);
        await sleep(400);
        await w.tap('PLAY');
        await sleep(300);
        await longPage(w);
        await sleep(300);
      },
      async fake(w, f) {
        await fakeTasks(w, [
          () => f.selectTrack(SYNTH2),
          () => f.sdMode(true),
          () => f.sdPage(2),
          () => f.play(),
          () => f.turnSD(SYNTH2, 'rev', 0x28 + 16),
          () => f.turnSD(SYNTH2, 'dly', 18),
          () => f.stop(),
          () => f.sdMode(false),
        ]);
      },
    },
    2: {
      async sim(w) {
        await combo(w, 'ALL', 'VOL+');
        await sleep(300);
        await w.tap('PLAY');
        await sleep(300);
        await w.tap('SD3');
        await sleep(300);
        await turn(w, 'SNARE', 1, 3);
        await sleep(300);
        await w.tap('SD2');
        await sleep(300);
        await turn(w, 'HAT1', -1, 3);
        await sleep(300);
        await w.tap('PLAY');
        await sleep(300);
        await combo(w, 'ALL', 'VOL+');
        await sleep(300);
      },
      async fake(w, f) {
        await fakeTasks(w, ['manual', () => f.play(), 'manual', 'manual', 'manual', 'manual', () => f.stop(), 'manual']);
      },
    },
  },
  '7-2': {
    1: {
      async sim(w) {
        await w.tap('PLAY');
        await sleep(400);
        await slide('HIGHPASS', 0.9);
        await sleep(300);
        await slide('REPEATER', 0.5);
        await sleep(300);
        await w.tap('PLAY');
        await sleep(300);
      },
      async fake(w, f) {
        await fakeTasks(w, [() => f.play(), () => fakeCc(105), 'manual', () => fakeCc(106), 'manual', () => f.stop()]);
      },
    },
    2: {
      async sim(w) {
        await turn(w, 'FX', 1, 1);
        await sleep(300);
        await w.tap('PLAY');
        await sleep(300);
        await slide('FXLEVEL', 0.8);
        await sleep(300);
        await w.tap('CLEARFX');
        await sleep(300);
        await w.tap('PLAY');
        await sleep(300);
      },
      async fake(w, f) {
        await fakeTasks(w, ['manual', 'manual', () => f.play(), () => fakeCc(102, 90), 'manual', () => f.stop()]);
      },
    },
    3: {
      async sim(w) {
        await w.tap('PLAY');
        await sleep(400);
        await slide('HIGHPASS', 0.95);
        await sleep(300);
        await w.tap('PLAY');
        await sleep(300);
      },
      async fake(w, f) {
        await fakeTasks(w, [() => f.play(), () => fakeCc(105), 'manual', () => f.stop()]);
      },
    },
  },
  '7-3': {
    1: {
      async sim(w) {
        await combo(w, 'ALL', 'MUTE');
        await sleep(300);
        await taps(w, ['KICK', 'SNARE', 'SYNTH1'], 250);
        await sleep(300);
        await w.tap('PLAY');
        await sleep(500);
        await taps(w, ['KICK', 'SYNTH1', 'KICK'], 400);
        await sleep(300);
        await w.tap('ALL');
        await sleep(400);
        await w.tap('PLAY');
        await sleep(300);
        await w.tap('MUTE');
        await sleep(300);
      },
      async fake(w, f) {
        await fakeTasks(w, [
          'manual',
          () => f.mute(0),
          () => {
            f.mute(1);
            f.mute(7);
          },
          () => f.play(),
          () => f.mute(0),
          () => f.mute(7),
          () => f.mute(0),
          () => {
            f.mute(0);
            f.mute(1);
          },
          () => f.stop(),
          'manual',
        ]);
      },
    },
    2: {
      async sim(w) {
        await w.tap('PLAY');
        await sleep(400);
        await w.hold('ALL');
        await w.tap('DK3');
        await sleep(3200);
        await w.hold('ALL');
        await w.tap('DK1');
        await sleep(3200);
        await w.tap('PLAY');
        await sleep(300);
      },
      async fake(w, f) {
        await fakeTasks(w, [
          () => f.play(),
          () => Array.from({ length: 11 }, (_, i) => f.turnKnob(i, 2)),
          () => Array.from({ length: 11 }, (_, i) => f.turnKnob(i, -2)),
          () => f.stop(),
        ]);
      },
    },
  },
  '7-4': {
    1: {
      async sim(w) {
        await combo(w, 'PROJECT', 'DK4');
        await sleep(300);
        await combo(w, 'DELETE', 'KICK');
        await sleep(300);
        await combo(w, 'PROJECT', 'DK12');
        await sleep(300);
        await playStop(w);
      },
      async fake(w, f) {
        await fakeTasks(w, [
          'manual',
          async () => {
            f.selectTrack(0); // 选中的鼓轨每一轮都读：清空之后马上读得到
            await sleep(300);
            f.clearPattern(0);
            await sleep(1500);
          },
          async () => {
            await w.manual();
            f.toggleStep(0, 0);
          },
          () => f.play(),
          () => f.stop(),
        ]);
      },
    },
    2: {
      async sim(w) {
        await w.tap('SYNTH2');
        await sleep(300);
        await toPage(w, 1);
        await sleep(300);
        await turn(w, 'SD1', 1, 7);
        await sleep(300);
        await w.tap('UNDO');
        await sleep(300);
        await toPage(w, 0);
        await sleep(300);
      },
      async fake(w, f) {
        await fakeTasks(w, [() => f.selectTrack(SYNTH2), () => f.sdPage(1), () => f.turnSD(SYNTH2, 'attack', 30), 'manual', () => f.sdPage(0)]);
      },
    },
  },

  // ───────────── 第 8 章 ─────────────
  '8-1': {
    1: {
      async sim(w) {
        await pickSongs(3);
        await manuals(w, 2);
      },
      async fake(w) {
        await pickSongs(3);
        await manuals(w, 2);
      },
    },
  },
  '8-2': {
    // 曲目课在走查里不做：两项“做完曲目课回来”也点“我已经做了”
    1: { sim: (w) => manuals(w, 4), fake: (w) => manuals(w, 4) },
  },
  '8-3': {
    1: {
      async sim(w) {
        await w.tap('PLAY');
        await sleep(500);
        await w.tap('PLAY');
        await sleep(400);
        await combo(w, 'PROJECT', 'DK6');
        await sleep(300);
        await w.tap('PLAY');
        await sleep(500);
        await combo(w, 'PROJECT', 'DK5');
        await sleep(400);
      },
      async fake(w, f) {
        // 停之前隔一会儿：换完工程的 1.2 秒里镜像不把“停下”算成你按的（换工程机器会自己停）
        await fakeTasks(w, [() => f.setProject(4), () => f.play(), async () => { await sleep(1300); f.stop(); }, () => f.setProject(5), () => f.play(), () => { f.stop(); f.setProject(4); }]);
      },
    },
  },
  '8-4': {
    // 无界面的浏览器里录不了音：三项都点“我已经做了 / 做好了”
    1: { sim: (w) => manuals(w, 3), fake: (w) => manuals(w, 3) },
  },
};

export const run = (id, from, to, opts) => runPlan(PLANS, id, from, to, opts);
