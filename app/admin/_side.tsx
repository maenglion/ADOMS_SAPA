/**
 * [400 · 교육자료 버전] 관리자 좌측 메뉴(명세 03 공통 전제 (A) — 중대재해 담당부서(관리자)).
 * 중대산업재해 / 중대시민재해 / 법령 개정 확인 / 시스템 관리 / 게시판 묶음, 활성 항목은 ◉ + 굵게.
 *
 * 09-25 사용자: 권한 제어 · 시스템 관리 — 좌측 구성을 머리 메뉴 「관리자」 묶음에서 그대로 꺼낸다
 *   (lib/menu.ts usGroupsFor = 정의 + 메뉴 관리 설정 + 권한). 그래서 머리 메뉴와 좌측이 늘 같고,
 *   권한이 없는 항목은 좌측에도 없다(경영책임자·사업장/부서 = 게시판만 · 관리자 = 권한지정·시스템 관리 없음).
 *   지금 역할은 미들웨어가 실어 준 헤더에서 읽는다(lib/perm_server.ts).
 * 09-26 사용자: 메뉴 밖 화면 합치기 — 「서식 › 법정 서식」(/admin/forms, page="forms") 판은 머리 메뉴 정의(lib/menu.ts)에서
 *   그대로 들어온다(법령 개정 확인 다음 · 시스템 관리 앞 — 머리 메뉴와 같은 순서). 여기서 따로 적지 않는다(두 곳에 적으면 어긋난다).
 */
import Link from "next/link";
import type { Dis } from "./_lib";
import { US_GROUPS, usGroupsFor, gKey, LOCKED_GROUP, type MenuItem } from "@/lib/menu";
import { menuSettings } from "@/lib/menu_store";
import { currentRole } from "@/lib/perm_server";
import SubLabel from "@/components/us/SubLabel";

/** 지금 화면의 주소(메뉴 항목 href 모양) */
function curHref(d: Dis | "ceo" | undefined, page: string) {
  if (page === "notice" || page === "files") return `/board/${page}`;
  if (d === "ind" || d === "civ") return `/admin/${page}?d=${d}`;
  return `/admin/${page}`;
}

export default async function AdminSide({ d, page }: { d?: Dis | "ceo"; page: string }) {
  const role = await currentRole();
  const set = await menuSettings();
  const g = usGroupsFor(role, set).find((x) => x.key === LOCKED_GROUP)
    || { label: gKey(US_GROUPS.find((x) => gKey(x.label) === LOCKED_GROUP)!.label), items: [] as MenuItem[] };
  const cur = curHref(d, page);

  // 소제목으로 나눈 칸(소제목이 없으면 묶음 이름 하나)
  const secs: { head: string; items: MenuItem[] }[] = [];
  for (const m of g.items) {
    if (m.heading) secs.push({ head: m.label, items: [] });
    else {
      if (!secs.length) secs.push({ head: g.label, items: [] });
      secs[secs.length - 1].items.push(m);
    }
  }
  return (
    <aside className="us-side">
      {/* 09-25 사용자: 경영책임자(활동기록)는 기관장 예방활동 메뉴와 중복이라 뺌 · 법령 개정 현황은 법 의무사항 메뉴 소속이라 뺌.
          묶음은 머리 메뉴 「관리자」와 같은 이름·순서 — 누르면 같은 좌측 메뉴를 둔 채 오른쪽 화면만 바뀐다 */}
      {secs.filter((s) => s.items.length).map((s, i) => (
        <div key={s.head + i} className="us-panel usb2-side">
          <div className="us-panel-h">{s.head}</div>
          {s.items.map((it) => {
            const on = it.href === cur;
            return (
              <Link key={it.href} href={it.href} className={on ? "on" : ""}>
                {on ? "◉ " : ""}<SubLabel text={it.label} />
              </Link>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
