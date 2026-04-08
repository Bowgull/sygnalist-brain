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

  // Docx - extract text from XML content
  if (file.name.endsWith(".docx") || file.type.includes("wordprocessingml")) {
    const buffer = await file.arrayBuffer();
    const raw = new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(buffer));
    const textMatches = raw.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [];
    const text = textMatches.map((t) => t.replace(/<[^>]+>/g, "")).join(" ");
    if (text.length >= 50) return text.slice(0, 15000);

    // Fallback: try raw text extraction
    return (await file.text()).slice(0, 15000);
  }

  // Fallback: try raw text
  return (await file.text()).slice(0, 15000);
}
