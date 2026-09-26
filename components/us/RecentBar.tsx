"use client";
/**
 * 방문 기록 줄(09-24 사용자) — 방금 전에 본 화면들을 머리 메뉴 바로 밑에 작은 둥근 네모로 보인다.
 *  · 누르면 그 화면으로 · 오른쪽 위 ✕ 로 하나씩 지움 · 「이전 화면」은 브라우저 뒤로 가기
 *  · 상위 메뉴(묶음)마다 하나만 — 같은 묶음 안에서 세부 메뉴를 옮겨 다니면 마지막 화면만 남긴다(09-24 사용자)
 *    네모에는 상위 메뉴 이름, 마우스를 올리면 마지막으로 본 화면 제목
 *  · 기록은 이 브라우저에만 둔다(localStorage) — 저장이 막힌 창에서도 화면은 그대로 돈다
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { US_GROUPS, isOn, groupHas } from "@/lib/menu";

type Item = { href: string; title: string; group: string; at: number };
const KEY = "adoms400.recent";
const MAX = 12;
const DROP = ["ok", "err", "modal", "mode"];   // 알림·팝업용 일시 값은 주소에서 뺀다

const load = (): Item[] => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
const save = (v: Item[]) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* 저장 막힘 — 무시 */ } };
const flat = (s: string) => s.replace(/\n/g, "");

/** 상위 메뉴(묶음) 이름과 화면 제목 */
function nameOf(path: string, search: string): { group: string; title: string } {
  if (path === "/") return { group: "이행현황", title: "이행현황 › 대시보드" };
  const h1 = (document.querySelector(".us-main h1, main h1") as HTMLElement | null)?.innerText.replace(/\s+/g, " ").trim() || "";
  let group = "", item = "";
  for (const g of US_GROUPS) {
    const hit = g.items.find((m) => !m.heading && isOn(path, m.href, search));
    if (hit) { group = flat(g.label); item = flat(hit.label); break; }
  }
  if (!group) group = flat(US_GROUPS.find((x) => groupHas(x.items, path, search))?.label || "");
  const name = h1 || item || document.title;
  return { group: group || name, title: group ? `${group} › ${name}` : name };
}

export default function RecentBar() {
  const path = usePathname();
  const sp = useSearchParams();
  const [items, setItems] = useState<Item[]>([]);
  const [ready, setReady] = useState(false);

  const q = new URLSearchParams(sp.toString());
  DROP.forEach((k) => q.delete(k));
  const search = q.toString();
  const href = `${path}${search ? `?${search}` : ""}`;

  useEffect(() => {
    // 화면이 그려진 뒤 제목을 읽는다
    const t = setTimeout(() => {
      const { group, title } = nameOf(path, search);
      // 상위 메뉴마다 하나 — 같은 묶음의 앞 기록은 지우고 이번 화면으로 바꾼다
      const next = [{ href, title, group, at: Date.now() }, ...load().filter((x) => x.href !== href && (x.group || x.title) !== group)].slice(0, MAX);
      save(next);
      setItems(next);
      setReady(true);
    }, 150);
    return () => clearTimeout(t);
  }, [href]); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = (h: string) => { const next = items.filter((x) => x.href !== h); save(next); setItems(next); };
  const clearAll = () => { const next = items.filter((x) => x.href === href); save(next); setItems(next); };

  if (!ready) return <div className="usr-bar usr-empty" />;
  const curGroup = items[0]?.href === href ? items[0].group : "";
  const others = items.filter((x) => x.href !== href && (!curGroup || x.group !== curGroup));
  return (
    <nav className="usr-bar" aria-label="최근 본 화면">
      <button type="button" className="usr-back" onClick={() => history.back()} title="방금 전 화면으로">
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M8.5 3 4.5 7l4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        이전 화면
      </button>
      <span className="usr-lbl">최근 본 화면</span>
      <div className="usr-list">
        {others.length === 0 && <span className="usr-none">아직 없습니다</span>}
        {others.map((x) => (
          <span key={x.href} className="usr-chip">
            <Link href={x.href} title={x.title}>{x.group || x.title}</Link>
            <button type="button" className="usr-x" aria-label={`${x.title} 기록 지우기`} onClick={() => remove(x.href)}>
              <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d="M1 1l6 6M7 1 1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>
          </span>
        ))}
      </div>
      {others.length > 1 && <button type="button" className="usr-clear" onClick={clearAll}>모두 지우기</button>}
    </nav>
  );
}
