#!/bin/zsh
# 开发期：给小课堂的各屏截图（Mac 上无界面的 Chrome），看版式用。图放在 tools/out/classroom/<尺寸>/。
# 另起一个临时服务（端口 4756，数据放临时目录），不碰真实的学习进度。
#
# 用法：zsh tools/classroom-shots.sh          一组有代表性的画面：1024×768 和 1180×820 两个尺寸
#      zsh tools/classroom-shots.sh all      12 关的三屏（玩一玩 / 试一试 / 用在机器上）全截，只截 1024×768
#
# 地址里的几个开发用参数：?still 入场动画直接到位（见 public/index.html 开头）；?skin=neon 临时换成霓虹配色；
# ?clstep=quiz / machine / done 直接从那一步开始（见 public/js/views/classroom.js）；?fake 接上假真机（真机镜像）。
# 无界面的浏览器里没有声音、也没法点，所以截到的都是每一屏刚打开时的样子。
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
D=$(mktemp -d)
BASE=http://localhost:4756
OUT=tools/out/classroom
IDS=(T1 T5 T7 T10 R1 R3 R6 R8 F1 F2 F5 F6)

PORT=4756 SEQTRAK_DATA=$D/data node server/server.mjs > $D/server.log 2>&1 &
SERVER=$!
sleep 1.5

# $1 = 尺寸（1024x768），$2 = 文件名，$3 = 地址里 ? 后面的参数（可以空），$4 = # 后面的路径，$5 = 等多久（毫秒）
# 一次放出去几个浏览器同时截，再用 flush 等它们（只等这几个：光写 wait 会连后台的临时服务一起等，永远等不完）
pids=()
flush() { wait $pids; pids=(); }
shot() {
  local w=${1%x*} h=${1#*x}
  mkdir -p $OUT/$1
  "$CHROME" --headless=new --disable-gpu --no-first-run --hide-scrollbars --user-data-dir=$D/profile-$1-$2 \
    --window-size=$w,$h --virtual-time-budget=${5:-6000} --screenshot=$OUT/$1/$2.png "$BASE/?still${3:+&$3}#$4" > /dev/null 2>&1 &
  pids+=($!)
}

if [[ "$1" == all ]]; then
  rm -rf $OUT/1024x768
  for id in $IDS; do
    shot 1024x768 $id-1-play '' /classroom/$id
    shot 1024x768 $id-2-quiz 'clstep=quiz' /classroom/$id
    shot 1024x768 $id-3-machine 'clstep=machine' /classroom/$id
    flush
  done
else
  rm -rf $OUT
  for size in 1024x768 1180x820; do
    shot $size 00-list '' /classroom
    shot $size 00-list-neon 'skin=neon' /classroom
    shot $size 01-T1-play '' /classroom/T1
    shot $size 02-T5-play '' /classroom/T5
    flush
    shot $size 03-T7-play '' /classroom/T7
    shot $size 04-T10-play '' /classroom/T10
    shot $size 05-T10-quiz 'clstep=quiz' /classroom/T10
    shot $size 06-R1-play '' /classroom/R1
    flush
    shot $size 07-R3-play '' /classroom/R3
    shot $size 08-R3-quiz 'clstep=quiz' /classroom/R3
    shot $size 09-R6-play '' /classroom/R6
    shot $size 10-R6-quiz 'clstep=quiz' /classroom/R6
    flush
    shot $size 11-R8-play '' /classroom/R8
    shot $size 12-F1-play '' /classroom/F1
    shot $size 13-F2-play '' /classroom/F2
    shot $size 14-F2-quiz 'clstep=quiz' /classroom/F2
    flush
    shot $size 15-F5-play '' /classroom/F5
    shot $size 16-F6-play-neon 'skin=neon' /classroom/F6
    shot $size 17-R3-machine-sim 'clstep=machine' /classroom/R3
    shot $size 18-F5-machine-fxsim 'clstep=machine' /classroom/F5
    flush
    shot $size 19-R3-machine-mirror 'fake&clstep=machine' /classroom/R3 9000
    shot $size 20-T10-machine-neon 'skin=neon&clstep=machine' /classroom/T10
    shot $size 21-T1-done 'clstep=done' /classroom/T1 8000
    flush
  done
fi

for f in $OUT/*/*.png; do echo "$f $(ls -l $f | awk '{print $5}') bytes"; done
kill $SERVER 2>/dev/null
rm -rf $D
