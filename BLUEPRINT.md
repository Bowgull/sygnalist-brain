# Sygnalist MASTER BLUEPRINT & TECH SPEC

**Version:** v1.2 — Multi-User Engine + Web App  
**Owner:** Joshua  
**Product:** Sygnalist (Job Hunt Engine + Client Coaching System)  
**Platform:** Google Apps Script Web App + Google Sheets (Engine + Client Portals) + External Job APIs + OpenAI API  
**Architecture:** Manual-first, multi-profile, centralized engine, per-client portals, web UI front-end.  
**Tagline:** Sygnalist — FIND THE SIGNAL  
**Core Idea:** The user drives the hunt. Sygnalist turns chaos into signal.  
**Core Belief:** Information is power — every job comes with a summary and a personalized "why you're a good fit."

> If starting a new development session, assume this document is the authoritative source of truth. Do not contradict it. All code must follow these guarantees.

---

## 1. PRODUCT INTENT

### 1.1 Primary Use Case — Job Search for a Single Profile

For each profile (you or a client), Sygnalist:

- Lets the user click a Fetch action in the web app.
- Fetches jobs from external sources (Remotive, RemoteOK, future APIs).
- Normalizes → classifies → scores each job for that profile.
- Auto-enriches every surfaced job with:
  - A short job summary
  - A personalized "why you're a good fit" based on that profile's skill set.
- Writes enriched jobs into:
  - The Engine Inbox (internal system of record), and
  - The client's Portal Inbox (their visible list in Sheets).
- The user manually reviews, stars/promotes jobs, and they move into the Tracker:
  - Tracker = the ledger / system of record for that profile's hunt.

The user always decides:
- When to fetch
- What to pursue
- How to move opportunities through the pipeline

**Sygnalist amplifies signal; it never takes control away.**

### 1.2 Secondary Use Case — Multi-User Coaching (Admin / Coach Mode)

You (Admin/Coach) run Sygnalist for multiple clients at once.

Each client has a Profile with:
- Up to 3 role lanes
- A parsed skill profile from their resume (summary + skills + stories)
- Config for salary, locations, banned content, etc.

You use Sygnalist to:
- Run fetches (manually from the engine or via web admin views)
- Review Inbox + Tracker + analytics centrally
- Coach clients based on:
  - Scores & tiers
  - "Why you're a good fit" text
  - Funnel / outcome stats (applied → interviews → offers → hires)

Sygnalist is designed to scale to ~20+ concurrent profiles with a single engine.

---

## 2. PRODUCT LAWS (NON-NEGOTIABLES)

### 2.1 Must

All external calls (job APIs, OpenAI) must be triggered by explicit user actions:
- Web app button click (client or admin), or
- Admin menu item in the Engine workbook

Every job that appears in any Inbox must have:
- `jobSummary` (non-empty)
- `whyFit` (non-empty, multi-line bullets or structured text)

Scoring weights, profile config, and skill profiles are backend/admin-only.

Profiles can be soft-locked (inactive) without deleting data:
- Locked profiles cannot fetch, enrich, or promote.

All multi-client logic must keep:
- Code hidden from clients
- Client data isolated (no cross-visibility)

### 2.2 Must Not

- ❌ No scheduled/CRON jobs.
- ❌ No onOpen / onEdit calling external APIs.
- ❌ No auto-apply, auto-email, or auto-messaging recruiters.
- ❌ No DOM scraping of LinkedIn, Indeed, etc. (API/TOS-safe only).
- ❌ No user-facing resume uploads to shared storage; admin pastes resume text internally.
- ❌ End users can never see or edit:
  - Apps Script code
  - Scoring weights
  - Skill profile configuration
  - Other clients' data

**Manual, explicit, visible actions only. Sygnalist is an assistant, not an autonomous bot.**

### 2.3 Language Filters (Global Voice Rules)

All user-facing text in Sygnalist (job summaries, "why you're a fit", UI copy, toasts, empty states, helper text) must follow these rules:

- Direct, tactical, and concrete. No filler, no "AI slop".
- No corporate HR sludge: avoid phrases like "we're excited to…", "dynamic fast-paced environment", "rockstar", "ninja", "self-starter" unless quoting the job.
- No fake encouragement or career-coach tone ("you've got this!", "don't worry, you're amazing", etc.).
- No hustle-bro LinkedIn speak, no "personal brand", no "10x", no empty buzzwords.
- Plain language, short sentences, clear logic.
- Focus on what matters for the hunt: skills, evidence, alignment, risk, next steps.
- Summaries and why-fit must sound like a sharp, technical AM/ops person walking someone through the signal, not like marketing or PR.

Any AI-generated text (summary, why-fit, resume parse) must be prompted and post-processed to comply with these filters.

---

## 3. BRAND & VISUAL SYSTEM (FOR WEB APP & PORTALS)

**Goal:** The web UI and Sheets portals must feel like the logo — radar + signal, clean, modern, slightly sci-fi, but friendly.

### 3.1 Brand Keywords

- Radar / signal
- Discovery, clarity, focus
- Calm, not anxious job hunt
- Modern SaaS, not corporate HR sludge

### 3.2 Core Palette (Derived from Logo)

#### Background / Base

- `--color-bg-main: #05060A;` — Deep charcoal/black, slightly textured. Used for page background.
- `--color-bg-elevated: #0D1117;` — Slightly lighter dark surface for cards and panels.

#### Sygnalist "Radar Green" Gradient

Use as a gradient for logo accents, primary buttons, and key chips.

- `--color-radar-light: #A9F2C4;` (outer ring / highlight)
- `--color-radar-mid: #6AD7A3;` (main brand green)
- `--color-radar-dark: #2F8A63;` (shadows, darker chips)

Example gradient:
```css
background: linear-gradient(135deg, #6AD7A3 0%, #2F8A63 40%, #A9F2C4 100%);
```

#### Signal Gold (Star)

- `--color-signal-gold: #FAD76A;`

Used sparingly for:
- Highest tier jobs (S tier accent)
- Important callouts
- Success micro-animations (e.g., "Added to Tracker" icon)

#### Neutrals & Text

- `--color-text-main: #F9FAFB;` (off-white)
- `--color-text-muted: #9CA3AF;` (muted gray)
- `--color-divider: #1F2933;` (lines, card borders)

#### Status / Tier Colors

Subtle chips, never loud neon:

- `--color-tier-s: #FAD76A;` (gold, small glow allowed)
- `--color-tier-a: #6AD7A3;` (radar green mid)
- `--color-tier-b: #38BDF8;` (soft cyan, optional)
- `--color-tier-c: #9CA3AF;` (neutral gray)
- `--color-tier-f: #4B5563;` (dark gray)
- `--color-tier-x: #DC2626;` (red, used rarely in UI)

### 3.3 Typography

Use a modern, geometric sans family (e.g. Inter, DM Sans, or Poppins via Google Fonts).

- Logo lockup: in image only.

Scale:
- H1 (page title): 28–32px, bold, tracking slightly expanded. Example: FIND THE SIGNAL.
- H2 (section headings): 20–22px, semi-bold.
- Body text: 14–16px, normal weight.
- Caption / meta text: 12–13px, muted color (`--color-text-muted`).

### 3.4 Layout & Components (Web App)

Overall layout:
- Centered, max width ~1200px.
- Top nav bar with logo at left, profile display + status at right.
- Main area split 60/40 between Inbox and Tracker Snapshot.

Cards:
- Background `--color-bg-elevated`.
- Border radius 16–18px.
- Subtle box shadow (no harsh edges).
- Thin 1px border in `--color-divider`.

Buttons:
- Primary buttons use the radar gradient with white text.
- Border radius ~999px (pill) or 9999px for main CTAs.
- Hover: mild scale (1.03) + slightly brighter glow.
- Disabled: flat dark gray, 50% opacity text.

Chips / badges:
- Tier chips: small pill with background color per tier + uppercase label.
- Lane / role chips: outlined with subtle green edge.

Interactions:
- Collapsible sections for Summary / Why you're a fit.
- Smooth 200–300ms transitions.
- Toasts in bottom-right or top-center, matching brand.

### 3.5 Sheets Theming (Client Portals)

Client Portal Sheets loosely match the web app:
- Dark theme where possible:
  - Header row with dark background and radar green text.
  - Status chips in cells (via conditional formatting) using the same tier colors.
- Use the Sygnalist logo as the header image in the first tab (Instructions / Overview).
- Column headers may include emojis sparingly (e.g. ⭐, 📡) but keep it professional.

---

## 4. SYSTEM ARCHITECTURE

Sygnalist is a three-layer system:

- **Engine** (Admin Workbook + Apps Script) — the brain and data store.
- **Client Portals** (one Sheet per client) — per-client views (Inbox + Tracker).
- **Web App UI** (Apps Script Web App) — the interface clients use to fetch, add jobs, and interact with their data.

### 4.1 Engine (Admin Workbook)

Google Sheet only you (Admin) can access as an editor.

Contains:
- `Admin_Profiles` (profiles + preferences + skill profiles)
- `📓 Logs` (audit trail)
- `📊 Admin_Analytics` (aggregates & health)
- `Engine_Inbox` (optional: master Inbox table across profiles)
- `Engine_Tracker` (optional: master Tracker table across profiles)

Owns:
- All Apps Script project code.
- All external API calls.
- All scoring/enrichment logic.
- All admin menus (Sygnalist menu).

### 4.2 Client Portals (Per-Client Workbooks)

One Google Sheet per client (or per cohort).

Each Portal contains:
- Inbox sheet (their job list)
- Tracker sheet (their pipeline)
- How To Use Sygnalist sheet (instructions)

Data flows:
- Engine writes / syncs rows for that profile to their Portal via Apps Script (`SpreadsheetApp.openById(...)`).
- Clients get Editor access only to their Portal, never to the Engine workbook.

### 4.3 Web App UI (Apps Script Web App)

Public entry point clients actually use.

- Mounted at a URL like: `https://script.google.com/.../exec?profileId=XYZ`

Responsibilities:
- Authenticate / identify the profile (profileId or email-based mapping).
- Render the Sygnalist dashboard (Inbox cards, Tracker snapshot).
- Provide controls:
  - 📡 Fetch Jobs
  - 📝 Add Job Manually
  - ⭐ Add to Tracker per job card
- Call backend Apps Script functions which operate on the Engine & Portal sheets.
- All external logic runs server-side in Apps Script; the web app is just the presentation layer.

### 4.4 Operating Modes (Pivot)

Sygnalist supports two operating modes.

**Mode A: Portal Mode (existing behavior)**
Engine writes to Portal sheets.

**Mode B: Engine-Only Mode (new default)**
Engine is the only datastore; clients never touch Sheets.

Implementation impact:
Introduce a single config flag (conceptually): `FLAGS.ENGINE_ONLY_MODE = true`

Any function that currently writes to portals becomes:
- Route write to Engine sheets always
- If portal exists AND mode is Portal Mode, also mirror to portal
- If portal missing or Engine-Only mode, portal write is a no-op

✅ This keeps portals "supported" but not required.

---

## 5. USER TYPES & PERMISSIONS

### 5.1 System Admin / Coach (Joshua)

Full access to:
- Engine workbook (all tabs)
- Apps Script project (code)
- Deployed web app (admin routes)

Admin status is `Admin_Profiles.isAdmin = TRUE`.

Can:
- Create/modify profiles
- Soft-lock/unlock profiles
- Paste resumes + build skill profiles
- Run fetches for any profile
- View all Logs & Analytics
- Change scoring rules in code
- Set or change mappings between profileId and portalSpreadsheetId

### 5.2 Client / End User

Interacts through:
- Web App UI (primary)
- Their own Portal Sheet (Inbox + Tracker, secondary)

Sees:
- Inbox cards for their profile
- Tracker rows for their profile
- "Why you're a good fit" and job summaries

Can:
- Trigger Fetch Jobs (web app)
- Manually add jobs (web app)
- Mark jobs to add to Tracker (web app)

In Portal:
- Filter, sort, update status, add notes.

Cannot:
- See or edit code
- See any other profile's data
- Change scoring rules or system configuration
- Switch profiles in the web app (admin-only)
- Access the Engine workbook directly

---

## 6. DATA MODELS (CANONICAL TYPES)

These are the contracts all functions, sheets, and UI must respect.

### 6.1 Profile & RoleTrack

```typescript
type RemotePreference = "remote_only" | "remote_or_hybrid" | "onsite_ok";
type ProfileStatus = "active" | "inactive_soft_locked";

interface RoleTrack {
  id: string;              // "cs", "impl", "support"
  label: string;           // "Customer Success"
  roleKeywords: string[];  // ["customer success", "account manager", ...]
  industries: string[];    // optional
  laneLabel: string;       // "Use CS lane" / "Review JD"
  priorityWeight: number;  // admin-only weight
}

interface Profile {
  profileId: string;           // Simple human-readable ID (see format rules below)
  displayName: string;         // "Joshua — CS/Impl"
  email: string;

  status: ProfileStatus;       // active or inactive_soft_locked
  statusReason: string;        // free-text, why locked

  salaryMin: number;
  preferredLocations: string[];
  locationBlacklist: string[];
  remotePreference: RemotePreference;

  bannedKeywords: string[];
  disqualifyingSeniority: string[];

  allowSalesHeavy: boolean;
  allowPhoneHeavy: boolean;
  allowWeekendWork: boolean;
  allowShiftWork: boolean;

  skillKeywordsPlus: string[];
  skillKeywordsMinus: string[];

  // Parsed skill profile, used by AI enrichment
  skillProfileText: string;    // 3–7 line summary of candidate
  topSkills: string[];         // 8–15 skills
  signatureStories: string[];  // 3–5 bullets / short stories

  roleTracks: RoleTrack[];

  // Portal mapping
  portalSpreadsheetId: string; // Google Sheets ID for this client's portal

  isAdmin: boolean;
  webAppUrl: string;
  clientCopyLink?: string; // same as webAppUrl for now
}
```

**Soft lock semantics:**
- If `status !== "active"`, any attempt to fetch/enrich/promote for that profile must be blocked with:
  - Toast / UI error
  - Log entry (LogEvent with action="error")

#### Profile ID Format Rules

Profile IDs are simple, human-readable identifiers chosen by the admin when creating a profile.

| Rule | Detail |
|------|--------|
| Length | 2–20 characters |
| Case | Lowercase only |
| Allowed chars | Letters (a-z), numbers (0-9), underscores (_), hyphens (-) |
| Uniqueness | Must be unique across all profiles |

**Examples:**
- `josh` — personal profile
- `sarah` — client name
- `client1` — generic client
- `acme_corp` — company name

**NOT allowed:**
- `p_a1b2c3d4` — random UUIDs are confusing
- `Josh` — must be lowercase
- `my profile` — no spaces

### 6.2 Job Models

```typescript
interface Job {
  title: string;
  company: string;
  url: string;
  source: string;
  location: string | null;
  salary: {
    min: number | null;
    max: number | null;
    currency: string | null;
  };
  description: string;
  remote: boolean | "hybrid" | null;
  tags: string[];
  raw: any;  // original source payload
}

interface ClassifiedJob extends Job {
  roleType: string;    // roleTrack.id or "Unknown"
  laneLabel: string;   // lane label or "Review JD"
  category: string;    // roleTrack.label or "Unknown"
}

type Tier = "S" | "A" | "B" | "C" | "F" | "X";

interface ScoredJob extends ClassifiedJob {
  score: number;
  tier: Tier;
  excluded: boolean;   // true when hard filter triggered (Tier X)
}

interface EnrichedJob extends ScoredJob {
  jobSummary: string;  // required, non-empty
  whyFit: string;      // required, non-empty, multi-line bullets
}
```

### 6.3 TrackerEntry & LogEvent

```typescript
interface TrackerEntry {
  profileId: string;
  added_at: number;         // ms since epoch
  company: string;
  title: string;
  url: string;
  source: string;
  dateApplied: number | null;
  status: string;           // pipeline stage
  location: string | null;
  roleType: string | null;
  laneLabel: string | null;
  category: string | null;
  jobSummary: string | null;
  whyFit: string | null;
  notes: string | null;
}

type LogAction = "fetch" | "enrich" | "promote" | "error" | "admin";

interface LogEvent {
  timestamp: number;
  profileId: string | null;
  action: LogAction;
  source: string | null;
  details: string; // JSON or compact text
}
```

---

## 7. SHEETS & SCHEMA

### 7.1 Engine Sheets (Admin Workbook)

#### 7.1.1 Admin_Profiles

Purpose: System of record for all Profiles + soft lock state + skills + portal mapping.

| Col | Header | Notes |
|-----|--------|-------|
| A | profileId | string, unique key |
| B | displayName | "Joshua — CS/Impl" |
| C | email | |
| D | status | "active" / "inactive_soft_locked" (DV) |
| E | statusReason | why locked / notes |
| F | salaryMin | number |
| G | preferredLocations | comma-separated |
| H | locationBlacklist | comma-separated |
| I | remotePreference | DV: remote_only / remote_or_hybrid / onsite_ok |
| J | bannedKeywords | comma-separated |
| K | disqualifyingSeniority | comma-separated |
| L | allowSalesHeavy | TRUE/FALSE |
| M | allowPhoneHeavy | TRUE/FALSE |
| N | allowWeekendWork | TRUE/FALSE |
| O | allowShiftWork | TRUE/FALSE |
| P | skillKeywordsPlus | comma-separated |
| Q | skillKeywordsMinus | comma-separated |
| R | skillProfileText | long text |
| S | topSkills | comma-separated |
| T | signatureStories | JSON or newline bullets |
| U | roleTracksJSON | JSON string of RoleTrack[] |
| V | portalSpreadsheetId | Google Sheet ID for that client's portal |
| W | webAppUrl | Canonical web app URL (.../exec?profileId=<id>) |
| X | isAdmin | TRUE/FALSE; controls admin permissions (profile switching) |
| Y | clientCopyLink | (optional) same as webAppUrl for now |

Admin-only editing.

#### 7.1.2 📓 Logs

| Col | Header | Notes |
|-----|--------|-------|
| A | timestamp | datetime |
| B | profileId | string / null |
| C | action | fetch / enrich / promote / error / admin |
| D | source | "remotive", "remoteok", "web_app", etc. |
| E | details | JSON or text |

#### 7.1.3 📊 Admin_Analytics

Purpose: Admin-only analytics and diagnostics.

Minimum content:

Aggregated stats per profile:
- jobs in Tracker
- applications (status >= "Applied")
- interviews
- offers / hires

Aggregated stats per source:
- jobs fetched
- jobs after scoring/enrichment
- jobs promoted to Tracker
- avg score/tier

Profile status overview:
- active vs soft-locked counts

Time windows:
- last 30 / 60 / 90 days

Implementation: formulas (QUERY / PIVOT) + optional `computeAnalytics_()` that writes summary tables.

### 7.2 Portal Sheets (Per-Client Workbook)

Each Portal has at least:

#### 7.2.1 Inbox (Client-Facing)

| Col | Header | Type |
|-----|--------|------|
| A | score | number |
| B | tier | string |
| C | company | string |
| D | title | string |
| E | url | string |
| F | source | string |
| G | location | string |
| H | roleType | string |
| I | laneLabel | string |
| J | category | string |
| K | jobSummary | string |
| L | whyFit | string |
| M | notes | string |

Rows ≥2: data. Sorting/filter performed by client.

#### 7.2.2 Tracker (Client-Facing)

| Col | Header | Type |
|-----|--------|------|
| A | added_at | datetime |
| B | company | string |
| C | title | string |
| D | url | string |
| E | source | string |
| F | dateApplied | datetime |
| G | status | DV: pipeline states |
| H | location | string |
| I | roleType | string |
| J | laneLabel | string |
| K | category | string |
| L | jobSummary | string |
| M | whyFit | string |
| N | notes | string |

Status list example:
- Prospect
- Applied
- Interview 1
- Interview 2
- Final Interview
- Offer 🤝🔥
- Rejected 💀
- Ghosted 👻

Conditional formatting can be used for colored chips (radar-green for active, gold for offer, red for rejected, etc.).

---

## 8. CORE ENGINE FLOWS

Entry points are web app actions and admin menu items, not direct sheet manipulation by clients.

### 8.1 Fetch + Auto-Enrich Pipeline

**Web app entry point:**
- Client clicks 📡 Fetch Jobs in the web UI.

**Frontend calls:**
- `serverFetchForProfile_(profileId)`

**Server-side flow (serverFetchForProfile_):**

1. **Profile resolution**
   - Calls `getProfileByIdOrThrow_(profileId)`.
   - If `status !== "active"`:
     - Throw, return error to web UI.
     - Log LogEvent with action="error".

2. **Search terms & sources**
   - `buildFetchRequestForProfile_(profile)` returns:
     - searchTerms: string[] (per roleTrack)
     - sources: string[] (e.g. ["remotive", "remoteok"])

3. **External fetch**
   - Loop over each (source, term):
     - `fetchFromSource_(source, term)` → Job[]
     - `logEvent_({ action: "fetch", source, profileId, ... })`

4. **Dedup**
   - `dedupeJobs_(jobs: Job[])`: Job[]
   - Primary key: url
   - Secondary: lowercase company + title

5. **Classification & scoring**
   - `classifyJobsForProfile_(jobs, profile)` → ClassifiedJob[]
   - `scoreJobsForProfile_(classified, profile)` → ScoredJob[]
   - Apply:
     - Hard filters → excluded = true, tier = "X", score = -999
     - Soft scoring → score, tier

6. **Filter & cap**
   - Keep: `!excluded && score >= CONFIG.MIN_SCORE_FOR_INBOX`
   - Sort by score desc.
   - Cap at `CONFIG.MAX_JOBS_PER_FETCH` (e.g., 25).

7. **Auto-enrichment (summary + why-fit)**
   - `enrichJobsForProfile_(scoredJobs, profile)` → EnrichedJob[]
   - For each job:
     - Build prompt from:
       - Profile skill fields
       - Job title, company, description, tier, score
       - Global language filters from Section 2.3 (voice rules)
     - `aiRequest_(prompt, CONFIG.OPENAI_MODEL)`
     - Parse JSON into:
       - jobSummary: 2–4 lines, plain language, focused on what the role actually is.
       - whyFit: 3–5 bullets, each 1–2 lines, mapping the profile's skills/stories to this role.
   - Enforced shape for whyFit bullets:
     - Each bullet must state a concrete reason ("You've already done X that maps to Y here") or a clear risk/consideration.
     - No generic praise, no "great fit" fluff, no corporate HR tone (see 2.3).
   - On error:
     - Log action="error", level="WARN" with details.
     - Skip that job (do not surface it).

8. **Write to Engine (System of Record) + Optional Portal Mirror**
   - Routing rule:
     - Always write to Engine sheets.
     - Portal writes are optional and only happen if (a) Portal Mode is enabled and (b) portalSpreadsheetId exists.
   - `writeEngineInbox_(enrichedJobs, profileId)` (required system of record).
   - `writePortalInbox_(enrichedJobs, profile.portalSpreadsheetId)`: (mirror only, conditional)
     - Clears or appends according to design (v1: clear and replace).
     - Writes rows to the client's Inbox sheet.

9. **Return response to web app**
   - Send a summarized payload (count, top few jobs) so UI can show "Fetched 17 jobs" and refresh the view.

### 8.2 Promotion: Inbox → Tracker

**Web app entry point:**
- In the UI, each Inbox card has a ⭐ Add to Tracker button.

**Flow:**
- Web app sends `promoteJobToTracker_(profileId, jobId)` (or job key).

**Server:**
- Loads job data from Engine Inbox or Portal Inbox.
- Builds TrackerEntry for that profile.
- Checks duplicates via `trackerHasDuplicate_(entry)`:
  - Key: profileId + company + title (and optionally url).
- Routing rule:
  - Always write to Engine sheets (system of record).
  - Portal writes are optional and only happen if (a) Portal Mode is enabled and (b) portalSpreadsheetId exists.
- Appends to:
  - Engine Tracker (required system of record).
  - Portal Tracker sheet for that profile (mirror only, conditional).
- **Promote must be safe to click twice without duplicates.**
- Sets:
  - added_at = now
  - status = "Prospect" by default
- Logs action="promote" with count.

**Web app:**
- Shows success animation.
- Optionally marks card as "In Tracker".

### 8.3 Manual Add Job (with Enrichment)

**Web app entry point:**
- Client clicks 📝 Add Job Manually.

**Flow:**

UI form collects:
- URL
- Title
- Company
- Location (optional)
- Source (optional: "LinkedIn", "Referral", etc.)
- Description (optional paste)

Server call: `manualAddJob_(profileId, jobInput)`:
- Resolves profile.
- Constructs a minimal Job object.
- If description is missing or short, may:
  - (v2) Use simple scraping API, or
  - v1: just enrich from title + company + any text given.

**Enrichment:**
- Calls `enrichJobsForProfile_([job], profile)` to get EnrichedJob.

**Writes directly to Tracker:**
- Uses TrackerEntry with:
  - status = "Prospect" (or "Applied" if they choose).
- Routing rule: Always write to Engine sheets. Portal writes are optional and only happen if (a) Portal Mode is enabled and (b) portalSpreadsheetId exists.

**Returns job + texts to UI:**
- UI shows a "Successfully added" confirmation with the summary & why-fit visible.

---

## 9. RESUME PARSE & SKILL PROFILE BUILDER

### 9.1 Goal

Convert raw resume text into a structured skill profile:
- 3–7 sentence narrative summary of background.
- 8–15 top skills (keywords).
- 3–5 signature stories (achievement bullets with outcomes).

These fields are used in all enrichment prompts.

### 9.2 Flow (Admin Only)

**Entry point:** Engine menu item 🧬 Build Skill Profile from Resume

Admin invokes menu or web admin view:
- Sidebar / modal opens with:
  - profileId selector (dropdown from Admin_Profiles).
  - Large textarea: "Paste full resume text here."

On submit:
- Calls `parseResumeToSkillProfile_(rawText)` → `{ skillProfileText, topSkills[], signatureStories[] }`.
- Writes to the Admin_Profiles row for that profile:
  - R: skillProfileText
  - S: topSkills (comma-separated)
  - T: signatureStories (multiline or JSON)
- Logs action="admin" with details.

From then on, every fetch/enrichment for that profile pulls from these fields.

---

## 10. SCORING & CLASSIFICATION SUMMARY

### 10.1 Classification

For each Job:
- Combine title + description → text.
- For each roleTrack:
  - Count hits of roleKeywords.
  - Weight by priorityWeight.
  - Choose roleTrack with highest weighted score.

Tie-breakers:
- Higher priorityWeight
- More skillKeywordsPlus matches

If below minimum threshold:
- roleType = "Unknown"
- laneLabel = "Review JD"
- category = "Unknown"

### 10.2 Scoring

**Hard filters → Tier X (exclude):**
- bannedKeywords present
- disqualifyingSeniority present
- Certain language/location mismatches

Hard filters set:
- score = -999
- tier = "X"
- excluded = true

**Positive signals (examples):**
- Role match (track) = +30–40
- Location match = +10–15
- Remote preference alignment = +5–10
- Each skillKeywordsPlus hit = +2–6
- Lane priorityWeight acts as multiplier
- Salary ≥ salaryMin = bonus

**Soft penalties:**
- Slightly below salaryMin
- skillKeywordsMinus hits
- Disallowed sales/phone/weekend/shift content (if profile disallows)

**Tier mapping:**
- S: 90+
- A: 75–89
- B: 60–74
- C: 0–59
- F: < 0
- X: -999 (hard stop, excluded)

---

## 11. ADMIN ANALYTICS, LOGGING & HEALTH

### 11.1 Soft Lock Controls

Fields in Admin_Profiles: `status` & `statusReason`.

Admin-only actions:
- Set profile to `inactive_soft_locked` with reason.
- Restore to `active`.

Any attempt to:
- Fetch for locked profile
- Promote for locked profile

→ must be blocked with:
- Toast / web error
- Log event (action="error")

### 11.2 Analytics (📊 Admin_Analytics)

Minimum metrics:

**Per Profile:**
- Total jobs in Tracker
- Applications (statuses ≥ "Applied")
- Interviews
- Offers / hires
- Conversion rates

**Per Source:**
- Jobs fetched
- Jobs after scoring/enrichment
- Jobs promoted to Tracker
- Avg score by source
- Offers by source

**Per Lane (CS/Impl/Support/etc.):**
- Jobs in Tracker
- Interviews / offers
- Tier distribution

Implementation:
- Start with formulas (QUERY / PIVOT).
- Optionally add `computeAnalytics_()` to precompute tables.

### 11.3 Logging Rules

All core flows must write to 📓 Logs using LogEvent:

`logEvent_` must write to:
- 📓 Logs (canonical)
- Logs Export sheet (pretty ops view) if enabled / configured

Any multi-step run generates a batchId once and threads it through all logs.

#### Batch ID Format

Batch IDs are short, human-readable timestamps for grouping related log entries.

| Format | Example | Meaning |
|--------|---------|---------|
| `b_MMDD_HHMM` | `b_0201_1432` | Feb 1st, 2:32pm |

**Why this format:**
- Easy to read and understand at a glance
- Tells you when the batch happened
- Short enough to scan in logs
- No random UUIDs

- fetch: on every `fetchFromSource_` call
- enrich: on enrichment batches (start/end, counts)
- promote: on promotions from Inbox → Tracker
- error: on any failure impacting user actions
- admin: on destructive/admin events (rebuild, health check, profile changes)

details is always a JSON string with at least:
```json
{
  "level": "WARN" | "ERROR",
  "message": "human-readable message",
  "meta": { "count": 12, "source": "remotive", "url": "..." },
  "batchId": "<id>"
}
```

- WARN = non-fatal (e.g., 1 job skipped).
- ERROR = fatal for that operation (e.g., API key missing, fetch failed).

### 11.4 Logs Export (Pretty Ops View)

The canonical 📓 Logs sheet is for raw data storage. A separate **Logs Export** Google Sheet provides a visually readable ops dashboard.

#### 11.4.1 Logs Export Sheet Setup

- **Location:** Separate Google Sheet (not in the Engine workbook)
- **Purpose:** Human-readable, color-coded activity log for admin review
- **Write trigger:** `logEvent_()` writes to both 📓 Logs (canonical) AND Logs Export (if configured)
- **Config:** `CONFIG.LOGS_EXPORT_SPREADSHEET_ID` stores the Sheet ID

#### 11.4.2 Column Schema

| Col | Header | Width | Notes |
|-----|--------|-------|-------|
| A | 🕐 Time | 140px | Formatted datetime (e.g., "Jan 15, 2:34 PM") |
| B | 👤 Profile | 120px | displayName or profileId |
| C | ⚡ Action | 100px | fetch / enrich / promote / error / admin |
| D | 📡 Source | 100px | remotive, remoteok, web_app, manual, etc. |
| E | 📊 Result | 80px | Emoji + short status (see below) |
| F | 📝 Details | 300px+ | Human-readable summary (not raw JSON) |
| G | 🔗 Batch | 100px | batchId for grouping multi-step flows |

#### 11.4.3 Result Column Emoji Legend

| Outcome | Emoji | Color (Row BG) | Example |
|---------|-------|----------------|---------|
| Success | ✅ | Light green `#d4edda` | "17 jobs fetched" |
| Partial/Warn | ⚠️ | Light yellow `#fff3cd` | "14 enriched, 2 skipped" |
| Error | ❌ | Light red `#f8d7da` | "API timeout" |
| Info/Neutral | ℹ️ | Light gray `#e9ecef` | "Health check started" |
| Promote | ⭐ | Light gold `#fef3c7` | "Added to Tracker" |
| Admin Action | 🔧 | Light purple `#e9d5ff` | "Profile unlocked" |

#### 11.4.4 Visual Formatting Rules

**Row height:** 28–32px (comfortable reading)

**Cell formatting:**
- Text wrap enabled on Details column
- Vertical align: middle
- Font: 11–12px, consistent with Sheets defaults
- Header row: Bold, dark background (`#1f2937`), white text

**Conditional formatting:**
- Entire row gets background color based on Result column value
- Use Apps Script `setBackground()` on write, or Sheets conditional formatting rules

**Freeze:**
- Row 1 (headers) frozen
- Column A (Time) frozen for horizontal scroll

#### 11.4.5 Details Column Formatting

The Details column should be human-readable, not raw JSON.

**Good examples:**
- `Fetched 17 jobs from remotive for "customer success"`
- `Enriched 14/16 jobs (2 skipped: API error)`
- `Promoted "Senior CSM at Acme" to Tracker`
- `Profile "Joshua" soft-locked: "On vacation"`

**Bad examples:**
- `{"count":17,"source":"remotive","term":"customer success"}`
- Raw error stack traces

#### 11.4.6 Implementation Notes

```javascript
function writeLogsExport_(event) {
  const exportId = CONFIG.LOGS_EXPORT_SPREADSHEET_ID;
  if (!exportId) return; // Skip if not configured
  
  const ss = SpreadsheetApp.openById(exportId);
  const sheet = ss.getSheetByName("Logs") || ss.insertSheet("Logs");
  
  const row = [
    formatTimestamp_(event.timestamp),
    event.profileId || "—",
    event.action,
    event.source || "—",
    getResultEmoji_(event),
    formatDetailsHuman_(event.details),
    event.batchId || "—"
  ];
  
  sheet.appendRow(row);
  applyRowFormatting_(sheet, sheet.getLastRow(), event);
}
```

### 11.5 Debug Panel & Health Check

Debug block on 📊 Admin_Analytics:

- **Last 5 errors:** time, profileId, action, source, short message.
- **Last fetch per profile:** profileId, last fetch time, job count, sources.
- **Last enrichment:** profileId, jobs enriched, error count.
- **Last health check:** timestamp, status (PASS / WARN / FAIL), notes.
- **Soft-locked profiles:** profileId, displayName, statusReason.

Health check function: `runHealthCheck_()` (admin menu only):

Verifies:
- OPENAI_API_KEY exists in Script Properties.
- For each enabled source in CONFIG.DEFAULT_SOURCES, ping endpoint.
- Required sheets exist:
  - Admin_Profiles
  - Engine Inbox/Tracker (if used)
  - 📓 Logs
  - 📊 Admin_Analytics

Outputs:
- Log event (action="admin", source="health_check").
- Updates cells in 📊 Admin_Analytics:
  - LastHealthCheckTime
  - LastHealthCheckStatus (PASS / WARN / FAIL)

---

## 12. CONFIG & SECRETS MANAGEMENT

### 12.1 Secrets (Script Properties)

Stored in Apps Script → Project Settings → Script Properties.

Example keys:
- OPENAI_API_KEY
- REMOTIVE_API_KEY
- REMOTEOK_API_KEY
- WEWORKREMOTELY_API_KEY (future)
- ZIPRECRUITER_API_KEY (future)

Helper:
```javascript
function getAPIKey_(name) {
  const key = PropertiesService.getScriptProperties().getProperty(name);
  if (!key) {
    throw new Error(name + " not set");
  }
  return key;
}
```

**Never store API keys in sheets or inline in code.**

### 12.2 Non-Secret Config (CONFIG)

Centralized config object:
```javascript
const CONFIG = {
  Sygnalist_VERSION: "1.2.0",

  MAX_JOBS_PER_FETCH: 25,
  MIN_SCORE_FOR_INBOX: 60,
  MAX_DESC_CHARS_FOR_AI: 4000,

  OPENAI_MODEL: "gpt-4o-mini",

  DEFAULT_SOURCES: ["remotive", "remoteok"],

  HEALTHCHECK_TIMEOUT_MS: 8000
};
```

All constants (max jobs, model names, thresholds) must reference CONFIG.

### 12.3 Feature Flags (FLAGS)

Toggle integrations and features without ripping code:
```javascript
const FLAGS = {
  ENABLE_WEWORKREMOTELY: false,
  ENABLE_GREENHOUSE: false,
  ENABLE_LEVER: false
};
```

`fetchFromSource_(source, term)` reads FLAGS to decide which adapters are active.

### 12.4 Versioning

Keep the version in one place:
```javascript
const Sygnalist_VERSION = CONFIG.Sygnalist_VERSION;
```

Optionally display on 📊 Admin_Analytics so you know which version a workbook/engine is running.

---

## 13. WEB APP UI/UX DESIGN SPEC (FULL)

This section defines how the web app should look and feel, on top of the functional flows in Section 8.

### 13.0 Product Experience Intent

The Sygnalist Web App must deliver a premium, controlled, analytical hunt experience that makes users say:

> "Holy shit… this feels like a radar system for jobs."

NOT:
- "Just another spreadsheet"
- "Another AI chatbot"
- "Corporate HR software"
- "An Airtable clone"

The UI reinforces the product philosophy:
**User drives the hunt. Sygnalist amplifies the signal.**

### 13.1 Brand Experience Overview

**Brand Keywords:**
- Radar
- Signal
- Precision
- Calm control
- Discovery
- Modern SaaS
- Analytical
- Slight sci-fi (subtle HUD vibe)

**Emotional Targets:**

The user should feel:
- In control (manual-first system)
- Empowered (job signal > noise)
- Informed (summaries + why-fit)
- Supported (without losing agency)

If UI does not deliver those — it fails.

### 13.2 Design Language System

#### 13.2.1 Color System

Use the CSS tokens from Section 3.2:
```css
:root {
  --color-bg-main: #05060A;
  --color-bg-elevated: #0D1117;
  --color-bg-glass: rgba(13,17,23,0.60);

  --color-radar-light: #A9F2C4;
  --color-radar-mid: #6AD7A3;
  --color-radar-dark: #2F8A63;

  --color-signal-gold: #FAD76A;
  --color-tier-b: #38BDF8;
  --color-tier-c: #9CA3AF;
  --color-tier-f: #4B5563;
  --color-tier-x: #DC2626;

  --color-text-main: #F9FAFB;
  --color-text-muted: #9CA3AF;
  --color-text-disabled: rgba(156,163,175,0.40);

  --color-divider: #1F2933;
  --color-border-light: rgba(148,163,184,0.45);
}
```

**Surface Usage Rules:**

| Surface | Token | Use |
|---------|-------|-----|
| App background | --color-bg-main | Full viewport |
| Cards / Panels | --color-bg-elevated | Inbox, Tracker Snapshot |
| Glass overlays | --color-bg-glass | Modals & overlays |
| CTA Gradient | radar gradient | Primary action |
| Tier chips | tier tokens | S/A/B/C/X |
| Text main | --color-text-main | Body copy |
| Text muted | --color-text-muted | Meta lines |
| Dividers | --color-divider | 1px borders |

**Radar Gradient Definition** (Used for primary CTA):
```css
background: linear-gradient(135deg, #6AD7A3 0%, #2F8A63 40%, #A9F2C4 100%);
```

#### 13.2.2 Typography

Typeface: Inter, DM Sans, or Poppins.

| Token | Size | Weight | Usage |
|-------|------|--------|-------|
| h1 | 28–32px | 700 | Page Titles |
| h2 | 20–22px | 600 | Section Headers |
| h3 | 16–18px | 600 | Job Titles |
| body | 14–16px | 400 | Main Text |
| meta | 12–13px | 400 | Timestamps, Source |

Rules:
- Uppercase lineage for chips & status
- Tagline tracking: 0.18em
- No justified text
- Max line width: ~75 characters

### 13.3 Layout & Grid System

**Grid:**
- Max width: 1200px
- Columns: 12
- Gutter: 24px
- Margin: auto center

**Vertical Rhythm:**

| Space | Use |
|-------|-----|
| 4px | tight stacking |
| 8px | chip rows / meta |
| 12px | card internal row spacing |
| 16px | component spacing |
| 24px | section spacing |
| 32px | top-level sections |

**Dashboard Layout (Desktop 1440px+):**
```
-------------------------------------------------------
| NAVBAR                                              |
-------------------------------------------------------
| CTA ROW                                             |
-------------------------------------------------------
|       INBOX (60–70%)        |   TRACKER SNAPSHOT   |
|                             |   (30–40%)           |
-------------------------------------------------------
```

Tablet/Mobile: stacks vertically.

### 13.4 Component System (Full Library)

#### 13.4.1 Navigation Bar

Contents:
- Left: Sygnalist logo + tagline ("FIND THE SIGNAL")
- Right: ProfileName + StatusPill + Version (and Profile Switcher if isAdmin)

Navbar right side behavior:
- If isAdmin: show profile dropdown / switcher
- If not admin: show profile name only (no switcher)

Specs:
- Height: 64–72px
- Background: --color-bg-elevated
- Border-bottom: 1px solid --color-divider
- Sticky on scroll

**Status Pills:**

| Status | BG | Text |
|--------|----|----|
| Active | rgba(34,197,94,0.18) | #bbf7d0 |
| Locked | rgba(220,38,38,0.18) | #fecaca |

#### 13.4.2 CTA Row

Contains 2 actions:

**Primary CTA:**
- Label: 📡 Fetch New Roles
- Style:
  - Radar gradient fill
  - White text
  - Radius: 9999px
  - Height: 44–48px
  - Hover: +3% scale & glow
  - Disabled: grayscale + 40% opacity

**Secondary CTA:**
- Label: 📝 Add Job Manually
- Style:
  - Transparent BG
  - Radar-green border
  - White text

**Timestamp:**
- Last fetched: <timestamp>
- Style: meta typography

#### 13.4.3 Chips

**Tier Chips (Filled):**

| Tier | Color |
|------|-------|
| S | --color-signal-gold |
| A | --color-radar-mid |
| B | --color-tier-b |
| C | --color-tier-c |
| X | --color-tier-x |

**Lane Chips:**
- Outlined
- Border: 1px solid --color-border-light
- Text: --color-text-main

**Remote Chips:**
- Options: Remote, Hybrid, Onsite
- Style: uppercase outlined

#### 13.4.4 Job Card (FULL)

**Skeleton (Front Face):**
```
[ TIER CHIP ] [ LANE CHIP ] [ REMOTE CHIP ]

Job Title
Company (muted)
Location • Source • Salary (if available)

Divider
2-line preview of Summary (truncated)
Right-aligned action icon:
  • Icon: small radar/target + text label "WHY YOU FIT"

Bottom row:
[⭐ Add to Tracker]         [💡 Open Why You Fit]
```

**Skeleton (Back Face — Why-Fit View):**
```
Header row:
  • Left: "Why You're a Fit"
  • Right: "← Back to overview" (icon + text) to flip back

Body:
  • 3–5 bullets, each 1–2 lines.
  • Each bullet must follow language filters (Section 2.3):
    – Concrete, tactical reasons.
    – No generic praise, no HR-speak.

Footer:
  • Small meta text: "Based on your profile: <role lanes or key skills>".
```

**Card Container Spec (both faces):**
```css
background: var(--color-bg-elevated);
border: 1px solid var(--color-divider);
border-radius: 16px;
padding: 16px 18px;
box-shadow: 0px 4px 8px rgba(0,0,0,0.15);
```

**Interactions:**
- Front face is the default.
- Clicking the "WHY YOU FIT" icon or label flips the card to the back face.
- Clicking "← Back to overview" flips it back to the front face.
- Animation: 200–300ms flip / crossfade (no wild 3D; subtle is fine).

**Actions:**
- ⭐ Add to Tracker is available from both faces.
- If a job is already in Tracker, replace the star button with a muted "In Tracker" state (non-clickable).

#### 13.4.4.1 Why-Fit Flip Interaction Rules

**Goal:** Keep the main screen focused on scanning signal (scores, tiers, titles) while letting the user pull a deeper explanation on demand without opening a new page or modal.

**Desktop:**
- Flip behavior: front ↔ back uses a subtle flip or crossfade animation (200–300ms).
- Only one face is visible at a time.
- Card height stays roughly stable between faces to avoid layout jumping.
- Clicking outside the card does NOT auto-close the why-fit view; user must explicitly flip back.

**Mobile / Tablet:**
- Implementation can be a vertical slide or expand/collapse instead of a literal flip, but the mental model stays the same:
  - Front = overview
  - Back = "why you're a fit"
- The "WHY YOU FIT" affordance must still be an icon + label, not just a tiny chevron.

**State & Behavior:**
- The flip state is per-card, per-session. When the user refreshes or fetches again, all cards reset to the front face.
- Keyboard users must be able to:
  - Tab to the "WHY YOU FIT" button
  - Press Enter/Space to flip
  - Tab to "← Back to overview" and flip back.

**Copy:**
- All text on the back face (title, bullets, meta) must follow the language filters in Section 2.3.
- No marketing tone, no "we" speak; talk directly to the user ("You've done…", "This lines up with…").

#### 13.4.5 Tracker Snapshot Panel

Contents:
- Funnel Counts:
  - Prospects
  - Applied
  - Interviews
  - Offers
- Upcoming Interviews
- S/A tier highlights
- Link: Open Full Tracker in Sheets

Visual Enhancements:
- Mini horizontal bar graphs
- Gradient fills (gold → green)
- Dot-matrix background at 8–12% opacity

### 13.5 Animation & Microinteractions

| Event | Behavior |
|-------|----------|
| Button Hover | +3% scale + glow |
| Add to Tracker | gold star flicker + toast |
| Fetch Jobs | radar sweep loader |
| Toasts | bottom-right slide + fade (3–3.5s) |
| Collapsible | 200–300ms smooth height transition |

### 13.6 System States

**Soft-Locked:**
- Banner at top: "Profile is locked: <reason>"
- CTAs disabled
- Tooltip: "Profile is currently locked"

**Empty State:**
- Inbox empty: "No roles yet — click 'Fetch New Roles' to start the hunt."
- Tracker empty: "Nothing in your Tracker yet. Add roles you like from your Inbox."

**Error State:**
- Toast: Fetch failed: <message>

**Partial Enrichment (WARN):**
- Meta note: 1 role skipped due to enrichment errors

### 13.7 Copywriting Rules

**Tone:**
- Direct
- Confident
- Tactical
- Zero fluff

**Formatting Rules:**
- Summary: 2–4 lines max
- Why-Fit:
  - 3–5 bullets
  - Each starts with a strong verb
  - No filler phrases

**Tracker Stages:**
- Prospect
- Applied
- Interview 1
- Interview 2
- Final Interview
- Offer 🤝🔥
- Rejected 💀
- Ghosted 👻

### 13.8 Accessibility Rules

- Minimum AA contrast
- Buttons ≥ 44px tall
- Text never < 12px
- Keyboard-accessible collapse sections
- Focus styles visible

All of the above must also respect the global language filters in Section 2.3. If there is ever a conflict between "sounding nice" and "being clear and tactical", clarity wins.

### 13.9 Responsive Behavior

**Desktop:**
- 60/40 layout
- Collapsible side panel optional

**Tablet:**
- Stack vertically
- Break CTA row into two rows

**Mobile:**
- Single column
- Chips stack
- Collapse meta details

### 13.10 Engineering & Implementation (Apps Script)

#### 13.10.1 Front-End Technology

Apps Script Web App using:
- HTMLService
- Static HTML/CSS/JS
- `google.script.run` for RPC calls
- Google Fonts for typography

No React required.

#### 13.10.2 Recommended File Structure

```
/ui
  index.html
  styles.css
  app.js
/server
  code.gs
  fetch.gs
  enrich.gs
  promote.gs
```

#### 13.10.3 CSS Tokenization

All theme variables from 13.2 are implemented as `:root` CSS variables.

#### 13.10.4 Server Calls Pattern

JS → Apps Script:
```javascript
google.script.run
  .withSuccessHandler(renderInbox)
  .withFailureHandler(showError)
  .fetchForProfile(profileId);
```

### 13.11 Asset Requirements (For Design + Build)

**Logo Assets:**
- Sygnalist-logo-horizontal.svg
- Sygnalist-logo-mark.svg
- Transparent PNG backups

**Icon Pack:**
- SVG set: link, chevron, star, radar, location, remote
- Use HeroIcons or Lucide as base

**Illustrations (Optional):**
- Radar sweep loader (CSS or GIF)
- Dot-matrix ambient pattern (SVG)

**Backgrounds:**
- Ambient HUD grid (SVG or PNG @ 12% opacity)

**Figma Styles:**
- Color styles (tokens)
- Text styles (tokens)
- Component variants (chips, cards, toasts, buttons)

### 13.12 QA / "HOLY SHIT" Acceptance Criteria

The UI passes if:
- ✔ Users immediately understand what to do
- ✔ The UI feels premium & handcrafted
- ✔ Radar metaphor is clear without being gimmicky
- ✔ Zero corporate HR sludge vibes
- ✔ No spreadsheet vibes on the dashboard
- ✔ The visual language matches the Sygnalist brand keywords
- ✔ Engineers can implement without ambiguity

Fails if:
- ❌ It looks generic
- ❌ It "feels like bootstrap"
- ❌ It looks like a table/spreadsheet
- ❌ It feels chaotic or noisy
- ❌ It feels like AI slop

---

## 14. ENGINEERING CONSTRAINTS

- Apps Script runtime: ~6 minutes per execution.
- Use `CONFIG.MAX_JOBS_PER_FETCH` to limit jobs per run.
- Consider chunking enrichment (multiple calls) if needed.

**OpenAI quota:**
- Each job enrichment = 1 API call.
- Descriptions truncated to `CONFIG.MAX_DESC_CHARS_FOR_AI` (~4000 chars).

**Sheets limits:**
- Plan archiving old Tracker data to an archive sheet if needed.

**Security:**
- API keys in Script Properties only.
- Only Admin has script edit rights.

**Permissions:**
- Engine workbook: Admin only.
- Portals: shared per client.

**Config discipline:**
- All constants via CONFIG.
- All feature toggles via FLAGS.
- No magic numbers scattered in the code.

---

## 15. BUILD ORDER (IMPLEMENTATION ROADMAP — MULTI-USER v1.2)

**Goal:** v1.2 is a real multi-user engine with per-client portals and a basic but on-brand web UI. Target ~20 profiles.

### 15.1 Phase 0 — Project Skeleton & Safety Rails

**Why:** Establish spine before any features.

- Create Apps Script project attached to Engine workbook.
- Define CONFIG, FLAGS, Sygnalist_VERSION in a config.js.
- Implement:
  - `getAPIKey_(name)`
  - `assertSheetExists_(name)`
- Implement logging utilities:
  - `logEvent_(event: LogEvent)` → 📓 Logs
  - `toast_(msg, type)` (for admin sheet only)
- Create Engine sheets:
  - Admin_Profiles, 📓 Logs, 📊 Admin_Analytics.

### 15.2 Phase 1 — Profiles, Portal Mapping & Soft Locks

- Build Admin_Profiles schema (including portalSpreadsheetId).
- Implement:
  - `loadProfiles_(): Profile[]`
  - `getProfileById_(profileId): Profile | null`
  - `getProfileByIdOrThrow_(profileId)`
- Create New Profile menu action must:
  - append profile row
  - set webAppUrl immediately (canonical .../exec?profileId=<id>)
  - default isAdmin = FALSE unless it's your profile (or set manually)
  - keep portalSpreadsheetId in place even if unused (Engine-Only mode)
- Soft-lock enforcement:
  - Any function that fetches/enriches/promotes must begin with `getProfileByIdOrThrow_`.
  - If inactive: throw, log, return error.

### 15.3 Phase 1.5 — Engine-Only Mode + Stability Rails

- Add ENGINE_ONLY_MODE routing (Engine is mandatory system of record).
- Add locks + idempotency + throttling + DTO separation + structured UI errors.
- Portals remain supported but optional; portal writes are mirror-only when Portal Mode is enabled and portalSpreadsheetId exists.
- This prevents building UI on unstable write paths again.

### 15.4 Phase 2 — Tracker as System of Record

- Define Engine Tracker table (optional) and Portal Tracker schema.
- Implement helpers:
  - `buildTrackerEntryFromJob_(job: EnrichedJob, profile: Profile): TrackerEntry`
  - `appendTrackerEntries_(entries: TrackerEntry[], profile: Profile)`
  - `trackerHasDuplicate_(entry: TrackerEntry): boolean`
- Implement admin-only `quickAddToTracker_()` for testing:
  - Minimal UI (dialog/sheet range).
  - Writes to Engine + Portal Tracker.
- Add basic conditional formatting in Portals.

### 15.5 Phase 3 — Fetch Pipeline (No AI Yet)

- Implement adapters:
  - `fetchRemotive_(term): Job[]`
  - `fetchRemoteOK_(term): Job[]`
  - `fetchFromSource_(source, term): Job[]` reading FLAGS.
- Implement request planning:
  - `buildFetchRequestForProfile_(profile)`
- Implement:
  - `dedupeJobs_`
  - `classifyJobsForProfile_`
  - `scoreJobsForProfile_`
- Implement:
  - `fetchJobsRawForProfile_(profileId)` (no enrichment yet).
- Write scaffolding functions:
  - `writeEngineInbox_()` (internal table)
  - `writePortalInbox_()` (Portal Inbox sheet with scores, tiers, but blank summary/whyFit).
- Test end-to-end fetch with fake UI or admin menu.

### 15.6 Phase 4 — Enrichment Layer (Summary + Why-Fit)

- Implement OpenAI helper:
  - `aiRequest_(prompt, model = CONFIG.OPENAI_MODEL)`
- Implement resume parse / skill profile builder:
  - Sidebar or admin web route.
  - `parseResumeToSkillProfile_()` and writers to Admin_Profiles.
- Implement enrichment:
  - `buildEnrichmentPrompt_(job, profile)`
  - `enrichJobsForProfile_(scoredJobs, profile)`
- Integrate into main fetch:
  - `fetchForProfileWithEnrichment_(profileId)`:
    - Call raw fetch + scoring.
    - Filter & cap.
    - Enrich.
    - Write to Engine/Portal Inbox.

### 15.7 Phase 5 — Promotion & Manual Add

- Implement:
  - `promoteJobToTracker_(profileId, jobKey)` (server function).
- Wire it to:
  - Move from Engine/Portal Inbox into Engine/Portal Tracker for that profile.
- Implement manual add:
  - `manualAddJob_(profileId, jobInput)`:
    - Construct Job, enrich, write directly to Tracker.
- Test with fake UI (simple HTML form) before full design pass.

### 15.8 Phase 6 — Analytics, Logging & Health

- Build initial 📊 Admin_Analytics formulas.
- Add debug views for Logs (last errors, last fetch per profile).
- Implement `runHealthCheck_()`.

### 15.9 Phase 7 — Web App UI (Sygnalist Dashboard)

- Create HTML/CSS/JS UI matching the Brand & Visual System (Section 3) and the UI/UX spec (Section 13).
- Implement:
  - Profile bootstrap (load profileId, basic info).
  - Render Inbox cards from server payload.
  - Render Tracker Snapshot panel.
- Wire:
  - 📡 Fetch New Roles → `fetchForProfileWithEnrichment_`
  - ⭐ Add to Tracker → `promoteJobToTracker_`
  - 📝 Add Job Manually → `manualAddJob_`
- Ensure gradients, colors, typography, and micro-interactions match the logo aesthetic and Section 13 spec.

### 15.10 Phase 8 — Client Portals & Onboarding

Portals are optional onboarding artifacts (not required). In Engine-Only mode, they may be omitted entirely.

For each test client:
- Create Portal workbook with Inbox, Tracker, How To Use Sygnalist.
- Add portalSpreadsheetId to Admin_Profiles.
- Validate:
  - Fetch from web app writes to their Portal Inbox.
  - Manual add writes to their Tracker.
- Document onboarding:
  - Copy Portal template
  - Configure profile
  - Share link
  - Provide web app URL

---

## 16. STABILITY GUARANTEES (10 USERS)

These are non-negotiable guards at the top of every entrypoint:

```
lock → validate profile → rate limit → do work → write idempotently → log batch
```

### 16.1 Concurrency

LockService locks per (profileId + operation) for: fetch, enrich, promote, manual add.

### 16.2 Idempotency / Dedup

All writes must be idempotent.
- Inbox dedupe by url.
- Tracker dedupe by profileId + company + title (and optionally url).
- Promote must be safe to click twice without duplicates.

### 16.3 Rate limiting / throttling

- Per-profile throttle for external calls (job APIs + OpenAI).
- Global throttle guard to avoid quota spikes if multiple users click fetch at once.

### 16.4 Structured UI errors

Standard error categories returned to UI:
- LOCKED_PROFILE
- FETCH_FAILED
- ENRICH_FAILED
- RATE_LIMITED
- INVALID_PROFILE
- DUPLICATE

### 16.5 DTO separation

Web app only receives presentation DTOs (no raw job payloads, no internals).

### 16.6 Version discipline

- Every response includes Sygnalist_VERSION.
- Analytics shows last deployed version (required).
