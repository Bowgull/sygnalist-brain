export type TourStep = {
  route?: string;
  selector: string;
  title: string;
  body: string;
  side?: "top" | "right" | "bottom" | "left" | "over";
  align?: "start" | "center" | "end";
};

export type TourId = "engine-room" | "client-view";

export type Tour = {
  id: TourId;
  label: string;
  blurb: string;
  duration: string;
  steps: TourStep[];
};

const ENGINE_ROOM: Tour = {
  id: "engine-room",
  label: "The engine room",
  blurb: "14 sources, scoring math, ingest pipelines, error logs.",
  duration: "~2 min",
  steps: [
    {
      route: "/admin/clients",
      selector: "[data-tour='profile-switcher']",
      title: "Profile switcher",
      body: "Multi-tenant from day one. Each row is a client. View as them and every API call follows. Inbox, tracker, fetch, scoring. No data bleeds.",
    },
    {
      route: "/admin/lanes",
      selector: "[data-tour='lanes-list']",
      title: "Sources",
      body: "Fourteen job boards in parallel. LinkedIn, Indeed, Greenhouse, Lever, Ashby, Wellfound, RemoteOK, Workable, The Muse, We Work Remotely, Remotive, Himalayas, Jobicy, Adzuna, Jooble. Lanes drive what each one searches for. Role tracks become queries. Queries become jobs. Jobs become signal.",
    },
    {
      route: "/inbox",
      selector: "[data-tour='goodfit-score']",
      title: "GoodFit scoring",
      body: "Every job scored 0 to 100 against your resume, lanes, location, work mode, salary floor, language, seniority. Tiered S, A, B, C, F at 85, 70, 55, 35. Match hits visible on the card. The score is the math, not the vibe.",
    },
    {
      route: "/inbox",
      selector: "[data-tour='scan-button']",
      title: "Scan",
      body: "Fires the orchestrator across all enabled sources. The toast reports jobs scanned, deduped, delivered, runtime in milliseconds. Every fetch logged. Every dedupe traceable.",
    },
    {
      route: "/admin/ingest",
      selector: "[data-tour='gmail-ingest']",
      title: "Gmail ingest",
      body: "Recruiter emails parse into structured jobs automatically. Subject, sender, body, links, all normalized into the same schema as scanned jobs. One inbox, two intake paths. Dedupe by Gmail message ID.",
    },
    {
      route: "/admin/onboard",
      selector: "[data-tour='resume-parse']",
      title: "Resume parse",
      body: "Upload a PDF. Skills, role tracks, dates extracted into the profile. Lanes auto-match against the role bank. The scoring runs against this, not against guesses.",
    },
    {
      route: "/messages",
      selector: "[data-tour='message-thread']",
      title: "Message hub",
      body: "Recruiter threads grouped by subject. Quoted text stripped. AI-generated reply suggestions per thread. View as any client to see their mail in their voice.",
    },
    {
      route: "/admin/logs",
      selector: "[data-tour='logs-panel']",
      title: "Logs and analytics",
      body: "Every fetch, every error, every dedupe, with stack and timestamp. Weekly and monthly counts. System health. The pattern tells the truth, not the plan. That's the engine.",
    },
  ],
};

const CLIENT_VIEW: Tour = {
  id: "client-view",
  label: "The client view",
  blurb: "What Luther, Priya, and Marcus see. Inbox, scores, pipeline.",
  duration: "~90 sec",
  steps: [
    {
      route: "/inbox",
      selector: "[data-tour='inbox-list']",
      title: "Inbox",
      body: "New jobs land here, sorted into lanes. Each card shows the source it came from and the GoodFit score. Promote moves it to the tracker. Dismiss closes it with a reason.",
    },
    {
      route: "/inbox",
      selector: "[data-tour='goodfit-score']",
      title: "GoodFit on the card",
      body: "Score 0 to 100. Tier badge S, A, B, C, F. S is 85 plus, A is 70 plus, B is 55 plus, C is 35 plus, F is below. Match hits show what scored. Read the number, not the title.",
    },
    {
      route: "/inbox",
      selector: "[data-tour='source-badge']",
      title: "Source badge",
      body: "Every job tagged with where it came from. Fourteen sources in the rotation. The badge is how you know it's not all LinkedIn.",
    },
    {
      route: "/inbox",
      selector: "[data-tour='promote-button']",
      title: "Promote",
      body: "One tap, job moves to the tracker at Prospect. Toast confirms. Inbox shrinks. The decision is logged.",
    },
    {
      route: "/tracker",
      selector: "[data-tour='tracker-views']",
      title: "Tracker",
      body: "Pipeline from Prospect to Offer. Cards view groups by stage. Ops view is a Kanban with drag and drop. Closed (rejected, ghosted, withdrawn) collapses to keep the active pipeline clean.",
    },
    {
      route: "/tracker",
      selector: "[data-tour='stage-pills']",
      title: "Stage pills",
      body: "Tap a stage to focus. Counts update live. The colored dot is the stage's identity, consistent across views. That's the surface.",
    },
  ],
};

export const TOURS: Record<TourId, Tour> = {
  "engine-room": ENGINE_ROOM,
  "client-view": CLIENT_VIEW,
};
