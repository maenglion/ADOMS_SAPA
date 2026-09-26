import Link from "next/link";

export function Stat({ n, l, tone = "", href = "" }: { n: any; l: string; tone?: string; href?: string }) {
  const body = (
    <div className={`card stat ${tone}`}>
      <div className="n">{typeof n === "number" ? n.toLocaleString() : n}</div>
      <div className="l">{l}</div>
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: "none" }}>{body}</Link> : body;
}

export function Badges({ text }: { text?: string }) {
  // [매뉴얼 캡처용] 미완성 표시 배지(조건부 의무·자산 대장 없음·분류 추론·반영 대기·검수 전 등)를 그리지 않는다.
  if (true) return null;
  if (!text) return null;
  return (
    <>
      {text.split(" · ").filter(Boolean).map((b, i) => {
        const tone = b.includes("조건부") ? "warn" : b.includes("확인 필요") || b.includes("대장 없음") ? "bad"
          : /추론|자동 판단|잠정|검수|미반영|반영 대기/.test(b) ? "none" : "";
        return <span key={i} className={`badge ${tone}`} style={{ marginRight: 4 }}>{b}</span>;
      })}
    </>
  );
}

// 재해 구분은 법령 용어 그대로 쓴다(09-22 정정 — 「산업」「시민」 약칭 금지). 긴 것은 두 줄로.
const AREA_LABEL: Record<string, [string, string?]> = {
  I: ["중대산업재해"],
  F: ["중대시민재해", "(공중이용시설·공중교통수단)"],
  M: ["중대시민재해", "(원료·제조물)"],
};
export function AreaBadge({ area }: { area?: string }) {
  if (!area) return null;
  const tone = area === "I" ? "ok" : area === "F" ? "" : "warn";
  const lab = AREA_LABEL[area];
  if (!lab) return <span className={`badge ${tone}`}>{area}</span>;
  if (!lab[1]) return <span className={`badge ${tone}`}>{lab[0]}</span>;
  return (
    <span className={`badge ${tone}`} style={{ display: "inline-block", lineHeight: 1.25, textAlign: "center", verticalAlign: "middle" }}>
      {lab[0]}<br /><span style={{ fontSize: "0.85em" }}>{lab[1]}</span>
    </span>
  );
}

export function StatusBadge({ s }: { s?: string }) {
  const tone = s === "이행완료" || s === "점검완료" ? "ok" : s === "조치필요" ? "warn"
    : s === "기간초과" ? "bad" : "none";
  return <span className={`badge ${tone}`}>{s}</span>;
}

export function Bar({ pct }: { pct: number }) {
  return <div className="bar"><i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>;
}
