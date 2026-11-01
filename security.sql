-- REDCARE HOSPITALS - Row Level Security (run AFTER schema.sql)
-- Designed & Developed by Ahmad

alter table public.profiles                  enable row level security;
alter table public.departments               enable row level security;
alter table public.doctors                   enable row level security;
alter table public.appointments              enable row level security;
alter table public.appointment_status_history enable row level security;
alter table public.notifications             enable row level security;
alter table public.contact_messages          enable row level security;

-- Start from least privilege, then grant only what the app needs. RLS still applies on top.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.departments, public.doctors to anon, authenticated;
grant insert on public.contact_messages to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant insert, update on public.departments, public.doctors to authenticated;
grant select, insert, update on public.appointments to authenticated;
grant select on public.appointment_status_history to authenticated;
grant select on public.notifications to authenticated;
grant update (is_read) on public.notifications to authenticated;
grant select, update on public.contact_messages to authenticated;
-- No DELETE is granted anywhere: records are deactivated, never removed, so nothing is orphaned.

-- profiles ---------------------------------------------------------------
create policy profiles_select_own   on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_select_admin on public.profiles for select to authenticated using (public.is_admin());
create policy profiles_update_own   on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());       -- role/email/is_active guarded by trigger
create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- No INSERT policy: profiles are created only by the handle_new_user trigger.

-- departments ------------------------------------------------------------
create policy departments_select_public on public.departments for select to anon, authenticated using (is_active);
create policy departments_select_admin   on public.departments for select to authenticated using (public.is_admin());
create policy departments_insert_admin   on public.departments for insert to authenticated with check (public.is_admin());
create policy departments_update_admin   on public.departments for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- doctors ----------------------------------------------------------------
create policy doctors_select_public on public.doctors for select to anon, authenticated using (is_active);
create policy doctors_select_admin  on public.doctors for select to authenticated using (public.is_admin());
create policy doctors_insert_admin  on public.doctors for insert to authenticated with check (public.is_admin());
create policy doctors_update_admin  on public.doctors for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- appointments -----------------------------------------------------------
create policy appts_select_own   on public.appointments for select to authenticated using (patient_id = auth.uid());
create policy appts_select_admin on public.appointments for select to authenticated using (public.is_admin());
create policy appts_insert_own   on public.appointments for insert to authenticated
  with check (patient_id = auth.uid() and status = 'pending');
create policy appts_insert_admin on public.appointments for insert to authenticated with check (public.is_admin());
create policy appts_update_own   on public.appointments for update to authenticated
  using (patient_id = auth.uid()) with check (patient_id = auth.uid() and status = 'cancelled');
create policy appts_update_admin on public.appointments for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- status history ---------------------------------------------------------
create policy history_select_own on public.appointment_status_history for select to authenticated
  using (exists (select 1 from public.appointments a where a.id = appointment_id and a.patient_id = auth.uid()));
create policy history_select_admin on public.appointment_status_history for select to authenticated using (public.is_admin());

-- notifications (rows are created only by the database trigger) ----------
create policy notif_select_own on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_update_own on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- contact messages -------------------------------------------------------
create policy contact_insert_public on public.contact_messages for insert to anon, authenticated with check (is_handled = false);
create policy contact_select_admin  on public.contact_messages for select to authenticated using (public.is_admin());
create policy contact_update_admin  on public.contact_messages for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ==========================================================================
-- FIRST ADMINISTRATOR (manual, safe procedure)
-- 1. Register normally on the website (this creates a 'patient' profile).
-- 2. In Supabase > SQL Editor (runs without a user session, so the guard trigger allows it):
--      update public.profiles set role = 'admin' where email = 'YOUR_EMAIL_HERE';
-- 3. Log out and back in. Further admins are promoted the same way.
-- There is intentionally NO public form or API path that grants admin.
-- ==========================================================================
