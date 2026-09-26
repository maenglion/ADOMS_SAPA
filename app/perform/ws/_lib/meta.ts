/**
 * [400 · 교육자료 버전] 묶음 C — 의무이행(실적증빙) 사업장 트랙 공통 규칙(화면·저장 양쪽이 쓴다).
 *
 * 저장 표는 하나: `usc_record` (명세 00 §7 권고 — 의무 항목마다 입력 모양이 달라 행 값을 JSON 으로 둔다).
 *   rec_id · dept_id · year · step(단계 key) · section(표 구분) · parent_id · ord · locked · deleted
 *   · status · data(JSON) · files(JSON 배열 {name,url,at}) · updated_at · updated_by
 * 이행점검(묶음 F)이 이 표를 읽어 판정한다 — status 는 저장할 때 행 값으로 계산해 둔다.
 */
export const YEAR = "2026";
export const TABLE = "usc_record";

/** 본청 사업장 이름(사용자 지시 09-24). 사업장 표(usb1_workplace)를 못 읽을 때의 대체 이름이다.
 *  09-25 사용자: 대상은 사업장 20곳 — 본청 기록은 dept_id = 부서 id(그대로), 본청 밖 사업장 기록은 dept_id = 사업장 번호(WP-02~). */
export const WORKPLACE = "용인시청 본청";

/** 고정 행 번호(예산 6항목·표 밖 입력·해당없음 체크) — 예시 자료 만들기 스크립트와 같은 규칙. */
export const fixedId = (dept: string, year: string, step: string, tail: string) => `USC-${dept}-${year}-${step}-${tail}`;

export const BUDGET_ITEMS = ["안전·보건 인력비", "시설·장비 구입비", "유해·위험요인 개선비", "교육·훈련비", "운영비", "기타"];
export const INC_ITEMS = ["1. 재해발생 상황보고서", "2. 산업재해조사표", "3. 재발방지계획서"];
export const LAW_ST = ["이행완료", "보완필요", "미이행", "해당없음"];

export type FileRef = { name: string; url: string; at: string };

/** 단계·표마다 「이행했다」를 가르는 날짜 칸. */
function dateKey(step: string, section: string) {
  if (step === "order") return "to";
  if (step === "budget") return "date";
  return "date";
}

/**
 * 행 상태 — 이행점검(F)이 읽는 값.
 *   날짜 + 증빙 파일 = 이행완료 · 어느 한쪽만(또는 내용만) = 보완필요 · 비었음 = 미이행
 *   관계 법령 표는 사용자가 고른 「이행 여부」를 그대로 쓴다. 표 밖 입력(hdr)은 「-」, 해당없음 체크는 「해당없음」.
 */
export function statusOf(step: string, section: string, data: Record<string, string>, files: FileRef[]): string {
  if (section === "hdr" || section === "inc") return "-";
  if (section === "nil") return data.nil === "Y" ? "해당없음" : "-";
  if (step === "law" && section === "law" && data.st) return data.st;
  const has = (k: string) => String(data[k] ?? "").trim() !== "";
  const d = has(dateKey(step, section));
  if (d && files.length) return "이행완료";
  const any = Object.entries(data).some(([k, v]) => !["item", "fixed", "gbn", "rank", "rel", "duty_key", "src"].includes(k) && String(v ?? "").trim() !== "");
  if (d || files.length || any) return "보완필요";
  return "미이행";
}

/** 표에서 한 칸 모아 보이는 「구분」 칸 이름(같은 값끼리 행 합치기 · + 로 같은 구분 행 더하기). */
export const GROUP_KEY: Record<string, string> = { staff: "rank", work: "rel", opinion: "gbn", emergency: "rank", risk: "gbn" };
