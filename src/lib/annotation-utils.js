export const ANNOTATION_COLORS = [
  { value: 'yellow', label: 'Yellow', swatch: '#ffd166' },
  { value: 'sky', label: 'Sky', swatch: '#8dd3ff' },
  { value: 'rose', label: 'Rose', swatch: '#ff9fb1' },
  { value: 'mint', label: 'Mint', swatch: '#8fe3c4' },
  { value: 'violet', label: 'Violet', swatch: '#c7afff' },
];

export function buildPenCursorDataUrl(color) {
  const activeColor = ANNOTATION_COLORS.some((entry) => entry.value === color) ? color : 'yellow';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
      <path d="M18.3 2.8l7.1 7.1-10.6 10.6-7.1-7.1 10.6-10.6Z" fill="${activeColor}" opacity="0.95"/>
      <path d="M2.4 25.6 7.8 24l-1.9-1.9-3.5 3.5Z" fill="#171b22"/>
      <path d="M15.5 9.5l3.2 3.2" stroke="#171b22" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M16.8 5.7l5.5 5.5" stroke="#171b22" stroke-width="1.3" stroke-linecap="round" opacity="0.85"/>
    </svg>
  `;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 2 24, auto`;
}

export function buildEraserCursorDataUrl() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">
      <g fill="none" stroke="#0f172a" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3.4" y="9.6" width="13.1" height="9.7" rx="2.4" fill="#f8fafc"/>
        <path d="M8.3 9.6 16.3 2.6a2.2 2.2 0 0 1 3.1 0l3.8 3.8a2.2 2.2 0 0 1 0 3.1l-8.2 8.2"/>
        <path d="M6.5 19.3h7.5"/>
      </g>
      <path d="M2.5 22.4 7.2 17.7" stroke="#0f172a" stroke-width="1.7" stroke-linecap="round"/>
    </svg>
  `;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 10 10, auto`;
}

export function resolveAnnotationCursor(mode, color) {
  if (mode === 'pen') return buildPenCursorDataUrl(color);
  if (mode === 'eraser') return buildEraserCursorDataUrl();
  return 'auto';
}

export function parseAnnotationItems(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => {
      if (!item || typeof item !== 'object') return false;
      if (item.kind === 'text') {
        return typeof item.text === 'string' && item.text.trim().length > 0 && Number.isFinite(item.x) && Number.isFinite(item.y);
      }
      return Array.isArray(item.points) && item.points.length > 0 && ['pen', 'eraser'].includes(item.mode);
    }).map((item) => {
      if (item.kind === 'text') {
        return {
          id: item.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          kind: 'text',
          text: String(item.text).trim(),
          x: Number(item.x),
          y: Number(item.y),
          color: resolveAnnotationColor(item.color),
        };
      }
      return {
        id: item.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        kind: 'stroke',
        mode: item.mode === 'eraser' ? 'eraser' : 'pen',
        color: resolveAnnotationColor(item.color),
        points: (item.points || []).filter((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y)),
      };
    });
  } catch {
    return [];
  }
}

export function parseAnnotationStrokes(value) {
  return parseAnnotationItems(value).filter((item) => item.kind === 'stroke');
}

export function stringifyAnnotationItems(items) {
  const normalized = Array.isArray(items)
    ? items
        .filter((item) => item && typeof item === 'object')
        .map((item) => {
          if (item.kind === 'text') {
            return {
              id: item.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
              kind: 'text',
              text: String(item.text || '').trim(),
              x: Number(item.x),
              y: Number(item.y),
              color: resolveAnnotationColor(item.color),
            };
          }
          return {
            id: item.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            kind: 'stroke',
            mode: item.mode === 'eraser' ? 'eraser' : 'pen',
            color: resolveAnnotationColor(item.color),
            points: Array.isArray(item.points) ? item.points.filter((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y)) : [],
          };
        })
        .filter((item) => {
          if (item.kind === 'text') return item.text.length > 0 && Number.isFinite(item.x) && Number.isFinite(item.y);
          return Array.isArray(item.points) && item.points.length > 0;
        })
    : [];
  return JSON.stringify(normalized);
}

export function stringifyAnnotationStrokes(strokes) {
  return stringifyAnnotationItems(strokes);
}

export function normalizeSelectionText(value) {
  const clean = String(value ?? '').replace(/\s+/g, ' ').trim();
  return clean;
}

export function resolveAnnotationColor(value) {
  return ANNOTATION_COLORS.some((entry) => entry.value === value) ? value : 'yellow';
}
