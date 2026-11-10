# MOE Membership

A membership and meetup attendance system with a Telegram Mini App, a responsive Admin/Staff web application, and a shared API consumed by a separately developed Flutter mobile app.

## Status

Step 1 foundation implemented: React/Vite development preview, NestJS public liveness endpoint, configuration validation, explicit CORS, security headers, Prisma v7 schema and migration tooling, and local OpenAPI/Postman artifacts. Better Auth phone/password signup/login/session/logout, automatic member profiles, protected own-profile API, and web forms are implemented. Admin account workflows, plans and memberships are implemented. Live scanning and transactional check-ins are implemented; attendance history and Admin backfill are implemented; attendance cancellation is implemented; reports remain pending.

## Selected stack

- Web: React + Vite + TypeScript.
- Backend: NestJS + TypeScript, organized as feature modules.
- Database: PostgreSQL hosted on Neon.
- Database access: Prisma 7.10.1 + official Better Auth Prisma adapter + PostgreSQL driver adapter.
- Mobile: Flutter, owned by a separate team and using the same API.

## Documentation

- [Flutter API quick start](docs/flutter-quick-start.md)
- API browser documentation: `/docs` on the API host; raw specification: `/docs/openapi.json`. Deploy the documentation change before using these hosted URLs. Interactive production writes are disabled in Swagger UI.
- [Agent instructions](AGENTS.md)
- [Requirements](docs/requirements.md)
- [Architecture](docs/architecture.md)
- [Deployment and recovery](docs/deployment.md)

## Planned structure

```text
apps/web/     React frontend
apps/api/     NestJS shared backend
postman/      API contracts, collections, and local guidance when initialized
docs/         Product and engineering documentation
```

## Local setup

Use Node 24.11 or later on the 24 LTS line (`nvm install` then `nvm use` with the included `.nvmrc`).

```sh
npm ci
npm run db:generate
npm run dev:api
```

In a second terminal run `npm run dev:web`. Open http://localhost:5173. The frontend proxies `/api` to http://127.0.0.1:3000 in development. The local web app includes the Admin/Staff console and React member screens; business data comes from the API.

Optional: copy `apps/api/.env.example` to `apps/api/.env`. No credentials are needed for the preview or liveness endpoint. Add Neon URLs locally before future database operations; never send credentials in chat or commit them. The frontend's `VITE_API_BASE_URL` is public.

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

`npm run db:generate` generates Prisma Client; `npm run db:validate` validates `apps/api/prisma/schema.prisma`. Neither changes the database.

Health: `GET http://localhost:3000/api/v1/health`. Production SPA hosting needs a route fallback and an API URL/proxy configuration; development proxy settings do not apply to the built site.

See [decisions](docs/decisions.md) for migration history and stack decisions.

## Implementation sequence

1. Verify toolchain versions; scaffold npm workspaces, React/Vite, and NestJS.
2. Agree on the shared API contract and authentication/session behavior with the Flutter team.
3. Implement schema and migrations, phone normalization, authentication, roles, and session revocation.
4. Implement scanning and attendance with transaction-safe visit accounting.
5. Implement QR display/rotation and transactional attendance with concurrency tests.
6. Add reports, exports, bilingual screens, audit logs, and end-to-end tests.
7. Deploy staging, test recovery and real devices, then review production readiness.

## Better Auth setup

Use the same PostgreSQL URL in `apps/api/.env`, plus `AUTH_BASE_URL` (API origin) and a randomly generated `BETTER_AUTH_SECRET` of at least 32 characters. The API health preview works without these values; auth returns 503 when unconfigured. Allow both localhost and 127.0.0.1 web origins when developing. The Neon managed-auth toggle is not required.

## Database migrations

Run these commands from the repository root. `DIRECT_URL` in `apps/api/.env` is used by Prisma CLI; `DATABASE_URL` is used by the application. Never put database credentials in Vite variables.

For the **configured Neon database**, the auth baseline has already been recorded. Check status and apply reviewed pending migrations:

```sh
npm run db:status -w @moe/api
npm run db:deploy -w @moe/api
npm run db:diff -w @moe/api
```

For another pre-existing database that has auth tables but no Prisma migration history, compare it specifically against `0_auth_baseline` before marking that baseline applied. The current full schema also includes profiles, so a full-schema diff is not an auth-only baseline check. Do not replay initial CREATE TABLE statements against existing tables, or mark unapplied profile migrations as applied.

For a **new empty database**, apply the checked-in baseline:

```sh
npm run db:deploy -w @moe/api
```

For future changes, edit `apps/api/prisma/schema.prisma`, generate/review migrations on an isolated development database using Prisma 7 `migrate dev`, commit the SQL, and use `db:deploy` during deployment. Never use reset or db push on production. The old `auth:schema` runner is removed; Prisma Migrate now owns all schema changes. The original auth SQL is preserved in `apps/api/prisma/migrations/0_auth_baseline/migration.sql`; the duplicate legacy folder has been removed.

The active schema contains the mapped auth models, member profiles, plans, memberships, meetup sessions, QR credentials and audit records. Migration `202611030001_member_profiles` backfills existing accounts and installs transactional provisioning for new accounts. `GET /api/v1/members/me` returns only the signed-in user’s profile. QR and membership APIs are documented in their sections below.

## Local database integration tests

```sh
AUTH_TEST_DATABASE_URL=postgresql://USER@127.0.0.1:PORT/moe_auth_test npm test
```

Only an isolated local database named `moe_auth_test` is accepted. The test deploys checked-in Prisma migrations and clears auth test data. Never point it at Neon or production. Without this variable, database integration tests are skipped.

Keep Prisma CLI, Client, and adapter-pg on the same supported v7 patch and retain the npm lockfile. Do not run an unversioned global/npx Prisma CLI, which may select v8. The lodash override addresses an existing transitive advisory; review dependency advisories before production.

## Account administration

Backend account APIs and the Admin dashboard screens are implemented.

- `GET /api/v1/admin/users?limit=20&search=...` — Admin-only account directory, with cursor pagination.
- `POST /api/v1/admin/users` — create a Member with a phone number or Staff with an email, both using a temporary password. A matching Member phone returns the existing account unchanged. A duplicate Staff email returns HTTP 409.
- `POST /api/v1/account/password` — verify current password, replace it, and revoke **all** sessions. Sign in again afterward.
- `POST /api/v1/admin/users/:id/reset-password` — requires a reason and `identityVerified: true` after actual Page identity verification; all target sessions are revoked and the replacement password must be changed.
- `PATCH /api/v1/admin/users/:id/access` — change Member/Staff role or enabled state with a reason; revoke target sessions. This endpoint cannot demote or disable an Admin.

### First Admin setup (one time)

After deploying migrations, set these **locally** in `apps/api/.env` (never commit populated values):

```dotenv
BOOTSTRAP_ADMIN_EMAIL=your-admin-email
BOOTSTRAP_ADMIN_NAME=your-name
BOOTSTRAP_ADMIN_PASSWORD=your-unique-12-to-128-character-temporary-password
```

Run from the repository root:

```sh
npm run admin:bootstrap -w @moe/api
```

The command refuses to run if any Admin already exists or the email is already registered. It never overwrites/promotes an existing account. Remove the three bootstrap values after successful setup. No public bootstrap endpoint exists.

Sign in through Postman, then use **Change my password (manual only)** in the auth collection. Set local `currentPassword` and `newPassword` variables; the request uses your signed-in `authToken`. Sign in again with the new password before using Admin APIs. Temporary-password sessions can inspect auth session/logout and replace their password, but cannot access profile or Admin/business APIs. `mustChangePassword` is included in auth identity responses so Flutter can display the replacement screen.

Use `postman/collections/accounts.postman_collection.json` only against an isolated test database: it creates a synthetic account and exercises reset/disable/re-enable. Provide an already-initialized Admin's `adminPhone` and `adminPassword` as local secret environment values and set Runner request delay to 2500 ms. Do not export populated passwords or tokens. The normal auth collection skips the optional manual password change unless its two password variables are supplied.

## Web console

Open `http://127.0.0.1:5173/console` after starting the API and web dev servers. Admin and Staff sign in at `/console/login`. Members sign in at `/login` and use `/member`.

The console references the senior-provided MOE prototype's sidebar, logo and orange/neutral styling, but reads/writes the real shared API. Admins can view live account counts, search/filter/page accounts, create Member/Staff accounts, edit access, and reset passwords after manual verification. All signed-in roles can change their password. Temporary-password accounts must replace their password before opening the workspace; successful password changes require a fresh sign-in. Staff/Member views do not expose Admin controls.

Browser authentication uses HttpOnly session cookies, with no tokens stored in localStorage. The EN/Myanmar interface preference is browser-local; it does not change the member's server-side language setting. Some explanatory copy remains English. Mobile navigation, loading/error/empty states, accessible dialogs and inline validation are included.

Plans and memberships provide real API-backed workflows and per-record audit history. Attendance corrections, reports and global audit browsing remain marked as coming next. API account counts are live; membership/attendance dashboard metrics remain pending. The plans and memberships increment adds an additive database migration.

The Admin directory supports `role` and `enabled` query filters. `GET /api/v1/admin/users/summary` supplies live account totals. OpenAPI describes both. For isolated local browser verification, the Vite development proxy can use `DEV_API_PROXY_TARGET`; it defaults to `http://127.0.0.1:3000`.

If another project uses port 3000, start MOE on port 4000 instead (separate terminals):

```sh
PORT=4000 AUTH_BASE_URL=http://localhost:4000 npm run dev:api
```

```sh
DEV_API_PROXY_TARGET=http://127.0.0.1:4000 npm run dev:web
```

The frontend remains at `http://127.0.0.1:5173/console`. These commands override ports for that run without changing stored credentials.

## Plans and memberships

Admin console pages `/console/plans` and `/console/memberships` now support plan creation/edit/archive, explicit membership assignment, quota/date correction, renewal, cancellation and per-record audit history. Plan templates contain no dates. Existing quotas remain unchanged after editing a template. Both membership dates are mandatory and inclusive in Asia/Yangon.

Import `postman/collections/memberships.postman_collection.json` for saved API requests; set credentials locally and enter member ID and dates before running writes. OpenAPI response contracts are in `postman/specs/openapi.json`. Flutter can read its own terms with `GET /api/v1/members/me/memberships`.

Live check-ins now debit visit usage atomically. Corrections and reports remain subsequent work. This increment does not establish production release readiness.

## Meetup sessions

Open `/console/sessions` as Admin to create a meetup for an available plan, explicitly select its date and initial Open/Closed state, and assign enabled Staff. Manage staff assignments, open/close sessions, and view per-session audit history. Staff see the same page with only currently assigned sessions and no management controls or staff roster. Name, plan and meetup date are immutable in this increment; no delete endpoint is provided. Create a separate session when a different meetup is needed.

Shared reads: `GET /api/v1/sessions` and `GET /api/v1/sessions/:id`. Admin writes: `POST /api/v1/admin/sessions`, `PATCH /api/v1/admin/sessions/:id/state`, and `PUT /api/v1/admin/sessions/:id/staff`. Mutations require a reason and edits require the latest version. The saved requests are in `postman/collections/sessions.postman_collection.json`. Live scanning also requires the session date to be today in Asia/Yangon.

## Personal QR

Every account now receives a QR credential automatically, including accounts without membership. Member QR display belongs to the Flutter app/web. The React console does not expose a Personal QR page. Admin can select **Regenerate QR** in **Users & staff**, enter a reason and replace a lost/shared QR. Only the owner can fetch the payload; Admin sees metadata and rotation history. Old QR identifiers are invalid after regeneration. The owner refreshes their QR in the Flutter app/web.

The shared Flutter API is `GET /api/v1/members/me/qr`; handoff details are in `docs/flutter-qr.md`. The saved Postman collection is `postman/collections/qr.postman_collection.json`. QR contents are not login credentials. The live scanner records attendance only after backend eligibility checks. Physical-device camera acceptance remains pending.

## Web route policy

React provides separate Member and Admin/Staff sign-in pages with shared branding. Member self-registration is at `/signup`. Flutter uses the shared API.

Routes: `/console`, `/console/users`, `/console/plans`, `/console/memberships`, `/console/sessions`, `/console/scanner`, `/console/attendance`, `/console/reports`, `/console/audit-logs`, `/console/settings`. Reports/global audit remain placeholders; Admin attendance history is live. Staff see overview, assigned sessions, scanner and settings. Admin/Staff see no Personal QR menu; Admin retains member QR regeneration in Users & staff. QR rows and member APIs remain intact.

Unauthenticated console and member visits redirect to their respective sign-in pages with an allowlisted returnTo. Unknown paths show a not-found page. Production hosting must rewrite SPA routes to index.html.

## React member signup

`/signup` creates a member account with no OTP and opens the member workspace. The backend provisions the QR. Membership assignment is a separate Admin operation.

## Loading and request recovery

Session restoration shows a compact logo/spinner with a brief anti-flicker reveal and a slow-response hint after five seconds. Data pages use table, card, stats, profile, details or history skeletons rather than an auth-form skeleton. Mutation forms remain visible with disabled, labelled busy buttons; refresh and option fetches show local activity. Reduced-motion preferences disable animation.

The shared React request client cancels requests after 15 seconds, including response-body reads, and cleans up its timer/listeners. Caller cancellation remains silent during navigation. Read failures expose retry controls; writes are never automatically replayed. A timed-out write asks the user to check whether it was saved before retrying, because the server may have committed it. The member profile query now uses this same client.

## Live QR check-in

Admin and assigned Staff use `/console/scanner`: choose an open session for today, allow the camera, or select a PNG/JPEG QR image. Image decoding stays on the device. Camera access requires HTTPS or localhost. The scanner stops camera tracks after a decode, when hidden, and on navigation. Offline scans are not queued.

`POST /api/v1/sessions/{id}/check-ins` accepts a UUID `requestId` and `qrPayload`. Only confirmed server results show success. An uncertain response offers **Retry same scan**, retaining the same operation ID in component memory. Duplicate attendance never spends another visit. Use `postman/collections/check-ins.postman_collection.json` with a separate test environment and an eligible member/session. QR payloads are run-local variables, never saved collection credentials.

The migration adds effective-attendance uniqueness and transactional visit accounting. Existing attendance cannot be deleted. Admin cancellation, historical backfill and history screens are implemented. PostgreSQL race/rollback tests, browser QR image decoding, simulated camera and ambiguous-response retry were verified. Physical Android/iOS camera UAT and Flutter integration remain unverified.

## Attendance history

Admin: `/console/attendance` and `GET /api/v1/admin/attendance`. Flutter own history: `GET /api/v1/members/me/attendance`. Search, inclusive Myanmar meetup-date filters, status/method filters and cursor pagination are available. Staff use the same web page with read-only access to currently assigned sessions through `GET /api/v1/staff/attendance`. Results retain cancellation and recording metadata. No visit accounting changes or new migration are needed. Saved requests: `postman/collections/attendance.postman_collection.json`. Admin backfill and attendance cancellation are available.

## Admin historical backfill

From `/console/attendance`, choose **Backfill attendance**, select the actual meetup date, search/select a session and account, enter the actual Myanmar attendance time and a required reason, then save. Only past Yangon dates are accepted; closed historical sessions are allowed. The member must currently be enabled, the noncancelled membership must cover the historical date, and its current quota must have a visit available. Being expired today does not by itself prevent historical backfill.

POST `/api/v1/admin/sessions/{id}/attendance/backfill` accepts `{ requestId, userId, occurredAt, reason }`, with an ISO timestamp containing UTC/offset. Retry unknown outcomes with the exact same request ID and input. Duplicate attendance returns the original time without another visit debit. Actual event time and recording Admin/time are retained; the required reason is stored in the attendance audit. History distinguishes `backfill` from `scan`. Saved Postman requests are in `postman/collections/backfill.postman_collection.json`. No new schema migration is required.

Prisma connections explicitly use UTC so timestamp storage is independent of server defaults. Calendar eligibility and UI time entry/display use Asia/Yangon. Automated PostgreSQL and browser checks cover boundary timestamps, rollback, live/backfill last-visit races, duplicates and lost-response recovery. Flutter integration and production deployment remain separate verification.

## Attendance cancellation

Admin uses **Cancel attendance** on an effective row at `/console/attendance`, reviews the member/session/time, supplies a reason and confirms. POST `/api/v1/admin/attendance/{id}/cancel` accepts only `{ reason }`. It atomically cancels that immutable attendance record, refunds one visit to its original membership and writes one audit. Concurrent/repeated calls return the original cancellation and never refund twice or overwrite its reason. No requestId is needed: the attendance ID is the permanent operation target.

Corrections remain possible for disabled members, cancelled/expired memberships and closed sessions. Refunding does not extend/reactivate a term or credit a replacement term. A fresh eligible check-in creates another attendance record; retries against the old cancelled ID cannot cancel/refund the new attendance. Original facts and cancellation actor/time/reason remain visible in history. Unknown browser outcomes offer **Retry cancellation** for the same ID and reason.

Saved requests: `postman/collections/cancellation.postman_collection.json`. No schema migration is needed. Real PostgreSQL checks cover double cancellation, late audit rollback, transaction-conflict retry, scan/cancel races, preserved history and original-term accounting. Browser and Postman verification use isolated synthetic data. Reports/dashboard metrics, global audit browsing, Flutter integration, physical-device acceptance and deployment remain separate work.

Membership assignment/renewal recipients must currently have Member role and be enabled. Admin/Staff IDs are rejected server-side with INVALID_MEMBER_ROLE. The account picker shows enabled Members only. Console dropdowns now share a styled keyboard-accessible control, and headers show page name plus account name.

## Telegram test bot

1. Create a separate development bot in BotFather and use an isolated staging database and test accounts. Apply migrations with `npm run db:deploy -w @moe/api`.
2. Deploy the API and React web app over HTTPS. Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` (a random string using letters, numbers, underscores, and hyphens), and `TELEGRAM_LINK_URL` (the web origin followed by `/telegram/link`) on the API. Use the normal trusted web origin and working browser cookie configuration for the link page.
3. Register a webhook with Telegram's `setWebhook` method. Set `url` to the staging API origin followed by `/api/v1/telegram/webhook`, `secret_token` to the configured webhook secret, and `allowed_updates` to `["message"]`. Keep the bot token in server or operator secrets.
4. In the private bot chat, send `/start` or say hello, then tap **Show my QR code**. Follow **Link MOE account**, sign in as a test member, and check the chat. Try **My plan**, **Attendance history**, and **Logout**. Reopen the link from the bot if Telegram launch data has expired.

## Console email sign-in rollout

Admin and Staff sign in with an email and password at `/console/login`. Gmail and company addresses are accepted. Admin-created Staff accounts require an email and a temporary password. The owner changes the password at first sign-in. Member login and signup still require a Myanmar phone number.

Apply database migrations before bootstrapping the first Admin with an email. For older databases with phone-only Admin or Staff accounts, assign each existing account its verified email by setting `CONSOLE_ACCOUNT_PHONE` and `CONSOLE_ACCOUNT_EMAIL` locally and running `npm run admin:set-console-email -w @moe/api` before deploying the email-only console. This keeps the account ID and password, and revokes existing sessions.
