'use client';

import { useState } from 'react';
import { AiEvaluationResult, Challenge } from '@/lib/types/evaluation';

type SafeChallenge = Omit<Challenge, 'expected_solution'>;

interface Props {
  challenge: SafeChallenge;
  userId?: string; // wire up to your auth provider later; undefined = anonymous practice
}

type SubmitState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; result: AiEvaluationResult }
  | { status: 'error'; message: string };

const MIN_LENGTH = 20;
const MAX_LENGTH = 6000;

const SEVERITY_STYLES: Record<string, string> = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-amber-100 text-amber-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

export default function DiagnosticSandbox({ challenge, userId }: Props) {
  const [solution, setSolution] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>({ status: 'idle' });

  const trimmedLength = solution.trim().length;
  const isTooShort = trimmedLength > 0 && trimmedLength < MIN_LENGTH;
  const isTooLong = trimmedLength > MAX_LENGTH;
  const canSubmit =
    trimmedLength >= MIN_LENGTH && !isTooLong && submitState.status !== 'loading';

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitState({ status: 'loading' });

    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: challenge.id,
          userSolution: solution.trim(),
          ...(userId ? { userId } : {}),
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setSubmitState({
          status: 'error',
          message: json?.error ?? `Request failed with status ${res.status}.`,
        });
        return;
      }

      if (!json?.result) {
        setSubmitState({ status: 'error', message: 'Malformed response from evaluator.' });
        return;
      }

      setSubmitState({ status: 'success', result: json.result as AiEvaluationResult });
    } catch (err) {
      setSubmitState({
        status: 'error',
        message: 'Network error — check your connection and try again.',
      });
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{challenge.title}</h1>
          <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">
            {challenge.domain.replace(/_/g, ' ')}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
            SEVERITY_STYLES[challenge.severity] ?? 'bg-slate-100 text-slate-700'
          }`}
        >
          {challenge.severity.toUpperCase()}
        </span>
      </div>

      {/* Split screen: ticket left, editor right */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* LEFT: Ticket viewer */}
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-700">Client Ticket</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {challenge.broken_scenario}
          </p>

          {challenge.reproduction_logs && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Reproduction Logs
              </h3>
              <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">
                {JSON.stringify(challenge.reproduction_logs, null, 2)}
              </pre>
            </div>
          )}

          {challenge.hint && (
            <div className="mt-4">
              {!showHint ? (
                <button
                  type="button"
                  onClick={() => setShowHint(true)}
                  className="text-xs font-medium text-blue-600 hover:underline"
                >
                  Reveal hint
                </button>
              ) : (
                <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
                  {challenge.hint}
                </div>
              )}
            </div>
          )}
        </section>

        {/* RIGHT: Remediation editor */}
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-700">Your Diagnosis &amp; Fix</h2>
          <textarea
            value={solution}
            onChange={(e) => setSolution(e.target.value)}
            placeholder="Explain the root cause and the exact fix you'd implement. Be specific about which setting, field, or configuration is broken and why."
            className="mt-3 h-64 w-full resize-none rounded-md border border-slate-200 p-3 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            disabled={submitState.status === 'loading'}
          />

          <div className="mt-1 flex items-center justify-between text-xs">
            <span className={isTooShort || isTooLong ? 'text-red-600' : 'text-slate-400'}>
              {trimmedLength} / {MAX_LENGTH} characters
              {isTooShort && ` — minimum ${MIN_LENGTH}`}
            </span>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="mt-3 w-full rounded-md bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitState.status === 'loading' ? 'Evaluating…' : 'Submit for AI Review'}
          </button>
        </section>
      </div>

      {/* AI Feedback Drawer */}
      <FeedbackDrawer state={submitState} onRetry={handleSubmit} />
    </main>
  );
}

function FeedbackDrawer({
  state,
  onRetry,
}: {
  state: SubmitState;
  onRetry: () => void;
}) {
  if (state.status === 'idle') return null;

  if (state.status === 'loading') {
    return (
      <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-center gap-3">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
          <p className="text-sm text-slate-600">Running your diagnosis against the AI evaluator…</p>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-5">
        <p className="text-sm font-medium text-red-700">Evaluation failed</p>
        <p className="mt-1 text-sm text-red-600">{state.message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
        >
          Retry
        </button>
      </div>
    );
  }

  const { result } = state;

  return (
    <div
      className={`mt-6 rounded-lg border p-5 ${
        result.passed ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
      }`}
    >
      <div className="flex items-center justify-between">
        <p
          className={`text-sm font-bold ${
            result.passed ? 'text-emerald-700' : 'text-amber-700'
          }`}
        >
          {result.passed ? '✓ Root cause identified' : '✗ Not quite — keep digging'}
        </p>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
          Score: {result.score} / 10
        </span>
      </div>

      <p className="mt-3 text-sm text-slate-700">{result.critique}</p>

      {result.strengths.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            What you got right
          </h4>
          <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-slate-700">
            {result.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {result.missed_considerations.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            What you missed
          </h4>
          <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-slate-700">
            {result.missed_considerations.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
