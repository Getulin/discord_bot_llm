import fs from "node:fs";
import { getOpenAI } from "./openaiClient.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { transcribeAudioLocal } from "./localTranscribe.js";

export async function transcribeAudio(filePath: string): Promise<string> {
  if (config.sttProvider === "local") {
    return transcribeAudioLocal(filePath);
  }

  logger.info("Processamento de transcricao iniciado.");
  const result = await getOpenAI().audio.transcriptions.create({
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
