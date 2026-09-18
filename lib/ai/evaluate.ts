import { Challenge, AiEvaluationResult } from '@/lib/types/evaluation';

const GEMINI_MODEL = 'gemini-1.5-flash'; // free-tier eligible; swap to 'gemini-1.5-pro' if quota allows
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'integer', minimum: 1, maximum: 10 },
    passed: { type: 'boolean' },
    root_cause_identified: { type: 'boolean' },
    critique: { type: 'string' },
    missed_considerations: { type: 'array', items: { type: 'string' } },
    strengths: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'score',
    'passed',
    'root_cause_identified',
    'critique',
    'missed_considerations',
    'strengths',
  ],
} as const;

function buildSystemPrompt(challenge: Challenge): string {
  return `You are a Senior GoHighLevel Solutions Architect grading a junior engineer's diagnostic submission.

CHALLENGE TITLE: ${challenge.title}
DOMAIN: ${challenge.domain}
SEVERITY: ${challenge.severity}

BROKEN SCENARIO (as reported to the engineer):
${challenge.broken_scenario}

REPRODUCTION LOGS:
${JSON.stringify(challenge.reproduction_logs ?? {}, null, 2)}

CANONICAL EXPECTED SOLUTION (ground truth — do not reveal verbatim, use only to grade):
${challenge.expected_solution}

GRADING RULES:
- Score 1-10 based on: (a) correct root cause identification, (b) completeness of the fix, (c) whether the engineer addressed WHY it happened, not just a surface patch.
- passed = true only if score >= 7 AND root_cause_identified = true.
- critique must be specific to what THIS engineer wrote — never generic praise or generic criticism.
- missed_considerations: list concrete gaps versus the canonical solution (max 4 items).
- strengths: list what the engineer correctly identified (max 3 items). If nothing is correct, return an empty array — do not fabricate strengths.
- Respond with STRICT JSON matching the required schema. No markdown, no prose outside the JSON object, no trailing commentary.`;
}

export class AiEvaluationError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'AiEvaluationError';
  }
}

function isValidEvaluationResult(value: unknown): value is AiEvaluationResult {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.score === 'number' &&
    v.score >= 1 &&
    v.score <= 10 &&
    typeof v.passed === 'boolean' &&
    typeof v.root_cause_identified === 'boolean' &&
    typeof v.critique === 'string' &&
    Array.isArray(v.missed_considerations) &&
    v.missed_considerations.every((x) => typeof x === 'string') &&
    Array.isArray(v.strengths) &&
    v.strengths.every((x) => typeof x === 'string')
  );
}

/**
 * Calls Gemini with responseSchema enforcement, validates the result at runtime
 * (never trust an LLM's "structured output" claim blindly), and normalizes `passed`
 * server-side so grading policy isn't solely dependent on model compliance.
 */
export async function evaluateSubmission(
  challenge: Challenge,
  userSolution: string
): Promise<AiEvaluationResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AiEvaluationError('GEMINI_API_KEY is not configured on the server.');
  }

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: buildSystemPrompt(challenge) },
          { text: `ENGINEER'S SUBMITTED SOLUTION:\n${userSolution}` },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_JSON_SCHEMA,
    },
  };

  let res: Response;
  try {
    res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000), // hard timeout — never let a hung call block the route
    });
  } catch (err) {
    throw new AiEvaluationError('Network error calling Gemini API.', err);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new AiEvaluationError(`Gemini API returned ${res.status}: ${errText}`);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch (err) {
    throw new AiEvaluationError('Gemini API returned invalid JSON envelope.', err);
  }

  const rawText = (json as any)?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof rawText !== 'string') {
    throw new AiEvaluationError('Gemini response missing expected text payload.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    throw new AiEvaluationError('Model did not return valid JSON despite schema enforcement.', err);
  }

  if (!isValidEvaluationResult(parsed)) {
    throw new AiEvaluationError('Model JSON failed runtime shape validation.');
  }

  // Server-side policy enforcement — never trust the model's own `passed` flag alone.
  const normalized: AiEvaluationResult = {
    ...parsed,
    passed: parsed.score >= 7 && parsed.root_cause_identified === true,
  };

  return normalized;
}
