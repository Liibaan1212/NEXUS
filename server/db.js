import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(__dirname, '..', 'data');
export const DB_PATH = path.join(DATA_DIR, 'nexus.db');

let db;

export function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

export function initDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS lessons (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Uncategorized',
      excerpt TEXT DEFAULT '',
      word_count INTEGER DEFAULT 0,
      reading_time_min INTEGER DEFAULT 1,
      has_code INTEGER DEFAULT 0,
      has_quiz INTEGER DEFAULT 0,
      source_file_name TEXT DEFAULT '',
      html TEXT NOT NULL,
      english_html TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      completed INTEGER DEFAULT 0,
      bookmarked INTEGER DEFAULT 0,
      max_scroll_fraction REAL DEFAULT 0,
      last_scroll_fraction REAL DEFAULT 0,
      open_count INTEGER DEFAULT 0,
      last_opened_at INTEGER,
      week INTEGER,
      day INTEGER,
      track TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      file_path TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Unsorted',
      tags TEXT NOT NULL DEFAULT '[]',
      notes TEXT NOT NULL DEFAULT '',
      duration REAL NOT NULL DEFAULT 0,
      position REAL NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      favorite INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_videos_created ON videos(created_at);
    CREATE INDEX IF NOT EXISTS idx_videos_category ON videos(category);

    CREATE INDEX IF NOT EXISTS idx_lessons_created ON lessons(created_at);
    CREATE INDEX IF NOT EXISTS idx_lessons_category ON lessons(category);
    CREATE INDEX IF NOT EXISTS idx_lessons_last_opened ON lessons(last_opened_at);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT DEFAULT '',
      tags TEXT DEFAULT '',
      color TEXT DEFAULT 'sun',
      category TEXT DEFAULT 'lesson',
      pinned INTEGER DEFAULT 0,
      remind_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS snippets (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      language TEXT DEFAULT 'javascript',
      code TEXT DEFAULT '',
      description TEXT DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      architecture TEXT DEFAULT '',
      source_path TEXT DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS flashcards (
      id TEXT PRIMARY KEY,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      lesson_id TEXT,
      ease INTEGER DEFAULT 0,
      next_review_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS resources (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      url TEXT DEFAULT '',
      type TEXT DEFAULT 'link',
      notes TEXT DEFAULT '',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS datasets (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      path_or_url TEXT DEFAULT '',
      format TEXT DEFAULT '',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS interview_questions (
      id TEXT PRIMARY KEY,
      question TEXT NOT NULL,
      answer TEXT DEFAULT '',
      category TEXT DEFAULT 'general',
      difficulty TEXT DEFAULT 'medium',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS debug_issues (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'open',
      lesson_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS concepts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      mastery INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS concept_lessons (
      concept_id TEXT NOT NULL,
      lesson_id TEXT NOT NULL,
      PRIMARY KEY (concept_id, lesson_id)
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      day TEXT PRIMARY KEY,
      opens INTEGER DEFAULT 0,
      minutes_estimate INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS checklist_items (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      done INTEGER DEFAULT 0,
      category TEXT DEFAULT 'general',
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS practice_log (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      payload TEXT DEFAULT '',
      score INTEGER DEFAULT 0,
      total INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_practice_kind ON practice_log(kind, created_at);

    CREATE TABLE IF NOT EXISTS dataset_runs (
      id TEXT PRIMARY KEY,
      mode TEXT NOT NULL,
      file_name TEXT NOT NULL,
      source_csv TEXT NOT NULL,
      cleaned_csv TEXT DEFAULT '',
      result_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_dataset_runs_created ON dataset_runs(created_at);
  `);

  const projectColumns = db.prepare('PRAGMA table_info(projects)').all().map((column) => column.name);
  if (!projectColumns.includes('source_path')) db.exec("ALTER TABLE projects ADD COLUMN source_path TEXT DEFAULT ''");
  const lessonColumns = db.prepare('PRAGMA table_info(lessons)').all().map((column) => column.name);
  if (!lessonColumns.includes('english_html')) db.exec("ALTER TABLE lessons ADD COLUMN english_html TEXT DEFAULT ''");
  if (!lessonColumns.includes('annotations')) db.exec("ALTER TABLE lessons ADD COLUMN annotations TEXT DEFAULT ''");
  const noteColumns = db.prepare('PRAGMA table_info(notes)').all().map((column) => column.name);
  if (!noteColumns.includes('color')) db.exec("ALTER TABLE notes ADD COLUMN color TEXT DEFAULT 'sun'");
  if (!noteColumns.includes('category')) db.exec("ALTER TABLE notes ADD COLUMN category TEXT DEFAULT 'lesson'");
  if (!noteColumns.includes('pinned')) db.exec('ALTER TABLE notes ADD COLUMN pinned INTEGER DEFAULT 0');
  if (!noteColumns.includes('remind_at')) db.exec('ALTER TABLE notes ADD COLUMN remind_at INTEGER');

  seedDefaults();
  return db;
}

function seedDefaults() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM settings').get().c;
  if (count === 0) {
    const now = Date.now();
    const defaults = {
      displayName: 'LIBAN',
      theme: 'dark',
      wordsPerMinute: '200',
      modelNote: 'Offline local assistant (no cloud model)',
      twinSync: '100',
    };
    const insert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(defaults)) {
      insert.run(key, value);
    }
    // Ensure updatedAt concept for settings seed timestamp isn't needed
    void now;
  }

  const checklistCount = db.prepare('SELECT COUNT(*) AS c FROM checklist_items').get().c;
  if (checklistCount === 0) {
    const items = [
      ['check_portfolio', 'Ship a portfolio project with README', 'portfolio', 1],
      ['check_algorithms', 'Practice 20 algorithm problems', 'skills', 2],
      ['check_system_design', 'Sketch 3 system-design solutions', 'skills', 3],
      ['check_resume', 'Update resume with measurable outcomes', 'career', 4],
      ['check_interview', 'Complete 5 mock interview questions', 'career', 5],
      ['check_lessons', 'Complete 80% of imported lessons', 'learning', 6],
    ];
    const insert = db.prepare(
      'INSERT INTO checklist_items (id, label, done, category, sort_order) VALUES (?, ?, 0, ?, ?)'
    );
    for (const [id, label, category, sort] of items) {
      insert.run(id, label, category, sort);
    }
  }

  const iqCount = db.prepare('SELECT COUNT(*) AS c FROM interview_questions').get().c;
  if (iqCount === 0) {
    const qs = [
      ['iq1', 'Explain the difference between supervised and unsupervised learning.', 'Supervised uses labeled data; unsupervised finds structure without labels.', 'ml', 'easy'],
      ['iq2', 'What is overfitting and how do you reduce it?', 'Overfitting means the model memorizes training noise. Reduce via regularization, more data, cross-validation, simpler models.', 'ml', 'medium'],
      ['iq3', 'Describe how you would design a rate limiter.', 'Token bucket or sliding window at the edge/API gateway, keyed by user/IP, with Redis counters and graceful degradation.', 'systems', 'hard'],
      ['iq4', 'What is the time complexity of binary search?', 'O(log n) comparisons on a sorted array.', 'algorithms', 'easy'],
      ['iq5', 'How does a hash map handle collisions?', 'Chaining (lists/buckets) or open addressing (probing). Load factor triggers resize.', 'algorithms', 'medium'],
    ];
    const insert = db.prepare(
      'INSERT INTO interview_questions (id, question, answer, category, difficulty, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const now = Date.now();
    for (const [id, q, a, cat, diff] of qs) {
      insert.run(id, q, a, cat, diff, now);
    }
  }

  seedSampleLibrary();
}

function insertLessonSeed({ id, title, category, excerpt, wordCount, html, fileName, week, day, bookmarked = 0 }) {
  const now = Date.now();
  db.prepare(`
    INSERT OR IGNORE INTO lessons (
      id, title, category, excerpt, word_count, reading_time_min, has_code, has_quiz,
      source_file_name, html, notes, completed, bookmarked, max_scroll_fraction,
      last_scroll_fraction, open_count, last_opened_at, week, day, track, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, '', 0, ?, 0, 0, 0, NULL, ?, ?, 'ml', ?, ?)
  `).run(id, title, category, excerpt, wordCount, Math.max(1, Math.round(wordCount / 200)), fileName, html, bookmarked, week, day, now, now);
}

function seedSampleLibrary() {
  const lessonCount = db.prepare('SELECT COUNT(*) AS c FROM lessons').get().c;
  const now = Date.now();

  const curriculum = [
    {
      id: 'lsn_seed_supervised',
      title: 'Supervised Learning Basics',
      category: 'Machine Learning',
      excerpt: 'Supervised learning trains a model on labeled examples so it can predict labels for new inputs. Each training pair is an input vector x and a target y.',
      wordCount: 98,
      fileName: 'seed-supervised-learning.html',
      week: 1,
      day: 1,
      bookmarked: 1,
      html: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Supervised Learning Basics</title></head><body><h1>Supervised Learning Basics</h1><p>Supervised learning trains a model on labeled examples so it can predict labels for new inputs. Each training pair is an input vector x and a target y.</p><h2>Core idea</h2><p>The model learns a function f(x) that approximates y. Classification predicts discrete labels. Regression predicts continuous values.</p><h2>Overfitting</h2><p>Overfitting means the model memorizes training noise instead of the signal. Reduce it with more data, regularization, simpler models, and cross-validation.</p><h2>Practice</h2><p>Start with a train/validation/test split. Fit on train, tune on validation, report test metrics once.</p></body></html>`,
    },
    {
      id: 'lsn_seed_overfitting',
      title: 'Overfitting and Regularization',
      category: 'Machine Learning',
      excerpt: 'Overfitting is when a model fits training noise. Regularization, more data, and simpler models reduce it.',
      wordCount: 86,
      fileName: 'seed-overfitting.html',
      week: 1,
      day: 2,
      html: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Overfitting and Regularization</title></head><body><h1>Overfitting and Regularization</h1><p>Overfitting is when a model fits training noise instead of the true pattern. The training score looks great while new data performs poorly.</p><h2>Signals</h2><p>A large gap between training and validation metrics is the classic warning.</p><h2>Fixes</h2><p>Use L2/L1 regularization, dropout, early stopping, more data, or a simpler hypothesis class.</p></body></html>`,
    },
    {
      id: 'lsn_seed_eval',
      title: 'Train, Validation, and Test Splits',
      category: 'Machine Learning',
      excerpt: 'Keep evaluation honest: fit on train, tune on validation, report test metrics once.',
      wordCount: 74,
      fileName: 'seed-eval-splits.html',
      week: 1,
      day: 3,
      html: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Train, Validation, and Test Splits</title></head><body><h1>Train, Validation, and Test Splits</h1><p>A train set is for fitting parameters. A validation set is for choosing hyperparameters. A test set is the final, untouched report.</p><h2>Leakage</h2><p>If you tune on the test set, the number is no longer an honest estimate of future performance.</p><h2>Practice</h2><p>Lock the test set until the model family and hyperparameters are chosen.</p></body></html>`,
    },
  ];

  for (const lesson of curriculum) insertLessonSeed(lesson);

  db.prepare(
    'INSERT OR IGNORE INTO concepts (id, name, description, mastery, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run('cpt_seed_ml', 'Machine Learning', 'Concepts related to Machine Learning', 15, now, now);
  for (const lesson of curriculum) {
    db.prepare('INSERT OR IGNORE INTO concept_lessons (concept_id, lesson_id) VALUES (?, ?)').run(
      'cpt_seed_ml',
      lesson.id
    );
  }

  db.prepare(
    'INSERT OR IGNORE INTO notes (id, title, body, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    'note_seed_1',
    'First study note',
    'Labeled data is the bottleneck. Track what I still do not understand after each lesson.',
    'ml',
    now,
    now
  );

  db.prepare(
    'INSERT OR IGNORE INTO snippets (id, title, language, code, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    'snp_seed_1',
    'Train/val/test split reminder',
    'javascript',
    'function split(n, ratios = [0.7, 0.15, 0.15]) {\n  const a = Math.floor(n * ratios[0]);\n  const b = Math.floor(n * ratios[1]);\n  return { train: a, val: b, test: n - a - b };\n}',
    'Keep evaluation honest.',
    now,
    now
  );

  db.prepare(
    'INSERT OR IGNORE INTO projects (id, title, description, status, architecture, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    'prj_seed_1',
    'Offline NEXUS learning OS',
    'Local React UI + Node API + SQLite lesson store.',
    'active',
    'Browser (Vite/React) -> HTTP /api -> Express (port 8787) -> data/nexus.db (SQLite)',
    now,
    now
  );
  db.prepare(
    'INSERT OR IGNORE INTO projects (id, title, description, status, architecture, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    'prj_seed_capstone',
    'Personal ML study tracker',
    'Capstone: import lessons, track mastery, drill interview questions offline.',
    'capstone',
    'Lessons + concepts + flashcards + exam mode, all local SQLite.',
    now,
    now
  );

  db.prepare(
    'INSERT OR IGNORE INTO flashcards (id, front, back, lesson_id, ease, next_review_at, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?)'
  ).run(
    'fc_seed_1',
    'What is supervised learning?',
    'Training a model on labeled (x, y) pairs so it can predict y for new x.',
    'lsn_seed_supervised',
    now,
    now,
    now
  );
  db.prepare(
    'INSERT OR IGNORE INTO flashcards (id, front, back, lesson_id, ease, next_review_at, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?)'
  ).run(
    'fc_seed_2',
    'What is overfitting?',
    'The model memorizes training noise and fails to generalize. Watch the train/val gap.',
    'lsn_seed_overfitting',
    now,
    now,
    now
  );

  db.prepare(
    'INSERT OR IGNORE INTO resources (id, title, url, type, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    'res_seed_1',
    'Local lesson library',
    'data/nexus.db',
    'file',
    'All imported HTML lessons live in this SQLite file.',
    now
  );

  db.prepare(
    'INSERT OR IGNORE INTO datasets (id, title, description, path_or_url, format, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    'ds_seed_1',
    'Study progress log',
    'Activity days and lesson opens stored locally.',
    'data/nexus.db / activity_log',
    'sqlite',
    now
  );

  void lessonCount;
}

export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function todayKey(d = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Mogadishu',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(d).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function bumpActivity(opens = 1, minutes = 0) {
  const day = todayKey();
  db.prepare(`
    INSERT INTO activity_log (day, opens, minutes_estimate) VALUES (?, ?, ?)
    ON CONFLICT(day) DO UPDATE SET
      opens = opens + excluded.opens,
      minutes_estimate = minutes_estimate + excluded.minutes_estimate
  `).run(day, opens, minutes);
}

export function computeStreak() {
  const rows = db.prepare('SELECT day FROM activity_log WHERE opens > 0 ORDER BY day DESC').all();
  if (!rows.length) return 0;
  const set = new Set(rows.map((r) => r.day));
  let streak = 0;
  const cursor = new Date();
  // Allow today or yesterday as the start of an active streak
  const today = todayKey(cursor);
  const yesterday = todayKey(new Date(Date.now() - 86400000));
  if (!set.has(today) && !set.has(yesterday)) return 0;
  if (!set.has(today)) cursor.setDate(cursor.getDate() - 1);
  while (set.has(todayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function ensureDailyStreak() {
  const today = todayKey();
  const rows = db.prepare('SELECT key, value FROM settings WHERE key IN (?, ?)').all('streak', 'streakLastDay');
  const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  if (stored.streak === undefined) {
    const initial = computeStreak();
    upsert.run('streak', String(initial));
    upsert.run('streakLastDay', today);
    return initial;
  }
  const current = Math.max(0, Number.parseInt(stored.streak, 10) || 0);
  if (!stored.streakLastDay || stored.streakLastDay === today) return current;

  const dayMs = 86400000;
  const todayMs = Date.parse(`${today}T00:00:00+03:00`);
  const lastDayMs = Date.parse(`${stored.streakLastDay}T00:00:00+03:00`);
  const elapsedDays = Math.max(1, Math.round((todayMs - lastDayMs) / dayMs));
  const next = current + elapsedDays;
  upsert.run('streak', String(next));
  upsert.run('streakLastDay', today);
  return next;
}

export function setManualStreak(value) {
  const next = Math.max(0, Math.floor(Number(value) || 0));
  const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  upsert.run('streak', String(next));
  upsert.run('streakLastDay', todayKey());
  return next;
}
