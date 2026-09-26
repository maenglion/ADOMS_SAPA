"use server";
/**
 * [400 · 교육자료 버전] 묶음 F — 게시판 쓰기(공지사항 usf_notice · 자료실 usf_file). 파일은 attachOf 로 실제 저장한다.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendRow } from "@/lib/write";
import { ROLE_STAFF } from "@/lib/roles";
import { attachOf } from "@/lib/attach";

const CATS = ["서식", "지침·매뉴얼", "교육자료", "법령 해설", "기타"];
const v = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);
const newId = (p: string) => `${p}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

export async function saveBoard(f: FormData) {
  const role = v(f, "role") || "gm";
  const kind = v(f, "kind") === "files" ? "files" : "notice";
  if (kind === "notice" && !["ceo", "gm", "mgr"].includes(role)) return;
  const title = v(f, "title");
  const body = String(f.get("body") ?? "").trim().slice(0, 8000);
  if (!title || !body) redirect(`/board/${kind}/new?role=${role}&err=1`);
  const ev = await attachOf(f);
  const by = ROLE_STAFF[role] || "SD01-1";
  const at = new Date().toISOString();
  if (kind === "notice") {
    await appendRow("usf_notice", {
      notice_id: newId("NTC"), title, body, pinned: v(f, "pinned") === "Y" ? "Y" : "N",
      written_by: by, created_at: at, evidence_name: ev.evidence_name, evidence_url: ev.evidence_url,
    }, by, "공지사항 등록");
  } else {
    await appendRow("usf_file", {
      file_id: newId("FIL"), category: CATS.includes(v(f, "category")) ? v(f, "category") : "기타", title, body,
      written_by: by, created_at: at, evidence_name: ev.evidence_name, evidence_url: ev.evidence_url, gen_content: "",
    }, by, "자료실 등록");
  }
  revalidatePath(`/board/${kind}`);
  redirect(`/board/${kind}?role=${role}&saved=1`);
}
