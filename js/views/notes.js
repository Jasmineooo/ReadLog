import { db, allNotes, avgScore, listProjects, notesOf } from '../store.js';
import { esc, fmtDate, scoreClass, emptyState } from '../ui.js';
import { noteWordCount, sectionToText } from '../templates.js';

function matches(note, q) {
  if (!q) return true;
  const hay = [
    note.title, note.subtitle,
    ...Object.values(note.sections || {}).flatMap((v) => {
      if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' ? x : `${x.a || ''}${x.b || ''}${x.c || ''}`));
      return [v];
    }),
    ...(note.terms || []).map((t) => `${t.en || ''}${t.zh || ''}${t.note || ''}`)
  ].join(' ').toLowerCase();
  return hay.includes(q.toLowerCase());
}

function row(note) {
  const p = db.projects.find((x) => x.id === note.projectId);
  const score = note.aiReview ? note.aiReview.score : null;
  const d = new Date(note.createdAt || note.updatedAt);
  return `
    <a class="note-row" href="#/note/${note.id}">
      <div class="note-date"><b>${d.getDate()}</b>${d.getMonth() + 1} 月</div>
      <div class="note-main">
        <h4>${esc(note.title || '未命名笔记')}</h4>
        <p>${esc(p ? p.title : '未知项目')}${note.subtitle ? ' · ' + esc(note.subtitle) : ''} · ${noteWordCount(note)} 字</p>
      </div>
      <span class="score-pill ${scoreClass(score)}">${score != null ? score : '未复盘'}</span>
    </a>`;
}

export async function render(main) {
  const notes = allNotes();
  const avg = avgScore(notes);
  const projects = listProjects();
  let filter = 'all';

  main.innerHTML = `
    <header class="page-head">
      <div>
        <p class="eyebrow">${notes.length} 篇 · ${avg != null ? '复盘均分 ' + avg : '还没有复盘记录'}</p>
        <h1 class="page-title">笔记</h1>
        <p class="page-sub">所有项目的笔记，按最后修改排序</p>
      </div>
      <div class="head-actions">
        <input class="input" id="q" placeholder="搜索标题、正文、术语" style="width:220px">
        <select class="select" id="projFilter" style="width:170px">
          <option value="all">全部项目</option>
          ${projects.map((p) => `<option value="${p.id}">${esc(p.title)}</option>`).join('')}
        </select>
      </div>
    </header>
    <div id="listWrap"></div>
  `;

  const wrap = main.querySelector('#listWrap');
  const q = main.querySelector('#q');
  const sel = main.querySelector('#projFilter');

  const paint = () => {
    const keyword = q.value.trim();
    let list = notes.filter((n) => (filter === 'all' || n.projectId === filter) && matches(n, keyword));
    if (!list.length) {
      wrap.innerHTML = notes.length
        ? `<div class="card">${emptyState({ title: '没有匹配的笔记', desc: '换个关键词，或切换到全部项目。' })}</div>`
        : `<div class="card">${emptyState({ title: '还没有笔记', desc: '回到阅览台，选一个项目开始写第一篇。', action: '<a class="btn btn-primary" href="#/">去写第一篇</a>' })}</div>`;
      return;
    }
    const groups = new Map();
    list.forEach((n) => {
      const key = n.projectId;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(n);
    });
    wrap.innerHTML = Array.from(groups.entries()).map(([pid, items]) => {
      const p = db.projects.find((x) => x.id === pid);
      return `
        <div class="section-title" style="margin-top:22px"><span class="st-mark"></span>${esc(p ? p.title : '未归属项目')}
          <span class="tiny muted" style="font-weight:400">${items.length} 篇</span>
        </div>
        <div class="card">${items.map(row).join('')}</div>`;
    }).join('');
  };

  paint();
  q.addEventListener('input', paint);
  sel.addEventListener('change', () => { filter = sel.value; paint(); });
}
