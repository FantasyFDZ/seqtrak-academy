// 一首歌的“完整版”（#/songs/<id>/full）：有前奏、主歌、铺垫、Drop、尾声，一段段换乐句、加减乐器，最后在机器的 Song 模式里从头演一遍。
// 数据在 content/song-arrangements.js（每条轨道几段乐句、按顺序排的 Scene），放音是 song-player.js 的 ArrangementPlayer。
// 版式：不整页滚动。上面一排放音；中间是一条像音频软件那样的多轨时间线（2026-11-12 用户要的）：最上面时间尺标出段落（机器上的 Scene），
// 每条轨道一行、按时间铺开，每段乐句画成一个色块（里面是它的音），一根播放头同时扫过所有轨道、横向自动跟着走；
// 下面是选中那条轨道的几段乐句；右边是机器上怎么排、和原曲哪里不一样。
import { h } from '../util.js';
import { SONGS } from '../content/songs.js';
import { songParts } from '../content/song-parts.js';
import { arrangementFor, SECTION_KINDS } from '../content/song-arrangements.js';
import { ArrangementPlayer, patternOf, patternCount, partLength } from '../song-player.js';
import { SCALES, KEY_NAMES } from '../scales.js';
import { TRACK } from '../tracks.js';
import { ctx } from '../context.js';
import { laneGrid, keyLegend, partLabel } from './song-parts.js';
import { arrangementLessonsFor } from '../content/arrangement-lessons.js';
import { songLessonFor } from '../content/song-lessons.js';
import { store } from '../store.js';

const pretty = (name) => name.replace('#', '♯');
const ICON_PLAY = 'M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5Z';
const ICON_STOP = 'M7 6h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z';
const icon = (d) => h('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, h('path', { d }));
/** 滤波器这一段怎么动：打开 / 关上 / 压暗不动（从 = 到） */
const moveWord = ([a, b]) => (a === b ? { arrow: '·', short: '· 压暗', long: '压暗（转到一半就不动了）' } : b > a ? { arrow: '↗', short: '↗ 慢慢打开', long: '慢慢打开（声音由闷变亮）' } : { arrow: '↘', short: '↘ 慢慢关上', long: '慢慢关上（由亮变闷）' });
const mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

/** 一段乐句有几小节 */
const patBars = (spec, part) => Math.max(1, Math.round(partLength(spec, part) / 16));
/** 一个 Scene 有多长：不满一小节的（两次 Drop 前那 2 拍的停顿）说几拍 */
const lenWord = (sc) => (sc.steps % 16 ? `${sc.steps / 4} 拍` : `${sc.bars} 小节`);

/** 给啾啾看的：完整版的段落、每段每条轨道放第几段乐句，加上现在放到哪 */
function describe(song, spec, arr, player, at) {
  const tracks = player.tracks;
  const scenes = player.scenes.map((sc, i) => `- 第 ${i + 1} 个 Scene「${sc.name}」${lenWord(sc)}：${tracks.map((p) => (sc.play[p.track] ? `${TRACK[p.track].label} 乐句 ${sc.play[p.track]}` : null)).filter(Boolean).join('、') || '全静音'}。`);
  const pats = tracks.flatMap((p) => Array.from({ length: patternCount(spec, arr, p.track) }, (_, k) => {
    const part = patternOf(spec, arr, p.track, k + 1);
    return part && `- ${TRACK[p.track].label} 乐句 ${k + 1}（${patBars(spec, part)} 小节）：${part.role}`;
  })).filter(Boolean);
  const now = at >= 0 ? `正在放第 ${player.sceneAt(at) + 1} 个 Scene「${player.scenes[player.sceneAt(at)].name}」。` : '现在停着。';
  return [
    `这是《${song.title}》的 SEQTRAK 完整版：在分轨（一段循环）的基础上排成有段落的一整首，机器上用 Song 模式按顺序放 ${player.scenes.length} 个 Scene。${now}`,
    `机器设置：${spec.bpm} BPM，SCALE ${SCALES[spec.scale].name}，KEY ${KEY_NAMES[spec.key]}。`,
    '段落（Scene）：', ...scenes,
    '每条轨道的乐句：', ...pats,
    ...player.scenes.filter((sc) => sc.moves).map((sc) => `- 现场动作：第 ${sc.i + 1} 段「${sc.name}」里 ${Object.entries(sc.moves).map(([t, [a, b]]) => (a === b ? `${TRACK[t].label} 的滤波器压暗在 ${a} Hz 不动` : `${TRACK[t].label} 的滤波器从 ${a} Hz ${b > a ? '慢慢打开' : '慢慢关上'}到 ${b} Hz`)).join('、')}。`),
    ...tracks.filter((p) => p.duck).map((p) => `- ${TRACK[p.track].label} 开着 DUCKER（单轨效果），底鼓每响一下压下去约 ${Math.round(p.duck * 100)}%，听着跟着底鼓“喘气”。`),
    `和原曲不一样的地方：\n${arr.differs.map((d) => `- ${d}`).join('\n')}`,
  ].join('\n');
}

/** 右边那一栏最下面：在机器上排出来的两节课（content/arrangement-lessons.js），学过的写上星星；前提是先上分轨那节课 */
function lessonCard(song) {
  const [one, two] = arrangementLessonsFor(song.id);
  if (!one) return null;
  const parts = songLessonFor(song.id);
  const row = (l, n, what) => {
    const saved = store.lesson(l.id);
    return h('div', { class: 'sf-lesson' },
      h('p', {}, h('b', {}, `${n} ${what}`), h('small', {}, ` · 大约 ${l.minutes} 分钟`)),
      saved.done && h('p', { class: 'sp-done' }, h('span', { class: 'stars' }, [0, 1, 2].map((i) => h('span', { class: i < (saved.stars || 0) ? 'on' : '' }, '★'))), '做过一遍了'),
      h('a', { class: n === '①' ? 'btn primary' : 'btn', href: `#/lesson/${l.id}` }, saved.done ? '再做一遍 →' : saved.stepIndex ? '接着做 →' : '开始 →'));
  };
  const partsDone = parts && store.lesson(parts.id).done;
  return h('div', { class: 'card sp-card sp-next' },
    h('h3', {}, '在机器上排出来'),
    h('p', {}, `两节课，接着编曲那一章（第 6 章）：先把每段要用的乐句做出来，再在 Song 模式里排成 ${arrangementFor(song.id).scenes.length} 个 scene、从头演一遍。在模拟机或真机上做，做对了自动打勾。`),
    parts && !partsDone && h('p', { class: 'sp-note' }, '真机上要先有这首歌的分轨（每条轨道的第 1 段）：先上分轨页的', h('a', { href: `#/lesson/${parts.id}` }, '「一轨一轨搭出来」'), '。模拟机上不用，课一开始会替你摆好。'),
    row(one, '①', '备料：把每段乐句做出来'),
    two && row(two, '②', '排成一首、从头演一遍'));
}

export function songFullView(view, id) {
  const song = SONGS.find((s) => s.id === id);
  const spec = songParts(id);
  const arr = arrangementFor(id);
  if (!song || !spec || !arr) {
    location.hash = spec ? `#/songs/${id}` : '#/songs';
    return null;
  }
  const player = new ArrangementPlayer(spec, arr);
  const { tracks, scenes } = player;
  const totalSec = (player.total * 60) / spec.bpm / 4;
  let picked = 0; // 选中的 Scene（“循环这一段”循环它）
  let focus = tracks.findIndex((p) => p.track === (arr.focus || tracks[tracks.length - 1].track)); // 下面看哪条轨道的乐句
  let at = -1; // 正在放的那一步（从整首开头数）

  // ── 多轨时间线 ──
  const PX = 3; // 一步几像素：一小节 48 像素
  const LANE = 34; // 一条轨道多高
  const HEAD = 140; // 左边轨道名那一列（横着滚的时候钉住）
  const W = player.total * PX;
  const stepSec = 60 / spec.bpm / 4;
  // 每条轨道整首用到的音从多低到多高（色块里的音按音高画上下）
  const range = tracks.map((p, ti) => {
    let lo = 999;
    let hi = -1;
    for (const ev of player.events) for (const e of (ev[ti] || []).flat()) for (const m of e.midis || []) { lo = Math.min(lo, m); hi = Math.max(hi, m); }
    return hi < 0 ? null : [lo, Math.max(hi, lo + 7)];
  });
  // 时间尺：段落按真实长短铺开（点一下从那里开始放），下面每 4 小节一个小节号
  const secs = scenes.map((sc, i) => {
    const kind = SECTION_KINDS[sc.kind] || SECTION_KINDS.verse;
    const bar = h('span', { class: 'sf-prog' });
    const el = h('button', { class: 'daw-sec', type: 'button', style: { left: `${sc.start * PX}px`, width: `${sc.steps * PX}px`, '--k': kind.color }, title: `${sc.name}：${lenWord(sc)}。点一下从这里开始放`, onclick: () => playFrom(i) },
      h('b', {}, sc.name), h('small', {}, lenWord(sc)), bar);
    return { el, bar };
  });
  const barNos = Array.from({ length: Math.ceil(player.total / 64) }, (_, k) => h('i', { class: 'daw-barno', style: { left: `${k * 64 * PX}px` } }, String(k * 4 + 1)));
  const ruler = h('div', { class: 'daw-ruler', style: { width: `${W}px` } }, secs.map((x) => x.el), barNos);
  // 一条轨道在一个段落里的色块：鼓是一下下的竖线（重音长一点），合成器按音高画成小横条（和弦是几条叠着）
  const clipFor = (si, ti) => {
    const sc = scenes[si];
    const p = tracks[ti];
    const no = sc.play[p.track];
    const byStep = player.events[si][ti];
    if (!no || !byStep) return null;
    const w = sc.steps * PX;
    const ih = LANE - 6;
    const r = range[ti];
    const marks = [];
    byStep.forEach((evs, st) => {
      for (const e of evs) {
        if (e.drum) {
          const loud = e.vel >= 0.95;
          marks.push(h('rect', { x: st * PX + 0.5, y: loud ? 7 : 10, width: Math.max(1.5, PX - 1), height: loud ? ih - 9 : ih - 15, rx: 0.8 }));
        } else {
          for (const m of e.midis) {
            const y = 6 + (1 - (m - r[0]) / (r[1] - r[0])) * (ih - 10);
            marks.push(h('rect', { x: st * PX, y: y.toFixed(1), width: Math.max(2, e.len * PX - 1), height: 3, rx: 1 }));
          }
        }
      }
    });
    const mv = sc.moves?.[p.track];
    return h('button', { class: ['daw-clip', mv && 'move'], type: 'button', style: { left: `${sc.start * PX}px`, width: `${w}px` }, title: `${sc.name} · ${TRACK[p.track].label} 乐句 ${no}${mv ? `，滤波器${moveWord(mv).long}` : ''}。点一下，下面看这段乐句`, onclick: () => pickTrack(ti) },
      h('svg', { class: 'daw-notes', width: w, height: ih, viewBox: `0 0 ${w} ${ih}`, 'aria-hidden': 'true' }, marks),
      h('span', { class: 'daw-tag' }, `${no}${mv ? moveWord(mv).arrow : ''}`));
  };
  const rows = tracks.map((p, ti) => {
    const { label, name } = partLabel(p);
    const color = TRACK[p.track]?.color || 'var(--accent)';
    const solo = h('button', { class: 'btn sm sp-solo', type: 'button', 'aria-pressed': 'false', 'aria-label': `独奏 ${label}`, onclick: () => toggleSolo(ti) }, '独奏');
    const mute = h('button', { class: 'btn sm sp-mute', type: 'button', 'aria-pressed': 'false', 'aria-label': `静音 ${label}`, onclick: () => toggleMute(ti) }, '静音');
    const head = h('div', { class: 'daw-head sf-name', style: { '--c': color } },
      h('button', { class: 'sf-label', type: 'button', title: `${label}（${name}）：点一下，下面看它的几段乐句`, onclick: () => pickTrack(ti) }, h('b', {}, label)),
      h('span', { class: 'sf-btns' }, solo, mute));
    const clips = scenes.map((_, si) => clipFor(si, ti));
    const lane = h('div', { class: 'daw-lane', style: { width: `${W}px`, '--c': color } }, clips);
    return { el: h('div', { class: 'daw-row' }, head, lane), head, lane, clips, solo, mute, nameEl: head };
  });
  const playhead = h('div', { class: 'daw-playhead', style: { left: `${HEAD}px`, '--step': `${stepSec.toFixed(3)}s` } }, h('i'));
  const dawInner = h('div', { class: 'daw-inner', style: { width: `${HEAD + W}px`, '--head': `${HEAD}px`, '--bar': `${PX * 16}px`, '--beatw': `${PX * 4}px`, '--lane': `${LANE}px` } },
    h('div', { class: 'daw-row daw-rulerrow' }, h('div', { class: 'daw-head daw-corner' }, '段落 / 小节'), ruler),
    rows.map((r) => r.el),
    playhead);
  const dawScroll = h('div', { class: 'daw-scroll' }, dawInner);
  const matrix = h('div', { class: 'sf-matrix daw', style: { '--beat': `${(60 / spec.bpm).toFixed(3)}s` } }, dawScroll);
  // 播放头：每一步挪过去（动画时长就是一步，看着是连续滑过去的）；往回跳、换段的时候不要滑；快走出看得见的地方时，横着跟过去
  let follow = true;
  let shown = -1;
  const movePlayhead = (g) => {
    playhead.classList.toggle('on', g >= 0);
    if (g < 0) return;
    if (g !== shown + 1) {
      playhead.classList.add('jump');
      void playhead.offsetWidth;
    }
    playhead.style.transform = `translateX(${g * PX}px)`;
    if (g !== shown + 1) requestAnimationFrame(() => playhead.classList.remove('jump'));
    shown = g;
    if (!follow) return;
    const x = HEAD + g * PX;
    const sl = dawScroll.scrollLeft;
    const vw = dawScroll.clientWidth;
    if (x < sl + HEAD + 12 || x > sl + vw - 64) dawScroll.scrollTo({ left: Math.max(0, x - HEAD - (vw - HEAD) * 0.2), behavior: frozen ? 'auto' : 'smooth' });
  };

  // ── 选中的那条轨道：它的几段乐句 ──
  const patBox = h('div', { class: 'sf-pats' });
  let patView = []; // [{ no, el, cells, len }]
  const renderPats = () => {
    const p = tracks[focus];
    const n = patternCount(spec, arr, p.track);
    const { label } = partLabel(p);
    patView = [];
    const items = [];
    for (let no = 1; no <= n; no++) {
      const part = patternOf(spec, arr, p.track, no);
      if (!part) continue;
      const bars = patBars(spec, part);
      const used = scenes.filter((sc) => sc.play[p.track] === no).map((sc) => sc.name);
      const { grid, cells: gc, starts } = laneGrid({ ...spec, bars }, part);
      const el = h('div', { class: 'sf-pat', style: { '--c': TRACK[p.track]?.color || 'var(--accent)' } },
        h('div', { class: 'sf-pat-head' }, h('b', {}, `乐句 ${no}`), h('span', {}, `${bars} 小节`), h('i', { class: 'sf-live' }, '▶ 正在放'), h('small', {}, used.length ? `用在：${[...new Set(used)].join('、')}` : '没用上')),
        grid,
        h('p', { class: 'sp-role' }, part.role),
        part.notes && h('p', { class: 'sp-how' }, keyLegend(spec, part)));
      items.push(el);
      patView.push({ no, el, cells: gc, starts, len: bars * 16 });
    }
    patBox.replaceChildren(h('h3', {}, `${label} 的 ${patView.length} 段乐句`, h('small', {}, `点时间线上 ${label} 那一行的色块也会到这里；放的时候自动滚到正在放的那段`)), ...items);
    liveCard = null;
    lightPats();
  };
  // 正在放的那段乐句亮着，播放头跟着走
  let litCell = null;
  let liveCard = null; // 现在滚到眼前的那段乐句
  let frozen = false; // 开发用：地址带 ?playhead=第几步 时，画面摆在播放到那一步的样子（不出声），截图看效果用
  const flash = (b) => {
    b.classList.remove('hit');
    void b.offsetWidth; // 让闪一下的动效从头再放一遍
    b.classList.add('hit');
  };
  const showCard = (el) => {
    if (!el || el === liveCard) return;
    liveCard = el;
    // 段落表钉在上面，乐句卡片要滚到它下面露出来
    const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    const under = matrix.offsetHeight + 12;
    if (top < under || top + el.offsetHeight > scroller.clientHeight) scroller.scrollBy({ top: top - under, behavior: frozen ? 'auto' : 'smooth' });
  };
  const lightPats = () => {
    litCell?.classList.remove('now');
    litCell = null;
    const si = at >= 0 ? player.sceneAt(at) : -1;
    const no = si >= 0 ? scenes[si].play[tracks[focus].track] : null;
    for (const v of patView) {
      v.el.classList.toggle('on', v.no === no);
      if (v.no === no) {
        const local = (at - scenes[si].start) % v.len;
        litCell = v.cells[local];
        litCell?.classList.add('now');
        if (player.audible(focus)) for (const b of v.starts[local] || []) flash(b);
        if (player.playing || frozen) showCard(v.el);
      }
    }
    if (at < 0) liveCard = null;
  };

  // ── 上面那一排 ──
  const playBtn = h('button', { class: 'btn primary sp-play', type: 'button', dataset: { sfx: 'none' }, onclick: () => (player.playing ? stop() : playFrom(player.loop ?? 0)) });
  const loopBtn = h('button', { class: 'btn', type: 'button', 'aria-pressed': 'false', dataset: { sfx: 'none' }, onclick: () => toggleLoop() });
  const resetBtn = h('button', { class: 'btn ghost', type: 'button', onclick: () => { player.solo = null; player.muted.clear(); refresh(); } }, '取消独奏和静音');
  const where = h('span', { class: 'sf-where' });

  const refresh = () => {
    const si = at >= 0 ? player.sceneAt(at) : -1;
    secs.forEach((x, i) => {
      x.el.classList.toggle('now', i === si);
      x.el.classList.toggle('picked', i === picked);
      if (i !== si) x.bar.style.width = '0';
    });
    rows.forEach((r, ti) => {
      r.clips.forEach((c, i) => c?.classList.toggle('now', i === si));
      r.lane.classList.toggle('quiet', !player.audible(ti));
      r.lane.classList.toggle('focus', ti === focus);
      r.nameEl.classList.toggle('focus', ti === focus);
      r.nameEl.classList.toggle('quiet', !player.audible(ti));
      r.solo.setAttribute('aria-pressed', String(player.solo === ti));
      r.mute.setAttribute('aria-pressed', String(player.muted.has(ti)));
    });
    playBtn.replaceChildren(icon(player.playing ? ICON_STOP : ICON_PLAY), player.playing ? '停' : player.loop !== null ? '放这一段' : '从头放');
    loopBtn.textContent = `循环「${scenes[picked].name}」`;
    loopBtn.setAttribute('aria-pressed', String(player.loop !== null));
    resetBtn.disabled = player.solo === null && !player.muted.size;
    where.textContent = si >= 0
      ? `${player.loop !== null ? '循环' : '正在放'}：第 ${si + 1} 段「${scenes[si].name}」${scenes[si].steps >= 16 ? ` · 第 ${Math.floor((at - scenes[si].start) / 16) + 1} / ${scenes[si].bars} 小节` : ''}`
      : `${scenes.length} 段，从头放完约 ${mmss(totalSec)}`;
    ctx.set(`曲目 · 《${song.title}》的 SEQTRAK 完整版`, describe(song, spec, arr, player, at));
  };

  let lastScene = -2;
  let lastBar = -1;
  player.onStep((g) => {
    at = g;
    const si = g >= 0 ? player.sceneAt(g) : -1;
    if (si >= 0) secs[si].bar.style.width = `${(((g - scenes[si].start) + 1) / scenes[si].steps) * 100}%`;
    movePlayhead(g);
    lightPats();
    const bar = si >= 0 ? Math.floor((g - scenes[si].start) / 16) : -1;
    if (si !== lastScene || bar !== lastBar) {
      lastScene = si;
      lastBar = bar;
      if (si >= 0 && player.loop === null) picked = si;
      refresh();
    }
  });
  player.onEnd = () => refresh();
  // 跟着播放头走：手动往别处滚了也没关系，再点一下“跟着走”就回来
  const followBtn = h('button', { class: 'btn ghost', type: 'button', 'aria-pressed': 'true', title: '放的时候时间线自动横着跟着播放头走', onclick: () => { follow = !follow; followBtn.setAttribute('aria-pressed', String(follow)); if (follow && at >= 0) movePlayhead(at); } }, '跟着走');

  const playFrom = (i) => {
    picked = i;
    if (player.loop !== null) player.loop = i;
    player.start(i).then(refresh);
    refresh();
  };
  const stop = () => {
    player.stop();
    refresh();
  };
  // 机器上的 Scene 模式：一个 Scene 一直循环；再按一次回到从头往后放
  const toggleLoop = () => {
    player.loop = player.loop === null ? picked : null;
    if (player.playing) player.start(picked).then(refresh);
    refresh();
  };
  const pickTrack = (ti) => {
    focus = ti;
    renderPats();
    refresh();
  };
  const toggleSolo = (ti) => {
    player.solo = player.solo === ti ? null : ti;
    refresh();
  };
  const toggleMute = (ti) => {
    if (player.muted.has(ti)) player.muted.delete(ti);
    else player.muted.add(ti);
    refresh();
  };

  // ── 右边 ──
  // 现场动作（转滤波器）和开着的效果（DUCKER）：机器上怎么做
  function fxCard() {
    const moved = scenes.filter((sc) => sc.moves);
    const ducked = tracks.filter((p) => p.duck).map((p) => TRACK[p.track].label);
    if (!moved.length && !ducked.length) return null;
    const seen = new Set();
    const lines = moved.filter((sc) => !seen.has(sc.name) && seen.add(sc.name)).map((sc) =>
      h('li', {}, h('b', {}, sc.name), '：', Object.entries(sc.moves).map(([t, [a, b]]) => `${TRACK[t].label} ${moveWord([a, b]).short}`).join('，')));
    return h('div', { class: 'card sp-card' },
      h('h3', {}, '现场动作和效果'),
      moved.length && h('p', { class: 'sp-note sf-fx-note' }, '滤波器：选中那条轨道，转 Sound Design 第 2 页的旋钮 3（FILTER）——往上亮、往下闷。可以边放边现场转，也可以按住录音键转一遍，录进这段乐句（Motion）。'),
      moved.length && h('ul', { class: 'sp-differs sf-fx' }, lines),
      ducked.length && h('p', { class: 'sp-note sf-fx-note' }, `DUCKER：${ducked.join('、')} 开着，底鼓一响就把它们压下去，听着跟着底鼓“喘气”。机器上选中那条轨道，[MASTER/SINGLE] 拨到 SINGLE，转 [FX] 旋钮直到 DUCKER 亮（第 7 章细讲）。`));
  }
  const most = Math.max(...tracks.map((p) => patternCount(spec, arr, p.track)));
  const longest = Math.max(...scenes.map((s) => s.bars));
  const side = h('aside', { class: 'sp-side' },
    h('div', { class: 'card sp-card' },
      h('h3', {}, '机器上怎么排'),
      h('dl', { class: 'sp-setup' },
        h('dt', {}, '乐句'), h('dd', {}, h('b', {}, `每条最多 ${most} 段`),
          h('small', {}, `每条轨道最多能存 6 段乐句。${most > 3 ? '用到第 4 段以上，先按住那条轨道的旋钮、再按亮着蓝色的 4–6 号键，把这条轨道换成 6 段。' : '这首每条都不超过 3 段，用默认的就行。'}转轨道旋钮就是换这条轨道放第几段。`)),
        h('dt', {}, 'Scene'), h('dd', {}, h('b', {}, `${scenes.length} 个`),
          h('small', {}, `一个 Scene = 每条轨道各放第几段乐句（时间线上的一段，色块上写着第几段）。一首最多 16 个；每个最长 8 小节${longest >= 8 ? '，所以 16 小节的段落拆成两个一样的 Scene' : ''}。${scenes.some((s) => s.steps % 16) ? '不满一小节的（比如那 2 拍的停顿）也是一个 Scene：长度按住 [PAGE] 转 [ALL] 一步一步改。' : ''}`)),
        h('dt', {}, 'Song'), h('dd', {}, h('b', {}, '按顺序放'),
          h('small', {}, '按住 [ALL] 旋钮再按 [PROJECT↑] 进 Song 模式（SONG 灯亮），按 [PLAY] 就从头一段段往下放；再按一次 [ALL] + [PROJECT↑] 是 Scene 模式，只循环一段。'))),
      h('p', { class: 'sp-note' }, `速度、音阶、调和分轨那一页一样：${spec.bpm} BPM，${pretty(KEY_NAMES[spec.key])} ${SCALES[spec.scale].name}。`)),
    fxCard(),
    h('div', { class: 'card sp-card' },
      h('h3', {}, '和原曲哪里不一样'),
      h('ul', { class: 'sp-differs' }, arr.differs.map((d) => h('li', {}, d)))),
    lessonCard(song),
  );

  // 说明文字默认收成两行（给段落表和格子腾地方），点“展开”看全
  const sumText = h('p', { class: 'sp-summary sf-sum' }, h('span', { class: 'sp-tip' }, '点时间尺上的段落从那里开始放；点一条轨道上的色块，下面看那段乐句。色块上的数字是第几段乐句，↗ 是这一段把滤波器慢慢打开，↘ 是慢慢关上，· 是压暗不动。'), ' ', arr.summary);
  const more = h('button', { class: 'sf-more', type: 'button', onclick: () => { const open = sumText.classList.toggle('open'); more.textContent = open ? '收起' : '展开说明'; } }, '展开说明');
  const summary = h('div', { class: 'sf-sumbox' }, sumText, more);
  const scroller = h('div', { class: 'sf-scroll' }, matrix, patBox);

  view.classList.add('fixed');
  view.append(h('div', { class: 'sp-page sf-page' },
    h('div', { class: 'play-head' },
      h('a', { class: 'back', href: `#/songs/${id}` }, `← ${song.title} 分轨`),
      h('h1', {}, song.title, h('span', { class: 'sp-sub' }, '完整版')),
      h('div', { class: 'meta' },
        h('span', { class: 'tag' }, `${spec.bpm} BPM`),
        h('span', { class: 'tag' }, `${pretty(KEY_NAMES[spec.key])} ${SCALES[spec.scale].name}`),
        h('span', { class: 'tag' }, `${scenes.length} 段 · 约 ${mmss(totalSec)}`))),
    h('div', { class: 'sp-body' },
      h('div', { class: 'sp-main' },
        h('div', { class: 'sp-transport' }, playBtn, loopBtn, resetBtn, followBtn, where),
        summary,
        scroller),
      side),
  ));
  renderPats();
  refresh();
  const dev = new URLSearchParams(location.search);
  if (dev.has('playhead')) {
    frozen = true;
    at = Math.min(Math.max(0, Number(dev.get('playhead')) || 0), player.total - 1);
    const si = player.sceneAt(at);
    picked = si;
    const pct = `${(((at - scenes[si].start) + 1) / scenes[si].steps) * 100}%`;
    secs[si].bar.style.width = pct;
    refresh();
    movePlayhead(at);
    lightPats();
  }
  return {
    destroy() {
      player.stop();
      view.classList.remove('fixed');
    },
  };
}
