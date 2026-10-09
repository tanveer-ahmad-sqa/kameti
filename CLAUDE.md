# Kameti: architecture decisions and conventions

Committee (ROSCA) management app for Pakistan. Expo SDK 57 + Supabase. Read [AGENTS.md](AGENTS.md) for Expo-specific rules (check versioned docs, use `npx expo install`, never edit `ios/` or `android/`).

## Status

- [x] Phase 1: project setup, schema + migrations + RLS + pgTAP tests, phone OTP auth
- [ ] Phase 2: create committee, manage members, invite flow
- [ ] Phase 3: payout order (server-side draw) and payout schedule
- [ ] Phase 4: payment tracking, activity log UI, dashboard, history
- [ ] Phase 5: push notifications and scheduled reminders
- [ ] Phase 6: polish, accessibility, error handling, EAS, store readiness

Commit after each phase. Push to `origin` (github.com/tanveer-ahmad-sqa/kameti) only after the user approves the phase.

## Product decisions (confirmed with the user)

- An organizer can also be a member. The "I'm also a member" checkbox is on by default and counts toward `member_count`.
- **Payout day** is a day of the month (1–28), on or after the due day. The form asks for "days after due date" (default 5, 0 = same day) and rejects due day + offset > 28.
- **Due day** is 1–28 (no month-length edge cases).
- **Member-choice ordering:** members with the app pick from free turns. The organizer can assign, reassign or clear any turn while in draft. The draft screen shows empty turns. Activation is blocked until every turn is filled.
- **Activation** requires all N members and a complete order, with the start month current or future. It needs a confirmation dialog, because members and order lock afterwards.
- **Account deletion:**
  - An organizer is blocked while any of their committees is active, with an explanation.
  - A deleted member keeps their name and history in committees, shown as "Former user". Their profile and phone link are removed.
- **SMS:** Twilio Verify in production. Locally, Supabase test OTP numbers.
- **IDs:** bundle ID and package `pk.kameti.app` (`.dev` and `.preview` suffixes for those profiles). Scheme `kameti://`. No domain in v1: invite = store link + deep link, structured so a domain link can be added later.
- **No partial payments in v1.**
- **Streak:** consecutive months, counting back from the latest due month, paid on or before the due date. The date used is the member's "I've paid" time if they claimed and it was later confirmed, otherwise the organizer's confirmation time.

## Architecture

- **The database enforces business rules.** Triggers in `supabase/migrations/*_integrity_triggers.sql` hold no matter who writes: client, RPC or service role.
  - Status only moves forward.
  - Terms freeze after draft.
  - Member count and turn limits are enforced.
  - Members are locked after activation.
- **Writes:**
  - Clients write directly only where RLS is sufficient: own profile, and draft committee and member edits by the organizer.
  - Everything else (create committee, activate, payments, payouts, draws) goes through `SECURITY DEFINER` RPCs or Edge Functions.
  - These must check `auth.uid()` and validate state.
  - Committees have **no INSERT grant**. Creation is an RPC, so the organizer's member row is created atomically.
- **Account linking:**
  - `committee_members.user_id` is never client-writable.
  - It is set by triggers when the phone matches a profile, and when a phone is verified (`private.handle_verified_phone` on `auth.users`).
  - Only verified phones claim memberships.
- **Audit:**
  - `activity_log` is written by AFTER triggers on committees, members, cycles and payments, via `private.log_activity`.
  - The actor is `private.current_actor()`: the JWT `sub`, else the transaction setting `kameti.actor_id` (set by service-role RPCs acting for a user), else NULL (system).
  - `activity_log` and `payout_draws` are append-only. UPDATE and TRUNCATE always fail. DELETE only works as a cascade from deleting a draft committee.
  - Phone numbers are never logged.
- **Post-activation turn changes:** must set `kameti.allow_locked_member_change = 'on'` inside a logged organizer RPC. The trigger refuses otherwise.
- **Random draw:**
  - Runs in an Edge Function with `crypto.getRandomValues` (Fisher–Yates with rejection sampling).
  - The result is written by a service-role RPC that also inserts into `payout_draws`.
  - Re-draws in draft are allowed but each one is permanently recorded and visible to members.
- **Offline:**
  - The TanStack Query cache is persisted to `expo-sqlite/kv-store` (7 days), so screens show cached data offline.
  - Mutations use `networkMode: 'online'` and are **never queued**, because money changes must not replay later.
  - The cache is cleared on sign-out.
- **Supabase session:** stored with `expo-sqlite/localStorage`, as in the Expo + Supabase guide.

## Database conventions

- Every schema change is a new migration (`npx supabase migration new <name>`). Never edit an applied one.
- Every table:
  - has RLS enabled
  - has explicit `GRANT`s (default privileges revoke everything from `anon` and `authenticated`)
  - has FKs indexed
  - has CHECK constraints for domain rules
- Every new public function: `revoke execute ... from public, anon` and grant to `authenticated` only if callable by users. Use `set search_path = ''` and schema-qualify everything.
- Helpers for RLS live in schema `private` (not exposed via the Data API): `private.is_committee_participant`, `is_committee_organizer` and `is_draft_organizer`.
- Business-rule errors: `raise exception using errcode = 'P0001', message = '<snake_case_code>'`. Add the code to `src/lib/errors.ts` and `errors.*` in `en.json`.
- Composite FKs (`(member_id, committee_id)`, `(cycle_id, committee_id)`) guarantee child rows belong to the same committee.
- Money: `integer` whole rupees, never floats. Calendar days (`due_date`, `start_month`) are `date`, meaning Asia/Karachi days. Instants are `timestamptz` (UTC).
- After changing the schema, run `npm run db:reset && npm run db:test && npm run db:types` and commit `src/types/database.types.ts`. CI diffs it.
- pgTAP tests in `supabase/tests/*.test.sql`. Impersonate with `set local role authenticated` and `set_config('request.jwt.claims', '{"sub":"<uuid>","role":"authenticated"}', true)`. To assert RLS-blocked writes, use `prepare x as update ... returning id; select is_empty('x', ...)`.

## App conventions

- **Routes** in `src/app/` are thin and render screens from `src/features/<feature>/`. Each feature has an `api.ts` (query and mutation hooks), screens, components and `__tests__/`.
- **Query keys** only come from `src/lib/queryKeys.ts`.
- **Zod schemas** shared with Edge Functions live in `supabase/functions/_shared/`, imported as `@shared/...`.
  - Shared files import only `zod`: no relative imports and no RN or Deno APIs.
  - Messages are i18n keys (`validation.*`), translated with `translateValidation`.
- **Strings:** all of them go in `src/i18n/locales/en.json` and are type-checked keys via `t()`. No hard-coded user-facing text.
- **RTL readiness:** use `start`/`end` and `textAlign: 'auto'`, never left/right.
- **UI:** use `@/components/ui` primitives.
  - Tap targets ≥ `MIN_TAP_TARGET` (52).
  - Text goes through `AppText` (dynamic type capped at 1.6×).
  - Colors come from `useTheme()`, never hard-coded.
- **Every data screen** handles loading, empty, error (with retry), offline (`OfflineBanner` via `Screen`) and pull-to-refresh.
- **Accessibility:** buttons have roles and labels, inputs have labels and hints, errors use `accessibilityRole="alert"` with a live region.
- **Money display:** always `formatPKR()` → "Rs 10,000". **Phone display:** `formatPkMobile()` → "0300 1234567". Phones are stored and sent as E.164 (`+923XXXXXXXXX`).
- **Dates:** use the helpers in `src/lib/dates.ts`. Never call `new Date('yyyy-MM-dd')` on a calendar date.
- **Types:** no `any` (lint error). Supabase calls are typed through the generated `Database` type.
- **Tests:**
  - React Native Testing Library v14 APIs are async: `await render(...)`, `userEvent.setup()`, `await user.press(...)`.
  - Variables used inside `jest.mock` factories must be prefixed `mock`.

## Commands

`npm run typecheck`, `npm run lint`, `npm test`, `npm run db:start`, `npm run db:reset`, `npm run db:test`, `npm run db:types`. Docker on this machine is Colima (`colima start`).
