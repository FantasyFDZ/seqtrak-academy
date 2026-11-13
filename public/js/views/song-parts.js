// 一首歌的 SEQTRAK 版分轨（#/songs/<id>）：整首叠起来听、一轨一轨地听（独奏 / 静音），看每一轨在机器上怎么放。
// 数据在 content/song-parts.js，放音在 song-player.js。以后“一轨一轨照着搭”的课从这一页进（流程草案在 docs/design-direction.md 的“曲目的分轨”）。
// 版式：不整页滚动。上面一行是歌名；左边是放音的按钮和一条条分轨（分轨多了自己滚），右边是“机器上先这样设”“和原曲哪里不一样”。
import { h } from '../util.js';
import { SONGS } from '../content/songs.js';
import { songParts, LAYERS } from '../content/song-parts.js';
import { SongPlayer, partLength, partPitches } from '../song-player.js';
import { SCALES, KEY_NAMES } from '../scales.js';
import { TRACK } from '../tracks.js';
import { ctx } from '../context.js';
import { store } from '../store.js';
import { songLessonFor } from '../content/song-lessons.js';
import { arrangementFor } from '../content/song-arrangements.js';

const MODE = { mono: '单音', poly: '复音', chord: '和弦（CHORD）' };
const BUILD_BARS = 4; // “一层层加上去”：每一层放大约几小节再加下一层（按整圈算，至少一圈）
const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
const pretty = (name) => name.replace('#', '♯');
const noteName = (midi) => pretty(KEY_NAMES[((midi % 12) + 12) % 12]);
const catWord = (cat) => `${cat}${/^[A-Z]/.test(cat) ? ' ' : ''}类`;
// 往混响、延迟里送多少，说成多 / 一些 / 一点（机器上旋钮的具体读数和这里的 0–1 对不上，只给个程度）
const amount = (v) => (v >= 0.6 ? '多' : v >= 0.3 ? '一些' : '一点');
const sendWords = (send) => {
  const parts = [send?.reverb > 0 && `混响送${amount(send.reverb)}`, send?.delay > 0 && `延迟送${amount(send.delay)}`].filter(Boolean);
  // 机器上最方便的是混音台模式（按住 [ALL] + [VOL+]）：旋钮 3 送混响、旋钮 4 送延迟，课里就是这么教的（Sound Design 第 3 页也能调，但那是 advanced 的页）
  return parts.length ? `${parts.join('、')}（在混音台里调：旋钮 3 送混响、旋钮 4 送延迟）。` : '';
};

const ICON_PLAY = 'M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5Z';
const ICON_STOP = 'M7 6h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z';
const icon = (d) => h('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, h('path', { d }));

/** 机器上 KEY 那一列灯怎么亮：自下而上 7 个灯是 C D E F G A B，升半音是相邻两个灯一起亮 */
function keyLights(key) {
  const name = KEY_NAMES[key];
  if (!name.includes('#')) return `${name} 那个灯亮`;
  return `${KEY_NAMES[key - 1]}、${KEY_NAMES[(key + 1) % 12]} 两个灯一起亮`;
}

/**
 * 一条分轨的格子：每一步一格（每拍第一格深一点，每小节前面一道线），有音的地方一块色块；超过四小节的分两排。
 * 合成器轨的色块上写第几个 Synth key；一条轨道里有高低两个八度时，低的那些画在下面一行。比整首短、自己重复的那一段淡一些。
 * 返回 { grid, cells, starts }：cells[第几步] 是那一格，starts[第几步] 是从这一步开始的色块（放音时点亮用）。
 */
export function laneGrid(spec, part) {
  const n = spec.bars * 16;
  const own = partLength(spec, part);
  const shifts = [...new Set((part.notes || []).map((x) => x[3] || 0))].sort((a, b) => b - a);
  const cells = [];
  const starts = Array.from({ length: n }, () => []);
  // 一排最多四小节（64 格）：八小节的歌分成两排，不然一格只有三四个像素、色块上的数字挤成一团
  const ROW = 64;
  const rows = [];
  for (let from = 0; from < n; from += ROW) {
    const w = Math.min(ROW, n - from);
    const row = h('div', { class: ['sp-grid', part.steps ? 'drum' : 'synth', w > 32 && 'dense'], style: { '--n': String(w), '--lanes': String(Math.max(1, shifts.length)) } });
    for (let s = from; s < from + w; s++) {
      const c = h('i', { class: [s % 4 === 0 && 'beat', s % 16 === 0 && s > from && 'bar'], style: { gridColumn: String(s - from + 1) } });
      cells.push(c);
      row.append(c);
    }
    rows.push({ from, w, el: row });
  }
  const block = (s, len, lane, text, cls) => {
    const r = rows[Math.floor(s / ROW)];
    const b = h('b', { class: [s >= own && 'rep', cls], style: { gridColumn: `${s - r.from + 1} / span ${Math.min(len, r.from + r.w - s)}`, gridRow: String(lane) } }, text);
    starts[s].push(b);
    r.el.append(b);
  };
  if (part.steps) {
    const p = part.steps.replace(/[s|]/g, '');
    for (let s = 0; s < n; s++) {
      const ch = p[s % own];
      if (ch === 'x' || ch === 'X') block(s, 1, 1, null, ch === 'X' && 'acc');
    }
  } else {
    for (const [step, key, len = 1, shift = 0] of part.notes) {
      for (let s = step; s < n; s += own) block(s, len, shifts.indexOf(shift) + 1, String(key));
    }
  }
  const grid = rows.length > 1 ? h('div', { class: 'sp-grids' }, rows.map((r) => r.el)) : rows[0].el;
  return { grid, cells, starts };
}

/** 色块上的数字各是什么音：单音轨列出用到的几个键，CHORD 列出每个键弹出的那几个音 */
export function keyLegend(spec, part) {
  const used = [...new Set(part.notes.map((x) => x[1]))].sort((a, b) => a - b);
  if (part.mode === 'chord') {
    return `数字是第几个键；CHORD 弹法下一个键就是一个和弦：${used.map((k) => `键 ${k} = ${partPitches(spec, part, [0, k]).map(noteName).join(' ')}`).join('，')}。`;
  }
  const low = part.notes.some((x) => (x[3] || 0) < 0);
  const high = part.notes.some((x) => (x[3] || 0) > 0);
  const lanes = high && low ? '；上面那一行再高一个八度，下面那一行再低一个八度' : high ? '；上面那一行再高一个八度' : low ? '；下面那一行再低一个八度' : '';
  return `数字是第几个 Synth key：${used.map((k) => `${k} = ${noteName(partPitches(spec, part, [0, k])[0])}`).join('、')}${lanes}。`;
}

export function partLabel(part) {
  const t = TRACK[part.track];
  return { label: t?.label || part.track, name: part.steps ? t?.name : LAYERS[part.layer]?.label };
}

/** 给啾啾看的：这一版的全部内容，加上现在独奏 / 静音的情况 */
function describeSpec(song, spec, player) {
  const scale = SCALES[spec.scale];
  const line = (part, i) => {
    const { label, name } = partLabel(part);
    const notes = part.steps
      ? `节奏串 ${part.steps}（每小节 16 格，x 是一下）`
      : `OCTAVE ${signed(part.octave || 0)}，${MODE[part.mode]}；${part.notes.map(([s, k, len = 1, sh = 0]) => `第 ${s + 1} 步 键 ${k}${sh < 0 ? '（再低一个八度）' : sh > 0 ? '（再高一个八度）' : ''} ${len} 步长`).join('，')}`;
    const state = player.solo === i ? '（正在独奏）' : player.muted.has(i) ? '（静音了）' : '';
    const send = part.send ? `；往混响送 ${part.send.reverb || 0}、往延迟送 ${part.send.delay || 0}（0–1）` : '';
    return `- ${label}（${name}）${state}：${part.role} 机器上：音色挑 ${catWord(part.sound.cat)}，${part.sound.hint}${send}；${notes}。`;
  };
  return [
    `这是《${song.title}》（${song.artist}）的 SEQTRAK 版分轨，是凭对原曲的了解写的简化版，学生在听像不像。`,
    `机器设置：${spec.bpm} BPM，Swing ${spec.swing}，SCALE ${scale.name}（第 ${spec.scale + 1} 个），KEY ${KEY_NAMES[spec.key]}；${spec.bars} 小节一圈。原曲：${spec.origKey}。`,
    `一共 ${spec.parts.length} 条轨道（步数从 1 数起，16 步一小节）：`,
    ...spec.parts.map(line),
    `和原曲不一样的地方：\n${spec.differs.map((d) => `- ${d}`).join('\n')}`,
  ].join('\n');
}

/** 右边那一栏最下面：这首歌有“照着搭”的课就放一个入口（学过的写上星星），没有就说一句还没做 */
function nextCard(song) {
  const lesson = songLessonFor(song.id);
  if (!lesson) {
    return h('div', { class: 'card sp-card sp-next' },
      h('h3', {}, '照着搭的课还没做'),
      h('p', {}, '先听：点「独奏」单听某一条，或者「一层层加上去」。这首歌的课做好之后，这里会有入口。'));
  }
  const saved = store.lesson(lesson.id);
  return h('div', { class: 'card sp-card sp-next' },
    h('h3', {}, '在机器上搭出来'),
    h('p', {}, `一节课：先把机器调好，再照着这几条分轨一层层搭——鼓 → 贝斯 → 和弦 → 旋律，最后加上混响。在模拟机或真机上做，做对了自动打勾，大约 ${lesson.minutes} 分钟。`),
    saved.done && h('p', { class: 'sp-done' }, h('span', { class: 'stars' }, [0, 1, 2].map((i) => h('span', { class: i < (saved.stars || 0) ? 'on' : '' }, '★'))), '搭过一遍了'),
    h('a', { class: 'btn primary', href: `#/lesson/${lesson.id}` }, saved.done ? '再搭一遍 →' : saved.stepIndex ? '接着搭 →' : '开始照着搭 →'));
}

/** 有段落的完整版（content/song-arrangements.js）就放一个入口 */
function fullCard(song) {
  const arr = arrangementFor(song.id);
  if (!arr) return null;
  return h('div', { class: 'card sp-card sp-next' },
    h('h3', {}, '完整版：有段落的一整首'),
    h('p', {}, `这一页是一段循环；完整版把它排成 ${arr.scenes.length} 段（${[...new Set(arr.scenes.map((s) => s.name))].join('、')}），每段换乐句、加减乐器，机器上用 Song 模式从头演一遍。`),
    h('a', { class: 'btn', href: `#/songs/${song.id}/full` }, '听完整版 →'));
}

export function songPartsView(view, id) {
  const song = SONGS.find((s) => s.id === id);
  const spec = songParts(id);
  if (!song || !spec) {
    location.hash = '#/songs';
    return null;
  }
  const player = new SongPlayer(spec);
  const order = [...new Set(spec.parts.map((p) => p.layer))].sort((a, b) => LAYERS[a].order - LAYERS[b].order);
  const BUILD_LAPS = Math.max(1, Math.round(BUILD_BARS / spec.bars)); // 两小节的歌每层两圈，四小节的歌每层一圈
  let building = false; // 正在“一层层加上去”

  // ── 一条条分轨 ──
  const rows = spec.parts.map((part, i) => {
    const { label, name } = partLabel(part);
    const { grid, cells, starts } = laneGrid(spec, part);
    const solo = h('button', { class: 'btn sm sp-solo', type: 'button', 'aria-pressed': 'false', 'aria-label': `独奏 ${label}`, onclick: () => toggleSolo(i) }, '独奏');
    const mute = h('button', { class: 'btn sm sp-mute', type: 'button', 'aria-pressed': 'false', 'aria-label': `静音 ${label}`, onclick: () => toggleMute(i) }, '静音');
    const own = partLength(spec, part);
    const how = [
      `音色挑 ${catWord(part.sound.cat)}：${part.sound.hint}。`,
      sendWords(part.send),
      part.steps ? (own < spec.bars * 16 ? `${own / 16} 小节，放的时候自己重复（淡的那段）。` : '') : keyLegend(spec, part),
    ].join('');
    const el = h('div', { class: 'sp-row', style: { '--c': TRACK[part.track]?.color || 'var(--accent)' } },
      h('div', { class: 'sp-name' },
        h('div', {}, h('b', {}, label), h('span', {}, name)),
        h('small', {}, part.steps ? '鼓轨 · 16 步' : `OCTAVE ${signed(part.octave || 0)} · ${MODE[part.mode]}`),
        h('div', { class: 'sp-btns' }, solo, mute)),
      h('div', { class: 'sp-lane' },
        grid,
        h('p', { class: 'sp-role' }, part.role),
        h('p', { class: 'sp-how' }, how)),
    );
    return { el, cells, starts, solo, mute };
  });

  // ── 上面那一排：放 / 停、一层层加、全部恢复、现在响的是哪几层 ──
  const playBtn = h('button', { class: 'btn primary sp-play', type: 'button', 'aria-pressed': 'false', dataset: { sfx: 'none' }, onclick: () => (player.playing && !building ? stop() : playAll()) });
  const buildBtn = h('button', { class: 'btn', type: 'button', 'aria-pressed': 'false', dataset: { sfx: 'none' }, onclick: () => (building ? stop() : startBuild()) }, '一层层加上去');
  const resetBtn = h('button', { class: 'btn ghost', type: 'button', onclick: () => resetMix() }, '取消独奏和静音');
  // 现在响的是哪几层：独奏、静音、一层层加的时候跟着变（不另写一行字，免得这一排忽高忽低）
  const chips = order.map((layer) => ({ layer, el: h('span', { class: 'sp-chip' }, LAYERS[layer].label) }));
  buildBtn.title = `先只放鼓，每 ${BUILD_LAPS * spec.bars} 小节加一层：${order.map((l) => LAYERS[l].label).join(' → ')}`;

  const refresh = () => {
    rows.forEach((r, i) => {
      r.el.classList.toggle('quiet', !player.audible(i));
      r.solo.setAttribute('aria-pressed', String(player.solo === i));
      r.mute.setAttribute('aria-pressed', String(player.muted.has(i)));
    });
    for (const c of chips) c.el.classList.toggle('on', spec.parts.some((p, i) => p.layer === c.layer && player.audible(i)));
    const full = player.playing && !building;
    playBtn.replaceChildren(icon(full ? ICON_STOP : ICON_PLAY), full ? '停' : '放整首');
    playBtn.setAttribute('aria-pressed', String(full));
    buildBtn.setAttribute('aria-pressed', String(building));
    resetBtn.disabled = player.solo === null && !player.muted.size;
    ctx.set(`曲目 · 《${song.title}》的 SEQTRAK 版分轨`, describeSpec(song, spec, player));
  };

  // 播放头：每一行同一列亮着；刚开始响的色块闪一下
  let at = -1;
  let lapSeen = 0;
  player.onStep((s, lap) => {
    for (const r of rows) r.cells[at]?.classList.remove('now');
    at = s;
    if (s >= 0) {
      for (const r of rows) {
        r.cells[s].classList.add('now');
        // 刚响的色块闪一下：每次都把动效从头放一遍（样式里只在“丰富”动效档下动）
        for (const b of r.starts[s]) {
          b.classList.remove('hit');
          void b.offsetWidth;
          b.classList.add('hit');
        }
      }
    }
    if (lap !== lapSeen || s < 0) {
      lapSeen = lap;
      refresh();
    }
  });

  const playAll = () => {
    building = false;
    player.only = null;
    player.onLap = null;
    if (!player.playing) start();
    refresh();
  };
  const start = () => {
    lapSeen = 0;
    player.start().then(refresh);
    refresh();
  };
  const stop = () => {
    building = false;
    player.only = null;
    player.onLap = null;
    player.stop();
    refresh();
  };
  // 先只有鼓，每放两圈加一层（鼓 → 贝斯 → 和弦 → 旋律），加满了就一直整首放下去
  const startBuild = () => {
    building = true;
    lapSeen = 0;
    // 加满了：画面在听到这一圈时（下一次绕回来）跟上
    player.startBuild(BUILD_LAPS, () => (building = false)).then(refresh);
    refresh();
  };
  // 和机器一样：独奏同一时间只有一条，再按一次取消；独奏优先于静音。停着的时候按独奏就开始放
  const leaveBuild = () => {
    if (!building) return;
    building = false;
    player.only = null;
    player.onLap = null;
  };
  const toggleSolo = (i) => {
    leaveBuild();
    player.solo = player.solo === i ? null : i;
    if (!player.playing && player.solo !== null) start();
    refresh();
  };
  const toggleMute = (i) => {
    leaveBuild();
    if (player.muted.has(i)) player.muted.delete(i);
    else player.muted.add(i);
    refresh();
  };
  const resetMix = () => {
    player.solo = null;
    player.muted.clear();
    refresh();
  };

  // ── 右边：机器上先这样设、和原曲哪里不一样、接下来 ──
  const scale = SCALES[spec.scale];
  const setup = [
    ['速度', `${spec.bpm} BPM`, '右侧面的 [BPM +] / [BPM −]'],
    ['Swing', `${spec.swing}`, '按右侧面的 [SWING]，读数到这附近就行'],
    ['音阶', scale.name, `按 [SCALE]：第 ${spec.scale + 1} 个，右边那列灯从上往下数第 ${spec.scale + 1} 个${spec.scale === SCALES.length - 1 ? '（最下面那个）' : ''}`],
    ['调', pretty(KEY_NAMES[spec.key]), `按 [KEY]：${keyLights(spec.key)}`],
    spec.parts.some((p) => p.send) && ['空间', '混响 + 延迟', '全机共用一个混响、一个延迟，用默认的就行；每条轨道往里送多少，写在那条轨道下面'],
  ].filter(Boolean);
  const side = h('aside', { class: 'sp-side' },
    nextCard(song), // 照着搭的入口放在最上面：1024 × 768 下右边这一栏放不全，最要紧的先露出来
    fullCard(song),
    h('div', { class: 'card sp-card' },
      h('h3', {}, '机器上先这样设'),
      h('dl', { class: 'sp-setup' }, setup.map(([k, v, how]) => [h('dt', {}, k), h('dd', {}, h('b', {}, v), h('small', {}, how))])),
      h('p', { class: 'sp-note' }, `原曲：${spec.origKey}。`)),
    h('div', { class: 'card sp-card' },
      h('h3', {}, '和原曲哪里不一样'),
      h('ul', { class: 'sp-differs' }, spec.differs.map((d) => h('li', {}, d)))),
  );

  view.classList.add('fixed');
  view.append(h('div', { class: 'sp-page' },
    h('div', { class: 'play-head' },
      h('a', { class: 'back', href: '#/songs' }, '← 曲目'),
      h('h1', {}, song.title, h('span', { class: 'sp-sub' }, 'SEQTRAK 版分轨')),
      h('div', { class: 'meta' },
        h('span', { class: 'tag' }, `${spec.bpm} BPM`),
        h('span', { class: 'tag' }, `${pretty(KEY_NAMES[spec.key])} ${scale.name}`),
        h('span', { class: 'tag' }, `${spec.bars} 小节一圈`))),
    h('div', { class: 'sp-body' },
      h('div', { class: 'sp-main' },
        h('div', { class: 'sp-transport' }, playBtn, buildBtn, resetBtn, h('span', { class: 'sp-chips', 'aria-label': '现在响的是哪几层' }, chips.map((c) => c.el))),
        // 用户 2026-11-11 说一开始没注意到能单听某一轨：在这里明说一句
        h('p', { class: 'sp-summary' }, spec.summary, ' ', h('span', { class: 'sp-tip' }, '想单听哪一条，点它的「独奏」；想把哪一条拿掉，点「静音」。')),
        h('div', { class: 'sp-tracks' }, rows.map((r) => r.el))),
      side),
  ));
  refresh();
  return {
    destroy() {
      player.stop();
      view.classList.remove('fixed');
    },
  };
}
