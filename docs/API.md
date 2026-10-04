---
tags: [api, mvp, contract, endpoints, permissions]
---

# API

## Conventions

- **Base path:** all routes are under `/api` (unversioned for this build —
  see Versioning below).
- **Auth:** JWT in an httpOnly cookie, set on login and cleared on
  logout — `SameSite` is `Lax` by default, `None` in production unless
  `COOKIE_SAMESITE` overrides it (see ARCHITECTURE.md's Cross-Origin
  Deployment & CSRF for the full policy; there's no single fixed value).
  No token is ever returned in a JSON response body. Requests from the
  client must include `credentials: 'include'`.
- **Content type:** `application/json` for all request/response bodies.
- **Validation:** request bodies are validated against the Zod schemas in
  `packages/shared-schemas` before reaching controller logic; a failing
  schema returns `422 VALIDATION_ERROR`.
- **Path and query validation:** ObjectId path parameters, enum filters,
  page numbers, and limits are validated before controller logic.
  `page` must be at least `1`; `limit` must be between `1` and `100`. A
  malformed ObjectId (wrong length or non-hex characters) returns
  `422 VALIDATION_ERROR` at this layer, before any database lookup —
  distinct from a well-formed but nonexistent id, which reaches the
  service and gets a `404`.
- **No-`page` exception:** `GET /api/projects/:projectId/audit-log` accepts `limit` up to `100` and has no `page` parameter (it returns the most recent matching entries).
- **IDs:** all resource IDs in the API are raw MongoDB `ObjectId`s
  serialized as 24-character hex strings — there's no separate public-id
  layer in this build. A `:secretId` is always looked up scoped to its
  `:projectId` together (`Secret.findOne({ _id: secretId, projectId })`),
  never by `_id` alone — otherwise a well-formed `secretId` that actually
  belongs to a *different* project could be acted on through the wrong
  project's URL, bypassing the role check that only verified the caller's
  role on the `:projectId` in the path. This is on the Supertest priority
  list in TECH_STACK.md alongside the other easy-to-get-wrong cells.
- **Rate limiting:** `POST /api/auth/login` and `POST /api/auth/signup` are rate-limited via a single per-IP limiter each (30 requests per 15 minutes per IP on login; 10 per 15 minutes per IP on signup). `POST /api/projects/:projectId/secrets/:secretId/reveal` is rate-limited via a per-user limiter keyed on `req.user.id` (20 requests per 15 minutes per user). Per-account limiters are deferred to post-MVP. See ARCHITECTURE.md's Rate Limiting section for rationale. Exceeding any limiter returns `429 RATE_LIMITED` in the same envelope as every other error, via a custom `handler` rather than `express-rate-limit`'s default plaintext response, and is not logged as an `AuditLogEntry` (see ARCHITECTURE.md for why).

## Error Shape

All error responses use the same envelope:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to perform this action."
  }
}
```

| HTTP status | `code` | Meaning |
|---|---|---|
| 401 | `UNAUTHENTICATED` | Missing/invalid/expired auth cookie |
| 403 | `FORBIDDEN` | Four distinct causes share this code: **(a)** authenticated, holds a `ProjectMembership` on the target project, but that membership's `role` isn't allowed to perform this action — logged as an `AuditLogEntry` with `result: denied` when the action has a corresponding `action` enum value (create/edit/delete/reveal, membership changes); see 404 below for the no-membership case, which is different; **(b)** the target project is archived (ARCHITECTURE.md's Project status check) — only reachable by someone who already has membership, so existence isn't being hidden; **(c)** a state-changing request's `Origin` header doesn't match `CLIENT_ORIGIN`, including a missing header (ARCHITECTURE.md's CSRF check) — not logged, this happens before `authenticate` even runs; **(d)** a non-Platform-Admin calling an `/admin/*` route (`requirePlatformAdmin`) — not logged, same reasoning as the no-membership 404 case: there's no project-scoped `action` to attach it to. |
| 404 | `NOT_FOUND` | Resource doesn't exist, **or** exists but the caller has no `ProjectMembership` that would reveal even its existence — this is also what a role-insufficient request gets if the caller isn't a member at all (see ARCHITECTURE.md's `requireProjectRole`). Not logged: there's no `action` enum value for a bare access probe, and no project team for such an entry to be visible to. |
| 409 | `CONFLICT` | Duplicate key (e.g. secret key already exists in that project+environment), or a business invariant would be violated (e.g. removing the last `projectAdmin` or the last Platform Admin) |
| 422 | `VALIDATION_ERROR` | Request body failed schema validation, or a business-rule check that depends on data not known until the service layer loads it (e.g. `confirm` missing on a production reveal — see the reveal endpoint below) |
| 429 | `RATE_LIMITED` | Too many requests against a rate limiter (per-IP on login/signup, per-user on reveal) (see ARCHITECTURE.md's Rate Limiting section). Uses this same envelope (see Conventions, above) |
| 500 | `INTERNAL_ERROR` | Unhandled server error |

## Pagination

List endpoints that can grow unbounded (currently only the platform user list; the platform project list and audit log are post-MVP) accept:

```
?page=1&limit=20
```

and respond with:

```json
{
  "data": [ ... ],
  "page": 1,
  "limit": 20,
  "total": 143
}
```

Endpoints where the result set is inherently small and scoped to the
caller (e.g. "my projects," "members of this project") are not paginated.
The project audit log endpoint accepts `limit` up to `100` with no `page` parameter.

## Versioning

No version prefix in this build — routes are unversioned under `/api`.
The client calls a single centralized `API_BASE_URL` constant (read from `VITE_API_BASE_URL`; defaults to `http://localhost:5000/api` in dev, `/api` behind a same-origin rewrite), so
introducing `/api/v1` later is a low-cost change confined to one place,
not a scope item for this build.

## Permissions Matrix

This table is the single source of truth for who can do what — every
endpoint's Access column (below) is derived from this, not the other way
around.

| Action | Project Admin | Developer (development) | Developer (staging) | Developer (production) | Auditor | Platform Admin (non-member) |
|---|---|---|---|---|---|---|
| View secret list/metadata | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ (a platform project overview is post-MVP) |
| Create secret | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit secret value | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete secret | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Reveal secret (decrypt) | ✅ | ✅ | ✅ | ✅ (with `confirm: true`) | ❌ (403, logged as denied) | ❌ |
| View project's audit log | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ (platform-wide audit view is post-MVP) |
| Add project member | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Change/remove project member | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Archive/restore project (post-MVP) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Deactivate/reactivate a user | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Promote/demote Platform Admin | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

(Three Developer columns, not two, so write access doesn't have to be
read off a column shared with a different threshold for reads. This was
flagged as a readability risk even with a footnote on the old two-column
version — splitting the column is the actual fix, not a further caveat
on top of it.)

**MVP scope notes:**
- "Add project member" — endpoint exists, UI exposes list + add only.
- "Change/remove project member" — endpoints exist (backend only, for last-Project-Admin invariant test), no UI in MVP.
- "Rename project" and environment editing — cut from MVP; no `PATCH /projects/:projectId` exists.
- "Archive/restore project", `/admin/projects` and `/admin/audit-log` — post-MVP; no endpoints in this build.
- "Deactivate/reactivate" and "Promote/demote" — backend only (`PATCH /admin/users/:userId`), no UI.
- "View project's audit log" — read-only table with 3 filters, no pagination.

Notes on cells that are easy to get wrong:

- **Developer + staging + create/edit = ❌.** Developer write access
  narrows to `development` only — `staging` returns 403 on create/edit,
  same as `production` — even though Developer's *read* access (view,
  reveal) is uniform across all three environments. This matches the
  endpoint table below, which already says "development only" for both
  `POST` and `PATCH` on secrets.
- **Developer + production + edit = ❌, always.** A Developer can reveal a
  production value but can never write to one, regardless of
  confirmation. There is no "confirm to edit prod" path for Developer —
  only Project Admin can edit production secrets.
- **Auditor + reveal = ❌ unconditionally**, including on development
  secrets. Auditor never receives a decrypted value for any environment.
- **A Platform Admin who is *also* a `ProjectMembership` on a given
  project** gets that membership's row in this table for that project —
  the "Platform Admin (non-member)" column only applies when they have no
  membership there. Being Platform Admin never substitutes for having a
  project role.
- **Archived projects deny member access with 403, not 404.** A member
  (or a Platform Admin acting via the membership bypass below) already
  knows the project exists; archiving isn't existence-hiding the way a
  missing membership is. The project still shows up, with
  `status: 'archived'`, in `GET /api/projects` — it just can't be drilled
  into further until restored. `/admin/*` routes aren't project-scoped and don't pass through the check. In the MVP no endpoint sets `archived`, so this behavior is specified and middleware-tested but not reachable end-to-end. See ARCHITECTURE.md's Project status check.
- **A Platform Admin acting on membership routes without a
  `ProjectMembership`** goes through `requireProjectRoleOrPlatformAdmin`,
  not plain `requireProjectRole` — see ARCHITECTURE.md's RBAC Pipeline.
  Plain `requireProjectRole` would 404 them before they ever reached the
  handler, which is why the Access column for the three membership routes
  below reads "`projectAdmin` or `isPlatformAdmin`" rather than relying on
  the same middleware every other project route uses.
- **A Platform Admin can grant themselves full project control, not just
  developer-level access.** Because `POST /projects/:projectId/members`
  accepts `isPlatformAdmin` as an alternate caller (above) and takes
  **any** `role` value in its body, a Platform Admin can add *themselves*
  as `projectAdmin` — not only `developer` — on any project. That's the
  full blast radius: edit or delete any secret including production,
  remove or re-role the project's actual team, not just reveal values
  like a self-granted `developer` would. This is a real gap in "Platform
  Admin doesn't implicitly see decrypted secrets" (PRODUCT.md story 9) —
  accurate as written (*implicitly* is the operative word: nothing grants
  them access without an action they took), but the guarantee is weaker
  than it might sound like on a skim, and worse than earlier drafts of
  this note stated. This build accepts that trade-off rather than
  blocking self-grants outright: the membership change and everything
  that follows are fully audited (`member_added` naming themselves as
  `targetUserId` with whatever role they chose, then ordinary entries for
  every action after), which makes the grant itself a conspicuous, highly
  reviewable audit entry even though nothing stops it from happening.
  Blocking self-grants specifically (rejecting `POST /members` when
  `targetUserId === req.user.id` and the caller is only a Platform Admin,
  not also already `projectAdmin`) is a reasonable hardening step but
  isn't built in this scope.
- **Last-admin invariants use an atomic counter, not a transactional
  check-then-act — a transaction alone isn't actually enough.** The
  obvious-looking fix — do the admin-count check and the write in one
  MongoDB transaction, relying on a write conflict to catch a race — does
  **not** work here: MongoDB transactions use snapshot isolation, and a
  conflict is only detected when two transactions write the *same
  document*. If Project Admin A demotes B while B concurrently demotes A,
  each reads "one other admin exists" from its own snapshot and writes to
  a *different* `ProjectMembership` document — no conflict is ever
  detected, both commit, and the project ends up with zero admins. This
  is write skew, a known snapshot-isolation failure mode, and the
  Platform Admin case (two admins deactivating each other) fails the
  identical way. The actual fix: `Project.activeAdminCount` /
  `PlatformConfig.activePlatformAdminCount` (DATA_MODEL.md) turn the
  guard into a single atomic conditional update —
  `findOneAndUpdate({ _id, activeAdminCount: { $gt: 1 } }, { $inc: {
  activeAdminCount: -1 } })` — which is safe *without* a transaction at
  all, because MongoDB guarantees single-document operations are atomic
  at the storage layer: two concurrent decrements against the same
  document's counter cannot both succeed when the second would violate
  the `$gt` guard. The counter update is still wrapped in the same
  transaction as the accompanying membership write (so the two commit
  together or not at all), but it's the counter's own atomicity — not the
  transaction — that actually closes the race.
- **Project Admin invariant:** the last `projectAdmin` membership cannot
  be removed or demoted; both attempts return `409 CONFLICT`, guarded by
  `Project.activeAdminCount` as above. A Project Admin may remove
  themselves only when another Project Admin remains. This is the one concurrent-request test on TECH_STACK.md's priority list; the Platform Admin equivalent is documented but deferred.
- **Platform Admin invariant, mirroring the one above — and covering
  both fields that cause the same lockout, not just one:** at least one
  `User` must have `isPlatformAdmin: true` **and** `isActive: true` at
  all times, guarded by `PlatformConfig.activePlatformAdminCount` as
  above. `PATCH /api/admin/users/:userId` returns `409 CONFLICT` if the
  request would leave zero such users — whether by demoting
  (`isPlatformAdmin: false`) or by deactivating (`isActive: false`) the
  last one, self included. Deactivation needs the identical guard because
  it has the identical practical effect: nobody left who can both hold
  the role and log in. The bootstrap flow (PRODUCT.md story 11) doesn't
  rescue this case on restart either — it only fires when **no** user has
  `isPlatformAdmin: true` at all, which wouldn't be true here; the
  locked-out admin still carries the flag, just no active session to use
  it with. Unlike Project Admin there's no "remove yourself" analog here,
  since Platform Admin is a flag to toggle, not a membership to leave.
### Post-MVP: environment editing and the write-skew race

Environment editing (and the `PATCH /api/projects/:projectId` endpoint that would carry it) is not in this build, so this race cannot occur yet; until then create-secret validates the environment with a plain read. When it ships: removing an environment from `Project.environments` while a secret is being created in it is the same snapshot-isolation write skew described above — the two transactions touch different documents (`Project` and `Secret`), so no conflict is detected — but there is no natural counter to guard it. The fix is for create-secret to perform a scoped *write* on the `Project` document while validating the environment (e.g. a conditional `findOneAndUpdate({ _id: projectId, environments: environment }, { $set: { updatedAt: new Date() } })` inside the same transaction as the `Secret` insert), so a concurrent environment-removal transaction collides with it on that document. A read-only check has no such guarantee. Custom-environment naming rules are in DATA_MODEL.md.

## Endpoints

### Auth

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/api/auth/signup` | public, unless `SIGNUP_ALLOWED_DOMAINS` is set | Creates a `User` with `isPlatformAdmin: false` and no project memberships. Password: 8–72 characters (the upper bound matches bcrypt's own effective limit — bcrypt silently truncates beyond 72 bytes, so accepting longer input without a cap just pays unbounded CPU for characters that do nothing). A duplicate email returns `409 CONFLICT`; this is an accepted enumeration trade-off, not an oversight — confirming an email is already registered is standard for an invite-free signup flow, and this build has no email verification to build an enumeration-resistant flow around in the first place (see Non-Goals in PRODUCT.md). **Open signup by default is a real mismatch with PRODUCT.md's own framing** of Platform Admin as running this "for the org" — as shipped, anyone on the public internet could self-register, create projects, and clutter the Platform Admin's lists if this were actually deployed open. The fix is opt-in, not forced: if the optional `SIGNUP_ALLOWED_DOMAINS` env var is set (comma-separated, e.g. `acme.com,acme.io`), signup rejects any email whose domain isn't in the list with `422 VALIDATION_ERROR`; unset (the default), signup stays fully open, which keeps local dev and casual testing simple. A per-user project-creation cap was considered and left out — it addresses a different problem (clutter from legitimate members) than the "anyone can sign up at all" mismatch this closes. |
| POST | `/api/auth/login` | public | Sets the auth cookie. The error is **generic** either way — `401 UNAUTHENTICATED` with the same message for "no account with this email" and "wrong password" — so the login endpoint itself doesn't become a second enumeration surface beyond the one signup already accepts. A failed attempt is **not** written as an `AuditLogEntry` — it's covered by the rate limiting above and application security logs instead; see DATA_MODEL.md's "Not captured" note for why `login_failed` isn't in the `action` enum. |
| POST | `/api/auth/logout` | authenticated | Clears the auth cookie |
| GET | `/api/auth/me` | authenticated | Returns the current user (no `passwordHash`) |

### Projects

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/api/projects` | authenticated | Projects the caller has a `ProjectMembership` in, **including archived ones** (with `status: 'archived'` in the response) — this endpoint has no `:projectId` to gate on, so it isn't subject to the active-project status check the way every nested route below is; a member sees their archived project in the list, they just can't open it further. Each entry includes the caller's own `role` on that project — the client needs it to branch UI (show "manage team" only for `projectAdmin`, etc.) without a second round-trip per project. |
| POST | `/api/projects` | authenticated | Body: `{ name }`. Creates the project with the three canonical environments (`development`, `staging`, `production`); caller becomes `projectAdmin`. Environments are not client-settable in this build. |
| GET | `/api/projects/:projectId` | project member | 404 if caller has no membership (existence isn't revealed); 403 if the project is archived (specified for when archive ships; unreachable in the MVP). Response includes the caller's `role` on the project. |

### Project Membership

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/api/projects/:projectId/members` | project member | Each entry: `{ userId, email, role, createdAt }` — `email` and `role` for display, `userId` for the `PATCH`/`DELETE` routes below, `createdAt` as "member since." |
| POST | `/api/projects/:projectId/members` | `projectAdmin` or `isPlatformAdmin` | Body: `{ email, role }` — **not** `userId`. A Project Admin has no way to discover another user's `userId`; the only user-listing endpoint is Platform Admin-only. The server resolves `email` to a `User` itself and returns `404 NOT_FOUND` if no account exists with that email. This is a deliberate, accepted trade-off: it confirms whether an email is registered (minor enumeration surface), in exchange for a usable invite flow without exposing a platform-wide user list to every Project Admin. A deactivated (`isActive: false`) user can still be added — `isActive` only gates login, not membership, so they'll have the access once reactivated. Duplicate `(userId, projectId)` returns `409 CONFLICT` with message "already a member". |
| PATCH | `/api/projects/:projectId/members/:userId` | `projectAdmin` or `isPlatformAdmin` | Change role (by `userId` here, since the membership already exists and its `userId` is known). **MVP: backend only — no UI.** |
| DELETE | `/api/projects/:projectId/members/:userId` | `projectAdmin` or `isPlatformAdmin` | Remove from project. **MVP: backend only — no UI.** |

### Secrets

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/api/projects/:projectId/secrets?environment=development` | project member | Metadata + masked indicator only. `environment` is required and must be one of the project's environments, else `422`. `ciphertext`/`iv`/`authTag` are never selected on this query, for any role. The masked indicator is a **fixed-width placeholder** (e.g. always exactly `••••••••`), the same string regardless of the real value's actual length — a mask whose width scales with the real value would leak an approximate length to everyone who can list secrets, including an Auditor who should never learn anything about the value itself. Response fields: `id` (the `:secretId` for edit/delete/reveal), `key`, `environment`, `lastAccessedAt`, `createdAt`, and the masked value. |
| POST | `/api/projects/:projectId/secrets` | `projectAdmin` (any env), `developer` (development only) | Body: `{ environment, key, value }` — server encrypts `value`, never persists plaintext |
| PATCH | `/api/projects/:projectId/secrets/:secretId` | `projectAdmin` (any env), `developer` (development only) | Body: `{ value }` — only the value is editable. `key` and `environment` are immutable after creation; renaming a secret or moving it to a different environment means deleting and recreating it, not a supported `PATCH`. Editing a production secret as `developer` returns 403. |
| DELETE | `/api/projects/:projectId/secrets/:secretId` | `projectAdmin` | |
| POST | `/api/projects/:projectId/secrets/:secretId/reveal` | `projectAdmin`, `developer` | Body: `{ confirm: boolean }` — `confirm: true` required when `environment === 'production'`, ignored otherwise. A production reveal with `confirm` missing or `false` returns `422 VALIDATION_ERROR` and is **not** logged as a denied reveal (no decryption was attempted and no role check failed — it's an incomplete request, not an access decision). `auditor` requests are rejected by `requireProjectRole` before this handler runs, and logged as `result: denied`; see ARCHITECTURE.md's Secret Encryption & Reveal Flow for how that denial still gets `environment`/`secretKey` populated. Response: `{ value: string }` — the decrypted value only, nothing echoed back that the client didn't already have (`key`/`environment` are already known client-side from the secret it just requested). `Cache-Control: no-store` on the response (ARCHITECTURE.md's Client-Side Cache Policy). |

### Audit Log

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/api/projects/:projectId/audit-log?action=&result=&environment=&limit=100` | any project member | Visible to `projectAdmin`, `developer`, and `auditor` alike — the log is a transparency mechanism for the whole team, not an admin-only tool. `environment` filters to entries that have that field set (secret-level actions only). **No pagination — single request capped at 100 most recent entries.** See DATA_MODEL.md. Response shape: each entry includes `id`, `action`, `result`, `createdAt`, `user: { id, email }`, `targetUser?: { id, email }`, `secretKey?`, `environment?`, `previousRole?`, `newRole?`. The `user` and `targetUser` objects are populated server-side from `User`; if a user document is missing, the field is `null`. Deactivated users still resolve to their email. The `secretId` field is intentionally omitted — the secret may be deleted, and the key name is what the UI displays. |

### Platform Admin

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/api/admin/users?page=&limit=` | `isPlatformAdmin` | |
| PATCH | `/api/admin/users/:userId` | `isPlatformAdmin` | Body: `{ isActive? , isPlatformAdmin? }` — toggling `isPlatformAdmin` on another user promotes/demotes them. Returns `409 CONFLICT` instead of applying the change if it would leave zero users with both `isPlatformAdmin: true` and `isActive: true` — covers demoting *or* deactivating the last one, self included. See the Permissions Matrix notes above. Writes `user_activated`/`user_deactivated`/`platform_admin_granted`/`platform_admin_revoked` audit entries (no `projectId`). |

Note: `/admin/projects` and `/admin/audit-log` (platform project overview, archive/restore, platform-wide audit view) are post-MVP and not built. No admin route returns any `Secret` data — not `ciphertext`, and in this build not even secret counts or names. A Platform Admin can reveal a secret only by holding a `ProjectMembership` on that specific project.
