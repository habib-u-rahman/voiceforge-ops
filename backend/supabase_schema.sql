-- Run this once in your Supabase project's SQL Editor
-- (Project -> SQL Editor -> New query -> paste -> Run).
--
-- Matches the row shape inserted by dispatch_actions_service()
-- in backend/app/services.py.

create table if not exists action_logs (
  id bigint generated always as identity primary key,
  summary text,
  raw_transcript text,
  actions_count int,
  payload jsonb,
  status text,
  created_at timestamptz default now()
);

-- Use the "service_role" key (Project Settings -> API -> service_role,
-- NOT the anon/public key) as SUPABASE_KEY in the backend's env. The
-- service_role key runs server-side only and bypasses Row Level Security
-- entirely, so no RLS policy is required for the backend to read/write.
-- RLS stays enabled here only so nothing can query this table with the
-- public anon key if it's ever used elsewhere in this project.
alter table action_logs enable row level security;
