// 截宣传片要用的真实界面（Drop 段的蒙太奇用）：首页闯关地图（两套配色）、小课堂、推荐路线、练习场、曲目完整版……
// 另起一个临时服务（端口 4791，数据是 promo/data/progress.json 的一份临时拷贝），不碰 data/ 里的真实进度；截完就关。
// 图放在 promo/shots/（两倍像素，镜头推近时也清楚）。
// 用法（仓库根目录）：node promo/capture.mjs            全套
//                    node promo/capture.mjs home route  只截名字以这些开头的
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchChrome, openPage, sleep } from './lib/cdp.mjs';

const PORT = 4791;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = 'promo/shots';
const only = process.argv.slice(2);

// skin：配色；h：视口高（长图就把视口拉高，内容区自己会撑满）；s：像素倍数
const SHOTS = [
  { name: 'home-neon', path: '#/', skin: 'neon' },
  { name: 'home-body', path: '#/', skin: 'body' },
  { name: 'home-long-neon', path: '#/', skin: 'neon', h: 3200, s: 1.5 },
  { name: 'home-long-body', path: '#/', skin: 'body', h: 3200, s: 1.5 },
  { name: 'classroom-neon', path: '#/classroom', skin: 'neon' },
  { name: 'route-neon', path: '#/classroom/route', skin: 'neon' },
  { name: 'route-body', path: '#/classroom/route', skin: 'body' },
  { name: 'arcade-neon', path: '#/arcade', skin: 'neon' },
  { name: 'songs-neon', path: '#/songs', skin: 'neon' },
  { name: 'songfull-neon', path: '#/songs/levels/full', skin: 'neon' },
  { name: 'songfull-body', path: '#/songs/levels/full', skin: 'body' },
  { name: 'lesson-neon', path: '#/lesson/4-3', skin: 'neon' },
  { name: 'cards-neon', path: '#/classroom/cards', skin: 'neon' },
];

// 中文字体换成和宣传片一样的思源黑体（Windows 上应用默认会落到微软雅黑）
const FONT_FIX = `document.addEventListener('DOMContentLoaded', () => {
  const s = document.createElement('style');
  s.textContent = ':root, :root[data-skin] { --font: "Segoe UI", "Noto Sans SC", system-ui, sans-serif !important; }';
  document.head.append(s);
});`;

const tmp = mkdtempSync(join(tmpdir(), 'promo-shots-'));
mkdirSync(join(tmp, 'data'), { recursive: true });
copyFileSync('promo/data/progress.json', join(tmp, 'data', 'progress.json'));
writeFileSync(join(tmp, 'data', 'sessions.jsonl'), '');
mkdirSync(OUT, { recursive: true });

if (await fetch(`${BASE}/api/progress`).then(() => true, () => false)) {
  console.log(`${PORT} 有人在用`);
  process.exit(1);
}
const server = spawn(process.execPath, ['server/server.mjs'], { env: { ...process.env, PORT: String(PORT), SEQTRAK_DATA: join(tmp, 'data') }, stdio: 'ignore' });
let chrome = null;
const stop = async () => {
  server.kill();
  if (chrome) await chrome.close();
  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch { /* 留给系统清 */ }
};
try {
  for (let i = 0; i < 40; i++) {
    if (await fetch(`${BASE}/api/progress`).then((r) => r.ok, () => false)) break;
    await sleep(250);
  }
  chrome = await launchChrome({ port: 9341 });
  for (const s of SHOTS) {
    if (only.length && !only.some((o) => s.name.startsWith(o))) continue;
    const w = s.w || 1440;
    const h = s.h || 900;
    const page = await openPage(chrome.browser, { width: w, height: h, scale: s.s || 2 });
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: FONT_FIX });
    await page.goto(`${BASE}/?skin=${s.skin}&still${s.path}`);
    await page.eval('document.fonts.ready.then(() => true)');
    await sleep(s.wait || 3200);
    const png = await page.shot();
    writeFileSync(join(OUT, `${s.name}.png`), png);
    console.log(`${s.name}.png  ${w}×${h} ×${s.s || 2}  ${(png.length / 1024).toFixed(0)} KB${page.errors.length ? `  出错：${page.errors.slice(0, 2).join(' | ')}` : ''}`);
    await page.close();
  }
} finally {
  await stop();
}
