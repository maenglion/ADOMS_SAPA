/**
 * 원료·제조물 해당 여부 판단 — 행위 판정표 (2026-09-22)
 *
 * 화면(입력 칸의 「제안」)과 서버(저장 검사 · lib/system.ts materialStatus)가 **같은 규칙**을 쓰게 여기 한 곳에 둔다.
 * 이 파일은 계산만 한다(읽기·쓰기 없음) — 브라우저 쪽 입력 칸에서도 불러 쓴다.
 *
 * 근거
 *   법 제9조제1항 — 「…사업장에서 생산ㆍ제조ㆍ판매ㆍ유통 중인 원료나 제조물…」(DOC-000004 a9/p1)
 *   시행령 제8조제3호 — 「별표 5에서 정하는 원료 또는 제조물…」(DOC-000005 a8/n3) → 별표 5 = 제3·4호 추가 조치 대상
 *   환경부 해설서(2023.12) — 최종 사용자의 구입·사용은 제외(20·131쪽) · 공정 투입 원료는 포함(108·116쪽)
 *   · 병원 의약품 사례(131쪽)의 근거는 「별표 5 의약품 취급 + 관리상 결함」 — 「제3자 제공이면 해당」은 ADOMS 해석
 * 자동 제안은 「제안」일 뿐이다. 「해당」「비해당」은 사람이 사유를 적어 정한다.
 */

export const ACTS = [
  { key: "produce", label: "생산·제조·판매·유통", sub: "법 제9조제1항 문언" },
  { key: "process", label: "공정 투입", sub: "제품 구성성분이 아니어도 공정에 쓰는 원료 — 환경부 해설서 108·116쪽" },
  { key: "enduse", label: "최종 사용", sub: "사서 기관 안에서 쓰기만 함 — 환경부 해설서 20·131쪽" },
  { key: "provide", label: "제3자 제공·투여·배부", sub: "주민 등에게 무상 제공·투여·배부 — ADOMS 해석(확인 필요)" },
] as const;
export type ActKey = (typeof ACTS)[number]["key"];
export const ACT_LABEL: Record<string, string> = Object.fromEntries(ACTS.map((a) => [a.key, a.label]));

/** 별표 5 (시행령 제8조제3호 관련, 2025.8.5 개정) — 정본 원문 DOC-000005 b5 의 12개 호. */
export const BYEOLPYO5 = [
  { no: "1", label: "독성가스", law: "고압가스 안전관리법 제28조제2항제13호" },
  { no: "2", label: "농약·천연식물보호제·원제·농약활용기자재", law: "농약관리법 제2조제1호·제1호의2·제3호·제3호의2" },
  { no: "3", label: "마약류", law: "마약류 관리에 관한 법률 제2조제1호" },
  { no: "4", label: "보통비료·부산물비료", law: "비료관리법 제2조제2호·제3호" },
  { no: "5", label: "살생물물질·살생물제품", law: "생활화학제품 및 살생물제의 안전관리에 관한 법률 제3조제7호·제8호" },
  { no: "6", label: "식품·식품첨가물·기구·용기·포장", law: "식품위생법 제2조제1호·제2호·제4호·제5호" },
  { no: "7", label: "의약품·의약외품·동물용 의약품", law: "약사법 제2조제4호·제7호 · 제85조제1항" },
  { no: "8", label: "방사성물질", law: "원자력안전법 제2조제5호" },
  { no: "9", label: "의료기기", law: "의료기기법 제2조제1항" },
  { no: "10", label: "화약류", law: "총포ㆍ도검ㆍ화약류 등의 안전관리에 관한 법률 제2조제3항" },
  { no: "11", label: "허가·제한·금지물질 및 유해화학물질", law: "화학물질관리법 제2조제3호~제5호·제7호" },
  { no: "12", label: "그 밖에 관계 중앙행정기관의 장이 고시하는 것", law: "시행령 별표 5 제12호" },
] as const;
/** 별표 5 칸 값 — 호 번호(여럿이면 「;」) · 「N」(별표 5 아님) · 빈칸(확인 필요). */
export function b5State(v?: string): "yes" | "no" | "unk" {
  const s = String(v || "").trim();
  if (!s) return "unk";
  if (s === "N") return "no";
  return "yes";
}
export function b5Text(v?: string): string {
  const st = b5State(v);
  if (st === "unk") return "확인 필요";
  if (st === "no") return "별표 5 아님";
  return splitSemi(v).map((n) => `제${n}호 ${BYEOLPYO5.find((b) => b.no === n)?.label || ""}`.trim()).join(" · ");
}

export const VERDICTS = ["해당", "비해당", "확인 필요"] as const;
export type Verdict = (typeof VERDICTS)[number];

export const splitSemi = (s?: string) => String(s || "").split(";").map((x) => x.trim()).filter(Boolean);

export type Suggestion = { verdict: Verdict; tag: string; basis: string };

/**
 * 행위 → 제안. 여러 행위를 골랐으면 해당 쪽이 이긴다(생산·공정 투입 > 제3자 제공 > 최종 사용).
 * 제안은 판정이 아니다 — 화면은 「제안」 표시만 하고, 판정 칸은 사람이 고른다.
 */
export function suggest(acts: string[]): Suggestion {
  const has = (k: ActKey) => acts.includes(k);
  if (has("produce") || has("process")) {
    const basis = [has("produce") ? "법 제9조제1항 문언(생산·제조·판매·유통)" : "", has("process") ? "환경부 해설서 108·116쪽(공정 투입 원료)" : ""]
      .filter(Boolean).join(" · ");
    return { verdict: "해당", tag: "해당 후보", basis };
  }
  if (has("provide"))
    return { verdict: "확인 필요", tag: "확인 필요(해당 후보)", basis: "ADOMS 해석(확인 필요) — 해설서 131쪽은 「별표 5 의약품 취급 + 관리상 결함」을 근거로 들었고, 「제3자에게 제공하면 해당」이라는 문구는 없습니다" };
  if (has("enduse"))
    return { verdict: "비해당", tag: "비해당 후보", basis: "환경부 해설서 20·131쪽 — 최종 사용자의 구입·사용은 적용 대상이 아닙니다. 사유를 반드시 남깁니다" };
  return { verdict: "확인 필요", tag: "판단 자료 없음", basis: "행위를 하나 이상 고르면 제안이 나옵니다" };
}

/** 저장 검사 — 통과하면 빈 문자열, 아니면 사람이 읽을 이유. 화면과 서버가 같은 검사를 쓴다. */
export function checkInput(v: { name: string; dept: string; acts: string[]; verdict: string; reason: string; basis: string }): string {
  if (!v.name.trim()) return "품목 이름을 적습니다.";
  if (!v.dept) return "담당 부서를 고릅니다.";
  if (!VERDICTS.includes(v.verdict as Verdict)) return "판단을 고릅니다.";
  if (!v.reason.trim()) return v.acts.includes("enduse") ? "「최종 사용」을 골랐으면 사유를 반드시 적습니다(왜 빠지는지 답하는 근거)." : "사유를 적습니다 — 판단이 「확인 필요」여도 무엇을 더 봐야 하는지 적습니다.";
  if (v.verdict !== "확인 필요" && !v.basis.trim()) return "「해당」「비해당」으로 정하려면 근거(해설서 쪽 또는 「ADOMS 해석(확인 필요)」)를 적습니다.";
  if (v.verdict !== "확인 필요" && !v.acts.length) return "「해당」「비해당」으로 정하려면 행위를 하나 이상 고릅니다.";
  return "";
}
