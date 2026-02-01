function uiError_(code, message, meta) {
  return {
    ok: false,
    code: code,
    message: message,
    meta: meta || {},
    version: Sygnalist_VERSION
  };
}
