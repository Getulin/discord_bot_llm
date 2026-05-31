import { config } from "../config.js";
import { createTempFilePath, removeTempFile } from "../utils/tempFiles.js";
import { logger } from "../utils/logger.js";
import { runProcess } from "../utils/runProcess.js";

export async function textToSpeechLocal(text: string): Promise<string> {
  logger.info("Sintese de voz local com Piper iniciada.");
  const outputPath = await createTempFilePath(".wav");
  const args = [
    "--model",
    config.piperModel,
    "--config",
    config.piperConfig,
    "--output_file",
    outputPath
  ];

  if (config.piperSpeaker) {
    args.push("--speaker", config.piperSpeaker);
  }

  try {
    await runProcess(config.piperBin, args, {
      input: text,
      timeoutMs: config.piperTimeoutMs
    });
    logger.info("Sintese de voz local com Piper concluida.");
    return outputPath;
  } catch (error) {
    await removeTempFile(outputPath);
    throw error;
  }
}
