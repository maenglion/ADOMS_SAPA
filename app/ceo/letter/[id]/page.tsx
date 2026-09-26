// [400 · 교육자료 버전] 기관장 서한문 — 상세(서한 본문 · 첨부 · 부서별 수신 확인). 참고 명세에 화면 없음 · 교육자료 톤으로 새로 설계.
import Link from "next/link";
import { UsLayout } from "@/components/us/Parts";
import { readTable, depts, staff, type Row } from "@/lib/data";
import { deptOf } from "@/lib/roles";
import { CeoSide, fmtAt } from "../../_parts";
import { sendLetter, readLetter } from "../../actions";

export const dynamic = "force-dynamic";

export default async function LetterView({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const role = sp.role || "gm";
  const l = (await readTable("usf_letter", "letter_id")).find((r) => r.letter_id === id);
  if (!l) {
    return (
      <UsLayout side={<CeoSide on="letter" role={role} />}>
        <div className="us-card w">없는 서한문입니다. <Link href={`/ceo/letter?role=${role}`}>목록으로 →</Link></div>
      </UsLayout>
    );
  }
  const dl = (await depts()).filter((d: Row) => d.dept_id !== "D99");
  const nm = new Map((await staff()).map((s: Row) => [s.staff_id, String(s.display_name || "")]));
  const reads = (await readTable("usf_letter_read", "read_id")).filter((r) => r.letter_id === id);
  const readOf = new Map<string, Row>();
  reads.forEach((r) => { if (!readOf.has(r.dept_id)) readOf.set(r.dept_id, r); });
  const mine = deptOf(role);
  const sent = l.status === "발송";
  const canWrite = ["ceo", "gm", "mgr"].includes(role);

  return (
    <UsLayout side={<CeoSide on="letter" role={role} />}>
      <div className="usf-top">
        <div>
          <h1 className="us-h1">기관장 서한문</h1>
          <div className="usf-sub">{sent ? `발송 ${l.sent_at}` : "작성중(발송 전)"} · 작성 {nm.get(l.written_by) || l.written_by}</div>
        </div>
        <div className="usf-top-r">
          <Link className="us-btn w" href={`/ceo/letter?role=${role}`}>목록으로</Link>
          {!sent && canWrite && <Link className="us-btn" href={`/ceo/letter/new?role=${role}&id=${id}`}>수정</Link>}
          {!sent && canWrite && (
            <form action={sendLetter}><input type="hidden" name="role" value={role} /><input type="hidden" name="id" value={id} />
              <button className="us-btn g" type="submit">발송</button></form>
          )}
          {sent && mine && !readOf.has(mine) && (
            <form action={readLetter}><input type="hidden" name="role" value={role} /><input type="hidden" name="id" value={id} />
              <button className="us-btn g" type="submit">수신 확인</button></form>
          )}
        </div>
      </div>
      {sp.sent && <p className="usf-ok">발송했습니다. 각 부서 담당자에게 알림이 갔습니다.</p>}
      {sp.saved && <p className="usf-ok">임시저장했습니다.</p>}
      {sp.read && <p className="usf-ok">수신 확인을 남겼습니다.</p>}

      <article className="usf-letter">
        <header className="usf-letter-h">
          <span className="usf-lg">용인특례시장 서한</span>
          <h2>{l.title}</h2>
        </header>
        <div className="usf-letter-meta">
          <span>수신: {String(l.recipients || "").split(";").filter(Boolean).join(" · ")}</span>
          {l.related_duty && <span>관련 의무: {l.related_duty}</span>}
        </div>
        <div className="usf-letter-body">{l.body}</div>
        <div className="usf-sign"><small>{sent ? l.sent_at : ""}</small>{l.sender || "용인특례시장"}</div>
        {l.evidence_name && (
          <div className="usf-view-files">첨부: {l.evidence_url ? <a href={l.evidence_url} target="_blank">{l.evidence_name}</a> : l.evidence_name}</div>
        )}
      </article>

      {sent && (
        <>
          <h2 className="us-h2">부서별 수신 확인 <span className="us-muted">({readOf.size}/{dl.length} 부서)</span></h2>
          <table className="us-tbl">
            <thead><tr><th>부서</th><th>확인자</th><th>확인 일시</th><th>상태</th></tr></thead>
            <tbody>
              {dl.map((d: Row) => {
                const r = readOf.get(d.dept_id);
                return (
                  <tr key={d.dept_id} className={d.dept_id === mine ? "hl" : ""}>
                    <td>{d.dept_name}</td>
                    <td className="c">{r ? nm.get(r.staff_id) || r.staff_id : "-"}</td>
                    <td className="c">{r ? fmtAt(r.read_at) : "-"}</td>
                    <td className="c"><span className={`us-st ${r ? "ok" : "none"}`}>{r ? "확인" : "미확인"}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </UsLayout>
  );
}
