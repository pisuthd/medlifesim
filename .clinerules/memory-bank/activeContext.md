# Active Context

## Current Work Focus
- Phase 4: Sessions + Chat + AI integration

## Recent Changes
- Phase 4: Sessions storage with profile-based structure
- Chat page with session param support (?session=slug)
- AI streaming with thinking box display
- Session table shows conversations list
- Click session → navigates to chat with session param
- Session dropdown in Chat page header
- Model loading moved to app startup (download + load)
- LoadingScreen simplified to poll status only

## Next Steps
1. Test chat with AI streaming
2. RAG implementation for document analysis

## Active Decisions and Considerations
- Using QVAC SDK for AI model management
- Model file: medpsy-1.7b-q4_k_m-imat.gguf (local)
- Model loads on app startup with download-if-needed
- Session storage: `{userData}/profiles/{profileSlug}/sessions/{sessionSlug}/messages.json`
- Default session: `main`
- Chat loads/saves messages per session

## Important Patterns and Preferences
- Blue gradient theme (Slack-style)
- Component-based page structure
- Phase-by-phase development with Git commits
- IPC handlers for main process communication

## Learnings and Project Insights
- QVAC SDK provides loadModel/unloadModel for local GGUF models
- completion() with stream: true and captureThinking: true for streaming
- Events: contentDelta, thinkingDelta for UI updates
- IPC send for streaming tokens to renderer
- Model registry persists across app restarts (MODEL_ALREADY_REGISTERED error)
- Model loading should happen once on startup, not triggered by UI