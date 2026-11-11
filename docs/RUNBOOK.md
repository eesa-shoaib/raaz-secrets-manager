---
tags: [runbook, deployment, recovery, operations, mvp2]
---

# Raaz Operations & Recovery Runbook

Authoritative operator guide for deploying, verifying, backing up, restoring,
and operating a hosted Raaz MVP 2 instance (Vercel + Render + MongoDB Atlas).

## 1. Deployment Topology

Recommended production topology keeps the SPA and API **same-site** so auth
cookies remain first-party without relying on third-party cookie exemptions:

- **Option A — Same-site subdomains (recommended):**
  - SPA on Vercel at `https://app.example.com`
  - API on Render at `https://api.example.com`
  - Backend env:
    - `NODE_ENV=production`
    - `CLIENT_ORIGIN=https://app.example.com`
    - `COOKIE_SAMESITE=Lax`
    - `COOKIE_DOMAIN=.example.com`
    - `TRUST_PROXY=1` (1 hop: Render reverse proxy)
  - Client env:
    - `VITE_API_BASE_URL=https://api.example.com/api`
  - Update `client/vercel.json` `connect-src` from `'self'` to
    `'self' https://api.example.com`.

- **Option B — Same-origin Vercel `/api/*` rewrite:**
  - SPA on Vercel at `https://app.example.com`
  - Render backend at `https://raaz-api.onrender.com`
  - Add a Render rewrite rule in `client/vercel.json` ahead of the SPA
    fallback (`"source": "/api/:path*", "destination": "https://raaz-api.onrender.com/api/:path*"`)
  - Backend env:
    - `NODE_ENV=production`
    - `CLIENT_ORIGIN=https://app.example.com`
    - `COOKIE_SAMESITE=Lax`
    - Leave `COOKIE_DOMAIN` unset (host-only cookie on Vercel origin)
    - `TRUST_PROXY=2` (2 hops: Vercel rewrite + Render proxy; verify via `req.ip` logs so per-IP rate limiters neither read proxy IPs nor spoofable headers)
  - Client env:
    - `VITE_API_BASE_URL=/api`

- **CSP and cache headers:**
  - `client/vercel.json` ships a strict `Content-Security-Policy` referencing
    the `client/index.html` title-bootstrap inline script by exact SHA-256 hash
    (`'sha256-6zvHRTnWnumRA79SzEClncEe2pylk2sI00HwVIriHpA='`), plus
    `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
    `Referrer-Policy: strict-origin-when-cross-origin`, and
    `Cache-Control: no-store` on `index.html` and `/api/(.*)`.
  - Express API sets `Cache-Control: no-store` / `Pragma: no-cache` on all `/api`
    JSON responses (avatar downloads override to `private, no-cache`).

## 2. Production Environment Variables & Bootstrap

Never commit, echo, or paste secret values from `.env`, CI artifacts, or logs.

- **Required server variables (`server/.env` / Render Dashboard):**
  - `MONGO_URI` — Dedicated hosted Atlas replica-set URI (never reuse a dev/test database)
  - `JWT_SECRET` — Cryptographically random string (>= 32 chars)
  - `MASTER_KEY` — 32-byte base64 AES-256-GCM key (`openssl rand -base64 32`)
  - `MASTER_KEY_VERSION` — Positive integer (must match secrets stored in Atlas)
  - `CLIENT_ORIGIN` — Exact browser origin (mandatory in `production`)
  - `TRUST_PROXY` — Exact non-negative reverse-proxy hop count (`1` direct Render, `2` behind Vercel rewrite)
- **Initial Platform Admin bootstrap (first boot only):**
  1. Set `PLATFORM_ADMIN_EMAIL` and `PLATFORM_ADMIN_PASSWORD` (8–72 chars).
  2. Deploy and verify `GET /api/health` returns `200 { "status": "ok" }` and log in as the seeded Platform Admin.
  3. **Immediately unset `PLATFORM_ADMIN_EMAIL` and `PLATFORM_ADMIN_PASSWORD`** from Render environment variables and redeploy.
- **Seed script safety:**
  - `server/scripts/create-mock-data.mjs` refuses non-local `MOCK_API_URL` targets unless `ALLOW_NONLOCAL_MOCK_DATA=true` is explicitly set. Never run mock/seed scripts against production.

## 3. Health Checks & Post-Deploy Smoke Checklist

1. `GET /api/health` -> `200` with `{ "status": "ok" }`, `Cache-Control: no-store`.
2. Sign in from `CLIENT_ORIGIN` -> cookie is `HttpOnly; Secure; SameSite=Lax`.
3. `POST /api/projects` without `Origin` or from a foreign `Origin` -> `403`.
4. Confirm secret create -> masked list (`••••••••`) -> production reveal prompt (`confirm: true`) -> hide -> 30s auto-hide -> `AuditLogEntry` persisted.
5. Trigger rate limiter on `/api/auth/login` -> `429` applied against client IP (proving `TRUST_PROXY` hop count is accurate).

## 4. Backup, Key Custody & Restore Rehearsal

Secrets encrypted with AES-256-GCM cannot be decrypted from a database backup
alone: recovery requires **both** the encrypted database backup and the exact
`MASTER_KEY` + `MASTER_KEY_VERSION` stored in a separate password/KMS vault.

- **Key custody & retention:**
  - Store `MASTER_KEY`, `MASTER_KEY_VERSION`, and `JWT_SECRET` in an access-controlled operator password manager / cloud KMS separate from Atlas backups.
  - Enable Atlas automated encrypted snapshots (or scheduled encrypted `mongodump --archive --gzip`) covering **all** collections including `secrets`, `users`, `useravatars`, `projects`, `projectmemberships`, `auditlogentries`, and `platformconfigs`.
- **Rehearse recovery (`server/scripts/rehearse-recovery.mjs`):**
  - Verify crypto & snapshot contract locally without DB:
    `node server/scripts/rehearse-recovery.mjs --dry-run`
  - Rehearse live end-to-end collection export/restore into an isolated disposable database (`raaz_recovery_*`):
    `RECOVERY_MONGO_URI="mongodb+srv://.../<disposable_db>" node server/scripts/rehearse-recovery.mjs`
  - Confirms restored `Secret` documents decrypt identically using `AAD = projectId|secretId|environment|encryptionKeyVersion`, `UserAvatar` binary digests match, and `AuditLogEntry` records remain intact.

## 5. Incident Response & Rollback Procedures

- **Deactivate compromised account:**
  - Platform Admin navigates to `/admin/users` (or calls `PATCH /api/admin/users/:userId` with `{ "isActive": false }`). Setting `isActive: false` increments `tokenVersion`, failing active JWT cookies on the next request (`401`). Historical audit attribution remains intact.
- **Forgotten password / locked-out user:**
  - MVP 2 supports authenticated password change (`POST /api/auth/change-password`) only; there is **no** email reset or unauthenticated bypass endpoint. Verified team members who lose credentials must be deactivated (`isActive: false`) and re-onboarded under a new account or assisted only after explicit identity verification via operator database/admin workflow.
- **Suspected secret exposure:**
  1. Immediately rotate the external credential at the upstream provider (e.g., Stripe, GitHub, database password).
  2. Update the value in Raaz via `PATCH /api/projects/:projectId/secrets/:secretId` (issues fresh random IV and records an audit entry).
  3. Review `GET /api/projects/:projectId/audit-log` (filtered by environment/action/result) to establish access timeline.
- **Suspected `MASTER_KEY` compromise:**
  - Immediately revoke all upstream credentials stored in Raaz, rotate infrastructure secrets, provision a fresh `MASTER_KEY`, and re-encrypt/re-create affected secrets in a fresh deployment (key rotation in-place is out of MVP 2 scope).
- **Release rollback:**
  1. Promote the previous verified Vercel deployment from the Vercel dashboard.
  2. Re-deploy the previous known-good Render commit/image.
  3. Verify `GET /api/health` and run read-only smoke verification (list projects/secrets, audit log). Note: do not run destructive schema drops during rollback.
