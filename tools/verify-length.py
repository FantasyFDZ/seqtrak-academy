# 开发期验证（会写入，做完恢复原值）：一条轨道当前这段乐句的长度（官方 Data List：30 5p 16，两个字节，单位是步）能不能远程设。
# 只动 SYNTH 2 的第 1 段乐句：16 步 → 32 步 → 读回 → 设回原值并核对。乐句缩短不丢数据（手册 5.2 节），所以对内容没有影响。
# 不发音符、不让机器播放、不出声；机器正在播放或录音时直接退出。
# 用法：python3 tools/verify-length.py
import os
import re
import subprocess

BIN = "/tmp/seqtrak-midimon"
HERE = os.path.dirname(os.path.abspath(__file__))
if not os.path.exists(BIN):
    subprocess.run(["swiftc", "-O", os.path.join(HERE, "midimon.swift"), "-o", BIN], check=True)

ADDR = (0x30, 0x58, 0x16)
hexs = lambda bs: " ".join(f"{b:02X}" for b in bs)


def run(secs, *args):
    return subprocess.run([BIN, str(secs), *args], capture_output=True, text=True).stdout


def sysex(out):
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
    return [m for m in msgs if len(m) >= 10 and m[1] == 0x43 and (m[2] & 0xF0) == 0x10]


def read(*addrs):
    args = ["--gap", "0.02"]
    for a in addrs:
        args += ["--send", "F0,43,30,7F,1C,0C," + ",".join(f"{x:02X}" for x in a) + ",F7"]
    return {tuple(m[6:9]): m[9:-1] for m in sysex(run(1.0, *args))}


def write(addr, data):
    out = run(1.2, "--send", "F0,43,10,7F,1C,0C," + ",".join(f"{x:02X}" for x in (*addr, *data)) + ",F7")
    for m in sysex(out):
        print("   机器发来：", hexs(m))


st = read((1, 0x10, 0x20), (1, 0x10, 0x21), (0x30, 0x58, 0x0F))
if st.get((1, 0x10, 0x20), [9])[0] != 0 or st.get((1, 0x10, 0x21), [9])[0] != 0:
    raise SystemExit("机器正在播放或录音（或者没有应答），先不打扰它。")
if st.get((0x30, 0x58, 0x0F), [9])[0] != 0:
    raise SystemExit("SYNTH 2 不在第 1 段乐句上，这次不测。")

before = read(ADDR)[ADDR]
print("测试前：", hexs(before), f"= {before[0] * 128 + before[1]} 步")
print("写 32 步：")
write(ADDR, [0x00, 0x20])
mid = read(ADDR)[ADDR]
print("读回：", hexs(mid), f"= {mid[0] * 128 + mid[1]} 步")
print("设回原值：")
write(ADDR, before)
after = read(ADDR)[ADDR]
print("现在：", hexs(after), "（已恢复）" if after == before else "（和测试前不一样！）")
