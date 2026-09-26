/**
 * 공통 코드(09-25 사용자: 「시스템 관리(메뉴, 코드)는 포함하자」) — 시스템 관리 › 코드 관리.
 *
 * 기본값 = 명세 00 §6 공통 코드값 + 화면에서 이미 쓰는 값(재해유형 · 상해종류 · 근로형태 · 재해구분은 중대재해 발생 원장에 있는 값).
 * 화면에서 더하거나 고친 것은 표 sys_code 에 한 줄씩 쌓고 코드 번호별 가장 최근 줄을 읽는다(지우지 않음 · 「사용 중지」는 state=off).
 * 화면은 codeValues(묶음) 로 「사용 중」 값만 순서대로 받는다.
 *   지금 이 표를 읽는 화면: 관리자 › 사업장 기본정보 관리(업종 분류). 다른 화면은 아직 자기 목록을 쓴다(done_P 「요청」).
 */
import "server-only";
import { readTable } from "@/lib/data";
import { ACC_TYPES } from "@/lib/acc_types";

export type CodeSet = { id: string; label: string; basis: string; values: string[] };

export const CODE_SETS: CodeSet[] = [
  { id: "TARGET_TYPE", label: "대상 구분", basis: "화면설계서 공통 코드값", values: ["사업장", "공중이용시설·공중교통수단", "원료·제조물"] },
  { id: "COMPLIANCE_STATUS", label: "이행 상태", basis: "화면설계서 공통 코드값", values: ["이행완료", "보완필요", "미이행", "해당없음"] },
  { id: "RATE_GRADE", label: "이행률 등급", basis: "화면설계서 공통 코드값", values: ["우수", "보통", "미흡"] },
  { id: "HALF_YEAR", label: "반기", basis: "화면설계서 공통 코드값", values: ["상반기", "하반기"] },
  { id: "FACILITY_TYPE", label: "시설구분", basis: "화면설계서 공통 코드값", values: ["건축물", "상하수도", "옹벽", "하천", "터널", "교량", "절토사면", "기타"] },
  { id: "LAW_KIND", label: "법령구분", basis: "화면설계서 공통 코드값 · 통계 화면의 계층", values: ["법률", "시행령", "시행규칙", "고시·훈령·예규"] },
  { id: "EMPLOYMENT_TYPE", label: "고용형태", basis: "화면설계서 공통 코드값", values: ["공무원", "공무직", "촉탁직", "기간제", "공공안전관", "공공근로", "뉴딜일자리", "기타"] },
  { id: "MGMT_STATUS", label: "선임·지정 상태", basis: "화면설계서 공통 코드값", values: ["제정", "지정", "선임", "위촉"] },
  { id: "IND_CLASS", label: "업종 분류(사업장)", basis: "화면설계서 공통 코드값", values: ["공공행정", "서비스업", "하수처리업", "보건업"] },
  { id: "DISASTER_KIND", label: "재해구분", basis: "중대재해 발생통계 원장", values: ["부상", "질병"] },
  { id: "WORK_TYPE", label: "근로형태", basis: "중대재해 발생통계 원장", values: ["공무원", "공무직", "기간제", "공공근로", "공공안전관", "촉탁직", "뉴딜일자리", "기타"] },
  { id: "ACC_TYPE", label: "재해유형", basis: "중대재해 발생통계 원장", values: ACC_TYPES },   // 09-26 사용자: 재해유형 한 벌 — lib/acc_types.ts
  { id: "INJURY", label: "상해종류", basis: "중대재해 발생통계 원장", values: ["타박상", "골절", "열상", "염좌", "요통", "절단", "온열질환", "안구 손상", "화상", "파열", "기타"] },
];

export const CODE_TABLE = "sys_code";

export type Code = { code_id: string; set_id: string; value: string; sort: number; state: "on" | "off"; note: string; at: string; by: string; base: boolean };

/** 기본값 코드 번호 — 묶음-두 자리(예: HALF_YEAR-01). 화면에서 더한 것은 묶음-N시각. */
export const baseId = (set: string, i: number) => `${set}-${String(i + 1).padStart(2, "0")}`;

/** 한 묶음의 코드 전부(사용 중지 포함) — 순서대로 */
export async function codesOf(setId: string): Promise<Code[]> {
  const def = CODE_SETS.find((s) => s.id === setId);
  const m = new Map<string, Code>();
  (def?.values || []).forEach((v, i) => m.set(baseId(setId, i), { code_id: baseId(setId, i), set_id: setId, value: v, sort: (i + 1) * 10, state: "on", note: "", at: "", by: "", base: true }));
  let rows: any[] = [];
  try { rows = await readTable(CODE_TABLE); } catch { rows = []; }
  // 가장 최근 줄이 앞에 있다(appendRow) — 뒤에서부터 덮어 최신이 남게
  for (const r of [...rows].reverse()) {
    if (r.set_id !== setId || !r.code_id) continue;
    const prev = m.get(r.code_id);
    m.set(r.code_id, {
      code_id: r.code_id, set_id: setId, value: String(r.value ?? prev?.value ?? ""), sort: Number(r.sort ?? prev?.sort ?? 999),
      state: r.state === "off" ? "off" : "on", note: String(r.note ?? prev?.note ?? ""), at: String(r.at || ""), by: String(r.by || ""), base: !!prev?.base,
    });
  }
  return [...m.values()].sort((a, b) => a.sort - b.sort || a.code_id.localeCompare(b.code_id));
}

/** 화면용 — 사용 중인 값만, 순서대로 */
export async function codeValues(setId: string): Promise<string[]> {
  return (await codesOf(setId)).filter((c) => c.state === "on" && c.value).map((c) => c.value);
}
