#!/bin/zsh
# 开发期诊断（只读）：这台 Mac 上有哪些 codex 可执行文件、各是什么版本、brew 里有没有更新。
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

echo "--- which -a codex"
which -a codex
echo "--- resolved"
ls -la "$(which codex)"
readlink "$(which codex)" 2>/dev/null

echo "--- apps"
ls /Applications | grep -i -E 'codex|chatgpt'

echo "--- other codex binaries"
for p in /Applications/Codex.app/Contents/Resources/codex /Applications/Codex.app/Contents/Resources/bin/codex \
         /Applications/Codex.app/Contents/MacOS/codex ~/.codex/bin/codex ~/.local/bin/codex /usr/local/bin/codex \
         ~/.npm-global/bin/codex ~/.bun/bin/codex; do
  [[ -x "$p" ]] && echo "$p -> $("$p" --version 2>&1 | head -1)"
done
find /Applications/Codex.app -maxdepth 6 -type f -name 'codex*' -perm +111 2>/dev/null | head -8 | while read -r f; do
  echo "$f -> $("$f" --version 2>&1 | head -1)"
done

echo "--- brew"
brew list --versions codex 2>/dev/null || echo "(not a brew formula)"
brew list --cask --versions codex 2>/dev/null || echo "(not a brew cask)"
HOMEBREW_NO_AUTO_UPDATE=1 brew outdated --greedy 2>/dev/null | grep -i codex || echo "(brew does not list codex as outdated, based on its current local index)"
echo "--- npm global"
npm ls -g --depth=0 2>/dev/null | grep -i codex || echo "(no global npm codex)"

echo "--- codex subcommands"
codex --help 2>&1 | sed -n '/Commands:/,/Options:/p' | cut -c1-110 | head -30
