# Deployment and Recovery

## Status

Neon development connectivity and the auth schema are configured locally; no application hosting or production deployment has been completed. A GitHub Actions foundation-check workflow exists but has not run remotely. Vercel deployment configurations are prepared for separate web/API projects; Neon PostgreSQL is selected. Hosted behavior is not verified yet. This checklist describes production work still to complete.

## Environments and configuration

- Separate development, staging, and production databases/branches, credentials, and app secrets. Do not copy production PII into previews.
- Choose compatible supported Node and Prisma v7 versions, pin packages, and use a committed npm lockfile.
- Maintain `.env.example` with placeholders when configuration names are finalized. Proposed configuration includes database runtime/migration URLs, allowed web origins, public API URL, auth secrets, QR signing secret, support URL, and optional object-storage settings.
- Anything exposed through Vite client variables is public. Keep database/auth/encryption secrets on the server.
- Place API and database in nearby regions. Configure TLS verification, connection pooling, connection budgets, and network access.
- Keep QR signing secrets recoverable and versioned without storing them beside database backups; document key rotation.

## Hosting options

- React/Vite: static hosting with SPA route fallback and HTTPS.
- NestJS: a Node service/container, or a supported function deployment with an adapter/configuration verified for that host.
- Neon: external PostgreSQL; use its appropriate pooled/runtime and migration connections and verify required extensions.
- Profile photos, if implemented: durable object storage with access rules, size/type limits, and its own backup/retention policy.
- Browser scanning requires HTTPS and device camera permission. Test actual deployment domains and browser policies.

## Build and release

Use the root npm scripts documented in README. Prisma Client generation must precede typechecking/building on a clean checkout. Use `npm run db:deploy -w @moe/api` for reviewed migrations after baselining any existing database.

1. Install from lockfile; lint, typecheck, and run focused tests plus PostgreSQL integration checks.
2. Generate Prisma Client; review and validate versioned migrations, including custom SQL constraints.
3. Build web and API. Use staging credentials only for staging checks.
4. Back up production and review schema/data compatibility before a migration.
5. Run production migrations once through a controlled release task; do not run `db push`, destructive seeds, or per-request migrations.
6. Deploy compatible code, run health/readiness and auth/attendance smoke checks, and monitor failures.

Use expand/contract changes where needed so an application rollback does not depend on undoing destructive schema changes. A code rollback does not automatically roll back a database migration.

## Neon availability and recovery

Verify the selected plan's compute limits, scale-to-zero behavior, backup retention, and restore capabilities at purchase/release time. Do not assume the Free plan meets daily backup and production attendance requirements. Define recovery point and recovery time targets with the owner.

Schedule encrypted database backups at least daily as required by SRS; document whether provider recovery plus independent logical backups meets those targets. Restrict access and test restoration to a separate database. Verify counts, relationships, auth configuration, QR signature verification, and representative memberships/attendance after restore. Keep backup monitoring and recovery instructions available outside the database being protected.

## Monitoring and readiness

- Structured logs with request correlation IDs; redact passwords, tokens, database URLs, and PII.
- Error tracking, health checks, database pool monitoring, failed-deployment alerts, and backup failure alerts.
- Private or appropriately restricted administrative API documentation; rate limits on auth and sensitive endpoints.
- Verified forced password changes and session revocation; provision the first Admin through a controlled mechanism.
- Test three concurrent scanners, last-visit races, ambiguous network retries, real iOS/Android cameras, and Telegram member screens.
- Document account/password recovery, attendance correction, QR rotation, and incident response in the admin handover.

## Vercel staging configuration

Create two projects from the same repository. Enable access to source files outside each Root Directory for npm workspaces. Use Node.js 24.x and install from the root lockfile. Do not deploy this monorepo as a single automatically detected frontend project.

| Setting        | Web project   | API project                          |
| -------------- | ------------- | ------------------------------------ |
| Root Directory | apps/web      | apps/api                             |
| Framework      | Vite          | NestJS                               |
| Build          | npm run build | npm run db:generate && npm run build |
| Output         | dist          | Framework default                    |

Each root contains vercel.json. Web rewrites enable refresh/deep links such as /member/qr and /console/sessions. The API uses the recognized src/main.ts NestJS entrypoint. Prisma generation is explicit because generated files are ignored in source control. No migrations or bootstrap run in the request handler or Vercel build. Apply reviewed migrations separately before testing a new staging database. Keep bootstrap credentials local and remove them after provisioning.

### Browser authentication domain requirement

Current auth uses secure HttpOnly cookies and SameSite=Lax in production. Use HTTPS frontend/API subdomains under the same registrable domain (for example app.example.com and api.example.com), or configure and test a same-origin /api reverse proxy before using unrelated domains. Two independent *.vercel.app sites or a Vercel frontend calling an unrelated DigitalOcean hostname are not a verified cookie-auth setup. Do not work around this by putting bearer credentials in localStorage or disabling CSRF checks.

Web environment: VITE_API_BASE_URL=https://api.example.com/api/v1 (public). API environment: NODE_ENV=production, DATABASE_URL=pooled Neon URL, DIRECT_URL=direct migration URL, BETTER_AUTH_SECRET=stable random 32+ character secret, QR_SIGNING_SECRET=stable separate 32+ character secret, AUTH_BASE_URL=https://api.example.com, WEB_ORIGINS=https://app.example.com. Include exact staging origins separately; do not use wildcard trusted origins. Avoid changing an existing signing secret without planning QR regeneration.

For a same-origin reverse proxy, keep VITE_API_BASE_URL=/api/v1, put the external /api/:path* rewrite before the SPA fallback, and verify Set-Cookie, Origin and logout over the actual deployment. The API destination must be the real API deployment/domain; it is deliberately not guessed in the checked-in SPA config.

### Hosted acceptance still required

A local build is not evidence of a successful Vercel deployment. Verify cold start, API health, database connection limits, cookie persistence after reload, signup/login/logout, forced-password changes, role isolation, own QR/plans/history, assignment, session creation, scanner/check-in, backfill/cancellation and duplicate/last-visit races against staging. Test Android/iOS camera access over HTTPS. Reports, dashboard attendance metrics and global audit browsing are still unfinished product features. Daily backup/restore and production monitoring require operational setup.

References: https://vercel.com/docs/frameworks/frontend/vite and https://vercel.com/docs/frameworks/backend/nestjs.
