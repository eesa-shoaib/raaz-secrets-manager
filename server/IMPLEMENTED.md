# Server implementation and testing

## Release status

MVP 1 is closed by owner acceptance; database/browser/security proof is carried
forward. [The active MVP 2 board](../docs/MVP_2_BOARD.md) plans profile/avatar and
password changes, project descriptions/name editing, all-list pagination and
hosted recovery validation. These extensions are not implemented merely because
they appear in docs. The sections below describe the existing backend and setup.

## Implemented

- Express bootstrap: Helmet, credentialed CORS, JSON/cookie parsing, Mongo sanitization, CSRF Origin check, redacted Pino logs, standard errors, graceful shutdown.
- Auth: signup, login, logout, current user, httpOnly JWT cookie, token-version and active-user checks, rate limiting, optional signup-domain allowlist.
- Projects: list, create, get. Creation atomically creates creator's `projectAdmin` membership and audit entry.
- Members: list, add, change role, remove. Membership mutations include audit entries and atomic last-Project-Admin protection.
- Secrets: list by environment, create, edit value, delete, metadata, and reveal. The response uses a fixed-width mask; production reveal requires confirmation. Developer writes are limited to development.

The project audit-log and backend-only Platform Admin user routes are implemented. Secrets, audit, and administrative operations still need replica-set integration coverage; the database integration suite is not implemented.

The client includes API modules, hooks, and MVP pages. The API specification describes the intended contract; implementation and security behavior still need integration verification.

## Setup

Create `server/.env` with `MONGO_URI`, `JWT_SECRET` (32+ characters), `MASTER_KEY` (base64-encoded 32 bytes), and `MASTER_KEY_VERSION=1`.

Run:

```bash
npm run dev -w server
```

## Manual API test

Sign up or log in, saving cookie:

```bash
curl -i -c cookies.txt -H 'Origin: http://localhost:5173' -H 'Content-Type: application/json' -d '{"email":"you@example.com","password":"password123"}' http://localhost:5000/api/auth/login
```

Create project:

```bash
curl -i -b cookies.txt -H 'Origin: http://localhost:5173' -H 'Content-Type: application/json' -d '{"name":"Demo"}' http://localhost:5000/api/projects
```

Copy returned project `id`, then list projects and members:

```bash
curl -i -b cookies.txt http://localhost:5000/api/projects
curl -i -b cookies.txt http://localhost:5000/api/projects/<projectId>/members
```

Create a secret as a project admin using `POST /api/projects/<projectId>/secrets` with JSON fields `key`, `environment`, and `value`. Keys use uppercase letters, numbers, and underscores; environments are `development`, `staging`, and `production`. List metadata at `GET /api/projects/<projectId>/secrets?environment=development`. Reveal using `POST /api/projects/<projectId>/secrets/<secretId>/reveal` with `{"confirm":false}`, or `{"confirm":true}` for production. State-changing requests require the configured `Origin` and an authentication cookie. Do not use real credentials or secrets in shared examples or logs.

Add member:

```bash
curl -i -b cookies.txt -H 'Origin: http://localhost:5173' -H 'Content-Type: application/json' -d '{"email":"member@example.com","role":"developer"}' http://localhost:5000/api/projects/<projectId>/members
```

## Automated checks

```bash
npm test -w server
npm run build -w server
```

## Mock data through the API

With the server running against a disposable database, set a private
`MOCK_USER_PASSWORD` (8–72 characters) in `server/.env` or your shell and run:

```bash
npm run seed:mock -w server
```

The script creates three uniquely named users, two projects, adds a developer
and auditor to each, and attempts to create a mock secret in each environment.
It reports created users and project IDs, including partial progress if a
request fails; it does not delete them. Login with the printed owner email and
the password supplied through the environment. Optional variables are
`MOCK_API_URL` (default `http://localhost:5000/api`), `MOCK_CLIENT_ORIGIN`
(default `http://localhost:5173`) and `MOCK_EMAIL_DOMAIN` (default
`example.com`; set it to an allowed domain when signup is restricted).

Secret creation uses the documented `/projects/:projectId/secrets` endpoint.
