// 小课堂 · 节奏线（9 关）。写法见 content/classroom.js 开头。
// 2026-11-15：新开 R2、R4、R5、R7（节奏挑战关，用音游的引擎）和关底大关 RB；原来乐理线的 T3「不踩在拍子上」并进了 R4、R5，
// T4「摇一摇」并进了 R6。
import { PLAY, STOP, PICK, STEPS } from './classroom-bits.js';

const FOUR = 'x---x---x---x---';
const BACK = '----x-------x---';
const EIGHTS = 'x-x-x-x-x-x-x-x-';
const OFF = '--x---x---x---x-';

// R8 的三种律动，节奏大关里猜风格那一段也用
const GROOVES = {
  house: { name: 'House', bpm: 124, mark: '每拍一下底鼓，中间夹一下开镲', tracks: { KICK: FOUR, CLAP: BACK, HAT2: OFF } },
  hiphop: { name: 'Hip-hop', bpm: 88, swing: 0.22, mark: '慢。底鼓不守规矩，军鼓守着 2、4 拍，带点晃', tracks: { KICK: 'x------x--x-----', SNARE: BACK, HAT1: EIGHTS } },
  techno: { name: 'Techno', bpm: 134, mark: '快、硬。底鼓每拍一下，镲密得像下雨', tracks: { KICK: FOUR, HAT1: 'x-xxx-xxx-xxx-xx', PERC1: '---x--x---x--x--' } },
};
const VARIANTS = [
  { is: 'house', bpm: 122, tracks: { KICK: FOUR, CLAP: BACK, HAT2: OFF, HAT1: '----------x-----' } },
  { is: 'house', bpm: 126, tracks: { KICK: FOUR, SNARE: BACK, HAT2: OFF } },
  { is: 'hiphop', bpm: 92, swing: 0.25, tracks: { KICK: 'x--x------x-----', SNARE: BACK, HAT1: EIGHTS } },
  { is: 'hiphop', bpm: 86, swing: 0.2, tracks: { KICK: 'x------x-xx-----', SNARE: BACK, HAT1: 'x-x-x-xxx-x-x-x-' } },
  { is: 'techno', bpm: 138, tracks: { KICK: FOUR, HAT1: 'xxxxxxxxxxxxxxxx', PERC1: '--x--x--x--x--x-' } },
  { is: 'techno', bpm: 132, tracks: { KICK: FOUR, HAT1: '-xxx-xxx-xxx-xxx', CLAP: '------------x---' } },
];

export const RHYTHM = [
  {
    id: 'R1', line: 'rhythm', kind: 'explain', title: '跟稳', about: '每拍一下，看自己偏早还是偏晚', minutes: 3,
    say: '打碟对拍靠的就是这个：心里有个钟，每一下都落在它上面。',
    play: {
      toy: 'steady', bpm: 92,
      tip: '点「播放」，每“嘀”一声拍一下那块大垫子。看落下来的小点：在中线左边是**早了**，右边是**晚了**。',
      liveTip: '点「播放」，每“嘀”一声拍一下那块大垫子（在真机上按任意一个 Synth key 也算）。看落下来的小点：在中线左边是**早了**，右边是**晚了**。',
      name: '准不准是其次。**每一下都偏得一样多**，才叫稳。',
    },
    quiz: { toy: 'steady', bpm: 92, challenge: 8, ask: '连着拍，这次不给你看点，只用耳朵。铜 6 下、银 8 下、金 12 下。' },
    machine: {
      tasks: [
        {
          text: '打开机器自己的节拍器：**先按住**左上角的 [ALL] 旋钮**不放**，再按一下右侧面的 [BPM+]（右边那 4 个按钮里最上面的），然后都松开。右边那列小灯亮白色 = 开了。',
          simText: '打开机器自己的节拍器：**长按**左上角的 [ALL] 旋钮半秒，它出现黑圈；把面板**往左滑**，再点右侧面的 [BPM+]（右边那 4 个按钮里最上面的）。右边那列小灯亮 = 开了。',
          goal: '打开节拍器。',
          panel: ['ALL', 'BPM+'], detect: { kind: 'metronome', on: true }, manual: '开了', wait: '按住 [ALL]，再按 [BPM+]…',
        },
        PLAY('每拍“嘀”一声，每小节第一下音更高。'),
        { text: '跟着它，用手在桌上拍 8 下。', panel: [], manual: '拍完了' },
        STOP('节拍器想关掉：同样的动作再做一次。'),
      ],
      done: '以后练什么都可以先把它打开。',
    },
    takeaway: '稳，比准重要：每一下都偏得一样多，说明心里的钟走得匀。机器上**按住 [ALL] + [BPM+]** 是节拍器。',
    coach: '小课堂 R1「跟稳」：只有节拍器，每拍拍一下，看自己偏早还是偏晚、稳不稳（波动大小）。这位学生节奏感不错（真机上实测平均早 10 毫秒、波动 ±25 毫秒）。屏幕上点垫子会比真机多一点延迟，所以评分看的是波动，不是绝对早晚。机器上的节拍器：按住 [ALL] 旋钮的同时按 [BPM+]，Global Meter 白灯亮 = 开。',
    links: { lessons: ['1-1'], charts: ['pulse-kick'] },
    ask: [
      { q: '“稳”看的是什么？', a: ['每一下偏得一样多', '每一下都分毫不差', '拍得越快越好'], why: '偏得一样多，说明心里的钟走得匀。' },
      { q: '机器上的节拍器怎么开？', a: ['按住 [ALL]，再按 [BPM+]', '按两下 [PLAY]', '按住 [SWING]'], why: '按住 [ALL] + [BPM+]。' },
    ],
  },
  {
    id: 'R2', line: 'rhythm', kind: 'rhythm', title: '数出来', about: '“1 e & a”：边数边打', minutes: 4,
    say: '鼓手脑子里一直在念经：“1 e & a 2 e & a……”。念出来，再密的节奏也不乱，啾。',
    play: {
      toy: 'countalong', bpm: 84, pad: true,
      choices: [['一拍 2 下', 'x-x-x-x-x-x-x-x-'], ['一拍 4 下', 'xxxxxxxxxxxxxxxx'], ['混着来', 'x-x-xxxxx-x-xxxx']],
      sayMore: '念出声最好。',
      tip: '点「播放」，换到“混着来”。看灯，嘴里念下面那行字：亮着的念出来，暗着的在心里念。',
      name: '把一拍念成“**1 e & a**”，叫**数拍子**。念得出来，就打得出来。',
    },
    quiz: {
      toy: 'rhythm', ask: '跟着落下来的镲打：“1 & 2 e & a 3 & 4 e & a”。',
      title: '“1 & 2 e & a”', how: '底鼓每拍一下替你数着。镲的音符落到线上时，点它那条轨道底下的键帽。',
      chart: { id: 'r2-count', bpm: 84, bars: 1, loops: 4, lanes: { HAT1: 'x-x-xxxxx-x-xxxx' }, backing: { KICK: FOUR } },
    },
    machine: {
      edits: true,
      tasks: [
        PICK('HAT1'),
        STEPS('HAT1', [1, 3, 5, 6, 7, 8, 9, 11, 13, 14, 15, 16], '按亮第 **1、3、5、6、7、8** 个（上排），和第 **9、11、13、14、15、16** 个（下排）。别的按灭。', '就是刚才打的那一句。'),
        PLAY('边听边念“1 & 2 e & a”。'),
        STOP(),
      ],
      done: '每 4 个方键念一遍“1 e & a”：机器上的格子和嘴里念的是一回事。',
    },
    takeaway: '一拍念成“**1 e & a**”四个字：念得出，就打得出。机器上每 4 个方键对应这四个字。',
    coach: '小课堂 R2「数出来」：“1 e & a”数法（十六分音符的念法）。热身：一拍 2 下 / 4 下 / 混着来，灯下面写着念法；挑战用音游引擎打一小节闭镲“x-x-xxxxx-x-xxxx”（1 & 2 e & a 3 & 4 e & a），铜 85% 速度有示范音、银原速、金只剩节拍器。机器上：HAT 1 按同样的格子。',
    links: { lessons: ['1-2', '1-4'], charts: ['hat-eighths'] },
    ask: [
      { q: '“1 e & a”里，“&”在一拍的哪里？', a: ['正中间', '最开头', '最后面'], why: '“1 e & a”：& 是一拍的一半。' },
      { q: '机器上一拍对应几个方键？', a: ['4 个', '1 个', '16 个'], why: '每 4 个方键一拍，正好念“1 e & a”。' },
    ],
  },
  {
    id: 'R3', line: 'rhythm', kind: 'ear', title: '听一段，选图案', about: '把听到的节奏和 16 格的图对上', minutes: 4,
    say: '鼓点可以画成图：亮的格子有声音，暗的格子是空的。',
    play: {
      toy: 'gridplay', bpm: 104, pattern: 'x---x---x-x-----',
      tip: '点「播放」，再点格子：点亮一格，那里就多一下底鼓。这两排 16 个格子，和机器上那两排方键一模一样。',
      name: '看图知道它怎么响，听声音认得出是哪张图：这就是**读节奏**。',
    },
    quiz: {
      toy: 'pickpattern', bpm: 104, ask: '听一段底鼓，从三张图里把它挑出来。金那一档不给图：自己在格子上听写出来。',
      rounds: [
        { answer: 'x---x---x---x---', others: ['x-----x---x-----', 'x-------x-x-----'] },
        { answer: 'x---x---x-x-----', others: ['x---x---x---x---', 'x-x-----x---x---'] },
        { answer: 'x-----x---x-----', others: ['x--x--x---x-----', 'x-------x-x-----'] },
        { answer: 'x--x--x---x-----', others: ['x---x---x-x-----', 'x-x-----x---x---'] },
        { answer: 'x-------x-x-----', others: ['x-----x---x-----', 'x---x---x-x-----'] },
      ],
      tiers: [{}, {}, { toy: 'griddict', bpm: 100, need: 3 }],
    },
    machine: {
      edits: true,
      tasks: [
        PICK('KICK'),
        STEPS('KICK', [1, 5, 9, 11], '让左边那两排方键正好亮第 **1、5、9、11** 个（5 是上排第 5 个；9 和 11 是下排第 1、第 3 个）。别的亮着的，按一下把它按灭。'),
        PLAY('咚、咚、咚咚：和图上一样。'),
        STOP(),
      ],
      done: '你把一张图放进了机器。',
    },
    takeaway: '亮的格子有声音。16 格一小节，每 4 格一拍：看图读得出节奏，听声音认得出图。',
    coach: '小课堂 R3「听一段，选图案」：把听到的底鼓节奏和 16 步的图对上（图画成机器上 2 排 × 8 个方键的样子）。铜、银三选一（银要答对更多题），金改成格子听写（自己点出来）。机器上：选中 KICK，把步进键按成第 1、5、9、11 步，播放听。接着真机时，鼓轨的格子读得出来，会实时告诉他还差哪一步、多了哪一步。',
    links: { lessons: ['1-2', '1-5'], charts: ['pop-basic'] },
    ask: [
      { q: '16 个格子里，第 5 格是第几拍的开头？', a: ['第 2 拍', '第 5 拍', '第 3 拍'], why: '每 4 格一拍：第 1、5、9、13 格是四拍的开头。' },
    ],
  },
  {
    id: 'R4', line: 'rhythm', kind: 'rhythm', title: '只打缝里', about: '反拍：两拍中间的那一下', minutes: 4,
    say: '底鼓“咚”在拍子上，你只打它们中间的“嚓”。House 的那股往前冲的劲儿，全在这道缝里。',
    play: {
      toy: 'nudge', bpm: 118, track: 'HAT2', from: 0, base: { KICK: FOUR, CLAP: BACK },
      cap: '亮着的那一格是会挪的那一下开镲：点别的格子，它就搬过去',
      tip: '点「播放」。那一下开镲现在踩在拍子上（第 1 格）。点第 **3** 格把它挪进缝里，再点第 2、4 格试试：哪一格最想让你点头？',
      name: '落在两拍正中间的那一下，叫**反拍**（“&”）。底鼓在拍上、镲在反拍上：咚-嚓-咚-嚓。',
    },
    quiz: {
      toy: 'rhythm', ask: '只打反拍的开镲：底鼓“咚”的时候别动，“咚”和“咚”中间打。',
      title: '只打缝里', how: '底鼓和拍手替你放着，你只打开镲，它们都落在两个“咚”的正中间。',
      chart: { id: 'r4-off', bpm: 118, bars: 1, loops: 4, lanes: { HAT2: OFF }, backing: { KICK: FOUR, CLAP: BACK } },
    },
    machine: {
      edits: true,
      tasks: [
        PICK('HAT2'),
        STEPS('HAT2', [3, 7, 11, 15], '按亮第 **3、7、11、15** 个（上排第 3、7 个，下排第 3、7 个）：每拍正中间一下。'),
        PLAY('咚-嚓-咚-嚓。'),
        STOP(),
      ],
      done: '第 3、7、11、15 格：机器上反拍的位置，以后一眼就认得。',
    },
    takeaway: '**反拍**是两拍正中间的那一下（“&”）。机器上是每 4 个方键里的**第 3 个**：第 3、7、11、15 格。',
    coach: '小课堂 R4「只打缝里」：反拍（八分反拍）。原来乐理线的 T3「不踩在拍子上」前半段并进了这里。热身：一下开镲从正拍挪到反拍；挑战用音游引擎只打反拍开镲（底鼓四踩、二四拍手做伴奏），铜 85% 速度有示范音、银原速、金只剩节拍器。机器上：HAT 2 按第 3、7、11、15 步。',
    links: { lessons: ['1-4'], charts: ['hat-offbeat', 'house-kit'], songs: ['one-kiss'] },
    ask: [
      { q: '反拍在 16 格里是第几格？', a: ['第 3、7、11、15 格', '第 1、5、9、13 格', '第 2、4、6、8 格'], why: '每拍正中间：每 4 格里的第 3 格。' },
      { q: 'House 里的“咚-嚓”，嚓落在哪？', a: ['反拍', '正拍', '小节最后'], why: '底鼓在拍上，开镲在反拍上。' },
    ],
  },
  {
    id: 'R5', line: 'rhythm', kind: 'rhythm', title: '故意错开', about: '切分：抢一点、拖一点', minutes: 4,
    say: '节奏一直踩在拍子上，很稳，也很乖。故意抢半步、拖半步，人就想动了。啾，这叫“使坏”。',
    play: {
      toy: 'nudge', bpm: 96, track: 'KICK', from: 8, fixed: [0], base: { HAT1: EIGHTS, SNARE: BACK },
      cap: '第 1 格的底鼓不动；亮着的另一下可以挪：点别的格子，它就搬过去',
      tip: '点「播放」。第二下底鼓现在在第 9 格（第 3 拍上）。挪到第 **8** 格（抢一点）、第 **11** 格（拖一点）、第 **7** 格……哪一格最“使坏”？',
      name: '故意不落在拍子上、落在拍子前后的缝里，叫**切分**。流行歌里“动次-次动次”的感觉，就是它。',
    },
    quiz: {
      toy: 'rhythm', ask: '打“三、三、二”：底鼓落在第 1、4、7、9、12、15 格，一下也不踩在 2、3、4 拍上。',
      title: '三、三、二', how: '底鼓“咚--咚--咚-咚--咚--咚-”：三格、三格、两格。军鼓和镲替你放着。',
      chart: { id: 'r5-332', bpm: 96, bars: 1, loops: 4, lanes: { KICK: 'x--x--x-x--x--x-' }, backing: { SNARE: BACK, HAT1: EIGHTS } },
    },
    machine: {
      edits: true,
      tasks: [
        PICK('KICK'),
        STEPS('KICK', [1, 4, 7, 9, 12, 15], '按亮第 **1、4、7** 个（上排），和第 **9、12、15** 个（下排的第 1、4、7 个）。别的按灭。'),
        PLAY('三、三、二：一直在错开，一直想让人动。'),
        STOP(),
      ],
      done: '“三、三、二”在 Reggaeton、Afrobeats、好多流行歌里都有：现在你认得它了。',
    },
    takeaway: '**切分**就是故意不踩在拍子上：抢一点、拖一点。最常见的是“**三、三、二**”：第 1、4、7 格（再加第 9、12、15 格）。',
    coach: '小课堂 R5「故意错开」：切分。原来乐理线的 T3「不踩在拍子上」后半段并进了这里。热身：第二下底鼓在 16 格里挪，体会抢拍 / 拖拍；挑战用音游引擎打 3+3+2 的底鼓（x--x--x-x--x--x-），军鼓和八分镲伴奏。机器上：KICK 按第 1、4、7、9、12、15 步。',
    links: { lessons: ['1-5'], charts: ['dembow', 'boombap'], songs: ['shape-of-you'] },
    ask: [
      { q: '切分是什么意思？', a: ['故意不踩在拍子上', '每拍打两下', '越打越快'], why: '抢一点、拖一点，不落在拍子上。' },
      { q: '“三、三、二”是几格、几格、几格？', a: ['3、3、2', '4、4、4', '2、2、4'], why: '三格、三格、两格：一小节 8 格一半，重复两遍。' },
    ],
  },
  {
    id: 'R6', line: 'rhythm', kind: 'explain', title: '晃起来', about: '摇摆：直的和晃的各打一遍', minutes: 4,
    say: '同一个节奏，可以走得像机器人，也可以像蹦蹦跳跳的小孩。差别只有一点：每一对里的第二下，晚一点点。',
    play: {
      toy: 'swingfeel', bpm: 92,
      tip: '点「播放」，慢慢把滑条往右推。看那排小点：每一对里的第二个在往后躲。',
      name: '这个“往后躲”叫**摇摆**（Swing）。Hip-hop 和 House 里那种“松”的感觉，就是它。',
    },
    quiz: { toy: 'swingtap', bpm: 84, ask: '跟着底鼓，每拍拍两下：“嗒-嗒、嗒-嗒”。先拍一遍**直的**（两下一样匀），再拍一遍**晃的**（第二下晚一点）。金那一档没有示范的镲。' },
    machine: {
      edits: true,
      tasks: [
        PICK('HAT1'),
        { text: '把**上排 8 个方键全按亮**：一串连着的镲。', goal: '让 HAT 1 上排 8 个全亮。', panel: ['DK1', 'DK2', 'DK3', 'DK4', 'DK5', 'DK6', 'DK7', 'DK8'], detect: { kind: 'steps', track: 'HAT1', steps: [0, 1, 2, 3, 4, 5, 6, 7], atLeast: true }, wait: '等上排 8 个都亮…' },
        PLAY('让它放着。'),
        { text: '按几下右侧面的 [SWING]（右边那 4 个按钮里从上往下第 3 个，在 [BPM-] 下面）。镲开始一长一短。', simText: '把面板**往左滑**，点几下右侧面的 [SWING]（右边那 4 个按钮里从上往下第 3 个）。镲开始一长一短。', goal: '加一点摇摆。', panel: ['SWING', 'METER'], detect: { kind: 'swing', min: 1 }, wait: '等你按 [SWING]…' },
        {
          text: '归零：**先按住**左侧面的 [DELETE] **不放**，再按一下 [SWING]，然后都松开。',
          simText: '归零：把面板滑回最左边，**长按** [DELETE] 半秒，它出现黑圈；再滑到最右边点 [SWING]。',
          goal: '把摇摆归零。',
          panel: ['DELETE', 'SWING'], detect: { kind: 'swing', zero: true }, wait: '按住 [DELETE]，再按 [SWING]…',
        },
        STOP(),
      ],
      done: '摇摆是整首歌一起晃的：所有轨道都跟着。',
    },
    takeaway: '**摇摆**就是每一对里的第二下晚一点，晚得越多越“晃”。机器上按 [SWING] 加，**按住 [DELETE] + [SWING]** 归零。',
    coach: '小课堂 R6「晃起来」：摇摆（Swing）= 每对十六分音符里的后一个往后推。原来乐理线的 T4「摇一摇」并进了这里。学生先拖滑条听，再跟着底鼓每拍拍两下，直的一遍、晃的一遍（看第二下落在一拍的百分之几：50% 是直的，60% 以上算晃）；金那一档没有示范的镲。机器上：在 HAT 1 上铺一排镲，按 [SWING] 加摇摆（范围 −58 到 +58 ticks），按住 [DELETE] + [SWING] 归零。摇摆作用于整个工程。',
    links: { lessons: ['1-5'], charts: ['boombap', 'lofi-lazy'], songs: ['dance-monkey'] },
    ask: [
      { q: '摇摆是让每一对里的哪一下变晚？', a: ['第二下', '第一下', '两下都晚'], why: '第二下往后躲。' },
      { q: '机器上摇摆怎么归零？', a: ['按住 [DELETE] + [SWING]', '按两下 [SWING]', '按住 [PLAY]'], why: '按住 [DELETE] 再按 [SWING]。' },
    ],
  },
  {
    id: 'R7', line: 'rhythm', kind: 'rhythm', title: '两只手', about: '底鼓和军鼓分工', minutes: 4,
    say: '左手管“咚”，右手管“啪”：两只手各干各的，合起来就是一个鼓手。',
    play: {
      toy: 'twohands', bpm: 88, kick: 'x-------x-x-----', snare: BACK,
      tip: '点「播放」，左手拍“咚”那块、右手拍“啪”那块。看上面两排格子：亮的那一格轮到谁，谁就拍。',
      name: '底鼓在 1、3 拍附近，军鼓守着 **2、4 拍**：这叫**反拍军鼓**（backbeat），流行、Hip-hop 都靠它点头。',
    },
    quiz: {
      toy: 'rhythm', ask: '两条轨道一起打：左边底鼓、右边军鼓。',
      title: '咚 — 啪 — 咚咚 啪', how: '两条轨道：底鼓（第 1、9、11 格）和军鼓（第 5、13 格）。镲替你放着。',
      chart: { id: 'r7-two', bpm: 88, bars: 1, loops: 4, lanes: { KICK: 'x-------x-x-----', SNARE: BACK }, backing: { HAT1: EIGHTS } },
    },
    machine: {
      edits: true,
      tasks: [
        PICK('KICK'),
        STEPS('KICK', [1, 9, 11], '按亮第 **1** 个（上排），和第 **9、11** 个（下排第 1、3 个）。'),
        PICK('SNARE'),
        STEPS('SNARE', [5, 13], '按亮第 **5、13** 个（上排第 5 个，下排第 5 个）：第 2、4 拍。'),
        PLAY('咚 — 啪 — 咚咚 啪。'),
        STOP(),
      ],
      done: '这就是流行歌最常见的那套鼓：练习场里叫“流行基本鼓”，再加一排镲就是它。',
    },
    takeaway: '两只手分工：**底鼓**在 1、3 拍附近，**军鼓**守着 **2、4 拍**。机器上军鼓是第 5、13 个方键。',
    coach: '小课堂 R7「两只手」：底鼓和军鼓分工、反拍军鼓（2、4 拍）。热身是两块垫子（左底鼓、右军鼓）对着格子拍；挑战用音游引擎两条轨道一起打（KICK x-------x-x-----，SNARE 第 5、13 步，八分镲伴奏）。机器上：KICK 第 1、9、11 步，SNARE 第 5、13 步。和第 1 章 1.3 对应。',
    links: { lessons: ['1-3'], charts: ['kick-snare', 'pop-basic'], songs: ['blinding-lights'] },
    ask: [
      { q: '军鼓一般守着哪两拍？', a: ['2、4 拍', '1、3 拍', '只在第 1 拍'], why: '反拍军鼓：2、4 拍，让人点头。' },
      { q: '机器上第 2、4 拍是哪两个方键？', a: ['第 5、13 个', '第 2、4 个', '第 9、16 个'], why: '每 4 个方键一拍：第 5 个是第 2 拍，第 13 个是第 4 拍。' },
    ],
  },
  {
    id: 'R8', line: 'rhythm', kind: 'ear', title: '听律动，猜风格', about: 'House、Hip-hop、Techno 的鼓有什么不一样', minutes: 4,
    say: '你打碟时一耳朵就分得出 House 和 Hip-hop。靠的不是旋律，是鼓怎么摆。',
    play: {
      toy: 'grooves',
      tip: '三张牌，点哪张放哪张。盯着图看：底鼓落在哪几格、镲多不多、快还是慢。',
      name: '一种风格自己那套鼓的摆法，叫它的**律动**（groove）。',
    },
    quiz: { toy: 'guessgroove', ask: '听一段鼓：它是哪一种？' },
    machine: {
      edits: true,
      tasks: [
        PICK('KICK'),
        STEPS('KICK', [1, 5, 9, 13], '让方键正好亮第 **1、5、9、13** 个：每拍一下底鼓。别的亮着的按灭。'),
        PICK('HAT2'),
        STEPS('HAT2', [3, 7, 11, 15], '按亮第 **3、7、11、15** 个（上排第 3、第 7 个，下排第 3、第 7 个）：每两下底鼓中间夹一下开镲。'),
        PLAY('咚-嚓-咚-嚓：这就是 House 的骨架。'),
        { text: '用右侧面的 [BPM+] 和 [BPM-] 把速度调到 **120 到 128** 之间（按住不放会连续变；下面那行字会告诉你现在是多少）。', simText: '把面板**往左滑**，用右侧面的 [BPM+] 和 [BPM-] 把速度调到 **120 到 128** 之间（按住不放会连续变；下面那行字会告诉你现在是多少）。', goal: '速度调到 120–128。', panel: ['BPM+', 'BPM-'], detect: { kind: 'tempo', min: 120, max: 128 }, wait: '等速度到 120–128…' },
        STOP(),
      ],
      done: '底鼓每拍一下，开镲夹在中间，速度 124 上下：你做了一个 House 的鼓。',
    },
    grooves: GROOVES,
    variants: VARIANTS,
    takeaway: '风格藏在鼓的摆法里。**House**：每拍一下底鼓，中间夹开镲。**Hip-hop**：慢，底鼓不守规矩，带点晃。**Techno**：快、硬、镲很密。',
    coach: '小课堂 R8「听律动，猜风格」：House（120–128 BPM，四踩底鼓 + 反拍开镲 + 2、4 拍拍手）、Hip-hop（85–95 BPM，底鼓不规则，军鼓在 2、4 拍，带摇摆）、Techno（130–140 BPM，四踩底鼓，镲很密，机械感）。机器上：KICK 第 1、5、9、13 步，HAT 2 第 3、7、11、15 步，速度调到 120–128。',
    links: { lessons: ['1-4', '1-5'], charts: ['house-kit', 'boombap', 'techno-drive'], songs: ['animals', 'gangstas-paradise'] },
    ask: [
      { q: 'House 的速度大概多少？', a: ['120–128 BPM', '80–90 BPM', '170 以上'], why: 'House 一般 120–128。' },
      { q: '哪种风格的镲“密得像下雨”？', a: ['Techno', 'Hip-hop', 'House'], why: 'Techno：快、硬、镲很密。' },
    ],
  },
  {
    id: 'RB', line: 'rhythm', kind: 'boss', title: '节奏大关', about: '一套鼓、一段听写、一回猜风格', minutes: 5,
    say: '节奏线的大关，啾！先打一套三条轨道的鼓，再听写一段底鼓，最后猜风格。稳住。',
    quiz: {
      toy: 'relay', ask: '三段接力：打一套 House 鼓 → 听写底鼓 → 猜风格。',
      stages: [
        { toy: 'rhythm', title: '打一套 House 鼓', ask: '三条轨道一起打：底鼓、拍手、反拍镲。', how: '三条轨道：底鼓每拍一下、拍手在 2、4 拍、镲在反拍。', chart: { id: 'rb-house', bpm: 118, bars: 1, loops: 4, lanes: { KICK: FOUR, CLAP: BACK, HAT1: OFF } } },
        { toy: 'griddict', title: '听写底鼓', needs: [1, 1, 2], ask: '听底鼓，在格子上点出来。' },
        { toy: 'guessgroove', title: '猜风格', needs: [2, 3, 4], ask: '听一段鼓：House、Hip-hop 还是 Techno？' },
      ],
    },
    grooves: GROOVES,
    variants: VARIANTS,
    takeaway: '稳、数得出、听得出、打得出：节奏线的四样本事。机器上的 16 个方键，就是你的节奏本。',
    coach: '小课堂 RB「节奏大关」：节奏线的关底，三段接力：音游打三条轨道的 House 鼓组（铜 85% 速度有示范音、银原速、金只剩节拍器）、格子听写底鼓、猜风格。星星按最差的一段给。',
    links: { charts: ['house-kit', 'pop-basic', 'boombap'] },
    ask: [
      { q: '“稳”和“准”，哪个更要紧？', a: ['稳', '准', '一样'], why: '每一下偏得一样多，才是心里的钟走得匀。' },
    ],
  },
];
