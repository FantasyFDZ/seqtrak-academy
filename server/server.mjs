// SEQTRAK Academy 本地服务：静态页面 + AI 教练接口 + 进度存储。零依赖，Node 20+ 即可。
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, loadConfig, saveConfig, publicConfig, resolveFastKey } from './config.mjs';
import { AiError, fastStream, fastComplete, fastListModels, probeDeep, deepRun } from './ai.mjs';
import { buildFastMessages, buildDeepPrompt, buildDrillPrompt, normalizeDrill, DRILL_SCHEMA } from './coach.mjs';
import { readProgress, writeProgress, appendSession, recentSessions, appendProbe } from './store.mjs';

const PORT = Number(process.env.PORT || 4747);
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC = path.join(ROOT, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
};

function httpError(status, message, code) {
  const e = new Error(message);
  e.status = status;
  e.code = code;
  return e;
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
}

async function readBody(req, limit = 2_000_000) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw httpError(413, '请求体太大');
    chunks.push(c);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw httpError(400, '请求里的 JSON 格式不对');
  }
}

/** 只接受来自本页面自己的请求，挡掉其它网站对本地接口的跨站调用。 */
function guard(req) {
  const host = req.headers.host || '';
  const hostname = host.replace(/:\d+$/, '');
  if (!/^(localhost|\[::1\]|[\d.]+|[a-z0-9-]+(\.local|\.ts\.net)?)$/i.test(hostname)) {
    throw httpError(403, '不允许的 Host');
  }
  const origin = req.headers.origin;
  if (origin) {
    let ok = false;
    try {
      ok = new URL(origin).host === host;
    } catch {
      ok = false;
    }
    if (!ok) throw httpError(403, '跨站请求被拒绝');
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const type = req.headers['content-type'] || '';
    if (!type.startsWith('application/json')) throw httpError(415, '只接受 JSON');
  }
}

function openSse(res) {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });
  return (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
}

async function aiStatus(cfg, force = false) {
  const fast = resolveFastKey(cfg);
  const deep = await probeDeep(cfg, force);
  return {
    fast: { ready: !!fast.key && !!cfg.fast.baseUrl && !!cfg.fast.model, preset: cfg.fast.preset, model: cfg.fast.model, keySource: fast.source },
    deep: {
      ready: deep.ok,
      reason: deep.ok ? '' : deep.reason,
      version: deep.version || '',
      enabled: cfg.deep.enabled,
      model: deep.model || '',
      modelSource: deep.models?.source || '',
      // Codex 自己配置的默认模型；和实际使用的不一样时，设置页会解释原因
      configuredModel: deep.models?.configured || '',
    },
  };
}

/** 根据想用的引擎和实际可用情况，决定这次到底用谁。 */
function pickEngine(want, status) {
  if (want === 'deep') {
    if (status.deep.ready) return 'deep';
    if (status.fast.ready) return 'fast';
  } else {
    if (status.fast.ready) return 'fast';
    if (status.deep.ready) return 'deep';
  }
  return null;
}

// ───────────────────────── API ─────────────────────────

const routes = {
  'GET /api/status': async (req, res, url) => {
    const cfg = await loadConfig();
    sendJson(res, 200, { ok: true, platform: process.platform, ai: await aiStatus(cfg, url.searchParams.has('refresh')) });
  },

  'GET /api/settings': async (req, res) => {
    sendJson(res, 200, publicConfig(await loadConfig()));
  },

  'PUT /api/settings': async (req, res) => {
    const cfg = await saveConfig(await readBody(req));
    sendJson(res, 200, { ...publicConfig(cfg), ai: await aiStatus(cfg, true) });
  },

  'GET /api/settings/models': async (req, res) => {
    sendJson(res, 200, { models: await fastListModels(await loadConfig()) });
  },

  'POST /api/settings/test': async (req, res) => {
    const body = await readBody(req);
    const cfg = await loadConfig();
    const started = Date.now();
    if (body.engine === 'deep') {
      const { text, ms, model } = await deepRun({ cfg, prompt: '用一句不超过 20 个字的中文和一位刚开始学电子音乐的新手打个招呼。直接回答，不要运行任何命令。' });
      sendJson(res, 200, { ok: true, reply: text, ms, model });
    } else {
      const reply = await fastComplete({ cfg, messages: [{ role: 'user', content: '用一句不超过 20 个字的中文和一位刚开始学电子音乐的新手打个招呼。' }] });
      sendJson(res, 200, { ok: true, reply: reply.trim(), ms: Date.now() - started });
    }
  },

  'POST /api/coach/chat': async (req, res) => {
    const body = await readBody(req);
    const cfg = await loadConfig();
    const status = await aiStatus(cfg);
    const want = body.engine === 'deep' ? 'deep' : 'fast';
    const engine = pickEngine(want, status);
    if (!engine) throw httpError(503, '还没有可用的 AI 引擎：请在设置里填写 DeepSeek/Kimi 的 key，或确认本机 Codex 已登录。', 'NO_AI');

    const controller = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) controller.abort();
    });
    const send = openSse(res);
    send({ engine, fallback: engine !== want });
    try {
      if (engine === 'fast') {
        const messages = await buildFastMessages({ messages: body.messages, contextText: body.contextText, format: body.format });
        for await (const delta of fastStream({ cfg, messages, signal: controller.signal })) send({ delta });
      } else {
        send({ status: 'thinking' });
        const prompt = await buildDeepPrompt({ messages: body.messages, contextText: body.contextText, format: body.format });
        const { text, ms, model } = await deepRun({ cfg, prompt, signal: controller.signal });
        send({ delta: text, ms, model });
      }
      send({ done: true });
    } catch (e) {
      if (e.code !== 'ABORTED') send({ error: e.message, code: e.code || 'ERROR' });
    }
    res.end();
  },

  'POST /api/coach/drill': async (req, res) => {
    const body = await readBody(req);
    const cfg = await loadConfig();
    const status = await aiStatus(cfg);
    // 出题默认也走即时引擎（用户 2026-11-13：全都走即时引擎）；明确要 deep 才用深度引擎
    const engine = pickEngine(body.engine === 'deep' ? 'deep' : 'fast', status);
    if (!engine) throw httpError(503, '还没有可用的 AI 引擎', 'NO_AI');
    const prompt = await buildDrillPrompt({ contextText: body.contextText, request: body.request });
    const controller = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) controller.abort();
    });
    let raw;
    let ms;
    const started = Date.now();
    if (engine === 'deep') {
      ({ text: raw, ms } = await deepRun({ cfg, prompt, schema: DRILL_SCHEMA, signal: controller.signal }));
    } else {
      raw = await fastComplete({ cfg, messages: [{ role: 'user', content: prompt }], json: true, signal: controller.signal });
      ms = Date.now() - started;
    }
    let drill;
    try {
      drill = normalizeDrill(raw);
    } catch (e) {
      throw httpError(502, `AI 出的练习格式不对：${e.message}`, 'BAD_DRILL');
    }
    sendJson(res, 200, { engine, ms, drill });
  },

  'GET /api/progress': async (req, res) => {
    sendJson(res, 200, await readProgress());
  },

  'PUT /api/progress': async (req, res) => {
    const body = await readBody(req);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, '进度数据格式不对');
    await writeProgress(body);
    sendJson(res, 200, { ok: true });
  },

  'GET /api/sessions': async (req, res, url) => {
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 30));
    sendJson(res, 200, { sessions: await recentSessions(limit) });
  },

  'POST /api/sessions': async (req, res) => {
    await appendSession(await readBody(req));
    sendJson(res, 200, { ok: true });
  },

  'POST /api/probe': async (req, res) => {
    await appendProbe(await readBody(req));
    sendJson(res, 200, { ok: true });
  },
};

// ───────────────────────── 静态文件 ─────────────────────────

async function serveStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') throw httpError(405, '不支持的方法');
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(PUBLIC, rel));
  if (file !== PUBLIC && !file.startsWith(PUBLIC + path.sep)) throw httpError(403, '路径不允许');
  let info;
  try {
    info = await stat(file);
  } catch {
    throw httpError(404, '找不到这个文件');
  }
  if (info.isDirectory()) throw httpError(404, '找不到这个文件');
  res.writeHead(200, {
    'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'content-length': info.size,
    'cache-control': 'no-store',
  });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://local');
    if (url.pathname.startsWith('/api/')) {
      guard(req);
      const handler = routes[`${req.method} ${url.pathname}`];
      if (!handler) throw httpError(404, '没有这个接口');
      await handler(req, res, url);
    } else {
      await serveStatic(req, res, url);
    }
  } catch (e) {
    const status = e.status || (e instanceof AiError ? 502 : 500);
    if (status >= 500 && !(e instanceof AiError)) console.error(e);
    if (res.headersSent) res.end();
    else sendJson(res, status, { error: e.message || '服务器出错了', code: e.code || 'ERROR' });
  }
});

server.listen(PORT, HOST, async () => {
  const cfg = await loadConfig();
  const ai = await aiStatus(cfg);
  console.log(`SEQTRAK Academy 已启动： http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`  快速引擎（即时问答）：${ai.fast.ready ? `已就绪 · ${ai.fast.model}` : '未配置 key'}`);
  console.log(`  深度引擎（Codex GPT）：${ai.deep.ready ? `已就绪 · ${ai.deep.version}` : `不可用（${ai.deep.reason}）`}`);
});
