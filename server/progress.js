import { getDb, generateId } from './db.js';
import { mapLesson, mapConcept } from './mappers.js';
import { computeStats } from '../src/lib/utils.js';

export function conceptComputedMastery(conceptId) {
  const db = getDb();
  const links = db.prepare('SELECT lesson_id FROM concept_lessons WHERE concept_id = ?').all(conceptId);
  if (!links.length) return 0;
  let total = 0;
  for (const link of links) {
    const lesson = db.prepare('SELECT completed, max_scroll_fraction FROM lessons WHERE id = ?').get(link.lesson_id);
    if (!lesson) continue;
    total += lesson.completed ? 100 : Math.round((lesson.max_scroll_fraction || 0) * 100);
  }
  return Math.round(total / links.length);
}

export function withComputedMastery(conceptRow) {
  const mapped = mapConcept(conceptRow);
  const computed = conceptComputedMastery(conceptRow.id);
  return { ...mapped, computedMastery: computed, mastery: computed };
}

export function recomputeAndStoreConceptMastery(conceptId) {
  const mastery = conceptComputedMastery(conceptId);
  getDb().prepare('UPDATE concepts SET mastery=?, updated_at=? WHERE id=?').run(mastery, Date.now(), conceptId);
  return mastery;
}

export function recomputeMasteryForLesson(lessonId) {
  const links = getDb().prepare('SELECT concept_id FROM concept_lessons WHERE lesson_id = ?').all(lessonId);
  for (const link of links) recomputeAndStoreConceptMastery(link.concept_id);
}

export function logPractice({ kind, payload = '', score = 0, total = 0 }) {
  const id = generateId('pra');
  getDb().prepare(
    'INSERT INTO practice_log (id, kind, payload, score, total, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, kind, typeof payload === 'string' ? payload : JSON.stringify(payload), score, total, Date.now());
  syncDerivedChecklist();
  return id;
}

export function listPractice(kind) {
  const sql = kind
    ? 'SELECT * FROM practice_log WHERE kind = ? ORDER BY created_at DESC LIMIT 50'
    : 'SELECT * FROM practice_log ORDER BY created_at DESC LIMIT 50';
  return kind ? getDb().prepare(sql).all(kind) : getDb().prepare(sql).all();
}

export function syncDerivedChecklist() {
  const db = getDb();
  const lessons = db.prepare('SELECT * FROM lessons').all().map(mapLesson);
  const stats = computeStats(lessons);
  const showcaseOrDone = db.prepare(
    "SELECT COUNT(*) AS c FROM projects WHERE status IN ('showcase', 'done', 'capstone')"
  ).get().c;
  const interviewPractice = db.prepare(
    "SELECT COUNT(*) AS c FROM practice_log WHERE kind IN ('exam', 'interview')"
  ).get().c;
  const challengePractice = db.prepare(
    "SELECT COUNT(*) AS c FROM practice_log WHERE kind = 'challenge'"
  ).get().c;
  const cardsReviewed = db.prepare(
    'SELECT COUNT(*) AS c FROM flashcards WHERE ease > 0'
  ).get().c;
  const architectureNotes = db.prepare(
    "SELECT COUNT(*) AS c FROM projects WHERE architecture IS NOT NULL AND trim(architecture) != ''"
  ).get().c;

  const flags = {
    check_lessons: stats.percentComplete >= 80,
    check_portfolio: showcaseOrDone > 0,
    check_interview: interviewPractice >= 5,
    check_algorithms: cardsReviewed >= 10 || challengePractice >= 10,
    check_system_design: architectureNotes >= 3,
  };

  const upsert = db.prepare('UPDATE checklist_items SET done=? WHERE id=?');
  for (const [id, done] of Object.entries(flags)) {
    upsert.run(done ? 1 : 0, id);
  }

  return flags;
}
