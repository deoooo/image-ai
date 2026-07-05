create table if not exists public.image_ai_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  balance double precision not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.image_ai_generations (
  id uuid primary key default gen_random_uuid(),
  task_id text unique,
  prompt text not null,
  model text not null,
  image_url text,
  status text not null default 'pending',
  user_id uuid not null references public.image_ai_users(id) on delete cascade,
  price_charged double precision not null default 0 check (price_charged >= 0),
  charge_status text not null default 'not_charged',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint image_ai_generations_charge_status_check
    check (charge_status in ('not_charged', 'charged', 'refunded')),
  constraint image_ai_generations_status_check
    check (status in ('pending', 'succeeded', 'failed'))
);

create index if not exists image_ai_users_created_at_idx
  on public.image_ai_users(created_at desc);

create index if not exists image_ai_generations_created_at_idx
  on public.image_ai_generations(created_at desc);

create index if not exists image_ai_generations_user_created_at_idx
  on public.image_ai_generations(user_id, created_at desc);

create index if not exists image_ai_generations_task_id_idx
  on public.image_ai_generations(task_id);

create or replace function public.image_ai_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists image_ai_users_set_updated_at on public.image_ai_users;
create trigger image_ai_users_set_updated_at
before update on public.image_ai_users
for each row
execute function public.image_ai_set_updated_at();

drop trigger if exists image_ai_generations_set_updated_at on public.image_ai_generations;
create trigger image_ai_generations_set_updated_at
before update on public.image_ai_generations
for each row
execute function public.image_ai_set_updated_at();

create or replace function public.image_ai_charge_for_generation(
  p_user_id uuid,
  p_prompt text,
  p_model text,
  p_price double precision
)
returns table(generation_id uuid, price_charged double precision, balance double precision)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance double precision;
  v_generation_id uuid;
begin
  if p_price < 0 then
    raise exception 'invalid_price';
  end if;

  update public.image_ai_users
  set balance = image_ai_users.balance - p_price
  where id = p_user_id and image_ai_users.balance >= p_price
  returning image_ai_users.balance into v_balance;

  if v_balance is null then
    raise exception 'insufficient_balance';
  end if;

  insert into public.image_ai_generations (
    user_id,
    prompt,
    model,
    status,
    price_charged,
    charge_status
  )
  values (
    p_user_id,
    p_prompt,
    p_model,
    'pending',
    p_price,
    'charged'
  )
  returning id into v_generation_id;

  generation_id := v_generation_id;
  price_charged := p_price;
  balance := v_balance;
  return next;
end;
$$;

create or replace function public.image_ai_refund_generation(
  p_generation_id uuid
)
returns table(refunded boolean, balance double precision)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_price double precision;
  v_balance double precision;
begin
  update public.image_ai_generations
  set charge_status = 'refunded',
      status = 'failed'
  where id = p_generation_id and charge_status = 'charged'
  returning user_id, price_charged into v_user_id, v_price;

  if v_user_id is null then
    refunded := false;
    balance := null;
    return next;
    return;
  end if;

  update public.image_ai_users
  set balance = image_ai_users.balance + v_price
  where id = v_user_id
  returning image_ai_users.balance into v_balance;

  refunded := true;
  balance := v_balance;
  return next;
end;
$$;
