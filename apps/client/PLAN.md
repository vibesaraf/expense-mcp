# MCP AI Chatbot — Project Plan

## Overview

A Next.js chatbot application that connects to MCP (Model Context Protocol) servers via HTTP transport, with runtime model selection (Anthropic, OpenAI, Google Gemini) and a settings UI for managing MCP server connections. Built with AI SDK v6, shadcn/ui, and TypeScript.

---

## Documentation Reference Index

| Resource | URL |
|----------|-----|
| **Getting Started** | |
| Next.js App Router Quickstart | https://ai-sdk.dev/docs/getting-started/nextjs-app-router |
| Choosing a Provider | https://ai-sdk.dev/docs/getting-started/choosing-a-provider |
| Navigating the Library | https://ai-sdk.dev/docs/getting-started/navigating-the-library |
| **AI SDK Core** | |
| Core Overview | https://ai-sdk.dev/docs/ai-sdk-core/overview |
| Generating Text (`streamText`) | https://ai-sdk.dev/docs/ai-sdk-core/generating-text |
| Tool Calling | https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling |
| MCP Tools (Model Context Protocol) | https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools |
| Settings (temperature, maxTokens, etc.) | https://ai-sdk.dev/docs/ai-sdk-core/settings |
| Provider & Model Management | https://ai-sdk.dev/docs/ai-sdk-core/provider-management |
| Error Handling (Core) | https://ai-sdk.dev/docs/ai-sdk-core/error-handling |
| **AI SDK UI** | |
| UI Overview (`useChat`, `useCompletion`, `useObject`) | https://ai-sdk.dev/docs/ai-sdk-ui/overview |
| Chatbot (useChat guide) | https://ai-sdk.dev/docs/ai-sdk-ui/chatbot |
| Chatbot Tool Usage | https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage |
| Chatbot Message Persistence | https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence |
| Streaming Custom Data | https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data |
| Transport Configuration | https://ai-sdk.dev/docs/ai-sdk-ui/transport |
| Message Metadata | https://ai-sdk.dev/docs/ai-sdk-ui/message-metadata |
| Error Handling (UI) | https://ai-sdk.dev/docs/ai-sdk-ui/error-handling |
| Stream Protocols | https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol |
| **API References** | |
| `streamText` Reference | https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text |
| `createMCPClient` Reference | https://ai-sdk.dev/docs/reference/ai-sdk-core/create-mcp-client |
| `useChat` Reference | https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat |
| **Providers** | |
| All Providers Overview | https://ai-sdk.dev/providers/ai-sdk-providers |
| Anthropic Provider (`@ai-sdk/anthropic`) | https://ai-sdk.dev/providers/ai-sdk-providers/anthropic |
| OpenAI Provider (`@ai-sdk/openai`) | https://ai-sdk.dev/providers/ai-sdk-providers/openai |
| Google Generative AI (`@ai-sdk/google`) | https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai |
| Providers & Models (Foundations) | https://ai-sdk.dev/docs/foundations/providers-and-models |
| **Agents** | |
| Agents Overview | https://ai-sdk.dev/docs/agents/overview |
| Building Agents | https://ai-sdk.dev/docs/agents/building-agents |
| Loop Control (`stopWhen`, `stepCountIs`) | https://ai-sdk.dev/docs/agents/loop-control |
| **Cookbook** | |
| Next.js MCP Tools | https://ai-sdk.dev/cookbook/next/mcp-tools |
| Multi-Step streamText | https://ai-sdk.dev/cookbook/next/stream-text-multistep |
| **External** | |
| MCP Specification | https://modelcontextprotocol.io/ |
| MCP OAuth Specification | https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization |
| MCP TypeScript SDK | https://github.com/modelcontextprotocol/typescript-sdk |
| shadcn/ui | https://ui.shadcn.com |
| Next.js Docs | https://nextjs.org/docs |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| AI SDK | `ai` v6 + `@ai-sdk/react` — [Overview](https://ai-sdk.dev/docs/ai-sdk-core/overview) |
| LLM Providers | `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google` — [Providers](https://ai-sdk.dev/providers/ai-sdk-providers) |
| MCP Client | `@ai-sdk/mcp` (HTTP transport with `authProvider`) — [MCP Docs](https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools) |
| UI Components | [shadcn/ui](https://ui.shadcn.com) + Tailwind CSS v4 |
| State Persistence | localStorage (single user, MCP server configs) |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Browser (Client)                                │
│                                                  │
│  ┌──────────────┐  ┌─────────────────────────┐  │
│  │ Chat UI      │  │ Settings Panel          │  │
│  │ (useChat)    │  │ - Model selector        │  │
│  │              │  │ - MCP server manager    │  │
│  │              │  │   (add/remove/edit)     │  │
│  └──────┬───────┘  └───────────┬─────────────┘  │
│         │                      │                 │
│         │  sendMessage()       │  POST config    │
└─────────┼──────────────────────┼─────────────────┘
          │                      │
          ▼                      ▼
┌─────────────────────────────────────────────────┐
│  Next.js API Routes (Server)                     │
│                                                  │
│  POST /api/chat                                  │
│  ├─ Reads model + MCP config from request body   │
│  ├─ Creates MCP clients (HTTP transport)         │
│  ├─ Gathers tools from all MCP servers           │
│  ├─ Calls streamText() with selected model       │
│  └─ Returns UIMessageStreamResponse              │
│                                                  │
│  POST /api/mcp/test                              │
│  └─ Tests MCP server connectivity                │
│                                                  │
│  GET/POST /api/mcp/oauth/callback                │
│  └─ Handles OAuth redirect callback for MCP      │
└─────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────┐
│  External MCP Servers (HTTP)                     │
│  - Remote: https://mcp.example.com/mcp          │
│  - Local:  http://localhost:3001/mcp            │
│                                                  │
│  OAuth Support:                                  │
│  - DCR (Dynamic Client Registration)            │
│  - CIMD (Client ID Metadata Document)           │
│  - Bearer token / API key auth                  │
└─────────────────────────────────────────────────┘
```

---

## Feature Breakdown

### Phase 1 — Core Chat (MVP)

**Goal:** Working chatbot with runtime model selection, no MCP yet.

**Key docs:**
- [Next.js App Router Quickstart](https://ai-sdk.dev/docs/getting-started/nextjs-app-router) — scaffolding, route handler, `useChat` basics
- [Chatbot Guide](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot) — `useChat` hook, `sendMessage`, status, error handling
- [`useChat` Reference](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat) — full API surface
- [`streamText` Reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text) — server-side streaming
- [Providers & Models](https://ai-sdk.dev/docs/foundations/providers-and-models) — provider abstraction
- [Choosing a Provider](https://ai-sdk.dev/docs/getting-started/choosing-a-provider) — setup guide
- Provider-specific docs: [Anthropic](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic), [OpenAI](https://ai-sdk.dev/providers/ai-sdk-providers/openai), [Google](https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai)

| # | Task | Files |
|---|------|-------|
| 1.1 | Scaffold Next.js 15 + Tailwind + shadcn/ui | `package.json`, config files |
| 1.2 | Create chat API route with multi-provider support | `app/api/chat/route.ts` |
| 1.3 | Build chat UI with `useChat` hook + shadcn components | `app/page.tsx`, `components/chat/` |
| 1.4 | Model selector (provider + model dropdown) | `components/model-selector.tsx` |
| 1.5 | Pass selected model from client → API via request `body` | Wire client ↔ server |

**Key implementation details:**

Model selection sent as `{ provider, model }` in the request body alongside messages. Uses the [custom body fields per request](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot#setting-custom-body-fields-per-request) pattern from the Chatbot guide. API route dynamically instantiates the correct provider using [Provider Management](https://ai-sdk.dev/docs/ai-sdk-core/provider-management).

```
# .env.local
ANTHROPIC_API_KEY=sk-...
OPENAI_API_KEY=sk-...
GOOGLE_GENERATIVE_AI_API_KEY=...
```

### Phase 2 — MCP Server Management

**Goal:** Settings UI to add/remove/configure MCP servers, stored in localStorage.

**Key docs:**
- [MCP Tools Guide](https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools) — transport types, `authProvider`, client lifecycle
- [`createMCPClient` Reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/create-mcp-client) — full API, capabilities, options
- [MCP Specification](https://modelcontextprotocol.io/) — protocol details, OAuth spec for DCR/CIMD

| # | Task | Files |
|---|------|-------|
| 2.1 | MCP server config type definition | `lib/types.ts` |
| 2.2 | Settings panel (sheet/dialog) with add/edit/remove | `components/settings/` |
| 2.3 | MCP server form (URL, auth type, credentials) | `components/settings/mcp-server-form.tsx` |
| 2.4 | localStorage persistence hook | `hooks/use-mcp-servers.ts` |
| 2.5 | Test connection endpoint | `app/api/mcp/test/route.ts` |

**MCP Server Config Shape:**
```typescript
type MCPServerConfig = {
  id: string;
  name: string;
  url: string;                          // HTTP endpoint
  enabled: boolean;
  authType: 'none' | 'bearer' | 'oauth';
  // For bearer auth:
  apiKey?: string;
  // For OAuth (DCR/CIMD handled by SDK):
  oauthConfig?: {
    clientId?: string;                  // For CIMD (pre-registered)
    clientSecret?: string;
    // DCR: if no clientId, SDK auto-registers
  };
};
```

### Phase 3 — MCP Integration with Chat

**Goal:** Connect MCP servers to the chat, tools auto-discovered.

**Key docs:**
- [MCP Tools — Using MCP Tools](https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools#using-mcp-tools) — `mcpClient.tools()` schema discovery
- [MCP Tools — Closing the Client](https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools#closing-the-mcp-client) — lifecycle management with `onFinish`
- [MCP Tools — HTTP Transport](https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools#http-transport-recommended) — `authProvider`, headers config
- [Chatbot Tool Usage](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage) — rendering tool calls in UI
- [Loop Control (`stopWhen`)](https://ai-sdk.dev/docs/agents/loop-control) — multi-step tool calls
- [Next.js MCP Tools Cookbook](https://ai-sdk.dev/cookbook/next/mcp-tools) — complete Next.js + MCP example

| # | Task | Files |
|---|------|-------|
| 3.1 | Create MCP clients from config in API route | `lib/mcp.ts` |
| 3.2 | Gather tools from all enabled MCP servers | `app/api/chat/route.ts` |
| 3.3 | Pass MCP configs from client → server via body | Update chat transport |
| 3.4 | Display tool calls/results in chat UI | `components/chat/tool-part.tsx` |
| 3.5 | Handle MCP client lifecycle (close on finish) | `lib/mcp.ts` |

**API Route Flow (Phase 3):**
```typescript
// app/api/chat/route.ts (simplified)
// Docs: https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text
// Docs: https://ai-sdk.dev/docs/reference/ai-sdk-core/create-mcp-client
export async function POST(req: Request) {
  const { messages, model, mcpServers } = await req.json();

  // 1. Create MCP clients for each enabled server
  // See: https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools#http-transport-recommended
  const mcpClients = await Promise.all(
    mcpServers.filter(s => s.enabled).map(s =>
      createMCPClient({
        transport: {
          type: 'http',
          url: s.url,
          headers: s.authType === 'bearer'
            ? { Authorization: `Bearer ${s.apiKey}` }
            : undefined,
          authProvider: s.authType === 'oauth'
            ? buildOAuthProvider(s.oauthConfig)
            : undefined,
        },
      })
    )
  );

  // 2. Gather all tools via schema discovery
  // See: https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools#schema-discovery
  const allTools = Object.assign(
    {},
    ...(await Promise.all(mcpClients.map(c => c.tools())))
  );

  // 3. Stream with selected model + multi-step tool calls
  // See: https://ai-sdk.dev/docs/agents/loop-control
  const result = streamText({
    model: getModel(model.provider, model.modelId),
    messages: await convertToModelMessages(messages),
    tools: allTools,
    stopWhen: stepCountIs(10),
    onFinish: async () => {
      // See: https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools#closing-the-mcp-client
      await Promise.all(mcpClients.map(c => c.close()));
    },
  });

  return result.toUIMessageStreamResponse();
}
```

### Phase 4 — OAuth Flow (DCR + CIMD)

**Goal:** Full OAuth support for MCP servers that require it.

**Key docs:**
- [MCP Tools — HTTP Transport `authProvider`](https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools#http-transport-recommended) — how to pass `authProvider` to transport
- [`createMCPClient` Reference — `authProvider`](https://ai-sdk.dev/docs/reference/ai-sdk-core/create-mcp-client) — full type definitions
- [MCP OAuth Specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization) — DCR & CIMD protocol details
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) — reference `OAuthClientProvider` implementation

| # | Task | Files |
|---|------|-------|
| 4.1 | OAuth callback API route | `app/api/mcp/oauth/callback/route.ts` |
| 4.2 | OAuth state/token persistence (server-side) | `lib/oauth-store.ts` |
| 4.3 | Build `authProvider` implementation | `lib/mcp-auth-provider.ts` |
| 4.4 | UI flow: redirect user → authorize → return | Settings panel update |

**How DCR vs CIMD works:**
- The AI SDK's HTTP transport accepts an `authProvider` that implements the MCP OAuth spec
- **CIMD:** User provides a `clientId` (pre-registered) → SDK uses it directly
- **DCR:** No `clientId` provided → SDK auto-registers a new client with the MCP server
- The `authProvider` handles token refresh, storage, and the redirect flow
- Both are handled by the same `authProvider` interface — the difference is just whether `clientId` is pre-known

### Phase 5 — Polish & UX

**Key docs:**
- [Chatbot — Status States](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot#status) — `submitted`, `streaming`, `ready`, `error`
- [Chatbot — Error State](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot#error-state) — error display + retry
- [Chatbot — Cancellation & Regeneration](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot#cancellation-and-regeneration) — stop/regenerate
- [UI Error Handling](https://ai-sdk.dev/docs/ai-sdk-ui/error-handling) — comprehensive error patterns
- [Message Metadata](https://ai-sdk.dev/docs/ai-sdk-ui/message-metadata) — token usage display
- [Streaming Custom Data](https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data) — custom data parts

| # | Task |
|---|------|
| 5.1 | Connected MCP servers indicator in chat header |
| 5.2 | Tool call visualization (collapsible, formatted) |
| 5.3 | Loading/streaming states with skeleton UI |
| 5.4 | Error handling (MCP connection failures, model errors) |
| 5.5 | Dark/light mode toggle |
| 5.6 | Mobile responsive layout |

---

## File Structure

```
my-mcp-chatbot/
├── app/
│   ├── api/
│   │   ├── chat/
│   │   │   └── route.ts              # Main chat endpoint
│   │   └── mcp/
│   │       ├── test/
│   │       │   └── route.ts          # Test MCP connectivity
│   │       └── oauth/
│   │           └── callback/
│   │               └── route.ts      # OAuth redirect handler
│   ├── layout.tsx
│   ├── page.tsx                       # Main chat page
│   └── globals.css
├── components/
│   ├── chat/
│   │   ├── chat.tsx                   # Main chat container
│   │   ├── message-list.tsx           # Message rendering
│   │   ├── message-input.tsx          # Input + send
│   │   └── tool-part.tsx             # Tool call/result display
│   ├── settings/
│   │   ├── settings-panel.tsx         # Settings sheet/dialog
│   │   ├── model-selector.tsx         # Provider + model picker
│   │   └── mcp-server-form.tsx        # Add/edit MCP server
│   └── ui/                            # shadcn components
├── hooks/
│   ├── use-mcp-servers.ts             # MCP config persistence
│   └── use-model-selection.ts         # Model selection state
├── lib/
│   ├── types.ts                       # Shared types
│   ├── models.ts                      # Provider/model registry
│   ├── mcp.ts                         # MCP client factory
│   ├── mcp-auth-provider.ts           # OAuth authProvider impl
│   └── oauth-store.ts                 # Token persistence
├── .env.local
├── package.json
└── tsconfig.json
```

---

## Models Registry

```typescript
// lib/models.ts
// Docs: https://ai-sdk.dev/docs/foundations/providers-and-models
// Anthropic: https://ai-sdk.dev/providers/ai-sdk-providers/anthropic
// OpenAI: https://ai-sdk.dev/providers/ai-sdk-providers/openai
// Google: https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai

export const PROVIDERS = {
  anthropic: {
    name: 'Anthropic',
    models: [
      { id: 'claude-sonnet-4-5-20250514', label: 'Claude Sonnet 4.5' },
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
    ],
  },
  openai: {
    name: 'OpenAI',
    models: [
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    ],
  },
  google: {
    name: 'Google',
    models: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    ],
  },
} as const;
```

---

## Estimated Effort

| Phase | Scope | Est. Time |
|-------|-------|-----------|
| Phase 1 | Core chat + model selection | ~2-3 hours |
| Phase 2 | MCP server management UI | ~2-3 hours |
| Phase 3 | MCP ↔ chat integration | ~2-3 hours |
| Phase 4 | OAuth (DCR/CIMD) | ~3-4 hours |
| Phase 5 | Polish & UX | ~2-3 hours |
| **Total** | | **~11-16 hours** |

---

## Key Minimal-Code Decisions

1. **AI SDK v6 [`useChat`](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot)** handles all chat state, streaming, message management — zero custom state management needed
2. **[`createMCPClient`](https://ai-sdk.dev/docs/reference/ai-sdk-core/create-mcp-client) with HTTP transport** auto-discovers tools via `mcpClient.tools()` — no manual tool definitions
3. **[`authProvider` on transport](https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools#http-transport-recommended)** handles both DCR and CIMD — the SDK manages the OAuth flow internally, we just provide the provider interface
4. **[shadcn/ui](https://ui.shadcn.com)** gives us pre-built, styled components (Sheet, Dialog, Button, Input, Select, etc.)
5. **[Request body for config](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot#setting-custom-body-fields-per-request)** — model + MCP server configs sent per-request, no server-side session management needed
6. **localStorage** for MCP configs — no database needed for single-user deployable app

---

## Open Considerations

- **Security:** API keys for MCP servers are stored in localStorage and sent to the server per-request. For production, consider encrypting or storing server-side.
- **OAuth tokens:** Need server-side storage (file-based or KV store) since OAuth redirects happen server-side.
- **Rate limits:** Each chat message creates fresh MCP clients. For high-traffic, consider connection pooling.
- **Deployment:** Stdio transport won't work when deployed (e.g., Vercel). HTTP-only is the right choice for deployability.