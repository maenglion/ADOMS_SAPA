import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.ADOMS_READ_SERVER_SERVICE !== "1") {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    service: "sapa-read-server",
  });
}
