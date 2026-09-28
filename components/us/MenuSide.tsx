"use client";
/**
 * 머리 메뉴(lib/menu.ts US_GROUPS) 한 묶음을 그대로 좌측 메뉴로 그린다(09-25 사용자: 「왼쪽 서브메뉴를 하위 메뉴 구조와 동일하게」).
 *  · 소제목(heading) = 좌측 묶음 머리 · 그 아래 항목 = 링크 · 지금 화면은 ◉ + 굵게
 *  · 메뉴를 고치면 머리 메뉴와 좌측 메뉴가 함께 바뀐다(정의는 menu.ts 한 곳)
 *  · 묶음은 꺽쇠로 접었다 편다(공용 GroupSide — 의무이행 좌측과 같은 모양, 09-25)
 */
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { isOn, gKey, type MenuItem } from "@/lib/menu";
import { useMenuGroups, useRole } from "@/components/MenuCtx";
import GroupSide from "./GroupSide";

function Inner({ group }: { group: string }) {
  const path = usePathname();
  const search = useSearchParams().toString();
  const role = useRole();
  // 09-25 사용자(메뉴 관리): 역할별 메뉴(이름 바꾸기·숨김·순서 반영)에서 꺼낸다 — 묶음은 정의 이름(key)으로 찾는다
  const g = useMenuGroups().find((x) => (x.key || gKey(x.label)) === group);
  if (!g) return <aside className="us-side" />;
  const secs: { head: string; items: MenuItem[] }[] = [];
  for (const m of g.items) {
    if (m.heading) secs.push({ head: m.label, items: [] });
    else {
      if (!secs.length) secs.push({ head: group, items: [] });
      secs[secs.length - 1].items.push(m);
    }
  }
  // 09-26 사용자: 메뉴 밖 화면 합치기 — 메뉴에 없는 합친 화면(옛 점검 화면 등)은 주소의 tk(들어온 대상)로 그 대상 항목을 켠다
  const tk = new URLSearchParams(search).get("tk");
  const anyOn = g.items.some((m) => isOn(path, m.href, search));
  const on = (m: MenuItem) => isOn(path, m.href, search) || (!anyOn && !!tk && m.href.split("?")[0].endsWith("/" + tk));
  return (
    <GroupSide role={role} groups={secs.map((s) => ({ head: s.head, items: s.items.map((m) => ({ href: m.href, label: m.label, on: on(m) })) }))} />
  );
}

export default function MenuSide({ group }: { group: string }) {
  return <Suspense fallback={<aside className="us-side" />}><Inner group={group} /></Suspense>;
}
