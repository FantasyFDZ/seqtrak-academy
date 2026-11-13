#!/bin/zsh
# 开发期冒烟测试：检查本地服务的各个接口。
# 用法：zsh tools/smoke.sh          只测基础接口
#       zsh tools/smoke.sh deep     另外真实调用一次 Codex（要等十几秒到一两分钟）
BASE=${BASE:-http://localhost:4747}

post() { curl -s -m ${3:-30} -X POST -H 'content-type: application/json' -d "$2" "$BASE$1"; echo; }

echo "== status"
curl -s "$BASE/api/status?refresh=1"; echo

echo "== static (expect 200 html, 200 js, then 403/404 for paths outside public)"
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' "$BASE/"
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' "$BASE/js/main.js"
curl -s -o /dev/null -w '%{http_code}\n' --path-as-is "$BASE/../config.local.json"
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/%2e%2e/server/config.mjs"

echo "== cross-origin write (expect 403)"
curl -s -o /dev/null -w '%{http_code}\n' -X PUT -H 'content-type: application/json' -H 'Origin: http://evil.example' -d '{}' "$BASE/api/progress"

echo "== progress round trip"
curl -s "$BASE/api/progress"; echo

if [[ "$1" == "fast" ]]; then
  echo "== fast engine: where the key comes from"
  curl -s "$BASE/api/settings" | python3 -c 'import json,sys; d=json.load(sys.stdin); f=d["fast"]; print({k: f[k] for k in ("preset","baseUrl","model","keySource")}, "| key masked:", bool(f["keyMasked"]))'
  echo "== fast engine test"
  post /api/settings/test '{"engine":"fast"}' 60
  echo "== models"
  curl -s -m 30 "$BASE/api/settings/models" | cut -c1-600; echo
fi

if [[ "$1" == "deep" ]]; then
  echo "== deep engine test"
  post /api/settings/test '{"engine":"deep"}' 240
  echo "== drill"
  post /api/coach/drill '{"contextText":"学生刚练完「反拍镲」（116 BPM，跟打模式）：准确率 62%，平均偏早 45ms，漏了 5 个音，主要漏在第 7 步和第 15 步。之前的「四踩底鼓」拿了三星。","request":""}' 300
  echo "== chat via SSE (deep)"
  curl -s -m 300 -N -X POST -H 'content-type: application/json' \
    -d '{"engine":"deep","messages":[{"role":"user","content":"请点评我刚才这一局。"}],"contextText":"学生现在在：练习场 · 四踩底鼓\n最近一局练习的数据：\n练习「四踩底鼓」：100 BPM，1 小节 × 4 圈，模式：只有节拍器，输入方式：SEQTRAK 实机。\n结果：准确率 78%（通过，2 星），PERFECT 6 / GREAT 7 / OK 3 / MISS 0，共 16 个音，多按 0 下，最高连击 16。\n时间偏差（负数=早，正数=晚）：平均 −41ms，波动（标准差）±19ms，后半段相对前半段 −12ms。"}' \
    "$BASE/api/coach/chat"
  echo
fi
