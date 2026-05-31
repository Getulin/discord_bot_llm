export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function extractPromptAfterWakeWord(
  transcript: string,
  wakeWord: string,
  wakeWordAliases: string[] = [wakeWord]
): string | null {
  const normalizedTranscript = normalizeText(transcript);
  const normalizedWakeWords = wakeWordAliases.map(normalizeText);
  const exactMatch = findExactWakeWord(normalizedTranscript, normalizedWakeWords);
  const fuzzyMatch = exactMatch ?? findFuzzyWakeWord(normalizedTranscript, normalizedWakeWords);

  if (!fuzzyMatch) {
    return null;
  }

  const originalAfterWakeWord = transcript.slice(fuzzyMatch.end);
  const prompt = originalAfterWakeWord.replace(/^[\s,.:;!?-]+/, "").trim();
  return prompt.length > 0 ? prompt : null;
}

function findExactWakeWord(
  normalizedTranscript: string,
  normalizedWakeWords: string[]
): { end: number } | null {
  for (const wakeWord of normalizedWakeWords) {
    const index = normalizedTranscript.indexOf(wakeWord);
    if (index !== -1) {
      return { end: index + wakeWord.length };
    }
  }

  return null;
}

function findFuzzyWakeWord(
  normalizedTranscript: string,
  normalizedWakeWords: string[]
): { end: number } | null {
  const wordMatches = normalizedTranscript.matchAll(/\b[\p{L}\p{N}]+\b/gu);
  for (const match of wordMatches) {
    const word = match[0];
    const start = match.index ?? 0;

    for (const wakeWord of normalizedWakeWords) {
      if (wakeWord.length < 5) continue;
      if (Math.abs(word.length - wakeWord.length) > 1) continue;

      if (levenshteinDistance(word, wakeWord) <= 1) {
        return { end: start + word.length };
      }
    }
  }

  return null;
}

function levenshteinDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + substitutionCost
      );
    }
  }

  return dp[a.length][b.length];
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
