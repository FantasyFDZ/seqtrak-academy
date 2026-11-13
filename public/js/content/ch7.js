// 第 7 章 · 效果与现场。写法和前几章一样（见 curriculum.js 顶部、ch0.js 顶部关于 live* 的说明）。
//
// 机器操作的依据（docs/seqtrak-operation-reference.md）：3.12.1 三层效果（轨道效果：SINGLE EFFECT → 滤波器 → 2 段 EQ；送出效果：DELAY、REVERB 并联、
// 每条轨道自己定送多少；主效果：MASTER → HIGH PASS → REPEATER → 压缩 → 5 段 EQ）；3.11.2 进阶第 3 页旋钮 1、2 = 混响 / 延迟送多少；
// 3.15.1 混音台模式（[ALL] + [VOL+]；按 Sound Design 旋钮 1–4 选 声像 / 音量 / 混响送 / 延迟送；转轨道旋钮调）；3.12.4 触摸条（手指离开
// [HIGH PASS] / [REPEATER] 就关；Page 1 上它俩永远作用于全部轨道）；3.12.5 [CLEAR FX]；3.15.2 静音模式（[ALL] + [MUTE]，[ALL] 旁 3 个灯绿；
// 直接按旋钮静音；按 [ALL] 全部取消；按 [MUTE] 退出；静音模式里不能预约换段）；3.7.2 预约换段；3.10.3 临时保存与恢复；3.9 UNDO/REDO。
// 手册没写的：触摸条往哪头是“多”（课文说“往上推”，模拟机也是往上多；真机上推着听）。
// 2026-11-12 实测（docs/hardware-findings.md）：SYNTH 2 的混响 / 延迟送多少在 31 18 19 / 31 18 1A（CC 91 / 94 写进去读得回来）——
// 镜像据此认出 SYNTH 1 / 2 上“送多了一点混响”。[HIGH PASS] / [REPEATER] 第三方资料说发 CC 105 / 106（没在这台机器上试过）；混音台模式、静音模式、
// 临时保存机器报不报不知道：那几项真机上要自己点“我已经做了”。静音了没有、在第几段、鼓轨每一步，应用读得出来。
// 例子只用用户听过的歌（songs.js 开头那 11 首）：Animals、Levels 进高潮前的铺垫，Blinding Lights 的混响。
import { CH3_LOOP } from './ch4.js';
import { CH6_SEED } from './ch6.js';

const PLAY = (text = '短按 [PLAY]（左侧面最下面），让循环放着。') => ({ text, panel: ['PLAY'], detect: { kind: 'start' }, wait: '点 [PLAY]…', liveWait: '等你按 [PLAY]…' });
const STOP = (text = '听够了按 [PLAY] 停下。') => ({ text, panel: ['PLAY'], detect: { kind: 'stop' }, wait: '再点 [PLAY]…', liveWait: '等你停止…' });
const PROJECT4 = { text: '确认在 **4 号工程**：不在就**先按住** [PROJECT↑]（右侧面最下面）**不放，再按**上排**第 4 个**方键。已经在的话会自己打勾。', panel: ['PROJECT', 'DK4'], detect: { kind: 'project', in: [3] }, wait: '长按 [PROJECT↑] 出现黑圈，再点上排第 4 个方键…', liveWait: '等机器在 4 号工程…' };
const LIVE_MANUAL = (what) => ({ callout: 'warn', title: '这几样机器不一定告诉应用', text: `${what}机器报不报给应用还不知道：没打勾就点“我已经做了”。` });

export const ch7 = {
  id: 'ch7',
  no: 7,
  title: '效果与现场',
  subtitle: '用手把一首歌“演”出来',
  lessons: [
    // ───────────────────────── 7.1 ─────────────────────────
    {
      id: '7-1',
      simProject: 3,
      simSeed: CH3_LOOP,
      no: '7.1',
      title: '三层效果：轨道、送出、总输出',
      minutes: 35,
      summary: '效果器在声音走的路上分三层；混响、延迟是大家共用的“房间”，每条轨道自己定送多少；混音台模式一次看全部轨道的音量和送多少。',
      takeaway: '声音走的路上有三层效果：**轨道效果**（每条轨道自己的：SINGLE 效果、滤波器、EQ，第 4 章用过）→ **送出效果**（混响、延迟，大家**共用**一个，每条轨道决定**送多少**过去）→ **主效果**（整台最后那一道：MASTER 效果、[HIGH PASS]、[REPEATER]……）。一条轨道送多少混响：进阶第 3 页的旋钮 1（延迟是旋钮 2）；或者进**混音台模式**（**按住 [ALL] 再按 [VOL+]**），**按**右边第 3 个旋钮选“混响送多少”，再**转**各条轨道的旋钮——一次调全部轨道。',
      steps: [
        {
          type: 'read',
          title: '效果在声音走的路上',
          blocks: [
            '一条轨道的声音从“乐手”出来，到你耳朵里，路上要过三道：',
            { list: [
              '**轨道效果**：每条轨道**自己**的。[MASTER/SINGLE] 拨到 SINGLE 时 [FX] 选的效果、第 2 页的滤波器、进阶第 3 页的高低音（EQ）。第 4 章用过：它们跟着音色走。',
              '**送出效果**：**混响**（REVERB，像把声音放进一个大房间）和**延迟**（DELAY，回声）。整台只有一个混响、一个延迟，**大家共用**；每条轨道自己决定“送多少过去”。',
              '**主效果**：整台声音最后那一道。[MASTER/SINGLE] 拨到 MASTER 时 [FX] 选的效果、[HIGH PASS]、[REPEATER] 两条触摸条（下一课），还有只能在 App 里调的压缩和 EQ。',
            ] },
            { panel: ['FX', 'MASTERSINGLE', 'FXLEVEL', 'HIGHPASS', 'REPEATER', 'SD1', 'SD2'], caption: '右边那一块：[FX] 旋钮和 [MASTER/SINGLE] 开关管 SINGLE / MASTER 效果，下面三条是触摸条。混响、延迟送多少在 Sound Design 旋钮的进阶第 3 页（旋钮 1、2），或者混音台模式里。' },
            { callout: 'dj', text: '和 DJ 混音台一模一样：每个通道上的 EQ、滤波 = 轨道效果；混音台上的 SEND 旋钮把一点声音送去效果器 = 送出效果；总输出上的效果 = 主效果。**Blinding Lights** 那种“远远的、很大的空间感”，就是送了不少混响。' },
            { callout: 'tip', text: '为什么混响要“共用、各自送多少”？因为大家在**同一个房间**里才像一个乐队：和弦多送一点（远、宽），底鼓几乎不送（近、紧）。底鼓送多了，低音会糊成一片。' },
            { classroom: 'F5' },
            { classroom: 'F6' },
          ],
        },
        {
          type: 'do',
          title: '给和弦送一点混响和回声',
          blocks: [
            'SYNTH 2（和弦）多送一点混响，再送一点延迟：和弦变远、变宽，后面拖着回声。',
            { callout: 'tip', text: '模拟机上：翻页键在右边那一列下面，**按住 2 秒**进进阶设置，再单按翻页。' },
          ],
          liveBlocks: [
            'SYNTH 2（和弦）多送一点混响，再送一点延迟：和弦变远、变宽，后面拖着回声。',
            { device: ['sdmode', 'sdpage'] },
            { callout: 'tip', text: '应用读得出 SYNTH 2 送了多少混响、延迟（0–127）：转的时候看屏幕上的镜像。' },
          ],
          tasks: [
            PROJECT4,
            { text: '按一下 **SYNTH 2 旋钮**（中间合成器区上排右边），只按不转。', panel: ['SYNTH2'], detect: { kind: 'track', track: 'SYNTH2' }, wait: '点一下 SYNTH 2 旋钮…', liveWait: '等你按 SYNTH 2 旋钮…' },
            { text: '**长按**翻页键（右边那一列正下方、印着三个小点）**2 秒**：进进阶设置。', panel: ['SDPAGE'], detect: { kind: 'sdmode', on: true }, wait: '在翻页键上按住 2 秒…', liveWait: '长按翻页键 2 秒…' },
            { text: '**单按**翻页键，翻到**第 3 页**（小灯从上往下第 3 个亮）。', panel: ['SDPAGE', 'METER'], detect: { kind: 'sdpage', page: 2 }, wait: '单按翻页键，翻到第 3 页…', liveWait: '单按翻页键，翻到第 3 页…' },
            PLAY(),
            { text: '**第 1 个旋钮**（Index 亮 REVERB）往大转：和弦变远、变宽。', panel: ['SD1', 'INDEX'], detect: { kind: 'param', track: 'SYNTH2', param: 'rev', dir: 1, by: 12 }, wait: '把第 1 个旋钮往上拖几格…', liveWait: '往大转第 1 个旋钮（转多一点）…' },
            { text: '**第 2 个旋钮**（Index 亮 DELAY）往大转：后面拖出回声。', panel: ['SD2', 'INDEX'], detect: { kind: 'param', track: 'SYNTH2', param: 'dly', dir: 1, by: 12 }, wait: '把第 2 个旋钮往上拖几格…', liveWait: '往大转第 2 个旋钮（转多一点）…' },
            STOP(),
            { text: '**长按**翻页键 2 秒，出进阶设置。', panel: ['SDPAGE'], detect: { kind: 'sdmode', on: false }, wait: '在翻页键上按住 2 秒…', liveWait: '长按翻页键 2 秒…' },
          ],
          done: '和弦在“房间”里了。',
          coach: '学生在给 SYNTH 2 送混响和延迟：选中 SYNTH 2；长按 Sound Design Page 键 2 秒进 advanced settings；单按翻到第 3 页（Index REVERB / DELAY）；按 [PLAY]；旋钮 1 = REVERB SEND、旋钮 2 = DELAY SEND（CC 91 / 94），往大转；最后长按 2 秒出进阶设置。应用实测读得出 SYNTH 2 的这两样（31 18 19 / 31 18 1A，0–127）。送出效果是全部轨道共用的一个混响、一个延迟。',
        },
        {
          type: 'do',
          title: '混音台模式：一次看全部轨道',
          blocks: [
            '一条一条进进阶设置太慢。**混音台模式**里，右边 4 个旋钮变成“选调什么”，**轨道旋钮**变成每条轨道的推子。',
            { list: [
              '进出：**按住 [ALL] 旋钮，再按 [VOL+]**（左侧面最上面）。Index 上 **MIXER** 亮。',
              '**按**（按下去，不是转）右边第 1–4 个旋钮选要调的：1 声像、2 音量、3 混响送多少、4 延迟送多少。',
              '**转**轨道旋钮 = 调那条轨道的这一样。这时转旋钮**不换乐句**。',
            ] },
            { callout: 'tip', text: '模拟机上：按右边的旋钮 = 点一下它；转 = 在它上面往上 / 往下拖。' },
          ],
          liveBlocks: [
            '一条一条进进阶设置太慢。**混音台模式**里，右边 4 个旋钮变成“选调什么”，**轨道旋钮**变成每条轨道的推子。',
            { list: [
              '进出：**按住 [ALL] 旋钮，再按 [VOL+]**（左侧面最上面）。Index 上 **MIXER** 亮。',
              '**按**（按下去，不是转）右边第 1–4 个旋钮选要调的：1 声像、2 音量、3 混响送多少、4 延迟送多少。',
              '**转**轨道旋钮 = 调那条轨道的这一样。这时转旋钮**不换乐句**。',
            ] },
            LIVE_MANUAL('混音台模式、按旋钮选参数、鼓轨的音量和送多少，'),
          ],
          tasks: [
            { text: '进混音台模式：**先按住** [ALL] 旋钮（鼓区左上角）**不放，再按** [VOL+]（左侧面最上面）。Index 上 **MIXER** 亮。', panel: ['ALL', 'VOL+', 'INDEX'], sim: { kind: 'mixer', on: true }, wait: '长按 ALL 旋钮出现黑圈，再点 [VOL+]…', liveWait: '按住 [ALL] 再按 [VOL+]（做完点“我已经做了”）…' },
            PLAY(),
            { text: '**按一下**右边第 **3** 个旋钮（按下去，不转）：选“混响送多少”（Index 亮 REVERB）。', panel: ['SD3', 'INDEX'], sim: { kind: 'mixparam', param: 'rev' }, wait: '点一下第 3 个旋钮…', liveWait: '按一下第 3 个旋钮（做完点“我已经做了”）…' },
            { text: '**转 SNARE 旋钮**往大几格：军鼓像在大厅里打。', panel: ['SNARE'], sim: { kind: 'mix', track: 'SNARE', param: 'rev', dir: 1, count: 3 }, wait: '在 SNARE 旋钮上往上拖三格…', liveWait: '往大转 SNARE 旋钮（做完点“我已经做了”）…' },
            { text: '**按一下**右边第 **2** 个旋钮：选“音量”（Index 亮 VOLUME）。', panel: ['SD2', 'INDEX'], sim: { kind: 'mixparam', param: 'vol' }, wait: '点一下第 2 个旋钮…', liveWait: '按一下第 2 个旋钮（做完点“我已经做了”）…' },
            { text: '**转 HAT 1 旋钮**往小几格：闭镲轻一点，退到后面去。', panel: ['HAT1'], sim: { kind: 'mix', track: 'HAT1', param: 'vol', dir: -1, count: 3 }, wait: '在 HAT 1 旋钮上往下拖三格…', liveWait: '往小转 HAT 1 旋钮（做完点“我已经做了”）…' },
            STOP(),
            { text: '退出：再按一次**按住 [ALL] 再按 [VOL+]**（MIXER 灭了）。', panel: ['ALL', 'VOL+', 'INDEX'], sim: { kind: 'mixer', on: false }, wait: '长按 ALL 旋钮，再点 [VOL+]…', liveWait: '按住 [ALL] 再按 [VOL+]（做完点“我已经做了”）…' },
          ],
          done: '一个混音台：谁大谁小、谁远谁近。',
          coach: '学生在用 Mixer mode（手册 3.15.1）：按住 [ALL] 再按 [VOL+] 进出（Index MIXER 亮）；按 Sound Design 旋钮 3 选 REVERB SEND，转 SNARE 旋钮往大；按旋钮 2 选 VOLUME，转 HAT 1 旋钮往小。混音台里转轨道旋钮不换 pattern；转 [ALL] 调的是整个工程的那一样（混响 / 延迟时是 RETURN LEVEL）。机器报不报这些不知道，没打勾让他点“我已经做了”。',
        },
        {
          type: 'quiz',
          title: '三个小问题',
          questions: [
            {
              q: '混响（REVERB）是哪一层的效果？',
              options: ['每条轨道自己的轨道效果', '大家共用、每条轨道自己定送多少的送出效果', '只能在 App 里调'],
              answer: 1,
              explain: '整台只有一个混响、一个延迟，每条轨道决定送多少过去：所以大家听着在同一个房间里。',
            },
            {
              q: '在混音台模式里转 KICK 旋钮，会——',
              options: ['底鼓换一段乐句', '调底鼓现在选中的那一样（音量、送多少……）', '底鼓静音'],
              answer: 1,
              explain: '混音台里轨道旋钮是推子；先按右边的旋钮选好调哪一样。',
            },
            {
              q: '底鼓一般送多少混响？',
              options: ['很多，越大越好', '很少或者不送：送多了低音会糊', '和别的一样多'],
              answer: 1,
              explain: '底鼓要近、要紧。和弦、军鼓、人声才多送一点。',
            },
          ],
        },
      ],
    },

    // ───────────────────────── 7.2 ─────────────────────────
    {
      id: '7-2',
      simProject: 3,
      simSeed: CH3_LOOP,
      no: '7.2',
      title: '三条触摸条：抽掉、卡住、放回来',
      minutes: 35,
      summary: '[HIGH PASS] 把低音抽掉、手一松全回来；[REPEATER] 让声音“卡碟”；[FX LEVEL] 推主效果、[CLEAR FX] 一键收；用它们做一段铺垫。',
      takeaway: '三条触摸条是给“演”用的：**[HIGH PASS]** 手指往上推，低音一点点被抽掉，**手一离开全回来**——进高潮前最常用；**[REPEATER]** 往上推，正在放的那一小截反复放（越往上切得越碎），手一离开接着往下放。这两条永远管**全部轨道**。**[FX LEVEL]** 推的是 [FX] 选的效果（开关在 MASTER = 整台）；**[CLEAR FX]**（[FX] 列上边沿）一键收到最小。铺垫：[HIGH PASS] 慢慢推几小节，最后一下 [REPEATER]，在小节开头一起松手——就是“砰”。',
      steps: [
        {
          type: 'read',
          title: '三条触摸条',
          blocks: [
            { panel: ['FXLEVEL', 'HIGHPASS', 'REPEATER', 'CLEARFX', 'FX', 'MASTERSINGLE'], caption: '左边那条是 [FX LEVEL]（在 [FX] 旋钮和开关下面），右边并排两条是 [HIGH PASS] 和 [REPEATER]（在扬声器格栅下面）。[CLEAR FX] 在 [FX] 那一列的上边沿。' },
            { list: [
              '**[HIGH PASS]**（高通）：手指往上推，低音一点点被削掉，声音越来越“薄”、像从收音机里出来。**手指一离开，全回来。**',
              '**[REPEATER]**（重复）：手指往上推，正在放的那一小截被反复放——像唱片卡住了，越往上切得越碎（一拍 → 半拍 → 更碎）。手指一离开，接着往下放。',
              '**[FX LEVEL]**：推的是 [FX] 选的那个效果（开关在 MASTER = 整台，在 SINGLE = 选中的那一条）。它不会自己弹回去：用完按 **[CLEAR FX]** 收到最小。',
            ] },
            { callout: 'warn', text: '手册没写触摸条哪一头是“多”：模拟机上往上是多。真机上推着听，觉得反了就从另一头来。' },
            { callout: 'dj', text: '[HIGH PASS] 就是你混音台上的滤波旋钮往“高通”那边拧。区别是：手一松它自己回来，所以可以放心地推到底。' },
          ],
        },
        {
          type: 'do',
          title: '抽掉低音，再一把放回来',
          blocks: [
            '放着循环，手指在 [HIGH PASS] 上慢慢往上推，听低音被抽走；推到头停一会儿，在小节开头松手——低音“砰”地回来。再用 [REPEATER] 卡一下。',
            { callout: 'tip', text: '模拟机上：在触摸条上**按住鼠标往上拖**，松开鼠标 = 手指离开。' },
          ],
          liveBlocks: [
            '放着循环，手指在 [HIGH PASS] 上慢慢往上推，听低音被抽走；推到头停一会儿，在小节开头松手——低音“砰”地回来。再用 [REPEATER] 卡一下。',
            LIVE_MANUAL('松手这一下，'),
          ],
          tasks: [
            PROJECT4,
            PLAY(),
            { text: '手指按在 **[HIGH PASS]** 上，**慢慢往上推**：低音越来越少。', panel: ['HIGHPASS'], detect: { kind: 'highpass' }, wait: '在 [HIGH PASS] 上按住往上拖…', liveWait: '在 [HIGH PASS] 上往上推（没打勾就点“我已经做了”）…' },
            { text: '推到头停一会儿，在**小节的开头**（底鼓第一下）**松手**：低音一把回来。', panel: ['HIGHPASS'], sim: { kind: 'highpass', on: false }, wait: '松开鼠标…', liveWait: '在小节开头松手（做完点“我已经做了”）…' },
            { text: '手指按在 **[REPEATER]** 上往上推一点：声音“卡”住了，一拍一拍地重复。再往上：切得更碎。', panel: ['REPEATER'], detect: { kind: 'repeater' }, wait: '在 [REPEATER] 上按住往上拖…', liveWait: '在 [REPEATER] 上往上推（没打勾就点“我已经做了”）…' },
            { text: '**松手**：接着往下放。', panel: ['REPEATER'], sim: { kind: 'repeater', on: false }, wait: '松开鼠标…', liveWait: '松手（做完点“我已经做了”）…' },
            STOP(),
          ],
          done: '抽掉、卡住、放回来：现场最好用的三下。',
          coach: '学生在用 [HIGH PASS] 和 [REPEATER] 两条触摸条（手册 3.12.4）：Page 1 上它们永远作用于全部轨道（和 [MASTER/SINGLE] 无关）；手指离开就关（为现场设计）。[HIGH PASS] 默认是高通滤波，[REPEATER] 默认是 BEAT REPEAT（类型在 App 里能换）。哪一头是最大手册没写。第三方资料说它们发 CC 105 / 106，这台机器上没试过；没打勾让他点“我已经做了”。',
        },
        {
          type: 'do',
          title: '主效果：推上去，一键收',
          blocks: [
            '[MASTER/SINGLE] 拨到 MASTER，[FX] 选 FILTER（滤波）那一类的第 1 个，[FX LEVEL] 推一推——整台一起变闷；用完按 [CLEAR FX] 收掉。',
            { callout: 'tip', text: '模拟机上：[FX] 旋钮在右边 [FX] 那一列，往上拖一格 = 转一格；开关点一下就拨过去。' },
          ],
          liveBlocks: [
            '[MASTER/SINGLE] 拨到 MASTER，[FX] 选 FILTER（滤波）那一类的第 1 个，[FX LEVEL] 推一推——整台一起变闷；用完按 [CLEAR FX] 收掉。',
            LIVE_MANUAL('开关拨在哪、[FX] 转到哪一类、[CLEAR FX]，'),
          ],
          tasks: [
            { text: '[MASTER/SINGLE] 开关拨到**左边的 MASTER**（已经在就不用动）。', panel: ['MASTERSINGLE'], sim: { kind: 'fxswitch', single: false }, wait: '开关在 MASTER 就对了…', liveWait: '开关拨到 MASTER（做完点“我已经做了”）…' },
            { text: '转 **[FX] 旋钮**，让 Index 亮 **FILTER**（8 类里的第 1 类）。', panel: ['FX', 'INDEX'], sim: { kind: 'masterfx', cat: 'FILTER' }, wait: '在 [FX] 旋钮上往上拖一格…', liveWait: '转 [FX]，看 Index 亮 FILTER（做完点“我已经做了”）…' },
            PLAY(),
            { text: '手指在 **[FX LEVEL]** 上往上滑：整台声音一起变闷（低通滤波）。', panel: ['FXLEVEL'], sim: { kind: 'fxlevel', min: 0.3 }, live: { kind: 'fxlevel' }, wait: '在 [FX LEVEL] 上按住往上推…', liveWait: '在 [FX LEVEL] 上往上滑（没打勾就点“我已经做了”）…' },
            { text: '它不会自己回去：按一下 **[CLEAR FX]**（[FX] 那一列的上边沿），一键收掉。', panel: ['CLEARFX'], sim: { kind: 'clearfx' }, wait: '点一下 [CLEAR FX]…', liveWait: '按 [CLEAR FX]（做完点“我已经做了”）…' },
            STOP(),
          ],
          done: '[FX LEVEL] 推上去，[CLEAR FX] 收回来。',
          coach: '学生在用主效果：[MASTER/SINGLE] 拨到 MASTER；转 [FX] 旋钮到 FILTER 类（Index FILTER 亮，Global Meter 是预设编号，第 1 个是 LPF - NO RESONANCE）；[FX LEVEL] 推 = MASTER EFFECT PARAMETER 1（这个预设上是 CUTOFF）；[CLEAR FX] 把当前效果的参数电平降到最小（手册 3.12.5）。开关、[FX] 机器不上报；[FX LEVEL] 第三方资料说发 CC 102（MASTER），没试过。',
        },
        {
          type: 'do',
          title: '做一段铺垫',
          blocks: [
            '**Animals**、**Levels** 进高潮之前，声音越来越薄、越来越紧，然后“砰”地全回来。用触摸条做一遍：',
            { list: [
              '放着循环，[HIGH PASS] 从底下**慢慢**往上推，推三四小节。',
              '最后一小节，另一根手指加上 [REPEATER]。',
              '在小节开头**两根手指一起松开**。',
            ] },
          ],
          liveBlocks: [
            '**Animals**、**Levels** 进高潮之前，声音越来越薄、越来越紧，然后“砰”地全回来。用触摸条做一遍：',
            { list: [
              '放着循环，[HIGH PASS] 从底下**慢慢**往上推，推三四小节。',
              '最后一小节，另一根手指加上 [REPEATER]。',
              '在小节开头**两根手指一起松开**。',
            ] },
            LIVE_MANUAL('松手这一下，'),
          ],
          tasks: [
            PLAY(),
            { text: '[HIGH PASS] 从底下**慢慢**往上推（三四小节推到头）。', panel: ['HIGHPASS'], detect: { kind: 'highpass' }, wait: '在 [HIGH PASS] 上按住慢慢往上拖…', liveWait: '慢慢推 [HIGH PASS]（没打勾就点“我已经做了”）…' },
            { text: '在小节开头**松手**——“砰”。（模拟机上一次只能按一条：[REPEATER] 留到真机上加。）', liveText: '最后一小节加上 [REPEATER]，在小节开头两根手指一起**松开**——“砰”。', panel: ['HIGHPASS', 'REPEATER'], sim: { kind: 'highpass', on: false }, wait: '松开鼠标…', liveWait: '一起松手（做完点“我已经做了”）…' },
            STOP(),
          ],
          done: '这就是“铺垫 → 高潮”。下一课用静音把它演得更狠。',
          coach: '学生在用触摸条做铺垫（build-up）：播放中 [HIGH PASS] 慢慢推三四小节，最后一小节加 [REPEATER]，在小节开头一起松手（手指离开就关）。参考他听过的 Animals、Levels 进 drop 前那段。模拟机一次只能拖一条触摸条。',
        },
        {
          type: 'quiz',
          title: '三个小问题',
          questions: [
            {
              q: '[HIGH PASS] 推到头，手指离开会怎样？',
              options: ['一直保持削掉低音', '马上复原，低音全回来', '机器停止'],
              answer: 1,
              explain: '[HIGH PASS] 和 [REPEATER] 都是手指离开就关：放心推到底。',
            },
            {
              q: '[FX LEVEL] 推上去以后，怎么一下收回来？',
              options: ['按 [CLEAR FX]', '按 [UNDO/REDO]', '它自己会回来'],
              answer: 0,
              explain: '[FX LEVEL] 不会自己弹回去；[CLEAR FX] 把当前效果收到最小。',
            },
            {
              q: '[MASTER/SINGLE] 拨在 SINGLE 上时推 [HIGH PASS]，削的是——',
              options: ['只有选中的那一条', '全部轨道', '什么都不削'],
              answer: 1,
              explain: '第 1 页上 [HIGH PASS] 和 [REPEATER] 永远管全部轨道，和开关无关。',
            },
          ],
        },
      ],
    },

    // ───────────────────────── 7.3 ─────────────────────────
    {
      id: '7-3',
      simProject: 3,
      simSeed: CH6_SEED,
      no: '7.3',
      title: '静音模式：用旋钮“演”',
      minutes: 35,
      summary: '静音模式里直接按旋钮就是静音 / 放出来；一条一条“放进来”；副歌前先“空一下”；和预约换段一起用。',
      takeaway: '**静音模式**：**按住 [ALL] 再按 [MUTE]**（[ALL] 旁 3 个灯变绿）。这时**直接按**轨道旋钮 = 静音 / 放出来，不用按住 [MUTE]——现场两只手能同时管好几条；按 **[ALL]** = 全部放出来；按 **[MUTE]** 退出。静音模式里**不能预约换段**：要换段先退出来，按住 [ALL] 再按方键预约，11 条轨道在下一小节一起换。',
      steps: [
        {
          type: 'read',
          title: '“演”一首歌，靠的是放进来、拿出去',
          blocks: [
            '现场演出时，很多时候不是在“弹”，是在**放进来、拿出去**：前奏只有镲，几小节后底鼓进来，再几小节和弦进来；副歌前一小节，底鼓突然没了——一回来就是高潮。',
            '按住 [MUTE] 再按旋钮太慢，两只手都占着。**静音模式**里一个旋钮按一下就行：',
            { list: [
              '进：**按住 [ALL] 旋钮，再按 [MUTE]**（左侧面第 4 个）。[ALL] 旁边 3 个小灯变**绿**。',
              '按轨道旋钮：静音（灯变绿）/ 放出来。',
              '按 [ALL] 旋钮：全部放出来。',
              '按 [MUTE]：退出。',
            ] },
            { panel: ['ALL', 'MUTE', 'KICK', 'SNARE', 'HAT1', 'SYNTH1', 'SYNTH2'], lit: { 'ALL.1': 'green', 'ALL.2': 'green', 'ALL.3': 'green', 'KICK.1': 'green', 'KICK.2': 'green', 'KICK.3': 'green' }, caption: '静音模式：[ALL] 旁 3 个灯绿。图里底鼓被静音了（它的灯也是绿的）。' },
            { callout: 'warn', text: '静音模式里**不能预约换段**；选中 SAMPLER 时按 Synth key 是演奏，不是静音某个采样。' },
          ],
        },
        {
          type: 'do',
          title: '一条一条放进来',
          blocks: [
            '从“只有镲和和弦”开始，一条一条放进来，副歌前空一下。',
            { callout: 'tip', text: '模拟机上：静音模式里**点一下**轨道旋钮就是静音 / 放出来。' },
          ],
          liveBlocks: [
            '从“只有镲和和弦”开始，一条一条放进来，副歌前空一下。',
            LIVE_MANUAL('进出静音模式，'),
            { callout: 'tip', text: '谁静音了应用读得出来：屏幕上镜像的旋钮灯会变绿。' },
          ],
          tasks: [
            PROJECT4,
            { text: '进静音模式：**先按住** [ALL] 旋钮**不放，再按** [MUTE]（左侧面第 4 个）。[ALL] 旁 3 个灯变绿。', panel: ['ALL', 'MUTE'], sim: { kind: 'mutemode', on: true }, wait: '长按 ALL 旋钮出现黑圈，再点 [MUTE]…', liveWait: '按住 [ALL] 再按 [MUTE]（做完点“我已经做了”）…' },
            { text: '**按一下 KICK 旋钮**：底鼓静音。', panel: ['KICK'], detect: { kind: 'muted', track: 'KICK', on: true }, wait: '点一下 KICK 旋钮…', liveWait: '按一下 KICK 旋钮…' },
            { text: '**按一下 SNARE 旋钮**、**SYNTH 1 旋钮**：军鼓、贝斯也静音。只剩镲和和弦。', panel: ['SNARE', 'SYNTH1'], detect: { kind: 'muted', track: 'SYNTH1', on: true }, wait: '点 SNARE、SYNTH 1 旋钮…', liveWait: '按 SNARE、SYNTH 1 旋钮…' },
            PLAY('短按 [PLAY]：这是前奏。'),
            { text: '两小节后，在小节开头**按 KICK 旋钮**：底鼓进来了。', panel: ['KICK'], detect: { kind: 'muted', track: 'KICK', on: false }, wait: '点一下 KICK 旋钮…', liveWait: '在小节开头按 KICK 旋钮…' },
            { text: '再过两小节，**按 SYNTH 1 旋钮**：贝斯进来了。', panel: ['SYNTH1'], detect: { kind: 'muted', track: 'SYNTH1', on: false }, wait: '点一下 SYNTH 1 旋钮…', liveWait: '按 SYNTH 1 旋钮…' },
            { text: '“空一下”：**按 KICK 旋钮**让底鼓停一小节……', panel: ['KICK'], detect: { kind: 'muted', track: 'KICK', on: true }, wait: '点一下 KICK 旋钮…', liveWait: '按 KICK 旋钮…' },
            { text: '……下一小节开头**按 [ALL] 旋钮**：全部放出来——高潮。', panel: ['ALL'], detect: { kind: 'muted', track: 'SNARE', on: false }, wait: '点一下 ALL 旋钮…', liveWait: '按一下 [ALL] 旋钮…' },
            STOP(),
            { text: '按 **[MUTE]** 退出静音模式（[ALL] 的绿灯灭了）。', panel: ['MUTE'], sim: { kind: 'mutemode', on: false }, wait: '点一下 [MUTE]…', liveWait: '按 [MUTE]（做完点“我已经做了”）…' },
          ],
          done: '一首歌被你“演”了出来。',
          coach: '学生在用 Mute mode（手册 3.15.2，V1.20 起）：按住 [ALL] 再按 [MUTE] 进（[ALL] 旁 3 个 LED 绿）；直接按 Track knob 静音 / 取消；按 [ALL] 全部取消；按 [MUTE] 退出。练法：静音 KICK、SNARE、SYNTH 1 当前奏，播放中一条条放回来，副歌前一小节把 KICK 拿掉，下一小节按 [ALL] 全回来。静音状态应用读得出；进出静音模式机器报不报不知道。',
        },
        {
          type: 'do',
          title: '预约换段 + 静音：主歌 → 副歌',
          blocks: [
            '上一章做好的“副歌”在 11 条轨道的第 3 段。演的时候，用**预约**让 11 条在下一小节开头一起换过去（静音模式里不能预约，先退出来）。',
            { callout: 'tip', text: '模拟机上：**长按** ALL 旋钮出现黑圈，再点方键。' },
          ],
          liveBlocks: [
            '上一章做好的“副歌”在 11 条轨道的第 3 段（没做过的话第 3 段是空的：换过去就安静了，也能听出“换了”）。演的时候，用**预约**让 11 条在下一小节开头一起换过去（静音模式里不能预约，先退出来）。',
            { callout: 'tip', text: '11 条轨道在第几段应用读得出来。' },
          ],
          tasks: [
            PLAY(),
            { text: '**先按住** [ALL] 旋钮**不放**，按**第 3 个**方键：预约 11 条轨道在下一小节开头一起到第 3 段。', panel: ['ALL', 'DK3'], sim: { kind: 'patternreserve', track: 'ALL', pattern: 2 }, live: { kind: 'patterns', pattern: 2 }, wait: '长按 ALL 旋钮出现黑圈，再点第 3 个方键…', liveWait: '按住 [ALL]，按第 3 个方键…' },
            { text: '等下一小节开头：副歌来了。', panel: ['ALL'], detect: { kind: 'patterns', pattern: 2 }, wait: '等下一小节开头…', liveWait: '等它换过去…' },
            { text: '按住 [ALL] 按**第 1 个**方键：预约回到主歌。', panel: ['ALL', 'DK1'], detect: { kind: 'patterns', pattern: 0 }, wait: '长按 ALL 旋钮，再点第 1 个方键（等下一小节）…', liveWait: '按住 [ALL]，按第 1 个方键，等它换过去…' },
            STOP(),
          ],
          done: '换段在拍子上，静音在你手里：这就是现场。',
          coach: '学生在用 [ALL] 预约换段（手册 3.7.2：按住 [ALL] 按 Drum key = 11 条一起预约，双击 = 立即）：播放中按住 [ALL] 按 Drum key 3 预约到 pattern 3（上一章做的副歌），等对齐点；再按住 [ALL] 按 Drum key 1 回到 pattern 1。静音模式里不能预约（手册 3.15.2）。应用读得出 11 条在第几段。',
        },
        {
          type: 'quiz',
          title: '两个小问题',
          questions: [
            {
              q: '在静音模式里，怎么一次把所有轨道都放出来？',
              options: ['按一下 [ALL] 旋钮', '按 [MUTE]', '按住 [DELETE] 再按 [ALL]'],
              answer: 0,
              explain: '静音模式里按 [ALL] = 全部取消静音；按 [MUTE] 是退出。按住 [DELETE] 再按 [ALL] 会删掉所有轨道当前这一段——千万别。',
            },
            {
              q: '在静音模式里想预约换段，可以吗？',
              options: ['可以', '不可以：先按 [MUTE] 退出来'],
              answer: 1,
              explain: '手册：静音模式里不能预约切换乐句。',
            },
          ],
        },
      ],
    },

    // ───────────────────────── 7.4 ─────────────────────────
    {
      id: '7-4',
      simProject: 3,
      simSeed: CH3_LOOP,
      no: '7.4',
      title: '排练与救场',
      minutes: 30,
      summary: '演出前存一份临时保存，演砸了一键回去；[UNDO/REDO] 救回拧坏的音色；演出前的检查清单。',
      takeaway: '**临时保存**：**按住 [PROJECT↑] 再按当前工程那个黄色的方键**（4 号工程 = 上排第 4 个）。演砸了：**按住 [PROJECT↑] 再按它正下方那个亮青蓝的方键**（4 号工程 = 下排第 4 个，也就是第 12 个），工程回到存的那一刻。只能存 1 份，换工程或关机就没了；每次载入工程时机器会自动存一份。**[UNDO/REDO]** 只管拧过的音色、效果参数，救不回删掉的音符。',
      steps: [
        {
          type: 'read',
          title: '现场会出的岔子',
          blocks: [
            '现场最怕的不是弹错一个音，是**手一滑把整段删了**、**效果推上去忘了收**、**音色拧坏了**。SEQTRAK 给了几样保险：',
            { list: [
              '**临时保存 / 恢复**：演出前存一份；出了大岔子，一键回到那一刻。只能存 1 份，**换工程或关机就没了**；每次载入工程时机器会自动存一份，所以至少能回到“刚打开时”。',
              '**[UNDO/REDO]**（[UNDO/REDO] 在 Sound Design 那一列的上边沿）：撤销刚才对**音色、效果参数**的修改。删掉的音符、清空的乐句它救不回来。',
              '**[CLEAR FX]**：效果推上去收不回来时，一键收掉。',
              '**静音 / 独奏**：哪条轨道出了怪声，先静音它，音乐别停。',
            ] },
            { panel: ['PROJECT', 'DK4', 'DK12'], lit: { DK4: 'yellow', DK12: 'cyan' }, caption: '按住 [PROJECT↑] 时：当前工程（这里是 4 号）亮**黄色**，临时保存过就在它**正下方**多一个**青蓝色**（第 12 个）。按黄色的 = 存，按青蓝色的 = 恢复。' },
            { callout: 'warn', text: '采样的坑：一个采样没存（按住 [ALL] 再按 SOUND 旋钮），又往同一个位上录了新的，旧的那段在临时保存里也找不回来。' },
          ],
        },
        {
          type: 'do',
          title: '存一份，搞砸它，再救回来',
          blocks: [
            '故意出个大岔子：存一份，清空底鼓，再一键恢复。',
            { callout: 'tip', text: '模拟机上组合键：先**长按**第一个键出现黑圈，再点第二个。' },
          ],
          liveBlocks: [
            '故意出个大岔子：存一份，清空底鼓，再一键恢复。别在演示曲（1–3 号工程）上做。',
            LIVE_MANUAL('临时保存、恢复，'),
            { callout: 'tip', text: '底鼓的格子应用读得出来：清空了、恢复了，屏幕上的镜像看得见。' },
          ],
          tasks: [
            PROJECT4,
            { text: '**临时保存**：**先按住** [PROJECT↑]（右侧面最下面）**不放，再按**上排**第 4 个**方键（黄色的，就是当前工程）。', panel: ['PROJECT', 'DK4'], sim: { kind: 'tempsave' }, wait: '长按 [PROJECT↑] 出现黑圈，再点上排第 4 个方键…', liveWait: '按住 [PROJECT↑]，按上排第 4 个方键（做完点“我已经做了”）…' },
            { text: '搞砸它：**先按住** [DELETE]（左侧面第 3 个）**不放，再按** KICK 旋钮——底鼓这一段被清空了。', panel: ['DELETE', 'KICK'], detect: { kind: 'steps', track: 'KICK', steps: [] }, wait: '长按 [DELETE] 出现黑圈，再点 KICK 旋钮…', liveWait: '按住 [DELETE]，按 KICK 旋钮…' },
            { text: '救回来：**先按住** [PROJECT↑] **不放，再按下排第 4 个方键**（第 12 个，亮青蓝）。', panel: ['PROJECT', 'DK12'], sim: { kind: 'temprestore' }, wait: '长按 [PROJECT↑]，再点第 12 个方键…', liveWait: '按住 [PROJECT↑]，按第 12 个方键（做完点“我已经做了”）…' },
            PLAY('短按 [PLAY]：底鼓回来了。'),
            STOP(),
          ],
          done: '演出前存一份——这是现场的保险。',
          coach: '学生在练临时保存与恢复（手册 3.10.3，V1.10 起）：按住 [PROJECT↑] 再按当前工程的 Drum key（黄色）= 临时保存；按住 [DELETE] 再按 KICK 旋钮清空底鼓当前 pattern；按住 [PROJECT↑] 再按正下方亮青蓝的 Drum key（4 号工程 = Drum key 12）= 恢复。只能存 1 份，换工程 / 关机就没了；V1.20 起每次载入工程会自动临时保存一次。临时保存机器报不报不知道；底鼓的格子应用读得出。',
        },
        {
          type: 'do',
          title: '[UNDO/REDO]：把拧坏的音色拧回来',
          blocks: [
            '把和弦的起音拧到离谱，再用 [UNDO/REDO] 撤销。',
          ],
          liveBlocks: [
            '把和弦的起音拧到离谱，再用 [UNDO/REDO] 撤销。',
            { device: ['sdpage'] },
            { callout: 'tip', text: '起音拧到哪应用读得出来：按了 [UNDO/REDO] 之后，屏幕上会看到它回去了。' },
          ],
          tasks: [
            { text: '按一下 **SYNTH 2 旋钮**（合成器区上排右边）。', panel: ['SYNTH2'], detect: { kind: 'track', track: 'SYNTH2' }, wait: '点一下 SYNTH 2 旋钮…', liveWait: '等你按 SYNTH 2 旋钮…' },
            { text: '**单按**翻页键翻到**第 2 页**（小灯从上往下第 2 个亮）。', panel: ['SDPAGE', 'METER'], detect: { kind: 'sdpage', page: 1 }, wait: '单按翻页键…', liveWait: '单按翻页键，翻到第 2 页…' },
            { text: '**第 1 个旋钮**（起音）往大转很多：和弦变成慢慢浮上来的“雾”。', panel: ['SD1'], detect: { kind: 'param', track: 'SYNTH2', param: 'attack', dir: 1, by: 24 }, wait: '把第 1 个旋钮往上拖很多…', liveWait: '往大转第 1 个旋钮（转多一点）…' },
            { text: '按 **[UNDO/REDO]**（Sound Design 那一列的上边沿）：撤销。', panel: ['UNDO'], sim: { kind: 'undo' }, wait: '点一下 [UNDO/REDO]…', liveWait: '按 [UNDO/REDO]（做完点“我已经做了”）…' },
            { text: '翻回**第 1 页**。', panel: ['SDPAGE', 'METER'], detect: { kind: 'sdpage', page: 0 }, wait: '单按翻页键，翻回第 1 页…', liveWait: '翻回第 1 页…' },
          ],
          done: '[UNDO/REDO] 管拧过的；删掉的它不管。',
          coach: '学生在用 [UNDO/REDO]（手册 3.9）：只对声音参数和效果参数的修改有效，不能撤销音色的选择、效果的选择、删除、录音。一个键怎么分撤销和重做、能撤几步，手册没写。练法：SYNTH 2 第 2 页旋钮 1（ATTACK）往大拧很多，按 [UNDO/REDO]。起音应用读得出。',
        },
        {
          type: 'read',
          title: '演出前的检查清单',
          blocks: [
            { list: [
              '**电**：前一天充满（关机时插着 USB 线充，灯灭了 = 充满）。',
              '**音量**：[VOL+] / [VOL−] 先调到中间；接音箱时从小往大推。',
              '**耳机 / 线**：插了耳机，机器自己的喇叭就不响。',
              '**每个要演的工程**：切过去（会自动存一份临时保存），检查速度、乐句、静音状态都对。',
              '**效果**：[FX LEVEL] 收到底（[CLEAR FX]），[MASTER/SINGLE] 在 MASTER。',
              '**排练三遍**：从第一首放到最后一首，中间不停。哪里手忙脚乱，就把那一段简化。',
            ] },
            { callout: 'dj', text: '和打碟前检查一样：线、电、音量、第一首歌在哪。最好的救场是**不需要救场**。' },
          ],
        },
        {
          type: 'quiz',
          title: '两个小问题',
          questions: [
            {
              q: '在 4 号工程上，临时保存过以后想恢复，按住 [PROJECT↑] 再按哪个？',
              options: ['上排第 4 个（黄色）', '下排第 4 个，也就是第 12 个（青蓝色）', '第 1 个'],
              answer: 1,
              explain: '黄色的 = 存，它正下方青蓝色的 = 恢复。',
            },
            {
              q: '手一滑把底鼓整段删了，[UNDO/REDO] 救得回来吗？',
              options: ['救得回来', '救不回来：它只管拧过的音色和效果参数；要靠临时保存'],
              answer: 1,
              explain: '所以演出前先临时保存一份。',
            },
          ],
        },
      ],
    },
  ],
};
