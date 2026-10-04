---
tags: [tech-stack, decisions, versions, rationale, testing, tooling]
---

# Tech Stack

## Repository Structure

Monorepo using npm workspaces. See PROJECT_STRUCTURE.md for the full
folder layout, module boundaries, and naming rules.

Rationale: a single repo is easier for a two-person team to manage and
submit, and a shared schema package guarantees the frontend and backend
agree on the shape of a `Secret`, `Project`, `User`, and `AuditLogEntry`
without duplicating definitions.

## Frontend

| Tool | Version | Rationale |
|---|---|---|
| React | 18.x | Standard, matches MERN requirement |
| TypeScript | 5.x | Type safety across the app, shared types with backend |
| Vite | 5.x | Fast dev server, first-class TS support, simpler than CRA |
| Tailwind CSS | 3.x | Utility-first styling, required by DaisyUI |
| DaisyUI | 4.x | Pre-built component classes on top of Tailwind, speeds up UI build |
| TanStack Query (React Query) | 5.x | Server-state fetching/caching/invalidation — fits an app that's mostly reads/writes against an API |
| React Router | 6.x | Client-side routing between dashboard and project screens (admin screens post-MVP) |
| React Hook Form | latest | Form state, paired with the shared Zod schemas for validation |
| Axios | latest | HTTP client with interceptors for auth/error handling |

## Backend

| Tool | Version | Rationale |
|---|---|---|
| Node.js | 22.x LTS | Stable long-term support version |
| Express | 4.x | Required by MERN, minimal and well understood |
| TypeScript | 5.x | Type safety, shared types with frontend |
| Mongoose | 8.x | Schema modeling and validation for MongoDB |
| jsonwebtoken | latest | Issuing/verifying auth tokens |
| bcryptjs | latest | Password hashing. Pure-JS, not the native `bcrypt` package — avoids native-module build friction on Render's free tier, at a small, acceptable performance cost for this app's scale |
| Node `crypto` (built-in) | — | AES-256-GCM encryption/decryption of secret values; no third-party crypto library needed |
| tsx | latest | TypeScript execution in dev without a separate compile step |
| express-rate-limit | latest | Rate limiting: per-IP on `/auth/login` and `/auth/signup`, per-user on `/secrets/:id/reveal` |
| helmet | latest | Sets standard security headers (CSP, `X-Content-Type-Options`, etc.) on every response — near-zero setup cost for a real, expected protection on a security-focused app |
| express-mongo-sanitize | latest | Strips `$`/`.` keys from `req.body`/`req.query`/`req.params` before they reach Mongoose, closing the NoSQL-injection gap that parameterized SQL doesn't have a direct equivalent for |
| pino | latest | Structured logger with redaction support for secrets/passwords in logs |
| zod | latest | Schema validation (shared with frontend via shared-schemas) |
| cors | latest | Credentialed CORS for cookie-based auth |
| cookie-parser | latest | Parse httpOnly cookies in Express |

## Shared

| Package | Contents | Rationale |
|---|---|---|
| `packages/shared-schemas` | **Zod schemas** as the single source of truth for each entity (`User`, `Project`, `Secret`, `AuditLogEntry`); TypeScript types are inferred from them with `z.infer<>` | One definition per entity, used for both runtime validation (server request bodies, client forms) and static typing on both sides — no separate hand-written interfaces to fall out of sync. Client-safe schemas live at the package root; server-only base schemas with sensitive fields (`passwordHash`, `ciphertext`/`iv`/`authTag`) live in `shared-schemas/internal` and extend the client-safe ones (see ARCHITECTURE.md's Repository Boundaries). The `exports` map exposes only `"."` and `"./internal"` |

## Database

| Tool | Rationale |
|---|---|
| MongoDB Atlas (free tier) | Used from local development onward, so there's no migration step when deploying later. Connection string is read from an environment variable in both environments. |

## Testing

| Tool | Rationale |
|---|---|
| Vitest | Unit tests for both client and server; integrates natively with Vite, faster than Jest for this stack |
| Supertest | Integration tests against Express routes, especially RBAC middleware (asserting 403s on denied roles) |
| React Testing Library | Component tests for masked/revealed secret rendering, role-based UI branches |

The permissions matrix in API.md is large (six columns × eleven actions, of which archive/restore is post-MVP).
For a two-person team, exhaustively enumerating every cell isn't a good
use of limited time. Prioritize Supertest coverage on the cells API.md's
own "Notes on cells that are easy to get wrong" section flags —
Developer+staging create/edit, Developer+production edit, Auditor+reveal,
Platform Admin membership substitution, the last-Project-Admin invariant —
over completeness for its own sake. Add to that list: a `:secretId` that
belongs to a *different* project than the `:projectId` in the URL must 404
(or equivalent), not resolve — a naive `Secret.findById(secretId)` without
also filtering on `projectId` would let a valid secret id from Project B be
acted on through Project A's URL, which the role check alone wouldn't catch
since it only verifies the caller's role on Project A.

**Concurrent-request tests:** Only the last-Project-Admin invariant is
tested concurrently (requires PATCH/DELETE `/members` endpoints, kept on
backend for this test). The last-Platform-Admin race is documented in API.md but deferred, and the environment-removal race is post-MVP (no environment editing exists) — sequential tests cover the non-race logic.

**Test database:** Tests use `MongoMemoryReplSet` (from `mongodb-memory-server`) for an in-memory replica set. This provides a real replica set so transactions behave as they will on Atlas. Local dev still uses Atlas per ARCHITECTURE.md; the in-memory replica set is only for tests.

## Tooling

| Tool | Rationale |
|---|---|
| ESLint + Prettier | Consistent style across a two-person team |
| npm workspaces | Manages client/server/shared-schemas as one repo without extra tooling like Turborepo, which would be overkill at this scope |
| dotenv | Environment variable loading (`MASTER_KEY`, `MONGO_URI`, `JWT_SECRET`) |

## Deployment (future, not required for current milestone)

| Layer | Target | Rationale |
|---|---|---|
| Frontend | Vercel | Zero-config for Vite/React, generous free tier |
| Backend | Render | Simple free-tier Node hosting, environment variable support |
| Database | MongoDB Atlas | Already in use locally, no migration needed |

**`helmet` doesn't cover the SPA.** Helmet (TECH_STACK.md's Backend table)
sets security headers on the Express API's own responses — it has no
effect on the separately-hosted Vercel static site, which is the page
that actually renders a decrypted secret value into the DOM and is
arguably the higher-value XSS target of the two. The SPA needs its own
headers (CSP at minimum) configured at the Vercel level, e.g. a
`headers` block in `vercel.json`, not inherited from the API. Deferred to
deploy time along with the rest of this section, but worth remembering
it's a second, separate configuration surface, not something `helmet`
already covers end-to-end.

Because the database is already on Atlas and the server reads all secrets
(DB URI, JWT secret, master encryption key) from environment variables, moving
from local-only to deployed later requires **no new secret-handling code**.
It does require a few extra environment variables and cookie attributes. The preferred topology is same-site (a Vercel `/api/*` rewrite to Render, or custom subdomains): set `COOKIE_SAMESITE=Lax`, `CLIENT_ORIGIN`, and `COOKIE_DOMAIN` if subdomains are used. If the two hosts stay on unrelated domains, cookies are cross-site (`SameSite=None; Secure`) and third-party-cookie blocking must be tested — see ARCHITECTURE.md's "Cross-Origin Deployment & CSRF" section for the full policy. That logic is written once, branching on `NODE_ENV` and `COOKIE_SAMESITE`, so it doesn't need to be revisited at deploy time — but it is real code, not purely configuration.
