import {
  PermissionFlagsBits,
  type GuildMember,
  type GuildTextBasedChannel,
  type VoiceBasedChannel
} from "discord.js";
import {
  AudioPlayer,
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
  VoiceConnection,
  VoiceReceiver,
  VoiceConnectionStatus
} from "@discordjs/voice";
import { callJoinPrivacyNotice, callLeaveNotice } from "../privacy/privacyNotice.js";
import { transcribeUserAudioInChunks } from "../audio/chunkedTranscriber.js";
import { recordUserAudio } from "../audio/recorder.js";
import { convertPcmToWav } from "../audio/converter.js";
import { playAudioFile, makeAudioPlayer } from "../audio/player.js";
import { transcribeAudio } from "../services/transcribe.js";
import { askAssistant } from "../services/assistantText.js";
import { textToSpeech } from "../services/tts.js";
import { config } from "../config.js";
import { Cooldown } from "../utils/cooldown.js";
import { extractPromptAfterWakeWord } from "../utils/sanitize.js";
import { removeTempFile } from "../utils/tempFiles.js";
import { logger } from "../utils/logger.js";
import { publicProcessingErrorMessage } from "../utils/errors.js";

type Session = {
  guildId: string;
  connection: VoiceConnection;
  player: AudioPlayer;
  textChannel: GuildTextBasedChannel;
  muted: boolean;
  processing: boolean;
  speaking: boolean;
  cooldown: Cooldown;
  ready: boolean;
  privacyNoticeSent: boolean;
  receiverBound: boolean;
  voiceChannel: VoiceBasedChannel;
  connectAttempts: number;
  lastPublicErrorAt: number;
  disconnectStartedAt?: number;
  reconnectTimer?: NodeJS.Timeout;
};

const sessions = new Map<string, Session>();
const maxConnectAttempts = 3;
const connectTimeoutMs = 20_000;

export async function joinUserVoiceChannel(
  member: GuildMember,
  textChannel: GuildTextBasedChannel
): Promise<void> {
  const voiceChannel = member.voice.channel;
  if (!voiceChannel) {
    await textChannel.send("Entre em um canal de voz antes de usar esse comando.");
    return;
  }

  const permissionProblem = getVoicePermissionProblem(member, voiceChannel);
  if (permissionProblem) {
    await textChannel.send(permissionProblem);
    return;
  }

  const existing = sessions.get(member.guild.id);
  if (existing?.ready && isConnectionAlive(existing.connection)) {
    await textChannel.send("Ja estou conectado a uma call neste servidor.");
    return;
  }
  if (existing) {
    destroyConnection(existing.connection);
  }
  sessions.delete(member.guild.id);

  const session: Session = {
    guildId: member.guild.id,
    connection: createVoiceConnection(voiceChannel),
    player: makeAudioPlayer(),
    textChannel,
    muted: false,
    processing: false,
    speaking: false,
    cooldown: new Cooldown(config.cooldownMs),
    ready: false,
    privacyNoticeSent: false,
    receiverBound: false,
    voiceChannel,
    connectAttempts: 0,
    lastPublicErrorAt: 0
  };

  sessions.set(member.guild.id, session);
  bindConnectionLifecycle(session);
  bindVoiceDebug(session.connection);

  const connected = await connectSessionWithRetries(session);
  if (!connected) {
    sessions.delete(member.guild.id);
    destroyConnection(session.connection);
    await textChannel.send(
      "Nao consegui abrir a conexao de voz. Reinicie usando Node 22 LTS e confira se o canal permite Conectar e Falar."
    );
  }
}

export async function leaveVoiceChannel(
  guildId: string,
  textChannel?: GuildTextBasedChannel
): Promise<void> {
  const session = sessions.get(guildId);
  const connection = session?.connection ?? getVoiceConnection(guildId);
  if (connection) {
    destroyConnection(connection);
  }

  sessions.delete(guildId);
  await (textChannel ?? session?.textChannel)?.send(callLeaveNotice).catch(() => undefined);
}

export function setBotMuted(guildId: string, muted: boolean): boolean {
  const session = sessions.get(guildId);
  if (!session || !isConnectionAlive(session.connection)) {
    sessions.delete(guildId);
    return false;
  }

  session.muted = muted;
  return true;
}

export function getBotStatus(guildId: string): string {
  const session = sessions.get(guildId);
  if (!session || !isConnectionAlive(session.connection)) {
    sessions.delete(guildId);
    return [
      "Status do bot:",
    "- conectado: nao",
    `- palavra-chave: ${config.wakeWord}`,
    `- transcricao: ${config.sttProvider}`,
    `- provedor de resposta: ${config.aiTextProvider}`,
    `- voz: ${config.ttsProvider}`,
    "- mutado: nao",
      "- processamento em andamento: nao"
    ].join("\n");
  }

  return [
    "Status do bot:",
    `- conectado: sim (${session.connection.state.status})`,
    `- palavra-chave: ${config.wakeWord}`,
    `- transcricao: ${config.sttProvider}`,
    `- provedor de resposta: ${config.aiTextProvider}`,
    `- voz: ${config.ttsProvider}`,
    `- mutado: ${session.muted ? "sim" : "nao"}`,
    `- voz pronta: ${session.ready ? "sim" : "nao"}`,
    `- processamento em andamento: ${session.processing ? "sim" : "nao"}`
  ].join("\n");
}

function bindVoiceDebug(connection: VoiceConnection): void {
  connection.on("debug", (message) => {
    logger.debug(`Debug de voz: ${message}`);
  });

  connection.on("error", (error) => {
    logger.error("Erro generico na conexao de voz.", error);
  });
}

function bindConnectionLifecycle(session: Session): void {
  session.connection.on("stateChange", async (oldState, newState) => {
    logger.debug(`Estado da conexao de voz: ${oldState.status} -> ${newState.status}`);

    if (newState.status === VoiceConnectionStatus.Ready) {
      session.disconnectStartedAt = undefined;
      clearReconnectTimer(session);
      await markSessionReady(session);
      return;
    }

    if (newState.status === VoiceConnectionStatus.Destroyed) {
      sessions.delete(session.guildId);
      return;
    }

    if (newState.status !== VoiceConnectionStatus.Disconnected) {
      return;
    }

    session.disconnectStartedAt ??= Date.now();
    const disconnectedForMs = Date.now() - session.disconnectStartedAt;
    if (disconnectedForMs < config.voiceDisconnectedGraceMs) {
      scheduleReconnect(session);
      return;
    }

    destroyDisconnectedSession(session);
  });
}

function scheduleReconnect(session: Session): void {
  if (session.reconnectTimer) {
    return;
  }

  const attempt = session.connection.rejoinAttempts + 1;
  const delay = Math.min(
    config.voiceReconnectDelayMs * Math.max(1, attempt),
    60_000
  );

  logger.info(`Conexao de voz desconectada; tentativa de reconexao em ${delay}ms.`);
  session.reconnectTimer = setTimeout(() => {
    session.reconnectTimer = undefined;
    if (!sessions.has(session.guildId)) {
      return;
    }

    if (session.connection.rejoinAttempts < config.voiceReconnectMaxAttempts) {
      void reconnectSession(session);
      return;
    }

    destroyDisconnectedSession(session);
  }, delay);
}

function createVoiceConnection(voiceChannel: VoiceBasedChannel): VoiceConnection {
  return joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false
  });
}

async function connectSessionWithRetries(session: Session): Promise<boolean> {
  while (session.connectAttempts < maxConnectAttempts) {
    session.connectAttempts += 1;
    logger.info(`Tentativa de conexao de voz ${session.connectAttempts}/${maxConnectAttempts}.`);

    try {
      await entersState(session.connection, VoiceConnectionStatus.Ready, connectTimeoutMs);
      await markSessionReady(session);
      return true;
    } catch (error) {
      logger.error("Tentativa de conexao de voz falhou.", error);

      if (session.connection.state.status === VoiceConnectionStatus.Destroyed) {
        return false;
      }

      if (session.connectAttempts < maxConnectAttempts) {
        await reconnectSession(session);
        await delay(1_500);
      }
    }
  }

  return false;
}

async function reconnectSession(session: Session): Promise<void> {
  clearReconnectTimer(session);
  destroyConnection(session.connection);
  session.ready = false;
  session.receiverBound = false;
  session.connection = createVoiceConnection(session.voiceChannel);
  bindConnectionLifecycle(session);
  bindVoiceDebug(session.connection);
}

function clearReconnectTimer(session: Session): void {
  if (!session.reconnectTimer) {
    return;
  }

  clearTimeout(session.reconnectTimer);
  session.reconnectTimer = undefined;
}

async function markSessionReady(session: Session): Promise<void> {
  session.ready = true;

  if (!session.receiverBound) {
    bindReceiver(session);
    session.receiverBound = true;
  }

  if (!session.privacyNoticeSent) {
    session.privacyNoticeSent = true;
    await session.textChannel.send(callJoinPrivacyNotice).catch(() => undefined);
  }
}

function getVoicePermissionProblem(
  member: GuildMember,
  voiceChannel: VoiceBasedChannel
): string | null {
  const botMember = member.guild.members.me;
  if (!botMember) {
    return "Nao consegui verificar minhas permissoes neste servidor.";
  }

  const permissions = voiceChannel.permissionsFor(botMember);
  if (!permissions?.has(PermissionFlagsBits.ViewChannel)) {
    return "Nao tenho permissao para ver esse canal de voz.";
  }

  if (!permissions.has(PermissionFlagsBits.Connect)) {
    return "Nao tenho permissao para conectar nesse canal de voz.";
  }

  if (!permissions.has(PermissionFlagsBits.Speak)) {
    return "Nao tenho permissao para falar nesse canal de voz.";
  }

  if (
    voiceChannel.userLimit > 0 &&
    voiceChannel.members.size >= voiceChannel.userLimit &&
    !permissions.has(PermissionFlagsBits.MoveMembers)
  ) {
    return "Esse canal de voz esta cheio e eu nao tenho permissao para entrar mesmo assim.";
  }

  return null;
}

function destroyDisconnectedSession(session: Session): void {
  sessions.delete(session.guildId);
  clearReconnectTimer(session);
  destroyConnection(session.connection);

  void session.textChannel
    .send("Perdi a conexao com a call e sai do canal de voz.")
    .catch(() => undefined);
}

function isConnectionAlive(connection: VoiceConnection): boolean {
  return connection.state.status !== VoiceConnectionStatus.Destroyed;
}

function destroyConnection(connection: VoiceConnection): void {
  connection.removeAllListeners("stateChange");
  connection.removeAllListeners("debug");
  connection.removeAllListeners("error");
  if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
    connection.destroy();
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function bindReceiver(session: Session): void {
  session.connection.receiver.speaking.on("start", (userId) => {
    const botId = session.voiceChannel.client.user?.id;
    if (
      userId === botId ||
      session.muted ||
      session.processing ||
      session.speaking ||
      !session.ready
    ) {
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
    const recordStartedAt = Date.now();
    const transcript = config.semiRealtimeStt
      ? await transcribeUserAudioInChunks(session.connection.receiver, userId)
      : await recordAndTranscribeFullSpeech(session.connection.receiver, userId);
    logger.info(`Etapa captura/transcricao concluida em ${Date.now() - recordStartedAt}ms.`);

    if (!transcript) {
      logger.info("Transcricao vazia ou incompreensivel; audio descartado.");
      return;
    }

    const prompt = extractPromptAfterWakeWord(
      transcript,
      config.wakeWord,
      config.wakeWordAliases
    );
    if (!prompt) {
      logger.info("Transcricao sem palavra-chave reconhecida ou sem pergunta; audio descartado.");
      return;
    }

    logger.info("Usuario acionou palavra-chave.");
    const user = await session.textChannel.client.users.fetch(userId).catch(() => undefined);
    const answerStartedAt = Date.now();
    const answer = await askAssistant(prompt, user?.username);
    logger.info(`Etapa resposta concluida em ${Date.now() - answerStartedAt}ms.`);
    if (!answer) {
      return;
    }

    const ttsStartedAt = Date.now();
    speechPath = await textToSpeech(answer);
    logger.info(`Etapa sintese de voz concluida em ${Date.now() - ttsStartedAt}ms.`);
    session.speaking = true;
    const playbackStartedAt = Date.now();
    await playAudioFile(session.connection, session.player, speechPath);
    logger.info(`Etapa reproducao concluida em ${Date.now() - playbackStartedAt}ms.`);
  } catch (error) {
    logger.error("Erro generico durante processamento de voz.", error);
    await sendThrottledProcessingError(session, error);
  } finally {
    session.speaking = false;
    session.processing = false;
    await Promise.all([removeTempFile(pcmPath), removeTempFile(wavPath), removeTempFile(speechPath)]);
    logger.info(`Processamento concluido em ${Date.now() - startedAt}ms.`);
  }
}

async function recordAndTranscribeFullSpeech(
  receiver: VoiceReceiver,
  userId: string
): Promise<string> {
  let pcmPath: string | undefined;
  let wavPath: string | undefined;

  try {
    const recordStartedAt = Date.now();
    pcmPath = await recordUserAudio(receiver, userId);
    logger.info(`Etapa captura concluida em ${Date.now() - recordStartedAt}ms.`);

    const convertStartedAt = Date.now();
    wavPath = await convertPcmToWav(pcmPath);
    logger.info(`Etapa conversao concluida em ${Date.now() - convertStartedAt}ms.`);

    const transcribeStartedAt = Date.now();
    const transcript = await transcribeAudio(wavPath);
    logger.info(`Etapa transcricao concluida em ${Date.now() - transcribeStartedAt}ms.`);
    return transcript;
  } finally {
    await Promise.all([removeTempFile(pcmPath), removeTempFile(wavPath)]);
  }
}

async function sendThrottledProcessingError(
  session: Session,
  error: unknown
): Promise<void> {
  const now = Date.now();
  if (now - session.lastPublicErrorAt < 30_000) {
    return;
  }

  session.lastPublicErrorAt = now;
  await session.textChannel
    .send(publicProcessingErrorMessage(error))
    .catch(() => undefined);
}
