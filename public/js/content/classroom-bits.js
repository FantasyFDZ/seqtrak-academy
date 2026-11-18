// 小课堂“用在机器上”那一步里常用的几句话（原来写在 content/classroom.js 开头，2026-11-15 四条线分文件以后挪到这里共用）。
// 机器上的操作一律以 docs/seqtrak-operation-reference.md 为准。text 是通用的说法，liveText 是接着真机时换用的说法，
// simText 是只在屏幕上的模拟机里才这么说的（模拟机上组合键是“长按第一个，出现黑圈，再点第二个”）。
// detect 是“这一步做到了”的条件，种类见 public/js/classroom-bench.js；没有 detect 的要自己点按钮（按钮上的字是 manual）。
// goal 是动手关“金”那一档只给的一句话：只说要做成什么样，不说怎么按。
// kbdText 是键盘学习方式下（电脑键盘按模拟机）换用的说法：电脑键盘上“按住”就是真的按住，没有黑圈。没写就用 simText。

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
  PERC1: '左边那块、下排左数第 3 个旋钮', PERC2: '左边那块、下排左数第 4 个旋钮',
  SYNTH1: '中间那块、上排左边的旋钮', SYNTH2: '中间那块、上排右边的旋钮',
};
export const LABEL = { KICK: 'KICK', SNARE: 'SNARE', CLAP: 'CLAP', HAT1: 'HAT 1', HAT2: 'HAT 2', PERC1: 'PERC 1', PERC2: 'PERC 2', SYNTH1: 'SYNTH 1', SYNTH2: 'SYNTH 2' };
// 键盘学习方式的键位里这里用得着的几个（和 public/js/keymap.js 的 KEY_ROWS 一样；这个文件要能在 node 里单独加载，所以不去引它）：
// 7 条鼓轨的轨道键、16 个方键
const PC_TRACK = { KICK: 'Z', SNARE: 'X', CLAP: 'C', HAT1: 'V', HAT2: 'B', PERC1: 'N', PERC2: 'M' };
const PC_STEP = 'QWERTYUIASDFGHJK';
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

/**
 * 把一条鼓轨当前这段乐句改成正好 steps 步（1–128；不是整小节也行：3 步、12 步……）。只能用在鼓轨上。
 * 手册 3.7.4 的方法 B：按住 [PAGE] 的同时转这条鼓轨的旋钮，一步一步地改；把旋钮按下去再转是 16 步一档；小节数显示在右边那列小灯上，步数显示在方键上。
 * 模拟机上认得出（detect: steplen）。真机镜像读不到鼓轨的长度：接着真机时这一项自己点。
 * 往哪边转是变长，手册没写：真机上的说法是“转着看”；模拟机上往上是长、往下是短。
 */
export const STEP_LEN = (track, steps, after = '') => {
  const name = LABEL[track];
  const bars = Math.ceil(steps / 16);
  const shown = steps <= 16
    ? `方键上白色亮着前 **${steps}** 个 = **${steps} 步**`
    : `**${steps} 步**（右边那列小灯亮 ${bars} 个 = ${bars} 小节，方键上白色亮着的是最后一页的 ${steps % 16 || 16} 步；下面那行字也会报数）`;
  return {
    text: `改 ${name} 这段乐句有几步：**按住**左侧面的 [PAGE]（最下面的 [PLAY] 上面那个键）**不放**，同时慢慢转 **${name} 旋钮**（${KNOB[track]}）。别把旋钮按下去：按下去转是 16 步一档。步数显示在方键上，转着看，转到 **${steps} 步**停。${after}`,
    simText: `改 ${name} 这段乐句有几步：**长按**左侧面的 [PAGE]（最下面的 [PLAY] 上面那个键）半秒，它出现黑圈；再**上下拖** **${name} 旋钮**（${KNOB[track]}；也可以用滚轮），往下是短、往上是长，一格一步。拖到${shown}。${after}`,
    kbdText: `改 ${name} 这段乐句有几步：**按住** 〔3〕（[PAGE]）**不放**，再**按住** 〔${PC_TRACK[track]}〕（${name}），按 〔↓〕 变短、〔↑〕 变长，一下一步。按到${shown}，然后都松开。${after}`,
    goal: `让 ${name} 这段乐句正好 ${steps} 步。`,
    panel: ['PAGE', track], detect: { kind: 'steplen', track, steps }, manual: `${steps} 步了`, wait: `按住 [PAGE]，转 ${name} 旋钮…`,
  };
};

/**
 * 给一条鼓轨的第 n 个方键（1 起数，要是亮着的）那一步单独改力度。opts.dir：'up' = 让它比别的重（默认）、'down' = 比别的轻、null = 改了就算。
 * opts.lead：开头那半句，不写就是“给一步单独改力度”（别的关想换个说法，比如“给第 1 下写个 f”）；opts.after：接在最后的一句。
 * 手册 3.6.1（Parameter Lock：按住亮着的 Drum key 转 Sound Design 旋钮，这一步亮紫色）+ 3.11.2（鼓轨第 1 页旋钮 4 = VOLUME，锁它改的是这一步的力度）。
 * 往哪边转是轻、锁完机器报不报，手册没写、也没人在真机上试过：真机上的说法只说“转着听”，接着真机时这一项自己点。
 * 模拟机上认得出（detect: stepvel），往上是重、往下是轻（模拟机自己定的）。只认第 1 页（一页 16 步）上的方键。
 */
export const STEP_VEL = (track, n, { dir = 'up', after = '', lead = '给一步单独改力度' } = {}) => {
  const name = LABEL[track];
  const want = dir === 'up' ? '重' : dir === 'down' ? '轻' : '';
  return {
    text: `${lead}：**按住**亮着的第 **${n}** 个方键**不放**，转一转右边那 4 个旋钮里**从上往下第 4 个**（右边那列字里 VOLUME 亮；要是没亮，先按一下三个小点的键翻回第 1 页）。只有这一步变了，它的方键变成**紫色**。转着听${want ? `，让它比别的${want}` : '这一步怎么变'}。${after}`,
    simText: `${lead}：**长按**亮着的第 **${n}** 个方键半秒，它出现黑圈（短按一下是把它按灭）；再**上下拖**右边那 4 个旋钮里**从上往下第 4 个**（VOLUME；也可以用滚轮；看不到右边那一块，就把面板往左滑）。只有这一步变了，它的方键变成**紫色**。${want ? `往${dir === 'up' ? '上' : '下'}拖，让它比别的${want}；` : ''}调好了再点一下那个方键松开。${after}`,
    kbdText: `${lead}：**按住** 〔${PC_STEP[n - 1]}〕（亮着的第 **${n}** 个方键）**不放**，按 ${want ? `〔${dir === 'up' ? '↑' : '↓'}〕 让它比别的${want}` : '〔↑〕 / 〔↓〕'}：转的是右边从上往下第 4 个旋钮（VOLUME）。只有这一步变了，它的方键变成**紫色**。调好了松手。${after}`,
    goal: `给 ${name} 第 ${n} 个方键那一步单独改力度${want ? `，让它比别的${want}` : ''}（按住它，转 VOLUME）。`,
    panel: [`DK${n}`, 'SD4'], detect: { kind: 'stepvel', track, step: n - 1, dir }, manual: '改好了', wait: `按住第 ${n} 个方键，转第 4 个旋钮…`,
  };
};
