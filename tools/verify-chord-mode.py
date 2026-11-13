# 开发期验证（会写入，做完恢复原值）：“单音 / 复音 / 和弦”这个开关能不能远程设、设了之后从哪个地址读得出来。
# 只动 SYNTH 2（通道 9）。不发音符、不让机器播放、不出声；机器正在播放或录音时直接退出。
#   默认：发 CC 26 = 2（官方 CC 表：0 MONO / 1 POLY / 2 CHORD），看音色公共参数块（31 18 xx）里哪个地址变了，再设回原值并核对。
#   --sound：再多做一步——在 CHORD 状态下换到相邻的一个音色，看开关有没有跟着音色变，然后把音色和开关都换回来并核对。
# 用法：python3 tools/verify-chord-mode.py [--sound]
import os
import re
import subprocess
import sys

BIN = "/tmp/seqtrak-midimon"
HERE = os.path.dirname(os.path.abspath(__file__))
if not os.path.exists(BIN):
    subprocess.run(["swiftc", "-O", os.path.join(HERE, "midimon.swift"), "-o", BIN], check=True)

PART = 8  # SYNTH 2
CH = 0xB0 | PART
hexs = lambda bs: " ".join(f"{b:02X}" for b in bs)


def run(secs, *args):
    return subprocess.run([BIN, str(secs), *args], capture_output=True, text=True).stdout


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
    args = ["--gap", str(gap)]
    for a in addrs:
        args += req(*a)
    got = {}
    for m in messages(run(f"{len(addrs) * gap + 1.0:.1f}", *args)):
        if len(m) >= 10 and m[1] == 0x43 and (m[2] & 0xF0) == 0x10 and m[5] == 0x0C:
            got[tuple(m[6:9])] = m[9:-1]
    return got


def block():
    got = ask([(0x31, 0x10 | PART, lo) for lo in range(0x60)])
    return {a[2]: tuple(d) for a, d in got.items()}


def sound_no():
    d = ask([(0x01, 0x10 | PART, 0x33)]).get((0x01, 0x10 | PART, 0x33))
    return None if d is None else d[0] * 128 + d[1]


def name():
    d = ask([(0x31, PART, 0x00)]).get((0x31, PART, 0x00), [])
    return bytes(b for b in d if 32 <= b < 127).decode("ascii", "replace").strip()


def heard(out, sent):
    """机器在这段时间里发来的消息；和我们刚发的一模一样的那些是 USB Thru 的回声，标出来。"""
    lines = []
    for line in out.splitlines():
        if "src=0" not in line or "|" not in line:
            continue
        body = line.split("|")[1].strip()
        lines.append(("  （回声）" if body in sent else "  ") + line.strip())
    return lines


def send_cc(*pairs, secs=1.0):
    args, sent = ["--gap", "0.02"], set()
    for b in pairs:
        args += ["--send", ",".join(f"{x:02X}" for x in b)]
        sent.add(hexs(b))
    out = run(secs, *args)
    for l in heard(out, sent):
        print(l)


# 0. 机器必须停着、没在录音
st = ask([(1, 0x10, 0x20), (1, 0x10, 0x21), (1, 0x10, 0x15), (1, 0x10, 0x27)])
if not st:
    raise SystemExit("机器没有应答。")
playing, recording = st.get((1, 0x10, 0x20), [9])[0], st.get((1, 0x10, 0x21), [9])[0]
print(f"工程 {st.get((1, 0x10, 0x15), ['?'])[0]}，选中轨道 {st.get((1, 0x10, 0x27), ['?'])[0]}，播放 {playing}，录音 {recording}")
if playing != 0 or recording != 0:
    raise SystemExit("机器正在播放或录音，先不打扰它。")

before = block()
no0 = sound_no()
print(f"SYNTH 2 现在的音色：编号 {None if no0 is None else no0 + 1}「{name()}」；31 18 23 = {hexs(before.get(0x23, []))}")

# 1. CC 26 = 2（CHORD）
print("\n发 CC 26 = 2（通道 9）之后机器发来的：")
send_cc([CH, 26, 2])
after = block()
diff = {lo: (before.get(lo), after.get(lo)) for lo in sorted(set(before) | set(after)) if before.get(lo) != after.get(lo)}
print("变了的地址：", {f"31 18 {lo:02X}": f"{hexs(a or [])} -> {hexs(b or [])}" for lo, (a, b) in diff.items()} or "没有")
orig = before.get(0x23, (1,))[0]

if "--sound" in sys.argv and no0 is not None and diff:
    # 2. 这个开关是不是跟着音色走：先设回原值，再依次换几个音色，每换一个读一次
    #    音色编号取自官方 Sound List：1297 Ethereal [Chord]、1296 Ethereal、1292 Multi Saw Pad
    send_cc([CH, 26, orig])

    def select(no, label):
        print(f"\n换到 {label}（Sound List 编号 {no}）：")
        send_cc([CH, 0, 0x3F], [CH, 32, (no - 1) // 128], [0xC0 | PART, (no - 1) % 128], secs=1.2)
        print(f"  读回：音色编号 {sound_no() + 1}，31 18 23 = {hexs(block().get(0x23, []))}")

    select(1297, "名字带 [Chord] 的 Ethereal [Chord]")
    select(1296, "不带 [Chord] 的 Ethereal")
    print("\n在这个音色上手动设成 CHORD（CC 26 = 2）：")
    send_cc([CH, 26, 2])
    print(f"  读回：31 18 23 = {hexs(block().get(0x23, []))}")
    select(1292, "另一个音色 Multi Saw Pad（设成 CHORD 之后再换音色，开关还在不在）")
    select(no0 + 1, "原来的音色")

# 3. 恢复开关原值并核对
print(f"\n把开关设回原值（CC 26 = {orig}）：")
send_cc([CH, 26, orig])
final = block()
left = {f"31 18 {lo:02X}": f"{hexs(before.get(lo) or [])} -> {hexs(final.get(lo) or [])}" for lo in sorted(set(before) | set(final)) if before.get(lo) != final.get(lo)}
print("和测试前相比还不一样的地址：", left or "没有（已恢复）")
print(f"音色编号：测试前 {None if no0 is None else no0 + 1}，现在 {sound_no() + 1}")
