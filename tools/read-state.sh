#!/bin/zsh
# 开发期探测（只读）：向 SEQTRAK 发一批“参数请求”，看哪些状态读得出来。不出声，不改任何设置。
# 用法：zsh tools/read-state.sh
BIN=/tmp/seqtrak-midimon
[[ -x $BIN ]] || (cd "$(dirname "$0")" && swiftc -O -o $BIN midimon.swift)

req() { echo "--send F0,43,30,7F,1C,0C,$1,F7"; }

ARGS=(--gap 0.04)
# 当前工程 / 轨道 / 播放 / 录音
for a in 01,10,15 01,10,27 01,10,20 01,10,21; do ARGS+=($(req $a)); done
# 每条轨道选中的是第几段乐句（30 5p 0F）与静音（30 5p 29），p = 0..A
for p in 0 1 2 3 4 5 6 7 8 9 A; do ARGS+=($(req 30,5$p,0F) $(req 30,5$p,29)); done
# 独奏、速度、摇摆、音阶、调
for a in 30,40,68 30,40,76 30,40,7C 30,40,7E 30,40,7F; do ARGS+=($(req $a)); done
# 三条合成器轨的八度
for p in 7 8 9; do ARGS+=($(req 30,5$p,0C)); done
# 音量（扬声器 / 耳机）
ARGS+=($(req 00,00,00) $(req 00,00,01))
# 第三方资料里的“步进数据”：KICK、SNARE、HAT 1 的前 16 步（70 4p ss）
for p in 0 1 3; do
  for s in 00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F; do ARGS+=($(req 70,4$p,$s)); done
done

$BIN 6 "${ARGS[@]}" > /tmp/seqtrak-state.txt 2>&1
grep -c SEND /tmp/seqtrak-state.txt | sed 's/^/requests sent: /'
grep -c 'src=0' /tmp/seqtrak-state.txt | sed 's/^/replies: /'
grep 'src=0' /tmp/seqtrak-state.txt | cut -c12-90
