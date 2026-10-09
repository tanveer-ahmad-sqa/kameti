# Kameti

A mobile app (Android + iOS) for running a **committee / kameti / BC**: a rotating savings group where every member pays a fixed amount each month and one member receives the full pot, until everyone has received it once.

- **App:** React Native + Expo (SDK 57), TypeScript (strict), Expo Router, TanStack Query, Zustand, React Hook Form + Zod, i18next, Sentry
- **Backend:** Supabase (Postgres + Row Level Security, Auth with phone OTP, Edge Functions, scheduled jobs)

See [CLAUDE.md](CLAUDE.md) for architecture decisions and code conventions.

---

## Local development

### Prerequisites

| Tool | Notes |
|---|---|
| Node.js 24+ and npm | |
| Docker | Docker Desktop, or [Colima](https://github.com/abiosoft/colima) (`colima start`) |
| Xcode (iOS) and/or Android Studio (Android) | For development builds. The app uses native modules, so **Expo Go is not supported** |

The Supabase CLI is a dev dependency, so there is nothing to install globally (`npx supabase …` or the `npm run db:*` scripts).

### 1. Install

```bash
npm install
```

### 2. Start the local backend

```bash
npm run db:start        # Postgres only: migrations + seed (fast, enough for tests)
# or, for running the app against it:
npx supabase start      # full stack: API, Auth, Studio (http://127.0.0.1:54323)
```

`npx supabase start` prints the **API URL** and the **Publishable key**.

### 3. Configure the app

```bash
cp .env.example .env.local
```

Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the output above. On a **physical device**, replace `127.0.0.1` with your computer's LAN IP.

### 4. Run

```bash
npx expo run:ios        # or: npx expo run:android
```

### Test accounts (local only)

No SMS is sent locally. These numbers accept the code **123456** (see `supabase/config.toml`):

| Phone | Seeded as |
|---|---|
| 0300 1111111 | Ayesha, organizer of "Office Kameti" (draft) |
| 0300 2222222 | Bilal, added to "Office Kameti" by phone but **not yet signed up**. Sign in to see the committee appear automatically |
| 0300 3333333 | Sana, same as Bilal |
| 0300 4444444 | Not in any committee |

Reset the database to this state at any time with `npm run db:reset`.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint + Prettier check |
| `npm test` | Jest unit and component tests |
| `npm run db:start` | Start local Postgres, apply migrations and seed |
| `npm run db:reset` | Recreate the local DB from migrations + seed |
| `npm run db:test` | pgTAP tests (RLS isolation, constraints, audit log) |
| `npm run db:types` | Regenerate `src/types/database.types.ts` from the local schema |

**End-to-end (Maestro):** install [Maestro](https://maestro.dev), run a dev build, then `maestro test e2e/`.

**Database changes:** never edit an applied migration. Create a new one with `npx supabase migration new <name>`, run `npm run db:reset && npm run db:test && npm run db:types`, and commit the regenerated types (CI checks they are up to date).

---

## Environment variables

| Variable | Where it is used | Secret? | Where to set it |
|---|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | App | No (bundled) | `.env.local` locally; EAS environment variables for builds |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | App | No (bundled; RLS protects data) | same |
| `EXPO_PUBLIC_SENTRY_DSN` | App | No (bundled) | same |
| `SENTRY_ORG`, `SENTRY_PROJECT` | EAS build (source map upload) | No | EAS environment variables |
| `SENTRY_AUTH_TOKEN` | EAS build | **Yes** | EAS environment variable with **secret** visibility |
| `EAS_PROJECT_ID` | `app.config.ts` | No | EAS environment variables (or `.env.local`) after `eas init` |
| Supabase secret/service-role key | Edge Functions only | **Yes** | Provided automatically to Edge Functions by Supabase. **Never put it in the app or a `.env` file** |
| Twilio credentials | Supabase Auth | **Yes** | Supabase dashboard only (see below) |

---

## Production setup checklist

You need: a Supabase project, a Twilio account with a Verify service, an Expo account, and optionally Sentry.

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com). Choose a region close to Pakistan (e.g. **Mumbai, ap-south-1**).
2. Link and push the schema:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push            # applies supabase/migrations (NOT seed.sql)
   ```
3. **Project Settings → API keys:** copy the **Project URL** and the **Publishable key**. These become `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. **Authentication → Sign In / Providers:**
   - **Email:** disable it (the app is phone-only).
   - **Phone:** enable it and allow new users to sign up. The SMS provider is set up in step 2 below.
5. **Authentication → Rate limits:** keep SMS limits conservative (e.g. 30/hour) to control SMS cost and abuse.

### 2. Twilio Verify (SMS codes)

1. Create a Twilio account and **upgrade it** (trial accounts can only send to numbers you have verified yourself).
2. **Messaging → Settings → Geo permissions:** enable **Pakistan**.
3. **Verify → Services → Create new:** name it "Kameti" and enable the **SMS** channel. Copy the **Service SID** (starts with `VA…`).
4. From the Twilio console home, copy the **Account SID** (`AC…`) and **Auth Token**.
5. In Supabase, open **Authentication → Sign In / Providers → Phone**, choose **Twilio Verify** as the SMS provider and enter:

   | Supabase field | Value from Twilio |
   |---|---|
   | Twilio Account SID | `AC…` |
   | Twilio Auth Token | Auth Token |
   | Twilio Verify Service SID | `VA…` |

6. Test with your own number from a preview build.

> Delivery to Pakistani networks can need sender registration depending on Twilio's current local rules. Check Twilio's Pakistan SMS guidelines before launch.

### 3. Expo / EAS

```bash
npx eas-cli@latest login
npx eas-cli@latest init                    # creates the EAS project; put its id in EAS_PROJECT_ID
```

For each EAS environment (`development`, `preview`, `production`), add the variables from the table above (Expo dashboard → Project → Environment variables, or `eas env:create`).

```bash
npx eas-cli@latest build --profile development   # dev client for local work
npx eas-cli@latest build --profile preview       # internal testing (APK / ad-hoc)
npx eas-cli@latest build --profile production    # store builds
npx eas-cli@latest submit --profile production
```

Build profiles install side by side with different IDs: `pk.kameti.app.dev`, `pk.kameti.app.preview` and `pk.kameti.app`.

### 4. Sentry (optional but recommended)

Create a React Native project in Sentry and set `EXPO_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` and `SENTRY_AUTH_TOKEN` (secret) as EAS environment variables. Sentry is disabled in development builds and never receives phone numbers or names.

---

## Project structure

```
src/
  app/              Expo Router routes (thin: they render feature screens)
  components/ui/    Reusable UI primitives (Button, TextField, Screen, state views…)
  features/<name>/  Feature screens, hooks (api.ts) and tests
  lib/              Supabase client, query client, errors, dates, env, Sentry
  i18n/             i18next setup and locales/en.json (all user-facing strings)
  theme/            Design tokens, light/dark colors
  types/            Generated database types
supabase/
  migrations/       SQL migrations (schema, triggers, RLS)
  tests/            pgTAP tests (RLS isolation, constraints, audit log)
  functions/        Edge Functions; _shared/ holds Zod schemas and helpers used by the app too
  seed.sql          Local development data only
e2e/                Maestro flows
```
