"use server";
/**
 * [400 · 교육자료 버전] SCR-097~101 사고사례 쓰기 — 공용 appendRow · patchRow 로만(표 usg_case).
 *  · op=save + no 있음 → 수정(제목·내용·첨부 더하기)   · op=save + no 없음 → 새 글
 *  · op=delete → 삭제 **표시만**(deleted=Y · 지우지 않는다)
 * 확인 팝업(「게시물을 수정하시겠습니까?」 등)은 화면(ConfirmButton)에서 거친 뒤 여기로 온다.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { appendRow, patchRow } from "@/lib/write";
import { attachOf } from "@/lib/attach";
import { staff, depts } from "@/lib/data";
import { ROLE_STAFF } from "@/lib/roles";
import { caseRows } from "../_parts/data";

const v = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const MAX = 10 * 1024 * 1024;

function now() {
  const d = new Date(), p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export async function caseAction(f: FormData) {
  const role = v(f, "role") || "gm";
  const list = v(f, "list");               // 목록 조건(작성자·제목·쪽) — 복귀 때 보존(SCR-101 주석)
  const no = v(f, "no");
  const op = v(f, "op") || "save";
  const by = ROLE_STAFF[role] || "SD01-1";
  const base = `/stats/cases?${list}`;

  if (op === "delete" && no) {
    await patchRow("usg_case", "case_no", no, { deleted: "Y", deleted_at: now(), deleted_by: by }, by, "사고사례 삭제(표시)");
    revalidatePath("/stats/cases");
    redirect(`${base}&ok=${encodeURIComponent(`${no}번 게시물을 삭제했습니다.`)}`);
  }

  const title = v(f, "title"), content = v(f, "content");
  const again = no ? `${base}&id=${no}&mode=edit` : `${base}&mode=new`;
  if (!title || !content) redirect(`${again}&err=${encodeURIComponent(`빠진 칸: ${[!title && "제목", !content && "내용"].filter(Boolean).join(" · ")}`)}`);

  // 첨부 5칸 — 개당 10MB 이하
  const files: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const fl = f.get(`file${i}`);
    if (fl instanceof File && fl.size > MAX) redirect(`${again}&err=${encodeURIComponent(`「${fl.name}」은 10MB 를 넘습니다.`)}`);
    const a = await attachOf(f, `file${i}_name`, `file${i}`);
    if (a.evidence_url) files.push(`${a.evidence_name.replace(/[|;]/g, "_")}|${a.evidence_url}`);
  }

  if (no) {
    const cur = (await caseRows(true)).find((r) => String(r.case_no) === no);
    const kept = String(cur?.files || "");
    await patchRow("usg_case", "case_no", no, {
      title, content, files: [kept, ...files].filter(Boolean).join(";;"), updated_at: now(), updated_by: by,
    }, by, "사고사례 수정");
    revalidatePath("/stats/cases");
    redirect(`${base}&ok=${encodeURIComponent(`${no}번 게시물을 수정했습니다.`)}`);   // 수정 완료 → 창을 닫고 목록으로(09-24 사용자)
  }

  const [st, dl] = await Promise.all([staff(), depts()]);
  const me = st.find((s: any) => s.staff_id === by);
  const full = String(me?.display_name || "");
  const name = role === "ceo" ? "시장" : full.replace(/\s+\S+$/, "") || full;
  const dept = role === "ceo" ? "용인특례시" : String(dl.find((d: any) => d.dept_id === me?.dept_id)?.dept_name || "");
  const next = (await caseRows(true)).reduce((m, r) => Math.max(m, Number(r.case_no) || 0), 0) + 1;
  await appendRow("usg_case", {
    case_no: String(next), title, dept_name: dept, writer: name, writer_id: by, created_at: now(),
    views: "0", content, files: files.join(";;"), deleted: "",
  }, by, "사고사례 등록");
  revalidatePath("/stats/cases");
  redirect(`/stats/cases?role=${role}&ok=${encodeURIComponent(`${next}번 게시물을 등록했습니다.`)}`);   // 등록 → 창을 닫고 목록 첫 쪽으로
}
