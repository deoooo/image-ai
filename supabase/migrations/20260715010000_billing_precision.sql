drop view if exists public.image_ai_operation_logs_with_team;

drop function if exists public.image_ai_create_team_with_admin(text, double precision, text, text);
drop function if exists public.image_ai_adjust_team_balance(uuid, double precision, text);
drop function if exists public.image_ai_charge_for_generation(uuid, text, text, double precision);
drop function if exists public.image_ai_refund_generation(uuid);
drop function if exists public.image_ai_adjust_user_balance(uuid, double precision, text);

alter table public.image_ai_users
  alter column balance type numeric(18, 3) using round(balance::numeric, 3),
  alter column daily_limit type numeric(18, 3) using round(daily_limit::numeric, 3),
  alter column daily_spent type numeric(18, 3) using round(daily_spent::numeric, 3);

alter table public.image_ai_teams
  alter column balance type numeric(18, 3) using round(balance::numeric, 3);

alter table public.image_ai_generations
  alter column price_charged type numeric(18, 3) using round(price_charged::numeric, 3);

alter table public.image_ai_operation_logs
  alter column amount type numeric(18, 3) using round(amount::numeric, 3),
  alter column previous_value type numeric(18, 3) using round(previous_value::numeric, 3),
  alter column new_value type numeric(18, 3) using round(new_value::numeric, 3);

create view public.image_ai_operation_logs_with_team
with (security_invoker = true)
as
select logs.*, teams.name as team_name
from public.image_ai_operation_logs as logs
left join public.image_ai_teams as teams on teams.id = logs.team_id;

create function public.image_ai_create_team_with_admin(
  p_name text,
  p_balance numeric,
  p_admin_username text,
  p_admin_password_hash text
)
returns table(
  id uuid,
  name text,
  balance numeric,
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
  if p_balance < 0 or p_balance <> round(p_balance, 3) then
    raise exception 'invalid_balance';
  end if;

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

create function public.image_ai_adjust_team_balance(
  p_team_id uuid,
  p_amount numeric,
  p_operation text
)
returns table(id uuid, name text, balance numeric, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount <= 0 or p_amount <> round(p_amount, 3) then
    raise exception 'invalid_amount';
  end if;

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

create function public.image_ai_charge_for_generation(
  p_user_id uuid,
  p_prompt text,
  p_model text,
  p_price numeric
)
returns table(
  generation_id uuid,
  price_charged numeric,
  balance numeric,
  daily_spent numeric,
  daily_limit numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.image_ai_users%rowtype;
  v_balance numeric;
  v_generation_id uuid;
  v_today date := (now() at time zone 'Asia/Shanghai')::date;
begin
  if p_price < 0 or p_price <> round(p_price, 3) then
    raise exception 'invalid_price';
  end if;

  select * into v_user from public.image_ai_users
    where image_ai_users.id = p_user_id for update;
  if v_user.id is null or v_user.role <> 'user' then
    raise exception 'user_not_found';
  end if;

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
    if v_balance is null then
      raise exception 'insufficient_balance';
    end if;

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
    if v_balance is null then
      raise exception 'insufficient_balance';
    end if;
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

create function public.image_ai_refund_generation(p_generation_id uuid)
returns table(refunded boolean, balance numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_team_id uuid;
  v_price numeric;
  v_balance numeric;
  v_today date := (now() at time zone 'Asia/Shanghai')::date;
begin
  update public.image_ai_generations as generations
    set charge_status = 'refunded', status = 'failed'
    where generations.id = p_generation_id and generations.charge_status = 'charged'
    returning generations.user_id, generations.billed_team_id, generations.price_charged
    into v_user_id, v_team_id, v_price;

  if v_user_id is null then
    refunded := false;
    balance := null;
    return next;
    return;
  end if;

  if v_team_id is not null then
    update public.image_ai_teams as teams
      set balance = teams.balance + v_price
      where teams.id = v_team_id
      returning teams.balance into v_balance;
    update public.image_ai_users as users
      set daily_spent = greatest(0, users.daily_spent - v_price)
      where users.id = v_user_id and users.daily_spent_date = v_today;
  else
    update public.image_ai_users as users
      set balance = users.balance + v_price
      where users.id = v_user_id
      returning users.balance into v_balance;
  end if;

  refunded := true;
  balance := v_balance;
  return next;
end;
$$;

create function public.image_ai_adjust_user_balance(
  p_user_id uuid,
  p_amount numeric,
  p_operation text
)
returns table(
  id uuid,
  username text,
  balance numeric,
  created_at timestamptz,
  role text,
  team_id uuid,
  daily_limit numeric,
  daily_spent numeric,
  daily_spent_date date
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount <= 0 or p_amount <> round(p_amount, 3) then
    raise exception 'invalid_amount';
  end if;

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
  else
    raise exception 'invalid_operation';
  end if;

  if not found then
    if exists (select 1 from public.image_ai_users where image_ai_users.id = p_user_id) then
      raise exception 'insufficient_balance';
    end if;
    raise exception 'user_not_found';
  end if;
end;
$$;
