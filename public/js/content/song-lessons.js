// 曲目的“一轨一轨照着搭”的课：照着 content/song-parts.js 里一首歌的 SEQTRAK 版分轨，在机器上把它一层层搭出来。
// 写法和章节里的课一样（步骤类型、detect / sim / live、liveBlocks……见 curriculum.js 顶部和 ch0.js、ch3.js 的说明），
// 只是不属于哪一章：不在首页的地图上，从那首歌的分轨页（#/songs/<id>）进，学完回到那一页（lesson.back）。
// curriculum.js 的 findLesson() 也会在这里找；经验照普通的课算（levels.js）。
//
// 核对用的目标（每一步是第几个键、实际是哪个音）是从分轨数据里算出来的，课文里的字是手写的，两边要一起改。
// 机器操作的依据（docs/seqtrak-operation-reference.md）：3.2 速度和 Swing、3.5.3 八度（按住 [OCTAVE] 转 [ALL]，V2.00）、
// 3.5.4 / 3.5.5 音阶和调、3.5.6 CHORD、3.5.10 步进编辑、3.7.4 [BAR LENGTH]、3.4.2 [PAGE] 翻页、3.8 静音和独奏、3.15.1 混音台（发送混响 / 延迟）。
import { SONG_PARTS } from './song-parts.js';
import { SONGS } from './songs.js';
import { songLesson } from './song-lesson-gen.js';
import { synthKeyNote } from '../scales.js';

const FADED = SONG_PARTS.faded;
const part = (song, track) => song.parts.find((p) => p.track === track);

/** 一条合成器分轨在 [from, to) 这几步里：每一步是第几个键 */
const keysIn = (song, track, from = 0, to = 999) =>
  Object.fromEntries(part(song, track).notes.filter(([s]) => s >= from && s < to).map(([s, k]) => [s, k]));

/** 同上，但是实际的音（MIDI 音符号；单音轨才用，认得出八度） */
const notesIn = (song, track, from = 0, to = 999) => {
  const p = part(song, track);
  return Object.fromEntries(p.notes.filter(([s]) => s >= from && s < to)
    .map(([s, k, , shift = 0]) => [s, synthKeyNote(k, { scale: song.scale, key: song.key, octave: (p.octave || 0) + shift })]));
};

const PAGE_LIGHTS = '翻到第几页，右边那列小灯里会有一个青蓝色的灯在闪：最下面那个是第 1 页，往上依次是第 2、3、4 页。';

const faded = {
  id: 'song-faded',
  song: 'faded',
  no: 'Faded',
  title: '一轨一轨搭出来',
  minutes: 40,
  simProject: 4, // 模拟机上用 5 号空白工程，和章节里的课（4 号）分开
  simFresh: true, // 从第 1 步开始时先把它清空（几首歌的课共用这个工程）
  back: { href: '#/songs/faded', label: '← Faded 分轨', done: '回到《Faded》分轨', nav: 'songs' },
  summary: '照着 SEQTRAK 版分轨，在机器上把《Faded》一层层搭出来：鼓 → 贝斯 → 和弦 → 旋律，最后加上混响。',
  takeaway: '一首歌在机器上就是几条轨道各放一段乐句：**鼓**一小节、自己重复；**贝斯**和**和弦**跟着键 1 → 6 → 3 → 7 一小节换一个；**旋律**一拍一个音。四小节的乐句：先把第 1 小节做好，按 [BAR LENGTH] 加长（机器会照抄），再一页一页只改要变的地方。氛围靠**混响**：钢琴和铺底多送，底鼓和贝斯不送。',
  homework: '用独奏和静音把四层拆开、再一层层推回来，像打碟时那样“演”一遍这首歌。学完第 4 章（音色），回来给铺底和钢琴各挑一个更像原曲的音色。',
  steps: [
    // ───────── 1 ─────────
    {
      type: 'read',
      title: '先听一遍',
      blocks: [
        '这节课照着《Faded》的 SEQTRAK 版，在机器上把它**一层一层搭出来**：先鼓，再贝斯，再和弦，最后是前奏那段钢琴旋律，然后加上混响。先听听最后会是什么样：',
        { widget: 'song', song: 'faded' },
        '点「一层层加上去」：先只有鼓，每四小节加一层。等会儿就照这个顺序来做。',
        { callout: 'theory', text: '整首歌就是四个和弦转圈：**键 1 → 6 → 3 → 7**，一小节一个——就是 3.4 课那一套。这次不一样的是：调是原曲的 **D♯**，乐句是**四小节**。' },
        { callout: 'tip', text: '这是简化版，和原曲哪里不一样，分轨页右边列着。这节课大约 40 分钟，可以分几次做：进度会记着，下次从停下的那一步接着来。' },
      ],
      coach: '曲目课《Faded》的开场：学生先听这首歌的 SEQTRAK 版（应用合成的声音，有混响）。整首是 D♯ 小调（机器上 MINOR + KEY D♯），90 BPM，四小节一圈，和弦是 Synth key 1 → 6 → 3 → 7，一小节一个；6 条轨道：KICK、SNARE、HAT 1、SYNTH 1 贝斯、SYNTH 2 和弦（CHORD）、DX 旋律（前奏的钢琴，一拍一个音）。接下来按 鼓 → 贝斯 → 和弦 → 旋律 → 混响 → 一层层听 的顺序搭。',
    },

    // ───────── 2 ─────────
    {
      type: 'do',
      title: '准备：空工程、速度和调',
      blocks: [
        '换一个空工程，免得和前面课里做的东西混在一起；再把速度、摇摆、音阶和调设成这首歌的。',
        { callout: 'tip', text: '模拟机已经替你换到了 5 号工程，第一项会自己打勾。[BPM −] **按住不放**会连着往下走。' },
      ],
      liveBlocks: [
        '换一个空工程，免得和前面课里做的东西混在一起；再把速度、摇摆、音阶和调设成这首歌的。真机没有屏幕，下面就是它的读数：',
        { device: ['project', 'tempo', 'swing', 'scale', 'key'] },
        { callout: 'tip', text: '5 号工程以前用过、里面已经有东西的话，换到 6、7、8 号也行。' },
        { action: 'tempo', value: 90, label: '让应用直接把速度设成 90' },
        { action: 'scalekey', scale: 0, key: 3, label: '让应用直接设成 MINOR / D#' },
      ],
      tasks: [
        { text: '换到 **5 号工程**：**先按住 [PROJECT↑] 不放，再按上排第 5 个步进键**。', panel: ['PROJECT', 'DK5'], detect: { kind: 'project', in: [4, 5, 6, 7] }, wait: '长按 [PROJECT↑] 出现黑圈，再点上排第 5 个步进键…', liveWait: '等你换到 5 号（或 6–8 号）工程…' },
        { text: '速度调到 **90 BPM**：按右侧面的 [BPM −] / [BPM +]。', panel: ['BPM-', 'BPM+'], detect: { kind: 'tempo', value: 90 }, wait: '按住 [BPM −] 往下走，到 90 停…', liveWait: '等速度变成 90…' },
        { text: '摇摆归零：**先按住 [DELETE] 不放，再按一下 [SWING]**（本来就是 0 的话，这一项会自己打勾）。', panel: ['DELETE', 'SWING'], detect: { kind: 'swing', zero: true }, wait: '长按 [DELETE] 出现黑圈，再点 [SWING]…', liveWait: '等摇摆变成 0…' },
        { text: '音阶和调设成 **MINOR / D♯**：按 [SCALE] 到第 1 个（右边那列灯最上面那个），再按 [KEY] 到 **D♯**（D、E 两个灯一起亮）。', panel: ['SCALE', 'KEY', 'METER'], detect: { kind: 'scale', scale: 0, key: 3 }, wait: '点 [SCALE]、[KEY]，看模拟机下面那行字…', liveWait: '等读数变成 小调 / D#…' },
      ],
      done: '准备好了：90 BPM、不摇、D♯ 小调。',
      coach: '学生在为《Faded》准备工程：换到空白工程（按住 [PROJECT↑] + 上排第 5 个步进键，5–8 号都行），速度 90（[BPM+]/[BPM-]，按住连着变），摇摆归零（按住 [DELETE] + [SWING]），SCALE 第 1 个 MINOR（Global Meter 最上面的灯），KEY D#（Global Meter 上 D、E 两个灯同时亮）。真机上这几样应用都读得出来，自动打勾；连着真机时页面上有“让应用直接设”的按钮。',
    },

    // ───────── 3 ─────────
    {
      type: 'program',
      title: '鼓：三条轨道',
      target: Object.fromEntries(FADED.parts.filter((p) => p.steps).map((p) => [p.track, p.steps])),
      tracks: ['KICK', 'SNARE', 'HAT1'],
      bpm: FADED.bpm,
      blocks: [
        '三条鼓轨，每条只有一小节，机器会自己重复：',
        { list: ['**KICK**：第 1、9 步（第 1、3 拍）', '**SNARE**：第 5、13 步（第 2、4 拍）', '**HAT 1**：第 3、7、11、15 步（每拍的后半拍）'] },
        { callout: 'tip', text: '空白工程里 KICK 的第 1 步本来就亮着，正好用得上。音色先用机器里现成的，挑音色是第 4 章的事。' },
      ],
      legend: '先按一下轨道旋钮选中它（KICK、SNARE、HAT 1），再按亮它要的那几个步进键。三条都对了自动过关。',
      done: '鼓有了：咚—啪—咚—啪，“嚓”落在每拍的后半拍。',
      coach: '《Faded》的鼓：KICK 第 1、9 步，SNARE 第 5、13 步，HAT 1 第 3、7、11、15 步（反拍），都是一小节。选轨道要按旋钮（不是转），转了会换乐句。真机上鼓轨的格子读得出来，改一格页面就跟着变，全对了自动过关。',
    },

    // ───────── 4 ─────────
    {
      type: 'do',
      title: '贝斯：四小节，四个根音',
      blocks: [
        '贝斯在 **SYNTH 1** 上：一小节两下（第 1、9 步），根音跟着和弦走——**键 1 → 6 → 3 → 7**，一小节换一个。',
        '四小节的乐句最省事的做法：**先把第 1 小节做好，再按 [BAR LENGTH] 加长**。机器会把第 1 小节照抄到后面，然后一页一页只改要变的那两步。',
        { callout: 'warn', text: '贝斯不是 CHORD 弹法，换一步里的音要用老办法：**按灭 → 按一下新的 Synth key → 再按亮**。' },
      ],
      liveBlocks: [
        '贝斯在 **SYNTH 1** 上：一小节两下（第 1、9 步），根音跟着和弦走——**键 1 → 6 → 3 → 7**，一小节换一个。',
        '四小节的乐句最省事的做法：**先把第 1 小节做好，再按 [BAR LENGTH] 加长**。机器会把第 1 小节照抄到后面，然后一页一页只改要变的那两步。',
        { device: ['bars:SYNTH1'] },
        { action: 'bars', track: 'SYNTH1', bars: 4, label: '让应用直接把 SYNTH 1 这段设成 4 小节' },
        { callout: 'warn', text: '贝斯不是 CHORD 弹法，换一步里的音要用老办法：**按灭 → 按一下新的 Synth key → 再按亮**。' },
        { callout: 'tip', text: `${PAGE_LIGHTS} 合成器轨的格子应用读不出来，填格子的几项做完自己点“做好了”。` },
      ],
      tasks: [
        { text: '进入 SYNTH 1 的步进输入：**先按住 [PAGE] 不放，再按一下 SYNTH 1 旋钮**。', panel: ['PAGE', 'SYNTH1'], detect: { kind: 'track', track: 'SYNTH1' }, sim: { kind: 'mode', mode: 'stepinput', track: 'SYNTH1', on: true }, wait: '长按 [PAGE] 出现黑圈，再点 SYNTH 1 旋钮…', liveWait: '等你按 SYNTH 1 旋钮…' },
        { text: '按一下 **Synth key 1**，再按亮第 **1、9** 个步进键。', panel: ['SK1', 'DK1', 'DK9'], sim: { kind: 'stepkeys', track: 'SYNTH1', keys: keysIn(FADED, 'SYNTH1', 0, 16), exact: true }, wait: '点 Synth key 1，再按亮第 1、9 个步进键…' },
        { text: '按 **[BAR LENGTH]**，直到这段乐句变成 **4 小节**（1 → 2 → 4，按两下）。第 1 小节会被照抄到后面三小节。', panel: ['BARLENGTH', 'METER'], detect: { kind: 'length', track: 'SYNTH1', bars: 4 }, wait: '点两下 [BAR LENGTH]…', liveWait: '按 [BAR LENGTH]，直到读数是 4 小节…' },
        { text: '**单按一下** [PAGE] 翻到第 2 页，第 1、9 个换成**键 6**：先**按灭**，按一下 **Synth key 6**，再**按亮**。', panel: ['PAGE', 'SK6', 'DK1', 'DK9'], sim: { kind: 'stepkeys', track: 'SYNTH1', keys: keysIn(FADED, 'SYNTH1', 16, 32) }, wait: '短按 [PAGE] → 按灭第 1、9 个 → 点 Synth key 6 → 再按亮…' },
        { text: '再单按 [PAGE] 翻到第 3 页，第 1、9 个换成**键 3**。', panel: ['PAGE', 'SK3', 'DK1', 'DK9'], sim: { kind: 'stepkeys', track: 'SYNTH1', keys: keysIn(FADED, 'SYNTH1', 32, 48) }, wait: '短按 [PAGE] → 按灭 → 点 Synth key 3 → 再按亮…' },
        { text: '再单按 [PAGE] 翻到第 4 页，第 1、9 个换成**键 7**。', panel: ['PAGE', 'SK7', 'DK1', 'DK9'], sim: { kind: 'stepkeys', track: 'SYNTH1', keys: keysIn(FADED, 'SYNTH1'), exact: true }, wait: '短按 [PAGE] → 按灭 → 点 Synth key 7 → 再按亮…' },
        { text: '再单按一下 [PAGE] 翻回第 1 页，短按 [PLAY]：鼓和贝斯，四小节一圈。', panel: ['PAGE', 'PLAY'], detect: { kind: 'start' }, wait: '短按 [PAGE]，再点 [PLAY]…', liveWait: '翻回第 1 页，然后按 [PLAY]…' },
        { text: '听够了按 [PLAY] 停下。', panel: ['PLAY'], detect: { kind: 'stop' }, wait: '再点 [PLAY]…', liveWait: '等你停止…' },
      ],
      done: '贝斯有了：D♯ → B → F♯ → C♯，一小节换一个。',
      coach: '《Faded》的贝斯在 SYNTH 1（MONO）：第 1、9 步，四小节依次是 Synth key 1、6、3、7（D# B F# C#）。做法：按住 [PAGE] + SYNTH 1 旋钮进步进输入；按 Synth key 1 再按亮第 1、9 个步进键；按 [BAR LENGTH] 到 4 小节（第 1 小节被照抄到后面）；单按 [PAGE] 翻页，每页把第 1、9 个按灭 → 按新的 Synth key → 按亮。MONO 轨不能用“按住步进键 + Synth key”换音（那是往一步里加音）。真机上合成器轨的格子读不出来，学生自己点“做好了”；[BAR LENGTH] 的长度读得出来。',
    },

    // ───────── 5 ─────────
    {
      type: 'do',
      title: '和弦：一小节一个，铺满',
      blocks: [
        '和弦在 **SYNTH 2** 上，用 3.2 课的 **CHORD 弹法**：一个键就是一整个和弦。每小节第 1 步放一个，拉长到铺满整小节；顺序还是 **1 → 6 → 3 → 7**。',
        { callout: 'warn', text: '弹法存在音色里：要换音色的话**先换音色，再切 CHORD**。这节课先用现成的音色。' },
        { callout: 'tip', text: '拉长和换和弦都是按住步进键做的：**长按半秒**出现黑圈，就是按住了。' },
      ],
      liveBlocks: [
        '和弦在 **SYNTH 2** 上，用 3.2 课的 **CHORD 弹法**：一个键就是一整个和弦。每小节第 1 步放一个，拉长到铺满整小节；顺序还是 **1 → 6 → 3 → 7**。',
        { device: ['poly:SYNTH2', 'bars:SYNTH2'] },
        { action: 'polymode', track: 'SYNTH2', mode: 2, label: '让应用直接把 SYNTH 2 切到 CHORD' },
        { action: 'bars', track: 'SYNTH2', bars: 4, label: '让应用直接把 SYNTH 2 这段设成 4 小节' },
        { callout: 'warn', text: '弹法存在音色里：要换音色的话**先换音色，再切 CHORD**。这节课先用现成的音色。' },
        { callout: 'tip', text: `${PAGE_LIGHTS} 放和弦、拉长、换和弦这几项应用看不见，做完自己点“做好了”。` },
      ],
      tasks: [
        { text: '按一下 **SYNTH 2 旋钮**选中它。', panel: ['SYNTH2'], detect: { kind: 'track', track: 'SYNTH2' }, wait: '点一下 SYNTH 2 旋钮…', liveWait: '等你按 SYNTH 2 旋钮…' },
        { text: '**慢慢转**右边桔红色那一列**从上往下数第 2 个**旋钮，转到 **CHORD**（那列文字里 “CHORD” 亮）。', panel: ['SD2', 'INDEX', 'METER'], detect: { kind: 'polymode', track: 'SYNTH2', mode: 2 }, wait: '往上拖第 2 个旋钮，直到 CHORD 亮…', liveWait: '慢慢转第 2 个旋钮，直到读数变成 CHORD…' },
        { text: '进入步进输入：**先按住 [PAGE] 不放，再按一下 SYNTH 2 旋钮**。', panel: ['PAGE', 'SYNTH2'], sim: { kind: 'mode', mode: 'stepinput', track: 'SYNTH2', on: true }, wait: '长按 [PAGE] 出现黑圈，再点 SYNTH 2 旋钮…' },
        { text: '按一下 **Synth key 1**，再按亮第 **1** 个步进键：放进去的是一整个和弦。', panel: ['SK1', 'DK1'], sim: { kind: 'stepkeys', track: 'SYNTH2', keys: keysIn(FADED, 'SYNTH2', 0, 16), exact: true }, wait: '点 Synth key 1，再按亮第 1 个步进键…' },
        { text: '把它拉满一小节：**按住第 1 个步进键不放，把 [ALL] 旋钮往上转**，转到拉不动为止（16 步）。', panel: ['DK1', 'ALL'], sim: { kind: 'notelen', track: 'SYNTH2', step: 0, min: 16 }, wait: '长按第 1 个步进键出现黑圈，再往上拖 ALL 旋钮…' },
        { text: '按 **[BAR LENGTH]** 到 **4 小节**（按两下）。拉长了的和弦也会一起照抄过去。', panel: ['BARLENGTH', 'METER'], detect: { kind: 'length', track: 'SYNTH2', bars: 4 }, wait: '点两下 [BAR LENGTH]…', liveWait: '按 [BAR LENGTH]，直到读数是 4 小节…' },
        { text: '单按 [PAGE] 翻到第 2 页，**按住第 1 个步进键不放，再按 Synth key 6**：整个换成键 6 的和弦（长短不变）。', panel: ['PAGE', 'DK1', 'SK6'], sim: { kind: 'stepkeys', track: 'SYNTH2', keys: keysIn(FADED, 'SYNTH2', 16, 32) }, wait: '短按 [PAGE] → 长按第 1 个步进键 → 点 Synth key 6…' },
        { text: '翻到第 3 页，同样换成**键 3**。', panel: ['PAGE', 'DK1', 'SK3'], sim: { kind: 'stepkeys', track: 'SYNTH2', keys: keysIn(FADED, 'SYNTH2', 32, 48) }, wait: '短按 [PAGE] → 长按第 1 个步进键 → 点 Synth key 3…' },
        { text: '翻到第 4 页，换成**键 7**。', panel: ['PAGE', 'DK1', 'SK7'], sim: { kind: 'stepkeys', track: 'SYNTH2', keys: keysIn(FADED, 'SYNTH2'), exact: true }, wait: '短按 [PAGE] → 长按第 1 个步进键 → 点 Synth key 7…' },
        { text: '翻回第 1 页，短按 [PLAY]：鼓、贝斯、和弦。', panel: ['PAGE', 'PLAY'], detect: { kind: 'start' }, wait: '短按 [PAGE]，再点 [PLAY]…', liveWait: '翻回第 1 页，然后按 [PLAY]…' },
        { text: '听够了按 [PLAY] 停下。', panel: ['PLAY'], detect: { kind: 'stop' }, wait: '再点 [PLAY]…', liveWait: '等你停止…' },
      ],
      done: '和弦铺上了：一小节一个，1 → 6 → 3 → 7。',
      coach: '《Faded》的和弦在 SYNTH 2，CHORD 弹法：每小节第 1 步一个和弦，长 16 步（铺满），四小节依次是 Synth key 1、6、3、7（D#m7、Bmaj7、F#maj7、C#7）。做法：选中 SYNTH 2，转 Sound Design 旋钮 2 到 CHORD；按住 [PAGE] + SYNTH 2 旋钮进步进输入；按 Synth key 1、按亮第 1 个步进键；按住那个步进键转 [ALL] 拉到 16 步；按 [BAR LENGTH] 到 4 小节（连长度一起照抄）；翻页，每页按住第 1 个步进键再按新的 Synth key（CHORD 下是整个换掉，手册 7.9：如果本来就是这个和弦会被清掉，再做一次即可）。真机上格子和音长读不出来，学生自己点“做好了”。',
    },

    // ───────── 6 ─────────
    {
      type: 'do',
      title: '旋律：前奏那段钢琴',
      blocks: [
        '旋律放在 **DX** 上，一拍一个音，每一页都落在第 **1、5、9、13** 个步进键上：',
        { list: ['第 1 页：键 3、3、3、5（F♯ F♯ F♯ A♯）', '第 2 页：**高一个八度**的键 1、1、1，再一个键 7（D♯ D♯ D♯ C♯）', '第 3 页：键 5、5、5、5（A♯）', '第 4 页：键 2、2、2、1（F F F D♯）'] },
        { callout: 'tip', text: '放进去的是“你最后按过的那个音”：先按 Synth key，再按步进键。同一个音连着放几下，按一次 Synth key 就够了。' },
        { callout: 'theory', text: '第 2 页那三个 D♯ 比第 4 页最后那个 D♯ **高一个八度**：旋律在那儿爬到最高点。所以放它们之前先把 DX 的八度升一格，放完再降回来。' },
      ],
      liveBlocks: [
        '旋律放在 **DX** 上，一拍一个音，每一页都落在第 **1、5、9、13** 个步进键上：',
        { list: ['第 1 页：键 3、3、3、5（F♯ F♯ F♯ A♯）', '第 2 页：**高一个八度**的键 1、1、1，再一个键 7（D♯ D♯ D♯ C♯）', '第 3 页：键 5、5、5、5（A♯）', '第 4 页：键 2、2、2、1（F F F D♯）'] },
        { device: ['bars:DX'] },
        { action: 'bars', track: 'DX', bars: 4, label: '让应用直接把 DX 这段设成 4 小节' },
        { callout: 'theory', text: '第 2 页那三个 D♯ 比第 4 页最后那个 D♯ **高一个八度**。放它们之前先把 DX 的八度升一格，放完再降回来。DX 的八度一开始要在 **0**：按住 [OCTAVE] 时，右边那列小灯自下而上是 −3 到 +2，第 4 个亮就是 0。' },
        { callout: 'tip', text: `${PAGE_LIGHTS} 填格子的几项应用看不见，做完自己点“做好了”。` },
      ],
      tasks: [
        { text: '进入 DX 的步进输入：**先按住 [PAGE] 不放，再按一下 DX 旋钮**（合成器区下排左边）。', panel: ['PAGE', 'DX'], detect: { kind: 'track', track: 'DX' }, sim: { kind: 'mode', mode: 'stepinput', track: 'DX', on: true }, wait: '长按 [PAGE] 出现黑圈，再点 DX 旋钮…', liveWait: '等你按 DX 旋钮…' },
        { text: '这次先加长：按 **[BAR LENGTH]** 到 **4 小节**（按两下）。四页的旋律各不一样，先把页准备好。', panel: ['BARLENGTH', 'METER'], detect: { kind: 'length', track: 'DX', bars: 4 }, wait: '点两下 [BAR LENGTH]…', liveWait: '按 [BAR LENGTH]，直到读数是 4 小节…' },
        { text: '第 1 页：按 **Synth key 3**，按亮第 **1、5、9** 个；再按 **Synth key 5**，按亮第 **13** 个。', panel: ['SK3', 'SK5', 'DK1', 'DK5', 'DK9', 'DK13'], sim: { kind: 'stepnotes', track: 'DX', notes: notesIn(FADED, 'DX', 0, 16) }, wait: '点 Synth key 3 → 按亮第 1、5、9 个 → 点 Synth key 5 → 按亮第 13 个…' },
        { text: '单按 [PAGE] 翻到第 2 页。', panel: ['PAGE'], sim: { kind: 'page', page: 1 }, wait: '短按一下 [PAGE]…' },
        { text: '八度升一格：**按住 [OCTAVE] 不放，把 [ALL] 旋钮往上转一格**，然后松开。', panel: ['OCTAVE', 'ALL', 'METER'], detect: { kind: 'octave', track: 'DX' }, wait: '长按 [OCTAVE] 出现黑圈，再把 ALL 旋钮往上拖一格…' },
        { text: '按 **Synth key 1**，按亮第 **1、5、9** 个：这三个是高八度的 D♯。', panel: ['SK1', 'DK1', 'DK5', 'DK9'], sim: { kind: 'stepnotes', track: 'DX', notes: notesIn(FADED, 'DX', 16, 28) }, wait: '点 Synth key 1，再按亮第 1、5、9 个…' },
        { text: '八度降回来（**按住 [OCTAVE]，把 [ALL] 往下转一格**），再按 **Synth key 7**，按亮第 **13** 个。', panel: ['OCTAVE', 'ALL', 'SK7', 'DK13'], sim: { kind: 'stepnotes', track: 'DX', notes: notesIn(FADED, 'DX', 16, 32) }, wait: '长按 [OCTAVE] → 往下拖 ALL 一格 → 点 Synth key 7 → 按亮第 13 个…' },
        { text: '翻到第 3 页：按 **Synth key 5**，按亮第 **1、5、9、13** 个。', panel: ['PAGE', 'SK5', 'DK1', 'DK5', 'DK9', 'DK13'], sim: { kind: 'stepnotes', track: 'DX', notes: notesIn(FADED, 'DX', 32, 48) }, wait: '短按 [PAGE] → 点 Synth key 5 → 按亮第 1、5、9、13 个…' },
        { text: '翻到第 4 页：按 **Synth key 2**，按亮第 **1、5、9** 个；再按 **Synth key 1**，按亮第 **13** 个。', panel: ['PAGE', 'SK2', 'SK1', 'DK1', 'DK5', 'DK9', 'DK13'], sim: { kind: 'stepnotes', track: 'DX', notes: notesIn(FADED, 'DX'), exact: true }, wait: '短按 [PAGE] → Synth key 2 → 第 1、5、9 个 → Synth key 1 → 第 13 个…' },
        { text: '翻回第 1 页，短按 [PLAY]：四层都在了。', panel: ['PAGE', 'PLAY'], detect: { kind: 'start' }, wait: '短按 [PAGE]，再点 [PLAY]…', liveWait: '翻回第 1 页，然后按 [PLAY]…' },
        { text: '听够了按 [PLAY] 停下。', panel: ['PLAY'], detect: { kind: 'stop' }, wait: '再点 [PLAY]…', liveWait: '等你停止…' },
      ],
      done: '旋律有了。四层都在机器里了。',
      coach: '《Faded》的旋律在 DX，一拍一个音（每页第 1、5、9、13 个步进键）：第 1 页 Synth key 3 3 3 5（F# F# F# A#），第 2 页高一个八度的 1 1 1 再一个 7（D# D# D# C#），第 3 页 5 5 5 5（A#），第 4 页 2 2 2 1（F F F D#）。DX 八度在 0；第 2 页的三个高 D# 要先“按住 [OCTAVE] 转 [ALL]”升一格（V2.00，手册 3.5.3），放完降回 0 再放 C#。步进输入里放进去的是最后按过的那个音（带着当时的八度）。这一次先按 [BAR LENGTH] 到 4 小节再填，因为四页都不一样。真机上格子读不出来，学生自己点“做好了”。',
    },

    // ───────── 7 ─────────
    {
      type: 'do',
      title: '加混响：氛围从这里来',
      bench: 'live',
      blocks: [
        '氛围感主要靠**混响**。机器上全部轨道共用一个混响、一个延迟，每条轨道自己决定往里**送多少**。最方便的调法是**混音台模式**：进去以后，右边那一列旋钮的第 3 个是“送混响”、第 4 个是“送延迟”，再转哪条轨道的旋钮，就是调哪条轨道送多少。',
        '照分轨页上写的送：钢琴（DX）和铺底（SYNTH 2）**多送**混响、延迟送一点；军鼓送一点混响；**底鼓和贝斯不送**——低音泡在混响里会糊成一片。',
        { callout: 'warn', text: '模拟机没有做混音台和效果器：没接机器的话，这一步先读一遍、点“做好了”，等接上真机再回来做。' },
        { callout: 'tip', text: '效果器第 7 章细讲，今天只用这两个旋钮。' },
      ],
      liveBlocks: [
        '氛围感主要靠**混响**。机器上全部轨道共用一个混响、一个延迟，每条轨道自己决定往里**送多少**。最方便的调法是**混音台模式**：进去以后，右边那一列旋钮的第 3 个是“送混响”、第 4 个是“送延迟”，再转哪条轨道的旋钮，就是调哪条轨道送多少。',
        '照分轨页上写的送：钢琴（DX）和铺底（SYNTH 2）**多送**混响、延迟送一点；军鼓送一点混响；**底鼓和贝斯不送**——低音泡在混响里会糊成一片。',
        { callout: 'tip', text: '混音台里转轨道旋钮**不会**换乐句，放心转；转的时候旋钮旁边的灯和右边那列小灯会显示送了多少。这一步应用看不见，做完自己点“做好了”。' },
      ],
      tasks: [
        { text: '进入混音台：**先按住 [ALL] 旋钮不放，再按一下左侧面的 [VOL +]**（最上面那个）。那列文字里 “MIXER” 会亮。', panel: ['ALL', 'VOL+', 'INDEX'] },
        { text: '按一下右边那一列**从上往下数第 3 个**旋钮（“REVERB” 亮），然后把 **DX、SYNTH 2 旋钮往上多转一些，SNARE 旋钮转一点**。', panel: ['SD3', 'DX', 'SYNTH2', 'SNARE'] },
        { text: '按一下**第 4 个**旋钮（“DELAY” 亮），**DX 转一些、SYNTH 2 转一点**。', panel: ['SD4', 'DX', 'SYNTH2'] },
        { text: '短按 [PLAY] 听：钢琴和铺底是不是一下子“散开”了？', panel: ['PLAY'], detect: { kind: 'start' }, wait: '点 [PLAY]…', liveWait: '等你按 [PLAY]…' },
        { text: '停下，再**按住 [ALL] + 按 [VOL +]** 退出混音台。', panel: ['PLAY', 'ALL', 'VOL+'] },
      ],
      done: '混响加上了。氛围感就是从这里来的。',
      coach: '学生在用混音台模式给《Faded》加发送混响和延迟（手册 3.15.1）：按住 [ALL] 旋钮 + [VOL+] 进入（Index 上 MIXER 亮）；按 Sound Design 旋钮 3 选 REVERB SEND、旋钮 4 选 DELAY SEND；转各轨道旋钮调该轨送多少（按下并转 = 大幅度）；同样的组合键退出。照分轨：DX、SYNTH 2 混响多、延迟一点（DX 延迟一些），SNARE 混响一点，KICK、SYNTH 1 不送。转 [ALL] 旋钮调的是总的返回量。模拟机没有混音台；真机上这些应用读不出来，学生自己点“做好了”。',
    },

    // ───────── 8 ─────────
    {
      type: 'do',
      title: '一层层听，“演”一遍',
      blocks: [
        '四层都在机器里了。用第 1 章学的**独奏**和**静音**把它拆开听，再一层层推回来——现场演出最常用的就是这一手。',
        { callout: 'dj', text: '和打碟时把低频拧掉、再“啪”地推回来是一回事，只不过这里每一层是分开的，可以整层拿走。' },
      ],
      tasks: [
        { text: '短按 [PLAY]。', panel: ['PLAY'], detect: { kind: 'start' }, wait: '点 [PLAY]…', liveWait: '等你按 [PLAY]…' },
        { text: '**先按住**左侧面的 [SOLO] **不放，再按一下 DX 旋钮**：只剩钢琴旋律。', panel: ['SOLO', 'DX'], sim: { kind: 'solo', track: 'DX' }, wait: '长按 [SOLO] 出现黑圈，再点 DX 旋钮…', liveWait: '按住 [SOLO]，再按 DX 旋钮…' },
        { text: '同样的动作再做一次，取消独奏：大家都回来。', panel: ['SOLO', 'DX'], sim: { kind: 'solo' }, wait: '再来一次…', liveWait: '再做一次，取消独奏…' },
        { text: '**先按住** [MUTE] **不放，再按一下 SYNTH 1 旋钮**：贝斯没了，整首歌一下子“飘”起来。', panel: ['MUTE', 'SYNTH1'], sim: { kind: 'mute', track: 'SYNTH1', on: true }, wait: '长按 [MUTE] 出现黑圈，再点 SYNTH 1 旋钮…', liveWait: '按住 [MUTE]，再按 SYNTH 1 旋钮…' },
        { text: '再做一次，让贝斯“啪”地回来，然后按 [PLAY] 停下。', panel: ['MUTE', 'SYNTH1', 'PLAY'], sim: { kind: 'mute', track: 'SYNTH1', on: false }, wait: '再长按 [MUTE] 点 SYNTH 1 旋钮…', liveWait: '再按住 [MUTE] 按 SYNTH 1 旋钮…' },
      ],
      done: '《Faded》在你的机器上了。',
      coach: '收尾：学生用独奏（按住 [SOLO] + 轨道旋钮）和静音（按住 [MUTE] + 轨道旋钮）把《Faded》的四层拆开听、再推回来。独奏同一时间只有一条，再做一次取消；静音的轨道灯变绿、独奏的变青蓝。点评时多鼓励，可以建议他试着“演”一遍：先只有鼓和贝斯，再推和弦，最后放旋律。',
    },
  ],
};

// 《Faded》是手写的；其余有分轨的歌，课从分轨数据生成（song-lesson-gen.js）
export const SONG_LESSONS = [
  faded,
  ...SONGS.filter((s) => s.id !== 'faded' && SONG_PARTS[s.id]).map((s) => songLesson(s, SONG_PARTS[s.id])),
];

/** 这首歌有没有“照着搭”的课 */
export const songLessonFor = (songId) => SONG_LESSONS.find((l) => l.song === songId) || null;
