#!/bin/zsh
# 在 Mac 上双击这个文件：启动本地服务，并用 Chrome 打开 SEQTRAK Academy。
# 关掉这个终端窗口就是停止服务。
cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
PORT=${PORT:-4747}

if lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "服务已经在运行，直接打开页面。"
  open -a "Google Chrome" "http://localhost:$PORT"
  exit 0
fi

(sleep 1.2; open -a "Google Chrome" "http://localhost:$PORT") &
exec node server/server.mjs
