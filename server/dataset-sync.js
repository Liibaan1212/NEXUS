import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateId, getDb } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_CENTER_DIR = path.join(__dirname, '..', '#Data Center');

function formatFor(filePath) {
  return path.extname(filePath).slice(1).toLowerCase() || 'file';
}

function titleFor(filePath) {
  return path.basename(filePath, path.extname(filePath));
}

function listFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(entryPath);
    return entry.isFile() ? [entryPath] : [];
  });
}

/** Register every file in #Data Center once. Existing registry entries are preserved. */
export function syncDataCenter() {
  const db = getDb();
  const findByPath = db.prepare('SELECT id FROM datasets WHERE path_or_url = ?');
  const insert = db.prepare(
    'INSERT INTO datasets (id, title, description, path_or_url, format, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const files = listFiles(DATA_CENTER_DIR);
  let added = 0;
  for (const filePath of files) {
    if (findByPath.get(filePath)) continue;
    const { size } = fs.statSync(filePath);
    insert.run(generateId('ds'), titleFor(filePath), `Auto-registered from #Data Center (${size.toLocaleString()} bytes).`, filePath, formatFor(filePath), Date.now());
    added += 1;
  }
  return { added, totalFiles: files.length, directory: DATA_CENTER_DIR };
}

export function isDataCenterFile(filePath) {
  const relative = path.relative(DATA_CENTER_DIR, path.resolve(filePath));
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

export function getDataCenterSummary(rows = []) {
  const local = rows.map((row) => row.path_or_url).filter((filePath) => isDataCenterFile(filePath));
  let totalBytes = 0;
  let missing = 0;
  for (const filePath of local) {
    try {
      totalBytes += fs.statSync(filePath).size;
    } catch {
      missing += 1;
    }
  }
  const formats = Object.fromEntries(rows.reduce((counts, row) => {
    const format = row.format || 'unknown';
    counts.set(format, (counts.get(format) || 0) + 1);
    return counts;
  }, new Map()));
  return { directory: DATA_CENTER_DIR, total: rows.length, local: local.length, missing, totalBytes, formats };
}

/** Keep the registry current for files added while the local backend is running. */
export function watchDataCenter() {
  if (!fs.existsSync(DATA_CENTER_DIR)) fs.mkdirSync(DATA_CENTER_DIR, { recursive: true });
  let timer;
  try {
    fs.watch(DATA_CENTER_DIR, { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          const result = syncDataCenter();
          if (result.added) console.log(`Data Center sync: registered ${result.added} file(s).`);
        } catch (error) {
          console.error('Data Center sync failed:', error.message);
        }
      }, 250);
    });
  } catch (error) {
    console.warn(`Data Center watcher unavailable: ${error.message}`);
  }
}
