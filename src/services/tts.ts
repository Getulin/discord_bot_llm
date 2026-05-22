import { writeFile } from "node:fs/promises";
import { openai } from "./openaiClient.js";
import { config } from "../config.js";
import { createTempFilePath, removeTempFile } from "../utils/tempFiles.js";
import { logger } from "../utils/logger.js";

export async function textToSpeech(text: string): Promise<string> {
  logger.info("Sintese de voz iniciada.");
  const outputPath = await createTempFilePath(".mp3");
  try {
    const audio = await openai.audio.speech.create({
      model: config.openaiTtsModel,
      voice: config.openaiTtsVoice,
      input: text,
      response_format: "mp3",
      instructions: "Fale em portugues brasileiro com tom natural, claro e breve."
    });

    const buffer = Buffer.from(await audio.arrayBuffer());
    await writeFile(outputPath, buffer);
    logger.info("Sintese de voz concluida.");
    return outputPath;
  } catch (error) {
    await removeTempFile(outputPath);
    throw error;
  }
}
