export async function extractText(file: File): Promise<string> {
  // Plain text / markdown
  if (file.type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
    return (await file.text()).slice(0, 15000);
  }

  // PDF
  if (file.name.endsWith(".pdf") || file.type === "application/pdf") {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.mjs",
      import.meta.url,
    ).href;
    const data = new Uint8Array(await file.arrayBuffer());
    const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
    }
    await doc.destroy();
    const text = pages.join("\n").trim();
    if (text.length >= 50) return text.slice(0, 15000);
    throw new Error("Could not extract text from PDF. It may be image-based or scanned. Try pasting the text directly.");
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
