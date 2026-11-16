# CJO AI Sense — changed files only

Drop these into your project at the matching paths (they overwrite the same
relative paths in your repo).

## New files
- `api/ai-chat.js` — the chat endpoint (POST /api/ai-chat)
- `api/_lib/aiQuery.js` — deterministic filter/aggregate query engine
- `api/_lib/aiDataset.js` — normalizes KV data into queryable sources
- `api/_lib/aiPrompt.js` — system prompt (field docs for the model)
- `src/new-ui/tabs/AiSenseView.jsx` — the chat UI component

## Modified files (edit existing files at these paths)
- `src/new-ui/NewUI.jsx` — added the "aisense" tab entry + routing
- `src/new-ui/components/Sidebar.jsx` — added nav icon + "Assistant" group
- `src/new-ui/new-ui.css` — appended `.nu-chat*` styles at the end of the file

## Setup
1. Get a free key at console.groq.com → API Keys
2. Set env var `GROQ_API_KEY` (e.g. in Vercel project settings)
3. Deploy
