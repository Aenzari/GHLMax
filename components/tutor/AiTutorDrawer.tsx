'use client';

import { useEffect, useRef, useState } from 'react';
import { TutorMessage } from '@/lib/types/tutor';
import { useTutorContext } from '@/lib/tutor/TutorContextProvider';

type DrawerState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string };

const STORAGE_KEY_PREFIX = 'ghl-flowlab-tutor-history';

/**
 * Exactly ONE instance of this component should be mounted, in the root layout.
 * Pages ground it by calling useSetTutorContext(...) — they do not render their
 * own AiTutorDrawer, which would create a second floating button.
 */
export default function AiTutorDrawer() {
  const context = useTutorContext();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [input, setInput] = useState('');
  const [state, setState] = useState<DrawerState>({ status: 'idle' });
  const scrollRef = useRef<HTMLDivElement>(null);

  const storageKey = `${STORAGE_KEY_PREFIX}:${context?.pageType ?? 'general'}:${context?.title ?? 'default'}`;

  // Restore conversation for this specific context on mount (per-tab convenience only).
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) setMessages(JSON.parse(saved));
    } catch {
      // Corrupt or missing session storage is fine — just start fresh.
    }
  }, [storageKey]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, state]);

  function persist(next: TutorMessage[]) {
    setMessages(next);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Storage quota or private browsing — non-fatal, conversation just won't persist on reload.
    }
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || state.status === 'loading') return;

    const nextMessages: TutorMessage[] = [...messages, { role: 'user', content: trimmed }];
    persist(nextMessages);
    setInput('');
    setState({ status: 'loading' });

    try {
      const res = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, context }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.reply) {
        setState({ status: 'error', message: json?.error ?? 'The tutor could not respond.' });
        return;
      }

      persist([...nextMessages, { role: 'assistant', content: json.reply }]);
      setState({ status: 'idle' });
    } catch {
      setState({ status: 'error', message: 'Network error — check your connection and try again.' });
    }
  }

  function handleClear() {
    persist([]);
    setState({ status: 'idle' });
  }

  return (
    <>
      {/* Floating toggle button */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg transition hover:bg-slate-800"
        aria-label="Open study buddy"
      >
        {isOpen ? '✕' : '💬'}
      </button>

      {/* Drawer */}
      {isOpen && (
        <div className="fixed bottom-20 right-5 z-40 flex h-[520px] w-96 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white">Study Buddy</p>
              {context?.title && (
                <p className="text-[11px] text-slate-300">Context: {context.title}</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="text-[11px] text-slate-300 hover:text-white"
            >
              Clear chat
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-500">
                Ask me anything — I&apos;ll explain concepts with simple analogies, and if you&apos;re
                stuck on a challenge, I&apos;ll nudge you toward the answer rather than just giving
                it away.
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  m.role === 'user'
                    ? 'ml-auto bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-800'
                }`}
              >
                {m.content}
              </div>
            ))}

            {state.status === 'loading' && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                Thinking…
              </div>
            )}

            {state.status === 'error' && (
              <div className="rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                {state.message}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 border-t border-slate-200 p-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask a question…"
              disabled={state.status === 'loading'}
              maxLength={1000}
              className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={state.status === 'loading' || input.trim().length === 0}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
