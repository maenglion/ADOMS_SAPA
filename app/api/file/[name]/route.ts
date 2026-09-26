import { readFile } from "@/lib/storage";

/** 올린 파일 내려주기 — Supabase Storage 가 없을 때 쓰는 자리. */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const f = readFile(decodeURIComponent(name));
  if (!f) return new Response("없는 파일입니다", { status: 404 });
  return new Response(new Uint8Array(f.buf), {
    headers: { "Content-Type": f.type, "Cache-Control": "public, max-age=3600" },
  });
}
