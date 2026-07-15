create table if not exists public.image_ai_operation_logs (
  id uuid primary key default gen_random_uuid(),
  actor_role text not null check (actor_role in ('admin', 'team_admin')),
  actor_username text not null,
  actor_user_id uuid references public.image_ai_users(id) on delete set null,
  team_id uuid references public.image_ai_teams(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  target_name text not null,
  amount double precision,
  previous_value double precision,
  new_value double precision,
  created_at timestamptz not null default now()
);

create index if not exists image_ai_operation_logs_created_at_idx
  on public.image_ai_operation_logs(created_at desc);

create index if not exists image_ai_operation_logs_team_created_at_idx
  on public.image_ai_operation_logs(team_id, created_at desc);

alter table public.image_ai_operation_logs enable row level security;

create or replace view public.image_ai_operation_logs_with_team
with (security_invoker = true)
as
select logs.*, teams.name as team_name
from public.image_ai_operation_logs as logs
left join public.image_ai_teams as teams on teams.id = logs.team_id;
