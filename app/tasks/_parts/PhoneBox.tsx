// 09-26 사용자: 메뉴 밖 화면 합치기 — 옛 /qr(휴대폰 접속 안내)을 처리 현황의 「휴대폰으로 열기」 칸으로 옮김.
//   옛 화면 코드는 04_앱\_백업_메뉴밖화면합치기_20260926\app\qr\page.tsx 에 그대로 있다(되돌리기).
//   같은 와이파이면 배포하지 않아도 휴대폰이 바로 붙는다. 휴대폰 화면(/m)은 모양 그대로 둔다.
import Link from "next/link";
import Qr from "@/components/Qr";
import { lanBase } from "@/lib/lan";
import { ROLE_LABEL } from "@/lib/roles";
import { useStorage } from "@/lib/storage";

export const PHONE_ROLES = ["road", "water", "mgr"] as const;

/** 휴대폰 역할 — 지금 역할이 휴대폰 역할이면 그대로, 아니면 도로구조물과 실무자. */
export const phoneRoleOf = (role: string, pr?: string) =>
  pr && (PHONE_ROLES as readonly string[]).includes(pr) ? pr
    : (PHONE_ROLES as readonly string[]).includes(role) ? role : "road";

/** 「휴대폰으로 열기」 칸 — 처리 현황 화면 아래. open 이면 펼친 채로 연다. */
export async function PhoneBox({ role, open }: { role: string; open: boolean }) {
  const { url, host, port, guessed } = lanBase();
  return (
    <details id="phone" className="card fold" style={{ marginTop: 14 }} open={open}>
      <summary>휴대폰으로 열기 <span className="muted">현장 사진 등록</span></summary>
      <div className="chips">
        <span className="badge none">같은 와이파이</span>
        <span className="badge none">{host}:{port}</span>
        {useStorage ? <span className="badge ok">클라우드 저장</span> : <span className="badge none">서버 저장</span>}
        {!guessed && <span className="badge warn">랜 주소 못 찾음</span>}
        <span className="muted">QR 찍기 → 할 일 고름 → 사진 올림 → 판정</span>
      </div>

      <div className="grid g3" style={{ marginTop: 12 }}>
        {PHONE_ROLES.map((r) => (
          <div className="card" key={r} style={{ textAlign: "center" }}>
            <h3 style={{ marginBottom: 10 }}>{ROLE_LABEL[r]}</h3>
            <Qr text={`${url}/m?role=${r}`} size={180} />
            <div style={{ marginTop: 10, fontSize: ".95rem", wordBreak: "break-all", color: "var(--blue2)" }}>
              {url}/m?role={r}
            </div>
            <div style={{ marginTop: 8 }}>
              <Link className="btn sm ghost" href={`/tasks?role=${role}&phone=big&pr=${r}`}>크게 띄우기</Link>
            </div>
          </div>
        ))}
      </div>

      <details className="fold" style={{ marginTop: 12 }}>
        <summary>안 될 때</summary>
        <table className="v2t">
          <tbody>
            <tr><td>안 열림</td><td>같은 와이파이로 바꾸기</td></tr>
            <tr><td>화면 안 뜸</td><td>방화벽 {port} 포트 허용</td></tr>
            <tr><td>사진 실패</td><td>25MB 넘는 파일</td></tr>
            <tr><td>밖에서 쓰기</td><td>배포 필요</td></tr>
          </tbody>
        </table>
      </details>
    </details>
  );
}

/** 크게 띄우기 — 옛 /qr?big=1. 참석자가 휴대폰으로 찍어 들어가게 화면 가운데 큰 QR 하나. */
export async function PhoneBig({ role, pr }: { role: string; pr: string }) {
  const { url } = lanBase();
  const target = `${url}/m?role=${pr}`;
  return (
    <div style={{ textAlign: "center", padding: "30px 10px" }}>
      <h1 style={{ fontSize: "2.2rem" }}>휴대폰으로 찍으세요</h1>
      <p className="muted" style={{ fontSize: "1.1rem" }}>{ROLE_LABEL[pr]}</p>
      <div style={{ margin: "22px 0" }}>
        <Qr text={target} size={420} />
      </div>
      <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--navy)", letterSpacing: "-.5px", wordBreak: "break-all" }}>
        {target}
      </div>
      <p className="muted" style={{ marginTop: 18 }}>
        같은 와이파이 · <Link href={`/tasks?role=${role}&phone=1#phone`}>작게 보기</Link>
      </p>
    </div>
  );
}
