# 开发期：按键体检（data/midi-probe.jsonl）里出现了几个以前没见过的地址，这里只读地问一遍，看它们能不能主动查询。
# 只读：不写任何参数、不发音符、不出声。
# 用法：python3 tools/read-followup.py
import os
import re
import subprocess

BIN = "/tmp/seqtrak-midimon"
HERE = os.path.dirname(os.path.abspath(__file__))
if not os.path.exists(BIN):
    subprocess.run(["swiftc", "-O", os.path.join(HERE, "midimon.swift"), "-o", BIN], check=True)


def req(*addr):
    return ["--send", "F0,43,30,7F,1C,0C," + ",".join(f"{a:02X}" for a in addr) + ",F7"]


def messages(out):
    stream = []
    for line in out.splitlines():
        if "src=0" in line and "|" in line:
            stream += [int(b, 16) for b in line.split("|")[1].split() if re.fullmatch(r"[0-9A-F]{2}", b)]
    msgs, cur = [], None
    for b in stream:
        if b == 0xF0:
            cur = [b]
        elif cur is not None:
            cur.append(b)
            if b == 0xF7:
                msgs.append(cur)
                cur = None
    return msgs


hexs = lambda bs: " ".join(f"{b:02X}" for b in bs)

# 1. 固件版本（通用的“你是谁”查询）
ident = [m for m in messages(subprocess.run([BIN, "1.0", "--send", "F0,7E,7F,06,01,F7"], capture_output=True, text=True).stdout) if m[1] == 0x7E]
print("identity:", hexs(ident[0]) if ident else "没有应答")

# 2. 已知的状态 + 体检里新出现的地址
names = {
    (1, 0x10, 0x15): "工程", (1, 0x10, 0x27): "选中轨道", (1, 0x10, 0x20): "播放", (1, 0x10, 0x21): "录音",
    (1, 0x10, 0x19): "打鼓模式?", (1, 0x10, 0x18): "按住的功能键?", (1, 0x10, 0x2C): "最后按的 Synth key?",
    (1, 0x10, 0x2D): "?2D", (1, 0x10, 0x2E): "?2E", (1, 0x10, 0x26): "?26", (0x30, 0x40, 0x79): "?30 40 79",
    (0x30, 0x40, 0x76): "速度", (0x30, 0x40, 0x7E): "音阶", (0x30, 0x40, 0x7F): "调",
}
args = ["--gap", "0.02"]
for a in names:
    args += req(*a)
for p in range(11):
    args += req(0x30, 0x50 | p, 0x0F)
for p in range(7):
    for s in range(16):
        args += req(0x70, 0x40 | p, s)
got = {}
for m in messages(subprocess.run([BIN, "5.0", *args], capture_output=True, text=True).stdout):
    if len(m) >= 10 and m[1] == 0x43 and m[2] == 0x10:
        got[tuple(m[6:9])] = m[9:-1]
for a, n in names.items():
    print(f"{hexs(a)}  {n:<18} -> {hexs(got[a]) if a in got else '没有应答'}")
print("各轨当前乐句:", [got.get((0x30, 0x50 | p, 0x0F), ["-"])[0] for p in range(11)])
for p, n in enumerate(["KICK", "SNARE", "CLAP", "HAT1", "HAT2", "PERC1", "PERC2"]):
    steps = [s + 1 for s in range(16) if got.get((0x70, 0x40 | p, s))]
    print(f"{n:<6} 亮着的步: {steps}")
