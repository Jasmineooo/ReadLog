/** 通用 UI 工具 */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export function icon(name, cls = '') {
  return `<span class="i i-${name} ${cls}"></span>`;
}

export function debounce(fn, ms = 400) {
  let timer = 0;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/* ---------------- 日期 ---------------- */

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function weekdayCN(d = new Date()) {
  return WEEK[d.getDay()];
}

export function fmtDate(input, opt = {}) {
  if (!input) return '';
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const now = new Date();
  const sameYear = y === now.getFullYear();
  const md = `${m} 月 ${day} 日`;
  if (opt.week) return `${sameYear ? '' : y + ' 年 '}${md} · ${WEEK[d.getDay()]}`;
  if (opt.short) return `${m}/${day}`;
  if (opt.full) return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return sameYear ? md : `${y} 年 ${md}`;
}

export function dateKey(input) {
  const d = input instanceof Date ? input : new Date(input);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function relativeDay(input) {
  if (!input) return '';
  const d = new Date(input);
  const today = new Date();
  const a = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((a - b) / 86400000);
  if (diff === 0) return '今天';
  if (diff === 1) return '昨天';
  if (diff < 7) return `${diff} 天前`;
  return fmtDate(d);
}

/* ---------------- 提示 ---------------- */

export function toast(message, type = '', ms = 2600) {
  const wrap = document.getElementById('toastWrap');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .25s ease, transform .25s ease';
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    setTimeout(() => el.remove(), 260);
  }, ms);
}

/* ---------------- 弹窗 ---------------- */

let activeModal = null;

export function closeModal() {
  if (activeModal) {
    const m = activeModal;
    activeModal = null;
    m.wrap.remove();
    document.removeEventListener('keydown', m.onKey);
    if (m.onClose) m.onClose();
  }
}

export function openModal({ title, sub = '', body = '', foot = '', width = 620, onMount, onClose }) {
  closeModal();
  const root = document.getElementById('modalRoot');
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `
    <div class="modal" style="max-width:${width}px" role="dialog" aria-modal="true">
      <div class="modal-head">
        <div>
          <h3>${esc(title)}</h3>
          ${sub ? `<p>${esc(sub)}</p>` : ''}
        </div>
        <button class="modal-close" type="button" aria-label="关闭">×</button>
      </div>
      <div class="modal-body">${body}</div>
      ${foot ? `<div class="modal-foot">${foot}</div>` : ''}
    </div>`;
  root.appendChild(wrap);

  const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
  document.addEventListener('keydown', onKey);

  activeModal = {
    wrap,
    onKey,
    onClose,
    close: () => {
      wrap.remove();
      activeModal = null;
      document.removeEventListener('keydown', onKey);
      if (onClose) onClose();
    }
  };

  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) activeModal && activeModal.close();
  });
  wrap.querySelector('.modal-close').addEventListener('click', () => activeModal && activeModal.close());

  const el = wrap.querySelector('.modal');
  if (onMount) onMount(el, () => activeModal && activeModal.close());
  setTimeout(() => {
    const first = el.querySelector('input, textarea, select');
    if (first) first.focus();
  }, 60);
  return { el, close: () => activeModal && activeModal.close() };
}

export function confirmDialog({ title = '确认一下', message = '', confirmText = '确定', danger = false }) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    const m = openModal({
      title,
      width: 440,
      body: `<p style="font-size:13px;color:var(--ink-2);line-height:1.9">${esc(message)}</p>`,
      foot: `<button class="btn btn-ghost" data-no type="button">取消</button>
             <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes type="button">${esc(confirmText)}</button>`,
      onClose: () => done(false)
    });
    m.el.querySelector('[data-no]').addEventListener('click', () => { done(false); m.close(); });
    m.el.querySelector('[data-yes]').addEventListener('click', () => { done(true); m.close(); });
  });
}

/* ---------------- 灯箱 ---------------- */

export function initLightbox() {
  const box = document.getElementById('lightbox');
  if (!box) return;
  box.addEventListener('click', () => { box.hidden = true; box.querySelector('img').src = ''; });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !box.hidden) box.hidden = true;
  });
}

export function showImage(src) {
  const box = document.getElementById('lightbox');
  if (!box) return;
  box.querySelector('img').src = src;
  box.hidden = false;
}

/* ---------------- 图片压缩 ---------------- */

export function compressImage(file, maxW = 1500, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { reject(new Error('请选择图片文件')); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const scale = Math.min(1, maxW / w);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('图片解析失败'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

/* ---------------- 评分 ---------------- */

export function gradeOf(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return '未评';
  if (n >= 85) return '洞见';
  if (n >= 70) return '扎实';
  if (n >= 55) return '成形';
  return '摘抄';
}

export function scoreClass(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return 'none';
  if (n >= 75) return 'hi';
  if (n >= 58) return 'mid';
  return '';
}

export function ring(score, size = 116, stroke = 8, caption = '综合') {
  const has = Number.isFinite(Number(score));
  const val = has ? clamp(Math.round(Number(score)), 0, 100) : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const target = c * (1 - val / 100);
  return `
    <div class="ring-wrap" style="width:${size}px;height:${size}px">
      <svg class="ring-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/>
        <circle class="ring-val" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"
          stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${c.toFixed(1)}"
          data-target="${target.toFixed(1)}"/>
      </svg>
      <div class="ring-center">
        <div class="ring-num">${has ? val : '—'}<small>${has ? '分' : ''}</small></div>
        <div class="ring-cap">${esc(caption)}</div>
      </div>
    </div>`;
}

export function animateRings(root = document) {
  requestAnimationFrame(() => {
    $$('.ring-val', root).forEach((el) => {
      const t = el.getAttribute('data-target');
      if (t != null) el.style.strokeDashoffset = t;
    });
  });
}

/* ---------------- 空状态 ---------------- */

export function emptyState({ title, desc = '', action = '' }) {
  return `
    <div class="empty">
      <img src="icons/icon-empty.svg" alt="">
      <h4>${esc(title)}</h4>
      ${desc ? `<p>${esc(desc)}</p>` : ''}
      ${action}
    </div>`;
}

export function splitTags(input) {
  return String(input || '')
    .split(/[,，、;；\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
