import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createTempFilePath, removeTempFile } from "../utils/tempFiles.js";
import { logger } from "../utils/logger.js";
import { config } from "../config.js";

const require = createRequire(import.meta.url);
const ffmpegStaticPath = require("ffmpeg-static") as string | null;
const ffmpegPath = ffmpegStaticPath || "ffmpeg";

export async function convertPcmToWav(pcmPath: string): Promise<string> {
  const wavPath = await createTempFilePath(".wav");
  const audioFilters = buildAudioFilters();

  try {
    await new Promise<void>((resolve, reject) => {
      const args = [
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
        ...(audioFilters ? ["-af", audioFilters] : []),
        wavPath
      ];

      const ffmpeg = spawn(ffmpegPath, args);

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

function buildAudioFilters(): string {
  const filters = [];

  if (config.audioHighpassHz > 0) {
    filters.push(`highpass=f=${config.audioHighpassHz}`);
  }

  if (config.audioLowpassHz > 0) {
    filters.push(`lowpass=f=${config.audioLowpassHz}`);
  }

  if (config.audioDenoise) {
    filters.push("afftdn=nf=-25");
  }

  if (config.audioNormalize) {
    filters.push("loudnorm=I=-18:TP=-2:LRA=11");
  }

  return filters.join(",");
}
