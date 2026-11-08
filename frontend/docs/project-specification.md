# Project Specification: Malawian Digital Vote Hosting & Analytics Platform (Version 3.0)

Version 3.0 (beta scope) · 13 October 2026

## 0. Design Summary

This document is the single source of truth for the beta release. Its key design decisions are:

- Two operation modes only: **Public Poll** (open link, no registration) and **Closed Vote** (registration with host approval).
- Closed Vote registration: the voter enters the full name registered with their organization and a phone number, receives a personal token immediately, and the token only works once the host approves the registration against the organization's real member list. The host's Estimated Voter Count is the registration cap.
- No email is ever sent to voters. Email is used only for host accounts.
- Registration window: 1 to 24 hours (default 12). Voting window: 15 minutes to 24 hours (default 12). Voter cap: design ceiling 50,000, recommended 2,500 on free infrastructure.
- Hosts can add candidates and edit candidate names and pictures while registration is open, but cannot remove candidates.
- Ballot secrecy is enforced at the database level: no per-vote timestamps, random vote identifiers, and one transaction per ballot.
- Device fingerprinting and client tokens act as flags and soft limits in Closed Vote. The mobile-only gate is a per-station host toggle.
- Phone numbers are normalized to +265 format (section 4.4). Lost tokens are recovered by host reissue.
- Hosting: Vercel for the front end, Cloudflare Workers for the backend. Only the beta ships for now; the official production release is deferred until funding.
- The platform uses a three-tier environment strategy, translatable string files and a shared reusable component architecture.

## 1. Executive Summary & Vision

### 1.1 Context & Problem Statement

In Malawi, hosting organizational elections, church committee votings, university club ballots, and award shows traditionally relies on physical gatherings, paper ballots, or informal messaging channels. Physical voting incurs significant logistical costs (venue hires, printing, tallying delays) and leads to low voter turnout due to geographical and scheduling constraints.

### 1.2 Core Solution

This platform is a multi-tenant, cloud-based web application tailored for the Malawian context. It enables hosts (churches, SACCOs, institutions, award bodies, and local SMEs) to create digital "Polling Stations," run timed voter registrations, execute voting windows, and view real-time analytics. This project builds directly upon an existing church voting web application, expanding its core architecture into a general-purpose SaaS platform.

## 2. Target Audience & Local Use Cases

- **Churches & Faith-Based Organizations.** Use case: guild elections, elder appointments, executive council voting. Need: closed voting for registered members only, using Closed Vote with host approval.
- **SACCOs, Cooperatives & Associations.** Use case: AGM voting, board member selection, policy approvals. Need: host-approved member registration, single-vote enforcement per member, and a registration cap matching the expected membership.
- **Entertainment & Media Award Hosts.** Use case: local music awards, fashion shows, university SRC awards. Need: open voting across nominees in multiple categories, using Public Poll.
- **Malawian SMEs & Market Researchers.** Use case: product preference polls, consumer feedback surveys in urban centers (Blantyre, Lilongwe, Zomba, Mzuzu). Need: fast, frictionless survey setups without login barriers, using Public Poll.

## 3. Technology Stack & Architectural Strategy

### 3.1 Stack Breakdown

| Layer | Recommended Technology | Justification |
| --- | --- | --- |
| Frontend Framework | Next.js (App Router), hosted on Vercel | Server-Side Rendering (SSR) and React Server Components for optimal performance on low-bandwidth Malawian networks (3G/4G). |
| Design System & Styling | Material Design 3 (M3) + TailwindCSS v4 | Adheres to Material Design 3 principles (dynamic color system, surface tones, elevation, layout grids) combined with TailwindCSS v4 for utility-first styling. |
| Iconography | Material Icons & React Icons | Material Design Icons for all system, navigation, and UI actions; React Icons exclusively reserved for brand icons (e.g., PayChangu, Airtel, TNM, social media logos). |
| Repository Structure | Unified Codebase (Same Repo) | Built directly within the existing repository created for the original church voting application, extending its codebase into a multi-tenant platform. |
| Backend Framework | Node.js + Express.js (TypeScript), hosted on Cloudflare Workers | Explicit Object-Oriented Programming (OOP) design patterns (Controllers, Services, Repositories). Express on Workers needs testing; a Workers-native framework is the fallback (section 3.7). |
| Package Manager | pnpm | Efficient workspace handling for shared TypeScript code (types, phone number normalizer) between frontend and backend. |
| Local Database Engine | Local PostgreSQL (localhost:5432) | Used on developer machines for feature testing, storing vote\_app\_dev and vote\_app\_test. |
| Cloud Database Engine | PostgreSQL on Neon DB | Serverless Postgres for live deployments: staging\_db for the beta now, production\_db later. |
| Media Management | Cloudinary | Direct browser-signed uploads for candidate images to minimize backend CPU overhead. All assets are stored in the Cloudinary folder named voting-app (a configuration setting). |
| Payment Gateway | PayChangu API (post-beta) | Local Malawian payment aggregator supporting Airtel Money, TNM Mpamba, and Cards. |
| Transactional Email | Provider to be selected (any free tier) | Host account emails only: verification (post-beta), lifecycle warnings, and password resets. |
| Messaging Scope | Zero Voter Emails | No emails are ever dispatched to voters. |

### 3.2 UI Design System & Color Palette Tokens

The user interface follows Material Design 3 surface and color role specifications using custom theme tokens configured in TailwindCSS v4:

| Color Token | Hex Code | Material Design 3 Role / Usage Specification |
| --- | --- | --- |
| Platinum | #F0F5F8 | Primary background, root canvas, and elevated card/container surface fills. |
| Alabaster Grey | #DADFE1 | Inactive states, disabled button backgrounds, outline borders, and divider lines. |
| Pacific Cyan / Fresh Sky | #2DAEEB | Primary accents, interactive buttons, active navigation indicators, progress bars, and focal points. |
| Carbon Black | #1D2124 | Icon fills, primary typography, high-contrast headings, and body text. |
| Red Ochre | #D62600 | Error alerts, destructive actions (e.g., delete candidate/station), and validation flags (paired with low-opacity background containers). |

### 3.3 Architecture & System Layers

- **Frontend Layer (Next.js + Material Design 3 + TailwindCSS v4):**
  - Built within the same repository as the original church voting web application.
  - Implements Material Design 3 patterns (cards, floating action buttons, navigation, modal dialogs) using the color tokens above.
  - Material Design Icons for core UI interactions in Carbon Black; react-icons strictly for brand/provider badges.
  - Client-side draft state persistence (Web Storage / IndexedDB) preserving uncommitted wizard progress across browser sessions.
  - Direct browser uploads to Cloudinary for candidate images.
  - REST / JSON API communication with the backend using shared TypeScript interfaces.
- **Backend Layer (Express.js, OOP structure):**
  - Interfaces with PostgreSQL via Prisma or Drizzle ORM.
  - Dynamically connects to the local or cloud database depending on the active environment (.env.local).
  - Issues and verifies voter tokens, runs the approval workflow, and sends host account emails.
  - Handles transaction verification and webhook listeners from the PayChangu API (post-beta).

### 3.4 Front-End Reusable Component Architecture

The front end must rely heavily on reusable components so that any visual or behavioural change is made once and applies across every page. Page files only compose components. Inline colours, one-off modal markup and copy-pasted card layouts are not allowed. All colours come from the theme tokens in section 3.2. Every component defines its states (default, hover, focus, disabled, error, loading) and lives once in a shared components folder.

Core primitives (M3 prefix):

- **M3Button:** primary, secondary, tonal, text, destructive and floating action button variants, with loading spinner and Material Icon slots.
- **M3TextField:** outlined input with floating label, helper text, error styling in Red Ochre, and trailing icon slot (for example password visibility toggle).
- **M3ModalDialog:** accessible modal with backdrop blur (Carbon Black at 40% opacity), title, content and action buttons. Variants: ConfirmDialog, NoticeDialog, FormDialog, TypedConfirmDialog, BottomSheet.
- **M3Card:** Platinum surface container for candidate grids, position containers and analytics metrics.
- **M3Banner:** system banner for warnings, inactivity notices and errors.

Composite components:

- **Layout:** AppShell, DesktopNavBar, MobileMenuButton, NavMenuModal, PageHeader, AuthCard, Tabs.
- **Inputs:** PasswordField, PhoneField (with normalization preview), CodeField (token entry), DateTimeField, NumberField, Toggle, Checkbox, Select.
- **Feedback:** Snackbar, ErrorMessage, StatusBadge, Chip, DeviceFlagChip, SkeletonLoader, EmptyState, ProgressBar.
- **Voting:** CandidateCard (selectable, check overlay and blur), CandidateGrid, CategoryBallotCard, TokenDisplay (token with copy and share buttons and the no-sharing warning).
- **Wizard:** WizardShell with step indicator, CategoryListItem, CandidateListRow, ImageUploader (Cloudinary).
- **Station and analytics:** StationCard, KpiCard, TurnoutGauge, CountdownTimer, CategoryLeaderboardCard, LeaderboardBar, AuditDrawer, ConnectionStatusBadge, ExportMenu, VoterRow, ApprovalQueue, BulkActionBar.
- **Sharing and branding:** CopyLinkField, ShareLinkCard with QR code, ProviderBadge (react-icons for brand logos only).

### 3.5 Internationalization & Localization Strategy

- **Version 1 scope:** English only. Chichewa and Tumbuka are deferred.
- **i18n readiness:** hard-coded UI string literals are prohibited in JSX/TSX files. All interface text is loaded from structured JSON dictionaries (locales/en.json) so later translation needs no change to component code.
- This covers UI labels, validation and error messages, dialog and notice texts (including both account tier notices), empty states, API error messages returned to the client (as message keys), email subjects and bodies, and exported report labels.
- Strings support placeholders and plural forms. Dates, times and numbers use locale-aware formatting. Layouts must tolerate longer text.
- A locale setting exists in the structure from day one but is not exposed to users in v1.

### 3.6 Repository Structure, Branching Strategy & Database Mapping

The project uses an issue-driven Git workflow mapped across environment tiers:

```
[ GitHub Issue ] --> [ Feature Branch: feature/#issue-id ] --> Local DB (vote_app_dev / vote_app_test)
                              |
                              v  (PR merge)
                     [ Staging Branch: dev ]  --> Neon DB (staging_db, beta URL)
                              |
                              v  (release PR merge, deferred until funding)
                     [ Production Branch: main ] --> Neon DB (production_db, official URL)
```

- **Feature branches (feature/#issue-id-description):** created from dev for each issue or feature card (for example feature/#14-paychangu-webhooks). All daily development happens here.
- **Beta / staging branch (dev):** the primary integration branch. Merges into dev trigger an automated Vercel deployment to the beta environment (beta.yourplatform.mw).
- **Production branch (main):** production-ready code. Merges from dev into main trigger deployment to the official domain (yourplatform.mw). This tier is not provisioned during the beta.
- Database migrations run against the local test database first, then staging. Production receives them only after staging passes. Each tier has its own secrets.

| Environment Tier | Target URL | Git Branch | Database | Configuration & Usage |
| --- | --- | --- | --- | --- |
| Tier 1A: Local Development | localhost:3000 | feature/#issue-id | Local Postgres: vote\_app\_dev | ENABLE\_EMAIL\_VERIFICATION=false. Rapid daily building without email verification friction. |
| Tier 1B: Local Official Testing | localhost:3000 | feature/#issue-id | Local Postgres: vote\_app\_test | ENABLE\_EMAIL\_VERIFICATION=true. Testing release candidates, end-to-end verification flows and migrations. |
| Tier 2: Beta Release (current target) | beta.yourplatform.mw | dev | Neon DB: staging\_db | ENABLE\_EMAIL\_VERIFICATION=false (closed beta). Serves the cohort of 5 to 10 Malawian beta organizations, isolated from production data. |
| Tier 3: Official Release (deferred until funding) | yourplatform.mw | main | Neon DB: production\_db | ENABLE\_EMAIL\_VERIFICATION=true. Official elections, paid hosts and real voters. |

### 3.7 Hosting, Infrastructure & Capacity Notes

**Hosting layout**

- The Next.js front end is hosted on Vercel. Vercel's free Hobby plan is limited to non-commercial use, which suits a free closed beta. Before charging fees, move to a paid Vercel plan or another host.
- The backend API runs on the Cloudflare Workers free plan.
- Keep both under one registrable domain (for example app.yourplatform.mw and api.yourplatform.mw) so the device cookie and CORS rules work across them.
- The Workers free plan allows 100,000 requests per day (resetting at midnight UTC), a burst of 1,000 requests per minute, 10 ms of CPU time per request and 50 subrequests per invocation. Vercel Hobby functions default to a 10 second duration.
- Neon DB free tier (staging\_db) supports up to 0.5 GiB of storage and autoscaling compute.

**Request estimates (API calls only)**

- Closed Vote: about 3 requests per voter to register (page config, submit, status checks) and 4 to 5 to vote (token check, ballot load, submit, results load).
- Public Poll: about 3 to 4 requests per voter.
- A 24 hour voting window therefore fits roughly 15,000 to 20,000 voters inside the daily limit in theory. The burst limit allows roughly 200 to 250 voters per minute.

**Capacity ceilings**

- **System architectural ceiling:** the schema and API are designed for up to 50,000 registered voters per station. This has not been load tested.
- **Practical free-tier recommendation:** up to 2,500 registered voters per station (conservative; confirm with a load test before promising it to hosts).
- **Defaults:** estimated voter count 500 in Closed Vote; a platform-level ceiling of 2,500 ballots per Public Poll. Larger events need paid hosting plans.

**Technical notes for the Workers backend (verify during setup)**

- Voter tokens use HMAC hashing, which fits the 10 ms CPU limit per request. Host password hashing uses a Workers-compatible approach, or a paid plan with a higher CPU limit.
- Express runs on Workers only through Node compatibility and needs testing. A Workers-native framework is the lower-risk fallback.
- Rate limiting uses Workers-native rate limiting.
- Live analytics use Durable Objects for WebSockets (with their own free-tier limits), with polling every 3 to 5 seconds as the fallback.
- Scheduled cleanup and inactivity jobs use Cron Triggers.

## 4. Operational Modes, Registration & Voter Authorization

### 4.1 Operational Modes

- **Mode 1: Public Poll (Open / Low Friction).** For public opinion polls, awards and SME market research. There is no registration. Anyone with the public link opens the ballot directly. One vote per device is enforced softly (section 5). The results page is labelled "Open poll: results are not verified".
- **Mode 2: Closed Vote (Registration with Host Approval).** For churches, SACCOs, clubs and boards. Voters register with their real names, and the host approves or rejects each registration against the organization's own member list. This is the strict mode for now. The platform never has to verify identity itself, because the host already knows the members.

Beta principle: convenience comes before maximum security. Neither mode can stop one person who has several phones or SIM cards, or a dishonest host. The design makes fairness visible and checkable for the host, but it does not make cheating impossible.

### 4.2 Closed Vote Registration

- **Estimated Voter Count (the cap):** required; default 500, minimum 2, maximum 50,000. The host can raise it while registration is open, within the ceiling.
- **Registration window:** start and end timestamps, 1 to 24 hours, default 12 hours.
- The system generates a shareable Registration Link (with QR code) containing the polling\_station\_id.
- **Voter form:** Full Name (as registered with the organization) and Phone Number, with the hint "Use the name your organization knows you by. The host will approve you using this name." A short data notice explains what is collected.
- **After submitting:** the voter immediately sees a Registration received screen with their personal token (section 4.3), a copy button, the no-sharing warning, and the status "Waiting for host approval".
- **Status page:** shows Pending, Approved or Rejected (with the host's reason, if given). To protect the request budget, it checks status when opened, when the voter taps Check status, and every 30 seconds while the page is visible.
- **One registration per phone number per station.** A duplicate attempt shows that the number is already registered and tells the voter to contact the host if they lost their token.
- **Slots:** the cap counts pending and approved registrations. Rejecting a registration frees a slot. When the cap is reached, new voters see "Registration is full". If the host rejects someone or raises the count while the window is open, registration accepts voters again automatically.
- **Rejected registrations:** the voter sees the rejection and may register again with corrected details, up to 3 attempts. The host can block a number.
- Registration closes at the deadline. Voting opens only after registration has closed and the host has started the voting window.

### 4.3 Voter Token

- At registration the system generates a random token with a TK- prefix and 12 characters from a Crockford base32 style alphabet (no 0/O or 1/I/L ambiguity), grouped like TK-K7QM-2XD9-4HNP (about 60 bits). It is stored only as an HMAC hash using a server-side secret, scoped to one polling station, single use, and expires when the voting window closes.
- The token is inactive until the host approves the registration. It then works once voting opens.
- The token is shown on screen with a Copy Token button, a Save or Share button (the phone's share sheet, so the voter can send it to their own WhatsApp or notes), and this warning: "Save this token! You will need it to access your ballot when voting opens. Do not share it with anyone. Anyone who has it can vote as you."
- The token is also saved in the voter's browser storage, so the same screen can be shown again on later visits from the same device.
- Voting entry accepts the stored token automatically, or the token typed or pasted together with the voter's phone number. Attempts are rate limited: 5 wrong attempts on a phone number cause a 15 minute lock, and 10 wrong attempts flag the voter for the host.
- The server keeps only a hash, so it cannot show a token again. A voter who clears their browser or changes device cannot recover the token with their phone number alone, because anyone could type another person's number. They contact the host, who reissues a new token. The old one stops working immediately.
- The token is consumed when the ballot is successfully submitted. A voter who leaves a half-finished ballot keeps a valid token until the window closes; selections are kept as a local draft on that device only.

### 4.4 Phone Number Handling & Normalization

People write Malawian numbers in many ways. The platform stores one canonical form, digits only with the country code (for example 265991234567), and shows it locally as 0991 234 567. One shared function in the shared TypeScript package is used by the front-end preview and re-checked by the API. Steps:

1. **Clean:** remove spaces, dashes, dots, brackets, invisible characters and a leading tel:.
2. **Rewrite** to 265 plus the 9 digit national number (examples below).
3. **Validate:** the national number must have 9 digits and start with 8 or 9 (mobile). This rule is an assumption and lives in configuration; confirm it against the official numbering plan.

| What people type | Result |
| --- | --- |
| 0991234567, 0991 234 567, 099-123-4567 | 265991234567 |
| +265 99 123 4567, 00265991234567, 265991234567 | 265991234567 |
| 991234567 (spreadsheet dropped the leading zero) | 265991234567 |
| +2650991234567 (extra zero after the country code) | 265991234567 |
| 099123456 (a digit missing) | Error: 9 digits expected, this has 8 |
| A landline number, or 9.91E+11 from a spreadsheet | Flagged: not a mobile number, or damaged by a spreadsheet |

- Numbers with an explicit + or 00 and another country code are accepted if they have 8 to 15 digits, and are tagged International.
- **Voter form:** normalize when the field loses focus, show "We will use +265 99 123 4567", use the numeric phone keyboard, and accept any format. A phone number typed at voting entry is normalized the same way before matching.
- **Host queue:** each number gets a Message on WhatsApp button using the canonical digits (https://wa.me/265991234567). Numbers that cannot be reached on WhatsApp (invalid or landline) are flagged.
- The function is covered by table-driven unit tests using the cases above.

### 4.5 Host Approval Queue (Voters Tab)

- **Columns:** full name as typed, phone number (local format) with the WhatsApp button, registration time, status, and device flags.
- **Statuses:** Pending, Approved, Rejected, Voted, Revoked.
- **Header counts:** Pending, Approved and the Estimated Voter Count (for example 118 approved of 500).
- **Actions:** Approve, Reject (with an optional reason shown to the voter), bulk select, Approve all pending (confirmation showing the count), Revoke an approved voter who has not voted, Reissue token, Block number. Search by name or phone and filter by status.
- **Approval window:** approvals and rejections are possible during registration and the review window after it closes. They lock when voting opens. Revoke and Reissue stay available until voting closes. Starting the voting window shows a warning such as "12 registrations are still pending and will not be able to vote".
- **Soft device flags:** a chip such as "Same device as 2 other registrations" appears in the queue. It is a hint for the host and never blocks anyone.
- **Integrity panel:** approved voters, ballots cast and abstentions, with an alert if ballots ever exceed approved voters.
- **Privacy:** the tab shows whether someone has voted, never what they voted for. Names and numbers can be exported as CSV with their statuses, never with choices.
- Deferred: uploading the organization's member list for automatic name matching.

### 4.6 Public Poll (Mode 1)

- No registration phase. Anyone with the public link opens the ballot instantly.
- A client device identifier (section 5.1) limits each device to one ballot per station. A fingerprint match without a matching client identifier is accepted but counted and shown to the host as possible duplicates.
- A device that has already voted sees a plain explanation and a suggestion to contact the host if the phone is shared.
- A platform ceiling applies per poll (default 2,500 ballots on free infrastructure).

### 4.7 Voter Ballot Interface & Interaction Mechanics

When voting opens, Closed Vote voters open the voting page and are recognized by the token stored on their device, or by entering their token and phone number. Public Poll voters open the public link directly.

```
[ Stored token (auto-detected) ]  or  [ Token + Phone Number ]     (Public Poll: public link)
         |
         v
[ Digital Ballot Page ]
 |-- Category Container 1 --> 2-Column Grid [ Candidate A | Candidate B ]
 |-- Category Container 2 --> 2-Column Grid [ Candidate C | Candidate D ]
 '-- Mandatory Submit Button (disabled until ALL categories voted)
         |
         v
[ Review Dialog ] --> [ Submission Success ]
```

- **Category separation:** each position is a distinct, elevated M3 card with the position title at the top. If enabled in Step 0, an Abstain option appears as a valid choice.
- **Two-column candidate grid:** a responsive 2-column grid showing the candidate's Cloudinary image, full name and contesting position.
- **Selection feedback:** tapping a card selects that candidate. A check\_circle Material icon overlays the image and the image applies a subtle blur (backdrop-blur-sm). Exactly one candidate per position; choosing another clears the previous one.
- **Validation:** voters can change selections freely before submitting. A sticky progress bar shows how many positions are selected (for example "3 of 5 positions selected"). The Submit Ballot button stays disabled until every category has a selection (or Abstain). Partial ballots are prohibited.
- **Review dialog:** tapping Submit lists the choices with an Edit link per position, then "Confirm and submit" or "Go back".

Post-submission result visibility (set by the host in Step 0):

- **Immediate live results:** after submitting, the voter is redirected to a live dashboard of vote distribution, shown only to voters who have submitted.
- **Concealed results:** the voter sees a confirmation page with the voting end time. Results stay hidden until the voting window closes, after which the results page unlocks for everyone holding the station link.

### 4.8 Polling Station Lifecycle & Rules

```
Public Poll:  DRAFT --> VOTING_OPEN --> VOTING_CLOSED --> ARCHIVED / PURGED
Closed Vote:  DRAFT --> REGISTRATION_OPEN --> REGISTRATION_CLOSED --> VOTING_OPEN --> VOTING_CLOSED --> ARCHIVED / PURGED
Any state before VOTING_CLOSED --> CANCELLED
```

- **DRAFT:** configuration in progress. Positions and candidates can be added, edited or removed.
- **REGISTRATION\_OPEN (Closed Vote only):** the registration link is live. Categories are locked. The host may add new candidates and edit existing candidates' names and pictures, but cannot remove any candidate, so early registrants see a consistent ballot. Every addition or edit is recorded in the station's activity log.
- **REGISTRATION\_CLOSED (review window):** no new registrations. The host approves or rejects pending registrations. Candidates are locked.
- **VOTING\_OPEN:** the voting link is live (maximum 24 hours). Approvals are locked. Candidates and categories are locked (in Public Poll they lock when voting opens).
- **VOTING\_CLOSED:** ballot submissions are locked and final tallies are generated.
- **ARCHIVED / PURGED:** data is retained 7 to 14 days (Temporary and Pay-Per-Use) or stored permanently (Long-Term Premium).
- **CANCELLED:** allowed before voting opens. Cancelling after voting opens requires a typed confirmation, and voters see a cancelled notice on the voting page.

Rules:

- A station needs at least 1 category, and each category needs at least 2 candidates.
- Registration can be extended while it is still open, as long as the total window stays within 24 hours. It cannot be reopened after it closes.
- If registration closes with zero approved voters, voting cannot start. The host is offered to extend registration (if still allowed), run a new registration window, or cancel.
- The host chooses Open now or a scheduled voting start within 7 days of registration closing.
- Ties: when two or more candidates share the top vote count, the leaderboard shows a Tie badge instead of Leader.
- Temporary accounts show a persistent banner counting down to the 7 day purge, plus an export reminder. The 48 hour email warning is mirrored by an in-app warning.
- Long-term accounts show an inactivity warning banner once the 5 month mark is reached.
- Payment gate (post-beta, behind a feature flag): the host must complete payment or hold an active Premium plan before registration can open.
- Terms of Use and Privacy Policy acceptance (Malawi Data Protection Act 2024) is required at host signup. The voter registration page shows a short notice explaining that the name and phone number are collected only so the host can approve the voter within that election, and that a hashed device identifier is used to detect duplicates.

### 4.9 Database-Level Ballot Secrecy

- **Separation of check-in and votes:** voter participation is logged in the RegisteredVoters table (has\_voted, voted\_at at minute precision). Cast votes go into a separate CastVotes table.
- **CastVotes contents:** a random UUID, polling\_station\_id, category\_id and candidate\_id (or null for Abstain). It has no voter reference and no timestamp. Rows are read in sorted or shuffled order, never insertion order.
- **No linking column:** there is no foreign key or column that links a voter to a cast vote. Both records are written inside one database transaction, so a ballot is all or nothing. The has\_voted flag is set in the same transaction.
- **One ballot per voter:** a unique index on (polling\_station\_id, voter\_id) in RegisteredVoters, combined with a row lock (SELECT FOR UPDATE) on the has\_voted check, blocks double submission from rapid parallel requests. Public Poll uses the same pattern on its device record table.
- **What this guarantees:** an administrator cannot link a vote to a voter through the data model. It does not hide how someone voted if a category has very few voters (for example a unanimous result), and it cannot protect against someone who watches a voter cast their ballot.

## 5. Anti-Fraud, Device Handling & Mobile Restriction

Voters cannot be verified for free, so the platform combines host approval (Closed Vote) with low-cost device signals. These signals raise the effort needed to cheat and give the host visible warnings. They do not make cheating impossible. IP addresses are never used as an identifier, because carrier networks and shared venue Wi-Fi put many genuine voters behind one address.

### 5.1 Device Signals

- **Client device identifier:** on first visit to a station the app generates a random client\_device\_uuid, scoped to that polling\_station\_id, and writes it to localStorage, IndexedDB and an HTTP-only SameSite cookie. If one layer is cleared, the others restore it.
- **Device fingerprint (ThumbmarkJS):** an open-source library that runs silently, with no biometrics and no permission prompts. It hashes non-sensitive browser traits (graphics renderer, canvas, fonts, timezone, audio, screen size) into device\_fingerprint\_hash.
- **Closed Vote use:** signals never block anyone. A match shows as a flag in the approval queue ("Same device as N other registrations"). The client identifier is used only to reload a voter's own token screen on that device.
- **Public Poll use:** a ballot is rejected when the client identifier has already voted on that station. A fingerprint-only match is accepted, counted, and shown to the host as possible duplicates.
- **Known limits:** identical phone models can share a fingerprint, privacy-focused browsers randomize canvas data, and family members share phones. For that reason the fingerprint is never the only reason to reject a voter.
- **Privacy:** these are personal data under the Malawi Data Protection Act 2024. They are hashed, scoped to one station, disclosed in the voter notice, and purged with the election data.

### 5.2 Mobile-Only Restriction (Per-Station Host Toggle)

- The host toggle "Mobile devices only" is on by default in Closed Vote and off by default in Public Poll, because many Public Poll respondents (for example SME surveys) use laptops.
- **Layer 1, server-side middleware (middleware.ts) on /register/* and /vote/\*:*\* inspects the Sec-CH-UA-Mobile header (sent only by Chromium-based browsers) and the User-Agent for desktop indicators. If the signal is missing or unclear, the visitor is allowed through. A Macintosh user agent is passed to Layer 2, because iPads can report one.
- **Layer 2, client-side checks:** navigator.maxTouchPoints > 0 and the (pointer: coarse) media query. These are client-side, so they are friction, not security.
- Blocked visitors see a "Mobile Device Required" screen with a QR code to open the page on a phone. The host dashboard is never restricted.

### 5.3 Rate Limits & IP Signals

- Loose per-IP and per-phone limits apply to registration and token entry, with the lockouts in section 4.3.
- Clusters of registrations from one network are shown to the host as a hint in the approval queue.

## 6. Host Account Architecture & Authentication Lifecycle

### 6.1 Host Onboarding & Signup Selection Flow

Upon accessing the web application, hosts are presented with an M3-styled landing dialog prompting them to either **Sign In** or **Sign Up**. When initiating the Sign Up path, hosts choose between two account tier models:

```
                 [ Host Sign Up ]
                        |
          +-------------+-------------+
          v                           v
 [ Temporary Account ]       [ Long-Term Account ]
   Account & data deleted      Permanent ID, must log in
   7 days post-election        every 6 months
```

**1. Temporary Account Model**

- **Purpose:** single-use event organizers (for example an annual church AGM or a one-time community ballot).
- **Data retention:** the account credentials, polling station, voter registrations, candidates and raw vote data are automatically purged 7 days after the election concludes.
- **Explanatory modal:** selecting Temporary Account opens an M3 confirmation modal stating: *"Notice: Temporary Accounts and all associated polling data, candidate media, voter records, and election analytics will be permanently deleted 7 days after your election concludes. Please ensure you export all required reports prior to expiration."*

**2. Long-Term (Permanent) Account Model**

- **Purpose:** recurring hosts (institutional event managers, media award bodies, ongoing SME survey runners).
- **Data retention:** the host profile and login credentials remain active, subject to logging in at least once every 6 months. Past election results are purged 7 to 14 days post-election unless the host subscribes to the Premium Package, which enables permanent archiving.
- **Explanatory modal:** selecting Long-Term Account opens an M3 confirmation modal stating: *"Notice: Your account profile will remain active indefinitely, provided you log in at least once every 6 months. Historical election results require an active Premium Package subscription to be archived permanently. Free accounts must log in periodically to prevent inactivity purging."*

### 6.2 Host Credentials & Form UI/UX Standards

During account setup (both tiers) hosts supply:

- **Username:** unique alphanumeric display and login handle.
- **Password:** strong password meeting security thresholds.
- **Email Address:** used strictly for automated lifecycle warnings (6-month inactivity alerts for long-term accounts, 48-hour deletion warnings for temporary accounts), verification (post-beta) and password resets.
- **Terms acceptance:** a required checkbox for the Terms of Use and Privacy Policy.

All login and signup forms follow M3 component rules and web accessibility practice:

- **Outlined text fields:** Alabaster Grey (#DADFE1) for inactive borders, Pacific Cyan (#2DAEEB) on focus, with floating label animations.
- **Password visibility toggle:** a trailing Material Icon (visibility / visibility\_off) in Carbon Black (#1D2124).
- **Browser autofill:** standard HTML attributes (autocomplete="username", "current-password", "new-password", "email").
- **Validation feedback:** Red Ochre (#D62600) text over low-opacity container fills (#D6260015).

### 6.3 Phased Email Verification Logic

- **Closed beta phase (launch):** host email verification is completely bypassed (ENABLE\_EMAIL\_VERIFICATION=false in Tiers 1A and 2). Upon form submission the host is immediately logged in.
- **Main production release:** email verification is strictly enforced through an automated confirmation link before first login (ENABLE\_EMAIL\_VERIFICATION=true in Tiers 1B and 3).
- **Voters** are never sent email in any phase. Voter handling relies on host approval, the token and the phone number (section 4).

### 6.4 Password Recovery & Profile Management

- A Forgot password page sends a reset link, followed by a Reset password page and a success state. Responses are neutral so the page cannot be used to discover which emails have accounts.
- A Profile page lets hosts edit their username and email, change password, inspect account age, change account tier, export their data, and delete their account (typed confirmation).
- Upgrading from Temporary to Long-Term shows the long-term notice. Downgrading from Long-Term to Temporary shows the deletion notice and requires a typed confirmation, because stored data becomes subject to the 7 day purge.

## 7. Host Dashboard Layout, Setup Wizard & Live Analytics Engine

### 7.1 Dashboard Layout & Responsive Navigation

After authentication the host lands on the **Dashboard**, which adapts across mobile and desktop.

- **Mobile:** a fixed, floating rounded menu button at the top-left. Tapping it opens an M3 menu modal anchored at the top-left with a 2-unit margin (ms-2 / 0.5rem) matching the button. The backdrop is Carbon Black at 40% opacity with backdrop-blur-sm, and tapping it dismisses the menu. Options: Profile and Logout.
- **Desktop:** a top navigation bar with the application branding and direct Profile and Logout actions.

### 7.2 Dashboard Empty State vs. Active Session States

- **Empty state:** a central low-opacity icon in Alabaster Grey, the text *"You have no voting sessions setup or completed voting sessions. Start one to begin."*, and a primary "Create Voting Session" button in Pacific Cyan. The floating + button is hidden.
- **Populated state:** a grid or list of StationCards (title, mode, status badge, key date, ballots cast or registered count) with filter chips (All, Active, Scheduled, Past) and a search field. A banner area shows account warnings (temporary account deletion countdown, long-term inactivity, payment required). A fixed rounded floating + button at the bottom-right starts the Setup Wizard.

### 7.3 Step-by-Step Polling Station Setup Wizard

```
[ Step 0: Basics ] -> [ Step 1: Positions ] -> [ Step 2: Nominees ] -> [ Step 3: Registration ] -> [ Step 4: Voting ]
```

- **Step 0, Station Basics:** station name and description; mode (Public Poll or Closed Vote); results visibility (Immediate live results or Concealed until voting ends); "Allow abstain" toggle; "Mobile devices only" toggle (defaults in section 5.2).
- **Step 1, Positions:** define the categories. They are reorderable and deletable. At least 1 is required.
- **Step 2, Nominees:** positions are shown in rectangular containers. The + icon opens an M3 candidate modal (name field and Cloudinary image upload with crop preview and progress). A failed or timed-out upload shows an alert with a Retry Upload button. Full edit and delete control applies during draft. Categories with fewer than 2 candidates show a warning chip and block progress.
- **Step 3, Registration (Closed Vote only):** Estimated Voter Count (default 500, maximum 50,000, with a notice above 2,500 that very large lists may be slow on the free beta infrastructure) and registration duration (1 to 24 hours, default 12). Generates the shareable registration link and QR code.
- **Step 4, Voting Window:** "Open now" or a scheduled start within 7 days of registration closing, and a duration of 15 minutes to 24 hours (default 12). A summary review card precedes the "Launch Polling Station" confirmation. Public Poll skips Step 3.

### 7.4 Client-Side Draft State Persistence

All wizard input is saved in real time to browser storage (localStorage / IndexedDB). If the host closes the browser or loses connectivity, reopening the app offers a "Resume or discard draft" dialog and returns the host to the last active step. Leaving the wizard with unsaved changes triggers an unsaved-changes warning.

### 7.5 Host Live Analytics Engine & UX Architecture

```
+-----------------------------------------------------------------------+
|                       [ KPI Overview Cards ]                          |
|  +----------------+  +----------------+  +-------------------------+  |
|  | Total Turnout  |  | Ballots Cast   |  | Time Remaining          |  |
|  | 84.2% (Gauge)  |  | 421 / 500      |  | 03h 42m (Countdown)     |  |
|  +----------------+  +----------------+  +-------------------------+  |
+-----------------------------------------------------------------------+
|                     [ Live Category Breakdown ]                       |
|  Position: Chairperson                                                |
|  Candidate A: ######################.... 68% (286 votes) [LEADER]     |
|  Candidate B: #########................. 32% (135 votes)              |
+-----------------------------------------------------------------------+
|  * Live Connected | Data Freshness: Just now                          |
+-----------------------------------------------------------------------+
```

- **Real-time sync:** WebSockets, or polling every 3 to 5 seconds as the fallback, with a status badge (Live Connected | Last Updated: 2s ago) and Reconnecting and Offline variants.
- **KPI cards:** a Turnout ring (ballots submitted divided by approved voters; in Public Poll, a plain ballots-cast counter plus a possible-duplicates counter), a Raw Ballot Counter, and a Session Countdown Timer that switches to a closed state at zero.
- **Category leaderboards:** horizontal progress bars. Pacific Cyan highlights the current leader and Alabaster Grey the others. Equal top counts show a Tie badge. Before voting opens the dashboard shows "Waiting for voting to open", and after close a Final results state.
- **Audit drawer:** tapping a category expands timestamped voter check-in activity, read only from the RegisteredVoters check-in data, never from votes (section 4.9).
- **Export controls:** one-touch PDF or CSV summary reports.

### 7.6 Polling Station Detail Page

Each station opens a detail page with tabs. The header shows the name, a status badge and one contextual primary action (for example Start voting, Extend registration, View results).

- **Overview:** phase timeline with the current phase highlighted, share links with QR code, quick stats.
- **Candidates:** add and edit while registration is open (a + button on each position and a pencil icon on each candidate; no removal), fully read-only once registration closes, with a lock notice.
- **Voters (Closed Vote):** the approval queue from section 4.5.
- **Analytics:** the live analytics engine from section 7.5.
- **Settings:** extend registration, raise the Estimated Voter Count, results visibility (locked once voting starts), allow abstain and mobile-only (locked once registration opens), and a danger zone with Cancel Station.

### 7.7 Screen and Dialog Inventory

Host side:

- Public landing page with Sign In and Sign Up dialog, plus a "Join a poll" entry for voters
- Forgot password, reset password, email verification pending and verified pages (dormant in beta)
- Profile page and Billing page (current plan, Pay-per-use checkout, Premium management, payment states, receipts)
- Dashboard (empty and populated), Setup Wizard, Polling Station detail page, Station settings, Approval queue
- Dialogs: account tier notices (both specified texts), candidate add or edit, upload failure alert, confirm delete, typed-confirmation destructive action, resume or discard draft, unsaved changes, share link with QR code, extend registration, approve all pending, reject with reason, revoke voter, reissue token, block number, start voting (with pending warning), payment gate, export report, session expired, offline notice
- Error pages: 404, 403, 500, maintenance

Voter side (Closed Vote):

- Registration page (name and phone), registration received page with token and waiting status, status page (pending, approved, rejected with reason), token reminder page (reopens the stored token), already registered message, registration full, registration closed, registration not yet open
- Voting entry page (stored token auto-detected, or token and phone number form), voting not yet open with countdown, voting closed, token already used, token invalid or reissued, not yet approved, rejected or revoked with a contact the host message, locked out after too many attempts
- Ballot page, review-before-submit dialog, submission success page
- Live results page, concealed results waiting page, final results page

Voter side (Public Poll) and shared:

- Public ballot page, device-already-voted page
- Mobile Device Required screen with QR code, session expired screen, capacity reached screen

## 8. Business Model & Payment Integration Strategy

### 8.1 Payment Gateway: PayChangu (Malawi)

- PayChangu provides API integration for mobile money collection across Airtel Money and TNM Mpamba, alongside bank cards (VISA/Mastercard).
- Payments are post-beta. When enabled, a payment gate dialog appears before registration or voting can open (section 4.8), offering Pay-per-use or Premium with provider badges.

### 8.2 Tiered Pricing Structure

- **Pay-Per-Use (Single Election Pass):** for one-off church elections and annual student guild polls. A one-time fee via PayChangu per election cycle. Live data is available during the event; results and registered data remain accessible 7 to 14 days post-election before automatic purging.
- **Premium Subscription (Institutional Plan):** for larger organizations, recurring event managers and research agencies. A monthly or annual subscription with permanent archiving of past election records, candidate statistics and historical voter demographics.

## 9. Database Entity Relationship Overview (Conceptual)

- **Users (Hosts):** id, username, password\_hash, email, account\_type (TEMPORARY | LONG\_TERM), last\_login\_at, email\_verified\_at, plan.
- **PollingStations:** id, host\_id, name, mode (PUBLIC\_POLL | CLOSED\_VOTE), status (DRAFT, REG\_OPEN, REG\_CLOSED, VOTE\_OPEN, VOTE\_CLOSED, ARCHIVED, CANCELLED), results\_visibility (IMMEDIATE | CONCEALED), allow\_abstain, mobile\_only, voter\_cap (the Estimated Voter Count; for Public Poll, the ballot ceiling), reg\_ends\_at (max 24h window), vote\_starts\_at, vote\_ends\_at (max 24h window).
- **Categories:** id, polling\_station\_id, title, display\_order.
- **Candidates:** id, category\_id, name, cloudinary\_image\_url.
- **RegisteredVoters (Closed Vote check-in table):** id, polling\_station\_id, full\_name, phone\_number (normalized, unique per station), approval\_status (PENDING | APPROVED | REJECTED | REVOKED), rejection\_reason, registration\_attempts, blocked, token\_hash, failed\_attempts, locked\_until, device\_fingerprint\_hash, client\_device\_uuid, ip\_hash, flag\_reason, has\_voted, voted\_at (minute precision), registered\_at, approved\_at.
- **DeviceRecords (Public Poll):** polling\_station\_id, client\_device\_uuid, device\_fingerprint\_hash, has\_voted. No link to CastVotes.
- **CastVotes (unlinked ballot table):** id (random UUID), polling\_station\_id, category\_id, candidate\_id (null if Abstain). No foreign key to RegisteredVoters or DeviceRecords and no timestamp.
- **Payments:** host, tx\_ref, status, amount, currency, validated per the fulfillment rules in section 12.1.
- **ActivityLog:** station-level events such as candidate additions and edits, approvals, rejections, revocations and token reissues (no vote data).

## 10. Development Lifecycle Summary

- Codebase extension within the existing church voting application repository, using the issue-driven workflow and feature branches (section 3.6).
- Local PostgreSQL setup (vote\_app\_dev for fast beta feature work, vote\_app\_test for strict email verification testing).
- Cloud PostgreSQL on Neon DB: staging\_db for the Vercel beta URL now; production\_db later, with the unlinked ballot secrecy tables from the start.
- Backend on Cloudflare Workers with Express and TypeScript (OOP repository patterns), with the runtime decision verified early (section 3.7).
- Shared package for the phone number normalizer and types.
- Frontend build on Next.js App Router with Material Design 3, TailwindCSS v4, custom color tokens and the shared reusable component library (section 3.4), with all text in locales/en.json.
- Host dashboard, M3 forms, 5-step setup wizard (Steps 0 to 4) and draft persistence.
- Voter flows: Closed Vote registration with token display, status page, host approval queue, token authorization, and the ballot interface (2-column grid, checkmark overlay and blur, single vote per position, mandatory completion, review dialog, result visibility); Public Poll with device signals.
- Security layer: device signals as flags and soft limits, mobile-only toggle, rate limits and lockouts.
- Host Live Analytics Dashboard (real-time sync, KPI cards, leaderboards, audit logs).
- Cloudinary client-side upload signature setup.
- PayChangu payment integration and webhooks (post-beta).

## 11. System Defaults, Fallbacks & Deferred Features

### 11.1 Defaults & Parameter Caps

- **Registration duration:** default 12 hours, minimum 1 hour, maximum 24 hours.
- **Voting window:** default 12 hours, minimum 15 minutes, maximum 24 hours. Start within 7 days of registration closing.
- **Estimated Voter Count (Closed Vote):** default 500, minimum 2, design ceiling 50,000, recommended 2,500 or less on free infrastructure.
- **Public Poll ballot ceiling:** default 2,500 (platform setting).
- **Results visibility:** concealed until the voting window closes.
- **Abstain:** disabled.
- **Mobile devices only:** on in Closed Vote, off in Public Poll.
- **Token lockout:** 5 wrong attempts cause a 15 minute lock; 10 flag the voter.
- **Rejected registrations:** up to 3 attempts per phone number.
- **Status page polling:** every 30 seconds while visible.

### 11.2 Fallbacks

- If Express does not run reliably on Cloudflare Workers, use a Workers-native framework.
- If WebSockets are unavailable on the free plan, live analytics poll every 3 to 5 seconds.

### 11.3 Deferred Features (Post-Beta Roadmap)

- Official production release (Tier 3), paid hosting plans and payments, until funding is available.
- Stronger voter verification (for example SMS verification or automatic matching against an uploaded member list), deliberately left out for now.
- Member list upload with automatic name matching in the approval queue.
- Chichewa and Tumbuka language toggles (strings are already isolated in locales/en.json).
- SMS token delivery, because of carrier gateway costs.
- Custom customization themes.
- Host email verification and PayChangu payments stay post-beta.

### 11.4 Items to Confirm

- The mobile number rule (9 digits starting with 8 or 9) against the official numbering plan.
- The 2,500 voter recommendation, by a load test.
- Host password hashing approach on Workers.
- Which free email provider to use for host account emails.

## 12. Technical Recommendations & Deep-Search Guidelines

### 12.1 PayChangu Payment Integration Best Practices (Post-Beta)

- **Integration modality:** use Hosted Standard Checkout (POST /payment) for web-based host subscription payments and election fee settlements, to delegate PCI-DSS compliance and payment form hosting to PayChangu. Use the Direct Mobile Money API (POST /mobile-money/payments/initialize) only for native mobile applications or embedded checkout experiences.
- **Mobile money operator references:** Airtel Money 20be6c20-adeb-4b5b-a7ba-0769820df4fb; TNM Mpamba 27494cb5-ba9e-437f-a114-4e7a7686bcca; Changu Wallet 550c35a2-86aa-4590-9931-8f23e664cee9.
- **Server-side verification:** never trust client-side redirects or success callbacks alone. Verify transaction finality with GET https://api.paychangu.com/verify-payment/{tx\_ref} for standard sessions, or GET https://api.paychangu.com/mobile-money/payments/{chargeId}/verify for direct mobile charges.
- **Webhook security:** implement a dedicated endpoint. Authenticate each webhook by calculating an HMAC-SHA256 hash on the raw unparsed JSON payload with your API secret key and comparing it to the signature field using a constant-time check. Return HTTP 200 OK immediately to stop PayChangu's retry backoff.
- **Idempotency and fulfillment rules:** assign unique, non-sequential tx\_ref values per checkout attempt. Before enabling polling station features, validate that the transaction reference matches a local record, the status is strictly success or successful, the currency matches (MWK or USD), and the amount paid is at least the required fee.

### 12.2 Voting Platform Security & Architecture Best Practices

- **Token storage:** voter tokens (12 characters, about 60 bits) come from a cryptographically secure random generator and are stored only as an HMAC hash using a server-side secret, so a database leak alone cannot be used to brute-force them. HMAC fits the Workers CPU limit, and rate limits protect against guessing. Every credential is scoped by polling\_station\_id.
- **Rate limiting:** token attempts are limited per phone number and per IP with lockouts (section 4.3), using Workers-native rate limiting. Because the token is the only secret, rate limiting is what makes a 60-bit token safe.
- **Concurrency:** ballot submission runs in one PostgreSQL transaction with a row lock (SELECT FOR UPDATE) or the unique index on (polling\_station\_id, voter\_id) in the check-in table, writing the has\_voted flag and the CastVotes rows together (section 4.9).
- **Abuse mitigation and low bandwidth:** loose IP rate limits on registration and token entry; IP data is a flag, never an identity. Next.js SSR and TailwindCSS v4 keep bundles small for 3G and weak mobile networks.

### 12.3 Data Retention & Regulatory Compliance (Malawi Data Protection Act 2024)

- **Regulatory alignment:** comply with the Malawi Data Protection Act (MDPA 2024) overseen by MACRA regarding the collection, storage and processing of personal data.
- **Data minimization:** voter inputs are limited to full name and phone number. The name is used only so the host can approve the voter, and the phone number only as a unique label and contact. Hashed device identifiers are collected passively for duplicate detection and disclosed in the voter notice. Names and numbers are never shared or used for marketing. National identity numbers are not collected unless explicitly required for a high-security institutional vote.
- **Automated retention engine:** for Temporary Accounts and Pay-Per-Use hosts, a background cleanup job (PostgreSQL cron or a scheduled worker) purges raw voter records (names, phone numbers, tokens and device identifiers) 7 to 14 days post-election, keeping only anonymized aggregated vote tallies. For Long-Term Accounts, a monthly task checks last\_login\_at: above 5 months triggers an email warning, and 6 months or more marks the account for automated deletion.

#### Works cited

- UX Best Practices for Real-Time Performance Dashboard Design, https://www.uxmatters.com/mt/archives/2025/08/from-data-to-decisions-ux-best-practices-for-real-time-performance-dashboard-design.php
- Effective Dashboard Design: Principles, Best Practices, and Examples, https://www.datacamp.com/tutorial/dashboard-design-tutorial
- Dashboard UI Best Practices for Insightful Data Visualization, https://refero.design/p/dashboard-ui-best-practices/
- Dashboard examples using Highcharts Dashboards, https://www.highcharts.com/blog/tutorials/dashboard-examples-using-highcharts-dashboards/
