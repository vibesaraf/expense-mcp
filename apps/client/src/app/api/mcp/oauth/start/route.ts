import { auth } from "@ai-sdk/mcp";
import { NextResponse } from "next/server";
import {
  createOAuthProvider,
  OAuthRedirectRequiredError,
} from "@/lib/mcp-auth-provider";
import { saveClientInformation } from "@/lib/oauth-store";

type OAuthStartRequest = {
  url?: string;
  oauthConfig?: {
    clientId?: string;
    clientSecret?: string;
  };
};

function resolveBaseUrl(req: Request) {
  const url = new URL(req.url);
  const proto =
    req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  return `${proto}://${host}`;
}

export async function POST(req: Request) {
  let payload: OAuthStartRequest;

  try {
    payload = (await req.json()) as OAuthStartRequest;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body." },
      { status: 400 },
    );
  }

  const serverUrl = payload.url?.trim();

  if (!serverUrl) {
    return NextResponse.json(
      { ok: false, error: "Server URL is required." },
      { status: 400 },
    );
  }

  try {
    new URL(serverUrl);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Server URL is invalid." },
      { status: 400 },
    );
  }

  if (payload.oauthConfig?.clientId) {
    await saveClientInformation(serverUrl, {
      client_id: payload.oauthConfig.clientId,
      client_secret: payload.oauthConfig.clientSecret,
    });
  }

  const redirectUrl = `${resolveBaseUrl(req)}/api/mcp/oauth/callback`;
  const state = crypto.randomUUID();

  let authorizationUrl: URL | undefined;

  const provider = createOAuthProvider({
    serverUrl,
    oauthConfig: payload.oauthConfig,
    redirectUrl,
    state,
    allowRedirect: true,
    onRedirect: (url) => {
      authorizationUrl = url;
    },
  });

  try {
    const result = await auth(provider, { serverUrl });

    if (result === "AUTHORIZED") {
      return NextResponse.json({ ok: true, status: "authorized" });
    }

    if (!authorizationUrl) {
      return NextResponse.json(
        { ok: false, error: "Authorization URL was not generated." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      status: "redirect",
      authorizationUrl: authorizationUrl.toString(),
      state,
    });
  } catch (error) {
    if (error instanceof OAuthRedirectRequiredError) {
      return NextResponse.json({
        ok: true,
        status: "redirect",
        authorizationUrl: error.authorizationUrl.toString(),
        state,
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "OAuth start failed.",
      },
      { status: 500 },
    );
  }
}
