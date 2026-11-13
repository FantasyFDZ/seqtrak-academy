#!/bin/zsh
# 开发期：给每个页面截图（Mac 上无界面的 Chrome），做设计审查用。两套配色、三个平板横屏尺寸各截一遍。
# 另起一个临时服务（端口 4749，数据放临时目录，预先放进一点“学过几节课”的进度），不碰真实的学习进度。
#
# 用法：zsh tools/shots.sh [配色] [尺寸] [名字里要带的字]
#   配色：body 机身 / neon 霓虹 / both 两套都截（默认）
#   尺寸：s = 1024×768（最小的平板）  m = 1180×820（主要按它设计）  l = 1366×1024（大平板）
#         long = 1180 宽的整页长图（应用本身不整页滚动，这是为了一眼看全一页的版式）
#         all = 上面四种都截（默认）
#   例：zsh tools/shots.sh neon m home     只截霓虹配色、1180×820 下名字里带 home 的那几张
#
#   另：zsh tools/shots.sh sheets         不重新截图，只把现有的图重排成联系表
#
# 图放在 tools/out/shots/<配色>/<尺寸>/；每组另有“联系表” tools/out/shots/sheet-<配色>-<尺寸>-<第几张>.png（所有页面的缩略图排在一起，一张 15 个）。
# 配色是写进进度文件的 settings.skin 里的（和用户在「设置」里选的走同一条路），不是靠地址参数。
# 无界面的浏览器等不到入场动画播完就截图了，所以每个地址都带上 ?still（入场动画和过渡直接到位，见 public/index.html 开头）。
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
D=$(mktemp -d)
BASE=http://localhost:4749
OUT=tools/out/shots
SHEETS_ONLY=0
case "$1" in
  sheets) SHEETS_ONLY=1; SKINS=() ;;
  body|neon) SKINS=($1) ;;
  ""|both) SKINS=(body neon) ;;
  *) echo "用法：zsh tools/shots.sh [body|neon|both] [s|m|l|long|all] [名字里要带的字]"; exit 1 ;;
esac
case "$2" in
  s) SIZES=(1024x768) ;;
  m) SIZES=(1180x820) ;;
  l) SIZES=(1366x1024) ;;
  long) SIZES=(long) ;;
  ""|all) SIZES=(1024x768 1180x820 1366x1024 long) ;;
  *) echo "尺寸只认 s / m / l / long / all"; exit 1 ;;
esac
ONLY=$3
SKIN=body
MOTION=rich
mkdir -p $D/data

put() { curl -s -X PUT -H 'Content-Type: application/json' --data @$D/progress.json $BASE/api/progress > /dev/null; }
settings_obj() { echo "{\"inputOffsetMs\":0,\"metronome\":true,\"speak\":false,\"unlockAll\":false,\"engine\":\"fast\",\"skin\":\"$SKIN\",\"motion\":\"$MOTION\",\"uiSound\":true}"; }
settings() { echo "\"settings\":$(settings_obj)"; }

# 一份“学到一半”的进度：$1 = 哪节课，$2 = 停在第几步（从 0 起）。
# 故意不带 game 那一段：这就是改版之前的旧进度文件的样子，页面要自己把经验值和徽章回算出来。
# 小课堂学过 T1 一关（三星）：首页地图上第 1 章开头的两个小关，一个亮着、一个没亮。
progress() {
  cat > $D/progress.json <<EOF
{"version":1,"profile":{"createdAt":"2026-11-03T09:00:00.000Z","placement":null},
 "lessons":{"0-1":{"stepIndex":0,"done":true,"stars":3,"completedAt":"2026-11-04T10:00:00.000Z"},
            "0-2":{"stepIndex":0,"done":true,"stars":3,"completedAt":"2026-11-05T10:00:00.000Z"},
            "0-3":{"stepIndex":0,"done":true,"stars":2,"completedAt":"2026-11-06T10:00:00.000Z"},
            "1-1":{"stepIndex":0,"done":true,"stars":3,"completedAt":"2026-11-08T10:00:00.000Z"},
            "$1":{"stepIndex":$2,"done":false,"stars":0,"lastAt":"2026-11-10T10:00:00.000Z"}},
 "charts":{"pulse-kick":{"plays":4,"bestAccuracy":0.98,"bestStars":3,"lastAt":"2026-11-10T12:05:00.000Z"},
           "backbeat":{"plays":3,"bestAccuracy":1,"bestStars":3,"lastAt":"2026-11-10T12:07:00.000Z"},
           "hat-eighths":{"plays":2,"bestAccuracy":0.71,"bestStars":1,"lastAt":"2026-11-10T12:09:00.000Z"}},
 "songs":{"picked":[]},
 "classroom":{"T1":{"done":true,"stars":3,"at":"2026-11-08T10:30:00.000Z","times":1}},
 $(settings),
 "practiceDays":["2026-11-04","2026-11-05","2026-11-06","2026-11-08","2026-11-10"],
 "lastResult":null,"drills":[]}
EOF
  put
}

# 一个字都还没学的新用户
fresh() {
  echo "{\"version\":1,\"lessons\":{},\"charts\":{},\"songs\":{\"picked\":[]},$(settings),\"practiceDays\":[],\"lastResult\":null,\"drills\":[]}" > $D/progress.json
  put
}

# 做好的 15 节课全学完了（星数有多有少），今天是连续练习的第 4 天；地图上挂着的 5 个小课堂的小关也都学过，外加效果线的 F1
alldone() {
  node -e '
    const ids = ["0-1","0-2","0-3","1-1","1-2","1-3","1-4","1-5","2-1","2-2","2-3","3-1","3-2","3-3","3-4"];
    const day = (n) => new Date(Date.now() - n * 86400000).toLocaleDateString("sv");
    const lessons = Object.fromEntries(ids.map((id, i) => [id, { stepIndex: 0, done: true, stars: 3 - (i % 4 === 2 ? 1 : 0), completedAt: "2026-11-09T10:00:00.000Z" }]));
    const result = { chartId: "house-kit", title: "House 鼓组", total: 40, counts: { perfect: 31, great: 7, ok: 2, miss: 0 }, extras: 0, accuracy: 0.93, maxCombo: 40, stars: 3, passed: true, meanMs: -14, stdMs: 22, source: "midi" };
    const classroom = Object.fromEntries(["T1", "R1", "T5", "T7", "T10", "F1"].map((id, i) => [id, { done: true, stars: 3 - (i % 3), at: "2026-11-09T11:00:00.000Z", times: 1 }]));
    console.log(JSON.stringify({ version: 1, lessons, charts: { "house-kit": { plays: 6, bestAccuracy: 0.93, bestStars: 3 } }, songs: { picked: [] }, classroom, settings: JSON.parse(process.argv[1]), practiceDays: [9, 8, 3, 2, 1, 0].map(day), lastResult: result, drills: [], panelQuiz: { best: 10, plays: 2 } }));
  ' "$(settings_obj)" > $D/progress.json
  put
}

SERVER=
if [[ $SHEETS_ONLY == 0 ]]; then
  PORT=4749 SEQTRAK_DATA=$D/data node server/server.mjs > $D/server.log 2>&1 &
  SERVER=$!
  sleep 1.5
fi

still() { case "$1" in "?"*) echo "?still&${1#"?"}" ;; *) echo "?still$1" ;; esac; }

# $1 = 文件名，$2 = 地址（# 之后的部分，可以带 ?fake 前缀），$3 = 整页长图的高度，$4 = 等多久（毫秒）
# 几个尺寸同时截（各用各的浏览器配置目录）
shot() {
  [[ -n "$ONLY" && "$1" != *"$ONLY"* ]] && return
  local size w h pids=()
  for size in $SIZES; do
    if [[ $size == long ]]; then w=1180; h=${3:-1500}; else w=${size%x*}; h=${size#*x}; fi
    "$CHROME" --headless=new --disable-gpu --no-first-run --hide-scrollbars --user-data-dir=$D/profile-$SKIN-$size \
      --window-size=$w,$h --virtual-time-budget=${4:-6000} --screenshot=$OUT/$SKIN/$size/$1.png "$BASE/$(still "$2")" > /dev/null 2>&1 &
    pids+=($!)
  done
  wait $pids # 只等这几个浏览器；光写 wait 会连后台的临时服务一起等，永远等不完
  echo "$SKIN/$1 <- $2  $(for size in $SIZES; do printf '%s=%s ' $size "$(ls -l $OUT/$SKIN/$size/$1.png 2>/dev/null | awk '{print $5}')"; done)"
}

# 联系表：把一个目录里的图排成缩略图，方便一眼扫过所有页面。一张表 5 列、最多 3 行（再多就看不清了），放不下就分成 -1、-2 …
sheet() {
  local dir=$OUT/$SKIN/$1 tw=380 rowh files page=1 i n
  if [[ $1 == long ]]; then rowh=760; else rowh=$(( tw * ${1#*x} / ${1%x*} + 40 )); fi
  files=($dir/*.png(N))
  rm -f $OUT/sheet-$SKIN-$1*.png
  for (( i = 1; i <= $#files; i += 15 )); do
    n=$(( $#files - i + 1 )); (( n > 15 )) && n=15
    {
      echo "<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px;background:#777;font:600 13px -apple-system,sans-serif;color:#fff}h1{font-size:15px;margin:0 0 8px}div{display:grid;grid-template-columns:repeat(5,${tw}px);gap:10px;align-items:start}figure{margin:0;height:$(( rowh - 10 ))px;overflow:hidden}img{display:block;width:${tw}px;background:#fff}figcaption{padding:2px 0 0}</style>"
      echo "<h1>$SKIN · $1 · $page</h1><div>"
      for f in $files[i,i+n-1]; do echo "<figure><img src=\"$1/${f:t}\"><figcaption>${f:t:r}</figcaption></figure>"; done
      echo "</div>"
    } > $OUT/$SKIN/sheet.html
    "$CHROME" --headless=new --disable-gpu --no-first-run --hide-scrollbars --user-data-dir=$D/profile-sheet --window-size=1960,$(( (n + 4) / 5 * rowh + 44 )) \
      --screenshot=$OUT/sheet-$SKIN-$1-$page.png "file://$PWD/$OUT/$SKIN/sheet.html" > /dev/null 2>&1
    echo "sheet -> $OUT/sheet-$SKIN-$1-$page.png"
    (( page++ ))
  done
  rm -f $OUT/$SKIN/sheet.html
}

# 只重排联系表、不重新截图：zsh tools/shots.sh sheets
if [[ $SHEETS_ONLY == 1 ]]; then
  for SKIN in body neon; do for size in 1024x768 1180x820 1366x1024 long; do [[ -d $OUT/$SKIN/$size ]] && sheet $size; done; done
  [[ -n $SERVER ]] && kill $SERVER 2>/dev/null
  rm -rf $D
  exit 0
fi

for SKIN in $SKINS; do
  for size in $SIZES; do
    [[ -z "$ONLY" ]] && rm -rf $OUT/$SKIN/$size
    mkdir -p $OUT/$SKIN/$size
  done
  MOTION=rich
  progress 1-2 0
  shot 01-home '#/' 2250
  fresh
  shot 01-home-new '#/' 2250                       # 新用户：一节课都没学
  alldone
  shot 01-home-done '#/' 2250                      # 全学完了
  MOTION=calm
  progress 1-2 2
  shot 01-home-calm '#/' 2250                      # 动效选了“克制”
  MOTION=rich
  progress 1-2 0
  shot 02-lesson-read '#/lesson/0-1' 1500          # 已完成的课从第 1 步开始：讲解
  shot 03-lesson-read-widget '#/lesson/1-2' 1700   # 讲解 + 小部件
  progress 1-2 2
  shot 04-lesson-do-sim '#/lesson/1-2' 1900        # 动手（模拟机）
  shot 05-lesson-do-mirror '?fake=demo#/lesson/1-2' 1900 14000   # 动手（真机镜像）
  progress 1-2 3
  shot 06-lesson-program '#/lesson/1-2' 1900       # 编程挑战
  progress 1-2 4
  shot 07-lesson-quiz '#/lesson/1-2' 1400          # 小测
  progress 1-3 1
  shot 08-lesson-game '#/lesson/1-3' 1700          # 练习（音游）
  progress 1-2 4
  shot 07-lesson-done '?finish#/lesson/1-2' 1400           # 学完一节课：全屏的庆祝（丰富档）
  MOTION=calm
  progress 1-2 4
  shot 07-lesson-done-calm '?finish#/lesson/1-2' 1400      # 克制档：只有页面上的完成页
  MOTION=rich
  progress 1-2 4
  shot 07-lesson-done-2 '?finish=2#/lesson/1-2' 1400       # 两颗星：教练点名是哪一步没拿满
  progress 1-2 4
  shot 07-lesson-done-1 '?finish=1#/lesson/1-2' 1400       # 计分的步骤都跳过了：一颗星
  progress 1-2 2
  shot 07-levelup '?celebrate=level#/lesson/1-2' 1400      # 升级的全屏庆祝
  shot 07-nudge '?nudge#/lesson/1-2' 1400                  # 教练主动冒出来说一句
  progress 1-3 1
  shot 08-lesson-game-stage '?freeze=6#/lesson/1-3' 1700   # 课程里的音游打到一半
  shot 08-lesson-game-result '?result=2#/lesson/1-3' 1700  # 课程里的音游结算
  progress 2-1 0
  shot 08-lesson-piano '#/lesson/2-1' 1900         # 琴键
  progress 0-1 2
  shot 02-lesson-tour '#/lesson/0-1' 1500          # 导览
  progress 0-1 4
  shot 02-lesson-findkeys '#/lesson/0-1' 1500      # 找按键
  progress 1-5 6
  shot 08-lesson-free '#/lesson/1-5' 1500          # 自由创作
  progress 3-1 1
  shot 08-lesson-chords '#/lesson/3-1' 2100        # 第 3 章：叠和弦的小部件
  progress 3-4 0
  shot 08-lesson-chordprog '#/lesson/3-4' 2100     # 和弦进行那一排会亮的方块
  # 第 4 章（合成与音色设计）：音色实验台的几种样子、动手的两栏（模拟机 / 真机镜像）
  progress 4-1 0
  shot 10-ch4-lab-presets '#/lesson/4-1' 2100      # 三张配方：贝斯 / Pad / Lead
  progress 4-1 1
  shot 10-ch4-catkeys '#/lesson/4-1' 1700          # 16 类音色的方键
  progress 4-1 2
  shot 10-ch4-do-sim '#/lesson/4-1' 2100           # 动手：给和弦换 Pad（模拟机）
  shot 10-ch4-do-mirror '?fake#/lesson/4-1' 2100 9000   # 同一步，接着假真机（镜像 + 读数）
  progress 4-2 3
  shot 10-ch4-lab-reso '#/lesson/4-2' 2100         # 滤波器 + 共鸣 + 自动扫一遍
  progress 4-2 5
  shot 10-ch4-trackfilter '#/lesson/4-2' 2100      # 只管贝斯 / 管整台
  progress 4-3 0
  shot 10-ch4-lab-env '#/lesson/4-3' 2100          # 包络：按住听
  progress 4-3 3
  shot 10-ch4-lab-lfo '#/lesson/4-3' 2100          # LFO：一只来回拧的手
  progress 4-3 4
  shot 10-ch4-do-fx '#/lesson/4-3' 2100            # 动手：SINGLE + MODULATION
  progress 4-4 0
  shot 10-ch4-lab-fm '#/lesson/4-4' 2100           # FM 的三个旋钮
  progress 4-4 2
  shot 10-ch4-do-fm-mirror '?fake#/lesson/4-4' 2100 9000  # 动手：拧 FM（假真机，读数自动打勾）
  progress 4-4 5
  shot 10-ch4-do-save '#/lesson/4-4' 2100          # 章节挑战：存音色
  # 第 5–8 章：采样实验台、录采样、编曲台、Song 模式、混音台、触摸条、曲目单、录音机、“写下来”
  progress 5-1 0
  shot 10-ch5-samplelab '#/lesson/5-1' 2100        # 采样实验台：波形、起点终点、变调、7 个键
  progress 5-2 1
  shot 10-ch5-do-record '#/lesson/5-2' 2100        # 动手：录一声（模拟机）
  shot 10-ch5-do-record-mirror '?fake#/lesson/5-2' 2100 9000  # 同一步，接着假真机
  progress 5-4 1
  shot 10-ch5-do-plock '#/lesson/5-4' 2100         # 参数锁
  progress 6-1 1
  shot 10-ch6-do-pattern-mirror '?fake#/lesson/6-1' 2100 9000  # 给底鼓做第 2 段（假真机）
  progress 6-3 1
  shot 10-ch6-do-song '#/lesson/6-3' 2100          # Song 模式排三个 scene
  progress 6-4 0
  shot 10-ch6-arranger '#/lesson/6-4' 2100         # 编曲台 + 能量曲线
  progress 7-1 1
  shot 10-ch7-do-send-mirror '?fake#/lesson/7-1' 2100 9000  # 给和弦送混响（假真机读得出送多少）
  progress 7-1 2
  shot 10-ch7-do-mixer '#/lesson/7-1' 2100         # 混音台模式
  progress 7-2 1
  shot 10-ch7-do-touch '#/lesson/7-2' 2100         # 三条触摸条
  progress 7-3 1
  shot 10-ch7-do-mutemode '#/lesson/7-3' 2100      # 静音模式
  progress 8-1 1
  shot 10-ch8-setlist '#/lesson/8-1' 2100          # 排曲目单
  progress 8-3 2
  shot 10-ch8-reflect '#/lesson/8-3' 1700          # 写下来，请啾啾点评
  progress 8-4 1
  shot 10-ch8-recorder '#/lesson/8-4' 2100         # 录音机
  progress 1-2 0
  shot 09-panel-sim '?tab=explore#/panel' 1500              # 面板页：模拟机（一次看一块）
  shot 09-panel-mirror-open '?fake#/panel' 1500 6000        # 真机镜像刚打开：看整台
  shot 09-panel-mirror '?fake=demo#/panel' 1500 14000       # 真机镜像：机器上按了哪一块，镜头就转到哪一块（演示最后按的是鼓区）
  shot 09-panel-tour '?tab=tour#/panel' 1500                # 导览
  shot 09-panel-quiz '?tab=quiz#/panel' 1500                # 找按键
  shot 09-panel-leds '?tab=leds#/panel' 1500                # 灯色速查
  shot 10-arcade '#/arcade' 1900
  shot 11-arcade-play '#/arcade/house-kit' 1500
  shot 11-arcade-stage-08 '?freeze=5#/arcade/house-kit' 1500     # 打到一半（开发用的静帧）：连击过了 8
  shot 11-arcade-stage-16 '?freeze=9#/arcade/house-kit' 1500     # 连击过了 16
  shot 11-arcade-stage-32 '?freeze=14.5#/arcade/house-kit' 1500  # 连击过了 32
  shot 11-arcade-result '?result#/arcade/house-kit' 1500         # 结算：三星，带经验条和一枚徽章
  shot 11-arcade-result-1 '?result=1#/arcade/house-kit' 1500     # 结算：一星
  shot 11-arcade-result-0 '?result=0#/arcade/backbeat' 1500      # 结算：没过
  shot 11-arcade-play-mirror '?fake=demo#/arcade/house-kit' 1900 14000
  shot 11-arcade-chords '#/arcade/chord-four' 1500
  shot 12-songs '#/songs' 2000
  shot 12-songs-parts '#/songs/faded' 1500         # 一首歌的 SEQTRAK 版分轨（样板）
  shot 12-songs-parts-8bars '#/songs/bad-guy' 1500  # 八小节的歌：格子分两排
  shot 12-songs-parts-starboy '#/songs/starboy' 1500   # 一条分轨比整首短（贝斯只有一小节）
  shot 12-songs-full '#/songs/faded/full' 1500        # 有段落的完整版（Scene × 轨道的表 + 选中轨道的几段乐句）
  shot 12-songs-full-badguy '#/songs/bad-guy/full' 1500  # 段落最多的一首（11 个 Scene，结尾换节奏）
  shot 12-songs-full-playing '?playhead=630#/songs/faded/full' 1500  # 正在放 Drop 的样子（开发用的静帧，不出声）：那一列亮、下面滚到正在放的乐句
  progress song-faded 0
  shot 12-song-lesson-listen '#/lesson/song-faded' 1500     # 曲目的课：先听一遍（课里的小分轨台）
  progress song-faded 5
  shot 12-song-lesson-melody '#/lesson/song-faded' 1500     # 旋律那一步：四小节、高八度
  progress song-faded 6
  shot 12-song-lesson-space '#/lesson/song-faded' 1500      # 加混响（模拟机上没有机器，只有清单）
  progress 1-2 0
  shot 13-device '?fake#/device' 1500 8000
  shot 13-device-off '#/device' 1500                        # 没接机器
  shot 13-device-unfold '?fake&unfold#/device' 3000 8000    # 把“排查问题用的”展开
  shot 14-settings '#/settings' 1500
  shot 14-settings-unfold '?unfold#/settings' 3000          # 把两个折叠都展开
  for size in $SIZES; do sheet $size; done
done

kill $SERVER 2>/dev/null
rm -rf $D
