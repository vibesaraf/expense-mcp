import { auth } from "@ai-sdk/mcp";
import { NextResponse } from "next/server";
import { createOAuthProvider } from "@/lib/mcp-auth-provider";
import { clearPendingAuth, getPendingAuth } from "@/lib/oauth-store";

function resolveBaseUrl(req: Request) {
  const url = new URL(req.url);
  const proto =
    req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  return `${proto}://${host}`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const baseUrl = resolveBaseUrl(req);

  if (error) {
    const redirectUrl = new URL(baseUrl);
    redirectUrl.searchParams.set("oauth", "error");
    if (errorDescription) {
      redirectUrl.searchParams.set("oauth_error", errorDescription);
    }
    return NextResponse.redirect(redirectUrl);
  }

  if (!code || !state) {
    const redirectUrl = new URL(baseUrl);
    redirectUrl.searchParams.set("oauth", "error");
    redirectUrl.searchParams.set("oauth_error", "Missing code or state");
    return NextResponse.redirect(redirectUrl);
  }

  const pending = await getPendingAuth(state);

  if (!pending) {
    const redirectUrl = new URL(baseUrl);
    redirectUrl.searchParams.set("oauth", "error");
    redirectUrl.searchParams.set(
      "oauth_error",
      "No pending OAuth request found",
    );
    return NextResponse.redirect(redirectUrl);
  }

  const provider = createOAuthProvider({
    serverUrl: pending.serverUrl,
    redirectUrl: pending.redirectUrl,
    state: pending.state,
    allowRedirect: false,
  });

  try {
    await auth(provider, {
      serverUrl: pending.serverUrl,
      authorizationCode: code,
    });

    await clearPendingAuth(state);

    const redirectUrl = new URL(baseUrl);
    redirectUrl.searchParams.set("oauth", "success");
    return NextResponse.redirect(redirectUrl);
  } catch (authError) {
    const redirectUrl = new URL(baseUrl);
    redirectUrl.searchParams.set("oauth", "error");
    redirectUrl.searchParams.set(
      "oauth_error",
      authError instanceof Error ? authError.message : "OAuth exchange failed",
    );
    return NextResponse.redirect(redirectUrl);
  }
}
