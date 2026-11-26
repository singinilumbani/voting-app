# Recorded Ambiguities and Open Decisions

This inventory consolidates ambiguities, unresolved decisions, implementation assumptions, documented contradictions, and deferred items recorded in the backend documentation. It is not a replacement for the specification. Items marked **resolved** reflect a later clarification or implementation decision; they remain listed because the documentation still records an inconsistency or prior uncertainty.

## Unresolved product and policy decisions

| Area | Recorded ambiguity or decision | Current implementation or assumption | Sources |
| --- | --- | --- | --- |
| Purge timing | It is unclear whether temporary-account `purge_at` begins at signup/downgrade or after election completion. | The auth implementation initially uses signup/downgrade plus seven days; later election lifecycle logic must update it. | [M5](./implementation-log/M5-host-auth.md), [M10](./implementation-log/M10-scheduler-jobs.md), [project specification, sections 6.1-6.2](./project-specification.md) |
| Account deletion confirmation | `"DELETE"` is proposed as the typed confirmation string, but no final approved value is recorded. | `"DELETE"` is the implementation choice. | [M5](./implementation-log/M5-host-auth.md) |
| Account deletion data | It is unclear whether account deletion must erase cast votes or preserve anonymized aggregates. The general data model requires secret-ballot separation, so any retained aggregate must remain unlinkable. | The implementation transactionally removes account data and does not join or preserve vote choices. | [M5](./implementation-log/M5-host-auth.md), [legacy audit](./legacy-audit.md) |
| Cloudinary cleanup | It is unclear whether deleting temporary account or election records should also remove remote candidate assets. | Database candidate records are deleted, but remote Cloudinary assets are not. | [M10](./implementation-log/M10-scheduler-jobs.md) |
| Email provider | The specification leaves the host-email provider open. | Brevo is configurable in the implementation; no provider decision is made in the specification. | [M1](./implementation-log/M1-backend-tooling.md), [M5](./implementation-log/M5-host-auth.md), [project specification, section 11.4](./project-specification.md) |
| Password hashing | The Workers-compatible host-password hashing approach and minimum acceptable PBKDF2 work factor are unresolved. | PBKDF2-SHA256 with 5,000 iterations is the conservative beta default. | [M1](./implementation-log/M1-backend-tooling.md), [M5](./implementation-log/M5-host-auth.md), [runtime spike](./runtime-spike.md) |
| Session lifetime | Host-session lifetime is not specified. | The implementation uses 30 days. | [M5](./implementation-log/M5-host-auth.md) |
| Email-verification-token lifetime | Email-verification-token expiry is not specified. | The implementation expires verification tokens after one hour. | [M5](./implementation-log/M5-host-auth.md) |
| Strong-password threshold | The specification does not give numeric strong-password requirements. | The implementation uses at least 12 characters. | [M5](./implementation-log/M5-host-auth.md) |
| Signup conflict disclosure | The generic signup collision contract still reveals a duplicate through HTTP 409. It is unclear whether this should be made fully neutral. | The implementation uses a generic conflict message key but retains HTTP 409 for existing-session/signup behavior. | [M11](./implementation-log/M11-security-hardening.md) |
| Phone blocking semantics | The registration prompt does not say whether blocking a number should immediately reject or revoke its current registration. | Blocking prevents future attempts and leaves the existing registration to explicit reject/revoke actions. | [M7](./implementation-log/M7-registration-approval.md) |
| Raw token privacy interpretation | A response/log privacy requirement conflicts at first reading with signed ballot-session and immediate-results credentials. | Raw voter-token echoing/logging is prohibited; explicitly required signed credentials are returned only in successful responses. | [M8](./implementation-log/M8-voting-api.md) |
| Vote-entry IP threshold | The specification does not define a numeric loose per-IP vote-entry limit. | The beta implementation uses 20 failed attempts per minute per HMAC-hashed IP. | [M8](./implementation-log/M8-voting-api.md) |
| Results access-token lifetime | The lifetime of an immediate-results access token is not specified. | A token remains valid while its corresponding voted voter/device record exists. | [M8](./implementation-log/M8-voting-api.md) |
| Audit pagination and retention | Audit pagination and retention are not defined. | The endpoint returns at most the 500 newest check-in records. | [M9](./implementation-log/M9-analytics.md) |
| Abstention percentages | It is not explicitly stated whether category percentages include abstentions. | Abstentions are included in the denominator. | [M9](./implementation-log/M9-analytics.md) |
| Load-test rate-limit setup | It is unclear whether the 2,500-voter goal should test production protections or application capacity with staging-only limits/multiple controlled egress IPs. | The load script uses or documents staging-only isolation and counts 429 responses as failures. | [M12](./implementation-log/M12-test-hardening.md), [load-test plan](./load-test-plan.md) |

## Registration, station, and API contract ambiguities

| Area | Recorded ambiguity or decision | Current implementation or assumption | Sources |
| --- | --- | --- | --- |
| Registration/status limits | Numeric registration and status rate limits are not defined in the specification. | Beta limits are database-backed and configurable at composition time. | [M7](./implementation-log/M7-registration-approval.md) |
| Ballot grouping | The cast-vote schema stores one row per category and has no ballot-group identifier. | Integrity counts use `has_voted`; abstentions are counted as null-candidate rows. | [M7](./implementation-log/M7-registration-approval.md) |
| Share-link path | The front-end path for a public station share link is not named. | The implementation uses `/station/:publicId` relative to `APP_BASE_URL`. | [M6](./implementation-log/M6-station-api.md) |
| Start-voting confirmation shape | The specification warns before start-voting confirmation but does not define the request body. | The implementation uses `{ "confirm": true }`. | [M6](./implementation-log/M6-station-api.md) |
| Close-registration endpoint | No close-registration endpoint is listed. | The scheduler is assumed to move `REG_OPEN` stations to `REG_CLOSED`; then the host may start voting. | [M6](./implementation-log/M6-station-api.md), [M10](./implementation-log/M10-scheduler-jobs.md) |
| Station-image privacy | Candidate image handling, upload approval, and retained asset behavior are not fully specified. | Cloudinary signed uploads are used; retained remote assets remain a separate cleanup decision. | [M6](./implementation-log/M6-station-api.md), [M10](./implementation-log/M10-scheduler-jobs.md) |

## Identity, data model, and privacy decisions

| Area | Recorded ambiguity or decision | Status | Sources |
| --- | --- | --- | --- |
| Legacy data | Existing administrators, positions, candidates, and votes may need migration, export/read-only treatment, or deletion. | **Resolved for beta:** the audit answer was to discard legacy data and not migrate it. | [legacy audit](./legacy-audit.md), [M0](./implementation-log/M0-repository-audit.md), [M1](./implementation-log/M1-backend-tooling.md) |
| Tenant boundary | It was unclear whether the existing global-admin account could remain or whether host accounts should own isolated stations. | **Resolved:** use one host account per tenant and isolate its polling stations. | [legacy audit](./legacy-audit.md), [M0](./implementation-log/M0-repository-audit.md), [M1](./implementation-log/M1-backend-tooling.md) |
| First-beta modes | It was unclear whether Public Poll or Closed Vote should ship first. | **Resolved:** both modes ship in the beta. | [legacy audit](./legacy-audit.md), [M1](./implementation-log/M1-backend-tooling.md) |
| Ballot secrecy | It was necessary to confirm whether the database must never link voter/device identity to cast choices or store per-vote timestamps. | **Resolved:** preserve the unlinked ballot model and never persist voter/device-to-choice links or per-vote timestamps. | [legacy audit](./legacy-audit.md), [M0](./implementation-log/M0-repository-audit.md), [M1](./implementation-log/M1-backend-tooling.md) |
| Legacy ballot retention | It is unclear what legacy vote data may legally or operationally be retained after the model is replaced. | **Resolved for migration:** legacy votes are discarded; separate legal/operational retention policy remains unanswered. | [legacy audit](./legacy-audit.md), [M0](./implementation-log/M0-repository-audit.md) |
| Device and privacy signals | The UUID, fingerprint/IP hashes, duplicate flags, disclosure, and purge policy required confirmation under Malawi privacy law. | **Resolved:** implement the station-scoped disclosed/purged device model and keep it advisory. | [legacy audit](./legacy-audit.md), [M1](./implementation-log/M1-backend-tooling.md), [project specification, section 5.1](./project-specification.md) |
| Voter-row index | The specification still claims a unique `(polling_station_id, voter_id)` index, while the data model has no `voter_id` column. | **Clarified:** `registered_voters.id` identifies the row and `(polling_station_id, phone_number)` is unique; duplicate Public Poll submissions are guarded by `device_records`. | [M3](./implementation-log/M3-database-layer.md), [M4b](./implementation-log/M4b-hash-formats-followup.md), [project specification, sections 4.9 and 12.2](./project-specification.md) |
| Hash representation | Password and token hash representations and algorithms are not defined in the database module. | Database text columns store supplied formats; the application supplies password/PBKDF2 and token-HMAC formats. | [M3](./implementation-log/M3-database-layer.md), [M4b](./implementation-log/M4b-hash-formats-followup.md) |
| International phone parsing | International input handling is not fully specified beyond generic E.164 display. | The implementation supports explicit `+` or `00` with 8-15 digits as international, but has no country calling-code validity database or country-specific national parsing. | [M4](./implementation-log/M4-shared-utilities.md), [M4b](./implementation-log/M4b-hash-formats-followup.md), [project specification, section 4.4](./project-specification.md) |
| Malawi phone rule | The rule that Malawi national numbers have nine digits and begin with 8 or 9 must be confirmed against the official numbering plan. | **Resolved for implementation:** the rule is implemented and configurable; it remains advisable to verify against the official plan. | [M4](./implementation-log/M4-shared-utilities.md), [M4b](./implementation-log/M4b-hash-formats-followup.md), [project specification, sections 4.4 and 11.4](./project-specification.md) |

## Hosting, runtime, and infrastructure decisions

| Area | Recorded ambiguity or decision | Status | Sources |
| --- | --- | --- | --- |
| Backend runtime | It was unclear whether beta must begin on Workers or may begin on Node if Workers compatibility fails. | **Resolved:** require Cloudflare Workers and retain Express unless a tested incompatibility warrants a separate framework decision. | [legacy audit](./legacy-audit.md), [M1](./implementation-log/M1-backend-tooling.md), [runtime spike](./runtime-spike.md) |
| Hosting and environments | Vercel project, branch, API host, database target, and protection of the live project were not named. | The implementation targets Vercel front end, Workers backend, and Neon staging while leaving the live Vercel project untouched. Exact deployed URLs remain environment-specific. | [legacy audit](./legacy-audit.md), [M0](./implementation-log/M0-repository-audit.md), [M1](./implementation-log/M1-backend-tooling.md) |
| Node runtime | Node 22 verification was outstanding on a host initially providing Node 26. | Node 22 LTS remains required for verification and merge checks. | [M1](./implementation-log/M1-backend-tooling.md), [M2](./implementation-log/M2-backend-skeleton.md), [runtime spike](./runtime-spike.md) |
| Neon and Node dependencies | Neon, `pg`, native integrations, Cloudinary uploads, and password hashing compatibility with Workers were not fully proven. | Express startup is proven locally; database, auth, upload, and deployed CPU behavior require separate validation. | [M1](./implementation-log/M1-backend-tooling.md), [M2](./implementation-log/M2-backend-skeleton.md), [runtime spike](./runtime-spike.md) |
| Capacity ceiling | The 50,000 design ceiling and 2,500 free-tier recommendation need load testing. | The limits remain provisional until controlled staging and Worker dashboard measurements are reviewed. | [legacy audit](./legacy-audit.md), [M2](./implementation-log/M2-backend-skeleton.md), [runtime spike](./runtime-spike.md), [load-test plan](./load-test-plan.md) |
| Worker platform limits | The implementation does not replace HTTP latency with a guarantee of 10 ms CPU or subrequest headroom. | The staging Worker dashboard must be checked separately for CPU and subrequests. | [runtime spike](./runtime-spike.md), [M12](./implementation-log/M12-test-hardening.md) |
| Distributed rate limiting | Cloudflare per-location limiting has eventual-consistency gaps and regional variance. | Voter-row lockout remains the authoritative phone-bound control; Cloudflare limits remain soft defenses. | [M11](./implementation-log/M11-security-hardening.md) |
| Request cancellation | HTTP 408 handling does not cancel arbitrary application or database work already in progress. | Database statement timeouts may be added if slow queries become a risk. | [M11](./implementation-log/M11-security-hardening.md) |
| Package and advisory decisions | Several audit advisories require decision-making about upgrading or replacing dependency paths. | Review the M11 audit findings before deploy; no package decision was made in this inventory. | [M11](./implementation-log/M11-security-hardening.md) |

## Explicitly deferred features

- Official production release, paid hosting plans, and PayChangu payments remain post-beta until funding is available.
- Host email verification and PayChangu stay post-beta.
- Stronger voter verification, such as SMS verification or uploaded-member-list matching, remains deferred.
- Member-list upload and automatic approval matching remains deferred.
- Chichewa and Tumbuka localization remain deferred.
- SMS token delivery remains deferred.
- Custom customization themes remain deferred.
- The temporary/Pay-Per-Use 7-14 day and Long-Term/Premium retention behavior remains subject to account/election lifecycle implementation.
