/**
 * Demo-mode fixtures.
 *
 * Canned data used to short-circuit external API calls (OpenAI, Gmail, job sources)
 * so demo users see realistic results without burning tokens or hitting third parties.
 *
 * Used by: /api/fetch, /api/admin/gmail-ingest, /api/admin/resume-parse,
 *          /api/tracker/[id]/goodfit
 */

export type DemoFetchJob = {
  source: string;
  title: string;
  company: string;
  location: string;
  url: string;
  salary?: string | null;
  description_snippet: string;
};

export const DEMO_FETCH_JOBS: DemoFetchJob[] = [
  {
    source: "remotive",
    title: "Senior Account Executive, Mid-Market",
    company: "Notion",
    location: "Remote (US/Canada)",
    url: "https://example.com/jobs/notion-ae-mm",
    salary: "$140k-$180k OTE",
    description_snippet:
      "Own a book of 80-120 mid-market accounts. Drive new logo and expansion. Partner with CS on renewals. 5+ years closing SaaS deals $25k-$150k.",
  },
  {
    source: "remoteok",
    title: "Enterprise Account Executive",
    company: "Linear",
    location: "Remote",
    url: "https://example.com/jobs/linear-ent-ae",
    salary: "$180k-$240k OTE",
    description_snippet:
      "Sell into engineering orgs at 500+ FTE companies. Multi-threaded deals 90-180 day cycles. Strong technical fluency required.",
  },
  {
    source: "adzuna_us",
    title: "Senior Product Manager, Platform",
    company: "Vercel",
    location: "Remote (US)",
    url: "https://example.com/jobs/vercel-spm-platform",
    salary: "$190k-$230k base",
    description_snippet:
      "Own platform primitives used by 5M+ developers. Partner with infra and DX teams. Ship narrowly scoped, high-leverage features.",
  },
  {
    source: "jooble",
    title: "Backend Engineer, Payments",
    company: "Mercury",
    location: "San Francisco / Remote",
    url: "https://example.com/jobs/mercury-be-payments",
    salary: "$200k-$260k base",
    description_snippet:
      "Build and operate the ledger and payments infra. TypeScript, Postgres, Temporal. On-call rotation. 5+ years building distributed systems.",
  },
  {
    source: "usajobs",
    title: "Account Director, Enterprise SaaS",
    company: "Figma",
    location: "Remote (US)",
    url: "https://example.com/jobs/figma-ad-ent",
    salary: "$220k-$280k OTE",
    description_snippet:
      "Top 50 named accounts. Partner with design leaders, IT, procurement. Manage RFPs and security reviews end to end.",
  },
  {
    source: "remotive",
    title: "Staff Software Engineer, Infrastructure",
    company: "Supabase",
    location: "Remote",
    url: "https://example.com/jobs/supabase-staff-infra",
    salary: "$210k-$270k base",
    description_snippet:
      "Lead the platform team. Postgres at scale, multi-region, edge. Mentor 4-6 engineers. Set technical direction for the next 18 months.",
  },
  {
    source: "remoteok",
    title: "Lifecycle Marketing Manager",
    company: "Replit",
    location: "Remote",
    url: "https://example.com/jobs/replit-lifecycle",
    salary: "$130k-$170k base",
    description_snippet:
      "Own activation, retention, and resurrection campaigns. Customer.io / Iterable experience required. Heavy SQL and experimentation.",
  },
  {
    source: "adzuna_ca",
    title: "Mid-Market Account Executive",
    company: "Loom",
    location: "Toronto / Remote",
    url: "https://example.com/jobs/loom-mm-ae",
    salary: "$130k-$170k OTE CAD",
    description_snippet:
      "Hunt and close deals $10k-$80k ACV with PLG handoff motion. 3+ years AE in SaaS. Strong written communication.",
  },
  {
    source: "remotive",
    title: "Engineering Manager, Growth",
    company: "Cal.com",
    location: "Remote",
    url: "https://example.com/jobs/calcom-em-growth",
    salary: "$180k-$220k base",
    description_snippet:
      "Lead a team of 5 working on activation, onboarding, and pricing surfaces. 3+ years management. Comfortable shipping yourself.",
  },
  {
    source: "remoteok",
    title: "Customer Success Manager, Enterprise",
    company: "PostHog",
    location: "Remote",
    url: "https://example.com/jobs/posthog-csm-ent",
    salary: "$140k-$180k OTE",
    description_snippet:
      "Own retention and expansion across the top 30 accounts. Technical product. SQL and product analytics fluency required.",
  },
];

export const DEMO_GOODFIT_NARRATIVES: string[] = [
  `You've owned mid-market quota for three cycles and consistently closed deals in the $25k-$80k band. The posting calls out a 80-120 account book and the same deal size range. The shape lines up.

The job mentions multi-threaded technical deals with 90-180 day cycles. Your profile shows mostly faster transactional work. If their cycles really run that long, the rhythm change matters.

You'd frame your fit around discovery and follow-through. Point to the renewals you ran end to end. Then explain how you'd lean on the SE bench earlier in the cycle to get used to the longer arc.`,

  `Your last role had you shipping platform-facing features for 50k+ active developers. The posting wants someone to own primitives used at similar scale. The user shape matches.

The role expects heavy partnership with infra and DX. Your profile is strongest on the design and PM side, lighter on infra fluency. Ramping with the infra leads early would be the right move.

You'd frame your strength in scoping high-leverage work narrowly. Point to two or three shipped primitives where you cut surface area. Then explain how you'd spend the first month embedded with infra before pushing your own bets.`,

  `You've built and run payments and ledger systems at one prior company. The posting is explicit about TypeScript, Postgres, and Temporal — three things in your stack. Direct match.

The role includes an on-call rotation. Your profile doesn't show recent production on-call. Worth surfacing how you handled incidents in your last role and what your appetite for pager duty is now.

You'd frame your fit around the ledger work specifically. Point to the reconciliation system you owned and the bugs you caught before they hit settlement. Then talk plainly about what kind of on-call cadence you'd sign up for.`,

  `You've held quota at two enterprise SaaS companies and worked Top 50 named accounts in your last role. The posting maps cleanly — same account size, similar buying motion, security and procurement front and center. Direct fit.

The role calls out partnering with design leadership specifically. Your profile shows IT and procurement as primary buyers, less time spent with design ICs and managers. The relationship-building shape is different.

You'd frame your fit around running RFPs and managing security reviews. Point to the two enterprise wins where you owned the legal and infosec back and forth. Then explain how you'd build design relationships from the field early.`,

  `Your background has heavy lifecycle marketing work — activation, retention, resurrection — at PLG companies. The posting is exactly that. Direct shape match.

The role specifies Customer.io or Iterable experience. Your profile shows Braze and Marketo. Different tooling, same primitives. Worth flagging the ramp explicitly so they're not surprised in week one.

You'd frame your fit around experimentation discipline and SQL fluency. Point to the activation experiments you ran that moved D7 retention. Then talk about how you'd port your playbooks into their stack in the first month.`,

  `You've managed engineering teams of 4-6 in growth-adjacent surfaces at two companies. The posting wants the same. Shape lines up.

The role expects you to keep shipping code yourself. Your profile shows your IC time has dropped over the last 18 months. Worth being honest about how much you'd want to write versus delegate.

You'd frame your fit around team setup and quarterly bet selection. Point to the activation rebuild you led that took D1 from 38% to 51%. Then talk about what kind of IC cadence you'd realistically maintain.`,

  `Your CSM work has focused on technical products with developer end-users. The posting is the same shape. Direct match.

The role wants SQL and product analytics fluency. Your profile shows competence but not depth. Worth surfacing where you'd want to level up — Mixpanel, Amplitude, raw warehouse queries — in the first 60 days.

You'd frame your fit around retention motions and expansion plays you've run. Point to the two accounts you grew from $80k to $300k ARR. Then talk plainly about the analytics gaps and how you'd close them.`,

  `You've held mid-market AE roles in B2B SaaS for four years across two companies. The posting matches in size, motion, and segment. Direct fit on the resume.

The role specifies a PLG handoff motion. Your profile shows mostly outbound-first work. The signal flow into the AE seat is different. Worth getting clear on what their qualified PLG handoff actually looks like.

You'd frame your fit around discovery quality and short-cycle deal management. Point to the deals you closed in under 30 days. Then ask their team about how their PQL definition has evolved over the last two quarters.`,
];

export const DEMO_PARSED_RESUME = {
  candidate_name: "Demo Candidate",
  current_title: "Senior Account Executive",
  years_experience: 7,
  top_skills: [
    "Mid-market sales",
    "Multi-threaded deals",
    "Discovery and qualification",
    "CRM hygiene (Salesforce, HubSpot)",
    "RFP and security review management",
    "Forecasting and pipeline management",
  ],
  role_tracks: [
    "Mid-market Account Executive",
    "Enterprise Account Executive",
    "Account Director",
  ],
  locations: ["Remote (US)", "New York, NY", "Toronto, ON"],
  salary_floor: 140000,
  signature_stories: [
    "Closed $1.2M in net new ARR across 18 deals in FY24, 122% of quota.",
    "Owned a top-10 enterprise renewal worth $480k through a 4-month security review.",
    "Built the discovery playbook adopted by the wider AE team after 30% lift in stage-2 conversion.",
  ],
  skill_profile_text:
    "Seven years closing SaaS deals in the $25k-$200k ACV range. Strong written communication, structured discovery, comfortable working multi-threaded with technical and procurement buyers. Background includes both inbound PLG handoff motions and pure outbound territory work.",
  banned_keywords: ["junior", "entry-level", "internship", "BDR", "SDR"],
  lane_controls: [],
};

export const DEMO_GMAIL_JOBS = [
  {
    source: "gmail.linkedin",
    title: "Director of Sales, North America",
    company: "Retool",
    location: "Remote (US)",
    url: "https://example.com/jobs/retool-dir-sales",
    description_snippet:
      "Lead a team of 6 AEs covering NA mid-market and enterprise. Player-coach for first 6 months. Heavy partnership with marketing on field events.",
  },
  {
    source: "gmail.greenhouse",
    title: "Principal Engineer, Storage",
    company: "Render",
    location: "Remote",
    url: "https://example.com/jobs/render-principal-storage",
    description_snippet:
      "Own the storage layer powering 100k+ services. Postgres, S3, CDN. Mentor staff engineers. 10+ years systems work.",
  },
  {
    source: "gmail.lever",
    title: "Head of Lifecycle Marketing",
    company: "Pitch",
    location: "Berlin / Remote (EU)",
    url: "https://example.com/jobs/pitch-head-lifecycle",
    description_snippet:
      "Build and own the lifecycle marketing function from zero. Onboarding, activation, expansion. Reports to CMO.",
  },
  {
    source: "gmail.workday",
    title: "Engineering Manager, Search",
    company: "Algolia",
    location: "Paris / Remote (EU)",
    url: "https://example.com/jobs/algolia-em-search",
    description_snippet:
      "Lead a team of 5 working on relevance and query understanding. ML background helpful. 3+ years management.",
  },
  {
    source: "gmail.ashby",
    title: "Senior Product Manager, Billing",
    company: "Stripe",
    location: "Remote (US/Canada)",
    url: "https://example.com/jobs/stripe-spm-billing",
    description_snippet:
      "Own billing primitives used by millions of businesses. Partner with engineering and finance. Ship narrowly scoped, durable features.",
  },
];

/** Random subset of fixture jobs, avoiding the exact same set twice in a row */
export function pickDemoJobs(count = 8): DemoFetchJob[] {
  const shuffled = [...DEMO_FETCH_JOBS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, DEMO_FETCH_JOBS.length));
}

export function pickDemoGoodFit(): string {
  return DEMO_GOODFIT_NARRATIVES[Math.floor(Math.random() * DEMO_GOODFIT_NARRATIVES.length)];
}

/** Fake latency that feels like a real call without actually waiting on one */
export function demoDelay(minMs = 600, maxMs = 1800): Promise<void> {
  const ms = Math.floor(minMs + Math.random() * (maxMs - minMs));
  return new Promise((r) => setTimeout(r, ms));
}
