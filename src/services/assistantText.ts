import { config } from "../config.js";
import { askGemini } from "./geminiText.js";
import { askOllama } from "./ollamaText.js";
import { askOpenAI } from "./openaiText.js";

type AssistantContext = {
  userId?: string;
};

export async function askAssistant(
  prompt: string,
  username?: string,
  context: AssistantContext = {}
): Promise<string> {
  if (config.aiTextProvider === "gemini") {
    return askGemini(prompt, username, context.userId);
  }

  if (config.aiTextProvider === "ollama") {
    return askOllama(prompt, username);
  }

  return askOpenAI(prompt, username);
}
