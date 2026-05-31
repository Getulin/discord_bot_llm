type ErrorLike = {
  code?: unknown;
  status?: unknown;
  message?: unknown;
};

export function publicProcessingErrorMessage(error: unknown): string {
  const err = error as ErrorLike;

  if (err.status === 429 && err.code === "insufficient_quota") {
    return "A API da OpenAI recusou a transcricao por falta de cota ou billing. Verifique creditos e pagamento na conta da OpenAI.";
  }

  if (err.status === 401) {
    return "A chave da OpenAI parece invalida ou sem permissao. Verifique o OPENAI_API_KEY no .env.";
  }

  if (String(err.message ?? "").includes("OPENAI_API_KEY")) {
    return "OPENAI_API_KEY esta ausente. Ela ainda e necessaria para transcricao e voz enquanto STT/TTS locais nao estiverem configurados.";
  }

  if (String(err.message ?? "").toLowerCase().includes("ollama")) {
    return "Nao consegui gerar resposta com Ollama. Verifique se o Ollama esta rodando e se o modelo configurado foi baixado.";
  }

  if (String(err.message ?? "").includes("GROQ_API_KEY")) {
    return "GROQ_API_KEY esta ausente. Cole sua chave da Groq no .env para usar AI_TEXT_PROVIDER=groq.";
  }

  if (String(err.message ?? "").toLowerCase().includes("groq")) {
    return "Nao consegui gerar resposta com Groq. Verifique GROQ_API_KEY, modelo e limites da conta.";
  }

  if (String(err.message ?? "").toLowerCase().includes("whisper")) {
    return "Nao consegui transcrever localmente. Verifique o caminho do whisper.cpp e do modelo WHISPER_CPP_MODEL.";
  }

  if (String(err.message ?? "").toLowerCase().includes("piper")) {
    return "Nao consegui gerar voz localmente. Verifique o caminho do Piper e do modelo PIPER_MODEL.";
  }

  if (err.status === 429) {
    return "A API da OpenAI limitou as requisicoes no momento. Tente novamente em alguns instantes.";
  }

  return "Ocorreu um erro ao processar o audio. Tente novamente em alguns instantes.";
}
