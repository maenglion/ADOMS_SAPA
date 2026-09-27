import { NextResponse } from "next/server";
import { postgresPool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.ADOMS_READ_SERVER_SERVICE !== "1") {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  const startedAt = performance.now();
  const result = await postgresPool().query("SELECT current_schema() AS schema, COUNT(*)::text AS tables FROM information_schema.tables WHERE table_schema = 'adoms2' AND table_type = 'BASE TABLE'");
  return NextResponse.json({
    ok: result.rows[0]?.schema === "public" && result.rows[0]?.tables === "91",
    databaseSchema: "adoms2",
    tableCount: Number(result.rows[0]?.tables || 0),
    dbMs: Math.round((performance.now() - startedAt) * 100) / 100,
  });
}
