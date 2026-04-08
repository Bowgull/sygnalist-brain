/** Detect the original job board from a job URL */

export interface Board {
  name: string;
  color: string;
}

const BOARD_MAP: Array<{ pattern: string; board: Board }> = [
  { pattern: "linkedin.com", board: { name: "LinkedIn", color: "#0A66C2" } },
  { pattern: "indeed.com", board: { name: "Indeed", color: "#2557A7" } },
  { pattern: "ziprecruiter.com", board: { name: "ZipRecruiter", color: "#25BA00" } },
  { pattern: "glassdoor.com", board: { name: "Glassdoor", color: "#0CAA41" } },
  { pattern: "wellfound.com", board: { name: "Wellfound", color: "#BD5FFF" } },
  { pattern: "angel.co", board: { name: "Wellfound", color: "#BD5FFF" } },
  { pattern: "lever.co", board: { name: "Lever", color: "#7C8DB0" } },
  { pattern: "greenhouse.io", board: { name: "Greenhouse", color: "#3B8427" } },
  { pattern: "workday.com", board: { name: "Workday", color: "#005CB9" } },
  { pattern: "myworkdayjobs.com", board: { name: "Workday", color: "#005CB9" } },
  { pattern: "smartrecruiters.com", board: { name: "SmartRecruiters", color: "#10B981" } },
  { pattern: "ashbyhq.com", board: { name: "Ashby", color: "#6366F1" } },
  { pattern: "icims.com", board: { name: "iCIMS", color: "#0071CE" } },
  { pattern: "jobvite.com", board: { name: "Jobvite", color: "#FF6D2E" } },
  { pattern: "dice.com", board: { name: "Dice", color: "#EB1C26" } },
  { pattern: "remotive.com", board: { name: "Remotive", color: "#FF4655" } },
  { pattern: "remoteok.com", board: { name: "RemoteOK", color: "#FF4742" } },
  { pattern: "weworkremotely.com", board: { name: "WeWorkRemotely", color: "#1C1C1C" } },
  { pattern: "himalayas.app", board: { name: "Himalayas", color: "#6366F1" } },
  { pattern: "builtin.com", board: { name: "BuiltIn", color: "#2563EB" } },
  { pattern: "themuse.com", board: { name: "TheMuse", color: "#FF6B35" } },
  { pattern: "otta.com", board: { name: "Otta", color: "#1A1A2E" } },
];

export function detectBoard(url: string | null): Board | null {
  if (!url) return null;
  const lower = url.toLowerCase();
  for (const { pattern, board } of BOARD_MAP) {
    if (lower.includes(pattern)) return board;
  }
  return null;
}
