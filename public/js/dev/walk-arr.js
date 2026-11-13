// 开发测试用：把完整版的一节课（content/arrangement-lessons.js：arr-<歌>-1 备料 / arr-<歌>-2 排成一首）从头到尾走一遍。平时应用不会加载它。
// 用法和 walk-ch4.js 一样：
//   const arr = await import('/js/dev/walk-arr.js');
//   await arr.run('arr-faded-1');      // 没接真机时：在模拟机上走（地址带 ?fake 时接着假真机走）
//   地址里写 ?walk=arr-faded-2（加 ?fake 就是假真机）也行：页面加载完自动走，结果写进页面里 id 为 walk-result 的元素。
// 课是从完整版的数据生成的，每一项上挂着 act（要做什么）：这里照着 act 一项一项做，做完等它打勾。
//   模拟机：真的去按（换段、复制粘贴、[BAR LENGTH]、翻页、按方键、Synth key、八度、拉长、Song 模式、scene、静音、scene 长度、滤波器……）。
//   假真机：镜像认得出的（选轨、在第几段、第 1 页的鼓、长度、八度、弹法、静音、播放、滤波器的 CC）让假真机去做、等镜像读到；
//          认不出的（复制粘贴、步进输入里的音、Song 模式……）替你点“做好了 / 我已经做了”。
// 返回 { lesson, mode, steps: [{ i, title, ok, tasks, note }], done, errors }。
// 注意：走查会把课标记成“完成”，只在测试数据上跑；在正式服务的端口（4747）上它会拒绝。
import { install } from './walkthrough.js';
import { helpers } from './walk-ch4.js';
import { findLesson } from '../content/curriculum.js';
import { simulator } from '../simulator.js';
import { mirror } from '../mirror.js';
import { midi } from '../midi.js';
import { TRACKS } from '../tracks.js';

const { sleep, slide } = helpers;
const ti = (id) => TRACKS.findIndex((t) => t.id === id);
const FX_CATS = ['FILTER', 'REVERB', 'DELAY', 'COMP', 'DISTORTION', 'MODULATION', 'DUCKER', 'OTHER'];
const at = (s) => (s % 16) + 1;

async function combo(w, a, b) {
  await w.hold(a);
  await w.tap(b);
  await sleep(120);
}

async function toPage(w, page) {
  for (let i = 0; i < 9 && simulator.page !== page; i++) {
    await w.tap('PAGE');
    await sleep(60);
  }
}

async function octaveBy(w, by) {
  if (!by) return;
  if (simulator.held !== 'OCTAVE') await w.hold('OCTAVE');
  await w.turn('ALL', Math.sign(by), Math.abs(by));
  await sleep(60);
}

async function exitSI(w, track) {
  if (simulator.stepMode === track) await combo(w, 'PAGE', track);
}

// ───────────── 模拟机上怎么做 ─────────────
const SIM = {
  none() {},
  async select(w, a) {
    await w.tap(a.track);
    await sleep(120);
  },
  async project(w) {
    if (simulator.project < 4) await combo(w, 'PROJECT', 'DK5');
  },
  async tempo(w, a) {
    const d = a.value - simulator.proj.tempo;
    for (let i = 0; i < Math.abs(d); i++) await w.tap(d > 0 ? 'BPM+' : 'BPM-');
  },
  async scale(w, a) {
    for (let i = 0; i < 8 && simulator.proj.scale !== a.scale; i++) await w.tap('SCALE');
    for (let i = 0; i < 12 && simulator.proj.key !== a.key; i++) await w.tap('KEY');
  },
  async patmode(w) {
    if (simulator.patSlots === 6) return;
    await w.hold('KICK');
    await w.tap('DK4');
    await sleep(700);
  },
  async sound(w, a) {
    await combo(w, 'SD1', `DK${a.cat + 1}`);
  },
  async octave(w, a) {
    await octaveBy(w, a.to - simulator.proj.octave[a.track]);
    await sleep(1300); // 模拟机上 [OCTAVE] 转完 1.2 秒才算松手：紧接着按住 ALL 会被当成“接着转八度”
  },
  async poly(w, a) {
    const d = a.mode - simulator.polyOf(a.track);
    if (d) await w.turn('SD2', Math.sign(d), Math.abs(d));
  },
  async single(w, a) {
    if (simulator.fxSingle !== a.on) await w.tap('MASTERSINGLE');
  },
  async fx(w, a) {
    const fx = simulator.fxOf(a.track);
    const cur = fx ? FX_CATS.indexOf(fx.cat) * 8 + fx.preset : -1;
    const want = FX_CATS.indexOf(a.cat) * 8;
    if (want !== cur) await w.turn('FX', Math.sign(want - cur), Math.abs(want - cur));
  },
  async fxlevel(w, a) {
    await slide('FXLEVEL', a.level);
  },
  async mixer(w, a) {
    if (simulator.mixer !== a.on) await combo(w, 'ALL', 'VOL+');
  },
  async mixsend(w, a) {
    await w.tap('SD3');
    for (const t of a.tracks) await w.turn(t, 1, 2);
  },
  async copy(w, a) {
    if (a.exitSI) await exitSI(w, a.track);
    await w.hold(a.track);
    await w.tap(`DK${a.from}`, 2150);
    await sleep(200);
  },
  async paste(w, a) {
    await w.hold(a.track);
    await w.tap('PAGE');
    await w.tap(`DK${a.to}`);
    await sleep(200);
  },
  async turn(w, a) {
    if (a.exitSI) await exitSI(w, a.track);
    const d = a.to - 1 - simulator.patternOf(a.track);
    if (d) await w.turn(a.track, Math.sign(d), Math.abs(d));
  },
  async si(w, a) {
    if (simulator.stepMode !== a.track) await combo(w, 'PAGE', a.track);
  },
  async bars(w, a) {
    for (let i = 0; i < 6 && simulator.barsOf(a.track) !== a.bars; i++) await w.tap('BARLENGTH');
  },
  async drumpage(w, a) {
    await toPage(w, a.page);
    const from = a.page * 16;
    const now = simulator.stepsOf(a.track).filter((s) => s >= from && s < from + 16);
    for (const s of [...a.target.filter((x) => !now.includes(x)), ...now.filter((x) => !a.target.includes(x))]) await w.tap(`DK${at(s)}`);
  },
  async synthpage(w, a) {
    await toPage(w, a.page);
    for (const s of a.off) await w.tap(`DK${at(s)}`);
    await sleep(80);
    for (const g of a.add) {
      await octaveBy(w, g.shift);
      await w.tap(`SK${g.key}`);
      for (const s of g.steps) await w.tap(`DK${at(s)}`);
      await octaveBy(w, -g.shift);
    }
    for (const x of a.swap) {
      await octaveBy(w, x.shift);
      await w.hold(`DK${at(x.step)}`);
      await w.tap(`SK${x.key}`);
      await octaveBy(w, -x.shift);
    }
    await sleep(120);
  },
  async stretch(w, a) {
    await toPage(w, a.page);
    for (const z of a.stretch) {
      const d = z.len - (simulator.lenOf(a.track, z.step) || 1);
      if (!d) continue;
      await w.hold(`DK${at(z.step)}`);
      await w.turn('ALL', Math.sign(d), Math.abs(d));
      await w.tap(`DK${at(z.step)}`); // 再点一下 = 松开
      await sleep(80);
    }
  },
  async play(w) {
    if (!simulator.playing) await w.tap('PLAY');
    await sleep(300);
  },
  async stop(w) {
    if (simulator.playing) await w.tap('PLAY');
  },
  async allpat(w) {
    const most = Math.max(...TRACKS.map((t) => simulator.patternOf(t.id)));
    if (most) await w.turn('ALL', -1, most);
  },
  async unmuteall(w) {
    await combo(w, 'MUTE', 'ALL');
  },
  async songmode(w, a) {
    for (let i = 0; i < 3 && simulator.songMode !== a.mode; i++) await combo(w, 'ALL', 'PROJECT');
  },
  async scene(w, a) {
    if (!(simulator.sceneIndex === a.index && simulator.sceneCount > a.index)) await w.tap(`DK${a.index + 1}`);
    await sleep(150);
  },
  async scenepat(w, a) {
    for (const [t, no] of Object.entries(a.pat)) {
      const d = no - 1 - simulator.patternOf(t);
      if (d) await w.turn(t, Math.sign(d), Math.abs(d));
    }
  },
  async mute(w, a) {
    for (const t of [...a.mute, ...a.unmute]) await combo(w, 'MUTE', t);
  },
  async scenelen(w, a) {
    await w.hold('PAGE');
    for (let i = 0; i < 24; i++) {
      const sc = simulator.sceneOf();
      if (sc && !sc.auto && sc.len === a.steps) break;
      await w.turn('ALL', sc.auto || sc.len < a.steps ? 1 : -1, 1);
    }
    await w.tap('PAGE'); // 再点一下 = 松开
    await sleep(100);
  },
  async sdpage(w, a) {
    for (let i = 0; i < 6 && simulator.sdPage !== a.page; i++) await w.tap('SDPAGE');
  },
  // 滤波器：一格一格转，打了勾就停手（像人那样：多转的那几格会算到下一项的“开始时”头上）
  async cutoff(w, a, f, done) {
    if (a.select) await SIM.select(w, a);
    const cur = simulator.paramOf(a.track, 'cutoff') || 0;
    const want = a.to !== undefined ? a.to : cur + a.by;
    const dir = Math.sign(want - cur);
    for (let i = 0; i < 24 && dir && !done(); i++) {
      await w.turn('SD3', dir, 1);
      await sleep(60);
    }
  },
};

// ───────────── 假真机上怎么做（认不出的那几项不用做，下面会替你点“做好了”） ─────────────
function fakeActs(f) {
  const cut = {};
  const steps = (i) => f.st.steps[f.st.project][i][f.st.pat[i]];
  return {
    none() {},
    select: (w, a) => f.selectTrack(ti(a.track)),
    project: () => f.setProject(4),
    tempo: (w, a) => f.setTempo(a.value),
    scale: (w, a) => f.scaleKey(a.scale, a.key),
    patmode: () => f.patternMode(true),
    sound: (w, a) => f.changeSound(ti(a.track) + 1, { name: `Fake Sound ${a.cat + 1}`, poly: ti(a.track) >= 7 ? 0 : undefined }),
    octave: (w, a) => f.octave(ti(a.track), a.to),
    poly: (w, a) => f.polyMode(ti(a.track), a.mode),
    fxlevel: () => midi.simulate([0xb0, 107, 90]),
    turn: (w, a) => f.setPattern(ti(a.track), a.to - 1),
    si: (w, a) => f.selectTrack(ti(a.track)),
    bars: (w, a) => f.barLength(ti(a.track), a.bars),
    drumpage(w, a) {
      if (a.page) return;
      const set = steps(ti(a.track));
      for (const s of [...set].filter((x) => x < 16 && !a.target.includes(x))) f.toggleStep(ti(a.track), s);
      for (const s of a.target.filter((x) => !set.has(x))) f.toggleStep(ti(a.track), s);
    },
    play: () => f.play(),
    stop: () => f.stop(),
    allpat: () => TRACKS.forEach((t, i) => f.setPattern(i, 0)),
    unmuteall: () => TRACKS.forEach((t, i) => f.setMute(i, false)),
    scenepat: (w, a) => Object.entries(a.pat).forEach(([t, no]) => f.setPattern(ti(t), no - 1)),
    mute(w, a) {
      for (const t of a.mute) f.setMute(ti(t), true);
      for (const t of a.unmute) f.setMute(ti(t), false);
    },
    sdpage: (w, a) => f.sdPage(a.page),
    async cutoff(w, a) {
      if (a.select) f.selectTrack(ti(a.track));
      const cur = cut[a.track] ?? 0;
      const want = Math.max(-64, Math.min(63, a.to !== undefined ? a.to : cur + a.by));
      cut[a.track] = want;
      await sleep(300);
      f.turnSD(ti(a.track), 'cutoff', want, { cc: true });
    },
  };
}

/** 一步里的清单：一项一项做，做完等它打勾；这台机器认不出的点“做好了” */
async function doTasks(w, step, fake) {
  const acts = fake ? fakeActs(fake) : SIM;
  const lis = () => [...document.querySelectorAll('.task ol li')];
  const isDone = (k) => /\b(done|skip)\b/.test(lis()[k]?.className || '');
  await sleep(fake ? 1500 : 250); // 一轮到就满足的那几项（已经在 5 号工程……）先让它自己打勾
  for (let k = 0; k < step.tasks.length; k++) {
    const t = step.tasks[k];
    for (let j = 0; j < 40 && !isDone(k) && !/\bnow\b/.test(lis()[k]?.className || ''); j++) await sleep(100);
    await sleep(fake ? 400 : 120);
    if (isDone(k)) continue;
    const watch = fake ? [t.live, t.sim, t.detect].find((x) => x && x.kind !== 'connected' && mirror.can(x)) : t.sim || t.detect;
    const act = acts[t.act?.do];
    if (act) await act(w, t.act, fake, () => isDone(k));
    if (watch) {
      for (let j = 0; j < (fake ? 70 : 50) && !isDone(k); j++) await sleep(100);
      if (!isDone(k)) return { k, text: t.text.slice(0, 80), kind: watch.kind };
    } else {
      await w.manual();
      await sleep(150);
    }
  }
  return null;
}

export async function run(id, from = 0, to = Infinity, { force = false } = {}) {
  if (location.port === '4747' && !force) return { lesson: id, refused: '这里是 4747（正式服务，存着真实的学习进度）：走查会改进度，换到测试用的服务上跑。' };
  const found = findLesson(id);
  if (!found) return { lesson: id, refused: '没有这节课' };
  const { lesson } = found;
  const w = install();
  const fake = window.__app.fake || null;
  if (from === 0) {
    if (!fake) simulator.reset();
    await w.go('#/');
    await w.go(`#/lesson/${id}`);
    document.querySelector('.step-dots i')?.click(); // 上次停在半路的话，回到第 1 步
    await sleep(400);
    // 进度里记着上次走到哪（只增不减），课是按那一步摆的模拟机：按“从第 1 步开始”重新摆一遍
    if (!fake && Number.isInteger(lesson.simProject)) {
      simulator.blankProject(lesson.simProject);
      simulator.seedProject(lesson.simProject, typeof lesson.simSeed === 'function' ? lesson.simSeed(0) : lesson.simSeed);
    }
    if (fake) {
      fake.setProject(4);
      await sleep(600);
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
    let stuck = null;
    if (step.type === 'do') stuck = await doTasks(w, step, fake);
    await sleep(400);
    const now = w.step();
    const t = step.track || step.tasks?.[stuck?.k]?.act?.track;
    const sim = !now.ready && !fake ? { sel: simulator.sel, stepMode: simulator.stepMode, page: simulator.page, held: simulator.held, song: simulator.songMode, scene: simulator.sceneIndex, ...(t ? { pat: simulator.patternOf(t), bars: simulator.barsOf(t), steps: simulator.stepsOf(t), notes: simulator.notesOf(t) } : {}), says: says.slice(-10) } : null;
    steps.push({ i, title: step.title, ok: now.ready, tasks: now.tasks, ...(now.ready ? {} : { note: now.status, stuck }), ...(sim ? { sim } : {}) });
    if (!now.ready) break;
    await w.next();
  }
  offSay();
  return { lesson: id, mode: fake ? '假真机' : '模拟机', steps, done: document.querySelector('.step-kind')?.textContent === '完成', errors: [...w.errors] };
}
