# Sygnalist Facelift — Session 1 Handoff

**Paste everything below this line into a fresh Claude Code session to start the work.**

---

# Step 0 — Get on the right branch (do this first, every time)

The handoff, mockups, and all in-progress work live on the feature branch — NOT on `main`. Run this before reading anything else:

```bash
git fetch origin
git checkout claude/review-sygnalist-ui-GXTJu
git pull origin claude/review-sygnalist-ui-GXTJu
git status
```

You should see `On branch claude/review-sygnalist-ui-GXTJu` and `nothing to commit, working tree clean`. If you see anything else, stop and ask the user before proceeding.

All commits during this session push to `claude/review-sygnalist-ui-GXTJu`. Never push to `main`.

---

# Context

You are taking over a UI/UX facelift of the Sygnalist app. This session runs **Phase 1 + Phase 2 of 4 total phases**. At the end you will write `FACELIFT_HANDOFF_SESSION_2.md` for the next session to pick up Phase 3 + Phase 4.

**User:** Joshua. He's on mobile. Iterate via Vercel preview deploys or raw.githack links so he can view on his phone.

**Repo:** `bowgull/sygnalist-brain`
**Branch:** `claude/review-sygnalist-ui-GXTJu` (already pushed — do all work here)
**App location:** `/app/` (Next.js 16 + React 19 + Tailwind v4 + Supabase)

# What this is

**Facelift. Not rebrand.** Amplify the existing brand, do not invent new systems. The brand is defined in `BLUEPRINT.md` §3. The app implements the tokens but never *amplifies* them — that's why Joshua says it feels "cold and too SaaS." Your job is to turn every existing brand token up to 10.

# Absolute rules (breaking any of these = failure)

- **Only existing tokens** from `app/src/app/globals.css` and `BLUEPRINT.md` §3:
  - Radar green: `#A9F2C4` / `#6AD7A3` / `#2F8A63`
  - Signal gold: `#FAD76A`
  - Charcoal surfaces: `#0C1016` / `#151C24` / `#171F28` / `#222D3D` / `#11181F`
  - Tier: S=`#FAD76A`, A=`#6AD7A3`, B=`#38BDF8`, C=`#9CA3AF`, F=`#4B5563`, X=`#DC2626`
  - Status: prospect=`#1DD3B0`, applied=`#3B82F6`, interview=`#8B5CF6`, final=`#F59E0B`, offer=`#22C55E`
- **Only Inter.** No new fonts.
- **Only the existing radar logo SVG** (live in `app/src/components/layout/header.tsx`).
- **No new colors, no new palettes, no new themes.**
- **UI/UX only.** Don't touch logic, routes, API endpoints, Supabase calls, scoring, or functionality. If a change would alter behavior, stop and ask.
- **No emojis** anywhere Joshua sees (the BLUEPRINT allows them but Joshua doesn't want them).
- **Motion earns its place.** No ambient loops. No logo pulsing 24/7. No idle radar sweep. No gold button shimmer. No seam-glow loop. Motion communicates a state change (scan running, new item landing, promote success) or it is cut. Everything gets a `prefers-reduced-motion` fallback.
- **Desktop AND mobile both matter.** Responsive required at every breakpoint.

# Hard-earned lessons — don't repeat these

- A previous session freestyled and invented three new brand systems (plum/amber, rainbow-gradient, magazine editorial). User shut it down. **Facelift means amplify, not replace.**
- User is on mobile — mockups/previews must render there.
- User says "don't build without approval" repeatedly. Respect it. Check in before big moves.
- Read `BLUEPRINT.md` §2.3 voice rules before writing any copy.

# What's already in the repo (read these first)

- `BLUEPRINT.md` — the brand bible. Non-negotiable.
- `app/src/app/globals.css` — current token source.
- `app/src/components/layout/header.tsx` — real radar logo SVG.
- `app/src/components/ui/loading-messages.tsx` — 30 pre-written witty loading lines. **They exist but are barely used — surface them on real screens.**
- `app/src/app/(dashboard)/layout.tsx` — dashboard shell.
- `app/src/app/(dashboard)/inbox/page.tsx` — inbox main.
- `app/src/components/inbox/job-card.tsx` — the card to facelift.
- `app/src/app/(auth)/login/page.tsx` — currently a plain form with zero brand presence. Biggest opportunity.
- `/mockups/` — three committed HTML mockups (Inbox, Tracker, Login) that Joshua approved as direction. **Reference only.** They have too much ambient motion — you must cut that. They were built mobile-first; your real implementation must work desktop AND mobile.

# Phase 1 — Foundation (first half of this session)

## Step 1.1 — Write `FACELIFT_SPEC.md` at repo root

Cover:
- Scope (every route + component touched across all 4 phases)
- Typography scale (Inter 900 / 800 / 700 / 600 / 500 / 400 — which weight for what)
- Token additions (list exact CSS variables being added to `globals.css`)
- Shadow hierarchy (subtle, card, elevated, hero/glow — map to existing + additions)
- Motion philosophy (state-change only; explicit banned list; duration/ease tokens)
- Component rules (one section each: Button, Pill, Badge, Card, Toast, LoadingState, EmptyState, Header, Nav, Tabs, Sidebar, Modal)
- Desktop + mobile rules per surface
- Voice/copy rules (reuse BLUEPRINT.md §2.3)
- Phased rollout (Phase 1+2 this session, Phase 3+4 next)

## Step 1.2 — CHECK IN WITH USER

Post a summary of the spec (bulleted, tight). Get explicit approval before writing code. Iterate on the spec if he has feedback.

## Step 1.3 — Update `app/src/app/globals.css`

- Add new tokens. Don't remove existing.
- Likely additions: gold-hero-bg, gold-border, radar-bg-subtle, radar-border-strong, shadow-subtle / shadow-hero / glow-gold-hero / glow-green-hero, motion ease-in-out / ease-emphasized, durations (fast=150, base=250, slow=400).
- Keep surgical. The existing token set is good — you're adding, not rewriting.

## Step 1.4 — Create primitives in `app/src/components/ui/`

Don't delete existing components — new ones coexist. Phase 2 will start refactoring to use them.

- `button.tsx` — variants: `gold` (hero wins), `green` (standard CTA), `ghost`, `danger-ghost`. Sizes: sm / md / lg.
- `pill.tsx` — variants: `tier` (with tier prop), `lane`, `stage` (with status prop), `salary`, `meta`, `board`.
- `card.tsx` — variants: `default`, `featured` (S-tier with gold glow), `muted`, `stage-accent` (with stage prop — for tracker).
- `badge.tsx` — tier badge. S gets glow, others don't.
- `loading-state.tsx` — uses `loading-messages.tsx`. Radar sweep only while active. Reduced-motion fallback.
- `empty-state.tsx` — hero radar + branded copy template.
- `win-toast.tsx` — gold celebration for Added-to-Tracker / Offer moments. One-shot pulse, not infinite loop.

## Step 1.5 — Build check

```bash
cd app && npm run build
```

Must pass before moving to Phase 2.

## Step 1.6 — Commit + push

Single commit or logical chunks. Clear messages. Push to `claude/review-sygnalist-ui-GXTJu`.

# Phase 2 — Auth + Inbox (second half of this session)

## Step 2.1 — Facelift auth screens

Biggest visual delta — login currently has zero brand presence.

- `app/src/app/(auth)/login/page.tsx`
- `app/src/app/(auth)/forgot-password/page.tsx`
- `app/src/app/(auth)/reset-password/page.tsx`

Treatment: hero radar logo (scaled ~128px), "SYGNALIST" wordmark at full presence, "FIND THE SIGNAL" tagline loud, gold primary CTA (use `<Button variant="gold">`), magic-link option with radar-green ghost, brand-voice microcopy ("Welcome back, hunter. Your signal is waiting.").

Reference `/mockups/login.html` for direction but **kill the ambient pulsing rings**. Motion only on form submit state.

## Step 2.2 — CHECK IN WITH USER

Deploy to Vercel preview. Share URL. Get approval on mobile view before moving on.

## Step 2.3 — Facelift Inbox

- `app/src/app/(dashboard)/inbox/page.tsx`
- `app/src/components/inbox/job-card.tsx`
- `app/src/components/inbox/skeleton-card.tsx`

Treatment:
- Header radar logo scaled up, tagline surfaced
- Scan button = hero (radar gradient fill, not thin ring)
- S-tier cards get gold "Priority Signal" corner flag + gold glow (static, not pulsing) + gold CTA
- A/B/C tiers get their existing tier-colored top border
- Empty state: hero radar + "The wire is quiet" voice
- Loading state: surfaces `loading-messages.tsx` copy + radar sweep (only while scanning)
- Win toast uses new `<WinToast>` primitive

Reference `/mockups/inbox.html` for direction but **kill all ambient motion** — no logo pulse, no idle radar sweep, no gold pulse on featured card, no seam glow loop.

## Step 2.4 — Build check + commit + push

## Step 2.5 — CHECK IN WITH USER

Get mobile sign-off on the Inbox facelift.

# Session end — write handoff for Session 2

Before context runs out, create `FACELIFT_HANDOFF_SESSION_2.md` at repo root. Mirror this document's structure. Cover:

- What Phase 1 + 2 accomplished (file-by-file list + commit SHAs)
- Any gotchas / decisions encountered
- Phase 3 scope: Tracker (page + tracker-card, stages, spotlight, notes), Tickets (Kanban + ticket-card + detail + create modal), Messages, Profile (user-facing)
- Phase 4 scope: all admin surfaces (admin nav, sub-tabs, clients list, client detail, lanes tab, profile tab, logs, analytics) + motion QA pass + reduced-motion audit + cross-browser check + production readiness
- Repeat all the absolute rules + lessons above verbatim (the next session won't have this context otherwise)

# Approval checkpoints (non-negotiable)

Don't skip any of these. Joshua has been burned before:

1. After spec doc — user approves before you write any code
2. After primitives — user previews via Vercel/raw.githack
3. After auth facelift — user reviews on mobile
4. After inbox facelift — user reviews on mobile

# If you get stuck

- If a change would alter behavior/logic → stop and ask
- If you're tempted to add a new color → stop, you can't
- If you're tempted to add a new font → stop, you can't
- If you're unsure whether something is a facelift or a rebrand → it's a rebrand, stop
- If you can't decide between two treatments → ask Joshua, don't guess
