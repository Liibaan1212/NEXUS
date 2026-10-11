import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateId, getDb } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECTS_DIR = path.join(__dirname, '..', '#Projects');

function listProjectDirectories() {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  return fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(PROJECTS_DIR, entry.name));
}

function collectFiles(directory, root = directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(fullPath, root);
    if (!entry.isFile()) return [];
    return [{ path: path.relative(root, fullPath).split(path.sep).join('/'), size: fs.statSync(fullPath).size }];
  });
}

function readProjectDescription(directory) {
  const readme = ['README.md', 'README.txt', 'readme.md']
    .map((name) => path.join(directory, name))
    .find((filePath) => fs.existsSync(filePath));
  if (!readme) return '';
  return fs.readFileSync(readme, 'utf8').trim().slice(0, 1000);
}

function projectArchitecture(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true })
    .slice(0, 30)
    .map((entry) => `${entry.isDirectory() ? '[dir]' : '[file]'} ${entry.name}`);
  return entries.join('\n');
}

export function syncProjects(defaultStatus = 'active') {
  fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  const db = getDb();
  const find = db.prepare('SELECT * FROM projects WHERE source_path = ?');
  const insert = db.prepare(
    'INSERT INTO projects (id, title, description, status, architecture, source_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const update = db.prepare(
    'UPDATE projects SET title = ?, description = ?, architecture = ?, updated_at = ? WHERE id = ?'
  );
  let added = 0;
  for (const directory of listProjectDirectories()) {
    const title = path.basename(directory);
    const description = readProjectDescription(directory);
    const architecture = projectArchitecture(directory);
    const existing = find.get(directory);
    if (existing) {
      update.run(title, description, architecture, Date.now(), existing.id);
    } else {
      const now = Date.now();
      insert.run(generateId('prj'), title, description, defaultStatus, architecture, directory, now, now);
      added += 1;
    }
  }
  return { added, total: listProjectDirectories().length, directory: PROJECTS_DIR };
}

function safeProjectName(name) {
  const cleaned = String(name || '').trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '-').replace(/^\.+$/, '');
  if (!cleaned || cleaned === '.' || cleaned === '..') throw new Error('Choose a valid project folder name.');
  return cleaned.slice(0, 120);
}

export function importProjectFiles(name, files = [], status = 'active') {
  const projectDirectory = path.join(PROJECTS_DIR, safeProjectName(name));
  fs.mkdirSync(projectDirectory, { recursive: true });
  for (const file of files) {
    const relativePath = String(file?.path || '').replace(/^[\\/]+/, '');
    const destination = path.resolve(projectDirectory, relativePath);
    if (!relativePath || (destination !== projectDirectory && !destination.startsWith(`${projectDirectory}${path.sep}`))) {
      throw new Error('The selected folder contains an invalid file path.');
    }
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    const content = file.encoding === 'base64' ? Buffer.from(file.content || '', 'base64') : String(file.content || '');
    fs.writeFileSync(destination, content);
  }
  const result = syncProjects(status);
  const imported = getDb().prepare('SELECT id FROM projects WHERE source_path = ?').get(projectDirectory);
  if (imported && status) getDb().prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?').run(status, Date.now(), imported.id);
  return result;
}

export function listProjectFiles(projectPath) {
  const resolved = path.resolve(projectPath);
  const root = path.resolve(PROJECTS_DIR);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error('Project folder is outside #Projects.');
  return collectFiles(resolved).sort((a, b) => a.path.localeCompare(b.path));
}

export function readProjectFile(projectPath, relativePath) {
  const root = path.resolve(projectPath);
  const resolved = path.resolve(root, String(relativePath || ''));
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error('File is outside the project folder.');
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) throw new Error('Project file not found.');
  return resolved;
}

export function watchProjects() {
  fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  let timer;
  try {
    fs.watch(PROJECTS_DIR, { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          const result = syncProjects();
          if (result.added) console.log(`Projects sync: registered ${result.added} project(s).`);
        } catch (error) {
          console.error(`Projects sync failed: ${error.message}`);
        }
      }, 250);
    });
  } catch (error) {
    console.warn(`Projects watcher unavailable: ${error.message}`);
  }
}
