export const NOTE_CACHE_KEY = 'nexus-notes-cache';

export function readCachedNotes(key = NOTE_CACHE_KEY, fallback = []) {
  try {
    const value = window.localStorage.getItem(key);
    if (!value) return fallback;
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function writeCachedNotes(notes, key = NOTE_CACHE_KEY) {
  try {
    window.localStorage.setItem(key, JSON.stringify(Array.isArray(notes) ? notes : []));
  } catch {
    // Ignore storage failures so reading remains usable in-browser.
  }
}

export function mergeNotesWithCache(serverNotes = [], localNotes = []) {
  const remote = Array.isArray(serverNotes) ? serverNotes : [];
  const local = Array.isArray(localNotes) ? localNotes : [];
  const merged = [...remote];
  const remoteIds = new Set(remote.map((note) => String(note.id)));

  for (const note of local) {
    if (!remoteIds.has(String(note.id))) {
      merged.push(note);
    }
  }

  return merged;
}

export function upsertNoteInList(existing = [], incoming) {
  if (!incoming) return [...existing];

  const next = { ...incoming };
  const targetId = next.id == null ? null : String(next.id);
  const records = Array.isArray(existing) ? existing : [];

  if (!targetId) {
    return [next, ...records];
  }

  return [next, ...records.filter((note) => String(note.id) !== targetId)];
}

export function removeNoteFromList(existing = [], noteId) {
  if (noteId == null) return [...existing];

  const targetId = String(noteId);
  return (Array.isArray(existing) ? existing : []).filter((note) => String(note.id) !== targetId);
}
