# F12 Screen and Dialog Audit

Status meanings: `done` means a dedicated implementation exists, and `done in module`
means the screen/dialog is implemented by a shared or lifecycle module.

| Spec screen or dialog | Route or component | Status |
| --- | --- | --- |
| Public landing | `/` | done |
| Sign In dialog | `AuthDialog` | done |
| Sign Up dialog | `AuthDialog` | done |
| Join a poll | `LandingPage` | done |
| Forgot password | `/forgot-password` | done |
| Reset password | `/reset-password` | done |
| Email verification pending | `/verify-email-pending` | done |
| Email verification verified | `/verify-email-verified` | done |
| Verification link expired | `/verification-link-expired` | done |
| Host profile | `/host/profile` | done |
| Billing | `/host/billing` | done |
| Current plan card | `BillingPage` | done |
| Pay-per-use checkout | `BillingPage` | done |
| Premium monthly/annual management | `BillingPage` | done |
| Provider badges | `BillingPage` | done |
| Payment pending/successful/failed states | `BillingPage` | done |
| Receipts | `BillingPage` | done |
| Host dashboard empty/populated | `/host` and `StationDashboard` | done |
| Setup wizard | `/host/stations/new` | done |
| Polling Station detail | `/host/stations/[id]` | done |
| Station settings | `/host/stations/[id]/settings` | done |
| Approval queue | `/host/stations/[id]/voters` | done |
| Account tier notices | `HostProfileSettings` | done in module |
| Candidate add/edit | `CandidateEditorDialog` | done |
| Upload failure alert | `ImageUploader` | done |
| Confirm delete | `ConfirmDialog` | done in module |
| Typed-confirmation destructive action | `TypedConfirmDialog` | done in module |
| Resume/discard draft | Station wizard `ConfirmDialog` | done |
| Unsaved changes | Station wizard `ConfirmDialog` | done |
| Share link with QR | Station detail/launch wizard | done in module |
| Extend registration | `StationDetail` dialog | done |
| Approve all pending | `ApprovalQueue` dialog | done |
| Reject with reason | `ApprovalQueue` dialog | done |
| Revoke voter | `ApprovalQueue` dialog | done |
| Reissue token | `ApprovalQueue` dialog | done |
| Block number | `ApprovalQueue` dialog | done |
| Start voting with pending warning | `StationDetail` dialog | done |
| Payment gate | `PaymentGateDialog` | done |
| Export report | `ApprovalQueue`, `StationAnalytics`, profile export | done in module |
| Session expired | `SessionExpiredDialog` | done |
| Offline notice | `OfflineBanner` | done |
| 404 | `/not-found` | done |
| 403 | `/forbidden` | done |
| 500 | `/error` | done |
| Maintenance | `/maintenance` | done |
| Closed Vote registration | `/s/[publicId]/register` | done |
| Registration received/token/waiting status | `VoterRegistrationForm`, `TokenDisplay` | done |
| Status pending/approved/rejected/revoked | `/s/[publicId]/status` | done |
| Token reminder | `TokenDisplay` | done in module |
| Already registered | Registration form API state | done |
| Registration full | `VoterStateScreen` | done |
| Registration closed | `VoterStateScreen` | done |
| Registration not yet open | `VoterStateScreen` | done |
| Voting entry | `/s/[publicId]/vote` | done |
| Stored/manual token entry | `/s/[publicId]/vote` | done |
| Voting not yet open | `/s/[publicId]/vote` | done |
| Countdown | Entry/state countdown copy | done |
| Voting closed | `/s/[publicId]/vote` | done |
| Token already used | `/s/[publicId]/vote` | done |
| Token invalid or reissued | `/s/[publicId]/vote` API state | done |
| Not yet approved/rejected/revoked | `/s/[publicId]/vote` API state | done |
| Locked out wait | `/s/[publicId]/vote` API state | done |
| Ballot | `/s/[publicId]/ballot` and `/vote` shared `BallotExperience` | done |
| Review-before-submit | `BallotExperience` dialog | done |
| Submission success | `/s/[publicId]/success` | done |
| Live results | `/s/[publicId]/results` | done |
| Concealed waiting results | `/s/[publicId]/results` | done |
| Final results | `/s/[publicId]/results` | done |
| Public Poll ballot | `/s/[publicId]/ballot` and `/vote` | done |
| Device-already-voted | Public Poll submit API state | done |
| Mobile Device Required | `MobileRequiredScreen` | done |
| Session expired | `SessionExpiredDialog` | done |
| Capacity reached | Public Poll submit API state | done |
| Loading states | `loading.tsx`, skeleton components, and query pending states | done |
| Error states | Global error boundary, banners, and route/API error states | done |
| Empty states | Dashboard and list empty components | done |
