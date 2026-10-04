---
tags: [frontend, mvp, ui, components, routes, phase-gate]
---

# Frontend Blueprint

Pages, routes, and UI widgets for the time-constrained build.

**This is the document developers work from.** It names the surfaces — pages, routes, widgets — that the access rules (PRODUCT.md, API.md) operate on; it does not restate those rules. A fuller frontend spec was never written: **this blueprint is authoritative.**

**The ceiling is here.** The widget inventory below is complete. Adding a
widget requires removing one or replacing it — the two-person risk is not
underspecification anymore, it's scope creep against a fixed deadline.

**What "widget" means:** a React component with its own file, because two
developers need a shared name for it. Buttons, inputs, and text compose
inline.

## 1. Route Map

| \# | Path | Page | Guard | API | Phase | 
| ----- | ----- | ----- | ----- | ----- | ----- | 
| 1 | `/` | redirect → `/projects` | — | — | 1 | 
| 2 | `/login` | `LoginPage` | `PublicOnly` | `POST /api/auth/login`, `GET /api/auth/me` | 2 | 
| 3 | `/signup` | `SignupPage` | `PublicOnly` | `POST /api/auth/signup` | 2 | 
| 4 | `/projects` | `ProjectsPage` | `RequireAuth` | `GET /api/projects`, `POST /api/projects` | 2 | 
| 5 | `/projects/:projectId` | `ProjectLayout` | `RequireAuth` + member | `GET /api/projects/:projectId` (includes the caller's `role`) | 2 | 
| 6 | `/projects/:projectId/secrets?environment=` | `SecretsPage` | as #5 | `GET/POST /api/projects/:projectId/secrets`; `PATCH/DELETE /api/projects/:projectId/secrets/:secretId`; `POST /api/projects/:projectId/secrets/:secretId/reveal` | 3 | 
| 7 | `/projects/:projectId/members` | `MembersPage` | as #5 | `GET/POST /api/projects/:projectId/members` *(PATCH/DELETE retained on backend for post-MVP UI)* | 4 | 
| 8 | `/projects/:projectId/audit-log` | `ProjectAuditLogPage` | as #5 | `GET /api/projects/:projectId/audit-log?limit=100` (no pagination) | 4 | 
| 9 | `/unauthorized` | `StatusPage variant="unauthorized"` | none | — | 1 | 
| 10 | `*` | `StatusPage variant="not-found"` | none | — | 1 | 
| 11 | `/admin` | redirect → `/admin/users` | `RequireAuth` + `RequirePlatformAdmin` | — | **post-MVP** | 
| 12 | `/admin/users` | `AdminUsersPage` | as #11 | `GET/PATCH /api/admin/users/:userId` | **post-MVP** | 
| 13 | `/admin/projects` | `AdminProjectsPage` | as #11 | endpoints not built (post-MVP) | **post-MVP** | 
| 14 | `/admin/audit-log` | `AdminAuditLogPage` | as #11 | endpoint not built (post-MVP) | **post-MVP** | 

**MVP ships routes 1–10.** Routes 11–14 are post-MVP — see §7 for the boundary and what it costs.

Every endpoint the MVP uses has a client function in `client/src/api/`. Response shapes are defined in API.md and there are no open contract issues in this scope; if one is found, record it in API.md, not here.

`POST /api/auth/logout` (clears auth cookie) is used by the logout
control in `NavBar` but is not a route — no page associated.

**Signup stays.** It's the only way a user enters the system — there is
no admin create-user route in the API. Cutting it would remove the
ability to onboard anyone, not defer a convenience. The one product
decision the team can make here is whether `SIGNUP_ALLOWED_DOMAINS` is
set in deployment; that's a server-side choice, not a frontend cut.

**Members & Audit scope:** `MembersPage` exposes list + add only (change/remove are backend-only, no UI). `ProjectAuditLogPage` is read-only with three filters (Action, Result, Environment), no pagination.

**Guards** are two components plus one in-page check:

| Guard | Behavior | 
| ----- | ----- | 
| `RequireAuth` | Pending → `FullPageState variant="loading"`. Anonymous → redirect to `/login` with `state.from`. Network error → `FullPageState variant="error"` with Retry. | 
| `PublicOnly` | Pending → `FullPageState variant="loading"`. Authenticated → redirect to `state.from ?? '/projects'`. | 

**Post-MVP guards:**

| Guard | Behavior | 
| ----- | ----- | 
| `RequirePlatformAdmin` | Nested inside `RequireAuth`. Not an admin → redirect to `/unauthorized`. Post-MVP. | 

The project-member check lives inside `ProjectLayout` because it needs
the project's data to render the 404 and archived states.

### 1.5 Auth propagation and error mapping

One Axios instance (`client/src/api/`) with a response interceptor turns every failure into an `ApiError { status, code, message }` (envelope in API.md). Queries retry once on network errors and 5xx, never on 4xx. Mutations never retry.

**401 chain.**

1. The interceptor sees `401` on any request except `POST /auth/login` and the bootstrap `GET /auth/me`.
2. It calls the auth module's `onUnauthenticated()`, de-duplicated so several simultaneous 401s fire it once: `queryClient.clear()` (drops every cached project, secret and audit result), then navigate to `/login` with `state: { reason: 'expired', from: <current location> }`.
3. Login success sets the `['me']` query and navigates to `state.from ?? '/projects'`. Logout calls `POST /auth/logout`, then `queryClient.clear()`, then navigates to `/login` with `reason: 'logged-out'`. Login and logout own the cache transition; guards never clear it.
4. A 401 on a reveal mutation follows the same chain; leaving the route unmounts the cell, which clears the value (§3.5a).
5. An anonymous `GET /auth/me` 401 at bootstrap is not an error: it resolves `me` to `null` and `RequireAuth` redirects to `/login` without a `reason`.

**Status → UI.**

| Status / code | Where | UI |
| ----- | ----- | ----- |
| No response (network, timeout) | query / mutation / login | `ErrorState` + Retry / error toast "Network error — try again" / form banner |
| `401 UNAUTHENTICATED` | login form | Generic form error (same copy for unknown email and wrong password) |
| `401 UNAUTHENTICATED` | anything else | 401 chain above |
| `403 FORBIDDEN` | mutation | Persistent error toast; invalidate `['project', id]`, `['projects']` and the resource's own key (the role may have changed) |
| `403 FORBIDDEN` | project detail | Archived — `ProjectArchivedNotice` (post-MVP); in the MVP treat as "other error" |
| `404 NOT_FOUND` | project detail | `StatusPage not-found` |
| `404 NOT_FOUND` | add member | Email-field error "No account with that email" |
| `404 NOT_FOUND` | secret edit/delete/reveal | Toast "Secret no longer exists"; invalidate the secrets list |
| `409 CONFLICT` | signup / create secret / add member | Field error on email ("already registered") / key ("already exists in this environment") / email ("already a member") |
| `422 VALIDATION_ERROR` | any form | Field errors (the shared Zod schemas catch most of these client-side); signup domain rejection shows on the email field |
| `429 RATE_LIMITED` | login / reveal | Toast "Too many attempts, try again in 15 minutes" / "Too many reveals, try again in 15 minutes"; a reveal cell returns to `idle` |
| `500 INTERNAL_ERROR` | query / mutation | `ErrorState` + Retry / error toast "Something went wrong — the action was not applied" (an audit-write failure fails the whole action) |

**Query keys and invalidation.**

| Key | Data | Invalidated by |
| ----- | ----- | ----- |
| `['me']` | `GET /auth/me` | set on login; cleared on logout and 401 |
| `['projects']` | project list | create project |
| `['project', projectId]` | project detail incl. `role` | any 403 on a mutation in that project |
| `['secrets', projectId, environment]` | secrets list | create / edit / delete in that environment; a settled reveal (`lastAccessedAt` moves) |
| `['members', projectId]` | members list | add member |
| `['audit', projectId, filters]` | project audit log | any secret mutation, reveal, or add member (invalidate by the `['audit', projectId]` prefix) |

A reveal never writes any query key. The secret row is keyed by secret id, so the list refetch after a reveal doesn't remount the cell or clear its value.

## 2. Shared Widgets

25 for the MVP; 2 post-MVP (`ProjectArchivedNotice`, `AdminUsersTable`). File per row, in `client/src/components/`.

### 2.1 Chrome and layout

| Widget | Purpose | 
| ----- | ----- | 
| `AppShell` | Skip link, `NavBar`, `<main id="main">`, `Toaster` | 
| `NavBar` | Brand, Projects link, user dropdown. Admin dropdown added post-MVP. | 
| `PageHeader` | `<h1>` + optional actions slot | 
| `TabNav` | Project tabs and (post-MVP) admin tabs. `items: { to, label, visible? }[]` | 
| `StatusPage` | Variants `not-found`, `unauthorized` | 
| `ProjectArchivedNotice` | **Post-MVP** (nothing can archive a project yet). Replaces project chrome when `GET /projects/:id` returns 403 | 

### 2.2 Feedback and state

| Widget | Purpose | 
| ----- | ----- | 
| `FullPageState` | Variants `loading`, `error`. The only thing rendered during auth bootstrap. | 
| `Skeleton` | Shape prop: `table`, `card`, `header` | 
| `ErrorState` | Inline query failure: message + Retry | 
| `EmptyState` | Title, one sentence, optional action | 
| `InlineAlert` | Variants `info`, `warning`, `error` | 
| `Toaster` | Toast queue. Success auto-dismisses at 4 s; error persists. | 

### 2.3 Dialogs and forms

| Widget | Purpose | 
| ----- | ----- | 
| `Modal` | Accessible dialog. Requirements: focus trap, Esc dismiss, backdrop dismiss, focus return, accessible name. Use whatever meets them — `<dialog>` is the smallest path. | 
| `ConfirmDialog` | Built on `Modal`. `title`, `body`, `confirmLabel`, `tone` (`neutral` / `danger`), `pending`, `error` slot. | 
| `RevealConfirmDialog` | The production reveal gate. Cancel has initial focus. | 
| `FormField` | Label, control, hint, error, `aria-describedby` wiring | 
| `SubmitButton` | Spinner + disabled while pending | 
| `FormErrorBanner` | Form-level server error, `role="alert"` | 

### 2.4 Domain

| Widget | Purpose | 
| ----- | ----- | 
| `Badge` | One component, variants `role`, `environment`, `projectStatus`, `auditResult`, `userStatus`. Text always present. | 
| `ProjectCard` | One project on the list. Link when active; locked with badge when archived. | 
| `EnvironmentTabs` | Tab strip above the secrets table. State is `?environment=`. | 
| `SecretsTable` | Frame + column headers | 
| `SecretRow` | One secret: key, value cell, last-accessed, actions | 
| `SecretValueCell` | The reveal state machine, per row. Owns the value in local state. | 
| `MembersTable` | Members list with optional actions column | 
| `AuditLogTable` | Project audit entries | 
| `AdminUsersTable` | Post-MVP | 
 

## 3. Page Specifications

Each page: purpose, data, widgets, controls, states. Deferred items are
noted, not omitted.

### 3.1 `LoginPage` — `/login`

**Authenticate.**

* **Data:** `useLogin`, `useMe` via `PublicOnly`.

* **Layout:** centered card, no shell.

* **Controls:** email (`autocomplete="username"`), password
  (`autocomplete="current-password"`, show/hide), Sign in, link to
  `/signup`.

* **Notices** from `state.reason`: `expired` → "Your session has ended.";
  `logged-out` → "You've been signed out."; `signed-up` → "Account
  created. Sign in to continue."

* **States:** default; submitting; form-level error (generic 401 copy,
  429 rate-limit toast "Too many attempts, try again in 15 minutes",
  network message). No "Forgot password" — Non-Goal.

### 3.2 `SignupPage` — `/signup`

**Create an account with no project access. Story 10.**

* **Data:** `useSignup`.

* **Controls:** email, password (helper text: 8–72 characters), Create
  account, link to `/login`.

* **States:** as login. `409` and `422` map to the email field.

* **On success:** navigate to `/login` with `reason: 'signed-up'`. Signup
  does not log the user in.

### 3.3 `ProjectsPage` — `/projects`

**The dashboard. Stories 5 and 10.**

* **Data:** `useProjects()` → `GET /projects`. Each entry carries `status` and the caller's `role`; archived entries (post-MVP) render as locked cards.

* **Widgets:** `PageHeader`, grid of `ProjectCard`, `EmptyState`,
  `ErrorState`, `Skeleton`, `Toaster`.

* **Controls:**

| Control | Behavior | 
| ----- | ----- | 
| New project | Any authenticated. Opens one-field dialog (`name`). | 
| `ProjectCard` (active) | Links to `/projects/:id/secrets` | 
| `ProjectCard` (archived) | Post-MVP (nothing can archive yet). Not a link. "Archived — a Platform Admin can restore it." | 

* **States:**

  * loading — three `Skeleton card`;

  * error — `ErrorState` + Retry;

  * empty (story 10) — "You're not a member of any projects yet. Create
    a project, or ask a Project Admin to add you using your email
    address: **{me.email}**." Primary action: New project.

* **On create:** navigate to the new project's secrets page.

### 3.4 `ProjectLayout` — `/projects/:projectId`

**Shell for routes 6–8; enforces the member check.** `/projects/:projectId` redirects to `/projects/:projectId/secrets`.

* **Data:** `useProject(id)`. The response includes the caller's `role`; `usePermissions(projectId)` reads it from there.

* **Widgets:** `PageHeader`, `TabNav`, routed content,
  `ProjectArchivedNotice`, `StatusPage`, `ErrorState`, `Skeleton`.

* **Tabs:** Secrets, Members, Audit log (all members).

* **States:**

  * `404` → `StatusPage variant="not-found"` — a missing project and a
    no-membership project are identical by design;

  * `403` → `ProjectArchivedNotice` — post-MVP (unreachable until archive ships; in the MVP, treat as "other error");

  * other error → `ErrorState` + Retry.

* **Malformed `:projectId`:** preferred, not required, to render the
  not-found page without a request. One-line check; skip if it costs
  more than that.

### 3.5 `SecretsPage` — `/projects/:projectId/secrets?environment=`

**List and manage secrets per environment. Stories 1–4.**

* **Data:** `useSecrets(projectId, environment)`. Missing or unknown
  environment → replace to `development`.

* **Widgets:** `EnvironmentTabs`, `SecretsTable`, `SecretRow`,
  `SecretValueCell`, `RevealConfirmDialog`, `Modal`, `ConfirmDialog`,
  `EmptyState`, `ErrorState`, `Skeleton`, `Toaster`.

* **Columns:** Key · Value · Last accessed · Created · Actions.
  (No "Last edited" column — the only timestamp also moves on reveal.)

* **Controls by role:**

| Control | Admin | Dev (dev) | Dev (other) | Auditor | 
| ----- | ----- | ----- | ----- | ----- | 
| View list | ✓ | ✓ | ✓ | ✓ | 
| New secret | ✓ | ✓ | disabled | hidden | 
| Reveal | ✓ | ✓ | ✓ (prod: modal) | hidden | 
| Edit | ✓ | ✓ | disabled | hidden | 
| Delete | ✓ | hidden | hidden | hidden | 

Disabled controls carry a visible reason: "Developers can create and
edit secrets only in the development environment."

* **Create dialog:** environment (options filtered by role), key
  (uppercase on input, `[A-Z0-9_]`, 1–100), value (textarea, ≤ 4 KB).

* **Edit dialog:** value only. Key and environment shown read-only. The
  field starts empty — the current value is never sent outside an
  audited reveal.

* **Reveal lifecycle:** specified in §3.5a.

* **Delete confirm:** "Delete {KEY}? This permanently removes the
  secret. The audit log keeps its name."

* **States:** loading; error (includes 429 toast "Too many reveals, try again in 15 minutes"); empty ("No secrets in {environment} yet"
  with **New secret** where the role may create, text only otherwise).

* **Deferred:** stacked-card mobile layout (horizontal scroll instead).

### 3.5a `SecretValueCell` reveal lifecycle

One cell per row, keyed by secret id; the cell owns the value.

| State | Shows | Entered by | Leaves on |
| ----- | ----- | ----- | ----- |
| `idle` | Fixed-width mask + Reveal | mount; Hide; auto-hide; error; unmount, environment switch or `pagehide` (value cleared) | Reveal click → `confirming` (production) or `pending` (any other environment) |
| `confirming` | `RevealConfirmDialog`, Cancel focused; **no request in flight** | Reveal click on a production secret | Cancel / Esc / backdrop → `idle`, nothing sent; Confirm → `pending` |
| `pending` | Spinner, button disabled | Confirm, or Reveal click outside production | success → `revealed`; any error → `idle` + the toast from §1.5 |
| `revealed` | Value, Hide, Copy | `200 { value }` | Hide, 30 s timer, unmount, environment switch, `pagehide` → `idle` |

Invariants (correctness properties, not features — see §9):

* The value lives only in the cell's local state (or the mutation result). Never in the query cache or a query key, the URL, web storage, or logs.
* `useMutation` with `retry: 0`, `gcTime: 0`, and `reset()` on leaving `revealed`. The button is disabled while `pending`, so a reveal can't be double-submitted.
* Request body: `confirm: false` outside production; `confirm: true` only after Confirm in the dialog. Production is never requested before confirmation.
* Auto-hide after 30 seconds, restarted by a new reveal and cleared on leaving `revealed`. No countdown label; one live-region announcement at reveal ("Value revealed. It will hide in 30 seconds."). Re-revealing costs an audit entry and rate budget.
* The secrets panel is keyed by environment, so switching environments remounts it and clears every cell.
* Copy writes the value to the clipboard and keeps nothing; if the clipboard is unavailable, show a documented fallback (§8).
* Deferred: `visibilitychange` handling; mutation-cache management beyond `gcTime: 0` + `reset()`.

### 3.6 `MembersPage` — `/projects/:projectId/members`

**View and manage the team. Story 5 (partial — add only).**

* **Data:** `useMembers(projectId)` → `{ userId, email, role, createdAt }[]`.

* **Widgets:** `PageHeader`, `MembersTable`, `Modal`, `Skeleton`, `ErrorState`, `Toaster`.

* **Controls (Project Admin only; others read-only):**

| Control | Behavior | 
| ----- | ----- | 
| Add member | Email + role select. No default role — explicit assignment matches story 10. | 

* Change role and Remove are backend-only endpoints (no UI in MVP).

* Add-member errors show on the email field: `404` (no account with that email) and `409` (already a member). The last-admin invariant (`Project.activeAdminCount`) is backend-only in the MVP and can't be triggered from add.

* **States:** loading; error. Empty cannot occur.

### 3.7 `ProjectAuditLogPage` — `/projects/:projectId/audit-log`

**Team-visible transparency. Stories 3, 4, 6 (read-only; no pagination).**

* **Data:** `useProjectAuditLog` — `{ action, result, environment }` from the URL. No pagination — single request with `limit=100` cap. Newest first.

* **Widgets:** `AuditLogTable`, `Skeleton`, `ErrorState`, `EmptyState`.

* **Filters:** action (12 project-scoped actions), result (all / allowed / denied), environment (project's environments; helper text "Only secret actions have an environment.").

* **Columns:** Time · User · Action · Details · Result.

  * Time in the viewer's local timezone; ISO in the `datetime` attribute.

  * User shows `user.email` from the response; a `null` user renders as "Unknown user".

  * Details: `secretKey` + environment badge for secret actions; target
    user + role change for membership actions.

* **Action labels (17 total; the 12 project-scoped shown here):**

| `action` | Label | 
| ----- | ----- | 
| `reveal` / `create` / `edit` / `delete` | Reveal / Create / Edit / Delete secret | 
| `member_added` / `member_role_changed` / `member_removed` | Add / Change role / Remove member | 
| `project_created` / `project_renamed` / `project_environments_changed` / `project_archived` / `project_restored` | Create / Rename / Change environments / Archive / Restore project | 
| `user_activated` / `user_deactivated` / `platform_admin_granted` / `platform_admin_revoked` / `bootstrap_admin` | Platform-wide only — post-MVP | 

Unknown values render raw.

* **States:** loading; error; empty ("No audit entries match these
  filters." with Clear when filters are set; otherwise "No activity
  yet.").

* **Deferred:** historical-environment filtering.

### 3.8 Admin pages — post-MVP

`AdminUsersPage` (backed by the existing `/api/admin/users` endpoints) is the first post-MVP page. `AdminProjectsPage` and `AdminAuditLogPage` also need backend endpoints that don't exist yet. Designs are deferred to Phase 6 (§6); §7 explains what shipping without them costs.

### 3.9 `StatusPage` — `/unauthorized` and `*`

One component, two variants, no shell.

| Variant | Copy | 
| ----- | ----- | 
| `not-found` | "Page not found. The page you're looking for doesn't exist, or you don't have access to it." | 
| `unauthorized` | "You don't have access to this page." | 

Both link to `/projects`. The not-found copy is deliberately identical
for a missing project and an inaccessible one — the API makes the same
promise.

## 4. Per-Role UI Map

Derived from permissions matrix. `E` = enabled, `D` =
disabled with reason, `H` = hidden, `—` = route unreachable.

| Control | Project Admin | Developer (dev) | Developer (other) | Auditor | Platform Admin | 
| ----- | ----- | ----- | ----- | ----- | ----- | 
| View secrets list | E | E | E | E | — (404)¹ | 
| New secret | E | E | D | H | — | 
| Reveal | E | E | E (prod: modal) | H | — | 
| Edit value | E | E | D | H | — | 
| Delete secret | E | H | H | H | — | 
| View members | E | E | E | E | — | 
| Add member | E | H | H | H | post-MVP | 
| View project audit log | E | E | E | E | — | 

Post-MVP controls (archive/restore, admin menu and `/admin/*`) aren't in this grid: they belong to Platform Admin only and don't exist for any project role.

¹ Platform Admin without membership gets 404 on project-scoped routes (`/projects/:id/*`). A platform-wide project overview is post-MVP. 

Team management: add only (change/remove post-MVP). Audit log: read-only (filters kept, pagination post-MVP). Settings post-MVP.

The permission helper is one small module (`lib/permissions.ts`), one
function `can(role, action, environment?) → 'enabled' | 'disabled' | 'hidden'`, consumed through `usePermissions(projectId)`. Not a generic
RBAC framework. A conformance test compares its output against a
fixture transcribed from the permissions matrix.

## 5. Widgets Deliberately Not Built

Trimmed as structural or stylistic, not functional.
Reintroduce only if a real need appears — not speculatively.

| Dropped | Reason | 
| ----- | ----- | 
| Per-type badge components | One `Badge` with a variant prop | 
| Per-shape skeleton components | One `Skeleton` with a shape prop | 
| `PasswordInput`, `EnvironmentListEditor`, `UserLabel`, `TimeStamp` | Formatting helpers, not components | 
| `AdminMenu`, `UserMenu` | Inline in `NavBar` | 
| `FullPageSpinner`, `FullPageError`, `CardSkeleton`, `TableSkeleton` | Collapsed into `FullPageState` / `Skeleton` | 
| `ProjectAdminOnlyHint` guard | Inline where needed | 
| `ProjectTabs`, `AdminTabs` | Collapsed into `TabNav` | 
| Theme toggle | Follow system preference | 
| Cross-tab auth sync | Deferred (P2) | 
| Visual regression testing | Deferred (P2) | 
| Historical-environment filtering | Deferred | 
| Stacked-card mobile tables | Horizontal scroll instead | 
| Reveal countdown UI | Live-region announcement at reveal only | 

## 6. Build Order

Six phases. **Phase 5 is the ship boundary** — Phases 1–5 are the MVP.

**Phase 1 — Foundation**
Project setup, routing shell, `AppShell` / `NavBar` / `TabNav`,
`StatusPage`, `FullPageState`, `Toaster`, API client + interceptors,
`ApiError` + normalizers (§1.5), guards.

**Phase 2 — Auth and projects**
`LoginPage`, `SignupPage`, `ProjectsPage`, `ProjectCard`, create-project
dialog, `ProjectLayout` with its 404 / 403 branches.

**Phase 3 — Secrets**
`SecretsPage`, `EnvironmentTabs`, `SecretsTable`, `SecretRow`,
`SecretValueCell` (the hardest single component),
`RevealConfirmDialog`, create / edit / delete dialogs.

**Phase 4 — Members + Audit (read-only)**
`MembersPage` (list + add dialog), `ProjectAuditLogPage` (table + 3 filters, no pagination).

**Phase 5 — MVP hardening and ship**
P0 tests, small browser smoke suite, error and empty state pass,
accessibility pass, security review, bug fixing. **This is the release.**

**Phase 6 — Platform Admin (post-MVP)**
`AdminUsersPage` with `AdminUsersTable` (backend exists). The admin projects/audit pages and archive/restore need new backend endpoints first.

## 7. The MVP Boundary

```
             MVP ships here
                 │
    Foundation ───────┤
    Auth + Projects ──┤
    Secrets ──────────┤
    Members ──────────┤
    Audit ────────────┤
    Hardening ────────┤
                  ▼
           ── RELEASE ──
                 │
    Admin users UI ───┤   post-MVP, if time
    Admin projects ───┤   (needs new backend)
    Admin audit ──────┤   (needs new backend)

```

**What the MVP demonstrates:** RBAC (three project roles plus the
auditor-never-sees-values invariant), audited secret reveal with
confirmation on production, project-scoped team management (add only), and the
transparency mechanism (read-only audit log) — the four things the product
is built around.

**What the MVP does not cover, and which stories depend on it:**

| Story | Depends on | Effect of shipping MVP | 
| ----- | ----- | ----- | 
| 7 — Deactivate a malicious user | `/admin/users` UI | Backend endpoint exists, no UI — usable only via a raw API call | 
| 8 — Archive a project | `/admin/projects` (not built) | Not available; no backend either | 
| 9 — Platform Admin does not see decrypted secrets | no admin project routes | Demonstrated by absence — no admin route returns secret or project data | 
| 11 — Bootstrapping first Platform Admin | Server-side only | Works regardless |

Story 7 is the sharpest loss — the endpoint exists, but without a UI the only way to respond to a compromised account is a hand-crafted API call (or waiting out the JWT). The team should decide this trade-off knowingly, not discover it after
the deadline.

If time allows one admin page only, build `/admin/users` (story 7) —
the incident-response path is worth more than the archiving path for
this product.

## 8. Definition of Done — MVP

**Authentication**

* \[ \] Login, logout, and protected routes work

* \[ \] 401 handling redirects and clears private cache, firing once when several requests fail together (§1.5)

* \[ \] `GET /auth/me` bootstraps correctly; anonymous state resolves without error

* \[ \] Login/logout own the cache transition (no duplicate cleanup in guards)

**Projects**

* \[ \] Project list renders (cards show status and the caller's role)

* \[ \] Create project works; caller becomes `projectAdmin`

* \[ \] Project detail renders; 404 handled (archived-403 is post-MVP)

**Environments**

* \[ \] Environment tabs switch `?environment=`; selection survives reload

**Secrets**

* \[ \] CRUD works; environment-scoped list is accurate

* \[ \] Reveal works in development without confirmation

* \[ \] Production reveal requires confirmation; cancel sends no request

* \[ \] Revealed value is in component state only; not in query cache

* \[ \] Value clears on hide, unmount, environment switch, and auto-hide

* \[ \] Clipboard copy works (or a documented fallback when unavailable)

**RBAC**

* \[ \] Permission helper is one module; no scattered role checks

* \[ \] Role-conditional controls render correctly per §4

* \[ \] A 403 on a mutation toasts and invalidates the right keys

* \[ \] Backend remains authoritative; the UI is a hint

**Audit**

* \[ \] Project audit log renders; 3 filters work, no pagination (capped at 100 most recent)

* \[ \] Action, result, and environment filters work

* \[ \] Timestamps display in local timezone with ISO in `datetime`

* \[ \] All 12 project-scoped actions map to a label

**Testing**

* \[ \] Auth tests pass (login, logout, 401, unauth route)

* \[ \] Reveal security tests pass (value absent from caches after unmount)

* \[ \] Permission helper conformance test passes

* \[ \] Browser smoke suite passes (login → action → logout; expired
  session; reveal → hide)

**Quality**

* \[ \] No known critical security issues

* \[ \] No known API contract ambiguity — any open issue is recorded in API.md, not hidden

* \[ \] Production build works

* \[ \] Nothing from deferred lists is blocking the release

## 9. What to Do If Time Runs Short

**Already cut from MVP:**
* Project rename / environment editing — no endpoint, no page
* Admin pages and archive/restore — see §7
* Member change/remove UI — backend endpoints exist, no frontend
* Audit pagination — read-only table with 3 filters only

Order of further cuts, from least to most damaging:

1. **Audit filters** — drop to Environment + Result only (Action visually scannable).

2. **Members add dialog** — not a pure cut. Without it, members can only be added by raw `POST /members` calls or a seed script (`server/scripts/`, not in the current plan), so the RBAC demo needs that extra work. Cut audit filters first.

3. **Reveal confirmation modal** for production. Cut only as a last resort — it's the specific control the product is built around.

What to cut **under no circumstances**: the reveal lifecycle invariants
(value never in storage, cleared on unmount, no retry), the 401 flow, or
the permission helper. Those are correctness properties, not features.

The target is a frontend that is **secure → correct → maintainable →
testable → shippable**. Not one that attempts every production-scale
problem before the first release.