import { NextResponse } from "next/server";
import { postgresPool, readServerDataCacheStatus } from "@/lib/db";
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.ADOMS_READ_SERVER_SERVICE !== "1") {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  try {
    await postgresPool().query("SELECT 1");
    return NextResponse.json({
      ok: true,
      service: "sapa-read-server",
      postgres: true,
      dataCaches: readServerDataCacheStatus(),
    });
  } catch {
    return NextResponse.json({ ok: false, service: "sapa-read-server", postgres: false }, { status: 503 });
  }
}
