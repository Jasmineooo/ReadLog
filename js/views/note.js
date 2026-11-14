import { getProject, getNote, saveNote, deleteNote, uid, nowISO } from '../store.js';
import {
  esc, icon, fmtDate, ring, gradeOf, toast, confirmDialog,
  compressImage, showImage, debounce
} from '../ui.js';
import {
  emptyContent, emptySectionContent, sectionFilled, noteWordCount
} from '../templates.js';
import { DIMENSIONS, reviewNote } from '../ai.js';

let flush = null;
let pageClickHandler = null;
window.addEventListener('hashchange', () => { if (flush) flush(); });
window.addEventListener('pagehide', () => { if (flush) flush(); });

const LEVEL_TEXT = { good: '这块扎实', ok: '这块成形', weak: '这块偏弱', missing: '这块空着' };
const LEVEL_CLASS = { good: 'level-good', ok: 'level-ok', weak: 'level-weak', missing: 'level-weak' };

function reportHTML(review) {
  if (!review) return '';
  const dims = (review.dimensions && review.dimensions.length ? review.dimensions : DIMENSIONS.map((d) => ({ ...d, score: 0, comment: '' })));
  return `
    <div class="report">
      <div class="report-head">
        ${ring(review.score, 128, 9, '综合')}
        <div>
          <div class="report-meta">
            <span class="seal">${gradeOf(review.score)}</span>
            <span class="chip chip-plain">${fmtDate(review.createdAt)} 复盘</span>
            <span class="chip chip-plain">${esc(review.model || '')}</span>
            <button class="btn btn-ghost btn-sm" data-reanalyze style="margin-left:auto">${icon('spark')} 重新复盘</button>
          </div>
          <p class="verdict">${esc(review.summary || '')}</p>
          <div class="dims">
            ${dims.map((d) => `
              <div class="dim-row" title="${esc(d.comment || '')}">
                <span class="dim-name">${esc(d.name || '')}</span>
                <span class="dim-bar"><i style="width:${Math.max(2, d.score)}%"></i></span>
                <span class="dim-score">${d.score}</span>
              </div>`).join('')}
          </div>
        </div>
      </div>
      <div class="report-cols">
        <div class="mini-card">
          <h5>值得保留</h5>
          <ul class="bullets">${(review.highlights || []).map((x) => `<li>${esc(x)}</li>`).join('') || '<li>还没有找到可以保留的判断</li>'}</ul>
        </div>
        <div class="mini-card">
          <h5>还缺什么</h5>
          <ul class="bullets">${(review.gaps || []).map((x) => `<li>${esc(x)}</li>`).join('') || '<li>暂无</li>'}</ul>
        </div>
      </div>
      ${review.nextStep ? `<div class="next-step"><b>下一步</b><span>${esc(review.nextStep)}</span></div>` : ''}
    </div>`;
}

function sectionReviewHTML(review, sectionId) {
  if (!review) return '';
  const r = (review.sectionReviews || []).find((x) => x.sectionId === sectionId);
  if (!r) return '';
  return `
    <div class="ai-block">
      <h5><span class="level-dot ${LEVEL_CLASS[r.level] || 'level-ok'}"></span>AI 批注 · ${LEVEL_TEXT[r.level] || ''}</h5>
      <p>${esc(r.comment)}</p>
      ${(r.suggestions || []).length ? `<ul class="ai-sug">${r.suggestions.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
      ${r.example ? `<div class="ai-fix"><b>示范</b>${esc(r.example)}</div>` : ''}
    </div>`;
}

function sectionBodyHTML(section, value, note) {
  if (section.type === 'list') {
    const rows = Array.isArray(value) && value.length ? value : [''];
    return `<div class="list-rows">
      ${rows.map((v, i) => `
        <div class="list-row">
          <span class="lr-num">${i + 1}</span>
          <textarea data-sec="${section.id}" data-idx="${i}" rows="1" placeholder="一句话：这处在论证什么 / 用了什么证据 / 承认了什么不确定">${esc(v)}</textarea>
          <button class="lr-del" type="button" data-del-list="${section.id}" data-idx="${i}" title="删除这一条">×</button>
        </div>`).join('')}
      <button class="add-row" type="button" data-add-list="${section.id}">＋ 加一条</button>
    </div>`;
  }

  if (section.type === 'chain') {
    const cols = section.columns || ['事件 / 政策', '全球变量', '落点'];
    const rows = Array.isArray(value) && value.length ? value : [{ a: '', b: '', c: '' }];
    const ph = ['一个短语：谁做了什么', '一个短语：哪个变量动了', '一个短语：落到哪个标的 / 哪个定价维度'];
    return `
      <div class="chain-list">
        ${rows.map((r, i) => `
          <div class="chain-card">
            <div class="chain-card-head">
              <span class="chain-idx">传导链 ${i + 1}</span>
              ${rows.length > 1 ? `<button class="chain-del" type="button" data-del-chain="${section.id}" data-idx="${i}">删除</button>` : ''}
            </div>
            <label class="chain-node">
              <span class="chain-label">${esc(cols[0])}</span>
              <input data-sec="${section.id}" data-row="${i}" data-col="a" value="${esc(r.a || '')}" placeholder="${ph[0]}">
            </label>
            <span class="chain-arrow" aria-hidden="true">↓</span>
            <label class="chain-node">
              <span class="chain-label">${esc(cols[1])}</span>
              <input data-sec="${section.id}" data-row="${i}" data-col="b" value="${esc(r.b || '')}" placeholder="${ph[1]}">
            </label>
            <span class="chain-arrow" aria-hidden="true">↓</span>
            <label class="chain-node">
              <span class="chain-label">${esc(cols[2])}</span>
              <input data-sec="${section.id}" data-row="${i}" data-col="c" value="${esc(r.c || '')}" placeholder="${ph[2]}">
            </label>
          </div>`).join('')}
      </div>
      <p class="chain-note">每条链只写三个节点，每格一个短语或短句，不要写成整段话；箭头两端必须真的接得上。文章有几条通路就写几条。</p>
      <button class="add-row" type="button" data-add-chain="${section.id}">＋ 再加一条传导链</button>`;
  }

  return `<textarea class="sec-textarea" data-sec="${section.id}" placeholder="在这里写…">${esc(typeof value === 'string' ? value : '')}</textarea>`;
}

function sectionHTML(note, section, index, review) {
  const value = (note.sections || {})[section.id];
  const filled = sectionFilled(section, value);
  return `
    <section class="sec ${filled ? 'sec-filled' : ''}" data-section="${section.id}">
      <div class="sec-head">
        <span class="sec-index">${String(index + 1).padStart(2, '0')}</span>
        <div>
          <h3 class="sec-title">${esc(section.title)}</h3>
          ${section.hint ? `<p class="sec-hint">${esc(section.hint)}</p>` : ''}
        </div>
      </div>
      <div class="sec-body">${sectionBodyHTML(section, value, note)}</div>
      ${sectionReviewHTML(review, section.id)}
    </section>`;
}

function termsHTML(terms) {
  return (terms || []).map((t, i) => `
    <tr data-term="${i}">
      <td><input data-term-idx="${i}" data-field="en" value="${esc(t.en || '')}" placeholder="yield curve"></td>
      <td><input data-term-idx="${i}" data-field="zh" value="${esc(t.zh || '')}" placeholder="收益率曲线"></td>
      <td><input data-term-idx="${i}" data-field="note" value="${esc(t.note || '')}" placeholder="长短期利差，降息预期的定价载体"></td>
      <td><button class="terms-del" type="button" data-del-term="${i}" title="删除">×</button></td>
    </tr>`).join('');
}

function imagesHTML(images) {
  return (images || []).map((img) => `
    <div class="img-card" data-img="${img.id}">
      <img src="${img.src}" alt="${esc(img.caption || '')}" data-zoom="${img.id}">
      <button class="img-del" type="button" data-del-img="${img.id}" title="删除">×</button>
      <input class="img-cap" data-cap="${img.id}" value="${esc(img.caption || '')}" placeholder="图注（可选）">
    </div>`).join('');
}

export async function render(main, noteId, projectId) {
  let project = null;
  let note = null;
  let persisted = false;

  if (noteId) {
    note = getNote(noteId);
    if (!note) {
      main.innerHTML = `<div class="empty"><h4>笔记不存在</h4><p>它可能已经被删除了。</p><a class="btn btn-ghost" href="#/">回到阅览台</a></div>`;
      return;
    }
    project = getProject(note.projectId);
    if (!project) {
      main.innerHTML = `<div class="empty"><h4>所属项目不存在</h4><a class="btn btn-ghost" href="#/">回到阅览台</a></div>`;
      return;
    }
    persisted = true;
  } else {
    project = getProject(projectId);
    if (!project) {
      main.innerHTML = `<div class="empty"><h4>项目不存在</h4><a class="btn btn-ghost" href="#/">回到阅览台</a></div>`;
      return;
    }
    note = {
      id: uid(),
      projectId: project.id,
      title: '',
      subtitle: '',
      sections: emptyContent(project.template || {}),
      terms: [],
      images: [],
      aiReview: null,
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
  }

  const sections = (project.template && project.template.sections) || [];
  note.sections = note.sections || {};
  note.terms = note.terms || [];
  note.images = note.images || [];
  sections.forEach((s) => {
    if (note.sections[s.id] == null) note.sections[s.id] = emptySectionContent(s);
  });

  main.innerHTML = `
    <div class="note-top">
      <a class="back-link" href="#/project/${project.id}">← ${esc(project.title)}</a>
      <div class="save-state" id="saveState"><span class="dot"></span><span>${persisted ? '已保存' : '新笔记'}</span></div>
      <button class="btn btn-ghost btn-sm" id="btnDeleteNote" style="color:#A79C89">删除</button>
      <button class="btn btn-primary btn-sm" id="btnAnalyze" data-analyze type="button">${icon('spark')} AI 复盘</button>
    </div>

    <header class="note-head">
      <input class="note-title-input" id="noteTitle" placeholder="这篇笔记叫什么" value="${esc(note.title || '')}">
      <div class="note-sub-row">
        <input class="note-sub-input" id="noteSub" placeholder="期号 / 章节 / 日期（可选）" value="${esc(note.subtitle || '')}">
        <span class="chip chip-plain">${esc(project.kind || '')}</span>
        <span class="tiny muted" id="wordCount">${noteWordCount(note)} 字</span>
      </div>
    </header>

    <div id="reviewSlot">${reportHTML(note.aiReview)}</div>
    <div id="reviewWait"></div>

    <div id="secWrap">
      ${sections.map((s, i) => sectionHTML(note, s, i, note.aiReview)).join('')}
    </div>

    <div class="card card-pad" style="margin-top:18px">
      <div class="section-title" style="margin-bottom:8px">${icon('note')} 术语与表达
        <span class="tiny muted" style="margin-left:auto;font-weight:400">只记值得再用的词</span>
      </div>
      <table class="terms-table">
        <thead><tr><th style="width:26%">英文 / 原文</th><th style="width:24%">中文</th><th>一句解释或用法</th><th style="width:30px"></th></tr></thead>
        <tbody id="termsBody">${termsHTML(note.terms)}</tbody>
      </table>
      <button class="add-row" id="addTerm" type="button">＋ 添加术语</button>
    </div>

    <div class="card card-pad" style="margin-top:14px">
      <div class="section-title" style="margin-bottom:6px">${icon('project')} 图片 / 截图
        <span class="tiny muted" style="margin-left:auto;font-weight:400">文章截图、书页、图表 · 仅用于你自己回看</span>
      </div>
      <p class="hint" style="margin-bottom:10px">AI 只分析文字笔记，图片不会上传给模型。</p>
      <div class="img-grid" id="imgGrid">
        ${imagesHTML(note.images)}
        <button class="upload-tile" id="btnUpload" type="button"><span class="plus">＋</span>添加图片</button>
      </div>
      <input type="file" accept="image/*" multiple id="imgFile" hidden>
    </div>

    <div style="margin-top:20px;display:flex;justify-content:space-between;align-items:center">
      <span class="tiny muted">Ctrl / ⌘ + Enter 直接复盘</span>
      <a class="btn btn-ghost btn-sm" href="#/project/${project.id}">回到项目 →</a>
    </div>
  `;

  /* ---------- 保存 ---------- */
  const saveState = main.querySelector('#saveState');
  const setState = (text, cls = '') => {
    saveState.className = 'save-state ' + cls;
    saveState.innerHTML = `<span class="dot"></span><span>${esc(text)}</span>`;
  };

  const persist = async (silent = false) => {
    try {
      if (!persisted) {
        if (!note.title.trim() && noteWordCount(note) === 0 && !(note.images || []).length) return;
        persisted = true;
        history.replaceState(null, '', '#/note/' + note.id);
      }
      await saveNote(note);
      setState('已保存');
    } catch (e) {
      setState('保存失败', 'saving');
      if (!silent) toast('保存失败：' + e.message, 'err');
    }
  };
  const schedule = debounce(() => persist(true), 300);
  flush = () => persist(true);

  const refreshCount = () => {
    const el = main.querySelector('#wordCount');
    if (el) el.textContent = `${noteWordCount(note)} 字`;
  };

  /* ---------- 标题 ---------- */
  main.querySelector('#noteTitle').addEventListener('input', (e) => {
    note.title = e.target.value;
    setState('正在保存', 'saving');
    schedule();
  });
  main.querySelector('#noteSub').addEventListener('input', (e) => {
    note.subtitle = e.target.value;
    setState('正在保存', 'saving');
    schedule();
  });

  /* ---------- 板块输入 ---------- */
  const secWrap = main.querySelector('#secWrap');

  secWrap.addEventListener('input', (e) => {
    const el = e.target;
    const sid = el.getAttribute('data-sec');
    if (!sid) return;
    const section = sections.find((s) => s.id === sid);
    if (!section) return;

    if (section.type === 'text') {
      note.sections[sid] = el.value;
    } else if (section.type === 'list') {
      const idx = Number(el.getAttribute('data-idx'));
      if (!Array.isArray(note.sections[sid])) note.sections[sid] = [];
      note.sections[sid][idx] = el.value;
    } else if (section.type === 'chain') {
      const r = Number(el.getAttribute('data-row'));
      const c = el.getAttribute('data-col');
      if (!Array.isArray(note.sections[sid])) note.sections[sid] = [];
      if (!note.sections[sid][r]) note.sections[sid][r] = { a: '', b: '', c: '' };
      note.sections[sid][r][c] = el.value;
    }

    const secEl = el.closest('.sec');
    if (secEl) secEl.classList.toggle('sec-filled', sectionFilled(section, note.sections[sid]));
    refreshCount();
    setState('正在保存', 'saving');
    schedule();

    if (el.tagName === 'TEXTAREA' && section.type !== 'text') {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }
    if (el.tagName === 'TEXTAREA' && section.type === 'text') {
      el.style.height = 'auto';
      el.style.height = Math.max(108, el.scrollHeight) + 'px';
    }
  });

  secWrap.addEventListener('click', async (e) => {
    const addList = e.target.closest('[data-add-list]');
    if (addList) {
      const sid = addList.getAttribute('data-add-list');
      const section = sections.find((s) => s.id === sid);
      if (!Array.isArray(note.sections[sid])) note.sections[sid] = [];
      note.sections[sid].push('');
      const wrap = addList.closest('.sec');
      wrap.innerHTML = `<div class="sec-head">
          <span class="sec-index">${String(sections.indexOf(section) + 1).padStart(2, '0')}</span>
          <div><h3 class="sec-title">${esc(section.title)}</h3>${section.hint ? `<p class="sec-hint">${esc(section.hint)}</p>` : ''}</div>
        </div>
        <div class="sec-body">${sectionBodyHTML(section, note.sections[sid], note)}</div>`;
      setState('正在保存', 'saving');
      schedule();
      const inputs = wrap.querySelectorAll('textarea');
      if (inputs.length) inputs[inputs.length - 1].focus();
      return;
    }

    const delList = e.target.closest('[data-del-list]');
    if (delList) {
      const sid = delList.getAttribute('data-del-list');
      const idx = Number(delList.getAttribute('data-idx'));
      const section = sections.find((s) => s.id === sid);
      if (!Array.isArray(note.sections[sid])) return;
      note.sections[sid].splice(idx, 1);
      if (!note.sections[sid].length) note.sections[sid] = [''];
      const wrap = delList.closest('.sec');
      wrap.innerHTML = `<div class="sec-head">
          <span class="sec-index">${String(sections.indexOf(section) + 1).padStart(2, '0')}</span>
          <div><h3 class="sec-title">${esc(section.title)}</h3>${section.hint ? `<p class="sec-hint">${esc(section.hint)}</p>` : ''}</div>
        </div>
        <div class="sec-body">${sectionBodyHTML(section, note.sections[sid], note)}</div>`;
      refreshCount();
      setState('正在保存', 'saving');
      schedule();
      return;
    }

    const addChain = e.target.closest('[data-add-chain]');
    if (addChain) {
      const sid = addChain.getAttribute('data-add-chain');
      if (!Array.isArray(note.sections[sid])) note.sections[sid] = [];
      note.sections[sid].push({ a: '', b: '', c: '' });
      const section = sections.find((s) => s.id === sid);
      const wrap = addChain.closest('.sec');
      wrap.innerHTML = `<div class="sec-head">
          <span class="sec-index">${String(sections.indexOf(section) + 1).padStart(2, '0')}</span>
          <div><h3 class="sec-title">${esc(section.title)}</h3>${section.hint ? `<p class="sec-hint">${esc(section.hint)}</p>` : ''}</div>
        </div>
        <div class="sec-body">${sectionBodyHTML(section, note.sections[sid], note)}</div>`;
      setState('正在保存', 'saving');
      schedule();
      return;
    }

    const delChain = e.target.closest('[data-del-chain]');
    if (delChain) {
      const sid = delChain.getAttribute('data-del-chain');
      const idx = Number(delChain.getAttribute('data-idx'));
      const section = sections.find((s) => s.id === sid);
      if (!section || !Array.isArray(note.sections[sid])) return;
      note.sections[sid].splice(idx, 1);
      if (!note.sections[sid].length) note.sections[sid] = [{ a: '', b: '', c: '' }];
      const wrap = delChain.closest('.sec');
      wrap.innerHTML = `<div class="sec-head">
          <span class="sec-index">${String(sections.indexOf(section) + 1).padStart(2, '0')}</span>
          <div><h3 class="sec-title">${esc(section.title)}</h3>${section.hint ? `<p class="sec-hint">${esc(section.hint)}</p>` : ''}</div>
        </div>
        <div class="sec-body">${sectionBodyHTML(section, note.sections[sid], note)}</div>`;
      refreshCount();
      setState('正在保存', 'saving');
      schedule();
      return;
    }

    const zoom = e.target.closest('[data-zoom]');
    if (zoom) {
      const img = (note.images || []).find((x) => x.id === zoom.getAttribute('data-zoom'));
      if (img) showImage(img.src);
    }
  });
  /* ---------- 术语 ---------- */
  const termsBody = main.querySelector('#termsBody');
  termsBody.addEventListener('input', (e) => {
    const idx = e.target.getAttribute('data-term-idx');
    const field = e.target.getAttribute('data-field');
    if (idx == null || !field) return;
    note.terms[idx] = note.terms[idx] || { en: '', zh: '', note: '' };
    note.terms[idx][field] = e.target.value;
    refreshCount();
    setState('正在保存', 'saving');
    schedule();
  });
  termsBody.addEventListener('click', (e) => {
    const del = e.target.closest('[data-del-term]');
    if (!del) return;
    note.terms.splice(Number(del.getAttribute('data-del-term')), 1);
    termsBody.innerHTML = termsHTML(note.terms);
    refreshCount();
    setState('正在保存', 'saving');
    schedule();
  });
  main.querySelector('#addTerm').addEventListener('click', () => {
    note.terms = note.terms || [];
    note.terms.push({ en: '', zh: '', note: '' });
    termsBody.innerHTML = termsHTML(note.terms);
    const inputs = termsBody.querySelectorAll('input');
    if (inputs.length) inputs[inputs.length - 3].focus();
    schedule();
  });

  /* ---------- 图片 ---------- */
  const imgGrid = main.querySelector('#imgGrid');
  const uploadInput = main.querySelector('#imgFile');
  main.querySelector('#btnUpload').addEventListener('click', () => uploadInput.click());
  uploadInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setState('正在处理图片', 'saving');
    for (const f of files) {
      try {
        const src = await compressImage(f, 1400, 0.8);
        note.images = note.images || [];
        note.images.push({ id: uid(), src, caption: '' });
      } catch (err) {
        toast(err.message, 'err');
      }
    }
    e.target.value = '';
    renderImages();
    await persist(true);
  });

  function renderImages() {
    imgGrid.innerHTML = imagesHTML(note.images) + `<button class="upload-tile" id="btnUpload2" type="button"><span class="plus">＋</span>添加图片</button>`;
    imgGrid.querySelector('#btnUpload2').addEventListener('click', () => uploadInput.click());
  }

  imgGrid.addEventListener('click', (e) => {
    const del = e.target.closest('[data-del-img]');
    if (del) {
      note.images = (note.images || []).filter((x) => x.id !== del.getAttribute('data-del-img'));
      renderImages();
      schedule();
    }
  });
  imgGrid.addEventListener('input', (e) => {
    const cap = e.target.closest('[data-cap]');
    if (!cap) return;
    const img = (note.images || []).find((x) => x.id === cap.getAttribute('data-cap'));
    if (img) { img.caption = cap.value; schedule(); }
  });

  /* ---------- 复盘 ---------- */
  const analyzeBtn = main.querySelector('#btnAnalyze');
  analyzeBtn.addEventListener('click', async () => {
    if (noteWordCount(note) < 20) {
      toast('先写一点内容，AI 才有东西可批');
      return;
    }
    await persist(true);
    analyzeBtn.disabled = true;
    const old = analyzeBtn.innerHTML;
    analyzeBtn.innerHTML = '<span class="spinner"></span> 逐段批阅中';
    main.querySelector('#reviewWait').innerHTML = `
      <div class="card card-pad" style="margin-bottom:14px">
        <div class="ai-wait"><span class="spinner"></span> AI 正在逐块读你的笔记，通常需要 20–60 秒。可以先别关页面。</div>
        <div class="skeleton" style="margin-top:12px">
          <div class="sk-line"></div><div class="sk-line w70"></div><div class="sk-line w45"></div>
        </div>
      </div>`;
    try {
      const review = await reviewNote(project, note);
      note.aiReview = review;
      await saveNote(note);
      toast(`复盘完成：${review.score} 分`, 'ok');
      await render(main, note.id);
    } catch (err) {
      toast(err.message, 'err', 7000);
      main.querySelector('#reviewWait').innerHTML = '';
      analyzeBtn.disabled = false;
      analyzeBtn.innerHTML = old;
    }
  });

  if (pageClickHandler) main.removeEventListener('click', pageClickHandler);
  pageClickHandler = (e) => {
    if (e.target.closest('[data-reanalyze]')) {
      main.querySelector('#btnAnalyze').click();
    }
    const zoom = e.target.closest('[data-zoom]');
    if (zoom) {
      const img = (note.images || []).find((x) => x.id === zoom.getAttribute('data-zoom'));
      if (img) showImage(img.src);
    }
  };
  main.addEventListener('click', pageClickHandler);

  /* ---------- 删除 ---------- */
  main.querySelector('#btnDeleteNote').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: '删除这篇笔记',
      message: '删除后无法恢复，AI 复盘结果也会一起删掉。',
      confirmText: '删除',
      danger: true
    });
    if (!ok) return;
    flush = null;
    await deleteNote(note.id);
    toast('笔记已删除');
    location.hash = '#/project/' + project.id;
  });

  refreshCount();
}
