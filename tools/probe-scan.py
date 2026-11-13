# 开发期探测（只读）：把一段地址挨个“问”一遍（Parameter Request），看哪些有应答、值是多少。
# 只读：只发查询，不写任何参数、不发音符、不出声。01 区只问状态段（01 10 xx、01 1p xx），别的 01 地址这里拒绝。
# 用法：python3 tools/probe-scan.py 30:58:10-2A 01:10:00-7F 70:47:00-0F
#       每个参数是 高:中:低起-低止（十六进制）；加 --save 名字 会把结果存成 /tmp/seqtrak-scan-名字.txt，方便前后比较
import os
import re
import subprocess
import sys

BIN = "/tmp/seqtrak-midimon"
HERE = os.path.dirname(os.path.abspath(__file__))
if not os.path.exists(BIN):
    subprocess.run(["swiftc", "-O", os.path.join(HERE, "midimon.swift"), "-o", BIN], check=True)

hexs = lambda bs: " ".join(f"{b:02X}" for b in bs)


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
    args = ["--gap", str(gap)]
    for a in addrs:
        args += ["--send", "F0,43,30,7F,1C,0C," + ",".join(f"{x:02X}" for x in a) + ",F7"]
    out = subprocess.run([BIN, f"{len(addrs) * gap + 1.0:.1f}", *args], capture_output=True, text=True).stdout
    got = {}
    for m in messages(out):
        if len(m) >= 10 and m[1] == 0x43 and (m[2] & 0xF0) == 0x10 and m[5] == 0x0C:
            got[tuple(m[6:9])] = m[9:-1]
    return got


save = None
specs = []
argv = sys.argv[1:]
while argv:
    a = argv.pop(0)
    if a == "--save":
        save = argv.pop(0)
    else:
        specs.append(a)

lines = []
for spec in specs:
    hi, mid, rng = spec.split(":")
    hi, mid = int(hi, 16), int(mid, 16)
    lo0, lo1 = (int(x, 16) for x in (rng.split("-") + [rng])[:2])
    if hi == 0x01 and not (mid == 0x10 or 0x10 <= mid <= 0x1A):
        raise SystemExit(f"{spec}: 01 区只问状态段（01 10 xx、01 1p xx）。")
    addrs = [(hi, mid, lo) for lo in range(lo0, lo1 + 1)]
    got = ask(addrs)
    lines.append(f"== {hi:02X} {mid:02X} {lo0:02X}-{lo1:02X}：{len(got)}/{len(addrs)} 条有应答")
    for a in addrs:
        if a in got:
            lines.append(f"{hexs(a)} -> {hexs(got[a]) if got[a] else '（空）'}")
print("\n".join(lines))
if save:
    open(f"/tmp/seqtrak-scan-{save}.txt", "w").write("\n".join(lines) + "\n")
