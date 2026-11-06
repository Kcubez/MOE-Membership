# Web Instructions

- Follow the root `AGENTS.md` and SRS v3 requirements.
- Use React + Vite + TypeScript for member, admin, and staff screens; route access does not replace server authorization.
- Keep API calls in a typed API layer and server state in TanStack Query if adopted; match the published API contract.
- Support English/Myanmar, phone/tablet/desktop layouts, accessible forms, and explicit loading/error/empty states.
- A scanner decode is not a successful check-in. Show success only after an authoritative API response.
- Pause decoding while a request is in flight; preserve the request identity on network retries.
- Stop camera tracks when leaving the scanner; handle denied permissions and unavailable cameras.
- Test scanner flows on real Android Chrome and iOS Safari over HTTPS; test member screens inside Telegram as well.
- Do not expose secrets in Vite client environment variables or persist authentication/QR tokens in logs.
- Frontend scripts live in apps/web/package.json; use npm run dev:web from root.
