# Yamaha SEQTRAK 操作参考（依据官方 User Guide D0 / OS V2.00）

> 整理日期：2026-11-10
> 用途：SEQTRAK 零基础互动教学应用的"按哪个键、转哪个旋钮"事实依据。
> 原则：只写在官方资料里读到的内容。凡是没有读到的，一律写【未确认】，集中列在第 8 节。

---

## 0. 阅读前须知

### 0.1 资料来源与版本

| 资料 | 版本 | 说明 |
|---|---|---|
| SEQTRAK User Guide（英文，HTML 版，共 18 章 + 首页） | 文件名代号 `D0`，页面元数据 `YJ-D-0`，页脚 `Published 01/2026` | 首页写明"本手册描述的功能对应 OS V2.00"。全文通读；正文引用的 152 张插图全部看过（拼成总览图浏览，面板图等关键图放大核对）。 |
| SEQTRAK User Guide（简体中文，HTML 版） | 同为 `D0` / OS V2.00 | 用于术语对照（通读第 2、6 章，其余章节核对标题与关键术语）。 |
| Yamaha 官方固件页 "SEQTRAK OS Updater V2.00" | 当前最新固件 V2.00 | 含 V1.00→V1.10→V1.20→V1.21→V2.00 的更新说明，用于标注功能引入版本。 |
| Yamaha USA 的 SEQTRAK 产品页 | 含 "SEQTRAK OS v2.0" 更新介绍 | 只用于印证 V2.00 的变化（[BAR LENGTH]、[ALL] 旋钮、轨道类型、App v2.0 的备份）。 |
| SEQTRAK Data List（英文 PDF） | `D0`，封面写 "For OS V2.00" | 只读了 Track Type、Sound Category、Arpeggio Preset List、Sound Design Parameter List 几页，用于交叉核对。 |

- 探测过 `E0`、`F0`、`D1` 版本的手册地址，均返回 404，因此 `D0` 是目前在线的最新版。
- 旧版英文手册（`A0`/`B0`/`C0`）的地址已全部 404，**没有读到**，所以"功能引入版本"只能依据固件页的更新说明，而不是逐版手册对比。

### 0.2 本文的标注约定

| 标注 | 含义 |
|---|---|
| （无标注） | 手册正文文字明确写出的内容。 |
| 【图示】 | 手册正文没有用文字写出，但插图里画得很清楚的内容（例如某个键亮什么颜色、位于第几个）。可信度高，但属于"读图"。 |
| 【推断】 | 由手册多处内容合理推出，但手册没有直接这样写。教学应用里使用前建议实机验证。 |
| 【未确认】 | 官方资料里没有找到。不要当作事实使用。 |
| `[OS Vx.xx]` | 该功能由该版固件引入（依据官方固件页的更新说明；`V2.00` 的轨道类型在手册 6.7 节也有标注）。 |

### 0.3 操作动词的统一写法（对应手册的图标记号）

手册在 1.1.1 "Notation" 中定义了四种操作记号，本文统一译为：

| 手册记号 | 本文写法 | 含义 |
|---|---|---|
| 箭头指向控件 | **按**（单按） | 按一下按钮 / 按下旋钮 / 按一下键 |
| `HOLD` | **按住** | 按住不放，同时做下一步 |
| `HOLD Ns` | **长按 N 秒以上** | 按住至少 N 秒 |
| 旋钮外圈带箭头的虚线 | **转动** | 转旋钮 |
| （文字）press and turn | **按下并转动** | 把旋钮按下去的同时转 |
| （文字）double-tap | **双击** | 快速按两下 |

LED 的三种状态：**熄灭 / 常亮 / 闪烁**。

### 0.4 术语对照（英文原名 → 官方中文手册译名 → 本文用语）

| 英文原名 | 官方中文手册译名 | 本文用语 / 说明 |
|---|---|---|
| project | 项目 | project（项目）：一首歌的全部数据 |
| track | 音轨 | track（轨道） |
| pattern | 模板 | pattern：一条轨道上循环播放的一段乐句。**注意官方中文译作"模板"** |
| step | 音程 | step（步）：序列的一格。**注意官方中文译作"音程"，容易与乐理的"音程"混淆** |
| tick | 节拍 | tick：1 step = 120 ticks。**官方中文译作"节拍"，容易误解** |
| Track knobs | 音轨旋钮 | 11 个轨道各一个的旋钮（可转、可按） |
| [ALL] knob | [ALL]旋钮 | 同时作用于 11 条轨道的旋钮，也是很多组合键的"功能键" |
| Drum keys | 鼓键 | 16 个步进键（2 排 × 8） |
| Synth keys | 合成键 / 合成器键 | 7 个演奏键 |
| Record key | 录音键 | 带圆点的键（手册 9.3 节里也写作 [RECORD] button） |
| Index | 索引 | 一列会亮的文字标签，显示当前参数或模式 |
| Global Meter | 全局仪表 | 一列 8 个 LED，显示数值或状态 |
| Sound Design knobs 1–4 | 声音设计旋钮 1–4 | 4 个竖排旋钮，最上面一个印着 SOUND |
| Sound Design Page button | 声音设计页面按钮 | 切换 Sound Design knobs 的参数页 |
| FX Page button | FX页面按钮 | 切换触摸滑条的参数页 |
| touch sliders | 触摸滑块 | [FX LEVEL] [HIGH PASS] [REPEATER] 三条触摸滑条 |
| Launch Quantize | Launch Quantize | 预约切换 pattern 的对齐周期 |
| reserved switching | 预留切换 | 预约切换（等到对齐点再切） |
| Micro Timing | 微时序 | 单步的前后微移 |
| Substep | 子音程 | 一步内连续触发多次（连打） |
| Parameter Lock | 参数锁定 | 给单个 step 单独设定参数 |
| Motion Recording | 运动录制 / 运动轨迹录制 | 实时录下旋钮/滑条的动作 |
| count-in | 预备拍 | 录音前的预备拍 |
| Mixer mode | 混音台模式 | |
| Mute mode | 静音模式 | |
| Song mode / Scene mode | 乐曲模式 / 场景模式 | |
| Monitoring mode | 监听模式 | 用 Global Meter 看采样输入电平 |
| auto-normalize | 自动标准化 | 采样后自动把音量拉到最大 |
| cyan blue | 青蓝色 | 本文写"青蓝色"；与"蓝色"是两种不同的灯色 |

来源：
- https://manual.yamaha.com/mi/de/seqtrak/en/index.html
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_001.html
- https://manual.yamaha.com/mi/de/seqtrak/zh/index.html （及 `SEQTRAK_user_guide_Zh_D0_002.html`、`_006.html`）
- https://usa.yamaha.com/support/updates/seqtrak_os_updater.html

---

## 1. 面板布局

### 1.1 整机分区（俯视，机身横放，YAMAHA 标牌在左上）

手册 1.2 节把整机分为三个 section，再加左右两个侧面，从左到右依次是：

```
┌──┬───────────────────────────┬──────────────┬──────┬──┬──────┬──────┬───────────────┬──┐
│左│        Drum section        │ Synth section│Index │GM│ Sound│  FX  │ 扬声器/麦克风  │右│
│侧│  ALL  KICK  SNARE  CLAP   │ SYNTH1 SYNTH2│(20行 │(8│Design│ 旋钮 │               │侧│
│面│  HAT1 HAT2  PERC1  PERC2  │  DX   SAMPLER│ 文字)│灯│ 旋钮 │ 开关 ├───────┬───────┤面│
│  ├───────────────────────────┼──────────────┤      │) │ ×4   │FX    │ HIGH  │REPEAT-│  │
│  │ Drum keys 上排 1–8         │ ●  1  2  3   │      │  │      │LEVEL │ PASS  │ ER    │  │
│  │ Drum keys 下排 9–16        │ 4  5  6  7   │      │  │      │滑条  │ 滑条  │ 滑条  │  │
└──┴───────────────────────────┴──────────────┴──────┴──┴──────┴──────┴───────┴───────┴──┘
     └────── Drum section ─────┘└ Synth section┘└──────── Sound Design & FX section ────────┘
```

- **Drum section（鼓区）**：做节奏。含 [ALL] 旋钮、7 个鼓轨的 Track knobs、16 个 Drum keys。手册的分区示意图里，左侧面那一列按钮也画在 Drum section 的范围内。
- **Synth section（合成器区）**：做旋律。含 SYNTH 1 / SYNTH 2 / DX / SAMPLER 四个 Track knobs、Record key、7 个 Synth keys，以及上缘的 5 个按钮。
- **Sound Design & FX section（音色设计与效果区）**：含 Index、Global Meter、4 个 Sound Design knobs、[FX] 旋钮、[MASTER/SINGLE] 开关、3 条触摸滑条、扬声器与麦克风。手册的分区示意图里，右侧面那一列也画在这个范围内。

机身尺寸（规格表）：宽 343 × 深 97 × 高 38 mm，重 0.5 kg。

### 1.2 左侧面（Left side）：7 个按钮，自上而下

手册编号 ①–⑥（HTML 版用字母 a–f）。【图示】标签竖排印在顶面最左边的窄条上，按钮本体凸出在机身左边缘之外，操作图示里的按压方向是"从左向右、水平向内按"。

| 顺序（上→下） | 名称 | 手册说明 |
|---|---|---|
| 1 | [VOL+] | 音量加。与 [VOL−] 合为手册编号 ① |
| 2 | [VOL−] | 音量减 |
| 3 | [DELETE] | 删除 pattern 或 project（也是多种"删除/取消"组合键的功能键） |
| 4 | [MUTE] | 静音某条轨道 |
| 5 | [SOLO] | 独奏某条轨道 |
| 6 | [PAGE] | 切换 Drum keys 显示的页；更改鼓轨 pattern 长度 |
| 7 | [⏻/PLAY] | 电源开/关；播放/停止 project。印的是电源符号加 "/ PLAY" |

### 1.3 顶面左：Drum section

**旋钮区（上半部分）**：2 排 × 4 列，共 8 个旋钮。

| | 第 1 列 | 第 2 列 | 第 3 列 | 第 4 列 |
|---|---|---|---|---|
| **上排** | [ALL] | KICK | SNARE | CLAP |
| **下排** | HAT 1 | HAT 2 | PERC 1 | PERC 2 |

- [ALL] 是手册编号 ⑦；其余 7 个（加上 Synth section 的 4 个）是 ⑧ Track knobs。
- 【图示】每个旋钮**右侧**有一列竖排的 **3 个小圆 LED**（[ALL] 旋钮旁也有 3 个）。
- 【图示】标签位置：上排旋钮的名称印在旋钮**下方**；下排旋钮的名称印在旋钮**上方**。
- 【图示】YAMAHA 标牌在 [ALL] 与 KICK 旋钮上方，突出于机身上缘之外。
- 所有 Track knobs 和 [ALL] 旋钮都**既能转也能按**。

**Drum keys（下半部分）**：手册编号 ⑨，2 排 × 8 列，共 16 个方形键。

| 上排 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| **下排** | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |

- 【图示】编号规则：上排从左到右是 1–8，下排从左到右是 9–16（多张插图在键下方标了数字）。
- 【图示】每个键中央有一条横向的短条形 LED。

### 1.4 顶面中：Synth section

**上缘 5 个按钮**（手册编号 ⑫–⑯），从左到右：

| 顺序（左→右） | 名称 | 手册说明 |
|---|---|---|
| 1 | [BAR LENGTH] | 更改 pattern 长度 |
| 2 | [OCTAVE] | Synth keys 的音高升降八度 |
| 3 | [SCALE] | 更改 Synth keys 使用的音阶 |
| 4 | [KEY] | 以半音为单位更改 Synth keys 的调 |
| 5 | [REC SAMPLE] | 在 SAMPLER 轨上采样 |

【图示】标签印在顶面的上边缘，按钮本体画成凸出在机身上缘之外的小凸起，操作图示里的按压箭头是"从上缘向面板内按"。手册把它们归在 "Top Left" 分组里。它们究竟算顶面按钮还是后侧面按钮，手册没有用文字说明，见第 8 节。

**旋钮区**：2 排 × 2 列，共 4 个 Track knobs。

| | 第 1 列 | 第 2 列 |
|---|---|---|
| **上排** | SYNTH 1 | SYNTH 2 |
| **下排** | DX | SAMPLER |

同样每个旋钮右侧 3 个竖排 LED；上排标签在旋钮下方，下排标签在旋钮上方。

**键区**：2 排 × 4 列，共 8 个方形键，大小与 Drum keys 相同，并与 Drum keys 的两排对齐。

| | 第 1 列 | 第 2 列 | 第 3 列 | 第 4 列 |
|---|---|---|---|---|
| **上排** | **Record key**（中央是圆点，手册编号 ⑩） | Synth key 1 | Synth key 2 | Synth key 3 |
| **下排** | Synth key 4 | Synth key 5 | Synth key 6 | Synth key 7 |

- 【图示】Synth keys（手册编号 ⑪）的编号 1–7 就是上表的顺序（多张插图在键上标了数字）。
- Record key 中央是一个圆点 LED，其余 7 个键是横条 LED。

### 1.5 顶面右：Sound Design & FX section

从左到右是 5 个竖向的列：

**第 1 列：Index**（手册编号 ⑰）。一列印刷文字，会亮起来指示当前参数或模式。【图示】自上而下共 20 行：

```
SOUND / PITCH / MONO/POLY / CHORD / PAN / VOLUME / ATTACK / DECAY / MICROTIMING / FILTER /
RESONANCE / REVERB / DELAY / COMP / DISTORTION / MODULATION / DUCKER / OTHER / MIXER / SONG
```

**第 2 列：Global Meter**（手册编号 ⑱）。【图示】一列竖排的 **8 个 LED**，数值越大亮的灯越靠上（详见第 4 节）。

**第 3 列：Sound Design 列**，自上而下：

| 位置 | 名称 | 说明 |
|---|---|---|
| 上缘 | [UNDO/REDO] 按钮（⑲） | 【图示】与 [BAR LENGTH] 等一样画成上缘的凸起 |
| 第 1 个旋钮 | Sound Design knob 1（⑳） | 【图示】旋钮下方印着斜体 "SOUND" |
| 第 2 个旋钮 | Sound Design knob 2 | |
| 第 3 个旋钮 | Sound Design knob 3 | |
| 第 4 个旋钮 | Sound Design knob 4 | |
| 下缘 | Sound Design Page button（㉑） | 【图示】画成下缘（靠近使用者一侧）的凸起，上方印着一排三个点 "•••"；按压箭头是"从下缘向面板内按" |

- 4 个 Sound Design knobs **既能转也能按**。
- 【图示】每个 Sound Design knob 的右侧都印着 "•••" 三个小点，含义手册未说明。

**第 4 列：FX 列**，自上而下：

| 位置 | 名称 | 说明 |
|---|---|---|
| 上缘 | [CLEAR FX] 按钮（㉒） | 【图示】上缘的凸起 |
| 旋钮 | [FX] knob（㉓） | 旋钮下方印着斜体 "FX"。可转；也可按（用于删除参数锁，见 3.6） |
| 开关 | [MASTER/SINGLE] switch（㉔） | 【图示】横向拨动开关，左边是 MASTER，右边是 SINGLE |
| 滑条 | [FX LEVEL] touch slider（㉕ 之一） | 【图示】竖向触摸条，画着 7 条横线；标签 "FX LEVEL" 在滑条上方 |
| 下缘 | FX Page button（㉖） | 【图示】下缘的凸起，上方印着 2 排 × 3 个点 |

**第 5 列（最宽）**：

- 上半部分：**Speaker and microphone**（㉗）。【图示】一块圆孔点阵格栅，右上角印着 "MIC"。
- 下半部分：并排两条触摸滑条，左 **[HIGH PASS]**、右 **[REPEATER]**（㉕）。【图示】样式与 [FX LEVEL] 相同，下方也印着 2 排 × 3 个点，但只有 [FX LEVEL] 那一列的下缘画了按钮凸起。

### 1.6 右侧面（Right side）：4 个接口 + 4 个按钮，自上而下

手册编号 ㉘–㉞（HTML 版用字母 B–H）。【图示】标签竖排印在顶面最右边的窄条上；下面 4 个按钮画成凸出在右边缘之外。

| 顺序（上→下） | 名称 | 类型 | 手册说明 |
|---|---|---|---|
| 1 | [USB] | 接口（USB Type-C） | 充电；连接电脑、手机/平板、MIDI 设备、U 盘 |
| 2 | [PHONES] | 接口（立体声 3.5 mm 小插孔） | 耳机。插入后内置扬声器不出声 |
| 3 | [AUDIO IN] | 接口（立体声 3.5 mm 小插孔） | 音频输入 |
| 4 | [MIDI] | 接口 | 只能接随附的 MIDI 转换线（MIDI IN / OUT） |
| 5 | [BPM+] | 按钮 | 速度加。与 [BPM−] 合为手册编号 ㉜ |
| 6 | [BPM−] | 按钮 | 速度减 |
| 7 | [SWING] | 按钮 | 给整个 project 加摇摆感 |
| 8 | [PROJECT↑] | 按钮 | 切换 project（也是多种组合键的功能键） |

背面、底面：手册没有任何关于背面或底面有接口、开关的描述或插图。

### 1.7 控件数量汇总

| 类别 | 数量 | 明细 |
|---|---|---|
| 按钮 | 20 | 左侧面 7；右侧面 4；上缘 7（[BAR LENGTH] [OCTAVE] [SCALE] [KEY] [REC SAMPLE] [UNDO/REDO] [CLEAR FX]）；下缘 2（Sound Design Page、FX Page） |
| 旋钮（均可按） | 17 | [ALL] 1；Track knobs 11；Sound Design knobs 4；[FX] 1 |
| 方形键 | 24 | Drum keys 16；Record key 1；Synth keys 7 |
| 触摸滑条 | 3 | [FX LEVEL] [HIGH PASS] [REPEATER] |
| 拨动开关 | 1 | [MASTER/SINGLE] |
| 接口 | 4 | [USB] [PHONES] [AUDIO IN] [MIDI] |
| 旋钮旁 LED | 36 | 12 个旋钮（[ALL] + 11 条轨道）× 3【图示】 |
| Global Meter LED | 8 | 【图示】 |
| Index 文字 | 20 行 | 【图示】 |
| 扬声器 / 麦克风 | 各 1 | 扬声器 2.3 cm、1 W；MEMS 麦克风 |

### 1.8 画 SVG 用的近似坐标

> 以下数值是在手册的整机示意图（`images/image015.png`，656 × 229 像素）上叠加网格后**目测**得到的，不是官方尺寸，误差约 ±1.5%。坐标系：以机身顶面外框为基准，X 从左到右 0–100%，Y 从上（远离使用者）到下 0–100%。外框宽高比约 3.58 : 1（实物 343 : 97 ≈ 3.54 : 1）。

**竖向分栏的 X 范围**

| 区域 | X 起 | X 止 |
|---|---|---|
| 左侧面标签条 | 0% | 2.8% |
| Drum section | 3.3% | 40.5% |
| Synth section | 41.0% | 59.5% |
| Index | 59.9% | 66.2% |
| Global Meter | 66.8% | 69.0% |
| Sound Design 列 | 69.5% | 75.9% |
| FX 列 | 76.4% | 82.8% |
| 扬声器 / [HIGH PASS] + [REPEATER] | 83.3% | 96.8% |
| 右侧面标签条 | 97.2% | 100% |

**横向分层的 Y 范围**

| 区域 | Y 起 | Y 止 |
|---|---|---|
| 旋钮区（Drum / Synth section 上半） | 0% | 66% |
| 键区上排（Drum keys 1–8、Record key、Synth keys 1–3） | 68.0% | 83.1% |
| 键区下排（Drum keys 9–16、Synth keys 4–7） | 84.8% | 100% |
| 扬声器格栅 | 0.6% | 48.9% |
| [HIGH PASS] / [REPEATER] 面板 | 50.6% | 100% |

**旋钮中心**（Track knobs 直径约为宽度的 3.4%；Sound Design knobs 和 [FX] 约 2.9%）

| 旋钮 | X | Y |
|---|---|---|
| [ALL] / HAT 1 | 7.8% | 16.7% / 50.2% |
| KICK / HAT 2 | 17.2% | 16.7% / 50.2% |
| SNARE / PERC 1 | 26.6% | 16.7% / 50.2% |
| CLAP / PERC 2 | 36.1% | 16.7% / 50.2% |
| SYNTH 1 / DX | 45.3% | 16.7% / 50.2% |
| SYNTH 2 / SAMPLER | 54.8% | 16.7% / 50.2% |
| Sound Design knob 1 / 2 / 3 / 4 | 72.5% | 17.0% / 38.9% / 61.2% / 83.3% |
| [FX] | 79.6% | 17.0% |

- 每个 Track knob 的 3 个 LED：X = 旋钮中心 X + 3.1%；Y = 旋钮中心 Y − 5.5% / ±0 / + 5.6%。
- 上排旋钮标签 Y ≈ 27%；下排旋钮标签 Y ≈ 40%。

**键中心**（键宽约 4.2%，列间距约 4.7%；上排中心 Y ≈ 75.6%，下排中心 Y ≈ 92.4%）

| 列 | Drum keys 第 1–8 列 X | Synth 区第 1–4 列 X |
|---|---|---|
| 值 | 5.4% / 10.1% / 14.8% / 19.5% / 24.2% / 28.9% / 33.6% / 38.3% | 43.2% / 47.8% / 52.4% / 57.2% |

**其它元素**

| 元素 | X | Y |
|---|---|---|
| YAMAHA 标牌 | 8.3%–16.6% | 上缘之外（约 −10%–0%） |
| [BAR LENGTH] / [OCTAVE] / [SCALE] / [KEY] / [REC SAMPLE] | 43.2% / 46.6% / 50.1% / 53.6% / 57.0% | 0%（上缘），标签 ≈ 4% |
| [UNDO/REDO] | 72.5% | 0%（上缘） |
| [CLEAR FX] | 79.6% | 0%（上缘） |
| Sound Design Page button | 72.5% | 100%（下缘），"•••" 标记 ≈ 97% |
| FX Page button | 79.6% | 100%（下缘），点阵标记 ≈ 97% |
| [MASTER/SINGLE] 开关 | 79.6% | 39.3% |
| [FX LEVEL] 滑条 | 中心 79.6% | 60.7%–90.4%（标签 ≈ 56%） |
| [HIGH PASS] 滑条 | 中心 86.5% | 同上 |
| [REPEATER] 滑条 | 中心 93.5% | 同上 |
| Global Meter 的 8 个 LED | 67.8% | 自上而下 17.0% / 26.6% / 36.0% / 45.5% / 55.2% / 64.6% / 74.2% / 83.5% |
| Index 的 20 行文字 | 中心 63.1% | 第 1 行 7.5%，之后每行 +4.53%，第 20 行 93.7% |
| 左侧面 7 个标签 | 1.4% | 8.8% / 23.0% / 37.5% / 51.5% / 64.6% / 78.7% / 92.7% |
| 右侧面 8 个标签 | 98.6% | 10.1% / 23.0% / 34.8% / 46.6% / 60.1% / 70.8% / 82.0% / 93.3% |

来源：
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_002.html （面板各部名称与功能）
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_001.html （1.2 三个 section）
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_018.html （18.1 规格）
- 插图（单张地址可直接打开，目录本身不能浏览）：
  - https://manual.yamaha.com/mi/de/seqtrak/en/images/image015.png （三分区）
  - https://manual.yamaha.com/mi/de/seqtrak/en/images/image024.png （整机编号）
  - https://manual.yamaha.com/mi/de/seqtrak/en/images/image025.png （左侧）
  - https://manual.yamaha.com/mi/de/seqtrak/en/images/image027.png （Drum / Synth 区）
  - https://manual.yamaha.com/mi/de/seqtrak/en/images/image028.png （Sound Design & FX 区）
  - https://manual.yamaha.com/mi/de/seqtrak/en/images/image029.png （右侧）

---

## 2. 轨道一览

### 2.1 11 条轨道

| # | 轨道名（= Track knob 名） | 所属类型 | 音源引擎 | MIDI 通道 | 位置 |
|---|---|---|---|---|---|
| 1 | KICK | Drum track（鼓轨） | 见下方说明 | 1 | Drum section 上排第 2 个 |
| 2 | SNARE | Drum track | 同上 | 2 | 上排第 3 个 |
| 3 | CLAP | Drum track | 同上 | 3 | 上排第 4 个 |
| 4 | HAT 1 | Drum track | 同上 | 4 | 下排第 1 个 |
| 5 | HAT 2 | Drum track | 同上 | 5 | 下排第 2 个 |
| 6 | PERC 1 | Drum track | 同上 | 6 | 下排第 3 个 |
| 7 | PERC 2 | Drum track | 同上 | 7 | 下排第 4 个 |
| 8 | SYNTH 1 | Synth track（合成器轨） | **AWM2** | 8 | Synth section 上排左 |
| 9 | SYNTH 2 | Synth track | **AWM2** | 9 | 上排右 |
| 10 | DX | Synth track | **FM**（4 算子） | 10 | 下排左 |
| 11 | SAMPLER | SAMPLER track（采样轨） | 采样播放，见下方说明 | 11 | 下排右 |

**关于音源引擎，手册明确写出的只有这些：**
- SYNTH 1、SYNTH 2 来自 AWM2 引擎，DX 来自 FM 引擎（第 7 章开头）。
- 鼓轨改成 "Type 3: Synth" 后变成 **AWM2** 合成器音色（6.7 节）。
- 规格表的 Tone Generator 一栏只列了两种：AWM2、FM（4 operators）。
- 鼓轨（默认的 Type 1: Drum）：User Guide 没有用文字写明引擎。Yamaha USA 产品页在介绍 Synth Track Type 时把鼓轨称作 "AWM2 Tracks"，并与 "FM or Sampler Tracks" 区分开，所以鼓轨属于 AWM2 是有官方依据的，但不是出自 User Guide。
- SAMPLER 轨：官方资料**没有写明**它属于哪个引擎，只把它单独称作 Sampler Track。【未确认】

### 2.2 共同规格

| 项目 | 内容 |
|---|---|
| 复音数 | 规格表只给出**全机**最大复音：AWM2 128、FM 8。**每条轨道各自的复音数**【未确认】。 |
| 每轨 pattern 数 | 最多 6 个。可在 3 个与 6 个之间切换（见 3.7.3）。手册没有明说出厂默认是 3 个；【图示】插图中 pattern 4–6 画成蓝色（未启用状态）。 |
| pattern 最大长度 | 128 steps（= 8 小节，1 小节 = 16 steps） |
| 默认音色 | 手册**没有**列出各轨的默认音色。【未确认】出厂时 project 1–3 是 demo 数据，project 4–8 只含 1 个 KICK step。 |
| 预置音色总数 | Preset sounds 2032 个；Preset Sampler sounds 392 个；可用 App 追加 |
| 效果 | 每轨 1 个 single effect + LP-HP filter + 2 band EQ；全轨共用 send（REVERB、DELAY）与 master effect |

### 2.3 鼓轨的三种 Track Type `[OS V2.00]`

每条鼓轨可以在三种类型间切换（切换方法见 3.4.8）：

| 类型 | 说明 | 操作方式参照 |
|---|---|---|
| Type 1: **Drum**（默认） | 一条轨一个鼓音色，用 Drum keys 输入序列 | 第 6 章（本文 3.4） |
| Type 2: **DrumKit** | 7 个 Synth keys 各分配一个鼓音色，一条轨就是一套鼓。Step Input mode 始终开启 | 同 SAMPLER 轨（本文 3.13） |
| Type 3: **Synth** | 把鼓轨变成 AWM2 合成器音色，相当于多出合成器轨 | 同 Synth 轨（本文 3.5） |

刚切到 DrumKit 时，7 个 Synth keys 默认取下列音色类别的第一个音色：1 = KICK，2 = SNARE，3 = CLAP，4 = CLOSED HIHAT，5 = OPEN HIHAT，6 = TOM，7 = SHAKER/TAMBOURINE。DrumKit 里不能放 Synth / DX / SAMPLER 音色；并且只使用鼓音色的波形，原音色上编辑保存过的滤波器、音高等参数不会带入。

### 2.4 音色类别（category jump 用，见 3.3.3）

Drum keys 1–16 各对应一个类别。【图示】

**鼓轨**

| 上排 1–8 | KICK | SNARE | RIM | CLAP | SNAP | CLOSED HIHAT | OPEN HIHAT | SHAKER/TAMBOURINE |
|---|---|---|---|---|---|---|---|---|
| **下排 9–16** | RIDE | CRASH | TOM | BELL | CONGA/BONGO | WORLD | SFX | FAVORITE |

**Synth 轨（SYNTH 1、SYNTH 2、DX）**

| 上排 1–8 | BASS | SYNTH LEAD | PIANO | KEYBOARD | ORGAN | PAD | STRINGS | BRASS |
|---|---|---|---|---|---|---|---|---|
| **下排 9–16** | WOODWIND | GUITAR | WORLD | MALLET | BELL | RHYTHMIC | SFX | FAVORITE |

**SAMPLER 轨**

| 上排 1–8 | VOCAL COUNT | VOCAL PHRASE/CHANT | SINGING VOCAL | ROBOTIC VOCAL/EFFECT | RISER | LASER/SCI-FI | IMPACT | NOISE/DISTORTED SOUND |
|---|---|---|---|---|---|---|---|---|
| **下排 9–16** | AMBIENT/SOUNDSCAPE | SFX | SCRATCH | NATURE/ANIMAL | HIT/STAB/MUSICAL INSTRUMENT SOUND | PERCUSSION | RECORDED SOUND | FAVORITE |

来源：
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_005.html （5.7.2–5.7.4 类别）
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_006.html （6.7 Track Type）
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_007.html （引擎）
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_018.html （18.1 规格、18.2 MIDI 通道）
- https://usa.yamaha.com/files/download/other_assets/5/2226075/SEQTRAK_data_list_En_D0.pdf （Track Type、Sound Category）
- https://usa.yamaha.com/audio/music-audio-production/products/music-production-studios/seqtrak/index.html （产品页：两个音源引擎、鼓轨称作 AWM2 Tracks）

---

## 3. 基础操作的确切步骤

### 3.1 电源、充电、音量、耳机与扬声器

#### 3.1.1 开机 / 关机
1. **长按 [⏻/PLAY] 2 秒以上** → 开机；再长按 2 秒以上 → 关机。
2. 关机时当前 project 会自动保存。

#### 3.1.2 强制关机（死机时）
- **同时按住 [⏻/PLAY] 和 [PROJECT↑]**。
- 开机之后到强制关机之前做的更改**不会保存**。

#### 3.1.3 自动关机（Auto Power Off）
- 未充电状态下 30 分钟无操作会自动关机，并自动保存当前 project。
- 切换禁用 / 启用（30 分钟）：**按住左下角的 Drum key 的同时开机**（即同时长按 [⏻/PLAY] 2 秒）。
- 【图示】插图在下排第 1 个键下标 "DISABLE"、第 2 个键下标 "ENABLE"，确切含义手册文字未解释，见第 8 节。
- 自动关机的时间可以在 App 里改。

#### 3.1.4 充电
1. 把随附的 USB-C to USB-C 线插到 SEQTRAK 的 [USB]。
2. 另一端接 USB 电源适配器或移动电源。
3. 适配器接电源插座。

- 电源要求：**USB Power Delivery (PD)**，输出电压 4.8–5.2 V，输出电流 1.5 A 以上。
- 从低电量充满约 3–5 小时；连续使用约 3–4 小时。可以边充边用。
- 供电不足时，电力会优先用于运行，即使 Global Meter 显示青蓝色也可能充不进电。

**看电量（开机状态）**：**按住 [ALL] 旋钮的同时按 [⏻/PLAY]**（手册文字写的是两者同时按住；插图画的是按住 [ALL]、按 [⏻/PLAY]）。Global Meter 按剩余电量点亮：
- 正在充电：青蓝色
- 没在充电：白色
- 有故障：红色闪烁

**充电指示（关机状态）**：Global Meter **最上面那个 LED** 红色常亮 = 正在充电；熄灭 = 充满；红色闪烁 = 因电池故障等无法充电。关机时不显示电量。

**低电量提示**：Global Meter 每 90 秒红色闪烁 2 秒。

#### 3.1.5 音量（master volume）
- **按 [VOL+] / [VOL−]**；
- 或 **按住 [VOL+] 或 [VOL−] 的同时转动 [ALL] 旋钮** `[OS V2.00]`；
- 或 **按住 [VOL+] / [VOL−] 不放** → 连续变化。
- 【图示】Global Meter 用亮灯数显示音量，最下 = MIN，最上 = MAX。
- 调的是内置扬声器或 [PHONES] 插孔的音量。

#### 3.1.6 耳机与内置扬声器
- 耳机插到右侧面的 [PHONES]（立体声小插孔）。**插着耳机时内置扬声器不出声。**
- 手动关闭扬声器、耳机与扬声器音量是否分别记忆：【未确认】。

来源：
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_003.html
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_016.html （16.4 音量）
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_002.html

---

### 3.2 播放 / 停止、tempo、swing、节拍器

#### 3.2.1 播放 / 停止
- 手册第 2 章说明 [⏻/PLAY] 用于"播放 / 停止 project"；13.2 节在 Song mode 下写的是"按 [⏻/PLAY] 播放，播放中按 [⏻/PLAY] 停止"。
- 【推断】因此普通模式下是**按一下 [⏻/PLAY]** 播放、再按一下停止；按满 2 秒会变成关机。手册没有单独的"播放/停止"小节，也没有写"短按"的时间上限。
- 播放时 11 条轨道各自选中的 pattern 会一起循环，直到停止。

#### 3.2.2 改 tempo（速度）
- **按 [BPM+] / [BPM−]**；
- 或 **按住 [BPM+] 或 [BPM−] 的同时转动 [ALL] 旋钮** `[OS V2.00]`；
- 或 **按住 [BPM+] / [BPM−] 不放** → 数值连续滚动；
- **同时按 [BPM+] 和 [BPM−]** → 回到最近打开的那个 project 的起始速度。
- 范围：5–300 BPM。
- Global Meter 用亮灯数**粗略**显示当前速度（【图示】最下 = 5，最上 = 300）。机身上没有数字显示，精确 BPM 要看 App。
- **Tap tempo：手册里没有。**【未确认】

#### 3.2.3 Swing（摇摆）
- **按 [SWING]**；
- 或 **按住 [SWING] 的同时转动 [ALL] 旋钮** `[OS V2.00]`。
- 调的是"偶数步"的 swing 量，范围 −58 ticks 到 +58 ticks（1 step = 120 ticks）。
- **按住 [DELETE] 的同时按 [SWING]** → 归零（0 ticks）。
- 哪些算"偶数步"按 Launch Quantize 的基准判定。
- Swing 作用于整个 project。
- 单按一次 [SWING] 变化多少：【未确认】。

#### 3.2.4 节拍器
- **按住 [ALL] 旋钮的同时按 [BPM+]** → 开 / 关。
- Global Meter 白色亮 = 开；熄灭 = 关。
- 每 4 个 step 响一次，Launch Quantize 周期的起点是重音。
- 节拍器的音色（5 种可选）和音量（0–127）在 App 里改。

来源：
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_004.html （4.5）
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_002.html
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_013.html （13.2）

---

### 3.3 选择轨道、试听、切换音色

#### 3.3.1 选择轨道 / 试听
- **按某个 Track knob** → 选中该轨。
- **在停止播放的状态下按 Track knob** → 试听该轨的音色。
- 按下 Track knob 时，该旋钮旁的 LED 闪烁：黄色 = 该轨当前选中的是 pattern 1–3；青蓝色 = pattern 4–6（5.3 节 NOTE）。

#### 3.3.2 切换音色（鼓轨、SYNTH 1、SYNTH 2、DX）
1. 按 Track knob 选中轨道。
2. 确认 Sound Design 处于 **Page 1**（见 3.11.1）。
3. **转动 Sound Design knob 1**（最上面、印着 SOUND 的那个）。Index 上 SOUND 亮。

#### 3.3.3 切换音色（SAMPLER 轨）
SAMPLER 轨的 7 个 Synth keys 各放一个采样。
1. **按 [SAMPLER] 旋钮**选中 SAMPLER 轨。
2. **按一个 Synth key** 选中要换的那个采样位（【图示】该键红色闪烁）。
3. Sound Design Page 1 下，**转动 Sound Design knob 1**。

#### 3.3.4 按类别跳转（category jump）
- 在 Sound Design Page 1 下，**按住 Sound Design knob 1 的同时按一个 Drum key** → 直接跳到该键所代表类别的第一个音色。
- 各键对应的类别见 2.4。
- 第 16 个键是 FAVORITE（收藏）。如果没有任何收藏音色，FAVORITE 那个键不亮。收藏的登记方式见 3.11.4。

来源：
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_005.html （5.6、5.7）

---

### 3.4 鼓轨（Drum tracks）

以下除特别说明外，针对默认的 Type 1: Drum。

#### 3.4.1 步进录入
1. **按一个鼓轨的 Track knob**（KICK / SNARE / CLAP / HAT 1 / HAT 2 / PERC 1 / PERC 2）选中它。
2. **按 Drum key** → 该 step 打开；再按 → 关闭。
3. 【图示】打开的 step 亮黄色，关闭的不亮。

#### 3.4.2 翻页（page）
- Drum keys 一次只显示 16 个 step，称为一页。pattern 有 17 步以上时才需要翻页。
- **按 [PAGE]** → 切换页（手册只写"按 [PAGE] 切换页"，没有写每按一次是否固定跳到下一页）；
- 或 **按住 [PAGE] 的同时转动 [ALL] 旋钮** `[OS V2.00]`。
- 当前页在 Global Meter 上以**青蓝色闪烁**显示（【图示】最下 = 第 1 页，最上 = 第 8 页）。

#### 3.4.3 pattern 长度
见 3.7.4（[BAR LENGTH]、[PAGE] + Track knob 两种方法）。

#### 3.4.4 单步微调（Micro Timing）
- **按住一个已打开的 Drum key 的同时转动 Track knob**。
- 此时 Index 上 MICROTIMING 亮。
- 范围：−60 ticks 到 +59 ticks（1 step = 120 ticks）。
- 同时按住多个 Drum key 再转 → 一起调。
- 在 Synth 轨 / SAMPLER 轨的 Step Input mode 下也能调 Micro Timing。

#### 3.4.5 Substep（一步内连打）
1. **长按一个已打开的 Drum key 2 秒以上**。
2. 另一排会亮起 5 个 Drum key（被按的键在上排 → 下排亮 5 个；在下排 → 上排亮 5 个）。
3. 按其中一个来选择。【图示】5 个选项从左到右：

| 位置 | 触发次数 | 插图标注 |
|---|---|---|
| 第 1 个 | ×1（不用 Substep，默认） | 16th |
| 第 2 个 | ×2 | 32th |
| 第 3 个 | ×3 | 8th triplet（八分三连音）`[OS V1.10]` |
| 第 4 个 | ×3 | 16th triplet（十六分三连音） |
| 第 5 个 | ×4 | 64th |

#### 3.4.6 触发概率
- **按住一个已打开的 Drum key 的同时按 [MUTE]** → 该步的触发概率降一级。`[OS V1.10]`
- 共 8 级。Global Meter 用亮灯数显示（【图示】8 个灯全亮 = 100%，只亮最下面 1 个 = 10%；中间各级的百分比手册没写）。
- 已在最低级时再按 → 回到最高级。
- 同时按住多个 Drum key 再按 [MUTE] → 一起降；此时 Global Meter 显示其中最高的那个概率。

#### 3.4.7 实时输入（用 Synth keys 打鼓）
1. **按住任意一个鼓轨的 Track knob 的同时按一个 Synth key** → 进入 Real-time Input mode。
2. 【图示】此时 7 个 Synth keys 分别对应：1 = KICK，2 = SNARE，3 = CLAP，4 = HAT 1，5 = HAT 2，6 = PERC 1，7 = PERC 2。
3. **按 Record key** → 开始录音。录音中 Record key 红色闪烁，Drum keys 上显示 pattern。
4. 用同样的操作（按住鼓轨 Track knob + 按 Synth key）退出该模式。

- 关机后会自动退出该模式。
- 设了 count-in 的话，录音前会先响预备拍。`[OS V1.20]`
- 量化设置（见 3.5.2）对鼓轨实时输入同样生效。
- 轨道类型是 DrumKit 或 Synth 的鼓轨在这个模式下不发声。

#### 3.4.8 切换鼓轨的 Track Type `[OS V2.00]`
1. **按住**要更改的鼓轨的 Track knob。Drum keys 9、10、11 亮起（9 = Drum，10 = DrumKit，11 = Synth）。【图示】当前类型的键是紫色。
2. 保持按住 Track knob，**再长按目标类型对应的 Drum key 5 秒**。期间 Global Meter 逐渐闪烁，表示进度。
3. 目标键变成紫色常亮 = 完成。

- **切换类型会删除该鼓轨上已输入的序列数据。**
- 播放中不能切换类型。

来源：
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_006.html

---

### 3.5 Synth 轨（SYNTH 1、SYNTH 2、DX；也适用于 Type 3: Synth 的鼓轨）

#### 3.5.1 实时演奏与录音
1. **按 [SYNTH 1] / [SYNTH 2] / [DX] 旋钮**选中轨道。
2. **按 Synth keys** 实时演奏（发出当前音阶上的音）。
3. **按 Record key** → 开始录音。录音中 Record key **红色闪烁**，Drum keys 显示 pattern 中的当前位置。
4. 可以叠录（overdub），之前录的音符会保留。但如果录入与已有音符**相同音高**的音，已有音符的长度会被改写。
5. 也可以用外接 MIDI 设备实时输入（通道见 2.1）。
6. 设了 count-in 时，录音前先响预备拍（count-in 的开关见 3.13.6）。

如何**结束**录音：手册没有写。【未确认】

#### 3.5.2 量化（Quantize）
- **按住 [ALL] 旋钮的同时按 Record key** → 开 / 关。
- Global Meter 白色亮 = 开；熄灭 = 关。**默认开**。
- 只影响之后录入的数据，不改动已录好的。
- 量化精度在 App 里设：1/32、1/16T、1/16（默认）、1/8T、1/8、OFF。

#### 3.5.3 八度（Octave）
- **按 [OCTAVE]**；
- 或 **按住 [OCTAVE] 的同时转动 [ALL] 旋钮** `[OS V2.00]`。
- 范围 +2 到 −3 个八度（范围在 `[OS V1.10]` 扩大过）。不影响已录数据。
- 【图示】Global Meter 自下而上 6 个灯对应 −3、−2、−1、0、+1、+2，当前值那个灯青蓝色闪烁。
- 单按一次 [OCTAVE] 是升还是降、是否循环：【未确认】。

#### 3.5.4 音阶（Scale）
- **按 [SCALE]**；
- 或 **按住 [SCALE] 的同时转动 [ALL] 旋钮** `[OS V2.00]`。
- 每个 project 存 8 个音阶。【图示】默认值在 Global Meter 上自上而下是：

| Global Meter（上→下） | 音阶 |
|---|---|
| 第 8 个灯（最上） | MINOR |
| 第 7 个 | MAJOR |
| 第 6 个 | MINOR PENTATONIC |
| 第 5 个 | MAJOR PENTATONIC |
| 第 4 个 | LYDIAN |
| 第 3 个 | DORIAN |
| 第 2 个 | MIXOLYDIAN |
| 第 1 个灯（最下） | PHRYGIAN |

- 不影响已录数据。音阶内容可在 App 里编辑。
- 7 个 Synth keys 各自对应音阶的第几个音：手册没有写。【未确认】

#### 3.5.5 调（Key）
- **按 [KEY]**；
- 或 **按住 [KEY] 的同时转动 [ALL] 旋钮** `[OS V2.00]`。
- 以半音为单位。不影响已录数据。
- 【图示】Global Meter 自下而上 7 个灯对应 C、D、E、F、G、A、B；升半音（C#、D#、F#、G#、A#）用相邻两个灯同时亮表示。

#### 3.5.6 MONO / POLY / CHORD（单音 / 复音 / 和弦）
- Sound Design **Page 1** 下，**转动 Sound Design knob 2** → 在 MONO、POLY、CHORD 之间切换。
- 【图示】Global Meter 最上面 3 个灯自上而下对应 MONO、POLY、CHORD；Index 上 MONO/POLY 或 CHORD 亮。
- 适用于 SYNTH 1、SYNTH 2、DX（以及 Type 3: Synth 的鼓轨）。
- CHORD 状态下，7 个 Synth keys 各自弹出一个预设和弦。

#### 3.5.7 编辑和弦
1. Sound Design Page 1 下，转动 Sound Design knob 2 选到 **CHORD**。
2. **按住 [ALL] 旋钮的同时按**想编辑的那个和弦的 **Synth key**。该和弦的组成音会显示在 Drum keys 上。
3. 【图示】Drum keys 排成一个八度的键盘：下排 9–16 = C D E F G A B C（白键）；上排 2、3 = C#、D#，5、6、7 = F#、G#、A#（黑键）；上排第 1 和第 8 个键亮**蓝色**，用来切换显示的音域。
4. **按 [OCTAVE]** 或按蓝色的 Drum key → 切换显示的音域。
5. **按 Drum key** 添加 / 移除音符。最多 4 个音。
6. **按 Synth key** 试听。

- 不影响已录数据。和弦也可在 App 里编辑。
- 和弦按轨道设定，并且与该 project 的音阶联动。
- key / scale / chord 中超过 G8 的音会改为低一个八度发声。

#### 3.5.8 Keyboard Input mode（把 Drum keys 当键盘弹）
- **按住 [ALL] 旋钮的同时按 [KEY]** → 进入。Drum keys 以键盘的形状亮白色。
- **按 [OCTAVE]** 或按亮蓝色的 Drum key → 切换音域（用 Drum key 切八度是 `[OS V1.20]`）。
- 如何退出：手册没有写。【未确认】

#### 3.5.9 琶音（Arpeggiator）
在 Sound Design 的 **ADVANCED** 第 4 页（进入方式见 3.11.1）：
- Sound Design knob 2 = ARPEGGIATOR TYPE（开关及类型）
- knob 3 = ARPEGGIATOR GATE TIME
- knob 4 = ARPEGGIATOR SPEED
- 同一页的 knob 1 = PORTAMENTO TIME（滑音时间）

Data List 的 Arpeggio Preset List 列了 16 项：Off、Up、Up 2Octave、Down、Down 2Octave、Random、Random 2Octave、Up/Down A、Up/Down A 2Octave、Up/Down B、Up/Down B 2Octave、Thumb Up、Unison、Chord 1、Chord 2、As Played。

#### 3.5.10 步进编辑（Step Input mode）`[OS V1.10]`
1. **按住 [PAGE] 的同时按 Synth 轨的 Track knob（或 [SAMPLER] 旋钮）** → 进入 Step Input mode。同样的操作退出。
2. **按 Drum key** → 打开 / 关闭该 step。【图示】打开的 step 亮青蓝色。
   - 该 step 里放的是这条轨上**最后一次弹过的音**（来自 Synth key、Keyboard Input mode 或外接 MIDI）。
   - 如果最后弹的是多个音（例如 CHORD），就整组放进去。
3. **按住 Drum key 的同时按 Synth key** → 把该 Synth key 的音加入该 step，或从中移除。
   - CHORD 状态下：先清掉该步已有的全部音，再放入该和弦；如果已有的音恰好就是这个和弦，则全部清除。
4. 改音长：**按住一个已打开的 Drum key 的同时转动 [ALL] 旋钮**。
   - 该步有多个音时：**同时按住 Drum key 和对应的 Synth key，再转 [ALL]** → 只改那一个音的长度。
   - 音长显示在 Drum keys 和 Global Meter 上。

- 关机后 Step Input mode 自动退出。
- Step Input mode 下可以改 Micro Timing（按住 Drum key + 转 Track knob，同 3.4.4）。
- Step Input mode 下启用 Parameter Lock 时，Index 上亮的是 PITCH（而不是 MONO/POLY、CHORD），这时可以以半音为单位改所选 step 的音高。【推断】用的是 Sound Design knob 2（平时控制 MONO/POLY/CHORD 的那个）；手册没有直接写旋钮编号。

来源：
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_007.html
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_009.html （9.1.3、9.1.4 的 NOTE 与琶音参数）
- https://usa.yamaha.com/files/download/other_assets/5/2226075/SEQTRAK_data_list_En_D0.pdf （Arpeggio Preset List）

---

### 3.6 Parameter Lock 与 Motion Recording

#### 3.6.1 Parameter Lock（给单个 step 锁参数）
- **按住一个已打开的 Drum key 的同时，转动 Sound Design knob 1–4，或滑动 [FX LEVEL] 触摸滑条**。
- 带有 Parameter Lock 的 step 亮**紫色**。
- 同时按住多个 Drum key 再操作 → 一起锁。
- 给 VOLUME 做 Parameter Lock，改的是该音符的**力度（velocity）**。
- 哪些参数可以锁，看 3.11.2 各表的"可锁"一列（SOUND SELECT 等不能锁）。

#### 3.6.2 删除 Parameter Lock
- 删整个 pattern 里某个参数的锁：**按住 [DELETE] 的同时按**对应的 **Sound Design knob**（或 **[FX] 旋钮**）。
- 只删某一个 step 的 `[OS V1.10]`：**按住该 Drum key 和 [DELETE]，同时按**对应的 **Sound Design knob**（或 **[FX] 旋钮**）。
- 把 step 关掉 → 该 step 的所有 Parameter Lock 一并清除。

#### 3.6.3 Motion Recording（实时录旋钮 / 滑条动作）
- **按住 Record key 的同时，转动 Sound Design knob 1–4，或滑动触摸滑条**（single effect 的参数）。
- Motion Recording 与 Parameter Lock 存的是同一种数据：对已有 Parameter Lock 的地方做 Motion Recording 会覆盖它。
- 是否必须在播放中进行：手册没有写。【未确认】

#### 3.6.4 删除 Motion
- **按住 [DELETE] 的同时按**对应的 **Sound Design knob**（或 **[FX] 旋钮**）。

来源：
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_009.html （9.2、9.3）

---

### 3.7 Pattern

每条轨道最多 6 个 pattern，同一时刻每条轨选中其中 1 个。

#### 3.7.1 用 Track knob 切换 pattern
| 操作 | 效果 |
|---|---|
| **转动** Track knob | 该轨**立即**切换 pattern |
| **按下并转动** Track knob | 该轨**预约切换**（等到 Launch Quantize 对齐点才切） |
| **转动** [ALL] 旋钮 | 11 条轨**同时立即**切换 |
| **按下并转动** [ALL] 旋钮 | 11 条轨同时预约切换 |

- LED：选中 pattern 1–3 时闪**黄色**，选中 4–6 时闪**青蓝色**。
- 【图示】【推断】3 个 LED 的上 / 中 / 下位置对应 pattern 1 / 2 / 3（黄）或 4 / 5 / 6（青蓝）。手册文字没有逐条写明这个对应关系。

#### 3.7.2 用 Drum key 切换 pattern
| 操作 | 效果 |
|---|---|
| **按住** Track knob，**按**亮着的 Drum key（1–6） | 该轨预约切换到 pattern 1–6 |
| **按住** Track knob，**双击** Drum key | 该轨立即切换 |
| **按住** [ALL] 旋钮，**按** Drum key | 11 条轨同时预约切换 |
| **按住** [ALL] 旋钮，**双击** Drum key | 11 条轨同时立即切换 |

【图示】按住 Track knob 时，Drum keys 1–6 的显示：当前选中的 pattern = 黄色；其它可用的 = 白色；4–6 未启用时 = 蓝色。

#### 3.7.3 pattern 数量 3 ⇔ 6
- 3 → 6：**按住 Track knob 的同时按亮蓝色的 Drum key 4–6**。启用后 4–6 变成白色。
- 6 → 3：**按住 Track knob 的同时把 Drum key 4、5、6 三个一起按下**。回到 3 个后 4–6 变回蓝色。

#### 3.7.4 pattern 长度
**方法 A：[BAR LENGTH]**
- **按 [BAR LENGTH]** → 在 1、2、4、8 小节之间切换。
- **按住 [BAR LENGTH] 的同时转动 Track knob** → 以 1 step 为单位，1–128 步。
- **按住 [BAR LENGTH] 的同时按下并转动 Track knob** → 以 1 小节（16 步）为单位。

**方法 B：[PAGE] + Track knob（仅鼓轨）**
- **按住 [PAGE] 的同时转动该鼓轨的 Track knob** → 1–128 步。
- **按住 [PAGE] 的同时按下并转动** → 以 16 步为单位。

**显示**：小节数在 Global Meter 上（【图示】最下 = 1 BAR，最上 = 8 BARS），步数在 Drum keys 上。

**加长时自动复制** `[OS V1.20]`：新增的小节会从已有小节复制内容（新小节里已经有数据则不复制）。

| 新增的小节 | 复制自 |
|---|---|
| 第 2 小节 | 第 1 小节 |
| 第 3 小节 | 第 1 小节 |
| 第 4 小节 | 第 2 小节 |
| 第 5 小节 | 第 1 小节 |
| 第 6 小节 | 第 2 小节 |
| 第 7 小节 | 第 3 小节 |
| 第 8 小节 | 第 4 小节 |

**缩短不丢数据**：超出范围的音符和 Motion 数据会保留，再加长回来就恢复。

> 注意手册内部的不一致：第 2 章对 [BAR LENGTH] 的说明只提到 Synth 轨和 SAMPLER 轨；5.2 节没有限定轨道类型。官方固件页写明 V2.00 把 [BAR LENGTH] 的功能扩展到了鼓轨；Yamaha USA 产品页也写明 OS v2.0 之前 [BAR LENGTH] 只适用于 Synth 轨和 Sampler 轨。所以：固件早于 V2.00 时，鼓轨改长度只能用方法 B。

#### 3.7.5 Launch Quantize（预约切换的对齐周期）
- **按住 [PROJECT↑] 的同时转动 [ALL] 旋钮** → 改 Launch Quantize 的步数。
- **按住 [PROJECT↑] 的同时按下并转动 [ALL] 旋钮** → 以 1 小节（16 步）为单位。
- 小节数显示在 Global Meter，步数显示在 Drum keys。
- 默认：从开始播放起每 16 步一个对齐点。
- 播放中也能调 `[OS V1.10]`。取值上限：【未确认】（插图的 Global Meter 画到 8 BARS）。

#### 3.7.6 删除 pattern
- **按住 [DELETE] 的同时按 Track knob** → 删除该轨**当前选中**的 pattern。完成后该轨 LED 红色闪烁。
- **按住 [DELETE] 的同时按 [ALL] 旋钮** → 删除所有轨当前选中的 pattern。
- "清空整条轨道的全部 6 个 pattern"的一步操作：手册里没有。【未确认】

#### 3.7.7 复制 / 粘贴 pattern `[OS V1.10]`
- 复制：**按住 Track knob（或 [ALL] 旋钮）的同时，长按一个 Drum key 2 秒以上**。成功时 Global Meter 白色闪烁。【图示】插图里长按的是黄色的（当前选中的）那个 pattern 键。
- 粘贴：**同时按住 Track knob（或 [ALL] 旋钮）和 [PAGE]，再按目标 Drum key**。成功时目标 Drum key 闪烁 1 秒。
- Parameter Lock 和 Motion Recording 会一起复制。但两条轨的 effect 类型不同时，effect 参数不会粘贴。

**兼容性**（✓ 可以，✗ 不可以）

| 复制源 → 粘贴目标 | |
|---|---|
| 鼓轨 (Drum) → 鼓轨 (Drum) | ✓ |
| 鼓轨 (DrumKit) → 鼓轨 (DrumKit) | ✓ |
| 鼓轨 (Synth) → 鼓轨 (Synth) | ✓ |
| 鼓轨的三种类型之间互相 | ✗ |
| 鼓轨 (Drum) / (DrumKit) → Synth 轨、SAMPLER 轨 | ✗ |
| 鼓轨 (Synth) → Synth 轨 (SYNTH 1, SYNTH 2, DX) | ✓ |
| 鼓轨 (Synth) → SAMPLER 轨 | ✗ |
| Synth 轨 → Synth 轨 | ✓ |
| Synth 轨 → 鼓轨 (Synth) | ✓ |
| Synth 轨 → 鼓轨 (Drum, DrumKit) | ✗ |
| Synth 轨 → SAMPLER 轨 | ✗ |
| SAMPLER 轨 → SAMPLER 轨 | ✓ |
| SAMPLER 轨 → 鼓轨、Synth 轨 | ✗ |

#### 3.7.8 复制 / 粘贴 step `[OS V1.10]`
- 复制：**长按一个 Drum key 2 秒以上**。成功时 Global Meter 白色闪烁。
- 粘贴：**按住 [PAGE] 的同时按一个 Drum key**。
- 对 Type 3: Synth 的鼓轨、Synth 轨、SAMPLER 轨，必须先进入 Step Input mode。
- 兼容性同上表。
- 注意："长按已打开的 Drum key 2 秒以上"同时也是进入 Substep 选择的手势（3.4.5）。两者如何并存，手册没有说明，见第 8 节。

来源：
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_005.html （5.1–5.5、5.9）
- https://usa.yamaha.com/support/updates/seqtrak_os_updater.html

---

### 3.8 Mute / Solo

#### 3.8.1 Mute（静音）
- **按住 [MUTE] 的同时按 Track knob** → 静音该轨。被静音的轨 LED 亮**绿色**。再做一次 → 取消。
- 有轨道被静音时，**按住 [MUTE] 的同时按 [ALL] 旋钮** → 一次取消全部静音。

#### 3.8.2 Solo（独奏）
- **按住 [SOLO] 的同时按 Track knob** → 独奏该轨，其它轨全部静音。被独奏的轨 LED 亮**青蓝色**。再做一次 → 取消。
- 对已静音的轨做 solo：solo 优先；取消 solo 后恢复原来的静音状态。

Mute 和 Solo 在 Mixer mode、Song mode 下也能用。

#### 3.8.3 SAMPLER 轨里单个采样的静音 `[OS V1.20]`
1. 按 [SAMPLER] 旋钮选中 SAMPLER 轨。
2. **按住 [MUTE] 的同时按 Synth key** → 静音该键上的采样。被静音的 Synth key 亮**绿色**。同样操作取消。

- SAMPLER 轨整轨被静音时，无论单个采样是否静音都不出声。
- 取消 SAMPLER 整轨静音、或"一次取消全部静音"，都**不会**取消单个采样的静音。
- 轨道类型为 DrumKit 的鼓轨也能这样操作。

另有免按住 [MUTE] 的 Mute mode，见 3.15.2。

来源：
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_005.html （5.8）
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_008.html （8.11）

---

### 3.9 Undo / Redo

- **按 [UNDO/REDO]**。
- UNDO：撤销刚才那一步操作；REDO：把被 UNDO 撤销的操作重做一次。
- **只对"声音参数和效果参数的更改"有效**。
- **不能**撤销"音色的选择"和"效果的选择"。
- 手册没有说 UNDO/REDO 能撤销步进输入、录音、删除 pattern 等操作。

同一个按钮如何区分 UNDO 与 REDO（例如是否"第一次按 = 撤销，再按 = 重做"）、能撤销几步：【未确认】

来源：
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_009.html （9.4）

---

### 3.10 Project

SEQTRAK 机身上共有 **8 个 project 槽位**，同一时间只能用 1 个。一个 project 包含 11 条轨、每轨最多 6 个 pattern，以及 tempo、各轨音量等设置和状态。

#### 3.10.1 切换 project
- **按住 [PROJECT↑] 的同时按 Drum key 1–8**（上排）。
- 当前 project 对应的 Drum key 亮**黄色**。
- 切换前会自动保存当前 project。
- 播放中切换会**停止播放**。

#### 3.10.2 保存
- **没有保存操作。** 关机时、切换 project 时自动保存。
- 强制关机（3.1.2）不保存。

#### 3.10.3 临时保存与恢复 `[OS V1.10]`
- 临时保存：**按住 [PROJECT↑] 的同时按当前 project 的 Drum key（亮黄色的那个）**。
- 恢复：**按住 [PROJECT↑] 的同时按亮青蓝色的 Drum key**。
- 【图示】青蓝色的键出现在下排、当前 project 键的正下方（例如 project 2 → Drum key 10）。
- 每次载入 project 后会自动做一次临时保存，所以可以随时回到"刚载入时"的状态 `[OS V1.20]`。
- 只能存 1 份；切换 project 或关机后就没了。
- 采样相关的坑：如果一个采样没保存，而你又往同一个 Synth key 存了别的采样，被覆盖的那个声音也会从临时保存里消失。

#### 3.10.4 删除 project
- **同时按住 [PROJECT↑] 和 [DELETE]，再按对应的 Drum key**。【图示】此时 Drum keys 1–8 亮红色。
- 删除后该 project 里只剩 1 个 KICK step。
- 被删掉的 demo 数据可以通过恢复出厂设置找回（3.16.6）。

#### 3.10.5 新建 project
- 机身上**没有"新建"操作**。出厂时 project 4–8 就是"只有 1 个 KICK step"的空白状态；删除某个 project 也会得到同样的状态。
- App 的内容管理功能可以"按轨指定音色来新建 project"（见第 5 节）。

#### 3.10.6 备份与恢复
- 只能通过 App：把 project 存到 App，或从 App 写回 SEQTRAK。

#### 3.10.7 外部 MIDI clock 同步时切换 project（进阶）`[OS V1.20]`
- 同步外部 MIDI clock 并且正在播放时切换 project：当前 project 在小节末尾（16 步）停止，载入目标 project 后进入"待播放"状态。
- MANUAL PLAYBACK Mode（默认）：待播放时按 [⏻/PLAY]，目标 project 在每 2 小节（32 步）的起点开始播放。
- AUTO PLAYBACK Mode：按 Launch Quantize 的设置自动在小节起点开始。两种模式在 App 里切换。
- **按住 [PROJECT↑] 的同时按 [PAGE]** → 开 / 关上述"按小节停止与启动"的行为。开 = Global Meter 白色亮（默认）；关 = 熄灭，行为与普通切换相同。

来源：
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_004.html
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_014.html

---

### 3.11 Sound Design knobs

#### 3.11.1 翻页
- 4 个旋钮在每一"页"上各控制一个参数。当前被调的参数会在 Index 上亮起。
- **按 Sound Design Page button** → 切换页。【图示】Global Meter 最上面的灯青蓝色 = Page 1，第 2 个灯 = Page 2。
- **长按 Sound Design Page button 2 秒以上** → 进入 advanced settings（更多页、更多参数）。同样的操作退出。
- 手册的参数表里，第 1、2 页不带 ADVANCED 标记，第 3 页起标着 (ADVANCED)。即普通状态下是 **2 页**；进入 advanced settings 后的总页数：鼓轨 3 页、SYNTH 1 / SYNTH 2 各 4 页、DX 5 页、SAMPLER 5 页。
- **转动**旋钮 = 细调；**按下并转动** = 大幅度改变。

#### 3.11.2 各类轨道、各页、各旋钮控制的参数

"可锁"列：✓ = 支持 Parameter Lock / Motion Recording；− = 不支持。"Index" 列 = 调这个参数时 Index 上亮的文字。

**鼓轨（Type 1: Drum、Type 2: DrumKit）**

| 页 | 旋钮 | 参数 | 可锁 | Index |
|---|---|---|---|---|
| 1 | 1 | SOUND SELECT（选音色） | − | SOUND |
| 1 | 2 | PITCH（音高，半音） | ✓ | PITCH |
| 1 | 3 | PAN（声像） | ✓ | PAN |
| 1 | 4 | VOLUME（音量） | ✓ | VOLUME |
| 2 | 1 | AEG ATTACK（起音时间） | ✓ | ATTACK |
| 2 | 2 | AEG DECAY（衰减时间） | ✓ | DECAY |
| 2 | 3 | LP-HP FILTER CUTOFF（滤波截止） | ✓ | FILTER |
| 2 | 4 | LP-HP FILTER RESONANCE（滤波共振） | ✓ | RESONANCE |
| 3 (ADVANCED) | 1 | REVERB SEND | ✓ | REVERB |
| 3 (ADVANCED) | 2 | DELAY SEND | ✓ | DELAY |
| 3 (ADVANCED) | 3 | EQ HIGH GAIN | ✓ | OTHER |
| 3 (ADVANCED) | 4 | EQ LOW GAIN | ✓ | OTHER |

**SYNTH 1、SYNTH 2，以及 Type 3: Synth 的鼓轨**

| 页 | 旋钮 | 参数 | 可锁 | Index |
|---|---|---|---|---|
| 1 | 1 | SOUND SELECT | − | SOUND |
| 1 | 2 | MONO/POLY/CHORD | − | MONO/POLY 或 CHORD |
| 1 | 3 | PAN | ✓ | PAN |
| 1 | 4 | VOLUME | ✓ | VOLUME |
| 2 | 1 | AEG ATTACK | ✓ | ATTACK |
| 2 | 2 | AEG DECAY/RELEASE | ✓ | DECAY |
| 2 | 3 | LP-HP FILTER CUTOFF | ✓ | FILTER |
| 2 | 4 | LP-HP FILTER RESONANCE | ✓ | RESONANCE |
| 3 (ADVANCED) | 1 | REVERB SEND | ✓ | REVERB |
| 3 (ADVANCED) | 2 | DELAY SEND | ✓ | DELAY |
| 3 (ADVANCED) | 3 | EQ HIGH GAIN | ✓ | OTHER |
| 3 (ADVANCED) | 4 | EQ LOW GAIN | ✓ | OTHER |
| 4 (ADVANCED) | 1 | PORTAMENTO TIME（滑音时间） | ✓ | OTHER |
| 4 (ADVANCED) | 2 | ARPEGGIATOR TYPE | − | OTHER |
| 4 (ADVANCED) | 3 | ARPEGGIATOR GATE TIME | ✓ | OTHER |
| 4 (ADVANCED) | 4 | ARPEGGIATOR SPEED | − | OTHER |

**DX**

第 1–4 页与上表相同（第 2 页旋钮 2 在手册 DX 表里写作 AEG DECAY），另多一页：

| 页 | 旋钮 | 参数 | 可锁 | Index |
|---|---|---|---|---|
| 5 (ADVANCED) | 1 | FM ALGORITHM（12 种算法） | ✓ | OTHER |
| 5 (ADVANCED) | 2 | MODULATOR AMOUNT | ✓ | OTHER |
| 5 (ADVANCED) | 3 | MODULATOR FREQUENCY | ✓ | OTHER |
| 5 (ADVANCED) | 4 | MODULATOR FEEDBACK | ✓ | OTHER |

**SAMPLER**

| 页 | 旋钮 | 参数 | 可锁 | Index |
|---|---|---|---|---|
| 1 | 1 | SOUND SELECT | − | SOUND |
| 1 | 2 | PITCH | ✓ | PITCH |
| 1 | 3 | PAN | ✓ | PAN |
| 1 | 4 | VOLUME | ✓ | VOLUME |
| 2 | 1 | AEG ATTACK | ✓ | ATTACK |
| 2 | 2 | AEG DECAY | ✓ | DECAY |
| 2 | 3 | LP-HP FILTER CUTOFF | ✓ | FILTER |
| 2 | 4 | LP-HP FILTER RESONANCE | ✓ | RESONANCE |
| 3 (ADVANCED) | 1 | REVERB SEND | ✓ | REVERB |
| 3 (ADVANCED) | 2 | DELAY SEND | ✓ | DELAY |
| 3 (ADVANCED) | 3 | EQ HIGH GAIN | ✓ | OTHER |
| 3 (ADVANCED) | 4 | EQ LOW GAIN | ✓ | OTHER |
| 4 (ADVANCED) | 1 | START POINT（采样起点） | − | OTHER |
| 4 (ADVANCED) | 2 | END POINT（采样终点） | − | OTHER |
| 4 (ADVANCED) | 3 | LOOP ON/OFF | − | OTHER |
| 4 (ADVANCED) | 4 | LOOP LENGTH | − | OTHER |
| 5 (ADVANCED) | 1 | PEG ATTACK LEVEL（音高包络） | ✓ | OTHER |
| 5 (ADVANCED) | 2 | PEG ATTACK TIME | ✓ | OTHER |
| 5 (ADVANCED) | 3 | PEG DECAY LEVEL | ✓ | OTHER |
| 5 (ADVANCED) | 4 | PEG DECAY TIME | ✓ | OTHER |

SAMPLER 的循环播放及第 4、5 页的新参数是 `[OS V1.20]` 加入的。

**参数说明摘要**
- LOOP ON/OFF：ON = 按住键时循环播放采样；OFF = 每按一次播一遍。
- LOOP LENGTH：从 START POINT 开始播，到 END POINT 后跳回 LOOP POINT；LOOP LENGTH 就是 LOOP POINT 到 END POINT 的长度。
- AEG DECAY/RELEASE：DECAY 是从 attack 电平降到 decay 电平的时间；RELEASE 是松键后到声音消失的时间。
- PORTAMENTO：数值越大，滑到目标音高越慢。MIDI CC 表注明 portamento 需要在 MONO 下使用。

#### 3.11.3 Mixer mode 下旋钮的含义不同
见 3.15.1：Mixer mode 里是**按** Sound Design knob 1–4 来选择 PAN / VOLUME / REVERB SEND / DELAY SEND。

#### 3.11.4 保存音色（同时登记为收藏）
- **按住 [ALL] 旋钮的同时按 Sound Design knob 1**。保存成功时 Global Meter 白色闪烁。
- 保存的音色插在原音色的后面，名称是原名加 `_editNN`（NN 是数字），并自动登记为 FAVORITE。
- 收藏的增删在 App 里做；删除已保存的音色只能在 App 里做（预置音色不能删）。

来源：
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_009.html （9.1、9.5–9.7）
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_018.html （18.7 参数说明、18.3 CC 表）
- https://usa.yamaha.com/files/download/other_assets/5/2226075/SEQTRAK_data_list_En_D0.pdf （Sound Design Parameter List）

---

### 3.12 效果器

#### 3.12.1 三类效果与信号走向
| 类别 | 作用范围 | 串接顺序 | 怎么调 |
|---|---|---|---|
| **Track effects**（轨道效果） | 每条轨各自一套 | 音源 → **SINGLE EFFECT** → **LP-HP FILTER** → **2 BAND EQ** → 轨道音量 | SINGLE EFFECT：开关拨到 SINGLE，[FX] 旋钮 + 触摸滑条。LP-HP FILTER：Sound Design Page 2 的旋钮 3、4。2 BAND EQ：Page 3 的旋钮 3、4。 |
| **Send effects**（发送效果） | 全部轨共用 | 接在轨道效果之后，**DELAY** 与 **REVERB** 并联 | 每轨的 SEND LEVEL：Sound Design Page 3 的旋钮 1（REVERB）、旋钮 2（DELAY），或在 Mixer mode 里调。类型与参数、RETURN LEVEL：在 Mixer mode 里调（3.15.1）。 |
| **Master effects**（主控效果） | 最终的总输出 | **MASTER** → **HIGH PASS** → **REPEATER** → **COMPRESSOR** → **5 BAND EQ** → master volume | MASTER：开关拨到 MASTER，[FX] 旋钮 + 触摸滑条。HIGH PASS、REPEATER：对应的触摸滑条。COMPRESSOR、5 BAND EQ：只能在 App 里调。 |

- 轨道效果的参数是**跟着音色记录**的，换了音色它们会跟着变。
- HIGH PASS 默认是高通滤波器；REPEATER 默认是 BEAT REPEAT（重复输入的声音）。两者的效果类型可在 App 里改。

#### 3.12.2 选择要控制的效果：[MASTER/SINGLE] 开关
- 拨到 **MASTER**：操作作用于全部轨的 master effect。
- 拨到 **SINGLE**：操作只作用于当前选中轨道的 single effect。

#### 3.12.3 换效果类型：[FX] 旋钮
- **转动 [FX] 旋钮**。
- 效果分 8 个类别，每个类别 8 个预设。当前**类别**显示在 Index 上，**预设编号**显示在 Global Meter 上。（规格表另写着 Master Effect 85 种、Single Effect 85 种，那是效果"类型"的总数；机身上用 [FX] 旋钮选的是这 8 × 8 个预设，更多设置在 App 里。）
- 8 个类别按手册 18.4 / 18.5 的顺序是：FILTER、REVERB、DELAY、COMPRESSOR、DISTORTION、MODULATION、DUCKER、OTHER。它们在 Index 上对应的文字是 FILTER、REVERB、DELAY、COMP、DISTORTION、MODULATION、DUCKER、OTHER。

**预设名称**（MASTER 与 SINGLE 相同的合并列出）

| 类别 | 预设 1–8 |
|---|---|
| FILTER | LPF - NO RESONANCE / LPF - LOW RESONANCE / LPF - MID RESONANCE / LPF - HIGH RESONANCE / HPF - NO RESONANCE / HPF - LOW RESONANCE / HPF - MID RESONANCE / HPF - HIGH RESONANCE |
| REVERB | SMALL ROOM 1 / SMALL ROOM 2 / MID ROOM / SMALL HALL / MID HALL / STAGE / GATED REVERB / REVERSE REVERB |
| DELAY | TEMPO DELAY 4TH / PING PONG DELAY 4TH / TEMPO DELAY 8TH DOT / TEMPO DELAY 8TH / PING PONG DELAY 8TH / TEMPO DELAY 16TH / ANALOG DELAY - MODERN / ANALOG DELAY RETRO |
| COMPRESSOR | COMP - SETTING 1 至 COMP - SETTING 8 |
| DISTORTION（**MASTER**） | WAVE FOLDER - SATURATION / COMP DISTORTION / WAVE FOLDER / AMP SIMULATOR 2 - SETTING 1 / AMP SIMULATOR 1 / AMP SIMULATOR 2 - SETTING 2 / BIT CRUSHER / DIGITAL TURNTABLE |
| DISTORTION（**SINGLE**） | WAVE FOLDER - SATURATION / AMP SIMULATOR 2 - SETTING 1 / AMP SIMULATOR 2 - SETTING 2 / JAZZ COMBO / AMP SIMULATOR 1 / SMALL STEREO / BIT CRUSHER / DIGITAL TURNTABLE |
| MODULATION | SPX CHORUS / TEMPO FLANGER / TEMPO PHASER / ENSEMBLE DETUNE / AUTO PAN / TREMOLO / VCM AUTO WAH / RING MODULATOR |
| DUCKER | DUCKER - SETTING 1 至 DUCKER - SETTING 8 |
| OTHER | BEAT REPEAT / TALKING MODULATOR / ROTARY SPEAKER 1 - SLOW / ROTARY SPEAKER 2 - FAST / HARMONIC ENHANCER / AUTO SYNTH / SLICE / VINYL BREAK |

每个预设对应的 PARAMETER 1 / 2 / 3 具体是什么，见手册 18.4、18.5 的表格。

#### 3.12.4 触摸滑条与 FX Page button
- **在 [FX LEVEL] / [HIGH PASS] / [REPEATER] 上滑动手指**调参数。【图示】滑动方向是上下。哪一端是最大值手册没写。
- **按 FX Page button** 切换页。【图示】Global Meter 最上面的灯青蓝色 = Page 1，第 2 个灯 = Page 2。

| 页 | 滑条 | 开关在 MASTER | 开关在 SINGLE |
|---|---|---|---|
| 1 | [FX LEVEL] | MASTER EFFECT PARAMETER 1 | SINGLE EFFECT PARAMETER 1 |
| 1 | [HIGH PASS] | HIGH PASS FILTER CUTOFF | HIGH PASS FILTER CUTOFF |
| 1 | [REPEATER] | BEAT REPEAT LENGTH | BEAT REPEAT LENGTH |
| 2 | [FX LEVEL] | MASTER EFFECT PARAMETER 1 | SINGLE EFFECT PARAMETER 1 |
| 2 | [HIGH PASS] | MASTER EFFECT PARAMETER 2 | SINGLE EFFECT PARAMETER 2 |
| 2 | [REPEATER] | MASTER EFFECT PARAMETER 3 | SINGLE EFFECT PARAMETER 3 |

- **在 Page 1 下，[HIGH PASS] 和 [REPEATER] 永远作用于全部轨**，与 [MASTER/SINGLE] 开关的位置无关。
- HIGH PASS 和 REPEATER 是为现场表演设计的：**手指离开滑条，效果就关闭**。
- 例：开关在 MASTER，选 FILTER 的 1 号预设（LPF - NO RESONANCE）时，Page 1 的三条滑条是 CUTOFF / HIGH PASS FILTER CUTOFF / BEAT REPEAT LENGTH；Page 2 是 CUTOFF / RESONANCE / OUTPUT LEVEL。

#### 3.12.5 CLEAR FX
- **按 [CLEAR FX]** → 把当前所选效果的参数电平降到最小。

#### 3.12.6 效果参数也能做 Parameter Lock / Motion Recording
见 3.6（Parameter Lock 用 [FX LEVEL] 滑条；Motion Recording 用于 single effect）。

来源：
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_010.html
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_018.html （18.4–18.6 预设表）
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_002.html

---

### 3.13 采样（SAMPLER 轨）

SAMPLER 轨最多放 **7 个采样**，每个 Synth key 一个。

#### 3.13.1 演奏与录入序列
1. **按 [SAMPLER] 旋钮**选中轨道。
2. **按 Synth key** 播放对应的采样。
3. **按 Record key** 开始录音（Record key 红色闪烁，Drum keys 显示当前位置）。

#### 3.13.2 采样的基本步骤（内置麦克风 / AUDIO IN / USB 音频）
1. **按 [SAMPLER] 旋钮**选中 SAMPLER 轨。
2. **按一个 Synth key**，决定录到哪个键上。该键**红色闪烁**。
3. **按 [REC SAMPLE]** → 开始采样。
4. **再按 [REC SAMPLE]** → 结束；或录满 16 秒自动结束。

- **每个采样最长 16 秒。**
- 采样源是"内置麦克风 / AUDIO IN"时：如果 [AUDIO IN] 插了线，录的是 AUDIO IN，否则录内置麦克风。
- 采样源是"USB 音频"时：录从 USB 送进来的声音。

#### 3.13.3 切换采样源
- **长按 [REC SAMPLE] 2 秒以上，同时按亮白色的 Drum key**。
- 三个选项【图示】从左到右：**MIC / AUDIO IN**、**USB**、**RESAMPLING**；当前选中的那个亮黄色。
- 这三个键具体是 Drum keys 里的第几个：插图只画了 3 个相邻的键，没标编号。【未确认】

#### 3.13.4 Resampling（重采样：把 SEQTRAK 自己正在播的声音录成采样）
1. 按 3.13.3 把采样源切到 RESAMPLING。
2. 调整各轨的 pattern，准备好要录的声音。
3. 按 3.13.2 开始采样。

- 重采样期间节拍器会被静音（无论节拍器设置如何）。

#### 3.13.5 取消正在进行的采样
- **按住 [DELETE] 的同时按 [REC SAMPLE]**。取消后恢复到采样之前的声音。

#### 3.13.6 采样前的 count-in（预备拍）
- **按住 [ALL] 旋钮的同时按 [REC SAMPLE]** → 开 / 关。
- Global Meter 白色亮 = 开；熄灭 = 关。
- 只在采样源是"内置麦克风 / AUDIO IN"或"USB 音频"时有效。
- 这个设置与实时录音的 count-in 是**同一个开关**（联动）。

#### 3.13.7 Monitoring mode（看输入电平）
- **按住 [REC SAMPLE] 的同时按 [VOL+]** → 进入。SAMPLER 轨的 3 个 LED 白色闪烁，Global Meter 显示输入音量。同样操作退出。

#### 3.13.8 Auto-normalize（自动归一化）
- 采样结束后自动把音量拉到最大。**默认开**。只能在 App 里开关。

#### 3.13.9 编辑采样
用 Sound Design knobs（见 3.11.2 的 SAMPLER 表）：
- Page 1 旋钮 2：PITCH（半音）
- ADVANCED Page 4：START POINT、END POINT、LOOP ON/OFF、LOOP LENGTH
- ADVANCED Page 5：PEG（音高包络）四个参数

编辑后记得保存（3.11.4：按住 [ALL] + 按 Sound Design knob 1）。

#### 3.13.10 步进编辑 SAMPLER 轨
1. **按住 [PAGE] 的同时按 [SAMPLER] 旋钮** → 进入 Step Input mode（同样操作退出）。
2. 按 [SAMPLER] 旋钮选轨，**按 Synth key** 选要编辑的采样。
3. **按 Drum key** 打开 / 关闭 step。Drum keys 只显示当前所选采样的数据。
4. **按住已打开的 Drum key 的同时转动 [ALL] 旋钮** → 改音长。

#### 3.13.11 删除某个采样的序列 `[OS V1.10]`
- 选中 SAMPLER 轨后，**按住 [DELETE] 的同时按 Synth key** → 删除该采样的 pattern 数据。【图示】按住 [DELETE] 时 7 个 Synth keys 亮红色。

#### 3.13.12 从 App 导入采样
- 用 App 的内容管理功能导入追加内容或自己的采样。
- 自己的采样格式要求：**WAV，44.1 kHz，16-bit 或 24-bit，最长 16 秒**。
- 用户波形容量：规格表写 User 500 MB。

来源：
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_008.html
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_009.html （9.1.5、9.7）
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_018.html

---

### 3.14 Song mode 与 Scene mode

- **Song mode**：按预先排好的顺序自动演奏。每个 project 有 1 首 song，一首 song 最多 **16 个 scene**。
- **scene（场景）**：全部轨道各选一个 pattern 的一种组合。
- **Scene mode**：包含在 Song mode 里。单个 scene 一直循环，由你随时手动切换。`[OS V1.10]`

#### 3.14.1 进入与退出
模式按"普通 → Song mode → Scene mode → 普通"的顺序循环，每次都是同一个操作：

| 当前状态 | 操作 | 结果 |
|---|---|---|
| 普通 | **按住 [ALL] 旋钮的同时按 [PROJECT↑]** | 进入 Song mode。Index 上 SONG 亮。**正在播放的话会停止。** |
| Song mode | 同上 | 进入 Scene mode |
| Scene mode | 同上 | 退出，回到普通状态 |

- 要退出 Song mode，必须先进 Scene mode 再退出。
- 退出时**不会**停止播放；pattern 组合与 mute / solo 状态会保留。

#### 3.14.2 Drum keys 的显示【图示】
| 状态 | Song mode | Scene mode |
|---|---|---|
| 没有 scene | 不亮 | 不亮 |
| 有 scene | 白色 | 青蓝色 |
| 当前选中的 scene | 紫色 | 紫色 |

#### 3.14.3 播放 / 停止
- Song mode：**按 [⏻/PLAY]** → 从当前选中的 scene 的开头起，按顺序往后播。再按停止。
- Scene mode：**按 [⏻/PLAY]** → 循环播放当前选中的 scene。再按停止。
- 整首 song 播完后是否从头循环：默认 OFF（最后一个 scene 播完就停），可在 App 里改。

#### 3.14.4 切换 scene
- **按该 scene 对应的 Drum key**。
- Song mode 播放中：等当前 scene 播完才切过去。
- Scene mode：在 Launch Quantize 的对齐点切过去。

#### 3.14.5 在 Song mode 里循环某个 scene
- 播放中**双击该 scene 的 Drum key** → 循环它。循环期间该键紫色与青蓝色交替亮。
- 播放中双击**另一个** scene → 当前 scene 播完后，循环你选的那个。
- 取消循环：**按该 Drum key**，或选别的 scene。

#### 3.14.6 添加 scene
- **按一个不亮的 Drum key（空位）**。当前选中的 scene 会被复制到这个新 scene。最多 16 个。

#### 3.14.7 删除 scene
- **按住 [DELETE] 的同时按亮红色的 Drum key**。后面的 scene 依次前移。
- 正在播放的 scene 不能删。

#### 3.14.8 编辑 scene
- 改 pattern 组合：选中 scene 后，**转动各 Track knob**；**转动 [ALL] 旋钮**一次改 11 条轨。也可以设 mute 和 solo。
- 改 scene 长度（手册写的是在 Song mode 下）：**按住 [PAGE] 的同时转动 [ALL] 旋钮**；**按下并转动** = 以 1 小节（16 步）为单位。小节数显示在 Global Meter，步数显示在 Drum keys。
- 把 [ALL] 旋钮**转到最左**：全部 Drum keys 亮青蓝色，长度变为 **AUTO**（自动取该 scene 里最长的 pattern 的长度）。

调整 scene 的先后顺序（移动、插入）：手册里没有这样的操作。【未确认】

来源：
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_013.html

---

### 3.15 其它模式

#### 3.15.1 Mixer mode（混音台模式）
- 进入 / 退出：**按住 [ALL] 旋钮的同时按 [VOL+]**。进入后 Index 上 MIXER 亮。

**调各轨参数**
1. **按 Sound Design knob 1–4 中的一个**来选要调的参数。自上而下：knob 1 = PAN，knob 2 = VOLUME，knob 3 = REVERB SEND，knob 4 = DELAY SEND。Index 上对应的文字亮起。
2. **转动各 Track knob** → 调该轨的这个参数。数值显示在 Track knob 旁的 LED 和 Global Meter 上。**按下并转动** = 大幅度改变。
3. **转动 [ALL] 旋钮** → 调全局量：整个 project 的 PAN、整个 project 的 VOLUME、REVERB 的 RETURN LEVEL、DELAY 的 RETURN LEVEL（取决于当前选中的参数）。

**调 send effect（REVERB、DELAY）**
- 选中 REVERB SEND 或 DELAY SEND 时，**转动 [FX] 旋钮** → 换预设（各 8 个），预设编号显示在 Global Meter。
- **滑动三条触摸滑条** → 调参数；**按 FX Page button** 换页：

| 页 | [FX LEVEL] | [HIGH PASS] | [REPEATER] |
|---|---|---|---|
| 1 | SEND EFFECT PARAMETER 1 | HIGH PASS FILTER CUTOFF | BEAT REPEAT LENGTH |
| 2 | SEND EFFECT PARAMETER 1 | SEND EFFECT PARAMETER 2 | SEND EFFECT PARAMETER 3 |

- REVERB 的 8 个预设：HD ROOM / R3 ROOM / R3 HALL / HD HALL / R3 PLATE / HD PLATE / SPX STAGE / REV X HALL。
- DELAY 的 8 个预设：TEMPO DELAY 4TH / PING PONG DELAY 4TH / TEMPO DELAY 8TH DOT / TEMPO DELAY 8TH / PING PONG DELAY 8TH / TEMPO DELAY 16TH / ANALOG DELAY - MODERN / ANALOG DELAY RETRO。

#### 3.15.2 Mute mode（静音模式）`[OS V1.20]`
- 进入：**按住 [ALL] 旋钮的同时按 [MUTE]**。[ALL] 旋钮旁的 3 个 LED 亮绿色。
- 退出：**按 [MUTE]**。
- 在这个模式里，**直接按 Track knob** 就能静音 / 取消静音，不用按住 [MUTE]。
- **按 [ALL] 旋钮** → 取消全部静音。
- Mute mode 里**不能预约切换 pattern**。
- 选中 SAMPLER 轨时，按 Synth key 是演奏，不是静音采样。

#### 3.15.3 其它带名字的模式（汇总）
| 模式 | 进入方式 | 详见 |
|---|---|---|
| Real-time Input mode（鼓轨） | 按住鼓轨 Track knob + 按 Synth key | 3.4.7 |
| Step Input mode（Synth / SAMPLER 轨） | 按住 [PAGE] + 按该轨 Track knob | 3.5.10、3.13.10 |
| Keyboard Input mode | 按住 [ALL] + 按 [KEY] | 3.5.8 |
| Monitoring mode | 按住 [REC SAMPLE] + 按 [VOL+] | 3.13.7 |
| Song mode / Scene mode | 按住 [ALL] + 按 [PROJECT↑] | 3.14 |
| Content mode | 由 App 的内容管理功能触发 | 第 5 节 |

来源：
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_011.html
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_012.html
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_018.html （18.6）

---

### 3.16 连接与设置

#### 3.16.1 USB（有线）
- 用随附的 USB-C to USB-C 线把 [USB] 接到手机、平板或电脑。
- 接 Lightning 接口的 iPhone / iPad：需要另购 Apple Lightning to USB 3 Camera Adapter 和 USB-A to USB-C 线。
- **Windows**：先在电脑上安装 **Yamaha Steinberg USB Driver**（从 SEQTRAK 下载页获取），再接线。
- **Mac**：直接接线。
- 电脑只有 USB-A 口时可以用 USB-A to USB-C 线，但：不保证稳定；电脑供电最多 500 mA，某些使用情况下内置电池会被耗尽；想边用边充请接电脑的 USB-C 口。
- USB 音频接口规格：44.1 kHz / 24-bit，输入 2 声道、输出 2 声道。
- **USB 线拔掉后至少等 6 秒再插回去**，否则可能故障。

#### 3.16.2 蓝牙
1. 在 App 里打开 [DEVICE CONNECTION]。
2. 在 SEQTRAK 上**按住 [ALL] 旋钮的同时按 [SWING]**。Global Meter 白色亮 2 秒，之后 SEQTRAK 等待蓝牙连接 30 秒。
3. 在 App 的 [DEVICE CONNECTION] 里选择 `SEQTRAK_` 加 6 位本机专属字母数字的设备名，完成连接。

- 查看连接状态：再做一次"按住 [ALL] + 按 [SWING]"。已有蓝牙连接时，Global Meter **青蓝色**亮 2 秒。
- 蓝牙用于 MIDI 的收发。

#### 3.16.3 Wi-Fi
- 机身上**没有**单独开启 Wi-Fi 的按键操作。先连上蓝牙；当 App 的某个功能（例如 [PROJECT/SOUND MANAGER]）需要 Wi-Fi 时，App 会显示连接设置画面，按画面提示操作。
- 两种方式：SEQTRAK 与设备直连；或经由外部无线接入点连接。
- 只支持 **2.4 GHz** 频段。

**无线功能的限制**：是否可用因国家 / 地区而异；**Windows 版 App 不支持蓝牙和 Wi-Fi**。

#### 3.16.4 MIDI 设备
- **USB-C**：用随附的 USB-C 线连接 MIDI 设备。SEQTRAK 最多可向对方供电 500 mA；但电量太低（Global Meter 只剩 2 个灯或更少）时不供电。
- **随附的 MIDI 转换线**：接右侧面的 [MIDI]。MIDI IN 端收、MIDI OUT 端发。**插拔这根线之前先把 SEQTRAK 和 MIDI 设备都关机**，带电插拔可能影响速度和音色。
- 想边连 MIDI 设备边充电：需要市售的 USB 集线器和 USB 充电适配器，支持的设备列表见下载页。
- 各轨的 MIDI 通道 = 轨道编号 1–11（见 2.1）。

#### 3.16.5 MIDI clock 同步及其它 MIDI 设置
- **MIDI clock**：只能在 App 里设置。手册没有列出具体选项。【未确认具体选项】
- **MIDI output filter**（选择性地开关各种 MIDI 数据的输出）：只能在 App 里设置。
- **MIDI Thru** `[OS V1.20]`：把外部输入的 MIDI 数据转发到指定接口。默认：MIDI = OFF，USB = ON，Bluetooth = ON（转发 Channel Messages 和 System Realtime Messages）。只能在 App 里设置。琶音触发音、被静音轨道的音符等不会经 Thru 输出；USB 作为 Thru 输出目标时，只有连着电脑或 App 才有效。
- 同步外部 MIDI clock 时切换 project 的行为见 3.10.7。

#### 3.16.6 恢复出厂设置（Factory Reset）
- 在关机状态下，**同时按住 [SAMPLER] 旋钮和 [UNDO/REDO]，再开机**（【图示】三个都按住：[SAMPLER] 旋钮、[UNDO/REDO]、[⏻/PLAY]）。
- 初始化期间 Global Meter 亮**红色**；完成后自动启动。
- 这会把 SEQTRAK 的**设置和数据**都恢复成出厂状态（demo project 会回来；自己的内容请先用 App 备份）。

#### 3.16.7 固件更新
- 更新前先把电充满。当前固件版本在 App 里查看。读版本号时只看第一个点之后的两位（例如 V1.10.4 就是 V1.10）。
- 三种方法：

**方法 1：U 盘**
1. 准备支持的 U 盘（列表见下载页；官方固件页写容量需 64 MB 以上）。先格式化：把 U 盘插到 [USB]，**按住 [DX] 旋钮和 [UNDO/REDO] 的同时开机**。格式化完成时 Index 全部亮白色，然后按 [⏻/PLAY] 关机。**格式化会清空 U 盘。**
2. 用电脑从下载页下载最新固件，把压缩包里的更新文件 `8Z33OS_.PGM` 存到 U 盘。
3. SEQTRAK 关机。
4. 把 U 盘插到 SEQTRAK。
5. **按住 [KICK] 旋钮和 [BAR LENGTH] 的同时开机**。
6. 更新过程中各 LED 闪烁；成功后 Index 全亮一段时间，然后自动重启。失败时 Global Meter 红色闪烁，重试即可。

- 格式化和更新过程中不要插拔 U 盘；插、拔之间隔几秒；不要用 USB 延长线，直接插。

**方法 2：App + USB 线**：用随附的 USB-C 线连接，打开 App，按画面提示更新。

**方法 3：App + 蓝牙**：打开 App，按 3.16.2 连上蓝牙，按画面提示更新。

- App 连接后会提示是否需要更新固件。
- 下载页：https://www.yamaha.com/2/seqtrak/

#### 3.16.8 只能在 App 里做的设置（机身上做不了）
| 设置 | 手册出处 |
|---|---|
| Auto Power Off 的时间 | 3.2.3 |
| 外部 MIDI clock 同步时的 MANUAL / AUTO PLAYBACK Mode | 4.1.1 |
| project 的备份 / 恢复 | 4.3 |
| 节拍器的音色（5 种）和音量（0–127） | 4.5.3 |
| 量化精度（1/32、1/16T、1/16、1/8T、1/8、OFF） | 7.2 |
| 编辑 scale、编辑 chord（chord 也可在机身上编辑） | 7.4、7.7 |
| Auto-normalize 的开关 | 8.8 |
| 收藏音色的增删；删除已保存的音色；导入音色 / 采样 | 9.5–9.7 |
| HIGH PASS、REPEATER 的效果类型；COMPRESSOR 的类型与参数；5 BAND EQ 的参数 | 10.1.3 |
| 整首 song 的循环 | 13.2.3 |
| Track knob 的灵敏度 | 16.2 |
| MIDI clock、MIDI output filter、MIDI Thru | 16.3 |
| 查看固件版本 | 第 17 章 |
| 各轨的 LFO、alternate group（如开镲 / 闭镲互斥）、DX 的全部 FM 参数 | 14.1 |

来源：
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_015.html
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_016.html
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_017.html
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_018.html
- https://usa.yamaha.com/support/updates/seqtrak_os_updater.html

---

### 3.17 组合键速查表

"按住 A + 按 B"表示先按住 A 不放，再按一下 B。

| 功能键（按住） | 另一个操作 | 效果 | 章节 |
|---|---|---|---|
| [ALL] | 按 [⏻/PLAY] | 显示电量 | 3.1.4 |
| [ALL] | 按 [BPM+] | 节拍器开 / 关 | 3.2.4 |
| [ALL] | 按 Record key | 量化开 / 关 | 3.5.2 |
| [ALL] | 按 [REC SAMPLE] | count-in 开 / 关 | 3.13.6 |
| [ALL] | 按 [VOL+] | 进入 / 退出 Mixer mode | 3.15.1 |
| [ALL] | 按 [MUTE] | 进入 Mute mode | 3.15.2 |
| [ALL] | 按 [PROJECT↑] | 普通 → Song → Scene → 普通 | 3.14.1 |
| [ALL] | 按 [KEY] | 进入 Keyboard Input mode | 3.5.8 |
| [ALL] | 按 [SWING] | 蓝牙配对 / 查看连接 | 3.16.2 |
| [ALL] | 按 Sound Design knob 1 | 保存音色 | 3.11.4 |
| [ALL] | 按 Synth key（CHORD 状态下） | 编辑该和弦 | 3.5.7 |
| [ALL] | 按 / 双击 Drum key 1–6 | 11 条轨预约 / 立即切换 pattern | 3.7.2 |
| [PROJECT↑] | 按 Drum key 1–8 | 切换 project | 3.10.1 |
| [PROJECT↑] | 按黄色 / 青蓝色 Drum key | 临时保存 / 恢复 | 3.10.3 |
| [PROJECT↑] + [DELETE] | 按 Drum key 1–8 | 删除 project | 3.10.4 |
| [PROJECT↑] | 转动 [ALL] | 改 Launch Quantize | 3.7.5 |
| [PROJECT↑] | 按 [PAGE] | 外部时钟同步时按小节启停 开 / 关 | 3.10.7 |
| [⏻/PLAY] + [PROJECT↑] | （同时按住） | 强制关机 | 3.1.2 |
| [DELETE] | 按 Track knob / [ALL] | 删除当前 pattern（单轨 / 全部轨） | 3.7.6 |
| [DELETE] | 按 [SWING] | swing 归零 | 3.2.3 |
| [DELETE] | 按 [REC SAMPLE] | 取消采样 | 3.13.5 |
| [DELETE] | 按 Synth key（SAMPLER 轨） | 删除该采样的序列 | 3.13.11 |
| [DELETE] | 按 Sound Design knob / [FX] 旋钮 | 删除该参数的 Parameter Lock / Motion | 3.6 |
| [DELETE] | 按红色 Drum key（Song / Scene mode） | 删除 scene | 3.14.7 |
| [MUTE] | 按 Track knob / [ALL] | 静音该轨 / 取消全部静音 | 3.8.1 |
| [MUTE] | 按 Synth key（SAMPLER 轨） | 静音该采样 | 3.8.3 |
| [SOLO] | 按 Track knob | 独奏该轨 | 3.8.2 |
| [PAGE] | 转动 [ALL] | 翻页 | 3.4.2 |
| [PAGE] | 转动鼓轨 Track knob | 改该鼓轨 pattern 长度 | 3.7.4 |
| [PAGE] | 按 Synth 轨 Track knob / [SAMPLER] | 进入 / 退出 Step Input mode | 3.5.10 |
| [PAGE] | 按 Drum key | 粘贴 step | 3.7.8 |
| [PAGE] + Track knob / [ALL] | 按 Drum key | 粘贴 pattern | 3.7.7 |
| [PAGE] | 转动 [ALL]（Song mode） | 改 scene 长度 | 3.14.8 |
| [BAR LENGTH] | 转动 Track knob | 改 pattern 长度（1–128 步） | 3.7.4 |
| [REC SAMPLE]（长按 2 秒） | 按白色 Drum key | 切换采样源 | 3.13.3 |
| [REC SAMPLE] | 按 [VOL+] | 进入 / 退出 Monitoring mode | 3.13.7 |
| [VOL±] / [BPM±] / [SWING] / [OCTAVE] / [SCALE] / [KEY] | 转动 [ALL] | 连续改变对应的值 `[OS V2.00]` | 各节 |
| Track knob | 按 / 双击 Drum key 1–6 | 该轨预约 / 立即切换 pattern | 3.7.2 |
| Track knob | 按蓝色 Drum key 4–6 / 同时按 4、5、6 | pattern 数量 3 → 6 / 6 → 3 | 3.7.3 |
| Track knob / [ALL] | 长按 Drum key 2 秒 | 复制 pattern | 3.7.7 |
| 鼓轨 Track knob | 按 Synth key | 进入 / 退出鼓轨 Real-time Input mode | 3.4.7 |
| 鼓轨 Track knob | 长按 Drum key 9 / 10 / 11 共 5 秒 | 切换 Track Type | 3.4.8 |
| 已打开的 Drum key | 转动 Track knob | Micro Timing | 3.4.4 |
| 已打开的 Drum key | 按 [MUTE] | 触发概率降一级 | 3.4.6 |
| 已打开的 Drum key | 转动 Sound Design knob / 滑 [FX LEVEL] | Parameter Lock | 3.6.1 |
| 已打开的 Drum key | 转动 [ALL]（Step Input mode） | 改音长 | 3.5.10 |
| Drum key | 按 Synth key（Step Input mode） | 往该步加 / 减音符 | 3.5.10 |
| Record key | 转动 Sound Design knob / 滑触摸滑条 | Motion Recording | 3.6.3 |
| Sound Design knob 1 | 按 Drum key | 音色类别跳转 | 3.3.4 |

**开机时按住的组合**（都要同时长按 [⏻/PLAY] 开机）

| 按住 | 效果 | 章节 |
|---|---|---|
| 左下角的 Drum key | Auto Power Off 禁用 / 启用 | 3.1.3 |
| [SAMPLER] 旋钮 + [UNDO/REDO] | 恢复出厂设置 | 3.16.6 |
| [DX] 旋钮 + [UNDO/REDO] | 格式化 U 盘 | 3.16.7 |
| [KICK] 旋钮 + [BAR LENGTH] | 从 U 盘更新固件 | 3.16.7 |

---

## 4. Global Meter 与各指示灯的含义

### 4.1 Global Meter（8 个 LED，竖排）

**作为"数值条"**（亮灯数或亮灯位置表示大小；下 = 小，上 = 大）

| 场景 | 显示内容 | 备注 |
|---|---|---|
| 调音量 | 最下 MIN → 最上 MAX | 【图示】 |
| 调 tempo | 亮灯数粗略表示速度；最下 5 → 最上 300 | 只是大致指示 |
| 调 swing | 最下 −58 ticks → 最上 +58 ticks | 【图示】 |
| pattern 长度、Launch Quantize、scene 长度 | 小节数：最下 1 BAR → 最上 8 BARS | 步数同时显示在 Drum keys |
| 翻页 | 当前页的灯**青蓝色闪烁** | 最下第 1 页 → 最上第 8 页 |
| 八度 | 自下而上 −3、−2、−1、0、+1、+2，当前值青蓝色闪烁 | 【图示】 |
| 音阶 | 自上而下 8 个音阶，当前的青蓝色闪烁 | 【图示】见 3.5.4 |
| 调 | 自下而上 C D E F G A B；半音 = 相邻两灯同亮 | 【图示】 |
| MONO/POLY/CHORD | 最上 3 个灯 = MONO、POLY、CHORD | 【图示】 |
| 触发概率 | 亮灯数 = 概率级别（8 级） | 8 灯 = 100%，1 灯 = 10% |
| 效果预设编号 | 1–8 | [FX] 旋钮 |
| Sound Design 页、FX 页 | 最上 = Page 1，其下 = Page 2 | 【图示】青蓝色 |
| 音长（Step Input mode） | 与 Drum keys 一起显示 | |
| Mixer mode 的参数值 | 与 Track knob 旁 LED 一起显示 | |
| Monitoring mode | 采样输入的音量 | |
| 电量 | 亮灯数 = 剩余电量 | 颜色见下 |

**作为"状态灯"**

| 颜色 / 方式 | 含义 |
|---|---|
| 白色亮 / 熄灭 | 某个开关的 开 / 关：节拍器、量化、count-in、外部时钟同步的按小节启停 |
| 白色闪烁 | 操作成功：复制 pattern、复制 step、保存音色 |
| 白色亮 2 秒 | 开始等待蓝牙连接（之后等待 30 秒） |
| 青蓝色亮 2 秒 | 蓝牙已连接 |
| 青蓝色（电量显示时） | 正在充电 |
| 白色（电量显示时） | 没在充电 |
| 红色闪烁（电量显示时） | 充电 / 电池有故障 |
| 红色闪烁 2 秒，每 90 秒一次 | 电量低 |
| **关机时**最上面 1 个灯红色常亮 | 正在充电（充满后熄灭） |
| **关机时**最上面 1 个灯红色闪烁 | 无法充电（电池故障等） |
| 红色亮 | 正在恢复出厂设置 |
| 红色闪烁 | 固件更新失败 |
| 逐渐闪烁 | 鼓轨 Track Type 切换的进度 |

手册对 Global Meter 的总述：显示正在操作的参数的值，或保存 / 载入数据时的运行状态。

### 4.2 Track knob 旁的 3 个 LED

| 颜色 / 方式 | 含义 |
|---|---|
| 黄色闪烁 | 该轨当前选中的是 pattern 1–3 |
| 青蓝色闪烁 | 该轨当前选中的是 pattern 4–6 |
| 绿色常亮 | 该轨被 mute |
| 青蓝色常亮 | 该轨被 solo（注意与"青蓝色闪烁 = pattern 4–6"区分） |
| 红色闪烁 | 该轨当前的 pattern 刚被删除 |
| 白色闪烁（SAMPLER 的 3 个 LED） | Monitoring mode |
| 绿色（[ALL] 的 3 个 LED） | 处于 Mute mode |
| 红色（[ALL] 的 LED） | 处于 content mode（App 的内容管理） |
| Mixer mode 下 | 表示该轨当前参数的数值（【图示】插图画成蓝色） |
| Song / Scene mode 下 | 【图示】插图画成紫色，表示该 scene 里这条轨用的 pattern |

【图示】【推断】3 个 LED 的上 / 中 / 下位置表示 pattern 1 / 2 / 3（或 4 / 5 / 6）；mute 时，表示 pattern 的那个灯保持原色，其余的灯变绿。这是从插图读出来的，手册文字没有逐条说明。

### 4.3 Drum keys 的灯色

| 颜色 | 含义 |
|---|---|
| 黄色 | 鼓轨上已打开的 step；当前 project；当前 pattern；当前采样源；当前 Substep 选项 |
| 白色 | 可选的项（其它 project、其它已启用的 pattern、Substep 选项、采样源选项、音色类别、Keyboard Input mode 的琴键、Song mode 里已有的 scene、步数显示） |
| 蓝色 | 未启用的 pattern 4–6；和弦编辑 / Keyboard Input mode 里切换音域的键 |
| 青蓝色 | Step Input mode（Synth / SAMPLER 轨）里已打开的 step；临时保存的位置；Scene mode 里已有的 scene；scene 长度为 AUTO（全亮）；音长显示 |
| 紫色 | 带 Parameter Lock 的 step；鼓轨当前的 Track Type；Song / Scene mode 里当前选中的 scene |
| 紫色与青蓝色交替 | Song mode 里正在循环的 scene |
| 红色 | 按住 [PROJECT↑] + [DELETE] 时的 project 1–8；按住 [DELETE] 时可删除的 scene |
| 闪烁 1 秒 | pattern 粘贴成功（目标键） |

### 4.4 Synth keys 与 Record key

| 灯 | 含义 |
|---|---|
| Synth key 红色闪烁 | SAMPLER 轨上当前选中的采样位 |
| Synth key 绿色 | 该采样被 mute |
| Synth keys 红色 | 按住 [DELETE] 时（可删除其序列） |
| Synth key 黄色 | 【图示】被按下 / 正在发声的键 |
| Record key 红色闪烁 | 正在录音 |

### 4.5 Index

- 亮起的文字 = 当前正在调的参数（SOUND、PITCH、PAN……）、当前效果类别（FILTER、REVERB、DELAY、COMP、DISTORTION、MODULATION、DUCKER、OTHER）、或当前模式（MIXER、SONG）。
- MICROTIMING 亮 = 正在调 Micro Timing。
- 没有专属文字的参数（EQ、琶音、FM、采样起止点等）统一亮 OTHER。
- 全部亮白色 = U 盘格式化完成；全部亮一段时间 = 固件更新成功。

来源：
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_001.html （1.1.1 LED 状态记号）
- 第 3–17 章各节（见前文各节来源）；灯色【图示】部分来自这些章节的插图，地址形如 `https://manual.yamaha.com/mi/de/seqtrak/en/images/image032.png`，编号范围 `image032.png`–`image144.png`

---

## 5. SEQTRAK App 功能概览

- 平台：手机（iOS、Android）、平板（iPadOS、Android）、电脑（Windows、Mac）。
- 获取：iOS / iPadOS / Android 版在 App Store、Google Play 搜索 "SEQTRAK"；Windows / Mac 版从 https://www.yamaha.com/2/seqtrak/ 下载。
- 连接：USB 线，或蓝牙 + Wi-Fi（见 3.16）。启动 App 时如有需要会显示连接步骤。
- 手册里的 App 截图是 iOS 版；App 的设计可能不经通知而变更。

手册列出的四大功能：

| 功能（App 内名称） | 能做什么 |
|---|---|
| **[GUI EDITOR]**（GUI 功能） | 在屏幕上做更细的音色设计和效果设置，可调的参数比机身上多。例如：各轨的 LFO；两条鼓轨之间的 alternate group（让某些声音互相打断，如开镲与闭镲）；DX 轨 FM 引擎的全部参数。App 画面会随你在 SEQTRAK 上的操作自动切换。Mixer mode、Song mode 的参数也能在这里做进阶设置。【图示】截图里顶部有播放键、BPM 数字，以及 MASTER、DRUMS、SYNTHS / SAMPLER、PERFORM、SETTINGS、HOME 这几个标签。 |
| **[PROJECT/SOUND MANAGER]**（内容管理功能） | ① 管理 project（逐个备份、恢复）；② 管理音色（添加 / 删除采样、下载追加内容等）；③ 按轨指定音色来新建 project；④ 完整备份（8 个 project 加上机内全部用户音色）。需要 USB 或 Wi-Fi 连接。【图示】截图里有 PROJECTS、SOUNDS、CREATE PROJECT 标签，以及 MY SEQTRAK / BACKUPS 切换。另据 Yamaha USA 产品页，SEQTRAK App v2.0 改进了备份功能，可以随时保存用户音色。 |
| **[VISUALIZER]**（可视化功能） | 生成随 SEQTRAK 演奏实时变化的 3D 物体和视觉效果，可用于现场演出，或录下来发布。有 AR 模式，用设备摄像头把 3D 物体叠加到实景上。 |
| **[DYNAMIC TUTORIAL]**（动态教程功能） | 把你正在 SEQTRAK 上做的操作显示在 App 画面上，帮助边用边学。相关资料在 [RELATED INFORMATION] 里。 |

**Content mode**：在 App 里选择内容管理功能时，SEQTRAK 的 [ALL] 旋钮 LED 亮红色，进入 content mode。这时 SEQTRAK 上只能做两件事：关机、退出 content mode。如果与 App 的连接断了，按 [ALL] 旋钮可退出 content mode。

手册只给了以上概述，没有 App 内各画面的逐步操作说明。

来源：
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_014.html
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_001.html （1.4）
- https://usa.yamaha.com/audio/music-audio-production/products/music-production-studios/seqtrak/index.html （App v2.0 的备份改进）

---

## 6. 新手最容易踩的坑

### 6.1 会丢数据的

1. **切换鼓轨的 Track Type 会删掉该轨已输入的序列。**（6.7 NOTICE）
2. **强制关机不保存。** 同时按住 [⏻/PLAY] 和 [PROJECT↑] 会丢失本次开机后的全部更改。（3.2.2）
3. **没有"保存"按钮。** 只在关机和切换 project 时自动保存。（4.2）
4. **[DELETE] + Track knob 删的是当前选中的 pattern，而且手册没有说能撤销。** [UNDO/REDO] 只管声音和效果参数。（5.4、9.4）
5. **删除 project 后只剩 1 个 KICK step。** demo 只能靠恢复出厂设置找回，而恢复出厂设置会把设置和数据全部重置。（4.4、16.1）
6. **采样后不保存会被覆盖。** 往同一个 Synth key 再录别的采样，之前没保存的就没了，连临时保存里的也一起没。（4.6 NOTE）
7. **临时保存只有 1 份**，切换 project 或关机就消失。（4.6）
8. **用 OS V2.00 创建或保存的数据，在更早的 OS 上可能无法正常工作。**（首页 Information）
9. **格式化 U 盘会清空它。**（17.1 NOTICE）
10. **Parameter Lock 与 Motion Recording 是同一份数据**，后做的会覆盖先做的。（9.3 NOTE）
11. **叠录时弹了与已有音符相同音高的音**，已有音符的长度会被改写。（7.1 NOTE）

### 6.2 "怎么没反应 / 没声音"

1. **[⏻/PLAY] 长按 2 秒是关机**，不是播放。（3.2.1）
2. **插着耳机时内置扬声器不出声。**（第 2 章）
3. **30 分钟无操作会自动关机**（未充电时）。（3.2.3）
4. **[AUDIO IN] 插着线时，麦克风采样变成录 AUDIO IN。**（8.2）
5. **重采样时节拍器被静音。**（8.4 NOTE）
6. **HIGH PASS、REPEATER 手指一离开就关闭**，它们不是"调好就留在那儿"的参数。（10.1.3）
7. **Page 1 下 [HIGH PASS]、[REPEATER] 永远作用于全部轨**，拨 [MASTER/SINGLE] 开关也没用。（第 2 章）
8. **轨道效果的参数跟着音色走**，换音色后会变。（10.1.1）
9. **FAVORITE 键不亮** = 还没有任何收藏音色。（5.7.1 NOTE）
10. **Mute mode 里不能预约切换 pattern。**（12.2 NOTE）
11. **SAMPLER 整轨静音时，单个采样没静音也不出声；"全部取消静音"不会取消单个采样的静音。**（8.11 NOTE）
12. **类型为 DrumKit 或 Synth 的鼓轨，在鼓轨 Real-time Input mode 里不发声。**（6.5 NOTE）
13. **播放中不能切换鼓轨的 Track Type。**（6.7 NOTE）
14. **切换 project 会停止播放；进入 Song mode 也会停止播放。**（4.1、13.1）
15. **Step Input mode、鼓轨 Real-time Input mode 在关机后自动退出**，下次开机要重新进入。（6.5、7.9 NOTE）
16. **DrumKit 只用鼓音色的波形**，你在那个音色上编辑保存过的滤波器、音高等不会带进来。（6.7 NOTE）
17. **进入 content mode（App 的内容管理）后，机身上只能关机或退出该模式。**（14.2 NOTE）
18. **UNDO/REDO 不能撤销"换音色"和"换效果"。**（9.4 NOTE）
19. **缩短 pattern 不会删数据**：超出范围的内容还在，加长回来就恢复。反过来说，"缩短再加长"并不能清空后半段。（5.2 NOTE）
20. **加长 pattern 时新小节会自动复制已有小节的内容**，不是空白的。（5.2）
21. **两条轨的 effect 类型不同时，粘贴 pattern / step 不会带 effect 参数**；而且并非任意两种轨道之间都能复制粘贴。（5.5）
22. **面板上没有数字显示**（第 2 章的面板各部一览里没有屏幕），tempo 只能从 Global Meter 的亮灯数粗略看出。（第 2 章；"精确值要看 App"是依据 App 截图里有 BPM 数字得出的【推断】）

### 6.3 供电与连接

1. **充电器 / 移动电源必须是 USB PD，4.8–5.2 V、1.5 A 以上。** 用错可能损坏或过热；开机状态下突然断电，可能就是电源不达标。（3.1 CAUTION / NOTICE）
2. **USB 线拔掉后至少等 6 秒再插。**（第 2 章 NOTICE）
3. **接电脑的 USB-A 口最多供 500 mA**，可能越用电越少。（15.3 NOTE）
4. **Windows 要先装 Yamaha Steinberg USB Driver。Windows 版 App 不支持蓝牙和 Wi-Fi。**（15.1、15.3、18.1 NOTICE）
5. **蓝牙配对只等 30 秒。** 先在 App 里打开 [DEVICE CONNECTION]，再按机身上的组合键。（15.1.2）
6. **Wi-Fi 只支持 2.4 GHz。**（15.1.3 NOTE）
7. **无线功能是否可用因国家 / 地区而异。**（15.1）
8. **插拔随附的 MIDI 转换线之前，先把两边都关机。**（15.2.2 NOTICE）
9. **电量低到 Global Meter 只剩 2 个灯时，不再给 USB MIDI 设备供电。**（15.2.1）
10. **Android 上，SEQTRAK App 以外的应用可能无法正常使用 USB 音频接口功能。**（18.1 NOTICE）
11. **更新固件前先充满电；更新中不要拔 U 盘；不要用 USB 延长线。**（第 17 章）
12. **导入自己的采样只认 WAV、44.1 kHz、16 或 24-bit、16 秒以内。**（9.7 NOTE）

### 6.4 固件版本造成的差异

教学应用里如果用到下面这些操作，要提醒用户先确认固件是 V2.00，否则做不出来：

- 按住 [VOL±] / [PAGE] / [SCALE] / [OCTAVE] / [KEY] / [BPM±] / [SWING] 的同时转 [ALL] 旋钮来改值（V2.00 新增）。
- 鼓轨用 [BAR LENGTH] 改长度（V2.00 新增）。
- 鼓轨的 DrumKit / Synth 类型（V2.00 新增）。

来源：
- https://manual.yamaha.com/mi/de/seqtrak/en/index.html
- 各 NOTE / NOTICE / CAUTION 所在章节已在每条后面的括号里注明（章节号对应 `SEQTRAK_user_guide_En_D0_0NN.html`）
- https://usa.yamaha.com/support/updates/seqtrak_os_updater.html

---

## 7. 固件版本与各功能的引入版本

### 7.1 结论

- **当前最新固件是 V2.00。** 依据：Yamaha 官方固件页的标题是 "SEQTRAK OS Updater V2.00"，适用对象写的是"固件早于 V2.00 的 SEQTRAK"，更新历史的最后一项是 "V1.21 to V2.00"，下载文件名是 `seqtrak_os_updater_v200.zip`。
- **本文依据的 User Guide（D0，Published 01/2026）就是 OS V2.00 对应的版本**，也是目前在线的最新版手册。
- 版本历史：V1.00 → V1.10 → V1.20 → V1.21 → V2.00。
- 官方固件页没有写各版本的发布日期。

### 7.2 各版本新增功能（依据官方固件页的 "Main Revisions and Enhancements"）

| 版本 | 新增功能 | 本文对应章节 |
|---|---|---|
| **V2.00** | 鼓轨新增 "DrumKit" 类型（一条轨最多 7 个鼓音色） | 2.3、3.4.8 |
| | 鼓轨新增 "Synth" 类型（鼓轨当合成器轨用） | 2.3、3.4.8 |
| | [BAR LENGTH] 的功能扩展到鼓轨 | 3.7.4 |
| | 按住 VOL+/−、PAGE、SCALE、OCTAVE、KEY、BPM+/−、SWING 的同时转 [ALL] 旋钮来改值 | 3.1.5、3.2、3.4.2、3.5 |
| **V1.21** | 仅修复问题（连接 App 时意外自动复制 pattern；Song mode 下 SINGLE EFFECT 参数错误；部分 Android 设备无法蓝牙连接） | |
| **V1.20** | SAMPLER 音色的循环播放及新的 sound design 参数 | 3.11.2 |
| | SAMPLER 轨 7 个采样位的单独静音 | 3.8.3 |
| | Mute mode | 3.15.2 |
| | 实时录音前的 count-in | 3.5.1、3.13.6 |
| | Keyboard Input mode 下按 Drum key 切八度 | 3.5.8 |
| | 加长 pattern 时自动复制 | 3.7.4 |
| | 载入 project 后立即自动临时保存 | 3.10.3 |
| | 外部时钟同步时切换 project 后按小节对齐播放 | 3.10.7 |
| | MIDI Thru | 3.16.5 |
| **V1.10** | Synth 轨的 Step Input mode | 3.5.10 |
| | pattern 的复制与粘贴 | 3.7.7 |
| | step 的复制与粘贴 | 3.7.8 |
| | project 的临时保存 | 3.10.3 |
| | Substep 新增八分三连音选项 | 3.4.5 |
| | 更改 step 的触发概率 | 3.4.6 |
| | 按采样删除 pattern | 3.13.11 |
| | 删除某个 step 的指定 Parameter Lock | 3.6.2 |
| | 八度范围扩大 | 3.5.3 |
| | Scene mode | 3.14 |
| | 播放中调整 Launch Quantize | 3.7.5 |

- User Guide D0 正文里**唯一**带版本标注的地方是 6.7 节标题的 `[OS V2.00]`。上表其余内容都来自固件页，而不是手册。
- V2.00 的四项变化在 Yamaha USA 产品页的 "SEQTRAK OS v2.0" 介绍里也有同样的说明；该页还提到 SEQTRAK App v2.0 支持全部 OS v2.0 功能并改进了备份（可随时保存用户音色）。
- 上表没有列出的功能，官方资料里没有说明是哪一版引入的；可以认为是 V1.00 起就有，但这是【推断】。

来源：
- https://usa.yamaha.com/support/updates/seqtrak_os_updater.html
- https://usa.yamaha.com/audio/music-audio-production/products/music-production-studios/seqtrak/index.html
- https://manual.yamaha.com/mi/de/seqtrak/en/index.html
- https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_006.html

---

## 8. 未确认 / 手册中没有找到的内容

以下内容在所读的官方资料里**没有找到**，或者只在插图里出现而文字没有说明。教学应用里不要把它们当作事实；需要用到时请实机验证。

### 8.1 任务清单里问到、但手册没有的功能

| # | 内容 | 现状 |
|---|---|---|
| 1 | **Tap tempo** | User Guide 全文没有出现。改 tempo 只有 [BPM+] / [BPM−] 及其与 [ALL] 的组合。 |
| 2 | **各轨道各自的复音数** | 只有全机最大复音（AWM2 128、FM 8）。 |
| 3 | **各轨道的默认音色** | 没有列出。只知道出厂时 project 1–3 是 demo，4–8 只有 1 个 KICK step。 |
| 4 | **SAMPLER 轨的音源引擎名称** | 官方资料没有写明。User Guide 只明确了 SYNTH 1 / 2 = AWM2、DX = FM、鼓轨 Type 3 = AWM2；鼓轨（Type 1）属于 AWM2 的依据来自产品页而非 User Guide。 |
| 5 | **每轨 pattern 数的出厂默认值（3 还是 6）** | 文字没有明说；插图把 4–6 画成未启用。 |
| 6 | **清空整条轨道（全部 pattern）的一步操作** | 没有。只有"删除当前选中的 pattern"。 |
| 7 | **机身上新建 project 的操作** | 没有。只能删除（得到空白）或用 App 新建。 |
| 8 | **project 的手动保存操作** | 没有，只有自动保存和临时保存。 |
| 9 | **MIDI clock 的具体设置项**（内部 / 外部、收 / 发等） | 只写了"在 App 里设置"。 |
| 10 | **Wi-Fi 的机身开启方式** | 没有，由 App 引导。 |
| 11 | **App 各功能的逐步操作** | 手册只有功能概述。任务里提到的 "sound manager"、"project manager" 在手册里是合在一起的 [PROJECT/SOUND MANAGER]。 |
| 12 | **调整 scene 顺序（移动、插入）** | 没有。只有"添加到空位"和"删除后后面的前移"。 |
| 13 | **逐音符输入力度（velocity）的专门方法** | 没有。只提到给 VOLUME 做 Parameter Lock 会改变力度。 |

### 8.2 操作细节上手册没写清的地方

| # | 内容 | 现状 |
|---|---|---|
| 14 | **[UNDO/REDO] 一个按钮如何区分撤销与重做；能撤销几步** | 只写了"按 [UNDO/REDO]"。 |
| 15 | **如何结束实时录音** | 只写了按 Record key 开始。 |
| 16 | **普通模式下播放 / 停止是"短按"** | 第 2 章只说该键用于播放 / 停止，没有写按多久；"短按"是由"长按 2 秒 = 电源"推出来的。 |
| 17 | **单按一次 [OCTAVE] / [SCALE] / [KEY] / [SWING] / [BAR LENGTH] 的步进方向与是否循环** | 只写了"按"。[BAR LENGTH] 只知道在 1 / 2 / 4 / 8 小节之间切换。 |
| 18 | **"长按已打开的 Drum key 2 秒以上"同时是"复制 step"和"进入 Substep 选择"** | 两节用的是同一个手势，手册没有说明如何区分或是否同时发生。 |
| 19 | **"复制 step"复制的范围** | 文字说的是复制所选轨道的 steps；插图里是长按一个键、粘贴到另一个键。是单步还是多步没有说清。 |
| 20 | **切换采样源时那 3 个 Drum key 是第几个** | 插图只画了 3 个相邻的键，没有编号。 |
| 21 | **Auto Power Off 插图里 "DISABLE"（下排第 1 键）、"ENABLE"（下排第 2 键）的确切含义** | 文字只说"按住左下角的 Drum key 开机"来切换。 |
| 22 | **Track knob 旁 3 个 LED 的位置与 pattern 编号的对应** | 文字只说黄色 = 1–3、青蓝色 = 4–6；"上中下 = 1 / 2 / 3"是读图得出的。 |
| 23 | **7 个 Synth keys 各对应音阶的第几个音** | 只说按 Synth key 演奏音阶上的音。 |
| 24 | **Keyboard Input mode 如何退出** | 没写。 |
| 25 | **Motion Recording 是否必须在播放中做** | 没写。 |
| 26 | **Launch Quantize 的取值上限** | 没写；插图的 Global Meter 画到 8 BARS。 |
| 27 | **触发概率 8 级各自的百分比** | 插图只标了两端：100% 和 10%。 |
| 28 | **触摸滑条哪一端是最大值** | 插图只画了上下滑动。 |
| 29 | **按住鼓轨 Track knob + 按 Synth key 进入 Real-time Input mode 时，是否任意 Synth key 都行** | 文字写的是"按一个 Synth key"；插图按的是 Synth key 1。 |
| 30 | **micro timing 时转的是哪个 Track knob** | 文字写"转动 Track knob"，没有限定必须是当前轨的那个。 |
| 31 | **DrumKit 类型下的具体操作** | 手册只说"参照 SAMPLER 轨一章"。 |
| 32 | **手动关闭内置扬声器；耳机与扬声器音量是否分别记忆** | 没写。 |

### 8.3 面板物理细节

| # | 内容 | 现状 |
|---|---|---|
| 33 | **上缘 7 个按钮和下缘 2 个按钮的确切物理位置**（在顶面边缘，还是在后 / 前侧面上） | 手册把它们归在 "Top Left" / "Top Right"；插图画成凸出机身轮廓的凸起，按压箭头垂直于边缘。没有文字说明。画 SVG 时建议照手册的画法，放在面板上 / 下缘。 |
| 34 | **Sound Design knobs 旁边 "•••" 标记的含义**（是 LED 还是印刷标记） | 没写。 |
| 35 | **背面、底面是否有任何接口或开关** | 手册没有任何描述或插图。 |
| 36 | **Drum keys 上的播放位置指示（走带光标）的颜色与样式** | 只在录音时提到 Drum keys 显示当前位置，没有写颜色。 |
| 37 | **1.8 节的坐标** | 是在 656 × 229 像素的示意图上目测的近似值，不是官方尺寸。 |

### 8.4 没有读到的资料

| # | 资料 | 说明 |
|---|---|---|
| 38 | 旧版英文 User Guide（A0 / B0 / C0） | 地址已全部 404。 |
| 39 | Quick Operation Guide（随机纸质快速指南）、Safety Guide | 没有读。 |
| 40 | Data List 的大部分页面（音色列表、波形列表、效果参数表、MIDI 数据格式等） | 163 页里只读了约 8 页。 |
| 41 | 中文版 User Guide 的大部分正文 | 只通读了第 2、6 章，其余只核对了标题和术语。未发现与英文版矛盾之处，但没有逐句比对。 |
| 42 | User Guide 的 PDF 版 | 已下载，但该 PDF 带加密保护，本机也没有 PDF 渲染工具，所以没有按页阅读；阅读以同为 D0 版的 HTML 为准，没有逐页比对两者是否完全一致。 |
| 43 | SEQTRAK 下载页的各个子页 | 手册里给的短链接 https://www.yamaha.com/2/seqtrak/ 会跳转到所在地区的产品页（本次读到的是 Yamaha USA 产品页的正文）。其下的 Manuals & Documents、Firmware & Software 列表，以及手册提到的"支持的 U 盘列表""已验证的 MIDI 设备列表""支持的 USB 集线器列表"都没有读。 |
| 44 | SEQTRAK App 本体及应用商店页面 | 没有看。第 5 节只依据 User Guide 第 14 章。 |

### 8.5 手册内部或手册与固件页之间的不一致（如实记录）

| # | 内容 |
|---|---|
| 45 | [BAR LENGTH] 的适用范围：第 2 章只提 Synth 轨和 SAMPLER 轨；5.2 节不限定轨道；固件页和产品页说 V2.00 扩展到了鼓轨。 |
| 46 | Record key 的叫法：第 2 章叫 Record key，9.3 节写作 [RECORD] button。【图示】两处插图画的是同一个键。 |
| 47 | [PAGE] 的写法：个别句子里写作 [Page]。 |
| 48 | 琶音类型数量：Data List 列了 16 个预设（含 Off）；User Guide 的 MIDI CC 表里 ARP TYPE 的范围写的是 0–16（0 = OFF）。 |
| 49 | DX 第 2 页旋钮 2：DX 的表里写 AEG DECAY，SYNTH 的表里写 AEG DECAY/RELEASE；Data List 里两者都是 AEG Decay/Release。 |
| 50 | 采样的位深：User Guide 写导入的 WAV 可以是 16-bit 或 24-bit，USB 音频接口是 24-bit；产品页写采样是 44.1 kHz / 16-bit。机内录下的采样实际以什么位深保存，User Guide 没有写。 |

---

## 9. 来源一览

**SEQTRAK User Guide（英文，D0，OS V2.00）**

| 章 | URL |
|---|---|
| 首页 | https://manual.yamaha.com/mi/de/seqtrak/en/index.html |
| 1. What is SEQTRAK? | https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_001.html |
| 2. Panel Sections and Main Functions | https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_002.html |
| 3. Charging and Power Supply | https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_003.html |
| 4. Projects | https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_004.html |
| 5. Tracks and Patterns | https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_005.html |
| 6. Drum Tracks | https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_006.html |
| 7. Synth Tracks (SYNTH 1, SYNTH 2, DX) | https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_007.html |
| 8. SAMPLER Track | https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_008.html |
| 9. Sound Design | https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_009.html |
| 10. Effects | https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_010.html |
| 11. Mixer Mode | https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_011.html |
| 12. Mute Mode | https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_012.html |
| 13. Song Mode | https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_013.html |
| 14. SEQTRAK App | https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_014.html |
| 15. Connections | https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_015.html |
| 16. Settings | https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_016.html |
| 17. Firmware Updates | https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_017.html |
| 18. Documentation | https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0_018.html |
| 插图（image009–image160，共 152 张；目录本身不能浏览，要逐张打开） | 地址形如 https://manual.yamaha.com/mi/de/seqtrak/en/images/image024.png |
| PDF 版 | https://manual.yamaha.com/mi/de/seqtrak/en/SEQTRAK_user_guide_En_D0.pdf |

**其它**

| 资料 | URL |
|---|---|
| User Guide 简体中文版首页（D0） | https://manual.yamaha.com/mi/de/seqtrak/zh/index.html |
| 语言选择页 | https://manual.yamaha.com/mi/de/seqtrak/lang/language.html |
| 官方固件页 SEQTRAK OS Updater V2.00 | https://usa.yamaha.com/support/updates/seqtrak_os_updater.html |
| Yamaha USA 的 SEQTRAK 产品页（含 OS v2.0 更新介绍） | https://usa.yamaha.com/audio/music-audio-production/products/music-production-studios/seqtrak/index.html |
| Data List（D0，For OS V2.00） | https://usa.yamaha.com/files/download/other_assets/5/2226075/SEQTRAK_data_list_En_D0.pdf |
| 手册里给的 SEQTRAK 下载页短链接（会跳转到地区产品页） | https://www.yamaha.com/2/seqtrak/ |
