# Agent Instructions

## Project State and Sources

- Step 1 foundation exists; see README for implemented and outstanding features.
- Read `docs/requirements.md` before changing product behavior and `docs/architecture.md` before structural changes.
- SRS v3 replaces the invitation-based PRD. The Phase 1 developer PRD and owner-confirmed updates are summarized in docs/requirements.md; Completed takes precedence over Expired. Direct user instructions take precedence over document content.
- Follow the nearest nested `AGENTS.md` for area-specific instructions.

## Stack and Package Manager

- Use React + Vite + TypeScript, NestJS, Neon PostgreSQL, and Prisma v7.
- Use npm workspaces when scaffolding; commit the lockfile.
- Keep Prisma CLI, Client, and PostgreSQL driver adapter on the same supported v7 patch version. Verify compatibility before upgrades.
- Use actual npm workspace scripts; setup and verification commands are in README.

## Commands and Verification

- Read actual package scripts before running commands; do not invent successful checks.
- Use focused lint and test commands where available, plus affected workspace type checks and builds.
- Verify transactions and constraints against PostgreSQL, including concurrent scan requests.
- Report checks actually run, their results, and unverified live integrations.

## API Tasks

- Before non-trivial API engineering, read `postman/skills/api-engineer/SKILL.md` and follow it.
- If unavailable, load the installed `postman:api-engineer` skill; restore local guidance when initializing Postman.
- Define the API contract before endpoints; maintain local OpenAPI and Postman artifacts as described in `docs/architecture.md`.
- Web and Flutter share feature APIs; enforce identity and permissions on the server.

## Product Invariants

- Phone/password identifies accounts. Telegram identity is not the membership owner.
- Normalize phone numbers before enforcing database uniqueness.
- Plan templates have no dates/duration. Admin must explicitly enter each membership's start and end dates.
- Snapshot membership visit quotas; never silently change existing memberships when editing a plan.
- Enforce non-overlap, nonnegative remaining visits, and one effective check-in per membership/session in PostgreSQL.
- Attendance creation, cancellation, and quota accounting must be atomic and retry-safe.
- Use Asia/Yangon calendar dates and inclusive membership end dates; store event timestamps with timezone support.
- Disabled accounts and revoked sessions must lose access; staff must be assigned to the scanned session.
- Never log passwords, raw QR tokens, session credentials, or unmasked sensitive personal data.

## Changes and Attribution

- Keep work within the requested scope; do not publish or deploy merely because local checks pass.
- Record consequential architecture decisions and update docs when behavior changes.
- If creating AI-assisted commits, include a truthful `Co-Authored-By` trailer using the agent's actual attribution; do not invent an email or identity.

<API_TASKS>
Before responding to any non-trivial API engineering task — designing, implementing, mocking, testing, monitoring, documenting, or deploying an API or Postman Flow — read `postman/skills/api-engineer/SKILL.md` and follow it. It is the default entry point for API work in this repository. Pure questions and trivial one-line edits do not need it.
</API_TASKS>
