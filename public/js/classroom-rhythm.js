// 小课堂的“节奏挑战关”：直接用音游的引擎（game.js 的 RhythmGame），有下落的音符、判定、连击、偏差仪。
// 三档：铜 = 慢一点（85% 速度）、有示范音陪着；银 = 原速、有示范音；金 = 原速、只剩节拍器、要打得更准。
// 这里不记音游的成绩（不进 store.data.charts、不涨音游的经验）：小课堂的星星和经验由页面按“牌”记（views/classroom.js）。
// 还有一个热身用的“数出来”（countalong）：一拍里有几下、该数“1 e & a”的哪几个字，看着灯数。
import { h, rich } from './util.js';
import { RhythmGame } from './game.js';
import { normalizeChart } from './chart.js';
import { LoopPlayer } from './looper.js';
import { midi } from './midi.js';
import { store } from './store.js';
import { segmented } from './ui.js';
import { byTier, keys16, playButton, tapPad, tapTime, pad16 } from './classroom-kit.js';
import { audio } from './audio.js';

const TIER_RULE = [
  { speed: 0.85, assist: 'guide', pass: 0.6, say: '85% 速度，示范音陪着你。准确率到 60% 就过。' },
  { speed: 1, assist: 'guide', pass: 0.72, say: '原速，示范音还在。准确率到 72% 才过。' },
  { speed: 1, assist: 'solo', pass: 0.85, say: '原速，只剩节拍器。准确率到 85% 才过。' },
];

/** spec.chart：谱面（写法同 content/charts.js）。spec.rules：想改三档的规矩时写（[铜, 银, 金]，只写要改的） */
function rhythm(spec, env) {
  const rule = { ...byTier(env.tier, TIER_RULE), ...(spec.rules ? byTier(env.tier, spec.rules) : {}) };
  const chart = normalizeChart({ id: `classroom-${spec.chart.id || 'chart'}`, loops: 4, title: spec.title || '', ...spec.chart });
  const host = h('div', { class: 'cl-rhythm-host' });
  const note = h('div', { class: 'cl-note', html: rich(`**${['铜', '银', '金'][(env.tier || 1) - 1]}**：${rule.say}`) });
  const el = h('div', { class: 'cl-toy cl-rhythm' }, host, note);
  const game = new RhythmGame(chart, {
    assist: rule.assist,
    speed: rule.speed,
    metronome: true,
    inputOffsetMs: store.settings.inputOffsetMs,
    passAccuracy: rule.pass,
    countInBeats: 4,
    showKeyHints: !midi.connected,
  });
  game.mount(host).attachKeyboard();
  if (midi.connected) game.attachMidi();
  game.elStage.classList.add('compact');
  const keys = chart.lanes.map((l) => `${l.key === ' ' ? '空格' : (l.key || '').toUpperCase()} = ${l.label}`).join('，');
  game.showCard(h('div', { class: 'game-card' },
    h('h3', { style: { marginTop: '0' } }, spec.title || '跟着落下来的音符打'),
    h('p', { html: rich(spec.how || '音符落到线上的那一刻，点那条轨道底下的键帽。') }),
    h('p', { class: 'small muted' }, midi.connected ? '直接在 SEQTRAK 上打也行。' : `电脑上也可以按键盘：${keys}。`),
    h('div', { class: 'game-actions' }, h('button', { class: 'btn primary lg', type: 'button', onclick: () => game.start() }, '开始'))));
  game.on('start', () => env.touched());
  game.on('done', (r) => {
    if (r.demo) return;
    const pct = Math.round(r.accuracy * 100);
    if (r.passed) {
      // 表现：准确率越高星越多（金那一档还要求准确率本身够高，页面会再看一眼）
      env.done(r.accuracy >= 0.92 ? 3 : r.accuracy >= rule.pass + 0.08 ? 2 : 1);
      note.innerHTML = rich(`准确率 **${pct}%**，最高连击 **${r.maxCombo}**：过了。`);
    } else {
      note.innerHTML = rich(`准确率 ${pct}%，这一档要 ${Math.round(rule.pass * 100)}%。点「再来一次」。${env.tier > 1 ? '先拿下低一档也行。' : ''}`);
    }
  });
  game.on('continue', () => game.showCard(null));
  return {
    el,
    game,
    destroy() {
      game.destroy();
    },
  };
}

// ───────────── 热身：数出来 ─────────────

const WORDS = ['1', 'e', '&', 'a', '2', 'e', '&', 'a', '3', 'e', '&', 'a', '4', 'e', '&', 'a'];

/**
 * 一小节 16 个格子，上面写着“1 e & a 2 e & a …”。选一拍切成几下（1 / 2 / 4），镲就落在那几格上，灯跟着走，嘴里跟着数。
 * spec.pattern：一开始的样子；spec.choices：给哪几种切法 [[名字, 节奏串], …]；spec.track：哪条轨道响（默认闭镲）
 */
function countalong(spec, env) {
  const choices = spec.choices || [['一拍 1 下', 'x---x---x---x---'], ['一拍 2 下', 'x-x-x-x-x-x-x-x-'], ['一拍 4 下', 'xxxxxxxxxxxxxxxx']];
  const track = spec.track || 'HAT1';
  let at = 0;
  const player = new LoopPlayer({ bpm: spec.bpm || 90 });
  const grid = keys16({ pattern: choices[0][1], editable: !!spec.editable, onChange: (p) => { apply(p); env.touched(); } });
  const words = h('div', { class: 'cl-words' }, WORDS.map((w, i) => h('i', { class: i % 4 === 0 ? 'beat' : '' }, w)));
  const apply = (p) => player.set({ KICK: spec.kick ?? 'x---x---x---x---', [track]: p });
  apply(grid.get());
  const say = h('div', { class: 'cl-note' });
  const paintSay = () => {
    const p = grid.get();
    const said = [...p].map((c, i) => (c === 'x' ? WORDS[i] : null)).filter(Boolean);
    say.innerHTML = rich(`跟着数：**${said.join(' ')}**。${spec.sayMore || ''}`);
  };
  player.onStep((s) => {
    grid.setHead(s);
    [...words.children].forEach((w, i) => w.classList.toggle('on', i === s && pad16(grid.get())[i] === 'x'));
  });
  const seg = segmented(
    choices.map(([name], i) => ({ value: String(i), label: name })),
    String(at),
    (v) => {
      at = Number(v);
      const p = choices[at][1];
      grid.set(p);
      apply(p);
      paintSay();
      env.touched();
    },
  );
  seg.classList.add('cl-seg');
  paintSay();
  const padCtl = spec.pad ? tapPad('拍', () => {
    audio.drum('PERC1', 0, 0.6);
    env.touched();
  }, '跟着数，跟着拍') : null;
  const el = h('div', { class: 'cl-toy cl-count16' },
    h('div', { class: 'cl-row' }, playButton(player, { onToggle: () => env.touched() }), seg),
    h('div', { class: 'cl-cap' }, '每一格下面是它的名字：一拍是“1 e & a”四个字'),
    words, grid.el, padCtl?.el, say);
  return {
    el,
    destroy() {
      player.stop();
      padCtl?.destroy();
    },
  };
}

// ───────────── 热身：挪一下 ─────────────

/**
 * 把一下鼓从拍子上挪到缝里（原来 T3 的点子，并进了 R5）：一排格子，按住一下鼓左右挪，听它从“稳”变成“想动”。
 * spec.base：不动的那几条；spec.track：要挪的那一条；spec.from：一开始在第几格
 */
function nudge(spec, env) {
  const track = spec.track || 'SNARE';
  let pos = spec.from ?? 12;
  const player = new LoopPlayer({ bpm: spec.bpm || 96 });
  const grid = keys16({ editable: true, onChange: (p, i) => { pos = i; paint(); env.touched(); } });
  const say = h('div', { class: 'cl-note' });
  const paint = () => {
    const p = '-'.repeat(16).split('');
    for (const s of spec.fixed || []) p[s] = 'x';
    p[pos] = 'x';
    grid.set(p.join(''));
    player.set({ ...spec.base, [track]: p.join('') });
    const onBeat = pos % 4 === 0;
    const half = pos % 2 === 0;
    say.innerHTML = rich(onBeat ? `第 ${pos + 1} 格：**踩在拍子上**，稳。` : half ? `第 ${pos + 1} 格：落在**两拍中间**（“&”）——反拍。` : `第 ${pos + 1} 格：落在**缝里的缝里**（“e”或“a”），抢先或者拖后——这就是**切分**的味道。`);
  };
  player.onStep((s) => grid.setHead(s));
  paint();
  const el = h('div', { class: 'cl-toy cl-nudge' },
    h('div', { class: 'cl-row' }, playButton(player, { onToggle: () => env.touched() }),
      h('button', { class: 'btn', type: 'button', onclick: () => { pos = (pos + 15) % 16; paint(); env.touched(); } }, '← 往前挪一格'),
      h('button', { class: 'btn', type: 'button', onclick: () => { pos = (pos + 1) % 16; paint(); env.touched(); } }, '往后挪一格 →')),
    h('div', { class: 'cl-cap' }, spec.cap || '亮着的那一格是会挪的那一下：点别的格子，它就搬过去'),
    grid.el, say);
  return { el, destroy: () => player.stop() };
}

// ───────────── 热身：两只手 ─────────────

/** 两块垫子：左手底鼓、右手军鼓（R7）。底下格子亮的是这一拍该谁 */
function twohands(spec, env) {
  const bpm = spec.bpm || 90;
  const player = new LoopPlayer({ bpm, click: true });
  const kick = pad16(spec.kick || 'x-------x-------');
  const snare = pad16(spec.snare || '----x-------x---');
  player.set({ HAT1: spec.hat || 'x-x-x-x-x-x-x-x-' });
  const gK = keys16({ pattern: kick, small: true });
  const gS = keys16({ pattern: snare, small: true });
  const say = h('div', { class: 'cl-note' }, '点「播放」，左手跟着上面那排拍“咚”（键盘 F），右手跟着下面那排拍“啪”（键盘 J）。');
  let beats = [];
  player.onSchedule = (step, t) => {
    beats.push({ step, t });
    if (beats.length > 40) beats.shift();
  };
  player.onStep((s) => {
    gK.setHead(s);
    gS.setHead(s);
  });
  const tagL = h('em', { class: 'cl-pad-tag', 'aria-hidden': 'true' });
  const tagR = h('em', { class: 'cl-pad-tag', 'aria-hidden': 'true' });
  let tagTimerL = 0;
  let tagTimerR = 0;
  const flashTag = (which, text, tone) => {
    const tag = which === 'KICK' ? tagL : tagR;
    tag.textContent = text;
    tag.dataset.tone = tone;
    tag.classList.add('on');
    if (which === 'KICK') {
      clearTimeout(tagTimerL);
      tagTimerL = setTimeout(() => tag.classList.remove('on'), 680);
    } else {
      clearTimeout(tagTimerR);
      tagTimerR = setTimeout(() => tag.classList.remove('on'), 680);
    }
  };
  const judge = (which, perf) => {
    if (!player.playing || !beats.length) return (say.textContent = '先点「播放」。');
    const t = tapTime(perf);
    const near = beats.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));
    const want = (which === 'KICK' ? kick : snare)[near.step] === 'x';
    const other = (which === 'KICK' ? snare : kick)[near.step] === 'x';
    const errMs = Math.round((t - near.t) * 1000);
    env.touched();
    if (want) {
      const tight = Math.abs(errMs) <= 35;
      flashTag(which, tight ? '准 !' : errMs < 0 ? `偏早 ${Math.abs(errMs)}ms` : `偏晚 +${errMs}ms`, tight ? 'ok' : 'warn');
      say.textContent = `${which === 'KICK' ? '咚' : '啪'}：对了（${tight ? '正踩在点上' : errMs < 0 ? `略早 ${Math.abs(errMs)}ms` : `略晚 ${errMs}ms`}）。`;
    } else if (other) {
      flashTag(which, '串手啦', 'bad');
      say.textContent = `这一下该${which === 'KICK' ? '右手（军鼓）' : '左手（底鼓）'}。`;
    } else {
      flashTag(which, '空拍', 'bad');
      say.textContent = '这一格两只手都歇着。';
    }
  };
  const left = tapPad('咚', (p) => {
    audio.drum('KICK', 0, 0.9);
    judge('KICK', p);
  }, '左手 · 底鼓 〔F〕');
  const right = tapPad('啪', (p) => {
    audio.drum('SNARE', 0, 0.9);
    judge('SNARE', p);
  }, '右手 · 军鼓 〔J〕');
  left.el.append(tagL);
  right.el.append(tagR);
  left.destroy(); // 两块垫子都不听真机：真机上用音游那一步打
  right.destroy();
  const onKey = (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;
    const k = e.key.toLowerCase();
    if (k === 'f' || k === 'j') {
      e.preventDefault();
      const padEl = k === 'f' ? left.el : right.el;
      padEl.classList.add('hit');
      setTimeout(() => padEl.classList.remove('hit'), 90);
      audio.drum(k === 'f' ? 'KICK' : 'SNARE', 0, 0.9);
      judge(k === 'f' ? 'KICK' : 'SNARE', e.timeStamp);
    }
  };
  window.addEventListener('keydown', onKey);
  const el = h('div', { class: 'cl-toy cl-hands2' },
    h('div', { class: 'cl-row' }, playButton(player), h('span', { class: 'spacer' })),
    h('div', { class: 'cl-two-grids' }, h('div', {}, h('span', { class: 'cl-cap' }, '底鼓（左手 · F）'), gK.el), h('div', {}, h('span', { class: 'cl-cap' }, '军鼓（右手 · J）'), gS.el)),
    h('div', { class: 'cl-two-pads' }, left.el, right.el), say);
  return {
    el,
    destroy: () => {
      clearTimeout(tagTimerL);
      clearTimeout(tagTimerR);
      window.removeEventListener('keydown', onKey);
      player.stop();
    },
  };
}

export const RHYTHM_TOYS = { rhythm, countalong, nudge, twohands };
