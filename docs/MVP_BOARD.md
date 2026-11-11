---
tags: [kanban, mvp, tracking, completed]
---

# MVP 1 — Complete

**Status: complete; closed 2026-11-10 at the project owner's direction.**

The core feature milestone is accepted. New work is tracked in
[MVP 2 — Team Pilot](./MVP_2_BOARD.md). The original scope remains in
[PRODUCT.md](./PRODUCT.md#cut-from-mvp).

## Delivered scope

| Phase                 | Outcome                                                                           | Acceptance record                                             |
| --------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1 — Foundation        | Routing, shared UI, API errors, authentication guards, 401 handling               | Previously marked verified by the project owner               |
| 2 — Auth and Projects | Signup/login/logout, project list/create/detail                                   | Previously marked verified by the project owner               |
| 3 — Secrets           | Environment-scoped CRUD, masked metadata, confirmed production reveal and cleanup | Previously marked verified by the project owner               |
| 4 — Members and Audit | Add/change/remove membership, last-admin handling, filtered read-only audit log   | Previously marked verified by the project owner               |
| UI follow-up          | Branding, compact auth forms, notifications, route-specific tab titles            | Implemented; automated checks recorded in the working session |

Platform Admin user list/update endpoints and first-admin bootstrap are part of
the backend scope. No Platform Admin UI, archive/restore, project settings, or
audit pagination is claimed as delivered in MVP 1.

## Closure and verification record

MVP 1 is closed as a product milestone. Its former Phase 5 is **carried forward**,
not marked as tested or security-approved. Latest checks recorded in this session:
formatting, lint, production build, 39 client tests; the server suite previously
passed 21 tests. These are historical local results, not a new CI run or a
production-readiness certification. Lint has one existing server warning.

The old story checklist mixed delivered behavior, unverified acceptance cases,
and explicitly deferred Story 8 (archive/restore). It is retired in favor of the
delivered-scope table above and the explicit follow-up gates below. The original
story definitions remain in PRODUCT.md; closing this board does not assert that
every acceptance criterion has independent integration-test evidence.

## Work transferred to MVP 2

- Replica-set tests for permissions, scoped lookups, encryption, transactional audit
  rollback, bootstrap/session behavior, and last-admin invariants (M2-01).
- Real browser smoke coverage, accessibility, error/empty states, security review,
  and bug fixing (M2-05 / M2-06).
- Admin user management UI and pagination across resource lists (M2-02 / M2-04).
- Deployment, backup/restore proof, and operational handoff (M2-05).

Account settings with usernames/profile pictures, project descriptions/name
editing, and metadata search/copy-key actions are also planned in MVP 2 (M2-07
through M2-09). Archive/restore, editable environments, platform-wide project/audit
views, reveal countdowns, and cross-tab auth sync remain deferred beyond MVP 2.
