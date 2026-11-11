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
[closure record](./docs/MVP_BOARD.md); outstanding security/browser verification
is carried forward, not claimed complete.

**MVP 2 is planned, not implemented.** The [active board](./docs/MVP_2_BOARD.md)
organizes work by outcome and dependency, without weekly schedules:

- Account settings: optional username and profile picture, plus password change.
- Project name/description in the project page's right-side column, with an edit
  dialog for Project Admins; the same panel stacks on mobile.
- Server-side pagination for projects, secrets, members, audit and admin users;
  metadata search and copy-key actions on existing screens.
- Platform Admin users UI, security proof, hosted deployment and recovery testing.

Profile thumbnails are planned as binary documents in a private `userAvatars`
collection in the existing Atlas database, served through authorized API reads.
No upload endpoint, avatar collection, new settings page or storage service is
claimed implemented. Do not put secret values in profile/project metadata.

The server has authentication, project, membership, secret, project audit-log, and backend-only Platform Admin user routes. Security-sensitive behavior still needs replica-set integration tests. The client includes API modules, hooks, and MVP pages; see the frontend checklist for outstanding verification.

The accepted MVP 1 feature set includes:

- Project-scoped secrets with environment isolation (dev/staging/prod)
- Role-based access: Project Admin, Developer, Auditor
- Audited secret reveals with production confirmation modal
- Per-project team management (add members, change roles, and remove members)
- Read-only audit log with filtering

For current server setup, manual testing, and mock data generation, see [server/IMPLEMENTED.md](./server/IMPLEMENTED.md). See [server/TODO.md](./server/TODO.md) for remaining server work.

## Environment Variables

See `server/.env.example` for the full list. Required for local dev:

- `MONGO_URI` — MongoDB Atlas connection string
- `JWT_SECRET` — 32+ char random string
- `MASTER_KEY` — 32-byte base64 AES-256-GCM key
- `MASTER_KEY_VERSION` — Positive integer (e.g., `1`)

MongoDB must support transactions (Atlas or a replica set). Use only a disposable development database. The database named in `MONGO_URI` is the one the server will use.

## License

MIT
