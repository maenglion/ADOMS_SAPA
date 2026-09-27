/**
 * 머리 메뉴 — 평면(한 줄) / 2계층(묶음 + 펼침) 둘 다 여기 한 곳에서 정한다(2026-09-22).
 * 설계서용 화면 캡처 동안 2계층으로 묶어 두었다가, 끝나면 MENU_MODE 를 "flat" 으로 바꾸면 원래대로 돌아온다.
 * 흐름 순 재배치(개발 마무리 때)도 이 파일만 고친다.
 */
// 09-24: 「bar」 = 참고 그림 모양(짙은 남색 대메뉴 줄 + 파란 하위 줄 + 흰 머리 · 상태 배지 새 색).
//        마음에 안 들면 "group" 으로 바꾸면 전과 똑같은 모양·색으로 돌아온다(이 한 줄).
// [400 · 교육자료 버전] "us" = 참고 명세 GNB 8개(연녹색). v2 로 돌아가려면 v2 앱(3300)을 쓴다.
export const MENU_MODE: "flat" | "group" | "bar" | "us" = "us";
// 09-25 사용자: 권한 제어 — 역할별 메뉴는 아래 usGroupsFor()(규칙 = lib/perm.ts)
import { canAccess, deniedPrefixes, PERM_ENFORCE } from "./perm";

export type MenuItem = { href: string; label: string; hideInDemo?: boolean; alias?: boolean; heading?: boolean };  // alias = 다른 묶음에도 있는 바로가기(밑줄 기준 아님)

/** 평면 메뉴(지금까지 쓰던 순서 그대로). */
export const FLAT: MenuItem[] = [
  { href: "/", label: "대시보드" },
  { href: "/system", label: "체계 수립" },
  { href: "/duties", label: "의무 이행사항" },
  { href: "/targets", label: "관리대상 현황" },
  { href: "/tasks", label: "내 업무" },
  { href: "/evidence", label: "증빙·결재" },
  { href: "/status", label: "이행 현황표" },
  { href: "/hazards", label: "위험요인 신고" },
  { href: "/drills", label: "대피훈련" },
  { href: "/calendar", label: "연간 일정" },
  { href: "/inspections", label: "점검 회차" },
  { href: "/review", label: "점검 판정" },
  { href: "/actions", label: "조치·재점검" },
  { href: "/recurrence", label: "재발방지·명령" },
  { href: "/contracts", label: "도급·용역·위탁" },
  { href: "/budget", label: "안전 예산" },
  { href: "/training", label: "교육 점검" },
  { href: "/ceo", label: "기관장 예방활동" },
  { href: "/report", label: "보고서" },
  { href: "/qr", label: "휴대폰 QR" },
  { href: "/scenario", label: "진행 대본", hideInDemo: true },
  { href: "/settings", label: "설정" },
];

/** 2계층 — 흐름(①~⑧)과 중처법 의무 묶음에 맞춘다. 묶음 이름을 누르면 첫 화면으로 간다.
 *  heading = 펼침 안의 소제목(누르지 않음). 「bar」 모양에서는 소제목이 가운데 줄(구분 줄)이 된다.
 *  09-24 사용자 지시: ① 맨 위 「이행현황」 ↔ 하위 「대시보드」 이름 자리바꿈 ② 「관리대상 현황」 → 설정 밑(수정도 거기서)
 *  ③ 같은 날 최종: 「관리대상 현황」(도급·용역·위탁 현황 포함)·「법 의무사항」은 참고 명세의 원래 자리(대시보드 다음)로. 대시보드는 가볍게. 옛 정의는 04_앱\_백업_메뉴_20260924_menu.ts */
export const GROUPS: { label: string; items: MenuItem[] }[] = [
  { label: "대시보드", items: [                     // 대시보드는 가볍게 — 현황만(09-24 사용자)
    { href: "/", label: "이행현황" },
    { href: "/calendar", label: "연간 일정" },
  ] },
  // 09-24 사용자: 참고 명세의 대메뉴 자리 그대로(대시보드 다음) — 설정으로 옮겼다가 되돌림. 도급·용역·위탁 현황도 제자리.
  { label: "관리대상 현황", items: [
    { href: "/targets", label: "관리대상(시설물·설비)" },
    { href: "/contracts", label: "도급·용역·위탁 현황" },
  ] },
  { label: "법 의무사항", items: [
    { href: "/duties?axis=code", label: "중처법 의무조항별" },
    { href: "/duties?axis=target", label: "관리대상별" },
    { href: "/duties?axis=law", label: "관계법령별" },
    { href: "/duties/tree", label: "법령 계층표" },
    { href: "/duties/list", label: "의무 목록" },
  ] },
  { label: "의무이행", items: [
    { href: "", label: "안전보건관리체계 구축·이행", heading: true },
    { href: "/system", label: "중대산업재해" },
    { href: "/system?area=F", label: "중대시민재해(공중이용시설·공중교통수단)" },
    { href: "/system?area=M", label: "중대시민재해(원료·제조물)" },
    { href: "", label: "분야별 이행", heading: true },
    { href: "/budget", label: "안전·보건 예산" },
    { href: "/training", label: "안전·보건 교육 이수" },
    { href: "/drills", label: "비상 대피훈련" },
  ] },
  { label: "이행점검 및 조치", items: [
    { href: "", label: "이행점검", heading: true },
    { href: "/inspections", label: "점검 회차" },
    { href: "/review", label: "점검 판정" },
    { href: "/actions", label: "조치·재점검" },
    { href: "/inspections?view=approve", label: "회차 결재" },
    { href: "", label: "개선 및 조치", heading: true },
    { href: "/hazards", label: "유해·위험요인 점검·개선" },
    { href: "/recurrence", label: "재발방지·개선·시정명령" },
  ] },
  { label: "내 업무", items: [                       // 담당자가 가장 자주 여는 화면 — 한 번에 누르는 대메뉴(09-22)
    { href: "/tasks", label: "처리 현황" },   // [캡처 v2] 대메뉴와 같은 이름이던 하위 항목(09-23 사용자 지시)
    { href: "/evidence", label: "증빙·결재" },
  ] },
  { label: "보고 및 통계", items: [
    { href: "/exec", label: "경영책임자 보고 요약" },
    { href: "/status", label: "이행 현황표" },
    { href: "/report", label: "보고서" },
  ] },
  // [캡처 v2] 「관리자」 → 「설정」(09-23). 관리대상 대장(보유 시설·설비)의 등록·수정은 설정에 둔다.
  { label: "설정", items: [
    { href: "", label: "기관", heading: true },
    { href: "/settings/org", label: "기관 정보" },
    { href: "/settings", label: "조직·담당자" },
    { href: "/settings/assets", label: "관리대상 등록·수정" },
    { href: "", label: "도구", heading: true },
    { href: "/qr", label: "휴대폰 QR" },
    { href: "/scenario", label: "진행 대본", hideInDemo: true },
  ] },
];

/** 지금 주소가 이 메뉴 항목에 속하는가(하위 경로 포함). */
export const isOn = (path: string, href: string, search = "") => {
  if (!href) return false;
  const [hp, hq] = href.split("?");
  if (hp === "/") return path === "/";
  if (hp === "/settings") return path === "/settings";   // 하위 화면(기관 정보·관리대상 관리)은 제 항목이 켜진다
  const pathOk = path === hp || path.startsWith(hp + "/");
  if (!pathOk) return false;
  if (!hq) return !search || !["area", "axis", "view"].some((k) => new URLSearchParams(search).get(k));
  const want = new URLSearchParams(hq), have = new URLSearchParams(search);
  return [...want.entries()].every(([k, v]) => have.get(k) === v);
};

/** 주소가 이 묶음에 속하는가 — 메뉴에 없는 하위 화면(의무 상세 · 관리대상 상세 · /duties 첫 화면)도 제 묶음을 켠다. */
export const groupHas = (items: MenuItem[], path: string, search = "") =>
  items.some((m) => !m.alias && isOn(path, m.href, search)) ||
  items.some((m) => { const hp = m.href.split("?")[0]; return !!hp && hp !== "/" && (path === hp || path.startsWith(hp + "/")); }) ||
  extraHas(items, path);

/**
 * 09-26 사용자: 메뉴 밖 화면 합치기 — 메뉴에 항목은 없지만 그 묶음 화면 안으로 들어간 화면(묶음 정의 이름 → 주소 머리).
 * 이 주소를 열면 머리 메뉴에서 그 묶음에 밑줄이 그어지고 「최근 본 화면」도 그 묶음으로 센다.
 */
export const EXTRA_PATHS: Record<string, string[]> = {
  "이행현황": [],   // 09-26 사용자: 「ADOMS는 점검을 실제로 하는 앱이 아니니 휴대폰 현장 등록 기능은 다 빼자」 (/m · /qr 은 처리 현황으로 넘어간다)
  "관리대상 현황": ["/risk", "/contracts", "/settings/assets"],
  "의무이행(실적증빙)": ["/system"],
  "이행점검및 조치": ["/inspections", "/review"],
  "기관장예방활동": ["/report"],
  "관리자": ["/settings"],
};
function extraHas(items: MenuItem[], path: string): boolean {
  const first = items.find((m) => m.href && !m.alias);
  const def = first && US_GROUPS.find((g) => g.items.some((x) => x.href === first.href));
  const extra = def ? EXTRA_PATHS[def.label.replace(/\n/g, "")] || [] : [];
  return extra.some((hp) => path === hp || path.startsWith(hp + "/"));
}

/**
 * [400 · 교육자료 버전] GNB 8개 — 참고 명세 SCR-002 메뉴 트리 · SCR-006 GNB 원문.
 * label 의 \n 은 GNB 에서 두 줄로 쓴다(원문 표기). 게시판은 GNB 에 없어(명세 00 §5) 관리자 밑 구분으로 둔다.
 */
export const US_GROUPS: { label: string; items: MenuItem[] }[] = [
  { label: "이행현황", items: [
    // 09-26 사용자: 「이행현황 메뉴의 묶음 표시가 없다 — 좌측 서브 메뉴와 구조가 같아야」 → 좌측(StatusSide)과 같은 소제목 4개 · 같은 항목
    { href: "", label: "메인", heading: true },
    { href: "/", label: "대시보드" },   // 09-26 사용자: 「메인(대시보드)」 → 「대시보드」
    // 09-26 사용자: 메뉴 밖 화면을 제안대로 올림 — 처리 현황 · 연간 일정
    { href: "/tasks", label: "처리 현황(내 할 일)" },
    { href: "/calendar", label: "연간 일정" },
    { href: "", label: "중대산업재해", heading: true },
    { href: "/status/industrial", label: "사업장" },
    { href: "", label: "중대시민재해", heading: true },
    { href: "/status/civil?t=fc", label: "공중이용시설·공중교통수단" },
    { href: "/status/civil?t=mt", label: "원료·제조물" },
    { href: "", label: "도급·용역·위탁", heading: true },
    { href: "/status/contract", label: "도급·용역·위탁" },
  ] },
  { label: "관리대상 현황", items: [
    { href: "", label: "기본정보", heading: true },
    { href: "/targets/basic?t=ws", label: "사업장" },
    { href: "/targets/basic?t=fc", label: "공중이용시설·공중교통수단" },
    { href: "/targets/basic?t=mt", label: "원료·제조물" },
    { href: "", label: "사업", heading: true },
    { href: "/targets/contract", label: "도급·용역·위탁 현황" },
  ] },
  { label: "법 의무사항", items: [
    { href: "", label: "대상별 의무사항", heading: true },
    { href: "/law/ws", label: "사업장" },
    { href: "/law/fc", label: "공중이용시설·공중교통수단" },
    { href: "/law/mt", label: "원료·제조물" },
    // 09-24: 우리 의무 목록(11,015건) 보기 — 교육자료 메뉴에는 없지만 빠지면 의무를 찾아볼 곳이 없다(사용자 「의무들 다 어디 갔어?」)
    { href: "", label: "의무 목록", heading: true },
    { href: "/duties?axis=code", label: "중처법 의무조항별" },
    { href: "/duties?axis=target", label: "관리대상별" },
    { href: "/duties?axis=law", label: "관계법령별" },
    { href: "/duties/tree", label: "법령 계층표" },
    { href: "/duties/list", label: "전체 의무 목록" },
    // 09-24: 매일 관계법령 개정 확인 → 우리 의무 반영(체크리스트 생성 작업 CoCo)
    { href: "", label: "법령 개정", heading: true },
    { href: "/law/changes", label: "법령 개정 현황" },
  ] },
  { label: "의무이행\n(실적증빙)", items: [
    { href: "", label: "대상별 이행", heading: true },
    { href: "/perform/ws", label: "사업장" },
    { href: "/perform/fc", label: "공중이용시설·공중교통수단" },
    { href: "/perform/mt", label: "원료·제조물" },
    // 09-26 사용자: 메뉴 밖 화면을 제안대로 올림 — 의무이행 단계가 불러다 쓰는 원장(예산·교육·대피훈련)과 증빙
    { href: "", label: "분야별 이행", heading: true },
    { href: "/budget", label: "안전·보건 예산" },
    { href: "/training", label: "안전·보건 교육 이수" },
    { href: "/drills", label: "비상 대피훈련" },
    { href: "", label: "증빙", heading: true },
    { href: "/evidence", label: "증빙 등록·결재" },
    { href: "/evidence?view=ledger", label: "증빙 대장" },
  ] },
  { label: "이행점검\n및 조치", items: [
    { href: "", label: "이행점검", heading: true },
    { href: "/check/ws", label: "사업장" },
    { href: "/check/fc", label: "공중이용시설·공중교통수단" },
    { href: "/check/mt", label: "원료·제조물" },
    { href: "", label: "개선 및 조치", heading: true },
    { href: "/hazards", label: "유해·위험요인 개선" },
    { href: "/recurrence", label: "개선·시정명령 등 조치" },
    { href: "/actions", label: "미이행 조치·재점검" },   // 09-26 사용자: 메뉴 밖 화면 올림
  ] },
  { label: "기관장\n예방활동", items: [
    { href: "/exec", label: "경영책임자 보고 요약" },   // 09-26 사용자: 메뉴 밖 화면 올림(한 장 보고서 /report 가 이 안으로)
    { href: "/ceo/letter", label: "기관장 서한문" },
    { href: "/ceo", label: "기관장 활동사항" },
  ] },
  { label: "통계 및 사례", items: [
    { href: "", label: "중대재해 통계", heading: true },
    { href: "/stats/occur", label: "중대재해 발생통계" },
    { href: "/stats/target", label: "중대재해 대상통계" },
    { href: "", label: "중대재해 사고사례", heading: true },
    { href: "/stats/cases", label: "중대재해 사고사례" },
    { href: "", label: "안전·보건 관계 법령", heading: true },
    { href: "/stats/laws?sec=i", label: "중대산업재해" },
    { href: "/stats/laws?sec=f", label: "중대시민재해" },   // 공중교통수단(sec=t) · 원료·제조물(sec=m)은 화면 안 라디오
  ] },
  // 09-25 사용자: 중대산업재해 · 중대시민재해를 소제목(구분자)으로 — 누르면 그 재해의 좌측 메뉴가 켜진 화면으로(좌측 AdminSide 와 같은 구성)
  { label: "관리자", items: [
    { href: "", label: "중대산업재해", heading: true },
    { href: "/admin/role?d=ind", label: "담당자 권한지정" },
    { href: "/admin/assign?d=ind", label: "담당자 관리대상 지정" },
    { href: "/admin/basic?d=ind", label: "사업장 기본정보 관리" },
    { href: "/admin/law?d=ind", label: "관계 법령 관리" },
    { href: "", label: "중대시민재해", heading: true },
    { href: "/admin/role?d=civ", label: "담당자 권한지정" },
    { href: "/admin/assign?d=civ", label: "담당자 관리대상 지정" },
    { href: "/admin/basic?d=civ", label: "기본정보 관리" },
    { href: "/admin/law?d=civ", label: "관계 법령 관리" },
    { href: "", label: "법령 개정 확인", heading: true },
    { href: "/admin/runs", label: "자동 확인 작업 기록" },
    // 09-26 사용자: 「부서역할과 결재선은 관리자 화면에 다시 두자」 — 옛 「설정 › 조직·담당자」 표
    { href: "", label: "조직", heading: true },
    { href: "/admin/org", label: "부서 역할·결재선" },
    // 09-26 사용자: 메뉴 밖 「설정」의 법정 서식 목록을 관리자 안으로
    { href: "", label: "서식", heading: true },
    { href: "/admin/forms", label: "법정 서식" },
    // 09-25 사용자: 「시스템 관리(메뉴, 코드)와 메일 발송은 포함하자」 — 총괄만(lib/perm.ts)
    { href: "", label: "시스템 관리", heading: true },
    { href: "/admin/system/menu", label: "메뉴 관리" },
    { href: "/admin/system/code", label: "코드 관리" },
    { href: "/admin/system/mail", label: "메일 설정" },
    { href: "", label: "게시판", heading: true },
    { href: "/board/notice", label: "공지사항" },
    { href: "/board/files", label: "자료실" },
  ] },
  // 09-24 사용자: 시연 참고 메뉴 — 시연 뒤 이 묶음과 app/demo-guide 를 함께 없앤다
  { label: "시연\n참고", items: [
    { href: "/demo-guide", label: "시연 시나리오" },
  ] },
];

/* ── 역할별 메뉴 · 메뉴 관리 설정 (09-25 사용자: 권한 제어 · 시스템 관리 › 메뉴 관리) ─────────────────
 * 정의 원천은 위 US_GROUPS 그대로 둔다. 화면에서 바꾼 것(이름 · 숨김 · 순서 · 역할별 노출)은 표 sys_menu 에 쌓이고
 * (lib/menu_store.ts), 여기 usGroupsFor() 가 「정의 + 설정 + 권한(lib/perm.ts)」을 겹쳐 역할마다의 메뉴를 만든다.
 * 머리 메뉴(NavMenu) · 관리자 좌측(app/admin/_side.tsx) · 좌측 숨김 글자(sideHideCss)가 모두 이 함수를 거친다.
 * 역할별 노출은 **더 숨기기만** 한다 — 권한표가 막은 메뉴를 여기서 켤 수는 없다(주소 차단과 어긋나지 않게).
 */
export type MenuGroup = { label: string; items: MenuItem[]; key?: string };   // key = 정의 이름(gKey) — 이름을 바꿔도 그대로
export type MenuItemSet = { label?: string; hide?: boolean; order?: number; off?: string[] };
export type MenuSettings = { groups?: Record<string, { label?: string; hide?: boolean; order?: number }>; items?: Record<string, MenuItemSet> };

/** 묶음 키 = 정의 이름(줄바꿈 뺌) · 항목 키 = 묶음|주소(소제목은 h:이름) — 이름을 바꿔도 키는 그대로다. */
export const gKey = (label: string) => label.replace(/\n/g, "");
export const iKey = (group: string, m: MenuItem) => `${gKey(group)}|${m.href || "h:" + m.label}`;
/** 시스템 관리 항목(과 그것이 든 관리자 묶음)은 숨길 수 없다 — 숨기면 메뉴 관리로 돌아올 길이 없어진다. */
export const isLocked = (href: string) => href.startsWith("/admin/system");
export const LOCKED_GROUP = "관리자";

/** 이 역할이 보는 머리 메뉴(묶음 · 항목). */
export function usGroupsFor(role: string, set: MenuSettings = {}): MenuGroup[] {
  const out: (MenuGroup & { order: number })[] = [];
  US_GROUPS.forEach((g, gi) => {
    const gs = set.groups?.[gKey(g.label)] || {};
    if (gs.hide && gKey(g.label) !== LOCKED_GROUP) return;
    let items = g.items
      .map((m, i) => ({ m, s: set.items?.[iKey(g.label, m)] || {}, i }))
      .filter(({ m, s }) => {
        if (isLocked(m.href)) return canAccess(role, m.href);
        if (s.hide) return false;
        if (PERM_ENFORCE && (s.off || []).includes(role)) return false;
        if (role !== "gm" && (m.href.startsWith("/duties") || m.href === "/law/changes")) return false;
        return m.heading || canAccess(role, m.href);
      })
      .sort((a, b) => (a.s.order ?? (a.i + 1) * 10) - (b.s.order ?? (b.i + 1) * 10) || a.i - b.i)
      .map(({ m, s }) => ({ ...m, label: s.label || m.label }));
    // 아래에 항목이 없는 소제목은 뺀다
    items = items.filter((m, i) => !m.heading || (i + 1 < items.length && !items[i + 1].heading));
    if (!items.some((m) => m.href)) return;
    // 관리자 묶음에 게시판만 남으면(경영책임자 · 사업장·부서) 묶음 이름을 「게시판」으로 — 명세 00 §5(메뉴구조도의 게시판 대메뉴)
    let label = gs.label || g.label;
    if (!gs.label && gKey(g.label) === "관리자" && items.every((m) => m.heading || m.href.startsWith("/board"))) {
      label = "게시판";
      items = items.filter((m) => !m.heading);
    }
    out.push({ label, items, key: gKey(g.label), order: gs.order ?? (gi + 1) * 10 });
  });
  return out.sort((a, b) => a.order - b.order).map(({ label, items, key }) => ({ label, items, key }));
}

/**
 * 좌측 메뉴 숨김 글자(CSS) — 공용 좌측 부품(MenuSide · GroupSide · 이행현황 좌측)은 이 파일을 역할 없이 읽어서,
 * 권한이 없는 링크와 숨긴 항목을 머리 메뉴(NavMenu)가 이 글자로 가린다. 부품이 usGroupsFor 를 쓰게 되면 필요 없다.
 */
export function sideHideCss(role: string, set: MenuSettings = {}): string {
  const esc = (s: string) => s.replace(/["\\]/g, (c) => "\\" + c);
  const sels: string[] = deniedPrefixes(role).map((p) => `.us-side a[href^="${esc(p)}"]`);
  for (const g of US_GROUPS) {
    for (const m of g.items) {
      if (!m.href || isLocked(m.href)) continue;
      const s = set.items?.[iKey(g.label, m)];
      if (s && (s.hide || (PERM_ENFORCE && (s.off || []).includes(role)))) sels.push(`.us-side a[href="${esc(m.href)}"]`);
    }
  }
  return sels.length ? `${sels.join(",")}{display:none !important}` : "";
}
