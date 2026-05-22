import fs from "node:fs";
import { openai } from "./openaiClient.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

export async function transcribeAudio(filePath: string): Promise<string> {
  logger.info("Processamento de transcricao iniciado.");
  const result = await openai.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: config.openaiTranscribeModel,
    response_format: "text",
    language: "pt"
  });

  const text = typeof result === "string" ? result : String(result);
  logger.info("Processamento de transcricao concluido.");
  logger.debug("Transcricao mascarada:", text);
  return text.trim();
}
