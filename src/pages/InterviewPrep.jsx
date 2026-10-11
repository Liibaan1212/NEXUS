import { useEffect, useState } from 'react';
import PageShell, { useAsyncLoad } from '../components/PageShell.jsx';
import { listInterview, createInterview, deleteInterview } from '../lib/modules-repo.js';
import { listLessons } from '../lib/lessons-repo.js';
import { generateInterviewQuestionsFromLessons } from '../lib/utils.js';
import { useToast } from '../context/ToastContext.jsx';

export default function InterviewPrep() {
  const showToast = useToast();
  const { loading, error, data: questions, reload } = useAsyncLoad(listInterview);
  const [lessonData, setLessonData] = useState([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [category, setCategory] = useState('general');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const lessons = await listLessons();
        if (!cancelled) setLessonData(lessons || []);
      } catch {
        if (!cancelled) setLessonData([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const generatedFromLessons = generateInterviewQuestionsFromLessons(lessonData);
  const allQuestions = [...generatedFromLessons, ...(questions || [])].slice(0, 20);

  async function handleAdd(e) {
    e.preventDefault();
    if (!question.trim()) return;
    await createInterview({ question: question.trim(), answer, category });
    setQuestion('');
    setAnswer('');
    showToast('Question added', 'success');
    reload();
  }

  return (
    <PageShell title="Interview Prep" description="Local interview question bank with answers you can expand." loading={loading} error={error}>
      <form onSubmit={handleAdd} className="rounded-xl bg-surface-container-low p-space-md flex flex-col gap-space-sm">
        <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} placeholder="Question" className="bg-surface-container px-space-sm py-space-xs rounded-lg text-on-surface font-body-sm focus:outline-none resize-none" />
        <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={3} placeholder="Model answer / notes" className="bg-surface-container px-space-sm py-space-xs rounded-lg text-on-surface font-body-sm focus:outline-none resize-none" />
        <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" className="bg-surface-container px-space-sm py-space-xs rounded-lg text-on-surface font-body-sm focus:outline-none" />
        <button type="submit" className="self-start px-space-md py-space-sm rounded bg-primary-container text-on-primary font-semibold text-body-sm">Add question</button>
      </form>
      <div className="flex flex-col gap-space-sm">
        {allQuestions.map((q) => (
          <div key={q.id} className="rounded-lg bg-surface-container p-space-md">
            <div className="flex justify-between gap-space-sm">
              <button onClick={() => setOpenId(openId === q.id ? null : q.id)} className="text-left flex-1">
                <p className="font-body-md font-semibold text-on-surface">{q.question}</p>
                <span className="font-label-caps text-label-caps text-outline">{q.category} · {q.difficulty}</span>
              </button>
              {!q.generatedFromLesson && (
                <button onClick={async () => { await deleteInterview(q.id); reload(); }} className="text-outline hover:text-error">
                  <span className="material-symbols-outlined text-body-md">delete</span>
                </button>
              )}
            </div>
            {openId === q.id && (
              <p className="font-body-sm text-on-surface-variant mt-space-sm whitespace-pre-wrap">{q.answer || 'No answer notes yet.'}</p>
            )}
          </div>
        ))}
      </div>
    </PageShell>
  );
}
