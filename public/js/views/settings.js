// 设置。上面是日常会动的：界面（配色、动效、界面音效）和练习的两个开关。
// 不常动的收在下面两个折叠里，默认不展开：教练背后的两个引擎（一个都没配好的时候会自己展开）、清空学习进度。地址带 ?unfold 时都展开（截图用）。
import { h, clear } from '../util.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { ctx } from '../context.js';
import { coach } from '../coach.js';
import { chirp } from '../jiu.js';
import { toast, segmented } from '../ui.js';
import { theme } from '../theme.js';
import { sfx } from '../sfx.js';

const DEEP_REASON = {
  'not-found': '这台电脑上没有找到 codex 命令。',
  'not-logged-in': 'Codex 装了但还没登录：在终端里运行一次 codex 并登录。',
  disabled: '已在下面关闭。',
  timeout: '检查 Codex 时超时了。',
};

export async function settingsView(view) {
  ctx.set('设置页');
  let cfg;
  try {
    cfg = await api.get('/api/settings');
  } catch (e) {
    view.append(h('div', { class: 'page-head' }, h('h1', {}, '设置')), h('div', { class: 'card' }, h('p', {}, `读取设置失败：${e.message}`)));
    return null;
  }
  let status = (await api.get('/api/status').catch(() => null))?.ai || null;

  // ── 快速引擎 ──
  const preset = h('select', { class: 'input' }, Object.entries(cfg.presets).map(([k, p]) => h('option', { value: k, selected: k === cfg.fast.preset }, p.label)));
  const baseUrl = h('input', { class: 'input', value: cfg.fast.baseUrl, placeholder: 'https://…/v1', spellcheck: 'false' });
  const model = h('input', { class: 'input', value: cfg.fast.model, placeholder: '模型名', list: 'model-list', spellcheck: 'false' });
  const modelList = h('datalist', { id: 'model-list' });
  const apiKey = h('input', { class: 'input', type: 'password', autocomplete: 'off', placeholder: cfg.fast.keyMasked ? `已保存 ${cfg.fast.keyMasked}，留空表示不修改` : '粘贴你的 API key' });
  const fastTag = h('span', {});
  const deepTag = h('span', {});
  const fastOut = h('div', { class: 'small muted' });
  const deepOut = h('div', { class: 'small muted' });
  const deepNote = h('div', { class: 'small muted' });

  preset.addEventListener('change', () => {
    const p = cfg.presets[preset.value];
    if (p.baseUrl) baseUrl.value = p.baseUrl;
    if (p.model) model.value = p.model;
  });

  // 折叠着的时候也看得到两个引擎好不好用
  const fastMini = h('span', {});
  const deepMini = h('span', {});
  function renderTags() {
    fastTag.className = `tag ${status?.fast.ready ? 'ok' : 'warn'}`;
    fastTag.textContent = status?.fast.ready ? `就绪 · ${status.fast.model}` : '未配置';
    deepTag.className = `tag ${status?.deep.ready ? 'ok' : 'warn'}`;
    deepTag.textContent = status?.deep.ready ? `就绪 · ${status.deep.version}` : '不可用';
    fastMini.className = fastTag.className;
    fastMini.textContent = `即时 ${status?.fast.ready ? '就绪' : '未配置'}`;
    deepMini.className = deepTag.className;
    deepMini.textContent = `深度 ${status?.deep.ready ? '就绪' : '不可用'}`;
    clear(deepOut);
    if (status && !status.deep.ready) deepOut.textContent = DEEP_REASON[status.deep.reason] || '';
    const d = status?.deep;
    deepNote.textContent = !d?.ready ? ''
      : d.modelSource === 'auto' && d.configuredModel
        ? `当前使用模型 ${d.model}。你 Codex 里默认的 ${d.configuredModel} 要求比本机更新的 Codex 版本，所以应用自动换成了账号可用的模型；更新 Codex 之后会自动跟回默认模型。`
        : `当前使用模型 ${d.model || 'Codex 默认'}。`;
  }

  async function saveFast() {
    const body = { fast: { preset: preset.value, baseUrl: baseUrl.value, model: model.value } };
    if (apiKey.value.trim()) body.fast.apiKey = apiKey.value.trim();
    const res = await api.put('/api/settings', body);
    cfg = res;
    status = res.ai;
    apiKey.value = '';
    apiKey.placeholder = res.fast.keyMasked ? `已保存 ${res.fast.keyMasked}，留空表示不修改` : '粘贴你的 API key';
    renderTags();
    coach.refreshStatus();
  }

  const busy = async (btn, fn) => {
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = '请稍等…';
    try {
      await fn();
    } catch (e) {
      toast(e.message, 'bad', 6000);
    }
    btn.disabled = false;
    btn.textContent = label;
  };

  const fastCard = h('div', { class: 'card' },
    h('div', { class: 'row', style: { marginBottom: '6px' } }, h('h3', {}, '即时引擎'), fastTag),
    h('p', { class: 'muted small', style: { marginBottom: '16px' } }, '啾啾所有的回答都用它：问答、点评、排计划、小纸条、出题（1–2 秒开始出字）。接 DeepSeek、Kimi 或任何兼容 OpenAI 接口的服务。'),
    h('div', { class: 'form' },
      h('div', { class: 'field' }, h('label', {}, '服务商'), preset),
      h('div', { class: 'field' }, h('label', {}, '接口地址'), baseUrl),
      h('div', { class: 'field' }, h('label', {}, '模型'), model, modelList, h('span', { class: 'help' }, '模型名各家经常更新。填好 key 并保存后，点“获取模型列表”可以从服务商那里拉到当前可用的名字。')),
      h('div', { class: 'field' }, h('label', {}, 'API key'), apiKey, h('span', { class: 'help' },
        cfg.fast.keySource.startsWith('file:') ? `当前使用的是 ${cfg.envFile} 里的 ${cfg.fast.keySource.slice(5)}。在这里另填一个会优先用这里的。`
          : cfg.fast.keySource.startsWith('env:') ? `当前使用的是环境变量 ${cfg.fast.keySource.slice(4)} 里的 key。`
            : 'key 只保存在这台电脑的 config.local.json 里，不会上传到别处。')),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', type: 'button', onclick: (e) => busy(e.currentTarget, async () => { await saveFast(); toast('已保存', 'ok'); }) }, '保存'),
        h('button', { class: 'btn', type: 'button', onclick: (e) => busy(e.currentTarget, async () => {
          await saveFast();
          const r = await api.post('/api/settings/test', { engine: 'fast' });
          fastOut.textContent = `回复（${(r.ms / 1000).toFixed(1)} 秒）：${r.reply}`;
        }) }, '保存并测试'),
        h('button', { class: 'btn', type: 'button', onclick: (e) => busy(e.currentTarget, async () => {
          await saveFast();
          const { models } = await api.get('/api/settings/models');
          modelList.replaceChildren(...models.map((m) => h('option', { value: m })));
          fastOut.textContent = `可用模型（${models.length} 个）：${models.slice(0, 30).join('、')}${models.length > 30 ? ' …' : ''}`;
        }) }, '获取模型列表'),
      ),
      fastOut,
    ),
  );

  // ── 深度引擎 ──
  const deepState = { enabled: cfg.deep.enabled, effort: cfg.deep.effort };
  const deepModel = h('input', { class: 'input', value: cfg.deep.model || '', placeholder: '留空 = 自动选择', spellcheck: 'false' });
  const saveDeep = async () => {
    const res = await api.put('/api/settings', { deep: { enabled: deepState.enabled, effort: deepState.effort, model: deepModel.value } });
    cfg = res;
    status = res.ai;
    renderTags();
    coach.refreshStatus();
  };
  const deepCard = h('div', { class: 'card' },
    h('div', { class: 'row', style: { marginBottom: '6px' } }, h('h3', {}, '深度引擎 · Codex（GPT）'), deepTag),
    h('p', { class: 'muted small', style: { marginBottom: '16px' } }, '备用：即时引擎没配好或连不上时由它回答。复用这台电脑上已经登录的 Codex，不需要另外的 key；每次回答要等十几秒到二十几秒。'),
    h('div', { class: 'form' },
      h('div', { class: 'row' }, segmented([{ value: true, label: '启用' }, { value: false, label: '关闭' }], deepState.enabled, (v) => (deepState.enabled = v)),
        segmented([{ value: 'low', label: '快' }, { value: 'medium', label: '均衡' }, { value: 'high', label: '想得深' }], ['low', 'medium', 'high'].includes(deepState.effort) ? deepState.effort : 'low', (v) => (deepState.effort = v), '思考力度')),
      h('div', { class: 'field' }, h('label', {}, '模型（可选）'), deepModel, deepNote),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', type: 'button', onclick: (e) => busy(e.currentTarget, async () => { await saveDeep(); toast('已保存', 'ok'); }) }, '保存'),
        h('button', { class: 'btn', type: 'button', onclick: (e) => busy(e.currentTarget, async () => {
          await saveDeep();
          deepOut.textContent = '正在问 Codex，通常要十几秒…';
          const r = await api.post('/api/settings/test', { engine: 'deep' });
          deepOut.textContent = `回复（${(r.ms / 1000).toFixed(1)} 秒）：${r.reply}`;
        }) }, '保存并测试'),
      ),
      deepOut,
    ),
  );

  // ── 练习偏好 ──
  let confirmReset = false;
  const resetBtn = h('button', { class: 'btn danger', type: 'button' }, '清空学习进度');
  resetBtn.addEventListener('click', async () => {
    if (!confirmReset) {
      confirmReset = true;
      resetBtn.textContent = '确定清空？再点一次（不可恢复）';
      setTimeout(() => { confirmReset = false; resetBtn.textContent = '清空学习进度'; }, 4000);
      return;
    }
    store.resetProgress(); // 课程、成绩、经验和徽章都清掉，设置留着
    toast('进度已清空', 'ok');
    confirmReset = false;
    resetBtn.textContent = '清空学习进度';
  });
  const prefs = h('div', { class: 'card' },
    h('h3', { style: { marginBottom: '14px' } }, '练习'),
    h('div', { class: 'form', style: { maxWidth: 'none' } },
      h('div', { class: 'pref wide' }, segmented([{ value: true, label: '开' }, { value: false, label: '关' }], !!store.settings.speak, (v) => store.update((d) => (d.settings.speak = v)), '把啾啾的回答读出来'), h('span', { class: 'small muted' }, '手在机器上、不方便看屏幕时有用（用浏览器自带的语音）。')),
      h('div', { class: 'pref wide' }, segmented([{ value: true, label: '开' }, { value: false, label: '关' }], !!store.settings.unlockAll, (v) => store.update((d) => (d.settings.unlockAll = v)), '全部课程解锁'), h('span', { class: 'small muted' }, '默认要按顺序上；想跳着看就打开。')),
    ),
  );

  // ── 界面：配色、动效、界面音效 ──
  const onOff = [{ value: true, label: '开' }, { value: false, label: '关' }];
  const skinSlot = h('div');
  const motionNote = h('span', { class: 'small muted' });
  const renderLook = () => {
    // 左边的导航栏上也能切配色：切了之后这里要跟着变
    skinSlot.replaceChildren(segmented([{ value: 'body', label: '机身' }, { value: 'neon', label: '霓虹' }], store.settings.skin, (v) => {
      theme.clearOverride('skin');
      store.update((d) => (d.settings.skin = v));
    }, '配色'));
    motionNote.textContent = `丰富：界面跟着节拍动，过关有彩带。克制：去掉一直在动的东西和彩带，只留状态变化。${theme.systemReduced ? '你的系统开着“减少动效”，所以现在不管选哪个都按克制处理。' : ''}`;
  };
  renderLook();
  const offTheme = theme.on('change', renderLook);
  const look = h('div', { class: 'card' },
    h('h3', { style: { marginBottom: '14px' } }, '界面'),
    h('div', { class: 'form', style: { maxWidth: 'none' } },
      h('div', { class: 'pref' }, skinSlot, h('span', { class: 'small muted' }, '机身：浅色，和你手里那台机器一个颜色。霓虹：深色、会发光，像夜里的舞台。左边导航栏上那颗半浅半深的圆也能切。')),
      h('div', { class: 'pref' }, segmented([{ value: 'rich', label: '丰富' }, { value: 'calm', label: '克制' }], store.settings.motion, (v) => {
        theme.clearOverride('fx');
        store.update((d) => (d.settings.motion = v));
      }, '动效'), motionNote),
      h('div', { class: 'pref' }, segmented(onOff, store.settings.uiSound !== false, (v) => {
        store.update((d) => (d.settings.uiSound = v));
        if (v) {
          sfx.play('ok');
          setTimeout(() => chirp('greet'), 250);
        }
      }, '界面音效'), h('span', { class: 'small muted' }, '按键的轻响、啾啾的叫声，拿到徽章、升级时的提示音。比机器和音游的声音小得多；音游打着的时候不响。')),
    ),
  );

  renderTags();
  const unfold = new URLSearchParams(location.search).has('unfold');
  // 不常动的两样，默认收着。两个引擎一个都没配好的时候，那一块自己展开（得先去配）
  const engineFold = h('details', { class: 'fold', open: unfold || !(status?.fast.ready || status?.deep.ready) },
    h('summary', {}, h('span', {}, '啾啾背后的两个引擎'), fastMini, deepMini, h('small', {}, '换服务商、换模型、填 key 的时候再来')),
    h('div', { class: 'fold-body' },
      h('p', { class: 'muted small', style: { margin: '0' } }, '现在啾啾的问答、点评、排计划、写小纸条、按弱点出题都走即时引擎，几秒钟就有回答。深度引擎留着备用：即时引擎没配好或连不上时自动由它顶上，那时要等十几秒。只配其中一个也能用。向 AI 提问时，应用会附上你当前所在的课程步骤和最近一局的练习数据。'),
      fastCard,
      deepCard));
  const resetFold = h('details', { class: 'fold', open: unfold },
    h('summary', {}, h('span', {}, '清空学习进度'), h('small', {}, '想从头再来的时候用；清了找不回来')),
    h('div', { class: 'fold-body' },
      h('p', { class: 'muted small', style: { margin: '0' } }, '课程、音游成绩、小课堂、经验值和徽章都会清掉，上面这些设置留着。'),
      h('div', {}, resetBtn)));
  // 关于啾啾：它是谁、纸条本、样子参考的贴纸（CC BY 4.0，要署名）
  const nNotes = Array.isArray(store.data.notes) ? store.data.notes.length : 0;
  const aboutFold = h('details', { class: 'fold', open: unfold },
    h('summary', {}, h('span', {}, '关于啾啾'), h('small', {}, `陪你练的那只红嘴相思鸟${nNotes ? ` · 纸条本里 ${nNotes} 张` : ''}`)),
    h('div', { class: 'fold-body' },
      h('p', { class: 'muted small', style: { margin: '0' } }, '啾啾是一只红嘴相思鸟：个子小、颜色鲜、叫声好听。点它（或者左下角它的窝）就能和它说话；它认真想过的回答会写成小纸条，你收下的都在纸条本里。'),
      h('div', {}, h('button', { class: 'btn sm', type: 'button', onclick: () => coach.notebook() }, '翻翻纸条本')),
      h('p', { class: 'muted small', style: { margin: '0' } }, '啾啾的样子参考了 ',
        h('a', { href: 'https://github.com/alchaincyf/huashu-bird-sticker', target: '_blank', rel: 'noopener' }, 'huashu-bird-sticker'),
        '（花叔）里的红嘴相思鸟贴纸，按 ',
        h('a', { href: 'https://creativecommons.org/licenses/by/4.0/deed.zh-hans', target: '_blank', rel: 'noopener' }, 'CC BY 4.0'),
        ' 使用；矢量画法和动作是这个应用自己画的，叫声是用 Web Audio 合成的。')));
  view.append(
    h('div', { class: 'page-head' }, h('h1', {}, '设置'), h('p', {}, '上面两块是日常会动的：界面长什么样、动不动、响不响，和练习的两个开关。不常动的收在下面，点一下展开。')),
    h('div', { class: 'settings' }, look, prefs, engineFold, aboutFold, resetFold),
  );
  return { destroy: offTheme };
}
