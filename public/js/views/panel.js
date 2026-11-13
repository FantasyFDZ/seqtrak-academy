// 「面板」页：随时可以回来的按键百科——真机镜像、自由探索、导览、找按键、灯色速查。
// 这一页不整页滚动：最上面一行是标题和几个标签，下面是选中的那一样。
// 真机镜像、模拟机、导览是左右两栏、一屏放下（版式在 panel-widgets.js）；找按键和灯色速查在下面那一块里自己滚。
import { h, clear, rich } from '../util.js';
import { ctx } from '../context.js';
import { store } from '../store.js';
import { segmented } from '../ui.js';
import { midi } from '../midi.js';
import { mirror } from '../mirror.js';
import { connectDevice } from '../device-connect.js';
import { panelExplore, panelTour, panelQuiz, ledLegend, panelMirror } from '../panel-widgets.js';

const TABS = [
  { value: 'mirror', label: '真机镜像' },
  { value: 'explore', label: '模拟机' },
  { value: 'tour', label: '导览' },
  { value: 'quiz', label: '找按键' },
  { value: 'leds', label: '灯色速查' },
];

export function panelView(view) {
  const host = h('div', { class: 'panel-body' });
  const tabs = h('div', { class: 'panel-tabs' });
  let current = null;
  // 地址带 ?tab=tour 这样的参数可以直接打开某一个标签（截图、从别处指过来时用）
  const asked = new URLSearchParams(location.search).get('tab');
  let mode = TABS.some((t) => t.value === asked) ? asked : mirror.available ? 'mirror' : 'explore';
  let quizMode = 'mixed';

  const modes = {
    mirror: () => {
      if (!mirror.available) {
        // 还没连上，或者连上了但浏览器没给读取状态的权限
        host.append(h('div', { class: 'panel-note' },
          h('div', { class: 'callout' }, h('b', { class: 'label' }, midi.connected ? '读不到机器的状态' : '还没连上真机'),
            h('span', { html: rich(midi.connected
              ? '已经连上 SEQTRAK，但浏览器没有给“完整控制 MIDI 设备（SysEx）”的权限，所以读不到它的灯和状态。点地址栏左边的图标，把“MIDI 设备”改成允许，然后刷新页面。'
              : '用 USB-C 线把 SEQTRAK 接到这台电脑，开机（按住左下角的 [PLAY] 2 秒），再点下面的按钮。浏览器会问要不要允许使用 MIDI 设备，选“允许”。连上之后，你在真机上按什么，这里就显示什么。') })),
          h('div', { class: 'row' },
            h('button', { class: 'btn primary', type: 'button', onclick: () => connectDevice() }, '连接 SEQTRAK'),
            h('span', { class: 'muted small' }, '暂时没带机器？切到上面的「模拟机」，一样能练。'),
          )));
        return { destroy() {} };
      }
      const w = panelMirror();
      host.append(w.el);
      return w;
    },
    explore: () => {
      const w = panelExplore();
      host.append(w.el);
      return w;
    },
    tour: () => {
      const w = panelTour();
      host.append(w.el);
      return w;
    },
    quiz: () => {
      const best = store.data.panelQuiz?.best;
      let w = null;
      const slot = h('div');
      const build = () => {
        w?.destroy();
        clear(slot);
        w = panelQuiz({ count: 10, mode: quizMode, pass: 7 });
        slot.append(w.el);
      };
      host.append(
        h('div', { class: 'row', style: { marginBottom: '12px' } },
          segmented([{ value: 'name', label: '按名字找' }, { value: 'func', label: '按用途找' }, { value: 'mixed', label: '混合' }], quizMode, (v) => { quizMode = v; build(); }, '出题方式'),
          h('span', { class: 'spacer' }),
          best !== undefined && h('span', { class: 'muted small' }, `最好成绩 ${best} / 10`),
        ),
        slot,
      );
      build();
      return { destroy: () => w?.destroy() };
    },
    leds: () => {
      const w = ledLegend();
      host.append(h('div', { class: 'panel-note' },
        w.el,
        h('div', { class: 'callout tip' }, h('b', { class: 'label' }, '另外两样“显示器”'), '右边那列会亮的文字（Index）告诉你“正在调什么”；那列 8 个小灯（Global Meter）用亮几个来告诉你“调到了多少”。'),
      ));
      return w;
    },
  };

  function show(next) {
    mode = next;
    current?.destroy();
    clear(host);
    host.scrollTop = 0;
    current = modes[mode]();
    tabs.replaceChildren(segmented(TABS, mode, show));
    if (mode === 'mirror' && mirror.available) ctx.set('面板页（真机镜像）', '学生正对着屏幕上的“真机镜像”操作真机：真机上按什么，屏幕上就亮什么，并有一句解说。学生是在真机上按键，不是在屏幕上点。');
    else ctx.set('面板页（按键百科 / 模拟机）', '学生正在屏幕上的模拟 SEQTRAK 上认按键。模拟机上的组合键是“长按第一个键出现黑圈，再点第二个键”。屏幕上的模拟机一次只显示一块（鼓区 / 合成器区 / 音色与效果），上面可以切，也可以看整台。');
  }

  // 真机接上 / 拔掉：正在看镜像或模拟机的话，换成对应的那一台
  const offState = midi.on('state', () => {
    if (mirror.available && mode === 'explore') show('mirror');
    else if (mode === 'mirror') show('mirror');
  });

  view.classList.add('fixed');
  view.append(h('div', { class: 'panel-page' },
    h('div', { class: 'panel-head' }, h('h1', {}, '面板'), tabs),
    host,
  ));
  show(mode);
  return {
    destroy: () => {
      offState();
      current?.destroy();
      view.classList.remove('fixed');
    },
  };
}
