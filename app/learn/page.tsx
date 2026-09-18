import Link from 'next/link';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { Lesson } from '@/lib/types/curriculum';

export const dynamic = 'force-dynamic';

async function getLessons(): Promise<Lesson[] | null> {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('curriculum_lessons')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('[learn/page] Failed to load lessons:', error.message);
      return null;
    }
    return data as Lesson[];
  } catch (err) {
    console.error('[learn/page] Unexpected error:', err);
    return null;
  }
}

export default async function CurriculumIndexPage() {
  const lessons = await getLessons();

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-bold text-slate-900">30-Day Curriculum</h1>
      <p className="mt-2 text-sm text-slate-500">
        Progressive lessons from CRM fundamentals to job-ready diagnostic mastery.
      </p>

      {lessons === null && (
        <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load the curriculum right now. Check your Supabase configuration and refresh.
        </div>
      )}

      {lessons !== null && lessons.length === 0 && (
        <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          No lessons seeded yet. Run migration 002 to populate the curriculum.
        </div>
      )}

      {lessons !== null && lessons.length > 0 && (
        <div className="mt-8 space-y-8">
          {Array.from(new Set(lessons.map((l) => l.week_number))).map((week) => (
            <div key={week}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Week {week}
              </h2>
              <ul className="mt-3 space-y-2">
                {lessons
                  .filter((l) => l.week_number === week)
                  .map((lesson) => (
                    <li key={lesson.id}>
                      <Link
                        href={`/learn/${lesson.slug}`}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
                      >
                        <div>
                          <p className="font-medium text-slate-900">{lesson.title}</p>
                          <p className="mt-1 text-xs text-slate-400">{lesson.day_range}</p>
                        </div>
                        <span className="text-xs text-slate-400">{lesson.reading_time_minutes} min</span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
