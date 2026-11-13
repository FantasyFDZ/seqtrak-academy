// SEQTRAK 的 11 条轨道，以及它们在应用里的名字、颜色和 MIDI 通道。
// MIDI 通道以 docs/seqtrak-midi-reference.md 为准。
// 颜色写的是 CSS 变量（app.css 里的 --t-KICK …），两套配色各有一组值：放进样式里直接能用；画布不认 var()，要先过一遍 theme.resolve()。

export const TRACKS = [
  { id: 'KICK', label: 'KICK', name: '底鼓', kind: 'drum', ch: 1, color: 'var(--t-KICK)' },
  { id: 'SNARE', label: 'SNARE', name: '军鼓', kind: 'drum', ch: 2, color: 'var(--t-SNARE)' },
  { id: 'CLAP', label: 'CLAP', name: '拍手', kind: 'drum', ch: 3, color: 'var(--t-CLAP)' },
  { id: 'HAT1', label: 'HAT 1', name: '闭镲', kind: 'drum', ch: 4, color: 'var(--t-HAT1)' },
  { id: 'HAT2', label: 'HAT 2', name: '开镲', kind: 'drum', ch: 5, color: 'var(--t-HAT2)' },
  { id: 'PERC1', label: 'PERC 1', name: '打击乐 1', kind: 'drum', ch: 6, color: 'var(--t-PERC1)' },
  { id: 'PERC2', label: 'PERC 2', name: '打击乐 2', kind: 'drum', ch: 7, color: 'var(--t-PERC2)' },
  { id: 'SYNTH1', label: 'SYNTH 1', name: '合成器 1', kind: 'synth', ch: 8, color: 'var(--t-SYNTH1)' },
  { id: 'SYNTH2', label: 'SYNTH 2', name: '合成器 2', kind: 'synth', ch: 9, color: 'var(--t-SYNTH2)' },
  { id: 'DX', label: 'DX', name: 'FM 合成器', kind: 'synth', ch: 10, color: 'var(--t-DX)' },
  { id: 'SAMPLER', label: 'SAMPLER', name: '采样器', kind: 'sampler', ch: 11, color: 'var(--t-SAMPLER)' },
];

export const TRACK = Object.fromEntries(TRACKS.map((t) => [t.id, t]));
export const DRUM_TRACKS = TRACKS.filter((t) => t.kind === 'drum');
export const trackByChannel = (ch) => TRACKS.find((t) => t.ch === ch) || null;

/** 没接机器时，用电脑键盘代替：按轨道数量分配顺手的键位。 */
export function laneKeys(n) {
  const layouts = {
    1: ['j'],
    2: ['f', 'j'],
    3: ['f', 'j', 'k'],
    4: ['d', 'f', 'j', 'k'],
    5: ['s', 'd', 'f', 'j', 'k'],
    6: ['s', 'd', 'f', 'j', 'k', 'l'],
    7: ['a', 's', 'd', 'f', 'j', 'k', 'l'],
    8: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';'],
  };
  return layouts[Math.min(8, Math.max(1, n))];
}

/** 旋律轨道的颜色：同一条轨道里按音高从低到高，由绿渐变到蓝。亮度跟配色走（--pitch-l）。 */
export function pitchColor(index, count) {
  const hue = 150 + (count > 1 ? (index / (count - 1)) * 70 : 0);
  return `hsl(${hue} 68% var(--pitch-l))`;
}
