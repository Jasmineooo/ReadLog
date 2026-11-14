import { initStore, db, streakDays } from './store.js';
import { $, esc, icon, initLightbox, animateRings, toast } from './ui.js';
import * as dashboard from './views/dashboard.js';
import * as notesView from './views/notes.js';
import * as projectView from './views/project.js';
import * as noteView from './views/note.js';
import * as statsView from './views/stats.js';
import * as settingsView from './views/settings.js';

const NAV = [
  { hash: '#/', key: 'home', label: '阅览台', icon: 'home' },
  { hash: '#/notes', key: 'notes', label: '笔记', icon: 'note' },
  { hash: '#/stats', key: 'stats', label: '统计', icon: 'stats' },
  { hash: '#/settings', key: 'settings', label: '设置', icon: 'settings' }
];

function renderNav() {
  const nav = $('#nav');
  const active = currentKey();
  nav.innerHTML = NAV.map((item) => {
    const count = item.key === 'notes' && db.notes.length ? `<span class="nav-count">${db.notes.length}</span>` : '';
    return `<a class="nav-item ${active === item.key ? 'active' : ''}" href="${item.hash}">
      ${icon(item.icon)}<span>${item.label}</span>${count}
    </a>`;
  }).join('');
}

function renderStreak() {
  const el = $('#railStreak');
  if (!el) return;
  const n = streakDays();
  el.innerHTML = n > 0
    ? `已连续落笔 <b>${n}</b> 天`
    : `今天还没动笔`;
}

function currentKey() {
  const parts = parseHash();
  if (!parts.length) return 'home';
  if (parts[0] === 'project') return 'home';
  if (parts[0] === 'note') return parts[1] === 'new' ? 'home' : 'notes';
  if (parts[0] === 'notes') return 'notes';
  if (parts[0] === 'stats') return 'stats';
  if (parts[0] === 'settings') return 'settings';
  return '';
}

function parseHash() {
  const raw = location.hash.replace(/^#/, '').replace(/^\/+/, '');
  return raw.split('/').filter(Boolean).map(decodeURIComponent);
}

async function route() {
  const main = $('#main');
  const parts = parseHash();
  renderNav();
  renderStreak();
  try {
    if (!parts.length) {
      await dashboard.render(main);
    } else if (parts[0] === 'notes') {
      await notesView.render(main);
    } else if (parts[0] === 'stats') {
      await statsView.render(main);
    } else if (parts[0] === 'settings') {
      await settingsView.render(main);
    } else if (parts[0] === 'project' && parts[1]) {
      await projectView.render(main, parts[1]);
    } else if (parts[0] === 'note' && parts[1] === 'new' && parts[2]) {
      await noteView.render(main, null, parts[2]);
    } else if (parts[0] === 'note' && parts[1]) {
      await noteView.render(main, parts[1]);
    } else {
      main.innerHTML = `<div class="empty"><h4>页面不存在</h4><p>链接可能已经失效。</p><a class="btn btn-ghost" href="#/">回到阅览台</a></div>`;
    }
  } catch (err) {
    console.error(err);
    main.innerHTML = `<div class="empty"><h4>出了点问题</h4><p>${esc(err.message || '未知错误')}</p>
      <a class="btn btn-ghost" href="#/">回到阅览台</a></div>`;
  }
  animateRings(main);
  renderNav();
  renderStreak();
  window.scrollTo({ top: 0, behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' });
}

async function boot() {
  try {
    await initStore();
  } catch (e) {
    console.error(e);
    $('#main').innerHTML = `<div class="empty"><h4>无法打开本地数据库</h4>
      <p>请通过本地服务（双击 start.bat）打开本页面，而不是直接双击 index.html。浏览器在 file:// 下会禁用数据存储。</p></div>`;
    return;
  }
  initLightbox();
  window.addEventListener('hashchange', route);
  await route();
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      const btn = document.querySelector('[data-analyze]');
      if (btn) { e.preventDefault(); btn.click(); }
    }
  });
}

boot();

export { toast };
