create or replace function public.image_ai_adjust_user_balance(
  p_user_id uuid,
  p_amount double precision,
  p_operation text
)
returns table(id uuid, username text, balance double precision, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  if p_operation = 'credit' then
    return query
    update public.image_ai_users as users
    set balance = users.balance + p_amount
    where users.id = p_user_id
    returning users.id, users.username, users.balance, users.created_at;
  elsif p_operation = 'debit' then
    return query
    update public.image_ai_users as users
    set balance = users.balance - p_amount
    where users.id = p_user_id and users.balance >= p_amount
    returning users.id, users.username, users.balance, users.created_at;
  else
    raise exception 'invalid_operation';
  end if;

  if not found then
    if exists (select 1 from public.image_ai_users as users where users.id = p_user_id) then
      raise exception 'insufficient_balance';
    end if;

    raise exception 'user_not_found';
  end if;
end;
$$;
