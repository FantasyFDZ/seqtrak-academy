// 啾啾：教练小鸟。照红嘴相思鸟（Leiothrix lutea）画的矢量鸟。
// 参考图：huashu-bird-sticker 里的红嘴相思鸟贴纸（CC BY 4.0，https://github.com/alchaincyf/huashu-bird-sticker）。
//
// 分层画：尾巴、远侧翅膀（只在空中出现）、腿、身体和肚子、近侧翅膀、头（脸颊、喉咙、眼睛、嘴）。
// 这样能拍翅膀、张嘴、眨眼、歪头、收腿。
//
// 两件事分开管：
//   神态（data-mood）管脸：眼睛、嘴、头的角度。在地上、在空中都可以有表情。
//   空中状态（data-air）管身子：不写 = 站在地上；fly 扑翅飞、glide 收翅滑、hover 悬停、land 刹车准备落地。
//
//   const b = createBird({ size: 120 });
//   el.append(b.el);
//   b.setMood('happy');          // 神态：一直保持，直到换别的（见 MOODS）
//   b.act('hop');                // 动作：做一次就停（见 ACTIONS）
//   b.sing('ok');                // 叫一声：嘴跟着每个音张开，冒出音符（叫法见 bird-voice.js）
//   b.say('先按住 MUTE');         // 头顶冒一句话
//   await b.flyTo(x, y);         // 在它的容器里飞过去，落在 (x, y)（爪子的位置）
//   await b.hoverAt(x, y);       // 飞过去，停在空中 (x, y)，一直扇着翅膀悬停，直到下一次 flyTo / hoverAt
import { voice } from './bird-voice.js';

export const MOODS = ['idle', 'talk', 'think', 'happy', 'cheer', 'oops', 'surprised', 'sleepy', 'listen'];
export const MOOD_NAMES = { idle: '待机', talk: '说话', think: '在想', happy: '开心', cheer: '欢呼', oops: '可惜', surprised: '吃惊', sleepy: '困了', listen: '在听' };
export const AIRS = ['fly', 'glide', 'hover', 'land'];
export const AIR_NAMES = { fly: '扑翅飞', glide: '收翅滑', hover: '悬停', land: '刹车落地' };
export const ACTIONS = ['hop', 'nod', 'shake', 'peck', 'sing', 'flap', 'flip', 'preen', 'dizzy'];
export const ACTION_NAMES = { hop: '跳一下', nod: '点头', shake: '摇头', peck: '啄一下', sing: '唱一段', flap: '拍翅膀', flip: '翻个跟头', preen: '理羽毛', dizzy: '晕了' };

// 爪子、嘴、头中心在图上的位置（viewBox 0 0 200 200 里）
const FOOT = { x: 102, y: 184 };
const BEAK = { x: 168, y: 84 };
const HEAD = { x: 124, y: 80 };

let uid = 0;

const CSS = `
.bird { --b-back: #8DB83A; --b-head: #94BE40; --b-crown: #A6C94A; --b-wing: #78A52C; --b-wing-far: #5E8822; --b-cover: #B5D667;
  --b-throat: #FFD83D; --b-breast: #FF8A24; --b-belly: #FFE9A6; --b-cheek: #BFC97F; --b-ring: #FFF4C8; --b-ink: #1B1D21;
  --b-bill: #EE3426; --b-bill-2: #C8231B; --b-red: #EC3A2A; --b-yellow: #FFC61F; --b-tail: #384252; --b-tail-2: #4C5A6E;
  --b-leg: #8E959F; --b-blush: #FF6A3D; --b-shadow: rgba(20, 24, 30, .14); --pitch: -10deg;
  position: relative; display: inline-block; width: 120px; height: 120px; flex: none; user-select: none; -webkit-user-select: none; }
.bird svg { display: block; width: 100%; height: 100%; overflow: visible; }
.bird svg * { transform-box: view-box; }
.bird.b-left svg { transform: scaleX(-1); }
.bird .b-back { fill: var(--b-back); } .bird .b-headshape { fill: var(--b-head); } .bird .b-crown { fill: var(--b-crown); }
.bird .b-throat { fill: var(--b-throat); } .bird .b-cheek { fill: var(--b-cheek); } .bird .b-ring { fill: var(--b-ring); }
.bird .b-iris { fill: var(--b-ink); } .bird .b-glint { fill: #fff; } .bird .b-lid { fill: var(--b-head); }
.bird .b-upper { fill: var(--b-bill); } .bird .b-lowerbill { fill: var(--b-bill-2); } .bird .b-blush { fill: var(--b-blush); opacity: .32; }
.bird .b-wingshape { fill: var(--b-wing); } .bird .b-wing-far path { fill: var(--b-wing-far); } .bird .b-red { fill: var(--b-red); } .bird .b-yellow { fill: var(--b-yellow); }
.bird .b-edge { fill: none; stroke: var(--b-ink); stroke-width: 2.6; stroke-linecap: round; opacity: .85; }
.bird .b-coverline { fill: none; stroke: var(--b-cover); stroke-width: 2.4; stroke-linecap: round; opacity: .8; }
.bird .b-tail-feather { fill: var(--b-tail); } .bird .b-tail-base { fill: var(--b-wing); } .bird .b-tail-sheen { fill: none; stroke: var(--b-tail-2); stroke-width: 2.2; stroke-linecap: round; }
.bird .b-legs path { fill: none; stroke: var(--b-leg); stroke-width: 3.6; stroke-linecap: round; stroke-linejoin: round; }
.bird .b-shadow { fill: var(--b-shadow); transform-origin: 102px 187px; transition: opacity .2s; }
.bird .b-line { fill: none; stroke: var(--b-ink); stroke-width: 3.6; stroke-linecap: round; opacity: 0; }
/* 晕了（动作 dizzy）：眼睛变成 ×，一会儿就好 */
.bird.b-dizzy :is(.b-eye-open, .b-eye-happy, .b-eye-closed) { opacity: 0 !important; }
.bird.b-dizzy .b-eye-dizzy .b-line { opacity: 1; }

/* 每一块绕着哪儿转（viewBox 里的坐标） */
.bird .b-act, .bird .b-rig, .bird .b-pose { transform-origin: ${FOOT.x}px ${FOOT.y}px; }
.bird[data-air] .b-pose { transform-origin: 98px 124px; } /* 在空中绕身子中间转，不绕爪子 */
.bird .b-headpose, .bird .b-headact { transform-origin: 116px 106px; }
.bird .b-wing, .bird .b-wingact { transform-origin: 101px 102px; }
.bird .b-wing-far { transform-origin: 104px 100px; opacity: 0; }
.bird .b-tail { transform-origin: 74px 128px; }
.bird .b-legs { transform-origin: 102px 156px; transition: transform .14s; }
.bird .b-lid { transform-origin: 133px 63px; transform: scaleY(0); }
.bird .b-lower { transform-origin: 150px 86px; } .bird .b-upperg { transform-origin: 150px 80px; }
.bird .b-pupil { transform-origin: 133px 74px; } .bird .b-eyering { transform-origin: 133px 74px; }

/* ───── 神态（脸） ───── */
/* 待机：呼吸、眨眼、尾巴轻轻摆 */
.bird .b-rig { animation: b-breathe 2.6s ease-in-out infinite; }
.bird .b-lid { animation: b-blink 4.4s infinite; }
.bird .b-tail { animation: b-sway 3.2s ease-in-out infinite; }
@keyframes b-breathe { 0%, 100% { transform: scale(1, 1); } 50% { transform: scale(1.014, 1.03); } }
@keyframes b-blink { 0%, 91%, 100% { transform: scaleY(0); } 94% { transform: scaleY(1); } 97% { transform: scaleY(0); } }
@keyframes b-sway { 0%, 100% { transform: rotate(0); } 50% { transform: rotate(-5deg); } }

/* 说话：嘴一张一合，头轻轻点 */
.bird[data-mood="talk"] .b-lower { animation: b-yap .26s ease-in-out infinite alternate; }
.bird[data-mood="talk"] .b-headpose { animation: b-bob .52s ease-in-out infinite alternate; }
@keyframes b-yap { from { transform: rotate(0); } to { transform: rotate(20deg); } }
@keyframes b-bob { from { transform: rotate(-2deg); } to { transform: rotate(3deg); } }

/* 在想：歪头往上看，身子慢慢晃 */
.bird[data-mood="think"] .b-headpose { transform: rotate(-11deg); transition: transform .35s; }
.bird[data-mood="think"] .b-pupil { transform: translate(1.8px, -3.2px); }
.bird[data-mood="think"] .b-pose { animation: b-ponder 2.8s ease-in-out infinite; }
@keyframes b-ponder { 0%, 100% { transform: rotate(-2deg); } 50% { transform: rotate(2deg); } }

/* 开心：眼睛眯成月牙，一跳一跳，尾巴快摆 */
.bird:is([data-mood="happy"], [data-mood="cheer"]) .b-eye-open { opacity: 0; }
.bird:is([data-mood="happy"], [data-mood="cheer"]) .b-eye-happy { opacity: 1; }
.bird[data-mood="happy"] .b-pose { animation: b-bounce .56s cubic-bezier(.3, .7, .4, 1) infinite; }
.bird[data-mood="happy"] .b-tail { animation: b-wag .28s ease-in-out infinite alternate; }
.bird[data-mood="happy"] .b-blush { opacity: .55; }
@keyframes b-bounce { 0%, 100% { transform: translateY(0) scale(1, 1); } 12% { transform: translateY(0) scale(1.03, .96); } 45% { transform: translateY(-8px) scale(.98, 1.03); } }
@keyframes b-wag { from { transform: rotate(-7deg); } to { transform: rotate(5deg); } }

/* 欢呼：张嘴、拍翅膀、跳得高 */
.bird[data-mood="cheer"] .b-lower { transform: rotate(24deg); }
.bird[data-mood="cheer"] .b-wing { animation: b-flap .3s ease-in-out infinite alternate; }
.bird[data-mood="cheer"] .b-pose { animation: b-jump .72s cubic-bezier(.3, .7, .4, 1) infinite; }
.bird[data-mood="cheer"] .b-blush { opacity: .6; }
@keyframes b-flap { from { transform: rotate(-10deg); } to { transform: rotate(72deg); } }
@keyframes b-jump { 0%, 100% { transform: translateY(0) scale(1, 1); } 14% { transform: translateY(1px) scale(1.05, .93); } 46% { transform: translateY(-18px) scale(.96, 1.05); } 74% { transform: translateY(0) scale(1.04, .96); } }

/* 可惜：低头、眼皮耷拉、眉毛皱起来、尾巴垂下 */
.bird[data-mood="oops"] .b-headpose { transform: rotate(13deg) translateY(3px); transition: transform .35s; }
.bird[data-mood="oops"] .b-lid { animation: none; transform: scaleY(.5); }
.bird[data-mood="oops"] .b-pupil { transform: translate(0, 2.4px); }
.bird[data-mood="oops"] .b-brow { opacity: 1; }
.bird[data-mood="oops"] .b-tail { animation: none; transform: rotate(9deg); }
.bird[data-mood="oops"] .b-pose { transform: scale(1.02, .95); transition: transform .35s; }

/* 吃惊：羽毛炸开、眼睛瞪圆、嘴微张 */
.bird[data-mood="surprised"] .b-pose { transform: translateY(-4px) scale(1.07); transition: transform .18s cubic-bezier(.3, 1.6, .5, 1); }
.bird[data-mood="surprised"] .b-eyering { transform: scale(1.16); }
.bird[data-mood="surprised"] .b-pupil { transform: scale(.7); }
.bird[data-mood="surprised"] .b-lower { transform: rotate(14deg); }
.bird[data-mood="surprised"] .b-wing { transform: rotate(16deg); }
.bird[data-mood="surprised"] .b-lid { animation: none; }

/* 困了：闭眼、头垂下来、呼吸变慢 */
.bird[data-mood="sleepy"] .b-eye-open { opacity: 0; }
.bird[data-mood="sleepy"] .b-eye-closed { opacity: 1; }
.bird[data-mood="sleepy"] .b-headpose { transform: rotate(17deg) translate(-4px, 5px); transition: transform .6s; }
.bird[data-mood="sleepy"] .b-rig { animation-duration: 4.2s; }
.bird[data-mood="sleepy"] .b-tail { animation: none; transform: rotate(6deg); }

/* 在听：歪着头，一动不动地听 */
.bird[data-mood="listen"] .b-headpose { transform: rotate(-15deg); transition: transform .3s; }
.bird[data-mood="listen"] .b-pupil { transform: translate(2.2px, 0); }
.bird[data-mood="listen"] .b-tail { animation: none; }

/* ───── 空中（身子）：写在神态后面，盖住神态里管身子的那几条 ───── */
.bird[data-air] .b-shadow { opacity: 0; }
.bird[data-air] .b-wing-far { opacity: 1; }

/* 扑翅飞：往下扇快、往上收慢；每扇一下身子往上一浮；腿收进肚子；尾巴收拢；身子按飞的方向前倾（--pitch，飞的时候实时算） */
.bird[data-air="fly"] .b-pose { animation: none; transform: rotate(var(--pitch)); }
.bird[data-air="fly"] .b-rig { animation: b-flybob .2s infinite; }
.bird[data-air="fly"] .b-wing { animation: b-beat .2s infinite; }
.bird[data-air="fly"] .b-wing-far { animation: b-beat-far .2s infinite; }
.bird[data-air="fly"] .b-legs { transform: translate(-7px, -10px) scaleY(.28); }
.bird[data-air="fly"] .b-tail { animation: none; transform: rotate(-5deg) scaleY(.82); }
@keyframes b-beat { 0% { transform: rotate(80deg); animation-timing-function: cubic-bezier(.5, 0, .9, .5); } 38% { transform: rotate(-30deg); animation-timing-function: cubic-bezier(.2, .4, .5, 1); } 100% { transform: rotate(80deg); } }
@keyframes b-beat-far { 0% { transform: rotate(64deg); animation-timing-function: cubic-bezier(.5, 0, .9, .5); } 38% { transform: rotate(-22deg); animation-timing-function: cubic-bezier(.2, .4, .5, 1); } 100% { transform: rotate(64deg); } }
@keyframes b-flybob { 0% { transform: translateY(2px); } 40% { transform: translateY(-3.5px); } 100% { transform: translateY(2px); } }

/* 收翅滑：小鸟飞长距离是“扇几下、收翅滑一段”一起一伏的。滑的时候翅膀贴着身子，身子拉长一点 */
.bird[data-air="glide"] .b-pose { animation: none; transform: rotate(var(--pitch)) scale(1.04, .97); }
.bird[data-air="glide"] .b-rig { animation: none; }
.bird[data-air="glide"] .b-wing { animation: none; transform: rotate(4deg); }
.bird[data-air="glide"] .b-wing-far { opacity: 0; }
.bird[data-air="glide"] .b-legs { transform: translate(-7px, -10px) scaleY(.28); }
.bird[data-air="glide"] .b-tail { animation: none; transform: rotate(-3deg) scaleY(.78); }

/* 悬停：身子立起来，翅膀在背上方小幅快扇，腿垂着，尾巴往下张开，整只上下轻轻浮 */
.bird[data-air="hover"] .b-pose { animation: none; transform: rotate(-16deg); transition: transform .25s; }
.bird[data-air="hover"] .b-rig { animation: b-hoverbob .9s ease-in-out infinite; }
.bird[data-air="hover"] .b-wing { animation: b-hum .11s ease-in-out infinite alternate; }
.bird[data-air="hover"] .b-wing-far { animation: b-hum-far .11s ease-in-out infinite alternate; }
.bird[data-air="hover"] .b-legs { transform: translate(2px, -2px) rotate(-8deg) scaleY(.9); }
.bird[data-air="hover"] .b-tail { animation: none; transform: rotate(18deg) scaleY(1.12); }
@keyframes b-hum { from { transform: rotate(92deg); } to { transform: rotate(28deg); } }
@keyframes b-hum-far { from { transform: rotate(76deg); } to { transform: rotate(18deg); } }
@keyframes b-hoverbob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }

/* 刹车落地：身子往后仰，翅膀往前大幅扇着刹车，腿伸到前面，尾巴往下压 */
.bird[data-air="land"] .b-pose { animation: none; transform: rotate(-22deg); transition: transform .16s; }
.bird[data-air="land"] .b-rig { animation: none; }
.bird[data-air="land"] .b-wing { animation: b-brake .13s ease-in-out infinite alternate; }
.bird[data-air="land"] .b-wing-far { animation: b-brake .13s ease-in-out infinite alternate; }
.bird[data-air="land"] .b-legs { transform: translate(8px, 0) rotate(-24deg); }
.bird[data-air="land"] .b-tail { animation: none; transform: rotate(22deg) scaleY(1.15); }
@keyframes b-brake { from { transform: rotate(100deg); } to { transform: rotate(40deg); } }

/* 头顶冒的一句话、飘出来的音符、Zzz */
.b-say { position: absolute; left: 50%; bottom: calc(100% + 6px); translate: calc(-50% + var(--sx, 0px)) 6px; max-width: 260px; width: max-content; padding: 9px 13px; border-radius: 14px;
  background: #1f2229; color: #fff; font: 600 14px/1.45 -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; box-shadow: 0 6px 18px rgba(0,0,0,.18);
  opacity: 0; pointer-events: none; transition: opacity .2s, translate .3s cubic-bezier(.3, 1.4, .5, 1); z-index: 3; }
.b-say::after { content: ""; position: absolute; left: calc(50% - var(--sx, 0px)); bottom: -6px; width: 12px; height: 12px; margin-left: -6px; background: inherit; transform: rotate(45deg); border-radius: 2px; }
.b-say.on { opacity: 1; translate: calc(-50% + var(--sx, 0px)) 0; }
.b-say b { color: #FFD83D; }
.b-note { position: absolute; font: 700 18px/1 "Apple Symbols", "Segoe UI Symbol", serif; pointer-events: none; animation: b-note 1.1s cubic-bezier(.2, .7, .3, 1) forwards; z-index: 2; }
@keyframes b-note { 0% { opacity: 0; transform: translate(0, 0) scale(.6) rotate(-10deg); } 15% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--dx), -46px) scale(1.15) rotate(12deg); } }
.b-zzz { position: absolute; right: 8%; top: 4%; font: 800 15px/1 -apple-system, sans-serif; color: #7d8794; pointer-events: none; opacity: 0; }
.bird[data-mood="sleepy"]:not([data-air]) .b-zzz { animation: b-zzz 2.2s ease-in-out infinite; }
@keyframes b-zzz { 0% { opacity: 0; transform: translate(0, 6px) scale(.7); } 30% { opacity: 1; } 100% { opacity: 0; transform: translate(10px, -22px) scale(1.15); } }
.b-dots { position: absolute; right: 2%; top: 0; display: flex; gap: 3px; opacity: 0; pointer-events: none; }
.b-dots i { width: 6px; height: 6px; border-radius: 50%; background: #8E959F; animation: b-dot 1s ease-in-out infinite; }
.b-dots i:nth-child(2) { animation-delay: .15s; } .b-dots i:nth-child(3) { animation-delay: .3s; }
.bird[data-mood="think"] .b-dots { opacity: 1; }
@keyframes b-dot { 0%, 100% { transform: translateY(0); opacity: .5; } 40% { transform: translateY(-5px); opacity: 1; } }
/* 起飞时脚下扬起的两小团 */
.b-puff { position: absolute; width: 10px; height: 6px; border-radius: 50%; background: rgba(140, 150, 160, .45); pointer-events: none; animation: b-puff .45s ease-out forwards; }
@keyframes b-puff { from { opacity: .9; transform: translate(0, 0) scale(.6); } to { opacity: 0; transform: translate(var(--dx), -4px) scale(1.6); } }

/* 霓虹配色：给小鸟描一圈光 */
:root[data-skin="neon"] .bird svg { filter: drop-shadow(0 0 1.5px rgba(255, 216, 61, .9)) drop-shadow(0 0 10px rgba(255, 138, 36, .45)); }

/* 动效选“克制”或系统开了“减少动效”：不做循环动作，只换神态 */
:root[data-fx="calm"] .bird *, .bird.b-calm * { animation: none !important; }
@media (prefers-reduced-motion: reduce) { .bird * { animation: none !important; } }
`;

function injectCss() {
  const old = document.getElementById('bird-css');
  if (old?.dataset.v === '4') return;
  old?.remove();
  const s = document.createElement('style');
  s.id = 'bird-css';
  s.dataset.v = '4';
  s.textContent = CSS;
  document.head.append(s);
}

function svgMarkup(id) {
  return `
<svg viewBox="0 0 200 200" aria-hidden="true">
  <defs>
    <linearGradient id="${id}-belly" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style="stop-color: var(--b-throat)"/>
      <stop offset=".45" style="stop-color: var(--b-breast)"/>
      <stop offset="1" style="stop-color: var(--b-belly)"/>
    </linearGradient>
    <clipPath id="${id}-body"><ellipse cx="96" cy="124" rx="48" ry="40" transform="rotate(-12 96 124)"/></clipPath>
    <clipPath id="${id}-head"><circle cx="122" cy="80" r="35"/></clipPath>
  </defs>
  <ellipse class="b-shadow" cx="102" cy="187" rx="30" ry="4.5"/>
  <g class="b-act"><g class="b-pose"><g class="b-rig">
    <g class="b-tail">
      <path class="b-tail-feather" d="M74 116 C 53 120, 32 128, 10 135 L 29 145 L 12 163 C 35 157, 56 148, 76 139 Z"/>
      <path class="b-tail-sheen" d="M66 124 C 50 129, 34 135, 20 140"/>
      <path class="b-tail-base" d="M76 116 C 64 119, 55 124, 47 129 C 55 134, 64 137, 77 139 Z"/>
    </g>
    <g class="b-wing-far"><path d="M106 96 C 88 88, 66 92, 48 110 C 42 117, 40 125, 43 129 C 60 132, 84 126, 106 112 C 112 108, 112 99, 106 96 Z"/></g>
    <g class="b-legs">
      <path d="M95 154 L 92 181 M 84 182 L 99 182 M 92 181 L 88 186"/>
      <path d="M110 152 L 110 181 M 103 182 L 118 182 M 110 181 L 106 186"/>
    </g>
    <g class="b-body">
      <ellipse class="b-back" cx="96" cy="124" rx="48" ry="40" transform="rotate(-12 96 124)"/>
      <g clip-path="url(#${id}-body)"><ellipse fill="url(#${id}-belly)" cx="118" cy="138" rx="37" ry="34"/></g>
    </g>
    <g class="b-wingact"><g class="b-wing">
      <path class="b-wingshape" d="M104 97 C 86 91, 62 101, 46 123 C 40 131, 37 140, 41 146 C 57 147, 82 139, 103 121 C 110 114, 110 102, 104 97 Z"/>
      <path class="b-red" d="M61 127 C 73 125, 87 119, 100 110 L 102 117 C 89 126, 74 132, 57 135 Z"/>
      <path class="b-yellow" d="M56 136 C 72 134, 87 127, 101 118 L 102 123 C 89 132, 72 139, 50 142 Z"/>
      <path class="b-edge" d="M42 145 C 58 145, 82 137, 102 122"/>
      <path class="b-coverline" d="M95 101 C 84 104, 72 112, 63 121"/>
    </g></g>
    <g class="b-headact"><g class="b-headpose">
      <circle class="b-headshape" cx="122" cy="80" r="35"/>
      <g clip-path="url(#${id}-head)">
        <ellipse class="b-crown" cx="114" cy="52" rx="30" ry="14"/>
        <ellipse class="b-throat" cx="139" cy="102" rx="25" ry="17"/>
        <ellipse class="b-cheek" cx="114" cy="88" rx="13" ry="11"/>
      </g>
      <ellipse class="b-blush" cx="141" cy="93" rx="6.5" ry="3.6"/>
      <g class="b-eye-open">
        <g class="b-eyering"><circle class="b-ring" cx="133" cy="74" r="10.8"/></g>
        <g class="b-pupil">
          <circle class="b-iris" cx="133" cy="74" r="7.6"/>
          <circle class="b-glint" cx="135.6" cy="71.2" r="2.4"/>
          <circle class="b-glint" cx="130.6" cy="77.6" r="1.1" opacity=".75"/>
        </g>
        <circle class="b-lid" cx="133" cy="74" r="11.4"/>
      </g>
      <path class="b-line b-eye-happy" d="M124 77 Q 133 65.5 142 77"/>
      <path class="b-line b-eye-closed" d="M125 75 Q 133 81.5 141 75"/>
      <g class="b-eye-dizzy"><path class="b-line" d="M127.5 68.5 L 138.5 79.5"/><path class="b-line" d="M138.5 68.5 L 127.5 79.5"/></g>
      <path class="b-line b-brow" d="M125 63.5 L 141 58.5" style="stroke-width: 3"/>
      <g class="b-upperg"><path class="b-upper" d="M148 72.5 C 159 72.5, 170 77, 178 83.5 C 168 86, 158 86.4, 148 85 Z"/></g>
      <g class="b-lower"><path class="b-lowerbill" d="M149 85 C 158 85.8, 167 85.5, 175 84.4 C 167 90, 157 91.6, 149 90.4 Z"/></g>
    </g></g>
  </g></g></g>
</svg>`;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function createBird({ size = 120, mood = 'idle', air = null, calm = false } = {}) {
  injectCss();
  const id = `bird${++uid}`;
  const el = document.createElement('div');
  el.className = 'bird' + (calm ? ' b-calm' : '');
  el.style.width = el.style.height = `${size}px`;
  el.dataset.mood = mood;
  if (air) el.dataset.air = air;
  el.innerHTML = `${svgMarkup(id)}<div class="b-say"></div><span class="b-zzz">z Z</span><span class="b-dots"><i></i><i></i><i></i></span>`;
  const $ = (s) => el.querySelector(s);
  const sayEl = $('.b-say');
  let sayTimer = 0;
  // 气泡靠到屏幕（或小鸟所在的框）边上时往里挪，小尖角还指着小鸟
  const fitSay = () => {
    // 用小鸟的位置和气泡本身的宽度算（不读气泡的位置：它正在过渡，读到的是旧值）
    const w = sayEl.offsetWidth;
    if (!w) return;
    const b = el.getBoundingClientRect();
    const r = { left: b.left + b.width / 2 - w / 2, right: b.left + b.width / 2 + w / 2 };
    let lo = 8;
    let hi = innerWidth - 8;
    const box = el.offsetParent?.getBoundingClientRect();
    if (box && box.width > w + 16) { lo = Math.max(lo, box.left + 8); hi = Math.min(hi, box.right - 8); }
    let dx = r.left < lo ? lo - r.left : r.right > hi ? hi - r.right : 0;
    const room = w / 2 - 16;
    dx = Math.max(-room, Math.min(room, dx));
    sayEl.style.setProperty('--sx', `${Math.round(dx)}px`);
  };
  let trip = 0; // 第几次飞行；新的一次开始，旧的那次就不再动它

  const calmNow = () => el.classList.contains('b-calm') || document.documentElement.dataset.fx === 'calm' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const anim = (sel, frames, opts) => {
    const node = $(sel);
    if (!node || !node.animate || calmNow()) return null;
    return node.animate(frames, { duration: 500, easing: 'cubic-bezier(.3,.7,.4,1)', ...opts });
  };
  const setAir = (a) => {
    if (a) el.dataset.air = a;
    else delete el.dataset.air;
  };

  /** 嘴张一下（配合叫声里的每个音） */
  function beak(dur = 110) {
    $('.b-lower').animate?.([{ transform: 'rotate(0)' }, { transform: 'rotate(24deg)', offset: 0.35 }, { transform: 'rotate(0)' }], { duration: dur, composite: 'add' });
    $('.b-upperg').animate?.([{ transform: 'rotate(0)' }, { transform: 'rotate(-5deg)', offset: 0.35 }, { transform: 'rotate(0)' }], { duration: dur, composite: 'add' });
  }

  /** 从嘴边飘出一个音符 */
  function note(i = 0) {
    if (calmNow()) return;
    const n = document.createElement('span');
    n.className = 'b-note';
    n.textContent = ['♪', '♫', '♩', '♬'][i % 4];
    const left = el.classList.contains('b-left');
    n.style.left = `${((left ? 200 - BEAK.x : BEAK.x) / 200) * 100}%`;
    n.style.top = `${(BEAK.y / 200) * 100 - 16}%`;
    n.style.color = ['#FF8A24', '#EC3A2A', '#FFC61F', '#78A52C'][i % 4];
    n.style.setProperty('--dx', `${(left ? -1 : 1) * (10 + Math.random() * 22)}px`);
    el.append(n);
    setTimeout(() => n.remove(), 1150);
  }

  /** 起飞时脚下扬起两小团 */
  function puff() {
    if (calmNow()) return;
    for (const dx of [-14, 14]) {
      const p = document.createElement('span');
      p.className = 'b-puff';
      p.style.left = `${(FOOT.x / 200) * 100}%`;
      p.style.top = `${(FOOT.y / 200) * 100}%`;
      p.style.marginLeft = '-5px';
      p.style.setProperty('--dx', `${dx}px`);
      el.append(p);
      setTimeout(() => p.remove(), 500);
    }
  }

  // 把爪子放到容器里的 (x, y)
  const footOffset = () => {
    const s = el.offsetWidth;
    return [(FOOT.x / 200) * s, (FOOT.y / 200) * s];
  };
  const footAt = () => {
    const [fx, fy] = footOffset();
    return [el.offsetLeft + fx, el.offsetTop + fy];
  };
  const place = (x, y) => {
    const [fx, fy] = footOffset();
    el.style.left = `${x - fx}px`;
    el.style.top = `${y - fy}px`;
  };

  /**
   * 飞一段：从现在的位置飞到 (x, y)。end = 'land' 落地，'hover' 停在空中。
   *   起飞：在地上时先蹲一下、蹬腿，脚下扬起两小团。
   *   途中：沿一条往上拱的弧线，身子按方向前倾（往下冲时低头、往上爬时抬头）；
   *         距离长的话“扇几下、收翅滑一段”，一起一伏，像真的小鸟。
   *   到达：落地前身子后仰、翅膀往前扇着刹车、腿伸出去，着地压一下再站稳；悬停就慢慢收住、立起来扇。
   */
  async function travel(x, y, end, { duration } = {}) {
    const me = ++trip;
    const [x0, y0] = footAt();
    const dist = Math.hypot(x - x0, y - y0);
    if (dist < 2) {
      place(x, y);
      setAir(end === 'hover' ? 'hover' : null);
      return;
    }
    api.face(x < x0 ? 'left' : 'right');
    if (calmNow()) {
      // 克制档：不飞，直接过去
      place(x, y);
      setAir(end === 'hover' ? 'hover' : null);
      return;
    }
    // 起飞
    if (!el.dataset.air) {
      anim('.b-act', [{ transform: 'translateY(0) scale(1,1)' }, { transform: 'translateY(2px) scale(1.08,.86)', offset: 0.6 }, { transform: 'translateY(-6px) scale(.95,1.06)' }], { duration: 170, easing: 'ease-in' });
      await wait(120);
      if (me !== trip) return;
      puff();
    }
    setAir('fly');
    const T = duration || clamp(360 + dist * 1.5, 480, 1400);
    const cx = (x0 + x) / 2;
    const cy = Math.min(y0, y) - clamp(dist * 0.32, 30, 140);
    const bounding = dist > 220; // 长距离：扇几下、滑一段
    const CYCLE = 560; // 一起一伏多少毫秒
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
    const pointAt = (e) => [(1 - e) ** 2 * x0 + 2 * (1 - e) * e * cx + e * e * x, (1 - e) ** 2 * y0 + 2 * (1 - e) * e * cy + e * e * y];
    const t0 = performance.now();
    await new Promise((resolve) => {
      const step = (now) => {
        if (me !== trip) return resolve();
        const t = Math.min(1, (now - t0) / T);
        const e = ease(t);
        let [px, py] = pointAt(e);
        // 前倾：看这一小段往哪个方向走
        const [qx, qy] = pointAt(Math.min(1, e + 0.02));
        const ang = Math.atan2(qy - py, Math.abs(qx - px) + 0.001) * (180 / Math.PI);
        let air = 'fly';
        let pitch = clamp(ang * 0.55 - 6, -26, 22);
        if (bounding && t > 0.08 && t < 0.8) {
          const ph = ((now - t0) % CYCLE) / CYCLE;
          air = ph < 0.66 ? 'fly' : 'glide';
          // 扇的时候往上浮，滑的时候往下沉一点
          py += ph < 0.66 ? -5 * Math.sin((ph / 0.66) * Math.PI) : 4 * Math.sin(((ph - 0.66) / 0.34) * Math.PI);
        }
        if (end === 'land' && t > 0.8) {
          air = 'land';
          pitch = 0;
        }
        if (end === 'hover' && t > 0.86) {
          air = 'hover';
          pitch = 0;
        }
        el.style.setProperty('--pitch', `${pitch.toFixed(1)}deg`);
        setAir(air);
        place(px, py);
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
    if (me !== trip) return;
    if (end === 'hover') {
      setAir('hover');
      return;
    }
    // 着地：压一下，翅膀收好，站稳
    setAir(null);
    anim('.b-act', [{ transform: 'translateY(0) scale(1,1)' }, { transform: 'translateY(1px) scale(1.1,.86)', offset: 0.3 }, { transform: 'translateY(-2px) scale(.97,1.04)', offset: 0.65 }, { transform: 'translateY(0) scale(1,1)' }], { duration: 320 });
    anim('.b-wingact', [{ transform: 'rotate(40deg)' }, { transform: 'rotate(0)' }], { duration: 220, easing: 'ease-out' });
  }

  const api = {
    el,
    get mood() {
      return el.dataset.mood;
    },
    /** 在空中的话是 fly / glide / hover / land，在地上是 null */
    get air() {
      return el.dataset.air || null;
    },
    /** 换神态（一直保持）；在空中也能换，只管脸 */
    setMood(m) {
      el.dataset.mood = m;
    },
    /** 直接摆一个空中姿态（样稿截图用）；null = 回到地上 */
    setAir,
    /** 做一个动作（做完就停） */
    act(name) {
      switch (name) {
        case 'hop':
          return anim('.b-act', [{ transform: 'translateY(0) scale(1,1)' }, { transform: 'translateY(1px) scale(1.06,.92)', offset: 0.15 }, { transform: 'translateY(-22px) scale(.96,1.05)', offset: 0.5 }, { transform: 'translateY(0) scale(1.05,.95)', offset: 0.85 }, { transform: 'translateY(0) scale(1,1)' }], { duration: 560 });
        case 'nod':
          // 点头（“对”）：头往下沉、嘴朝下，整只鸟跟着往下一鞠，上下两次，眼睛眯一下
          anim('.b-act', [{ transform: 'translateY(0) rotate(0)' }, { transform: 'translateY(4px) rotate(6deg) scale(1.02,.97)' }, { transform: 'translateY(0) rotate(0)' }, { transform: 'translateY(4px) rotate(6deg) scale(1.02,.97)' }, { transform: 'translateY(0) rotate(0)' }], { duration: 820, easing: 'ease-in-out' });
          anim('.b-lid', [{ transform: 'scaleY(0)' }, { transform: 'scaleY(.55)', offset: 0.25 }, { transform: 'scaleY(0)', offset: 0.5 }, { transform: 'scaleY(.55)', offset: 0.75 }, { transform: 'scaleY(0)' }], { duration: 820 });
          return anim('.b-headact', [{ transform: 'translate(0,0) rotate(0)' }, { transform: 'translate(-5px,13px) rotate(38deg)', offset: 0.25 }, { transform: 'translate(0,-3px) rotate(-6deg)', offset: 0.5 }, { transform: 'translate(-5px,13px) rotate(38deg)', offset: 0.75 }, { transform: 'translate(0,0) rotate(0)' }], { duration: 820, easing: 'ease-in-out' });
        case 'shake':
          // 摇头（“不对”）：头横着压扁再展开，像转过来朝着你又转回去，嘴跟着变短；头左右小幅晃，眼睛眯起来，尾巴左右甩。
          // （2026-11-13 试过“绕头的中心在屏幕平面里来回转”的版本，用户觉得还是这一版好）
          anim('.b-lid', [{ transform: 'scaleY(.5)' }, { transform: 'scaleY(.5)' }], { duration: 700 });
          anim('.b-tail', [{ transform: 'rotate(0)' }, { transform: 'rotate(-9deg)' }, { transform: 'rotate(7deg)' }, { transform: 'rotate(-9deg)' }, { transform: 'rotate(7deg)' }, { transform: 'rotate(0)' }], { duration: 700, easing: 'ease-in-out' });
          return anim('.b-headact', [{ transform: 'translateX(0) scaleX(1)' }, { transform: 'translateX(-5px) scaleX(.62)', offset: 0.16 }, { transform: 'translateX(3px) scaleX(1)', offset: 0.33 }, { transform: 'translateX(-5px) scaleX(.62)', offset: 0.5 }, { transform: 'translateX(3px) scaleX(1)', offset: 0.67 }, { transform: 'translateX(-3px) scaleX(.78)', offset: 0.84 }, { transform: 'translateX(0) scaleX(1)' }], { duration: 700, easing: 'ease-in-out' });
        case 'peck':
          // 啄（“就是这个键”）：整个头往前猛地一伸、嘴张开，快、两下；和点头的区别是往前，不是往下
          anim('.b-lower', [{ transform: 'rotate(0)' }, { transform: 'rotate(16deg)', offset: 0.2 }, { transform: 'rotate(0)', offset: 0.45 }, { transform: 'rotate(16deg)', offset: 0.65 }, { transform: 'rotate(0)' }], { duration: 520, composite: 'add' });
          anim('.b-pose', [{ transform: 'rotate(0)' }, { transform: 'rotate(5deg)', offset: 0.2 }, { transform: 'rotate(0)', offset: 0.45 }, { transform: 'rotate(5deg)', offset: 0.65 }, { transform: 'rotate(0)' }], { duration: 520, composite: 'add' });
          return anim('.b-headact', [{ transform: 'translate(0,0) rotate(0)' }, { transform: 'translate(18px,6px) rotate(9deg)', offset: 0.2 }, { transform: 'translate(0,0) rotate(0)', offset: 0.45 }, { transform: 'translate(18px,6px) rotate(9deg)', offset: 0.65 }, { transform: 'translate(0,0) rotate(0)' }], { duration: 520, easing: 'cubic-bezier(.2,.8,.3,1)' });
        case 'flap':
          return anim('.b-wingact', [{ transform: 'rotate(0)' }, { transform: 'rotate(72deg)' }, { transform: 'rotate(-6deg)' }, { transform: 'rotate(72deg)' }, { transform: 'rotate(-6deg)' }, { transform: 'rotate(60deg)' }, { transform: 'rotate(0)' }], { duration: 760, easing: 'ease-in-out' });
        case 'flip':
          anim('.b-wingact', [{ transform: 'rotate(0)' }, { transform: 'rotate(70deg)' }, { transform: 'rotate(0)' }], { duration: 760 });
          return anim('.b-act', [{ transform: 'translateY(0) rotate(0)' }, { transform: 'translateY(4px) scale(1.05,.92)', offset: 0.12 }, { transform: 'translateY(-46px) rotate(-180deg)', offset: 0.5 }, { transform: 'translateY(-10px) rotate(-340deg)', offset: 0.82 }, { transform: 'translateY(0) rotate(-360deg)' }], { duration: 820, easing: 'cubic-bezier(.3,.6,.4,1)' });
        case 'preen':
          anim('.b-wingact', [{ transform: 'rotate(0)' }, { transform: 'rotate(14deg)', offset: 0.3 }, { transform: 'rotate(14deg)', offset: 0.75 }, { transform: 'rotate(0)' }], { duration: 1200 });
          return anim('.b-headact', [{ transform: 'translate(0,0) rotate(0)' }, { transform: 'translate(-18px,12px) rotate(-38deg)', offset: 0.3 }, { transform: 'translate(-16px,14px) rotate(-30deg)', offset: 0.45 }, { transform: 'translate(-18px,12px) rotate(-38deg)', offset: 0.6 }, { transform: 'translate(-16px,14px) rotate(-30deg)', offset: 0.75 }, { transform: 'translate(0,0) rotate(0)' }], { duration: 1200, easing: 'ease-in-out' });
        case 'dizzy':
          // 晕了：原地转两圈（左右翻面），头画着圈晃，眼睛变成 ×，过一会儿缓过来
          el.classList.add('b-dizzy');
          setTimeout(() => el.classList.remove('b-dizzy'), 2000);
          anim('.b-headact', [{ transform: 'translate(0,0) rotate(0)' }, { transform: 'translate(-4px,3px) rotate(-12deg)', offset: 0.2 }, { transform: 'translate(3px,5px) rotate(10deg)', offset: 0.4 }, { transform: 'translate(-3px,2px) rotate(-9deg)', offset: 0.6 }, { transform: 'translate(2px,3px) rotate(7deg)', offset: 0.8 }, { transform: 'translate(0,0) rotate(0)' }], { duration: 1800, easing: 'ease-in-out' });
          anim('.b-tail', [{ transform: 'rotate(0)' }, { transform: 'rotate(18deg)', offset: 0.3 }, { transform: 'rotate(10deg)', offset: 0.8 }, { transform: 'rotate(0)' }], { duration: 1800 });
          return anim('.b-act', [{ transform: 'scaleX(1) rotate(0)' }, { transform: 'scaleX(-1) rotate(-6deg)', offset: 0.18 }, { transform: 'scaleX(1) rotate(6deg)', offset: 0.36 }, { transform: 'scaleX(-1) rotate(-5deg)', offset: 0.5 }, { transform: 'scaleX(1) rotate(8deg)', offset: 0.64 }, { transform: 'scaleX(1) rotate(-6deg)', offset: 0.8 }, { transform: 'scaleX(1) rotate(0)' }], { duration: 1600, easing: 'ease-in-out' });
        case 'sing':
          return api.sing('song');
        default:
          return null;
      }
    },
    /** 叫一声：声音、嘴、音符一起 */
    sing(call = 'ok', opts) {
      const onsets = voice.play(call, opts) || [];
      onsets.forEach(([ms, dur], i) => setTimeout(() => {
        beak(Math.max(90, Math.min(240, dur * 1000 * 1.2)));
        if (call === 'song' || call === 'ok' || call === 'greet' || (call === 'tune' && i % 2 === 0)) note(i);
      }, ms));
      // 吹口哨哼曲子：头跟着慢慢晃，一直晃到吹完
      const last = onsets[onsets.length - 1];
      if (call === 'tune' && last) anim('.b-headact', [{ transform: 'rotate(0)' }, { transform: 'rotate(-7deg)', offset: 0.25 }, { transform: 'rotate(5deg)', offset: 0.5 }, { transform: 'rotate(-6deg)', offset: 0.75 }, { transform: 'rotate(0)' }], { duration: last[0] + last[1] * 1000, easing: 'ease-in-out' });
      if (call === 'song') anim('.b-headact', [{ transform: 'rotate(0)' }, { transform: 'rotate(-8deg)', offset: 0.3 }, { transform: 'rotate(4deg)', offset: 0.7 }, { transform: 'rotate(0)' }], { duration: 1400 });
      return onsets;
    },
    /** 头顶冒一句话；ms = 0 表示一直留着，直到下一句或 say('') */
    say(html, ms = 2800) {
      clearTimeout(sayTimer);
      if (!html) {
        sayEl.classList.remove('on');
        return;
      }
      sayEl.innerHTML = html;
      sayEl.classList.add('on');
      fitSay();
      if (ms) sayTimer = setTimeout(() => sayEl.classList.remove('on'), ms);
    },
    /** 朝左还是朝右 */
    face(dir) {
      el.classList.toggle('b-left', dir === 'left');
    },
    /** 飞过去落在 (x, y)（爪子的位置，容器坐标；容器要 position: relative，小鸟 position: absolute） */
    flyTo(x, y, opts) {
      return travel(x, y, 'land', opts);
    },
    /** 飞过去停在空中 (x, y)，一直悬停 */
    hoverAt(x, y, opts) {
      return travel(x, y, 'hover', opts);
    },
    /** 直接放到 (x, y)（爪子的位置），不飞 */
    placeAt(x, y) {
      trip++;
      place(x, y);
    },
  };
  return api;
}
