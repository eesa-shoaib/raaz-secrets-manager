# Raaz — Secrets & Config Manager

A MERN + TypeScript secrets and environment-variable manager for teams,
with role-based access control enforced at the data layer: some roles can
confirm a secret exists without ever being able to retrieve its decrypted
value.

## Docs

This table is the single index of `docs/` — add new docs here when they're
created. **Scope authority:** PRODUCT.md's *Cut from MVP* table is the single
source of truth for what is in or out of the MVP; other docs link to it
rather than restating it.

| Doc | Contents |
|---|---|
| [PRODUCT.md](./PRODUCT.md) | Problem, users, scope, non-goals, user stories, acceptance criteria |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design, components, data flow, boundaries |
| [TECH_STACK.md](./TECH_STACK.md) | Languages, frameworks, tools, versions, rationale |
| [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) | Folder layout, module boundaries, naming rules |
| [DATA_MODEL.md](./DATA_MODEL.md) | Entities, relationships, schema, constraints, migrations |
| [API.md](./API.md) | Endpoints, contracts, errors, pagination, auth, versioning |
| [FRONTEND.md](./FRONTEND.md) | Frontend blueprint: routes, pages, widgets, build phases, MVP boundary |

## Access Model (at a glance)

One global flag plus three per-project roles — see ARCHITECTURE.md for
the full reasoning:

- **`isPlatformAdmin`** (global) — manages users platform-wide (MVP: backend endpoint only, no UI); project archive and platform-wide project/audit views are post-MVP
- **Project Admin** (per project) — full control over their project's secrets and team
- **Developer** (per project) — free access in dev, logged reveal-only access in staging/prod
- **Auditor** (per project) — metadata and audit history only, never decrypted values

## Stack at a Glance

React + TypeScript + Vite + Tailwind/DaisyUI on the frontend, Express +
TypeScript + Mongoose on the backend, MongoDB Atlas for the database. See
[TECH_STACK.md](./TECH_STACK.md) for the full breakdown and rationale, and
[PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) for the folder layout.

## Getting Started (local dev)

See the repository root `README.md` for the quick start. Environment
variables (`server/.env`) — see `server/.env.example` for the canonical
list. This table is the full set; not all are required for local dev.

| Variable | Required for local dev? | Notes |
|---|---|---|
| `MONGO_URI` | Yes | MongoDB Atlas connection string, used even locally |
| `JWT_SECRET` | Yes | Random string, at least 32 characters (checked at boot). Signs the auth cookie's JWT |
| `MASTER_KEY` | Yes | 32-byte AES-256-GCM key, base64-encoded. Validated at boot |
| `MASTER_KEY_VERSION` | Yes | Identifies the single active encryption key for this build (no rotation implemented — see DATA_MODEL.md's Encryption Key Lifecycle). Stored on each secret so a future rotation feature wouldn't require a schema change |
| `PORT` | No (defaults) | Server port, defaults to `5000` |
| `NODE_ENV` | No (defaults to `development`) | Drives cookie `SameSite` behavior — see ARCHITECTURE.md |
| `CLIENT_ORIGIN` | No locally (defaults to `http://localhost:5173`) | Required in production for CORS + the Origin-based CSRF check |
| `JWT_EXPIRES_IN` | No (defaults to `7d`) | See ARCHITECTURE.md's Session & Auth Policy |
| `COOKIE_DOMAIN` | No locally | Required in production if client/server are on different subdomains |
| `COOKIE_SAMESITE` | No (defaults based on `NODE_ENV`) | Overrides the `Lax`/`None` default — set to `Lax` even in production if client/server end up same-site, e.g. via a Vercel `/api` rewrite or custom subdomains (see ARCHITECTURE.md's Cross-Origin Deployment & CSRF) |
| `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD` | No, but needed once | Set on first boot only, to seed the very first Platform Admin — see PRODUCT.md story 11 |
| `SIGNUP_ALLOWED_DOMAINS` | No (defaults to open signup) | Comma-separated email domains (e.g. `acme.com,acme.io`); if set, signup rejects any other domain — see API.md's `/auth/signup` row |
| `LOG_LEVEL` | No (defaults to `info`) | |

### Client (`client/.env`)

See `client/.env.example`.

| Variable | Required for local dev? | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | No (defaults to `http://localhost:5000/api`) | Base URL for the centralized `API_BASE_URL` constant (API.md, Versioning). Use `/api` when the SPA reaches the API through a same-origin Vercel rewrite |

## Status

In development — see [PRODUCT.md](./PRODUCT.md) for what's in scope for
the current build versus deferred as future work.
