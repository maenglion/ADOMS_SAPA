/**
 * 파일 저장 — 현장 사진·증빙 파일을 받는 곳. (2026-09-21)
 *
 * 두 갈래를 같은 모양으로 다룬다.
 *   ① Supabase Storage 가 붙어 있으면 → 버킷 `evidence` 에 올린다.
 *   ② 없으면(기본) → 앱 폴더의 `.data/uploads/` 에 저장하고 `/api/file/...` 로 내려 준다.
 *
 * ★ 발행된 데이터 판(ops_*)에는 쓰지 않는다. 덮개와 같은 원칙이다.
 * ★ 휴대폰에서 바로 찍어 올릴 수 있게 하는 것이 목적이라, 파일 이름에 날짜와 무작위 조각을 붙여
 *   같은 이름끼리 부딪히지 않게 한다. 원래 이름은 evidence.file_name 에 따로 남긴다.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { ymd } from "@/lib/day";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const KEY_ = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
export const useStorage = Boolean(URL_ && KEY_);
const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || "evidence";

const DIR = path.join(process.cwd(), ".data", "uploads");

/** 파일 이름을 안전하게 — 경로 문자를 걷어내고 길이를 자른다. */
function safeName(name: string) {
  const base = (name || "file").replace(/[\\/:*?"<>|]/g, "_").slice(-80);
  const stamp = ymd().replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 8);
  return `${stamp}_${rand}_${base}`;
}

export type Saved = { url: string; stored: string; size: number; type: string };

/** 파일 한 개를 저장하고 내려받을 주소를 돌려준다. */
export async function saveFile(file: File): Promise<Saved> {
  const buf = Buffer.from(await file.arrayBuffer());
  const stored = safeName(file.name);

  if (useStorage) {
    const r = await fetch(`${URL_}/storage/v1/object/${BUCKET}/${stored}`, {
      method: "POST",
      headers: {
        apikey: KEY_, Authorization: `Bearer ${KEY_}`,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "true",
      },
      body: buf,
    });
    if (!r.ok) throw new Error(`업로드 실패: ${r.status} ${await r.text()}`);
    return {
      url: `${URL_}/storage/v1/object/public/${BUCKET}/${stored}`,
      stored, size: buf.length, type: file.type || "",
    };
  }

  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, stored), buf);
  return { url: `/api/file/${encodeURIComponent(stored)}`, stored, size: buf.length, type: file.type || "" };
}

/** 저장된 파일을 읽는다(내려받기 경로에서 쓴다). */
export function readFile(stored: string): { buf: Buffer; type: string } | null {
  // 경로를 거슬러 올라가는 이름은 받지 않는다.
  if (stored.includes("..") || stored.includes("/") || stored.includes("\\")) return null;
  const p = path.join(DIR, stored);
  if (!fs.existsSync(p)) return null;
  const ext = path.extname(stored).toLowerCase();
  const type =
    ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
    ext === ".png" ? "image/png" :
    ext === ".webp" ? "image/webp" :
    ext === ".heic" ? "image/heic" :
    ext === ".pdf" ? "application/pdf" :
    ext === ".txt" ? "text/plain; charset=utf-8" : "application/octet-stream"; // [캡처 v2] K03 — 글자 파일도 바로 열리게
  return { buf: fs.readFileSync(p), type };
}

/** 사람이 읽는 크기. */
export function human(n: number) {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}MB`;
  if (n >= 1024) return `${Math.round(n / 1024)}KB`;
  return `${n}B`;
}
