import { useMemo, useState } from 'react';
import PageShell, { useAsyncLoad } from '../components/PageShell.jsx';
import { listProjects, listProjectFiles, syncProjects, importProject, createProject, updateProject, deleteProject } from '../lib/modules-repo.js';
import { useToast } from '../context/ToastContext.jsx';

const STATUSES = ['active', 'paused', 'done', 'capstone', 'showcase'];

const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

async function encodeFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return { path: file.webkitRelativePath.split('/').slice(1).join('/'), content: btoa(binary), encoding: 'base64' };
}

export default function Projects({ filterStatus, pageTitle }) {
  const showToast = useToast();
  const { loading, error, data: projects, reload } = useAsyncLoad(
    () => listProjects(filterStatus),
    [filterStatus]
  );
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [architecture, setArchitecture] = useState('');
  const [status, setStatus] = useState(filterStatus || 'active');
  const [folderFiles, setFolderFiles] = useState([]);
  const [folderName, setFolderName] = useState('');
  const [importing, setImporting] = useState(false);
  const [openFiles, setOpenFiles] = useState(null);
  const [filesLoading, setFilesLoading] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    if (!title.trim()) return;
    await createProject({ title: title.trim(), description, architecture, status });
    setTitle('');
    setDescription('');
    setArchitecture('');
    showToast('Project saved', 'success');
    reload();
  }

  async function handleSync() {
    const result = await syncProjects();
    showToast(result.added ? `${result.added} project folder(s) synced` : 'Projects folder is already in sync', 'success');
    reload();
  }

  function chooseFolder(e) {
    const files = [...e.target.files];
    const firstPath = files[0]?.webkitRelativePath || '';
    setFolderName(firstPath.split('/')[0] || '');
    setFolderFiles(files);
  }

  async function handleImport(e) {
    e.preventDefault();
    const totalBytes = folderFiles.reduce((total, file) => total + file.size, 0);
    if (!folderFiles.length || !folderName) return;
    if (totalBytes > MAX_IMPORT_BYTES) {
      showToast('Choose a folder smaller than 10 MB.', 'error');
      return;
    }
    setImporting(true);
    try {
      await importProject({ name: folderName, status: filterStatus || 'active', files: await Promise.all(folderFiles.map(encodeFile)) });
      showToast(`${folderName} imported into #Projects`, 'success');
      setFolderFiles([]);
      setFolderName('');
      e.target.reset();
      reload();
    } catch (error) {
      showToast(error.message || 'Project folder could not be imported.', 'error');
    } finally {
      setImporting(false);
    }
  }

  async function browseFiles(project) {
    if (openFiles?.projectId === project.id) {
      setOpenFiles(null);
      return;
    }
    setFilesLoading(true);
    try {
      setOpenFiles(await listProjectFiles(project.id));
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setFilesLoading(false);
    }
  }

  const titleMap = {
    active: 'Active Projects',
    capstone: 'Capstones',
    showcase: 'Portfolio Showcase',
  };

  const displayProjects = projects || [];
  const folderSize = useMemo(() => folderFiles.reduce((total, file) => total + file.size, 0), [folderFiles]);

  return (
    <PageShell
      title={pageTitle || titleMap[filterStatus] || 'Active Projects'}
      description="Track engineering work offline in SQLite — status, notes, and architecture sketches."
      loading={loading}
      error={error}
      actions={<button type="button" onClick={handleSync} className="dataset-action dataset-action-primary"><span className="material-symbols-outlined">sync</span>Sync #Projects</button>}
    >
      <form onSubmit={handleImport} className="rounded-xl bg-surface-container-low p-space-md flex flex-col gap-space-sm">
        <div>
          <p className="font-body-md font-semibold text-on-surface">Import a project folder</p>
          <p className="font-body-sm text-on-surface-variant">Choose a folder and NEXUS will copy it into #Projects and keep it synced.</p>
        </div>
        <input id="project-folder-input" type="file" multiple directory="" webkitdirectory="" onChange={chooseFolder} className="project-folder-input" />
        <label htmlFor="project-folder-input" className={`project-folder-picker${folderFiles.length ? ' project-folder-picker-selected' : ''}`}>
          <span className="material-symbols-outlined project-folder-icon">{folderFiles.length ? 'folder_open' : 'create_new_folder'}</span>
          <span className="project-folder-picker-copy">
            <strong>{folderFiles.length ? folderName : 'Choose a project folder'}</strong>
            <small>{folderFiles.length ? `${folderFiles.length} files selected · ${(folderSize / 1024 / 1024).toFixed(1)} MB` : 'Select a folder from your computer to begin'}</small>
          </span>
          <span className="project-folder-picker-action">Browse folders</span>
        </label>
        <button type="submit" disabled={!folderFiles.length || importing} className="project-import-button"><span className="material-symbols-outlined">{importing ? 'progress_activity' : 'file_upload'}</span>{importing ? 'Importing…' : 'Import folder'}</button>
      </form>

      <form onSubmit={handleAdd} className="rounded-xl bg-surface-container-low p-space-md flex flex-col gap-space-sm">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Project title" className="bg-surface-container px-space-sm py-space-xs rounded-lg text-on-surface font-body-sm focus:outline-none" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Description" className="bg-surface-container px-space-sm py-space-xs rounded-lg text-on-surface font-body-sm focus:outline-none resize-none" />
        <textarea value={architecture} onChange={(e) => setArchitecture(e.target.value)} rows={3} placeholder="Architecture notes / blueprint" className="bg-surface-container px-space-sm py-space-xs rounded-lg text-on-surface font-code-inline text-code-inline focus:outline-none resize-none" />
        {!filterStatus && (
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-surface-container px-space-sm py-space-xs rounded-lg text-on-surface font-body-sm">
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <button type="submit" className="self-start px-space-md py-space-sm rounded bg-primary-container text-on-primary font-semibold text-body-sm">Add project</button>
      </form>

      <div className="flex flex-col gap-space-sm">
        {displayProjects.map((p) => (
          <div key={p.id} className="rounded-lg bg-surface-container p-space-md flex flex-col gap-space-xs">
            <div className="flex justify-between gap-space-sm">
              <div>
                <p className="font-body-md font-semibold text-on-surface">{p.title}</p>
                <span className="font-label-caps text-label-caps text-primary">{p.status}</span>
              </div>
              <div className="flex gap-1">
                {projects && projects.length > 0 && (
                  <>
                    <select
                      value={p.status}
                      onChange={async (e) => { await updateProject(p.id, { status: e.target.value }); reload(); }}
                      className="bg-surface-container-high px-2 py-1 rounded text-on-surface font-label-caps text-label-caps"
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button onClick={async () => { await deleteProject(p.id); reload(); }} className="text-outline hover:text-error p-1">
                      <span className="material-symbols-outlined text-body-md">delete</span>
                    </button>
                  </>
                )}
              </div>
            </div>
            {p.description && <p className="font-body-sm text-on-surface-variant">{p.description}</p>}
            {p.sourcePath && <p className="font-label-caps text-label-caps text-outline">Synced from #Projects</p>}
            {p.sourcePath && <button type="button" onClick={() => browseFiles(p)} className="project-files-button"><span className="material-symbols-outlined">{openFiles?.projectId === p.id ? 'expand_less' : 'folder_open'}</span>{openFiles?.projectId === p.id ? 'Hide files' : 'Browse imported files'}</button>}
            {openFiles?.projectId === p.id && <div className="project-files-panel">{filesLoading ? <p>Reading folder…</p> : openFiles.files.map((file) => <a className="project-file-row" key={file.path} href={`/api/projects/${p.id}/file?path=${encodeURIComponent(file.path)}`} target="_blank" rel="noreferrer"><span className="material-symbols-outlined">description</span><span title={file.path}>{file.path}</span><small>{(file.size / 1024).toFixed(1)} KB</small></a>)}</div>}
            {p.architecture && (
              <pre className="font-code-block text-code-block text-on-surface-variant whitespace-pre-wrap bg-surface-container-lowest p-space-sm rounded-lg">{p.architecture}</pre>
            )}
          </div>
        ))}
      </div>
    </PageShell>
  );
}
