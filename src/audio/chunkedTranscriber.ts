import { writeFile } from "node:fs/promises";
import { once } from "node:events";
import { EndBehaviorType, VoiceReceiver } from "@discordjs/voice";
import prism from "prism-media";
import { config } from "../config.js";
import { convertPcmToWav } from "./converter.js";
import { transcribeAudio } from "../services/transcribe.js";
import { createTempFilePath, removeTempFile } from "../utils/tempFiles.js";
import { logger } from "../utils/logger.js";

const pcmBytesPerMs = 48_000 * 2 * 2 / 1000;

export async function transcribeUserAudioInChunks(
  receiver: VoiceReceiver,
  userId: string
): Promise<string> {
  logger.info("Captura semi-tempo-real iniciada.");

  const chunkBytes = Math.max(1, Math.floor(config.audioChunkMs * pcmBytesPerMs));
  const minChunkBytes = Math.max(1, Math.floor(config.audioMinChunkMs * pcmBytesPerMs));
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

  let buffers: Buffer[] = [];
  let bufferedBytes = 0;
  const transcripts: string[] = [];
  const pendingTranscripts: Array<Promise<void>> = [];
  let chunkIndex = 0;
  let activeTranscriptions = 0;

  async function waitForFreeSlot(): Promise<void> {
    while (activeTranscriptions >= config.audioChunkConcurrency) {
      await Promise.race(pendingTranscripts);
    }
  }

  function enqueueChunk(force: boolean): void {
    if (bufferedBytes === 0) return;
    if (!force && bufferedBytes < chunkBytes) return;
    if (force && bufferedBytes < minChunkBytes && transcripts.length > 0) return;

    const chunk = Buffer.concat(buffers, bufferedBytes);
    buffers = [];
    bufferedBytes = 0;
    chunkIndex += 1;
    const currentIndex = chunkIndex;

    const task = (async () => {
      await waitForFreeSlot();
      activeTranscriptions += 1;
      const text = await transcribePcmChunk(chunk, currentIndex);
      if (text) {
        transcripts[currentIndex - 1] = text;
      }
    })().finally(() => {
      activeTranscriptions -= 1;
      const index = pendingTranscripts.indexOf(task);
      if (index !== -1) {
        pendingTranscripts.splice(index, 1);
      }
    });

    pendingTranscripts.push(task);
  }

  decoder.on("data", (chunk: Buffer) => {
    buffers.push(chunk);
    bufferedBytes += chunk.length;
    enqueueChunk(false);
  });

  opusStream.pipe(decoder);

  try {
    await Promise.race([
      once(decoder, "end"),
      once(decoder, "error").then(([error]) => {
        throw error;
      }),
      once(opusStream, "error").then(([error]) => {
        throw error;
      })
    ]);

    enqueueChunk(true);
    await Promise.all(pendingTranscripts);
    logger.info(`Captura semi-tempo-real concluida com ${chunkIndex} chunk(s).`);
    return transcripts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  } catch (error) {
    opusStream.destroy();
    decoder.destroy();
    throw error;
  }
}

async function transcribePcmChunk(chunk: Buffer, chunkIndex: number): Promise<string> {
  let pcmPath: string | undefined;
  let wavPath: string | undefined;
  const startedAt = Date.now();

  try {
    pcmPath = await createTempFilePath(".pcm");
    await writeFile(pcmPath, chunk);
    wavPath = await convertPcmToWav(pcmPath);
    const text = await transcribeAudio(wavPath);
    logger.info(`Chunk ${chunkIndex} transcrito em ${Date.now() - startedAt}ms.`);
    return text;
  } finally {
    await Promise.all([removeTempFile(pcmPath), removeTempFile(wavPath)]);
  }
}
