// 从一首歌的 SEQTRAK 版分轨（content/song-parts.js）自动生成“一轨一轨照着搭”的课。
// 《Faded》那一节是手写的（song-lessons.js，用的是“先做好第 1 小节、加长照抄、再一页页改”的省事做法）；
// 其余的歌都用这里生成：先加长到整首的长度，再一页一页照着填。步骤和《Faded》一样：
//   先听 → 准备（工程、速度、摇摆、音阶和调）→ 鼓（编程挑战，计分）→ 每条合成器轨一步（贝斯 / 和弦 / 旋律）→ 加混响 → 一层层听
// 每一步上挂着 song / role / part（给 dev/walk-ch3.js 的通用走法用：它照着分轨数据在模拟机上把课走一遍）。
// 课文里的字、核对的目标都是从分轨数据算的：改分轨，课跟着变。
import { synthKeyNote, SCALES, KEY_NAMES } from '../scales.js';
import { TRACK } from '../tracks.js';
import { LAYERS } from './song-parts.js';

const pretty = (name) => name.replace('#', '♯');
const noteName = (midi) => pretty(KEY_NAMES[((midi % 12) + 12) % 12]);
const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
const list = (xs) => xs.join('、');
const at = (s) => (s % 16) + 1; // 一页里第几个步进键
// 模拟机里每条合成器轨一开始的八度（simulator.js 的 makeProject）；真机上不一定，课文里让他看一眼
const SIM_OCTAVE = { SYNTH1: -2, SYNTH2: 0, DX: 0 };
const PAGE_LIGHTS = '翻到第几页，右边那列小灯里会有一个青蓝色的灯在闪：最下面那个是第 1 页，往上依次是第 2、3、4 页。';

/** KEY 那一列灯怎么亮：自下而上 7 个灯是 C D E F G A B，升半音是相邻两个灯一起亮 */
function keyLights(key) {
  const name = KEY_NAMES[key];
  return name.includes('#') ? `${KEY_NAMES[key - 1]}、${KEY_NAMES[(key + 1) % 12]} 两个灯一起亮` : `${name} 那个灯亮`;
}

const pitchOf = (song, part, [, k, , shift = 0]) => synthKeyNote(k, { scale: song.scale, key: song.key, octave: (part.octave || 0) + shift });

/** 一条合成器分轨在 [from, to) 这几步里：每一步是第几个键 / 实际是哪个音 */
export const keysIn = (part, from = 0, to = 999) => Object.fromEntries(part.notes.filter(([s]) => s >= from && s < to).map(([s, k]) => [s, k]));
export const notesIn = (song, part, from = 0, to = 999) => Object.fromEntries(part.notes.filter(([s]) => s >= from && s < to).map((n) => [n[0], pitchOf(song, part, n)]));

const layerName = (part) => (part.steps ? TRACK[part.track].name : LAYERS[part.layer]?.label || TRACK[part.track].label);

/**
 * 一页上要放的音，排成“按哪个键、按亮第几个”的几组。八度不一样的那几组排在后面，前后各说一句“升 / 降一格”。
 * 返回 { text, groups }。
 */
function pageText(song, part, page) {
  const notes = part.notes.filter(([s]) => s >= page * 16 && s < page * 16 + 16);
  const groups = new Map();
  for (const [s, k, , shift = 0] of notes) {
    const g = `${shift}|${k}`;
    if (!groups.has(g)) groups.set(g, { k, shift, steps: [] });
    groups.get(g).steps.push(s);
  }
  const byShift = new Map();
  for (const g of [...groups.values()].sort((a, b) => Math.abs(a.shift) - Math.abs(b.shift) || a.steps[0] - b.steps[0])) {
    if (!byShift.has(g.shift)) byShift.set(g.shift, []);
    byShift.get(g.shift).push(g);
  }
  const one = (g) => `按 **Synth key ${g.k}**，按亮第 **${list(g.steps.map(at))}** 个`;
  const parts = [];
  for (const [shift, gs] of byShift) {
    const body = gs.map(one).join('；');
    if (!shift) parts.push(body);
    else {
      const n = Math.abs(shift) === 1 ? '一' : '两';
      parts.push(`八度${shift > 0 ? '升' : '降'}${n}格（**按住 [OCTAVE] 转 [ALL]**），${body}，再${shift > 0 ? '降' : '升'}回来`);
    }
  }
  return { text: parts.join('；'), notes };
}

/** 讲解里那一小段“每页放什么”（song 是分轨数据：要它的音阶、调、长度） */
function pagePlan(song, part) {
  const rows = [];
  for (let p = 0; p < (part.bars || song.bars); p++) {
    const notes = part.notes.filter(([s]) => s >= p * 16 && s < p * 16 + 16);
    if (!notes.length) continue;
    const keys = notes.map((n) => `${n[1]}${(n[3] || 0) > 0 ? '↑' : (n[3] || 0) < 0 ? '↓' : ''}`);
    const names = part.mode === 'chord' ? '' : `（${notes.map((n) => noteName(pitchOf(song, part, n))).join(' ')}）`;
    rows.push(`第 ${p + 1} 页：键 ${list(keys)}${names}`);
  }
  return rows;
}

function listenStep(song, spec, ctx) {
  const chords = spec.parts.find((p) => p.mode === 'chord');
  const order = ctx.order.map((l) => LAYERS[l].label).join(' → ');
  return {
    type: 'read', title: '先听一遍', song: song.id, role: 'listen',
    blocks: [
      `这节课照着《${song.title}》的 SEQTRAK 版，在机器上把它**一层一层搭出来**：${order}，最后加上混响。先听听最后会是什么样：`,
      { widget: 'song', song: song.id },
      `点「一层层加上去」：先只有鼓，然后一层层加。等会儿就照这个顺序来做。`,
      { callout: 'theory', text: spec.summary },
      chords && { callout: 'tip', text: `和弦是这几个键：${list([...new Set(chords.notes.map((n) => n[1]))].map((k) => `键 ${k}`))}。这是简化版，和原曲哪里不一样，分轨页右边列着。` },
      { callout: 'tip', text: `大约 ${ctx.minutes} 分钟，可以分几次做：进度会记着，下次从停下的那一步接着来。` },
    ].filter(Boolean),
    coach: `曲目课《${song.title}》的开场：学生先听这首歌的 SEQTRAK 版（应用合成的声音，有混响）。${spec.summary} 接下来按 ${order} → 混响 → 一层层听 的顺序搭。`,
  };
}

function prepStep(song, spec) {
  const scale = SCALES[spec.scale];
  const swingTask = spec.swing > 0
    ? { text: `摇摆调到 **${spec.swing}** 左右：按右侧面的 [SWING]，看读数。`, panel: ['SWING', 'METER'], detect: { kind: 'swing', min: Math.max(1, spec.swing - 6) }, wait: '点 [SWING]，读数到这附近就行…', liveWait: `按 [SWING]，读数到 ${spec.swing} 附近…` }
    : { text: '摇摆归零：**先按住 [DELETE] 不放，再按一下 [SWING]**（本来就是 0 的话，这一项会自己打勾）。', panel: ['DELETE', 'SWING'], detect: { kind: 'swing', zero: true }, wait: '长按 [DELETE] 出现黑圈，再点 [SWING]…', liveWait: '等摇摆变成 0…' };
  const intro = '换一个空工程，免得和别的歌、前面课里做的东西混在一起；再把速度、摇摆、音阶和调设成这首歌的。';
  return {
    type: 'do', title: '准备：空工程、速度和调', song: song.id, role: 'prep',
    blocks: [intro, { callout: 'tip', text: '模拟机已经替你换到了 5 号工程、清空了，第一项会自己打勾。[BPM −] / [BPM +] **按住不放**会连着变。' }],
    liveBlocks: [
      intro,
      { device: ['project', 'tempo', 'swing', 'scale', 'key'] },
      { callout: 'tip', text: '换到 5–8 号里一个空的工程。都用过了的话，挑一个不要了的。' },
      { action: 'tempo', value: spec.bpm, label: `让应用直接把速度设成 ${spec.bpm}` },
      { action: 'scalekey', scale: spec.scale, key: spec.key, label: `让应用直接设成 ${scale.name} / ${KEY_NAMES[spec.key]}` },
    ],
    tasks: [
      { text: '换到一个空工程：**先按住 [PROJECT↑] 不放，再按上排第 5 个步进键**（5–8 号都行）。', panel: ['PROJECT', 'DK5'], detect: { kind: 'project', in: [4, 5, 6, 7] }, wait: '长按 [PROJECT↑] 出现黑圈，再点上排第 5 个步进键…', liveWait: '等你换到 5–8 号工程…' },
      { text: `速度调到 **${spec.bpm} BPM**：按右侧面的 [BPM −] / [BPM +]。`, panel: ['BPM-', 'BPM+'], detect: { kind: 'tempo', value: spec.bpm }, wait: `按 [BPM −] / [BPM +]，调到 ${spec.bpm}…`, liveWait: `等速度变成 ${spec.bpm}…` },
      swingTask,
      { text: `音阶和调设成 **${scale.name} / ${pretty(KEY_NAMES[spec.key])}**：按 [SCALE] 到第 ${spec.scale + 1} 个（右边那列灯从上往下数第 ${spec.scale + 1} 个），再按 [KEY] 到 **${pretty(KEY_NAMES[spec.key])}**（${keyLights(spec.key)}）。`, panel: ['SCALE', 'KEY', 'METER'], detect: { kind: 'scale', scale: spec.scale, key: spec.key }, wait: '点 [SCALE]、[KEY]，看模拟机下面那行字…', liveWait: `等读数变成 ${scale.zh} / ${KEY_NAMES[spec.key]}…` },
    ],
    done: `准备好了：${spec.bpm} BPM、${spec.swing > 0 ? `摇摆 ${spec.swing}` : '不摇'}、${pretty(KEY_NAMES[spec.key])} ${scale.zh}。`,
    coach: `学生在为《${song.title}》准备工程：换到 5–8 号空白工程（按住 [PROJECT↑] + 上排第 5–8 个步进键），速度 ${spec.bpm}，摇摆${spec.swing > 0 ? ` ${spec.swing}（按 [SWING]）` : '归零（按住 [DELETE] + [SWING]）'}，SCALE 第 ${spec.scale + 1} 个 ${scale.name}，KEY ${KEY_NAMES[spec.key]}（Global Meter 上${keyLights(spec.key)}）。这几样真机和模拟机都读得出来，自动打勾。`,
  };
}

function drumsStep(song, spec) {
  const drums = spec.parts.filter((p) => p.steps);
  const hits = (p) => [...p.steps.replace(/[\s|]/g, '')].map((c, i) => (c === 'x' || c === 'X' ? i + 1 : 0)).filter(Boolean);
  return {
    type: 'program', title: `鼓：${drums.length} 条轨道`, song: song.id, role: 'drums',
    target: Object.fromEntries(drums.map((p) => [p.track, p.steps.replace(/[\s|]/g, '')])),
    tracks: drums.map((p) => p.track),
    bpm: spec.bpm,
    swing: (spec.swing || 0) / 120,
    blocks: [
      `${drums.length} 条鼓轨，每条只有一小节，机器会自己重复：`,
      { list: drums.map((p) => `**${TRACK[p.track].label}**（${TRACK[p.track].name}）：第 ${list(hits(p))} 步。${p.role.split('。')[0]}。`) },
      { callout: 'tip', text: '空白工程里 KICK 的第 1 步本来就亮着。音色先用机器里现成的，挑音色是第 4 章的事。' },
    ],
    legend: `先按一下轨道旋钮选中它（${drums.map((p) => TRACK[p.track].label).join('、')}），再按亮它要的那几个步进键。都对了自动过关。`,
    done: '鼓有了。',
    coach: `《${song.title}》的鼓：${drums.map((p) => `${TRACK[p.track].label} 第 ${list(hits(p))} 步`).join('；')}，都是一小节。选轨道要按旋钮（不是转），转了会换乐句。真机上鼓轨的格子读得出来，全对了自动过关。`,
  };
}

function synthStep(song, spec, part) {
  const t = TRACK[part.track];
  const label = t.label;
  const chord = part.mode === 'chord';
  const what = layerName(part);
  const oct = part.octave || 0;
  const bars = part.bars || spec.bars; // 这条轨道自己几小节（比整首短的，机器上自己重复）
  const tasks = [];
  if (chord) {
    tasks.push({ text: `按一下 **${label} 旋钮**选中它。`, panel: [part.track], detect: { kind: 'track', track: part.track }, wait: `点一下 ${label} 旋钮…`, liveWait: `等你按 ${label} 旋钮…` });
    tasks.push({ text: '**慢慢转**右边桔红色那一列**从上往下数第 2 个**旋钮，转到 **CHORD**（那列文字里 “CHORD” 亮）。', panel: ['SD2', 'INDEX', 'METER'], detect: { kind: 'polymode', track: part.track, mode: 2 }, wait: '往上拖第 2 个旋钮，直到 CHORD 亮…', liveWait: '慢慢转第 2 个旋钮，直到读数变成 CHORD…' });
    tasks.push({ text: `进入步进输入：**先按住 [PAGE] 不放，再按一下 ${label} 旋钮**。`, panel: ['PAGE', part.track], sim: { kind: 'mode', mode: 'stepinput', track: part.track, on: true }, wait: `长按 [PAGE] 出现黑圈，再点 ${label} 旋钮…` });
  } else {
    tasks.push({ text: `进入 ${label} 的步进输入：**先按住 [PAGE] 不放，再按一下 ${label} 旋钮**。`, panel: ['PAGE', part.track], detect: { kind: 'track', track: part.track }, sim: { kind: 'mode', mode: 'stepinput', track: part.track, on: true }, wait: `长按 [PAGE] 出现黑圈，再点 ${label} 旋钮…`, liveWait: `等你按 ${label} 旋钮…` });
  }
  if (oct !== (SIM_OCTAVE[part.track] ?? 0)) {
    tasks.push({ text: `把八度设成 **${signed(oct)}**：**按住 [OCTAVE] 不放，转 [ALL] 旋钮**，看右边那列小灯（自下而上是 −3 到 +2），然后松开。`, panel: ['OCTAVE', 'ALL', 'METER'], detect: { kind: 'octave', track: part.track }, wait: '长按 [OCTAVE] 出现黑圈，再拖 ALL 旋钮…' });
  }
  if (bars > 1) {
    tasks.push({ text: `按 **[BAR LENGTH]** 到 **${bars} 小节**（1 → 2 → 4 → 8，轮着换）。先把页准备好，再一页一页填。`, panel: ['BARLENGTH', 'METER'], detect: { kind: 'length', track: part.track, bars }, wait: '点 [BAR LENGTH]…', liveWait: `按 [BAR LENGTH]，直到读数是 ${bars} 小节…` });
  }
  const used = [];
  for (let p = 0; p < bars; p++) {
    const { text, notes } = pageText(spec, part, p);
    if (!notes.length) continue;
    const last = !part.notes.some(([s]) => s >= p * 16 + 16);
    const where = p === 0 ? '第 1 页' : `单按 [PAGE] 翻到第 ${p + 1} 页`;
    const panel = [...(p ? ['PAGE'] : []), ...new Set(notes.map((n) => `SK${n[1]}`)), ...new Set(notes.map(([s]) => `DK${at(s)}`)), ...(notes.some((n) => n[3]) ? ['OCTAVE', 'ALL'] : [])];
    const sim = chord
      ? { kind: 'stepkeys', track: part.track, keys: last ? keysIn(part) : keysIn(part, p * 16, p * 16 + 16), ...(last ? { exact: true } : {}) }
      : { kind: 'stepnotes', track: part.track, notes: last ? notesIn(spec, part) : notesIn(spec, part, p * 16, p * 16 + 16), ...(last ? { exact: true } : {}) };
    tasks.push({ text: `${where}：${text}。`, panel, sim, wait: `${where}，照着放…` });
    used.push(p);
    // 和弦要铺开：把这一页上比一步长的和弦拉长（核对这一页第一个和弦的长度）
    const long = chord ? notes.filter((n) => (n[2] || 1) > 1) : [];
    if (long.length) {
      const lens = [...new Set(long.map((n) => n[2]))];
      const say = lens.length === 1 ? `都拉到 **${lens[0]} 步**` : long.map((n) => `第 ${at(n[0])} 个拉到 ${n[2]} 步`).join('、');
      tasks.push({ text: `把这一页的和弦拉长：**按住步进键不放，把 [ALL] 往上转**，${say}。`, panel: [...new Set(long.map(([s]) => `DK${at(s)}`)), 'ALL'], sim: { kind: 'notelen', track: part.track, step: long[0][0], min: long[0][2] }, wait: '长按那个步进键出现黑圈，再往上拖 ALL 旋钮…' });
    }
  }
  tasks.push({ text: `${bars > 1 ? '翻回第 1 页，' : ''}短按 [PLAY] 听听。${bars < spec.bars ? `这条只有 ${bars} 小节，放的时候自己重复。` : ''}`, panel: [...(bars > 1 ? ['PAGE'] : []), 'PLAY'], detect: { kind: 'start' }, wait: '点 [PLAY]…', liveWait: '按 [PLAY]…' });
  tasks.push({ text: '听够了按 [PLAY] 停下。', panel: ['PLAY'], detect: { kind: 'stop' }, wait: '再点 [PLAY]…', liveWait: '等你停止…' });

  const plan = pagePlan(spec, part);
  const blocks = [
    `${what}放在 **${label}** 上${chord ? '，用 **CHORD 弹法**：一个键就是一整个和弦' : ''}。${part.role}`,
    { list: plan },
    chord
      ? { callout: 'warn', text: '弹法存在音色里：要换音色的话**先换音色，再切 CHORD**。这节课先用现成的音色。' }
      : { callout: 'tip', text: '步进输入里放进去的是“你最后按过的那个音”：先按 Synth key，再按步进键。同一个音连着放几下，按一次 Synth key 就够了。' },
    plan.some((r) => /[↑↓]/.test(r)) && { callout: 'theory', text: '带 ↑ 的键高一个八度、带 ↓ 的低一个八度：放它们之前先按住 [OCTAVE] 转 [ALL] 改一格，放完改回来。' },
  ].filter(Boolean);
  const liveBlocks = [
    blocks[0], blocks[1],
    { device: [`bars:${part.track}`, ...(chord ? [`poly:${part.track}`] : [])] },
    bars > 1 && { action: 'bars', track: part.track, bars, label: `让应用直接把 ${label} 这段设成 ${bars} 小节` },
    chord && { action: 'polymode', track: part.track, mode: 2, label: `让应用直接把 ${label} 切到 CHORD` },
    { callout: 'tip', text: `这条轨道的八度要在 **${signed(oct)}**：按住 [OCTAVE] 时，右边那列小灯自下而上是 −3 到 +2。${bars > 1 ? PAGE_LIGHTS : ''} 填格子的几项应用看不见，做完自己点“做好了”。` },
    ...blocks.slice(2),
  ].filter(Boolean);
  return {
    type: 'do', title: `${what}：${label}`, song: song.id, role: 'synth', part: part.track,
    blocks, liveBlocks, tasks,
    done: `${what}有了。`,
    coach: `《${song.title}》的${what}在 ${label}（${chord ? 'CHORD' : '单音'}，OCTAVE ${signed(oct)}）：${plan.join('；')}（数字是 Synth key，↑ 高一个八度、↓ 低一个八度）。做法：按住 [PAGE] + ${label} 旋钮进步进输入${bars > 1 ? `，先按 [BAR LENGTH] 到 ${bars} 小节` : ''}，每页先按 Synth key 再按亮步进键${chord ? '；和弦要按住步进键转 [ALL] 拉长' : ''}；改八度是按住 [OCTAVE] 转 [ALL]（V2.00）。真机上合成器轨的格子读不出来，学生自己点“做好了”。`,
  };
}

function spaceStep(song, spec) {
  const send = spec.parts.filter((p) => p.send?.reverb || p.send?.delay);
  const amount = (v) => (v >= 0.6 ? '多转一些' : v >= 0.3 ? '转一些' : '转一点');
  const rev = send.filter((p) => p.send.reverb > 0);
  const del = send.filter((p) => p.send.delay > 0);
  const dry = spec.parts.filter((p) => !p.send?.reverb && !p.send?.delay).map((p) => TRACK[p.track].label);
  const intro = `氛围感主要靠**混响**。机器上全部轨道共用一个混响、一个延迟，每条轨道自己决定往里**送多少**。最方便的调法是**混音台模式**：进去以后，右边那一列旋钮的第 3 个是“送混响”、第 4 个是“送延迟”，再转哪条轨道的旋钮，就是调哪条轨道送多少。${dry.length ? `${list(dry)} 不送。` : ''}`;
  return {
    type: 'do', title: '加混响', song: song.id, role: 'space', bench: 'live',
    blocks: [intro, { callout: 'warn', text: '模拟机没有做混音台和效果器：没接机器的话，这一步先读一遍、点“做好了”，等接上真机再回来做。' }],
    liveBlocks: [intro, { callout: 'tip', text: '混音台里转轨道旋钮**不会**换乐句，放心转。这一步应用看不见，做完自己点“做好了”。' }],
    tasks: [
      { text: '进入混音台：**先按住 [ALL] 旋钮不放，再按一下左侧面的 [VOL +]**（最上面那个）。那列文字里 “MIXER” 会亮。', panel: ['ALL', 'VOL+', 'INDEX'] },
      rev.length && { text: `按一下右边那一列**从上往下数第 3 个**旋钮（“REVERB” 亮），然后转这几条轨道的旋钮：${rev.map((p) => `${TRACK[p.track].label} ${amount(p.send.reverb)}`).join('、')}。`, panel: ['SD3', ...rev.map((p) => p.track)] },
      del.length && { text: `按一下**第 4 个**旋钮（“DELAY” 亮），再转：${del.map((p) => `${TRACK[p.track].label} ${amount(p.send.delay)}`).join('、')}。`, panel: ['SD4', ...del.map((p) => p.track)] },
      { text: '短按 [PLAY] 听听，空间感是不是出来了？', panel: ['PLAY'], detect: { kind: 'start' }, wait: '点 [PLAY]…', liveWait: '等你按 [PLAY]…' },
      { text: '停下，再**按住 [ALL] + 按 [VOL +]** 退出混音台。', panel: ['PLAY', 'ALL', 'VOL+'] },
    ].filter(Boolean),
    done: '混响加上了。',
    coach: `学生在用混音台模式给《${song.title}》加发送混响和延迟（手册 3.15.1）：按住 [ALL] 旋钮 + [VOL+] 进出；Sound Design 旋钮 3 = REVERB SEND、旋钮 4 = DELAY SEND；转各轨道旋钮调该轨送多少。照分轨：${send.map((p) => `${TRACK[p.track].label} 混响 ${p.send.reverb || 0}、延迟 ${p.send.delay || 0}`).join('；')}（0–1）。模拟机没有混音台；真机上应用读不出来，学生自己点“做好了”。`,
  };
}

function layersStep(song, spec) {
  const synths = spec.parts.filter((p) => !p.steps);
  const lead = synths[synths.length - 1];
  const low = synths.find((p) => p.layer === 'bass') || synths[0];
  const L = (p) => TRACK[p.track].label;
  return {
    type: 'do', title: '一层层听，“演”一遍', song: song.id, role: 'layers',
    blocks: [
      '几层都在机器里了。用第 1 章学的**独奏**和**静音**把它拆开听，再一层层推回来——现场演出最常用的就是这一手。',
      { callout: 'dj', text: '和打碟时把低频拧掉、再“啪”地推回来是一回事，只不过这里每一层是分开的，可以整层拿走。' },
    ],
    tasks: [
      { text: '短按 [PLAY]。', panel: ['PLAY'], detect: { kind: 'start' }, wait: '点 [PLAY]…', liveWait: '等你按 [PLAY]…' },
      { text: `**先按住**左侧面的 [SOLO] **不放，再按一下 ${L(lead)} 旋钮**：只剩${layerName(lead)}。`, panel: ['SOLO', lead.track], sim: { kind: 'solo', track: lead.track }, wait: `长按 [SOLO] 出现黑圈，再点 ${L(lead)} 旋钮…`, liveWait: `按住 [SOLO]，再按 ${L(lead)} 旋钮…` },
      { text: '同样的动作再做一次，取消独奏：大家都回来。', panel: ['SOLO', lead.track], sim: { kind: 'solo' }, wait: '再来一次…', liveWait: '再做一次，取消独奏…' },
      { text: `**先按住** [MUTE] **不放，再按一下 ${L(low)} 旋钮**：${layerName(low)}没了。`, panel: ['MUTE', low.track], sim: { kind: 'mute', track: low.track, on: true }, wait: `长按 [MUTE] 出现黑圈，再点 ${L(low)} 旋钮…`, liveWait: `按住 [MUTE]，再按 ${L(low)} 旋钮…` },
      { text: `再做一次，让${layerName(low)}“啪”地回来，然后按 [PLAY] 停下。`, panel: ['MUTE', low.track, 'PLAY'], sim: { kind: 'mute', track: low.track, on: false }, wait: `再长按 [MUTE] 点 ${L(low)} 旋钮…`, liveWait: `再按住 [MUTE] 按 ${L(low)} 旋钮…` },
    ],
    done: `《${song.title}》在你的机器上了。`,
    coach: `收尾：学生用独奏（按住 [SOLO] + 轨道旋钮）和静音（按住 [MUTE] + 轨道旋钮）把《${song.title}》拆开听、再推回来。多鼓励，可以建议他“演”一遍：先只有鼓和贝斯，再一层层推上去。`,
  };
}

/** 一首歌（content/songs.js 的那一条）+ 它的分轨（content/song-parts.js）→ 一节课 */
export function songLesson(song, spec) {
  const order = [...new Set(spec.parts.map((p) => p.layer))].sort((a, b) => LAYERS[a].order - LAYERS[b].order);
  const synths = spec.parts.filter((p) => !p.steps).sort((a, b) => LAYERS[a.layer].order - LAYERS[b.layer].order);
  const minutes = 15 + synths.length * 7 + Math.max(0, spec.bars - 2) * 3;
  const ctx = { order, minutes };
  return {
    id: `song-${song.id}`,
    song: song.id,
    no: song.title,
    title: '一轨一轨搭出来',
    minutes,
    simProject: 4,
    simFresh: true,
    generated: true,
    back: { href: `#/songs/${song.id}`, label: `← ${song.title} 分轨`, done: `回到《${song.title}》分轨`, nav: 'songs' },
    summary: `照着 SEQTRAK 版分轨，在机器上把《${song.title}》一层层搭出来：${order.map((l) => LAYERS[l].label).join(' → ')}，最后加上混响。`,
    takeaway: `一首歌在机器上就是几条轨道各放一段乐句：鼓一小节、自己重复；${synths.map((p) => `${layerName(p)}在 ${TRACK[p.track].label}`).join('、')}。${spec.bars > 1 ? `${spec.bars} 小节的乐句：先按 [BAR LENGTH] 加长，再一页一页填。` : ''}氛围靠混响：旋律、和弦多送，底鼓和贝斯不送。`,
    homework: '用独奏和静音把几层拆开、再一层层推回来，像打碟时那样“演”一遍这首歌。',
    steps: [
      listenStep(song, spec, ctx),
      prepStep(song, spec),
      ...(spec.parts.some((p) => p.steps) ? [drumsStep(song, spec)] : []),
      ...synths.map((p) => synthStep(song, spec, p)),
      ...(spec.parts.some((p) => p.send) ? [spaceStep(song, spec)] : []),
      layersStep(song, spec),
    ],
  };
}

