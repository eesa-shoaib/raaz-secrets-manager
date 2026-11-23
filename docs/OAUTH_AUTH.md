---
tags: [auth, oauth, planning, security]
status: implemented-awaiting-provider-smoke
---

# Google and GitHub sign-in/signup

Implemented 2026-11-22. Provider-mocked protocol tests and disposable replica-set
integration tests cover the flow. Real Google/GitHub and hosted-browser smoke
checks still require operator-owned credentials; they are not claimed complete.
Existing password login, project roles and Raaz session-cookie policy remain intact.

## User experience

Add Continue with Google and Continue with GitHub to both existing auth forms.
Use the same flow for sign-in and first-time registration. Preserve email/password
login and the current theme; use inline buttons rather than another auth page.
Only show providers configured on the server. Provider denial, expired attempts,
missing verified email and service failures return a clear generic notification
without credentials or provider error bodies in the URL/UI.

Both auth forms use decorative local provider icons, existing themed borders and
text, and a spinner during redirect. GitHub uses a primary-colored mask of its
[official Octicon](https://github.com/primer/octicons/blob/main/icons/mark-github-16.svg)
(notice in `client/src/assets/github-mark.LICENSE.txt`). Google's
[official G asset](https://developers.google.com/static/identity/images/g-logo.png)
is also rendered as a primary-colored monochrome mask to match GitHub's icon.
These local assets add no SDK, dependency, runtime third-party fetch, or OAuth scope.

Successful first-time registration signs the user in and opens the projects
page with no default membership. Returning identities resume the same Raaz user.
No provider app has been registered and no live deployment has been performed by this change.

## Protocol and contract

- Start on a POST from the existing auth form, protected by the existing Origin
  policy and an IP rate limit. Return a server-generated authorization URL; the
  browser navigates directly to that URL. Never accept a caller-supplied issuer,
  authorization/token endpoint or unrestricted return URL.
- Use authorization code flow with S256 PKCE and unpredictable state for both
  providers. Google also uses OIDC nonce and validated ID-token signature,
  issuer, audience, expiry, nonce and stable subject. GitHub identity comes from
  the server-side authenticated `/user` response and its verified email API.
- Request only identity/email scopes: Google openid/email (profile only if needed)
  and GitHub user:email. Do not request repository, organization or offline access.
- Routes: POST `/api/auth/oauth/:provider/start`, GET
  `/api/auth/oauth/:provider/callback`, and GET `/api/auth/oauth/providers` for
  enabled-provider metadata. Authenticated deactivation starts at POST
  `/api/auth/oauth/:provider/deactivate/start`. API.md defines schemas, statuses,
  limits and fixed callback redirects. Provider path is an enum, not an arbitrary URL.
- Bind each short-lived attempt to the initiating browser and provider. Store
  only a hash of the random browser-binding token, expected state, verifier/nonce,
  intent and expiry server-side. Consume the attempt atomically before exchange;
  reject replay, mismatch, expiry or missing binding. TTL cleanup alone does not
  enforce expiry. Support only fixed same-origin client return destinations.
- A temporary host-only httpOnly callback-binding cookie needs SameSite=Lax for
  the top-level provider redirect and Secure in production. It is separate from
  the Raaz session cookie. This new cookie behavior was explicitly approved by the owner
  under AGENTS.md; approved by the owner for this implementation; no existing Origin checks or session-cookie rules are relaxed.
- Complete authentication server-side, issue the existing Raaz httpOnly session
  cookie and redirect to a fixed client destination. Never put session/provider
  tokens in response JSON, browser storage or redirect parameters. No popup flow.
- Provider fetches have timeouts and fixed endpoints. Discard provider tokens
  after obtaining identity; do not request/store refresh tokens. Don't forward
  raw upstream errors to clients or log token-exchange request/response bodies.

## Identity and account policy

- Persist provider + stable provider subject with a unique compound index.
  Never identify an account by provider username or mutable email alone.
- Require a verified usable email for new accounts and apply existing signup
  domain restrictions. A returning linked subject remains the same Raaz account
  even if the provider email changes; don't silently rewrite its email.
- For an existing local account, or another provider's account with the same
  email, do not create a duplicate or auto-link. Return a generic sign-in failure
  with guidance to use the original method. Explicit account linking is deferred.
  Handle concurrent first-time signups with indexes and safe conflict responses.
- Model OAuth-only accounts explicitly with an absent/null password hash, not a
  fabricated known password. Keep hash fields server-only/select:false and run
  the dummy bcrypt comparison for password login on accounts without a hash.
- Expose only safe auth-method metadata needed by settings. An OAuth-only user
  sees their provider sign-in method instead of a password-change form. Password
  creation/recovery and provider unlinking are not part of this slice.
- Existing self-deactivation requires a password. OAuth-only self-deactivation
  must instead require a fresh provider round trip bound to the current user,
  session/tokenVersion and an explicit deactivation intent confirmed in settings.
  Never accept a normal stale session as reauthentication. Preserve transactional
  audit, session invalidation and the last-active-Platform-Admin invariant.
- Reject disabled accounts on every sign-in route. New OAuth users never gain
  platform-admin status or project roles from provider claims or email domains.
- User creation + identity attachment + required audit entry commit atomically.
  Audit/transaction failure returns 500 and leaves no account/identity or success
  session cookie; it is not disguised as a successful redirect.
  Define platform-scoped registration/deactivation audit actions in DATA_MODEL.md
  and audit.service before code; never store provider credentials in audit entries.

## Provider configuration

Each provider needs a server-only client ID and secret plus an exact callback URL.
All three values must be present and the callback URL valid before the provider is
advertised. Invalid/incomplete provider settings disable that provider; existing
boot validation is unchanged. No VITE credentials and no provider setup in chat.

| Provider | Server variables                                            | Local callback (Vite proxy)                          |
| -------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| Google   | GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL | http://localhost:5173/api/auth/oauth/google/callback |
| GitHub   | GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_CALLBACK_URL | http://localhost:5173/api/auth/oauth/github/callback |

1. Google: create an OAuth Web application client, configure the consent screen
   and allowed test users when the app is in testing, then register the exact
   callback above as an authorized redirect URI. Request only openid/email.
2. GitHub: register an OAuth App with the Raaz homepage and the matching callback.
   Use a separate development app if production needs a different callback.
   Grant user:email; no repository or organization access is requested.
3. Put credentials in server environment configuration, never version control.
   Keep unused providers empty. Restart the server after configuration changes.
4. For deployment, callback URLs must use the same **browser-facing API host** as
   the start request, e.g. https://raaz.example/api/auth/oauth/google/callback when
   /api is rewritten to the backend. A backend-internal URL on another hostname
   will not receive the host-only binding cookie. Production requires HTTPS.
5. Keep the existing session SameSite policy. With a Strict session cookie,
   cross-site provider reauthentication for deactivation can fail closed if the
   browser omits the session cookie on callback. Verify this on the chosen
   topology before enabling that flow; do not silently relax COOKIE_SAMESITE.
6. Smoke-test login/signup, cancel, existing-email collision and deactivation with
   actual provider accounts and confirm callback query strings do not enter proxy
   or hosting access logs. Application logs already omit query strings; hosting
   log redaction/retention is an operator responsibility.

The implementation uses the owner-approved `openid-client` dependency and a
separate ten-minute host-only Lax callback cookie. Existing Origin checks,
boot validation and session cookie settings remain unchanged.

## Automated validation record

Protocol tests validate S256 challenges and Google token signatures/claims against
synthetic keys. Provider-mocked tests run account creation, replay/expiry,
collisions, session binding, audit rollback and last-admin checks against an
isolated disposable replica set. UI tests cover both forms, callback notifications
and OAuth-only account settings. Full regression suites and production builds
are run separately. This evidence does not replace live provider/hosted-browser
smoke verification with the operator's registered applications.

## Troubleshooting the generic sign-in error

A GitHub app's authorized-user count means those users granted provider consent;
it does not prove the callback, exchange, email lookup or Raaz registration succeeded.

GitHub may return OAuth error JSON with HTTP 200. Its token response is adapted
to an error HTTP status before the standards client processes it, preserving the
real allowlisted error category instead of reporting a missing-token parse error.
Successful token responses and all state/PKCE/identity checks stay unchanged.

GitHub's callback `iss` is checked against `https://github.com/login/oauth`,
as specified in its [authentication discovery documentation](https://docs.github.com/en/apps/github-authentication-discovery-endpoints).
Using `https://github.com` as the issuer rejects valid callbacks before token
exchange. Regression tests cover the canonical issuer and reject incorrect issuers
before any token request.

The backend emits a credential-safe `oauth_failure` event with only `provider`,
`stage` and an allowlisted `reason`. Keep public callback failures generic. Do not
log exception objects, upstream response bodies, query strings, provider subjects,
emails, authorization codes, access tokens or client secrets for troubleshooting.

| Stage / reason                                | What to check                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| attempt / missing_browser_binding             | Start and callback must use the same browser-facing host; check cookie blocking and local hostnames          |
| attempt / attempt_rejected                    | Restart the flow; expired, replayed, wrong-provider or mismatched attempts cannot be reused                  |
| token_exchange / incorrect_client_credentials | Client ID and secret must belong to the same GitHub OAuth app                                                |
| token_exchange / bad_verification_code        | Start a fresh flow; don't reuse a callback URL/code                                                          |
| token_exchange / redirect_uri_mismatch        | Configured and registered callbacks must match                                                               |
| token_exchange / transport error              | Backend DNS, HTTPS egress and timeout; the browser's GitHub access alone does not prove backend connectivity |
| identity or email_lookup / http_401, http_403 | Identity API access, user:email scope, provider rate limits and provider policy                              |
| account / invalid_email                       | A usable verified primary email is required for new accounts                                                 |
| account / signup_domain_not_allowed           | Existing Raaz signup-domain policy applies to OAuth too                                                      |
| account / account_exists                      | Use the original Raaz sign-in method; automatic email-based account linking is intentionally blocked         |

These categories are diagnostic evidence, not a reason to relax state, PKCE,
email verification, domain restrictions or account-linking checks.

## Acceptance evidence required

- [x] Allowed first registration and returning login for each provider.
- [x] Disabled account, signup-domain rejection, missing/unverified provider email,
      existing-email collision and concurrent signup do not bypass account policy.
- [x] State/nonce/verifier/provider mismatch, expired/missing browser binding,
      callback replay and untrusted return URLs are rejected.
- [x] Google ID-token validation fails safely for incorrect issuer/audience/signature,
      expiry and nonce; GitHub private verified email is handled through its email API.
- [ ] Failed exchange, provider cancellation, timeout and absent configuration have
      actionable UI behavior and no accidental account creation.
- [ ] Authentication attempts cannot overwrite or expose existing credentials;
      password users, dummy-hash login and first-admin bootstrap still work.
- [x] OAuth-only settings/deactivation and last-admin protection work with fresh
      reauthentication and rollback on audit failure.
- [ ] Request logs and unknown-route/error responses omit callback query strings.
      The current originalUrl logger/error paths need adjustment so authorization
      codes/state are never recorded. No provider token/payload in error logs.
- [ ] Provider-mocked tests cover protocol/account logic; replica-set tests prove
      atomic creation/audit and uniqueness. Browser tests prove redirect/cancel and
      callback handling. Real provider tests require operator-owned app credentials.
- [ ] Lint, formatting, tests and build pass; hosted cookie/redirect behavior is
      verified before enabling each provider for real users.

## Official references

- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)
- [Google server-side OAuth](https://developers.google.com/identity/protocols/oauth2/web-server)
- [GitHub authorization code flow and PKCE](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- [openid-client](https://github.com/panva/openid-client)
- [Arctic deprecation notice](https://arctic.pilcrowonpaper.com/)
