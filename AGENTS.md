# AGENTS.md — Raaz

Entry point for AI coding agents. Read this first, then open the specific doc
for the area you're touching (map below). This file summarizes; the docs in
`docs/` are authoritative. If this file and a doc disagree, the doc wins and
this file should be fixed.

## What this is

Raaz is a MERN + TypeScript secrets and environment-variable manager for teams.
Its core promise: **some roles can confirm a secret exists without ever being
able to retrieve its decrypted value**, enforced at the data layer, not the UI.

- Frontend: React 18, TypeScript 5, Vite 5, Tailwind 3 + DaisyUI 4, TanStack Query 5, React Router 6, React Hook Form, Axios
- Backend: Node 22, Express 4, Mongoose 8, Zod, bcryptjs, jsonwebtoken, helmet, express-rate-limit, express-mongo-sanitize, pino
- DB: MongoDB Atlas (used locally too — transactions need a replica set)
- Monorepo: npm workspaces (`client/`, `server/`, `packages/shared-schemas/`)
- Tests: Vitest, Supertest (server), React Testing Library (client)

## Where to look (doc map and authority)

| Question                                                            | Source of truth                                                       |
| ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Is X in or out of the MVP?                                          | `PRODUCT.md` → **Cut from MVP** table (single scope authority)        |
| Who can do what?                                                    | `API.md` → **Permissions Matrix** (single access authority)           |
| Endpoint contract, error codes, pagination                          | `API.md`                                                              |
| Schema, indexes, audit `action` enum                                | `DATA_MODEL.md`                                                       |
| Middleware order, auth, encryption, CSRF, rate limits, cache policy | `ARCHITECTURE.md`                                                     |
| Folder layout, module boundaries, naming                            | `PROJECT_STRUCTURE.md`                                                |
| Versions, testing priorities                                        | `TECH_STACK.md`                                                       |
| Routes, widgets, reveal lifecycle, build phases, frontend DoD       | `FRONTEND.md` (authoritative; the widget list is a ceiling)           |
| Task tracking                                                       | `MVP_BOARD.md`                                                        |
| Env vars                                                            | `README.md` (table) and `server/.env.example` / `client/.env.example` |

Docs live in `docs/`. When you add a doc, add it to the index table in `docs/README.md`.

## Commands

The docs don't pin exact script names. These are the conventional names for this
stack; **check each `package.json` first** and add a missing script under the
same name rather than inventing a different one.

```bash
npm install                      # from repo root; installs all workspaces
npm run dev -w server            # tsx watch, http://localhost:5000
npm run dev -w client            # Vite, http://localhost:5173
npm test -w server               # Vitest + Supertest
npm test -w client               # Vitest + React Testing Library
npm run lint                     # ESLint (includes the no-restricted-imports rule)
npm run format                   # Prettier
npm run build                    # production build (part of the MVP DoD)
```

Setup:

1. `cp server/.env.example server/.env` and `cp client/.env.example client/.env`.
2. Required for local dev: `MONGO_URI` (Atlas), `JWT_SECRET` (≥ 32 chars), `MASTER_KEY` (32 bytes, base64), `MASTER_KEY_VERSION` (positive integer).
3. To seed the first Platform Admin, set `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD` (password 8–72 chars) and boot once.
4. The server **exits at boot** with a clear error if keys or origins are invalid (see ARCHITECTURE.md → Session & Auth Policy). Don't weaken those checks to make a run pass.

The dev Atlas database is **disposable by agreement**: drop and recreate it
instead of writing migrations. There is no migration framework. Never point
dev or test runs at a database that holds data anyone wants to keep.

## Architecture rules you must not break

### Module boundaries

- `client/` imports only from `packages/shared-schemas` **package root**. Never `/internal`, never anything from `server/`.
- `server/` never imports from `client/`.
- `packages/shared-schemas` is a leaf: it depends on neither app.
- Server-only schemas (`passwordHash`, `ciphertext`/`iv`/`authTag`) live in `shared-schemas/internal` and are built by **extending** the client-safe schemas. Do not derive client schemas with `.omit()` from the internal ones (the field names would end up in the client bundle).
- Server layering: **routes → controllers → services → models.** Controllers only parse the request and call a service: no crypto, no DB queries, no authorization. **Only services touch Mongoose models.** Middleware calls services (`membership.service`, `audit.service`, `secrets.service`), never models directly.

### Authorization pipeline (order matters)

```
CSRF (Origin check) → authenticate → requireProjectRole | requireProjectRoleOrPlatformAdmin | requirePlatformAdmin → requireProjectStatus → handler
```

- Membership check runs **before** the status check, always. Reversing it leaks the existence of archived projects.
- No membership → `404` (not logged). Member with insufficient role → `403` (logged as a denied `AuditLogEntry` when the action has an `action` enum value).
- Membership routes (`POST/PATCH/DELETE .../members`) use `requireProjectRoleOrPlatformAdmin`, a separate middleware, not a flag on `requireProjectRole`.
- `/admin/*` routes use `requirePlatformAdmin` only; they never return project or secret data.
- Rate limiters: login/signup run before `authenticate` (per IP); reveal runs after `authenticate`, before `requireProjectRole` (per user id).
- The one authorization decision made in the service layer: Developer writes (create/edit) are restricted to `development`, because the environment isn't known until the body or document is loaded. The service writes its own denied audit entry.
- Production reveal without `confirm: true` is `422 VALIDATION_ERROR` and is **not** logged as denied. It's a request-shape check, not a role gate. Don't merge it with the Developer write restriction.

### Secrets and encryption

- Only `POST .../secrets/:secretId/reveal` ever returns a decrypted value. Never add `value` to list, metadata, audit, dashboard, or error responses.
- AES-256-GCM via Node `crypto`. Fresh random 12-byte IV on **every** encrypt, including edits. `authTagLength: 16` set explicitly on decipher.
- AAD on every encrypt/decrypt: `` `${projectId}|${secretId}|${environment}|${encryptionKeyVersion}` ``. On create, generate the id first (`new mongoose.Types.ObjectId()`), use it in the AAD, and insert with that same `_id`.
- If a stored `encryptionKeyVersion` ≠ `MASTER_KEY_VERSION`, decryption fails loudly. There is exactly one active key; rotation is a non-goal.
- `ciphertext`/`iv`/`authTag` and `User.passwordHash` are `select: false`. Login is the only query that opts back in (`.select('+passwordHash')`).
- **Parse responses, don't just type them.** Run `publicUserSchema.parse(...)` / `secretResponseSchema.parse(...)` before sending. Zod strips undeclared keys (never use `.passthrough()`). A TS type alone does not stop a leak.
- The list endpoint's mask is a **fixed-width** placeholder (`••••••••`) regardless of the real value's length.
- Every `:secretId` lookup is scoped: `Secret.findOne({ _id: secretId, projectId })`. Never `findById(secretId)` alone.

### Auth

- JWT in an httpOnly cookie, never in a response body or `localStorage`. `jwt.verify` always passes `algorithms: ['HS256']`.
- `authenticate` re-fetches the user every request: checks signature **and** `tokenVersion`, and rejects `isActive: false` with `401`.
- Login always runs `bcrypt.compare` (against a fixed dummy hash if the email is unknown) and returns the same generic `401` for unknown email, wrong password, and deactivated account.
- Cookie `Secure` follows `NODE_ENV === 'production'`, independent of `SameSite`. `SameSite` is `Lax` in dev, `None` in prod unless `COOKIE_SAMESITE` overrides it.
- State-changing requests (POST/PATCH/DELETE) must have an `Origin` equal to `CLIENT_ORIGIN`; a **missing** `Origin` is a mismatch → `403`.

### Audit log

- State-changing action + its allowed audit entry commit in **one MongoDB transaction**. If the audit write fails, the action fails with `500 INTERNAL_ERROR`. Never report success without the audit record.
- Denied project actions write the denied entry **before** returning `403`; if that write fails, return `500`.
- Entries are append-only: no update/delete endpoint, ever.
- `projectId` is required for project-scoped actions and absent for platform-wide ones. This is enforced in `audit.service`, not in the schema.
- A denial from `requireProjectRole` on a secret-scoped route does one scoped read (`Secret.findOne({ _id, projectId }, { environment: 1, key: 1 })`) purely to populate `environment`/`secretKey` on the entry. Keep it, or the `?environment=production` filter silently misses denied prod attempts.
- Not logged as `AuditLogEntry`: no-membership 404, CSRF 403, non-admin on `/admin/*`, any 429, failed login.

### Last-admin invariants

- Use the atomic counters (`Project.activeAdminCount`, `PlatformConfig.activePlatformAdminCount`) with a conditional `findOneAndUpdate({ ..., count: { $gt: 1 } }, { $inc: { count: -1 } })`. A transaction with a count-then-write check is **not** sufficient (snapshot-isolation write skew).
- Violations return `409 CONFLICT`. Platform Admin invariant covers both demotion and deactivation.

### Logging

- Redact `value` (and `password` on auth routes) from every request-body log and error handler. Configure pino redaction explicitly; it is not a default.
- Never log, print, commit, or echo `MASTER_KEY`, `JWT_SECRET`, `.env` contents, or decrypted values (including in tests, fixtures, and error messages).

## Frontend rules (see FRONTEND.md for detail)

- **Reveal is a `useMutation`, never `useQuery`.** `retry: 0`, `gcTime: 0`, `reset()` on leaving `revealed`. The value lives only in `SecretValueCell` local state: never in the query cache, a query key, URL, web storage, or logs.
- Reveal cell states: `idle → (confirming →) pending → revealed → idle`. Production never sends a request before the dialog's Confirm. Cancel sends nothing. Body is `confirm: false` outside production, `confirm: true` only after Confirm.
- Value clears on Hide, 30 s auto-hide, unmount, environment switch (panel is keyed by environment), and `pagehide`.
- One Axios instance in `client/src/api/`; every failure becomes `ApiError { status, code, message }`. Queries retry once on network/5xx, never on 4xx; mutations never retry.
- 401 chain (de-duplicated): `queryClient.clear()` then navigate to `/login` with `state.reason`. Login and logout own the cache transition; guards never clear it.
- Permissions: one module, `lib/permissions.ts`, `can(role, action, environment?) → 'enabled' | 'disabled' | 'hidden'`, consumed via `usePermissions(projectId)`. No scattered role checks. The UI is a hint; the backend is authoritative.
- **Widget ceiling:** the inventory in FRONTEND.md §2 is complete (25 MVP widgets). Adding one means removing or replacing one. Buttons, inputs, and text compose inline; a "widget" is only a component two developers need a shared name for.
- Don't add: per-type badges/skeletons, theme toggle, stacked-card mobile tables, reveal countdown UI, cross-tab auth sync. See FRONTEND.md §5.

## Scope: what is and isn't in the MVP

MVP ships routes 1–10 (FRONTEND.md §1) and Phases 1–5. **Do not build** the following unless the user explicitly changes scope (and `PRODUCT.md`'s Cut table is updated first):

- Admin UI (`/admin/users`, `/admin/projects`, `/admin/audit-log`) and `RequirePlatformAdmin`. The `PATCH /api/admin/users/:userId` and `GET /api/admin/users` backend endpoints **do** exist.
- Project archive/restore (`Project.status` and `requireProjectStatus` exist and are tested against a directly seeded archived project; nothing sets `archived`).
- Project rename / environment editing (no `PATCH /projects/:projectId`). Environments are always `development`, `staging`, `production`.
- Member change-role/remove **UI**. The backend `PATCH`/`DELETE .../members` endpoints exist (needed for the last-Project-Admin test).
- Audit log pagination (single request, `limit` ≤ 100, no `page`), three filters only (action, result, environment).
- Non-goals: key rotation, secret versioning, service accounts/API tokens, break-glass access, email verification, password reset, per-account login limiters.

`/api` is unversioned; the client uses a single `API_BASE_URL` constant.

## Testing

- Prioritize Supertest on the cells flagged in API.md's "easy to get wrong" list: Developer+staging create/edit (403), Developer+production edit (403), Auditor+reveal (403, denied entry written, `environment` populated), Platform Admin membership substitution, last-Project-Admin invariant.
- Also required: a `:secretId` from Project B used under Project A's URL must `404`.
- Concurrency: only the last-Project-Admin invariant gets a concurrent-request test. Others are sequential.
- Test `requireProjectStatus` against a directly seeded archived project.
- Client: auth tests (login, logout, 401), reveal security test (value absent from caches after unmount), permission-helper conformance test against a fixture transcribed from the Permissions Matrix, small browser smoke suite (login → action → logout; expired session; reveal → hide).
- Don't exhaustively enumerate the whole permission matrix; it's a deliberate trade-off for a two-person team.

## Conventions

| Item             | Rule                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------- |
| React components | `PascalCase.tsx`                                                                        |
| Hooks            | `useThing.ts`, TanStack Query hooks in `client/src/hooks/`                              |
| Server files     | kebab-case with suffix: `.routes.ts`, `.controller.ts`, `.service.ts`, `.middleware.ts` |
| Mongoose models  | PascalCase singular (`Secret.ts`)                                                       |
| Shared schemas   | camelCase file per entity; server-only in `internal/`                                   |
| Tests            | mirror the source file, `.test.ts` suffix                                               |
| Env vars         | `SCREAMING_SNAKE_CASE`                                                                  |

Errors always use the envelope `{ "error": { "code", "message" } }` with the codes in API.md. Request bodies, path params (ObjectIds), and query params are validated with Zod **before** controller logic; a malformed ObjectId is `422`, a well-formed missing id is `404`.

**ESM imports:** Server and shared-schemas use ESM (`"type": "module"`). Relative imports in server source **must include `.js` extensions** (e.g. `import { x } from './x.js'`). `tsx` and `tsc` require this.

## Workflows

**Adding or changing an endpoint**

1. Check `PRODUCT.md` Cut table (is it in scope?) and `API.md` Permissions Matrix (who may call it?).
2. Update `API.md` first if the contract changes (record contract issues there, not in code comments or FRONTEND.md).
3. Add/adjust the Zod schema in `shared-schemas` (client-safe at root; sensitive fields in `internal/`).
4. Route → middleware chain in the documented order → controller (thin) → service (logic, transaction, audit).
5. Parse the response through the response schema.
6. Write Supertest cases for allowed, denied (with audit entry), 404-vs-403, and cross-project id.
7. Update `DATA_MODEL.md` if the schema or audit `action` usage changes.

**Adding a frontend feature**

1. Find the route/page/widget in `FRONTEND.md`. If it isn't listed, it's probably out of scope; ask.
2. API function in `client/src/api/`, hook in `client/src/hooks/`, query keys per FRONTEND.md §1.5 table.
3. Gate controls through `usePermissions`, never inline role checks.
4. Map every error status per the §1.5 status table.
5. Check the item against the §8 Definition of Done.

**Picking up work**
Use `MVP_BOARD.md` (phase order is Foundation → Auth/Projects → Secrets → Members + Audit → Hardening). Tick boxes only when the phase's Definition of Done is met.

## Definition of done (any change)

- `lint`, tests, and `build` pass.
- No decrypted value, key, or password can reach a log, cache, response body (other than reveal), or test snapshot.
- Authorization lives in middleware (plus the one documented service-layer exception), not in controllers or the UI.
- Docs updated if behavior, contract, or scope changed.
- Nothing from the post-MVP list was built along the way.

## Ask before you do these

- Changing the middleware order, the AAD format, the cookie/CSRF policy, or any boot-time validation.
- Adding a dependency (the stack is deliberately small; e.g. bcryptjs over native `bcrypt` is intentional for Render's free tier).
- Adding a widget, route, or endpoint not in the docs.
- Anything that would make a Platform Admin see project or secret data without a `ProjectMembership`.
- Blocking Platform Admin self-grant of `projectAdmin`: noted in API.md as a reasonable hardening step but **not** built in this scope.

## Deployment notes (future, not required now)

- Frontend on Vercel, backend on Render, DB on Atlas. Preferred topology is same-site (custom subdomains or a Vercel `/api/*` rewrite): set `COOKIE_SAMESITE=Lax`, `CLIENT_ORIGIN` (the origin the browser actually loads), and `COOKIE_DOMAIN` if using subdomains.
- `trust proxy` must be the **exact** hop count (count Vercel when rewriting); too low or too high both break the per-IP limiter.
- `helmet` covers only the API. The SPA needs its own CSP via `vercel.json` headers.
- Unset `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD` after the first successful boot in any persistent environment.
