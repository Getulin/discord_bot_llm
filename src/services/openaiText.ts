import { getOpenAI } from "./openaiClient.js";
import { config } from "../config.js";
import { clipForSpeech } from "../utils/sanitize.js";
import { logger } from "../utils/logger.js";
import { assistantSystemPrompt } from "./assistantPrompt.js";

export async function askOpenAI(prompt: string, username?: string): Promise<string> {
  logger.info("Geracao de resposta iniciada.");
  logger.debug("Prompt mascarado:", prompt);

  const userInput = username
    ? `Usuario ${username} perguntou: ${prompt}`
    : prompt;

  const response = await getOpenAI().responses.create({
    model: config.openaiTextModel,
    instructions: assistantSystemPrompt,
    input: userInput,
    max_output_tokens: Math.max(64, Math.ceil(config.maxResponseChars / 3))
  });

  const text = clipForSpeech(response.output_text ?? "", config.maxResponseChars);
  logger.info("Geracao de resposta concluida.");
  logger.debug("Resposta mascarada:", text);
  return text;
}
