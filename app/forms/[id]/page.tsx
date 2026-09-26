import Link from "next/link";
import { formHtml, formIndex } from "@/lib/forms";
import { idKo } from "@/lib/labels";
import PrintButton from "@/app/report/PrintButton";

export const dynamic = "force-dynamic";
// [캡처 v2] 아래 안내 문단 제거 · 원문 배지 짧게(09-22). 단계 막대 없음(문서 보기 화면)

/**
 * 법정 서식 보기 — 참고 명세의 「서식 내려받기」.
 * 법령 원문의 별표·별지서식을 표로 옮겨 보여 주고, 인쇄·PDF 로 내려받게 한다.
 * 표로 옮기지 못한 것은 원문 그대로 보여 준다(틀리게 그리지 않는다).
 */
export default async function FormView({ params, searchParams }:
  { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const meta = formIndex().find((f) => f.id === id);
  const html = formHtml(id);
  if (!meta || !html) return <p>서식을 찾지 못했습니다. <Link href="/admin/forms">서식 목록</Link></p>;

  const kind = meta.kind === "table" ? `별표 ${meta.no}` : `별지 제${meta.no}호서식`;
  return (
    <div className="report">
      <div className="noprint" style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        {sp.back && <Link className="btn ghost" href={sp.back}>← 돌아가기</Link>}
        <PrintButton />
        <span className="badge none">{idKo(meta.id)}</span>
        <span className="badge">{kind}</span>
        {meta.quality === "good"
          ? <span className="badge ok">표로 정리됨</span>
          : <span className="badge warn">원문 그대로</span>}
      </div>
      <div className="sheet form-sheet" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
