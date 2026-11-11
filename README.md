# Raaz — Secrets & Config Manager

A MERN + TypeScript secrets and environment-variable manager for teams, with role-based access control enforced at the data layer.

## Quick Start

```bash
git clone git@github.com:eesa-shoaib/raaz-secrets-manager.git
cd raaz-secrets-manager
npm install          # installs client, server, and shared-schemas via workspaces

# copy and fill in environment variables
cp server/.env.example server/.env
# fill in server/.env, then run these in separate terminals:
npm run dev -w server
npm run dev -w client
```

- Client: `http://localhost:5173`
- Server: `http://localhost:5000`

## Documentation

See [docs/README.md](./docs/README.md) for the full documentation index. What is in or out of the MVP is defined by the _Cut from MVP_ table in [docs/PRODUCT.md](./docs/PRODUCT.md).

## Architecture Overview

```
Client (React + Vite)  →  Server (Express)  →  MongoDB Atlas
```

- **Frontend**: React 18, TypeScript, Vite, Tailwind + DaisyUI, TanStack Query
- **Backend**: Node 22, Express, TypeScript, Mongoose, JWT in httpOnly cookies
- **Database**: MongoDB Atlas (free tier)
- **Shared**: Zod schemas in `packages/shared-schemas`

## MVP Status

**MVP 1 is closed at the owner's direction.** See the
[closure record](./docs/MVP_BOARD.md).

**MVP 2 (Team Pilot) features are implemented and verified locally.** See the
[MVP 2 board](./docs/MVP_2_BOARD.md) and [operations runbook](./docs/RUNBOOK.md):

- **Account settings (`/settings`)**: optional unique username, 256x256 JPEG/PNG/WebP profile picture stored as bounded BSON binary in private `userAvatars` (transactional with audit log), and authenticated password change invalidating active sessions via `tokenVersion`.
- **Platform Admin user management (`/admin/users`)**: cursor-paginated user directory, promote/demote and activate/deactivate with atomic last-active-admin protection (`409 CONFLICT`) and zero substitute access to project data.
- **Project descriptions & editable details**: optional 500-char plain-text description, server-computed read-only `memberCount`, and Project-Admin-only edit modal (`PATCH /api/projects/:projectId`).
- **Cursor pagination & metadata search**: bounded cursor pagination (default 25, max 100) across projects, secrets, members, audit logs, and admin users, plus server-side literal metadata search, `Copy` key action, and accessible permission explanations.
- **Deployment & recovery readiness**: SPA CSP/no-store headers in `client/vercel.json`, `TRUST_PROXY` hop validation, `/api` `no-store` cache headers, mock-seed safety guard, `server/scripts/rehearse-recovery.mjs`, and `docs/RUNBOOK.md`. Live hosted pilot smoke verification requires target Render/Vercel/Atlas credentials.

## Environment Variables

See `server/.env.example` for the full list (including optional `TRUST_PROXY`, `CLIENT_ORIGIN`, `COOKIE_DOMAIN`, `COOKIE_SAMESITE`). Required for local dev:

- `MONGO_URI` — MongoDB Atlas connection string
- `JWT_SECRET` — 32+ char random string
- `MASTER_KEY` — 32-byte base64 AES-256-GCM key
- `MASTER_KEY_VERSION` — Positive integer (e.g., `1`)

MongoDB must support transactions (Atlas or a replica set). Use only a disposable development database. The database named in `MONGO_URI` is the one the server will use.

## License

MIT
