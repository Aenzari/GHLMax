import Link from 'next/link';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { Challenge } from '@/lib/types/evaluation';

export const dynamic = 'force-dynamic';

const SEVERITY_STYLES: Record<string, string> = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-amber-100 text-amber-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

async function getChallenges(): Promise<Challenge[] | null> {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('challenges')
      .select('id, module_id, title, severity, domain, broken_scenario, reproduction_logs, expected_solution, hint')
      .order('severity', { ascending: false });

    if (error) {
      console.error('[sandbox/page] Failed to load challenges:', error.message);
      return null;
    }
    return data as Challenge[];
  } catch (err) {
    console.error('[sandbox/page] Unexpected error loading challenges:', err);
    return null;
  }
}

export default async function SandboxIndexPage() {
  const challenges = await getChallenges();

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-bold text-slate-900">Diagnostic Sandbox</h1>
      <p className="mt-2 text-sm text-slate-500">
        Live production tickets from broken GHL sub-accounts. Pick one, diagnose the root cause, submit your fix.
      </p>

      {challenges === null && (
        <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load challenges right now. Refresh the page, or check that Supabase env vars are configured.
        </div>
      )}

      {challenges !== null && challenges.length === 0 && (
        <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          No challenges seeded yet. Run the Step 1 migration to populate the challenges table.
        </div>
      )}

      {challenges !== null && challenges.length > 0 && (
        <ul className="mt-8 space-y-3">
          {challenges.map((c) => (
            <li key={c.id}>
              <Link
                href={`/sandbox/${c.id}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
              >
                <div>
                  <p className="font-medium text-slate-900">{c.title}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">
                    {c.domain.replace(/_/g, ' ')}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    SEVERITY_STYLES[c.severity] ?? 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {c.severity.toUpperCase()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
