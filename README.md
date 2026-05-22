# discord_bot_llm

Bot de Discord em Node.js/TypeScript que entra em uma call, escuta audio dos usuarios e responde por voz somente quando a palavra-chave configurada e detectada. A integracao usa exclusivamente a API oficial da OpenAI via `OPENAI_API_KEY`; nao usa interface web do ChatGPT, automacao de navegador, cookies, login pessoal ou scraping.

## Arquitetura

- `src/index.ts`: valida configuracao, cria o diretorio temporario e inicia o client.
- `src/discord/commands.ts`: comandos `!entrar`, `!sair`, `!mutarbot`, `!desmutarbot`, `!statusbot` e `!privacidade`.
- `src/discord/voiceConnection.ts`: sessao de voz por servidor, receiver de audio, cooldown, mute e bloqueio enquanto o bot fala.
- `src/audio/recorder.ts`: captura audio Opus do Discord ate silencio e decodifica para PCM temporario.
- `src/audio/converter.ts`: converte PCM para WAV com ffmpeg.
- `src/services/transcribe.ts`: transcricao com a API oficial da OpenAI.
- `src/services/openaiText.ts`: resposta curta usando a API oficial da OpenAI.
- `src/services/tts.ts`: gera MP3 temporario com text-to-speech da OpenAI.
- `src/utils/tempFiles.ts`: cria e apaga arquivos somente dentro de `TMP_AUDIO_DIR`.

## Criando o bot no Discord

1. Acesse o Discord Developer Portal.
2. Crie uma Application e adicione um Bot.
3. Copie o token do bot para `DISCORD_TOKEN` no `.env`.
4. Em Bot > Privileged Gateway Intents, habilite `Message Content Intent`.
5. Convide o bot para o servidor com permissoes para:
   - ler e enviar mensagens;
   - conectar em canais de voz;
   - falar em canais de voz;
   - usar atividade de voz.

## Configuracao

Instale as dependencias:

```bash
npm install
```

Crie o `.env` a partir de `.env.example`:

```env
DISCORD_TOKEN=
OPENAI_API_KEY=
WAKE_WORD=jarvis
OPENAI_TEXT_MODEL=gpt-4.1-mini
OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=alloy
BOT_PREFIX=!
COOLDOWN_MS=5000
SILENCE_DURATION_MS=1200
MAX_RESPONSE_CHARS=700
TMP_AUDIO_DIR=tmp/audio
DEBUG=false
```

Nunca coloque valores reais de token no repositorio. O `.gitignore` ignora `.env` e `tmp/`.

## Rodando

```bash
npm run dev
```

Build e producao:

```bash
npm run build
npm start
```

## Uso

- `!entrar`: entra no canal de voz do usuario que enviou o comando.
- `!sair`: sai da call e informa no canal de texto.
- `!mutarbot`: permanece na call, mas para de responder.
- `!desmutarbot`: volta a responder quando a palavra-chave for usada.
- `!statusbot`: mostra conexao, palavra-chave, mute e processamento.
- `!privacidade`: explica como audio, transcricao e OpenAI sao usados.

Exemplo de acionamento: `Jarvis, qual e a capital da Franca?`

O bot transcreve o trecho, verifica a palavra-chave, remove `Jarvis` e envia somente `qual e a capital da Franca?` para a geracao de resposta.

## Privacidade

Ao entrar na call, o bot envia:

> O bot entrou na call. Ele processa audio apenas para identificar a palavra-chave configurada e responder quando acionado. Audios e transcricoes sao temporarios e nao sao salvos permanentemente. Use !privacidade para mais detalhes.

Resposta do comando `!privacidade`:

> Este bot usa a API oficial da OpenAI para transcrever solicitacoes acionadas por palavra-chave e gerar respostas. Ele nao acessa sua conta pessoal do ChatGPT. Audios e transcricoes sao usados temporariamente durante o processamento e descartados em seguida. O bot nao mantem historico permanente da call.

Aviso pronto para colocar no servidor:

> Este servidor pode usar um bot de voz com IA. O bot processa audio temporariamente apenas para detectar uma palavra-chave configurada e responder quando acionado. Trechos acionados podem ser enviados para a API oficial da OpenAI para transcricao, geracao de resposta e voz. Audios e transcricoes nao sao salvos permanentemente pelo bot, e ele nao usa contas pessoais do ChatGPT.

## Logs e dados

Os logs nao registram falas completas, transcricoes completas, respostas completas, tokens ou variaveis sensiveis. Em `DEBUG=true`, conteudos continuam mascarados.

Arquivos temporarios podem ser criados em `TMP_AUDIO_DIR` para transcricao e resposta por voz. Eles sao removidos em bloco `finally`, inclusive em caso de erro.

## Limitações conhecidas sobre audio no Discord

Receber audio com `@discordjs/voice` depende do receiver de voz, que e uma area menos estavel que tocar audio. O bot usa `selfDeaf: false`, captura quando o usuario comeca a falar e encerra depois de silencio configuravel. Em servidores com rede instavel, perdas de pacote, permissoes incompletas ou versoes antigas de dependencias, a captura pode falhar ou gerar transcricoes incompletas.

O bot tambem ignora novas falas enquanto esta processando uma fala e ignora audio enquanto esta reproduzindo a propria resposta para reduzir loops.
