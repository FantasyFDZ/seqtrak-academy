// 小课堂 · 效果线（12 关）。写法见 content/classroom.js 开头。清单按这台机器实际有的效果核对过（docs/training-plan.md）。
// 2026-11-15：新开 F3、F4、F7–F11 和关底大关 FB。效果实验台（fxlab.js）为它们加了共鸣、失真、躲闪、重复器、颤音、镶边、合唱；
// 效果模拟机（classroom-bench.js 的 FxSim）的 [HIGH PASS]、[REPEATER] 两条触摸条、[FX] 旋钮的后几类、第 2 页第 4 个旋钮（共鸣）也会响了。
import { PLAY, STOP, PICK, TO_MASTER, FX_LEVEL, CLEAR_FX, FX_TO } from './classroom-bits.js';

const HP_HOLD = {
  text: '右下角那块桔红色里，竖着两条触摸条：**左边那条是 [HIGH PASS]**。手指按上去**往上推**：低音被一点点抽走，声音越来越“薄”。',
  simText: '右下角那块桔红色里，竖着两条：**左边那条是 [HIGH PASS]**。按住它**往上拖**：低音被一点点抽走，声音越来越“薄”。',
  goal: '把低音抽走。',
  panel: ['HIGHPASS'], detect: { kind: 'highpass', min: 0.35 }, wait: '按住 [HIGH PASS] 往上推…',
};
const HP_RELEASE = { text: '**松手**：一下回到原样。这条是给现场用的，手离开就复原。', goal: '回到原样。', panel: ['HIGHPASS'], detect: { kind: 'highpass', release: true }, wait: '松手…' };
const REP_HOLD = {
  text: '右边那条是 **[REPEATER]**。按住它：最后那一小段被切下来反复放。手指越往上，切得越碎。',
  simText: '右边那条是 **[REPEATER]**。按住它（上下拖着试）：最后那一小段被切下来反复放。越往上切得越碎。',
  goal: '把声音切碎了反复。',
  panel: ['REPEATER'], detect: { kind: 'repeater' }, wait: '按住 [REPEATER]…',
};
const REP_RELEASE = { text: '**松手**：接着往下放，像什么都没发生。', goal: '松手，接着放。', panel: ['REPEATER'], detect: { kind: 'repeater', release: true }, wait: '松手…' };

export const FX = [
  {
    id: 'F1', line: 'fx', kind: 'explain', title: '干的和湿的', about: '效果是什么：原声和加了效果，一键对比', minutes: 3,
    say: '原声像白开水。效果是往里加的东西：加一点提味，加多了就齁。',
    play: {
      toy: 'fxlab', lab: { choices: ['delay', 'reverb', 'lowpass'], loop: 'room', amount: 0.55 },
      tip: '点「播放」。按住右边那条竖条**上下滑**：这是“加多少”。再来回点「原声」和「加效果」，换一种效果也试试。',
      name: '没加效果的叫**干声**，加了的叫**湿声**。那条竖条管的就是“多湿”。',
    },
    quiz: { toy: 'drywet', ask: '只用耳朵：现在放的是原声，还是加了效果？银、金那两档加得更少，更难听出来。' },
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
    links: { lessons: ['7-1'] },
    ask: [
      { q: '“湿声”是什么？', a: ['加了效果的声音', '原来的声音', '声音太小'], why: '干是原声，湿是加了效果。' },
      { q: '机器上一键回到原声的是？', a: ['[CLEAR FX]', '[FX LEVEL]', '[UNDO]'], why: '[CLEAR FX] 把效果收到最小。' },
    ],
  },
  {
    id: 'F2', line: 'fx', kind: 'explain', title: '把声音捂住', about: '低通滤波器', minutes: 4,
    say: '隔着一扇门听隔壁的派对：咚咚的低音还在，亮的、脆的全被门挡住了。DJ 台上那个 FILTER 旋钮往左拧，关的就是这扇门。',
    play: {
      toy: 'fxlab', lab: { effect: 'lowpass', amount: 0.15 },
      tip: '点「播放」，把右边那条竖条**往上推**：门慢慢关上。看画面：右边（高音）的柱子一根根倒下去。',
      name: '这扇门叫**低通滤波器**：低的放过去，高的拦下来。',
    },
    quiz: { toy: 'matchcut', ask: '先听目标，再把竖条推到听起来**一样闷**的地方。一共三次，金那一档要推得更准。' },
    machine: {
      fx: true,
      tasks: [
        PLAY('让它放着。'),
        { ...PICK('HAT1'), text: '按一下 **HAT 1 旋钮**（左边那块、下排左数第 1 个）。只按，别转。我们来捂镲，它最明显；机器里没有镲声的话，按一条有声音的轨道也行。', detect: { kind: 'track' } },
        {
          text: '右边桔红色那块，竖着的 4 个旋钮**正下方**、靠近你这一边的边沿上，有个印着一排三个小点的小键。**按一下**：这 4 个旋钮翻到了第 2 页（右边那列小灯，从上往下第 2 盏亮）。',
          goal: '把那 4 个旋钮翻到第 2 页。',
          panel: ['SDPAGE', 'METER'], detect: { kind: 'sdpage', page: 1 }, wait: '等翻到第 2 页…',
        },
        {
          text: '慢慢转那 4 个旋钮里**从上往下数第 3 个**。往一边转，声音越来越闷，这就是“捂住”；往另一边转是把低音抽走，那是以后的一关。左边那列文字里 “FILTER” 会亮。',
          simText: '按住那 4 个旋钮里**从上往下数第 3 个**，**往下拖**：声音越来越闷，这就是“捂住”。往上拖是把低音抽走，那是以后的一关。左边那列文字里 “FILTER” 会亮。',
          goal: '把这条轨道捂住。',
          panel: ['SD3', 'INDEX'], detect: { kind: 'filter' }, wait: '等你转第 3 个旋钮…',
        },
        {
          text: '往回转，转到声音变回原来那么亮。然后**再按一下那个三个小点的键**，翻回第 1 页：不翻回来，下次想换音色会转错旋钮。',
          goal: '恢复原样，翻回第 1 页。',
          panel: ['SD3', 'SDPAGE'], detect: { kind: 'sdpage', page: 0 }, wait: '等翻回第 1 页…',
        },
        STOP(),
      ],
      done: '每条轨道都有自己的这扇门：刚才你只捂住了一条，别的没动。',
    },
    takeaway: '**低通滤波器**是一扇门：关上它，亮的、脆的被挡住，只剩闷闷的低音。机器上它在右边 4 个旋钮的**第 2 页、第 3 个**，每条轨道各有一扇。',
    coach: '小课堂 F2「把声音捂住」：低通滤波器。截止频率往下走，高频被削掉。机器上每条轨道有自己的 LP-HP FILTER：Sound Design 旋钮按 Sound Design Page 键翻到第 2 页，第 3 个旋钮是 CUTOFF（Index 上 FILTER 亮），第 4 个是 RESONANCE。这个旋钮是“低通—原样—高通”连在一起的，哪边是低通手册没写，所以让他转着听。做完要翻回第 1 页。另一条路是 [FX] 旋钮选 FILTER 类的预设（LPF / HPF 各 4 个）。',
    links: { lessons: ['4-2'], full: ['faded', 'levels'] },
    ask: [
      { q: '低通滤波器拦下来的是？', a: ['高的、亮的', '低的、闷的', '全部'], why: '低的放过去，高的拦下来。' },
      { q: '机器上每条轨道的滤波器在哪？', a: ['右边 4 个旋钮的第 2 页、第 3 个', '[FX LEVEL] 那条竖条', '[OCTAVE] 键'], why: '翻到第 2 页，第 3 个旋钮是 FILTER。' },
    ],
  },
  {
    id: 'F3', line: 'fx', kind: 'hands', title: '把低音抽走', about: '高通滤波器：机器上那条 [HIGH PASS] 触摸条', minutes: 3,
    say: '低通是把高的挡住；高通反过来，把低音抽走，只剩“沙沙”的那层。DJ 进新歌前最爱这一手：先把低音抽空，再一把放回来。',
    play: {
      toy: 'fxlab', lab: { effect: 'highpass', amount: 0.1 },
      tip: '点「播放」，把竖条**往上推**：底鼓和贝斯一点点没了。看画面：左边（低音）的柱子倒下去，右边的还在。',
      name: '这叫**高通滤波器**：高的放过去，低的拦下来。机器上它是一条单独的触摸条 **[HIGH PASS]**。',
    },
    quiz: { toy: 'hands', ask: '在机器上做一遍：按住 [HIGH PASS] 往上推，再松手。铜有蓝圈提示，银没有，金只告诉你要做成什么样。' },
    machine: {
      fx: true,
      tasks: [PLAY('让它放着。'), HP_HOLD, HP_RELEASE, STOP()],
      done: '[HIGH PASS] 永远管整台机器，手一离开就复原：现场最安全的一招。',
    },
    takeaway: '**高通滤波器**把低音抽走，只留上面那层。机器上就是 **[HIGH PASS]** 那条触摸条：按着才有，手离开就复原，永远管整台机器。',
    coach: '小课堂 F3「把低音抽走」：高通滤波器。玩具是效果实验台的高通（看频谱左边倒下去）。这一关是动手关：效果模拟机（或真机）上按 [PLAY]，按住 [HIGH PASS] 触摸条往上推，再松手。手册：Page 1 下 [HIGH PASS] 和 [REPEATER] 永远作用于全部轨，手指离开就关闭；哪一端是最大值手册没写。真机上触摸条有没有上报还没确认，认不出时点“我做了”。',
    links: { lessons: ['7-2'], full: ['animals'] },
    ask: [
      { q: '高通滤波器拿走的是？', a: ['低音', '高音', '中间'], why: '高的放过去，低的拦下来。' },
      { q: '[HIGH PASS] 手一离开会怎样？', a: ['马上复原', '一直保持', '机器停下'], why: '现场用的触摸条：手离开就关闭。' },
    ],
  },
  {
    id: 'F4', line: 'fx', kind: 'ear', title: '那一声“喵”', about: '共鸣：滤波器上那个尖尖的峰', minutes: 4,
    say: '滤波器还有个小脾气：把“共鸣”拧上去，它扫过去的时候会“喵——”地叫一声。Acid House 那种扭来扭去的贝斯，就是它。啾～',
    play: {
      toy: 'fxlab', lab: { effect: 'reso', amount: 0.3 },
      tip: '点「播放」：滤波器在自己来回扫。把竖条（RESONANCE）**往上推**：每扫一下，就多一声“喵”。',
      name: '滤波器那儿冒出来的尖尖的峰叫**共鸣**（Resonance）。越推越尖，越“喵”。',
    },
    quiz: { toy: 'resoorder', ask: '几张牌，共鸣各不一样。按“不喵 → 最喵”排好。铜 3 张、银 4 张、金 5 张。' },
    machine: {
      fx: true,
      tasks: [
        PLAY('让它放着。'),
        { ...PICK('SYNTH1'), text: '按一下 **SYNTH 1 旋钮**（中间那块、上排左边的旋钮）：我们来让贝斯“喵”。' },
        { text: '按一下右边 4 个旋钮正下方那个**三个小点的键**，翻到第 2 页。', goal: '翻到第 2 页。', panel: ['SDPAGE', 'METER'], detect: { kind: 'sdpage', page: 1 }, wait: '等翻到第 2 页…' },
        { text: '先转**第 3 个**旋钮，把贝斯捂住一点（上一关 F2 做过）。', simText: '先按住**第 3 个**旋钮**往下拖**一点，把贝斯捂住一点（F2 做过）。', goal: '把贝斯捂住一点。', panel: ['SD3', 'INDEX'], detect: { kind: 'filter' }, wait: '等你转第 3 个旋钮…' },
        { text: '再转**第 4 个**旋钮（RESONANCE）往大里走：滤波器那儿开始“喵”。', simText: '再按住**第 4 个**旋钮（RESONANCE）**往上拖**：滤波器那儿开始“喵”。', goal: '把共鸣拧上去。', panel: ['SD4', 'INDEX'], detect: { kind: 'reso', min: 0.5 }, wait: '等你转第 4 个旋钮…' },
        { text: '听够了：把两个旋钮转回去，再按一下那个三个小点的键**翻回第 1 页**。', goal: '翻回第 1 页。', panel: ['SD3', 'SD4', 'SDPAGE'], detect: { kind: 'sdpage', page: 0 }, wait: '等翻回第 1 页…' },
        STOP(),
      ],
      done: '第 3 个旋钮是门开多大，第 4 个是门缝那儿“喵”得多尖。两个一起拧，就是 Acid 的味道。',
    },
    takeaway: '**共鸣**是滤波器上那个尖尖的峰：推上去，滤波器一扫就“喵”。机器上它在右边 4 个旋钮的**第 2 页、第 4 个**，紧挨着滤波器。',
    coach: '小课堂 F4「那一声“喵”」：共鸣（Resonance，滤波器截止频率附近的峰）。玩具：效果实验台的“共鸣”，滤波器每小节自己扫一趟，竖条管共鸣多重（锯齿贝斯的 Acid 循环）；挑战是“排顺序”（不喵 → 最喵）。机器上：选 SYNTH 1，Sound Design 翻到第 2 页，第 3 个旋钮捂一点，第 4 个（RESONANCE）往大里转，最后翻回第 1 页。',
    links: { lessons: ['4-2'], songs: ['levels'] },
    ask: [
      { q: '共鸣拧上去，滤波器扫过去时会？', a: ['“喵”一声', '没声音', '变成回声'], why: '共鸣是滤波器上的尖峰：一扫就“喵”。' },
      { q: '机器上共鸣在哪个旋钮？', a: ['第 2 页、第 4 个', '第 1 页、第 1 个', '[FX] 旋钮'], why: '第 2 页：第 3 个是滤波器，第 4 个是共鸣。' },
    ],
  },
  {
    id: 'F5', line: 'fx', kind: 'explain', title: '房间有多大', about: '混响', minutes: 4,
    say: '在浴室里拍手和在山洞里拍手，手是同一双，尾巴不一样长。',
    play: {
      toy: 'fxlab', lab: { effect: 'reverb', rooms: true, amount: 0.6 },
      tip: '点「播放」，换着点「小房间」「大厅」「山洞」。看画面：每一下后面拖出来的那片彩色，就是尾巴。竖条管加多少。',
      name: '这条尾巴叫**混响**。房间越大，尾巴越长，声音越“远”。',
    },
    quiz: { toy: 'whichroom', ask: '听一段：它在哪个房间里？' },
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
    links: { lessons: ['7-1'], full: ['faded'] },
    ask: [
      { q: '房间越大，混响的尾巴？', a: ['越长', '越短', '一样'], why: '房间越大，尾巴越长。' },
      { q: '机器上加混响：[FX] 旋钮转到哪一类？', a: ['REVERB', 'DELAY', 'FILTER'], why: 'REVERB 这一类有 8 个房间。' },
    ],
  },
  {
    id: 'F6', line: 'fx', kind: 'explain', title: '踩在拍子上的回声', about: '延迟', minutes: 4,
    say: '对着山谷喊一声，它会喊回来。音乐里的回声更听话：正好踩着拍子回来。',
    play: {
      toy: 'fxlab', lab: { effect: 'delay', echoes: true, amount: 0.65 },
      tip: '点「播放」。每小节只“嗒”一下，后面跟回来的都是回声。换着点「一拍一次」「半拍一次」「错开着回」，数一数它踩在哪儿。',
      name: '这种回声叫**延迟**（Delay）。隔多久回来一次，是跟着速度算的。',
    },
    quiz: { toy: 'whichecho', ask: '听一段：回声多久回来一次？' },
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
    links: { lessons: ['7-1'], full: ['faded'] },
    ask: [
      { q: '延迟的回声隔多久回来，是跟着什么算的？', a: ['速度（BPM）', '音量', '音高'], why: '跟着速度：改 BPM，回声也跟着变。' },
    ],
  },
  {
    id: 'F7', line: 'fx', kind: 'explain', title: '弄脏它', about: '失真：把声音弄毛、弄脏', minutes: 3,
    say: '干净的声音像新衣服。失真就是故意把它搓旧、搓毛：电吉他、脏贝斯，都是这么来的。',
    play: {
      toy: 'fxlab', lab: { effect: 'drive', amount: 0.2 },
      tip: '点「播放」，把竖条往上推：贝斯越来越毛、越来越“炸”。来回点「原声」和「加效果」比一比。',
      name: '把声音的波形顶上压平、弄出毛边，叫**失真**（Distortion）。',
    },
    quiz: { toy: 'matchcut', effect: 'drive', word: '脏', ask: '先听目标，再把竖条推到听起来**一样脏**的地方。一共三次。' },
    machine: {
      fx: true,
      tasks: [
        PLAY('让它放着。'),
        TO_MASTER,
        FX_TO('DISTORTION', '这一类里有好几种：WAVE FOLDER、AMP SIMULATOR、BIT CRUSHER……都是“弄脏”的不同法子。'),
        FX_LEVEL('越往上越脏。'),
        CLEAR_FX,
        STOP(),
      ],
      done: '加一点点失真，贝斯在小喇叭里也听得见；加多了就成噪音：和盐一样。',
    },
    takeaway: '**失真**把声音弄毛、弄脏：加一点更有劲，加多了就炸。机器上 [FX] 旋钮转到 **DISTORTION**，[FX LEVEL] 管多脏。',
    coach: '小课堂 F7「弄脏它」：失真（波形削顶 / 饱和）。玩具：效果实验台的失真（锯齿贝斯循环）；挑战是“推到一样脏”（对准目标量，铜容差大、金容差小）。机器上：MASTER，[FX] 旋钮转到 DISTORTION（MASTER 下 8 个：WAVE FOLDER - SATURATION、COMP DISTORTION、WAVE FOLDER、AMP SIMULATOR 2 - SETTING 1、AMP SIMULATOR 1、AMP SIMULATOR 2 - SETTING 2、BIT CRUSHER、DIGITAL TURNTABLE），[FX LEVEL] 管量。',
    links: { lessons: ['7-1'], songs: ['bad-guy', 'believer'] },
    ask: [
      { q: '失真是把声音？', a: ['弄毛、弄脏', '变远', '变成回声'], why: '把波形顶上压平，出毛边。' },
      { q: '机器上失真在 [FX] 旋钮的哪一类？', a: ['DISTORTION', 'REVERB', 'DUCKER'], why: 'DISTORTION 这一类。' },
    ],
  },
  {
    id: 'F8', line: 'fx', kind: 'ear', title: '让底鼓先走', about: '躲闪：那种一吸一吸的感觉', minutes: 4,
    say: '底鼓一响，别的声音就往后缩一下，再慢慢回来：一吸、一吸，像在喘气。很多 EDM 的“泵感”就是它。',
    play: {
      toy: 'fxlab', lab: { effect: 'duck', amount: 0.3 },
      tip: '点「播放」，把竖条往上推：那片长长的和弦开始跟着底鼓“喘气”。看画面：彩色那条一下一下被压扁。',
      name: '底鼓一来别的声音就让开，叫**躲闪**（Ducker，也叫侧链压缩）。',
    },
    quiz: { toy: 'duckodd', ask: '几张牌里，只有一张和别的不一样：要么只有它在吸，要么只有它不吸。' },
    machine: {
      fx: true,
      tasks: [
        PLAY('让它放着。'),
        TO_MASTER,
        FX_TO('DUCKER', '它在 DISTORTION、MODULATION 后面，接近最后。'),
        FX_LEVEL('越往上吸得越狠。'),
        CLEAR_FX,
        STOP(),
      ],
      done: '真机上 DUCKER 也可以只给一条轨道（开关拨到 SINGLE）：比如只让和弦躲着底鼓。',
    },
    takeaway: '**躲闪**：底鼓一响，别的声音让一下，再回来，听着一吸一吸。机器上 [FX] 旋钮的 **DUCKER** 类（COMP 类是压缩，也能压出一点）。',
    coach: '小课堂 F8「让底鼓先走」：躲闪 / 侧链压缩的“泵感”。玩具：效果实验台的躲闪（四踩底鼓 + 长和弦，底鼓不进效果）；挑战是“找不同”：几张牌里只有一张在吸（或只有一张不吸），金那一档吸得浅。机器上：MASTER，[FX] 旋钮转到 DUCKER（8 个设置），[FX LEVEL] 管量。总输出上的压缩器在机身上调不了。',
    links: { lessons: ['7-1'], full: ['faded', 'levels'] },
    ask: [
      { q: '“一吸一吸”是谁在让着谁？', a: ['别的声音让着底鼓', '底鼓让着别的声音', '谁也不让'], why: '底鼓一来，别的声音就往后缩。' },
      { q: '机器上做这个效果，[FX] 旋钮转到？', a: ['DUCKER', 'DELAY', 'FILTER'], why: 'DUCKER 这一类。' },
    ],
  },
  {
    id: 'F9', line: 'fx', kind: 'hands', title: '切碎了重复', about: '重复器：机器上那条 [REPEATER] 触摸条', minutes: 3,
    say: '“哒哒哒哒哒——”，一小段被切下来反复，越切越碎：DJ 在 Drop 前最爱这一招。手一松，接着放。',
    play: {
      toy: 'fxlab', lab: { effect: 'repeat', amount: 0 },
      tip: '点「播放」，把竖条**往上推一点**：一拍一段地重复；推到一半：半拍一段；推到顶：碎成一片。拉回最下面，接着放。',
      name: '把刚放过的那一小段切下来反复放，叫**重复器**（Beat Repeat）。机器上是 **[REPEATER]** 那条触摸条。',
    },
    quiz: { toy: 'hands', ask: '在机器上做一遍：按住 [REPEATER]，再松手。铜有蓝圈，银没有，金只给一句目标。' },
    machine: {
      fx: true,
      tasks: [PLAY('让它放着。'), REP_HOLD, REP_RELEASE, STOP()],
      done: '[REPEATER] 和 [HIGH PASS] 一样，手离开就复原：放心按。',
    },
    takeaway: '**重复器**把刚放过的一小段切下来反复：手指越往上越碎。机器上就是 **[REPEATER]** 触摸条，按着才有，松手接着放。',
    coach: '小课堂 F9「切碎了重复」：重复器（BEAT REPEAT）。玩具：效果实验台的重复器（竖条 < 1/3 一拍一段、< 2/3 半拍一段、再上一格四分之一拍）。这一关是动手关：效果模拟机（或真机）上按 [PLAY]、按住 [REPEATER]、松手。手册：Page 1 下 REPEATER 永远作用于全部轨，手指离开就关闭；参数是 BEAT REPEAT LENGTH。真机上触摸条有没有上报还没确认。',
    links: { lessons: ['7-2'] },
    ask: [
      { q: '[REPEATER] 手指越往上？', a: ['切得越碎', '越安静', '越慢'], why: '越往上，重复的那一段越短。' },
    ],
  },
  {
    id: 'F10', line: 'fx', kind: 'ear', title: '晃动的声音', about: '调制：合唱、镶边、颤音', minutes: 4,
    say: '同一个声音，让它一直轻轻地晃：晃音量是颤音，晃出“嗖——”的是镶边，晃成一群人的是合唱。',
    play: {
      toy: 'fxlab', lab: { choices: ['tremolo', 'flanger', 'chorus'], amount: 0.6 },
      tip: '点「播放」，换着点「颤音」「镶边」「合唱」，竖条管晃多少。闭上眼听：哪个在抖、哪个在飞、哪个变成了一群？',
      name: '这一家子都叫**调制**（Modulation）：让声音的某一样（音量、音高、相位）一直在晃。',
    },
    quiz: { toy: 'modmem', ask: '翻牌配对：两张一样的效果是一对。铜 3 对、银 4 对（多一种“原声”）、金 5 对（再多一种“失真”）。' },
    machine: {
      fx: true,
      tasks: [
        PLAY('让它放着。'),
        TO_MASTER,
        FX_TO('MODULATION', '这一类有 SPX CHORUS、TEMPO FLANGER、TREMOLO……接着转就是换一种晃法。'),
        FX_LEVEL('晃多少。'),
        CLEAR_FX,
        STOP(),
      ],
      done: '合唱让声音变宽，镶边让它飞，颤音让它抖：都是“晃”，晃的东西不一样。',
    },
    takeaway: '**调制**是一家子：**颤音**晃音量，**镶边**“嗖——”地飞，**合唱**一个变一群。机器上 [FX] 旋钮的 **MODULATION** 类。',
    coach: '小课堂 F10「晃动的声音」：调制类效果（颤音 = 音量 LFO，镶边 = 带回授的短延迟被 LFO 扫，合唱 = 稍长的短延迟被 LFO 晃）。玩具：效果实验台三选一（琶音循环）；挑战是记忆配对（铜 3 对、银加原声、金再加失真）。机器上：MASTER，[FX] 旋钮转到 MODULATION（SPX CHORUS、TEMPO FLANGER、TEMPO PHASER、ENSEMBLE DETUNE、AUTO PAN、TREMOLO、VCM AUTO WAH、RING MODULATOR）。',
    links: { lessons: ['7-1'], songs: ['get-lucky'] },
    ask: [
      { q: '“一个声音变成一群人”是哪种效果？', a: ['合唱', '颤音', '失真'], why: '合唱：一个变一群。' },
      { q: '颤音晃的是？', a: ['音量', '速度', '调'], why: '颤音：音量一抖一抖。' },
    ],
  },
  {
    id: 'F11', line: 'fx', kind: 'rhythm', title: '做一次铺垫', about: '把气氛推上去，再一把放开', minutes: 4,
    say: '铺垫就是憋：把低音抽走、把声音切碎，让大家等着……然后在 Drop 那一下，两只手一起松开。啾！这一关要你亲手演一遍。',
    play: {
      toy: 'buildup',
      tip: '点「开始」，照着上面的时间线来：第 5 小节起按住 **HIGH PASS** 往上推，第 8 小节按住 **REPEATER**，第 9 小节第 1 拍**一起松手**。先随便试。',
      name: '先憋、再放：这一套叫**铺垫**（build-up），放开的那一下就是 **Drop**。',
    },
    quiz: { toy: 'buildup', ask: '演一遍：前 4 小节别碰；第 5–8 小节按住 HIGH PASS 越推越高；第 8 小节按住 REPEATER（铜可以不用）；第 9 小节第 1 拍一起松手。铜松手差 1 拍以内，银半拍，金 1/3 拍还不给看时间线。' },
    machine: {
      fx: true,
      tasks: [
        PLAY('让它放着。'),
        HP_HOLD,
        { ...HP_RELEASE, text: '松手：低音一下回来了。真机上演的时候**先别松**，另一根手指接着去按 REPEATER；屏幕上一次只能按一条，所以分开来试。' },
        { ...REP_HOLD, text: '再按住右边那条 **[REPEATER]**：又碎又急，憋到最紧。', goal: '按住 [REPEATER]，憋到最紧。' },
        { ...REP_RELEASE, text: '**松开**：一下全回来——这就是 Drop。真机上是两只手一起松。', goal: '松手：Drop！' },
        STOP(),
      ],
      done: '两条触摸条一起按、一起松：现场最好用的铺垫。真机上还可以在 OTHER 类里找唱机刹车（VINYL BREAK）收尾。',
    },
    takeaway: '**铺垫**：抽走低音（HIGH PASS）、切碎声音（REPEATER），越憋越紧；**Drop** 那一拍两只手一起松开，一下全回来。',
    coach: '小课堂 F11「做一次铺垫」：现场的 build-up。这一关是“演一遍”的节奏挑战：10 小节，1–4 平常、5–8 铺垫（军鼓越来越密）、9 Drop；判：前 4 小节没按 HIGH PASS、5–8 小节一直按且越推越高、第 8 小节按 REPEATER（银、金要求）、Drop 那一拍两条都松开（铜 1 拍、银半拍、金 1/3 拍以内，金不给看时间线）。机器上：两条触摸条 [HIGH PASS]、[REPEATER] 一起按、一起松；OTHER 类有 VINYL BREAK。',
    links: { lessons: ['7-2', '7-4'], full: ['animals', 'levels'] },
    ask: [
      { q: 'Drop 那一下要做什么？', a: ['两只手一起松开', '再推高一点', '按 [PLAY] 停下'], why: '憋到最紧，一把放开。' },
    ],
  },
  {
    id: 'FB', line: 'fx', kind: 'boss', title: '效果大关', about: '认效果、对准量、听房间：三段接力', minutes: 5,
    say: '效果线的大关，啾！先认出是哪种效果，再把滤波器推到一样闷，最后听它在哪个房间里。',
    quiz: {
      toy: 'relay', ask: '三段接力：认效果 → 推到一样闷 → 听房间。',
      stages: [
        { toy: 'whichfx', title: '是哪种效果', needs: [2, 3, 4], ask: '一段循环，加了一种效果：是哪种？' },
        { toy: 'matchcut', title: '推到一样闷', ask: '先听目标，再把竖条推到一样闷。' },
        { toy: 'whichroom', title: '哪个房间', needs: [2, 2, 3], ask: '听：它在哪个房间里？' },
      ],
    },
    takeaway: '干和湿、捂住和抽走、房间和回声、脏和晃：效果线的这几样，机器上都在 [FX] 旋钮、三条触摸条和右边 4 个旋钮里。',
    coach: '小课堂 FB「效果大关」：效果线的关底，三段接力：认效果（铜 3 选 1、银 4 选 1、金 6 选 1）、对准低通的量、听混响房间大小。星星按最差的一段给。',
    links: { lessons: ['7-1', '7-2'] },
    ask: [
      { q: '[FX] 旋钮和 [FX LEVEL] 分别管什么？', a: ['选哪种效果、加多少', '音量、速度', '换工程、换调'], why: '[FX] 选“哪种”，[FX LEVEL] 管“多少”。' },
    ],
  },
];
