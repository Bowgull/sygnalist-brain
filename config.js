const CONFIG = {
  // ═══════════════════════════════════════════════════════════════════════════
  // VERSION
  // ═══════════════════════════════════════════════════════════════════════════
  Sygnalist_VERSION: "1.3.0",  // Bumped for parallel enrichment update

  // ═══════════════════════════════════════════════════════════════════════════
  // FETCH & SCORING
  // ═══════════════════════════════════════════════════════════════════════════
  MAX_JOBS_PER_FETCH: 25,
  MIN_SCORE_FOR_INBOX: 60,
  DEFAULT_SOURCES: ["adzuna_us", "adzuna_ca", "usajobs", "jooble", "remotive", "remoteok"],
  FALLBACK_TERMS: ["customer service", "administrative", "entry level"],
  MIN_JOBS_BEFORE_FALLBACK: 3,
  LAST_DITCH_SOURCES: ["remotive", "remoteok"],
  LAST_DITCH_TERMS: ["remote", "software", "customer success"],

  // ═══════════════════════════════════════════════════════════════════════════
  // AI / OPENAI SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════
  OPENAI_MODEL: "gpt-4o-mini",
  MAX_DESC_CHARS_FOR_AI: 2500,  // Reduced from 4000 to save tokens
  AI_TEMPERATURE: 0.7,
  AI_MAX_TOKENS: 1500,
  AI_MAX_RETRIES: 3,
  AI_RETRY_DELAY_MS: 1000,

  // ═══════════════════════════════════════════════════════════════════════════
  // STABILITY / THROTTLING
  // ═══════════════════════════════════════════════════════════════════════════
  LOCK_TIMEOUT_MS: 25000,        // Max time to wait for lock
  FETCH_THROTTLE_MS: 45000,      // Cooldown between fetches
  PROMOTE_THROTTLE_MS: 1500,     // Cooldown between promotes
  TRACKER_UPDATE_THROTTLE_MS: 800,

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════
  MIN_RESUME_CHARS: 100,         // Minimum characters for resume text

  // ═══════════════════════════════════════════════════════════════════════════
  // HEALTH CHECK
  // ═══════════════════════════════════════════════════════════════════════════
  HEALTHCHECK_TIMEOUT_MS: 8000,

  // ═══════════════════════════════════════════════════════════════════════════
  // MODES
  // ═══════════════════════════════════════════════════════════════════════════
  ENGINE_ONLY_MODE: true,

  // ═══════════════════════════════════════════════════════════════════════════
  // URLS & EXTERNAL
  // ═══════════════════════════════════════════════════════════════════════════
  // Web App base URL (from Apps Script Deploy > Manage deployments)
  WEB_APP_URL: "https://script.google.com/macros/s/AKfycbzyhZiI06NnO8vUu7MeVDSVYjkHc99-F0wg9fYMbJ7LdNs6AGUCe-AfaQTZR6cl8nQN/exec",

  // Logs Export - set this to your Logs Export Google Sheet ID
  // Leave empty to be prompted each time
  LOGS_EXPORT_SPREADSHEET_ID: ""
};

const FLAGS = {
  ENABLE_WEWORKREMOTELY: false,
  ENABLE_GREENHOUSE: false,
  ENABLE_LEVER: false
};

const Sygnalist_VERSION = CONFIG.Sygnalist_VERSION;


