#!/bin/zsh
# 开发期诊断：用几种参数组合各调用一次 codex exec，看哪种能正常返回。
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
W=$(mktemp -d)

try() {
  echo "=== codex exec $*"
  rm -f $W/out.txt
  local t0=$(date +%s)
  echo "用一句不超过 20 个字的中文向一位刚开始学电子音乐的新手打个招呼。直接回答，不要运行任何命令。" \
    | $BIN exec --skip-git-repo-check --ephemeral --color never -s read-only -C $W -o $W/out.txt "$@" - > $W/stdout.txt 2> $W/stderr.txt
  echo "exit=$? seconds=$(( $(date +%s) - t0 )) answer=[$(head -c 200 $W/out.txt 2>/dev/null)]"
  grep -h -o '"message":"[^"]*"' $W/stdout.txt $W/stderr.txt | sort -u | head -3
  grep -h -i -E '^(model|provider|reasoning effort|workdir|sandbox)' $W/stdout.txt $W/stderr.txt | cut -c1-160 | head -6
}

# 用法：CODEX_BIN=/path/to/codex zsh tools/codex-probe.sh
BIN=${CODEX_BIN:-codex}
echo "binary: $BIN ($($BIN --version 2>&1 | head -1))"
echo "--- config: model lines only ---"
grep -n -E '^model|^profile|^review_model' ~/.codex/config.toml | cut -c1-120

# 带参数时只试这一组参数；不带参数时试默认配置
if (( $# )); then
  try "$@"
else
  try
  try -c model_reasoning_effort=low
fi
rm -rf $W
