# Ambiguities and open questions

Date: 2026-11-25

This register compiles unresolved decisions, contradictions, assumptions, deferred
features, and manual verification gaps found in the frontend documentation. It
does not add new product decisions.

## Product scope and roadmap

| Item | Source | Status | Impact / next action |
| --- | --- | --- | --- |
| Official production release, paid hosting and production database remain deferred until funding. | [Project specification](./project-specification.md), [F12 log](./implementation-log/F12-remaining-screens.md) | Deferred | Keep the beta environment and free-plan assumptions until funding and a production approval exist. |
| Chichewa and Tumbuka localization is deferred; only English is active. | [Project specification](./project-specification.md) | Deferred | Keep strings in `src/locales/en.json`; do not add locale-specific source text. |
| SMS token delivery is deferred because of carrier gateway costs. | [Project specification](./project-specification.md) | Deferred | Continue using on-screen, browser-storage, WhatsApp, reissue and contact-the-host flows. |
| Customization themes are deferred. | [Project specification](./project-specification.md) | Deferred | Use the existing design tokens and Commissioner font only. |
| Automatic matching against an uploaded member list is deferred. | [Project specification](./project-specification.md) | Deferred | Host approval remains manual; do not imply automatic verification. |
| Stronger voter verification such as SMS verification is deferred. | [Project specification](./project-specification.md) | Deferred | Device signals remain hints and never block registration or voting. |
| The 2,500 recommended voter ceiling has not been load tested. | [Project specification](./project-specification.md) | Unverified assumption | Confirm practical capacity with a real load test before promising it to hosts. |
| Mobile number validation assumes 9 digits starting with 8 or 9. | [Project specification](./project-specification.md) | Needs confirmation | Confirm the rule against the official Malawi numbering plan. |

## API contracts and backend parity

| Item | Source | Status | Impact / next action |
| --- | --- | --- | --- |
| `docs/api-reference.md` was referenced as if it existed, but the frontend uses `docs/reference/api.md`. | [F2 log](./implementation-log/F2-infrastructure.md), [F5 log](./implementation-log/F5-dashboard-and-wizard.md), [F6 log](./implementation-log/F6-station-detail.md), [F7 log](./implementation-log/F7-approval-queue.md) | Canonical reference unresolved | Decide whether `docs/reference/api.md` is canonical or whether a separate `docs/api-reference.md` must be created outside this workspace. |
| The backend shared utility snapshot was unavailable, so frontend phone, token and crypto utilities were reconstructed from vectors and specification text. | [Shared sync](./shared-sync.md), [F3 log](./implementation-log/F3-shared-utilities.md) | Source parity unverified | Obtain the approved backend snapshot and rerun every contract vector; reconcile any unrepresented behavior. |
| It is unclear whether every valid international phone number should receive a WhatsApp URL or whether additional phone-list delimiters exist. | [F3 log](./implementation-log/F3-shared-utilities.md) | Contract gap | Confirm the canonical WhatsApp rule and phone-list grammar with the API/backend owner. |
| The API/spec does not identify the host account field or message key used to indicate that payment is required. | [F5 log](./implementation-log/F5-dashboard-and-wizard.md) | Implementation assumption | Replace `host.plan === "PAYMENT_REQUIRED"` if the host DTO defines a separate field or key. |
| The API/spec does not define a delete-draft endpoint. | [F5 log](./implementation-log/F5-dashboard-and-wizard.md) | Resolved by local behavior, backend gap remains | Discard currently removes only browser progress; confirm whether server-side DRAFT deletion is required. |
| Candidate upload size limit is not documented. | [F5 log](./implementation-log/F5-dashboard-and-wizard.md) | Assumption | The frontend uses a provisional 10 MB limit; replace it with the approved limit and error key. |
| Bulk rejection accepts `voterIds` or `allPending`, but only the `allPending` form is documented with an optional reason. | [F7 log](./implementation-log/F7-approval-queue.md), [API reference](./reference/api.md) | Contract gap | Decide whether bulk `voterIds` rejection should accept a reason and update the API/UI consistently. |
| A station with zero approved voters may require extension, a new registration window or cancellation. The spec/UI/API need to agree. | [F6 log](./implementation-log/F6-station-detail.md), [Project specification](./project-specification.md) | Contradiction | The current UI does not offer unsupported reopening; confirm and then add or remove the other actions explicitly. |
| Exact `ActivityDto` fields and all host-action event types are not fully documented. | [F6 log](./implementation-log/F6-station-detail.md), [API reference](./reference/api.md) | Contract gap | Supply the complete activity schema and event inventory. |
| Public results do not include explicit tie metadata. | [F11 log](./implementation-log/F11-voting-and-results.md) | Frontend derivation | Confirm tie semantics; the public results UI derives ties from equal highest counts. |
| Locked-token API wait-time parameter names are not confirmed. | [F11 log](./implementation-log/F11-voting-and-results.md) | Frontend fallback | The UI accepts `waitMinutes` or `minutes`; confirm the API error params and add one canonical key. |
| Additional voter or vote status keys may exist beyond the documented common statuses. | [F10 log](./implementation-log/F10-voter-registration.md) | Contract gap | Provide a complete status/error-key catalog and decide how unknown keys are displayed. |
| The public audit endpoint is station-wide rather than category-associated. | [F8 log](./implementation-log/F8-analytics.md), [API reference](./reference/api.md) | Design decision | Confirm whether category-specific audit is intended; the UI labels station-wide activity and never reads votes. |
| PDF analytics export has no backend endpoint or approved frontend dependency. | [F8 log](./implementation-log/F8-analytics.md) | Deferred | CSV is implemented. Add PDF only after choosing an approved client-side implementation or backend report endpoint. |
| Express versus Workers-native framework behavior remains a fallback decision. | [Project specification](./project-specification.md) | Backend decision | Keep Express on Workers only if it is proven reliable; otherwise use the documented Workers-native fallback. |
| Host password hashing approach on Workers is not confirmed. | [Project specification](./project-specification.md) | Backend decision | Confirm the Workers-compatible approach and CPU requirements. |
| The free email provider for host account email is not selected. | [Project specification](./project-specification.md) | Backend/vendor decision | Select a provider and confirm verification, reset and lifecycle email behavior. |

## Registration and voting lifecycle

| Item | Source | Status | Impact / next action |
| --- | --- | --- | --- |
| The API reference has no registration-close or advance-to-voting endpoint; E2E closure depends on scheduling or a real window. | [F14 log](./implementation-log/F14-e2e-tests.md), [Development](./DEVELOPMENT.md) | Contract gap | Document a test/administrative close endpoint or confirm that the scheduler alone is sufficient. |
| Rejected registrations may retry corrected details up to three attempts. Existing-row reuse and token replacement behavior need live verification. | [F10 log](./implementation-log/F10-voter-registration.md), [API reference](./reference/api.md) | Needs live verification | Test live blocked numbers, attempts, re-registration and token replacement. |
| Unknown API status keys returned during registration/voting may be keyed differently from frontend copy. | [F10 log](./implementation-log/F10-voter-registration.md) | Contract gap | Add a complete key/error-state catalog and test every deployment response. |
| Final registration and ballot submissions were historically listed as unfinished; the frontend journey is now implemented, but live backend behavior remains to be verified. | [F9 log](./implementation-log/F9-device-signals-and-mobile-gate.md), [F10 log](./implementation-log/F10-voter-registration.md) | Historical status / manual verification | Verify real registration, stored-token entry, submission, reissue and revoke behavior end to end. |
| The public results response has no tie flag and tie badges may differ from host analytics semantics. | [F11 log](./implementation-log/F11-voting-and-results.md) | Frontend assumption | Confirm whether public and host result aggregation should share the same tie rule. |

## Payments

| Item | Source | Status | Impact / next action |
| --- | --- | --- | --- |
| PayChangu checkout, payment-status and receipt endpoints are not in the API reference. | [F12 log](./implementation-log/F12-remaining-screens.md) | Undocumented / deferred | Add the approved backend endpoints and response schemas before enabling payments. |
| Payment state transitions and host-plan metadata are not defined beyond the frontend assumption. | [F12 log](./implementation-log/F12-remaining-screens.md), [F5 log](./implementation-log/F5-dashboard-and-wizard.md) | Contract gap | Confirm pending, successful, failed, receipt and plan fields. |
| Provider brand logos are not implemented with `react-icons` because it is outside the approved dependency set. | [F12 log](./implementation-log/F12-remaining-screens.md) | Explicit deviation | Text badges remain until an approved icon dependency and provider asset plan are supplied. |

## E2E and infrastructure

| Item | Source | Status | Impact / next action |
| --- | --- | --- | --- |
| Playwright host sign-up depends on email verification configuration. | [F14 log](./implementation-log/F14-e2e-tests.md) | Environment-dependent | Disable or handle verification externally for real backend E2E runs. |
| Cloudinary candidate upload signing/configuration must match the test mocks or production credentials. | [F14 log](./implementation-log/F14-e2e-tests.md) | Manual setup | Configure beta Cloudinary signing or route the exact upload mock in test environments. |
| The backend health endpoint could not be reached in this session, so live proxy and `Set-Cookie` passthrough remain unverified. | [F15 log](./implementation-log/F15-ci-and-deployment.md) | Manual verification | Start the real backend, run `pnpm build && pnpm start`, and test both `/api/v1/health` and host login cookies. |
| The beta Worker URL and custom domain are not provisioned. | [F15 log](./implementation-log/F15-ci-and-deployment.md) | Deployment input missing | Supply beta origins and configure DNS/CORS/cookies. |
| Vercel Hobby, team and build limits can change. | [F15 log](./implementation-log/F15-ci-and-deployment.md) | Verify at deployment | Recheck current commercial-use, concurrency, bandwidth and build rules before launch. |
| First-load route budget measurement is unreliable in the Next 16 build manifest because of shared runtime chunks. | [F13 log](./implementation-log/F13-accessibility-and-performance.md), [Performance](./performance.md) | Measurement gap | Use a route-network or analyzer method before making the budget test blocking. |
| Public-route Lighthouse runs could not use a real server-side public station config with browser MSW. | [F13 log](./implementation-log/F13-accessibility-and-performance.md), [Accessibility](./accessibility.md) | Manual verification | Add server-side test mocks or a reachable public-config API and rerun Lighthouse. |
| Middleware migration from the deprecated `src/middleware.ts` convention to `src/proxy.ts` remains open. | [F2 log](./implementation-log/F2-infrastructure.md), [F5 log](./implementation-log/F5-dashboard-and-wizard.md) | Build warning | Scope a Next 16 migration only after confirming route and mobile-gate behavior. |

## Environment and deployment

| Item | Source | Status | Impact / next action |
| --- | --- | --- | --- |
| Beta frontend origin, beta Worker origin and Cloudinary cloud name are placeholders until provisioned. | [Deployment](./DEPLOYMENT.md) | Manual input missing | Replace placeholders in Vercel environment variables. |
| `NEXT_PUBLIC_APP_URL` and `API_PROXY_TARGET` beta values must match DNS, CORS and cookie configuration. | [Deployment](./DEPLOYMENT.md), [F15 log](./implementation-log/F15-ci-and-deployment.md) | Manual verification | Test host sessions, public links and cross-origin credentials. |
| Vercel ignored-build behavior for this workspace may also be handled automatically by monorepo detection. | [Deployment](./DEPLOYMENT.md) | Verify in project settings | Set and test the explicit command; do not rely only on automatic behavior. |
