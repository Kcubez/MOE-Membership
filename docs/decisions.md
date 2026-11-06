# Engineering Decisions

Entries below are chronological history. Earlier Prisma v8, direct-auth-schema, and preliminary-membership notes describe superseded states; the current implementation and release status are summarized in `README.md`, `docs/architecture.md`, and `docs/release-readiness.md`.

## 3 November 2026 — Foundation

- npm workspaces: React/Vite web and NestJS shared API. No client-specific backend duplication.
- Node 24.11+ on the 24 LTS line. The original shell Node 23 is incompatible with Prisma v8; local checks used isolated Node 24.22.2.
- Prisma CLI is pinned to 8.0.0-rc.29, a release candidate explicitly requested by the owner. Its PostgreSQL runtime is @prisma/orm-postgres; the old v7 @prisma/client/adapter API is not the v8 API. Versions follow the v8 toolchain rather than assuming all package version numbers match.
- Prisma v8 contract emission is local; no Neon connection or migration is attempted in Step 1. The starter Member model is preliminary, not the full domain schema.
- Public GET /api/v1/health is process liveness only. It does not assert database readiness or authentication.
- OpenAPI is the authoritative HTTP contract; the health Postman collection matches it and carries runnable assertions. No cloud workspace is published.
- The final lockfile resolution reports 27 dependency advisories (19 moderate, 8 high). Review transitive Prisma CLI/development dependencies before production use. Do not force-downgrade the requested v8 tooling; this foundation is not production approved.

## Foundation verification

- Node 24.22.2: web/API type checks and production builds passed.
- Lint and formatting checks passed; generated Prisma types are excluded from style checks.
- Two API tests passed: liveness/CORS and configuration rejection.
- Local Postman collection against the compiled NestJS server: one request, one assertion, zero failures. No cloud result was published.
- Installed Postman CLI does not support `postman status`; initialization registered local artifacts and no workspace binding.
- Runtime-only npm audit: zero advisories. Full dependency audit: 27 advisories (19 moderate, 8 high), including development tooling. Review before production use.
- No live Neon connection, database migration, authentication, QR/attendance behavior, Flutter integration, or real-device UI verification has occurred.

## Better Auth increment — 3 November 2026

- Better Auth 1.7.15 uses its direct PostgreSQL adapter, not the Prisma v7 adapter. Prisma v8 remains the business ORM.
- Phone/password signup is exposed through a constrained wrapper over the library credential engine. No OTP, public email registration, email reset, or raw library handler is mounted.
- Web sessions use HttpOnly cookies; mobile sessions return a bearer token without setting browser cookies.
- Cookie cache is disabled for live revocation checks. Disabled accounts cannot create sessions and session reads deny disabled users.
- Reviewed local evidence: five tests pass, including real PostgreSQL signup, duplicate normalization, invalid credentials, blocked role injection, Origin enforcement, web/mobile sessions, logout, disabled accounts, revocation, and login rate limiting. Four Postman requests/assertions pass against the compiled API. Type checks, builds, lint, and formatting pass.
- Runtime dependency audit reports zero advisories after pinning lodash 4.18.1. Full tooling audit still reports 22 advisories (19 moderate, 3 high); no production approval is claimed.
- Better Auth's transitive Prisma v7 CLI shadows the workspace binary. Database scripts explicitly invoke the pinned root v8 CLI.
- No live Neon database was accessed. The isolated PostgreSQL test instance was stopped afterward. Real-device Telegram cookies, Flutter integration, admin reset/temporary-password workflows, profile/QR creation, and production deployment remain unverified or unimplemented.

## Neon connection and initial auth schema — 3 November 2026

- Both saved pooled and direct connections verified against PostgreSQL 18 without exposing credentials. The database had zero public tables before initialization.
- Reviewed and applied five Better Auth tables and their indexes through the direct connection. SQL is now preserved in `apps/api/prisma/migrations/0_auth_baseline/migration.sql`; the duplicate legacy auth-migrations folder was removed after adopting Prisma Migrate.
- Pooled runtime connection verified all five tables afterward. No synthetic account was created in Neon.
- Schema tooling now prefers DIRECT_URL; runtime continues using DATABASE_URL.

## External Better Auth models — 3 November 2026

- Added AuthUser, AuthAccount, AuthSession, AuthVerification, and AuthRateLimit to the Prisma v8 PSL contract with exact mappings from read-only Neon schema introspection.
- Each is explicitly external. Existing Better Auth ownership, credential/session behavior, and public API contracts are unchanged.
- Generated full contract artifacts locally. A temporary auth-only contract passed Prisma `db verify --schema-only` against Neon with zero schema differences. No db sign, init, migration, or account-data queries were executed.
- MemberProfile remains a planned managed table; no foreign key or profile table is deployed by this change. Full-contract verification still depends on that later migration.
- Added a regression check that fails if any auth table loses its external ownership policy.

## 2026-11-03 — move to Prisma 7 for production preparation

- Owner approved replacing Prisma v8 RC with Prisma CLI/Client/adapter-pg 7.10.1 and the official Better Auth Prisma adapter. Prior v8 and separate-ownership notes above are historical and superseded.
- Auth behavior, table names, columns, constraints, and indexes are preserved. Better Auth modelName values now reference Prisma models; @@map retains physical table names. Enable adapter transactions to preserve signup/session hook consistency.
- Prisma Migrate becomes the sole schema owner. The initial baseline reproduces the existing five auth tables; existing databases are schema-checked before migration metadata is marked applied. No reset/recreation is needed.
- Removed the uncreated MemberProfile placeholder from the active schema; provisioning and its future migration remain pending. Removed v8 generated contracts and the direct Better Auth schema runner.
- API contracts and web/mobile clients are unchanged. Earlier advisory counts are historical snapshots, not current audit results.

### Prisma 7 migration verification

- Existing Neon auth schema matched the Prisma 7 schema with no differences. Recorded `0_auth_baseline` as applied, writing migration metadata without altering auth tables or account rows.
- Local existing-schema adoption and fresh-empty-database migration both passed schema diff. Five automated tests passed, including real PostgreSQL signup, cookies, bearer sessions, revocation, disabled users, and rate limiting.
- Typecheck, lint, production build, schema validation, and formatting passed. Runtime npm audit reported zero advisories; installation reported 11 moderate advisories across all dependencies including tooling.

## Member profile increment

- Introduced feature modules AuthModule/MembersModule and a shared lazy PrismaModule. SessionGuard resolves live enabled-account identity for feature endpoints.
- Profile provisioning uses a PostgreSQL trigger in the same transaction as auth user creation; this avoids writing through a different Prisma transaction from a Better Auth hook. Existing users receive a migration backfill. This custom trigger is versioned SQL and must remain part of restore/migration review.
- Member numbers are sequence-backed and formatted MOE-000001; gaps are allowed. English is the initial language, with en/my enforced in the database. Profile editing and QR are deferred.
- Added GET /api/v1/members/me to OpenAPI/Postman and a small signed-in profile display. No membership is granted by signup.

## 2026-11-04 — Phase 1 PRD membership status

- Owner confirmed the new developer PRD rule: Cancelled > Completed > Expired > Upcoming > Active.
- Zero remaining visits means Completed, including after the end date; Expired means past the inclusive Asia/Yangon end date with visits remaining. Neither permits check-in. This supersedes the SRS summary's previous Expired-before-Completed precedence.
- This change records requirements for the forthcoming membership implementation; membership APIs/status calculation are not implemented yet.

## 2026-11-04 — Admin/Staff account management

- Added AccountsModule, live role checks, forced-password session restrictions, explicit one-time Admin CLI, account directory, Member/Staff creation/reuse, current-password changes, manually verified resets and disable/re-enable/role updates.
- Password/reset/access changes atomically revoke sessions and record credential-free audit entries. Better Auth context supplies hashing/verification; the auth-owned account service writes credentials transactionally with revocation.
- Introduced per-account/session authVersion and a database session-insert trigger to serialize login against reset/disable. Clients cannot choose session versions. Existing normal users/sessions receive version 0 and are not forced to change passwords by this migration.
- Admin role changes/disable are blocked through the access endpoint. The bootstrap command is not executed on Neon without the owner's locally supplied Admin identity/password. No Admin dashboard UI is implemented in this increment.

### Verification for account-management increment

- Six automated tests passed against isolated PostgreSQL, including cookie/bearer sessions, current-role permissions, temporary password restrictions, reset/disable/role-change revocation, stale session epochs, concurrent password changes, audit redaction, account-directory privacy, and first-Admin bootstrap refusal on repeat.
- The account Postman collection passed all 13 requests/assertions against the isolated database with 2500 ms request spacing. No Postman cloud run results were published. The installed CLI does not support `postman status`.
- Applied the additive account-access migration to Neon development; read-only Prisma schema diff reported no differences. No real Admin account or credentials were created/changed.

## 2026-11-05 — reference-inspired web console

- Added a responsive React console at `/console` (also the root URL), based on the senior's public reference UI. The provided logo is copied locally from that reference. The legacy member preview remains at `/member`.
- Wired cookie-authenticated login/session/logout, forced password replacement, settings, account creation/reuse, search/pagination/role/status filters, role/access changes and manually verified password reset to real APIs. Member/Staff views do not expose Admin actions; server guards remain authoritative.
- Added a read-only Admin account summary API and role/enabled directory filters; updated OpenAPI and PostgreSQL regression assertions. No schema changes or Neon test-account writes were needed.
- Future membership/attendance modules remain explicit unavailable states rather than reproducing the reference's browser-local prototype data. Language preference is browser-local; full translation of explanatory copy and server profile-language editing remain separate work.

### Console verification

- Typecheck, lint and production build passed; six automated API tests passed against fresh isolated PostgreSQL.
- Real Chromium browser flow passed with synthetic local accounts: cookie sign-in, live counts, create/search/status filtering, role/access changes, forced password replacement, Staff role denial, mobile navigation without horizontal overflow, Myanmar UI preference, reset/session revocation, reload persistence and logout.
- Testing used separate local API/web ports and a local test database; the owner's Admin credentials and Neon accounts were not used. Temporary test servers were shut down after verification.

## 2026-11-05 — Membership periods and quotas

Use PostgreSQL inclusive DATE ranges plus a partial exclusion constraint for same-user/same-plan non-overlap. Cancelled terms are excluded so replacements can overlap. Retain a versioned quota snapshot per assignment. Renewal creates a new term from the current plan and explicit dates. Status uses Yangon dates with Cancelled > Completed > Expired > Upcoming > Active precedence. Audit reasons and before/after values are stored transactionally. Attendance will own atomic maintenance of the usedVisits counter in the next increment.

## 2026-11-05 — Meetup sessions and staff access

Keep session name/plan/date immutable for this increment, preserving future attendance identity. Use explicit dates and Closed by default in the UI. Admin can set the initial state and manage the complete Staff roster with optimistic versions and transactional audit. Only currently enabled Staff may be added; retained assignment rows never override current role/account restrictions. Staff see assigned sessions without the roster. No session deletion or attendance side effects are introduced.

## 2026-11-05 — Reconstructable signed personal QR

Use a random per-account credential UUID and domain-separated HMAC tied to account/version, with database-trigger provisioning and migration backfill. This supersedes the encrypted redisplay proposal and avoids storing QR signatures/payloads in the database. Optional QR_SIGNING_SECRET separates validity from Better Auth secret rotation; the existing secret supplies a compatible domain-separated fallback during development. Admin rotates with optimistic versions, sorted user locks, a QR-row lock and metadata-only audit. No public validation endpoint is introduced; future attendance must validate the current QR under the same transaction as eligibility and visit accounting.

## 2026-11-05 — Dedicated console entry and member-client boundary

Owner confirmed `/login` -> `/console` for Admin/Staff, with Flutter owning member login/signup on a separate app/host. Keep shared backend authentication and role checks. Remove the legacy React member preview and console Personal QR display. Retain QR provisioning and own-QR API for Flutter and Admin metadata/regeneration. Restrict login returnTo to local, role-allowed console routes; canonicalize legacy route names and show a not-found view for unknown paths.

## 2026-11-05 — Public React member registration

Owner requested React signup in addition to Flutter. Add /signup and /register alias; keep /login as console entry and continue blocking members from console screens. Reuse the existing signup API without role selection or OTP. Successful registration keeps the member cookie session and shows account-ready guidance. Existing authenticated users do not get a second-account registration form until signing out.

## 2026-11-06 — Live scanner and attendance accounting

Use one shared authenticated check-in API for Admin and assigned Staff. PostgreSQL owns atomic counter updates, effective attendance uniqueness and retained correction facts. Persist operation identities separately from attendance so transport retries cannot debit twice or recreate cancelled attendance. QR payloads remain ephemeral; only hashes and approved result fields are stored. Use bounded transaction-conflict retries and serialize authorization changes with scans. React uses lazy ZXing camera/local-image decoding, explicit unknown-outcome retry and no offline queue. Public history/backfill/cancellation workflows remain a separate increment.

## 2026-11-06 — Attendance history visibility

Implement read-only Admin directory and own-account history first. Preserve Staff's PRD scope of assigned sessions and scanning; do not grant general member-history browsing. Filter by immutable session meetup date for Yangon calendar ranges and paginate with an occurrence/id tie-break. Keep corrections visible with event and recording metadata; public correction actions follow separately.

## 2026-11-06 — Historical backfill and explicit UTC connections

Allow Admin to backfill strictly past Yangon meetup dates, including closed sessions, using actual occurredAt and a required audit reason. Validate membership against the historical event date and current remaining quota; reject currently cancelled memberships and disabled accounts. Reuse the live transaction, locking, SQL accounting and operation namespace. No new database model is needed. Keep cancellation UI/API for the next increment.

Explicitly set Prisma/pg connection timezone to UTC. Native PostgreSQL verification on a server defaulting to Asia/Yangon found that otherwise a midnight event could be stored with the wrong instant despite a matching Prisma round trip. Assert actual stored UTC time using an independent pg connection in integration tests.

## 2026-11-06 — Reasoned attendance cancellation

Use immutable attendance ID as the natural cancellation idempotency key. Preserve original reason/actor/time, return ALREADY_CANCELLED on repeats, and never refund or audit twice. Return current locked original-membership balance rather than a cached result. Admin may correct disabled targets or cancelled/expired terms; corrections do not reactivate terms or credit replacements. Serialize account authorization, plan/session, membership and attendance changes, retaining audit/refund atomicity and bounded conflict retries. Reuse the existing SQL cancellation foundation without a migration.

## 2026-11-06 — Member-only assignment and shared dropdown design

Owner clarified that Admin/Staff accounts must not receive new memberships. Restrict assignment/renewal recipients to currently enabled Members, checking under account locks and filtering the picker. Keep existing data for review rather than silently deleting records.

Replace browser-native console select menus with a shared Radix Select control, preserving keyboard behavior, empty filter values and form names/defaults. Keep portals in the native dialog and separate scrolling form content from the fixed dialog heading. Show the current page plus account name in the header to remove duplicate Admin text.
