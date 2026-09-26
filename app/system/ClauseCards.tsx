// [캡처 v2] 호별 카드 → 한 줄 표(호 · 이름 · 상태 · 부족 · 이동). 조문 원문·근거 설명은 접기 안으로.
import Link from "next/link";
import { ST_LABEL, ST_TONE, type Clause, type St } from "@/lib/system";
import type { Step } from "@/components/Steps";

const refOf = (c: Clause) => (c.ref || `시행령 제4조제${c.no}호`).replace("시행령 ", "");

/**
 * 호별 표 — 세 탭이 같은 문법을 쓴다.
 * na[i] 가 참이면 그 호는 「해당 없음」으로 보인다(원료·제조물 — 모든 품목 비해당 · 별표 5 품목 없음).
 */
export default function ClauseCards({ clauses, sts, na }: { clauses: Clause[]; sts: St[]; na?: boolean[] }) {
  return (
    <>
      <table className="v2t">
        <thead><tr><th>호</th><th>항목</th><th className="cd">상태</th><th>부족</th><th>이동</th></tr></thead>
        <tbody>
          {clauses.map((c, i) => {
            const gap = na?.[i] ? undefined : c.checks.find((k) => k.st !== "ok" && k.st !== "unk") || c.checks.find((k) => k.st === "unk");
            const go = gap?.href ? { href: gap.href, label: gap.hrefLabel || "할 일" } : c.go?.[0];
            return (
              <tr key={c.anchor || c.no} id={c.anchor || `c${c.no}`}>
                <td title={c.ref || ""}>{refOf(c)}</td>
                <td title={c.text}><b>{c.name}</b></td>
                <td className="cd">{na?.[i] ? <span className="badge none">해당 없음</span> : <span className={`badge ${ST_TONE[sts[i]]}`}>{ST_LABEL[sts[i]]}</span>}</td>
                <td title={gap?.fix || gap?.basis || ""}>{gap ? <span className={`badge ${ST_TONE[gap.st]}`}>{gap.label}</span> : <span className="muted">—</span>}</td>
                <td>{go ? <Link href={go.href}>{go.label.slice(0, 8)} →</Link> : null}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <details className="card fold" style={{ marginTop: 8 }}>
        <summary>호별 점검 항목</summary>
        {clauses.map((c, i) => (
          <div key={c.anchor || c.no} style={{ marginBottom: 8 }}>
            <b>{refOf(c)} {c.name}</b>
            <ul style={{ margin: "2px 0 0", paddingLeft: 18 }}>
              {c.checks.map((k) => (
                <li key={k.label}>
                  {na?.[i] ? <span className="badge none">해당 없음</span> : <span className={`badge ${ST_TONE[k.st]}`}>{ST_LABEL[k.st]}</span>} {k.label}
                  <span className="muted"> · {k.basis}</span>
                  {!na?.[i] && k.st !== "ok" && k.href && <> · <Link href={k.href}>{k.hrefLabel || "할 일"} →</Link></>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </details>
    </>
  );
}

/** [캡처 v2] 호 묶음 → 단계 막대 한 칸. 모두 갖춰짐 = done · 없음이 있으면 warn · 나머지는 빈칸(첫 미완료를 on 으로). */
export function clauseSteps(groups: { label: string; nos: number[]; href: string }[], clauses: Clause[], sts: St[], na?: boolean[]): Step[] {
  const out: Step[] = groups.map((g) => {
    const idx = clauses.map((c, i) => (g.nos.includes(c.no) && !na?.[i] ? i : -1)).filter((i) => i >= 0);
    const ok = idx.filter((i) => sts[i] === "ok").length;
    const state: Step["state"] = !idx.length || ok === idx.length ? "done" : idx.some((i) => sts[i] === "none") ? "warn" : "";
    return { label: g.label, n: idx.length ? `${ok}/${idx.length}` : "—", href: g.href, state };
  });
  const first = out.find((x) => x.state === "");
  if (first) first.state = "on";
  return out;
}
