#!/bin/zsh
# 开发期检查：正式服务（端口 4747）还在不在跑，给出去的是不是磁盘上最新的文件。
cd "$(dirname "$0")/.."
PIDS=$(lsof -tiTCP:4747 -sTCP:LISTEN | tr '\n' ' ')
echo "4747 进程: ${PIDS:-没有在跑}"
for f in js/mirror.js js/lesson.js js/panel-widgets.js js/views/panel.js js/context.js js/main.js css/app.css; do
  A=$(curl -s "http://localhost:4747/$f" | shasum | cut -c 1-10)
  B=$(shasum < "public/$f" | cut -c 1-10)
  echo "$f  served=$A disk=$B  $([ "$A" = "$B" ] && echo 一致 || echo 不一致)"
done
echo "status: $(curl -s http://localhost:4747/api/status | cut -c 1-200)"
ls data 2>/dev/null | sed 's/^/data: /'
