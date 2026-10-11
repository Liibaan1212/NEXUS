import { useNavigate } from 'react-router-dom';
import { formatRelativeTime } from '../lib/utils.js';

export default function LessonCard({ lesson, onToggleComplete, onToggleBookmark, onDelete, onAssignWeek }) {
  const navigate = useNavigate();
  const progressPct = Math.round((lesson.maxScrollFraction || 0) * 100);

  return (
    <div className="p-space-sm rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors flex flex-col gap-space-xs">
      <div className="flex items-start justify-between gap-space-sm">
        <div className="min-w-0 flex-1">
          <button
            onClick={() => navigate(`/lesson-sandbox/${lesson.id}`)}
            className="text-left font-body-md text-body-md font-semibold text-on-surface hover:text-primary transition-colors truncate block w-full"
            title={lesson.title}
          >
            {lesson.title}
          </button>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="px-1.5 py-0.5 rounded bg-surface-container-lowest text-outline font-label-caps text-label-caps">{lesson.category}</span>
            <span className="font-label-caps text-label-caps text-outline">{lesson.readingTimeMin} min read</span>
            {lesson.hasCode && <span className="font-label-caps text-label-caps text-tertiary">Code</span>}
            {lesson.hasEnglishVersion && <span className="lesson-english-badge" title="English version attached"><span className="material-symbols-outlined">translate</span>EN</span>}
            {lesson.completed && <span className="font-label-caps text-label-caps text-primary">Completed</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onToggleBookmark(lesson.id)}
            className={`p-1.5 rounded hover:bg-surface-container-highest transition-colors ${lesson.bookmarked ? 'text-primary' : 'text-outline'}`}
            title={lesson.bookmarked ? 'Remove bookmark' : 'Bookmark this lesson'}
          >
            <span className="material-symbols-outlined text-headline-sm">{lesson.bookmarked ? 'bookmark' : 'bookmark_border'}</span>
          </button>
          <button
            onClick={() => onToggleComplete(lesson.id)}
            className={`p-1.5 rounded hover:bg-surface-container-highest transition-colors ${lesson.completed ? 'text-tertiary' : 'text-outline'}`}
            title={lesson.completed ? 'Mark as not completed' : 'Mark as completed'}
          >
            <span className="material-symbols-outlined text-headline-sm">{lesson.completed ? 'check_circle' : 'radio_button_unchecked'}</span>
          </button>
          {onDelete && (
            <button
              onClick={() => onDelete(lesson.id)}
              className="p-1.5 rounded hover:bg-surface-container-highest transition-colors text-outline hover:text-error"
              title="Delete lesson"
            >
              <span className="material-symbols-outlined text-headline-sm">delete</span>
            </button>
          )}
        </div>
      </div>
      <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">{lesson.excerpt || 'No preview available for this lesson.'}</p>
      <div className="w-full h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
        <div className="h-full bg-primary-container" style={{ width: `${progressPct}%` }} />
      </div>
      {onAssignWeek && <div className="flex items-center gap-1.5 flex-wrap">
        <span className="font-label-caps text-label-caps text-outline">Plan:</span>
        <select value={lesson.week || ''} onChange={(event) => onAssignWeek(lesson.id, event.target.value, lesson.day)} className="lesson-plan-select" aria-label={`Assign ${lesson.title} to a week`}>
          <option value="">Unassigned</option>
          {Array.from({ length: 52 }, (_, index) => index + 1).map((week) => <option key={week} value={week}>Week {week}</option>)}
        </select>
        <select value={lesson.day || ''} onChange={(event) => onAssignWeek(lesson.id, lesson.week, event.target.value)} className="lesson-plan-select" aria-label={`Assign a day for ${lesson.title}`}>
          <option value="">No day</option>
          {Array.from({ length: 7 }, (_, index) => index + 1).map((day) => <option key={day} value={day}>Day {day}</option>)}
        </select>
      </div>}
      <div className="flex items-center justify-between font-label-caps text-label-caps text-outline">
        <span>Opened {formatRelativeTime(lesson.lastOpenedAt)}</span>
        <span>{progressPct}% read</span>
      </div>
    </div>
  );
}
