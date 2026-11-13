# 开发期验证：第三方资料里的“读步进数据”地址（70 4p ss）读出来的内容，和机器实际播放出来的是不是一回事。
# 做法：先把 7 条鼓轨的前 16 步读一遍（只读），再让机器播 1 小节并记录各通道在哪一步发了音，然后逐轨对比。
# 会让机器出声约 1.5 秒。用法：python3 tools/verify-steps.py
import re
import subprocess

BIN = "/tmp/seqtrak-midimon"
TRACKS = ["KICK", "SNARE", "CLAP", "HAT1", "HAT2", "PERC1", "PERC2"]


def run(args):
    return subprocess.run([BIN, *args], capture_output=True, text=True).stdout


def sysex_messages(out):
    """把输出里机器发来的字节重新拼起来（长消息会被拆成几行），再按 F0…F7 切开。"""
    stream = []
    for line in out.splitlines():
        if "src=0" not in line:
            continue
        hexpart = line.split("|")[1]
        stream += [int(b, 16) for b in hexpart.split() if re.fullmatch(r"[0-9A-F]{2}", b)]
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


# 0. 状态：必须是停止且没在录音
state = sysex_messages(run(["1.2", "--gap", "0.05", "--send", "F0,43,30,7F,1C,0C,01,10,20,F7", "--send", "F0,43,30,7F,1C,0C,01,10,21,F7", "--send", "F0,43,30,7F,1C,0C,01,10,15,F7"]))
flags = {tuple(m[6:9]): m[9] for m in state if len(m) > 10}
playing, recording, project = flags.get((1, 0x10, 0x20)), flags.get((1, 0x10, 0x21)), flags.get((1, 0x10, 0x15))
print(f"project={project} playing={playing} recording={recording}")
if playing != 0 or recording != 0:
    raise SystemExit("机器正在播放或录音，先不打扰它。")

# 1. 读步进数据
reqs = []
for p in range(7):
    for s in range(16):
        reqs += ["--send", f"F0,43,30,7F,1C,0C,70,{0x40 | p:02X},{s:02X},F7"]
read = {t: [] for t in TRACKS}
for m in sysex_messages(run(["6.5", "--gap", "0.035", *reqs])):
    if len(m) >= 10 and m[1] == 0x43 and m[6] == 0x70 and (m[7] & 0xF0) == 0x40:
        p, s, data = m[7] & 0x0F, m[8], m[9:-1]
        if p < 7 and data:
            read[TRACKS[p]].append(s + 1)

# 2. 播 1 小节，记录每个通道在哪一步发了音
played = {t: [] for t in TRACKS}
out = run(["3.4", "--send", "FA", "--wait", "1.75", "--send", "FC"])
for line in out.splitlines():
    m = re.search(r"NoteOn\s+ch(\d+) .*@tick (\d+)", line)
    if not m:
        continue
    ch, tick = int(m.group(1)), int(m.group(2))
    if ch <= 7 and tick < 96:
        step = int((tick + 1.5) // 6) + 1
        if step not in played[TRACKS[ch - 1]]:
            played[TRACKS[ch - 1]].append(step)

# 3. 对比
same = 0
for t in TRACKS:
    r, q = sorted(read[t]), sorted(played[t])
    ok = r == q
    same += ok
    print(f"{t:6s} read={r}  played={q}  {'一致' if ok else '不一致'}")
print(f"{same}/7 条鼓轨一致")

after = sysex_messages(run(["0.8", "--send", "F0,43,30,7F,1C,0C,01,10,20,F7"]))
print("stopped:", [m[9] for m in after if len(m) > 10 and tuple(m[6:9]) == (1, 0x10, 0x20)])
