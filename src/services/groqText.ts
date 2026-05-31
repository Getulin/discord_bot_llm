import { config } from "../config.js";
import { clipForSpeech } from "../utils/sanitize.js";
import { logger } from "../utils/logger.js";
import { assistantSystemPrompt } from "./assistantPrompt.js";

type GroqChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

export async function askGroq(prompt: string, username?: string): Promise<string> {
  if (!config.groqApiKey) {
    throw new Error("GROQ_API_KEY ausente.");
  }

  logger.info("Geracao de resposta com Groq iniciada.");
  logger.debug("Prompt mascarado:", prompt);

  const userInput = username
    ? `Usuario ${username} perguntou: ${prompt}`
    : prompt;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.groqTimeoutMs);

  try {
    const response = await fetch(`${config.groqBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.groqApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.groqModel,
        messages: [
          { role: "system", content: assistantSystemPrompt },
          { role: "user", content: userInput }
        ],
        temperature: config.groqTemperature,
        max_tokens: config.groqMaxTokens
      }),
      signal: controller.signal
    });

    const body = (await response.json().catch(() => ({}))) as GroqChatResponse;
    if (!response.ok) {
      throw new Error(body.error?.message || `Groq retornou HTTP ${response.status}.`);
    }

    const text = clipForSpeech(
      body.choices?.[0]?.message?.content ?? "",
      config.maxResponseChars
    );
    logger.info("Geracao de resposta com Groq concluida.");
    logger.debug("Resposta mascarada:", text);
    return text;
  } finally {
    clearTimeout(timeout);
  }
}
