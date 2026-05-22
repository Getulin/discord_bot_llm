import {
  AudioPlayer,
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  VoiceConnection,
  VoiceConnectionStatus
} from "@discordjs/voice";

export function makeAudioPlayer(): AudioPlayer {
  return createAudioPlayer();
}

export async function playAudioFile(
  connection: VoiceConnection,
  player: AudioPlayer,
  filePath: string
): Promise<void> {
  if (connection.state.status !== VoiceConnectionStatus.Ready) {
    await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
  }

  const resource = createAudioResource(filePath);
  connection.subscribe(player);
  player.play(resource);

  await entersState(player, AudioPlayerStatus.Idle, 60_000);
}
