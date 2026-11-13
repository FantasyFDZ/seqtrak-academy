#!/bin/zsh
# 重启 Mac 上 4747 端口的正式服务：停掉旧的，在后台重新起一个（日志追加到项目根目录的 server.log）。
# 改了 server/ 下的代码或 config.local.json 之后要重启一次才生效（网页那边的文件刷新就行，不用重启）。
#
# 用法——在 Mac 的终端里：
#   zsh ~/Coding/seqtrak-academy/tools/restart-server.sh
# 在虚拟机里（侧边那个 PowerShell 终端）：
#   ssh -i <你的私钥> <用户名>@<Mac 的地址> "zsh ~/Coding/seqtrak-academy/tools/restart-server.sh"
#
# 想让同一个网络里的 iPad 也能打开：在命令前面加 HOST=0.0.0.0（同网络的人都能访问，试完用不带它的命令再重启一次）。
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "${0:A:h}/.." || exit 1
PORT=${PORT:-4747}

old=$(lsof -nP -iTCP:$PORT -sTCP:LISTEN -t 2>/dev/null)
if [ -n "$old" ]; then
  echo "停掉旧的服务（进程 $old）…"
  kill $old
  for i in {1..40}; do
    lsof -nP -iTCP:$PORT -sTCP:LISTEN -t >/dev/null 2>&1 || break
    sleep 0.25
  done
fi

echo "---- $(date '+%Y-%m-%d %H:%M:%S') 重新启动 ----" >> server.log
nohup node server/server.mjs >> server.log 2>&1 < /dev/null &
for i in {1..20}; do
  new=$(lsof -nP -iTCP:$PORT -sTCP:LISTEN -t 2>/dev/null)
  [ -n "$new" ] && break
  sleep 0.25
done

if [ -n "$new" ]; then
  echo "已经重新启动（进程 $new，$(lsof -nP -iTCP:$PORT -sTCP:LISTEN | awk 'NR==2{print $9}')）。日志在 server.log。"
else
  echo "没起来。server.log 的最后几行："
  tail -20 server.log
  exit 1
fi
