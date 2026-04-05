/** Strip em dashes, en dashes, and figure dashes from text. */
export function stripDashes(text: string): string {
  if (!text) return text;
  return text
    .replace(/[\u2014\u2013\u2012]/g, " - ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
