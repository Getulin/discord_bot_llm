import dotenv from "dotenv";

dotenv.config();

const requiredEnv = ["DISCORD_TOKEN", "OPENAI_API_KEY"] as const;

function required(name: (typeof requiredEnv)[number]): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}`);
  }
  return value;
}

function numberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function booleanEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  return ["1", "true", "yes", "sim"].includes(raw.toLowerCase());
}

export const config = {
  discordToken: required("DISCORD_TOKEN"),
  openaiApiKey: required("OPENAI_API_KEY"),
  wakeWord: process.env.WAKE_WORD?.trim() || "jarvis",
  openaiTextModel: process.env.OPENAI_TEXT_MODEL?.trim() || "gpt-4.1-mini",
  openaiTranscribeModel:
    process.env.OPENAI_TRANSCRIBE_MODEL?.trim() || "gpt-4o-mini-transcribe",
  openaiTtsModel: process.env.OPENAI_TTS_MODEL?.trim() || "gpt-4o-mini-tts",
  openaiTtsVoice: process.env.OPENAI_TTS_VOICE?.trim() || "alloy",
  botPrefix: process.env.BOT_PREFIX?.trim() || "!",
  cooldownMs: numberEnv("COOLDOWN_MS", 5000),
  silenceDurationMs: numberEnv("SILENCE_DURATION_MS", 1200),
  maxResponseChars: numberEnv("MAX_RESPONSE_CHARS", 700),
  tmpAudioDir: process.env.TMP_AUDIO_DIR?.trim() || "tmp/audio",
  debug: booleanEnv("DEBUG", false)
};
