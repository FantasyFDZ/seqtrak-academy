#!/bin/zsh
# 键盘学习方式的检查（docs/design-direction.md「键盘学习方式」）：用无界面的 Chrome，把课一节一节自动走一遍。
#   1. 真机方式（学习方式没设，默认）下用鼠标走几节：和以前一样能走完，键盘方式没把模拟机的鼠标手势改坏
#   2. 键盘方式下（地址带 &walkkeys：public/js/dev/walkthrough.js 把同一份走查改用电脑键盘的事件）把第 0–8 章、曲目课、完整版的课都走一遍
# 音游、“找按键”和学习方式无关（音游用它自己的键，找按键用鼠标点），第 0–2 章的走查里点“跳过这一步”。
# 另起一个临时服务（端口 4761，数据放临时目录），不碰 4747 的真实进度；走完就关掉。
# 输出每节一行：ok = 做完的步数，stuck = 卡住的步数（应该是 0），skipped = 跳过的步数，done = 走到了“完成”，clean = 期间没有报错。
# 全跑一遍要二三十分钟：zsh tools/kbd-check.sh > tools/out/kbd-check.log 2>&1 &
# 只跑一部分：zsh tools/kbd-check.sh 4-1 5-2 …（只走这几节，键盘方式）
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
D=$(mktemp -d)
BASE=http://localhost:4761

PORT=4761 SEQTRAK_DATA=$D/data node server/server.mjs > $D/server.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null; rm -rf $D' EXIT
sleep 1.5

"$CHROME" --version
count() { grep -o "$1" $D/dom.html | wc -l | tr -d ' '; }
walk() {
  # 第二个参数：虚拟时间预算（毫秒），默认 120 秒；完整版的课一节要按几百下，给得长一些
  "$CHROME" --headless=new --disable-gpu --no-first-run --user-data-dir=$D/profile --window-size=1280,900 --virtual-time-budget=${2:-120000} --dump-dom "$BASE/$1" 2>/dev/null > $D/dom.html
  local stuck=$(count '"ok":false')
  echo "walk $1 -> ok=$(count '"ok":true') stuck=$stuck skipped=$(count '"skipped":true') done=$(count '"done":true') clean=$(count '"errors":\[\]') not-run=$(count '"crashed"\|"refused"')"
  # 卡住了：把卡住的那一步的提示也打出来
  if [[ $stuck != 0 ]]; then grep -o '"ok":false[^}]*' $D/dom.html | head -2 | sed 's/^/    /'; fi
}

if (( $# )); then
  for id in "$@"; do walk "?walk=$id&walkkeys" 400000; done
  exit 0
fi

echo "── 真机方式（默认），用鼠标走 ──"
for id in 3-1 3-3 4-2 5-2 6-2 7-2 8-4; do walk "?walk=$id"; done

echo "── 键盘方式，用电脑键盘走 ──"
for id in 0-1 0-2 0-3 1-1 1-2 1-3 1-4 1-5 2-1 2-2 2-3 3-1 3-3 song-faded; do walk "?walk=$id&walkkeys"; done
for id in $(node -e "import('./public/js/content/song-lessons.js').then((m) => console.log(m.SONG_LESSONS.filter((l) => l.generated).map((l) => l.id).join(' ')))"); do walk "?walk=$id&walkkeys"; done
for id in 4-1 4-2 4-3 4-4 5-1 5-2 5-3 5-4 6-1 6-2 6-3 6-4 7-1 7-2 7-3 7-4 8-1 8-2 8-3 8-4; do walk "?walk=$id&walkkeys"; done
for id in $(node -e "import('./public/js/content/arrangement-lessons.js').then((m) => console.log(m.ARR_LESSONS.map((l) => l.id).join(' ')))"); do walk "?walk=$id&walkkeys" 400000; done
