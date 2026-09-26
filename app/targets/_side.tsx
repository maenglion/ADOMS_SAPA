/**
 * [400 · 교육자료 버전] 묶음 B1 좌측 사이드바 — 참고 명세 SCR-027~033 의 LNB 원문.
 *   「기본정보」(사업장 / 공중이용시설·공중교통수단 / 원료·제조물) + 「사업」(도급·용역·위탁 현황)
 * 관리자 화면(SCR-023)은 명세 (A) 구성: 중대산업재해 · 중대시민재해 · 경영책임자.
 * 공통 부품 Side 는 1단 패널이 하나뿐이라 같은 us- 클래스로 자체 목록을 둔다.
 */
import Link from "next/link";

type Item = { href: string; label: string; on?: boolean };

function Panel({ title, items }: { title: string; items: Item[] }) {
  return (
    <div className="us-panel">
      <div className="us-panel-h">{title}</div>
      {items.map((it) => (
        <Link key={it.label + it.href} href={it.href} className={it.on ? "on" : ""}>
          {it.on ? "◉ " : ""}{it.label}
        </Link>
      ))}
    </div>
  );
}

/** 사업장·부서 담당자용(SCR-027~033). on = ws | fc | mt | contract */
export function B1Side({ role, on }: { role: string; on: "ws" | "fc" | "mt" | "contract" }) {
  const r = `role=${role}`;
  return (
    <aside className="us-side">
      <Panel title="기본정보" items={[
        { href: `/targets/basic?t=ws&${r}`, label: "사업장", on: on === "ws" },
        { href: `/targets/basic?t=fc&${r}`, label: "공중이용시설·공중교통수단", on: on === "fc" },
        { href: `/targets/basic?t=mt&${r}`, label: "원료·제조물", on: on === "mt" },
      ]} />
      <Panel title="사업" items={[
        { href: `/targets/contract?${r}`, label: "도급·용역·위탁 현황", on: on === "contract" },
      ]} />
    </aside>
  );
}

/** 중대재해 담당부서(관리자)용(SCR-023). 다른 묶음(관리자 B2 · 기관장 F) 주소로 잇는다. */
export function AdminSide({ role }: { role: string }) {
  const r = `role=${role}`;
  return (
    <aside className="us-side">
      <Panel title="중대산업재해" items={[
        { href: `/admin/role?${r}`, label: "담당자 권한지정" },
        { href: `/admin/assign?${r}`, label: "담당자 관리대상 지정" },
        { href: `/targets/workplace?${r}`, label: "사업장 기본정보 관리", on: true },
        { href: `/admin/law?t=ws&${r}`, label: "관계 법령 관리" },
      ]} />
      <Panel title="중대시민재해" items={[
        { href: `/admin/role?d=civil&${r}`, label: "담당자 권한지정" },
        { href: `/admin/assign?d=civil&${r}`, label: "담당자 관리대상 지정" },
        { href: `/admin/basic?${r}`, label: "기본정보 관리" },
        { href: `/admin/law?t=fc&${r}`, label: "관계 법령 관리" },
      ]} />
      <Panel title="경영책임자" items={[{ href: `/ceo?${r}`, label: "활동기록" }]} />
    </aside>
  );
}
