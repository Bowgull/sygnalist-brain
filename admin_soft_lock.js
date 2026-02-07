/****************************************************
 * admin_soft_lock.gs
 * Admin controls for soft-locking profiles (Blueprint 11.1)
 ****************************************************/

function adminPromptSoftLockProfile_() {
  const ui = SpreadsheetApp.getUi();

  const idRes = ui.prompt("Soft-lock profile", "Enter profileId (e.g., p_1234abcd)", ui.ButtonSet.OK_CANCEL);
  if (idRes.getSelectedButton() !== ui.Button.OK) return;

  const profileId = String(idRes.getResponseText() || "").trim();
  if (!profileId) return ui.alert("No profileId provided.");

  const reasonRes = ui.prompt("Soft-lock reason", "Why are we locking this profile?", ui.ButtonSet.OK_CANCEL);
  if (reasonRes.getSelectedButton() !== ui.Button.OK) return;

  const reason = String(reasonRes.getResponseText() || "").trim();
  if (!reason) return ui.alert("Reason is required.");

  const out = softLockProfile_(profileId, reason);
  if (!out.ok) return ui.alert("❌ " + out.error);

  ui.alert(`✅ Soft-locked: ${profileId}\nReason: ${reason}`);
}

function adminPromptUnlockProfile_() {
  const ui = SpreadsheetApp.getUi();

  const idRes = ui.prompt("Unlock profile", "Enter profileId (e.g., p_1234abcd)", ui.ButtonSet.OK_CANCEL);
  if (idRes.getSelectedButton() !== ui.Button.OK) return;

  const profileId = String(idRes.getResponseText() || "").trim();
  if (!profileId) return ui.alert("No profileId provided.");

  const out = unlockProfile_(profileId);
  if (!out.ok) return ui.alert("❌ " + out.error);

  ui.alert(`✅ Unlocked: ${profileId}`);
}

/**
 * Soft-lock: status=inactive_soft_locked + statusReason=<reason>
 */
function softLockProfile_(profileId, reason) {
  try {
    const pid = String(profileId || "").trim();
    const why = String(reason || "").trim();
    if (!pid) throw new Error("profileId is empty.");
    if (!why) throw new Error("statusReason is required.");

    const sh = assertSheetExists_("Admin_Profiles");
    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();
    if (lastRow < 2 || lastCol < 1) throw new Error("Admin_Profiles has no data.");
    const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
    if (!values || values.length < 2) throw new Error("Admin_Profiles has no data.");

    const headers = values[0].map(h => String(h).trim());
    const idxId = headers.indexOf("profileId");
    const idxStatus = headers.indexOf("status");
    const idxReason = headers.indexOf("statusReason");

    if (idxId === -1) throw new Error("Admin_Profiles missing header: profileId");
    if (idxStatus === -1) throw new Error("Admin_Profiles missing header: status");
    if (idxReason === -1) throw new Error("Admin_Profiles missing header: statusReason");

    let rowIndex = -1;
    for (let r = 1; r < values.length; r++) {
      if (String(values[r][idxId] || "").trim() === pid) {
        rowIndex = r;
        break;
      }
    }
    if (rowIndex === -1) throw new Error("Profile not found: " + pid);

    const rowNum = rowIndex + 1;
    sh.getRange(rowNum, idxStatus + 1).setValue("inactive_soft_locked");
    sh.getRange(rowNum, idxReason + 1).setValue(why);

    logEvent_({
      timestamp: Date.now(),
      profileId: pid,
      action: "admin",
      source: "soft_lock",
      details: {
        level: "WARN",
        message: "Profile soft-locked",
        meta: { profileId: pid, status: "inactive_soft_locked", reason: why },
        version: Sygnalist_VERSION
      }
    });

    return { ok: true, version: Sygnalist_VERSION };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e), version: Sygnalist_VERSION };
  }
}

/**
 * Unlock: status=active + statusReason=""
 */
function unlockProfile_(profileId) {
  try {
    const pid = String(profileId || "").trim();
    if (!pid) throw new Error("profileId is empty.");

    const sh = assertSheetExists_("Admin_Profiles");
    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();
    if (lastRow < 2 || lastCol < 1) throw new Error("Admin_Profiles has no data.");
    const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
    if (!values || values.length < 2) throw new Error("Admin_Profiles has no data.");

    const headers = values[0].map(h => String(h).trim());
    const idxId = headers.indexOf("profileId");
    const idxStatus = headers.indexOf("status");
    const idxReason = headers.indexOf("statusReason");

    if (idxId === -1) throw new Error("Admin_Profiles missing header: profileId");
    if (idxStatus === -1) throw new Error("Admin_Profiles missing header: status");
    if (idxReason === -1) throw new Error("Admin_Profiles missing header: statusReason");

    let rowIndex = -1;
    for (let r = 1; r < values.length; r++) {
      if (String(values[r][idxId] || "").trim() === pid) {
        rowIndex = r;
        break;
      }
    }
    if (rowIndex === -1) throw new Error("Profile not found: " + pid);

    const rowNum = rowIndex + 1;
    sh.getRange(rowNum, idxStatus + 1).setValue("active");
    sh.getRange(rowNum, idxReason + 1).setValue("");

    logEvent_({
      timestamp: Date.now(),
      profileId: pid,
      action: "admin",
      source: "soft_lock",
      details: {
        level: "INFO",
        message: "Profile unlocked",
        meta: { profileId: pid, status: "active" },
        version: Sygnalist_VERSION
      }
    });

    return { ok: true, version: Sygnalist_VERSION };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e), version: Sygnalist_VERSION };
  }
}
