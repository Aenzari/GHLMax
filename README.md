# GHL FlowLab

Interactive, AI-evaluated GoHighLevel automation simulator and diagnostic academy.

## Stack
Next.js (App Router) · Tailwind CSS · Supabase (Postgres + RLS) · Google Gemini API · React Flow

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

3. Run the database migration:
   - Open your Supabase project → SQL Editor
   - Paste and run `supabase/migrations/001_init_schema_and_seed.sql`

4. Start the dev server:
   ```bash
   npm run dev
   ```

5. Visit:
   - `/sandbox` — diagnostic ticket list
   - `/sandbox/[id]` — split-screen sandbox for one ticket
   - `/canvas` — visual workflow validator

## Project Structure

```
app/                    Routes only (pages + API route handlers)
  api/evaluate/         AI grading endpoint
  sandbox/              Diagnostic sandbox pages
  canvas/               Workflow validator canvas page
components/             React components, grouped by feature
  sandbox/              Split-screen diagnostic UI
  workflow-canvas/      React Flow canvas + custom nodes
lib/                    Framework-agnostic logic (no JSX)
  supabase/             Server-side Supabase client
  ai/                   Gemini API wrapper + grading logic
  types/                Shared TypeScript types
  workflow-validation/  Pure workflow validation engine
supabase/migrations/    SQL migrations, applied in numeric order
```

## Known Gaps / Next Steps

- `userId` in `DiagnosticSandbox` is optional and unwired — connect Supabase Auth (or another provider) to persist submission history.
- Quiz bank UI not yet built (schema + seed data exist in the migration).
- No deployment config yet — deploy to Vercel by connecting this repo and setting the same env vars in the Vercel dashboard.
