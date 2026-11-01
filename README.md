# REDCARE HOSPITALS

**Designed & Developed by Ahmad**

> **Fictional portfolio demonstration.** REDCARE HOSPITALS is not a real hospital, has no affiliation with any real healthcare company, and provides no medical care or emergency service. All doctors, addresses and data are invented. Do not enter real medical information.

Live URL (after you deploy): https://ahmadcrt.github.io/redcare-hospitals/  
Repository: `ahmadcrt/redcare-hospitals`

## Overview
A hospital website with online appointment booking, a patient portal and an administrator dashboard. The frontend is static (GitHub Pages); data, authentication and authorization are handled by Supabase (Auth, PostgreSQL, Row Level Security).

## Features
- Public site: home, about, departments, doctors (search, department filter, profile popup), services, contact, privacy/demo notice, 404.
- Booking: department, doctor, date, time slot, details, review, confirmation with reference number (`RC-YYMMDD-XXXXXX`). Availability, past dates, doctor working days and duplicate slots are checked in the browser and enforced again by database triggers and unique indexes.
- Patient portal (login required): dashboard with counts and notifications, appointment list with details/history and cancellation, profile editing.
- Admin dashboard: statistics; doctor, department, appointment and patient management.
- Auth: registration, login, logout, session persistence, email verification, password reset.
- Contact form saves to the database only (no external endpoint).

## Technology
HTML5, CSS3, vanilla JavaScript, Supabase (Auth, Postgres, RLS), `@supabase/supabase-js@2.45.4` loaded from jsDelivr. No frameworks, no build step.

## Project structure
```
index.html about.html departments.html doctors.html services.html contact.html
appointments.html login.html register.html privacy.html 404.html
patient-dashboard.html patient-appointments.html patient-profile.html
admin-dashboard.html admin-doctors.html admin-departments.html admin-appointments.html admin-patients.html
css/   style.css responsive.css auth.css dashboard.css admin.css
js/    config.js supabase.js auth.js main.js public.js appointments.js
       patient-dashboard.js patient-profile.js admin-*.js
database/ schema.sql security.sql seed.sql
assets/images/hero.svg
```
`js/public.js` (departments, doctors, contact) was added to the originally suggested structure.

## Supabase setup
1. Create a Supabase project (free plan allows 2 active projects per account).
2. **SQL Editor**: run in this order, one at a time: `database/schema.sql`, `database/security.sql`, `database/seed.sql`.
3. Verify: 7 tables, 10 departments, 13 doctors, RLS on every table.
4. **Project Settings > API**: copy the Project URL and the **anon/publishable** key into `js/config.js`. These two values are designed to be public. **Never** put the `service_role`/secret key or database password in any file.
5. **Authentication > URL Configuration**: Site URL `https://ahmadcrt.github.io/redcare-hospitals/`. Add Redirect URLs: `https://ahmadcrt.github.io/redcare-hospitals/login.html` (and `http://localhost:8000/login.html` for local testing).
6. **Authentication > Providers > Email**: keep "Confirm email" on for realistic verification. For quick local testing you may turn it off.
7. Supabase's built-in email sender is rate-limited. For real use configure custom SMTP.

## First administrator
There is deliberately no public path to admin. Register through the website, then run in the SQL Editor:
```sql
update public.profiles set role = 'admin' where email = 'YOUR_EMAIL_HERE';
```
Log out and in again. Repeat for further admins.

## Run locally
```
cd redcare-hospitals
python3 -m http.server 8000
```
Open http://localhost:8000. (Opening files by double-click can break sign-in redirects.)

## Deploy to GitHub Pages
1. Put all files (keeping folders) in the repository `redcare-hospitals`, on branch `main`, with `index.html` at the root. Upload via git, GitHub Desktop, or the GitHub web "Upload files" on a computer.
2. Repository **Settings > Pages > Build and deployment**: Source "Deploy from a branch", branch `main`, folder `/ (root)`.
3. Wait a minute, then open the live URL. All links are relative so they work under `/redcare-hospitals/`. `404.html` uses `<base href="/redcare-hospitals/">`; change it if you rename the repository.

## Security notes
- RLS is enabled on all 7 tables; privileges are revoked then granted narrowly; no DELETE is granted anywhere.
- Patients read only their own profile, appointments, history and notifications. Admin rights come from `is_admin()` reading `profiles.role` in the database.
- Triggers block role/email/is_active changes by non-admins, force new bookings to `pending`, allow only valid status transitions, and let patients only cancel future appointments.
- Availability is exposed through `get_booked_slots`, which returns times only, no personal data.
- Anyone can insert into `contact_messages` (spam is possible; add CAPTCHA/rate limiting for real use).

## Demo limitations
- No email/SMS notifications; only in-app notifications. To add email, use a Supabase Edge Function or database webhook with a provider such as Resend.
- Booking requires an account.
- Disabling a patient blocks website login and new bookings, but does not revoke a session that is already open or hide that user's own data from them.
- "Department has active doctors" is enforced in the admin page, not in SQL (departments cannot be deleted at all).
- The published pages use a CDN script; if jsDelivr is blocked the site cannot reach Supabase.
- Images are a single local SVG illustration; add licensed photos if desired.

## Testing checklist
Status reflects what was verified while building. **NOT TESTED** means it needs a live browser/Supabase session.

| Area | Status |
|---|---|
| SQL files ran without errors on Supabase; 10 departments, 13 doctors, RLS on 7 tables | Verified by project owner |
| JavaScript syntax (all files) | Passed (`node --check`) |
| Local file/link/path references in all HTML | Passed (static script) |
| No service-role/secret keys in frontend | Passed (grep) |
| Registration, email verification, login, logout, reset, session persistence | NOT TESTED |
| Booking (valid, past date, taken slot, duplicate) and reference number | NOT TESTED |
| Patient own-data access; cancellation rules; counts | NOT TESTED |
| RLS: patient cannot read others, cannot self-promote, cannot self-confirm | NOT TESTED |
| Admin: doctor/department CRUD, status changes, patient list, statistics | NOT TESTED |
| Mobile menu and responsive layouts on real devices | NOT TESTED |
| GitHub Pages deployment | NOT DONE |

### Suggested RLS tests (run as a normal patient in the browser console after login)
```js
await RC.db.from('profiles').update({role:'admin'}).eq('id', (await RC.auth.profile()).id)   // expect error
await RC.db.from('appointments').update({status:'confirmed'}).eq('id','<your appt id>')      // expect error
(await RC.db.from('profiles').select('*')).data.length                                        // expect 1
```

Designed & Developed by Ahmad
