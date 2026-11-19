-- =============================================================================
-- Frame by Frame — Row Level Security
-- File: supabase/migrations/0002_rls.sql
-- Date: 2026-11-19
--
-- Rule for every table: a row belongs to exactly one auth user, and
-- auth.uid() = the owner column. There is no shared/global row and no
-- "select true" policy. Front-end filtering is never used as a substitute.
--
-- Run AFTER 0001_schema.sql, in the Supabase SQL editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Lock the anon role out of every table.
--    Supabase grants public-schema access to anon/authenticated by default;
--    these revokes make the intent explicit and survive future table grants
--    only for this list of tables.
-- -----------------------------------------------------------------------------

revoke all on table public.profiles from anon;
revoke all on table public.user_films from anon;
revoke all on table public.watch_notes from anon;
revoke all on table public.note_analyses from anon;
revoke all on table public.taste_profiles from anon;
revoke all on table public.taste_events from anon;
revoke all on table public.taste_snapshots from anon;
revoke all on table public.taste_observation_feedback from anon;
revoke all on table public.agent_observations from anon;
revoke all on table public.taste_feedback from anon;
revoke all on table public.user_corrections from anon;
revoke all on table public.yearbook_generations from anon;

grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.user_films to authenticated;
grant select, insert, update, delete on table public.watch_notes to authenticated;
grant select, insert, update, delete on table public.note_analyses to authenticated;
grant select, insert, update, delete on table public.taste_profiles to authenticated;
grant select, insert, update, delete on table public.taste_events to authenticated;
grant select, insert, update, delete on table public.taste_snapshots to authenticated;
grant select, insert, update, delete on table public.taste_observation_feedback to authenticated;
grant select, insert, update, delete on table public.agent_observations to authenticated;
grant select, insert, update, delete on table public.taste_feedback to authenticated;
grant select, insert, update, delete on table public.user_corrections to authenticated;
grant select, insert, update, delete on table public.yearbook_generations to authenticated;

-- profiles.email is a read-only mirror of auth.users.email. Table-level UPDATE
-- is replaced by a column list that excludes email (and created_at/updated_at,
-- which triggers maintain).
revoke update on table public.profiles from authenticated;
grant update (display_name, avatar_url, allow_ai_notes, ai_policy_version, locale)
  on table public.profiles to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Enable RLS everywhere.
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.user_films enable row level security;
alter table public.watch_notes enable row level security;
alter table public.note_analyses enable row level security;
alter table public.taste_profiles enable row level security;
alter table public.taste_events enable row level security;
alter table public.taste_snapshots enable row level security;
alter table public.taste_observation_feedback enable row level security;
alter table public.agent_observations enable row level security;
alter table public.taste_feedback enable row level security;
alter table public.user_corrections enable row level security;
alter table public.yearbook_generations enable row level security;

-- -----------------------------------------------------------------------------
-- 3. profiles — owner column is id, not user_id.
-- -----------------------------------------------------------------------------

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own on public.profiles
  for delete to authenticated
  using (auth.uid() = id);

-- -----------------------------------------------------------------------------
-- 4. user_films
-- -----------------------------------------------------------------------------

drop policy if exists user_films_select_own on public.user_films;
create policy user_films_select_own on public.user_films
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists user_films_insert_own on public.user_films;
create policy user_films_insert_own on public.user_films
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists user_films_update_own on public.user_films;
create policy user_films_update_own on public.user_films
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists user_films_delete_own on public.user_films;
create policy user_films_delete_own on public.user_films
  for delete to authenticated
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 5. watch_notes
-- -----------------------------------------------------------------------------

drop policy if exists watch_notes_select_own on public.watch_notes;
create policy watch_notes_select_own on public.watch_notes
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists watch_notes_insert_own on public.watch_notes;
create policy watch_notes_insert_own on public.watch_notes
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists watch_notes_update_own on public.watch_notes;
create policy watch_notes_update_own on public.watch_notes
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists watch_notes_delete_own on public.watch_notes;
create policy watch_notes_delete_own on public.watch_notes
  for delete to authenticated
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 6. note_analyses
-- -----------------------------------------------------------------------------

drop policy if exists note_analyses_select_own on public.note_analyses;
create policy note_analyses_select_own on public.note_analyses
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists note_analyses_insert_own on public.note_analyses;
create policy note_analyses_insert_own on public.note_analyses
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists note_analyses_update_own on public.note_analyses;
create policy note_analyses_update_own on public.note_analyses
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists note_analyses_delete_own on public.note_analyses;
create policy note_analyses_delete_own on public.note_analyses
  for delete to authenticated
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 7. taste_profiles
-- -----------------------------------------------------------------------------

drop policy if exists taste_profiles_select_own on public.taste_profiles;
create policy taste_profiles_select_own on public.taste_profiles
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists taste_profiles_insert_own on public.taste_profiles;
create policy taste_profiles_insert_own on public.taste_profiles
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists taste_profiles_update_own on public.taste_profiles;
create policy taste_profiles_update_own on public.taste_profiles
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists taste_profiles_delete_own on public.taste_profiles;
create policy taste_profiles_delete_own on public.taste_profiles
  for delete to authenticated
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 8. taste_events
-- -----------------------------------------------------------------------------

drop policy if exists taste_events_select_own on public.taste_events;
create policy taste_events_select_own on public.taste_events
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists taste_events_insert_own on public.taste_events;
create policy taste_events_insert_own on public.taste_events
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists taste_events_update_own on public.taste_events;
create policy taste_events_update_own on public.taste_events
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists taste_events_delete_own on public.taste_events;
create policy taste_events_delete_own on public.taste_events
  for delete to authenticated
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 9. taste_snapshots
-- -----------------------------------------------------------------------------

drop policy if exists taste_snapshots_select_own on public.taste_snapshots;
create policy taste_snapshots_select_own on public.taste_snapshots
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists taste_snapshots_insert_own on public.taste_snapshots;
create policy taste_snapshots_insert_own on public.taste_snapshots
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists taste_snapshots_update_own on public.taste_snapshots;
create policy taste_snapshots_update_own on public.taste_snapshots
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists taste_snapshots_delete_own on public.taste_snapshots;
create policy taste_snapshots_delete_own on public.taste_snapshots
  for delete to authenticated
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 10. taste_observation_feedback
-- -----------------------------------------------------------------------------

drop policy if exists observation_feedback_select_own on public.taste_observation_feedback;
create policy observation_feedback_select_own on public.taste_observation_feedback
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists observation_feedback_insert_own on public.taste_observation_feedback;
create policy observation_feedback_insert_own on public.taste_observation_feedback
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists observation_feedback_update_own on public.taste_observation_feedback;
create policy observation_feedback_update_own on public.taste_observation_feedback
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists observation_feedback_delete_own on public.taste_observation_feedback;
create policy observation_feedback_delete_own on public.taste_observation_feedback
  for delete to authenticated
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 11. agent_observations
-- -----------------------------------------------------------------------------

drop policy if exists agent_observations_select_own on public.agent_observations;
create policy agent_observations_select_own on public.agent_observations
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists agent_observations_insert_own on public.agent_observations;
create policy agent_observations_insert_own on public.agent_observations
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists agent_observations_update_own on public.agent_observations;
create policy agent_observations_update_own on public.agent_observations
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists agent_observations_delete_own on public.agent_observations;
create policy agent_observations_delete_own on public.agent_observations
  for delete to authenticated
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 12. taste_feedback
-- -----------------------------------------------------------------------------

drop policy if exists taste_feedback_select_own on public.taste_feedback;
create policy taste_feedback_select_own on public.taste_feedback
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists taste_feedback_insert_own on public.taste_feedback;
create policy taste_feedback_insert_own on public.taste_feedback
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists taste_feedback_update_own on public.taste_feedback;
create policy taste_feedback_update_own on public.taste_feedback
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists taste_feedback_delete_own on public.taste_feedback;
create policy taste_feedback_delete_own on public.taste_feedback
  for delete to authenticated
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 13. user_corrections
-- -----------------------------------------------------------------------------

drop policy if exists corrections_select_own on public.user_corrections;
create policy corrections_select_own on public.user_corrections
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists corrections_insert_own on public.user_corrections;
create policy corrections_insert_own on public.user_corrections
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists corrections_update_own on public.user_corrections;
create policy corrections_update_own on public.user_corrections
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists corrections_delete_own on public.user_corrections;
create policy corrections_delete_own on public.user_corrections
  for delete to authenticated
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 14. yearbook_generations
-- -----------------------------------------------------------------------------

drop policy if exists yearbook_select_own on public.yearbook_generations;
create policy yearbook_select_own on public.yearbook_generations
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists yearbook_insert_own on public.yearbook_generations;
create policy yearbook_insert_own on public.yearbook_generations
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists yearbook_update_own on public.yearbook_generations;
create policy yearbook_update_own on public.yearbook_generations
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists yearbook_delete_own on public.yearbook_generations;
create policy yearbook_delete_own on public.yearbook_generations
  for delete to authenticated
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 15. Avatars bucket (optional, only if profile pictures are enabled)
--     Path convention: avatars/<user-id>/<file>. A user may only write inside
--     their own folder; reads are public because avatars are non-sensitive.
--     If this block errors on your project, create the bucket in the dashboard
--     and add the same four policies under Storage → Policies.
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects
  for select
  using (bucket_id = 'avatars');

drop policy if exists avatars_insert_own_folder on storage.objects;
create policy avatars_insert_own_folder on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_update_own_folder on storage.objects;
create policy avatars_update_own_folder on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_delete_own_folder on storage.objects;
create policy avatars_delete_own_folder on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- -----------------------------------------------------------------------------
-- 16. Manual verification queries (run after the migration)
-- -----------------------------------------------------------------------------
-- a) Every table above must be listed with rowsecurity = true:
--    select tablename, rowsecurity from pg_tables
--     where schemaname = 'public' order by tablename;
--
-- b) Every table must have exactly four policies (one per command):
--    select tablename, cmd, policyname from pg_policies
--     where schemaname = 'public' order by tablename, cmd;
--
-- c) Isolation check as user A (in the SQL editor, set the JWT claim):
--    select set_config('request.jwt.claim.sub', '<user-a-uuid>', true);
--    select count(*) from public.watch_notes where user_id <> auth.uid();
--    -- expected: 0 (RLS hides every row that is not A's)
-- =============================================================================
