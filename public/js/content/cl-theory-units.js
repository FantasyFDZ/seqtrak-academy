// 乐理线重做 · 第一期（2026-11-17，方案见 docs/training-plan.md “乐理线重做”）：单元 1「音高」和单元 2「梯子」，8 关 + 1 件小作品。
// 这些关不再是“一句话 → 玩具 → 测验”：中间那一步换成“跟啾啾学”（guide），5–8 个小步，都在同一块乐理台上做
// （小步怎么写见 public/js/theory-guide.js 开头）；挑战也在乐理台上（public/js/theory-toys.js）。
// 老的 T5、T6、T7、T8、T12 在 cl-theory.js 里还留着原文：它们的“用在机器上”、带走的话、快问快答沿用，这里只换掉“学”和“挑战”。
// 新关：T14 机器的 7 个键、T15 搭一把梯子、T16 家、T17 小作品。
// 写法上的规矩照旧：短句、口语；先做出来，再给它起名字；主路上不出现五线谱；啾啾的话里可以带“啾”。
// 键号：60 是最左边的 C，每格加 1（61 = C#、62 = D……72 = 高一层的 C）。deg 是梯子上的第几级，8 = 高一层的家。
// 第二期（单元 3「旋律」、单元 4「和声」）在 cl-theory-units2.js，第三期（单元 5「拆歌」、重做的大关、两个选学单元）在 cl-theory-units3.js；
// 这个文件最后的 redo() 把三期排到一起。
import { PICK } from './classroom-bits.js';
import { UNITS_PHASE2 } from './cl-theory-units2.js';
import { UNITS_PHASE3 } from './cl-theory-units3.js';

export const THEORY_UNITS = [
  { id: 'u1', name: '单元 1 · 音高', sub: '高低、八度、12 格' },
  { id: 'u2', name: '单元 2 · 梯子', sub: '音阶、亮暗、家' },
  { id: 'u3', name: '单元 3 · 旋律', sub: '走跳、问答、重复、长短' },
  { id: 'u4', name: '单元 4 · 和声', sub: '距离、和弦、贝斯、转圈' },
  { id: 'u5', name: '单元 5 · 拆歌', sub: '找家、找和弦、看旋律' },
  // 选学：不在主路上（推荐路线不经过，每日五分钟不拿它们“尝鲜”，大关也不考）。关上写着 optional: true
  { id: 'x1', name: '选学 · 看懂谱子', sub: '想读五线谱再来', optional: true },
  { id: 'x2', name: '选学 · 和弦进阶', sub: '换站法、加颜色', optional: true },
];

const CHROMA = [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72];
const WHITE = [60, 62, 64, 65, 67, 69, 71, 72];
const STEPS = [2, 2, 1, 2, 2, 2, 1];
const SYNTH_ALL = (text, count = 7) => ({ text, goal: '把 7 个键弹一遍。', panel: ['SYNTHKEYS'], detect: { kind: 'note', track: 'SYNTH1', count }, wait: '挨个按…' });
const TO_SCALE = (n, text, goal) => ({ text, goal, panel: ['SCALE', 'METER'], detect: { kind: 'scale', scale: n }, wait: n === 0 ? '等最上面那盏亮…' : '等大调（第 2 盏）亮…' });

// ───────────── 单元 1 · 音高 ─────────────

const T5 = {
  kind: 'learn', unit: 'u1', minutes: 5,
  say: '同一个音，可以住在楼上，也可以住在楼下。先看看“高”和“低”在键盘上是什么样，啾。',
  guide: {
    start: { ladder: null, names: false, keys: false },
    beats: [
      { kind: 'listen', say: '先听两个音。眼睛盯着键盘：哪个在右边？', goal: '听两个音，看是哪两个键在亮。', line: [60, 79], gap: 0.7, after: '右边那个更**高**。键盘越往右，声音越高；上面那条线也跟着往上走。' },
      { kind: 'do', say: '你来试试，啾。', goal: '点一个比亮着的键**更高**的键。', show: { mark: [67] }, task: { type: 'press', rel: 'higher', ref: 67 }, ok: '对：往右就是往高。' },
      { kind: 'do', say: '反过来。', goal: '再点一个比它**更低**的键。', show: { mark: [67] }, task: { type: 'press', rel: 'lower', ref: 67 }, ok: '对：往左就是往低。' },
      { kind: 'listen', say: '白键从左到右走一遍。它们只有 7 个名字。', goal: '听白键走一遍，看键上的名字。', show: { names: true }, line: WHITE, gap: 0.3, after: '**C D E F G A B**，数完又回到 C。' },
      { kind: 'do', say: '同一个名字，键盘上不止一个。认 C 有个窍门：它右边紧挨着**两个**黑键。', goal: '把键盘上所有的 **C** 找出来：一共 3 个。', show: { names: false }, task: { type: 'all', pc: 0 }, ok: '三个 C：名字一样，一个比一个高。' },
      { kind: 'compare', say: '两组各听一遍：哪一组像“同一个人，换了个高度”？', goal: '比一比：A 是两个 C，B 是 C 和 G。', a: { label: 'C 和高一层的 C', line: [60, 72], gap: 0.6 }, b: { label: 'C 和 G', line: [60, 67], gap: 0.6 }, after: 'A 那两个像叠在一起：同一个名字，只是高了一层。' },
      { kind: 'name', say: '这个距离有名字，啾。', term: '八度', means: '同名的两个音，隔着的这一层楼，叫一个**八度**。' },
      { kind: 'do', say: '最后一个：看“长相”找同名的。', goal: '亮着的是 **E**。点出**高一层**的 E。', show: { mark: [64] }, task: { type: 'press', any: [76], hint: '不是它。E 紧挨在**两个黑键的右边**：往右找另一个长得一样的。' }, ok: '对：两个 E 长得一样，都紧挨在两个黑键的右边。' },
    ],
  },
  quiz: { toy: 'octavehunt', ask: '亮一个键，点出**高一层**或**低一层**的它。铜：键上有名字；银：没有名字；金：起点只亮一下。' },
};

const T6 = {
  kind: 'learn', unit: 'u1', minutes: 5,
  say: '一层楼里其实有 12 格，黑键白键都算。挨着的下一个键，就是走了一格。',
  guide: {
    start: { ladder: null, names: false, keys: false },
    beats: [
      { kind: 'listen', say: '这回黑键也算上，一个不落地走上去。数一数走了几步，啾。', goal: '从 C 走到高一层的 C：数一数一共几格。', line: CHROMA, gap: 0.2, after: '数出来了吗？' },
      {
        kind: 'pick', say: '黑的白的都算。', goal: '从 C 到高一层的 C，一共几格？',
        options: [{ label: '7 格', why: '7 是白键的个数。黑键也要算进去。' }, { label: '12 格', right: true, why: '**12 格**：7 个白键，加 5 个黑键。' }, { label: '8 格', why: '再数一遍：每挨着的一个键（黑的白的都算）是一格。' }],
      },
      { kind: 'do', say: '走一格，就是到**挨着**的下一个键。', goal: '从亮着的 **C** 出发，往右**走一格**。', show: { mark: [60] }, task: { type: 'press', any: [61], stepsFrom: 60 }, ok: '一格：从 C 到了它右边那个黑键。黑键没有自己的名字，借左边邻居的名字再加个 #：它叫 **C#**（读“升 C”）。' },
      { kind: 'do', say: '再来两格的。', goal: '从亮着的 **D** 出发，往右**走两格**。', show: { mark: [62] }, task: { type: 'press', any: [64], stepsFrom: 62 }, ok: '两格：D 到 E，中间跨过了一个黑键。' },
      { kind: 'compare', say: '一格和两格，听起来不一样宽。', goal: '比一比：走一格，和走两格。', a: { label: '一格', line: [60, 61], gap: 0.55 }, b: { label: '两格', line: [60, 62], gap: 0.55 }, after: '一格挤，两格宽一点。' },
      { kind: 'name', say: '它们也有名字。', term: '半音 · 全音', means: '走一格叫**半音**，走两格叫**全音**。' },
      { kind: 'do', say: '有两处白键和白键之间没有黑键。', goal: 'E 和 F 中间没有黑键。从亮着的 **E** 走**一格**，到哪儿？', show: { mark: [64], names: true }, task: { type: 'press', any: [65], stepsFrom: 64 }, ok: 'E 到 F 只有一格：它们本来就挨着。B 到 C 也是。' },
      {
        kind: 'pick', say: '数格子，以后经常用得上。', goal: 'C 到 G（亮着的两个），隔着几格？在键盘上数。', show: { mark: [60, 67] },
        options: [{ label: '5 格', why: '黑键也要数。从 C 往右，一个键一个键数到 G。' }, { label: '7 格', right: true, why: '**7 格**。这个距离后面会经常碰到。' }, { label: '8 格', why: '多数了一格：起点 C 自己不算。' }],
      },
    ],
  },
  quiz: { toy: 'stepecho', ask: '先响的那个键亮着。听出**第二个音**，在键盘上点出来。铜：走一格或两格；银：最多三格；金：往上往下都有，最多四格。' },
};

const T14 = {
  id: 'T14', line: 'theory', kind: 'learn', unit: 'u1', title: '机器的 7 个键', about: '机器的键是键盘上的哪 7 个', minutes: 4,
  say: '键盘上一层楼有 12 格，机器上却只有 7 个键。它们是哪 7 个？啾啾带你对一对。',
  guide: {
    start: { ladder: 'minor', root: 60, home: true, names: true, degrees: false, keys: true },
    beats: [
      { kind: 'listen', say: '机器上没有黑键白键，只有 7 个键。它们就是键盘上亮着的这 7 个，啾。', goal: '听机器的键 1 到键 7：看上面哪个键跟着亮。', deg: [1, 2, 3, 4, 5, 6, 7], gap: 0.34, after: '机器的键 1–7，就是亮着的这 7 个。桔红的是键 1。' },
      { kind: 'do', say: '按一个试试。', goal: '按一下机器的**键 3**（下面那排），看键盘上哪个亮。', task: { type: 'press', key: 3 }, ok: '键 3 是 **D#**：键盘上的一个黑键。机器已经帮你挑好了。' },
      { kind: 'do', say: '反过来找。', goal: '在**上面的键盘**上，点出机器的**键 5**。', task: { type: 'press', any: [67], from: 'piano', hint: '从桔红的键（键 1）往右数亮着的键：第 5 个。' }, ok: '键 5 是 **G**。' },
      { kind: 'do', say: '多对几次，就记住了。', goal: '配对 4 次：哪边亮了，就在另一边找到它。', task: { type: 'match', rounds: 4 }, ok: '两边对上了。' },
      { kind: 'listen', say: '机器上有个 [OCTAVE] 键：按一下，7 个键一起搬到另一层。', goal: '看整排亮着的键往右搬一层，再听一遍。', slide: 72, deg: [1, 2, 3, 4, 5, 6, 7], gap: 0.3, after: '名字一个没变，整排高了一个八度。' },
      { kind: 'name', say: '记住这一条，后面每一关都用得上，啾。', term: '7 个键 = 梯子的 7 级', means: '机器只给你挑好的 7 个音，一级一级像梯子。**键 1 是最底下那一级**。[OCTAVE] 换楼层。' },
    ],
  },
  quiz: { toy: 'keymatch', ask: '键盘上的键和机器的 7 个键，配对。铜：键上标着第几级；银：不标；金：每一轮家都会搬。' },
  machine: {
    tasks: [
      PICK('SYNTH1'),
      SYNTH_ALL('把 7 个 **Synth keys** 从 1 到 7 挨个按一遍（上排是 ● 1 2 3，下排是 4 5 6 7）。'),
      { text: '按一下 [OCTAVE]：机器**上边沿**那排 5 个小按钮里，左数第 2 个。右边那列小灯会换一盏亮。', goal: '换一层楼。', panel: ['OCTAVE', 'METER'], detect: { kind: 'octave' }, wait: '等你按 [OCTAVE]…' },
      SYNTH_ALL('再把 7 个键按一遍：同样的 7 级，换了一层楼。', 5),
    ],
    done: '7 个键就是梯子的 7 级。想回原来那层：多按几下 [OCTAVE]，让右边那列小灯回到**从下往上数第 4 盏**。',
  },
  takeaway: '键盘上一层楼有 12 格，机器只把其中 **7 个**挑出来给你：**7 个 Synth keys = 梯子的 7 级**，键 1 是最底下那一级。[OCTAVE] 让 7 个键一起换楼层。',
  coach: '小课堂 T14「机器的 7 个键」（乐理线重做后新加的）：把机器的 7 个 Synth keys 和钢琴键盘对上。出厂是 C 小调，键 1–7 = C D D# F G G# A#。学生在乐理台上两边互相找（按机器的键看键盘上哪个亮、反过来在键盘上点出键几），再看 [OCTAVE] 让整排搬一层。这里先不讲“音阶”这个词，只说“挑好的 7 个、像梯子”，下一关 T15 才搭梯子。',
  links: { lessons: ['2-1'] },
  ask: [
    { q: '机器的 7 个 Synth keys 是什么？', a: ['从 12 格里挑好的 7 个音', '键盘最左边的 7 个白键', '7 个八度'], why: '12 格里挑出 7 个，一级一级像梯子。' },
    { q: '出厂时，机器的键 3 是键盘上的？', a: ['一个黑键（D#）', 'E', 'C'], why: '出厂是 C 小调：键 3 是 D#。' },
  ],
};

// ───────────── 单元 2 · 梯子 ─────────────

const T15 = {
  id: 'T15', line: 'theory', kind: 'learn', unit: 'u2', title: '搭一把梯子', about: '音阶是按固定的步子搭出来的', minutes: 5,
  say: '12 格全用上太挤。好听的旋律只踩其中几个。哪几个？有个固定的步子，啾。',
  guide: {
    start: { ladder: null, names: false, keys: false },
    beats: [
      { kind: 'compare', say: '12 格全用上，听着像爬楼梯。只挑其中 7 个，味道就出来了。', goal: '比一比：12 个全上，和只挑 7 个。', a: { label: '12 个全上', line: CHROMA, gap: 0.16 }, b: { label: '只挑 7 个', line: WHITE, gap: 0.26 }, after: 'B 就是“do re mi fa sol la si do”。挑哪 7 个，有个固定的步子。' },
      { kind: 'do', say: '步子是：**两格、两格、一格，两格、两格、两格、一格**。照着它一级一级搭上去。', goal: '从 **C** 出发搭梯子。看下面的步子牌，一级一级点上去。', task: { type: 'seq', root: 60, steps: STEPS }, ok: '搭好了：从 C 出发，踩到的全是白键。' },
      { kind: 'do', say: '换个起点。步子一模一样。', goal: '这回从 **G** 出发，再搭一遍。', task: { type: 'seq', root: 67, steps: STEPS }, ok: '这回踩到了一个黑键（F#）。步子没变，起点一换，踩到的键就变了。' },
      { kind: 'name', say: '这把梯子有名字。', term: '大调音阶', means: '照“两两一、两两两一”搭出来的梯子叫**大调音阶**。梯子的每一级叫第 1 级、第 2 级……' },
      { kind: 'song', song: '《小星星》', say: '《小星星》就在这把梯子上走。看它踩了哪几级。', goal: '听一句，看亮起来的是第几级。', show: { ladder: 'major', root: 60, home: true, degrees: true }, deg: [1, 1, 5, 5, 6, 6, 5, null, 4, 4, 3, 3, 2, 2, 1], gap: 0.3, after: '1 1 5 5 6 6 5，4 4 3 3 2 2 1：全在梯子上。' },
      {
        kind: 'pick', say: '七步里，有两步是一格。', goal: '看键盘：梯子的第 3 级到第 4 级，隔几格？', show: { ladder: 'major', root: 60, home: true, degrees: true },
        options: [{ label: '一格', right: true, why: '一格。七步里只有两步是一格：3 → 4，和 7 → 回到 1。' }, { label: '两格', why: '看键盘：第 3 级和第 4 级中间没有别的键。' }],
      },
      { kind: 'do', say: '步子不是只有这一套。换一套步子，就是另一把梯子。你来搭一把自己的，啾。', goal: '从 **C** 出发，走 **7 步**到高一层的 C：每一步一格、两格或三格，随你排。', show: { ladder: null, degrees: true }, task: { type: 'freeladder', root: 60 } },
    ],
  },
  quiz: { toy: 'buildscale', ask: '给你一个起点，搭出大调。铜：有步子牌；银：没有牌，换了起点；金：起点更刁，步子自己记。' },
  machine: {
    tasks: [
      PICK('SYNTH1'),
      TO_SCALE(1, '按 [SCALE]：上边沿那排小按钮里左数第 3 个。看右边那列 8 盏小灯：**第 2 盏是大调（MAJOR）**。按到第 2 盏亮。', '换到大调。'),
      SYNTH_ALL('把 7 个 **Synth keys** 从 1 到 7 挨个按一遍：这就是你刚才搭的那把梯子。', 5),
      TO_SCALE(0, '听完用 [SCALE] 按回**最上面那盏**（小调）：后面的课都用它。', '换回小调。'),
    ],
    done: '机器替你把梯子搭好了：[SCALE] 换的是哪一把梯子。',
  },
  takeaway: '在 12 格里按“**两格、两格、一格，两格、两格、两格、一格**”挑出 7 个，就是**大调音阶**。起点可以换，步子不变。',
  coach: '小课堂 T15「搭一把梯子」（乐理线重做后新加的）：大调音阶是按“全全半全全全半”从 12 个半音里挑出来的；学生在乐理台上从 C、从 G 各搭一遍（G 大调踩到 F#），再看《小星星》在梯子上走。只说“两格 / 一格”和“第几级”，不讲调号。机器上：[SCALE] 换到 MAJOR 弹一遍 7 个键，再换回 MINOR。',
  links: { lessons: ['2-1'] },
  ask: [
    { q: '大调的步子是？', a: ['两两一、两两两一', '全是两格', '一格两格轮着来'], why: '两格、两格、一格，两格、两格、两格、一格。' },
    { q: '从 G 出发搭大调，会踩到几个黑键？', a: ['1 个（F#）', '一个都没有', '3 个'], why: '步子不变，起点换了：G 大调踩到 F#。' },
  ],
};

const MELODY = [1, 3, 5, 3, 6, 5, 3, 1];
const T7 = {
  kind: 'learn', unit: 'u2', minutes: 5,
  say: '同一段旋律，换一把梯子爬，心情就变了：一把亮堂，一把发暗。',
  guide: {
    start: { ladder: 'major', root: 60, home: true, degrees: true, names: false, keys: false },
    beats: [
      { kind: 'listen', say: '先听这一句。它走在上一关搭的那把梯子上。', goal: '听一句。', deg: MELODY, gap: 0.32, after: '亮堂堂的。' },
      { kind: 'listen', say: '同一句。只是梯子上的第 3、6、7 级，各往左挪了一格。', goal: '再听：同一句，换了一把梯子。', show: { ladder: 'minor' }, deg: MELODY, gap: 0.32, after: '暗下来了。旋律没换，换的是脚下的梯子。' },
      { kind: 'compare', say: '来回听几遍，盯着第 3、6、7 级的位置。', goal: '比一比两把梯子。', a: { label: '☀ 亮的', show: { ladder: 'major' }, deg: MELODY, gap: 0.32 }, b: { label: '☾ 暗的', show: { ladder: 'minor' }, deg: MELODY, gap: 0.32 }, after: '差别只在第 3、6、7 这三级。' },
      { kind: 'do', say: '你来把它变暗，啾。', goal: '这把梯子是亮的。点第 **3、6、7** 级，让它们各往左挪一格。', show: { ladder: 'major' }, task: { type: 'rungs', to: 'minor' }, ok: '暗下来了：三级各挪了一格。' },
      { kind: 'name', say: '两把梯子都有名字。', term: '大调 · 小调', means: '亮的那把叫**大调**，暗的那把叫**小调**。机器出厂用的是小调。' },
      {
        // 同一组键换个家（2026-11-17 第二期补的）：C 小调的 7 个键，把家的牌子挂到第 3 级（D#）上，就是 D# 大调
        kind: 'compare', say: '还有一招，连键都不用挪。暗梯子的 7 个键一个不换，只把“家”的牌子挂到第 3 级上。', goal: '比一比：同一组键，家在 C，和家挂到 D# 上。',
        a: { label: '家在 C', show: { ladder: 'minor', root: 60 }, line: [60, 63, 67, 65, 63, 62, 60], gap: 0.32 },
        b: { label: '家挂到 D#', show: { ladder: [-3, -1, 0, 2, 4, 5, 7, 9], root: 63, degreeLabels: [6, 7, 1, 2, 3, 4, 5, 6], noTop: true }, line: [63, 67, 70, 68, 67, 65, 63], gap: 0.32 },
        after: '亮着的键一个没换。家一换，暗的就变亮了：从 D# 数上去，步子正好是“两两一、两两两一”。在机器上不按 [SCALE] 也能亮起来：把**键 3** 当家。',
      },
      {
        kind: 'pick', say: '梯子不给你看了，用耳朵。', goal: '听一句：它是亮的，还是暗的？', show: { ladder: null }, line: [67, 63, 60, 63, 67, 72, 70, 67], gap: 0.3,
        options: [{ label: '☀ 亮', why: '这句是**暗**的：中间那几个音往下沉了一点。' }, { label: '☾ 暗', right: true, why: '暗的：小调。' }],
      },
      { kind: 'song', song: '《欢乐颂》', say: '《欢乐颂》用的是亮的那一把。', goal: '听一句，看它踩了哪几级。', show: { ladder: 'major', root: 60, home: true, degrees: true }, deg: [3, 3, 4, 5, 5, 4, 3, 2, 1, 1, 2, 3, 3, 2, 2], gap: 0.3, after: '大调：听着敞亮。' },
    ],
  },
  quiz: { toy: 'ladderfix', ask: '把梯子修成亮的或暗的：点第 3、6、7 级。铜：标着第几级；银：不标，梯子是乱的；金：听啾啾的梯子，把自己的调成一样。' },
};

const T16 = {
  id: 'T16', line: 'theory', kind: 'learn', unit: 'u2', title: '家', about: '第 1 级：一句话落在它上面才踏实', minutes: 5,
  say: '梯子上有一级很特别：一句话走到它那儿，就像回了家。啾啾带你听听“悬着”和“落地”。',
  guide: {
    start: { ladder: 'minor', root: 60, home: true, degrees: true, names: false, keys: false },
    beats: [
      { kind: 'listen', say: '听这一句。它停在了半路上。', goal: '听一句没说完的话。', deg: [1, 3, 5, 4, 3, 2, 5], gap: 0.34, after: '悬着，对吧？像话说到一半。看上面那条线：最后一个点停在半空。' },
      { kind: 'listen', say: '同一句，只换最后一个音。', goal: '再听：最后一个音换了。', deg: [1, 3, 5, 4, 3, 2, 1], gap: 0.34, after: '踏实了：它**回家**了。最后一个点落回了桔红的虚线上。' },
      {
        kind: 'do', say: '你来给它收尾，啾。', goal: '这一句差最后一个音。点一个键，让它**回家**。',
        task: { type: 'last', deg: [1, 2, 3, 5, 4, 3, 2], why: { 5: '停在第 5 级上：它最想往家走，可还没到。', 7: '第 7 级的隔壁就是家：再往上走一级就到了。', 2: '第 2 级就在家的隔壁：再往下一级。', 3: '第 3 级不算太悬，可也没到家。再往下找。' } },
        ok: '回家了：最后一个音落在第 1 级上。',
      },
      { kind: 'do', say: '再来一句，这回从高处往下走。', goal: '这一句也差最后一个音。让它回家。', task: { type: 'last', deg: [8, 7, 5, 4, 5, 3, 2] }, ok: '到家了。高一层那个桔红的键也是家：名字一样。' },
      { kind: 'compare', say: '换到亮的那把梯子上听：它的第 7 级离家只有**一格**。', goal: '比一比：停在第 7 级，和再走一格回到家。', show: { ladder: 'major' }, a: { label: '停在第 7 级', deg: [1, 3, 5, 8, 7], gap: 0.36 }, b: { label: '回到家', deg: [1, 3, 5, 8, 7, 8], gap: 0.36 }, after: '离家只差**一格**的时候，最想回去。暗梯子的第 7 级离家有两格，就没这么急。' },
      { kind: 'name', say: '它当然有名字。', term: '家（主音）', means: '梯子的第 1 级是**家**，学名叫**主音**。一句话落在它上面就踏实。机器上是**键 1**。' },
      { kind: 'song', song: '《小星星》', say: '《小星星》的最后一句：一级一级走回家。', goal: '听它怎么回家。', show: { ladder: 'major' }, deg: [4, 4, 3, 3, 2, 2, 1], gap: 0.32, after: '4 4 3 3 2 2 **1**：到家，歌也唱完了。' },
      {
        kind: 'pick', say: '最后考考耳朵。', goal: '听一句：它落地了，还是悬着？', show: { ladder: 'minor' }, deg: [1, 2, 3, 4, 5], gap: 0.34,
        options: [{ label: '落地了', why: '它停在第 5 级上：看那条线，最后一个点在半空。' }, { label: '还悬着', right: true, why: '停在第 5 级：悬着，等着回家。' }],
      },
    ],
  },
  quiz: { toy: 'homeward', ask: '一句话差最后一个音：点一个键，让它回家。铜：家标着；银：家不标，每轮都搬；金：梯子也不亮，全靠耳朵。' },
  machine: {
    tasks: [
      PICK('SYNTH1'),
      { text: '在 **Synth keys** 上随便弹几个键，最后一下落在 **键 1**（上排左数第 2 个，第 1 个带圆点的是录音键）。', goal: '弹一句，落在键 1 上。', panel: ['SYNTHKEYS', 'SK1'], detect: { kind: 'note', track: 'SYNTH1', count: 4 }, wait: '弹几个，最后按键 1…' },
      { text: '再弹一句，这回故意停在 **键 5** 上：听它悬着。然后补一下 **键 1**。', goal: '先悬着，再回家。', panel: ['SK5', 'SK1'], detect: { kind: 'note', track: 'SYNTH1', count: 4 }, wait: '停在键 5，再补键 1…' },
    ],
    done: '键 1 是家。写旋律、写贝斯，最后落在它上面准没错。',
  },
  takeaway: '梯子的第 1 级是**家**（主音）。停在别的音上悬着，落回家才踏实。机器上的**键 1** 就是家。',
  coach: '小课堂 T16「家」（乐理线重做后新加的）：主音和“回家”的感觉。学生在乐理台上听一句停在第 5 级的（悬着）和落回第 1 级的（踏实），自己给两句没写完的旋律补最后一个音；挑战是“让它回家”（银、金两档家会搬、不标出来，要用耳朵找主音）。梯子用机器出厂的自然小调；“离家越近越想回去”那一步是换到大调上比的（大调的第 7 级离家一格，自然小调的离家两格），不出“导音”这个词。机器上键 1 是主音。',
  links: { lessons: ['2-2', '2-3'], charts: ['bass-root'] },
  ask: [
    { q: '一句旋律落在哪一级上，听着最踏实？', a: ['第 1 级（家）', '第 5 级', '第 7 级'], why: '第 1 级是家，学名叫主音。' },
    { q: '机器上，“家”是哪个键？', a: ['键 1', '键 5', '键 7'], why: '键 1 是梯子的第 1 级。' },
  ],
};

const T8 = {
  kind: 'learn', unit: 'u2', minutes: 5,
  say: '梯子上有两处挤得慌。把它们拿掉，只剩 5 个音：闭着眼乱按都好听。啾啾最爱这 5 个。',
  guide: {
    start: { ladder: 'minor', root: 60, home: true, degrees: true, names: false, keys: false },
    beats: [
      { kind: 'listen', say: '梯子上有两对挨得特别近的：只隔一格。一起响，会打架。', goal: '听这两对一起响。', deg: [[2, 3], null, [5, 6]], gap: 0.75, after: '挤得慌。第 2、3 级只隔一格，第 5、6 级也是。' },
      { kind: 'do', say: '每一对里拿走一个，就不挤了。', goal: '点第 **2** 级和第 **6** 级，把它们从梯子上拿走。', task: { type: 'drop', degrees: [2, 6] }, ok: '剩下 5 个：第 1、3、4、5、7 级。两两之间都隔得开。' },
      { kind: 'listen', say: '就剩这 5 个了。上去，再下来。', goal: '听这 5 个音走一遍。', show: { ladder: 'penta' }, deg: [1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1], gap: 0.26, after: '顺不顺？没有一个音是挤着的。' },
      { kind: 'do', say: '伴奏放起来，在这 5 个键上乱按。啾啾保证不难听。', goal: '点「放伴奏」，在亮着的键上**随便按 8 下**。', show: { ladder: 'penta' }, task: { type: 'free', count: 8, backing: true }, ok: '怎么按都在调上：这就是安全区。' },
      { kind: 'name', say: '这把短梯子也有名字。', term: '五声音阶', means: '只有 5 个音的梯子叫**五声音阶**。没有挤在一起的半音，怎么按都顺。' },
      { kind: 'do', say: '啾啾问一句，你答一句。想把话说完，就落在家上。', goal: '点「听啾啾问」，然后用亮着的键**答 4 个音**。', show: { ladder: 'penta' }, task: { type: 'answer', ask: [1, 2, 3, 4], count: 4 } },
    ],
  },
  // 2026-11-18 第三期：挑战从一排 6 个键（pentaecho）搬到了乐理台上（theory-toys3.js 的 pentaback），玩法没变
  quiz: { toy: 'pentaback', ask: '啾啾唱一句，你在安全区的键上照着弹回来。铜：2 个音，看得见啾啾那条线；银：3 个音，只亮第一个；金：4 个音，只能听。' },
};

const LINE = [1, 3, 5, 4, 3, 2, 1];
const T12 = {
  kind: 'learn', unit: 'u2', minutes: 5,
  say: '一首歌嫌太低、唱不上去？整首一起往上搬几格就行：旋律一点没变，只是换了个“家”。',
  guide: {
    start: { ladder: 'minor', root: 60, home: true, degrees: false, names: false, keys: false },
    beats: [
      { kind: 'listen', say: '先听这一句，记住上面那条线的形状。', goal: '听一句。现在家在 C。', deg: LINE, gap: 0.32, after: '记住这条线的样子。' },
      { kind: 'listen', say: '整把梯子往右挪两格，再弹同一句。', goal: '看梯子怎么搬，再听。', slide: 62, deg: LINE, gap: 0.32, after: '那条线的**形状一点没变**，只是整体高了两格。' },
      { kind: 'compare', say: '搬远一点再比。', goal: '比一比：同一句，住在两个地方。', a: { label: '家在 C', show: { root: 60 }, deg: LINE, gap: 0.32 }, b: { label: '家在 F', show: { root: 65 }, deg: LINE, gap: 0.32 }, after: '还是那句话，只是整体高了。' },
      { kind: 'do', say: '你来搬，啾。', goal: '用 **KEY − / +** 把家搬到 **G**。', task: { type: 'home', to: 7 }, ok: '家在 G 了：这把梯子现在叫 G 小调。' },
      { kind: 'name', say: '家在哪儿，就叫什么调。', term: '调 · 移调', means: '家在哪个音上，这首歌就是什么**调**。整把梯子一起挪，叫**移调**：旋律一点不变。' },
      {
        kind: 'pick', say: '用眼睛和耳朵一起判断。', goal: '听两句：第二句是第一句**搬了家**，还是**换了一句**？', line: [60, 63, 67, 65, 63, 62, 60, null, 65, 68, 72, 70, 68, 67, 65], gap: 0.28,
        options: [{ label: '搬了家', right: true, why: '同一句，家从 C 搬到了 F。看那条线：两段的形状一样。' }, { label: '换了一句', why: '看上面那条线：两段的形状一模一样，只是高低不同。' }],
      },
      {
        kind: 'pick', say: '再来一组。', goal: '这两句呢？', line: [60, 63, 67, 65, 63, 62, 60, null, 60, 62, 63, 67, 65, 62, 60], gap: 0.28,
        options: [{ label: '搬了家', why: '两句都从 C 出发、回到 C：家没搬。可第二句走的路不一样了。' }, { label: '换了一句', right: true, why: '家没搬，路变了：这是另一句。' }],
      },
    ],
  },
  quiz: { toy: 'movehome', ask: '啾啾在另一个调上弹了一句：用 KEY − / + 把你的梯子搬过去。铜：看得见啾啾那条线；银：只亮第一个音；金：只能听。' },
};

const T17 = {
  id: 'T17', line: 'theory', kind: 'make', unit: 'u2', title: '让它回家', about: '小作品：给一句旋律收尾', minutes: 4,
  say: '第一件小作品，啾！啾啾起个头，你来收尾：让这句话回家。写着玩，没有标准答案。',
  guide: {
    start: { ladder: 'penta', root: 60, home: true, degrees: true, names: false, keys: false },
    beats: [
      { kind: 'listen', say: '啾啾先起个头。只用安全区的 5 个音。', goal: '听啾啾的开头。', deg: [1, 2, 3, 4], gap: 0.36, after: '它往上走，停在了半空。' },
      { kind: 'do', say: '先练一次手。', goal: '补一个音，让它回家。', task: { type: 'last', deg: [1, 2, 3, 4, 3, 2] }, ok: '就是这个感觉。接下来你自己多写几个音。' },
      { kind: 'name', say: '窍门只有一条，啾。', term: '写一句的窍门', means: '中间怎么走，随你。想收住，最后一个音落在**家**上。' },
    ],
  },
  quiz: { toy: 'finishline', ask: '接着啾啾的开头写下去，最后落在家上，收进小本子。铜：接 2 个音；银：接 4 个；金：接 6 个。' },
  takeaway: '写旋律不难：在安全区的 5 个音里走，最后落在**家**上，一句话就完整了。',
  coach: '小课堂 T17「让它回家」（乐理线重做后新加的，单元 2 的小作品）：啾啾给 4 个音的开头（小调五声），学生接 2 / 4 / 6 个音（铜 / 银 / 金），唯一的要求是最后一个音落在主音上。写好的句子存在进度文件的 works 里（以后的“小本子”）。没有标准答案，多鼓励；可以提示“一步一步走”和“跳一下”听起来不一样。',
  links: { lessons: ['2-3'] },
  ask: [
    { q: '想让一句旋律听着“说完了”，最后一个音落在哪？', a: ['家（第 1 级）', '最高的那个音', '随便哪个都行'], why: '落在家上，一句话才收得住。' },
  ],
};

/**
 * 把老的乐理线换成重做之后的样子：T5、T6、T7、T8、T12 换掉“学”和“挑战”，插进新关，排成单元的顺序。
 * old 是 cl-theory.js 里原来那 11 关。
 */
export function redo(old) {
  const by = Object.fromEntries(old.map((l) => [l.id, l]));
  const swap = (id, patch) => {
    const { play, ...rest } = by[id]; // 老的“玩一玩”不要了
    return { ...rest, ...patch };
  };
  const P = UNITS_PHASE2;
  const Q = UNITS_PHASE3;
  return [
    // 原来打头的 T1、T2（“拍子”那一组）2026-11-18 并进了节奏线的 R1、R2（content/classroom.js 的 MERGED）
    swap('T5', T5), swap('T6', T6), T14,
    T15, swap('T7', T7), T16, swap('T8', T8), swap('T12', T12), T17,
    P.T18, P.T19, P.T20, P.T21, P.T22,
    swap('T9', P.T9), swap('T10', P.T10), P.T23, P.T24, P.T25, swap('T11', P.T11), P.T26, P.T27,
    Q.T28, Q.T29, Q.T30, swap('TB', Q.TB), // 大关沿用老的关号：旧进度和卡不丢
    ...['T31', 'T32', 'T33', 'T34', 'T35', 'T36'].map((id) => Q[id]).filter(Boolean),
  ];
}
