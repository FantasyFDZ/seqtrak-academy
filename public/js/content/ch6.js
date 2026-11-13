// 第 6 章 · 编曲。写法和前几章一样（见 curriculum.js 顶部、ch0.js 顶部关于 live* 的说明）。
//
// 机器操作的依据（docs/seqtrak-operation-reference.md）：3.7.1 转轨道旋钮 = 立即换段、转 [ALL] = 11 条一起；3.7.2 按住轨道旋钮按方键 1–6 = 预约换段、
// 双击 = 立即；3.7.3 段数 3 ⇔ 6；3.7.5 预约的对齐点（默认每 16 步）；3.7.7 复制（按住旋钮长按方键 2 秒）/ 粘贴（按住旋钮和 [PAGE] 再按方键）
// 和兼容表；3.14 Song / Scene 模式（[ALL] + [PROJECT↑] 普通 → Song → Scene → 普通；方键 = scene，白 = 有、紫 = 选中、Scene 模式里青蓝；
// 按不亮的方键 = 加一个（复制当前这个）；[DELETE] + 方键删；进 Song 模式会停下来；最多 16 个；scene 里也可以设静音）；3.8.1 静音。
// 手册没写的：转旋钮往哪边是“下一段”（课文说“看旋钮旁边那 3 个小灯换位置”）；真机上没有 scene 时方键全不亮，第一个 scene 要自己按出来。
// 镜像读得出每条轨道在第几段、静音了没有、鼓轨每一步（2026-11-10 实测）；预约换段、复制粘贴、Song / Scene 模式机器怎么报还不知道：那几项真机上要自己点“我已经做了”。
// 模拟机每条轨道只有 3 段（真机出厂也是 3 段，可以扩到 6 段）。
// 例子只用用户听过的歌（songs.js 开头那 11 首）：Faded、Animals、Wake Me Up、Levels。
import { CH3_LOOP } from './ch4.js';

// 第 6.3、6.4 课在模拟机上预先摆好的：第 1 段是第 3 章那段循环（主歌）；第 2 段是 6.1、6.2 课做的底鼓变化和军鼓过门；第 3 段是 6.2 课复制出来、加了开镲的“副歌”
export const CH6_SEED = {
  ...CH3_LOOP,
  patterns: {
    1: { drums: { KICK: [0, 4, 8, 10, 12], SNARE: [4, 12, 13, 14, 15] } },
    2: { drums: { ...CH3_LOOP.drums, HAT2: [2, 6, 10, 14] }, bars: CH3_LOOP.bars, keys: CH3_LOOP.keys },
  },
};

const PLAY = (text = '短按 [PLAY]（左侧面最下面），让循环放着。') => ({ text, panel: ['PLAY'], detect: { kind: 'start' }, wait: '点 [PLAY]…', liveWait: '等你按 [PLAY]…' });
const STOP = (text = '听够了按 [PLAY] 停下。') => ({ text, panel: ['PLAY'], detect: { kind: 'stop' }, wait: '再点 [PLAY]…', liveWait: '等你停止…' });
const SELECT = (track, where) => ({ text: `按一下 **${track} 旋钮**（${where}），只按不转。`, panel: [track.replace(' ', '')], detect: { kind: 'track', track: track.replace(' ', '') }, wait: `点一下 ${track} 旋钮…`, liveWait: `等你按 ${track} 旋钮…` });
const PROJECT4 = { text: '确认在 **4 号工程**：不在就**先按住** [PROJECT↑]（右侧面最下面）**不放，再按**上排**第 4 个**方键。已经在的话会自己打勾。', panel: ['PROJECT', 'DK4'], detect: { kind: 'project', in: [3] }, wait: '长按 [PROJECT↑] 出现黑圈，再点上排第 4 个方键…', liveWait: '等机器在 4 号工程…' };
const SONG_IN = (extra = '') => ({ text: `进 **Song 模式**：**先按住** [ALL] 旋钮（鼓区左上角）**不放，再按** [PROJECT↑]（右侧面最下面）。Index 最下面的 **SONG** 亮了就对了${extra}。`, panel: ['ALL', 'PROJECT', 'INDEX'], sim: { kind: 'songmode', mode: 1 }, wait: '长按 ALL 旋钮出现黑圈，再点 [PROJECT↑]…', liveWait: '按住 [ALL] 再按 [PROJECT↑]（看 SONG 亮；做完点“我已经做了”）…' });
const scene = (n, what) => ({ text: `按第 **${n}** 个方键（不亮的那个）：**加一个 scene ${n}**，它先照抄刚才那个——${what}`, panel: [`DK${n}`], sim: { kind: 'scene', added: true }, wait: `点第 ${n} 个方键…`, liveWait: `按第 ${n} 个方键（它变紫 = 加好了；做完点“我已经做了”）…` });
const LIVE_SONG = { callout: 'warn', title: '这几样机器不一定告诉应用', text: 'Song / Scene 模式、加 scene，机器报不报给应用还不知道：没打勾就点“我已经做了”。每条轨道在第几段、静音了没有，应用读得出来。' };

export const ch6 = {
  id: 'ch6',
  no: 6,
  title: '编曲',
  subtitle: '从 4 小节的循环到一首完整的歌',
  lessons: [
    // ───────────────────────── 6.1 ─────────────────────────
    {
      id: '6-1',
      simProject: 3,
      simSeed: CH3_LOOP,
      no: '6.1',
      title: '一条轨道，好几段乐句',
      minutes: 30,
      summary: '乐句（pattern）是什么；转一下轨道旋钮就换一段；给底鼓做第 2 段；现场用“预约”换段，不会切在半拍上。',
      takeaway: '每条轨道有好几段**乐句**（pattern）：出厂 3 段，最多 6 段，互不影响。**转一下轨道旋钮** = 这条轨道马上换一段；旋钮旁边 3 个小灯里亮**黄色**的那个告诉你在第几段（亮青蓝 = 第 4–6 段）。现场换段用**预约**：**按住**轨道旋钮不放，**按**方键 1–3，等这一小节放完才换，不会切在半拍上；**双击**方键 = 马上换。转 **[ALL]** = 11 条轨道一起换。',
      steps: [
        {
          type: 'read',
          title: '一首歌是几段拼起来的',
          blocks: [
            '到现在你做的都是一个循环：几小节，从头放到尾。可你听过的歌不是这样——**Faded** 开头只有钢琴和人声，鼓是后来一点点进来的；**Wake Me Up** 主歌是吉他，到了副歌电子乐才“哗”地全进来。同一首歌里，每一段**用的东西不一样**。',
            'SEQTRAK 的办法：**每条轨道都能存好几段乐句**（手册叫 pattern），出厂每条 3 段，最多 6 段。比如底鼓第 1 段是主歌的打法，第 2 段是副歌的打法；军鼓第 2 段多了一个过门。演的时候，哪条轨道放哪一段，你说了算。',
            { panel: ['KICK', 'SNARE', 'SYNTH1', 'ALL'], lit: { 'KICK.1': 'yellow', 'SNARE.2': 'yellow', 'SYNTH1.1': 'yellow' }, caption: '每个轨道旋钮右边有 3 个竖排的小灯：亮**黄色**的位置 = 这条轨道在第几段（上中下 = 第 1、2、3 段；亮**青蓝**是第 4–6 段）。图里底鼓在第 1 段、军鼓在第 2 段。' },
            { callout: 'dj', text: '打碟时你在两首歌之间切；SEQTRAK 上是在**同一首歌的几段**之间切。换段的时机和打碟一样讲究：要在一小节（或几小节）的开头换，不能切在半拍上——这一课第二部分就教这个。' },
          ],
        },
        {
          type: 'do',
          title: '给底鼓做第 2 段',
          blocks: [
            '底鼓的第 1 段是你在第 3 章做的循环里的四下。现在转到它的第 2 段（空的），做一个不一样的打法，然后两段来回换着听。',
            { callout: 'tip', text: '模拟机上转旋钮：在旋钮上**往上拖**一点（或者滚一格鼠标滚轮）就是转一格。' },
          ],
          liveBlocks: [
            '底鼓的第 1 段是你在 4 号工程里已经有的那几下。现在转到它的第 2 段（空的），做一个不一样的打法，然后两段来回换着听。',
            { callout: 'tip', text: '手册没写往哪边转是“下一段”：转一格，看 KICK 旋钮旁边亮黄色的小灯从最上面挪到中间就对了；挪错了就往回转。' },
          ],
          tasks: [
            PROJECT4,
            SELECT('KICK', '鼓区上排第 2 个'),
            { text: '**转**一格 KICK 旋钮（转一下就停）：旁边亮黄色的小灯从最上面挪到**中间** = 底鼓到了**第 2 段**。第 2 段是空的。', panel: ['KICK'], detect: { kind: 'patternat', track: 'KICK', pattern: 1 }, wait: '在 KICK 旋钮上往上拖一格…', liveWait: '转一格 KICK 旋钮，看小灯挪到中间…' },
            { text: '在第 2 段里放底鼓：按亮第 **1、5、9、11、13** 个方键（比第 1 段多了第 11 个那一下）。', panel: ['DK1', 'DK5', 'DK9', 'DK11', 'DK13'], detect: { kind: 'hassteps', track: 'KICK', steps: [0, 4, 8, 10, 12] }, wait: '按亮第 1、5、9、11、13 个方键…', liveWait: '按亮第 1、5、9、11、13 个方键…' },
            PLAY(),
            { text: '放着的时候，把 KICK 旋钮**往回转**一格（小灯回到最上面）：底鼓换回第 1 段。', panel: ['KICK'], detect: { kind: 'patternat', track: 'KICK', pattern: 0 }, wait: '在 KICK 旋钮上往下拖一格…', liveWait: '往回转一格 KICK 旋钮…' },
            { text: '再转回第 2 段。来回换几次，听两段的区别。', panel: ['KICK'], detect: { kind: 'patternat', track: 'KICK', pattern: 1 }, wait: '在 KICK 旋钮上往上拖一格…', liveWait: '再转一格回到第 2 段…' },
            STOP(),
          ],
          done: '一条轨道，两段打法。',
          coach: '学生在做底鼓的第 2 段乐句：选中 KICK（鼓区上排第 2 个旋钮），转一格 KICK 旋钮换到 pattern 2（旋钮右边 3 个 LED，黄色在上 / 中 / 下 = pattern 1 / 2 / 3，这个对应是从插图推断的；转的方向手册没写），按亮 Drum key 1、5、9、11、13，按 [PLAY]，放着的时候来回转 KICK 旋钮在 pattern 1 和 2 之间换（转旋钮是立即切换）。应用读得出每条轨道在第几段、鼓轨的每一步。',
        },
        {
          type: 'do',
          title: '预约换段：等这一小节放完',
          blocks: [
            '直接转旋钮是**马上**换——手快一点慢一点，就可能切在半拍上。现场用**预约**：**按住** KICK 旋钮不放，**按**一个方键（1–3 = 第 1–3 段），机器等到这一小节放完、下一小节开头才换过去。',
            { panel: ['KICK', 'DK1', 'DK2', 'DK3'], lit: { DK1: 'white', DK2: 'yellow', DK3: 'white' }, caption: '按住轨道旋钮时，方键 1–6 变成“段”：**黄色** = 现在这一段，**白色** = 可以换去的，**蓝色** = 还没打开的第 4–6 段。' },
            { callout: 'tip', text: '模拟机上：**长按** KICK 旋钮出现黑圈，再点方键。想双击：出现黑圈之后，很快地连点两下同一个方键。' },
          ],
          liveBlocks: [
            '直接转旋钮是**马上**换——手快一点慢一点，就可能切在半拍上。现场用**预约**：**按住** KICK 旋钮不放，**按**一个方键（1–3 = 第 1–3 段），机器等到这一小节放完、下一小节开头才换过去。',
            { panel: ['KICK', 'DK1', 'DK2', 'DK3'], lit: { DK1: 'white', DK2: 'yellow', DK3: 'white' }, caption: '按住轨道旋钮时，方键 1–6 变成“段”：**黄色** = 现在这一段，**白色** = 可以换去的，**蓝色** = 还没打开的第 4–6 段。' },
            { callout: 'warn', text: '“预约好了”这一下机器不一定告诉应用；**换过去了**应用看得出来（读得到 KICK 在第几段）。' },
          ],
          tasks: [
            PLAY(),
            { text: '**先按住** KICK 旋钮**不放**，再按一下**第 1 个**方键（上排最左），然后都松开：预约换回第 1 段。', panel: ['KICK', 'DK1'], sim: { kind: 'patternreserve', track: 'KICK', pattern: 0 }, live: { kind: 'patternat', track: 'KICK', pattern: 0 }, wait: '长按 KICK 旋钮出现黑圈，再点第 1 个方键…', liveWait: '按住 KICK 旋钮，按第 1 个方键…' },
            { text: '听：底鼓**等到下一小节的开头**才换回第 1 段。', panel: ['KICK'], detect: { kind: 'patternat', track: 'KICK', pattern: 0 }, wait: '等下一小节开头…', liveWait: '等它换过去…' },
            { text: '**马上换**：按住 KICK 旋钮，**很快地按两下**第 2 个方键（双击）——不等小节，立刻到第 2 段。', panel: ['KICK', 'DK2'], detect: { kind: 'patternat', track: 'KICK', pattern: 1 }, wait: '长按 KICK 旋钮出现黑圈，再很快地连点两下第 2 个方键…', liveWait: '按住 KICK 旋钮，双击第 2 个方键…' },
            STOP(),
          ],
          done: '预约 = 在拍子上换；双击 = 马上换。',
          coach: '学生在学预约换段（手册 3.7.2）：按着 [PLAY]，按住 KICK 旋钮的同时按 Drum key 1 = 预约换到 pattern 1，等 Launch Quantize 的对齐点（默认每 16 步）才换；按住旋钮双击 Drum key = 立即换。按住旋钮时 Drum keys 1–6 的颜色：当前 = 黄、可用 = 白、4–6 没打开 = 蓝。预约这一下机器报不报不知道，换过去之后应用读得到 KICK 在第几段。',
        },
        {
          type: 'quiz',
          title: '三个小问题',
          questions: [
            {
              q: '转一下 SNARE 旋钮，会发生什么？',
              options: ['军鼓马上换到另一段乐句，别的轨道不动', '11 条轨道一起换段', '军鼓换了一个音色'],
              answer: 0,
              explain: '转轨道旋钮 = 只换这一条，而且是马上换。11 条一起换是转 [ALL]；换音色是右边的 SOUND 旋钮。',
            },
            {
              q: '现场想让底鼓在下一小节的开头换到第 3 段，怎么按？',
              options: ['按住 KICK 旋钮，按第 3 个方键', '转 KICK 旋钮两格', '按住 [PAGE]，按第 3 个方键'],
              answer: 0,
              explain: '按住旋钮按方键 = 预约，机器替你等到小节开头。转旋钮是马上换，可能切在半拍上。',
            },
            {
              q: 'KICK 旋钮旁边那 3 个小灯里，中间那个亮**青蓝色**，说明——',
              options: ['底鼓在第 2 段', '底鼓在第 5 段', '底鼓被静音了'],
              answer: 1,
              explain: '黄色是第 1–3 段，青蓝色是第 4–6 段：中间那个青蓝 = 第 5 段。（静音是绿色。）',
            },
          ],
        },
      ],
    },

    // ───────────────────────── 6.2 ─────────────────────────
    {
      id: '6-2',
      simProject: 3,
      simSeed: CH3_LOOP,
      no: '6.2',
      title: '复制一段，再改一点',
      minutes: 35,
      summary: '把一段乐句复制到另一段，再在上面改：军鼓加一个过门；11 条轨道一起复制出一个“副歌”，再加一层开镲。',
      takeaway: '**复制**：按住轨道旋钮（或 [ALL]）不放，**长按**一个方键 **2 秒**——小灯白色闪一下 = 复制好了。**粘贴**：按住同一个旋钮，**再按住 [PAGE]**，按目标方键——它闪一下 = 贴好了。按住 [ALL] 做 = 11 条轨道一起。复制之后在新的那一段上改一点（加个过门、加一层镲），歌就有了变化，又不会“换了一首”。鼓轨的乐句贴不到合成器轨上。',
      steps: [
        {
          type: 'read',
          title: '为什么要复制',
          blocks: [
            '一首歌里，副歌的鼓往往和主歌**差不多**，只是多了点东西：多一层镲，或者在最后一下“咚咚咚”来个过门，告诉听的人“下一段要来了”。从头再按一遍太慢——**把主歌那一段复制一份，再在上面改一点**。',
            { list: [
              '**复制**：按住轨道旋钮不放，**长按**要复制的那一段的方键 **2 秒**（比如第 1 段就是第 1 个方键）。小灯白色闪一下 = 复制好了。',
              '**粘贴**：按住同一个旋钮，**再按住** [PAGE]（左侧面从上往下第 6 个），按目标方键（比如第 2 个）。那个方键闪一下 = 贴好了。原来那一段会被换掉。',
              '把轨道旋钮换成 **[ALL] 旋钮**：11 条轨道一起复制、一起粘贴。',
            ] },
            { callout: 'warn', text: '要三根手指：一只手按住旋钮，另一只手按住 [PAGE] 再按方键。先按住的先不要松。鼓轨的乐句只能贴到鼓轨，合成器轨贴到合成器轨（采样器只能贴到采样器）。' },
          ],
        },
        {
          type: 'do',
          title: '军鼓：复制一段，加个过门',
          blocks: [
            '把军鼓的第 1 段复制到第 2 段，在第 2 段的最后加三下——这就是“过门”。',
            { callout: 'tip', text: '模拟机上：复制 = **长按** SNARE 旋钮出现黑圈，再在第 1 个方键上**按住 2 秒**；粘贴 = 长按 SNARE 旋钮出现黑圈，点一下 [PAGE]（出现第二个黑圈），再点第 2 个方键。' },
          ],
          liveBlocks: [
            '把军鼓的第 1 段复制到第 2 段，在第 2 段的最后加三下——这就是“过门”。',
            { callout: 'warn', text: '复制、粘贴这两下机器不一定告诉应用：没打勾就点“我已经做了”。贴过去之后，应用读得到第 2 段里有哪几步。' },
          ],
          tasks: [
            SELECT('SNARE', '鼓区上排第 3 个'),
            { text: '确认军鼓在**第 1 段**（SNARE 旋钮旁边亮黄色的是最上面那个；不是就转回来）。', panel: ['SNARE'], detect: { kind: 'patternat', track: 'SNARE', pattern: 0 }, wait: '把 SNARE 旋钮转回第 1 段…', liveWait: '等军鼓在第 1 段…' },
            { text: '**复制**：**先按住** SNARE 旋钮**不放**，再**长按**第 1 个方键 **2 秒**。小灯白色闪一下 = 复制好了。', panel: ['SNARE', 'DK1'], sim: { kind: 'patterncopy', track: 'SNARE' }, wait: '长按 SNARE 旋钮出现黑圈，再在第 1 个方键上按住 2 秒…', liveWait: '按住 SNARE 旋钮，长按第 1 个方键 2 秒（做完点“我已经做了”）…' },
            { text: '**粘贴**：**先按住** SNARE 旋钮，**再按住** [PAGE]（左侧面第 6 个），两个都不放，按一下**第 2 个**方键。它闪一下 = 贴好了。', panel: ['SNARE', 'PAGE', 'DK2'], sim: { kind: 'patternpaste', track: 'SNARE', pattern: 1 }, wait: '长按 SNARE 旋钮，点 [PAGE]，再点第 2 个方键…', liveWait: '按住 SNARE 和 [PAGE]，按第 2 个方键（做完点“我已经做了”）…' },
            { text: '转一格 SNARE 旋钮，到**第 2 段**（小灯在中间）：和第 1 段一模一样。', panel: ['SNARE'], detect: { kind: 'patternat', track: 'SNARE', pattern: 1 }, wait: '在 SNARE 旋钮上往上拖一格…', liveWait: '转一格 SNARE 旋钮到第 2 段…' },
            { text: '加过门：按亮最后三个方键，第 **14、15、16** 个（下排最右边三个）。', panel: ['DK14', 'DK15', 'DK16'], detect: { kind: 'hassteps', track: 'SNARE', steps: [13, 14, 15] }, wait: '按亮第 14、15、16 个方键…', liveWait: '按亮第 14、15、16 个方键…' },
            PLAY('短按 [PLAY] 听：每小节最后“哒哒哒”三下。再把 SNARE 转回第 1 段比一比，听完转回第 2 段。'),
            STOP(),
          ],
          done: '复制 + 改一点 = 一个变化。',
          coach: '学生在复制粘贴军鼓的乐句（手册 3.7.7，V1.10 起）：选中 SNARE；确认在 pattern 1；按住 SNARE 旋钮的同时长按 Drum key 1 两秒 = 复制（Global Meter 白色闪）；同时按住 SNARE 旋钮和 [PAGE]（左侧面第 6 个）再按 Drum key 2 = 粘贴（目标键闪 1 秒）；转一格 SNARE 到 pattern 2，按亮 Drum key 14、15、16 做过门。复制粘贴机器报不报不知道，应用读得出军鼓在第几段、每一步。',
        },
        {
          type: 'do',
          title: '11 条轨道一起：复制出一个“副歌”',
          blocks: [
            '把**整首**的第 1 段复制到第 3 段，再在第 3 段上加一层开镲——副歌比主歌满一点。',
            { callout: 'tip', text: '模拟机上：长按 ALL 旋钮出现黑圈，再在第 1 个方键上按住 2 秒 = 复制；长按 ALL、点 [PAGE]、点第 3 个方键 = 粘贴。' },
          ],
          liveBlocks: [
            '把**整首**的第 1 段复制到第 3 段，再在第 3 段上加一层开镲——副歌比主歌满一点。复制哪一段看你长按的是第几个方键（第 1 个 = 第 1 段），和轨道现在停在哪一段无关；先让大家都回到第 1 段，是为了一会儿转 [ALL] 时好数格子。',
            { callout: 'warn', text: '复制、粘贴这两下机器不一定告诉应用：没打勾就点“我已经做了”。11 条轨道在第几段，应用读得出来。' },
          ],
          tasks: [
            { text: '先让 11 条轨道都在**第 1 段**：把 SNARE 旋钮转回第 1 段（别的本来就在第 1 段），一会儿转 [ALL] 好数格子。', panel: ['SNARE', 'ALL'], detect: { kind: 'patterns', pattern: 0 }, wait: '把 SNARE 旋钮往下拖一格…', liveWait: '等 11 条轨道都在第 1 段…' },
            { text: '**复制全部**：**先按住** [ALL] 旋钮（鼓区左上角）**不放**，再**长按**第 1 个方键 **2 秒**。小灯白色闪一下。', panel: ['ALL', 'DK1'], sim: { kind: 'patterncopy', track: 'ALL' }, wait: '长按 ALL 旋钮出现黑圈，再在第 1 个方键上按住 2 秒…', liveWait: '按住 [ALL]，长按第 1 个方键 2 秒（做完点“我已经做了”）…' },
            { text: '**贴到第 3 段**：按住 [ALL]，再按住 [PAGE]，按**第 3 个**方键。', panel: ['ALL', 'PAGE', 'DK3'], sim: { kind: 'patternpaste', track: 'ALL', pattern: 2 }, wait: '长按 ALL 旋钮，点 [PAGE]，再点第 3 个方键…', liveWait: '按住 [ALL] 和 [PAGE]，按第 3 个方键（做完点“我已经做了”）…' },
            { text: '**转 [ALL] 旋钮**两格：11 条轨道一起到**第 3 段**（各个旋钮旁边的小灯都在最下面）。', panel: ['ALL'], detect: { kind: 'patterns', pattern: 2 }, wait: '在 ALL 旋钮上往上拖两格…', liveWait: '转 [ALL]，让大家都到第 3 段…' },
            SELECT('HAT 2', '鼓区下排第 2 个'),
            { text: '加一层开镲：按亮第 **3、7、11、15** 个方键（每拍的“后半拍”）。', panel: ['DK3', 'DK7', 'DK11', 'DK15'], detect: { kind: 'hassteps', track: 'HAT2', steps: [2, 6, 10, 14] }, wait: '按亮第 3、7、11、15 个方键…', liveWait: '按亮第 3、7、11、15 个方键…' },
            PLAY('短按 [PLAY]：这是“副歌”。转 [ALL] 回第 1 段听“主歌”，再转回来——满和不满，差在哪里？'),
            STOP(),
          ],
          done: '主歌在第 1 段，副歌在第 3 段，过门在军鼓的第 2 段。下一课把它们排起来。',
          coach: '学生在用 [ALL] 一起复制粘贴（手册 3.7.7）：先让 11 条轨道都在 pattern 1；按住 [ALL] 长按 Drum key 1 两秒 = 复制全部；按住 [ALL] 和 [PAGE] 按 Drum key 3 = 粘贴到 pattern 3；转 [ALL] 让 11 条一起到 pattern 3；选 HAT 2（鼓区下排第 2 个）按亮 Drum key 3、7、11、15 加开镲。复制粘贴机器报不报不知道。',
        },
        {
          type: 'quiz',
          title: '三个小问题',
          questions: [
            {
              q: '复制一段乐句：按住轨道旋钮，再把方键按住多久？',
              options: ['一下就松', '2 秒以上', '10 秒'],
              answer: 1,
              explain: '长按 2 秒，小灯白色闪一下 = 复制好了。一下就松是“预约换段”。',
            },
            {
              q: '粘贴的时候，按目标方键之前要按住哪两样？',
              options: ['轨道旋钮和 [PAGE]', '轨道旋钮和 [DELETE]', '[ALL] 和 [PROJECT↑]'],
              answer: 0,
              explain: '旋钮 + [PAGE] + 方键。[ALL] + [PROJECT↑] 是进 Song 模式（下一课）。',
            },
            {
              q: '把 KICK 的第 1 段复制了，能贴到 SYNTH 1 上吗？',
              options: ['能', '不能：鼓轨的乐句只能贴到鼓轨', '能，但只贴第一步'],
              answer: 1,
              explain: '手册的兼容表：普通鼓轨 → 合成器轨、采样器都不行。',
            },
          ],
        },
      ],
    },

    // ───────────────────────── 6.3 ─────────────────────────
    {
      id: '6-3',
      simProject: 3,
      simSeed: CH6_SEED,
      no: '6.3',
      title: 'Song 模式：把几段排成一首歌',
      minutes: 40,
      summary: 'scene 是什么；进 Song 模式，排三个 scene（前奏、主歌、副歌），从头放一遍；Scene 模式里现场自己决定什么时候换。',
      takeaway: '**scene**（场景）= 11 条轨道各选一段乐句、再加上谁静音的一种组合。**Song 模式**按顺序把 scene 一个个放下去（最多 16 个）；**Scene 模式**只循环一个，你按方键决定下一个是谁。进出都是**按住 [ALL] 再按 [PROJECT↑]**：普通 → Song → Scene → 普通。Song 模式里方键就是 scene：白色 = 有，**紫色** = 选中的；按一个不亮的方键 = 加一个（照抄选中的那个），然后转旋钮、静音来改它。',
      steps: [
        {
          type: 'read',
          title: 'scene：一首歌里的“一段”',
          blocks: [
            '上一课你做好了几样零件：主歌（11 条轨道的第 1 段）、副歌（第 3 段）、军鼓的过门（军鼓第 2 段）。现在把它们**排起来**。',
            'SEQTRAK 管“一首歌里的一段”叫 **scene**（场景）：**11 条轨道各放哪一段乐句、谁静音**，就是一个 scene。比如：',
            { list: [
              '**scene 1 前奏**：大家都在第 1 段，但底鼓、军鼓静音——只剩镲、贝斯、和弦。',
              '**scene 2 主歌**：照抄 scene 1，把底鼓、军鼓放出来。',
              '**scene 3 副歌**：照抄 scene 2，11 条轨道换到第 3 段（多一层开镲）。',
            ] },
            { panel: ['DRUMKEYS', 'ALL', 'PROJECT', 'INDEX'], lit: { DK1: 'purple', DK2: 'white', DK3: 'white', 'INDEX.SONG': 'white' }, caption: 'Song 模式里，16 个方键就是 16 个 scene 的位置：**白色** = 有，**紫色** = 选中的，不亮 = 空位。Index 最下面的 SONG 亮着。' },
            { callout: 'warn', title: '进出 Song 模式', text: '**按住 [ALL] 再按 [PROJECT↑]**，每按一次换一个状态：普通 → **Song 模式** → **Scene 模式** → 普通。要回到普通状态得按两次（先进 Scene 再出来）。**进 Song 模式时如果正在放，会停下来。**' },
          ],
        },
        {
          type: 'do',
          title: '排三个 scene',
          blocks: [
            '前奏 → 主歌 → 副歌，排好之后从头放一遍。',
            { callout: 'tip', text: '模拟机上组合键都是：先**长按**第一个键出现黑圈，再点第二个。进 Song 模式时模拟机会把现在的样子当成 scene 1（真机上没有 scene 时方键全不亮，第一个要自己按出来）。' },
          ],
          liveBlocks: [
            '前奏 → 主歌 → 副歌，排好之后从头放一遍。第 2、3 段是空的也没关系：空的那一段 = 这条轨道在这个 scene 里不响。',
            LIVE_SONG,
          ],
          tasks: [
            PROJECT4,
            SONG_IN(),
            { text: '看第 1 个方键：亮**紫色** = scene 1 已经有了、是选中的。**不亮**就按一下它，加上第一个 scene。', panel: ['DK1'], sim: { kind: 'scenes', min: 1 }, wait: '第 1 个方键亮紫色就对了…', liveWait: '第 1 个方键亮紫色了吗？（不亮就按一下；做完点“我已经做了”）' },
            { text: '让大家都在**第 1 段**：各个旋钮旁边亮黄色的小灯都在最上面；不是的话转 [ALL] 让大家回来。', panel: ['ALL'], detect: { kind: 'patterns', pattern: 0 }, wait: '在 ALL 旋钮上往下拖…', liveWait: '等 11 条轨道都在第 1 段…' },
            { text: '把 scene 1 做成**前奏**：**先按住** [MUTE]（左侧面第 4 个）**不放，再按** KICK 旋钮——底鼓静音（灯变绿）。', panel: ['MUTE', 'KICK'], detect: { kind: 'muted', track: 'KICK', on: true }, wait: '长按 [MUTE] 出现黑圈，再点 KICK 旋钮…', liveWait: '按住 [MUTE]，按 KICK 旋钮…' },
            { text: '同样，按住 [MUTE] 再按 **SNARE 旋钮**：军鼓也静音。', panel: ['MUTE', 'SNARE'], detect: { kind: 'muted', track: 'SNARE', on: true }, wait: '长按 [MUTE]，再点 SNARE 旋钮…', liveWait: '按住 [MUTE]，按 SNARE 旋钮…' },
            scene(2, '接着把它改成**主歌**。'),
            { text: '主歌：**按住 [MUTE] 再按 [ALL] 旋钮**——一次取消全部静音，底鼓、军鼓回来了。', panel: ['MUTE', 'ALL'], detect: { kind: 'muted', track: 'KICK', on: false }, wait: '长按 [MUTE]，再点 ALL 旋钮…', liveWait: '按住 [MUTE]，按 [ALL] 旋钮…' },
            scene(3, '接着把它改成**副歌**。'),
            { text: '副歌：转 **[ALL] 旋钮**两格，11 条轨道一起到**第 3 段**。', panel: ['ALL'], detect: { kind: 'patterns', pattern: 2 }, wait: '在 ALL 旋钮上往上拖两格…', liveWait: '转 [ALL]，让大家都到第 3 段…' },
            { text: '回到开头：按**第 1 个方键**，选中 scene 1（它变紫）。', panel: ['DK1'], sim: { kind: 'sceneat', index: 0 }, wait: '点第 1 个方键…', liveWait: '按第 1 个方键（做完点“我已经做了”）…' },
            PLAY('短按 [PLAY]：从 scene 1 开始，前奏 → 主歌 → 副歌，一个接一个放下去。'),
            STOP('三个都放完会自己停（没停就按 [PLAY]）。'),
          ],
          done: '这是你第一首“有结构”的歌。',
          coach: '学生在 Song 模式里排 scene（手册 3.14）：按住 [ALL] 再按 [PROJECT↑] 进 Song mode（Index SONG 亮；正在播放会停）；Drum key 1 紫色 = scene 1（真机上没有 scene 时不亮，要按一下加上）；scene 1 静音 KICK、SNARE（按住 [MUTE] 再按旋钮）当前奏；按不亮的 Drum key 2 加 scene 2（复制当前），按住 [MUTE] 再按 [ALL] 取消全部静音当主歌；按 Drum key 3 加 scene 3，转 [ALL] 让 11 条到 pattern 3 当副歌；按 Drum key 1 选回 scene 1，按 [PLAY] 按顺序放（默认放完最后一个就停）。Song / Scene 模式、加 scene 机器报不报不知道，静音和在第几段应用读得出来。',
        },
        {
          type: 'do',
          title: 'Scene 模式：现场自己决定',
          blocks: [
            'Song 模式是“照着排好的放”。现场更常用 **Scene 模式**：一个 scene 一直循环，你按哪个方键，**下一小节**就换到哪个——前奏想多放几遍就多放几遍，觉得到了再进副歌。',
          ],
          liveBlocks: [
            'Song 模式是“照着排好的放”。现场更常用 **Scene 模式**：一个 scene 一直循环，你按哪个方键，**下一小节**就换到哪个——前奏想多放几遍就多放几遍，觉得到了再进副歌。',
            LIVE_SONG,
          ],
          tasks: [
            { text: '再做一次**按住 [ALL] 再按 [PROJECT↑]**：进 **Scene 模式**（有 scene 的方键变青蓝色）。', panel: ['ALL', 'PROJECT'], sim: { kind: 'songmode', mode: 2 }, wait: '长按 ALL 旋钮出现黑圈，再点 [PROJECT↑]…', liveWait: '按住 [ALL] 再按 [PROJECT↑]（做完点“我已经做了”）…' },
            PLAY('短按 [PLAY]：scene 1（前奏）一直循环。'),
            { text: '觉得前奏够了，按**第 3 个方键**：下一小节开头换到副歌。', panel: ['DK3'], sim: { kind: 'sceneat', index: 2 }, wait: '点第 3 个方键…', liveWait: '按第 3 个方键（做完点“我已经做了”）…' },
            { text: '再按**第 1 个方键**：回到前奏——收尾的时候常这样“退回去”。', panel: ['DK1'], sim: { kind: 'sceneat', index: 0 }, wait: '点第 1 个方键…', liveWait: '按第 1 个方键（做完点“我已经做了”）…' },
            STOP(),
            { text: '退出：再按一次**按住 [ALL] 再按 [PROJECT↑]**，回到普通状态（SONG 灭了）。', panel: ['ALL', 'PROJECT', 'INDEX'], sim: { kind: 'songmode', mode: 0 }, wait: '长按 ALL 旋钮出现黑圈，再点 [PROJECT↑]…', liveWait: '按住 [ALL] 再按 [PROJECT↑]（看 SONG 灭；做完点“我已经做了”）…' },
          ],
          done: 'Song 模式照着放，Scene 模式你来指挥。',
          coach: '学生在用 Scene mode（手册 3.14，V1.10 起）：在 Song mode 里再按一次 [ALL] + [PROJECT↑] 进 Scene mode（有 scene 的 Drum key 青蓝色，选中的紫色）；按 [PLAY] 循环当前 scene；按别的 scene 的 Drum key，在 Launch Quantize 对齐点切过去；再按一次 [ALL] + [PROJECT↑] 退回普通状态（不会停止播放）。机器报不报这些不知道，没打勾让他点“我已经做了”。',
        },
        {
          type: 'quiz',
          title: '三个小问题',
          questions: [
            {
              q: '一个 scene 里记着的是——',
              options: ['11 条轨道各放哪一段乐句，还有谁静音', '一个音色', '这首歌的速度'],
              answer: 0,
              explain: 'scene = 11 条轨道各选一段的组合（外加静音）。',
            },
            {
              q: '在 Song 模式里，想回到普通状态，怎么按？',
              options: ['按住 [ALL] 再按 [PROJECT↑]，做两次（先进 Scene 模式再出来）', '按 [PLAY]', '按住 [DELETE] 再按 [ALL]'],
              answer: 0,
              explain: '普通 → Song → Scene → 普通，同一个组合键轮着换。[DELETE] + [ALL] 会删掉所有轨道当前这一段——别按。',
            },
            {
              q: '现场演出，想自己决定什么时候从前奏进副歌，用哪个？',
              options: ['Song 模式', 'Scene 模式', '都不行'],
              answer: 1,
              explain: 'Scene 模式里一个 scene 一直循环，你按方键，下一小节就换过去。',
            },
          ],
        },
      ],
    },

    // ───────────────────────── 6.4 ─────────────────────────
    {
      id: '6-4',
      simProject: 3,
      simSeed: CH6_SEED,
      no: '6.4',
      title: '能量曲线：编一首完整的歌',
      minutes: 45,
      summary: '前奏、主歌、铺垫、副歌、收尾怎么安排；你打碟时对“能量”的感觉怎么用在编曲上；排一首 5 个 scene 的歌，请啾啾点评。',
      takeaway: '一首歌的“能量”像一条曲线：**前奏**少、**主歌**中等、**铺垫**一点点往上推、**副歌**最满、**收尾**退下来。推能量的办法：一条一条**加轨道**（取消静音）、镲**变密**、军鼓来个**过门**、（第 7 章）高通滤波慢慢推上去。最满的那一段要有“落差”才显得满——前面先空一下。',
      steps: [
        {
          type: 'read',
          title: '能量曲线',
          blocks: [
            '打碟时你一直在看“能量”：什么时候让大家喘口气，什么时候推上去。编一首歌也是这样，只是曲线画在一首歌里面：',
            { list: [
              '**前奏**：东西少。**Faded** 开头只有钢琴和人声。',
              '**主歌**：节奏进来，但留着空。**Wake Me Up** 的主歌只是吉他和人声。',
              '**铺垫**（build-up）：一点点往上推，越来越紧。**Animals**、**Levels** 进高潮之前那一长段，鼓越打越密、声音越来越尖。',
              '**副歌 / 高潮**（drop）：最满。前面那一下“空”越明显，这里越炸。',
              '**收尾**：一层层退下去，或者回到前奏的样子。',
            ] },
            '先在下面排一遍：每一格是“这条轨道在这一段里”——点一下换成轻、满、不响。下面那一排柱子就是你的能量曲线。',
            { widget: 'arranger' },
            { callout: 'dj', text: '你在台上的直觉——“这里该收一下了”“这里要炸了”——就是编曲。差别只是：打碟时你用两首现成的歌，这里你用 11 条轨道自己搭。' },
          ],
        },
        {
          type: 'read',
          title: '在 SEQTRAK 上推能量的几个办法',
          blocks: [
            { list: [
              '**一条一条加**：前奏只有两三条，每个 scene 多放出来一条（按住 [MUTE] 再按旋钮取消静音）。',
              '**变密**：镲从 4 下变 8 下、16 下（做在另一段乐句里）。',
              '**过门**：铺垫的最后一小节，军鼓换到带过门的那一段（上一课做的军鼓第 2 段）。',
              '**先空一下**：副歌之前那个 scene 把底鼓静音，副歌里底鼓一回来，就“炸”了。',
              '**滤波**：第 7 章的 [HIGH PASS] 触摸条，往上推，低音一点点被抽走，手一松全回来——DJ 最常用的那一招。',
            ] },
            { callout: 'tip', text: 'scene 能排 16 个，不用一次排完：先排 5 个（前奏、主歌、铺垫、副歌、收尾），放一遍，哪里不对再改哪一个。' },
          ],
        },
        {
          type: 'do',
          title: '排一首 5 个 scene 的歌',
          blocks: [
            '在 Song 模式里排 5 个 scene：前奏、主歌、铺垫、副歌、收尾。上一课排过的 3 个可以接着用（scene 1 前奏、2 主歌、3 副歌）：在主歌和副歌之间要插一个铺垫——机器不能插队，所以把 scene 3 改成铺垫，再加 scene 4 当副歌、scene 5 当收尾。',
            { callout: 'tip', text: '模拟机上：进 Song 模式（长按 ALL 出现黑圈、点 [PROJECT↑]），选中一个 scene（点它的方键），再转旋钮、静音来改它。铺垫可以用“11 条在第 1 段 + 军鼓转到第 2 段（过门）”。' },
          ],
          liveBlocks: [
            '在 Song 模式里排 5 个 scene：前奏、主歌、铺垫、副歌、收尾。上一课排过的 3 个可以接着用（scene 1 前奏、2 主歌、3 副歌）：机器不能插队，所以把 scene 3 改成铺垫（比如 11 条在第 1 段 + 军鼓第 2 段的过门），再加 scene 4 当副歌、scene 5 当收尾。',
            LIVE_SONG,
          ],
          tasks: [
            SONG_IN('（已经在 Song 模式里就不用再按）'),
            { text: '按第 **3** 个方键选中 scene 3（没有就加上），把它改成**铺垫**：转 [ALL] 让大家回到第 1 段，再把 **SNARE 旋钮**转到第 2 段（带过门的那段）。', panel: ['DK3', 'ALL', 'SNARE'], detect: { kind: 'patternat', track: 'SNARE', pattern: 1 }, wait: '点第 3 个方键，再转 ALL、SNARE 旋钮…', liveWait: '选 scene 3，让军鼓在第 2 段…' },
            { text: '加 **scene 4 副歌** 和 **scene 5 收尾**：按不亮的第 4、第 5 个方键，各自转旋钮、静音改好（副歌：大家第 3 段；收尾：像前奏那样把底鼓、军鼓静音）。', panel: ['DK4', 'DK5', 'ALL', 'MUTE'], sim: { kind: 'scenes', min: 5 }, wait: '点第 4、第 5 个方键加 scene…', liveWait: '加 scene 4、scene 5 并改好（做完点“我已经做了”）…' },
            { text: '按**第 1 个方键**回到开头。', panel: ['DK1'], sim: { kind: 'sceneat', index: 0 }, wait: '点第 1 个方键…', liveWait: '按第 1 个方键（做完点“我已经做了”）…' },
            PLAY('短按 [PLAY]，从头听一遍你的歌。'),
            STOP('放完会自己停（没停就按 [PLAY]）。哪一段不对，选中它再改。'),
          ],
          done: '一首 5 段的歌。',
          coach: '第 6 章的结业编曲：在 Song mode 里排 5 个 scene（前奏、主歌、铺垫、副歌、收尾）。手册里没有插入 / 移动 scene 的操作，所以要把 scene 3 改成铺垫再往后加。改一个 scene：按它的 Drum key 选中，再转 Track knob / [ALL]、按住 [MUTE] 再按旋钮。删 scene：按住 [DELETE] 再按亮红色的 Drum key（正在放的不能删）。Song / Scene 模式机器报不报不知道。',
        },
        {
          type: 'reflect',
          title: '请啾啾听听你的编排',
          fields: [
            { label: '每个 scene 放了什么', rows: 5, placeholder: '例如：scene 1 前奏只有镲和和弦；scene 2 主歌加底鼓军鼓；scene 3 铺垫军鼓过门；scene 4 副歌全部第 3 段；scene 5 收尾回到前奏' },
            { label: '放下来听，哪里你自己觉得不对劲', placeholder: '例如：副歌进来不够“炸”；收尾太突然' },
          ],
          ask: '这是我在 SEQTRAK 上排的一首歌（第 6 章的结业创作），每个 scene 放什么我写在下面。请从“能量曲线”的角度点评：哪里推得好？哪里平了？只给一条最值得试的修改建议。',
          blocks: [
            '把你每个 scene 放了什么写下来（大概就行），点“请啾啾点评”。啾啾听不到你的机器，它看的是你写的结构。',
          ],
          coach: '第 6 章的结业创作：学生用 Song mode 排了一首 5 个 scene 左右的歌。学过：pattern（每轨 3–6 段）、转旋钮立即换 / 按住旋钮按方键预约 / 双击立即、复制粘贴（旋钮 + 长按方键 2 秒；旋钮 + [PAGE] + 方键）、[ALL] 一起、Song / Scene mode、scene 的增删改。点评看能量曲线：前奏是否够空、铺垫是否在推、副歌前有没有“空一下”、收尾是否退下来。先肯定，再给一条具体建议（比如“副歌前那个 scene 把底鼓静音”）。',
        },
      ],
    },
  ],
};
