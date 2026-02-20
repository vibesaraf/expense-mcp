"use client";

import * as React from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { MCPServerFormValues } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const formSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    url: z.string().url("Enter a valid URL"),
    authType: z.enum(["none", "bearer", "oauth"]),
    apiKey: z.string().optional(),
    oauthClientId: z.string().optional(),
    oauthClientSecret: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.authType === "bearer" && !values.apiKey?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["apiKey"],
        message: "API key is required for bearer auth",
      });
    }
  });

const DEFAULT_VALUES: MCPServerFormValues = {
  name: "",
  url: "",
  authType: "none",
  apiKey: "",
  oauthClientId: "",
  oauthClientSecret: "",
};

const authOptions = [
  { value: "none", label: "None" },
  { value: "bearer", label: "Bearer token" },
  { value: "oauth", label: "OAuth" },
] as const;

type McpServerFormProps = {
  initialValues?: MCPServerFormValues;
  onSubmit: (values: MCPServerFormValues) => void;
  onCancel?: () => void;
  submitLabel?: string;
};

type TestState = {
  status: "idle" | "loading" | "success" | "error";
  message?: string;
};

export function McpServerForm({
  initialValues,
  onSubmit,
  onCancel,
  submitLabel = "Save server",
}: McpServerFormProps) {
  const resolvedDefaults = React.useMemo(
    () => ({ ...DEFAULT_VALUES, ...initialValues }),
    [initialValues],
  );

  const form = useForm<MCPServerFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: resolvedDefaults,
  });

  const authType = form.watch("authType");
  const [testState, setTestState] = React.useState<TestState>({
    status: "idle",
  });

  React.useEffect(() => {
    form.reset(resolvedDefaults);
  }, [form, resolvedDefaults]);

  // React.useEffect(() => {
  //   const subscription = form.watch(() => {
  //     setTestState((state) =>
  //       state.status === "idle" ? state : { status: "idle" },
  //     );
  //   });

  //   return () => subscription.unsubscribe();
  // }, [form]);

  const handleTestConnection = async () => {
    const isValid = await form.trigger();
    if (!isValid) return;

    setTestState({ status: "loading" });

    const values = form.getValues();
    const payload = {
      url: values.url,
      authType: values.authType,
      apiKey: values.authType === "bearer" ? values.apiKey : undefined,
      oauthConfig:
        values.authType === "oauth"
          ? {
              clientId: values.oauthClientId,
              clientSecret: values.oauthClientSecret,
            }
          : undefined,
    };

    try {
      const response = await fetch("/api/mcp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setTestState({
          status: "error",
          message: data?.error || "Connection failed.",
        });
        return;
      }

      setTestState({
        status: "success",
        message: data?.message || "Connection successful.",
      });
    } catch (error) {
      setTestState({
        status: "error",
        message: error instanceof Error ? error.message : "Connection failed.",
      });
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Server name</FormLabel>
              <FormControl>
                <Input placeholder="Expense MCP" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Server URL</FormLabel>
              <FormControl>
                <Input placeholder="https://example.com/mcp" {...field} />
              </FormControl>
              <FormDescription>Use the MCP HTTP endpoint.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="authType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Authentication</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select auth type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {authOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                OAuth servers require a connect step after saving.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {authType === "bearer" && (
          <FormField
            control={form.control}
            name="apiKey"
            render={({ field }) => (
              <FormItem>
                <FormLabel>API key</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Bearer token"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {authType === "oauth" && (
          <div className="grid gap-4">
            <FormField
              control={form.control}
              name="oauthClientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client ID</FormLabel>
                  <FormControl>
                    <Input placeholder="client_123" {...field} />
                  </FormControl>
                  <FormDescription>
                    Optional for DCR flows; leave empty to auto-register.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="oauthClientSecret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client secret</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handleTestConnection}
              disabled={testState.status === "loading"}
            >
              {testState.status === "loading"
                ? "Testing..."
                : "Test connection"}
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {submitLabel}
              </Button>
            </div>
          </div>

          {testState.status !== "idle" && (
            <div
              className={cn(
                "text-sm",
                testState.status === "loading" && "text-muted-foreground",
                testState.status === "success" && "text-emerald-600",
                testState.status === "error" && "text-destructive",
              )}
            >
              {testState.status === "loading"
                ? "Testing MCP server connectivity..."
                : testState.message}
            </div>
          )}
        </div>
      </form>
    </Form>
  );
}
