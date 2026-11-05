# Client MVP checklist

This is a handoff checklist for implementing client behavior against the Raaz API. [FRONTEND.md](./FRONTEND.md) defines the routes, behavior, widgets, query keys, and MVP definition of done. [API.md](./API.md) defines the endpoint contracts and permissions; [PRODUCT.md](./PRODUCT.md) defines the MVP boundary. If this checklist disagrees with those documents, the authoritative document wins.

## Starting point

- The client currently has a basic routing/UI skeleton. Most files in `client/src/api/` and `client/src/hooks/`, and most MVP pages, are empty.
- Server auth, projects, memberships, and secret routes exist. Their security-sensitive behavior still needs database-backed integration tests; coordinate contract mismatches with the backend developer.
- The project audit-log and Platform Admin endpoints are not implemented. Don't assume every request in [openapi.json](./openapi.json) is available or up to date.
- Keep roles and authorization decisions on the server. The client permissions module only guides the UI.

## Phase 1: foundation and authentication

- [x] Build one credentialed Axios instance in `client/src/api/`, with the API base URL and a normalized `ApiError { status, code, message }`.
- [x] Configure TanStack Query in `client/src/lib/queryClient.ts`: queries retry once for network/5xx errors and never for 4xx; mutations never retry.
- [x] Implement signup, login, logout, and current-user API functions and hooks; use the httpOnly cookie, never browser storage for a token.
- [x] Implement the documented routes, app shell, `RequireAuth` and `PublicOnly` guards, and loading/error states.
- [x] Implement the deduplicated 401 flow in FRONTEND.md §1.5: clear the query cache, then navigate to login. Login and logout own their cache transitions; guards do not clear it.
- [x] Map network, 401, 403, 404, 409, 422, 429, and 500 responses according to FRONTEND.md §1.5.

## Phase 2: projects

- [x] Implement project list, creation, and project detail API functions and hooks.
- [x] Build `ProjectsPage`, create-project dialog, and `ProjectLayout`, including documented loading, empty, 403, and 404 behavior.
- [x] Use the query keys and invalidation rules in FRONTEND.md §1.5.
- [x] Review `client/src/lib/permissions.ts` against API.md's Permissions Matrix and expose it through `usePermissions(projectId)`; avoid scattered role checks.

## Phase 3: secrets

- [x] Implement environment-filtered secret list and create/edit/delete API functions and hooks. Use the server contract for request and response shapes.
- [x] Build `SecretsPage`, environment navigation, the secrets table, and create/edit/delete dialogs. Gate actions through `usePermissions`.
- [x] Implement `SecretValueCell` using a mutation with `retry: 0` and `gcTime: 0`. Keep decrypted values in cell-local state, never in query data or keys, URLs, browser storage, or logs.
- [x] For production, send no reveal request until the user confirms; cancel sends nothing. Send `confirm: false` for non-production and `confirm: true` after production confirmation.
- [x] Clear revealed values on Hide, after 30 seconds, on unmount, environment switch, and `pagehide`; reset the mutation on leaving the revealed state.
- [x] Invalidate the relevant secret list on create, edit, delete, and settled reveal, as specified in FRONTEND.md §1.5.

## Phase 4: members and audit

- [x] Implement member list and add-member API functions, hooks, and `MembersPage`; add-member accepts email and an explicitly selected role.
- [x] Map add-member `404` and `409` to the documented field errors.
- [x] Coordinate the project audit-log page and its three filters with the backend developer; its endpoint is not yet implemented. Do not add pagination.
- [x] Keep member role-change/removal UI out of the MVP, even though backend routes exist.

## Verification and handoff

- [x] Add auth tests for login, logout, and the deduplicated 401 flow.
- [x] Add a permissions-helper conformance test using a fixture transcribed from the API permissions matrix.
- [x] Add reveal security tests covering production confirmation, cancellation, hide/unmount cleanup, and absence of revealed values from caches.
- [x] Add the documented browser smoke coverage: login → action → logout, expired session, and reveal → hide.
- [x] Run `npm run lint`, `npm test -w client`, `npm run format:check`, and `npm run build`; check FRONTEND.md §8 before marking a phase done.

## Useful code

- `client/src/pages/App.tsx`: current route shell; `pages/` contains page placeholders.
- `client/src/api/`, `hooks/`, and `lib/queryClient.ts`: intended API and data-flow layers.
- `client/src/lib/permissions.ts` and `hooks/usePermissions.ts`: permission helper and hook.
- `client/src/components/SecretValueCell.tsx`: intended owner of reveal state.
- `packages/shared-schemas/src/index.ts`: public schemas; import only from the package root in client code.
- `server/src/routes/`: currently mounted server endpoints; see [server/TODO.md](../server/TODO.md) for outstanding backend work.

Do not add post-MVP admin UI, project archive/rename, member role-change/removal UI, audit pagination, or extra widgets outside the inventory in FRONTEND.md.
