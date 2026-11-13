# 开发期探测（只读）：第 3 章「和弦与和声」要用到的几样东西，机器里实际是什么样。
#   1. 三条合成器轨（SYNTH 1 / SYNTH 2 / DX）在当前工程里存的和弦：每个 Synth key 最多 4 个音（官方 Data List：30 6p xx / 30 7p xx）
#   2. 当前音阶表（30 4D xx），确认 7 个 Synth keys 还是出厂的那组音
#   3. 三条合成器轨的音色公共参数块（31 1p xx），用来找“单音 / 复音 / 和弦”存在哪个地址
# 只读：不写任何参数、不发音符、不出声。
# 用法：python3 tools/probe-chords.py [--all] [--dump]      --all 把 8 个音阶的和弦都列出来；--dump 把 31 1p 块整段打印出来
import os
import re
import subprocess
import sys

BIN = "/tmp/seqtrak-midimon"
HERE = os.path.dirname(os.path.abspath(__file__))
if not os.path.exists(BIN):
    subprocess.run(["swiftc", "-O", os.path.join(HERE, "midimon.swift"), "-o", BIN], check=True)

NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
PARTS = {7: "SYNTH 1", 8: "SYNTH 2", 9: "DX"}


def note(n):
    return f"{NAMES[n % 12]}{n // 12 - 2}" if n else "--"


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


def ask(addrs, gap=0.004):
    """问一批地址，返回 {地址: 数据字节}。"""
    args = ["--gap", str(gap)]
    for a in addrs:
        args += req(*a)
    out = subprocess.run([BIN, f"{len(addrs) * gap + 1.2:.1f}", *args], capture_output=True, text=True).stdout
    got = {}
    for m in messages(out):
        if len(m) >= 10 and m[1] == 0x43 and (m[2] & 0xF0) == 0x10 and m[5] == 0x0C:
            got[tuple(m[6:9])] = m[9:-1]
    return got


hexs = lambda bs: " ".join(f"{b:02X}" for b in bs)

# ── 0. 机器现在的状态 ──
STATE = {
    (1, 0x10, 0x15): "工程", (1, 0x10, 0x27): "选中轨道", (1, 0x10, 0x20): "播放", (1, 0x10, 0x21): "录音",
    (0x30, 0x40, 0x7E): "音阶", (0x30, 0x40, 0x7F): "调", (0x30, 0x57, 0x0C): "SYNTH 1 八度", (0x30, 0x58, 0x0C): "SYNTH 2 八度", (0x30, 0x59, 0x0C): "DX 八度",
}
st = ask(list(STATE))
if not st:
    raise SystemExit("机器没有应答：它开着吗？USB 线接在这台 Mac 上吗？")
for a, n in STATE.items():
    print(f"{hexs(a)}  {n:<10} -> {hexs(st[a]) if a in st else '没有应答'}")
scale = st.get((0x30, 0x40, 0x7E), [0])[0]

# ── 1. 音阶表：8 个音阶 × 7 个键 ──
pads = ask([(0x30, 0x4D, s * 0x10 + i) for s in range(8) for i in range(7)])
print("\n音阶表（30 4D xx）：")
for s in range(8):
    row = [pads.get((0x30, 0x4D, s * 0x10 + i), [0])[0] for i in range(7)]
    print(f"  Scale {s + 1}{' *当前' if s == scale else '      '}: {hexs(row)}   {' '.join(note(n) for n in row)}")

# ── 2. 和弦：30 6p xx = Scale 1–4，30 7p xx = Scale 5–8；每个音阶占 0x20，每个键 4 个音 ──
print("\n和弦（每个 Synth key 最多 4 个音，00 = 空）：")
for p, name in PARTS.items():
    block = ask([(0x30, hi | p, lo) for hi in (0x60, 0x70) for lo in range(0x80)])
    for s in range(8):
        hi = 0x60 if s < 4 else 0x70
        base = (s % 4) * 0x20
        chords = [[block.get((0x30, hi | p, base + k * 4 + i), [0])[0] for i in range(4)] for k in range(7)]
        if s in (0, 1, scale) or "--all" in sys.argv:
            print(f"  {name} · Scale {s + 1}{'（当前）' if s == scale else ''}")
            for k, c in enumerate(chords):
                print(f"    键 {k + 1}: {hexs(c)}   {' '.join(note(n) for n in c)}")

# ── 3. 音色公共参数块：找 Mono/Poly/Chord ──
print("\n音色公共参数（31 1p xx）里取值是 0 / 1 / 2 的地址（Mono/Poly/Chord 的候选）：")
blocks = {p: ask([(0x31, 0x10 | p, lo) for lo in range(0x60)]) for p in PARTS}
for p, name in PARTS.items():
    small = [f"{lo:02X}={blocks[p][(0x31, 0x10 | p, lo)][0]}" for lo in range(0x60) if blocks[p].get((0x31, 0x10 | p, lo), [9])[0] <= 2 and len(blocks[p].get((0x31, 0x10 | p, lo), [])) == 1]
    print(f"  {name}: 应答 {len(blocks[p])}/96   {' '.join(small)}")
if "--dump" in sys.argv:
    for p, name in PARTS.items():
        print(f"\n{name} 整段：")
        for lo in range(0x60):
            d = blocks[p].get((0x31, 0x10 | p, lo))
            print(f"  31 {0x10 | p:02X} {lo:02X} -> {hexs(d) if d is not None else '没有应答'}")
