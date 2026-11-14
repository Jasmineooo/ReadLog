import { loadSettings, saveSettings, buildBackup, restoreBackup, clearAllData } from '../store.js';
import { esc, icon, toast, openModal, confirmDialog, debounce } from '../ui.js';
import { PRESETS, testConnection } from '../ai.js';

function renderForm(s) {
  return `
    <div class="field">
      <label class="label">服务商预设</label>
      <select class="select" id="aiPreset">
        ${PRESETS.map((p) => `<option value="${p.id}" ${s.preset === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
      </select>
      <p class="hint">不确定选哪个：先用「智谱 GLM-4.7-Flash」，免费、注册即用；想更强就换 GLM-5.3-Flash（按量计费）。</p>
    </div>
    <div class="form-grid">
      <div class="field">
        <label class="label">Base URL <em>*</em></label>
        <input class="input" id="aiBase" value="${esc(s.baseUrl)}" placeholder="https://open.bigmodel.cn/api/paas/v4">
      </div>
      <div class="field">
        <label class="label">模型 <em>*</em></label>
        <input class="input" id="aiModel" value="${esc(s.model)}" placeholder="glm-4.7-flash">
      </div>
    </div>
    <div class="field" style="margin-bottom:10px">
      <label class="label">API Key <em>*</em></label>
      <div class="key-row">
        <input class="input" id="aiKey" type="password" value="${esc(s.apiKey)}" placeholder="粘贴你的 Key，只保存在本机">
        <button class="btn btn-ghost" id="aiToggle" type="button">显示</button>
      </div>
      <p class="hint">Key 存在浏览器 localStorage 里，不会上传到任何服务器，也不会写进导出的备份。</p>
    </div>
    <div class="btn-row">
      <button class="btn btn-ghost" id="aiTest" type="button">${icon('spark')} 测试连接</button>
      <span class="tiny muted" id="aiState" style="align-self:center">修改后自动保存</span>
    </div>`;
}

export async function render(main) {
  const s = loadSettings();
  const size = (() => {
    try {
      const bytes = new Blob([JSON.stringify(buildBackup())]).size;
      return bytes >= 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB';
    } catch { return '—'; }
  })();

  main.innerHTML = `
    <header class="page-head">
      <div>
        <p class="eyebrow">本机数据与模型接入</p>
        <h1 class="page-title">设置</h1>
        <p class="page-sub">换模型、备份数据、导出笔记</p>
      </div>
    </header>

    <div class="settings-grid">
      <div>
        <section class="card settings-block">
          <h3>AI 批阅</h3>
          <p class="sub">任何 OpenAI 兼容接口都能用。免费方案见下方说明。</p>
          ${renderForm(s)}
        </section>

        <section class="card settings-block danger-zone">
          <h3>数据</h3>
          <p class="sub">当前占用约 ${size}。数据存在这台电脑的浏览器里，换设备或清理浏览器会丢掉，建议定期导出。</p>
          <div class="btn-row">
            <button class="btn btn-primary" id="btnExport" type="button">导出备份</button>
            <button class="btn btn-ghost" id="btnImport" type="button">导入备份</button>
            <button class="btn btn-danger" id="btnClear" type="button">清空全部数据</button>
          </div>
          <input type="file" accept="application/json,.json" id="importFile" hidden>
          <p class="hint" style="margin-top:12px">备份文件包含所有项目、笔记、图片与 AI 复盘结果，不含 API Key。</p>
        </section>
      </div>

      <div>
        <section class="card settings-block">
          <h3>怎么用</h3>
          <p class="sub">三步进入正循环</p>
          <ol class="info-list" style="list-style:none;counter-reset:step">
            <li><b>建项目</b>：一份长期在看的东西建一个项目，写下阅读目标与目标篇数。</li>
            <li><b>写笔记</b>：每读完一篇，按结构填。填不满没关系，空着的板块 AI 会点出来。</li>
            <li><b>点复盘</b>：AI 每块给批注，最后给综合分与下一步；结果会一直保存。</li>
            <li><b>过一段时间</b>：在项目页点「阶段复盘」，看自己有没有真的进步。</li>
          </ol>
        </section>

        <section class="card settings-block">
          <h3>免费 Key 怎么拿</h3>
          <p class="sub">三个不用花钱的选择</p>
          <ol class="info-list" style="list-style:none">
            <li><b>智谱</b>：open.bigmodel.cn 注册 → API Keys → 新建，模型填 <span class="tiny">glm-4.7-flash</span>，免费不限量；想更强可换 <span class="tiny">glm-5.3-flash</span>（按量计费）。</li>
            <li><b>魔搭</b>：modelscope.cn 绑定阿里云账号 → 访问令牌，模型填 <span class="tiny">Qwen/Qwen2.5-7B-Instruct</span>，每天有免费额度。</li>
            <li><b>阿里百炼</b>：bailian.console.aliyun.com 开通 → API-KEY，模型 <span class="tiny">qwen-plus</span>，新用户每个模型百万 tokens。</li>
          </ol>
          <p class="hint" style="margin-top:10px">如果测试连接时报跨域（CORS）错误，说明该平台不允许网页直接调用，换一家即可，与 Key 无关。</p>
        </section>

        <section class="card settings-block">
          <h3>关于</h3>
          <p class="sub">页边 · 阅读批注与复盘</p>
          <ul class="info-list">
            <li>所有数据只存在本机浏览器（IndexedDB），不联网同步。</li>
            <li>AI 只读取你的文字笔记，图片不会上传。</li>
            <li>快捷键：<kbd style="border-color:var(--line);color:var(--ink-2)">Ctrl</kbd> / <kbd style="border-color:var(--line);color:var(--ink-2)">⌘</kbd> + <kbd style="border-color:var(--line);color:var(--ink-2)">Enter</kbd> 复盘当前笔记。</li>
            <li>换电脑：先导出备份，在新设备导入即可。</li>
          </ul>
        </section>
      </div>
    </div>
  `;

  /* ---------- 表单自动保存 ---------- */
  const preset = main.querySelector('#aiPreset');
  const base = main.querySelector('#aiBase');
  const model = main.querySelector('#aiModel');
  const key = main.querySelector('#aiKey');
  const state = main.querySelector('#aiState');

  const persist = debounce(() => {
    saveSettings({
      preset: preset.value,
      baseUrl: base.value.trim(),
      model: model.value.trim(),
      apiKey: key.value.trim()
    });
    state.textContent = '已保存';
  }, 400);

  const onChange = () => { state.textContent = '正在保存…'; persist(); };
  [base, model, key].forEach((el) => el.addEventListener('input', onChange));

  preset.addEventListener('change', () => {
    const p = PRESETS.find((x) => x.id === preset.value);
    if (p && p.id !== 'custom') {
      base.value = p.baseUrl;
      model.value = p.model;
    }
    onChange();
  });

  main.querySelector('#aiToggle').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const show = key.type === 'password';
    key.type = show ? 'text' : 'password';
    btn.textContent = show ? '隐藏' : '显示';
  });

  main.querySelector('#aiTest').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    saveSettings({
      preset: preset.value,
      baseUrl: base.value.trim(),
      model: model.value.trim(),
      apiKey: key.value.trim()
    });
    btn.disabled = true;
    const old = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> 正在连接';
    try {
      const reply = await testConnection();
      toast(`连接成功，模型回复：${reply.slice(0, 20)}`, 'ok');
    } catch (err) {
      toast(err.message, 'err', 7000);
    } finally {
      btn.disabled = false;
      btn.innerHTML = old;
    }
  });

  /* ---------- 备份 ---------- */
  main.querySelector('#btnExport').addEventListener('click', () => {
    const data = buildBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    a.href = url;
    a.download = `页边备份-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('备份已导出', 'ok');
  });

  const importFile = main.querySelector('#importFile');
  main.querySelector('#btnImport').addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    let data;
    try {
      data = JSON.parse(await file.text());
    } catch {
      toast('这不是有效的 JSON 备份文件', 'err');
      e.target.value = '';
      return;
    }
    const pCount = Array.isArray(data.projects) ? data.projects.length : 0;
    const nCount = Array.isArray(data.notes) ? data.notes.length : 0;
    e.target.value = '';
    openModal({
      title: '导入备份',
      sub: `${pCount} 个项目 · ${nCount} 篇笔记`,
      width: 470,
      body: `<p style="font-size:13px;line-height:1.9;color:var(--ink-2)">
        选择导入方式：<br>
        <b>合并</b>：保留现有数据，同 ID 的记录会被备份里的版本覆盖。<br>
        <b>覆盖</b>：先清空现有全部数据，再导入备份。</p>`,
      foot: `<button class="btn btn-ghost" data-merge type="button">合并导入</button>
             <button class="btn btn-danger" data-replace type="button">覆盖导入</button>`,
      onMount(el, close) {
        el.querySelector('[data-merge]').addEventListener('click', async () => {
          close();
          await doImport('merge');
        });
        el.querySelector('[data-replace]').addEventListener('click', async () => {
          close();
          const ok = await confirmDialog({
            title: '确认覆盖',
            message: '现有全部项目与笔记会被清空，此操作不可撤销。',
            confirmText: '清空并导入',
            danger: true
          });
          if (ok) await doImport('replace');
        });
      }
    });

    async function doImport(mode) {
      try {
        const res = await restoreBackup(data, mode);
        toast(`已导入 ${res.projects} 个项目、${res.notes} 篇笔记`, 'ok');
        setTimeout(() => location.reload(), 700);
      } catch (err) {
        toast('导入失败：' + err.message, 'err', 6000);
      }
    }
  });

  main.querySelector('#btnClear').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: '清空全部数据',
      message: '所有项目、笔记、图片与 AI 复盘都会被删除，无法恢复。确定要清空吗？',
      confirmText: '全部清空',
      danger: true
    });
    if (!ok) return;
    await clearAllData();
    toast('已清空');
    setTimeout(() => location.reload(), 600);
  });
}
