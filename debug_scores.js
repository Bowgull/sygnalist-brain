function adminDebugScoresTop10_() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt("Debug Scores", "Enter profileId (e.g. p_91917494)", ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;

  const profileId = res.getResponseText().trim();
  const out = debugScoresTop10_(profileId);

  if (!out.ok) {
    ui.alert("❌ " + out.message);
    return;
  }

  // Pretty-ish alert, keep it short
  const lines = out.items.map((x, i) =>
    `${i + 1}) [${x.tier} ${x.score}] hits=${x.matchHits} • ${x.company} — ${x.title}\n${x.url}\n`
  );

  ui.alert(`📡 Score Debug (Top ${out.items.length})\n\n` + lines.join("\n"));
}

function debugScoresTop10_(profileId) {
  const profile = getProfileByIdOrThrow_(profileId);
  assertProfileActiveOrThrow_(profile);

  const plan = buildFetchRequestForProfile_(profile);

  let jobs = [];
  for (const source of plan.sources) {
    for (const term of plan.searchTerms) {
      try {
        jobs = jobs.concat(fetchFromSource_(source, term));
      } catch (e) {
        // ignore here; this is debug
      }
    }
  }

  jobs = dedupeJobs_(jobs);

  const classified = classifyJobsForProfile_(jobs, profile);
  const scored = scoreJobsForProfile_(classified, profile)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const items = scored.map(j => ({
    score: j.score,
    tier: j.tier,
    matchHits: j.matchHits || 0,
    company: j.company,
    title: j.title,
    url: j.url
  }));

  return { ok: true, version: Sygnalist_VERSION, items };
}
