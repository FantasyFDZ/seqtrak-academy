// 课程里的互动小部件：用手玩一玩，比读三段文字管用。
import { h } from './util.js';
import { LoopPlayer } from './looper.js';
import { audio, midiToName } from './audio.js';
import { patternBoard } from './board.js';
import { SCALES, KEY_NAMES, synthKeyNotes, chordNotes, chordName, chordMood, chordAt } from './scales.js';
import { seqtrak } from './seqtrak.js';
import { midi } from './midi.js';
import { calibrateWidget } from './calibrate.js';
import { simWidget, ledLegend, panelExplore } from './panel-widgets.js';
import { SongPlayer, layerOrder, partsIn } from './song-player.js';
import { songParts, LAYERS } from './content/song-parts.js';
import { SOUND_DESIGN_WIDGETS } from './synth-lab.js'; // 第 4 章的音色实验台：synthlab / trackfilter / catkeys
import { CHAPTER_WIDGETS } from './chapter-toys.js'; // 第 5–8 章：samplelab / arranger / recorder
import { ARRANGEMENT_WIDGETS } from './arrangement-widgets.js'; // 完整版的课：arrangement（一排 scene）/ arrpattern（一段乐句的格子）

function playButton(player, labels = ['▶ 播放', '■ 停止']) {
  const btn = h('button', { class: 'btn primary', type: 'button' }, labels[0]);
  btn.addEventListener('click', () => {
    player.toggle();
    btn.textContent = player.playing ? labels[1] : labels[0];
  });
  return btn;
}

// ───────────── 速度滑杆 ─────────────

function genreAt(v) {
  if (v < 82) return 'Lo-fi、Downtempo 常在这一带：慢到可以发呆';
  if (v < 100) return 'Hip-hop、Boom Bap、R&B';
  if (v < 116) return 'Synthwave、Disco、流行';
  if (v < 131) return 'House —— 你打碟时最熟的 120–128';
  if (v < 150) return 'Techno、Trance';
  return 'Drum & Bass、Jungle（170 上下）';
}

function bpm({ value = 100, min = 60, max = 180, tracks = { KICK: 'x---x---x---x---' }, title = '同一个鼓点，换个速度就是另一种音乐' }) {
  const player = new LoopPlayer({ bpm: value }).set(tracks);
  const num = h('span', {}, String(value));
  const genre = h('div', { class: 'small muted', style: { marginTop: '12px' } }, genreAt(value));
  const lights = [1, 2, 3, 4].map((n) => h('i', { class: n === 1 ? 'first' : '' }, String(n)));
  const slider = h('input', { type: 'range', min, max, value, step: 1, 'aria-label': '速度 BPM' });
  slider.addEventListener('input', () => {
    const v = Number(slider.value);
    player.bpm = v;
    num.textContent = String(v);
    genre.textContent = genreAt(v);
  });
  player.onStep((s) => lights.forEach((l, i) => l.classList.toggle('on', s >= 0 && Math.floor(s / 4) === i)));
  const el = h('div', { class: 'widget' },
    h('h4', {}, title),
    h('div', { class: 'slider-row' }, playButton(player), h('div', { class: 'big-num' }, num, h('small', {}, 'BPM')), slider),
    h('div', { class: 'beat-lights' }, lights),
    genre,
  );
  return { el, destroy: () => player.stop() };
}

// ───────────── 数拍：1 e & a ─────────────

const COUNT_LABELS = ['1', 'e', '&', 'a', '2', 'e', '&', 'a', '3', 'e', '&', 'a', '4', 'e', '&', 'a'];
const SUBDIV = {
  4: { label: '四分音符', pattern: 'x---x---x---x---', say: '1 — 2 — 3 — 4' },
  8: { label: '八分音符', pattern: 'x-x-x-x-x-x-x-x-', say: '1 & 2 & 3 & 4 &' },
  16: { label: '十六分音符', pattern: 'xxxxxxxxxxxxxxxx', say: '1 e & a 2 e & a …' },
};

function count({ value = 4, bpm: tempo = 84, title = '把一拍切开：四分 → 八分 → 十六分' }) {
  let div = value;
  const player = new LoopPlayer({ bpm: tempo });
  const spans = COUNT_LABELS.map((s, i) => h('span', { class: i % 4 === 0 ? 'b' : '' }, s));
  const say = h('div', { class: 'small muted', style: { marginTop: '10px' } });
  const seg = h('div', { class: 'seg' });
  const apply = () => {
    player.set({ KICK: 'x---x---x---x---', HAT1: SUBDIV[div].pattern });
    spans.forEach((s, i) => (s.style.opacity = SUBDIV[div].pattern[i] === 'x' ? 1 : 0.28));
    say.textContent = `嘴里跟着念：${SUBDIV[div].say}。镲的声音就落在亮着的格子上，底鼓始终只在 1、2、3、4。`;
    seg.replaceChildren(...[4, 8, 16].map((d) => h('button', { type: 'button', class: d === div ? 'on' : '', onclick: () => { div = d; apply(); } }, SUBDIV[d].label)));
  };
  player.onStep((s) => spans.forEach((el, i) => el.classList.toggle('on', i === s)));
  apply();
  const el = h('div', { class: 'widget' },
    h('h4', {}, title),
    h('div', { class: 'row' }, playButton(player), seg),
    h('div', { class: 'count-line' }, spans),
    say,
  );
  return { el, destroy: () => player.stop() };
}

// ───────────── 迷你鼓机 ─────────────

const GRID_PRESETS = {
  清空: {},
  四踩: { KICK: 'x---x---x---x---' },
  House: { KICK: 'x---x---x---x---', CLAP: '----x-------x---', SNARE: '----x-------x---', HAT1: '--x---x---x---x-' },
  流行: { KICK: 'x-------x-x-----', SNARE: '----x-------x---', HAT1: 'x-x-x-x-x-x-x-x-' },
  'Boom Bap': { KICK: 'x------x--x-----', SNARE: '----x-------x---', HAT1: 'x-x-x-x-x-x-x-x-' },
};

function grid({ tracks = ['KICK', 'SNARE', 'HAT1'], pattern = {}, bpm: tempo = 100, presets = ['清空', '四踩', '流行', 'House'], title = '点格子，做一个你自己的鼓点' }) {
  const player = new LoopPlayer({ bpm: tempo });
  const board = patternBoard({ tracks, editable: true, pattern, onChange: (p) => player.set(p) });
  player.set(board.get()).onStep((s) => board.setHead(s));
  const el = h('div', { class: 'widget' },
    h('h4', {}, title),
    h('div', { class: 'row', style: { marginBottom: '14px' } },
      playButton(player),
      h('span', { class: 'spacer' }),
      presets.map((name) => h('button', {
        class: 'btn sm', type: 'button',
        onclick: () => {
          board.set(GRID_PRESETS[name] || {});
          player.set(board.get());
        },
      }, name)),
    ),
    board.el,
  );
  return { el, destroy: () => player.stop() };
}

// ───────────── A / B 对比 ─────────────

function ab({ a, b, bpm: tempo = 100, swingA = 0, swingB = 0, title = '听听区别' }) {
  const player = new LoopPlayer({ bpm: tempo });
  let current = null;
  const buttons = [a, b].map((side, i) => h('button', { class: 'btn', type: 'button' }, `▶ ${side.label}`));
  const stop = h('button', { class: 'btn ghost', type: 'button', onclick: () => select(null) }, '■ 停止');
  function select(i) {
    current = i;
    buttons.forEach((btn, j) => btn.classList.toggle('primary', j === i));
    player.stop();
    if (i === null) return;
    const side = i === 0 ? a : b;
    player.swing = i === 0 ? swingA : swingB;
    player.bpm = side.bpm || tempo;
    player.steps = side.steps || 16; // 两小节的例子写 steps: 32
    player.set(side.tracks || {}, side.notes || [], side.voice || 'bass');
    player.start();
  }
  buttons.forEach((btn, i) => btn.addEventListener('click', () => select(current === i ? null : i)));
  const el = h('div', { class: 'widget' }, h('h4', {}, title), h('div', { class: 'row' }, buttons, stop));
  return { el, destroy: () => player.stop() };
}

// ───────────── Swing ─────────────

function swing({ bpm: tempo = 92, title = 'Swing：把每对 16 分音符的后一个往后推' }) {
  const player = new LoopPlayer({ bpm: tempo }).set({ KICK: 'x-------x-x-----', SNARE: '----x-------x---', HAT1: 'xxxxxxxxxxxxxxxx' });
  const num = h('span', {}, '0');
  const say = h('div', { class: 'small muted', style: { marginTop: '12px' } }, '0 = 机器一样笔直。');
  const slider = h('input', { type: 'range', min: 0, max: 58, value: 0, step: 1, 'aria-label': 'Swing 量' });
  slider.addEventListener('input', () => {
    const v = Number(slider.value);
    player.swing = v / 120; // SEQTRAK：1 步 = 120 ticks
    num.textContent = String(v);
    say.textContent = v === 0 ? '0 = 机器一样笔直。' : v < 20 ? '有一点点松动，人味出来了。' : v < 42 ? '明显在“摇”了——Hip-hop、House 常用这个范围。' : '接近三连音的摇摆，爵士和老派 Boom Bap 的感觉。';
  });
  const el = h('div', { class: 'widget' },
    h('h4', {}, title),
    h('div', { class: 'slider-row' }, playButton(player), h('div', { class: 'big-num' }, num, h('small', {}, 'ticks')), slider),
    say,
  );
  return { el, destroy: () => player.stop() };
}

// ───────────── 钢琴键盘 ─────────────

const WHITE = [0, 2, 4, 5, 7, 9, 11];
const BLACK = [[1, 0], [3, 1], [6, 3], [8, 4], [10, 5]]; // [半音, 在第几个白键右边]

function pianoKeys({ from = 48, octaves = 2, voice = 'keys', highlight = () => false, root = () => false, onPlay }) {
  const el = h('div', { class: 'piano' });
  const total = octaves * 7;
  const keys = new Map();
  const press = (midiNote, node) => {
    audio.init().then(() => audio.note(midiNote, 0, 0.5, { voice }));
    node.classList.add('down');
    setTimeout(() => node.classList.remove('down'), 160);
    onPlay?.(midiNote);
  };
  for (let o = 0; o < octaves; o++) {
    WHITE.forEach((semi) => {
      const m = from + o * 12 + semi;
      const node = h('div', { class: 'white', onpointerdown: () => press(m, node) }, midiToName(m));
      keys.set(m, node);
      el.append(node);
    });
  }
  for (let o = 0; o < octaves; o++) {
    for (const [semi, afterWhite] of BLACK) {
      const m = from + o * 12 + semi;
      const left = ((o * 7 + afterWhite + 1) / total) * 100;
      const node = h('div', { class: 'black', style: { left: `calc(${left}% - 2.1%)` }, title: midiToName(m), onpointerdown: (e) => { e.stopPropagation(); press(m, node); } });
      keys.set(m, node);
      el.append(node);
    }
  }
  const refresh = () => {
    for (const [m, node] of keys) {
      node.classList.toggle('in', !!highlight(m));
      node.classList.toggle('root', !!root(m));
    }
  };
  refresh();
  return { el, refresh, flash(m) { const n = keys.get(m); if (n) { n.classList.add('down'); setTimeout(() => n.classList.remove('down'), 160); } } };
}

function piano({ from = 48, octaves = 2, voice = 'keys', title = '点一点：越往右越高，每 12 个键绕回同一个名字' }) {
  const info = h('div', { class: 'small muted', style: { marginTop: '12px' } }, '白键只有 7 个名字：C D E F G A B。黑键是夹在中间的“半个台阶”。');
  const keys = pianoKeys({ from, octaves, voice, onPlay: (m) => (info.textContent = `你按的是 ${midiToName(m)}。字母是音名，数字是第几个八度：数字每加 1，同名的音高一倍。`) });
  return { el: h('div', { class: 'widget' }, h('h4', {}, title), keys.el, info), destroy() {} };
}

// ───────────── 7 个 Synth keys：音阶 / 调 / 八度 ─────────────

function synthkeys({ scale = 0, key = 0, octave = 0, voice = 'keys', lockScale = false, title = 'SEQTRAK 的 7 个 Synth keys 会变成什么音？' }) {
  const state = { scale, key, octave };
  const notes = () => synthKeyNotes(state);
  const info = h('div', { class: 'small muted', style: { marginTop: '10px' } });
  const keyboard = pianoKeys({
    from: 36, octaves: 4, voice,
    highlight: (m) => notes().some((n) => n % 12 === m % 12),
    root: (m) => m % 12 === (60 + state.key) % 12,
  });
  const keyButtons = [1, 2, 3, 4, 5, 6, 7].map((d) => h('button', { class: 'btn', type: 'button', style: { minWidth: '62px', height: '52px', flexDirection: 'column', gap: '0' } }));
  keyButtons.forEach((btn, i) => btn.addEventListener('click', () => {
    const m = notes()[i];
    audio.init().then(() => audio.note(m, 0, 0.5, { voice }));
    keyboard.flash(m);
  }));
  const refresh = () => {
    const ns = notes();
    keyButtons.forEach((btn, i) => btn.replaceChildren(h('b', {}, midiToName(ns[i])), h('span', { class: 'small muted' }, `键 ${i + 1}`)));
    keyboard.refresh();
    const s = SCALES[state.scale];
    info.textContent = `${KEY_NAMES[state.key]} ${s.zh}（${s.name}）：${s.mood}。下面键盘上有橙色底边的就是这个音阶里的音。`;
  };
  const select = (options, value, onChange) => {
    const el = h('select', { class: 'input', style: { width: 'auto' } }, options.map(([v, label]) => h('option', { value: v, selected: v === value }, label)));
    el.addEventListener('change', () => { onChange(Number(el.value)); refresh(); });
    return el;
  };
  const controls = h('div', { class: 'row', style: { marginBottom: '14px' } },
    !lockScale && h('span', { class: 'seg-label' }, 'SCALE'),
    !lockScale && select(SCALES.map((s) => [s.id, `${s.zh} ${s.name === s.zh ? '' : s.name}`.trim()]), state.scale, (v) => (state.scale = v)),
    h('span', { class: 'seg-label', style: { marginLeft: '8px' } }, 'KEY'),
    select(KEY_NAMES.map((n, i) => [i, n]), state.key, (v) => (state.key = v)),
    h('span', { class: 'seg-label', style: { marginLeft: '8px' } }, 'OCTAVE'),
    select([-3, -2, -1, 0, 1, 2].map((o) => [o, o > 0 ? `+${o}` : String(o)]), state.octave, (v) => (state.octave = v)),
    midi.connected && h('button', {
      class: 'btn sm', type: 'button',
      onclick: () => { state.scale = seqtrak.state.scale; state.key = seqtrak.state.key; el.querySelectorAll('select').forEach((s, i) => { if (i === 0 && !lockScale) s.value = state.scale; if (i === (lockScale ? 0 : 1)) s.value = state.key; }); refresh(); },
    }, '读取机器当前的设置'),
  );
  const el = h('div', { class: 'widget' },
    h('h4', {}, title),
    controls,
    h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'btn ghost', style: { width: '62px', height: '52px', pointerEvents: 'none' } }, '●'), keyButtons.slice(0, 3)),
    h('div', { class: 'row', style: { gap: '8px', marginTop: '8px', marginBottom: '14px' } }, keyButtons.slice(3)),
    keyboard.el,
    info,
  );
  refresh();
  return { el, destroy() {} };
}

// ───────────── 和弦（第 3 章） ─────────────

const MOOD = { minor: ['暗', '小和弦：偏暗，带点忧郁'], major: ['亮', '大和弦：偏亮，开朗'], dim: ['紧', '减和弦：发紧，像悬着没落地'], other: ['', ''] };
const noteNames = (notes) => notes.map((n) => midiToName(n).replace(/-?\d+$/, '')).join(' ');
const keyStyle = { minWidth: '66px', height: '54px', flexDirection: 'column', gap: '0' };

/** 和机器上一样摆成两排的 7 个键（● 1 2 3 / 4 5 6 7）。buttons = 7 个按钮节点 */
function synthKeyRows(buttons) {
  return [
    h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'btn ghost', style: { width: '66px', height: '54px', pointerEvents: 'none' } }, '●'), buttons.slice(0, 3)),
    h('div', { class: 'row', style: { gap: '8px', marginTop: '8px', marginBottom: '14px' } }, buttons.slice(3)),
  ];
}

function playChord(notes, { voice = 'keys', spread = false } = {}) {
  audio.init().then((ok) => {
    if (!ok) return;
    const t0 = audio.now() + 0.02;
    // spread：先一个一个听，再一起听
    if (spread) notes.forEach((n, i) => audio.note(n, t0 + i * 0.34, 0.45, { voice, vel: 0.8 }));
    const at = spread ? t0 + notes.length * 0.34 + 0.12 : t0;
    notes.forEach((n) => audio.note(n, at, 1.2, { voice, vel: notes.length > 1 ? 0.5 : 0.85 }));
  });
}

/** 叠音：从 7 个键里“隔一个拿一个”，一层一层叠出一个和弦。 */
function chordstack({ scale = 0, key = 0, start = 1, size = 3, voice = 'keys', title = '隔一个拿一个：从 7 个键里叠出一个和弦' }) {
  const state = { start, size };
  const notes = () => chordNotes(state.start, { scale, key, size: state.size });
  const keysUsed = () => Array.from({ length: state.size }, (_, i) => ((state.start - 1 + 2 * i) % 7) + 1);
  const scaleNotes = synthKeyNotes({ scale, key });
  const info = h('div', { class: 'small', style: { marginTop: '12px', color: 'var(--text-2)', lineHeight: '1.7' } });
  const keyboard = pianoKeys({ from: 48, octaves: 3, voice, highlight: (m) => notes().includes(m), root: (m) => m === notes()[0] });
  const keyButtons = [1, 2, 3, 4, 5, 6, 7].map((d) => {
    const btn = h('button', { class: 'btn', type: 'button', style: keyStyle, title: `从键 ${d} 开始叠` });
    btn.addEventListener('click', () => {
      state.start = d;
      refresh();
      playChord(notes(), { voice });
    });
    return btn;
  });
  const sizeSeg = h('div', { class: 'seg' });
  const refresh = () => {
    const used = keysUsed();
    const ns = notes();
    keyButtons.forEach((btn, i) => {
      const order = used.indexOf(i + 1);
      btn.classList.toggle('primary', order >= 0);
      btn.replaceChildren(h('b', {}, midiToName(scaleNotes[i]).replace(/-?\d+$/, '')), h('span', { class: 'small', style: { opacity: 0.75 } }, order >= 0 ? `键 ${i + 1} · 第 ${order + 1} 层` : `键 ${i + 1}`));
    });
    sizeSeg.replaceChildren(...[1, 2, 3, 4].map((n) => h('button', { type: 'button', class: n === state.size ? 'on' : '', onclick: () => { state.size = n; refresh(); playChord(notes(), { voice }); } }, `${n} 个音`)));
    keyboard.refresh();
    const names = noteNames(ns);
    const mood = MOOD[chordMood(ns)][1];
    info.textContent = state.size === 1 ? `只有一个音：键 ${used[0]}（${names}）。它是这个和弦的“根音”——第 2 章里贝斯弹的就是它。`
      : state.size === 2 ? `两个音：键 ${used.join(' + 键 ')}（${names}）。跳过了中间的一个键。已经有点颜色了，再叠一个才站得稳。`
        : state.size === 3 ? `三个音：键 ${used.join(' + 键 ')} = ${names}。这就是一个和弦，叫 ${chordName(ns)}。${mood ? `${mood}。` : ''}`
          : `四个音：在三个音上面再隔一个键叠一层（${names}）。更厚、更“润”一点。SEQTRAK 的 CHORD 状态下，每个键放的就是这样 4 个音。`;
  };
  refresh();
  const el = h('div', { class: 'widget' },
    h('h4', {}, title),
    h('div', { class: 'row', style: { marginBottom: '14px' } },
      h('span', { class: 'seg-label' }, '叠几层'), sizeSeg,
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn', type: 'button', onclick: () => playChord(notes(), { voice, spread: true }) }, '▶ 一个一个听，再一起听'),
    ),
    h('div', { class: 'small muted', style: { marginBottom: '8px' } }, '点下面任意一个键，就从它开始叠：'),
    synthKeyRows(keyButtons),
    keyboard.el,
    info,
  );
  return { el, destroy() {} };
}

/** CHORD 状态下的 7 个键：每个键是什么和弦，点一下听。 */
function chordkeys({ scale = 0, key = 0, octave = 0, size = 4, voice = 'keys', title = 'CHORD 状态下，7 个 Synth keys 各是一个和弦' }) {
  const state = { size, picked: 0 };
  const chord = (d) => chordNotes(d, { scale, key, octave, size: state.size });
  const info = h('div', { class: 'small', style: { marginTop: '12px', color: 'var(--text-2)', lineHeight: '1.7' } }, '点一个键听听看。标着“暗”的是小和弦，标着“亮”的是大和弦。');
  const keyboard = pianoKeys({ from: 48, octaves: 3, voice, highlight: (m) => !!state.picked && chord(state.picked).includes(m), root: (m) => !!state.picked && m === chord(state.picked)[0] });
  const dot = { minor: 'var(--t-HAT2)', major: 'var(--t-SNARE)', dim: 'var(--muted)', other: 'var(--muted)' };
  const keyButtons = [1, 2, 3, 4, 5, 6, 7].map((d) => {
    const btn = h('button', { class: 'btn', type: 'button', style: keyStyle });
    btn.addEventListener('click', () => {
      state.picked = d;
      refresh();
      playChord(chord(d), { voice });
    });
    return btn;
  });
  const sizeSeg = h('div', { class: 'seg' });
  const refresh = () => {
    keyButtons.forEach((btn, i) => {
      const ns = chordNotes(i + 1, { scale, key, octave, size: 4 });
      const mood = chordMood(ns);
      btn.classList.toggle('primary', state.picked === i + 1);
      btn.replaceChildren(
        h('b', {}, chordName(ns)),
        h('span', { class: 'small', style: { opacity: 0.8 } }, h('i', { style: { display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: dot[mood], marginRight: '4px' } }), `键 ${i + 1}${MOOD[mood][0] ? ` · ${MOOD[mood][0]}` : ''}`),
      );
    });
    sizeSeg.replaceChildren(
      h('button', { type: 'button', class: state.size === 3 ? 'on' : '', onclick: () => { state.size = 3; refresh(); if (state.picked) playChord(chord(state.picked), { voice }); } }, '只听下面 3 个音'),
      h('button', { type: 'button', class: state.size === 4 ? 'on' : '', onclick: () => { state.size = 4; refresh(); if (state.picked) playChord(chord(state.picked), { voice }); } }, '4 个音（机器上的）'),
    );
    keyboard.refresh();
    if (state.picked) {
      const ns = chord(state.picked);
      const mood = MOOD[chordMood(chordNotes(state.picked, { scale, key, octave }))][1];
      info.textContent = `键 ${state.picked}：${noteNames(ns)}。${mood ? `${mood}。` : ''}最低的那个音（${noteNames([ns[0]])}）就是这个键平时弹出来的音，也是贝斯该弹的根音。`;
    }
  };
  refresh();
  const el = h('div', { class: 'widget' },
    h('h4', {}, title),
    h('div', { class: 'row', style: { marginBottom: '14px' } }, h('span', { class: 'small muted' }, `${KEY_NAMES[key]} ${SCALES[scale].zh}`), h('span', { class: 'spacer' }), sizeSeg),
    synthKeyRows(keyButtons),
    keyboard.el,
    info,
  );
  return { el, destroy() {} };
}

/**
 * 和弦进行：鼓 + 贝斯（弹根音）+ 和弦，循环播放，走到哪个和弦哪个亮。
 * progressions: [{ label, keys: [1, 6, 3, 7], say? }]；每个和弦占 stepsPer 步（8 = 两拍）。
 */
function chordprog({ scale = 0, key = 0, bpm: tempo = 96, stepsPer = 8, voice = 'keys', progressions = [{ label: '1 → 6 → 3 → 7', keys: [1, 6, 3, 7] }], drums = { KICK: 'x---x---x---x---', SNARE: '----x-------x---' }, title = '和弦进行：换一个顺序，就是另一种心情' }) {
  const state = { index: 0, bass: true, chords: true };
  const player = new LoopPlayer({ bpm: tempo });
  const strip = h('div', { class: 'row', style: { gap: '8px', margin: '14px 0 4px' } });
  const say = h('div', { class: 'small', style: { marginTop: '10px', color: 'var(--text-2)', lineHeight: '1.7' } });
  let cells = [];
  const apply = () => {
    const prog = progressions[state.index];
    const notes = [];
    prog.keys.forEach((k, i) => {
      const ns = chordNotes(k, { scale, key });
      // 贝斯：每拍弹一下这个和弦的根音，放低两个八度
      if (state.bass) for (let s = 0; s < stepsPer; s += 4) notes.push([i * stepsPer + s, ns[0] - 24, 3, 'bass', 0.85]);
      if (state.chords) notes.push(...chordAt(i * stepsPer, k, stepsPer, { scale, key, voice }));
    });
    player.steps = prog.keys.length * stepsPer;
    player.set(drums, notes, 'bass');
    cells = prog.keys.map((k) => {
      const ns = chordNotes(k, { scale, key });
      const mood = chordMood(ns);
      return h('div', { class: 'lit-cell' },
        h('div', { style: { fontWeight: '750', fontSize: '17px' } }, chordName(ns)),
        h('div', { class: 'small muted' }, `键 ${k}${MOOD[mood][0] ? ` · ${MOOD[mood][0]}` : ''}`));
    });
    strip.replaceChildren(...cells);
    say.textContent = prog.say || '';
    presets.replaceChildren(...progressions.map((p, i) => h('button', { class: ['btn', 'sm', i === state.index && 'primary'], type: 'button', onclick: () => { state.index = i; apply(); } }, p.label)));
  };
  player.onStep((s) => cells.forEach((c, i) => {
    const on = s >= 0 && Math.floor(s / stepsPer) === i;
    c.classList.toggle('on', on);
  }));
  const presets = h('div', { class: 'row', style: { gap: '8px' } });
  const toggle = (label, field) => {
    const box = h('input', { type: 'checkbox', checked: state[field] });
    box.addEventListener('change', () => {
      state[field] = box.checked;
      apply();
    });
    return h('label', { class: 'small', style: { display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' } }, box, label);
  };
  apply();
  const el = h('div', { class: 'widget' },
    h('h4', {}, title),
    h('div', { class: 'row' }, playButton(player), toggle('贝斯', 'bass'), toggle('和弦', 'chords'), h('span', { class: 'spacer' }), progressions.length > 1 ? presets : null),
    strip,
    say,
  );
  return { el, destroy: () => player.stop() };
}


/**
 * 一首歌的 SEQTRAK 版分轨，课里用的小版本：整首放、一层层加上去、只听某一层（曲目的课“先听一遍”）。
 * spec: { widget: 'song', song: 歌的 id }。整页的分轨台（独奏 / 静音每一条）在 views/song-parts.js。
 */
function song(spec) {
  const data = songParts(spec.song);
  if (!data) return { el: h('div', { class: 'widget muted' }, '（这首歌还没有分轨）'), destroy() {} };
  const player = new SongPlayer(data);
  const order = layerOrder(data);
  const laps = Math.max(1, Math.round(4 / data.bars)); // 一层层加：每层约 4 小节
  let mode = null; // 'all' 整首 / 'build' 一层层加 / 某一层的名字；null = 停着
  const btn = (label, m) => {
    const el = h('button', { class: 'btn', type: 'button', 'aria-pressed': 'false', dataset: { sfx: 'none' } }, label);
    el.addEventListener('click', () => toggle(m));
    return { m, el };
  };
  const main = [btn('▶ 整首', 'all'), btn('一层层加上去', 'build')];
  const solo = order.map((l) => btn(`只听${LAYERS[l].label}`, l));
  const now = h('span', { class: 'muted small' });
  const refresh = () => {
    for (const b of [...main, ...solo]) {
      const on = player.playing && mode === b.m;
      b.el.classList.toggle('primary', on);
      b.el.setAttribute('aria-pressed', String(on));
    }
    main[0].el.textContent = player.playing && mode === 'all' ? '■ 停' : '▶ 整首';
    const layers = order.filter((l) => data.parts.some((p, i) => p.layer === l && player.audible(i)));
    now.textContent = player.playing ? `现在响的：${layers.map((l) => LAYERS[l].label).join(' + ')}` : `${data.bpm} BPM · ${data.bars} 小节一圈`;
  };
  const toggle = (m) => {
    if (player.playing && mode === m) {
      player.stop();
      mode = null;
      refresh();
      return;
    }
    mode = m;
    if (m === 'build') {
      player.startBuild(laps, () => (mode = 'all')).then(refresh);
    } else {
      player.onLap = null;
      player.solo = null;
      player.muted.clear();
      player.only = m === 'all' ? null : partsIn(data, [m]);
      if (!player.playing) player.start().then(refresh);
    }
    refresh();
  };
  let seen = 0;
  player.onStep((s, lap) => {
    if (s < 0 || lap !== seen) {
      seen = lap;
      refresh();
    }
  });
  refresh();
  const el = h('div', { class: 'widget song-widget' },
    h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '8px' } }, main.map((b) => b.el), solo.map((b) => b.el)),
    h('div', { style: { marginTop: '8px' } }, now));
  return { el, destroy: () => player.stop() };
}

const WIDGETS = { bpm, count, grid, ab, swing, piano, synthkeys, chordstack, chordkeys, chordprog, calibrate: calibrateWidget, sim: simWidget, ledlegend: ledLegend, panelexplore: panelExplore, song, ...SOUND_DESIGN_WIDGETS, ...CHAPTER_WIDGETS, ...ARRANGEMENT_WIDGETS };

export function createWidget(spec) {
  const make = WIDGETS[spec.widget];
  if (!make) return { el: h('div', { class: 'widget muted' }, `（未知的小部件：${spec.widget}）`), destroy() {} };
  return make(spec);
}
