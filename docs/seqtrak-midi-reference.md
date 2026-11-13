# Yamaha SEQTRAK MIDI 技术参考（面向 Web MIDI 教学应用）

> 整理日期：2026-11-10
> 对应固件：**OS V2.00**（官方 Data List 封面标注 "For OS V2.00"；官方 User Guide 标注 "for OS V2.00"，页脚 ©2024 Yamaha Corporation 2026/01；官方固件页当前最新版本为 "SEQTRAK OS Updater V2.00"）。
> Data List 内的 MIDI Implementation Chart 本身标注为 "Date: 26-SEP-2023, Version: 1.0"，即该图表自首发以来未改版。
> OS V1.x 的差异没有逐项核对。固件页版本历史里与 MIDI 相关的条目：V1.10 修复 "System hang when connecting certain USB-MIDI devices"；V1.20 新增 "MIDI thru" 与 "Quantized playback to bars after project changes during external clock sync"；V2.00 修复外部 clock 同步下切换 project 后播放时机提前的问题，并新增鼓轨的 DrumKit / Synth 类型。

## 0. 阅读须知

### 0.1 可信度标记

| 标记 | 含义 |
|---|---|
| 【官方】 | 在 Yamaha Data List（PDF）或 User Guide（网页版）中直接读到 |
| 【官方-社区站】 | yamahasynth.com 上的文章（页脚为 "© Yamaha Corporation of America and Yamaha Corporation"，署名 Blake Angelos）。是 Yamaha 自己的站点，但属于介绍性文章，不是规格文档 |
| 【推断】 | 由官方表格推导，但官方没有直接写出这句话。使用前应实测 |
| 【第三方】 | 开发者逆向 / 实测 / 论坛帖。**非官方**，可能有错，使用前应实测 |
| 【未确认】 | 官方与第三方资料里都没有找到可靠答案 |

没有标记的数值一律来自【官方】Data List。本文没有任何凭印象补全的 CC 号或地址。

### 0.2 资料来源

官方：

- SEQTRAK Data List, En D0, For OS V2.00（162 页 PDF）
  https://usa.yamaha.com/files/download/other_assets/5/2226075/SEQTRAK_data_list_En_D0.pdf
  本地副本：`C:\Users\fantasy\AppData\Local\Temp\claude\383a034b6b779c6d\298fc6bd-5d1e-4031-9ad5-99be07e89593\scratchpad\datalist-dl\SEQTRAK_data_list_En_D0.pdf`
  用到的页：p.2 Track Type；p.108-110 Sound Design Parameter List；p.111-116 MIDI Data Format；p.117-161 MIDI Data Table；p.162 MIDI Implementation Chart
- SEQTRAK User Guide（网页版，En D0，OS V2.00）
  目录：https://manual.yamaha.com/mi/de/seqtrak/en/
  （实际路径是 `mi/de/seqtrak`，不是 `mi/synth/seqtrak`）
  章节 URL 形如 `https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_0NN.html`，NN = 章号（004 Projects、005 Tracks and Patterns、006 Drum Tracks、007 Synth Tracks、008 SAMPLER Track、009 Sound Design、010 Effects、015 Connections、016 Settings、018 Documentation）
- SEQTRAK OS Updater V2.00（版本历史）
  https://usa.yamaha.com/support/updates/seqtrak-os-updater.html

官方-社区站：

- "Connecting SEQTRAK"（Blake Angelos）https://yamahasynth.com/learn/seqtrak/connecting-seqtrak/

第三方（非官方）：

- jaeggerr/seqtrak-docs（协议逆向文档，MIT，读取的版本为 commit `3a4896a`，2026-11-05）
  https://github.com/jaeggerr/seqtrak-docs
  该仓库对每条结论标注了 `verified on hardware` / `from the official app, untested` 等来源；它自己也记录了两次把"实测结论"推翻的经过（Bank Select、FX 滑条），所以即便是它标了 verified 的内容，本文也只按第三方对待。
  另：该仓库的 `docs/10-verified-behaviour.md` 称 `30 4D xx`（Scale）"Absent from the Data List"，但 D0 版 Data List p.133-134 是有的（它自己的 `docs/02-sysex-format.md` 也把这个块列为 Yamaha 公布的地址），说明它内部并不完全自洽。
- epicsagas/seqtrak-agent（非官方 CLI/MCP/Web GUI）https://github.com/epicsagas/seqtrak-agent
- hfavisado/seqtrak_controller（非官方控制器 app，文档区分 documented / verified）https://github.com/hfavisado/seqtrak_controller
- Image-Line 论坛帖 "Yamaha seqtrak midi channel bug"（内容被截断，未采信）https://forum.image-line.com/viewtopic.php?p=2072932

---

## 1. MIDI 通道分配

| 轨道 | Track Group | Part 号（SysEx 地址里的 `p`） | MIDI 通道（1 起算） | 状态字节低 4 位 `n` |
|---|---|---|---|---|
| KICK | Drum | 0 | 1 | 0 |
| SNARE | Drum | 1 | 2 | 1 |
| CLAP | Drum | 2 | 3 | 2 |
| HAT 1 | Drum | 3 | 4 | 3 |
| HAT 2 | Drum | 4 | 5 | 4 |
| PERC 1 | Drum | 5 | 6 | 5 |
| PERC 2 | Drum | 6 | 7 | 6 |
| SYNTH 1 | Synth | 7 | 8 | 7 |
| SYNTH 2 | Synth | 8 | 9 | 8 |
| DX | DX | 9 | 10 | 9 |
| SAMPLER | SAMPLER | 10 (0x0A) | 11 | A |

- 【官方】通道表：Data List p.2 "Track Type"；User Guide 18.2 "MIDI Channels"。
- 【官方】收发一致，且**不能更改**：Implementation Chart 的 Basic Channel 一行为 Default `1 - 11`（Transmitted）/ `1 - 11`（Recognized），Changed `X` / `X`。
- 【官方】Part 号与通道的对应：Data List p.135 "p = Part number, 00 - 0A: Part 1 - 11 (Drum, Synth, DX, SAMPLER)"。"Part 号 = 通道号 − 1" 是把这两张表对齐得到的【推断】，第三方实测一致（`01 10 27` 读到 7 时为 SYNTH 1，音符出现在通道 8）。
- 【官方】接收模式：Mode Default 3（OMNI OFF, POLY）；可识别 Mode 3、4（m=1）。
- 【官方】OS V2.00 起鼓轨可改为 DrumKit 或 Synth 类型（User Guide 6.7），通道不变。
- 注意 DX 在通道 10、SAMPLER 在通道 11；通道 10 不是 GM 鼓通道的用法。

来源：【官方】Data List p.2、p.135、p.162；User Guide 第 6、18 章。

---

## 2. 音符

### 2.1 官方给出的通用规格

| 项目 | 发送 | 接收 |
|---|---|---|
| Note number | 0 - 127 | 0 - 127（True voice 0 - 127） |
| Note On | `9nH`, velocity 1-127 | `9nH`, velocity 1-127 |
| Note Off 的 velocity | 不发送（X） | 不识别（X，忽略） |
| Aftertouch（Key / Channel） | 不发送 | 不识别 |
| Pitch Bend | 发送（O） | 识别（O） |

Note Off 的线上格式，官方两处写法不完全一致：

- Implementation Chart：Transmitted 写 `8nH, v=0`；Recognized 写 `9nH, v=0 or 8nH`。
- MIDI Data Format：发送流程图只画了 "NOTE ON/OFF 9nH"；(3-1-2) 中把 `9nH` velocity=0 的 Note Off 标为 "Receive only"。

【推断】发送时用 `8n kk 00`。实现上请**同时**把 `8n` 和 `9n` velocity=0 当作 Note Off 处理。

音名约定：【官方】`k = 0: C-2 - 127: G8`，即 Yamaha 记法 **C3 = 60**。

### 2.2 鼓轨（Type 1: Drum）

- 【官方】没有任何一处写明各鼓轨"发出 / 响应哪个音符号"。Data List 只给出通道，以及 Project Track 的 Note Limit Low/High（`30 5p 04` / `05`，默认 0 - 127，即默认对全部音符响应）。
- 【第三方】jaeggerr/seqtrak-docs 用 SysEx 读出厂 KICK pattern 的步进数据，每个有音的步都是 `3C 64 00 3C 00 78`（note **60**、velocity **100**、retrigger 0、micro timing 60、gate 120 ticks），并称官方 app 写入步进时默认 note=60、velocity=100。epicsagas/seqtrak-agent 也用 note 60 触发通道 1-7。
- 【未确认】鼓轨经 USB **发出**的 Note On 的音符号是否就是 60（第三方只报告"音符出现在通道 1、2、3…"，没有写出音符号）；向鼓轨通道发送 60 以外的音符时音高是否变化。

### 2.3 Synth keys（SYNTH 1 / SYNTH 2 / DX，以及改为 Synth 类型的鼓轨）

【官方】7 个 Synth keys 的音高由当前 project 的 Scale 表决定。每个 project 存 8 个 scale，每个 scale 7 个 pad 音符，地址 `30 4D xx`，取值 0x24-0x60（36-96，C1 - C6）。**出厂默认值**（Data List p.133-134）：

| Scale | 地址（Pad 1-7） | 默认音符（十进制） | 十六进制 | 音程特征（【推断】官方文字未写名称，手册里是图片） |
|---|---|---|---|---|
| 1 | `30 4D 00`-`06` | 60 62 63 65 67 68 70 | 3C 3E 3F 41 43 44 46 | 自然小调 |
| 2 | `30 4D 10`-`16` | 60 62 64 65 67 69 71 | 3C 3E 40 41 43 45 47 | 大调 |
| 3 | `30 4D 20`-`26` | 60 63 65 67 70 72 75 | 3C 3F 41 43 46 48 4B | 小调五声 |
| 4 | `30 4D 30`-`36` | 60 62 64 67 69 72 74 | 3C 3E 40 43 45 48 4A | 大调五声 |
| 5 | `30 4D 40`-`46` | 60 62 64 66 67 69 71 | 3C 3E 40 42 43 45 47 | Lydian |
| 6 | `30 4D 50`-`56` | 60 62 63 65 67 69 70 | 3C 3E 3F 41 43 45 46 | Dorian |
| 7 | `30 4D 60`-`66` | 60 62 64 65 67 69 70 | 3C 3E 40 41 43 45 46 | Mixolydian |
| 8 | `30 4D 70`-`76` | 60 61 63 65 67 68 70 | 3C 3D 3F 41 43 44 46 | Phrygian |

Scale 表可被用户在 SEQTRAK app 里编辑（User Guide 7.4），所以**不能假定**一定是默认值，应用应在连接时用 Parameter Request 读回。

相关设置：

| 设置 | 地址 | 取值 | 默认 | 机器上的操作（User Guide） |
|---|---|---|---|---|
| Scale（当前用哪个 scale） | `30 40 7E` | 00-07 = Scale 1-8 | 00 | [SCALE] 键，或按住 [SCALE] 转 [ALL]（7.4） |
| Key | `30 40 7F` | 0x40-0x4B = 0 至 +11 半音 | 0x40 | [KEY] 键，或按住 [KEY] 转 [ALL]（7.5） |
| Octave（每轨） | `30 5p 0C` | 0x3E-0x42 = −2 至 +2 | 0x40 | [OCTAVE] 键，或按住 [OCTAVE] 转 [ALL]（7.3） |

- 官方两份资料对 Octave 范围写法不一致：Data List 为 −2 至 +2；User Guide 7.3 为 "+2 to −3 octaves"（固件页 V1.10 提到 "Expansion of the octave range"）。以哪一个为准【未确认】。
- 【推断】实际发出的音符 = Scale 表中该 pad 的音符 + (Key − 0x40) + 12 × (Octave − 0x40)。官方没有给出这条公式。
- 【官方】超过 G8 的音会降一个八度演奏（User Guide 7.7 NOTE）。
- 【官方】MONO/POLY/CHORD 为 CHORD 时，一个 Synth key 发出最多 4 个音，和弦音存于 `30 6p xx`（Scale 1-4）与 `30 7p xx`（Scale 5-8），仅 Part 7-9。
- 【官方】Keyboard Input mode（按住 [ALL] 按 [KEY]）下 Drum keys 变成键盘（User Guide 7.8）。此模式下各键对应的音符号【未确认】。
- 【官方】"These operations do not affect previously recorded data"：改 Octave / Scale / Key 不会改变已录入的音符。

### 2.4 SAMPLER 轨（通道 11）

- 【官方】SAMPLER 轨最多 7 个采样，每个 Synth key 对应一个（User Guide 8.1、5.7）。内部称为 Element 0-6（`50 eA xx`）。
- 【未确认】7 个采样各自对应的 MIDI 音符号。官方资料没有列出；第三方资料也没有。Data List 仅在 Bank Select 处说明"Bank MSB 62 时把通道号当作 Element 号"，那是换采样用的，不是音符映射。
- DrumKit 类型鼓轨（7 个鼓音分配到 7 个 Synth keys）的音符映射同样【未确认】。

### 2.5 力度（velocity）

- 【官方】System 参数 **Pad Velocity**，地址 `00 00 20`，范围 1-127，默认 0x64 = **100**。
- 【推断】机器上的按键没有力度感应，按键发出的 velocity 是这个固定值。官方没有直接写"按键无力度感应"。
- 【官方】对 VOLUME 做 Parameter Lock 时，改变的是该步音符的 velocity（User Guide 9.2 NOTE；Data List p.108 "Track Volume (Note Velocity*)"）。因此**音序器回放**时发出的 velocity 可以逐步不同。
- 【官方】接收的 Note On velocity 1-127 均被识别；各轨有 Velocity Limit Low/High（`30 5p 02` / `03`，DX 轨不可用）。
- 【第三方】某台实机读 `00 00 20` 得 0x64（100）。

来源：【官方】Data List p.108-110、p.113、p.123、p.125、p.133-138、p.162；User Guide 第 6、7、8、9 章。【第三方】https://github.com/jaeggerr/seqtrak-docs/blob/main/docs/04-sequencer-editing.md ，https://github.com/epicsagas/seqtrak-agent/blob/main/docs/DEVICE_UX.md

---

## 3. Control Change

### 3.1 总表

"发送 / 接收"两列来自 Data List p.113-114 的 TRANSMIT / RECEIVE 表与 p.162 Implementation Chart；"通道"一列来自 User Guide 18.3。值域两份资料不一致时两者都列出。

| CC | 参数名 | 取值 | 通道 | 适用轨道 | 发送 | 接收 |
|---|---|---|---|---|---|---|
| 0 | BANK SELECT MSB | 0-127 | 见第 4 节 | 全部 | 是（受开关） | 是（受开关） |
| 32 | BANK SELECT LSB | 0-127 | 见第 4 节 | 全部 | 是（受开关） | 是（受开关） |
| 5 | PORTAMENTO TIME | 0-127（User Guide：0=OFF） | 8-10 | Synth、DX（须为 MONO） | 是 | 是 |
| 6 / 38 | DATA ENTRY MSB / LSB | 0-127 | 1-11 | 仅配合 RPN | 否 | 是 |
| 7 | TRACK VOLUME | 0-127 | 1-11 | 鼓 / Synth / DX / Sampler | 是 | 是 |
| 10 | PAN | 0-127（User Guide：1-127） | 1-11 | 鼓 / Synth / DX / Sampler | 是 | 是 |
| 11 | EXPRESSION | 0-127 | 1-11 | 鼓 / Synth / DX / Sampler | 否 | 是 |
| 20 | EQ HIGH - GAIN | 40 = −12dB，64 = 0，88 = +12dB | 1-11 | 全部轨道 | 是 | 是 |
| 21 | EQ LOW - GAIN | 40 = −12dB，64 = 0，88 = +12dB | 1-11 | 全部轨道 | 是 | 是 |
| 23 | MUTE | 0-63 = OFF，64-127 = ON | 1-11 | 全部轨道 | **否（Receive only）** | 是 |
| 24 | SOLO | 0 = OFF，1-11 = TRACK 1-11 | 1-11 | 全部轨道 | **否（Receive only）** | 是 |
| 25 | DRUM PITCH | 40 = −24，64 = 0，88 = +24 | 1-7 | 鼓 | 是 | 是 |
| 26 | MONO/POLY/CHORD | 0 = MONO，1 = POLY，2 = CHORD | 8-10 | Synth、DX | 是 | 是 |
| 27 | ARP TEMPLATE（User Guide 称 ARP TYPE） | Data List：0-15（0 = OFF）；User Guide：0-16（0 = OFF） | 8-10 | Synth、DX | 是 | 是 |
| 28 | ARP GATE | 0 = 0%，127 = 200% | 8-10 | Synth、DX | 是 | 是 |
| 29 | ARP SPEED | 0 = 200%，3 = 100%，9 = 25%（0-9） | 8-10 | Synth、DX | 是 | 是 |
| 64 | SUSTAIN SWITCH（DAMPER PEDAL） | 0-127 | 8-11 | Synth、DX、Sampler | 否 | 是 |
| 65 | PORTAMENTO SWITCH | 0 = OFF，1 = ON | 8-10 | Synth、DX | 是 | 是 |
| 66 | SOSTENUTO | 0-63 = OFF，64-127 = ON | 8、9、11 | Synth、Sampler | 否 | 是 |
| 71 | FILTER RESONANCE | 0 = −64，64 = 0，127 = +63 | 1-11 | 全部轨道 | 是 | 是 |
| 73 | EG ATTACK TIME | 0 = −64，64 = 0，127 = +63 | 1-11 | 全部轨道 | 是 | 是 |
| 74 | FILTER CUTOFF FREQ | 0 = −64，64 = 0，127 = +63 | 1-11 | 全部轨道 | 是 | 是 |
| 75 | EG DECAY/RELEASE TIME | 0 = −64，64 = 0，127 = +63 | 1-11 | 全部轨道 | 是 | 是 |
| 91 | REVERB SEND | 0-127 | 1-11 | 全部轨道 | 是 | 是 |
| 94 | DELAY SEND | 0-127 | 1-11 | 全部轨道 | 是 | 是 |
| 96 / 97 | DATA ENTRY INC / DEC | 127 | 1-11 | 仅配合 RPN | 否 | 是 |
| 100 / 101 | RPN LSB / MSB | 见 3.4 | 1-11 | — | 否 | 是 |
| 102 | MASTER EFFECT 1 - ASSIGNED PARAMETER 1 | 0-127 | 1 | 全局 | 是 | 是 |
| 103 | MASTER EFFECT 1 - ASSIGNED PARAMETER 2 | 0-127 | 1 | 全局 | 是 | 是 |
| 104 | MASTER EFFECT 1 - ASSIGNED PARAMETER 3 | 0-127 | 1 | 全局 | 是 | 是 |
| 105 | MASTER EFFECT 2 - ASSIGNED PARAMETER 1 | 0-127 | 1 | 全局 | 是 | 是 |
| 106 | MASTER EFFECT 3 - ASSIGNED PARAMETER 1 | 0-127 | 1 | 全局 | 是 | 是 |
| 107 | SINGLE EFFECT - ASSIGNED PARAMETER 1 | 0-127 | 1-11 | 各轨 | 是 | 是 |
| 108 | SINGLE EFFECT - ASSIGNED PARAMETER 2 | 0-127 | 1-11 | 各轨 | 是 | 是 |
| 109 | SINGLE EFFECT - ASSIGNED PARAMETER 3 | 0-127 | 1-11 | 各轨 | 是 | 是 |
| 110 | SEND REVERB - ASSIGNED PARAMETER 1 | 0-127 | 1 | 全局 | 是 | 是 |
| 111 | SEND REVERB - ASSIGNED PARAMETER 2 | 0-127 | 1 | 全局 | 是 | 是 |
| 112 | SEND REVERB - ASSIGNED PARAMETER 3 | 0-127 | 1 | 全局 | 是 | 是 |
| 113 | SEND DELAY - ASSIGNED PARAMETER 1 | 0-127 | 1 | 全局 | 是 | 是 |
| 114 | SEND DELAY - ASSIGNED PARAMETER 2 | 0-127 | 1 | 全局 | 是 | 是 |
| 115 | SEND DELAY - ASSIGNED PARAMETER 3 | 0-127 | 1 | 全局 | 是 | 是 |
| 116 | FM ALGORITHM | Data List：0-11；User Guide：0-127 | 10 | DX | 是 | 是 |
| 117 | FM MODULATION AMOUNT | 0-127 | 10 | DX | 是 | 是 |
| 118 | FM MODULATOR FREQUENCY | 0-127 | 10 | DX | 是 | 是 |
| 119 | FM MODULATOR FEEDBACK | 0-127 | 10 | DX | 是 | 是 |
| 120 | ALL SOUND OFF | 0 | 1-11 | — | 否 | 是 |
| 121 | RESET ALL CONTROLLERS | 0 | 1-11 | — | 否 | 是 |
| 123 | ALL NOTE OFF | 0 | 1-11 | — | 否 | 是 |
| 124 / 125 | OMNI OFF / ON | 0 | 1-11 | 效果等同 ALL NOTES OFF | 否 | 是 |
| 126 / 127 | MONO / POLY | 0..10 | 1-11 | — | 否 | 是 |

官方资料内部的不一致（请留意）：

- CC 64：发送流程图（p.111）在发送侧列出了 "SUSTAIN SWITCH BnH,40H"，但 p.113 的 TRANSMIT 表与 p.162 Implementation Chart 都表示不发送。本表按后两者。
- CC 27、CC 116、CC 10 的值域在 Data List 与 User Guide 之间不同，见表内。
- CC 122（Local ON/OFF）不被识别（Implementation Chart：X）；Local 只能通过 System 参数 `00 00 06` 设置。

### 3.2 Sound Design 旋钮各页与 CC 的对应

【官方】各页参数来自 Data List p.108-110 "Sound Design Parameter List"；CC 号来自 User Guide 18.3.1（标题即 "Sound Design parameters"）。把两张表按参数名对齐是本文做的【推断】，官方没有一张"旋钮 → CC"的直接对照表。

| 页 | 旋钮 | 鼓（Type 1 Drum） | Synth / 鼓 Type 3 | DX | SAMPLER / 鼓 Type 2 DrumKit |
|---|---|---|---|---|---|
| 1 | 1 | SOUND SELECT → Bank Select（CC 0/32）+ Program Change | 同左 | 同左 | Element Change（见第 4 节） |
| 1 | 2 | PITCH → CC 25 | MONO/POLY/CHORD → CC 26 | CC 26 | PITCH（Element Coarse Tune；CC【未确认】） |
| 1 | 3 | PAN → CC 10 | CC 10 | CC 10 | PAN（Element Pan；是否仍为 CC 10【未确认】） |
| 1 | 4 | VOLUME → CC 7 | CC 7 | CC 7 | VOLUME（Element Level；是否仍为 CC 7【未确认】） |
| 2 | 1 | AEG ATTACK → CC 73 | CC 73 | CC 73 | CC 73 |
| 2 | 2 | AEG DECAY → CC 75 | AEG DECAY/RELEASE → CC 75 | CC 75 | CC 75 |
| 2 | 3 | LP-HP FILTER CUTOFF → CC 74 | CC 74 | CC 74 | CC 74 |
| 2 | 4 | LP-HP FILTER RESONANCE → CC 71 | CC 71 | CC 71 | CC 71 |
| 3 | 1 | REVERB SEND → CC 91 | CC 91 | CC 91 | CC 91 |
| 3 | 2 | DELAY SEND → CC 94 | CC 94 | CC 94 | CC 94 |
| 3 | 3 | EQ HIGH GAIN → CC 20 | CC 20 | CC 20 | CC 20 |
| 3 | 4 | EQ LOW GAIN → CC 21 | CC 21 | CC 21 | CC 21 |
| 4（高级） | 1 | — | PORTAMENTO TIME → CC 5（开关 CC 65） | CC 5（仅 Mono） | START POINT（无 CC） |
| 4（高级） | 2 | — | ARP TYPE → CC 27 | CC 27 | END POINT（无 CC） |
| 4（高级） | 3 | — | ARP GATE TIME → CC 28 | CC 28 | LOOP ON/OFF（无 CC） |
| 4（高级） | 4 | — | ARP SPEED → CC 29 | CC 29 | LOOP LENGTH（无 CC） |
| 5（高级） | 1-4 | — | — | FM ALGORITHM / MOD AMOUNT / MOD FREQUENCY / MOD FEEDBACK → CC 116 / 117 / 118 / 119 | PEG ATTACK LEVEL / ATTACK TIME / DECAY LEVEL / DECAY TIME（无 CC） |

"无 CC" 指官方 CC 表里没有对应条目；这些参数是否以 SysEx 形式发出【未确认】。

SAMPLER / DrumKit 一列要特别小心：这两类轨道的第 1、2 页旋钮调的是 **Element 级**参数（针对当前选中的那一个采样），第 3 页的 EQ 是 Sample 级参数（Data List p.108、p.110）。User Guide 18.3.1 说 CC 73 / 75 / 74 / 71 / 91 / 94 / 20 / 21 在 SAMPLER 轨"可用"，但旋钮转动时发出的是否就是这些 CC、接收这些 CC 时作用于哪个 Element，【未确认】。

### 3.3 效果、Mixer、Mute/Solo 与 CC

- 【官方】触摸滑条的参数分配（User Guide 10.2.4 / 10.2.5 / 11.3.3）：

  | [MASTER/SINGLE] 或模式 | FX 页 | [FX LEVEL] | [HIGH PASS] | [REPEATER] |
  |---|---|---|---|---|
  | MASTER | 1 | MASTER EFFECT PARAMETER 1 | HIGH PASS FILTER CUTOFF | BEAT REPEAT LENGTH |
  | MASTER | 2 | MASTER EFFECT PARAMETER 1 | MASTER EFFECT PARAMETER 2 | MASTER EFFECT PARAMETER 3 |
  | SINGLE | 1 | SINGLE EFFECT PARAMETER 1 | HIGH PASS FILTER CUTOFF | BEAT REPEAT LENGTH |
  | SINGLE | 2 | SINGLE EFFECT PARAMETER 1 | SINGLE EFFECT PARAMETER 2 | SINGLE EFFECT PARAMETER 3 |
  | Mixer 模式（REVERB/DELAY SEND） | 1 | SEND EFFECT PARAMETER 1 | HIGH PASS FILTER CUTOFF | BEAT REPEAT LENGTH |
  | Mixer 模式（REVERB/DELAY SEND） | 2 | SEND EFFECT PARAMETER 1 | SEND EFFECT PARAMETER 2 | SEND EFFECT PARAMETER 3 |

- 【推断】Master effect 链的顺序是 1 MASTER、2 HIGH PASS、3 REPEATER、4 COMPRESSOR、5 5 BAND EQ（User Guide 10.1.3），Data List 的 "Master Effect 1-4" 地址块为 `30 43`-`30 46`。因此 CC 102-104 = MASTER 效果的 3 个分配参数；CC 105 = HIGH PASS 块的分配参数（页 1 的 [HIGH PASS] 滑条）；CC 106 = REPEATER 块的分配参数（页 1 的 [REPEATER] 滑条）；CC 107-109 = SINGLE 效果；CC 110-112 / 113-115 = Send Reverb / Send Delay。
  【第三方】实测与此一致：[HIGH PASS]、[REPEATER] 滑条在通道 1 发出 CC 105 / CC 106；SINGLE 的 [FX LEVEL] 在该轨通道发出 CC 107。
- 【官方-社区站】"The FX LEVEL, HIGH PASS and REPEATER movements are recorded as MIDI controller data."
- 【官方】Mixer 模式下 Track knobs 调的是 PAN / VOLUME / REVERB SEND / DELAY SEND（User Guide 11.2）。【推断】对应 CC 10 / 7 / 91 / 94，在各轨通道上。
- 【官方】MUTE（CC 23）与 SOLO（CC 24）是 **receive only**：机器上操作 mute/solo 时不会发出这两个 CC（User Guide 18.3.3 NOTE；Data List p.114）。
- 【官方】音量键 [VOL+]/[VOL−] 调的是 Speaker / Headphone Master Volume（System 参数 `00 00 00` / `00 00 01`），没有对应 CC。

### 3.4 RPN（仅接收）

| RPN LSB / MSB | 参数 | 数据范围 |
|---|---|---|
| 00 / 00 | PITCH BEND SENSITIVITY | Data Entry MSB 0x00-0x18（0-24 半音） |
| 01 / 00 | MASTER FINE TUNE | {MSB, LSB} = {00,00} - {40,00} - {7F,7F} |
| 02 / 00 | MASTER COARSE TUNE | 0x28 - 0x40 - 0x58（−24 至 +24 半音） |
| 7F / 7F | RPN RESET | — |

### 3.5 CC 的收发开关（重要）

发送侧（Data List p.111 发送流程 + p.123 System 参数）：

| 开关 | USB 对应地址 | 官方默认值 | 作用 |
|---|---|---|---|
| USB MIDI In/Out | `00 00 0D` | 01（On） | 该接口的全部收发 |
| USB MIDI Transmit Channel Message | `00 00 0E` | 01（On） | 音符、CC、PC、弯音的发送总开关 |
| USB MIDI Transmit Control Change / Bank Select / Program Change | `00 00 0F` | **00（三项全关）** | bit 6 = CC，bit 5 = Bank Select，bit 4 = Program Change；全开为 0x70 |
| USB MIDI Transmit System Exclusive Message | `00 00 10` | **00（Off）** | SysEx（Bulk Dump、Parameter Change）的发送 |
| Receive/Transmit Bank Select | `00 00 07` | 01（On） | Bank Select 收与发 |
| Receive/Transmit Program Change | `00 00 08` | 01（On） | Program Change 收与发 |

- 按官方默认值，**出厂状态下转动旋钮不会经 USB 发出 CC，也不会发出 SysEx**（音符会发）。
- 【第三方】jaeggerr 在两台用过的实机上读到 `00 00 0F` = 0x70、`00 00 10` = 01，与官方默认值不符。原因不明（可能是连接过官方 app 后被改写，也可能是文档默认值与实际不同）。**应用启动时应先读这两个地址，不要假定。**
- 接收侧：CC 的接收只受 In/Out 总开关控制；Bank Select 与 Program Change 的接收各有上表的开关。

来源：【官方】Data List p.108-114、p.123、p.162；User Guide 第 9、10、11、18.3 章。【官方-社区站】https://yamahasynth.com/learn/seqtrak/connecting-seqtrak/ 。【第三方】https://github.com/jaeggerr/seqtrak-docs/blob/main/docs/10-verified-behaviour.md ，https://github.com/jaeggerr/seqtrak-docs/blob/main/docs/05-live-state.md

---

## 4. Program Change / Bank Select

【官方】可以通过 MIDI 切换音色，也可以切换 project。规则（Data List p.113、p.117-118）：

| Bank MSB | Bank LSB | Program | 对象 | 备注 |
|---|---|---|---|---|
| 64 (0x40) | 0 | 0-7 | Project 1-8 | **忽略通道号**。p.117 的表写 0-8，并注明 Program 8 = Temporary Project |
| 63 (0x3F) | 0-31 | 0-127 | Drum / Synth / DX Sound，Preset 1-32 | 在目标轨道的通道上发送 |
| 63 (0x3F) | 32-47 | 0-127 | Drum / Synth / DX Sound，User 1-16 | 同上 |
| 62 (0x3E) | 0-3 | 0-127 | Sampler Element，Preset 1-4 | **把通道号当作 Element 号** |
| 62 (0x3E) | 4-11 | 0-127 | Sampler Element，User 1-8 | 同上；Program 72-127 保留给采样功能（各 project 的 Element 1-7 临时区） |
| 32-38 (0x2p) | 0-31 / 32-47 | 0-127 | DrumKit Sound，Preset 1-32 / User 1-16 | p = Part 号 0-6（Kick = 0 … Perc2 = 6）；把通道号当作 Element 号 |

- 【官方】"Bank Select will be actually executed when the Program Change message is received." 发送顺序：CC 0 → CC 32 → Program Change。
- 【官方】不支持的 Bank / Program 编号会被忽略。
- 【官方】Program Change 的收发受开关控制（Implementation Chart `*3 If switch is on`），见 3.5。
- 音色编号规则：
  - 【官方】Sound List 把 Drum（No. 1-855）、Synth（856-1932）、DX（1933-2032）连续编号；SAMPLER Sound 另行从 1 编号（共 392）。Sound List 本身**没有**列出每个音色的 Bank / Program。
  - 【推断 + 第三方】`Bank LSB = (No. − 1) ÷ 128 取整`，`Program = (No. − 1) mod 128`。第三方称用 10 个预设在实机上验证过（先发 Bank + PC，再读回当前音色编号）；例：Synth No. 858 "Acid3" → 通道 8 上 `B7 00 3F`、`B7 20 06`、`C7 59`。
  - 【未确认】"Bank MSB 62 把通道号当作 Element 号"的确切线上用法。第三方试过两种通道均未能加载预设 Sampler Element。
- 【第三方】在机器上转 SOUND SELECT 旋钮时，机器在该轨通道上发出 CC 0 = 63、CC 32、Program Change 三连，每换一个音色发一次。
- 【第三方】发 `Bn 00 40`、`Bn 20 00`、`Cn 07` 可切换到 project 8，并可用 `01 10 15`（第三方地址）读回确认。

来源：【官方】Data List p.3-33、p.113-114、p.117-118、p.162。【第三方】https://github.com/jaeggerr/seqtrak-docs/blob/main/docs/06-sounds-presets.md

---

## 5. 实时消息（Clock / Start / Stop / Continue）

### 5.1 收发行为（官方）

| 消息 | 发送 | 接收 |
|---|---|---|
| Timing Clock `F8` | 是，条件：Midi Clock Out 为 On **且** SEQTRAK 使用内部时钟 | 是，条件：Midi Sync 为 "MIDI(Auto)" |
| Start `FA` | 是，条件：Transmit Sequencer Control 为 On | 是（接收流程里没有开关） |
| Stop `FC` | 是，条件：Transmit Sequencer Control 为 On | 是 |
| Continue `FB` | **不在发送流程中** | 是 |
| Active Sensing `FE` | 是，每 250 ms 一次，不受开关控制 | 是 |
| Song Position `F2` / Song Select `F3` / Tune `F6` | 否 | 否 |
| System Reset `FF` | 否 | 否 |

Active Sensing 的超时逻辑（约 500 ms 无数据则清缓冲并强制止音）官方只针对 legacy MIDI 接口描述；USB 上是否同样生效【未确认】。

### 5.2 相关设置项（System 参数，Data List p.123）

| 参数 | 地址 | 取值 | 默认 |
|---|---|---|---|
| Midi Sync | `00 00 2A` | 00 = Internal，01 = MIDI(Auto) | 01 |
| Transmit Sequencer Control | `00 00 2B` | 00 = Off，01 = On | 01 |
| Midi Clock Out | `00 00 2D` | 00 = Off，01 = On | 01 |
| Legacy MIDI Thru | `00 00 22` | 0 Off / 1 Channel / 2 Realtime / 3 Both | 00 |
| USB To Host MIDI Thru | `00 00 23` | 同上 | **03（Both）** |
| Bluetooth MIDI Thru | `00 00 24` | 同上 | 03 |

### 5.3 怎么切换这些设置

- 【官方】User Guide 16.3：MIDI clock、MIDI output filters、MIDI Thru 都写的是 "You can use the SEQTRAK app to set …"。手册里**没有**给出在机器面板上切换这些设置的按键组合。
- 【推断】也可以由电脑发 SysEx Parameter Change 直接写上表地址（这些地址就列在 Data List 的 Parameter Change Table 里）。这会改变用户机器的全局设置，建议先读后写并提供恢复。
- 【官方】面板上与外部时钟有关的唯一操作：按住 [PROJECT↑] 按 [PAGE]，开关"外部 MIDI clock 同步期间的 project 切换行为"，默认开，开时 Global Meter 亮白色（User Guide 4.1.1）。

### 5.4 作为从机跟随外部 clock

- 【官方】Midi Sync = MIDI(Auto) 时识别外部 `F8`。"Auto" 的具体判定（何时用外部、何时回到内部）官方没有解释。【推断】收到外部 clock 时跟随，否则用内部时钟。
- 【官方】跟随外部 clock 时，SEQTRAK 自己不再发 `F8`（Implementation Chart `*4`：仅在使用内部时钟时发送）。
- 【官方】同步外部 clock 期间切换 project：当前 project 播到小节末（16 步）停止，载入目标 project 并进入播放待机；MANUAL PLAYBACK 模式（默认）下按 [PLAY] 后在下一个 2 小节（32 步）边界开始；AUTO PLAYBACK 模式下按 Launch Quantize 自动在小节头开始（不足 2 小节按 2 小节）。两种模式在 SEQTRAK app 里切换（User Guide 4.1.1）。
- 【未确认】从机状态下是否必须收到 `FA` 才开始播放、只收到 `F8` 不收 `FA` 时的表现、外部 tempo 超出 5-300 BPM 时的表现、停止外部 clock 后多久回到内部时钟。

### 5.5 第三方实测补充（非官方）

- 主机发 `FA` / `FC` 可以启动 / 停止音序器；机器随后主动广播 SysEx `01 10 20` = 01 / 00。
- 在机器上按 [PLAY]：发出 `FA` / `FC`，并广播 SysEx `01 10 20`。
- Midi Clock Out 开着时，**音序器停止状态下机器也持续发 `F8`**（90 秒内 4396 个，对应 122 BPM），24 PPQN，6 个 clock = 1 个 16 分音符步。所以不能用"有没有 clock"判断是否在播放，要看 `FA`/`FC` 或 `01 10 20`。
- 未观察到机器发 `F2`（Song Position）。
- 另一处记录称 USB host 方向"FA / FB / FC 都收到过"，与官方发送流程里没有 `FB` 矛盾，【未确认】。

来源：【官方】Data List p.111-112、p.115、p.123、p.162；User Guide 4.1.1、16.3；固件页。【第三方】https://github.com/jaeggerr/seqtrak-docs/blob/main/docs/10-verified-behaviour.md

---

## 6. System Exclusive

### 6.1 报文格式（官方，Data List p.115-116、p.121）

| 常量 | 值 |
|---|---|
| YAMAHA ID | `43` |
| Group ID High / Low | `7F` / `1C` |
| Model ID | `0C` |
| Device Number | 状态字节低 4 位 `n`；官方未规定取值 |

| 报文 | 格式 | 方向 |
|---|---|---|
| Parameter Change | `F0 43 1n 7F 1C 0C ah am al dd … F7` | 收、发 |
| Parameter Request | `F0 43 3n 7F 1C 0C ah am al F7` | 仅接收（机器以同地址的 Parameter Change 应答，【推断】） |
| Dump Request（Bulk Request） | `F0 43 2n 7F 1C 0C ah am al F7` | 仅接收 |
| Bulk Dump | `F0 43 0n 7F 1C bh bl 0C ah am al dd … cc F7` | 收、发 |
| Identity Request | `F0 7E 0n 06 01 F7`（n 被忽略） | 仅接收 |
| Identity Reply | `F0 7E 7F 06 02 43 00 41 64 06 mm 00 00 7F F7` | 仅发送 |

- Identity Reply：`64 06` 是 SEQTRAK 的 Device family number / code；`mm = (版本号 − 1.0) × 10`（V1.0 → 0，V1.5 → 5）。【第三方】V2.00 实机返回 `mm = 0A`。
- "For parameters with data size of 2 or more, the appropriate number of data bytes will be transmitted."
- Bulk Dump 的 Byte Count："从 Model ID 起到校验和之前的数据字节数"（即 4 + 数据长度）。
- Bulk Dump 的 Check-sum：官方原文是"Byte Count、Start Address、Data 与 Check-sum 相加后低 7 位为 0"。【第三方】称按字面算不对，实际范围是 Model ID + 地址 + 数据（不含 Byte Count）。两种说法并存，【未确认】，做 Bulk 前须实测。
- 【第三方】官方 app 发送时 n = 0，机器不校验 n；解析时比较 `byte2 & 0xF0`。
- 多字节数值的两种编码（按 Description 列区分）：
  - 7 位一组，高位在前："1st bit6-0 → bit13-7, 2nd bit6-0 → bit6-0"（Tempo、Swing、Pattern Step 等）。
  - 4 位一组："1st bit3-0 → bit15-12 …"（Master Tune、Detune）。
- 名称字段（Project Name、Sound Name）为 "UTF8 (7-bit encoded)"。
- 发送开关：SysEx 的发送受 `USB MIDI Transmit System Exclusive Message`（`00 00 10`，默认 Off）控制；官方注明 "SYSTEM Legacy/USB MIDI In/Out" 与 "SYSTEM Sink Current Setting" 这两个 SysEx 不受 In/Out 与 Transmit SysEx 开关影响。
- 【未确认】Transmit SysEx 为 Off 时，机器是否仍会应答 Parameter Request。第三方的读取都是在该开关为 On 的机器上做的。

### 6.2 地址表概要（官方，Data List p.119）

| 参数块 | 起始地址（H M L） | 说明 |
|---|---|---|
| System | `00 00 00` | General（48 字节） |
| System | `00 7F 00` | Format Version |
| Bulk Control | `11 mm nn` / `12 mm nn` | Bulk Header / Footer |
| Project Common | `30 40 00` | General（128 字节：Project Name、Tempo、Swing、Scale、Key、Solo 等） |
| Project Common | `30 41 00` / `30 42 00` | Send Reverb / Send Delay |
| Project Common | `30 43 00` - `30 46 00` | Master Effect 1-4 |
| Project Common | `30 47 00` | Master EQ |
| Project Common | `30 49 00` / `30 4A 00` / `30 4B 00` | A/D Part Insertion A / B / General |
| Project Common | `30 4C 00` | USB Audio Input |
| Project Common | `30 4D 00` | Scale |
| Project Track | `30 5p 00` | General，p = Part 0-10 |
| Project Track | `30 6p 00` / `30 7p 00` | Chord Notes of Scale 1-4 / 5-8，p = 7-9 |
| Sound Common | `31 0p 00` / `31 1p 00` | Name / General，p = 0-10 |
| Sound Common | `31 2p 00` / `31 3p 00` | Insertion A / B |
| Sound Common | `31 4p 00` / `31 5p 00` | LFO（p = 0-8、10）/ Arpeggiator（p = 7-9） |
| Sound Drum/Synth/SAMPLER | `41 ep 00` / `42 ep 00` | Oscillator·Amplitude·Pitch / Filter·EQ·LFO，e = Element 0-7 |
| Sound DX | `48 09 00` / `49 o9 00` | Common / Operator（o = 0-3） |
| SAMPLER Sample | `50 eA 00` | General，e = Element 0-6 |

Bulk Header / Footer 的 `mm nn`（Data List p.122）：

| mm | 对象 | nn |
|---|---|---|
| 00 | Project Edit Buffer | 0 |
| 01 | Project User 1 | 0-7 |
| 02 | Sound Edit Buffer，Part nn | 0-10 |
| 03-12 | Sound User 1-16 | 0-127 |
| 13 | Sampler Element Edit Buffer，Element nn | 0-6 |
| 14-1B | Sampler Element User 1-8 | 0-127 |

请求一个完整的 PROJECT / SOUND / SAMPLER ELEMENT：对它的 Bulk Header 地址发 Dump Request。Header 与 Footer 之间的块顺序不限、可缺省；夹带无关块则不被接收。

### 6.3 最可能用到的参数

除非另注，均为【官方】Data List 地址，可用 Parameter Change 写、Parameter Request 读。`p` = Part 号 0-A。

| 用途 | 地址 | 字节数 | 取值 | 默认 | 说明 |
|---|---|---|---|---|---|
| **Tempo** | `30 40 76` | 2 | 5 - 300；MSB 00-02，LSB 00-7F；value = MSB×128 + LSB | `00 78`（120） | 例：120 BPM = `00 78`；140 = `01 0C`；300 = `02 2C` |
| **Swing Offset** | `30 40 7C` | 2 | −58 至 +58（ticks；1 步 = 120 ticks） | `01 00` | 【推断】线上值 = 128 + 偏移（默认 `01 00` = 128 对应 0）。【第三方】实测可写范围 70-186 |
| Pattern Master Step | `30 40 7A` | 2 | 1 - 128 | `00 10`（16） | |
| Pattern Select Mode | `30 40 79` | 1 | 0 = normal，1 = advanced | 00 | 【第三方】为 0 时 Pattern Select 只能到 0-2；为 1 时才能到 3-5（对应机器上"3 patterns / 6 patterns"） |
| **Scale** | `30 40 7E` | 1 | 00-07 = Scale 1-8 | 00 | |
| **Key** | `30 40 7F` | 1 | 0x40-0x4B = 0 至 +11 | 0x40 | |
| Scale 各 pad 音符 | `30 4D xx` | 1 | 0x24-0x60 | 见 2.3 | xx = (scale−1)×0x10 + (pad−1) |
| **Solo Track** | `30 40 68` | 1 | 00 = Off，01-0B = Track 1-11 | 00 | 也可用 CC 24 |
| Project Volume | `30 40 66` | 1 | 0-127 | 0x7F | Mixer 模式下 [ALL] 调的 project 音量 |
| Project Pan | `30 40 65` | 1 | 0x01-0x7F（L63…C…R63） | 0x40 | |
| Sampler Element Mute | `30 40 63` | 1 | bit6-0 = element 7-1 mute | 00 | |
| ARP Synchro Quantize Value | `30 40 75` | 1 | 05（240） | 05 | |
| **各轨当前 Pattern** | `30 5p 0F` | 1 | 00-05 = Pattern 1-6 | 00 | 见上 Pattern Select Mode |
| 各轨 Pattern 1-6 长度（步） | `30 5p 16` / `18` / `1A` / `1C` / `1E` / `20` | 各 2 | 1 - 128 | `00 10` | |
| **各轨 Mute** | `30 5p 29` | 1 | 00 = off，0x7D（125）= on | 00 | 也可用 CC 23。注意 on 的值是 0x7D，不是 0x7F |
| 各轨 Volume | `30 5p 00` | 1 | 0-127 | 0x64 | 与 Sound 的 Volume（`31 1p 14`）是两个不同参数 |
| 各轨 Pan | `30 5p 01` | 1 | 0x01-0x7F | 0x40 | |
| 各轨 Octave | `30 5p 0C` | 1 | 0x3E-0x42 = −2 至 +2 | 0x40 | 鼓 / SAMPLER 轨不可用 |
| 各轨 Note Limit Low / High | `30 5p 04` / `05` | 1 | 0-127 | 00 / 7F | DX 轨不可用 |
| 各轨 Velocity Limit Low / High | `30 5p 02` / `03` | 1 | 1-127 | 01 / 7F | DX 轨不可用 |
| **Speaker Master Volume** | `00 00 00` | 1 | 0-127 | 0x64 | 对应 [VOL+]/[VOL−]（扬声器） |
| **Headphone Master Volume** | `00 00 01` | 1 | 0-127 | 0x20 | 对应 [VOL+]/[VOL−]（耳机） |
| Local Switch | `00 00 06` | 1 | 0 = Off，1 = On | 01 | 官方未解释具体行为 |
| Pad Velocity | `00 00 20` | 1 | 1-127 | 0x64 | |
| Record Quantize Value | `00 00 1F` | 1 | 0-5 = Off, 60, 80, 120, 160, 240（ticks） | 03 | |
| Click Switch / Type / Volume | `00 00 25` / `26` / `27` | 1 | Off·On / 1-10 / 0-127 | 00 / 00 / 0x40 | 节拍器 |
| Sound Design Mode | `00 00 21` | 1 | 0 = Normal，1 = Advanced | 00 | |
| USB Role | `00 00 17` | 1 | 0 = To Host，1 = To Device | 00 | |
| Midi Sync / Seq Control / Clock Out | `00 00 2A` / `2B` / `2D` | 1 | 见 5.2 | 01 / 01 / 01 | |

官方 Data List 里**没有**的项目（以下均为【第三方】，地址来自对官方 app 的分析与抓包，jaeggerr/seqtrak-docs `docs/05-live-state.md`；全部属于 `01 xx xx` 区）：

| 用途 | 第三方地址 | 取值 | 第三方给出的验证程度 |
|---|---|---|---|
| **当前选中的轨道**（CurrentPart） | `01 10 27` | 0-10 | 可读；换轨时机器主动广播。写入能否远程选轨：未测试 |
| **播放状态**（SequencerStatus） | `01 10 20` | 0 = 停止，1 = 播放 | 可读；播放 / 停止时主动广播 |
| 录音状态（RecordingStatus） | `01 10 21` | 0-1 | 未测试 |
| **当前 project**（CurrentProject） | `01 10 15` | 0-7 | 可读。切换 project 请用官方的 Bank MSB 64 + PC |
| 固件版本 | `01 00 00` | 4 字节 | V2.00 实机读到 `02 00 00 02` |
| 电量 | `01 10 02` | 0-100 | 可读 |
| 各轨当前音色编号 | `01 1p 33` | 2 字节 = Sound List 编号 − 1 | 可读（SAMPLER 轨无应答） |
| Sound Design 当前页 | `01 1p 30` | 0-5 | 可读 |
| 面板 LED 模式（ParameterLedMode） | `01 10 2E` | 0-43，含义未完全解出 | 换音色、动旋钮、按 FX 页键时广播 |
| 步进数据读 / 写（仅 Drum 类型鼓轨） | `70 (4x\|p) ss` 读；`70 0p 00` 写 | 见该仓库 `docs/04-sequencer-editing.md` | 称在实机上完成了写入-读回-删除 |

`01 xx xx` 区里还有 FactoryReset（`01 34 00`）、RemoveProject（`01 40 00`）等破坏性地址，第三方文档自己也提醒不要试探性发送。**本项目不应向 `01` 区写入任何未经自己验证的地址。**

### 6.4 报文示例

按 6.1 的官方格式和 6.3 的官方地址拼出（n = 0）。除标注者外未经本文作者实测。

```
读 Tempo                    F0 43 30 7F 1C 0C 30 40 76 F7
设 Tempo = 120              F0 43 10 7F 1C 0C 30 40 76 00 78 F7      （第三方称实机验证过同类写入）
设 Scale = Scale 2          F0 43 10 7F 1C 0C 30 40 7E 01 F7
设 Key = +2                 F0 43 10 7F 1C 0C 30 40 7F 42 F7
SYNTH 1 选 Pattern 3        F0 43 10 7F 1C 0C 30 57 0F 02 F7
Mute SNARE                  F0 43 10 7F 1C 0C 30 51 29 7D F7
Unmute SNARE                F0 43 10 7F 1C 0C 30 51 29 00 F7
Solo Track 8 (SYNTH 1)      F0 43 10 7F 1C 0C 30 40 68 08 F7
取消 Solo                   F0 43 10 7F 1C 0C 30 40 68 00 F7
设扬声器音量 = 80           F0 43 10 7F 1C 0C 00 00 00 50 F7
打开 USB 的 CC/BS/PC 发送   F0 43 10 7F 1C 0C 00 00 0F 70 F7
打开 USB 的 SysEx 发送      F0 43 10 7F 1C 0C 00 00 10 01 F7
请求当前 Project 整体 Dump  F0 43 20 7F 1C 0C 11 00 00 F7
Identity Request            F0 7E 00 06 01 F7
```

来源：【官方】Data List p.111-112、p.115-125、p.133-135。【第三方】https://github.com/jaeggerr/seqtrak-docs/blob/main/docs/02-sysex-format.md ，https://github.com/jaeggerr/seqtrak-docs/blob/main/docs/05-live-state.md ，https://github.com/jaeggerr/seqtrak-docs/blob/main/docs/04-sequencer-editing.md ，https://github.com/jaeggerr/seqtrak-docs/blob/main/data/hardware-verified.csv

---

## 7. USB、USB 音频与蓝牙

### 7.1 USB MIDI

- 【官方】接口："USB Type-C (power, MIDI to host, MIDI to device, audio)"（User Guide 18.1）。USB Role 可在 To Host（SEQTRAK 作 USB 设备，接电脑）与 To Device（SEQTRAK 作 USB 主机，接 class-compliant MIDI 设备，可供电最多 500 mA）之间切换，System 参数 `00 00 17`，默认 To Host。
- 【未确认】**电脑上看到几个 MIDI 端口、端口叫什么名字**。官方 Data List 与 User Guide 都没有写。
  - 【第三方】macOS 的 CoreMIDI 端口名为 `SEQTRAK`，一进一出；几个第三方实现都用"端口名包含 SEQTRAK"来匹配。
  - Windows（装或不装 Yamaha Steinberg USB Driver）下的端口名与数量：没有找到任何资料。
- 驱动：
  - 【官方】Windows：先安装 **Yamaha Steinberg USB Driver**，再用附带的 USB-C to USB-C 线连接（User Guide 15.3.1）。
  - 【官方】Mac：直接用线连接，手册没有要求装驱动（User Guide 15.3.2）。
  - 【官方-社区站】yamahasynth.com 的文章写的是 "To connect SEQTRAK to Mac or PC you'll need the Yamaha Steinberg USB Driver"，与 User Guide 对 Mac 的说法不一致。
  - 【官方】iOS / Android：用线直连（Lightning 机型需 Apple Lightning to USB 3 Camera Adapter）。
  - 【未确认】Windows 不装驱动时，系统自带的 USB MIDI class 驱动能否识别出 MIDI 端口（即 MIDI 部分是否 class-compliant）。SEQTRAK 能直连 iOS/Android 说明它大概率是 class-compliant，但这是推断。
- 【官方】用 USB-A 口的电脑时需自备 USB-A to USB-C 线，"不保证与所有电脑稳定连接"；电脑供电上限 500 mA，可能耗电快于充电。拔线后至少等 6 秒再插（User Guide 第 2 章 NOTICE）。
- 【官方】MIDI Thru：USB 默认 ON（Channel + System Realtime）；"When USB is selected as the MIDI Thru output destination, MIDI Thru is available only when connected to a computer or the SEQTRAK app"；琶音器触发音符、静音轨道的音符不经 Thru 输出（User Guide 16.3.3）。
- 【未确认，需重点留意】电脑从 USB 发给 SEQTRAK 的音符，是否会被 USB Thru **原样回送**到电脑的输入口。如果会，应用自己发出的示范音符会被误判为用户演奏。见第 10 节测试 T9。
- 【第三方】单个 Parameter Request 偶尔丢应答（一次测得约 1/10，另一次 40/40 无丢失）；官方 app 每条报文后等待 2 ms。

### 7.2 USB 音频

【官方】User Guide 18.1：

| 项目 | 规格 |
|---|---|
| 功能 | USB Audio Interface |
| 采样率 | 44.1 kHz |
| 量化位深 | 24-bit |
| 输入 | 2 通道（1 组立体声） |
| 输出 | 2 通道（1 组立体声） |

- 【官方】相关参数：USB Audio Output Gain `00 00 15`（−6 / 0 / +6 / +12 dB，默认 −6 dB）；USB Audio Input 部分 `30 4C xx`（Volume、Pan、Reverb/Variation Send、Dry Level、Output Select）；Sampling Source `00 00 19` 可选 USB Audio In。
- 【官方】"On Android devices, the USB audio interface function might not work properly when using an app other than the SEQTRAK app."
- 是否免驱：同 7.1。Mac 按 User Guide 免驱；Windows 官方要求装 Yamaha Steinberg USB Driver；Windows 不装驱动时音频能否工作【未确认】。
- 【未确认】"输入 / 输出"是以电脑还是以 SEQTRAK 为参照；USB 音频输出的内容是否就是主输出混音。

### 7.3 蓝牙 MIDI

- 【官方】Bluetooth 功能："MIDI transmission/reception (wireless capability varies by country)"。
- 【官方】**"Bluetooth and Wi-Fi are not supported for Windows."**（User Guide 18.1 NOTICE；15.1 也写明 Windows 版 SEQTRAK app 不支持无线功能）。在 Windows 的 Chrome 里用 Web Bluetooth / 系统 BLE-MIDI 能否连上【未确认】，按官方口径应视为不支持。
- 【官方】进入蓝牙等待：按住 [ALL] 按 [SWING]，Global Meter 亮白 2 秒，之后等待 30 秒；设备名为 `SEQTRAK_` 加 6 位设备专属字符；已连接时同一操作会让 Global Meter 亮青色 2 秒（User Guide 15.1.2）。
- 【官方】蓝牙侧的 System 参数默认值：Bluetooth MIDI In/Out `00 00 11` = 00（Off）；Transmit Channel Message `00 00 12` = 01；Transmit CC/BS/PC `00 00 13` = 00；Transmit SysEx `00 00 14` = 00；Bluetooth MIDI Thru `00 00 24` = 03。
- 【官方】Wi-Fi 只用于与官方 app 之间的数据传输（2.4 GHz），不是 MIDI 通道。
- 【第三方】使用标准 BLE-MIDI 服务（Service UUID `03B80E5A-EDE8-4B33-A751-6CE34EC4C700`）；同一时间只允许一个 BLE central；`00 00 11` 读到 00 的机器实际上也能跑蓝牙 MIDI，该参数的真实含义存疑。
- 【未确认】蓝牙 MIDI 的延迟与抖动。官方没有给数字。做节奏判定建议只用 USB。

来源：【官方】User Guide 第 2、15、16、18.1 章；Data List p.123、p.132。【官方-社区站】https://yamahasynth.com/learn/seqtrak/connecting-seqtrak/ 。【第三方】https://github.com/jaeggerr/seqtrak-docs/blob/main/docs/07-transports.md ，https://github.com/epicsagas/seqtrak-agent/blob/main/src/midi.rs

---

## 8. 七个问题的明确回答

### a. 按 Drum keys 触发声音或录入步进时，是否经 USB 发出 note on？两种用法有何不同？

**结论：未确认。**

- 【官方】先澄清操作模型：在鼓轨上，Drum keys 的功能是"开 / 关步"（User Guide 6.1），手册没有说按 Drum key 会发声。鼓轨的**实时演奏**用的是 Synth keys：按住某个鼓轨旋钮再按一个 Synth key 进入 Real-time Input mode，之后 "the Synth keys can be used to play Drum tracks in real time"（6.5）。另外，停止状态下按 Track knob 会试听该轨音色（5.6）。
- 【官方】Data List 只说明 Note On 会在通道 1-11 上发送、受 Transmit Channel Message 开关控制，**没有区分音符的来源**（按键、试听、音序器回放）。
- 步进编辑（按 Drum key 开 / 关步）：官方没有说明会发任何消息。【第三方】jaeggerr 的逐手势监听表里没有"开关步"对应的消息记录，但它也没有专门测这一项，不能当作"不发"的证据。合理预期是：**开关步本身不发 Note On，音符只在音序器播放到该步时发出**（见 c），这是【推断】。
- 实时演奏（Real-time Input mode 下按 Synth keys）：官方没有逐字说明；【第三方】笼统记录为"Pads and sequencer notes: Note On/Off on the track's channel"。7 个 Synth keys 各对应哪条鼓轨、发在哪个通道、音符号多少，【未确认】（【推断】发在对应鼓轨的通道 1-7 上）。
- 试听（停止时按 Track knob）：【第三方】换轨时会伴随一个该轨通道上的音符，以及 SysEx `01 10 27`。
- Synth / SAMPLER 轨在 Step Input mode 下按 Drum key 开关步是否发消息：【未确认】。

来源：【官方】User Guide 5.6、6.1、6.5；Data List p.111、p.162。【第三方】https://github.com/jaeggerr/seqtrak-docs/blob/main/docs/10-verified-behaviour.md

### b. 按 Synth keys 演奏时是否发出 note on/off？在哪个通道？

**结论：是。通道 = 当前选中轨道的通道（SYNTH 1 = 8，SYNTH 2 = 9，DX = 10，SAMPLER = 11；改成 Synth 类型的鼓轨 = 1-7）。**

- 【官方】Implementation Chart：Note ON Transmitted = O（`9nH`, v=1-127），Basic Channel 1-11；发送流程图里 NOTE ON/OFF 只受 In/Out 与 Transmit Channel Message 两个开关控制，两者 USB 默认都是 On。官方没有逐字写"按 Synth key 会发 Note On"，但发送流程与 Local Switch 参数的存在都指向这一点。
- 【第三方】实测：选中 SYNTH 2 时音符出现在通道 9，选中 SYNTH 1 时出现在通道 8。
- 音符号见 2.3，velocity 见 2.5，Note Off 的线上格式见 2.1。CHORD 模式下一个键发多个音。

来源：【官方】Data List p.2、p.111、p.162。【第三方】https://github.com/jaeggerr/seqtrak-docs/blob/main/docs/10-verified-behaviour.md

### c. 内置音序器播放时，是否把各轨音符从 USB 发出？有没有开关？

**结论：是；有开关。**

- 【官方-社区站】"You can record MIDI Tracks generated by SEQTRAK playback into a DAW."
- 【官方】发送流程：NOTE ON/OFF 受 [SW1] `USB MIDI In/Out`（`00 00 0D`，默认 On）与 [SW2] `USB MIDI Transmit Channel Message`（`00 00 0E`，默认 On）控制。User Guide 16.3.2："The output of a variety of MIDI data from SEQTRAK can be selectively turned on and off. You can use the SEQTRAK app to set MIDI output filters."
- 【官方】另有 System 参数 `Local Switch`（`00 00 06`，默认 On）。官方没有解释它的作用范围；CC 122（Local ON/OFF）不被识别。
- 【第三方】实测：播放时各轨音符出现在各自通道（1、2、4、5、7、9、10 等）。
- 【未确认】被 mute 的轨道，其音序器音符是否仍然发出（官方只说静音轨道的音符不经 **Thru** 输出）；琶音器生成的音符是否发出；Local Switch 设为 Off 时的行为。

来源：【官方】Data List p.111、p.123；User Guide 16.3。【官方-社区站】https://yamahasynth.com/learn/seqtrak/connecting-seqtrak/

### d. 转动 Track knobs、Sound Design knobs、触摸滑条时是否发出 CC 或 SysEx？

**结论：Sound Design 旋钮与触摸滑条——是（发 CC，前提是 USB 的 CC 发送开关打开；官方默认是关）。Track knobs——官方没有对应 CC，未确认；第三方实测发 SysEx。**

- 【官方】Sound Design 参数与效果参数的 CC 见第 3 节，Implementation Chart 标为 Transmitted = O。
- 【官方】但 `USB MIDI Transmit Control Change / Bank Select / Program Change`（`00 00 0F`）默认 00，`USB MIDI Transmit System Exclusive`（`00 00 10`）默认 Off。按官方默认值，出厂状态下这些操作在 USB 上**什么都不发**。（第三方在实机上读到的是已开启，见 3.5。）
- 【官方-社区站】FX LEVEL、HIGH PASS、REPEATER 的滑动会被记录为 MIDI controller data。
- Track knobs：【官方】转动 = 切换该轨 pattern，按下 = 选轨（User Guide 5.1、5.6）；官方 CC 表里没有 pattern 切换或选轨的 CC。【第三方】转动后机器广播 SysEx `30 5p 0F`（新的 pattern，0 起算）；按下选轨后广播 SysEx `01 10 27`（Part 号）并带一个试听音符。Mixer 模式下 Track knobs 调 PAN / VOLUME / SEND，【推断】发 CC 10 / 7 / 91 / 94。
- Sound Design knobs：【第三方】第 1 页的四个旋钮只发 CC / PC、不发 SysEx：SOUND SELECT 发 CC 0 + CC 32 + Program Change；MONO/POLY/CHORD 发 CC 26；PAN 发 CC 10；VOLUME 发 CC 7。
- 触摸滑条：【第三方】同时发 CC 和 SysEx Parameter Change；SysEx 发在真实参数地址上（如 `30 44 05`、`30 45 03`、`31 2p 15`），一个滑条可能带动多个参数，只有 SysEx 能全部反映。Master 效果的 CC 固定在通道 1，Single 效果的 CC 在该轨通道。
- [MUTE] / [SOLO]：【官方】CC 23 / 24 为 receive only，机器不发。按 mute/solo 时是否广播 SysEx（`30 5p 29`、`30 40 68`）【未确认】。
- [BPM+]/[BPM−]、[SWING]、[SCALE]、[KEY]、[OCTAVE]：是否广播对应的 SysEx 地址【未确认】。

来源：【官方】Data List p.111、p.113-114、p.123、p.162；User Guide 第 5、9、10、11、18.3 章。【第三方】https://github.com/jaeggerr/seqtrak-docs/blob/main/docs/05-live-state.md

### e. 电脑发往各通道的 note on 能否触发对应轨道发声？能否在录音状态下被录入？

**结论：触发发声——是。录入音序器——Synth 轨：是；鼓轨与 SAMPLER 轨：未确认。**

- 【官方】Implementation Chart：Note ON Recognized = O（`9nH`, v=1-127），Note Number 0-127，Basic Channel 1-11。
- 【官方】User Guide 7.1 NOTE："Real-time input is also possible from external MIDI devices. For details about channel assignments, see 18.2 MIDI Channels."
- 【官方】User Guide 第 2 章 Record key："You can record a performance with the Synth keys or record MIDI input from an external source."
- 【官方】User Guide 7.9：Step Input 时，步里写入的是"最后一次通过 Synth key / keyboard input mode / **external MIDI device** 演奏的音符"。
- 鼓轨：官方把鼓轨的实时录音描述为必须先进入 Real-time Input mode（6.5），没有说明外部 MIDI 发到通道 1-7 的音符在录音状态下会不会被录入。【第三方】epicsagas/seqtrak-agent 声称在机器上按下 REC 后，USB 进来的音符会被实时录音器录入（它的工具对鼓轨也这么用）。按第三方对待。
- 【未确认】录音状态能否由电脑远程开启。官方没有对应消息；第三方有 `01 10 21 RecordingStatus`（未测试），epicsagas 则称"没有 SysEx 可以 arm 录音，必须在面板上按"。
- 【未确认】鼓轨对 60 以外的音符如何响应；SAMPLER 轨哪个音符触发哪个采样（见 2.2、2.4）。
- 【未确认】外部音符是否受 Record Quantize（`00 00 1F`）影响（User Guide 7.2 说量化设置也作用于鼓轨实时输入，但没提外部输入）。

来源：【官方】Data List p.162；User Guide 第 2、6.5、7.1、7.9 章。【第三方】https://github.com/epicsagas/seqtrak-agent

### f. 能否通过 MIDI 从电脑远程切换 pattern、切换 project、设置 tempo、mute/solo、启动 / 停止？

| 操作 | 结论 | 方法 | 依据 |
|---|---|---|---|
| 切换 pattern | **是**（SysEx；没有 CC / PC） | Parameter Change 写 `30 5p 0F` = 00-05 | 【官方】地址在 Data List p.135。【第三方】实机写入并读回成功；Pattern Select Mode（`30 40 79`）为 0 时被钳制在 0-2。切换是立即生效还是按 Launch Quantize【未确认】 |
| 切换 project | **是** | CC 0 = 64，CC 32 = 0，Program Change 0-7（任意通道） | 【官方】Data List p.113、p.117。【第三方】实机验证过。【官方】播放中切换 project 会停止播放（User Guide 4.1 NOTE） |
| 设置 tempo | **是** | Parameter Change 写 `30 40 76`（2 字节）；或让 SEQTRAK 作从机跟随电脑发的 MIDI clock | 【官方】地址在 Data List p.125；从机见第 5 节。【第三方】SysEx 写入实机验证过（122 → 126 → 恢复） |
| mute 轨道 | **是** | 在该轨通道发 CC 23（0-63 off，64-127 on）；或 SysEx `30 5p 29`（00 / 7D） | 【官方】User Guide 18.3.3；Data List p.114、p.135。没有找到实测记录 |
| solo 轨道 | **是** | CC 24 = 0（off）或 1-11（轨号）；或 SysEx `30 40 68` | 【官方】同上；Data List p.125。CC 24 应发在哪个通道官方只写 "1-11"。没有找到实测记录 |
| 启动 / 停止 | **是** | 发 `FA`（Start）/ `FC`（Stop）；`FB`（Continue）也被识别 | 【官方】Implementation Chart：System Real Time Commands Recognized = O；接收流程里 START / CONTINUE / STOP 不受开关限制。【第三方】实机验证过 FA / FC。Midi Sync 设为 Internal 时是否仍响应【未确认】 |

来源：【官方】Data List p.112-114、p.117、p.125、p.135、p.162；User Guide 4.1、18.3.3。【第三方】https://github.com/jaeggerr/seqtrak-docs/blob/main/docs/10-verified-behaviour.md ，https://github.com/jaeggerr/seqtrak-docs/blob/main/docs/04-sequencer-editing.md

### g. 按下 [PLAY] 等功能键时是否发出任何 MIDI 消息？

**结论：[PLAY]——是（Start `FA` / Stop `FC`）。其他功能键——官方没有对应的发送消息，未确认。**

- 【官方】发送流程（Data List p.111）：`[SW4] SYSTEM Transmit Sequencer Control` 之后是 START `FAH` 与 STOP `FCH`；Implementation Chart：System Real Time Commands Transmitted = O（`*3 If switch is on`）。开关 `00 00 2B` 默认 On。官方没有逐字写"按 [PLAY] 发 FA"，但发送侧只有这一个来源。发送流程里**没有** Continue（`FB`）。
- 【第三方】按 [PLAY] 开始 / 停止时，机器发 `FA` / `FC`，并广播 SysEx `01 10 20` = 01 / 00（后者需要 Transmit SysEx 打开）。
- 其他按键：
  - 【官方】[MUTE]、[SOLO]：对应 CC 为 receive only，不发。
  - 【第三方】按 FX Page 键、换音色、动旋钮时广播 SysEx `01 10 2E`；选轨广播 `01 10 27`；pattern 变化广播 `30 5p 0F`。
  - 【未确认】[PAGE]、[DELETE]、[BAR LENGTH]、[OCTAVE]、[SCALE]、[KEY]、[BPM±]、[SWING]、[PROJECT↑]、[REC SAMPLE]、Record key、[UNDO/REDO]、[CLEAR FX] 是否发出任何消息；用面板切换 project 时是否发出 Bank Select + Program Change。

来源：【官方】Data List p.111、p.123、p.162。【第三方】https://github.com/jaeggerr/seqtrak-docs/blob/main/docs/05-live-state.md

---

## 9. 对本项目（Web MIDI 音游判定 + 远程示范）的直接影响

以下是把上面的事实串起来得到的工程提示，属于【推断】，不是官方说明。

1. **判定用户演奏**：Synth keys 的 Note On 可以直接用（8b）。鼓轨的"开关步"很可能不产生 Note On（8a），鼓类课程的判定需要走 Real-time Input mode 的 Synth keys，或者改为判定"音序器回放出来的音符"，或者读步进数据（第三方 `70` 区）。这一项必须先实测。
2. **按键无力度**：按键 velocity 大概率恒为 Pad Velocity（默认 100），不能用力度做评分维度。
3. **读旋钮 / 读状态前先检查两个开关**：`00 00 0F`（应为 0x70）与 `00 00 10`（应为 01）。若需要应用代为打开，属于改用户设备的全局设置，先读原值、征得同意、退出时恢复。
4. **区分自己发的和用户弹的**：USB Thru 默认 Both。若 Thru 会把应用发出的音符回送（未确认），需要关掉 USB Thru（`00 00 23` = 00）或在应用侧做去重。
5. **播放状态别看 clock**：停止时也可能有 `F8`（第三方）。用 `FA` / `FC`（或第三方的 `01 10 20`）。
6. **音符映射别写死**：Scale 表、Key、Octave 都可被用户或 app 改，连接时读回 `30 40 7E`、`30 40 7F`、`30 5p 0C`、`30 4D xx`。
7. **Note Off 两种格式都要认**（2.1）。
8. **Windows 上只能指望 USB**：官方明确 Windows 不支持蓝牙 / Wi-Fi；并需安装 Yamaha Steinberg USB Driver。
9. Web MIDI 侧要发送或接收 SysEx，需要以 `sysex: true` 申请权限（这是 Web MIDI 的通用规则，不是 SEQTRAK 资料）。

---

## 10. 未确认 / 没有找到的内容，以及实机验证方法

通用准备：Windows 电脑装好 Yamaha Steinberg USB Driver，USB-C 连接 SEQTRAK；用一个能显示原始字节并带时间戳的 MIDI monitor（如 MIDI-OX，或自己写一个 Web MIDI 页面把 `midimessage` 事件原样打日志，`requestMIDIAccess({ sysex: true })`）。监视时过滤掉 `F8` 与 `FE`，否则会被刷屏。要下"从不发送"的结论时用**累计计数**，不要靠肉眼看滚动日志（第三方就是因此两次得出错误结论）。

| 编号 | 未确认的内容 | 验证方法 | 预期能得到 |
|---|---|---|---|
| T1 | 电脑上有几个 USB MIDI 端口、叫什么（装 / 不装驱动；Chrome Web MIDI 里的 `name` 与 `manufacturer`） | 连接后在 Chrome 里枚举 `MIDIAccess.inputs` / `outputs` 并打印；卸载驱动后重复一次 | 端口数量与名称；不装驱动是否可用 |
| T2 | `00 00 0F`、`00 00 10`、`00 00 0E`、`00 00 23`、`00 00 2A`、`00 00 2B`、`00 00 2D`、`00 00 06` 的当前值；Transmit SysEx 为 Off 时是否仍应答 Parameter Request | 逐个发 `F0 43 30 7F 1C 0C 00 00 xx F7`，看是否收到 `F0 43 10 7F 1C 0C 00 00 xx dd F7`。若无应答，先写 `00 00 10` = 01 再读 | 实际开关状态；应答是否依赖 Transmit SysEx |
| T3 | **鼓轨上按 Drum key 开 / 关步是否发任何 MIDI** | 停止状态选中 KICK，逐个按 Drum key 开步、再关步；然后在播放状态重复。monitor 全通道监听，累计计数 | 是否有 Note On / SysEx；与音序器回放音符如何区分 |
| T4 | 鼓轨 Real-time Input mode 下 Synth keys 发出的通道、音符号、velocity | 按住 [KICK] 旋钮按一个 Synth key 进入该模式，依次按 7 个 Synth keys，记录每个键的 `9n kk vv` | 7 个键 → 通道 / 音符的映射 |
| T5 | 鼓轨发出与响应的音符号（是否固定 60） | (a) 播放一个只有 KICK 的 pattern，看通道 1 上的 `kk`；(b) 从电脑向通道 1 发 note 36、48、60、72，听是否发声、音高是否变化 | 鼓轨音符号；是否随音符变调 |
| T6 | SAMPLER 轨 7 个采样对应的音符号（发出与响应）；DrumKit 类型鼓轨同理 | 选中 SAMPLER，依次按 7 个 Synth keys 记录通道 11 上的 `kk`；再从电脑向通道 11 逐个发 note 0-127，记录哪个音符触发哪个采样 | 采样 → 音符映射表 |
| T7 | Synth keys 的实际音符与 Scale / Key / Octave 的关系；Octave 的真实范围（−2 还是 −3）；Keyboard Input mode 的音符 | 选 SYNTH 1，默认设置下按 7 个键记录音符；分别改 Key、Octave、Scale 后重复；把 Octave 调到最低 / 最高各记录一次；进入 Keyboard Input mode 按 Drum keys 记录 | 验证 2.3 的公式；Octave 上下限 |
| T8 | 按键 velocity 是否恒定；Note Off 的线上格式 | 轻按 / 重按同一个 Synth key，比较 `vv`；看松键时收到的是 `8n kk 00` 还是 `9n kk 00`；改 `00 00 20` 后再按一次 | 是否无力度感应；Note Off 格式 |
| T9 | **USB Thru 是否把电脑发出的音符回送给电脑** | 监听输入口的同时，从电脑向通道 8 发一个 Note On / Off；先在 `00 00 23` = 03 下测，再写成 00 测一次，测完恢复 | 是否存在回声；关 Thru 后是否消失 |
| T10 | 各类旋钮 / 滑条 / 按键实际发出的消息（CC 还是 SysEx，哪个通道） | 确认 T2 的开关已开。一次只做一个手势，手势之间停几秒：转 Track knob、按 Track knob、Sound Design 第 1-3 页的 4 个旋钮、三个触摸滑条（MASTER / SINGLE、FX 页 1 / 2 各一遍）、Mixer 模式下转 Track knob、[MUTE]+Track knob、[SOLO]+Track knob、[BPM±]、[SWING]、[SCALE]、[KEY]、[OCTAVE]、[PAGE]、Record key、[PROJECT↑]+Drum key | 完整的"手势 → 消息"对照表；验证第 3 节的旋钮 → CC 对应 |
| T11 | [PLAY] 的消息；停止时是否持续发 `F8`；是否发 `FB` | 不过滤 `F8`，按 [PLAY] 开始、停止各两次，记录 `FA` / `FC` / `FB` 与 SysEx；停止后统计 10 秒内 `F8` 个数 | Start / Stop 的确切序列；停止时 clock 行为 |
| T12 | 音序器回放的音符输出；mute 的轨道是否仍输出音符；琶音器音符是否输出 | 播放一个多轨 pattern，按通道统计 Note On；mute 其中一轨再统计；在 SYNTH 1 开琶音器按住一个键再统计 | 回放输出的开关与边界情况 |
| T13 | 远程启停 | 停止状态下从电脑发 `FA`，听是否开始；发 `FC` 看是否停止；把 `00 00 2A` 写成 00（Internal）后重复，测完恢复 | FA / FC 是否有效；是否依赖 Midi Sync |
| T14 | 远程设 tempo 与 swing | 写 `30 40 76` = `00 5A`（90），读回并听；写 `30 40 7C` 为 `01 00`、`01 1E`、`00 62` 后读回 | Tempo 编码；Swing 中心值是否为 128 |
| T15 | 远程切 pattern：是否生效、即时还是量化、是否受 Pattern Select Mode 钳制 | 播放中写 `30 57 0F` = 01、02、03，听切换时机并读回；读 `30 40 79` | pattern 远程切换的实际行为 |
| T16 | 远程 mute / solo | 在通道 2 发 `B1 17 7F`、`B1 17 00`（CC 23）；发 `B0 18 08`、`B0 18 00`（CC 24）；再用 SysEx `30 51 29`、`30 40 68` 各试一次；观察面板 LED 与声音 | CC 23 / 24 与 SysEx 的 mute / solo 是否有效；CC 24 对通道是否敏感 |
| T17 | 远程切 project；面板切 project 时机器是否发消息 | 先确保当前 project 无需保留的改动。发 `B0 00 40`、`B0 20 00`、`C0 01`，看是否切到 project 2；再在面板上用 [PROJECT↑]+Drum key 切回并监听 | Bank 64 + PC 是否有效；面板切换的广播 |
| T18 | 远程换音色与编号换算 | 在通道 8 发 `B7 00 3F`、`B7 20 06`、`C7 59`，核对是否为 Synth No. 858 "Acid3"（可在官方 app 里看名称） | 验证 `LSB = (No.−1)÷128`、`PC = (No.−1) mod 128` |
| T19 | 电脑发的音符能否被录入（Synth 轨、鼓轨、SAMPLER 轨）；是否受量化影响 | 在机器上选轨并按 Record key 开始录音，从电脑向该轨通道发几个带时间偏移的音符；停止后回放并监听输出。对通道 8、1、11 各做一次 | 外部输入录音在三类轨道上的行为 |
| T20 | 从机同步：只发 clock 不发 Start、发 Start + clock、停发 clock 后的行为 | 确认 `00 00 2A` = 01。电脑以 24 PPQN 发 `F8`（如 100 BPM），依次测试：只发 `F8`；发 `FA` 后持续 `F8`；发 `FC`；停止发送 `F8` | Auto 的判定方式；从机时 tempo 是否跟随 |
| T21 | 第三方 `01` 区地址在自己这台机器上是否成立 | 只读：请求 `01 10 27`、`01 10 20`、`01 10 15`、`01 00 00`，分别在换轨 / 播放 / 换 project 前后各读一次。**不要向 `01` 区写入** | 当前轨道、播放状态、当前 project 是否可读 |
| T22 | Bulk Dump 校验和的计算范围 | 发 `F0 43 20 7F 1C 0C 11 00 00 F7`，对收到的任意一个块分别按"含 Byte Count"与"不含 Byte Count、从 Model ID 起"两种方式求和，看哪种低 7 位为 0 | 校验和算法 |
| T23 | Windows 上的蓝牙 MIDI | 仅在需要时测试：在机器上 [ALL]+[SWING] 进入等待，用 Windows 蓝牙设置或 BLE-MIDI 工具尝试配对 | 官方称不支持，实际是否可用 |
| T24 | USB 音频在 Windows + Chrome 下的表现 | 装驱动后看系统声音设备列表里的 SEQTRAK 输入 / 输出；用 `getUserMedia` 采 SEQTRAK 输入，核对采样率与通道数 | 能否把机器声音采进浏览器；实际格式 |

另外没有找到答案、也暂时没有简单测法的：

- 官方 SEQTRAK app 里 "MIDI output filters" / "MIDI clock" / "MIDI Thru" 设置界面的确切菜单名称与选项文字（User Guide 只说"用 app 设置"）。打开 app 的设置页即可看到。
- `Local Switch`（`00 00 06`）的确切行为。可在 T8 之后把它写成 00，再按 Synth key 看是否还发声 / 还发 Note On，测完恢复。
- OS V1.x 与 V2.00 在 MIDI 行为上的差异。本文只对 V2.00 的文档负责；用 Identity Request（`mm` 字节）或 app 确认机器版本。
