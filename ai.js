/****************************************************
 * ai.js — OpenAI helper (Chat Completions API)
 * 
 * Features:
 *  - Single request: aiRequest_(prompt, model)
 *  - Batch parallel requests: aiBatchRequest_(prompts, model)
 *  - Retry with exponential backoff
 * 
 * Requires:
 *  - Script Property: OPENAI_API_KEY
 *  - getAPIKey_(name) from core_utils.js
 *  - CONFIG.OPENAI_MODEL from config.js
 ****************************************************/

// AI settings are now in CONFIG (config.js)
// Fallback values in case CONFIG isn't loaded
function getAiConfig_() {
  return {
    MAX_RETRIES: (CONFIG && CONFIG.AI_MAX_RETRIES) || 3,
    RETRY_DELAY_MS: (CONFIG && CONFIG.AI_RETRY_DELAY_MS) || 1000,
    TEMPERATURE: (CONFIG && CONFIG.AI_TEMPERATURE) || 0.7,
    MAX_TOKENS: (CONFIG && CONFIG.AI_MAX_TOKENS) || 1500
  };
}

/**
 * Build a fetch request object for OpenAI (without executing)
 */
function buildAiRequest_(prompt, model, apiKey) {
  const url = "https://api.openai.com/v1/chat/completions";
  const aiConfig = getAiConfig_();
  
  const payload = {
    model: model || (CONFIG && CONFIG.OPENAI_MODEL ? CONFIG.OPENAI_MODEL : "gpt-4o-mini"),
    messages: [
      {
        role: "user",
        content: String(prompt || "")
      }
    ],
    temperature: aiConfig.TEMPERATURE,
    max_tokens: aiConfig.MAX_TOKENS
  };

  return {
    url: url,
    method: "post",
    contentType: "application/json",
    muteHttpExceptions: true,
    headers: {
      "Authorization": "Bearer " + apiKey
    },
    payload: JSON.stringify(payload)
  };
}

/**
 * Parse an OpenAI response object
 * Returns: { ok: true, text: string } or { ok: false, error: string }
 */
function parseAiResponse_(resp) {
  try {
    const code = resp.getResponseCode();
    const bodyText = resp.getContentText();

    if (code < 200 || code >= 300) {
      let errMsg = bodyText;
      try {
        const errData = JSON.parse(bodyText);
        if (errData && errData.error && errData.error.message) {
          errMsg = errData.error.message;
        }
      } catch (e) { /* ignore parse error */ }
      return { ok: false, error: "HTTP " + code + ": " + errMsg };
    }

    const data = JSON.parse(bodyText);
    let out = "";
    if (data && data.choices && data.choices.length > 0) {
      const choice = data.choices[0];
      if (choice.message && choice.message.content) {
        out = choice.message.content;
      }
    }

    if (!out) {
      return { ok: false, error: "Empty response" };
    }

    return { ok: true, text: String(out).trim() };
  } catch (e) {
    return { ok: false, error: "Parse error: " + e.message };
  }
}

/**
 * Single AI request with retry logic
 * Returns: { ok: true, text: string, raw: object }
 */
function aiRequest_(prompt, model) {
  const apiKey = getAPIKey_("OPENAI_API_KEY");
  const request = buildAiRequest_(prompt, model, apiKey);
  const aiConfig = getAiConfig_();

  let lastError = null;
  
  for (let attempt = 0; attempt < aiConfig.MAX_RETRIES; attempt++) {
    try {
      const resp = UrlFetchApp.fetch(request.url, request);
      const result = parseAiResponse_(resp);
      
      if (result.ok) {
        return {
          ok: true,
          text: result.text,
          raw: null  // Not storing raw to save memory
        };
      }
      
      // Check if error is retryable (rate limit, server error)
      if (result.error.includes("429") || result.error.includes("5")) {
        lastError = result.error;
        // Exponential backoff
        Utilities.sleep(aiConfig.RETRY_DELAY_MS * Math.pow(2, attempt));
        continue;
      }
      
      // Non-retryable error
      throw new Error("OpenAI request failed: " + result.error);
      
    } catch (e) {
      if (e.message.includes("OpenAI request failed")) {
        throw e;  // Don't retry application errors
      }
      lastError = e.message;
      Utilities.sleep(aiConfig.RETRY_DELAY_MS * Math.pow(2, attempt));
    }
  }
  
  throw new Error("OpenAI request failed after " + aiConfig.MAX_RETRIES + " retries: " + lastError);
}

/**
 * Batch AI request - sends multiple prompts in PARALLEL
 * Returns: Array of { ok: true, text: string } or { ok: false, error: string }
 * 
 * This is MUCH faster than sequential requests:
 * - 25 jobs × 2s each = 50s sequential
 * - 25 jobs parallel = ~5-10s
 */
function aiBatchRequest_(prompts, model) {
  if (!prompts || !prompts.length) return [];
  
  const apiKey = getAPIKey_("OPENAI_API_KEY");
  
  // Build all requests
  const requests = prompts.map(prompt => buildAiRequest_(prompt, model, apiKey));
  
  // Execute all in parallel
  let responses;
  try {
    responses = UrlFetchApp.fetchAll(requests);
  } catch (e) {
    // If batch fails, return all errors
    return prompts.map(() => ({ ok: false, error: "Batch fetch failed: " + e.message }));
  }
  
  // Parse all responses
  return responses.map(resp => parseAiResponse_(resp));
}
