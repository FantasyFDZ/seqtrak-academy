// 学习进度与练习记录：全部存成 data/ 目录下的本地文件。
import { readFile, writeFile, appendFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './config.mjs';

// 项目目录是 Mac 和 Windows 虚拟机共享的。真正练习用的是 Mac（机器接在它上面），数据放 data/；
// 虚拟机里只做开发测试，放 data-dev/，免得测试成绩混进真实进度。可用环境变量 SEQTRAK_DATA 指定别的目录。
const DATA = path.resolve(ROOT, process.env.SEQTRAK_DATA || (process.platform === 'win32' ? 'data-dev' : 'data'));
const PROGRESS = path.join(DATA, 'progress.json');
const SESSIONS = path.join(DATA, 'sessions.jsonl');
const PROBE = path.join(DATA, 'midi-probe.jsonl');

async function ensureDir() {
  await mkdir(DATA, { recursive: true });
}

export async function readProgress() {
  try {
    return JSON.parse(await readFile(PROGRESS, 'utf8'));
  } catch {
    return {};
  }
}

export async function writeProgress(obj) {
  await ensureDir();
  const tmp = PROGRESS + '.tmp';
  await writeFile(tmp, JSON.stringify(obj, null, 2));
  await rename(tmp, PROGRESS);
}

/** 追加一条练习记录（每打完一关记一条），AI 教练做长期分析时会读它。 */
export async function appendSession(entry) {
  await ensureDir();
  await appendFile(SESSIONS, JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n');
}

export async function recentSessions(limit = 30) {
  try {
    const lines = (await readFile(SESSIONS, 'utf8')).trim().split('\n');
    return lines.slice(-limit).map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

/** 设备探测日志：记录某个控件实际发出了什么 MIDI，供开发期核对映射。 */
export async function appendProbe(entry) {
  await ensureDir();
  await appendFile(PROBE, JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n');
}
