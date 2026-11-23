# GitHub import and authentication polish — TODO

Status: approved follow-up plan; not implemented. Added 2026-11-23.

Outcome: create a Raaz project from a GitHub repository without retyping its
details, return to import future repositories, and recognize provider accounts
through useful username defaults and consistent authentication buttons.

This plan means GitHub **repositories**. GitHub Projects planning boards, issues,
and task columns are outside this feature. Existing MVP 2 release gates remain
open until their own acceptance evidence is recorded.

## 1. Default GitHub usernames

- [ ] Read GitHub's authenticated `login` alongside its stable user ID during
      provider sign-in. The stable provider ID remains the identity key.
- [ ] On first registration, initialize the Raaz username from the GitHub login,
      normalized through the existing lowercase, 3–30 character username rules.
- [ ] For returning GitHub users without a Raaz username, fill it from GitHub.
      Preserve a username the user has already chosen; repeated sign-in must not
      overwrite it or silently synchronize later GitHub renames.
- [ ] Handle collisions without failing sign-in: try a valid suffix within the
      length limit, using the unique index as the final authority and bounded
      retries. If no candidate can be claimed, leave the optional username unset
      and allow the user to choose one in Settings.
- [ ] Keep username editing available in Settings. Do not introduce username-based
      login or automatic account linking by email.
- [ ] Test first registration, legacy/unset usernames, custom usernames, changed
      GitHub handles, invalid candidates, and concurrent collisions.

## 2. Theme-consistent provider buttons

- [ ] Add GitHub and Google icons to their existing buttons on both sign-in and
      sign-up screens; retain clear visible provider labels.
- [ ] Use theme tokens for icon color, text, borders, hover, focus, and disabled
      states. Match existing control dimensions and spacing; do not hardcode a
      separate provider-colored background.
- [ ] Use monochrome icons where provider asset rules permit. Check official
      Google branding requirements before recoloring its logo; preserve any
      required brand colors while theming the surrounding button.
- [ ] Reuse existing icons or local SVG assets where possible; request approval
      before adding a dependency. Decorative icons must be hidden from assistive
      technology, and the buttons must retain accessible names.
- [ ] Verify configured-provider visibility, pending/error behavior, keyboard
      focus, contrast, and appearance across the supported themes and mobile widths.

## 3. Separate repository access from login

- [ ] Keep basic GitHub sign-in limited to identity/email permissions. Add an
      explicit repository connection step when the user chooses to import.
- [ ] Prefer a GitHub App installation with access to selected repositories and
      only the metadata permissions needed to list and read repository details.
      Do not request code-content access for a metadata-only import.
- [ ] Support personal and permitted organization repositories. Explain when
      organization approval or installation access is required.
- [ ] Bind installation selection and authorization to the authenticated Raaz
      user. Validate accessible repository IDs server-side; never trust a client
      supplied owner, URL, or installation ID as proof of access.
- [ ] Define server-only connection and credential handling before implementation:
      app private key protection, short-lived installation tokens, revocation,
      expiry, timeouts, and safe failure diagnostics. Do not retain login tokens
      just to reuse them for repository access or expose tokens to the browser.
- [ ] Let Google/password users connect GitHub explicitly too. Document secure
      identity-connection rules first; never silently link accounts by email.
- [ ] Provide connection status, Manage GitHub access, and Disconnect through
      existing Settings where practical. Disconnecting must not delete imported
      Raaz projects or remove the user's only sign-in method.

## 4. Import whenever needed

- [ ] Keep Import from GitHub beside Create project on the projects page. Offer
      an optional first-login shortcut; never force import or restrict it to login.
- [ ] Show a searchable, paginated repository picker with owner/name, description,
      visibility, selection, loading, empty, and failed-request states.
- [ ] Fetch fresh accessible repository data when opening or refreshing the picker.
      A repository created after login can be imported without logging out.
- [ ] Explain future-repository access: an installation covering all repositories
      includes new repositories; a selected-repositories installation requires
      granting access to each new repository through Manage GitHub access.
- [ ] Include Refresh repositories and Manage GitHub access actions so a user can
      recover from an empty or incomplete list without repeating sign-in.
- [ ] Handle revoked access, expired authorization, organization restrictions,
      API outages, and rate limits with actionable messages and bounded retries.
      Preserve the Raaz session when only the GitHub connection needs attention.

## 5. Review and create the Raaz project

- [ ] Prefill editable name and description from the selected repository; validate
      them against Raaz's existing limits and handle missing/long descriptions.
- [ ] Show a confirmation preview before creating anything. Cancelling creates no
      Raaz project and changes nothing in GitHub.
- [ ] Store a stable repository ID plus canonical URL and owner/name as the source
      reference. Show the GitHub link in the existing project details right column,
      alongside the description and server-derived member count.
- [ ] Reuse existing project-creation authorization, creator membership, validation,
      transaction, and audit behavior. GitHub collaborators do not automatically
      become Raaz members or receive Raaz roles.
- [ ] Keep Raaz's existing environments. Do not import GitHub environments or
      assume their names map to development, staging, or production.
- [ ] Prevent accidental duplicate submissions with a documented retry/idempotency
      policy. Define duplicate repository import behavior without exposing another
      user's inaccessible projects through a global duplicate check.
- [ ] Make this a one-time metadata import. Later GitHub renames, transfers,
      repository deletion, and permission changes must not silently overwrite or
      delete Raaz data. Keep disconnect and stale-link behavior understandable.

## 6. Explicit limits

- [ ] Explain in the import preview that GitHub Actions secret values cannot be
      retrieved through GitHub's API. This import creates project metadata only;
      it does not create fake secret values or copy secret names into unusable records.
- [ ] Exclude repository cloning, code scanning, `.env` extraction, GitHub Actions
      secret/variable synchronization, collaborator synchronization, and automatic
      bidirectional updates from this first version.
- [ ] Avoid extra dashboards, task-board pages, notifications, or customization
      features that are not required to connect, select, review, and import.

## 7. Contracts and acceptance evidence

- [ ] Before code, update API.md for endpoints, permissions, pagination, connection
      errors, duplicate handling, and audit contracts; DATA_MODEL.md for source
      references, identity data, connection ownership, indexes, and audit actions;
      FRONTEND.md for existing-page composition, query keys, and state handling;
      ARCHITECTURE.md for server-only credentials and authorization boundaries.
- [ ] Update OpenAPI and setup/runbook/environment examples. Any dependency,
      cookie/CSRF change, or boot validation change still needs its required approval.
- [ ] Test user/installation isolation, forged repository IDs, organization access,
      repeated import, duplicate submissions, transaction/audit rollback, revoked
      access, provider failures, pagination, and username collision behavior.
- [ ] Verify that provider credentials, authorization codes, and tokens never reach
      logs, response payloads, client caches/storage, or source control.
- [ ] Walk through: login → import → create a new GitHub repository → refresh →
      grant access if needed → import again, without ending the Raaz session.
- [ ] Run lint, formatting, relevant tests, and production build. Record live GitHub
      App setup and browser acceptance evidence separately from mocked test results.

Done means these flows work with the existing security model and supported themes;
unchecked items are planned work, not delivered functionality.
