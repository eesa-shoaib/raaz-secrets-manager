# GitHub import and authentication polish — TODO

Status: repository code implemented; automated verification and operator-owned
live checks are recorded below. Added 2026-11-23; updated 2026-11-24.

Outcome: create a Raaz project from a GitHub repository without retyping its
details, return to import future repositories, and recognize provider accounts
through useful username defaults and consistent authentication buttons.

This plan means GitHub **repositories**. GitHub Projects planning boards, issues,
and task columns are outside this feature. Existing MVP 2 release gates remain
open until their own acceptance evidence is recorded.

## 1. Default GitHub usernames

- [x] Read GitHub's authenticated `login` alongside its stable user ID during
      provider sign-in. The stable provider ID remains the identity key.
- [x] On first registration, initialize the Raaz username from the GitHub login,
      normalized through the existing lowercase, 3–30 character username rules.
- [x] For returning GitHub users without a Raaz username, fill it from GitHub.
      Preserve a username the user has already chosen; repeated sign-in must not
      overwrite it or silently synchronize later GitHub renames.
- [x] Handle collisions without failing sign-in: try a valid suffix within the
      length limit, using the unique index as the final authority and bounded
      retries. If no candidate can be claimed, leave the optional username unset
      and allow the user to choose one in Settings.
- [x] Keep username editing available in Settings. Do not introduce username-based
      login or automatic account linking by email.
- [x] Test first registration, legacy/unset usernames, custom usernames, changed
      GitHub handles, invalid candidates, and concurrent collisions.

## 2. Theme-consistent provider buttons

- [x] Add GitHub and Google icons to their existing buttons on both sign-in and
      sign-up screens; retain clear visible provider labels.
- [x] Use theme tokens for icon color, text, borders, hover, focus, and disabled
      states. Match existing control dimensions and spacing; do not hardcode a
      separate provider-colored background.
- [x] Use matching monochrome, primary-colored Google and GitHub icons across
      both auth forms.
- [x] Reuse existing icons or local SVG assets where possible; request approval
      before adding a dependency. Decorative icons must be hidden from assistive
      technology, and the buttons must retain accessible names.
- [ ] Verify configured-provider visibility, pending/error behavior, keyboard
      focus, contrast, and appearance across the supported themes and mobile widths.

Implementation: existing buttons remain inline on LoginPage and SignupPage.
Google and GitHub use matching local icon masks in the theme's primary color,
without white backings. The provider text remains visible,
icons are decorative, pending redirects show a spinner, and no dependency was
added. Asset sources are recorded in
[OAUTH_AUTH.md](./OAUTH_AUTH.md). Automated provider visibility, pending, and error
checks are part of OAuthForms.test.tsx; live theme/mobile/keyboard review remains
unchecked above until browser evidence is recorded.

## 3. Separate repository access from login

- [x] Keep basic GitHub sign-in limited to identity/email permissions. Add an
      explicit repository connection step when the user chooses to import.
- [x] Prefer a GitHub App installation with access to selected repositories and
      Metadata read-only plus Contents read-only for the explicitly approved
      example-file seeding; no write access.
- [x] Support personal and permitted organization repositories. Explain when
      organization approval or installation access is required.
- [x] Bind installation selection and authorization to the authenticated Raaz
      user. Validate accessible repository IDs server-side; never trust a client
      supplied owner, URL, or installation ID as proof of access.
- [x] Define server-only connection and credential handling before implementation:
      encrypted GitHub App user grants, bounded refresh leases, revocation,
      expiry, timeouts, and safe failure diagnostics. Use user access tokens to
      intersect installation and user permissions; no app private key or broader
      installation-only token is required. Never reuse basic sign-in tokens or
      expose repository credentials to the browser.
- [x] Let Google/password users connect GitHub explicitly too. Document secure
      identity-connection rules first; never silently link accounts by email.
- [x] Provide connection status, Manage GitHub access, and Disconnect through
      existing Settings where practical. Disconnecting must not delete imported
      Raaz projects or remove the user's only sign-in method.

## 4. Import whenever needed

- [x] Keep Import from GitHub beside Create project on the projects page. Offer
      an optional first-login shortcut; never force import or restrict it to login.
- [x] Show a searchable, paginated repository picker with owner/name,
      visibility, selection, loading, empty, and failed-request states.
- [x] Fetch fresh accessible repository data when opening or refreshing the picker.
      A repository created after login can be imported without logging out.
- [x] Explain future-repository access: an installation covering all repositories
      includes new repositories; a selected-repositories installation requires
      granting access to each new repository through Manage GitHub access.
- [x] Include Refresh repositories and Manage GitHub access actions so a user can
      recover from an empty or incomplete list without repeating sign-in.
- [x] Handle revoked access, expired authorization, organization restrictions,
      API outages, and rate limits with actionable messages and bounded retries.
      Preserve the Raaz session when only the GitHub connection needs attention.

## 5. Review and create the Raaz project

- [x] Prefill an editable name and copy the source description automatically without
      displaying it in the picker or review; respect existing field limits.
- [x] Show a confirmation preview before creating anything. Cancelling creates no
      Raaz project and changes nothing in GitHub.
- [x] Store a stable repository ID plus canonical URL and owner/name as the source
      reference. Show the GitHub link in the existing project details right column,
      alongside the description and server-derived member count.
- [x] Reuse existing project-creation authorization, creator membership, validation,
      transaction, and audit behavior. GitHub collaborators do not automatically
      become Raaz members or receive Raaz roles.
- [x] Keep Raaz's existing environments. Do not import GitHub environments or
      assume their names map to development, staging, or production.
- [x] Prevent accidental duplicate submissions with a documented retry/idempotency
      policy. Define duplicate repository import behavior without exposing another
      user's inaccessible projects through a global duplicate check.
- [x] Make this a one-time metadata import. Later GitHub renames, transfers,
      repository deletion, and permission changes must not silently overwrite or
      delete Raaz data. Keep disconnect and stale-link behavior understandable.

## 6. Explicit limits

- [x] Explain in the import preview that GitHub Actions secret values cannot be
      retrieved through GitHub's API. This import can create explicitly marked mock
      development values from root `.env.example` or `env.example` keys; all example-file values are discarded.
- [x] Exclude repository cloning, code scanning, `.env` extraction, GitHub Actions
      secret/variable synchronization, collaborator synchronization, and automatic
      bidirectional updates from this first version.
- [x] Avoid extra dashboards, task-board pages, notifications, or customization
      features that are not required to connect, select, review, and import.

## 7. Contracts and acceptance evidence

- [x] Before code, update API.md for endpoints, permissions, pagination, connection
      errors, duplicate handling, and audit contracts; DATA_MODEL.md for source
      references, identity data, connection ownership, indexes, and audit actions;
      FRONTEND.md for existing-page composition, query keys, and state handling;
      ARCHITECTURE.md for server-only credentials and authorization boundaries.
- [x] Update OpenAPI and setup/runbook/environment examples. Any dependency,
      cookie/CSRF change, or boot validation change still needs its required approval.
- [x] Test user/installation isolation, forged repository IDs, organization access,
      repeated import, duplicate submissions, transaction/audit rollback, revoked
      access, provider failures, pagination, and username collision behavior.
- [x] Verify that provider credentials, authorization codes, and tokens never reach
      logs, response payloads, client caches/storage, or source control.
- [ ] Walk through: login → import → create a new GitHub repository → refresh →
      grant access if needed → import again, without ending the Raaz session.
- [x] Run lint, formatting, relevant tests, and production build. Record live GitHub
      App setup and browser acceptance evidence separately from mocked test results.

Done means these flows work with the existing security model and supported themes;
unchecked items are planned work, not delivered functionality.

## Implementation decisions and evidence

- GitHub App user tokens enforce the intersection of the installation's selected
  repositories and the GitHub user's own permissions. Connections work for any
  authenticated Raaz user without adding or linking a login identity. See
  [GitHub user-token documentation](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app).
- Grants are encrypted with the existing AES-GCM helper, unchanged AAD format,
  and a `github-connection` namespace. No new dependency, cookie policy, boot
  validation rule, key format, or private-key configuration was introduced.
- Repository lists are fresh on open/refresh. Scans and literal search cover up
  to 2000 repositories per installation; larger installations must narrow app
  access. Results are never silently truncated. GitHub and local rate limits
  return guidance without invalidating Raaz sessions.
- Duplicate imports are scoped to creator/repository and return an existing
  project only with current membership. Concurrent duplicate creation is guarded
  by a partial unique index and transaction rollback. Imports never grant GitHub
  collaborators Raaz roles, copy source secret values, or synchronize later metadata.
- Automated integration tests cover session binding, one-use/expired state,
  stale sessions, credential hiding and refresh, fresh repository visibility,
  literal search, forged IDs, per-user isolation, retry idempotency, and audit
  rollback. OAuth tests cover username defaults, existing names, concurrent
  collisions, and audit rollback. Client tests cover review-before-write,
  refresh, explicit consent, provider failures and confirmed disconnect.
- Configure the four `GITHUB_APP_*` variables and separate GitHub App as described
  in README.md. These credentials are not checked in or provisioned by code.
  Real GitHub organization/installation and hosted browser verification remain
  operator-owned; no mocked test is presented as a live GitHub walkthrough.

### Automated verification — 2026-11-24

- `npm run lint`: passed with the pre-existing `no-explicit-any` warning in
  `server/src/services/encryption.service.ts`; no lint errors.
- `npm run format:check` and `git diff --check`: passed.
- `npm run build`: passed for shared schemas, server, and client. Vite retains
  its advisory about the main JavaScript chunk exceeding 500 kB.
- `npm test -w client`: 22 files, 91 tests passed.
- `REQUIRE_TEST_DB=true npm test -w server`: 19 files, 107 tests passed against
  disposable replica-set databases, with no skipped database tests. The first
  full attempt exhausted the Node heap; the pagination suite passed independently,
  and the unchanged full command passed on rerun. No heap limit was increased.
- Real GitHub App consent, organization approval, and visual browser acceptance
  remain unchecked above. Configure the separate App before that walkthrough.

### Approved example-file and UI follow-up — 2026-11-24

The owner requested mock development secrets from root example files, no
descriptions in the import modal, stronger repository-row contrast, and overwrite
verification. Contents read-only replaces the previous metadata-only permission
ceiling for this explicit request. Example files are bounded to 64 KiB/100 keys;
creation is atomic and retries never overwrite existing values.

Overwrite verification confirmed that persisted values and encryption IVs change.
A client regression exposed stale revealed text after import; successful overwrite
now unmounts value cells so another reveal retrieves the replacement. The regression
failed before the fix and passed afterward. Example-file tests verify multiline
parsing, normalized/deduplicated keys, discarded source values, development-only
mocks, no overwrite on retry, permission guidance/opt-out, limits, and atomic
rollback when a mock-secret audit write fails.

Follow-up validation: `REQUIRE_TEST_DB=true npm test -w server` passed all 111
tests across 19 files with no skipped database tests; `npm test -w client` passed
all 92 tests across 22 files. `npm run build`, `npm run lint`,
`npm run format:check`, and `git diff --check` passed. The existing encryption
lint warning and Vite chunk-size advisory remain unchanged. Live GitHub permission
approval and visual browser checks remain operator-owned.
