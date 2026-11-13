// 开发测试用的“假真机”：平时应用不会加载它，只有地址里带 ?fake（或 ?fake=demo）时才接上。
// 它接管 MIDI 的输出口，像真机一样回答参数查询（地址与 docs/hardware-findings.md 里实测的一致），
// 并提供一组“用户在机器上做了某件事”的方法，用来在没有真机的环境里测试真机镜像和课程的自动打勾。
// 用法（浏览器控制台或测试脚本）：
//   const { attachFakeDevice } = await import('/js/dev/fake-seqtrak.js'); const dev = attachFakeDevice();
//   dev.selectTrack(1); dev.toggleStep(0, 4); dev.mute(0); dev.play();
import { midi } from '../midi.js';
import { synthKeyNote, chordNotes } from '../scales.js';

/** 把音色名编成真机的样子：每 7 个字母前面垫一个“高位字节”（英文名时是 0），实测 01 1p 35 就是这么回的 */
function encodeName(name) {
  const out = [];
  const padded = name.padEnd(21, ' ');
  for (let i = 0; i < padded.length; i += 7) out.push(0, ...[...padded.slice(i, i + 7)].map((c) => c.charCodeAt(0) & 0x7f));
  return out;
}

/** 自动演一段：翻到 4 号工程，填一个四踩，静音 HAT 2，再给军鼓放两下。用来截图和目测。 */
export async function demo(dev) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await wait(900);
  dev.setProject(3);
  await wait(1600);
  dev.selectTrack(0);
  await wait(500);
  for (const s of [4, 8, 12]) {
    dev.toggleStep(0, s);
    await wait(450);
  }
  dev.mute(4);
  await wait(500);
  dev.selectTrack(1);
  await wait(600);
  dev.toggleStep(1, 4);
  await wait(500);
  dev.toggleStep(1, 12);
}

/** 自动演一段第 3 章的操作：翻到 4 号工程，选中 SYNTH 2，换一个钢琴音色，切到 CHORD，按两个和弦。 */
export async function demoChords(dev) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await wait(900);
  dev.setProject(3);
  await wait(1600);
  dev.selectTrack(8);
  await wait(700);
  dev.changeSound(9, { name: 'CP80 Layer', poly: 1 });
  await wait(1200);
  dev.polyMode(8, 2);
  await wait(900);
  dev.synthKey(1, 9);
  await wait(600);
  dev.synthKey(6, 9);
}

export function attachFakeDevice() {
  const st = {
    project: 0, track: 0, playing: 0, recording: 0, solo: 0, tempo: 120, swing: 0, scale: 0, key: 0, speaker: 100, phones: 32,
    rt: 0, hold: 0, patMode: 0,
    pat: Array(11).fill(0), mute: Array(11).fill(0), oct: { 7: 0, 8: 0, 9: 0 },
    // 第 3 章用到的（地址与取值照 2026-11-10 的实测）：三条合成器轨的弹法 0 MONO / 1 POLY / 2 CHORD、当前乐句的步数、音色名、Sound Design 页
    poly: { 7: 0, 8: 1, 9: 1 }, len: { 7: 16, 8: 16, 9: 16 }, sdPage: 0,
    sound: { 0: 'Tight Punchy Kick 1', 7: 'Rn Bass', 8: 'Round Saw Phase', 9: 'FM Lo-Fi Bass' },
    // 第 4 章（2026-11-12 实测的地址，见 mirror.js 的 PARAM_ADDR）：起音、衰减、DX 的 FM，0x40 = 原样；进阶设置；每条轨道自己的“第几页”
    // 第 7 章：混响、延迟送多少（31 1p 19 / 1A，0–127 的原值；实测 SYNTH 2）
    tune: { 7: { attack: 0x40, decay: 0x40, rev: 0x28, dly: 0 }, 8: { attack: 0x40, decay: 0x40, rev: 0x28, dly: 0 }, 9: { attack: 0x40, decay: 0x40, fmAmt: 0x40, fmFreq: 0x40, fmFb: 0x40, fmAlg: 7 } },
    sdMode: 0, sdp: {},
    // 第 5 章：7 个采样位的名字（实测从 50 eA 00 起读得出，e = 0–6；01–07 是头 7 个字母）
    samples: ['Count 1', 'Phrase', 'Sing Ah', 'Robot', 'Riser', 'Laser', 'Impact'],
    // 每个工程 × 7 条鼓轨 × 6 段乐句
    steps: Array.from({ length: 8 }, () => Array.from({ length: 7 }, () => Array.from({ length: 6 }, () => new Set()))),
    // 完整版的课：合成器轨每一段乐句各自的步数（'轨道:第几段' → 步数；没写的是 16）
    plen: {},
  };
  for (let p = 0; p < 8; p++) st.steps[p][0][0].add(0); // 每个工程里孤零零的一下底鼓
  let requests = 0;

  const say = (addr, data) => midi.simulate([0xf0, 0x43, 0x10, 0x7f, 0x1c, 0x0c, ...addr, ...data, 0xf7]);
  // 参数名 → 地址（和 mirror.js 的 PARAM_ADDR 一样）
  const TUNE_ADDR = { attack: (p) => [0x31, 0x10 | p, p === 9 ? 0x01 : 0x2c], decay: (p) => [0x31, 0x10 | p, p === 9 ? 0x02 : 0x00], fmAmt: () => [0x31, 0x19, 0x03], fmFreq: () => [0x31, 0x19, 0x04], fmFb: () => [0x31, 0x19, 0x05], fmAlg: () => [0x48, 0x09, 0x00], rev: (p) => [0x31, 0x10 | p, 0x19], dly: (p) => [0x31, 0x10 | p, 0x1a] };
  const tuneAt = ([h, m, l]) => {
    for (const [p, map] of Object.entries(st.tune)) for (const name of Object.keys(map)) {
      const a = TUNE_ADDR[name](Number(p));
      if (a[0] === h && a[1] === m && a[2] === l) return [map[name]];
    }
    return null;
  };
  const answer = ([h, m, l]) => {
    // 采样位名字 50 eA 00–3F：和音色名一样，每 8 个字节里第 1 个是“高位字节”（英文名时是 0），后 7 个是字母；01–07 就是头 7 个字母
    if (h === 0x50 && (m & 0x0f) === 0x0a && (m >> 4) < 7 && l < 0x40) return (l & 7) === 0 ? [0] : [(st.samples[m >> 4].padEnd(56, ' ').charCodeAt((l >> 3) * 7 + (l & 7) - 1)) & 0x7f];
    if (h === 0x01 && (m & 0xf0) === 0x10 && l === 0x35) return st.sound[m & 0x0f] ? encodeName(st.sound[m & 0x0f]) : null;
    if (h === 0x01 && m === 0x10 && l === 0x30) return [st.sdPage];
    if (h === 0x01 && (m & 0xf0) === 0x10 && l === 0x30) return [st.sdp[m & 0x0f] ?? 0];
    if (h === 0x00 && m === 0x00 && l === 0x21) return [st.sdMode];
    if (h === 0x31 || h === 0x48) {
      const t = tuneAt([h, m, l]);
      if (t) return t;
    }
    if (h === 0x31 && (m & 0xf0) === 0x10 && l === 0x23) return st.poly[m & 0x0f] === undefined ? null : [st.poly[m & 0x0f]];
    if (h === 0x30 && (m & 0xf0) === 0x50 && l >= 0x16 && l <= 0x20 && l % 2 === 0) {
      // 每段乐句各有一个长度（第 1 段记在 len 里，别的段记在 plen 里）
      const p = m & 0x0f;
      const pat = (l - 0x16) / 2;
      const steps = (pat === 0 ? st.len[p] : st.plen[`${p}:${pat}`]) ?? 16;
      return [steps >> 7, steps & 0x7f];
    }
    if (h === 0x01 && m === 0x10) return { 0x15: [st.project], 0x27: [st.track], 0x20: [st.playing], 0x21: [st.recording], 0x02: [80], 0x19: [st.rt], 0x18: [st.hold], 0x2d: [0] /* 真机上这个值问回来总是 0，只有它主动报的才有内容 */ }[l] || null;
    if (h === 0x30 && m === 0x40) return { 0x68: [st.solo], 0x76: [st.tempo >> 7, st.tempo & 0x7f], 0x7c: [(st.swing + 128) >> 7, (st.swing + 128) & 0x7f], 0x7e: [st.scale], 0x7f: [0x40 + st.key], 0x79: [st.patMode] }[l] || null;
    if (h === 0x30 && (m & 0xf0) === 0x50) {
      const p = m & 0x0f;
      if (l === 0x0f) return [st.pat[p]];
      if (l === 0x29) return [st.mute[p] ? 0x7d : 0];
      if (l === 0x0c) return [0x40 + (st.oct[p] ?? 0)];
      return null;
    }
    if (h === 0x00 && m === 0x00) return { 0x00: [st.speaker], 0x01: [st.phones], 0x20: [100] }[l] || null;
    if (h === 0x70 && (m & 0xf0) === 0x40) {
      const p = m & 0x0f;
      if (p > 6) return [];
      return st.steps[st.project][p][st.pat[p]].has(l) ? [0x3c, 0x64, 0x00, 0x3c, 0x00, 0x78] : [];
    }
    return null;
  };

  midi.output = {
    send(bytes, at) {
      const delay = Math.max(0, (at || 0) - performance.now()) + 1;
      if (bytes[0] === 0xf0 && bytes[1] === 0x43 && (bytes[2] & 0xf0) === 0x30) {
        requests++;
        const addr = [bytes[6], bytes[7], bytes[8]];
        // 和真机一样：请求“到达”的那一刻才取值（一批请求是隔几毫秒一条陆续到的）
        setTimeout(() => {
          const data = answer(addr);
          if (data) say(addr, data);
        }, delay);
      } else if (bytes[0] === 0xf0 && bytes[1] === 0x43 && (bytes[2] & 0xf0) === 0x10) {
        // 应用往机器里写参数（“替我设好音阶和调 / 速度”）
        const [h, m, l] = [bytes[6], bytes[7], bytes[8]];
        const data = Array.from(bytes).slice(9, -1);
        if (h === 0x30 && m === 0x40) {
          if (l === 0x7e) st.scale = data[0];
          else if (l === 0x7f) st.key = data[0] - 0x40;
          else if (l === 0x76) st.tempo = data[0] * 128 + data[1];
        } else if (h === 0x30 && (m & 0xf0) === 0x50 && l === 0x16 + 2 * st.pat[m & 0x0f]) {
          const p = m & 0x0f; // “替我把这段乐句设成几小节”
          if (st.pat[p]) st.plen[`${p}:${st.pat[p]}`] = data[0] * 128 + data[1];
          else st.len[p] = data[0] * 128 + data[1];
        }
      } else if ((bytes[0] & 0xf0) === 0xb0 && bytes[1] === 26 && st.poly[bytes[0] & 0x0f] !== undefined) {
        st.poly[bytes[0] & 0x0f] = bytes[2]; // “替我切到 CHORD”：CC 26（实测真机只把它原样回声回来，不另外上报）
      } else if ((bytes[0] & 0xf0) === 0xb0 && st.tune[bytes[0] & 0x0f]) {
        // 第 4 章“让应用替你拧回原样”：CC 73 / 75 / 116–119（实测写进去之后从 31 1p xx、48 09 00 读得回来）
        const name = { 73: 'attack', 75: 'decay', 91: 'rev', 94: 'dly', 116: 'fmAlg', 117: 'fmAmt', 118: 'fmFreq', 119: 'fmFb' }[bytes[1]];
        if (name && st.tune[bytes[0] & 0x0f][name] !== undefined) st.tune[bytes[0] & 0x0f][name] = bytes[2];
      } else if (bytes[0] === 0xf0 && bytes[1] === 0x7e) {
        // 版本字节 0A = V2.00（用户这台机器现在的固件）
        setTimeout(() => midi.simulate([0xf0, 0x7e, 0x7f, 0x06, 0x02, 0x43, 0x00, 0x41, 0x64, 0x06, 0x0a, 0x00, 0x00, 0x7f, 0xf7]), delay);
      } else if (bytes[0] === 0xfa) {
        st.playing = 1;
      } else if (bytes[0] === 0xfc) {
        st.playing = 0;
      }
    },
  };
  midi.sysex = true;
  midi.simulateConnect(true);

  const note = (ch, n = 60) => {
    midi.simulate([0x90 | (ch - 1), n, 100]);
    setTimeout(() => midi.simulate([0x80 | (ch - 1), n, 0]), 60);
  };

  return {
    st,
    get requests() {
      return requests;
    },
    // 下面几个动作，真机会主动报上来（按 2026-11-10 用户做“按键体检”时录到的样子）：
    /** 按一下轨道旋钮：选中它并上报（本来就选中也照样报）；停着的时候还会响一声 */
    selectTrack(i) {
      st.track = i;
      say([0x01, 0x10, 0x27], [i]);
      if (!st.playing) note(i + 1);
      // 实录里：打鼓模式下选中合成器轨，机器随即退出打鼓模式
      if (i >= 7 && st.rt) {
        st.rt = 0;
        setTimeout(() => say([0x01, 0x10, 0x19], [0]), 8);
      }
    },
    /** 转轨道旋钮：换乐句，并上报 */
    turnKnob(i, dir = 1) {
      st.pat[i] = Math.max(0, Math.min(st.patMode ? 5 : 2, st.pat[i] + dir));
      say([0x30, 0x50 | i, 0x0f], [st.pat[i]]);
    },
    /** 按住任意鼓轨旋钮 + 按一个 Synth key：进入 / 退出打鼓模式 */
    realtime(on = !st.rt) {
      st.rt = on ? 1 : 0;
      say([0x01, 0x10, 0x19], [st.rt]);
    },
    /** 按住 / 松开 [PROJECT↑] */
    holdProject(on = true) {
      st.hold = on ? 1 : 0;
      say([0x01, 0x10, 0x18], [st.hold]);
    },
    /**
     * 按住 / 松开一个功能键，照 2026-11-10 真机实录的样子报：
     *   [PROJECT↑]：Drum keys 的显示方式 01 10 2D = 04 04，界面状态 01 10 18 = 1；松手 2D = 01 01、18 = 0。
     *   [DELETE] [MUTE] [SOLO] [PAGE]：01 10 2D 和 11 条轨道灯的显示方式 01 1p 39 一起换，松手都回到 01 01；01 10 18 不动。
     * led 可以另外指定，用来测“和镜像认的对不上”的情况。
     */
    holdKey(name, on = true, { led } = {}) {
      if (name === 'PROJECT') {
        st.hold = on ? 1 : 0;
        say([0x01, 0x10, 0x2d], on ? [4, 4] : [1, 1]);
        say([0x01, 0x10, 0x18], [st.hold]);
        return;
      }
      // [Drum keys 的显示方式, 鼓轨灯的显示方式, 合成器轨灯的显示方式]
      const shape = { DELETE: [[2, 0], [2, 0], [2, 0]], MUTE: [[3, 1], [3, 1], [3, 1]], SOLO: [[0, 1], [4, 1], [4, 1]], PAGE: [[0x0a, 0x0a], [5, 5], [7, 1]] }[name];
      if (!shape) return;
      const [keys, drum, synth] = on ? shape : [[1, 1], [1, 1], [1, 1]];
      say([0x01, 0x10, 0x2d], keys);
      for (let p = 0; p < 11; p++) say([0x01, 0x10 | p, 0x39], on && led !== undefined ? [led, 1] : p < 7 ? drum : synth);
    },
    /** 每轨 3 段 / 6 段乐句 */
    patternMode(six = true) {
      st.patMode = six ? 1 : 0;
      say([0x30, 0x40, 0x79], [st.patMode]);
    },
    /** 在当前选中的鼓轨上开 / 关一步 */
    toggleStep(track, step) {
      const set = st.steps[st.project][track][st.pat[track]];
      if (set.has(step)) set.delete(step);
      else set.add(step);
    },
    clearPattern(track) {
      st.steps[st.project][track][st.pat[track]].clear();
    },
    mute(i) {
      st.mute[i] = st.mute[i] ? 0 : 1;
    },
    solo(i) {
      st.solo = st.solo === i + 1 ? 0 : i + 1;
    },
    /** 按住 [PROJECT↑] + 步进键：换工程，并上报 */
    setProject(i) {
      st.project = i;
      st.playing = 0;
      st.pat.fill(0);
      st.mute.fill(0);
      st.hold = 0;
      say([0x01, 0x10, 0x18], [0]);
      say([0x01, 0x10, 0x15], [i]);
    },
    bpm(delta) {
      st.tempo += delta;
    },
    setTempo(v) {
      st.tempo = v;
    },
    swing(v) {
      st.swing = v;
    },
    volume(delta) {
      st.speaker += delta;
    },
    scaleKey(scale, key) {
      st.scale = scale;
      st.key = key;
    },
    octave(part, v) {
      st.oct[part] = v;
    },
    /** 按 [PLAY]：机器会发开始 / 停止 */
    play() {
      st.playing = 1;
      say([0x01, 0x10, 0x20], [1]);
      midi.simulate([0xfa]);
    },
    stop() {
      st.playing = 0;
      say([0x01, 0x10, 0x20], [0]);
      midi.simulate([0xfc]);
    },
    /** 打鼓模式里按第 n 个 Synth key：发在第 n 条鼓轨的通道上，机器同时把那条轨道选中并上报 */
    drumKey(n) {
      st.track = n - 1;
      say([0x01, 0x10, 0x27], [n - 1]);
      note(n);
    },
    /** 合成器轨上按第 n 个 Synth key（C 小调、八度 0 时的音符号），机器紧跟着上报“按的是第几个键” */
    synthKey(n, ch = 8) {
      // 这条轨道在 CHORD 上时，一个键出一整个和弦（见下面的 chordKey）
      if (st.poly[ch - 1] === 2) return this.chordKey(n, ch);
      note(ch, synthKeyNote(n, { scale: st.scale, key: st.key, octave: st.oct[ch - 1] ?? 0 }));
      setTimeout(() => say([0x01, 0x10, 0x2c], [n - 1]), 1);
    },
    /**
     * CHORD 状态下按第 n 个 Synth key：同一条通道上一口气出来和弦的那几个音。
     * 真机这时具体发几个 NoteOn、先后顺序、还带不带“按了第几个键”那条上报，都还没有实录（要有人在机器上按才知道）；
     * 这里按“从低到高、几乎同时、仍然带那条上报”来演，withKey = false 可以演不带的情况。
     */
    chordKey(n, ch = 9, { withKey = true } = {}) {
      for (const k of chordNotes(n, { scale: st.scale, key: st.key, octave: st.oct[ch - 1] ?? 0 })) note(ch, k);
      if (withKey) setTimeout(() => say([0x01, 0x10, 0x2c], [n - 1]), 1);
    },
    /** POLY 状态下几个 Synth key 一起按下去（各隔 gapMs 毫秒，人手不可能完全同时） */
    pressKeys(keys, ch = 9, gapMs = 12) {
      keys.forEach((n, i) => setTimeout(() => {
        note(ch, synthKeyNote(n, { scale: st.scale, key: st.key, octave: st.oct[ch - 1] ?? 0 }));
        setTimeout(() => say([0x01, 0x10, 0x2c], [n - 1]), 1);
      }, i * gapMs));
    },
    /** 转 Sound Design 旋钮 2：单音 / 复音 / 和弦。cc = true 时像第三方资料说的那样同时发 CC 26（真机上发不发还没实录） */
    polyMode(part, mode, { cc = false } = {}) {
      st.poly[part] = mode;
      if (cc) midi.simulate([0xb0 | part, 26, mode]);
    },
    /** 按 [BAR LENGTH]：当前这段乐句变成 bars 小节 */
    barLength(part, bars) {
      if (st.pat[part]) st.plen[`${part}:${st.pat[part]}`] = bars * 16;
      else st.len[part] = bars * 16;
    },
    /** 完整版的课：直接把一条轨道转到第 pat 段（0 起；转旋钮那样上报） */
    setPattern(i, pat) {
      st.pat[i] = Math.max(0, Math.min(st.patMode ? 5 : 2, pat));
      say([0x30, 0x50 | i, 0x0f], [st.pat[i]]);
    },
    /** 静音 / 取消静音到某个样子（mute() 是来回换） */
    setMute(i, on) {
      st.mute[i] = on ? 1 : 0;
    },
    /**
     * 按 Sound Design Page 键：4 个旋钮翻到第几页（0 = 第 1 页）。
     * 真机上这个页是整台一个（01 10 30）还是每条轨道一个（01 1p 30）还没验证过：perTrack = true 时演后一种
     */
    sdPage(n, { perTrack = false } = {}) {
      if (perTrack) st.sdp[st.track] = n;
      else st.sdPage = n;
    },
    /** 长按翻页键 2 秒：进 / 出进阶设置（00 00 21） */
    sdMode(on = !st.sdMode) {
      st.sdMode = on ? 1 : 0;
    },
    /**
     * 在第 2 页（或 DX 第 5 页）上拧一个旋钮：name = attack / decay / cutoff / reso / fmAmt / fmFreq / fmFb / fmAlg，value = −64 … +63（算法 0–11）。
     * 起音、衰减、FM 存进参数里（镜像轮询读得到）；cc = true 时同时像官方 CC 表那样发一条 CC（真机转旋钮时发不发还没人试过）。
     * 滤波器和共鸣在真机上读不出来，只有 cc = true 时镜像才知道
     */
    turnSD(part, name, value, { cc = false } = {}) {
      const raw = ['fmAlg', 'rev', 'dly'].includes(name) ? value : value + 64; // 混响、延迟送多少给的是 0–127 的原值
      if (st.tune[part]?.[name] !== undefined) st.tune[part][name] = raw;
      const num = { attack: 73, decay: 75, cutoff: 74, reso: 71, rev: 91, dly: 94, fmAlg: 116, fmAmt: 117, fmFreq: 118, fmFb: 119 }[name];
      if (cc && num) midi.simulate([0xb0 | part, num, raw]);
    },
    /** 第 5 章：在采样器上录了一段（[REC SAMPLE] 两下）。机器报不报“正在采样”不知道；这里只把那个采样位的名字换掉（镜像轮询读得到） */
    recordSample(key, name = `Smp${String(key).padStart(2, '0')}${Math.floor(Math.random() * 90 + 10)}`) {
      st.samples[key - 1] = name.slice(0, 56);
    },
    // ── 下面几样是给「设备」页“第 5–8 章的按键”那一轮记录器测试用的“假信号”：真机实际报不报、报什么都还不知道，
    //    这里的样子只是为了让记录器有东西可记，不代表真机。
    /** 按住 [ALL] 再按 SOUND 旋钮存采样：名字后面加 _edit01（照手册 3.11.4 存音色的说法；采样上是不是这样没人试过） */
    saveSample(key) {
      st.samples[key - 1] = `${st.samples[key - 1].replace(/_edit\d+$/, '')}_edit01`.slice(0, 56);
    },
    /** 机器主动报一条参数变化（任意地址），比如 dev.report([0x01, 0x10, 0x18], [3]) */
    report(addr, data) {
      say(addr, data);
    },
    /**
     * 在一条触摸条上从下往上滑、再松手：发一串 CC（第三方资料说 [HIGH PASS] / [REPEATER] / [FX LEVEL] 是 CC 105 / 106 / 102），
     * 松手时再发 release 这个值。cc、ch、release 都能改，用来演“发的是别的”。
     */
    slide(which = 'HIGHPASS', { cc, ch = 1, steps = 12, gapMs = 25, release = 0 } = {}) {
      const num = cc ?? { HIGHPASS: 105, REPEATER: 106, FXLEVEL: 102 }[which] ?? 105;
      for (let i = 0; i <= steps; i++) setTimeout(() => midi.simulate([0xb0 | (ch - 1), num, Math.round((127 * i) / steps)]), i * gapMs);
      if (release !== null) setTimeout(() => midi.simulate([0xb0 | (ch - 1), num, release]), (steps + 4) * gapMs);
    },
    /** 按住 [ALL] 再按 SOUND 旋钮：存音色。真机上名字会变成“原名_editNN”（手册 3.11.4；名字是不是马上能读到，没人试过） */
    saveSound(part) {
      const base = (st.sound[part] || 'Sound').replace(/_edit\d+$/, '');
      st.sound[part] = `${base}_edit01`;
    },
    /**
     * 转右边最上面的 Sound Design 旋钮：换音色。sound = { name, poly }：新音色的名字和它自带的弹法
     * （实测：弹法是存在音色里的，名字带 [Chord] 的音色一选上就是 2）。不给 sound 就只发换音色的那三条消息。
     */
    changeSound(ch = 1, sound = null) {
      if (sound) {
        st.sound[ch - 1] = sound.name;
        if (st.poly[ch - 1] !== undefined) st.poly[ch - 1] = sound.poly ?? (/\[Chord\]/i.test(sound.name) ? 2 : 1);
        // 起音、衰减、FM 和弹法存在同一块里（31 1p xx）：新音色带着它自己的值进来（这里都当它是“原样”）
        const tune = st.tune[ch - 1];
        if (tune) for (const k of Object.keys(tune)) tune[k] = k === 'fmAlg' ? (sound.fmAlg ?? 7) : 0x40;
      }
      midi.simulate([0xb0 | (ch - 1), 0, 63]);
      midi.simulate([0xb0 | (ch - 1), 32, 0]);
      midi.simulate([0xc0 | (ch - 1), 5]);
    },
    detach() {
      midi.output = null;
      midi.simulateConnect(false);
    },
  };
}
