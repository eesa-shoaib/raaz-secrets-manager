# Server implementation and testing

## Implemented

- Express bootstrap: Helmet, credentialed CORS, JSON/cookie parsing, Mongo sanitization, CSRF Origin check, redacted Pino logs, standard errors, graceful shutdown.
- Auth: signup, login, logout, current user, httpOnly JWT cookie, token-version and active-user checks, rate limiting, optional signup-domain allowlist.
- Projects: list, create, get. Creation atomically creates creator's `projectAdmin` membership and audit entry.
- Members: list, add, change role, remove. Membership mutations include audit entries and atomic last-Project-Admin protection.

Secret endpoints are implemented but still need replica-set integration coverage. Not implemented: audit-log endpoint, Platform Admin routes, database integration suite.

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
