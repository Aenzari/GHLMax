-- GHL FlowLab, Migration 002: 30-Day Academy Engine
-- Adds: curriculum_lessons, interactive_examples, user_lesson_progress
-- Seed: Week 1, Days 1-4 (Contact Object + Custom Fields vs. Custom Values)
-- Target: Supabase (PostgreSQL 15+)
-- NOTE: this file avoids ANY double-hyphen (--) sequence, including inside
-- seeded markdown content, since some SQL editors naively strip "-- comments"
-- without understanding string context, which silently truncates content.

create extension if not exists "pgcrypto";

-- 1. CURRICULUM_LESSONS: bite sized markdown lessons, ordered by week/day
create table if not exists curriculum_lessons (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  week_number int not null check (week_number between 1 and 4),
  day_range text not null,
  day_start int not null check (day_start between 1 and 30),
  day_end int not null check (day_end between 1 and 30),
  reading_time_minutes int not null check (reading_time_minutes > 0),
  learning_objectives jsonb not null default '[]'::jsonb,
  content_markdown text not null,
  prerequisite_slugs text[] not null default '{}',
  sort_order int not null,
  created_at timestamptz default now(),
  constraint day_range_valid check (day_end >= day_start)
);

comment on table curriculum_lessons is 'Progressive 30 day GHL/RevOps curriculum content, one row per lesson block.';
create index if not exists idx_lessons_week on curriculum_lessons(week_number);
create index if not exists idx_lessons_sort on curriculum_lessons(sort_order);

-- 2. INTERACTIVE_EXAMPLES: visual payloads, merge tag testers, logic trees
create table if not exists interactive_examples (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references curriculum_lessons(id) on delete cascade,
  example_type text not null check (
    example_type in ('merge_tag_tester', 'payload_inspector', 'logic_tree', 'field_comparison', 'quiz_prompt')
  ),
  title text not null,
  description text,
  config jsonb not null,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

comment on table interactive_examples is 'Right column interactive widgets attached to a lesson.';
create index if not exists idx_examples_lesson on interactive_examples(lesson_id);

-- 3. USER_LESSON_PROGRESS: per user completion tracking
create table if not exists user_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references curriculum_lessons(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  last_viewed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now(),
  unique (user_id, lesson_id)
);

comment on table user_lesson_progress is 'Tracks each learner progress through the 30 day curriculum, one row per user/lesson pair.';
create index if not exists idx_progress_user on user_lesson_progress(user_id);
create index if not exists idx_progress_lesson on user_lesson_progress(lesson_id);

-- ROW LEVEL SECURITY
alter table curriculum_lessons enable row level security;
alter table interactive_examples enable row level security;
alter table user_lesson_progress enable row level security;

create policy "public_read_lessons" on curriculum_lessons
  for select using (true);

create policy "public_read_examples" on interactive_examples
  for select using (true);

create policy "users_select_own_progress" on user_lesson_progress
  for select using (auth.uid() = user_id);

create policy "users_insert_own_progress" on user_lesson_progress
  for insert with check (auth.uid() = user_id);

create policy "users_update_own_progress" on user_lesson_progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- SEED DATA: Week 1, Days 1-4

-- LESSON 1: Day 1-2, The Contact Object and Sub-Account Architecture
insert into curriculum_lessons (
  id, slug, title, week_number, day_range, day_start, day_end,
  reading_time_minutes, learning_objectives, content_markdown, prerequisite_slugs, sort_order
) values (
  'c1000000-0000-0000-0000-000000000001',
  'contact-object-sub-account-architecture',
  'The Contact Object & Sub-Account Architecture',
  1, 'Day 1-2', 1, 2, 12,
  '["Explain what a Contact record is and why it is the single source of truth in GHL", "Describe how Sub-Accounts isolate one client data from another", "Identify the core native fields every Contact carries", "Understand why Time Zone on a Contact silently affects automation timing later in the course"]'::jsonb,
  '# The Contact Object and Sub-Account Architecture

## What is a Contact?

Think of a Contact as a filing folder with one person''s name on it. Everything you ever learn about that person, their email, their tags, their deals, their appointments, gets clipped into that one folder. Nothing GHL does lives outside a Contact folder, automations, pipelines, and messages all reference back to it.

## Sub-Accounts: Separate Filing Cabinets

A Sub-Account, sometimes called a Location, is like a separate filing cabinet for one client business. Contacts, workflows, and settings inside Sub-Account A are completely invisible to Sub-Account B, even if you, the agency, manage both.

Why this matters: every setting you configure, such as phone numbers, custom fields, and workflows, has to be set up per Sub-Account. There is no set it once for every client toggle at the agency level for most of this, which is exactly why templated Snapshots exist. You will meet these on Day 3-4.

## Core Native Fields on Every Contact

Every Contact record carries these fields by default:

* Name, Email, and Phone: basic identity
* Source: where the lead came from, such as Facebook or a referral
* DND Status: Do Not Disturb, tracked separately per channel (SMS, Email, Call)
* Contact Type: Lead versus Customer
* Owner: which team member is assigned
* Time Zone: auto-detected from area code, or manually set

That last one, Time Zone, seems boring right now, but it quietly controls exactly when Wait Until steps fire in Week 2. A wrong or missing Time Zone is one of the most common causes of appointment reminders arriving at 3am. File that away.

## Try It Yourself

Use the interactive panel on the right to explore a sample Contact record and see how its fields map to what an automation would actually see.
',
  '{}', 1
) on conflict (id) do nothing;

insert into interactive_examples (lesson_id, example_type, title, description, config, sort_order) values
(
  'c1000000-0000-0000-0000-000000000001',
  'payload_inspector',
  'Inspect a Sample Contact Record',
  'Click through the fields to see exactly what data an automation can reference from this Contact.',
  '{
    "sample_payload": {
      "id": "cont_8841",
      "first_name": "Jamie",
      "last_name": "Rivera",
      "email": "jamie.rivera@example.com",
      "phone": "+15125550142",
      "source": "Facebook Lead Ad",
      "contact_type": "lead",
      "dnd": {"sms": false, "email": false, "call": false},
      "timezone": "America/Chicago",
      "owner": "unassigned"
    },
    "annotations": {
      "id": "Internal unique identifier, never shown to the contact, but required by every API call and webhook.",
      "timezone": "Drives when Wait Until steps resolve. If blank, GHL falls back to the sub-account default timezone.",
      "dnd": "Per-channel opt-out flags. A workflow can still attempt to send if these are ignored by a misconfigured automation, so always check this before assuming a message went out."
    }
  }'::jsonb,
  1
) on conflict do nothing;

-- LESSON 2: Day 3-4, Custom Fields vs Custom Values
insert into curriculum_lessons (
  id, slug, title, week_number, day_range, day_start, day_end,
  reading_time_minutes, learning_objectives, content_markdown, prerequisite_slugs, sort_order
) values (
  'c1000000-0000-0000-0000-000000000002',
  'custom-fields-vs-custom-values',
  'Custom Fields vs. Custom Values',
  1, 'Day 3-4', 3, 4, 14,
  '["Distinguish Custom Fields, which are per contact, from Custom Values, which are per account", "Explain why Custom Values are described as environment variables for a Snapshot", "Write correct merge tag syntax for each", "Predict what breaks if a Custom Value is used where a Custom Field was needed, and vice versa"]'::jsonb,
  '# Custom Fields vs. Custom Values

## The One-Sentence Version

Custom Field equals data that is different for every Contact, such as their lead score or their appointment date.
Custom Value equals data that is the same for every Contact in this Sub-Account, such as the business phone number or its booking link.

## Think of it Like a Form Letter

Imagine a mail merge letter:

* The tag for a first name changes for every single letter you print. That is a Custom Field.
* The company letterhead at the top, the business name, its address, is identical on every letter. That is a Custom Value.

## Why Custom Values Are Called Environment Variables

In software, an environment variable is a single named setting, like an API key or a database URL, that your code reads instead of having the value typed directly into the code everywhere it is needed. Change the variable once, and every place that reads it updates automatically.

Custom Values work identically inside a Snapshot: instead of typing a phone number into thirty different SMS templates, you reference one Custom Value key inside all thirty. When this Snapshot is deployed to a brand new client, you change one value in Settings, and all thirty templates instantly reflect the new client real phone number.

## Side by Side

Here is how the two compare directly:

* Changes per Contact: Custom Field, yes. Custom Value, no, it stays the same for the whole Sub-Account.
* Merge syntax: Custom Field uses a contact prefixed tag. Custom Value uses a custom_values prefixed tag.
* Typical example: Custom Field holds things like lead_score or appointment_date. Custom Value holds things like business_name or booking_link.
* Copies with a Snapshot: Custom Field structure copies, but the data stays blank. Custom Value structure AND the value itself both copy over.

## The Mistake Beginners Make

Typing a client actual phone number directly into an SMS template instead of using a Custom Value. It works fine for Client A, until you reuse that same Snapshot for Client B, and now Client B leads are texting Client A phone number. This is one of the most common why is this not working tickets in real agencies.

## Try It Yourself

Use the Live Merge Field Tester on the right to see both merge tags render against sample data, and watch what happens when you accidentally swap them.
',
  '{"contact-object-sub-account-architecture"}', 2
) on conflict (id) do nothing;

insert into interactive_examples (lesson_id, example_type, title, description, config, sort_order) values
(
  'c1000000-0000-0000-0000-000000000002',
  'merge_tag_tester',
  'Live Merge Field Tester',
  'Type or select a merge tag and see it render against sample contact data and sample account level custom values.',
  '{
    "sample_contact_fields": {
      "contact.first_name": "Jamie",
      "contact.lead_score": "82",
      "contact.appointment_date": "2026-09-22"
    },
    "sample_custom_values": {
      "custom_values.business_name": "Apex Home Services",
      "custom_values.business_phone": "+1-555-0100",
      "custom_values.booking_link": "https://link.example.com/book"
    },
    "test_cases": [
      {
        "tag": "{{ contact.first_name }}",
        "renders_to": "Jamie",
        "explanation": "Correct usage. This value is unique per contact."
      },
      {
        "tag": "{{ custom_values.business_phone }}",
        "renders_to": "+1-555-0100",
        "explanation": "Correct usage. Identical for every contact in this sub-account."
      },
      {
        "tag": "{{ contact.business_phone }}",
        "renders_to": "(blank, field does not exist on the Contact object)",
        "explanation": "Common mistake: business_phone was never created as a Custom Field, so this renders empty with no error shown."
      }
    ]
  }'::jsonb,
  1
),
(
  'c1000000-0000-0000-0000-000000000002',
  'field_comparison',
  'Snapshot Portability Check',
  'See what actually transfers when this Sub-Account is cloned into a Snapshot and deployed to a new client.',
  '{
    "scenario": "Snapshot deployed from Client A to Client B",
    "custom_field_result": {
      "field_key": "lead_score",
      "structure_copied": true,
      "data_copied": false,
      "note": "Client B starts with an empty lead_score field on every contact, correct behavior, since Client B has different leads."
    },
    "custom_value_result": {
      "value_key": "business_phone",
      "structure_copied": true,
      "data_copied": true,
      "note": "Without manual update, Client B templates would still show Client A phone number until someone edits this Custom Value in Settings."
    }
  }'::jsonb,
  2
)
on conflict do nothing;
