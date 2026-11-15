// 装成应用（用户 2026-11-15：“做成可安装的应用”）。清单是 /manifest.webmanifest，后台小脚本是 /sw.js，图标在 /icons/（tools/make-icons.sh 画）。
// 装好以后：有自己的窗口、Dock 和启动台里有图标；Chrome 允许装好的应用一打开就出声（开屏的背景律动不用先点一下）。
// Chrome 觉得能装的时候会发一个 beforeinstallprompt：先收着，设置页的“安装成应用”按钮点了再弹出安装框；地址栏右边的安装图标照样在。
let deferred = null;
const listeners = new Set();

addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e;
  listeners.forEach((f) => f());
});
addEventListener('appinstalled', () => {
  deferred = null;
  listeners.forEach((f) => f());
});

/** 现在是不是在装好的应用窗口里 */
export const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
/** Chrome 说现在能装 */
export const canInstall = () => !!deferred;
/** 能不能装变了（设置页用来刷新那一行）；返回“不听了”的函数 */
export function onInstallChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
/** 弹出 Chrome 的安装框；装了返回 true */
export async function install() {
  if (!deferred) return false;
  deferred.prompt();
  const r = await deferred.userChoice;
  deferred = null;
  listeners.forEach((f) => f());
  return r.outcome === 'accepted';
}

/** 注册后台小脚本（main.js 一开始调） */
export function registerApp() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => {
    /* 注册不上也不影响用：只是装不成应用 */
  });
}
