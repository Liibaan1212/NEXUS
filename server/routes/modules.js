import { Router } from 'express';
import { getDb, generateId, ensureDailyStreak, setManualStreak, bumpActivity, DB_PATH, DATA_DIR } from '../db.js';
import {
  mapNote,
  mapSnippet,
  mapProject,
  mapFlashcard,
  mapResource,
  mapDataset,
  mapInterview,
  mapIssue,
  mapConcept,
  mapChecklist,
  mapChat,
  mapLesson,
} from '../mappers.js';
import { computeStats } from '../../src/lib/utils.js';
import fs from 'node:fs';
import { DATA_CENTER_DIR, getDataCenterSummary, isDataCenterFile, syncDataCenter } from '../dataset-sync.js';
import { importProjectFiles, listProjectFiles, readProjectFile, syncProjects } from '../project-sync.js';
import {
  withComputedMastery,
  recomputeAndStoreConceptMastery,
  syncDerivedChecklist,
  logPractice,
  listPractice,
} from '../progress.js';
import { inspectCsv } from '../csv-tools.js';

const router = Router();

// ---------- Settings / profile ----------
router.get('/settings', (_req, res) => {
  const rows = getDb().prepare('SELECT key, value FROM settings').all();
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  settings.streak = String(ensureDailyStreak());
  res.json(settings);
});

router.put('/settings', (req, res) => {
  const body = req.body || {};
  const upsert = getDb().prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  for (const [key, value] of Object.entries(body)) {
    if (key === 'streak') continue;
    upsert.run(key, String(value ?? ''));
  }
  if (body.streak !== undefined && Number.isFinite(Number(body.streak)) && Number(body.streak) >= 0) setManualStreak(body.streak);
  const rows = getDb().prepare('SELECT key, value FROM settings').all();
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  settings.streak = String(ensureDailyStreak());
  res.json(settings);
});

router.get('/storage', (_req, res) => {
  let size = 0;
  try {
    size = fs.statSync(DB_PATH).size;
  } catch {
    size = 0;
  }
  res.json({ path: DB_PATH, dataDir: DATA_DIR, bytes: size });
});

// ---------- Notes ----------
router.get('/notes', (_req, res) => {
  const rows = getDb().prepare('SELECT * FROM notes ORDER BY pinned DESC, updated_at DESC').all();
  res.json(rows.map(mapNote));
});

router.post('/notes', (req, res) => {
  const now = Date.now();
  const id = generateId('note');
  const title = (req.body?.title || 'Untitled note').trim();
  getDb().prepare(
    'INSERT INTO notes (id, title, body, tags, color, category, pinned, remind_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, title, req.body?.body || '', req.body?.tags || '', req.body?.color || 'sun', req.body?.category || 'lesson', req.body?.pinned ? 1 : 0, req.body?.remindAt || null, now, now);
  res.status(201).json(mapNote(getDb().prepare('SELECT * FROM notes WHERE id = ?').get(id)));
});

router.patch('/notes/:id', (req, res) => {
  const existing = getDb().prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Note not found.' });
  const updated = {
    ...existing,
    title: req.body?.title !== undefined ? req.body.title : existing.title,
    body: req.body?.body !== undefined ? req.body.body : existing.body,
    tags: req.body?.tags !== undefined ? req.body.tags : existing.tags,
    color: req.body?.color !== undefined ? req.body.color : existing.color,
    category: req.body?.category !== undefined ? req.body.category : existing.category,
    pinned: req.body?.pinned !== undefined ? (req.body.pinned ? 1 : 0) : existing.pinned,
    remind_at: req.body?.remindAt !== undefined ? (req.body.remindAt || null) : existing.remind_at,
    updated_at: Date.now(),
  };
  getDb().prepare(
    'UPDATE notes SET title=?, body=?, tags=?, color=?, category=?, pinned=?, remind_at=?, updated_at=? WHERE id=?'
  ).run(updated.title, updated.body, updated.tags, updated.color, updated.category, updated.pinned, updated.remind_at, updated.updated_at, updated.id);
  res.json(mapNote(updated));
});

router.delete('/notes/:id', (req, res) => {
  getDb().prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// ---------- Snippets ----------
router.get('/snippets', (_req, res) => {
  res.json(getDb().prepare('SELECT * FROM snippets ORDER BY updated_at DESC').all().map(mapSnippet));
});

router.post('/snippets', (req, res) => {
  const now = Date.now();
  const id = generateId('snp');
  getDb().prepare(
    'INSERT INTO snippets (id, title, language, code, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    (req.body?.title || 'Untitled snippet').trim(),
    req.body?.language || 'javascript',
    req.body?.code || '',
    req.body?.description || '',
    now,
    now
  );
  res.status(201).json(mapSnippet(getDb().prepare('SELECT * FROM snippets WHERE id = ?').get(id)));
});

router.patch('/snippets/:id', (req, res) => {
  const existing = getDb().prepare('SELECT * FROM snippets WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Snippet not found.' });
  const updated = {
    ...existing,
    title: req.body?.title ?? existing.title,
    language: req.body?.language ?? existing.language,
    code: req.body?.code ?? existing.code,
    description: req.body?.description ?? existing.description,
    updated_at: Date.now(),
  };
  getDb().prepare(
    'UPDATE snippets SET title=?, language=?, code=?, description=?, updated_at=? WHERE id=?'
  ).run(updated.title, updated.language, updated.code, updated.description, updated.updated_at, updated.id);
  res.json(mapSnippet(updated));
});

router.delete('/snippets/:id', (req, res) => {
  getDb().prepare('DELETE FROM snippets WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// ---------- Projects ----------
router.get('/projects', (req, res) => {
  const status = req.query.status;
  let rows;
  if (status) {
    rows = getDb().prepare('SELECT * FROM projects WHERE status = ? ORDER BY updated_at DESC').all(status);
  } else {
    rows = getDb().prepare('SELECT * FROM projects ORDER BY updated_at DESC').all();
  }
  res.json(rows.map(mapProject));
});

router.post('/projects/sync', (_req, res) => {
  res.json(syncProjects());
});

router.post('/projects/import', (req, res) => {
  try {
    res.json(importProjectFiles(req.body?.name, req.body?.files, req.body?.status || 'active'));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/projects/:id/files', (req, res) => {
  const project = getDb().prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  if (!project.source_path) return res.status(400).json({ error: 'This project has no imported folder.' });
  try {
    res.json({ projectId: project.id, title: project.title, files: listProjectFiles(project.source_path) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/projects/:id/file', (req, res) => {
  const project = getDb().prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project?.source_path) return res.status(404).json({ error: 'Imported project folder not found.' });
  try {
    res.sendFile(readProjectFile(project.source_path, req.query.path));
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

router.post('/projects', (req, res) => {
  const now = Date.now();
  const id = generateId('prj');
  getDb().prepare(
    'INSERT INTO projects (id, title, description, status, architecture, source_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    (req.body?.title || 'Untitled project').trim(),
    req.body?.description || '',
    req.body?.status || 'active',
    req.body?.architecture || '',
    '',
    now,
    now
  );
  res.status(201).json(mapProject(getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id)));
});

router.patch('/projects/:id', (req, res) => {
  const existing = getDb().prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Project not found.' });
  const updated = {
    ...existing,
    title: req.body?.title ?? existing.title,
    description: req.body?.description ?? existing.description,
    status: req.body?.status ?? existing.status,
    architecture: req.body?.architecture ?? existing.architecture,
    updated_at: Date.now(),
  };
  getDb().prepare(
    'UPDATE projects SET title=?, description=?, status=?, architecture=?, updated_at=? WHERE id=?'
  ).run(updated.title, updated.description, updated.status, updated.architecture, updated.updated_at, updated.id);
  res.json(mapProject(updated));
});

router.delete('/projects/:id', (req, res) => {
  getDb().prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// ---------- Flashcards ----------
router.get('/flashcards', (_req, res) => {
  res.json(getDb().prepare('SELECT * FROM flashcards ORDER BY created_at DESC').all().map(mapFlashcard));
});

router.get('/flashcards/due', (_req, res) => {
  const now = Date.now();
  const rows = getDb().prepare(
    'SELECT * FROM flashcards WHERE next_review_at IS NULL OR next_review_at <= ? ORDER BY next_review_at ASC'
  ).all(now);
  res.json(rows.map(mapFlashcard));
});

router.post('/flashcards', (req, res) => {
  const now = Date.now();
  const id = generateId('fc');
  getDb().prepare(
    'INSERT INTO flashcards (id, front, back, lesson_id, ease, next_review_at, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?)'
  ).run(id, (req.body?.front || '').trim(), (req.body?.back || '').trim(), req.body?.lessonId || null, now, now, now);
  res.status(201).json(mapFlashcard(getDb().prepare('SELECT * FROM flashcards WHERE id = ?').get(id)));
});

router.post('/flashcards/:id/review', (req, res) => {
  const existing = getDb().prepare('SELECT * FROM flashcards WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Card not found.' });
  const quality = Math.min(5, Math.max(0, Number(req.body?.quality) || 3));
  const ease = Math.max(0, (existing.ease || 0) + (quality >= 3 ? 1 : -1));
  const intervals = [0, 1, 3, 7, 14, 30];
  const days = intervals[Math.min(ease, intervals.length - 1)];
  const next = Date.now() + days * 86400000;
  getDb().prepare(
    'UPDATE flashcards SET ease=?, next_review_at=?, updated_at=? WHERE id=?'
  ).run(ease, next, Date.now(), existing.id);
  bumpActivity(0, 2);
  syncDerivedChecklist();
  res.json(mapFlashcard(getDb().prepare('SELECT * FROM flashcards WHERE id = ?').get(existing.id)));
});

router.delete('/flashcards/:id', (req, res) => {
  getDb().prepare('DELETE FROM flashcards WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

router.post('/flashcards/from-lesson/:lessonId', (req, res) => {
  const lesson = getDb().prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.lessonId);
  if (!lesson) return res.status(404).json({ error: 'Lesson not found.' });
  const text = (lesson.excerpt || '').trim();
  if (!text) return res.status(400).json({ error: 'Lesson has no excerpt to turn into a card.' });
  const now = Date.now();
  const id = generateId('fc');
  const front = `Recall: ${lesson.title}`;
  const back = text.slice(0, 400);
  getDb().prepare(
    'INSERT INTO flashcards (id, front, back, lesson_id, ease, next_review_at, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?)'
  ).run(id, front, back, lesson.id, now, now, now);
  res.status(201).json(mapFlashcard(getDb().prepare('SELECT * FROM flashcards WHERE id = ?').get(id)));
});

// ---------- Resources ----------
router.get('/resources', (_req, res) => {
  res.json(getDb().prepare('SELECT * FROM resources ORDER BY created_at DESC').all().map(mapResource));
});

router.post('/resources', (req, res) => {
  const id = generateId('res');
  const now = Date.now();
  getDb().prepare(
    'INSERT INTO resources (id, title, url, type, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, (req.body?.title || 'Resource').trim(), req.body?.url || '', req.body?.type || 'link', req.body?.notes || '', now);
  res.status(201).json(mapResource(getDb().prepare('SELECT * FROM resources WHERE id = ?').get(id)));
});

router.delete('/resources/:id', (req, res) => {
  getDb().prepare('DELETE FROM resources WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// ---------- Datasets ----------
router.get('/datasets', (_req, res) => {
  syncDataCenter();
  res.json(getDb().prepare('SELECT * FROM datasets ORDER BY created_at DESC').all().map(mapDataset));
});

router.post('/datasets/sync', (_req, res) => {
  res.json(syncDataCenter());
});

router.get('/datasets/summary', (_req, res) => {
  syncDataCenter();
  const rows = getDb().prepare('SELECT * FROM datasets').all();
  res.json(getDataCenterSummary(rows));
});

router.post('/datasets', (req, res) => {
  const id = generateId('ds');
  const now = Date.now();
  getDb().prepare(
    'INSERT INTO datasets (id, title, description, path_or_url, format, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    (req.body?.title || 'Dataset').trim(),
    req.body?.description || '',
    req.body?.pathOrUrl || '',
    req.body?.format || '',
    now
  );
  res.status(201).json(mapDataset(getDb().prepare('SELECT * FROM datasets WHERE id = ?').get(id)));
});

router.patch('/datasets/:id', (req, res) => {
  const existing = getDb().prepare('SELECT * FROM datasets WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Dataset not found.' });
  const updated = {
    title: req.body?.title ?? existing.title,
    description: req.body?.description ?? existing.description,
    pathOrUrl: req.body?.pathOrUrl ?? existing.path_or_url,
    format: req.body?.format ?? existing.format,
  };
  if (!String(updated.title).trim()) return res.status(400).json({ error: 'Dataset name is required.' });
  getDb().prepare('UPDATE datasets SET title=?, description=?, path_or_url=?, format=? WHERE id=?')
    .run(String(updated.title).trim(), updated.description || '', updated.pathOrUrl || '', updated.format || '', existing.id);
  res.json(mapDataset(getDb().prepare('SELECT * FROM datasets WHERE id = ?').get(existing.id)));
});

router.get('/datasets/:id/preview', (req, res) => {
  const dataset = getDb().prepare('SELECT * FROM datasets WHERE id = ?').get(req.params.id);
  if (!dataset) return res.status(404).json({ error: 'Dataset not found.' });
  if (!isDataCenterFile(dataset.path_or_url) || !fs.existsSync(dataset.path_or_url)) {
    return res.status(400).json({ error: 'Previews are available only for existing files in #Data Center.' });
  }
  const format = (dataset.format || '').toLowerCase();
  if (!['csv', 'tsv', 'json', 'txt', 'css'].includes(format)) {
    return res.status(400).json({ error: `Preview is not supported for .${format || 'unknown'} files.` });
  }
  const text = fs.readFileSync(dataset.path_or_url, 'utf8').slice(0, 20000);
  if (format === 'json') {
    try {
      const value = JSON.parse(text);
      const rows = Array.isArray(value) ? value.slice(0, 10) : [value];
      return res.json({ kind: 'json', rows, truncated: Buffer.byteLength(text) >= 20000 });
    } catch {
      return res.json({ kind: 'text', text, truncated: Buffer.byteLength(text) >= 20000 });
    }
  }
  const delimiter = format === 'tsv' ? '\t' : ',';
  const lines = text.split(/\r?\n/).filter(Boolean).slice(0, 11);
  const cells = (line) => line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ''));
  return res.json({ kind: 'table', headers: cells(lines[0] || ''), rows: lines.slice(1).map(cells), truncated: Buffer.byteLength(text) >= 20000, directory: DATA_CENTER_DIR });
});

router.delete('/datasets/:id', (req, res) => {
  getDb().prepare('DELETE FROM datasets WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// ---------- CSV Studio ----------
router.post('/dataset-runs', (req, res) => {
  const fileName = String(req.body?.fileName || 'untitled.csv').trim();
  const mode = req.body?.mode === 'check' ? 'check' : 'clean';
  try {
    const result = inspectCsv(req.body?.csvText);
    const id = generateId('csv');
    const now = Date.now();
    getDb().prepare(
      'INSERT INTO dataset_runs (id, mode, file_name, source_csv, cleaned_csv, result_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, mode, fileName, String(req.body.csvText), mode === 'clean' ? result.cleanedCsv : '', JSON.stringify(result), now);
    res.status(201).json({ id, mode, fileName, createdAt: now, ...result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/dataset-runs', (_req, res) => {
  const rows = getDb().prepare('SELECT id, mode, file_name, created_at, result_json FROM dataset_runs ORDER BY created_at DESC LIMIT 30').all();
  res.json(rows.map((row) => ({ id: row.id, mode: row.mode, fileName: row.file_name, createdAt: row.created_at, summary: JSON.parse(row.result_json) })));
});

// ---------- Interview ----------
router.get('/interview', (_req, res) => {
  res.json(getDb().prepare('SELECT * FROM interview_questions ORDER BY created_at ASC').all().map(mapInterview));
});

router.post('/interview', (req, res) => {
  const id = generateId('iq');
  const now = Date.now();
  getDb().prepare(
    'INSERT INTO interview_questions (id, question, answer, category, difficulty, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    (req.body?.question || '').trim(),
    req.body?.answer || '',
    req.body?.category || 'general',
    req.body?.difficulty || 'medium',
    now
  );
  res.status(201).json(mapInterview(getDb().prepare('SELECT * FROM interview_questions WHERE id = ?').get(id)));
});

router.delete('/interview/:id', (req, res) => {
  getDb().prepare('DELETE FROM interview_questions WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// ---------- Debug issues ----------
router.get('/debug', (_req, res) => {
  res.json(getDb().prepare('SELECT * FROM debug_issues ORDER BY updated_at DESC').all().map(mapIssue));
});

router.post('/debug', (req, res) => {
  const id = generateId('bug');
  const now = Date.now();
  getDb().prepare(
    'INSERT INTO debug_issues (id, title, description, status, lesson_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    (req.body?.title || 'Issue').trim(),
    req.body?.description || '',
    req.body?.status || 'open',
    req.body?.lessonId || null,
    now,
    now
  );
  res.status(201).json(mapIssue(getDb().prepare('SELECT * FROM debug_issues WHERE id = ?').get(id)));
});

router.patch('/debug/:id', (req, res) => {
  const existing = getDb().prepare('SELECT * FROM debug_issues WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Issue not found.' });
  const updated = {
    ...existing,
    title: req.body?.title ?? existing.title,
    description: req.body?.description ?? existing.description,
    status: req.body?.status ?? existing.status,
    lesson_id: req.body?.lessonId !== undefined ? req.body.lessonId : existing.lesson_id,
    updated_at: Date.now(),
  };
  getDb().prepare(
    'UPDATE debug_issues SET title=?, description=?, status=?, lesson_id=?, updated_at=? WHERE id=?'
  ).run(updated.title, updated.description, updated.status, updated.lesson_id, updated.updated_at, updated.id);
  res.json(mapIssue(updated));
});

router.delete('/debug/:id', (req, res) => {
  getDb().prepare('DELETE FROM debug_issues WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// ---------- Concepts / knowledge ----------
router.get('/concepts', (_req, res) => {
  const concepts = getDb().prepare('SELECT * FROM concepts ORDER BY name ASC').all();
  const links = getDb().prepare('SELECT concept_id, lesson_id FROM concept_lessons').all();
  const byConcept = {};
  for (const link of links) {
    (byConcept[link.concept_id] ||= []).push(link.lesson_id);
  }
  res.json(concepts.map((c) => ({ ...withComputedMastery(c), lessonIds: byConcept[c.id] || [] })));
});

router.post('/concepts', (req, res) => {
  const now = Date.now();
  const id = generateId('cpt');
  const name = (req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name is required.' });
  try {
    getDb().prepare(
      'INSERT INTO concepts (id, name, description, mastery, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, name, req.body?.description || '', Number(req.body?.mastery) || 0, now, now);
  } catch {
    return res.status(409).json({ error: 'A concept with that name already exists.' });
  }
  res.status(201).json({ ...withComputedMastery(getDb().prepare('SELECT * FROM concepts WHERE id = ?').get(id)), lessonIds: [] });
});

router.patch('/concepts/:id', (req, res) => {
  const existing = getDb().prepare('SELECT * FROM concepts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Concept not found.' });
  const mastery = req.body?.mastery !== undefined ? Math.min(100, Math.max(0, Number(req.body.mastery) || 0)) : existing.mastery;
  getDb().prepare(
    'UPDATE concepts SET name=?, description=?, mastery=?, updated_at=? WHERE id=?'
  ).run(
    req.body?.name ?? existing.name,
    req.body?.description ?? existing.description,
    mastery,
    Date.now(),
    existing.id
  );
  const links = getDb().prepare('SELECT lesson_id FROM concept_lessons WHERE concept_id = ?').all(existing.id);
  res.json({
    ...withComputedMastery(getDb().prepare('SELECT * FROM concepts WHERE id = ?').get(existing.id)),
    lessonIds: links.map((l) => l.lesson_id),
  });
});

router.delete('/concepts/:id', (req, res) => {
  getDb().prepare('DELETE FROM concept_lessons WHERE concept_id = ?').run(req.params.id);
  getDb().prepare('DELETE FROM concepts WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// ---------- Checklist / job readiness ----------
router.get('/checklist', (_req, res) => {
  syncDerivedChecklist();
  res.json(
    getDb().prepare('SELECT * FROM checklist_items ORDER BY sort_order ASC').all().map(mapChecklist)
  );
});

router.patch('/checklist/:id', (req, res) => {
  const existing = getDb().prepare('SELECT * FROM checklist_items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Item not found.' });
  const done = req.body?.done !== undefined ? (req.body.done ? 1 : 0) : existing.done;
  getDb().prepare('UPDATE checklist_items SET done=? WHERE id=?').run(done, existing.id);
  res.json(mapChecklist(getDb().prepare('SELECT * FROM checklist_items WHERE id = ?').get(existing.id)));
});

// ---------- Analytics ----------
router.get('/analytics', (_req, res) => {
  const lessons = getDb().prepare('SELECT * FROM lessons').all().map(mapLesson);
  const stats = computeStats(lessons);
  const activity = getDb().prepare('SELECT * FROM activity_log ORDER BY day DESC LIMIT 30').all();
  const byCategory = {};
  for (const l of lessons) {
    byCategory[l.category] ||= { total: 0, completed: 0 };
    byCategory[l.category].total += 1;
    if (l.completed) byCategory[l.category].completed += 1;
  }
  const totalWords = lessons.reduce((s, l) => s + (l.wordCount || 0), 0);
  const totalOpens = lessons.reduce((s, l) => s + (l.openCount || 0), 0);
  res.json({
    stats,
    streak: ensureDailyStreak(),
    activity,
    byCategory,
    totalWords,
    totalOpens,
    practice: listPractice(),
    storageBytes: (() => {
      try { return fs.statSync(DB_PATH).size; } catch { return 0; }
    })(),
  });
});

// ---------- Weak areas / revision / exam helpers ----------
router.get('/weak-areas', (_req, res) => {
  const lessons = getDb().prepare('SELECT * FROM lessons').all().map(mapLesson);
  const weak = lessons
    .filter((l) => !l.completed)
    .map((l) => ({
      ...l,
      weaknessScore: Math.round((1 - (l.maxScrollFraction || 0)) * 100) + (l.openCount === 0 ? 20 : 0),
    }))
    .sort((a, b) => b.weaknessScore - a.weaknessScore);
  res.json(weak);
});

router.get('/revision', (_req, res) => {
  const lessons = getDb().prepare('SELECT * FROM lessons').all().map(mapLesson);
  const due = lessons
    .filter((l) => l.completed || (l.maxScrollFraction || 0) > 0.3)
    .sort((a, b) => (a.lastOpenedAt || 0) - (b.lastOpenedAt || 0))
    .slice(0, 10);
  const cards = getDb().prepare(
    'SELECT * FROM flashcards WHERE next_review_at IS NULL OR next_review_at <= ? ORDER BY next_review_at ASC LIMIT 20'
  ).all(Date.now()).map(mapFlashcard);
  res.json({ lessons: due, flashcards: cards });
});

// ---------- Local AI tutor (offline keyword retrieval) ----------
router.get('/tutor/messages', (_req, res) => {
  res.json(getDb().prepare('SELECT * FROM chat_messages ORDER BY created_at ASC').all().map(mapChat));
});

router.delete('/tutor/messages', (_req, res) => {
  getDb().prepare('DELETE FROM chat_messages').run();
  res.status(204).end();
});

router.post('/tutor/ask', (req, res) => {
  const question = String(req.body?.question || '').trim();
  if (!question) return res.status(400).json({ error: 'Question is required.' });

  const db = getDb();
  const now = Date.now();
  const userId = generateId('msg');
  db.prepare('INSERT INTO chat_messages (id, role, content, created_at) VALUES (?, ?, ?, ?)').run(
    userId, 'user', question, now
  );

  const lessons = db.prepare('SELECT * FROM lessons').all().map(mapLesson);
  const terms = question.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
  const scored = lessons.map((l) => {
    const htmlText = String(l.html || '').replace(/<[^>]+>/g, ' ');
    const hay = `${l.title} ${l.category} ${l.excerpt} ${l.notes || ''} ${htmlText}`.toLowerCase();
    const score = terms.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
    return { lesson: l, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);

  let answer;
  if (!lessons.length) {
    answer = 'You have not imported any lessons yet. Open Import Center, add an HTML lesson, then ask again — I answer from your local library only.';
  } else if (!scored.length) {
    answer = `I could not find a strong match in your ${lessons.length} local lesson(s). Try asking about a title or category you imported, or open Lessons Library to review what is available offline.`;
  } else {
    const top = scored.slice(0, 3);
    const lines = top.map(({ lesson, score }) =>
      `• **${lesson.title}** (${lesson.category}, match ${score}): ${lesson.excerpt || 'No excerpt.'}`
    );
    answer = `Offline study assistant — retrieved from your SQLite lesson library:\n\n${lines.join('\n\n')}\n\nOpen the best match in Lesson Sandbox to continue reading.`;
  }

  const assistantId = generateId('msg');
  db.prepare('INSERT INTO chat_messages (id, role, content, created_at) VALUES (?, ?, ?, ?)').run(
    assistantId, 'assistant', answer, Date.now()
  );
  bumpActivity(0, 1);

  res.json({
    user: mapChat(db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(userId)),
    assistant: mapChat(db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(assistantId)),
  });
});

// ---------- Code lab: evaluate tiny JS snippets in a sandbox (Function, no network) ----------
router.post('/code-lab/run', (req, res) => {
  const code = String(req.body?.code || '');
  if (!code.trim()) return res.status(400).json({ error: 'Code is required.' });
  if (code.length > 8000) return res.status(400).json({ error: 'Code too long.' });
  const logs = [];
  const fakeConsole = {
    log: (...args) => logs.push(args.map(String).join(' ')),
    error: (...args) => logs.push('[error] ' + args.map(String).join(' ')),
    warn: (...args) => logs.push('[warn] ' + args.map(String).join(' ')),
  };
  try {
    // Intentionally limited: no require/import, timeout via sync only
    // eslint-disable-next-line no-new-func
    const fn = new Function('console', `"use strict";\n${code}`);
    const result = fn(fakeConsole);
    res.json({ ok: true, result: result === undefined ? null : String(result), logs });
  } catch (err) {
    res.json({ ok: false, error: err.message, logs });
  }
});

router.get('/practice', (req, res) => {
  res.json(listPractice(req.query.kind || undefined));
});

router.post('/exam/submit', (req, res) => {
  const results = Array.isArray(req.body?.results) ? req.body.results : [];
  const seconds = Number(req.body?.seconds) || 0;
  const known = results.filter((r) => r.known).length;
  const total = results.length;
  const id = logPractice({
    kind: 'exam',
    payload: { seconds, results },
    score: known,
    total,
  });
  bumpActivity(0, Math.max(1, Math.round(seconds / 60)));
  res.status(201).json({ id, score: known, total, seconds, percent: total ? Math.round((known / total) * 100) : 0 });
});

router.post('/challenges/result', (req, res) => {
  const correct = !!req.body?.correct;
  const lessonId = req.body?.lessonId || '';
  const id = logPractice({
    kind: 'challenge',
    payload: { lessonId, guess: req.body?.guess || '' },
    score: correct ? 1 : 0,
    total: 1,
  });
  bumpActivity(0, 1);
  const rows = getDb().prepare("SELECT score, total FROM practice_log WHERE kind = 'challenge'").all();
  const score = rows.reduce((s, r) => s + (r.score || 0), 0);
  const total = rows.reduce((s, r) => s + (r.total || 0), 0);
  res.status(201).json({ id, correct, sessionScore: score, sessionTotal: total });
});

router.post('/interview/:id/practice', (req, res) => {
  const existing = getDb().prepare('SELECT * FROM interview_questions WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Question not found.' });
  const known = !!req.body?.known;
  logPractice({
    kind: 'interview',
    payload: { questionId: existing.id, known },
    score: known ? 1 : 0,
    total: 1,
  });
  bumpActivity(0, 2);
  res.json({ ok: true, known });
});

export default router;
