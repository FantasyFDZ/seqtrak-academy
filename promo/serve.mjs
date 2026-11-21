// 宣传片的本地服务（零依赖）：
//   /promo/…   → promo/ 目录（宣传片自己的页面和脚本）
//   其它路径   → public/（应用本身：宣传片直接 import 应用里的 /js/bird.js、/js/device-panel.js、/css/app.css 等）
//   POST /promo/out/<文件名>  把请求体写进 promo/out/（离线渲染出来的音频从页面里送回来）
// 用法：node promo/serve.mjs            （默认 http://127.0.0.1:4790/promo/）
//       PORT=4791 node promo/serve.mjs
import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const PUBLIC = path.join(ROOT, 'public');
const OUT = path.join(HERE, 'out');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.woff2': 'font/woff2',
};

function resolve(urlPath) {
  const p = decodeURIComponent(urlPath.split('?')[0]);
  const [base, rel] = p.startsWith('/promo/') ? [HERE, p.slice('/promo/'.length)] : [PUBLIC, p.slice(1)];
  const file = path.resolve(base, rel || 'index.html');
  if (!file.startsWith(base)) return null; // 不许跳出目录
  return file;
}

export function startServer(port = Number(process.env.PORT) || 4790) {
  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'POST' && req.url.startsWith('/promo/out/')) {
        const name = path.basename(decodeURIComponent(req.url.slice('/promo/out/'.length)));
        const chunks = [];
        for await (const c of req) chunks.push(c);
        await mkdir(OUT, { recursive: true });
        await writeFile(path.join(OUT, name), Buffer.concat(chunks));
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: true, name }));
        return;
      }
      if (req.url === '/promo' || req.url === '/promo/') req.url = '/promo/index.html';
      const file = resolve(req.url);
      if (!file) return res.writeHead(403).end();
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(body);
    } catch (err) {
      res.writeHead(err.code === 'ENOENT' ? 404 : 500).end(String(err.code || err));
    }
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok(server)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = await startServer();
  console.log(`宣传片预览： http://127.0.0.1:${server.address().port}/promo/`);
}
