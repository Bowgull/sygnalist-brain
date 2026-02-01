/****************************************************
 * ai.gs — OpenAI helper (Responses API)
 * Requires:
 *  - Script Property: OPENAI_API_KEY
 *  - getAPIKey_(name) already exists
 *  - CONFIG.OPENAI_MODEL exists (or pass model explicitly)
 ****************************************************/

/**
 * aiRequest_(prompt, model?)
 * Returns: { ok: true, text: string, raw: object }
 */
function aiRequest_(prompt, model) {
  const apiKey = getAPIKey_("OPENAI_API_KEY");
  const url = "https://api.openai.com/v1/responses";

  const payload = {
    model: model || (CONFIG && CONFIG.OPENAI_MODEL ? CONFIG.OPENAI_MODEL : "gpt-4o-mini"),
    input: String(prompt || "")
  };

  const resp = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    muteHttpExceptions: true,
    headers: {
      Authorization: "Bearer " + apiKey
    },
    payload: JSON.stringify(payload)
  });

  const code = resp.getResponseCode();
  const bodyText = resp.getContentText();

  if (code < 200 || code >= 300) {
    // Keep it loud + useful.
    throw new Error("OpenAI request failed (" + code + "): " + bodyText);
  }

  const data = JSON.parse(bodyText);

  // Extract text from Responses API output safely.
  let out = "";
  if (data && Array.isArray(data.output)) {
    for (var i = 0; i < data.output.length; i++) {
      var item = data.output[i];
      if (item && item.type === "message" && Array.isArray(item.content)) {
        for (var j = 0; j < item.content.length; j++) {
          var c = item.content[j];
          if (c && c.type === "output_text" && c.text) out += c.text;
        }
      }
    }
  }

  return {
    ok: true,
    text: String(out || "").trim(),
    raw: data
  };
}
