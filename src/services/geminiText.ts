import { config } from "../config.js";
import { clipForSpeech } from "../utils/sanitize.js";
import { logger } from "../utils/logger.js";
import { assistantSystemPrompt } from "./assistantPrompt.js";

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

type GeminiContent = {
  role: "user" | "model";
  parts: Array<{
    text: string;
  }>;
};

const historyByUser = new Map<string, GeminiContent[]>();

export async function askGemini(
  prompt: string,
  username?: string,
  userId?: string
): Promise<string> {
  if (!config.geminiApiKey) {
    throw new Error("GEMINI_API_KEY ausente.");
  }

  logger.info("Geracao de resposta com Gemini iniciada.");
  logger.debug("Prompt mascarado:", prompt);

  const userInput = username
    ? `Usuario ${username} perguntou: ${prompt}`
    : prompt;
  const userTurn: GeminiContent = {
    role: "user",
    parts: [{ text: userInput }]
  };
  const historyKey = userId ?? username ?? "default";
  const previousHistory = config.geminiContextTurns > 0
    ? historyByUser.get(historyKey) ?? []
    : [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.geminiTimeoutMs);
  const endpoint = `${config.geminiBaseUrl}/models/${encodeURIComponent(
    config.geminiModel
  )}:generateContent`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": config.geminiApiKey
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: assistantSystemPrompt }]
        },
        contents: [...previousHistory, userTurn],
        generationConfig: {
          temperature: config.geminiTemperature,
          maxOutputTokens: config.geminiMaxTokens
        }
      }),
      signal: controller.signal
    });

    const body = (await response.json().catch(() => ({}))) as GeminiResponse;
    if (!response.ok) {
      throw new Error(body.error?.message || `Gemini retornou HTTP ${response.status}.`);
    }

    const text = clipForSpeech(
      body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "",
      config.maxResponseChars
    );
    if (config.geminiContextTurns > 0 && text) {
      historyByUser.set(
        historyKey,
        limitHistory([
          ...previousHistory,
          userTurn,
          {
            role: "model",
            parts: [{ text }]
          }
        ])
      );
    }

    logger.info("Geracao de resposta com Gemini concluida.");
    logger.debug("Resposta mascarada:", text);
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

function limitHistory(history: GeminiContent[]): GeminiContent[] {
  const maxEntries = Math.max(0, config.geminiContextTurns) * 2;
  return maxEntries > 0 ? history.slice(-maxEntries) : [];
}
