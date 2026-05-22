import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createTempFilePath, removeTempFile } from "../utils/tempFiles.js";
import { logger } from "../utils/logger.js";

const require = createRequire(import.meta.url);
const ffmpegStaticPath = require("ffmpeg-static") as string | null;
const ffmpegPath = ffmpegStaticPath || "ffmpeg";

export async function convertPcmToWav(pcmPath: string): Promise<string> {
  const wavPath = await createTempFilePath(".wav");

  try {
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn(ffmpegPath, [
        "-y",
        "-f",
        "s16le",
        "-ar",
        "48000",
        "-ac",
        "2",
        "-i",
        pcmPath,
        "-ac",
        "1",
        "-ar",
        "16000",
        wavPath
      ]);

      ffmpeg.once("error", reject);
      ffmpeg.once("close", (code: number | null) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ffmpeg finalizou com codigo ${code ?? "desconhecido"}.`));
        }
      });
    });
  } catch (error) {
    await removeTempFile(wavPath);
    throw error;
  }

  logger.info("Conversao de audio concluida.");
  return wavPath;
}
