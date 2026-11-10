# Flutter API quick start

## Addresses and scope

Direct API base URL: `https://moe-membership-api.vercel.app/api/v1`.
After deploying this change, browser documentation is at `https://moe-membership-api.vercel.app/docs` and the JSON specification at `/docs/openapi.json`. Local documentation uses the API port, normally `http://localhost:3000/docs` (or port 4000 when configured).

The canonical contract is `postman/specs/openapi.json`. Postman collections live in `postman/collections`. Swagger is read-only; use Postman with isolated test data for writes. Never test destructive account or attendance changes on real members.

Implemented: member phone/password and console email/password auth, own profile/QR/memberships/history, Admin account/plan/membership/session management, assigned Staff scanning, Admin backfill and cancellation. Reports/export and global audit browsing remain pending. Native Flutter integration and physical-device camera acceptance still need verification.

## Native Android/iOS authentication

Use HTTPS and JSON. Native requests send `X-MOE-Client: mobile`; do not attach browser cookies or a fabricated Origin. Authenticated requests also send `Authorization: Bearer <token>`. Store the token in platform secure storage, never logs or analytics. Flutter web uses browser cookies and the same-origin proxy/domain setup described in deployment.md instead of this native flow.

1. `POST /auth/signup` with `{ "name": "Test Member", "phone": "<test Myanmar mobile>", "password": "<test password>" }`, or `POST /auth/login` with `{ "phone": "<test Myanmar mobile>", "password": "<test password>" }`.
2. A successful native login/signup returns `{ "user": { "id": "...", "name": "...", "phone": "+959...", "role": "member", "mustChangePassword": false }, "token": "<secret session token>" }`. Save the token; route by server-returned role. Never send a role during public signup. No OTP is used and signup does not assign a plan.
3. If `mustChangePassword` is true, call `POST /account/password` with `{ "currentPassword": "...", "newPassword": "..." }`. All sessions are revoked; clear the token and sign in again. Business APIs are blocked until this step is complete.
4. `GET /auth/session` restores current identity. `POST /auth/logout` revokes the current session; clear the local token after confirmed logout. Password resets and disabled accounts can revoke access at any time.

Example request (replace placeholders locally):

```http
GET /api/v1/members/me HTTP/1.1
Host: moe-membership-api.vercel.app
X-MOE-Client: mobile
Authorization: Bearer <token>
Accept: application/json
```

## Member screens

Call `GET /members/me` for profile, `GET /members/me/qr` for personal QR, `GET /members/me/memberships` for terms, and `GET /members/me/attendance` for history. Use the exact response schemas in Swagger. Own-account identity is derived from the session; do not add a userId parameter. An empty membership list is a valid No Plan Assigned state, and the member can still view QR.

Render the entire returned QR payload unchanged with a four-module quiet zone and high contrast. Keep it only in current-screen memory. It is not a login token. Reload after Admin regeneration; an old screenshot must no longer work. See [QR handoff](flutter-qr.md).

Membership status precedence is Cancelled, Completed, Expired, Upcoming, Active. Display the server's balance/status rather than independently granting eligibility. Calendar dates are inclusive Asia/Yangon dates; event timestamps are ISO instants to display in Myanmar time.

History returns `{ "items": [], "nextCursor": null }` when empty. When nextCursor exists, pass it unchanged as cursor for the next page; limit is 1–100. Cancelled attendance remains visible and does not consume a visit. Refresh balances after corrections.

## Staff scanner

Staff sign in through `POST /auth/login` with `{ "email": "<staff email>", "password": "<password>", "portal": "console" }`. Admin uses the same payload. Follow the password replacement step above when `mustChangePassword` is true.

Call `GET /sessions`; Staff receive only assigned sessions. Choose an open session whose meetup date is today in Asia/Yangon. Decode QR locally, then `POST /sessions/{id}/check-ins` with `{ "requestId": "<new UUID>", "qrPayload": "<scanned payload>" }` and the native auth headers above.

Pause decoding during requests. Show success only after the API confirms it. A timeout can occur after the server committed: retry with the exact same requestId, session and payload. Never generate a new ID for an uncertain retry. A fresh deliberate scan uses a new UUID. Duplicate attendance does not debit another visit. Do not queue offline scans; stop camera tracks on leaving/backgrounding the screen.

## Errors and handoff checklist

- 400: inspect validation/error code and let the user correct inputs.
- 401: clear stale identity and ask the user to sign in again.
- 403: check role, disabled state, forced-password change or trusted-origin rules. Do not repeatedly retry.
- 409: show the domain reason (duplicate, quota, overlap, version or idempotency conflict); refresh relevant state.
- 429: back off; do not run a rapid retry loop.
- 503/network failure: offer retry for reads. For writes, resolve uncertain outcomes first; scan retries must retain requestId.

Responses may use `code`, or validation `message`/`statusCode`; consult each endpoint contract. Do not treat every failure as an expired session.

Before handoff, prepare synthetic Member and assigned Staff accounts, a plan, a membership with available visits and a session for today's Yangon date in a dedicated staging database. Verify login, forced password replacement, profile/QR, pagination, successful/duplicate scan, quota exhaustion, revoked session and logout. Test accounts and secrets are supplied privately; none are embedded in this document.
