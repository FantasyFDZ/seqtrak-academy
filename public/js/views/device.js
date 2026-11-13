// 设备页。上面是日常用的：连接状态和机器的读数、遥控、延迟校准。
// 排查问题才用得上的（按键体检、功能键测试、MIDI 监视器）收在最下面一个折叠里，默认不展开；地址带 ?unfold 时直接展开（截图用）。
import { h, clear, rich } from '../util.js';
import { midi } from '../midi.js';
import { seqtrak } from '../seqtrak.js';
import { store } from '../store.js';
import { ctx } from '../context.js';
import { api } from '../api.js';
import { toast } from '../ui.js';
import { connectDevice, firmwareBehind } from '../device-connect.js';
import { calibrateWidget } from '../calibrate.js';
import { probeWizard, holdWizard } from '../probe.js';
import { SCALES, KEY_NAMES } from '../scales.js';

export function deviceView(view) {
  ctx.set('设备页');
  const offs = [];
  const statusCard = h('div', { class: 'card' });
  const firmware = h('div');

  function renderStatus() {
    clear(statusCard);
    clear(firmware);
    if (!midi.connected) {
      const why = {
        unsupported: '这个浏览器不支持 Web MIDI。请用 Chrome 或 Edge 打开本页面。',
        denied: '浏览器拒绝了 MIDI 权限。点地址栏左边的图标，把“MIDI 设备”改成允许，然后刷新。',
        'no-device': '浏览器已经允许了 MIDI，但没有找到 SEQTRAK。确认它开着机、用 USB-C 线连着这台电脑；拔过线的话等 6 秒再插。',
      }[midi.state] || '点右边的按钮连接。浏览器会弹出一个权限窗口，选“允许”。';
      statusCard.append(h('div', { class: 'row' },
        h('span', { class: 'tag warn' }, '未连接'),
        h('span', {}, why),
        h('span', { class: 'spacer' }),
        midi.state !== 'unsupported' && h('button', { class: 'btn primary', type: 'button', onclick: () => connectDevice() }, '连接 SEQTRAK'),
      ));
      if (midi.otherInputs.length) statusCard.append(h('p', { class: 'small muted', style: { marginTop: '10px' } }, `检测到其它 MIDI 设备：${midi.otherInputs.join('、')}（本应用只使用 SEQTRAK）。`));
      return;
    }
    const s = seqtrak.state;
    const scale = SCALES[s.scale];
    statusCard.append(
      h('div', { class: 'row', style: { marginBottom: '16px' } },
        h('span', { class: 'tag ok' }, '已连接'),
        h('b', {}, 'SEQTRAK'),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn sm', type: 'button', onclick: async () => { await seqtrak.sync(); toast('已重新读取', 'ok'); } }, '重新读取'),
      ),
      h('dl', { class: 'kv two' },
        h('dt', {}, '固件'), h('dd', {}, s.firmware || '读取中…'),
        h('dt', {}, '速度'), h('dd', {}, s.tempo ? `${s.tempo} BPM` : midi.tempoRounded ? `${midi.tempoRounded} BPM（由时钟推算）` : '—'),
        h('dt', {}, '状态'), h('dd', {}, midi.playing ? '播放中' : '已停止'),
        h('dt', {}, '选中的轨道'), h('dd', {}, seqtrak.track.label),
        h('dt', {}, 'Project'), h('dd', {}, String(s.project + 1)),
        h('dt', {}, '音阶 / 调'), h('dd', {}, scale ? `${scale.name}（第 ${s.scale + 1} 个） / ${KEY_NAMES[s.key] || '?'}` : '—'),
        h('dt', {}, 'Swing'), h('dd', {}, `${s.swing} ticks`),
        h('dt', {}, '电量'), h('dd', {}, s.battery === null ? '—' : `${s.battery}%`),
        h('dt', {}, '读写参数'), h('dd', {}, midi.sysex ? '可以（已授权 SysEx）' : '不可以：浏览器没有授权 SysEx，机器读数和步骤检测会受限'),
      ),
    );
    if (firmwareBehind()) {
      firmware.append(h('div', { class: 'callout warn' }, h('b', { class: 'label' }, '固件可以更新'),
        h('span', { html: rich(`这台机器是 **${midi.identity.version}**，官方最新是 **V2.00**。V2.00 新增了：鼓轨可以改成“鼓组”或“合成器”类型、按住功能键转 [ALL] 旋钮快速调值、鼓轨也能用 [BAR LENGTH] 改长度。前两章用不到这些，后面的章节会用到。\n\n更新方法（最省事的一种）：先把电充满 → 用 USB-C 线连着电脑 → 打开官方 **SEQTRAK App**，它会提示有新固件，按提示操作。注意：用 V2.00 保存过的工程，拿回旧固件上可能无法正常使用，所以更新之后就不要再降级了。`) })));
    }
  }

  // 遥控
  const tempoInput = h('input', { class: 'input', type: 'number', min: '5', max: '300', value: '100', style: { width: '96px' } });
  const remote = h('div', { class: 'card' },
    h('h3', {}, '遥控'),
    h('p', { class: 'muted small', style: { margin: '6px 0 14px' } }, '应用可以替你按播放、设速度。课程里的“让机器播一遍并检查”用的就是这个。'),
    h('div', { class: 'row' },
      h('button', { class: 'btn', type: 'button', onclick: () => seqtrak.play() || toast('还没连接机器', 'bad') }, '▶ 播放'),
      h('button', { class: 'btn', type: 'button', onclick: () => seqtrak.stop() || toast('还没连接机器', 'bad') }, '■ 停止'),
    ),
    h('div', { class: 'row', style: { marginTop: '10px' } },
      tempoInput,
      h('button', { class: 'btn', type: 'button', onclick: () => (seqtrak.setTempo(Number(tempoInput.value)) ? toast(`机器速度已设为 ${tempoInput.value} BPM`, 'ok') : toast('还没连接机器', 'bad')) }, '设为这个速度'),
    ),
  );

  // 校准
  const calib = calibrateWidget();

  // 按键体检
  const probe = probeWizard();
  // 功能键测试：让真机镜像认出单独按住的 [DELETE] [MUTE] [SOLO] [PAGE]
  const hold = holdWizard();

  // 监视器
  const monitor = h('div', { class: 'monitor' });
  const addLine = (e) => {
    const t = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    monitor.append(h('div', { class: e.dir }, h('span', { class: 't' }, t), e.dir === 'out' ? `→ ${e.hex}` : `${e.text}　${e.hex}`));
    while (monitor.children.length > 200) monitor.firstChild.remove();
    monitor.scrollTop = monitor.scrollHeight;
  };
  midi.log.slice(-40).forEach(addLine);
  offs.push(midi.on('log', addLine));

  // 录一段发给开发者
  const note = h('input', { class: 'input', placeholder: '这段时间你在机器上做了什么？例如“按了 Drum key 1，然后转了 KICK 旋钮”', style: { flex: '1', minWidth: '240px' } });
  const recordBtn = h('button', { class: 'btn', type: 'button' }, '记录接下来 20 秒');
  recordBtn.addEventListener('click', () => {
    const events = [];
    const t0 = performance.now();
    const off = midi.on('log', (e) => events.push({ ms: Math.round(performance.now() - t0), dir: e.dir, text: e.text, hex: e.hex }));
    recordBtn.disabled = true;
    let left = 20;
    recordBtn.textContent = `记录中… ${left}`;
    const timer = setInterval(async () => {
      left--;
      recordBtn.textContent = `记录中… ${left}`;
      if (left > 0) return;
      clearInterval(timer);
      off();
      recordBtn.disabled = false;
      recordBtn.textContent = '记录接下来 20 秒';
      try {
        await api.post('/api/probe', { note: note.value.trim(), firmware: seqtrak.state.firmware, events });
        toast(`已保存 ${events.length} 条消息到 data/midi-probe.jsonl`, 'ok', 4000);
      } catch (e) {
        toast(e.message, 'bad');
      }
    }, 1000);
    offs.push(() => { clearInterval(timer); off(); });
  });

  const fold = h('details', { class: 'fold', open: new URLSearchParams(location.search).has('unfold') },
    h('summary', {}, h('span', {}, '排查问题用的'), h('small', {}, '按键体检 · 功能键测试 · MIDI 监视器。课程里某一步认不出你的操作时再来这里')),
    h('div', { class: 'fold-body' },
      probe.el,
      hold.el,
      h('div', { class: 'card' },
        h('h3', {}, 'MIDI 监视器'),
        h('p', { class: 'muted small', style: { margin: '6px 0 10px' } }, '机器发来的每一条消息（时钟除外）。在机器上按个键、转个旋钮，这里就会滚动。绿色是机器发来的，蓝色是应用发出的。'),
        monitor,
        h('div', { class: 'row', style: { marginTop: '12px' } }, note, recordBtn),
        h('p', { class: 'muted small', style: { marginTop: '8px' } }, `如果课程里某一步“检测不到”你的操作，在这里录一段，开发时可以据此修正。当前延迟校准值：${store.settings.inputOffsetMs}ms。`),
      ),
    ),
  );
  view.append(
    h('div', { class: 'page-head' }, h('h1', {}, '设备'), h('p', {}, '机器没有屏幕，这一页就是它的屏幕。应用通过 USB 读取机器的状态，也能替你按播放、设速度。')),
    h('div', { class: 'settings' },
      statusCard,
      firmware,
      h('div', { class: 'grid-2 top' }, remote, calib.el),
      fold),
  );

  renderStatus();
  offs.push(midi.on('state', renderStatus), midi.on('identity', renderStatus), seqtrak.on('state', renderStatus), midi.on('start', renderStatus), midi.on('stop', renderStatus));
  if (midi.connected) seqtrak.sync();

  return {
    destroy() {
      offs.forEach((f) => f());
      calib.destroy();
      probe.destroy();
      hold.destroy();
    },
  };
}
