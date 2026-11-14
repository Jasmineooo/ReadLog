import { allNotes, avgScore, streakDays, listProjects, notesOf } from '../store.js';
import { esc, scoreClass, dateKey } from '../ui.js';
import { DIMENSIONS } from '../ai.js';
import { noteWordCount } from '../templates.js';

/* ---------- 折线图 ---------- */
function lineChart(notes) {
  const data = notes
    .filter((n) => n.aiReview)
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
    .slice(-24);
  if (data.length < 2) {
    return `<div class="empty" style="padding:30px 10px"><p class="tiny">完成两篇以上 AI 复盘后，这里会出现分数走势。</p></div>`;
  }
  const W = 660, H = 200, L = 30, R = 12, T = 12, B = 24;
  const innerW = W - L - R;
  const innerH = H - T - B;
  const x = (i) => L + (data.length === 1 ? innerW / 2 : (i * innerW) / (data.length - 1));
  const y = (s) => T + (1 - s / 100) * innerH;

  const lines = [0, 25, 50, 75, 100].map((v) => `
    <line class="grid-line" x1="${L}" y1="${y(v)}" x2="${W - R}" y2="${y(v)}"/>
    <text class="axis-text" x="${L - 6}" y="${y(v) + 3}" text-anchor="end">${v}</text>`).join('');

  const pts = data.map((n, i) => `${x(i).toFixed(1)},${y(n.aiReview.score).toFixed(1)}`).join(' ');
  const area = `M ${x(0).toFixed(1)},${(H - B).toFixed(1)} L ${pts.split(' ').join(' L ')} L ${x(data.length - 1).toFixed(1)},${(H - B).toFixed(1)} Z`;

  const dots = data.map((n, i) => `
    <circle class="dot" cx="${x(i).toFixed(1)}" cy="${y(n.aiReview.score).toFixed(1)}" r="3">
      <title>${esc(n.title || '未命名')} · ${n.aiReview.score} 分</title>
    </circle>`).join('');

  const labelIdx = [0, Math.floor((data.length - 1) / 2), data.length - 1].filter((v, i, arr) => arr.indexOf(v) === i);
  const labels = labelIdx.map((i) => `
    <text class="axis-text" x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="middle">${new Date(data[i].createdAt).getMonth() + 1}/${new Date(data[i].createdAt).getDate()}</text>`).join('');

  return `
    <svg class="chart-svg" viewBox="0 0 ${W} ${H}">
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#B03A2C" stop-opacity=".18"/>
          <stop offset="100%" stop-color="#B03A2C" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${lines}
      <path class="area-path" d="${area}"/>
      <polyline class="line-path" points="${pts}"/>
      ${dots}
      ${labels}
    </svg>`;
}

/* ---------- 雷达图 ---------- */
function radarChart(notes) {
  const reviewed = notes.filter((n) => n.aiReview && Array.isArray(n.aiReview.dimensions));
  if (!reviewed.length) {
    return `<div class="empty" style="padding:30px 10px"><p class="tiny">完成一次 AI 复盘后，这里会显示六维平均。</p></div>`;
  }
  const avg = DIMENSIONS.map((d) => {
    const vals = reviewed.map((n) => {
      const found = n.aiReview.dimensions.find((x) => x.key === d.key);
      return found ? Number(found.score) || 0 : 0;
    });
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  });

  const W = 300, H = 268, cx = 150, cy = 130, R = 88;
  const angle = (i) => (-90 + i * (360 / DIMENSIONS.length)) * Math.PI / 180;
  const pt = (i, ratio) => [cx + Math.cos(angle(i)) * R * ratio, cy + Math.sin(angle(i)) * R * ratio];

  const rings = [0.25, 0.5, 0.75, 1].map((r) => `
    <polygon class="radar-grid" points="${DIMENSIONS.map((_, i) => pt(i, r).map((v) => v.toFixed(1)).join(',')).join(' ')}"/>`).join('');

  const spokes = DIMENSIONS.map((_, i) => {
    const [x, y] = pt(i, 1);
    return `<line class="grid-line" x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`;
  }).join('');

  const shape = DIMENSIONS.map((_, i) => pt(i, Math.max(0.04, avg[i] / 100)).map((v) => v.toFixed(1)).join(',')).join(' ');
  const labels = DIMENSIONS.map((d, i) => {
    const [x, y] = pt(i, 1.24);
    return `<text class="radar-label" x="${x.toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="middle">${esc(d.name)}</text>`;
  }).join('');

  return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}">${rings}${spokes}<polygon class="radar-shape" points="${shape}"/>${labels}</svg>`;
}

/* ---------- 热力图 ---------- */
function heatmap(notes) {
  const counts = new Map();
  notes.forEach((n) => {
    const k = dateKey(n.createdAt || n.updatedAt);
    counts.set(k, (counts.get(k) || 0) + 1);
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - 7 * 12);
  const dow = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dow);

  const days = Math.ceil((Math.round((today - start) / 86400000) + 1) / 7) * 7;
  const weeks = days / 7;
  let cells = '';
  for (let i = 0; i < days; i += 1) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    if (d > today) { cells += '<span class="hm-cell" style="opacity:.25"></span>'; continue; }
    const c = counts.get(dateKey(d)) || 0;
    const lv = c === 0 ? '' : c === 1 ? 'l1' : c === 2 ? 'l2' : c === 3 ? 'l3' : 'l4';
    cells += `<span class="hm-cell ${lv}" title="${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} · ${c} 篇"></span>`;
  }
  return `<div class="heatmap" style="grid-template-columns:repeat(${weeks},1fr)">${cells}</div>
    <div class="hm-legend"><span>少</span><span class="hm-cell"></span><span class="hm-cell l1"></span><span class="hm-cell l2"></span><span class="hm-cell l3"></span><span class="hm-cell l4"></span><span>多</span></div>`;
}

/* ---------- 徽章 ---------- */
function badges(notes, projects) {
  const words = notes.reduce((a, n) => a + noteWordCount(n), 0);
  const avg = avgScore(notes);
  const streak = streakDays();
  const reviewCount = notes.filter((n) => n.aiReview).length;
  const anyDone = projects.some((p) => p.target > 0 && notesOf(p.id).length >= p.target);

  const list = [
    { icon: '起', title: '起笔', desc: '写下第一篇笔记', got: notes.length >= 1 },
    { icon: '三', title: '三日不断', desc: '连续 3 天落笔', got: streak >= 3 },
    { icon: '七', title: '七日成习', desc: '连续 7 天落笔', got: streak >= 7 },
    { icon: '十', title: '十篇', desc: '累计 10 篇笔记', got: notes.length >= 10 },
    { icon: '万', title: '万字', desc: '累计写下一万字', got: words >= 10000 },
    { icon: '批', title: '经得起批', desc: '复盘均分达到 75', got: avg != null && avg >= 75 },
    { icon: '复', title: '常复盘', desc: '完成 5 次 AI 复盘', got: reviewCount >= 5 },
    { icon: '成', title: '如期', desc: '完成一个项目的篇数目标', got: anyDone }
  ];

  return `<div class="badges">
    ${list.map((b) => `
      <div class="badge-item ${b.got ? '' : 'locked'}">
        <span class="badge-medal">${b.icon}</span>
        <span><b>${b.title}</b><span>${b.desc}</span></span>
      </div>`).join('')}
  </div>`;
}

export async function render(main) {
  const notes = allNotes();
  const projects = listProjects();
  const avg = avgScore(notes);
  const words = notes.reduce((a, n) => a + noteWordCount(n), 0);
  const streak = streakDays();
  const reviewed = notes.filter((n) => n.aiReview).length;
  const weekAgo = Date.now() - 7 * 86400000;
  const weekCount = notes.filter((n) => new Date(n.createdAt || n.updatedAt).getTime() >= weekAgo).length;

  main.innerHTML = `
    <header class="page-head">
      <div>
        <p class="eyebrow">数据只统计本机记录</p>
        <h1 class="page-title">统计</h1>
        <p class="page-sub">看趋势，不看数字本身。进步来自判断越来越具体。</p>
      </div>
    </header>

    <div class="stat-grid">
      <div class="stat"><div class="stat-num num">${notes.length}<small>篇</small></div><div class="stat-label">累计笔记 · 本周 +${weekCount}</div></div>
      <div class="stat"><div class="stat-num num">${words >= 10000 ? (words / 10000).toFixed(1) : words}<small>${words >= 10000 ? '万字' : '字'}</small></div><div class="stat-label">累计字数</div></div>
      <div class="stat ${avg != null ? 'up' : ''}"><div class="stat-num num">${avg != null ? avg : '—'}<small>${avg != null ? '分' : ''}</small></div><div class="stat-label">复盘均分 · ${reviewed} 次复盘</div></div>
      <div class="stat"><div class="stat-num num">${streak}<small>天</small></div><div class="stat-label">连续落笔</div></div>
    </div>

    <div class="chart-grid">
      <section class="card chart-card">
        <h3>分数走势</h3>
        <p class="sub">最近 24 次 AI 复盘 · 点击圆点看篇名</p>
        ${lineChart(notes)}
      </section>
      <section class="card chart-card">
        <h3>六维平均</h3>
        <p class="sub">所有复盘的平均水平</p>
        ${radarChart(notes)}
      </section>
    </div>

    <section class="card chart-card" style="margin-bottom:14px">
      <h3>项目进度</h3>
      <p class="sub">按目标篇数计算</p>
      ${projects.length ? `<div class="proj-progress">
        ${projects.map((p) => {
          const ns = notesOf(p.id);
          const pa = avgScore(ns);
          const ratio = p.target ? Math.min(100, Math.round((ns.length / p.target) * 100)) : 0;
          return `<div class="pp-row">
            <div>
              <div class="pp-top"><b>${esc(p.title)}</b><span>${p.target ? `${ns.length} / ${p.target} 篇 · ${ratio}%` : `${ns.length} 篇`}</span></div>
              <div class="pbar"><i style="width:${p.target ? ratio : 0}%"></i></div>
            </div>
            <div class="pp-score">${pa != null ? pa : '—'}<small>均分</small></div>
          </div>`;
        }).join('')}
      </div>` : '<p class="tiny muted">还没有项目。</p>'}
    </section>

    <div class="chart-grid">
      <section class="card chart-card">
        <h3>阅读节奏</h3>
        <p class="sub">最近 12 周，每一格是一天</p>
        ${heatmap(notes)}
      </section>
      <section class="card chart-card">
        <h3>徽章</h3>
        <p class="sub">达成后自动点亮</p>
        ${badges(notes, projects)}
      </section>
    </div>
  `;
}
