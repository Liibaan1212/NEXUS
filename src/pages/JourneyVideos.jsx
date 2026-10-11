import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, uploadVideo } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import CreateFolderDialog from '../components/CreateFolderDialog.jsx';

const FILTERS = [
  { id: 'all', label: 'Everything' },
  { id: 'continue', label: 'In progress' },
  { id: 'unwatched', label: 'Unwatched' },
  { id: 'completed', label: 'Finished' },
  { id: 'favorites', label: 'Favorites' },
];
const SELECTED_VIDEO_KEY = 'nexus-journey-videos-selected';

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = String(total % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${remainder}` : `${minutes}:${remainder}`;
}

function formatBytes(bytes) {
  if (!bytes) return 'Video';
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

function VideoCard({ video, active, onSelect, onToggleFavorite, onToggleComplete, onDragStart }) {
  const progress = video.duration > 0 ? Math.min(100, (video.position / video.duration) * 100) : 0;
  return (
    <article className={`video-card ${active ? 'video-card-active' : ''}`} draggable onDragStart={onDragStart}>
      <button type="button" className="video-card-open" onClick={onSelect} aria-label={`Watch ${video.title}`}>
        <div className="video-card-art">
          <span className="video-card-art-index">{video.category || 'UNCATEGORIZED'}</span>
          <span className="material-symbols-outlined video-card-play">play_arrow</span>
          <span className="video-card-size">{video.duration ? formatTime(video.duration) : formatBytes(video.size)}</span>
          {progress > 0 && <span className="video-card-progress"><i style={{ width: `${progress}%` }} /></span>}
        </div>
        <div className="video-card-copy">
          <h3>{video.title}</h3>
          <p>{video.folder ? `${video.folder} · ` : ''}{video.tags.length ? video.tags.slice(0, 3).join(' · ') : video.fileName}</p>
        </div>
      </button>
      <div className="video-card-actions">
        <span className={`video-state ${video.completed ? 'video-state-done' : progress ? 'video-state-progress' : ''}`}>
          {video.completed ? 'Watched' : progress ? `Resume · ${Math.round(progress)}%` : 'Not watched'}
        </span>
        <button type="button" className={`video-icon-button ${video.favorite ? 'is-favorite' : ''}`} onClick={onToggleFavorite} title={video.favorite ? 'Remove favorite' : 'Add favorite'} aria-label={video.favorite ? 'Remove favorite' : 'Add favorite'}>
          <span className="material-symbols-outlined">{video.favorite ? 'favorite' : 'favorite_border'}</span>
        </button>
        <button type="button" className="video-icon-button" onClick={onToggleComplete} title={video.completed ? 'Mark unwatched' : 'Mark watched'} aria-label={video.completed ? 'Mark unwatched' : 'Mark watched'}>
          <span className="material-symbols-outlined">{video.completed ? 'task_alt' : 'check_circle'}</span>
        </button>
      </div>
    </article>
  );
}

export default function JourneyVideos() {
  const showToast = useToast();
  const fileInputRef = useRef(null);
  const playerRef = useRef(null);
  const playerShellRef = useRef(null);
  const previousVolumeRef = useRef(1);
  const progressTimerRef = useRef(null);
  const [videos, setVideos] = useState([]);
  const [folders, setFolders] = useState([]);
  const [activeFolder, setActiveFolder] = useState('all');
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(() => {
    try {
      return window.localStorage.getItem(SELECTED_VIDEO_KEY) || '';
    } catch {
      return '';
    }
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sort, setSort] = useState('recent');
  const [speed, setSpeed] = useState('1');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [metadata, setMetadata] = useState({ title: '', category: '', tags: '', notes: '' });
  const [savingMetadata, setSavingMetadata] = useState(false);

  const selectedVideo = videos.find((video) => video.id === selectedId) || null;
  const categories = [...new Set(videos.map((video) => video.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  async function loadVideos(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    try {
      const [result, folderResult] = await Promise.all([api.get('/videos'), api.get('/videos/folders')]);
      setVideos(result.videos || []);
      setFolders(folderResult.folders || []);
      setActiveFolder((current) => current !== 'all' && current !== '' && !(folderResult.folders || []).includes(current) ? 'all' : current);
      setError('');
      setSelectedId((current) => result.videos?.some((video) => video.id === current) ? current : result.videos?.[0]?.id || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadVideos();
    const timer = window.setInterval(() => loadVideos(true), 30000);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(progressTimerRef.current);
    };
  }, []);

  useEffect(() => {
    try {
      if (selectedId) window.localStorage.setItem(SELECTED_VIDEO_KEY, selectedId);
      else window.localStorage.removeItem(SELECTED_VIDEO_KEY);
    } catch {
      // The database remains the source of truth if local storage is unavailable.
    }
  }, [selectedId]);

  useEffect(() => {
    if (!selectedVideo) return;
    setMetadata({
      title: selectedVideo.title || '',
      category: selectedVideo.category || 'Unsorted',
      tags: (selectedVideo.tags || []).join(', '),
      notes: selectedVideo.notes || '',
    });
    setSpeed('1');
    setCurrentTime(selectedVideo.position || 0);
    setIsPlaying(false);
  }, [selectedVideo?.id]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(document.fullscreenElement === playerShellRef.current);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    function handlePlayerKeys(event) {
      if (!selectedVideo || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName))) return;

      if (event.code === 'Space' || event.key.toLowerCase() === 'k') {
        event.preventDefault();
        togglePlayback();
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        seekBy(event.key === 'ArrowLeft' ? -10 : 10);
      } else if (event.key.toLowerCase() === 'm') {
        toggleMute();
      } else if (event.key.toLowerCase() === 'f') {
        toggleFullscreen();
      }
    }

    window.addEventListener('keydown', handlePlayerKeys);
    return () => window.removeEventListener('keydown', handlePlayerKeys);
  }, [selectedVideo?.id, speed]);

  async function patchVideo(video, changes, silent = false) {
    try {
      const updated = await api.patch(`/videos/${video.id}`, changes);
      setVideos((current) => current.map((entry) => entry.id === updated.id ? { ...entry, ...updated } : entry));
      return updated;
    } catch (err) {
      if (!silent) showToast(err.message, 'error');
      return null;
    }
  }

  async function importFiles(fileList) {
    const files = [...fileList].filter((file) => /\.(mp4|webm|ogg|ogv|mov|m4v|mkv|avi|mpeg|mpg)$/i.test(file.name));
    if (!files.length) {
      showToast('Choose MP4, WebM, MOV, MKV, AVI, or OGG video files.', 'error');
      return;
    }
    setUploading(true);
    let imported = 0;
    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const prefix = `Importing ${index + 1} of ${files.length} · ${file.name}`;
        setUploadProgress(`${prefix} · starting`);
        const video = await uploadVideo(file, (loaded, total) => {
          const percent = Math.round((loaded / total) * 100);
          const loadedMb = (loaded / 1024 ** 2).toFixed(0);
          const totalMb = (total / 1024 ** 2).toFixed(0);
          setUploadProgress(`${prefix} · ${percent}% (${loadedMb} / ${totalMb} MB)`);
        });
        setVideos((current) => [video, ...current.filter((entry) => entry.id !== video.id)]);
        setSelectedId(video.id);
        imported += 1;
      }
      showToast(`${imported} video${imported === 1 ? '' : 's'} imported into #videos`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
      await loadVideos(true);
    } finally {
      setUploading(false);
      setUploadProgress('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function createFolder(name) {
    await api.post('/videos/folders', { name });
    await loadVideos(true);
    setActiveFolder(name);
    showToast(`Created folder “${name}” in #videos`, 'success');
  }

  async function moveVideoToFolder(video, folder) {
    if (video.id === selectedId) saveBeforeLeaving();
    try {
      const movedVideo = await api.post(`/videos/${video.id}/move`, { folder });
      setVideos((current) => current.map((entry) => entry.id === video.id ? movedVideo : entry));
      if (selectedId === video.id) setSelectedId(movedVideo.id);
      showToast(`Moved “${video.title}” to ${folder || '#videos'}`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function savePlayback(video, player = playerRef.current) {
    if (!video || !player || !Number.isFinite(player.duration)) return;
    const position = Math.max(0, player.currentTime || 0);
    const duration = Math.max(0, player.duration || 0);
    const completed = duration > 0 && position / duration >= 0.95;
    patchVideo(video, { position, duration, ...(completed ? { completed: true } : {}) }, true);
  }

  function schedulePlaybackSave(video) {
    window.clearTimeout(progressTimerRef.current);
    progressTimerRef.current = window.setTimeout(() => savePlayback(video), 4000);
  }

  function saveBeforeLeaving() {
    window.clearTimeout(progressTimerRef.current);
    savePlayback(selectedVideo);
  }

  function togglePlayback() {
    const player = playerRef.current;
    if (!player) return;
    if (player.paused) player.play().catch((err) => showToast(`Could not play this video: ${err.message}`, 'error'));
    else player.pause();
  }

  function seekBy(seconds) {
    const player = playerRef.current;
    if (!player || !Number.isFinite(player.duration)) return;
    player.currentTime = Math.max(0, Math.min(player.duration, player.currentTime + seconds));
    setCurrentTime(player.currentTime);
  }

  function toggleMute() {
    const player = playerRef.current;
    if (!player) return;
    if (player.muted || player.volume === 0) {
      if (player.volume === 0) {
        player.volume = previousVolumeRef.current;
        setVolume(previousVolumeRef.current);
      }
      player.muted = false;
      setMuted(false);
      return;
    }
    player.muted = true;
    setMuted(true);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await playerShellRef.current?.requestFullscreen();
    } catch (err) {
      showToast(`Could not change fullscreen mode: ${err.message}`, 'error');
    }
  }

  async function openPictureInPicture() {
    const player = playerRef.current;
    if (!player || !document.pictureInPictureEnabled) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await player.requestPictureInPicture();
    } catch (err) {
      showToast(`Picture-in-picture is unavailable: ${err.message}`, 'error');
    }
  }

  function playAdjacent(offset) {
    const currentIndex = visibleVideos.findIndex((video) => video.id === selectedId);
    const nextVideo = visibleVideos[currentIndex + offset];
    if (!nextVideo) return;
    saveBeforeLeaving();
    setSelectedId(nextVideo.id);
    setCurrentTime(0);
    setIsPlaying(false);
  }

  function addTimestampNote() {
    const timestampNote = `[${formatTime(currentTime)}] `;
    setMetadata((current) => ({
      ...current,
      notes: `${current.notes.trimEnd()}${current.notes.trim() ? '\n' : ''}${timestampNote}`,
    }));
  }

  async function saveDetails(event) {
    event.preventDefault();
    if (!selectedVideo) return;
    setSavingMetadata(true);
    const updated = await patchVideo(selectedVideo, {
      title: metadata.title.trim() || selectedVideo.title,
      category: metadata.category.trim() || 'Unsorted',
      tags: metadata.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      notes: metadata.notes,
    });
    setSavingMetadata(false);
    if (updated) showToast('Video details saved', 'success');
  }

  const normalizedQuery = query.trim().toLowerCase();
  const visibleVideos = videos.filter((video) => {
    const matchesQuery = !normalizedQuery || [video.title, video.fileName, video.category, ...video.tags].join(' ').toLowerCase().includes(normalizedQuery);
    const matchesCategory = categoryFilter === 'all' || video.category === categoryFilter;
    const matchesFolder = activeFolder === 'all' || video.folder === activeFolder;
    const matchesFilter = filter === 'all'
      || (filter === 'continue' && !video.completed && video.position > 0)
      || (filter === 'unwatched' && !video.completed && video.position === 0)
      || (filter === 'completed' && video.completed)
      || (filter === 'favorites' && video.favorite);
    return matchesQuery && matchesCategory && matchesFilter && matchesFolder;
  }).sort((first, second) => {
    if (sort === 'title') return first.title.localeCompare(second.title);
    if (sort === 'oldest') return first.createdAt - second.createdAt;
    if (sort === 'duration') return second.duration - first.duration;
    return second.updatedAt - first.updatedAt;
  });

  const completedCount = videos.filter((video) => video.completed).length;
  const inProgressCount = videos.filter((video) => !video.completed && video.position > 0).length;
  const totalHours = videos.reduce((total, video) => total + (video.duration || 0), 0) / 3600;
  const noteTimestamps = [...metadata.notes.matchAll(/\[(\d+):([0-5]\d)(?::([0-5]\d))?\]/g)].map((match, index) => ({
    id: `${match[0]}-${index}`,
    label: match[0],
    seconds: match[3]
      ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
      : Number(match[1]) * 60 + Number(match[2]),
  }));

  return (
    <main className={`journey-videos ${dragOver ? 'journey-videos-dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); if (Array.from(event.dataTransfer.types).includes('Files')) setDragOver(true); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragOver(false); }} onDrop={(event) => { event.preventDefault(); setDragOver(false); if (Array.from(event.dataTransfer.types).includes('Files')) importFiles(event.dataTransfer.files); }}>
      <input ref={fileInputRef} type="file" accept="video/*,.mkv,.avi,.mpeg,.mpg" multiple hidden onChange={(event) => importFiles(event.target.files)} />
      <header className="video-page-heading">
        <div className="video-heading-copy">
          <p className="video-eyebrow"><span /> PERSONAL SCREENING ROOM</p>
          <h1>Journey <em>Videos</em></h1>
          <p className="video-heading-subtitle">A thoughtful place for everything you watch, learn, and return to.</p>
        </div>
        <div className="video-heading-actions">
          <Link to="/notes" className="video-notes-link" title="Open Notes Manager" aria-label="Open Notes Manager" onClick={saveBeforeLeaving}>
            <span className="material-symbols-outlined">sticky_note_2</span>
          </Link>
          <button type="button" className="video-refresh-button" onClick={() => loadVideos(true)} disabled={refreshing} title="Rescan #videos" aria-label="Rescan video folder">
            <span className={`material-symbols-outlined ${refreshing ? 'video-spinning' : ''}`}>refresh</span>
          </button>
          <button type="button" className="video-refresh-button" onClick={() => setCreateFolderOpen(true)} title="Create a folder inside #videos" aria-label="Create folder in #videos">
            <span className="material-symbols-outlined">create_new_folder</span>
          </button>
          <button type="button" className="video-import-button" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <span className="material-symbols-outlined">add</span>{uploading ? 'Importing' : 'Import videos'}
          </button>
        </div>
      </header>

      <section className="video-stats" aria-label="Video library overview">
        <div><span className="video-stat-icon"><span className="material-symbols-outlined">movie</span></span><strong>{videos.length}</strong><small>IN YOUR LIBRARY</small></div>
        <div><span className="video-stat-icon video-stat-green"><span className="material-symbols-outlined">play_circle</span></span><strong>{inProgressCount}</strong><small>IN PROGRESS</small></div>
        <div><span className="video-stat-icon video-stat-gold"><span className="material-symbols-outlined">task_alt</span></span><strong>{completedCount}</strong><small>FINISHED</small></div>
        <div><span className="video-stat-icon video-stat-blue"><span className="material-symbols-outlined">schedule</span></span><strong>{totalHours.toFixed(totalHours < 10 ? 1 : 0)}<small className="video-stat-unit">h</small></strong><small>READY TO WATCH</small></div>
      </section>

      {uploading && <div className="video-upload-status"><span className="video-upload-spinner" />{uploadProgress}</div>}
      {error && <div className="video-error"><span className="material-symbols-outlined">error</span><span>{error}</span><button type="button" onClick={() => loadVideos(true)}>Try again</button></div>}

      {selectedVideo && (
        <section className="video-watch-layout" aria-label="Video player and details">
          <div className="video-player-column">
            <div className="video-player-frame" ref={playerShellRef}>
              <video
                key={selectedVideo.id}
                ref={playerRef}
                src={`/api/videos/${selectedVideo.id}/stream`}
                controls={false}
                preload="metadata"
                playsInline
                onLoadedMetadata={(event) => {
                  const player = event.currentTarget;
                  setDuration(player.duration || 0);
                  const resumeAt = selectedVideo.position > 0 && selectedVideo.position < player.duration - 2 ? selectedVideo.position : 0;
                  player.currentTime = resumeAt;
                  setCurrentTime(resumeAt);
                  if (Number.isFinite(player.duration) && Math.abs(selectedVideo.duration - player.duration) > 1) {
                    patchVideo(selectedVideo, { duration: player.duration }, true);
                  }
                  player.playbackRate = Number(speed);
                  player.volume = volume;
                  player.muted = muted;
                }}
                onTimeUpdate={(event) => { setCurrentTime(event.currentTarget.currentTime); schedulePlaybackSave(selectedVideo); }}
                onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => { setIsPlaying(false); window.clearTimeout(progressTimerRef.current); savePlayback(selectedVideo); }}
                onEnded={() => { setIsPlaying(false); patchVideo(selectedVideo, { completed: true, position: playerRef.current?.duration || selectedVideo.duration }, true); }}
              />
              <div className="video-player-controls" aria-label="Video playback controls">
                <input
                  className="video-timeline"
                  type="range"
                  min="0"
                  max={Math.max(duration, 1)}
                  step="0.1"
                  value={Math.min(currentTime, duration || 0)}
                  disabled={!duration}
                  aria-label="Seek video"
                  style={{ '--video-played': `${duration ? (currentTime / duration) * 100 : 0}%` }}
                  onChange={(event) => {
                    const nextTime = Number(event.target.value);
                    if (playerRef.current) playerRef.current.currentTime = nextTime;
                    setCurrentTime(nextTime);
                  }}
                />
                <div className="video-control-row">
                  <div className="video-control-group">
                    <button type="button" className="video-control-button" onClick={() => playAdjacent(-1)} disabled={visibleVideos.findIndex((video) => video.id === selectedId) <= 0} title="Previous video" aria-label="Previous video"><span className="material-symbols-outlined">skip_previous</span></button>
                    <button type="button" className="video-control-button" onClick={() => seekBy(-10)} title="Back 10 seconds" aria-label="Back 10 seconds"><span className="material-symbols-outlined">replay_10</span></button>
                    <button type="button" className="video-control-button video-control-play" onClick={togglePlayback} title={isPlaying ? 'Pause' : 'Play'} aria-label={isPlaying ? 'Pause video' : 'Play video'}><span className="material-symbols-outlined">{isPlaying ? 'pause' : 'play_arrow'}</span></button>
                    <button type="button" className="video-control-button" onClick={() => seekBy(10)} title="Forward 10 seconds" aria-label="Forward 10 seconds"><span className="material-symbols-outlined">forward_10</span></button>
                    <button type="button" className="video-control-button" onClick={() => playAdjacent(1)} disabled={visibleVideos.findIndex((video) => video.id === selectedId) < 0 || visibleVideos.findIndex((video) => video.id === selectedId) >= visibleVideos.length - 1} title="Next video" aria-label="Next video"><span className="material-symbols-outlined">skip_next</span></button>
                    <span className="video-time-readout">{formatTime(currentTime)} <i>/</i> {formatTime(duration)}</span>
                  </div>
                  <div className="video-control-group video-control-trailing">
                    <button type="button" className="video-control-button" onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'} aria-label={muted ? 'Unmute' : 'Mute'}><span className="material-symbols-outlined">{muted || volume === 0 ? 'volume_off' : 'volume_up'}</span></button>
                    <input className="video-volume" type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume} aria-label="Volume" onChange={(event) => { const nextVolume = Number(event.target.value); if (nextVolume > 0) previousVolumeRef.current = nextVolume; setVolume(nextVolume); setMuted(nextVolume === 0); if (playerRef.current) { playerRef.current.volume = nextVolume; playerRef.current.muted = nextVolume === 0; } }} />
                    <label className="video-speed-control" aria-label="Playback speed"><span className="material-symbols-outlined">speed</span><select value={speed} onChange={(event) => { setSpeed(event.target.value); if (playerRef.current) playerRef.current.playbackRate = Number(event.target.value); }}>{['0.5', '0.75', '1', '1.25', '1.5', '1.75', '2'].map((rate) => <option key={rate} value={rate}>{rate === '1' ? '1×' : `${rate}×`}</option>)}</select></label>
                    <button type="button" className="video-control-button video-optional-control" onClick={openPictureInPicture} disabled={!document.pictureInPictureEnabled} title="Picture in picture" aria-label="Picture in picture"><span className="material-symbols-outlined">picture_in_picture_alt</span></button>
                    <button type="button" className="video-control-button" onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}><span className="material-symbols-outlined">{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span></button>
                  </div>
                </div>
              </div>
            </div>
            <div className="video-now-playing">
              <div className="video-now-playing-copy">
                <span className="video-now-label">NOW PLAYING</span>
                <h2>{selectedVideo.title}</h2>
                <p>{selectedVideo.category} <span>·</span> {formatBytes(selectedVideo.size)} <span>·</span> {selectedVideo.duration ? formatTime(selectedVideo.duration) : 'Duration appears when played'}</p>
              </div>
              <div className="video-player-tools">
                <button type="button" className={`video-icon-button video-player-favorite ${selectedVideo.favorite ? 'is-favorite' : ''}`} onClick={() => patchVideo(selectedVideo, { favorite: !selectedVideo.favorite })} title={selectedVideo.favorite ? 'Remove favorite' : 'Add favorite'} aria-label={selectedVideo.favorite ? 'Remove favorite' : 'Add favorite'}>
                  <span className="material-symbols-outlined">{selectedVideo.favorite ? 'favorite' : 'favorite_border'}</span>
                </button>
                <button type="button" className={`video-watch-toggle ${selectedVideo.completed ? 'video-watch-toggle-done' : ''}`} onClick={() => patchVideo(selectedVideo, { completed: !selectedVideo.completed, ...(selectedVideo.completed ? {} : { position: selectedVideo.duration }) })}>
                  <span className="material-symbols-outlined">{selectedVideo.completed ? 'undo' : 'done'}</span>{selectedVideo.completed ? 'Undo watched' : 'Mark watched'}
                </button>
              </div>
            </div>
          </div>

          <form className="video-details-panel" onSubmit={saveDetails}>
            <div className="video-details-heading"><span className="material-symbols-outlined">tune</span><div><h3>Organize</h3><p>Keep this watch in context.</p></div></div>
            <label className="video-field"><span>TITLE</span><input value={metadata.title} maxLength={180} onChange={(event) => setMetadata((current) => ({ ...current, title: event.target.value }))} /></label>
            <label className="video-field"><span>COLLECTION</span><input value={metadata.category} maxLength={80} onChange={(event) => setMetadata((current) => ({ ...current, category: event.target.value }))} placeholder="e.g. Machine learning" /></label>
            <label className="video-field"><span>TAGS <i>COMMA SEPARATED</i></span><input value={metadata.tags} onChange={(event) => setMetadata((current) => ({ ...current, tags: event.target.value }))} placeholder="lecture, neural networks" /></label>
            <div className="video-field">
              <div className="video-notes-label"><label htmlFor="video-study-notes">YOUR NOTES</label><button type="button" className="video-timestamp-button" onClick={addTimestampNote} title="Insert current playback time into your notes" aria-label="Insert current playback timestamp"><span className="material-symbols-outlined">bookmark_add</span>Timestamp</button></div>
              <textarea id="video-study-notes" rows={5} maxLength={5000} value={metadata.notes} onChange={(event) => setMetadata((current) => ({ ...current, notes: event.target.value }))} placeholder="Key ideas, timestamps, questions to revisit..." />
              {noteTimestamps.length > 0 && <div className="video-timestamp-list" aria-label="Saved timestamps">{noteTimestamps.map((timestamp) => <button type="button" key={timestamp.id} onClick={() => seekBy(timestamp.seconds - currentTime)} title={`Jump to ${timestamp.label}`}><span className="material-symbols-outlined">play_arrow</span>{timestamp.label}</button>)}</div>}
            </div>
            <div className="video-detail-file"><span className="material-symbols-outlined">description</span><span title={selectedVideo.fileName}>{selectedVideo.fileName}</span></div>
            <button type="submit" className="video-save-details" disabled={savingMetadata}>{savingMetadata ? 'Saving…' : 'Save details'}<span className="material-symbols-outlined">arrow_forward</span></button>
          </form>
        </section>
      )}

      <section className="video-library-section">
        <div className="video-library-heading">
          <div><span className="video-eyebrow video-library-eyebrow">YOUR COLLECTION</span><h2>On your shelf <span>{videos.length}</span></h2></div>
          <div className="video-library-controls">
            <label className="video-search"><span className="material-symbols-outlined">search</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a video" aria-label="Search videos" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><span className="material-symbols-outlined">close</span></button>}</label>
            <select className="video-control-select" aria-label="Filter by collection" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">All collections</option>{categories.map((category) => <option value={category} key={category}>{category}</option>)}</select>
            <select className="video-control-select" aria-label="Sort videos" value={sort} onChange={(event) => setSort(event.target.value)}><option value="recent">Recently added</option><option value="oldest">Oldest added</option><option value="title">Title A–Z</option><option value="duration">Longest first</option></select>
          </div>
        </div>
        <div className="video-filter-tabs" role="tablist" aria-label="Filter video library">
          {FILTERS.map((entry) => <button type="button" key={entry.id} role="tab" aria-selected={filter === entry.id} className={filter === entry.id ? 'video-filter-active' : ''} onClick={() => setFilter(entry.id)}>{entry.label}{entry.id === 'all' && <span>{videos.length}</span>}</button>)}
        </div>

        <div className="my-4 flex flex-wrap gap-2" aria-label="Folders in #videos">
          <button
            type="button"
            onClick={() => setActiveFolder('')}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const videoId = event.dataTransfer.getData('application/x-nexus-video-id');
              const video = videos.find((entry) => entry.id === videoId);
              if (video) moveVideoToFolder(video, '');
            }}
            className={`flex min-w-32 items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${activeFolder === '' ? 'border-primary/40 bg-primary/10 text-primary' : 'border-white/10 bg-surface-container text-on-surface-variant hover:border-primary/30'}`}
          >
            <span className="material-symbols-outlined text-[19px]">folder_open</span>
            <span className="min-w-0 flex-1 truncate text-xs font-semibold">Main folder</span>
            <span className="text-[10px]">{videos.filter((video) => !video.folder).length}</span>
          </button>
          {folders.map((folder) => (
            <button
              key={folder}
              type="button"
              onClick={() => setActiveFolder(folder)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const videoId = event.dataTransfer.getData('application/x-nexus-video-id');
                const video = videos.find((entry) => entry.id === videoId);
                if (video) moveVideoToFolder(video, folder);
              }}
              className={`group flex min-w-32 items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${activeFolder === folder ? 'border-primary/40 bg-primary/10 text-primary' : 'border-white/10 bg-surface-container text-on-surface-variant hover:border-primary/30 hover:bg-primary/[0.05]'}`}
              aria-label={`Open ${folder}; drop videos here to move them`}
            >
              <span className="material-symbols-outlined text-[19px] text-primary">folder</span>
              <span className="min-w-0 flex-1 truncate text-xs font-semibold">{folder}</span>
              <span className="text-[10px]">{videos.filter((video) => video.folder === folder).length}</span>
            </button>
          ))}
        </div>

        {loading ? <div className="video-library-empty"><span className="video-upload-spinner" /><p>Opening your screening room…</p></div> : videos.length === 0 ? (
          <div className="video-library-empty video-empty-shelf">
            <div className="video-empty-art"><span className="material-symbols-outlined">movie_edit</span><span className="video-empty-art-dot" /></div>
            <p className="video-eyebrow">A SHELF OF YOUR OWN</p>
            <h3>Bring your first story in.</h3>
            <p>Drop video files here or import them. Every file is kept locally in <code>#videos</code>, and your place is saved as you watch.</p>
            <button type="button" className="video-import-button" onClick={() => fileInputRef.current?.click()}><span className="material-symbols-outlined">add</span>Choose videos</button>
            <button type="button" className="video-scan-link" onClick={() => loadVideos(true)}>Scan #videos again</button>
          </div>
        ) : visibleVideos.length === 0 ? (
          <div className="video-no-results"><span className="material-symbols-outlined">filter_list_off</span><p>No videos match these filters.</p><button type="button" onClick={() => { setFilter('all'); setCategoryFilter('all'); setQuery(''); }}>Clear filters</button></div>
        ) : (
          <div className="video-card-grid">{visibleVideos.map((video) => <VideoCard key={video.id} video={video} active={selectedId === video.id} onDragStart={(event) => event.dataTransfer.setData('application/x-nexus-video-id', video.id)} onSelect={() => { if (video.id !== selectedId) saveBeforeLeaving(); setSelectedId(video.id); }} onToggleFavorite={() => patchVideo(video, { favorite: !video.favorite })} onToggleComplete={() => patchVideo(video, { completed: !video.completed, ...(video.completed ? {} : { position: video.duration }) })} />)}</div>
        )}
      </section>
      {dragOver && <div className="video-drop-overlay"><div><span className="material-symbols-outlined">move_to_inbox</span><strong>Drop videos to add them</strong><span>They will be copied into #videos</span></div></div>}
      <CreateFolderDialog
        open={createFolderOpen}
        location="#videos"
        onClose={() => setCreateFolderOpen(false)}
        onCreate={createFolder}
      />
    </main>
  );
}