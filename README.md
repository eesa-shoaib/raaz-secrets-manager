# Raaz

Raaz manages encrypted secrets and environment variables for small teams. Project roles control who can retrieve values. Auditors can check that a secret exists and review its history without reading it.

## What it does

Store database URLs, API keys, and other config in projects. Each secret belongs to `development`, `staging`, or `production`; these environments are fixed at project creation.

Lists mask values. Users explicitly reveal secrets, with confirmation required for production. Secret actions and their audit entries commit together; denied project actions are also logged.

Access combines one global flag with three per-project roles:

- **Platform Admin** (`isPlatformAdmin`) manages user accounts across the whole instance. The admin endpoints exist and the `/admin/users` page covers promotion, demotion, and deactivation. Platform Admins get no shortcut into project or secret data.
- **Project Admin** has full control of one project: its secrets, its members, and their roles.
- **Developer** has free rein in `development`. In `staging` and `production` they can reveal a value, and that reveal is logged.
- **Auditor** sees secret metadata and the audit history but never a decrypted value.

Membership is checked before project status, and a non-member gets a `404` rather than a `403` so an archived project's existence doesn't leak.

## How it works

AES-256-GCM encrypts values before storage. Each write uses a fresh IV and binds ciphertext to its project, secret id, environment, and key version. `MASTER_KEY` stays outside MongoDB. Invalid keys, JWT secrets, or origins stop the server at boot.

An httpOnly JWT cookie authenticates requests. The server checks the user’s current `tokenVersion` on every request; password changes and deactivation end sessions. Writes require an `Origin` matching `CLIENT_ORIGIN`. Login/signup are rate-limited by IP; reveal is rate-limited by user.

Both apps use Zod schemas from `packages/shared-schemas`. The server validates requests and parses responses to strip undeclared fields.

```
Client (React + Vite)  →  Server (Express)  →  MongoDB Atlas
```

- Frontend: React 18, TypeScript, Vite, Tailwind + DaisyUI, TanStack Query, React Router
- Backend: Node 22, Express, TypeScript, Mongoose, Zod, pino
- Database: MongoDB Atlas, or any MongoDB deployment that supports transactions
- Shared: Zod schemas in `packages/shared-schemas`

## Running it locally

Use Node 22 or newer and a MongoDB replica set. Atlas supports the transactions required for actions and audit entries; configure a local `mongod` as a replica set.

```bash
git clone git@github.com:eesa-shoaib/raaz-secrets-manager.git
cd raaz-secrets-manager
npm install

cp server/.env.example server/.env
cp client/.env.example client/.env

npm run dev
```

`npm run dev` starts both apps. The client is at `http://localhost:5173` and the API at `http://localhost:5000`.

Four variables in `server/.env` are required before the server will start:

| Variable             | Value                                                         |
| -------------------- | ------------------------------------------------------------- |
| `MONGO_URI`          | Connection string for the database the server should use      |
| `JWT_SECRET`         | Random string of at least 32 characters                       |
| `MASTER_KEY`         | 32 random bytes, base64-encoded, used for AES-256-GCM         |
| `MASTER_KEY_VERSION` | Positive integer identifying the active key (for example `1`) |

Set `PLATFORM_ADMIN_EMAIL` and `PLATFORM_ADMIN_PASSWORD`, boot once, then unset them. Defaults for ports, cookies, proxy hops, logging, and signup domains are in `server/.env.example`.

Use a disposable dev database. There are no migrations; development assumes it can be dropped and recreated.

Other commands, all run from the repo root:

```bash
npm test             # Vitest + Supertest on the server, Vitest + Testing Library on the client
npm run lint         # ESLint, including the module boundary rules
npm run build        # production build for shared-schemas, server, and client
npm run format       # Prettier
npm run seed:mock -w server   # sample projects, users, and secrets for local poking
```

The server tests create their own `raaz_test_*` database on the cluster named in `TEST_MONGO_URI` (falling back to `MONGO_URI`) and drop it when they finish, so they never touch the dev data.

## Documentation

Start with [docs/README.md](./docs/README.md). Detailed contracts and deployment instructions:

- [docs/API.md](./docs/API.md): every endpoint, its request and response shape, error codes, and the permissions matrix
- [docs/DATA_MODEL.md](./docs/DATA_MODEL.md): collections, indexes, field-level rules, and the audit action enum
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md): middleware order, encryption and AAD format, cookie and CSRF policy, caching
- [docs/FRONTEND.md](./docs/FRONTEND.md): routes, pages, widgets, the reveal lifecycle, and the frontend definition of done
- [docs/PRODUCT.md](./docs/PRODUCT.md): the problem, the personas, and the scope table that says what is in and out
- [docs/RUNBOOK.md](./docs/RUNBOOK.md): deploying to Vercel, Render, and Atlas, plus backup and recovery

## License

MIT

## Google and GitHub sign-in

Optional provider buttons appear on login/signup when the server has a valid
client ID, client secret and callback URL for that provider. See
[OAuth setup](./docs/OAUTH_AUTH.md#provider-configuration) and server/.env.example.
Local development callbacks use http://localhost:5173/api/auth/oauth/google/callback
and http://localhost:5173/api/auth/oauth/github/callback through Vite's API proxy.
Production callbacks must use the browser-facing API origin and HTTPS.

Password login stays available. New OAuth accounts have no project membership;
existing-email matches do not auto-link to password accounts or another provider.

### GitHub repository import

Repository import uses a **GitHub App**, separate from the OAuth App used for
GitHub sign-in. Register the app with repository **Metadata: read-only** and
**Contents: read-only** (for example-file seeding), enable
expiring user access tokens, and set its user authorization callback to
`http://localhost:5173/api/integrations/github/callback` in development (your
same-site `/api/integrations/github/callback` URL in production). Do not point
its installation setup URL at the authorization callback. A setup URL may point
to the frontend Projects page; return to the original import dialog and refresh
when installing through Manage GitHub access.

Set these server-only values, then restart the server:

| Variable                   | Purpose                                                |
| -------------------------- | ------------------------------------------------------ |
| `GITHUB_APP_CLIENT_ID`     | GitHub App client ID, separate from `GITHUB_CLIENT_ID` |
| `GITHUB_APP_CLIENT_SECRET` | GitHub App OAuth client secret                         |
| `GITHUB_APP_SLUG`          | App slug from its `github.com/apps/<slug>` URL         |
| `GITHUB_APP_CALLBACK_URL`  | Exact registered user authorization callback URL       |

Generate the client secret under Credentials. Raaz does not use a GitHub App private key; if GitHub requires one for installation, generate it there and keep the PEM outside the repository. User tokens enforce both repository selection and user access. Grants remain encrypted with the existing master key, which must be kept for recovery. Login scopes and cookies stay unchanged. Callbacks require `SameSite=Lax` or `None`; `Strict` blocks the session cookie.

Use Import from GitHub on Projects to connect, select a repository, and review its name. Its description is copied automatically. Imports create normal membership and environments and survive disconnect.

Root `.env.example` (fallback `env.example`) keys can seed development mocks. Source values are discarded; replace `MOCK_VALUE_REPLACE_ME` before use. Missing files create no mocks. Existing installations must approve Contents access and reconnect if prompted; disable seeding to import metadata without it. GitHub Actions secret values cannot be retrieved.

Refresh to see new repositories. Selected-repository installations need access granted first; all-repositories installations include them automatically. Imports scan up to 2000 repositories per installation; narrow app access beyond that limit.
