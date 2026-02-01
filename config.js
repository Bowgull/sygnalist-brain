const CONFIG = {
  Sygnalist_VERSION: "1.2.0",

  MAX_JOBS_PER_FETCH: 25,
  MIN_SCORE_FOR_INBOX: 60,
  MAX_DESC_CHARS_FOR_AI: 4000,

  OPENAI_MODEL: "gpt-4o-mini",

  DEFAULT_SOURCES: ["remotive", "remoteok"],

  HEALTHCHECK_TIMEOUT_MS: 8000,

  ENGINE_ONLY_MODE: true
};

const FLAGS = {
  ENABLE_WEWORKREMOTELY: false,
  ENABLE_GREENHOUSE: false,
  ENABLE_LEVER: false
};

const Sygnalist_VERSION = CONFIG.Sygnalist_VERSION;


