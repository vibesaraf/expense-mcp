export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const sessionCookie = await window.cookieStore.get("expense_session");
  const hasBody = init?.body != null;
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
      Authorization: `Bearer ${sessionCookie?.value}`,
    },
  });
  if (res.status === 204) return undefined as T;
  const json = (await res.json()) as {
    success: boolean;
    data?: T;
    error?: { message: string };
  };
  if (!res.ok || !json.success) {
    throw new ApiError(json.error?.message ?? `HTTP ${res.status}`, res.status);
  }
  return json.data as T;
}
