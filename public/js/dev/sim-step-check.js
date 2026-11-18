// 开发用：检查模拟机的两样本事——鼓轨每一步的力度（按住亮着的方键转旋钮 4）、鼓轨的乐句长度按步改（按住 [PAGE] 转鼓轨旋钮），
// 以及小课堂“用在机器上”认不认得出它们（classroom-bits.js 的 STEP_LEN / STEP_VEL，R9 的机器步）。
// 平时应用不加载它。它有自己的页面 /js/dev/sim-step-check.html（不经过 main.js，不读不写学习进度），由 tools/sim-step-check.sh 在 Mac 上无界面的 Chrome 里打开：
//   不带参数      把下面的断言都跑一遍，结果写在页面最下面的 <pre id="check-result">（JSON：每条 { group, name, ok, detail }）
//   ?shot=名字    不跑断言，只把模拟机摆成某个样子停住，给截图用（名字见最下面的 SHOTS）；?skin=neon 换霓虹配色
// 手势用的是 dev/walkthrough.js 的 tap / hold / turn（鼠标的按下、松开、滚轮），键盘学习方式那一组自己发电脑键盘的事件。
// 声音：无界面的浏览器里出不了声，这里把 audio.drum 换成“记下来”，看每一下是照多大的力度放的。好不好听这里验证不了。
import { h } from '../util.js';
import { simulator, SIM_VEL_DEFAULT } from '../simulator.js';
import { audio } from '../audio.js';
import { learn } from '../learn-mode.js';
import { initKeyboard } from '../keyboard.js';
import { keyOf, codeOf } from '../keymap.js';
import { createBench } from '../classroom-bench.js';
import { mirror } from '../mirror.js';
import { RHYTHM } from '../content/cl-rhythm.js';
import { PICK, STEPS, PLAY, STOP, STEP_LEN, STEP_VEL } from '../content/classroom-bits.js';
import { install } from './walkthrough.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 3000) => {
  const end = performance.now() + ms;
  while (performance.now() < end) {
    if (fn()) return true;
    await sleep(50);
  }
  return !!fn();
};
const params = new URLSearchParams(location.search);
const host = document.getElementById('host');
const w = install();

// ───────────── 记结果 ─────────────

const results = [];
const says = [];
let group = '';
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ok = (name, cond, detail = '') => results.push({ group, name, ok: !!cond, detail: cond ? '' : String(detail) });
const eq = (name, got, want) => ok(name, same(got, want), `得到 ${JSON.stringify(got)}，应该是 ${JSON.stringify(want)}`);
const noteSay = (label) => says.push({ label, say: simulator.lastSay });

// ───────────── 看灯、看声音、看事件 ─────────────

const LED = { '#ffd21f': 'yellow', '#ffffff': 'white', '#18d7e0': 'cyan', '#b56bff': 'purple', '#3d7bff': 'blue', '#ff3b30': 'red', '#34d058': 'green', '#ff8a3d': 'orange' };
/** 第 n 个方键的灯现在是什么颜色（'off' = 不亮） */
const dk = (n) => LED[simulator.panel.svg.querySelector(`[data-id="DK${n}"] rect[width="20"]`).getAttribute('fill')] || 'off';
const dks = (list) => list.map(dk);
/** 16 个方键里各种颜色的是第几个：{ white: [1, 2, 3] } */
const dkMap = () => {
  const out = {};
  for (let n = 1; n <= 16; n++) if (dk(n) !== 'off') (out[dk(n)] ||= []).push(n);
  return out;
};
/** 右边那列小灯里亮着的（从下往上数第几个）：[[1, 'white'], [2, 'white']] */
const meter = () => [...simulator.panel.svg.querySelectorAll('[data-id="METER"] circle')].map((c, i) => [8 - i, LED[c.getAttribute('fill')]]).filter(([, c]) => c).reverse();
const indexLit = (word) => [...simulator.panel.svg.querySelectorAll('[data-id="INDEX"] text')].find((t) => t.textContent === word)?.getAttribute('fill') === '#ffffff';
const heldRings = () => simulator.panel.svg.querySelectorAll('g[pointer-events="none"]')[1]?.children.length || 0;

// 把“放一声鼓”换成记下来：{ lane, vel, raw }（raw = 音序器走到第几步时放的；不是音序器放的是 null）
const drumCalls = [];
let rawStep = null;
audio.drum = (lane, time, vel) => drumCalls.push({ lane, vel: Math.round(vel * 1000) / 1000, raw: rawStep });
const playerSchedule = simulator.player.onSchedule;
simulator.player.onSchedule = (s, t) => {
  rawStep = s;
  try {
    playerSchedule(s, t);
  } finally {
    rawStep = null;
  }
};
/** 让音序器把第 from … from + n − 1 步各走一下（不等时钟），返回这期间放的鼓 */
const schedule = (from, n) => {
  drumCalls.length = 0;
  for (let s = from; s < from + n; s++) simulator.player.onSchedule(s, 0);
  return drumCalls.filter((c) => c.raw !== null);
};
const hitsOf = (calls, lane) => calls.filter((c) => c.lane === lane).map((c) => c.raw);

const events = [];
simulator.on('event', (e) => events.push(e));
const evs = (type) => events.filter((e) => e.type === type);

/** 模拟机回到刚开箱的样子，翻到 4 号工程（空白的：只有孤零零的一下底鼓），挂到页面上 */
function fresh() {
  simulator.reset();
  simulator.gotoProject(3);
  host.replaceChildren(simulator.mount());
  events.length = 0;
}
const sim = simulator;
const vol = (t) => sim.proj.mix[t].vol;

// ───────────── 电脑键盘 ─────────────

const key = (code, type) => window.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true }));
const kdown = (id) => key(codeOf(id), 'keydown');
const kup = (id) => key(codeOf(id), 'keyup');
const press = async (id, ms = 30) => {
  kdown(id);
  await sleep(ms);
  kup(id);
  await sleep(40);
};
const arrow = async (dir, n = 1) => {
  for (let i = 0; i < n; i++) {
    key(dir > 0 ? 'ArrowUp' : 'ArrowDown', 'keydown');
    await sleep(20);
    key(dir > 0 ? 'ArrowUp' : 'ArrowDown', 'keyup');
    await sleep(90);
  }
};

// ───────────── 一组一组地查 ─────────────

/** 1. 每一步的力度（鼠标：长按出黑圈 = 按住，滚轮 = 转） */
async function velocity() {
  group = '力度';
  fresh();
  await w.tap('HAT1');
  for (const n of [1, 3, 5]) await w.tap(`DK${n}`);
  eq('HAT 1 按亮第 1、3、5 个方键', sim.stepsOf('HAT1'), [0, 2, 4]);
  const vol0 = vol('HAT1');

  await w.hold('DK3');
  ok('长按亮着的方键 = 按住它（黑圈），没有把它按灭', sim.held === 'DK3' && sim.stepsOf('HAT1').includes(2) && heldRings() > 0, `held=${sim.held} steps=${sim.stepsOf('HAT1')} rings=${heldRings()}`);
  noteSay('长按亮着的方键');
  await w.turn('SD4', 1, 1);
  const firstSay = sim.lastSay;
  await w.turn('SD4', 1, 1);
  eq('按住它转旋钮 4 两格：这一步有了力度 118（没改过的是 100，一格 9）', sim.velOf('HAT1', 2), 118);
  eq('每转一格发一个 vel 事件', evs('vel').map((e) => [e.track, e.step, e.value]), [['HAT1', 2, 109], ['HAT1', 2, 118]]);
  eq('这一步的方键紫色，别的亮着的还是黄色，没亮的不亮', dks([1, 2, 3, 4, 5]), ['yellow', 'off', 'purple', 'off', 'yellow']);
  ok('右边那列字里 VOLUME 亮', indexLit('VOLUME'));
  ok('模拟机说的话：说了紫色；头一回说明往哪边是模拟机定的、真机上手册没写；没说“真机一定”', /紫色/.test(firstSay) && /手册没写/.test(firstSay) && /紫色/.test(sim.lastSay) && !/真机一定|真机上就是/.test(firstSay + sim.lastSay), firstSay);
  says.push({ label: '头一回转旋钮 4', say: firstSay });
  eq('别的步没有力度', sim.velsOf('HAT1'), { 2: 118 });
  eq('整条轨道的音量没被改', vol('HAT1'), vol0);
  eq('没有换乐句', sim.patternOf('HAT1'), 0);
  await w.tap('DK3');
  ok('再点一下那个方键 = 松开：它还亮着、还是紫色', sim.held === null && dk(3) === 'purple' && sim.stepsOf('HAT1').includes(2), `held=${sim.held} dk3=${dk(3)}`);

  let calls = schedule(0, 16);
  eq('播放时用的是它：第 3 步照 118 放（0.9 × 118 ÷ 100 = 1.062），第 1、5 步还是原来的 0.9', calls.filter((c) => c.lane === 'HAT1').map((c) => [c.raw, c.vel]), [[0, 0.9], [2, 1.062], [4, 0.9]]);
  eq('底鼓（别的轨道）还是 0.9', calls.filter((c) => c.lane === 'KICK').map((c) => [c.raw, c.vel]), [[0, 0.9]]);

  // 没亮的方键不行
  await w.hold('DK2');
  const heldAfter = sim.held;
  await w.turn('SD4', 1, 2);
  ok('没亮的方键长按不算按住（按下去是把它按亮），转旋钮 4 不给它力度', heldAfter === null && sim.velOf('HAT1', 1) === null && dk(2) === 'yellow', `held=${heldAfter} vel=${sim.velOf('HAT1', 1)} dk2=${dk(2)}`);
  await w.tap('DK2');
  eq('把它按灭', sim.stepsOf('HAT1'), [0, 2, 4]);

  // 往下是轻，到头
  await w.hold('DK5');
  await w.turn('SD4', -1, 3);
  eq('往下转三格：100 → 73', sim.velOf('HAT1', 4), 73);
  await w.turn('SD4', -1, 12);
  eq('一直往下：到 1 为止', sim.velOf('HAT1', 4), 1);
  noteSay('转到头');
  await w.turn('SD4', 1, 20);
  eq('一直往上：到 127 为止', sim.velOf('HAT1', 4), 127);
  // 按住时转别的旋钮：不改东西，也不会 11 条轨道一起换乐句
  await w.turn('SD2', 1, 1);
  await w.turn('ALL', 1, 1);
  ok('按住一步时转别的旋钮（旋钮 2、ALL）：什么都不改，只说一句', sim.velOf('HAT1', 4) === 127 && sim.patternOf('KICK') === 0 && sim.patternOf('HAT1') === 0 && sim.held === 'DK5', `pat=${sim.patternOf('KICK')} held=${sim.held}`);
  await w.tap('DK5');
  // 旋钮翻到第 2 页：旋钮 4 不是 VOLUME
  await w.tap('SDPAGE');
  await w.hold('DK1');
  await w.turn('SD4', 1, 2);
  ok('4 个旋钮在第 2 页时，按住一步转旋钮 4 不改力度', sim.sdPage === 1 && sim.velOf('HAT1', 0) === null, `sdPage=${sim.sdPage} vel=${sim.velOf('HAT1', 0)}`);
  await w.tap('DK1');
  await w.tap('SDPAGE');
  eq('翻回第 1 页', sim.sdPage, 0);

  calls = schedule(16, 16);
  eq('再放一圈：三步各是各的力度（0.9、1.062、1.143）', calls.filter((c) => c.lane === 'HAT1').map((c) => [c.raw, c.vel]), [[16, 0.9], [18, 1.062], [20, 1.143]]);

  // 按灭这一步，力度也没了
  await w.tap('DK3');
  eq('短按紫色的方键 = 按灭，它的力度一起清掉', [sim.stepsOf('HAT1'), sim.velsOf('HAT1'), sim.proj.vel.HAT1[0].has(2)], [[0, 4], { 4: 127 }, false]);
  noteSay('按灭锁过力度的一步');
  await w.tap('DK3');
  eq('再按亮：没有力度锁，黄色', [sim.velOf('HAT1', 2), dk(3)], [null, 'yellow']);

  // [DELETE] + 旋钮 4：清掉这段乐句里所有的力度锁
  await w.hold('DK3');
  await w.turn('SD4', -1, 1);
  await w.tap('DK3');
  eq('再锁一步：现在两步有力度', sim.velsOf('HAT1'), { 2: 91, 4: 127 });
  await w.hold('DELETE');
  await w.tap('SD4');
  eq('按住 [DELETE] 再按旋钮 4：这段乐句里的力度锁全清，格子还在', [sim.velsOf('HAT1'), sim.stepsOf('HAT1'), dks([1, 3, 5])], [{}, [0, 2, 4], ['yellow', 'yellow', 'yellow']]);

  // 清空乐句
  await w.hold('DK1');
  await w.turn('SD4', 1, 1);
  await w.tap('DK1');
  await w.hold('DELETE');
  await w.tap('HAT1');
  await w.tap('DK1');
  eq('按住 [DELETE] 再按 HAT 1 清空乐句：力度也清了（再按亮第 1 个，没有锁）', [sim.stepsOf('HAT1'), sim.velOf('HAT1', 0), sim.proj.vel.HAT1[0].size], [[0], null, 0]);

  // [BAR LENGTH] 加长时照抄，力度一起抄
  await w.tap('SNARE');
  await w.tap('DK5');
  await w.hold('DK5');
  await w.turn('SD4', -1, 2);
  await w.tap('DK5');
  await w.tap('BARLENGTH');
  eq('[BAR LENGTH] 加长到 2 小节：第 2 小节照抄，那一步的力度也抄过去', [sim.barsOf('SNARE'), sim.stepsOf('SNARE'), sim.velsOf('SNARE')], [2, [4, 20], { 4: 82, 20: 82 }]);
}

/** 2. 复制粘贴、临时保存带着走 */
async function carry() {
  group = '带着走';
  fresh();
  await w.tap('HAT1');
  for (const n of [1, 3]) await w.tap(`DK${n}`);
  await w.hold('DK3');
  await w.turn('SD4', 1, 2);
  await w.tap('DK3');
  await w.hold('PAGE');
  await w.turn('HAT1', -1, 4);
  await w.tap('PAGE');
  eq('准备：HAT 1 第 1 段亮第 1、3 步，第 3 步力度 118，乐句 12 步', [sim.stepsOf('HAT1'), sim.velsOf('HAT1'), sim.lengthOf('HAT1')], [[0, 2], { 2: 118 }, 12]);

  await w.hold('HAT1');
  await w.tap('DK1', 2150); // 按住轨道旋钮，长按方键 2 秒 = 复制这一段
  eq('复制第 1 段', evs('patterncopy').map((e) => [e.track, e.pattern]), [['HAT1', 0]]);
  await w.hold('HAT1');
  await w.tap('PAGE');
  await w.tap('DK2'); // 再按住 [PAGE] 按方键 = 贴到那一段
  eq('贴到第 2 段', evs('patternpaste').map((e) => [e.track, e.pattern]), [['HAT1', 1]]);
  await w.turn('HAT1', 1, 1);
  eq('转到第 2 段：格子、那一步的力度、12 步的长度都跟过来了', [sim.patternOf('HAT1'), sim.stepsOf('HAT1'), sim.velsOf('HAT1'), sim.lengthOf('HAT1'), dks([1, 3])], [1, [0, 2], { 2: 118 }, 12, ['yellow', 'purple']]);
  await w.hold('DK3');
  await w.turn('SD4', -1, 5);
  await w.tap('DK3');
  await w.turn('HAT1', -1, 1);
  eq('在第 2 段上再改，第 1 段不跟着变（各是各的一份）', [sim.patternOf('HAT1'), sim.velOf('HAT1', 2)], [0, 118]);

  await w.hold('PROJECT');
  await w.tap('DK4'); // 4 号工程是现在这个：临时保存
  eq('临时保存', evs('tempsave').length, 1);
  await w.hold('DK3');
  await w.turn('SD4', -1, 4);
  await w.tap('DK3');
  await w.hold('PAGE');
  await w.turn('HAT1', -1, 7);
  await w.tap('PAGE');
  await w.tap('DK1');
  eq('保存之后改乱：力度 82、5 步、第 1 步按灭', [sim.velOf('HAT1', 2), sim.lengthOf('HAT1'), sim.stepsOf('HAT1')], [82, 5, [2]]);
  await w.hold('PROJECT');
  await w.tap('DK12'); // 正下方那个：恢复
  eq('恢复：力度、长度、格子都回到保存时的样子', [evs('temprestore').length, sim.velsOf('HAT1'), sim.lengthOf('HAT1'), sim.stepsOf('HAT1')], [1, { 2: 118 }, 12, [0, 2]]);
  await w.turn('HAT1', 1, 1);
  eq('恢复之后第 2 段也是保存时的样子（73）', [sim.velOf('HAT1', 2), sim.lengthOf('HAT1')], [73, 12]);
}

/** 3. 乐句长度按步改 */
async function length() {
  group = '长度';
  fresh();
  await w.tap('HAT1');
  for (const n of [1, 3, 5, 7, 9, 11, 13, 15]) await w.tap(`DK${n}`);
  const selBefore = sim.sel;
  await w.hold('PAGE');
  ok('长按 [PAGE] = 按住它（黑圈）', sim.held === 'PAGE');
  events.length = 0;
  await w.turn('HAT1', -1, 13);
  eq('按住 [PAGE] 转 HAT 1 旋钮 13 格：16 步 → 3 步', [sim.lengthOf('HAT1'), sim.barsOf('HAT1')], [3, 1]);
  eq('每转一格发一个 length 事件（steps = 现在几步）', [evs('length').length, evs('length').at(-1)], [13, { type: 'length', track: 'HAT1', bars: 1, steps: 3, by: 'page' }]);
  eq('没有换乐句，选中的轨道没变，[PAGE] 还按着', [sim.patternOf('HAT1'), evs('pattern').length, sim.sel, sim.held], [0, 0, selBefore, 'PAGE']);
  eq('按住 [PAGE] 的时候：方键上白色亮着前 3 个 = 3 步，别的不亮', dkMap(), { white: [1, 2, 3] });
  eq('右边那列小灯：最下面 1 个白色 = 1 小节', meter(), [[1, 'white']]);
  const edged = (n) => sim.panel.svg.querySelector(`[data-id="DK${n}"] rect[width="20"]`).hasAttribute('stroke');
  eq('数步数的白灯画了一圈深色的边（白灯在浅色键帽上不显眼），没亮的没有', [edged(1), edged(3), edged(4)], [true, true, false]);
  noteSay('转到 3 步');
  ok('模拟机说的话：说了几步，没替真机下断言', /3 步/.test(sim.lastSay) && !/真机一定|真机也/.test(sim.lastSay), sim.lastSay);
  eq('别的轨道的长度没动', [sim.lengthOf('KICK'), sim.lengthOf('SNARE'), sim.lengthOf('SYNTH1')], [16, 16, 16]);
  await w.tap('PAGE');
  eq('松开 [PAGE]：方键回到平时的样子——范围以内亮着的（第 1、3 步）黄色，范围以外的不亮', [sim.held, dkMap()], [null, { yellow: [1, 3] }]);
  eq('stepsOf 只给范围以内的', sim.stepsOf('HAT1'), [0, 2]);
  eq('松开以后那圈边也没了', [edged(1), edged(3)], [false, false]);

  let calls = schedule(0, 48);
  eq('播放：HAT 1 自己 3 步一圈（每 3 步里的第 1、3 步响）', hitsOf(calls, 'HAT1'), Array.from({ length: 48 }, (_, i) => i).filter((s) => s % 3 !== 1));
  eq('别的轨道还是 16 步一圈（底鼓在第 0、16、32 步）', hitsOf(calls, 'KICK'), [0, 16, 32]);

  await w.tap('DK5');
  ok('范围以外的方键：按了不亮，也不往里填（原来在那里的音留着）', dk(5) === 'off' && sim.proj.drums.HAT1[0].has(4) && same(sim.stepsOf('HAT1'), [0, 2]) && /范围以外/.test(sim.lastSay), `dk5=${dk(5)} say=${sim.lastSay}`);
  noteSay('按范围以外的方键');

  await w.hold('PAGE');
  await w.turn('HAT1', 1, 13);
  await w.tap('PAGE');
  eq('缩短再加长回 16 步：原来的 8 下镲都还在', [sim.lengthOf('HAT1'), sim.stepsOf('HAT1'), sim.proj.stepLen.HAT1[0]], [16, [0, 2, 4, 6, 8, 10, 12, 14], null]);

  await w.hold('PAGE');
  await w.turn('HAT1', -1, 4);
  eq('转到 12 步', [sim.lengthOf('HAT1'), dkMap(), meter()], [12, { white: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }, [[1, 'white']]]);
  await w.tap('PAGE');
  calls = schedule(0, 48);
  eq('播放：HAT 1 12 步一圈（6 下镲），底鼓 16 步一圈', [hitsOf(calls, 'HAT1').length, hitsOf(calls, 'HAT1').slice(0, 8), hitsOf(calls, 'KICK')], [24, [0, 2, 4, 6, 8, 10, 12, 14], [0, 16, 32]]);
  eq('12 步的时候第 13 步（下一圈的第 1 步）响的是第 1 步', hitsOf(calls, 'HAT1').includes(12) && hitsOf(calls, 'HAT1').includes(13) === false, true);

  // 超过一小节
  await w.hold('PAGE');
  await w.turn('HAT1', 1, 8);
  eq('加长到 20 步：2 小节的范围，方键上是最后一页的 4 步，小灯亮 2 个', [sim.lengthOf('HAT1'), sim.barsOf('HAT1'), dkMap(), meter()], [20, 2, { white: [1, 2, 3, 4] }, [[1, 'white'], [2, 'white']]]);
  await w.tap('PAGE');
  eq('跨进第 2 小节时照着第 1 小节抄了一份：范围以内多了第 17、19 步', sim.stepsOf('HAT1'), [0, 2, 4, 6, 8, 10, 12, 14, 16, 18]);
  events.length = 0;
  await w.tap('PAGE');
  eq('单按 [PAGE] 翻页（老行为）：翻到第 2 页，第 17、19 步亮，第 21 步起不亮', [sim.page, evs('page').map((e) => e.page), dkMap()], [1, [1], { yellow: [1, 3] }]);
  noteSay('20 步时翻到第 2 页');
  await w.tap('PAGE');
  eq('再按一次回到第 1 页', [sim.page, dkMap()], [0, { yellow: [1, 3, 5, 7, 9, 11, 13, 15] }]);

  // [BAR LENGTH]：按步改过的先补满；整小节的还是 1 → 2 → 4 → 8 → 1
  events.length = 0;
  await w.tap('BARLENGTH');
  eq('20 步时按 [BAR LENGTH]：补满到 2 小节（32 步），零头清掉', [sim.barsOf('HAT1'), sim.lengthOf('HAT1'), sim.proj.stepLen.HAT1[0], evs('length').at(-1)], [2, 32, null, { type: 'length', track: 'HAT1', bars: 2, steps: 32 }]);
  noteSay('20 步时按 [BAR LENGTH]');
  await w.tap('BARLENGTH');
  await w.tap('BARLENGTH');
  eq('再按两下：4 小节、8 小节', [sim.barsOf('HAT1'), sim.lengthOf('HAT1')], [8, 128]);
  await w.hold('PAGE');
  await w.turn('HAT1', 1, 3);
  eq('已经 128 步：再往上转不动', sim.lengthOf('HAT1'), 128);
  await w.tap('PAGE');
  await w.tap('BARLENGTH');
  eq('8 小节再按 [BAR LENGTH]：回到 1 小节', [sim.barsOf('HAT1'), sim.lengthOf('HAT1'), sim.stepsOf('HAT1')], [1, 16, [0, 2, 4, 6, 8, 10, 12, 14]]);
  await w.hold('PAGE');
  await w.turn('HAT1', -1, 20);
  eq('往下转到头：最短 1 步', [sim.lengthOf('HAT1'), dkMap()], [1, { white: [1] }]);
  await w.turn('HAT1', 1, 2);
  // 转完直接去按别的键：[PAGE] 当已经松开，那个键照常起作用
  await w.tap('PLAY');
  ok('改完长度没松 [PAGE] 直接按 [PLAY]：[PAGE] 自己松开，机器放起来了', sim.playing && sim.held === null, `playing=${sim.playing} held=${sim.held}`);
  await sleep(500);
  ok('真的放起来之后，音序器在放鼓（无界面的浏览器里没有声音，只看有没有去放）', drumCalls.some((c) => c.raw !== null && c.lane === 'HAT1'), JSON.stringify(drumCalls.slice(0, 4)));
  await w.tap('PLAY');
  eq('再按一下停下', sim.playing, false);

  // 老行为：整小节的鼓轨、合成器轨的 [BAR LENGTH]
  fresh();
  await w.tap('KICK');
  await w.tap('DK5');
  events.length = 0;
  const seen = [];
  for (let i = 0; i < 5; i++) {
    await w.tap('BARLENGTH');
    seen.push([sim.barsOf('KICK'), sim.lengthOf('KICK'), sim.stepsOf('KICK').length]);
  }
  eq('整小节的鼓轨按 [BAR LENGTH]：1 → 2 → 4 → 8 → 1 → 2，加长时照抄（底鼓 2 下 → 4 → 8 → 16 → 回到 2 → 4）', seen, [[2, 32, 4], [4, 64, 8], [8, 128, 16], [1, 16, 2], [2, 32, 4]]);
  eq('[BAR LENGTH] 发的 length 事件和原来一样（bars、steps）', evs('length').map((e) => [e.track, e.bars, e.steps, e.by ?? null]), [['KICK', 2, 32, null], ['KICK', 4, 64, null], ['KICK', 8, 128, null], ['KICK', 1, 16, null], ['KICK', 2, 32, null]]);
  eq('2 小节时的格子：第 1 小节的两下抄到了第 2 小节', sim.stepsOf('KICK'), [0, 4, 16, 20]);
  await w.tap('PAGE');
  eq('单按 [PAGE] 翻到第 2 页', [sim.page, dkMap()], [1, { yellow: [1, 5] }]);
  await w.tap('PAGE');
  await w.tap('SNARE');
  await w.tap('PAGE');
  ok('只有 1 小节时单按 [PAGE]：不翻页，说“只有 16 步”', sim.page === 0 && /只有 16 步，一页就放得下/.test(sim.lastSay), sim.lastSay);

  // 合成器轨：步进输入里的格子灯、[BAR LENGTH]
  await w.hold('PAGE');
  await w.tap('SYNTH1');
  await w.tap('SK1');
  await w.tap('DK1');
  await w.tap('DK5');
  eq('合成器轨的步进输入：放进去的两步亮青蓝色', [sim.stepMode, sim.stepsOf('SYNTH1'), dkMap()], ['SYNTH1', [0, 4], { cyan: [1, 5] }]);
  await w.tap('BARLENGTH');
  eq('合成器轨按 [BAR LENGTH]：2 小节，照抄', [sim.barsOf('SYNTH1'), sim.lengthOf('SYNTH1'), sim.stepsOf('SYNTH1')], [2, 32, [0, 4, 16, 20]]);
  await w.hold('PAGE');
  await w.turn('SYNTH1', -1, 2);
  eq('按住 [PAGE] 转合成器轨的旋钮：不改它的长度（方法 B 只管鼓轨）', sim.lengthOf('SYNTH1'), 32);
  if (sim.held) await w.tap(sim.held);

  // Song / scene 的长度
  await w.tap('HAT1');
  await w.hold('PAGE');
  await w.turn('HAT1', -1, 4);
  await w.tap('PAGE');
  await w.hold('ALL');
  await w.tap('PROJECT');
  eq('进 Song 模式：这个 scene 的长度是 AUTO = 最长的那段乐句（按小节数算：KICK 2 小节 = 32 步）', [sim.songMode, sim.sceneOf().auto, sim.sceneOf().len], [1, true, 32]);
  await w.hold('PAGE');
  await w.turn('ALL', 1, 1);
  eq('Song 模式里按住 [PAGE] 转 ALL：改 scene 的长度（老行为：AUTO 往上一格是 1 拍）', [sim.sceneOf().auto, sim.sceneOf().len], [false, 4]);
  await w.turn('ALL', -1, 1);
  eq('转回 AUTO', [sim.sceneOf().auto, sim.sceneOf().len], [true, 32]);
  if (sim.held) await w.tap(sim.held);
  await w.hold('PAGE');
  await w.turn('HAT1', -1, 2);
  eq('Song 模式里按住 [PAGE] 转鼓轨旋钮：不改它的长度', sim.lengthOf('HAT1'), 12);
  if (sim.held) await w.tap(sim.held);
  await w.hold('ALL');
  await w.tap('PROJECT');
  await w.hold('ALL');
  await w.tap('PROJECT');
  eq('退出 Song / Scene 模式', sim.songMode, 0);
}

/** 用鼠标拖一个旋钮：按下去（面板会报“按下”）、上下拖 n 格、松手。和滚轮不一样的地方是多了按下、松开那两下 */
async function drag(id, dir, n) {
  const node = document.querySelector(`.sim [data-id="${id}"]`);
  let y = 300;
  const pe = (type) => node.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, clientY: y }));
  pe('pointerdown');
  await sleep(40);
  for (let i = 0; i < n; i++) {
    y -= dir * 16;
    pe('pointermove');
    await sleep(30);
  }
  pe('pointerup');
  await sleep(40);
}

/** 3b. 同样的事，旋钮不用滚轮、用鼠标拖（真人多半这样做） */
async function dragging() {
  group = '用鼠标拖';
  fresh();
  await w.tap('HAT1');
  for (const n of [1, 3, 5]) await w.tap(`DK${n}`);
  const vol0 = vol('HAT1');
  await w.hold('DK3');
  await drag('SD4', 1, 2);
  eq('按住亮着的方键，拖旋钮 4 两格：这一步力度 118，方键还按着，整条轨道的音量没动', [sim.velOf('HAT1', 2), sim.held, vol('HAT1'), dk(3)], [118, 'DK3', vol0, 'purple']);
  await drag('SD4', -1, 3);
  eq('再往下拖三格：91', sim.velOf('HAT1', 2), 91);
  await w.tap('DK3');
  eq('再点一下松开，这一步还在', [sim.held, sim.stepsOf('HAT1')], [null, [0, 2, 4]]);

  await w.tap('KICK');
  await w.hold('PAGE');
  await w.tap('HAT1');
  eq('按住 [PAGE] 以后头一下只是点了点 HAT 1 旋钮（没拖）：不改长度，不选中它，[PAGE] 还按着', [sim.lengthOf('HAT1'), sim.sel, sim.held], [16, 'KICK', 'PAGE']);
  await drag('HAT1', -1, 4);
  eq('按住 [PAGE] 拖 HAT 1 旋钮四格：12 步，[PAGE] 还按着，选中的还是 KICK，没有换乐句', [sim.lengthOf('HAT1'), sim.held, sim.sel, sim.patternOf('HAT1')], [12, 'PAGE', 'KICK', 0]);
  await drag('SNARE', -1, 2);
  eq('接着拖 SNARE 旋钮：改的是 SNARE（14 步），HAT 1 不动', [sim.lengthOf('SNARE'), sim.lengthOf('HAT1'), sim.held], [14, 12, 'PAGE']);
  await w.tap('CLAP');
  eq('改完了点一下 CLAP 旋钮：[PAGE] 自己松开，选中 CLAP，它的长度没动', [sim.held, sim.sel, sim.lengthOf('CLAP')], [null, 'CLAP', 16]);
  await drag('HAT1', 1, 1);
  eq('[PAGE] 松开以后再拖 HAT 1 旋钮：是老样子，换乐句', [sim.patternOf('HAT1'), sim.proj.stepLen.HAT1[0]], [1, 12]);
  await drag('HAT1', -1, 1);

  // 采样器的步进输入：按住一步拖旋钮 2 = 只给这一步锁音高（以前按下旋钮那一下会把步进键松开，只有滚轮能锁）
  await w.hold('PAGE');
  await w.tap('SAMPLER');
  await w.tap('SK5');
  await w.tap('DK1');
  await w.tap('DK9');
  eq('采样器进步进输入，放两步：亮青蓝', [sim.stepMode, sim.stepsOf('SAMPLER'), dkMap()], ['SAMPLER', [0, 8], { cyan: [1, 9] }]);
  await w.hold('DK9');
  await drag('SD2', -1, 2);
  eq('按住第 9 步拖旋钮 2 两格：只有这一步锁了音高（−2），步进键还按着，这个采样位自己的音高没动', [sim.proj.synth.SAMPLER[0].get(8).lock, sim.proj.synth.SAMPLER[0].get(0).lock ?? null, sim.held, sim.paramOf('SAMPLER', 'pitch'), evs('plock').length], [-2, null, 'DK9', 0, 2]);
  await w.tap('DK9');
  eq('松开：锁过音高的那一步紫色，另一步青蓝', dkMap(), { cyan: [1], purple: [9] });
  await w.hold('PAGE');
  await w.tap('SAMPLER');
  eq('退出步进输入', sim.stepMode, null);
}

/** 4. 电脑键盘学习方式 */
let kbdReady = false;
function readyKeyboard() {
  if (!kbdReady) initKeyboard(); // 只装一次：装两次的话每一下键盘会被接两回
  kbdReady = true;
}
async function keyboard() {
  group = '键盘';
  readyKeyboard();
  learn.set(true);
  fresh();
  ok('键盘学习方式开着', sim.keyboard === true);
  await press('HAT1');
  for (const n of [1, 3, 5]) await press(`DK${n}`);
  eq('按 〔V〕 选中 HAT 1，按 〔Q〕〔E〕〔T〕 按亮第 1、3、5 个方键', [sim.sel, sim.stepsOf('HAT1')], ['HAT1', [0, 2, 4]]);

  kdown('DK3');
  await sleep(150);
  await arrow(1, 2);
  eq('按住亮着的 〔E〕 再按 〔↑〕 两下：第 3 步力度 118', [sim.held, sim.velOf('HAT1', 2), evs('vel').length], ['DK3', 118, 2]);
  ok('说的是键盘的说法（〔↑〕 是重）', /〔↑〕 是重/.test(sim.lastSay) || /松开方键/.test(sim.lastSay), sim.lastSay);
  noteSay('键盘：按住亮着的方键按 ↑');
  kup('DK3');
  await sleep(80);
  eq('松手：这一步没有被按灭，紫色，没有换乐句', [sim.held, sim.stepsOf('HAT1'), dk(3), sim.patternOf('KICK'), sim.patternOf('HAT1')], [null, [0, 2, 4], 'purple', 0, 0]);
  await arrow(1, 1);
  eq('什么都没按着时按 〔↑〕：不改东西', [sim.velOf('HAT1', 2), sim.patternOf('HAT1')], [118, 0]);

  await press('DK3');
  eq('短按紫色的 〔E〕：按灭，力度清掉', [sim.stepsOf('HAT1'), sim.velsOf('HAT1')], [[0, 4], {}]);

  kdown('DK2');
  await sleep(150);
  await arrow(1, 2);
  eq('按着没亮的 〔W〕（按下去才亮的）按 〔↑〕：不给它力度，也不会 11 条轨道一起换乐句', [sim.velOf('HAT1', 1), sim.patternOf('KICK'), sim.patternOf('SYNTH1'), sim.stepsOf('HAT1')], [null, 0, 0, [0, 1, 4]]);
  noteSay('键盘：按着刚按亮的方键按 ↑');
  kup('DK2');
  await sleep(80);
  await press('DK2');
  eq('把它按灭', sim.stepsOf('HAT1'), [0, 4]);

  // 长度：按住 3（[PAGE]），再按住 V（HAT 1），按 ↓
  await press('KICK');
  events.length = 0;
  kdown('PAGE');
  await sleep(320);
  kdown('HAT1');
  await sleep(120);
  await arrow(-1, 13);
  eq('按住 〔3〕（[PAGE]）再按住 〔V〕 按 〔↓〕 13 下：HAT 1 变成 3 步', [sim.lengthOf('HAT1'), evs('length').length, dkMap(), meter()], [3, 13, { white: [1, 2, 3] }, [[1, 'white']]]);
  noteSay('键盘：改长度');
  kup('HAT1');
  await sleep(60);
  kup('PAGE');
  await sleep(80);
  eq('都松开：没有翻页、没有换乐句、选中的还是 KICK（按着 [PAGE] 按轨道键不算选中它）', [sim.held, sim.page, sim.patternOf('HAT1'), evs('pattern').length, evs('page').length, sim.sel], [null, 0, 0, 0, 0, 'KICK']);
  kdown('HAT1');
  await sleep(300);
  await arrow(1, 1);
  kup('HAT1');
  await sleep(80);
  eq('没按 [PAGE]、只按着 〔V〕 按 〔↑〕：还是老样子，换到第 2 段乐句', [sim.patternOf('HAT1'), sim.proj.stepLen.HAT1[0]], [1, 3]);
  kdown('HAT1');
  await sleep(300);
  await arrow(-1, 1);
  kup('HAT1');
  await sleep(80);
  kdown('PAGE');
  await sleep(320);
  kdown('HAT1');
  await sleep(120);
  await arrow(1, 9);
  kup('HAT1');
  kup('PAGE');
  await sleep(80);
  eq('再用键盘加长到 12 步', [sim.patternOf('HAT1'), sim.lengthOf('HAT1')], [0, 12]);
  await press('PAGE');
  ok('单按 〔3〕 还是翻页键（这里只有一页：说只有 16 步…）', sim.page === 0 && /一页就放得下/.test(sim.lastSay), sim.lastSay);
  learn.set(false);
  eq('关掉键盘学习方式', sim.keyboard, false);
}

/** 把一关的“用在机器上”从头做到尾。drive(i) = 做第 i 项；认出来了就自己往下走，5 秒没认出来就点“我做了”。返回每一项是不是自己认的 */
async function runBench(level, drive, { before } = {}) {
  let done = null;
  sim.reset();
  const b = createBench(level, { onDone: (r) => (done = r) });
  host.replaceChildren(b.el);
  await sleep(300);
  const auto = [];
  const texts = [];
  for (let i = 0; i < level.machine.tasks.length; i++) {
    texts.push(b.el.querySelector('.cl-bench-text').innerText);
    await before?.(i, b);
    await drive(i, b);
    const hit = await until(() => b.current > i, 5000);
    auto.push(hit);
    if (!hit) {
      b.el.querySelector('.cl-bench-btns .btn:last-child')?.click();
      await sleep(250);
    }
  }
  await sleep(200);
  const out = { auto, done, texts, model: b.model === mirror ? 'mirror' : b.model === sim ? 'sim' : 'other', finished: b.current >= level.machine.tasks.length };
  b.destroy();
  return out;
}

/** 5. 小课堂：两种新任务、R9 的机器步 */
async function classroom() {
  group = '小课堂';
  readyKeyboard();
  const r9 = RHYTHM.find((l) => l.id === 'R9');
  const velTask = r9.machine.tasks[3];
  eq('R9 改力度那一项和 STEP_VEL(\'HAT1\', 3, { dir: \'up\' }) 一字不差', velTask, STEP_VEL('HAT1', 3, { dir: 'up' }));
  ok('R9 没接真机时不再说“模拟机还不会这一手”', !JSON.stringify(r9.machine).includes('还不会'));
  const tracks = ['KICK', 'SNARE', 'CLAP', 'HAT1', 'HAT2', 'PERC1', 'PERC2'];
  ok('STEP_LEN 的键盘说法里，轨道键和 keymap.js 的键位一致', tracks.every((t) => STEP_LEN(t, 3).kbdText.includes(`〔${keyOf(t)}〕`) && STEP_LEN(t, 3).kbdText.includes(`〔${keyOf('PAGE')}〕`)), tracks.map((t) => keyOf(t)).join(''));
  ok('STEP_VEL 的键盘说法里，方键和 keymap.js 的键位一致', Array.from({ length: 16 }, (_, i) => i + 1).every((n) => STEP_VEL('HAT1', n).kbdText.includes(`〔${keyOf(`DK${n}`)}〕`)));
  const f = STEP_VEL('HAT1', 1, { lead: '给第 1 下“写个 f”', after: '完了。' });
  ok('STEP_VEL 的 lead / after：开头那半句、最后那一句能换，三种说法都跟着换', [f.text, f.simText, f.kbdText].every((t) => t.startsWith('给第 1 下“写个 f”：') && t.endsWith('完了。')) && same(f.detect, { kind: 'stepvel', track: 'HAT1', step: 0, dir: 'up' }), f.text);
  eq('STEP_LEN / STEP_VEL 的 detect', [STEP_LEN('HAT1', 3).detect, STEP_VEL('SNARE', 13, { dir: 'down' }).detect], [{ kind: 'steplen', track: 'HAT1', steps: 3 }, { kind: 'stepvel', track: 'SNARE', step: 12, dir: 'down' }]);

  // R9：鼠标
  let r = await runBench(r9, async (i) => {
    if (i === 0) await w.tap('HAT1');
    if (i === 1) for (const n of [1, 3, 5, 7, 9, 11, 13, 15]) await w.tap(`DK${n}`);
    if (i === 2) await w.tap('PLAY');
    if (i === 3) {
      await w.hold('DK3');
      await w.turn('SD4', 1, 2);
      await w.tap('DK3');
    }
    if (i === 4) await w.tap('PLAY');
  });
  eq('R9 的机器步在模拟机上从头做到尾：5 项都是自己认出来打的勾，没有点过“我做了”', [r.model, r.auto, r.done, r.finished], ['sim', [true, true, true, true, true], { manual: 0, tasks: 5, tier: 0 }, true]);
  ok('R9 第 4 项在模拟机上显示的是鼠标的说法（长按出黑圈）', /长按/.test(r.texts[3]) && /黑圈/.test(r.texts[3]) && !/还不会/.test(r.texts[3]), r.texts[3]);

  // R9：做反了（往轻里转）不算，转回来才算
  r = await runBench({ machine: { edits: true, tasks: [PICK('HAT1'), STEPS('HAT1', [3], '按亮第 3 个。'), STEP_VEL('HAT1', 3, { dir: 'up' })] } }, async (i, b) => {
    if (i === 0) await w.tap('HAT1');
    if (i === 1) await w.tap('DK3');
    if (i === 2) {
      await w.hold('DK3');
      await w.turn('SD4', -1, 2);
      await sleep(600);
      const stuck = b.current === 2;
      const hint = b.el.querySelector('.cl-bench-status').innerText;
      ok('要“更重”的时候往轻里转：不打勾，提示往另一边转', stuck && /更重/.test(hint), `current=${b.current} hint=${hint}`);
      await w.turn('SD4', 1, 3);
      await w.tap('DK3');
    }
  });
  eq('转回到比 100 重：打勾', [r.auto, r.done?.manual], [[true, true, true], 0]);

  // R9：键盘学习方式
  learn.set(true);
  r = await runBench(r9, async (i) => {
    if (i === 0) await press('HAT1');
    if (i === 1) for (const n of [1, 3, 5, 7, 9, 11, 13, 15]) await press(`DK${n}`);
    if (i === 2) await press('PLAY');
    if (i === 3) {
      kdown('DK3');
      await sleep(150);
      await arrow(1, 2);
      kup('DK3');
      await sleep(80);
    }
    if (i === 4) await press('PLAY');
  });
  eq('R9 的机器步用电脑键盘也能从头做到尾，5 项都自己打勾', [r.auto, r.done, r.finished], [[true, true, true, true, true], { manual: 0, tasks: 5, tier: 0 }, true]);
  ok('键盘学习方式下第 4 项显示的是键盘的说法（按住 E 按 ↑；页面上这两个字画成键帽）', /按住 E（亮着的第 3 个方键）/.test(r.texts[3]) && /按 ↑ 让它比别的重/.test(r.texts[3]) && !/黑圈/.test(r.texts[3]), r.texts[3]);

  // 改长度的任务：键盘
  const lenLevel = { machine: { edits: true, tasks: [STEP_LEN('HAT1', 3), STEP_LEN('KICK', 12), PLAY(), STOP()] } };
  r = await runBench(lenLevel, async (i) => {
    if (i === 0 || i === 1) {
      const t = i === 0 ? 'HAT1' : 'KICK';
      kdown('PAGE');
      await sleep(320);
      kdown(t);
      await sleep(120);
      await arrow(-1, i === 0 ? 13 : 4);
      kup(t);
      kup('PAGE');
      await sleep(80);
    }
    if (i >= 2) await press('PLAY');
  });
  eq('“把 HAT 1 改成 3 步、把 KICK 改成 12 步”用电脑键盘做：都自己打勾', [r.auto, r.done], [[true, true, true, true], { manual: 0, tasks: 4, tier: 0 }]);
  ok('键盘学习方式下改长度那一项显示的是键盘的说法（按住 3 再按住 V）', /按住 3（PAGE）/.test(r.texts[0]) && /按住 V（HAT 1）/.test(r.texts[0]) && !/黑圈/.test(r.texts[0]), r.texts[0]);
  learn.set(false);

  // 改长度的任务：鼠标（长按 [PAGE]，滚轮转两条鼓轨的旋钮，然后直接按 [PLAY]）
  r = await runBench(lenLevel, async (i, b) => {
    if (i === 0) {
      await w.hold('PAGE');
      await w.turn('HAT1', -1, 10);
      await sleep(500);
      const hint = b.el.querySelector('.cl-bench-status').innerText;
      ok('转到一半（6 步）：不打勾，提示还差几格', b.current === 0 && /6 步/.test(hint) && /3 步/.test(hint), `current=${b.current} hint=${hint}`);
      await w.turn('HAT1', -1, 3);
    }
    if (i === 1) await w.turn('KICK', -1, 4);
    if (i >= 2) await w.tap('PLAY');
  });
  eq('“把 HAT 1 改成 3 步、把 KICK 改成 12 步、播放、停”用鼠标做：都自己打勾', [r.model, r.auto, r.done], ['sim', [true, true, true, true], { manual: 0, tasks: 4, tier: 0 }]);
  ok('模拟机上改长度那一项显示的是鼠标的说法', /长按/.test(r.texts[0]) && /黑圈/.test(r.texts[0]), r.texts[0]);
  eq('做完之后两条鼓轨的长度', [sim.lengthOf('HAT1'), sim.lengthOf('KICK')], [3, 12]);

  // 改完长度（[PAGE] 还锁着）直接点一条鼓轨的旋钮：当 [PAGE] 已经松开，照常选中它；接着拖别的鼓轨旋钮则是接着改长度
  r = await runBench({ machine: { edits: true, tasks: [STEP_LEN('HAT1', 3), STEP_LEN('SNARE', 12), PICK('KICK'), STEPS('KICK', [1, 5], '按亮第 1、5 个。')] } }, async (i) => {
    if (i === 0) {
      await w.hold('PAGE');
      await w.turn('HAT1', -1, 13);
    }
    if (i === 1) await w.turn('SNARE', -1, 4);
    if (i === 2) await w.tap('KICK');
    if (i === 3) await w.tap('DK5');
  });
  eq('改完两条的长度，不松 [PAGE] 直接点 KICK 旋钮：选中了 KICK，[PAGE] 自己松开，接着能填格子', [r.auto, r.done?.manual, sim.sel, sim.held, sim.lengthOf('KICK'), sim.stepsOf('KICK')], [[true, true, true, true], 0, 'KICK', null, 16, [0, 4]]);

  // 上一关留下的：HAT 1 3 步、SNARE 12 步、再给 KICK 第 1 步锁一个力度。进下一关时都清回原样，格子不动
  host.replaceChildren(sim.mount()); // 上一关的那一屏收掉了，模拟机重新摆出来（内容还是刚才的）
  await w.hold('DK1');
  await w.turn('SD4', 1, 1);
  await w.tap('DK1');
  eq('上一关留下的样子', [sim.lengthOf('HAT1'), sim.lengthOf('SNARE'), sim.velsOf('KICK')], [3, 12, { 0: 109 }]);
  const next = createBench(r9, {});
  host.replaceChildren(next.el);
  await sleep(300);
  eq('进下一关的“用在机器上”：按步改短的长度、单独改过的力度都清回原样，格子还在', [sim.lengthOf('HAT1'), sim.lengthOf('SNARE'), sim.velsOf('KICK'), sim.stepsOf('KICK')], [16, 16, {}, [0, 4]]);
  next.destroy();
}

/** 6. 接着真机（这里是假真机）：这两种任务认不出来，退成自己点 */
async function live() {
  group = '接真机';
  const { attachFakeDevice } = await import('./fake-seqtrak.js');
  attachFakeDevice();
  const up = await until(() => mirror.available, 4000);
  ok('假真机接上了（真机镜像可用）', up);
  if (!up) return;
  let seen = null;
  const r = await runBench({ machine: { tasks: [STEP_VEL('HAT1', 3), STEP_LEN('HAT1', 3)] } }, async () => {
    await sleep(900);
  }, {
    before: async (i, b) => {
      await sleep(400);
      (seen ||= []).push({ live: b.el.classList.contains('live'), status: b.el.querySelector('.cl-bench-status').innerText.trim(), button: b.el.querySelector('.cl-bench-btns .btn:last-child')?.textContent });
    },
  });
  eq('接着真机时摆的是真机镜像', r.model, 'mirror');
  eq('这两项在真机上认不出：状态那一行让他照着做、做完自己点，右上角是手动的按钮', seen, [
    { live: true, status: '照着做，做完点右上角的按钮。', button: '改好了' },
    { live: true, status: '照着做，做完点右上角的按钮。', button: '3 步了' },
  ]);
  ok('真机上显示的是真机的说法（不说黑圈、不说拖）', !/黑圈|上下拖/.test(r.texts.join('')) && /转着听/.test(r.texts[0]) && /转着看/.test(r.texts[1]), r.texts.join(' | '));
  eq('两项都是点“我做了”过的', [r.auto, r.done], [[false, false], { manual: 2, tasks: 2, tier: 0 }]);
}

// ───────────── 截图用：把模拟机摆成某个样子停住 ─────────────

async function eightHats() {
  fresh();
  await w.tap('HAT1');
  for (const n of [1, 3, 5, 7, 9, 11, 13, 15]) await w.tap(`DK${n}`);
}
const SHOTS = {
  /** 8 下镲里三步锁过力度：紫色 */
  async vel() {
    await eightHats();
    for (const [n, dir, k] of [[3, 1, 2], [7, -1, 5], [13, 1, 3]]) {
      await w.hold(`DK${n}`);
      await w.turn('SD4', dir, k);
      await w.tap(`DK${n}`);
    }
  },
  /** 正按住亮着的第 3 个方键转旋钮 4（黑圈、VOLUME 亮、小灯） */
  async velhold() {
    await eightHats();
    await w.hold('DK3');
    await w.turn('SD4', 1, 2);
  },
  /** 正按住 [PAGE] 把 HAT 1 转到 3 步：方键上白色 3 个，小灯 1 个 */
  async len3() {
    await eightHats();
    await w.hold('PAGE');
    await w.turn('HAT1', -1, 13);
  },
  /** 正按住 [PAGE] 把 HAT 1 转到 20 步：方键上白色 4 个，小灯 2 个 */
  async len20() {
    await eightHats();
    await w.hold('PAGE');
    await w.turn('HAT1', 1, 4);
  },
  /** 12 步，松开 [PAGE] 以后平时的样子：范围以外的第 13、15 个不亮；第 3 步锁过力度 */
  async short() {
    await eightHats();
    await w.hold('DK3');
    await w.turn('SD4', 1, 2);
    await w.tap('DK3');
    await w.hold('PAGE');
    await w.turn('HAT1', -1, 4);
    await w.tap('PAGE');
  },
  /** 小课堂 R9 的“用在机器上”，做到改力度那一项 */
  async bench() {
    sim.reset();
    const b = createBench(RHYTHM.find((l) => l.id === 'R9'), {});
    host.replaceChildren(b.el);
    await sleep(300);
    await w.tap('HAT1');
    for (const n of [1, 3, 5, 7, 9, 11, 13, 15]) await w.tap(`DK${n}`);
    await sleep(500);
    await w.tap('PLAY');
    await sleep(600);
    await w.tap('PLAY'); // 截图时停着，方键上没有走动的白灯
    await w.hold('DK3');
    await w.turn('SD4', -1, 1); // 故意往轻里转一格：这一项要的是“更重”，所以不打勾，停在这一项上，能看到它的说法和提示
  },
  /** 小课堂里“把 HAT 1 改成 3 步”那一项，转到一半 */
  async benchlen() {
    sim.reset();
    const b = createBench({ machine: { edits: true, tasks: [STEP_LEN('HAT1', 3, '它自己 3 步转一圈。'), PLAY(), STOP()] } }, {});
    host.replaceChildren(b.el);
    await sleep(300);
    await w.hold('PAGE');
    await w.turn('HAT1', -1, 10);
  },
};

// ───────────── 入口 ─────────────

async function main() {
  const shot = params.get('shot');
  if (shot) {
    if (params.has('kbd')) {
      readyKeyboard();
      learn.set(true);
    }
    await SHOTS[shot]?.();
    document.body.dataset.shot = shot;
    return;
  }
  for (const part of [velocity, carry, length, dragging, keyboard, classroom, live]) {
    try {
      await part();
    } catch (e) {
      results.push({ group, name: `${part.name} 这一组中途出错`, ok: false, detail: String(e?.stack || e).slice(0, 400) });
    }
  }
  const failed = results.filter((x) => !x.ok).length;
  document.body.append(h('pre', { id: 'check-result', style: { display: 'none' } }, JSON.stringify({ total: results.length, failed, errors: w.errors, results, says, velDefault: SIM_VEL_DEFAULT })));
}
main();
