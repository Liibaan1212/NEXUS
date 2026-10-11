import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { initDb, getDb, DB_PATH } from './db.js';
import { watchDataCenter } from './dataset-sync.js';
import { watchProjects } from './project-sync.js';
import lessonsRouter from './routes/lessons.js';
import modulesRouter from './routes/modules.js';
import videosRouter from './routes/videos.js';
import { getLanAddresses } from './network.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 8787;
const RECEIVED_DIR = path.join(ROOT, '#Recieved');

function normalizeFolderName(value) {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  if (
    !name ||
    name.length > 100 ||
    name === '.' ||
    name === '..' ||
    /[<>:"/\\|?*\u0000-\u001f]/.test(name) ||
    /[. ]$/.test(name) ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)
  ) return null;
  return name;
}

function getReceivedPath(relativePath) {
  if (typeof relativePath !== 'string') return null;
  const segments = relativePath.replace(/\\/g, '/').split('/');
  if (
    segments.length < 1 ||
    segments.length > 2 ||
    segments.some((segment) => !segment || segment === '.' || segment === '..')
  ) return null;
  const resolved = path.resolve(RECEIVED_DIR, ...segments);
  const relative = path.relative(RECEIVED_DIR, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return resolved;
}

initDb();
watchDataCenter();
watchProjects();

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));

app.get('/api/health', (_req, res) => {
  try {
    getDb().prepare('SELECT 1 AS connected').get();
    const bytes = fs.statSync(DB_PATH).size;
    res.json({
      ok: true,
      name: 'NEXUS AI Learning OS',
      database: 'online',
      db: DB_PATH,
      bytes,
      time: Date.now(),
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      name: 'NEXUS AI Learning OS',
      database: 'offline',
      db: DB_PATH,
      error: error.message,
      time: Date.now(),
    });
  }
});

app.use('/api/lessons', lessonsRouter);
app.use('/api', videosRouter);
app.use('/api', modulesRouter);

app.get('/api/receive', async (_req, res, next) => {
  try {
    await fs.promises.mkdir(RECEIVED_DIR, { recursive: true });
    const entries = await fs.promises.readdir(RECEIVED_DIR, { withFileTypes: true });
    const folders = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    const files = [];
    for (const entry of entries) {
      if (entry.isFile() && !entry.name.endsWith('.part')) {
        files.push({ entry, relativePath: entry.name });
      } else if (entry.isDirectory()) {
        const children = await fs.promises.readdir(path.join(RECEIVED_DIR, entry.name), { withFileTypes: true });
        files.push(...children
          .filter((child) => child.isFile() && !child.name.endsWith('.part'))
          .map((child) => ({ entry: child, relativePath: `${entry.name}/${child.name}` })));
      }
    }
    const fileDetails = await Promise.all(files.map(async ({ entry, relativePath }) => {
      const stat = await fs.promises.stat(getReceivedPath(relativePath));
      return { name: entry.name, relativePath, folder: path.posix.dirname(relativePath) === '.' ? '' : path.posix.dirname(relativePath), size: stat.size, modifiedAt: stat.mtime.toISOString() };
    }));
    fileDetails.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
    const lanAddresses = getLanAddresses(os.networkInterfaces());
    res.json({ directory: '#Recieved', folders, files: fileDetails, lanAddresses });
  } catch (error) {
    next(error);
  }
});

app.post('/api/receive/folders', async (req, res, next) => {
  try {
    const name = normalizeFolderName(req.body?.name);
    if (!name) {
      res.status(400).json({ error: 'Choose a valid folder name (up to 100 characters, without path symbols).' });
      return;
    }
    await fs.promises.mkdir(RECEIVED_DIR, { recursive: true });
    const folderPath = getReceivedPath(name);
    try {
      await fs.promises.mkdir(folderPath);
    } catch (error) {
      if (error.code === 'EEXIST') {
        res.status(409).json({ error: 'A folder with that name already exists here.' });
        return;
      }
      throw error;
    }
    res.status(201).json({ name });
  } catch (error) {
    next(error);
  }
});

app.post('/api/receive/move', async (req, res, next) => {
  try {
    const sourcePath = getReceivedPath(req.body?.filePath);
    const folder = req.body?.folder === '' ? '' : normalizeFolderName(req.body?.folder);
    if (!sourcePath || folder === null || req.body?.folder === undefined) {
      res.status(400).json({ error: 'A valid file and destination folder are required.' });
      return;
    }
    const sourceStat = await fs.promises.stat(sourcePath);
    if (!sourceStat.isFile()) {
      res.status(400).json({ error: 'Only files can be moved.' });
      return;
    }
    const destinationDirectory = folder ? getReceivedPath(folder) : RECEIVED_DIR;
    if (folder) {
      const destinationStat = await fs.promises.stat(destinationDirectory).catch(() => null);
      if (!destinationStat?.isDirectory()) {
        res.status(404).json({ error: 'The destination folder no longer exists.' });
        return;
      }
    }
    const destinationPath = path.join(destinationDirectory, path.basename(sourcePath));
    if (sourcePath === destinationPath) {
      res.json({ relativePath: req.body.filePath, folder });
      return;
    }
    try {
      await fs.promises.rename(sourcePath, destinationPath);
    } catch (error) {
      if (error.code === 'EEXIST' || error.code === 'ENOTEMPTY') {
        res.status(409).json({ error: 'A file with that name already exists in the destination folder.' });
        return;
      }
      throw error;
    }
    const stat = await fs.promises.stat(destinationPath);
    res.json({
      name: path.basename(destinationPath),
      relativePath: folder ? `${folder}/${path.basename(destinationPath)}` : path.basename(destinationPath),
      folder,
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'The file could not be found.' });
      return;
    }
    next(error);
  }
});

app.get('/api/receive/pdf/:filename', async (req, res, next) => {
  try {
    const relativePath = req.query.path || req.params.filename;
    const filePath = getReceivedPath(relativePath);
    if (!filePath || path.extname(filePath).toLowerCase() !== '.pdf') {
      res.status(400).json({ error: 'A valid PDF file name is required.' });
      return;
    }
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) {
      res.status(404).json({ error: 'PDF not found.' });
      return;
    }
    res.type('application/pdf');
    res.set('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(path.basename(filePath))}`);
    res.set('X-Content-Type-Options', 'nosniff');
    res.sendFile(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'PDF not found.' });
      return;
    }
    next(error);
  }
});

app.get('/api/receive/download/:filename', async (req, res, next) => {
  try {
    const relativePath = req.query.path || req.params.filename;
    const filePath = getReceivedPath(relativePath);
    if (!filePath || path.basename(filePath).endsWith('.part')) {
      res.status(400).json({ error: 'A valid received file name is required.' });
      return;
    }
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) {
      res.status(404).json({ error: 'File not found.' });
      return;
    }
    res.download(filePath, path.basename(filePath), (error) => {
      if (error && !res.headersSent) next(error);
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'File not found.' });
      return;
    }
    next(error);
  }
});

app.post('/api/receive', async (req, res, next) => {
  let temporaryPath;
  try {
    const requestedName = req.query.filename;
    if (typeof requestedName !== 'string' || !requestedName.trim()) {
      res.status(400).json({ error: 'A file name is required.' });
      return;
    }
    const fileName = requestedName
      .replace(/\\/g, '/')
      .split('/')
      .pop()
      .replace(/[\u0000-\u001f<>:"|?*]/g, '_')
      .trim()
      .slice(0, 180);
    const safeName = fileName.replace(/[. ]+$/, '');
    if (!safeName || safeName === '.' || safeName === '..') {
      res.status(400).json({ error: 'The file name is not valid.' });
      return;
    }
    const finalName = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(safeName)
      ? `_${safeName}`
      : safeName;

    await fs.promises.mkdir(RECEIVED_DIR, { recursive: true });
    temporaryPath = path.join(RECEIVED_DIR, `.${randomUUID()}.part`);
    await pipeline(req, createWriteStream(temporaryPath, { flags: 'wx' }));

    const extension = path.extname(finalName);
    const stem = path.basename(finalName, extension);
    let savedName = finalName;
    let suffix = 1;
    while (true) {
      try {
        await fs.promises.link(temporaryPath, path.join(RECEIVED_DIR, savedName));
        break;
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        savedName = `${stem} (${suffix++})${extension}`;
      }
    }
    await fs.promises.unlink(temporaryPath);
    temporaryPath = null;
    const stat = await fs.promises.stat(path.join(RECEIVED_DIR, savedName));
    res.status(201).json({ name: savedName, relativePath: savedName, folder: '', size: stat.size });
  } catch (error) {
    if (temporaryPath) {
      await fs.promises.rm(temporaryPath, { force: true }).catch(() => {});
    }
    next(error);
  }
});

const distDir = path.join(ROOT, 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

const server = app.listen(PORT, () => {
  console.log(`NEXUS offline backend listening on http://127.0.0.1:${PORT}`);
  console.log(`SQLite database: ${DB_PATH}`);
  console.log('Project and Data Center folders will sync when their modules are opened.');
});
// Large LAN transfers can exceed Node's default five-minute request-body timeout.
server.requestTimeout = 24 * 60 * 60 * 1000;
