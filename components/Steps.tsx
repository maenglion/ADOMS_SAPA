import Link from "next/link";

/**
 * [캡처 v2] 업무이행 단계 막대 — 화면 맨 위에서 절차를 왼쪽→오른쪽으로 보여 준다(2026-09-22 사용자 지시).
 * 단계마다 이름(짧게) + 숫자 하나. 지금 할 단계는 on, 끝난 단계는 done. 설명 문장은 넣지 않는다.
 */
export type Step = { label: string; n?: number | string; href?: string; state?: "on" | "done" | "warn" | "" };

export default function Steps({ items }: { items: Step[] }) {
  return (
    <ol className="steps">
      {items.map((s, i) => {
        const body = (
          <>
            <span className="st-no">{i + 1}</span>
            <span className="st-label">{s.label}</span>
            {s.n !== undefined && s.n !== "" && <span className="st-n">{typeof s.n === "number" ? s.n.toLocaleString() : s.n}</span>}
          </>
        );
        return (
          <li key={s.label} className={s.state || ""}>
            {s.href ? <Link href={s.href}>{body}</Link> : <div>{body}</div>}
          </li>
        );
      })}
    </ol>
  );
}

/** [캡처 v2] 핵심 값 칸 — 이름 한 줄 + 값 한 줄. 설명 없이 숫자·짧은 값만. */
export function Facts({ items }: { items: { k: string; v: React.ReactNode }[] }) {
  return (
    <div className="facts">
      {items.map((x) => (
        <div key={x.k} className="fact"><div className="fk">{x.k}</div><div className="fv">{x.v}</div></div>
      ))}
    </div>
  );
}
