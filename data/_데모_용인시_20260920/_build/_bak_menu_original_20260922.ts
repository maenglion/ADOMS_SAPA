/**
 * 머리 메뉴 — 평면(한 줄) / 2계층(묶음 + 펼침) 둘 다 여기 한 곳에서 정한다(2026-09-22).
 * 설계서용 화면 캡처 동안 2계층으로 묶어 두었다가, 끝나면 MENU_MODE 를 "flat" 으로 바꾸면 원래대로 돌아온다.
 * 흐름 순 재배치(개발 마무리 때)도 이 파일만 고친다.
 */
export const MENU_MODE: "flat" | "group" = "group";

export type MenuItem = { href: string; label: string; hideInDemo?: boolean };

/** 평면 메뉴(지금까지 쓰던 순서 그대로). */
export const FLAT: MenuItem[] = [
  { href: "/", label: "대시보드" },
  { href: "/system", label: "체계 수립" },
  { href: "/duties", label: "의무 이행사항" },
  { href: "/targets", label: "관리대상 현황" },
  { href: "/tasks", label: "내 업무" },
  { href: "/evidence", label: "증빙·결재" },
  { href: "/status", label: "이행 현황표" },
  { href: "/risk", label: "위험성평가" },
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

/** 2계층 — 흐름(①~⑧)과 중처법 의무 묶음에 맞춘다. 묶음 이름을 누르면 첫 화면으로 간다. */
export const GROUPS: { label: string; items: MenuItem[] }[] = [
  { label: "대시보드", items: [
    { href: "/", label: "대시보드" },
    { href: "/tasks", label: "내 업무" },            // 담당자가 가장 자주 여는 화면 — 점검·이행에도 있다
    { href: "/ceo", label: "기관장 예방활동" },
    { href: "/calendar", label: "연간 일정" },
  ] },
  { label: "체계 수립", items: [
    { href: "/system", label: "안전보건관리체계" },
    { href: "/budget", label: "안전 예산" },
    { href: "/training", label: "교육 점검" },
  ] },
  { label: "의무 파악", items: [
    { href: "/duties", label: "의무 이행사항" },
    { href: "/targets", label: "관리대상 현황" },
  ] },
  { label: "점검·이행", items: [
    { href: "/inspections", label: "점검 회차" },
    { href: "/tasks", label: "내 업무" },
    { href: "/evidence", label: "증빙·결재" },
    { href: "/review", label: "점검 판정" },
    { href: "/actions", label: "조치·재점검" },
    { href: "/status", label: "이행 현황표" },
  ] },
  { label: "위험·재해", items: [
    { href: "/risk", label: "위험성평가" },
    { href: "/hazards", label: "위험요인 신고" },
    { href: "/drills", label: "대피훈련" },
    { href: "/recurrence", label: "재발방지·개선명령" },
  ] },
  { label: "도급·용역·위탁", items: [
    { href: "/contracts", label: "도급·용역·위탁" },
  ] },
  { label: "보고서", items: [
    { href: "/report", label: "보고서" },
  ] },
  { label: "도구", items: [
    { href: "/qr", label: "휴대폰 QR" },
    { href: "/scenario", label: "진행 대본", hideInDemo: true },
    { href: "/settings", label: "설정" },
  ] },
];

/** 지금 주소가 이 메뉴 항목에 속하는가(하위 경로 포함). */
export const isOn = (path: string, href: string) =>
  href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
