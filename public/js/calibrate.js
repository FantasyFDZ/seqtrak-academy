// 延迟校准：跟着节拍器打 16 下，量出“你按下去”到“应用听见”之间固定差多少毫秒，之后判定时自动扣掉。
// 这个差值里混着音频输出延迟、MIDI 传输延迟，也混着你自己的习惯，所以换耳机 / 换音箱后要重做。
// 平时只是一张小卡片（现在的校准值 + 一个按钮）；点了“开始校准”才把舞台摆出来，做完点“完成”收回去，
// 中途随时可以点右上角的“收起”（用户 2026-11-11：展开了就收不回去，和别的卡片不协调）。
//
// 只认真正按下去的键：接着真机时，机器自己在播放的话，它放出来的每一个音都会被当成“你按的”，
// 凑够数就存下一个假的校准值（用户 2026-11-11 一下都没按，结果存下了 −77ms）。所以机器在播放时不开始，先提醒停下；
// 校准中途机器开始播放了，这一轮作废、不保存；播放时机器发来的音一律不算。
import { h, fmtMs } from './util.js';
import { RhythmGame } from './game.js';
import { normalizeChart } from './chart.js';
import { store } from './store.js';
import { midi } from './midi.js';
import { seqtrak, ADDR } from './seqtrak.js';

/** 机器的音序器在不在播放（它报上来的“开始 / 停止”，或者轮询读到的播放状态） */
const machinePlaying = () => midi.connected && (midi.playing || !!seqtrak.state.playing);

/** 开始之前当面问一次机器：页面打开之前它就在放的话，应用没收到过它的“开始”，光看上面那个不知道 */
async function askPlaying() {
  if (!midi.connected || !midi.sysex) return machinePlaying();
  try {
    const [v] = await seqtrak.read(ADDR.playing);
    return v === 1 || machinePlaying();
  } catch {
    return machinePlaying();
  }
}

// 收到的音比节拍多出这么多下，就不像是一个人跟着节拍器在按（机器在放、一下按了好几个键），结果不保存
const TOO_MANY_EXTRAS = 6;

export function calibrateWidget({ title = '延迟校准' } = {}) {
  const chart = normalizeChart({ id: 'calibrate', title: '每一拍按一下', bpm: 96, bars: 1, loops: 4, lanes: { KICK: 'x---x---x---x---' } });
  const host = h('div', { class: 'calib-stage' });
  const info = h('div', { class: 'row small' });
  const open = h('button', { class: 'btn', type: 'button' }, '开始校准（约 15 秒）');
  const fold = h('button', { class: 'btn sm ghost', type: 'button', hidden: true }, '收起');
  let game = null;
  let opened = false;
  let spoiled = false; // 这一轮中途机器开始播放了：结果作废

  /** 舞台上的一张卡片。actions = [[按钮上的字, 点了做什么, 是不是主按钮], …] */
  const card = (heading, text, actions) => h('div', { class: 'game-card' },
    h('h3', { style: { marginTop: '0' } }, heading),
    h('p', {}, text),
    h('div', { class: 'game-actions' }, actions.map(([label, fn, primary]) => h('button', { class: ['btn', primary && 'primary'], type: 'button', onclick: fn }, label))));

  function showInfo() {
    const v = store.settings.inputOffsetMs;
    info.replaceChildren(
      h('span', { class: 'muted' }, '现在的校准值：'),
      h('b', { class: 'mono' }, v === 0 ? '0ms（还没校准）' : fmtMs(v)),
      v !== 0 ? h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { store.update((d) => (d.settings.inputOffsetMs = 0)); showInfo(); } }, '清零') : '',
    );
  }

  /** 收回成小卡片 */
  function close() {
    game?.destroy();
    game = null;
    opened = false;
    host.replaceChildren();
    open.hidden = false;
    fold.hidden = true;
    showInfo();
  }

  /** 开始之前的那张卡片：机器在播放就先让它停下 */
  async function startCard() {
    if (await askPlaying()) {
      if (!game) return; // 问的这一会儿已经收起了
      game.showCard(card('机器正在播放',
        '先在机器上短按一下 [PLAY] 停下来。播放的时候机器自己放出来的音，会被当成你按的，量出来的数就不准了。',
        [['停好了，开始', startCard, true], ['取消', close]]));
      return;
    }
    if (!game) return;
    game.showCard(card('先对一下表',
      midi.connected
        ? '只听节拍器，每响一下就在机器上按一下（任何能出声的键都行）。不用看屏幕，闭着眼睛打更准。'
        : '只听节拍器，每响一下就点一下舞台下面那块键帽（电脑上也可以按键盘 J 或空格）。不用看屏幕上的音符，听着打更准。',
      [['开始', () => { spoiled = false; game.start(); }, true], ['取消', close]]));
  }

  function build() {
    game?.destroy();
    game = new RhythmGame(chart, { assist: 'solo', metronome: true, inputOffsetMs: 0, passAccuracy: 0, showKeyHints: !midi.connected });
    game.mount(host).attachKeyboard();
    // 机器上按出任何一个音都算——但机器自己在播放的时候发来的音不算
    if (midi.connected) game.attachMidi(() => (machinePlaying() ? -1 : 0));
    startCard();
    game.on('done', (r) => {
      const hits = r.total - r.counts.miss;
      const again = () => startCard();
      if (spoiled) {
        game.showCard(card('这次没有保存', '校准的时候机器开始播放了，它放出来的音会混进来。先在机器上短按 [PLAY] 停下，再测一次。', [['再测一次', again, true], ['先不测了', close]]));
      } else if (r.extras >= TOO_MANY_EXTRAS) {
        game.showCard(card('这次没有保存',
          `收到的音比节拍多出一大截（多了 ${r.extras} 下），不像是跟着节拍器一下一下按的：可能是机器自己在放，或者一下按了好几个键。每响一声只按一下，再来一次。`,
          [['再测一次', again, true], ['先不测了', close]]));
      } else if (hits >= 10 && r.stdMs < 70) {
        const offset = Math.round(r.meanMs);
        store.update((d) => (d.settings.inputOffsetMs = offset));
        game.showCard(card(`校准完成：${fmtMs(offset)}`,
          `你打得很均匀（波动 ±${Math.round(r.stdMs)}ms），整体${offset > 8 ? '偏晚' : offset < -8 ? '偏早' : '几乎正好'}。之后的判定会自动把这个差值扣掉。`,
          [['完成', close, true], ['再测一次', again]]));
      } else {
        game.showCard(card('这次没有保存',
          hits < 10 ? `只打中了 ${hits} 下，样本太少。跟着节拍器的“嘀”一下一下按就好。` : `忽早忽晚（波动 ±${Math.round(r.stdMs)}ms），量不出稳定的差值。放松，再来一次。`,
          [['再测一次', again, true], ['先不测了', close]]));
      }
      showInfo();
    });
  }

  open.addEventListener('click', () => {
    opened = true;
    open.hidden = true;
    fold.hidden = false;
    build();
  });
  fold.addEventListener('click', close);
  showInfo();
  const offs = [
    // 真机中途接上 / 拔掉：舞台已经摆出来的话，换成听机器 / 听键盘
    midi.on('state', () => opened && build()),
    // 校准打着的时候机器开始播放了：这一轮作废
    midi.on('start', () => {
      if (game && (game.state === 'countin' || game.state === 'playing')) spoiled = true;
    }),
  ];
  return {
    el: h('div', { class: 'card calib' },
      h('div', { class: 'row calib-head' }, h('h3', {}, title), h('span', { class: 'spacer' }), fold),
      h('p', { class: 'muted small' }, '跟着节拍器按 16 下，量出“你按下去”到“应用听见”之间固定差多少，之后音游判定时自动扣掉。换了耳机或音箱之后重做一次。'),
      info,
      h('div', {}, open),
      host),
    destroy() {
      offs.forEach((f) => f());
      game?.destroy();
    },
  };
}
