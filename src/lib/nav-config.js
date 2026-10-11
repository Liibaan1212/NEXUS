// This mirrors the fullest/most-recent sidebar found across the Stitch export
// (grouped sections, inline SVG icons) so the nav keeps its original labels,
// grouping and icon set. Every entry here is a real, clickable route: routes
// not in IMPLEMENTED_ROUTES render an honest "not built yet" page instead of
// faking functionality.

export const NAV_GROUPS = [
  {
    label: 'Operational Core',
    items: [
      { path: 'home', label: 'Home', icon: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z|9 22 9 12 15 12 15 22' },
      { path: 'todays-ai', label: "Today's AI", icon: '13 2 3 14 12 14 11 22 21 10 12 10 13 2:polygon' },
      { path: 'my-journey', label: 'My Journey', icon: 'circle:12,12,10|16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76:polygon' },
      { path: 'videos', label: 'Journey Videos', icon: 'rect:3,5,18,14,2|10,9 15,12 10,15:polygon' },
      { path: 'feature', label: 'Quick Drop', icon: 'M12 16V4|m7 9 5-5 5 5|M4 16v4h16v-4' },
      { path: 'presentation&pdf', label: 'Presentations & PDF', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|14 2 14 8 20 8:polyline|M8 13h8|M8 17h8|M8 9h2' },
    ],
  },
  {
    label: 'Knowledge & Curriculum',
    items: [
      { path: 'knowledge', label: 'Knowledge Concepts', icon: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z|M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z' },
      { path: 'knowledge-graph', label: 'Knowledge Graph', icon: 'circle:18,5,3|circle:6,12,3|circle:18,19,3|line:8.59,13.51,15.42,17.49|line:15.41,6.51,8.59,10.49' },
      { path: 'mastery', label: 'Mastery Matrix', icon: 'rect:3,3,18,18|line:3,9,21,9|line:3,15,21,15|line:9,3,9,21|line:15,3,15,21' },
      { path: 'lessons', label: 'Lessons Library', icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20|M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z' },
      { path: 'lesson-sandbox', label: 'Lesson Sandbox', icon: '12 2 2 7 12 12 22 7 12 2:polygon|2 17 12 22 22 17:polyline|2 12 12 17 22 12:polyline' },
      { path: 'lesson-importer', label: 'Import Center', icon: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4|7 10 12 15 17 10:polyline|line:12,15,12,3' },
      { path: 'bookmarks', label: 'Bookmarks', icon: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z' },
    ],
  },
  {
    label: 'Engineering & Code',
    items: [
      { path: 'projects', label: 'Active Projects', icon: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z' },
      { path: 'architecture', label: 'Architecture Blueprints', icon: 'rect:3,3,14,14,2|M3 9h14|M9 21V9' },
      { path: 'capstones', label: 'Capstones', icon: 'circle:12,8,7|8.21 13.89 7 23 12 20 17 23 15.79 13.88:polyline' },
      { path: 'code-lab', label: 'Code Lab', icon: '16 18 22 12 16 6:polyline|8 6 2 12 8 18:polyline' },
      { path: 'snippets', label: 'Code Snippets', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|14 2 14 8 20 8:polyline|line:16,13,8,13|line:16,17,8,17' },
      { path: 'debug-center', label: 'Debug Center', icon: 'rect:7,6,10,14,4|line:12,2,12,6|line:4,9,7,9|line:17,9,20,9|line:4,15,7,15|line:17,15,20,15' },
    ],
  },
  {
    label: 'Cognitive Engine',
    items: [
      { path: 'ai-tutor', label: 'AI Tutor (Nexus AI)', icon: 'circle:12,12,10|M12 16v-4|M12 8h.01' },
      { path: 'revision', label: "Today's Review", icon: 'M1 4v6h6|M3.51 15a9 9 0 1 0 2.13-9.36L1 10' },
      { path: 'flashcards', label: 'Flashcards', icon: 'rect:3,8,18,13,2|M7 8V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-3' },
      { path: 'weak-areas', label: 'Weak Areas', icon: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z|line:12,9,12,13|line:12,17,12.01,17' },
      { path: 'challenges', label: 'Arena Challenges', icon: '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2:polygon' },
      { path: 'exam-mode', label: 'Exam Mode', icon: 'circle:12,12,10|12 6 12 12 14 14:polyline' },
    ],
  },
  {
    label: 'Ecosystem & Career',
    items: [
      { path: 'resources', label: 'Resource Library', icon: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z|M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z' },
      { path: 'datasets', label: 'Datasets Hub', icon: 'ellipse:12,5,9,3|M21 12c0 1.66-4 3-9 3s-9-1.34-9-3|M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5' },
      { path: 'csv-studio', label: 'CSV Studio', icon: 'M4 4h16v16H4z|M8 8h8|M8 12h8|M8 16h5' },
      { path: 'notes', label: 'Notes Manager', icon: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7|M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' },
      { path: 'career', label: 'Engineer Profile', icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2|circle:12,7,4' },
      { path: 'job-readiness', label: 'Job Readiness', icon: 'circle:12,12,10|m9 12 2 2 4-4' },
      { path: 'interview-prep', label: 'Interview Prep', icon: 'rect:3,3,18,18,2|line:7,8,17,8|line:7,12,17,12|line:7,16,13,16' },
      { path: 'portfolio', label: 'Portfolio Showcase', icon: 'rect:2,7,20,14,2|M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16' },
      { path: 'analytics', label: 'Telemetry & Analytics', icon: 'line:18,20,18,10|line:12,20,12,4|line:6,20,6,14' },
      { path: 'settings', label: 'Settings & Model Config', icon: 'circle:12,12,3|M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z' },
    ],
  },
];

// Every sidebar destination has a real offline page backed by SQLite.
export const IMPLEMENTED_ROUTES = new Set(
  NAV_GROUPS.flatMap((g) => g.items.map((item) => item.path))
);

export function allNavItems() {
  return NAV_GROUPS.flatMap((g) => g.items);
}

export const STUB_ROUTES = [];
