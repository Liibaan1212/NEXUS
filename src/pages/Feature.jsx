import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { api, uploadReceivedFile } from '../lib/api.js';

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

function fileIcon(name) {
  const extension = name.split('.').pop().toLowerCase();
  if (['mp4', 'mov', 'mkv', 'webm', 'avi'].includes(extension)) return 'movie';
  if (['csv', 'xls', 'xlsx', 'json'].includes(extension)) return 'table_chart';
  if (['html', 'htm', 'pdf', 'md', 'txt'].includes(extension)) return 'article';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(extension)) return 'image';
  return 'draft';
}

function TransferIcon({ children, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`} aria-hidden="true">{children}</span>;
}

export default function Feature() {
  const [directory, setDirectory] = useState('#Recieved');
  const [files, setFiles] = useState([]);
  const [lanAddresses, setLanAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [qrImage, setQrImage] = useState('');
  const [qrError, setQrError] = useState('');
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [queue, setQueue] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const inputRef = useRef(null);
  const isUploading = useRef(false);
  const phoneQuickSend = new URLSearchParams(window.location.hash.split('?')[1] || '').get('send') === '1';

  const refreshFiles = useCallback(async () => {
    try {
      const result = await api.get('/receive');
      setDirectory(result.directory);
      setFiles(result.files);
      setLanAddresses(result.lanAddresses);
      setSelectedAddress((current) => (
        result.lanAddresses.includes(current) ? current : result.lanAddresses[0] || ''
      ));
      setListError('');
    } catch (error) {
      setListError(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshFiles();
  }, [refreshFiles]);

  const receiverUrl = (() => {
    const url = new URL(window.location.href);
    const currentAddress = selectedAddress || (lanAddresses.includes(url.hostname) ? url.hostname : '');
    if (currentAddress) url.hostname = currentAddress;
    url.hash = '/feature?send=1';
    return url.toString();
  })();

  useEffect(() => {
    let cancelled = false;
    setQrError('');
    QRCode.toDataURL(receiverUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 240,
      color: { dark: '#17211f', light: '#ffffff' },
    }).then((image) => {
      if (!cancelled) setQrImage(image);
    }).catch((error) => {
      if (!cancelled) setQrError(`Could not create the QR code: ${error.message}`);
    });
    return () => { cancelled = true; };
  }, [receiverUrl]);

  const addFiles = (fileList) => {
    const selected = Array.from(fileList || []);
    if (!selected.length) return [];
    const added = selected.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`,
      file,
      progress: 0,
      loaded: 0,
      status: 'waiting',
      error: '',
    }));
    setQueue((current) => [...current, ...added]);
    if (phoneQuickSend) void startUploads(added);
    return added;
  };

  const startUploads = async (entriesToSend = queue.filter((entry) => entry.status === 'waiting')) => {
    if (isUploading.current) return;
    isUploading.current = true;
    const entryIds = new Set(entriesToSend.map((entry) => entry.id));
    setQueue((current) => current.map((entry) => (
      entryIds.has(entry.id) && entry.status === 'waiting'
        ? { ...entry, status: 'uploading', progress: 0, loaded: 0 }
        : entry
    )));

    let nextEntry = 0;
    const uploadNext = async () => {
      while (nextEntry < entriesToSend.length) {
        const entry = entriesToSend[nextEntry];
        nextEntry += 1;
        try {
          await uploadReceivedFile(entry.file, (loaded, total) => {
            const progress = total ? Math.round((loaded / total) * 100) : 0;
            setQueue((current) => current.map((item) => (
              item.id === entry.id ? { ...item, progress, loaded } : item
            )));
          });
          setQueue((current) => current.map((item) => (
            item.id === entry.id ? { ...item, status: 'done', progress: 100, loaded: entry.file.size } : item
          )));
        } catch (error) {
          setQueue((current) => current.map((item) => (
            item.id === entry.id ? { ...item, status: 'failed', error: error.message } : item
          )));
        }
      }
    };

    const workerCount = Math.min(3, entriesToSend.length);
    await Promise.all(Array.from({ length: workerCount }, () => uploadNext()));

    isUploading.current = false;
    await refreshFiles();
  };

  const retryFailed = () => {
    const retrying = queue.filter((entry) => entry.status === 'failed');
    setQueue((current) => current.map((entry) => (
      entry.status === 'failed' ? { ...entry, status: 'waiting', error: '', progress: 0 } : entry
    )));
    window.setTimeout(() => startUploads(retrying), 0);
  };

  const copyReceiverUrl = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(receiverUrl);
      } else {
        const field = document.createElement('textarea');
        field.value = receiverUrl;
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        const copied = document.execCommand('copy');
        field.remove();
        if (!copied) throw new Error('Copy is not supported in this browser.');
      }
      setCopyMessage('Link copied');
    } catch (error) {
      setCopyMessage(error.message);
    }
    window.setTimeout(() => setCopyMessage(''), 2500);
  };

  const waitingCount = queue.filter((entry) => entry.status === 'waiting').length;
  const failedCount = queue.filter((entry) => entry.status === 'failed').length;
  const activeCount = queue.filter((entry) => entry.status === 'uploading').length;
  const sentCount = queue.filter((entry) => entry.status === 'done').length;
  const progressFiles = queue.filter((entry) => entry.status !== 'failed');
  const totalProgressBytes = progressFiles.reduce((total, entry) => total + entry.file.size, 0);
  const transferredBytes = progressFiles.reduce((total, entry) => (
    total + (entry.status === 'done' ? entry.file.size : entry.status === 'uploading' ? entry.loaded : 0)
  ), 0);
  const overallProgress = totalProgressBytes
    ? Math.min(100, Math.round((transferredBytes / totalProgressBytes) * 100))
    : 0;

  return (
    <div className="feature-page mx-auto flex w-full max-w-[1440px] flex-col gap-7 px-5 py-7 sm:px-8 lg:px-10 lg:py-10">
      <header className="feature-header">
        <div className="feature-intro">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
            <span className="h-2 w-2 rounded-full bg-tertiary shadow-[0_0_12px_var(--md-sys-color-tertiary)]" />
            Personal transfer space
          </div>
          <h1 className="feature-title font-semibold text-on-surface">
            Send it here. <span className="text-primary">Keep moving.</span>
          </h1>
          <p className="feature-subtitle mt-3 text-base leading-7 text-on-surface-variant">
            Move files from your phone or computer straight into NEXUS. No cloud detour, no file-size cap.
          </p>
          {phoneQuickSend && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-on-surface">
              <TransferIcon className="text-[18px] text-primary">bolt</TransferIcon>
              Phone quick send is on — choose files and they upload automatically.
            </p>
          )}
        </div>
        <div className="feature-network-pill flex w-fit items-center gap-2 rounded-full border border-white/10 bg-surface-container-low px-4 py-2 text-sm text-on-surface-variant">
          <TransferIcon className="text-[18px] text-tertiary">wifi</TransferIcon>
          Same Wi-Fi · direct transfer
        </div>
      </header>

      <div className="feature-layout grid items-start gap-6">
        <div className="flex min-w-0 flex-col gap-6">
          <section
            className={`feature-dropzone relative overflow-hidden rounded-[28px] border transition-colors ${
              dragging ? 'border-primary bg-primary/10' : 'border-white/10 bg-surface-container-low'
            }`}
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
            <div className="feature-drop-glow pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-primary/10" />
            <div className="feature-dropzone-content relative flex min-h-[310px] flex-col items-center justify-center px-5 py-10 text-center sm:min-h-[360px]">
              <div className="mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-[24px] border border-primary/20 bg-primary/10 text-primary shadow-[0_10px_36px_color-mix(in_srgb,var(--md-sys-color-primary)_12%,transparent)]">
                <TransferIcon className="text-[34px]">cloud_upload</TransferIcon>
              </div>
              <h2 className="feature-dropzone-title text-2xl font-semibold tracking-tight text-on-surface">Drop anything. It lands here.</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-on-surface-variant">
                Videos, CSVs, lessons, photos, folders-as-ZIP — original files, full quality.
              </p>
              <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-semibold text-on-primary transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-container-low"
                >
                  <TransferIcon className="text-[20px]">add</TransferIcon>
                  Choose files
                </button>
                <span className="text-xs text-outline">Select multiple files or drag and drop</span>
              </div>
              <input
                ref={inputRef}
                type="file"
                multiple
                className="hidden"
                aria-label="Choose multiple files to send"
                onChange={(event) => {
                  addFiles(event.target.files);
                  event.target.value = '';
                }}
              />
              <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-outline">
                <span className="flex items-center gap-1.5"><TransferIcon className="text-[16px]">all_inclusive</TransferIcon> No file-size limit</span>
                <span className="flex items-center gap-1.5"><TransferIcon className="text-[16px]">bolt</TransferIcon> Direct, uncompressed</span>
                <span className="flex items-center gap-1.5"><TransferIcon className="text-[16px]">lock</TransferIcon> Stays on your network</span>
              </div>
            </div>
          </section>

          {queue.length > 0 && (
            <section className="transfer-queue overflow-hidden rounded-2xl border border-white/10 bg-surface-container-low" aria-label="Transfer queue">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                <div>
                  <h2 className="font-semibold text-on-surface">Transfer queue</h2>
                  <p className="mt-0.5 text-xs text-on-surface-variant">
                    {activeCount ? `Sending up to 3 files at a time · ${activeCount} active` : `${queue.length} file${queue.length === 1 ? '' : 's'} in this batch`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!activeCount && (
                    <button
                      type="button"
                      onClick={() => setQueue([])}
                      className="rounded-lg px-3 py-2 text-xs text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
                    >
                      Clear
                    </button>
                  )}
                  {waitingCount > 0 && (
                    <button
                      type="button"
                      onClick={() => startUploads()}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition hover:brightness-110 disabled:opacity-50"
                      disabled={Boolean(activeCount)}
                    >
                      {activeCount ? 'Sending…' : `Send ${waitingCount} file${waitingCount === 1 ? '' : 's'}`}
                    </button>
                  )}
                  {!activeCount && waitingCount === 0 && failedCount > 0 && (
                    <button type="button" onClick={retryFailed} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary">
                      Retry failed
                    </button>
                  )}
                </div>
              </div>
              <div className="transfer-overview" aria-live="polite">
                <div className="transfer-overview-heading">
                  <div>
                    <p className="transfer-overview-label">{activeCount ? 'Batch progress' : failedCount ? 'Transfer results' : 'Batch ready'}</p>
                    <p className="transfer-overview-status">
                      {sentCount} sent · {failedCount} failed · {waitingCount + activeCount} remaining
                    </p>
                  </div>
                  <span className="transfer-overview-percent">{activeCount ? `${overallProgress}%` : sentCount && !failedCount ? 'Done' : `${overallProgress}%`}</span>
                </div>
                <div
                  className="transfer-progress-track"
                  role="progressbar"
                  aria-label="Overall transfer progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={overallProgress}
                  aria-valuetext={`${overallProgress}% of files without errors transferred`}
                >
                  <div className="transfer-progress-fill" style={{ width: `${overallProgress}%` }} />
                </div>
                <div className="transfer-overview-footer">
                  <span>{formatBytes(transferredBytes)} of {formatBytes(totalProgressBytes)}</span>
                  {failedCount > 0 && <span className="transfer-failed-note">{failedCount} need{failedCount === 1 ? 's' : ''} retry</span>}
                </div>
              </div>
              <div className="transfer-file-list">
                {queue.map((entry) => (
                  <div key={entry.id} className={`transfer-file-row transfer-file-${entry.status}`}>
                    <div className="transfer-file-icon">
                      <TransferIcon>{fileIcon(entry.file.name)}</TransferIcon>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-medium text-on-surface">{entry.file.name}</span>
                        <span className={`transfer-file-status transfer-file-status-${entry.status}`}>
                          {entry.status === 'done' ? 'Sent' : entry.status === 'failed' ? 'Failed' : entry.status === 'uploading' ? `${entry.progress}%` : 'Queued'}
                        </span>
                      </div>
                      {entry.status === 'uploading' ? (
                        <>
                          <div className="transfer-file-progress">
                            <div className="transfer-file-progress-fill" style={{ width: `${entry.progress}%` }} />
                          </div>
                          <p className="transfer-file-detail">{formatBytes(entry.loaded)} of {formatBytes(entry.file.size)} · Sending</p>
                        </>
                      ) : entry.error ? (
                        <p className="transfer-file-detail transfer-file-error">{entry.error}</p>
                      ) : (
                        <p className="transfer-file-detail">{formatBytes(entry.file.size)}</p>
                      )}
                    </div>
                    {!activeCount && (entry.status === 'waiting' || entry.status === 'failed') && (
                      <button
                        type="button"
                        aria-label={`Remove ${entry.file.name}`}
                        onClick={() => setQueue((current) => current.filter((item) => item.id !== entry.id))}
                        className="rounded-lg p-2 text-outline hover:bg-surface-container-high hover:text-on-surface"
                      >
                        <TransferIcon className="text-[18px]">close</TransferIcon>
                      </button>
                    )}
                    {entry.status === 'done' && <TransferIcon className="transfer-file-check">check_circle</TransferIcon>}
                    {entry.status === 'uploading' && <TransferIcon className="transfer-file-spinner">progress_activity</TransferIcon>}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="overflow-hidden rounded-2xl border border-white/10 bg-surface-container-low">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-tertiary/10 text-tertiary">
                  <TransferIcon>folder_open</TransferIcon>
                </div>
                <div>
                  <h2 className="font-semibold text-on-surface">Received files</h2>
                  <p className="mt-0.5 text-xs text-on-surface-variant">Saved to <span className="font-medium text-on-surface">{directory}</span> in your NEXUS folder</p>
                </div>
              </div>
              <button
                type="button"
                onClick={refreshFiles}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
              >
                <TransferIcon className="text-[16px]">refresh</TransferIcon> Refresh
              </button>
            </div>
            {listError ? (
              <div className="px-5 py-7 text-sm text-error">{listError}</div>
            ) : loading ? (
              <div className="px-5 py-7 text-sm text-on-surface-variant">Loading received files…</div>
            ) : files.length === 0 ? (
              <div className="px-5 py-9 text-center">
                <p className="text-sm font-medium text-on-surface">Your drop folder is ready.</p>
                <p className="mt-1 text-xs text-on-surface-variant">Files you send will appear here as soon as they arrive.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {files.map((file) => (
                  <div key={`${file.name}-${file.modifiedAt}`} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-high text-on-surface-variant">
                      <TransferIcon>{fileIcon(file.name)}</TransferIcon>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-on-surface">{file.name}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">{formatBytes(file.size)} · {new Date(file.modifiedAt).toLocaleString()}</p>
                    </div>
                    <TransferIcon className="text-[18px] text-tertiary">check_circle</TransferIcon>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-5">
          <section className="feature-phone-panel overflow-hidden rounded-2xl border border-primary/20 bg-primary/[0.06]">
            <div className="border-b border-primary/10 px-5 py-4">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <TransferIcon>smartphone</TransferIcon>
              </div>
              <h2 className="text-lg font-semibold text-on-surface">Send from your phone</h2>
              <p className="mt-1 text-sm leading-6 text-on-surface-variant">Scan the code, choose a file on your phone, and it sends automatically. Both devices need the same Wi-Fi.</p>
            </div>
            <div className="px-5 py-4">
              <div className="mb-4 flex justify-center">
                {qrImage ? (
                  <img
                    src={qrImage}
                    alt="QR code to open phone quick send"
                    className="feature-qr h-60 w-60 rounded-xl border border-white/10 bg-white p-2"
                  />
                ) : (
                  <div className="feature-qr flex h-60 w-60 items-center justify-center rounded-xl border border-white/10 bg-surface-container-lowest text-center text-xs text-on-surface-variant">
                    {qrError || 'Creating your phone QR code…'}
                  </div>
                )}
              </div>
              <p className="mb-3 text-center text-xs text-on-surface-variant">Scan with your phone camera to open Quick Drop</p>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-outline">Your phone link</p>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-surface-container-lowest p-2">
                <span className="min-w-0 flex-1 truncate px-1 font-mono text-xs text-on-surface" title={receiverUrl}>
                  {receiverUrl}
                </span>
                <button
                  type="button"
                  onClick={copyReceiverUrl}
                  aria-label="Copy phone link"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary transition hover:brightness-110"
                >
                  <TransferIcon className="text-[18px]">content_copy</TransferIcon>
                </button>
              </div>
              {copyMessage && <p className="mt-2 text-xs text-tertiary" role="status">{copyMessage}</p>}
              <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-on-surface-variant">
                <TransferIcon className="mt-0.5 text-[16px] text-primary">info</TransferIcon>
                {lanAddresses.length
                  ? 'If the link does not open, check that your phone is on this Wi-Fi network.'
                  : 'No Wi-Fi address found yet. Open this page on the computer’s local network to get a phone link.'}
              </p>
              {lanAddresses.length > 1 && (
                <div className="mt-4 border-t border-white/10 pt-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-outline">Other device addresses</p>
                  <div className="flex flex-wrap gap-2">
                    {lanAddresses.map((address) => (
                      <button
                        key={address}
                        type="button"
                        onClick={() => setSelectedAddress(address)}
                        aria-pressed={receiverUrl.includes(address)}
                        className={`rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition ${
                          receiverUrl.includes(address)
                            ? 'border-primary/40 bg-primary/10 text-on-surface'
                            : 'border-white/10 text-on-surface-variant hover:bg-surface-container-high'
                        }`}
                      >
                        {address}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-surface-container-low p-5">
            <div className="mb-4 flex items-center gap-2">
              <TransferIcon className="text-[19px] text-primary">speed</TransferIcon>
              <h2 className="font-semibold text-on-surface">Built for big transfers</h2>
            </div>
            <div className="flex flex-col gap-4">
              {[
                ['stream', 'Streams straight to disk', 'Large videos do not need to fit in browser memory.'],
                ['high_quality', 'Original quality', 'No conversion or compression on the way in.'],
                ['folder', 'Ready to organize', 'Every completed file waits in one easy-to-find folder.'],
              ].map(([icon, title, description]) => (
                <div key={title} className="flex gap-3">
                  <TransferIcon className="mt-0.5 text-[18px] text-on-surface-variant">{icon}</TransferIcon>
                  <div>
                    <p className="text-sm font-medium text-on-surface">{title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-on-surface-variant">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
