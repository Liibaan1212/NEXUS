import { api } from './api.js';

export const getSettings = () => api.get('/settings');
export const saveSettings = (data) => api.put('/settings', data);
export const getStorage = () => api.get('/storage');

export const listNotes = () => api.get('/notes');
export const createNote = (data) => api.post('/notes', data);
export const updateNote = (id, data) => api.patch(`/notes/${id}`, data);
export const deleteNote = (id) => api.delete(`/notes/${id}`);

export const listSnippets = () => api.get('/snippets');
export const createSnippet = (data) => api.post('/snippets', data);
export const updateSnippet = (id, data) => api.patch(`/snippets/${id}`, data);
export const deleteSnippet = (id) => api.delete(`/snippets/${id}`);

export const listProjects = (status) => api.get(`/projects${status ? `?status=${encodeURIComponent(status)}` : ''}`);
export const syncProjects = () => api.post('/projects/sync');
export const importProject = (data) => api.post('/projects/import', data);
export const listProjectFiles = (id) => api.get(`/projects/${id}/files`);
export const createProject = (data) => api.post('/projects', data);
export const updateProject = (id, data) => api.patch(`/projects/${id}`, data);
export const deleteProject = (id) => api.delete(`/projects/${id}`);

export const listFlashcards = () => api.get('/flashcards');
export const listDueFlashcards = () => api.get('/flashcards/due');
export const createFlashcard = (data) => api.post('/flashcards', data);
export const reviewFlashcard = (id, quality) => api.post(`/flashcards/${id}/review`, { quality });
export const deleteFlashcard = (id) => api.delete(`/flashcards/${id}`);
export const flashcardFromLesson = (lessonId) => api.post(`/flashcards/from-lesson/${lessonId}`);

export const listResources = () => api.get('/resources');
export const createResource = (data) => api.post('/resources', data);
export const deleteResource = (id) => api.delete(`/resources/${id}`);

export const listDatasets = () => api.get('/datasets');
export const createDataset = (data) => api.post('/datasets', data);
export const updateDataset = (id, data) => api.patch(`/datasets/${id}`, data);
export const deleteDataset = (id) => api.delete(`/datasets/${id}`);
export const syncDatasets = () => api.post('/datasets/sync');
export const getDatasetSummary = () => api.get('/datasets/summary');
export const previewDataset = (id) => api.get(`/datasets/${id}/preview`);

export const listInterview = () => api.get('/interview');
export const createInterview = (data) => api.post('/interview', data);
export const deleteInterview = (id) => api.delete(`/interview/${id}`);

export const listDebug = () => api.get('/debug');
export const createDebug = (data) => api.post('/debug', data);
export const updateDebug = (id, data) => api.patch(`/debug/${id}`, data);
export const deleteDebug = (id) => api.delete(`/debug/${id}`);

export const listConcepts = () => api.get('/concepts');
export const createConcept = (data) => api.post('/concepts', data);
export const updateConcept = (id, data) => api.patch(`/concepts/${id}`, data);
export const deleteConcept = (id) => api.delete(`/concepts/${id}`);

export const listChecklist = () => api.get('/checklist');
export const toggleChecklist = (id, done) => api.patch(`/checklist/${id}`, { done });

export const getAnalytics = () => api.get('/analytics');
export const getWeakAreas = () => api.get('/weak-areas');
export const getRevision = () => api.get('/revision');

export const listTutorMessages = () => api.get('/tutor/messages');
export const clearTutorMessages = () => api.delete('/tutor/messages');
export const askTutor = (question) => api.post('/tutor/ask', { question });

export const runCodeLab = (code) => api.post('/code-lab/run', { code });

export const submitExam = (data) => api.post('/exam/submit', data);
export const submitChallenge = (data) => api.post('/challenges/result', data);
export const markInterviewPractice = (id, known) => api.post(`/interview/${id}/practice`, { known });
export const listPractice = (kind) => api.get(`/practice${kind ? `?kind=${encodeURIComponent(kind)}` : ''}`);
export const reviewFlashcardDue = () => api.get('/flashcards/due');
