import { openai } from "./openaiClient.js";
import { config } from "../config.js";
import { clipForSpeech } from "../utils/sanitize.js";
import { logger } from "../utils/logger.js";

const systemPrompt = [
  "Voce e um assistente de voz dentro de uma call de Discord.",
  "Responda em portugues brasileiro.",
  "Seja breve.",
  "Nao responda se a fala nao parecer direcionada a voce.",
  "Evite respostas longas, listas extensas e blocos de codigo grandes.",
  "Quando o tema for tecnico, explique de forma objetiva.",
  "Nao solicite nem armazene dados sensiveis.",
  "Caso o usuario peca algo que envolva dados pessoais, responda de forma cautelosa e minima."
].join(" ");

export async function askOpenAI(prompt: string, username?: string): Promise<string> {
  logger.info("Geracao de resposta iniciada.");
  logger.debug("Prompt mascarado:", prompt);

  const userInput = username
    ? `Usuario ${username} perguntou: ${prompt}`
    : prompt;

  const response = await openai.responses.create({
    model: config.openaiTextModel,
    instructions: systemPrompt,
    input: userInput,
    max_output_tokens: Math.max(64, Math.ceil(config.maxResponseChars / 3))
  });

  const text = clipForSpeech(response.output_text ?? "", config.maxResponseChars);
  logger.info("Geracao de resposta concluida.");
  logger.debug("Resposta mascarada:", text);
  return text;
}
