import { depts, staff, forms, duties, assets, tasks, lawChanges, source, useDb } from "@/lib/data";
import { Stat } from "@/components/bits";
import { isDemoMode } from "@/lib/mode";
import Link from "next/link";
import Qr from "@/components/Qr";
import ResetButton from "./ResetButton";
import { activityLog } from "@/lib/data";
import { lanBase } from "@/lib/lan";
import { idKo } from "@/lib/labels";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// 09-26 사용자: 메뉴 밖 화면 합치기 — 「설정」은 성격이 다른 네 가지가 모인 화면이라 각자 제자리로 보냈다.
//   조직·담당자 → 관리자 › 담당자 권한지정(/admin/role) · 법령 개정 알림 → 법 의무사항 › 법령 개정 현황(/law/changes)
//   · 법정 서식 → 관리자 › 서식 › 법정 서식(/admin/forms, 새 화면) · 휴대폰 현장 사진 QR → 처리 현황(몫 A).
//   이 주소는 /admin/forms 로 보낸다. 되돌리려면 아래 SETTINGS_MERGED 를 false 로(옛 화면 코드는 그대로 두었다).
const SETTINGS_MERGED = true;

/** S11 — 설정. 조직·담당자·서식·법령 개정·데이터 출처. */
// [캡처 v2] 설명 문단·안내 문장 제거, 표 칸 줄임(부서 코드 빼기), 서식 표 15행 + 전체 링크, 날짜 MM-DD(09-22). 단계 막대 없음(설정 화면)
export default async function Settings({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";
  if (SETTINGS_MERGED) redirect(`/admin/forms?role=${encodeURIComponent(role)}`);   // 09-26 사용자: 메뉴 밖 화면 합치기 — 뺌
  const demo = await isDemoMode();
  const d = await depts();
  const s = await staff();
  const f = await forms();
  const du = await duties({ limit: 100000 });
  const a = await assets({ limit: 2000 });
  const t = await tasks({ limit: 5000 });
  const lc = await lawChanges();

  // [매뉴얼 캡처용] 근거 문서는 식별자(DOC-…) 대신 문서 이름으로
  const docName = new Map<string, string>(du.map((r: any) => [r.doc_id, r.doc || r.law]));
  const badge = (k: string) => du.filter((r: any) => (r.badge || "").includes(k)).length;

  return (
    <>
      <h1 className="v2h">설정</h1>
      {demo && (
        <div className="grid g5" style={{ marginBottom: 6 }}>
          <Stat n={du.length} l="의무" />
          <Stat n={a.length} l="관리 자산" />
          <Stat n={t.length} l="이행 과제" />
          <Stat n={f.length} l="법정 서식" />
          <Stat n={d.length} l="부서" />
        </div>
      )}

      {/* [매뉴얼 캡처용] 보기 모드 칸 감춤 */}
      <h2>휴대폰 현장 사진</h2>
      <div className="card" style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        <Qr text={`${lanBase().url}/m?role=road`} size={150} label="실무자(도로구조물과)용" />
        <div style={{ flex: 1, minWidth: 260 }}>
          <p style={{ marginTop: 0 }}><b>{lanBase().url}/m</b> <span className="muted">· 같은 와이파이</span></p>
          <Link className="btn" href="/qr">QR 크게</Link>
        </div>
      </div>

      {!demo && <><h2>입력 기록 되돌리기</h2>
        <div className="card" style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <b>화면에서 입력한 기록 {(await activityLog()).length.toLocaleString()}건</b>
          </div>
          {/* 09-26 사용자: 「화면 입력 모두 지우기」 단추는 없앤다 */}
        </div></>}

      {!demo && <><h2>데이터 원천</h2>
      <div className="card">
        <p>원천: <b>{source()}</b> {useDb ? "" : <span className="badge none">파일</span>}</p>
        <div className="grid g5" style={{ marginTop: 10 }}>
          <Stat n={du.length} l="의무(분류)" />
          <Stat n={a.length} l="자산(관리대상)" />
          <Stat n={t.length} l="이행 과제" />
          <Stat n={f.length} l="법정 서식" />
          <Stat n={d.length} l="부서" />
        </div>
      </div></>}

      {!demo && <><h2>확인 대기</h2>
      <div className="grid g4">
        <Stat n={badge("조건부")} l="조건부" tone="warn" />
        <Stat n={badge("자산 대장 없음")} l="대장 없음" tone="bad" />
        <Stat n={badge("추론") + badge("자동 판단")} l="자동 분류" />
        <Stat n={badge("미반영") + badge("반영 대기")} l="반영 대기" />
      </div>
</>}

      <h2>조직 · 담당자</h2>
      {/* 09-24 조직 재편 — 용인시청 누리집 「부서 및 업무안내」(2026-09-24 조회)의 실제 소속·담당업무. 결재선: 실무자 → 부서장 → 총괄 → 경영책임자 */}
      <p className="muted" style={{ margin: "0 0 6px" }}>결재선 — 실무자(주무관) 제출 → 부서장 확인 → 총괄(중대재해예방팀) 승인 → 경영책임자(시장) 보고 확인 · 관련 부서가 겹치면 책임이 큰 한 곳에 두고 유관 부서는 「유관」 칸에 적었다</p>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>부서</th><th>역할</th><th>실제 소속</th><th>맡는 일</th><th>유관 부서</th><th>부서장</th><th>실무자</th><th className="num">과제</th></tr></thead>
          <tbody>
            {d.filter((x: any) => x.dept_id !== "D99").map((x: any) => {
              const mem = s.filter((p: any) => p.dept_id === x.dept_id);
              const heads = mem.filter((p: any) => p.approval_level === "2" || p.approval_level === "3");
              const doers = mem.filter((p: any) => !p.approval_level || p.approval_level === "1");
              const n = t.filter((r: any) => r.dept_id === x.dept_id).length;
              return (
                <tr key={x.dept_id}>
                  <td><b>{x.dept_name}</b>{x.web_checked === "N" && <div><span className="badge warn" title="누리집 부서 목록에서 확인하지 못했다">소속 확인 필요</span></div>}</td>
                  <td><span className="badge">{x.dept_role}</span></td>
                  <td style={{ fontSize: ".85rem" }}>{x.org_path || "-"}</td>
                  <td style={{ fontSize: ".85rem", maxWidth: "22em" }}>{x.duties || "-"}</td>
                  <td style={{ fontSize: ".82rem", maxWidth: "20em" }} className="muted">{x.related_note || "-"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{heads.map((p: any) => <div key={p.staff_id}>{p.display_name}</div>)}</td>
                  <td>{doers.map((p: any) => p.display_name).join(" · ")}</td>
                  <td className="num">{n.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>법령 개정 알림</h2>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>법령</th><th>개정 문서</th><th>구분</th><th className="dt">공포</th><th className="dt">시행</th><th className="num">영향</th></tr></thead>
          <tbody>
            {lc.map((c: any) => (
              <tr key={c.change_id}>
                <td title={c.law}>{c.law}</td><td title={c.doc}>{c.doc}</td>
                <td><span className="badge warn">{c.changed_kind}</span></td>
                <td className="dt">{String(c.promulgated_at || "").slice(5, 10)}</td><td className="dt">{String(c.effective_at || "").slice(5, 10)}</td>
                <td className="num">{Number(c.affected_duty_cnt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>법정 서식 <span className="muted">{f.length}</span></h2>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>번호</th><th>서식명</th><th>종류</th><th>근거</th></tr></thead>
          <tbody>
            {f.slice(0, sp.forms === "all" ? 200 : 15).map((x: any) => (
              <tr key={x.form_id}>
                <td className="cd">{idKo(x.form_id)}</td><td title={x.title}><Link href={`/forms/${x.form_id}?back=/settings`}>{x.title}</Link></td>
                <td><span className="badge none">{x.schedule_kind === "table" ? `별표 ${x.schedule_no}` : `서식 ${x.schedule_no}`}</span></td>
                <td className="muted" title={docName.get(x.doc_id) || ""}>{docName.get(x.doc_id) || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sp.forms !== "all" && f.length > 15 && <Link className="more" href={`/settings?role=${role}&forms=all`}>전체 {f.length}건 →</Link>}
    </>
  );
}
