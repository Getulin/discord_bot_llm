export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function extractPromptAfterWakeWord(
  transcript: string,
  wakeWord: string
): string | null {
  const normalizedTranscript = normalizeText(transcript);
  const normalizedWakeWord = normalizeText(wakeWord);
  const index = normalizedTranscript.indexOf(normalizedWakeWord);

  if (index === -1) {
    return null;
  }

  const originalAfterWakeWord = transcript.slice(index + wakeWord.length);
  const prompt = originalAfterWakeWord.replace(/^[\s,.:;!?-]+/, "").trim();
  return prompt.length > 0 ? prompt : null;
}

export function clipForSpeech(text: string, maxChars: number): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxChars - 1)).trim()}...`;
}

export function maskDebugText(text: string): string {
  if (!text) return "";
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= 12) return "[conteudo mascarado]";
  return `${compact.slice(0, 6)}...[${compact.length} chars]`;
}
