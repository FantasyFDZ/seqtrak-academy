// 本地配置：AI 引擎的地址、模型与 key。保存在项目根目录的 config.local.json（不进版本库）。
// key 可以直接填在设置页里，也可以让服务从一个 .env 文件里按变量名读（config.local.json 里的 envFile），
// 这样密钥只存在一处。
import { readFile, writeFile, chmod } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = path.join(ROOT, 'config.local.json');

/**
 * env：依次尝试的 key 变量名；baseEnv / modelsEnv：.env 文件里如果写了地址和模型，就用它们当默认值；
 * modelEnv：.env 文件里单独点名“默认用哪个模型”的变量（有它就不取模型清单里的第一个）
 */
const PRESET_DEFS = {
  // 自己部署的模型网关（地址和 key 都在 .env 文件里，这里不写死）。上面的 deepseek-flash-256k 是现在的即时引擎。
  // extra：请求里要另外带上的参数。网关上的 DeepSeek 默认先“思考”一两秒再出字，即时引擎要的是马上出字，所以关掉
  // （实测正文首字从 1–3.5 秒降到 0.5 秒，数在 docs/model-comparison.md）。网关上别的模型不认这个参数，就不带。
  knight: {
    label: 'Knight AI 网关（DeepSeek 256K）', baseUrl: '', model: 'deepseek-flash-256k', env: ['KNIGHT_AI_API_KEY'], baseEnv: 'KNIGHT_AI_BASE_URL', modelEnv: 'KNIGHT_AI_MODEL_DEEPSEEK_256K', modelsEnv: 'KNIGHT_AI_TEXT_MODELS',
    extra: (model) => (/^deepseek/i.test(model) ? { thinking: { type: 'disabled' } } : {}),
  },
  deepseek: { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', env: ['DEEPSEEK_API_KEY'], baseEnv: 'DEEPSEEK_BASE_URL', modelsEnv: 'DEEPSEEK_MODELS' },
  kimi: { label: 'Kimi', baseUrl: 'https://api.moonshot.cn/v1', model: 'kimi-latest', env: ['KIMI_API_KEY', 'MOONSHOT_API_KEY', 'KIMI_CODING_API_KEY'], baseEnv: 'KIMI_CODING_BASE_URL', modelsEnv: 'KIMI_CODING_MODELS' },
  custom: { label: '自定义 (OpenAI 兼容)', baseUrl: '', model: '', env: ['SEQTRAK_FAST_API_KEY', 'OPENAI_API_KEY'] },
};

const DEFAULTS = {
  envFile: '',
  fast: { preset: 'deepseek', baseUrl: PRESET_DEFS.deepseek.baseUrl, model: PRESET_DEFS.deepseek.model, apiKey: '' },
  // model 留空 = 自动（优先 Codex 自己的默认模型，它不可用时换成账号可用的第一个）
  // ignoreUserConfig = 不加载 ~/.codex/config.toml 里的 MCP 服务器等，启动更快，也不把那些工具带进教练的调用
  deep: { enabled: true, command: '', model: '', effort: 'low', ignoreUserConfig: true, timeoutSec: 240 },
};

let cache = null;
let fileEnv = {};

async function loadEnvFile(envFile) {
  fileEnv = {};
  if (!envFile) return;
  try {
    const text = await readFile(path.resolve(ROOT, envFile), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      else v = v.replace(/\s+#.*$/, '');
      fileEnv[m[1]] = v;
    }
  } catch {
    /* 文件不在就当没有 */
  }
}

export async function loadConfig() {
  if (cache) return cache;
  let saved = {};
  try {
    saved = JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
  } catch {
    /* 第一次运行还没有配置文件 */
  }
  cache = {
    envFile: typeof saved.envFile === 'string' ? saved.envFile : DEFAULTS.envFile,
    fast: { ...DEFAULTS.fast, ...(saved.fast || {}) },
    deep: { ...DEFAULTS.deep, ...(saved.deep || {}) },
  };
  await loadEnvFile(cache.envFile);
  return cache;
}

/** 快速引擎实际使用的 key：设置页里填的优先，其次是 .env 文件，最后是进程的环境变量。 */
export function resolveFastKey(cfg) {
  if (cfg.fast.apiKey) return { key: cfg.fast.apiKey, source: 'config' };
  const preset = PRESET_DEFS[cfg.fast.preset] || PRESET_DEFS.custom;
  for (const name of preset.env) {
    if (fileEnv[name]) return { key: fileEnv[name], source: `file:${name}` };
  }
  for (const name of preset.env) {
    if (process.env[name]) return { key: process.env[name], source: `env:${name}` };
  }
  return { key: '', source: 'none' };
}

/** 快速引擎的请求里要另外带上的参数（看 PRESET_DEFS 里那个服务商的 extra）；没有就是空的。 */
export function fastExtraBody(cfg) {
  return PRESET_DEFS[cfg.fast.preset]?.extra?.(cfg.fast.model || '') || {};
}

function maskKey(key) {
  if (!key) return '';
  return key.length <= 8 ? '••••' : `${key.slice(0, 3)}••••${key.slice(-4)}`;
}

/** 各服务商的默认地址和模型；.env 文件里写了的话以它为准。 */
function presets() {
  const out = {};
  for (const [id, p] of Object.entries(PRESET_DEFS)) {
    const models = (p.modelsEnv && fileEnv[p.modelsEnv] ? fileEnv[p.modelsEnv].split(',').map((s) => s.trim()).filter(Boolean) : []);
    out[id] = {
      label: p.label,
      baseUrl: (p.baseEnv && fileEnv[p.baseEnv]) || p.baseUrl,
      model: (p.modelEnv && fileEnv[p.modelEnv]) || models[0] || p.model,
      models,
    };
  }
  return out;
}

/** 给前端看的配置：key 只显示打码后的样子。 */
export function publicConfig(cfg) {
  const resolved = resolveFastKey(cfg);
  return {
    envFile: cfg.envFile,
    fast: {
      preset: cfg.fast.preset,
      baseUrl: cfg.fast.baseUrl,
      model: cfg.fast.model,
      keyMasked: maskKey(resolved.key),
      keySource: resolved.source,
    },
    deep: { ...cfg.deep },
    presets: presets(),
  };
}

export async function saveConfig(patch) {
  const cfg = await loadConfig();
  if (typeof patch.envFile === 'string') {
    cfg.envFile = patch.envFile.trim();
    await loadEnvFile(cfg.envFile);
  }
  if (patch.fast) {
    const f = patch.fast;
    if (typeof f.preset === 'string' && PRESET_DEFS[f.preset]) cfg.fast.preset = f.preset;
    if (typeof f.baseUrl === 'string') cfg.fast.baseUrl = f.baseUrl.trim();
    if (typeof f.model === 'string') cfg.fast.model = f.model.trim();
    // apiKey: 只有传了非空字符串才覆盖；传 null 表示清除
    if (typeof f.apiKey === 'string' && f.apiKey.trim()) cfg.fast.apiKey = f.apiKey.trim();
    if (f.apiKey === null) cfg.fast.apiKey = '';
  }
  if (patch.deep) {
    const d = patch.deep;
    if (typeof d.enabled === 'boolean') cfg.deep.enabled = d.enabled;
    if (typeof d.command === 'string') cfg.deep.command = d.command.trim();
    if (typeof d.model === 'string') cfg.deep.model = d.model.trim();
    if (['minimal', 'low', 'medium', 'high', 'xhigh'].includes(d.effort)) cfg.deep.effort = d.effort;
    if (typeof d.ignoreUserConfig === 'boolean') cfg.deep.ignoreUserConfig = d.ignoreUserConfig;
    if (Number.isFinite(d.timeoutSec)) cfg.deep.timeoutSec = Math.min(900, Math.max(30, Math.round(d.timeoutSec)));
  }
  await writeFile(CONFIG_PATH, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 });
  // 文件已存在时 writeFile 不会改权限；里面可能有 API key，确保只有本人可读
  await chmod(CONFIG_PATH, 0o600).catch(() => {});
  return cfg;
}
