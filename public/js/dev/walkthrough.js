// 开发测试用：把一节课“走”一遍的小工具。平时应用不会加载它，只在浏览器控制台或自动化脚本里手动引入：
//   const w = (await import('/js/dev/walkthrough.js')).install();     // 之后也可以用 window.__walk
// 做新的一章时，用它把每一步在“没接真机（模拟机）”和“接着假真机（地址加 ?fake）”两种情况下各走一遍：
//   模拟机：  await w.tap('SYNTH2'); await w.hold('PAGE'); await w.turn('SD2', 1);        点 / 长按 / 转
//   假真机：  window.__app.fake.selectTrack(8) 之类（见 fake-seqtrak.js），认不出的任务用 await w.manual() 点“做好了”
//   音游：    await w.pill(1); await w.playStage('chord-two')                 键盘替你打一局（跟打那一段）
//             await w.playStage('chord-two', (lane) => fake.chordKey(lane.degree, 9))   改成由假真机来“按键”
//   每做一步看 w.step()：这一步的标题、任务打了几个勾、提示行和解说条现在说什么；w.errors 是期间冒出来的报错。
// 注意：这样走一遍，课会被标记成“完成”，音游成绩也会记下来。只在测试数据上用（虚拟机里的预览、mac-check.sh 的临时服务），
// 不要对着 Mac 上的正式服务（4747，真实进度）用。把整节课自动走完的现成脚本见 walk-ch3.js。
import { chartById } from '../content/charts.js';
import { normalizeChart } from '../chart.js';
import { audio } from '../audio.js';
import { midi } from '../midi.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];

/** 浏览器面板被挡住时 requestAnimationFrame 不会触发，音游和镜像的画面就不动了：测试时用定时器顶替。 */
function patchRaf() {
  window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
  window.cancelAnimationFrame = (id) => clearTimeout(id);
}

function watchErrors() {
  window.addEventListener('error', (e) => errors.push(String(e.message)));
  window.addEventListener('unhandledrejection', (e) => errors.push(`rejection: ${e.reason?.message || e.reason}`));
  const original = console.error;
  console.error = (...args) => {
    errors.push(args.map((x) => String(x?.stack || x)).join(' ').slice(0, 300));
    original(...args);
  };
}

// ───────────── 课程播放器 ─────────────

/** 现在这一步的样子 */
function step() {
  return {
    kind: document.querySelector('.step-kind')?.textContent,
    title: document.querySelector('.step h1')?.textContent,
    ready: !document.querySelector('.step-actions .btn.primary.lg')?.disabled,
    tasks: [...document.querySelectorAll('.task ol li')].map((li) => (li.querySelector('.tag')?.style.display !== 'none' ? '✓' : '·')).join(''),
    status: document.querySelector('.task-status')?.innerText?.replace(/\s+/g, ' ').slice(0, 220),
    say: document.querySelector('.sim-say')?.innerText?.slice(0, 200),
  };
}

/** 点“下一步 / 完成这一课” */
async function next() {
  document.querySelector('.step-actions .btn.primary.lg').click();
  await sleep(450);
  return step();
}

async function go(hash) {
  location.hash = hash;
  await sleep(900);
  return step();
}

/** 点任务旁边的“做好了 / 我已经做了” */
async function manual() {
  const button = document.querySelector('.task-status .btn.sm');
  const label = button?.textContent;
  button?.click();
  await sleep(250);
  return label;
}

/** 最后一条结果行（编程挑战的核对结果在这里） */
const result = () => [...document.querySelectorAll('.task-status')].pop()?.innerText.replace(/\s+/g, ' ');

// ───────────── 模拟机上的手势 ─────────────

const control = (id) => {
  const node = document.querySelector(`.sim [data-id="${id}"]`);
  if (!node) throw new Error(`屏幕上没有控件 ${id}（这一步旁边有模拟机吗？）`);
  return node;
};
const pointer = (type) => new PointerEvent(type, { bubbles: true, pointerId: 1, clientY: 100 });

/** 短按一下 */
async function tap(id, ms = 30) {
  const node = control(id);
  node.dispatchEvent(pointer('pointerdown'));
  await sleep(ms);
  node.dispatchEvent(pointer('pointerup'));
  await sleep(40);
}

/** 长按半秒：模拟机上的“按住”（出现黑圈），接着再 tap 第二个键就是组合键 */
const hold = (id) => tap(id, 520);

/** 转旋钮：dir = 1 往上（顺时针），-1 往下；n = 转几格 */
async function turn(id, dir = 1, n = 1) {
  for (let i = 0; i < n; i++) {
    control(id).dispatchEvent(new WheelEvent('wheel', { deltaY: dir > 0 ? -100 : 100, bubbles: true, cancelable: true }));
    await sleep(30);
  }
}

// ───────────── 音游 ─────────────

async function waitButton(pattern, ms = 40000) {
  const end = performance.now() + ms;
  for (;;) {
    const button = [...document.querySelectorAll('.game-card .btn')].find((x) => pattern.test(x.textContent.trim()));
    if (button || performance.now() > end) return button || null;
    await sleep(250);
  }
}

/**
 * 把当前这一段打一遍：点“开始”（或“再来一次”），在每个音该落下的时刻替你按键，等结算。
 * hit(lane, target) 不给就用电脑键盘；给了就由它来出声（比如让假真机按键）。返回成绩。
 * via = 点哪个按钮来开始。传 /^继续$/ 就是“上一段过了，点继续进下一段并接着打”（下一段是自动开始的）。
 * 虚拟机里音频的输出延迟不稳，头一局的成绩有时会偏低几十毫秒，再打一遍就正常：那是测试环境的事，不是音游的事。
 */
async function playStage(chartId, hit, { via = /^(开始|再来一次)$/ } = {}) {
  const chart = normalizeChart(chartById(chartId));
  const button = await waitButton(via);
  if (!button) return { error: `没有找到按钮 ${via}` };
  button.click();
  await Promise.resolve();
  const bpm = Number(/(\d+) BPM/.exec(document.querySelector('.game-sub').textContent)[1]);
  const spb = 60 / bpm;
  const beat0 = audio.now() + 0.25 + 4 * spb; // 预备拍数完、正式开始的那一刻（音频时钟）
  // 页面刚开声的头一两秒，“音频时钟 ↔ 页面时钟”的换算还没稳（会差几十毫秒）：等预备拍响过一半再换算
  await sleep(Math.min(1200, 2 * spb * 1000));
  const t0 = audio.ctxToPerf(beat0);
  for (const target of chart.targets) {
    const lane = chart.lanes[target.lane];
    setTimeout(() => (hit ? hit(lane, target) : window.dispatchEvent(new KeyboardEvent('keydown', { key: lane.key, bubbles: true }))), t0 + target.beat * spb * 1000 - performance.now());
  }
  await sleep((chart.totalBeats + 1.2) * spb * 1000 + (t0 - performance.now()) + 500);
  const card = document.querySelector('.game-card.result');
  const acc = card?.querySelector('.result-acc'); // 丰富档下这个数字是滚上去的，最终的数写在 data-final 上
  return { accuracy: acc?.dataset.final || acc?.textContent, counts: card?.querySelector('.result-counts')?.textContent, timing: card?.querySelector('.result-timing')?.textContent, lanes: chart.lanes.map((l) => l.label) };
}

/** 结算卡片上的“继续”（进入下一段，或者进入下一步） */
async function cont() {
  const button = [...document.querySelectorAll('.game-card .btn.primary')].find((x) => x.textContent.trim() === '继续');
  button?.click();
  await sleep(400);
  return !!button;
}

/** 跳到第 i 段（0 看示范 / 1 跟打 / 2 独奏） */
async function pill(i) {
  document.querySelectorAll('.stage-pill')[i]?.click();
  await sleep(300);
}

/** 接着真机时，音游上面那张“开打之前”的检查卡片 */
function check() {
  return {
    head: document.querySelector('.game-check .label')?.textContent,
    items: [...document.querySelectorAll('.game-check .mirror-try li')].map((li) => (li.classList.contains('done') ? '✓ ' : '✗ ') + li.innerText.replace(/\s+/g, ' ').slice(0, 100)),
  };
}

// ───────────── 假真机 ─────────────

/**
 * 假装机器在播放：发时钟，并在指定的步上让合成器轨响一个键。用来测“合成器轨的编程挑战”（真机上要播一遍才核对得了）。
 * notes = { 第几步（从 0 起）: [第几个 Synth key, 通道] }，bars = 播几小节，loopSteps = 一圈多少步。
 * start = false 时不替你按 [PLAY]（应用自己发了开始的时候用，比如点了“让机器播一遍并检查”之后）。
 */
async function fakePlay(notes, bars = 2.1, { loopSteps = 16, start = true } = {}) {
  const fake = window.__app.fake;
  if (start) fake.play();
  const ticks = Math.round(bars * 96);
  for (let i = 0; i < ticks; i++) {
    midi.simulate([0xf8]);
    if (i % 6 === 0) {
      const n = notes[(i / 6) % loopSteps];
      if (n) fake.chordKey(n[0], n[1], { withKey: false });
    }
    await sleep(4);
  }
  if (start) fake.stop();
  await sleep(200);
}

const api = { sleep, errors, step, next, go, manual, result, tap, hold, turn, playStage, cont, pill, check, fakePlay };

/** 装上：顶替 rAF、开始收集报错，并把工具挂到 window.__walk。 */
export function install({ raf = true } = {}) {
  if (!window.__walk) {
    if (raf) patchRaf();
    watchErrors();
    window.__walk = api;
  }
  return window.__walk;
}
