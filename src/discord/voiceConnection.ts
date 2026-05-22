import type { GuildMember, GuildTextBasedChannel, VoiceBasedChannel } from "discord.js";
import {
  AudioPlayer,
  getVoiceConnection,
  joinVoiceChannel,
  VoiceConnection
} from "@discordjs/voice";
import { callJoinPrivacyNotice, callLeaveNotice } from "../privacy/privacyNotice.js";
import { recordUserAudio } from "../audio/recorder.js";
import { convertPcmToWav } from "../audio/converter.js";
import { playAudioFile, makeAudioPlayer } from "../audio/player.js";
import { transcribeAudio } from "../services/transcribe.js";
import { askOpenAI } from "../services/openaiText.js";
import { textToSpeech } from "../services/tts.js";
import { config } from "../config.js";
import { Cooldown } from "../utils/cooldown.js";
import { extractPromptAfterWakeWord } from "../utils/sanitize.js";
import { removeTempFile } from "../utils/tempFiles.js";
import { logger } from "../utils/logger.js";

type Session = {
  guildId: string;
  connection: VoiceConnection;
  player: AudioPlayer;
  textChannel: GuildTextBasedChannel;
  muted: boolean;
  processing: boolean;
  speaking: boolean;
  cooldown: Cooldown;
};

const sessions = new Map<string, Session>();

export async function joinUserVoiceChannel(
  member: GuildMember,
  textChannel: GuildTextBasedChannel
): Promise<void> {
  const voiceChannel = member.voice.channel;
  if (!voiceChannel) {
    await textChannel.send("Entre em um canal de voz antes de usar esse comando.");
    return;
  }

  const existing = sessions.get(member.guild.id);
  if (existing) {
    await textChannel.send("Ja estou conectado a uma call neste servidor.");
    return;
  }

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: member.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false
  });

  const session: Session = {
    guildId: member.guild.id,
    connection,
    player: makeAudioPlayer(),
    textChannel,
    muted: false,
    processing: false,
    speaking: false,
    cooldown: new Cooldown(config.cooldownMs)
  };

  sessions.set(member.guild.id, session);
  bindReceiver(session, voiceChannel);

  await textChannel.send(callJoinPrivacyNotice);
}

export async function leaveVoiceChannel(
  guildId: string,
  textChannel?: GuildTextBasedChannel
): Promise<void> {
  const session = sessions.get(guildId);
  const connection = session?.connection ?? getVoiceConnection(guildId);
  if (connection) {
    connection.destroy();
  }

  sessions.delete(guildId);
  await (textChannel ?? session?.textChannel)?.send(callLeaveNotice).catch(() => undefined);
}

export function setBotMuted(guildId: string, muted: boolean): boolean {
  const session = sessions.get(guildId);
  if (!session) return false;
  session.muted = muted;
  return true;
}

export function getBotStatus(guildId: string): string {
  const session = sessions.get(guildId);
  if (!session) {
    return [
      "Status do bot:",
      "- conectado: nao",
      `- palavra-chave: ${config.wakeWord}`,
      "- mutado: nao",
      "- processamento em andamento: nao"
    ].join("\n");
  }

  return [
    "Status do bot:",
    "- conectado: sim",
    `- palavra-chave: ${config.wakeWord}`,
    `- mutado: ${session.muted ? "sim" : "nao"}`,
    `- processamento em andamento: ${session.processing ? "sim" : "nao"}`
  ].join("\n");
}

function bindReceiver(session: Session, voiceChannel: VoiceBasedChannel): void {
  session.connection.receiver.speaking.on("start", (userId) => {
    const botId = voiceChannel.client.user?.id;
    if (userId === botId || session.muted || session.processing || session.speaking) {
      return;
    }

    if (!session.cooldown.canRun(userId)) {
      return;
    }

    void handleSpeech(session, userId);
  });
}

async function handleSpeech(session: Session, userId: string): Promise<void> {
  let pcmPath: string | undefined;
  let wavPath: string | undefined;
  let speechPath: string | undefined;
  const startedAt = Date.now();

  session.processing = true;
  logger.info("Usuario acionou captura de fala.");

  try {
    pcmPath = await recordUserAudio(session.connection.receiver, userId);
    wavPath = await convertPcmToWav(pcmPath);

    const transcript = await transcribeAudio(wavPath);
    if (!transcript) {
      return;
    }

    const prompt = extractPromptAfterWakeWord(transcript, config.wakeWord);
    if (!prompt) {
      return;
    }

    logger.info("Usuario acionou palavra-chave.");
    const user = await session.textChannel.client.users.fetch(userId).catch(() => undefined);
    const answer = await askOpenAI(prompt, user?.username);
    if (!answer) {
      return;
    }

    speechPath = await textToSpeech(answer);
    session.speaking = true;
    await playAudioFile(session.connection, session.player, speechPath);
  } catch (error) {
    logger.error("Erro generico durante processamento de voz.", error);
    await session.textChannel
      .send("Ocorreu um erro ao processar o audio. Tente novamente em alguns instantes.")
      .catch(() => undefined);
  } finally {
    session.speaking = false;
    session.processing = false;
    await Promise.all([removeTempFile(pcmPath), removeTempFile(wavPath), removeTempFile(speechPath)]);
    logger.info(`Processamento concluido em ${Date.now() - startedAt}ms.`);
  }
}
