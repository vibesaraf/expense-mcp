"use client";

import * as React from "react";
import type { MCPServerConfig, MCPServerFormValues } from "@/lib/types";

const STORAGE_KEY = "mcp-servers";

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeServer(server: MCPServerConfig): MCPServerConfig {
  return {
    ...server,
    name: server.name ?? "",
    url: server.url ?? "",
    enabled: server.enabled ?? true,
    authType: server.authType ?? "none",
  };
}

function readServersFromStorage(): MCPServerConfig[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((server): server is MCPServerConfig => {
        return !!server && typeof server === "object" && "id" in server;
      })
      .map(normalizeServer);
  } catch {
    return [];
  }
}

function buildServerConfig(
  values: MCPServerFormValues,
  options?: { id?: string; enabled?: boolean },
): MCPServerConfig {
  const authType = values.authType;
  const base: MCPServerConfig = {
    id: options?.id ?? createId(),
    name: values.name.trim(),
    url: values.url.trim(),
    enabled: options?.enabled ?? true,
    authType,
  };

  if (authType === "bearer") {
    base.apiKey = values.apiKey?.trim() || undefined;
  }

  if (authType === "oauth") {
    base.oauthConfig = {
      clientId: values.oauthClientId?.trim() || undefined,
      clientSecret: values.oauthClientSecret?.trim() || undefined,
    };
  }

  return base;
}

export function useMcpServers() {
  const [servers, setServers] = React.useState<MCPServerConfig[]>([]);
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    setServers(readServersFromStorage());
    setIsReady(true);
  }, []);

  React.useEffect(() => {
    if (!isReady) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(servers));
  }, [servers, isReady]);

  const addServer = React.useCallback((values: MCPServerFormValues) => {
    const next = buildServerConfig(values);
    setServers((prev) => [...prev, next]);
    return next;
  }, []);

  const updateServer = React.useCallback(
    (id: string, values: MCPServerFormValues) => {
      setServers((prev) =>
        prev.map((server) =>
          server.id === id
            ? buildServerConfig(values, {
                id,
                enabled: server.enabled,
              })
            : server,
        ),
      );
    },
    [],
  );

  const removeServer = React.useCallback((id: string) => {
    setServers((prev) => prev.filter((server) => server.id !== id));
  }, []);

  const toggleEnabled = React.useCallback((id: string, enabled: boolean) => {
    setServers((prev) =>
      prev.map((server) =>
        server.id === id ? { ...server, enabled } : server,
      ),
    );
  }, []);

  return {
    servers,
    addServer,
    updateServer,
    removeServer,
    toggleEnabled,
    isReady,
  };
}
