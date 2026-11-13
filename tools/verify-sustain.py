# 开发期验证（真机镜像）：按镜像实际的节奏持续轮询 10 秒，看机器会不会漏答。
# 每 0.3 秒一轮，每轮 65 条“参数请求”、间隔 2.5 毫秒，和 public/js/mirror.js 停着时的轮询量一样。
# 只读：不写任何参数、不发音符、不出声。
# 用法：python3 tools/verify-sustain.py
import os
import re
import subprocess

BIN = "/tmp/seqtrak-midimon"
HERE = os.path.dirname(os.path.abspath(__file__))
if not os.path.exists(BIN):
    subprocess.run(["swiftc", "-O", os.path.join(HERE, "midimon.swift"), "-o", BIN], check=True)

ROUNDS = 33
GAP = 0.0025
PERIOD = 0.3


def req(*addr):
    return ["--send", "F0,43,30,7F,1C,0C," + ",".join(f"{a:02X}" for a in addr) + ",F7"]


def one_round(i):
    batch = []
    for a in [(1, 0x10, 0x27), (1, 0x10, 0x20), (1, 0x10, 0x21), (1, 0x10, 0x15), (0x30, 0x40, 0x68), (0x30, 0x40, 0x76), (0x30, 0x40, 0x7C), (0, 0, 0), (0, 0, 1)]:
        batch += req(*a)
    for p in range(11):
        batch += req(0x30, 0x50 | p, 0x0F) + req(0x30, 0x50 | p, 0x29)
    for p in (0, 1 + i % 6):  # “选中的那条”每轮都读，另一条轮流读
        for s in range(16):
            batch += req(0x70, 0x40 | p, s)
    if i % 3 == 0:
        batch += req(0x30, 0x40, 0x7E) + req(0x30, 0x40, 0x7F)
    return batch


args, sent = ["--gap", str(GAP)], 0
for i in range(ROUNDS):
    b = one_round(i)
    n = len(b) // 2
    sent += n
    args += b + ["--wait", f"{max(0.0, PERIOD - n * GAP):.3f}"]

out = subprocess.run([BIN, f"{ROUNDS * PERIOD + 1.5:.1f}", *args], capture_output=True, text=True).stdout

stream, other = [], {}
for line in out.splitlines():
    if "src=0" not in line:
        continue
    if "|" in line:
        stream += [int(b, 16) for b in line.split("|")[1].split() if re.fullmatch(r"[0-9A-F]{2}", b)]
    m = re.search(r"(NoteOn|NoteOff|CC|ProgramChange|Start|Stop|Continue)", line)
    if m:
        other[m.group(1)] = other.get(m.group(1), 0) + 1

replies, cur, state = 0, None, {}
for b in stream:
    if b == 0xF0:
        cur = [b]
    elif cur is not None:
        cur.append(b)
        if b == 0xF7:
            if len(cur) >= 10 and cur[1] == 0x43 and cur[2] == 0x10:  # 空的步也会应答，只是不带数据（正好 10 个字节）
                replies += 1
                state[tuple(cur[6:9])] = cur[9:-1]
            cur = None

print(f"持续 {ROUNDS * PERIOD:.1f} 秒，每轮约 {sent // ROUNDS} 条：共发 {sent} 条请求，收到 {replies} 条应答（{replies / sent * 100:.1f}%），合每秒 {sent / (ROUNDS * PERIOD):.0f} 条")
print(f"期间机器主动发来的其它消息：{other or '没有'}")
name = {(1, 0x10, 0x15): "工程", (1, 0x10, 0x27): "选中轨道", (1, 0x10, 0x20): "播放", (1, 0x10, 0x21): "录音", (0x30, 0x40, 0x76): "速度", (0x30, 0x40, 0x7E): "音阶", (0x30, 0x40, 0x7F): "调"}
print("机器当前状态：" + "，".join(f"{v}={state.get(k)}" for k, v in name.items()))
