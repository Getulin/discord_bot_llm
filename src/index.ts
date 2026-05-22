import { createDiscordClient } from "./discord/client.js";
import { config } from "./config.js";
import { ensureTempDir } from "./utils/tempFiles.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
  await ensureTempDir();
  const client = createDiscordClient();
  await client.login(config.discordToken);
}

main().catch((error) => {
  logger.error("Erro ao iniciar o bot.", error);
  process.exitCode = 1;
});
