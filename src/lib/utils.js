// Pure helpers only. Nothing in this file touches the DOM, IndexedDB, or any
// browser-only global, so it can be unit tested directly with Node's test
// runner (see test/logic.test.mjs) without a browser.

export function generateId() {
  return 'lsn_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

export function computeWordCount(text) {
  const trimmed = (text || '').trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function computeExcerpt(text, maxLen = 220) {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen).trim() + '\u2026';
}

export function computeReadingTime(wordCount, wordsPerMinute = 200) {
  return Math.max(1, Math.round((wordCount || 0) / wordsPerMinute));
}

export function buildLessonReviewCard(lesson) {
  if (!lesson) return null;

  const sourceText = [lesson.excerpt, lesson.title, lesson.category, lesson.notes || '', lesson.html || '']
    .filter(Boolean)
    .join(' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const answer = sourceText ? sourceText.slice(0, 320) : 'Review this lesson to capture the main concept and key takeaway.';

  return {
    id: `lesson-review-${lesson.id}`,
    front: `What is the main idea behind “${lesson.title}”?`,
    back: answer,
    lessonId: lesson.id,
    sourceLessonId: lesson.id,
    sourceTitle: lesson.title,
    sourceCategory: lesson.category,
  };
}

export function generateInterviewQuestionsFromLessons(lessons = []) {
  const items = Array.isArray(lessons) ? lessons : [];
  if (!items.length) return [];

  return items.slice(0, 10).map((lesson, index) => {
    const sourceText = [
      lesson.title,
      lesson.category,
      lesson.excerpt,
      lesson.notes || '',
      lesson.html || ''
    ]
      .filter(Boolean)
      .join(' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const concept = lesson.title || 'this lesson';
    const summary = sourceText ? sourceText.slice(0, 260) : 'Review the lesson concept and explain it clearly.';

    return {
      id: `lesson-question-${lesson.id || index}`,
      question: `In the context of “${concept}”, what is the most important concept or tradeoff an interviewer would expect you to explain?`,
      answer: `This topic is about ${concept}. The key idea is that ${summary}. If asked in an interview, explain the core concept, why it matters, and a concrete example or implementation tradeoff relevant to ${lesson.category || 'the domain'}.`,
      category: lesson.category || 'general',
      difficulty: index % 2 === 0 ? 'medium' : 'hard',
      lessonId: lesson.id || null,
      generatedFromLesson: true,
    };
  });
}

export function pickTitle(candidates, fallback) {
  for (const candidate of candidates) {
    if (candidate && String(candidate).trim()) return String(candidate).trim();
  }
  return fallback;
}

export function formatRelativeTime(timestamp) {
  if (!timestamp) return 'Never opened';
  const diffMs = Date.now() - timestamp;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function sortByCreatedAtAsc(lessons) {
  return [...lessons].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

export function sortByCreatedAtDesc(lessons) {
  return [...lessons].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function sortLessonsForDisplay(lessons, mode = 'recent') {
  const items = [...lessons];
  if (mode === 'newest') return sortByCreatedAtDesc(items);
  if (mode === 'oldest') return sortByCreatedAtAsc(items);
  return items.sort((a, b) => {
    const aTime = a.lastOpenedAt || a.createdAt || 0;
    const bTime = b.lastOpenedAt || b.createdAt || 0;
    return bTime - aTime;
  });
}

export function sortByLastOpenedDesc(lessons) {
  return [...lessons]
    .filter((l) => l.lastOpenedAt)
    .sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0));
}

// status: 'all' | 'completed' | 'in-progress' | 'not-started' | 'bookmarked'
export function filterLessons(lessons, { query, category, status } = {}) {
  let result = lessons;

  if (query && query.trim()) {
    const normalize = (value) => String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    const q = normalize(query);
    result = result.filter((l) =>
      normalize(l.title).includes(q) ||
      normalize(l.excerpt).includes(q) ||
      normalize(l.category).includes(q) ||
      normalize(l.html).includes(q)
    );
  }

  if (category && category !== 'all') {
    result = result.filter((l) => l.category === category);
  }

  if (status && status !== 'all') {
    if (status === 'completed') result = result.filter((l) => l.completed);
    else if (status === 'in-progress') result = result.filter((l) => !l.completed && (l.maxScrollFraction || 0) > 0);
    else if (status === 'not-started') result = result.filter((l) => !l.completed && !((l.maxScrollFraction || 0) > 0));
    else if (status === 'bookmarked') result = result.filter((l) => l.bookmarked);
  }

  return result;
}

export function computeStats(lessons) {
  const total = lessons.length;
  const completed = lessons.filter((l) => l.completed).length;
  const inProgress = lessons.filter((l) => !l.completed && (l.maxScrollFraction || 0) > 0).length;
  const bookmarked = lessons.filter((l) => l.bookmarked).length;
  const percentComplete = total ? Math.round((completed / total) * 100) : 0;
  return { total, completed, inProgress, bookmarked, percentComplete };
}

export function getAdjacentLessons(orderedLessons, currentId) {
  const index = orderedLessons.findIndex((l) => l.id === currentId);
  return {
    index,
    total: orderedLessons.length,
    prev: index > 0 ? orderedLessons[index - 1] : null,
    next: index >= 0 && index < orderedLessons.length - 1 ? orderedLessons[index + 1] : null,
  };
}

// The lesson a person should probably pick up next: the most recently
// opened lesson that isn't finished yet, otherwise the oldest unfinished
// lesson, otherwise null if everything is done (or there's nothing yet).
export function pickContinueLesson(lessons) {
  const unfinished = lessons.filter((l) => !l.completed);
  if (unfinished.length === 0) return null;
  const recentlyOpened = sortByLastOpenedDesc(unfinished);
  if (recentlyOpened.length) return recentlyOpened[0];
  return sortByCreatedAtAsc(unfinished)[0];
}

export function uniqueCategories(lessons) {
  return [...new Set(lessons.map((l) => l.category).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}

export function clampFraction(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]);
}
