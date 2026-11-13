// 双引擎 AI：
//   fast = OpenAI 兼容的流式接口（DeepSeek / Kimi 等），负责练习中的即时问答
//   deep = 本机已登录的 Codex CLI（GPT），负责关卡后的深度点评、定制练习、拆歌
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveFastKey, fastExtraBody } from './config.mjs';

export class AiError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// ───────────────────────── fast：OpenAI 兼容流式 ─────────────────────────

function fastEndpoint(cfg, suffix) {
  const base = (cfg.fast.baseUrl || '').replace(/\/+$/, '');
  if (!base) throw new AiError('NO_BASEURL', '还没有填写快速引擎的接口地址');
  return base + suffix;
}

async function explainHttpError(res) {
  let detail = '';
  try {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      detail = j.error?.message || j.message || text.slice(0, 300);
    } catch {
      detail = text.slice(0, 300);
    }
  } catch {
    /* ignore */
  }
  const hint =
    res.status === 401 ? 'key 无效或已过期' :
    res.status === 402 ? '账户余额不足' :
    res.status === 404 ? '接口地址或模型名不对' :
    res.status === 429 ? '请求太频繁或额度用完' : '';
  return new AiError(`HTTP_${res.status}`, `快速引擎返回 ${res.status}${hint ? `（${hint}）` : ''}${detail ? `：${detail}` : ''}`);
}

/** 流式对话，逐段产出文本。 */
export async function* fastStream({ cfg, messages, signal, json = false }) {
  const { key } = resolveFastKey(cfg);
  if (!key) throw new AiError('NO_KEY', '还没有配置快速引擎的 API key');
  const body = { model: cfg.fast.model, messages, stream: true, ...fastExtraBody(cfg) };
  if (json) body.response_format = { type: 'json_object' };
  let res;
  try {
    res = await fetch(fastEndpoint(cfg, '/chat/completions'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw new AiError('ABORTED', '已取消');
    throw new AiError('NETWORK', `连不上快速引擎：${e.cause?.code || e.message}`);
  }
  if (!res.ok) throw await explainHttpError(res);

  const decoder = new TextDecoder();
  let buf = '';
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        const delta = JSON.parse(data).choices?.[0]?.delta;
        if (delta?.content) yield delta.content;
      } catch {
        /* 忽略心跳或不完整的行 */
      }
    }
  }
}

/** 非流式地拿到完整回答。 */
export async function fastComplete(opts) {
  let text = '';
  for await (const delta of fastStream(opts)) text += delta;
  return text;
}

/** 列出接口上可用的模型，方便在设置页里挑。 */
export async function fastListModels(cfg) {
  const { key } = resolveFastKey(cfg);
  if (!key) throw new AiError('NO_KEY', '还没有配置快速引擎的 API key');
  let res;
  try {
    res = await fetch(fastEndpoint(cfg, '/models'), { headers: { authorization: `Bearer ${key}` } });
  } catch (e) {
    throw new AiError('NETWORK', `连不上快速引擎：${e.cause?.code || e.message}`);
  }
  if (!res.ok) throw await explainHttpError(res);
  const j = await res.json();
  return (j.data || []).map((m) => m.id).filter(Boolean).sort();
}

// ───────────────────────── deep：Codex CLI ─────────────────────────

const IS_WIN = process.platform === 'win32';
const CODEX_HOME = () => process.env.CODEX_HOME || path.join(os.homedir(), '.codex');

function childEnv() {
  const extra = IS_WIN ? [] : ['/opt/homebrew/bin', '/usr/local/bin', path.join(os.homedir(), '.npm-global/bin'), path.join(os.homedir(), '.local/bin')];
  return { ...process.env, PATH: [...extra, process.env.PATH || ''].join(path.delimiter) };
}

/** 启动子进程。Windows 上 codex 是 .cmd，必须经 shell，这时把参数拼成一条命令行。 */
function launch(cmd, args, opts) {
  if (!IS_WIN) return spawn(cmd, args, opts);
  const quote = (s) => (/[\s"&|<>^]/.test(s) ? `"${String(s).replace(/"/g, '\\"')}"` : s);
  return spawn([cmd, ...args].map(quote).join(' '), { ...opts, shell: true });
}

/** 一台机器上可能装了不止一个 codex（Homebrew、npm……），而且新模型往往要求新版本，所以挑版本最高的那个。 */
function codexCandidates(cfg) {
  if (cfg.deep.command) return [cfg.deep.command];
  if (IS_WIN) return ['codex'];
  const home = os.homedir();
  const paths = [
    path.join(home, '.npm-global/bin/codex'),
    '/opt/homebrew/bin/codex',
    '/usr/local/bin/codex',
    path.join(home, '.local/bin/codex'),
    path.join(home, '.bun/bin/codex'),
  ].filter((p) => existsSync(p));
  return paths.length ? paths : ['codex'];
}

function versionOf(cmd) {
  return new Promise((resolve) => {
    let out = '';
    let child;
    try {
      child = launch(cmd, ['--version'], { env: childEnv(), stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
      resolve(null);
      return;
    }
    const timer = setTimeout(() => {
      child.kill();
      resolve(null);
    }, 15_000);
    child.stdout.on('data', (d) => (out += d));
    child.on('error', () => {
      clearTimeout(timer);
      resolve(null);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const m = /(\d+)\.(\d+)\.(\d+)/.exec(out);
      resolve(code === 0 && m ? { cmd, text: out.trim(), parts: [Number(m[1]), Number(m[2]), Number(m[3])] } : null);
    });
  });
}

const newer = (a, b) => {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
};

/**
 * 决定用哪个模型。
 * Codex 自己的默认模型可能要求比本机更新的客户端；它本地缓存着“这个账号 + 这个客户端”实际可用的模型列表，
 * 默认模型不在列表里时，就改用列表里的第一个。设置页里手动指定的模型优先。
 */
async function pickModels(cfg) {
  let available = [];
  let configured = '';
  try {
    const cache = JSON.parse(await readFile(path.join(CODEX_HOME(), 'models_cache.json'), 'utf8'));
    available = (cache.models || []).map((m) => m.slug).filter((s) => s && !/review/i.test(s));
  } catch {
    /* 没有缓存就不做判断 */
  }
  try {
    configured = /^model\s*=\s*"([^"]+)"/m.exec(await readFile(path.join(CODEX_HOME(), 'config.toml'), 'utf8'))?.[1] || '';
  } catch {
    /* 没有配置文件 */
  }
  if (cfg.deep.model) return { order: [cfg.deep.model], source: 'setting', configured };
  if (configured && (!available.length || available.includes(configured))) {
    return { order: [configured, ...available.filter((s) => s !== configured)], source: 'codex-config', configured };
  }
  if (available.length) return { order: available, source: 'auto', configured };
  return { order: [configured].filter(Boolean), source: 'codex-config', configured };
}

let probeCache = null;

/** 检查本机 Codex 是否装好并已登录，并确定要用的可执行文件和模型。结果缓存一分钟。 */
export async function probeDeep(cfg, force = false) {
  if (!cfg.deep.enabled) return { ok: false, reason: 'disabled' };
  if (probeCache && !force && Date.now() - probeCache.at < 60_000) return probeCache;
  let best = null;
  for (const cmd of codexCandidates(cfg)) {
    const v = await versionOf(cmd);
    if (v && (!best || newer(v.parts, best.parts))) best = v;
  }
  let result;
  if (!best) result = { ok: false, reason: 'not-found' };
  else if (!existsSync(path.join(CODEX_HOME(), 'auth.json'))) result = { ok: false, reason: 'not-logged-in', version: best.text };
  else {
    const models = await pickModels(cfg);
    result = { ok: true, version: best.text, command: best.cmd, models, model: cfg.deep.model || probeCache?.workingModel || models.order[0] || '' };
  }
  probeCache = { at: Date.now(), workingModel: probeCache?.workingModel, ...result };
  return probeCache;
}

/** 从 Codex 的错误输出里取出那句人能看懂的话。 */
function codexErrorText(stderr) {
  const messages = [...stderr.matchAll(/"message":"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
  const text = messages.length ? messages[messages.length - 1] : stderr.trim().split('\n').filter(Boolean).pop() || '';
  return text.replace(/\\"/g, '"').replace(/\\n/g, ' ').slice(0, 300);
}

const MODEL_UNAVAILABLE = /requires a newer version|not supported|does not exist|not available|unknown model/i;

function runCodex({ cmd, args, prompt, cwd, timeoutSec, signal }) {
  return new Promise((resolve, reject) => {
    const child = launch(cmd, args, { env: childEnv(), cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';
    let settled = false;
    const finish = (fn, v) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(v);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(reject, new AiError('DEEP_TIMEOUT', `深度引擎超过 ${timeoutSec} 秒没有答完，已中止`));
    }, timeoutSec * 1000);
    signal?.addEventListener('abort', () => {
      child.kill('SIGKILL');
      finish(reject, new AiError('ABORTED', '已取消'));
    }, { once: true });
    child.stdout.on('data', () => {});
    child.stderr.on('data', (d) => {
      stderr = (stderr + d).slice(-8000);
    });
    child.on('error', (e) => finish(reject, new AiError('DEEP_SPAWN', `启动 Codex 失败：${e.message}`)));
    child.on('close', (code) => finish(resolve, { code, stderr }));
    child.stdin.on('error', () => {});
    child.stdin.end(prompt);
  });
}

let deepBusy = false;

/**
 * 让 Codex 回答一个问题。prompt 走标准输入；可选 schema 约束最终回答为 JSON。
 * Codex 在只读沙箱里、一个空的临时目录下运行，默认不加载用户的 Codex 配置
 * （那里面的 MCP 工具对“点评一局练习”没有用处，还会让每次启动慢十几秒）。
 */
export async function deepRun({ cfg, prompt, schema, signal }) {
  const probe = await probeDeep(cfg);
  if (!probe.ok) throw new AiError('DEEP_UNAVAILABLE', '深度引擎（Codex）当前不可用');
  if (deepBusy) throw new AiError('DEEP_BUSY', '深度引擎还在处理上一个请求，稍等它说完');
  deepBusy = true;

  const work = path.join(os.tmpdir(), 'seqtrak-academy-codex');
  await mkdir(work, { recursive: true });
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const outFile = path.join(work, `out-${id}.txt`);
  const schemaFile = schema ? path.join(work, `schema-${id}.json`) : null;
  if (schemaFile) await writeFile(schemaFile, JSON.stringify(schema));

  // 设置里指定了模型就只用它，失败了如实报错；
  // 自动模式下先试上次成功的，再按顺序试其它的，而且只有“这个模型用不了”才换下一个
  const order = cfg.deep.model
    ? [cfg.deep.model]
    : [...new Set([probe.workingModel, ...probe.models.order, ''].filter((m) => m !== undefined && m !== null))].slice(0, 4);
  const started = Date.now();
  let lastError = null;
  try {
    for (const model of order) {
      const args = [
        'exec', '--skip-git-repo-check', '--ephemeral', '--color', 'never',
        '-s', 'read-only', '-C', work,
        '-c', `model_reasoning_effort=${cfg.deep.effort || 'low'}`,
        '-o', outFile,
      ];
      if (model) args.push('-m', model);
      if (cfg.deep.ignoreUserConfig !== false) args.push('--ignore-user-config');
      if (schemaFile) args.push('--output-schema', schemaFile);
      args.push('-');

      await rm(outFile, { force: true });
      const { code, stderr } = await runCodex({ cmd: probe.command, args, prompt, cwd: work, timeoutSec: cfg.deep.timeoutSec || 240, signal });
      let text = '';
      try {
        text = (await readFile(outFile, 'utf8')).trim();
      } catch {
        /* 没有输出文件 */
      }
      if (text) {
        if (probeCache && !cfg.deep.model) {
          probeCache.workingModel = model;
          probeCache.model = model;
        }
        return { text, ms: Date.now() - started, model };
      }
      const why = codexErrorText(stderr);
      lastError = new AiError('DEEP_EMPTY', `Codex 没有给出回答（退出码 ${code}）${why ? `：${why}` : ''}`);
      if (!MODEL_UNAVAILABLE.test(why)) break;
    }
    throw lastError || new AiError('DEEP_EMPTY', 'Codex 没有给出回答');
  } finally {
    deepBusy = false;
    rm(outFile, { force: true }).catch(() => {});
    if (schemaFile) rm(schemaFile, { force: true }).catch(() => {});
  }
}
