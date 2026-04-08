export async function extractText(file: File): Promise<string> {
  // Plain text / markdown
  if (file.type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
    return (await file.text()).slice(0, 15000);
  }

  // PDF
  if (file.name.endsWith(".pdf") || file.type === "application/pdf") {
    const extractPdf = async (): Promise<string> => {
      const { extractText: extractPdfText, getDocumentProxy } = await import("unpdf");
      const buffer = new Uint8Array(await file.arrayBuffer());
      const pdf = await getDocumentProxy(buffer);
      const { text } = await extractPdfText(pdf, { mergePages: true });
      await pdf.destroy();
      const trimmed = text.trim();
      if (trimmed.length >= 50) return trimmed.slice(0, 15000);
      throw new Error("Could not extract text from PDF. It may be image-based or scanned. Try pasting the text directly.");
    };
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("PDF extraction timed out. Try pasting the text directly.")), 15000),
    );
    return Promise.race([extractPdf(), timeout]);
  }

  // Docx - extract text using mammoth
  if (file.name.endsWith(".docx") || file.type.includes("wordprocessingml")) {
    const extractDocx = async (): Promise<string> => {
      const mammoth = await import("mammoth");
      const buffer = Buffer.from(await file.arrayBuffer());
      const { value: text } = await mammoth.extractRawText({ buffer });
      const trimmed = text.trim();
      if (trimmed.length >= 50) return trimmed.slice(0, 15000);
      throw new Error("Could not extract text from Word document. It may be image-based or corrupted. Try pasting the text directly.");
    };
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Word document extraction timed out. Try pasting the text directly.")), 15000),
    );
    return Promise.race([extractDocx(), timeout]);
  }

  // Fallback: try raw text
  const raw = (await file.text()).slice(0, 15000);
  if (looksLikeReadableText(raw)) return raw;
  throw new Error("Could not extract readable text from this file. Try pasting the resume text directly.");
}

/**
 * Check if text looks like readable content (not binary garbage).
 * Returns true if the text has a high ratio of printable ASCII characters.
 */
function looksLikeReadableText(text: string): boolean {
  if (text.length < 50) return false;
  const sample = text.slice(0, 1000);
  let printable = 0;
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    if ((code >= 32 && code <= 126) || code === 9 || code === 10 || code === 13) {
      printable++;
    }
  }
  return printable / sample.length > 0.85;
}
