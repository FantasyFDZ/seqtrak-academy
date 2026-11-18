// 小课堂的“节奏挑战关”：直接用音游的引擎（game.js 的 RhythmGame），有下落的音符、判定、连击、偏差仪。
// 三档：铜 = 慢一点（85% 速度）、有示范音陪着；银 = 原速、有示范音；金 = 原速、只剩节拍器、要打得更准。
// 这里不记音游的成绩（不进 store.data.charts、不涨音游的经验）：小课堂的星星和经验由页面按“牌”记（views/classroom.js）。
import { h, rich } from './util.js';
import { RhythmGame } from './game.js';
import { normalizeChart } from './chart.js';
import { LoopPlayer } from './looper.js';
import { midi } from './midi.js';
import { store } from './store.js';
import { byTier, keys16, playButton } from './classroom-kit.js';
import { audio } from './audio.js';
import { RHYTHM2_TOYS, ONE_PAD_GOLD, onePad, onePadSwitch, readStrip, shotLater } from './classroom-rhythm2.js';
import { RHYTHM3_TOYS } from './classroom-rhythm3.js';
import { RHYTHM4_TOYS } from './classroom-rhythm4.js';

let shotSkipped = false;

const TIER_RULE = [
  { speed: 0.85, assist: 'guide', pass: 0.6, say: '85% 速度，示范音陪着你。准确率到 60% 就过。' },
  { speed: 1, assist: 'guide', pass: 0.72, say: '原速，示范音还在。准确率到 72% 才过。' },
  { speed: 1, assist: 'solo', pass: 0.85, say: '原速，只剩节拍器。准确率到 85% 才过。' },
];

/**
 * spec.chart：谱面（写法同 content/charts.js）。spec.rules：想改三档的规矩时写（[铜, 银, 金]，只写要改的）。
 * 2026-11-17 加的两样（“一心多用”第一批）：
 *   spec.fixed  'KICK'：这条轨道是“不动的那只手”。金那一档不画它的下落音符（它得自己走）；
 *               只有鼠标的人可以换成一块垫子版：这只手交给机器当伴奏，只打在挪的那一只（金那一档最多给到银牌）
 *   spec.words  true：舞台下面摆一条读法条（“只念开头”的读法）。铜 16 个字都在、不念的是淡的；银只显示要念的；金不显示字
 * 2026-11-18 加的（“一心多用”第二批，R10「不出声的那一拍」）：
 *   谱面里的 rests     灰音符：心里数、不许按（chart.js）。按了算错，忍住才对
 *   spec.quiet  [[从第几拍, 到第几拍], …]：这几段里节拍器、伴奏、示范音都不出声。静的时候谱面还在不在看档：铜照常、银很淡、金一点不剩。
 *               这一段过不过，除了准确率，还要看静完回来的那一下接没接上；星星按它偏了多少给（先减掉平时的平均偏差）
 *   spec.lite   true：分小段的热身里用（rhythmsteps）：开始卡片只留一句话和「开始」，过了以后收起结算卡片
 * 2026-11-18 加的（第三批）：
 *   谱面里的 stepsPerBar  一圈不是 16 格（R14「三对二」是 12 格 = 3 拍一圈）：预备拍按整圈给（三拍一圈就预备两圈）
 *   spec.fixedName  说明里怎么叫 spec.fixed 那只手（不写就是“不动的那只手”）。R14 两只手都在匀匀地打，交给机器的是“打‘三’的那只手”
 */
function rhythm(spec, env) {
  const tier = Math.max(1, env.tier || 1);
  const rule = { ...byTier(tier, TIER_RULE), ...(spec.rules ? byTier(tier, spec.rules) : {}) };
  const see = spec.see ?? byTier(tier, [1, 0.3, 0]);
  const quiet = (spec.quiet || []).map(([from, to]) => ({ from, to, see }));
  const host = h('div', { class: 'cl-rhythm-host' });
  const readHost = spec.words ? h('div', { class: 'rh-readhost' }) : null;
  const note = h('div', { class: 'cl-note' });
  const el = h('div', { class: 'cl-toy cl-rhythm' }, host, readHost, note);
  let game = null;
  let raf = 0;
  let one = !!spec.fixed && onePad.get();
  const quietNote = !quiet.length ? '' : ` 静的那一小节，谱面${see >= 1 ? '还在' : see > 0 ? '只剩淡淡的影子' : '也一起没了：全靠心里数'}。`;
  const fixedName = spec.fixedName || '不动的那只手';
  const tierNote = () => (spec.lite ? '' : `**${['铜', '银', '金'][tier - 1]}**：${rule.say}${quietNote}${!spec.fixed ? '' : one ? ` 一块垫子版：${fixedName}机器替你打。${tier >= 3 ? '这一版在金这一档最多拿银牌。' : ''}` : tier >= 3 ? ` ${fixedName}不再画出来：它得自己走。` : ''}`);
  /** 静完回来的那几下各偏了多少毫秒（减掉平时的平均偏差；没接上的是 null） */
  const backs = (g, r) => quiet.map((q) => {
    const t = g.targets.find((x) => !x.rest && Math.abs(x.beat - q.to) < 0.01);
    return t?.result && t.result.grade !== 'miss' ? Math.round(t.result.deltaMs - r.meanMs) : null;
  });

  function build() {
    game?.destroy();
    cancelAnimationFrame(raf);
    const def = { ...spec.chart };
    if (one && def.lanes?.[spec.fixed]) {
      // 一块垫子版：不动的那只手变成伴奏
      def.backing = { ...def.backing, [spec.fixed]: def.lanes[spec.fixed] };
      def.lanes = Object.fromEntries(Object.entries(def.lanes).filter(([k]) => k !== spec.fixed));
    }
    const chart = normalizeChart({ id: `classroom-${def.id || 'chart'}`, loops: 4, title: spec.title || '', ...def });
    const fixedLane = spec.fixed ? chart.lanes.findIndex((l) => l.id === spec.fixed) : -1;
    const g = new RhythmGame(chart, {
      assist: rule.assist,
      speed: rule.speed,
      metronome: true,
      inputOffsetMs: store.settings.inputOffsetMs,
      passAccuracy: rule.pass,
      // 预备拍：平常 4 拍；一圈不是 4 拍的谱面按整圈给，凑够 4 拍以上（三拍一圈 = 预备两圈 6 拍）
      countInBeats: chart.beatsPerBar === 4 ? 4 : chart.beatsPerBar * Math.ceil(4 / chart.beatsPerBar),
      showKeyHints: !midi.connected,
      hideLanes: tier >= 3 && fixedLane >= 0 ? [fixedLane] : null,
      quiet: quiet.length ? quiet : null,
    });
    game = g;
    g.mount(host).attachKeyboard();
    if (midi.connected) g.attachMidi();
    g.elStage.classList.add('compact');
    const keys = chart.lanes.map((l) => `${l.key === ' ' ? '空格' : (l.key || '').toUpperCase()} = ${l.label}`).join('，');
    g.showCard(h('div', { class: 'game-card' },
      spec.lite ? null : h('h3', { style: { marginTop: '0' } }, spec.title || '跟着落下来的音符打'),
      spec.lite ? null : h('p', { html: rich((one && spec.oneHow) || spec.how || '音符落到线上的那一刻，点那条轨道底下的键帽。') }),
      h('p', { class: 'small muted' }, midi.connected ? '直接在 SEQTRAK 上打也行。' : `${spec.lite ? '音符落到线上的那一刻，点轨道底下的键帽。' : ''}电脑上也可以按键盘：${keys}。`),
      h('div', { class: 'game-actions' },
        spec.fixed && !midi.connected ? onePadSwitch((v) => {
          one = v;
          build();
        }) : null,
        h('button', { class: 'btn primary lg', type: 'button', onclick: () => g.start() }, '开始'))));
    g.on('start', () => env.touched());
    g.on('done', (r) => {
      if (r.demo) return;
      const pct = Math.round(r.accuracy * 100);
      const held = r.rests?.total ? `灰的 ${r.rests.total} 下忍住了 **${r.rests.held}** 下。` : '';
      const back = quiet.length ? backs(g, r) : [];
      if (r.passed && back.some((v) => v === null)) {
        // 准确率够了，可是静完回来的那一下没接上：这一段练的就是它
        note.innerHTML = rich(`准确率 ${pct}%，可是静完**回来的那一下**没接上：这一${spec.lite ? '步' : '段'}练的就是它。`);
        g.showCard(h('div', { class: 'game-card' },
          h('h3', { style: { marginTop: '0' } }, '回来的那一下没接上'),
          h('p', {}, '静的那一小节，心里接着数：1、2、3、4。下一个“1”就是它。'),
          h('div', { class: 'game-actions' }, h('button', { class: 'btn primary lg', type: 'button', onclick: () => g.start() }, '再来一次'))));
      } else if (r.passed) {
        // 表现：准确率越高星越多（金那一档还要求准确率本身够高，页面会再看一眼）；有“静完回来”的看回来那一下偏多少
        const err = back.length ? back.reduce((s, v) => s + Math.abs(v), 0) / back.length : 0;
        const stars = back.length ? (err <= 35 ? 3 : err <= 60 ? 2 : 1) : r.accuracy >= 0.92 ? 3 : r.accuracy >= rule.pass + 0.08 ? 2 : 1;
        const backSay = back.length ? `静完回来的那一下：${back.map((v) => `**${Math.abs(v) < 15 ? '正好' : `${v < 0 ? '早了' : '晚了'} ${Math.abs(v)} 毫秒`}**`).join('、')}。` : '';
        if (one && tier >= 3) env.done(Math.min(stars, 1), ONE_PAD_GOLD);
        else env.done(stars);
        note.innerHTML = rich(`准确率 **${pct}%**，最高连击 **${r.maxCombo}**：过了。${held}${backSay}${one && tier >= 3 ? '一块垫子版只打了一半的活，这一档先给银牌。' : ''}`);
        if (spec.lite) g.showCard(null);
      } else {
        note.innerHTML = rich(`准确率 ${pct}%，这一${spec.lite ? '步' : '档'}要 ${Math.round(rule.pass * 100)}%。${r.rests?.total && r.rests.held < r.rests.total ? `灰的 ${r.rests.total} 下里按了 ${r.rests.total - r.rests.held} 下：灰的不按。` : ''}点「再来一次」。${tier > 1 ? '先拿下低一档也行。' : ''}`);
      }
    });
    g.on('continue', () => g.showCard(null));
    note.innerHTML = rich(tierNote());
    if (readHost) {
      // 读法条：跟着舞台走，正在响的那个音和它的字亮着
      const strip = readStrip(Object.values(def.lanes || {})[0] || '', { mode: byTier(tier, ['full', 'said', 'none']), rowLen: 16 });
      readHost.replaceChildren(strip.el);
      const tick = () => {
        const b = g.state === 'playing' && g.clock ? g.clock.nowBeat() : g.state === 'frozen' ? g.frozenBeat : -1;
        strip.setHead(b >= 0 && b < chart.totalBeats ? Math.floor((b % chart.beatsPerLoop) * 4) : -1);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }
    // 开发用（截图）：?rhshot=…-stage 摆出打到一半的舞台；…-skip 这一段算过了、进接力的下一段（只跳一次）
    shotLater((words) => {
      if (words.includes('skip') && !shotSkipped) {
        shotSkipped = true;
        env.done(3);
        return setTimeout(() => document.querySelector('.cl-relay-bar .btn.primary')?.click(), 60);
      }
      if (words.includes('stage')) g.preview('stage', Number((words.find((x) => /^b\d+$/.test(x)) || 'b6').slice(1))); // …-stage-b5：停在第 5 拍（不写就是第 6 拍）
    });
  }
  build();
  return {
    el,
    get game() {
      return game;
    },
    destroy() {
      cancelAnimationFrame(raf);
      game.destroy();
    },
  };
}

// ───────────── 热身：分成几小段的音游（R10） ─────────────

/**
 * “热身”也用音游的舞台，分成几小段带着做：每段顶上一句话说要做什么，打过了才出下一段（都按铜那一档的规矩：85% 速度、有示范音）。
 * spec.segs = [{ title, how, after（过了以后说的那句）, chart, quiet?, … }]，每一段的写法同 rhythm 的 spec。
 */
function rhythmsteps(spec, env) {
  const segs = spec.segs || [];
  let si = 0;
  let cur = null;
  let touches = 0;
  const done = segs.map(() => false);
  const head = h('div', { class: 'rh-move' });
  const host = h('div', { class: 'rh-stephost' });
  const say = h('div', { class: 'cl-note' });
  const el = h('div', { class: 'cl-toy rh-steps' }, head, host, say);
  function enter(i) {
    si = i;
    const s = segs[si];
    cur?.destroy();
    head.replaceChildren(h('small', {}, `第 ${si + 1} / ${segs.length} 步`), h('b', {}, s.title), h('span', { html: rich(s.how) }));
    say.textContent = '';
    cur = rhythm({ ...s, lite: true }, {
      ...env, tier: 1, touched() {},
      done() {
        const lastOne = si >= segs.length - 1;
        if (!done[si]) {
          done[si] = true;
          do {
            touches++;
            env.touched();
          } while (lastOne && touches < 3);
        }
        say.innerHTML = rich(`✓ ${s.after || ''}`);
        if (lastOne) return say.append(' ', h('button', { class: 'btn sm', type: 'button', onclick: () => enter(0) }, '从头再来一遍'));
        const go = h('button', { class: 'btn sm primary', type: 'button', onclick: () => enter(si + 1) }, `下一步：${segs[si + 1].title} →`);
        say.append(' ', go);
      },
    });
    host.replaceChildren(cur.el);
  }
  enter(Math.max(0, Math.min(segs.length - 1, stepShot())));
  return {
    el,
    get game() {
      return cur.game;
    },
    /** 开发用：把几小段挨个打掉（按音频时钟去打，灰的不按） */
    async __autoPlay() {
      const out = [];
      for (let i = si; i < segs.length; i++) {
        const r = await autoGame(cur.game, el);
        out.push({ seg: i, done: done[i], ...r });
        const go = say.querySelector('.btn.primary');
        if (!done[i] || !go) break;
        go.click();
        await new Promise((res) => setTimeout(res, 200));
      }
      return out;
    },
    destroy: () => cur?.destroy(),
  };
}
/** 开发用：?rhshot=s2 直接从第 3 小段开始（截图用） */
const stepShot = () => {
  const w = (new URLSearchParams(location.search).get('rhshot') || '').split('-').find((x) => /^s\d$/.test(x));
  return w ? Number(w[1]) : 0;
};
/** 开发用：把一局音游打掉。该打的按音频时钟去打，灰的不按 */
export async function autoGame(game, root = document) {
  [...root.querySelectorAll('.game-card .btn.primary')].find((b) => /开始|再来/.test(b.textContent))?.click();
  const t0 = performance.now();
  while (!(game.clock && game.state !== 'idle') && performance.now() - t0 < 3000) await new Promise((res) => setTimeout(res, 40));
  for (const t of game.targets) {
    if (t.rest) continue;
    setTimeout(() => game.hit(t.lane, performance.now(), 'keyboard'), Math.max(0, audio.ctxToPerf(game.clock.ctxAtBeat(t.beat)) - performance.now()));
  }
  while (game.state !== 'done' && performance.now() - t0 < 90000) await new Promise((res) => setTimeout(res, 150));
  await new Promise((res) => setTimeout(res, 300));
  return { accuracy: Math.round((game.result?.accuracy || 0) * 100), held: game.result?.rests?.held };
}

// ───────────── 热身：挪一下 ─────────────

/**
 * 把一下鼓从拍子上挪到缝里（原来 T3 的点子，并进了 R5）：一排格子，按住一下鼓左右挪，听它从“稳”变成“想动”。
 * spec.base：不动的那几条；spec.track：要挪的那一条；spec.from：一开始在第几格
 */
function nudge(spec, env) {
  const track = spec.track || 'SNARE';
  let pos = spec.from ?? 12;
  const player = new LoopPlayer({ bpm: spec.bpm || 96 });
  const grid = keys16({ editable: true, onChange: (p, i) => { pos = i; paint(); env.touched(); } });
  const say = h('div', { class: 'cl-note' });
  const paint = () => {
    const p = '-'.repeat(16).split('');
    for (const s of spec.fixed || []) p[s] = 'x';
    p[pos] = 'x';
    grid.set(p.join(''));
    player.set({ ...spec.base, [track]: p.join('') });
    const onBeat = pos % 4 === 0;
    const half = pos % 2 === 0;
    say.innerHTML = rich(onBeat ? `第 ${pos + 1} 格：**踩在拍子上**，稳。` : half ? `第 ${pos + 1} 格：落在**两拍中间**（“&”）——反拍。` : `第 ${pos + 1} 格：落在**缝里的缝里**（“e”或“a”），抢先或者拖后——这就是**切分**的味道。`);
  };
  player.onStep((s) => grid.setHead(s));
  paint();
  const el = h('div', { class: 'cl-toy cl-nudge' },
    h('div', { class: 'cl-row' }, playButton(player, { onToggle: () => env.touched() }),
      h('button', { class: 'btn', type: 'button', onclick: () => { pos = (pos + 15) % 16; paint(); env.touched(); } }, '← 往前挪一格'),
      h('button', { class: 'btn', type: 'button', onclick: () => { pos = (pos + 1) % 16; paint(); env.touched(); } }, '往后挪一格 →')),
    h('div', { class: 'cl-cap' }, spec.cap || '亮着的那一格是会挪的那一下：点别的格子，它就搬过去'),
    grid.el, say);
  return { el, destroy: () => player.stop() };
}

// 2026-11-17：“一心多用”第一批的几样（节拍器三招、重音挪一挪、一只手不动一只手挪、只念开头）在 classroom-rhythm2.js
// 2026-11-18：第二批（腾出一只手，R3 / R6 / R8 的三样新热身）在 classroom-rhythm3.js
// 2026-11-18：第三批（不断拍，三格一圈和三对二的热身）在 classroom-rhythm4.js
export const RHYTHM_TOYS = { rhythm, rhythmsteps, nudge, ...RHYTHM2_TOYS, ...RHYTHM3_TOYS, ...RHYTHM4_TOYS };
