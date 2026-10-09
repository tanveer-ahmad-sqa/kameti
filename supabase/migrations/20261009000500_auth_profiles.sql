-- Create a profile once a phone number is verified, and link any committee memberships
-- that an organizer created for that phone before the person installed the app.
--
-- GoTrue creates the auth.users row when the OTP is *sent*, and sets phone_confirmed_at when it
-- is verified. We only act on verified numbers, so nobody can claim memberships for a phone they
-- don't own.

create function private.handle_verified_phone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text;
begin
  if new.phone is null or new.phone = '' or new.phone_confirmed_at is null then
    return new;
  end if;

  -- GoTrue stores phones without the leading '+'.
  v_phone := case when left(new.phone, 1) = '+' then new.phone else '+' || new.phone end;

  insert into public.profiles (id, phone)
  values (new.id, v_phone)
  on conflict (id) do update set phone = excluded.phone;

  update public.committee_members m
  set user_id = new.id
  where m.phone = v_phone
    and m.user_id is null
    and not m.is_former_user;

  return new;
end;
$$;

create trigger on_auth_user_phone_verified
after insert or update of phone, phone_confirmed_at on auth.users
for each row execute function private.handle_verified_phone();
