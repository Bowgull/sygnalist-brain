/**
 * demo-seed.ts — Sygnalist demo portal seed
 *
 * Populates a Supabase instance with fake clients, jobs, tracker entries,
 * tickets, logs, and fetch history for a read-only portfolio demo.
 *
 * NO external API calls. All enrichment is hardcoded.
 *
 * Usage:
 *   npx tsx src/scripts/demo-seed.ts
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL  - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key (bypasses RLS)
 *
 * Idempotent: deletes all demo-prefixed data before re-inserting.
 * Demo profiles are identified by profile_id starting with "demo-".
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabase: SupabaseClient = null as unknown as SupabaseClient;

function initSupabase(): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ─── Fixed UUIDs for deterministic re-runs ────────────────────────────────

const PROFILES = {
  admin: "00000000-de00-0000-0000-000000000001",
  luther: "00000000-de00-0000-0000-000000000002",
  priya: "00000000-de00-0000-0000-000000000003",
  marcus: "00000000-de00-0000-0000-000000000004",
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────

function uuid(seed: number): string {
  const hex = seed.toString(16).padStart(16, "0");
  return `00000000-de00-0001-${hex.slice(0, 4)}-${hex.slice(4)}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function hoursAgo(n: number): string {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d.toISOString();
}

// ─── Profiles ─────────────────────────────────────────────────────────────

const profiles = [
  {
    id: PROFILES.admin,
    auth_user_id: null,
    profile_id: "demo-admin",
    display_name: "Demo Admin",
    email: "demo@bridgefour.xyz",
    role: "admin",
    status: "active",
    current_city: "Toronto",
    accept_remote: true,
    accept_hybrid: true,
    accept_onsite: false,
    role_tracks: {},
    lane_controls: {},
  },
  {
    id: PROFILES.luther,
    auth_user_id: null,
    profile_id: "demo-luther",
    display_name: "Luther Bocas",
    email: "luther@sygnalist-demo.co",
    role: "client",
    status: "active",
    current_city: "Toronto",
    accept_remote: true,
    accept_hybrid: true,
    accept_onsite: false,
    salary_min: 130000,
    preferred_countries: ["CA", "US"],
    preferred_cities: ["Toronto", "New York", "San Francisco"],
    skill_keywords_plus: ["Salesforce", "HubSpot", "Gong", "outbound", "enterprise sales", "SaaS", "fintech", "account management"],
    skill_keywords_minus: ["cold calling", "commission only"],
    top_skills: ["Enterprise Sales", "Account Management", "Strategic Partnerships", "Financial Services"],
    banned_keywords: ["commission-only", "insurance agent", "retail"],
    disqualifying_seniority: ["junior", "entry-level", "intern", "BDR", "SDR"],
    allow_phone_heavy: false,
    allow_sales_heavy: true,
    role_tracks: { "Enterprise AE": 1.0, "Strategic Partnerships": 0.9, "Head of Sales": 0.85 },
    lane_controls: {},
  },
  {
    id: PROFILES.priya,
    auth_user_id: null,
    profile_id: "demo-priya",
    display_name: "Priya Nair",
    email: "priya@sygnalist-demo.co",
    role: "client",
    status: "active",
    current_city: "Austin",
    accept_remote: true,
    accept_hybrid: false,
    accept_onsite: false,
    salary_min: 155000,
    preferred_countries: ["US"],
    preferred_cities: ["Austin", "San Francisco", "New York"],
    skill_keywords_plus: ["Figma", "SQL", "Mixpanel", "A/B testing", "OKRs", "roadmapping", "healthtech", "platform", "API"],
    skill_keywords_minus: ["associate", "coordinator"],
    top_skills: ["Product Strategy", "Platform PM", "Growth", "Health Tech", "API Products"],
    banned_keywords: ["defense", "tobacco", "gambling"],
    disqualifying_seniority: ["junior", "associate", "entry-level"],
    allow_phone_heavy: false,
    allow_sales_heavy: false,
    role_tracks: { "Senior PM": 1.0, "Director of Product": 0.95, "Head of Product": 0.9, "Group PM": 0.85 },
    lane_controls: {},
  },
  {
    id: PROFILES.marcus,
    auth_user_id: null,
    profile_id: "demo-marcus",
    display_name: "Marcus Webb",
    email: "marcus@sygnalist-demo.co",
    role: "client",
    status: "active",
    current_city: "New York",
    accept_remote: true,
    accept_hybrid: true,
    accept_onsite: false,
    salary_min: 185000,
    preferred_countries: ["US"],
    preferred_cities: ["New York", "San Francisco", "Seattle"],
    skill_keywords_plus: ["Go", "TypeScript", "Kubernetes", "PostgreSQL", "distributed systems", "AWS", "system design", "platform"],
    skill_keywords_minus: ["C++", "COBOL", "mainframe"],
    top_skills: ["Backend Engineering", "Distributed Systems", "Platform Infrastructure", "Engineering Leadership"],
    banned_keywords: ["legacy", "COBOL", "night shift", "on-call rotation"],
    disqualifying_seniority: ["junior", "entry-level", "intern"],
    allow_phone_heavy: false,
    allow_sales_heavy: false,
    allow_shift_work: false,
    role_tracks: { "Staff Engineer": 1.0, "Principal Engineer": 0.95, "Engineering Manager": 0.85, "VP Engineering": 0.8 },
    lane_controls: {},
  },
];

// ─── Inbox Jobs ───────────────────────────────────────────────────────────

type InboxJob = {
  id: string;
  profile_id: string;
  score: number;
  tier: string;
  company: string;
  title: string;
  url: string;
  source: string;
  location: string | null;
  role_type: string | null;
  lane_label: string | null;
  category: string | null;
  salary: string | null;
  salary_source: string | null;
  salary_below_min: boolean;
  match_hits: number;
  job_summary: string;
  why_fit: string;
  added_at: string;
};

const lutherJobs: Omit<InboxJob, "id" | "profile_id">[] = [
  // S tier
  {
    score: 94, tier: "S",
    company: "Rippling", title: "Enterprise Account Executive — Financial Services",
    url: "https://jobs.rippling.com/enterprise-ae-fs-demo",
    source: "Remotive", location: "Remote · US/CA", role_type: "full-time",
    lane_label: "Enterprise Sales", category: "Account Executive",
    salary: "$175,000–$210,000 + OTE", salary_source: "job_posting", salary_below_min: false,
    match_hits: 7,
    job_summary: "Rippling is expanding its Financial Services vertical. This AE owns the full sales cycle from prospecting to close for mid-market and enterprise FS clients, with strong support from BDR and SE teams. OTE uncapped above base.",
    why_fit: "Luther's background in fintech account management maps directly to this vertical. His Salesforce and Gong usage aligns with Rippling's stack. The hybrid remote-first structure and $175k+ base clears his floor by a meaningful margin. Financial services domain expertise is the key differentiator here.",
    added_at: daysAgo(1),
  },
  {
    score: 91, tier: "S",
    company: "Plaid", title: "Strategic Partnerships Manager — Financial Institutions",
    url: "https://plaid.com/careers/strategic-partnerships-fi-demo",
    source: "Remotive", location: "Remote · US/CA", role_type: "full-time",
    lane_label: "Strategic Partnerships", category: "Partnerships",
    salary: "$160,000–$185,000", salary_source: "job_posting", salary_below_min: false,
    match_hits: 6,
    job_summary: "Plaid is hiring a Partnerships Manager to own relationships with Canadian and US banks, credit unions, and digital-first lenders. Role involves co-selling motions, integration scoping, and executive-level relationship management.",
    why_fit: "The Financial Institutions vertical at Plaid is exactly where Luther's fintech background converts. His enterprise relationship management experience and Canadian market knowledge are direct matches. Plaid's compensation band starts well above Luther's minimum.",
    added_at: daysAgo(1),
  },
  // A tier
  {
    score: 82, tier: "A",
    company: "HubSpot", title: "Senior Account Executive — Mid-Market",
    url: "https://hubspot.com/careers/sr-ae-mid-market-demo",
    source: "RemoteOK", location: "Remote · Americas", role_type: "full-time",
    lane_label: "Enterprise Sales", category: "Account Executive",
    salary: "$140,000–$170,000 + commission", salary_source: "job_posting", salary_below_min: false,
    match_hits: 5,
    job_summary: "HubSpot is scaling its mid-market AE team. This role owns a book of 50–75 accounts, managing the full sales cycle with strong inbound support. HubSpot stack training provided. OTE typically 2x base.",
    why_fit: "Luther knows HubSpot inside out. Selling a product he already uses daily is a credibility advantage. The mid-market segment aligns with his existing deal-size experience. Base is slightly below his ceiling but OTE structure makes total comp competitive.",
    added_at: daysAgo(2),
  },
  {
    score: 79, tier: "A",
    company: "Stripe", title: "Director of Financial Services — Canada",
    url: "https://stripe.com/jobs/director-fs-canada-demo",
    source: "Adzuna CA", location: "Toronto, ON (Hybrid)", role_type: "full-time",
    lane_label: "Enterprise Sales", category: "Director",
    salary: "$175,000–$205,000", salary_source: "job_posting", salary_below_min: false,
    match_hits: 6,
    job_summary: "Stripe is building out its Canadian FS vertical with a Director-level hire to own bank partnerships, fintech co-sells, and enterprise expansion. Travel 20–30% across major Canadian markets.",
    why_fit: "Toronto-based, fintech-native, and targeting Director-level — this one fits Luther's trajectory cleanly. The Canadian market ownership angle plays to his local network. Hybrid structure is workable given the location.",
    added_at: daysAgo(2),
  },
  {
    score: 77, tier: "A",
    company: "Brex", title: "Enterprise Account Executive",
    url: "https://brex.com/careers/enterprise-ae-demo",
    source: "Remotive", location: "Remote · US/CA", role_type: "full-time",
    lane_label: "Enterprise Sales", category: "Account Executive",
    salary: "$155,000–$180,000 + OTE", salary_source: "job_posting", salary_below_min: false,
    match_hits: 5,
    job_summary: "Brex is building its enterprise motion with AEs who own the full cycle for 500+ employee companies. Focus on financial operations and spend management. Strong BDR support, 90-day quota ramp.",
    why_fit: "Brex's enterprise motion in financial operations aligns with Luther's FS background. The spend management category is adjacent enough to his fintech experience to close fast. Remote-first with strong support structure.",
    added_at: daysAgo(3),
  },
  {
    score: 75, tier: "A",
    company: "Wealthsimple", title: "Head of Sales — Canada",
    url: "https://jobs.lever.co/wealthsimple/head-of-sales-demo",
    source: "Adzuna CA", location: "Toronto, ON", role_type: "full-time",
    lane_label: "Enterprise Sales", category: "Head of Sales",
    salary: "$150,000–$175,000", salary_source: "job_posting", salary_below_min: false,
    match_hits: 5,
    job_summary: "Wealthsimple is hiring a Head of Sales to own direct-to-consumer and institutional channels across Canada. This is a player-coach role with a team of 8 reporting in.",
    why_fit: "A player-coach role at Canada's leading consumer fintech. Luther's mix of enterprise relationship management and Canadian market depth is a strong match. The step up to Head-level ownership is the right next move.",
    added_at: daysAgo(3),
  },
  // B tier
  {
    score: 68, tier: "B",
    company: "Salesforce", title: "Senior Account Executive — Financial Services Cloud",
    url: "https://salesforce.com/careers/senior-ae-fsc-demo",
    source: "Jooble", location: "Toronto, ON (Hybrid)", role_type: "full-time",
    lane_label: "Enterprise Sales", category: "Account Executive",
    salary: "$130,000–$155,000 + OTE", salary_source: "job_posting", salary_below_min: false,
    match_hits: 4,
    job_summary: "Salesforce FS Cloud team is hiring Senior AEs to own tier-2 Canadian bank and insurance accounts. Role involves close collaboration with Customer Success and Solution Engineering.",
    why_fit: "Solid fit on skills and domain. The FSC product line is relevant. Main hesitation: Salesforce's internal promotion pace and the hybrid requirement add friction. Comp band is competitive but the OTE ceiling is lower than pure-play SaaS alternatives.",
    added_at: daysAgo(4),
  },
  {
    score: 65, tier: "B",
    company: "Zendesk", title: "Senior Customer Success Manager — Enterprise",
    url: "https://zendesk.com/careers/sr-csm-enterprise-demo",
    source: "RemoteOK", location: "Remote · Americas", role_type: "full-time",
    lane_label: "Account Management", category: "CSM",
    salary: "$110,000–$130,000", salary_source: "job_posting", salary_below_min: true,
    match_hits: 3,
    job_summary: "Zendesk is building out its Enterprise CSM team for North American accounts. Role owns renewal, expansion, and executive QBRs for a portfolio of 25–40 accounts.",
    why_fit: "CSM is adjacent to Luther's AM background. However, the salary band comes in below his minimum — flagged. Role is a lateral move, not an advancement. Worth a look if other pipeline thins.",
    added_at: daysAgo(4),
  },
  {
    score: 63, tier: "B",
    company: "Rogers Communications", title: "Business Development Manager — Enterprise",
    url: "https://jobs.rogers.com/bd-manager-enterprise-demo",
    source: "Adzuna CA", location: "Toronto, ON", role_type: "full-time",
    lane_label: "Enterprise Sales", category: "Business Development",
    salary: "$120,000–$140,000 + bonus", salary_source: "job_posting", salary_below_min: false,
    match_hits: 3,
    job_summary: "Rogers is building out an enterprise BD team focused on connectivity, cloud, and managed security solutions for mid-market and enterprise clients in Southern Ontario.",
    why_fit: "Toronto-based, enterprise motion, and the managed services angle is adjacent to Luther's FS deals. Rogers is a known brand with strong benefits. Main weakness: telecom sales culture is a different gear from fintech SaaS.",
    added_at: daysAgo(5),
  },
  {
    score: 61, tier: "B",
    company: "Gallagher", title: "Account Manager — Financial Institutions Group",
    url: "https://gallagher.com/careers/am-fig-demo",
    source: "Jooble", location: "Toronto, ON (Hybrid)", role_type: "full-time",
    lane_label: "Account Management", category: "Account Manager",
    salary: "$115,000–$135,000", salary_source: "job_posting", salary_below_min: false,
    match_hits: 3,
    job_summary: "Gallagher FIG is hiring an AM to manage and grow a book of financial institution clients across risk and specialty insurance lines. Quarterly travel to client sites across Ontario.",
    why_fit: "Insurance-adjacent fintech. The FIG group is a niche match. Main concern: insurance AM culture differs from SaaS sales. Compensation clears the floor. Worth exploring if the insurance exposure is interesting.",
    added_at: daysAgo(5),
  },
  // C tier
  {
    score: 48, tier: "C",
    company: "Shopify", title: "Inside Sales Representative",
    url: "https://shopify.com/careers/inside-sales-rep-demo",
    source: "Remotive", location: "Remote · Canada", role_type: "full-time",
    lane_label: "Enterprise Sales", category: "Sales",
    salary: "$80,000–$95,000", salary_source: "job_posting", salary_below_min: true,
    match_hits: 2,
    job_summary: "Shopify Merchant Solutions is hiring ISRs to manage inbound and outbound for SMB and mid-market accounts. High-velocity motion with 60+ touches per week.",
    why_fit: "Salary is significantly below Luther's floor. The high-velocity SMB motion is a step back from his enterprise work. Not recommended unless early-stage comp is acceptable for the Shopify brand and equity story.",
    added_at: daysAgo(6),
  },
  {
    score: 44, tier: "C",
    company: "Bell Canada", title: "Regional Sales Manager — Central Canada",
    url: "https://jobs.bell.ca/regional-sales-mgr-demo",
    source: "Adzuna CA", location: "Toronto, ON", role_type: "full-time",
    lane_label: "Enterprise Sales", category: "Sales Manager",
    salary: "$100,000–$115,000 + bonus", salary_source: "job_posting", salary_below_min: true,
    match_hits: 2,
    job_summary: "Bell is hiring a Regional Sales Manager to lead a team of 6 account managers covering central Canada enterprise accounts. Heavy internal process and quota-management focus.",
    why_fit: "Telecom, below minimum comp, heavy legacy process environment. The people-management component is interesting but the comp band and industry don't stack up against Luther's current alternatives.",
    added_at: daysAgo(7),
  },
  // F tier — noise
  {
    score: 18, tier: "F",
    company: "RBC", title: "Branch Manager — Personal Banking",
    url: "https://jobs.rbc.com/branch-manager-demo",
    source: "Jooble", location: "Toronto, ON", role_type: "full-time",
    lane_label: null, category: null,
    salary: "$70,000–$85,000", salary_source: "job_posting", salary_below_min: true,
    match_hits: 0,
    job_summary: "RBC is hiring Branch Managers to lead personal banking operations, staff scheduling, and customer service in retail branches.",
    why_fit: "Wrong category entirely. Retail banking management, not enterprise sales. Salary below minimum. Scored as noise.",
    added_at: daysAgo(8),
  },
  {
    score: 12, tier: "F",
    company: "Sun Life Financial", title: "Financial Advisor — Group Benefits",
    url: "https://jobs.sunlife.com/financial-advisor-demo",
    source: "Jooble", location: "Toronto, ON", role_type: "full-time",
    lane_label: null, category: null,
    salary: "$55,000–$70,000 + commission", salary_source: "job_posting", salary_below_min: true,
    match_hits: 0,
    job_summary: "Sun Life is hiring Financial Advisors to sell group benefits and retirement solutions to SMB clients. Commission-heavy compensation.",
    why_fit: "Commission structure, junior salary band, consumer financial products sales. None of Luther's target criteria are met. Scored as noise.",
    added_at: daysAgo(8),
  },
];

const priyaJobs: Omit<InboxJob, "id" | "profile_id">[] = [
  // S tier
  {
    score: 96, tier: "S",
    company: "Stripe", title: "Senior Product Manager — Payments Platform",
    url: "https://stripe.com/jobs/sr-pm-payments-platform-demo",
    source: "Remotive", location: "Remote · US", role_type: "full-time",
    lane_label: "Platform PM", category: "Senior PM",
    salary: "$190,000–$225,000", salary_source: "job_posting", salary_below_min: false,
    match_hits: 8,
    job_summary: "Stripe Payments Platform is hiring a Senior PM to own the API developer experience, routing intelligence, and payment method expansion for the core payments product. Deep collaboration with engineering and design.",
    why_fit: "A perfect vector for Priya: platform PM at the API layer, developer experience focus, healthtech-adjacent payment flows. Stripe's remote-first culture and the comp band well above her floor make this a clear top signal.",
    added_at: daysAgo(1),
  },
  {
    score: 93, tier: "S",
    company: "Headspace", title: "Group Product Manager — Member Experience",
    url: "https://jobs.headspace.com/group-pm-member-exp-demo",
    source: "RemoteOK", location: "Remote · US", role_type: "full-time",
    lane_label: "Platform PM", category: "Group PM",
    salary: "$180,000–$210,000", salary_source: "job_posting", salary_below_min: false,
    match_hits: 7,
    job_summary: "Headspace is hiring a Group PM to own the full member journey from onboarding through retention. Reports to VP Product. Manages 2 PMs with scope to expand. Deeply cross-functional with content, growth, and clinical teams.",
    why_fit: "Healthtech at the GPM level — Priya's two strongest vectors converge. The people management component signals seniority progression. Comp is in range. Remote structure matches her search.",
    added_at: daysAgo(1),
  },
  // A tier
  {
    score: 84, tier: "A",
    company: "Forward", title: "Director of Product — Clinical Platform",
    url: "https://forward.com/careers/director-product-clinical-demo",
    source: "Remotive", location: "Remote · US", role_type: "full-time",
    lane_label: "Platform PM", category: "Director of Product",
    salary: "$200,000–$235,000", salary_source: "job_posting", salary_below_min: false,
    match_hits: 6,
    job_summary: "Forward is hiring a Director of Product to own their clinical platform, spanning practitioner tooling, care protocols, and health data infrastructure. Directly manages 3 PMs.",
    why_fit: "Director-level scope in healthtech. Forward's clinical platform orientation maps to Priya's background. Manages PMs, owns a full platform — this is the right progression if she's ready to make the Director move.",
    added_at: daysAgo(2),
  },
  {
    score: 81, tier: "A",
    company: "Twilio", title: "Senior PM — API Platform & Developer Experience",
    url: "https://twilio.com/careers/sr-pm-api-platform-demo",
    source: "RemoteOK", location: "Remote · US", role_type: "full-time",
    lane_label: "Platform PM", category: "Senior PM",
    salary: "$175,000–$200,000", salary_source: "job_posting", salary_below_min: false,
    match_hits: 7,
    job_summary: "Twilio is hiring a Senior PM to own developer-facing API products, documentation quality, and SDK experience across communications APIs. Deep partnership with developer advocacy.",
    why_fit: "API platform PM with developer experience ownership is exactly Priya's skillset. Twilio's developer-first culture and remote setup are aligned. The API + healthtech combination in her background gives strong contextual differentiation.",
    added_at: daysAgo(2),
  },
  {
    score: 79, tier: "A",
    company: "Calm", title: "Head of Product — Growth",
    url: "https://calm.com/careers/head-of-product-growth-demo",
    source: "Remotive", location: "Remote · US", role_type: "full-time",
    lane_label: "Platform PM", category: "Head of Product",
    salary: "$175,000–$205,000", salary_source: "job_posting", salary_below_min: false,
    match_hits: 6,
    job_summary: "Calm is looking for a Head of Product to own their consumer growth loop: acquisition, activation, and retention. Focuses on A/B testing infrastructure, onboarding optimization, and subscription conversion.",
    why_fit: "Growth + healthtech + senior individual contributor scope. Priya's A/B testing and Mixpanel experience converts directly. Calm is a strong brand. The Head title and comp range are right for where she is.",
    added_at: daysAgo(3),
  },
  {
    score: 76, tier: "A",
    company: "Airtable", title: "Staff Product Manager — Platform",
    url: "https://airtable.com/jobs/staff-pm-platform-demo",
    source: "Remotive", location: "Remote · US", role_type: "full-time",
    lane_label: "Platform PM", category: "Staff PM",
    salary: "$185,000–$215,000", salary_source: "job_posting", salary_below_min: false,
    match_hits: 5,
    job_summary: "Airtable is hiring a Staff PM to own platform-level infrastructure: API ecosystem, automation framework, and third-party integrations. Heavy cross-functional coordination with enterprise sales.",
    why_fit: "Platform orientation with API ecosystem ownership. The Staff PM title and scope align with Priya's trajectory. Airtable's platform complexity is a real challenge that would use her skills fully.",
    added_at: daysAgo(3),
  },
  // B tier
  {
    score: 67, tier: "B",
    company: "Intercom", title: "Senior Product Manager — AI Features",
    url: "https://intercom.com/careers/sr-pm-ai-demo",
    source: "RemoteOK", location: "Remote · US", role_type: "full-time",
    lane_label: "Platform PM", category: "Senior PM",
    salary: "$160,000–$185,000", salary_source: "job_posting", salary_below_min: false,
    match_hits: 4,
    job_summary: "Intercom is building out its Fin AI product line and needs a Senior PM to own the AI features roadmap, working closely with ML engineers and customer-facing teams.",
    why_fit: "AI product work at a strong SaaS company. Not healthtech but the AI feature ownership adds a new vector. Comp is in range. The role could be a platform play depending on how broadly the scope evolves.",
    added_at: daysAgo(4),
  },
  {
    score: 64, tier: "B",
    company: "Notion", title: "Product Manager — Growth",
    url: "https://notion.so/careers/pm-growth-demo",
    source: "Remotive", location: "Remote · US", role_type: "full-time",
    lane_label: "Platform PM", category: "PM",
    salary: "$150,000–$175,000", salary_source: "job_posting", salary_below_min: false,
    match_hits: 4,
    job_summary: "Notion Growth is hiring a PM to own activation and retention experiments. High-velocity testing environment with direct access to growth data and experimentation infrastructure.",
    why_fit: "Growth PM at a recognized brand. Comp slightly below Priya's ceiling but within range. The Notion brand adds credibility. Not healthtech — could be a strong generalist move if the next step is VP-level.",
    added_at: daysAgo(4),
  },
  {
    score: 62, tier: "B",
    company: "Databricks", title: "Senior PM — Data Products",
    url: "https://databricks.com/careers/sr-pm-data-products-demo",
    source: "Remotive", location: "Remote · US", role_type: "full-time",
    lane_label: "Platform PM", category: "Senior PM",
    salary: "$175,000–$200,000", salary_source: "job_posting", salary_below_min: false,
    match_hits: 4,
    job_summary: "Databricks Data Products team is looking for a Senior PM to own data catalog, governance, and analytics workflows for enterprise data teams.",
    why_fit: "Strong on comp and remote. The data infrastructure angle is different from Priya's healthcare focus but her SQL and analytics background is a genuine asset. Worth a look for the career breadth.",
    added_at: daysAgo(5),
  },
  {
    score: 59, tier: "B",
    company: "Oscar Health", title: "Senior Product Manager — Member Platform",
    url: "https://hioscar.com/careers/sr-pm-member-platform-demo",
    source: "Jooble", location: "New York, NY (Remote-First)", role_type: "full-time",
    lane_label: "Platform PM", category: "Senior PM",
    salary: "$165,000–$190,000", salary_source: "job_posting", salary_below_min: false,
    match_hits: 5,
    job_summary: "Oscar Health is hiring a Senior PM to own member-facing platform products: claims, benefits navigation, and care coordination. Heavy regulatory environment.",
    why_fit: "Healthtech PM at the member platform level. The regulatory/compliance complexity is a differentiator for someone with Priya's background. New York location is a mild friction point given her Austin base but the role is remote-first.",
    added_at: daysAgo(5),
  },
  // C tier
  {
    score: 41, tier: "C",
    company: "Amazon", title: "Product Manager — Internal Tools",
    url: "https://amazon.jobs/pm-internal-tools-demo",
    source: "Jooble", location: "Seattle, WA (Hybrid)", role_type: "full-time",
    lane_label: null, category: "PM",
    salary: "$135,000–$155,000", salary_source: "job_posting", salary_below_min: true,
    match_hits: 2,
    job_summary: "Amazon is hiring a PM to manage internal tooling for logistics ops teams. High-ambiguity environment with strong bias toward data-driven decisions.",
    why_fit: "Hybrid in Seattle, below comp floor, internal tooling focus. Amazon's internal PM culture is very different from Priya's product background. The brand is strong but the fit signals are weak.",
    added_at: daysAgo(6),
  },
  {
    score: 38, tier: "C",
    company: "McKinsey & Company", title: "Business Analyst — Digital Health",
    url: "https://mckinsey.com/careers/ba-digital-health-demo",
    source: "Jooble", location: "New York, NY", role_type: "full-time",
    lane_label: null, category: null,
    salary: "$95,000–$115,000", salary_source: "job_posting", salary_below_min: true,
    match_hits: 1,
    job_summary: "McKinsey Digital Health practice is hiring BAs to support healthcare strategy and transformation engagements for payer and provider clients.",
    why_fit: "Consulting is a different career vector. Below comp floor and a seniority step-back. The digital health domain is relevant but the role type is wrong for Priya's trajectory.",
    added_at: daysAgo(7),
  },
  // F tier
  {
    score: 15, tier: "F",
    company: "IDEO", title: "UX Researcher — Health Services",
    url: "https://ideo.com/careers/ux-researcher-health-demo",
    source: "Jooble", location: "San Francisco, CA", role_type: "full-time",
    lane_label: null, category: null,
    salary: "$90,000–$110,000", salary_source: "job_posting", salary_below_min: true,
    match_hits: 0,
    job_summary: "IDEO is hiring a UX Researcher for its Health portfolio. Role involves qualitative research, co-design workshops, and synthesis for healthcare clients.",
    why_fit: "Research, not product. Wrong function, below comp, onsite in SF. Scored as noise.",
    added_at: daysAgo(8),
  },
];

const marcusJobs: Omit<InboxJob, "id" | "profile_id">[] = [
  // S tier
  {
    score: 97, tier: "S",
    company: "Cloudflare", title: "Staff Software Engineer — Edge Platform",
    url: "https://cloudflare.com/careers/staff-swe-edge-platform-demo",
    source: "Remotive", location: "Remote · US", role_type: "full-time",
    lane_label: "Backend Engineering", category: "Staff Engineer",
    salary: "$240,000–$285,000", salary_source: "job_posting", salary_below_min: false,
    match_hits: 9,
    job_summary: "Cloudflare is building the next generation of Workers and edge storage primitives. This Staff SWE role owns core runtime performance, V8 isolate lifecycle, and distributed state management across Cloudflare's global network.",
    why_fit: "Marcus works on Cloudflare Workers D1 daily. This is the internal team that built the infrastructure he relies on. His distributed systems depth, TypeScript fluency, and edge computing experience map directly. Comp is comfortably above his floor. The proximity to the metal is the differentiator.",
    added_at: daysAgo(1),
  },
  {
    score: 94, tier: "S",
    company: "Stripe", title: "Principal Backend Engineer — Payments Infrastructure",
    url: "https://stripe.com/jobs/principal-backend-payments-infra-demo",
    source: "Remotive", location: "Remote · US", role_type: "full-time",
    lane_label: "Backend Engineering", category: "Principal Engineer",
    salary: "$265,000–$305,000", salary_source: "job_posting", salary_below_min: false,
    match_hits: 8,
    job_summary: "Stripe is hiring a Principal Engineer to lead the Payments Infrastructure team building the low-level transaction processing pipeline. Scope includes idempotency, consistency guarantees, and latency optimization across Stripe's global payments stack.",
    why_fit: "Principal-level payments infrastructure at Stripe. Marcus's PostgreSQL expertise, distributed systems background, and Hono/Drizzle experience in payment contexts translate cleanly. The scope is exactly the level of ambiguity where he operates best.",
    added_at: daysAgo(1),
  },
  // A tier
  {
    score: 85, tier: "A",
    company: "Figma", title: "Engineering Manager — Platform Infrastructure",
    url: "https://figma.com/careers/em-platform-infra-demo",
    source: "Remotive", location: "Remote · US", role_type: "full-time",
    lane_label: "Engineering Leadership", category: "Engineering Manager",
    salary: "$225,000–$260,000", salary_source: "job_posting", salary_below_min: false,
    match_hits: 6,
    job_summary: "Figma is growing its Platform Infrastructure team and needs an EM to manage 7–10 engineers across backend services, observability, and developer tooling. Player-coach role with strong technical bar.",
    why_fit: "EM at Figma's infrastructure layer. Marcus has the technical depth to stay credible as a player-coach. The comp is strong. Main question is whether the management layer is where he wants to invest next or if he'd rather stay IC.",
    added_at: daysAgo(2),
  },
  {
    score: 82, tier: "A",
    company: "DoorDash", title: "Staff Software Engineer — Merchant Platform",
    url: "https://doordash.com/careers/staff-swe-merchant-platform-demo",
    source: "Jooble", location: "New York, NY (Remote-First)", role_type: "full-time",
    lane_label: "Backend Engineering", category: "Staff Engineer",
    salary: "$240,000–$275,000", salary_source: "job_posting", salary_below_min: false,
    match_hits: 6,
    job_summary: "DoorDash Merchant Platform is hiring a Staff SWE to own core merchant-facing APIs, integration tooling, and the data pipeline feeding merchant analytics. NYC-first with strong remote flexibility.",
    why_fit: "Staff IC role at DoorDash scale. The merchant-facing API and integration work is directly comparable to Marcus's backend experience. NYC-remote hybrid works given his location. Comp is within range.",
    added_at: daysAgo(2),
  },
  {
    score: 80, tier: "A",
    company: "Vercel", title: "Senior Staff Engineer — Edge Runtime",
    url: "https://vercel.com/careers/senior-staff-edge-runtime-demo",
    source: "Remotive", location: "Remote · Global", role_type: "full-time",
    lane_label: "Backend Engineering", category: "Staff Engineer",
    salary: "$230,000–$265,000", salary_source: "job_posting", salary_below_min: false,
    match_hits: 7,
    job_summary: "Vercel is scaling its Edge Runtime team to support the Next.js ecosystem at global scale. This Senior Staff SWE owns the runtime execution environment, middleware pipeline, and edge caching semantics.",
    why_fit: "Marcus uses Vercel and Next.js in production. Working on the edge runtime that underpins his own toolchain is a meaningful signal. The remote-global structure is ideal. Senior Staff scope is a strong next step.",
    added_at: daysAgo(3),
  },
  {
    score: 78, tier: "A",
    company: "Brex", title: "Staff Engineer — Financial Platform",
    url: "https://brex.com/careers/staff-eng-financial-platform-demo",
    source: "Remotive", location: "Remote · US", role_type: "full-time",
    lane_label: "Backend Engineering", category: "Staff Engineer",
    salary: "$235,000–$270,000", salary_source: "job_posting", salary_below_min: false,
    match_hits: 6,
    job_summary: "Brex Financial Platform is hiring a Staff Engineer to own ledger architecture, reconciliation pipelines, and transaction consistency at scale. Go and PostgreSQL are the primary stack.",
    why_fit: "Ledger and financial platform work maps precisely to Marcus's PostgreSQL and distributed systems skills. Go as primary language is a strong match. Brex's engineering culture rewards the kind of systems thinking he brings.",
    added_at: daysAgo(3),
  },
  // B tier
  {
    score: 69, tier: "B",
    company: "Linear", title: "Senior Backend Engineer",
    url: "https://linear.app/careers/senior-backend-engineer-demo",
    source: "RemoteOK", location: "Remote · US/Europe", role_type: "full-time",
    lane_label: "Backend Engineering", category: "Senior SWE",
    salary: "$190,000–$225,000", salary_source: "job_posting", salary_below_min: false,
    match_hits: 5,
    job_summary: "Linear is hiring a Senior Backend Engineer to work on real-time sync, conflict resolution, and data persistence for their project management platform. TypeScript and PostgreSQL stack.",
    why_fit: "Strong technical culture at Linear. Real-time sync and conflict resolution are meaty distributed systems problems. Comp is slightly below the Staff ceiling but the work quality is high. Good option if scope progression is on the table.",
    added_at: daysAgo(4),
  },
  {
    score: 66, tier: "B",
    company: "Ramp", title: "Backend Lead — Spend Intelligence",
    url: "https://ramp.com/careers/backend-lead-spend-intelligence-demo",
    source: "Remotive", location: "Remote · US", role_type: "full-time",
    lane_label: "Backend Engineering", category: "Tech Lead",
    salary: "$210,000–$245,000", salary_source: "job_posting", salary_below_min: false,
    match_hits: 5,
    job_summary: "Ramp is building Spend Intelligence and needs a Backend Lead to own the data pipeline, ML feature serving infrastructure, and real-time categorization engine. Go-heavy stack.",
    why_fit: "Tech lead at Ramp's spend intelligence layer. Financial data infrastructure in Go is a direct skill match. Ramp is growing fast and the Lead role gets close to staff-level scope. Comp is strong.",
    added_at: daysAgo(4),
  },
  {
    score: 63, tier: "B",
    company: "Faire", title: "Principal Engineer — Marketplace Platform",
    url: "https://faire.com/careers/principal-engineer-marketplace-demo",
    source: "Remotive", location: "Remote · US/CA", role_type: "full-time",
    lane_label: "Backend Engineering", category: "Principal Engineer",
    salary: "$200,000–$235,000", salary_source: "job_posting", salary_below_min: false,
    match_hits: 4,
    job_summary: "Faire is hiring a Principal Engineer to lead the marketplace platform team, focusing on order routing, inventory consistency, and pricing infrastructure at scale.",
    why_fit: "Principal IC role at Faire. Marketplace platform is good distributed systems territory. The US/CA remote option works. Comp is in range but below the top tier. Solid B-tier given the lower name recognition vs. Stripe/Cloudflare.",
    added_at: daysAgo(5),
  },
  {
    score: 58, tier: "B",
    company: "Notion", title: "Staff Software Engineer — Data Platform",
    url: "https://notion.so/careers/staff-swe-data-platform-demo",
    source: "Remotive", location: "Remote · US", role_type: "full-time",
    lane_label: "Backend Engineering", category: "Staff Engineer",
    salary: "$220,000–$250,000", salary_source: "job_posting", salary_below_min: false,
    match_hits: 4,
    job_summary: "Notion Data Platform is hiring a Staff SWE to own the database query engine, performance optimization, and the real-time collaboration backend.",
    why_fit: "Staff IC at Notion's data platform. PostgreSQL query engine work is a good use of Marcus's database depth. The real-time collaboration backend is interesting territory. Comp is solid.",
    added_at: daysAgo(5),
  },
  {
    score: 55, tier: "B",
    company: "Shopify", title: "Senior Software Engineer — Core Platform",
    url: "https://shopify.com/careers/senior-swe-core-platform-demo",
    source: "Adzuna CA", location: "Remote · Canada", role_type: "full-time",
    lane_label: "Backend Engineering", category: "Senior SWE",
    salary: "$180,000–$210,000", salary_source: "job_posting", salary_below_min: false,
    match_hits: 4,
    job_summary: "Shopify Core Platform is growing its distributed systems team. Senior SWE role owns job queue infrastructure, caching architecture, and service reliability for Shopify's core commerce platform.",
    why_fit: "Canadian remote option, strong brand, distributed systems scope. The Senior level is a step below Staff which is a mild fit signal. Comp is lower than US-based alternatives. Worth a look if Canadian options are weighted.",
    added_at: daysAgo(6),
  },
  // C tier
  {
    score: 42, tier: "C",
    company: "Accenture", title: "Full Stack Developer — Cloud Modernization",
    url: "https://accenture.com/careers/full-stack-cloud-demo",
    source: "Jooble", location: "New York, NY (Hybrid)", role_type: "full-time",
    lane_label: null, category: null,
    salary: "$120,000–$145,000", salary_source: "job_posting", salary_below_min: true,
    match_hits: 2,
    job_summary: "Accenture Technology is hiring a Full Stack Developer for cloud modernization projects with enterprise financial services clients.",
    why_fit: "Consulting, below comp floor, hybrid in NY, enterprise legacy migration work. The consulting model is a different career structure from Marcus's product-side trajectory.",
    added_at: daysAgo(6),
  },
  {
    score: 37, tier: "C",
    company: "Bank of America", title: "Senior Software Engineer — Quant Tech",
    url: "https://careers.bankofamerica.com/sr-swe-quant-tech-demo",
    source: "Jooble", location: "New York, NY", role_type: "full-time",
    lane_label: null, category: null,
    salary: "$150,000–$170,000", salary_source: "job_posting", salary_below_min: true,
    match_hits: 2,
    job_summary: "Bank of America Quant Tech is hiring Senior SWEs to build quantitative analytics tooling, market data pipelines, and risk calculation infrastructure.",
    why_fit: "Financial infrastructure work but below comp floor and in a legacy banking technology environment. The quant tools domain is interesting but the comp ceiling and tech culture are constraints.",
    added_at: daysAgo(7),
  },
  // F tier
  {
    score: 11, tier: "F",
    company: "JPMorgan Chase", title: "Junior Developer — Legacy Systems Modernization",
    url: "https://careers.jpmorgan.com/junior-developer-legacy-demo",
    source: "Jooble", location: "New York, NY", role_type: "full-time",
    lane_label: null, category: null,
    salary: "$80,000–$95,000", salary_source: "job_posting", salary_below_min: true,
    match_hits: 0,
    job_summary: "JPMorgan Chase is hiring Junior Developers for a COBOL and Java legacy modernization initiative across their core banking systems.",
    why_fit: "Junior title, COBOL stack, way below comp floor. Scored as noise.",
    added_at: daysAgo(8),
  },
];

// ─── Tracker Entries ───────────────────────────────────────────────────────

const lutherTrackerEntries = [
  {
    profile_id: PROFILES.luther,
    score: 82, tier: "A",
    company: "HubSpot", title: "Senior Account Executive — Mid-Market",
    url: "https://hubspot.com/careers/sr-ae-mid-market-demo",
    source: "RemoteOK", location: "Remote · Americas", role_type: "full-time",
    lane_label: "Enterprise Sales", category: "Account Executive",
    salary: "$140,000–$170,000 + commission", salary_source: "job_posting", salary_below_min: false,
    match_hits: 5,
    job_summary: "HubSpot mid-market AE role with strong inbound support and OTE 2x base.",
    why_fit: "Direct product familiarity. Mid-market aligns with deal-size experience.",
    status: "Interviewing",
    notes: "1st round call done — moving to panel. Good signal from recruiter.",
    date_applied: "2025-04-08",
    good_fit: "Uses HubSpot daily. Mid-market deal size is natural fit. OTE structure works.",
    stage_changed_at: daysAgo(6),
    added_at: daysAgo(14),
    updated_at: daysAgo(6),
  },
  {
    profile_id: PROFILES.luther,
    score: 79, tier: "A",
    company: "Stripe", title: "Director of Financial Services — Canada",
    url: "https://stripe.com/jobs/director-fs-canada-demo",
    source: "Adzuna CA", location: "Toronto, ON (Hybrid)", role_type: "full-time",
    lane_label: "Enterprise Sales", category: "Director",
    salary: "$175,000–$205,000", salary_source: "job_posting", salary_below_min: false,
    match_hits: 6,
    job_summary: "Director-level hire to own Canadian FS vertical.",
    why_fit: "Toronto-based, fintech-native, right trajectory.",
    status: "Applied",
    notes: "Applied directly via Stripe careers. Referral from Plaid contact pending.",
    date_applied: "2025-04-14",
    good_fit: "Toronto base, fintech domain, Director scope is the right progression.",
    stage_changed_at: daysAgo(10),
    added_at: daysAgo(18),
    updated_at: daysAgo(10),
  },
  {
    profile_id: PROFILES.luther,
    score: 94, tier: "S",
    company: "Rippling", title: "Enterprise Account Executive — Financial Services",
    url: "https://jobs.rippling.com/enterprise-ae-fs-demo",
    source: "Remotive", location: "Remote · US/CA", role_type: "full-time",
    lane_label: "Enterprise Sales", category: "Account Executive",
    salary: "$175,000–$210,000 + OTE", salary_source: "job_posting", salary_below_min: false,
    match_hits: 7,
    job_summary: "AE for Rippling's Financial Services vertical. Full cycle, uncapped OTE.",
    why_fit: "Top signal. FS vertical, direct skill match, strong comp.",
    status: "Prospect",
    notes: "Haven't applied yet. Waiting for intro from mutual contact at Rippling.",
    date_applied: null,
    good_fit: "Best in current batch. Need the intro before applying cold.",
    stage_changed_at: daysAgo(2),
    added_at: daysAgo(2),
    updated_at: daysAgo(2),
  },
];

const priyaTrackerEntries = [
  {
    profile_id: PROFILES.priya,
    score: 96, tier: "S",
    company: "Stripe", title: "Senior Product Manager — Payments Platform",
    url: "https://stripe.com/jobs/sr-pm-payments-platform-demo",
    source: "Remotive", location: "Remote · US", role_type: "full-time",
    lane_label: "Platform PM", category: "Senior PM",
    salary: "$190,000–$225,000", salary_source: "job_posting", salary_below_min: false,
    match_hits: 8,
    job_summary: "Senior PM for Stripe's core payments API platform.",
    why_fit: "Top signal. API platform scope, strong comp, remote.",
    status: "Interviewing",
    notes: "Passed recruiter screen and hiring manager call. System design round scheduled for next Tuesday.",
    date_applied: "2025-04-05",
    good_fit: "This is the one. Payments API + healthtech context is a unique differentiator.",
    stage_changed_at: daysAgo(3),
    added_at: daysAgo(20),
    updated_at: daysAgo(3),
  },
  {
    profile_id: PROFILES.priya,
    score: 84, tier: "A",
    company: "Forward", title: "Director of Product — Clinical Platform",
    url: "https://forward.com/careers/director-product-clinical-demo",
    source: "Remotive", location: "Remote · US", role_type: "full-time",
    lane_label: "Platform PM", category: "Director of Product",
    salary: "$200,000–$235,000", salary_source: "job_posting", salary_below_min: false,
    match_hits: 6,
    job_summary: "Director of Product for Forward's clinical platform.",
    why_fit: "Director-level scope in healthtech. Right progression.",
    status: "Applied",
    notes: "Submitted via Lever. Referral from college contact who's a PM there.",
    date_applied: "2025-04-12",
    good_fit: "Healthtech clinical platform — strongest domain match in current batch.",
    stage_changed_at: daysAgo(12),
    added_at: daysAgo(15),
    updated_at: daysAgo(12),
  },
  {
    profile_id: PROFILES.priya,
    score: 93, tier: "S",
    company: "Headspace", title: "Group Product Manager — Member Experience",
    url: "https://jobs.headspace.com/group-pm-member-exp-demo",
    source: "RemoteOK", location: "Remote · US", role_type: "full-time",
    lane_label: "Platform PM", category: "Group PM",
    salary: "$180,000–$210,000", salary_source: "job_posting", salary_below_min: false,
    match_hits: 7,
    job_summary: "GPM owning full member journey at Headspace.",
    why_fit: "Healthtech + GPM level. Strong convergence.",
    status: "Prospect",
    notes: "Researching team. Want to find a warm intro before applying.",
    date_applied: null,
    good_fit: "GPM + healthtech is the exact level and domain. Priority application.",
    stage_changed_at: daysAgo(1),
    added_at: daysAgo(1),
    updated_at: daysAgo(1),
  },
];

const marcusTrackerEntries = [
  {
    profile_id: PROFILES.marcus,
    score: 97, tier: "S",
    company: "Cloudflare", title: "Staff Software Engineer — Edge Platform",
    url: "https://cloudflare.com/careers/staff-swe-edge-platform-demo",
    source: "Remotive", location: "Remote · US", role_type: "full-time",
    lane_label: "Backend Engineering", category: "Staff Engineer",
    salary: "$240,000–$285,000", salary_source: "job_posting", salary_below_min: false,
    match_hits: 9,
    job_summary: "Staff SWE on the Workers and edge storage core team.",
    why_fit: "Perfect technical match. He uses this infrastructure daily.",
    status: "Interviewing",
    notes: "Passed recruiter screen, eng screen, and take-home systems design. Panel scheduled.",
    date_applied: "2025-03-28",
    good_fit: "Dream role. Uses CF Workers D1 every day. Technical fit is 1:1.",
    stage_changed_at: daysAgo(4),
    added_at: daysAgo(28),
    updated_at: daysAgo(4),
  },
  {
    profile_id: PROFILES.marcus,
    score: 94, tier: "S",
    company: "Stripe", title: "Principal Backend Engineer — Payments Infrastructure",
    url: "https://stripe.com/jobs/principal-backend-payments-infra-demo",
    source: "Remotive", location: "Remote · US", role_type: "full-time",
    lane_label: "Backend Engineering", category: "Principal Engineer",
    salary: "$265,000–$305,000", salary_source: "job_posting", salary_below_min: false,
    match_hits: 8,
    job_summary: "Principal engineer on Stripe's payments infrastructure.",
    why_fit: "Principal level, payments infrastructure, strong PostgreSQL match.",
    status: "Applied",
    notes: "Applied through referral from former colleague. Recruiter reached out same day.",
    date_applied: "2025-04-10",
    good_fit: "Principal IC at Stripe. Payments + distributed systems is exact specialization.",
    stage_changed_at: daysAgo(8),
    added_at: daysAgo(16),
    updated_at: daysAgo(8),
  },
  {
    profile_id: PROFILES.marcus,
    score: 85, tier: "A",
    company: "Figma", title: "Engineering Manager — Platform Infrastructure",
    url: "https://figma.com/careers/em-platform-infra-demo",
    source: "Remotive", location: "Remote · US", role_type: "full-time",
    lane_label: "Engineering Leadership", category: "Engineering Manager",
    salary: "$225,000–$260,000", salary_source: "job_posting", salary_below_min: false,
    match_hits: 6,
    job_summary: "EM for Figma's platform infrastructure team.",
    why_fit: "Player-coach EM scope. Strong technical bar maintained.",
    status: "Prospect",
    notes: "Interesting as a management track exploration. Not sure yet.",
    date_applied: null,
    good_fit: "Might be the right time to try the EM track. Figma's infra team is technically excellent.",
    stage_changed_at: daysAgo(5),
    added_at: daysAgo(5),
    updated_at: daysAgo(5),
  },
];

// ─── Tickets ───────────────────────────────────────────────────────────────

const tickets = [
  {
    id: uuid(1001),
    title: "Adzuna CA fetch returning 0 results for 'account executive Toronto'",
    status: "resolved",
    priority: "high",
    source: "error",
    reporter_id: PROFILES.admin,
    message: "Adzuna Canada adapter returning empty results for AE + Toronto searches since April 18. Other search terms returning normally. Likely API parameter encoding issue.",
    metadata: { source: "Adzuna CA", search_term: "account executive toronto", batch_id: "batch-20250418-001", error_code: "EMPTY_RESULT_SET" },
    notes: [{ ts: daysAgo(7), by: "admin", text: "Reproduced. Adzuna CA changed URL encoding requirement for comma-separated terms." }, { ts: daysAgo(6), by: "admin", text: "Fixed in adzuna-ca adapter. Deployed. Verified 47 results returned on next fetch." }],
    resolved_at: daysAgo(6),
    created_at: daysAgo(7),
    updated_at: daysAgo(6),
  },
  {
    id: uuid(1002),
    title: "Luther's inbox showing stale jobs from March — dedup not clearing",
    status: "resolved",
    priority: "medium",
    source: "user_report",
    reporter_id: PROFILES.luther,
    message: "Seeing the same Rogers job from March 22 in my inbox again after the April 20 fetch. Thought it was dismissed but it came back.",
    metadata: { profile_id: PROFILES.luther, job_url: "https://jobs.rogers.com/stale-demo", reported_source: "inbox" },
    notes: [{ ts: daysAgo(5), by: "admin", text: "Confirmed — dismissed_jobs dedup check was missing for this source URL variant. Patched." }],
    resolved_at: daysAgo(5),
    created_at: daysAgo(6),
    updated_at: daysAgo(5),
  },
  {
    id: uuid(1003),
    title: "Enrichment timeout on Jooble batch — 3 jobs missing why_fit",
    status: "resolved",
    priority: "medium",
    source: "error",
    reporter_id: PROFILES.admin,
    message: "April 19 batch: 3 jobs from Jooble completed scoring but enrichment timed out. Stored with null why_fit. Retry succeeded on next batch.",
    metadata: { batch_id: "batch-20250419-002", affected_count: 3, source: "Jooble", timeout_ms: 30000 },
    notes: [{ ts: daysAgo(4), by: "admin", text: "OpenAI API had elevated latency April 19 18:00–18:45 UTC. Auto-retry succeeded. No user impact." }],
    resolved_at: daysAgo(4),
    created_at: daysAgo(5),
    updated_at: daysAgo(4),
  },
  {
    id: uuid(1004),
    title: "Priya not receiving weekly digest emails",
    status: "in_progress",
    priority: "medium",
    source: "user_report",
    reporter_id: PROFILES.priya,
    message: "Haven't received my Friday digest for the past 2 weeks. Checked spam — not there either. Other clients confirmed receiving theirs.",
    metadata: { profile_id: PROFILES.priya, email: "priya@sygnalist-demo.co", last_successful_digest: daysAgo(16) },
    notes: [{ ts: daysAgo(3), by: "admin", text: "Confirmed Priya's email missing from digest cron job recipient list since schema migration. Investigating root cause." }],
    resolved_at: null,
    created_at: daysAgo(4),
    updated_at: daysAgo(3),
  },
  {
    id: uuid(1005),
    title: "Job Bank showing duplicate entries for same URL with different company name casing",
    status: "open",
    priority: "low",
    source: "activity",
    reporter_id: PROFILES.admin,
    message: "Global Job Bank has 14 duplicate entries where the same URL appears twice with different company name casing (e.g., 'HubSpot' vs 'hubspot'). Dedupe is URL-based but URL comparison is case-sensitive on the scheme part.",
    metadata: { duplicate_count: 14, example_url: "https://hubspot.com/careers/sr-ae-demo", variants: ["HubSpot", "hubspot"] },
    notes: [],
    resolved_at: null,
    created_at: daysAgo(3),
    updated_at: daysAgo(3),
  },
  {
    id: uuid(1006),
    title: "RapidAPI JSearch fallback hitting rate limit on multi-profile fetches",
    status: "open",
    priority: "high",
    source: "error",
    reporter_id: PROFILES.admin,
    message: "When 3 active clients trigger fetches within the same hour, JSearch fallback hits the 10 req/min RapidAPI limit. Last occurred April 21 — batches for Luther and Marcus both partially failed.",
    metadata: { source: "RapidAPI JSearch", rate_limit: "10 req/min", affected_profiles: ["demo-luther", "demo-marcus"], batch_ids: ["batch-20250421-003", "batch-20250421-004"] },
    notes: [{ ts: daysAgo(2), by: "admin", text: "Need to add per-source rate limiting with backoff. Workaround: stagger fetches by 15 minutes between profiles." }],
    resolved_at: null,
    created_at: daysAgo(2),
    updated_at: daysAgo(2),
  },
  {
    id: uuid(1007),
    title: "Marcus's tracker stage color not updating after Interviewing → Applied regression",
    status: "open",
    priority: "low",
    source: "user_report",
    reporter_id: PROFILES.marcus,
    message: "Moved the Figma job back from Interviewing to Applied (changed my mind) — the status badge updated but the timeline color in the tracker view stayed orange (Interviewing) instead of going back to blue.",
    metadata: { profile_id: PROFILES.marcus, job_url: "https://figma.com/careers/em-platform-infra-demo", expected_color: "blue", actual_color: "orange" },
    notes: [],
    resolved_at: null,
    created_at: daysAgo(1),
    updated_at: daysAgo(1),
  },
  {
    id: uuid(1008),
    title: "USAJobs adapter not filtering remote-only for Canadian applicants",
    status: "resolved",
    priority: "medium",
    source: "activity",
    reporter_id: PROFILES.admin,
    message: "USAJobs results for Luther and Priya (both CA-based) include onsite US government positions they can't legally work. Should be filtered at adapter level for non-US profiles.",
    metadata: { affected_profiles: ["demo-luther"], filtered_results_count: 12 },
    notes: [{ ts: daysAgo(8), by: "admin", text: "Added citizenship filter to USAJobs adapter for non-US profiles. Luther's next fetch excluded 12 positions correctly." }],
    resolved_at: daysAgo(8),
    created_at: daysAgo(9),
    updated_at: daysAgo(8),
  },
  {
    id: uuid(1009),
    title: "Salary parse failing for CAD ranges with $k notation (e.g. '$130k–$155k CAD')",
    status: "resolved",
    priority: "low",
    source: "error",
    reporter_id: PROFILES.admin,
    message: "Canadian job postings using $130k–$155k CAD notation being stored as null salary. Regex parser only handles fully spelled-out ranges.",
    metadata: { pattern: "$130k–$155k CAD", parsed_value: null, expected: "$130,000–$155,000 CAD" },
    notes: [{ ts: daysAgo(11), by: "admin", text: "Updated salary parser to handle k-notation variants. Tested on 40 CA postings. Deployed." }],
    resolved_at: daysAgo(11),
    created_at: daysAgo(12),
    updated_at: daysAgo(11),
  },
  {
    id: uuid(1010),
    title: "Admin OPS health check showing stale DB timestamp",
    status: "resolved",
    priority: "low",
    source: "activity",
    reporter_id: PROFILES.admin,
    message: "DB health timestamp on admin OPS panel showing last-checked as 47 minutes ago despite health check running every 5 minutes. Display bug — actual DB response time is 112ms.",
    metadata: { display_lag_minutes: 47, actual_db_ms: 112, last_real_check: hoursAgo(0.08) },
    notes: [{ ts: daysAgo(13), by: "admin", text: "Fixed — health timestamp wasn't being refreshed in client state after background check completed. UI update now triggers on poll completion." }],
    resolved_at: daysAgo(13),
    created_at: daysAgo(14),
    updated_at: daysAgo(13),
  },
  {
    id: uuid(1011),
    title: "Gmail ingest parsing Lever ATS emails as Greenhouse format",
    status: "in_progress",
    priority: "medium",
    source: "error",
    reporter_id: PROFILES.admin,
    message: "Lever confirmation emails (job-noreply@lever.co) being parsed by Greenhouse parser, resulting in missing company name and incorrect job URL extraction.",
    metadata: { sender_domain: "lever.co", parser_used: "greenhouse", expected_parser: "lever", missed_extractions: ["company_name", "job_url"] },
    notes: [{ ts: daysAgo(1), by: "admin", text: "Investigating sender fingerprint matching logic. Lever and Greenhouse share similar HTML structure in notification emails." }],
    resolved_at: null,
    created_at: daysAgo(2),
    updated_at: daysAgo(1),
  },
  {
    id: uuid(1012),
    title: "Priya's profile score weights not persisting after lane_controls update",
    status: "open",
    priority: "medium",
    source: "user_report",
    reporter_id: PROFILES.priya,
    message: "Updated my lane_controls to de-prioritize 'Growth PM' and increase weight on 'Platform PM'. Changes appeared saved but next fetch still scored Growth PM roles equally.",
    metadata: { profile_id: PROFILES.priya, field: "lane_controls", expected_weight: 0.5, actual_weight: 1.0 },
    notes: [],
    resolved_at: null,
    created_at: hoursAgo(6),
    updated_at: hoursAgo(6),
  },
];

// ─── User Events (Audit Log) ───────────────────────────────────────────────

function makeEvents() {
  const events: Array<Record<string, unknown>> = [];
  let id = 2001;

  const add = (user_id: string, event_type: string, metadata: object, hours: number, success = true) => {
    events.push({
      id: uuid(id++),
      user_id,
      event_type,
      metadata,
      success,
      request_id: `req-demo-${id}`,
      created_at: hoursAgo(hours),
    });
  };

  // Admin events
  add(PROFILES.admin, "admin.fetch_triggered", { profiles: ["demo-luther", "demo-priya", "demo-marcus"], source_count: 10 }, 2);
  add(PROFILES.admin, "admin.profile_view", { profile_id: "demo-luther" }, 2.5);
  add(PROFILES.admin, "admin.profile_view", { profile_id: "demo-priya" }, 2.6);
  add(PROFILES.admin, "admin.profile_view", { profile_id: "demo-marcus" }, 2.7);
  add(PROFILES.admin, "admin.ticket_resolved", { ticket_id: uuid(1003) }, 4 * 24);
  add(PROFILES.admin, "admin.ticket_resolved", { ticket_id: uuid(1002) }, 5 * 24);
  add(PROFILES.admin, "admin.login", { ip: "204.45.12.88" }, 48);
  add(PROFILES.admin, "admin.login", { ip: "204.45.12.88" }, 24);
  add(PROFILES.admin, "admin.login", { ip: "204.45.12.88" }, 2);
  add(PROFILES.admin, "admin.job_bank_reviewed", { reviewed: 8, approved: 6, rejected: 2 }, 26);
  add(PROFILES.admin, "admin.message_sent", { template: "Weekly Digest", recipient_count: 2 }, 72);
  add(PROFILES.admin, "admin.message_sent", { template: "Interview Prep", recipient: "demo-luther" }, 6 * 24);
  add(PROFILES.admin, "admin.analytics_viewed", { date_range: "last_30_days" }, 3);
  add(PROFILES.admin, "admin.health_checked", { db_ms: 112, active_clients: 2, errors_unresolved: 4 }, 1);

  // Luther events
  add(PROFILES.luther, "client.login", { ip: "67.71.45.190" }, 25);
  add(PROFILES.luther, "client.login", { ip: "67.71.45.190" }, 1);
  add(PROFILES.luther, "client.inbox_viewed", { count: 14, page: 1 }, 1.1);
  add(PROFILES.luther, "client.job_promoted", { job_id: uuid(2), company: "Rippling", tier: "S" }, 2 * 24);
  add(PROFILES.luther, "client.job_promoted", { job_id: uuid(3), company: "HubSpot", tier: "A" }, 14 * 24);
  add(PROFILES.luther, "client.job_dismissed", { company: "Sun Life Financial", reason: "too junior" }, 8 * 24);
  add(PROFILES.luther, "client.job_dismissed", { company: "RBC", reason: "wrong category" }, 8 * 24);
  add(PROFILES.luther, "client.tracker_stage_changed", { company: "HubSpot", from: "Applied", to: "Interviewing" }, 6 * 24);
  add(PROFILES.luther, "client.tracker_viewed", { entry_count: 3 }, 1.2);
  add(PROFILES.luther, "client.good_fit_updated", { company: "Rippling", previous: null }, 2 * 24);
  add(PROFILES.luther, "client.ticket_submitted", { ticket_id: uuid(1002) }, 6 * 24);
  add(PROFILES.luther, "client.profile_viewed", {}, 25.5);

  // Priya events
  add(PROFILES.priya, "client.login", { ip: "98.42.220.14" }, 3);
  add(PROFILES.priya, "client.login", { ip: "98.42.220.14" }, 20 * 24);
  add(PROFILES.priya, "client.inbox_viewed", { count: 13, page: 1 }, 3.1);
  add(PROFILES.priya, "client.job_promoted", { job_id: uuid(14), company: "Stripe", tier: "S" }, 20 * 24);
  add(PROFILES.priya, "client.job_promoted", { job_id: uuid(15), company: "Forward", tier: "A" }, 15 * 24);
  add(PROFILES.priya, "client.tracker_stage_changed", { company: "Stripe", from: "Prospect", to: "Applied" }, 20 * 24);
  add(PROFILES.priya, "client.tracker_stage_changed", { company: "Stripe", from: "Applied", to: "Interviewing" }, 3 * 24);
  add(PROFILES.priya, "client.tracker_viewed", { entry_count: 3 }, 3.2);
  add(PROFILES.priya, "client.inbox_search", { query: "platform PM remote", results: 4 }, 3.5);
  add(PROFILES.priya, "client.ticket_submitted", { ticket_id: uuid(1004) }, 4 * 24);
  add(PROFILES.priya, "client.ticket_submitted", { ticket_id: uuid(1012) }, 6);
  add(PROFILES.priya, "client.good_fit_updated", { company: "Stripe", previous: null }, 20 * 24);

  // Marcus events
  add(PROFILES.marcus, "client.login", { ip: "72.198.46.11" }, 5);
  add(PROFILES.marcus, "client.login", { ip: "72.198.46.11" }, 28 * 24);
  add(PROFILES.marcus, "client.inbox_viewed", { count: 15, page: 1 }, 5.1);
  add(PROFILES.marcus, "client.job_promoted", { job_id: uuid(28), company: "Cloudflare", tier: "S" }, 28 * 24);
  add(PROFILES.marcus, "client.job_promoted", { job_id: uuid(29), company: "Stripe", tier: "S" }, 16 * 24);
  add(PROFILES.marcus, "client.job_promoted", { job_id: uuid(30), company: "Figma", tier: "A" }, 5 * 24);
  add(PROFILES.marcus, "client.tracker_stage_changed", { company: "Cloudflare", from: "Applied", to: "Interviewing" }, 4 * 24);
  add(PROFILES.marcus, "client.tracker_stage_changed", { company: "Figma", from: "Interviewing", to: "Prospect" }, 5 * 24);
  add(PROFILES.marcus, "client.tracker_viewed", { entry_count: 3 }, 5.2);
  add(PROFILES.marcus, "client.ticket_submitted", { ticket_id: uuid(1007) }, 24);
  add(PROFILES.marcus, "client.good_fit_updated", { company: "Cloudflare", previous: null }, 28 * 24);
  add(PROFILES.marcus, "client.inbox_search", { query: "staff engineer distributed systems", results: 5 }, 5.5);

  // Fetch events (system)
  add(PROFILES.admin, "system.fetch_batch_completed", { profile_id: "demo-luther", sources: 10, jobs_returned: 47, jobs_scored: 43, jobs_enriched: 41, duration_ms: 18200 }, 2);
  add(PROFILES.admin, "system.fetch_batch_completed", { profile_id: "demo-priya", sources: 10, jobs_returned: 52, jobs_scored: 49, jobs_enriched: 47, duration_ms: 19100 }, 2.1);
  add(PROFILES.admin, "system.fetch_batch_completed", { profile_id: "demo-marcus", sources: 10, jobs_returned: 61, jobs_scored: 58, jobs_enriched: 55, duration_ms: 20400 }, 2.2);

  return events;
}

// ─── Job Fetch Logs ────────────────────────────────────────────────────────

function makeFetchLogs() {
  const logs = [];
  let id = 3001;
  const sources = ["Remotive", "RemoteOK", "Jooble", "Adzuna US", "Adzuna CA", "USAJobs", "JSearch (RapidAPI)", "Gmail Ingest"];

  const profiles = [
    { id: PROFILES.luther, display: "demo-luther" },
    { id: PROFILES.priya, display: "demo-priya" },
    { id: PROFILES.marcus, display: "demo-marcus" },
  ];

  const batches = [
    { label: "batch-20250425-001", hours: 2 },
    { label: "batch-20250424-001", hours: 26 },
    { label: "batch-20250423-001", hours: 50 },
    { label: "batch-20250421-003", hours: 98 },
  ];

  for (const batch of batches) {
    for (const profile of profiles) {
      for (const source of sources) {
        const returned = Math.floor(Math.random() * 18) + 2;
        const afterDedupe = Math.floor(returned * 0.85);
        const scored = Math.floor(afterDedupe * 0.97);
        const enriched = Math.floor(scored * 0.94);
        const success = Math.random() > 0.06;
        logs.push({
          id: uuid(id++),
          profile_id: profile.id,
          batch_id: batch.label,
          source_name: source,
          search_term: `${profile.display} default`,
          jobs_returned: success ? returned : 0,
          jobs_after_dedupe: success ? afterDedupe : 0,
          jobs_scored: success ? scored : 0,
          jobs_enriched: success ? enriched : 0,
          success,
          error_message: success ? null : `${source} API timeout after 30000ms`,
          duration_ms: success ? Math.floor(Math.random() * 3200) + 800 : 30000,
          request_id: `req-demo-fetch-${id}`,
          created_at: hoursAgo(batch.hours + (Math.random() * 0.4)),
        });
      }
    }
  }
  return logs;
}

// ─── Error Logs ───────────────────────────────────────────────────────────

const errorLogs = [
  {
    id: uuid(4001),
    severity: "error",
    source_system: "adzuna-ca-adapter",
    message: "Adzuna CA returned 0 results for 'account executive toronto' — possible API parameter change",
    stack_trace: "Error: 0 results returned\n  at AdzunaCAAdapter.parse (adapters/adzuna-ca.ts:87)\n  at fetchBatch (lib/fetch/batch.ts:142)",
    user_id: PROFILES.admin,
    request_id: "req-demo-fetch-3091",
    metadata: { source: "Adzuna CA", search_term: "account executive toronto", status_code: 200, result_count: 0 },
    resolved: true,
    resolved_at: daysAgo(6),
    ticket_id: uuid(1001),
    created_at: daysAgo(7),
  },
  {
    id: uuid(4002),
    severity: "error",
    source_system: "openai-enrichment",
    message: "OpenAI enrichment batch timed out — 3 jobs stored with null why_fit",
    stack_trace: "Error: Request timeout after 30000ms\n  at enrichBatch (lib/enrich/openai.ts:54)\n  at Promise.allSettled",
    user_id: PROFILES.admin,
    request_id: "req-demo-fetch-3098",
    metadata: { batch_id: "batch-20250419-002", failed_urls: 3, source: "Jooble", timeout_ms: 30000 },
    resolved: true,
    resolved_at: daysAgo(4),
    ticket_id: uuid(1003),
    created_at: daysAgo(5),
  },
  {
    id: uuid(4003),
    severity: "warning",
    source_system: "rapidapi-jsearch",
    message: "JSearch rate limit reached — 3 requests queued and dropped",
    stack_trace: null,
    user_id: PROFILES.admin,
    request_id: "req-demo-fetch-3112",
    metadata: { rate_limit: "10 req/min", queue_dropped: 3, affected_profiles: ["demo-luther", "demo-marcus"] },
    resolved: false,
    resolved_at: null,
    ticket_id: uuid(1006),
    created_at: daysAgo(2),
  },
  {
    id: uuid(4004),
    severity: "error",
    source_system: "gmail-ingest",
    message: "Lever notification email parsed by wrong ATS parser — company_name and job_url extraction failed",
    stack_trace: "Error: field 'company_name' extracted as null\n  at GreenhouseParser.extract (lib/gmail/parsers/greenhouse.ts:33)\n  at classifyAndParse (lib/gmail/classify.ts:78)",
    user_id: PROFILES.admin,
    request_id: "req-demo-gmail-4021",
    metadata: { sender: "job-noreply@lever.co", parser_used: "greenhouse", expected: "lever", null_fields: ["company_name", "job_url"] },
    resolved: false,
    resolved_at: null,
    ticket_id: uuid(1011),
    created_at: daysAgo(2),
  },
  {
    id: uuid(4005),
    severity: "info",
    source_system: "cron-stale-jobs",
    message: "Stale job cleanup: 23 jobs marked stale, 8 archived",
    stack_trace: null,
    user_id: null,
    request_id: "req-demo-cron-5001",
    metadata: { marked_stale: 23, archived: 8, older_than_days: 14 },
    resolved: true,
    resolved_at: daysAgo(3),
    ticket_id: null,
    created_at: daysAgo(3),
  },
  {
    id: uuid(4006),
    severity: "warning",
    source_system: "supabase-auth",
    message: "Refresh token attempt with expired session — client redirected to login",
    stack_trace: null,
    user_id: PROFILES.priya,
    request_id: "req-demo-auth-6001",
    metadata: { profile_id: "demo-priya", token_age_days: 31, action: "redirect_to_login" },
    resolved: true,
    resolved_at: daysAgo(7),
    ticket_id: null,
    created_at: daysAgo(7),
  },
];

// ─── Seed runner ──────────────────────────────────────────────────────────

async function wipe() {
  console.log("Wiping existing demo data…");
  const demoProfileIds = Object.values(PROFILES);

  // Order matters for FK constraints
  await supabase.from("error_logs").delete().in("user_id", demoProfileIds);
  await supabase.from("error_logs").delete().is("user_id", null).like("request_id", "req-demo%");
  await supabase.from("job_fetch_logs").delete().in("profile_id", demoProfileIds);
  await supabase.from("user_events").delete().in("user_id", demoProfileIds);
  await supabase.from("tracker_entries").delete().in("profile_id", demoProfileIds);
  await supabase.from("inbox_jobs").delete().in("profile_id", demoProfileIds);
  await supabase.from("tickets").delete().in("reporter_id", demoProfileIds);
  await supabase.from("profiles").delete().in("id", demoProfileIds);

  console.log("  done.");
}

async function insert<T extends object>(table: string, rows: T[], label: string) {
  if (rows.length === 0) return;
  const { error } = await supabase.from(table).insert(rows as never[]);
  if (error) {
    console.error(`  ERROR inserting ${label}:`, error.message);
    throw error;
  }
  console.log(`  ${label}: ${rows.length} rows`);
}

export async function runDemoSeed(opts: { wipeOnly?: boolean } = {}): Promise<void> {
  initSupabase();
  console.log("\n=== Sygnalist Demo Seed ===\n");

  await wipe();
  if (opts.wipeOnly) {
    console.log("\n=== Wipe complete ===\n");
    return;
  }

  console.log("\nSeeding…");

  await insert("profiles", profiles, "profiles");

  // Build inbox jobs with IDs
  const buildJobs = (jobs: Omit<InboxJob, "id" | "profile_id">[], profileId: string, idOffset: number): InboxJob[] =>
    jobs.map((j, i) => ({ ...j, id: uuid(idOffset + i), profile_id: profileId }));

  const allJobs: InboxJob[] = [
    ...buildJobs(lutherJobs, PROFILES.luther, 100),
    ...buildJobs(priyaJobs, PROFILES.priya, 200),
    ...buildJobs(marcusJobs, PROFILES.marcus, 300),
  ];
  await insert("inbox_jobs", allJobs, "inbox_jobs");

  // Tracker entries
  const allTracker = [
    ...lutherTrackerEntries,
    ...priyaTrackerEntries,
    ...marcusTrackerEntries,
  ].map((t, i) => ({ ...t, id: uuid(500 + i) }));
  await insert("tracker_entries", allTracker, "tracker_entries");

  await insert("tickets", tickets, "tickets");

  const events = makeEvents();
  await insert("user_events", events, "user_events");

  const fetchLogs = makeFetchLogs();
  await insert("job_fetch_logs", fetchLogs, "job_fetch_logs");

  await insert("error_logs", errorLogs, "error_logs");

  console.log("\n=== Done ===\n");
  console.log("Demo credentials:");
  console.log("  Admin portal — use demo auth user (create separately via Supabase auth admin API)");
  console.log("  Clients viewable via admin impersonation: demo-luther, demo-priya, demo-marcus");
  console.log("  All data is hardcoded. No external API calls made.\n");
}

const isMainModule = (() => {
  try {
    const argv1 = process.argv[1];
    if (!argv1) return false;
    const url = new URL(import.meta.url);
    return url.pathname === argv1 || url.pathname.endsWith(argv1.replace(/^.*\//, ''));
  } catch {
    return false;
  }
})();

if (isMainModule) {
  const wipeOnly = process.env.WIPE_ONLY === '1';
  runDemoSeed({ wipeOnly }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
