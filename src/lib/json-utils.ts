export function safeParseJSON(text: string): { json: any | null; error: string | null } {
  try {
    let cleaned = text.trim();
    cleaned = cleaned.replace(/```json/gi, "").replace(/```/g, "").trim();

    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }

    if (!cleaned.startsWith("{")) {
      const bracePos = cleaned.indexOf("{");
      if (bracePos >= 0) cleaned = cleaned.slice(bracePos);
    }

    return { json: JSON.parse(cleaned), error: null };
  } catch (e) {
    return { json: null, error: e instanceof Error ? e.message : "Parse error" };
  }
}

export function countWords(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
}

