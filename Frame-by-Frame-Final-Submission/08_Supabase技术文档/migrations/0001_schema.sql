-- =============================================================================
-- Frame by Frame — Supabase schema (stage 2 design)
-- File: supabase/migrations/0001_schema.sql
-- Date: 2026-11-19
--
-- Scope:
--   profiles, user films, watch notes, note analyses, taste profile / events /
--   snapshots / feedback, agent observation bundles, corrections, yearbooks.
--
-- Design notes:
--   * Business ids keep the client-generated string ids (rec_xxx, snap_xxx) so
--     that re-importing the same local state is idempotent.
--   * watch_notes uses soft delete (deleted_at) so a deletion can reach other
--     devices. Hard deletion happens through public.delete_my_data().
--   * No table stores passwords, tokens or emails copied from the AI payload.
--   * RLS lives in 0002_rls.sql. This file only creates structure.
--   * Run this file once in the Supabase SQL editor (or with `supabase db push`).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Shared helpers
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Generic BEFORE UPDATE trigger: refresh updated_at.';

-- -----------------------------------------------------------------------------
-- 1. profiles — one row per auth user
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  display_name text not null default '',
  avatar_url text,
  allow_ai_notes boolean not null default false,
  ai_policy_version text not null default '2026-11-01',
  locale text not null default 'zh-CN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (char_length(display_name) <= 40)
);

comment on table public.profiles is
  'Public profile owned by one auth.users row. Email is a read-only mirror of auth.users.email.';
comment on column public.profiles.email is
  'Mirror maintained by trigger; the source of truth is auth.users.email.';
comment on column public.profiles.allow_ai_notes is
  'Explicit consent before a private note is sent to the AI gateway. Mirrors AppState.settings.allowAiNotes.';

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- profiles.email is a mirror, never a client-supplied value. On INSERT the value
-- is pinned to auth.users.email; on UPDATE the column is not writable by
-- `authenticated` (see the column-level grant in 0002_rls.sql).
create or replace function public.pin_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.email := coalesce(
    (select u.email from auth.users u where u.id = new.id),
    ''
  );
  return new;
end;
$$;

comment on function public.pin_profile_email() is
  'BEFORE INSERT trigger on profiles: email always comes from auth.users.';

drop trigger if exists profiles_pin_email on public.profiles;
create trigger profiles_pin_email
before insert on public.profiles
for each row execute function public.pin_profile_email();

-- Create a profile row for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'display_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'AFTER INSERT trigger on auth.users: create the matching profile row.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Keep the email mirror in sync when auth changes the address.
create or replace function public.sync_user_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set email = coalesce(new.email, ''),
         updated_at = now()
   where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
after update of email on auth.users
for each row execute function public.sync_user_email();

-- -----------------------------------------------------------------------------
-- 2. user_films — films the user added beyond the bundled catalogue
--    The 16 built-in films stay in the client bundle; only user additions are
--    persisted, keyed by the same film slug used in WatchRecord.filmId.
-- -----------------------------------------------------------------------------

create table if not exists public.user_films (
  user_id uuid not null references auth.users (id) on delete cascade,
  film_key text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, film_key),
  constraint user_films_key_length check (char_length(film_key) between 1 and 120)
);

comment on table public.user_films is
  'Custom / externally imported films per user. film_key equals Film.id in src/types.ts.';
comment on column public.user_films.payload is
  'Full Film object (palette, motif, artwork provenance, catalogue ids…).';

drop trigger if exists user_films_set_updated_at on public.user_films;
create trigger user_films_set_updated_at
before update on public.user_films
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. watch_notes — the product's core memory
-- -----------------------------------------------------------------------------

create table if not exists public.watch_notes (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  film_key text not null,
  film_snapshot jsonb not null default '{}'::jsonb,
  rating numeric(2, 1) not null,
  watched_at date not null,
  status text not null default 'watched',
  reflection text not null default '',
  felt_like_tags text[] not null default '{}',
  themes text[] not null default '{}',
  moods text[] not null default '{}',
  ai_summary text not null default '',
  ai_extracted_from text not null default 'local-engine',
  ai_confidence numeric(3, 2) not null default 0,
  source text not null default 'user',
  is_demo boolean not null default false,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint watch_notes_id_format check (id ~ '^rec_[A-Za-z0-9_-]{2,80}$'),
  constraint watch_notes_rating_range check (rating >= 0.5 and rating <= 5),
  constraint watch_notes_status_values check (status in ('watched', 'rewatched', 'abandoned')),
  constraint watch_notes_source_values check (source in ('seed', 'user')),
  constraint watch_notes_confidence_range check (ai_confidence >= 0 and ai_confidence <= 1),
  constraint watch_notes_reflection_length check (char_length(reflection) <= 20000),
  constraint watch_notes_film_key_length check (char_length(film_key) between 1 and 120)
);

comment on table public.watch_notes is
  'One row per viewing memory. Private by default; RLS restricts every row to its owner.';
comment on column public.watch_notes.film_snapshot is
  'Display snapshot (title, year, poster) so a note still renders if the catalogue changes.';
comment on column public.watch_notes.source is
  'seed = bundled demo record, user = written by the account owner.';
comment on column public.watch_notes.is_demo is
  'True only for explicitly imported demo data; excluded from real taste evidence.';
comment on column public.watch_notes.revision is
  'Optimistic concurrency counter; incremented by trigger on every update.';
comment on column public.watch_notes.deleted_at is
  'Soft-delete tombstone so another device can see the deletion.';

create or replace function public.bump_note_revision()
returns trigger
language plpgsql
as $$
begin
  new.revision = old.revision + 1;
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.bump_note_revision() is
  'BEFORE UPDATE trigger for watch_notes: revision = revision + 1, updated_at = now().';

drop trigger if exists watch_notes_revision on public.watch_notes;
create trigger watch_notes_revision
before update on public.watch_notes
for each row execute function public.bump_note_revision();

create index if not exists watch_notes_user_watched_idx
  on public.watch_notes (user_id, watched_at desc)
  where deleted_at is null;

create index if not exists watch_notes_user_updated_idx
  on public.watch_notes (user_id, updated_at desc);

create index if not exists watch_notes_user_film_idx
  on public.watch_notes (user_id, film_key);

-- -----------------------------------------------------------------------------
-- 4. note_analyses — one replaceable AI analysis per note
--    Stores the full AgentRunV2 document so provenance is never recomputed.
-- -----------------------------------------------------------------------------

create table if not exists public.note_analyses (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  note_id text not null references public.watch_notes (id) on delete cascade,
  schema_version text not null default 'agent-run.v2',
  status text not null default 'succeeded',
  provider text not null default 'legacy-deepseek',
  agent_id text not null default 'legacy-deepseek-pipeline',
  run jsonb not null,
  note_sha256 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.note_analyses is
  'Immutable-shape analysis runs attached to one note; one row per note (unique index).';
comment on column public.note_analyses.run is
  'Full AgentRunV2 payload, including analysis, evidence quotes and KB citations.';
comment on column public.note_analyses.note_sha256 is
  'SHA-256 of the note text at analysis time; detects edits that invalidate the reading.';

create unique index if not exists note_analyses_one_per_note
  on public.note_analyses (user_id, note_id);

drop trigger if exists note_analyses_set_updated_at on public.note_analyses;
create trigger note_analyses_set_updated_at
before update on public.note_analyses
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. taste_profiles — the current six-dimension portrait
--    Derived client-side, persisted so every device paints the same portrait.
-- -----------------------------------------------------------------------------

create table if not exists public.taste_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  dimensions jsonb not null default '[]'::jsonb,
  evidence_count integer not null default 0,
  version integer not null default 1,
  computed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.taste_profiles is
  'Current taste portrait per user. Recomputed from accepted notes; never authored by hand.';
comment on column public.taste_profiles.version is
  'Incremented whenever the persisted portrait changes.';

drop trigger if exists taste_profiles_set_updated_at on public.taste_profiles;
create trigger taste_profiles_set_updated_at
before update on public.taste_profiles
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 6. taste_events — append-only log of why the portrait moved
-- -----------------------------------------------------------------------------

create table if not exists public.taste_events (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  note_id text,
  film_title text,
  film_count integer not null default 0,
  accepted_count integer not null default 0,
  changes jsonb not null default '[]'::jsonb,
  reason text not null default '',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint taste_events_kind_values check (kind in ('accept', 'edit', 'reject', 'delete', 'correction'))
);

comment on table public.taste_events is
  'Append-only mirror of AppState.profileHistory.';

create index if not exists taste_events_user_time_idx
  on public.taste_events (user_id, occurred_at desc);

-- -----------------------------------------------------------------------------
-- 7. taste_snapshots — Taste Evolution history (append only)
-- -----------------------------------------------------------------------------

create table if not exists public.taste_snapshots (
  snapshot_id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  signature text not null,
  run_id text,
  record_count integer not null default 0,
  overall_confidence numeric(3, 2) not null default 0,
  observations jsonb not null default '[]'::jsonb,
  dimensions jsonb not null default '[]'::jsonb,
  changes jsonb not null default '[]'::jsonb,
  corrections_applied text[] not null default '{}',
  created_at timestamptz not null default now(),
  imported_at timestamptz not null default now(),
  constraint taste_snapshots_confidence_range check (overall_confidence >= 0 and overall_confidence <= 1)
);

comment on table public.taste_snapshots is
  'Append-only Taste Evolution snapshots. Old rows are never overwritten.';
comment on column public.taste_snapshots.signature is
  'Stable input fingerprint; identical input never creates a second snapshot on the same account.';

create unique index if not exists taste_snapshots_user_signature
  on public.taste_snapshots (user_id, signature);

create index if not exists taste_snapshots_user_time_idx
  on public.taste_snapshots (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 8. taste_observation_feedback — accepted / rejected readings
-- -----------------------------------------------------------------------------

create table if not exists public.taste_observation_feedback (
  feedback_id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  observation_id text not null,
  decision text not null,
  user_comment text,
  affected_snapshot_id text not null default 'unknown',
  created_at timestamptz not null default now(),
  constraint taste_observation_feedback_decision_values
    check (decision in ('accepted', 'partially_accepted', 'rejected', 'unsure'))
);

comment on table public.taste_observation_feedback is
  'User verdicts on AI observations. A rejected observation must not be reused as evidence.';

create index if not exists taste_observation_feedback_user_idx
  on public.taste_observation_feedback (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 9. agent_observations — imported DeepWorks bundles with provenance
-- -----------------------------------------------------------------------------

create table if not exists public.agent_observations (
  observation_id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  run_id text not null,
  note_id text not null references public.watch_notes (id) on delete cascade,
  film_id text not null,
  note_sha256 text not null,
  analyzed_at timestamptz not null,
  observation jsonb not null,
  evidence jsonb not null default '[]'::jsonb,
  imported_at timestamptz not null default now()
);

comment on table public.agent_observations is
  'Observations imported from a real DeepWorks run; the site never recomputes their wording.';

create index if not exists agent_observations_user_idx
  on public.agent_observations (user_id, analyzed_at desc);

-- -----------------------------------------------------------------------------
-- 10. taste_feedback — six-dimension and timeline verdicts
-- -----------------------------------------------------------------------------

create table if not exists public.taste_feedback (
  user_id uuid not null references auth.users (id) on delete cascade,
  scope text not null,
  key text not null,
  verdict text not null,
  correction text,
  updated_at timestamptz not null default now(),
  primary key (user_id, scope, key),
  constraint taste_feedback_scope_values check (scope in ('dimension', 'timeline')),
  constraint taste_feedback_verdict_values check (verdict in ('agree', 'not-quite', 'corrected'))
);

comment on table public.taste_feedback is
  'Merged storage for AppState.feedback (scope=dimension) and timelineFeedback (scope=timeline).';

-- -----------------------------------------------------------------------------
-- 11. user_corrections — free-form corrections addressed to the AI
-- -----------------------------------------------------------------------------

create table if not exists public.user_corrections (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  scope text not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint user_corrections_body_length check (char_length(body) <= 4000)
);

comment on table public.user_corrections is
  'Free-form notes the user writes when correcting the AI (AppState.corrections).';

-- -----------------------------------------------------------------------------
-- 12. yearbook_generations — one marker per generated annual review
-- -----------------------------------------------------------------------------

create table if not exists public.yearbook_generations (
  user_id uuid not null references auth.users (id) on delete cascade,
  year integer not null,
  generated_at timestamptz not null default now(),
  primary key (user_id, year),
  constraint yearbook_generations_year_range check (year between 1900 and 2100)
);

comment on table public.yearbook_generations is
  'Mirror of AppState.yearbookGenerations; keeps the "already generated" flag across devices.';

-- -----------------------------------------------------------------------------
-- 13. delete_my_data() — user-invoked deletion of all app data
--     The auth.users row is NOT deleted here (that needs service_role / an Edge
--     Function). The profile row is kept but emptied so FK integrity survives.
-- -----------------------------------------------------------------------------

create or replace function public.delete_my_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'delete_my_data requires an authenticated user';
  end if;

  delete from public.watch_notes where user_id = uid;              -- cascades analyses + observations
  delete from public.user_films where user_id = uid;
  delete from public.taste_snapshots where user_id = uid;
  delete from public.taste_events where user_id = uid;
  delete from public.taste_observation_feedback where user_id = uid;
  delete from public.taste_feedback where user_id = uid;
  delete from public.user_corrections where user_id = uid;
  delete from public.yearbook_generations where user_id = uid;
  delete from public.taste_profiles where user_id = uid;

  update public.profiles
     set display_name = '',
         avatar_url = null,
         allow_ai_notes = false,
         updated_at = now()
   where id = uid;
end;
$$;

comment on function public.delete_my_data() is
  'Deletes every app row for auth.uid(). Keeps the auth user; see AUTHENTICATION-AND-SECURITY.md.';

revoke all on function public.delete_my_data() from public;
grant execute on function public.delete_my_data() to authenticated;
