// 按键体检：一步一步带你在真机上按几个键（屏幕上的图会圈出该按哪里），把机器实际发出的信号记下来。
// 用途：手册没写明的几件事（按旋钮、在打鼓模式里按 Synth keys 时机器到底发什么），用你这台机器实测确认，
// 这样课程里的自动打勾和实机音游才靠得住。结果存到 data/midi-probe.jsonl，并在最后给出一份小结。
// 同一张卡片里还有第二轮“第 5–8 章的按键”（CH58_STEPS，2026-11-12 加的）：只记录、不下结论，见下面那一段的说明。
import { h, clear, rich, append } from './util.js';
import { midi } from './midi.js';
import { seqtrak, ADDR, decodeSoundName } from './seqtrak.js';
import { createPanel } from './device-panel.js';
import { api } from './api.js';
import { toast } from './ui.js';
import { synthKeyNotes } from './scales.js';
import { midiToName } from './audio.js';

/** 像 el.append，但跳过 false / null / undefined（浏览器自带的 append 会把它们当成文字放进去） */
const put = (node, ...kids) => append(node, kids);

const STEPS = [
  { id: 'project', title: '切到 4 号空白工程', text: '**按住**右侧面最下面的 [PROJECT↑]，同时按一下上排第 4 个方键（Drum key 4）。', show: ['PROJECT', 'DK4'] },
  { id: 'knob-kick', title: '按一下 KICK 旋钮', text: '只按，不要转。', show: ['KICK'] },
  { id: 'knob-snare', title: '按一下 SNARE 旋钮', text: '同样只按一下。', show: ['SNARE'] },
  { id: 'drumkey', title: '开关一步', text: '先按一下 **KICK 旋钮**，再按一下上排第 5 个方键（会亮黄色），等两秒，再按一下把它按灭。', show: ['KICK', 'DK5'] },
  { id: 'rt-enter', title: '进入打鼓模式', text: '**按住 KICK 旋钮**不放，同时按一下 Synth key 1（圆点键右边那个），然后都松开。', show: ['KICK', 'SK1'] },
  { id: 'rt-keys', title: '把 7 面鼓各敲一下', text: '按 1、2、3、4、5、6、7 的顺序，每个 Synth key 各按**一下**，中间停一秒。', show: ['SYNTHKEYS'] },
  { id: 'rt-exit', title: '退出打鼓模式', text: '再做一次：按住 KICK 旋钮，同时按一下 Synth key 1。', show: ['KICK', 'SK1'] },
  { id: 'synth-keys', title: '合成器的 7 个音', text: '按一下 **SYNTH 1 旋钮**，然后按 1 到 7 的顺序，每个 Synth key 各按一下。', show: ['SYNTH1', 'SYNTHKEYS'] },
  { id: 'play', title: '播放再停止', text: '短按一下左下角的 [PLAY]，听两秒，再短按一下停止。', show: ['PLAY'] },
];

const channelsOf = (events) => events.filter((e) => e.type === 'noteon').map((e) => e.ch);

/** 根据记录下来的信号，写出人能看懂的结论。 */
export function summarize(results, project) {
  const by = Object.fromEntries(results.map((r) => [r.id, r.events]));
  const lines = [];
  const has = (id, pred) => (by[id] || []).some(pred);
  const sel = (id, n) => has(id, (e) => e.type === 'sysex' && e.hex.includes(`01 10 27 0${n}`));
  lines.push([sel('knob-kick', 0) || has('knob-kick', (e) => e.type === 'noteon' && e.ch === 1), '按 KICK 旋钮：机器' + (sel('knob-kick', 0) ? '广播了“选中第 1 条轨道”' : has('knob-kick', (e) => e.type === 'noteon') ? '发了一个试听音' : '没有发出可识别的信号')]);
  lines.push([sel('knob-snare', 1) || has('knob-snare', (e) => e.type === 'noteon' && e.ch === 2), '按 SNARE 旋钮：' + (sel('knob-snare', 1) ? '广播了“选中第 2 条轨道”' : has('knob-snare', (e) => e.type === 'noteon') ? '发了一个试听音' : '没有发出可识别的信号')]);
  const dk = (by.drumkey || []).filter((e) => e.type !== 'sysex' || !e.hex.includes('01 10 27'));
  // 实测：按亮一步机器会报 70 0p 00 + 步号…，按灭一步报 70 2p 00 + 步号（p = 第几条鼓轨）
  const stepMsg = dk.some((e) => e.type === 'sysex' && /1C 0C 70 [02][0-6] 00 /.test(e.hex));
  lines.push([true, `开关一个步进键：${stepMsg ? '机器上报了这一步的开 / 关' : dk.length ? `机器发了 ${dk.length} 条消息，但里面没有“某一步开 / 关”的上报——多半是这一步没按到步进键（已记录）` : '机器不发任何消息——所以“填格子”类的任务，要靠读取或播放一遍来核对'}`]);
  const rt = channelsOf(by['rt-keys'] || []);
  const rtOk = rt.length >= 7 && [1, 2, 3, 4, 5, 6, 7].every((c, i) => rt[i] === c);
  lines.push([rtOk, rt.length ? `打鼓模式下 7 个 Synth keys 依次发在通道 ${rt.slice(0, 7).join('、')}${rtOk ? '——和课程假设的一致，实机音游可以直接用' : '——和课程假设的（1–7）不一样，已记录，需要据此修正'}` : '打鼓模式下按 Synth keys：没有收到任何音符，实机音游暂时不能自动判定']);
  // 机器会紧跟着每个音上报“按的是第几个键”（01 10 2C nn）：用它把音和键对上，就不会混进按旋钮时的那声试听、或者音序器放出来的音
  const sk = by['synth-keys'] || [];
  const byKey = {};
  sk.forEach((e, i) => {
    const m = e.type === 'sysex' && /01 10 2C 0([0-6])/.exec(e.hex);
    if (!m || byKey[m[1]] !== undefined) return;
    const on = sk.slice(Math.max(0, i - 3), i).reverse().find((x) => x.type === 'noteon' && x.ch === 8 && e.ms - x.ms < 30);
    if (on) byKey[m[1]] = on.note;
  });
  let notes = [0, 1, 2, 3, 4, 5, 6].map((k) => byKey[k]);
  if (notes.some((n) => n === undefined)) {
    // 不报键号的固件：按先后取，只去掉紧跟在“选中 SYNTH 1”后面的那声试听
    notes = sk.filter((e, i) => e.type === 'noteon' && e.ch === 8 && !(sk[i - 1]?.type === 'sysex' && sk[i - 1].hex.includes('01 10 27 07') && e.ms - sk[i - 1].ms < 30)).map((e) => e.note);
  }
  if (notes.length) {
    const expect = synthKeyNotes({ scale: project.scale, key: project.key, octave: project.octave ?? 0 });
    const same = notes.length >= 7 && expect.every((n, i) => notes[i] === n);
    const sameClass = notes.length >= 7 && expect.every((n, i) => notes[i] % 12 === n % 12);
    lines.push([same || sameClass, `SYNTH 1 的 7 个键发出：${notes.slice(0, 7).map(midiToName).join(' ')}（${same ? '和按音阶算出来的完全一致' : sameClass ? '音名一致，八度不同——不影响判定' : `按当前音阶算出来应该是 ${expect.map(midiToName).join(' ')}，不一致，已记录`}）`]);
  } else {
    lines.push([false, 'SYNTH 1 的 Synth keys：没有在通道 8 上收到音符']);
  }
  lines.push([has('play', (e) => e.type === 'start') && has('play', (e) => e.type === 'stop'), `按 [PLAY]：${has('play', (e) => e.type === 'start') ? '收到了“开始”' : '没收到“开始”'}，${has('play', (e) => e.type === 'stop') ? '收到了“停止”' : '没收到“停止”'}`]);
  return lines;
}

export function probeWizard() {
  const el = h('div', { class: 'card' });
  let off = null;
  let index = -1;
  let results = [];
  let current = [];
  let mode = null; // null = 开头那张小卡片；'basic' = 9 步的体检；'ch58' = 第 5–8 章的按键
  const cleanup = []; // 第 5–8 章那一轮每一步挂上去的监听

  const stopCapture = () => {
    off?.();
    off = null;
    cleanup.splice(0).forEach((f) => f());
  };

  function intro() {
    stopCapture();
    mode = null;
    index = -1;
    clear(el);
    put(el,
      h('h3', {}, '按键体检'),
      h('div', { class: 'probe-run', 'data-probe': 'basic' },
        h('p', { class: 'muted small', style: { margin: '6px 0 12px' } }, '带你在真机上按 9 组键，大约 2 分钟。屏幕上的图会圈出每一步该按哪里。做完之后，应用就确切知道你这台机器在各种操作下会发出什么信号。'),
        midi.connected && h('button', { class: 'btn', type: 'button', onclick: () => { mode = 'basic'; results = []; go(0); } }, '开始体检')),
      h('div', { class: 'probe-run', 'data-probe': 'ch5-8' },
        h('h4', {}, '第 5–8 章的按键', h('span', { class: 'tag accent' }, '新')),
        h('p', { class: 'muted small', style: { margin: '6px 0 12px' }, html: rich(`采样、Song / Scene 模式、静音模式、混音台、临时保存、三条触摸条——这几章有十几样操作，机器会不会告诉应用、怎么告诉，还没人在机器上试过，所以课程里这些步骤现在要你自己点“我已经做了”。跟着做一遍（${CH58_STEPS.length} 步，大约 10 分钟），应用把机器发来的信号原样记下来，下次开发据此让这些步骤自动打勾。**这一轮只记录、不打分**；会在空白工程里录一小段声音、存下来，还会放一会儿音乐。`) }),
        midi.connected && h('button', { class: 'btn primary', type: 'button', onclick: () => startCh() }, '开始这一轮'),
        midi.connected && !midi.sysex && h('p', { class: 'small muted', style: { marginTop: '8px' } }, '浏览器没有授权 SysEx：采样位的名字读不出来，其余照样记。')),
      !midi.connected && h('span', { class: 'tag warn', style: { marginTop: '12px' } }, '需要先连接真机'),
    );
  }

  function go(i) {
    stopCapture();
    if (index >= 0 && index < STEPS.length) results[index] = { id: STEPS[index].id, title: STEPS[index].title, events: current };
    index = i;
    if (i >= STEPS.length) return finish();
    const step = STEPS[i];
    current = [];
    const t0 = performance.now();
    const log = h('div', { class: 'monitor', style: { height: '112px', marginTop: '12px' } }, h('div', { class: 't' }, '还没有收到信号…'));
    off = midi.on('message', (m) => {
      if (!current.length) clear(log);
      const hex = [...m.data].map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ').slice(0, 72);
      current.push({ ms: Math.round(performance.now() - t0), type: m.type, ch: m.ch, note: m.note, vel: m.vel, cc: m.cc, val: m.val, hex });
      const text = m.type === 'noteon' ? `音符 · 通道 ${m.ch} · 音符号 ${m.note} · 力度 ${m.vel}` : m.type === 'noteoff' ? `松开 · 通道 ${m.ch}` : m.type === 'cc' ? `控制器 ${m.cc} = ${m.val} · 通道 ${m.ch}` : m.type === 'start' ? '开始播放' : m.type === 'stop' ? '停止' : m.type === 'pc' ? `换音色 · 通道 ${m.ch}` : `参数消息 ${hex}`;
      log.append(h('div', { class: 'in' }, text));
      log.scrollTop = log.scrollHeight;
    });
    const panel = createPanel({ highlight: step.show });
    clear(el);
    el.append(
      h('div', { class: 'label' }, `按键体检 · 第 ${i + 1} / ${STEPS.length} 步`),
      h('h3', { style: { margin: '8px 0 6px' } }, step.title),
      h('p', { html: rich(step.text), style: { color: 'var(--text-2)' } }),
      h('div', { style: { margin: '12px 0' } }, panel.el),
      h('div', { class: 'label' }, '机器发来的信号'),
      log,
      h('div', { class: 'row', style: { marginTop: '14px' } },
        h('button', { class: 'btn primary', type: 'button', onclick: () => go(i + 1) }, i === STEPS.length - 1 ? '做完了，看结果' : '这一步做完了 →'),
        h('button', { class: 'btn ghost sm', type: 'button', onclick: intro }, '退出'),
        h('span', { class: 'small muted' }, '没有信号也没关系，照常点“做完了”，“没有信号”本身就是结果。'),
      ),
    );
  }

  async function finish() {
    clear(el);
    el.append(h('h3', {}, '按键体检'), h('p', { class: 'muted' }, '正在读取机器的音阶设置并保存结果…'));
    const project = { scale: 0, key: 0, octave: 0 };
    try {
      await seqtrak.read(ADDR.scale);
      await seqtrak.read(ADDR.key);
      project.scale = seqtrak.state.scale;
      project.key = seqtrak.state.key;
      const oct = await seqtrak.read([0x30, 0x57, 0x0c]); // SYNTH 1 的八度
      project.octave = (oct[0] ?? 0x40) - 0x40;
    } catch {
      /* 读不到就按默认值比对 */
    }
    const lines = summarize(results, project);
    let saved = true;
    try {
      await api.post('/api/probe', { kind: 'wizard', firmware: seqtrak.state.firmware, project, steps: results, summary: lines.map(([ok, text]) => `${ok ? 'OK' : '??'} ${text}`) });
    } catch {
      saved = false;
    }
    clear(el);
    el.append(
      h('h3', {}, '体检结果'),
      h('ul', { style: { margin: '12px 0', paddingLeft: '0', listStyle: 'none' } }, lines.map(([ok, text]) => h('li', { style: { display: 'flex', gap: '10px', margin: '8px 0' } }, h('span', { class: `tag ${ok ? 'ok' : 'warn'}` }, ok ? '符合预期' : '需要留意'), h('span', {}, text)))),
      h('p', { class: 'small muted' }, saved ? '完整记录已保存到 data/midi-probe.jsonl。标着“需要留意”的项目，下次开发时会据此修正；在那之前，对应的步骤点“我已经做了”就能继续。' : '结果没能保存到本地服务（服务可能没在运行），但不影响继续使用。'),
      // “完成”收回成开头那张小卡片（用户 2026-11-11：展开了就收不回去，和别的卡片不协调）
      h('div', { class: 'row', style: { marginTop: '12px' } },
        h('button', { class: 'btn primary', type: 'button', onclick: () => { results = []; index = -1; intro(); } }, '完成'),
        h('button', { class: 'btn', type: 'button', onclick: () => { results = []; index = -1; go(0); } }, '重新体检')),
    );
  }

  // ───── 第 5–8 章的按键（步骤和为什么这么做，见文件最后的 CH58_STEPS） ─────
  let ctx = {}; // 带到后面几步用的：机器在第几号工程、换采样源时你在图上标出来的方键
  let busy = false; // 正在读采样位名字 / 正在保存，这时候别的按钮不响应
  let stepT0 = 0;
  let setBusy = () => {};

  function startCh() {
    mode = 'ch58';
    results = [];
    ctx = { project: null, marked: {} };
    goCh(0);
  }

  async function goCh(i) {
    stopCapture();
    index = i;
    if (i >= CH58_STEPS.length) return finishCh();
    const def = CH58_STEPS[i];
    const project = await readProject(); // 只读地问一下在几号工程（01 10 15）
    if (mode !== 'ch58' || index !== i) return; // 问的这一会儿点了退出
    ctx.project = project;
    const step = { ...def, ...(def.make ? def.make(ctx) : {}) };
    const rec = { id: step.id, part: step.part, title: step.title, project, events: [] };
    results[i] = rec;
    stepT0 = performance.now();

    // 机器发来的每一条都原样记下（时钟除外；应用自己去问的那几条的回答也不算）
    const log = h('div', { class: 'monitor', style: { height: '112px', marginTop: '8px' } }, h('div', { class: 't' }, '还没有收到信号…'));
    cleanup.push(midi.on('message', (m) => {
      if (m.reply) return;
      const hex = hexOf(m.data);
      if (!rec.events.length) clear(log);
      rec.events.push({ ms: Math.round(performance.now() - stepT0), type: m.type, ch: m.ch, note: m.note, vel: m.vel, cc: m.cc, val: m.val, hex: hex.length > 1500 ? `${hex.slice(0, 1500)} …` : hex });
      log.append(h('div', { class: 'in' }, describeMsg(m, hex)));
      while (log.children.length > 300) log.firstChild.remove();
      log.scrollTop = log.scrollHeight;
    }));

    const panel = createPanel({ highlight: step.show || [], lit: step.lit || {} });
    if (step.hold) panel.setHeld(step.hold);

    // 在不在空白工程：第 1 步一直显示机器现在在几号；要录音、放音乐的几步，不在 5–8 号就先拦一下
    const where = h('div');
    const showWhere = () => {
      clear(where);
      if (ctx.project === null) return; // 问不到（没授权 SysEx）就不显示
      const p = seqtrak.state.project;
      const what = p < 3 ? '演示曲' : '你上课用的工程';
      if (step.watchProject) {
        where.append(h('div', { class: 'task-status', style: { marginTop: '10px' } },
          h('span', { class: 'pulse', style: isBlank(p) ? { background: 'var(--lamp-ok)', animation: 'none' } : {} }),
          h('span', { html: rich(`机器现在在 **${p + 1} 号工程**${isBlank(p) ? '：是空白工程，可以点“这一步做完了”。' : `：这是${what}，照上面换到 8 号。`}`) })));
      } else if (step.blank && !isBlank(p)) {
        where.append(h('div', { class: 'callout warn', style: { margin: '10px 0 0' } }, h('b', { class: 'label' }, '先别做这一步'),
          h('span', { html: rich(`机器现在在 **${p + 1} 号工程**（${what}）。这一步要${step.blank}，先**按住** [PROJECT↑]（右侧面最下面）**不放，再按**上排**第 8 个**方键，换到 8 号空白工程再做。`) })));
      }
    };
    if (step.watchProject || step.blank) {
      cleanup.push(seqtrak.on('state', showWhere));
      showWhere();
    }

    const legend = step.hold && step.show?.length ? '图上：黑圈 = 先按住不放的键，蓝圈 = 接着按的键。' : step.hold ? '图上：黑圈 = 要按住不放的键。' : step.show?.length ? '图上：蓝圈 = 要按的键。' : '';
    const next = h('button', { class: 'btn primary', type: 'button', onclick: () => doneCh(i, false) }, i === CH58_STEPS.length - 1 ? '做完了，看记录' : '这一步做完了 →');
    const skip = h('button', { class: 'btn sm', type: 'button', onclick: () => doneCh(i, true) }, '跳过这一步');
    const quit = h('button', { class: 'btn ghost sm', type: 'button', onclick: () => quitCh() }, '退出');
    setBusy = (text) => {
      next.disabled = skip.disabled = quit.disabled = true;
      next.textContent = text;
    };
    clear(el);
    put(el,
      h('div', { class: 'label' }, `第 5–8 章的按键 · ${step.part} · 第 ${i + 1} / ${CH58_STEPS.length} 步`),
      h('h3', { style: { margin: '8px 0 6px' }, html: rich(step.title) }),
      h('p', { html: rich(step.text), style: { color: 'var(--text-2)' } }),
      step.combo && h('p', { class: 'probe-combo', html: rich(step.combo) }),
      step.warn && h('div', { class: 'callout warn', style: { margin: '10px 0 0' } }, h('b', { class: 'label' }, '注意'), h('span', { html: rich(step.warn) })),
      where,
      h('div', { style: { marginTop: '12px' } }, panel.el),
      legend && h('p', { class: 'probe-legend' }, legend),
      step.note && h('p', { class: 'small muted', style: { margin: '6px 0 0' }, html: rich(step.note) }),
      step.mark && markBox(step.mark, rec),
      step.ask && askBox(step.ask, rec),
      h('div', { class: 'label', style: { marginTop: '14px' } }, '机器发来的信号'),
      log,
      h('div', { class: 'row', style: { marginTop: '14px' } }, next, skip, quit,
        h('span', { class: 'small muted' }, '机器没反应也照常点“做完了”——“什么都没发”本身就是要记的结果。没做的点“跳过”，别混在一起。')),
    );
  }

  async function doneCh(i, skipped) {
    if (busy || mode !== 'ch58' || index !== i) return;
    busy = true;
    stopCapture();
    const rec = results[i];
    rec.ms = Math.round(performance.now() - stepT0);
    if (skipped) rec.skipped = true;
    const step = CH58_STEPS[i];
    if (step.mark && !skipped) ctx.marked = rec.marked || {};
    if (step.reads && !skipped && midi.sysex) {
      setBusy('正在读 7 个采样位的名字（只读，一两秒）…');
      rec.names = await readSampleNames();
    }
    busy = false;
    if (mode === 'ch58' && index === i) goCh(i + 1);
  }

  /** 做到一半退出：做过的几步照样记下来（标着 partial），免得白做 */
  async function quitCh() {
    if (busy) return;
    stopCapture();
    const steps = results.filter(Boolean);
    const at = results[index];
    if (at && !at.ms) {
      at.ms = Math.round(performance.now() - stepT0);
      at.left = true; // 点“退出”时停在这一步上，这一步不一定做了
    }
    mode = null;
    if (steps.some((r) => !r.left)) {
      try {
        await api.post('/api/probe', chPayload(steps, null, true));
        toast(`做过的 ${steps.filter((r) => !r.left).length} 步已经记到 data/midi-probe.jsonl`, 'ok', 4000);
      } catch {
        toast('记录没能保存到本地服务（服务可能没在运行）', 'bad');
      }
    }
    results = [];
    intro();
  }

  async function finishCh() {
    stopCapture();
    clear(el);
    el.append(h('h3', {}, '第 5–8 章的按键'), h('p', { class: 'muted' }, '正在最后读一遍采样位的名字，并保存记录…'));
    const final = { project: await readProject() };
    if (midi.sysex) final.names = await readSampleNames();
    const steps = results.filter(Boolean);
    let saved = true;
    try {
      await api.post('/api/probe', chPayload(steps, final, false));
    } catch {
      saved = false;
    }
    if (mode !== 'ch58') return;
    const cols = nameCheckpoints(steps, final);
    const slots = cols.length ? [1, 2, 3, 4, 5, 6, 7].filter((s) => s === 7 || new Set(cols.map((c) => c.names[s - 1]?.name ?? '')).size > 1) : [];
    clear(el);
    put(el,
      h('h3', {}, '第 5–8 章的按键 · 记下来了'),
      h('p', { class: 'small', style: { color: 'var(--text-2)', margin: '8px 0 0' }, html: rich('这一轮**只记录、不打分**：下面是每一步机器发来了什么、你看到了什么。下次开发照着这份记录，决定课程里哪些步骤能自动打勾。') }),
      cols.length > 0 && h('div', { style: { marginTop: '14px' } },
        h('div', { class: 'label' }, '采样位的名字（只读地读了几遍）'),
        h('table', { class: 'probe-names' },
          h('tr', {}, h('th', {}, '位'), cols.map((c) => h('th', {}, c.label))),
          slots.map((s) => {
            const vals = cols.map((c) => c.names[s - 1]?.name ?? '—');
            return h('tr', { class: new Set(vals).size > 1 ? 'changed' : '' }, h('td', {}, String(s)), vals.map((v) => h('td', {}, v || '（空）')));
          })),
        slots.length < 7 && h('p', { class: 'small muted' }, `另外 ${7 - slots.length} 个位前后读到的名字一样，没列出来。`)),
      h('ol', { class: 'probe-steps' }, steps.map((r) => {
        const lines = r.skipped ? [] : describeEvents(r.events);
        return h('li', {},
          h('div', {}, h('b', { html: rich(r.title) }), ' ', h('span', { class: `tag${r.skipped || !r.events.length ? '' : ' accent'}` }, r.skipped ? '跳过了' : r.events.length ? `${r.events.length} 条消息` : '机器没发消息'),
            r.answer?.length > 0 && h('span', { class: 'small muted' }, `　你看到：${r.answer.join('、')}`),
            r.marked && h('span', { class: 'small muted' }, `　你标的：${markedText(r.marked)}`)),
          lines.length > 0 && h('div', { class: 'lines' }, lines.slice(0, 6).map((t) => h('div', {}, t)), lines.length > 6 && h('div', {}, `……还有 ${lines.length - 6} 行，见记录文件`)));
      })),
      h('p', { class: 'small muted' }, saved ? '完整记录已保存到 data/midi-probe.jsonl（kind 是 "ch5-8" 的那一行）。' : '记录没能保存到本地服务（服务可能没在运行）。'),
      h('div', { class: 'row', style: { marginTop: '12px' } },
        h('button', { class: 'btn primary', type: 'button', onclick: () => { results = []; intro(); } }, '完成'),
        h('button', { class: 'btn', type: 'button', onclick: () => startCh() }, '重做一遍')),
    );
  }

  intro();
  const offState = midi.on('state', () => index < 0 && intro());
  return {
    el,
    destroy() {
      stopCapture();
      offState();
    },
  };
}

// ───────────── 功能键测试 ─────────────
// 单独按住 [DELETE] [MUTE] [SOLO] [PAGE] 时，机器报什么。
// 2026-11-10 用户在真机上测过一遍，结论（docs/hardware-findings.md）：这四个键不动“界面状态”01 10 18，
// 而是让机器把每条轨道灯的“显示方式”（01 1p 39 的第一个字节）从 1 换成 2 / 3 / 4 / 5，松手换回 1；
// 这个值问不出来，只在变的时候由机器主动报。真机镜像已经按这张表认这四个键（mirror.js 的 HELD_BY_LED）。
// 这个向导留着用来复核：换了固件、或者镜像认错了的时候，再按一遍就知道机器现在报的是什么。

const HOLD_STEPS = [
  { key: 'DELETE', n: 3, expect: 2 },
  { key: 'MUTE', n: 4, expect: 3 },
  { key: 'SOLO', n: 5, expect: 4 },
  { key: 'PAGE', n: 6, expect: 5 },
];
const LED_ADDR = '01 10 39'; // KICK 轨的灯；11 条轨道同时换，看一条就够
const LED_IDLE = [0, 1, 0x0a]; // 1 = 平时，0 = 正在换工程，0A = 正按住一个亮着的方键
const hex2 = (b) => b.toString(16).toUpperCase().padStart(2, '0');

/** 把四步的记录判读成一行一行的结论：[和镜像认的一致吗, 文字] */
export function judgeHoldKeys(results) {
  return HOLD_STEPS.map((step, i) => {
    const vals = [...new Set(results[i]?.values || [])];
    const others = (results[i]?.changes || []).filter((c) => !/^01 1[0-9A] 39$/.test(c.addr) && c.addr !== '01 10 2D').length;
    if (!vals.length) return [false, `[${step.key}]：按住的时候，机器没有报告轨道灯换了显示方式${others ? `（报了 ${others} 条别的变化，已经记下来）` : ''}。镜像认不出这次按键。`];
    if (vals.length > 1) return [false, `[${step.key}]：机器先后报了好几种显示方式（${vals.map(hex2).join('、')}），多半是中途碰到了别的键。再按一遍试试。`];
    return vals[0] === step.expect
      ? [true, `[${step.key}]：按住时轨道灯换成显示方式 ${hex2(vals[0])}，和镜像认的一样。`]
      : [false, `[${step.key}]：按住时轨道灯换成了显示方式 ${hex2(vals[0])}，镜像认的是 ${hex2(step.expect)}，对不上，已经记下来。`];
  });
}

export function holdWizard() {
  const el = h('div', { class: 'card' });
  let cleanup = [];
  let index = -1;
  let results = [];
  const stop = () => cleanup.splice(0).forEach((f) => f());

  function intro() {
    stop();
    index = -1;
    clear(el);
    el.append(
      h('h3', {}, '功能键测试'),
      h('p', { class: 'muted small', style: { margin: '6px 0 14px' }, html: rich('真机镜像已经认得单独按住的 [DELETE]、[MUTE]、[SOLO]、[PAGE]：在「面板」页按住其中一个，屏幕上它会被画上黑圈，并提示接下来按什么。要是哪个键它认错了、认不出，在这里把四个键各按住两秒，就能看到机器实际报的是什么。') }),
      midi.connected && midi.sysex
        ? h('button', { class: 'btn', type: 'button', onclick: () => { results = []; go(0); } }, '核对一遍')
        : h('span', { class: 'tag warn' }, '需要先连接真机'),
    );
  }

  function go(i) {
    stop();
    index = i;
    if (i >= HOLD_STEPS.length) return finish();
    const step = HOLD_STEPS[i];
    const t0 = performance.now();
    const rec = { key: step.key, values: [], changes: [] };
    results[i] = rec;
    const last = new Map(); // 地址 → 上一次看到的值
    let advance = null;
    const pulse = h('span', { class: 'pulse' });
    const text = h('span', {});
    const say = (t, done) => {
      text.innerHTML = rich(t);
      pulse.style.background = done ? 'var(--lamp-ok)' : '';
      pulse.style.animation = done ? 'none' : '';
    };
    say(`等你按住 [${step.key}]…`);

    // 机器主动报上来的参数变化，全部记下；其中轨道灯的显示方式用来判断“按住了 / 松开了”
    cleanup.push(midi.on('sysex', (m) => {
      const d = m.data;
      if (m.reply || d[1] !== 0x43 || (d[2] & 0xf0) !== 0x10 || d[5] !== 0x0c) return;
      const addr = `${hex2(d[6])} ${hex2(d[7])} ${hex2(d[8])}`;
      const value = Array.from(d.slice(9, -1));
      if (last.get(addr) === value.join(',')) return;
      last.set(addr, value.join(','));
      rec.changes.push({ ms: Math.round(performance.now() - t0), addr, value: value.map(hex2).join(' ') });
      if (addr !== LED_ADDR) return;
      clearTimeout(advance);
      if (!LED_IDLE.includes(value[0])) {
        rec.values.push(value[0]);
        say(`机器报告：**按住了**（轨道灯换成显示方式 ${hex2(value[0])}）。可以松手了。`);
      } else if (value[0] === 1 && rec.values.length) {
        say('松开了，记下了。', true);
        advance = setTimeout(() => go(i + 1), 900);
      }
    }));
    cleanup.push(() => clearTimeout(advance));

    const panel = createPanel({ highlight: [step.key] });
    clear(el);
    el.append(
      h('div', { class: 'label' }, `功能键测试 · 第 ${i + 1} / ${HOLD_STEPS.length} 个`),
      h('h3', { style: { margin: '8px 0 6px' }, html: rich(`按住 [${step.key}] 两秒`) }),
      h('p', { style: { color: 'var(--text-2)' }, html: rich(`机器**左侧面**那一列，从上往下**第 ${step.n} 个**键（屏幕上蓝圈的那个）。**按住**它，心里数“一、二”，再松开。`) }),
      h('div', { class: 'callout warn', style: { margin: '10px 0 12px' } }, h('b', { class: 'label' }, '只按这一个键'), '按住的时候，别的键和旋钮都不要碰：这几个键和别的键一起按，会删东西或者静音。'),
      panel.el,
      h('div', { class: 'task-status' }, pulse, text),
      h('div', { class: 'row', style: { marginTop: '14px' } },
        h('button', { class: 'btn', type: 'button', onclick: () => go(i + 1) }, i === HOLD_STEPS.length - 1 ? '做完了，看结果' : '这一个按过了 →'),
        h('button', { class: 'btn ghost sm', type: 'button', onclick: intro }, '退出'),
        h('span', { class: 'small muted' }, '机器一报告“松开了”就会自动进下一个；它没反应的话，按过之后点左边。'),
      ),
    );
  }

  async function finish() {
    stop();
    const lines = judgeHoldKeys(results);
    let saved = true;
    try {
      await api.post('/api/probe', { kind: 'hold-keys', firmware: seqtrak.state.firmware, steps: results, summary: lines.map(([ok, t]) => `${ok ? 'OK' : '??'} ${t}`) });
    } catch {
      saved = false;
    }
    const allOk = lines.every(([ok]) => ok);
    clear(el);
    el.append(
      h('h3', {}, '功能键测试 · 结果'),
      h('ul', { style: { margin: '12px 0', paddingLeft: '0', listStyle: 'none' } }, lines.map(([ok, t]) => h('li', { style: { display: 'flex', gap: '10px', margin: '8px 0' } }, h('span', { class: `tag ${ok ? 'ok' : 'warn'}` }, ok ? '认得' : '对不上'), h('span', { html: rich(t) })))),
      h('p', { class: 'small', style: { color: 'var(--text-2)' }, html: rich(allOk
        ? '四个键镜像都认得。去「面板」页的「真机镜像」，**按住**其中一个不放，屏幕上它会被画上黑圈，并告诉你接下来按什么。'
        : '标着“对不上”的键，镜像现在可能认不出或者认错；下次开发时会按这份记录修正。') }),
      h('p', { class: 'small muted' }, saved ? '完整记录已保存到 data/midi-probe.jsonl。' : '记录没能保存到本地服务（服务可能没在运行）。'),
      // “完成”收回成开头那张小卡片
      h('div', { class: 'row', style: { marginTop: '12px' } },
        h('button', { class: 'btn primary', type: 'button', onclick: () => { results = []; intro(); } }, '完成'),
        h('button', { class: 'btn', type: 'button', onclick: () => { results = []; go(0); } }, '再核对一遍'),
        h('a', { class: 'btn', href: '#/panel' }, '去「面板」页试试')),
    );
    index = -1;
  }

  intro();
  const offState = midi.on('state', () => index < 0 && intro());
  return {
    el,
    destroy() {
      stop();
      offState();
    },
  };
}

// ───────────── 第 5–8 章的按键：只记录，不下结论 ─────────────
// 第 5–8 章有十几样操作，机器会不会主动报给应用、报什么，没人在机器上试过（docs/hardware-findings.md 最后一节
// “这几章还没测、需要有人在机器上动手的”），所以课程里这些任务现在都要学生自己点“我已经做了”。
// 这一轮带用户在真机上把它们各做一遍：每一步机器主动发来的消息原样记下来；录采样前、录完、存了之后、取消之后、最后，
// 各只读地读一遍 7 个采样位的名字（50 eA 00–3F）；用户看到的灯（问一句、或者在图上点出来）也记下来，免得“没信号”和“没做成”分不清。
// 2026-11-10 功能键测试的教训：向导先猜了信号是什么，用户测完看到“没认出来”，白走一轮。所以这一轮的结果页只列“收到了什么”，
// 不判对错；由下次开发读 data/midi-probe.jsonl 里 kind 是 "ch5-8" 的那一行（node tools/probe-ch5-8.mjs）再决定镜像怎么认。
// 每一步的按法照 docs/seqtrak-operation-reference.md：3.10.1 / 3.10.3 换工程和临时保存、3.13.2 / 3.13.3 / 3.13.5 采样、
// 3.11.4 存、3.14.1 Song / Scene、3.15.1 混音台、3.15.2 静音模式、3.12.4 触摸条。应用不往机器里写任何东西，只发查询。
// 要录音、放音乐的几步（blank 写着为什么）开始之前会问一下在几号工程，不在 5–8 号（空白工程）就先拦住。

const isBlank = (p) => p >= 4 && p <= 7; // 5–8 号工程（出厂是空白的）
/** 在图上标出来的方键，按编号从小到大：{ DK15: 'white', DK14: 'yellow' } → [14, 15] */
const litKeys = (marked) => Object.keys(marked || {}).filter((id) => /^DK\d+$/.test(id)).map((id) => Number(id.slice(2))).sort((a, b) => a - b);
const markedText = (marked) => {
  const keys = litKeys(marked);
  return keys.length ? keys.map((n) => `第 ${n} 个${marked[`DK${n}`] === 'yellow' ? '黄' : '白'}`).join('、') : '一个都没亮';
};
const HOLD_ALL = '① **按住** [ALL] 旋钮不放　→　② 按一下 [PROJECT↑]　→　③ 都松开';

export const CH58_STEPS = [
  {
    id: 'project', part: '准备', title: '切到 8 号空白工程', watchProject: true,
    text: '**先按住** [PROJECT↑]（右侧面**最下面**那个键）**不放，再按一下**上排**第 8 个**方键（最右边那个），然后都松开。已经在 5–8 号里的话，不用换。',
    combo: '① **按住** [PROJECT↑] 不放　→　② 按一下上排第 8 个方键　→　③ 都松开',
    hold: ['PROJECT'], show: ['DK8'],
    warn: '这一轮会在机器上**录一小段声音、存下来**，还会放一会儿音乐，所以要在**空白工程（5–8 号）**里做。1–3 号是演示曲，4 号是你上课用的，都别用。',
  },
  {
    id: 's-select', part: '采样', title: '选中采样器的第 7 个位', reads: true,
    text: '先按一下 **SAMPLER 旋钮**（中间合成器区，**下排右边**那个旋钮；按下去，不是转），再按一下 **Synth key 7**（合成器区**下排最右边**的方键）。手册说 Synth key 7 会**红色闪**：接下来录的声音放在这个位上。',
    combo: '① 按一下 SAMPLER 旋钮　→　② 按一下 Synth key 7',
    show: ['SAMPLER', 'SK7'],
    ask: { q: 'Synth key 7 在红色闪吗？', options: ['在闪', '没闪'] },
  },
  {
    id: 's-source-look', part: '采样', title: '看一眼：换采样源时亮哪几个方键',
    text: '**按住** [REC SAMPLE]（中间合成器区**上边沿**那一排 5 个小键的**最右边**）**不放**，心里数“一、二、三”（要 2 秒以上）。一直按着，看左边那 16 个方键：手册说会亮起三个——**白色**的是能换过去的，**黄色**的是现在用的。看清楚之后**直接松手，别的键都不按**。',
    combo: '① **按住** [REC SAMPLE] 数到三　→　② 看方键　→　③ 松手（别的键都不按）',
    hold: ['RECSAMPLE'],
    mark: '在下面这张图上把刚才亮着的方键点出来：**点一下 = 白色，再点一下 = 黄色，再点一下 = 灭**。',
  },
  {
    id: 's-source-usb', part: '采样', title: '把采样源换到 USB',
    make: ({ marked }) => {
      const k = litKeys(marked);
      return {
        text: `再**按住** [REC SAMPLE] 数到三**不放**，等方键亮起来，**同时按一下**${k.length === 3 ? `**第 ${k[1]} 个**方键（你标出来的三个里中间那个）` : '亮着的那几个里**从左数第 2 个**'}——手册说它是 **USB**。然后都松开。`,
        show: k.length === 3 ? [`DK${k[1]}`] : [],
      };
    },
    combo: '① **按住** [REC SAMPLE] 数到三　→　② 按一下亮着的中间那个　→　③ 都松开',
    hold: ['RECSAMPLE'],
    ask: { q: '按下去的时候，它变成黄色了吗？', options: ['变黄了', '没变', '没注意'] },
  },
  {
    id: 's-source-mic', part: '采样', title: '换回内置麦克风',
    make: ({ marked }) => {
      const k = litKeys(marked);
      return {
        text: `同样：**按住** [REC SAMPLE] 数到三**不放**，等方键亮起来，**按一下**${k.length === 3 ? `**第 ${k[0]} 个**方键（三个里最左边那个）` : '亮着的那几个里**最左边**那个'}——手册说它是**内置麦克风 / AUDIO IN**。然后都松开。**这一步一定要做**：下一步要用麦克风录。`,
        show: k.length === 3 ? [`DK${k[0]}`] : [],
      };
    },
    combo: '① **按住** [REC SAMPLE] 数到三　→　② 按一下亮着的最左边那个　→　③ 都松开',
    hold: ['RECSAMPLE'],
    ask: { q: '按下去的时候，最左边那个变成黄色了吗？', options: ['变黄了', '没变', '没注意'] },
  },
  {
    id: 's-rec', part: '采样', title: '录一小段', blank: '录音', reads: true,
    text: 'Synth key 7 应该还在红色闪（不闪就先按 SAMPLER 旋钮、再按 Synth key 7）。**按一下** [REC SAMPLE] 开始录，对着机器**拍两下手**（或者说一句话），**再按一下** [REC SAMPLE] 结束。最后**按一下 Synth key 7**，听听录到了什么。',
    combo: '① 按一下 [REC SAMPLE]　→　② 拍两下手　→　③ 再按一下 [REC SAMPLE]　→　④ 按 Synth key 7 听',
    show: ['RECSAMPLE', 'SK7', 'SPEAKER'],
    note: '麦克风在右上角那块格栅里（印着 MIC）。[AUDIO IN] 插着线的话，录的是那根线进来的声音。',
    ask: { q: '按 Synth key 7，听到的是你刚录的声音吗？', options: ['是', '不是', '没试'] },
  },
  {
    id: 's-save', part: '采样', title: '把录的存下来', blank: '存采样', reads: true,
    text: '**先按住** [ALL] 旋钮（鼓区**左上角**那个旋钮）**不放，再按一下 SOUND 旋钮**（右边桔红区那一列**最上面**的旋钮；按下去，不是转），然后都松开。手册说存好了，右边那一列 8 个小灯（Global Meter）会**白色闪**一下。',
    combo: '① **按住** [ALL] 旋钮不放　→　② 按一下 SOUND 旋钮　→　③ 都松开',
    hold: ['ALL'], show: ['SD1', 'METER'],
    note: '存下来的会留在机器里（和第 4 章存音色一样；存过的音色手册说只能在 SEQTRAK App 里删）。',
    ask: { q: 'Global Meter 白色闪了吗？', options: ['闪了', '没看到'] },
  },
  {
    id: 's-cancel', part: '采样', title: '开始录，然后取消', blank: '录音', reads: true,
    text: '**按一下** [REC SAMPLE] 开始录（还是录到第 7 个位上）。马上**先按住** [DELETE]（左侧面从上往下**第 3 个**键）**不放，再按一下** [REC SAMPLE]：取消这一次。最后**按一下 Synth key 7** 听听——手册说取消之后会回到录之前的声音，也就是刚才存下来的那段。',
    combo: '① 按一下 [REC SAMPLE]　→　② **按住** [DELETE] 不放　→　③ 按一下 [REC SAMPLE]　→　④ 都松开，按 Synth key 7 听',
    hold: ['DELETE'], show: ['RECSAMPLE', 'SK7'],
    ask: { q: '按 Synth key 7，听到的是——', options: ['还是存下来的那段', '变成了别的', '没试'] },
  },
  {
    id: 'song-in', part: 'Song / Scene 模式', title: '进 Song 模式',
    text: '**先按住** [ALL] 旋钮（鼓区左上角）**不放，再按一下** [PROJECT↑]（右侧面最下面），然后都松开。手册说这时 Index（右边桔红区**最左边那一列字**）**最下面的 SONG** 会亮。',
    combo: HOLD_ALL, hold: ['ALL'], show: ['PROJECT', 'INDEX'],
    warn: '进去之后**先别按方键**：在 Song 模式里按一个不亮的方键，会多出一个 scene。',
    ask: { q: 'Index 最下面的 SONG 亮了吗？', options: ['亮了', '没亮'] },
  },
  {
    id: 'scene-in', part: 'Song / Scene 模式', title: '再按一次：进 Scene 模式',
    text: '同样的按法再做一次：**按住** [ALL] 旋钮**不放，再按一下** [PROJECT↑]。手册说这一下从 Song 模式进到 **Scene 模式**（有 scene 的方键亮青蓝色，选中的那个亮紫色）。还是**先别按方键**。',
    combo: HOLD_ALL, hold: ['ALL'], show: ['PROJECT'],
    ask: { q: '方键上有亮的吗？什么颜色？（可以选几个）', options: ['紫色', '青蓝', '白色', '都不亮'], multi: true },
  },
  {
    id: 'song-out', part: 'Song / Scene 模式', title: '第三次：回到平常',
    text: '第三次：**按住** [ALL] 旋钮**不放，再按一下** [PROJECT↑]。手册说这一下退出 Scene 模式、回到平常的状态，SONG 灭掉。',
    combo: HOLD_ALL, hold: ['ALL'], show: ['PROJECT', 'INDEX'],
    ask: { q: 'SONG 灭了吗？', options: ['灭了', '还亮着'] },
  },
  {
    id: 'mute-in', part: '静音模式 · 混音台', title: '进静音模式',
    text: '**先按住** [ALL] 旋钮**不放，再按一下** [MUTE]（左侧面从上往下**第 4 个**键），然后都松开。手册说 [ALL] 旋钮右边那 3 个小灯会**变绿**。',
    combo: '① **按住** [ALL] 旋钮不放　→　② 按一下 [MUTE]　→　③ 都松开',
    hold: ['ALL'], show: ['MUTE'],
    warn: '在静音模式里**先别按轨道旋钮**：按一下就是把那条轨道静音。',
    ask: { q: '[ALL] 旁边 3 个小灯变绿了吗？', options: ['变绿了', '没变'] },
  },
  {
    id: 'mute-out', part: '静音模式 · 混音台', title: '退出静音模式',
    text: '**单按一下** [MUTE]（不用按住别的键）。手册说这样就退出了，绿灯灭掉。',
    combo: '① 按一下 [MUTE]', show: ['MUTE'],
    ask: { q: '绿灯灭了吗？', options: ['灭了', '还亮着'] },
  },
  {
    id: 'mixer-in', part: '静音模式 · 混音台', title: '进混音台模式',
    text: '**先按住** [ALL] 旋钮**不放，再按一下** [VOL+]（左侧面**最上面**那个键），然后都松开。手册说 Index 上的 **MIXER**（倒数第二行）会亮。',
    combo: '① **按住** [ALL] 旋钮不放　→　② 按一下 [VOL+]　→　③ 都松开',
    hold: ['ALL'], show: ['VOL+', 'INDEX'],
    ask: { q: 'MIXER 亮了吗？', options: ['亮了', '没亮'] },
  },
  {
    id: 'mixer-turn', part: '静音模式 · 混音台', title: '在混音台里拧一下 KICK 的音量',
    text: '先**按一下 Sound Design 旋钮 2**（右边那一列从上往下**第 2 个**旋钮，SOUND 下面那个；按下去，不是转）：手册说这样选的是**音量**。然后把 **KICK 旋钮**（鼓区上排第 2 个，[ALL] 右边那个）**往左转一格**，停一秒，**再往右转一格**转回来。',
    combo: '① 按一下 Sound Design 旋钮 2　→　② KICK 旋钮往左转一格　→　③ 再往右转一格',
    show: ['SD2', 'KICK'],
  },
  {
    id: 'mixer-out', part: '静音模式 · 混音台', title: '退出混音台模式',
    text: '再做一次：**按住** [ALL] 旋钮**不放，再按一下** [VOL+]。手册说 MIXER 会灭。',
    combo: '① **按住** [ALL] 旋钮不放　→　② 按一下 [VOL+]　→　③ 都松开',
    hold: ['ALL'], show: ['VOL+', 'INDEX'],
    ask: { q: 'MIXER 灭了吗？', options: ['灭了', '还亮着'] },
  },
  {
    id: 'temp-save', part: '临时保存 · 触摸条', title: '临时保存',
    // 当前工程的方键 = 上排第 n 个；恢复用的青蓝色键在它正下方 = 第 n + 8 个（手册 3.10.3 的插图）
    make: ({ project }) => {
      const n = project === null ? 0 : project + 1;
      return n ? {
        text: `**先按住** [PROJECT↑]（右侧面最下面）**不放**：上排**第 ${n} 个**方键亮黄色（就是现在这个 ${n} 号工程）。**再按一下这个黄色的**，然后都松开。手册说这样就把工程现在的样子临时存了一份。`,
        combo: `① **按住** [PROJECT↑] 不放　→　② 按一下上排第 ${n} 个（黄色的）　→　③ 都松开`,
        show: [`DK${n}`], lit: { [`DK${n}`]: 'yellow' },
        ask: { q: `按住 [PROJECT↑] 的时候，黄色那个**正下方**的方键（第 ${n + 8} 个）亮青蓝色吗？`, options: ['亮', '不亮', '没注意'] },
      } : {
        text: '**先按住** [PROJECT↑]（右侧面最下面）**不放**：上排有一个方键亮**黄色**，就是现在这个工程。**再按一下这个黄色的**，然后都松开。手册说这样就把工程现在的样子临时存了一份。',
        combo: '① **按住** [PROJECT↑] 不放　→　② 按一下上排黄色的那个　→　③ 都松开',
        ask: { q: '按住 [PROJECT↑] 的时候，黄色那个**正下方**的方键亮青蓝色吗？', options: ['亮', '不亮', '没注意'] },
      };
    },
    hold: ['PROJECT'],
  },
  {
    id: 'slide-hp', part: '临时保存 · 触摸条', title: '推 [HIGH PASS]', blank: '放音乐',
    text: '先**短按一下** [PLAY]（左侧面**最下面**那个键）让机器放起来——**别按住**，按住 2 秒是关机。然后手指放在 **[HIGH PASS]** 的**最下面**（右下角并排两条触摸条里**左边**那条），**慢慢往上滑到最上面**，停一秒，**松手**。',
    combo: '① 短按 [PLAY]　→　② [HIGH PASS] 从下往上慢慢滑　→　③ 停一秒　→　④ 松手',
    show: ['PLAY', 'HIGHPASS'],
  },
  {
    id: 'slide-rep', part: '临时保存 · 触摸条', title: '推 [REPEATER]', blank: '放音乐',
    text: '机器还放着。手指放在 **[REPEATER]**（[HIGH PASS] **右边**那条）的**最下面**，慢慢往上滑到最上面，停一秒，**松手**。',
    combo: '① [REPEATER] 从下往上慢慢滑　→　② 停一秒　→　③ 松手',
    show: ['REPEATER'],
  },
  {
    id: 'slide-fx', part: '临时保存 · 触摸条', title: '滑 [FX LEVEL]，然后停下', blank: '放音乐',
    text: '机器还放着。手指放在 **[FX LEVEL]**（[FX] 旋钮和拨动开关**下面**那条）的**最下面**，慢慢往上滑到最上面，停一秒，**松手**。然后**短按一下** [PLAY] 停下来。',
    combo: '① [FX LEVEL] 从下往上慢慢滑　→　② 停一秒、松手　→　③ 短按 [PLAY] 停',
    show: ['FXLEVEL', 'MASTERSINGLE', 'PLAY'],
    note: '[FX LEVEL] 松手之后不会自己回去（这是空白工程，不要紧）。',
    ask: { q: '[FX] 旋钮下面那个拨动开关拨在哪边？', options: ['左边 MASTER', '右边 SINGLE', '没看'] },
  },
  {
    id: 'temp-restore', part: '临时保存 · 触摸条', title: '恢复到临时保存的样子',
    make: ({ project }) => {
      const n = project === null ? 0 : project + 1;
      return n ? {
        text: `**先按住** [PROJECT↑] **不放，再按一下**下排**第 ${n + 8} 个**方键（黄色那个的**正下方**，亮青蓝色），然后都松开。手册说这样工程就回到刚才临时保存时的样子。`,
        combo: `① **按住** [PROJECT↑] 不放　→　② 按一下第 ${n + 8} 个（青蓝色的）　→　③ 都松开`,
        show: [`DK${n + 8}`], lit: { [`DK${n}`]: 'yellow', [`DK${n + 8}`]: 'cyan' },
      } : {
        text: '**先按住** [PROJECT↑] **不放，再按一下**黄色那个**正下方**亮青蓝色的方键，然后都松开。手册说这样工程就回到刚才临时保存时的样子。',
        combo: '① **按住** [PROJECT↑] 不放　→　② 按一下青蓝色的那个　→　③ 都松开',
      };
    },
    hold: ['PROJECT'],
  },
];

// 采样位的名字在哪几步之后读过（列在结果页的表里）
const NAME_AT = { 's-select': '录之前', 's-rec': '录完', 's-save': '存了之后', 's-cancel': '取消之后' };

const hexOf = (data) => Array.from(data || [], (b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

/** 机器主动报的参数变化 F0 43 1n 7F 1C 0C ah am al 数据… F7 → { addr: '01 10 18', value: '01' }；别的消息返回 null */
function paramOf(hex) {
  const m = /^F0 43 1[0-9A-F] 7F 1C 0C ([0-9A-F]{2} [0-9A-F]{2} [0-9A-F]{2}) ?(.*?) ?F7$/.exec(hex || '');
  return m ? { addr: m[1], value: m[2] } : null;
}

function describeMsg(m, hex) {
  if (m.type === 'noteon') return `音符 · 通道 ${m.ch} · 音符号 ${m.note} · 力度 ${m.vel}`;
  if (m.type === 'noteoff') return `松开 · 通道 ${m.ch}`;
  if (m.type === 'cc') return `控制器 ${m.cc} = ${m.val} · 通道 ${m.ch}`;
  if (m.type === 'start') return '开始播放';
  if (m.type === 'stop') return '停止';
  if (m.type === 'pc') return `换音色 · 通道 ${m.ch}`;
  const p = paramOf(hex);
  return p ? `参数 ${p.addr} = ${p.value || '（空）'}` : `消息 ${hex.slice(0, 72)}`;
}

/**
 * 把一步里收到的消息归成几行人看得懂的（只是归类，不判断对错）：
 *   参数 01 10 18：00 → 01 → 00                （同一个地址先后报的值，相邻重复的只算一次）
 *   参数 01 10 39 等 11 个地址：02 00 → 01 01   （几个地址报的值一模一样时并成一行）
 *   CC 105（通道 1）：13 条，从 0 到 0，最小 0、最大 127
 */
export function describeEvents(events = []) {
  const params = new Map();
  const ccs = new Map();
  const notes = new Map();
  const other = new Map();
  const bump = (map, k) => map.set(k, (map.get(k) || 0) + 1);
  for (const e of events) {
    if (e.type === 'sysex') {
      const p = paramOf(e.hex);
      if (!p) bump(other, '别的 SysEx');
      else {
        const list = params.get(p.addr) || [];
        const v = p.value || '（空）';
        if (list.at(-1) !== v) list.push(v);
        params.set(p.addr, list);
      }
    } else if (e.type === 'cc') {
      const k = `${e.cc}|${e.ch}`;
      if (!ccs.has(k)) ccs.set(k, []);
      ccs.get(k).push(e.val);
    } else if (e.type === 'noteon') bump(notes, e.ch);
    else if (e.type !== 'noteoff') bump(other, { start: '开始播放', stop: '停止', continue: '继续播放', pc: '换音色', bend: '弯音', pressure: '触后' }[e.type] || e.type);
  }
  // 只差中间那个字节（比如 11 条轨道的 01 1p 39）、报的值又一模一样的几个地址，并成一行
  const groups = new Map();
  for (const [addr, vals] of params) {
    const seq = vals.length > 6 ? `${vals.slice(0, 3).join(' → ')} → …（共 ${vals.length} 次）… → ${vals.at(-1)}` : vals.join(' → ');
    const key = `${addr.slice(0, 2)}|${addr.slice(6)}|${seq}`;
    if (!groups.has(key)) groups.set(key, { seq, addrs: [] });
    groups.get(key).addrs.push(addr);
  }
  const out = [];
  for (const { seq, addrs } of groups.values()) out.push(`参数 ${addrs.length > 2 ? `${addrs[0]} … ${addrs.at(-1)}（${addrs.length} 个地址）` : addrs.join('、')}：${seq}`);
  for (const [k, vals] of ccs) {
    const [cc, ch] = k.split('|');
    out.push(`CC ${cc}（通道 ${ch}）：${vals.length} 条，从 ${vals[0]} 到 ${vals.at(-1)}，最小 ${Math.min(...vals)}、最大 ${Math.max(...vals)}`);
  }
  for (const [ch, n] of notes) out.push(`音符：通道 ${ch} × ${n}`);
  for (const [what, n] of other) out.push(`${what} × ${n}`);
  return out;
}

/** 读过采样位名字的那几次，按先后：[{ label: '录之前', names: [{ slot, name, hex }] }, …] */
export function nameCheckpoints(steps, final) {
  const cols = steps.filter((r) => r.names && NAME_AT[r.id]).map((r) => ({ label: NAME_AT[r.id], names: r.names }));
  if (final?.names) cols.push({ label: '最后', names: final.names });
  return cols;
}

/** 写进记录文件的那几行小结（和结果页上列的一样，只归类不判断） */
export function summarizeCh58(steps, final) {
  const lines = steps.map((r) => {
    const parts = [r.skipped ? '跳过了' : describeEvents(r.events).join('；') || '机器没发消息'];
    if (r.left) parts.push('点“退出”时停在这一步');
    if (r.answer?.length) parts.push(`你看到：${r.answer.join('、')}`);
    if (r.marked) parts.push(`你标的：${markedText(r.marked)}`);
    if (r.names) parts.push(`读到的采样位名字：${r.names.map((n) => `${n.slot}“${n.name}”`).join(' ')}`);
    return `${r.title}：${parts.join('｜')}`;
  });
  if (final?.names) lines.push(`最后读到的采样位名字：${final.names.map((n) => `${n.slot}“${n.name}”`).join(' ')}`);
  return lines;
}

function chPayload(steps, final, partial) {
  return { kind: 'ch5-8', version: 1, firmware: seqtrak.state.firmware, sysex: midi.sysex, ...(partial ? { partial: true } : {}), steps, ...(final ? { final } : {}), summary: summarizeCh58(steps, final) };
}

/** 只读地问一下机器在第几号工程（01 10 15，0–7）；问不到返回 null */
async function readProject() {
  if (!midi.connected || !midi.sysex) return null;
  try {
    const [v] = await seqtrak.read(ADDR.project, 300);
    return v ?? null;
  } catch {
    return null;
  }
}

/** 一口气问一批地址（每 2.5 毫秒一条；实测机器每秒应答 500 条不丢），收齐或者超时就返回 Map(地址 → 数据) */
function readBatch(addrs, spacing = 2.5) {
  return new Promise((resolve) => {
    const got = new Map();
    const want = new Set(addrs.map((a) => a.join(',')));
    let timer = null;
    const off = seqtrak.on('param', ({ addr, data, reply }) => {
      const k = addr.join(',');
      if (!reply || !want.has(k) || got.has(k)) return;
      got.set(k, data);
      if (got.size === want.size) done();
    });
    function done() {
      off();
      clearTimeout(timer);
      resolve(got);
    }
    timer = setTimeout(done, addrs.length * spacing + 800);
    if (!seqtrak.poll(addrs, spacing)) done();
  });
}

/**
 * 7 个采样位的名字，每个位 64 个字节（50 eA 00–3F，e = 0–6，2026-11-12 只读扫到的）：
 * 和音色名一样，每 8 个字节里第 1 个是“高位字节”、后 7 个是字母。原样的字节也留着（hex），名字里有不是英文字母的也看得出来。
 */
async function readSampleNames() {
  const addrs = [];
  for (let e = 0; e < 7; e++) for (let l = 0; l < 0x40; l++) addrs.push([0x50, (e << 4) | 0x0a, l]);
  const got = await readBatch(addrs);
  return Array.from({ length: 7 }, (_, e) => {
    const bytes = Array.from({ length: 0x40 }, (__, l) => got.get(`${0x50},${(e << 4) | 0x0a},${l}`) ?? null);
    const missing = bytes.filter((d) => d === null).length;
    return {
      slot: e + 1,
      name: decodeSoundName(bytes.map((d) => d?.[0] ?? 0)),
      hex: bytes.map((d) => (d ? hexOf(d).replace(/ /g, '') : '--')).join(' '),
      ...(missing ? { missing } : {}),
    };
  });
}

/** 问一句、给几个选项（看到了没有）。只是把用户看到的记下来 */
function askBox(ask, rec) {
  const wrap = h('div', { class: 'probe-ask' });
  const picked = new Set();
  const render = () => wrap.replaceChildren(
    h('span', { html: rich(ask.q) }),
    h('div', { class: 'seg' }, ask.options.map((o) => h('button', {
      type: 'button',
      class: picked.has(o) ? 'on' : '',
      'aria-pressed': String(picked.has(o)),
      onclick: () => {
        if (ask.multi) {
          if (picked.has(o)) picked.delete(o);
          else picked.add(o);
        } else {
          picked.clear();
          picked.add(o);
        }
        rec.answer = [...picked];
        render();
      },
    }, o))),
  );
  render();
  return wrap;
}

/** 在一张只看方键的图上，把机器上亮着的方键点出来：点一下白、再点黄、再点灭 */
function markBox(text, rec) {
  const marked = {};
  const said = h('span', { class: 'small muted' }, '还没标。');
  const update = () => {
    rec.marked = { ...marked };
    panel.setLit(marked);
    said.textContent = `你标的：${markedText(marked)}`;
  };
  const panel = createPanel({
    onPick: (id) => {
      if (!/^DK\d+$/.test(id)) return;
      const next = marked[id] === undefined ? 'white' : marked[id] === 'white' ? 'yellow' : null;
      if (next) marked[id] = next;
      else delete marked[id];
      update();
    },
  });
  panel.focus(['DRUMKEYS'], { pad: 16 });
  const none = h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { for (const k of Object.keys(marked)) delete marked[k]; update(); } }, '一个都没亮');
  return h('div', { class: 'probe-mark' }, h('p', { html: rich(text) }), panel.el, h('div', { class: 'row', style: { marginTop: '6px' } }, said, none));
}
