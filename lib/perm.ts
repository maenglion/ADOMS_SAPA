/**
 * 권한 규칙 한 곳(09-25 사용자: 「권한 제어 — 역할별 메뉴 숨김과 접근 차단을 넣자. 한번 해보지, 뭐.」).
 *
 * 이 규칙을 쓰는 곳은 셋이다 — 여기만 고치면 셋이 함께 바뀐다.
 *   (a) 메뉴 숨김 — lib/menu.ts usGroupsFor()(머리 메뉴) · app/admin/_side.tsx(관리자 좌측) · 좌측 메뉴 숨김 글자(sideHideCss)
 *   (b) 주소로 들어오면 막기 — middleware.ts 가 안내 화면(/denied)으로 바꿔 보여 준다
 *   (c) 쓰기(서버 액션) 막기 — middleware.ts(POST) + 각 actions 의 guard()(lib/perm_server.ts)
 *
 * 기준표 = 화면설계서 SCR-003 권한 매트릭스(명세 01 · 00 §4-2 · images/003_사용자 권한 구분.png).
 *   사용자 유형 ↔ 우리 역할: 경영책임자 = ceo · 중대재해 담당부서(총괄) = gm · 사업소, 실/국 = mgr
 *                            · 사업장, 부서 = road · water · road_head · water_head
 *
 * 매트릭스 읽는 법 — 「빈칸」은 그 유형이 등록할 몫이 없다는 뜻이지 「못 본다」는 뜻이 아니다
 *   (기관장 예방활동 행은 네 칸이 모두 비어 있다 — 빈칸 = 차단으로 읽으면 아무도 못 본다).
 *   그래서 막는 것은 매트릭스가 **명시적으로 갈라 놓은 것**만이다:
 *     · 메인 행 — 「이행현황 확인 및 상세내용 조회」는 경영책임자·중대재해 담당부서·사업소, 실/국 / 사업장, 부서는 「메인(대시보드)」만
 *     · 시스템 관리자 행 — 「사용자 등록/권한 부여」는 중대재해 담당부서만
 *     · ① 담당자/관리대상 지정 — 중대재해 담당부서·사업소, 실/국
 *     · 관리자 메뉴 전체 — 총괄·관리자만(09-25 사용자 지시)
 *   관리대상 현황 · 법 의무사항 · 의무이행 · 이행점검 및 조치 · 기관장 예방활동 · 통계 및 사례 · 게시판은
 *   매트릭스가 보기를 가르지 않았으므로 **지금처럼 모두 보인다**(RULES 에 넣지 않음).
 *
 * ★ 이 파일은 미들웨어(엣지)와 브라우저 쪽 부품도 읽는다 — 파일·DB 를 읽는 코드를 넣지 않는다.
 */
import { ROLE_LABEL } from "./roles";

/** 되돌리기 스위치 — false 로 바꾸면 권한으로 숨기거나 막는 것이 모두 꺼진다(지금처럼 모두 보이고 모두 들어간다). */
export const PERM_ENFORCE = true;

export type Role = "ceo" | "gm" | "mgr" | "road" | "water" | "road_head" | "water_head";
export const ALL_ROLES: Role[] = ["ceo", "gm", "mgr", "road_head", "road", "water_head", "water"];
const ROLE_SET = new Set<string>(ALL_ROLES);
export const isRole = (v: any): v is Role => ROLE_SET.has(String(v || ""));
/** 알 수 없는 값은 총괄(gm) — 화면들이 쓰던 기본값(sp.role || "gm")과 같다. */
export const normRole = (v: any): Role => (isRole(v) ? v : "gm");

/** 화면설계서 사용자 유형(SCR-003 머리) */
export const USER_KIND: Record<Role, string> = {
  ceo: "경영책임자", gm: "중대재해 담당부서", mgr: "사업소, 실/국",
  road: "사업장, 부서", water: "사업장, 부서", road_head: "사업장, 부서", water_head: "사업장, 부서",
};

export type Rule = {
  prefix: string;     // 이 주소와 그 아래
  roles: Role[];      // 들어갈 수 있는 역할
  menu: string;       // 안내 화면에 쓰는 메뉴 이름
  basis: string;      // 근거(화면설계서 · 사용자 지시)
};

/** 막는 규칙 — 주소가 긴 것이 먼저(가장 길게 맞는 규칙 하나만 쓴다). */
export const RULES: Rule[] = [
  { prefix: "/law/changes", roles: ["gm"], menu: "법령 개정 현황",
    basis: "09-27 사용자 지시 — 법 의무사항의 법령 개정은 총괄만" },
  { prefix: "/duties", roles: ["gm"], menu: "의무 목록",
    basis: "09-27 사용자 지시 — 법 의무사항의 의무 목록은 총괄만" },
  { prefix: "/admin/system", roles: ["gm"], menu: "시스템 관리",
    basis: "SCR-003 시스템 관리자 — 중대재해 담당부서만" },
  { prefix: "/admin/role", roles: ["gm"], menu: "담당자 권한지정",
    basis: "SCR-003 시스템 관리자(사용자 등록/권한 부여) — 중대재해 담당부서만" },
  { prefix: "/admin", roles: ["gm", "mgr"], menu: "관리자",
    basis: "SCR-003 ① 담당자/관리대상 지정 — 중대재해 담당부서·사업소, 실/국 · 09-25 사용자 지시(관리자 메뉴는 총괄·관리자만)" },
  // 09-26 사용자: 「이행현황 상세를 부서장에게 열자」 — 부서장(road_head · water_head)도 들어간다. 실무자(road · water)는 메인(대시보드)만.
  { prefix: "/status", roles: ["ceo", "gm", "mgr", "road_head", "water_head"], menu: "이행현황(상세)",
    basis: "SCR-003 메인 행 — 이행현황 상세 조회는 경영책임자·중대재해 담당부서·사업소, 실/국 · 09-26 사용자 지시로 부서장도 · 실무자는 메인(대시보드)만" },
];

/** 이 주소에 걸리는 규칙(없으면 undefined = 모두 들어간다). */
export function ruleFor(path: string): Rule | undefined {
  const p = String(path || "/").split("?")[0];
  return RULES.filter((r) => p === r.prefix || p.startsWith(r.prefix + "/")).sort((a, b) => b.prefix.length - a.prefix.length)[0];
}

/** 이 역할이 이 주소(메뉴 href 도 된다)에 들어갈 수 있는가. */
export function canAccess(role: any, path: string): boolean {
  if (!PERM_ENFORCE) return true;
  const r = ruleFor(path);
  return !r || r.roles.includes(normRole(role));
}

/** 안내 화면 글자 — 「총괄(중대재해예방팀) · 관리자(안전점검팀)」 */
export const needText = (r: Rule) => r.roles.map((x) => ROLE_LABEL[x] || x).join(" · ");

/** 막히는 역할에게 숨길 주소 머리(좌측 메뉴 숨김 글자용) */
export function deniedPrefixes(role: any): string[] {
  if (!PERM_ENFORCE) return [];
  const me = normRole(role);
  return RULES.filter((r) => !r.roles.includes(me)).map((r) => r.prefix);
}

/** 권한 표(메뉴 × 역할) — 시스템 관리 화면과 보고에 그대로 쓴다. */
export const MATRIX_NOTE = "빈칸은 「등록할 몫이 없음」이지 「못 봄」이 아니다 — 매트릭스가 갈라 놓은 것만 막는다.";
