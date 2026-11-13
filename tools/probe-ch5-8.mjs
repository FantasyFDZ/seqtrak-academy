// 开发期：把 data/midi-probe.jsonl 里最近一次“第 5–8 章的按键”（「设备」页 → 排查问题用的 → 按键体检 → 第 5–8 章的按键，
// kind: "ch5-8"）读成人看得懂的样子：每一步机器发来了什么（只归类，不判断）、用户看到了什么、7 个采样位的名字前后怎么变。
// 用法：node tools/probe-ch5-8.mjs            读 data/ 里最近的一次
//       node tools/probe-ch5-8.mjs 某个.jsonl  读别的文件（比如测试服务的 data-walk-ch4/midi-probe.jsonl）
//       加 --raw                               每一步再把收到的原始消息逐条列出来（毫秒、类型、十六进制）
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// probe.js 是给浏览器写的，这里只借用它的几个纯函数，给它垫几个不会真用到的全局对象
globalThis.window ??= globalThis;
globalThis.document ??= { createElement: () => ({ style: {}, setAttribute() {}, append() {}, addEventListener() {} }), addEventListener() {} };
globalThis.navigator ??= {};

const args = process.argv.slice(2);
const raw = args.includes('--raw');
const file = args.find((a) => !a.startsWith('--')) || path.join(root, 'data', 'midi-probe.jsonl');
const rec = readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((r) => r.kind === 'ch5-8').at(-1);
if (!rec) {
  console.log(`${file} 里还没有“第 5–8 章的按键”的记录（kind: "ch5-8"）`);
  process.exit(0);
}
const { describeEvents, nameCheckpoints } = await import('../public/js/probe.js');

console.log(`时间 ${rec.at}　固件 ${rec.firmware}　SysEx ${rec.sysex ? '已授权' : '没授权（名字没读）'}${rec.partial ? '　（做到一半点了“退出”，只有前面几步）' : ''}`);
for (const [i, r] of rec.steps.entries()) {
  const head = `${String(i + 1).padStart(2)}. ${r.title}　[${r.id}]　工程 ${r.project === null || r.project === undefined ? '?' : r.project + 1}　${r.ms ? `${(r.ms / 1000).toFixed(1)} 秒` : ''}`;
  console.log(`\n${head}${r.skipped ? '　跳过了' : ''}${r.left ? '　（点“退出”时停在这一步）' : ''}`);
  if (r.answer?.length) console.log(`    你看到：${r.answer.join('、')}`);
  if (r.marked) console.log(`    你标的亮灯：${Object.entries(r.marked).map(([k, v]) => `${k} ${v}`).join('、') || '一个都没亮'}`);
  if (r.skipped) continue;
  const lines = describeEvents(r.events);
  console.log(lines.length ? lines.map((l) => `    ${l}`).join('\n') : '    机器没发消息');
  if (raw) for (const e of r.events) console.log(`      ${String(e.ms).padStart(6)}ms  ${e.type.padEnd(7)} ${e.hex}`);
}

const cols = nameCheckpoints(rec.steps, rec.final);
if (cols.length) {
  console.log('\n采样位的名字（50 eA 00–3F，只读）：');
  console.log(`    位  ${cols.map((c) => c.label).join(' │ ')}`);
  for (let s = 1; s <= 7; s++) {
    const vals = cols.map((c) => c.names[s - 1]?.name ?? '—');
    console.log(`    ${s}${new Set(vals).size > 1 ? '*' : ' '}  ${vals.map((v) => v || '（空）').join(' │ ')}`);
  }
  console.log('    （* = 前后读到的不一样）');
  if (raw) for (const c of cols) console.log(`    ${c.label} 第 7 个位的原始字节：${c.names[6]?.hex}`);
}
