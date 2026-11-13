// 第 3 章 · 和弦与和声。写法和前两章一样（见 curriculum.js 顶部的说明、ch0.js 顶部关于 live* 的说明）。
//
// 机器操作的依据（docs/seqtrak-operation-reference.md）：3.5.6 MONO / POLY / CHORD、3.5.10 步进编辑（放和弦、按住步进键 + Synth key 换和弦、
// 按住步进键 + 转 [ALL] 改音长）、3.3.4 按类别跳音色、3.7.4 [BAR LENGTH]、3.4.2 [PAGE] 翻页。手册没写明的（旋钮 2 往哪边转是 CHORD、
// 单按一次 [BAR LENGTH] 怎么变、音长在步进键上具体怎么显示）课文里都不下结论，让学生看屏幕上的读数。
// 2026-11-10 在用户这台机器（V2.00）上实测过的几件事，课文是照着写的（docs/hardware-findings.md“第 3 章开工前的探测”）：
//   · CHORD 状态下 7 个键的和弦，C 小调里是 Cm7 Dm7♭5 D#maj7 Fm7 Gm7 G#maj7 A#7（每个 4 个音），和官方默认值一样；
//   · “单音 / 复音 / 和弦”是存在音色里的：换音色会把它换成新音色自己的设定，所以要“先挑音色，再切 CHORD”；
//   · 空白工程里 SYNTH 1 是贝斯音色（MONO），SYNTH 2 是 POLY。
//
// 这一章新增的任务条件（lesson.js）：polymode（弹法）、chord（几个音一起响）、length（乐句几小节），真机镜像都认得出；
// stepkeys（每一步是第几个键）、notelen（音长）、page（翻页）、mode: stepinput 只有模拟机认得出，真机上学生自己点“做好了”。
// 任务里的 live = 接着真机时优先用的条件。
//
// 3.4 的“歌里的和弦”只用用户听过的歌（content/songs.js 开头那 11 首）。2026-11-12 他说“先换 3.4 的歌”，
// 把原来的 Sweet Dreams、Still D.R.E.（还有练习场里的 Clint Eastwood，他都没听过）换成了：
//   Gangsta's Paradise（原曲就在 C 小调：键 6 → 4 → 5 → 1，第三个和弦原曲是 G 大和弦，机器键 5 是小和弦，差一个音）、
//   Starboy（A 小调：键 1 → 7 → 6 → 7，一小节一个；正好是这一课开头那个“80 年代合成器”的预设）、
//   练习场里另有 Something Just Like This（B 小调：键 6 → 7 → 1 → 7）。
// 和弦和 content/song-parts.js 里这几首的分轨一致（查过资料、他听过并认了）；每个和弦占几拍是简化的写法，课文里说明了这是“简化版”。
// Faded、Wake Me Up 用的就是这一课的键 1 → 6 → 3 → 7，课文里点到了。
import { PATTERNS } from './charts.js';
import { chordAt } from '../scales.js';

const { FOUR, BACK } = PATTERNS;
const KICK2 = FOUR + FOUR;
const BACK2 = BACK + BACK;
const tri = (step, degree, len, opts = {}) => chordAt(step, degree, len, { size: 3, ...opts }); // 只要下面三个音的和弦
const bass = (pairs) => pairs.map(([step, name, len = 3]) => [step, name, len, 'bass', 0.85]);

export const ch3 = {
  id: 'ch3',
  no: 3,
  title: '和弦与和声',
  subtitle: '让音乐有“颜色”',
  lessons: [
    // ───────────────────────── 3.1 ─────────────────────────
    {
      id: '3-1',
      simProject: 3,
      no: '3.1',
      title: '三个音叠在一起',
      minutes: 25,
      summary: '和弦是什么；“隔一个拿一个”；在 SYNTH 2 上亲手叠出第一个和弦，听出暗和亮。',
      takeaway: '几个合得来的音**同时响**，就是**和弦**。做法只有一条：在音阶的 7 个键里**隔一个拿一个**——Synth key **1、3、5**。最底下那个音叫**根音**，就是贝斯弹的那个。中间那个音低一点，和弦偏**暗**（小和弦，名字带 m）；高一点就偏**亮**（大和弦）。',
      steps: [
        {
          type: 'read',
          title: '一个音是一条线，三个音是一块颜色',
          blocks: [
            '到现在为止，你的机器在任何一个瞬间，带音高的声音只有**一个**：贝斯的那一个音。鼓管“什么时候响”，贝斯管“地基在哪”，但整首歌还是黑白的。',
            '把几个合得来的音**同时**按下去，耳朵听到的就不再是“三个音”，而是一块整体的**颜色**。这块颜色叫**和弦**（chord）。先听区别：',
            { widget: 'ab', bpm: 84, title: '同一个 C：一个音，和三个音一起', a: { label: '一个音', voice: 'keys', notes: [[0, 'C3', 6], [8, 'C3', 6]] }, b: { label: '三个音一起响', voice: 'keys', notes: [...tri(0, 1, 6), ...tri(8, 1, 6)] } },
            { callout: 'dj', text: '你挑歌接歌的时候会看调（Key）：两首歌的调合得来，叠在一起才不打架。那个“合不合”，说的其实就是两首歌的**和弦**撞不撞。以前你是站在外面挑现成的颜色，这一章开始自己调颜色。' },
            '这一章要做的事：学会叠和弦，让机器的 **SYNTH 2** 和 **DX** 两位乐手来弹它，最后给第 2 章的贝斯线盖上一层“屋顶”。',
          ],
        },
        {
          type: 'read',
          title: '隔一个，拿一个',
          blocks: [
            '哪几个音“合得来”？规则只有一条，而且你已经有现成的工具了：在音阶的 7 个键里，**拿一个，跳过一个，再拿一个，再跳过一个，再拿一个**。',
            '从第 1 个键出发，拿到的就是 **Synth key 1、3、5**：',
            { panel: ['SK1', 'SK3', 'SK5'], lit: { SK1: 'yellow', SK3: 'yellow', SK5: 'yellow' }, caption: '上排圆点键右边是 1、2、3，下排是 4、5、6、7。1 和 3 在上排（圆点右边第 1 个和第 3 个），5 在下排左数第 2 个。' },
            '在下面玩一下。把“叠几层”从 1 点到 3，听颜色是怎么一层一层出来的；再点别的键，从它开始叠：',
            { widget: 'chordstack', start: 1, size: 1 },
            { callout: 'theory', text: '最底下的那个音叫**根音**，和弦的名字跟着它叫：从 C 开始叠的就是“C 什么什么和弦”。第 2 章里贝斯弹的“根音”，就是这个根音——贝斯在下面踩着它，和弦在上面把它展开。' },
          ],
        },
        {
          type: 'do',
          title: '在机器上亲手叠一个',
          blocks: [
            '这次请出一位新乐手：**SYNTH 2**。它的旋钮在中间合成器区 4 个旋钮里的**上排右边**（SYNTH 1 的右边）。模拟机上它是一架电钢琴，可以同时出好几个音。',
            { callout: 'tip', text: '模拟机上没法几个键真的同时按：**一秒之内把几个键连着点一遍**，余音会叠在一起，效果一样。' },
          ],
          liveBlocks: [
            '这次请出一位新乐手：**SYNTH 2**。它的旋钮在中间合成器区 4 个旋钮里的**上排右边**（SYNTH 1 的右边）。在空白工程里，它是一个可以同时出好几个音的音色。',
            { callout: 'warn', text: '只**按**旋钮，不要转。如果机器还在“打鼓模式”（Synth keys 按出来是鼓声），按了 SYNTH 2 旋钮之后它一般会自己退出；没退的话屏幕上会告诉你怎么退。' },
            { callout: 'tip', text: '三个键一起按只听到一个音？说明这条轨道现在是“单音”弹法，屏幕上会提示。下一课就教怎么切，这一步可以先点“我已经做了”。' },
          ],
          tasks: [
            { text: '按一下 **SYNTH 2 旋钮**（合成器区上排右边那个）。', panel: ['SYNTH2'], detect: { kind: 'track', track: 'SYNTH2' }, wait: '点一下 SYNTH 2 旋钮…', liveWait: '等你按 SYNTH 2 旋钮…' },
            { text: '先一个一个听：按一下 **Synth key 1**，再按 **3**，再按 **5**。（1 和 3 在上排，圆点键右边第 1、第 3 个；5 在下排左数第 2 个。）', panel: ['SK1', 'SK3', 'SK5'], detect: { kind: 'note', track: 'SYNTH2', count: 3 }, wait: '按 Synth key 1、3、5', liveWait: '按 Synth key 1、3、5' },
            { text: '现在让它们叠起来：**一秒之内**把 1、3、5 连着点一遍。', liveText: '现在**三个一起按下去**，按住别急着松：1、3、5。这就是你叠出来的第一个和弦。', panel: ['SK1', 'SK3', 'SK5'], sim: { kind: 'chord', track: 'SYNTH2', min: 3 }, wait: '一秒之内连点 1、3、5…', liveWait: '三个键一起按下去…' },
            { text: '换一组，从第 3 个键出发：**3、5、7** 叠在一起（7 在下排最右）。听，颜色变了。', liveText: '换一组，从第 3 个键出发：**3、5、7** 三个一起按（7 在下排最右）。听，颜色变了。', panel: ['SK3', 'SK5', 'SK7'], sim: { kind: 'chord', track: 'SYNTH2', min: 3 }, wait: '一秒之内连点 3、5、7…', liveWait: '三个键一起按下去…' },
          ],
          done: '1-3-5 偏暗，3-5-7 偏亮。同样是“隔一个拿一个”，从不同的键出发，颜色不一样。',
          coach: '学生第一次在机器上叠和弦：选中 SYNTH 2（合成器区上排右边的旋钮），先分别按 Synth key 1、3、5，再三个一起按（C 小调里是 C、D#、G，一个 C 小和弦），再按 3、5、7（D#、G、A#，一个大和弦）。SYNTH 2 在空白工程里是复音（POLY）音色，所以能同时出几个音；如果只响一个音，说明它是单音（MONO）弹法，要把右边那列从上往下第 2 个旋钮转到 POLY。模拟机上不能同时按几个键，改成一秒内连点。',
        },
        {
          type: 'read',
          title: '暗的，和亮的',
          blocks: [
            '刚才那两组听起来不一样，差别只在**中间那个音**：它离根音近一点，和弦就偏**暗**；远一点，就偏**亮**。',
            { widget: 'ab', bpm: 76, title: '只动了中间那一个音', a: { label: '暗：C 小和弦（Cm）', voice: 'keys', notes: [...tri(0, 1, 7, { scale: 0 }), ...tri(8, 1, 7, { scale: 0 })] }, b: { label: '亮：C 大和弦（C）', voice: 'keys', notes: [...tri(0, 1, 7, { scale: 1 }), ...tri(8, 1, 7, { scale: 1 })] } },
            { list: [
              '**小和弦**（minor）：偏暗、带点忧郁。名字后面带个小写的 **m**，比如 **Cm**。',
              '**大和弦**（major）：偏亮、开朗。名字就是根音本身，比如 **D#**。',
            ] },
            { callout: 'dj', text: '混音软件里调名后面那个 **m**（Am、Cm）或者 Camelot 记法里的 **A**，说的就是“这首歌整体是小调、偏暗”；不带 m 的（或者 **B**）是大调、偏亮。你早就在用“暗 / 亮”给歌分类了，现在知道它是从哪儿来的。' },
            '名字不用背。记住听感，和一件事：**在同一个调里，7 个键各自“隔一个拿一个”，叠出来的 7 个和弦有的暗、有的亮。** 一首歌的情绪起伏，就是在这几个和弦之间来回走出来的。',
            '下一课，机器会把这 7 个和弦直接放到 7 个键上：一个键，一个和弦。',
          ],
        },
        {
          type: 'quiz',
          title: '用耳朵回答',
          questions: [
            {
              q: '先听 A，再听 B。哪一个是和弦（几个音同时响）？',
              play: [{ label: 'A', bpm: 84, voice: 'keys', notes: [[0, 'C3', 7], [8, 'G3', 7]], seconds: 3.2 }, { label: 'B', bpm: 84, voice: 'keys', notes: [...tri(0, 1, 7), ...tri(8, 1, 7)], seconds: 3.2 }],
              options: ['A', 'B', '都是'],
              answer: 1,
              explain: 'A 是一前一后两个单独的音；B 是三个音同时按下去，听到的是一整块。',
              wrong: { 2: 'A 里的两个音是先后出来的，不是一起响的。' },
            },
            {
              q: '在机器上想叠一个和弦，从 Synth key 1 出发，应该按哪三个键？',
              options: ['1、2、3', '1、3、5', '1、4、7'],
              answer: 1,
              explain: '隔一个拿一个：拿 1，跳过 2，拿 3，跳过 4，拿 5。',
              wrong: { 0: '挨着的三个键挤在一起，听起来是糊的。要**隔一个**拿一个。', 2: '隔得太开了。规则是隔**一个**。' },
            },
            {
              q: '再听两个和弦。哪一个更暗？',
              play: [{ label: 'A', bpm: 76, voice: 'keys', notes: tri(0, 1, 12), seconds: 3 }, { label: 'B', bpm: 76, voice: 'keys', notes: tri(0, 3, 12), seconds: 3 }],
              options: ['A 更暗', 'B 更暗'],
              answer: 0,
              explain: 'A 是从键 1 叠出来的小和弦（Cm），偏暗；B 是从键 3 叠出来的大和弦（D#），偏亮。就是你刚才在机器上按的那两组。',
            },
          ],
        },
      ],
    },

    // ───────────────────────── 3.2 ─────────────────────────
    {
      id: '3-2',
      simProject: 3,
      no: '3.2',
      title: '一个键，一个和弦',
      minutes: 35,
      summary: '机器的 CHORD 弹法；把 SYNTH 2 和 DX 调成两位和弦手；两局和弦音游。',
      takeaway: '合成器轨有三种弹法：**MONO** 一次一个音、**POLY** 可以同时好几个、**CHORD** 一个键就是一整个和弦。切换：选中轨道后，转右边桔红色区域那列旋钮里**从上往下数第 2 个**，看那列文字里 “CHORD” 亮。这个开关**存在音色里**——**先挑音色，再切 CHORD**；换了音色要重新切。',
      homework: '去「练习场」的“和弦”那一组，把「两个和弦来回」刷到三星。',
      steps: [
        {
          type: 'read',
          title: '三位合成器手，三种弹法',
          blocks: [
            '中间合成器区的 4 个旋钮：上排 **SYNTH 1**、**SYNTH 2**，下排 **DX**、**SAMPLER**。前三位都是合成器手，到现在你只用过 SYNTH 1（弹贝斯）。',
            { panel: ['SYNTH1', 'SYNTH2', 'DX'], caption: '这一章的分工：SYNTH 1 继续弹贝斯；SYNTH 2 弹和弦；DX 是用另一种方式发声的合成器（电钢琴、铃声那种带点金属味的声音），也拿来弹和弦。' },
            '同时按三个键很累，而且 7 个键里有的组合好听、有的不好听。机器替你想好了：每条合成器轨有三种**弹法**——',
            { list: [
              '**MONO**（单音）：一次只出一个音，按下一个，上一个就断。贝斯和主旋律用它。',
              '**POLY**（复音）：可以同时出好几个音。上一课你三个键一起按，用的就是它。',
              '**CHORD**（和弦）：**一个键就是一整个和弦**。机器已经在 7 个键上各放好了一个。',
            ] },
            '切换它用的是右边桔红色区域那一列 4 个旋钮里**从上往下数第 2 个**（最上面印着 SOUND 的那个是第 1 个）。转的时候看两个地方：',
            { panel: ['SD2', 'INDEX', 'METER'], lit: { 'INDEX.CHORD': 'white', 'METER.6': 'cyan' }, caption: '左边那列会亮的文字里，“MONO/POLY” 或 “CHORD” 会亮；那列 8 个小灯最上面的三个，从上到下依次是 MONO、POLY、CHORD。图上是切到 CHORD 时的样子。' },
            { callout: 'warn', title: '这个开关住在音色里', text: '每个音色自带一种弹法（贝斯音色多半是单音）。**换了音色，弹法就跟着变成新音色自己的**——刚切好的 CHORD 会被冲掉。所以顺序永远是：**先挑音色，再切 CHORD**。机器里有些音色的名字带着 [Chord]，一选上就已经是和弦弹法；接着真机时，屏幕上会显示音色的名字。' },
          ],
        },
        {
          type: 'do',
          title: '把 SYNTH 2 调成和弦手',
          blocks: [
            '先给它换一个钢琴类的音色（和弦用钢琴最容易听清），再切到 CHORD。',
            { callout: 'tip', text: '模拟机上：**长按**一个键半秒，出现黑圈就是“按住了”，再点第二个键。旋钮用鼠标**上下拖**（或滚轮）来转。' },
          ],
          liveBlocks: [
            '先给它换一个钢琴类的音色（和弦用钢琴最容易听清），再切到 CHORD。真机没有屏幕，下面这两个读数就是它的屏幕：',
            { device: ['sound:SYNTH2', 'poly:SYNTH2'] },
            { callout: 'tip', text: '旋钮 2 往哪边转是 CHORD，手册没有写。**慢慢转**，每转一点看一眼读数（或者真机上那列小灯）：转过头了就往回转。' },
            { callout: 'warn', text: '转旋钮 2 的时候，如果那列文字里亮的不是 “MONO/POLY” 或 “CHORD”，而是别的字（比如 DECAY），说明这 4 个旋钮被翻到了别的页。按一下 **Sound Design Page** 键翻回第 1 页：它在这一列旋钮的正下方、靠近你这一边的边沿上，印着一排三个小点。' },
            { action: 'polymode', track: 'SYNTH2', mode: 2, label: '转不到？让应用直接把 SYNTH 2 切到 CHORD' },
          ],
          tasks: [
            { text: '按一下 **SYNTH 2 旋钮**（合成器区上排右边）。', panel: ['SYNTH2'], detect: { kind: 'track', track: 'SYNTH2' }, wait: '点一下 SYNTH 2 旋钮…', liveWait: '等你按 SYNTH 2 旋钮…' },
            { text: '换成钢琴：**先按住**右边桔红色区域最上面那个旋钮（下面印着 SOUND）**不放，再按一下**左边上排**第 3 个**方键，然后都松开。这是直接跳到 PIANO 这一类音色。', panel: ['SD1', 'DK3'], detect: { kind: 'sound', track: 'SYNTH2' }, wait: '长按 SOUND 旋钮出现黑圈，再点上排第 3 个方键…', liveWait: '按住 SOUND 旋钮不放，再按上排第 3 个方键…' },
            { text: '**慢慢转**那一列里**从上往下数第 2 个**旋钮，转到那列文字里 **“CHORD”** 亮起来。', panel: ['SD2', 'INDEX', 'METER'], detect: { kind: 'polymode', track: 'SYNTH2', mode: 2 }, wait: '往上拖第 2 个旋钮，直到 CHORD 亮…', liveWait: '慢慢转第 2 个旋钮，直到读数变成 CHORD…' },
            { text: '把 7 个 **Synth keys** 从 1 到 7 挨个按一遍：每个键都是一整个和弦。', panel: ['SYNTHKEYS'], detect: { kind: 'note', track: 'SYNTH2', count: 7 }, wait: '按 Synth keys', liveWait: '按 Synth keys' },
          ],
          done: '一根手指，一个和弦。SYNTH 2 现在是你的和弦手了。',
          coach: '学生在把 SYNTH 2 调成 CHORD 弹法。步骤：按 SYNTH 2 旋钮选中；按住 Sound Design 旋钮 1（右边桔红区最上面、印着 SOUND）再按 Drum key 3 跳到 PIANO 类音色；慢慢转 Sound Design 旋钮 2（那一列从上往下第 2 个）直到 Index 上 CHORD 亮、Global Meter 从上往下第 3 个灯亮；然后按 7 个 Synth keys。要点：弹法（MONO/POLY/CHORD）存在音色里，必须先换音色再切 CHORD；旋钮转的方向手册没写，让他看读数；如果 Index 亮的是别的词，说明 Sound Design 不在第 1 页，按 Sound Design Page 键（那列旋钮正下方的边沿上，印着三个小点）。',
        },
        {
          type: 'read',
          title: '7 个键上放的是什么',
          blocks: [
            '机器放在 7 个键上的，就是上一课说的那 7 个“隔一个拿一个”的和弦——从第几个键出发，就放在第几个键上。在 C 小调里：',
            { widget: 'chordkeys' },
            { list: [
              '**键 1（Cm）**：这个调的“家”。暗。一段音乐从它出发、回到它，听起来就是“落地了”。',
              '**键 3、6、7（D#、G#、A#）**：三个亮的。走到它们上面，像天突然开了。',
              '**键 4、5（Fm、Gm）**：另外两个暗的，常用来“离开家”和“准备回家”。',
              '**键 2**：最别扭的一个，听着发紧。先不管它。',
            ] },
            { callout: 'theory', text: '你会发现机器上每个键响的是 **4 个音**，比上一课多一个：它在三个音上面又“隔一个拿了一个”。多出来的这一层让和弦更厚、更润一些；点小部件里的“只听下面 3 个音”可以对比。底下那三个音决定它是暗是亮，这一点没变。' },
            { callout: 'tip', text: '这 7 个和弦是跟着 [SCALE] 和 [KEY] 走的：换了音阶或调，7 个键上的和弦会跟着换。这一章统一用 **C 小调**（和第 2 章一样）。和弦里具体有哪几个音也可以自己改，那是以后的事。' },
          ],
        },
        {
          type: 'game',
          title: '两个和弦来回',
          chart: 'chord-two',
          blocks: [
            '两个键：**1**（Cm，暗）和 **6**（G#，亮），每两拍换一个。贝斯由应用替你弹着：它弹 C 的时候你按 1，它换到 G# 的时候你按 6。',
            { callout: 'tip', text: '和弦要**按住**：按下去之后一直按到下一个和弦之前再松手，让它把那两拍铺满。屏幕上两条轨道从左到右就是键 1、键 6。' },
          ],
          coach: '第一局和弦音游：C 小调，SYNTH 2 在 CHORD 弹法，Synth key 1（Cm）和 6（G#）每两拍换一次，贝斯伴奏弹对应的根音。真机上开打之前的卡片会检查：选中 SYNTH 2、打鼓模式关着、音阶和调是小调 / C、SYNTH 2 在 CHORD 上（不是的话卡片上有按钮可以替他切）。',
        },
        {
          type: 'game',
          title: '反拍和弦',
          chart: 'chord-stab',
          blocks: [
            '和弦不一定要铺满。这一局只用**键 1**，但落在两拍**之间**，短促地“戳”一下就松手——House 里那种一跳一跳的和弦就是这么来的。',
            '位置和你在 1.4 打的反拍镲、2.2 弹的反拍贝斯一模一样：底鼓落在数字上，你落在 & 上。',
          ],
          coach: '反拍和弦（stab）：只用 Synth key 1 的和弦，落在每拍的 & 上（第 3、7、11、15 步），短促。四踩底鼓伴奏。和 1.4 的反拍镲、2.2 的反拍贝斯是同一个位置。',
        },
        {
          type: 'do',
          title: '让 DX 也来',
          blocks: [
            '再把 **DX** 也调成和弦手，动作和刚才一样，正好再练一遍。DX 的旋钮在合成器区**下排左边**（SYNTH 1 的正下方）。',
          ],
          liveBlocks: [
            '再把 **DX** 也调成和弦手，动作和刚才一样，正好再练一遍。DX 的旋钮在合成器区**下排左边**（SYNTH 1 的正下方）。',
            { device: ['sound:DX', 'poly:DX'] },
            { action: 'polymode', track: 'DX', mode: 2, label: '转不到？让应用直接把 DX 切到 CHORD' },
          ],
          tasks: [
            { text: '按一下 **DX 旋钮**（合成器区下排左边）。', panel: ['DX'], detect: { kind: 'track', track: 'DX' }, wait: '点一下 DX 旋钮…', liveWait: '等你按 DX 旋钮…' },
            { text: '换成电钢琴：**先按住** SOUND 旋钮**不放，再按一下**左边上排**第 4 个**方键（KEYBOARD 这一类）。', panel: ['SD1', 'DK4'], detect: { kind: 'sound', track: 'DX' }, wait: '长按 SOUND 旋钮，再点上排第 4 个方键…', liveWait: '按住 SOUND 旋钮不放，再按上排第 4 个方键…' },
            { text: '**慢慢转**从上往下数第 2 个旋钮，转到 **“CHORD”** 亮。', panel: ['SD2', 'INDEX', 'METER'], detect: { kind: 'polymode', track: 'DX', mode: 2 }, wait: '往上拖第 2 个旋钮，直到 CHORD 亮…', liveWait: '慢慢转第 2 个旋钮，直到读数变成 CHORD…' },
            { text: '按几个 Synth keys 听听，和 SYNTH 2 的钢琴比一比。', panel: ['SYNTHKEYS'], detect: { kind: 'note', track: 'DX', count: 3 }, wait: '按 Synth keys', liveWait: '按 Synth keys' },
          ],
          done: '两位和弦手就位：SYNTH 2 是钢琴，DX 是电钢琴。下一课先用 SYNTH 2。',
          coach: '学生在把 DX 轨也调成 CHORD：按 DX 旋钮（合成器区下排左边）；按住 Sound Design 旋钮 1 再按 Drum key 4 跳到 KEYBOARD 类；慢慢转 Sound Design 旋钮 2 到 CHORD；按几个 Synth keys。这是上一步的重复练习，目的是把“先换音色、再切 CHORD”这个顺序练熟。',
        },
        {
          type: 'quiz',
          title: '三个小问题',
          questions: [
            {
              q: 'SYNTH 2 在 CHORD 弹法上。这时按一下 Synth key 6，出来的是——',
              options: ['一个音', '一整个和弦（好几个音一起）', '一声鼓'],
              answer: 1,
              explain: 'CHORD 弹法下，一个键就是一整个和弦。键 6 在 C 小调里是 G# 和弦，亮的那种。',
              wrong: { 0: '那是 MONO 或 POLY 弹法。', 2: '那是“打鼓模式”，另一回事。' },
            },
            {
              q: '你刚把 SYNTH 2 切到 CHORD，又换了一个音色，结果一个键只出一个音了。为什么？',
              options: ['机器坏了', '弹法是存在音色里的：换了音色，它跟着变成了新音色自己的设定', '音量太小'],
              answer: 1,
              explain: '所以顺序是“先挑音色，再切 CHORD”。被冲掉了也不要紧：再转一次那个旋钮。',
            },
            {
              q: '切 MONO / POLY / CHORD，转的是哪个旋钮？',
              options: ['SYNTH 2 的轨道旋钮', '右边桔红色区域那一列里，从上往下数第 2 个', '左上角的 ALL 旋钮'],
              answer: 1,
              explain: '最上面印着 SOUND 的是第 1 个（换音色），它下面那个就是。',
              wrong: { 0: '转轨道旋钮是给那条轨道**换一段乐句**，原来的内容会“看起来不见了”。' },
            },
          ],
        },
      ],
    },

    // ───────────────────────── 3.3 ─────────────────────────
    {
      id: '3-3',
      simProject: 3,
      no: '3.3',
      title: '给贝斯盖上屋顶',
      minutes: 40,
      summary: '和弦跟着贝斯的根音走；把和弦填进格子、把它拉长；用独奏和静音一层一层听。',
      takeaway: '最简单的和声规则：**贝斯弹第几个键，和弦就按第几个键**。把和弦放进格子和放贝斯一样——进入步进输入，先按一下 Synth key，再按亮步进键，放进去的是“最后按过的那个和弦”。想让它铺满：**按住亮着的步进键不放，同时转左上角的 [ALL] 旋钮**，把这一步的音拉长。',
      steps: [
        {
          type: 'read',
          title: '屋顶跟着地基走',
          blocks: [
            '第 2 章最后，你让贝斯每隔两拍换一个根音，音乐就开始“往前走”了。现在在每个根音上面盖一个和弦——这层屋顶一盖上，“走”就变成了“有心情地走”。这叫**和声进行**。',
            '规则简单到只有一句：**贝斯弹第几个键，和弦就按第几个键。** 贝斯在键 1（C），和弦按键 1；贝斯走到键 6（G#），和弦也换到键 6。',
            '听一下。先把“和弦”的勾去掉，只听贝斯；再勾上：',
            { widget: 'chordprog', bpm: 96, progressions: [{ label: '1 → 6', keys: [1, 6], say: '键 1（暗）两拍，键 6（亮）两拍。暗 → 亮 → 暗 → 亮，像一呼一吸。' }], title: '同一条贝斯，盖上屋顶之前和之后' },
            { callout: 'dj', text: '一首歌从主歌进副歌，“一下子打开了”的那种感觉，鼓和贝斯常常没怎么变，变的是上面这层和弦。你打碟时凭感觉抓的“这里要起来了”，很多时候抓的就是它。' },
            '这一课在机器里做这一小节：前两拍键 1，后两拍键 6。先改贝斯，再放和弦。',
          ],
        },
        {
          type: 'do',
          title: '先让贝斯走起来',
          blocks: [
            '把 SYNTH 1 的贝斯改成：**第 1、5 步弹键 1，第 9、13 步弹键 6**。填合成器轨的格子要在“步进输入”里做（2.2 学过）：放进格子的，是你**最后按过的那个音**。',
            { callout: 'tip', text: '模拟机上进入步进输入：**长按** [PAGE] 出现黑圈，再点 SYNTH 1 旋钮。' },
          ],
          liveBlocks: [
            '把 SYNTH 1 的贝斯改成：**第 1、5 步弹键 1，第 9、13 步弹键 6**。填合成器轨的格子要在“步进输入”里做（2.2 学过）：放进格子的，是你**最后按过的那个音**。',
            { callout: 'warn', title: '应用看不见合成器轨的格子', text: '鼓轨的格子机器会报给应用，合成器轨的不会。所以这几项不会自动打勾：照着做，做完点右边的“做好了”。' },
            { callout: 'tip', title: '怎么知道在不在步进输入里', text: '按一下 SYNTH 1 旋钮之后看步进键：2.2 填的第 1、5、9、13 个亮着**青蓝色**，就是在步进输入里。拿不准就按一下第 2 个步进键：它亮起青蓝色，说明在（再按一下把它按灭）；没反应，就是不在。关过机的话，一定不在。' },
            { callout: 'warn', text: '换一步里的音，用老办法：**按灭 → 按一下新的 Synth key → 再按亮**。' },
          ],
          tasks: [
            { text: '按一下 **SYNTH 1 旋钮**。', panel: ['SYNTH1'], detect: { kind: 'track', track: 'SYNTH1' }, wait: '点一下 SYNTH 1 旋钮…', liveWait: '等你按 SYNTH 1 旋钮…' },
            { text: '进入步进输入：**先按住**左侧面的 [PAGE]（从上往下数第 6 个）**不放，再按一下 SYNTH 1 旋钮**。', liveText: '不在步进输入里的话，进去：**先按住**左侧面的 [PAGE]（从上往下数第 6 个，[PLAY] 上面那个）**不放，再按一下 SYNTH 1 旋钮**，然后都松开。已经在里面就不用做。', panel: ['PAGE', 'SYNTH1'], sim: { kind: 'mode', mode: 'stepinput', track: 'SYNTH1', on: true }, wait: '长按 [PAGE] 出现黑圈，再点 SYNTH 1 旋钮…' },
            { text: '按一下 **Synth key 1**，然后让第 **1、5** 个步进键亮着（没亮就按亮）。', panel: ['SK1', 'DK1', 'DK5'], sim: { kind: 'stepkeys', track: 'SYNTH1', keys: { 0: 1, 4: 1 } }, wait: '点 Synth key 1，再按亮第 1、5 个步进键…' },
            { text: '第 **9、13** 个要换成键 6：它们亮着的话先各按一下**按灭**；按一下 **Synth key 6**（下排左数第 3 个）；再把第 9、13 个**按亮**（下排第 1、第 5 个）。', panel: ['SK6', 'DK9', 'DK13'], sim: { kind: 'stepkeys', track: 'SYNTH1', keys: { 0: 1, 4: 1, 8: 6, 12: 6 }, exact: true }, wait: '点 Synth key 6，再按亮第 9、13 个步进键…' },
            { text: '短按 [PLAY] 听：贝斯前两拍在原地，后两拍沉下去了。', panel: ['PLAY'], detect: { kind: 'start' }, wait: '点 [PLAY]…', liveWait: '等你按 [PLAY]…' },
            { text: '再按 [PLAY] 停下。', panel: ['PLAY'], detect: { kind: 'stop' }, wait: '再点 [PLAY]…', liveWait: '等你停止…' },
          ],
          done: '地基打好了：C、C、G#、G#。',
          coach: '学生在把 SYNTH 1 的贝斯改成一小节两个根音：第 1、5 步是 Synth key 1（C），第 9、13 步是 Synth key 6（G#）。在步进输入模式里做（按住 [PAGE] + 按 SYNTH 1 旋钮进入）。换一步里的音的办法：把那一步按灭，按一下新的 Synth key，再按亮。真机上合成器轨的格子应用读不出来，所以这几项要学生自己点“做好了”；他拿不准自己在不在步进输入里时，让他按一个空的步进键看会不会亮青蓝色。',
        },
        {
          type: 'do',
          title: '把和弦放进格子',
          blocks: [
            '轮到 SYNTH 2。它在 CHORD 弹法上的时候，放进格子的就是**一整个和弦**——你最后按过的那一个。',
            { callout: 'tip', text: '模拟机每次打开页面都是新的：如果 SYNTH 2 不在 CHORD 上，把从上往下数第 2 个旋钮**往上拖**，拖到 “CHORD” 亮。' },
          ],
          liveBlocks: [
            '轮到 SYNTH 2。它在 CHORD 弹法上的时候，放进格子的就是**一整个和弦**——你最后按过的那一个。',
            { device: ['sound:SYNTH2', 'poly:SYNTH2'] },
            { callout: 'tip', text: '读数不是 CHORD？说明上一课之后换过音色，或者还没切过：慢慢转右边那一列从上往下数第 2 个旋钮，转到 CHORD。' },
            { action: 'polymode', track: 'SYNTH2', mode: 2, label: '让应用直接把 SYNTH 2 切到 CHORD' },
          ],
          tasks: [
            { text: '按一下 **SYNTH 2 旋钮**（合成器区上排右边）。', panel: ['SYNTH2'], detect: { kind: 'track', track: 'SYNTH2' }, wait: '点一下 SYNTH 2 旋钮…', liveWait: '等你按 SYNTH 2 旋钮…' },
            { text: '确认它在 **CHORD** 上（不是的话，转从上往下数第 2 个旋钮）。', panel: ['SD2', 'INDEX'], detect: { kind: 'polymode', track: 'SYNTH2', mode: 2 }, wait: '把第 2 个旋钮往上拖到 CHORD…', liveWait: '等读数变成 CHORD…' },
            { text: '进入步进输入：**先按住** [PAGE] **不放，再按一下 SYNTH 2 旋钮**，然后都松开。', panel: ['PAGE', 'SYNTH2'], sim: { kind: 'mode', mode: 'stepinput', track: 'SYNTH2', on: true }, wait: '长按 [PAGE] 出现黑圈，再点 SYNTH 2 旋钮…' },
            { text: '按一下 **Synth key 1**（告诉机器“接下来放这个和弦”），再按亮**第 1 个**步进键。', panel: ['SK1', 'DK1'], sim: { kind: 'stepkeys', track: 'SYNTH2', keys: { 0: 1 } }, wait: '点 Synth key 1，再按亮第 1 个步进键…' },
            { text: '按一下 **Synth key 6**，再按亮**第 9 个**步进键（下排最左）。', panel: ['SK6', 'DK9'], sim: { kind: 'stepkeys', track: 'SYNTH2', keys: { 0: 1, 8: 6 }, exact: true }, wait: '点 Synth key 6，再按亮第 9 个步进键…' },
            { text: '短按 [PLAY] 听一圈，再按一次停下。', panel: ['PLAY'], detect: { kind: 'stop' }, wait: '点 [PLAY] 听，再点一次停…', liveWait: '听一圈，然后按 [PLAY] 停下…' },
          ],
          done: '和弦进去了，但只“戳”了一下就没了：机器默认每个音只占一格。下一步把它拉长。',
          coach: '学生在 SYNTH 2（CHORD 弹法）上用步进输入放两个和弦：第 1 步放 Synth key 1 的和弦，第 9 步放 Synth key 6 的和弦。步骤：选中 SYNTH 2，确认是 CHORD，按住 [PAGE] + 按 SYNTH 2 旋钮进入步进输入，按一下 Synth key 再按亮步进键（放进去的是最后按过的那个和弦）。真机上这些格子应用读不出来，学生自己点“做好了”；“确认 CHORD”那一项应用读得出来。',
        },
        {
          type: 'do',
          title: '把它拉长',
          blocks: [
            '想让和弦把两拍铺满，要改这一步的**音长**：**按住**那个亮着的步进键不放，同时**转左上角的 [ALL] 旋钮**。',
            { callout: 'tip', text: '模拟机上：**长按**亮着的第 1 个步进键，出现黑圈后，把左上角的 ALL 旋钮**往上拖**（或用滚轮）；亮着的一串步进键就是这个音占的长度。调好了再点一下那个步进键松开。' },
          ],
          liveBlocks: [
            '想让和弦把两拍铺满，要改这一步的**音长**：**按住**那个亮着的步进键不放，同时**转 [ALL] 旋钮**。[ALL] 是鼓区**左上角第一个**旋钮（KICK 的左边）。两只手：一只手按住步进键，另一只手转。',
            { callout: 'warn', text: '转的是 **ALL**，不是 SYNTH 2 自己的旋钮——转轨道旋钮是换一段乐句（转错了屏幕上会提示，往回转就行）。' },
            { callout: 'tip', text: '机器会用步进键和右边那列小灯显示这个音现在有多长。转多少算两拍，凭耳朵：转一点，松手，按 [PLAY] 听；想让它一直响到下一个和弦进来之前。' },
            { callout: 'warn', text: '如果松手之后那一步**灭了**：刚才没来得及转，机器当成“按了一下”，把它关掉了。按一下 Synth key 1，把它重新按亮，再来。' },
          ],
          tasks: [
            { text: '**按住第 1 个步进键不放**，同时转 [ALL] 旋钮，把键 1 的和弦拉长到大约两拍（8 格）。', panel: ['DK1', 'ALL'], sim: { kind: 'notelen', track: 'SYNTH2', step: 0, min: 6 }, wait: '长按第 1 个步进键，再把 ALL 旋钮往上拖…' },
            { text: '同样的办法，**按住第 9 个步进键**，把键 6 的和弦也拉长。', panel: ['DK9', 'ALL'], sim: { kind: 'notelen', track: 'SYNTH2', step: 8, min: 6 }, wait: '长按第 9 个步进键，再把 ALL 旋钮往上拖…' },
            { text: '短按 [PLAY]：贝斯在下面走，和弦在上面铺着。', panel: ['PLAY'], detect: { kind: 'start' }, wait: '点 [PLAY]…', liveWait: '等你按 [PLAY]…' },
            { text: '听够了按 [PLAY] 停下。', panel: ['PLAY'], detect: { kind: 'stop' }, wait: '再点 [PLAY]…', liveWait: '等你停止…' },
          ],
          done: '短的是“戳”，长的是“铺”。同一个和弦，长短不同，作用完全不一样。',
          coach: '学生在改步进里音符的长度：步进输入模式下，按住一个已经亮着的步进键不放，同时转 [ALL] 旋钮（鼓区左上角第一个旋钮）。长度会显示在步进键和 Global Meter 上（具体怎么显示手册没有细说，让他凭耳朵听）。常见问题：转成了 SYNTH 2 自己的旋钮（那是换乐句，往回转）；按住之后没转就松手，那一步被关掉了（重新按一下 Synth key，再按亮）。真机上音长应用读不出来，学生自己点“做好了”。',
        },
        {
          type: 'program',
          title: '挑战：两个和弦',
          target: { SYNTH2: 'x-------x-------' },
          tracks: ['SYNTH2'],
          keys: { SYNTH2: { 0: 1, 8: 6 } },
          litColor: 'cyan',
          bpm: 96,
          listen: { tracks: { KICK: FOUR, SNARE: BACK }, notes: [...bass([[0, 'C1'], [4, 'C1'], [8, 'G#0'], [12, 'G#0']]), ...chordAt(0, 1, 7), ...chordAt(8, 6, 7)] },
          legend: 'SYNTH 2 在步进输入里（按住 [PAGE] + 按 SYNTH 2 旋钮进入）：第 1 步放键 1 的和弦，第 9 步放键 6 的和弦。',
          blocks: ['让应用核对 SYNTH 2：第 1 步和第 9 步各有一个和弦。位置对了就过关；放的是不是键 1 和键 6，应用也会顺便看一眼。'],
          done: '位置和和弦都对：键 1 两拍，键 6 两拍。',
        },
        {
          type: 'do',
          title: '一层一层听',
          blocks: [
            '现在机器里有三层：鼓、贝斯、和弦。用第 1 章学的**独奏**和**静音**把它们拆开听——这也是以后编曲和现场最常用的手法。',
            { callout: 'dj', text: '这就是你在调音台上做的事：把低频拧掉只留上面，再“啪”地推回来。只不过现在每一层是分开的，你可以整层拿走。' },
          ],
          tasks: [
            { text: '短按 [PLAY]，让它循环着。', panel: ['PLAY'], detect: { kind: 'start' }, wait: '点 [PLAY]…', liveWait: '等你按 [PLAY]…' },
            { text: '**先按住**左侧面的 [SOLO]（从上往下数第 5 个）**不放，再按一下 SYNTH 2 旋钮**：只剩和弦。', panel: ['SOLO', 'SYNTH2'], sim: { kind: 'solo', track: 'SYNTH2' }, wait: '长按 [SOLO]，再点 SYNTH 2 旋钮…', liveWait: '按住 [SOLO]，再按 SYNTH 2 旋钮…' },
            { text: '同样的动作再做一次，取消独奏：大家都回来。', panel: ['SOLO', 'SYNTH2'], sim: { kind: 'solo' }, wait: '再来一次…', liveWait: '再做一次，取消独奏…' },
            { text: '**先按住** [MUTE]（从上往下数第 4 个）**不放，再按一下 SYNTH 1 旋钮**：贝斯没了。和弦还在，但是不是一下子“飘”起来了？', panel: ['MUTE', 'SYNTH1'], sim: { kind: 'mute', track: 'SYNTH1', on: true }, wait: '长按 [MUTE]，再点 SYNTH 1 旋钮…', liveWait: '按住 [MUTE]，再按 SYNTH 1 旋钮…' },
            { text: '再做一次，让贝斯回来，然后按 [PLAY] 停下。', panel: ['MUTE', 'SYNTH1', 'PLAY'], sim: { kind: 'mute', track: 'SYNTH1', on: false }, wait: '再长按 [MUTE] 点 SYNTH 1 旋钮…', liveWait: '再做一次，让贝斯回来…' },
          ],
          done: '贝斯是地基，和弦是屋顶：拿掉哪一层，房子都不完整。',
        },
      ],
    },

    // ───────────────────────── 3.4 ─────────────────────────
    {
      id: '3-4',
      simProject: 3,
      no: '3.4',
      title: '四个和弦，和你的第一批歌',
      minutes: 45,
      summary: '把乐句加长到两小节，装下四个和弦；用两首你听过的歌（Gangsta\'s Paradise、Starboy）的和弦进行练手；写一个你自己的和声循环。',
      takeaway: '大量的歌，从头到尾就是**四个和弦转圈**。一小节装不下，就按 [BAR LENGTH] 把乐句**加长到两小节**，再按 [PAGE] **翻页**去填第 2 小节。CHORD 弹法下换一步里的和弦：**按住那个步进键不放，再按新的 Synth key**。贝斯永远跟着和弦走同一个键。',
      homework: '去「曲目」页把想学的歌定下来；再去「练习场」的“歌里的和弦”那一组，把三首都打一遍。',
      steps: [
        {
          type: 'read',
          title: '四个和弦转圈',
          blocks: [
            '还记得第 2 章最后那条贝斯吗？两小节，四个根音：**1 → 6 → 3 → 7**。当时说过，上面各盖一个和弦，就是无数歌曲在用的那一套。现在可以盖了：',
            { widget: 'chordprog', bpm: 100, title: '同样 7 个和弦，换个顺序就是另一种心情', progressions: [
              { label: '1 → 6 → 3 → 7', keys: [1, 6, 3, 7], say: '暗 → 亮 → 亮 → 亮：从低处一步步走到开阔的地方，再落回来。流行、电子舞曲里最常听到的一种——Faded、Wake Me Up 用的就是它。' },
              { label: '1 → 7 → 6 → 7', keys: [1, 7, 6, 7], say: '在暗的“家”和两个亮的邻居之间来回，一直往前推。80 年代合成器音乐的味道——Starboy 就是这四个，一小节一个。' },
              { label: '1 → 4 → 5 → 1', keys: [1, 4, 5, 1], say: '三个都是暗的：出门、绕远、回家。一直压着不放晴。' },
              { label: '6 → 7 → 1 → 1', keys: [6, 7, 1, 1], say: '从亮的地方一级一级走上来，最后落在暗的“家”上：很多舞曲高潮前的铺垫就是这样走的。' },
            ] },
            '四个预设都点一遍。和弦还是那 7 个，鼓和速度也没变，变的只有**顺序**。',
            { callout: 'dj', text: '你有没有发现有些歌特别好接？很多时候是因为它们用的是同一套和弦转圈，只是速度和音色不同。' },
            '这一课把 **1 → 6 → 3 → 7** 完整地做进机器。一小节只装得下两个和弦（每两拍一个），所以要先学一件事：把乐句加长到两小节。',
          ],
        },
        {
          type: 'game',
          title: '四个和弦',
          chart: 'chord-four',
          stages: [{ assist: 'demo' }, { assist: 'guide', pass: 0.55 }, { assist: 'solo', pass: 0.55 }],
          blocks: [
            '先用手过一遍：**1、6、3、7**，每两拍换一个，两小节一圈。贝斯替你弹着根音，它换你就换。',
            { callout: 'tip', text: '四条轨道从左到右是键 1、3、6、7（从小到大排的），不是弹的先后顺序。眼睛提前看下一个落在哪条。' },
          ],
          coach: '四个和弦的循环：C 小调，Synth key 1、6、3、7 的和弦，每两拍一个，两小节一圈，贝斯伴奏弹根音。屏幕上轨道按键号从小到大排（1、3、6、7），和弹奏顺序不同，这是最容易乱的地方。',
        },
        {
          type: 'do',
          title: '把乐句加长到两小节',
          blocks: [
            '[BAR LENGTH] 在合成器区**上边沿**那 5 个键里的**最左边**。按它，当前选中的这条轨道的这段乐句就会变长：1、2、4、8 小节。加长的时候，机器会把第 1 小节的内容**照抄一份**到新的小节里。',
            '步进键一页只显示 16 步。乐句变成两小节之后，**单按一下** [PAGE] 就是翻页：第 1 页是第 1 小节，第 2 页是第 2 小节。',
            { callout: 'tip', text: '模拟机上 [BAR LENGTH] 和真机一样在 1、2、4、8 小节之间轮着换：按一下是 2 小节，多按了就接着按，转一圈回来。[PAGE] 在模拟机上**短按**是翻页，**长按**才是“按住”。' },
          ],
          liveBlocks: [
            '[BAR LENGTH] 在合成器区**上边沿**那 5 个键里的**最左边**。按它，当前选中的这条轨道的这段乐句就会变长：1、2、4、8 小节。加长的时候，机器会把第 1 小节的内容**照抄一份**到新的小节里。',
            { device: ['bars:SYNTH2'] },
            { callout: 'tip', text: '按一下具体怎么变，手册只说“在 1、2、4、8 小节之间换”。所以：**按一下，看读数**；不是 2 小节就再按。真机上右边那列小灯也会显示：亮到第几个，就是几小节。' },
            { action: 'bars', track: 'SYNTH2', bars: 2, label: '按不到 2 小节？让应用直接把 SYNTH 2 这段设成 2 小节' },
            '步进键一页只显示 16 步。乐句变成两小节之后，**单按一下** [PAGE]（只按一下，不要按住）就是翻页：第 1 页是第 1 小节，第 2 页是第 2 小节。翻到第几页，右边那列小灯会有一个青蓝色的灯在闪：最下面那个是第 1 页。',
            { callout: 'warn', text: '翻页、和后面换和弦的几项，应用看不见，做完自己点“做好了”。' },
          ],
          tasks: [
            { text: '按一下 **SYNTH 2 旋钮**。它应该还在步进输入里：第 1、9 个步进键亮着青蓝色。（没亮的话：按住 [PAGE] 不放，再按一下 SYNTH 2 旋钮。）', panel: ['SYNTH2'], detect: { kind: 'track', track: 'SYNTH2' }, sim: { kind: 'mode', mode: 'stepinput', track: 'SYNTH2', on: true }, wait: '点 SYNTH 2 旋钮；没在步进输入里就长按 [PAGE] 再点它…', liveWait: '等你按 SYNTH 2 旋钮…' },
            { text: '按 **[BAR LENGTH]**（合成器区上边沿最左边那个键），让这段乐句变成 **2 小节**。', panel: ['BARLENGTH', 'METER'], detect: { kind: 'length', track: 'SYNTH2', bars: 2 }, wait: '点一下 [BAR LENGTH]…', liveWait: '按 [BAR LENGTH]，直到读数是 2 小节…' },
            { text: '**单按一下** [PAGE]，翻到第 2 页。第 1、9 个步进键亮着：那是照抄过来的键 1 和键 6。', panel: ['PAGE'], sim: { kind: 'page', page: 1 }, wait: '短按一下 [PAGE]…' },
            { text: '把第 1 个换成键 3：**先按住第 1 个步进键不放，再按一下 Synth key 3**（上排最右），然后都松开。', panel: ['DK1', 'SK3'], sim: { kind: 'stepkeys', track: 'SYNTH2', keys: { 16: 3 } }, wait: '长按第 1 个步进键出现黑圈，再点 Synth key 3…' },
            { text: '把第 9 个换成键 7：**先按住第 9 个步进键不放，再按一下 Synth key 7**（下排最右）。', panel: ['DK9', 'SK7'], sim: { kind: 'stepkeys', track: 'SYNTH2', keys: { 0: 1, 8: 6, 16: 3, 24: 7 }, exact: true }, wait: '长按第 9 个步进键，再点 Synth key 7…' },
            { text: '再**单按一下** [PAGE] 翻回第 1 页。', panel: ['PAGE'], sim: { kind: 'page', page: 0 }, wait: '再短按一下 [PAGE]…' },
          ],
          done: 'SYNTH 2 现在是两小节：1、6、3、7。',
          coach: '学生在把 SYNTH 2 的乐句加长到两小节并填第 2 小节：按 [BAR LENGTH]（合成器区上缘最左边）到 2 小节（应用读得出长度）；单按 [PAGE] 翻到第 2 页；CHORD 弹法下“按住步进键 + 按 Synth key”把那一步整个换成新的和弦（手册 7.9：如果那一步本来就是这个和弦，会被清掉，再做一次即可）；再按 [PAGE] 翻回第 1 页。加长时机器会把第 1 小节抄到第 2 小节，所以第 2 页一开始亮着的是键 1 和键 6。翻页和换和弦应用读不出来，学生自己点“做好了”。',
        },
        {
          type: 'do',
          title: '贝斯也要两小节',
          blocks: [
            '屋顶换了，地基也得跟着换。SYNTH 1 做同样的事：加长到两小节，把第 2 小节的四个根音换成键 3、3、7、7。',
            { callout: 'warn', text: '贝斯这条轨道不是 CHORD 弹法，“按住步进键 + 按 Synth key”在它上面是往那一步里**再加一个音**，不是换。所以贝斯还是用老办法：**按灭 → 按一下新的 Synth key → 再按亮**。' },
          ],
          liveBlocks: [
            '屋顶换了，地基也得跟着换。SYNTH 1 做同样的事：加长到两小节，把第 2 小节的四个根音换成键 3、3、7、7。',
            { device: ['bars:SYNTH1'] },
            { action: 'bars', track: 'SYNTH1', bars: 2, label: '让应用直接把 SYNTH 1 这段设成 2 小节' },
            { callout: 'warn', text: '贝斯这条轨道不是 CHORD 弹法，“按住步进键 + 按 Synth key”在它上面是往那一步里**再加一个音**，不是换。所以贝斯还是用老办法：**按灭 → 按一下新的 Synth key → 再按亮**。' },
          ],
          tasks: [
            { text: '按一下 **SYNTH 1 旋钮**，并进入步进输入（按住 [PAGE] 不放，再按一下 SYNTH 1 旋钮）。看到第 1、5、9、13 个亮着青蓝色就对了。', panel: ['SYNTH1', 'PAGE'], detect: { kind: 'track', track: 'SYNTH1' }, sim: { kind: 'mode', mode: 'stepinput', track: 'SYNTH1', on: true }, wait: '长按 [PAGE] 出现黑圈，再点 SYNTH 1 旋钮…', liveWait: '等你按 SYNTH 1 旋钮…' },
            { text: '按 **[BAR LENGTH]**，让它也变成 **2 小节**。', panel: ['BARLENGTH', 'METER'], detect: { kind: 'length', track: 'SYNTH1', bars: 2 }, wait: '点一下 [BAR LENGTH]…', liveWait: '按 [BAR LENGTH]，直到读数是 2 小节…' },
            { text: '**单按一下** [PAGE] 翻到第 2 页：第 1、5、9、13 个亮着（照抄来的 1、1、6、6）。', panel: ['PAGE'], sim: { kind: 'page', page: 1 }, wait: '短按一下 [PAGE]…' },
            { text: '第 **1、5** 个：先**按灭**，按一下 **Synth key 3**，再**按亮**。', panel: ['SK3', 'DK1', 'DK5'], sim: { kind: 'stepkeys', track: 'SYNTH1', keys: { 16: 3, 20: 3 } }, wait: '按灭第 1、5 个 → 点 Synth key 3 → 再按亮…' },
            { text: '第 **9、13** 个：先**按灭**，按一下 **Synth key 7**，再**按亮**。', panel: ['SK7', 'DK9', 'DK13'], sim: { kind: 'stepkeys', track: 'SYNTH1', keys: { 0: 1, 4: 1, 8: 6, 12: 6, 16: 3, 20: 3, 24: 7, 28: 7 }, exact: true }, wait: '按灭第 9、13 个 → 点 Synth key 7 → 再按亮…' },
            { text: '**单按一下** [PAGE] 翻回第 1 页，再短按 [PLAY]：两小节，四个和弦，贝斯跟着走。', panel: ['PAGE', 'PLAY'], detect: { kind: 'start' }, wait: '短按 [PAGE]，再点 [PLAY]…', liveWait: '翻回第 1 页，然后按 [PLAY]…' },
            { text: '多听几圈，然后按 [PLAY] 停下。', panel: ['PLAY'], detect: { kind: 'stop' }, wait: '再点 [PLAY]…', liveWait: '等你停止…' },
          ],
          done: '鼓、贝斯、和弦，两小节一圈。这已经是一首歌的骨架了。',
          coach: '学生在把 SYNTH 1 的贝斯也加长到两小节，并把第 2 小节的根音改成 Synth key 3、3、7、7（第 2 页的第 1、5 步和第 9、13 步）。贝斯轨不是 CHORD 弹法，换音要用“按灭 → 按新的 Synth key → 按亮”，不要用“按住步进键 + Synth key”（那是往一步里加音）。鼓轨不用动：鼓还是一小节循环，和两小节的贝斯、和弦一起放没有问题。',
        },
        {
          type: 'game',
          title: '歌里的和弦（一）：Gangsta\'s Paradise',
          chart: 'song-gangstas-paradise',
          stages: [{ assist: 'demo' }, { assist: 'guide', pass: 0.55 }, { assist: 'solo', pass: 0.55 }],
          blocks: [
            '拿两首你听过的歌练手。第一首是 **Gangsta\'s Paradise**：它原本就在 **C 小调**，和你机器上现在的设置一模一样。',
            '底下那段阴沉的和弦就是四个转圈：**键 6 → 4 → 5 → 1**，每个两拍，两小节一圈。注意它不是从键 1 起的——先亮一下（键 6），再一路沉下去，最后落回“家”（键 1）。',
            { callout: 'theory', text: '原曲第三个和弦比机器键 5 上的**亮**一点（差一个音）。想做到一模一样得改和弦里的音，现在先用现成的键 5，听个大概。' },
          ],
          coach: 'Gangsta\'s Paradise 的和弦进行（和应用里这首歌的分轨一致），原调 C 小调：A♭ – Fm – G – Cm，在机器上是 Synth key 6（G#maj7）、4（Fm7）、5（Gm7）、1（Cm7），每个两拍，两小节一圈，80 BPM。原曲的 G 是大三和弦（借自和声小调，带还原 B），机器键 5 的预设是小七和弦，差一个音，课文已说明是简化版。难点是开头不是键 1。',
        },
        {
          type: 'game',
          title: '歌里的和弦（二）：Starboy',
          chart: 'song-starboy',
          stages: [{ assist: 'demo' }, { assist: 'guide', pass: 0.55 }, { assist: 'solo', pass: 0.55 }],
          blocks: [
            '第二首是 The Weeknd 的 **Starboy**。这一课开头那四个预设里的 **1 → 7 → 6 → 7**（“80 年代合成器的味道”），就是它：一小节一个和弦，慢慢换，四小节一圈。原曲在 A 小调，搬到你的 C 小调上正好是这四个键。',
            { callout: 'tip', text: '一个和弦要按满一整小节：按下去就别急着松，数完“1、2、3、4”再换下一个。眼睛提前看下一个落在哪条。' },
          ],
          coach: 'Starboy 的和弦进行（和应用里这首歌的分轨一致），原调 A 小调：Am – G – F – G，搬到 C 小调是 Synth key 1（Cm7）、7（A#7）、6（G#maj7）、7（A#7），一小节一个，四小节一圈，93 BPM。和这一课开头 chordprog 小部件里“1 → 7 → 6 → 7”那个预设一样。难点是按满一整小节再换。',
        },
        {
          type: 'free',
          title: '写一个你自己的和声循环',
          tracks: ['KICK', 'SNARE', 'CLAP', 'HAT1'],
          synthTracks: ['SYNTH1', 'SYNTH2', 'DX'],
          notePlaceholder: '例如：和弦 1 → 4 → 6 → 5，每两拍一个；贝斯跟着弹根音；DX 在反拍上戳键 1',
          ask: '这是我自己写的和声循环（第 3 章的结业创作），请你点评：这几个和弦这样走，听起来是什么心情？贝斯和和弦配得对不对？只给一条最值得试的修改建议。',
          blocks: [
            '最后一步没有标准答案。用这一章学到的东西，换一套你自己的和弦：从 7 个键里挑三四个，排个顺序，贝斯跟着弹同一个键。几个可以试的方向：',
            { list: [
              '把 1 → 6 → 3 → 7 的顺序打乱，或者换掉其中一个（比如把 3 换成 4）。',
              '让 SYNTH 2 铺长音，**DX** 在反拍上短促地“戳”同一个和弦——两位和弦手一长一短。',
              '只用两个和弦，但把鼓换成第 1 章你自己写的那个。',
            ] },
            '写完点“请啾啾点评”。',
          ],
          coach: '第 3 章的结业创作。学生已经学过：和弦是隔一个拿一个叠出来的；大小和弦的明暗；CHORD 弹法（C 小调 7 个键：1 Cm、2 D°、3 D#、4 Fm、5 Gm、6 G#、7 A#）；和弦跟着贝斯根音走；步进输入放和弦、改音长；[BAR LENGTH] 加长到两小节、[PAGE] 翻页。点评时用“键几”来说，少用乐理名词；先肯定，再给一条具体的修改建议。真机上合成器轨的内容应用读不出来，学生会自己写一句描述。',
        },
      ],
    },
  ],
};
