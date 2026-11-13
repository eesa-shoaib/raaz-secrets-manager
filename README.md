# Raaz

Raaz (Hindi/Urdu for "secret") is a secrets and environment-variable manager for small teams. It keeps a project's config values encrypted in MongoDB and decides who may read them, so a compliance reviewer can confirm that a production key exists and see who touched it without ever being able to read the value.

## What it does

A team creates a project and stores its secrets in it: database URLs, API keys, signing tokens, whatever usually ends up pasted into Slack or passed around as a plaintext `.env`. Each secret belongs to one environment (`development`, `staging`, or `production`), and every environment is fixed at project creation, so there is no chance of an "almost production" environment drifting out of policy.

The secret list is masked. Nothing decrypts until someone asks for a reveal, and production reveals require an explicit confirmation in a dialog. Every create, edit, reveal, delete, and denied attempt is written to the project's audit log in the same transaction as the action itself, so a successful response always comes with a matching log entry.

Access combines one global flag with three per-project roles:

- **Platform Admin** (`isPlatformAdmin`) manages user accounts across the whole instance. The admin endpoints exist and the `/admin/users` page covers promotion, demotion, and deactivation. Platform Admins get no shortcut into project or secret data.
- **Project Admin** has full control of one project: its secrets, its members, and their roles.
- **Developer** has free rein in `development`. In `staging` and `production` they can reveal a value, and that reveal is logged.
- **Auditor** sees secret metadata and the audit history but never a decrypted value.

Membership is checked before project status, and a non-member gets a `404` rather than a `403` so an archived project's existence doesn't leak.

## How it works

Values are encrypted with AES-256-GCM before they reach the database. Every write gets a fresh random IV, and the ciphertext is bound to its project, secret id, environment, and key version through additional authenticated data, which means a copied ciphertext can't be replayed under a different secret. The master key comes from the `MASTER_KEY` environment variable and is never stored in the database. The server refuses to boot if the key, the JWT secret, or the allowed origins are misconfigured.

Authentication uses a JWT in an httpOnly cookie, verified on every request against the user's current `tokenVersion`, so deactivating an account or changing a password ends its sessions. State-changing requests must carry an `Origin` matching `CLIENT_ORIGIN`. Rate limits apply per IP to login and signup, and per user to reveal.

Request and response bodies are validated with Zod schemas from `packages/shared-schemas`, shared by both apps. Responses are parsed through those schemas before they leave the server, so an undeclared field can't slip into a payload.

```
Client (React + Vite)  →  Server (Express)  →  MongoDB Atlas
```

- Frontend: React 18, TypeScript, Vite, Tailwind + DaisyUI, TanStack Query, React Router
- Backend: Node 22, Express, TypeScript, Mongoose, Zod, pino
- Database: MongoDB Atlas, or any MongoDB deployment that supports transactions
- Shared: Zod schemas in `packages/shared-schemas`

## Running it locally

You need Node 22 or newer and a MongoDB connection string pointing at a replica set. Atlas works out of the box; a local `mongod` needs to be started as a replica set because the audit log and its action commit in one transaction.

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

To create the first Platform Admin, also set `PLATFORM_ADMIN_EMAIL` and `PLATFORM_ADMIN_PASSWORD` and boot the server once. Unset them afterwards. Every other variable, including the server port, cookie settings, proxy hop count, log level, and the signup domain allowlist, is listed with defaults in `server/.env.example`.

Point this at a disposable database. There are no migrations, and the dev database is expected to be dropped and recreated at will.

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

`docs/` holds the detail this README only summarizes. Start at [docs/README.md](./docs/README.md) for the index, which links each doc with a one-line description. The ones most people want first:

- [docs/API.md](./docs/API.md): every endpoint, its request and response shape, error codes, and the permissions matrix
- [docs/DATA_MODEL.md](./docs/DATA_MODEL.md): collections, indexes, field-level rules, and the audit action enum
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md): middleware order, encryption and AAD format, cookie and CSRF policy, caching
- [docs/FRONTEND.md](./docs/FRONTEND.md): routes, pages, widgets, the reveal lifecycle, and the frontend definition of done
- [docs/PRODUCT.md](./docs/PRODUCT.md): the problem, the personas, and the scope table that says what is in and out
- [docs/RUNBOOK.md](./docs/RUNBOOK.md): deploying to Vercel, Render, and Atlas, plus backup and recovery

## License

MIT
