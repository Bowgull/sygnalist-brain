/**
 * DebugAdminInline.gs
 * Single runnable: debug_admin_inline — run from Apps Script editor to test admin script inlining.
 * In the editor, select this file, choose debug_admin_inline from the dropdown, click Run.
 */

function debug_admin_inline() {
  try {
    const raw = HtmlService.createHtmlOutputFromFile("admin_tab_script").getContent();
    const b64 = Utilities.base64Encode(Utilities.newBlob(raw).getBytes());
    return {
      ok: true,
      lenRaw: raw.length,
      lenB64: b64.length,
      head: raw.slice(0, 160)
    };
  } catch (e) {
    return {
      ok: false,
      name: e && e.name,
      message: e && e.message,
      stack: String(e && e.stack || "")
    };
  }
}
