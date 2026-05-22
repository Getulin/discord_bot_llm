import { config } from "../config.js";
import { maskDebugText } from "./sanitize.js";

function safeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export const logger = {
  info(message: string): void {
    console.log(`[info] ${message}`);
  },
  debug(message: string, content?: string): void {
    if (!config.debug) return;
    const suffix = content ? ` ${maskDebugText(content)}` : "";
    console.log(`[debug] ${message}${suffix}`);
  },
  error(message: string, error?: unknown): void {
    const suffix = error ? ` ${safeError(error)}` : "";
    console.error(`[erro] ${message}${suffix}`);
  }
};
