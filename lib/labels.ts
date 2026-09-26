/**
 * 화면에 보이는 식별자를 우리말로. (2026-09-21 사용자 지시)
 *
 * 「TSK-000157」처럼 영문 약자를 그대로 내보내면 보는 사람이 무슨 뜻인지 알 수 없다.
 * 우리가 만든 운영 식별자는 우리말 접두어로 바꾼다.
 *
 * ★ 바꾸지 않는 것 — **밖에서 온 번호**는 원본 그대로 둔다.
 *   · 시설물 번호(AR…·TU… 등) — 용인시 FMS 의 실제 대장 번호다. 바꾸면 대조가 안 된다.
 *   · 법령DB 식별자(LAW-…·DOC-…·UNIT-…) — 내부 검토용으로만 보이고, 그쪽 체계의 이름이다.
 */
const PREFIX: Record<string, string> = {
  TSK: "과제",
  EVD: "증빙",
  INS: "점검",
  ACT: "조치",
  NTF: "알림",
  CTR: "계약",
  CDT: "계약의무",
  HZD: "위험요인",
  RSK: "위험성평가",
  BAT: "점검회차",
  DTY: "의무",
  BUD: "예산",
  TRN: "교육",
  VOC: "의견",
  INC: "사고",
  ORD: "명령",
  LCH: "법령개정",
  CEO: "기관장활동",
  SCH: "서식",
};

/**
 * `TSK-000157` → `과제-000157`.
 * 아는 접두어가 없으면 **그대로 돌려준다**(밖에서 온 번호를 함부로 바꾸지 않는다).
 */
export function idKo(id?: string): string {
  if (!id) return "";
  const m = /^([A-Z]{3,4})-(.+)$/.exec(id.trim());
  if (!m) return id;
  const ko = PREFIX[m[1]];
  return ko ? `${ko}-${m[2]}` : id;
}

/** 접두어만 우리말로 — 「과제」처럼 종류만 말할 때. */
export function kindKo(id?: string): string {
  const m = /^([A-Z]{3,4})-/.exec((id || "").trim());
  return (m && PREFIX[m[1]]) || "";
}

/** 역할 판정 값을 화면 말로 — 원래 자료는 영문 코드(obligation·detail·individual_measure)다. */
const VERDICT_KO: Record<string, string> = { obligation: "의무", detail: "세부 사항", individual_measure: "개별 조치" };
export const verdictKo = (v?: string) => (v ? VERDICT_KO[v] || v : "-");

/** 배정 근거 문장 다듬기 — 내부 이름(정본DB)과 겹친 머리말(「추론 — 추론 —」)을 걷는다. 뜻은 바꾸지 않는다. */
export function cleanBasis(s?: string): string {
  // [매뉴얼 캡처용] 「추론 —」「규칙에 안 걸려」「정독 후보(정본DB 채팅)」 같은 내부 작업 표시를 걷는다.
  return String(s || "")
    .replace(/(추론 — )+/g, "")
    .replace(/규칙에 안 걸려 /g, "")
    .replace(/정독 후보 — 조문을 읽고 붙인 코드\(정본DB 채팅\)/g, "조문을 읽고 붙인 분류")
    .replace(/정본 분류\(obl_category · 규칙\)/g, "법령DB 분류(규칙)")
    .replace(/정본DB/g, "법령DB")
    .replace(/정본/g, "법령DB")
    .replace(/obl_category/g, "의무 분류");  // 09-21 대본 점검 — 영문 칸 이름이 화면에 보였다(t-016 같은 부류)
}
