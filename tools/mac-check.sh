#!/bin/zsh
# 开发期检查：用无界面的 Chrome 打开各个页面，确认在这台 Mac 的 Chrome 上能渲染出来。
# 为了不碰真实的学习进度，这里另起一个临时服务（端口 4748，数据放临时目录），检查完就关掉。
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
D=$(mktemp -d)
BASE=http://localhost:4748

PORT=4748 SEQTRAK_DATA=$D/data node server/server.mjs > $D/server.log 2>&1 &
SERVER=$!
sleep 1.5

"$CHROME" --version
count() { grep -o "$1" $D/dom.html | wc -l | tr -d ' '; }
check() {
  "$CHROME" --headless=new --disable-gpu --no-first-run --user-data-dir=$D/profile --virtual-time-budget=6000 --dump-dom "$BASE/$1" 2>/dev/null > $D/dom.html
  echo "${1:-/} -> bytes=$(wc -c < $D/dom.html | tr -d ' ') map-nodes=$(count 'class="map-node') chart-cards=$(count 'class="chart-card') steps=$(count 'class="step[ "]') panels=$(count 'panel-svg') songs=$(count 'class="song[ "]') games=$(count 'game-canvas') errors=$(count '这一页出错了')"
}
check ''
check '#/panel'
check '#/lesson/0-1'
check '#/lesson/1-4'
check '#/lesson/3-1'
check '#/lesson/3-2'
check '#/lesson/3-3'
check '#/lesson/3-4'
check '#/lesson/song-faded'
check '#/arcade'
check '#/arcade/house-kit'
check '#/arcade/chord-four'
check '#/songs'
check '#/device'
check '#/settings'

# 真机镜像：接一台“假真机”自动演一段（?fake=demo），看状态、清单、解说有没有跟上；再截一张图放到 tools/out/
"$CHROME" --headless=new --disable-gpu --no-first-run --user-data-dir=$D/profile --virtual-time-budget=14000 --dump-dom "$BASE/?fake=demo#/panel" 2>/dev/null > $D/dom.html
echo "mirror -> status-rows=$(count '<dt>') tries-done=$(count 'class="done"') log-lines=$(count '<time>') errors=$(count '这一页出错了')"
echo "mirror say: $(sed -n 's/.*<div class="sim-say">\(.*\)/\1/p' $D/dom.html | sed 's/<\/div>.*//; s/<[^>]*>//g' | head -1)"
echo "mirror status: $(sed -n 's/.*<dl class="mirror-status">\(.*\)/\1/p' $D/dom.html | sed 's/<\/dl>.*//; s/<\/dd>/ | /g; s/<\/dt>/=/g; s/<[^>]*>//g' | head -1)"
mkdir -p tools/out
"$CHROME" --headless=new --disable-gpu --no-first-run --hide-scrollbars --user-data-dir=$D/profile --window-size=1440,1250 --virtual-time-budget=14000 --screenshot=tools/out/mirror.png "$BASE/?fake=demo#/panel" > /dev/null 2>&1
ls -l tools/out/mirror.png | awk '{print "screenshot -> " $NF " " $5 " bytes"}'

# 音游里的真机镜像：“开打之前”的检查卡片 + 舞台旁边的那面镜子（只取要用的那一块：zoomed）
"$CHROME" --headless=new --disable-gpu --no-first-run --user-data-dir=$D/profile --virtual-time-budget=14000 --dump-dom "$BASE/?fake=demo#/arcade/house-kit" 2>/dev/null > $D/dom.html
echo "game mirror -> check-card=$(count 'game-check') mirror=$(count 'class="game-mirror"') zoomed=$(count 'class="panel-wrap zoomed"') check-items=$(count 'class="tick"') games=$(count 'game-canvas') errors=$(count '这一页出错了')"
echo "game check: $(sed -n 's/.*<ul class="mirror-try">\(.*\)/\1/p' $D/dom.html | sed 's/<\/ul>.*//; s/<\/li>/ | /g; s/<[^>]*>//g' | head -1)"
"$CHROME" --headless=new --disable-gpu --no-first-run --hide-scrollbars --user-data-dir=$D/profile --window-size=1440,1700 --virtual-time-budget=14000 --screenshot=tools/out/game.png "$BASE/?fake=demo#/arcade/house-kit" > /dev/null 2>&1
ls -l tools/out/game.png | awk '{print "screenshot -> " $NF " " $5 " bytes"}'

# 音游的舞台和结算（第 2 期）。两个开发用的参数（public/js/gamepanel.js）：?freeze=第几拍 → 舞台停在打到一半的样子；
# ?result → 直接摆出结算卡片。都不真的打，也不记成绩。窗口按最小的平板 1024 × 768 开。
# 舞台：连击数亮着（combo），四种判定的计数亮着（tally），留着一个判定字（fly），连击过了 16 所以 heat=2、横幅摆着（banner）。
# 结算：三颗星都亮（stars-on=3），经验条、徽章那一行都在（xp / badge），教练的脸在卡片上（face）。
# 课程里的音游：结算卡片在（card=1）、三颗星、三段式的三个分段都在（pills=3）。
stage() {
  "$CHROME" --headless=new --disable-gpu --no-first-run --user-data-dir=$D/profile --window-size=1024,768 --virtual-time-budget=6000 --dump-dom "$BASE/$1" 2>/dev/null > $D/dom.html
}
stage '?still&freeze=9#/arcade/house-kit'
echo "game stage -> fill=$(count 'class="game-panel fill"') combo=$(count 'class="stage-combo show[ "]') tally=$(count 'class="stage-tally show"') fly=$(count 'class="fly ') heat=$(grep -o 'class="game-stage[^>]*data-heat="[0-9a-z]*"' $D/dom.html | grep -o 'data-heat="[^"]*"' | cut -d'"' -f2) banner=$(count 'class="stage-banner hold"') errors=$(count '这一页出错了')"
stage '?still&result#/arcade/house-kit'
echo "game result -> card=$(count 'class="game-card result') stars-on=$(grep -o '<div class="stars big-stars">.*' $D/dom.html | sed 's|</div>.*||' | grep -o 'class="on"' | wc -l | tr -d ' ') acc=\"$(grep -o 'class="result-acc"[^>]*data-final="[^"]*' $D/dom.html | sed 's/.*data-final="//')\" xp=$(count 'class="result-xp show"') badge=$(count 'class="xp-badge"') face=$(count '<svg class="face"') errors=$(count '这一页出错了')"
# 课程里的音游：先把进度放到 1.3 的第 2 步（那一步是音游），看完再把进度放回去。用单独的浏览器配置目录，不在别的检查里留下痕迹。
curl -s $BASE/api/progress > $D/saved.json
curl -s -X PUT -H 'Content-Type: application/json' -d '{"version":1,"lessons":{"1-3":{"stepIndex":1,"done":false,"stars":0}},"charts":{},"songs":{"picked":[]},"practiceDays":[],"lastResult":null,"drills":[]}' $BASE/api/progress > /dev/null
"$CHROME" --headless=new --disable-gpu --no-first-run --user-data-dir=$D/profile-lesson --window-size=1024,768 --virtual-time-budget=6000 --dump-dom "$BASE/?still&result#/lesson/1-3" 2>/dev/null > $D/dom.html
curl -s -X PUT -H 'Content-Type: application/json' --data @$D/saved.json $BASE/api/progress > /dev/null
echo "lesson game result -> card=$(count 'class="game-card result') stars-on=$(grep -o '<div class="stars big-stars">.*' $D/dom.html | sed 's|</div>.*||' | grep -o 'class="on"' | wc -l | tr -d ' ') pills=$(count 'class="stage-pill[ "]') errors=$(count '这一页出错了')"

# 课程页（第 3 期）。先把进度放到 1.2 的第 3 步（那一步是动手），窗口按 1024 × 768 开，用单独的浏览器配置目录；看完把进度放回去。
# 动手：左右两栏（split=1），机器只取了要按的那一块（zoomed=1），气泡在（bubble=1），清单 5 项里第 1 项正在做（now=1 todo=4）。
# ?nudge：啾啾主动说的那句冒出来了（nudge=1）；动手的那一步啾啾悬停在要按的键上（hover=1）。?finish：页面上的完成页（done-page=1）和全屏的庆祝（celebrate=1），上面有那一行经验（xp=2：两处各一行）。
curl -s $BASE/api/progress > $D/saved.json
curl -s -X PUT -H 'Content-Type: application/json' -d '{"version":1,"lessons":{"1-2":{"stepIndex":2,"done":false,"stars":0}},"charts":{},"songs":{"picked":[]},"practiceDays":[],"lastResult":null,"drills":[]}' $BASE/api/progress > /dev/null
lesson() {
  "$CHROME" --headless=new --disable-gpu --no-first-run --user-data-dir=$D/profile-lesson --window-size=1024,768 --virtual-time-budget=6000 --dump-dom "$BASE/$1" 2>/dev/null > $D/dom.html
}
lesson '?still#/lesson/1-2'
echo "lesson do -> split=$(count 'class="step-body split') zoomed=$(count 'class="panel-wrap zoomed"') bubble=$(count 'class="do-bubble[ "]') now=$(count '<li class="now">') todo=$(count '<li class="todo">') errors=$(count '这一页出错了')"
lesson '?still&nudge#/lesson/1-2'
echo "lesson nudge -> nudge=$(count 'data-kind="nudge"') hover=$(count 'data-air="hover"') errors=$(count '这一页出错了')"
lesson '?still&finish#/lesson/1-2'
echo "lesson finish -> done-page=$(count 'class="step-body done"') celebrate=$(count 'class="celebrate"') xp=$(count 'class="xp-line"') errors=$(count '这一页出错了')"
curl -s -X PUT -H 'Content-Type: application/json' --data @$D/saved.json $BASE/api/progress > /dev/null

# 其余页面（第 4 期）。窗口按 1024 × 768 开。
# 面板页：模拟机是左右两栏（split=1）、一次看一块（zoomed=1）、上面有分区的开关（zones=1）；导览右边那张卡片在（tour-card=1），进度 12 格。
# 曲目：11 张卡片、11 个封面（2026-11-11 候选换成了用户听过的 11 首），最下面那一行在（bar=1）。设备、设置：折叠默认收着（open=0），地址带 ?unfold 才展开；设置里有两个折叠。
page() {
  "$CHROME" --headless=new --disable-gpu --no-first-run --user-data-dir=$D/profile --window-size=1024,768 --virtual-time-budget=6000 --dump-dom "$BASE/$1" 2>/dev/null > $D/dom.html
}
page '?still&tab=explore#/panel'
echo "panel explore -> split=$(count 'class="split"') zoomed=$(count 'class="panel-wrap zoomed"') zones=$(count 'class="zone-pick"') card=$(count 'class="ctl-card"') errors=$(count '这一页出错了')"
page '?still&tab=tour#/panel'
echo "panel tour -> split=$(count 'class="split tour"') tour-card=$(count 'class="widget tour-card"') stops=$(grep -o '<div class="tour-dots">.*' $D/dom.html | sed 's|</div>.*||' | grep -o '<i ' | wc -l | tr -d ' ') errors=$(count '这一页出错了')"
page '?still#/songs'
echo "songs -> cards=$(count 'class="song[ "]') covers=$(count 'class="song-cover ') bar=$(count 'class="songs-bar"') errors=$(count '这一页出错了')"
# 曲目的 SEQTRAK 版分轨（2026-11-11：27 首都有了）：每张卡片上一颗试听键、一行“一轨一轨听”（plays=27 entry=27）；
# 分轨页 6 条轨道、6 排格子、每条一个独奏一个静音，右边“机器上先这样设”在（setup=1）
echo "songs parts -> plays=$(count 'class="cover-play"') entry=$(count 'class="song-parts"') errors=$(count '这一页出错了')"
page '?still#/songs/faded'
echo "song parts page -> rows=$(count 'class="sp-row"') grids=$(count 'class="sp-grid ') solo=$(count 'sp-solo') mute=$(count 'sp-mute') setup=$(count 'class="sp-setup"') full-link=$(count '/full"') errors=$(count '这一页出错了')"
# 有段落的完整版（content/song-arrangements.js）：像音频软件那样的多轨时间线（2026-11-12 改的）——上面时间尺标出段落（Scene），每条轨道一行、每段乐句一个色块，一根播放头；下面是选中轨道的几段乐句
page '?still#/songs/faded/full'
echo "song full page -> secs=$(count 'class="daw-sec') tracks=$(count 'class="daw-head sf-name') clips=$(count 'class="daw-clip') playhead=$(count 'class="daw-playhead') pats=$(count 'class="sf-pat"') lessons=$(count 'class="sf-lesson"') errors=$(count '这一页出错了')"
# 其余的完整版（2026-11-12 他认了 Faded 的做法之后做的 7 首）：每首的页面都打开一遍
for id in $(node -e "import('./public/js/content/song-arrangements.js').then((m) => console.log(Object.keys(m.ARRANGEMENTS).filter((k) => k !== 'faded').join(' ')))"); do
  page "?still#/songs/$id/full"
  echo "song full $id -> secs=$(count 'class="daw-sec') tracks=$(count 'class="daw-head sf-name') clips=$(count 'class="daw-clip') pats=$(count 'class="sf-pat"') lessons=$(count 'class="sf-lesson"') errors=$(count '这一页出错了')"
done
page '?still#/device'
echo "device -> folds=$(count '<details class="fold"') open=$(count '<details class="fold" open') calib=$(count 'class="card calib"') games=$(count 'game-canvas') errors=$(count '这一页出错了')"
page '?still&unfold#/device'
# 按键体检那张卡片上有两轮：9 步的体检、第 5–8 章的按键（probe-runs=2；没接机器所以只有说明、没有开始按钮）
echo "device unfold -> open=$(count '<details class="fold" open') monitor=$(count 'class="monitor"') probe-runs=$(count 'class="probe-run"') errors=$(count '这一页出错了')"
page '?still#/settings'
echo "settings -> folds=$(count '<details class="fold"') errors=$(count '这一页出错了')"

# 第 3 章：假真机自动选中 SYNTH 2、换音色、切到 CHORD、按两个和弦（?fake=chords），看和弦谱面的检查卡片认不认得出来；
# 再截两张图：和弦谱面（带镜像），和 3.2 课的第一页
"$CHROME" --headless=new --disable-gpu --no-first-run --user-data-dir=$D/profile --virtual-time-budget=14000 --dump-dom "$BASE/?fake=chords#/arcade/chord-two" 2>/dev/null > $D/dom.html
echo "chords -> check-card=$(count 'game-check') check-items=$(count 'class="tick"') ticked=$(count 'class="done"') games=$(count 'game-canvas') errors=$(count '这一页出错了')"
echo "chords check: $(sed -n 's/.*<ul class="mirror-try">\(.*\)/\1/p' $D/dom.html | sed 's/<\/ul>.*//; s/<\/li>/ | /g; s/<[^>]*>//g' | head -1)"
echo "chords say: $(sed -n 's/.*<div class="sim-say">\(.*\)/\1/p' $D/dom.html | sed 's/<\/div>.*//; s/<[^>]*>//g' | head -1)"
"$CHROME" --headless=new --disable-gpu --no-first-run --hide-scrollbars --user-data-dir=$D/profile --window-size=1440,1700 --virtual-time-budget=14000 --screenshot=tools/out/chords.png "$BASE/?fake=chords#/arcade/chord-two" > /dev/null 2>&1
ls -l tools/out/chords.png | awk '{print "screenshot -> " $NF " " $5 " bytes"}'
"$CHROME" --headless=new --disable-gpu --no-first-run --hide-scrollbars --user-data-dir=$D/profile --window-size=1440,2300 --virtual-time-budget=6000 --screenshot=tools/out/lesson-3-2.png "$BASE/#/lesson/3-2" > /dev/null 2>&1
ls -l tools/out/lesson-3-2.png | awk '{print "screenshot -> " $NF " " $5 " bytes"}'

# 第 3 章里没有音游的两节课（3.1、3.3）：先在模拟机上、再在假真机上，自动把每一步走一遍（?walk=…，脚本是 public/js/dev/walk-ch3.js）。
# ok = 做完之后“下一步”亮了的步数；stuck = 卡住的步数（应该是 0）；done = 走到了“完成”页；clean = 期间没有报错。
# 音游要等真实时间，无界面的浏览器里跑不了：有音游的 3.2、3.4 要在开着的浏览器里用同一个脚本走（用法见脚本开头）。
walk() {
  # 第二个参数：虚拟时间预算（毫秒），默认 90 秒；完整版的课一节要按几百下，给得长一些
  "$CHROME" --headless=new --disable-gpu --no-first-run --user-data-dir=$D/profile --virtual-time-budget=${2:-90000} --dump-dom "$BASE/$1" 2>/dev/null > $D/dom.html
  echo "walk $1 -> ok=$(count '"ok":true') stuck=$(count '"ok":false') done=$(count '"done":true') clean=$(count '"errors":\[\]') not-run=$(count '"crashed"\|"refused"')"
}
walk '?walk=3-1'
walk '?fake&walk=3-1'
walk '?walk=3-3'
walk '?fake&walk=3-3'
# 曲目的课《Faded》（content/song-lessons.js）：没有音游，同样两种情况各走一遍（四小节、按住 [OCTAVE] 转 [ALL]、按音核对都在里面）
walk '?walk=song-faded'
walk '?fake&walk=song-faded'
# 其余曲目的课是从分轨数据生成的（content/song-lesson-gen.js），走法也是通用的（walk-ch3.js 的 songPlan）：每首在模拟机上走一遍
for id in $(node -e "import('./public/js/content/song-lessons.js').then((m) => console.log(m.SONG_LESSONS.filter((l) => l.generated).map((l) => l.id).join(' ')))"); do walk "?walk=$id"; done
walk '?fake&walk=song-starboy'
walk '?fake&walk=song-one-kiss'
# 第 4 章（合成与音色设计，public/js/dev/walk-ch4.js）：四节课都没有音游，每节在模拟机、假真机上各走一遍。
# 假真机上认不出的那几项（[MASTER/SINGLE]、[FX] 转到哪一类）走查替你点“做好了”；滤波器、共鸣是让假真机发 CC 来认的
for id in 4-1 4-2 4-3 4-4; do
  walk "?walk=$id"
  walk "?fake&walk=$id"
done
# 第 5–8 章（采样、编曲、效果与现场、毕业演出，public/js/dev/walk-ch5.js）：也都没有音游，每节在模拟机、假真机上各走一遍。
# 真机报不报还不知道的那些（按 [REC SAMPLE]、Song / Scene 模式、复制粘贴、混音台、静音模式、临时保存……）走查替你点“我已经做了”；
# 录好采样（采样位的名字变了）、在第几段、静音、鼓轨的格子、SYNTH 2 的混响 / 延迟送多少，是让假真机真的变过去、等镜像读到才打勾的。
# 第 8 章的曲目单会写进这个测试服务自己的数据目录；录音在无界面的浏览器里做不了，那几项也替你点了
for id in 5-1 5-2 5-3 5-4 6-1 6-2 6-3 6-4 7-1 7-2 7-3 7-4 8-1 8-2 8-3 8-4; do
  walk "?walk=$id"
  walk "?fake&walk=$id"
done
# 完整版的课（content/arrangement-lessons.js，从完整版数据生成；走法是 public/js/dev/walk-arr.js，照着每一项上的 act 去按）：
# 8 首 × 2 节（① 备料：6 段乐句、复制粘贴、加长照抄、一页页改；② 排成一首：Song 模式排 scene、改长度、从头放、转滤波器），
# 每节在模拟机、假真机上各走一遍。假真机上认不出的（复制粘贴、步进输入里的音、Song 模式……）替你点“做好了”。
for id in $(node -e "import('./public/js/content/arrangement-lessons.js').then((m) => console.log(m.ARR_LESSONS.map((l) => l.id).join(' ')))"); do
  walk "?walk=$id" 400000
  walk "?fake&walk=$id" 400000
done

# 小课堂（乐理、节奏、效果的小关）：列表上该有 32 关，其中 12 关开放、20 关“还没开放”；开放的 12 关各打开一次，看能玩的东西摆出来没有。
# 再看“试一试”和“用在机器上”那两屏：?clstep=quiz / machine 是开发用的参数，直接从那一步开始（public/js/views/classroom.js）。
# “用在机器上”有三种样子：模拟机、效果关用的效果模拟机、接着假真机时的真机镜像（class 里带 live）。窗口按最小的平板 1024 × 768 开。
# 把每一关真的从头走到尾（要点、要拍、要等声音）在无界面的浏览器里做不了：那是 public/js/dev/walk-classroom.js，在开着的浏览器里跑。
classroom() {
  "$CHROME" --headless=new --disable-gpu --no-first-run --user-data-dir=$D/profile --window-size=1024,768 --virtual-time-budget=${2:-5000} --dump-dom "$BASE/$1" 2>/dev/null > $D/dom.html
}
classroom '#/classroom'
echo "classroom -> levels=$(count 'class="cl-node[ "]') open=$(count '<a class="cl-node') soon=$(count 'class="cl-node soon"') errors=$(count '这一页出错了')"
playable=0
broken=''
for id in T1 T5 T7 T10 R1 R3 R6 R8 F1 F2 F5 F6; do
  classroom "#/classroom/$id"
  if [[ $(count 'class="cl-toy') -ge 1 && $(count 'class="cl-say"') -eq 1 && $(count '这一页出错了') -eq 0 ]]; then playable=$((playable + 1)); else broken="$broken $id"; fi
done
echo "classroom levels -> playable=$playable/12 broken=[${broken# }]"
classroom '?clstep=quiz#/classroom/R3'
echo "classroom quiz -> options=$(count 'class="cl-opt[ "]') pattern-keys=$(count 'class="cl-key[ "]') errors=$(count '这一页出错了')"
classroom '?clstep=machine#/classroom/T10'
echo "classroom machine (sim) -> bench=$(count 'class="cl-bench"') panels=$(count 'panel-svg') task=$(count 'class="cl-bench-text"') errors=$(count '这一页出错了')"
classroom '?clstep=machine#/classroom/F5'
echo "classroom machine (fx sim) -> bench=$(count 'class="cl-bench"') panels=$(count 'panel-svg') say=\"$(sed -n 's/.*<div class="sim-say">\(.*\)/\1/p' $D/dom.html | sed 's/<\/div>.*//; s/<[^>]*>//g' | head -1)\" errors=$(count '这一页出错了')"
classroom '?fake&clstep=machine#/classroom/R3' 9000
echo "classroom machine (mirror) -> bench-live=$(count 'class="cl-bench live"') panels=$(count 'panel-svg') errors=$(count '这一页出错了')"

# 首页（闯关地图）、两套配色、经验值和徽章。
# 先放进一份“改版之前的旧进度”（没有 game 那一段，设置里也没有配色）：页面要按机身配色打开，并把经验值和徽章回算出来、写回去。
# 这份进度应该算出：573 经验 = Lv 3 节拍手，13 个徽章里拿到 3 个（第一声、连练 3 天、通关一章）；
# 地图上 20 个点（map-nodes）= 15 关 + 章开头挂着的 5 个小课堂的小关（minis：第 1 章前 T1 R1，第 2 章前 T5 T7，第 3 章前 T10；
# 这份进度里一个都没学，minis-done=0）；done / now / locked 只数课：3 关已通过，现在这一关是 1.1；
# 左边的导航栏上亮着的入口是路由表里有页面的那几个（小课堂接上之后是 7 个，之前是 6 个）。窗口按平板横屏 1180 × 820 开。
put() { curl -s -X PUT -H 'Content-Type: application/json' -d "$1" $BASE/api/progress > /dev/null; }
OLD='"version":1,"lessons":{"0-1":{"stepIndex":0,"done":true,"stars":3},"0-2":{"stepIndex":0,"done":true,"stars":3},"0-3":{"stepIndex":0,"done":true,"stars":2},"1-1":{"stepIndex":2,"done":false,"stars":0}},"charts":{"pulse-kick":{"plays":4,"bestAccuracy":0.98,"bestStars":3}},"songs":{"picked":[]},"practiceDays":["2026-11-04","2026-11-05","2026-11-06"],"lastResult":null,"drills":[]'
home() {
  "$CHROME" --headless=new --disable-gpu --no-first-run --user-data-dir=$D/profile-$1 --window-size=1180,820 --virtual-time-budget=8000 --dump-dom "$BASE/$2" 2>/dev/null > $D/dom.html
  echo "home $1 -> skin=$(grep -o '<html[^>]*' $D/dom.html | grep -o 'data-skin="[a-z]*"' | cut -d'"' -f2) fx=$(grep -o '<html[^>]*' $D/dom.html | grep -o 'data-fx="[a-z]*"' | cut -d'"' -f2) regions=$(count '<section class="region') map-nodes=$(count 'class="map-node') minis=$(count 'class="map-node mini') minis-done=$(count 'class="map-node mini done') done=$(count 'class="map-node done') now=$(count 'class="map-node now') locked=$(count 'class="map-node locked') far=$(count 'class="far-node"') badges=$(count '<button class="badge') got=$(count '<button class="badge got') level=\"$(grep -o 'id="level-chip"[^>]*aria-label="[^"]*' $D/dom.html | sed 's/.*aria-label="//; s/。.*//')\" rail-items=$(grep -o '<a [^>]*data-nav="[a-z]*"[^>]*>' $D/dom.html | grep -vc hidden) coach-faces=$(count '<svg class="face"') errors=$(count '这一页出错了')"
}
put "{$OLD,\"settings\":{\"inputOffsetMs\":0,\"metronome\":true,\"speak\":false,\"unlockAll\":false,\"engine\":\"fast\"}}"
home body ''
echo "home say: $(grep -o 'class="say-text"[^>]*>[^<]*' $D/dom.html | sed 's/.*>//')"
echo "backfill written -> $(curl -s $BASE/api/progress | tr -d ' \n' | grep -o '"playXp":[0-9]*\|"badges":{[^}]*}\|"skin":"[a-z]*"\|"motion":"[a-z]*"\|"uiSound":[a-z]*' | tr '\n' ' ')"
# 再换成霓虹 + 克制：<html> 上的两个开关要跟着变；接上假真机再看一遍
put "{$OLD,\"settings\":{\"inputOffsetMs\":0,\"metronome\":true,\"speak\":false,\"unlockAll\":false,\"engine\":\"fast\",\"skin\":\"neon\",\"motion\":\"calm\",\"uiSound\":false}}"
home neon ''
home neon-fake '?fake'
mkdir -p tools/out
"$CHROME" --headless=new --disable-gpu --no-first-run --hide-scrollbars --user-data-dir=$D/profile-neon --window-size=1180,820 --virtual-time-budget=8000 --screenshot=tools/out/home-neon.png "$BASE/?still#/" > /dev/null 2>&1
ls -l tools/out/home-neon.png | awk '{print "screenshot -> " $NF " " $5 " bytes"}'

# 小课堂接进经验值、徽章和地图。规则在 public/js/levels.js：学完一关 1 星 20 / 2 星 25 / 3 星 30，是从进度的 classroom 字段算出来的
# （不另外记账），所以再学一遍不会重复给，旧进度里学过的关自动补上。还是用上面那份旧进度（573 经验）。
# ?clstep=done 是开发用的参数：直接把这一关记成学完（跳过了“试一试”，所以是 1 星）。应该看到：
#   学完 T1：完成卡上写“+40 经验”（这一关 20 + 今天第一次练习 20），573 → 613；首页地图上 5 个小关亮了 1 个；
#   再学一遍 T1：完成卡上没有那一行（gain 是空的），还是 613，times 变成 2；
#   再学完 R1、F1：653；乐理、节奏、效果三条线都有了，多一个徽章“三线齐亮”（got 从 3 变成 4）；
#   旧进度里本来就带着学过的关（T1 三星、R1 两星，没有 game 那一段）：一打开就是 573 + 30 + 25 = 628，小关亮 2 个；
#   “清空学习进度”（设置页的按钮调的是 store.resetProgress()；无界面的浏览器里点不了按钮，所以在 Node 里直接调）：classroom 没了，经验回到 0。
BODY='"settings":{"inputOffsetMs":0,"metronome":true,"speak":false,"unlockAll":false,"engine":"fast"}'
xp() { node tools/xp-check.mjs $D/data | grep -E '^(小课堂|经验)' | tr '\n' ' '; }
gain() { grep -o '<p class="cl-gain">[^/]*/b>[^<]*' $D/dom.html | sed 's/<[^>]*>//g'; }
room() { curl -s $BASE/api/progress | tr -d ' \n' | grep -o "\"$1\":{\"done\":[a-z]*,\"stars\":[0-9]*,\"at\":\"[^\"]*\",\"times\":[0-9]*" | sed 's/,"at":"[^"]*"//; s/"//g; s/$/}/'; }
put "{$OLD,$BODY}"
classroom '?clstep=done#/classroom/T1'
echo "classroom xp: T1 -> card=$(count 'class="cl-done"') gain=\"$(gain)\" saved=$(room T1) $(xp)"
home rooms ''
classroom '?clstep=done#/classroom/T1'
echo "classroom xp: T1 again -> card=$(count 'class="cl-done"') gain=\"$(gain)\" saved=$(room T1) $(xp)"
classroom '?clstep=done#/classroom/R1'
classroom '?clstep=done#/classroom/F1'
echo "classroom xp: +R1 +F1 -> gain=\"$(gain)\" badge=$(curl -s $BASE/api/progress | tr -d ' \n' | grep -o '"three-lines":"[^"]*"' | wc -l | tr -d ' ') $(xp)"
home rooms ''
put "{$OLD,\"classroom\":{\"T1\":{\"done\":true,\"stars\":3,\"at\":\"2026-11-08T10:00:00.000Z\",\"times\":1},\"R1\":{\"done\":true,\"stars\":2,\"at\":\"2026-11-09T10:00:00.000Z\",\"times\":2}},$BODY}"
home rooms-old ''
echo "classroom xp: old progress -> $(xp)"
node --input-type=module -e '
  import { store } from "./public/js/store.js";
  store.update((d) => { d.classroom = { T1: { done: true, stars: 3 }, R1: { done: true, stars: 1 } }; });
  const before = store.progress().xp;
  store.resetProgress();
  console.log(`classroom reset -> before=${before} after=${store.progress().xp} classroom=${JSON.stringify(store.data.classroom ?? null)}`);
' 2>/dev/null

kill $SERVER 2>/dev/null
rm -rf $D
