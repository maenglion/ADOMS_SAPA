import { NextResponse } from "next/server";
import { dataBackend } from "@/lib/data-backend";
import { dataSourceDiagnostics } from "@/lib/data-root";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.ADOMS_READ_DIAGNOSTICS !== "1") {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.json({ backend: dataBackend(), ...dataSourceDiagnostics() });
}
