# API security checklist

This checklist describes the backend beta protections, their boundaries, and operational assumptions. It is not a claim that either voting mode can prevent all fraud.

## Protections implemented

- **Credential and ballot tokens:** host sessions, password-reset tokens, verification tokens, voter tokens, and signed ballot/results credentials are random or cryptographically signed and stored as hashes where persisted. Hash/signature comparisons use constant-time comparison after lookup. Voter tokens are station-scoped.
- **Closed Vote token attempts:** the registered-voter row is the source of truth. Five wrong phone-bound token attempts lock that voter for 15 minutes; ten failed attempts flag the voter. Attempts without a matching phone are subject to per-IP limiting. The token is never stored in rate-limit counters.
- **Request limits:** host login and forgot-password are limited by IP and username/email; registration and status by IP; registration also by station-scoped normalized phone; vote entry by IP; and ballot submission by IP plus a voter-scoped key for Closed Vote. Identifiers passed to Cloudflare or persisted in the fallback counter table are HMACed with `TOKEN_HMAC_SECRET`.
- **Rate limiter selection:** Workers use Cloudflare Rate Limiting bindings. The bindings use five requests per minute for the strict namespace and 30 per minute for the loose namespace. The documented binding supports 10- or 60-second periods; this deployment uses 60 seconds. Non-Workers use atomic PostgreSQL counters with expiration: five per 15 minutes for strict limits, 30 per minute for registration IP, 40 per minute for status IP, and 20 per minute for voting IP. Expired fallback rows are deleted in bounded batches during rate-limit operations.
- **Rate-limit boundary:** Cloudflare counters are per data-center location and eventually consistent; they are an abuse signal, not an exact global accounting or authorization mechanism. The Closed Vote failed-token lockout remains enforced in PostgreSQL, not by the Cloudflare binding. Fallback limits are shared through PostgreSQL.
- **Cross-origin requests:** credentialed CORS responses are limited to exact origins in `CORS_ORIGINS`; unknown `Origin` values are rejected. Non-browser requests without an `Origin` header are accepted and do not receive cross-origin permission headers.
- **Host session cookie:** `host_session` is `HttpOnly`, `Secure`, `SameSite=Lax`, and `Path=/`. Set `COOKIE_DOMAIN` to the common parent domain when app/API subdomains need a shared cookie domain. Leave it empty for local development.
- **Transport and request handling:** security headers disable content sniffing and framing; HSTS is added to HTTPS requests. JSON bodies are limited to 1 MiB. Requests exceeding 30 seconds receive a message-key timeout response; the local Node server also has request and header timeouts.
- **Error and log handling:** API errors use message keys and request IDs. Unexpected errors return a generic internal key; stack traces, SQL messages, and raw exception details are not returned. Structured log fields containing credentials, tokens, personal identifiers, or cookie values are redacted.
- **Enumeration resistance:** login failures do not distinguish unknown username, incorrect password, or unverified email. Forgot-password responses are identical for known and unknown addresses. Signup and profile updates use one generic conflict key for duplicate usernames and emails.
- **Ballot secrecy:** `cast_votes` remains without voter/device references or timestamps. Responses do not echo choices, and Closed Vote audit data is sourced from check-in records rather than ballot rows.

## Soft signals only

- **IP address:** used only to group or limit requests. It is not an identity and is not a basis for rejecting a voter. Carrier NAT and shared venue Wi-Fi can place many genuine voters behind one IP. Registration clusters are only a host hint.
- **Device fingerprint:** used as a duplicate hint. It can collide for similar devices, change in privacy-focused browsers, and match family members sharing a phone. It must not be the sole reason to reject a Closed Vote registration.
- **Client device UUID:** station-scoped and used for Public Poll's one-device soft limit and to restore a Closed Vote token screen. Clearing browser storage or using another device can bypass it.
- **Mobile-only checks:** browser headers and client-side touch/pointer checks add friction, not proof of device type.

## Known limits from the specification

- **Section 4.1:** neither mode can stop a person with several phones or SIM cards, or a dishonest host. Public Poll is open-link and its results are explicitly unverified. Closed Vote relies on the host to approve registrations against the organization's own membership list; the platform does not independently verify identity.
- **Section 5.1:** identical phone models can share a fingerprint; privacy-focused browsers can randomize fingerprint inputs; and family members may share devices. Device identifiers and fingerprints are personal data, must be disclosed to voters, remain station-scoped, and are purged with election data.
- **Section 5.3:** shared networks make IP-based person identification unreliable. Per-IP clusters are hints only.
- **Section 12.2:** token guessing protection depends on rate limiting because voter tokens have approximately 60 bits of entropy. Cloudflare's local, eventually consistent counters can temporarily admit bursts across isolates or locations; use the database fallback for exact shared windows outside Workers. The registered-voter attempt count and lockout are the authoritative control for phone-bound token failures.
- **Signup collision behavior:** the selected generic-conflict contract hides whether a username or email collided, but a `409` still reveals that at least one submitted identifier is already in use. Making that fully indistinguishable from successful signup would also require changing the existing immediate-session signup behavior.

## Deployment checklist

- Set strong, private `TOKEN_HMAC_SECRET` and `SESSION_SECRET` values (at least 32 characters), `COOKIE_DOMAIN` as appropriate, and an exact allowlist in `CORS_ORIGINS`.
- Ensure the `STRICT_RATE_LIMITER` and `LOOSE_RATE_LIMITER` namespace IDs in [wrangler.toml](../wrangler.toml) are unique in the Cloudflare account before deployment.
- Apply the generated migration that creates `rate_limit_counters` to databases used by local/non-Workers runtimes.
- Use HTTPS in deployed environments and keep cookies Secure; do not expose secrets or personal data in logs.
