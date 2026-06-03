import dotenv from "dotenv";

dotenv.config();

const requiredEnv = ["DISCORD_TOKEN"] as const;

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
  openaiApiKey: process.env.OPENAI_API_KEY?.trim(),
  wakeWord: process.env.WAKE_WORD?.trim() || "Varys",
  wakeWordAliases: wakeWordAliases(
    process.env.WAKE_WORD?.trim() || "Varys",
    process.env.WAKE_WORD_ALIASES
  ),
  sttProvider: parseProvider(process.env.STT_PROVIDER, "openai"),
  ttsProvider: parseProvider(process.env.TTS_PROVIDER, "openai"),
  aiTextProvider: parseTextProvider(process.env.AI_TEXT_PROVIDER),
  openaiTextModel: process.env.OPENAI_TEXT_MODEL?.trim() || "gpt-4.1-mini",
  openaiTranscribeModel:
    process.env.OPENAI_TRANSCRIBE_MODEL?.trim() || "gpt-4o-mini-transcribe",
  openaiTtsModel: process.env.OPENAI_TTS_MODEL?.trim() || "gpt-4o-mini-tts",
  openaiTtsVoice: process.env.OPENAI_TTS_VOICE?.trim() || "alloy",
  ollamaBaseUrl: trimTrailingSlash(
    process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434"
  ),
  ollamaModel: process.env.OLLAMA_MODEL?.trim() || "llama3.2:3b",
  ollamaTemperature: numberEnv("OLLAMA_TEMPERATURE", 0.4),
  ollamaNumPredict: numberEnv("OLLAMA_NUM_PREDICT", 180),
  ollamaTimeoutMs: numberEnv("OLLAMA_TIMEOUT_MS", 45_000),
  groqApiKey: process.env.GROQ_API_KEY?.trim(),
  groqBaseUrl: trimTrailingSlash(
    process.env.GROQ_BASE_URL?.trim() || "https://api.groq.com/openai/v1"
  ),
  groqModel: process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile",
  groqTemperature: numberEnv("GROQ_TEMPERATURE", 0.35),
  groqMaxTokens: numberEnv("GROQ_MAX_TOKENS", 180),
  groqTimeoutMs: numberEnv("GROQ_TIMEOUT_MS", 30_000),
  whisperCppBin: process.env.WHISPER_CPP_BIN?.trim() || "whisper-cli",
  whisperCppModel: process.env.WHISPER_CPP_MODEL?.trim() || "models/whisper/ggml-base.bin",
  whisperCppLanguage: process.env.WHISPER_CPP_LANGUAGE?.trim() || "pt",
  whisperCppThreads: numberEnv("WHISPER_CPP_THREADS", 4),
  whisperCppPrompt:
    process.env.WHISPER_CPP_PROMPT?.trim() ||
    "Palavra de ativacao: Varys. Tambem pode soar como Verris em portugues. Termos comuns: creatina, suplemento, treino, academia, proteina, criptografia.",
  whisperNoSpeechThreshold: numberEnv("WHISPER_NO_SPEECH_THRESHOLD", 0.35),
  audioNormalize: booleanEnv("AUDIO_NORMALIZE", true),
  audioDenoise: booleanEnv("AUDIO_DENOISE", true),
  audioHighpassHz: numberEnv("AUDIO_HIGHPASS_HZ", 80),
  audioLowpassHz: numberEnv("AUDIO_LOWPASS_HZ", 7600),
  whisperCppTimeoutMs: numberEnv("WHISPER_CPP_TIMEOUT_MS", 120_000),
  piperBin: process.env.PIPER_BIN?.trim() || "piper",
  piperModel: process.env.PIPER_MODEL?.trim() || "models/piper/pt_BR-faber-medium.onnx",
  piperConfig: process.env.PIPER_CONFIG?.trim() || "models/piper/pt_BR-faber-medium.onnx.json",
  piperSpeaker: process.env.PIPER_SPEAKER?.trim(),
  piperTimeoutMs: numberEnv("PIPER_TIMEOUT_MS", 60_000),
  botPrefix: process.env.BOT_PREFIX?.trim() || "!",
  cooldownMs: numberEnv("COOLDOWN_MS", 5000),
  silenceDurationMs: numberEnv("SILENCE_DURATION_MS", 1200),
  maxActiveCaptures: Math.max(1, Math.floor(numberEnv("MAX_ACTIVE_CAPTURES", 3))),
  maxSpeechQueueSize: Math.max(1, Math.floor(numberEnv("MAX_SPEECH_QUEUE_SIZE", 5))),
  wakeWordGateEnabled: booleanEnv("WAKE_WORD_GATE_ENABLED", true),
  wakeWordGateMs: numberEnv("WAKE_WORD_GATE_MS", 2500),
  semiRealtimeStt: booleanEnv("SEMI_REALTIME_STT", true),
  audioChunkMs: numberEnv("AUDIO_CHUNK_MS", 4000),
  audioMinChunkMs: numberEnv("AUDIO_MIN_CHUNK_MS", 1500),
  audioChunkConcurrency: Math.max(1, Math.floor(numberEnv("AUDIO_CHUNK_CONCURRENCY", 2))),
  voiceReconnectMaxAttempts: numberEnv("VOICE_RECONNECT_MAX_ATTEMPTS", 60),
  voiceReconnectDelayMs: numberEnv("VOICE_RECONNECT_DELAY_MS", 10_000),
  voiceDisconnectedGraceMs: numberEnv("VOICE_DISCONNECTED_GRACE_MS", 600_000),
  maxResponseChars: numberEnv("MAX_RESPONSE_CHARS", 700),
  tmpAudioDir: process.env.TMP_AUDIO_DIR?.trim() || "tmp/audio",
  debug: booleanEnv("DEBUG", false)
};

function parseTextProvider(value: string | undefined): "openai" | "ollama" | "groq" {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "ollama") return "ollama";
  if (normalized === "groq") return "groq";
  return "openai";
}

function parseProvider(value: string | undefined, fallback: "openai" | "local"): "openai" | "local" {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "local") return "local";
  return fallback;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function wakeWordAliases(wakeWord: string, rawAliases: string | undefined): string[] {
  const aliases = new Set<string>([wakeWord]);
  for (const alias of rawAliases?.split(",") ?? []) {
    const trimmed = alias.trim();
    if (trimmed) aliases.add(trimmed);
  }

  if (wakeWord.toLowerCase() === "varys") {
    for (const alias of ["verris", "veris", "varis", "vares"]) {
      aliases.add(alias);
    }
  }

  return [...aliases];
}
