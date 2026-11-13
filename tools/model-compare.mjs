// 开发期工具：把同一局练习交给几个模型点评，比较耗时和回答。
// 用的是和正式服务完全相同的人设、知识库和调用参数，所以结果能代表教练实际的表现。
//
// 用法（在 Mac 上）：
//   node tools/model-compare.mjs gpt-5.6-sol gpt-6-chat-thinking     Codex 里的模型
//   node tools/model-compare.mjs fast:deepseek-flash fast:deepseek-v4-pro   即时引擎（设置里的那个接口）上的模型
// Codex 的模型只跑“深度点评”；fast: 开头的会跑两遍：同一份深度点评提示词，以及它在应用里实际扮演的“即时短答”。
import { loadConfig } from '../server/config.mjs';
import { probeDeep, deepRun, fastStream } from '../server/ai.mjs';
import { buildDeepPrompt, buildFastMessages } from '../server/coach.mjs';

const targets = process.argv.slice(2);
if (!targets.length) {
  console.log('用法：node tools/model-compare.mjs <模型名 | fast:模型名> …');
  process.exit(1);
}

// 一局有明确弱点的练习：三轨 House 鼓组，反拍镲又漏又抢，底鼓和拍手没问题
const contextText = `学生现在在：节拍与鼓 · 1.4「镲：把时间切细」· 第 8/8 步「三条轨道：House 鼓组」（练习）
教学要点：三轨 House 鼓组：四踩底鼓 + 2/4 拍手 + 反拍闭镲。难点是第 2、4 拍底鼓和拍手同时按，以及反拍镲不能滑到正拍。可以建议降速到 70%。
设备：SEQTRAK 已用 USB 连接（固件 V1.20），机器速度 120 BPM，已停止，当前选中的轨道是 KICK。
进度：已完成的课 0-1、0-2、1-1、1-2、1-3；本周已经练了 2 天；输入延迟校准值 18ms。
最近一局练习的数据：
练习「House 鼓组」：120 BPM，1 小节 × 4 圈，模式：只有节拍器，输入方式：SEQTRAK 实机。
结果：准确率 58%（未通过，0 星），PERFECT 9 / GREAT 12 / OK 6 / MISS 13，共 40 个音，多按 4 下，最高连击 7。
时间偏差（负数=早，正数=晚）：平均 −33ms，波动（标准差）±41ms，后半段相对前半段 −18ms。
按轨道：KICK 打中 15/16（平均 −12ms）；CLAP 打中 7/8（平均 −20ms）；HAT 1 打中 5/16（平均 −71ms）。
按拍位：正拍 22/24；反拍（& 的位置） 5/16。
最常漏的步（一小节 16 步，从 1 数起）：第 7 步漏 4 次，第 15 步漏 3 次，第 3 步漏 3 次，第 11 步漏 3 次。
谱面（x=有音，-=空）：KICK x---x---x---x---；CLAP ----x-------x---；HAT1 --x---x---x---x-`;

const question = '请点评我刚才这一局，告诉我最该改进的一点，以及接下来怎么练。我在机器上该怎么操作？';
const messages = [{ role: 'user', content: question }];
const deepPrompt = await buildDeepPrompt({ messages, contextText });
const fastMessages = await buildFastMessages({ messages, contextText });
console.log(`深度点评提示词：${deepPrompt.length} 字`);

const base = await loadConfig();

async function runFast(model, label, msgs) {
  const cfg = { ...base, fast: { ...base.fast, model } };
  const t0 = Date.now();
  let first = 0;
  let text = '';
  try {
    for await (const d of fastStream({ cfg, messages: msgs })) {
      if (!first) first = Date.now() - t0;
      text += d;
    }
    console.log(`\n===== ${model} · ${label} · 首字 ${(first / 1000).toFixed(1)} 秒 · 共 ${((Date.now() - t0) / 1000).toFixed(1)} 秒 · ${text.length} 字 =====\n${text}`);
  } catch (e) {
    console.log(`\n===== ${model} · ${label} · 失败：${e.message}`);
  }
}

for (const target of targets) {
  if (target.startsWith('fast')) {
    const model = target.includes(':') ? target.slice(target.indexOf(':') + 1) : base.fast.model;
    await runFast(model, '深度点评（与 GPT 同题）', [{ role: 'user', content: deepPrompt }]);
    await runFast(model, '即时短答（应用里的实际用法）', fastMessages);
    continue;
  }
  const cfg = { ...base, deep: { ...base.deep, model: target } };
  await probeDeep(cfg, true);
  try {
    const r = await deepRun({ cfg, prompt: deepPrompt });
    console.log(`\n===== ${target} · 深度点评 · ${(r.ms / 1000).toFixed(1)} 秒 · ${r.text.length} 字 =====\n${r.text}`);
  } catch (e) {
    console.log(`\n===== ${target} · 失败：${e.message}`);
  }
}
