/**
 * [400 · 교육자료 버전] 묶음 G 좌측 사이드바 — 참고 명세 08 §0-4 원문(연녹색 카드 3개).
 *   [중대재해 통계] 중대재해 발생통계 · 중대재해 대상통계
 *   [사례] 중대재해 사고사례
 *   [안전·보건 관계 법령] 중대산업재해 · 중대시민재해(공중이용시설 · 공중교통수단 · 원료·제조물) — 09-25 하위 메뉴 4개
 * 현재 화면 항목 앞에 ◉ + 진녹색 볼드(us-panel a.on).
 */
import Link from "next/link";
import SubLabel from "@/components/us/SubLabel";

export type StatsOn = "occur" | "target" | "cases" | "laws";

function Panel({ title, items }: { title: string; items: { href: string; label: string; on: boolean }[] }) {
  return (
    <div className="us-panel usg-panel">
      <div className="us-panel-h">{title}</div>
      {items.map((it) => (
        <Link key={it.href} href={it.href} className={it.on ? "on" : ""}>
          {it.on ? "◉ " : ""}<SubLabel text={it.label} />
        </Link>
      ))}
    </div>
  );
}

export function StatsSide({ role, on, sec }: { role: string; on: StatsOn; sec?: string }) {
  const r = `role=${role}`;
  return (
    <aside className="us-side usg-side">
      <Panel title="중대재해 통계" items={[
        { href: `/stats/occur?${r}`, label: "중대재해 발생통계", on: on === "occur" },
        { href: `/stats/target?${r}`, label: "중대재해 대상통계", on: on === "target" },
      ]} />
      <Panel title="중대재해 사고사례" items={[   /* 09-26 사용자: 「사례」 → 「중대재해 사고사례」(머리 메뉴 소제목과 같게) */
        { href: `/stats/cases?${r}`, label: "중대재해 사고사례", on: on === "cases" },
      ]} />
      {/* 09-25 사용자: 하위 메뉴 2개 — 중대시민재해는 화면 안 라디오로 공중이용시설 · 공중교통수단 · 원료·제조물을 고른다 */}
      <Panel title="안전·보건 관계 법령" items={[
        { href: `/stats/laws?${r}&sec=i`, label: "중대산업재해", on: on === "laws" && (sec || "i") === "i" },
        { href: `/stats/laws?${r}&sec=f`, label: "중대시민재해", on: on === "laws" && !!sec && sec !== "i" },
      ]} />
    </aside>
  );
}
