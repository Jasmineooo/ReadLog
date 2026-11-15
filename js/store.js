/** 数据层：IndexedDB 持久化 + 内存缓存 */

const DB_NAME = 'yebian-db';
const DB_VER = 1;
const SETTINGS_KEY = 'yebian.settings.v1';

let _db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('notes')) db.createObjectStore('notes', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(storeName, mode, fn) {
  return new Promise((resolve, reject) => {
    if (!_db) { reject(new Error('数据库未就绪')); return; }
    const t = _db.transaction(storeName, mode);
    const store = t.objectStore(storeName);
    let result;
    try {
      result = fn(store);
    } catch (e) {
      reject(e);
      return;
    }
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

function getAll(storeName) {
  return new Promise((resolve, reject) => {
    const t = _db.transaction(storeName, 'readonly');
    const req = t.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export const db = {
  projects: [],
  notes: []
};

export async function initStore() {
  _db = await openDB();
  const [projects, notes] = await Promise.all([getAll('projects'), getAll('notes')]);
  db.projects = projects;
  db.notes = notes;
  return db;
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function nowISO() {
  return new Date().toISOString();
}

/* ---------------- 项目 ---------------- */

export function getProject(id) {
  return db.projects.find((p) => p.id === id) || null;
}

export function listProjects() {
  return db.projects.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export async function saveProject(project) {
  project.updatedAt = nowISO();
  const i = db.projects.findIndex((p) => p.id === project.id);
  if (i >= 0) db.projects[i] = project;
  else db.projects.push(project);
  await tx('projects', 'readwrite', (s) => s.put(project));
  return project;
}

export async function deleteProject(id) {
  const notes = db.notes.filter((n) => n.projectId === id);
  for (const n of notes) await tx('notes', 'readwrite', (s) => s.delete(n.id));
  db.notes = db.notes.filter((n) => n.projectId !== id);
  db.projects = db.projects.filter((p) => p.id !== id);
  await tx('projects', 'readwrite', (s) => s.delete(id));
}

/* ---------------- 笔记 ---------------- */

export function getNote(id) {
  return db.notes.find((n) => n.id === id) || null;
}

export function notesOf(projectId) {
  return db.notes
    .filter((n) => n.projectId === projectId)
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export function allNotes() {
  return db.notes.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export async function saveNote(note) {
  note.updatedAt = nowISO();
  const i = db.notes.findIndex((n) => n.id === note.id);
  if (i >= 0) db.notes[i] = note;
  else db.notes.push(note);
  await tx('notes', 'readwrite', (s) => s.put(note));
  return note;
}

export async function deleteNote(id) {
  db.notes = db.notes.filter((n) => n.id !== id);
  await tx('notes', 'readwrite', (s) => s.delete(id));
}

/* ---------------- 设置 ---------------- */

export const DEFAULT_SETTINGS = {
  preset: 'deepseek',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-flash',
  apiKey: ''
};

export function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return { ...DEFAULT_SETTINGS, ...raw };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

/* ---------------- 备份 ---------------- */

export function buildBackup() {
  return {
    app: '页边',
    version: 1,
    exportedAt: nowISO(),
    projects: db.projects,
    notes: db.notes
  };
}

export async function restoreBackup(data, mode = 'replace') {
  if (!data || !Array.isArray(data.projects) || !Array.isArray(data.notes)) {
    throw new Error('文件格式不正确：缺少 projects / notes');
  }
  if (mode === 'replace') {
    for (const p of db.projects) await tx('projects', 'readwrite', (s) => s.delete(p.id));
    for (const n of db.notes) await tx('notes', 'readwrite', (s) => s.delete(n.id));
    db.projects = [];
    db.notes = [];
  }
  for (const p of data.projects) {
    if (!p || !p.id) continue;
    const i = db.projects.findIndex((x) => x.id === p.id);
    if (i >= 0) db.projects[i] = p; else db.projects.push(p);
    await tx('projects', 'readwrite', (s) => s.put(p));
  }
  for (const n of data.notes) {
    if (!n || !n.id) continue;
    const i = db.notes.findIndex((x) => x.id === n.id);
    if (i >= 0) db.notes[i] = n; else db.notes.push(n);
    await tx('notes', 'readwrite', (s) => s.put(n));
  }
  return { projects: data.projects.length, notes: data.notes.length };
}

export async function clearAllData() {
  for (const p of db.projects) await tx('projects', 'readwrite', (s) => s.delete(p.id));
  for (const n of db.notes) await tx('notes', 'readwrite', (s) => s.delete(n.id));
  db.projects = [];
  db.notes = [];
}

/* ---------------- 统计辅助 ---------------- */

export function reviewedNotes() {
  return allNotes().filter((n) => n.aiReview && typeof n.aiReview.score === 'number');
}

export function avgScore(notes) {
  const list = (notes || []).filter((n) => n.aiReview && typeof n.aiReview.score === 'number');
  if (!list.length) return null;
  return Math.round(list.reduce((a, n) => a + n.aiReview.score, 0) / list.length);
}

export function activeDays() {
  const set = new Set();
  db.notes.forEach((n) => {
    const d = new Date(n.createdAt || n.updatedAt || Date.now());
    set.add(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
  });
  return set;
}

export function streakDays() {
  const set = activeDays();
  const dayKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const today = new Date();
  let cursor = new Date(today);
  if (!set.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!set.has(dayKey(cursor))) return 0;
  }
  let count = 0;
  while (set.has(dayKey(cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}
