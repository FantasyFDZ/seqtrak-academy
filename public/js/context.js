// “当前现场”：学生在哪一步、设备什么状态、刚才打得怎么样。每次问 AI 教练都会带上它。
import { midi } from './midi.js';
import { seqtrak } from './seqtrak.js';
import { mirror } from './mirror.js';
import { store } from './store.js';
import { resultToText } from './feedback.js';

export const ctx = {
  where: '路线图首页',
  detail: '',
  lastResult: null,

  set(where, detail = '') {
    this.where = where;
    this.detail = detail;
  },

  describe() {
    const lines = [`学生现在在：${this.where}`];
    if (this.detail) lines.push(this.detail);
    if (midi.connected) {
      const s = seqtrak.state;
      lines.push(`设备：SEQTRAK 已用 USB 连接${s.firmware ? `（固件 ${s.firmware}）` : ''}，机器速度 ${s.tempo || midi.tempoRounded || '未知'} BPM，${s.playing ? '正在播放' : '已停止'}，当前选中的轨道是 ${seqtrak.track.label}。`);
      // 屏幕上开着“真机镜像”时，把它读到的状态和学生刚做过的事也告诉教练
      if (mirror.panel && mirror.v.size) lines.push(`真机镜像读到的状态：${mirror.status().map(([k, v]) => `${k} ${v}`).join('；')}。`);
      const acts = mirror.recentActions();
      if (acts.length) lines.push(`学生最近两分钟在真机上做的事（按先后）：\n${acts.map((a) => `- ${a}`).join('\n')}`);
    } else {
      lines.push('设备：没有连接 SEQTRAK，学生在用电脑键盘模拟按键，声音由应用自己发出。');
    }
    // 课号写成“章.节”（1.2），和课程里、AI 回答里的写法一样（小纸条上的课号能点，见 coach.js 的 linkify）
    const done = Object.entries(store.data.lessons).filter(([, v]) => v.done).map(([k]) => k.replace(/^(\d+)-(\d+)$/, '$1.$2'));
    lines.push(`进度：已完成的课 ${done.length ? done.join('、') : '还没有'}；本周已经练了 ${store.weekCount()} 天；输入延迟校准值 ${store.settings.inputOffsetMs}ms。`);
    if (this.lastResult) lines.push(`最近一局练习的数据：\n${resultToText(this.lastResult)}`);
    return lines.join('\n');
  },
};
