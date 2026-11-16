import { db, allNotes } from '../store.js';
import { esc, icon, fmtDate, emptyState } from '../ui.js';

/* 把所有笔记里的术语拍平，按最后修改排序 */
function collect() {
  const out = [];
  allNotes().forEach((n) => {
    (n.terms || []).forEach((t, i) => {
      const en = (t.en || '').trim();
      const zh = (t.zh || '').trim();
      const note = (t.note || '').trim();
      if (!en && !zh) return;
      out.push({
        id: `${n.id}:${i}`,
        en, zh, note,
        noteId: n.id,
        projectId: n.projectId,
        noteTitle: n.title || '未命名笔记',
        at: n.updatedAt || n.createdAt
      });
    });
  });
  return out.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
}

function card(t, projectTitle) {
  const head = t.en || t.zh;
  const sub = t.en && t.zh ? `<div class="term-zh">${esc(t.zh)}</div>` : '';
  return `
    <article class="term-card" data-term="${esc(t.id)}">
      <div class="term-en">${esc(head)}</div>
      ${sub}
      ${t.note ? `<p class="term-note">${esc(t.note)}</p>` : ''}
      <div class="term-src">
        <a href="#/note/${t.noteId}">${esc(projectTitle)} · ${esc(t.noteTitle)}</a>
        <span class="dot">${fmtDate(t.at, { short: true })}</span>
      </div>
    </article>`;
}

export async function render(main) {
  const terms = collect();
  const projects = db.projects;
  const projectCount = new Set(terms.map((t) => t.projectId)).size;
  const explained = terms.filter((t) => t.note).length;

  main.innerHTML = `
    <header class="page-head">
      <div>
        <p class="eyebrow">${terms.length} 条 · 来自 ${projectCount} 个项目 · ${explained} 条带解释</p>
        <h1 class="page-title">术语与表达</h1>
        <p class="page-sub">所有笔记里的词条汇总在这里，随时回来翻看</p>
      </div>
      <div class="head-actions">
        <input class="input" id="q" placeholder="搜索单词、术语、释义" style="width:220px">
        <select class="select" id="projFilter" style="width:160px">
          <option value="all">全部项目</option>
          ${projects.map((p) => `<option value="${p.id}">${esc(p.title)}</option>`).join('')}
        </select>
        <button class="btn btn-ghost btn-sm" id="btnMask" type="button">${icon('terms')} 遮住中文自测</button>
      </div>
    </header>
    <div id="termWrap" class="term-wrap"></div>
  `;

  const wrap = main.querySelector('#termWrap');
  const q = main.querySelector('#q');
  const sel = main.querySelector('#projFilter');
  const maskBtn = main.querySelector('#btnMask');

  let masked = false;
  let filter = 'all';

  const paint = () => {
    const kw = q.value.trim().toLowerCase();
    const titleOf = (pid) => (db.projects.find((p) => p.id === pid) || {}).title || '未归属项目';

    const list = terms.filter((t) => {
      if (filter !== 'all' && t.projectId !== filter) return false;
      if (!kw) return true;
      return [t.en, t.zh, t.note, t.noteTitle, titleOf(t.projectId)]
        .join(' ').toLowerCase().includes(kw);
    });

    if (!terms.length) {
      wrap.innerHTML = `<div class="card">${emptyState({
        title: '还没有术语',
        desc: '写笔记时把值得再用的词填进「术语与表达」，这里会自动汇总。',
        action: '<a class="btn btn-primary" href="#/notes">去写笔记</a>'
      })}</div>`;
      return;
    }
    if (!list.length) {
      wrap.innerHTML = `<div class="card">${emptyState({ title: '没有匹配的词条', desc: '换个关键词，或切换到全部项目。' })}</div>`;
      return;
    }
    wrap.innerHTML = `<div class="term-grid">${list.map((t) => card(t, titleOf(t.projectId))).join('')}</div>`;
    wrap.classList.toggle('masked', masked);
  };

  paint();
  q.addEventListener('input', paint);
  sel.addEventListener('change', () => { filter = sel.value; paint(); });

  maskBtn.addEventListener('click', () => {
    masked = !masked;
    maskBtn.classList.toggle('tgl-on', masked);
    maskBtn.innerHTML = `${icon('terms')} ${masked ? '显示中文' : '遮住中文自测'}`;
    wrap.classList.toggle('masked', masked);
    if (!masked) wrap.querySelectorAll('.term-card.reveal').forEach((el) => el.classList.remove('reveal'));
  });

  /* 遮住时点卡片翻开；点来源链接不拦 */
  wrap.addEventListener('click', (e) => {
    if (!masked || e.target.closest('a')) return;
    const c = e.target.closest('.term-card');
    if (c) c.classList.toggle('reveal');
  });
}
