import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, uploadReceivedFile } from '../lib/api.js';
import CreateFolderDialog from '../components/CreateFolderDialog.jsx';

const FILE_KINDS = {
  pdf: { label: 'PDF document', icon: 'picture_as_pdf', tone: 'text-rose-500 bg-rose-500/10' },
  ppt: { label: 'PowerPoint 97–2003', icon: 'co_present', tone: 'text-orange-500 bg-orange-500/10' },
  pptx: { label: 'PowerPoint presentation', icon: 'co_present', tone: 'text-orange-500 bg-orange-500/10' },
  odp: { label: 'OpenDocument presentation', icon: 'slideshow', tone: 'text-sky-500 bg-sky-500/10' },
  key: { label: 'Keynote presentation', icon: 'slideshow', tone: 'text-sky-500 bg-sky-500/10' },
};

const ACCEPTED_EXTENSIONS = new Set(Object.keys(FILE_KINDS));
const FAVORITES_KEY = 'nexus-presentation-pdf-favorites';
const RECENT_KEY = 'nexus-presentation-pdf-recent';

function readStoredPaths(key) {
  try {
    const stored = JSON.parse(window.localStorage.getItem(key) || '[]');
    return Array.isArray(stored) ? stored.filter((value) => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

function getFileKind(name) {
  const extension = name.split('.').pop()?.toLowerCase() || '';
  return FILE_KINDS[extension] || { label: 'Document', icon: 'description', tone: 'text-on-surface-variant bg-surface-container-high' };
}

function isPresentationFile(name) {
  return ACCEPTED_EXTENSIONS.has(name.split('.').pop()?.toLowerCase() || '');
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unit]}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function Icon({ children, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`} aria-hidden="true">{children}</span>;
}

function fileUrl(file, purpose) {
  const filePath = encodeURIComponent(file.relativePath || file.name);
  return purpose === 'preview'
    ? `/api/receive/pdf/${encodeURIComponent(file.name)}?path=${filePath}`
    : `/api/receive/download/${encodeURIComponent(file.name)}?path=${filePath}`;
}

function DocumentCard({ file, selected, favorite, viewMode, onSelect, onToggleFavorite }) {
  const kind = getFileKind(file.name);
  const extension = file.name.split('.').pop()?.toUpperCase() || 'FILE';
  return (
    <div
      className={`group relative min-w-0 rounded-2xl border transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg ${
        selected ? 'border-primary/40 bg-primary/[0.06] shadow-md shadow-primary/[0.04]' : 'border-white/[0.08] bg-surface-container'
      } ${viewMode === 'list' ? 'flex items-center gap-3 p-3' : 'p-4'}`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`min-w-0 text-left ${viewMode === 'list' ? 'flex flex-1 items-center gap-3' : 'block w-full'}`}
      >
        <div className={`flex shrink-0 items-center justify-center rounded-xl ${kind.tone} ${viewMode === 'list' ? 'h-10 w-10' : 'h-11 w-11'}`}>
          <Icon className={viewMode === 'list' ? 'text-[20px]' : 'text-[22px]'}>{kind.icon}</Icon>
        </div>
        <div className={viewMode === 'list' ? 'min-w-0 flex-1' : 'mt-4'}>
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-on-surface" title={file.name}>{file.name}</h3>
            {favorite && <Icon className="shrink-0 text-[15px] text-primary">star</Icon>}
          </div>
          <p className="mt-1 truncate text-xs text-on-surface-variant">{kind.label}{file.folder ? ` · ${file.folder}` : ''}</p>
        </div>
        {viewMode === 'grid' && (
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/[0.08] pt-3 text-[11px] text-outline">
            <span>{formatBytes(file.size)}</span>
            <span>{formatDate(file.modifiedAt)}</span>
          </div>
        )}
      </button>
      {viewMode === 'list' && (
        <>
          <span className="hidden shrink-0 text-xs text-on-surface-variant sm:inline">{formatBytes(file.size)}</span>
          <span className="hidden shrink-0 text-xs text-outline lg:inline">{formatDate(file.modifiedAt)}</span>
          <span className="hidden rounded-md bg-surface-container-high px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant md:inline">{extension}</span>
        </>
      )}
      <button
        type="button"
        onClick={(event) => { event.stopPropagation(); onToggleFavorite(); }}
        aria-label={favorite ? `Remove ${file.name} from favorites` : `Add ${file.name} to favorites`}
        aria-pressed={favorite}
        title={favorite ? 'Remove from favorites' : 'Add to favorites'}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${
          favorite ? 'text-primary hover:bg-primary/10' : 'text-outline hover:bg-surface-container-high hover:text-primary'
        } ${viewMode === 'grid' ? 'absolute right-3 top-3' : ''}`}
      >
        <Icon className="text-[19px]">{favorite ? 'star' : 'star_outline'}</Icon>
      </button>
    </div>
  );
}

export default function PresentationsPdf() {
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [activeFolder, setActiveFolder] = useState('all');
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('recent');
  const [selectedName, setSelectedName] = useState('');
  const [favorites, setFavorites] = useState(() => readStoredPaths(FAVORITES_KEY));
  const [recentPaths, setRecentPaths] = useState(() => readStoredPaths(RECENT_KEY));
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [readerOpen, setReaderOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [queue, setQueue] = useState([]);
  const [uploadError, setUploadError] = useState('');
  const [moveError, setMoveError] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const searchRef = useRef(null);
  const readerRef = useRef(null);
  const uploadingRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const result = await api.get('/receive');
      const libraryFiles = result.files.filter((file) => isPresentationFile(file.name));
      setFiles(libraryFiles);
      setFolders(result.folders || []);
      setActiveFolder((current) => current !== 'all' && current !== '' && !(result.folders || []).includes(current) ? 'all' : current);
      setSelectedName((current) => (
        libraryFiles.some((file) => file.relativePath === current)
          ? current
          : libraryFiles.find((file) => file.name.toLowerCase().endsWith('.pdf'))?.relativePath || libraryFiles[0]?.relativePath || ''
      ));
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!readerOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    readerRef.current?.focus();
    return () => { document.body.style.overflow = previousOverflow; };
  }, [readerOpen]);

  useEffect(() => {
    if (!selectedName || !files.some((file) => file.relativePath === selectedName)) return;
    setRecentPaths((current) => {
      return [selectedName, ...current.filter((path) => path !== selectedName)].slice(0, 8);
    });
  }, [files, selectedName]);

  useEffect(() => {
    try {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(recentPaths));
    } catch {
      setNotice('Recently opened documents could not be saved in this browser.');
    }
  }, [recentPaths]);

  useEffect(() => {
    try {
      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    } catch {
      setNotice('Favorites could not be saved in this browser.');
    }
  }, [favorites]);

  const addFiles = (fileList) => {
    const selected = Array.from(fileList || []);
    const accepted = selected.filter((file) => isPresentationFile(file.name));
    const rejected = selected.filter((file) => !isPresentationFile(file.name));

    setUploadError(rejected.length
      ? `${rejected.length} file${rejected.length === 1 ? ' was' : 's were'} skipped. Choose PDF, PPT, PPTX, ODP, or KEY files.`
      : '');
    if (!accepted.length) return;

    setQueue((current) => [
      ...current,
      ...accepted.map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`,
        file,
        progress: 0,
        status: 'waiting',
        error: '',
      })),
    ]);
  };

  const startUploads = async (itemsToUpload = queue.filter((item) => item.status === 'waiting')) => {
    if (uploadingRef.current) return;
    const pending = itemsToUpload;
    if (!pending.length) return;
    uploadingRef.current = true;
    const ids = new Set(pending.map((item) => item.id));
    setQueue((current) => current.map((item) => (
      ids.has(item.id) ? { ...item, status: 'uploading', progress: 0 } : item
    )));

    for (const item of pending) {
      try {
        const uploaded = await uploadReceivedFile(item.file, (loaded, total) => {
          const progress = total ? Math.round((loaded / total) * 100) : 0;
          setQueue((current) => current.map((entry) => (
            entry.id === item.id ? { ...entry, progress } : entry
          )));
        });
        setQueue((current) => current.map((entry) => (
          entry.id === item.id ? { ...entry, status: 'done', progress: 100 } : entry
        )));
        setSelectedName(uploaded.relativePath || uploaded.name);
      } catch (uploadRequestError) {
        setQueue((current) => current.map((entry) => (
          entry.id === item.id ? { ...entry, status: 'failed', error: uploadRequestError.message } : entry
        )));
      }
    }

    uploadingRef.current = false;
    await refresh();
  };

  const visibleFiles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const result = files.filter((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      const matchesType = filter === 'all'
        || (filter === 'pdf' && extension === 'pdf')
        || (filter === 'slides' && extension !== 'pdf');
      const matchesFolder = activeFolder === 'all' || file.folder === activeFolder;
      const matchesFavorite = !favoritesOnly || favorites.includes(file.relativePath);
      return matchesType && matchesFolder && matchesFavorite && (!normalizedQuery || file.name.toLowerCase().includes(normalizedQuery));
    });

    return result.sort((a, b) => {
      if (sort === 'oldest') return a.modifiedAt.localeCompare(b.modifiedAt);
      if (sort === 'name') return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      if (sort === 'largest') return b.size - a.size;
      return b.modifiedAt.localeCompare(a.modifiedAt);
    });
  }, [activeFolder, favorites, favoritesOnly, files, filter, query, sort]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && readerOpen) {
        setReaderOpen(false);
        return;
      }
      if (readerOpen && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        const readable = visibleFiles.filter((file) => file.name.toLowerCase().endsWith('.pdf'));
        const currentIndex = readable.findIndex((file) => file.relativePath === selectedName);
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        const nextFile = readable[currentIndex + direction];
        if (nextFile) setSelectedName(nextFile.relativePath);
        return;
      }
      if (readerOpen) return;
      if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey
        && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [readerOpen, selectedName, visibleFiles]);

  const selectedFile = files.find((file) => file.relativePath === selectedName);
  const activeFolderFileCount = files.filter((file) => activeFolder === 'all' || file.folder === activeFolder).length;
  const pdfCount = files.filter((file) => file.name.toLowerCase().endsWith('.pdf')).length;
  const slideCount = files.length - pdfCount;
  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  const waitingCount = queue.filter((item) => item.status === 'waiting').length;
  const failedCount = queue.filter((item) => item.status === 'failed').length;
  const uploadActive = queue.some((item) => item.status === 'uploading');
  const recentFiles = recentPaths
    .map((relativePath) => files.find((file) => file.relativePath === relativePath))
    .filter(Boolean)
    .slice(0, 4);

  const toggleFavorite = (file) => {
    setFavorites((current) => {
      return current.includes(file.relativePath)
        ? current.filter((path) => path !== file.relativePath)
        : [file.relativePath, ...current];
    });
  };

  const copyDocumentLink = async (file) => {
    const link = new URL(fileUrl(file, file.name.toLowerCase().endsWith('.pdf') ? 'preview' : 'download'), window.location.origin).toString();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const field = document.createElement('textarea');
        field.value = link;
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        const copied = document.execCommand('copy');
        field.remove();
        if (!copied) throw new Error('Copy is not supported in this browser.');
      }
      setNotice('Document link copied.');
    } catch (copyError) {
      setNotice(copyError.message);
    }
    window.setTimeout(() => setNotice(''), 3000);
  };

  const openPrintView = (file) => {
    const anchor = document.createElement('a');
    anchor.href = fileUrl(file, 'preview');
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setNotice('PDF opened in a new tab. Use the PDF viewer’s print control there.');
    window.setTimeout(() => setNotice(''), 4000);
  };

  const downloadFile = (file) => {
    const anchor = document.createElement('a');
    anchor.href = fileUrl(file, 'download');
    anchor.download = file.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const createFolder = async (name) => {
    await api.post('/receive/folders', { name });
    await refresh();
    setActiveFolder(name);
    setSelectedName('');
  };

  const moveFileToFolder = async (relativePath, folder) => {
    try {
      const movedFile = await api.post('/receive/move', { filePath: relativePath, folder });
      setMoveError('');
      setActiveFolder(folder);
      setSelectedName(movedFile.relativePath);
      await refresh();
    } catch (moveRequestError) {
      setMoveError(moveRequestError.message);
    }
  };

  const openFolder = (folder) => {
    setActiveFolder(folder);
    setSelectedName(files.find((file) => file.folder === folder)?.relativePath || '');
  };

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-7 px-5 py-7 sm:px-8 lg:px-10 lg:py-10">
      <header className="relative overflow-hidden rounded-[30px] border border-white/10 bg-surface-container-low px-6 py-8 sm:px-9 sm:py-10">
        <div className="pointer-events-none absolute -right-12 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute right-56 -bottom-40 h-72 w-72 rounded-full bg-tertiary/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-8 xl:flex-row xl:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-primary">
              <Icon className="text-[16px]">auto_awesome</Icon>
              Your visual library
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.05em] text-on-surface sm:text-5xl">
              Ideas, in <span className="text-primary">full view.</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-on-surface-variant sm:text-base">
              One calm space for your reading and presenting. Preview PDFs here, keep slide decks ready to open, and add files in a click.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-container-low"
            >
              <Icon className="text-[20px]">add</Icon>
              Add documents
            </button>
            <button
              type="button"
              onClick={() => setCreateFolderOpen(true)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/15 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-container-low"
            >
              <Icon className="text-[20px]">create_new_folder</Icon>
              Create folder
            </button>
            <button
              type="button"
              onClick={refresh}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-surface-container px-4 py-2.5 text-sm font-medium text-on-surface transition hover:bg-surface-container-high"
            >
              <Icon className="text-[19px]">refresh</Icon>
              Refresh library
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.ppt,.pptx,.odp,.key,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              multiple
              className="hidden"
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = '';
              }}
            />
          </div>
        </div>
        <div className="relative mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {[
            { label: 'Library items', value: files.length, icon: 'auto_stories', accent: 'text-primary' },
            { label: 'PDF documents', value: pdfCount, icon: 'picture_as_pdf', accent: 'text-rose-500' },
            { label: 'Slide decks', value: slideCount, icon: 'co_present', accent: 'text-orange-500' },
            { label: 'Library size', value: formatBytes(totalBytes), icon: 'database', accent: 'text-tertiary' },
            { label: 'Starred', value: files.filter((file) => favorites.includes(file.relativePath)).length, icon: 'star', accent: 'text-amber-500' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-white/[0.08] bg-surface-container px-4 py-3">
              <div className="flex items-center gap-2 text-on-surface-variant">
                <Icon className={`text-[17px] ${stat.accent}`}>{stat.icon}</Icon>
                <span className="text-xs">{stat.label}</span>
              </div>
              <p className="mt-2 text-xl font-semibold tracking-tight text-on-surface">{stat.value}</p>
            </div>
          ))}
        </div>
      </header>

      {notice && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/[0.08] px-4 py-3 text-sm text-on-surface" role="status">
          <span className="flex items-center gap-2"><Icon className="text-[18px] text-primary">info</Icon>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Dismiss notification" className="text-outline hover:text-on-surface"><Icon className="text-[18px]">close</Icon></button>
        </div>
      )}

      {recentFiles.length > 0 && (
        <section aria-label="Recently opened documents">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Pick up where you left off</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-on-surface">Recently opened</h2>
            </div>
            <span className="text-xs text-on-surface-variant">Saved on this device</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {recentFiles.map((file) => {
              const kind = getFileKind(file.name);
              return (
                <button
                  key={file.relativePath}
                  type="button"
                  onClick={() => setSelectedName(file.relativePath)}
                  className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/[0.08] bg-surface-container px-3 py-3 text-left transition hover:border-primary/30 hover:bg-surface-container-high"
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${kind.tone}`}><Icon>{kind.icon}</Icon></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-on-surface">{file.name}</span>
                    <span className="mt-1 block text-[10px] text-on-surface-variant">{kind.label} · {formatBytes(file.size)}</span>
                  </span>
                  <Icon className="text-[17px] text-outline">arrow_forward</Icon>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {queue.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-primary/20 bg-surface-container-low" aria-label="Upload queue">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
            <div>
              <h2 className="font-semibold text-on-surface">Add to your library</h2>
              <p className="mt-1 text-xs text-on-surface-variant">
                {uploadActive ? 'Saving directly into #Recieved…' : `${waitingCount} ready · ${failedCount} failed`}
              </p>
            </div>
            <div className="flex gap-2">
              {!uploadActive && (
                <button type="button" onClick={() => setQueue([])} className="rounded-lg px-3 py-2 text-xs text-on-surface-variant hover:bg-surface-container-high">
                  Clear
                </button>
              )}
              {waitingCount > 0 && (
                <button
                  type="button"
                  onClick={() => { void startUploads(); }}
                  disabled={uploadActive}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-60"
                >
                  {uploadActive ? 'Adding…' : `Add ${waitingCount} file${waitingCount === 1 ? '' : 's'}`}
                </button>
              )}
              {!uploadActive && waitingCount === 0 && failedCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const retrying = queue.filter((item) => item.status === 'failed');
                    setQueue((current) => current.map((item) => item.status === 'failed'
                      ? { ...item, status: 'waiting', progress: 0, error: '' }
                      : item));
                    void startUploads(retrying);
                  }}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
                >
                  Retry failed
                </button>
              )}
            </div>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {queue.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-5 py-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${getFileKind(item.file.name).tone}`}>
                  <Icon>{getFileKind(item.file.name).icon}</Icon>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="truncate font-medium text-on-surface">{item.file.name}</span>
                    <span className="shrink-0 text-xs text-on-surface-variant">
                      {item.status === 'done' ? 'Added' : item.status === 'failed' ? 'Failed' : item.status === 'uploading' ? `${item.progress}%` : formatBytes(item.file.size)}
                    </span>
                  </div>
                  {item.status === 'uploading' && (
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-container-high">
                      <div className="h-full bg-primary transition-[width]" style={{ width: `${item.progress}%` }} />
                    </div>
                  )}
                  {item.error && <p className="mt-1 truncate text-xs text-error">{item.error}</p>}
                </div>
                {!uploadActive && item.status !== 'done' && (
                  <button type="button" onClick={() => setQueue((current) => current.filter((entry) => entry.id !== item.id))} aria-label={`Remove ${item.file.name}`} className="rounded-lg p-2 text-outline hover:bg-surface-container-high hover:text-on-surface">
                    <Icon className="text-[18px]">close</Icon>
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {uploadError && <p className="rounded-xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error" role="alert">{uploadError}</p>}

      <div
        className={`grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.82fr)] ${dragging ? 'rounded-2xl outline outline-2 outline-primary' : ''}`}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(event.dataTransfer.files);
        }}
      >
        <section className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-surface-container-low">
          <div className="border-b border-white/10 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Icon className="text-[19px] text-primary">folder_special</Icon>
                  <h2 className="font-semibold text-on-surface">Your collection</h2>
                  <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[11px] text-on-surface-variant">{visibleFiles.length}</span>
                </div>
                <p className="mt-1 text-xs text-on-surface-variant">From <span className="font-medium text-on-surface">#Recieved</span> · drag library files into a folder or drop files here to add them</p>
              </div>
              <label className="flex h-10 min-w-[210px] flex-1 items-center gap-2 rounded-xl border border-white/10 bg-surface-container-lowest px-3 sm:max-w-[260px]">
                <Icon className="text-[18px] text-outline">search</Icon>
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Find a document…  /"
                  aria-label="Search presentations and PDFs"
                  className="min-w-0 flex-1 bg-transparent text-sm text-on-surface outline-none placeholder:text-outline"
                />
                {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="text-outline hover:text-on-surface"><Icon className="text-[17px]">close</Icon></button>}
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-xl bg-surface-container p-1" role="tablist" aria-label="Filter collection">
                  {[
                    { id: 'all', label: 'Everything' },
                    { id: 'pdf', label: 'PDFs' },
                    { id: 'slides', label: 'Presentations' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={filter === item.id}
                      onClick={() => setFilter(item.id)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${filter === item.id ? 'bg-surface-container-high text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              <button
                type="button"
                aria-pressed={favoritesOnly}
                onClick={() => setFavoritesOnly((current) => !current)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  favoritesOnly ? 'border-primary/40 bg-primary/10 text-primary' : 'border-white/10 text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                <Icon className="text-[16px]">{favoritesOnly ? 'star' : 'star_outline'}</Icon>
                Favorites
              </button>
              <div className="flex rounded-xl border border-white/10 bg-surface-container p-1" role="group" aria-label="Library layout">
                <button type="button" onClick={() => setViewMode('grid')} aria-label="Grid view" aria-pressed={viewMode === 'grid'} className={`flex h-8 w-8 items-center justify-center rounded-lg ${viewMode === 'grid' ? 'bg-surface-container-high text-on-surface' : 'text-outline hover:text-on-surface'}`}>
                  <Icon className="text-[18px]">grid_view</Icon>
                </button>
                <button type="button" onClick={() => setViewMode('list')} aria-label="List view" aria-pressed={viewMode === 'list'} className={`flex h-8 w-8 items-center justify-center rounded-lg ${viewMode === 'list' ? 'bg-surface-container-high text-on-surface' : 'text-outline hover:text-on-surface'}`}>
                  <Icon className="text-[18px]">view_list</Icon>
                </button>
              </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-on-surface-variant">
                <span>Sort</span>
                <select value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-lg border border-white/10 bg-surface-container-lowest px-2.5 py-2 text-xs text-on-surface outline-none">
                  <option value="recent">Recently added</option>
                  <option value="oldest">Oldest first</option>
                  <option value="name">Name A–Z</option>
                  <option value="largest">Largest file</option>
                </select>
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2" aria-label="Folders in #Recieved">
              <button
                type="button"
                onClick={() => openFolder('')}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const relativePath = event.dataTransfer.getData('application/x-nexus-received-file');
                  if (relativePath) moveFileToFolder(relativePath, '');
                }}
                className={`flex min-w-32 items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${activeFolder === '' ? 'border-primary/40 bg-primary/10 text-primary' : 'border-white/10 bg-surface-container text-on-surface-variant hover:border-primary/30'}`}
              >
                <Icon className="text-[19px]">folder_open</Icon>
                <span className="min-w-0 flex-1 truncate text-xs font-semibold">Main folder</span>
                <span className="text-[10px]">{files.filter((file) => !file.folder).length}</span>
              </button>
              {folders.map((folder) => (
                <button
                  key={folder}
                  type="button"
                  onClick={() => openFolder(folder)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const relativePath = event.dataTransfer.getData('application/x-nexus-received-file');
                    if (relativePath) moveFileToFolder(relativePath, folder);
                  }}
                  className={`group flex min-w-32 items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${activeFolder === folder ? 'border-primary/40 bg-primary/10 text-primary' : 'border-white/10 bg-surface-container text-on-surface-variant hover:border-primary/30 hover:bg-primary/[0.05]'}`}
                  aria-label={`Open ${folder}; drop documents here to move them`}
                >
                  <Icon className="text-[19px] text-primary">folder</Icon>
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold">{folder}</span>
                  <span className="text-[10px]">{files.filter((file) => file.folder === folder).length}</span>
                </button>
              ))}
            </div>
          </div>

          {moveError && <p className="border-b border-error/20 bg-error/5 px-5 py-3 text-sm text-error" role="alert">{moveError}</p>}

          {error ? (
            <div className="px-5 py-10 text-center">
              <Icon className="text-3xl text-error">cloud_off</Icon>
              <p className="mt-2 text-sm font-medium text-on-surface">Your library could not load.</p>
              <p className="mt-1 text-sm text-error">{error}</p>
              <button type="button" onClick={refresh} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary">Try again</button>
            </div>
          ) : loading ? (
            <div className="px-5 py-12 text-center text-sm text-on-surface-variant">Gathering your documents…</div>
          ) : visibleFiles.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="text-[28px]">auto_stories</Icon></div>
              <h3 className="mt-4 font-semibold text-on-surface">
                {activeFolder !== 'all' && activeFolderFileCount === 0
                  ? 'This folder is ready for documents'
                  : files.length ? 'Nothing matches that view' : 'Your reading room is ready'}
              </h3>
              <p className="mt-1 max-w-sm text-sm leading-6 text-on-surface-variant">
                {activeFolder !== 'all' && activeFolderFileCount === 0
                  ? 'Drag one of your documents onto this folder to organize it here.'
                  : files.length ? 'Try a different search or collection filter.' : 'Add a PDF or slide deck to #Recieved and it will appear here, ready to explore.'}
              </p>
              {!files.length && (
                <button type="button" onClick={() => inputRef.current?.click()} className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary">
                  Add your first document
                </button>
              )}
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid gap-3 p-4 sm:grid-cols-2' : 'flex flex-col gap-2 p-4'}>
              {visibleFiles.map((file) => {
                const kind = getFileKind(file.name);
                const isSelected = selectedName === file.relativePath;
                return (
                  <div
                    key={file.relativePath}
                    className={`group relative min-w-0 rounded-2xl border transition hover:border-primary/30 hover:shadow-lg ${
                      isSelected ? 'border-primary/40 bg-primary/[0.06] shadow-md shadow-primary/[0.04]' : 'border-white/[0.08] bg-surface-container'
                    } ${viewMode === 'list' ? 'flex items-center gap-3 p-3' : 'p-4'}`}
                  >
                    <button
                      type="button"
                      draggable
                      onDragStart={(event) => event.dataTransfer.setData('application/x-nexus-received-file', file.relativePath)}
                      onClick={() => setSelectedName(file.relativePath)}
                      aria-pressed={isSelected}
                      className={`min-w-0 text-left ${viewMode === 'list' ? 'flex flex-1 items-center gap-3' : 'block w-full'}`}
                    >
                      <div className={`flex shrink-0 items-center justify-center rounded-xl ${kind.tone} ${viewMode === 'list' ? 'h-10 w-10' : 'h-11 w-11'}`}>
                        <Icon className={viewMode === 'list' ? 'text-[20px]' : 'text-[22px]'}>{kind.icon}</Icon>
                      </div>
                      <div className={viewMode === 'list' ? 'min-w-0 flex-1' : 'mt-4'}>
                        <div className="flex min-w-0 items-center gap-2">
                          <h3 className="truncate text-sm font-semibold text-on-surface" title={file.name}>{file.name}</h3>
                        </div>
                        <p className="mt-1 truncate text-xs text-on-surface-variant">{file.folder ? `${kind.label} · ${file.folder}` : kind.label}</p>
                      </div>
                      {viewMode === 'grid' ? (
                        <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/[0.08] pt-3 text-[11px] text-outline">
                          <span>{formatBytes(file.size)}</span>
                          <span>{formatDate(file.modifiedAt)}</span>
                        </div>
                      ) : (
                        <>
                          <span className="hidden shrink-0 text-xs text-on-surface-variant sm:inline">{formatBytes(file.size)}</span>
                          <span className="hidden shrink-0 text-xs text-outline lg:inline">{formatDate(file.modifiedAt)}</span>
                          <span className="hidden rounded-md bg-surface-container-high px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant md:inline">{file.name.split('.').pop()}</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleFavorite(file)}
                      aria-label={favorites.includes(file.relativePath) ? `Remove ${file.name} from favorites` : `Add ${file.name} to favorites`}
                      aria-pressed={favorites.includes(file.relativePath)}
                      title={favorites.includes(file.relativePath) ? 'Remove from favorites' : 'Add to favorites'}
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${
                        favorites.includes(file.relativePath) ? 'text-primary hover:bg-primary/10' : 'text-outline hover:bg-surface-container-high hover:text-primary'
                      } ${viewMode === 'grid' ? 'absolute right-3 top-3' : ''}`}
                    >
                      <Icon className="text-[19px]">{favorites.includes(file.relativePath) ? 'star' : 'star_outline'}</Icon>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <aside className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-surface-container-low xl:sticky xl:top-20">
          {selectedFile ? (
            <>
              {selectedFile.name.toLowerCase().endsWith('.pdf') ? (
                <div className="overflow-hidden rounded-[22px] bg-[#2c2d30] shadow-[0_10px_20px_rgba(0,0,0,0.12)]">
                  <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f59e47] text-[#1a1d20] shadow-sm">
                        <Icon className="text-[14px]">check</Icon>
                      </span>
                      <span className="truncate text-[16px] font-semibold text-[#f5f4f1] sm:text-[18px]">
                        Preview served from this device
                      </span>
                    </div>
                    <a href={fileUrl(selectedFile, 'preview')} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1.5 text-[16px] font-semibold text-[#f59e47] transition hover:brightness-110 sm:text-[17px]">
                      <span className="leading-none">Open full size</span>
                      <span className="flex h-7 w-7 items-center justify-center rounded-md border border-[#f59e47]/45 bg-[#f59e47]/10">
                        <Icon className="text-[18px]">open_in_new</Icon>
                      </span>
                    </a>
                  </div>
                  <div className="flex items-center justify-end gap-3 bg-[#4d4d4d] px-3 py-3">
                    <button type="button" onClick={() => downloadFile(selectedFile)} aria-label="Download document" className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-transparent text-white/90 transition hover:bg-white/10">
                      <Icon className="text-[22px]">download</Icon>
                    </button>
                    <button type="button" onClick={() => openPrintView(selectedFile)} aria-label="Open PDF print view" title="Open PDF print view" className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-transparent text-white/90 transition hover:bg-white/10">
                      <Icon className="text-[22px]">print</Icon>
                    </button>
                    <button type="button" onClick={() => { setReaderOpen(true); }} aria-label="Open immersive PDF reader" title="Open immersive reader" className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-transparent text-white/90 transition hover:bg-white/10">
                      <Icon className="text-[22px]">fullscreen</Icon>
                    </button>
                    <button type="button" onClick={() => { void copyDocumentLink(selectedFile); }} aria-label="Copy document link" title="Copy document link" className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-transparent text-white/90 transition hover:bg-white/10">
                      <Icon className="text-[22px]">link</Icon>
                    </button>
                  </div>
                  <iframe
                    key={selectedFile.name}
                    title={`PDF preview: ${selectedFile.name}`}
                    src={fileUrl(selectedFile, 'preview')}
                    className="h-[520px] w-full bg-white sm:h-[620px]"
                  />
                </div>
              ) : (
                <div className="flex min-h-[360px] flex-col items-center justify-center px-7 py-12 text-center">
                  <div className={`flex h-20 w-20 items-center justify-center rounded-[26px] ${getFileKind(selectedFile.name).tone}`}>
                    <Icon className="text-[40px]">{getFileKind(selectedFile.name).icon}</Icon>
                  </div>
                  <p className="mt-5 text-lg font-semibold text-on-surface">Ready for your next big idea.</p>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-on-surface-variant">
                    Slide previews depend on the presentation app. Download this original deck to open it in PowerPoint, Keynote, or your favorite editor.
                  </p>
                  <button type="button" onClick={() => downloadFile(selectedFile)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition hover:brightness-110">
                    <Icon className="text-[19px]">download</Icon>
                    Download presentation
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-container-high text-on-surface-variant"><Icon className="text-[28px]">preview</Icon></div>
              <h2 className="mt-4 font-semibold text-on-surface">A closer look</h2>
              <p className="mt-1 max-w-xs text-sm leading-6 text-on-surface-variant">Choose a PDF to preview it here, or select a slide deck to see its details and download it.</p>
            </div>
          )}
          <div className="flex items-center gap-3 border-t border-white/10 bg-primary/[0.04] px-5 py-4">
            <Icon className="text-[20px] text-primary">shield_lock</Icon>
            <p className="text-xs leading-5 text-on-surface-variant">Your documents stay in your local NEXUS folder. No conversion or cloud upload.</p>
          </div>
        </aside>
      </div>
      <CreateFolderDialog
        open={createFolderOpen}
        location="#Recieved"
        onClose={() => setCreateFolderOpen(false)}
        onCreate={createFolder}
      />
      {readerOpen && selectedFile?.name.toLowerCase().endsWith('.pdf') && (
        <div
          ref={readerRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={`Immersive PDF reader: ${selectedFile.name}`}
          className="fixed inset-0 z-[120] flex flex-col bg-[#16191d] text-white outline-none"
        >
          <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#202328] px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300">
                <Icon>picture_as_pdf</Icon>
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold sm:text-base">{selectedFile.name}</h2>
                <p className="mt-0.5 text-[11px] text-white/55">Immersive reader · {formatBytes(selectedFile.size)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const readable = visibleFiles.filter((file) => file.name.toLowerCase().endsWith('.pdf'));
                  const index = readable.findIndex((file) => file.relativePath === selectedFile.relativePath);
                  if (index > 0) setSelectedName(readable[index - 1].relativePath);
                }}
                disabled={visibleFiles.filter((file) => file.name.toLowerCase().endsWith('.pdf')).findIndex((file) => file.relativePath === selectedFile.relativePath) <= 0}
                aria-label="Previous PDF"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <Icon className="text-[19px]">arrow_back</Icon>
              </button>
              <button
                type="button"
                onClick={() => {
                  const readable = visibleFiles.filter((file) => file.name.toLowerCase().endsWith('.pdf'));
                  const index = readable.findIndex((file) => file.relativePath === selectedFile.relativePath);
                  if (index >= 0 && index < readable.length - 1) setSelectedName(readable[index + 1].relativePath);
                }}
                disabled={(() => {
                  const readable = visibleFiles.filter((file) => file.name.toLowerCase().endsWith('.pdf'));
                  return readable.findIndex((file) => file.relativePath === selectedFile.relativePath) >= readable.length - 1;
                })()}
                aria-label="Next PDF"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <Icon className="text-[19px]">arrow_forward</Icon>
              </button>
              <button type="button" onClick={() => openPrintView(selectedFile)} aria-label="Open PDF in a new tab" title="Open PDF in a new tab" className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/80 transition hover:bg-white/10">
                <Icon className="text-[19px]">open_in_new</Icon>
              </button>
              <button type="button" onClick={() => downloadFile(selectedFile)} aria-label="Download PDF" className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/80 transition hover:bg-white/10">
                <Icon className="text-[19px]">download</Icon>
              </button>
              <button type="button" onClick={() => setReaderOpen(false)} aria-label="Close immersive reader" className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/15">
                <Icon className="text-[20px]">close</Icon>
              </button>
            </div>
          </header>
          <iframe
            key={`reader-${selectedFile.relativePath}`}
            title={`Immersive PDF: ${selectedFile.name}`}
            src={fileUrl(selectedFile, 'preview')}
            className="min-h-0 flex-1 bg-[#202328]"
          />
          <footer className="flex min-h-10 items-center justify-between gap-3 border-t border-white/10 bg-[#202328] px-4 text-[11px] text-white/55 sm:px-6">
            <span>Use the PDF controls to zoom, search, or print</span>
            <span>← / → switch documents · Esc closes reader</span>
          </footer>
        </div>
      )}
    </div>
  );
}
