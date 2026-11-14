import { db, listProjects, allNotes, avgScore, streakDays, notesOf } from '../store.js';
import { esc, icon, fmtDate, scoreClass, openModal } from '../ui.js';
import { noteWordCount } from '../templates.js';
import { openProjectModal } from './project-form.js';

const QUOTES = [
  '读过的书，如果没有被写下来，就只是路过。',
  '笔记不是抄书，是把作者的话翻译成自己的判断。',
  '好的读者会追问：这个结论在什么条件下会错？',
  '每一次落笔，都是在训练自己的假设。',
  '读得多不算本事，能把读到的东西接到自己的判断上才算。'
];

function fmtCount(n) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}<small>万字</small>`;
  return `${n}<small>字</small>`;
}

function projectCard(p) {
  const notes = notesOf(p.id);
  const avg = avgScore(notes);
  const target = p.target || 0;
  const ratio = target ? Math.min(100, Math.round((notes.length / target) * 100)) : 0;
  return `
    <a class="pcard" href="#/project/${p.id}">
      <div class="pcover">
        ${p.cover ? `<img src="${p.cover}" alt="">` : `<span class="pcover-ph">${esc((p.title || '未').slice(0, 1))}</span>`}
      </div>
      <div class="pbody">
        <div class="pmeta">
          <span class="chip chip-plain">${esc(p.kind || '项目')}</span>
          ${avg != null ? `<span class="chip chip-red">均分 ${avg}</span>` : ''}
          <span class="pcount">${notes.length} 篇</span>
        </div>
        <h3>${esc(p.title)}</h3>
        <p class="pgoal">${esc(p.goal || '还没有写阅读目标')}</p>
        <div class="pbar"><i style="width:${ratio}%"></i></div>
        <div class="pfoot">
          <span>${target ? `${notes.length} / ${target} 篇 · ${ratio}%` : `已积累 ${notes.length} 篇`}</span>
          <span>${p.author ? esc(p.author) : ''}</span>
        </div>
      </div>
    </a>`;
}

function recentRow(n) {
  const p = db.projects.find((x) => x.id === n.projectId);
  const d = new Date(n.createdAt || n.updatedAt);
  const score = n.aiReview ? n.aiReview.score : null;
  return `
    <a class="note-row" href="#/note/${n.id}">
      <div class="note-date"><b>${d.getDate()}</b>${d.getMonth() + 1} 月</div>
      <div class="note-main">
        <h4>${esc(n.title || '未命名笔记')}</h4>
        <p>${esc(p ? p.title : '未知项目')}${n.subtitle ? ' · ' + esc(n.subtitle) : ''}</p>
      </div>
      <span class="score-pill ${scoreClass(score)}">${score != null ? score : '未复盘'}</span>
    </a>`;
}

function pickProject(onPick) {
  if (!db.projects.length) {
    openProjectModal({ onSaved: (p) => { location.hash = '#/note/new/' + p.id; } });
    return;
  }
  if (db.projects.length === 1) {
    onPick(db.projects[0]);
    return;
  }
  openModal({
    title: '这次写哪个项目',
    sub: '笔记会归入所选项目',
    width: 460,
    body: `<div class="pick-list">
      ${db.projects.map((p) => `
        <button class="pick-item" data-id="${p.id}" type="button">
          <span class="pick-cover">${p.cover ? `<img src="${p.cover}" alt="">` : esc((p.title || '未').slice(0, 1))}</span>
          <span class="pick-text"><b>${esc(p.title)}</b><i>${esc(p.kind || '')} · ${notesOf(p.id).length} 篇</i></span>
          <span class="pick-arrow">→</span>
        </button>`).join('')}
    </div>`,
    onMount(el, close) {
      el.querySelectorAll('.pick-item').forEach((btn) => {
        btn.addEventListener('click', () => {
          close();
          onPick(db.projects.find((p) => p.id === btn.getAttribute('data-id')));
        });
      });
    }
  });
}

export async function render(main) {
  const projects = listProjects();
  const notes = allNotes();
  const avg = avgScore(notes);
  const streak = streakDays();
  const totalWords = notes.reduce((a, n) => a + noteWordCount(n), 0);
  const quote = QUOTES[new Date().getDate() % QUOTES.length];

  const heroTitle = !notes.length
    ? '先写下第一篇。'
    : streak >= 3
      ? `已经连续 ${streak} 天，保持住。`
      : '今天读到的，值得记下来。';
  const heroText = !notes.length
    ? '建立阅读项目，为它设一个目标；每读完一篇，用固定结构写下判断。AI 会逐块批阅，并记录你的进步。'
    : `累计 ${notes.length} 篇笔记，${fmtDate(new Date(), { week: true })}。别追数量，追每篇里那句属于自己的判断。`;

  main.innerHTML = `
    <header class="page-head">
      <div>
        <p class="eyebrow">${fmtDate(new Date(), { week: true })}</p>
        <h1 class="page-title">阅览台</h1>
        <p class="page-sub">${streak > 0 ? `连续落笔 ${streak} 天` : '从今天开始记录'}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-ghost" id="btnNewProject">${icon('project')} 新建项目</button>
        <button class="btn btn-primary" id="btnWrite">${icon('note')} 写一篇笔记</button>
      </div>
    </header>

    <section class="hero">
      <div>
        <h2>${heroTitle}</h2>
        <p>${heroText}</p>
        <div class="hero-quote">「${esc(quote)}」</div>
      </div>
      <div class="hero-side">
        <button class="btn btn-primary btn-block" id="heroWrite">${icon('note')} 开始写</button>
        <span class="tiny muted" style="text-align:center">Ctrl / ⌘ + Enter 快速复盘</span>
      </div>
    </section>

    <div class="stat-grid">
      <div class="stat"><div class="stat-num num">${notes.length}<small>篇</small></div><div class="stat-label">累计笔记</div></div>
      <div class="stat"><div class="stat-num num">${totalWords ? fmtCount(totalWords) : '—'}</div><div class="stat-label">写下字数</div></div>
      <div class="stat ${avg != null ? 'up' : ''}"><div class="stat-num num">${avg != null ? avg : '—'}<small>${avg != null ? '分' : ''}</small></div><div class="stat-label">复盘均分</div></div>
      <div class="stat"><div class="stat-num num">${streak}<small>天</small></div><div class="stat-label">连续落笔</div></div>
    </div>

    <div class="section-title"><span class="st-mark"></span>阅读项目
      <a class="st-more" href="#/notes">全部笔记 →</a>
    </div>
    ${projects.length ? `<div class="project-grid">
      ${projects.map(projectCard).join('')}
      <button class="pcard-new" id="gridNewProject" type="button"><span class="plus">＋</span>新建阅读项目</button>
    </div>` : `<div class="card">${''}
      <div class="empty">
        <img src="icons/icon-empty.svg" alt="">
        <h4>还没有阅读项目</h4>
        <p>把一份长期在看的东西（比如《经济学人》、某本书、某门课）建成一个项目，给它设一个目标。</p>
        <button class="btn btn-primary" id="emptyNewProject" type="button">创建第一个项目</button>
      </div>
    </div>`}

    ${notes.length ? `
      <div class="section-title"><span class="st-mark"></span>最近写的</div>
      <div class="card">${notes.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 6).map(recentRow).join('')}</div>
    ` : ''}
  `;

  const goWrite = () => pickProject((p) => { location.hash = '#/note/new/' + p.id; });
  const newProject = () => openProjectModal({ onSaved: (p) => { location.hash = '#/project/' + p.id; } });

  const bind = (id, fn) => { const el = main.querySelector(id); if (el) el.addEventListener('click', fn); };
  bind('#btnWrite', goWrite);
  bind('#heroWrite', goWrite);
  bind('#btnNewProject', newProject);
  bind('#gridNewProject', newProject);
  bind('#emptyNewProject', newProject);
}
