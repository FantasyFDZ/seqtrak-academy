// 曲目的“SEQTRAK 版分轨”：每首歌拆成机器上的几条轨道，每条一段乐句（1–4 小节）。
// 曲目页的试听（整首叠起来放、一轨一轨地听，song-player.js）用它；以后“一轨一轨照着搭”的课也照着它出
// （流程草案在 docs/design-direction.md 的“曲目的分轨”）。按歌的 id 对上 content/songs.js。
// 2026-11-11：先做了一首样板（先是 Clint Eastwood，用户说没听过、候选整个换了，改成他听过的 Faded），他认了之后，其余 10 首也都写了。
// 每首的依据写在它上面的注释里（查资料的来源、哪些地方是配的）。
//
// 都是凭资料和对原曲的了解写的简化版：搬到机器现成的音阶和调里，音不保证和原曲一模一样。每首的 differs 写明哪些地方和原曲不一样。
//
// 一首歌：
//   bpm       速度
//   swing     机器上 [SWING] 的读数（ticks，−58 到 58；1 步 = 120 ticks）。试听时按 swing / 120 摇，和模拟机一样
//   scale     SCALE 选第几个（scales.js 的 SCALES：0 = MINOR … 7 = PHRYGIAN）
//   key       KEY：0 = C、1 = C#、2 = D、3 = D# ……（scales.js 的 KEY_NAMES）
//   bars      整首循环几小节；比它短的轨道自己重复
//   space     可以不写：全机共用的混响、延迟怎么设 { reverb: 混响几秒, delay: 延迟隔几拍, feedback: 回授 0–1 }（默认 2.6 秒、0.75 拍、0.35）
//   origKey   原曲的调（说给人听的）
//   summary   一句话：这个 SEQTRAK 版是怎么来的
//   differs   和原曲不一样的地方，一条一句
//   parts     分轨，按“照着搭”的先后排（先鼓、再贝斯、再和弦、再旋律）：
//     track   轨道（tracks.js 的 id）
//     layer   哪一层：drums 鼓 / bass 贝斯 / chords 和弦 / lead 旋律（“一层层加上去”和以后的课按它分步）
//     role    一句话：它在原曲里是哪一层
//     sound   机器上挑什么音色：{ cat: 音色类别（3.3.4 按类别跳），hint: 一句提示 }
//     send    可以不写：往全机共用的混响、延迟里送多少 { reverb: 0–1, delay: 0–1 }（机器上在混音台模式里调：旋钮 3 送混响、旋钮 4 送延迟；Sound Design 第 3 页 advanced 里也有）
//     鼓轨     steps：节奏串，每小节 16 格（x 一下、X 重一点、- 空），写法同 charts.js；可以只写 1 小节
//     合成器轨 octave：这条轨道的 OCTAVE（−3 到 +2）
//              mode：'mono' 单音 / 'poly' 复音 / 'chord' 和弦（一个键 = 一个和弦，scales.js 的 CHORD_PRESETS）
//              notes：[第几步, 第几个 Synth key, 持续几步, 八度偏移?]；八度偏移是相对这条轨道的 OCTAVE 的（+1 = 这个音再高一个八度）
//              voice：试听时用应用自带的哪种音色（audio.js 的 VOICES）
//              vel：试听时每个音的力度（可以不写，按层用 song-player.js 的 VEL；Pad 这种本身轻的音色要写大一点）

export const LAYERS = {
  drums: { label: '鼓', order: 1 },
  bass: { label: '贝斯', order: 2 },
  chords: { label: '和弦', order: 3 },
  lead: { label: '旋律', order: 4 },
};

export const SONG_PARTS = {
  // Alan Walker《Faded》（2015）。依据（2026-11-11 查的）：Musicnotes 的正式乐谱标 E♭ 小调、90 BPM；
  // synthesizednotes / piano-keyboard-guide 的简谱：和弦 D♯m – B – F♯ – C♯ 一小节一个、从头到尾不变，
  // 前奏的钢琴旋律是 F♯ F♯ F♯ A♯ │ 高 D♯ 高 D♯ 高 D♯ 高 C♯ │ A♯ A♯ A♯ A♯ │ F F F D♯，一拍一个音。
  // 鼓和贝斯的每一下是照这类歌的常见写法写的，没有逐下核对。
  faded: {
    bpm: 90,
    swing: 0,
    scale: 0,
    key: 3,
    bars: 4,
    space: { reverb: 3.2, delay: 0.75, feedback: 0.38 },
    origKey: 'D♯ 小调（也写成 E♭ 小调）',
    summary: '原调 D♯ 小调：机器上就是默认的 MINOR 音阶，只把 KEY 换成 D♯。四小节一圈，一小节一个和弦（键 1 → 6 → 3 → 7）：一套简单的鼓、一条跟着根音走的贝斯、铺在下面的和弦，上面是前奏那段一拍一个音的钢琴旋律。钢琴和铺底泡在一大片混响里，氛围主要靠它。',
    differs: [
      '原曲的和弦是三个音的；机器 CHORD 弹法现成的四个和弦每个都多一个音（D♯m7、Bmaj7、F♯maj7、C♯7），听着会更软、更“爵士”一点。',
      '鼓是照这类慢速电子流行的常见写法写的（底鼓一、三拍，军鼓二、四拍，反拍镲），没有逐下核对；原曲二、四拍是拍手和军鼓叠在一起的，这里只用了军鼓；原曲前奏主要是钢琴，鼓是后面才进来的，这里一开始就叠在一起。',
      '贝斯只弹每个和弦的根音，一小节两下；原曲 Drop 里的低音更厚，还会跟着底鼓一起“喘气”（侧链压缩），那要到第 7 章效果才做。',
      '旋律用的是前奏那段钢琴（Drop 里同一段换成了合成器），照公开的简谱写，一拍一个音；人声唱的部分没做。',
      '原曲 Drop 里那种又宽又亮的合成器，这里用一个宽一点的 Pad 加混响代替；铺底跟着底鼓“喘气”（侧链压缩）没做。',
      '试听里的混响、延迟和音色都是应用自己合成的，只是接近；机器上挑的预置音色、默认的混响会是另一种味道，多半更好听。',
    ],
    parts: [
      {
        track: 'KICK', layer: 'drums',
        steps: 'x-------x-------',
        role: '底鼓：第 1、3 拍各一下，稳稳地踩着。原曲副歌和 Drop 里那个又低又闷的底鼓。',
        sound: { cat: 'KICK', hint: '低、闷一点' },
      },
      {
        track: 'SNARE', layer: 'drums',
        steps: '----x-------x---',
        send: { reverb: 0.35 },
        role: '军鼓：二、四拍。原曲是带一点混响的拍手和军鼓叠在一起，这里先用军鼓一条（应用自带的拍手声太薄，试听里听不清）。',
        sound: { cat: 'SNARE', hint: '厚一点、带点尾巴；想更像可以在 CLAP 轨上同样的位置再叠一下拍手' },
      },
      {
        track: 'HAT1', layer: 'drums',
        steps: '--x---x---x---x-',
        send: { reverb: 0.15 },
        role: '反拍的“嚓”：每拍后半拍一下，让慢歌也一直往前走。',
        sound: { cat: '闭镲', hint: '短、轻' },
      },
      {
        track: 'SYNTH1', layer: 'bass', octave: -2, mode: 'mono', voice: 'bass',
        notes: [
          [0, 1, 7], [8, 1, 7], [16, 6, 7], [24, 6, 7],
          [32, 3, 7], [40, 3, 7], [48, 7, 7], [56, 7, 7],
        ],
        role: '贝斯：跟着和弦走根音，一小节两下（D♯ → B → F♯ → C♯）。原曲 Drop 里那层又厚又低的底音。',
        sound: { cat: 'BASS', hint: '圆一点、低一点' },
      },
      {
        track: 'SYNTH2', layer: 'chords', octave: -1, mode: 'chord', voice: 'wide', vel: 0.55,
        send: { reverb: 0.7, delay: 0.1 },
        notes: [[0, 1, 16], [16, 6, 16], [32, 3, 16], [48, 7, 16]],
        role: '和弦：一小节一个，从头转到尾——就是 3.4 课的键 1 → 6 → 3 → 7。原曲里铺在下面的那层合成器和钢琴。',
        sound: { cat: 'PAD', hint: '宽、暖、起音慢一点，铺得开' },
      },
      {
        track: 'DX', layer: 'lead', octave: 0, mode: 'mono', voice: 'piano', vel: 0.65,
        send: { reverb: 0.6, delay: 0.3 },
        notes: [
          [0, 3, 3], [4, 3, 3], [8, 3, 3], [12, 5, 3],
          [16, 1, 3, 1], [20, 1, 3, 1], [24, 1, 3, 1], [28, 7, 3],
          [32, 5, 3], [36, 5, 3], [40, 5, 3], [44, 5, 3],
          [48, 2, 3], [52, 2, 3], [56, 2, 3], [60, 1, 3],
        ],
        role: '旋律：前奏那段钢琴，一拍一个音——三下 F♯ 一下 A♯，三下高 D♯ 一下 C♯，四下 A♯，三下 F 一下 D♯。Drop 里换成合成器的也是这一段。',
        sound: { cat: 'PIANO', hint: '亮一点的钢琴或电钢琴' },
      },
    ],
  },

  // Coolio《Gangsta's Paradise》（1995）。依据（2026-11-11 查的）：Hooktheory 标 C 小调（V 级借自和声小调）、80 BPM，
  // karaoke-version 也是 Cm、80；和弦 A♭ – Fm – G – Cm 各两拍、两小节一圈（Chordie / guitaretab、Hooktheory 副歌）；
  // 弦乐那句 C C C C │ B B C G 是 Songsterr 4351 的弦乐轨和 pianoletternotes 对得上的；贝斯和鼓是 Songsterr 4351 的用户扒谱（只有这一份）。
  'gangstas-paradise': {
    bpm: 80,
    swing: 0,
    scale: 0,
    key: 0,
    bars: 2,
    space: { reverb: 2.8, delay: 0.5, feedback: 0.3 },
    origKey: 'C 小调（G 和弦借自和声小调，带一个还原的 B）',
    summary: '原调 C 小调，机器上就是 MINOR / C，和课程里一直用的一样。两小节一圈，四个和弦各两拍：A♭ → Fm → G → Cm（键 6 → 4 → 5 → 1）。上面是那句一拍一个音的弦乐，下面是跟着和弦走的贝斯和一套干净的鼓。',
    differs: [
      '原曲的 G 和弦是大三和弦、弦乐那句里有一个还原的 B（和声小调）。机器的 7 个键只放得下一个音阶，B 和 B♭ 不能同时有：这里用普通小调，G 和弦变成键 5 的 Gm7，弦乐里的 B 换成了 B♭——听着少了一点“紧”，这是和原曲最大的不同。',
      '弦乐那句用的是一拍一个音的那一段；原曲还有合唱的铺底和人声唱的副歌旋律，这里没做。',
      '鼓按 Songsterr 的扒谱写，原曲底鼓两小节一换，这里只用了第 1 小节的那种。',
      '贝斯用的是前奏 / 主歌那种一个和弦一个长音的写法；副歌里那种带小走句的贝斯没做。',
    ],
    parts: [
      {
        track: 'KICK', layer: 'drums',
        steps: 'x-------x-x-----',
        role: '底鼓：第 1、3 拍，第 3 拍后面半拍补一下。',
        sound: { cat: 'KICK', hint: '圆一点、不要太硬' },
      },
      {
        track: 'SNARE', layer: 'drums',
        steps: '----x-------x---',
        send: { reverb: 0.25 },
        role: '军鼓：二、四拍，干净利落。',
        sound: { cat: 'SNARE', hint: '干脆、带一点空间' },
      },
      {
        track: 'HAT1', layer: 'drums',
        steps: 'x-x-x-x-x-x-x-x-',
        role: '闭镲：八分音符，一拍两下，稳稳地走。',
        sound: { cat: '闭镲', hint: '轻一点' },
      },
      {
        track: 'SYNTH1', layer: 'bass', octave: -2, mode: 'mono', voice: 'bass',
        notes: [[0, 6, 7], [8, 4, 7], [16, 5, 7], [24, 1, 7]],
        role: '贝斯：一个和弦一个长音，A♭ → F → G → C，一路往下走。',
        sound: { cat: 'BASS', hint: '低、厚，不要太亮' },
      },
      {
        track: 'SYNTH2', layer: 'chords', octave: -1, mode: 'chord', voice: 'wide', vel: 0.5,
        send: { reverb: 0.6 },
        notes: [[0, 6, 8], [8, 4, 8], [16, 5, 8], [24, 1, 8]],
        role: '和弦：四个和弦各两拍——原曲里那层合唱和弦乐的铺底。',
        sound: { cat: 'STRINGS', hint: '弦乐或者合唱一类，铺得开' },
      },
      {
        track: 'DX', layer: 'lead', octave: 1, mode: 'mono', voice: 'pad', vel: 1.2,
        send: { reverb: 0.55, delay: 0.15 },
        notes: [
          [0, 1, 4], [4, 1, 4], [8, 1, 4], [12, 1, 4],
          [16, 7, 4, -1], [20, 7, 4, -1], [24, 1, 4], [28, 5, 4, -1],
        ],
        role: '旋律：那句弦乐——四下高 C，然后往下落一点、回到 C、再落到 G。一拍一个音。',
        sound: { cat: 'STRINGS', hint: '弦乐，起音慢一点' },
      },
    ],
  },

  // Billie Eilish《bad guy》（2019）。依据（2026-11-11 查的）：Musicnotes MN0195111 标 G 小调、135 BPM，karaoke-version、Hooktheory 一致；
  // 和弦 Gm 四小节 → Cm 两小节 → D 两小节（Hooktheory：i iv V7）；贝斯 riff 是 Songsterr 454287 的 Sub Bass 轨和 Hooktheory 前奏段，两边逐音一致，
  // bigbasstabs 的前两小节也一样；鼓是四踩底鼓，拍手 / 响指在二、四拍（Songsterr、Bonedo）。
  'bad-guy': {
    bpm: 135,
    swing: 0,
    scale: 0,
    key: 7,
    bars: 8,
    space: { reverb: 1.8, delay: 0.75, feedback: 0.3 },
    origKey: 'G 小调',
    summary: '原调 G 小调：MINOR，KEY 换成 G。这首几乎只有两样东西：四踩的底鼓和二、四拍的拍手，加上那条弹来弹去的合成器贝斯——贝斯就是整首歌的钩子，八小节一圈：Gm 四小节、Cm 两小节、D 两小节。',
    differs: [
      'D 和弦那两小节，原曲贝斯里的是 F♯（有的谱写 F）。机器的 7 个键放不下 F♯，这里用 F。',
      '原曲没有和弦铺底，这里也没做；副歌后面那段带 C♯、F♯ 的合成器旋律也没做（7 个键放不下）。',
      '原曲的响指和拍手是叠在一起的，这里用一条拍手。',
      '桥段那种半速的 trap 律动没做，只做了主歌、副歌的那一圈。',
    ],
    parts: [
      {
        track: 'KICK', layer: 'drums',
        steps: 'x---x---x---x---',
        role: '底鼓：四踩，每拍一下，从头到尾不变。',
        sound: { cat: 'KICK', hint: '短、闷，低频足' },
      },
      {
        track: 'CLAP', layer: 'drums',
        steps: '----X-------X---',
        send: { reverb: 0.3 },
        role: '拍手：二、四拍。原曲是响指和拍手叠在一起。',
        sound: { cat: 'CLAP', hint: '干一点的拍手，或者 SNAP 一类的响指' },
      },
      {
        track: 'SYNTH1', layer: 'bass', octave: -2, mode: 'mono', voice: 'bass', vel: 0.85,
        notes: [
          // Gm（第 1、2 小节，第 3、4 小节再来一遍）
          [0, 1, 3], [6, 1, 2], [8, 3, 2], [10, 1, 2], [14, 1, 2],
          [18, 1, 2], [22, 1, 2], [24, 3, 2], [26, 1, 2], [28, 7, 4, -1],
          [32, 1, 3], [38, 1, 2], [40, 3, 2], [42, 1, 2], [46, 1, 2],
          [50, 1, 2], [54, 1, 2], [56, 3, 2], [58, 1, 2], [60, 7, 4, -1],
          // Cm（第 5、6 小节）
          [64, 4, 4], [70, 4, 2], [72, 6, 2], [74, 4, 2], [78, 4, 2],
          [82, 4, 2], [86, 4, 2], [88, 6, 2], [90, 4, 2], [92, 1, 4, 1],
          // D（第 7、8 小节）
          [96, 5, 4], [102, 5, 2], [104, 7, 2], [106, 5, 2], [110, 5, 2, -1],
          [114, 5, 2, -1], [118, 5, 2, -1],
        ],
        role: '贝斯：整首歌的钩子。每小节同一个节奏型，Gm 上弹 G 和 B♭，Cm 上弹 C 和 E♭，D 上弹 D 和 F；每两小节的最后一下往下（或往上）跳一下。',
        sound: { cat: 'BASS', hint: '圆、厚、有点“噗”的合成器贝斯' },
      },
    ],
  },

  // The Weeknd《Starboy》（2016）。依据（2026-11-11 查的）：Hooktheory、Musicnotes MN0176140、karaoke-version 都是 A 小调；
  // 速度资料上有 186 也有 93，按 93 数最自然（Hooktheory、Hit Songs Deconstructed、Songsterr 的人工扒谱）；和弦 Am – G – F – G 一小节一个；
  // 贝斯是一个跟着底鼓切分的 A 持续音，底鼓和贝斯起音位置一样（Songsterr 2554837）；副歌旋律是 Hooktheory 的 Chorus 段，
  // piano-keyboard-guide 的简谱对得上。
  starboy: {
    bpm: 93,
    swing: 0,
    scale: 0,
    key: 9,
    bars: 4,
    space: { reverb: 2.4, delay: 0.75, feedback: 0.3 },
    origKey: 'A 小调',
    summary: '原调 A 小调：MINOR，KEY 换成 A，按 93 BPM 数（资料上的 186 是两倍）。四小节一圈，一小节一个和弦：Am → G → F → G（键 1 → 7 → 6 → 7）。底下一个跟着底鼓切分的 A 一直不变，上面是副歌那句旋律。',
    differs: [
      '机器 CHORD 弹法的和弦每个多一个音（Am7、G7、Fmaj7），比原曲暗一点、也更“爵士”。',
      '贝斯只做了那条跟着底鼓切分的 A（原曲从副歌后段起还有一条跟着和弦走的长音贝斯，没做）。',
      '旋律是副歌那句的前四小节；原曲最后那一下“D – C – A”的收尾落在下一圈的开头，这里省掉了。人声没做，旋律用一个合成器音色弹。',
      '原曲的嗵鼓（切分的 16 分）没做，鼓只有底鼓、军鼓和 16 分镲。',
    ],
    parts: [
      {
        track: 'KICK', layer: 'drums', vel: 0.85,
        steps: 'x---x-x--xx--x-x',
        role: '底鼓：切分的，和贝斯一起起音——底鼓和贝斯“咬”在一起，就是它的律动。',
        sound: { cat: 'KICK', hint: '紧、低，80 年代鼓机味' },
      },
      {
        track: 'SNARE', layer: 'drums',
        steps: '----x-------x---',
        send: { reverb: 0.3 },
        role: '军鼓：二、四拍。原曲是军鼓和拍手叠着。',
        sound: { cat: 'SNARE', hint: '亮一点、短一点' },
      },
      {
        track: 'HAT1', layer: 'drums',
        steps: 'XxxxXxxxXxxxXxxx',
        role: '闭镲：每个 16 分都有，每拍第一下重一点。',
        sound: { cat: '闭镲', hint: '细、碎' },
      },
      {
        track: 'SYNTH1', layer: 'bass', octave: -3, mode: 'mono', voice: 'bass', bars: 1,
        notes: [[0, 1, 4], [4, 1, 2], [6, 1, 3], [9, 1, 1], [10, 1, 3], [13, 1, 2], [15, 1, 1]],
        role: '贝斯：一个低低的 A，跟着底鼓切分地跳，和弦换了它也不换。只有一小节，自己重复。',
        sound: { cat: 'BASS', hint: '短、低、有冲击力' },
      },
      {
        track: 'SYNTH2', layer: 'chords', octave: -1, mode: 'chord', voice: 'wide', vel: 0.65,
        send: { reverb: 0.6, delay: 0.1 },
        notes: [[0, 1, 16], [16, 7, 16], [32, 6, 16], [48, 7, 16]],
        role: '和弦：一小节一个，Am → G → F → G。原曲里那层暗暗的合成器铺底。',
        sound: { cat: 'PAD', hint: '暗一点的合成器铺底' },
      },
      {
        track: 'DX', layer: 'lead', octave: -1, mode: 'mono', voice: 'reed', vel: 0.85,
        send: { reverb: 0.45, delay: 0.25 },
        notes: [
          [2, 3, 3], [6, 3, 2], [8, 3, 3], [11, 3, 3], [14, 3, 2],
          [18, 2, 3], [22, 2, 2], [24, 2, 3], [27, 5, 1], [28, 5, 1], [29, 7, 1], [30, 5, 1], [31, 1, 1, 1],
          [34, 3, 3], [38, 3, 2], [40, 3, 3], [43, 3, 3], [46, 3, 2],
          [50, 2, 3], [54, 2, 2], [56, 2, 2], [58, 4, 1], [59, 4, 1], [60, 4, 1], [61, 4, 1], [62, 4, 1], [63, 4, 1],
        ],
        role: '旋律：副歌那句——在 C 上念五下、在 B 上念三下再往上一甩（E E G E A），重复一遍，最后在 D 上连着六下。',
        sound: { cat: 'SYNTH LEAD', hint: '圆一点的合成器主奏' },
      },
    ],
  },

  // Martin Garrix《Animals》（2013）。依据（2026-11-11 查的）：Hooktheory、Musicnotes MN0127446、MusicRadar 都是 F 小调、128 BPM；
  // Drop 那句是 Hooktheory 的 Solo 段：只有一个 F，在三个八度之间跳，16 分音符（只有这一份逐音的谱，维基百科、MusicRadar 的描述对得上）；
  // 鼓：MusicRadar 说 drop 是四踩底鼓；拍手、镲的位置没有资料，是照这类大舞台 EDM 的常见写法写的。
  animals: {
    bpm: 128,
    swing: 0,
    scale: 0,
    key: 5,
    bars: 1,
    space: { reverb: 1.6, delay: 0.75, feedback: 0.25 },
    origKey: 'F 小调',
    summary: '原调 F 小调：MINOR，KEY 换成 F。Drop 里几乎只有两样东西：四踩的底鼓，和一句只用一个音的合成器——同一个 F，在低、中、高三个八度之间来回跳。一小节一圈。',
    differs: [
      'Drop 那句按 Hooktheory 的谱写，这是唯一一份逐音的谱，没有别的来源核对过；原曲后半段（第 9–16 小节）有一个变体，这里只做了前面那种。',
      '拍手和开镲的位置没有资料，是照这类大舞台 EDM 的常见写法放的（拍手二、四拍，开镲在后半拍）。',
      '原曲那种又粗又失真的底鼓和音色、Drop 前的铺垫（军鼓越来越密、空一小节）都没做；中间段的旋律也没做。',
    ],
    parts: [
      {
        track: 'KICK', layer: 'drums',
        steps: 'X---X---X---X---',
        role: '底鼓：四踩，每拍一下，又重又硬。',
        sound: { cat: 'KICK', hint: '硬、有点失真的那种' },
      },
      {
        track: 'CLAP', layer: 'drums',
        steps: '----x-------x---',
        send: { reverb: 0.35 },
        role: '拍手：二、四拍（资料里没写，按这类歌的常见写法）。',
        sound: { cat: 'CLAP', hint: '厚、带一点混响' },
      },
      {
        track: 'HAT2', layer: 'drums',
        steps: '--x---x---x---x-',
        role: '开镲：每拍后半拍一下，“咚—嚓—咚—嚓”往前推。',
        sound: { cat: '开镲', hint: '短一点的开镲' },
      },
      {
        track: 'SYNTH1', layer: 'lead', octave: -1, mode: 'mono', voice: 'bass', vel: 0.8,
        notes: [
          [0, 1, 1, -1], [1, 1, 1], [2, 1, 1, 1],
          [4, 1, 1, -1], [5, 1, 1], [6, 1, 1, 1], [7, 1, 1],
          [8, 1, 1, -1], [9, 1, 1], [10, 1, 1, 1],
          [12, 1, 1, -1], [13, 1, 1], [14, 1, 1, 1], [15, 1, 1],
        ],
        role: 'Drop 的那句：只有一个 F，低—中—高地往上跳，“噔噔噔、噔噔噔噔”。整首歌最出名的就是它。',
        sound: { cat: 'SYNTH LEAD', hint: '短、冲、有点失真的合成器，或者 BASS 类里亮一点的' },
      },
    ],
  },

  // Avicii《Wake Me Up》（2013）。依据（2026-11-11 查的）：维基百科、Hooktheory、SongBPM 都是 B 小调、约 124 BPM；
  // 和弦：Hooktheory 副歌是 Bm 两拍 → G 两拍 → D 三拍 → A 一拍，第二遍 A 换成 F♯m（维基百科写 Bm/G/D/A – Bm/G/D/F♯）；
  // 旋律是副歌那句，Hooktheory 和 pianoletternotes 简单版的音和节奏一致；鼓：Hit Songs Deconstructed 说是四踩底鼓，拍手、镲没有资料。
  'wake-me-up': {
    bpm: 124,
    swing: 0,
    scale: 0,
    key: 11,
    bars: 4,
    space: { reverb: 2.2, delay: 0.75, feedback: 0.3 },
    origKey: 'B 小调',
    summary: '原调 B 小调：MINOR，KEY 换成 B。四小节一圈，和弦是 3.4 课那一套 1 → 6 → 3 → 7（Bm → G → D → A），第二遍最后一个换成 5（F♯m）。上面是副歌那句很好唱的旋律，下面是四踩鼓和跟着根音走的贝斯。',
    differs: [
      '原曲那把木吉他是一下一下扫弦的，这里简化成每个和弦一个长音；机器 CHORD 弹法的和弦每个多一个音（Bm7、Gmaj7、Dmaj7、A7），会更软一点。',
      '旋律用的是副歌那句（Drop 里合成器弹的也是它），按 Hooktheory 和简谱写；人声没做。',
      '拍手和开镲的位置没有资料，是照这类 EDM 的常见写法放的。',
      '贝斯原曲没有找到谱，这里是跟着和弦根音一拍一下。',
    ],
    parts: [
      {
        track: 'KICK', layer: 'drums',
        steps: 'x---x---x---x---',
        role: '底鼓：四踩，像跺脚一样一拍一下。',
        sound: { cat: 'KICK', hint: '厚、圆' },
      },
      {
        track: 'CLAP', layer: 'drums',
        steps: '----x-------x---',
        send: { reverb: 0.3 },
        role: '拍手：二、四拍（资料里没写，按这类歌的常见写法）。',
        sound: { cat: 'CLAP', hint: '亮一点' },
      },
      {
        track: 'HAT2', layer: 'drums',
        steps: '--x---x---x---x-',
        role: '开镲：每拍后半拍一下。',
        sound: { cat: '开镲', hint: '短一点' },
      },
      {
        track: 'SYNTH1', layer: 'bass', octave: -2, mode: 'mono', voice: 'bass',
        notes: [
          [0, 1, 3], [4, 1, 3], [8, 6, 3], [12, 6, 3], [16, 3, 3], [20, 3, 3], [24, 3, 3], [28, 7, 3],
          [32, 1, 3], [36, 1, 3], [40, 6, 3], [44, 6, 3], [48, 3, 3], [52, 3, 3], [56, 3, 3], [60, 5, 3],
        ],
        role: '贝斯：跟着和弦的根音，一拍一下：B → G → D → A，第二遍最后是 F♯。',
        sound: { cat: 'BASS', hint: '圆、不刺耳' },
      },
      {
        track: 'SYNTH2', layer: 'chords', octave: -1, mode: 'chord', voice: 'keys', vel: 0.36,
        send: { reverb: 0.4 },
        notes: [[0, 1, 8], [8, 6, 8], [16, 3, 12], [28, 7, 4], [32, 1, 8], [40, 6, 8], [48, 3, 12], [60, 5, 4]],
        role: '和弦：原曲那把木吉他扫的和弦，这里一个和弦一个长音：Bm 两拍、G 两拍、D 三拍、A（第二遍 F♯m）一拍。',
        sound: { cat: 'GUITAR', hint: '木吉他；没有合适的就用钢琴' },
      },
      {
        track: 'DX', layer: 'lead', octave: 0, mode: 'mono', voice: 'lead', vel: 0.95, bars: 2,
        send: { reverb: 0.5, delay: 0.3 },
        notes: [
          [0, 1, 4], [4, 1, 3], [7, 7, 1, -1], [8, 1, 1], [9, 3, 1], [10, 1, 3], [13, 7, 1, -1], [14, 1, 1], [15, 7, 1, -1],
          [16, 3, 4], [20, 3, 3], [23, 3, 1], [24, 4, 1], [25, 3, 1], [26, 4, 2], [28, 5, 2], [30, 3, 2],
        ],
        role: '旋律：副歌那句——在 B 上起、绕一下，再爬到 D、E、F♯。两小节一句，放的时候自己重复。',
        sound: { cat: 'SYNTH LEAD', hint: '亮一点的合成器主奏' },
      },
    ],
  },

  // Avicii《Levels》（2011）。依据（2026-11-11 查的）：Hooktheory、维基百科、Musicnotes MN0296804 都是 C♯ 小调；速度 Hooktheory、Musicnotes 写 127，SongBPM 写 126；
  // 和弦：C♯m 半小节 → E 半小节 → B（前半小节多一点）→ A（从第 2 拍后半拍抢进来），两小节一圈（Hooktheory，pianoletternotes 左手对得上）；
  // 主旋律是 Hooktheory 的 Intro 段，全是八分音符，pianoletternotes 逐音一致；贝斯、鼓没有找到谱（MusicRadar 只说是“基本的底鼓加军鼓”）。
  levels: {
    bpm: 127,
    swing: 0,
    scale: 0,
    key: 1,
    bars: 4,
    space: { reverb: 2.4, delay: 0.75, feedback: 0.35 },
    origKey: 'C♯ 小调',
    summary: '原调 C♯ 小调：MINOR，KEY 换成 C♯。两小节转一圈和弦：C♯m → E → B → A（键 1 → 3 → 7 → 6）；上面是那条一听就认得的主旋律，四小节一句，全是八分音符。',
    differs: [
      '原曲那种又宽又亮、一层叠一层的合成器音色要到第 4 章才能调，这里用一个现成的主奏音色；机器 CHORD 弹法的和弦每个多一个音。',
      '贝斯没有找到谱，这里是跟着和弦根音在后半拍“嘣”一下；鼓也没有资料，按这类歌的常见写法（四踩、拍手二四拍、反拍开镲）。',
      '原曲底鼓一响、整首歌“吸”一下的侧链效果（第 7 章）、Etta James 的人声采样（第 5 章）都没做。',
    ],
    parts: [
      {
        track: 'KICK', layer: 'drums',
        steps: 'x---x---x---x---',
        role: '底鼓：四踩（资料里只说是“基本的底鼓加军鼓”）。',
        sound: { cat: 'KICK', hint: '厚、短' },
      },
      {
        track: 'CLAP', layer: 'drums',
        steps: '----x-------x---',
        send: { reverb: 0.3 },
        role: '拍手：二、四拍。',
        sound: { cat: 'CLAP', hint: '亮一点' },
      },
      {
        track: 'HAT2', layer: 'drums',
        steps: '--x---x---x---x-',
        role: '开镲：每拍后半拍一下。',
        sound: { cat: '开镲', hint: '短一点' },
      },
      {
        track: 'SYNTH1', layer: 'bass', octave: -2, mode: 'mono', voice: 'bass', bars: 2,
        notes: [[2, 1, 2], [6, 1, 2], [10, 3, 2], [14, 3, 2], [18, 7, 2], [22, 6, 2], [26, 6, 2], [30, 6, 2]],
        role: '贝斯：跟着和弦根音，在每拍的后半拍“嘣”一下：C♯ → E → B → A。两小节，自己重复。',
        sound: { cat: 'BASS', hint: '短、圆' },
      },
      {
        track: 'SYNTH2', layer: 'chords', octave: -1, mode: 'chord', voice: 'wide', vel: 0.6, bars: 2,
        send: { reverb: 0.5 },
        notes: [[0, 1, 8], [8, 3, 8], [16, 7, 6], [22, 6, 10]],
        role: '和弦：C♯m、E 各半小节，B 稍短，A 提前半拍抢进来——两小节一圈。',
        sound: { cat: 'PAD', hint: '宽一点的合成器铺底' },
      },
      {
        track: 'DX', layer: 'lead', octave: 0, mode: 'mono', voice: 'lead', vel: 1,
        send: { reverb: 0.5, delay: 0.35 },
        notes: [
          [0, 4, 2], [2, 3, 2], [4, 3, 2], [8, 3, 2], [10, 3, 2], [12, 3, 2], [14, 3, 2],
          [16, 2, 2], [18, 2, 2], [20, 3, 2], [22, 3, 2], [26, 1, 2, 1], [28, 7, 2], [30, 5, 2],
          [32, 4, 2], [34, 3, 2], [36, 3, 2], [40, 3, 2], [42, 3, 2], [44, 3, 2], [46, 3, 2],
          [48, 1, 2], [50, 1, 2], [52, 7, 2, -1], [54, 7, 2, -1], [58, 1, 2, 1], [60, 7, 2], [62, 5, 2],
        ],
        role: '旋律：那条主旋律——在 E 上一下一下地敲，落到 D♯ 再回来，然后从高 C♯ 往下滑（C♯ → B → G♯）；第二句沉到更低的 C♯、B。',
        sound: { cat: 'SYNTH LEAD', hint: '又亮又宽的合成器主奏' },
      },
    ],
  },

  // The Weeknd《Blinding Lights》（2019）。依据（2026-11-11 查的）：速度 171（Notetracks、Loopcloud、鼓谱、Hooktheory）；
  // 调的叫法不一（F Dorian / C 小调 / F 小调），用的都是 C 小调那 7 个音；和弦 Fm – Cm – E♭ – B♭ 各两小节、八小节一圈（Flypaper、HSD、Musicnotes 吉他谱）；
  // 前奏那句合成器是 Hit Songs Deconstructed 的谱，pianoletternotes、synthesizernotes 对得上；鼓：第 1、9 步底鼓，第 5、13 步军鼓，八分镲（Drum Sheet MX）。
  'blinding-lights': {
    bpm: 171,
    swing: 0,
    scale: 0,
    key: 0,
    bars: 8,
    space: { reverb: 2.4, delay: 0.75, feedback: 0.35 },
    origKey: 'F 小调 / F Dorian（资料叫法不一，用的都是 C 小调那 7 个音）',
    summary: '用的是 C 小调那 7 个音（和课程一直用的 MINOR / C 一样，不用改调）。八小节一圈，和弦每个两小节：Fm → Cm → E♭ → B♭（键 4 → 1 → 3 → 7）。上面是前奏那句合成器，节奏快、音不多，下面是 80 年代鼓机的鼓和跟着根音走的贝斯。',
    differs: [
      '机器 CHORD 弹法的和弦每个多一个音，最后那个 B♭ 是键 7 的 B♭7（原曲是干净的 B♭ 大三和弦）。',
      '贝斯没有找到免费的谱，这里是每小节一个根音长音；原曲还有跟着底鼓的短音。',
      '鼓按 Drum Sheet MX 的扒谱，原曲底鼓两小节一换（第二种多一下），这里只用第一种。',
      '人声和副歌的旋律没做，只做了前奏那句合成器。',
    ],
    parts: [
      {
        track: 'KICK', layer: 'drums',
        steps: 'x-------x-------',
        role: '底鼓：第 1、3 拍，80 年代鼓机那种。',
        sound: { cat: 'KICK', hint: '紧、有点“啪”的老鼓机底鼓' },
      },
      {
        track: 'SNARE', layer: 'drums',
        steps: '----x-------x---',
        send: { reverb: 0.4 },
        role: '军鼓：二、四拍，带一大片混响——80 年代的味道。',
        sound: { cat: 'SNARE', hint: '亮、带混响' },
      },
      {
        track: 'HAT1', layer: 'drums',
        steps: 'x-x-x-x-x-x-x-x-',
        role: '闭镲：八分音符。',
        sound: { cat: '闭镲', hint: '细一点' },
      },
      {
        track: 'SYNTH1', layer: 'bass', octave: -2, mode: 'mono', voice: 'bass',
        notes: [[0, 4, 14], [16, 4, 14], [32, 1, 14], [48, 1, 14], [64, 3, 14], [80, 3, 14], [96, 7, 14], [112, 7, 14]],
        role: '贝斯：每小节一个根音长音，跟着和弦走：F → C → E♭ → B♭，各两小节。',
        sound: { cat: 'BASS', hint: '80 年代合成器贝斯' },
      },
      {
        track: 'SYNTH2', layer: 'chords', octave: -1, mode: 'chord', voice: 'wide', vel: 0.55,
        send: { reverb: 0.5 },
        notes: [[0, 4, 16], [16, 4, 16], [32, 1, 16], [48, 1, 16], [64, 3, 16], [80, 3, 16], [96, 7, 16], [112, 7, 16]],
        role: '和弦：每个两小节（这里每小节按一次）：Fm → Cm → E♭ → B♭。',
        sound: { cat: 'PAD', hint: '80 年代合成器铺底' },
      },
      {
        track: 'DX', layer: 'lead', octave: 1, mode: 'mono', voice: 'lead', vel: 0.9,
        send: { reverb: 0.45, delay: 0.3 },
        notes: [
          [0, 4, 8], [8, 4, 6], [14, 3, 2],
          [16, 4, 2], [18, 5, 4], [22, 1, 4], [26, 3, 6],
          [32, 4, 8], [40, 4, 6], [46, 3, 2],
          [48, 4, 2], [50, 5, 4], [54, 1, 4], [58, 3, 6],
          [64, 7, 2], [66, 5, 4], [70, 4, 4], [74, 3, 6],
          [80, 7, 2], [82, 5, 4], [86, 4, 4], [90, 3, 4], [94, 4, 2],
          [96, 4, 16],
        ],
        role: '旋律：前奏那句合成器——前四小节在 F、G、C、E♭ 之间，后四小节爬到 B♭ 再一级级落回来，最后停在长长的 F 上。',
        sound: { cat: 'SYNTH LEAD', hint: '亮、带一点合唱效果的 80 年代合成器' },
      },
    ],
  },

  // The Chainsmokers & Coldplay《Something Just Like This》（2017）。依据（2026-11-11 查的）：Musicnotes MN0172271、Hooktheory 都是 B 小调、约 103 BPM；
  // 和弦 G – A – Bm – A 各两拍、两小节一圈（Musicnotes、UG 前奏谱、Hooktheory：VI VII i VII）；副歌后那段合成器的音是 synthesizernotes 和
  // piano-keyboard-guide 的简谱（B B C♯ C♯ C♯ D / D D D C♯ C♯ C♯ B），**节奏没有资料**，是照“每个音落在下面那个和弦上”配的；
  // 贝斯：Musicnotes 预览里是八分音符的根音；鼓按 Sheet Music Direct 上一份网友扒谱的 Drop 段。
  'something-just-like-this': {
    bpm: 103,
    swing: 0,
    scale: 0,
    key: 11,
    bars: 2,
    space: { reverb: 2.2, delay: 0.75, feedback: 0.3 },
    origKey: 'B 小调',
    summary: '原调 B 小调：MINOR，KEY 换成 B。两小节一圈，四个和弦各两拍：G → A → Bm → A（键 6 → 7 → 1 → 7）。上面是副歌后那段合成器——只在 B、C♯、D 三个音之间走，下面是八分音符的贝斯。',
    differs: [
      '副歌后那段合成器的音是照简谱的，节奏没有资料，是配的（每个音落在下面那个和弦上）——这一层最可能不像，听的时候请留意。',
      '原曲前半首几乎只有钢琴和人声，鼓到后面才进来；这里一开始就叠在一起。人声没做。',
      '机器 CHORD 弹法的和弦每个多一个音（Gmaj7、A7、Bm7）。',
      '鼓按一份网友扒谱的 Drop 段，原曲底鼓两小节一换，这里只用了第一种。',
    ],
    parts: [
      {
        track: 'KICK', layer: 'drums',
        steps: 'x--x--x-x-------',
        role: '底鼓：Drop 里那种切分的“咚—咚—咚咚”。',
        sound: { cat: 'KICK', hint: '厚、圆' },
      },
      {
        track: 'SNARE', layer: 'drums',
        steps: '----x-------x---',
        send: { reverb: 0.35 },
        role: '军鼓：二、四拍。',
        sound: { cat: 'SNARE', hint: '亮、带一点混响' },
      },
      {
        track: 'HAT1', layer: 'drums',
        steps: 'x-x-x-x-x-x-x-x-',
        role: '闭镲：八分音符。',
        sound: { cat: '闭镲', hint: '轻一点' },
      },
      {
        track: 'SYNTH1', layer: 'bass', octave: -3, mode: 'mono', voice: 'bass',
        notes: [
          [0, 6, 2], [2, 6, 2], [4, 6, 2], [6, 6, 2], [8, 7, 2], [10, 7, 2], [12, 7, 2], [14, 7, 2],
          [16, 1, 2, 1], [18, 1, 2, 1], [20, 1, 2, 1], [22, 1, 2, 1], [24, 7, 2], [26, 7, 2], [28, 7, 2], [30, 7, 2],
        ],
        role: '贝斯：八分音符的根音，一拍两下：G → A → B → A，一级级往上走。',
        sound: { cat: 'BASS', hint: '圆一点' },
      },
      {
        track: 'SYNTH2', layer: 'chords', octave: -1, mode: 'chord', voice: 'piano', vel: 0.2,
        send: { reverb: 0.45 },
        notes: [[0, 6, 8], [8, 7, 8], [16, 1, 8], [24, 7, 8]],
        role: '和弦：四个和弦各两拍：G → A → Bm → A。原曲里是钢琴。',
        sound: { cat: 'PIANO', hint: '钢琴' },
      },
      {
        track: 'DX', layer: 'lead', octave: 1, mode: 'mono', voice: 'lead', vel: 1,
        send: { reverb: 0.5, delay: 0.35 },
        notes: [
          [0, 1, 3], [3, 1, 5], [8, 2, 3], [11, 2, 3], [14, 2, 2],
          [16, 3, 6], [22, 3, 2], [24, 2, 3], [27, 2, 3], [30, 2, 2],
        ],
        role: '旋律：副歌后那段合成器——B、C♯、D 三个音，每个音落在下面那个和弦上（节奏是配的）。',
        sound: { cat: 'SYNTH LEAD', hint: '亮、短一点的合成器' },
      },
    ],
  },

  // The Chainsmokers《Closer》（2016）。依据（2026-11-11 查的）：Hit Songs Deconstructed、Hooktheory、鼓谱、Musicnotes 钢琴独奏版都是 A♭ 大调、95 BPM；
  // 和弦 D♭ – E♭ – Fm – E♭ 两小节一圈，换和弦在第 3 拍的后半拍（Musicnotes 两份预览、HSD）；前奏那句旋律是 Musicnotes MN0167986 预览里的
  // 第 3–4 小节（读的是预览图），HSD 说那是主钩子的一段反复；鼓：底鼓第 1、11 步，响指 / 军鼓第 5、13 步，八分镲（HSD、网友鼓谱）。
  closer: {
    bpm: 95,
    swing: 0,
    scale: 1,
    key: 8,
    bars: 2,
    space: { reverb: 2.2, delay: 0.75, feedback: 0.3 },
    origKey: 'A♭ 大调',
    summary: '原调 A♭ 大调：SCALE 换成第 2 个 MAJOR，KEY 换成 G♯（就是 A♭）。两小节一圈：D♭ → E♭ → Fm → E♭（键 4 → 5 → 6 → 5），换和弦落在第 3 拍的后半拍上。上面是前奏那句在 A♭、B♭ 之间来回的旋律。',
    differs: [
      '旋律是前奏那一小段（在 A♭ 和 B♭ 之间来回），读的是乐谱预览图；Drop 里那段完整的合成器旋律没有免费的谱，没做。',
      '机器 CHORD 弹法的和弦每个多一个音（D♭maj7、E♭7、Fm7），原曲是 D♭add9 这些，听着差不多软。',
      '副歌那种没有底鼓的段落、Drop 里的沙锤都没做，只做了主歌 / Drop 那一圈的鼓。人声没做。',
    ],
    parts: [
      {
        track: 'KICK', layer: 'drums',
        steps: 'x---------x-----',
        role: '底鼓：第 1 步和第 11 步——和换和弦的位置一样。',
        sound: { cat: 'KICK', hint: '软一点、圆一点' },
      },
      {
        track: 'CLAP', layer: 'drums',
        steps: '----x-------x---',
        send: { reverb: 0.3 },
        role: '响指 / 拍手：二、四拍。',
        sound: { cat: 'SNAP', hint: '响指；没有就用拍手' },
      },
      {
        track: 'HAT1', layer: 'drums',
        steps: 'x-X-x-X-x-X-x-X-',
        role: '闭镲：八分音符，后半拍重一点。',
        sound: { cat: '闭镲', hint: '轻、短' },
      },
      {
        track: 'SYNTH1', layer: 'bass', octave: -2, mode: 'mono', voice: 'bass',
        notes: [[0, 4, 10], [10, 5, 6], [16, 6, 10], [26, 5, 6]],
        role: '贝斯：跟着和弦根音：D♭ 一直拖到第 3 拍的后半拍，换成 E♭；下一小节 F，再换 E♭。',
        sound: { cat: 'BASS', hint: '软、圆的合成器贝斯' },
      },
      {
        track: 'SYNTH2', layer: 'chords', octave: -1, mode: 'chord', voice: 'wide', vel: 0.6,
        send: { reverb: 0.55 },
        notes: [[0, 4, 10], [10, 5, 6], [16, 6, 10], [26, 5, 6]],
        role: '和弦：原曲铺满整首的那层软软的合成器和弦，和贝斯同时换。',
        sound: { cat: 'PAD', hint: '软一点、亮一点的合成器' },
      },
      {
        track: 'DX', layer: 'lead', octave: 1, mode: 'mono', voice: 'reed', vel: 0.85,
        send: { reverb: 0.45, delay: 0.3 },
        notes: [
          [2, 1, 2], [4, 1, 2], [6, 2, 2], [8, 2, 2], [10, 1, 2], [12, 1, 2], [14, 2, 2],
          [16, 2, 2], [18, 1, 2], [20, 1, 2], [22, 2, 2], [24, 2, 2], [26, 1, 2], [28, 1, 2], [30, 2, 2],
        ],
        role: '旋律：前奏那句——两个音（A♭、B♭）两下两下地来回，八分音符。',
        sound: { cat: 'SYNTH LEAD', hint: '圆、软一点的合成器' },
      },
    ],
  },

  // Massive Attack《Teardrop》（1998）。依据（2026-11-11 查的）：Hooktheory 标 A Mixolydian、77 BPM，斯图加特媒体大学的分析一致；
  // Musicnotes 标 D 大调（同一组音）、80；和弦 A – G – D – A 一小节一个（同一份分析、Musicnotes 预览）；
  // 那串拨弦（羽管键琴）是读 Musicnotes 预览图读出来的：每小节第 1 步空着，然后八分音符 A E A D A D E，和弦换了它不变；
  // 鼓只有节奏（第 1、2、4、5、9、10、12、13 步有声音），哪下是底鼓、哪下是军鼓没有资料。
  teardrop: {
    bpm: 77,
    swing: 0,
    scale: 6,
    key: 9,
    bars: 4,
    space: { reverb: 3.2, delay: 0.75, feedback: 0.35 },
    origKey: 'A Mixolydian（Musicnotes 标 D 大调，是同一组音）',
    summary: '原调 A Mixolydian：SCALE 换成第 7 个 MIXOLYDIAN，KEY 换成 A。四小节一圈，一小节一个和弦：A → G → D → A（键 1 → 7 → 4 → 1）。上面是那串清冷的拨弦——只有 A、D、E 三个音，和弦换了它也不换；下面是像心跳一样的鼓。',
    differs: [
      '那串拨弦是读乐谱预览图读出来的，D 和 E 有一两处可能读错；每小节最后一个音原曲有时是 E 有时是 A，这里都用 E。',
      '鼓只知道哪几步有声音，哪下是底鼓、哪下是军鼓没有资料：这里把成对的那几下当成“咚咚”的底鼓，二、四拍放军鼓。原曲的鼓是一段放快的采样（Les McCann），音色差得多。',
      '原曲后半段的 F – G – A（第二段）没做：F 不在这个音阶里。人声没做。',
      '贝斯是一个和弦一个长音，原曲是 Moog 合成器的贝斯，跟着鼓点有起伏。',
    ],
    parts: [
      {
        track: 'KICK', layer: 'drums',
        steps: 'xx-x----xx-x----',
        role: '底鼓：“咚咚、咚”，像心跳。',
        sound: { cat: 'KICK', hint: '闷、软' },
      },
      {
        track: 'SNARE', layer: 'drums',
        steps: '----x-------x---',
        send: { reverb: 0.4 },
        role: '军鼓：二、四拍，带一点摩擦感。',
        sound: { cat: 'SNARE', hint: '干一点、有颗粒感' },
      },
      {
        track: 'SYNTH1', layer: 'bass', octave: -3, mode: 'mono', voice: 'bass',
        notes: [[0, 1, 15], [16, 7, 15], [32, 4, 15], [48, 1, 15]],
        role: '贝斯：一个和弦一个长音：A → G → D → A。',
        sound: { cat: 'BASS', hint: '圆、低的合成器贝斯' },
      },
      {
        track: 'SYNTH2', layer: 'chords', octave: -2, mode: 'chord', voice: 'pad', vel: 0.42,
        send: { reverb: 0.7 },
        notes: [[0, 1, 16], [16, 7, 16], [32, 4, 16], [48, 1, 16]],
        role: '和弦：一小节一个，A → G → D → A，轻轻地铺在下面。',
        sound: { cat: 'PAD', hint: '暗、软的铺底' },
      },
      {
        track: 'DX', layer: 'lead', octave: -1, mode: 'mono', voice: 'piano', vel: 0.65, bars: 1,
        send: { reverb: 0.6, delay: 0.3 },
        notes: [[2, 1, 2], [4, 5, 2], [6, 1, 2], [8, 4, 2], [10, 1, 2], [12, 4, 2], [14, 5, 2]],
        role: '旋律：那串拨弦——A、E、A、D、A、D、E，只有一小节，一直重复，和弦换了它也不换。',
        sound: { cat: 'KEYBOARD', hint: '羽管键琴（HARPSICHORD）或者清一点的拨弦' },
      },
    ],
  },

  // The Weeknd《Save Your Tears》（2020）。依据（2026-11-11 查的）：Hooktheory、Musicnotes MN0226716、维基百科、SongBPM、Songsterr 都是 C 大调、118 BPM；
  // 和弦 C – Am7 – Em7 – G 一小节一个（Hooktheory、Musicnotes、Songsterr 贝斯的根音）；钩子是 G 那一小节里的合成器短句 G F E F E，
  // Hooktheory、Songsterr、synthesizernotes 一致；贝斯：Songsterr 是根音八分音符；鼓：底鼓 1、9，军鼓 5、13，八分镲（只有 Songsterr）。
  'save-your-tears': {
    bpm: 118,
    swing: 0,
    scale: 1,
    key: 0,
    bars: 4,
    space: { reverb: 2.4, delay: 0.75, feedback: 0.3 },
    origKey: 'C 大调',
    summary: '原调 C 大调：SCALE 换成第 2 个 MAJOR，KEY 就是 C。四小节一圈，一小节一个和弦：C → Am → Em → G（键 1 → 6 → 3 → 5）。贝斯一拍两下地跟着根音走，第 4 小节那句合成器“G F E F E”是它的钩子。',
    differs: [
      '原曲还有一条琶音的键盘（每小节一上一下地爬），音跨两个八度，这里没做，只做了 G 那一小节的合成器短句。',
      '那句短句最后的 E 原曲是连到下一小节的，这里在循环开头再弹一下 E 代替。',
      '原曲的第二段和弦（Dm – Am – F – G）没做，只做了主歌 / 副歌那一圈。',
      '人声没做。',
    ],
    parts: [
      { track: 'KICK', layer: 'drums', steps: 'x-------x-------', role: '底鼓：第 1、3 拍，80 年代鼓机那种。', sound: { cat: 'KICK', hint: '紧、有点“啪”' } },
      { track: 'SNARE', layer: 'drums', steps: '----x-------x---', send: { reverb: 0.4 }, role: '军鼓：二、四拍，带一片混响。', sound: { cat: 'SNARE', hint: '亮、带混响' } },
      { track: 'HAT1', layer: 'drums', steps: 'x-x-x-x-x-x-x-x-', role: '闭镲：八分音符。', sound: { cat: '闭镲', hint: '细一点' } },
      {
        track: 'SYNTH1', layer: 'bass', octave: -3, mode: 'mono', voice: 'bass',
        notes: [
          [0, 1, 2, 1], [2, 1, 2, 1], [4, 1, 2, 1], [6, 1, 2, 1], [8, 1, 2, 1], [10, 1, 2, 1], [12, 1, 2, 1], [14, 1, 2, 1],
          [16, 6, 2], [18, 6, 2], [20, 6, 2], [22, 6, 2], [24, 6, 2], [26, 6, 2], [28, 6, 2], [30, 6, 2],
          [32, 3, 2], [34, 3, 2], [36, 3, 2], [38, 3, 2], [40, 3, 2], [42, 3, 2], [44, 3, 2], [46, 3, 2],
          [48, 5, 2], [50, 5, 2], [52, 5, 2], [54, 5, 2], [56, 5, 2], [58, 5, 2], [60, 5, 2], [62, 5, 2],
        ],
        role: '贝斯：根音一拍两下，C → A → E → G，往下走。',
        sound: { cat: 'BASS', hint: '80 年代合成器贝斯' },
      },
      {
        track: 'SYNTH2', layer: 'chords', octave: -1, mode: 'chord', voice: 'wide', vel: 0.55,
        send: { reverb: 0.5 },
        notes: [[0, 1, 16], [16, 6, 16], [32, 3, 16], [48, 5, 16]],
        role: '和弦：一小节一个，C → Am → Em → G。',
        sound: { cat: 'PAD', hint: '80 年代合成器铺底' },
      },
      {
        track: 'DX', layer: 'lead', octave: 1, mode: 'mono', voice: 'lead', vel: 1,
        send: { reverb: 0.5, delay: 0.35 },
        notes: [[0, 3, 8], [48, 5, 4], [52, 4, 4], [56, 3, 4], [60, 4, 2], [62, 3, 2]],
        role: '旋律：G 那一小节的合成器短句——G、F、E 一级级往下，再 F、E 晃一下，落到下一圈开头的 E 上。',
        sound: { cat: 'SYNTH LEAD', hint: '80 年代的亮合成器' },
      },
    ],
  },

  // Dua Lipa《Don't Start Now》（2019）。依据（2026-11-11 查的）：维基百科、Musicnotes MN0203029、Songsterr、Hooktheory 都是 B 小调、124 BPM；
  // 和弦 Em – Bm – G – D → A（D 六步、A 十步），四小节一圈（Hooktheory、维基百科、Musicnotes）；贝斯是它的钩子：Hooktheory Instrumental 段、
  // Songsterr 贝斯轨、Musicnotes 预览三份起拍一致（低根音 – 高八度 – 低根音 – 高八度，最后两个十六分往上接下一个根音）；鼓只有 Songsterr（标着 AI 生成）。
  'dont-start-now': {
    bpm: 124,
    swing: 0,
    scale: 0,
    key: 11,
    bars: 4,
    space: { reverb: 2.2, delay: 0.75, feedback: 0.3 },
    origKey: 'B 小调',
    summary: '原调 B 小调：MINOR，KEY 换成 B。四小节一圈：Em → Bm → G → D、A（键 4 → 1 → 6 → 3、7）。钩子是那条迪斯科贝斯——低音、高八度来回跳，每小节最后两下往上接到下一个根音。',
    differs: [
      'Em 那一小节贝斯最后那个 A♯（往 B 上接的经过音）不在 B 小调里，这里把前一个 A 拉长代替。',
      '原曲的人声钩子没做；第二段和弦（Bm7 – D – Em7 – F♯m7 → Gmaj7）也没做。',
      '原曲的拍手和牛铃（维基百科提到）没做；鼓只有一份标着 AI 生成的扒谱，按四踩、二四拍军鼓、八分镲写的。',
    ],
    parts: [
      { track: 'KICK', layer: 'drums', steps: 'x---x---x---x---', role: '底鼓：四踩。', sound: { cat: 'KICK', hint: '紧、厚' } },
      { track: 'SNARE', layer: 'drums', steps: '----x-------x---', send: { reverb: 0.3 }, role: '军鼓：二、四拍。', sound: { cat: 'SNARE', hint: '亮一点' } },
      { track: 'HAT1', layer: 'drums', steps: 'x-x-x-x-x-x-x-x-', role: '闭镲：八分音符。', sound: { cat: '闭镲', hint: '短' } },
      {
        track: 'SYNTH1', layer: 'bass', octave: -2, mode: 'mono', voice: 'bass', vel: 0.85,
        notes: [
          [0, 4, 3, -1], [3, 4, 1], [6, 4, 4, -1], [10, 4, 1], [14, 7, 2, -1],
          [16, 1, 3], [19, 1, 1, 1], [22, 1, 4], [26, 1, 1, 1], [30, 4, 1, -1], [31, 5, 1, -1],
          [32, 6, 3, -1], [35, 6, 1], [38, 6, 4, -1], [42, 6, 1], [46, 1, 1], [47, 2, 1],
          [48, 3, 3], [51, 3, 1, 1], [54, 7, 4, -1], [58, 7, 1], [62, 7, 2, -1],
        ],
        role: '贝斯：整首的钩子。每小节“低—高—低—高”地在根音和高八度之间跳，最后两下往上接下一个根音（E → B → G → D、A）。',
        sound: { cat: 'BASS', hint: '圆、有弹性的电贝斯或合成器贝斯' },
      },
      {
        track: 'SYNTH2', layer: 'chords', octave: -1, mode: 'chord', voice: 'wide', vel: 0.5,
        send: { reverb: 0.55 },
        notes: [[0, 4, 16], [16, 1, 16], [32, 6, 16], [48, 3, 6], [54, 7, 10]],
        role: '和弦：原曲那层弦乐，Em → Bm → G → D、A。',
        sound: { cat: 'STRINGS', hint: '弦乐' },
      },
    ],
  },

  // Daft Punk《Get Lucky》（2013）。依据（2026-11-11 查的）：Hooktheory 标 B Dorian，维基百科说 F♯ 小调、B Dorian，Musicnotes 标 A 大调——都是同一组音；
  // 116 BPM（Hooktheory、维基百科、SongBPM、Songsterr）；和弦 Bm7 – D – F♯m7 – E 一小节一个；Nile Rodgers 那把吉他是 Songsterr 的节奏吉他轨
  // （124 小节里 95 小节一模一样：第 3、5、6、9、12、15、16 步实打）；副歌旋律是 Hooktheory 和 Songsterr 人声轨（两边有几个音不一样，这里取 Songsterr 的）。
  'get-lucky': {
    bpm: 116,
    swing: 0,
    scale: 5,
    key: 11,
    bars: 4,
    space: { reverb: 1.8, delay: 0.75, feedback: 0.25 },
    origKey: 'B Dorian（也有人说 F♯ 小调、A 大调，是同一组音）',
    summary: '原调 B Dorian：SCALE 换成第 6 个 DORIAN，KEY 换成 B。四小节一圈，一小节一个和弦：Bm7 → D → F♯m7 → E（键 1 → 3 → 5 → 4）。和弦用 Nile Rodgers 那把吉他的节奏一下一下“扫”，上面是副歌那句。',
    differs: [
      '那把放克吉他是用 SYNTH 2 的和弦按同样的节奏来“扫”，没有扫弦的闷音那种沙沙声。',
      '贝斯只做了骨架（根音和一下高八度），原曲 Nathan East 的贝斯有很多即兴的过渡音。',
      '旋律是副歌那句，按 Songsterr 的人声轨（Hooktheory 有几个音不一样）；人声没做。',
      '原曲的拍手、第二把单音吉他和合成器独奏没做。',
    ],
    parts: [
      { track: 'KICK', layer: 'drums', steps: 'x-------x-------', role: '底鼓：第 1、3 拍，不是四踩。', sound: { cat: 'KICK', hint: '干、短' } },
      { track: 'SNARE', layer: 'drums', steps: '----x-------x---', send: { reverb: 0.2 }, role: '军鼓：二、四拍（原曲还叠着拍手）。', sound: { cat: 'SNARE', hint: '干一点' } },
      { track: 'HAT1', layer: 'drums', steps: 'x-x-x-x-x-x-x-xx', role: '闭镲：八分音符，最后一拍变成两下。', sound: { cat: '闭镲', hint: '短、脆' } },
      {
        track: 'SYNTH1', layer: 'bass', octave: -3, mode: 'mono', voice: 'bass',
        notes: [
          [0, 1, 4], [4, 1, 2], [7, 1, 1, 1], [10, 1, 2],
          [16, 3, 4], [20, 3, 2], [23, 3, 1, 1], [26, 3, 2],
          [32, 5, 4], [36, 5, 2], [39, 5, 1, 1], [42, 5, 2],
          [48, 4, 4], [52, 4, 2], [55, 4, 1, 1], [58, 4, 2],
        ],
        role: '贝斯：每小节根音“咚—咚、嗒、咚”，中间跳一下高八度：B → D → F♯ → E。',
        sound: { cat: 'BASS', hint: '圆、有弹性的电贝斯' },
      },
      {
        track: 'SYNTH2', layer: 'chords', octave: -1, mode: 'chord', voice: 'keys', vel: 0.32,
        send: { reverb: 0.2 },
        notes: [
          [2, 1, 1], [4, 1, 1], [5, 1, 1], [8, 1, 1], [11, 1, 1], [14, 1, 1], [15, 1, 1],
          [18, 3, 1], [20, 3, 1], [21, 3, 1], [24, 3, 1], [27, 3, 1], [30, 3, 1], [31, 3, 1],
          [34, 5, 1], [36, 5, 1], [37, 5, 1], [40, 5, 1], [43, 5, 1], [46, 5, 1], [47, 5, 1],
          [50, 4, 1], [52, 4, 1], [53, 4, 1], [56, 4, 1], [59, 4, 1], [62, 4, 1], [63, 4, 1],
        ],
        role: '和弦：Nile Rodgers 那把放克吉他的节奏——每小节七下短短的“扫”，落在第 3、5、6、9、12、15、16 步。',
        sound: { cat: 'GUITAR', hint: '干净的电吉他；没有就用短一点的键盘' },
      },
      {
        track: 'DX', layer: 'lead', octave: 0, mode: 'mono', voice: 'reed', vel: 0.95,
        send: { reverb: 0.35, delay: 0.2 },
        notes: [
          [2, 3, 1], [3, 3, 2], [5, 3, 2], [7, 3, 2], [9, 3, 1], [10, 3, 2], [12, 3, 2],
          [18, 3, 1], [19, 3, 2], [21, 3, 2], [23, 3, 2], [25, 3, 1], [26, 3, 2], [28, 3, 2],
          [34, 2, 1], [35, 2, 2], [37, 2, 2], [39, 2, 2], [41, 2, 1], [42, 2, 2], [44, 2, 2],
          [50, 1, 1], [51, 1, 2], [53, 1, 2], [55, 1, 2], [57, 1, 1], [58, 2, 2], [60, 1, 2], [62, 7, 2, -1],
        ],
        role: '旋律：副歌那句——同一个音一句一句地念（D、D、C♯），最后在 E 和弦上落下来（B … C♯ B A）。',
        sound: { cat: 'SYNTH LEAD', hint: '软一点的合成器' },
      },
    ],
  },

  // Harry Styles《As It Was》（2022）。依据（2026-11-11 查的）：Hooktheory、Musicnotes MN0253558、Songsterr 都是 A 大调、174 BPM；
  // 和弦 D – Bm – E – A 各两小节、八小节一圈；那句合成器 riff 是 Hooktheory、Musicnotes、Songsterr、synthesizernotes 四份一致的，
  // 四小节一句、全是八分音符；鼓：两小节一组（底鼓 1、9 / 1、7、11，军鼓 5、13），只有 Songsterr。
  // 这里按半速数（87 BPM）：原来的两小节放进 SEQTRAK 的一小节，八分音符变成十六分，和弦一小节一个。
  'as-it-was': {
    bpm: 87,
    swing: 0,
    scale: 1,
    key: 9,
    bars: 4,
    space: { reverb: 2.2, delay: 0.75, feedback: 0.3 },
    origKey: 'A 大调',
    summary: '原调 A 大调：SCALE 换成第 2 个 MAJOR，KEY 换成 A。原曲是 174 BPM，这里按半速 87 数：原来的两小节放进机器的一小节，和弦一小节一个：D → Bm → E → A（键 4 → 2 → 5 → 1）。上面是那句很亮、一直重复的合成器 riff。',
    differs: [
      '按半速数（87 BPM）写的：听起来一样快，只是机器上一小节装的是原来的两小节，鼓和 riff 的格子更密。',
      'riff 的音长原曲各份谱不太一样（有的更长），这里取中间；人声没做。',
      '贝斯只做了每个和弦两下的根音，原曲副歌里是根音八分音符连打；E 比原曲高一个八度。',
    ],
    parts: [
      { track: 'KICK', layer: 'drums', steps: 'x---x---x--x-x--', role: '底鼓：原曲两小节一组的那种，放进机器的一小节里。', sound: { cat: 'KICK', hint: '紧、干' } },
      { track: 'SNARE', layer: 'drums', steps: '--x---x---x---x-', send: { reverb: 0.3 }, role: '军鼓：原曲的二、四拍（按半速数就落在每拍的后半拍）。', sound: { cat: 'SNARE', hint: '亮、短' } },
      { track: 'HAT1', layer: 'drums', steps: 'XxXxXxXxXxXxXxXx', role: '镲：原曲的八分音符（按半速数就是 16 分），一直走。', sound: { cat: '闭镲', hint: '细；或者 RIDE' } },
      {
        track: 'SYNTH1', layer: 'bass', octave: -3, mode: 'mono', voice: 'bass',
        notes: [[0, 4, 8], [8, 4, 8], [16, 2, 8], [24, 2, 8], [32, 5, 8], [40, 5, 8], [48, 1, 8], [56, 1, 8]],
        role: '贝斯：每个和弦两下根音：D → B → E → A。',
        sound: { cat: 'BASS', hint: '圆一点' },
      },
      {
        track: 'SYNTH2', layer: 'chords', octave: -1, mode: 'chord', voice: 'wide', vel: 0.5,
        send: { reverb: 0.5 },
        notes: [[0, 4, 16], [16, 2, 16], [32, 5, 16], [48, 1, 16]],
        role: '和弦：一小节一个，D → Bm → E → A。',
        sound: { cat: 'PAD', hint: '亮一点的合成器铺底' },
      },
      {
        track: 'DX', layer: 'lead', octave: 0, mode: 'mono', voice: 'lead', vel: 0.85, bars: 2,
        send: { reverb: 0.45, delay: 0.25 },
        notes: [
          [0, 1, 1], [1, 2, 1], [2, 3, 1], [3, 2, 2], [5, 2, 2], [7, 2, 2], [9, 2, 2], [11, 1, 1], [12, 5, 1], [13, 5, 1], [14, 3, 2],
          [16, 1, 1], [17, 2, 1], [18, 3, 1], [19, 2, 2], [21, 2, 2], [23, 2, 2], [25, 2, 2], [27, 1, 1], [28, 2, 2], [30, 1, 2],
        ],
        role: '旋律：那句合成器 riff——A、B、C♯ 往上一爬，在 B 上连敲几下，再跳到最高的 E 落回 C♯；第二遍收在 B、A 上。两小节一句，自己重复。',
        sound: { cat: 'SYNTH LEAD', hint: '很亮的合成器' },
      },
    ],
  },

  // Ed Sheeran《Shape of You》（2017）。依据（2026-11-11 查的）：维基百科、Hooktheory、SongBPM、Musicnotes MN0177943、Splice 都是 C♯ 小调、96 BPM；
  // 和弦 C♯m – F♯m │ A – B，各两拍、两小节一圈（维基百科 i–iv–VI–VII、Hooktheory、Musicnotes）；前奏那段马林巴是 Hooktheory 前奏段，
  // Songsterr 翻弹谱和 pianoletternotes 一致（3+3+2 的节奏）；贝斯按同样的 3+3+2 弹根音（Musicnotes、Songsterr）；鼓是 Songsterr 网友谱的副歌（dancehall 式）。
  'shape-of-you': {
    bpm: 96,
    swing: 0,
    scale: 0,
    key: 1,
    bars: 2,
    space: { reverb: 1.6, delay: 0.75, feedback: 0.25 },
    origKey: 'C♯ 小调',
    summary: '原调 C♯ 小调：MINOR，KEY 换成 C♯。两小节一圈，四个和弦各两拍：C♯m → F♯m → A → B（键 1 → 4 → 6 → 7）。前奏那段像马林巴的短循环和贝斯都是“3 + 3 + 2”的节奏——这首歌的律动就在这儿。',
    differs: [
      '原曲的马林巴、吉他拍板这些音色，这里用应用自带的音色代替；人声没做。',
      '原曲底鼓到第一个副歌才进来，这里一开始就有；鼓按 Songsterr 网友谱的副歌写（dancehall 式的军鼓），没有镲。',
      '机器 CHORD 弹法的和弦每个多一个音（C♯m7、F♯m7、Amaj7、B7）。',
    ],
    parts: [
      { track: 'KICK', layer: 'drums', steps: 'x-------x-------', role: '底鼓：第 1、3 拍。', sound: { cat: 'KICK', hint: '软、圆' } },
      { track: 'SNARE', layer: 'drums', steps: '---x--x----x--x-', send: { reverb: 0.25 }, role: '军鼓：dancehall 式的“3 + 3 + 2”，落在第 4、7、12、15 步。', sound: { cat: 'SNARE', hint: '干、短，或者拍手' } },
      {
        track: 'SYNTH1', layer: 'bass', octave: -3, mode: 'mono', voice: 'bass',
        notes: [
          [0, 1, 3, 1], [3, 1, 3, 1], [6, 1, 2, 1], [8, 4, 3], [11, 4, 3], [14, 4, 2],
          [16, 6, 3], [19, 6, 3], [22, 6, 2], [24, 7, 3], [27, 7, 3], [30, 7, 2],
        ],
        role: '贝斯：根音按“3 + 3 + 2”弹：C♯ → F♯ → A → B。',
        sound: { cat: 'BASS', hint: '圆、短一点' },
      },
      {
        track: 'SYNTH2', layer: 'chords', octave: -1, mode: 'chord', voice: 'wide', vel: 0.6,
        send: { reverb: 0.45 },
        notes: [[0, 1, 8], [8, 4, 8], [16, 6, 8], [24, 7, 8]],
        role: '和弦：四个和弦各两拍，C♯m → F♯m → A → B，轻轻铺在下面。',
        sound: { cat: 'PAD', hint: '软一点的铺底' },
      },
      {
        track: 'DX', layer: 'lead', octave: 1, mode: 'mono', voice: 'keys', vel: 0.8,
        send: { reverb: 0.3, delay: 0.2 },
        notes: [
          [0, 1, 3], [3, 3, 3], [6, 1, 2], [8, 1, 3], [11, 3, 3], [14, 1, 2],
          [16, 1, 3], [19, 3, 3], [22, 1, 2], [24, 2, 3], [27, 1, 3], [30, 7, 2, -1],
        ],
        role: '旋律：前奏那段像马林巴的短循环——C♯、E 来回，“3 + 3 + 2”的节奏，第二小节落到 D♯、C♯、低一点的 B。',
        sound: { cat: 'MALLET', hint: '马林巴一类的敲击音色' },
      },
    ],
  },

  // Tones and I《Dance Monkey》（2019）。依据（2026-11-11 查的）：Hooktheory、Musicnotes MN0200033 都是 F♯ 小调、98 BPM，带十六分音符的摇摆
  // （Hooktheory 摇摆系数 0.64，Sound On Sound 的访谈说贝斯是故意摇摆的）；和弦 F♯m – D – E – C♯m 一小节一个（Musicnotes、Hooktheory：i–VI–VII–v）；
  // 钩子是八分音符的键盘和弦（Sound On Sound 访谈原话）和副歌旋律（Hooktheory 副歌段）；贝斯每小节第 1、7、13 步（Musicnotes、Songsterr）；
  // 副歌是四踩底鼓（Sound On Sound）；响指 / 拍手的位置没有资料。
  'dance-monkey': {
    bpm: 98,
    swing: 30,
    scale: 0,
    key: 6,
    bars: 4,
    space: { reverb: 2, delay: 0.75, feedback: 0.3 },
    origKey: 'F♯ 小调',
    summary: '原调 F♯ 小调：MINOR，KEY 换成 F♯，带一点摇摆。四小节一圈，一小节一个和弦：F♯m → D → E → C♯m（键 1 → 6 → 7 → 5）。和弦一拍两下地敲（这就是它的钩子），上面是副歌那句。',
    differs: [
      '原曲换和弦会提前半拍抢进来，这里没做，每小节第 1 下才换。',
      '响指 / 拍手的位置没有资料，按二、四拍放的。',
      '旋律是副歌那句，按 Hooktheory 的谱；人声没做。',
      '摇摆量是按资料估的（读数 30 左右）。',
    ],
    parts: [
      { track: 'KICK', layer: 'drums', steps: 'x---x---x---x---', role: '底鼓：副歌是四踩。', sound: { cat: 'KICK', hint: '圆、不要太重' } },
      { track: 'CLAP', layer: 'drums', steps: '----x-------x---', send: { reverb: 0.3 }, role: '响指 / 拍手：二、四拍（资料里没写具体位置）。', sound: { cat: 'SNAP', hint: '响指；没有就用拍手' } },
      {
        track: 'SYNTH1', layer: 'bass', octave: -3, mode: 'mono', voice: 'bass',
        notes: [
          [0, 1, 6, 1], [6, 1, 6, 1], [12, 1, 4, 1], [16, 6, 6], [22, 6, 6], [28, 6, 4],
          [32, 7, 6], [38, 7, 6], [44, 7, 4], [48, 5, 6], [54, 5, 6], [60, 5, 4],
        ],
        role: '贝斯：每小节三下根音（第 1、7、13 步）：F♯ → D → E → C♯。',
        sound: { cat: 'BASS', hint: '圆、有弹性' },
      },
      {
        track: 'SYNTH2', layer: 'chords', octave: -1, mode: 'chord', voice: 'keys', vel: 0.3,
        send: { reverb: 0.35 },
        notes: [
          [0, 1, 1], [2, 1, 1], [4, 1, 1], [6, 1, 1], [8, 1, 1], [10, 1, 1], [12, 1, 1], [14, 1, 1],
          [16, 6, 1], [18, 6, 1], [20, 6, 1], [22, 6, 1], [24, 6, 1], [26, 6, 1], [28, 6, 1], [30, 6, 1],
          [32, 7, 1], [34, 7, 1], [36, 7, 1], [38, 7, 1], [40, 7, 1], [42, 7, 1], [44, 7, 1], [46, 7, 1],
          [48, 5, 1], [50, 5, 1], [52, 5, 1], [54, 5, 1], [56, 5, 1], [58, 5, 1], [60, 5, 1], [62, 5, 1],
        ],
        role: '和弦：那条八分音符的键盘——一拍两下地敲和弦，F♯m → D → E → C♯m。原曲的钩子就是它。',
        sound: { cat: 'KEYBOARD', hint: '短、亮的电钢琴或合成器' },
      },
      {
        track: 'DX', layer: 'lead', octave: 1, mode: 'mono', voice: 'lead', vel: 1,
        send: { reverb: 0.4, delay: 0.25 },
        notes: [
          [0, 3, 2], [2, 3, 1], [3, 3, 1], [4, 2, 2], [6, 2, 1], [7, 2, 1], [8, 2, 2], [10, 1, 1], [11, 1, 1], [12, 3, 1], [13, 3, 2], [15, 1, 5],
          [27, 7, 1, -1], [28, 3, 2], [30, 3, 1], [31, 2, 3],
          [34, 2, 1], [35, 1, 1], [36, 2, 1], [37, 1, 1], [38, 2, 1], [39, 1, 2], [41, 2, 2], [43, 1, 1], [44, 3, 2], [46, 2, 2],
          [48, 1, 2], [50, 3, 2], [56, 1, 4], [60, 1, 2],
        ],
        role: '旋律：副歌那句——在 A、G♯、F♯ 三个音上一级级往下念，第三小节在 G♯、F♯ 之间来回晃。',
        sound: { cat: 'SYNTH LEAD', hint: '亮一点的合成器' },
      },
    ],
  },

  // Dua Lipa《Levitating》（2020）。依据（2026-11-11 查的）：维基百科、Hooktheory、Musicnotes MN0258667、Songsterr 都是 B 小调；速度 103（维基百科、SongBPM、
  // Hooktheory）或 104（Musicnotes、Songsterr 另一份）；和弦 Bm7 – F♯m7 │ Em7 – Bm7 各两拍、两小节一圈；贝斯是 Hooktheory ft. DaBaby 的 Instrumental 段和
  // Songsterr s476682 一致的那条（低根音 – 高八度 – 下一个根音）；副歌后段的钩子是 Hooktheory “Chorus Lead-Out” 和 Songsterr 人声轨；鼓是 Songsterr 两份独立谱一致的。
  levitating: {
    bpm: 103,
    swing: 0,
    scale: 0,
    key: 11,
    bars: 4,
    space: { reverb: 2, delay: 0.75, feedback: 0.3 },
    origKey: 'B 小调',
    summary: '原调 B 小调：MINOR，KEY 换成 B。和弦两小节一圈：Bm → F♯m → Em → Bm（键 1 → 5 → 4 → 1），贝斯在根音和高八度之间跳——迪斯科的味道全在它身上；上面是副歌后那段钩子，四小节一句。',
    differs: [
      '贝斯里原曲有几个音阶外的经过音（F、A♯），这里去掉了；八度跳得比原曲规整一点。',
      '钩子用的是副歌后那一段（Chorus Lead-Out），人声没做。',
      '原曲的合成铜管（一拍一个和弦）简化成了每个和弦一个长音。',
    ],
    parts: [
      { track: 'KICK', layer: 'drums', steps: 'x-------x-------', role: '底鼓：第 1、3 拍。', sound: { cat: 'KICK', hint: '紧、干' } },
      { track: 'SNARE', layer: 'drums', steps: '----x-------x---', send: { reverb: 0.3 }, role: '军鼓：二、四拍。', sound: { cat: 'SNARE', hint: '亮一点' } },
      { track: 'HAT1', layer: 'drums', steps: 'x-x-x-x-x-x-x-x-', role: '闭镲：八分音符。', sound: { cat: '闭镲', hint: '短' } },
      {
        track: 'SYNTH1', layer: 'bass', octave: -3, mode: 'mono', voice: 'bass', vel: 0.85, bars: 2,
        notes: [
          [0, 1, 3], [3, 1, 1, 1], [6, 4, 2], [8, 5, 3], [11, 5, 1, 1], [12, 5, 1], [13, 5, 1],
          [16, 4, 3], [19, 4, 1, 1], [22, 7, 2], [24, 1, 3, 1], [27, 1, 1, 2], [28, 7, 1], [30, 5, 2],
        ],
        role: '贝斯：迪斯科贝斯——低根音、跳高八度、再走到下一个根音（B → E → F♯，E → A → B）。两小节，自己重复。',
        sound: { cat: 'BASS', hint: '有弹性的合成器贝斯' },
      },
      {
        track: 'SYNTH2', layer: 'chords', octave: -2, mode: 'chord', voice: 'wide', vel: 0.6, bars: 2,
        send: { reverb: 0.5 },
        notes: [[0, 1, 8], [8, 5, 8], [16, 4, 8], [24, 1, 8]],
        role: '和弦：各两拍，Bm → F♯m → Em → Bm。原曲是一层合成铜管。',
        sound: { cat: 'BRASS', hint: '合成铜管；没有就用铺底' },
      },
      {
        track: 'DX', layer: 'lead', octave: 0, mode: 'mono', voice: 'lead', vel: 0.85,
        send: { reverb: 0.45, delay: 0.3 },
        notes: [
          [4, 3, 1], [5, 3, 1], [6, 3, 1], [7, 3, 1], [8, 2, 2], [10, 7, 1, -1], [11, 7, 1, -1], [13, 5, 1, -1], [14, 1, 2],
          [20, 3, 1], [21, 3, 1], [22, 3, 1], [23, 3, 1], [24, 4, 2], [26, 2, 1], [27, 2, 1], [29, 2, 1], [30, 3, 1], [31, 2, 1],
          [36, 3, 1], [37, 3, 1], [38, 3, 1], [39, 3, 1], [40, 2, 2], [42, 7, 1, -1], [43, 7, 1, -1], [45, 5, 1, -1], [46, 1, 2],
          [48, 1, 2], [50, 1, 2, 1], [52, 7, 2], [54, 6, 2], [56, 5, 2], [59, 5, 1], [60, 4, 1], [61, 3, 1], [62, 1, 1], [63, 7, 1, -1],
        ],
        role: '旋律：副歌后那段钩子——四下 D 连着念，再往下落；最后一句从高 B 一路滑下来。',
        sound: { cat: 'SYNTH LEAD', hint: '亮一点的合成器' },
      },
    ],
  },

  // Glass Animals《Heat Waves》（2020）。依据（2026-11-11 查的）：Hooktheory、SongBPM、Musicnotes MN0233385 都是 B 大调（维基百科说也可以当 C♯ Dorian）、81 BPM；
  // 和弦 C♯m – B │ G♯m – F♯ │ E – B │ C♯m – F♯，各两拍、四小节一圈（Musicnotes、Hooktheory、Songsterr）；副歌旋律是 Hooktheory 副歌和 Songsterr 主唱轨，
  // 只用 B、C♯、D♯ 三个音；贝斯是 Songsterr 的根音；鼓只有 Songsterr（16 分镲）。
  'heat-waves': {
    bpm: 81,
    swing: 0,
    scale: 1,
    key: 11,
    bars: 4,
    space: { reverb: 2.6, delay: 0.75, feedback: 0.35 },
    origKey: 'B 大调（也可以当 C♯ Dorian）',
    summary: '原调 B 大调：SCALE 换成第 2 个 MAJOR，KEY 换成 B。慢，四小节一圈，八个和弦各两拍：C♯m → B → G♯m → F♯ → E → B → C♯m → F♯。上面是副歌那句——只用 B、C♯、D♯ 三个音。',
    differs: [
      '原曲那把一直在弹十六分分解和弦的吉他没做（音跨两个八度、太密），和弦用一层铺底代替。',
      '贝斯有几个比原曲高一个八度（G♯、F♯、E）：再低就超出机器的八度范围了。',
      '鼓只有一份网友谱；原曲的贝斯是一段降了调的人声采样，这里用合成器贝斯。人声没做。',
    ],
    parts: [
      { track: 'KICK', layer: 'drums', steps: 'x-------x-x-----', role: '底鼓：第 1、3 拍，第 3 拍后面半拍补一下。', sound: { cat: 'KICK', hint: '808 那种低沉的' } },
      { track: 'SNARE', layer: 'drums', steps: '----x-------x---', send: { reverb: 0.35 }, role: '军鼓：二、四拍（原曲还叠着拍手）。', sound: { cat: 'SNARE', hint: '软一点' } },
      { track: 'HAT1', layer: 'drums', steps: 'xxxxxxxxxxxxxxxx', role: '闭镲：碎碎的 16 分音符。', sound: { cat: '闭镲', hint: '细、轻' } },
      {
        track: 'SYNTH1', layer: 'bass', octave: -3, mode: 'mono', voice: 'bass',
        notes: [[0, 2, 6], [7, 2, 1], [8, 1, 8], [16, 6, 8], [24, 5, 8], [32, 4, 8], [40, 1, 8], [48, 2, 6], [55, 2, 1], [56, 5, 8]],
        role: '贝斯：跟着和弦的根音，每个和弦一个长音：C♯ → B → G♯ → F♯ → E → B → C♯ → F♯。',
        sound: { cat: 'BASS', hint: '圆、低' },
      },
      {
        track: 'SYNTH2', layer: 'chords', octave: -2, mode: 'chord', voice: 'wide', vel: 0.45,
        send: { reverb: 0.6, delay: 0.1 },
        notes: [[0, 2, 8], [8, 1, 8], [16, 6, 8], [24, 5, 8], [32, 4, 8], [40, 1, 8], [48, 2, 8], [56, 5, 8]],
        role: '和弦：八个和弦各两拍。原曲是吉他一直在弹的分解和弦，这里铺成长音。',
        sound: { cat: 'PAD', hint: '暖、软的铺底' },
      },
      {
        track: 'DX', layer: 'lead', octave: 0, mode: 'mono', voice: 'reed', vel: 0.9,
        send: { reverb: 0.5, delay: 0.3 },
        notes: [
          [2, 1, 2], [4, 1, 2], [6, 1, 1], [7, 1, 1], [8, 3, 1], [9, 3, 1], [10, 2, 1], [11, 2, 1], [12, 2, 4],
          [18, 1, 2], [20, 1, 2], [22, 1, 1], [23, 1, 1], [24, 3, 1], [25, 3, 1], [26, 2, 2], [28, 2, 3], [31, 1, 1],
          [34, 1, 2], [36, 1, 2], [38, 1, 2], [40, 3, 1], [41, 3, 1], [42, 2, 2], [44, 2, 4],
          [50, 1, 2], [52, 1, 2], [54, 1, 2], [56, 3, 1], [57, 3, 1], [58, 2, 2], [60, 2, 3], [63, 1, 1],
        ],
        role: '旋律：副歌那句——在 B 上念几下，跳到 D♯，落在长长的 C♯ 上。四小节几乎一样，懒洋洋的。',
        sound: { cat: 'SYNTH LEAD', hint: '软、圆的合成器' },
      },
    ],
  },

  // Marshmello ft. Bastille《Happier》（2018）。依据（2026-11-11 查的）：Hooktheory、SongBPM、Musicnotes MN0188676 都是 F 大调、100 BPM
  // （另两份 Musicnotes 标 D 小调，是同一组音）；和弦按 Musicnotes 和两份 Songsterr（451076、4231246）的贝斯：Dm – C/E │ F – Am │ B♭ │ B♭ – C
  // （Hooktheory 第 1 小节的低音写 F → G，少数）；Drop 旋律是 Hooktheory “Chorus Lead-Out”、Songsterr 451076 主音吉他、pianoletternotes 三份一致的；
  // 贝斯按 Songsterr 451076 那段的八分音符；鼓两份 Songsterr 互相矛盾，只取了一致的（底鼓第 1、11 步，军鼓二、四拍），镲是配的。
  happier: {
    bpm: 100,
    swing: 0,
    scale: 1,
    key: 5,
    bars: 4,
    space: { reverb: 2.4, delay: 0.75, feedback: 0.32 },
    origKey: 'F 大调（也有谱写成 D 小调，同一组音）',
    summary: '原调 F 大调：SCALE 换成第 2 个 MAJOR，KEY 换成 F。四小节一圈：Dm → C │ F → Am │ B♭ │ B♭ → C（键 6 → 5 │ 1 → 3 │ 4 │ 4 → 5）。上面是 Drop 那句干净的合成器旋律：每小节前两格空着，然后“3 + 3 + 3 + 3 + 2”地走，前三下都是 F。',
    differs: [
      '第 1 小节的低音各家不一样（D → E 或 F → G），这里按多数用 D → E。',
      '鼓只有两份互相矛盾的网友谱，只取了它们一致的：底鼓第 1、11 步，军鼓二、四拍；反拍的镲是配的。',
      '原曲 Drop 里的和弦会跟着底鼓一下一下“喘气”（侧链压缩），这里是长音铺着；人声没做。',
      '机器 CHORD 弹法的和弦每个多一个音（Dm7、C7、Fmaj7、Am7、B♭maj7）。',
    ],
    parts: [
      { track: 'KICK', layer: 'drums', steps: 'x---------x-----', role: '底鼓：第 1 步和第 11 步，不是四踩，松一点。', sound: { cat: 'KICK', hint: '圆、厚' } },
      { track: 'SNARE', layer: 'drums', steps: '----x-------x---', send: { reverb: 0.35 }, role: '军鼓：二、四拍（原曲是拍手叠军鼓）。', sound: { cat: 'SNARE', hint: '亮一点，或者拍手' } },
      { track: 'HAT1', layer: 'drums', steps: '--x---x---x---x-', role: '闭镲：每拍后半拍一下（这一条是配的）。', sound: { cat: '闭镲', hint: '短、轻' } },
      {
        track: 'SYNTH1', layer: 'bass', octave: -3, mode: 'mono', voice: 'bass',
        notes: [
          [0, 6, 2], [2, 6, 2], [4, 6, 2], [6, 6, 2], [8, 6, 2], [10, 7, 2], [12, 7, 2], [14, 7, 2],
          [16, 1, 2, 1], [18, 1, 2, 1], [20, 1, 2, 1], [22, 1, 2, 1], [24, 1, 2, 1], [26, 1, 2, 1], [28, 5, 2], [30, 5, 2],
          [32, 4, 2], [34, 4, 2], [36, 4, 2], [38, 4, 2], [40, 4, 2], [42, 4, 2], [44, 4, 2], [46, 4, 2],
          [48, 4, 2], [50, 4, 2], [52, 4, 2], [54, 4, 2], [56, 4, 2], [58, 4, 2], [60, 5, 2], [62, 5, 2],
        ],
        role: '贝斯：八分音符一直走，跟着和弦换：D → E │ F → C │ B♭ │ B♭ → C。',
        sound: { cat: 'BASS', hint: '圆、厚的合成器贝斯' },
      },
      {
        track: 'SYNTH2', layer: 'chords', octave: -1, mode: 'chord', voice: 'wide', vel: 0.55,
        send: { reverb: 0.5 },
        notes: [[0, 6, 10], [10, 5, 6], [16, 1, 12], [28, 3, 4], [32, 4, 16], [48, 4, 12], [60, 5, 4]],
        role: '和弦：又宽又亮的那种（Future Bass），Dm → C │ F → Am │ B♭ │ B♭ → C。',
        sound: { cat: 'SYNTH PAD', hint: '宽、亮的合成器和弦' },
      },
      {
        track: 'DX', layer: 'lead', octave: 1, mode: 'mono', voice: 'lead', vel: 0.85,
        send: { reverb: 0.35, delay: 0.25 },
        notes: [
          [2, 1, 3], [5, 1, 3], [8, 1, 3], [11, 2, 3], [14, 3, 2],
          [18, 1, 3], [21, 1, 3], [24, 1, 3], [27, 5, 3], [30, 3, 2],
          [34, 1, 3], [37, 1, 3], [40, 1, 3], [43, 2, 3], [46, 3, 2],
          [50, 1, 3], [53, 1, 3], [56, 1, 3], [59, 7, 3, -1], [62, 5, 2, -1],
        ],
        role: '旋律：Drop 那句——每小节 F、F、F 三下，再往上走（G、A），第二小节跳到高 C，第四小节往下落（E、C）。',
        sound: { cat: 'SYNTH LEAD', hint: '干净、亮的合成器，短一点' },
      },
    ],
  },

  // Calvin Harris & Dua Lipa《One Kiss》（2018）。依据（2026-11-11 查的）：124 BPM（维基百科、Hooktheory、SongBPM、Songsterr）；
  // 调各家叫法不一样（维基百科 F 大调、Hooktheory A Phrygian、SongBPM A 小调），都是一个降号那 7 个音，围着 A 转；和弦 Am – B♭maj7 – Fmaj7 – G（维基百科、
  // Top40Theory、Hooktheory、两份 Songsterr 的低音都一致）；那段风琴一样的和弦 riff 按 Top40Theory 的钢琴卷帘图：最低一直是 A，上面两个音在 C-E、D-F 之间摆；
  // 贝斯是两份 Songsterr 一致的八分音符；鼓是两份 Songsterr 一致的四踩、二四拍拍手、反拍镲；旋律只有 Hooktheory、Top40Theory 和 pianoletternotes 的头一句。
  'one-kiss': {
    bpm: 124,
    swing: 0,
    scale: 7,
    key: 9,
    bars: 4,
    space: { reverb: 1.8, delay: 0.75, feedback: 0.28 },
    origKey: 'A Phrygian（也有谱写成 F 大调、A 小调、D 小调，都是同一组音）',
    summary: '这首的音和 F 大调一样，但一直围着 A 转。机器上 SCALE 换成第 8 个 PHRYGIAN、KEY 换成 A 最顺：这时候和弦键按下去最低的音一直是 A，和原曲那段风琴一样的 riff 是一个味道。四小节：Am → B♭ → F → F、G（和弦键 1 → 2 → 6 → 6、2），贝斯八分音符一直走（键 1 → 2 → 6 → 6、7）。',
    differs: [
      '第 4 小节原曲那段 riff 里有两下单音，这里用和弦代替；最后那个 G 和弦各家写法不同，这里用不含 B 的那种（G、A、B♭、D、F 一起响）。',
      '旋律只有副歌头一句“One kiss is all it takes”和下一句的开头，两小节一遍，转两遍；人声没做。',
      'Phrygian 是这首歌在机器上最顺手的叫法，不是说原曲“是”弗里几亚调式——各家对调的叫法不一样。',
    ],
    parts: [
      { track: 'KICK', layer: 'drums', steps: 'x---x---x---x---', role: '底鼓：四踩，House 的底子。', sound: { cat: 'KICK', hint: '紧、有力' } },
      { track: 'CLAP', layer: 'drums', steps: '----x-------x---', send: { reverb: 0.3 }, role: '拍手：二、四拍（原曲拍手叠军鼓）。', sound: { cat: 'CLAP', hint: '亮一点的拍手' } },
      { track: 'HAT1', layer: 'drums', steps: '--x---x---x---x-', role: '闭镲：每拍后半拍一下。', sound: { cat: '闭镲', hint: '短、脆' } },
      {
        track: 'SYNTH1', layer: 'bass', octave: -2, mode: 'mono', voice: 'bass', vel: 0.68,
        notes: [
          [0, 1, 2], [2, 1, 2], [4, 1, 2], [6, 1, 2], [8, 1, 2], [10, 1, 2], [12, 1, 2], [14, 3, 2],
          [16, 2, 2], [18, 2, 2], [20, 2, 2], [22, 2, 2], [24, 2, 2], [26, 2, 2], [28, 2, 2], [30, 2, 2],
          [32, 6, 2, -1], [34, 6, 2, -1], [36, 6, 2, -1], [38, 6, 2, -1], [40, 6, 2, -1], [42, 6, 2, -1], [44, 6, 2, -1], [46, 6, 2, -1],
          [48, 6, 2, -1], [50, 6, 2, -1], [52, 6, 2, -1], [54, 6, 2, -1], [56, 7, 2, -1], [58, 7, 2, -1], [60, 7, 2, -1], [62, 7, 2, -1],
        ],
        role: '贝斯：八分音符一下一下地跳：A（最后一下 C）│ B♭ │ F │ F → G。',
        sound: { cat: 'BASS', hint: '短、有弹性，90 年代 House 那种' },
      },
      {
        track: 'SYNTH2', layer: 'chords', octave: -1, mode: 'chord', voice: 'reed', vel: 0.45,
        send: { reverb: 0.3 },
        notes: [[0, 1, 14], [14, 1, 2], [16, 2, 14], [30, 2, 2], [32, 6, 14], [46, 6, 2], [48, 6, 8], [56, 2, 6], [62, 2, 2]],
        role: '和弦：那段像风琴的 riff——每小节一个长和弦，最后一格再按一下；最低的音一直是 A。',
        sound: { cat: 'ORGAN', hint: '风琴；没有就用亮一点的键盘' },
      },
      {
        track: 'DX', layer: 'lead', octave: 0, mode: 'mono', voice: 'lead', vel: 1, bars: 2,
        send: { reverb: 0.35, delay: 0.25 },
        notes: [[0, 5, 3], [3, 4, 3], [6, 3, 2], [8, 3, 2], [10, 4, 2], [12, 4, 4], [19, 5, 1], [20, 3, 1], [21, 3, 1], [22, 3, 1], [24, 3, 2]],
        role: '旋律：副歌头一句“One kiss is all it takes”——E、D、C、C、D、D，一级级往下再回来；下一句开个头。',
        sound: { cat: 'SYNTH LEAD', hint: '软一点的合成器' },
      },
    ],
  },

  // Avicii《The Nights》（2014）。依据（2026-11-11 查的）：Hooktheory D♯ 小调、SongBPM F♯ 大调、TutorialsByHugo E♭ 小调（同一组音），都是 126 BPM
  // （另两份 Musicnotes 印的 E 小调是移过调的版本）；和弦 B – F♯ – C♯ – D♯m 一小节一个（Hooktheory、Songsterr 502726）；Drop 旋律是 Hooktheory 副歌段、
  // Songsterr 502726、889078 三份一致的，第 4 小节按两份 Songsterr；贝斯是两份 Songsterr 一致的八分音符根音；鼓按 Songsterr 889078（四踩、二四拍、反拍开镲）。
  'the-nights': {
    bpm: 126,
    swing: 0,
    scale: 1,
    key: 6,
    bars: 4,
    space: { reverb: 2.2, delay: 0.75, feedback: 0.3 },
    origKey: 'F♯ 大调（也写成 D♯ 小调）',
    summary: '原调 F♯ 大调：SCALE 换成第 2 个 MAJOR，KEY 换成 F♯。四小节一圈，一小节一个和弦：B → F♯ → C♯ → D♯m（键 4 → 1 → 5 → 6）。上面是 Drop 那句——几乎全是 F♯，中间夹两下低一点的 C♯、D♯，第四小节往上走（G♯、A♯）。',
    differs: [
      '原曲的和弦每次都提前一个 16 分音符进来，这里没做，每小节第 1 下才换；第 4 小节原曲有的版本是 D♯m 换 C♯，这里整小节 D♯m。',
      'Drop 里那段军鼓有的谱有、有的没有，这里用拍手放在二、四拍。',
      '原曲的人声和前面的钢琴没做。',
      '机器 CHORD 弹法的和弦每个多一个音（Bmaj7、F♯maj7、C♯7、D♯m7）。',
    ],
    parts: [
      { track: 'KICK', layer: 'drums', steps: 'x---x---x---x---', role: '底鼓：四踩。', sound: { cat: 'KICK', hint: '紧、有力' } },
      { track: 'CLAP', layer: 'drums', steps: '----x-------x---', send: { reverb: 0.35 }, role: '拍手：二、四拍。', sound: { cat: 'CLAP', hint: '亮一点' } },
      { track: 'HAT2', layer: 'drums', steps: '--x---x---x---x-', role: '开镲：每拍后半拍一下，“咚—嚓—咚—嚓”。', sound: { cat: '开镲', hint: '短一点的开镲' } },
      {
        track: 'SYNTH1', layer: 'bass', octave: -3, mode: 'mono', voice: 'bass',
        notes: [
          [0, 4, 2], [2, 4, 2], [4, 4, 2], [6, 4, 2], [8, 4, 2], [10, 4, 2], [12, 4, 2], [14, 4, 2],
          [16, 1, 2, 1], [18, 1, 2, 1], [20, 1, 2, 1], [22, 1, 2, 1], [24, 1, 2, 1], [26, 1, 2, 1], [28, 1, 2, 1], [30, 1, 2, 1],
          [32, 5, 2], [34, 5, 2], [36, 5, 2], [38, 5, 2], [40, 5, 2], [42, 5, 2], [44, 5, 2], [46, 5, 2],
          [48, 6, 2], [50, 6, 2], [52, 6, 2], [54, 6, 2], [56, 6, 2], [58, 6, 2], [60, 6, 2], [62, 6, 2],
        ],
        role: '贝斯：八分音符弹根音，B → F♯ → C♯ → D♯。',
        sound: { cat: 'BASS', hint: '厚一点的合成器贝斯' },
      },
      {
        track: 'SYNTH2', layer: 'chords', octave: -1, mode: 'chord', voice: 'wide', vel: 0.55,
        send: { reverb: 0.5 },
        notes: [[0, 4, 16], [16, 1, 16], [32, 5, 16], [48, 6, 16]],
        role: '和弦：一小节一个，B → F♯ → C♯ → D♯m，铺在下面。',
        sound: { cat: 'SYNTH PAD', hint: '宽、亮的合成器和弦' },
      },
      {
        track: 'DX', layer: 'lead', octave: 1, mode: 'mono', voice: 'lead', vel: 0.85,
        send: { reverb: 0.35, delay: 0.25 },
        notes: [
          [0, 1, 2], [2, 1, 2], [4, 5, 1, -1], [5, 6, 1, -1], [6, 1, 2], [8, 1, 2], [10, 1, 2], [12, 5, 1, -1], [13, 6, 1, -1], [14, 1, 2],
          [16, 1, 2], [18, 1, 2], [20, 5, 1, -1], [21, 6, 1, -1], [22, 1, 2], [24, 1, 2], [26, 1, 2], [28, 5, 1, -1], [29, 6, 1, -1], [30, 1, 2],
          [32, 1, 2], [34, 1, 2], [36, 5, 1, -1], [37, 6, 1, -1], [38, 1, 2], [40, 1, 2], [42, 1, 2], [44, 5, 1, -1], [45, 6, 1, -1], [46, 1, 2],
          [48, 1, 2], [50, 1, 2], [52, 5, 1, -1], [53, 6, 1, -1], [54, 1, 2], [56, 1, 2], [58, 2, 2], [60, 3, 2], [62, 5, 1, -1], [63, 6, 1, -1],
        ],
        role: '旋律：Drop 那句——F♯、F♯，低一点的 C♯、D♯，再回到 F♯；第四小节往上走到 G♯、A♯，再接回开头。',
        sound: { cat: 'SYNTH LEAD', hint: '亮、带一点锯齿味的合成器' },
      },
    ],
  },

  // Major Lazer & DJ Snake ft. MØ《Lean On》（2015）。依据（2026-11-11 查的）：G 小调（Hooktheory；Musicnotes MN0148995 标 B♭ 大调，同一组音）；
  // 98 BPM（Hooktheory、SongBPM、Songsterr 1050534；Musicnotes 和另一份 Songsterr 写 100）；和弦 E♭maj7 – F │ Gm7 – B♭ 两小节一组（Hooktheory、Musicnotes），
  // 第 10 步换（贝斯）；Drop 那段人声切片的旋律合了 Hooktheory “Instrumental” 段和 Songsterr 1050534；贝斯是两份 Songsterr 一致的“3 + 3 + 3 + 3 + 4”；
  // 鼓是两份 Songsterr 一致的四踩加 dembow 式的军鼓（第 4、7、12、15 步）。
  'lean-on': {
    bpm: 98,
    swing: 0,
    scale: 0,
    key: 7,
    bars: 4,
    space: { reverb: 2, delay: 0.75, feedback: 0.3 },
    origKey: 'G 小调（也写成 B♭ 大调）',
    summary: '原调 G 小调：MINOR，KEY 换成 G。两小节一组：E♭ → F │ Gm → B♭（键 6 → 7 │ 1 → 3），和弦在每小节第 10 步换。贝斯和军鼓都是“3 + 3 + 3 + 3 + 4”这种一跳一跳的切分；上面是 Drop 里那段人声切片的旋律，这里用合成器弹。',
    differs: [
      'Drop 那段旋律原曲是把人声切成一小段一小段来弹的，这里用合成器代替；原样的人声切片要等第 5 章采样。',
      '和弦简化了：原曲 B♭ 之前有个 B♭sus4，最后一小节有个 Gsus4，这里都没做；机器 CHORD 弹法的和弦每个多一个音（E♭maj7、F7、Gm7、B♭maj7）。',
      '速度有的谱写 100，这里按多数用 98。',
      '原曲每小节第 4 拍后面那个军鼓滚奏没做。',
    ],
    parts: [
      { track: 'KICK', layer: 'drums', steps: 'x---x---x---x---', role: '底鼓：四踩。', sound: { cat: 'KICK', hint: '厚、低' } },
      { track: 'SNARE', layer: 'drums', steps: '---x--x----x--x-', send: { reverb: 0.25 }, role: '军鼓：第 4、7、12、15 步，“3 + 3 + 2”的切分（雷鬼动那种）。', sound: { cat: 'SNARE', hint: '干、脆，或者拍手' } },
      { track: 'HAT1', layer: 'drums', steps: 'x-x-x-x-x-x-x-x-', role: '闭镲：八分音符。', sound: { cat: '闭镲', hint: '短、轻' } },
      {
        track: 'SYNTH1', layer: 'bass', octave: -2, mode: 'mono', voice: 'bass',
        notes: [
          [0, 6, 3, -1], [3, 6, 3, -1], [6, 6, 3, -1], [9, 7, 3, -1], [12, 7, 4, -1],
          [16, 1, 3], [19, 1, 3], [22, 1, 3], [25, 3, 3], [28, 3, 4],
          [32, 6, 3, -1], [35, 6, 3, -1], [38, 6, 3, -1], [41, 7, 3, -1], [44, 7, 4, -1],
          [48, 1, 3], [51, 1, 3], [54, 1, 3], [57, 1, 3], [60, 1, 4],
        ],
        role: '贝斯：每小节五下，“3 + 3 + 3 + 3 + 4”：E♭ → F │ G → B♭ │ E♭ → F │ G。',
        sound: { cat: 'BASS', hint: '圆、低的合成器贝斯' },
      },
      {
        track: 'SYNTH2', layer: 'chords', octave: -1, mode: 'chord', voice: 'wide', vel: 0.55,
        send: { reverb: 0.45 },
        notes: [[0, 6, 9], [9, 7, 7], [16, 1, 9], [25, 3, 7], [32, 6, 9], [41, 7, 7], [48, 1, 16]],
        role: '和弦：E♭ → F │ Gm → B♭ │ E♭ → F │ Gm，每小节第 10 步换。',
        sound: { cat: 'SYNTH PAD', hint: '软、宽的铺底' },
      },
      {
        track: 'DX', layer: 'lead', octave: 1, mode: 'mono', voice: 'reed', vel: 0.9, bars: 2,
        send: { reverb: 0.4, delay: 0.3 },
        notes: [
          [2, 2, 1], [3, 3, 3], [6, 1, 2], [10, 2, 1], [11, 3, 3], [14, 5, 2, -1],
          [18, 2, 1], [19, 3, 3], [22, 1, 2], [24, 1, 2], [26, 2, 1], [27, 3, 3], [30, 5, 2, -1],
        ],
        role: '旋律：Drop 里那段人声切片——A 滑到 B♭，落到 G；再 A、B♭，掉到低一点的 D。第二小节多一下 G。',
        sound: { cat: 'SYNTH LEAD', hint: '像人声的合成器；以后可以换成采样' },
      },
    ],
  },

  // Wiz Khalifa ft. Charlie Puth《See You Again》（2015）。依据（2026-11-11 查的）：Musicnotes MN0149305、维基百科、SongBPM 都是 B♭ 大调、80 BPM；
  // 和弦 Gm – B♭ │ E♭ – B♭ 两小节一圈，第 7 步就换（Hooktheory、Musicnotes 首页）；副歌旋律是 Hooktheory 的副歌段（第 1 小节和 Musicnotes 对得上）；
  // 贝斯是两份 Songsterr（830387、661352）一致的；鼓是两份 Songsterr 一致的部分（底鼓 1、7、11，军鼓 5、13）。
  'see-you-again': {
    bpm: 80,
    swing: 0,
    scale: 1,
    key: 10,
    bars: 4,
    space: { reverb: 2.6, delay: 0.75, feedback: 0.32 },
    origKey: 'B♭ 大调',
    summary: '原调 B♭ 大调：SCALE 换成第 2 个 MAJOR，KEY 换成 B♭。和弦两小节一圈：Gm → B♭ │ E♭ → B♭（键 6 → 1 │ 4 → 1），第二个和弦在第 7 步就提前进来。慢、钢琴为主，上面是副歌那句，四小节。',
    differs: [
      '前奏那段钢琴（F、高 C、B♭……）没做，旋律用的是副歌；人声没做。',
      '旋律比原曲高一个八度，免得和钢琴和弦挤在一起。',
      '踩镲有的谱是八分、有的是十六分，这里用八分；机器 CHORD 弹法的和弦每个多一个音（Gm7、B♭maj7、E♭maj7）。',
    ],
    parts: [
      { track: 'KICK', layer: 'drums', steps: 'x-----x---x-----', role: '底鼓：第 1、7、11 步，慢慢地“咚—咚、咚”。', sound: { cat: 'KICK', hint: '软、低' } },
      { track: 'SNARE', layer: 'drums', steps: '----x-------x---', send: { reverb: 0.4 }, role: '军鼓：二、四拍（原曲叠着拍手）。', sound: { cat: 'SNARE', hint: '软一点，带点尾巴' } },
      { track: 'HAT1', layer: 'drums', steps: 'x-x-x-x-x-x-x-x-', role: '闭镲：八分音符。', sound: { cat: '闭镲', hint: '轻' } },
      {
        track: 'SYNTH1', layer: 'bass', octave: -2, mode: 'mono', voice: 'bass', bars: 2,
        notes: [[0, 6, 6, -1], [6, 1, 4], [10, 1, 3], [13, 5, 3, -1], [16, 4, 6, -1], [22, 1, 4], [26, 1, 3], [29, 5, 3, -1]],
        role: '贝斯：G → B♭、B♭、低 F │ E♭ → B♭、B♭、低 F。两小节，自己重复。',
        sound: { cat: 'BASS', hint: '圆、软' },
      },
      {
        track: 'SYNTH2', layer: 'chords', octave: -2, mode: 'chord', voice: 'piano', vel: 0.3, bars: 2,
        send: { reverb: 0.5 },
        notes: [[0, 6, 6], [6, 1, 10], [16, 4, 6], [22, 1, 10]],
        role: '和弦：钢琴，Gm → B♭ │ E♭ → B♭，第二个和弦第 7 步就进来。',
        sound: { cat: 'PIANO', hint: '钢琴' },
      },
      {
        track: 'DX', layer: 'lead', octave: 0, mode: 'mono', voice: 'reed', vel: 1,
        send: { reverb: 0.45, delay: 0.25 },
        notes: [
          [0, 6, 1], [1, 7, 1], [2, 6, 4], [6, 5, 3], [9, 6, 1], [15, 1, 1],
          [16, 2, 2], [18, 2, 2], [20, 1, 2], [22, 3, 2], [24, 2, 2], [30, 3, 1], [31, 5, 1],
          [32, 6, 2], [34, 7, 2], [36, 6, 2], [38, 5, 2], [40, 3, 2], [42, 2, 2], [44, 2, 2], [46, 1, 2],
          [48, 2, 2], [50, 2, 2], [52, 3, 2], [54, 1, 2], [56, 6, 2, -1], [61, 1, 1], [62, 3, 1], [63, 5, 1],
        ],
        role: '旋律：副歌那句——在 G、A 上绕一下落到 F，再从 C 一路往下念到 B♭；最后 B♭、D、F 三下接回开头。',
        sound: { cat: 'SYNTH LEAD', hint: '软、圆一点的音色' },
      },
    ],
  },

  // Post Malone & Swae Lee《Sunflower》（2018）。依据（2026-11-11 查的）：Hooktheory、Musicnotes MN0190311 都是 D 大调、90 BPM（Songsterr 按 180 记谱，两倍速）；
  // 和弦 Dmaj7 – Gmaj9 – Em7 – Gmaj9 各两小节（Hooktheory、Musicnotes、Songsterr 贝斯三方一致）；前奏那句 “ooh” 是 Hooktheory、pianoletternotes、Musicnotes
  // 三方一致的；贝斯按 Songsterr 454820（换算到 90 BPM）；鼓也只有这一份 Songsterr。
  sunflower: {
    bpm: 90,
    swing: 0,
    scale: 1,
    key: 2,
    bars: 8,
    space: { reverb: 2.8, delay: 0.75, feedback: 0.35 },
    origKey: 'D 大调',
    summary: '原调 D 大调：SCALE 换成第 2 个 MAJOR，KEY 换成 D。八小节一圈，每个和弦两小节：D → G → Em → G（键 1 → 4 → 2 → 4）。上面是前奏那句“ooh”——音不多，慢慢地往上飘，再落回 D。',
    differs: [
      '原曲那把一直在弹分解和弦的吉他没做（音跨两个八度），和弦用一层铺底代替，每小节按一下。',
      '旋律用的是前奏的“ooh”，副歌没做；人声没做。',
      '鼓只有一份网友谱；原曲的铃鼓、打击乐没做。机器 CHORD 弹法的和弦每个多一个音（Dmaj7、Gmaj7、Em7）。',
    ],
    parts: [
      { track: 'KICK', layer: 'drums', steps: 'x-----x---------', role: '底鼓：第 1、7 步，很松。', sound: { cat: 'KICK', hint: '软、低' } },
      { track: 'SNARE', layer: 'drums', steps: '----x-------x---', send: { reverb: 0.4 }, role: '军鼓：二、四拍。', sound: { cat: 'SNARE', hint: '电子一点、软' } },
      { track: 'HAT1', layer: 'drums', steps: 'xxxxxxxxxxxxxxxx', vel: 0.7, role: '闭镲：碎碎的 16 分音符。', sound: { cat: '闭镲', hint: '细、轻' } },
      {
        track: 'SYNTH1', layer: 'bass', octave: -2, mode: 'mono', voice: 'bass',
        notes: [
          [0, 1, 4], [6, 1, 10], [18, 1, 2], [22, 1, 8], [30, 2, 1], [31, 3, 1],
          [32, 4, 4], [38, 4, 10], [50, 4, 2], [54, 4, 8], [62, 5, 1], [63, 6, 1],
          [64, 2, 4], [70, 2, 10], [82, 2, 2], [86, 2, 8], [94, 2, 1], [95, 3, 1],
          [96, 4, 4], [102, 4, 10], [114, 4, 2], [118, 4, 6], [124, 5, 2], [126, 1, 2, 1],
        ],
        role: '贝斯：每个和弦两小节，根音“咚——咚”，第二小节最后两下往上走，接到下一个和弦：D → G → E → G。',
        sound: { cat: 'BASS', hint: '圆、软的电贝斯' },
      },
      {
        track: 'SYNTH2', layer: 'chords', octave: -1, mode: 'chord', voice: 'wide', vel: 0.52,
        send: { reverb: 0.6, delay: 0.1 },
        notes: [[0, 1, 16], [16, 1, 16], [32, 4, 16], [48, 4, 16], [64, 2, 16], [80, 2, 16], [96, 4, 16], [112, 4, 16]],
        role: '和弦：D → G → Em → G，每个和弦两小节，每小节按一下。',
        sound: { cat: 'PAD', hint: '暖、软的铺底；或者干净的电吉他' },
      },
      {
        track: 'DX', layer: 'lead', octave: 1, mode: 'mono', voice: 'reed', vel: 1, bars: 4,
        send: { reverb: 0.55, delay: 0.3 },
        notes: [[6, 5, 2, -1], [8, 6, 4, -1], [12, 1, 4], [16, 1, 4], [38, 1, 2], [40, 5, 4], [44, 6, 4], [48, 3, 4], [52, 2, 1], [53, 1, 5]],
        role: '旋律：前奏那句“ooh”——A、B 往上到 D，再跳到高处的 A、B，然后 F♯、E、D 落下来。四小节，转两遍。',
        sound: { cat: 'SYNTH LEAD', hint: '软、像人声的音色' },
      },
    ],
  },

  // Lil Nas X《Old Town Road》（2019）。依据（2026-11-11 查的）：G♯ 小调（维基百科、Hooktheory、UG）；速度 Hooktheory、SongBPM 写 136，维基百科写 68，
  // 是同一个速度的两种数法，这里按 68 数（一小节正好装下底鼓和 808 那一整句）；和弦 G♯ – B – F♯ – C♯m7 每个两拍（维基百科、Hooktheory）；班卓琴的逐音
  // 没人扒过，只按 Songsterr 455741 和 UG 一致的每个和弦拨两下；副歌旋律是 Hooktheory、Songsterr 人声轨、pianoletternotes 一致的（换算到 68）；
  // 808 贝斯和鼓都只有 Songsterr。
  'old-town-road': {
    bpm: 68,
    swing: 0,
    scale: 0,
    key: 8,
    bars: 2,
    space: { reverb: 1.6, delay: 0.75, feedback: 0.25 },
    origKey: 'G♯ 小调',
    summary: '原调 G♯ 小调：MINOR，KEY 换成 G♯。按 68 BPM 数（资料上的 136 是两倍），只有两小节一圈：G♯m → B │ F♯ → C♯m（键 1 → 3 │ 7 → 4），每个和弦两拍、拨两下，像那段班卓琴。下面是 808 和底鼓一起走的那句，上面是副歌那句。',
    differs: [
      '原曲的主和弦好几份谱是 G♯ 大三和弦（班卓琴最上面那个音是 B♯），机器的 G♯ 小调音阶里没有这个音，这里用 G♯m。',
      '班卓琴一个音一个音地拨弦没人扒过，这里只用和弦每两拍拨两下；人声没做。',
      '旋律里有几个特别快的音（原曲的十六分音符，按 68 数就是半格），这里合并了；踩镲的三连音滚奏没做。',
      '机器 CHORD 弹法的和弦每个多一个音（G♯m7、Bmaj7、F♯7、C♯m7）。',
    ],
    parts: [
      { track: 'KICK', layer: 'drums', steps: 'x-----x---x--xx-', role: '底鼓：跟着 808 一起踩，第 1、7、11、14、15 步。', sound: { cat: 'KICK', hint: '808 那种低沉的' } },
      { track: 'CLAP', layer: 'drums', steps: '----X-------X---', send: { reverb: 0.3 }, role: '拍手：二、四拍（原曲拍手叠军鼓）。', sound: { cat: 'CLAP', hint: '干、响' } },
      { track: 'HAT1', layer: 'drums', steps: 'xxxxxxxxxxxxxxxx', vel: 0.7, role: '闭镲：每一格都打（原曲还有一串串的滚奏）。', sound: { cat: '闭镲', hint: '细、短' } },
      {
        track: 'SYNTH1', layer: 'bass', octave: -2, mode: 'mono', voice: 'sub', vel: 0.5,
        notes: [[0, 1, 6], [6, 1, 4], [10, 3, 3], [13, 3, 1], [14, 3, 2], [16, 7, 6, -1], [22, 7, 4, -1], [26, 4, 3, -1], [29, 7, 2, -1], [31, 7, 1, -1]],
        role: '808 贝斯：和底鼓一起落下，G♯ → B │ F♯ → 低一点的 C♯ → F♯。',
        sound: { cat: '808 BASS', hint: '808 那种又长又低的贝斯' },
      },
      {
        track: 'SYNTH2', layer: 'chords', octave: -2, mode: 'chord', voice: 'keys', vel: 0.36,
        send: { reverb: 0.25 },
        notes: [[0, 1, 4], [4, 1, 4], [8, 3, 4], [12, 3, 4], [16, 7, 4], [20, 7, 4], [24, 4, 4], [28, 4, 4]],
        role: '和弦：像那段班卓琴——每个和弦拨两下，G♯m → B │ F♯ → C♯m。',
        sound: { cat: 'GUITAR', hint: '拨弦的音色（班卓琴、吉他都行）' },
      },
      {
        track: 'DX', layer: 'lead', octave: 0, mode: 'mono', voice: 'reed', vel: 0.85,
        send: { reverb: 0.3, delay: 0.2 },
        notes: [
          [0, 5, 2], [2, 4, 2], [4, 3, 2], [6, 1, 1], [7, 1, 1],
          [8, 5, 1], [9, 4, 2], [11, 3, 1], [12, 4, 1], [13, 1, 1], [14, 1, 1], [15, 7, 1, -1],
          [18, 4, 4], [22, 4, 1], [23, 5, 1],
          [24, 3, 2], [26, 2, 2], [28, 2, 1], [29, 1, 1], [30, 1, 1], [31, 1, 1],
        ],
        role: '旋律：副歌那两句——从 D♯ 一级级往下念到 G♯；第二句停在 C♯ 上，再往下走（B、A♯、G♯），最后三下 G♯ 接回开头。',
        sound: { cat: 'SYNTH LEAD', hint: '软一点的音色' },
      },
    ],
  },

  // Imagine Dragons《Believer》（2017）。依据（2026-11-11 查的）：B♭ 小调、125 BPM（Hooktheory、Musicnotes、SongBPM、Songsterr、维基百科五方一致）；
  // 原曲是每拍三等分的 shuffle（维基百科、Splice 记 12/8；Musicnotes 记 “Rock Shuffle”）；副歌和弦 B♭m（前两拍空）– G♭/D♭ – F/C（Hooktheory、Songsterr）；
  // 副歌旋律是 Hooktheory 和 Songsterr 一致的；贝斯是 Songsterr 的副歌全音符；鼓按 Songsterr 435652（第 3 拍重军鼓、第 4 拍嗵鼓三连音）。
  believer: {
    bpm: 125,
    swing: 0,
    scale: 0,
    key: 10,
    bars: 4,
    space: { reverb: 2, delay: 0.75, feedback: 0.25 },
    origKey: 'B♭ 小调',
    summary: '原调 B♭ 小调：MINOR，KEY 换成 B♭。副歌四小节：前两拍空着，第 3 拍全部一起砸下来（“Pain!”），B♭m → G♭ → F（键 1 → 6 → 5）。鼓的重拍在第 3 拍，第 4 拍底鼓“咚、咚咚”滚回来；贝斯一小节一个长音。',
    differs: [
      '原曲是每拍三等分的 shuffle（12/8 的感觉），机器一小节 16 格装不下三等分，这里按直的八分音符写，听着会“方”一点。',
      '原曲最后那个和弦是 F 大三和弦，旋律最后一个音是 A（B♭ 小调音阶外），这里换成了 Fm 和 A♭。',
      '第 4 拍那三下原曲是嗵鼓的三连音，这里用底鼓、按 16 分音符近似；主歌那把吉他和人声没做。',
      '机器 CHORD 弹法的和弦每个多一个音（B♭m7、G♭maj7、Fm7）。',
    ],
    parts: [
      { track: 'KICK', layer: 'drums', steps: 'x-----------x-xx', role: '底鼓：第 1 步一下，第 4 拍“咚、咚咚”（原曲是嗵鼓的三连音）。', sound: { cat: 'KICK', hint: '又重又大' } },
      { track: 'SNARE', layer: 'drums', steps: '--------X-------', send: { reverb: 0.45 }, role: '军鼓：只在第 3 拍砸一下，半速的大重拍。', sound: { cat: 'SNARE', hint: '大、带混响' } },
      { track: 'HAT1', layer: 'drums', steps: 'x---x---x---x---', role: '镲：一拍一下。', sound: { cat: '闭镲', hint: '厚一点' } },
      {
        track: 'SYNTH1', layer: 'bass', octave: -3, mode: 'mono', voice: 'bass', vel: 0.85,
        notes: [[8, 1, 8], [16, 1, 16], [32, 3, 16], [48, 2, 16]],
        role: '贝斯：一小节一个长音，B♭（第 3 拍才进）→ B♭ → D♭ → C。',
        sound: { cat: 'BASS', hint: '粗、带点失真' },
      },
      {
        track: 'SYNTH2', layer: 'chords', octave: -2, mode: 'chord', voice: 'wide', vel: 0.5,
        send: { reverb: 0.45 },
        notes: [[8, 1, 8], [16, 1, 16], [32, 6, 16], [48, 5, 16]],
        role: '和弦：B♭m（第 3 拍才进）→ G♭ → F，低、厚。',
        sound: { cat: 'SYNTH PAD', hint: '厚、暗一点的合成器' },
      },
      {
        track: 'DX', layer: 'lead', octave: 0, mode: 'mono', voice: 'lead', vel: 1,
        send: { reverb: 0.35, delay: 0.2 },
        notes: [
          [8, 1, 6], [14, 1, 2],
          [16, 3, 2], [18, 3, 2], [20, 2, 2], [22, 1, 2], [24, 3, 2], [26, 3, 2], [28, 2, 2], [30, 1, 2],
          [32, 1, 4], [36, 3, 4], [46, 3, 2],
          [48, 2, 4], [52, 7, 4, -1],
        ],
        role: '旋律：副歌那句——第 3 拍一声长长的 B♭（“Pain!”），然后 D♭、D♭、C、B♭ 一串八分音符，最后“believer”落下来。',
        sound: { cat: 'SYNTH LEAD', hint: '粗一点、带劲的合成器' },
      },
    ],
  },
};

export const songParts = (id) => SONG_PARTS[id] || null;
