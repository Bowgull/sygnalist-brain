export interface ParsedResume {
  display_name: string;
  current_city: string;
  top_skills: string[];
  skill_keywords_plus: string[];
  role_tracks: Array<{ label: string; roleKeywords: string[]; priorityWeight: number }>;
  preferred_locations: string[];
  accept_remote: boolean;
  accept_hybrid: boolean;
  accept_onsite: boolean;
  salary_estimate: string;
  summary: string;
  signature_stories: string[];
  experience_years: number;
  education: string;
  lane_controls?: Array<{ laneKey: string; laneLabel: string; enabled: boolean; roles: string[] }>;
}
