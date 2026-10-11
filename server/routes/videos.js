import { Router } from 'express';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { getDb } from '../db.js';

const router = Router();
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const VIDEO_DIR = path.join(ROOT, '#videos');
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.ogg', '.ogv', '.mov', '.m4v', '.mkv', '.avi', '.mpeg', '.mpg']);
const MIME_TYPES = {
  '.avi': 'video/x-msvideo',
  '.m4v': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.mp4': 'video/mp4',
  '.mpeg': 'video/mpeg',
  '.mpg': 'video/mpeg',
  '.ogg': 'video/ogg',
  '.ogv': 'video/ogg',
  '.webm': 'video/webm',
};

function videoId(relativePath) {
  return createHash('sha256').update(relativePath).digest('hex');
}

function mapVideo(row) {
  if (!row) return null;
  let tags = [];
  try {
    tags = JSON.parse(row.tags);
  } catch {
    tags = [];
  }
  return {
    id: row.id,
    fileName: path.basename(row.file_path),
    relativePath: row.file_path.split(path.sep).join('/'),
    folder: path.posix.dirname(row.file_path.split(path.sep).join('/')) === '.' ? '' : path.posix.dirname(row.file_path.split(path.sep).join('/')),
    title: row.title,
    category: row.category,
    tags,
    notes: row.notes,
    duration: row.duration,
    position: row.position,
    completed: Boolean(row.completed),
    favorite: Boolean(row.favorite),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    size: row.size || 0,
  };
}

function scanDirectory(directory = VIDEO_DIR, relativeDirectory = '') {
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
  const found = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      found.push(...scanDirectory(absolutePath, relativePath));
    } else if (entry.isFile() && VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      found.push({ absolutePath, relativePath, title: path.basename(entry.name, path.extname(entry.name)) });
    }
  }
  return found;
}

function syncVideoFiles() {
  const database = getDb();
  const insert = database.prepare(`
    INSERT OR IGNORE INTO videos (id, file_path, title, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const now = Date.now();
  for (const video of scanDirectory()) {
    insert.run(videoId(video.relativePath), video.relativePath, video.title, now, now);
  }

  return database.prepare('SELECT * FROM videos ORDER BY created_at DESC').all()
    .flatMap((row) => {
      const absolutePath = path.resolve(VIDEO_DIR, row.file_path);
      const relativeToRoot = path.relative(VIDEO_DIR, absolutePath);
      if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot) || !fs.existsSync(absolutePath)) return [];
      const stats = fs.statSync(absolutePath);
      return [mapVideo({ ...row, size: stats.size })];
    });
}

function cleanFileName(value) {
  const baseName = path.basename(value).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
  if (!baseName || baseName === '.' || baseName === '..') throw new Error('Choose a valid video filename.');
  if (!VIDEO_EXTENSIONS.has(path.extname(baseName).toLowerCase())) throw new Error('That video format is not supported.');
  return baseName.slice(0, 240);
}

function cleanFolderName(value) {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  if (
    !name ||
    name.length > 100 ||
    name === '.' ||
    name === '..' ||
    /[<>:"/\\|?*\x00-\x1f]/.test(name) ||
    /[. ]$/.test(name) ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)
  ) return null;
  return name;
}

function getVideoRow(id) {
  return getDb().prepare('SELECT * FROM videos WHERE id = ?').get(id);
}

router.get('/videos', (_req, res) => {
  res.json({ directory: '#videos', videos: syncVideoFiles() });
});

router.get('/videos/folders', (_req, res) => {
  fs.mkdirSync(VIDEO_DIR, { recursive: true });
  const folders = fs.readdirSync(VIDEO_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  res.json({ folders });
});

router.post('/videos/folders', (req, res) => {
  const name = cleanFolderName(req.body?.name);
  if (!name) return res.status(400).json({ error: 'Choose a valid folder name (up to 100 characters, without path symbols).' });
  fs.mkdirSync(VIDEO_DIR, { recursive: true });
  try {
    fs.mkdirSync(path.join(VIDEO_DIR, name));
    return res.status(201).json({ name });
  } catch (error) {
    if (error.code === 'EEXIST') return res.status(409).json({ error: 'A folder with that name already exists here.' });
    return res.status(500).json({ error: error.message || 'Folder creation failed.' });
  }
});

router.post('/videos/:id/move', (req, res) => {
  const existing = getVideoRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Video not found.' });
  const folder = req.body?.folder === '' ? '' : cleanFolderName(req.body?.folder);
  if (folder === null || req.body?.folder === undefined) {
    return res.status(400).json({ error: 'A valid destination folder is required.' });
  }
  const destinationDirectory = folder ? path.join(VIDEO_DIR, folder) : VIDEO_DIR;
  if (folder && (!fs.existsSync(destinationDirectory) || !fs.statSync(destinationDirectory).isDirectory())) {
    return res.status(404).json({ error: 'The destination folder no longer exists.' });
  }
  const sourcePath = path.resolve(VIDEO_DIR, existing.file_path);
  const sourceRelative = path.relative(VIDEO_DIR, sourcePath);
  if (sourceRelative.startsWith('..') || path.isAbsolute(sourceRelative) || !fs.existsSync(sourcePath)) {
    return res.status(404).json({ error: 'Video file not found.' });
  }
  const destinationPath = path.join(destinationDirectory, path.basename(sourcePath));
  if (sourcePath === destinationPath) return res.json(mapVideo({ ...existing, size: fs.statSync(sourcePath).size }));
  if (fs.existsSync(destinationPath)) {
    return res.status(409).json({ error: 'A video with that name already exists in the destination folder.' });
  }

  const relativePath = path.relative(VIDEO_DIR, destinationPath).split(path.sep).join('/');
  try {
    fs.renameSync(sourcePath, destinationPath);
    getDb().prepare('UPDATE videos SET file_path=?, updated_at=? WHERE id=?')
      .run(relativePath, Date.now(), existing.id);
  } catch (error) {
    if (fs.existsSync(destinationPath) && !fs.existsSync(sourcePath)) fs.renameSync(destinationPath, sourcePath);
    return res.status(500).json({ error: error.message || 'Video move failed.' });
  }
  const row = getVideoRow(existing.id);
  return res.json(mapVideo({ ...row, size: fs.statSync(destinationPath).size }));
});

router.post('/videos/import', async (req, res) => {
  let destination;
  try {
    const requestedName = decodeURIComponent(req.get('x-file-name') || '');
    let fileName = cleanFileName(requestedName);
    fs.mkdirSync(VIDEO_DIR, { recursive: true });
    destination = path.join(VIDEO_DIR, fileName);
    const extension = path.extname(fileName);
    const baseName = path.basename(fileName, extension);
    let suffix = 2;
    while (fs.existsSync(destination)) {
      fileName = `${baseName} (${suffix})${extension}`;
      destination = path.join(VIDEO_DIR, fileName);
      suffix += 1;
    }

    const contentLength = Number(req.get('content-length') || 0);
    if (contentLength > 8 * 1024 * 1024 * 1024) return res.status(413).json({ error: 'Videos must be smaller than 8 GB.' });
    await pipeline(req, fs.createWriteStream(destination, { flags: 'wx' }));
    const relativePath = path.relative(VIDEO_DIR, destination).split(path.sep).join('/');
    const now = Date.now();
    getDb().prepare('INSERT OR IGNORE INTO videos (id, file_path, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(videoId(relativePath), relativePath, path.basename(fileName, extension), now, now);
    const row = getVideoRow(videoId(relativePath));
    const stats = fs.statSync(destination);
    return res.status(201).json(mapVideo({ ...row, size: stats.size }));
  } catch (error) {
    if (destination && fs.existsSync(destination)) fs.rmSync(destination, { force: true });
    return res.status(400).json({ error: error.message || 'Video import failed.' });
  }
});

router.get('/videos/:id/stream', (req, res, next) => {
  const row = getVideoRow(req.params.id);
  if (!row) return res.status(404).json({ error: 'Video not found.' });
  const absolutePath = path.resolve(VIDEO_DIR, row.file_path);
  const relativeToRoot = path.relative(VIDEO_DIR, absolutePath);
  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) return res.status(400).json({ error: 'Invalid video path.' });
  if (!fs.existsSync(absolutePath)) return res.status(404).json({ error: 'Video file is missing from #videos.' });
  return res.sendFile(absolutePath, {
    acceptRanges: true,
    headers: { 'Content-Type': MIME_TYPES[path.extname(absolutePath).toLowerCase()] || 'application/octet-stream' },
  }, next);
});

router.patch('/videos/:id', (req, res) => {
  const existing = getVideoRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Video not found.' });

  const body = req.body || {};
  const title = body.title === undefined ? existing.title : String(body.title).trim().slice(0, 180);
  const category = body.category === undefined ? existing.category : (String(body.category).trim().slice(0, 80) || 'Unsorted');
  const tags = body.tags === undefined ? existing.tags : JSON.stringify(
    [...new Set((Array.isArray(body.tags) ? body.tags : String(body.tags).split(',')).map((tag) => String(tag).trim()).filter(Boolean))]
      .slice(0, 24).map((tag) => tag.slice(0, 40))
  );
  const notes = body.notes === undefined ? existing.notes : String(body.notes).slice(0, 5000);
  const duration = body.duration === undefined ? existing.duration : Math.max(0, Number(body.duration) || 0);
  const position = body.position === undefined ? existing.position : Math.max(0, Number(body.position) || 0);
  const completed = body.completed === undefined ? existing.completed : (body.completed ? 1 : 0);
  const favorite = body.favorite === undefined ? existing.favorite : (body.favorite ? 1 : 0);
  const updatedAt = Date.now();

  getDb().prepare(`
    UPDATE videos SET title=?, category=?, tags=?, notes=?, duration=?, position=?, completed=?, favorite=?, updated_at=?
    WHERE id=?
  `).run(title || existing.title, category, tags, notes, duration, position, completed, favorite, updatedAt, existing.id);
  return res.json(mapVideo(getVideoRow(existing.id)));
});

export { router as default, VIDEO_DIR, VIDEO_EXTENSIONS, scanDirectory, syncVideoFiles };