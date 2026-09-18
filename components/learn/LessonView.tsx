'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Lesson, InteractiveExample, LessonStatus } from '@/lib/types/curriculum';
import MarkdownRenderer from './MarkdownRenderer';
import InteractiveExampleRenderer from './InteractiveExampleRenderer';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useSetTutorContext } from '@/lib/tutor/TutorContextProvider';

interface Props {
  lesson: Lesson;
  examples: InteractiveExample[];
  missingPrerequisites: string[]; // titles of incomplete prerequisite lessons, if any
  userId?: string; // optional — progress tracking is a no-op when anonymous
}

export default function LessonView({ lesson, examples, missingPrerequisites, userId }: Props) {
  const [status, setStatus] = useState<LessonStatus>('in_progress');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Ground the single global tutor drawer in this lesson. Only a short excerpt of
  // the objectives is shared — full content_markdown is not needed for the tutor
  // to help, and keeping the snippet small keeps the Gemini prompt cheap.
  useSetTutorContext({
    pageType: 'lesson',
    title: lesson.title,
    contextSnippet: lesson.learning_objectives.slice(0, 2).join('; '),
  });

  // Mark "in_progress" on mount, best-effort, silent failure (never block reading).
  useEffect(() => {
    if (!userId) return;
    void upsertProgress(userId, lesson.id, 'in_progress').catch(() => {
      // Silent — progress tracking should never interrupt the learning experience.
    });
  }, [userId, lesson.id]);

  async function handleMarkComplete() {
    if (!userId) {
      setSaveError('Sign in to save your progress across sessions.');
      return;
    }
    try {
      await upsertProgress(userId, lesson.id, 'completed');
      setStatus('completed');
      setSaveError(null);
    } catch {
      setSaveError('Could not save progress — check your connection and try again.');
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
        <span>Week {lesson.week_number}</span>
        <span>&middot;</span>
        <span>{lesson.day_range}</span>
        <span>&middot;</span>
        <span>{lesson.reading_time_minutes} min read</span>
      </div>
      <h1 className="text-2xl font-bold text-slate-900">{lesson.title}</h1>

      {lesson.learning_objectives.length > 0 && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            By the end of this lesson, you will be able to:
          </h2>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-700">
            {lesson.learning_objectives.map((obj, i) => (
              <li key={i}>{obj}</li>
            ))}
          </ul>
        </div>
      )}

      {missingPrerequisites.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          You have not yet completed: <strong>{missingPrerequisites.join(', ')}</strong>. This lesson
          will make more sense once those are done — but you&apos;re welcome to continue anyway.
        </div>
      )}

      {/* Split screen */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <MarkdownRenderer content={lesson.content_markdown} />
        </section>

        <section className="space-y-4">
          {examples.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
              No interactive examples attached to this lesson yet.
            </div>
          )}
          {examples.map((example) => (
            <div key={example.id} className="rounded-lg border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-800">{example.title}</h3>
              {example.description && (
                <p className="mt-1 text-xs text-slate-500">{example.description}</p>
              )}
              <div className="mt-3">
                <InteractiveExampleRenderer example={example} />
              </div>
            </div>
          ))}
        </section>
      </div>

      {/* Footer actions */}
      <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-6">
        <Link href="/learn" className="text-sm text-slate-500 hover:text-slate-800">
          ← Back to curriculum
        </Link>

        <div className="flex items-center gap-3">
          {saveError && <span className="text-xs text-red-600">{saveError}</span>}
          <button
            type="button"
            onClick={handleMarkComplete}
            disabled={status === 'completed'}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-emerald-600"
          >
            {status === 'completed' ? '✓ Completed' : 'Mark as Complete'}
          </button>
        </div>
      </div>
    </main>
  );
}

async function upsertProgress(userId: string, lessonId: string, status: LessonStatus) {
  const supabase = getSupabaseBrowserClient();
  const now = new Date().toISOString();

  const { error } = await supabase.from('user_lesson_progress').upsert(
    {
      user_id: userId,
      lesson_id: lessonId,
      status,
      last_viewed_at: now,
      ...(status === 'completed' ? { completed_at: now } : {}),
    },
    { onConflict: 'user_id,lesson_id' }
  );

  if (error) throw error;
}
