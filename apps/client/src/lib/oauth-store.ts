import { promises as fs } from "node:fs";
import path from "node:path";
import type { OAuthClientInformation, OAuthTokens } from "@ai-sdk/mcp";

type StoredTokens = {
  tokens: OAuthTokens;
  receivedAt: number;
  expiresAt?: number;
};

type PendingAuth = {
  state: string;
  serverUrl: string;
  codeVerifier: string;
  redirectUrl: string;
  createdAt: number;
};

type OAuthStore = {
  tokens: Record<string, StoredTokens>;
  clients: Record<string, OAuthClientInformation>;
  pending: Record<string, PendingAuth>;
};

const STORE_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(STORE_DIR, "oauth-store.json");
const EXPIRY_BUFFER_MS = 30_000;

function defaultStore(): OAuthStore {
  return { tokens: {}, clients: {}, pending: {} };
}

function normalizeUrl(input: string): string {
  const url = new URL(input);
  if (url.pathname.endsWith("/") && url.pathname !== "/") {
    url.pathname = url.pathname.slice(0, -1);
  }
  return url.toString();
}

async function readStore(): Promise<OAuthStore> {
  try {
    const data = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(data);
    return {
      tokens: parsed.tokens ?? {},
      clients: parsed.clients ?? {},
      pending: parsed.pending ?? {},
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      return defaultStore();
    }
    return defaultStore();
  }
}

async function writeStore(store: OAuthStore) {
  await fs.mkdir(STORE_DIR, { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

export function normalizeServerUrl(input: string): string {
  return normalizeUrl(input);
}

export async function getStoredTokens(serverUrl: string) {
  const store = await readStore();
  return store.tokens[normalizeUrl(serverUrl)];
}

export async function saveTokens(serverUrl: string, tokens: OAuthTokens) {
  const store = await readStore();
  const receivedAt = Date.now();
  const expiresAt = tokens.expires_in
    ? receivedAt + tokens.expires_in * 1000
    : undefined;

  store.tokens[normalizeUrl(serverUrl)] = {
    tokens,
    receivedAt,
    expiresAt,
  };

  await writeStore(store);
}

export async function clearTokens(serverUrl: string) {
  const store = await readStore();
  delete store.tokens[normalizeUrl(serverUrl)];
  await writeStore(store);
}

export async function getClientInformation(serverUrl: string) {
  const store = await readStore();
  return store.clients[normalizeUrl(serverUrl)];
}

export async function saveClientInformation(
  serverUrl: string,
  clientInformation: OAuthClientInformation,
) {
  const store = await readStore();
  store.clients[normalizeUrl(serverUrl)] = clientInformation;
  await writeStore(store);
}

export async function clearClientInformation(serverUrl: string) {
  const store = await readStore();
  delete store.clients[normalizeUrl(serverUrl)];
  await writeStore(store);
}

export async function savePendingAuth(pending: PendingAuth) {
  const store = await readStore();
  store.pending[pending.state] = pending;
  await writeStore(store);
}

export async function getPendingAuth(state: string) {
  const store = await readStore();
  return store.pending[state];
}

export async function clearPendingAuth(state: string) {
  const store = await readStore();
  delete store.pending[state];
  await writeStore(store);
}

export async function getTokenStatus(serverUrl: string) {
  const entry = await getStoredTokens(serverUrl);
  if (!entry) {
    return { status: "missing" as const };
  }

  if (entry.expiresAt && Date.now() + EXPIRY_BUFFER_MS >= entry.expiresAt) {
    return { status: "expired" as const, expiresAt: entry.expiresAt };
  }

  return { status: "connected" as const, expiresAt: entry.expiresAt };
}
