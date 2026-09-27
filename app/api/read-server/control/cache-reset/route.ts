import { NextResponse } from "next/server";
import { clearReadServerDataCaches } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST() {
  if (process.env.ADOMS_READ_SERVER_SERVICE !== "1") return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true, cleared: clearReadServerDataCaches() });
}
