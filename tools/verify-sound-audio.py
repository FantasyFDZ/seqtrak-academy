# 开发期验证（会发音符、会写入，做完恢复原值、切回原来的工程）：用 SEQTRAK 自己的 USB 音频，录下机器发出的声音来回答几件
# 光靠读参数回答不了的事（第 4 章用）：
#   1. 滤波器（CC 74）往哪边是闷、往哪边是薄——看录下来的声音“重心”往低走还是往高走；共鸣（CC 71）有没有起作用
#   2. 换音色会不会把拧过的起音（31 1p 2C）换成新音色自己的
#   3. 合成器轨在 CHORD 上时，从电脑发进去的一个音会不会变成一个和弦（应用“替你在机器上弹一段”要知道发根音还是发整个和弦）
#
# 为了不动用户的东西：先切到 5 号工程（空白、用户没用过），确认它确实是空白的样子再测；测完把改过的都设回去，再切回原来的工程。
# 机器正在播放或录音时直接退出。要用到 Mac 上的 ffmpeg（录 SEQTRAK 的 USB 音频）和 numpy。
# 用法：python3 tools/verify-sound-audio.py
import os
import re
import subprocess
import time

import numpy as np

BIN = "/tmp/seqtrak-midimon"
HERE = os.path.dirname(os.path.abspath(__file__))
FFMPEG = "/opt/homebrew/bin/ffmpeg"
if not os.path.exists(BIN):
    subprocess.run(["swiftc", "-O", os.path.join(HERE, "midimon.swift"), "-o", BIN], check=True)

hexs = lambda bs: " ".join(f"{b:02X}" for b in bs)


def run(secs, *args):
    return subprocess.run([BIN, str(secs), *args], capture_output=True, text=True).stdout


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
    got = {}
    for m in messages(run(f"{len(addrs) * gap + 1.0:.1f}", *args)):
        if len(m) >= 10 and m[1] == 0x43 and (m[2] & 0xF0) == 0x10 and m[5] == 0x0C:
            got[tuple(m[6:9])] = tuple(m[9:-1])
    return got


def one(addr):
    return ask([addr]).get(tuple(addr))


def send(*msgs, secs=0.4):
    args = ["--gap", "0.02"]
    for b in msgs:
        args += ["--send", ",".join(f"{x:02X}" for x in b)]
    run(secs, *args)


def name(p):
    d = one((0x01, 0x10 | p, 0x35)) or ()
    return bytes(b for i, b in enumerate(d) if i % 8 and 32 <= b < 127).decode("ascii", "replace").strip()


def project():
    d = one((0x01, 0x10, 0x15))
    return None if d is None else d[0]


def to_project(i):
    send([0xB0, 0x00, 0x40], [0xB0, 0x20, 0x00], [0xC0, i], secs=0.5)
    for _ in range(20):
        time.sleep(0.4)
        if project() == i:
            time.sleep(0.6)
            return True
    return False


def record(ch, note, secs=2.6, hold=1.5):
    """按住一个音、录下机器发出的声音，返回（单声道 float32 采样, 采样率）"""
    wav = "/tmp/ch4-audio.wav"
    rec = subprocess.Popen([FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-f", "avfoundation", "-i", ":SEQTRAK", "-t", str(secs), "-ac", "1", "-ar", "44100", wav])
    time.sleep(0.45)
    send([0x90 | (ch - 1), note, 100], secs=0.15)
    time.sleep(hold)
    send([0x80 | (ch - 1), note, 0], secs=0.15)
    rec.wait()
    raw = open(wav, "rb").read()
    data = np.frombuffer(raw[raw.find(b"data") + 8:], dtype="<i2").astype(np.float32) / 32768
    return data, 44100


def sustain(x, sr):
    """按下去之后、松手之前那一段（从声音起来 0.25 秒后开始，取 0.8 秒）"""
    env = np.abs(x)
    on = np.argmax(env > max(0.01, env.max() * 0.1))
    a = on + int(0.25 * sr)
    return x[a:a + int(0.8 * sr)]


def spectrum(x, sr):
    w = x * np.hanning(len(x))
    mag = np.abs(np.fft.rfft(w))
    f = np.fft.rfftfreq(len(w), 1 / sr)
    return f, mag


def centroid(x, sr):
    f, mag = spectrum(x, sr)
    sel = (f > 30) & (f < 16000)
    return float((f[sel] * mag[sel]).sum() / max(mag[sel].sum(), 1e-9))


def band(x, sr, lo, hi):
    f, mag = spectrum(x, sr)
    sel = (f >= lo) & (f < hi)
    return float((mag[sel] ** 2).sum())


def energy_at(x, sr, hz, width=6):
    f, mag = spectrum(x, sr)
    sel = (f > hz - width) & (f < hz + width)
    return float(mag[sel].max()) if sel.any() else 0.0


def level(x):
    return float(np.sqrt(np.mean(x ** 2))) if len(x) else 0.0


# ───────────── 0. 机器必须停着、没在录音 ─────────────
st = ask([(1, 0x10, 0x20), (1, 0x10, 0x21), (1, 0x10, 0x15)])
if not st:
    raise SystemExit("机器没有应答。")
playing, recording, p0 = st.get((1, 0x10, 0x20), [9])[0], st.get((1, 0x10, 0x21), [9])[0], st.get((1, 0x10, 0x15), [None])[0]
print(f"现在在 {p0 + 1} 号工程，播放 {playing}，录音 {recording}")
if playing or recording:
    raise SystemExit("机器正在播放或录音，先不打扰它。")

# ───────────── 1. 切到 5 号工程，确认是空白的 ─────────────
if not to_project(4):
    raise SystemExit("切不到 5 号工程。")
kick = ask([(0x70, 0x40, s) for s in range(16)])
kick_steps = [s for s in range(16) if kick.get((0x70, 0x40, s))]
names = {p: name(p) for p in (7, 8, 9)}
blocks = {p: ask([(0x31, 0x10 | p, lo) for lo in range(0x60)]) for p in (7, 8)}
offsets_default = all(blocks[p].get((0x31, 0x10 | p, lo)) == (0x40,) for p in (7, 8) for lo in (0x00, 0x2C))
print(f"5 号工程：KICK 亮着的步 {kick_steps}；音色 SYNTH 1「{names[7]}」SYNTH 2「{names[8]}」DX「{names[9]}」；起音衰减都在原样：{offsets_default}")
blank = kick_steps == [0] and names[7] == "Rn Bass" and names[8] == "Round Saw Phase" and offsets_default
if not blank:
    to_project(p0)
    raise SystemExit("5 号工程看起来不是空白的（可能用户用过），不在它上面测。已切回原来的工程。")
snap = {p: dict(blocks[p]) for p in (7, 8)}
poly8 = one((0x31, 0x18, 0x23))
no8 = one((0x01, 0x18, 0x33))
print(f"SYNTH 2：音色编号 {no8[0] * 128 + no8[1] + 1}，弹法 {poly8}")

try:
    # ───────────── 2. 滤波器往哪边是闷（SYNTH 1，通道 8，按住 C2） ─────────────
    print("\n== 滤波器（CC 74），SYNTH 1 按住音符 48 ==")
    res = {}
    for v in (64, 16, 112):
        send([0xB7, 74, v])
        x, sr = record(8, 48)
        s = sustain(x, sr)
        res[v] = (centroid(s, sr), band(s, sr, 30, 250), band(s, sr, 2000, 12000), level(s))
        print(f"  CC 74 = {v:3d}：电平 {res[v][3]:.4f}  重心 {res[v][0]:7.0f} Hz  低频能量 {res[v][1]:.3g}  高频能量 {res[v][2]:.3g}")
    lo, mid, hi = res[16][0], res[64][0], res[112][0]
    if res[64][3] < 0.002:
        print("  录到的声音太小（USB 音频可能没声），这一项不下结论。")
    elif lo < mid < hi:
        print("  结论：数值往小 = 闷（低通），往大 = 薄（高通）。")
    elif lo > mid > hi:
        print("  结论：数值往小 = 薄（高通），往大 = 闷（低通）。")
    else:
        print("  结论：看不出单调的变化。")

    # 共鸣：先往闷里拧一些，再把共鸣拉高，看切口附近有没有冒出一个尖峰
    print("\n== 共鸣（CC 71），CC 74 = 36 ==")
    send([0xB7, 74, 36])
    peak = {}
    for v in (64, 120):
        send([0xB7, 71, v])
        x, sr = record(8, 48)
        s = sustain(x, sr)
        f, mag = spectrum(s, sr)
        sel = (f > 100) & (f < 8000)
        peak[v] = float(mag[sel].max() / max(np.median(mag[sel]), 1e-9))
        print(f"  CC 71 = {v:3d}：电平 {level(s):.4f}  最尖的地方比中位数高 {peak[v]:.0f} 倍，在 {f[sel][np.argmax(mag[sel])]:.0f} Hz")
    print("  结论：", "共鸣拉高后频谱变尖（起作用了）" if peak[120] > peak[64] * 1.3 else "看不出明显变化")
finally:
    send([0xB7, 71, 64], [0xB7, 74, 64])

try:
    # ───────────── 3. 换音色会不会把起音换掉（SYNTH 2，通道 9） ─────────────
    print("\n== 换音色 vs 起音（31 18 2C） ==")
    send([0xB8, 73, 0x52])
    print(f"  CC 73 = 0x52 之后：31 18 2C = {hexs(one((0x31, 0x18, 0x2C)) or ())}")
    n0 = no8[0] * 128 + no8[1]  # 音色编号 − 1
    n1 = n0 + 1
    send([0xB8, 0x00, 0x3F], [0xB8, 0x20, n1 // 128], [0xC8, n1 % 128], secs=1.2)
    got = one((0x01, 0x18, 0x33))
    print(f"  换到下一个音色（编号 {n1 + 1}，读回 {got[0] * 128 + got[1] + 1 if got else '?'}「{name(8)}」）：31 18 2C = {hexs(one((0x31, 0x18, 0x2C)) or ())}")
    send([0xB8, 0x00, 0x3F], [0xB8, 0x20, n0 // 128], [0xC8, n0 % 128], secs=1.2)
    print(f"  换回原来的音色（「{name(8)}」）：31 18 2C = {hexs(one((0x31, 0x18, 0x2C)) or ())}")

    # ───────────── 4. CHORD 上从电脑发一个音，出来几个音 ─────────────
    print("\n== CHORD 弹法下从电脑发一个音（SYNTH 2，音符 60） ==")
    targets = {"C": 261.63, "D#": 311.13, "G": 392.00, "A#": 466.16}
    for mode in (1, 2):
        send([0xB8, 26, mode])
        x, sr = record(9, 60, hold=1.3)
        s = sustain(x, sr)
        e = {k: energy_at(s, sr, hz) for k, hz in targets.items()}
        base = max(e["C"], 1e-9)
        print(f"  弹法 {('', 'POLY', 'CHORD')[mode]}：电平 {level(s):.4f}  " + "  ".join(f"{k} {v / base:.2f}" for k, v in e.items()))
    print("  （CHORD 时 D#、G、A# 那几格跟 C 差不多大 = 一个音变成了和弦；只有零点几 = 还是一个音）")
finally:
    send([0xB8, 26, poly8[0] if poly8 else 1])
    send([0xB8, 0x00, 0x3F], [0xB8, 0x20, no8[0]], [0xC8, no8[1]], secs=1.0)
    if (one((0x31, 0x18, 0x2C)) or (0x40,))[0] != 0x40:
        send([0xB8, 73, 0x40])

# ───────────── 5. 核对、切回原来的工程 ─────────────
after = {p: ask([(0x31, 0x10 | p, lo) for lo in range(0x60)]) for p in (7, 8)}
left = {f"31 1{p:X} {a[2]:02X}": f"{hexs(snap[p].get(a) or ())} -> {hexs(after[p].get(a) or ())}" for p in (7, 8) for a in set(snap[p]) | set(after[p]) if snap[p].get(a) != after[p].get(a)}
print("\n5 号工程 SYNTH 1 / SYNTH 2 和测试前相比还不一样的：", left or "没有（已恢复）")
print("SYNTH 2 现在：", name(8), "弹法", one((0x31, 0x18, 0x23)))
print("切回原来的工程：", "好了" if to_project(p0) else "没切回去！", f"（{p0 + 1} 号）")
