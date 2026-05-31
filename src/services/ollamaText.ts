import { config } from "../config.js";
import { clipForSpeech } from "../utils/sanitize.js";
import { logger } from "../utils/logger.js";
import { assistantSystemPrompt } from "./assistantPrompt.js";

type OllamaChatResponse = {
  message?: {
    content?: string;
  };
  error?: string;
};

export async function askOllama(prompt: string, username?: string): Promise<string> {
  logger.info("Geracao de resposta local com Ollama iniciada.");
  logger.debug("Prompt mascarado:", prompt);

  const userInput = username
    ? `Usuario ${username} perguntou: ${prompt}`
    : prompt;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.ollamaTimeoutMs);

  try {
    const response = await fetch(`${config.ollamaBaseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.ollamaModel,
        stream: false,
        messages: [
          { role: "system", content: assistantSystemPrompt },
          { role: "user", content: userInput }
        ],
        options: {
          temperature: config.ollamaTemperature,
          num_predict: config.ollamaNumPredict
        }
      }),
      signal: controller.signal
    });

    const body = (await response.json().catch(() => ({}))) as OllamaChatResponse;
    if (!response.ok) {
      throw new Error(body.error || `Ollama retornou HTTP ${response.status}.`);
    }

    const text = clipForSpeech(body.message?.content ?? "", config.maxResponseChars);
    logger.info("Geracao de resposta local com Ollama concluida.");
    logger.debug("Resposta mascarada:", text);
    return text;
  } finally {
    clearTimeout(timeout);
  }
}
