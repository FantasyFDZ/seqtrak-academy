#!/usr/bin/env node
// 小课堂的玩具对不对得上：每一关写的 toy: '名字'，登记表里得有；登记表里有、没有任何关在用的，列出来（清理的候选）。
// 2026-11-18 清老玩具的时候写的，留着防回归：tools/mac-check.sh 里带着它的那一行结果。
//
//   node tools/toy-check.mjs            一行结果 + 有问题的明细；“关里用到、登记表里没有”的不是 0 时退出码是 1
//   node tools/toy-check.mjs --list     另外列出每个玩具用在哪几关、哪个位置，和每个文件里的玩具各有哪几关在用
//   node tools/toy-check.mjs --refs     另外对“登记了没人用”的每一个，列出全仓按名字提到它的地方（删之前人工过一遍用）
//   node tools/toy-check.mjs --refs=a,b 只看这几个名字（不管它有没有人用）
//
// 一行结果里的几个数：
//   missing   关里用到、登记表里没有的。必须是 0（页面上会摆出“还没有这个玩具”）
//   unused    登记表里有、没有任何关在用、也不在下面 KEEP 里的。清理的候选：删之前用 --refs 看还有谁按名字提到它
//             （views/classroom.js 的 SHORT 和 reviewSpec、classroom-toys.js 的 TIER_DEFAULTS、dev/walk-classroom2.js 里按玩具分的走法、样式）
//   kept      有意留着的（KEEP）
//   shadowed  同一个名字登记了两次：后展开的那张表盖掉前面的，被盖掉的那个函数永远走不到。应该是 0；不影响退出码
//
// 怎么取的：
//   关里用到的：直接 import public/js/content/classroom.js 的 LEVELS（内容文件是纯数据，Node 里能跑），
//     递归走每一关的每一个字段，凡是键名叫 toy、值是字符串的都算：play.toy、quiz.toy、接力的 quiz.stages[].toy、
//     三档里换玩具的 quiz.tiers[].toy，以后再往别处嵌也一样收得到。每日五分钟的短版用的就是 quiz.toy（views/classroom.js 的 reviewSpec）。
//     看的是排好以后的清单：cl-theory.js 里老关的原文（被 cl-theory-units.js 的 redo() 换掉的 play / quiz）不算。
//     'hands' 不是玩具：动手关的挑战是一台机器（views/classroom.js 里按 spec.toy === 'hands' 分出去），不算。
//   登记表里的：登记表所在的文件要用浏览器的东西（声音、DOM），Node 里 import 不了，所以读源码取键名：
//     从 public/js/classroom-toys.js 的 const TOYS = { … } 起，取对象字面量最外一层的键（简写的 name、name: 值、'name': 值）；
//     碰到 ...别的表 就顺着同一个文件的 import 找到那张表所在的文件，接着取（RHYTHM_TOYS → RHYTHM2/3/4_TOYS、DJ_TOYS、THEORY_TOYS、THEORY_TOYS3）。
//     取键的时候会跳过注释、字符串和值里面的括号；表里要是出现它看不懂的写法（正则、算出来的键），直接报错，不猜。
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY = 'public/js/classroom-toys.js';
const ENTRY_TABLE = 'TOYS';
const NOT_TOYS = new Set(['hands']);
/** 登记了、没有关在用，但有意留着的：名字 → 为什么 */
const KEEP = {
  ask: '快问快答的通用入口（一行，转给 classroom-ear.js 的 askQuiz）。从来没有关直接写过它，不是换下来的老玩具；askQuiz 本身卡册和每日五分钟都在用',
};
const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const rel = (p) => relative(ROOT, p).split('\\').join('/');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

// ───────────── 关里用到的 ─────────────

const { LEVELS } = await import(pathToFileURL(join(ROOT, 'public/js/content/classroom.js')).href);
/** 名字 → [{ id, path }] */
const used = new Map();
function walk(v, path, id) {
  if (Array.isArray(v)) return v.forEach((x) => walk(x, `${path}[]`, id));
  if (!v || typeof v !== 'object') return;
  for (const [k, x] of Object.entries(v)) {
    const p = path ? `${path}.${k}` : k;
    if (k === 'toy' && typeof x === 'string') {
      if (NOT_TOYS.has(x)) continue;
      if (!used.has(x)) used.set(x, []);
      used.get(x).push({ id, path: p });
    } else walk(x, p, id);
  }
}
for (const level of LEVELS) walk(level, '', level.id);

// ───────────── 登记表里的（读源码） ─────────────

/** 从 src[i]（一个开着的引号）起跳过这个字符串，返回它后面那个位置 */
function skipString(src, i) {
  const q = src[i];
  for (i++; i < src.length; i++) {
    if (src[i] === '\\') i++;
    else if (q === '`' && src[i] === '$' && src[i + 1] === '{') i = skipBraces(src, i + 1) - 1;
    else if (src[i] === q) return i + 1;
  }
  throw new Error('字符串没有合上');
}
/** 从 src[i] 起跳过一段注释，返回它后面那个位置；不是注释就原样返回 i */
function skipComment(src, i) {
  if (src[i] !== '/') return i;
  if (src[i + 1] === '/') {
    const end = src.indexOf('\n', i);
    return end < 0 ? src.length : end;
  }
  if (src[i + 1] === '*') {
    const end = src.indexOf('*/', i);
    if (end < 0) throw new Error('注释没有合上');
    return end + 2;
  }
  throw new Error('登记表里有除号或者正则，这个脚本不认');
}
/** 从 src[i]（一个开括号）起跳到和它配对的闭括号后面 */
function skipBraces(src, i) {
  const close = { '{': '}', '(': ')', '[': ']' }[src[i]];
  for (i++; i < src.length;) {
    const c = src[i];
    if (c === close) return i + 1;
    if (c === '{' || c === '(' || c === '[') i = skipBraces(src, i);
    else if (c === "'" || c === '"' || c === '`') i = skipString(src, i);
    else if (c === '/') i = skipComment(src, i);
    else i++;
  }
  throw new Error('括号没有合上');
}
/** 一张表最外一层的条目：[{ key } | { spread }] */
function tableEntries(file, table) {
  const src = read(file);
  const m = new RegExp(`(?:^|\\n)(?:export\\s+)?const\\s+${table}\\s*=\\s*\\{`).exec(src);
  if (!m) throw new Error(`${file} 里找不到 const ${table} = { … }`);
  const open = m.index + m[0].length - 1;
  const end = skipBraces(src, open);
  if (!/^\s*;/.test(src.slice(end))) throw new Error(`${file} 的 ${table}：表后面不是分号，可能没取对`);
  const body = src.slice(open + 1, end - 1);
  const out = [];
  let item = '';
  const push = () => {
    const t = item.trim();
    item = '';
    if (!t) return;
    let k;
    if ((k = /^\.\.\.([A-Za-z_$][\w$]*)$/.exec(t))) out.push({ spread: k[1] });
    else if ((k = /^([A-Za-z_$][\w$]*)\s*(?::|\(|$)/.exec(t))) out.push({ key: k[1] });
    else if ((k = /^(['"])([^'"\\]+)\1\s*:/.exec(t))) out.push({ key: k[2] });
    else throw new Error(`${file} 的 ${table}：这一项看不懂：${t.slice(0, 60)}`);
  };
  for (let i = 0; i < body.length;) {
    const c = body[i];
    if (c === ',') {
      push();
      i++;
      continue;
    }
    if (c === '/') {
      i = skipComment(body, i);
      continue;
    }
    const j = c === '{' || c === '(' || c === '[' ? skipBraces(body, i) : c === "'" || c === '"' || c === '`' ? skipString(body, i) : i + 1;
    item += body.slice(i, j);
    i = j;
  }
  push();
  return out;
}
/** 这个文件里，名字 name 是从哪个文件 import 来的（没有 import 就是它自己） */
function sourceOf(file, name) {
  for (const m of read(file).matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    for (const part of m[1].split(',')) {
      const [orig, alias] = part.trim().split(/\s+as\s+/);
      if ((alias || orig) === name) return { file: rel(resolve(join(ROOT, dirname(file)), m[2])), name: orig };
    }
  }
  return { file, name };
}
/** 展开以后的登记：按展开的先后，[{ name, file, table }]（同一个名字可能出现不止一次） */
function registrations(file, table) {
  const out = [];
  for (const e of tableEntries(file, table)) {
    if (e.key) out.push({ name: e.key, file, table });
    else {
      const from = sourceOf(file, e.spread);
      out.push(...registrations(from.file, from.name));
    }
  }
  return out;
}

/** 名字 → 生效的那一条登记（后面的盖掉前面的） */
const registered = new Map();
const shadowed = [];
for (const r of registrations(ENTRY, ENTRY_TABLE)) {
  if (registered.has(r.name)) shadowed.push({ name: r.name, lost: registered.get(r.name), won: r });
  registered.set(r.name, r);
}

// ───────────── 结果 ─────────────

const ids = (list) => [...new Set(list.map((u) => u.id))].join('、');
const missing = [...used.keys()].filter((n) => !registered.has(n)).sort();
const idle = [...registered.keys()].filter((n) => !used.has(n)).sort();
const unused = idle.filter((n) => !KEEP[n]);
const kept = idle.filter((n) => KEEP[n]);
const stale = Object.keys(KEEP).filter((n) => !idle.includes(n)); // KEEP 里写着、其实已经有关在用（或者已经不在登记表里）的

console.log(`toy-check: levels=${LEVELS.length} used=${used.size} registered=${registered.size} missing=${missing.length} unused=${unused.length} kept=${kept.length} shadowed=${shadowed.length}`);
if (missing.length) {
  console.log('关里用到、登记表里没有的（要修）：');
  for (const n of missing) console.log(`  ${n}  用在 ${used.get(n).map((u) => `${u.id} ${u.path}`).join('、')}`);
}
if (unused.length) {
  console.log('登记表里有、没有任何关在用的：');
  for (const n of unused) console.log(`  ${n}  （${registered.get(n).file} 的 ${registered.get(n).table}）`);
}
if (shadowed.length) {
  console.log('同一个名字登记了两次（后面的盖掉前面的，被盖掉的那个走不到）：');
  for (const s of shadowed) console.log(`  ${s.name}  生效的是 ${s.won.file} 的 ${s.won.table}，被盖掉的是 ${s.lost.file} 的 ${s.lost.table}；写着它的关：${used.has(s.name) ? ids(used.get(s.name)) : '没有'}`);
}
if (stale.length) console.log(`这个脚本的 KEEP 里有过期的名字（已经有关在用，或者已经不在登记表里）：${stale.join('、')}`);

if (flag('list')) {
  if (kept.length) {
    console.log('\n有意留着的：');
    for (const n of kept) console.log(`  ${n}  ${KEEP[n]}`);
  }
  console.log('\n每个玩具用在哪：');
  for (const n of [...registered.keys()].sort()) {
    const u = used.get(n) || [];
    console.log(`  ${n.padEnd(12)} ${registered.get(n).file.replace('public/js/', '').padEnd(22)} ${u.length ? u.map((x) => `${x.id}:${x.path}`).join(' ') : '（没有关用）'}`);
  }
  console.log('\n每个文件里的玩具，有哪几关在用：');
  const byFile = new Map();
  for (const [n, r] of registered) {
    if (!byFile.has(r.file)) byFile.set(r.file, new Set());
    for (const u of used.get(n) || []) byFile.get(r.file).add(u.id);
  }
  const order = new Map(LEVELS.map((l, i) => [l.id, i]));
  for (const [f, set] of byFile) console.log(`  ${f}（${set.size} 关）：${[...set].sort((a, b) => order.get(a) - order.get(b)).join(' ')}`);
}

const refs = flag('refs');
if (refs) {
  // 全仓按名字搜（前后不是字母、数字、下划线、$、连字符才算）：代码、样式、页面、脚本、文档。
  // 常见的词（比如 stack、ask）会搜出一大堆不相干的，得人看；它自己的函数定义、文档里的也列出来，前面标着是什么
  const names = refs.includes('=') ? refs.split('=')[1].split(',').filter(Boolean) : idle;
  const files = [];
  const SKIP = new Set(['node_modules', 'out', 'data', 'data-dev', 'img', 'icons']);
  const scan = (dir) => {
    for (const name of readdirSync(join(ROOT, dir))) {
      if (SKIP.has(name) || name.startsWith('.')) continue;
      const p = dir ? `${dir}/${name}` : name;
      if (statSync(join(ROOT, p)).isDirectory()) scan(p);
      else if (/\.(js|mjs|css|html|sh|py|md)$/.test(name)) files.push(p);
    }
  };
  scan('');
  const texts = files.map((f) => [f, read(f).split('\n')]);
  for (const n of names) {
    console.log(`\n── ${n} ──`);
    const re = new RegExp(`(^|[^A-Za-z0-9_$-])${n}(?![A-Za-z0-9_$-])`);
    const def = new RegExp(`function\\s+${n}\\s*\\(`);
    for (const [f, lines] of texts) {
      lines.forEach((line, i) => {
        if (re.test(line)) console.log(`  [${def.test(line) ? '定义' : f.endsWith('.md') ? '文档' : '提到'}] ${f}:${i + 1}: ${line.trim().slice(0, 150)}`);
      });
    }
  }
}

process.exit(missing.length ? 1 : 0);
