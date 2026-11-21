// 把宣传片渲染成视频：1920 × 1080、60 帧、H.264 + AAC 的 MP4（B 站能直接传）。
//   1. 离线算出整首音乐（应用自己的合成器 + 啾啾的叫声）→ promo/out/audio.wav
//   2. 无界面 Chrome 打开 /promo/?render，一帧一帧拨时钟、截图，直接喂给 ffmpeg
//   3. ffmpeg 把画面和声音合成 promo/out/seqtrak-academy-promo.mp4
// 用法（仓库根目录）：
//   node promo/render.mjs                    全片
//   node promo/render.mjs --audio            只算音频（顺带打印每段的响度）
//   node promo/render.mjs --mix              只算三份音频（全部 / 只有鸟叫 / 只有音乐）比响度，检查混音
//   node promo/render.mjs --from 36 --to 48  只渲一段（检查用，输出 promo/out/part-36-48.mp4）
//   node promo/render.mjs --fps 30           换帧率
// ffmpeg：环境变量 FFMPEG 指定；不指定就用 Python 包 imageio-ffmpeg 自带的那个（pip install imageio-ffmpeg）。
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { startServer } from './serve.mjs';
import { launchChrome, openPage, sleep } from './lib/cdp.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => (args.includes(name) ? args[args.indexOf(name) + 1] : def);
const PORT = 4793;
const BASE = `http://127.0.0.1:${PORT}/promo/`;
const OUT = 'promo/out';
mkdirSync(OUT, { recursive: true });

function findFfmpeg() {
  if (process.env.FFMPEG && existsSync(process.env.FFMPEG)) return process.env.FFMPEG;
  for (const py of ['python', 'python3', 'py']) {
    try {
      const p = execFileSync(py, ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'], { encoding: 'utf8' }).trim();
      if (p && existsSync(p)) return p;
    } catch { /* 试下一个 */ }
  }
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return 'ffmpeg';
  } catch {
    return null;
  }
}

async function ready(page) {
  for (let i = 0; i < 200; i++) {
    if (await page.eval('!!window.__promoReady')) return;
    await sleep(100);
  }
  throw new Error('页面没准备好');
}

async function renderAudio(chrome, { solo = null, name = 'audio.wav', normalize = true } = {}) {
  const page = await openPage(chrome.browser, { width: 800, height: 600 });
  await page.goto(`${BASE}?audio`);
  await ready(page);
  const stats = await page.eval(`__promo.renderAudio(${JSON.stringify({ solo, name, normalize })})`);
  await page.close();
  if (page.errors.length) console.log('音频页出错：', page.errors.slice(0, 3).join(' | '));
  return stats;
}

const server = await startServer(PORT);
const chrome = await launchChrome({ port: 9343 });
const t0 = Date.now();
try {
  if (args.includes('--mix')) {
    for (const [solo, name] of [[null, 'mix-all.wav'], ['bird', 'mix-bird.wav'], ['music', 'mix-music.wav']]) {
      const s = await renderAudio(chrome, { solo, name, normalize: false });
      console.log(`${(solo || 'all').padEnd(5)} 峰值 ${(20 * Math.log10(s.peak)).toFixed(1)} dBFS  各段 RMS：${s.sections.map(([id, db]) => `${id} ${db}`).join('  ')}`);
    }
    process.exit(0);
  }

  const audio = await renderAudio(chrome);
  console.log(`音频：${audio.seconds.toFixed(2)} 秒，原始峰值 ${(20 * Math.log10(audio.peak)).toFixed(1)} dBFS，拉到 -1 dBFS（+${audio.gainDb.toFixed(1)} dB），整体 RMS ${audio.rmsDb.toFixed(1)} dBFS`);
  console.log(`各段 RMS：${audio.sections.map(([id, db]) => `${id} ${db}`).join('  ')}`);
  if (args.includes('--audio')) process.exit(0);

  const ffmpeg = findFfmpeg();
  if (!ffmpeg) throw new Error('找不到 ffmpeg：pip install imageio-ffmpeg，或者用环境变量 FFMPEG 指定');

  const page = await openPage(chrome.browser, { width: 1920, height: 1080 });
  await page.goto(`${BASE}?render`);
  await ready(page);
  const fps = Number(opt('--fps', 60));
  const duration = await page.eval('__promo.duration');
  const from = Number(opt('--from', 0));
  const to = Math.min(duration, Number(opt('--to', duration)));
  const first = Math.round(from * fps);
  const last = Math.round(to * fps);
  const part = args.includes('--from') || args.includes('--to');
  const file = part ? `${OUT}/part-${from}-${to}.mp4` : `${OUT}/seqtrak-academy-promo.mp4`;
  // 帧率不是 60 的时候，页面里的时钟照样按秒走（__promo.frame 按 60 帧算）：换算成页面的帧号
  const pageFps = await page.eval('__promo.fps');

  const enc = spawn(ffmpeg, [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-ss', String(from), '-t', String(to - from), '-i', `${OUT}/audio.wav`,
    '-map', '0:v', '-map', '1:a',
    '-vf', 'scale=in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p', '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-c:v', 'libx264', '-preset', opt('--preset', 'slow'), '-crf', opt('--crf', '16'), '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-g', String(fps * 2), '-movflags', '+faststart',
    '-c:a', 'aac', '-b:a', '320k', '-ar', '48000',
    '-shortest', file,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((ok, bad) => enc.on('close', (code) => (code === 0 ? ok() : bad(new Error(`ffmpeg 退出码 ${code}`)))));

  // 渲染要从第 0 帧走起（一下就完的动作、定时器都要按顺序触发）；--from 之前的帧只拨不截
  let lastPage = -1;
  for (let f = 0; f < last; f++) {
    const pf = Math.round((f / fps) * pageFps);
    for (let p = lastPage + 1; p <= pf; p++) await page.eval(`__promo.frame(${p})`);
    lastPage = Math.max(lastPage, pf);
    if (f < first) continue;
    const jpg = await page.shot({ format: 'jpeg', quality: 95 });
    if (!enc.stdin.write(jpg)) await new Promise((r) => enc.stdin.once('drain', r));
    if ((f - first) % (fps * 2) === 0) {
      const k = (f - first) / Math.max(1, last - first);
      const el = (Date.now() - t0) / 1000;
      process.stdout.write(`\r第 ${f} / ${last} 帧（${(k * 100).toFixed(0)}%），已用 ${el.toFixed(0)} 秒   `);
    }
  }
  enc.stdin.end();
  await done;
  if (page.errors.length) console.log('\n画面页出错：', page.errors.slice(0, 5).join('\n'));
  console.log(`\n好了：${file}（用时 ${((Date.now() - t0) / 1000).toFixed(0)} 秒）`);
} finally {
  await chrome.close();
  server.close();
}
