// 课程内容。机器上的操作全部以官方 User Guide（OS V2.00）为准。第 0–2 章避开了 V2.00 才有的操作，V1.20 的机器也能照做。
// 依据见 docs/seqtrak-operation-reference.md；实机核对记录见 docs/hardware-findings.md。
//
// 步骤类型：read 讲解 / tour 导览 / do 动手（逐项自动打勾）/ findkeys 找按键 / game 音游 / quiz 小测 / program 编程挑战 / free 自由创作
// 动手任务里：detect = 真机和模拟机都认得出来的条件；sim = 只有模拟机认得出来的条件。simProject = 这节课模拟机用哪个工程（3 = 4 号空白工程）。
// 文案里的标记：**加粗**、[PLAY] 这样的方括号会显示成按键。第 0 章在 ch0.js，第 3 章在 ch3.js，第 4 章在 ch4.js。
import { PATTERNS } from './charts.js';
import { ch0 } from './ch0.js';
import { ch3 } from './ch3.js';
import { ch4 } from './ch4.js';
import { ch5 } from './ch5.js';
import { ch6 } from './ch6.js';
import { ch7 } from './ch7.js';
import { ch8 } from './ch8.js';
import { SONG_LESSONS } from './song-lessons.js';
import { ARR_LESSONS } from './arrangement-lessons.js';

const { FOUR, BACK, EIGHTHS, OFF } = PATTERNS;
const POP_KICK = 'x-------x-x-----';
const C_MINOR = { scale: 0, key: 0 };

// ═════════════════════════ 第 1 章 · 节拍与鼓 ═════════════════════════

const ch1 = {
  id: 'ch1',
  no: 1,
  title: '节拍与鼓',
  subtitle: '从一下“咚”到一个完整的鼓组',
  lessons: [
    {
      id: '1-1',
      simProject: 3,
      no: '1.1',
      title: '拍子：音乐的心跳',
      minutes: 25,
      summary: 'BPM、拍、小节到底是什么；在机器上调速度；第一局音游。',
      takeaway: '**BPM** = 每分钟多少拍。四拍凑成一个**小节**，数作“1、2、3、4”。底鼓每拍一下叫**四踩**，是 House 和 Techno 的地基。机器上用右侧的 [BPM+] / [BPM-] 调速度。',
      steps: [
        {
          type: 'read',
          title: '拍子和 BPM',
          blocks: [
            '听歌时脚会不自觉地跟着点，点的那一下一下，就是**拍子**（beat）。它是音乐里最基本的尺子：所有声音在什么时候出现，都是拿它来量的。',
            '**BPM**（Beats Per Minute）是这把尺子的刻度：一分钟里有多少拍。60 BPM 就是一秒一拍，120 BPM 是一秒两拍。',
            { callout: 'dj', text: '这个你其实早就会了。对拍时推拉 pitch 推子，改的就是 BPM；两首歌的底鼓“咚咚咚咚”叠在一起听不出重影，就是两把尺子对齐了。' },
            '拖一拖下面的滑杆。同样是“咚、咚、咚、咚”，速度一变，味道完全不同：',
            { widget: 'bpm', value: 100 },
          ],
        },
        {
          type: 'read',
          title: '四拍一个小节',
          blocks: [
            '拍子是一下一下的，但音乐不是一盘散沙。人会很自然地把拍子**四个一组**来听：**1**、2、3、4，**1**、2、3、4……每一组叫一个**小节**（bar）。第 1 拍通常最重，像一句话的开头。',
            { callout: 'dj', text: '你混音时数的“8 个小节之后进人声”“16 小节一个段落”，数的就是这个。Drop 永远砸在某个小节的第 1 拍上，这就是为什么它那么有力。' },
            { callout: 'theory', text: '“每小节 4 拍”写作 **4/4 拍**。电子音乐、流行、Hip-hop 几乎全是 4/4，所以我们暂时只需要认识它。' },
            '接下来你会一直听到节拍器：“**嘀**、嗒、嗒、嗒”。高一点的那一声就是每小节的第 1 拍。',
          ],
        },
        {
          type: 'do',
          title: '在机器上调速度',
          blocks: [
            '机器右侧面有 [BPM+] 和 [BPM-]。机器没有屏幕，只能从那列 8 个小灯粗略看出快慢——所以下面这个读数就是你的屏幕：',
            { device: ['tempo'] },
            { callout: 'tip', text: '按一下变 1；**按住不放**会连续变。**同时按** [BPM+] 和 [BPM-] 会回到这个工程原来的速度。' },
            { action: 'tempo', value: 100, label: '调不过去？让应用直接把机器设成 100 BPM' },
          ],
          tasks: [
            { text: '用 [BPM+] / [BPM-] 把机器的速度调到 **100 BPM**。', panel: ['BPM+', 'BPM-', 'METER'], detect: { kind: 'tempo', value: 100 }, wait: '调到 100 并停留一下…' },
          ],
          done: '100 BPM：比走路快一点，不赶，很适合练习。',
        },
        {
          type: 'game',
          title: '第一局：四踩底鼓',
          chart: 'pulse-kick',
          blocks: [
            '规则只有一条：**音符落到橙线的那一刻，按下去。** 这一关每拍一下底鼓，一共 16 下。',
            '分三步走：先**看示范**，再**跟着示范音打**，最后**只留节拍器自己打**。下方的“偏差仪”会告诉你每一下是早了还是晚了。',
          ],
          coach: '这是学生的第一局音游。四踩底鼓，每拍一下。重点是让学生听节拍器而不是只盯着屏幕。',
        },
        {
          type: 'quiz',
          title: '用耳朵回答',
          questions: [
            {
              q: '先听 A，再听 B。哪一个更快？',
              play: [{ label: 'A', bpm: 92, tracks: { KICK: FOUR }, seconds: 4 }, { label: 'B', bpm: 124, tracks: { KICK: FOUR }, seconds: 4 }],
              options: ['A 更快', 'B 更快', '一样快'],
              answer: 1,
              explain: 'A 是 92 BPM，B 是 124 BPM。B 已经是典型的 House 速度了。',
            },
            {
              q: '一首 120 BPM 的歌，一个小节（4 拍）有多长？',
              options: ['1 秒', '2 秒', '4 秒'],
              answer: 1,
              explain: '120 BPM = 每秒 2 拍，4 拍正好 2 秒。所以 8 个小节是 16 秒——这个数你以后编曲时会经常用。',
            },
          ],
        },
      ],
    },
    {
      id: '1-2',
      simProject: 3,
      no: '1.2',
      title: '16 个格子',
      minutes: 30,
      summary: '把一小节切成 16 步，用 Drum keys 填格子，编出第一个四踩。',
      takeaway: '一小节 = 4 拍 = **16 步**。四个正拍落在第 **1、5、9、13** 步。选中一条鼓轨后，**按亮 Drum key 就是在那一步放一个音**，再按一次就灭。这种“填格子”的做法叫**步进编程**。',
      homework: '在练习场打一局「四踩底鼓」的独奏模式，目标两星。',
      steps: [
        {
          type: 'read',
          title: '把一拍再切开',
          blocks: [
            '一拍一下的节奏很快就不够用了。把每一拍对半切，得到**八分音符**；再对半切，得到**十六分音符**。一小节 4 拍，就被切成了 **16 小格**。',
            '音乐人数这 16 格有个固定口诀：**1 e & a 2 e & a 3 e & a 4 e & a**（“& ”读作 and）。数字是正拍，& 是两拍正中间。',
            { widget: 'count' },
            { callout: 'dj', text: 'CDJ 和 Rekordbox 波形上那一排竖线（beat grid）就是这把尺子，只不过它只画到了“拍”，我们现在把每一拍又分成了 4 小格。' },
          ],
        },
        {
          type: 'read',
          title: '步进音序器：填格子',
          blocks: [
            '既然一小节是 16 格，那编节奏就可以变成一件很简单的事：**在想出声的格子里放一个音**。机器会从第 1 格走到第 16 格，然后回到开头，一圈一圈循环。这就是**步进音序器**（step sequencer），所有鼓机的核心。',
            '先在屏幕上玩一下。点格子放音，点播放听效果，试试上面的几个预设：',
            { widget: 'grid', tracks: ['KICK', 'SNARE', 'HAT1'], pattern: { KICK: FOUR }, presets: ['清空', '四踩', '流行', 'House'] },
            '注意四个正拍的位置：第 **1、5、9、13** 格（颜色稍深的那几格）。记住这四个数，它们是你在机器上找位置的路标。',
          ],
        },
        {
          type: 'do',
          title: '在机器上编一个四踩',
          blocks: [
            '机器上那两排 **16 个 Drum keys** 就是这 16 格：上排是 1–8，下排是 9–16。先**选中一条鼓轨**，再按 Drum key，就是在给那条轨道填格子。',
            { callout: 'tip', text: '按错了再按一次就灭。想把这条轨道整段清空：**按住 [DELETE]，同时按一下那条轨道的旋钮**（它旁边的小灯会闪红色）。注意这个删除不能撤销。' },
          ],
          lit: { DK1: 'yellow', DK5: 'yellow', DK9: 'yellow', DK13: 'yellow' },
          tasks: [
            { text: '确认在 4 号练习本里，然后按一下 **KICK 旋钮**选中底鼓。', panel: ['KICK'], detect: { kind: 'track', track: 'KICK' }, wait: '等你按 KICK…' },
            { text: '看 Drum keys：第 1 个亮着黄色——这就是空白工程里自带的那一下底鼓。', panel: ['DK1'] },
            { text: '把第 **5**、**9**、**13** 个也按亮（5 在上排第 5 个；9 和 13 在下排第 1、第 5 个）。', panel: ['DK5', 'DK9', 'DK13'], sim: { kind: 'steps', track: 'KICK', steps: [0, 4, 8, 12] }, wait: '按亮第 5、9、13 个步进键…' },
            { text: '短按 [PLAY]：咚、咚、咚、咚。', panel: ['PLAY'], detect: { kind: 'start' }, wait: '等你按 [PLAY]…' },
            { text: '听几圈，再按 [PLAY] 停下。', panel: ['PLAY'], detect: { kind: 'stop' }, wait: '等你停止…' },
          ],
          done: '这是你在这台机器上写下的第一个节奏。',
        },
        {
          type: 'program',
          title: '挑战：让应用核对你的四踩',
          target: { KICK: FOUR },
          bpm: 100,
          blocks: [
            '现在让应用来检查。下面那张网格显示的是**机器里此刻真实的内容**：接着真机时，你每按亮一个步进键，它就跟着亮一格，不用播放也看得到。',
          ],
          done: '完全一致：四个正拍，一个不多一个不少。',
        },
        {
          type: 'quiz',
          title: '找位置',
          questions: [
            { q: '第 3 拍落在第几个 Drum key 上？', options: ['第 3 个', '第 9 个', '第 12 个'], answer: 1, explain: '每拍占 4 格：第 1 拍从 1 开始，第 2 拍从 5，第 3 拍从 **9**，第 4 拍从 13。' },
            { q: '第 9 个 Drum key 在面板的什么位置？', options: ['上排最右', '下排最左', '下排最右'], answer: 1, explain: '上排是 1–8，下排是 9–16，所以 9 是下排的第一个。' },
          ],
        },
      ],
    },
    {
      id: '1-3',
      simProject: 3,
      no: '1.3',
      title: '让人点头的 2、4 拍',
      minutes: 30,
      summary: '军鼓放在第 2、4 拍；用静音和独奏把乐手一个个拎出来听。',
      takeaway: '军鼓或拍手落在**第 2、4 拍**（第 5、13 步）叫 **backbeat**，是让人跟着点头的那一下。**按住 [MUTE] + 按轨道旋钮** = 静音；**按住 [SOLO] + 按轨道旋钮** = 只听它一个。',
      steps: [
        {
          type: 'read',
          title: '咚 — 啪 — 咚 — 啪',
          blocks: [
            '光有底鼓，音乐只是在“走路”。在**第 2 拍和第 4 拍**加上一声清脆的军鼓或拍手，它就开始“摇”了。这两下叫 **backbeat**，几乎所有流行、摇滚、Hip-hop、House 里都有它。',
            '听一下有和没有的区别：',
            { widget: 'ab', bpm: 100, a: { label: '只有底鼓', tracks: { KICK: FOUR } }, b: { label: '加上 2、4 拍的军鼓', tracks: { KICK: FOUR, SNARE: BACK } } },
            { callout: 'dj', text: '混音时如果两首歌正好差了一拍，底鼓明明叠上了，听着却很别扭——因为两边的军鼓“啪、啪”地错开了。那两下错开的，就是 backbeat。' },
          ],
        },
        {
          type: 'game',
          title: '只打第 2、4 拍',
          chart: 'backbeat',
          blocks: ['底鼓由应用替你打着。你只负责第 2 拍和第 4 拍的那一声“啪”。难点不在按，而在**忍住第 1、3 拍不按**。'],
          coach: '学生第一次练 backbeat。常见问题是抢拍（因为在等待），或者在第 1、3 拍多按。',
        },
        {
          type: 'do',
          title: '在机器上加军鼓',
          lit: { DK5: 'yellow', DK13: 'yellow' },
          tasks: [
            { text: '按一下 **SNARE 旋钮**选中军鼓。Drum keys 会变成全灭——每条轨道有自己的 16 格。', panel: ['SNARE'], detect: { kind: 'track', track: 'SNARE' }, wait: '等你按 SNARE…' },
            { text: '按亮第 **5** 个和第 **13** 个 Drum key（上排第 5 个、下排第 5 个）。', panel: ['DK5', 'DK13'], sim: { kind: 'steps', track: 'SNARE', steps: [4, 12] }, wait: '按亮第 5、13 个步进键…' },
            { text: '按 [PLAY] 听：咚 — 啪 — 咚 — 啪。', panel: ['PLAY'], detect: { kind: 'start' }, wait: '等你按 [PLAY]…' },
          ],
          done: '先别停，带着它进下一步。',
        },
        {
          type: 'do',
          title: '静音与独奏',
          blocks: [
            '乐手一多，就需要能把某一位单独拎出来听，或者让某一位先闭嘴。这两个操作以后现场演出时会用得飞起。',
          ],
          tasks: [
            { text: '机器播放着的时候，**按住 [MUTE]，同时按一下 KICK 旋钮**。底鼓没了，KICK 旁边的小灯变绿。', panel: ['MUTE', 'KICK'], sim: { kind: 'mute', track: 'KICK', on: true } },
            { text: '同样的操作再做一次，底鼓回来。', panel: ['MUTE', 'KICK'], sim: { kind: 'mute', track: 'KICK', on: false } },
            { text: '**按住 [SOLO]，同时按一下 SNARE 旋钮**：只剩军鼓，其它全部安静。再做一次取消。', panel: ['SOLO', 'SNARE'], sim: { kind: 'solo', any: true, count: 2 }, wait: '独奏，再取消' },
            { text: '按 [PLAY] 停下。', panel: ['PLAY'], detect: { kind: 'stop' }, wait: '等你停止…' },
          ],
          done: '静音是“这位先别弹”，独奏是“只听这位”。',
        },
        {
          type: 'program',
          title: '挑战：底鼓 + 军鼓',
          target: { KICK: FOUR, SNARE: BACK },
          bpm: 100,
          blocks: ['两条轨道一起核对。如果刚才静音了某条轨道，记得先取消。'],
        },
        {
          type: 'game',
          title: '两只手分工',
          chart: 'kick-snare',
          blocks: [
            '现在把底鼓和军鼓都交给你。底鼓在第 1、3 拍，军鼓在第 2、4 拍：左、右、左、右。',
            { callout: 'tip', text: '用键盘的话是 F 和 J；用机器的话是 Synth key 1 和 2（记得先进入实时输入模式）。' },
          ],
          coach: '第一次两条轨道。底鼓 1、3 拍，军鼓 2、4 拍，交替进行。',
        },
      ],
    },
    {
      id: '1-4',
      simProject: 3,
      no: '1.4',
      title: '镲：把时间切细',
      minutes: 35,
      summary: '八分镲与反拍镲；拼出完整的 House 鼓组；学会换音色。',
      takeaway: '镲负责把时间切细，给节奏“往前走”的感觉。**八分镲**（每半拍一下）四平八稳，**反拍镲**（只在两拍之间）是 House 的招牌。换音色：选中轨道后转右边的 **Sound Design 旋钮 1**。',
      steps: [
        {
          type: 'read',
          title: '第三位鼓手',
          blocks: [
            '底鼓定下了“走”，军鼓给了“摇”，还差一样：把拍子之间的空隙填上，让节奏有持续向前的推力。这是**踩镲**（hi-hat）的工作，机器上是 HAT 1（闭镲，短促的“嚓”）和 HAT 2（开镲，拖长的“呲——”）。',
            '镲最常见的两种写法，听听区别：',
            { widget: 'ab', bpm: 112, a: { label: '八分镲（每半拍一下）', tracks: { KICK: FOUR, SNARE: BACK, HAT1: EIGHTHS } }, b: { label: '反拍镲（只在两拍之间）', tracks: { KICK: FOUR, SNARE: BACK, HAT1: OFF } } },
            '第二种就是“咚-嚓-咚-嚓”：底鼓和镲一个踩在拍子上、一个躲在拍子中间，你来我往。**这是 House 音乐的招牌。**',
          ],
        },
        {
          type: 'game',
          title: '八分镲',
          chart: 'hat-eighths',
          blocks: ['嘴里念“1 & 2 & 3 & 4 &”，每念一个字按一下。手要匀，像钟摆。'],
          coach: '八分音符的闭镲，共 8 下一小节。重点是均匀，不要越打越快。',
        },
        {
          type: 'game',
          title: '反拍镲',
          chart: 'hat-offbeat',
          blocks: [
            '这次只打“&”，数字上不打。底鼓“咚”的时候你的手抬起来，底鼓落完你再落。',
            { callout: 'tip', text: '很多人第一次打反拍会不自觉地滑到正拍上去。一个办法：脚跟着底鼓踩，手在脚抬起来的时候落下。' },
          ],
          coach: '反拍（offbeat）练习：只在每拍的 & 位置打。初学者常见错误是滑到正拍上，或者整体偏早。',
        },
        {
          type: 'do',
          title: '在机器上加反拍镲',
          lit: { DK3: 'yellow', DK7: 'yellow', DK11: 'yellow', DK15: 'yellow' },
          blocks: ['反拍在每一拍的第 3 小格，也就是第 **3、7、11、15** 步。'],
          tasks: [
            { text: '按一下 **HAT 1 旋钮**。', panel: ['HAT1'], detect: { kind: 'track', track: 'HAT1' }, wait: '等你按 HAT 1…' },
            { text: '按亮第 **3、7、11、15** 个 Drum key。', panel: ['DK3', 'DK7', 'DK11', 'DK15'], sim: { kind: 'steps', track: 'HAT1', steps: [2, 6, 10, 14] }, wait: '按亮第 3、7、11、15 个步进键…' },
            { text: '再选中 **CLAP**，按亮第 **5、13** 个：拍手和军鼓叠在一起，2、4 拍会更厚实。', panel: ['CLAP', 'DK5', 'DK13'], detect: { kind: 'track', track: 'CLAP' }, sim: { kind: 'steps', track: 'CLAP', steps: [4, 12] }, wait: '选中 CLAP，按亮第 5、13 个…' },
            { text: '按 [PLAY]。这已经是一个能跳舞的鼓组了。', panel: ['PLAY'], detect: { kind: 'start' }, wait: '等你按 [PLAY]…' },
            { text: '听够了按 [PLAY] 停下。', panel: ['PLAY'], detect: { kind: 'stop' }, wait: '等你停止…' },
          ],
        },
        {
          type: 'program',
          title: '挑战：House 鼓组',
          target: { KICK: FOUR, CLAP: BACK, HAT1: OFF },
          bpm: 120,
          blocks: ['三条轨道一起核对：底鼓四踩、拍手 2 和 4、镲在反拍。军鼓留着或者静音都可以，不在检查范围内。'],
          done: '一个标准的 House 鼓组，全世界的舞池都认识它。',
        },
        {
          type: 'do',
          title: '给鼓手换一套鼓',
          blocks: [
            '同样的格子，换一个音色，气质就变了。机器里有两千多个音色，每条鼓轨都可以单独换。',
            { callout: 'warn', text: '换音色用的是**右边桔红色区域**那一列 4 个旋钮里**最上面**的一个（下面印着 SOUND），不是左边的轨道旋钮。转它的时候，那列会亮的文字里“SOUND”会亮起来。' },
            { callout: 'tip', text: '音色太多转不过来？**按住 Sound Design 旋钮 1，同时按一个 Drum key**，可以直接跳到某一类的第一个音色。鼓轨上，第 1 个键是各种 KICK，第 2 个是 SNARE，第 4 个是 CLAP，第 6、7 个是闭镲和开镲。' },
          ],
          tasks: [
            { text: '按一下 **KICK 旋钮**选中底鼓，然后按 [PLAY] 让它循环着。', panel: ['KICK', 'PLAY'], detect: { kind: 'start' }, wait: '等你按 [PLAY]…' },
            { text: '慢慢转动 **Sound Design 旋钮 1**，每转一格换一个底鼓。找一个你喜欢的。', panel: ['SD1'], detect: { kind: 'sound', track: 'KICK' }, wait: '转一转 Sound Design 旋钮 1…' },
            { text: '用同样的办法给 **HAT 1** 也换一个音色，然后停止播放。', panel: ['HAT1', 'SD1'], detect: { kind: 'stop' }, wait: '换好之后按 [PLAY] 停止…' },
          ],
          done: '格子决定“什么时候响”，音色决定“响的是什么”。这两件事是分开的。',
        },
        {
          type: 'game',
          title: '三条轨道：House 鼓组',
          chart: 'house-kit',
          stages: [{ assist: 'demo' }, { assist: 'guide', pass: 0.55 }, { assist: 'solo', pass: 0.55 }],
          blocks: [
            '底鼓、拍手、镲，三样全归你。先看示范找感觉；觉得快就把速度调到 70%。',
            { callout: 'tip', text: '第 2、4 拍上底鼓和拍手是**同时**落下的，两根手指一起按。' },
          ],
          coach: '三轨 House 鼓组：四踩底鼓 + 2/4 拍手 + 反拍闭镲。难点是第 2、4 拍底鼓和拍手同时按，以及反拍镲不能滑到正拍。可以建议降速到 70%。',
        },
      ],
    },
    {
      id: '1-5',
      simProject: 3,
      no: '1.5',
      title: '律动：同样的格子，不同的味道',
      minutes: 35,
      summary: '底鼓换个位置就是另一种风格；Swing；两道听写题；写一个你自己的鼓点。',
      takeaway: '风格的差别，很大一部分就藏在**底鼓放在哪几格**。**Swing** 把每对十六分音符里的后一个往后推，让节奏从“机器”变成“人”。机器上按 [SWING] 加摇摆，**按住 [DELETE] + [SWING]** 归零。',
      homework: '去「曲目」页看看候选歌单，勾出你最想学的几首。',
      steps: [
        {
          type: 'read',
          title: '把底鼓挪一挪',
          blocks: [
            '军鼓老老实实待在 2、4 拍，镲匀速地切着时间——在这个框架里，**底鼓放在哪儿**，几乎决定了这是什么风格。',
            '点下面的预设，只看底鼓那一行是怎么变的：',
            { widget: 'grid', tracks: ['KICK', 'SNARE', 'HAT1'], pattern: { KICK: POP_KICK, SNARE: BACK, HAT1: EIGHTHS }, presets: ['四踩', '流行', 'Boom Bap', 'House'], title: '同一个框架，换底鼓的位置' },
            { list: [
              '**四踩 / House**：每拍一下，稳定、催眠，适合跳舞。',
              '**流行**：第 1、3 拍，外加第 3 拍后面“多垫一下”，有往前推的感觉。',
              '**Boom Bap**：底鼓故意落在拍子的缝里，一顿一顿的，Hip-hop 的味道。',
            ] },
            '自己动手改几格试试。没有标准答案，好听就是对的。',
          ],
        },
        {
          type: 'read',
          title: 'Swing：让机器学会“摇”',
          blocks: [
            '到目前为止，每一格都一样长，听起来很“机器”。真人打鼓不是这样的：他会把每一对十六分音符里的**后一个稍微拖晚一点**。这一点点不均匀，就是 **Swing**（摇摆）。',
            { widget: 'swing' },
            { callout: 'dj', text: '同样是 90 BPM，为什么 J Dilla 的鼓听着“醉醺醺”的那么舒服，而节拍器听着那么僵？差别就在这儿。老派 House 唱片的“shuffle”也是它。' },
          ],
        },
        {
          type: 'do',
          title: '在机器上加一点 Swing',
          blocks: [{ device: ['swing'] }],
          tasks: [
            { text: '按 [PLAY] 让你的 House 鼓组循环着。', panel: ['PLAY'], detect: { kind: 'start' }, wait: '等你按 [PLAY]…' },
            { text: '按几下右侧面的 [SWING]，听镲的感觉怎么变。', panel: ['SWING', 'METER'], detect: { kind: 'swing', min: 1 }, wait: '等你按 [SWING]…' },
            { text: '**按住 [DELETE]，同时按一下 [SWING]**，把它归零。', panel: ['DELETE', 'SWING'], detect: { kind: 'swing', zero: true }, wait: '等你归零…' },
            { text: '按 [PLAY] 停下。', panel: ['PLAY'], detect: { kind: 'stop' }, wait: '等你停止…' },
          ],
          done: 'Swing 是加在整个工程上的，所有轨道一起摇。',
        },
        {
          type: 'game',
          title: 'Boom Bap',
          chart: 'boombap',
          stages: [{ assist: 'demo' }, { assist: 'guide', pass: 0.55 }, { assist: 'solo', pass: 0.55 }],
          blocks: ['慢，但是不好打：底鼓有两下不在拍子上，而且整体带着 Swing。先多听两遍示范，把它当成一句话记住：“咚——啪——，咚-咚 啪——”。'],
          coach: 'Boom Bap 鼓型，带 swing。底鼓在第 1、8、11 步，军鼓在 5、13 步。难点是第 8 步（第 2 拍的 a）和第 11 步（第 3 拍的 &）这两个切分的底鼓。',
        },
        {
          type: 'program',
          title: '听写（一）',
          hidden: true,
          target: { KICK: POP_KICK, SNARE: BACK },
          tracks: ['KICK', 'SNARE'],
          bpm: 96,
          blocks: [
            '这次不给你看答案。点“听目标”，靠耳朵把它编出来：底鼓和军鼓各在哪几格？',
            { callout: 'tip', text: '先找军鼓（它通常就在 2、4 拍），再数底鼓有几下、哪几下在拍子上。机器里上一课的四踩还在 KICK 轨上，需要改掉；拍手和镲不在检查范围内，嫌吵可以先静音。' },
          ],
          done: '这是“流行基本鼓”。你刚刚用耳朵把一个节奏拆开又装了回去——这就是扒歌的第一步。',
        },
        {
          type: 'program',
          title: '听写（二）',
          hidden: true,
          target: { KICK: 'x---------x-----', SNARE: BACK },
          tracks: ['KICK', 'SNARE'],
          bpm: 128,
          blocks: ['再来一个，速度快一些。注意底鼓只有两下，中间空了很大一块。'],
          done: '这是 Two-step：UK Garage 和 Drum & Bass 的骨架。留白本身就是节奏。',
        },
        {
          type: 'free',
          title: '写一个你自己的鼓点',
          tracks: ['KICK', 'SNARE', 'CLAP', 'HAT1', 'HAT2', 'PERC1'],
          bpm: 100,
          blocks: [
            '最后一步没有标准答案。用你这一章学到的东西，写一个一小节的鼓点：可以从 House 鼓组改起，也可以清空重来。',
            '写完点“请啾啾点评”：啾啾会告诉你它像哪种风格，以及一条最值得试的修改。',
          ],
          coach: '第 1 章的结业创作。学生已经学过：四踩、backbeat、八分镲、反拍镲、切分底鼓、swing、mute/solo、换音色。点评时请具体到“第几步”，并鼓励为主。',
        },
      ],
    },
  ],
};

// ═════════════════════════ 第 2 章 · 低音与音高 ═════════════════════════

const ch2 = {
  id: 'ch2',
  no: 2,
  title: '低音与音高',
  subtitle: '给鼓组配上一条会走路的贝斯',
  lessons: [
    {
      id: '2-1',
      simProject: 3,
      no: '2.1',
      title: '高与低',
      minutes: 25,
      summary: '音名、八度、音阶；7 个 Synth keys 为什么“怎么按都不难听”。',
      takeaway: '音只有 **12 个名字**，往上每 12 个就绕回来，高了一个**八度**。**音阶**是从这 12 个里挑出来的一组（通常 7 个）彼此合得来的音。SEQTRAK 的 7 个 Synth keys 上放的就是当前音阶的 7 个音，所以怎么按都在调上。',
      steps: [
        {
          type: 'read',
          title: '音有高低，也有名字',
          blocks: [
            '鼓只管“什么时候响”。从这一章开始多了一个维度：**音高**——这个音是高是低。',
            '点一点下面的键盘。越往右越高；白键从 C 开始依次叫 **C D E F G A B**，然后又是 C。',
            { widget: 'piano' },
            { callout: 'theory', text: '两个相邻的同名音（比如 C2 和 C3）相差一个**八度**：高的那个振动得正好快一倍，所以听起来“是同一个音，只是更亮”。把黑键也算上，一个八度里一共 **12 个音**，再没有别的了。' },
            { callout: 'dj', text: '混音软件里显示的 “8A”“Am”“Key: F” 说的就是一首歌主要用了哪一组音。两首歌的调合得来，叠在一起才不打架——这叫 harmonic mixing，背后的道理就是这一节。' },
          ],
        },
        {
          type: 'read',
          title: '音阶：挑 7 个合得来的',
          blocks: [
            '12 个音如果随便乱按，大概率很难听。所以一首歌通常只从里面挑 **7 个**彼此合得来的音来用，这一组音叫**音阶**（scale）；从哪个音开始挑，叫**调**（key）。',
            'SEQTRAK 在这件事上非常体贴：它**只有 7 个 Synth keys**，上面放的正好是当前音阶的 7 个音。也就是说，只要音阶选好了，你闭着眼睛按也不会按到“错音”。',
            '下面这个面板和机器上的 7 个键是同一个东西。换一换 SCALE 和 KEY，看 7 个键分别变成了什么音：',
            { widget: 'synthkeys', scale: 0, key: 0, octave: 0 },
            { callout: 'theory', text: '机器里预存了 8 种音阶。最常用的两种：**MINOR**（小调，偏暗、带点忧郁，电子音乐里最常见）和 **MAJOR**（大调，明亮）。另外两种“五声”音阶只有 5 个不同的音，更不容易出错。' },
          ],
        },
        {
          type: 'do',
          title: '在机器上弹出声音',
          blocks: [
            { callout: 'warn', text: '如果还在“鼓的实时输入模式”里（Synth keys 按出来是鼓声），先退出：**按住任意一个鼓轨旋钮，同时按一下任意一个 Synth key**。' },
          ],
          tasks: [
            { text: '按一下 **SYNTH 1 旋钮**。', panel: ['SYNTH1'], detect: { kind: 'track', track: 'SYNTH1' }, wait: '等你按 SYNTH 1…' },
            { text: '把 7 个 **Synth keys** 从 1 到 7 挨个按一遍：一级一级往上走。', panel: ['SYNTHKEYS'], detect: { kind: 'note', track: 'SYNTH1', count: 7 }, wait: '按 Synth keys' },
            { text: '**按住 Sound Design 旋钮 1，同时按一下 Drum key 1**：跳到 BASS（贝斯）这一类音色。再按几个 Synth key 听听。', panel: ['SD1', 'DK1'], detect: { kind: 'sound', track: 'SYNTH1' }, wait: '等你换音色…' },
            { text: '按几下上缘的 [OCTAVE] 键，把音高降下来——贝斯要低才有分量。边按边弹，降到你觉得“够沉”为止。', panel: ['OCTAVE', 'METER'], sim: { kind: 'octave' } },
          ],
          done: '一个低沉的合成器贝斯。下一课让它跟鼓合到一起。',
        },
        {
          type: 'quiz',
          title: '检查一下',
          questions: [
            { q: 'C2 和 C3 是什么关系？', options: ['完全不相干的两个音', '同一个音名，相差一个八度', '同一个音，只是音量不同'], answer: 1, explain: '同名、高一个八度：C3 振动的速度正好是 C2 的两倍。' },
            { q: '为什么在 SEQTRAK 上“怎么按都不难听”？', options: ['机器会自动修正弹错的音', '7 个 Synth keys 上放的本来就是同一个音阶里的音', '因为音色好'], answer: 1, explain: '音阶替你把“合得来的音”挑好了，键盘上根本没有调外的音。' },
            {
              q: '听两个贝斯音，哪一个更低？',
              play: [{ label: 'A', bpm: 100, notes: [[0, 'C2', 6], [8, 'C2', 6]], seconds: 3 }, { label: 'B', bpm: 100, notes: [[0, 'C1', 6], [8, 'C1', 6]], seconds: 3 }],
              options: ['A 更低', 'B 更低'],
              answer: 1,
              explain: 'B 是 C1，比 A 的 C2 低一个八度。',
            },
          ],
        },
      ],
    },
    {
      id: '2-2',
      simProject: 3,
      no: '2.2',
      title: '贝斯跟着底鼓走',
      minutes: 35,
      summary: '把机器设成 C 小调；用根音贝斯撑起鼓组；学会给合成器轨“填格子”。',
      takeaway: '贝斯最重要的工作：弹**根音**（音阶的第 1 个音），并且**和底鼓配合**。跟底鼓同时落是“加重”，躲开底鼓落在反拍是“对话”。给合成器轨填格子要先进入**步进输入模式**：按住 [PAGE] + 按该轨旋钮。',
      steps: [
        {
          type: 'read',
          title: '贝斯是干什么的',
          blocks: [
            '贝斯站在鼓和旋律之间：它像鼓一样负责节奏，又像旋律一样有音高。一首歌“稳不稳”“沉不沉”，主要看它。',
            '听一下同一个鼓组，有贝斯和没贝斯：',
            { widget: 'ab', bpm: 118, a: { label: '只有鼓', tracks: { KICK: FOUR, CLAP: BACK, HAT1: OFF } }, b: { label: '鼓 + 贝斯', tracks: { KICK: FOUR, CLAP: BACK, HAT1: OFF }, notes: [[2, 'C1', 2], [6, 'C1', 2], [10, 'C1', 2], [14, 'C1', 2]] } },
            '注意到了吗？贝斯从头到尾**只弹了一个音**。这个音是音阶的第 1 个音，叫**根音**，是整个调的“家”。新手写贝斯的第一原则：**先把根音弹稳，别的都是装饰。**',
          ],
        },
        {
          type: 'do',
          title: '把机器调到 C 小调',
          blocks: [
            '为了让屏幕上的谱子和机器上的键对得上，我们统一用 **C 小调**：SCALE 选第 1 个（MINOR），KEY 选 C。这时 7 个 Synth keys 从 1 到 7 依次是 **C、D、D#、F、G、G#、A#**。',
            { device: ['scale', 'key'] },
            { callout: 'tip', text: '按上缘的 [SCALE]，右边那列 8 个小灯会显示现在是第几个音阶（**最上面那个灯是 MINOR**）。按 [KEY] 时，自下而上的 7 个灯代表 C、D、E、F、G、A、B，**最下面那个灯是 C**。' },
            { action: 'scalekey', scale: 0, key: 0, label: '找不到？让应用直接把机器设成 C 小调' },
          ],
          tasks: [
            { text: '用 [SCALE] 和 [KEY] 把机器设成 **MINOR / C**（看上面的读数）。', panel: ['SCALE', 'KEY', 'METER'], detect: { kind: 'scale', scale: 0, key: 0 }, wait: '等读数变成 小调 / C…' },
          ],
          done: 'C 小调。之后这一章的谱子都按这个设置来。',
        },
        {
          type: 'game',
          title: '根音贝斯',
          chart: 'bass-root',
          blocks: [
            '只有一个音：**Synth key 1**（C）。每拍一下，和底鼓同时落。',
            { callout: 'tip', text: '贝斯的音比鼓长。按下去之后稍微停一下再松手，让它“唱”出来。' },
          ],
          coach: '根音贝斯：每拍一下 C，和四踩底鼓同时。机器上是 Synth key 1（C 小调）。',
        },
        {
          type: 'do',
          title: '给合成器轨填格子',
          blocks: [
            '鼓轨选中就能直接按 Drum keys 填格子，合成器轨不行——它需要先进入**步进输入模式**，因为除了“哪一格”，机器还得知道“放哪个音”。规则是：**放进格子里的，是你最后按过的那个音。**',
          ],
          lit: { DK1: 'cyan', DK5: 'cyan', DK9: 'cyan', DK13: 'cyan' },
          tasks: [
            { text: '按一下 **SYNTH 1 旋钮**选中它。', panel: ['SYNTH1'], detect: { kind: 'track', track: 'SYNTH1' }, wait: '等你按 SYNTH 1…' },
            { text: '**按住左侧面的 [PAGE]，同时按一下 SYNTH 1 旋钮**，进入步进输入模式。', panel: ['PAGE', 'SYNTH1'], sim: { kind: 'mode', mode: 'stepinput', track: 'SYNTH1', on: true }, wait: '长按 [PAGE]，再点 SYNTH 1 旋钮…' },
            { text: '按一下 **Synth key 1**，告诉机器“接下来放的是这个音”。', panel: ['SK1'], detect: { kind: 'note', track: 'SYNTH1' }, wait: '按 Synth key 1' },
            { text: '按亮第 **1、5、9、13** 个 Drum key。合成器轨上亮的是**青蓝色**。', panel: ['DK1', 'DK5', 'DK9', 'DK13'], sim: { kind: 'steps', track: 'SYNTH1', steps: [0, 4, 8, 12] }, wait: '按亮第 1、5、9、13 个步进键…' },
            { text: '按 [PLAY]：贝斯和底鼓一起落下。', panel: ['PLAY'], detect: { kind: 'start' }, wait: '等你按 [PLAY]…' },
            { text: '按 [PLAY] 停下。', panel: ['PLAY'], detect: { kind: 'stop' }, wait: '等你停止…' },
          ],
          done: '退出步进输入模式的方法和进入一样：按住 [PAGE] + 按 SYNTH 1 旋钮。现在先不用退。',
        },
        {
          type: 'program',
          title: '挑战：四个根音',
          target: { SYNTH1: FOUR },
          tracks: ['SYNTH1'],
          litColor: 'cyan',
          legend: '在步进输入模式里（按住 [PAGE] + 按 SYNTH 1 旋钮进入），把图上亮青蓝色的 Drum keys 按亮。',
          bpm: 108,
          blocks: ['让应用核对 SYNTH 1 轨：第 1、5、9、13 步各有一个音。这里只检查位置，不检查是哪个音。'],
          done: '位置全对。',
        },
        {
          type: 'game',
          title: '反拍贝斯',
          chart: 'bass-offbeat',
          blocks: [
            '还是只有 Synth key 1，但这次**躲开底鼓**：底鼓落在数字上，贝斯落在 & 上。“咚-嘟-咚-嘟”，这是 House 贝斯最经典的写法。',
            '你在 1.4 练过反拍镲，手感是一样的。',
          ],
          coach: '反拍贝斯：只在每拍的 & 位置弹根音 C，与四踩底鼓交错。',
        },
      ],
    },
    {
      id: '2-3',
      simProject: 3,
      no: '2.3',
      title: '会走路的贝斯',
      minutes: 35,
      summary: '加入第 5 个音；两小节换四个根音；给你的鼓组配一条自己的贝斯线。',
      takeaway: '根音之外最稳的音是**五音**（音阶的第 5 个音，Synth key 5），根音和五音来回跳永远不会错。让根音每隔几拍换一个，音乐就有了“往前走”的**和声进行**——这是下一章和弦的入口。',
      homework: '去「曲目」页把想学的歌定下来。第 3 章开始，我们会用你选的歌当材料。',
      steps: [
        {
          type: 'read',
          title: '根音的好朋友：五音',
          blocks: [
            '只弹一个音很稳，但听久了会闷。想加第二个音，最安全的选择是音阶的**第 5 个音**（叫“五音”）。它和根音的关系是所有音里最和谐的，两者来回跳，怎么跳都好听。',
            '在机器上就是 **Synth key 1 和 Synth key 5**（C 小调里是 C 和 G）。',
            { widget: 'ab', bpm: 108, a: { label: '只有根音', tracks: { KICK: FOUR, SNARE: BACK }, notes: [[0, 'C1', 2], [4, 'C1', 2], [8, 'C1', 2], [12, 'C1', 2]] }, b: { label: '根音 + 五音', tracks: { KICK: FOUR, SNARE: BACK }, notes: [[0, 'C1', 2], [4, 'G1', 2], [8, 'C1', 2], [12, 'G1', 2]] } },
          ],
        },
        {
          type: 'game',
          title: '根音与五音',
          chart: 'bass-fifth',
          blocks: ['两个键：**1**（C）和 **5**（G），一拍一个，交替着来。'],
          coach: '根音 C 和五音 G 交替，每拍一个音。机器上是 Synth key 1 和 5。',
        },
        {
          type: 'game',
          title: '让它跳起来',
          chart: 'bass-bounce',
          stages: [{ assist: 'demo' }, { assist: 'guide', pass: 0.55 }, { assist: 'solo', pass: 0.55 }],
          blocks: [
            '同样是根音和五音，改成八分音符，贝斯就开始“蹦”了。最后一下用了第 7 个键，像一句话结尾往上挑了一下。',
            { callout: 'tip', text: '觉得快就先调到 70% 速度。眼睛盯住哪一条轨道要换，手提前移过去。' },
          ],
          coach: '八分音符的贝斯线：C C G C | C C G A#，主要用 Synth key 1、5，最后一个音是 7。',
        },
        {
          type: 'read',
          title: '让根音走起来',
          blocks: [
            '到现在为止，根音一直是 C，音乐像是在原地踏步。如果每隔两拍把贝斯换到**另一个音**上，听的人会感觉“景色在变”，音乐开始往前走。这叫**和声进行**。',
            '下面是电子和流行音乐里用得最多的进行之一，在 C 小调里是 **C → G# → D# → A#**，机器上按 **1 → 6 → 3 → 7**：',
            { widget: 'ab', bpm: 100, a: { label: '原地踏步（一直是 C）', tracks: { KICK: FOUR, SNARE: BACK }, notes: [[0, 'C1', 3], [4, 'C1', 3], [8, 'C1', 3], [12, 'C1', 3]] }, b: { label: '走起来（1 → 6）', tracks: { KICK: FOUR, SNARE: BACK }, notes: [[0, 'C1', 3], [4, 'C1', 3], [8, 'G#0', 3], [12, 'G#0', 3]] } },
            { callout: 'theory', text: '这四个根音上面各自叠几个音，就是四个**和弦**。无数歌曲用的都是这同一套四个和弦，只是速度、音色、节奏不同。这是第 3 章的内容，现在你只需要让贝斯把路先走出来。' },
          ],
        },
        {
          type: 'game',
          title: '四个根音',
          chart: 'bass-four-roots',
          stages: [{ assist: 'demo' }, { assist: 'guide', pass: 0.55 }, { assist: 'solo', pass: 0.55 }],
          blocks: ['两小节，每两拍换一个音：**1、1、6、6、3、3、7、7**。四条轨道从左到右是由低到高排的，和机器上键的顺序不一样，认准每条轨道下面写的 “Synth key 几”。'],
          coach: '两小节的根音进行：C C G# G# | D# D# A# A#，对应 Synth key 1 1 6 6 3 3 7 7。这是 i–VI–III–VII 进行的根音。',
        },
        {
          type: 'read',
          title: '第一阶段到这里',
          blocks: [
            '你已经能做出一个带贝斯的鼓组了，而且知道每一格为什么放在那里。回头看一下这两章攒下的东西：',
            { list: [
              '**节奏**：拍、小节、16 步；四踩、backbeat、八分镲、反拍镲；Swing；用耳朵听写鼓点。',
              '**音高**：音名、八度、音阶和调；根音、五音；一条四个根音的进行。',
              '**机器**：选轨、填格子、实时输入、步进输入、换音色、静音与独奏、调速度、Swing、音阶与调。',
            ] },
            '接下来的章节会依次是：**和弦与和声 → 合成与音色设计 → 采样 → 编曲 → 效果与现场演出**，最后把你选的 5–10 首歌串成一场自己的 set。',
            '现在请去「曲目」页，从候选歌单里勾出你最想学的几首。后面的课会围绕你选的歌来安排。',
          ],
        },
      ],
    },
  ],
};

// ═════════════════════════ 后续章节（制作中） ═════════════════════════

const upcoming = [
];

export const CHAPTERS = [ch0, ch1, ch2, ch3, ch4, ch5, ch6, ch7, ch8, ...upcoming];

export function allLessons() {
  return CHAPTERS.flatMap((c) => (c.lessons || []).map((lesson) => ({ chapter: c, lesson })));
}

// 曲目的“一轨一轨照着搭”的课（content/song-lessons.js）：不属于哪一章、不在首页的地图上，从那首歌的分轨页进。
// 套一个“曲目”的壳，课程播放器的页头写“曲目 · Faded 一轨一轨搭出来”；allLessons() 不含它们（首页、“接着练”只看章节）。
// 完整版的课（content/arrangement-lessons.js，每首两节）也算在这里：从完整版页面（#/songs/<id>/full）进
export const SONG_CHAPTER = { id: 'songs', no: '曲', title: '曲目', lessons: [...SONG_LESSONS, ...ARR_LESSONS] };

export function findLesson(id) {
  const all = allLessons();
  const i = all.findIndex((x) => x.lesson.id === id);
  if (i < 0) {
    const lesson = SONG_CHAPTER.lessons.find((l) => l.id === id);
    // 完整版 ① 的下一节是 ②
    const next = lesson?.next ? SONG_CHAPTER.lessons.find((l) => l.id === lesson.next) || null : null;
    return lesson ? { chapter: SONG_CHAPTER, lesson, next, prev: null } : null;
  }
  return { ...all[i], next: all[i + 1]?.lesson || null, prev: all[i - 1]?.lesson || null };
}

/** 第一节还没完成的课。 */
export function nextLesson(isDone) {
  return allLessons().find((x) => !isDone(x.lesson.id)) || null;
}
