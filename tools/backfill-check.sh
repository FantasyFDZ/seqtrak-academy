#!/bin/zsh
# 开发期：确认“旧的进度文件能读，经验值和徽章能从它回算出来，写回去的时候原有的内容一样不少”。
# 做法：把一份进度（默认是 Mac 上真实的 data/）复制到临时目录，起一个临时服务（端口 4751），用无界面的 Chrome 打开首页，
# 再看页面写回去的那份文件。原来的目录只读不写，最后会核对它一个字节都没变。
# 用法：zsh tools/backfill-check.sh [数据目录]
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SRC=${1:-data}
D=$(mktemp -d)
mkdir -p $D/data
cp $SRC/progress.json $D/data/
cp $SRC/sessions.jsonl $D/data/ 2>/dev/null
cp $SRC/progress.json $D/before.json
SUM=$(shasum $SRC/progress.json | cut -d' ' -f1)

PORT=4751 SEQTRAK_DATA=$D/data node server/server.mjs > $D/server.log 2>&1 &
SERVER=$!
sleep 1.5
"$CHROME" --headless=new --disable-gpu --no-first-run --user-data-dir=$D/profile --window-size=1180,820 --virtual-time-budget=8000 --dump-dom "http://localhost:4751/" 2>/dev/null > $D/dom.html
sleep 1 # 等页面把回算的结果写回去
"$CHROME" --headless=new --disable-gpu --no-first-run --hide-scrollbars --user-data-dir=$D/profile --window-size=1180,820 --virtual-time-budget=8000 --screenshot=tools/out/backfill-home.png "http://localhost:4751/?still#/" > /dev/null 2>&1

echo "数据：$SRC（复制到临时目录里试）"
echo "首页：关卡 $(grep -o 'class="map-node' $D/dom.html | wc -l | tr -d ' ') 个，已通过 $(grep -o 'class="map-node done' $D/dom.html | wc -l | tr -d ' ')，徽章 $(grep -o '<button class="badge got' $D/dom.html | wc -l | tr -d ' ') / $(grep -o '<button class="badge' $D/dom.html | wc -l | tr -d ' ')，$(grep -o 'id="level-chip"[^>]*aria-label="[^"]*' $D/dom.html | sed 's/.*aria-label="//; s/。.*//')，报错 $(grep -o '这一页出错了' $D/dom.html | wc -l | tr -d ' ') 处"
echo "教练说：$(grep -o 'class="say-text"[^>]*>[^<]*' $D/dom.html | sed 's/.*>//')"
node -e '
  const fs = require("fs");
  const before = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const after = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const same = (k) => JSON.stringify(before[k]) === JSON.stringify(after[k]);
  console.log("写回去的文件：" + (after.game ? "多了 game 这一段" : "还没有 game（页面没写回？）"));
  if (after.game) console.log("  game = " + JSON.stringify(after.game));
  console.log("  settings 里新加的：" + JSON.stringify(Object.fromEntries(Object.entries(after.settings).filter(([k]) => !(k in (before.settings || {}))))));
  for (const k of ["lessons", "charts", "practiceDays", "lastResult", "songs", "drills", "profile", "panelQuiz"]) console.log("  " + k + (same(k) ? " 原样没动" : " 变了！"));
  const kept = Object.entries(before.settings || {}).every(([k, v]) => JSON.stringify(after.settings[k]) === JSON.stringify(v));
  console.log("  settings 里原有的" + (kept ? " 原样没动" : " 变了！"));
' $D/before.json $D/data/progress.json
[[ $(shasum $SRC/progress.json | cut -d' ' -f1) == $SUM ]] && echo "原来的 $SRC/progress.json 一个字节没变" || echo "!! 原来的 $SRC/progress.json 被改了"
echo "截图 -> tools/out/backfill-home.png"

kill $SERVER 2>/dev/null
rm -rf $D
