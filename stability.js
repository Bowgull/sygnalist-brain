function withProfileLock_(profileId, op, fn) {
  const lock = LockService.getScriptLock();
  const key = `syg:${String(profileId)}:${String(op)}`;

  // We can’t name locks, so we just use a single script lock + short wait.
  // Still good enough for “don’t let 10 people smash fetch at once”.
  const ok = lock.tryLock(25 * 1000);
  if (!ok) throw new Error(uiError_("RATE_LIMITED", "System busy. Try again in 30s.").message);

  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

// Per-profile cooldown for external actions (fetch/enrich/promote/manual_add)
function assertNotThrottled_(profileId, op, cooldownMs) {
  const props = PropertiesService.getScriptProperties();
  const k = `throttle:${String(profileId)}:${String(op)}`;
  const now = Date.now();
  const last = Number(props.getProperty(k) || 0);

  if (last && (now - last) < cooldownMs) {
    const waitSec = Math.ceil((cooldownMs - (now - last)) / 1000);
    throw new Error(uiError_("RATE_LIMITED", `Slow down. Try again in ${waitSec}s.`).message);
  }

  props.setProperty(k, String(now));
}

function newBatchId_() {
  return "b_" + Utilities.getUuid().slice(0, 12);
}
