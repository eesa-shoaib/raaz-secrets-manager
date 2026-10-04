---
tags: [kanban, mvp, tracking]
---

# MVP Board

Source: [[PRODUCT.md#Cut from MVP]] | [[FRONTEND.md#Build Order]]

## Backlog
- [ ] Story 1: Developer views a dev secret (AC: no confirm, audit logged)
- [ ] Story 2: Developer reveals a production secret (AC: confirm modal, audit logged)
- [ ] Story 3: Developer attempts to edit a production secret (AC: 403, denied audit)
- [ ] Story 4: Auditor reviews without seeing values (AC: list metadata only, reveal 403)
- [ ] Story 5: Project Admin manages team (AC: add member only in MVP)
- [ ] Story 6: Project Admin reviews project activity (AC: read-only log, 3 filters)
- [ ] Story 7: Platform Admin deactivates malicious user (AC: backend endpoint only)
- [ ] Story 8: Platform Admin archives project (AC: post-MVP, full cut)
- [ ] Story 9: Platform Admin does not implicitly see decrypted secrets (AC: demonstrated by absence)
- [ ] Story 10: New signup has no default project role (AC: empty dashboard)
- [ ] Story 11: Bootstrapping first Platform Admin (AC: server-side only)
- [ ] Story 12: Audit records survive action failures (AC: transaction or 500)

## Phase 1 — Foundation
- [ ] Project setup, routing shell
- [ ] `AppShell` / `NavBar` / `TabNav`
- [ ] `StatusPage`, `FullPageState`, `Toaster`
- [ ] API client + interceptors, `ApiError` normalizers
- [ ] Guards (`RequireAuth`, `PublicOnly`)
- [ ] **Definition of Done**: Auth tests pass, 401 flow works

## Phase 2 — Auth and Projects
- [ ] `LoginPage`, `SignupPage`
- [ ] `ProjectsPage`, `ProjectCard`, create-project dialog
- [ ] `ProjectLayout` with 404/403 branches
- [ ] **Definition of Done**: Project list renders, create works, detail renders

## Phase 3 — Secrets
- [ ] `SecretsPage`, `EnvironmentTabs`, `SecretsTable`
- [ ] `SecretRow`, `SecretValueCell` (reveal lifecycle)
- [ ] `RevealConfirmDialog`, create/edit/delete dialogs
- [ ] **Definition of Done**: CRUD works, reveal dev works, prod confirm works, value never in cache

## Phase 4 — Members + Audit (Read-Only)
- [ ] `MembersPage` (list + add dialog)
- [ ] `ProjectAuditLogPage` (table + 3 filters, no pagination)
- [ ] **Definition of Done**: Members add works, audit log renders with filters

## Phase 5 — MVP Hardening & Ship
- [ ] P0 tests
- [ ] Small browser smoke suite
- [ ] Error and empty state pass
- [ ] Accessibility pass
- [ ] Security review
- [ ] Bug fixing
- [ ] **Definition of Done**: All DoD items in [[FRONTEND.md#Definition of Done — MVP]]

## Post-MVP (Deferred)
- [ ] Admin users UI (`/admin/users`) — backend exists
- [ ] Admin projects UI (`/admin/projects`) — needs backend
- [ ] Admin audit UI (`/admin/audit-log`) — needs backend
- [ ] Project archive/restore — needs backend
- [ ] Project rename / environment editing
- [ ] Member change/remove UI
- [ ] Audit log pagination
- [ ] Historical-environment filtering
- [ ] Reveal countdown UI
- [ ] Cross-tab auth sync
- [ ] Visual regression testing