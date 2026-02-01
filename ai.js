/****************************************************
 * ai.gs — OpenAI helper (Chat Completions API)
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
  const url = "https://api.openai.com/v1/chat/completions";

  const payload = {
    model: model || (CONFIG && CONFIG.OPENAI_MODEL ? CONFIG.OPENAI_MODEL : "gpt-4o-mini"),
    messages: [
      {
        role: "user",
        content: String(prompt || "")
      }
    ],
    temperature: 0.7,
    max_tokens: 2000
  };

  const options = {
    method: "post",
    contentType: "application/json",
    muteHttpExceptions: true,
    headers: {
      "Authorization": "Bearer " + apiKey
    },
    payload: JSON.stringify(payload)
  };

  let resp;
  try {
    resp = UrlFetchApp.fetch(url, options);
  } catch (e) {
    throw new Error("OpenAI request failed (network): " + e.message);
  }

  const code = resp.getResponseCode();
  const bodyText = resp.getContentText();

  if (code < 200 || code >= 300) {
    // Parse error message if possible
    let errMsg = bodyText;
    try {
      const errData = JSON.parse(bodyText);
      if (errData && errData.error && errData.error.message) {
        errMsg = errData.error.message;
      }
    } catch (e) { /* ignore parse error */ }
    throw new Error("OpenAI request failed (" + code + "): " + errMsg);
  }

  const data = JSON.parse(bodyText);

  // Extract text from Chat Completions response
  let out = "";
  if (data && data.choices && data.choices.length > 0) {
    const choice = data.choices[0];
    if (choice.message && choice.message.content) {
      out = choice.message.content;
    }
  }

  if (!out) {
    throw new Error("OpenAI returned empty response. Raw: " + bodyText.slice(0, 300));
  }

  return {
    ok: true,
    text: String(out).trim(),
    raw: data
  };
}
