// [400 · 교육자료 버전] 기관장 서한문 — 목록(참고 명세에 화면 없음 · 교육자료 톤으로 새로 설계, 명세 00 §11 #10)
import Link from "next/link";
import { UsLayout } from "@/components/us/Parts";
import { readTable, depts, type Row } from "@/lib/data";
import { CeoSide } from "../_parts";

export const dynamic = "force-dynamic";

export default async function LetterList({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";
  const all = (await readTable("usf_letter", "letter_id"))
    .sort((a, b) => String(b.sent_at || b.created_at).localeCompare(String(a.sent_at || a.created_at)));
  const reads = await readTable("usf_letter_read", "read_id");
  const deptN = (await depts()).filter((d: Row) => d.dept_id !== "D99").length;
  const years = [...new Set(all.map((l) => String(l.sent_at || l.created_at).slice(0, 4)).filter(Boolean))];
  const y = sp.y || "";
  const q = (sp.q || "").trim();
  const list = all.filter((l) => (!y || String(l.sent_at || l.created_at).startsWith(y)) && (!q || `${l.title} ${l.body}`.includes(q)));
  const canWrite = ["ceo", "gm", "mgr"].includes(role);

  return (
    <UsLayout side={<CeoSide on="letter" role={role} />}>
      <div className="usf-top">
        <div>
          <h1 className="us-h1">기관장 서한문</h1>
          <div className="usf-sub">경영책임자가 안전보건 경영방침과 당부를 전 직원·부서에 직접 전하는 글입니다.</div>
        </div>
        {canWrite && <div className="usf-top-r"><Link className="us-btn g" href={`/ceo/letter/new?role=${role}`}>서한문 작성</Link></div>}
      </div>

      <form className="us-filter" method="get">
        <input type="hidden" name="role" value={role} />
        <label>연도
          <select name="y" defaultValue={y}>
            <option value="">전체</option>
            {years.map((x) => <option key={x} value={x}>{x}년</option>)}
          </select>
        </label>
        <label>검색어 <input type="text" name="q" defaultValue={q} placeholder="제목 또는 내용" /></label>
        <button className="us-btn" type="submit">🔍 검색</button>
      </form>

      <table className="us-tbl">
        <thead>
          <tr><th style={{ width: 70 }}>번호</th><th>제목</th><th style={{ width: "20%" }}>수신 대상</th><th style={{ width: "22%" }}>관련 의무</th>
            <th style={{ width: 120 }}>발송일</th><th style={{ width: 110 }}>수신 확인</th><th style={{ width: 90 }}>상태</th></tr>
        </thead>
        <tbody>
          {list.map((l, i) => {
            const n = new Set(reads.filter((r) => r.letter_id === l.letter_id).map((r) => r.dept_id)).size;
            return (
              <tr key={l.letter_id}>
                <td className="c">{list.length - i}</td>
                <td className="usf-title"><Link href={`/ceo/letter/${l.letter_id}?role=${role}`}>{l.title}</Link>{l.evidence_name ? " 📎" : ""}</td>
                <td>{String(l.recipients || "").split(";").filter(Boolean).map((x) => <span key={x} className="usf-tag">{x}</span>)}</td>
                <td>{l.related_duty}</td>
                <td className="c">{l.status === "발송" ? l.sent_at : "-"}</td>
                <td className="c">{l.status === "발송" ? `${n}/${deptN} 부서` : "-"}</td>
                <td className="c"><span className={`us-st ${l.status === "발송" ? "ok" : "warn"}`}>{l.status}</span></td>
              </tr>
            );
          })}
          {!list.length && <tr><td colSpan={7} className="c">서한문이 없습니다.</td></tr>}
        </tbody>
      </table>
    </UsLayout>
  );
}
