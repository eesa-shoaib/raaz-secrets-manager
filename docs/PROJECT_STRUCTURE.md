---
tags: [structure, conventions, naming, boundaries, module-rules]
---

# Project Structure

## Folder Layout

```
raaz/
|-- client/
|   |-- src/
|   |   |-- components/       # reusable presentational components
|   |   |-- pages/             # one file per route/screen
|   |   |-- hooks/              # TanStack Query hooks (useProjects, useSecrets, ...)
|   |   |-- context/            # UI-only state (active tab, modal open/closed)
|   |   |-- api/                 # axios instance + typed request functions
|   |   |-- lib/                 # client-side utilities
|   |   |   `-- permissions.ts   # can(role, action, env?) helper
|   |   `-- main.tsx
|   |-- .env.example         # VITE_API_BASE_URL
|   |-- index.html
|   `-- package.json
|-- server/
|   |-- src/
|   |   |-- routes/             # Express routers, one per resource
|   |   |-- controllers/        # request/response handling, no business logic
|   |   |-- services/            # business logic (encryption, audit logging, RBAC lookups): encryption/audit/membership/secrets services — also called by middleware
|   |   |-- middleware/          # authenticate, requireProjectRole,
|   |   |                        # requireProjectRoleOrPlatformAdmin, requirePlatformAdmin,
|   |   |                        # requireProjectStatus (active-only check), rate limiters
|   |   |                        # (login/signup/reveal), csrf (Origin check), validate (Zod)
|   |   |-- models/               # Mongoose schemas
|   |   `-- index.ts
|   |-- .env.example
|   `-- package.json
|-- packages/
|   `-- shared-schemas/          # Zod schemas (source of truth) + inferred TS types
|       `-- src/
|           |-- index.ts          # exports client-safe schemas only
|           |-- user.ts           # publicUserSchema, signup/login inputs
|           |-- project.ts
|           |-- secret.ts         # secretResponseSchema, secretCreateInputSchema
|           |-- auditLog.ts
|           `-- internal/         # server-only base schemas (userSchema, secretSchema); blocked from client/
|-- README.md                  # quick start; links to docs/README.md
|-- docs/
|   |-- README.md                # docs index
|   |-- PRODUCT.md
|   |-- ARCHITECTURE.md
|   |-- TECH_STACK.md
|   |-- PROJECT_STRUCTURE.md
|   |-- DATA_MODEL.md
|   |-- API.md
|   `-- FRONTEND.md
`-- package.json                  # npm workspaces root
```

## Module Boundaries

- `client/` never imports anything from `server/`. It only imports from `packages/shared-schemas` (package root only, never `/internal`) for types and client-side form validation.
- `server/` never imports anything from `client/`.
- `packages/shared-schemas` has no dependency on either `client/` or
  `server/` — it's a leaf package both sides depend on, never the reverse.
- Within `server/`, **controllers** only parse the request and call a
  **service**; they contain no encryption, no direct database queries, and
  no authorization logic. **Services** contain business logic (encrypting a
  secret, writing an audit log entry, checking project membership) and are
  the only layer that talks to Mongoose models directly.
- **Middleware** is where authorization decisions are made, with one
  documented exception: the `development`-only write restriction for
  `developer` depends on the target environment, which middleware doesn't
  have yet (it's in the request body on create, or on the existing
  document on edit) — that one check lives in the service layer instead.
  See ARCHITECTURE.md's RBAC Pipeline for the full reasoning.
  **Middleware calls `membership.service` and `audit.service` for lookups and writes (membership lookups, denied AuditLogEntry writes).**
  Everywhere else, controllers can assume `req.user` and `req.projectRole`
  (if applicable) are already validated by the time they run.

## Naming Rules

| Item               | Convention                             | Example                                                                                                                    |
| ------------------ | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| React components   | PascalCase file + component name       | `SecretCard.tsx`                                                                                                           |
| Hooks              | camelCase, `use` prefix                | `useSecrets.ts`                                                                                                            |
| Server route files | kebab-case, `.routes.ts` suffix        | `secrets.routes.ts`                                                                                                        |
| Server controllers | kebab-case, `.controller.ts` suffix    | `secrets.controller.ts`                                                                                                    |
| Server services    | kebab-case, `.service.ts` suffix       | `encryption.service.ts`                                                                                                    |
| Server middleware  | kebab-case, `.middleware.ts` suffix    | `require-project-role.middleware.ts`                                                                                       |
| Mongoose models    | PascalCase, singular                   | `Secret.ts` exporting model `Secret`                                                                                       |
| Shared schemas     | camelCase, matches entity              | `secret.ts` exporting `secretResponseSchema` + inferred type; the server-only `secretSchema` lives in `internal/secret.ts` |
| Test files         | mirrors source file, `.test.ts` suffix | `secrets.controller.test.ts`                                                                                               |
| Env variables      | SCREAMING_SNAKE_CASE                   | `MASTER_KEY`, `MONGO_URI`                                                                                                  |

## Import Direction (by convention, plus one ESLint rule)

```
client/  --+
           +--> packages/shared-schemas
server/  --+
```

No arrow points back into `client/` or `server/` from anywhere else. If a
future change requires the server to know about a client-only concept,
that's a signal the concept belongs in `shared-schemas` instead.

**`shared-schemas/internal`** holds the server-only base schemas (the ones with `passwordHash`, `ciphertext`, etc.). They are built by _extending_ the client-safe schemas, not the other way round, so the client bundle never contains those field names. `client/` is blocked from importing it by an ESLint `no-restricted-imports` rule, and the package's `exports` map exposes only `"."` and `"./internal"`.
