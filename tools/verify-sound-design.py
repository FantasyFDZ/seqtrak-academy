# 开发期验证（会写入，做完恢复原值）：右边 4 个 Sound Design 旋钮第 2 页的四样（起音、衰减、滤波截止、共鸣）
# 和 DX 第 5 页的四样（FM 算法、调制量、调制频率、反馈），用官方 CC 远程设了之后，从哪个地址读得出来。
# 第 4 章「合成与音色设计」用：知道了地址，真机镜像就能直接读出学生把旋钮拧到了哪儿，不靠机器发不发 CC。
#
# 只动 SYNTH 2（通道 9）和 DX（通道 10）。不发音符、不让机器播放、不出声；机器正在播放或录音时直接退出。
# 不碰 01 区。每一样：先读一遍，发一个 CC，再读一遍看哪个地址变了，然后设回原值并核对；
# 设不回去的（CC 和地址的值对不上），用 Parameter Change 把原来的字节写回去。
# 用法：python3 tools/verify-sound-design.py
#       python3 tools/verify-sound-design.py --part 8 --cc 74,71 --region 31:28:00-7F,31:38:00-7F   只测指定的轨道、CC，在指定的地址段里找
import os
import re
import subprocess
import sys

BIN = "/tmp/seqtrak-midimon"
HERE = os.path.dirname(os.path.abspath(__file__))
if not os.path.exists(BIN):
    subprocess.run(["swiftc", "-O", os.path.join(HERE, "midimon.swift"), "-o", BIN], check=True)

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
            got[tuple(m[6:9])] = tuple(m[9:-1])
    return got


def heard(out, sent):
    """机器在这段时间里发来的（不算时钟）；和我们刚发的一模一样的是 USB Thru 的回声，标出来。"""
    lines = []
    for line in out.splitlines():
        if "src=0" not in line or "|" not in line:
            continue
        body = line.split("|")[1].strip()
        lines.append(("    （回声）" if body in sent else "    ") + line.strip())
    return lines


def send(*msgs, secs=0.8):
    args, sent = ["--gap", "0.02"], set()
    for b in msgs:
        args += ["--send", ",".join(f"{x:02X}" for x in b)]
        sent.add(hexs(b))
    return heard(run(secs, *args), sent)


def region(part, dx):
    addrs = [(0x31, 0x10 | part, lo) for lo in range(0x60)]
    if dx:
        addrs += [(0x48, 0x09, lo) for lo in range(0x30)]
        for o in range(4):
            addrs += [(0x49, (o << 4) | 0x09, lo) for lo in range(0x40)]
    return addrs


def diff(a, b):
    return {k: (a.get(k), b.get(k)) for k in sorted(set(a) | set(b)) if a.get(k) != b.get(k)}


# 0. 机器必须停着、没在录音
st = ask([(1, 0x10, 0x20), (1, 0x10, 0x21), (1, 0x10, 0x15), (1, 0x10, 0x27)])
if not st:
    raise SystemExit("机器没有应答。")
playing, recording = st.get((1, 0x10, 0x20), [9])[0], st.get((1, 0x10, 0x21), [9])[0]
print(f"工程 {st.get((1, 0x10, 0x15), ['?'])[0] + 1} 号，选中轨道 {st.get((1, 0x10, 0x27), ['?'])[0]}，播放 {playing}，录音 {recording}")
if playing != 0 or recording != 0:
    raise SystemExit("机器正在播放或录音，先不打扰它。")

TESTS = [
    (8, False, [(73, "AEG ATTACK"), (75, "AEG DECAY/RELEASE"), (74, "FILTER CUTOFF"), (71, "FILTER RESONANCE")]),
    (9, True, [(73, "AEG ATTACK"), (75, "AEG DECAY/RELEASE"), (74, "FILTER CUTOFF"), (71, "FILTER RESONANCE"),
               (116, "FM ALGORITHM"), (117, "FM MODULATION AMOUNT"), (118, "FM MODULATOR FREQUENCY"), (119, "FM MODULATOR FEEDBACK")]),
]

LABELS = {cc: label for _, _, ccs in TESTS for cc, label in ccs}
argv = sys.argv[1:]
opt = {argv[i]: argv[i + 1] for i in range(0, len(argv) - 1, 2)}
if "--part" in opt:
    TESTS = [(int(opt["--part"]), False, [(int(c), LABELS.get(int(c), f"CC {c}")) for c in opt.get("--cc", "74,71").split(",")])]
EXTRA = []
for spec in opt.get("--region", "").split(","):
    if spec:
        hi, mid, rng = spec.split(":")
        lo0, lo1 = (int(x, 16) for x in rng.split("-"))
        if int(hi, 16) == 0x01:
            raise SystemExit("01 区不在这个脚本里探测。")
        EXTRA += [(int(hi, 16), int(mid, 16), lo) for lo in range(lo0, lo1 + 1)]

found = []
for part, dx, ccs in TESTS:
    addrs = EXTRA or region(part, dx)
    snap = ask(addrs)
    print(f"\n=== 轨道 {part}（通道 {part + 1}）：读到 {len(snap)} 个地址 ===")
    for cc, label in ccs:
        before = ask(addrs)
        if diff(snap, before):
            print(f"  ！和最开始读到的不一样了（机器上有人在动？）：{ {hexs(k): v for k, v in diff(snap, before).items()} }")
        val = 3 if cc == 116 else 0x52
        print(f"  CC {cc}（{label}）= {val}：")
        for l in send([0xB0 | part, cc, val]):
            print(l)
        after = ask(addrs)
        d = diff(before, after)
        print("    变了的：", {hexs(k): f"{hexs(a or ())} -> {hexs(b or ())}" for k, (a, b) in d.items()} or "没有")
        for k, (a, b) in d.items():
            found.append((part, cc, label, hexs(k), hexs(a or ()), hexs(b or ())))
        # 设回原值：只变了一个地址、而且新值就是发出去的那个数时，用同一个 CC 把原来的数发回去；否则直接把原字节写回去
        if len(d) == 1:
            (k, (a, b)), = d.items()
            if a and b and len(a) == 1 and b[0] == val:
                send([0xB0 | part, cc, a[0]], secs=0.5)
            else:
                send([0xF0, 0x43, 0x10, 0x7F, 0x1C, 0x0C, *k, *a, 0xF7], secs=0.5)
        else:
            for k, (a, b) in d.items():
                if a:
                    send([0xF0, 0x43, 0x10, 0x7F, 0x1C, 0x0C, *k, *a, 0xF7], secs=0.4)
        back = ask(addrs)
        left = diff(before, back)
        print("    恢复之后还不一样的：", {hexs(k): v for k, v in left.items()} or "没有（已恢复）")
    final = ask(addrs)
    print(f"  这条轨道和测试前相比：", {hexs(k): v for k, v in diff(snap, final).items()} or "完全一样")

print("\n== 汇总：CC → 地址（原值 -> 设成） ==")
for part, cc, label, k, a, b in found:
    print(f"  轨道 {part} CC {cc:3d} {label:24s} {k}  {a} -> {b}")
