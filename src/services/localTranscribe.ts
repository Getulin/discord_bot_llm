import { readFile } from "node:fs/promises";
import { config } from "../config.js";
import { createTempFilePath, removeTempFile } from "../utils/tempFiles.js";
import { logger } from "../utils/logger.js";
import { runProcess } from "../utils/runProcess.js";

export async function transcribeAudioLocal(filePath: string): Promise<string> {
  logger.info("Transcricao local com whisper.cpp iniciada.");
  const outputTxtPath = await createTempFilePath(".txt");
  const outputPrefix = outputTxtPath.slice(0, -".txt".length);

  try {
    const args = [
      "-m",
      config.whisperCppModel,
      "-f",
      filePath,
      "-l",
      config.whisperCppLanguage,
      "-t",
      String(config.whisperCppThreads),
      "-nt",
      "-otxt",
      "-of",
      outputPrefix,
      "--no-speech-thold",
      String(config.whisperNoSpeechThreshold)
    ];

    if (config.whisperCppPrompt) {
      args.push("--prompt", config.whisperCppPrompt);
    }

    await runProcess(config.whisperCppBin, args, { timeoutMs: config.whisperCppTimeoutMs });

    const text = (await readFile(outputTxtPath, "utf8")).trim();
    logger.info("Transcricao local com whisper.cpp concluida.");
    logger.debug("Transcricao local mascarada:", text);
    return text;
  } finally {
    await removeTempFile(outputTxtPath);
  }
}
