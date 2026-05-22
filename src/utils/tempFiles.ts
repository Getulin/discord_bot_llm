import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { logger } from "./logger.js";

export function tempDirPath(): string {
  return path.resolve(process.cwd(), config.tmpAudioDir);
}

export async function ensureTempDir(): Promise<void> {
  await mkdir(tempDirPath(), { recursive: true });
}

export async function createTempFilePath(extension: string): Promise<string> {
  await ensureTempDir();
  const cleanExtension = extension.startsWith(".") ? extension : `.${extension}`;
  const filePath = path.join(tempDirPath(), `${Date.now()}-${randomUUID()}${cleanExtension}`);
  assertInsideTempDir(filePath);
  return filePath;
}

export function assertInsideTempDir(filePath: string): void {
  const base = tempDirPath();
  const resolved = path.resolve(filePath);
  const relative = path.relative(base, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Caminho temporario fora do diretorio permitido.");
  }
}

export async function removeTempFile(filePath?: string): Promise<void> {
  if (!filePath) return;
  assertInsideTempDir(filePath);
  try {
    await rm(filePath, { force: true });
    logger.info("Arquivo temporario removido.");
  } catch (error) {
    logger.error("Erro generico ao remover arquivo temporario.", error);
  }
}
