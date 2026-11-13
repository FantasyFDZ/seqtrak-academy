// 音游旁边的真机镜像：开打之前替你看一眼机器准备好了没有、告诉你这个谱面用哪几个键；
// 打的时候，你敲哪个键，屏幕上那个键就亮一下。只在接着真机（并且读得到它的状态）时出现。
import { h, rich } from './util.js';
import { mirror } from './mirror.js';
import { seqtrak, ADDR } from './seqtrak.js';
import { TRACK } from './tracks.js';
import { SCALES, KEY_NAMES, POLY_MODES } from './scales.js';
import { toast } from './ui.js';

/** 这个谱面在真机上怎么打：打鼓、弹单个的音还是按和弦，用到哪几个 Synth key。chart = normalizeChart() 的结果。 */
function planOf(def, chart) {
  const chord = chart.lanes.filter((l) => l.kind === 'chord');
  if (chord.length) {
    return { kind: 'chord', track: def.chords?.track || 'SYNTH2', scale: def.chords?.scale || null, keys: chord.map((l) => ({ n: l.degree, label: String(l.label).split(' · ')[1] || '' })) };
  }
  const pitch = chart.lanes.filter((l) => l.kind === 'pitch');
  if (pitch.length) {
    const track = def.melody?.track || 'SYNTH1';
    // 只留音名，不带八度：判定只看是哪个音，机器上弹出来的八度和谱面上写的可以不一样
    const keys = pitch.map((l) => ({ n: Number(/Synth key (\d)/.exec(l.name || '')?.[1]) || 0, label: String(l.label).replace(/-?\d+$/, '') })).filter((k) => k.n);
    return { kind: 'pitch', track, scale: def.melody?.scale || null, keys };
  }
  const keys = chart.lanes.filter((l) => l.kind === 'drum' && TRACK[l.track]).map((l) => ({ n: TRACK[l.track].ch, label: l.label }));
  return { kind: 'drum', keys };
}

const scaleName = (s) => (s && SCALES[s.scale] ? `${SCALES[s.scale].zh} / ${KEY_NAMES[s.key] ?? '?'}` : '?');

/** 一条一条看机器准备好了没有。每条：ok、做到了怎么说、没做到该怎么做、要圈出来的键、能不能替你设。 */
function checksOf(plan) {
  const list = [{
    ok: !mirror.playing,
    done: '机器停着',
    todo: '机器正在播放：它自己放出来的音会被当成你打的。**短按一下 [PLAY]** 让它停下。',
    panel: ['PLAY'],
  }];
  if (plan.kind === 'drum') {
    list.push({
      ok: mirror.rtDrum,
      done: '打鼓模式开着：7 个 Synth keys 现在是 7 面鼓',
      todo: '还没进打鼓模式，这时候 Synth keys 弹出来的是琴音，算不了分。**按住 KICK 旋钮不放，再按一下 Synth key 1**（带圆点的录音键右边那个），然后都松开。',
      panel: ['KICK', 'SK1'],
    });
  } else {
    const label = TRACK[plan.track]?.label || plan.track;
    list.push({
      ok: mirror.selectedTrack === plan.track,
      done: `选中了 ${label}`,
      todo: `**按一下 ${label} 旋钮**选中它（只按，别转）。`,
      panel: [plan.track],
    }, {
      // 实测：在打鼓模式里按一下合成器轨的旋钮，机器会自己退出打鼓模式；万一没退，就照这句做
      ok: !mirror.rtDrum,
      done: '打鼓模式关着：Synth keys 现在是琴键',
      todo: mirror.selectedTrack === plan.track
        ? `打鼓模式还开着，Synth keys 现在敲出来的是鼓。**按住 KICK 旋钮不放，再按一下任意一个 Synth key** 退出，然后再按一下 ${label} 旋钮。`
        : `打鼓模式还开着；按了 ${label} 旋钮之后它一般会自己关掉。`,
      panel: mirror.selectedTrack === plan.track ? ['KICK', 'SK1'] : [plan.track],
    });
    if (plan.scale) {
      const now = mirror.proj;
      list.push({
        ok: now.scale === plan.scale.scale && now.key === plan.scale.key,
        done: `音阶和调对上了：${scaleName(plan.scale)}`,
        todo: `机器现在的音阶和调是 **${scaleName(now)}**，这个谱面是按 **${scaleName(plan.scale)}** 写的：不改的话，键和音对不上。`,
        panel: ['SCALE', 'KEY'],
        fix: {
          label: `替我设成 ${scaleName(plan.scale)}`,
          run: () => {
            const ok = seqtrak.write(ADDR.scale, [plan.scale.scale]) && seqtrak.write(ADDR.key, [0x40 + plan.scale.key]);
            toast(ok ? '已发给机器（改的是当前这个工程的音阶和调）' : '没发出去：机器好像断开了', ok ? 'ok' : 'bad', 3500);
          },
        },
      });
    }
    if (plan.kind === 'chord') {
      // 这个开关存在音色里（实测）：换过音色的话，它会变回那个音色自己的设定，所以每次开打之前都看一眼
      const mode = mirror.polyOf(plan.track);
      list.push({
        ok: mode === 2,
        done: `${label} 在 CHORD（和弦）上：一个键就是一整个和弦`,
        todo: `${label} 现在是 **${POLY_MODES[mode]?.name ?? '?'}**（${POLY_MODES[mode]?.what ?? '还没读到'}），这个谱面要的是 **CHORD**。慢慢转右边桔红色区域那一列旋钮里**从上往下数第 2 个**，转到那列会亮的文字里 “CHORD” 亮起来。换过音色之后也要重新转一次。`,
        panel: ['SD2'],
        fix: {
          label: '替我切到 CHORD',
          run: () => {
            const ok = mirror.setPoly(plan.track, 2);
            toast(ok ? `已发给机器（${label} 切到 CHORD）` : '没发出去：机器好像断开了', ok ? 'ok' : 'bad', 3500);
          },
        },
      });
    }
  }
  return list;
}

/**
 * def = 谱面定义，chart = normalizeChart(def)。
 * 返回 { card, panel, ready, known, onChange(fn), setBusy(bool), destroy() }
 *   card  = “开打之前”那张卡片；panel = 镜像面板；ready = 机器是不是都准备好了
 *   setBusy(true) = 正在打：停掉定时查询，只靠机器主动上报
 */
export function gameMirror(def, chart) {
  const plan = planOf(def, chart);
  const head = h('div', { class: 'label' });
  const list = h('ul', { class: 'mirror-try' });
  const keysLine = h('p', { class: 'small', style: { margin: '10px 0 0', color: 'var(--text-2)' } });
  const card = h('div', { class: 'mirror-card game-check' }, head, list, keysLine);
  const panel = h('div', { class: 'game-mirror' }, mirror.mount({ tips: false }));
  const listeners = new Set();
  let ready = false;
  let shown = '';

  keysLine.innerHTML = rich(plan.kind === 'drum'
    ? `这个谱面用到：${plan.keys.map((k) => `**Synth key ${k.n}** = ${k.label}`).join('，')}。机器准备好之后，镜子上蓝圈的就是它们。`
    : plan.kind === 'chord'
      ? `这个谱面用到：${plan.keys.map((k) => `**Synth key ${k.n}**（${k.label} 和弦）`).join('、')}。一个键按一下就是一整个和弦；屏幕上从左到右的轨道，就是这几个键从小到大。`
      : `这个谱面用到：${plan.keys.map((k) => `**Synth key ${k.n}**（${k.label}）`).join('、')}。屏幕上每条轨道下面也写着是第几个键。`);
  const usedKeys = plan.keys.map((k) => `SK${k.n}`);
  // 镜子放在舞台旁边那一栏里，地方窄：只取要看的那一块，键才看得清（没什么要特别指出来的时候，看 Synth keys 那一片）
  const look = (ids) => mirror.panel?.focus(ids, { pad: 22, minW: 300, aspect: 1.9 });
  look(['SYNTHKEYS', 'REC']);

  function render() {
    if (!mirror.known || (plan.kind === 'chord' && mirror.polyOf(plan.track) === undefined)) {
      head.textContent = '开打之前 · 正在读真机的状态…';
      return;
    }
    const checks = checksOf(plan);
    const bad = checks.find((c) => !c.ok);
    const sig = JSON.stringify(checks.map((c) => [c.ok, c.ok ? c.done : c.todo]));
    if (sig !== shown) {
      shown = sig;
      ready = !bad;
      head.textContent = ready ? '开打之前 · 真机准备好了' : '开打之前 · 真机还差一步';
      card.classList.toggle('ok', ready);
      list.replaceChildren(...checks.map((c) => h('li', { class: c.ok ? 'done' : c === bad ? 'next' : '' },
        h('span', { class: 'tick' }, c.ok ? '✓' : ''),
        h('span', {}, h('span', { html: rich(c.ok ? c.done : c.todo) }), !c.ok && c.fix ? h('button', { class: 'btn sm', type: 'button', style: { marginLeft: '8px' }, onclick: c.fix.run }, c.fix.label) : ''))));
      // 没准备好：圈出该按的键，镜子也转过去看它；准备好了：圈出这个谱面用到的键
      mirror.highlight(bad ? bad.panel : usedKeys);
      look(bad ? bad.panel : ['SYNTHKEYS', 'REC']);
      for (const fn of listeners) fn(ready);
    }
  }

  const off = mirror.on('change', render);
  render();

  return {
    card,
    panel,
    get ready() {
      return ready;
    },
    get known() {
      return mirror.known;
    },
    onChange(fn) {
      listeners.add(fn);
    },
    setBusy(busy) {
      mirror.polling = !busy;
    },
    destroy() {
      off();
      listeners.clear();
      mirror.unmount();
    },
  };
}
