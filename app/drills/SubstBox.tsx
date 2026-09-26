// [캡처 v2] 갈음 판정 칸 — 한 줄(시설 · 배지 · 근거 링크) + 확인 이력은 접기로(2026-09-22).
import Link from "next/link";
import type { ReactNode } from "react";
import type { Substitute } from "@/lib/drill";
import { did } from "./codes";

/** 대피훈련 갈음 판정 배지 — 두 화면(/drills · /system?area=F)이 같은 모양으로 보인다. */
export function SubstBadge({ x }: { x: Substitute }) {
  return <span className={`badge ${x.state === "갈음 인정" ? "ok" : "bad"}`} title="철도안전법 제7조">갈음 {x.state === "갈음 인정" ? "인정" : "확인 없음"}</span>;
}

/** 대피훈련 갈음 판정 한 칸 — 판정은 lib/drill.ts drillSubstitutes 가 한다(여기는 보이기만). */
export default function SubstBox({ x, role, children }: { x: Substitute; role: string; children?: ReactNode }) {
  const planLink = x.plan.src === "훈련 계획" && x.plan.id
    ? <Link href={`/drills/${x.plan.id}?role=${role}#subst`}>{x.plan.title}</Link>
    : <Link href={`/system?area=F&role=${role}#records`}>{x.plan.title}</Link>;
  return (
    <div className="card" style={{ margin: "10px 0" }}>
      <b>{x.facility_name}</b> <SubstBadge x={x} /> <span className="muted" title={x.where}>· {planLink}</span>
      {children && <div style={{ marginTop: 6 }}>{children}</div>}
      {(x.checks.length > 0 || x.planRef) && (
        <details className="fold" style={{ marginTop: 6 }}>
          <summary>확인 이력 <span className="muted">{x.checks.length}</span></summary>
          <div className="muted">{x.where}{x.plan.revised_at && ` · 개정 ${x.plan.revised_at}`}</div>
          <ul className="muted" style={{ margin: "4px 0 0", paddingLeft: 20 }}>
            {x.checks.map((c) => (
              <li key={`${c.src}-${c.id}`}>
                {c.at || "날짜 없음"} · {c.mode} ·{" "}
                {c.src === "훈련 계획"
                  ? <Link href={`/drills/${c.id}?role=${role}#subst`}>{did(c.id)}</Link>
                  : <Link href={`/system?area=F&role=${role}#records`}>체계 문서</Link>}
                {c.counted ? "" : ` — 세지 않음(${c.why})`}
              </li>
            ))}
            {x.planRef && <li>안전계획 확인 {x.planRef.at} — 이 갈음에는 세지 않음</li>}
          </ul>
        </details>
      )}
    </div>
  );
}
