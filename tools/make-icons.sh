#!/bin/zsh
# 开发用：重画应用图标（安装成应用后 Dock、启动台、iPad 主屏幕上的那个）。在 Mac 上跑，要 4747 的服务开着。
# 用无界面的 Chrome 打开 public/icon-lab.html 截图，放进 public/icons/：
#   icon-192.png / icon-512.png        普通版（macOS 图标的格子：圆角方块、四周透明、带投影）
#   maskable-512.png                    可裁切版（底色铺满，图案在中间安全区，系统自己切形状）
#   apple-touch-icon.png（180）         iPad / iPhone 加到主屏幕用（铺满、不透明，系统自己切圆角）
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
BASE=${BASE:-http://localhost:4747}
D=$(mktemp -d)
mkdir -p public/icons
shot() { # $1 文件名 $2 尺寸 $3 mask（0/1） $4 透明底（1）
  local bg=""
  [[ $4 == 1 ]] && bg="--default-background-color=00000000"
  "$CHROME" --headless=new --disable-gpu --no-first-run --hide-scrollbars $bg --user-data-dir=$D/p$1 \
    --window-size=$2,$(( $2 + 100 )) --virtual-time-budget=2500 --screenshot=public/icons/$1 "$BASE/icon-lab.html?size=$2&mask=$3&top=50" > /dev/null 2>&1
  # 无界面的 Chrome 截图时窗口比画面高出一截（画面底下会空一条），所以窗口开高 100、图标往下挪 50，再裁成正方形（sips 从正中间裁）
  sips -c $2 $2 public/icons/$1 > /dev/null 2>&1
  echo "$1 -> $(sips -g pixelWidth -g pixelHeight public/icons/$1 2>/dev/null | awk '/pixel/{printf "%s ", $2}')$(ls -l public/icons/$1 | awk '{print $5}') bytes"
}
shot icon-512.png 512 0 1
shot icon-192.png 192 0 1
shot maskable-512.png 512 1 0
shot apple-touch-icon.png 180 1 0
rm -rf $D
