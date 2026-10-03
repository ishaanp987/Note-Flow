# Local AI setup (Windows x64)

Local processing requires no API key or paid AI service. It runs on the CPU or GPU supported by the downloaded tools. Allow several GB of disk space, plus space for your recordings. These steps restore the tools used for the development laptop's real provider checks.

## Download the tools

1. From the official [whisper.cpp v1.9.2 release](https://github.com/ggml-org/whisper.cpp/releases/tag/v1.9.2), download **whisper-bin-x64.zip**. Extract its complete contents, including DLLs and the `Release` folder, into `tools/whisper` in your clone. Verify that `tools/whisper/Release/whisper-cli.exe` exists.
2. Download [ggml-small.en-q5_1.bin](https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en-q5_1.bin) from the official whisper.cpp model repository. Create `models` and put the file there. The tested model's SHA-1 checksum is `20f54878d608f94e4a8ee3ae56016571d47cba34`; PowerShell's `Get-FileHash models/ggml-small.en-q5_1.bin -Algorithm SHA1` should match it.
3. From the official [Ollama v0.35.1 release](https://github.com/ollama/ollama/releases/tag/v0.35.1), download **ollama-windows-amd64.zip**. Extract its complete contents into `tools/ollama`. Verify that `tools/ollama/ollama.exe` exists. Use the portable archive for these instructions.

## Start the service and download the note model

Build the app first, then double-click **Start Lecture Notes.cmd**. If the Ollama tools are in place, the launcher starts the local service with cloud features disabled and model storage inside this project.

In a PowerShell terminal opened in the project folder, run:

```powershell
$env:OLLAMA_HOST = '127.0.0.1:11434'
$env:OLLAMA_NO_CLOUD = '1'
$env:OLLAMA_MODELS = Join-Path $PWD 'models/ollama'
& './tools/ollama/ollama.exe' pull qwen3:4b
& './tools/ollama/ollama.exe' list
```

The download requires internet access; subsequent local inference can run offline. The note model was about 2.5 GB when verified. If port 11434 already has a separately installed Ollama service, stop that service yourself or use its model storage; the launcher will reuse the existing service and will not take ownership of it. This project does not change that service's configuration.

## Configure the app

Open http://127.0.0.1:3100 and select **Settings**. Select the local engine and set:

- Whisper executable: the absolute path to your clone's `tools/whisper/Release/whisper-cli.exe`.
- Whisper model: the absolute path to your clone's `models/ggml-small.en-q5_1.bin`.
- Local note model: `qwen3:4b`.

Save and check that both local tools are ready. Upload a short spoken clip, transcribe it, generate notes, and compare the results with playback before trying a full lecture. Processing speed depends on the laptop and lecture length. Review definitions, examples and source timestamps; AI can omit or misinterpret content.

The paths default to the project folder on a new clone. If you move a configured folder, update them in Settings. Tools and models are excluded from Git; the launcher does not download them automatically. See [verification evidence](VERIFICATION.md) for the checks performed on the development laptop and the remaining acceptance checks.
