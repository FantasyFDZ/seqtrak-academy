# 开发期验证（为“真机镜像”做准备）：
#   A. 机器每秒能稳定应答多少条“参数请求”——决定镜像的刷新能有多快。只读，不出声。
#   B. 轨道切到第 2 段乐句后，步进数据是不是在 70 5p ss（推测：70 (4+乐句序号)p ss）。
#      这一项会临时把 KICK 切到第 2 段、让机器播 1 小节（约 1.5 秒，出声），然后切回第 1 段。
# 用法：python3 tools/verify-poll.py
import re
import subprocess

BIN = "/tmp/seqtrak-midimon"


def run(args):
    return subprocess.run([BIN, *args], capture_output=True, text=True).stdout


def sysex_messages(out):
    stream = []
    for line in out.splitlines():
        if "src=0" not in line:
            continue
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


def req(*addr):
    return ["--send", "F0,43,30,7F,1C,0C," + ",".join(f"{a:02X}" for a in addr) + ",F7"]


def write(*bytes_):
    return ["--send", "F0,43,10,7F,1C,0C," + ",".join(f"{a:02X}" for a in bytes_) + ",F7"]


def value(msgs, addr):
    for m in msgs:
        if len(m) > 10 and tuple(m[6:9]) == addr:
            return m[9:-1]
    return None


# ── A. 应答速度 ──
batch = []
for a in [(1, 0x10, 0x15), (1, 0x10, 0x27), (1, 0x10, 0x20), (1, 0x10, 0x21), (0x30, 0x40, 0x68), (0x30, 0x40, 0x76), (0, 0, 0), (0, 0, 1)]:
    batch += req(*a)
for p in range(11):
    batch += req(0x30, 0x50 | p, 0x0F) + req(0x30, 0x50 | p, 0x29)
for p in range(3):
    for s in range(16):
        batch += req(0x70, 0x40 | p, s)
total = len(batch) // 2
for gap in (0.02, 0.01, 0.005, 0.002):
    out = run([f"{0.6 + total * gap + 0.8:.2f}", "--gap", str(gap), *batch])
    got = len(sysex_messages(out))
    print(f"A  间隔 {gap * 1000:.0f}ms（每秒 {1 / gap:.0f} 条）：发 {total} 条，收到 {got} 条应答")

# ── B. 第 2 段乐句的步进数据地址 ──
st = sysex_messages(run(["1.0", "--gap", "0.05", *req(1, 0x10, 0x20), *req(1, 0x10, 0x21), *req(0x30, 0x50, 0x0F)]))
playing, recording, sel = value(st, (1, 0x10, 0x20)), value(st, (1, 0x10, 0x21)), value(st, (0x30, 0x50, 0x0F))
print(f"B  playing={playing} recording={recording} KICK 当前乐句={sel}")
if playing != [0] or recording != [0] or sel != [0]:
    raise SystemExit("B  机器正在播放/录音，或 KICK 不在第 1 段：跳过这一项，不去动它。")

try:
    args = ["4.6", "--gap", "0.03", *write(0x30, 0x50, 0x0F, 0x01), *req(0x30, 0x50, 0x0F)]
    for s in range(16):
        args += req(0x70, 0x50, s)
    for s in range(16):
        args += req(0x70, 0x40, s)
    args += ["--wait", "0.3", "--send", "FA", "--wait", "1.75", "--send", "FC"]
    out = run(args)
    msgs = sysex_messages(out)
    p2 = sorted(m[8] + 1 for m in msgs if len(m) > 10 and m[6] == 0x70 and m[7] == 0x50)
    p1 = sorted(m[8] + 1 for m in msgs if len(m) > 10 and m[6] == 0x70 and m[7] == 0x40)
    played = []
    for line in out.splitlines():
        m = re.search(r"NoteOn\s+ch1 .*@tick (\d+)", line)
        if m and int(m.group(1)) < 96:
            step = int((int(m.group(1)) + 1.5) // 6) + 1
            if step not in played:
                played.append(step)
    print(f"B  切到第 2 段后读回 = {value(msgs, (0x30, 0x50, 0x0F))}")
    print(f"B  70 50 ss（推测的第 2 段）= {p2}")
    print(f"B  70 40 ss（第 1 段）      = {p1}")
    print(f"B  实际播放出来的 KICK      = {sorted(played)}")
    print("B  结论：" + ("第 2 段在 70 5p ss，推测成立" if sorted(played) == p2 and p2 != p1 else "和第 2 段读数一致，但两段内容相同，无法区分" if sorted(played) == p2 else "播放内容与 70 5p ss 不一致，推测不成立"))
finally:
    back = sysex_messages(run(["1.0", "--gap", "0.05", "--send", "FC", *write(0x30, 0x50, 0x0F, 0x00), *req(0x30, 0x50, 0x0F), *req(1, 0x10, 0x20)]))
    print(f"B  已恢复：KICK 乐句={value(back, (0x30, 0x50, 0x0F))} playing={value(back, (1, 0x10, 0x20))}")
