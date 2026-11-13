// 第 4 章 · 合成与音色设计。写法和前几章一样（见 curriculum.js 顶部的说明、ch0.js 顶部关于 live* 的说明、ch3.js 顶部）。
//
// 机器操作的依据（docs/seqtrak-operation-reference.md）：3.3.4 按类别跳音色、3.11.1 翻页（单按翻页、长按 2 秒进出进阶设置）、
// 3.11.2 每一页的四个旋钮（第 2 页 ATTACK / DECAY / FILTER / RESONANCE；DX 进阶第 5 页 FM 算法 / 调制量 / 调制频率 / 反馈）、
// 3.11.4 存音色（按住 [ALL] 再按 SOUND 旋钮，名字加 _editNN、进收藏）、3.9 UNDO/REDO（只管参数，撤不回换音色）、
// 3.12 效果（[MASTER/SINGLE]、[FX] 旋钮的 MODULATION 那一类、[FX LEVEL]；轨道效果跟着音色走）、5 节（LFO 只能在官方 App 里调）。
// 手册没写明的，课文里都不下结论、让学生转着听：滤波器旋钮往哪边是闷；[UNDO/REDO] 一个键怎么分撤销和重做；
// [FX] 转到某个预设时那列小灯具体怎么亮；拧过、没存的参数会不会跟着工程一起保存。
//
// 2026-11-12 在用户这台机器（V2.00）上测过的（docs/hardware-findings.md“第 4 章开工前的探测”）：
//   · 起音、衰减、DX 的 FM 三样存在音色的公共参数里，镜像能直接读出来，所以这些任务在真机上会自动打勾；
//   · 滤波器（CC 74）、共鸣（CC 71）找不到能读的地址：只有机器转旋钮时自己发 CC 才认得出（还没人试过发不发），课文里明说“没打勾就点我已经做了”；
//   · 换音色会把拧过的冲掉：起音（2026-11-12 在空白的 5 号工程上实测）和弹法（第 3 章实测）都是；手册 10.1.1 也说轨道效果跟着音色走。
//
// 这一章新增的任务条件（lesson.js）：sdpage（第几页）、sdmode（进阶设置）、param（某个参数拧了多少 / 拧到哪）、soundname（音色名，存过的带 _edit），
// 真机镜像都认得出（param 里的滤波器、共鸣要靠机器发 CC）；fxswitch（[MASTER/SINGLE]）、fxtype（[FX] 转到哪一类）只有模拟机认得出；fxlevel 两边都试着认。
// 讲解里的小部件：synthlab（音色实验台，见 synth-lab.js）、trackfilter（滤波器只管一条轨道 / 管整台，用的是小课堂的效果实验台）、catkeys（16 类音色）。
// 课文里的歌只举用户听过的（记忆 user-music-background）：bad guy、Faded、Animals、Blinding Lights、Starboy。
//
// 练的地方：4 号工程，第 3 章最后那段循环（鼓、SYNTH 1 两小节贝斯、SYNTH 2 两小节四个和弦）。音色怎么换，音符都还在。
// 模拟机上这个工程是空的时候（这次打开页面没学第 3 章），课程开头先把那段循环摆进去（simSeed）。
// 真机上他的 4 号工程里不一定有那段循环（用户 2026-11-12 先上的 4.1，第 1–3 章还没学）：接着真机时，动手步骤右边有“让机器替你弹一段”（RIFF，device-riff.js）。

// 第 3 章 3.4 做完时 4 号工程里的样子：贝斯 1 1 6 6 | 3 3 7 7，和弦 1 → 6 → 3 → 7（每个两拍，拉长到 8 格）
export const CH3_LOOP = {
  tempo: 100,
  drums: { KICK: [0, 4, 8, 12], SNARE: [4, 12], HAT1: [2, 6, 10, 14] },
  poly: { SYNTH2: 2 },
  bars: { SYNTH1: 2, SYNTH2: 2 },
  keys: {
    SYNTH1: [[0, 1], [4, 1], [8, 6], [12, 6], [16, 3], [20, 3], [24, 7], [28, 7]],
    SYNTH2: [[0, 1, 8], [8, 6, 8], [16, 3, 8], [24, 7, 8]],
  },
};
const CHORDS = [[0, 48, 8], [0, 51, 8], [0, 55, 8], [8, 44, 8], [8, 48, 8], [8, 51, 8]];
const BASS = [[0, 'C1', 2], [3, 'C1', 1], [6, 'D#1', 2], [8, 'C1', 2], [11, 'G1', 1], [14, 'A#0', 2]];
const MELODY = [[0, 72, 2], [2, 75, 2], [4, 79, 3], [8, 77, 2], [10, 75, 2], [12, 72, 4]];

const PROJECT4 = { text: '确认在 **4 号工程**：不在就**先按住** [PROJECT↑]（右侧面最下面）**不放，再按**上排**第 4 个**方键。已经在的话会自己打勾。', panel: ['PROJECT', 'DK4'], detect: { kind: 'project', in: [3] }, wait: '长按 [PROJECT↑] 出现黑圈，再点上排第 4 个方键…', liveWait: '等机器在 4 号工程…' };
const PAGE2 = (extra = '') => ({ text: `翻到**第 2 页**：**单按**翻页键（那一列旋钮正下方、印着三个小点），小灯从上往下**第 2 个**亮。${extra}`, panel: ['SDPAGE', 'METER'], detect: { kind: 'sdpage', page: 1 }, wait: '单按一下翻页键…', liveWait: '单按翻页键，翻到第 2 页…' });
const PAGE1 = (extra = '') => ({ text: `确认在**第 1 页**（小灯最上面那个亮；不在就单按翻页键）。${extra}`, panel: ['SDPAGE', 'METER'], detect: { kind: 'sdpage', page: 0 }, wait: '单按翻页键，翻回第 1 页…', liveWait: '等旋钮在第 1 页…' });
const PLAY = (text = '短按 [PLAY]，让循环放着。') => ({ text, panel: ['PLAY'], detect: { kind: 'start' }, wait: '点 [PLAY]…', liveWait: '等你按 [PLAY]…' });
const STOP = (text = '听够了按 [PLAY] 停下。') => ({ text, panel: ['PLAY'], detect: { kind: 'stop' }, wait: '再点 [PLAY]…', liveWait: '等你停止…' });
const SELECT = (track, where) => ({ text: `按一下 **${track === 'SYNTH1' ? 'SYNTH 1' : track === 'SYNTH2' ? 'SYNTH 2' : 'DX'} 旋钮**（${where}），只按不转。`, panel: [track], detect: { kind: 'track', track }, wait: `点一下 ${track === 'SYNTH1' ? 'SYNTH 1' : track === 'SYNTH2' ? 'SYNTH 2' : 'DX'} 旋钮…`, liveWait: `等你按 ${track === 'SYNTH1' ? 'SYNTH 1' : track === 'SYNTH2' ? 'SYNTH 2' : 'DX'} 旋钮…` });
const SAVE = (track, extra = '') => ({ text: `**存下来**：**先按住** [ALL]（鼓区左上角第一个旋钮）**不放，再按一下** SOUND 旋钮（按下去，不是转）。小灯白色闪一下 = 存好了。${extra}`, panel: ['ALL', 'SD1'], detect: { kind: 'soundname', track, match: '_edit\\d+$', fresh: true }, wait: '长按 ALL 旋钮出现黑圈，再点 SOUND 旋钮…', liveWait: '按住 [ALL]，再按一下 SOUND 旋钮…' });
const FILTER_LIVE = { callout: 'warn', title: '滤波器、共鸣：应用不一定看得见', text: '这两样转到哪，应用读不出来，只有机器自己发出控制信号才认得出（还没人试过它发不发）：**转着听就行**，没打勾就点“我已经做了”。' };
// 接着真机时“让机器替你弹一段”（device-riff.js）：4 号工程里没有第 3 章那段循环也听得见拧出来的变化
const RIFF = (track) => ({ riff: track });
const FILTER_WAY = { callout: 'tip', title: '往哪边是闷', text: '“闷—原样—薄”连在一起，往哪边是闷手册没写：**转着听**，声音“正常”的那一下就是原样。**按下去再转** = 一下改很多。' };

export const ch4 = {
  id: 'ch4',
  no: 4,
  title: '合成与音色设计',
  subtitle: '声音是怎么“做”出来的',
  lessons: [
    // ───────────────────────── 4.1 ─────────────────────────
    {
      id: '4-1',
      simProject: 3,
      simSeed: CH3_LOOP,
      no: '4.1',
      title: '挑一个音色，弄清它住在哪',
      minutes: 30,
      summary: '音色是怎么来的；按类别挑音色、在屏幕上看名字；右边 4 个旋钮的翻页；拧过的东西存在哪、什么时候会被冲掉、怎么存下来。',
      takeaway: '一个音色 = **原料**（波形）+ **滤波器**（削亮削暗）+ **包络**（怎么起、怎么收）。挑音色：**按住 SOUND 旋钮，再按一个方键**跳到那一类，再转 SOUND 一个个听。右边 4 个旋钮有好几页：**单按翻页键**翻页，那列小灯最上面亮 = 第 1 页，往下第 2 个 = 第 2 页；Index 亮的字告诉你正在拧什么。拧过的都**跟着音色走**——换音色就没了，所以**先挑音色，再拧**；拧满意了，**按住 [ALL] 再按一下 SOUND 旋钮**存下来（名字加 _edit01，进收藏）。',
      homework: '在 SYNTH 2 上把 PAD 这一类从头到尾转一遍，记下你最喜欢的一两个（屏幕上的镜像会显示名字）。',
      steps: [
        {
          type: 'read',
          title: '同一串音，三种音色',
          blocks: [
            '到现在，你给机器换过几次音色：第 3 章给 SYNTH 2 换了钢琴、给 DX 换了电钢琴。可“音色”到底是什么？先听：同一串音，换三种音色。',
            { widget: 'synthlab', lab: 'presets', title: '同一串音：贝斯、Pad、Lead（点「播放」，再换着点上面三个）' },
            '三种听起来像三件完全不同的乐器，但在合成器里，它们是**同一套东西拧出来的**：',
            { list: [
              '**原料**：一个会响的波形。有的又亮又刺，有的又圆又闷。',
              '**滤波器**：把原料往下削。削掉高的部分，声音变闷；削掉低的部分，声音变薄。',
              '**包络**：一个音按下去之后，是“一下就出来、马上没了”，还是“慢慢浮上来、拖得很长”。',
            ] },
            { callout: 'dj', text: '打碟时你换的是一整首歌；这里换的是一件乐器的“嗓子”。混音台上那个 FILTER 旋钮你早就拧过——这一章会告诉你，机器上它住在哪、还能怎么用。' },
            '这台机器有两千多个现成的音色，叫**预设**。这一章的路子是：**先挑一个接近的预设，再用右边那 4 个旋钮把它拧成你要的。** 实验台右边那一列桔红的旋钮，就是照着机器右边那一列画的。',
          ],
        },
        {
          type: 'read',
          title: '两千多个音色，按类别找',
          blocks: [
            '一个一个转着挑太慢了。机器把合成器的音色分成 16 类，正好对着左边那 16 个方键：**先按住**右边最上面那个旋钮（下面印着 SOUND）**不放，再按一个方键**，就跳到那一类的第一个音色。第 3 章你这么做过两次（PIANO 和 KEYBOARD）。',
            { widget: 'catkeys' },
            { callout: 'tip', text: '跳到一类之后，再**转** SOUND 旋钮，一个一个往后听。这一类听完了，会接着走进下一类。这个跳法要在**第 1 页**上用（第几页下一步讲）。' },
            { callout: 'warn', title: '机器没有屏幕', text: '机器上看不到音色的名字。接着真机时，屏幕上那台镜像会把名字读出来——这是唯一能看到名字的地方。觉得哪个好听，就记下它的名字。' },
          ],
        },
        {
          type: 'do',
          title: '给你的和弦换一个 Pad',
          blocks: [
            '第 3 章那段循环在 **4 号工程**里（鼓、贝斯、四个和弦），这一章拿它当试验田：**音色怎么换，音符都还在。** 先给 SYNTH 2 换一个 **Pad**（铺底，第 6 类）。',
            { callout: 'tip', text: '模拟机上：**长按**半秒出现黑圈 = “按住了”，再点第二个键；旋钮**上下拖**（或滚轮）。模拟机的音色名都写着“模拟”，每类只有一两个。' },
          ],
          liveBlocks: [
            '第 3 章那段循环在 **4 号工程**里（鼓、贝斯、四个和弦），这一章拿它当试验田：**音色怎么换，音符都还在。**（还没学第 3 章、4 号工程里没有这段循环也不要紧：换完音色，点下面的“让机器替你弹一段”，或者按 Synth keys 听。）先给 SYNTH 2 换一个 **Pad**（铺底，第 6 类）。机器现在的读数：',
            { device: ['sound:SYNTH2', 'poly:SYNTH2'] },
            { callout: 'warn', text: '换了音色，第 3 章切好的 **CHORD 会被冲掉**（弹法存在音色里），清单里有一项就是把它切回来。' },
            { action: 'polymode', track: 'SYNTH2', mode: 2, label: '让应用直接把 SYNTH 2 切回 CHORD' },
            RIFF('SYNTH2'),
          ],
          tasks: [
            PROJECT4,
            SELECT('SYNTH2', '中间合成器区上排右边'),
            { text: '跳到 Pad：**先按住** SOUND 旋钮（那一列最上面）**不放，再按**上排**第 6 个**方键。', panel: ['SD1', 'DK6'], detect: { kind: 'sound', track: 'SYNTH2' }, wait: '长按 SOUND 旋钮出现黑圈，再点上排第 6 个方键…', liveWait: '按住 SOUND 旋钮不放，再按上排第 6 个方键…' },
            { text: '按几个 **Synth keys** 听这个 Pad。', panel: ['SYNTHKEYS'], detect: { kind: 'note', track: 'SYNTH2', count: 3 }, wait: '按 Synth keys', liveWait: '按 Synth keys' },
            { text: '**转一格** SOUND 旋钮（只转不按），听下一个；不喜欢就转回来。', panel: ['SD1', 'INDEX'], detect: { kind: 'sound', track: 'SYNTH2' }, wait: '把 SOUND 旋钮往上拖一下…', liveWait: '转一格 SOUND 旋钮…' },
            { text: '切回 **CHORD**：慢慢转**第 2 个**旋钮，转到 “CHORD” 亮（换音色把它冲掉了）。', panel: ['SD2', 'INDEX', 'METER'], detect: { kind: 'polymode', track: 'SYNTH2', mode: 2 }, wait: '往上拖第 2 个旋钮，直到 CHORD 亮…', liveWait: '慢慢转第 2 个旋钮，直到读数变成 CHORD…' },
            STOP('短按 [PLAY] 听一圈：还是那四个和弦，换了副嗓子（4 号工程里没有和弦的话，只听得到鼓：那就再按几个 Synth keys 听）。再按一次停下。'),
          ],
          done: '还是那四个和弦，只换了音色，整段的感觉就变了。',
          coach: '学生在 4 号工程（第 3 章的循环：鼓、SYNTH 1 两小节贝斯、SYNTH 2 两小节和弦 1 6 3 7）上给 SYNTH 2 换 Pad：按 SYNTH 2 旋钮选中；按住 Sound Design 旋钮 1（右边桔红区最上面、印着 SOUND）再按 Drum key 6 跳到 PAD 类；转一格旋钮 1 听下一个；再把旋钮 2 转回 CHORD（弹法存在音色里，换音色会冲掉）；按 [PLAY] 听。跳类别要在 Sound Design 第 1 页上。机器没有屏幕，音色名只在应用的镜像里看得到。',
        },
        {
          type: 'read',
          title: '4 个旋钮，好几页',
          blocks: [
            '右边那一列 4 个旋钮，管的东西不止 4 样：它们有**好几页**，翻一页，4 个旋钮就换一批工作。到现在你只用过第 1 页：',
            { list: [
              '**第 1 页**：① SOUND 换音色 ② 弹法（MONO / POLY / CHORD；鼓轨上是音高）③ 声像（偏左还是偏右）④ 音量',
              '**第 2 页**：① **ATTACK** 起音 ② **DECAY** 衰减 ③ **FILTER** 滤波器 ④ **RESONANCE** 共鸣——这一章的主角',
            ] },
            { panel: ['SDKNOBS', 'SDPAGE', 'INDEX', 'METER'], lit: { 'INDEX.FILTER': 'white', 'METER.7': 'cyan' }, caption: '翻页键在那一列旋钮的**正下方**、靠近你这一边的边沿上，印着一排三个小点。翻到第几页看那列 8 个小灯：**最上面那个**亮 = 第 1 页，**往下第 2 个** = 第 2 页。正在拧哪一样，看左边那列会亮的字（Index）。图上是在第 2 页拧滤波器时的样子。' },
            { callout: 'warn', title: '翻页之后，最上面那个就不是换音色了', text: '在第 2 页上转最上面那个旋钮，调的是**起音**（Index 亮 ATTACK），不是换音色。想换音色，先翻回第 1 页。拿不准在第几页，看 Index 亮的是哪个字。' },
            { callout: 'tip', text: '转 = 细调；**按下去再转** = 一下改很多。' },
          ],
        },
        {
          type: 'do',
          title: '翻到第 2 页，再翻回来',
          blocks: [
            '动手认一下翻页：翻到第 2 页，各拧一下两个旋钮，看 Index 上的字怎么变，再翻回第 1 页。',
            { callout: 'tip', text: '模拟机上：翻页键是那一列下面的小凸起，**单按**一下就是翻页（按满 2 秒是另一个功能，第 4 节课再说）。' },
          ],
          liveBlocks: [
            '动手认一下翻页：翻到第 2 页，各拧一下两个旋钮，看 Index 上的字怎么变，再翻回第 1 页。',
            { device: ['sdpage', 'attack:SYNTH2'] },
            RIFF('SYNTH2'),
            { callout: 'tip', text: '翻页键：右边那一列旋钮的正下方、靠近你这一边的边沿上，印着一排三个小点。**单按**一下就是翻页，别按住不放（按满 2 秒是另一个功能，第 4 节课再说）。' },
            FILTER_LIVE,
          ],
          tasks: [
            PAGE2(),
            { text: '转一下**最上面**那个：Index 亮 **ATTACK**——音色没换，换的是“声音起来要多久”。', panel: ['SD1', 'INDEX'], detect: { kind: 'param', track: 'SYNTH2', param: 'attack', by: 8 }, wait: '把最上面那个旋钮拖一拖…', liveWait: '转一下最上面那个旋钮…' },
            { text: '再转一下**第 3 个**：Index 亮 **FILTER**，一边闷、一边薄。', panel: ['SD3', 'INDEX'], detect: { kind: 'param', track: 'SYNTH2', param: 'cutoff', by: 8 }, wait: '把第 3 个旋钮往下拖…', liveWait: '转一下第 3 个旋钮（没打勾就点“我已经做了”）…' },
            { text: '**单按**翻页键，翻回**第 1 页**（最上面那个小灯亮）。', panel: ['SDPAGE', 'METER'], detect: { kind: 'sdpage', page: 0 }, wait: '再单按一下翻页键…', liveWait: '单按翻页键，翻回第 1 页…' },
          ],
          done: '同样 4 个旋钮，翻一页就换一批工作。拿不准在哪一页，看 Index。',
          coach: '学生在认 Sound Design 的翻页：单按 Sound Design Page 键（右边那一列旋钮正下方的边沿上，印着三个小点）在第 1、2 页之间换；Global Meter 最上面的灯亮 = 第 1 页，第 2 个 = 第 2 页。第 2 页的四个旋钮自上而下是 ATTACK、DECAY、FILTER、RESONANCE，Index 上对应的字会亮。重点：翻页之后最上面那个旋钮不再是换音色。真机上起音读得出来（自动打勾），滤波器读不出来（没打勾就让他点“我已经做了”）。',
        },
        {
          type: 'read',
          title: '拧过的东西住在哪',
          blocks: [
            '刚才拧的起音、滤波器，还有第 3 章切的弹法，都**跟着音色走**。这件事决定了你会不会白拧，记住三条：',
            { list: [
              '**换音色，拧过的就没了。** 新音色带着它自己的样子进来：第 2 页那几样、弹法、单轨效果（下下节课用到），统统换成新音色自己的。所以顺序永远是：**先挑音色，再拧**。',
              '**[UNDO/REDO] 能反悔“拧”，不能反悔“换”。** 它在 SOUND 那一列旋钮的正上方、上边沿上，只管拧过的参数；换了音色想回去，只能把 SOUND 旋钮转回原来那个，拧过的已经找不回来。',
              '**拧满意了，就存下来。** **先按住** [ALL] 旋钮（鼓区左上角第一个）**不放，再按一下** SOUND 旋钮（是**按下去**，不是转），然后都松开。右边那列小灯白色闪一下 = 存好了。',
            ] },
            { panel: ['ALL', 'SD1', 'UNDO'], caption: '存音色：按住 [ALL]，再按（不是转）SOUND 旋钮。[UNDO/REDO] 在 SOUND 旋钮那一列的正上方。' },
            { callout: 'theory', title: '存成了什么', text: '存下来的音色排在原来那个的后面，名字是原名加上 **_edit01**（再存一次就是 _edit02），还会自动放进**收藏**：以后按住 SOUND 旋钮、再按第 16 个方键（FAVORITE），就能跳到你存过的音色。删存过的音色只能在官方 App 里。' },
            { callout: 'warn', text: '工程会在换工程、关机时自动保存；你拧过、还没存成音色的那些，会不会跟着工程一起留下，手册没写。最稳的办法：拧满意了就存一下。[UNDO/REDO] 一个键怎么分撤销和重做，手册也没写：按一下听听回没回去，再按一下听是不是又回来了。' },
          ],
        },
        {
          type: 'quiz',
          title: '三个小问题',
          questions: [
            {
              q: '你在 SYNTH 2 上把滤波器拧得刚刚好，接着转了一下 SOUND 旋钮换音色。刚才拧的滤波器——',
              options: ['还在', '换成了新音色自己的样子，刚才拧的没了', '自动存成了 _edit01'],
              answer: 1,
              explain: '拧过的都跟着音色走。所以先挑音色、再拧；拧满意了先存。',
              wrong: { 0: '换音色时，新音色带着它自己的样子进来，刚才拧的被冲掉了。', 2: '不会自动存。存要自己按：按住 [ALL]，再按一下 SOUND 旋钮。' },
            },
            {
              q: '翻到第 2 页之后，转最上面那个旋钮（印着 SOUND 的那个），调的是——',
              options: ['换音色', '起音（ATTACK）：声音起来要多久', '音量'],
              answer: 1,
              explain: '翻页之后它换了工作，Index 上亮的是 ATTACK。换音色要回到第 1 页。',
              wrong: { 0: 'SOUND 只是它在第 1 页上的工作。翻页之后看 Index：亮的是 ATTACK。', 2: '音量是第 1 页的第 4 个。' },
            },
            {
              q: '想把拧好的音色存下来，怎么按？',
              options: ['按住 [ALL] 不放，再按一下 SOUND 旋钮', '按住 SOUND 旋钮，再按第 16 个方键', '按一下 [UNDO/REDO]'],
              answer: 0,
              explain: '存好时右边那列小灯白色闪一下，音色名后面多了 _edit01。',
              wrong: { 1: '那是跳到“收藏”这一类：存过的音色都在那里。', 2: '那是反悔刚才拧的那一下。' },
            },
          ],
        },
      ],
    },

    // ───────────────────────── 4.2 ─────────────────────────
    {
      id: '4-2',
      simProject: 3,
      simSeed: CH3_LOOP,
      no: '4.2',
      title: '滤波器：把声音削亮、削暗',
      minutes: 35,
      summary: '滤波器削掉的是什么（泛音）；截止和共鸣；在机器上给贝斯开一扇门、加一点“喵”；第 2 页的 FILTER 只管一条轨道，和管整台的那个不是一回事。',
      takeaway: '一个音 = 一个**本音** + 上面一串**泛音**。**滤波器**把泛音从上往下削（声音变闷），或者从下往上削（变薄）。机器上：选中轨道，翻到**第 2 页**，**第 3 个**旋钮是 FILTER（一边闷、一边薄、正中间原样），**第 4 个**是 RESONANCE（共鸣：切口上那一下“喵”）。它只管**选中的那一条轨道**；想整台一起捂，用 [FX] 旋钮里的 FILTER（开关拨在 MASTER）。',
      steps: [
        {
          type: 'read',
          title: '一条贝斯，一个旋钮',
          blocks: [
            '先玩。下面是一条贝斯，右边那个旋钮就是机器第 2 页的 **FILTER**。点「播放」，慢慢往下拧，再往上拧过正中间：',
            { widget: 'synthlab', lab: 'filter', knobs: ['cutoff'], title: '往下：闷；往上：薄；正中间：原样（双击旋钮回到正中间）' },
            '往下拧，声音像被一扇门隔开，越来越闷；往上拧，低音一点点被抽走，最后只剩沙沙的高音。正中间是原样。画面上那条竖线就是滤波器下刀的地方，蒙上一层的是被削掉的。',
            { classroom: 'F2', text: '在小课堂 F2 里你已经“隔着一扇门听派对”了。这一课多讲两件事：它削掉的到底是什么；那一声“喵”是怎么来的。' },
            { callout: 'dj', text: '混音台上的 FILTER 旋钮就是这一路：往左低通、往右高通，中间不动。区别是混音台上那个管整首歌，机器第 2 页这个**只管一条轨道**——这一课最后会对比。' },
          ],
        },
        {
          type: 'do',
          title: '在机器上找到它',
          blocks: [
            '轮到第 3 章那条贝斯（SYNTH 1）。让循环放着，一边听一边拧。',
            { callout: 'tip', text: '模拟机上：翻页键是那一列下面的小凸起，单按一下；旋钮上下拖（或滚轮）。模拟机上往下拖是闷、往上拖是薄。' },
          ],
          liveBlocks: [
            '轮到第 3 章那条贝斯（SYNTH 1）。让循环放着，一边听一边拧。4 号工程里没有那条贝斯的话，点下面的按钮，让机器替你弹一段。',
            { device: ['sound:SYNTH1', 'sdpage'] },
            RIFF('SYNTH1'),
            FILTER_WAY,
            FILTER_LIVE,
          ],
          tasks: [
            SELECT('SYNTH1', '中间合成器区上排左边'),
            PAGE2('（已经在第 2 页就会自己打勾。）'),
            PLAY(),
            { text: '**慢慢转第 3 个**（FILTER），转到贝斯闷闷的，像隔着一扇门。', panel: ['SD3', 'INDEX'], sim: { kind: 'param', track: 'SYNTH1', param: 'cutoff', atMost: -20 }, live: { kind: 'param', track: 'SYNTH1', param: 'cutoff', by: 16 }, wait: '把第 3 个旋钮往下拖…', liveWait: '慢慢转第 3 个旋钮，听贝斯变闷…' },
            { text: '往**另一边**转过正中间：低音被抽走，贝斯变薄。', panel: ['SD3', 'INDEX'], sim: { kind: 'param', track: 'SYNTH1', param: 'cutoff', atLeast: 20 }, live: { kind: 'param', track: 'SYNTH1', param: 'cutoff', by: 30 }, wait: '把第 3 个旋钮往上拖，拖过正中间…', liveWait: '往另一边转过正中间…' },
            { text: '转回**正中间**：贝斯回到原样。', panel: ['SD3', 'INDEX'], sim: { kind: 'param', track: 'SYNTH1', param: 'cutoff', near: 0, within: 4 }, live: { kind: 'param', track: 'SYNTH1', param: 'cutoff', near: 0, within: 6 }, wait: '把第 3 个旋钮拖回正中间…', liveWait: '转回声音正常的那一下…' },
            STOP(),
          ],
          done: '这就是机器上的滤波器：第 2 页、第 3 个旋钮，只管你选中的那一条。',
          coach: '学生在 SYNTH 1（第 3 章的贝斯）上第一次拧滤波器：按 SYNTH 1 旋钮选中，单按 Sound Design Page 键翻到第 2 页，按 [PLAY]，慢慢转第 3 个旋钮（Index 上 FILTER 亮）。它是 LP-HP 滤波器：一边是低通（闷）、一边是高通（薄），正中间是原样；往哪边是闷手册没写，让他转着听。真机上滤波器的位置应用读不出来（只有机器发 CC 才认得出，未验证），这几项没打勾就让他点“我已经做了”。',
        },
        {
          type: 'read',
          title: '它削掉的是什么',
          blocks: [
            '一个音不是只有一个音。你按下一个键，响的是一个最低的**本音**，上面还叠着一串越来越轻的**泛音**——像同一个人，楼上楼下都有回声。泛音多，声音亮、刺；泛音少，声音圆、闷。',
            { widget: 'synthlab', lab: 'filter', waves: true, knobs: ['cutoff'], title: '换一种原料，再拧滤波器' },
            '下面那排柱子，左边是低音、右边是高音。锯齿波一路高到最右边——泛音最多；正弦波只有最左边那一点——没有泛音。拿正弦波去拧滤波器，往闷里拧几乎没变化：**没有东西可削**。',
            { callout: 'theory', text: '这种做法叫**减法合成**：先要一个泛音很多的原料，再用滤波器往下削出想要的样子。SYNTH 1、SYNTH 2 都是这一路（原料是录好的一段波形）；DX 走的是另一条路，第 4 节课讲。' },
            'bad guy 里那条低音又闷又沉：高的那一截几乎全被削掉了，剩下的就是贴着地面走的那一点。',
          ],
        },
        {
          type: 'read',
          title: '共鸣：切口上那一下“喵”',
          blocks: [
            '滤波器下刀的地方叫**截止**（cutoff）。**共鸣**（resonance）是在这个切口上**往上顶一下**：正好在截止那里的泛音被放大，声音带上一种“喵 / 哇”的味道。截止一动，那个“喵”跟着走。',
            { widget: 'synthlab', lab: 'filter', knobs: ['cutoff', 'reso'], sweep: true, title: '先把 RESONANCE 往上拧，再点「自动扫一遍」' },
            '共鸣不拧，扫过去是“呼——”；共鸣拧高，扫过去是“哇——”。电子舞曲里副歌前那种越来越紧、越来越尖、然后一下放开的声音，很多就是滤波器加共鸣在扫。',
            { callout: 'warn', text: '共鸣要配着滤波器才听得出来：滤波器在正中间（原样）时，共鸣几乎听不见。共鸣拧得太高，切口那里会非常尖、非常响，戴耳机时慢慢加。' },
            { classroom: 'F4', text: '小课堂里会有一关专门玩它（还在做）。' },
          ],
        },
        {
          type: 'do',
          title: '给贝斯加一点“喵”',
          blocks: [
            '回到 SYNTH 1 的贝斯：先把共鸣加上去，再扫一遍滤波器。',
          ],
          liveBlocks: [
            '回到 SYNTH 1 的贝斯：先把共鸣加上去，再扫一遍滤波器。转的时候看右边那列小灯：亮得越高，值越大。',
            RIFF('SYNTH1'),
            FILTER_LIVE,
          ],
          tasks: [
            SELECT('SYNTH1', '中间合成器区上排左边'),
            PAGE2('（已经在第 2 页就会自己打勾。）'),
            PLAY(),
            { text: '**第 4 个**（RESONANCE）往大拧：顺时针，小灯往上走。', panel: ['SD4', 'INDEX', 'METER'], sim: { kind: 'param', track: 'SYNTH1', param: 'reso', atLeast: 24 }, live: { kind: 'param', track: 'SYNTH1', param: 'reso', by: 16 }, wait: '把第 4 个旋钮往上拖…', liveWait: '把第 4 个旋钮往大拧（没打勾就点“我已经做了”）…' },
            { text: '慢慢扫一遍**第 3 个**（FILTER）：往闷里转过去再转回来，听那个“哇”。', panel: ['SD3', 'INDEX'], detect: { kind: 'param', track: 'SYNTH1', param: 'cutoff', by: 24 }, wait: '把第 3 个旋钮往下拖一大截…', liveWait: '慢慢扫第 3 个旋钮（没打勾就点“我已经做了”）…' },
            STOP(),
          ],
          done: '“喵”有了。觉得太尖，把第 4 个往回拧一点；想回到刚才的样子，按 [UNDO/REDO] 试试。',
          coach: '学生在给 SYNTH 1 的贝斯加共鸣：第 2 页第 4 个旋钮（RESONANCE）往大拧，再扫第 3 个（FILTER），听切口上的“喵 / 哇”跟着截止走。提醒：滤波器在正中间时共鸣几乎听不出；共鸣太高很刺耳。真机上这两样应用读不出来（只有机器发 CC 才认得出，未验证），没打勾就点“我已经做了”。[UNDO/REDO] 能撤销拧旋钮，一个键怎么分撤销和重做手册没写。',
        },
        {
          type: 'read',
          title: '只管一条，还是管整台',
          blocks: [
            '机器上能把声音捂住的地方不止一个。拿同一段鼓 + 贝斯比一比：',
            { widget: 'trackfilter', title: '同一个旋钮，接在两个地方' },
            { list: [
              '**第 2 页的 FILTER**：每条轨道一个，跟着轨道（和它的音色）走。只捂贝斯，鼓照样清楚——编曲时最常用。',
              '**[FX] 旋钮里的 FILTER 这一类**（[MASTER/SINGLE] 拨在 MASTER）：管整台（小课堂 F1 用的是这一路的 [FX LEVEL]），适合在现场一把把整首歌捂住、再放开。小课堂 F2 在机器上拧的是上面那个第 2 页的。',
              '**[HIGH PASS] 触摸条**：也管整台，只削低音，手一离开就复原。第 7 章细讲。',
            ] },
            { callout: 'dj', text: '这就是“只拧一条轨道”和“拧总输出”的区别。打碟时你手上只有后一种（整首歌一起捂）；在机器上两种都有，还能分开用：贝斯捂着、鼓不动。' },
          ],
        },
        {
          type: 'quiz',
          title: '用耳朵回答',
          questions: [
            {
              q: 'A、B 是同一条贝斯。哪一个被滤波器往“闷”里削过？',
              play: [{ label: 'A', bpm: 104, voice: 'bass', notes: BASS, seconds: 3.5 }, { label: 'B', bpm: 104, voice: 'bassdark', notes: BASS, seconds: 3.5 }],
              options: ['A', 'B'],
              answer: 1,
              explain: 'B 的高的那一截被削掉了，像隔着一扇门。',
            },
            {
              q: '再听两条。哪一条加了共鸣（切口上那一下“哇”）？',
              play: [{ label: 'A', bpm: 104, voice: 'bassdark', notes: BASS, seconds: 3.5 }, { label: 'B', bpm: 104, voice: 'bassreso', notes: BASS, seconds: 3.5 }],
              options: ['A', 'B'],
              answer: 1,
              explain: 'B 在截止那里被顶了一下，每个音都带着一点“哇”。',
            },
            {
              q: '只想把贝斯捂住、鼓一点不动，用哪个？',
              options: ['选中 SYNTH 1，第 2 页的 FILTER（第 3 个旋钮）', '[MASTER/SINGLE] 拨在 MASTER，[FX] 旋钮转到 FILTER', '[HIGH PASS] 触摸条'],
              answer: 0,
              explain: '第 2 页那个滤波器每条轨道一个，只管选中的那一条。',
              wrong: { 1: 'MASTER 上的效果管整台：鼓也会一起被捂住。', 2: '[HIGH PASS] 也管整台，而且只削低音、手一松就复原。' },
            },
          ],
        },
      ],
    },

    // ───────────────────────── 4.3 ─────────────────────────
    {
      id: '4-3',
      simProject: 3,
      simSeed: CH3_LOOP,
      no: '4.3',
      title: '包络和摆动：声音的形状',
      minutes: 40,
      summary: '一个音从按下到消失的形状（起音、衰减）；把和弦变成“拨一下”，再变成慢慢浮上来的 Pad；一只自动拧旋钮的手（LFO），和机器上让声音摆起来的办法。',
      takeaway: '**包络**是一个音的形状：**ATTACK**（第 2 页第 1 个）管它起来要多久，**DECAY**（第 2 页第 2 个）管它落下去、松手后拖多久。起音快、衰减短 = “拨一下”；起音慢、衰减长 = Pad。**LFO** 是一只一直替你来回拧旋钮的手：拧音量是颤音，拧左右是自动声像，拧滤波器是“哇哇”。机器的音色里带着 LFO，但机身上没有旋钮管它；机身上让声音摆起来，是把 [MASTER/SINGLE] 拨到 **SINGLE**，[FX] 旋钮选 **MODULATION** 这一类，[FX LEVEL] 管加多少——用完拨回 MASTER。',
      steps: [
        {
          type: 'read',
          title: '按下去，到松开',
          blocks: [
            '先玩。按住下面那个键听一个音，看那个点沿着线走；再把两个旋钮往两头拧，换着听（也可以点「播放」听一段短和弦）：',
            { widget: 'synthlab', lab: 'envelope', title: '一个音的形状：起来要多久，落下去要多久' },
            { list: [
              '**ATTACK（起音）**：从按下到最响要多久。拧小，一按就出来；拧大，像雾一样慢慢浮上来。',
              '**DECAY（衰减）**：最响之后落下去要多久，和松手之后还拖多久。拧小，一下就没了；拧大，拖得很长。',
            ] },
            '同一个和弦，形状一变，用处就完全不同。一下一下“拨”出来的适合踩节奏：Faded 前奏那段钢琴，每个音都是一按就出来、很快变轻；慢慢浮上来、拖得很长的适合垫在后面，很多歌开头那种空气感就是它。',
            { callout: 'theory', text: '这条线叫**包络**（envelope）。别的合成器上常见四个旋钮（A、D、S、R）；这台机器只给了两个，把“落下去”和“松手后拖多久”放在了同一个旋钮上（手册里叫 DECAY/RELEASE）。' },
          ],
        },
        {
          type: 'do',
          title: '先把和弦变成“拨一下”',
          blocks: [
            '拿你上节课给 SYNTH 2 换好的 Pad 来做实验：先把它变成一下一下“拨”出来的。',
          ],
          liveBlocks: [
            '拿你上节课给 SYNTH 2 换好的 Pad 来做实验：先把它变成一下一下“拨”出来的。起音、衰减机器会告诉应用，拧对了会自己打勾：',
            { device: ['sound:SYNTH2', 'attack:SYNTH2', 'decay:SYNTH2'] },
            RIFF('SYNTH2'),
          ],
          tasks: [
            SELECT('SYNTH2', '中间合成器区上排右边'),
            PAGE2('（已经在第 2 页就会自己打勾。）'),
            PLAY(),
            { text: '**第 1 个**（ATTACK）往小拧到底：和弦一按就出来。', panel: ['SD1', 'INDEX'], detect: { kind: 'param', track: 'SYNTH2', param: 'attack', dir: -1, by: 16 }, wait: '把第 1 个旋钮往下拖…', liveWait: '把第 1 个旋钮往小拧…' },
            { text: '**第 2 个**（DECAY）往小拧：每个和弦“拨”一下就没了。', panel: ['SD2', 'INDEX'], detect: { kind: 'param', track: 'SYNTH2', param: 'decay', dir: -1, by: 16 }, wait: '把第 2 个旋钮往下拖…', liveWait: '把第 2 个旋钮往小拧…' },
            STOP('听几圈：铺满的和弦变成了一下一下的。再按 [PLAY] 停下。'),
          ],
          done: '拨一下：起音最快、衰减很短。',
          coach: '学生在 SYNTH 2（上节课换的 Pad，CHORD 弹法）上拧包络：第 2 页的旋钮 1 ATTACK 往小拧到底、旋钮 2 DECAY 往小拧，让和弦变成“拨一下”。真机上这两样应用读得出来（31 18 2C / 31 18 00），拧对了会自动打勾。和弦本身在格子里拉长到了 8 格，衰减短了之后听起来是一下一下的。',
        },
        {
          type: 'do',
          title: '再让它慢慢浮上来',
          blocks: [
            '反过来：起音拧大、衰减拧大，变成一层慢慢浮上来的雾。',
          ],
          liveBlocks: [
            '反过来：起音拧大、衰减拧大，变成一层慢慢浮上来的雾。',
            { device: ['attack:SYNTH2', 'decay:SYNTH2'] },
            { action: 'param', track: 'SYNTH2', param: ['attack', 'decay'], value: 0, label: '拧乱了？让应用把起音、衰减设回原样' },
            RIFF('SYNTH2'),
          ],
          tasks: [
            PLAY(),
            { text: '**第 1 个**（ATTACK）往大拧过一半：和弦慢慢浮上来。', panel: ['SD1', 'INDEX'], detect: { kind: 'param', track: 'SYNTH2', param: 'attack', dir: 1, by: 30 }, wait: '把第 1 个旋钮往上拖一大截…', liveWait: '把第 1 个旋钮往大拧…' },
            { text: '**第 2 个**（DECAY）也往大拧：一个拖进下一个，连成一片。', panel: ['SD2', 'INDEX'], detect: { kind: 'param', track: 'SYNTH2', param: 'decay', dir: 1, by: 24 }, wait: '把第 2 个旋钮往上拖一大截…', liveWait: '把第 2 个旋钮往大拧…' },
            STOP('找一个喜欢的位置停住，按 [PLAY] 停下。'),
          ],
          done: '同一个和弦：拨一下，是节奏；浮上来，是背景。停在你喜欢的样子——这一章最后会把它存下来。',
          coach: '学生把 SYNTH 2 的 Pad 的 ATTACK 和 DECAY 都往大拧，让和弦慢慢浮上来、拖得很长（典型的 Pad）。真机上这两样读得出来，会自动打勾；拧乱了有按钮可以让应用设回原样（官方 CC 73 / 75 = 64）。最后的形状由他自己定，第 4.4 节课会把它存成自己的音色。',
        },
        {
          type: 'read',
          title: '会自己动的声音：LFO',
          blocks: [
            '到现在，旋钮都是你拧一下、它停在那儿。要是有一只手，**一直替你来回拧**呢？',
            { widget: 'synthlab', lab: 'lfo', title: '一只替你来回拧旋钮的手' },
            '这只手叫 **LFO**（低频振荡器）：一种很慢很慢的波，慢到听不出音高，只拿来“拧”别的东西。它拧哪一样，声音就在哪一样上摆：',
            { list: [
              '拧**音量**：一大一小，叫颤音（Tremolo）。',
              '拧**左右**：在两边来回跑，叫自动声像（Auto Pan）。戴耳机最明显。',
              '拧**滤波器**：一开一合，“哇哇”的，叫自动哇音（Auto Wah）。',
              '拧**音高**：一高一低，叫揉弦（Vibrato）；摆得狠就成了警报声。',
            ] },
            'MODULATION 这一类有 8 个预设：1 SPX CHORUS 合唱、2 TEMPO FLANGER 镶边、3 TEMPO PHASER 相位、4 ENSEMBLE DETUNE 合奏、5 AUTO PAN 自动声像、**6 TREMOLO 颤音**、7 VCM AUTO WAH 自动哇音、8 RING MODULATOR 环形调制。下一步用第 6 个。',
            { callout: 'warn', title: '这台机器上，LFO 在哪', text: '机器里每个音色其实都带着 LFO，但**机身上没有旋钮管它**：手册说要在官方 App 的音色编辑里才调得到。机身上让声音摆起来，用的是 [FX] 旋钮里 **MODULATION** 这一类效果——它们里面也是这样一只手，而且跟着机器的速度摆。下一步就在机器上做。' },
            { classroom: 'F10', text: '小课堂里会有一关“晃动的声音”专门玩这一类（还在做）。' },
          ],
        },
        {
          type: 'do',
          title: '让 Pad 自己颤起来',
          blocks: [
            '[MASTER/SINGLE] 是 [FX] 旋钮下面那个横着拨的小开关：左边 **MASTER** 管整台，右边 **SINGLE** 只管选中的那一条轨道。这次只想让 Pad 颤，拨到 SINGLE。',
            { callout: 'tip', text: '模拟机上：点一下小开关就是拨过去；[FX] 旋钮上下拖，Index 上的字一行一行往下走；[FX LEVEL] 按住往上推。' },
          ],
          liveBlocks: [
            '[MASTER/SINGLE] 是 [FX] 旋钮下面那个横着拨的小开关：左边 **MASTER** 管整台，右边 **SINGLE** 只管选中的那一条轨道。这次只想让 Pad 颤，拨到 SINGLE。',
            RIFF('SYNTH2'),
            { callout: 'warn', title: '这几样机器不告诉应用', text: '开关拨在哪、[FX] 转到了哪一类，机器不上报：做完自己点“我已经做了”。[FX] 往哪边转是往下走、转到某个预设时小灯怎么亮，手册没细说：**一格一格转，看 Index 上的字**，转过头就往回。单轨效果也跟着音色走。' },
          ],
          tasks: [
            SELECT('SYNTH2', '中间合成器区上排右边'),
            { text: '[MASTER/SINGLE] 拨到右边的 **SINGLE**。', panel: ['MASTERSINGLE'], sim: { kind: 'fxswitch', single: true }, wait: '点一下那个小开关…' },
            { text: '[FX] 旋钮**一直往一个方向**转，Index 走到 **MODULATION**，再转到它的**第 6 个 TREMOLO**。', panel: ['FX', 'INDEX', 'METER'], sim: { kind: 'fxtype', cat: 'MODULATION', preset: 5, track: 'SYNTH2' }, wait: '把 [FX] 旋钮一直往上拖，拖到 MODULATION 的第 6 个…' },
            PLAY(),
            { text: '手指在 [FX LEVEL]（开关下面那条触摸条）上往上滑：Pad 一大一小地颤。', panel: ['FXLEVEL'], sim: { kind: 'fxlevel', min: 0.3 }, live: { kind: 'fxlevel' }, wait: '在 [FX LEVEL] 上按住往上推…', liveWait: '在 [FX LEVEL] 上往上滑（没打勾就点“我已经做了”）…' },
            STOP(),
            { text: '[MASTER/SINGLE] **拨回 MASTER**（别的课都在 MASTER 上做；颤音留在 Pad 的音色里）。', panel: ['MASTERSINGLE'], sim: { kind: 'fxswitch', single: false }, wait: '再点一下那个小开关…' },
          ],
          done: '你的 Pad 现在自己会颤。想要别的摆法，再拨到 SINGLE、转 [FX] 换一个 MODULATION 预设试试（AUTO PAN 戴耳机听最明显）。',
          coach: '学生在给 SYNTH 2 的 Pad 加单轨效果：[MASTER/SINGLE] 开关（[FX] 旋钮下面，左 MASTER、右 SINGLE）拨到 SINGLE；转 [FX] 旋钮到 Index 上 MODULATION 亮，再到第 6 个预设 TREMOLO（预设编号显示在 Global Meter 上，具体怎么亮手册没细说）；按 [PLAY]，在 [FX LEVEL] 触摸条上滑（SINGLE EFFECT PARAMETER 1，对 TREMOLO 来说具体是哪个参数手册附录才有，让他滑着听）；最后拨回 MASTER。机器不上报开关位置和 [FX] 的类别，这几项要他自己点“我已经做了”；[FX LEVEL] 应用试着从 CC 107 认，没人验证过。单轨效果跟着音色走（手册 10.1.1）。这台机器的 LFO 只能在官方 App 里调，机身上靠 MODULATION 类效果。',
        },
        {
          type: 'quiz',
          title: '三个小问题',
          questions: [
            {
              q: 'A、B 是同一个声音。哪一个起音更慢（慢慢浮上来）？',
              play: [{ label: 'A', bpm: 92, voice: 'synthpluck', notes: CHORDS, seconds: 4 }, { label: 'B', bpm: 92, voice: 'synthslow', notes: CHORDS, seconds: 4 }],
              options: ['A', 'B'],
              answer: 1,
              explain: 'B 的每个和弦都是慢慢浮上来的；A 是一按就出来、马上落下去。',
            },
            {
              q: '想让和弦一下一下“拨”出来、马上没了，第 2 页的两个旋钮怎么拧？',
              options: ['ATTACK 拧小、DECAY 拧小', 'ATTACK 拧大、DECAY 拧大', '只把 FILTER 往闷里拧'],
              answer: 0,
              explain: '起音快、衰减短，就是“拨一下”。',
              wrong: { 1: '那是 Pad：慢慢浮上来、拖得很长。', 2: '滤波器管的是亮和暗，不管长和短。' },
            },
            {
              q: '在机器上让一条轨道自己“颤”起来，用的是——',
              options: ['第 2 页的 RESONANCE', '[MASTER/SINGLE] 拨到 SINGLE，[FX] 选 MODULATION 里的 TREMOLO，[FX LEVEL] 加多少', '按住 [ALL] 再按 SOUND 旋钮'],
              answer: 1,
              explain: '机身上没有 LFO 的旋钮，靠的是 MODULATION 这一类效果。用完记得拨回 MASTER。',
              wrong: { 0: '共鸣是滤波器切口上那一下“喵”，不会自己动。', 2: '那是存音色。' },
            },
          ],
        },
      ],
    },

    // ───────────────────────── 4.4 ─────────────────────────
    {
      id: '4-4',
      simProject: 3,
      simSeed: CH3_LOOP,
      no: '4.4',
      title: 'DX 的金属味，和你自己的三件乐器',
      minutes: 45,
      summary: 'DX 用另一种办法做声音（FM）：进阶设置、第 5 页的三个旋钮；然后从预设出发，拧出你自己的贝斯、Pad 和 Lead，一个个存下来。',
      takeaway: 'DX 是 **FM**：用一个音去“摇”另一个音——摇得越狠越亮（调制量），摇它的那个音不是整数倍时像铃铛（调制频率），加反馈就发毛。它们在**进阶设置**里：**长按翻页键 2 秒**进去，单按翻到**第 5 页**，旋钮 2、3、4 就是这三样（第 1 个是算法，先别动）；用完再长按 2 秒出来。做一个自己的音色，路子永远是：**挑一个接近的预设 → 翻到第 2 页拧 → 按住 [ALL] 再按一下 SOUND 旋钮存下来**。',
      homework: '关机前把三个存好的音色在收藏里找一遍：选中轨道，按住 SOUND 旋钮再按第 16 个方键，再转 SOUND 旋钮。',
      steps: [
        {
          type: 'read',
          title: '另一种做声音的办法：FM',
          blocks: [
            'SYNTH 1、SYNTH 2 是“先要一个泛音很多的原料，再往下削”。**DX** 走的是另一条路：用一个音去**摇**另一个音。摇得越狠，泛音长得越多，声音越亮、越硬。这叫 **FM**（调频合成）。',
            { widget: 'synthlab', lab: 'fm', title: 'DX 第 5 页的三个旋钮（点「播放」，再换着点电钢琴 / 铃铛 / 贝斯 / Lead）' },
            { list: [
              '**AMOUNT（调制量）**：摇得多狠。拧到最小几乎是一个纯纯的音；拧大，越来越亮、越来越硬。',
              '**FREQUENCY（调制频率）**：摇它的那个音是几倍的音高。整数倍还是“乐音”；转到不是整数倍的那几档，就成了铃铛、敲金属的声音。',
              '**FEEDBACK（反馈）**：让它自己摇自己，加了就发毛、发沙。',
            ] },
            { callout: 'dj', text: 'Blinding Lights、Starboy 那种复古味道，借的是 80 年代合成器的声音；那个年代最有名的电钢琴、铃声和很“硬”的贝斯，很多就是 FM 做的。' },
            { callout: 'theory', text: '机器的 DX 用 4 个“算子”（会响的正弦波）互相摇，怎么接有 12 种，叫**算法**（第 5 页的第 1 个旋钮）。上面的实验台只用了两个，是个简化版：机器上同样的位置，声音不会一模一样。' },
          ],
        },
        {
          type: 'do',
          title: '进进阶设置，翻到第 5 页',
          blocks: [
            '这三个旋钮藏在**进阶设置**里。进去的办法：**长按**翻页键（右边那一列正下方、印着三个小点的那个）**2 秒以上**。进去之后，单按翻页键能翻到更多页：DX 一共 5 页，**第 5 页**就是 FM。',
            { callout: 'tip', text: '模拟机上：在翻页键上按住不放，心里数到 2 再松手。' },
          ],
          liveBlocks: [
            '这三个旋钮藏在**进阶设置**里。进去的办法：**长按**翻页键（右边那一列正下方、印着三个小点的那个）**2 秒以上**。进去之后，单按翻页键能翻到更多页：DX 一共 5 页，**第 5 页**就是 FM。下面这两个读数会跟着变：',
            { device: ['sound:DX', 'sdmode', 'sdpage'] },
            { callout: 'tip', text: '第 5 页上 Index 亮的是 **OTHER**（FM 这几样没有专门的字）。手册只画了第 1、2 页的小灯（最上面 = 第 1 页、往下一个 = 第 2 页），照这个规律第 5 页是从上往下第 5 个；**以上面的读数为准**。' },
          ],
          tasks: [
            SELECT('DX', '中间合成器区下排左边'),
            { text: '按几个 Synth keys，听 DX 现在的声音。', panel: ['SYNTHKEYS'], detect: { kind: 'note', track: 'DX', count: 2 }, wait: '按 Synth keys', liveWait: '按 Synth keys' },
            { text: '**长按**翻页键 **2 秒**：进**进阶设置**。', panel: ['SDPAGE'], detect: { kind: 'sdmode', on: true }, wait: '在翻页键上按住 2 秒…', liveWait: '长按翻页键 2 秒…' },
            { text: '**单按**翻页键，翻到**第 5 页**（小灯从上往下第 5 个亮）。', panel: ['SDPAGE', 'METER'], detect: { kind: 'sdpage', page: 4 }, wait: '单按翻页键，翻到第 5 页…', liveWait: '单按翻页键，翻到第 5 页…' },
          ],
          done: '到了：现在 4 个旋钮是 FM 的那几样。',
          coach: '学生在找 DX 的 FM 参数：按 DX 旋钮选中；长按 Sound Design Page 键 2 秒进入 advanced settings（System 参数 00 00 21 = 1，应用读得出）；单按翻页键翻到第 5 页（Global Meter 从上往下第 5 个灯，Index 亮 OTHER）。第 5 页：旋钮 1 FM ALGORITHM（12 种）、2 MODULATOR AMOUNT、3 MODULATOR FREQUENCY、4 MODULATOR FEEDBACK。',
        },
        {
          type: 'do',
          title: '拧出金属味',
          blocks: [
            '一边按 Synth keys，一边拧。第 1 个旋钮是算法，先别动它。',
            { callout: 'tip', text: 'DX 同时最多响 8 个音（手册：FM 一共 8 个复音），一次按太多键会有音被吃掉。' },
          ],
          liveBlocks: [
            '一边按 Synth keys，一边拧。第 1 个旋钮是算法，先别动它。这三样机器会告诉应用：',
            { device: ['fmAmt:DX', 'fmFreq:DX', 'fmFb:DX'] },
            { action: 'param', track: 'DX', param: ['fmAmt', 'fmFreq', 'fmFb'], value: 0, label: '拧乱了？让应用把这三样都设回原样' },
            RIFF('DX'),
          ],
          tasks: [
            { text: '**第 2 个**（调制量）往大拧，边按键边听：越来越亮、越硬。', panel: ['SD2', 'SYNTHKEYS'], detect: { kind: 'param', track: 'DX', param: 'fmAmt', dir: 1, by: 20 }, wait: '把第 2 个旋钮往上拖…', liveWait: '把第 2 个旋钮往大拧…' },
            { text: '转一转**第 3 个**（调制频率），找一个像铃铛的位置。', panel: ['SD3', 'SYNTHKEYS'], detect: { kind: 'param', track: 'DX', param: 'fmFreq', by: 9 }, wait: '把第 3 个旋钮拖几格…', liveWait: '转一转第 3 个旋钮…' },
            { text: '**第 4 个**（反馈）往大拧一点：开始发毛。', panel: ['SD4', 'SYNTHKEYS'], detect: { kind: 'param', track: 'DX', param: 'fmFb', dir: 1, by: 12 }, wait: '把第 4 个旋钮往上拖…', liveWait: '把第 4 个旋钮往大拧一点…' },
            { text: '**长按**翻页键 2 秒：**出**进阶设置。', panel: ['SDPAGE'], detect: { kind: 'sdmode', on: false }, wait: '在翻页键上按住 2 秒…', liveWait: '长按翻页键 2 秒…' },
            { text: '单按翻页键，翻回**第 1 页**。', panel: ['SDPAGE', 'METER'], detect: { kind: 'sdpage', page: 0 }, wait: '单按翻页键…', liveWait: '单按翻页键，翻回第 1 页…' },
          ],
          done: '这就是 FM：同一个 DX，拧三个旋钮，从电钢琴到铃铛到电子游戏。',
          coach: '学生在 DX 第 5 页（进阶设置）上拧 FM：旋钮 2 调制量往大（更亮更硬）、旋钮 3 调制频率（不是整数倍时像铃铛）、旋钮 4 反馈（发毛）；然后长按翻页键 2 秒出进阶设置、翻回第 1 页。真机上这三样和进阶设置的开关应用都读得出来（31 19 03 / 04 / 05、00 00 21），会自动打勾；拧乱了有按钮让应用设回原样（CC 117–119 = 64）。',
        },
        {
          type: 'read',
          title: '你的三件乐器',
          blocks: [
            '最后一件事：用这一章学的，把第 3 章那段循环里的三条合成器轨，变成**你自己的**三件乐器。先听一下三张配方在同一串音上有多不一样：',
            { widget: 'synthlab', lab: 'presets', title: '三张配方：贝斯、Pad、Lead（旋钮摆在各自的位置上，可以接着拧）' },
            { list: [
              '**贝斯（SYNTH 1）**：挑 BASS 类（第 1 个方键）里一个你喜欢的；第 2 页把 DECAY 往小拧一点、FILTER 往闷里拧一点：短、沉、不抢。',
              '**Pad（SYNTH 2）**：上一节课已经做好了——起音慢、拖得长、弹和弦，还会颤。',
              '**Lead（DX）**：主旋律站在最前面：亮、起得快。第 1 页把弹法切到 **MONO**（一次一个音，弹旋律不糊）；想更亮，就回第 5 页把调制量再往大拧。',
            ] },
            { callout: 'tip', text: '没有标准答案：配方只是起点，听着顺耳就停。Animals、Faded 里那条一听就记住的主旋律，都是“亮、起得快”这一路。' },
            '每做好一件，就**存下来**：按住 [ALL]，再按一下 SOUND 旋钮。存好的三件都在“收藏”里，以后在别的工程里也能叫出来。',
          ],
        },
        {
          type: 'do',
          title: '章节挑战（一）：你的贝斯',
          blocks: [
            '先是贝斯。挑、拧、存，三步。',
          ],
          liveBlocks: [
            '先是贝斯。挑、拧、存，三步。',
            { device: ['sound:SYNTH1', 'decay:SYNTH1', 'sdpage'] },
            RIFF('SYNTH1'),
            FILTER_LIVE,
          ],
          tasks: [
            SELECT('SYNTH1', '中间合成器区上排左边'),
            PAGE1(),
            { text: '挑贝斯：**先按住** SOUND 旋钮**不放，再按**上排**第 1 个**方键（BASS），再转 SOUND 挑一个。（不想换就点“我已经做了”。）', panel: ['SD1', 'DK1'], detect: { kind: 'sound', track: 'SYNTH1' }, wait: '长按 SOUND 旋钮出现黑圈，再点上排第 1 个方键…', liveWait: '按住 SOUND 旋钮不放，再按上排第 1 个方键…' },
            PAGE2(),
            { text: '**第 2 个**（DECAY）往小拧一点：短一点、利落一点。', panel: ['SD2', 'INDEX'], detect: { kind: 'param', track: 'SYNTH1', param: 'decay', dir: -1, by: 12 }, wait: '把第 2 个旋钮往下拖…', liveWait: '把第 2 个旋钮往小拧一点…' },
            { text: '**第 3 个**（FILTER）往闷里拧一点。', panel: ['SD3', 'INDEX'], sim: { kind: 'param', track: 'SYNTH1', param: 'cutoff', atMost: -12 }, live: { kind: 'param', track: 'SYNTH1', param: 'cutoff', by: 12 }, wait: '把第 3 个旋钮往下拖…', liveWait: '把第 3 个旋钮往闷里拧一点（没打勾就点“我已经做了”）…' },
            SAVE('SYNTH1', '音色名后面会多出 _edit01。'),
          ],
          done: '贝斯存好了：名字后面多了 _edit。',
          coach: '章节挑战的第一件：SYNTH 1 的贝斯。选中 SYNTH 1，确认 Sound Design 在第 1 页，按住旋钮 1 再按 Drum key 1 跳到 BASS 类并转旋钮 1 挑一个（也可以不换）；翻到第 2 页，DECAY 往小、FILTER 往闷里拧一点；最后按住 [ALL] 再按一下旋钮 1 存音色（Global Meter 白色闪烁；名字变成“原名_editNN”，应用会去读名字来打勾——存完名字是不是马上读得到，没人在真机上试过）。',
        },
        {
          type: 'do',
          title: '章节挑战（二）：Pad 和 Lead',
          blocks: [
            '再把 Pad 存下来，然后把 DX 变成 Lead。',
          ],
          liveBlocks: [
            '再把 Pad 存下来，然后把 DX 变成 Lead。',
            { device: ['sound:SYNTH2', 'sound:DX', 'poly:DX'] },
            { action: 'polymode', track: 'DX', mode: 0, label: '让应用直接把 DX 切到 MONO' },
            RIFF('DX'),
          ],
          tasks: [
            SELECT('SYNTH2', '中间合成器区上排右边'),
            SAVE('SYNTH2', 'Pad 上节课已经拧好了。'),
            SELECT('DX', '中间合成器区下排左边'),
            PAGE1(),
            { text: 'DX 切到 **MONO**：慢慢转**第 2 个**，转到 “MONO/POLY” 亮、小灯最上面那个亮。', panel: ['SD2', 'INDEX', 'METER'], detect: { kind: 'polymode', track: 'DX', mode: 0 }, wait: '把第 2 个旋钮往下拖，直到 MONO…', liveWait: '慢慢转第 2 个旋钮，直到读数变成 MONO…' },
            { text: '一次一个地弹几个 Synth keys，像吹一段旋律。', panel: ['SYNTHKEYS'], detect: { kind: 'note', track: 'DX', count: 4 }, wait: '按 Synth keys', liveWait: '按 Synth keys' },
            SAVE('DX', '三件都存好了。'),
          ],
          done: '三件你自己的乐器都存好了：都在“收藏”里（按住 SOUND 旋钮，再按第 16 个方键）。',
          coach: '章节挑战的第二件：选中 SYNTH 2，按住 [ALL] 再按旋钮 1 把上节课拧好的 Pad 存下来；选中 DX，第 1 页旋钮 2 切到 MONO（弹法存在音色里；有按钮可以让应用替他切，CC 26 = 0），弹几个音当 Lead，再存下来。存好的音色名后面是 _editNN，都在 FAVORITE 类（Drum key 16）里。',
        },
        {
          type: 'quiz',
          title: '最后三个问题',
          questions: [
            {
              q: 'DX 的 FM 那几个旋钮在哪？',
              options: ['第 2 页', '进阶设置里的第 5 页（长按翻页键 2 秒进去）', '[FX] 旋钮里'],
              answer: 1,
              explain: '长按翻页键 2 秒进进阶设置，单按翻到第 5 页；用完再长按 2 秒出来。',
              wrong: { 0: '第 2 页是起音、衰减、滤波器、共鸣，每条合成器轨都一样。', 2: '[FX] 旋钮是效果，不是 DX 自己的发声办法。' },
            },
            {
              q: 'A、B 是同一个 FM 电钢琴。哪一个的调制量拧得更大？',
              play: [{ label: 'A', bpm: 100, voice: 'fmsoft', notes: MELODY.map(([s, n, l]) => [s, n - 12, l]), seconds: 3.5 }, { label: 'B', bpm: 100, voice: 'fmhard', notes: MELODY.map(([s, n, l]) => [s, n - 12, l]), seconds: 3.5 }],
              options: ['A', 'B'],
              answer: 1,
              explain: 'B 摇得更狠，泛音多，又亮又硬；A 几乎是一个圆圆的音。',
            },
            {
              q: '做一个自己的音色，顺序是——',
              options: ['先拧，再挑音色，再存', '先挑一个接近的预设，再拧，再存', '先存，再挑，再拧'],
              answer: 1,
              explain: '先挑音色再拧：换音色会把拧过的冲掉。拧满意了马上存。',
              wrong: { 0: '先拧再换音色，拧过的就被新音色冲掉了。', 2: '存的是“现在的样子”：要先挑好、拧好再存。' },
            },
          ],
        },
      ],
    },
  ],
};
