import { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';

const Home = lazy(() => import('./pages/Home.jsx'));
const TodaysAI = lazy(() => import('./pages/TodaysAI.jsx'));
const Journey = lazy(() => import('./pages/Journey.jsx'));
const JourneyVideos = lazy(() => import('./pages/JourneyVideos.jsx'));
const Library = lazy(() => import('./pages/Library.jsx'));
const Viewer = lazy(() => import('./pages/Viewer.jsx'));
const Importer = lazy(() => import('./pages/Importer.jsx'));
const Knowledge = lazy(() => import('./pages/Knowledge.jsx'));
const KnowledgeGraph = lazy(() => import('./pages/KnowledgeGraph.jsx'));
const MasteryMatrix = lazy(() => import('./pages/MasteryMatrix.jsx'));
const Projects = lazy(() => import('./pages/Projects.jsx'));
const Architecture = lazy(() => import('./pages/Architecture.jsx'));
const Capstones = lazy(() => import('./pages/Capstones.jsx'));
const CodeLab = lazy(() => import('./pages/CodeLab.jsx'));
const Snippets = lazy(() => import('./pages/Snippets.jsx'));
const DebugCenter = lazy(() => import('./pages/DebugCenter.jsx'));
const AiTutor = lazy(() => import('./pages/AiTutor.jsx'));
const Revision = lazy(() => import('./pages/Revision.jsx'));
const Flashcards = lazy(() => import('./pages/Flashcards.jsx'));
const WeakAreas = lazy(() => import('./pages/WeakAreas.jsx'));
const Challenges = lazy(() => import('./pages/Challenges.jsx'));
const ExamMode = lazy(() => import('./pages/ExamMode.jsx'));
const Resources = lazy(() => import('./pages/Resources.jsx'));
const Datasets = lazy(() => import('./pages/Datasets.jsx'));
const Notes = lazy(() => import('./pages/Notes.jsx'));
const Career = lazy(() => import('./pages/Career.jsx'));
const JobReadiness = lazy(() => import('./pages/JobReadiness.jsx'));
const InterviewPrep = lazy(() => import('./pages/InterviewPrep.jsx'));
const Portfolio = lazy(() => import('./pages/Portfolio.jsx'));
const Analytics = lazy(() => import('./pages/Analytics.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const CsvStudio = lazy(() => import('./pages/CsvStudio.jsx'));
const Feature = lazy(() => import('./pages/Feature.jsx'));
const PresentationsPdf = lazy(() => import('./pages/PresentationsPdf.jsx'));

const THEME_KEY = 'nexus-theme-mode';
const DEFAULT_THEME = 'day';

function readTheme() {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    return stored || DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function applyTheme(theme) {
  const next = theme || DEFAULT_THEME;
  document.documentElement.setAttribute('data-theme', next);
  document.documentElement.style.colorScheme = next === 'day' ? 'light' : 'dark';
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    applyTheme(readTheme());

    const onThemeChange = () => applyTheme(readTheme());
    window.addEventListener('theme-mode-change', onThemeChange);
    return () => window.removeEventListener('theme-mode-change', onThemeChange);
  }, []);

  return (
    <>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Header onOpenMenu={() => setSidebarOpen(true)} />
      <div className="lg:pl-72 pt-16 min-h-screen">
        <main className="w-full">
          <Suspense fallback={<div className="p-space-lg text-on-surface-variant" role="status">Opening module…</div>}>
            <Routes>
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route path="/home" element={<Home />} />
              <Route path="/todays-ai" element={<TodaysAI />} />
              <Route path="/my-journey" element={<Journey />} />
              <Route path="/videos" element={<JourneyVideos />} />
              <Route path="/knowledge" element={<Knowledge />} />
              <Route path="/knowledge-graph" element={<KnowledgeGraph />} />
              <Route path="/mastery" element={<MasteryMatrix />} />
              <Route path="/lessons" element={<Library mode="all" />} />
              <Route path="/bookmarks" element={<Library mode="bookmarked" />} />
              <Route path="/lesson-sandbox" element={<Viewer />} />
              <Route path="/lesson-sandbox/:id" element={<Viewer />} />
              <Route path="/lesson-importer" element={<Importer />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/architecture" element={<Architecture />} />
              <Route path="/capstones" element={<Capstones />} />
              <Route path="/code-lab" element={<CodeLab />} />
              <Route path="/snippets" element={<Snippets />} />
              <Route path="/debug-center" element={<DebugCenter />} />
              <Route path="/ai-tutor" element={<AiTutor />} />
              <Route path="/revision" element={<Revision />} />
              <Route path="/flashcards" element={<Flashcards />} />
              <Route path="/weak-areas" element={<WeakAreas />} />
              <Route path="/challenges" element={<Challenges />} />
              <Route path="/exam-mode" element={<ExamMode />} />
              <Route path="/resources" element={<Resources />} />
              <Route path="/datasets" element={<Datasets />} />
              <Route path="/csv-studio" element={<CsvStudio />} />
              <Route path="/feature" element={<Feature />} />
              <Route path="/presentation&pdf" element={<PresentationsPdf />} />
              <Route path="/notes" element={<Notes />} />
              <Route path="/notes-manager" element={<Notes />} />
              <Route path="/career" element={<Career />} />
              <Route path="/job-readiness" element={<JobReadiness />} />
              <Route path="/interview-prep" element={<InterviewPrep />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Home />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </>
  );
}
