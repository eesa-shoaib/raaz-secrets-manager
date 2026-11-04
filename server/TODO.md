# Server TODO

Foundation, auth, project, membership and secret routes are implemented; audit and admin routes remain empty. Secret routes still need database integration coverage.

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

- [ ] Implement list, create, edit, delete, metadata, and reveal routes/controllers.
- [ ] Scope every secret lookup by both `_id` and `projectId`.
- [ ] Generate secret ID before encryption; encrypt with fresh 12-byte IV and documented AAD.
- [ ] Return decrypted value only from reveal endpoint.
- [ ] Use fixed-width `••••••••` mask in lists.
- [ ] Apply per-user reveal limiter after authentication and before role check.
- [ ] Enforce Developer write restriction outside `development` in service, with denied audit entry.
- [ ] Require `confirm: true` for production reveal; reject missing confirmation with 422 without denied audit.

## Audit and administration

- [ ] Implement project audit-log route with only action, result, and environment filters; limit ≤100.
- [ ] Write every allowed state change and audit entry in same MongoDB transaction.
- [ ] Write denied project-action audit entries before 403 responses.
- [ ] Preserve environment and secret key in denied secret-route entries when secret exists in project.
- [ ] Implement documented backend-only Platform Admin user routes.
- [ ] Implement atomic last-Platform-Admin protection for demotion and deactivation.

## Tests and verification

- [ ] Replace smoke-only test with Supertest suite and disposable replica-set database setup.
- [ ] Test Developer denied staging create/edit and production edit.
- [ ] Test Auditor reveal denial records environment and secret key.
- [ ] Test Platform Admin membership substitution.
- [ ] Test concurrent last-Project-Admin removal/demotion protection.
- [ ] Test cross-project secret ID returns 404.
- [ ] Test archived project status gate with directly seeded project.
- [ ] Run `npm run lint`, `npm test -w server`, and `npm run build`.
