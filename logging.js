/****************************************************
 * logging.js
 * Core logging to 📓 Logs sheet
 * 
 * For pretty export, see: logs_export.js
 ****************************************************/

function logEvent_(event) {
  const sheet = assertSheetExists_("📓 Logs");

  const row = [
    new Date(event.timestamp || Date.now()),
    event.profileId || null,
    event.action || null,
    event.source || null,
    JSON.stringify(event.details || {})
  ];

  sheet.appendRow(row);
}
