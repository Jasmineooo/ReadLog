import { getProject, notesOf, avgScore, deleteProject, saveProject } from '../store.js';
import { esc, icon, fmtDate, scoreClass, ring, confirmDialog, toast } from '../ui.js';
import { completionOf, noteWordCount } from '../templates.js';
import { reviewProgress } from '../ai.js';
import { openProjectModal } from './project-form.js';

const TREND_TEXT = { up: '在进步', flat: '持平', down: '在退步' };
const TREND_CLASS = { up: 'chip-red', flat: 'chip-gold', down: 'chip-plain' };

function noteRow(note, project) {
  const c = completionOf(note, project);
  const d = new Date(note.createdAt || note.updatedAt);
  const score = note.aiReview ? note.aiReview.score : null;
  return `
    <a class="note-row" href="#/note/${note.id}">
      <div class="note-date"><b>${d.getDate()}</b>${d.getMonth() + 1} 月</div>
      <div class="note-main">
        <h4>${esc(note.title || '未命名笔记')}</h4>
        <p>${note.subtitle ? esc(note.subtitle) + ' · ' : ''}${c.filled}/${c.total} 块 · ${noteWordCount(note)} 字</p>
      </div>
      <span class="score-pill ${scoreClass(score)}">${score != null ? score : '未复盘'}</span>
    </a>`;
}

function reviewCard(r) {
  return `
    <div class="card card-pad" style="margin-bottom:12px">
      <div class="review-top">
        <span class="chip ${TREND_CLASS[r.trend] || 'chip-plain'}">${TREND_TEXT[r.trend] || '阶段评估'}</span>
        <span class="chip chip-plain">${esc(r.goalHit || '')}</span>
        <span class="tiny muted" style="margin-left:auto">${fmtDate(r.createdAt, { full: true })}</span>
        <span class="score-pill ${scoreClass(r.score)}">${r.score ?? '—'}</span>
      </div>
      <p class="review-summary">${esc(r.summary)}</p>
      <div class="report-cols">
        <div class="mini-card">
          <h5>进步的证据</h5>
          <ul class="bullets">${(r.evidence || []).map((x) => `<li>${esc(x)}</li>`).join('') || '<li>暂无</li>'}</ul>
        </div>
        <div class="mini-card">
          <h5>还差什么</h5>
          <ul class="bullets">${(r.gaps || []).map((x) => `<li>${esc(x)}</li>`).join('') || '<li>暂无</li>'}</ul>
        </div>
      </div>
      <div class="next-step"><b>接下来</b><span>${(r.actions || []).map((x) => esc(x)).join('　·　')}</span></div>
    </div>`;
}

export async function render(main, id) {
  const project = getProject(id);
  if (!project) {
    main.innerHTML = `<div class="empty"><h4>项目不存在</h4><p>它可能已经被删除了。</p><a class="btn btn-ghost" href="#/">回到阅览台</a></div>`;
    return;
  }

  const notes = notesOf(project.id);
  const avg = avgScore(notes);
  const reviewed = notes.filter((n) => n.aiReview).length;
  const target = project.target || 0;
  const ratio = target ? Math.min(100, Math.round((notes.length / target) * 100)) : 0;
  const reviews = project.reviews || [];

  main.innerHTML = `
    <div class="note-top">
      <a class="back-link" href="#/">← 阅览台</a>
      <div class="head-actions" style="margin-left:auto">
        <button class="btn btn-ghost btn-sm" id="btnEdit">${icon('settings')} 编辑项目</button>
        <button class="btn btn-ghost btn-sm" id="btnProgress">${icon('spark')} 阶段复盘</button>
        <a class="btn btn-primary btn-sm" href="#/note/new/${project.id}">${icon('note')} 写新笔记</a>
      </div>
    </div>

    <section class="project-hero">
      <div class="pcover">
        ${project.cover ? `<img src="${project.cover}" alt="">` : `<span class="pcover-ph">${esc((project.title || '未').slice(0, 1))}</span>`}
      </div>
      <div class="project-info">
        <div class="pmeta">
          <span class="chip chip-plain">${esc(project.kind || '项目')}</span>
          ${project.author ? `<span class="tiny muted">${esc(project.author)}</span>` : ''}
        </div>
        <h1>${esc(project.title)}</h1>
        <div class="goal-box">
          <b>阅读目标</b>
          ${esc(project.goal || '还没有设置目标。点右上角「编辑项目」写一句：这一轮阅读到底想训练什么。')}
        </div>
      </div>
      <div class="project-side">
        ${ring(avg, 108, 7, '复盘均分')}
        <div style="display:flex;gap:14px;font-size:11px;color:var(--ink-3);letter-spacing:.04em">
          <span><b class="num" style="font-size:15px;color:var(--ink-2)">${notes.length}</b> 篇</span>
          <span><b class="num" style="font-size:15px;color:var(--ink-2)">${reviewed}</b> 已复盘</span>
        </div>
      </div>
    </section>

    ${target ? `<div class="pbar" style="margin:-10px 0 22px"><i style="width:${ratio}%"></i></div>` : ''}

    <div class="section-title"><span class="st-mark"></span>笔记
      <span class="tiny muted" style="font-weight:400">${target ? `${notes.length} / ${target} 篇 · ${ratio}%` : '第一篇从这里开始'}</span>
    </div>

    ${notes.length ? `<div class="card" style="margin-bottom:26px">${notes.map((n) => noteRow(n, project)).join('')}</div>`
      : `<div class="card" style="margin-bottom:26px">${''}
          <div class="empty">
            <img src="icons/icon-empty.svg" alt="">
            <h4>这个项目还没有笔记</h4>
            <p>读完一篇之后，按结构写下来。哪怕只填三块，也比只划重点强。</p>
            <a class="btn btn-primary" href="#/note/new/${project.id}">写第一篇</a>
          </div>
        </div>`}

    <div class="section-title"><span class="st-mark"></span>阶段复盘
      <span class="tiny muted" style="font-weight:400;margin-left:4px">让 AI 比较这段时间的笔记，判断有没有进步</span>
    </div>

    ${reviews.length ? reviews.map(reviewCard).join('') : `
      <div class="card" style="padding:24px;text-align:center;color:var(--ink-3);font-size:12.5px;line-height:1.9">
        积累 3 篇以上笔记后，点「阶段复盘」，AI 会对比前后的判断质量，告诉你是否在接近目标。<br>
        <span class="tiny">复盘结果会一直留在这里，不需要重新生成。</span>
      </div>`}

    <div style="margin-top:34px;display:flex;justify-content:flex-end">
      <button class="btn btn-quiet btn-sm" id="btnDelete" style="color:#A79C89">删除这个项目</button>
    </div>
  `;

  main.querySelector('#btnEdit').addEventListener('click', () => {
    openProjectModal({ project, onSaved: () => render(main, project.id) });
  });

  const progressBtn = main.querySelector('#btnProgress');
  progressBtn.addEventListener('click', async () => {
    if (!notes.length) { toast('先写一篇笔记再来复盘'); return; }
    progressBtn.disabled = true;
    const old = progressBtn.innerHTML;
    progressBtn.innerHTML = '<span class="spinner"></span> 正在评估';
    try {
      const record = await reviewProgress(project, notes);
      project.reviews = [record, ...(project.reviews || [])].slice(0, 20);
      await saveProject(project);
      toast('阶段复盘已生成', 'ok');
      await render(main, project.id);
    } catch (err) {
      toast(err.message, 'err', 5600);
      progressBtn.disabled = false;
      progressBtn.innerHTML = old;
    }
  });

  main.querySelector('#btnDelete').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: '删除项目',
      message: `「${project.title}」以及它的 ${notes.length} 篇笔记会被一起删除，无法恢复。建议先在设置里导出备份。`,
      confirmText: '删除',
      danger: true
    });
    if (!ok) return;
    await deleteProject(project.id);
    toast('项目已删除');
    location.hash = '#/';
  });
}
