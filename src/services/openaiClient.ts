import OpenAI from "openai";
import { config } from "../config.js";

let client: OpenAI | undefined;

export function getOpenAI(): OpenAI {
  if (!config.openaiApiKey) {
    throw new Error("OPENAI_API_KEY ausente.");
  }

  client ??= new OpenAI({
    apiKey: config.openaiApiKey
  });

  return client;
}
