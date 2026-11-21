// 无界面 Chrome + 调试口（零依赖：用 Node 自带的 WebSocket）。截真实界面（capture.mjs）和逐帧渲染（render.mjs）共用。
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CANDIDATES = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].filter(Boolean);

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launchChrome({ port = 9333, args = [] } = {}) {
  const exe = CANDIDATES.find((p) => existsSync(p));
  if (!exe) throw new Error('找不到 Chrome（可以用环境变量 CHROME 指定）');
  const profile = mkdtempSync(join(tmpdir(), 'promo-chrome-'));
  const proc = spawn(exe, [
    '--headless=new', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio',
    '--autoplay-policy=no-user-gesture-required', '--force-color-profile=srgb', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, ...args, 'about:blank',
  ], { stdio: 'ignore' });
  let ws = null;
  for (let i = 0; i < 80 && !ws; i++) {
    await sleep(250);
    ws = await fetch(`http://127.0.0.1:${port}/json/version`).then((r) => r.json()).then((j) => j.webSocketDebuggerUrl, () => null);
  }
  if (!ws) {
    proc.kill();
    throw new Error('Chrome 的调试口没起来');
  }
  const browser = await connect(ws);
  return {
    browser,
    async close() {
      try {
        await browser.send('Browser.close');
      } catch { /* 已经关了 */ }
      proc.kill();
      await sleep(300);
      try {
        rmSync(profile, { recursive: true, force: true });
      } catch { /* Chrome 还没退干净，临时目录留给系统清 */ }
    },
  };
}

/** 连上调试口。send(method, params, sessionId) → 结果；on(事件名, fn) */
export async function connect(url) {
  const sock = new WebSocket(url);
  await new Promise((ok, bad) => {
    sock.onopen = ok;
    sock.onerror = bad;
  });
  let id = 0;
  const waiting = new Map();
  const handlers = new Map();
  sock.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && waiting.has(msg.id)) {
      const { ok, bad } = waiting.get(msg.id);
      waiting.delete(msg.id);
      msg.error ? bad(new Error(`${msg.error.message} ${msg.error.data || ''}`)) : ok(msg.result);
    } else if (msg.method) {
      for (const fn of handlers.get(msg.method) || []) fn(msg.params, msg.sessionId);
    }
  };
  return {
    send(method, params = {}, sessionId) {
      const n = ++id;
      sock.send(JSON.stringify({ id: n, method, params, sessionId }));
      return new Promise((ok, bad) => waiting.set(n, { ok, bad }));
    },
    on(method, fn) {
      if (!handlers.has(method)) handlers.set(method, []);
      handlers.get(method).push(fn);
    },
    close: () => sock.close(),
  };
}

/** 开一个标签页，返回一个绑在这个页上的 send / eval / goto / shot */
export async function openPage(browser, { width = 1920, height = 1080, scale = 1 } = {}) {
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (m, p) => browser.send(m, p, sessionId);
  await send('Page.enable');
  await send('Runtime.enable');
  const errors = [];
  browser.on('Runtime.exceptionThrown', (p, sid) => sid === sessionId && errors.push(p.exceptionDetails?.exception?.description || p.exceptionDetails?.text));
  browser.on('Runtime.consoleAPICalled', (p, sid) => sid === sessionId && p.type === 'error' && errors.push(p.args.map((a) => a.value ?? a.description).join(' ')));
  const page = {
    send,
    errors,
    async size(w, h, s = 1) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: s, mobile: false });
    },
    async goto(url, { wait = 'load' } = {}) {
      const loaded = new Promise((ok) => browser.on('Page.loadEventFired', (_, sid) => sid === sessionId && ok()));
      await send('Page.navigate', { url });
      if (wait === 'load') await loaded;
    },
    async eval(expr, { await: awaitPromise = true } = {}) {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    },
    async shot({ format = 'png', quality, clip, fast = false } = {}) {
      const r = await send('Page.captureScreenshot', { format, quality, clip, optimizeForSpeed: fast, captureBeyondViewport: false });
      return Buffer.from(r.data, 'base64');
    },
    close: () => browser.send('Target.closeTarget', { targetId }),
  };
  await page.size(width, height, scale);
  return page;
}
