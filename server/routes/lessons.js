import { Router } from 'express';
import { getDb, generateId, bumpActivity } from '../db.js';
import { mapLesson } from '../mappers.js';
import { recomputeMasteryForLesson, syncDerivedChecklist } from '../progress.js';
import {
  sortByCreatedAtAsc,
  sortByCreatedAtDesc,
  filterLessons,
  getAdjacentLessons,
  uniqueCategories,
  clampFraction,
} from '../../src/lib/utils.js';

const router = Router();

function allLessons() {
  const rows = getDb().prepare('SELECT * FROM lessons ORDER BY created_at DESC').all();
  return sortByCreatedAtDesc(rows.map(mapLesson));
}

router.get('/', (req, res) => {
  const { q, category, status } = req.query;
  const lessons = filterLessons(allLessons(), {
    query: q || '',
    category: category || 'all',
    status: status || 'all',
  });
  res.json(lessons);
});

router.get('/stats', (_req, res) => {
  const row = getDb().prepare(`
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END), 0) AS completed,
      COALESCE(SUM(CASE WHEN completed = 0 AND max_scroll_fraction > 0 THEN 1 ELSE 0 END), 0) AS inProgress,
      COALESCE(SUM(CASE WHEN bookmarked = 1 THEN 1 ELSE 0 END), 0) AS bookmarked
    FROM lessons
  `).get();
  res.json({
    ...row,
    percentComplete: row.total ? Math.round((row.completed / row.total) * 100) : 0,
  });
});

router.get('/categories', (_req, res) => {
  res.json(uniqueCategories(allLessons()));
});

router.get('/continue', (_req, res) => {
  const lesson = getDb().prepare(`
    SELECT id, title, excerpt, max_scroll_fraction
    FROM lessons
    WHERE completed = 0
    ORDER BY
      CASE WHEN last_opened_at IS NOT NULL AND last_opened_at != 0 THEN 0 ELSE 1 END,
      last_opened_at DESC,
      created_at ASC
    LIMIT 1
  `).get();
  res.json(lesson ? {
    id: lesson.id,
    title: lesson.title,
    excerpt: lesson.excerpt || '',
    maxScrollFraction: lesson.max_scroll_fraction || 0,
  } : null);
});

router.get('/recent', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 5, 50);
  const lessons = getDb().prepare(`
    SELECT id, title, category, last_opened_at
    FROM lessons
    WHERE last_opened_at IS NOT NULL AND last_opened_at != 0
    ORDER BY last_opened_at DESC
    LIMIT ?
  `).all(limit);
  res.json(lessons.map((lesson) => ({
    id: lesson.id,
    title: lesson.title,
    category: lesson.category,
    lastOpenedAt: lesson.last_opened_at,
  })));
});

router.get('/weeks/:week/package', (req, res) => {
  const week = Number(req.params.week);
  if (!Number.isInteger(week) || week < 1) return res.status(400).json({ error: 'Week must be a positive number.' });
  const lessons = allLessons().filter((lesson) => lesson.week === week).sort((a, b) => (a.day || 99) - (b.day || 99) || a.createdAt - b.createdAt);
  if (!lessons.length) return res.status(404).json({ error: `No lessons are assigned to Week ${week}.` });
  const title = `NEXUS Week ${week} Study Pack`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{max-width:900px;margin:40px auto;padding:0 24px;color:#202124;font:16px/1.6 system-ui,sans-serif}header{border-bottom:2px solid #e76f3c;margin-bottom:32px}article{margin:40px 0;page-break-after:always}h1{font-size:2.2rem}h2{color:#b64d21}img{max-width:100%}pre{overflow:auto;background:#f4f4f4;padding:16px}</style></head><body><header><h1>${title}</h1><p>${lessons.length} lesson${lessons.length === 1 ? '' : 's'} · packaged from your Library</p></header>${lessons.map((lesson) => `<article><p>Day ${lesson.day || 'unscheduled'} · ${lesson.category}</p><h2>${lesson.title}</h2>${lesson.html}</article>`).join('')}</body></html>`;
  res.setHeader('Content-Disposition', `attachment; filename="nexus-week-${week}-study-pack.html"`);
  res.type('html').send(html);
});

router.get('/:id/adjacent', (req, res) => {
  res.json(getAdjacentLessons(allLessons(), req.params.id));
});

router.get('/:id', (req, res) => {
  const row = getDb().prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'That lesson no longer exists.' });
  res.json(mapLesson(row));
});

router.post('/', (req, res) => {
  const data = req.body || {};
  if (!data.html || !String(data.html).trim()) {
    return res.status(400).json({ error: 'Lesson HTML is required.' });
  }
  const now = Date.now();
  const id = generateId('lsn');
  const record = {
    id,
    title: (data.title || 'Untitled lesson').trim(),
    category: data.category && String(data.category).trim() ? String(data.category).trim() : 'Uncategorized',
    excerpt: data.excerpt || '',
    word_count: data.wordCount || 0,
    reading_time_min: data.readingTimeMin || 1,
    has_code: data.hasCode ? 1 : 0,
    has_quiz: data.hasQuiz ? 1 : 0,
    source_file_name: data.sourceFileName || '',
    html: data.html,
    english_html: data.englishHtml || '',
    annotations: data.annotations || '',
    notes: '',
    completed: 0,
    bookmarked: 0,
    max_scroll_fraction: 0,
    last_scroll_fraction: 0,
    open_count: 0,
    last_opened_at: null,
    week: data.week ?? null,
    day: data.day ?? null,
    track: data.track || null,
    created_at: now,
    updated_at: now,
  };

  getDb().prepare(`
    INSERT INTO lessons (
      id, title, category, excerpt, word_count, reading_time_min, has_code, has_quiz,
      source_file_name, html, notes, annotations, completed, bookmarked, max_scroll_fraction, english_html,
      last_scroll_fraction, open_count, last_opened_at, week, day, track, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.id,
    record.title,
    record.category,
    record.excerpt,
    record.word_count,
    record.reading_time_min,
    record.has_code,
    record.has_quiz,
    record.source_file_name,
    record.html,
    record.notes,
    record.annotations,
    record.completed,
    record.bookmarked,
    record.max_scroll_fraction,
    record.english_html,
    record.last_scroll_fraction,
    record.open_count,
    record.last_opened_at,
    record.week,
    record.day,
    record.track,
    record.created_at,
    record.updated_at
  );

  ensureConceptFromCategory(record.category, id);
  recomputeMasteryForLesson(id);
  syncDerivedChecklist();

  res.status(201).json(mapLesson(record));
});

function ensureConceptFromCategory(category, lessonId) {
  if (!category || category === 'Uncategorized') return;
  const db = getDb();
  let concept = db.prepare('SELECT * FROM concepts WHERE name = ? COLLATE NOCASE').get(category);
  const now = Date.now();
  if (!concept) {
    const id = generateId('cpt');
    db.prepare(
      'INSERT INTO concepts (id, name, description, mastery, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)'
    ).run(id, category, `Concepts related to ${category}`, now, now);
    concept = { id };
  }
  db.prepare(
    'INSERT OR IGNORE INTO concept_lessons (concept_id, lesson_id) VALUES (?, ?)'
  ).run(concept.id, lessonId);
}

router.patch('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'That lesson no longer exists.' });

  const patch = req.body || {};
  const updated = {
    ...existing,
    title: patch.title !== undefined ? patch.title : existing.title,
    category: patch.category !== undefined ? patch.category : existing.category,
    excerpt: patch.excerpt !== undefined ? patch.excerpt : existing.excerpt,
    word_count: patch.wordCount !== undefined ? patch.wordCount : existing.word_count,
    reading_time_min: patch.readingTimeMin !== undefined ? patch.readingTimeMin : existing.reading_time_min,
    has_code: patch.hasCode !== undefined ? (patch.hasCode ? 1 : 0) : existing.has_code,
    has_quiz: patch.hasQuiz !== undefined ? (patch.hasQuiz ? 1 : 0) : existing.has_quiz,
    source_file_name: patch.sourceFileName !== undefined ? patch.sourceFileName : existing.source_file_name,
    html: patch.html !== undefined ? patch.html : existing.html,
    english_html: patch.englishHtml !== undefined ? patch.englishHtml : existing.english_html,
    annotations: patch.annotations !== undefined ? patch.annotations : existing.annotations,
    notes: patch.notes !== undefined ? patch.notes : existing.notes,
    completed: patch.completed !== undefined ? (patch.completed ? 1 : 0) : existing.completed,
    bookmarked: patch.bookmarked !== undefined ? (patch.bookmarked ? 1 : 0) : existing.bookmarked,
    max_scroll_fraction: patch.maxScrollFraction !== undefined ? patch.maxScrollFraction : existing.max_scroll_fraction,
    last_scroll_fraction: patch.lastScrollFraction !== undefined ? patch.lastScrollFraction : existing.last_scroll_fraction,
    open_count: patch.openCount !== undefined ? patch.openCount : existing.open_count,
    last_opened_at: patch.lastOpenedAt !== undefined ? patch.lastOpenedAt : existing.last_opened_at,
    week: patch.week !== undefined ? patch.week : existing.week,
    day: patch.day !== undefined ? patch.day : existing.day,
    track: patch.track !== undefined ? patch.track : existing.track,
    updated_at: Date.now(),
  };

  db.prepare(`
    UPDATE lessons SET
      title=?, category=?, excerpt=?, word_count=?,
      reading_time_min=?, has_code=?, has_quiz=?,
      source_file_name=?, html=?, notes=?, annotations=?, english_html=?, completed=?,
      bookmarked=?, max_scroll_fraction=?,
      last_scroll_fraction=?, open_count=?,
      last_opened_at=?, week=?, day=?, track=?, updated_at=?
    WHERE id=?
  `).run(
    updated.title, updated.category, updated.excerpt, updated.word_count,
    updated.reading_time_min, updated.has_code, updated.has_quiz,
    updated.source_file_name, updated.html, updated.notes, updated.annotations, updated.english_html, updated.completed,
    updated.bookmarked, updated.max_scroll_fraction,
    updated.last_scroll_fraction, updated.open_count,
    updated.last_opened_at, updated.week, updated.day, updated.track, updated.updated_at,
    updated.id
  );

  recomputeMasteryForLesson(updated.id);
  syncDerivedChecklist();
  res.json(mapLesson(updated));
});

router.post('/:id/open', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'That lesson no longer exists.' });
  const updated = {
    ...existing,
    open_count: (existing.open_count || 0) + 1,
    last_opened_at: Date.now(),
    updated_at: Date.now(),
  };
  db.prepare(
    'UPDATE lessons SET open_count=?, last_opened_at=?, updated_at=? WHERE id=?'
  ).run(updated.open_count, updated.last_opened_at, updated.updated_at, updated.id);
  bumpActivity(1, 0);
  res.json(mapLesson(updated));
});

router.post('/:id/scroll', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'That lesson no longer exists.' });
  const fraction = clampFraction(Number(req.body?.fraction) || 0);
  const updated = {
    ...existing,
    last_scroll_fraction: fraction,
    max_scroll_fraction: Math.max(existing.max_scroll_fraction || 0, fraction),
    updated_at: Date.now(),
  };
  db.prepare(
    'UPDATE lessons SET last_scroll_fraction=?, max_scroll_fraction=?, updated_at=? WHERE id=?'
  ).run(updated.last_scroll_fraction, updated.max_scroll_fraction, updated.updated_at, updated.id);
  recomputeMasteryForLesson(updated.id);
  res.json(mapLesson(updated));
});

router.post('/:id/toggle-completed', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'That lesson no longer exists.' });
  const updated = { ...existing, completed: existing.completed ? 0 : 1, updated_at: Date.now() };
  db.prepare('UPDATE lessons SET completed=?, updated_at=? WHERE id=?').run(
    updated.completed, updated.updated_at, updated.id
  );
  bumpActivity(0, 5);
  recomputeMasteryForLesson(updated.id);
  syncDerivedChecklist();
  res.json(mapLesson(updated));
});

router.post('/:id/toggle-bookmarked', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'That lesson no longer exists.' });
  const updated = { ...existing, bookmarked: existing.bookmarked ? 0 : 1, updated_at: Date.now() };
  db.prepare('UPDATE lessons SET bookmarked=?, updated_at=? WHERE id=?').run(
    updated.bookmarked, updated.updated_at, updated.id
  );
  res.json(mapLesson(updated));
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM lessons WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'That lesson no longer exists.' });
  db.prepare('DELETE FROM concept_lessons WHERE lesson_id = ?').run(req.params.id);
  db.prepare('DELETE FROM lessons WHERE id = ?').run(req.params.id);
  syncDerivedChecklist();
  res.status(204).end();
});

export default router;
