create table if not exists public.image_ai_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  balance double precision not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.image_ai_users
  add column if not exists role text not null default 'user',
  add column if not exists team_id uuid references public.image_ai_teams(id) on delete set null,
  add column if not exists daily_limit double precision,
  add column if not exists daily_spent double precision not null default 0,
  add column if not exists daily_spent_date date;

alter table public.image_ai_generations
  add column if not exists billed_team_id uuid references public.image_ai_teams(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'image_ai_users_role_check'
  ) then
    alter table public.image_ai_users add constraint image_ai_users_role_check
      check (role in ('user', 'team_admin'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'image_ai_users_daily_limit_check'
  ) then
    alter table public.image_ai_users add constraint image_ai_users_daily_limit_check
      check (daily_limit is null or daily_limit >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'image_ai_users_daily_spent_check'
  ) then
    alter table public.image_ai_users add constraint image_ai_users_daily_spent_check
      check (daily_spent >= 0);
  end if;
end $$;

create index if not exists image_ai_users_team_created_at_idx
  on public.image_ai_users(team_id, created_at desc);

drop trigger if exists image_ai_teams_set_updated_at on public.image_ai_teams;
create trigger image_ai_teams_set_updated_at
before update on public.image_ai_teams
for each row execute function public.image_ai_set_updated_at();

create or replace function public.image_ai_create_team_with_admin(
  p_name text,
  p_balance double precision,
  p_admin_username text,
  p_admin_password_hash text
)
returns table(
  id uuid,
  name text,
  balance double precision,
  created_at timestamptz,
  admin_id uuid,
  admin_username text,
  admin_created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team public.image_ai_teams%rowtype;
  v_admin public.image_ai_users%rowtype;
begin
  if p_balance < 0 then raise exception 'invalid_balance'; end if;

  insert into public.image_ai_teams(name, balance)
  values (p_name, p_balance)
  returning * into v_team;

  insert into public.image_ai_users(
    username, password_hash, balance, role, team_id, daily_limit
  ) values (
    p_admin_username, p_admin_password_hash, 0, 'team_admin', v_team.id, null
  ) returning * into v_admin;

  id := v_team.id;
  name := v_team.name;
  balance := v_team.balance;
  created_at := v_team.created_at;
  admin_id := v_admin.id;
  admin_username := v_admin.username;
  admin_created_at := v_admin.created_at;
  return next;
end;
$$;

create or replace function public.image_ai_adjust_team_balance(
  p_team_id uuid,
  p_amount double precision,
  p_operation text
)
returns table(id uuid, name text, balance double precision, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount <= 0 then raise exception 'invalid_amount'; end if;

  if p_operation = 'credit' then
    return query update public.image_ai_teams as teams
      set balance = teams.balance + p_amount
      where teams.id = p_team_id
      returning teams.id, teams.name, teams.balance, teams.created_at;
  elsif p_operation = 'debit' then
    return query update public.image_ai_teams as teams
      set balance = teams.balance - p_amount
      where teams.id = p_team_id and teams.balance >= p_amount
      returning teams.id, teams.name, teams.balance, teams.created_at;
  else
    raise exception 'invalid_operation';
  end if;

  if not found then
    if exists (select 1 from public.image_ai_teams where image_ai_teams.id = p_team_id) then
      raise exception 'insufficient_balance';
    end if;
    raise exception 'team_not_found';
  end if;
end;
$$;

drop function if exists public.image_ai_charge_for_generation(uuid, text, text, double precision);
create function public.image_ai_charge_for_generation(
  p_user_id uuid,
  p_prompt text,
  p_model text,
  p_price double precision
)
returns table(
  generation_id uuid,
  price_charged double precision,
  balance double precision,
  daily_spent double precision,
  daily_limit double precision
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.image_ai_users%rowtype;
  v_balance double precision;
  v_generation_id uuid;
  v_today date := (now() at time zone 'Asia/Shanghai')::date;
begin
  if p_price < 0 then raise exception 'invalid_price'; end if;

  select * into v_user from public.image_ai_users
    where image_ai_users.id = p_user_id for update;
  if v_user.id is null or v_user.role <> 'user' then raise exception 'user_not_found'; end if;

  if v_user.team_id is not null then
    if v_user.daily_spent_date is distinct from v_today then
      v_user.daily_spent := 0;
    end if;
    if v_user.daily_limit is null or v_user.daily_spent + p_price > v_user.daily_limit then
      raise exception 'daily_limit_exceeded';
    end if;

    update public.image_ai_teams as teams
      set balance = teams.balance - p_price
      where teams.id = v_user.team_id and teams.balance >= p_price
      returning teams.balance into v_balance;
    if v_balance is null then raise exception 'insufficient_balance'; end if;

    update public.image_ai_users as users
      set daily_spent = v_user.daily_spent + p_price,
          daily_spent_date = v_today
      where users.id = p_user_id
      returning users.daily_spent into v_user.daily_spent;
  else
    update public.image_ai_users as users
      set balance = users.balance - p_price
      where users.id = p_user_id and users.balance >= p_price
      returning users.balance into v_balance;
    if v_balance is null then raise exception 'insufficient_balance'; end if;
  end if;

  insert into public.image_ai_generations(
    user_id, prompt, model, status, price_charged, charge_status, billed_team_id
  ) values (
    p_user_id, p_prompt, p_model, 'pending', p_price, 'charged', v_user.team_id
  ) returning image_ai_generations.id into v_generation_id;

  generation_id := v_generation_id;
  price_charged := p_price;
  balance := v_balance;
  daily_spent := case when v_user.team_id is null then null else v_user.daily_spent end;
  daily_limit := case when v_user.team_id is null then null else v_user.daily_limit end;
  return next;
end;
$$;

create or replace function public.image_ai_refund_generation(p_generation_id uuid)
returns table(refunded boolean, balance double precision)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_team_id uuid;
  v_price double precision;
  v_balance double precision;
  v_today date := (now() at time zone 'Asia/Shanghai')::date;
begin
  update public.image_ai_generations as generations
    set charge_status = 'refunded', status = 'failed'
    where generations.id = p_generation_id and generations.charge_status = 'charged'
    returning generations.user_id, generations.billed_team_id, generations.price_charged
    into v_user_id, v_team_id, v_price;

  if v_user_id is null then
    refunded := false; balance := null; return next; return;
  end if;

  if v_team_id is not null then
    update public.image_ai_teams as teams set balance = teams.balance + v_price
      where teams.id = v_team_id returning teams.balance into v_balance;
    update public.image_ai_users as users
      set daily_spent = greatest(0, users.daily_spent - v_price)
      where users.id = v_user_id and users.daily_spent_date = v_today;
  else
    update public.image_ai_users as users set balance = users.balance + v_price
      where users.id = v_user_id returning users.balance into v_balance;
  end if;

  refunded := true; balance := v_balance; return next;
end;
$$;

drop function if exists public.image_ai_adjust_user_balance(uuid, double precision, text);
create function public.image_ai_adjust_user_balance(
  p_user_id uuid,
  p_amount double precision,
  p_operation text
)
returns table(
  id uuid, username text, balance double precision, created_at timestamptz,
  role text, team_id uuid, daily_limit double precision,
  daily_spent double precision, daily_spent_date date
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount <= 0 then raise exception 'invalid_amount'; end if;
  if p_operation = 'credit' then
    return query update public.image_ai_users as users
      set balance = users.balance + p_amount
      where users.id = p_user_id and users.team_id is null and users.role = 'user'
      returning users.id, users.username, users.balance, users.created_at, users.role,
        users.team_id, users.daily_limit, users.daily_spent, users.daily_spent_date;
  elsif p_operation = 'debit' then
    return query update public.image_ai_users as users
      set balance = users.balance - p_amount
      where users.id = p_user_id and users.team_id is null and users.role = 'user'
        and users.balance >= p_amount
      returning users.id, users.username, users.balance, users.created_at, users.role,
        users.team_id, users.daily_limit, users.daily_spent, users.daily_spent_date;
  else raise exception 'invalid_operation';
  end if;
  if not found then
    if exists (select 1 from public.image_ai_users where image_ai_users.id = p_user_id) then
      raise exception 'insufficient_balance';
    end if;
    raise exception 'user_not_found';
  end if;
end;
$$;
