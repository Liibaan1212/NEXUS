export function mapLesson(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    excerpt: row.excerpt || '',
    wordCount: row.word_count || 0,
    readingTimeMin: row.reading_time_min || 1,
    hasCode: !!row.has_code,
    hasQuiz: !!row.has_quiz,
    sourceFileName: row.source_file_name || '',
    html: row.html,
    englishHtml: row.english_html || '',
    hasEnglishVersion: Boolean(row.english_html),
    annotations: row.annotations || '',
    notes: row.notes || '',
    completed: !!row.completed,
    bookmarked: !!row.bookmarked,
    maxScrollFraction: row.max_scroll_fraction || 0,
    lastScrollFraction: row.last_scroll_fraction || 0,
    openCount: row.open_count || 0,
    lastOpenedAt: row.last_opened_at ?? null,
    week: row.week ?? null,
    day: row.day ?? null,
    track: row.track ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapNote(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    body: row.body || '',
    tags: row.tags || '',
    color: row.color || 'sun',
    category: row.category || 'lesson',
    pinned: !!row.pinned,
    remindAt: row.remind_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSnippet(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    language: row.language || 'javascript',
    code: row.code || '',
    description: row.description || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapProject(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    status: row.status || 'active',
    architecture: row.architecture || '',
    sourcePath: row.source_path || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapFlashcard(row) {
  if (!row) return null;
  return {
    id: row.id,
    front: row.front,
    back: row.back,
    lessonId: row.lesson_id || null,
    ease: row.ease || 0,
    nextReviewAt: row.next_review_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapResource(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    url: row.url || '',
    type: row.type || 'link',
    notes: row.notes || '',
    createdAt: row.created_at,
  };
}

export function mapDataset(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    pathOrUrl: row.path_or_url || '',
    format: row.format || '',
    createdAt: row.created_at,
  };
}

export function mapInterview(row) {
  if (!row) return null;
  return {
    id: row.id,
    question: row.question,
    answer: row.answer || '',
    category: row.category || 'general',
    difficulty: row.difficulty || 'medium',
    createdAt: row.created_at,
  };
}

export function mapIssue(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    status: row.status || 'open',
    lessonId: row.lesson_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapConcept(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    mastery: row.mastery || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapChecklist(row) {
  if (!row) return null;
  return {
    id: row.id,
    label: row.label,
    done: !!row.done,
    category: row.category || 'general',
    sortOrder: row.sort_order || 0,
  };
}

export function mapChat(row) {
  if (!row) return null;
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  };
}
