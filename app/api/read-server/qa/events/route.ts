import { NextRequest, NextResponse } from "next/server";
import { qaEvent, qaSnapshot } from "@/lib/demo-qa-store";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.ADOMS_READ_SERVER_SERVICE !== "1") return NextResponse.json({ ok: false }, { status: 404 });
  try { return NextResponse.json({ ok: true, ...(await qaSnapshot()) }); }
  catch { return NextResponse.json({ ok: false, error: "QA 기록을 불러오지 못했습니다." }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  if (process.env.ADOMS_READ_SERVER_SERVICE !== "1") return NextResponse.json({ ok: false }, { status: 404 });
  try {
    const input = await request.json();
    const saved = await qaEvent(input);
    return NextResponse.json({ ok: true, saved });
  } catch (reason) {
    const message = reason instanceof Error && reason.message === "Unsupported QA event type"
      ? reason.message : "QA 기록을 저장하지 못했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: message.startsWith("Unsupported") ? 400 : 500 });
  }
}
