// 第 5–8 章讲解页里能玩的东西（在 widgets.js 里登记）：
//   { widget: 'samplelab' }   采样实验台：挑一段声音（或用电脑的麦克风录 2 秒），拖两条线剪掉头尾、转音高、开循环，当乐器弹（第 5 章）
//   { widget: 'arranger' }    编曲台：几条轨道 × 四个段落（前奏 / 主歌 / 副歌 / 收尾），点格子决定每段谁出声，一口气放下来看能量怎么走（第 6 章）
//   { widget: 'recorder' }    录音机：从 SEQTRAK 的 USB 音频（或别的输入）把你演的那一场录下来，听、存成文件（第 8 章）
// 声音都是 Web Audio 现做的（audio.js、sim-samples.js），颜色只用 app.css 里的变量（样式在 synthlab.css）。
import { h, clamp } from './util.js';
import { audio } from './audio.js';
import { theme } from './theme.js';
import { RECORDINGS, recordingBuffer, playBuffer } from './sim-samples.js';
import { knob } from './synth-lab.js';
import { store } from './store.js';
import { SONGS } from './content/songs.js';
import { songLessonFor } from './content/song-lessons.js';

const C_MINOR = [0, 2, 3, 5, 7, 8, 10]; // 7 个 Synth keys 在 C 小调里比第 1 个高几个半音

// ───────────── 采样实验台 ─────────────

function samplelab() {
  let buffer = null;
  let name = '';
  let start = 0;
  let end = 1;
  let loop = false;
  let pitch = 0;
  let stopLoop = null;
  const canvas = h('canvas', { class: 'sl-wave', 'aria-label': '这段声音的样子：拖左右两条线剪掉头和尾' });
  const g = canvas.getContext('2d');
  const note = h('div', { class: 'sl-note' }, '先挑一段声音（或者用电脑的麦克风录一段），再拖画面上的两条线、转右边的旋钮。');
  let colors = {};
  const pick = () => {
    colors = { wave: theme.css('--accent'), dim: theme.css('--line-3'), ink: theme.css('--text'), mask: theme.css('--panel-3') };
  };
  pick();
  const offTheme = theme.on('change', () => (pick(), draw()));

  function draw() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(10, Math.round(r.width * dpr));
    const hh = Math.max(10, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== hh) {
      canvas.width = w;
      canvas.height = hh;
    }
    g.clearRect(0, 0, w, hh);
    if (!buffer) {
      g.fillStyle = colors.dim;
      g.font = `${15 * dpr}px ${theme.css('--font') || 'sans-serif'}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('还没有声音：先在下面挑一段', w / 2, hh / 2);
      return;
    }
    const d = buffer.getChannelData(0);
    const mid = hh / 2;
    for (let x = 0; x < w; x++) {
      const a = Math.floor((x / w) * d.length);
      const b = Math.floor(((x + 1) / w) * d.length);
      let peak = 0;
      for (let i = a; i < b; i += 4) peak = Math.max(peak, Math.abs(d[i]));
      const inside = x / w >= start && x / w <= end;
      g.fillStyle = inside ? colors.wave : colors.dim;
      g.fillRect(x, mid - peak * mid * 0.9, 1, Math.max(1, peak * mid * 1.8));
    }
    // 剪掉的部分盖一层，两条线是起点和终点
    g.globalAlpha = 0.6;
    g.fillStyle = colors.mask;
    g.fillRect(0, 0, start * w, hh);
    g.fillRect(end * w, 0, w - end * w, hh);
    g.globalAlpha = 1;
    g.fillStyle = colors.ink;
    for (const at of [start, end]) g.fillRect(at * w - 1.5 * dpr, 0, 3 * dpr, hh);
  }

  // 拖线：离哪条近就拖哪条
  let dragging = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (!buffer) return;
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    dragging = Math.abs(x - start) < Math.abs(x - end) ? 'start' : 'end';
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* 有的输入方式不支持 */
    }
    move(e);
  });
  const move = (e) => {
    if (!dragging) return;
    const r = canvas.getBoundingClientRect();
    const x = clamp((e.clientX - r.left) / r.width, 0, 1);
    if (dragging === 'start') start = Math.min(x, end - 0.03);
    else end = Math.max(x, start + 0.03);
    draw();
    note.textContent = `起点 ${Math.round(start * 100)}%、终点 ${Math.round(end * 100)}%：只放中间亮着的那一段。机器上是进阶第 4 页的 START POINT、END POINT 两个旋钮。`;
  };
  canvas.addEventListener('pointermove', move);
  const up = () => {
    if (dragging) play(0);
    dragging = null;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  async function play(offset = 0) {
    if (!buffer || !(await audio.init())) return;
    stopLoop?.();
    stopLoop = null;
    const stop = playBuffer(audio, buffer, 0, { pitch: pitch + offset, start, end, loop, dur: loop ? 2.5 : null });
    if (loop) stopLoop = stop;
  }

  async function choose(id, label) {
    if (!(await audio.init())) return;
    buffer = recordingBuffer(audio.ctx, id, 100);
    name = label;
    start = 0;
    end = 1;
    draw();
    note.textContent = `「${name}」：拖两条线剪掉不要的头和尾，再转 PITCH 听它变高变低。`;
    play();
  }

  // 用电脑的麦克风录 2 秒（浏览器会先问你允不允许）
  const mic = h('button', { class: 'btn', type: 'button' }, '🎙 用麦克风录 2 秒');
  mic.addEventListener('click', async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      note.textContent = '这个浏览器录不了音。用上面现成的几段也一样。';
      return;
    }
    try {
      await audio.init();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        try {
          const ab = await new Blob(chunks).arrayBuffer();
          buffer = await audio.ctx.decodeAudioData(ab);
          name = '你自己录的';
          start = 0;
          end = 1;
          draw();
          note.textContent = '录好了：这就是“采样”。拖两条线把开头的安静和结尾的杂音剪掉，再转 PITCH 试试。';
          play();
        } catch {
          note.textContent = '这段录音解不开，再录一次试试。';
        }
        mic.disabled = false;
        mic.textContent = '🎙 用麦克风录 2 秒';
      };
      rec.start();
      mic.disabled = true;
      mic.textContent = '● 正在录…';
      setTimeout(() => rec.state === 'recording' && rec.stop(), 2000);
    } catch {
      note.textContent = '麦克风没有打开（浏览器没给权限）。用上面现成的几段也一样。';
    }
  });

  const pitchKnob = knob({ label: 'PITCH', title: '音高', value: 0, min: -24, max: 24, readout: (v) => (v === 0 ? '原样' : `${v > 0 ? '+' : ''}${v} 半音`), onInput: (v) => { pitch = v; } });
  pitchKnob.el.addEventListener('pointerup', () => play());
  const loopBtn = h('button', { class: 'btn sl-loop', type: 'button', 'aria-pressed': 'false' }, 'LOOP 关');
  loopBtn.addEventListener('click', () => {
    loop = !loop;
    loopBtn.textContent = loop ? 'LOOP 开' : 'LOOP 关';
    loopBtn.setAttribute('aria-pressed', String(loop));
    loopBtn.classList.toggle('primary', loop);
    note.textContent = loop ? '循环开：中间那一段一直转。把起点终点拖得很近，就成了“嗡嗡”的一个音。' : '循环关：按一下放一遍。';
    play();
  });
  const pads = h('div', { class: 'sl-pads' }, C_MINOR.map((off, i) => {
    const b = h('button', { class: 'sl-pad', type: 'button' }, String(i + 1));
    b.addEventListener('pointerdown', () => play(off));
    return b;
  }));
  const sources = h('div', { class: 'sl-controls' }, RECORDINGS.map((r) => h('button', { class: 'btn', type: 'button', onclick: () => choose(r.id, r.name) }, r.name)), mic);
  const el = h('div', { class: 'sl sl-sample' },
    h('div', { class: 'sl-main' },
      h('div', { class: 'sl-screen sl-wavebox' }, canvas),
      sources,
      h('div', { class: 'sl-padrow' }, h('span', { class: 'label' }, '当乐器弹：同一段声音，7 个音高'), pads),
      note),
    h('div', { class: 'sl-column' }, pitchKnob.el, loopBtn));
  const ro = new ResizeObserver(() => draw());
  ro.observe(canvas);
  setTimeout(draw, 0);
  return { el: h('div', { class: 'widget sl-box' }, el), destroy: () => (ro.disconnect(), offTheme(), stopLoop?.()) };
}

// ───────────── 编曲台 ─────────────

const ARR_TRACKS = [
  { id: 'KICK', label: '底鼓', drum: 'KICK', a: 'x---x---x---x---', b: 'x---x---x---x-x-' },
  { id: 'CLAP', label: '拍手', drum: 'CLAP', a: '----x-------x---', b: '----x-------x-xx' },
  { id: 'HAT', label: '闭镲', drum: 'HAT1', a: '--x---x---x---x-', b: 'x-xxx-xxx-xxx-xx' },
  { id: 'BASS', label: '贝斯', voice: 'bass', notes: [[0, 36, 2], [3, 36, 1], [6, 39, 2], [8, 32, 2], [11, 32, 1], [14, 34, 2]] },
  { id: 'PAD', label: '和弦', voice: 'wide', notes: [[0, 48, 8], [0, 51, 8], [0, 55, 8], [8, 44, 8], [8, 48, 8], [8, 51, 8]] },
  { id: 'LEAD', label: '旋律', voice: 'supersaw', notes: [[0, 72, 2], [2, 75, 2], [4, 79, 3], [8, 77, 2], [10, 75, 2], [12, 72, 4]] },
];
const SECTIONS = ['前奏', '主歌', '副歌', '收尾'];
const PRESETS = {
  慢慢起来: { KICK: [0, 1, 2, 1], CLAP: [0, 1, 2, 0], HAT: [0, 1, 2, 0], BASS: [0, 1, 1, 0], PAD: [1, 1, 1, 1], LEAD: [0, 0, 1, 0] },
  一直很满: { KICK: [1, 1, 1, 1], CLAP: [1, 1, 1, 1], HAT: [2, 2, 2, 2], BASS: [1, 1, 1, 1], PAD: [1, 1, 1, 1], LEAD: [1, 1, 1, 1] },
  全空: { KICK: [0, 0, 0, 0], CLAP: [0, 0, 0, 0], HAT: [0, 0, 0, 0], BASS: [0, 0, 0, 0], PAD: [0, 0, 0, 0], LEAD: [0, 0, 0, 0] },
};

function arranger({ bars = 2 } = {}) {
  // 每个格子：0 不出声、1 第 1 段乐句、2 第 2 段（鼓更密）
  const grid = Object.fromEntries(ARR_TRACKS.map((t) => [t.id, [...PRESETS.慢慢起来[t.id]]]));
  const cells = {};
  const meter = h('div', { class: 'arr-meter' }, SECTIONS.map(() => h('i')));
  const note = h('div', { class: 'sl-note' }, '点格子：灰 = 这一段它不出声，1 / 2 = 用第几段乐句（2 更密）。点「从头放」听一遍，看下面那条线（能量）怎么走。');
  const paint = () => {
    for (const t of ARR_TRACKS) SECTIONS.forEach((_, s) => {
      const v = grid[t.id][s];
      const c = cells[`${t.id}${s}`];
      c.textContent = v ? String(v) : '';
      c.dataset.v = String(v);
    });
    // 能量：这一段有几样在出声、密不密
    meter.querySelectorAll('i').forEach((bar, s) => {
      const e = ARR_TRACKS.reduce((a, t) => a + (grid[t.id][s] ? (grid[t.id][s] === 2 ? 1.4 : 1) : 0), 0);
      bar.style.height = `${Math.round((e / (ARR_TRACKS.length * 1.2)) * 100)}%`;
    });
  };
  const table = h('div', { class: 'arr-grid', style: { gridTemplateColumns: `76px repeat(${SECTIONS.length}, minmax(0, 1fr))` } },
    h('span'), SECTIONS.map((s, i) => h('span', { class: 'arr-head', 'data-s': String(i) }, s)),
    ARR_TRACKS.map((t) => [
      h('span', { class: 'arr-row' }, t.label),
      SECTIONS.map((_, s) => {
        const c = h('button', { class: 'arr-cell', type: 'button', 'aria-label': `${t.label} · ${SECTIONS[s]}` });
        c.addEventListener('click', () => {
          grid[t.id][s] = (grid[t.id][s] + 1) % (t.drum ? 3 : 2);
          paint();
        });
        cells[`${t.id}${s}`] = c;
        return c;
      }),
    ]));
  let timer = 0;
  let playing = false;
  const play = h('button', { class: 'btn primary lg sl-play', type: 'button' }, '▶ 从头放');
  const stop = () => {
    clearInterval(timer);
    playing = false;
    play.textContent = '▶ 从头放';
    table.querySelectorAll('.arr-head.now').forEach((x) => x.classList.remove('now'));
  };
  play.addEventListener('click', async () => {
    if (playing) return stop();
    if (!(await audio.init())) return;
    playing = true;
    play.textContent = '■ 停';
    const bpm = 112;
    const stepSec = 60 / bpm / 4;
    const total = SECTIONS.length * bars * 16;
    const t0 = audio.now() + 0.1;
    let next = 0;
    timer = setInterval(() => {
      while (next < total && t0 + next * stepSec < audio.now() + 0.15) {
        const s = Math.floor(next / (bars * 16));
        const step = next % 16;
        const t = t0 + next * stepSec;
        for (const tr of ARR_TRACKS) {
          const v = grid[tr.id][s];
          if (!v) continue;
          if (tr.drum) {
            const pat = v === 2 ? tr.b : tr.a;
            if (pat[step] === 'x') audio.drum(tr.drum, t, 0.85);
          } else {
            for (const [st, n, len] of tr.notes) if (st === step) audio.note(n, t, len * stepSec * 0.92, { voice: tr.voice, vel: tr.voice === 'wide' ? 0.45 : 0.7 });
          }
        }
        if (step === 0 && next % (bars * 16) === 0) {
          const sec = s;
          setTimeout(() => table.querySelectorAll('.arr-head').forEach((x) => x.classList.toggle('now', Number(x.dataset.s) === sec)), Math.max(0, (t - audio.now()) * 1000));
        }
        next++;
      }
      if (next >= total && audio.now() > t0 + total * stepSec) stop();
    }, 30);
  });
  const presets = h('div', { class: 'seg sl-seg' }, Object.keys(PRESETS).map((k) => h('button', { type: 'button', onclick: () => { for (const t of ARR_TRACKS) grid[t.id] = [...PRESETS[k][t.id]]; paint(); } }, k)));
  paint();
  const el = h('div', { class: 'arr' }, table, h('div', { class: 'arr-energy' }, h('span', { class: 'label' }, '能量'), meter), h('div', { class: 'sl-controls' }, play, presets), note);
  return { el: h('div', { class: 'widget sl-box' }, el), destroy: stop };
}

// ───────────── 录音机 ─────────────

function recorder() {
  const note = h('div', { class: 'sl-note' }, '用 USB 线接着机器时，Mac 上会多一个叫 SEQTRAK 的声音输入：机器放出来的声音从这里进电脑，选它就是录机器。第一次用浏览器会问能不能用麦克风，点“允许”。');
  const select = h('select', { class: 'input rec-select', 'aria-label': '从哪个声音输入录' });
  const level = h('i', { class: 'rec-level-fill' });
  const clock = h('span', { class: 'rec-clock' }, '0:00');
  const recBtn = h('button', { class: 'btn primary lg', type: 'button' }, '● 开始录');
  const list = h('div', { class: 'rec-list' });
  let stream = null;
  let rec = null;
  let raf = 0;
  let tick = 0;
  let started = 0;
  async function devices() {
    if (!navigator.mediaDevices?.enumerateDevices) {
      note.textContent = '这个浏览器录不了音。在 Mac 的 Chrome 里打开这一页。';
      recBtn.disabled = true;
      return;
    }
    const all = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
    select.replaceChildren(...all.map((d, i) => h('option', { value: d.deviceId }, d.label || `声音输入 ${i + 1}`)));
    const seq = all.find((d) => /seqtrak/i.test(d.label));
    if (seq) select.value = seq.deviceId;
  }
  devices();
  const stopAll = () => {
    cancelAnimationFrame(raf);
    clearInterval(tick);
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
  };
  recBtn.addEventListener('click', async () => {
    if (rec && rec.state === 'recording') {
      rec.stop();
      return;
    }
    try {
      await audio.init();
      stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: select.value ? { exact: select.value } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      await devices(); // 给了权限之后才看得到设备的名字
      const src = audio.ctx.createMediaStreamSource(stream);
      const an = audio.ctx.createAnalyser();
      src.connect(an);
      const buf = new Uint8Array(an.fftSize);
      const draw = () => {
        an.getByteTimeDomainData(buf);
        let peak = 0;
        for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
        level.style.width = `${Math.min(100, (peak / 128) * 140)}%`;
        raf = requestAnimationFrame(draw);
      };
      draw();
      const chunks = [];
      rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        stopAll();
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const secs = Math.round((performance.now() - started) / 1000);
        const stamp = new Date().toLocaleString('zh-CN', { hour12: false }).replace(/[/:\s]/g, '-');
        list.prepend(h('div', { class: 'rec-item' },
          h('span', {}, `${Math.floor(secs / 60)} 分 ${secs % 60} 秒`),
          h('audio', { controls: '', src: url }),
          h('a', { class: 'btn sm', href: url, download: `我的演出-${stamp}.webm` }, '存成文件')));
        recBtn.textContent = '● 再录一段';
        if (secs >= 5) store.update((d) => (d.showRecordings = [...(d.showRecordings || []), { at: new Date().toISOString(), secs }].slice(-20)));
        level.style.width = '0';
        note.textContent = '录好了：在下面听一遍，满意就“存成文件”（浏览器会放进“下载”文件夹）。';
      };
      rec.start(1000);
      started = performance.now();
      tick = setInterval(() => {
        const s = Math.round((performance.now() - started) / 1000);
        clock.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      }, 500);
      recBtn.textContent = '■ 停止';
      note.textContent = '正在录：上面那条绿色的会跟着声音跳。录完点“停止”。';
    } catch {
      stopAll();
      note.textContent = '没能打开这个声音输入（浏览器没给权限，或者没接机器）。在 Chrome 地址栏左边的图标里把“麦克风”改成允许，再试一次。';
    }
  });
  const el = h('div', { class: 'rec' },
    h('div', { class: 'row rec-top' }, h('span', { class: 'label' }, '从哪儿录'), select, clock),
    h('div', { class: 'rec-level' }, level),
    h('div', { class: 'sl-controls' }, recBtn),
    note, list);
  return { el: h('div', { class: 'widget sl-box' }, el), destroy: () => { if (rec?.state === 'recording') rec.stop(); stopAll(); } };
}

// ───────────── 第 8 章：演出曲目单 ─────────────

// 用户听过、能哼出来的是 songs.js 开头那 11 首（见那个文件的注释）：排在前面，标“听过”
const HEARD = new Set(SONGS.slice(0, 11).map((x) => x.id));
const SET_MAX = 5; // 一首一个工程：照着搭的曲目课放在 5–8 号，第 5 首放 4 号（练习本）
const SET_PROJECTS = [5, 6, 7, 8, 4];

/** 演出的曲目单：从曲目库里挑几首、排先后，每首放进一个工程（5–8 号，第 5 首 4 号）。存在 store.data.setlist（{ songs: [id…] }） */
function setlist({ progress = false } = {}) {
  const ids = () => (store.data.setlist?.songs || []).filter((id) => SONGS.some((x) => x.id === id));
  const save = (list) => store.update((d) => (d.setlist = { songs: list, at: new Date().toISOString() }));
  const box = h('div', { class: 'setl' });
  const lessonDone = (id) => {
    const l = songLessonFor(id);
    return l ? !!store.data.lessons?.[l.id]?.done : false;
  };
  const paint = () => {
    const list = ids();
    const minutes = list.length * 3;
    const rows = list.map((id, i) => {
      const song = SONGS.find((x) => x.id === id);
      const l = songLessonFor(id);
      const move = (d) => {
        const next = [...list];
        const j = i + d;
        if (j < 0 || j >= next.length) return;
        [next[i], next[j]] = [next[j], next[i]];
        save(next);
        paint();
      };
      return h('li', { class: 'setl-item' },
        h('span', { class: 'setl-no' }, String(i + 1)),
        h('span', { class: 'setl-name' }, h('b', {}, song.title), h('small', {}, `${song.artist} · 约 ${song.bpm} BPM · 放进 ${SET_PROJECTS[i]} 号工程`)),
        progress
          ? h('span', { class: 'setl-links' },
            l ? h('a', { class: ['btn', 'sm', lessonDone(id) ? '' : 'primary'], href: `#/lesson/${l.id}` }, lessonDone(id) ? '✓ 搭过了' : '照着搭') : h('span', { class: 'setl-tag' }, '还没有分轨课'),
            h('a', { class: 'btn sm', href: `#/songs/${id}/full` }, '完整版'))
          : h('span', { class: 'setl-links' },
            h('button', { class: 'btn sm', type: 'button', 'aria-label': '往前挪', disabled: i === 0, onclick: () => move(-1) }, '↑'),
            h('button', { class: 'btn sm', type: 'button', 'aria-label': '往后挪', disabled: i === list.length - 1, onclick: () => move(1) }, '↓'),
            h('button', { class: 'btn sm', type: 'button', onclick: () => { save(list.filter((x) => x !== id)); paint(); } }, '拿掉')));
    });
    // 速度一首一首画成一条线：一场 set 的“能量曲线”（粗看，速度不等于能量）
    const bpms = list.map((id) => SONGS.find((x) => x.id === id).bpm);
    const lo = Math.min(70, ...bpms);
    const hi = Math.max(140, ...bpms);
    const curve = h('div', { class: 'setl-curve' }, bpms.map((b, i) => h('i', { style: { height: `${Math.round(((b - lo) / (hi - lo)) * 80 + 20)}%` }, title: `第 ${i + 1} 首 · ${b} BPM` })));
    const head = h('div', { class: 'setl-head' },
      h('b', {}, list.length ? `你的 set：${list.length} 首，大约 ${minutes} 分钟` : '你的 set 还是空的'),
      list.length ? h('span', { class: 'sl-note' }, '右边那几根是每首的速度（BPM），从左到右是演出的先后。') : null);
    const picks = progress ? null : h('div', { class: 'setl-pick' },
      h('div', { class: 'label' }, list.length >= SET_MAX ? `已经 ${SET_MAX} 首了（5–8 号、4 号工程一首一个）。想换就先拿掉一首。` : '点一首加进去（排在最后）：'),
      h('div', { class: 'setl-grid' }, [...SONGS].sort((a, b) => Number(HEARD.has(b.id)) - Number(HEARD.has(a.id))).map((song) => {
        const on = list.includes(song.id);
        return h('button', {
          type: 'button',
          class: ['setl-song', on ? 'on' : ''],
          // 左边那道色条：听过的用强调色，别的用中性色（不用曲目库的风格色：“流行”那一类是粉色，这套课不用粉色）
          style: { '--c': HEARD.has(song.id) ? 'var(--accent)' : 'var(--line-2)' },
          disabled: !on && list.length >= SET_MAX,
          onclick: () => {
            save(on ? list.filter((x) => x !== song.id) : [...list, song.id]);
            paint();
          },
        }, h('b', {}, song.title), h('small', {}, `${song.bpm} BPM${HEARD.has(song.id) ? ' · 听过' : ''}${songLessonFor(song.id) ? '' : ' · 没有分轨课'}`));
      })));
    box.replaceChildren(
      h('div', { class: 'setl-top' }, head, list.length ? curve : null),
      list.length ? h('ol', { class: 'setl-list' }, rows) : h('div', { class: 'sl-note' }, progress ? '先在上一课排好曲目单。' : '从下面挑 3–5 首：先挑你最熟、最想演的。'),
      picks);
  };
  paint();
  return { el: h('div', { class: 'widget sl-box' }, box), destroy: () => {} };
}

export const CHAPTER_WIDGETS = { samplelab: () => samplelab(), arranger: (spec) => arranger(spec), recorder: () => recorder(), setlist: (spec) => setlist(spec) };
