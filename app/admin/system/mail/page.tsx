// 09-25 사용자: 「메일 발송은 포함하자(문자는 외부 시스템 연동이 필요할 테니)」 — 시스템 관리 › 메일 설정 확인.
//  설정 여부 · 발신 주소 · 최근 발송 기록. 비밀값(로그인 이름 · 비밀번호)은 「있음/없음」만 보인다.
//  설정은 환경 변수로만 받는다(화면에서 고치지 않는다) — 방법은 아래 안내 · lib/mail.ts 머리.
//  이 화면에는 「시험 발송」 단추를 두지 않는다(밖으로 나가는 일이라 설정한 사람이 따로 확인한다).
import { UsLayout } from "@/components/us/Parts";
import AdminSide from "../../_side";
import { mailConfigView } from "@/lib/mail";
import { MAIL_LOG, CHANNEL_LIST } from "@/lib/channels";
import { readTable, staff } from "@/lib/data";

export const dynamic = "force-dynamic";

const fmt = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default async function MailAdmin() {
  const v = mailConfigView();
  const [rows, st] = await Promise.all([readTable(MAIL_LOG).catch(() => []), staff()]);
  const nm = new Map(st.map((x: any) => [x.staff_id, x.display_name]));
  const recent = rows.slice(0, 30);
  const cnt = (k: string) => rows.filter((r: any) => String(r.status || "").startsWith(k)).length;

  return (
    <UsLayout side={<AdminSide page="system/mail" />}>
      <div className="us-head usb2-head">
        <h1 className="us-h1"><span className="usb2-pre">시스템 관리</span> 메일 설정</h1>
      </div>

      <section className="sysm-box">
        <h2 className="usb2-h2">메일 서버 설정 {v.ready ? <span className="sysm-ok">설정됨 — 보냅니다</span> : <span className="sysm-no">설정 없음 — 보내지 않습니다</span>}</h2>
        <table className="us-tbl sysml-cfg">
          <tbody>
            <tr><th>메일 서버</th><td>{v.host ? `${v.host} : ${v.port}` : <span className="sysm-no">없음</span>}</td></tr>
            <tr><th>암호화</th><td>{v.host ? v.secure : "-"}</td></tr>
            <tr><th>발신 주소</th><td>{v.from ? `${v.fromName} <${v.from}>` : <span className="sysm-no">없음</span>}</td></tr>
            <tr><th>로그인 이름</th><td>{v.login}</td></tr>
            <tr><th>비밀번호</th><td>{v.pass}</td></tr>
            <tr><th>서버 인증서</th><td>{v.host ? v.verify : "-"}</td></tr>
          </tbody>
        </table>
        {!v.ready && (
          <p className="sysm-note">
            지금은 메시지 보내기에서 전자우편을 골라도 <b>밖으로 보내지 않고</b> 발송 기록에 「발송 대기(메일 서버 설정 필요)」로 남깁니다.
            {v.missing.length > 0 && <> 빠진 설정: {v.missing.join(" · ")}</>}
          </p>
        )}
        <p className="us-muted sysm-note">
          발신 수단: {CHANNEL_LIST.map((c) => `${c.label}(${c.ready ? "사용" : c.note})`).join(" · ")} — 문자 · 카카오톡은 외부 시스템 연동이 필요해 연결 준비 중입니다.
        </p>
      </section>

      <details className="sysm-box">
        <summary className="usb2-h2">설정 방법</summary>
        <ol className="sysml-how">
          <li>기관 메일 담당 부서에서 발송용 메일 서버 주소 · 포트 · 발신 주소(필요하면 로그인 계정)를 받습니다.</li>
          <li>이 시스템이 도는 컴퓨터의 환경 변수(또는 프로그램 폴더의 환경 설정 파일)에 아래 값을 적습니다.
            <pre className="sysml-pre">{`SMTP_HOST=메일 서버 주소
SMTP_PORT=587            (처음부터 암호화면 465)
SMTP_SECURE=false        (465 면 true)
SMTP_USER=로그인 계정      (내부 중계 서버처럼 로그인이 없으면 비움)
SMTP_PASS=비밀번호
MAIL_FROM=발신 주소
MAIL_FROM_NAME=용인특례시 중대재해 통합관리`}</pre>
          </li>
          <li>시스템을 다시 시작합니다. 이 화면이 「설정됨」으로 바뀌면 그때부터 보냅니다.</li>
          <li>받는 사람 주소는 직원 명부의 전자우편 칸을 씁니다. 주소가 없는 사람은 건너뛰고 기록에 「주소 없음」으로 남깁니다.</li>
        </ol>
        <p className="us-muted sysm-note">연락처를 밖으로 내보내는 일이므로, 연결 전에 기관의 승인 · 동의 절차를 거칩니다.</p>
      </details>

      <section className="sysm-box">
        <h2 className="usb2-h2">최근 발송 기록 <small className="us-muted">전체 {rows.length}건 · 발송 {rows.filter((r: any) => r.status === "발송").length} ·발송 대기 {cnt("발송 대기")} · 실패 {cnt("실패")} · 주소 없음 {cnt("미발송")}</small></h2>
        {recent.length === 0 ? <p className="us-muted">아직 기록이 없습니다. 이행현황의 「메시지 보내기」에서 전자우편을 고르면 여기에 남습니다.</p> : (
          <table className="us-tbl sysm-tbl">
            <thead><tr><th>시각</th><th>종류</th><th>보낸 사람</th><th>받는 사람</th><th>전자우편</th><th>결과</th></tr></thead>
            <tbody>
              {recent.map((r: any) => (
                <tr key={r.mail_id}>
                  <td className="c">{fmt(r.at)}</td>
                  <td>{r.notif_type}</td>
                  <td>{nm.get(r.from_staff_id) || r.from_staff_id}</td>
                  <td>{r.to_dept} {r.to_name}</td>
                  <td>{r.to_email || "-"}</td>
                  <td className={r.status === "발송" ? "sysm-ok" : "sysm-no"}>
                    {r.status}{r.error ? ` — ${r.error}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </UsLayout>
  );
}
