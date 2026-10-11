import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import {
  computeWordCount,
  computeExcerpt,
  computeReadingTime,
  buildLessonReviewCard,
  generateInterviewQuestionsFromLessons,
  pickTitle,
  filterLessons,
  computeStats,
  getAdjacentLessons,
  pickContinueLesson,
  sortByCreatedAtAsc,
  sortByCreatedAtDesc,
  sortLessonsForDisplay,
  uniqueCategories,
  clampFraction,
  escapeHtml,
} from '../src/lib/utils.js';
import { buildPenCursorDataUrl, normalizeSelectionText, resolveAnnotationColor, resolveAnnotationCursor } from '../src/lib/annotation-utils.js';
import { parseLessonHtml } from '../src/lib/lesson-parser.js';
import { inspectCsv } from '../server/csv-tools.js';
import { todayKey } from '../server/db.js';
import { getLanAddresses } from '../server/network.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const dbPath = path.join(projectRoot, 'data', 'nexus.db');

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForServer(port, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (res.ok) return;
    } catch {
      // retry until the server accepts requests
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server on port ${port} did not become healthy in time.`);
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await new Promise((resolve) => {
    child.once('exit', () => resolve());
    setTimeout(resolve, 2000);
  });
}

function makeLesson(overrides = {}) {
  return {
    id: 'id-' + Math.random(),
    title: 'Lesson',
    category: 'Uncategorized',
    excerpt: '',
    completed: false,
    bookmarked: false,
    maxScrollFraction: 0,
    createdAt: Date.now(),
    lastOpenedAt: null,
    ...overrides,
  };
}

test('todayKey follows Somalia local day boundaries instead of UTC day boundaries', () => {
  assert.equal(todayKey(new Date('2025-01-02T20:59:59Z')), '2025-01-02');
  assert.equal(todayKey(new Date('2025-01-02T21:00:00Z')), '2025-01-03');
  assert.equal(todayKey(new Date('2025-01-03T00:30:00+03:00')), '2025-01-03');
});

test('phone transfer addresses prefer Wi-Fi and exclude non-routable addresses', () => {
  const addresses = getLanAddresses({
    'VMware Network Adapter VMnet8': [
      { address: '192.168.80.1', family: 'IPv4', internal: false },
    ],
    'vEthernet (Default Switch)': [
      { address: '172.29.64.1', family: 4, internal: false },
    ],
    'Wi-Fi': [
      { address: '172.20.213.37', family: 'IPv4', internal: false },
      { address: 'fe80::1', family: 'IPv6', internal: false },
    ],
    'Local Area Connection': [
      { address: '169.254.119.161', family: 'IPv4', internal: false },
    ],
    'Loopback Pseudo-Interface 1': [
      { address: '127.0.0.1', family: 'IPv4', internal: true },
    ],
  });

  assert.deepEqual(addresses, ['172.20.213.37', '192.168.80.1', '172.29.64.1']);
});

test('sortLessonsForDisplay supports newest-first and oldest-first ordering', () => {
  const lessons = [
    makeLesson({ id: 'oldest', createdAt: 10, lastOpenedAt: 100 }),
    makeLesson({ id: 'newest', createdAt: 1000, lastOpenedAt: 400 }),
    makeLesson({ id: 'middle', createdAt: 100, lastOpenedAt: 200 }),
  ];

  assert.deepEqual(sortLessonsForDisplay(lessons, 'newest').map((l) => l.id), ['newest', 'middle', 'oldest']);
  assert.deepEqual(sortLessonsForDisplay(lessons, 'oldest').map((l) => l.id), ['oldest', 'middle', 'newest']);
  assert.deepEqual(sortLessonsForDisplay(lessons, 'recent').map((l) => l.id), ['newest', 'middle', 'oldest']);
});

test('annotation helpers normalize selected text and keep only valid colors', () => {
  assert.equal(normalizeSelectionText('  hello   world  '), 'hello world');
  assert.equal(normalizeSelectionText('   '), '');
  assert.equal(resolveAnnotationColor('sky'), 'sky');
  assert.equal(resolveAnnotationColor('unknown'), 'yellow');
  assert.match(buildPenCursorDataUrl('rose'), /data:image\/svg\+xml/);
  assert.match(resolveAnnotationCursor('pen', 'rose'), /data:image\/svg\+xml/);
  assert.match(resolveAnnotationCursor('eraser', 'rose'), /data:image\/svg\+xml/);
  assert.equal(resolveAnnotationCursor(null, 'rose'), 'auto');
});

test('computeWordCount counts whitespace-separated words', () => {
  assert.equal(computeWordCount('one two three'), 3);
  assert.equal(computeWordCount('   '), 0);
  assert.equal(computeWordCount(''), 0);
  assert.equal(computeWordCount(undefined), 0);
});

test('computeExcerpt truncates long text with an ellipsis and collapses whitespace', () => {
  const short = 'Hello   world';
  assert.equal(computeExcerpt(short, 220), 'Hello world');

  const long = 'a'.repeat(300);
  const excerpt = computeExcerpt(long, 220);
  assert.equal(excerpt.length, 221); // 220 chars + ellipsis char
  assert.ok(excerpt.endsWith('\u2026'));
});

test('computeReadingTime rounds to at least 1 minute', () => {
  assert.equal(computeReadingTime(0), 1);
  assert.equal(computeReadingTime(50), 1);
  assert.equal(computeReadingTime(400), 2);
  assert.equal(computeReadingTime(1000), 5);
});

test('buildLessonReviewCard is derived from the actual selected lesson content', () => {
  const lesson = {
    id: 'lesson-1',
    title: 'Supervised Learning Basics',
    category: 'Machine Learning',
    excerpt: 'Supervised learning trains a model on labeled examples so it can predict labels for new inputs.',
    notes: 'Used for classification and regression.',
  };

  const card = buildLessonReviewCard(lesson);
  assert.equal(card.front, 'What is the main idea behind “Supervised Learning Basics”?');
  assert.match(card.back, /Supervised learning trains a model/i);
  assert.equal(card.sourceLessonId, 'lesson-1');
});

test('generateInterviewQuestionsFromLessons creates relevant questions from imported lessons', () => {
  const lessons = [
    {
      id: 'lesson-1',
      title: 'Supervised Learning Basics',
      category: 'Machine Learning',
      excerpt: 'Supervised learning trains a model using labeled examples and helps predict outputs for new samples.',
      notes: 'Use train/validation/test splits to measure performance.'
    },
    {
      id: 'lesson-2',
      title: 'Overfitting and Regularization',
      category: 'Deep Learning',
      excerpt: 'Regularization reduces overfitting by constraining the model and adding penalties.',
    }
  ];

  const questions = generateInterviewQuestionsFromLessons(lessons);
  assert.ok(questions.length >= 2);
  assert.ok(questions.some((q) => q.question.includes('Supervised Learning Basics')));
  assert.ok(questions.some((q) => q.question.includes('Overfitting')));
  assert.ok(questions.every((q) => q.answer && q.answer.length > 20));
});

test('pickTitle returns the first non-empty candidate, else the fallback', () => {
  assert.equal(pickTitle([null, '  ', 'Real Title'], 'Fallback'), 'Real Title');
  assert.equal(pickTitle([null, undefined, ''], 'Fallback'), 'Fallback');
});

test('filterLessons searches normalized text and lesson HTML content', () => {
  const lessons = [
    makeLesson({ id: '1', title: 'K-Nearest Neighbors', category: 'ML' }),
    makeLesson({ id: '2', title: 'Backpropagation', category: 'Deep Learning', html: '<p>Gradient descent updates model weights.</p>' }),
  ];
  const result = filterLessons(lessons, { query: 'neighbors' });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, '1');
  assert.equal(filterLessons(lessons, { query: '  deep   learning ' })[0].id, '2');
  assert.equal(filterLessons(lessons, { query: 'model weights' })[0].id, '2');
});

test('filterLessons filters by category and status', () => {
  const lessons = [
    makeLesson({ id: '1', category: 'ML', completed: true }),
    makeLesson({ id: '2', category: 'ML', completed: false, maxScrollFraction: 0.5 }),
    makeLesson({ id: '3', category: 'DL', completed: false, maxScrollFraction: 0 }),
    makeLesson({ id: '4', category: 'DL', bookmarked: true }),
  ];

  assert.deepEqual(filterLessons(lessons, { category: 'ML' }).map((l) => l.id), ['1', '2']);
  assert.deepEqual(filterLessons(lessons, { status: 'completed' }).map((l) => l.id), ['1']);
  assert.deepEqual(filterLessons(lessons, { status: 'in-progress' }).map((l) => l.id), ['2']);
  assert.deepEqual(filterLessons(lessons, { status: 'not-started' }).map((l) => l.id), ['3', '4']);
  assert.deepEqual(filterLessons(lessons, { status: 'bookmarked' }).map((l) => l.id), ['4']);
});

test('computeStats summarizes totals correctly', () => {
  const lessons = [
    makeLesson({ completed: true }),
    makeLesson({ completed: false, maxScrollFraction: 0.4 }),
    makeLesson({ completed: false, maxScrollFraction: 0 }),
    makeLesson({ bookmarked: true }),
  ];
  const stats = computeStats(lessons);
  assert.equal(stats.total, 4);
  assert.equal(stats.completed, 1);
  assert.equal(stats.inProgress, 1);
  assert.equal(stats.bookmarked, 1);
  assert.equal(stats.percentComplete, 25);
});

test('getAdjacentLessons finds prev/next by array position', () => {
  const lessons = [makeLesson({ id: 'a' }), makeLesson({ id: 'b' }), makeLesson({ id: 'c' })];
  const mid = getAdjacentLessons(lessons, 'b');
  assert.equal(mid.prev.id, 'a');
  assert.equal(mid.next.id, 'c');

  const first = getAdjacentLessons(lessons, 'a');
  assert.equal(first.prev, null);
  assert.equal(first.next.id, 'b');

  const last = getAdjacentLessons(lessons, 'c');
  assert.equal(last.next, null);
});

test('pickContinueLesson prefers the most recently opened unfinished lesson', () => {
  const lessons = [
    makeLesson({ id: '1', completed: false, createdAt: 1, lastOpenedAt: null }),
    makeLesson({ id: '2', completed: false, createdAt: 2, lastOpenedAt: 500 }),
    makeLesson({ id: '3', completed: true, createdAt: 3, lastOpenedAt: 900 }),
  ];
  assert.equal(pickContinueLesson(lessons).id, '2');
});

test('pickContinueLesson falls back to the oldest unfinished lesson when none were opened', () => {
  const lessons = [
    makeLesson({ id: '1', completed: false, createdAt: 200 }),
    makeLesson({ id: '2', completed: false, createdAt: 100 }),
  ];
  assert.equal(pickContinueLesson(lessons).id, '2');
});

test('sortByCreatedAtDesc keeps the newest imported lessons first', () => {
  const lessons = [
    makeLesson({ id: 'old', createdAt: 100 }),
    makeLesson({ id: 'newest', createdAt: 500 }),
    makeLesson({ id: 'mid', createdAt: 250 }),
  ];

  const ordered = sortByCreatedAtDesc(lessons).map((lesson) => lesson.id);
  assert.deepEqual(ordered, ['newest', 'mid', 'old']);
});

test('pickContinueLesson returns null when everything is completed or empty', () => {
  assert.equal(pickContinueLesson([]), null);
  assert.equal(pickContinueLesson([makeLesson({ completed: true })]), null);
});

test('sortByCreatedAtAsc does not mutate the input array', () => {
  const lessons = [makeLesson({ id: 'b', createdAt: 2 }), makeLesson({ id: 'a', createdAt: 1 })];
  const sorted = sortByCreatedAtAsc(lessons);
  assert.notEqual(sorted, lessons);
  assert.deepEqual(sorted.map((l) => l.id), ['a', 'b']);
});

test('uniqueCategories dedupes and sorts alphabetically', () => {
  const lessons = [
    makeLesson({ category: 'ML' }),
    makeLesson({ category: 'Deep Learning' }),
    makeLesson({ category: 'ML' }),
    makeLesson({ category: '' }),
  ];
  assert.deepEqual(uniqueCategories(lessons), ['Deep Learning', 'ML']);
});

test('clampFraction keeps values within [0, 1] and handles bad input', () => {
  assert.equal(clampFraction(-1), 0);
  assert.equal(clampFraction(2), 1);
  assert.equal(clampFraction(0.5), 0.5);
  assert.equal(clampFraction(NaN), 0);
  assert.equal(clampFraction(Infinity), 1);
});

test('parseLessonHtml preserves the uploaded HTML exactly while still extracting metadata', () => {
  const lessonHtml = `<!DOCTYPE html>
<html>
  <head>
    <title>Motion Demo</title>
    <style>
      @keyframes pulse { from { transform: scale(1); } to { transform: scale(1.1); } }
      .box { animation: pulse 1s infinite; }
    </style>
  </head>
  <body>
    <script>window.__demo = true;</script>
    <div class="box">Hello world</div>
  </body>
</html>`;

  const parsed = parseLessonHtml(lessonHtml, 'Fallback Title');
  assert.equal(parsed.title, 'Motion Demo');
  assert.equal(parsed.html, lessonHtml);
  assert.match(parsed.html, /@keyframes pulse/);
  assert.match(parsed.html, /window\.__demo = true/);
});

test('escapeHtml neutralizes markup-significant characters', () => {
  assert.equal(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(escapeHtml(`O'Brien & "friends"`), 'O&#39;Brien &amp; &quot;friends&quot;');
});

test('inspectCsv cleans provable issues and excludes unsafe rows', () => {
  const result = inspectCsv('\uFEFF Customer Name ,Age,Income,Active\nAlice,30,"$1,200",TRUE\nBob,?,45000,false\nBob,?,45000,false\n\nBroken,42\n');

  assert.deepEqual(result.headers, ['customer_name', 'age', 'income', 'active']);
  assert.deepEqual(result.rows, [
    ['Alice', '30', '1200', 'true'],
    ['Bob', '30', '45000', 'false'],
  ]);
  assert.equal(result.duplicateRows, 1);
  assert.equal(result.emptyRowCount, 1);
  assert.equal(result.rejectedRowCount, 1);
  assert.match(result.issues.find((issue) => issue.code === 'column-count').message, /Row 6/);
  assert.match(result.cleanedCsv, /customer_name,age,income,active/);
});

test('inspectCsv detects and normalizes inconsistent categorical values', () => {
  const result = inspectCsv('location,status\nNew York,Active\nnew york,active\nNew-York,Active\nNew Yrok,Active\n');

  assert.deepEqual(result.rows.map((row) => row[0]), ['New York', 'New Yrok']);
  assert.equal(result.duplicateRows, 2);
  assert.ok(result.issues.some((issue) => issue.code === 'inconsistent-category'));
  assert.ok(result.issues.some((issue) => issue.code === 'possible-category-typo' && issue.message.includes('New Yrok')));
});

test('inspectCsv uses the uploaded schema rather than a housing-specific schema', () => {
  const result = inspectCsv('product,units,price,channel\nWidget A,10,"$1,200",Web\nwidget-a,,900,web\nWidget A,5,"1,100",Store\n');

  assert.deepEqual(result.headers, ['product', 'units', 'price', 'channel']);
  assert.ok(result.rows.every((row) => row.length === 4));
  assert.equal(result.columns.find((column) => column.name === 'units').fillValue, '7.5');
  assert.ok(result.rows.some((row) => row[0] === 'Widget A'));
  assert.ok(result.recipe.some((step) => step.includes('no domain-specific column names')));
});

test('inspectCsv counts and clears repeated missing markers in every column', () => {
  const result = inspectCsv('alpha,beta,gamma\nA,??,yes\nA,---,??\nB,ok,yes\n');

  assert.deepEqual(result.rows, [
    ['A', 'ok', 'yes'],
    ['B', 'ok', 'yes'],
  ]);
  assert.deepEqual(result.columns.map((column) => column.valueCounts), [
    [{ value: 'A', count: 2 }, { value: 'B', count: 1 }],
    [{ value: 'ok', count: 1 }, { value: '[missing]', count: 2 }],
    [{ value: 'yes', count: 2 }, { value: '[missing]', count: 1 }],
  ]);
  assert.equal(result.issues.filter((issue) => issue.code === 'imputed-value').length, 3);
});

test('database persists across a server restart', async () => {
  const port = await getFreePort();
  const videoFileName = `journey-video-check-${process.pid}.mp4`;
  const videoFilePath = path.join(projectRoot, '#videos', videoFileName);
  const videoFolderName = `journey-folder-check-${process.pid}`;
  const videoFolderPath = path.join(projectRoot, '#videos', videoFolderName);
  const receivedFolderName = `library-folder-check-${process.pid}`;
  const receivedFolderPath = path.join(projectRoot, '#Recieved', receivedFolderName);
  const receivedFileName = `library-file-check-${process.pid}.pdf`;
  const receivedFilePath = path.join(projectRoot, '#Recieved', receivedFileName);
  let importedVideoId;
  const originalPort = process.env.PORT;
  const first = spawn(process.execPath, ['server/index.js'], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(port);

    const createRes = await fetch(`http://127.0.0.1:${port}/api/lessons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Restart Stability Check',
        category: 'Testing',
        excerpt: 'Persistence smoke test',
        html: '<html><body><h1>Restart Stability Check</h1></body></html>',
        englishHtml: '<html><body><h1>English Restart Stability Check</h1></body></html>',
        wordCount: 12,
        readingTimeMin: 1,
      }),
    });

    assert.equal(createRes.status, 201, 'lesson creation should succeed before restart');
    const created = await createRes.json();

    const importRes = await fetch(`http://127.0.0.1:${port}/api/videos/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-File-Name': encodeURIComponent(videoFileName),
      },
      body: Buffer.from('0123456789'),
    });
    assert.equal(importRes.status, 201, 'video import should succeed');
    const video = await importRes.json();
    importedVideoId = video.id;

    const videoFolderRes = await fetch(`http://127.0.0.1:${port}/api/videos/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: videoFolderName }),
    });
    assert.equal(videoFolderRes.status, 201, 'video folder should be created');
    const videoMoveRes = await fetch(`http://127.0.0.1:${port}/api/videos/${video.id}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: videoFolderName }),
    });
    assert.equal(videoMoveRes.status, 200, 'video should move into its folder');
    const movedVideo = await videoMoveRes.json();
    assert.equal(movedVideo.id, video.id, 'moving a video should preserve its player identity');
    assert.equal(movedVideo.folder, videoFolderName);

    const receivedFolderRes = await fetch(`http://127.0.0.1:${port}/api/receive/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: receivedFolderName }),
    });
    assert.equal(receivedFolderRes.status, 201, 'received folder should be created');
    const receivedUploadRes = await fetch(`http://127.0.0.1:${port}/api/receive?filename=${encodeURIComponent(receivedFileName)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/pdf' },
      body: Buffer.from('%PDF-test-folder'),
    });
    assert.equal(receivedUploadRes.status, 201, 'received test document should upload');
    assert.ok(fs.existsSync(receivedFilePath), 'phone-received files should be saved directly in #Recieved');
    const receivedMoveRes = await fetch(`http://127.0.0.1:${port}/api/receive/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath: receivedFileName, folder: receivedFolderName }),
    });
    assert.equal(receivedMoveRes.status, 200, 'received document should move into its folder');
    const movedReceivedFile = await receivedMoveRes.json();
    assert.equal(movedReceivedFile.relativePath, `${receivedFolderName}/${receivedFileName}`);
    const receivedLibraryRes = await fetch(`http://127.0.0.1:${port}/api/receive`);
    const receivedLibrary = await receivedLibraryRes.json();
    assert.equal(receivedLibrary.directory, '#Recieved');
    assert.ok(receivedLibrary.folders.includes(receivedFolderName), 'the received folder should appear in the library');
    assert.ok(receivedLibrary.files.some((entry) => entry.relativePath === movedReceivedFile.relativePath));
    const previewRes = await fetch(`http://127.0.0.1:${port}/api/receive/pdf/${encodeURIComponent(receivedFileName)}?path=${encodeURIComponent(movedReceivedFile.relativePath)}`);
    assert.equal(previewRes.status, 200, 'PDF preview should resolve a file inside a folder');
    assert.equal(await previewRes.text(), '%PDF-test-folder');
    const downloadRes = await fetch(`http://127.0.0.1:${port}/api/receive/download/${encodeURIComponent(receivedFileName)}?path=${encodeURIComponent(movedReceivedFile.relativePath)}`);
    assert.equal(downloadRes.status, 200, 'download should resolve a file inside a folder');
    assert.equal(await downloadRes.text(), '%PDF-test-folder');

    const metadataRes = await fetch(`http://127.0.0.1:${port}/api/videos/${video.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'Machine learning',
        tags: ['lecture', 'neural networks'],
        notes: 'Revisit the attention section.',
        position: 42,
        duration: 120,
        completed: true,
        favorite: true,
      }),
    });
    assert.equal(metadataRes.status, 200, 'video details should save');

    const rangeRes = await fetch(`http://127.0.0.1:${port}/api/videos/${video.id}/stream`, {
      headers: { Range: 'bytes=2-5' },
    });
    assert.equal(rangeRes.status, 206, 'video streaming should support range requests');
    assert.equal(await rangeRes.text(), '2345');

    await stopServer(first);

    const second = spawn(process.execPath, ['server/index.js'], {
      cwd: projectRoot,
      env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    try {
      await waitForServer(port);
      const res = await fetch(`http://127.0.0.1:${port}/api/lessons`);
      const lessons = await res.json();
      const found = lessons.find((lesson) => lesson.id === created.id || lesson.title === 'Restart Stability Check');
      assert.ok(found, 'the lesson should still exist after the server restarts');
      assert.equal(found.hasEnglishVersion, true, 'the English version flag should survive the server restart');
      assert.equal(found.englishHtml, '<html><body><h1>English Restart Stability Check</h1></body></html>');

      const videoRes = await fetch(`http://127.0.0.1:${port}/api/videos`);
      const videoLibrary = await videoRes.json();
      const savedVideo = videoLibrary.videos.find((entry) => entry.id === importedVideoId);
      assert.ok(savedVideo, 'the imported video should remain in the library after restart');
      assert.equal(savedVideo.folder, videoFolderName, 'the video folder should persist after restart');
      assert.equal(savedVideo.category, 'Machine learning');
      assert.deepEqual(savedVideo.tags, ['lecture', 'neural networks']);
      assert.equal(savedVideo.notes, 'Revisit the attention section.');
      assert.equal(savedVideo.position, 42);
      assert.equal(savedVideo.completed, true);
      assert.equal(savedVideo.favorite, true);
    } finally {
      await stopServer(second);
    }
  } finally {
    if (originalPort === undefined) delete process.env.PORT;
    else process.env.PORT = originalPort;

    const db = new DatabaseSync(dbPath);
    try {
      db.prepare('DELETE FROM concept_lessons WHERE lesson_id = ?').run('Restart Stability Check');
    } catch {
      // no-op if the lesson was not created
    }
    try {
      db.prepare('DELETE FROM lessons WHERE title = ?').run('Restart Stability Check');
    } catch {
      // no-op if the lesson was not created
    }
    try {
      db.prepare('DELETE FROM concepts WHERE name = ?').run('Testing');
    } catch {
      // no-op if the concept was not created
    }
    if (importedVideoId) db.prepare('DELETE FROM videos WHERE id = ?').run(importedVideoId);
    if (fs.existsSync(videoFilePath)) fs.rmSync(videoFilePath);
    if (fs.existsSync(videoFolderPath)) fs.rmSync(videoFolderPath, { recursive: true, force: true });
    if (fs.existsSync(receivedFilePath)) fs.rmSync(receivedFilePath);
    if (fs.existsSync(receivedFolderPath)) fs.rmSync(receivedFolderPath, { recursive: true, force: true });
    db.close();
  }
});
