import { useState } from 'react';
import PageShell from '../components/PageShell.jsx';
import { runCodeLab } from '../lib/modules-repo.js';

export default function CodeLab() {
  const [code, setCode] = useState(`// Offline Code Lab — runs on your local Node backend\nconst n = 5;\nconsole.log('fib');\nfunction fib(x){ return x < 2 ? x : fib(x-1)+fib(x-2); }\nfib(n);`);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);

  async function handleRun() {
    setRunning(true);
    try {
      const out = await runCodeLab(code);
      setResult(out);
    } catch (err) {
      setResult({ ok: false, error: err.message, logs: [] });
    } finally {
      setRunning(false);
    }
  }

  return (
    <PageShell title="Code Lab" description="Run small JavaScript snippets against the offline Node backend (no network, no require).">
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        rows={14}
        className="w-full bg-surface-container-lowest text-on-surface font-code-block text-code-block p-space-md rounded-xl focus:outline-none resize-y"
        spellCheck={false}
      />
      <button
        onClick={handleRun}
        disabled={running}
        className="self-start px-space-md py-space-sm rounded bg-primary-container text-on-primary font-semibold text-body-sm disabled:opacity-60"
      >
        {running ? 'Running…' : 'Run locally'}
      </button>
      {result && (
        <div className="rounded-xl bg-surface-container-low p-space-md font-code-block text-code-block">
          {result.ok ? (
            <>
              <p className="text-tertiary mb-space-xs">OK — result: {String(result.result)}</p>
              {(result.logs || []).map((line, i) => (
                <p key={i} className="text-on-surface-variant">{line}</p>
              ))}
            </>
          ) : (
            <p className="text-error">{result.error}</p>
          )}
        </div>
      )}
    </PageShell>
  );
}
