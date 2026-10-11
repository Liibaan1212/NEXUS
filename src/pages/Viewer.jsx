import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getLesson, getAdjacent, recordOpen, recordScrollProgress, toggleCompleted, toggleBookmarked, saveNotes, updateLesson } from '../lib/lessons-repo.js';
import { createNote } from '../lib/modules-repo.js';
import { readFileAsText } from '../lib/lesson-parser.js';
import { clampFraction } from '../lib/utils.js';
import { ANNOTATION_COLORS, buildPenCursorDataUrl, normalizeSelectionText, parseAnnotationItems, parseAnnotationStrokes, resolveAnnotationColor, resolveAnnotationCursor, stringifyAnnotationItems } from '../lib/annotation-utils.js';
import { useToast } from '../context/ToastContext.jsx';

const ANNOTATION_MODES = {
  pen: { label: 'Pen', icon: 'edit', filled: 'Pen' },
  eraser: { label: 'Eraser', icon: 'ink_eraser', filled: 'Eraser' },
  text: { label: 'Handwriting', icon: 'title', filled: 'Handwriting' },
};

const HIGHLIGHT_COLORS = {
  yellow: '#ffd166',
  sky: '#8dd3ff',
  rose: '#ff9fb1',
  mint: '#8fe3c4',
  violet: '#c7afff',
};

export default function Viewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const showToast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [adjacency, setAdjacency] = useState({ prev: null, next: null, index: -1, total: 0 });
  const [progressPct, setProgressPct] = useState(0);
  const [notesStatus, setNotesStatus] = useState('Saved to this lesson');
  const [noteDraft, setNoteDraft] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [language, setLanguage] = useState('original');
  const [annotationMode, setAnnotationMode] = useState(null);
  const [annotationColor, setAnnotationColor] = useState('yellow');
  const [annotationBrushSize, setAnnotationBrushSize] = useState(18);
  const [annotationMenuOpen, setAnnotationMenuOpen] = useState(false);
  const [pendingSelection, setPendingSelection] = useState('');
  const [pendingSelectionRange, setPendingSelectionRange] = useState(null);
  const englishInputRef = useRef(null);

  const frameHostRef = useRef(null);
  const frameShellRef = useRef(null);
  const frameRef = useRef(null);
  const scrollCleanupRef = useRef(null);
  const scrollSaveTimerRef = useRef(null);
  const notesTimerRef = useRef(null);
  const selectionCleanupRef = useRef(null);
  const annotationCanvasRef = useRef(null);
  const annotationItemsRef = useRef([]);
  const annotationSaveTimerRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const dragTextRef = useRef(null);
  const draftTextDragRef = useRef(null);
  const [annotationItems, setAnnotationItems] = useState([]);
  const [textInputAnchor, setTextInputAnchor] = useState(null);
  const [frameScroll, setFrameScroll] = useState({ x: 0, y: 0 });

  function drawAnnotationStroke(ctx, stroke) {
    if (!stroke || !Array.isArray(stroke.points) || !stroke.points.length) return;

    const lineWidth = stroke.mode === 'eraser' ? (Number.isFinite(stroke.width) ? stroke.width : annotationBrushSize) : (Number.isFinite(stroke.width) ? stroke.width : 4);
    const points = stroke.points;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = stroke.mode === 'eraser' ? 'rgba(0, 0, 0, 1)' : HIGHLIGHT_COLORS[resolveAnnotationColor(stroke.color)] || HIGHLIGHT_COLORS.yellow;
    ctx.globalCompositeOperation = stroke.mode === 'eraser' ? 'destination-out' : 'source-over';

    if (points.length === 1) {
      const point = points[0];
      ctx.beginPath();
      ctx.arc(point.x, point.y, Math.max(1.5, lineWidth / 2), 0, Math.PI * 2);
      ctx.fillStyle = stroke.mode === 'eraser' ? 'rgba(0, 0, 0, 1)' : HIGHLIGHT_COLORS[resolveAnnotationColor(stroke.color)] || HIGHLIGHT_COLORS.yellow;
      ctx.globalCompositeOperation = stroke.mode === 'eraser' ? 'destination-out' : 'source-over';
      ctx.fill();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      ctx.lineTo(points[index].x, points[index].y);
    }
    ctx.stroke();
  }

  function redrawAnnotationCanvas(strokes = annotationStrokesRef.current) {
    const canvas = annotationCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    for (const stroke of strokes) {
      drawAnnotationStroke(ctx, stroke);
    }
  }

  function persistAnnotationItems(items = annotationItemsRef.current) {
    const idValue = id || lesson?.id;
    if (!idValue || !items) return;
    const payload = stringifyAnnotationItems(items);
    clearTimeout(annotationSaveTimerRef.current);
    annotationSaveTimerRef.current = setTimeout(async () => {
      try {
        const updated = await updateLesson(idValue, { annotations: payload });
        if (updated?.annotations !== undefined) {
          setLesson((current) => (current && current.id === updated.id ? { ...current, ...updated } : current));
        }
      } catch (err) {
        console.warn('Could not save annotation items:', err);
      }
    }, 250);
  }

  function syncAnnotationCanvas() {
    const canvas = annotationCanvasRef.current;
    const iframe = frameRef.current;
    if (!canvas || !iframe) return;

    const rect = iframe.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const isAnnotationActive = annotationMode === 'pen' || annotationMode === 'eraser' || annotationMode === 'text';
    canvas.style.pointerEvents = isAnnotationActive ? 'auto' : 'none';
    canvas.style.cursor = resolveAnnotationCursor(annotationMode, annotationColor);
    iframe.style.cursor = annotationMode === 'pen' || annotationMode === 'eraser' || annotationMode === 'text'
      ? resolveAnnotationCursor(annotationMode, annotationColor)
      : 'auto';
    iframe.style.pointerEvents = 'auto';

    redrawAnnotationCanvas(annotationItemsRef.current.filter((item) => item.kind === 'stroke'));
  }

  function getCanvasPoint(event) {
    const canvas = annotationCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function handleAnnotationPointerDown(event) {
    if (annotationMode === 'text') {
      event.preventDefault();
      const point = getCanvasPoint(event);
      if (!point) return;
      const scrollOffset = frameRef.current?.contentWindow ? {
        x: frameRef.current.contentWindow.scrollX || 0,
        y: frameRef.current.contentWindow.scrollY || 0,
      } : { x: 0, y: 0 };
      setTextInputAnchor({ x: point.x + scrollOffset.x, y: point.y + scrollOffset.y, value: '' });
      return;
    }
    if (annotationMode !== 'pen' && annotationMode !== 'eraser') return;
    event.preventDefault();
    const point = getCanvasPoint(event);
    if (!point) return;

    const newStroke = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      kind: 'stroke',
      mode: annotationMode,
      color: resolveAnnotationColor(annotationColor),
      width: annotationMode === 'eraser' ? annotationBrushSize : 4,
      points: [point],
    };

    annotationItemsRef.current = [...annotationItemsRef.current, newStroke];
    redrawAnnotationCanvas(annotationItemsRef.current.filter((item) => item.kind === 'stroke'));
    drawingRef.current = true;
    lastPointRef.current = point;
  }

  function handleAnnotationPointerMove(event) {
    if (draftTextDragRef.current && textInputAnchor) {
      const { startX, startY, originX, originY } = draftTextDragRef.current;
      setTextInputAnchor((current) => (current ? {
        ...current,
        x: originX + (event.clientX - startX),
        y: originY + (event.clientY - startY),
      } : current));
      return;
    }
    if (dragTextRef.current) {
      const { itemId, startX, startY, originX, originY } = dragTextRef.current;
      const item = annotationItemsRef.current.find((entry) => entry.id === itemId && entry.kind === 'text');
      if (!item) return;
      item.x = originX + (event.clientX - startX);
      item.y = originY + (event.clientY - startY);
      setAnnotationItems([...annotationItemsRef.current.filter((entry) => entry.kind === 'text')]);
      return;
    }
    if (!drawingRef.current) return;
    const point = getCanvasPoint(event);
    if (!point || !lastPointRef.current) return;

    const items = annotationItemsRef.current;
    const currentStroke = [...items].reverse().find((item) => item.kind === 'stroke' && item.mode === annotationMode);
    if (!currentStroke) return;

    currentStroke.points.push(point);
    redrawAnnotationCanvas(items.filter((item) => item.kind === 'stroke'));
    lastPointRef.current = point;
  }

  function handleAnnotationPointerUp() {
    if (draftTextDragRef.current) {
      draftTextDragRef.current = null;
      return;
    }
    if (dragTextRef.current) {
      persistAnnotationItems(annotationItemsRef.current);
      dragTextRef.current = null;
      return;
    }
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    persistAnnotationItems(annotationItemsRef.current);
  }

  // Load the lesson and record the open.
  useEffect(() => {
    if (!id) {
      setLoading(false);
      setLesson(null);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const found = await getLesson(id);
        if (!found) {
          if (!cancelled) { setLesson(null); setLoading(false); }
          return;
        }
        const opened = await recordOpen(id);
        const adj = await getAdjacent(id);
        if (cancelled) return;

        setLesson(opened);
        const parsedItems = parseAnnotationItems(opened.annotations || '');
        annotationItemsRef.current = parsedItems;
        setAnnotationItems(parsedItems.filter((item) => item.kind === 'text'));
        setLanguage('original');
        setAdjacency(adj);
        setProgressPct(Math.round((opened.maxScrollFraction || 0) * 100));
        setLoading(false);
      } catch (err) {
        if (!cancelled) { setError(err.message); setLoading(false); }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => () => {
    clearTimeout(scrollSaveTimerRef.current);
    scrollCleanupRef.current?.();
    scrollCleanupRef.current = null;
    selectionCleanupRef.current?.();
    selectionCleanupRef.current = null;
    clearTimeout(notesTimerRef.current);
  }, [id]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === frameShellRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    syncAnnotationCanvas();
    if (lesson?.annotations) {
      const parsedItems = parseAnnotationItems(lesson.annotations);
      annotationItemsRef.current = parsedItems;
      setAnnotationItems(parsedItems.filter((item) => item.kind === 'text'));
      redrawAnnotationCanvas(parsedItems.filter((item) => item.kind === 'stroke'));
    }
  }, [annotationMode, annotationColor, id, language, lesson?.annotations]);

  async function toggleFullscreen() {
    const shell = frameShellRef.current;
    if (!shell) return;

    try {
      if (document.fullscreenElement === shell) {
        await document.exitFullscreen();
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
        await shell.requestFullscreen();
      } else {
        await shell.requestFullscreen();
      }
    } catch (err) {
      showToast(`Could not change fullscreen mode: ${err.message}`, 'error');
    }
  }

  async function createAnnotationFromSelection(text, mode = annotationMode, color = annotationColor) {
    const clean = normalizeSelectionText(text);
    if (!clean) return;

    const modeMeta = ANNOTATION_MODES[mode] || ANNOTATION_MODES.pen;
    const selectedColor = resolveAnnotationColor(color);
    const title = `${modeMeta.filled} · ${lesson.title}`;
    const noteBody = `${clean}\n\nLesson: ${lesson.title}`;

    try {
      const saved = await createNote({
        title: title.slice(0, 80),
        body: noteBody,
        category: 'lesson',
        color: selectedColor,
        pinned: true,
        tags: `${modeMeta.label}, ${selectedColor}`,
      });
      window.dispatchEvent(new Event('settings-updated'));
      showToast(`Saved to Notes Manager · ${modeMeta.label}`, 'success');
      if (saved?.id) {
        setNotesStatus('Saved to Notes Manager');
      }
    } catch (err) {
      showToast(err.message || 'Could not save note', 'error');
      setNotesStatus('Could not save');
    }
  }

  function getSelectionTextFromFrame() {
    const iframe = frameRef.current;
    const selection = iframe?.contentWindow?.getSelection?.();
    if (!selection) return '';
    return normalizeSelectionText(selection.toString());
  }

  async function handleAnnotationToolSelect(nextMode, nextColor = annotationColor) {
    const mode = nextMode || annotationMode;
    const color = nextColor || annotationColor;
    const nextAnnotationMode = mode || null;
    setAnnotationMode(nextAnnotationMode);
    setAnnotationColor(resolveAnnotationColor(color));
    setTextInputAnchor(null);
    setAnnotationMenuOpen(false);
    setPendingSelection('');
    setPendingSelectionRange(null);

    if (nextAnnotationMode === 'eraser') {
      showToast('Eraser ready — drag over your annotation to remove it.', 'info');
      return;
    }

    if (nextAnnotationMode === 'pen') {
      showToast('Pen ready — draw directly on the lesson page.', 'success');
      return;
    }

    if (nextAnnotationMode === 'text') {
      showToast('Handwriting mode ready — click inside the lesson to place your text.', 'success');
    }
  }

  async function handleSaveSelectedText() {
    const selected = pendingSelection || getSelectionTextFromFrame();
    if (!selected) {
      showToast('Select text first, then tap S to save it.', 'info');
      return;
    }
    setPendingSelection('');
    setPendingSelectionRange(null);
    await createAnnotationFromSelection(selected, annotationMode, annotationColor);
    const iframe = frameRef.current;
    iframe?.contentWindow?.getSelection?.().removeAllRanges?.();
  }

  function commitTextAnnotation() {
    if (!textInputAnchor || !textInputAnchor.value.trim()) {
      setTextInputAnchor(null);
      return;
    }
    const newItem = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      kind: 'text',
      text: textInputAnchor.value.trim(),
      x: textInputAnchor.x,
      y: textInputAnchor.y,
      color: resolveAnnotationColor(annotationColor),
    };
    annotationItemsRef.current = [...annotationItemsRef.current, newItem];
    setAnnotationItems(annotationItemsRef.current.filter((item) => item.kind === 'text'));
    setTextInputAnchor(null);
    persistAnnotationItems(annotationItemsRef.current);
  }

  function beginTextDrag(event, itemId, isDraft = false) {
    event.preventDefault();
    event.stopPropagation();

    if (isDraft) {
      if (!textInputAnchor) return;
      draftTextDragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        originX: textInputAnchor.x,
        originY: textInputAnchor.y,
      };
      return;
    }

    const item = annotationItemsRef.current.find((entry) => entry.id === itemId && entry.kind === 'text');
    if (!item) return;
    dragTextRef.current = {
      itemId,
      startX: event.clientX,
      startY: event.clientY,
      originX: item.x,
      originY: item.y,
    };
  }

  function handleFrameLoad() {
    scrollCleanupRef.current?.();
    scrollCleanupRef.current = null;
    selectionCleanupRef.current?.();
    selectionCleanupRef.current = null;

    const iframe = frameRef.current;
    if (!iframe) return;

    try {
      const win = iframe.contentWindow;
      const doc = iframe.contentDocument;
      if (!win || !doc) throw new Error('The lesson frame could not be accessed.');

      const cursor = annotationMode === 'pen'
        ? resolveAnnotationCursor('pen', annotationColor)
        : annotationMode === 'eraser'
          ? resolveAnnotationCursor('eraser', annotationColor)
          : 'auto';
      doc.body.style.cursor = cursor;
      doc.documentElement.style.cursor = cursor;
      iframe.style.cursor = cursor;
      iframe.style.pointerEvents = 'auto';

      const maxScroll = () => Math.max(0, doc.documentElement.scrollHeight - win.innerHeight);
      const restoreTarget = (lesson?.lastScrollFraction || 0) * maxScroll();
      if (restoreTarget > 0) win.scrollTo(0, restoreTarget);
      setFrameScroll({ x: win.scrollX || 0, y: win.scrollY || 0 });

      const scrollHandler = () => {
        setFrameScroll({ x: win.scrollX || 0, y: win.scrollY || 0 });
        clearTimeout(scrollSaveTimerRef.current);
        scrollSaveTimerRef.current = setTimeout(async () => {
          const maximum = maxScroll();
          const fraction = clampFraction(maximum > 0 ? win.scrollY / maximum : 0);
          try {
            const updated = await recordScrollProgress(id, fraction);
            if (frameRef.current === iframe) {
              setProgressPct(Math.round((updated.maxScrollFraction || 0) * 100));
            }
          } catch (err) {
            console.warn('Could not save lesson scroll position:', err);
          }
        }, 400);
      };

      const selectionHandler = () => {
        const selection = win.getSelection?.();
        const selectedText = normalizeSelectionText(selection?.toString?.() || '');
        if (!selectedText || selectedText.length < 8) {
          setPendingSelection('');
          setPendingSelectionRange(null);
          return;
        }
        const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;
        setPendingSelection(selectedText);
        setPendingSelectionRange(range);
        setNotesStatus('Text selected — choose your pen color and tool');
      };

      win.addEventListener('scroll', scrollHandler);
      doc.addEventListener('mouseup', selectionHandler);
      doc.addEventListener('keyup', selectionHandler);
      scrollCleanupRef.current = () => {
        clearTimeout(scrollSaveTimerRef.current);
        win.removeEventListener('scroll', scrollHandler);
      };
      selectionCleanupRef.current = () => {
        doc.removeEventListener('mouseup', selectionHandler);
        doc.removeEventListener('keyup', selectionHandler);
      };
    } catch (err) {
      console.warn('Could not observe lesson scroll position:', err);
    }
  }

  async function handleToggleComplete() {
    const updated = await toggleCompleted(id);
    setLesson(updated);
    showToast(updated.completed ? 'Marked as completed' : 'Marked as not completed', 'success');
  }

  async function handleToggleBookmark() {
    const updated = await toggleBookmarked(id);
    setLesson(updated);
    showToast(updated.bookmarked ? 'Bookmarked' : 'Bookmark removed', 'success');
  }

  async function handleEnglishUpload(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      const englishHtml = await readFileAsText(file);
      if (!englishHtml.trim()) {
        showToast('That English file is empty.', 'error');
        return;
      }
      setLesson((current) => ({ ...current, englishHtml, hasEnglishVersion: true }));
      setLanguage('english');
      const updated = await updateLesson(id, { englishHtml });
      setLesson(updated);
      showToast('English version attached to this lesson', 'success');
    } catch (err) {
      setLesson((current) => current?.id === lesson?.id ? lesson : current);
      setLanguage('original');
      showToast(err.message, 'error');
    }
  }

  function getNotes() {
    if (!lesson?.notes) return [];
    try {
      const parsed = JSON.parse(lesson.notes);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [{ id: 'legacy-note', text: lesson.notes, createdAt: lesson.updatedAt || Date.now() }];
    }
    return [];
  }

  async function saveNote() {
    const text = noteDraft.trim();
    if (!text) return;
    const notes = [...getNotes(), { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text, createdAt: Date.now() }];
    setNotesStatus('Saving...');
    try {
      const updated = await saveNotes(id, JSON.stringify(notes));
      setLesson(updated);
      setNoteDraft('');
      setNotesStatus('Saved to lesson');
    } catch (err) {
      setNotesStatus('Could not save');
      showToast(err.message, 'error');
    }
  }

  if (!id) {
    return (
      <div className="p-space-lg">
        <div className="rounded-xl bg-surface-container-low p-space-xl text-center flex flex-col items-center gap-space-sm max-w-md mx-auto">
          <span className="material-symbols-outlined text-outline" style={{ fontSize: 36 }}>quiz</span>
          <p className="font-body-md text-body-md text-on-surface">No lesson selected</p>
          <button onClick={() => navigate('/lessons')} className="px-space-md py-space-sm rounded bg-primary-container text-on-primary font-body-sm text-body-sm font-semibold">Open Lessons Library</button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="p-space-lg"><p className="font-body-sm text-body-sm text-on-surface-variant">Loading lesson\u2026</p></div>;

  if (error) {
    return (
      <div className="p-space-lg">
        <div className="rounded-xl bg-surface-container-low p-space-lg shadow-md max-w-xl">
          <p className="font-headline-sm text-headline-sm text-error mb-space-xs">This lesson couldn't be opened</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">{error}</p>
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="p-space-lg">
        <div className="rounded-xl bg-surface-container-low p-space-xl text-center flex flex-col items-center gap-space-sm max-w-md mx-auto">
          <span className="material-symbols-outlined text-error" style={{ fontSize: 36 }}>error_outline</span>
          <p className="font-body-md text-body-md text-on-surface">This lesson doesn't exist anymore</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">It may have been deleted, or the link is out of date.</p>
          <button onClick={() => navigate('/lessons')} className="px-space-md py-space-sm rounded bg-primary-container text-on-primary font-body-sm text-body-sm font-semibold">Open Lessons Library</button>
        </div>
      </div>
    );
  }

  const hasEnglishVersion = lesson.hasEnglishVersion || Boolean(lesson.englishHtml);

  return (
    <>
      <div className="sticky top-16 z-20 bg-surface-container-lowest px-space-md py-space-sm shadow-md flex flex-col gap-space-xs">
        <div className="flex flex-wrap items-center justify-between gap-space-sm">
          <div className="flex items-center gap-space-sm min-w-0">
            <button onClick={() => navigate('/lessons')} className="text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1 shrink-0">
              <span className="material-symbols-outlined text-body-md">arrow_back</span>
              <span className="font-code-inline text-code-inline hidden sm:inline">Library</span>
            </button>
            <span className="text-outline-variant">/</span>
            <h1 className="font-headline-sm text-headline-sm text-on-surface truncate">{lesson.title}</h1>
          </div>
          <div className="flex items-center gap-space-xs shrink-0">
            <button
              disabled={!adjacency.prev}
              onClick={() => adjacency.prev && navigate(`/lesson-sandbox/${adjacency.prev.id}`)}
              className="p-1.5 rounded bg-surface-container-high text-on-surface disabled:opacity-30 disabled:cursor-not-allowed"
              title="Previous lesson"
            >
              <span className="material-symbols-outlined text-headline-sm">chevron_left</span>
            </button>
            <span className="font-label-caps text-label-caps text-outline">{adjacency.index + 1} / {adjacency.total}</span>
            <button
              disabled={!adjacency.next}
              onClick={() => adjacency.next && navigate(`/lesson-sandbox/${adjacency.next.id}`)}
              className="p-1.5 rounded bg-surface-container-high text-on-surface disabled:opacity-30 disabled:cursor-not-allowed"
              title="Next lesson"
            >
              <span className="material-symbols-outlined text-headline-sm">chevron_right</span>
            </button>
            <button onClick={handleToggleBookmark} className={`p-1.5 rounded bg-surface-container-high transition-colors ${lesson.bookmarked ? 'text-primary' : 'text-on-surface'}`} title="Bookmark">
              <span className="material-symbols-outlined text-headline-sm">{lesson.bookmarked ? 'bookmark' : 'bookmark_border'}</span>
            </button>
            <button
              onClick={handleToggleComplete}
              className={`px-space-sm py-1.5 rounded flex items-center gap-1 font-label-caps text-label-caps font-semibold ${
                lesson.completed ? 'bg-tertiary/20 text-tertiary' : 'bg-primary-container text-on-primary'
              }`}
            >
              <span className="material-symbols-outlined text-body-md">{lesson.completed ? 'check_circle' : 'radio_button_unchecked'}</span>
              {lesson.completed ? 'Completed' : 'Mark complete'}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-space-sm">
          <div className="w-full h-1.5 rounded-full bg-surface-container-highest overflow-hidden max-w-md">
            <div className="h-full bg-primary-container transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="font-label-caps text-label-caps text-outline shrink-0">{progressPct}% read</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-md p-space-md lg:p-space-lg">
        <div className="xl:col-span-9 flex flex-col">
          <div
            ref={frameShellRef}
            className={`lesson-shell rounded-xl bg-surface-container-lowest overflow-hidden shadow-xl flex flex-col ${isFullscreen ? 'lesson-shell-fullscreen' : ''}`}
            style={{ height: 'calc(100vh - 13rem)' }}
          >
            <div className="bg-surface-container-high px-space-md py-space-xs flex items-center justify-between shrink-0">
              <div className="flex items-center gap-space-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-error/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-primary/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-tertiary/70" />
                <span className="font-code-inline text-[12px] text-on-surface-variant ml-space-xs flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs text-tertiary">verified_user</span>
                  lesson preview
                </span>
              </div>
              <div className="flex items-center gap-space-xs">
                {hasEnglishVersion ? (
                  <>
                    <button
                      type="button"
                      className={`lesson-language-toggle ${language === 'original' ? 'lesson-language-toggle-active' : ''}`}
                      onClick={() => setLanguage('original')}
                      title="Show original lesson"
                      aria-label="Show original lesson"
                    >
                      <span className="material-symbols-outlined text-body-md">language</span>
                    </button>
                    <button
                      type="button"
                      className={`lesson-language-toggle ${language === 'english' ? 'lesson-language-toggle-active' : ''}`}
                      onClick={() => setLanguage('english')}
                      title="Show English version"
                      aria-label="Show English version"
                    >
                      <span className="font-code-inline text-[0.7rem] font-bold">EN</span>
                    </button>
                  </>
                ) : (
                  <label className="lesson-add-language-button" title="Attach an English version">
                    <input
                      type="file"
                      accept=".html,.htm,.txt,text/html,text/plain"
                      onChange={handleEnglishUpload}
                      className="hidden"
                    />
                    <span className="material-symbols-outlined text-body-md">translate</span>
                    <span>Add EN</span>
                  </label>
                )}
                <div className="lesson-annotation-tools" aria-label="Lesson annotation tools">
                  <button
                    type="button"
                    className="lesson-annotation-toggle"
                    onClick={() => setAnnotationMenuOpen((open) => !open)}
                    aria-expanded={annotationMenuOpen}
                    aria-label="Open annotation tools"
                  >
                    <span className="material-symbols-outlined">{annotationMode === 'eraser' ? 'ink_eraser' : annotationMode === 'text' ? 'title' : 'edit'}</span>
                    <span>{annotationMode === 'eraser' ? 'Eraser' : annotationMode === 'text' ? 'Handwriting' : 'Pen'}</span>
                  </button>
                  <button
                    type="button"
                    className="lesson-save-selection"
                    onClick={handleSaveSelectedText}
                    aria-label="Save selected text to Notes Manager"
                    title="Save selected text to notes"
                  >
                    <span>S</span>
                  </button>
                  {annotationMenuOpen && (
                    <div className="lesson-annotation-menu" role="menu" aria-label="Annotation menu">
                      <div className="lesson-annotation-types">
                        {Object.entries(ANNOTATION_MODES).map(([key, meta]) => (
                          <button
                            key={key}
                            type="button"
                            className={`lesson-annotation-option ${annotationMode === key ? 'active' : ''}`}
                            onClick={() => handleAnnotationToolSelect(key)}
                          >
                            <span className="material-symbols-outlined">{meta.icon}</span>
                            <span>{meta.label}</span>
                          </button>
                        ))}
                      </div>
                      {annotationMode === 'eraser' && (
                        <div className="lesson-annotation-size-wrap" aria-label="Eraser size">
                          <div className="lesson-annotation-size-label-row">
                            <span>Eraser size</span>
                            <strong>{annotationBrushSize}px</strong>
                          </div>
                          <input
                            type="range"
                            min="8"
                            max="42"
                            step="2"
                            value={annotationBrushSize}
                            onChange={(event) => setAnnotationBrushSize(Number(event.target.value))}
                            className="lesson-annotation-size-slider"
                          />
                        </div>
                      )}
                      <div className="lesson-annotation-palette" aria-label="Annotation colors">
                        {ANNOTATION_COLORS.map((entry) => (
                          <button
                            key={entry.value}
                            type="button"
                            className={`lesson-color-swatch ${annotationColor === entry.value ? 'active' : ''}`}
                            title={entry.label}
                            aria-label={`Use ${entry.label} annotation color`}
                            style={{ background: entry.swatch }}
                            onClick={() => handleAnnotationToolSelect(annotationMode, entry.value)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="flex items-center gap-1 rounded px-2 py-1 text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-colors"
                  title={isFullscreen ? 'Exit fullscreen' : 'Open lesson fullscreen'}
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Open lesson fullscreen'}
                >
                  <span className="material-symbols-outlined text-body-md">{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
                  <span className="font-label-caps text-[10px] hidden sm:inline">{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
                </button>
              </div>
            </div>
            <div ref={frameHostRef} className="flex-1 min-h-0 relative" onPointerMove={handleAnnotationPointerMove} onPointerUp={handleAnnotationPointerUp} onPointerLeave={handleAnnotationPointerUp}>
              {annotationItems.filter((item) => item.kind === 'text').map((item) => (
                <div
                  key={item.id}
                  className="lesson-handwriting-note"
                  style={{
                    left: `${item.x - frameScroll.x}px`,
                    top: `${item.y - frameScroll.y}px`,
                    color: HIGHLIGHT_COLORS[resolveAnnotationColor(item.color)] || HIGHLIGHT_COLORS.yellow,
                  }}
                  onDoubleClick={(event) => beginTextDrag(event, item.id)}
                >
                  {item.text}
                </div>
              ))}
              {textInputAnchor && (
                <div
                  className="lesson-handwriting-editor"
                  style={{ left: `${textInputAnchor.x - frameScroll.x}px`, top: `${textInputAnchor.y - frameScroll.y}px` }}
                  onDoubleClick={(event) => beginTextDrag(event, null, true)}
                >
                  <input
                    autoFocus
                    value={textInputAnchor.value}
                    onChange={(event) => setTextInputAnchor((current) => (current ? { ...current, value: event.target.value } : current))}
                    onBlur={commitTextAnnotation}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        commitTextAnnotation();
                      }
                    }}
                    style={{ color: HIGHLIGHT_COLORS[resolveAnnotationColor(annotationColor)] || HIGHLIGHT_COLORS.yellow }}
                  />
                </div>
              )}
              <iframe
                ref={frameRef}
                key={`${lesson.id}-${language}`}
                className="lesson-frame"
                title={`Lesson: ${lesson.title}`}
                srcDoc={language === 'english' && lesson.englishHtml ? lesson.englishHtml : lesson.html}
                loading="eager"
                onLoad={handleFrameLoad}
                style={{
                  cursor: annotationMode === 'pen' ? buildPenCursorDataUrl(annotationColor) : annotationMode === 'eraser' ? 'not-allowed' : 'auto',
                  pointerEvents: annotationMode === 'pen' || annotationMode === 'eraser' ? 'none' : 'auto',
                  position: 'relative',
                  zIndex: 1,
                }}
              />
              <canvas
                ref={annotationCanvasRef}
                className="lesson-annotation-canvas"
                onPointerDown={handleAnnotationPointerDown}
                onPointerMove={handleAnnotationPointerMove}
                onPointerUp={handleAnnotationPointerUp}
                onPointerLeave={handleAnnotationPointerUp}
                onPointerCancel={handleAnnotationPointerUp}
                style={{
                  pointerEvents: annotationMode === 'pen' || annotationMode === 'eraser' ? 'auto' : 'none',
                  cursor: resolveAnnotationCursor(annotationMode, annotationColor),
                  zIndex: 2,
                }}
              />
            </div>
          </div>
        </div>

        <div className="xl:col-span-3 flex flex-col gap-space-md">
          <LessonDetails lesson={lesson} />

          <div className="lesson-notes-panel">
            <button type="button" onClick={() => setShowNotes((visible) => !visible)} className="lesson-notes-toggle" aria-expanded={showNotes}>
              <span className="material-symbols-outlined">sticky_note_2</span>
              <span>Notes</span>
              <span className="lesson-notes-count">{getNotes().length}</span>
              <span className="material-symbols-outlined lesson-notes-chevron">{showNotes ? 'expand_less' : 'expand_more'}</span>
            </button>
            {showNotes && <div className="lesson-notes-content">
              <div className="lesson-note-compose">
                <textarea
                  rows={3}
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  className="lesson-note-input"
                  placeholder="Write a note about this lesson..."
                />
                <button type="button" onClick={saveNote} disabled={!noteDraft.trim()} className="lesson-note-save" title="Save note" aria-label="Save note">
                  <span className="material-symbols-outlined">save</span>
                </button>
              </div>
              <div className="lesson-notes-list">
                {getNotes().map((note) => <article key={note.id} className="lesson-sticky-note"><span className="lesson-sticky-pin" /><p>{note.text}</p></article>)}
                {!getNotes().length && <p className="lesson-notes-empty">Your saved notes will appear here.</p>}
              </div>
              <span className="lesson-notes-status">{notesStatus}</span>
            </div>}
          </div>
        </div>
      </div>
    </>
  );
}

function LessonDetails({ lesson }) {
  const details = [
    { label: 'Category', value: lesson.category || 'Uncategorized', icon: 'category' },
    { label: 'Reading time', value: `${lesson.readingTimeMin} min`, icon: 'schedule' },
    { label: 'Word count', value: lesson.wordCount.toLocaleString(), icon: 'format_size' },
    { label: 'Opened', value: `${lesson.openCount} time${lesson.openCount === 1 ? '' : 's'}`, icon: 'visibility' },
  ];
  return <section className="lesson-details-card">
    <div className="lesson-details-heading"><span className="lesson-details-icon material-symbols-outlined">analytics</span><div><p>Lesson details</p><span>At a glance</span></div></div>
    <div className="lesson-details-grid">{details.map((detail) => <div className="lesson-detail-item" key={detail.label}><span className="material-symbols-outlined">{detail.icon}</span><div><small>{detail.label}</small><strong>{detail.value}</strong></div></div>)}</div>
    {lesson.sourceFileName && <div className="lesson-source-file"><span className="material-symbols-outlined">description</span><div><small>Source file</small><strong title={lesson.sourceFileName}>{lesson.sourceFileName}</strong></div></div>}
  </section>;
}
