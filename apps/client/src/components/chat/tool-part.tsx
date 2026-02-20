import type { UIMessage } from "ai";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type MessagePart = UIMessage["parts"][number];

type ToolUIPart = MessagePart & {
  state?:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error"
    | "approval-requested";
  input?: unknown;
  output?: unknown;
  errorText?: string;
  toolName?: string;
};

const STATE_LABELS: Record<string, string> = {
  "input-streaming": "Input streaming",
  "input-available": "Input ready",
  "output-available": "Output",
  "output-error": "Error",
  "approval-requested": "Approval needed",
};

function formatPayload(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function ToolPart({ part }: { part: MessagePart }) {
  if (part.type === "step-start") {
    return <div className="h-px w-full bg-border" />;
  }

  if (part.type !== "dynamic-tool" && !part.type.startsWith("tool-")) {
    return null;
  }

  const toolPart = part as ToolUIPart;
  const toolName =
    toolPart.toolName ??
    (part.type.startsWith("tool-") ? part.type.replace("tool-", "") : "Tool");
  const state = toolPart.state ?? "input-available";
  const label = STATE_LABELS[state] ?? "Tool";

  let body = "";

  if (state === "output-error") {
    body = toolPart.errorText ?? "Tool execution failed.";
  } else if (state === "output-available") {
    body = formatPayload(toolPart.output);
  } else if (state === "input-available" || state === "input-streaming") {
    body = formatPayload(toolPart.input);
  } else if (state === "approval-requested") {
    body = formatPayload(toolPart.input);
  }

  return (
    <div className="rounded-md border bg-background/60 p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">{toolName}</span>
        <Badge
          variant={state === "output-error" ? "destructive" : "outline"}
          className={cn(
            state === "output-error" &&
              "border-destructive/40 bg-destructive/10 text-destructive",
          )}
        >
          {label}
        </Badge>
      </div>

      {state === "approval-requested" && (
        <p className="mt-2 text-muted-foreground">
          Approval required before the tool runs.
        </p>
      )}

      {body ? (
        <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-foreground">
          {body}
        </pre>
      ) : null}
    </div>
  );
}
