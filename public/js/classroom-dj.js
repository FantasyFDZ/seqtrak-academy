// 小课堂的 DJ 线（2026-11-15）：乐句和小节、预判 Drop、过渡、能量曲线、对拍、调性。
// 例子都用曲目库里已经写好的 SEQTRAK 版：有段落的用 8 首完整版（content/song-arrangements.js，放音是 song-player.js 的 ArrangementPlayer），
// 要两首叠着放的用分轨（content/song-parts.js）。声音全是应用自己合成的，和曲目页的试听是同一套。
// 约定和别的玩具一样（见 classroom-kit.js 开头）。这里的“挑战”大多是看时机：按下去的那一下和该来的那一拍差多少。
import { h, rich, clamp } from './util.js';
import { audio } from './audio.js';
import { LoopPlayer } from './looper.js';
import { store } from './store.js';
import { sfx } from './sfx.js';
import { confetti, pop } from './fx.js';
import { segmented } from './ui.js';
import { SCALES, KEY_NAMES } from './scales.js';
import { ArrangementPlayer, partEvents, arrangementTracks, partPitches } from './song-player.js';
import { SONG_PARTS } from './content/song-parts.js';
import { ARRANGEMENTS, SECTION_KINDS } from './content/song-arrangements.js';
import { SONGS } from './content/songs.js';
import { byTier, pick, shuffle, starsByWrong, passLine } from './classroom-kit.js';
import { orderQuiz } from './classroom-ear.js';

const title = (id) => SONGS.find((s) => s.id === id)?.title || id;
const keyName = (id) => {
  const s = SONG_PARTS[id];
  return `${KEY_NAMES[s.key]} ${SCALES[s.scale].zh}`;
};
export const FULL_SONGS = Object.keys(ARRANGEMENTS);
const inputMs = () => store.settings.inputOffsetMs || 0;

// ───────────── 段落的小工具 ─────────────

const LAYER_W = { drums: 0.55, bass: 1.2, chords: 1, lead: 1.1 };
const DRUM_W = { KICK: 1.5, SNARE: 0.8, CLAP: 0.8 };

/** 一个 Scene 有多“满”：响着的轨道越多、越重（底鼓、贝斯），能量越高；滤波器捂着的算一半 */
export function sceneEnergy(id, sc) {
  const spec = SONG_PARTS[id];
  const arr = ARRANGEMENTS[id];
  const tracks = arrangementTracks(spec, arr);
  let e = 0;
  for (const [track] of Object.entries(sc.play || {})) {
    const p = tracks.find((x) => x.track === track);
    if (!p) continue;
    let w = p.layer === 'drums' ? DRUM_W[track] ?? LAYER_W.drums : LAYER_W[p.layer] ?? 1;
    const mv = sc.moves?.[track];
    if (mv && Math.max(mv[0], mv[1]) < 2500) w *= 0.5;
    e += w;
  }
  return Math.round(e * 10) / 10;
}

// 拼出来的“短版”完整版：只要其中几段、每段只要几小节（做题用）。同一种拼法只拼一次，免得每一轮都新建一套声音线路
const trimmed = new Map();
function trimArr(id, picks) {
  const key = `${id}|${picks.map((p) => `${p.i}:${p.bars}`).join(',')}`;
  if (!trimmed.has(key)) {
    const arr = ARRANGEMENTS[id];
    trimmed.set(key, { ...arr, scenes: picks.map((p) => ({ ...arr.scenes[p.i], bars: p.bars ?? arr.scenes[p.i].bars })) });
  }
  return trimmed.get(key);
}

/**
 * 放一段（完整版拼出来的短版），一边放一边记“第几步是什么时候听到的”，好算某一步落在什么时刻（页面时钟，毫秒）。
 * 返回 { player, stop(), at(全曲第几步) → 那一步被听到的时刻 }
 */
function clip(id, picks, { onStep, onEnd } = {}) {
  const spec = SONG_PARTS[id];
  const arr = trimArr(id, picks);
  const player = new ArrangementPlayer(spec, arr);
  const stepMs = 60000 / spec.bpm / 4;
  let seen = null; // 最近一次：{ step, perf }
  player.onStep((s) => {
    if (s >= 0) seen = { step: s, perf: performance.now() };
    onStep?.(s);
  });
  player.onEnd = () => onEnd?.();
  player.start(0);
  return {
    player,
    scenes: player.scenes,
    stepMs,
    at: (step) => (seen ? seen.perf + (step - seen.step) * stepMs : null),
    get step() {
      return seen?.step ?? -1;
    },
    stop() {
      player.onEnd = null;
      player.stop();
    },
  };
}

/** 所有“换段”的地方：前一段至少 4 小节、不是停顿，换过去的那段也不是停顿 */
function boundaries() {
  const out = [];
  for (const id of FULL_SONGS) {
    const sc = ARRANGEMENTS[id].scenes;
    for (let i = 1; i < sc.length; i++) {
      if (sc[i - 1].kind === 'pause' || sc[i].kind === 'pause' || sc[i - 1].bars < 4 || sc[i].bars < 2) continue;
      out.push({ id, i });
    }
  }
  return out;
}

/** 所有“铺垫 → Drop / 副歌”的地方（中间可以隔一个停顿） */
function drops() {
  const out = [];
  for (const id of FULL_SONGS) {
    const sc = ARRANGEMENTS[id].scenes;
    for (let i = 1; i < sc.length; i++) {
      if (!['drop', 'chorus'].includes(sc[i].kind)) continue;
      const pause = sc[i - 1].kind === 'pause' ? i - 1 : -1;
      const lead = pause >= 0 ? i - 2 : i - 1;
      if (lead < 0 || ['drop', 'chorus', 'pause'].includes(sc[lead].kind)) continue;
      out.push({ id, lead, pause, drop: i });
    }
  }
  return out;
}

/** 一条 Scene 的色条（时间线上用） */
const kindColor = (k) => SECTION_KINDS[k]?.color || '#8aa0b6';

/** 四个拍灯 + 小节计数（“第 3 小节 / 一句 8 小节”） */
function counter({ phrase = 8, showBars = true } = {}) {
  const lamps = [1, 2, 3, 4].map((n) => h('i', { class: n === 1 ? 'one' : '' }, String(n)));
  const bar = h('b', {}, '–');
  const of = h('small', {}, showBars ? `/ ${phrase} 小节` : '');
  const el = h('div', { class: 'cl-dj-count' }, h('div', { class: 'cl-beats sm' }, lamps), h('div', { class: ['cl-dj-bar', !showBars && 'hidden'] }, bar, of));
  return {
    el,
    /** step：从这一段开头数的第几步（16 步一小节）；from：这一句从第几步算起 */
    set(step, from = 0) {
      if (step < 0) {
        lamps.forEach((l) => l.classList.remove('on'));
        bar.textContent = '–';
        return;
      }
      const beat = Math.floor(step / 4) % 4;
      lamps.forEach((l, i) => l.classList.toggle('on', i === beat));
      const b = Math.floor((step - from) / 16);
      bar.textContent = String((((b % phrase) + phrase) % phrase) + 1);
    },
  };
}

/** 一排歌名按钮（挑一首） */
function songChips(ids, now, onPick) {
  const box = segmented(ids.map((id) => ({ value: id, label: title(id) })), now, (id) => onPick(id));
  box.classList.add('cl-seg', 'cl-dj-songs');
  return box;
}

/** 时间线：一段一块，宽度按小节数，颜色按种类；now 是现在在第几块 */
function timeline(scenes, { names = true, energy = null } = {}) {
  const total = scenes.reduce((n, s) => n + s.bars, 0);
  const blocks = scenes.map((s, i) => h('div', { class: 'cl-tl-block', style: { flexGrow: String(s.bars), '--k': kindColor(s.kind) }, title: SECTION_KINDS[s.kind]?.label || s.kind },
    energy && h('i', { style: { height: `${Math.round((energy[i] / Math.max(...energy, 1)) * 100)}%` } }),
    names && h('span', {}, s.name || SECTION_KINDS[s.kind]?.label || '')));
  const head = h('div', { class: 'cl-tl-head' });
  const el = h('div', { class: 'cl-tl' }, h('div', { class: 'cl-tl-row' }, blocks), head);
  return {
    el,
    blocks,
    /** 播放头：第几步（全曲） */
    set(step) {
      head.style.display = step < 0 ? 'none' : 'block';
      head.style.left = `${clamp((step / 16 / total) * 100, 0, 100)}%`;
      let at = 0;
      blocks.forEach((b, i) => {
        const on = step >= at * 16 && step < (at + scenes[i].bars) * 16;
        b.classList.toggle('now', on);
        at += scenes[i].bars;
      });
    },
  };
}

/** 判时机：按下去的那一下比该来的那一拍早 / 晚多少拍 */
const offWords = (beats) => {
  const a = Math.abs(beats);
  if (a < 0.12) return '正好踩在那一拍上';
  const n = a >= 1 ? `${Math.round(a * 10) / 10} 拍` : a >= 0.45 ? '半拍左右' : '一点点';
  return `${beats < 0 ? '早了' : '晚了'}${n}`;
};

// ───────────── D1 乐句和小节 ─────────────

/** 玩一玩：放一首完整版，看着数小节；每一段换的时候都落在“1”上 */
function phrasecount(spec, env) {
  let id = spec.song || 'animals';
  let c = null;
  const cnt = counter({ phrase: 8 });
  const tlBox = h('div', { class: 'cl-tl-box' });
  let tl = null;
  const say = h('div', { class: 'cl-note' }, '点「播放」，跟着数：1、2、3、4 是一小节，数到 8 小节，常常就换一段。');
  const play = h('button', { class: 'btn primary lg cl-play', type: 'button' }, '▶ 播放');
  const tapBtn = h('button', { class: 'btn lg', type: 'button' }, '换段了！');
  let starts = [];
  const paintTl = () => {
    const scenes = ARRANGEMENTS[id].scenes;
    tl = timeline(scenes);
    tlBox.replaceChildren(tl.el);
    let at = 0;
    starts = scenes.map((s) => {
      const st = at;
      at += s.bars * 16;
      return st;
    });
  };
  const stop = () => {
    c?.stop();
    c = null;
    play.textContent = '▶ 播放';
    cnt.set(-1);
    tl?.set(-1);
  };
  play.addEventListener('click', () => {
    if (c) return stop();
    let last = -1;
    c = clip(id, ARRANGEMENTS[id].scenes.map((_, i) => ({ i })), {
      onStep: (s) => {
        if (s < 0) return;
        const sceneStart = [...starts].reverse().find((x) => x <= s) ?? 0;
        cnt.set(s, sceneStart);
        tl?.set(s);
        const si = starts.findLastIndex((x) => x <= s);
        if (si !== last && last >= 0) {
          const sc = ARRANGEMENTS[id].scenes[si];
          say.innerHTML = rich(`换段：**${sc.name}**（${SECTION_KINDS[sc.kind]?.label}）。它是从第 1 小节的第 1 拍开始的。`);
          pop(tl.blocks[si]);
        }
        last = si;
      },
      onEnd: stop,
    });
    play.textContent = '■ 停';
    env.touched();
  });
  tapBtn.addEventListener('click', (e) => {
    if (!c) return (say.textContent = '先点「播放」。');
    env.touched();
    const now = e.timeStamp - inputMs();
    const near = starts.slice(1).map((s) => c.at(s)).filter((x) => x !== null).reduce((a, b) => (Math.abs(b - now) < Math.abs(a - now) ? b : a), Infinity);
    const beats = (now - near) / (c.stepMs * 4);
    say.innerHTML = rich(Math.abs(beats) > 4 ? '这会儿没在换段。数着小节，等第 8 小节过完。' : `${offWords(beats)}。`);
  });
  paintTl();
  const el = h('div', { class: 'cl-toy cl-dj' },
    songChips(spec.songs || ['animals', 'levels', 'faded', 'wake-me-up'], id, (v) => { stop(); id = v; paintTl(); env.touched(); }),
    h('div', { class: 'cl-row' }, play, tapBtn, h('span', { class: 'spacer' }), cnt.el),
    tlBox, say);
  return { el, destroy: stop };
}

/**
 * 挑战：从一段的后几小节放起，在下一段的第 1 拍按“新一段！”。
 * 铜：看得见小节数，提前 2 小节放；银：只剩拍灯，提前 4 小节；金：什么都不给看，提前 4 小节，要更准。
 */
function phrasecatch(spec, env) {
  const need = spec.need || byTier(env.tier, [2, 3, 3]);
  const lead = byTier(env.tier, [2, 4, 4]);
  const tol = byTier(env.tier, [1, 0.5, 0.34]);
  const showBars = env.tier <= 1;
  const showBeats = env.tier <= 2;
  const pool = shuffle(boundaries());
  let k = 0;
  let right = 0;
  let wrong = 0;
  let c = null;
  let target = 0;
  let pressed = false;
  let timer = 0;
  const lamps = h('div', { class: 'cl-lamps' });
  const cnt = counter({ phrase: 4, showBars });
  const info = h('div', { class: 'cl-dj-info' });
  const go = h('button', { class: 'btn primary lg', type: 'button' }, '▶ 放这一轮');
  const tap = h('button', { class: 'cl-pad cl-dj-tap', type: 'button', 'data-sfx': 'none' }, h('b', {}, '新一段！'), h('span', {}, '在下一段的第 1 拍按'));
  const note = h('div', { class: 'cl-note' });
  const paintLamps = () => lamps.replaceChildren(...Array.from({ length: need }, (_, i) => h('i', { class: i < right ? 'on' : '' })));
  const stop = () => {
    clearTimeout(timer);
    c?.stop();
    c = null;
    cnt.set(-1);
  };

  function round() {
    stop();
    const b = pool[k++ % pool.length];
    const prev = ARRANGEMENTS[b.id].scenes[b.i - 1];
    target = lead * 16;
    pressed = false;
    info.innerHTML = rich(`**${title(b.id)}** · 从「${prev.name}」的最后 ${lead} 小节放起`);
    note.textContent = showBars ? `看着小节数：第 ${lead} 小节数完，下一下就是新的一段。` : showBeats ? `一共 ${lead} 小节：心里数着，数完就是新的一段。` : `一共 ${lead} 小节。这次只能靠耳朵和心里的数。`;
    c = clip(b.id, [{ i: b.i - 1, bars: lead }, { i: b.i, bars: 2 }], {
      onStep: (s) => {
        if (showBeats) cnt.set(s);
        // 新一段开了一小节还没按：算没按到
        if (s >= target + 16 && !pressed) {
          pressed = true;
          judge(null);
        }
      },
      onEnd: () => {
        if (!pressed) judge(null);
      },
    });
    env.touched();
  }

  function judge(perf) {
    const t = c?.at(target);
    let ok = false;
    if (perf === null || t === null) {
      note.innerHTML = rich('新的一段已经来了，没按到。再听一次，**数着小节**。');
    } else {
      const beats = (perf - t) / (c.stepMs * 4);
      ok = Math.abs(beats) <= tol;
      note.innerHTML = rich(ok ? `✓ ${offWords(beats)}。` : `${offWords(beats)}：这一档要在 ${tol >= 1 ? '1 拍' : tol >= 0.5 ? '半拍' : '1/3 拍'}以内。`);
    }
    if (ok) {
      right++;
      sfx.play('ok');
    } else {
      wrong++;
      sfx.play('nope');
    }
    paintLamps();
    if (right >= need) {
      timer = setTimeout(stop, 1600);
      env.done(starsByWrong(wrong));
      confetti(lamps, 18);
      note.append(passLine(`过关。${wrong ? `中间错了 ${wrong} 次。` : '一次都没错。'}`, () => { right = 0; wrong = 0; paintLamps(); round(); }));
      return;
    }
    timer = setTimeout(round, ok ? 2200 : 3000);
  }

  go.addEventListener('click', round);
  tap.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    tap.classList.add('hit');
    setTimeout(() => tap.classList.remove('hit'), 90);
    if (!c) return (note.textContent = '先点「放这一轮」。');
    if (pressed) return;
    const now = e.timeStamp - inputMs();
    const t = c.at(target);
    if (t !== null && now < t - c.stepMs * 4 * Math.max(1.5, tol + 0.5)) {
      note.textContent = '还早：这一段还没完。';
      return;
    }
    pressed = true;
    judge(now);
  });
  paintLamps();
  note.textContent = '点「放这一轮」。';
  const el = h('div', { class: ['cl-toy', 'cl-dj', !showBeats && 'blind'] },
    h('div', { class: 'cl-row' }, go, info, h('span', { class: 'spacer' }), lamps),
    showBeats ? cnt.el : h('div', { class: 'cl-dj-blind' }, '这一档不给看拍子：用耳朵'),
    tap, note);
  return {
    el,
    destroy: stop,
    get __target() {
      return c ? c.at(target) : null; // 给走查脚本用：该按的那一刻
    },
  };
}

// ───────────── D2 预判 Drop ─────────────

/** 玩一玩：从铺垫的最后几小节放到 Drop，看时间线：铺垫里有哪些“要来了”的信号 */
function dropview(spec, env) {
  const list = drops();
  const ids = [...new Set(list.map((d) => d.id))];
  let id = spec.song || 'animals';
  let c = null;
  const box = h('div', { class: 'cl-tl-box' });
  const say = h('div', { class: 'cl-note' }, '点「播放」：从铺垫放到 Drop。听它是怎么“憋”的，在 Drop 第一下按“Drop！”。');
  const play = h('button', { class: 'btn primary lg cl-play', type: 'button' }, '▶ 播放');
  const tap = h('button', { class: 'btn lg', type: 'button' }, 'Drop！');
  const cnt = counter({ phrase: 8 });
  let picks = [];
  let dropAt = 0;
  let tl = null;
  const paint = () => {
    const d = list.find((x) => x.id === id);
    const sc = ARRANGEMENTS[id].scenes;
    picks = [{ i: d.lead, bars: Math.min(8, sc[d.lead].bars) }, ...(d.pause >= 0 ? [{ i: d.pause }] : []), { i: d.drop, bars: 4 }];
    dropAt = (picks[0].bars + (d.pause >= 0 ? sc[d.pause].bars : 0)) * 16;
    tl = timeline(picks.map((p) => ({ ...sc[p.i], bars: p.bars ?? sc[p.i].bars })));
    box.replaceChildren(tl.el);
  };
  const stop = () => {
    c?.stop();
    c = null;
    play.textContent = '▶ 播放';
    tl?.set(-1);
    cnt.set(-1);
  };
  play.addEventListener('click', () => {
    if (c) return stop();
    c = clip(id, picks, { onStep: (s) => { tl.set(s); cnt.set(s); if (s === dropAt) say.innerHTML = rich('**Drop！** 鼓和贝斯一起砸下来。'); }, onEnd: stop });
    play.textContent = '■ 停';
    env.touched();
  });
  tap.addEventListener('click', (e) => {
    if (!c) return (say.textContent = '先点「播放」。');
    env.touched();
    const beats = (e.timeStamp - inputMs() - c.at(dropAt)) / (c.stepMs * 4);
    say.innerHTML = rich(`${offWords(beats)}。${beats < -2 ? '铺垫还没完：等它憋到最后一小节。' : ''}`);
  });
  paint();
  const el = h('div', { class: 'cl-toy cl-dj' },
    songChips(ids, id, (v) => { stop(); id = v; paint(); env.touched(); }),
    h('div', { class: 'cl-row' }, play, tap, h('span', { class: 'spacer' }), cnt.el), box, say);
  return { el, destroy: stop };
}

/** 挑战：只给铺垫的最后几小节，在 Drop 第一下按。铜看得见时间线；银只剩拍灯；金什么都不给看、要更准 */
function dropcatch(spec, env) {
  const need = spec.need || byTier(env.tier, [2, 3, 3]);
  const tol = byTier(env.tier, [1, 0.5, 0.34]);
  const pool = shuffle(drops());
  let k = 0;
  let right = 0;
  let wrong = 0;
  let c = null;
  let target = 0;
  let pressed = false;
  let timer = 0;
  const lamps = h('div', { class: 'cl-lamps' });
  const cnt = counter({ phrase: 4, showBars: env.tier <= 1 });
  const box = h('div', { class: 'cl-tl-box' });
  const info = h('div', { class: 'cl-dj-info' });
  const go = h('button', { class: 'btn primary lg', type: 'button' }, '▶ 放这一轮');
  const tap = h('button', { class: 'cl-pad cl-dj-tap', type: 'button', 'data-sfx': 'none' }, h('b', {}, 'Drop！'), h('span', {}, '在 Drop 的第一下按'));
  const note = h('div', { class: 'cl-note' }, '点「放这一轮」。');
  let tl = null;
  const paintLamps = () => lamps.replaceChildren(...Array.from({ length: need }, (_, i) => h('i', { class: i < right ? 'on' : '' })));
  const stop = () => {
    clearTimeout(timer);
    c?.stop();
    c = null;
    cnt.set(-1);
    tl?.set(-1);
  };

  function round() {
    stop();
    const d = pool[k++ % pool.length];
    const sc = ARRANGEMENTS[d.id].scenes;
    const leadBars = Math.min(4, sc[d.lead].bars);
    const picks = [{ i: d.lead, bars: leadBars }, ...(d.pause >= 0 ? [{ i: d.pause }] : []), { i: d.drop, bars: 2 }];
    target = (leadBars + (d.pause >= 0 ? sc[d.pause].bars : 0)) * 16;
    pressed = false;
    info.innerHTML = rich(`**${title(d.id)}** · ${SECTION_KINDS[sc[d.lead].kind]?.label} → ${d.pause >= 0 ? '停 → ' : ''}${SECTION_KINDS[sc[d.drop].kind]?.label}`);
    if (env.tier <= 1) {
      tl = timeline(picks.map((p) => ({ ...sc[p.i], bars: p.bars ?? sc[p.i].bars })));
      box.replaceChildren(tl.el);
    } else {
      tl = null;
      box.replaceChildren();
    }
    note.textContent = d.pause >= 0 ? '注意：Drop 前面有一下“停”。停的时候别急着按。' : '听铺垫越憋越紧，在 Drop 第一下按。';
    c = clip(d.id, picks, {
      onStep: (s) => {
        tl?.set(s);
        if (env.tier <= 2) cnt.set(s);
        if (s >= target + 16 && !pressed) {
          pressed = true;
          judge(null);
        }
      },
      onEnd: () => !pressed && judge(null),
    });
    env.touched();
  }

  function judge(perf) {
    const t = c?.at(target);
    let ok = false;
    if (perf === null || t === null) note.innerHTML = rich('Drop 来了，没按到。下一轮先在心里数着。');
    else {
      const beats = (perf - t) / (c.stepMs * 4);
      ok = Math.abs(beats) <= tol;
      note.innerHTML = rich(ok ? `✓ ${offWords(beats)}。` : `${offWords(beats)}：这一档要在 ${tol >= 1 ? '1 拍' : tol >= 0.5 ? '半拍' : '1/3 拍'}以内。`);
    }
    if (ok) {
      right++;
      sfx.play('ok');
    } else {
      wrong++;
      sfx.play('nope');
    }
    paintLamps();
    if (right >= need) {
      timer = setTimeout(stop, 1600);
      env.done(starsByWrong(wrong));
      confetti(lamps, 18);
      note.append(passLine(`过关。${wrong ? `中间错了 ${wrong} 次。` : '一次都没错。'}`, () => { right = 0; wrong = 0; paintLamps(); round(); }));
      return;
    }
    timer = setTimeout(round, ok ? 2200 : 3000);
  }

  go.addEventListener('click', round);
  tap.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    tap.classList.add('hit');
    setTimeout(() => tap.classList.remove('hit'), 90);
    if (!c) return (note.textContent = '先点「放这一轮」。');
    if (pressed) return;
    const now = e.timeStamp - inputMs();
    const t = c.at(target);
    if (t !== null && now < t - c.stepMs * 4 * 1.6) {
      note.textContent = '还没到：铺垫还在憋。';
      return;
    }
    pressed = true;
    judge(now);
  });
  paintLamps();
  const el = h('div', { class: ['cl-toy', 'cl-dj', env.tier >= 3 && 'blind'] },
    h('div', { class: 'cl-row' }, go, info, h('span', { class: 'spacer' }), lamps),
    env.tier <= 2 ? cnt.el : h('div', { class: 'cl-dj-blind' }, '这一档不给看拍子：用耳朵'),
    box, tap, note);
  return {
    el,
    destroy: stop,
    get __target() {
      return c ? c.at(target) : null;
    },
  };
}

// ───────────── D4 能量曲线 ─────────────

/** 玩一玩：一首歌每一段有多满，画成一排柱子；点哪段放哪段 */
function energymap(spec, env) {
  let id = spec.song || 'levels';
  let player = null;
  let timer = 0;
  const box = h('div', { class: 'cl-tl-box tall' });
  const say = h('div', { class: 'cl-note' }, '柱子越高，这一段越“满”（响的乐器越多、越重）。点一段，听它。');
  let tl = null;
  const stop = () => {
    clearTimeout(timer);
    player?.stop();
    player = null;
    tl?.blocks.forEach((b) => b.classList.remove('now'));
  };
  const paint = () => {
    const scenes = ARRANGEMENTS[id].scenes;
    const energy = scenes.map((s) => sceneEnergy(id, s));
    tl = timeline(scenes, { energy });
    tl.blocks.forEach((b, i) => {
      b.setAttribute('role', 'button');
      b.setAttribute('tabindex', '0');
      const activate = () => {
        stop();
        player = new ArrangementPlayer(SONG_PARTS[id], ARRANGEMENTS[id]);
        player.loop = i;
        player.start();
        b.classList.add('now');
        const sc = scenes[i];
        say.innerHTML = rich(`**${sc.name}**${sc.name === SECTION_KINDS[sc.kind]?.label ? '' : `（${SECTION_KINDS[sc.kind]?.label}）`}：能量 ${energy[i]}。${energy[i] === Math.max(...energy) ? '整首最满的就是这儿。' : energy[i] === Math.min(...energy) ? '整首最空的一段。' : ''}`);
        timer = setTimeout(stop, (60 / SONG_PARTS[id].bpm) * 4 * Math.min(4, sc.bars) * 1000);
        env.touched();
      };
      b.addEventListener('click', activate);
      b.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') activate();
        if (e.key === ' ') e.preventDefault();
      });
      b.addEventListener('keyup', (e) => {
        if (e.key === ' ') activate();
      });
    });
    box.replaceChildren(tl.el);
  };
  paint();
  const el = h('div', { class: 'cl-toy cl-dj' },
    songChips(spec.songs || FULL_SONGS, id, (v) => { stop(); id = v; paint(); env.touched(); }),
    h('div', { class: 'cl-cap' }, '一首歌的形状：前奏、主歌、铺垫、Drop……高高低低连起来，就是它的能量曲线'),
    box, say);
  return { el, destroy: stop };
}

/** 挑战：几段放出来，按“从空到满”排好（用的是排顺序那种题） */
function energyorder(spec, env) {
  let player = null;
  let timer = 0;
  const stopAll = () => {
    clearTimeout(timer);
    player?.stop();
  };
  const quiz = orderQuiz({ ...spec, each: 3.4 }, env, (n) => {
    // 挑一首有 n 段能量各不相同的歌
    for (let tries = 0; tries < 40; tries++) {
      const id = pick(spec.songs || FULL_SONGS);
      const scenes = ARRANGEMENTS[id].scenes;
      const byE = new Map();
      scenes.forEach((s, i) => {
        if (s.kind === 'pause' || s.bars < 2) return;
        const e = sceneEnergy(id, s);
        if (![...byE.keys()].some((x) => Math.abs(x - e) < (n >= 5 ? 0.6 : 0.9))) byE.set(e, i); // 金那一档要 5 段：差得近一点也算
      });
      if (byE.size < n) continue;
      const chosen = shuffle([...byE.entries()]).slice(0, n);
      const sorted = [...chosen].sort((a, b) => a[0] - b[0]);
      return {
        items: chosen.map(([, i]) => ({
          tag: '点我听',
          play: () => {
            stopAll();
            player = new ArrangementPlayer(SONG_PARTS[id], ARRANGEMENTS[id]);
            player.loop = i;
            player.start();
            timer = setTimeout(stopAll, (60 / SONG_PARTS[id].bpm) * 4 * 2 * 1000);
            return stopAll;
          },
        })),
        rank: chosen.map((x) => sorted.indexOf(x)),
        ends: ['最空', '最满'],
        say: { right: `都是《${title(id)}》里的段落。` },
        destroy: stopAll,
      };
    }
    return null;
  });
  return { el: quiz.el, destroy: () => { quiz.destroy(); stopAll(); } };
}

// ───────────── D3 过渡：两首歌、一个推子 ─────────────

/**
 * 一台小混音台：两首歌（分轨）跟着同一个速度放，一个推子在 A、B 之间，两边各一个“低音”开关（关掉 = 底鼓和贝斯都没了，
 * 打碟时把低频 EQ 拧到底就是这个）。B 和 A 同时从第 1 小节开始，只是推子在 A 那头时听不见：这样两边的乐句是对齐的。
 */
class Mixer {
  constructor(a, b) {
    this.ids = [a, b];
    this.bpm = SONG_PARTS[a].bpm;
    this.fader = 0;
    this.low = [true, true];
    this.count = 0;
    this.player = new LoopPlayer({ bpm: this.bpm, steps: 16 });
    this.decks = this.ids.map((id) => {
      const song = SONG_PARTS[id];
      return { id, song, len: song.bars * 16, events: song.parts.map((p) => partEvents(song, p)), parts: song.parts };
    });
    this.nodes = null;
    this.name = `mix${++Mixer.seq}`;
    this.player.onSchedule = (step, t) => this.#schedule(step, t);
    this.onBeat = null;
  }

  static seq = 0;

  #build() {
    const ctx = audio.ctx;
    const g = (v) => {
      const n = ctx.createGain();
      n.gain.value = v;
      return n;
    };
    this.nodes = this.decks.map((d, i) => {
      const out = g(i === 0 ? 1 : 0);
      const low = g(1);
      const main = g(1);
      low.connect(out);
      main.connect(out);
      out.connect(audio.master);
      audio.buses[`${this.name}:${i}:low`] = low;
      audio.buses[`${this.name}:${i}:main`] = main;
      return { out, low, main };
    });
    this.#apply(true);
  }

  #apply(now = false) {
    if (!this.nodes) return;
    const t = audio.ctx.currentTime;
    const x = this.fader;
    const gains = [Math.cos((x * Math.PI) / 2), Math.sin((x * Math.PI) / 2)];
    this.nodes.forEach((n, i) => {
      n.out.gain.setTargetAtTime(gains[i], t, now ? 0.001 : 0.02);
      n.low.gain.setTargetAtTime(this.low[i] ? 1 : 0, t, 0.01);
    });
  }

  #schedule(step, t) {
    const g = this.count++;
    const stepSec = 60 / this.bpm / 4;
    if (g % 4 === 0) this.onBeat?.(g, t);
    this.decks.forEach((d, i) => {
      const s = g % d.len;
      d.events.forEach((byStep, pi) => {
        const part = d.parts[pi];
        const bus = `${this.name}:${i}:${part.layer === 'bass' || part.track === 'KICK' ? 'low' : 'main'}`;
        for (const e of byStep[s]) {
          if (e.drum) audio.drum(e.drum, t, e.vel * (e.drum === 'CLAP' ? 2 : 1), bus);
          else for (const m of e.midis) audio.note(m, t, e.len * stepSec * 0.92, { voice: e.voice, vel: e.vel, bus });
        }
      });
    });
  }

  async start() {
    if (!(await audio.init())) return false;
    if (!this.nodes) this.#build();
    this.count = 0;
    await this.player.start();
    return true;
  }

  stop() {
    this.player.stop();
  }

  setFader(x) {
    this.fader = clamp(x, 0, 1);
    this.#apply();
  }

  setLow(i, on) {
    this.low[i] = on;
    this.#apply();
  }

  /** 现在这一刻两边各有多大声（0–1），低音那一路各有多大声 */
  levels() {
    const x = this.fader;
    const g = [Math.cos((x * Math.PI) / 2), Math.sin((x * Math.PI) / 2)];
    return { deck: g, low: g.map((v, i) => (this.low[i] ? v : 0)) };
  }

  destroy() {
    this.stop();
    if (!this.nodes) return;
    for (const k of Object.keys(audio.buses)) if (k.startsWith(`${this.name}:`)) delete audio.buses[k];
    this.nodes.forEach((n) => {
      n.out.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.05);
      setTimeout(() => n.out.disconnect(), 400);
    });
    this.nodes = null;
  }
}

/** 同一个速度上下、能放在一起的几对 */
const MIX_PAIRS = [['wake-me-up', 'dont-start-now'], ['one-kiss', 'believer'], ['levels', 'the-nights'], ['animals', 'levels'], ['dont-start-now', 'one-kiss'], ['believer', 'wake-me-up']];

/**
 * 过渡：玩一玩（tier 0）随便推；挑战时：等到新一句的第 1 拍开始推，在这一句里推完；
 * 银、金还要两边的低音别撞在一起（推过去之前先把 B 的低音关掉，推完再换过来——打碟里叫“换低音”）；金不给看小节数，一句是 8 小节。
 */
function transition(spec, env) {
  const free = !env.tier;
  const phrase = free ? 4 : byTier(env.tier, [4, 4, 8]);
  const needBass = !free && env.tier >= 2;
  const showBars = free || env.tier <= 2;
  const need = spec.need || (free ? 0 : byTier(env.tier, [1, 1, 2]));
  let pairAt = Math.floor(Math.random() * MIX_PAIRS.length);
  let mix = null;
  let log = [];
  let right = 0;
  let wrong = 0;
  let over = false;
  const cnt = counter({ phrase, showBars });
  const clashPill = h('span', { class: 'cl-low-clash' }, '⚠ 低频相撞');
  const syncMixHud = () => {
    if (!mix) return;
    const lv = mix.levels();
    const playing = !!mix.player.playing;
    meter.children[0].style.width = `${Math.round(lv.deck[0] * 100)}%`;
    meter.children[1].style.width = `${Math.round(lv.deck[1] * 100)}%`;
    decks[0].el.classList.toggle('live', playing && lv.deck[0] > 0.08);
    decks[1].el.classList.toggle('live', playing && lv.deck[1] > 0.08);
    clashPill.classList.toggle('on', playing && lv.low[0] > 0.45 && lv.low[1] > 0.45);
  };
  const deckBox = (i) => {
    const low = h('button', { class: 'btn cl-low on', type: 'button' }, '低音：开');
    low.addEventListener('click', () => {
      const on = !mix.low[i];
      mix.setLow(i, on);
      low.classList.toggle('on', on);
      low.textContent = on ? '低音：开' : '低音：关';
      syncMixHud();
      env.touched();
    });
    const name = h('b', {});
    const sub = h('span', {});
    return { el: h('div', { class: 'cl-deck' }, h('i', { class: 'cl-platter' }, 'AB'[i]), h('div', {}, name, sub), low), name, sub, low };
  };
  const decks = [deckBox(0), deckBox(1)];
  const fader = h('input', { class: 'cl-range cl-xfader', type: 'range', min: 0, max: 1000, value: 0, 'aria-label': '推子：A ↔ B' });
  const faderWrap = h('div', { class: 'cl-xfader-wrap' }, h('i', { class: 'cl-xfader-mid', 'aria-hidden': 'true' }), fader);
  const play = h('button', { class: 'btn primary lg cl-play', type: 'button' }, '▶ 放 A');
  const swap = h('button', { class: 'btn', type: 'button' }, '换一对歌');
  const note = h('div', { class: 'cl-note' });
  const lamps = h('div', { class: 'cl-lamps' });
  const meter = h('div', { class: 'cl-xmeter' }, h('i', { class: 'a' }), h('i', { class: 'b' }));
  const paintLamps = () => lamps.replaceChildren(...Array.from({ length: need }, (_, i) => h('i', { class: i < right ? 'on' : '' })));

  const setupPair = () => {
    mix?.destroy();
    const [a, b] = MIX_PAIRS[pairAt % MIX_PAIRS.length];
    mix = new Mixer(a, b);
    [a, b].forEach((id, i) => {
      decks[i].name.textContent = title(id);
      decks[i].sub.textContent = `${SONG_PARTS[id].bpm} BPM${i ? ` → 跟着 A 放成 ${SONG_PARTS[a].bpm}` : ''} · ${keyName(id)}`;
      decks[i].low.classList.add('on');
      decks[i].low.textContent = '低音：开';
    });
    fader.value = '0';
    log = [];
    over = false;
    syncMixHud();
    // 听到的是第几步：一小节 16 步，绕回来一次就是下一小节
    let laps = 0;
    let lastS = -1;
    mix.player.onStep((s) => {
      if (s < 0) {
        laps = 0;
        lastS = -1;
        syncMixHud();
        return cnt.set(-1);
      }
      if (s < lastS) laps++;
      lastS = s;
      cnt.set(laps * 16 + s);
    });
    mix.onBeat = (g) => {
      const lv = mix.levels();
      log.push({ g, f: mix.fader, low: lv.low });
      syncMixHud();
      if (!free && !over) watchAttempt();
    };
    note.innerHTML = rich(free ? '点「放 A」。推子在 A 这头；往右推，B 慢慢进来。两边的“低音”开关试试关一下。'
      : `点「放 A」。等到**新一句的第 1 拍**（第 1、${phrase + 1}、${phrase * 2 + 1}…小节）再开始推，**这一句之内**推到 B 那头。${needBass ? '两边的低音不能撞：推之前先把 **B 的低音关掉**，推完再开 B、关 A。' : ''}`);
  };

  // 挑战：从推子离开 A 那头起看，推完（到 B 那头待满 1 小节）或者过了很久就判
  function watchAttempt() {
    const startI = log.findIndex((x) => x.f > 0.08);
    if (startI < 0) {
      if (log.length > 4 * 40) {
        over = true;
        fail('放了很久还没开始推。下一轮早点动手。');
      }
      return;
    }
    const endI = log.findIndex((x, i) => i > startI && x.f >= 0.92);
    const last = log[log.length - 1];
    const tooLong = log.length - startI > 4 * (phrase * 2 + 2);
    if (endI < 0 || log.length - endI < 4 || (!tooLong && last.f < 0.92)) {
      if (tooLong) {
        over = true;
        fail('推得太慢了：一句之内要推完。');
      }
      return;
    }
    over = true;
    const startStep = log[startI].g;
    const P = phrase * 16;
    const boundary = Math.round(startStep / P) * P;
    const offBeats = (startStep - boundary) / 4;
    const endStep = log[endI].g;
    const clash = log.slice(startI, endI + 1).filter((x) => x.low[0] > 0.45 && x.low[1] > 0.45).length; // 撞了几拍
    const probs = [];
    if (boundary === 0) probs.push('一开头就推了：要等 A 放完一句');
    else if (Math.abs(offBeats) > 1) probs.push(`开始推的那一下离新一句的第 1 拍${offBeats < 0 ? '早' : '晚'}了 ${Math.abs(Math.round(offBeats))} 拍`);
    if (endStep > boundary + P + 4) probs.push('这一句之内没推完');
    if (needBass && clash > 1) probs.push(`两边的低音撞了 ${clash} 拍（推的时候总有一边的低音要关着）`);
    if (probs.length) return fail(`${probs.join('；')}。`);
    right++;
    sfx.play('ok');
    paintLamps();
    const s = Math.abs(offBeats) <= 0.5 && (!needBass || clash === 0) ? 3 : 2;
    if (right >= need) {
      env.done(wrong ? Math.min(s, starsByWrong(wrong)) : s);
      confetti(lamps, 18);
      note.innerHTML = rich(`✓ 从第 ${boundary / 16 + 1} 小节推进来，${Math.round((endStep - startStep) / 16)} 小节推完${needBass ? '，低音没撞' : ''}。干净。`);
      note.append(passLine('过关。', () => { right = 0; wrong = 0; paintLamps(); stopMix(); pairAt++; setupPair(); }));
    } else {
      note.innerHTML = rich('✓ 这一次干净。换一对歌再来一次。');
      setTimeout(() => {
        stopMix();
        pairAt++;
        setupPair();
      }, 1800);
    }
  }

  function fail(why) {
    wrong++;
    sfx.play('nope');
    note.innerHTML = rich(`${why}点「放 A」重来。`);
    stopMix();
  }

  const stopMix = () => {
    mix?.stop();
    play.textContent = '▶ 放 A';
    cnt.set(-1);
    syncMixHud();
  };
  play.addEventListener('click', async () => {
    if (mix.player.playing) return stopMix();
    // 每次重放：推子回到 A，低音都开，记录清空
    fader.value = '0';
    mix.setFader(0);
    mix.setLow(0, true);
    mix.setLow(1, true);
    decks.forEach((d) => {
      d.low.classList.add('on');
      d.low.textContent = '低音：开';
    });
    log = [];
    over = false;
    await mix.start();
    play.textContent = '■ 停';
    syncMixHud();
    env.touched();
  });
  fader.addEventListener('input', () => {
    mix.setFader(Number(fader.value) / 1000);
    syncMixHud();
    env.touched();
  });
  swap.addEventListener('click', () => {
    stopMix();
    pairAt++;
    setupPair();
  });
  setupPair();
  paintLamps();
  const el = h('div', { class: 'cl-toy cl-dj cl-mixer' },
    h('div', { class: 'cl-row' }, play, swap, showBars && clashPill, h('span', { class: 'spacer' }), showBars ? cnt.el : h('div', { class: 'cl-dj-blind sm' }, '这一档不给看小节数'), !free && lamps),
    h('div', { class: 'cl-decks' }, decks[0].el, decks[1].el),
    h('div', { class: 'cl-xrow' }, h('b', {}, 'A'), faderWrap, h('b', {}, 'B')),
    meter, note);
  return {
    el,
    get __mix() {
      return mix;
    },
    destroy() {
      mix?.destroy();
    },
  };
}

// ───────────── D5 对拍 ─────────────

/**
 * 两台：A 一直放着（124 BPM），B 的速度不一样。用 −/+ 把 B 调到和 A 一样快，再用“往前 / 往后推一下”把两个底鼓对齐。
 * 铜：看得见两边的 BPM；银：看不见数，只有一个“差多少”的指针；金：什么都不给看，只能听两个底鼓是不是叠成了一下。
 */
function beatmatch(spec, env) {
  const free = !env.tier;
  const need = spec.need || (free ? 0 : byTier(env.tier, [1, 2, 2]));
  const tempoTol = free ? 0.6 : byTier(env.tier, [0.6, 0.6, 0.3]);
  const phaseTol = free ? 50 : byTier(env.tier, [Infinity, 50, 35]);
  const showNums = free || env.tier <= 1;
  const showDrift = free || env.tier <= 2;
  const A = new LoopPlayer({ bpm: spec.bpm || 124 }).set({ KICK: 'x---x---x---x---', HAT2: '--x---x---x---x-' });
  const B = new LoopPlayer({ bpm: 124 }).set({ KICK: 'x---x---x---x---', CLAP: '----x-------x---' });
  let kA = [];
  let kB = [];
  A.onSchedule = (s, t) => s % 4 === 0 && (kA.push(t), kA.length > 8 && kA.shift());
  B.onSchedule = (s, t) => s % 4 === 0 && (kB.push(t), kB.length > 8 && kB.shift());
  let right = 0;
  let wrong = 0;
  let raf = 0;
  const lamps = h('div', { class: 'cl-lamps' });
  const numA = h('b', {}, String(A.bpm));
  const numB = h('b', {});
  const drift = h('div', { class: 'cl-drift' }, h('i', { class: 'mid' }), h('i', { class: 'dot' }), h('span', { class: 'l' }, 'B 早'), h('span', { class: 'r' }, 'B 晚'));
  const note = h('div', { class: 'cl-note' });
  const paintLamps = () => lamps.replaceChildren(...Array.from({ length: need }, (_, i) => h('i', { class: i < right ? 'on' : '' })));
  const fmt = (v) => (Math.round(v * 10) / 10).toFixed(1);

  /** B 比 A 差多少（毫秒，正 = B 晚） */
  function phase() {
    if (!kA.length || !kB.length) return 0;
    const beat = 60 / A.bpm;
    const tb = kB[kB.length - 1];
    const ta = kA.reduce((a, b) => (Math.abs(b - tb) < Math.abs(a - tb) ? b : a));
    let d = (tb - ta) % beat;
    if (d > beat / 2) d -= beat;
    if (d < -beat / 2) d += beat;
    return d * 1000;
  }

  function newRound() {
    const off = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.round(Math.random() * 6) / 2);
    B.bpm = A.bpm + off;
    numB.textContent = fmt(B.bpm);
    note.innerHTML = rich(free ? '点「放」。两个底鼓会一会儿叠在一起、一会儿错开（“咚咚”）：那就是速度不一样。用 −/+ 调 B。'
      : `B 的速度不对。用 −/+ 调 B，再用“推一下”把两个底鼓叠成一下，然后点「对上了」。${showNums ? '' : '这一档不给看 BPM。'}`);
  }

  const tick = () => {
    const p = phase();
    drift.querySelector('.dot').style.left = `${50 + clamp(p / 250, -0.5, 0.5) * 100}%`;
    raf = requestAnimationFrame(tick);
  };
  const playing = () => A.playing;
  const playBtn = h('button', { class: 'btn primary lg cl-play', type: 'button' }, '▶ 放');
  playBtn.addEventListener('click', async () => {
    if (playing()) {
      A.stop();
      B.stop();
      cancelAnimationFrame(raf);
      playBtn.textContent = '▶ 放';
      return;
    }
    kA = [];
    kB = [];
    await A.start();
    setTimeout(() => B.start(), 120 + Math.random() * 200); // B 不是同时进来的：一开始就错开一点
    raf = requestAnimationFrame(tick);
    playBtn.textContent = '■ 停';
    env.touched();
  });
  const bump = (d) => {
    B.bpm = Math.round((B.bpm + d) * 10) / 10;
    numB.textContent = fmt(B.bpm);
    env.touched();
  };
  const nudge = (sec) => {
    if (!B.playing) return;
    B.nextTime += sec;
    env.touched();
  };
  const check = h('button', { class: 'btn primary', type: 'button' }, '对上了');
  check.addEventListener('click', () => {
    if (!playing()) return (note.textContent = '先点「放」。');
    const dt = B.bpm - A.bpm;
    const p = phase();
    const okT = Math.abs(dt) <= tempoTol;
    const okP = Math.abs(p) <= phaseTol;
    if (free) {
      note.innerHTML = rich(`B 比 A ${Math.abs(dt) < 0.05 ? '一样快' : `${dt > 0 ? '快' : '慢'} ${fmt(Math.abs(dt))} BPM`}，两个底鼓差 ${Math.round(Math.abs(p))} 毫秒。${okT && Math.abs(p) <= 50 ? '对上了，叠成了一下。' : ''}`);
      return;
    }
    if (okT && okP) {
      right++;
      sfx.play('ok');
      paintLamps();
      const msg = `✓ 速度差 ${fmt(Math.abs(dt))} BPM${Number.isFinite(phaseTol) ? `，两个底鼓差 ${Math.round(Math.abs(p))} 毫秒` : ''}。`;
      if (right >= need) {
        env.done(wrong === 0 && Math.abs(dt) <= 0.2 ? 3 : wrong <= 1 ? 2 : 1);
        confetti(lamps, 18);
        note.innerHTML = rich(msg);
        note.append(passLine('过关。', () => { right = 0; wrong = 0; paintLamps(); newRound(); }));
      } else {
        note.innerHTML = rich(`${msg}再来一首。`);
        newRound();
      }
    } else {
      wrong++;
      sfx.play('nope');
      note.innerHTML = rich(!okT ? `还没对上：B ${dt > 0 ? '快了' : '慢了'}${showNums ? ` ${fmt(Math.abs(dt))} BPM` : ''}。听：两个底鼓是越离越远，还是越靠越近？` : `速度对了，可两个底鼓还差 ${Math.round(Math.abs(p))} 毫秒（B ${p > 0 ? '晚' : '早'}）。用“推一下”。`);
    }
  });
  newRound();
  paintLamps();
  const el = h('div', { class: 'cl-toy cl-dj cl-match2' },
    h('div', { class: 'cl-row' }, playBtn, h('span', { class: 'spacer' }), !free && lamps),
    h('div', { class: 'cl-decks' },
      h('div', { class: 'cl-deck' }, h('i', {}, 'A'), h('div', {}, h('b', {}, '一直放着'), h('span', {}, '底鼓 + 开镲')), showNums ? h('div', { class: 'cl-bpm' }, numA, h('small', {}, 'BPM')) : null),
      h('div', { class: 'cl-deck' }, h('i', {}, 'B'), h('div', {}, h('b', {}, '要你调的'), h('span', {}, '底鼓 + 拍手')), showNums ? h('div', { class: 'cl-bpm' }, numB, h('small', {}, 'BPM')) : null)),
    h('div', { class: 'cl-row cl-bmrow' },
      h('span', { class: 'cl-cap' }, 'B 的速度'),
      h('button', { class: 'btn', type: 'button', onclick: () => bump(-0.5) }, '− 慢一点'),
      h('button', { class: 'btn', type: 'button', onclick: () => bump(-0.1) }, '−0.1'),
      h('button', { class: 'btn', type: 'button', onclick: () => bump(0.1) }, '+0.1'),
      h('button', { class: 'btn', type: 'button', onclick: () => bump(0.5) }, '+ 快一点')),
    h('div', { class: 'cl-row cl-bmrow' },
      h('span', { class: 'cl-cap' }, 'B 推一下'),
      h('button', { class: 'btn', type: 'button', onclick: () => nudge(-0.02) }, '◀ 往前'),
      h('button', { class: 'btn', type: 'button', onclick: () => nudge(0.02) }, '往后 ▶'),
      h('span', { class: 'spacer' }), check),
    showDrift ? drift : h('div', { class: 'cl-dj-blind sm' }, '这一档不给看：听两个底鼓是不是叠成了一下'),
    note);
  return {
    el,
    get __b() {
      return { A, B, phase };
    },
    destroy() {
      cancelAnimationFrame(raf);
      A.stop();
      B.stop();
    },
  };
}

// ───────────── D6 调性 ─────────────

const KEY_A = ['wake-me-up', 'faded', 'levels', 'believer', 'lean-on'];
const KEY_B = ['levels', 'faded', 'starboy', 'wake-me-up', 'believer', 'shape-of-you', 'lean-on', 'something-just-like-this', 'levitating'];

/**
 * A 放和弦和贝斯，B 放另一首歌的旋律，B 的调可以一格一格（半音）挪。挪到“不打架”（B 的音全落在 A 那把梯子上）就对了。
 * 铜：看得见“打架的音有几个”；银：看不见，答错了才告诉你；金：什么都不说。
 * 原来叫 keymatch，和乐理线 T14 的玩具（theory-toys.js）重了名：总表里后展开的盖掉前面的，D6 摆出来的一直是 T14 那个。
 * 2026-11-18 改叫 keyclash；tools/toy-check.mjs 的 shadowed 看的就是这种重名。
 */
function keyclash(spec, env) {
  const free = !env.tier;
  const need = spec.need || (free ? 0 : byTier(env.tier, [1, 2, 3]));
  const showMeter = free || env.tier <= 1;
  let a = 'wake-me-up';
  let b = 'levels';
  let shift = 0;
  let count = 0;
  let right = 0;
  let wrong = 0;
  const player = new LoopPlayer({ bpm: 120, steps: 16 });
  let evA = [];
  let evB = [];
  let lenA = 64;
  let lenB = 64;
  let mute = { a: false, b: false };
  player.onSchedule = (step, t) => {
    const g = count++;
    const stepSec = 60 / player.bpm / 4;
    const sa = g % lenA;
    const sb = g % lenB;
    if (!mute.a) for (const byStep of evA) for (const e of byStep[sa]) for (const m of e.midis || []) audio.note(m, t, e.len * stepSec * 0.92, { voice: e.voice, vel: e.vel * 0.9 });
    if (!mute.a && sa % 4 === 0) audio.drum('KICK', t, 0.7);
    if (!mute.b) for (const byStep of evB) for (const e of byStep[sb]) for (const m of e.midis || []) audio.note(m + shift, t, e.len * stepSec * 0.92, { voice: 'lead', vel: 0.8 });
  };
  const lamps = h('div', { class: 'cl-lamps' });
  const meter = h('div', { class: 'cl-clash' });
  const shiftNum = h('b', {});
  const nameA = h('b', {});
  const nameB = h('b', {});
  const subA = h('span', {});
  const subB = h('span', {});
  const note = h('div', { class: 'cl-note' });
  const paintLamps = () => lamps.replaceChildren(...Array.from({ length: need }, (_, i) => h('i', { class: i < right ? 'on' : '' })));

  /** A 那把梯子上的 12 个音名里有哪几个 */
  const ladder = () => {
    const s = SONG_PARTS[a];
    return new Set(SCALES[s.scale].offsets.map((o) => (o + s.key) % 12));
  };
  /** B 的旋律（挪过之后）用到的音名里，有几个不在 A 的梯子上 */
  const clashes = (sh = shift) => {
    const L = ladder();
    const pcs = new Set(evB.flatMap((byStep) => byStep.flatMap((list) => list.flatMap((e) => (e.midis || []).map((m) => (((m + sh) % 12) + 12) % 12)))));
    return [...pcs].filter((pc) => !L.has(pc)).length;
  };

  function load() {
    const sa = SONG_PARTS[a];
    const sb = SONG_PARTS[b];
    player.bpm = sa.bpm;
    lenA = sa.bars * 16;
    lenB = sb.bars * 16;
    evA = sa.parts.filter((p) => p.layer === 'chords' || p.layer === 'bass').map((p) => partEvents(sa, p));
    const lead = sb.parts.find((p) => p.layer === 'lead') || sb.parts.find((p) => p.layer === 'chords');
    evB = [partEvents(sb, lead)];
    nameA.textContent = title(a);
    subA.textContent = `和弦 + 贝斯 · ${keyName(a)}`;
    nameB.textContent = title(b);
    subB.textContent = `旋律 · 原来是 ${keyName(b)}`;
    paint();
  }
  function paint() {
    shiftNum.textContent = shift === 0 ? '原调' : `${shift > 0 ? '+' : ''}${shift} 格`;
    const n = clashes();
    meter.replaceChildren(h('span', {}, '打架的音'), ...Array.from({ length: 7 }, (_, i) => h('i', { class: i < n ? 'on' : '' })), h('b', {}, n ? `${n} 个` : '不打架'));
  }
  function newRound() {
    const pairs = [];
    for (const x of KEY_A) for (const y of KEY_B) if (x !== y) pairs.push([x, y]);
    for (let tries = 0; tries < 30; tries++) {
      [a, b] = pick(pairs);
      load();
      const bad = [];
      for (let s = -5; s <= 6; s++) if (clashes(s) > 0) bad.push(s);
      if (bad.length >= 6 && bad.length < 12) {
        shift = pick(bad.filter((s) => Math.abs(s) >= 1));
        break;
      }
    }
    paint();
    note.innerHTML = rich(free ? '点「放」。B 的旋律和 A 的和弦打架时，会有几个音听着“酸”。按 −/+ 一格一格挪 B，挪到不打架。'
      : `B 的旋律和 A 不在一个调上。一格一格挪 B，挪到**不打架**，点「不打架了」。${showMeter ? '' : '这一档不给看打架的音有几个。'}`);
  }
  const playBtn = h('button', { class: 'btn primary lg cl-play', type: 'button' }, '▶ 放');
  playBtn.addEventListener('click', () => {
    if (player.playing) {
      player.stop();
      playBtn.textContent = '▶ 放';
      return;
    }
    count = 0;
    player.start();
    playBtn.textContent = '■ 停';
    env.touched();
  });
  const solo = (which) => {
    mute = which === 'a' ? { a: false, b: true } : which === 'b' ? { a: true, b: false } : { a: false, b: false };
    env.touched();
  };
  const soloSeg = segmented(
    [['a', '只听 A'], ['b', '只听 B'], ['ab', '一起']].map(([value, label]) => ({ value, label })),
    'ab',
    (which) => solo(which),
  );
  soloSeg.classList.add('cl-seg');
  const move = (d) => {
    shift = clamp(shift + d, -6, 6);
    paint();
    env.touched();
  };
  const check = h('button', { class: 'btn primary', type: 'button' }, free ? '现在打架吗？' : '不打架了');
  check.addEventListener('click', () => {
    const n = clashes();
    if (free) {
      note.innerHTML = rich(n ? `还有 **${n}** 个音不在 A 那把梯子上。` : '不打架：B 的每个音都落在 A 那把梯子上。');
      return;
    }
    if (!n) {
      right++;
      sfx.play('ok');
      paintLamps();
      if (right >= need) {
        env.done(starsByWrong(wrong));
        confetti(lamps, 18);
        note.innerHTML = rich(`✓ 挪了 ${shift > 0 ? '+' : ''}${shift} 格，不打架了。`);
        note.append(passLine('过关。', () => { right = 0; wrong = 0; paintLamps(); newRound(); }));
      } else {
        note.innerHTML = rich(`✓ 挪了 ${shift > 0 ? '+' : ''}${shift} 格，不打架了。换一对。`);
        newRound();
      }
    } else {
      wrong++;
      sfx.play('nope');
      note.innerHTML = rich(env.tier >= 3 ? '还在打架。' : `还有 **${n}** 个音在打架。`);
    }
  });
  newRound();
  paintLamps();
  const el = h('div', { class: 'cl-toy cl-dj cl-keym' },
    h('div', { class: 'cl-row' }, playBtn,
      soloSeg,
      h('span', { class: 'spacer' }), !free && lamps),
    h('div', { class: 'cl-decks' },
      h('div', { class: 'cl-deck' }, h('i', {}, 'A'), h('div', {}, nameA, subA)),
      h('div', { class: 'cl-deck' }, h('i', {}, 'B'), h('div', {}, nameB, subB))),
    h('div', { class: 'cl-row cl-bmrow' },
      h('span', { class: 'cl-cap' }, 'B 的调'),
      h('button', { class: 'btn', type: 'button', onclick: () => move(-1) }, '− 低一格'),
      h('div', { class: 'cl-big' }, shiftNum),
      h('button', { class: 'btn', type: 'button', onclick: () => move(1) }, '+ 高一格'),
      h('span', { class: 'spacer' }), check),
    showMeter ? meter : h('div', { class: 'cl-dj-blind sm' }, '这一档不给看：用耳朵听哪几个音“酸”'),
    note);
  return {
    el,
    get __k() {
      return { clashes, get shift() { return shift; }, move };
    },
    destroy: () => player.stop(),
  };
}

export const DJ_TOYS = { phrasecount, phrasecatch, dropview, dropcatch, energymap, energyorder, transition, beatmatch, keyclash };
