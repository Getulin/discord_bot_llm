import { Client, GatewayIntentBits, Partials } from "discord.js";
import { registerCommands } from "./commands.js";
import { logger } from "../utils/logger.js";

export function createDiscordClient(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
  });

  client.once("clientReady", () => {
    logger.info(`Bot conectado como ${client.user?.tag ?? "desconhecido"}.`);
  });

  registerCommands(client);

  return client;
}
