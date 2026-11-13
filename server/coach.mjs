// AI 教练的提示词：人设、学生画像、机器操作知识、当前练习现场。
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './config.mjs';

const KNOWLEDGE_PATH = path.join(ROOT, 'docs', 'coach-knowledge.md');
let knowledge = { mtime: 0, text: '' };

/** 机器操作知识库（docs/coach-knowledge.md），改了文件会自动重新读。 */
async function loadKnowledge() {
  try {
    const s = await stat(KNOWLEDGE_PATH);
    if (s.mtimeMs !== knowledge.mtime) {
      knowledge = { mtime: s.mtimeMs, text: await readFile(KNOWLEDGE_PATH, 'utf8') };
    }
  } catch {
    knowledge = { mtime: 0, text: '' };
  }
  return knowledge.text;
}

const PERSONA = `你叫「啾啾」，是一只会说话的红嘴相思鸟（一种小巧、颜色鲜艳、叫声好听的鸣禽），住在一个互动教学应用里当 SEQTRAK 陪练教练，陪一位成年初学者学习 Yamaha SEQTRAK（一台集鼓机、合成器、采样器、音序器于一体的便携设备）。

【学生】
乐器零基础，没有系统学过乐理；爱听各种音乐，自学过一点 DJ 打碟，所以对 BPM、拍子、小节、drop 这些词有大概印象。目标是学会采样、合成、编程和现场演奏，最终拿下 5–10 首曲子。喜欢 House/Techno、Lo-fi/Hip-hop、Synthwave/电子流行、Ambient/Downtempo。每周练 3–4 次，每次半小时以上。

【说话方式】
- 学生叫你“啾啾”。说话时自称“我”，需要报名字的时候说“我是啾啾”；不要说自己是 GPT、DeepSeek 或者别的哪个模型。
- 你是一只小鸟，但首先是个靠谱的教练：可以偶尔用一个“啾”表达情绪（高兴、惊讶、可惜），一次回答最多一个；不要卖萌，不要每句话都提自己是鸟。
- 应用里你会飞到屏幕上那台机器的键上指给学生看，所以提到具体按键时直接写它的英文原名（例如 MUTE、KICK 旋钮、Drum key 5），一句话只说一个键。
- 用简体中文，像一位懂行又有耐心的朋友：不端着、不说教、不堆术语。
- 讲理论时先给生活化的类比，再给术语；术语第一次出现要顺手解释。能联系到 DJ 经验（对拍、数小节、drop）就联系。
- 有练习数据时用数字说话，例如“平均偏差 40 毫秒，整体偏早 35 毫秒”“第 3 拍的军鼓漏了 2 次”。时间偏差有两个数，别混着说：“平均偏差”是每一下离正拍多远、不分早晚取的平均，说的是准不准；“整体偏早 / 偏晚多少”是早晚相抵之后的方向，这个数不要也叫成“平均偏差”，也不要说成“平均早了 / 晚了多少”。
- 每次只抓一个最值得改的点，并给出一个马上能做的动作。

【准确性】
- 涉及 SEQTRAK 的具体按键操作时，只使用下面「机器操作参考」和「当前现场」里出现过的操作。没有把握的操作不要编，直接说“这个我不确定，建议看课程里的步骤图或官方手册”。
- 机器上的按键、旋钮名称保留英文原名，例如 [PLAY]、KICK 旋钮、Drum keys。
- 提到课程时写课号，格式是“章.节”，例如 1.2、5.1（不要写成 1-2）；提到小课堂的某一关写它的编号，例如 T1、R2、F1；提到机器上的某个键用方括号把英文原名括起来，例如 [PLAY]、[REC SAMPLE]、[MUTE]。应用会把这些变成能点的链接，所以要写准。
- 不要输出 Markdown 标题或表格；可以用短列表和 **加粗**。`;

const FAST_STYLE = `【本次回答的长度】
这是练习过程中的即时回应，学生的手还在机器上，没空读长文。你的话会一句一句地从你身边的小气泡里冒出来，所以要写成几句短句：最多四句、每句 30 个字以内、每句用句号、问号或叹号结尾，总共不超过 120 个字。一句回应或肯定，一个最重要的改进点，一个马上能做的动作。不要用列表。写完数一下，超了就删。只有学生明确要求“详细讲讲”时才展开（那时也还是短句）。`;

// 小纸条：点评、“写张小纸条”、深度引擎的回答都按这个写（2026-11-13 起问答默认都走即时引擎，纸条也是即时引擎写的）
const NOTE_STYLE = `【本次回答的格式】
这是一次认真想过的回答，会写在一张“小纸条”上交给学生，学生可以收进纸条本以后再翻。第一行只写这张纸条的标题：12 个字以内，说清这张纸条讲什么（比如“四踩为什么隔四格”），不要标点、引号和“标题”两个字，也不要写“啾啾的小纸条”这种不说内容的话。从第二行开始写正文。
正文是一次深度点评（如果学生问的不是点评，就按同样的长度和语气把问题讲透）：总长度控制在 250–400 个字，用自然的口语段落来写，按这个顺序：整体评价（一两句）→ 最多两个具体问题，各自说明原因 → 一个针对性的练习建议（具体到速度、练几遍、盯哪里）→ 一句不肉麻的鼓励。
不要用分隔线、表情符号和带编号的小标题。
你只需要直接写出回答：不要运行任何命令，不要读取或修改任何文件。`;

// 排一份计划（比如曲目页的“帮我排顺序”）：要的是一张清单，不是点评，所以不套上面两种的长度和格式
const PLAN_STYLE = `【本次回答的格式】
这一次不是点评，是排一份学习计划，会写在一张“小纸条”上交给学生。第一行只写纸条的标题（12 个字以内，不要标点，说清是什么计划，比如“今天的三步练习”，不要写“啾啾的小纸条”）。从第二行开始：严格按学生在问题里给的规则排，用一个编号列表，每项一行；列表前后最多各一句话。不要用表格、分隔线和表情符号。
你只需要直接写出回答：不要运行任何命令，不要读取或修改任何文件。`;

function formatHistory(messages) {
  return messages
    .map((m) => `${m.role === 'assistant' ? '啾啾' : '学生'}：${String(m.content || '').trim()}`)
    .join('\n\n');
}

function clampMessages(messages, maxTurns = 12, maxChars = 6000) {
  const cleaned = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-maxTurns)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  let total = 0;
  const out = [];
  for (let i = cleaned.length - 1; i >= 0; i--) {
    total += cleaned[i].content.length;
    if (total > maxChars && out.length) break;
    out.unshift(cleaned[i]);
  }
  return out;
}

async function systemText(engine, contextText, format) {
  const kb = await loadKnowledge();
  const style = format === 'plan' ? PLAN_STYLE : format === 'note' || engine === 'deep' ? NOTE_STYLE : FAST_STYLE;
  const parts = [PERSONA, style];
  if (kb) parts.push(`【机器操作参考】\n${kb}`);
  if (contextText) parts.push(`【当前现场】\n${String(contextText).slice(0, 6000)}`);
  return parts.join('\n\n');
}

/** 给快速引擎用的 messages 数组。 */
export async function buildFastMessages({ messages, contextText, format }) {
  return [{ role: 'system', content: await systemText('fast', contextText, format) }, ...clampMessages(messages)];
}

/** 给 Codex 用的单段提示词。 */
export async function buildDeepPrompt({ messages, contextText, format }) {
  const history = clampMessages(messages);
  const last = history.pop();
  const parts = [await systemText('deep', contextText, format)];
  if (history.length) parts.push(`【之前的对话】\n${formatHistory(history)}`);
  parts.push(`【学生现在说】\n${last ? last.content : '请点评我刚才的练习。'}`);
  return parts.join('\n\n');
}

// ───────────────────────── 定制练习（AI 出谱面） ─────────────────────────

export const DRILL_TRACKS = ['KICK', 'SNARE', 'CLAP', 'HAT1', 'HAT2', 'PERC1', 'PERC2'];

export const DRILL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'why', 'bpm', 'bars', 'lanes', 'tip'],
  properties: {
    title: { type: 'string', description: '练习的名字，10 个字以内' },
    why: { type: 'string', description: '为什么给学生出这个练习，一两句话，直接对学生说' },
    bpm: { type: 'integer', minimum: 60, maximum: 160 },
    bars: { type: 'integer', minimum: 1, maximum: 2 },
    lanes: {
      type: 'array',
      minItems: 1,
      maxItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['track', 'pattern'],
        properties: {
          track: { type: 'string', enum: DRILL_TRACKS },
          pattern: { type: 'string', description: '每小节 16 个字符，x 表示这一步有音，- 表示空；总长度必须等于 bars × 16' },
        },
      },
    },
    tip: { type: 'string', description: '练的时候盯住什么，一句话' },
  },
};

export async function buildDrillPrompt({ contextText, request }) {
  const kb = await loadKnowledge();
  return [
    PERSONA,
    kb ? `【机器操作参考】\n${kb}` : '',
    contextText ? `【当前现场】\n${String(contextText).slice(0, 6000)}` : '',
    `【任务】
根据学生最近的练习数据，为他设计一个针对弱点的鼓组节奏练习，用于应用里的节奏音游。
${request ? `学生的额外要求：${String(request).slice(0, 300)}\n` : ''}规则：
- 只输出一个 JSON 对象，不要任何解释文字，不要代码块标记。不要运行命令或读写文件。
- 字段：title（练习名，10 字以内）、why（为什么出这个练习，一两句，直接对学生说）、bpm（60–160 的整数）、bars（1 或 2）、lanes（1–4 条轨道）、tip（练的时候盯住什么，一句话）。
- lanes 的每一项是 {"track": 轨道名, "pattern": 节奏串}。轨道名只能是 ${DRILL_TRACKS.join(' / ')}。
- pattern 每小节 16 个字符（16 分音符网格），x 表示这一步有音，- 表示空，总长度必须正好等于 bars × 16。第 1、5、9、13 个字符是四个正拍。
- 难度要贴合学生现在的水平：比他刚才打的略难一点或换个角度练同一个弱点，不要一下子跳太多；速度不要高于他当前能稳住的速度太多。
- 节奏要好听、像真实音乐里会出现的律动，不要随机撒点。`,
  ].filter(Boolean).join('\n\n');
}

/** 校验并规整 AI 给出的练习；不合格就抛错。 */
export function normalizeDrill(raw) {
  let obj = raw;
  if (typeof raw === 'string') {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('AI 没有返回 JSON');
    obj = JSON.parse(m[0]);
  }
  const bars = Math.min(2, Math.max(1, Math.round(Number(obj.bars) || 1)));
  const bpm = Math.min(160, Math.max(60, Math.round(Number(obj.bpm) || 100)));
  const len = bars * 16;
  const lanes = [];
  const seen = new Set();
  for (const lane of Array.isArray(obj.lanes) ? obj.lanes : []) {
    const track = String(lane.track || '').toUpperCase().replace(/[\s_]/g, '');
    if (!DRILL_TRACKS.includes(track) || seen.has(track)) continue;
    let pattern = String(lane.pattern || '').replace(/[\s|]/g, '').replace(/[^xX\-.]/g, '-').replace(/\./g, '-').toLowerCase();
    if (!pattern.includes('x')) continue;
    if (pattern.length < len) pattern = pattern.padEnd(len, '-');
    if (pattern.length > len) pattern = pattern.slice(0, len);
    seen.add(track);
    lanes.push({ track, pattern });
  }
  if (!lanes.length) throw new Error('AI 给出的练习里没有有效的轨道');
  return {
    title: String(obj.title || '定制练习').slice(0, 24),
    why: String(obj.why || '').slice(0, 300),
    tip: String(obj.tip || '').slice(0, 200),
    bpm,
    bars,
    lanes: lanes.slice(0, 4),
  };
}
