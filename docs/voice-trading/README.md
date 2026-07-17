# Voice trading

Providers are pluggable via `voice-core`:

- STT: mock, local_whisper, openai_whisper, azure, google, aws (placeholders until keys)
- TTS: mock, azure, google, aws, openai

`DEFAULT_STT_PROVIDER` / `DEFAULT_TTS_PROVIDER` control routing; unavailable providers fall back to mock.

WebSocket: `WS /voice/live-session` on the voice gateway for streaming transcription ACKs.
Full assistant turns use `POST /voice/command`.
