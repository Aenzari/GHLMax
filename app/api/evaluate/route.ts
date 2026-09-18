import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { evaluateSubmission, AiEvaluationError } from '@/lib/ai/evaluate';
import { Challenge, EvaluateRequestBody } from '@/lib/types/evaluation';

export const runtime = 'nodejs'; // Gemini SDK/fetch needs Node runtime, not Edge
export const dynamic = 'force-dynamic';

const MAX_SOLUTION_LENGTH = 6000;
const MIN_SOLUTION_LENGTH = 20;

function isValidRequestBody(body: unknown): body is EvaluateRequestBody {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.challengeId === 'string' &&
    b.challengeId.length > 0 &&
    typeof b.userSolution === 'string' &&
    (b.userId === undefined || typeof b.userId === 'string')
  );
}

export async function POST(req: NextRequest) {
  // ---- 1. Parse & validate input shape --------------------------------
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Malformed JSON body.' }, { status: 400 });
  }

  if (!isValidRequestBody(body)) {
    return NextResponse.json(
      { error: 'Body must include challengeId (string) and userSolution (string).' },
      { status: 400 }
    );
  }

  const userSolution = body.userSolution.trim();

  if (userSolution.length < MIN_SOLUTION_LENGTH) {
    return NextResponse.json(
      { error: `Solution too short — provide at least ${MIN_SOLUTION_LENGTH} characters of reasoning.` },
      { status: 400 }
    );
  }

  if (userSolution.length > MAX_SOLUTION_LENGTH) {
    return NextResponse.json(
      { error: `Solution too long — max ${MAX_SOLUTION_LENGTH} characters.` },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();

  // ---- 2. Fetch the challenge (ground truth) ---------------------------
  const { data: challenge, error: fetchError } = await supabase
    .from('challenges')
    .select('id, module_id, title, severity, domain, broken_scenario, reproduction_logs, expected_solution, hint')
    .eq('id', body.challengeId)
    .single<Challenge>();

  if (fetchError || !challenge) {
    return NextResponse.json({ error: 'Challenge not found.' }, { status: 404 });
  }

  // ---- 3. Run AI evaluation --------------------------------------------
  let result;
  try {
    result = await evaluateSubmission(challenge, userSolution);
  } catch (err) {
    if (err instanceof AiEvaluationError) {
      console.error('[evaluate] AI evaluation failed:', err.message, err.cause ?? '');
      return NextResponse.json(
        { error: 'AI evaluation service is temporarily unavailable. Please try again shortly.' },
        { status: 502 }
      );
    }
    console.error('[evaluate] Unexpected error:', err);
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }

  // ---- 4. Persist submission (best-effort — never fail the response over a logging write) ----
  if (body.userId) {
    const { error: insertError } = await supabase.from('user_submissions').insert({
      user_id: body.userId,
      challenge_id: challenge.id,
      user_solution: userSolution,
      ai_score: result.score,
      ai_critique: result.critique,
      ai_raw_response: result,
      passed: result.passed,
    });

    if (insertError) {
      // Log but do not fail the request — the user still deserves their feedback.
      console.error('[evaluate] Failed to persist submission:', insertError.message);
    }
  }

  // ---- 5. Return graded result ------------------------------------------
  return NextResponse.json({ result }, { status: 200 });
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST with { challengeId, userSolution }.' },
    { status: 405 }
  );
}
