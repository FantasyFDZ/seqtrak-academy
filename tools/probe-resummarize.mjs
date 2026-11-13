// 开发期：把 data/midi-probe.jsonl 里最近一次“按键体检”的实录，用现在的判读规则重新写一遍结论。
// 用法：node tools/probe-resummarize.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// probe.js 是给浏览器写的，这里只借用它的 summarize()，给它垫几个不会真用到的全局对象
globalThis.window ??= globalThis;
globalThis.document ??= { createElement: () => ({ style: {}, setAttribute() {}, append() {}, addEventListener() {} }), addEventListener() {} };
globalThis.navigator ??= {};
globalThis.localStorage ??= { getItem: () => null, setItem() {} };

const lines = readFileSync(path.join(root, 'data', 'midi-probe.jsonl'), 'utf8').trim().split('\n');
// 这个文件里还有功能键测试（kind: hold-keys）、第 5–8 章的按键（kind: ch5-8，用 tools/probe-ch5-8.mjs 读）、20 秒录音（没有 kind），只挑体检的
const rec = lines.map((l) => JSON.parse(l)).filter((r) => r.kind === 'wizard').at(-1);
if (!rec) {
  console.log('data/midi-probe.jsonl 里还没有“按键体检”的记录');
  process.exit(0);
}
const { summarize } = await import('../public/js/probe.js');
console.log(`体检时间 ${rec.at}，固件 ${rec.firmware}，工程读数 ${JSON.stringify(rec.project)}`);
console.log('当时写下的结论：');
for (const l of rec.summary) console.log('  ' + l);
console.log('按现在的规则重读：');
for (const [ok, text] of summarize(rec.steps, rec.project)) console.log(`  ${ok ? 'OK' : '??'} ${text}`);
