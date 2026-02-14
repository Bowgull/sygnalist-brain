/**
 * admin_profiles_onedit.js
 * onEdit handler for Admin_Profiles: validate and enforce status + isAdmin changes; audit log.
 */

function onEdit(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  if (sheet.getName() !== "Admin_Profiles") return;
  if (e.range.getRow() < 2) return;
  if (e.range.getNumRows() !== 1 || e.range.getNumColumns() !== 1) return;

  var col = e.range.getColumn();
  var row = e.range.getRow();
  var newValue = e.value != null ? String(e.value).trim() : "";
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return String(h || "").trim(); });
  var colName = headers[col - 1];
  var idxId = headers.indexOf("profileId");
  var idxStatus = headers.indexOf("status");
  var idxReason = headers.indexOf("statusReason");
  var idxAdmin = headers.indexOf("isAdmin");
  if (idxId === -1) return;

  var profileId = String(sheet.getRange(row, idxId + 1).getValue() || "").trim();
  if (!profileId) return;

  if (colName === "status") {
    if (idxStatus === -1) return;
    var allowed = ["active", "inactive_soft_locked"];
    if (allowed.indexOf(newValue) === -1) {
      e.range.getSheet().toast("Status must be: active or inactive_soft_locked", "Invalid");
      e.range.setValue(e.oldValue != null ? e.oldValue : "");
      return;
    }
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) {
      sheet.toast("System busy. Try again.", "Lock");
      e.range.setValue(e.oldValue != null ? e.oldValue : "");
      return;
    }
    try {
      if (newValue === "inactive_soft_locked") {
        var reason = idxReason >= 0 ? String(sheet.getRange(row, idxReason + 1).getValue() || "").trim() : "";
        if (!reason) reason = "Set via sheet";
        softLockProfile_(profileId, reason);
      } else {
        unlockProfile_(profileId);
      }
    } catch (err) {
      sheet.toast(err.message || "Update failed", "Error");
      e.range.setValue("active");
    } finally {
      lock.releaseLock();
    }
    return;
  }

  if (colName === "isAdmin") {
    if (idxAdmin === -1) return;
    var allowedAdmin = ["TRUE", "FALSE"];
    var norm = newValue.toUpperCase();
    if (norm !== "TRUE" && norm !== "FALSE") {
      sheet.toast("isAdmin must be TRUE or FALSE", "Invalid");
      e.range.setValue("FALSE");
      return;
    }
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) {
      sheet.toast("System busy. Try again.", "Lock");
      return;
    }
    try {
      e.range.setValue(norm);
      logEvent_({
        timestamp: Date.now(),
        profileId: profileId,
        action: "admin",
        source: "admin_profiles",
        details: {
          level: "INFO",
          message: "Admin set via sheet: isAdmin = " + norm,
          meta: { profileId: profileId, isAdmin: norm },
          version: typeof Sygnalist_VERSION !== "undefined" ? Sygnalist_VERSION : ""
        }
      });
    } finally {
      lock.releaseLock();
    }
  }
}
