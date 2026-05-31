# discord_bot_llm

Bot de Discord em Node.js/TypeScript que entra em uma call, escuta audio dos usuarios e responde por voz somente quando a palavra-chave configurada e detectada. O bot pode rodar com `whisper.cpp` para transcricao, Groq ou Ollama para resposta, e Piper ou OpenAI para voz. O bot nao usa interface web do ChatGPT, automacao de navegador, cookies, login pessoal ou scraping.

## Arquitetura

- `src/index.ts`: valida configuracao, cria o diretorio temporario e inicia o client.
- `src/discord/commands.ts`: comandos `!entrar`, `!sair`, `!mutarbot`, `!desmutarbot`, `!statusbot` e `!privacidade`.
- `src/discord/voiceConnection.ts`: sessao de voz por servidor, receiver de audio, cooldown, mute e bloqueio enquanto o bot fala.
- `src/audio/recorder.ts`: captura audio Opus do Discord ate silencio e decodifica para PCM temporario.
- `src/audio/converter.ts`: converte PCM para WAV com ffmpeg.
- `src/services/transcribe.ts`: escolhe entre OpenAI e whisper.cpp para transcricao.
- `src/services/localTranscribe.ts`: transcricao local com whisper.cpp.
- `src/services/assistantText.ts`: escolhe entre OpenAI, Groq e Ollama para gerar a resposta.
- `src/services/openaiText.ts`: resposta curta usando a API oficial da OpenAI.
- `src/services/groqText.ts`: resposta usando Groq via API compativel com OpenAI.
- `src/services/ollamaText.ts`: resposta curta usando Ollama local via API HTTP.
- `src/services/tts.ts`: escolhe entre OpenAI e Piper para text-to-speech.
- `src/services/localTts.ts`: voz local com Piper.
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
WAKE_WORD=Varys
WAKE_WORD_ALIASES=verris,veris,varis,vares
STT_PROVIDER=local
AI_TEXT_PROVIDER=groq
TTS_PROVIDER=local
OPENAI_TEXT_MODEL=gpt-4.1-mini
OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=alloy
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2:3b
OLLAMA_TEMPERATURE=0.4
OLLAMA_NUM_PREDICT=90
OLLAMA_TIMEOUT_MS=45000
GROQ_API_KEY=
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_TEMPERATURE=0.35
GROQ_MAX_TOKENS=220
GROQ_TIMEOUT_MS=30000
WHISPER_CPP_BIN=whisper-cli
WHISPER_CPP_MODEL=models/whisper/ggml-base.bin
WHISPER_CPP_LANGUAGE=pt
WHISPER_CPP_THREADS=4
WHISPER_CPP_PROMPT=Palavra de ativacao: Varys. Tambem pode soar como Verris em portugues. Termos comuns: creatina, suplemento, treino, academia, proteina, criptografia.
WHISPER_NO_SPEECH_THRESHOLD=0.35
WHISPER_CPP_TIMEOUT_MS=120000
PIPER_BIN=piper
PIPER_MODEL=models/piper/pt_BR-faber-medium.onnx
PIPER_CONFIG=models/piper/pt_BR-faber-medium.onnx.json
PIPER_SPEAKER=
PIPER_TIMEOUT_MS=60000
BOT_PREFIX=!
COOLDOWN_MS=5000
SILENCE_DURATION_MS=1000
SEMI_REALTIME_STT=false
AUDIO_CHUNK_MS=4000
AUDIO_MIN_CHUNK_MS=1500
AUDIO_CHUNK_CONCURRENCY=2
MAX_RESPONSE_CHARS=450
TMP_AUDIO_DIR=tmp/audio
DEBUG=false
```

## Modo 100% Local

Para nao pagar tokens/API, use:

- `whisper.cpp`: fala para texto.
- `Ollama`: texto para resposta.
- `Piper`: resposta para voz.

Configure:

```env
STT_PROVIDER=local
AI_TEXT_PROVIDER=ollama
TTS_PROVIDER=local
```

Com esses tres provedores locais, `OPENAI_API_KEY` nao e necessaria.

## Groq Para Respostas

Groq costuma ser mais rapido e mais inteligente que modelos pequenos locais no Ollama. Use quando quiser manter transcricao e voz locais, mas melhorar a resposta:

```env
STT_PROVIDER=local
AI_TEXT_PROVIDER=groq
TTS_PROVIDER=local
GROQ_API_KEY=sua_chave_da_groq
GROQ_MODEL=llama-3.3-70b-versatile
```

Para uma resposta ainda mais rapida e mais simples:

```env
GROQ_MODEL=llama-3.1-8b-instant
```

### Ollama

1. Instale o Ollama: https://ollama.com
2. Baixe um modelo:

```bash
ollama pull llama3.2:3b
```

3. Garanta que o Ollama esta rodando:

```bash
ollama serve
```

4. Configure no `.env`:

```env
AI_TEXT_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2:3b
```

### whisper.cpp

Instale ou compile o whisper.cpp: https://github.com/ggml-org/whisper.cpp

No Windows, voce pode usar um release pronto ou compilar pelo guia do projeto. O executavel costuma se chamar `whisper-cli.exe`. Baixe tambem um modelo GGML, por exemplo `ggml-base.bin` ou `ggml-small.bin`, e coloque em `models/whisper/`.

Configure:

```env
STT_PROVIDER=local
WHISPER_CPP_BIN=C:\caminho\para\whisper-cli.exe
WHISPER_CPP_MODEL=C:\caminho\para\ggml-base.bin
WHISPER_CPP_LANGUAGE=pt
```

Se `whisper-cli` estiver no `PATH`, pode deixar:

```env
WHISPER_CPP_BIN=whisper-cli
```

### Piper

Baixe o Piper: https://github.com/rhasspy/piper

Baixe uma voz `.onnx` e o arquivo `.onnx.json` correspondente. Para portugues brasileiro, este projeto usa por padrao `pt_BR-faber-medium`. Coloque os arquivos em `models/piper/` ou aponte para os arquivos em `tools/piper/models/`.

Configure:

```env
TTS_PROVIDER=local
PIPER_BIN=C:\caminho\para\piper.exe
PIPER_MODEL=C:\caminho\para\pt_BR-faber-medium.onnx
PIPER_CONFIG=C:\caminho\para\pt_BR-faber-medium.onnx.json
```

Se `piper` estiver no `PATH`, pode deixar:

```env
PIPER_BIN=piper
```

### Modo Hibrido

Para voltar a usar OpenAI em qualquer etapa:

```env
STT_PROVIDER=openai
AI_TEXT_PROVIDER=openai
TTS_PROVIDER=openai
```

Voce tambem pode misturar, por exemplo: whisper.cpp local para transcricao, Groq para resposta e Piper local para voz.

## Rodando

Use Node.js 22 LTS. A camada de voz do Discord pode ficar presa em `signalling` ou cair com versoes muito novas do Node, como Node 24.

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
- `!statusbot`: mostra conexao, palavra-chave, provedores de transcricao/resposta/voz, mute e processamento.
- `!privacidade`: explica como audio, transcricao, resposta e voz sao usados.

Exemplo de acionamento: `Varys, qual e a capital da Franca?`

O bot transcreve o trecho, verifica a palavra-chave, remove `Varys` e envia somente `qual e a capital da Franca?` para a geracao de resposta.

## Privacidade

Ao entrar na call, o bot envia:

> O bot entrou na call. Ele processa audio apenas para identificar a palavra-chave configurada e responder quando acionado. Audios e transcricoes sao temporarios e nao sao salvos permanentemente. Use !privacidade para mais detalhes.

Resposta do comando `!privacidade`:

> Este bot transcreve solicitacoes acionadas por palavra-chave, gera uma resposta curta e reproduz a resposta por voz. As etapas podem usar provedores locais, como whisper.cpp, Ollama e Piper, ou APIs oficiais como Groq e OpenAI conforme configuracao. Ele nao acessa sua conta pessoal do ChatGPT. Audios e transcricoes sao usados temporariamente durante o processamento e descartados em seguida. O bot nao mantem historico permanente da call.

Aviso pronto para colocar no servidor:

> Este servidor pode usar um bot de voz com IA. O bot processa audio temporariamente apenas para detectar uma palavra-chave configurada e responder quando acionado. As etapas podem rodar localmente com whisper.cpp, Ollama e Piper, ou usar APIs oficiais como Groq e OpenAI conforme configuracao. Audios e transcricoes nao sao salvos permanentemente pelo bot, e ele nao usa contas pessoais do ChatGPT.

## Referencias

- Groq rate limits: https://console.groq.com/docs/rate-limits
- API de chat do Ollama: https://docs.ollama.com/api/chat
- Documentacao geral da API: https://docs.ollama.com/api
- whisper.cpp: https://github.com/ggml-org/whisper.cpp
- Piper: https://github.com/rhasspy/piper

## Logs e dados

Os logs nao registram falas completas, transcricoes completas, respostas completas, tokens ou variaveis sensiveis. Em `DEBUG=true`, conteudos continuam mascarados.

Arquivos temporarios podem ser criados em `TMP_AUDIO_DIR` para transcricao e resposta por voz. Eles sao removidos em bloco `finally`, inclusive em caso de erro.

## Limitações conhecidas sobre audio no Discord

Receber audio com `@discordjs/voice` depende do receiver de voz, que e uma area menos estavel que tocar audio. O bot usa `selfDeaf: false`, captura quando o usuario comeca a falar e encerra depois de silencio configuravel. Em servidores com rede instavel, perdas de pacote, permissoes incompletas ou versoes antigas de dependencias, a captura pode falhar ou gerar transcricoes incompletas.

O bot tambem ignora novas falas enquanto esta processando uma fala e ignora audio enquanto esta reproduzindo a propria resposta para reduzir loops.
