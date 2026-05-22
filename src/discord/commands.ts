import type { Client, GuildMember, GuildTextBasedChannel, Message } from "discord.js";
import { config } from "../config.js";
import {
  getBotStatus,
  joinUserVoiceChannel,
  leaveVoiceChannel,
  setBotMuted
} from "./voiceConnection.js";
import { privacyCommandNotice } from "../privacy/privacyNotice.js";

export function registerCommands(client: Client): void {
  client.on("messageCreate", async (message) => {
    if (!isCommand(message)) return;

    const command = message.content
      .slice(config.botPrefix.length)
      .trim()
      .split(/\s+/)[0]
      ?.toLowerCase();

    try {
      switch (command) {
        case "entrar":
          await joinUserVoiceChannel(
            message.member as GuildMember,
            message.channel as GuildTextBasedChannel
          );
          break;
        case "sair":
          await leaveVoiceChannel(message.guildId ?? "", message.channel as GuildTextBasedChannel);
          break;
        case "mutarbot":
          await message.channel.send(
            setBotMuted(message.guildId ?? "", true)
              ? "Bot mutado. Permaneco na call, mas nao vou responder."
              : "Nao estou conectado a uma call neste servidor."
          );
          break;
        case "desmutarbot":
          await message.channel.send(
            setBotMuted(message.guildId ?? "", false)
              ? "Bot desmutado. Voltei a responder quando a palavra-chave for usada."
              : "Nao estou conectado a uma call neste servidor."
          );
          break;
        case "statusbot":
          await message.channel.send(getBotStatus(message.guildId ?? ""));
          break;
        case "privacidade":
          await message.channel.send(privacyCommandNotice);
          break;
        default:
          break;
      }
    } catch {
      await message.channel.send("Erro ao executar o comando. Tente novamente em instantes.");
    }
  });
}

function isCommand(message: Message): boolean {
  return (
    !message.author.bot &&
    Boolean(message.guildId) &&
    message.content.trim().startsWith(config.botPrefix)
  );
}
