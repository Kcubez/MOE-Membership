# Release readiness — 6 November 2026

## Decision

The code is a candidate for a configured Vercel staging deployment. It is not yet a verified production release. No Vercel deployment or hosted build was performed during this review.

Use separate Vercel projects rooted at `apps/web` and `apps/api`, with Node 24 and access to the workspace root lockfile. Follow [deployment.md](deployment.md) for environment variables, same-site authentication domains or a same-origin API proxy, migrations, and hosted acceptance checks.

## Verified locally

- API test suite: 13 passed, 0 failed, 0 skipped against isolated PostgreSQL. Coverage includes authentication, permissions/revocation, member-only membership assignment, membership periods, attendance/quota transactions, concurrent requests, idempotency, historical backfill, and cancellation/refunds.
- ESLint, both workspace TypeScript checks, formatting, and both production builds passed.
- A separate temporary source copy without local `.env` files passed `npm ci`, Prisma Client generation, and both production builds. This is a local clean build, not a Vercel build.
- Member browser regression passed: page URLs, reload, Back/Forward, QR display, memberships/history, mobile menu, and logout.
- Admin browser regression passed: member-only assignment picker, custom select keyboard/clear behavior, dialog Escape behavior, form submission, Myanmar/mobile layouts, and page-aware header.
- Scanner browser regression passed: permission denial, image decoding with API check-in, duplicate quota protection, simulated camera decoding, lost-response retry, stream cleanup, offline/navigation handling, and Myanmar/mobile layouts. Physical phone cameras and Flutter clients were not tested.
- Production dependency audit reported 0 known advisories at review time. The full dependency audit reported 7 moderate entries in the development-only TypeScript ESLint/minimatch chain; these remain to be resolved with a compatible tooling update. Zero production advisories is not a complete security guarantee.

## Changes made during review

- Added Vercel web configuration with SPA fallback, so direct member/console URLs can resolve on static hosting.
- Added native NestJS Vercel configuration with Prisma generation before the API build.
- Production configuration now requires explicit HTTPS browser origins instead of inheriting development defaults; covered by a configuration test.
- Member screens now load lazily, separating QR/scanner dependencies from the initial screen bundle.
- Documented cookie/domain constraints, environment setup, and controlled migration steps. Ignored local `.vercel` metadata.

## Required before production approval

1. Configure staging database, stable server secrets, API URL, and exact trusted browser origins. Use same-site HTTPS web/API domains or a configured same-origin proxy; unrelated hosting domains require further cookie validation.
2. Apply reviewed migrations through a controlled release command, then deploy both projects and test cold start, health, login/session/logout, revocation, direct URLs, and attendance retry/concurrency on the hosted endpoints.
3. Verify connection budgets and client IP/rate limiting behind the host, plus logs and error monitoring without sensitive data.
4. Test actual Android/iOS camera permission/scanning and intended Flutter/Telegram clients on HTTPS.
5. Verify backups and a restore procedure before using real production data.
6. Confirm release scope: reports/Excel export, attendance dashboard metrics, and the global audit browser remain unfinished. Existing attendance history is available.

## Remaining build warning

Vite reports an initial minified JavaScript chunk of approximately 509 kB (144 kB gzip), slightly above its 500 kB warning threshold. Builds pass; further console code splitting is a performance follow-up.

## Hosting references

- [Vercel NestJS support](https://vercel.com/docs/frameworks/backend/nestjs)
- [Vercel Vite support](https://vercel.com/docs/frameworks/frontend/vite)
