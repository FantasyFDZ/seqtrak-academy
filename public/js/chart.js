// 谱面：把作者友好的写法（节奏串、音符表）展开成音游引擎用的目标列表。
//
// 作者写法：
//   {
//     id, title, bpm, bars, loops,
//     lanes:   { KICK: 'x---x---x---x---' },          // 要你打的鼓
//     backing: { HAT1: '--x---x---x---x-' },          // 自动播放的伴奏
//     melody:  { voice: 'bass', track: 'SYNTH1', notes: [[0, 'C1', 2], [4, 'C1', 2]] },   // 要你弹的音：[第几步, 音名, 持续几步]
//     chords:  { voice: 'keys', track: 'SYNTH2', scale: { scale: 0, key: 0 }, hits: [[0, 1, 8], [8, 6, 8]] },
//                                                     // 要你按的和弦：[第几步, 第几个 Synth key, 持续几步]。机器要在 CHORD 状态
//     backingMelody: { voice: 'pad', notes: [...] },
//     swing: 0..0.5,
//   }
// 节奏串：每小节 16 个字符。x = 有音，X = 重音，- = 空。可以用 | 或空格分组，展开时会去掉。

import { TRACK, laneKeys, pitchColor } from './tracks.js';
import { nameToMidi, midiToName } from './audio.js';
import { SCALES, chordNotes, chordName } from './scales.js';

export const STEPS_PER_BAR = 16;
export const BEATS_PER_BAR = 4;

export function cleanPattern(p) {
  return String(p || '').replace(/[\s|]/g, '');
}

/** 第 step 步（从 0 起）落在第几拍，swing 会把每对 16 分音符里的后一个往后推。 */
export function stepToBeat(step, swing = 0) {
  const pair = Math.floor(step / 2);
  return pair * 0.5 + (step % 2 ? 0.25 * (1 + swing) : 0);
}

export function patternSteps(pattern) {
  const out = [];
  const p = cleanPattern(pattern);
  for (let i = 0; i < p.length; i++) {
    if (p[i] === 'x' || p[i] === 'X') out.push({ step: i, accent: p[i] === 'X' });
  }
  return out;
}

export function normalizeChart(def) {
  const bars = def.bars || 1;
  const loops = def.loops || 1;
  const swing = def.swing || 0;
  const stepsPerLoop = bars * STEPS_PER_BAR;
  const beatsPerLoop = bars * BEATS_PER_BAR;

  const lanes = [];
  const loopTargets = []; // 一圈内的目标
  const loopBacking = [];

  // 鼓轨
  for (const [trackId, pattern] of Object.entries(def.lanes || {})) {
    const track = TRACK[trackId];
    if (!track) continue;
    const laneIndex = lanes.length;
    lanes.push({ id: trackId, label: track.label, name: track.name, color: track.color, kind: 'drum', track: trackId });
    for (const { step, accent } of patternSteps(pattern)) {
      if (step >= stepsPerLoop) continue;
      loopTargets.push({ step, beat: stepToBeat(step, swing), lane: laneIndex, vel: accent ? 1 : 0.82, kind: 'drum', sound: trackId });
    }
  }

  // 旋律轨：每个不同的音高占一条 lane
  if (def.melody?.notes?.length) {
    const notes = def.melody.notes.map(([step, name, len = 1]) => ({ step, midi: typeof name === 'number' ? name : nameToMidi(name), len }));
    const pitches = [...new Set(notes.map((n) => n.midi))].sort((a, b) => a - b);
    const first = lanes.length;
    // 如果谱面注明了音阶和调，就能算出每个音在机器上是第几个 Synth key
    const sk = def.melody.scale;
    const offsets = sk ? SCALES[sk.scale]?.offsets.map((o) => (o + sk.key) % 12) : null;
    pitches.forEach((midi, i) => {
      const degree = offsets ? offsets.indexOf(((midi % 12) + 12) % 12) + 1 : 0;
      lanes.push({ id: `P${midi}`, label: midiToName(midi), name: degree ? `Synth key ${degree}` : '', color: pitchColor(i, pitches.length), kind: 'pitch', midi, track: def.melody.track || 'SYNTH1' });
    });
    for (const n of notes) {
      if (n.step >= stepsPerLoop) continue;
      loopTargets.push({
        step: n.step,
        beat: stepToBeat(n.step, swing),
        lenBeats: n.len / 4,
        lane: first + pitches.indexOf(n.midi),
        vel: 0.9,
        kind: 'note',
        midi: n.midi,
        voice: def.melody.voice || 'bass',
      });
    }
  }

  // 和弦轨：用到的每个 Synth key 占一条 lane，从左到右就是键 1 → 键 7，和机器上的顺序一样
  if (def.chords?.hits?.length) {
    const sk = { ...(def.chords.scale || { scale: 0, key: 0 }), octave: def.chords.octave ?? 0 };
    const degrees = [...new Set(def.chords.hits.map(([, k]) => k))].sort((a, b) => a - b);
    const first = lanes.length;
    const chordOf = Object.fromEntries(degrees.map((k) => [k, chordNotes(k, sk)]));
    degrees.forEach((k, i) => {
      const notes = chordOf[k];
      lanes.push({ id: `C${k}`, label: `${k} · ${chordName(notes)}`, name: `Synth key ${k}`, color: pitchColor(i, degrees.length), kind: 'chord', degree: k, notes, midi: notes[0], track: def.chords.track || 'SYNTH2' });
    });
    for (const [step, k, len = 1] of def.chords.hits) {
      if (step >= stepsPerLoop) continue;
      loopTargets.push({
        step,
        beat: stepToBeat(step, swing),
        lenBeats: len / 4,
        lane: first + degrees.indexOf(k),
        vel: 0.9,
        kind: 'chord',
        notes: chordOf[k],
        voice: def.chords.voice || 'keys',
      });
    }
  }

  for (const [trackId, pattern] of Object.entries(def.backing || {})) {
    for (const { step, accent } of patternSteps(pattern)) {
      if (step >= stepsPerLoop) continue;
      loopBacking.push({ step, beat: stepToBeat(step, swing), kind: 'drum', sound: trackId, vel: accent ? 0.95 : 0.75 });
    }
  }
  for (const [step, name, len = 1] of def.backingMelody?.notes || []) {
    if (step >= stepsPerLoop) continue;
    loopBacking.push({
      step,
      beat: stepToBeat(step, swing),
      kind: 'note',
      midi: typeof name === 'number' ? name : nameToMidi(name),
      lenBeats: len / 4,
      voice: def.backingMelody.voice || 'pad',
      vel: 0.7,
    });
  }

  const keys = laneKeys(lanes.length);
  lanes.forEach((lane, i) => (lane.key = keys[i] || ''));

  const targets = [];
  const backing = [];
  for (let l = 0; l < loops; l++) {
    const offset = l * beatsPerLoop;
    for (const t of loopTargets) targets.push({ ...t, beat: t.beat + offset, loop: l, id: targets.length });
    for (const b of loopBacking) backing.push({ ...b, beat: b.beat + offset });
  }
  targets.sort((a, b) => a.beat - b.beat || a.lane - b.lane);
  backing.sort((a, b) => a.beat - b.beat);

  // 同一条 lane 上相邻目标的最小间隔（拍），用来收紧判定窗口
  let minGapBeats = Infinity;
  const lastBeat = new Map();
  for (const t of targets) {
    if (lastBeat.has(t.lane)) minGapBeats = Math.min(minGapBeats, t.beat - lastBeat.get(t.lane));
    lastBeat.set(t.lane, t.beat);
  }

  return {
    id: def.id || 'chart',
    title: def.title || '',
    bpm: def.bpm || 100,
    bars,
    loops,
    swing,
    stepsPerLoop,
    beatsPerLoop,
    totalBeats: beatsPerLoop * loops,
    lanes,
    targets,
    backing,
    loopTargets,
    loopBacking,
    minGapBeats: Number.isFinite(minGapBeats) ? minGapBeats : 4,
    def,
  };
}

/** AI 出的练习（lanes 是数组）转成作者写法。 */
export function drillToChartDef(drill) {
  const lanes = {};
  for (const lane of drill.lanes) lanes[lane.track] = lane.pattern;
  return { id: `drill-${Date.now().toString(36)}`, title: drill.title, bpm: drill.bpm, bars: drill.bars, loops: drill.bars === 1 ? 4 : 2, lanes };
}
