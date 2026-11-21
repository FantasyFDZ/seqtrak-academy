// 频谱：画面里跟着鼓声跳的那一排条，是从真的音频里算出来的（不是按谱编的）。
// 离线渲染完整首音频之后（main.js 的 renderAudio），每一帧（1/60 秒）对那一刻做一次 FFT，切成 64 段
// （30 Hz–14 kHz，按对数分），存成 promo/out/spectrum.bin：一帧 64 个字节，0–255。画面加载它，按时间取。
// 没有这个文件（还没渲过音频）的时候退回一个按底鼓编的假频谱，预览照样能看。
import { SCORE } from './score.js';
import { FPS, clamp } from './time.js';

export const BANDS = 64;
const N = 4096;
const LO = 30;
const HI = 14000;

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

/** 整首音频 → 每帧 64 段的频谱（Uint8Array，帧数 × 64） */
export function analyze(buf, fps = FPS) {
  const sr = buf.sampleRate;
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(Math.min(1, buf.numberOfChannels - 1));
  const frames = Math.ceil((buf.length / sr) * fps);
  const out = new Uint8Array(frames * BANDS);
  const win = Float32Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  const edges = Array.from({ length: BANDS + 1 }, (_, i) => LO * (HI / LO) ** (i / BANDS));
  const binHz = sr / N;
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const prev = new Float32Array(BANDS);
  for (let f = 0; f < frames; f++) {
    const c = Math.round((f / fps) * sr);
    for (let i = 0; i < N; i++) {
      const k = c - N / 2 + i;
      re[i] = k >= 0 && k < L.length ? ((L[k] + R[k]) / 2) * win[i] : 0;
      im[i] = 0;
    }
    fft(re, im);
    for (let b = 0; b < BANDS; b++) {
      const b0 = Math.max(1, Math.floor(edges[b] / binHz));
      const b1 = Math.max(b0, Math.ceil(edges[b + 1] / binHz));
      let m = 0;
      for (let k = b0; k <= b1; k++) m = Math.max(m, Math.hypot(re[k], im[k]));
      const amp = m / (N / 4);
      const fc = Math.sqrt(edges[b] * edges[b + 1]);
      const db = 20 * Math.log10(amp + 1e-9) + Math.log2(fc / 1000) * 3; // 高频往上抬一点，整排看起来匀
      const v = clamp((db + 58) / 54);
      // 跳上去马上到，落下来慢一点
      prev[b] = Math.max(v, prev[b] * 0.86);
      out[f * BANDS + b] = Math.round(prev[b] * 255);
    }
  }
  return out;
}

let data = null;
/** 加载算好的频谱（没有就用假的） */
export async function loadSpectrum() {
  try {
    const r = await fetch('/promo/out/spectrum.bin', { cache: 'no-store' });
    if (r.ok) data = new Uint8Array(await r.arrayBuffer());
  } catch { /* 用假的 */ }
  return !!data;
}

const kicks = SCORE.drums.filter((d) => d.lane === 'KICK').map((d) => d.t);
const out = new Float32Array(BANDS);
/** 第 t 秒的频谱：64 个 0–1 */
export function spectrumAt(t) {
  if (data) {
    const f = Math.max(0, Math.min(data.length / BANDS - 1, Math.round(t * FPS)));
    for (let b = 0; b < BANDS; b++) out[b] = data[f * BANDS + b] / 255;
    return out;
  }
  // 假的：最近一下底鼓，低频高、往高频衰减
  let k = -9;
  for (const x of kicks) if (x <= t) k = x;
  const p = Math.exp(-(t - k) / 0.12);
  for (let b = 0; b < BANDS; b++) out[b] = clamp(p * Math.exp(-b / 14) * 0.9 + 0.04 * Math.sin(b * 1.3 + t * 7) ** 2);
  return out;
}

/**
 * 画一排频谱条。mode：
 *   bloom  从正中间往两边开（低频在中间），上下对称——开场用
 *   floor  贴着底边一排——Drop 用
 */
export function createSpectrum({ mode = 'bloom', width = 1700, height = 560, bars = BANDS - 8 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.className = `spectrum spectrum-${mode}`;
  const g = canvas.getContext('2d');
  let colors = null;
  return {
    el: canvas,
    draw(t, { gain = 1, alpha = 1 } = {}) {
      if (!colors) {
        const cs = getComputedStyle(canvas);
        colors = { a: cs.getPropertyValue('--accent').trim() || '#ff5f2e', b: cs.getPropertyValue('--yellow').trim() || '#ffcb1f' };
      }
      g.clearRect(0, 0, width, height);
      if (alpha <= 0.001) return;
      const s = spectrumAt(t);
      g.globalAlpha = alpha;
      const grad = g.createLinearGradient(0, mode === 'bloom' ? height / 2 : height, 0, 0);
      grad.addColorStop(0, colors.a);
      grad.addColorStop(1, colors.b);
      g.fillStyle = grad;
      g.shadowColor = colors.a;
      g.shadowBlur = 22;
      if (mode === 'bloom') {
        const step = width / 2 / bars;
        const bw = step * 0.56;
        const cy = height / 2;
        for (let i = 0; i < bars; i++) {
          const v = s[i] ** 1.4 * gain;
          const hh = Math.max(3, v * cy * 0.96);
          for (const side of [-1, 1]) {
            const x = width / 2 + side * (i + 0.5) * step - bw / 2;
            g.beginPath();
            g.roundRect(x, cy - hh, bw, hh * 2, bw / 2);
            g.fill();
          }
        }
      } else {
        const step = width / bars;
        const bw = step * 0.6;
        for (let i = 0; i < bars; i++) {
          const v = s[i] ** 1.4 * gain;
          const hh = Math.max(3, v * height);
          g.beginPath();
          g.roundRect(i * step + (step - bw) / 2, height - hh, bw, hh, bw / 2);
          g.fill();
        }
      }
      g.globalAlpha = 1;
    },
  };
}
