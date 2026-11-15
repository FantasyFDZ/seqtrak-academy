// 开发测试用：第 0–2 章的走查（键盘学习方式做的时候补上的；第 3 章起见 walk-ch3.js / walk-ch4.js / walk-ch5.js）。平时应用不会加载它。
// 用法：地址里写 ?walk=0-1（第 0–2 章的课都走这里，main.js 分派）；加 &walkkeys 就是用电脑键盘走（键盘学习方式，见 walkthrough.js）。
//   const ch0 = await import('/js/dev/walk-ch0.js'); await ch0.run('1-3');
// 音游、“找按键”这两样和学习方式无关（音游用它自己的键，找按键是用鼠标在面板图上点）：走查里点“跳过这一步”，结果里记 skipped。
// 小测替你选对的答案，导览一站一站点完，自由创作点“先跳过”。编程挑战照目标把格子填好（模拟机上的核对是自动的）。
// 注意：走查会把课标记成“完成”，只在测试数据上跑；在正式服务的端口（4747）上它会拒绝。
import { runPlan, helpers } from './walk-ch4.js';
import { simulator } from '../simulator.js';

const { sleep, taps, combo, turn } = helpers;

/** 点“跳过这一步”：音游、找按键 */
async function skip() {
  [...document.querySelectorAll('.step-actions .btn, .btn')].find((b) => b.textContent.trim() === '跳过这一步')?.click();
  await sleep(500);
  return 'skipped';
}

/** 把一条鼓轨的格子摆成 want（从 0 数的步）：先按轨道键选中它，再把多的按灭、少的按亮 */
async function fill(w, track, want) {
  await w.tap(track);
  await sleep(150);
  const have = simulator.stepsOf(track);
  const flip = [...want.filter((s) => !have.includes(s)), ...have.filter((s) => !want.includes(s))];
  await taps(w, flip.map((s) => `DK${s + 1}`), 60);
  await sleep(200);
}

const steps = (pattern) => [...pattern].map((c, i) => (c === 'x' ? i : -1)).filter((i) => i >= 0);

async function playStop(w, ms = 700) {
  await w.tap('PLAY');
  await sleep(ms);
  await w.tap('PLAY');
  await sleep(300);
}

/** 速度调到 bpm：按 [BPM+] / [BPM-] 一下一格 */
async function tempoTo(w, bpm) {
  const d = bpm - simulator.proj.tempo;
  for (let i = 0; i < Math.abs(d); i++) await w.tap(d > 0 ? 'BPM+' : 'BPM-');
  await sleep(900); // 速度要停在那个数上一会儿才算
}

const game = { sim: skip };
const findkeys = { sim: skip };
const tour = {
  async sim() {
    for (let i = 0; i < 11; i++) {
      [...document.querySelectorAll('.tour-nav .btn.primary')].find((b) => /下一站/.test(b.textContent))?.click();
      await sleep(120);
    }
  },
};

export const PLANS = {
  '0-1': {
    2: tour,
    3: {
      async sim(w) {
        await playStop(w);
        await w.tap('KICK');
        await sleep(200);
        await taps(w, ['DK5', 'DK9', 'DK13'], 80);
        await w.tap('PLAY');
        await sleep(500);
        await combo(w, 'MUTE', 'KICK');
        await sleep(300);
        await combo(w, 'MUTE', 'KICK');
        await sleep(300);
        await w.tap('PLAY');
        await sleep(300);
        await w.tap('PLAY', 2150); // 按住 2 秒：关机
        await sleep(300);
        await w.tap('PLAY', 2150); // 再按住 2 秒：开机
        await sleep(400);
      },
    },
    4: findkeys,
  },
  '0-2': {
    0: {
      async sim(w) {
        await w.tap('VOL+');
        await w.tap('VOL-');
        await sleep(200);
        await combo(w, 'PROJECT', 'DK1');
        await sleep(300);
        await playStop(w, 900);
      },
    },
    1: {
      async sim(w) {
        for (const t of ['KICK', 'SNARE', 'HAT1', 'SYNTH1']) {
          await w.tap(t);
          await sleep(250);
        }
        await taps(w, ['SK1', 'SK3', 'SK5'], 120);
      },
    },
  },
  '0-3': {
    1: {
      async sim(w) {
        await combo(w, 'PROJECT', 'DK4');
        await sleep(300);
        await playStop(w);
      },
    },
    2: {
      async sim(w) {
        await combo(w, 'KICK', 'SK1');
        await sleep(300);
        await taps(w, ['SK1', 'SK1', 'SK1', 'SK1'], 120);
        await taps(w, ['SK2', 'SK3', 'SK4', 'SK5', 'SK6', 'SK7'], 120);
        await sleep(300);
        await combo(w, 'KICK', 'SK1'); // 退出打鼓模式，别带进下一课
      },
    },
  },
  '1-1': {
    2: { sim: (w) => tempoTo(w, 100) },
    3: game,
  },
  '1-2': {
    2: {
      async sim(w) {
        await w.tap('KICK');
        await sleep(300);
        await w.manual(); // “看一眼第 1 个亮着”：没有条件，自己点“做好了”
        await taps(w, ['DK5', 'DK9', 'DK13'], 80);
        await playStop(w);
      },
    },
    3: { sim: (w) => fill(w, 'KICK', steps('x---x---x---x---')) },
  },
  '1-3': {
    1: game,
    2: {
      async sim(w) {
        await w.tap('SNARE');
        await sleep(200);
        await taps(w, ['DK5', 'DK13'], 80);
        await w.tap('PLAY');
        await sleep(500);
      },
    },
    3: {
      async sim(w) {
        if (!simulator.playing) await w.tap('PLAY');
        await combo(w, 'MUTE', 'KICK');
        await sleep(300);
        await combo(w, 'MUTE', 'KICK');
        await sleep(300);
        await combo(w, 'SOLO', 'SNARE');
        await sleep(300);
        await combo(w, 'SOLO', 'SNARE');
        await sleep(300);
        await w.tap('PLAY');
        await sleep(300);
      },
    },
    4: {
      async sim(w) {
        await fill(w, 'KICK', steps('x---x---x---x---'));
        await fill(w, 'SNARE', steps('----x-------x---'));
      },
    },
    5: game,
  },
  '1-4': {
    1: game,
    2: game,
    3: {
      async sim(w) {
        await w.tap('HAT1');
        await sleep(200);
        await taps(w, ['DK3', 'DK7', 'DK11', 'DK15'], 80);
        await w.tap('CLAP');
        await sleep(200);
        await taps(w, ['DK5', 'DK13'], 80);
        await playStop(w);
      },
    },
    4: {
      async sim(w) {
        await fill(w, 'KICK', steps('x---x---x---x---'));
        await fill(w, 'CLAP', steps('----x-------x---'));
        await fill(w, 'HAT1', steps('--x---x---x---x-'));
      },
    },
    5: {
      async sim(w) {
        await w.tap('KICK');
        await sleep(200);
        await w.tap('PLAY');
        await sleep(300);
        await turn(w, 'SD1', 1, 1);
        await sleep(300);
        await w.tap('HAT1');
        await sleep(200);
        await turn(w, 'SD1', 1, 1);
        await sleep(300);
        await w.tap('PLAY');
        await sleep(300);
      },
    },
    6: game,
  },
  '1-5': {
    2: {
      async sim(w) {
        await w.tap('PLAY');
        await sleep(300);
        await taps(w, ['SWING', 'SWING'], 150);
        await sleep(300);
        await combo(w, 'DELETE', 'SWING');
        await sleep(300);
        await w.tap('PLAY');
        await sleep(300);
      },
    },
    3: game,
    4: {
      async sim(w) {
        await fill(w, 'KICK', steps('x-------x-x-----'));
        await fill(w, 'SNARE', steps('----x-------x---'));
      },
    },
    5: {
      async sim(w) {
        await fill(w, 'KICK', steps('x---------x-----'));
        await fill(w, 'SNARE', steps('----x-------x---'));
      },
    },
  },
  '2-1': {
    2: {
      async sim(w) {
        await w.tap('SYNTH1');
        await sleep(250);
        await taps(w, [1, 2, 3, 4, 5, 6, 7].map((k) => `SK${k}`), 120);
        await combo(w, 'SD1', 'DK1'); // SOUND 旋钮没有专门的电脑键：用鼠标长按，再按 Q
        await sleep(300);
        await w.tap('OCTAVE');
        await sleep(300);
      },
    },
  },
  '2-2': {
    1: {
      async sim(w) {
        // C 小调：音阶第 1 种、调 C（没在那儿就按 [SCALE] / [KEY] 轮过去）
        for (let i = 0; i < 8 && simulator.proj.scale !== 0; i++) await w.tap('SCALE');
        for (let i = 0; i < 12 && simulator.proj.key !== 0; i++) await w.tap('KEY');
        await sleep(700);
      },
    },
    2: game,
    3: {
      async sim(w) {
        await w.tap('SYNTH1');
        await sleep(250);
        if (simulator.stepMode !== 'SYNTH1') await combo(w, 'PAGE', 'SYNTH1');
        await sleep(300);
        await w.tap('SK1');
        await sleep(200);
        await taps(w, ['DK1', 'DK5', 'DK9', 'DK13'], 80);
        await playStop(w);
      },
    },
    4: {
      async sim(w) {
        // 合成器轨：步进输入里按亮第 1、5、9、13 个（放的是最后按过的那个音）
        await w.tap('SYNTH1');
        await sleep(200);
        if (simulator.stepMode !== 'SYNTH1') await combo(w, 'PAGE', 'SYNTH1');
        await sleep(200);
        await w.tap('SK1');
        const want = [0, 4, 8, 12];
        const have = simulator.stepsOf('SYNTH1');
        await taps(w, [...want.filter((s) => !have.includes(s)), ...have.filter((s) => !want.includes(s))].map((s) => `DK${s + 1}`), 80);
        await sleep(300);
      },
    },
    5: game,
  },
  '2-3': {
    1: game,
    2: game,
    4: game,
  },
};

export const run = (id, from, to, opts) => runPlan(PLANS, id, from, to, opts);
