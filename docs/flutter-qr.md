# Flutter personal QR handoff

Call `GET /api/v1/members/me/qr` with the existing signed session bearer token. Native calls use Authorization: Bearer; browser clients use the configured HttpOnly session cookie. The identity is resolved server-side, with no userId input. Temporary-password accounts must change their password and sign in again first. Disabled/revoked sessions cannot fetch QR.

Response fields: payload (opaque string), format (`moe-member-v1`), version (integer), updatedAt (ISO timestamp), name and memberNumber. Render the entire payload exactly as returned with a four-module quiet zone, high contrast and medium error correction. Do not trim, parse/rebuild or sign it on the client. It is not a URL and not an authentication token. The same account obtains the same current payload from web/mobile even with zero memberships.

Keep it in current-screen memory. Do not put QR payloads in logs, analytics, crash reports, URLs or persistent client storage. Respect private/no-store. On refresh or screen re-entry, call the API again. Admin regeneration changes the payload; a stored screenshot of the previous code must fail future scanning. Add loading/error/retry states; do not show a stale QR as a fresh server response after a request fails.

401: sign in again. 403: access/temporary-password restriction. 503: show temporary unavailability and allow retry. Admin metadata/rotation/history routes are separate, documented in OpenAPI, and do not expose payloads.

Displaying this QR establishes no check-in, plan eligibility or visit deduction. Admin/assigned Staff can now POST `/api/v1/sessions/{id}/check-ins` with `{ requestId, qrPayload }`; see the local OpenAPI CheckInInput/CheckInResult contracts. Generate one UUID per deliberate scan and reuse it after an unknown network outcome. Show success only after backend confirmation. Physical camera/device acceptance and Flutter integration remain pending.

## Own attendance history

GET `/api/v1/members/me/attendance` returns `{ items, nextCursor }`; use the returned cursor unchanged for the next page. Optional `limit` (1–100, default 20), `from`/`to` (inclusive Yangon meetup dates), `status` (`effective`/`cancelled`), `method` (`scan`/`backfill`), `planId`, `sessionId`, `membershipId`, and `search` are supported. Owner is always the authenticated account; supplying userId is rejected. Attendance includes event time, recorded time/actor and retained cancellation metadata. Times are ISO UTC; display in Asia/Yangon. Treat cancelled records as history, not visit usage. See AttendanceRecord in the OpenAPI contract.

Cancelled history retains the original event and recording details plus cancellation reason/actor/time. Admin can now cancel through `/api/v1/admin/attendance/{id}/cancel`; member and Staff clients cannot call it. A refunded visit does not change term dates or reactivate a cancelled membership. Refresh membership balances after correction; a fresh eligible re-check-in has a different attendance ID. Old check-in/backfill request identities must never be reused to create a fresh check-in.
