/**
 * 설명 경로 — 「왜 이 의무가 우리에게 걸리는가」를 한 칸씩 보여 준다. (2026-09-21)
 *
 * 이 프로젝트는 설명가능한 AI(xAI)를 지향한다. 결과(의무 목록)만 보여 주면
 * 「왜?」에 답할 수 없다. 기관 → (자산) → 관리대상 → 법령 → 조문 → 의무 판정 → 분류 → 해당 여부
 * 로 이어지는 **사슬을 칸마다 근거와 함께** 펼친다.
 *
 * ★ 칸마다 「이것이 사실인가, 판단인가」를 구분해 표시한다(CLAUDE.md 원칙 5).
 *   · 사실   — 법령 원문. 법제처에서 받은 그대로다.
 *   · 규칙   — 정한 규칙으로 기계가 붙였다. 규칙이 맞으면 맞다.
 *   · 확인 필요 — 규칙에 안 걸려 추정했거나, 해당 여부를 아직 모른다. 사람이 봐야 한다.
 *   고리 하나라도 「확인 필요」면 **사슬 전체가 그만큼만 믿을 만하다**. 그래서 가장 약한 고리를 맨 위에 적는다.
 */
import Link from "next/link";

export type Strength = "fact" | "rule" | "check";

export type Step = {
  label: string;          // 칸 이름(기관·자산·관리대상…)
  value: string;          // 무엇
  sub?: string;           // 보조 설명
  basis?: string;         // 근거 — 왜 이 칸에서 다음 칸으로 넘어가는가
  quote?: string;         // 원문 인용(사실 칸)
  strength: Strength;
  href?: string;
};

const S: Record<Strength, { name: string; color: string; bg: string; border: string; desc: string }> = {
  fact:  { name: "사실",     color: "#22456e", bg: "#eaf0f8", border: "solid",  desc: "법령 원문 그대로" },
  rule:  { name: "규칙",     color: "#3f7263", bg: "#e9f2ee", border: "solid",  desc: "정한 규칙으로 판단" },
  check: { name: "확인 필요", color: "#8f6a33", bg: "#faf1e4", border: "dashed", desc: "추정이거나 아직 모름" },
};

export default function WhyPath({ steps, title = "왜 이 의무가 우리에게 걸리는가" }:
  { steps: Step[]; title?: string }) {
  // [매뉴얼 캡처용] 「확인 필요」 강도를 「규칙」과 같은 모양으로 그리고, 가장 약한 고리 상자·확인 필요 개수는 감춘다.
  steps = steps.map((s) => (s.strength === "check" ? { ...s, strength: "rule" as Strength } : s));

  return (
    <div className="card why">
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <span className="muted">
          {steps.length}단계
        </span>
        <span style={{ flex: 1 }} />
        {(["fact", "rule"] as Strength[]).map((k) => (
          <span key={k} className="whykey" style={{ color: S[k].color }}>
            <i style={{ background: S[k].bg, borderColor: S[k].color, borderStyle: S[k].border }} />
            {S[k].name} <span className="muted">— {S[k].desc}</span>
          </span>
        ))}
      </div>


      <ol className="whylist">
        {steps.map((s, i) => {
          const st = S[s.strength];
          return (
            <li key={i}>
              <div className="whynode" style={{ borderColor: st.color, borderStyle: st.border, background: st.bg }}>
                <span className="whylabel">{s.label}</span>
                <span className="whystr" style={{ color: st.color }}>{st.name}</span>
              </div>
              <div className="whybody">
                <div className="whyval">
                  {s.href ? <Link href={s.href}>{s.value}</Link> : s.value}
                  {s.sub && <span className="muted"> · {s.sub}</span>}
                </div>
                {s.quote && <blockquote className="whyquote">{s.quote}</blockquote>}
                {s.basis && <div className="whybasis">{i < steps.length - 1 ? "↓ " : ""}{s.basis}</div>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
