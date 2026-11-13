// 小课堂：乐理、节奏、效果三条线。每关三五分钟，只讲一件事，固定四步：
//   一句话 say → 玩一玩 play → 试一试 quiz → 用在机器上 machine，最后一句“带走的话” takeaway。
// 方案和整张清单在 docs/training-plan.md。这里有内容的（带 play 的）是已经开放的关，其余只有名字，列表里显示“还没开放”。
//
// 写法上的规矩：短句、口语；先玩出感觉，再给它起名字（play.name 是玩过之后才出现的那句）；不出现五线谱，不先下定义。
// 机器上的操作一律以 docs/seqtrak-operation-reference.md 为准。text 是通用的说法，liveText 是接着真机时换用的说法，
// simText 是只在屏幕上的模拟机里才这么说的（模拟机上组合键是“长按第一个，出现黑圈，再点第二个”）。
// detect 是“这一步做到了”的条件，种类见 public/js/classroom-bench.js；没有 detect 的要自己点按钮（按钮上的字是 manual）。

export const LINES = [
  { id: 'theory', name: '乐理', sub: '音的高低、亮暗，和它们怎么叠', color: 'violet' },
  { id: 'rhythm', name: '节奏', sub: '跟稳、听出来、晃起来', color: 'accent' },
  { id: 'fx', name: '效果', sub: '同一个声音，换个样子', color: 'cyan' },
];

// ───────────── 机器上常用的几句话 ─────────────

const PLAY = (after = '') => ({
  text: `**短按**一下 [PLAY]（左侧面最下面那个键）。${after}`,
  liveText: `**短按**一下左侧面最下面的 [PLAY]：按一下就松，按住 2 秒是关机。${after}`,
  panel: ['PLAY'], detect: { kind: 'start' }, wait: '等你按 [PLAY]…',
});
const STOP = (after = '') => ({ text: `再**短按**一下 [PLAY]，停下。${after}`, panel: ['PLAY'], detect: { kind: 'stop' }, wait: '等你停下…' });
const KNOB = {
  KICK: '左边那块、上排左数第 2 个旋钮', HAT1: '左边那块、下排左数第 1 个旋钮', HAT2: '左边那块、下排左数第 2 个旋钮',
  SYNTH1: '中间那块、上排左边的旋钮', SYNTH2: '中间那块、上排右边的旋钮',
};
const LABEL = { KICK: 'KICK', HAT1: 'HAT 1', HAT2: 'HAT 2', SYNTH1: 'SYNTH 1', SYNTH2: 'SYNTH 2' };
const PICK = (track, after = '') => ({
  text: `按一下 **${LABEL[track]} 旋钮**（${KNOB[track]}）。只按，别转。${after}`,
  panel: [track], detect: { kind: 'track', track }, wait: `等你按 ${LABEL[track]} 旋钮…`,
});
const TO_MASTER = {
  text: '看右边桔红色那块：有个小拨动开关，左边写 MASTER，右边写 SINGLE。把它拨到 **MASTER**（左边）：接下来动的是**整台机器**的声音。',
  simText: '看右边桔红色那块：有个小拨动开关，左边写 MASTER，右边写 SINGLE。点它一下，看下面那行字，让它停在 **MASTER**：接下来动的是**整台机器**的声音。',
  panel: ['MASTERSINGLE'], detect: { kind: 'master' }, manual: '拨好了', wait: '等你拨到 MASTER…',
};
const FX_LEVEL = (after) => ({
  text: `开关下面那条竖着的触摸条是 [FX LEVEL]。手指按上去**上下滑**：${after}`,
  simText: `开关下面那条竖着的条是 [FX LEVEL]。按住它**上下拖**：${after}`,
  panel: ['FXLEVEL'], detect: { kind: 'fxlevel' }, wait: '等你滑 [FX LEVEL]…',
});
const CLEAR_FX = {
  text: '按一下 [CLEAR FX]（那一列正上方、机器上边沿的小按钮）：效果收到最小，回到原声。',
  panel: ['CLEARFX'], detect: { kind: 'clearfx' }, wait: '等你按 [CLEAR FX]…',
};
const FX_TO = (cat, after) => ({
  text: `转那一列最上面的 **[FX] 旋钮**（它下面印着 FX）。边转边看左边那列文字，亮的那一行会跟着换：转到 **${cat}** 亮就停。${after}`,
  simText: `按住那一列最上面的 **[FX] 旋钮**（它下面印着 FX）**上下拖**。边拖边看左边那列文字，亮的那一行会跟着换：拖到 **${cat}** 亮就停。${after}`,
  panel: ['FX', 'INDEX'], detect: { kind: 'fxtype', cat }, manual: `${cat} 亮了`, wait: `等 ${cat} 亮…`,
});

// ───────────── 三条线 ─────────────

export const LEVELS = [
  // ══════════ 乐理 ══════════
  {
    id: 'T1', line: 'theory', title: '四个一组', about: '拍子和小节', minutes: 3,
    say: '走路是“左、右、左、右”。音乐是“**1**、2、3、4”：四下一组，第一下最重。',
    play: {
      toy: 'beatwalk', bpm: 100,
      tip: '点「播放」，跟着数 1、2、3、4，在 **1** 上拍一下那块大垫子。再把「重音」关掉听听：还数得出哪个是 1 吗？',
      name: '这一下一下的，叫**拍**。四拍一组，叫一**小节**。',
    },
    quiz: { toy: 'findone', bpm: 100, need: 4, ask: '灯不亮了，只剩声音。听出最重的那一下，在它上面拍 **4 次**。' },
    machine: {
      tasks: [
        PLAY(),
        { text: '看屏幕上这台机器左边的**两排方键**：有一盏白灯在一个键一个键地走。它每走过 **4 个键**是一拍，**16 个键**走完是一小节，然后回到第 1 个。跟着数满两个小节。', panel: ['DRUMKEYS'], manual: '数到了' },
        STOP(),
      ],
      done: '那两排 16 个方键，就是一小节。',
    },
    takeaway: '一下一下的是**拍**，四拍一组是一**小节**。机器上 16 个方键 = 1 小节，每 4 个键 = 1 拍。',
    coach: '小课堂 T1「四个一组」：拍子和小节。学生跟着循环在第 1 拍上拍，体会“四拍一组、第一拍最重”；在机器上按 [PLAY]，看 16 个步进键上的走带：4 个键一拍，16 个键一小节。只讲 4/4，不讲拍号，不讲别的拍子。',
  },
  { id: 'T2', line: 'theory', title: '把一拍切开', about: '一拍里放 1 下、2 下、4 下' },
  { id: 'T3', line: 'theory', title: '不踩在拍子上', about: '反拍和切分：让人想动的地方' },
  { id: 'T4', line: 'theory', title: '摇一摇', about: '摇摆是怎么回事' },
  {
    id: 'T5', line: 'theory', title: '高和低', about: '音名和八度', minutes: 3,
    say: '同一个音，可以住在楼上，也可以住在楼下。名字一样，只是高了一层。',
    play: {
      toy: 'octaves',
      tip: '三层楼，每层 7 个键。随便点一个：楼上楼下和它**同名**的会一起亮。把亮着的从下到上挨个点一遍：像不像同一个人，换了个高度？',
      name: '音只有 7 个名字：C D E F G A B，数完又从 C 开始。同名的两个音隔着的这一层楼，叫一个**八度**。',
    },
    quiz: { toy: 'samename', need: 3, ask: '听两个音。第二个是不是第一个“搬到楼上”的样子？' },
    machine: {
      tasks: [
        PICK('SYNTH1'),
        { text: '按一下 **Synth key 1**：中间那两排键里，上排左数第 2 个（第 1 个带圆点的是录音键）。记住这个音。', panel: ['SK1'], detect: { kind: 'note', track: 'SYNTH1' }, wait: '等你按 Synth key 1…' },
        { text: '按一下 [OCTAVE]：机器**上边沿**那排 5 个小按钮里，左数第 2 个。右边那列小灯会换一盏亮。', panel: ['OCTAVE', 'METER'], detect: { kind: 'octave' }, wait: '等你按 [OCTAVE]…' },
        { text: '再按 **Synth key 1**：还是它，换了一层楼。', panel: ['SK1'], detect: { kind: 'note', track: 'SYNTH1' }, wait: '等你再按 Synth key 1…' },
      ],
      done: '同一个键，换了一层楼。想回原来那层：多按几下 [OCTAVE]（或者按住它、转左上角的 [ALL] 旋钮），让右边那列小灯回到**从下往上数第 4 盏**。',
    },
    takeaway: '音名只有 7 个，转一圈又回来。同名的音隔着一个**八度**：一样的味道，不同的高度。机器上 [OCTAVE] 是换楼层的键。',
    coach: '小课堂 T5「高和低」：音名（C D E F G A B 七个字母循环）和八度（同名的音，频率翻倍）。学生在一排键上点，同名的一起亮；在机器上选中 SYNTH 1，按同一个 Synth key，再按 [OCTAVE] 换八度。不讲黑键、半音（那是 T6）。手册没写单按 [OCTAVE] 是升还是降，所以只让他看右边那列小灯：自下而上是 −3 到 +2，第 4 盏是 0。',
  },
  { id: 'T6', line: 'theory', title: '一格和两格', about: '半音和全音' },
  {
    id: 'T7', line: 'theory', title: '亮和暗', about: '音阶：大调和小调', minutes: 4,
    say: '同一段旋律，换一把“梯子”爬，心情就变了：一把亮堂，一把发暗。',
    play: {
      toy: 'brightdark', bpm: 104, melody: [1, 3, 5, 3, 6, 5, 3, 1],
      tip: '点「播放」，然后来回拨那个大开关。旋律没换，只是梯子上有三级往下挪了半格。',
      name: '这把“梯子”叫**音阶**。亮的那把叫**大调**，暗的那把叫**小调**。',
    },
    quiz: {
      toy: 'majorminor', need: 3, ask: '听一小段：它是亮的，还是暗的？',
      melodies: [[1, 2, 3, 5, 3, 0, 1, 0], [5, 3, 1, 3, 6, 0, 5, 0], [1, 3, 5, 8, 7, 5, 3, 1], [3, 3, 2, 1, 6, 5, 3, 0], [8, 7, 6, 5, 3, 0, 1, 0]],
    },
    machine: {
      tasks: [
        PICK('SYNTH1'),
        { text: '把 7 个 **Synth keys** 从 1 到 7 挨个按一遍（上排是 ● 1 2 3，下排是 4 5 6 7）。机器现在多半在**小调**上：偏暗。', panel: ['SYNTHKEYS'], detect: { kind: 'note', track: 'SYNTH1', count: 5 }, wait: '挨个按…' },
        { text: '按 [SCALE]：上边沿那排小按钮里左数第 3 个。看右边那列 8 盏小灯：**最上面一盏是小调（MINOR），第 2 盏是大调（MAJOR）**。按到第 2 盏亮。', panel: ['SCALE', 'METER'], detect: { kind: 'scale', scale: 1 }, wait: '等大调（第 2 盏）亮…' },
        { text: '再把 7 个键按一遍：同样的 7 个键，亮起来了。', panel: ['SYNTHKEYS'], detect: { kind: 'note', track: 'SYNTH1', count: 5 }, wait: '挨个按…' },
        { text: '听完用 [SCALE] 按回**最上面那盏**（小调）：后面的课都用它。', panel: ['SCALE', 'METER'], detect: { kind: 'scale', scale: 0 }, wait: '等小调（最上面那盏）亮…' },
      ],
      done: '7 个键没换，换的是它们底下那把梯子。',
    },
    takeaway: '**音阶**是一把梯子，规定了能踩哪几个音。**大调**亮，**小调**暗。机器上 7 个键就是梯子的 7 级，[SCALE] 换梯子。',
    coach: '小课堂 T7「亮和暗」：音阶、大调和小调。同一段旋律一键切大调 / 小调（第 3、6、7 级降半音）；在机器上选中 SYNTH 1，把 7 个 Synth keys 弹一遍，用 [SCALE] 换到 MAJOR 再弹，最后换回 MINOR。Global Meter 自上而下第 1 盏是 MINOR、第 2 盏是 MAJOR。不讲调号、不讲音程名称。',
  },
  { id: 'T8', line: 'theory', title: '怎么按都不难听', about: '五声音阶' },
  { id: 'T9', line: 'theory', title: '两个音的距离', about: '三度甜、五度稳' },
  {
    id: 'T10', line: 'theory', title: '三个音叠起来', about: '和弦：大的亮，小的暗', minutes: 4,
    say: '一个音是一根线。三个音叠在一起，就成了一块颜色。',
    play: {
      toy: 'stack',
      tip: '点下面任意一个键当“地基”。看它怎么叠：**隔一个，拿一个**，叠三层。换个地基再叠，颜色会变。',
      name: '叠出来的这一摞叫**和弦**。听着亮的是**大和弦**，听着暗的是**小和弦**。',
    },
    quiz: { toy: 'oddchord', need: 3, ask: '三张牌，每张是一个和弦。点牌来听，把**不一样**的那张找出来。' },
    machine: {
      tasks: [
        PICK('SYNTH2'),
        {
          text: '找到右边桔红色那块里**竖着的 4 个旋钮**，慢慢转**从上往下数第 2 个**，转到左边那列文字里的 “CHORD” 亮。',
          simText: '找到右边桔红色那块里**竖着的 4 个旋钮**，按住**从上往下数第 2 个**往上拖，拖到左边那列文字里的 “CHORD” 亮。',
          panel: ['SD2', 'INDEX'], detect: { kind: 'polymode', track: 'SYNTH2', mode: 2 }, wait: '等 CHORD 亮…',
          assist: { label: '替我切到 CHORD', polymode: ['SYNTH2', 2] },
        },
        { text: '按一下 **Synth key 1**（中间两排键里上排左数第 2 个）：一个键，出来一整摞。', panel: ['SK1'], detect: { kind: 'chord', track: 'SYNTH2', min: 3 }, wait: '等你按一个键…' },
        { text: '从 1 到 7 换着按：有的亮，有的暗。', panel: ['SYNTHKEYS'], detect: { kind: 'chord', track: 'SYNTH2', min: 3, count: 3 }, wait: '再按几个…' },
      ],
      done: '这条轨道现在一个键就是一个和弦。想变回一次一个音：把那个旋钮往回转到 “MONO/POLY” 亮。',
    },
    takeaway: '从一个音起，**隔一个拿一个**，叠三层，就是**和弦**。大的亮，小的暗。机器上把那个旋钮转到 CHORD，一个键就是一整摞。',
    coach: '小课堂 T10「三个音叠起来」：和弦是“隔一个拿一个”叠出来的三个音；大三和弦亮、小三和弦暗。这是第 3 章 3.1 / 3.2 的三分钟精简版。在机器上：选中 SYNTH 2，把右边 4 个 Sound Design 旋钮里的第 2 个转到 CHORD，一个 Synth key 就是一个和弦（机器上每个键其实是 4 个音）。提醒：这个设定是存在音色里的，换了音色会被冲掉。',
  },
  { id: 'T11', line: 'theory', title: '四个和弦走天下', about: '最常见的和弦进行' },
  { id: 'T12', line: 'theory', title: '整首歌搬个家', about: '调和移调' },
  { id: 'T13', line: 'theory', title: '一首歌的形状', about: '铺垫、高潮和几小节一段' },

  // ══════════ 节奏 ══════════
  {
    id: 'R1', line: 'rhythm', title: '跟稳', about: '每拍一下，看自己偏早还是偏晚', minutes: 3,
    say: '打碟对拍靠的就是这个：心里有个钟，每一下都落在它上面。',
    play: {
      toy: 'steady', bpm: 92,
      tip: '点「播放」，每“嘀”一声拍一下那块大垫子。看落下来的小点：在中线左边是**早了**，右边是**晚了**。',
      liveTip: '点「播放」，每“嘀”一声拍一下那块大垫子（在真机上按任意一个 Synth key 也算）。看落下来的小点：在中线左边是**早了**，右边是**晚了**。',
      name: '准不准是其次。**每一下都偏得一样多**，才叫稳。',
    },
    quiz: { toy: 'steady', bpm: 92, challenge: 8, ask: '连着拍 **8 下**，这次不给你看点，只用耳朵。' },
    machine: {
      tasks: [
        {
          text: '打开机器自己的节拍器：**先按住**左上角的 [ALL] 旋钮**不放**，再按一下右侧面的 [BPM+]（右边那 4 个按钮里最上面的），然后都松开。右边那列小灯亮白色 = 开了。',
          simText: '打开机器自己的节拍器：**长按**左上角的 [ALL] 旋钮半秒，它出现黑圈；把面板**往左滑**，再点右侧面的 [BPM+]（右边那 4 个按钮里最上面的）。右边那列小灯亮 = 开了。',
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
  },
  { id: 'R2', line: 'rhythm', title: '数出来', about: '“1 e & a”：边数边打' },
  {
    id: 'R3', line: 'rhythm', title: '听一段，选图案', about: '把听到的节奏和 16 格的图对上', minutes: 4,
    say: '鼓点可以画成图：亮的格子有声音，暗的格子是空的。',
    play: {
      toy: 'gridplay', bpm: 104, pattern: 'x---x---x-x-----',
      tip: '点「播放」，再点格子：点亮一格，那里就多一下底鼓。这两排 16 个格子，和机器上那两排方键一模一样。',
      name: '看图知道它怎么响，听声音认得出是哪张图：这就是**读节奏**。',
    },
    quiz: {
      toy: 'pickpattern', bpm: 104, need: 3, ask: '听一段底鼓，从三张图里把它挑出来。',
      rounds: [
        { answer: 'x---x---x---x---', others: ['x-----x---x-----', 'x-------x-x-----'] },
        { answer: 'x---x---x-x-----', others: ['x---x---x---x---', 'x-x-----x---x---'] },
        { answer: 'x-----x---x-----', others: ['x--x--x---x-----', 'x-------x-x-----'] },
        { answer: 'x--x--x---x-----', others: ['x---x---x-x-----', 'x-x-----x---x---'] },
        { answer: 'x-------x-x-----', others: ['x-----x---x-----', 'x---x---x-x-----'] },
      ],
    },
    machine: {
      edits: true,
      tasks: [
        PICK('KICK'),
        { text: '让左边那两排方键正好亮第 **1、5、9、11** 个（5 是上排第 5 个；9 和 11 是下排第 1、第 3 个）。别的亮着的，按一下把它按灭。', panel: ['DK1', 'DK5', 'DK9', 'DK11'], detect: { kind: 'steps', track: 'KICK', steps: [0, 4, 8, 10] }, wait: '等这 4 个亮…' },
        PLAY('咚、咚、咚咚：和图上一样。'),
        STOP(),
      ],
      done: '你把一张图放进了机器。',
    },
    takeaway: '亮的格子有声音。16 格一小节，每 4 格一拍：看图读得出节奏，听声音认得出图。',
    coach: '小课堂 R3「听一段，选图案」：把听到的底鼓节奏和 16 步的图对上（图画成机器上 2 排 × 8 个方键的样子）。机器上：选中 KICK，把步进键按成第 1、5、9、11 步，播放听。接着真机时，鼓轨的格子读得出来，会实时告诉他还差哪一步、多了哪一步。',
  },
  { id: 'R4', line: 'rhythm', title: '只打缝里', about: '反拍' },
  { id: 'R5', line: 'rhythm', title: '故意错开', about: '切分' },
  {
    id: 'R6', line: 'rhythm', title: '晃起来', about: '摇摆：直的和晃的各打一遍', minutes: 4,
    say: '同一个节奏，可以走得像机器人，也可以像蹦蹦跳跳的小孩。差别只有一点：每一对里的第二下，晚一点点。',
    play: {
      toy: 'swingfeel', bpm: 92,
      tip: '点「播放」，慢慢把滑条往右推。看那排小点：每一对里的第二个在往后躲。',
      name: '这个“往后躲”叫**摇摆**（Swing）。Hip-hop 和 House 里那种“松”的感觉，就是它。',
    },
    quiz: { toy: 'swingtap', bpm: 84, ask: '跟着底鼓，每拍拍两下：“嗒-嗒、嗒-嗒”。先拍一遍**直的**（两下一样匀），再拍一遍**晃的**（第二下晚一点）。' },
    machine: {
      edits: true,
      tasks: [
        PICK('HAT1'),
        { text: '把**上排 8 个方键全按亮**：一串连着的镲。', panel: ['DK1', 'DK2', 'DK3', 'DK4', 'DK5', 'DK6', 'DK7', 'DK8'], detect: { kind: 'steps', track: 'HAT1', steps: [0, 1, 2, 3, 4, 5, 6, 7], atLeast: true }, wait: '等上排 8 个都亮…' },
        PLAY('让它放着。'),
        { text: '按几下右侧面的 [SWING]（右边那 4 个按钮里从上往下第 3 个，在 [BPM-] 下面）。镲开始一长一短。', simText: '把面板**往左滑**，点几下右侧面的 [SWING]（右边那 4 个按钮里从上往下第 3 个）。镲开始一长一短。', panel: ['SWING', 'METER'], detect: { kind: 'swing', min: 1 }, wait: '等你按 [SWING]…' },
        {
          text: '归零：**先按住**左侧面的 [DELETE] **不放**，再按一下 [SWING]，然后都松开。',
          simText: '归零：把面板滑回最左边，**长按** [DELETE] 半秒，它出现黑圈；再滑到最右边点 [SWING]。',
          panel: ['DELETE', 'SWING'], detect: { kind: 'swing', zero: true }, wait: '按住 [DELETE]，再按 [SWING]…',
        },
        STOP(),
      ],
      done: '摇摆是整首歌一起晃的：所有轨道都跟着。',
    },
    takeaway: '**摇摆**就是每一对里的第二下晚一点，晚得越多越“晃”。机器上按 [SWING] 加，**按住 [DELETE] + [SWING]** 归零。',
    coach: '小课堂 R6「晃起来」：摇摆（Swing）= 每对十六分音符里的后一个往后推。学生先拖滑条听，再跟着底鼓每拍拍两下，直的一遍、晃的一遍（看第二下落在一拍的百分之几：50% 是直的，60% 以上算晃）。机器上：在 HAT 1 上铺一排镲，按 [SWING] 加摇摆（范围 −58 到 +58 ticks），按住 [DELETE] + [SWING] 归零。摇摆作用于整个工程。',
  },
  { id: 'R7', line: 'rhythm', title: '两只手', about: '底鼓和军鼓分工' },
  {
    id: 'R8', line: 'rhythm', title: '听律动，猜风格', about: 'House、Hip-hop、Techno 的鼓有什么不一样', minutes: 4,
    say: '你打碟时一耳朵就分得出 House 和 Hip-hop。靠的不是旋律，是鼓怎么摆。',
    play: {
      toy: 'grooves',
      tip: '三张牌，点哪张放哪张。盯着图看：底鼓落在哪几格、镲多不多、快还是慢。',
      name: '一种风格自己那套鼓的摆法，叫它的**律动**（groove）。',
    },
    quiz: { toy: 'guessgroove', need: 3, ask: '听一段鼓：它是哪一种？' },
    machine: {
      edits: true,
      tasks: [
        PICK('KICK'),
        { text: '让方键正好亮第 **1、5、9、13** 个：每拍一下底鼓。别的亮着的按灭。', panel: ['DK1', 'DK5', 'DK9', 'DK13'], detect: { kind: 'steps', track: 'KICK', steps: [0, 4, 8, 12] }, wait: '等这 4 个亮…' },
        PICK('HAT2'),
        { text: '按亮第 **3、7、11、15** 个（上排第 3、第 7 个，下排第 3、第 7 个）：每两下底鼓中间夹一下开镲。', panel: ['DK3', 'DK7', 'DK11', 'DK15'], detect: { kind: 'steps', track: 'HAT2', steps: [2, 6, 10, 14] }, wait: '等这 4 个亮…' },
        PLAY('咚-嚓-咚-嚓：这就是 House 的骨架。'),
        { text: '用右侧面的 [BPM+] 和 [BPM-] 把速度调到 **120 到 128** 之间（按住不放会连续变；下面那行字会告诉你现在是多少）。', simText: '把面板**往左滑**，用右侧面的 [BPM+] 和 [BPM-] 把速度调到 **120 到 128** 之间（按住不放会连续变；下面那行字会告诉你现在是多少）。', panel: ['BPM+', 'BPM-'], detect: { kind: 'tempo', min: 120, max: 128 }, wait: '等速度到 120–128…' },
        STOP(),
      ],
      done: '底鼓每拍一下，开镲夹在中间，速度 124 上下：你做了一个 House 的鼓。',
    },
    grooves: {
      house: { name: 'House', bpm: 124, mark: '每拍一下底鼓，中间夹一下开镲', tracks: { KICK: 'x---x---x---x---', CLAP: '----x-------x---', HAT2: '--x---x---x---x-' } },
      hiphop: { name: 'Hip-hop', bpm: 88, swing: 0.22, mark: '慢。底鼓不守规矩，军鼓守着 2、4 拍，带点晃', tracks: { KICK: 'x------x--x-----', SNARE: '----x-------x---', HAT1: 'x-x-x-x-x-x-x-x-' } },
      techno: { name: 'Techno', bpm: 134, mark: '快、硬。底鼓每拍一下，镲密得像下雨', tracks: { KICK: 'x---x---x---x---', HAT1: 'x-xxx-xxx-xxx-xx', PERC1: '---x--x---x--x--' } },
    },
    variants: [
      { is: 'house', bpm: 122, tracks: { KICK: 'x---x---x---x---', CLAP: '----x-------x---', HAT2: '--x---x---x---x-', HAT1: '----------x-----' } },
      { is: 'house', bpm: 126, tracks: { KICK: 'x---x---x---x---', SNARE: '----x-------x---', HAT2: '--x---x---x---x-' } },
      { is: 'hiphop', bpm: 92, swing: 0.25, tracks: { KICK: 'x--x------x-----', SNARE: '----x-------x---', HAT1: 'x-x-x-x-x-x-x-x-' } },
      { is: 'hiphop', bpm: 86, swing: 0.2, tracks: { KICK: 'x------x-xx-----', SNARE: '----x-------x---', HAT1: 'x-x-x-xxx-x-x-x-' } },
      { is: 'techno', bpm: 138, tracks: { KICK: 'x---x---x---x---', HAT1: 'xxxxxxxxxxxxxxxx', PERC1: '--x--x--x--x--x-' } },
      { is: 'techno', bpm: 132, tracks: { KICK: 'x---x---x---x---', HAT1: '-xxx-xxx-xxx-xxx', CLAP: '------------x---' } },
    ],
    takeaway: '风格藏在鼓的摆法里。**House**：每拍一下底鼓，中间夹开镲。**Hip-hop**：慢，底鼓不守规矩，带点晃。**Techno**：快、硬、镲很密。',
    coach: '小课堂 R8「听律动，猜风格」：House（120–128 BPM，四踩底鼓 + 反拍开镲 + 2、4 拍拍手）、Hip-hop（85–95 BPM，底鼓不规则，军鼓在 2、4 拍，带摇摆）、Techno（130–140 BPM，四踩底鼓，镲很密，机械感）。机器上：KICK 第 1、5、9、13 步，HAT 2 第 3、7、11、15 步，速度调到 120–128。',
  },

  // ══════════ 效果 ══════════（清单按这台机器实际有的效果核对过，见 docs/training-plan.md）
  {
    id: 'F1', line: 'fx', title: '干的和湿的', about: '效果是什么：原声和加了效果，一键对比', minutes: 3,
    say: '原声像白开水。效果是往里加的东西：加一点提味，加多了就齁。',
    play: {
      toy: 'fxlab', lab: { choices: ['delay', 'reverb', 'lowpass'], loop: 'room', amount: 0.55 },
      tip: '点「播放」。按住右边那条竖条**上下滑**：这是“加多少”。再来回点「原声」和「加效果」，换一种效果也试试。',
      name: '没加效果的叫**干声**，加了的叫**湿声**。那条竖条管的就是“多湿”。',
    },
    quiz: { toy: 'drywet', need: 3, ask: '只用耳朵：现在放的是原声，还是加了效果？' },
    machine: {
      fx: true,
      tasks: [
        PLAY('先让机器出点声音。'),
        TO_MASTER,
        FX_LEVEL('听声音变了没有。变成什么样，要看机器现在选的是哪种效果，后面几关一个一个认。'),
        CLEAR_FX,
        STOP(),
      ],
      done: '一条竖条管“加多少”，一个键回到原声：这两样以后每种效果都用得上。',
    },
    takeaway: '**干**是原声，**湿**是加了效果。机器上 [FX LEVEL] 那条竖条管“加多少”，[CLEAR FX] 一键回到原声。',
    coach: '小课堂 F1「干的和湿的」：效果是什么。原声 = 干，加了效果 = 湿，[FX LEVEL] 触摸滑条管加多少。机器上：[MASTER/SINGLE] 开关拨到 MASTER（作用于全部轨道的 master effect；SINGLE 是只管当前选中的那条轨道），手指在 [FX LEVEL] 上滑，[CLEAR FX] 把当前效果的参数降到最小。效果种类用 [FX] 旋钮换，8 类 × 8 个预设，后面的关再讲。',
  },
  {
    id: 'F2', line: 'fx', title: '把声音捂住', about: '低通滤波器', minutes: 4,
    say: '隔着一扇门听隔壁的派对：咚咚的低音还在，亮的、脆的全被门挡住了。DJ 台上那个 FILTER 旋钮往左拧，关的就是这扇门。',
    play: {
      toy: 'fxlab', lab: { effect: 'lowpass', amount: 0.15 },
      tip: '点「播放」，把右边那条竖条**往上推**：门慢慢关上。看画面：右边（高音）的柱子一根根倒下去。',
      name: '这扇门叫**低通滤波器**：低的放过去，高的拦下来。',
    },
    quiz: { toy: 'matchcut', ask: '先听目标，再把竖条推到听起来**一样闷**的地方。一共三次。' },
    machine: {
      fx: true,
      tasks: [
        PLAY('让它放着。'),
        { ...PICK('HAT1'), text: '按一下 **HAT 1 旋钮**（左边那块、下排左数第 1 个）。只按，别转。我们来捂镲，它最明显；机器里没有镲声的话，按一条有声音的轨道也行。', detect: { kind: 'track' } },
        {
          text: '右边桔红色那块，竖着的 4 个旋钮**正下方**、靠近你这一边的边沿上，有个印着一排三个小点的小键。**按一下**：这 4 个旋钮翻到了第 2 页（右边那列小灯，从上往下第 2 盏亮）。',
          panel: ['SDPAGE', 'METER'], detect: { kind: 'sdpage', page: 1 }, wait: '等翻到第 2 页…',
        },
        {
          text: '慢慢转那 4 个旋钮里**从上往下数第 3 个**。往一边转，声音越来越闷，这就是“捂住”；往另一边转是把低音抽走，那是以后的一关。左边那列文字里 “FILTER” 会亮。',
          simText: '按住那 4 个旋钮里**从上往下数第 3 个**，**往下拖**：声音越来越闷，这就是“捂住”。往上拖是把低音抽走，那是以后的一关。左边那列文字里 “FILTER” 会亮。',
          panel: ['SD3', 'INDEX'], detect: { kind: 'filter' }, wait: '等你转第 3 个旋钮…',
        },
        {
          text: '往回转，转到声音变回原来那么亮。然后**再按一下那个三个小点的键**，翻回第 1 页：不翻回来，下次想换音色会转错旋钮。',
          panel: ['SD3', 'SDPAGE'], detect: { kind: 'sdpage', page: 0 }, wait: '等翻回第 1 页…',
        },
        STOP(),
      ],
      done: '每条轨道都有自己的这扇门：刚才你只捂住了一条，别的没动。',
    },
    takeaway: '**低通滤波器**是一扇门：关上它，亮的、脆的被挡住，只剩闷闷的低音。机器上它在右边 4 个旋钮的**第 2 页、第 3 个**，每条轨道各有一扇。',
    coach: '小课堂 F2「把声音捂住」：低通滤波器。截止频率往下走，高频被削掉。机器上每条轨道有自己的 LP-HP FILTER：Sound Design 旋钮按 Sound Design Page 键翻到第 2 页，第 3 个旋钮是 CUTOFF（Index 上 FILTER 亮），第 4 个是 RESONANCE。这个旋钮是“低通—原样—高通”连在一起的，哪边是低通手册没写，所以让他转着听。做完要翻回第 1 页。另一条路是 [FX] 旋钮选 FILTER 类的预设（LPF / HPF 各 4 个）。',
  },
  { id: 'F3', line: 'fx', title: '把低音抽走', about: '高通滤波器：机器上那条 [HIGH PASS] 触摸条' },
  { id: 'F4', line: 'fx', title: '那一声“喵”', about: '共鸣' },
  {
    id: 'F5', line: 'fx', title: '房间有多大', about: '混响', minutes: 4,
    say: '在浴室里拍手和在山洞里拍手，手是同一双，尾巴不一样长。',
    play: {
      toy: 'fxlab', lab: { effect: 'reverb', rooms: true, amount: 0.6 },
      tip: '点「播放」，换着点「小房间」「大厅」「山洞」。看画面：每一下后面拖出来的那片彩色，就是尾巴。竖条管加多少。',
      name: '这条尾巴叫**混响**。房间越大，尾巴越长，声音越“远”。',
    },
    quiz: { toy: 'whichroom', need: 3, ask: '听一段：它在哪个房间里？' },
    machine: {
      fx: true,
      tasks: [
        PLAY('让它放着。'),
        TO_MASTER,
        FX_TO('REVERB', '这一类里有 8 个大小不同的房间，接着转就是换房间。'),
        FX_LEVEL('把整首歌推进房间里，再拉出来。'),
        CLEAR_FX,
        STOP(),
      ],
      done: '[FX] 旋钮选“哪种”，[FX LEVEL] 管“多少”。',
    },
    takeaway: '**混响**是声音在房间里拖的尾巴：房间越大，尾巴越长。机器上把 [FX] 旋钮转到 REVERB，用 [FX LEVEL] 决定进去多深。',
    coach: '小课堂 F5「房间有多大」：混响 = 声音在空间里的尾巴，房间越大尾巴越长。机器上：[MASTER/SINGLE] 拨到 MASTER，转 [FX] 旋钮到 Index 上 REVERB 亮（8 个预设：SMALL ROOM 1 / 2、MID ROOM、SMALL HALL、MID HALL、STAGE、GATED REVERB、REVERSE REVERB），[FX LEVEL] 管量，[CLEAR FX] 收回。另外机器还有一路全部轨道共用的“发送混响”，每条轨道送多少在 Sound Design 的进阶第 3 页或 Mixer 模式里调，这一关不讲。',
  },
  {
    id: 'F6', line: 'fx', title: '踩在拍子上的回声', about: '延迟', minutes: 4,
    say: '对着山谷喊一声，它会喊回来。音乐里的回声更听话：正好踩着拍子回来。',
    play: {
      toy: 'fxlab', lab: { effect: 'delay', echoes: true, amount: 0.65 },
      tip: '点「播放」。每小节只“嗒”一下，后面跟回来的都是回声。换着点「一拍一次」「半拍一次」「错开着回」，数一数它踩在哪儿。',
      name: '这种回声叫**延迟**（Delay）。隔多久回来一次，是跟着速度算的。',
    },
    quiz: { toy: 'whichecho', need: 3, ask: '听一段：回声多久回来一次？' },
    machine: {
      fx: true,
      tasks: [
        PLAY('让它放着。'),
        TO_MASTER,
        FX_TO('DELAY', '它排在 REVERB 的下一类。这一类的第 1 种，回声正好一拍回来一次。'),
        FX_LEVEL('回声多了还是少了？'),
        CLEAR_FX,
        STOP(),
      ],
      done: '回声是跟着机器的速度走的：你改 BPM，它也跟着变快变慢。',
    },
    takeaway: '**延迟**是踩着拍子回来的回声：一拍一次最稳，错开着回会自己跳起舞来。机器上把 [FX] 旋钮转到 DELAY。',
    coach: '小课堂 F6「踩在拍子上的回声」：延迟（Delay）= 隔一段时间重复一遍，时间跟着速度算。机器上：[MASTER/SINGLE] 拨到 MASTER，转 [FX] 旋钮到 Index 上 DELAY 亮（8 个预设：TEMPO DELAY 4TH、PING PONG DELAY 4TH、TEMPO DELAY 8TH DOT、TEMPO DELAY 8TH、PING PONG DELAY 8TH、TEMPO DELAY 16TH、ANALOG DELAY - MODERN / RETRO），[FX LEVEL] 管量。“错开着回”对应的是 8TH DOT（附点八分）。',
  },
  { id: 'F7', line: 'fx', title: '弄脏它', about: '失真' },
  { id: 'F8', line: 'fx', title: '让底鼓先走', about: '压缩和躲闪：那种一吸一吸的感觉' },
  { id: 'F9', line: 'fx', title: '切碎了重复', about: '重复器：机器上那条 [REPEATER] 触摸条' },
  { id: 'F10', line: 'fx', title: '晃动的声音', about: '调制：合唱、镶边、颤音' },
  { id: 'F11', line: 'fx', title: '做一次铺垫', about: '现场怎么把气氛推上去，再一把放开' },
];

export const levelById = (id) => LEVELS.find((l) => l.id === id) || null;
export const isOpen = (level) => !!level?.play;
export const OPEN_LEVELS = LEVELS.filter(isOpen);

/** 同一条线上，这一关后面第一个开放了的关（没有就是 null） */
export function nextOpen(id) {
  const i = LEVELS.findIndex((l) => l.id === id);
  if (i < 0) return null;
  return LEVELS.slice(i + 1).find((l) => l.line === LEVELS[i].line && isOpen(l)) || null;
}
