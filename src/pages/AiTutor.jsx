import { useEffect, useRef, useState } from 'react';
import PageShell from '../components/PageShell.jsx';
import { listTutorMessages, askTutor, clearTutorMessages } from '../lib/modules-repo.js';

export default function AiTutor() {
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    listTutorMessages()
      .then(setMessages)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleAsk(e) {
    e.preventDefault();
    if (!question.trim() || sending) return;
    setSending(true);
    try {
      const { user, assistant } = await askTutor(question.trim());
      setMessages((prev) => [...prev, user, assistant]);
      setQuestion('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <PageShell
      title="AI Tutor (Nexus AI)"
      description="Offline study assistant — answers by searching your local SQLite lesson library (no cloud model)."
      loading={loading}
      error={error}
      actions={
        <button
          onClick={async () => { await clearTutorMessages(); setMessages([]); }}
          className="px-space-sm py-space-xs rounded bg-surface-container-high text-on-surface font-body-sm"
        >
          Clear chat
        </button>
      }
    >
      <div className="rounded-xl bg-surface-container-low p-space-md flex flex-col gap-space-sm min-h-[360px] max-h-[60vh] overflow-y-auto">
        {!messages.length && (
          <p className="font-body-sm text-on-surface-variant">Ask about a topic from your imported lessons.</p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-lg p-space-sm max-w-[90%] whitespace-pre-wrap font-body-sm ${
              m.role === 'user'
                ? 'bg-primary-container/20 text-on-surface self-end'
                : 'bg-surface-container text-on-surface-variant self-start'
            }`}
          >
            {m.content}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleAsk} className="flex gap-space-sm">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask from your local lessons…"
          className="flex-1 bg-surface-container px-space-sm py-space-sm rounded-lg text-on-surface font-body-sm focus:outline-none"
        />
        <button type="submit" disabled={sending} className="px-space-md py-space-sm rounded bg-primary-container text-on-primary font-semibold text-body-sm disabled:opacity-60">
          {sending ? '…' : 'Ask'}
        </button>
      </form>
    </PageShell>
  );
}
