// 键盘学习方式的键位：电脑键盘上哪个键是机器上的哪个控件，照着机器的样子排（docs/design-direction.md「键盘学习方式」）：
//   字母上两排 = 机器上那两排方键：Q–I / A–K 是 16 个步进键（上排 1–8、中排 9–16），右边接着的
//                O P [ ] / L ; ' ↵ 是录音键和 7 个 Synth keys（和机器一样：上排 录音 1 2 3，下排 4 5 6 7）
//   最下一排   = 轨道旋钮：Z–M 是 7 条鼓轨（顺序和打鼓模式里的 7 面鼓一样），, . / 是 SYNTH 1、SYNTH 2、DX；SAMPLER 在 \
//   数字行     = 机器边上那一圈功能键；` 是 ALL（机器上 ALL 在左上角，键盘上 ` 也在左上角）；⌫ 是 DELETE
//   空格 = [PLAY]；← / → = 两条触摸条 [HIGH PASS] / [REPEATER]（按着 = 手指按在上面，同时按 ↑ ↓ 往上推 / 往下拉）
//   ↑ ↓ = 转旋钮：按着轨道键（或 `）时转它；按着 [OCTAVE]、步进键时转 ALL；别的旋钮用鼠标指着它（或按 Tab 选中）再按
//         鼓轨上按着一个亮着的步进键时，↑ ↓ 转的是右边第 4 个旋钮（只改这一步的力度）；按着 [PAGE] 再按着一条鼓轨的键，↑ ↓ 改它这段乐句有几步
// 没有专门键的（[VOL+] [VOL−] [REC SAMPLE] [UNDO] [CLEAR FX] [MASTER/SINGLE] [FX PAGE]、右边 4 个旋钮和 [FX]、[FX LEVEL]）：
// 用鼠标点，或者按 Tab 选中再按回车（按住回车 = 按住它）；旋钮、[FX LEVEL] 选中或指着时按 ↑ ↓。
// 用的是 event.code（按键的位置），和输入法、大小写、Shift 都没关系。
import { h } from './util.js';
import { TRACK } from './tracks.js';
import { audio } from './audio.js';
import { sound } from './sound.js';
import { sfx } from './sfx.js';

const DRUM_ORDER = ['KICK', 'SNARE', 'CLAP', 'HAT1', 'HAT2', 'PERC1', 'PERC2'];
const letters = (s, start) => [...s].map((c, i) => [`Key${c}`, `DK${start + i}`, c]);

// 一行一行，和电脑键盘一样排：[event.code, 控件 id（null = 不用的键）, 键帽上的字]
export const KEY_ROWS = [
  [['Backquote', 'ALL', '`'], ['Digit1', 'MUTE', '1'], ['Digit2', 'SOLO', '2'], ['Digit3', 'PAGE', '3'], ['Digit4', 'BARLENGTH', '4'], ['Digit5', 'OCTAVE', '5'],
    ['Digit6', 'SCALE', '6'], ['Digit7', 'KEY', '7'], ['Digit8', 'SWING', '8'], ['Digit9', 'SDPAGE', '9'], ['Digit0', 'PROJECT', '0'], ['Minus', 'BPM-', '-'], ['Equal', 'BPM+', '='], ['Backspace', 'DELETE', '⌫']],
  [['Tab', null, 'Tab'], ...letters('QWERTYUI', 1), ['KeyO', 'REC', 'O'], ['KeyP', 'SK1', 'P'], ['BracketLeft', 'SK2', '['], ['BracketRight', 'SK3', ']'], ['Backslash', 'SAMPLER', '\\']],
  [['CapsLock', null, 'Caps'], ...letters('ASDFGHJK', 9), ['KeyL', 'SK4', 'L'], ['Semicolon', 'SK5', ';'], ['Quote', 'SK6', "'"], ['Enter', 'SK7', '↵']],
  [['ShiftLeft', null, 'Shift'], ...[...'ZXCVBNM'].map((c, i) => [`Key${c}`, DRUM_ORDER[i], c]), ['Comma', 'SYNTH1', ','], ['Period', 'SYNTH2', '.'], ['Slash', 'DX', '/'], ['ShiftRight', null, 'Shift']],
  [['Space', 'PLAY', '空格'], ['ArrowLeft', 'HIGHPASS', '←'], ['ArrowUp', null, '↑'], ['ArrowDown', null, '↓'], ['ArrowRight', 'REPEATER', '→']],
];

const BY_CODE = new Map(KEY_ROWS.flat().filter(([, id]) => id).map(([code, id]) => [code, id]));
const BY_ID = new Map(KEY_ROWS.flat().filter(([, id]) => id).map(([, id, label]) => [id, label]));

/** 按下的是哪个控件（event.code → 控件 id）；不是键位里的键返回 null */
export const idOfCode = (code) => BY_CODE.get(code) || null;
/** 这个控件在键盘上是哪个键（键帽上的字）；没有专门的键返回 null */
export const keyOf = (id) => BY_ID.get(id) || null;
const CODE_OF = new Map(KEY_ROWS.flat().filter(([, id]) => id).map(([code, id]) => [id, code]));
/** 这个控件在键盘上的 event.code（走查用）；没有专门的键返回 null */
export const codeOf = (id) => CODE_OF.get(id) || null;
/** 键位里所有有键的控件：{ id: 键帽上的字 }（面板上标键位用） */
export const keyLabels = () => Object.fromEntries(BY_ID);
/** 旋钮和 [FX LEVEL]：能用 ↑ ↓ 转的 */
export const TURNABLE = new Set(['ALL', ...Object.keys(TRACK), 'SD1', 'SD2', 'SD3', 'SD4', 'FX', 'FXLEVEL']);

// 键帽下面那行小字：机器上的这个键叫什么
const SHORT = {
  ALL: 'ALL', MUTE: 'MUTE', SOLO: 'SOLO', PAGE: 'PAGE', BARLENGTH: 'BAR LEN', OCTAVE: 'OCTAVE', SCALE: 'SCALE', KEY: 'KEY', SWING: 'SWING',
  SDPAGE: '音色翻页', PROJECT: 'PROJECT↑', 'BPM-': 'BPM −', 'BPM+': 'BPM +', DELETE: 'DELETE', REC: '录音', PLAY: 'PLAY', HIGHPASS: 'HIGH PASS', REPEATER: 'REPEATER',
};
const nameOf = (id) => SHORT[id] || (TRACK[id]?.label) || (/^DK/.test(id) ? `步 ${id.slice(2)}` : /^SK/.test(id) ? `键 ${id.slice(2)}` : id);
const zoneOf = (id) => (!id ? 'none' : /^DK/.test(id) ? 'step' : /^SK|^REC$/.test(id) ? 'synth' : TRACK[id] ? 'track' : id === 'PLAY' ? 'play' : ['HIGHPASS', 'REPEATER'].includes(id) ? 'strip' : 'func');

// 机器上的控件在课文里的叫法（找“按住”的是哪一个、“转”的是哪一个）
const TEXT_NAME = {
  ALL: /\[ALL\]|ALL 旋钮|\bALL\b/, PROJECT: /PROJECT/, PLAY: /PLAY/, MUTE: /MUTE/, SOLO: /SOLO/, DELETE: /DELETE/, PAGE: /\[PAGE\]|PAGE\]/,
  OCTAVE: /OCTAVE/, SCALE: /SCALE/, KEY: /\[KEY\]/, SWING: /SWING/, BARLENGTH: /BAR LENGTH/, SDPAGE: /翻页键|Sound Design Page|SOUND DESIGN PAGE/i,
  RECSAMPLE: /REC SAMPLE/, 'VOL+': /VOL ?\+/, 'VOL-': /VOL ?[-−]/, 'BPM+': /BPM ?\+/, 'BPM-': /BPM ?[-−]/, UNDO: /UNDO/, CLEARFX: /CLEAR FX/,
  MASTERSINGLE: /MASTER\/SINGLE|MASTER \/ SINGLE/, FXLEVEL: /FX LEVEL/, HIGHPASS: /HIGH PASS/, REPEATER: /REPEATER/, FX: /\[FX\]|FX 旋钮/,
  SD1: /SOUND|最上面那个旋钮|旋钮 ?1|第 ?1 个旋钮/, SD2: /旋钮 ?2|第 ?2 个/, SD3: /旋钮 ?3|第 ?3 个/, SD4: /旋钮 ?4|第 ?4 个/, REC: /录音键/,
};
const textName = (id) => TEXT_NAME[id]
  || (TRACK[id] && new RegExp(TRACK[id].label.replace(' ', '\\s?')))
  || (/^DK/.test(id) && /步进键|方键|第\s?\d+\s?个|Drum key/)
  || (/^SK/.test(id) && /Synth key|演奏键/)
  || null;

// 只是“看这里”、不用按的
const LOOK_ONLY = new Set(['METER', 'INDEX', 'SPEAKER', 'USB', 'PHONES', 'AUDIOIN', 'MIDI', 'ZONE_DRUM', 'ZONE_SYNTH', 'ZONE_FX', 'JACKS']);
// 课文里的组：展开成一句话
const GROUP_KEYS = {
  DRUMKEYS: 'Q–I、A–K', SYNTHKEYS: "P [ ] L ; ' ↵", TRACKKNOBS: 'Z–/ 和 \\', DRUMKNOBS: 'Z–M', SYNTHKNOBS: ', . / \\',
};
const DEVICE_LABEL = {
  'VOL+': 'VOL+', 'VOL-': 'VOL−', RECSAMPLE: 'REC SAMPLE', UNDO: 'UNDO/REDO', CLEARFX: 'CLEAR FX', MASTERSINGLE: 'MASTER/SINGLE', FXPAGE: 'FX PAGE',
  SD1: 'SOUND 旋钮', SD2: '旋钮 2', SD3: '旋钮 3', SD4: '旋钮 4', FX: 'FX 旋钮', FXLEVEL: 'FX LEVEL', BARLENGTH: 'BAR LENGTH', HIGHPASS: 'HIGH PASS',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** 电脑键盘上的一个键（键帽的样子，和机器上的键 [PLAY] 区分开） */
export const kbdHtml = (label) => `<kbd class="pc">${esc(label)}</kbd>`;
const dev = (id) => `<kbd>${esc(DEVICE_LABEL[id] || id)}</kbd>`;
const UPDOWN = `${kbdHtml('↑')} / ${kbdHtml('↓')}`;

/** 课文里写的“按住 / 长按”后面紧跟着的是哪个控件（离“按住”最近的那个）；还有是不是要按满 2 秒 */
function heldIn(text, ids) {
  const held = new Map(); // id → 要不要按满 2 秒
  for (const m of text.matchAll(/按住|长按/g)) {
    const win = text.slice(m.index + m[0].length, m.index + m[0].length + 30);
    let best = null;
    for (const id of ids) {
      // 已经记下按住过的也要算进来：“按住 [OCTAVE] 转 [ALL]”写了两回，第二回不能跳过 OCTAVE 去挑后面的 ALL
      const re = textName(id);
      const at = re ? win.search(re) : -1;
      if (at >= 0 && (!best || at < best.at)) best = { id, at };
    }
    if (best && best.at <= 14) held.set(best.id, held.get(best.id) || /(2|两|二)\s?秒/.test(win));
    // “按住那个步进键 / 按住步进键不放”没说是第几个：列出来的步进键都是（一个一个按住来做）
    if (best && /^DK/.test(best.id) && /^\s?(那个)?步进键/.test(win)) for (const id of ids) if (/^DK/.test(id)) held.set(id, false);
  }
  return held;
}

// 一串单按的任务（填格子、弹音）：照课文里提到的先后排，同一个键提到两次就按两次
const SEQ_KINDS = new Set(['steps', 'hassteps', 'patsteps', 'stepkeys', 'stepnotes', 'note']);

/**
 * 按课文里提到的先后排（“按 Synth key 1，按亮第 1 个；按 Synth key 3，按亮第 9 个”：panel 里是先列方键、再列 Synth key；
 * “先按灭第 9、13 个，按 Synth key 6，再把第 9、13 个按亮”：方键按两回）。只用在一串单按的任务上；
 * panel 里每个键都在课文里找得到才照课文排，有一个找不到就照 panel 的先后。
 */
function textSequence(text, ids, kind) {
  if (!SEQ_KINDS.has(kind)) return ids;
  const seen = [];
  // 方键：“第 3、7、11、15 个”这种，每个数字的位置（“下排第 1、第 5 个”这种说位置的，不在 panel 里，自然丢掉）
  for (const m of text.matchAll(/第\s?((?:\d+\s?[、，,和]\s?)*\d+)\s?个/g)) {
    let off = m.index;
    for (const n of m[1].split(/[、，,和]/).map((x) => x.trim())) {
      const at = text.indexOf(n, off);
      off = at + n.length;
      seen.push([at, `DK${n}`]);
    }
  }
  for (const m of text.matchAll(/Synth key\s?(\d)/g)) seen.push([m.index, `SK${m[1]}`]);
  for (const id of ids) {
    if (/^(DK|SK)/.test(id) || GROUP_KEYS[id]) continue;
    const re = textName(id);
    if (!re) continue;
    for (const m of text.matchAll(new RegExp(re.source, 'g'))) seen.push([m.index, id]);
  }
  const seq = seen.filter(([, id]) => ids.includes(id)).sort((a, b) => a[0] - b[0]).map(([, id]) => id)
    .filter((id, i, a) => id !== a[i - 1]);
  return ids.every((id) => seq.includes(id)) ? seq : ids;
}

/** 课文里写着要“转”的旋钮 */
function turnedIn(text, ids, d) {
  const out = new Set();
  const knobs = ids.filter((id) => TURNABLE.has(id));
  for (const id of knobs) {
    const re = textName(id);
    if (!re) continue;
    const src = re.source;
    if (new RegExp(`(转|拧)\\s?(\\*\\*)?\\s?(${src})`).test(text) || new RegExp(`(${src})[^，。；]{0,8}(往上|往下|往回)?(转|拧)(?!到)`).test(text)) out.add(id);
  }
  // 条件本身就说明了是转：换乐句、拧参数、八度和音长（转 ALL）、混音台、选效果
  const kind = d?.kind;
  const track = d?.track;
  if (['pattern', 'patternat'].includes(kind) && track && ids.includes(track)) out.add(track);
  if (kind === 'combo' && /转/.test(text)) for (const t of Object.keys(d.pat || {})) if (ids.includes(t)) out.add(t);
  if (['notelen', 'scenelen'].includes(kind) && ids.includes('ALL')) out.add('ALL');
  if (kind === 'octave' && ids.includes('ALL') && /转/.test(text)) out.add('ALL');
  if (['param', 'polymode', 'plock', 'sound'].includes(kind) && /转|拧/.test(text)) for (const id of knobs) if (/^SD/.test(id)) out.add(id);
  if (['fxtype', 'masterfx'].includes(kind) && ids.includes('FX')) out.add('FX');
  if (kind === 'fxlevel' && ids.includes('FXLEVEL')) out.add('FXLEVEL');
  if (/转[^，。]{0,8}轨道的?旋钮/.test(text)) for (const id of ids) if (TRACK[id]) out.add(id);
  if (kind === 'mix') for (const id of ids) if (TRACK[id]) out.add(id); // 混音台里转轨道旋钮：列出来的轨道都是转
  return out;
}

/**
 * 一个动手任务在键盘上怎么按：一行 HTML，比如“按住 〔1〕 再按 〔Z〕”。从任务的 panel（要按的那几个键，按先后）、
 * 课文里的“按住 / 长按 / 转”和条件的种类拼出来。没有要按的键返回 ''。任务上写了 kbdHint（字符串，rich 的写法）就用它；kbdHint: false = 不要这一行。
 */
export function keyHint(task) {
  if (!task || task.kbdHint === false) return '';
  if (typeof task.kbdHint === 'string') return task.kbdHint;
  const text = String(task.text || '').replace(/\*\*/g, '');
  const d = task.sim || task.detect || null;
  const ids = textSequence(text, [...new Set((task.panel || []).filter((id) => !LOOK_ONLY.has(id)))], d?.kind);
  if (!ids.length) return '';
  if (/^(看|确认|听)/.test(text) && !/按|转|拧|推|弹|点/.test(text)) return ''; // 只是看一眼 / 听一听
  const held = heldIn(text, ids);
  // “同样的操作再做一次”：课文里没写“按住”，可这几个键单按没有用，后面又跟着别的键——就是按住它
  if (!held.size && ids.length > 1 && PURE_HOLD.has(ids[0])) held.set(ids[0], false);
  if (!held.size && ids.length > 1 && ids[0] === 'PAGE' && SYNTH_TRACKS.has(ids[1]) && !/单按/.test(text)) held.set('PAGE', false);
  const turned = turnedIn(text, ids, d);
  const parts = [];
  let holding = []; // 正按着的（后面的动作都是“再按”）
  let presses = []; // 连着的几个单按，合成一句
  let clicks = []; // 连着的几个没有专门键、要用鼠标点的
  const flushClicks = () => {
    if (!clicks.length) return;
    parts.push(`${holding.length ? '再' : ''}用鼠标点 ${clicks.map(dev).join('、')}（或按 Tab 选中再按回车）`);
    clicks = [];
  };
  let afterCombo = false; // 刚做完一个“按住 A 再转 / 再按”：后面的单按写“然后按”
  const flush = () => {
    flushClicks();
    if (!presses.length) return;
    const keys = presses.map((id) => (GROUP_KEYS[id] ? GROUP_KEYS[id].split(/\s|、/).filter(Boolean).map(kbdHtml).join(' ') : kbdHtml(keyOf(id))));
    parts.push(`${holding.length ? '再按' : afterCombo ? '然后按' : '按'} ${keys.join('、')}${presses.some((id) => GROUP_KEYS[id]) ? ' 里的键' : ''}`);
    presses = [];
    afterCombo = false;
  };
  // 按着的那几个键里，↑ ↓ 转的正是这个旋钮吗（按着轨道键 → 那条轨道；按着 [OCTAVE]、步进键、[PAGE] → ALL）
  const turnsWith = (id) => holding.some((x) => x === id || (id === 'ALL' && (x === 'OCTAVE' || x === 'PAGE' || /^DK/.test(x))));
  const dkHeld = ids.filter((id) => /^DK/.test(id) && held.has(id));
  for (const id of ids) {
    if (GROUP_KEYS[id]) {
      presses.push(id);
      continue;
    }
    const key = keyOf(id);
    if (held.has(id)) {
      flush();
      const long = held.get(id);
      if (/^DK/.test(id) && dkHeld.length > 1) {
        if (id !== dkHeld[0]) continue; // 几个步进键一样的做法：写在一起
        parts.push(`按住那个步进键（${dkHeld.map((x) => kbdHtml(keyOf(x))).join(' / ')}）`);
        holding.push(id);
        continue;
      }
      if (!key) parts.push(`用鼠标按住 ${dev(id)}${long ? ' 2 秒' : ' 半秒（出现黑圈）'}`);
      else parts.push(`${holding.length ? '再按住' : '按住'} ${kbdHtml(key)}${long ? ' 2 秒' : ''}`);
      holding.push(id);
      continue;
    }
    if (id === 'HIGHPASS' || id === 'REPEATER') {
      flush();
      // 这一项要的是“手松开”：写松开
      if (d?.on === false || /松手|松开/.test(text)) parts.push(`松开 ${kbdHtml(key)}（手指离开 ${dev(id)}）`);
      else {
        parts.push(`按住 ${kbdHtml(key)}（手指按在 ${dev(id)} 上；同时按 ${kbdHtml('↑')} 往上推）`);
        holding.push(id);
      }
      continue;
    }
    if (turned.has(id)) {
      flush();
      if (turnsWith(id)) {
        parts.push(`再按 ${UPDOWN}`);
        // 一串单按里夹着的“按住 [OCTAVE] 转 [ALL]”：转完就松开了，后面的按键不是按着它按的
        if (SEQ_KINDS.has(d?.kind)) {
          holding = [];
          afterCombo = true;
        }
        continue;
      }
      else if (key) parts.push(`按住 ${kbdHtml(key)} 再按 ${UPDOWN}`);
      else parts.push(`鼠标指着 ${dev(id)}（或按 Tab 选中它）按 ${UPDOWN}`);
      continue;
    }
    if (!key) {
      if (presses.length) flush();
      clicks.push(id);
      continue;
    }
    flushClicks();
    // 组合键做完再按 [PLAY]（“再做一次，然后按 [PLAY] 停下”）：那是另一下，不是按着第一个键按的（按着 ALL 按 PLAY 是看电量，课文会写“按住 [ALL]”）
    if (id === 'PLAY' && holding.length && !holding.includes('ALL')) {
      flush();
      holding = [];
      parts.push(`然后按 ${kbdHtml(key)}`);
      continue;
    }
    presses.push(id);
  }
  flush();
  // 最后一下是“按住”、后面没东西了：课文里“按住 A 再按 B”的 B 在 panel 里排在前面（“按一下 SYNTH 1，并进入步进输入（按住 [PAGE] 再按 SYNTH 1）”）
  const last = holding[holding.length - 1];
  if (last && parts[parts.length - 1]?.includes(kbdHtml(keyOf(last) || '')) && !held.get(last) && !['HIGHPASS', 'REPEATER'].includes(last)) {
    const after = text.slice(text.lastIndexOf('按住') + 2);
    const m = after.match(/再按(?:一下)?\s?([^，。）)]{0,16})/);
    const next = m && ids.find((id) => id !== last && keyOf(id) && textName(id)?.test(m[1]));
    if (next) parts.push(`再按 ${kbdHtml(keyOf(next))}`);
  }
  return parts.length ? parts.join('，') : '';
}

// 单按没有用、只当组合键的第一个键的
const PURE_HOLD = new Set(['MUTE', 'SOLO', 'DELETE', 'PROJECT']);
const SYNTH_TRACKS = new Set(['SYNTH1', 'SYNTH2', 'DX', 'SAMPLER']);

// 活体键位仪：页面上有键位图时，按电脑键盘（或用鼠标点图上的键）会实时点亮并试听
const liveViews = new Set();
let liveHooked = false;
const SYNTH_PREVIEW = [60, 63, 65, 67, 70, 72, 75]; // C 小调七个键

function previewId(id, allowSound = true) {
  if (!id || !allowSound) return;
  const play = () => {
    if (DRUM_ORDER.includes(id)) sound.drum(id, 0, 0.88);
    else if (id === 'SYNTH1') sound.note(48, 0, 0.24, 'bass', 0.75);
    else if (id === 'SYNTH2') sound.note(60, 0, 0.26, 'polysynth', 0.7);
    else if (id === 'DX') sound.note(67, 0, 0.28, 'fmep', 0.72);
    else if (id === 'SAMPLER') sound.drum('CLAP', 0, 0.75);
    else if (/^SK(\d)$/.test(id)) sound.note(SYNTH_PREVIEW[Number(id.slice(2)) - 1] || 60, 0, 0.26, 'keys', 0.78);
    else if (/^DK(\d+)$/.test(id)) sfx.penta(Number(id.slice(2)) - 1);
    else sfx.play('tick');
  };
  if (audio.ready) play();
  else audio.init().then((ok) => ok && play());
}

function ensureLiveHook() {
  if (liveHooked) return;
  liveHooked = true;
  const typing = (el) => !!el?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
  const prune = () => {
    for (const v of liveViews) if (!v.root.isConnected) liveViews.delete(v);
  };
  addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing || typing(e.target)) return;
    prune();
    if (!liveViews.size) return;
    const id = idOfCode(e.code);
    const simActive = !!document.querySelector('.panel-wrap .panel-svg');
    for (const v of liveViews) v.setDown(e.code, true, id);
    if (!e.repeat && id && !simActive) previewId(id, true);
  }, true);
  addEventListener('keyup', (e) => {
    prune();
    for (const v of liveViews) v.setDown(e.code, false);
  }, true);
  addEventListener('blur', () => {
    for (const v of liveViews) v.clearAll();
  });
}

/**
 * 整张键位图：画成一块电脑键盘，每个键上写着它在机器上是哪个键，颜色按机器上的分区（步进键、演奏键、轨道旋钮、功能键）。
 * 敲键盘或用鼠标点键帽会实时下沉点亮（页面上没有模拟机时还会发出对应的试音）。
 * opts.compact = 小一号（课文里、设备页上用的是正常大小，弹出来的那张也是）
 */
export function keymapView({ compact = false } = {}) {
  ensureLiveHook();
  const byCode = new Map();
  const status = !compact ? h('div', { class: 'km-live', 'aria-live': 'polite' }, h('span', { class: 'km-dot' }), h('span', {}, '直接按电脑键盘或点下面的键帽，可以实时测试键位与声音')) : null;
  const tell = (label, id, code) => {
    if (!status) return;
    const turn = code === 'ArrowUp' || code === 'ArrowDown';
    status.classList.add('active');
    status.lastChild.textContent = turn
      ? `刚按下 〔${label}〕 → 转动当前按住或指着的旋钮`
      : id ? `刚按下 〔${label}〕 → 机器上的 ${DEVICE_LABEL[id] || nameOf(id)}（${id}）` : `〔${label}〕 在模拟机里不用`;
  };
  const rows = KEY_ROWS.map((row, r) => h('div', { class: ['km-row', `km-r${r}`] }, row.map(([code, id, label]) => {
    const wide = ['Tab', 'CapsLock', 'ShiftLeft', 'ShiftRight', 'Backspace', 'Enter', 'Space'].includes(code);
    const turn = code === 'ArrowUp' || code === 'ArrowDown';
    const keyEl = h('div', {
      class: ['km-key', `z-${turn ? 'turn' : zoneOf(id)}`, wide && 'wide', `k-${code}`],
      dataset: { code, id: id || '' },
      title: id ? `${label} = ${nameOf(id)}（点一下试听）` : '',
      onpointerdown: !compact && (id || turn) ? (e) => {
        if (e.button !== 0) return;
        keyEl.classList.add('is-live');
        tell(label, id, code);
        previewId(id, true);
        const up = () => {
          keyEl.classList.remove('is-live');
          removeEventListener('pointerup', up, true);
          removeEventListener('pointercancel', up, true);
        };
        addEventListener('pointerup', up, true);
        addEventListener('pointercancel', up, true);
      } : null,
    },
      h('b', {}, label),
      h('small', {}, turn ? '转旋钮' : id ? nameOf(id) : ''));
    byCode.set(code, { el: keyEl, label, id });
    return keyEl;
  })));
  const legend = h('div', { class: 'km-legend' },
    [['step', '步进键（机器上那两排方键，1–16）'], ['synth', '录音键 + 7 个 Synth keys'], ['track', '轨道旋钮（按 = 选中；按着它再按 ↑ ↓ = 转）'], ['func', '功能键（机器边上那一圈）'], ['strip', '触摸条：按着 = 手指按在上面']]
      .map(([z, t]) => h('span', {}, h('i', { class: `z-${z}` }), t)));
  const root = h('div', { class: ['keymap', compact && 'compact'] }, status, h('div', { class: 'km-board' }, rows), legend);
  liveViews.add({
    root,
    setDown(code, isDown, id) {
      const item = byCode.get(code);
      if (!item) return;
      item.el.classList.toggle('is-live', isDown);
      if (isDown) tell(item.label, id || item.id, code);
    },
    clearAll() {
      for (const item of byCode.values()) item.el.classList.remove('is-live');
    },
  });
  return root;
}

/** 键位的几句话（教练的上下文、设备页、0.1 用）：每样一行 */
export const KEYMAP_LINES = [
  '空格 = [PLAY]（短按播放 / 停止，按住 2 秒开关机）',
  'Q W E R T Y U I = 上排步进键 1–8；A S D F G H J K = 下排步进键 9–16',
  "O = 录音键；P [ ] = Synth key 1 2 3；L ; ' 回车 = Synth key 4 5 6 7（和机器上一样摆）",
  'Z X C V B N M = KICK SNARE CLAP HAT1 HAT2 PERC1 PERC2；, . / = SYNTH 1、SYNTH 2、DX；\\ = SAMPLER',
  '` = ALL；1 MUTE · 2 SOLO · 3 PAGE · 4 BAR LENGTH · 5 OCTAVE · 6 SCALE · 7 KEY · 8 SWING · 9 音色翻页 · 0 PROJECT↑ · - BPM− · = BPM+ · ⌫ DELETE',
  '← = 手指按在 [HIGH PASS] 上，→ = 手指按在 [REPEATER] 上（按着时按 ↑ ↓ 往上推 / 往下拉，松开 = 手离开）',
  '↑ ↓ = 转旋钮：按着轨道键（或 `）时转那个旋钮；按着 5 OCTAVE 或步进键时转 ALL；别的旋钮用鼠标指着它（或按 Tab 选中）再按',
  '鼓轨上：按着一个亮着的步进键再按 ↑ ↓ = 只改这一步的力度（它变紫色）；按着 3 PAGE 再按着一条鼓轨的键（Z–M）按 ↑ ↓ = 改它这段乐句有几步',
  '按住电脑上的键 = 按住机器上的键：组合键就是按着第一个、再按第二个',
  '没有专门键的（VOL+ VOL− REC SAMPLE UNDO CLEAR FX MASTER/SINGLE FX PAGE、右边 4 个旋钮、FX 旋钮、FX LEVEL）：用鼠标点，或按 Tab 选中再按回车',
  '? = 弹出整张键位图',
];
