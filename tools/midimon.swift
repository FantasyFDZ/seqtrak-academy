// midimon — 极简 CoreMIDI 监听/发送工具（仅用于开发期探测 SEQTRAK 的 MIDI 行为）
//
// 用法:
//   midimon [秒数=5] [--dest <端口名子串>] [--send "<hex 字节>"]... [--raw]
// 例:
//   midimon 8                       监听所有输入端口 8 秒
//   midimon 3 --dest SEQTRAK --send "90 3C 64" --send "80 3C 00"
//
// F8(clock) 与 FE(active sensing) 只计数不逐条打印，除非加 --raw。

import CoreMIDI
import Foundation

setvbuf(stdout, nil, _IOLBF, 0)

func displayName(_ obj: MIDIObjectRef) -> String {
    var cf: Unmanaged<CFString>?
    MIDIObjectGetStringProperty(obj, kMIDIPropertyDisplayName, &cf)
    return (cf?.takeRetainedValue() as String?) ?? "?"
}

func hex(_ bytes: [UInt8]) -> String {
    bytes.map { String(format: "%02X", $0) }.joined(separator: " ")
}

func describe(_ b: [UInt8]) -> String {
    guard let s = b.first else { return "" }
    if s == 0xF0 { return "SysEx (\(b.count) bytes)" }
    if s >= 0xF8 {
        switch s {
        case 0xF8: return "Clock"
        case 0xFA: return "Start"
        case 0xFB: return "Continue"
        case 0xFC: return "Stop"
        case 0xFE: return "ActiveSensing"
        default: return "Realtime"
        }
    }
    if s == 0xF2, b.count >= 3 { return "SongPosition \(Int(b[1]) | (Int(b[2]) << 7))" }
    let ch = Int(s & 0x0F) + 1
    let d1 = b.count > 1 ? Int(b[1]) : 0
    let d2 = b.count > 2 ? Int(b[2]) : 0
    switch s & 0xF0 {
    case 0x80: return "NoteOff ch\(ch) note=\(d1) vel=\(d2)"
    case 0x90: return d2 == 0 ? "NoteOff ch\(ch) note=\(d1) (vel0)" : "NoteOn  ch\(ch) note=\(d1) vel=\(d2)"
    case 0xA0: return "PolyAT  ch\(ch) note=\(d1) val=\(d2)"
    case 0xB0: return "CC      ch\(ch) cc=\(d1) val=\(d2)"
    case 0xC0: return "Program ch\(ch) pc=\(d1)"
    case 0xD0: return "ChanAT  ch\(ch) val=\(d1)"
    case 0xE0: return "Bend    ch\(ch) val=\((d2 << 7 | d1) - 8192)"
    default: return "?"
    }
}

// 把一个 packet 里可能串在一起的多条消息拆开
func split(_ data: [UInt8]) -> [[UInt8]] {
    var out: [[UInt8]] = []
    var i = 0
    while i < data.count {
        let s = data[i]
        if s == 0xF0 {
            var j = i + 1
            while j < data.count && data[j] != 0xF7 { j += 1 }
            out.append(Array(data[i...min(j, data.count - 1)]))
            i = j + 1
        } else if s >= 0xF8 {
            out.append([s]); i += 1
        } else if s >= 0x80 {
            let len: Int
            switch s & 0xF0 {
            case 0xC0, 0xD0: len = 2
            case 0xF0: len = (s == 0xF2) ? 3 : ((s == 0xF1 || s == 0xF3) ? 2 : 1)
            default: len = 3
            }
            out.append(Array(data[i..<min(i + len, data.count)]))
            i += len
        } else {
            // SysEx 续包或 running status，原样输出
            var j = i
            while j < data.count && data[j] < 0x80 { j += 1 }
            if j < data.count && data[j] == 0xF7 { j += 1 }
            out.append(Array(data[i..<j]))
            i = j
        }
    }
    return out
}

// ---- 参数 ----
var args = Array(CommandLine.arguments.dropFirst())
var duration = 5.0
var destFilter = "SEQTRAK"
var sends: [(delay: Double, bytes: [UInt8])] = []
var cursor = 0.3
var gap = 0.25         // --gap：相邻两次发送之间隔多少秒（要写在 --send 之前）
var raw = false
var untilStop = false  // --until-stop：机器先发 Start 再发 Stop（按 [PLAY] 播放又停止）之后自动结束
var idx = 0
while idx < args.count {
    let a = args[idx]
    if a == "--dest", idx + 1 < args.count { destFilter = args[idx + 1]; idx += 2 }
    else if a == "--send", idx + 1 < args.count {
        let bytes = args[idx + 1].split(whereSeparator: { $0 == " " || $0 == "," }).compactMap { UInt8($0, radix: 16) }
        sends.append((cursor, bytes)); cursor += gap; idx += 2
    }
    else if a == "--gap", idx + 1 < args.count { gap = Double(args[idx + 1]) ?? 0.25; idx += 2 }
    else if a == "--wait", idx + 1 < args.count { cursor += Double(args[idx + 1]) ?? 0; idx += 2 }
    else if a == "--raw" { raw = true; idx += 1 }
    else if a == "--until-stop" { untilStop = true; idx += 1 }
    else if let d = Double(a) { duration = d; idx += 1 }
    else { idx += 1 }
}

// ---- 列端口 ----
let nSrc = MIDIGetNumberOfSources()
let nDst = MIDIGetNumberOfDestinations()
print("== Sources (\(nSrc)) ==")
for i in 0..<nSrc { print("  [\(i)] \(displayName(MIDIGetSource(i)))") }
print("== Destinations (\(nDst)) ==")
for i in 0..<nDst { print("  [\(i)] \(displayName(MIDIGetDestination(i)))") }

var client = MIDIClientRef()
MIDIClientCreateWithBlock("seqtrak-midimon" as CFString, &client, nil)

let t0 = Date()
var started = false   // 收到或发出过 Start
var playTick = -1     // 自 Start 以来的 clock 序号（6 个 = 1 个 16 分音符步）
var clockCount = 0
var senseCount = 0
var firstClock: Date?
var lastClock: Date?
let dataOffset = MemoryLayout<MIDIPacket>.offset(of: \MIDIPacket.data) ?? 10
var sawStart = false

func printSummary() {
    print("== Summary ==")
    print("  clock ticks: \(clockCount), active sensing: \(senseCount)")
    if let a = firstClock, let b = lastClock, clockCount > 24 {
        let span = b.timeIntervalSince(a)
        let bpm = Double(clockCount - 1) / 24.0 / span * 60.0
        print(String(format: "  estimated tempo: %.1f BPM", bpm))
    }
}

var inPort = MIDIPortRef()
MIDIInputPortCreateWithBlock(client, "in" as CFString, &inPort) { pktList, refCon in
    let src = refCon.map { Int(bitPattern: $0) - 1 } ?? -1
    let n = Int(pktList.pointee.numPackets)
    var p = UnsafeMutablePointer<MIDIPacket>(mutating: UnsafeRawPointer(pktList).advanced(by: MemoryLayout<UInt32>.size).assumingMemoryBound(to: MIDIPacket.self))
    for _ in 0..<n {
        let len = Int(p.pointee.length)
        let base = UnsafeRawPointer(p).advanced(by: dataOffset)
        let bytes = [UInt8](UnsafeRawBufferPointer(start: base, count: len))
        let now = Date()
        for msg in split(bytes) {
            if msg == [0xF8] {
                clockCount += 1
                if started { playTick += 1 }
                if firstClock == nil { firstClock = now }
                lastClock = now
                if !raw { continue }
            }
            if msg == [0xFE] { senseCount += 1; if !raw { continue } }
            if msg == [0xFA] { started = true; playTick = -1; sawStart = true }
            if msg == [0xFC] {
                started = false
                if untilStop && sawStart {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                        print("== ended by Stop ==")
                        printSummary()
                        exit(0)
                    }
                }
            }
            let t = String(format: "%7.3f", now.timeIntervalSince(t0))
            let shown = msg.count > 48 ? hex(Array(msg.prefix(48))) + " …" : hex(msg)
            var pos = ""
            if started, let s = msg.first, s & 0xF0 == 0x90, msg.count > 2, msg[2] > 0 {
                pos = String(format: "  @tick %d (step %.2f)", playTick, Double(playTick) / 6.0 + 1)
            }
            print("+\(t)s src=\(src) | \(shown) | \(describe(msg))\(pos)")
        }
        p = MIDIPacketNext(p)
    }
}
for i in 0..<nSrc {
    MIDIPortConnectSource(inPort, MIDIGetSource(i), UnsafeMutableRawPointer(bitPattern: i + 1))
}

// ---- 发送 ----
if !sends.isEmpty {
    var outPort = MIDIPortRef()
    MIDIOutputPortCreate(client, "out" as CFString, &outPort)
    var dest: MIDIEndpointRef = 0
    for i in 0..<nDst where displayName(MIDIGetDestination(i)).localizedCaseInsensitiveContains(destFilter) {
        dest = MIDIGetDestination(i); break
    }
    if dest == 0 {
        print("!! 找不到名字包含 \"\(destFilter)\" 的输出端口")
    } else {
        print("== Sending to \(displayName(dest)) ==")
        for item in sends {
            let bytes = item.bytes
            DispatchQueue.main.asyncAfter(deadline: .now() + item.delay) {
                var list = MIDIPacketList()
                let pkt = MIDIPacketListInit(&list)
                _ = MIDIPacketListAdd(&list, MemoryLayout<MIDIPacketList>.size, pkt, 0, bytes.count, bytes)
                let st = MIDISend(outPort, dest, &list)
                if bytes == [0xFA] { started = true; playTick = -1 }
                if bytes == [0xFC] { started = false }
                let t = String(format: "%7.3f", Date().timeIntervalSince(t0))
                print("+\(t)s SEND  | \(hex(bytes)) | \(describe(bytes))\(st == noErr ? "" : "  (err \(st))")")
            }
        }
    }
}

RunLoop.main.run(until: Date().addingTimeInterval(duration))

print("== ended by timeout ==")
printSummary()
