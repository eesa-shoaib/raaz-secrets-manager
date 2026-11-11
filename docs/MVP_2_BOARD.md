---
tags: [kanban, mvp, planning, release, active]
---

# MVP 2 — Team Pilot

**Status: code, automated tests, CI, and runbook implemented; hosted staging walkthrough and live browser pilot pending operator environment.** Updated 2026-11-11.

**Outcome:** a small, known team can use a hosted Raaz instance daily: manage
access through the UI, change a known password, review activity older than the
latest 100 entries, recognize teammates, understand what each project is for,
find a secret quickly, and rely on tested access isolation and documented recovery.
A release means a usable team pilot with evidence, not enterprise readiness or
completion of every feature in the backlog.

[PRODUCT.md](./PRODUCT.md#cut-from-mvp) owns scope;
[API.md](./API.md) owns contracts and permissions;
[FRONTEND.md](./FRONTEND.md) owns frontend inventory. This board defines delivery
order and acceptance, not already-implemented API contracts.

## Scope and dependencies

Work is organized by user outcome and dependency.
The existing two-person team can split frontend/backend work; both review
security changes. No new dependency or paid service is assumed approved.

| ID    | Deliverable                                               | User benefit                                                   | Depends on                                                  |
| ----- | --------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------- |
| M2-01 | Close MVP 1 security verification gaps                    | Trust access boundaries and the audit trail                    | Isolated replica-set test database                          |
| M2-02 | Platform Admin users UI                                   | Manage accounts without API tooling                            | Admin endpoint proof from M2-01                             |
| M2-03 | Change a known password in account settings               | Maintain account security without operator help                | Auth/session proof; shared settings surface from M2-07      |
| M2-04 | Pagination across every resource list                     | Browse complete project, secret, member, audit and admin lists | Audit proof from M2-01                                      |
| M2-07 | Account settings, username and profile picture            | Recognize yourself and teammates                               | Profile contracts; approved image storage/processing design |
| M2-08 | Project description and editable project details          | Understand a project's purpose and keep its name accurate      | Project authorization proof from M2-01                      |
| M2-09 | Metadata search, copy-key actions and useful empty states | Reach the right project/secret and finish routine tasks faster | Existing lists; descriptions from M2-08                     |
| M2-05 | Hosted deployment and recovery runbook                    | Use Raaz reliably outside local development                    | Hosting access; storage design from M2-07                   |
| M2-06 | Browser/accessibility review, pilot and release           | Complete daily workflows without avoidable friction            | All included feature slices and deployment proof            |

IDs remain stable so references from MVP 1 still resolve. Build complete vertical
slices after their prerequisites pass. Start deployment/storage decisions early;
verify the complete set on staging before release. Security proof and recovery
are release gates even when product features appear finished.

## Pages and navigation decisions

| Surface                                                                        | Decision                                                                             | Why                                                                                    |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Account settings (`/settings`)                                                 | Add one authenticated page with Profile and Security sections                        | One predictable place for username, picture and password; entry in the account menu    |
| Project details                                                                | Use the project page’s existing right-side column; edit name/description in a dialog | Context stays beside secrets; these two fields do not justify a separate settings page |
| Admin users (`/admin/users`)                                                   | Keep the planned admin-only page                                                     | Platform-wide account management is separate from personal settings                    |
| Project/secret search                                                          | Put controls in existing list headers                                                | Finding an item should not require another page                                        |
| Public profile, general settings hub, avatar gallery page, notification center | Do not add                                                                           | No current workflow requires them                                                      |

These are planned surfaces. Before implementation, update FRONTEND.md's routes,
widget ceiling, query keys, empty states and navigation, API.md's contracts and
permissions, and DATA_MODEL.md's fields/indexes/audit actions. Reuse existing
forms, dialogs, avatar styles and permission helpers; additions stay within the
revised documented inventory. Keep the current visual theme.

## M2-01 — Security and transaction proof

- [x] Use a disposable, isolated MongoDB replica set for tests. Assert the test
      target is safe before setup; never drop a real team's database. Choose an
      available test replica set or explicitly approve a test-only dependency.
- [x] Add real Supertest cases for Developer staging create/edit and production
      edit denial, Auditor reveal denial with environment/key in the audit entry,
      Platform Admin membership substitution, and no-membership 404 with no audit.
- [x] Prove a Project B secret ID under Project A returns 404 for each existing
      secret lookup route; malformed IDs still return 422.
- [x] Prove action + allowed audit entry commit together; inject audit failure and
      assert rollback and 500. Denied audit failure must produce 500 instead of 403.
- [x] Prove atomic last-Project-Admin protection with concurrent requests. Check
      demotion/deactivation of the last active Platform Admin sequentially.
- [x] Cover archived-project status using direct seeding; archive/restore remains
      outside this milestone.
- [x] Prove IV freshness on create/edit, AAD binding, key-version mismatch failure,
      and absence of encrypted fields/password hashes in public responses.
- [x] Verify dummy-hash login behavior, disabled users, stale token versions,
      bootstrap counters, and session invalidation without sensitive fixture output.
- [x] Validate production confirmation (422 without confirm; no denied entry),
      reveal limits, CSRF, and value cleanup after hide, timeout, pagehide, navigation,
      unmount and environment change. Inspect caches and network responses safely.

**Done:** tests execute without mocks at the DB/transaction boundary; assertions
cover persisted state and audit records, not just response status. Record commands
and results. Broken security invariants block release regardless of UI completion.

## M2-02 — Platform Admin user management

- [x] Update FRONTEND.md for `/admin/users`, `RequirePlatformAdmin`, navigation,
      query keys, permissions and widget inventory before adding the screen. Scope
      only the required user-management widgets; no general admin dashboard.
- [x] Reuse `GET /api/admin/users` pagination and `PATCH /api/admin/users/:userId`
      for deactivate/reactivate and promote/demote. No replacement backend subsystem.
- [x] Confirm changes; handle pending, empty, failed request and last-admin 409.
      Refresh affected queries after success; recover correctly after self-demotion
      or self-deactivation. Include disabled users in the management flow.
- [x] Ensure a non-admin cannot open the screen or call its endpoints; client
      controls use a central permission rule rather than scattered flag checks.
- [x] Prove a deactivated user's existing session fails on the next request and
      historical audit attribution remains. Platform Admin alone grants no access
      to project data or decrypted values.

**Done:** an operator can manage users through the UI without API tooling; backend
checks remain authoritative; the last-active-admin invariant cannot be bypassed.

## M2-03 — Change a known password

This is an authenticated settings action, not password recovery.

- [x] Document the endpoint, settings route, validation, limits, permission rule,
      errors, audit action, and session behavior in API.md / FRONTEND.md /
      DATA_MODEL.md before code. Place this form in the Security section of the
      shared `/settings` page from M2-07; do not add a second account page.
- [x] Require the current password and validate the new password against the
      existing 8–72 character policy. Apply the current Origin/auth pipeline and a
      documented limit against password-guessing attempts. No password in a URL.
- [x] Keep sensitive hash selection inside the auth service; explicitly document
      the narrow password-change exception to the current login-only hash lookup
      rule before implementation. Do not weaken select:false or public schemas.
- [x] Commit the password hash change, tokenVersion increment, and platform-wide
      allowed audit entry atomically. No project ID or password material in that entry.
- [x] On success, invalidate all existing sessions including the current one,
      clear the cookie/client cache, and require login with the new password. A
      failed current-password check leaves credentials and sessions unchanged.
- [x] Test wrong password, invalid new password, audit failure rollback, stale
      sessions, old/new login behavior and 401/429 UI handling. Redact both current
      and new password fields explicitly in logs and errors.

**Done:** a signed-in user can change their password; the old password and old
sessions fail. Existing boot, cookie, CSRF and encryption policy stay intact.
Forgotten-password recovery remains unavailable and must be stated in onboarding;
this release is for a known team, not unrestricted public self-service.

## M2-04 — Pagination across every resource list

**User story:** I can browse every authorized result without downloading entire
collections, and search/filter changes apply to the whole collection.

| Existing list                                            | Planned pagination                                              | Scope/filter constraints                                                           |
| -------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Projects (`GET /api/projects`)                           | Add cursor pagination                                           | Membership-scoped; project name/description search before pagination               |
| Secrets (`GET /api/projects/:projectId/secrets`)         | Add cursor pagination                                           | Project + selected environment; secret-key search before pagination; metadata only |
| Members (`GET /api/projects/:projectId/members`)         | Add cursor pagination                                           | Project-scoped; any future member search must precede pagination                   |
| Project audit (`GET /api/projects/:projectId/audit-log`) | Add cursor pagination                                           | Keep action/result/environment filters; allow access beyond latest 100             |
| Platform Admin users (`GET /api/admin/users`)            | Retain existing page/limit contract; add cursor mode for the UI | Admin-only; preserve existing callers and exclude image bytes                      |
| Future Platform Admin lists                              | Must be paginated when introduced                               | Does not authorize building deferred admin project/audit pages                     |

- [x] Inventory existing request/response shapes before implementation. Update
      API.md first with a default page size of 25, maximum 100, deterministic
      ordering, cursor validation and end-of-list representation. Keep documented
      legacy requests working or explicitly document a compatibility transition;
      do not silently replace array/page envelopes consumed by current callers.
- [x] Use a shared cursor convention for new UI calls, with list-specific stable
      sorting and an ID tie-breaker: audit `(createdAt, _id)` descending; other
      lists use documented immutable creation/membership timestamps plus `_id`.
      Reject incompatible pagination modes and invalid limits/cursors with 422.
      Cursors are navigation hints, never authorization credentials.
- [x] Enforce project membership/admin authorization and every filter/search
      predicate before selecting a bounded page. Validate cursor scope so a
      Project B cursor cannot expose Project B data under a Project A URL.
- [x] Return bounded metadata, next-cursor and has-more information in the new
      mode; do not require expensive total counts for cursor navigation. Inspect
      query indexes and query plans before adding indexes to the free cluster.
- [x] Add Previous/Next controls and a reset-to-first/newest action to the
      existing project cards and member/secret/audit/admin tables. Keep previous
      cursors in page-local state; no infinite scroll or separate pagination page.
      Disable controls while pending and at boundaries; announce loading/errors.
- [x] Include cursor, page size, project, environment, search and filters in query
      keys as applicable. Reset cursor history on scope/filter/search/size change.
      Invalidate the relevant list on create/edit/delete/role changes; recover
      from deletion of the last item on a page without trapping users on emptiness.
- [x] Fetch search results server-side across all authorized rows, with bounded
      normalized input and safe literal matching; never load every page merely
      to filter in the browser. Search by metadata only; no decryption involved.
- [x] Paging away from a secret row unmounts it and clears revealed local state
      and mutation data. Returning to that page must show a masked cell. Cursor
      caching must never retain decrypted values or image bytes.
- [x] Test every list with zero rows, one page, multiple pages, invalid cursors,
      equal timestamps, insertion/deletion between requests, filter/search reset,
      cross-project scope, permission loss and final-page recovery. Check the
      existing admin page/limit callers still work. Test reveal cleanup on paging.

**Done:** projects, secrets, members, audit entries and admin users all have
bounded server queries and working navigation. Existing rows remain reachable
without duplicates/skips caused by newly inserted rows; new rows appear after
reset/refresh. No unauthorized results or secret values enter list responses.

## M2-07 — Account settings and recognizable teammates

**User story:** I can set a username and picture once, recognize teammates in
members/audit views, and manage my own account from a single place.

- [x] Add `/settings` behind RequireAuth with Profile and Security sections.
      Navigate there from the existing account menu and provide a return link.
      Password change is M2-03, not a duplicate form on another route.
- [x] Add an optional unique username: trim and lowercase, 3–30 ASCII letters,
      digits, underscores or hyphens. Enforce uniqueness atomically with a partial
      unique index for accounts that have a username; map collisions to 409.
      Existing users without a username continue to work. Keep email-only login
      and email-based member addition; username is identity presentation, not a
      new authentication method or permission key.
- [x] Allow username editing, show unsaved/pending/error/success states, and do
      not add a required profile-setup wizard or block secret access on completion.
- [x] Offer an optional uploaded profile picture with preview, replace and remove.
      Removing it restores the existing initials fallback. No camera access or
      separate crop/editor workflow; fit the image into the existing circle.
- [x] Store normalized thumbnails as BSON binary in a separate `userAvatars`
      collection in the existing Atlas application database; one document per
      user with a unique userId index. Keep payloads out of User/public JSON and
      list responses. Serve bytes through an authenticated, authorized image
      endpoint. No local server disk, public bucket or extra storage provider.
      Document the upload/read/delete contract and approve image-processing
      dependencies before implementation.
- [x] Accept only bounded raster uploads (JPEG, PNG, WebP; max 2 MiB and bounded
      decoded dimensions). Validate actual file content, normalize to a small
      256 × 256 thumbnail capped at 128 KiB and strip metadata. Reject SVG/HTML
      and arbitrary remote URLs. Reject images that cannot meet the output cap.
      Document size/rate limits and safe error handling before implementation.
- [x] Only the account owner can change their profile. Serve avatar images only
      to the owner, shared-project members, or authorized admin user management;
      no public user directory or guessable unauthenticated image access. Never
      embed a third-party image that contacts an external service on page load.
- [x] Define profile-update audit actions and transactional behavior before code.
      Keep audit payloads minimal: no image bytes, file paths or signed URLs.
      Preserve stable user IDs/email attribution; profile changes do not grant
      roles, rewrite old audit entries, or invalidate sessions unnecessarily.
- [x] Show username with email as secondary identification in the account menu,
      member list and admin users; use it as the actor label in audit history with
      email available. Keep roles explicit. Share one avatar treatment with a
      broken-image/initials fallback and accessible labeling.
- [x] Test unset/duplicate usernames, legacy accounts, unauthorized profile/image
      access, malformed/oversized images, replace/remove failure cleanup and stale
      UI caches. Profile updates must not accept isPlatformAdmin/isActive fields.
- [x] Commit avatar insert/replace/remove and its allowed audit entry in one
      transaction using ordinary collection operations. Keep the previous image
      if validation/storage/audit fails; do not retain replaced image versions.
      Test quota/storage failures, uniqueness races and rollback; include avatar
      documents in the backup/restore rehearsal.

### Storage decision and free-tier limits

Research checked 2026-11-11; storage is planned, not provisioned. Atlas Free
supports ordinary collections. Its documented 0.5 GB data limit includes all
uncompressed documents and indexes, shared by avatars, audit history, encrypted
secrets and other data. Reserve capacity for the application's core records;
check usage before rollout and monitor growth. A quota failure must not delete
the previous avatar or leave an unaudited profile change.

GridFS creates a logical bucket such as `avatars.files` / `avatars.chunks` inside
the database; it is not an S3-style bucket or a separate free storage allowance.
The documented collection-based design indicates it can be used within Free
cluster limits, but it has not been exercised on this project's Atlas account.
For thumbnails below 16 MiB, MongoDB recommends considering a single binary
document. GridFS does not support multi-document transactions, so ordinary binary
avatar documents are the simpler fit for Raaz's transactional audit requirement.
Do not introduce GridFS just to obtain a bucket abstraction.

Sources: [Atlas Free limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/),
[Node driver GridFS buckets](https://www.mongodb.com/docs/drivers/node/current/crud/gridfs/),
[GridFS suitability and transactions](https://www.mongodb.com/docs/manual/core/gridfs/).

**Done:** a user can save a username/photo, see consistent identity across the
existing screens, and remove the photo. Upload failure preserves the previous
profile. Existing accounts and email-based membership workflows remain usable.

## M2-08 — Project context without a settings maze

**User story:** I can tell why a project exists and which application/team it
belongs to, and a Project Admin can correct those details without recreating it.

- [x] Add optional plain-text project description, trimmed and at most 500
      characters, to create and project responses. Existing projects use an empty
      description; no rewrite of existing secrets or encryption metadata.
- [x] Extend the create-project dialog with the optional field. Show a short
      preview on project cards and the full description in the project page’s existing
      right-side information column, alongside project name, member count, role and status. Keep
      the details visible across Secrets, Members and Audit tabs. On narrow screens,
      stack the same panel with the main content; do not add a separate details page.
      Omit empty placeholders; do not create an extra description widget.
- [x] Show a read-only Members count in the same right-side details/description
      panel, even when description is empty. Use the server-provided `memberCount`
      from the project detail response, not the size of a paginated members page.
      Count all current ProjectMembership records, including deactivated accounts
      that still hold membership; removing membership decreases the count.
- [x] Calculate the count in the project service after membership/status checks;
      do not add a stored counter or expose member identities with the count.
      All project members may read it; Platform Admin alone gains no access.
      Refresh project detail after add/remove and on return to the project view.
      A failed/loading count must not be displayed as zero; keep other details usable.
- [x] Place an Edit details control in that right-side column, opening one dialog for name (existing limits) and
      description. Only Project Admins can edit; all project members can read.
      Platform Admin without membership receives no substitute permission.
- [x] Update PRODUCT.md scope first, then document the proposed project update
      endpoint, request/response schemas, permission action, denied/allowed audit
      behavior and query invalidation in the authoritative docs before code.
      Preserve membership-before-status ordering and transactional audit writes.
- [x] Treat both fields as project metadata, never as a place for passwords or
      secret values. Render plain text, not HTML/Markdown. Scope metadata reads to
      membership and avoid writing description bodies to request/audit logs.
- [x] After saving, update project cards, panel, metadata search and browser title
      where the name changed. A failed request leaves saved data unchanged.
- [x] Test legacy/empty descriptions, length limits, markup rendering, Developer/
      Auditor denial, non-member 404, archived project denial and audit rollback.
      Test count accuracy across member pages, add/remove, deactivated members,
      empty descriptions, loading/failure and permission loss.

**Done:** the project right-side panel shows description and an accurate total
member count independent of member pagination. Project Admins can edit name and
description with clear save/error feedback; member count remains read-only. The three canonical
environments, project membership and encrypted secrets are unchanged.

## M2-09 — Find items and remove small daily obstacles

- [x] Add case-insensitive project search by name/description in the existing
      projects header. Filter only authorized project metadata. Preserve the
      unfiltered empty-dashboard onboarding state separately from no matches.
- [x] Add secret-key search within the selected environment in the existing
      secrets header. Search names only, never values or ciphertext; do not
      reveal, decrypt or issue reveal requests while searching.
- [x] Use server-side metadata search with M2-04 pagination so matches outside
      the loaded page are not silently missed. Keep terms in component state, not
      persistent storage or telemetry; reset secret search on environment change.
- [x] Add an explicit Copy key action using the existing row controls, with brief
      success/failure feedback. Copy the variable name only; this task does not
      add automatic copying or broaden the reveal-value lifecycle.
- [x] Use existing empty/error surfaces: explain first-project creation,
      first-secret creation, awaiting membership, and search with no results.
      Show next actions only when permitted; offer Clear search for no matches.
- [x] Explain disabled permission controls accessibly (for example a Developer's
      production write restriction); do not scatter role checks or add a new
      permissions screen. Keep production confirmation and reveal expiry intact.
- [x] Test whitespace/case handling, clear/reset, no results, permission changes,
      copy failure and keyboard use. Verify search does not mutate cached data,
      leak unauthorized project metadata, or change reveal permissions.

**Done:** a teammate can identify a project from its description, find a secret
by key, copy its name and understand the next available action. Validate these
actual tasks in the pilot rather than counting newly added controls.

## M2-05 — Deploy and prove recovery

- [ ] Confirm the frontend/API/database topology and production configuration
      with the operator. Use existing deployment guidance; do not change cookie,
      Origin, proxy or boot validation policy merely to make deployment work.
- [x] Document environment-variable names, bootstrap credential removal, exact
      proxy hop count, HTTPS, health checks and rollback commands (`docs/RUNBOOK.md`).
      Never copy values from `.env` into docs, logs, tickets or CI artifacts.
- [x] Configure SPA security headers separately from API helmet (`client/vercel.json`).
      CSP allows only needed sources, accounts for current fonts and title-bootstrap
      script via exact SHA-256 hash (`'sha256-6zvHRTnWnumRA79SzEClncEe2pylk2sI00HwVIriHpA='`),
      and avoids `unsafe-inline` on scripts.
- [ ] Verify login/cookies/CSRF, expired sessions, reveals and rate limits through
      the actual hosted origin (requires live Vercel/Render/Atlas environment).
      Express `/api` middleware and `vercel.json` enforce `Cache-Control: no-store`.
- [x] Document encrypted backups, access control and retention for data and the
      active encryption key (protected separately) in `docs/RUNBOOK.md` and implement
      automated restoration/decryption rehearsal (`server/scripts/rehearse-recovery.mjs`,
      executed in CI against a single-node MongoDB replica set).
- [x] Write an operator runbook (`docs/RUNBOOK.md`) for user deactivation, lost-password escalation,
      suspected secret exposure, downtime, restore and release rollback. No
      unaudited password-reset bypass or new reset endpoint added.
- [x] Stop automatic dev seed/drop scripts from targeting persistent data
      (`server/scripts/create-mock-data.mjs` non-local guard; `rehearse-recovery.mjs`
      and `test-db.ts` disposable DB assertions).

**Done (repo artifacts):** deployment config, CSP headers, proxy validation, mock/recovery guards,
rehearsal automation, and `docs/RUNBOOK.md` are committed and verified in CI; live hosted staging
smoke verification awaits operator Vercel/Render/Atlas provisioning.

## M2-06 — Pilot and release gate

- [ ] Real hosted browser smoke tests (Playwright/manual against live staging; RTL
      unit/component suites verify reveal cleanup, auth, admin, settings, pagination,
      search, Copy key, and Edit details locally/in CI).
- [ ] Live hosted visual/accessibility review (keyboard focus, contrast, mobile widths
      on live deployed build).
- [x] Review logs, API response schemas, authorization order and frontend cache
      behavior; fix blocker defects found during verification.
- [x] Run the repository CI jobs from a clean checkout: install, shared build,
      lint, formatting, server replica-set integration tests, recovery rehearsal,
      client tests, full production build.
- [ ] Complete a small-team acceptance walkthrough on live staging and record
      final hosted operator sign-off.
- [x] Update API.md, DATA_MODEL.md, FRONTEND.md, README env/setup instructions,
      OpenAPI, RUNBOOK.md and AGENTS.md references so implemented behavior has one
      clear source of truth. Mark board items done only with recorded evidence.

**Release rule:** no unresolved authorization, plaintext leak, audit consistency,
lockout or recovery defect. If a gate fails, keep the release blocked and record
the cause and remaining work. Completion depends on acceptance evidence.

## Scope control

Every addition must help someone identify, find, manage or safely use an existing
resource. Profile pictures support recognition; project descriptions explain
purpose; search reduces scanning. These benefits are acceptance criteria, not
reasons to create separate dashboards or customization systems.

Security/session fixes, browser proof and recovery gates are required. Any feature
deferred from this board must also be marked deferred in PRODUCT.md, with the
remaining product limitation stated clearly. Do not silently reduce acceptance
criteria or mark planned behavior delivered.

**Beyond this milestone:** project archive/restore, custom environments,
project-wide/global admin overviews, email invites/verification/password reset,
username-based login, editable login email, public profiles, bios, social links,
custom themes, badges, gamification, notification feeds, drag-and-drop dashboard
builders, rich-text descriptions, arbitrary external avatar URLs, plaintext
import/export, CLI/service tokens, SSO/MFA, secret versioning, key rotation,
expiry reminders, cross-tab auth sync and visual regression tooling.
