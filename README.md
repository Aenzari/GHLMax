# GHL FlowLab

Interactive, AI-evaluated GoHighLevel automation simulator and 30-day diagnostic academy.

## Stack
Next.js (App Router) · Tailwind CSS · Supabase (Postgres + RLS) · Google Gemini API · React Flow (`@xyflow/react`)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy env template and fill in real values:
   ```bash
   cp .env.example .env.local
   ```
   Required vars:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY` (free tier: https://aistudio.google.com/apikey)

3. Run the database migrations **in order**, either via the Supabase CLI or by
   pasting each file into the Supabase Dashboard SQL Editor one at a time:
   - `supabase/migrations/001_init_schema_and_seed.sql` — diagnostic sandbox schema + 3 seeded bug-bash tickets
   - `supabase/migrations/002_academy_engine_schema_and_seed.sql` — 30-day curriculum schema + Week 1, Days 1-4 lessons

4. Start the dev server:
   ```bash
   npm run dev
   ```

5. Visit:
   - `/learn` — 30-day curriculum index
   - `/learn/[slug]` — two-column lesson page (theory + interactive explorer)
   - `/sandbox` — diagnostic ticket list (bug-bash mode)
   - `/sandbox/[id]` — split-screen AI-graded diagnostic sandbox
   - `/canvas` — visual workflow builder, with Validation and Test Flight modes

   The AI Study Buddy (bottom-right chat bubble) is available on every page and
   automatically grounds itself in whichever lesson you're viewing.

## Project Structure

```
app/                         Routes only (pages + API route handlers)
  layout.tsx                 Root layout — mounts TutorContextProvider + single global AiTutorDrawer
  learn/                     30-day curriculum pages
    page.tsx                 Curriculum index, grouped by week
    [slug]/page.tsx          Individual lesson (server component)
  sandbox/                   Diagnostic bug-bash pages
    page.tsx                 Ticket list
    [challengeId]/page.tsx   Split-screen sandbox for one ticket
  canvas/page.tsx             Workflow validator + Test Flight canvas
  api/
    evaluate/route.ts        AI grading endpoint (diagnostic submissions)
    tutor/route.ts           Socratic AI tutor endpoint

components/                  React components, grouped by feature
  learn/                     Lesson UI: markdown renderer, interactive widgets, lesson view
  sandbox/                   Split-screen diagnostic UI
  tutor/                     AiTutorDrawer — mount exactly ONE instance (in app/layout.tsx)
  workflow-canvas/           React Flow canvas, custom nodes, validation panel, Test Flight panel

lib/                         Framework-agnostic logic (no JSX)
  supabase/                  server.ts (service role, server-only) + client.ts (anon key, browser-safe)
  ai/                        evaluate.ts (grading) + tutor.ts (Socratic tutor) — separate Gemini wrappers, different prompts
  tutor/                     TutorContextProvider.tsx — shared context so pages can ground the ONE global tutor drawer
  types/                     Shared TypeScript types (evaluation, curriculum, tutor)
  workflow-validation/       Pure validation engine (unbounded waits, race conditions, orphaned nodes, etc.)
  workflow-simulation/       Pure Test Flight traversal engine (mock trigger to step-by-step path)

supabase/migrations/         SQL migrations, applied in numeric order
```

## Key Architectural Notes

- **Two separate Gemini prompts, two separate files**: `lib/ai/evaluate.ts` grades diagnostic submissions against a hidden answer key; `lib/ai/tutor.ts` is Socratic and never sees answer keys. Don't merge these, they have opposite goals (one judges, one guides).
- **`expected_solution` never reaches the client.** Stripped server-side in `app/sandbox/[challengeId]/page.tsx` before the page renders, and defensively stripped again in `app/api/tutor/route.ts` if a caller ever tries to pass it through tutor context.
- **Exactly one `AiTutorDrawer` component** should exist in the component tree (mounted in `app/layout.tsx`). Pages ground it via the `useSetTutorContext` hook from `lib/tutor/TutorContextProvider.tsx` instead of rendering their own drawer instance.
- **Test Flight does not auto-evaluate filter/if-else conditions.** Conditions are free-text labels, not executable expressions, so branch selection at those nodes is an intentional manual step for the learner, not a missing feature.
- **Markdown rendering is dependency-free by design** (`components/learn/MarkdownRenderer.tsx`) since lesson content is authored/seeded by us, not user-submitted. Swap to `react-markdown` plus sanitization if lesson content ever becomes user-editable.

## Known Gaps / Next Steps

- Auth is not wired yet. `userId` is optional throughout (`DiagnosticSandbox`, `LessonView`), anonymous use works end to end, but submission history and lesson progress won't persist until a real auth provider (Supabase Auth, Clerk, etc.) is connected and a real `userId` is threaded down from a parent layout.
- Prerequisite checking on lesson pages currently only lists prerequisite lesson titles, it does not yet check actual completion status per user (blocked on the same auth gap above).
- Quiz bank UI not yet built (schema and seed data exist in migration 001).
- No deployment config yet, deploy to Vercel by connecting this repo and setting the same env vars in the Vercel dashboard.
