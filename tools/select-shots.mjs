// 开发期：给小课堂进门的两页（选曲台、推荐路线）和封面总览截图，看版式用。Mac 上无界面的 Chrome；图放在 tools/out/select/。
// 另起一个临时服务（端口默认 4771，数据放临时目录），不碰真实的学习进度；截完就关掉。
//
// 为什么不用 tools/rhythm-shots.sh 那种 `chrome --screenshot`：那种跑法页面运行时的视口比窗口矮 100 像素，到截图那一刻才撑满，
// 撑满之后页面里的脚本来不及再跑——啾啾蹲的位置、列表和路线图自己滚到哪，都是按矮了 100 像素的版式算的，图上就是歪的。
// 这里走 Chrome 的调试口：先把视口定成要的尺寸，等页面自己稳下来，再截。
//
// 用法（在仓库根目录）：node tools/select-shots.mjs              全套（60 来张，半分钟）
//                      node tools/select-shots.mjs sel route     只截文件名以这些开头的（sel / route / covers / neon- / new- / all- / head- / narrow- …）
//                      PORT=4773 node tools/select-shots.mjs     换个端口（调试口用它加 1000）
// 开发用的参数：?still 入场和封面的动效直接到位；?skin=neon 临时换成霓虹配色；?clline=theory|rhythm|fx|dj 直接打开某条线，?clpick=<关> 直接选中某一关
// （public/js/views/classroom-select.js 开头有说明）。
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROUTE } from '../public/js/content/classroom.js';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.PORT) || 4771;
const DEBUG = PORT + 1000;
const BASE = `http://localhost:${PORT}`;
const OUT = 'tools/out/select';
const only = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tmp = mkdtempSync(join(tmpdir(), 'sel-shots-'));
mkdirSync(OUT, { recursive: true });

const busy = await fetch(`${BASE}/api/progress`).then(() => true, () => false);
if (busy) {
  console.log(`${PORT} 有人在用`);
  process.exit(1);
}
const server = spawn('node', ['server/server.mjs'], { env: { ...process.env, PORT: String(PORT), SEQTRAK_DATA: join(tmp, 'data') }, stdio: 'ignore' });
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars', `--remote-debugging-port=${DEBUG}`, `--user-data-dir=${join(tmp, 'profile')}`, 'about:blank'], { stdio: 'ignore' });
const stop = () => {
  server.kill();
  chrome.kill();
  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch { /* Chrome 还没退干净，临时目录留给系统清 */ }
};
process.on('exit', stop);
process.on('SIGINT', () => process.exit(1));

// 等服务和 Chrome 都起来
let wsUrl = null;
for (let i = 0; i < 60 && !wsUrl; i++) {
  await sleep(250);
  wsUrl = await fetch(`http://127.0.0.1:${DEBUG}/json/version`).then((r) => r.json()).then((j) => j.webSocketDebuggerUrl, () => null);
}
for (let i = 0; i < 40; i++) {
  if (await fetch(`${BASE}/api/progress`).then(() => true, () => false)) break;
  await sleep(250);
}
if (!wsUrl) {
  console.log('Chrome 的调试口没起来');
  process.exit(1);
}

// 一个很小的调试口客户端
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let seq = 0;
const waiting = new Map();
const events = new Map(); // sessionId → [fn]
ws.addEventListener('message', (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && waiting.has(msg.id)) {
    const { resolve, reject } = waiting.get(msg.id);
    waiting.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message));
    else resolve(msg.result);
  } else if (msg.method) for (const fn of events.get(msg.sessionId) || []) fn(msg);
});
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = ++seq;
  waiting.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params, sessionId }));
});

/** 截一张：size = '1180x820'，name = 文件名（不带尺寸），query = ? 后面的参数，path = '/#/classroom' 这样的整条路径；run = 截之前在页面里跑的一段脚本 */
async function shot({ size, name, query = '', path, run, wait = 1500 }) {
  const [w, h] = size.split('x').map(Number);
  const hash = path.includes('#') ? path.slice(path.indexOf('#')) : '';
  const url = `${BASE}${path.split('#')[0]}?still${query ? `&${query}` : ''}${hash}`;
  const { targetId } = await send('Target.createTarget', { url: 'about:blank', width: w, height: h, newWindow: true }); // 窗口也开成这么大：不然很高的页面截出来是一小块平铺的
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  try {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }, sessionId);
    await send('Page.enable', {}, sessionId);
    const loaded = new Promise((r) => events.set(sessionId, [(msg) => msg.method === 'Page.loadEventFired' && r()]));
    await send('Page.navigate', { url }, sessionId);
    await Promise.race([loaded, sleep(8000)]);
    await sleep(wait);
    if (run) {
      await send('Runtime.evaluate', { expression: run, awaitPromise: true }, sessionId);
      await sleep(700);
    }
    const { data } = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
    writeFileSync(join(OUT, `${name}-${size}.png`), Buffer.from(data, 'base64'));
  } finally {
    events.delete(sessionId);
    await send('Target.closeTarget', { targetId }).catch(() => {});
  }
}
/** 一批一起截（一次 4 张） */
async function batch(jobs) {
  const todo = jobs.filter((j) => !only.length || only.some((o) => j.name.startsWith(o)));
  let done = 0;
  const worker = async () => {
    while (todo.length) {
      const j = todo.shift();
      try {
        await shot(j);
        done++;
      } catch (e) {
        console.log(`没截成：${j.name}-${j.size} ${e.message}`);
      }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return done;
}

// 三份进度：学了 6 关 / 全新用户 / 路线上的 60 关都学完了（牌有金有银有铜，也有没拿牌的）。别的字段和 tools/mac-check.sh 里那份旧进度一样
const check = readFileSync('tools/mac-check.sh', 'utf8');
const OLD = check.match(/^OLD='(.*)'$/m)[1];
const BODY = check.match(/^BODY='(.*)'$/m)[1];
const at = '2026-11-17T10:00:00.000Z';
const CL6 = { T5: { done: true, stars: 3, at, times: 2 }, T6: { done: true, stars: 2, at, times: 1 }, T14: { done: true, stars: 1, at, times: 1 }, R1: { done: true, stars: 2, at, times: 1 }, R2: { done: true, stars: 3, at, times: 1 }, F1: { done: true, stars: 1, at, times: 1 } };
const ALL = Object.fromEntries(ROUTE.flatMap((s) => s.ids).map((id, i) => [id, { done: true, stars: (i * 7 + 3) % 4, at, times: 1 }]));
const put = (classroom) => fetch(`${BASE}/api/progress`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: `{${OLD},${classroom ? `"classroom":${JSON.stringify(classroom)},` : ''}${BODY}}` });

const SEL = '/#/classroom';
const ROAD = '/#/classroom/route';
const COVERS = '/js/dev/covers.html';
let total = 0;

// 学了 6 关：两种皮肤 × 三个尺寸
await put(CL6);
const six = [];
for (const size of ['1024x768', '1180x820', '1440x900']) {
  for (const skin of ['', 'neon']) {
    const k = skin ? 'neon-' : '';
    const q = skin ? 'skin=neon&' : '';
    for (const line of ['theory', 'rhythm', 'fx', 'dj']) six.push({ size, name: `${k}sel-${line}`, query: `${q}clline=${line}`, path: SEL });
    six.push({ size, name: `${k}route`, query: q.slice(0, -1), path: ROAD });
  }
}
six.push(
  // 选中学过的、选学的、大关各看一眼；路线页选中岔路上的一关
  { size: '1024x768', name: 'sel-pick-T5', query: 'clpick=T5', path: SEL },
  { size: '1024x768', name: 'sel-pick-T36', query: 'clpick=T36', path: SEL },
  { size: '1180x820', name: 'sel-pick-RB', query: 'clpick=RB', path: SEL },
  { size: '1024x768', name: 'sel-pick-F6', query: 'clpick=F6', path: SEL },
  { size: '1180x820', name: 'neon-sel-pick-D3', query: 'skin=neon&clpick=D3', path: SEL },
  { size: '1180x820', name: 'route-pick-T33', query: 'clpick=T33', path: ROAD },
  { size: '1024x768', name: 'route-pick-T27', query: 'clpick=T27', path: ROAD },
  // 拉长的整页：路线图整条都在；选曲台乐理线的列表整条都在
  { size: '1024x4000', name: 'route-long', path: ROAD },
  { size: '1180x3600', name: 'route-long', path: ROAD },
  { size: '1440x3000', name: 'route-long', path: ROAD },
  { size: '1180x3600', name: 'neon-route-long', query: 'skin=neon', path: ROAD },
  { size: '1180x2700', name: 'sel-long-theory', query: 'clline=theory', path: SEL },
  // 封面总览
  { size: '1440x2700', name: 'covers', path: COVERS },
  { size: '1440x2700', name: 'neon-covers', query: 'skin=neon', path: COVERS },
  { size: '1024x3500', name: 'covers', path: COVERS },
  // 共用页头的另外几页：卡册、小本子（页头瘦了，看它们有没有跟着变样）
  { size: '1024x768', name: 'head-cards', path: '/#/classroom/cards' },
  { size: '1024x768', name: 'head-works', path: '/#/classroom/works' },
  { size: '1180x820', name: 'head-cards', path: '/#/classroom/cards' },
  // 最大的平板：1366 × 1024 不显得空
  { size: '1366x1024', name: 'sel-theory', query: 'clline=theory', path: SEL },
  { size: '1366x1024', name: 'route', path: ROAD },
  // 内容区很窄的时候（不是平板横屏了）：兜底的版式
  { size: '1024x768', name: 'narrow-sel', query: 'clline=theory', path: SEL, run: "document.querySelector('#view').style.maxWidth = '700px'" },
  { size: '1024x768', name: 'narrow-route', path: ROAD, run: "document.querySelector('#view').style.maxWidth = '700px'" },
);
total += await batch(six);

// 全新用户：一关没学
await put(null);
total += await batch([
  { size: '1024x768', name: 'new-sel', path: SEL },
  { size: '1180x820', name: 'new-sel', path: SEL },
  { size: '1024x768', name: 'new-route', path: ROAD },
  { size: '1180x820', name: 'new-route', path: ROAD },
  { size: '1180x820', name: 'neon-new-sel', query: 'skin=neon', path: SEL },
]);

// 路线上的 60 关都学完了
await put(ALL);
total += await batch([
  { size: '1024x768', name: 'all-sel', path: SEL },
  { size: '1180x820', name: 'all-sel', path: SEL },
  { size: '1024x768', name: 'all-route', path: ROAD },
  { size: '1180x820', name: 'all-route', path: ROAD },
  { size: '1180x3600', name: 'all-route-long', path: ROAD },
  { size: '1180x820', name: 'neon-all-route', query: 'skin=neon', path: ROAD },
]);

// 跳着学的：路线开头学了两关，后面东一关西一关（有连着的两关，也有孤零零的一关）。看路是不是亮在学过的地方：
// 开头到“接着学”一段，R4–R5 一段，R10、T5 各一小段，T14–T15 一段，F2 一小段，一共 6 段
const SKIP = Object.fromEntries(['R1', 'R2', 'R4', 'R5', 'R10', 'T5', 'T14', 'T15', 'F2'].map((id, i) => [id, { done: true, stars: (i % 3) + 1, at, times: 1 }]));
await put(SKIP);
total += await batch([
  { size: '1024x768', name: 'skip-route', path: ROAD },
  { size: '1180x820', name: 'skip-route-pick-R5', query: 'clpick=R5', path: ROAD },
  { size: '1180x3600', name: 'skip-route-long', path: ROAD },
  { size: '1180x3600', name: 'neon-skip-route-long', query: 'skin=neon', path: ROAD },
  { size: '1024x768', name: 'skip-sel-rhythm', query: 'clline=rhythm', path: SEL },
]);

ws.close();
console.log(`shots: ${total} → ${OUT}`);
process.exit(0);
