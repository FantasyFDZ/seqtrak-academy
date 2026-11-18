#!/bin/zsh
# 开发期：给小课堂节奏线“一心多用”第一批（R1 节拍器三招、R2 只念开头、R7 一只手不动一只手挪、R9 重音挪一挪，外加大关和 R4 的小改）的各种画面截图，看版式用。
# Mac 上无界面的 Chrome；图放在 tools/out/rhythm/<尺寸>/。另起一个临时服务（端口默认 4767，数据放临时目录），不碰真实的学习进度。
#
# 2026-11-18：第二批的画面也在这里（set2_for：R10 不出声的那一拍、R11 腾出一只手，R3 / R6 / R8 的新热身，R1、R2 并进 T1、T2 之后的第一屏）。
#
# 用法：zsh tools/rhythm-shots.sh            1024×768：机身配色一整套 + 霓虹配色同样一整套（第一批、第二批都截）
#      zsh tools/rhythm-shots.sh wide       再加一套 1180×820
#      zsh tools/rhythm-shots.sh batch2     只截第二批的（两套配色）
#      端口被占着就换一个：PORT=4773 zsh tools/rhythm-shots.sh batch2
#
# 无界面的浏览器里没有声音、也没法拍，所以打到一半、结果这些画面是摆出来的：地址里的 ?rhshot=…（public/js/classroom-rhythm2.js 开头有说明）。
# 别的开发用参数：?still 入场动画直接到位；?skin=neon 临时换成霓虹配色；?clstep=quiz / machine 直接从那一步开始，?cltier=1/2/3 挑一档。
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
D=$(mktemp -d)
P=${PORT:-4767}
BASE=http://localhost:$P
OUT=tools/out/rhythm

PORT=$P SEQTRAK_DATA=$D/data node server/server.mjs > $D/server.log 2>&1 &
SERVER=$!
sleep 1.5

# $1 = 尺寸（1024x768），$2 = 文件名，$3 = 地址里 ? 后面的参数（可以空），$4 = # 后面的路径
pids=()
n=0
flush() { wait $pids; pids=(); }
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
  local s=$1 k=$2   # k = 文件名前缀（空 = 机身配色），skin = 地址里的配色参数
  local skin=${3:+skin=$3&}
  # R1 跟稳：节拍器三招
  shot $s ${k}R1-01-play "${skin}" /classroom/R1
  shot $s ${k}R1-02-play-thin-mid "${skin}rhshot=thin-mid" /classroom/R1
  shot $s ${k}R1-03-play-gone-result "${skin}rhshot=gone-result" /classroom/R1
  shot $s ${k}R1-04-play-flip-mid "${skin}rhshot=flip-mid" /classroom/R1
  shot $s ${k}R1-05-quiz-bronze "${skin}clstep=quiz&cltier=1" /classroom/R1
  shot $s ${k}R1-06-quiz-silver-result "${skin}clstep=quiz&cltier=2&rhshot=result" /classroom/R1
  shot $s ${k}R1-07-quiz-gold-mid "${skin}clstep=quiz&cltier=3&rhshot=mid" /classroom/R1
  shot $s ${k}R1-08-quiz-gold-result "${skin}clstep=quiz&cltier=3&rhshot=result" /classroom/R1
  # R9 重音挪一挪
  shot $s ${k}R9-01-play "${skin}" /classroom/R9
  shot $s ${k}R9-02-play-move "${skin}rhshot=s2" /classroom/R9
  shot $s ${k}R9-03-play-drill-mid "${skin}rhshot=s3-mid" /classroom/R9
  shot $s ${k}R9-04-play-onepad "${skin}rhshot=s3-one-mid" /classroom/R9
  shot $s ${k}R9-05-quiz-bronze-place "${skin}clstep=quiz&cltier=1" /classroom/R9
  shot $s ${k}R9-06-quiz-silver-mid "${skin}clstep=quiz&cltier=2&rhshot=mid" /classroom/R9
  shot $s ${k}R9-07-quiz-gold-mid "${skin}clstep=quiz&cltier=3&rhshot=mid" /classroom/R9
  shot $s ${k}R9-08-quiz-silver-result "${skin}clstep=quiz&cltier=2&rhshot=result" /classroom/R9
  shot $s ${k}R9-09-quiz-onepad-mid "${skin}clstep=quiz&cltier=2&rhshot=one-mid" /classroom/R9
  shot $s ${k}R9-10-machine "${skin}clstep=machine" /classroom/R9
  # R7 两只手
  shot $s ${k}R7-01-play "${skin}" /classroom/R7
  shot $s ${k}R7-02-play-shift-mid "${skin}rhshot=s2-mid" /classroom/R7
  shot $s ${k}R7-03-play-onepad "${skin}rhshot=s2-one-mid" /classroom/R7
  shot $s ${k}R7-04-quiz-bronze-card "${skin}clstep=quiz&cltier=1" /classroom/R7
  shot $s ${k}R7-05-quiz-silver-stage "${skin}clstep=quiz&cltier=2&rhshot=stage" /classroom/R7
  shot $s ${k}R7-06-quiz-gold-stage "${skin}clstep=quiz&cltier=3&rhshot=stage" /classroom/R7
  shot $s ${k}R7-07-quiz-silver-swap "${skin}clstep=quiz&cltier=2&rhshot=skip-stage" /classroom/R7
  shot $s ${k}R7-08-machine "${skin}clstep=machine" /classroom/R7
  # R2 数出来：只念开头
  shot $s ${k}R2-01-play "${skin}" /classroom/R2
  shot $s ${k}R2-02-play-long-mid "${skin}rhshot=s2-mid" /classroom/R2
  shot $s ${k}R2-03-play-pick "${skin}rhshot=s3-mid" /classroom/R2
  shot $s ${k}R2-04-quiz-bronze-pick "${skin}clstep=quiz&cltier=1" /classroom/R2
  shot $s ${k}R2-05-quiz-silver-pick-mid "${skin}clstep=quiz&cltier=2&rhshot=mid" /classroom/R2
  shot $s ${k}R2-06-quiz-bronze-stage "${skin}clstep=quiz&cltier=1&rhshot=next-stage" /classroom/R2
  shot $s ${k}R2-07-quiz-silver-stage "${skin}clstep=quiz&cltier=2&rhshot=next-stage" /classroom/R2
  shot $s ${k}R2-08-quiz-gold-stage "${skin}clstep=quiz&cltier=3&rhshot=next-stage" /classroom/R2
  # 小改的两处：大关最前面多的一段“静下来也不乱”、R4 金那一档的开始卡片
  shot $s ${k}RB-01-quiz-gone-mid "${skin}clstep=quiz&cltier=2&rhshot=mid" /classroom/RB
  shot $s ${k}RB-02-quiz-gone-result "${skin}clstep=quiz&cltier=3&rhshot=result" /classroom/RB
  shot $s ${k}R4-01-quiz-gold-card "${skin}clstep=quiz&cltier=3" /classroom/R4
  flush
}

# 第二批（2026-11-18）：R10 不出声的那一拍、R11 腾出一只手，R3 / R6 / R8 的新热身，R1、R2 并进了 T1、T2 之后的第一屏
set2_for() {
  local s=$1 k=$2
  local skin=${3:+skin=$3&}
  # R10 不出声的那一拍：热身三小步（开始卡片 / 打到一半：灰音符 / 第 3 步：静的那一小节），挑战两段（灰的别按；静一小节：铜谱面还在、银只剩影子、金一点不剩）
  shot $s ${k}R10-01-play "${skin}" /classroom/R10
  shot $s ${k}R10-02-play-grey-stage "${skin}rhshot=s0-stage-b5" /classroom/R10
  shot $s ${k}R10-03-play-quiet-stage "${skin}rhshot=s2-stage" /classroom/R10
  shot $s ${k}R10-04-quiz-bronze-card "${skin}clstep=quiz&cltier=1" /classroom/R10
  shot $s ${k}R10-05-quiz-silver-grey-stage "${skin}clstep=quiz&cltier=2&rhshot=stage" /classroom/R10
  shot $s ${k}R10-06-quiz-bronze-quiet "${skin}clstep=quiz&cltier=1&rhshot=skip-stage" /classroom/R10
  shot $s ${k}R10-07-quiz-silver-quiet "${skin}clstep=quiz&cltier=2&rhshot=skip-stage" /classroom/R10
  shot $s ${k}R10-08-quiz-gold-quiet "${skin}clstep=quiz&cltier=3&rhshot=skip-stage" /classroom/R10
  shot $s ${k}R10-09-machine "${skin}clstep=machine" /classroom/R10
  # R11 腾出一只手：热身（开始卡片 / 第 3 步打到一半：旋钮），挑战（开始卡片 / 银：方键 / 金：数灯 / 结果 / 一只手版），机器那一步
  shot $s ${k}R11-01-play "${skin}" /classroom/R11
  shot $s ${k}R11-02-play-knob-mid "${skin}rhshot=s2-mid" /classroom/R11
  shot $s ${k}R11-03-quiz-bronze-card "${skin}clstep=quiz&cltier=1" /classroom/R11
  shot $s ${k}R11-04-quiz-silver-key-mid "${skin}clstep=quiz&cltier=2&rhshot=mid-key" /classroom/R11
  shot $s ${k}R11-05-quiz-gold-count-mid "${skin}clstep=quiz&cltier=3&rhshot=mid-count" /classroom/R11
  shot $s ${k}R11-06-quiz-silver-result "${skin}clstep=quiz&cltier=2&rhshot=result" /classroom/R11
  shot $s ${k}R11-07-quiz-onehand-mid "${skin}clstep=quiz&cltier=2&rhshot=one-mid" /classroom/R11
  shot $s ${k}R11-08-quiz-onehand-card "${skin}clstep=quiz&cltier=3&rhshot=one" /classroom/R11
  shot $s ${k}R11-09-machine "${skin}clstep=machine" /classroom/R11
  # R3 的热身：点格子 / 圈出重复的小块 / 几下一组（答完，分组亮出来）
  shot $s ${k}R3-01-play-grid "${skin}" /classroom/R3
  shot $s ${k}R3-02-play-blocks "${skin}rhshot=s1-mid" /classroom/R3
  shot $s ${k}R3-03-play-groups "${skin}rhshot=s2" /classroom/R3
  shot $s ${k}R3-04-play-groups-answered "${skin}rhshot=s2-mid" /classroom/R3
  # R6 的热身：直的 / 一拍切三份 / 拿掉中间那下（拿之前、拿之后）/ 滑条推到三份的最后一份
  shot $s ${k}R6-01-play-straight "${skin}" /classroom/R6
  shot $s ${k}R6-02-play-thirds "${skin}rhshot=s1" /classroom/R6
  shot $s ${k}R6-03-play-pick "${skin}rhshot=s2" /classroom/R6
  shot $s ${k}R6-04-play-holed "${skin}rhshot=s2-mid" /classroom/R6
  shot $s ${k}R6-05-play-slider "${skin}rhshot=s3-mid" /classroom/R6
  # R8 的热身：三张牌 / 选了一种，一层一层放到第二层
  shot $s ${k}R8-01-play "${skin}" /classroom/R8
  shot $s ${k}R8-02-play-layers "${skin}rhshot=mid" /classroom/R8
  # 并进了 T1、T2 的两关：第一屏
  shot $s ${k}R1-11-play-merged "${skin}" /classroom/R1
  shot $s ${k}R1-12-machine "${skin}clstep=machine" /classroom/R1
  shot $s ${k}R2-11-play-merged "${skin}" /classroom/R2
  shot $s ${k}R2-12-play-cut4-mid "${skin}rhshot=s2-mid" /classroom/R2
  flush
}

rm -rf $OUT
if [[ "$1" == batch2 ]]; then
  # 只截第二批的画面：zsh tools/rhythm-shots.sh batch2
  set2_for 1024x768 ''
  set2_for 1024x768 neon- neon
else
  set_for 1024x768 ''
  set_for 1024x768 neon- neon
  set2_for 1024x768 ''
  set2_for 1024x768 neon- neon
  [[ "$1" == wide ]] && set_for 1180x820 '' && set2_for 1180x820 ''
fi
# 列表和推荐路线上有没有新关
shot 1024x768 00-list '' /classroom
shot 1024x768 00-route '' /classroom/route
flush

ls $OUT/*/ | head -200
echo "shots: $(ls $OUT/*/*.png | wc -l | tr -d ' ')"
kill $SERVER 2>/dev/null
rm -rf $D
