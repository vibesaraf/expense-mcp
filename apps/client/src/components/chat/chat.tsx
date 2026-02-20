"use client";

import * as React from "react";
import { useChat } from "@ai-sdk/react";
import { ModelSelector } from "@/components/model-selector";
import { MessageList } from "@/components/chat/message-list";
import { MessageInput } from "@/components/chat/message-input";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { useMcpServers } from "@/hooks/use-mcp-servers";
import { DEFAULT_MODEL_CONFIG, type ModelConfig } from "@/lib/models";

export function Chat() {
  const [model, setModel] = React.useState<ModelConfig>(DEFAULT_MODEL_CONFIG);
  const { servers } = useMcpServers();
  const enabledServers = React.useMemo(
    () => servers.filter((server) => server.enabled),
    [servers],
  );

  const [input, setInput] = React.useState("");

  const { messages, status, error, regenerate, sendMessage, clearError } =
    useChat({
      onError: (error: Error) => {
        console.error("Chat error:", error);
      },
    });

  const isLoading = status === "submitted" || status === "streaming";
  const isReady = status === "ready";

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;
    const currentInput = input;
    setInput("");
    // Pass model + MCP config in the body of the request
    await sendMessage(
      { text: currentInput },
      { body: { model, mcpServers: enabledServers } },
    );
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto border-x bg-background shadow-sm">
      <header className="flex items-center justify-between gap-4 p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10">
        <h1 className="text-xl font-bold tracking-tight">AI Chat</h1>
        <div className="flex items-center gap-2">
          <ModelSelector
            model={model}
            onModelChange={setModel}
            disabled={isLoading}
          />
          <SettingsPanel />
        </div>
      </header>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 text-sm text-center">
          An error occurred. Please check your API keys and try again.
          <button
            onClick={() => {
              clearError();
              regenerate({ body: { model, mcpServers: enabledServers } });
            }}
            className="underline ml-2"
          >
            Retry
          </button>
        </div>
      )}

      <MessageList messages={messages} />

      <MessageInput
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
        isLoading={!isReady}
      />
    </div>
  );
}
