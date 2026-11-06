# Server TODO

Foundation, auth, project, membership, secret, project audit-log and Platform Admin user routes are present. Presence of a route does not establish MVP completion: database integration coverage and security review remain outstanding.

## Foundation

- [x] Implement Express bootstrap in `src/index.ts`: config validation, Mongo connection, security middleware, routes, 404 handler, error handler, graceful shutdown.
- [x] Wire `src/routes/index.ts` under unversioned `/api`.
- [x] Configure Pino request/error logging with `password` and `value` redaction.
- [x] Add global async error handling and standard `{ error: { code, message } }` responses.
- [ ] Add request validation for every body, params, and query before controller logic.

## Auth

- [x] Implement signup, login, logout, and current-user routes/controllers.
- [x] Issue HS256 JWT only in httpOnly cookie; never return token in body.
- [x] Re-fetch user on every authenticated request; enforce `tokenVersion` and `isActive`.
- [x] Apply login/signup IP rate limit before authentication.
- [x] Apply Origin CSRF check to all POST, PATCH, and DELETE routes.
- [x] Seed configured first Platform Admin during boot only.

## Projects and members

- [x] Move DB queries and authorization from route handlers into controllers/services.
- [x] Create Project Admin membership during project creation; do not increment count twice.
- [x] Parse all project and membership responses through shared response schemas.
- [x] Implement atomic last-Project-Admin protection with conditional counter updates.
- [x] Keep membership check before project-status check on project-scoped routes.

## Secrets

- [x] Add list, create, edit, delete, metadata, and reveal routes/controllers.
- [x] Scope secret lookups by both `_id` and `projectId`.
- [x] Generate the secret ID before encryption; use a fresh 12-byte IV and documented AAD.
- [x] Return decrypted value only from reveal endpoint.
- [x] Use fixed-width `••••••••` mask in lists.
- [x] Apply per-user reveal limiter after authentication and before role check.
- [x] Enforce Developer write restriction outside `development` in service, with denied audit entry.
- [x] Require `confirm: true` for production reveal; reject missing confirmation with 422 without denied audit.
- [ ] Verify the preceding behavior end to end against a disposable replica set, including response shapes and audit failure handling.

## Audit and administration

- [x] Implement project audit-log route with only action, result, and environment filters; limit ≤100.
- [ ] Write every allowed state change and audit entry in same MongoDB transaction.
- [ ] Write denied project-action audit entries before 403 responses.
- [ ] Preserve environment and secret key in denied secret-route entries when secret exists in project.
- [x] Implement documented backend-only Platform Admin user routes.
- [x] Implement atomic last-Platform-Admin protection for demotion and deactivation; verify against a replica set.

## Tests and verification

- [ ] Add Supertest database integration coverage and disposable replica-set database setup; existing server tests cover foundation behavior, mocked secret routing, and mocked membership counter behavior.
- [ ] Test Developer denied staging create/edit and production edit.
- [ ] Test Auditor reveal denial records environment and secret key.
- [ ] Test Platform Admin membership substitution.
- [ ] Test concurrent last-Project-Admin removal/demotion protection.
- [ ] Test cross-project secret ID returns 404.
- [ ] Test archived project status gate with directly seeded project.
- [ ] Run `npm run lint`, `npm test -w server`, and `npm run build`.
