// 连接 SEQTRAK，并把结果用提示条告诉用户。
import { midi } from './midi.js';
import { toast } from './ui.js';

export async function connectDevice({ quiet = false } = {}) {
  const ok = await midi.connect();
  if (quiet) return ok;
  if (ok) toast('已连接 SEQTRAK', 'ok');
  else if (midi.state === 'denied') toast('浏览器拒绝了 MIDI 权限：点地址栏左边的图标，允许“MIDI 设备”后刷新页面。', 'bad', 7000);
  else if (midi.state === 'unsupported') toast('这个浏览器不支持 Web MIDI，请用 Chrome 或 Edge 打开。', 'bad', 6000);
  else toast('没有找到 SEQTRAK：确认它已开机，并用 USB-C 线连着这台电脑。', 'bad', 6000);
  return ok;
}

/** 固件是否早于官方手册对应的 V2.00。没连上或读不到版本时返回 null。 */
export function firmwareBehind() {
  const v = midi.identity?.versionNumber;
  if (!midi.connected || !v) return null;
  return v < 2;
}
