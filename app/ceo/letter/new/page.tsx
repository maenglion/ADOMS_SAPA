// [400 · 교육자료 버전] 기관장 서한문 — 작성(임시저장 · 발송). 참고 명세에 화면 없음 · 교육자료 톤으로 새로 설계.
import Link from "next/link";
import { redirect } from "next/navigation";
import { UsLayout, EvHead } from "@/components/us/Parts";
import { readTable } from "@/lib/data";
import { STEPS } from "@/lib/us/tracks";
import { ymd } from "@/lib/day";
import { CeoSide, RECIPIENTS } from "../../_parts";
import { saveLetter } from "../../actions";

export const dynamic = "force-dynamic";

const START = `용인특례시 공직자 여러분께

(하고 싶은 말씀을 적으십시오 — 안전보건 목표와 경영방침, 계절별 위험 당부, 점검 협조 요청 등)

함께 안전한 용인을 만들어 갑시다.`;

export default async function LetterNew({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";
  if (!["ceo", "gm", "mgr"].includes(role)) redirect(`/ceo/letter?role=${role}`);
  const cur = sp.id ? (await readTable("usf_letter", "letter_id")).find((r) => r.letter_id === sp.id && r.status === "작성중") : null;
  // 관련 의무 — 의무 단계 제목(중대재해처벌법 조문 포함) 세 트랙 모음
  const duties = [...new Set([...STEPS.ws, ...STEPS.fc, ...STEPS.mt].map((s) => s.title))];
  const rec = new Set(String(cur?.recipients || "전 직원;실·국·사업소장").split(";"));

  return (
    <UsLayout side={<CeoSide on="letter" role={role} />}>
      <div className="usf-top">
        <div>
          <h1 className="us-h1">기관장 서한문 {cur ? "수정" : "작성"}</h1>
          <div className="usf-sub">발신 명의는 「용인특례시장」입니다. 발송하면 각 부서 담당자에게 알림이 가고 경영책임자 활동기록에 남습니다.</div>
        </div>
      </div>
      {sp.err && <p className="usf-err">제목과 본문을 적어 주십시오.</p>}
      <form action={saveLetter} className="usf-form">
        <input type="hidden" name="role" value={role} />
        {cur && <input type="hidden" name="id" value={cur.letter_id} />}
        <table className="us-tbl">
          <tbody>
            <tr><th>제목</th><td><input type="text" name="title" defaultValue={cur?.title || ""} placeholder="예) 2026년 안전보건 경영방침 선포 서한" required /></td></tr>
            <tr><th>수신 대상</th><td><div className="usf-checks">
              {RECIPIENTS.map((r) => <label key={r}><input type="checkbox" name="recipients" value={r} defaultChecked={rec.has(r)} />{r}</label>)}
            </div></td></tr>
            <tr><th>관련 의무</th><td><select name="related_duty" defaultValue={cur?.related_duty || duties[0]}>
              <option value="">선택 안 함</option>
              {duties.map((d) => <option key={d} value={d}>{d}</option>)}
            </select></td></tr>
            <tr><th>발송일</th><td><input type="date" name="sent_at" defaultValue={cur?.sent_at || ymd()} /></td></tr>
            <tr><th>본문</th><td><textarea name="body" className="usf-body" defaultValue={cur?.body || START} required /></td></tr>
            <tr><th><EvHead /></th><td>
              {cur?.evidence_name && <div className="us-muted">지금 첨부: {cur.evidence_name}</div>}
              <input type="file" name="evidence_file" />
            </td></tr>
          </tbody>
        </table>
        <div className="usf-actions">
          <Link className="us-btn w" href={`/ceo/letter?role=${role}`}>목록으로</Link>
          <button className="us-btn" type="submit" name="mode" value="draft">임시저장</button>
          <button className="us-btn g" type="submit" name="mode" value="send">발송</button>
        </div>
      </form>
    </UsLayout>
  );
}
