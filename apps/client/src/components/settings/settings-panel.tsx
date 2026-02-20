"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import { McpServerForm } from "@/components/settings/mcp-server-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useMcpServers } from "@/hooks/use-mcp-servers";
import type { MCPServerConfig, MCPServerFormValues } from "@/lib/types";

const AUTH_LABELS: Record<MCPServerConfig["authType"], string> = {
  none: "None",
  bearer: "Bearer",
  oauth: "OAuth",
};

const DEFAULT_FORM_VALUES: MCPServerFormValues = {
  name: "",
  url: "",
  authType: "none",
  apiKey: "",
  oauthClientId: "",
  oauthClientSecret: "",
};

function toFormValues(server?: MCPServerConfig): MCPServerFormValues {
  if (!server) return DEFAULT_FORM_VALUES;
  return {
    name: server.name,
    url: server.url,
    authType: server.authType,
    apiKey: server.apiKey ?? "",
    oauthClientId: server.oauthConfig?.clientId ?? "",
    oauthClientSecret: server.oauthConfig?.clientSecret ?? "",
  };
}

export function SettingsPanel() {
  const searchParams = useSearchParams();
  const {
    servers,
    addServer,
    updateServer,
    removeServer,
    toggleEnabled,
    isReady,
  } = useMcpServers();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<MCPServerConfig | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [oauthStatuses, setOauthStatuses] = React.useState<
    Record<
      string,
      { status: "missing" | "connected" | "expired"; expiresAt?: number }
    >
  >({});
  const [oauthError, setOauthError] = React.useState<string | null>(null);

  const handleAddServer = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleEditServer = (server: MCPServerConfig) => {
    setEditing(server);
    setFormOpen(true);
  };

  const handleSubmit = (values: MCPServerFormValues) => {
    if (editing) {
      updateServer(editing.id, values);
    } else {
      addServer(values);
    }
    setFormOpen(false);
    setEditing(null);
  };

  const handleDialogChange = (open: boolean) => {
    setFormOpen(open);
    if (!open) {
      setEditing(null);
    }
  };

  const fetchOauthStatuses = React.useCallback(async () => {
    const oauthServers = servers.filter(
      (server) => server.authType === "oauth",
    );
    if (oauthServers.length === 0) {
      setOauthStatuses({});
      return;
    }

    try {
      const response = await fetch("/api/mcp/oauth/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverUrls: oauthServers.map((server) => server.url),
        }),
      });

      if (!response.ok) return;

      const data = (await response.json()) as {
        statuses?: Array<{
          url: string;
          status: "missing" | "connected" | "expired";
          expiresAt?: number;
        }>;
      };

      const nextStatuses: Record<
        string,
        { status: "missing" | "connected" | "expired"; expiresAt?: number }
      > = {};

      data.statuses?.forEach((entry) => {
        nextStatuses[entry.url] = {
          status: entry.status,
          expiresAt: entry.expiresAt,
        };
      });

      setOauthStatuses(nextStatuses);
    } catch {
      return;
    }
  }, [servers]);

  const handleOAuthConnect = async (server: MCPServerConfig) => {
    setOauthError(null);
    try {
      const response = await fetch("/api/mcp/oauth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: server.url,
          oauthConfig: server.oauthConfig,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setOauthError(data?.error || "OAuth connection failed.");
        return;
      }

      if (data?.status === "authorized") {
        await fetchOauthStatuses();
        return;
      }

      if (data?.authorizationUrl) {
        window.location.href = data.authorizationUrl as string;
        return;
      }

      setOauthError("OAuth connection failed.");
    } catch (error) {
      setOauthError(
        error instanceof Error ? error.message : "OAuth connection failed.",
      );
    }
  };

  React.useEffect(() => {
    if (sheetOpen) {
      void fetchOauthStatuses();
    }
  }, [sheetOpen, fetchOauthStatuses]);

  React.useEffect(() => {
    const oauthResult = searchParams.get("oauth");
    const oauthMessage = searchParams.get("oauth_error");

    if (oauthResult === "error") {
      setOauthError(oauthMessage ?? "OAuth authorization failed.");
    }

    if (oauthResult === "success") {
      setOauthError(null);
      void fetchOauthStatuses();
    }
  }, [searchParams, fetchOauthStatuses]);

  return (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 />
          Settings
        </Button>
      </SheetTrigger>
      <SheetContent className="flex h-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Manage MCP servers used to discover tools.
          </SheetDescription>
          {oauthError && (
            <p className="text-xs text-destructive">{oauthError}</p>
          )}
        </SheetHeader>

        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-sm font-medium">MCP servers</p>
            <p className="text-xs text-muted-foreground">
              Stored locally in your browser.
            </p>
          </div>
          <Button size="sm" onClick={handleAddServer}>
            <Plus />
            Add server
          </Button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-6">
          {!isReady ? (
            <p className="text-sm text-muted-foreground">Loading servers...</p>
          ) : servers.length === 0 ? (
            <Empty className="border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Settings2 />
                </EmptyMedia>
                <EmptyTitle>No MCP servers yet</EmptyTitle>
                <EmptyDescription>
                  Add a server to test connectivity and prepare for tool usage.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm" onClick={handleAddServer}>
                  <Plus />
                  Add your first server
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            servers.map((server) => (
              <div
                key={server.id}
                className="rounded-lg border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-medium leading-none">{server.name}</p>
                    <p className="text-xs text-muted-foreground break-all">
                      {server.url}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        {AUTH_LABELS[server.authType]}
                      </Badge>
                      {server.authType === "bearer" && server.apiKey && (
                        <span className="text-xs text-muted-foreground">
                          API key stored
                        </span>
                      )}
                      {server.authType === "oauth" && (
                        <Badge
                          variant={
                            oauthStatuses[server.url]?.status === "connected"
                              ? "secondary"
                              : oauthStatuses[server.url]?.status === "expired"
                                ? "destructive"
                                : "outline"
                          }
                        >
                          {oauthStatuses[server.url]?.status === "connected"
                            ? "Connected"
                            : oauthStatuses[server.url]?.status === "expired"
                              ? "Expired"
                              : "Not connected"}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      checked={server.enabled}
                      onCheckedChange={(checked) =>
                        toggleEnabled(server.id, checked)
                      }
                    />
                    {server.enabled ? "Enabled" : "Disabled"}
                  </label>

                  <div className="flex items-center gap-2">
                    {server.authType === "oauth" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOAuthConnect(server)}
                      >
                        {oauthStatuses[server.url]?.status === "connected"
                          ? "Reauthorize"
                          : "Connect"}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditServer(server)}
                    >
                      <Pencil />
                      Edit
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost">
                          <Trash2 />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete server</AlertDialogTitle>
                          <AlertDialogDescription>
                            This removes the MCP server from local settings.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            variant="destructive"
                            onClick={() => removeServer(server.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>

      <Dialog open={formOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit MCP server" : "Add MCP server"}
            </DialogTitle>
            <DialogDescription>
              Configure the MCP HTTP endpoint and authentication.
            </DialogDescription>
          </DialogHeader>
          <McpServerForm
            initialValues={toFormValues(editing ?? undefined)}
            onSubmit={handleSubmit}
            onCancel={() => handleDialogChange(false)}
            submitLabel={editing ? "Save changes" : "Add server"}
          />
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
