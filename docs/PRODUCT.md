# Product

## Problem

Small teams commonly share API keys and environment variables through
Slack messages, shared docs, or plaintext `.env` files passed around
manually. This leaves no record of who has seen a given secret, no
distinction between "safe to hand to any developer" (a dev key) and
"should require justification to view" (a production key), and no way to
revoke visibility after the fact. Raaz addresses this at the data layer:
some roles can confirm a secret exists and track its history without ever
being able to retrieve its decrypted value.

## Users

| Persona | Description | Primary need |
|---|---|---|
| Project Admin | Team lead responsible for a project's secrets and team | Full control over their project's secrets and who's on the team |
| Developer | Builds against the project day-to-day | Fast, low-friction access to dev secrets; occasional, logged access to prod |
| Auditor | Compliance/security reviewer | Visibility into what secrets exist and who accessed them, without needing the values themselves |
| Platform Admin | Person running the Raaz instance for the org | Oversight of users (MVP: via API only); project-level oversight is post-MVP |

## Scope (MVP)

- Project → Secret hierarchy, where each Secret carries an `environment`
  field (development/staging/production) rather than Environment being
  its own entity
- Server-side AES-256-GCM encryption at rest
- Access control via one global flag (`isPlatformAdmin`) plus three
  per-project membership roles: Project Admin, Developer, Auditor —
  see ARCHITECTURE.md for why this is framed as a flag-plus-roles model
  rather than four peer roles
- Masked-by-default secret display with explicit, confirmed reveal for
  production values
- **Audit log of every create, reveal, edit, deletion, and denied attempt (read-only table with 3 filters, no pagination)**
- **Project team management: add member only (change/remove post-MVP)**
- **Platform Admin: first-admin bootstrap, plus `PATCH /api/admin/users/:userId` (deactivate, promote/demote) as a backend endpoint with no UI**
- Atomic audit records for security-sensitive actions

## Non-Goals (this build)

- Automated secret rotation policies and expiry reminders (rotating the
  *values* teams store, e.g. auto-generating a new API key on a schedule)
- Master encryption-key rotation (rotating the *server's own* AES key
  used to encrypt everything at rest) — a distinct concern from the
  above. This build supports exactly one active `MASTER_KEY` /
  `MASTER_KEY_VERSION` pair. `Secret.encryptionKeyVersion` is stored so
  this can be added later without a schema change, but the rotation
  mechanism itself (multiple valid keys, background re-encryption, key
  retirement) isn't built now — see DATA_MODEL.md's Encryption Key
  Lifecycle
- Secret versioning / rollback
- Machine or service-account (API token) access
- Break-glass / temporary emergency access grants
- Email verification and self-service password reset. Signup only
  requires a valid email format and a password meeting a minimum length
  (enforced by the shared Zod schema); there is no confirmation email and
  no "forgot password" flow in this build
- **Platform Admin UI, project archive/restore, and platform-wide project and audit views (post-MVP).** The `/api/admin/users` backend endpoint is retained (story 7)
- **Project settings (rename, edit environments) (post-MVP)** — no `PATCH /projects/:projectId` exists in this build; every project is created with the three canonical environments
- **Member role change and removal UI (post-MVP); backend endpoints exist for last-Project-Admin invariant test**
- **Audit log pagination (post-MVP)** — the MVP log keeps its 3 filters but is capped at the 100 most recent entries

These are documented as intentional scope cuts, not oversights — each
would add a meaningful new subsystem (a scheduler, a second data model, a
second auth mechanism) without adding to what this project demonstrates
about role-based access control.

## Cut from MVP

This table is the single source of truth for scope; other docs link here.

| Story | Cut | Reason | Target |
|---|---|---|---|
| 5 — Project Admin manages their team | Partial | Add member kept (UI + API); change-role and remove are backend-only, no UI | UI post-MVP |
| 6 — Project Admin reviews project activity | Partial | Read-only log with 3 filters kept; pagination deferred (capped at 100 most recent) | Post-MVP |
| 7 — Platform Admin deactivates a malicious user | UI only | `PATCH /api/admin/users/:userId` retained as a backend endpoint; no admin UI | UI post-MVP |
| 8 — Platform Admin archives a project | Full | No archive/restore endpoint or UI. `Project.status` and the status check exist, but nothing sets `archived` | Post-MVP |
| — Project rename / environment editing | Full | No `PATCH /projects/:projectId` | Post-MVP |
| — Platform project overview and platform audit view | Full | `/admin/projects` and `/admin/audit-log` are not built | Post-MVP |

## User Stories & Acceptance Criteria

### 1. Developer views a dev secret
**As a** Developer, **I want to** view secret values in the development
environment **so that** I can run the app locally without asking anyone.

- Given I'm a Developer on a project, when I open a secret in the
  `development` environment, then the decrypted value is shown without a
  confirmation step.
- Given the same action, then an audit log entry is recorded with
  `result: allowed`.

### 2. Developer reveals a production secret
**As a** Developer, **I want to** reveal a production value when I
genuinely need it **so that** I can debug a prod issue, while my access
is tracked.

- Given I'm a Developer on a project, when I click "reveal" on a
  production secret, then a confirmation modal appears before the value
  is shown.
- Given I confirm, then the decrypted value is returned and an audit log
  entry is recorded with `result: allowed`.
- Given I have not confirmed, then no decrypted value is sent to my
  client under any circumstance.

### 3. Developer attempts to edit a production secret
**As the** system, **I want to** block Developers from editing prod
values **so that** production changes require elevated permission.

- Given I'm a Developer, when I attempt to edit a production secret,
  then the request is rejected with 403 and logged with `result: denied`.

### 4. Auditor reviews a project without seeing values
**As an** Auditor, **I want to** see that a secret exists and its access
history **so that** I can do a compliance review without holding the
secret myself.

- Given I'm an Auditor on a project, when I open the secrets list, then
  I see secret names, environments, and last-accessed metadata. The
  secrets-list endpoint never includes the ciphertext field, for any
  role that calls it — this is separate from the reveal endpoint, which
  does return a decrypted value, but only to `projectAdmin`/`developer`.
- Given I attempt to call the reveal endpoint directly (e.g. via a raw
  API request, bypassing the UI), then the request is denied at the
  `requireProjectRole` middleware before any decryption code runs, I
  receive a 403, and the attempt is logged with `result: denied`.

### 5. Project Admin manages their team

**As a** Project Admin, **I want to** assign Developer or Auditor roles
on my project **so that** I control who has what level of access.

- Given I'm a Project Admin, when I add a user to my project with a
  role, then that user gains exactly that role's permissions on this
  project only, with no effect on their role in other projects.
- Platform Admin may also manage membership; see API.md's Permissions Matrix.
- The last Project Admin cannot be removed or demoted (enforced by the backend; in the MVP exercised by a backend test only, since change/remove have no UI).

**MVP scope:** add member only. Change/remove member is deferred (backend endpoints exist for last-Project-Admin invariant test; no UI in MVP).

### 6. Project Admin reviews project activity

**As a** Project Admin, **I want to** see the audit log for my project
**so that** I can spot unusual access patterns.

- Given I'm a Project Admin, when I open the audit log, then I see every
  create, reveal, edit, delete, team membership change, and denied attempt
  scoped to my project, with user, action, secret name (where
  applicable), and timestamp. See DATA_MODEL.md for the full `action`
  enum.
- User email is displayed via the populated `user` field in the audit response.

### 7. Platform Admin deactivates a malicious user
**As a** Platform Admin, **I want to** deactivate a user platform-wide
**so that** I can respond to a security incident without deleting their
audit trail.

- Given I'm a Platform Admin, when I deactivate a user, then that user
  can no longer log in, but their historical audit log entries remain
  intact and attributed to them.

**MVP scope:** backend endpoint only (`PATCH /api/admin/users/:userId`); no admin UI.

### 8. Platform Admin archives a project
**As a** Platform Admin, **I want to** archive a problematic project
**so that** its members lose access to it without destroying its audit
history. ("Stops appearing" would be the wrong framing — see below: it
stays visible as archived, just locked.)

- Given I'm a Platform Admin, when I archive a project, then its status
  changes to `archived`, its members lose access, and its secrets and
  audit log remain in the database rather than being deleted.
- Archived projects reject member and secret requests with `403`, except
  Platform Admin restore and read-only platform administration actions.
  A member still sees the project in their project list (with
  `status: 'archived'`) — they just can't open it — rather than it
  silently disappearing. See API.md's Permissions Matrix notes and
  ARCHITECTURE.md's Project status check for the full behavior.
- Restoring a project to `active` restores existing membership access.

**Post-MVP.** No archive/restore endpoint exists in the MVP. `Project.status` and the status check are in place, but nothing sets `archived` yet.

### 9. Platform Admin does not implicitly see decrypted secrets
**As the** system, **I want to** keep Platform Admin's power scoped to
platform management **so that** the most powerful role isn't also the
biggest single point of decryption risk.

- Given a Platform Admin is not a member of a specific project, when they request anything under that project's `/projects/:projectId/*` routes, then they get `404` like any non-member, and no `/admin/*` route returns any project or secret data (the platform user list is not project data). (A platform-wide project overview showing name, member count and secret count is post-MVP and must stay metadata-only when it ships.)
- **Scope of this guarantee, stated precisely:** "implicitly" is the
  load-bearing word. A Platform Admin can still *explicitly* grant
  themselves a `ProjectMembership` with **any** role — including
  `projectAdmin`, not only `developer` — since `POST
  /projects/:projectId/members` takes any role value and accepts them as
  an alternate caller, same as a Project Admin. Granted `projectAdmin`,
  they could edit or delete any secret and remove the project's actual
  team, not only reveal values. Nothing technical prevents any of it.
  What this story actually guarantees is that being Platform Admin alone,
  with no action taken, never exposes a decrypted value, and that if they
  do grant themselves access, the grant and everything that follows are
  fully audited and visible to the project's own Project Admin and
  Auditor. See API.md's Permissions Matrix notes for the full trade-off.

### 10. New signup has no default project role
**As the** system, **I want to** require explicit role/project
assignment **so that** no one gains access to a project simply by
existing on the platform.

- Given a new user signs up, when they log in for the first time, then
  they see an empty projects dashboard until a Project Admin or Platform
  Admin adds them to a project.

### 11. Bootstrapping the first Platform Admin
**As the** system, **I want to** provide a way for the very first Platform
Admin to exist **so that** the platform isn't unmanageable on day one.

- On server startup, if no user with `isPlatformAdmin: true` exists yet
  and a `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD` environment
  variable pair is set, the server creates (or promotes, if the email
  already exists) that user as the first Platform Admin. **Bootstrap also creates and initializes the `PlatformConfig` singleton with `activePlatformAdminCount = 1`.**
- **Promoting an existing account also resets its password** to a fresh
  hash of `PLATFORM_ADMIN_PASSWORD`, not just flipping `isPlatformAdmin`,
  **and bumps `tokenVersion`** (DATA_MODEL.md). Both are needed, not just
  the first: without the password reset, if anyone had already registered
  using exactly the email in `PLATFORM_ADMIN_EMAIL` before the operator's
  first boot, that pre-existing account — with whatever password its
  original registrant set — would silently become Platform Admin, not the
  operator. But the password reset *alone* doesn't fully close that hole
  either: if the squatter happened to be logged in at the moment of
  promotion, their existing JWT (valid up to 7 days) would still pass
  `authenticate` and become a Platform Admin session the moment the flag
  flips, password reset or not — a cookie doesn't care that the password
  behind it changed. Bumping `tokenVersion` at the same time invalidates
  that cookie immediately, regardless of its remaining lifetime. See
  ARCHITECTURE.md's Authentication Flow for the full mechanism.
- **Promotion also sets `isActive: true`**, not just `isPlatformAdmin:
  true`. Without this, promoting an account that happens to be
  `isActive: false` leaves a flagged admin who still can't log in — and
  bootstrap won't fire again to fix it, since its trigger condition ("no
  user with `isPlatformAdmin: true` exists") is no longer true once that
  flagged-but-inactive user exists. That's a self-inflicted permanent
  lockout this one-line fix avoids entirely.
- **This check re-runs on every boot, not just the first** — "no user
  with `isPlatformAdmin: true` exists yet" is a condition evaluated every
  startup, not a one-time flag that gets permanently consumed. In
  practice that means it almost always only *does* anything on the very
  first boot against a fresh database, but it is not a one-time-forever
  guarantee: it would fire again after any reset that removes every
  Platform Admin, including a routine drop-and-recreate of this project's
  own disposable dev database (see DATA_MODEL.md's Migrations section) —
  which is expected, not a bug, since a freshly recreated dev DB needs an
  admin again the same way a brand-new one does.
- **Env credentials are validated like any other signup**, not assumed
  correct because they came from the environment: `PLATFORM_ADMIN_PASSWORD`
  is checked against the same 8–72 character policy as `POST /auth/signup`
  (API.md) — boot fails loudly on a weak or malformed value rather than
  creating an admin account with it — and `PLATFORM_ADMIN_EMAIL` is
  lowercased before use, consistent with `User.email`'s own normalization
  everywhere else (otherwise a mixed-case env var could end up unable to
  log in against its own lowercase-stored account).
- **Operational recommendation, not enforced by the server:** unset
  `PLATFORM_ADMIN_EMAIL`/`PLATFORM_ADMIN_PASSWORD` after the first
  successful boot in any environment meant to persist, so the credential
  isn't sitting in deployment config indefinitely. Not needed for local
  dev, where the disposable DB means the condition re-triggers routinely
  anyway (above).
- Every subsequent Platform Admin is created by an existing Platform
  Admin toggling `isPlatformAdmin` on a user via
  `PATCH /api/admin/users/:userId` (see API.md).

### 12. Audit records survive action failures
**As the** system, **I want to** preserve an accurate audit trail
**so that** success is never reported without its required audit record.

- State-changing project actions and their allowed audit records commit
  in one MongoDB transaction.
- If the audit write fails, the protected action fails and returns
  `500 INTERNAL_ERROR`; the API never reports success without an audit
  record.
- Denied project actions write a denied audit record before returning
  `403`, or return `500 INTERNAL_ERROR` if that audit write fails.
