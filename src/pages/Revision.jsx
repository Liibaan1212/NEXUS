import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageShell, { useAsyncLoad } from '../components/PageShell.jsx';
import { getRevision, reviewFlashcard, flashcardFromLesson } from '../lib/modules-repo.js';
import { buildLessonReviewCard } from '../lib/utils.js';

export default function Revision() {
  const navigate = useNavigate();
  const { loading, error, data, reload } = useAsyncLoad(getRevision);
  const [selectedLessonId, setSelectedLessonId] = useState(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const lessons = data?.lessons || [];
  const cards = data?.flashcards || [];

  useEffect(() => {
    if (!selectedLessonId && lessons[0]) {
      setSelectedLessonId(lessons[0].id);
    }
  }, [lessons, selectedLessonId]);

  const selectedLesson = lessons.find((l) => l.id === selectedLessonId) || lessons[0] || null;
  const generatedCard = selectedLesson ? buildLessonReviewCard(selectedLesson) : null;
  const card = generatedCard || cards[cardIndex] || null;

  async function grade(quality) {
    if (!selectedLesson && !card) return;

    let activeCard = card;
    if (selectedLesson && !activeCard?.id) {
      const created = await flashcardFromLesson(selectedLesson.id);
      activeCard = created;
    }

    if (activeCard?.id) {
      await reviewFlashcard(activeCard.id, quality);
    }

    setFlipped(false);

    if (selectedLesson) {
      const nextLessonIndex = lessons.findIndex((l) => l.id === selectedLesson.id);
      const nextLesson = lessons[nextLessonIndex + 1] || lessons[0];
      setSelectedLessonId(nextLesson ? nextLesson.id : null);
      return;
    }

    if (cardIndex < cards.length - 1) setCardIndex(cardIndex + 1);
    else reload();
  }

  return (
    <PageShell title="Today's Review" description="Spaced review of lessons and flashcards due today." loading={loading} error={error}>
      <section className="rounded-xl bg-surface-container-low p-space-md flex flex-col gap-space-sm">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Lessons to revisit</h2>
        {(lessons || []).length === 0 ? (
          <p className="font-body-sm text-on-surface-variant">Nothing queued — open or complete a lesson first.</p>
        ) : (
          lessons.map((l) => {
            const isSelected = selectedLesson && l.id === selectedLesson.id;
            return (
              <button
                key={l.id}
                onClick={() => {
                  setSelectedLessonId(l.id);
                  setFlipped(false);
                }}
                className={`text-left p-space-sm rounded-lg transition-all ${isSelected ? 'bg-surface-container-high ring-1 ring-primary shadow-sm' : 'bg-surface-container hover:bg-surface-container-high'}`}
              >
                <span className="font-body-sm font-semibold text-on-surface">{l.title}</span>
                <span className="block font-label-caps text-label-caps text-outline">{l.category}</span>
              </button>
            );
          })
        )}
      </section>

      <section className="rounded-xl bg-surface-container-low p-space-md flex flex-col gap-space-sm">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Due flashcards</h2>
        {!selectedLesson && !card ? (
          <p className="font-body-sm text-on-surface-variant">No cards due. Add some in Flashcards.</p>
        ) : (
          <>
            <button
              onClick={() => setFlipped((f) => !f)}
              className="min-h-[220px] rounded-2xl bg-surface-container p-space-lg text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] border border-outline/30 transition-all duration-200 hover:border-primary/40 hover:shadow-lg"
            >
              <span className="font-label-caps text-label-caps text-outline uppercase tracking-[0.18em]">{flipped ? 'Answer' : 'Prompt'}</span>
              <p className="font-body-lg text-on-surface mt-space-sm whitespace-pre-wrap leading-relaxed text-[clamp(1.25rem,2vw,2.3rem)] max-w-5xl">
                {flipped ? card.back : card.front}
              </p>
              {selectedLesson && (
                <div className="mt-space-md flex flex-wrap gap-1.5">
                  <span className="px-2 py-1 rounded bg-surface-container-high text-on-surface font-label-caps text-label-caps">{selectedLesson.category}</span>
                  <span className="px-2 py-1 rounded bg-primary-container/30 text-primary font-label-caps text-label-caps">Lesson review</span>
                </div>
              )}
            </button>
            <div className="flex flex-wrap gap-space-xs pt-1">
              <button onClick={() => grade(1)} className="min-w-[92px] px-space-sm py-space-xs rounded-lg bg-error/20 text-error font-label-caps text-label-caps shadow-sm hover:brightness-110 transition-all">Again</button>
              <button onClick={() => grade(3)} className="min-w-[92px] px-space-sm py-space-xs rounded-lg bg-[#7d4b2e]/20 text-[#f0a67c] font-label-caps text-label-caps shadow-sm hover:brightness-110 transition-all">Hard</button>
              <button onClick={() => grade(4)} className="min-w-[92px] px-space-sm py-space-xs rounded-lg bg-primary-container/30 text-primary font-label-caps text-label-caps shadow-sm hover:brightness-110 transition-all">Good</button>
              <button onClick={() => grade(5)} className="min-w-[92px] px-space-sm py-space-xs rounded-lg bg-tertiary/20 text-tertiary font-label-caps text-label-caps shadow-sm hover:brightness-110 transition-all">Easy</button>
            </div>
            <p className="font-label-caps text-label-caps text-outline">
              {selectedLesson ? `Reviewing: ${selectedLesson.title}` : `Card ${cardIndex + 1} / ${cards.length}`}
            </p>
          </>
        )}
      </section>
    </PageShell>
  );
}
