/**
 * 좌측 메뉴 공용 — 녹색 묶음 머리 + 꺽쇠로 접었다 펴기(09-25 사용자: 의무이행 좌측과 같은 모양 · 같은 꺽쇠로 통일).
 *  · 브라우저 기본 details(자바스크립트 없음) · 지금 화면이 든 묶음은 펼친 채로 연다(아무 묶음에도 없으면 전부 펼침)
 *  · 되돌리기 = FOLD_SIDES 를 false 로(접기 없이 늘 펼친 옛 패널 모양)
 * 모양은 app/us-lsx.css 의 .us-tgrp(의무이행 좌측과 같은 규칙).
 */
import Link from "next/link";
import SubLabel from "./SubLabel";
import { withAdomsRole } from "@/lib/adoms-role";

export const FOLD_SIDES = true;

export type SideGroup = { head: string; items: { href: string; label: string; on?: boolean }[] };

export function Chev() {
  return (
    <svg className="us-tgrp-chev" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function GroupSide({ groups, className = "us-side", role }: { groups: SideGroup[]; className?: string; role?: string }) {
  const any = groups.some((g) => g.items.some((i) => i.on));
  const body = (g: SideGroup) => g.items.map((m) => (
    <Link key={m.href} href={role ? withAdomsRole(m.href, role) : m.href} className={m.on ? "on" : ""}>{m.on ? "◉ " : ""}<SubLabel text={m.label} /></Link>
  ));
  if (!FOLD_SIDES) {
    return (
      <aside className={className}>
        {groups.map((g) => (
          <div key={g.head} className="us-panel usb2-side"><div className="us-panel-h">{g.head}</div>{body(g)}</div>
        ))}
      </aside>
    );
  }
  return (
    <aside className={className}>
      {groups.map((g) => {
        const mine = g.items.some((i) => i.on);
        return (
          <details key={g.head} className={`us-tgrp us-tgrp-l${mine || !any ? " on" : ""}`} open={mine || !any}>
            <summary className="us-panel-h"><span>{g.head}</span><Chev /></summary>
            <div className="us-tgrp-list">{body(g)}</div>
          </details>
        );
      })}
    </aside>
  );
}
