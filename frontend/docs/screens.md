# Routes and screens

| Route                        | Screen                     | Status                                                                                  |
| ---------------------------- | -------------------------- | --------------------------------------------------------------------------------------- |
| `/`                          | Public landing             | Auth dialog, poll-link entry, feature highlights, Terms and Privacy links               |
| `/terms`                     | Terms of Use               | Placeholder legal page                                                                  |
| `/privacy`                   | Privacy Policy             | Placeholder legal page                                                                  |
| `/forgot-password`           | Password recovery          | Neutral request to the host auth API                                                    |
| `/check-email`               | Recovery confirmation      | Does not reveal whether an account exists                                               |
| `/reset-password`            | Reset password             | Uses the one-time token from the email link                                             |
| `/reset-success`             | Reset complete             | Sign-in link                                                                            |
| `/reset-link-expired`        | Expired reset link         | Request a fresh reset link                                                              |
| `/verify-email-pending`      | Verification pending       | Reached only after signup reports HTTP 202; resend is unavailable in the documented API |
| `/verify-email`              | Verify email               | Calls the verification endpoint with the email token                                    |
| `/verify-email-verified`     | Verification success       | Sign-in link                                                                            |
| `/verification-link-expired` | Expired verification link  | Shown for an invalid or expired verification token                                      |
| `/host`                      | Host dashboard             | Empty and populated states, station filters/search, account warnings, and draft resume   |
| `/host/stations/new`         | Station setup wizard       | Create a draft, configure positions and nominees, registration, and launch               |
| `/host/stations/[id]`        | Station detail overview    | Phase timeline, quick stats, public link/QR, activity, and contextual status action       |
| `/host/stations/[id]/overview` | Station detail overview  | Overview tab route                                                                        |
| `/host/stations/[id]/candidates` | Station candidates      | Candidate controls follow DRAFT, REG_OPEN, and read-only lifecycle rules                  |
| `/host/stations/[id]/voters` | Voters placeholder         | Placeholder until F7; explanatory state for Public Poll                                   |
| `/host/stations/[id]/analytics` | Analytics placeholder    | Placeholder until F8                                                                     |
| `/host/stations/[id]/settings` | Station settings          | Registration extension, voter cap, locked options, and cancellation                      |
| `/host/stations/[id]/edit`   | Edit station wizard        | Resume an existing DRAFT station setup                                                   |
| `/host/profile`              | Host profile               | Profile, password, tier, export, and account deletion actions                           |
| `/dev/components`            | Component Sheet            | Development-only component and state showcase                                           |
| `/maintenance`               | Maintenance notice         | Temporary service availability notice                                                   |
| `/offline`                   | Offline notice             | Connection recovery guidance                                                            |
| Not found                    | 404                        | Shared missing-page state                                                               |
| Forbidden                    | 403                        | Next.js forbidden boundary state                                                        |
| Error boundary               | 500                        | Shared retryable error state                                                            |
