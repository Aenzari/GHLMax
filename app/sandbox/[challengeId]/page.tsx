import { notFound } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { Challenge } from '@/lib/types/evaluation';
import DiagnosticSandbox from '@/components/sandbox/DiagnosticSandbox';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { challengeId: string };
}

async function getChallenge(id: string): Promise<Challenge | null> {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('challenges')
      .select('id, module_id, title, severity, domain, broken_scenario, reproduction_logs, expected_solution, hint')
      .eq('id', id)
      .single<Challenge>();

    if (error || !data) return null;
    return data;
  } catch (err) {
    console.error('[sandbox/[challengeId]] Failed to load challenge:', err);
    return null;
  }
}

export default async function ChallengePage({ params }: PageProps) {
  const challenge = await getChallenge(params.challengeId);

  if (!challenge) {
    notFound();
  }

  // Never ship expected_solution to the client bundle — strip it before hydration.
  const { expected_solution: _omit, ...safeChallenge } = challenge;

  return <DiagnosticSandbox challenge={safeChallenge} />;
}
