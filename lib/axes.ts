/**
 * 확보의무 대분류 축 — 중대재해처벌법 **법 제4조제1항 각 호** + 제5조(도급).
 *
 * ★ 2026-09-21 정정 — 여기에 처음 적었던 이름들(「목표·경영방침·조직·예산」,
 *   「유해·위험요인 확인·개선」, 「재해 대비 매뉴얼」)은 **시행령 제4조 각 호**였다.
 *   법 제4조제1항 각 호와 섞어 쓴 것이다. 화면에 「제1호 …」로 적혀 있었으므로 틀린 표시였다.
 *   준거는 데모 DB 의 `ops_v0.2_add.sql` 이고, 그 원천은 의무조항 36 표준 명칭 v2.1 이다.
 *   이 표와 SQL 의 `duty_class.sapa_clause` 가 **같은 값을 내야 한다**(어긋나면 SQL 이 맞다).
 *
 * 법 제4조제1항
 *   1. 재해예방에 필요한 인력·예산 등 안전보건관리체계의 구축 및 그 이행에 관한 조치
 *   2. 재해 발생 시 재발방지 대책의 수립 및 그 이행에 관한 조치
 *   3. 중앙행정기관·지방자치단체가 관계 법령에 따라 개선·시정 등을 명한 사항의 이행에 관한 조치
 *   4. 안전·보건 관계 법령에 따른 의무이행에 필요한 관리상의 조치
 * 제5조 — 도급·용역·위탁을 준 경우에도 실질적으로 지배·운영·관리하면 제4조의 의무를 진다.
 */
export const SECURE_AXES = [
  "제1호 안전보건관리체계의 구축 및 이행",
  "제2호 재해 재발방지 대책 수립 및 이행",
  "제3호 개선·시정 등을 명한 사항의 이행",
  "제4호 안전·보건 관계 법령에 따른 의무이행 관리상의 조치",
  "제5조 도급·용역·위탁",
] as const;

/** 의무조항 36 → 확보의무. `ops_v0.2_add.sql` §5 의 case 문과 같은 값이어야 한다. */
const MAP: Record<string, number> = {
  I01: 0, I02: 0, I03: 0, I04: 0, I05: 0, I06: 0, I07: 0, I08: 0, I09: 0,
  F01: 0, F02: 0, F03: 0, F04: 0, F05: 0, F06: 0, F07: 0, F08: 0,
  M01: 0, M02: 0, M03: 0, M04: 0, M05: 0,
  I10: 1, F09: 1, M06: 1,
  I11: 2, F10: 2, M07: 2,
  I12: 3, I13: 3, F11: 3, F12: 3, M08: 3, M09: 3,
  I14: 4, F13: 4,
};

/**
 * 의무조항 코드 → 확보의무 대분류.
 * code36 에 「F01;F03」처럼 쌍반점으로 둘이 든 행이 4건 있다 — 앞의 것으로 본다.
 * 아는 코드가 없으면 **넘겨짚지 않고** null 을 낸다(예전에는 조용히 제4호로 보냈다).
 */
export function secureAxisOf(code36?: string): string | null {
  const first = (code36 || "").split(";")[0].trim();
  const i = MAP[first];
  return i === undefined ? null : SECURE_AXES[i];
}

/** 분류되지 않은 것까지 한 칸에 담아야 할 때(표·그래프의 마지막 줄). */
export const UNSET_AXIS = "분류 전";
export function secureAxisOrUnset(code36?: string): string {
  return secureAxisOf(code36) ?? UNSET_AXIS;
}

/** 「제1호」처럼 호 번호만. 3축 선택 화면이 묶음 제목으로 쓴다. */
export const CLAUSE_NO = ["제1호", "제2호", "제3호", "제4호", "제5조"] as const;

/** 호 번호 → 이름(번호를 뺀 부분). SECURE_AXES 와 같은 값이어야 한다. */
export function clauseName(no: string): string {
  const i = CLAUSE_NO.indexOf(no as any);
  return i < 0 ? "" : SECURE_AXES[i].replace(/^제\d호 |^제5조 /, "");
}

/** 의무조항 36 → 호 번호. `secureAxisOf` 와 같은 표를 쓴다. */
export function clauseNoOf(code36?: string): string {
  const ax = secureAxisOf(code36);
  const i = ax ? SECURE_AXES.indexOf(ax as any) : -1;
  return i < 0 ? "" : CLAUSE_NO[i];
}

export const AREA_NAME: Record<string, string> = {
  I: "중대산업재해",
  F: "중대시민재해(공중이용시설·공중교통수단)",
  M: "중대시민재해(원료·제조물)",
};

/**
 * 이행률 등급 — 화면마다 다르면 같은 숫자가 다른 색으로 보인다.
 * 임계는 여기 한 곳에만 둔다(09-21 정정: /inspections 가 80/50 으로 따로 놀았다).
 */
export const GRADE = [
  { min: 90, tone: "ok", label: "양호" },
  { min: 70, tone: "", label: "보통" },
  { min: 40, tone: "warn", label: "주의" },
  { min: 0, tone: "bad", label: "위험" },
] as const;

export function gradeOf(pct: number) {
  return GRADE.find((g) => pct >= g.min) || GRADE[GRADE.length - 1];
}
