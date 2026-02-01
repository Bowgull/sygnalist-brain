function getAPIKey_(name) {
  const key = PropertiesService
    .getScriptProperties()
    .getProperty(name);

  if (!key) {
    throw new Error(name + " not set in Script Properties");
  }

  return key;
}
