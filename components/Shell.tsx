import Link from "next/link";
import RoleSwitch from "./RoleSwitch";
import ModeSwitch from "./ModeSwitch";
import { isDemoMode } from "@/lib/mode";
import NavMenu from "./NavMenu";
import PolicyTicker from "./us/PolicyTicker";
import { MENU_MODE } from "@/lib/menu";
import UserBox, { type Who } from "./UserBox";
import { staff, depts } from "@/lib/data";
import { Suspense } from "react";
import RecentBar from "./us/RecentBar";
import { ROLE_STAFF, ROLE_LABEL } from "@/lib/roles";
import { MenuProvider } from "./MenuCtx";
import { menusForAllRoles } from "@/lib/menu_store";

// 메뉴 목록·모드는 lib/menu.ts 한 곳(평면 ↔ 2계층).

export default async function Shell({ children }: { children: React.ReactNode }) {
  const demo = await isDemoMode();
  // 로그인 사용자 표시용 — 역할별 소속·이름(직원 명부에서)
  const [st, dl] = await Promise.all([staff(), depts()]);
  const dn = new Map(dl.map((d: any) => [d.dept_id, d.dept_name]));
  const who: Record<string, Who> = {};
  for (const [role, sid] of Object.entries(ROLE_STAFF)) {
    const p = st.find((x: any) => x.staff_id === sid);
    const full = String(p?.display_name || ROLE_LABEL[role] || "");
    const m = full.match(/^(.+?)\s+(\S+)$/);           // 「김민준 주무관」 → 이름 · 직급
    who[role] = role === "ceo"
      ? { dept: "용인특례시", name: "시장", duty: "경영책임자" }
      : { dept: String(dn.get(p?.dept_id) || ""), name: m ? m[1] : full, duty: m ? m[2] : "" };
  }
  // 09-25 사용자: 권한 제어 · 메뉴 관리 — 역할마다의 메뉴(정의 + 메뉴 관리 설정 + 권한)를 한 번 만들어 싣는다(components/MenuCtx)
  const { menus, css } = await menusForAllRoles();
  if (MENU_MODE === "us") {
    // [400 · 교육자료 버전] 참고 명세 공통 셸(00 §5): 경영목표 띠 · 로고 상자 + GNB 8 + 사용자 · 본문 · 주소 푸터
    return (
      <MenuProvider menus={menus} css={css}>
      <div className="us-app">
        <div className="us-banner">
          {/* 용인시청 누리집 「용인시 안전보건 목표」(비전·목표) · 「용인시 안전보건 경영방침」(2025년 1월) 원문에서 */}
          <div className="us-banner-l"><b>경영목표</b><span>생명과 안전을 최우선으로 하는 용인특례시 · 중대재해 ZERO화</span></div>
          <div className="us-banner-user" aria-label="사용자 및 역할 선택"><span className="us-banner-product">ADOMS</span><UserBox who={who} /></div>
          <div className="us-banner-r"><b>경영방침</b><PolicyTicker /></div>
        </div>
        <header className="us-header">
          <Link href="/" className="us-logo">
            <img src="/yongin_logo_header.png" alt="용인특례시" className="us-logo-img" />
          </Link>
          <NavMenu demo={demo} />
          {!demo && <div className="us-user">
            <div className="us-user-tools">
              <ModeSwitch />
            </div>
          </div>}
        </header>
        {/* 09-24 사용자: 방금 본 화면 기록(작은 둥근 네모 · ✕ 로 지움) + 이전 화면 */}
        <Suspense fallback={<div className="usr-bar usr-empty" />}><RecentBar /></Suspense>
        <main className="us-page">{children}</main>
        <footer className="us-foot">
          <span>용인특례시청 : (우 17019) 경기도 용인시 처인구 중부대로 1199 / 전화번호 : 031-324-2114</span>
          <span>Copyright ⓒ YONGIN SPECIAL CITY ALL RIGHTS RESERVED.</span>
        </footer>
      </div>
      </MenuProvider>
    );
  }
  const bar = MENU_MODE === "bar";   // 09-24 참고 그림 모양 — 흰 머리(로고·이용자) 밑에 메뉴 줄을 따로 둔다
  return (
    <MenuProvider menus={menus} css={css}>
    <div className={bar ? "th-bar" : undefined}>
      <div className="topband">
        경영목표 <b>시민이 안심하는 안전도시 용인</b> &nbsp;│&nbsp; 경영방침 1. 안전 최우선 2. 현장 중심 3. 예방 투자
      </div>
      <header className="header">
        {/* [캡처 v2] 로고 — ADOMS 아래 한 줄, 두 줄의 양 끝을 맞춘다(09-23 사용자 지시 · 문구도 사용자 지정) */}
        <div className="logo">
          <b className="logo-main">ADOMS</b><span>용인특례시 중처법 의무이행관리시스템</span>
        </div>
        {!bar && <NavMenu demo={demo} />}
        <div className="userbox">
          {/* 현장 모드에서는 보기·역할 전환을 감춘다 — 고객에게 보일 것이 아니다.
              글자 크기 바꾸기는 뺐다(09-24 사용자 — 화면이 커져 필요 없어짐, 부품 FontSwitch.tsx 는 남겨 둠).
              되돌아가는 길은 「설정」 화면에 둔다. */}
          {!demo && <ModeSwitch />}
          <UserBox who={who} />
          {!demo && <RoleSwitch />}
        </div>
      </header>
      {bar && <NavMenu demo={demo} />}
      <main className="page">{children}</main>
      <footer className="foot">
        {/* [매뉴얼 캡처용] 미완성·시연 고지 대신 중립 문구 */}
        ADOMS · 용인특례시 중대재해처벌법 의무이행관리시스템
      </footer>
    </div>
    </MenuProvider>
  );
}
