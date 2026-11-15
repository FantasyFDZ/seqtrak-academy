// 小课堂“用在机器上”那一步里常用的几句话（原来写在 content/classroom.js 开头，2026-11-15 四条线分文件以后挪到这里共用）。
// 机器上的操作一律以 docs/seqtrak-operation-reference.md 为准。text 是通用的说法，liveText 是接着真机时换用的说法，
// simText 是只在屏幕上的模拟机里才这么说的（模拟机上组合键是“长按第一个，出现黑圈，再点第二个”）。
// detect 是“这一步做到了”的条件，种类见 public/js/classroom-bench.js；没有 detect 的要自己点按钮（按钮上的字是 manual）。
// goal 是动手关“金”那一档只给的一句话：只说要做成什么样，不说怎么按。

export const PLAY = (after = '') => ({
  text: `**短按**一下 [PLAY]（左侧面最下面那个键）。${after}`,
  liveText: `**短按**一下左侧面最下面的 [PLAY]：按一下就松，按住 2 秒是关机。${after}`,
  goal: '让机器放起来。',
  panel: ['PLAY'], detect: { kind: 'start' }, wait: '等你按 [PLAY]…',
});
export const STOP = (after = '') => ({ text: `再**短按**一下 [PLAY]，停下。${after}`, goal: '停下。', panel: ['PLAY'], detect: { kind: 'stop' }, wait: '等你停下…' });
export const KNOB = {
  KICK: '左边那块、上排左数第 2 个旋钮', SNARE: '左边那块、上排左数第 3 个旋钮', CLAP: '左边那块、上排左数第 4 个旋钮',
  HAT1: '左边那块、下排左数第 1 个旋钮', HAT2: '左边那块、下排左数第 2 个旋钮',
  SYNTH1: '中间那块、上排左边的旋钮', SYNTH2: '中间那块、上排右边的旋钮',
};
export const LABEL = { KICK: 'KICK', SNARE: 'SNARE', CLAP: 'CLAP', HAT1: 'HAT 1', HAT2: 'HAT 2', SYNTH1: 'SYNTH 1', SYNTH2: 'SYNTH 2' };
export const PICK = (track, after = '') => ({
  text: `按一下 **${LABEL[track]} 旋钮**（${KNOB[track]}）。只按，别转。${after}`,
  goal: `选中 ${LABEL[track]}。`,
  panel: [track], detect: { kind: 'track', track }, wait: `等你按 ${LABEL[track]} 旋钮…`,
});
export const TO_MASTER = {
  text: '看右边桔红色那块：有个小拨动开关，左边写 MASTER，右边写 SINGLE。把它拨到 **MASTER**（左边）：接下来动的是**整台机器**的声音。',
  simText: '看右边桔红色那块：有个小拨动开关，左边写 MASTER，右边写 SINGLE。点它一下，看下面那行字，让它停在 **MASTER**：接下来动的是**整台机器**的声音。',
  goal: '让效果管整台机器。',
  panel: ['MASTERSINGLE'], detect: { kind: 'master' }, manual: '拨好了', wait: '等你拨到 MASTER…',
};
export const FX_LEVEL = (after) => ({
  text: `开关下面那条竖着的触摸条是 [FX LEVEL]。手指按上去**上下滑**：${after}`,
  simText: `开关下面那条竖着的条是 [FX LEVEL]。按住它**上下拖**：${after}`,
  goal: '把效果加上去，听它。',
  panel: ['FXLEVEL'], detect: { kind: 'fxlevel' }, wait: '等你滑 [FX LEVEL]…',
});
export const CLEAR_FX = {
  text: '按一下 [CLEAR FX]（那一列正上方、机器上边沿的小按钮）：效果收到最小，回到原声。',
  goal: '一键回到原声。',
  panel: ['CLEARFX'], detect: { kind: 'clearfx' }, wait: '等你按 [CLEAR FX]…',
};
export const FX_TO = (cat, after) => ({
  text: `转那一列最上面的 **[FX] 旋钮**（它下面印着 FX）。边转边看左边那列文字，亮的那一行会跟着换：转到 **${cat}** 亮就停。${after}`,
  simText: `按住那一列最上面的 **[FX] 旋钮**（它下面印着 FX）**上下拖**。边拖边看左边那列文字，亮的那一行会跟着换：拖到 **${cat}** 亮就停。${after}`,
  goal: `把效果换成 ${cat} 这一类。`,
  panel: ['FX', 'INDEX'], detect: { kind: 'fxtype', cat }, manual: `${cat} 亮了`, wait: `等 ${cat} 亮…`,
});
/** 让方键正好亮这几个（1 起数）：鼓轨的格子 */
export const STEPS = (track, list, text, after = '') => ({
  text: `${text}${after}`,
  goal: `让 ${LABEL[track]} 正好亮第 ${list.join('、')} 个方键。`,
  panel: list.map((n) => `DK${n}`), detect: { kind: 'steps', track, steps: list.map((n) => n - 1) }, wait: '等这几个亮…',
});
