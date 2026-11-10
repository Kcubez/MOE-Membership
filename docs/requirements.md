# Product Requirements — SRS v3

## Source and authority

English implementation summary of `MOE_Membership_SRS_v3.docx`, version 3.0, dated 2 November 2026. Source location supplied by the owner: `/Users/kcube/Downloads/MOE_Membership_SRS_v3.docx`. This supersedes the earlier invitation-based PRD. The original document is not bundled here. Resolve ambiguities with the owner before implementing dependent behavior.

## Phase 1 developer handoff

The owner supplied `/Users/kcube/Downloads/MOE_Phase_1_Developer_PRD.docx`, based on SRS v3, and confirmed on 4 November 2026 that the new PRD status rule applies. It supersedes the earlier Expired-before-Completed precedence. Prior explicit decisions remain in effect unless the owner changes them.

The handoff assigns the shared backend/API and responsive Admin/Staff web/scanner to the backend developer. The Flutter developer owns member mobile screens and Flutter Web hosted over HTTPS for Telegram Mini App entry. LMS, enrollment, payments integration, ManyChat, invitations, booking, and offline scan synchronization are future scope.

## Scope and roles

- Member: signup/login, profile and personal QR, plans, dates, total/used/remaining visits, attendance history, password and language settings.
- Admin: accounts, staff, password resets, disabling accounts, plans, memberships, renewals/cancellation, meetup sessions/assignments, scanning, backfill, attendance cancellation, reports, exports, audit history.
- Staff: assigned sessions and scanning only; limited member identity/eligibility data. No quota/date edits, attendance backfill/cancellation, or full exports.
- Telegram Mini App and separately developed Flutter app share accounts and data. Admin/Staff use responsive web pages.
- Excluded: online payments, invitation signup, booking, courses/videos, ManyChat, and offline scan synchronization. Payments remain manual through the Page.

## Accounts

- Signup requires full name, phone number, and password. Normalize equivalent phone formats; one account per normalized phone.
- Admin can create accounts with a temporary password. First login requires changing it; reuse existing Member accounts for existing phone numbers. Staff accounts require a unique email address. Admin and Staff sign in with email/password. Email is a login identifier, and Gmail is accepted without an invite or verification flow.
- Both member clients use phone/password login. Telegram identity does not establish membership ownership.
- Members can change passwords. Forgotten passwords are reset by Admin after manual identity verification through the Page.
- Admin password reset or account disable invalidates prior sessions. Disabled members cannot check in; disabled staff cannot scan.

## Plans and memberships

- Plan templates contain name, description/benefits, and total visits of at least one. No start/end dates or duration.
- Archiving a plan prevents new use while retaining previous memberships and history.
- Admin can move plans to Trash and restore their prior availability. Only plans without linked memberships or meetup sessions can be permanently deleted. Plan Trash actions retain audit entries.
- Admin selects an existing user/plan and explicitly supplies both membership dates. Never autofill or calculate dates; end date cannot precede start date.
- Copy the plan quota into the membership at assignment; initially used visits are zero. Editing a plan does not change assigned quotas/dates.
- Membership edits require reason, actor, timestamp, before/after values. Total visits cannot fall below effective used visits.
- Different plans may coexist. The same user's memberships for the same plan cannot overlap.
- Renewal creates a new period with explicitly entered dates; preserve old history and never carry unused visits forward.
- Remaining visits = membership total visits minus effective, non-cancelled attendance count.
- One successful check-in consumes one visit.
- Dates follow Asia/Yangon; start date is inclusive and eligibility lasts through the end date's final instant.
- Status precedence: Cancelled > Completed (zero remaining) > Expired (past end date with visits remaining) > Upcoming > Active. A non-cancelled term with zero remaining visits stays Completed even after its end date. Completed and Expired terms are both ineligible for check-in.

## QR and scanner

- Every account receives a personal QR, even without a membership. One QR identifies a user across all plans and both member clients.
- QR identifies a member only; it is not a login credential and does not grant public access to member data.
- Only authenticated Admin or assigned Staff may scan. Select the relevant plan/session before scanning.
- Scan results show name, member number, and photo if available so staff can verify the person. Static QR screenshots can be shared.
- Admin may regenerate a QR; the previous QR becomes invalid.

## Meetup sessions and attendance

- Admin creates sessions with plan, name, meetup date, and open/closed state, and assigns Staff per session.
- Check QR, actor access/assignment, account state, open session, relevant membership, dates, quota, and existing attendance before committing check-in.
- Deduct only from the selected session's plan. Repeat scans for the same membership/session return Already Checked In and the original time without another deduction.
- Return member, plan, session, check-in time, used and remaining visits on success. Reports and member history agree.
- Invalid QR, disabled account, missing membership, upcoming/expired/cancelled membership, zero visits, or closed session must cause no attendance/quota change.
- Admin may cancel attendance with a reason. Restore a visit once, preserve history, and allow re-check-in if still eligible.
- No internet means no displayed success. Admin may later backfill using the actual session/attendance date, checking eligibility on that date, available quota, and duplicates. Store who recorded it and when.

## Screens, reports, and operations

- Member: signup/login, home, profile/QR, My Plans/detail, history, password, language. No Plan Assigned retains QR and Page contact.
- Admin: users/staff, permissions, plans, memberships, sessions, scanner, corrections, reports, audit trail.
- Staff: assigned sessions, scanner, scan results.
- Dashboard: user totals, active members by plan, today's/session attendance, completed and expired memberships.
- Search/filter by name, phone, member number, plan, status, and dates; filtered Excel export. No payment report.
- History distinguishes scan versus backfill and effective versus cancelled records; retain event date/time and recording actor/time.
- English/Myanmar and responsive phone/tablet/desktop layouts. Protect credentials and QR secrets in logs.
- Daily backups and verified restoration. Initial workload: 300 users, 300 attendees, three simultaneous scanner phones.

## Release acceptance evidence

Verify both member clients share account/QR/plans/history; equivalent phone formats cannot duplicate accounts; dates require explicit entry; quotas/dates remain independent of template edits; inclusive date boundaries work; 10 visits reaches zero after 10 effective check-ins; repeated scans consume once; selected plan alone is charged; staff assignments are enforced; two scanners racing for the last visit produce one success; cancellation refunds once; old QR fails after rotation; offline scans never claim success; backfill and re-check-in preserve history and accounting.

## Confirmed decisions — 3 November 2026

- Accept Myanmar phone numbers initially; canonicalize to +95 and enforce uniqueness after normalization.
- Cancelled memberships do not block overlapping replacement periods; non-cancelled periods still cannot overlap for the same user/plan.
- Live scans are allowed only on the session meetup date in Asia/Yangon. Admin may backfill actual historical attendance.
- Profile photos are optional; uploads follow core membership and attendance implementation.

## Remaining clarifications before dependent implementation

- Profile photo upload limits/storage and retention policy.
- Whether eligibility errors may reveal member identity to an assigned scanner.

## Confirmed console route decision — 5 November 2026

React hosts Admin/Staff sign-in at `/console/login` and Member sign-in at `/login`. Member registration is at `/signup`. Flutter uses the shared API. Personal QR belongs to the member workspace.

## React signup addition — 5 November 2026

Owner additionally requested a React member signup page. Expose /signup with name, Myanmar phone, password and client-side confirmation, using the existing member-only signup API and no OTP. Keep Admin/Staff console access separate. Registration provisions the account/QR but does not assign a membership; successful member sessions receive guidance to use the member app. This supersedes the earlier decision to host signup UI only in Flutter.

## Owner correction — membership recipient roles

New membership assignments and renewals are restricted to currently enabled Member-role accounts. Admin and Staff accounts are not eligible recipients. Recheck role on the server under the target-account lock, not only in the picker. Existing records are retained for review/correction; do not silently delete or cancel historical data.
