import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { readFileAsText, parseLessonHtml, LessonParseError } from '../lib/lesson-parser.js';
import { createLesson, listCategories } from '../lib/lessons-repo.js';
import { useToast } from '../context/ToastContext.jsx';

export default function Importer() {
  const navigate = useNavigate();
  const showToast = useToast();
  const fileInputRef = useRef(null);

  const [step, setStep] = useState('dropzone'); // dropzone | parsing | preview | error
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [parsed, setParsed] = useState(null);
  const [categories, setCategories] = useState([]);
  const [titleInput, setTitleInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [englishFileName, setEnglishFileName] = useState('');
  const [englishHtml, setEnglishHtml] = useState('');

  async function handleFile(file) {
    setFileName(file.name);
    setStep('parsing');
    try {
      const rawHtml = await readFileAsText(file);
      const fallbackTitle = file.name.replace(/\.html?$/i, '');
      const result = parseLessonHtml(rawHtml, fallbackTitle);
      const cats = await listCategories();
      setParsed(result);
      setCategories(cats);
      setTitleInput(result.title);
      setCategoryInput('');
      setEnglishFileName('');
      setEnglishHtml('');
      setStep('preview');
    } catch (err) {
      setErrorMessage(err instanceof LessonParseError ? err.message : 'Something went wrong while reading that file. Please try again.');
      setStep('error');
    }
  }

  function resetToDropzone() {
    setStep('dropzone');
    setParsed(null);
    setErrorMessage('');
  }

  async function handleConfirm() {
    if (!parsed) return;
    setSaving(true);
    try {
      const lesson = await createLesson({
        ...parsed,
        title: titleInput.trim() || parsed.title,
        category: categoryInput.trim(),
        sourceFileName: fileName,
        englishHtml,
      });
      showToast('Lesson imported', 'success');
      navigate(`/lesson-sandbox/${lesson.id}`);
    } finally {
      setSaving(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className="p-space-md lg:p-space-lg max-w-2xl mx-auto flex flex-col gap-space-md">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Import Center</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Upload one of your own HTML lesson files.</p>
      </div>

      {step === 'dropzone' && (
        <div
          onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
          onDrop={onDrop}
          className={`rounded-xl p-space-xl text-center transition-colors ${dragging ? 'bg-surface-container-high' : 'bg-surface-container-low'}`}
        >
          <div className="flex justify-center mb-space-md">
            <div className="w-20 h-20 rounded-2xl bg-primary-container/15 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 40 }}>upload_file</span>
            </div>
          </div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">Drop a lesson HTML file here</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-space-xs max-w-md mx-auto">
            Or choose a file below. NEXUS reads it, extracts metadata, and keeps the original lesson markup intact so the design and animations render as authored.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".html,.htm"
            className="hidden"
            onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
          />
          <div className="mt-space-lg flex flex-wrap items-center justify-center gap-space-sm">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-space-md py-space-sm rounded-xl bg-primary-container text-on-primary font-semibold text-body-md flex items-center gap-space-xs"
            >
              <span className="material-symbols-outlined text-body-md">description</span>
              Choose HTML file
            </button>
            <button
              disabled
              title="Coming soon \u2014 import lessons one file at a time for now"
              className="px-space-md py-space-sm rounded-xl bg-surface-container-high text-on-surface-variant font-medium text-body-md flex items-center gap-space-xs opacity-50 cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-body-md">folder_zip</span>
              Import folder / ZIP
            </button>
          </div>
        </div>
      )}

      {step === 'parsing' && (
        <div className="rounded-xl bg-surface-container-low p-space-xl text-center flex flex-col items-center gap-space-sm">
          <span className="material-symbols-outlined text-primary animate-spin" style={{ fontSize: 32 }}>progress_activity</span>
          <p className="font-body-md text-body-md text-on-surface">Reading {fileName}\u2026</p>
        </div>
      )}

      {step === 'error' && (
        <div className="rounded-xl bg-surface-container-low p-space-xl text-center flex flex-col items-center gap-space-sm">
          <span className="material-symbols-outlined text-error" style={{ fontSize: 32 }}>error_outline</span>
          <p className="font-body-md text-body-md text-on-surface">Couldn't import that file</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant max-w-sm">{errorMessage}</p>
          <button onClick={resetToDropzone} className="mt-space-xs px-space-md py-space-sm rounded bg-surface-container-high text-on-surface font-body-sm text-body-sm font-medium">Try another file</button>
        </div>
      )}

      {step === 'preview' && parsed && (
        <div className="rounded-xl bg-surface-container-low p-space-lg flex flex-col gap-space-md">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-label-caps uppercase text-primary">Ready to import</span>
            <span className="font-label-caps text-label-caps text-outline">{fileName}</span>
          </div>

          <div className="flex flex-col gap-space-xs">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase">Title</label>
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              className="bg-surface-container px-space-sm py-space-xs rounded-lg text-on-surface font-body-md text-body-md focus:outline-none focus:ring-1 focus:ring-primary-container"
            />
          </div>

          <div className="flex flex-col gap-space-xs">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase">Category</label>
            <input
              list="category-options"
              type="text"
              value={categoryInput}
              onChange={(e) => setCategoryInput(e.target.value)}
              placeholder="e.g. Machine Learning"
              className="bg-surface-container px-space-sm py-space-xs rounded-lg text-on-surface font-body-md text-body-md focus:outline-none focus:ring-1 focus:ring-primary-container"
            />
            <datalist id="category-options">
              {categories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>

          <div className="rounded-lg bg-surface-container p-space-sm">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-1">Preview</span>
            <p className="font-body-sm text-body-sm text-on-surface-variant">{parsed.excerpt || 'No readable text was found in this file.'}</p>
          </div>

          <div className="english-version-box">
            <div>
              <p className="font-body-sm text-body-sm font-semibold text-on-surface flex items-center gap-1.5"><span className="material-symbols-outlined text-primary text-body-md">translate</span>English version <span className="font-label-caps text-label-caps text-outline">optional</span></p>
              <p className="font-label-caps text-label-caps text-outline mt-1">Attach an English HTML lesson. It will stay inside this lesson, not create a second Library card.</p>
            </div>
            <input id="english-lesson-file" type="file" accept=".html,.htm" className="english-version-input" onChange={async (e) => { const file = e.target.files[0]; if (!file) return; setEnglishFileName(file.name); setEnglishHtml(await readFileAsText(file)); }} />
            <label htmlFor="english-lesson-file" className="english-version-picker"><span className="material-symbols-outlined">{englishHtml ? 'check_circle' : 'upload_file'}</span><span>{englishFileName || 'Choose English HTML file'}</span></label>
            {englishHtml && <p className="font-label-caps text-label-caps text-tertiary">English version ready to attach</p>}
          </div>

          <div className="flex flex-wrap gap-1.5 font-label-caps text-label-caps">
            <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface">{parsed.wordCount.toLocaleString()} words</span>
            <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface">{parsed.readingTimeMin} min read</span>
            {parsed.hasCode && <span className="px-2 py-0.5 rounded bg-surface-container-high text-tertiary">Has code blocks</span>}
            {parsed.hasQuiz && <span className="px-2 py-0.5 rounded bg-surface-container-high text-secondary">Mentions a quiz</span>}
          </div>

          <div className="flex items-center justify-between gap-space-sm pt-space-xs">
            <button onClick={resetToDropzone} className="px-space-md py-space-sm rounded bg-surface-container-high text-on-surface font-body-sm text-body-sm font-medium">Choose a different file</button>
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="px-space-md py-space-sm rounded bg-primary-container text-on-primary font-body-sm text-body-sm font-semibold flex items-center gap-space-xs disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-body-md">check</span>
              {saving ? 'Saving\u2026' : 'Save lesson'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
