import { UIMessage } from "ai";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ToolPart } from "@/components/chat/tool-part";
import { User, Bot } from "lucide-react";

interface MessageListProps {
  messages: UIMessage[];
}

export function MessageList({ messages }: MessageListProps) {
  if (!messages.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
        <Bot className="h-12 w-12 mb-4 opacity-20" />
        <p className="text-lg font-medium">How can I help you today?</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={cn(
            "flex w-full items-start gap-3",
            message.role === "user" ? "flex-row-reverse" : "flex-row",
          )}
        >
          <Avatar
            className={cn(
              "h-8 w-8",
              message.role === "user" ? "bg-primary" : "bg-muted",
            )}
          >
            <AvatarFallback
              className={
                message.role === "user" ? "text-primary-foreground" : ""
              }
            >
              {message.role === "user" ? (
                <User className="h-4 w-4" />
              ) : (
                <Bot className="h-4 w-4" />
              )}
            </AvatarFallback>
          </Avatar>

          <div
            className={cn(
              "rounded-lg px-4 py-2 max-w-[80%] text-sm",
              message.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground",
            )}
          >
            <div className="flex flex-col gap-2">
              {message.parts.map((part, index) => {
                if (part.type === "text") {
                  return (
                    <span
                      key={`${message.id}-${index}`}
                      className="whitespace-pre-wrap"
                    >
                      {part.text}
                    </span>
                  );
                }

                if (message.role === "user") return null;

                return <ToolPart key={`${message.id}-${index}`} part={part} />;
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
