import { config } from "../config/index.js";

export class RestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "RestError";
  }
}

export async function callRest<T = unknown>(
  restToken: string,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${config.REST_BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${restToken}`,
      ...(body != null ? { "Content-Type": "application/json" } : {}),
    },
    ...(body != null ? { body: JSON.stringify(body) } : {}),
  });

  const json = (await res.json()) as {
    success: boolean;
    data?: T;
    error?: { message: string };
  };

  if (!res.ok || !json.success) {
    throw new RestError(
      json.error?.message ?? `HTTP ${res.status}`,
      res.status,
    );
  }

  return json.data as T;
}
