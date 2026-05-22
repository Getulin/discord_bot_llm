import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { EndBehaviorType, VoiceReceiver } from "@discordjs/voice";
import prism from "prism-media";
import { config } from "../config.js";
import { createTempFilePath, removeTempFile } from "../utils/tempFiles.js";
import { logger } from "../utils/logger.js";

export async function recordUserAudio(
  receiver: VoiceReceiver,
  userId: string
): Promise<string> {
  const pcmPath = await createTempFilePath(".pcm");
  logger.info("Captura temporaria de audio iniciada.");

  const opusStream = receiver.subscribe(userId, {
    end: {
      behavior: EndBehaviorType.AfterSilence,
      duration: config.silenceDurationMs
    }
  });

  const decoder = new prism.opus.Decoder({
    rate: 48000,
    channels: 2,
    frameSize: 960
  });

  try {
    await pipeline(opusStream, decoder, createWriteStream(pcmPath));
  } catch (error) {
    await removeTempFile(pcmPath);
    throw error;
  }

  logger.info("Captura temporaria de audio concluida.");
  return pcmPath;
}
