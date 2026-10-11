import { api } from './api.js';

// Client for the offline Node + SQLite backend. All lesson persistence goes
// through HTTP to the local server — the SQLite file lives in /data/nexus.db.

export async function listLessons() {
  return api.get('/lessons');
}

export async function getLesson(id) {
  try {
    return await api.get(`/lessons/${id}`);
  } catch {
    return null;
  }
}

export async function searchLessons(filters = {}) {
  const params = new URLSearchParams();
  if (filters.query) params.set('q', filters.query);
  if (filters.category) params.set('category', filters.category);
  if (filters.status) params.set('status', filters.status);
  const qs = params.toString();
  return api.get(`/lessons${qs ? `?${qs}` : ''}`);
}

export async function getStats() {
  return api.get('/lessons/stats');
}

export async function getRecentlyOpened(limit = 5) {
  return api.get(`/lessons/recent?limit=${limit}`);
}

export async function getContinueLesson() {
  return api.get('/lessons/continue');
}

export async function getAdjacent(id) {
  return api.get(`/lessons/${id}/adjacent`);
}

export async function downloadWeekPackage(week) {
  const base = import.meta.env.VITE_API_BASE || '/api';
  const response = await fetch(`${base}/lessons/weeks/${encodeURIComponent(week)}/package`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Package download failed (${response.status})`);
  }
  return response.blob();
}

export async function listCategories() {
  return api.get('/lessons/categories');
}

export async function createLesson(data) {
  return api.post('/lessons', data);
}

export async function updateLesson(id, patch) {
  return api.patch(`/lessons/${id}`, patch);
}

export async function deleteLesson(id) {
  return api.delete(`/lessons/${id}`);
}

export async function toggleCompleted(id) {
  return api.post(`/lessons/${id}/toggle-completed`);
}

export async function toggleBookmarked(id) {
  return api.post(`/lessons/${id}/toggle-bookmarked`);
}

export async function recordOpen(id) {
  return api.post(`/lessons/${id}/open`);
}

export async function recordScrollProgress(id, fraction) {
  return api.post(`/lessons/${id}/scroll`, { fraction });
}

export async function saveNotes(id, notes) {
  return updateLesson(id, { notes });
}
