# Progress

## What Works
- [x] Project scaffold initialized (electron-vite template)
- [x] Electron main process structure
- [x] React renderer with TypeScript
- [x] IPC communication setup
- [x] Development mode with HMR
- [x] TailwindCSS 4.x configured
- [x] Framer Motion installed for animations
- [x] @dnd-kit installed for drag & drop
- [x] React Router with HashRouter (Electron-compatible)
- [x] Loading screen with new design
- [x] Profile selector with contextual forms
- [x] Main layout with sidebar navigation
- [x] Dashboard, Sessions, Chat, Documents, Tools pages
- [x] Profile persistence with IPC (local JSON file)
- [x] **Phase 2** Complete UI redesign with design system
- [x] **Phase 2.1** Fixed sidebar to be sticky
- [x] **Phase 2.2** Sidebar labels, Chat session dropdown, Dashboard hero
- [x] **Phase 3** QVAC AI model loading with download support
- [x] **Phase 3.1** Fire-and-forget model loading, simplified uptime
- [x] **Phase 4** Sessions + Chat + AI integration
- [x] **Phase 4.1** Model loading on startup, LoadingScreen simplified
- [x] **Phase 4.2** ProfileContext for global state, session dropdown fix
- [x] **Phase 4.3** Thinking box above response, trim leading \n
- [x] **Phase 4.4** Session delete/clear functionality
- [x] **Phase 5** Documents storage + AI tools
- [x] **Phase 5.1** Documents page with drag & drop, OCR support
- [x] **Phase 5.2** Tools persistence + system prompt for AI
- [x] **Phase 5.3** Tool call handling loop (like everclaw)
- [x] **Phase 5.4** Fix profile for documentsStore in tool calls

## What's Left to Build
- [ ] RAG implementation with embeddings (future)

## Current Status
- Phase 5: AI Tools with document access working
- Model loads on app startup (download + load)
- Documents page with drag & drop, OCR, quick notes
- Tool system with persistence (tools-config.json)
- Tools page with toggle switches (Documents available, others coming soon)
- AI tool calls: `get_documents`, `search_documents`
- Tool execution loop: completion() → stream → get toolCalls → execute → loop

## Known Issues
- None identified

## AI Model Configuration
- **Model file**: `medpsy-1.7b-q4_k_m-imat.gguf`
- **Download URL**: `https://github.com/pisuthd/my-doctor-ai/releases/download/v.0.1.0/medpsy-1.7b-q4_k_m-imat.gguf`
- **Storage**: `{userData}/medpsy-1.7b-q4_k_m-imat.gguf`
- **GitHub**: Ignored via `.gguf` pattern

## Tool System
- **Storage**: `{userData}/tools-config.json`
- **Tools**:
  - Documents (id: "1") - Available, enables get_documents + search_documents tools
  - Scheduling (id: "2") - Coming Soon
  - Pharmacy (id: "3") - Coming Soon
- **Tool call flow**:
  1. Call completion() with tools array
  2. Stream events (contentDelta, thinkingDelta, toolCall)
  3. Get result.toolCalls after streaming
  4. Execute tools via tool.execute()
  5. Add results to conversationHistory with role: "tool"
  6. Loop back to completion() with updated history
  7. Max 3 tool calls to prevent infinite loops

## Evolution of Project Decisions
- 2026-05-20: Project scaffolded using electron-vite template
- 2026-05-20: Phase 1 - Built all UI page components
- 2026-05-20: Phase 1.1 - Added default Electron menu
- 2026-05-20: Phase 1.2 - UI redesign
- 2026-05-20: Phase 1.3 - Profile persistence with IPC
- 2026-05-20: Phase 2 - Complete UI redesign with design system
- 2026-05-20: Phase 2.1 - Fixed sidebar to be sticky
- 2026-05-20: Phase 2.2 - Sidebar labels, Chat dropdown, Dashboard hero
- 2026-05-20: Phase 3 - QVAC AI model loading with download support
- 2026-05-20: Phase 3.1 - Fire-and-forget model loading, simplified uptime
- 2026-05-20: Phase 4 - Sessions + Chat + AI integration
- 2026-05-20: Phase 4.1 - Model loading on startup, LoadingScreen simplified
- 2026-05-20: Phase 4.2 - ProfileContext, session dropdown fix, new session modal
- 2026-05-20: Phase 4.3 - Thinking box above response, trim leading \n
- 2026-05-20: Phase 4.4 - Session delete/clear functionality
- 2026-05-20: Phase 5 - Documents storage with JSON + AI tools
- 2026-05-20: Phase 5.1 - Documents page with OCR, notes
- 2026-05-20: Phase 5.2 - Tools persistence + system prompt
- 2026-05-20: Phase 5.3 - Tool call handling loop (like everclaw)
- 2026-05-20: Phase 5.4 - Set profile for documentsStore in tool calls