// 检查用：在无界面 Chrome 里按“渲染”的方式拨到某几秒，各截一张图（promo/out/peek/），看版式用。
// 用法（仓库根目录）：node promo/peek.mjs 12.3 36.5 58          截这几秒（半尺寸 960 × 540）
//                    node promo/peek.mjs --full 12.3                全尺寸
//                    node promo/peek.mjs --sheet 0:78:2             从 0 到 78 秒每 2 秒一张，拼成一张总览
import { mkdirSync, writeFileSync } from 'node:fs';
import { startServer } from './serve.mjs';
import { launchChrome, openPage } from './lib/cdp.mjs';

const args = process.argv.slice(2);
const full = args.includes('--full');
const sheetArg = args.includes('--sheet') ? args[args.indexOf('--sheet') + 1] : null;
let times = args.filter((a) => /^\d/.test(a) && a !== sheetArg).map(Number);
if (args.includes('--sheet')) {
  const [a, b, step] = sheetArg.split(':').map(Number);
  times = [];
  for (let t = a; t <= b + 1e-9; t += step) times.push(Math.round(t * 1000) / 1000);
}
const OUT = 'promo/out/peek';
mkdirSync(OUT, { recursive: true });

const server = await startServer(4792);
const chrome = await launchChrome({ port: 9342 });
try {
  const page = await openPage(chrome.browser, { width: 1920, height: 1080 });
  await page.goto('http://127.0.0.1:4792/promo/?render');
  for (let i = 0; i < 100 && !(await page.eval('!!window.__promoReady')); i++) await new Promise((r) => setTimeout(r, 100));
  const shots = [];
  for (const t of [...times].sort((x, y) => x - y)) {
    // 从前一帧拨过去：先拨到 0.5 秒前，再一帧一帧走过来（让一下就完的动作也触发）
    const fps = await page.eval('__promo.fps');
    const end = Math.round(t * fps);
    const start = Math.max(0, end - 30);
    const last = await page.eval('window.__lastFrame ?? -1');
    for (let f = Math.max(start, last + 1); f <= end; f++) await page.eval(`__promo.frame(${f})`);
    await page.eval(`window.__lastFrame = ${end}`);
    const scale = full ? 1 : args.includes('--sheet') ? 0.25 : 0.5;
    const img = await page.shot({ format: 'jpeg', quality: 88, clip: { x: 0, y: 0, width: 1920, height: 1080, scale } });
    const name = `${OUT}/t${t.toFixed(2).padStart(6, '0')}.jpg`;
    writeFileSync(name, img);
    shots.push(name);
  }
  if (page.errors.length) console.log('页面出错：', page.errors.slice(0, 5).join('\n'));
  if (args.includes('--sheet')) {
    // 拼一张总览：每行 4 张
    const sheet = await openPage(chrome.browser, { width: 1920, height: Math.ceil(shots.length / 4) * 290 });
    const html = `<!doctype html><body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(4,480px)">${shots.map((s, i) => `<div style="position:relative"><img src="${s.split('/').pop()}" style="width:480px;display:block"><b style="position:absolute;left:6px;top:4px;color:#fff;font:700 18px Consolas;text-shadow:0 0 4px #000">${times[i]}s</b></div>`).join('')}</body>`;
    writeFileSync(`${OUT}/sheet.html`, html);
    await sheet.goto('http://127.0.0.1:4792/promo/out/peek/sheet.html');
    await new Promise((r) => setTimeout(r, 800));
    writeFileSync(`${OUT}/sheet.jpg`, await sheet.shot({ format: 'jpeg', quality: 85 }));
    console.log(`${OUT}/sheet.jpg`);
  } else console.log(shots.join('\n'));
} finally {
  await chrome.close();
  server.close();
}
