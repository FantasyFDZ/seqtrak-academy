// 后台小脚本（service worker）：只为了让 Chrome 认为这个网页可以“安装”成应用（用户 2026-11-15 要的：
// 装好以后有自己的窗口和 Dock 图标，Chrome 也允许它一打开就出声——开屏的背景律动）。
// 什么都不缓存：每次都从本地服务拿最新的（经常在改，缓存了会看到旧的）。只管“打开页面”这一下：
// 本地服务没开的时候，给一句话告诉你怎么开，而不是浏览器那张“无法访问此网站”。
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

const OFFLINE = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>SEQTRAK Academy</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#e6e7e9;color:#1b1d21;font:16px/1.7 -apple-system,'PingFang SC',sans-serif;text-align:center">
<div><img src="/icons/icon-192.png" width="120" height="120" alt=""><h2 style="margin:8px 0">本地服务还没开，啾。</h2>
<p>在 Mac 上双击项目文件夹里的 <b>start.command</b>，等它开好，再打开一次 SEQTRAK Academy。</p></div></body></html>`;

self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return; // 别的请求（脚本、图片、接口）照常走，不经过这里
  e.respondWith(fetch(e.request).catch(() => new Response(OFFLINE, { headers: { 'content-type': 'text/html; charset=utf-8' } })));
});
