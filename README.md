# EchoMate

EchoMate is a web application that enables speech-to-speech conversations using Moonshine for speech recognition, Kokoro for text-to-speech synthesis, and Silero-VAD for voice activity detection. The app features a tabbed interface for conversation, settings, and credits.

## Warning
- This project it pure client side and depends heavily on WebGPU support in the browser and is only tested with Chrome !!!!!
- Optionally you can use a local LLM server like llama.cpp in the settings.

## Features
- Real-time voice activity detection (VAD)
- Speech-to-text (STT) using Moonshine
- Text-to-speech (TTS) synthesis with Kokoro
- Configurable server endpoint, system prompt, and voice selection
- Modern, responsive web UI

## Usage
- You should be able to just talk.
- Use the **Settings** tab to configure the chat server URL, system prompt, and select a TTS voice.
- View open source credits in the **Credits** tab.

## Credits
- [Silero-VAD](https://github.com/snakers4/silero-vad) - Voice activity detection
- [vad (ricky0123)](https://github.com/ricky0123/vad) - Browser VAD implementation
- [Moonshine](https://github.com/usefulsensors/moonshine) - Speech recognition
- [Kokoro](https://github.com/hexgrad/kokoro) - Text-to-speech synthesis
- [Transformers.js](https://github.com/huggingface/transformers.js) - Machine learning library for running Transformers models in the browser
- [SmolLM2-1.7B-Instruct](https://huggingface.co/HuggingFaceTB/SmolLM2-1.7B-Instruct) - Language model by Hugging Face for instruction-following tasks

## License
[LICENSE](LICENSE) for Me and Kokoro.
[MOONSHINE_LICENSE](MOONSHINE_LICENSE) for Moonshine STT.
[SILERO_LICENSE](SILERO_LICENSE) for Silero VAD.
