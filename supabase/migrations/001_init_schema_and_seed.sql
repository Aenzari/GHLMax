-- ============================================================================
-- GHL FlowLab — Migration 001: Core Schema + RLS + Seed Data
-- Target: Supabase (PostgreSQL 15+)
-- FIX: all seed text fields use single unbroken string literals (no
-- multi-line E'...' concatenation) to avoid parser issues in web SQL editors.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- EXTENSIONS
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- 1. MODULES — Curriculum containers (maps to Phase 1-7 content)
-- ----------------------------------------------------------------------------
create table if not exists modules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  description text,
  phase_number int not null check (phase_number > 0),
  created_at timestamptz default now()
);

comment on table modules is 'Top-level curriculum groupings (e.g. Relational Data, Workflow Engine, Telephony/DNS).';

-- ----------------------------------------------------------------------------
-- 2. CHALLENGES — Scenario-based diagnostic tickets
-- ----------------------------------------------------------------------------
create table if not exists challenges (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references modules(id) on delete cascade,
  title text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  domain text not null check (
    domain in ('relational_schema', 'trigger_logic', 'threading_timing', 'telephony_dns', 'webhooks_api')
  ),
  broken_scenario text not null,
  reproduction_logs jsonb,
  expected_solution text not null,
  hint text,
  created_at timestamptz default now()
);

comment on table challenges is 'Simulated broken GHL sub-account tickets used as diagnostic exercises.';
create index if not exists idx_challenges_module_id on challenges(module_id);
create index if not exists idx_challenges_domain on challenges(domain);

-- ----------------------------------------------------------------------------
-- 3. QUIZ_QUESTIONS — Mastery quiz bank
-- ----------------------------------------------------------------------------
create table if not exists quiz_questions (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references modules(id) on delete cascade,
  question text not null,
  options jsonb not null,
  correct_index int not null,
  explanation text not null,
  created_at timestamptz default now(),
  constraint correct_index_in_range check (correct_index >= 0)
);

create index if not exists idx_quiz_module_id on quiz_questions(module_id);

-- ----------------------------------------------------------------------------
-- 4. USER_SUBMISSIONS — Diagnostic attempts + AI grading results
-- ----------------------------------------------------------------------------
create table if not exists user_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  challenge_id uuid not null references challenges(id) on delete cascade,
  user_solution text not null,
  ai_score int check (ai_score between 1 and 10),
  ai_critique text,
  ai_raw_response jsonb,
  passed boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_submissions_user_id on user_submissions(user_id);
create index if not exists idx_submissions_challenge_id on user_submissions(challenge_id);

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
alter table modules enable row level security;
alter table challenges enable row level security;
alter table quiz_questions enable row level security;
alter table user_submissions enable row level security;

create policy "public_read_modules" on modules
  for select using (true);

create policy "public_read_challenges" on challenges
  for select using (true);

create policy "public_read_quiz_questions" on quiz_questions
  for select using (true);

create policy "users_select_own_submissions" on user_submissions
  for select using (auth.uid() = user_id);

create policy "users_insert_own_submissions" on user_submissions
  for insert with check (auth.uid() = user_id);

-- No update/delete policies defined -> submissions are immutable audit records by default.

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- ----------------------------------------------------------------------------
-- MODULES
-- ----------------------------------------------------------------------------
insert into modules (id, title, slug, description, phase_number) values
  ('a1000000-0000-0000-0000-000000000001', 'Relational Data Architecture', 'relational-data-architecture', 'Contact model, custom fields vs. custom values, tag hygiene, pipelines, smart lists.', 1),
  ('a1000000-0000-0000-0000-000000000002', 'Workflow Engine Mechanics', 'workflow-engine-mechanics', 'Filters vs. If/Else, wait steps, timezones, race conditions, re-entry bugs.', 2),
  ('a1000000-0000-0000-0000-000000000003', 'Telephony & DNS Deliverability', 'telephony-dns-deliverability', 'A2P 10DLC brand/campaign rules, SPF/DKIM/DMARC progression, domain/CNAME failures.', 3),
  ('a1000000-0000-0000-0000-000000000004', 'Webhooks & API Integration', 'webhooks-api-integration', 'JSON payload mapping, silent 200 OK failures, key vs. label mismatches.', 4)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- CHALLENGES — 3 real-world disaster tickets, one per major domain
-- ----------------------------------------------------------------------------
insert into challenges (id, module_id, title, severity, domain, broken_scenario, reproduction_logs, expected_solution, hint) values

(
  'b2000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000002',
  'Nurture Sequence Sending Duplicate/Overlapping Texts',
  'high',
  'threading_timing',
  'Client (HVAC company) reports: "Some leads are getting the SAME nurture text twice, sometimes 3 days apart, and it looks like we are spamming them." The workflow is a 3-day wait-based nurture sequence triggered on Form Submitted. Re-entry is set to Allow. The client confirms the same lead sometimes re-submits the contact form on Day 2 (for example, correcting a typo in their phone number) while still inside the original Wait step from Day 0.',
  '{"workflow_history_sample": [{"contact_id": "c-8841", "thread_id": "t-001", "entered_at": "2026-09-01T09:00:00Z", "status": "waiting", "step": "Wait 3 Days"}, {"contact_id": "c-8841", "thread_id": "t-002", "entered_at": "2026-09-02T14:30:00Z", "status": "waiting", "step": "Wait 3 Days"}], "observation": "Two active threads exist simultaneously for the same contact_id, offset by roughly 29.5 hours."}'::jsonb,
  'Root cause: Re-entry is allowed on a time-based nurture workflow, so a second form submission during the active Wait step spins up a second parallel thread instead of resuming or replacing the first. Fix: (1) Set workflow Re-entry to No for any sequence containing Wait steps tied to a nurture cadence. (2) If legitimate re-submissions must be captured, such as corrected contact info, add a Filter at entry checking for an already-enrolled tag or an open, non-expired Opportunity in the relevant stage before allowing a second thread to spawn. (3) Add a Goal condition, such as Reply Received or Booked, so any active thread self-terminates once the objective is met, reducing the window where duplicate threads can overlap.',
  'Check the Execution Log for multiple thread_ids tied to one contact_id -- that is the signature of a re-entry collision, not a bug in the wait timer itself.'
),

(
  'b2000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000003',
  'All Outbound Email Suddenly Rejected, SMS Delivery Rate Cratered',
  'critical',
  'telephony_dns',
  'Client (med spa) reports two simultaneous failures the same week: (1) "Nobody is receiving our emails at all, not even in spam" and (2) "Our appointment reminder texts are barely going out, maybe 1 in 10 sends." The agency admin recalls tightening security on the domain a few days ago and separately recalls the phone system flagging something about a campaign under review banner that they dismissed without reading.',
  '{"dns_lookup": {"spf": "valid", "dkim": "valid", "dmarc_policy": "p=reject", "dmarc_set_days_ago": 2}, "a2p_status": {"brand_status": "APPROVED", "campaign_status": "PENDING_REVIEW", "days_pending": 4}}'::jsonb,
  'Two independent root causes, both process failures rather than platform bugs: (1) EMAIL: DMARC was escalated straight to p=reject only 2 days after SPF and DKIM were added, before full propagation and validation could be confirmed, so receiving servers are hard-rejecting mail outright. Fix: roll DMARC back to p=none immediately, monitor aggregate reports for 1-2 weeks confirming clean SPF/DKIM alignment, then re-escalate gradually to quarantine, then reject. (2) SMS: The A2P 10DLC Campaign is still in Pending Review, not yet approved, so carriers are filtering the vast majority of messages sent under an unapproved campaign, which explains the roughly 90 percent delivery failure. Fix: do not activate volume-sensitive SMS workflows until Campaign status reads APPROVED in Settings, Phone Numbers, A2P; treat the pending banner as a hard blocker, not a dismissible notice.',
  'Two unrelated systems failing the same week is a coincidence trap -- diagnose email and SMS as two fully separate root causes, not one shared cause.'
),

(
  'b2000000-0000-0000-0000-000000000003',
  'a1000000-0000-0000-0000-000000000004',
  'Zapier Shows 100% Success But New Contacts Have Blank Phone Numbers',
  'medium',
  'webhooks_api',
  'Client (roofing company) reports: "Our Zapier integration from Facebook Lead Ads to GHL has a perfect success rate in Zapier history tab, but every new contact created in the last 3 days has a completely empty phone field, breaking our Speed-to-Lead SMS automation." No changes were made in GHL. The client mentions Facebook recently updated their lead form questions.',
  '{"zapier_task_history": "100% success, 200 OK on all tasks", "sample_incoming_payload": {"full_name": "Jane Doe", "email_address": "jane@test.com", "best_contact_number": "+15550001111"}, "zapier_field_mapping_configured": {"ghl_phone_field": "phone_number"}}'::jsonb,
  'Root cause: Facebook renamed the lead form question, changing the payload key from phone_number to best_contact_number. Zapier field mapping still points to the old key phone_number, which no longer exists in the incoming payload, so Zapier sends the now-empty mapped value to GHL. GHL accepts the API call and returns 200 OK regardless, because success only confirms the HTTP request was received, not that the mapped field contained data. Fix: re-open the Zapier Zap, re-map the phone field to the new best_contact_number key, and add a safety-net workflow such as If Phone field is blank AND Source is Facebook, send Internal Alert to admin, so this failure mode is caught immediately next time rather than discovered days later.',
  'A 200 OK success status only proves the HTTP request was accepted -- it never proves the payload contained the fields you expected. Go straight to the raw payload, not the automation platform success log.'
)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- QUIZ QUESTIONS — 1 sample per module (expand later via [MODE: CONTENT])
-- ----------------------------------------------------------------------------
insert into quiz_questions (module_id, question, options, correct_index, explanation) values
(
  'a1000000-0000-0000-0000-000000000002',
  'A workflow with a 3-day Wait step has Re-entry set to Allow. A contact re-submits the same form on Day 2. What is the most likely production consequence?',
  '["Nothing -- GHL automatically merges the two attempts into one thread", "A second parallel execution thread starts, causing duplicate or overlapping messaging", "The workflow throws a visible error and halts", "The original thread is cancelled and restarted from step 1"]'::jsonb,
  1,
  'Each contact-based trigger firing spins up an independent thread. With re-entry allowed, the second submission does not merge with or cancel the first -- it runs alongside it, which is why duplicate or overlapping messages appear with no error thrown.'
),
(
  'a1000000-0000-0000-0000-000000000003',
  'Immediately after adding valid SPF and DKIM records, an admin sets DMARC to p=reject. What is the most likely outcome?',
  '["Improved deliverability immediately", "No change until 30 days pass", "Legitimate email gets hard-rejected before DKIM alignment is confirmed", "DMARC has no effect on email delivery"]'::jsonb,
  2,
  'DMARC policy should start at p=none to monitor alignment before escalating. Jumping straight to p=reject before propagation and validation completes causes receiving servers to reject legitimate mail outright.'
)
on conflict do nothing;
