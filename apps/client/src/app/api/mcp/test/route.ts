import { createMCPClient } from "@ai-sdk/mcp";
import { NextResponse } from "next/server";
import {
  createOAuthProvider,
  defaultRedirectUrl,
  OAuthRedirectRequiredError,
} from "@/lib/mcp-auth-provider";
import { getTokenStatus } from "@/lib/oauth-store";

type TestRequest = {
  url?: string;
  authType?: "none" | "bearer" | "oauth";
  apiKey?: string;
  oauthConfig?: {
    clientId?: string;
    clientSecret?: string;
  };
};

export async function POST(req: Request) {
  let payload: TestRequest;

  try {
    payload = (await req.json()) as TestRequest;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body." },
      { status: 400 },
    );
  }

  const url = payload.url?.trim();

  if (!url) {
    return NextResponse.json(
      { ok: false, error: "Server URL is required." },
      { status: 400 },
    );
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Server URL is invalid." },
      { status: 400 },
    );
  }

  const authType = payload.authType ?? "none";

  if (authType === "oauth") {
    const status = await getTokenStatus(url);
    if (status.status === "missing") {
      return NextResponse.json(
        {
          ok: false,
          error: "OAuth connection required. Use Connect in settings.",
        },
        { status: 401 },
      );
    }
  }

  if (authType === "bearer" && !payload.apiKey?.trim()) {
    return NextResponse.json(
      { ok: false, error: "API key is required for bearer auth." },
      { status: 400 },
    );
  }

  let client: Awaited<ReturnType<typeof createMCPClient>> | undefined;

  try {
    client = await createMCPClient({
      transport: {
        type: "http",
        url,
        headers:
          authType === "bearer"
            ? { Authorization: `Bearer ${payload.apiKey}` }
            : undefined,
        authProvider:
          authType === "oauth"
            ? createOAuthProvider({
                serverUrl: url,
                oauthConfig: payload.oauthConfig,
                redirectUrl: defaultRedirectUrl(),
                allowRedirect: false,
              })
            : undefined,
      },
    });

    await client.tools();

    return NextResponse.json({
      ok: true,
      message: "Connection successful.",
    });
  } catch (error) {
    if (error instanceof OAuthRedirectRequiredError) {
      return NextResponse.json(
        {
          ok: false,
          error: "OAuth connection required. Use Connect in settings.",
        },
        { status: 401 },
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to connect to MCP server.",
      },
      { status: 500 },
    );
  } finally {
    await client?.close();
  }
}
