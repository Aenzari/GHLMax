import { TutorMessage, TutorContext } from '@/lib/types/tutor';

const GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const MAX_HISTORY_MESSAGES = 12; // keep context window small on the free tier
const MAX_REPLY_CHARS = 2500;

export class TutorError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'TutorError';
  }
}

function buildSystemPrompt(context?: TutorContext): string {
  const base = `You are a Socratic Study Buddy for GHL FlowLab, a platform teaching GoHighLevel CRM automation and RevOps to complete beginners aiming for job-ready mastery.

YOUR TEACHING PHILOSOPHY:
- Explain jargon using everyday analogies (mail merge, filing cabinets, light switches) before using the technical term.
- When a learner asks "what should I do" about a diagnostic challenge or exercise, do NOT give the direct answer. Instead ask a guiding question that leads them toward discovering it themselves, or give a small hint that narrows the search space without naming the root cause outright.
- When a learner asks a pure conceptual question ("what is a Custom Value"), answer directly and clearly — Socratic method applies to problem-solving, not to withholding basic definitions.
- Keep replies short: 2-5 sentences unless the learner explicitly asks for a deep dive.
- Never fabricate GoHighLevel UI details you are not confident about — if unsure, say so plainly rather than inventing menu paths.
- Be warm and encouraging. A wrong guess from a beginner is a normal part of learning, not a failure.

STRICT BOUNDARY: If provided a "current context" below that includes a diagnostic challenge, you do not have access to its answer key and must never guess at or assert a specific root cause with confidence — guide the learner's own reasoning process instead.`;

  if (!context || context.pageType === 'general') {
    return base;
  }

  const contextBlock = `\n\nCURRENT CONTEXT (for grounding only — do not treat this as something to solve FOR the learner):\nPage type: ${context.pageType}\n${context.title ? `Title: ${context.title}\n` : ''}${context.contextSnippet ? `Snippet: ${context.contextSnippet}\n` : ''}`;

  return base + contextBlock;
}

function isValidHistory(messages: TutorMessage[]): boolean {
  return (
    Array.isArray(messages) &&
    messages.length > 0 &&
    messages.every(
      (m) =>
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string' &&
        m.content.trim().length > 0
    )
  );
}

export async function getTutorReply(
  messages: TutorMessage[],
  context?: TutorContext
): Promise<string> {
  if (!isValidHistory(messages)) {
    throw new TutorError('Invalid message history — each message needs a role and non-empty content.');
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new TutorError('GEMINI_API_KEY is not configured on the server.');
  }

  // Trim to the last N messages to keep the free-tier context window small and cheap.
  const trimmedHistory = messages.slice(-MAX_HISTORY_MESSAGES);

  const contents = trimmedHistory.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const body = {
    systemInstruction: {
      parts: [{ text: buildSystemPrompt(context) }],
    },
    contents,
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 400,
    },
  };

  let res: Response;
  try {
    res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    throw new TutorError('Network error calling Gemini API.', err);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new TutorError(`Gemini API returned ${res.status}: ${errText}`);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch (err) {
    throw new TutorError('Gemini API returned invalid JSON.', err);
  }

  const rawText = (json as any)?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof rawText !== 'string' || rawText.trim().length === 0) {
    throw new TutorError('Gemini response missing expected text payload.');
  }

  return rawText.trim().slice(0, MAX_REPLY_CHARS);
}
