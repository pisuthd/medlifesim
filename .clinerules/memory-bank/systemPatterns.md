# System Patterns

## Architecture Overview
- **Framework**: Electron with electron-vite
- **Frontend**: React 19 + TypeScript
- **Styling**: Inline styles with design system (no Tailwind on pages)
- **Animations**: Framer Motion
- **Drag & Drop**: @dnd-kit
- **Structure**: Main process / Preload / Renderer separation

## Design System

### Colors
```javascript
const BLUE = '#1A1AE8'
const TEAL = '#3EC4C0'
const NAVY = '#0a0a5c'
const MUTED = '#9999bb'
const LIGHT_BLUE = '#f7f7fc'
```

### Typography
```javascript
const monoFont = "'Space Mono', monospace"
const sansFont = "'DM Sans', sans-serif"
```

### Common Patterns
- SectionLabel component: uppercase label with monoFont
- TealBar: 3px teal accent at top of cards
- Numbered badges with monoFont
- Left-aligned content in main area

## Directory Structure
```
src/
├── main/           # Electron main process
│   ├── index.ts           # Main entry, AI chat, IPC handlers
│   ├── profileStore.ts    # Profile persistence
│   ├── sessions.ts        # Session management
│   ├── toolsStore.ts      # Tool settings persistence
│   └── tools/
│       └── documents/
│           ├── index.ts   # Tool definitions with execute()
│           ├── store.ts   # DocumentsStore singleton
│           ├── handlers.ts # IPC handlers
│           └── ocr.ts     # OCR processing
├── preload/        # Context bridge for IPC
└── renderer/       # React frontend
    └── src/
        ├── components/
        ├── pages/
        │   ├── LoadingScreen/
        │   ├── ProfileSelector/
        │   ├── Dashboard/
        │   ├── Sessions/
        │   ├── Chat/
        │   ├── Documents/
        │   └── Tools/
        └── context/
```

## Page Structure
1. **LoadingScreen** - Model loading with progress
2. **ProfileSelector** - Profile selection/creation (loads profiles internally)
3. **MainLayout** - Sidebar + Content area
   - **Dashboard** - Health insights, recent chats
   - **Sessions** - Table list of conversations
   - **Chat** - Conversation interface
   - **Documents** - Upload and file list
   - **Tools** - Toggle cards for integrations

## Tool System Pattern

### Tool Definition (QVAC SDK compatible)
```typescript
export const getDocumentsTool = {
  type: 'function' as const,
  name: 'get_documents',
  description: '...',
  parameters: {
    type: 'object' as const,
    properties: {},
    required: [],
  },
  execute: async () => {
    const docs = documentsStore.getDocuments()
    return JSON.stringify({ success: true, documents: docs })
  }
}
```

### Tool Call Flow
1. Call completion() with tools array
2. Stream events: contentDelta, thinkingDelta, toolCall
3. After streaming, get result.toolCalls (Promise)
4. Execute each tool via tool.execute()
5. Add results to conversationHistory with role: "tool"
6. Loop back to completion() with updated history
7. Max 3 tool calls to prevent infinite loops

### Documents Store
- Singleton class with setProfile(profileSlug) method
- Stores in: `{userData}/profiles/{profileSlug}/documents/`
- Must call setProfile() before getDocuments() or searchDocuments()

## Key Technical Decisions
- Use HashRouter for Electron (client-side routing)
- Profile loading moved to ProfileSelector component
- Inline styles for consistent design system
- App.tsx manages app state (loading → profile → main)
- documentsStore.setProfile() must be called before tool execution
- Tools require embedded execute function in definition