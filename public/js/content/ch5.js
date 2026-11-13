// 第 5 章 · 采样。写法和前几章一样（见 curriculum.js 顶部、ch0.js 顶部关于 live* 的说明）。
//
// 机器操作的依据（docs/seqtrak-operation-reference.md）：3.13 采样器（7 个采样位、[REC SAMPLE] 开始 / 结束、最长 16 秒、
// 长按 [REC SAMPLE] 2 秒换采样源、[DELETE] + [REC SAMPLE] 取消、[ALL] + [REC SAMPLE] 预备拍、[REC SAMPLE] + [VOL+] 监听、
// 自动把音量拉满、第 1 页旋钮 2 PITCH、进阶第 4 页 START / END / LOOP / LOOP LENGTH、[PAGE] + SAMPLER 旋钮步进输入、
// [DELETE] + Synth key 删这个采样的格子）、3.6.1 参数锁（按住亮着的方键转旋钮；SAMPLER 的 PITCH 可锁）、3.11.4 存（[ALL] + SOUND 旋钮）、
// 6.1 坑 6“采样后不保存会被覆盖”。手册没写清的：换采样源时是哪三个方键（课文说“看哪三个亮”）。
// 2026-11-12 在用户机器上只读查到（docs/hardware-findings.md）：7 个采样位的名字能从 50 eA 00 起读出来（e = 0–6）——
// 镜像据此认出“这个位上录好了 / 换了声音”。按 [REC SAMPLE]、变调、剪、换采样源，机器报不报、报什么都还不知道：这些任务真机上要自己点“我已经做了”。
// 例子只用用户听过的歌（songs.js 开头那 11 首）：Levels 里那句人声是采样；Gangsta's Paradise 底下那段是照着老歌重新弹唱的（翻用，采样的近亲）。
// 模拟机不会真的用麦克风录：按 [REC SAMPLE] 录到的是 sim-samples.js 里现做的一段（一声“啊”、关门、敲玻璃杯）；讲解里的采样实验台可以用电脑的麦克风录 2 秒。

const SELECT_SAMPLER = { text: '按一下 **SAMPLER 旋钮**（中间合成器区**下排右边**），只按不转。', panel: ['SAMPLER'], detect: { kind: 'track', track: 'SAMPLER' }, wait: '点一下 SAMPLER 旋钮…', liveWait: '等你按 SAMPLER 旋钮…' };
const slot = (n, extra = '') => ({ text: `按一下 **Synth key ${n}**：选中第 ${n} 个采样位${extra}`, panel: [`SK${n}`], sim: { kind: 'samplesel', key: n }, live: { kind: 'samplesel', key: n }, detect: { kind: 'note', track: 'SAMPLER' }, wait: `点 Synth key ${n}…`, liveWait: `按 Synth key ${n}…` });
const PLAY = (text = '短按 [PLAY]，让循环放着。') => ({ text, panel: ['PLAY'], detect: { kind: 'start' }, wait: '点 [PLAY]…', liveWait: '等你按 [PLAY]…' });
const STOP = (text = '听够了按 [PLAY] 停下。') => ({ text, panel: ['PLAY'], detect: { kind: 'stop' }, wait: '再点 [PLAY]…', liveWait: '等你停止…' });
const REC_WHERE = '[REC SAMPLE] 在中间合成器区**上边沿**那 5 个键的**最右边**（[BAR LENGTH] [OCTAVE] [SCALE] [KEY] [REC SAMPLE]）。';
const LIVE_UNSEEN = { callout: 'warn', title: '这几样机器不一定告诉应用', text: '按 [REC SAMPLE]、变调、剪头尾、换采样源，机器报不报给应用还不知道：没打勾就点“我已经做了”。**录好了没有**应用看得出来——那个采样位的名字会变。' };

export const ch5 = {
  id: 'ch5',
  no: 5,
  title: '采样',
  subtitle: '把世界录进来',
  lessons: [
    // ───────────────────────── 5.1 ─────────────────────────
    {
      id: '5-1',
      simProject: 3,
      no: '5.1',
      title: '7 个格子装 7 段声音',
      minutes: 30,
      summary: '采样是什么；采样器的 7 个采样位；听预置采样、换一个、变调；录好的采样不存会被覆盖。',
      takeaway: '**采样** = 把一段现成的声音录下来，当乐器用。SEQTRAK 的采样器（SAMPLER，中间下排右边）有 **7 个采样位**，一个 Synth key 一个。按 Synth key = 放它、也是选中它；选中之后在第 1 页转 SOUND 旋钮换预置采样、转第 2 个旋钮（PITCH）变调。自己录的、改过的，**按住 [ALL] 再按 SOUND 旋钮**存下来，不然往同一个位上再录，就没了。',
      steps: [
        {
          type: 'read',
          title: '把一段声音当乐器',
          blocks: [
            '先玩。下面挑一段声音，拖两条线剪掉头和尾，转右边的 PITCH，再在 7 个键上弹它——一声关门、一声“啊”，都能变成乐器：',
            { widget: 'samplelab' },
            '这就是**采样**（sampling）：把一段已经有的声音录下来，剪一剪、变个调，再当乐器弹、当鼓打。你听过的很多歌就是这样来的：',
            { list: [
              '**Levels**（Avicii）里那句一直回来的女声，截自一首六十年代的灵魂乐老歌。',
              '**Gangsta\'s Paradise** 底下那段阴沉的旋律和合唱，是照着 Stevie Wonder 的一首老歌重新弹、重新唱的——这叫“翻用”，是采样的近亲：拿现成的音乐来做自己的歌。',
            ] },
            { callout: 'dj', text: '你打碟时按的音效、喊的那一声“Yeah”，其实就是采样：一段现成的声音，在你想要的时候放出来。这一章让机器自己录、自己剪。' },
          ],
        },
        {
          type: 'read',
          title: '采样器：7 个采样位',
          blocks: [
            '机器上管采样的是第 11 条轨道 **SAMPLER**（中间合成器区下排右边那个旋钮）。它和别的轨道不一样：7 个 Synth keys 不是 7 个音高，是 **7 个采样位**，每个位上放一段声音。',
            { panel: ['SAMPLER', 'SYNTHKEYS', 'SD1', 'SD2'], lit: { SK3: 'red' }, caption: '选中 SAMPLER 之后，按一个 Synth key：放这一段，同时**选中**这个位（真机上这个键红色闪）。之后的变调、剪、录，都是对着选中的这一个位。' },
            { list: [
              '换一段预置采样：选中位，在第 1 页转 **SOUND 旋钮**；按住 SOUND 再按方键，按类别跳（1 人声数拍、2 人声短句、3 唱的、4 机器人声、5 上升音效、6 激光、7 撞击、8 噪音……**11 搓碟**……16 收藏）。机器里预置了 392 段。',
              '变调：第 1 页的**第 2 个旋钮**（Index 亮 PITCH），一格一个半音。',
            ] },
            { callout: 'warn', title: '录的、改的，要存', text: '自己录的采样、改过的设置，**按住 [ALL] 再按一下 SOUND 旋钮**存下来（和第 4 章存音色一样）。手册专门提醒：没存的采样，往同一个位上再录一段，原来那段就没了，临时保存里也找不回来。' },
          ],
        },
        {
          type: 'do',
          title: '认识采样器',
          blocks: [
            '在 4 号工程里，把 7 个采样位都听一遍，换一段、变个调。',
            { callout: 'tip', text: '模拟机上：采样器的预置声音是用鼓的声音代替的；**变调、剪头尾要等下一节课录了自己的声音才听得出来**。' },
          ],
          liveBlocks: [
            '在 4 号工程里，把 7 个采样位都听一遍，换一段、变个调。机器没有屏幕：选中位的名字，屏幕上的镜像会显示。',
            LIVE_UNSEEN,
          ],
          tasks: [
            SELECT_SAMPLER,
            { text: '把 7 个 **Synth keys** 从 1 到 7 挨个按一遍：每个键是一段不同的声音。', panel: ['SYNTHKEYS'], detect: { kind: 'note', track: 'SAMPLER', count: 5 }, wait: '按 Synth keys…', liveWait: '按 Synth keys…' },
            slot(7, '（真机上它红色闪）。'),
            { text: '换一段：在第 1 页**转 SOUND 旋钮**（右边那一列最上面）几格，听第 7 个位换了什么声音。', panel: ['SD1', 'INDEX'], detect: { kind: 'sound', track: 'SAMPLER' }, wait: '把 SOUND 旋钮拖一下…', liveWait: '转 SOUND 旋钮（没打勾就点“我已经做了”）…' },
            { text: '变调：转**第 2 个旋钮**（Index 亮 PITCH），往一边高、往另一边低，每转一格按一下 Synth key 7 听。', panel: ['SD2', 'SK7'], sim: { kind: 'param', track: 'SAMPLER', param: 'pitch', by: 3 }, wait: '拖第 2 个旋钮…', liveWait: '转第 2 个旋钮（没打勾就点“我已经做了”）…' },
          ],
          done: '7 个位、7 段声音：选中哪个，改的就是哪个。',
          coach: '学生第一次玩采样器：按 SAMPLER 旋钮（合成器区下排右边）选中；按 Synth key 1–7 听 7 个采样位；按 Synth key 7 选中第 7 个位（真机上红色闪）；第 1 页转 Sound Design 旋钮 1 换预置采样（SAMPLER 有 392 个预置），转旋钮 2 是 PITCH（半音）。镜像能读出每个采样位的名字；变调、换采样机器报不报不知道，没打勾让他点“我已经做了”。',
        },
        {
          type: 'quiz',
          title: '三个小问题',
          questions: [
            {
              q: '选中 SAMPLER 之后，7 个 Synth keys 是——',
              options: ['7 个音高（音阶上的 7 个音）', '7 个采样位，每个位放一段声音', '7 面鼓'],
              answer: 1,
              explain: '采样器的 Synth key 不是音高：一个键一段声音。按一下 = 放它、也选中它。',
              wrong: { 0: '那是 SYNTH 1 / 2 和 DX。', 2: '那是“打鼓模式”。' },
            },
            {
              q: '想给第 3 个采样位变调，先做什么？',
              options: ['按一下 Synth key 3 选中它，再转第 1 页的第 2 个旋钮', '直接转第 2 个旋钮', '按 [REC SAMPLE]'],
              answer: 0,
              explain: '变调、剪、录，都是对着“选中的那个位”。先按它的 Synth key。',
            },
            {
              q: '录了一段很满意的声音，最稳的做法是——',
              options: ['马上按住 [ALL] 再按 SOUND 旋钮存下来', '不用管，机器会记住', '换个工程'],
              answer: 0,
              explain: '没存的采样，往同一个位上再录，原来那段就没了。',
            },
          ],
        },
      ],
    },

    // ───────────────────────── 5.2 ─────────────────────────
    {
      id: '5-2',
      simProject: 3,
      no: '5.2',
      title: '录一段你自己的声音',
      minutes: 30,
      summary: '[REC SAMPLE] 怎么录、录多长、从哪儿录；录一声拍手 / 一句话 / 敲一下杯子，存下来。',
      takeaway: '选中 SAMPLER，**按一个 Synth key 选好位**，按 **[REC SAMPLE]**（合成器区上边沿最右边）开始，对着机器出声，**再按一次**结束——最长 16 秒，录完音量会自动拉满。默认从**内置麦克风**录（AUDIO IN 插着线就录它）。录砸了：录的时候按住 [DELETE] 再按 [REC SAMPLE] 取消。满意了：按住 [ALL] 再按 SOUND 旋钮存。',
      steps: [
        {
          type: 'read',
          title: '录之前知道这几件事',
          blocks: [
            { list: [
              '**录到哪个位**：先按一个 Synth key 选中（红色闪），录的就是它。原来那个位上的声音会被换掉。',
              `**开始和结束**：${REC_WHERE}按一下开始，再按一下结束；不按的话录满 **16 秒**自己停。`,
              '**从哪儿录**：默认是机器自己的**内置麦克风**（右边那块圆孔格栅右上角印着 MIC）；[AUDIO IN] 插着线时录的是插进来的声音。还能录 **USB** 送进来的声音，或者**重采样**——录机器自己正在放的声音（第 4 节课用）。',
              '**录完自动拉满音量**：小声录也不怕。',
              '**录砸了**：录的时候**按住 [DELETE] 再按 [REC SAMPLE]**，取消这一次，那个位回到原来的声音。',
            ] },
            { panel: ['RECSAMPLE', 'SAMPLER', 'SYNTHKEYS', 'SPEAKER'], caption: '[REC SAMPLE] 在合成器区上边沿最右边；麦克风在右边那块格栅里（右上角印着 MIC）。' },
            { callout: 'tip', text: '想录之前先看看声音够不够大：**按住 [REC SAMPLE] 再按 [VOL+]**（左侧面最上面）进入监听，右边那列小灯跟着声音跳；同样的组合退出。想先响几下节拍再开始录：**按住 [ALL] 再按 [REC SAMPLE]** 打开预备拍（小灯白色亮 = 开）。' },
          ],
        },
        {
          type: 'do',
          title: '录一声',
          blocks: [
            '录什么都行：拍一下手、说一句“Yeah”、用筷子敲一下杯子。录到第 5 个位上。',
            { callout: 'tip', text: '模拟机上：不会真的用麦克风。按两下 [REC SAMPLE] 之后，第 5 个位上会换成一段现成的“录音”（一声“啊”、关门、敲玻璃杯轮着来）。' },
          ],
          liveBlocks: [
            '录什么都行：拍一下手、说一句“Yeah”、用筷子敲一下杯子。录到第 5 个位上。嘴离机器右边那块圆孔格栅近一点。',
            LIVE_UNSEEN,
          ],
          tasks: [
            SELECT_SAMPLER,
            slot(5, '，接下来就录到它上面。'),
            { text: `**按一下 [REC SAMPLE]** 开始录。${REC_WHERE}`, panel: ['RECSAMPLE'], sim: { kind: 'sampling', on: true }, wait: '点 [REC SAMPLE]…', liveWait: '按 [REC SAMPLE]，然后出声（没打勾就点“我已经做了”）…' },
            { text: '出声（拍手 / 说一句 / 敲杯子），然后**再按一下 [REC SAMPLE]** 结束。', panel: ['RECSAMPLE'], detect: { kind: 'sampled', key: 5 }, wait: '再点一下 [REC SAMPLE] 结束…', liveWait: '出声，再按一下 [REC SAMPLE]…' },
            { text: '按 **Synth key 5** 听你录的。', panel: ['SK5'], detect: { kind: 'note', track: 'SAMPLER' }, wait: '点 Synth key 5…', liveWait: '按 Synth key 5…' },
            { text: '满意就**存下来**：**先按住** [ALL]（鼓区左上角）**不放，再按一下** SOUND 旋钮（按下去，不是转）。小灯白色闪一下 = 存好了。不满意就回到上面重录一次。', panel: ['ALL', 'SD1'], sim: { kind: 'soundsave', track: 'SAMPLER' }, wait: '长按 ALL 旋钮出现黑圈，再点 SOUND 旋钮…', liveWait: '按住 [ALL] 再按一下 SOUND 旋钮（做完点“我已经做了”）…' },
          ],
          done: '这是你录的第一个采样。',
          coach: '学生在录第一个采样：选中 SAMPLER；按 Synth key 5 选中第 5 个位（红色闪）；按 [REC SAMPLE]（合成器区上缘最右边）开始，对着内置麦克风出声，再按一次结束（最长 16 秒，录完自动归一化）；按 Synth key 5 听；按住 [ALL] 再按 Sound Design 旋钮 1 存。录砸了：录的时候按住 [DELETE] 再按 [REC SAMPLE] 取消。镜像靠读采样位的名字认出“录好了”；按 [REC SAMPLE] 本身机器报不报不知道。',
        },
        {
          type: 'do',
          title: '录砸了？取消它',
          blocks: [
            '练一下“后悔药”：在第 4 个位上开始录，录到一半取消——第 4 个位还是原来的声音。',
          ],
          liveBlocks: [
            '练一下“后悔药”：在第 4 个位上开始录，录到一半取消——第 4 个位还是原来的声音。',
            LIVE_UNSEEN,
          ],
          tasks: [
            slot(4, '（拿它练习，一会儿取消，不会换掉）。'),
            { text: '**按一下 [REC SAMPLE]** 开始录。', panel: ['RECSAMPLE'], sim: { kind: 'sampling', on: true }, wait: '点 [REC SAMPLE]…', liveWait: '按 [REC SAMPLE]（没打勾就点“我已经做了”）…' },
            { text: '取消：**先按住** [DELETE]（左侧面从上往下第 3 个）**不放，再按** [REC SAMPLE]。', panel: ['DELETE', 'RECSAMPLE'], sim: { kind: 'sampling', on: false, cancelled: true }, wait: '长按 [DELETE] 出现黑圈，再点 [REC SAMPLE]…', liveWait: '按住 [DELETE] 再按 [REC SAMPLE]（做完点“我已经做了”）…' },
            { text: '按 **Synth key 4** 听：还是原来那一段。', panel: ['SK4'], detect: { kind: 'note', track: 'SAMPLER' }, wait: '点 Synth key 4…', liveWait: '按 Synth key 4…' },
          ],
          done: '录砸了不要紧：[DELETE] + [REC SAMPLE]。',
          coach: '学生在练取消采样：按 Synth key 4 选中第 4 个位，按 [REC SAMPLE] 开始，再按住 [DELETE]（左侧面从上往下第 3 个）同时按 [REC SAMPLE] 取消，这个位回到采样之前的声音（手册 3.13.5）。机器报不报不知道，没打勾让他点“我已经做了”。',
        },
        {
          type: 'quiz',
          title: '两个小问题',
          questions: [
            {
              q: '[AUDIO IN] 插着一根线，这时按 [REC SAMPLE]（采样源是默认的），录到的是——',
              options: ['机器的内置麦克风', 'AUDIO IN 插进来的声音', '机器自己正在放的声音'],
              answer: 1,
              explain: '采样源是“内置麦克风 / AUDIO IN”时，插着线就录线进来的声音，没插才用麦克风。',
            },
            {
              q: '录到一半发现录砸了，想取消这一次，怎么按？',
              options: ['按住 [DELETE] 再按 [REC SAMPLE]', '按 [UNDO/REDO]', '关机'],
              answer: 0,
              explain: '取消之后那个位回到采样之前的声音。',
              wrong: { 1: '[UNDO/REDO] 只管拧过的参数。', 2: '别关机：没保存的东西会丢。' },
            },
          ],
        },
      ],
    },

    // ───────────────────────── 5.3 ─────────────────────────
    {
      id: '5-3',
      simProject: 3,
      no: '5.3',
      title: '剪头尾、变调、循环',
      minutes: 35,
      summary: '进阶第 4 页的起点、终点、循环；第 1 页的变调；把一声关门变成鼓，把一句话变成一个音。',
      takeaway: '剪：**长按翻页键 2 秒**进进阶设置，翻到**第 4 页**——旋钮 1 起点（START）、2 终点（END）、3 循环开关（LOOP）、4 循环长度。起点往后挪，剪掉开头的空白；终点往前挪，剪掉拖着的尾巴；循环开着，按住键时中间那一段一直转。变调在**第 1 页的旋钮 2**：高了也快了、短了，低了也慢了、长了。改好了存下来。',
      steps: [
        {
          type: 'read',
          title: '剪一剪，换个样子',
          blocks: [
            '刚录的声音前面多半有一小截空白（按下键到你出声之间），后面拖着房间的回声。把头尾剪掉，它才“干净利落”，能踩在拍子上。再变个调：同一声关门，调低是一声闷鼓，调高是一下“嗒”。',
            { widget: 'samplelab' },
            { list: [
              '**起点（START）**往后挪：开头的空白没了，一按就响。',
              '**终点（END）**往前挪：尾巴没了，声音变短，适合当鼓。',
              '**循环（LOOP）**开：按住键时，起点到终点那一段一直转。剪得很短再循环，一句话就成了一个“嗡——”的音。',
              '**变调（PITCH）**：采样的变调是变速——高八度就快一倍、短一半，低八度就慢一倍、长一倍（磁带调速那种感觉）。',
            ] },
            { callout: 'dj', text: '打碟时把一首歌调快，它也变尖；调慢，它也变沉——这就是采样的变调。Lo-fi 里那种“唱片放慢了”的懒洋洋的感觉，很多就是把采样调低几个半音。' },
          ],
        },
        {
          type: 'do',
          title: '剪掉头和尾',
          blocks: [
            '对着上节课录在第 5 个位上的那段：进进阶设置，翻到第 4 页，挪起点和终点、开循环听一听。',
            { callout: 'tip', text: '模拟机上：翻页键在右边那一列下面，**按住 2 秒**进进阶设置，再单按翻页。（这一步在模拟机上要先录过——上节课在模拟机上录过就有；没有的话先按 SAMPLER 旋钮、Synth key 5、[REC SAMPLE] 两下录一段。）' },
          ],
          liveBlocks: [
            '对着上节课录在第 5 个位上的那段：进进阶设置，翻到第 4 页，挪起点和终点、开循环听一听。进阶第 4 页上 Index 亮的是 OTHER。',
            { device: ['sdmode', 'sdpage'] },
            LIVE_UNSEEN,
          ],
          tasks: [
            SELECT_SAMPLER,
            slot(5, '（你录的那段）。'),
            { text: '**长按**翻页键（右边那一列正下方、印着三个小点）**2 秒**：进**进阶设置**。', panel: ['SDPAGE'], detect: { kind: 'sdmode', on: true }, wait: '在翻页键上按住 2 秒…', liveWait: '长按翻页键 2 秒…' },
            { text: '**单按**翻页键，翻到**第 4 页**（小灯从上往下第 4 个亮）。', panel: ['SDPAGE', 'METER'], detect: { kind: 'sdpage', page: 3 }, wait: '单按翻页键，翻到第 4 页…', liveWait: '单按翻页键，翻到第 4 页…' },
            { text: '**第 1 个旋钮**（起点）往大转一点，按 Synth key 5 听：开头的空白没了。', panel: ['SD1', 'SK5'], sim: { kind: 'param', track: 'SAMPLER', param: 'start', by: 8 }, wait: '把第 1 个旋钮往上拖…', liveWait: '转第 1 个旋钮（没打勾就点“我已经做了”）…' },
            { text: '**第 2 个旋钮**（终点）往小转一点：尾巴没了，声音变短。', panel: ['SD2', 'SK5'], sim: { kind: 'param', track: 'SAMPLER', param: 'end', by: 8 }, wait: '把第 2 个旋钮往下拖…', liveWait: '转第 2 个旋钮（没打勾就点“我已经做了”）…' },
            { text: '**第 3 个旋钮**（循环）转到“开”，**按住** Synth key 5 听它一直转；听完转回“关”。', panel: ['SD3', 'SK5'], sim: { kind: 'param', track: 'SAMPLER', param: 'loop', atLeast: 1 }, wait: '把第 3 个旋钮往上拖…', liveWait: '转第 3 个旋钮（没打勾就点“我已经做了”）…' },
            { text: '**长按**翻页键 2 秒**出**进阶设置。', panel: ['SDPAGE'], detect: { kind: 'sdmode', on: false }, wait: '在翻页键上按住 2 秒…', liveWait: '长按翻页键 2 秒…' },
          ],
          done: '头尾剪干净了：一按就响、说停就停。',
          coach: '学生在剪采样：选中 SAMPLER，按 Synth key 5（他录的那段）；长按 Sound Design Page 键 2 秒进 advanced settings，单按翻到第 4 页；旋钮 1 START POINT、2 END POINT、3 LOOP ON/OFF、4 LOOP LENGTH（Index 亮 OTHER；这几样官方 CC 表里没有，应用认不出，要他自己点“我已经做了”）；最后长按 2 秒出进阶设置。',
        },
        {
          type: 'do',
          title: '变个调，再存下来',
          blocks: [
            '回到第 1 页，把它调低一个八度、调高一个八度，听它怎么变——找一个你喜欢的停住，存下来。',
          ],
          liveBlocks: [
            '回到第 1 页，把它调低一个八度、调高一个八度，听它怎么变——找一个你喜欢的停住，存下来。',
            { device: ['sdpage'] },
            LIVE_UNSEEN,
          ],
          tasks: [
            { text: '确认在**第 1 页**（小灯最上面那个亮；不在就单按翻页键）。', panel: ['SDPAGE', 'METER'], detect: { kind: 'sdpage', page: 0 }, wait: '单按翻页键，翻回第 1 页…', liveWait: '等旋钮在第 1 页…' },
            { text: '**第 2 个旋钮**（PITCH）往低转 12 格（一个八度），按 Synth key 5 听：又慢又沉。', panel: ['SD2', 'SK5'], sim: { kind: 'param', track: 'SAMPLER', param: 'pitch', atMost: -8 }, wait: '把第 2 个旋钮往下拖…', liveWait: '往低转第 2 个旋钮（没打勾就点“我已经做了”）…' },
            { text: '再往高转，转过原样、高出一个八度：又快又尖。', panel: ['SD2', 'SK5'], sim: { kind: 'param', track: 'SAMPLER', param: 'pitch', atLeast: 8 }, wait: '把第 2 个旋钮往上拖…', liveWait: '往高转第 2 个旋钮…' },
            { text: '找一个你喜欢的位置停住，**存下来**：按住 [ALL] 再按一下 SOUND 旋钮。', panel: ['ALL', 'SD1'], sim: { kind: 'soundsave', track: 'SAMPLER' }, wait: '长按 ALL 旋钮，再点 SOUND 旋钮…', liveWait: '按住 [ALL] 再按一下 SOUND 旋钮（做完点“我已经做了”）…' },
          ],
          done: '同一声，高一点是“嗒”，低一点是“咚”。',
          coach: '学生在给采样变调：第 1 页 Sound Design 旋钮 2 是 PITCH（半音，采样的变调同时变速），往低转一个八度、往高转一个八度，最后停在喜欢的位置，按住 [ALL] 再按旋钮 1 存。PITCH 在 SAMPLER 上转动机器发不发 CC 没确认，没打勾让他点“我已经做了”。',
        },
        {
          type: 'quiz',
          title: '用耳朵回答',
          questions: [
            {
              q: '把一段采样往高调一个八度，它会——',
              options: ['变尖，长短不变', '变尖，也变快、变短一半', '只是变大声'],
              answer: 1,
              explain: '采样的变调是变速：像把唱片转快了。',
            },
            {
              q: '录的声音开头有一小截空白，按了键要等一下才响。动哪个？',
              options: ['进阶第 4 页的起点（START），往后挪', '终点（END），往前挪', '循环（LOOP）'],
              answer: 0,
              explain: '起点往后挪，开头的空白就剪掉了。',
            },
          ],
        },
      ],
    },

    // ───────────────────────── 5.4 ─────────────────────────
    {
      id: '5-4',
      simProject: 3,
      no: '5.4',
      title: '放进节奏：步进、参数锁、重采样',
      minutes: 45,
      summary: '把采样放进格子；按住一步转旋钮，让一段声音每一步一个音高（参数锁）；把机器自己正在放的声音录成一个采样（重采样）；做一段你自己的 Lo-fi。',
      takeaway: '采样器的步进输入：**按住 [PAGE] 再按 SAMPLER 旋钮**进出；按 Synth key 选一个采样位，再按方键放进格子（方键上只显示这个位的格子）。**参数锁**：按住一个亮着的方键，同时转第 1 页的旋钮 2，只改**这一步**的音高（亮紫色）——一声关门也能弹出旋律。**重采样**：长按 [REC SAMPLE] 2 秒、按亮着的第三个方键（RESAMPLING），让机器放着，按 [REC SAMPLE] 录它自己的声音；录完记得换回麦克风。',
      steps: [
        {
          type: 'do',
          title: '把采样放进格子',
          blocks: [
            '让你录的那一声，踩在每一拍上。',
            { callout: 'tip', text: '模拟机上进入步进输入：**长按** [PAGE] 出现黑圈，再点 SAMPLER 旋钮。' },
          ],
          liveBlocks: [
            '让你录的那一声，踩在每一拍上。合成器轨和采样器的格子应用读不出来：放格子那几项做完自己点“做好了”，按 [PLAY] 用耳朵核对。',
          ],
          tasks: [
            SELECT_SAMPLER,
            { text: '进入步进输入：**先按住** [PAGE]（左侧面从上往下第 6 个）**不放，再按一下 SAMPLER 旋钮**。', panel: ['PAGE', 'SAMPLER'], sim: { kind: 'mode', mode: 'stepinput', track: 'SAMPLER', on: true }, wait: '长按 [PAGE] 出现黑圈，再点 SAMPLER 旋钮…' },
            { text: '按一下 **Synth key 5**（你录的），再把第 **1、5、9、13** 个方键按亮。', panel: ['SK5', 'DK1', 'DK5', 'DK9', 'DK13'], sim: { kind: 'stepkeys', track: 'SAMPLER', keys: { 0: 5, 4: 5, 8: 5, 12: 5 } }, wait: '点 Synth key 5，再按亮第 1、5、9、13 个方键…' },
            PLAY('短按 [PLAY] 听：你录的那一声踩在每一拍上。'),
            STOP(),
          ],
          done: '你自己的声音，进了节奏。',
          coach: '学生在把采样放进格子：选中 SAMPLER，按住 [PAGE] 再按 SAMPLER 旋钮进入 Step Input mode；按 Synth key 5 选采样，再按亮 Drum key 1、5、9、13（方键上只显示所选采样的格子）；按 [PLAY] 听。采样器的格子应用读不出来，真机上这几项他自己点“做好了”。',
        },
        {
          type: 'do',
          title: '参数锁：一步一个音高',
          blocks: [
            '现在 4 下是同一个音高。让它们各不一样：**按住**一个亮着的方键，**同时**转第 1 页的第 2 个旋钮（PITCH），只改这一步。改过的那一步亮**紫色**。',
            { callout: 'tip', text: '模拟机上：**长按**亮着的方键出现黑圈，再拖第 2 个旋钮；调好了再点一下那个方键松开。要在第 1 页上做。' },
          ],
          liveBlocks: [
            '现在 4 下是同一个音高。让它们各不一样：**按住**一个亮着的方键，**同时**转第 1 页的第 2 个旋钮（PITCH），只改这一步。改过的那一步亮**紫色**。两只手：一只按住方键，一只转旋钮。',
            { callout: 'warn', text: '按住之后没转就松手，那一步会被当成“按了一下”关掉：重新按一下 Synth key 5，再把它按亮。' },
          ],
          tasks: [
            PLAY(),
            { text: '**按住第 9 个方键**不放，同时把第 2 个旋钮往低转几格：第 3 拍那一下变沉了（亮紫色）。', panel: ['DK9', 'SD2'], sim: { kind: 'plock' }, wait: '长按第 9 个方键出现黑圈，再拖第 2 个旋钮…' },
            { text: '**按住第 13 个方键**，把它往高转几格：第 4 拍那一下变尖了。', panel: ['DK13', 'SD2'], sim: { kind: 'plock' }, wait: '长按第 13 个方键，再拖第 2 个旋钮…' },
            STOP('听几圈：一声关门（或者你录的那一声）成了一小段旋律。按 [PLAY] 停下。'),
          ],
          done: '这叫参数锁：一步一个音高。别的旋钮也能这样锁（音量、滤波器……）。',
          coach: '学生在用参数锁（Parameter Lock）：按住一个已经亮着的 Drum key 的同时转 Sound Design 旋钮（第 1 页旋钮 2 = PITCH，SAMPLER 的 PITCH 可锁），只改这一步，改过的步亮紫色。删掉锁：按住 [DELETE] 再按那个 Sound Design 旋钮（删整段的这个参数的锁），或按住那一步和 [DELETE] 再按旋钮（只删这一步，V1.10 起）。真机上这几项应用认不出，他自己点“做好了”。',
        },
        {
          type: 'read',
          title: '重采样：把机器自己的声音录下来',
          blocks: [
            '采样源除了麦克风，还能选 **RESAMPLING（重采样）**：录的是**机器自己正在放的声音**。用处：',
            { list: [
              '把一整段鼓录成一个采样，再变调、剪、倒着用——Lo-fi 和 Hip-hop 里那种“唱片截下来的”鼓，就是这么做的。',
              '几条轨道合成一段，腾出轨道来做别的。',
            ] },
            { panel: ['RECSAMPLE', 'DRUMKEYS'], caption: '换采样源：**按住 [REC SAMPLE] 2 秒以上，同时按**亮白色的方键里的一个。亮着的三个从左到右是：内置麦克风 / AUDIO IN、USB、RESAMPLING；黄色是现在用的。是第几个方键手册没标：看哪三个亮。' },
            { callout: 'warn', text: '重采样的时候节拍器会被静音。录完记得**把采样源换回麦克风**，不然下次按 [REC SAMPLE] 录到的还是机器自己的声音。' },
          ],
        },
        {
          type: 'do',
          title: '重采样一小节',
          blocks: [
            '把正在放的这段录成一个新采样，放在第 6 个位上。',
            { callout: 'tip', text: '模拟机上：在 [REC SAMPLE] 上按住 2 秒再松开，方键 1–3 会亮，点第 3 个是重采样（真机上看哪三个亮）。' },
          ],
          liveBlocks: [
            '把正在放的这段录成一个新采样，放在第 6 个位上。',
            LIVE_UNSEEN,
          ],
          tasks: [
            { text: '换采样源：**按住 [REC SAMPLE] 2 秒**，然后按亮着的三个方键里**最右边那个**（RESAMPLING）。', panel: ['RECSAMPLE', 'DRUMKEYS'], sim: { kind: 'samplesrc', src: 2 }, wait: '在 [REC SAMPLE] 上按住 2 秒，再点第 3 个方键…' },
            PLAY('短按 [PLAY]，让循环放着。'),
            slot(6, '（录到这个位上）。'),
            { text: '按 **[REC SAMPLE]** 开始录，等一小节，再按一次结束。', panel: ['RECSAMPLE'], detect: { kind: 'sampled', key: 6 }, wait: '点两下 [REC SAMPLE]（中间隔一小会儿）…', liveWait: '按 [REC SAMPLE]，等一小节，再按一次…' },
            STOP('按 [PLAY] 停下，再按 Synth key 6 听：刚才那一小节成了一个采样。'),
            { text: '把采样源**换回麦克风**：按住 [REC SAMPLE] 2 秒，按亮着的三个里**最左边那个**。', panel: ['RECSAMPLE', 'DRUMKEYS'], sim: { kind: 'samplesrc', src: 0 }, wait: '在 [REC SAMPLE] 上按住 2 秒，再点第 1 个方键…' },
          ],
          done: '机器自己放的，被它自己录了下来。',
          coach: '学生在重采样：长按 [REC SAMPLE] 2 秒同时按亮白色的 Drum key 选采样源（从左到右 MIC/AUDIO IN、USB、RESAMPLING；是第几个键手册没标，看哪三个亮），选 RESAMPLING；按 [PLAY]；选 SAMPLER 的第 6 个位，按 [REC SAMPLE] 开始、一小节后再按结束（重采样时节拍器静音）；最后把采样源换回 MIC。镜像能从采样位的名字认出“录好了”；换采样源机器报不报不知道。',
        },
        {
          type: 'free',
          title: '做一段你自己的 Lo-fi',
          tracks: ['KICK', 'SNARE', 'HAT1'],
          synthTracks: ['SAMPLER', 'SYNTH2'],
          notePlaceholder: '例如：采样器第 5 个位（我录的拍手）放在 2、4 拍，第 6 个位（重采样的鼓）每小节开头，调低了 3 个半音',
          ask: '这是我用采样做的一段 Lo-fi（第 5 章的结业创作），请你点评：哪里有 Lo-fi 的味道？采样用得怎么样？只给一条最值得试的修改建议。',
          blocks: [
            '用这一章的东西做一小段：慢一点（80–90 BPM），鼓简单，采样当主角。几个方向：',
            { list: [
              '把你录的一声剪短、调低，当军鼓放在第 5、13 步。',
              '重采样的那一小节调低几个半音，每小节开头放一次：一下就有“老唱片”的味道。',
              'SYNTH 2 铺一层第 4 章做的 Pad，起音慢一点。',
            ] },
            '做完点“请啾啾点评”。',
          ],
          coach: '第 5 章的结业创作：Lo-fi 小段。学生学过：采样器 7 个采样位、换预置采样、变调（PITCH）、[REC SAMPLE] 录音、剪头尾（进阶第 4 页 START/END/LOOP）、步进输入、参数锁、重采样。点评时先肯定，再给一条具体建议（比如“把采样再调低 2 个半音”“军鼓那一声剪短一点”）。真机上采样器的格子应用读不出来，学生会自己写一句描述。',
        },
      ],
    },
  ],
};
