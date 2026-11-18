#!/bin/zsh
# 模拟机的两样本事——鼓轨每一步的力度（按住亮着的方键转旋钮 4）、鼓轨的乐句长度按步改（按住 [PAGE] 转鼓轨旋钮）——
# 和小课堂“用在机器上”认不认得出它们（classroom-bits.js 的 STEP_LEN / STEP_VEL、R9 的机器步）的检查。
# 用无界面的 Chrome 打开 /js/dev/sim-step-check.html（public/js/dev/sim-step-check.js：在页面里按、转，看灯、看事件、看音序器每一下照多大的力度放），
# 把每一条断言打印出来；最后一行是 passed / failed。声音好不好听、真机上是不是这样，这里验证不了。
# 另起一个临时服务（默认端口 4785，数据放临时目录），不碰 4747 的真实进度；跑完就关掉。那个页面不经过 main.js，不读不写学习进度。
#
# 用法：zsh tools/sim-step-check.sh              跑断言
#       zsh tools/sim-step-check.sh shots        不跑断言，截图到 tools/out/sim-step/（机身、霓虹两套配色；默认端口 4783）
#       PORT=4786 zsh tools/sim-step-check.sh    换一个端口
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
MODE=${1:-check}
if [[ $MODE == shots ]]; then PORT=${PORT:-4783}; else PORT=${PORT:-4785}; fi
D=$(mktemp -d)
BASE=http://localhost:$PORT
PAGE=$BASE/js/dev/sim-step-check.html

PORT=$PORT SEQTRAK_DATA=$D/data node server/server.mjs > $D/server.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null; rm -rf $D' EXIT
sleep 1.5

if [[ $MODE == shots ]]; then
  OUT=tools/out/sim-step
  mkdir -p $OUT
  # $1 = 文件名，$2 = 地址，$3 = 浏览器配置目录的名字（两套配色各用各的：上次用的配色记在浏览器里）
  shot() {
    "$CHROME" --headless=new --disable-gpu --no-first-run --hide-scrollbars --user-data-dir=$D/profile-$3 --window-size=${4:-1180,820} --virtual-time-budget=6500 --screenshot=$OUT/$1.png "$2" > /dev/null 2>&1
    echo "$1 <- ${2#$BASE}  $(ls -l $OUT/$1.png 2>/dev/null | awk '{print $5}') bytes"
  }
  put() { curl -s -X PUT -H 'Content-Type: application/json' -d "{\"version\":1,\"lessons\":{},\"charts\":{},\"songs\":{\"picked\":[]},\"settings\":{\"inputOffsetMs\":0,\"metronome\":true,\"speak\":false,\"unlockAll\":false,\"engine\":\"fast\",\"skin\":\"$1\",\"motion\":\"rich\",\"uiSound\":true$2},\"practiceDays\":[],\"lastResult\":null,\"drills\":[]}" $BASE/api/progress > /dev/null; }
  for skin in body neon; do
    # 模拟机摆成几个样子：三步锁过力度（紫色）/ 正按住一步转旋钮 4 / 按住 [PAGE] 转到 3 步、20 步 / 12 步时平时的样子 / 小课堂的那一屏
    for name in vel velhold len3 len20 short bench benchlen; do shot $skin-$name "$PAGE?shot=$name&skin=$skin" $skin; done
    shot $skin-bench-kbd "$PAGE?shot=bench&kbd&skin=$skin" $skin
    shot $skin-benchlen-kbd "$PAGE?shot=benchlen&kbd&skin=$skin" $skin
    # 应用里真的那一页：小课堂 R9 的“用在机器上”（刚进来，第 1 项），最小的平板 1024 × 768
    put $skin
    shot $skin-app-r9-machine "$BASE/?still&clstep=machine#/classroom/R9" app-$skin 1024,768
  done
  # 键盘学习方式下的设备页（键位图下面那几行说明多了一行）
  put body ',"learnMode":"keyboard"'
  shot body-app-device-kbd "$BASE/?still#/device" app-kbd 1180,1500
  exit 0
fi

"$CHROME" --version
"$CHROME" --headless=new --disable-gpu --no-first-run --user-data-dir=$D/profile --window-size=1280,900 --virtual-time-budget=${BUDGET:-600000} --dump-dom "$PAGE" 2>/dev/null > $D/dom.html
python3 - $D/dom.html <<'EOF'
import sys, re, json, html
dom = open(sys.argv[1], encoding='utf-8').read()
m = re.search(r'<pre id="check-result"[^>]*>(.*?)</pre>', dom, re.S)
if not m:
    print('sim-step-check -> 没有拿到结果（页面没跑完，或者中途出错）。页面上的报错：', re.findall(r'这一页出错了[^<]*', dom)[:2])
    sys.exit(1)
r = json.loads(html.unescape(m.group(1)))
group = None
for x in r['results']:
    if x['group'] != group:
        group = x['group']
        print(f'── {group} ──')
    print(('  ok    ' if x['ok'] else '  FAIL  ') + x['name'] + ('' if x['ok'] else '\n          ' + x['detail']))
print('── 模拟机说的话（几处的原文）──')
for s in r['says']:
    print(f"  〔{s['label']}〕{s['say']}")
if r['errors']:
    print('── 页面上冒出来的报错 ──')
    for e in r['errors']:
        print('  ' + e)
print(f"sim-step-check -> passed={r['total'] - r['failed']} failed={r['failed']} page-errors={len(r['errors'])}")
sys.exit(1 if r['failed'] or r['errors'] else 0)
EOF
