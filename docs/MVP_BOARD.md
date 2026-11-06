---
tags: [kanban, mvp, tracking]
---

# MVP Board

Source: [[PRODUCT.md#Cut from MVP]] | [[FRONTEND.md#Build Order]]

Status: Phases 1–4 are marked complete based on the project owner's verification. Local build, lint, formatting, and the current test suites have passed. Phase 5 hardening remains open, including database-backed security and transaction tests. Individual backlog stories remain unchecked until their specific outcomes are recorded.

## Backlog

- [ ] Story 1: Developer views a dev secret (AC: no confirm, audit logged)
- [ ] Story 2: Developer reveals a production secret (AC: confirm modal, audit logged)
- [ ] Story 3: Developer attempts to edit a production secret (AC: 403, denied audit)
- [ ] Story 4: Auditor reviews without seeing values (AC: list metadata only, reveal 403)
- [ ] Story 5: Project Admin manages team (AC: add, change role, remove; last admin protected)
- [ ] Story 6: Project Admin reviews project activity (AC: read-only log, 3 filters)
- [ ] Story 7: Platform Admin deactivates malicious user (AC: backend endpoint only)
- [ ] Story 8: Platform Admin archives project (AC: post-MVP, full cut)
- [ ] Story 9: Platform Admin does not implicitly see decrypted secrets (AC: demonstrated by absence)
- [ ] Story 10: New signup has no default project role (AC: empty dashboard)
- [ ] Story 11: Bootstrapping first Platform Admin (AC: server-side only)
- [ ] Story 12: Audit records survive action failures (AC: transaction or 500)

## Phase 1 — Foundation

The project owner reports this phase verified. Automated auth tests cover bootstrap and the unauthenticated flow.

- [x] Project setup, routing shell
- [x] `AppShell` / `NavBar` / `TabNav`
- [x] `StatusPage`, `FullPageState`, `Toaster`
- [x] API client + interceptors, `ApiError` normalizers
- [x] Guards (`RequireAuth`, `PublicOnly`)
- [x] **Definition of Done**: Auth tests pass, 401 flow works

## Phase 2 — Auth and Projects

The project owner reports this phase verified.

- [x] `LoginPage`, `SignupPage`
- [x] `ProjectsPage`, `ProjectCard`, create-project dialog
- [x] `ProjectLayout` with 404/403 branches
- [x] **Definition of Done**: Project list renders, create works, detail renders

## Phase 3 — Secrets

The project owner reports this phase verified. Additional database-backed security and transaction tests remain part of Phase 5.

- [x] `SecretsPage`, `EnvironmentTabs`, `SecretsTable`
- [x] `SecretRow`, `SecretValueCell` (reveal lifecycle)
- [x] `RevealConfirmDialog`, create/edit/delete dialogs
- [x] **Definition of Done**: CRUD works, reveal dev works, prod confirm works, value never in cache

## Phase 4 — Members + Audit (Read-Only)

The project owner reports this phase verified. Last-admin concurrency and audit behavior still need database-backed integration tests in Phase 5.

- [x] `MembersPage` (list, add, change role, and remove)
- [x] `ProjectAuditLogPage` (table + 3 filters, no pagination)
- [x] **Definition of Done**: Membership controls work with last-admin errors; audit log renders with filters

## Phase 5 — MVP Hardening & Ship

Latest local checks: production build, lint, formatting, 23 client tests, and 21 server tests passed. Lint reported one existing warning; several tests use mocks. A real browser smoke suite, replica-set integration tests, accessibility pass, and security review remain outstanding.

- [ ] P0 tests
- [ ] Small browser smoke suite
- [ ] Error and empty state pass
- [ ] Accessibility pass
- [ ] Security review
- [ ] Bug fixing
- [ ] **Definition of Done**: All DoD items in [[FRONTEND.md#Definition of Done — MVP]]

## Post-MVP (Deferred)

- [ ] Admin users UI (`/admin/users`) — backend endpoints exist and need integration testing
- [ ] Admin projects UI (`/admin/projects`) — needs backend
- [ ] Admin audit UI (`/admin/audit-log`) — needs backend
- [ ] Project archive/restore — needs backend
- [ ] Project rename / environment editing
- [ ] Audit log pagination
- [ ] Historical-environment filtering
- [ ] Reveal countdown UI
- [ ] Cross-tab auth sync
- [ ] Visual regression testing
