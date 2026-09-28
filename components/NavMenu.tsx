"use client";
import Link from "next/link";
import SubLabel from "./us/SubLabel";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { MENU_MODE, FLAT, GROUPS, isOn, groupHas, type MenuItem } from "@/lib/menu";
import { canAccess } from "@/lib/perm";
import { useMenuGroups, useRole, useSideCss } from "./MenuCtx";
import { withAdomsRole } from "@/lib/adoms-role";

/**
 * 머리 메뉴 — 주소가 바뀔 때마다 다시 그린다(2026-09-22).
 * 전에는 레이아웃(서버)에서 한 번만 그려, 다른 화면으로 옮겨도 밑줄(현재 위치)이 처음 화면에 머물렀다.
 * 같은 화면이 두 묶음에 들어 있으면(예: 내 업무) alias 가 아닌 쪽 묶음에 밑줄을 긋는다.
 */
function Inner({ demo }: { demo: boolean }) {
  const path = usePathname() || "/";
  const search = useSearchParams()?.toString() || "";
  // 09-25 사용자: 권한 제어 — 권한이 없는 메뉴는 보이지 않는다(규칙 lib/perm.ts · us 모양은 usGroupsFor 가 이미 거른다)
  const role = useRole();
  const show = (m: MenuItem) => !(demo && m.hideInDemo) && (m.heading || !m.href || canAccess(role, m.href));
  if (MENU_MODE === "us") return <UsGnb path={path} search={search} show={show} role={role} />;
  if (MENU_MODE === "bar") return <Bar path={path} search={search} show={show} role={role} />;
  if (MENU_MODE === "flat") {
    return (
      <nav className="gnb">
        {FLAT.filter(show).map((m) => (
          <Link key={m.href} href={withAdomsRole(m.href, role)} className={isOn(path, m.href, search) ? "on" : ""}>{m.label}</Link>
        ))}
      </nav>
    );
  }
  return (
    <nav className="gnb gnb2">
      {GROUPS.map((g) => {
        const items = g.items.filter(show);
        if (!items.length) return null;
        const on = items.some((m) => !m.alias && isOn(path, m.href, search));
        return (
          <div key={g.label} className={`grp${on ? " on" : ""}`}>
            <Link href={withAdomsRole((items.find((m) => m.href) || items[0]).href, role)} className="grp-h">{g.label}{items.length > 1 && <span className="caret">▾</span>}</Link>
            {items.length > 1 && (
              <div className="grp-m">
                {items.map((m, i) => m.heading
                  ? <div key={"h" + i} className="grp-sub">{m.label}</div>
                  : <Link key={m.href} href={withAdomsRole(m.href, role)} className={isOn(path, m.href, search) ? "on" : ""}>{m.label}</Link>)}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

/** [400 · 교육자료 버전] GNB 8개 — 가로 한 줄, 두 줄 글자, 올리면 하위 메뉴 카드. 켜진 묶음은 녹색. */
function UsGnb({ path, search, show, role }: { path: string; search: string; show: (m: MenuItem) => boolean; role: string }) {
  // 09-25 사용자: 역할별 메뉴 + 메뉴 관리 설정(이름 · 숨김 · 순서) — 셸이 실어 준 것(components/MenuCtx)
  const groups = useMenuGroups().map((g) => ({ ...g, items: g.items.filter(show) })).filter((g) => g.items.some((m) => m.href));
  const css = useSideCss();
  const cur = groups.find((g) => groupHas(g.items, path, search))
    || (path === "/" ? groups.find((g) => g.key === "이행현황") || groups[0] : undefined);
  // current route(cur)와 열린 드롭다운(openMenuKey)은 서로 다른 상태다.
  // 실제 표시 여부는 이 값 하나만 결정한다.
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  useEffect(() => setOpenMenuKey(null), [path, search]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpenMenuKey(null);
    const closeForRoleChange = () => setOpenMenuKey(null);
    document.addEventListener("keydown", close);
    window.addEventListener("adoms-role-change", closeForRoleChange);
    return () => {
      document.removeEventListener("keydown", close);
      window.removeEventListener("adoms-role-change", closeForRoleChange);
    };
  }, []);
  return (
    <nav className="us-gnb" onMouseLeave={() => setOpenMenuKey(null)}>
      {/* 좌측 공용 메뉴의 권한 없는·숨긴 링크를 가린다(lib/menu.ts sideHideCss) */}
      {css && <style>{css}</style>}
      {groups.map((g) => {
        const key = g.key || g.label;
        return (
        <div key={key} className={`us-gnb-g${g === cur ? " on" : ""}${openMenuKey === key ? " open" : ""}`}
          onMouseEnter={() => setOpenMenuKey(key)}
          onFocusCapture={() => setOpenMenuKey(key)}
          onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpenMenuKey(null); }}>
          <button type="button" className="us-gnb-h" aria-expanded={openMenuKey === key}
            onClick={() => setOpenMenuKey(key)}>
            {displayGnbLabel(g.key || g.label)}
          </button>
          {openMenuKey === key && <div className="us-gnb-m">
            {g.items.map((m, i) => m.heading
              ? <div key={"h" + i} className="us-gnb-sub">{m.label}</div>
              : <Link key={m.href} href={withAdomsRole(m.href, role)} className={m.href === best(g.items) ? "on" : ""} onClick={() => setOpenMenuKey(null)}><SubLabel text={m.label} /></Link>)}
          </div>}
        </div>
      )})}
    </nav>
  );
  /** 한 묶음에서 켜질 항목은 하나 — 여럿이 맞으면(/ceo 와 /ceo/letter) 주소가 가장 긴 것. */
  function best(items: MenuItem[]) {
    return items.filter((m) => m.href && isOn(path, m.href, search)).sort((x, y) => y.href.length - x.href.length)[0]?.href;
  }
}

/** Figma에 확정된 상단 제목만 표시용으로 적용한다. 메뉴 설정의 영속 key는 기존 label로 유지한다. */
function displayGnbLabel(label: string) {
  const normalized = label.replace(/\n/g, "");
  const fixed: Record<string, string> = {
    "의무이행(실적증빙)": "의무이행·증빙",
    "이행점검및 조치": "이행점검·조치",
    "기관장예방활동": "기관장 예방활동",
    "통계 및 사례": "통계·사례",
  };
  return fixed[normalized] || normalized;
}

/**
 * 「bar」 모양(09-24 참고 그림) — 짙은 남색 대메뉴 줄 · (소제목이 있으면) 구분 줄 · 파란 하위 줄.
 * 하위 줄은 켜진 대메뉴 글자 밑에서 시작한다(오른쪽 끝을 넘으면 넘지 않는 만큼 당긴다).
 */
function Bar({ path, search, show, role }: { path: string; search: string; show: (m: MenuItem) => boolean; role: string }) {
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter(show) })).filter((g) => g.items.some((m) => m.href));
  const cur = groups.find((g) => groupHas(g.items, path, search));
  // 소제목으로 나눈 칸
  const secs: { head: string; items: MenuItem[] }[] = [];
  (cur?.items || []).forEach((m) => {
    if (m.heading) secs.push({ head: m.label, items: [] });
    else { if (!secs.length) secs.push({ head: "", items: [] }); secs[secs.length - 1].items.push(m); }
  });
  const hasHead = secs.some((x) => x.head);
  const onSec = secs.find((x) => x.items.some((m) => isOn(path, m.href, search))) || secs[0];
  const topRef = useRef<HTMLAnchorElement | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [off, setOff] = useState(0);
  useLayoutEffect(() => {
    const a = topRef.current, row = rowRef.current;
    if (!a || !row) { setOff(0); return; }
    const inner = row.parentElement as HTMLElement;
    const room = inner.clientWidth - row.scrollWidth;
    setOff(Math.max(0, Math.min(a.offsetLeft - (row.offsetLeft - off), room)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, search, cur?.label]);
  return (
    <nav className="nb">
      <div className="nb-top"><div className="nb-in">
        {groups.map((g) => {
          const on = g === cur;
          return <Link key={g.label} ref={on ? topRef : undefined} href={withAdomsRole((g.items.find((m) => m.href) as MenuItem).href, role)}
            className={on ? "on" : ""}>{g.label}</Link>;
        })}
      </div></div>
      {cur && hasHead && (
        <div className="nb-sec"><div className="nb-in"><div className="nb-row" style={{ marginLeft: off }}>
          {secs.map((x) => <Link key={x.head} href={withAdomsRole(x.items[0]?.href || "#", role)} className={x === onSec ? "on" : ""}>{x.head}</Link>)}
        </div></div></div>
      )}
      {cur && (
        <div className="nb-sub"><div className="nb-in"><div className="nb-row" ref={rowRef} style={{ marginLeft: off }}>
          {(onSec?.items || []).map((m) => <Link key={m.href} href={withAdomsRole(m.href, role)} className={isOn(path, m.href, search) ? "on" : ""}><SubLabel text={m.label} /></Link>)}
        </div></div></div>
      )}
    </nav>
  );
}

export default function NavMenu({ demo }: { demo: boolean }) {
  return <Suspense fallback={<nav className={MENU_MODE === "us" ? "us-gnb" : MENU_MODE === "bar" ? "nb" : "gnb gnb2"} />}><Inner demo={demo} /></Suspense>;
}
