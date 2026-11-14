import { TEMPLATE_LIST, templateById } from '../templates.js';
import { saveProject, uid, nowISO } from '../store.js';
import { esc, openModal, toast, compressImage, icon } from '../ui.js';
import { suggestTemplate } from '../ai.js';

const clone = (v) => JSON.parse(JSON.stringify(v));

export function openProjectModal({ project = null, onSaved } = {}) {
  const isEdit = Boolean(project);
  let cover = project?.cover || '';
  let templateId = project?.templateId || 'journal';
  let sections = clone(project?.template?.sections || templateById('journal').sections);

  const body = `
    <div class="form-grid">
      <div class="field">
        <label class="label">项目名称 <em>*</em></label>
        <input class="input" id="pfTitle" placeholder="如：经济学人精读" value="${esc(project?.title || '')}">
      </div>
      <div class="field">
        <label class="label">材料类型</label>
        <select class="select" id="pfKind">
          ${['期刊', '书籍', '文章', '论文', '课程', '专栏', '其他']
            .map((k) => `<option value="${k}" ${project?.kind === k ? 'selected' : ''}>${k}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="field">
      <label class="label">来源 / 作者</label>
      <input class="input" id="pfAuthor" placeholder="如：The Economist、丹尼尔·卡尼曼" value="${esc(project?.author || '')}">
    </div>

    <div class="field">
      <label class="label">阅读目标</label>
      <textarea class="textarea" id="pfGoal" style="min-height:78px"
        placeholder="如：提取能传导到 A 股、ETF 期权及纳指 / 黄金 ETF 的外部变量，训练“这个风险被定价了吗？”的假设审视能力，而不是获取选股择时信号。">${esc(project?.goal || '')}</textarea>
      <p class="hint">AI 会用这个目标判断笔记有没有偏题，阶段评估时也以它为准。</p>
    </div>

    <div class="form-grid">
      <div class="field">
        <label class="label">目标篇数</label>
        <input class="input" id="pfTarget" type="number" min="0" step="1" placeholder="如 30" value="${project?.target || ''}">
      </div>
      <div class="field">
        <label class="label">封面</label>
        <div class="cover-pick">
          <div class="cover-thumb" id="pfCoverThumb">
            ${cover ? `<img src="${cover}" alt="">` : `<span>无封面</span>`}
          </div>
          <div class="cover-actions">
            <button class="btn btn-ghost btn-sm" id="pfCoverBtn" type="button">选择图片</button>
            <button class="btn btn-quiet btn-sm" id="pfCoverClear" type="button">移除</button>
          </div>
          <input type="file" accept="image/*" id="pfCoverFile" hidden>
        </div>
      </div>
    </div>

    <div class="field" style="margin-bottom:8px">
      <div class="label" style="display:flex;align-items:center;justify-content:space-between;gap:10px">
        <span>笔记结构</span>
        <button class="btn btn-quiet btn-sm" id="pfAi" type="button">${icon('spark')} 让 AI 建议</button>
      </div>
      <div class="hint" style="margin-bottom:8px">每篇笔记按这套结构填写。可以从模板开始，再按自己的习惯改。</div>
      <select class="select" id="pfTpl" style="margin-bottom:10px">
        ${TEMPLATE_LIST.map((t) => `<option value="${t.id}" ${templateId === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
        <option value="custom" ${templateId === 'custom' ? 'selected' : ''}>自定义结构</option>
      </select>
      <div class="tpl-list" id="pfSections"></div>
      <button class="add-row" id="pfAddSection" type="button">＋ 添加板块</button>
    </div>
  `;

  const foot = `
    <button class="btn btn-ghost" data-cancel type="button">取消</button>
    <button class="btn btn-primary" data-save type="button">${isEdit ? '保存修改' : '创建项目'}</button>
  `;

  const modal = openModal({
    title: isEdit ? '编辑项目' : '新建阅读项目',
    sub: isEdit ? '调整目标、封面与笔记结构' : '一个项目对应一份长期阅读计划',
    body,
    foot,
    width: 660,
    onMount(el, close) {
      const wrap = el.querySelector('#pfSections');
      const tplSelect = el.querySelector('#pfTpl');

      const renderSections = () => {
        wrap.innerHTML = sections.map((s, i) => `
          <div class="tpl-row" data-id="${esc(s.id || 's' + (i + 1))}">
            <div class="tpl-row-top">
              <span class="tpl-idx">${String(i + 1).padStart(2, '0')}</span>
              <input class="input tpl-title" value="${esc(s.title || '')}" placeholder="板块标题">
              <select class="select tpl-type">
                <option value="text" ${s.type === 'text' ? 'selected' : ''}>整段</option>
                <option value="list" ${s.type === 'list' ? 'selected' : ''}>逐条</option>
                <option value="chain" ${s.type === 'chain' ? 'selected' : ''}>传导链</option>
              </select>
              <button class="tpl-del" type="button" title="删除">×</button>
            </div>
            <input class="input tpl-hint" value="${esc(s.hint || '')}" placeholder="这一块应该写什么（给 AI 和未来的自己看）">
          </div>`).join('');
      };
      renderSections();

      wrap.addEventListener('click', (e) => {
        const del = e.target.closest('.tpl-del');
        if (!del) return;
        if (sections.length <= 1) { toast('至少保留一个板块'); return; }
        const row = del.closest('.tpl-row');
        const idx = Array.from(wrap.children).indexOf(row);
        sections.splice(idx, 1);
        renderSections();
      });

      el.querySelector('#pfAddSection').addEventListener('click', () => {
        sections.push({ id: uid(), title: '', hint: '', type: 'text' });
        renderSections();
      });

      tplSelect.addEventListener('change', () => {
        templateId = tplSelect.value;
        if (templateId === 'custom') return;
        sections = clone(templateById(templateId).sections);
        renderSections();
      });

      el.querySelector('#pfCoverBtn').addEventListener('click', () => el.querySelector('#pfCoverFile').click());
      el.querySelector('#pfCoverFile').addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
          cover = await compressImage(file, 700, 0.82);
          el.querySelector('#pfCoverThumb').innerHTML = `<img src="${cover}" alt="">`;
        } catch (err) { toast(err.message, 'err'); }
        e.target.value = '';
      });
      el.querySelector('#pfCoverClear').addEventListener('click', () => {
        cover = '';
        el.querySelector('#pfCoverThumb').innerHTML = '<span>无封面</span>';
      });

      el.querySelector('#pfAi').addEventListener('click', async () => {
        const btn = el.querySelector('#pfAi');
        const title = el.querySelector('#pfTitle').value.trim();
        const kind = el.querySelector('#pfKind').value;
        const goal = el.querySelector('#pfGoal').value.trim();
        if (!title) { toast('先填项目名称，AI 才知道要设计什么结构'); el.querySelector('#pfTitle').focus(); return; }
        btn.disabled = true;
        const old = btn.innerHTML;
        btn.innerHTML = '<span class="spinner"></span> 正在设计';
        try {
          const list = await suggestTemplate({ title, kind, goal });
          sections = list;
          templateId = 'custom';
          tplSelect.value = 'custom';
          renderSections();
          toast('结构已生成，可以继续修改', 'ok');
        } catch (err) {
          toast(err.message, 'err', 5200);
        } finally {
          btn.disabled = false;
          btn.innerHTML = old;
        }
      });

      const collectSections = () => {
        return Array.from(wrap.children).map((row, i) => {
          const type = row.querySelector('.tpl-type').value;
          const id = row.getAttribute('data-id') || 's' + (i + 1);
          return {
            id,
            title: row.querySelector('.tpl-title').value.trim(),
            hint: row.querySelector('.tpl-hint').value.trim(),
            type,
            ...(type === 'chain' ? { columns: ['事件 / 政策', '全球变量', '落点'] } : {})
          };
        }).filter((s) => s.title);
      };

      el.querySelector('[data-cancel]').addEventListener('click', close);
      el.querySelector('[data-save]').addEventListener('click', async () => {
        const title = el.querySelector('#pfTitle').value.trim();
        if (!title) { toast('给项目起个名字吧'); el.querySelector('#pfTitle').focus(); return; }
        const list = collectSections();
        if (!list.length) { toast('至少保留一个有标题的板块'); return; }

        const payload = project ? { ...project } : {
          id: uid(),
          createdAt: nowISO(),
          reviews: [],
          archived: false
        };
        payload.title = title;
        payload.kind = el.querySelector('#pfKind').value;
        payload.author = el.querySelector('#pfAuthor').value.trim();
        payload.goal = el.querySelector('#pfGoal').value.trim();
        payload.target = Math.max(0, parseInt(el.querySelector('#pfTarget').value, 10) || 0);
        payload.cover = cover;
        payload.templateId = templateId;
        payload.template = { sections: list };

        try {
          await saveProject(payload);
          close();
          toast(isEdit ? '项目已更新' : '项目已创建', 'ok');
          if (onSaved) onSaved(payload);
        } catch (err) {
          toast('保存失败：' + err.message, 'err');
        }
      });
    }
  });

  return modal;
}
