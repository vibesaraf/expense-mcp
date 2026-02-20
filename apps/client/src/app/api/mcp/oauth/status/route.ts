import { NextResponse } from "next/server";
import { getTokenStatus } from "@/lib/oauth-store";

type StatusRequest = {
  serverUrls?: string[];
};

export async function POST(req: Request) {
  let payload: StatusRequest;

  try {
    payload = (await req.json()) as StatusRequest;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body." },
      { status: 400 },
    );
  }

  const serverUrls = Array.isArray(payload.serverUrls)
    ? payload.serverUrls
    : [];

  const entries = await Promise.all(
    serverUrls.map(async (url) => ({
      url,
      ...(await getTokenStatus(url)),
    })),
  );

  return NextResponse.json({
    ok: true,
    statuses: entries,
  });
}
