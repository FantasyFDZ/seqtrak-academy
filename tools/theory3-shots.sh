#!/bin/zsh
# 开发期：给小课堂乐理线第三期（单元 5「拆歌」T28–T30、重做的乐理大关 TB、选学“看懂谱子”T31–T34 和“和弦进阶”T35–T36，
# 外加搬到乐理台上的 T8 挑战、列表 / 路线 / 卡册上的“选学”）的各种画面截图，看版式用。
# Mac 上无界面的 Chrome；图放在 tools/out/theory3/<尺寸>/。另起一个临时服务（端口默认 4771，数据放临时目录），不碰真实的学习进度。
#
# 用法：zsh tools/theory3-shots.sh            1024×768：机身配色一整套 + 霓虹配色同样一整套
#      zsh tools/theory3-shots.sh wide       再加一套 1180×820（只截机身配色）
#
# 无界面的浏览器里没有声音、也没法点，所以“做到一半”的画面靠地址里的开发用参数摆出来：
#   ?tgbeat=3        “跟啾啾学”一进来就在第 3 小步（public/js/theory-guide.js）；再带 &tgdone 把这一小步直接做掉
#   ?clstep=quiz     直接从挑战那一步开始，&cltier=1/2/3 挑一档（public/js/views/classroom.js）
#   ?clstage=3       关底大关直接从第 3 段开始（public/js/classroom-toys.js 的 relay）
#   ?still 入场动画直接到位；?skin=neon 临时换成霓虹配色
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
D=$(mktemp -d)
P=${PORT:-4771}
BASE=http://localhost:$P
OUT=tools/out/theory3

PORT=$P SEQTRAK_DATA=$D/data node server/server.mjs > $D/server.log 2>&1 &
SERVER=$!
sleep 1.5

# $1 = 尺寸（1024x768），$2 = 文件名，$3 = 地址里 ? 后面的参数（可以空），$4 = # 后面的路径
pids=()
n=0
# 只等这几个浏览器：一个都没有的时候别等（光写 wait 会连后台的临时服务一起等，永远等不完）
flush() { (( ${#pids} )) && wait $pids; pids=(); }
shot() {
  local w=${1%x*} h=${1#*x}
  mkdir -p $OUT/$1
  "$CHROME" --headless=new --disable-gpu --no-first-run --hide-scrollbars --user-data-dir=$D/profile-$1-$2 \
    --window-size=$w,$h --virtual-time-budget=7000 --screenshot=$OUT/$1/$2.png "$BASE/?still${3:+&$3}#$4" > /dev/null 2>&1 &
  pids+=($!)
  n=$((n + 1))
  (( n % 5 == 0 )) && flush
}

set_for() {
  local s=$1 k=$2   # k = 文件名前缀（空 = 机身配色）
  local skin=${3:+skin=$3&}
  # 单元 5 · 拆歌
  shot $s ${k}T28-01-listen "${skin}tgbeat=1" /classroom/T28
  shot $s ${k}T28-02-tryhome "${skin}tgbeat=2" /classroom/T28
  shot $s ${k}T28-03-tryhome-done "${skin}tgbeat=2&tgdone" /classroom/T28
  shot $s ${k}T28-04-third "${skin}tgbeat=5" /classroom/T28
  shot $s ${k}T28-05-quiz-bronze "${skin}clstep=quiz&cltier=1" /classroom/T28
  shot $s ${k}T28-06-quiz-silver "${skin}clstep=quiz&cltier=2" /classroom/T28
  shot $s ${k}T28-07-quiz-gold "${skin}clstep=quiz&cltier=3" /classroom/T28
  shot $s ${k}T28-08-machine "${skin}clstep=machine" /classroom/T28
  shot $s ${k}T29-01-rootfill "${skin}tgbeat=3" /classroom/T29
  shot $s ${k}T29-02-rootfill-done "${skin}tgbeat=3&tgdone" /classroom/T29
  shot $s ${k}T29-03-stack "${skin}tgbeat=4" /classroom/T29
  shot $s ${k}T29-04-ring "${skin}tgbeat=5" /classroom/T29
  shot $s ${k}T29-05-quiz-bronze "${skin}clstep=quiz&cltier=1" /classroom/T29
  shot $s ${k}T29-06-quiz-gold "${skin}clstep=quiz&cltier=3" /classroom/T29
  shot $s ${k}T30-01-usedkeys-done "${skin}tgbeat=2&tgdone" /classroom/T30
  shot $s ${k}T30-02-marknote "${skin}tgbeat=3" /classroom/T30
  shot $s ${k}T30-03-pick "${skin}tgbeat=4" /classroom/T30
  shot $s ${k}T30-04-changed-done "${skin}tgbeat=6&tgdone" /classroom/T30
  shot $s ${k}T30-05-quiz-silver "${skin}clstep=quiz&cltier=2" /classroom/T30
  shot $s ${k}T30-06-quiz-gold "${skin}clstep=quiz&cltier=3" /classroom/T30
  # 乐理大关：四段
  shot $s ${k}TB-01-home "${skin}clstep=quiz&cltier=1" /classroom/TB
  shot $s ${k}TB-02-ladder "${skin}clstep=quiz&cltier=1&clstage=2" /classroom/TB
  shot $s ${k}TB-03-chords "${skin}clstep=quiz&cltier=2&clstage=3" /classroom/TB
  shot $s ${k}TB-04-melody "${skin}clstep=quiz&cltier=1&clstage=4" /classroom/TB
  shot $s ${k}T8-quiz-bronze "${skin}clstep=quiz&cltier=1" /classroom/T8
  # 选学 · 看懂谱子
  shot $s ${k}T31-01-trail "${skin}tgbeat=1" /classroom/T31
  shot $s ${k}T31-02-staff "${skin}tgbeat=2" /classroom/T31
  shot $s ${k}T31-03-clef "${skin}tgbeat=3" /classroom/T31
  shot $s ${k}T31-04-staffkey "${skin}tgbeat=5" /classroom/T31
  shot $s ${k}T31-05-keystaff "${skin}tgbeat=6" /classroom/T31
  shot $s ${k}T31-06-sharp "${skin}tgbeat=7" /classroom/T31
  shot $s ${k}T31-07-star "${skin}tgbeat=8" /classroom/T31
  shot $s ${k}T31-08-quiz-bronze "${skin}clstep=quiz&cltier=1" /classroom/T31
  shot $s ${k}T31-09-quiz-gold "${skin}clstep=quiz&cltier=3" /classroom/T31
  shot $s ${k}T32-01-strip "${skin}tgbeat=1" /classroom/T32
  shot $s ${k}T32-02-five "${skin}tgbeat=4" /classroom/T32
  shot $s ${k}T32-03-onsets "${skin}tgbeat=5" /classroom/T32
  shot $s ${k}T32-04-onsets-done "${skin}tgbeat=5&tgdone" /classroom/T32
  shot $s ${k}T32-05-rests "${skin}tgbeat=7" /classroom/T32
  shot $s ${k}T32-06-spell "${skin}tgbeat=8" /classroom/T32
  shot $s ${k}T32-07-spell-done "${skin}tgbeat=8&tgdone" /classroom/T32
  shot $s ${k}T32-08-quiz-silver "${skin}clstep=quiz&cltier=2" /classroom/T32
  shot $s ${k}T32-09-quiz-gold "${skin}clstep=quiz&cltier=3" /classroom/T32
  shot $s ${k}T33-01-groups "${skin}tgbeat=1" /classroom/T33
  shot $s ${k}T33-02-timesig "${skin}tgbeat=3" /classroom/T33
  shot $s ${k}T33-03-barlines "${skin}tgbeat=4" /classroom/T33
  shot $s ${k}T33-04-barlines-done "${skin}tgbeat=4&tgdone" /classroom/T33
  shot $s ${k}T33-05-waltz "${skin}tgbeat=5" /classroom/T33
  shot $s ${k}T33-06-fillbar "${skin}tgbeat=7" /classroom/T33
  shot $s ${k}T33-07-quiz-silver "${skin}clstep=quiz&cltier=2" /classroom/T33
  shot $s ${k}T33-08-quiz-gold "${skin}clstep=quiz&cltier=3" /classroom/T33
  shot $s ${k}T34-01-dyn-name "${skin}tgbeat=2" /classroom/T34
  shot $s ${k}T34-02-dynamics "${skin}tgbeat=4" /classroom/T34
  shot $s ${k}T34-03-dynamics-done "${skin}tgbeat=4&tgdone" /classroom/T34
  shot $s ${k}T34-04-repeat "${skin}tgbeat=5" /classroom/T34
  shot $s ${k}T34-05-roadmap "${skin}tgbeat=7" /classroom/T34
  shot $s ${k}T34-06-volta-done "${skin}tgbeat=8&tgdone" /classroom/T34
  shot $s ${k}T34-07-quiz-silver "${skin}clstep=quiz&cltier=2" /classroom/T34
  shot $s ${k}T34-08-quiz-gold "${skin}clstep=quiz&cltier=3" /classroom/T34
  shot $s ${k}T34-09-machine "${skin}clstep=machine" /classroom/T34
  # 选学 · 和弦进阶
  shot $s ${k}T35-01-invert "${skin}tgbeat=2" /classroom/T35
  shot $s ${k}T35-02-invert-done "${skin}tgbeat=3&tgdone" /classroom/T35
  shot $s ${k}T35-03-nearest "${skin}tgbeat=6" /classroom/T35
  shot $s ${k}T35-04-nearest-done "${skin}tgbeat=6&tgdone" /classroom/T35
  shot $s ${k}T35-05-quiz-silver "${skin}clstep=quiz&cltier=2" /classroom/T35
  shot $s ${k}T35-06-quiz-gold "${skin}clstep=quiz&cltier=3" /classroom/T35
  shot $s ${k}T35-07-machine "${skin}clstep=machine" /classroom/T35
  shot $s ${k}T36-01-suspend-done "${skin}tgbeat=2&tgdone" /classroom/T36
  shot $s ${k}T36-02-addtone-done "${skin}tgbeat=7&tgdone" /classroom/T36
  shot $s ${k}T36-03-quiz-bronze "${skin}clstep=quiz&cltier=1" /classroom/T36
  shot $s ${k}T36-04-quiz-gold "${skin}clstep=quiz&cltier=3" /classroom/T36
  # 列表、路线、卡册、首页地图
  shot $s ${k}00-list "${skin}" /classroom
  shot $s ${k}00-route "${skin}" /classroom/route
  shot $s ${k}00-cards "${skin}" /classroom/cards
  shot $s ${k}00-home "${skin}" /
  flush
}

rm -rf $OUT
set_for 1024x768 ''
set_for 1024x768 neon- neon
[[ "$1" == wide ]] && set_for 1180x820 ''
# 选学的关排在乐理线那一列、路线页、卡册的最下面，一屏看不到：窗口开高一点，整列截下来
shot 1024x2600 00-list-tall '' /classroom
shot 1024x2600 00-route-tall '' /classroom/route
shot 1024x2600 00-cards-tall '' /classroom/cards
shot 1024x2600 neon-00-list-tall 'skin=neon' /classroom
flush

echo "shots: $(ls $OUT/*/*.png | wc -l | tr -d ' ')"
grep -c . $D/server.log | awk '{print "server log lines: " $1}'
kill $SERVER 2>/dev/null
rm -rf $D
