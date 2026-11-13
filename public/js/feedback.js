// 不依赖 AI 的即时点评：根据一局的统计数据，挑出最值得说的一件事。
// 同时负责把结果写成一段文字，交给 AI 教练当“现场情况”。
import { fmtMs, pct } from './util.js';

const POS_NAME = { down: '正拍', up: '反拍（& 的位置）', sub: '16 分的夹缝（e / a）' };

// 一局里的时间偏差用两个数说（都在结果里，负 = 早）：
//   absMs   每一下离正拍多远，不分早晚，取平均。“准不准”看它：早 30、晚 30 的两下是 30，不是 0
//   meanMs  带着早晚一起平均。早的和晚的会互相抵掉，所以它不说明准不准，只说明“整体偏早还是偏晚”
// （stdMs 是标准差，只在下面挑“稳定地偏”和“忽早忽晚”时用来判断，不直接拿给学生看）
// 界面上第一个数叫“平均偏差”，第二个数叫“整体偏早 / 偏晚”——这两个叫法是用户定的
// （试过“平均每下偏 N”，他说“下偏”两个字会连着读）。meanMs 那个数不要叫成“平均偏差”。

/** “整体偏哪边”说成几个字。早晚相抵之后还剩 5 毫秒以上 → “整体偏早 / 偏晚 N”，不到就是两边差不多 */
export function leanText(meanMs, unit = 'ms') {
  const r = Math.round(meanMs);
  return Math.abs(r) >= 5 ? `整体偏${r < 0 ? '早' : '晚'} ${Math.abs(r)}${unit}` : '不偏早不偏晚';
}

/** → { tone: 'great' | 'good' | 'work', headline, detail } */
export function summarize(r) {
  if (!r || !r.total) return { tone: 'work', headline: '还没有数据', detail: '' };
  const missRate = r.counts.miss / r.total;
  const hitCount = r.total - r.counts.miss;

  if (missRate > 0.45) {
    return {
      tone: 'work',
      headline: `漏掉了 ${r.counts.miss} 个音`,
      detail: '先不急着计分。把速度降到 70%，或者先看一遍示范，眼睛盯住判定线，等音符“落地”的那一下再按。',
    };
  }

  // 某个位置明显更弱
  const pos = Object.entries(r.byPos).filter(([, v]) => v.total >= 3);
  const worst = pos.sort((a, b) => a[1].hit / a[1].total - b[1].hit / b[1].total)[0];
  const best = pos[pos.length - 1];
  if (worst && best && worst[0] !== best[0] && worst[1].hit / worst[1].total < 0.65 && best[1].hit / best[1].total > 0.85) {
    return {
      tone: 'work',
      headline: `${POS_NAME[worst[0]]}比较吃力`,
      detail: `${POS_NAME[best[0]]}你打中了 ${pct(best[1].hit / best[1].total)}，${POS_NAME[worst[0]]}只有 ${pct(worst[1].hit / worst[1].total)}。嘴里把“1 & 2 & 3 & 4 &”念出声，让手跟着嘴走。`,
    };
  }

  if (r.extras > Math.max(3, r.total * 0.25)) {
    return {
      tone: 'work',
      headline: `多按了 ${r.extras} 下`,
      detail: '空着的地方和有音的地方一样重要——留白才有律动。看步进条上灭着的格子，那里手要忍住。',
    };
  }

  if (hitCount >= 4 && Math.abs(r.meanMs) > 38 && r.stdMs < 45) {
    const early = r.meanMs < 0;
    return {
      tone: 'good',
      headline: `稳定地${early ? '早' : '晚'}了 ${Math.abs(Math.round(r.meanMs))} 毫秒`,
      detail: early
        ? '你的间隔很均匀，只是整体在抢拍。试着“等”——听到节拍器的那一下再落手，而不是预判它。如果每次都这样，去设备页做一次延迟校准。'
        : '你的间隔很均匀，只是整体拖在拍子后面。手可以抬得低一点、离按键近一点；如果每次都这样，去设备页做一次延迟校准。',
    };
  }

  if (hitCount >= 6 && r.driftMs < -30) {
    return {
      tone: 'work',
      headline: '越打越赶',
      detail: `后半段比前半段早了 ${Math.abs(Math.round(r.driftMs))} 毫秒。这很常见：一紧张就加速。打的时候让肩膀放松，脚跟着节拍器踩。`,
    };
  }
  if (hitCount >= 6 && r.driftMs > 30) {
    return {
      tone: 'work',
      headline: '越打越拖',
      detail: `后半段比前半段晚了 ${Math.round(r.driftMs)} 毫秒。注意力可能飘走了——盯住节拍器的重音，每个小节的第 1 拍重新“对齐”一次。`,
    };
  }

  if (hitCount >= 4 && r.stdMs > 55) {
    return {
      tone: 'work',
      headline: `忽早忽晚（平均偏差 ${Math.round(r.absMs)} 毫秒）`,
      detail: '节奏还没“坐稳”。别只靠眼睛追音符：嘴里数 1-2-3-4，或者用脚打拍子，让身体先有一个稳定的脉搏。',
    };
  }

  if (r.accuracy >= 0.9) {
    return {
      tone: 'great',
      headline: '很稳',
      detail: `平均偏差只有 ${Math.round(r.absMs)} 毫秒，${leanText(r.meanMs, ' 毫秒')}。可以关掉示范音，或者把速度往上提一档。`,
    };
  }

  return {
    tone: 'good',
    headline: r.passed ? '过关' : '差一点',
    detail: `打中 ${hitCount}/${r.total}，平均偏差 ${Math.round(r.absMs)} 毫秒，${leanText(r.meanMs, ' 毫秒')}。再来一遍，目标是把 OK 变成 GREAT。`,
  };
}

const ASSIST_NAME = { demo: '看示范', guide: '有示范音跟打', solo: '只有节拍器' };

/** 把一局结果写成给 AI 看的文字。 */
export function resultToText(r) {
  if (!r) return '';
  const lines = [
    `练习「${r.title}」：${r.bpm} BPM，${r.bars} 小节 × ${r.loops} 圈，模式：${ASSIST_NAME[r.assist] || r.assist}，输入方式：${r.source === 'midi' ? 'SEQTRAK 实机' : '电脑键盘（模拟）'}。`,
    `结果：准确率 ${pct(r.accuracy)}（${r.passed ? '通过' : '未通过'}，${r.stars} 星），PERFECT ${r.counts.perfect} / GREAT ${r.counts.great} / OK ${r.counts.ok} / MISS ${r.counts.miss}，共 ${r.total} 个音，多按 ${r.extras} 下，最高连击 ${r.maxCombo}。`,
    `时间偏差：平均偏差 ${Math.round(r.absMs)}ms（每一下离正拍多远，不分早晚，取绝对值再平均，准不准看这个数）；整体倾向 ${fmtMs(r.meanMs)}（带着早晚一起平均，负数=早，正数=晚，早晚会互相抵消，只说明整体偏哪边）；波动（标准差）±${Math.round(r.stdMs)}ms；后半段相对前半段 ${fmtMs(r.driftMs)}。`,
  ];
  const lanes = Object.entries(r.byLane).map(([id, v]) => `${id} 打中 ${v.hit}/${v.total}${v.hit ? `（平均偏差 ${Math.round(v.absMs)}ms，整体倾向 ${fmtMs(v.meanMs)}）` : ''}`);
  if (lanes.length) lines.push(`按轨道：${lanes.join('；')}。`);
  const pos = Object.entries(r.byPos).filter(([, v]) => v.total).map(([k, v]) => `${POS_NAME[k]} ${v.hit}/${v.total}`);
  if (pos.length) lines.push(`按拍位：${pos.join('；')}。`);
  if (r.missSteps.length) lines.push(`最常漏的步（一小节 16 步，从 1 数起）：${r.missSteps.slice(0, 5).map((s) => `第 ${s.step + 1} 步漏 ${s.count} 次`).join('，')}。`);
  if (r.pattern) lines.push(`谱面（x=有音，-=空）：${r.pattern}`);
  return lines.join('\n');
}
