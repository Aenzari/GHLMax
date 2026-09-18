import { NextRequest, NextResponse } from 'next/server';
import { getTutorReply, TutorError } from '@/lib/ai/tutor';
import { TutorRequestBody } from '@/lib/types/tutor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_MESSAGE_LENGTH = 1000;
const MAX_MESSAGES = 20;

function isValidBody(body: unknown): body is TutorRequestBody {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.messages) || b.messages.length === 0 || b.messages.length > MAX_MESSAGES) {
    return false;
  }
  return b.messages.every(
    (m: any) =>
      typeof m === 'object' &&
      (m.role === 'user' || m.role === 'assistant') &&
      typeof m.content === 'string' &&
      m.content.length > 0 &&
      m.content.length <= MAX_MESSAGE_LENGTH
  );
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Malformed JSON body.' }, { status: 400 });
  }

  if (!isValidBody(body)) {
    return NextResponse.json(
      {
        error: `Body must include messages: {role, content}[] (max ${MAX_MESSAGES} messages, ${MAX_MESSAGE_LENGTH} chars each).`,
      },
      { status: 400 }
    );
  }

  // Defense in depth: even though the tutor prompt instructs the model not to reveal
  // answer keys, never let a raw expected_solution field reach this route's context
  // in the first place. Strip it if a caller ever adds it by mistake.
  if (body.context && 'expected_solution' in (body.context as Record<string, unknown>)) {
    delete (body.context as Record<string, unknown>).expected_solution;
  }

  try {
    const reply = await getTutorReply(body.messages, body.context);
    return NextResponse.json({ reply }, { status: 200 });
  } catch (err) {
    if (err instanceof TutorError) {
      console.error('[tutor] AI tutor failed:', err.message, err.cause ?? '');
      return NextResponse.json(
        { error: 'The study buddy is temporarily unavailable. Please try again shortly.' },
        { status: 502 }
      );
    }
    console.error('[tutor] Unexpected error:', err);
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST with { messages, context? }.' },
    { status: 405 }
  );
}
