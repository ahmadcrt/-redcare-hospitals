-- REDCARE HOSPITALS (fictional portfolio demo) - Designed & Developed by Ahmad
-- Run order: 1) schema.sql  2) security.sql  3) seed.sql
-- Timezone used for all booking rules: Africa/Lagos

create type public.user_role as enum ('patient', 'admin');
create type public.appointment_status as enum ('pending', 'confirmed', 'completed', 'cancelled');

-- ---------- helpers ----------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- ---------- tables ----------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null check (char_length(trim(full_name)) between 2 and 100),
  email       text not null,
  phone       text check (phone is null or phone ~ '^[0-9+()\-\s]{7,20}$'),
  role        public.user_role not null default 'patient',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index profiles_role_idx on public.profiles(role);

create table public.departments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (char_length(trim(name)) between 2 and 80),
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  description text not null,
  services    text[] not null default '{}',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.doctors (
  id             uuid primary key default gen_random_uuid(),
  department_id  uuid not null references public.departments(id) on delete restrict,
  full_name      text not null check (char_length(trim(full_name)) between 2 and 100),
  specialty      text not null check (char_length(trim(specialty)) between 2 and 100),
  bio            text not null default '',
  years_experience smallint check (years_experience between 0 and 60),
  available_days smallint[] not null default '{1,2,3,4,5}'
                 check (available_days <@ array[0,1,2,3,4,5,6]::smallint[] and cardinality(available_days) > 0), -- 0=Sun
  slot_start     time not null default '09:00',
  slot_end       time not null default '16:00',
  slot_minutes   smallint not null default 30 check (slot_minutes between 10 and 120),
  is_active      boolean not null default true,
  is_demo        boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (slot_end > slot_start)
);
create index doctors_department_idx on public.doctors(department_id);
create index doctors_active_idx on public.doctors(is_active);

create table public.appointments (
  id               uuid primary key default gen_random_uuid(),
  reference_number text not null unique,
  patient_id       uuid not null references public.profiles(id) on delete restrict,
  doctor_id        uuid not null references public.doctors(id) on delete restrict,
  department_id    uuid not null references public.departments(id) on delete restrict,
  appointment_date date not null,
  appointment_time time not null,
  patient_name     text not null check (char_length(trim(patient_name)) between 2 and 100),
  patient_phone    text not null check (patient_phone ~ '^[0-9+()\-\s]{7,20}$'),
  patient_email    text not null check (patient_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  reason           text check (reason is null or char_length(reason) <= 300),
  status           public.appointment_status not null default 'pending',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
-- one active booking per doctor slot, and one per patient slot
create unique index appointments_doctor_slot_uq on public.appointments(doctor_id, appointment_date, appointment_time)
  where status in ('pending', 'confirmed');
create unique index appointments_patient_slot_uq on public.appointments(patient_id, appointment_date, appointment_time)
  where status in ('pending', 'confirmed');
create index appointments_patient_idx on public.appointments(patient_id, appointment_date);
create index appointments_date_status_idx on public.appointments(appointment_date, status);
create index appointments_doctor_idx on public.appointments(doctor_id);

create table public.appointment_status_history (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  old_status     public.appointment_status,
  new_status     public.appointment_status not null,
  changed_by     uuid references public.profiles(id) on delete set null,
  changed_at     timestamptz not null default now()
);
create index status_history_appt_idx on public.appointment_status_history(appointment_id);

create table public.notifications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  title          text not null,
  message        text not null,
  is_read        boolean not null default false,
  created_at     timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, created_at desc);

create table public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(trim(name)) between 2 and 100),
  email      text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  subject    text not null check (char_length(trim(subject)) between 2 and 150),
  message    text not null check (char_length(trim(message)) between 10 and 2000),
  is_handled boolean not null default false,
  created_at timestamptz not null default now()
);

-- updated_at triggers
create trigger profiles_updated    before update on public.profiles    for each row execute function public.set_updated_at();
create trigger departments_updated before update on public.departments for each row execute function public.set_updated_at();
create trigger doctors_updated     before update on public.doctors     for each row execute function public.set_updated_at();

-- ---------- authorization helper ----------
-- Admin status is read from the database, never from client-supplied data.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and is_active);
$$;

-- ---------- profile creation after registration ----------
-- Role is ALWAYS 'patient' here; metadata can never set a role.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)),
    new.email,
    nullif(trim(new.raw_user_meta_data->>'phone'), '')
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- profile protection ----------
-- Non-admin signed-in users may not change role, email, is_active or id.
-- auth.uid() is null in the SQL editor / service role, which is how the first admin is promoted.
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.id <> old.id then raise exception 'Profile id cannot be changed'; end if;
  if not public.is_admin() then
    if new.role <> old.role or new.is_active <> old.is_active or new.email <> old.email then
      raise exception 'You are not allowed to change role, status or email';
    end if;
  elsif new.id = auth.uid() and (new.role <> old.role or new.is_active <> old.is_active) then
    raise exception 'Administrators cannot change their own role or status';
  end if;
  return new;
end $$;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile();

-- ---------- appointment integrity ----------
create or replace function public.appointments_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  d public.doctors%rowtype;
  now_local timestamp := (now() at time zone 'Africa/Lagos');
begin
  select * into d from public.doctors where id = new.doctor_id;
  if not found or not d.is_active then raise exception 'The selected doctor is not available'; end if;
  if not exists (select 1 from public.departments where id = d.department_id and is_active) then
    raise exception 'The selected department is not available';
  end if;
  if auth.uid() is not null and not public.is_admin() then
    if not exists (select 1 from public.profiles where id = auth.uid() and is_active) then
      raise exception 'Your account is disabled';
    end if;
    new.patient_id := auth.uid();
    new.status := 'pending';           -- patients can never self-confirm
  end if;
  new.department_id := d.department_id; -- derived from doctor, never trusted from client
  if (new.appointment_date + new.appointment_time) <= now_local then
    raise exception 'Appointments cannot be booked in the past';
  end if;
  if not (extract(dow from new.appointment_date)::smallint = any (d.available_days)) then
    raise exception 'The doctor is not available on that day';
  end if;
  if new.appointment_time < d.slot_start
     or new.appointment_time + make_interval(mins => d.slot_minutes) > d.slot_end
     or mod(extract(epoch from (new.appointment_time - d.slot_start))::int, d.slot_minutes * 60) <> 0 then
    raise exception 'That time is not a valid slot for this doctor';
  end if;
  new.reference_number := 'RC-' || to_char(new.appointment_date, 'YYMMDD') || '-'
    || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  return new;
end $$;
create trigger appointments_bi before insert on public.appointments
  for each row execute function public.appointments_before_insert();

create or replace function public.appointments_before_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  now_local timestamp := (now() at time zone 'Africa/Lagos');
  appt_ts timestamp := (old.appointment_date + old.appointment_time);
  admin boolean := public.is_admin();
begin
  if auth.uid() is null then new.updated_at := now(); return new; end if;
  -- only status may change
  if new.reference_number <> old.reference_number or new.patient_id <> old.patient_id
     or new.doctor_id <> old.doctor_id or new.department_id <> old.department_id
     or new.appointment_date <> old.appointment_date or new.appointment_time <> old.appointment_time
     or new.patient_name <> old.patient_name or new.patient_phone <> old.patient_phone
     or new.patient_email <> old.patient_email or new.reason is distinct from old.reason then
    raise exception 'Only the appointment status can be changed';
  end if;
  if new.status <> old.status then
    if not ((old.status = 'pending'   and new.status in ('confirmed', 'cancelled'))
         or (old.status = 'confirmed' and new.status in ('completed', 'cancelled'))) then
      raise exception 'Invalid status change: % to %', old.status, new.status;
    end if;
    if not admin then
      if new.status <> 'cancelled' then raise exception 'Patients may only cancel appointments'; end if;
      if appt_ts <= now_local then raise exception 'Past appointments cannot be cancelled'; end if;
    end if;
    if new.status = 'completed' and appt_ts > now_local then
      raise exception 'An appointment cannot be completed before it takes place';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger appointments_bu before update on public.appointments
  for each row execute function public.appointments_before_update();

-- status history + system notifications
create or replace function public.appointments_after_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.appointment_status_history(appointment_id, old_status, new_status, changed_by)
    values (new.id, null, new.status, auth.uid());
  elsif new.status <> old.status then
    insert into public.appointment_status_history(appointment_id, old_status, new_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
    insert into public.notifications(user_id, appointment_id, title, message)
    values (new.patient_id, new.id, 'Appointment ' || new.status,
            'Your demo appointment ' || new.reference_number || ' is now ' || new.status || '.');
  end if;
  return null;
end $$;
create trigger appointments_ai after insert or update on public.appointments
  for each row execute function public.appointments_after_change();

-- ---------- RPCs ----------
-- Returns only booked times (no personal data) so anyone can see availability.
create or replace function public.get_booked_slots(p_doctor uuid, p_date date)
returns table(slot time) language sql stable security definer set search_path = public as $$
  select appointment_time from public.appointments
  where doctor_id = p_doctor and appointment_date = p_date and status in ('pending', 'confirmed');
$$;

create or replace function public.admin_stats() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  return json_build_object(
    'patients',    (select count(*) from public.profiles where role = 'patient'),
    'doctors',     (select count(*) from public.doctors),
    'departments', (select count(*) from public.departments),
    'appointments',(select count(*) from public.appointments),
    'pending',     (select count(*) from public.appointments where status = 'pending'),
    'confirmed',   (select count(*) from public.appointments where status = 'confirmed'),
    'completed',   (select count(*) from public.appointments where status = 'completed'),
    'cancelled',   (select count(*) from public.appointments where status = 'cancelled'));
end $$;

revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;
grant execute on function public.get_booked_slots(uuid, date) to anon, authenticated;
