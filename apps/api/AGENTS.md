# API Instructions

- Follow root `AGENTS.md`; load the Postman API engineering guidance before non-trivial API work.
- Organize NestJS modules by feature, not by web/mobile client. Controllers handle transport; services own business rules.
- Validate all inputs and output only approved fields; reject mass assignment of roles, ownership, quota, and audit attributes.
- Resolve the actor from authenticated context. Enforce role and session-assignment checks in backend operations.
- Use reviewed Prisma v7 migrations including custom SQL constraints; never initialize/reset production data.
- Serialize check-in, quota edits, and attendance cancellation on the affected membership; use bounded retries for retryable transaction conflicts.
- Retain attendance correction history. Enforce uniqueness only for effective attendance so cancelled attendance can be checked in again.
- Admin backfill validates the actual attendance date and current available quota; preserve both occurrence and recording timestamps.
- Password resets/account disabling revoke existing access, including any cached session checks.
- Add real PostgreSQL integration tests for last-visit races, duplicate requests, double cancellation, and overlap constraints.
- Backend scripts live in apps/api/package.json; use npm run dev:api from root.
