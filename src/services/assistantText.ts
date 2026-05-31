import { config } from "../config.js";
import { askGroq } from "./groqText.js";
import { askOllama } from "./ollamaText.js";
import { askOpenAI } from "./openaiText.js";

export async function askAssistant(prompt: string, username?: string): Promise<string> {
  if (config.aiTextProvider === "groq") {
    return askGroq(prompt, username);
  }

  if (config.aiTextProvider === "ollama") {
    return askOllama(prompt, username);
  }

  return askOpenAI(prompt, username);
}
