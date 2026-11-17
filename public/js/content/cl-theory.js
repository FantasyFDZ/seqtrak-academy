// 小课堂 · 乐理线（11 关）。写法见 content/classroom.js 开头。
// 2026-11-15：原来的 T3「不踩在拍子上」并进了节奏线的 R4、R5（反拍、切分），T4「摇一摇」并进了 R6（晃起来），
// T13「一首歌的形状」并进了 DJ 线的 D4（能量曲线）。新开 T2、T6、T8、T9、T11、T12 和关底大关 TB。
// 2026-11-17 乐理线重做第一期：T5、T6、T7、T8、T12 的“学”和“挑战”换了新的，又加了 T14–T17，排成单元的顺序——
// 都在 cl-theory-units.js 里（它的 redo() 拿这里的原文当底子）。这个文件里这几关的 play / quiz 已经不用了，
// “用在机器上”、带走的话、快问快答还在用。T9、T10、T11、TB 还是老样子，等下一期。
import { PLAY, STOP, PICK, STEPS } from './classroom-bits.js';
import { redo, THEORY_UNITS } from './cl-theory-units.js';

const OLD = [
  {
    id: 'T1', line: 'theory', kind: 'explain', title: '四个一组', about: '拍子和小节', minutes: 3,
    say: '走路是“左、右、左、右”。音乐是“**1**、2、3、4”：四下一组，第一下最重。啾！',
    play: {
      toy: 'beatwalk', bpm: 100,
      tip: '点「播放」，跟着数 1、2、3、4，在 **1** 上拍一下那块大垫子。再把「重音」关掉听听：还数得出哪个是 1 吗？',
      name: '这一下一下的，叫**拍**。四拍一组，叫一**小节**。',
    },
    quiz: { toy: 'findone', bpm: 100, ask: '灯不亮了，只剩声音。听出最重的那一下，在它上面拍。铜 3 次、银 4 次、金 6 次。' },
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
    links: { lessons: ['1-1', '1-2'], charts: ['pulse-kick'], songs: ['animals'] },
    ask: [
      { q: '一小节有几拍？', a: ['4 拍', '8 拍', '16 拍'], why: '四拍一组，叫一小节。' },
      { q: '机器上那两排方键一共 16 个，走完一遍是？', a: ['1 小节', '1 拍', '4 小节'], why: '16 个键 = 1 小节，每 4 个键 = 1 拍。' },
      { q: '四拍里哪一拍最重？', a: ['第 1 拍', '第 3 拍', '都一样'], why: '“**1**、2、3、4”：第一下最重。' },
    ],
  },
  {
    id: 'T2', line: 'theory', kind: 'ear', title: '把一拍切开', about: '一拍里放 1 下、2 下、4 下', minutes: 4,
    say: '一拍像一块蛋糕：可以整块吃，也可以切两半、切四块。切得越碎，听着越“密”，啾。',
    play: {
      toy: 'countalong', bpm: 84,
      tip: '点「播放」，换着点“一拍 1 下 / 2 下 / 4 下”。看灯，嘴里跟着数下面那行字：“1 e & a”就是一拍切成四块。',
      name: '一拍 1 下叫**四分音符**，2 下叫**八分**，4 下叫**十六分**。名字不用背，记住“切几块”就行。',
    },
    quiz: { toy: 'subdict', ask: '听一段镲，在格子上点出来：每 4 格是一拍，听它每拍切成了几块。' },
    machine: {
      edits: true,
      tasks: [
        PICK('HAT1'),
        STEPS('HAT1', [1, 3, 5, 7, 9, 11, 13, 15], '隔一个亮一个：上排第 **1、3、5、7** 个，下排第 **1、3、5、7** 个。别的亮着的按灭。', '每拍切两半：八分镲。'),
        PLAY('“嚓嚓嚓嚓”：一拍两下。'),
        STOP(),
      ],
      done: '一拍两下的镲，很多歌的镲都是这么铺的。',
    },
    takeaway: '一拍可以切开：**1 下、2 下、4 下**。机器上每 4 个方键是一拍，所以“一拍 2 下”就是隔一个亮一个，“一拍 4 下”就是 4 个全亮。',
    coach: '小课堂 T2「把一拍切开」：四分、八分、十六分（只说“一拍切几块”，名字点到为止）。玩具：一拍 1 / 2 / 4 下，配“1 e & a”的念法。挑战是格子听写：底鼓每拍一下，听闭镲每拍几下，铜两拍一样、银每拍不同、金还有只在“&”上的和“1 & a”。机器上：HAT 1 铺八分（第 1、3、5…15 步）。',
    links: { lessons: ['1-2', '1-4'], charts: ['hat-eighths'], songs: ['levels'] },
    ask: [
      { q: '一拍切成 4 块，嘴里怎么数？', a: ['1 e & a', '1 2 3 4', '1 & 2 &'], why: '“1 e & a”是一拍里的四块。' },
      { q: '机器上“一拍 2 下”的镲，方键怎么亮？', a: ['隔一个亮一个', '4 个全亮', '每 4 个亮 1 个'], why: '每 4 个方键是一拍，一拍两下就是隔一个亮一个。' },
    ],
  },
  {
    id: 'T5', line: 'theory', kind: 'explain', title: '高和低', about: '音名和八度', minutes: 3,
    say: '同一个音，可以住在楼上，也可以住在楼下。名字一样，只是高了一层。',
    play: {
      toy: 'octaves',
      tip: '三层楼，每层 7 个键。随便点一个：楼上楼下和它**同名**的会一起亮。把亮着的从下到上挨个点一遍：像不像同一个人，换了个高度？',
      name: '音只有 7 个名字：C D E F G A B，数完又从 C 开始。同名的两个音隔着的这一层楼，叫一个**八度**。',
    },
    quiz: { toy: 'samename', ask: '听两个音。第二个是不是第一个“搬到楼上”的样子？' },
    machine: {
      tasks: [
        PICK('SYNTH1'),
        { text: '按一下 **Synth key 1**：中间那两排键里，上排左数第 2 个（第 1 个带圆点的是录音键）。记住这个音。', goal: '弹一下 Synth key 1。', panel: ['SK1'], detect: { kind: 'note', track: 'SYNTH1' }, wait: '等你按 Synth key 1…' },
        { text: '按一下 [OCTAVE]：机器**上边沿**那排 5 个小按钮里，左数第 2 个。右边那列小灯会换一盏亮。', goal: '换一层楼。', panel: ['OCTAVE', 'METER'], detect: { kind: 'octave' }, wait: '等你按 [OCTAVE]…' },
        { text: '再按 **Synth key 1**：还是它，换了一层楼。', panel: ['SK1'], detect: { kind: 'note', track: 'SYNTH1' }, wait: '等你再按 Synth key 1…' },
      ],
      done: '同一个键，换了一层楼。想回原来那层：多按几下 [OCTAVE]（或者按住它、转左上角的 [ALL] 旋钮），让右边那列小灯回到**从下往上数第 4 盏**。',
    },
    takeaway: '音名只有 7 个，转一圈又回来。同名的音隔着一个**八度**：一样的味道，不同的高度。机器上 [OCTAVE] 是换楼层的键。',
    coach: '小课堂 T5「高和低」：音名（C D E F G A B 七个字母循环）和八度（同名的音，频率翻倍）。学生在一排键上点，同名的一起亮；在机器上选中 SYNTH 1，按同一个 Synth key，再按 [OCTAVE] 换八度。不讲黑键、半音（那是 T6）。手册没写单按 [OCTAVE] 是升还是降，所以只让他看右边那列小灯：自下而上是 −3 到 +2，第 4 盏是 0。',
    links: { lessons: ['2-1'], charts: ['bass-root'] },
    ask: [
      { q: '音名一共有几个字母？', a: ['7 个', '12 个', '8 个'], why: 'C D E F G A B，数完又从 C 开始。' },
      { q: '机器上换“楼层”的是哪个键？', a: ['[OCTAVE]', '[SCALE]', '[KEY]'], why: '[OCTAVE] 换八度；[SCALE] 换梯子，[KEY] 整体挪调。' },
    ],
  },
  {
    id: 'T6', line: 'theory', kind: 'explain', title: '一格和两格', about: '半音和全音', minutes: 3,
    say: '一个八度里其实有 12 格，黑键白键都算。挨着的下一个键，就是走了一格。',
    play: {
      toy: 'chromatic',
      tip: '点一个键当起点，再点“走一格”“走两格”，听两种步子有什么不一样。找一找：**E 到 F**、**B 到 C** 中间没有黑键，它们差几格？',
      name: '走一格叫**半音**，走两格叫**全音**。半音听着挤，全音宽一点。',
    },
    quiz: { toy: 'steps12', ask: '听两个音：它们差一格，还是两格？（金那一档还有三格）' },
    machine: {
      tasks: [
        PICK('SYNTH1'),
        { text: '按 **Synth key 2**，再按 **Synth key 3**：机器出厂是 C 小调，这两个键是 D 和 D#，只差**一格**（半音）。', goal: '弹两个只差一格的音。', panel: ['SK2', 'SK3'], detect: { kind: 'note', track: 'SYNTH1', count: 2 }, wait: '按 key 2，再按 key 3…' },
        { text: '再按 **Synth key 1**、**Synth key 2**：C 和 D，差**两格**（全音）。听出宽窄了吗？', goal: '弹两个差两格的音。', panel: ['SK1', 'SK2'], detect: { kind: 'note', track: 'SYNTH1', count: 2 }, wait: '按 key 1，再按 key 2…' },
      ],
      done: '机器的 7 个键，有的隔一格、有的隔两格：音阶就是这么排出来的（下一关讲）。',
    },
    takeaway: '一个八度 **12 格**。挨着的一格叫**半音**（挤），两格叫**全音**（宽）。E–F、B–C 中间没有黑键，也只差一格。',
    coach: '小课堂 T6「一格和两格」：半音（相邻的 12 平均律两音）和全音。玩具是一排 13 个键（含黑键），能“走一格 / 两格”；挑战听两音判断差一格还是两格（金加三格）。机器上：出厂 C 小调，Synth key 2→3 是 D→D#（半音），1→2 是 C→D（全音）。不讲音程名称。',
    links: { lessons: ['2-1'] },
    ask: [
      { q: '挨着的两个键（黑白都算），差多少？', a: ['一格，叫半音', '两格，叫全音', '一个八度'], why: '挨着的下一个键就是半音。' },
      { q: 'E 和 F 中间没有黑键，它们差？', a: ['一格（半音）', '两格（全音）', '不一定'], why: 'E–F、B–C 本来就挨着：一格。' },
    ],
  },
  {
    id: 'T7', line: 'theory', kind: 'explain', title: '亮和暗', about: '音阶：大调和小调', minutes: 4,
    say: '同一段旋律，换一把“梯子”爬，心情就变了：一把亮堂，一把发暗。',
    play: {
      toy: 'brightdark', bpm: 104, melody: [1, 3, 5, 3, 6, 5, 3, 1],
      tip: '点「播放」，然后来回拨那个大开关。旋律没换，只是梯子上有三级往下挪了半格。',
      name: '这把“梯子”叫**音阶**。亮的那把叫**大调**，暗的那把叫**小调**。',
    },
    quiz: {
      toy: 'majorminor', ask: '听一小段：它是亮的，还是暗的？',
      melodies: [[1, 2, 3, 5, 3, 0, 1, 0], [5, 3, 1, 3, 6, 0, 5, 0], [1, 3, 5, 8, 7, 5, 3, 1], [3, 3, 2, 1, 6, 5, 3, 0], [8, 7, 6, 5, 3, 0, 1, 0]],
    },
    machine: {
      tasks: [
        PICK('SYNTH1'),
        { text: '把 7 个 **Synth keys** 从 1 到 7 挨个按一遍（上排是 ● 1 2 3，下排是 4 5 6 7）。机器现在多半在**小调**上：偏暗。', goal: '把 7 个键弹一遍。', panel: ['SYNTHKEYS'], detect: { kind: 'note', track: 'SYNTH1', count: 5 }, wait: '挨个按…' },
        { text: '按 [SCALE]：上边沿那排小按钮里左数第 3 个。看右边那列 8 盏小灯：**最上面一盏是小调（MINOR），第 2 盏是大调（MAJOR）**。按到第 2 盏亮。', goal: '换到大调。', panel: ['SCALE', 'METER'], detect: { kind: 'scale', scale: 1 }, wait: '等大调（第 2 盏）亮…' },
        { text: '再把 7 个键按一遍：同样的 7 个键，亮起来了。', panel: ['SYNTHKEYS'], detect: { kind: 'note', track: 'SYNTH1', count: 5 }, wait: '挨个按…' },
        { text: '听完用 [SCALE] 按回**最上面那盏**（小调）：后面的课都用它。', goal: '换回小调。', panel: ['SCALE', 'METER'], detect: { kind: 'scale', scale: 0 }, wait: '等小调（最上面那盏）亮…' },
      ],
      done: '7 个键没换，换的是它们底下那把梯子。',
    },
    takeaway: '**音阶**是一把梯子，规定了能踩哪几个音。**大调**亮，**小调**暗。机器上 7 个键就是梯子的 7 级，[SCALE] 换梯子。',
    coach: '小课堂 T7「亮和暗」：音阶、大调和小调。同一段旋律一键切大调 / 小调（第 3、6、7 级降半音）；在机器上选中 SYNTH 1，把 7 个 Synth keys 弹一遍，用 [SCALE] 换到 MAJOR 再弹，最后换回 MINOR。Global Meter 自上而下第 1 盏是 MINOR、第 2 盏是 MAJOR。不讲调号、不讲音程名称。',
    links: { lessons: ['2-1', '2-2'], songs: ['as-it-was', 'faded'] },
    ask: [
      { q: '大调和小调，哪个听着亮？', a: ['大调', '小调', '一样'], why: '大调亮，小调暗。' },
      { q: '机器上换“梯子”的键是？', a: ['[SCALE]', '[OCTAVE]', '[BPM+]'], why: '[SCALE] 换音阶。出厂是小调（MINOR，最上面那盏灯）。' },
    ],
  },
  {
    id: 'T8', line: 'theory', kind: 'ear', title: '怎么按都不难听', about: '五声音阶', minutes: 4,
    say: '把梯子上最容易“打架”的两级拿掉，只剩 5 个音：闭着眼乱按都好听。啾啾最爱这 5 个。',
    play: {
      toy: 'pentajam',
      tip: '点「播放」，在那排键上**乱按**。再切到“12 个全上”乱按，比一比：哪个更容易按出难听的音？',
      name: '只有 5 个音的梯子叫**五声音阶**。蓝调、摇滚、Hip-hop 的旋律很多都只用它。',
    },
    quiz: { toy: 'pentaecho', ask: '啾啾唱一句，你在那 6 个键上照着弹回来。铜 2 个音、银 3 个、金 4 个。' },
    machine: {
      tasks: [
        PICK('SYNTH1'),
        { text: '按 [SCALE]，看右边那列 8 盏小灯：按到**从上往下第 3 盏**亮，那是 **MINOR PENTATONIC**（小调五声）。', goal: '把音阶换成小调五声。', panel: ['SCALE', 'METER'], detect: { kind: 'scale', scale: 2 }, wait: '等第 3 盏亮…' },
        { text: '在 7 个 **Synth keys** 上随便弹：7 个键里只有 5 个不同的音名（后两个是高一层的 1 和 2），怎么按都顺。', goal: '在五声上随便弹一段。', panel: ['SYNTHKEYS'], detect: { kind: 'note', track: 'SYNTH1', count: 6 }, wait: '随便弹…' },
        { text: '弹完用 [SCALE] 按回**最上面那盏**（小调）。', goal: '换回小调。', panel: ['SCALE', 'METER'], detect: { kind: 'scale', scale: 0 }, wait: '等最上面那盏亮…' },
      ],
      done: '五声是“安全区”：想即兴、想随手写一句，先切到它。',
    },
    takeaway: '**五声音阶**只有 5 个音，没有挤在一起的半音，怎么按都不难听。机器上 [SCALE] 第 3 盏灯就是小调五声。',
    coach: '小课堂 T8「怎么按都不难听」：五声音阶（这里用 C 小调五声 C E♭ F G B♭）。玩具：在五声的 6 个键上乱按配伴奏，对比 12 个音全上；挑战是“啾啾唱一句你弹回来”（只用五声的键 1–5，铜 2 个音、银 3、金 4）。机器上：[SCALE] 换到 MINOR PENTATONIC（Global Meter 自上而下第 3 盏），7 个 Synth keys 是 C E♭ F G B♭ 高C 高E♭。',
    links: { lessons: ['2-1'], songs: ['gangstas-paradise', 'shape-of-you'] },
    ask: [
      { q: '五声音阶有几个音？', a: ['5 个', '7 个', '12 个'], why: '五声：5 个音。' },
      { q: '为什么五声怎么按都不难听？', a: ['挤在一起的半音被拿掉了', '它的声音更大', '它只有低音'], why: '最容易打架的两级被拿掉了。' },
    ],
  },
  {
    id: 'T9', line: 'theory', kind: 'ear', title: '两个音的距离', about: '三度甜、五度稳', minutes: 4,
    say: '两个音一起响，距离不同，味道就不同：挨着的挤，隔一个的甜，再远一点的稳。',
    play: {
      toy: 'intervals',
      tip: '地基是键 1。点上面的键：它和地基一起响。挨个试一遍，听哪个“甜”、哪个“稳”、哪个“空”。',
      name: '两个音的距离叫**音程**。隔一个键是**三度**（甜），隔三个是**五度**（稳），同名高一层是**八度**（空）。',
    },
    quiz: { toy: 'intervalmem', ask: '翻牌配对：两张牌的“距离”一样就是一对。铜每对音高也一样，银、金换了地基，只能听距离。' },
    machine: {
      tasks: [
        PICK('SYNTH1'),
        { text: '先按 **key 1**，再按 **key 3**：隔了一个键，**三度**，甜。', goal: '弹一个三度。', panel: ['SK1', 'SK3'], detect: { kind: 'note', track: 'SYNTH1', count: 2 }, wait: '按 key 1，再按 key 3…' },
        { text: '再按 **key 1**、**key 5**：隔了三个，**五度**，稳。贝斯最爱这两个音。', goal: '弹一个五度。', panel: ['SK1', 'SK5'], detect: { kind: 'note', track: 'SYNTH1', count: 2 }, wait: '按 key 1，再按 key 5…' },
      ],
      done: '第 2 章“根音与五音”的那条贝斯，就是在五度上来回跳。',
    },
    takeaway: '两个音的距离叫**音程**：**三度甜**、**五度稳**、**八度空**、挨着的二度挤。机器上数键：key 1 到 key 3 是三度，到 key 5 是五度。',
    coach: '小课堂 T9「两个音的距离」：音程的味道（二度挤、三度甜、五度稳、六度宽、八度空），不讲大小三度、不讲半音数。玩具：地基键 1，点别的键和它一起响；挑战是记忆配对（同一种距离配一对，铜同音高，银金换根音）。机器上：SYNTH 1 依次弹 key 1–3、key 1–5。',
    links: { lessons: ['2-3'], charts: ['bass-fifth'] },
    ask: [
      { q: '哪个距离听着最“稳”？', a: ['五度', '二度', '三度'], why: '五度稳，贝斯和力量和弦都爱它。' },
      { q: 'key 1 和 key 3 一起响，叫？', a: ['三度（甜）', '五度（稳）', '八度（空）'], why: '隔一个键是三度。' },
    ],
  },
  {
    id: 'T10', line: 'theory', kind: 'explain', title: '三个音叠起来', about: '和弦：大的亮，小的暗', minutes: 4,
    say: '一个音是一根线。三个音叠在一起，就成了一块颜色。',
    play: {
      toy: 'stack',
      tip: '点下面任意一个键当“地基”。看它怎么叠：**隔一个，拿一个**，叠三层。换个地基再叠，颜色会变。',
      name: '叠出来的这一摞叫**和弦**。听着亮的是**大和弦**，听着暗的是**小和弦**。',
    },
    quiz: { toy: 'oddchord', ask: '几张牌，每张是一个和弦。点牌来听，把**不一样**的那张找出来。' },
    machine: {
      tasks: [
        PICK('SYNTH2'),
        {
          text: '找到右边桔红色那块里**竖着的 4 个旋钮**，慢慢转**从上往下数第 2 个**，转到左边那列文字里的 “CHORD” 亮。',
          simText: '找到右边桔红色那块里**竖着的 4 个旋钮**，按住**从上往下数第 2 个**往上拖，拖到左边那列文字里的 “CHORD” 亮。',
          goal: '让 SYNTH 2 一个键弹出一个和弦。',
          panel: ['SD2', 'INDEX'], detect: { kind: 'polymode', track: 'SYNTH2', mode: 2 }, wait: '等 CHORD 亮…',
          assist: { label: '替我切到 CHORD', polymode: ['SYNTH2', 2] },
        },
        { text: '按一下 **Synth key 1**（中间两排键里上排左数第 2 个）：一个键，出来一整摞。', panel: ['SK1'], detect: { kind: 'chord', track: 'SYNTH2', min: 3 }, wait: '等你按一个键…' },
        { text: '从 1 到 7 换着按：有的亮，有的暗。', goal: '弹几个和弦。', panel: ['SYNTHKEYS'], detect: { kind: 'chord', track: 'SYNTH2', min: 3, count: 3 }, wait: '再按几个…' },
      ],
      done: '这条轨道现在一个键就是一个和弦。想变回一次一个音：把那个旋钮往回转到 “MONO/POLY” 亮。',
    },
    takeaway: '从一个音起，**隔一个拿一个**，叠三层，就是**和弦**。大的亮，小的暗。机器上把那个旋钮转到 CHORD，一个键就是一整摞。',
    coach: '小课堂 T10「三个音叠起来」：和弦是“隔一个拿一个”叠出来的三个音；大三和弦亮、小三和弦暗。这是第 3 章 3.1 / 3.2 的三分钟精简版。在机器上：选中 SYNTH 2，把右边 4 个 Sound Design 旋钮里的第 2 个转到 CHORD，一个 Synth key 就是一个和弦（机器上每个键其实是 4 个音）。提醒：这个设定是存在音色里的，换了音色会被冲掉。',
    links: { lessons: ['3-1', '3-2'], charts: ['chord-two'] },
    ask: [
      { q: '和弦是怎么叠出来的？', a: ['隔一个拿一个，叠三层', '挨着拿三个', '随便拿三个'], why: '从一个音起，隔一个拿一个。' },
      { q: '机器上让一个键弹出和弦，要把弹法切到？', a: ['CHORD', 'MONO', 'POLY'], why: 'Sound Design 第 1 页的第 2 个旋钮转到 CHORD。' },
    ],
  },
  {
    id: 'T11', line: 'theory', kind: 'ear', title: '四个和弦走天下', about: '最常见的和弦进行', minutes: 4,
    say: '好多流行歌，底下就转着同样的四个和弦。听熟了这几套，一首新歌一响你就“咦，我认识”，啾！',
    play: {
      toy: 'progression',
      tip: '点「播放」，换着点上面那几套预设。每块牌子点一下会换一个和弦：自己拼一套，听听像不像哪首歌。',
      name: '几个和弦按顺序转起来，叫**和弦进行**。**1 → 6 → 3 → 7** 这一套，Wake Me Up 和 Faded 都在用。',
    },
    quiz: { toy: 'progorder', ask: '先点「听原句」，再把几张和弦牌按听到的顺序排好。铜 3 张、银 4 张，金是随便拼的 4 个。' },
    machine: {
      tasks: [
        PICK('SYNTH2'),
        {
          text: '把右边竖着那 4 个旋钮里**从上往下第 2 个**转到 “CHORD” 亮（上一关做过）。',
          simText: '按住右边竖着那 4 个旋钮里**从上往下第 2 个**往上拖，拖到 “CHORD” 亮（上一关做过）。',
          goal: '让 SYNTH 2 一个键一个和弦。',
          panel: ['SD2', 'INDEX'], detect: { kind: 'polymode', track: 'SYNTH2', mode: 2 }, wait: '等 CHORD 亮…',
          assist: { label: '替我切到 CHORD', polymode: ['SYNTH2', 2] },
        },
        { text: '按顺序弹 **key 1 → key 6 → key 3 → key 7**，每个按一下、数四拍再换。转两圈。', goal: '弹 1 → 6 → 3 → 7。', panel: ['SK1', 'SK6', 'SK3', 'SK7'], detect: { kind: 'chord', track: 'SYNTH2', min: 3, count: 6 }, wait: '1 → 6 → 3 → 7…' },
      ],
      done: '这就是 Wake Me Up 的骨架。去「曲目」里听它整首，你会一直听见这四下。',
    },
    takeaway: '几个和弦按顺序转圈，叫**和弦进行**。最常见的一套是 **1 → 6 → 3 → 7**（机器上 CHORD 弹法按这四个键）。听熟它，好多歌一听就认得。',
    coach: '小课堂 T11「四个和弦走天下」：和弦进行。玩具：四块和弦牌（C 小调，键 1–7，一小节一个），预设有 1-6-3-7（Wake Me Up、Faded）、6-4-5-1（Gangsta’s Paradise）、6-7-1-7（Something Just Like This）、1-7-6-7（Starboy）。挑战是“排顺序”：听原句，把和弦牌按顺序摆好（铜 3 张、银 4 张、金随机 4 个）。机器上：SYNTH 2 切 CHORD，弹 1→6→3→7。和第 3 章 3.4 对应。',
    links: { lessons: ['3-4'], charts: ['chord-four', 'song-starboy'], songs: ['wake-me-up', 'faded', 'gangstas-paradise'] },
    ask: [
      { q: 'Wake Me Up、Faded 底下转的是哪四个键？', a: ['1 → 6 → 3 → 7', '1 → 2 → 3 → 4', '7 → 6 → 5 → 4'], why: '1 → 6 → 3 → 7，第 3 章 3.4 也弹过。' },
      { q: '几个和弦按顺序转圈，叫？', a: ['和弦进行', '音阶', '八度'], why: '和弦进行。' },
    ],
  },
  {
    id: 'T12', line: 'theory', kind: 'hands', title: '整首歌搬个家', about: '调和移调', minutes: 4,
    say: '一首歌嫌太低、唱不上去？整首一起往上搬几格就行：旋律一点没变，只是换了个“家”。',
    play: {
      toy: 'transpose',
      tip: '点「播放」，按 KEY − / + 一格一格挪。听：旋律没变，整体高了或低了。看键下面的音名，跟着一起变。',
      name: '一首歌住在哪个音上，叫它的**调**（比如 C 小调）。整首一起挪，叫**移调**。',
    },
    quiz: { toy: 'hands', ask: '在机器上做一遍：弹一段，换个调再弹，最后换回来。铜有蓝圈提示，银没有，金只告诉你要做成什么样。' },
    machine: {
      tasks: [
        PICK('SYNTH1'),
        { text: '在 **Synth keys** 上随便弹几下，记住它的样子。', goal: '弹几下 SYNTH 1。', panel: ['SYNTHKEYS'], detect: { kind: 'note', track: 'SYNTH1', count: 3 }, wait: '弹几下…' },
        { text: '按 [KEY]：机器**上边沿**那排小按钮里左数第 4 个。看右边那列小灯（自下而上是 C D E F G A B），按到 **D**（从下往上第 2 盏）单独亮。', simText: '点**两下** [KEY]：机器**上边沿**那排小按钮里左数第 4 个。每点一下往上挪一格，两下到 **D**（下面那行字会说现在是什么调）。', goal: '把整台机器换到 D。', panel: ['KEY', 'METER'], detect: { kind: 'key', key: 2 }, wait: '等你挪到 D…' },
        { text: '再弹刚才那几个键：同样的手法，整体高了两格。', goal: '再弹几下，听换了调的样子。', panel: ['SYNTHKEYS'], detect: { kind: 'note', track: 'SYNTH1', count: 3 }, wait: '再弹几下…' },
        { text: '接着按 [KEY]，按回 **C**（最下面那盏小灯单独亮）。也可以**按住** [KEY] 转左上角的 [ALL] 旋钮。后面的课都用 C。', simText: '接着点 [KEY]，转一圈回到 **C**（12 格一圈，再点 10 下）。后面的课都用 C。', goal: '把调换回 C。', panel: ['KEY', 'METER'], detect: { kind: 'key', key: 0 }, wait: '转回 C…' },
      ],
      done: '[KEY] 一格是半音：整台机器的旋律、和弦一起挪，已经录好的东西不变。',
    },
    takeaway: '一首歌住的那个音叫**调**。整首一起挪叫**移调**，旋律一点不变。机器上 [KEY] 一下挪一格（半音），录好的东西不受影响。',
    coach: '小课堂 T12「整首歌搬个家」：调和移调（只讲“整首一起挪”，不讲调号）。玩具：一段小旋律，KEY −/+ 一格一格挪，键下面的音名跟着变。这一关是动手关：在模拟机或真机上选 SYNTH 1、弹几下、按 [KEY] 换调、再弹、换回 C（Global Meter 自下而上 7 盏对应 C D E F G A B，升号两盏一起亮）。手册没写单按 [KEY] 往哪边走，所以只说“多按几下回到 C”。',
    links: { lessons: ['2-2'], songs: ['faded', 'starboy'] },
    ask: [
      { q: '整首歌一起往上挪几格，叫？', a: ['移调', '换音阶', '换八度'], why: '整首一起挪叫移调，旋律不变。' },
      { q: '机器上 [KEY] 按一下挪多少？', a: ['一格（半音）', '一个八度', '一整个音阶'], why: '[KEY] 以半音为单位。' },
    ],
  },
  {
    id: 'TB', line: 'theory', kind: 'boss', title: '乐理大关', about: '亮暗、和弦、五声、半音：四段接力', minutes: 5,
    say: '乐理线的大关来了，啾！四段接力：每一段都是你学过的，一段过了才能进下一段。',
    quiz: {
      toy: 'relay', ask: '四段接力，一段过了才能进下一段。星星按最差的那一段给。',
      stages: [
        { toy: 'majorminor', title: '亮还是暗', needs: [2, 3, 3], ask: '听一小段：亮的还是暗的？', melodies: [[1, 2, 3, 5, 3, 0, 1, 0], [5, 3, 1, 3, 6, 0, 5, 0], [1, 3, 5, 8, 7, 5, 3, 1], [3, 3, 2, 1, 6, 5, 3, 0]] },
        { toy: 'oddchord', title: '不一样的和弦', needs: [2, 2, 3], ask: '三张牌，把不一样的那张找出来。' },
        { toy: 'pentaecho', title: '啾啾唱，你弹', needs: [2, 2, 3], ask: '啾啾唱一句，你照着弹。' },
        { toy: 'steps12', title: '一格还是两格', needs: [2, 3, 4], ask: '两个音差一格还是两格？' },
      ],
    },
    takeaway: '拍子、音高、音阶、和弦、距离：乐理线的几样你都过了一遍。机器上的 [OCTAVE]、[SCALE]、[KEY]、CHORD，就是它们的开关。',
    coach: '小课堂 TB「乐理大关」：乐理线的关底，四段接力（亮暗判断、找不同的和弦、啾啾唱你弹回来、半音全音），每段过了进下一段，星星按最差的一段。三档：铜每段要答对的少，金多。',
    links: { lessons: ['3-4'] },
    ask: [
      { q: '[OCTAVE]、[SCALE]、[KEY] 分别管什么？', a: ['换楼层、换梯子、整体挪调', '音量、速度、摇摆', '换音色、换效果、换工程'], why: '八度、音阶、调。' },
    ],
  },
];

export const THEORY = redo(OLD);
export { THEORY_UNITS };
