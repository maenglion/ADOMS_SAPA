/**
 * 안전보건 예산 — 재해 구분별 용도 틀과 계산을 한 곳에.
 *
 * // [캡처 v2] K08(2026-09-24) — 재해 구분마다 용도 틀을 따로 둔다. 예전에는 산업 틀(시행령 제4조제4호)을
 *   공중이용시설·원료·제조물 줄에도 그대로 붙였다. 조문 글은 `_중처법_원문_36근거조.txt` 와 대조했다.
 *   · 중대산업재해 ― 시행령 제4조제4호 가·나·다목. 다목 고용노동부장관 고시는 아직 없다(법제처 위임 목록 0건).
 *   · 중대시민재해(공중이용시설·공중교통수단) ― 시행령 제10조제2호 가·나·다목.
 *       다목 고시 = 국토교통부 고시 「공중이용시설 및 공중교통수단의 재해예방에 필요한 인력 및 예산 편성 지침」(DOC-003489 제3조②·제4조②).
 *   · 중대시민재해(원료·제조물) ― 시행령 제8조제2호 가·나·다목.
 *       다목 고시 = 기후에너지환경부 고시 「원료 및 제조물로 인한 중대시민재해 예방에 필요한 인력 및 예산 편성 지침」(DOC-003490 제4조).
 *
 * 항목 → 목 배정 근거(조문 글자 그대로 닿는 것만 목에 넣고, 애매한 것은 「밖」 = 용도 확인):
 *   F 안전관리 인력비 → 가목 「인력ㆍ시설 및 장비 등의 확보ㆍ유지」 · 안전점검비 → 가목 「안전점검 등의 실시」
 *     보수·보강비 → 나목(안전계획 = 제10조제4호다목 「보수ㆍ보강 등 유지관리」)
 *     안전조치비 → 다목(국토교통부 고시 제3조②제2호 「긴급안전점검, 긴급안전조치(이용제한, 위험표지설치 등)」)
 *     교육·훈련비 · 기타 → 밖(고시 제3조②제3호의 교육은 재해 발생 뒤 교육만이라 전부 담지 못한다)
 *     (항목 이름은 서울시 안내서 안전예산 5종 + 인건비 · 참고 명세 059)
 *   M 안전·보건 인력비 · 시설·장비 확보·유지비 → 가목 「인력ㆍ시설 및 장비 등의 확보ㆍ유지」
 *     안전점검비 · 긴급조치·보수비 → 나목 「유해ㆍ위험요인의 점검과 위험징후 발생 시 대응」
 *     의무교육비 → 다목(기후에너지환경부 고시 제4조제4호 「…안전보건교육, 직무교육 … 등 의무교육」)
 *     기타 → 밖  (항목 이름은 환경부 해설서 33~36쪽 · 참고 명세 077)
 */
import { readTable, depts, type Row } from "@/lib/data";

export type AreaKey = "I" | "F" | "M";
export const AREAS: AreaKey[] = ["I", "F", "M"];
export type UseKey = "가" | "나" | "다" | "밖";
export type Use = { k: UseKey; label: string; name: string; text: string; note?: string };
export type Frame = {
  area: AreaKey; tab: string; basis: string;
  uses: Use[]; items: { item: string; use: UseKey }[];
  /** 다목 고시가 있는지 — 없으면 다목 칸은 「고시 없음」. */
  notice: boolean;
};

const OUT: Use = { k: "밖", label: "가~다목 밖", name: "기타",
  text: "가~다목 어디에 드는지 따로 확인해야 하는 편성액입니다." };

export const FRAMES: Record<AreaKey, Frame> = {
  I: {
    area: "I", tab: "중대산업재해", basis: "시행령 제4조제4호", notice: false,
    uses: [
      { k: "가", label: "시행령 제4조제4호가목", name: "인력·시설·장비의 구비",
        text: "재해 예방을 위해 필요한 안전ㆍ보건에 관한 인력, 시설 및 장비의 구비" },
      { k: "나", label: "시행령 제4조제4호나목", name: "유해·위험요인의 개선",
        text: "제3호에서 정한 유해ㆍ위험요인의 개선" },
      { k: "다", label: "시행령 제4조제4호다목", name: "고용노동부장관 고시 사항",
        text: "그 밖에 안전보건관리체계 구축 등을 위해 필요한 사항으로서 고용노동부장관이 정하여 고시하는 사항",
        note: "이 고시는 아직 없습니다." },
      { ...OUT, label: "가·나목 밖", name: "교육·훈련비 · 운영비 · 기타", text: "가목·나목 어디에 드는지 따로 확인해야 하는 편성액입니다." },
    ],
    // 참고 명세 SCR-042형 6행
    items: [
      { item: "안전·보건 인력비", use: "가" },
      { item: "시설·장비 구입비", use: "가" },
      { item: "유해·위험요인 개선비", use: "나" },
      { item: "교육·훈련비", use: "밖" },
      { item: "운영비", use: "밖" },
      { item: "기타", use: "밖" },
    ],
  },
  F: {
    area: "F", tab: "중대시민재해(공중이용시설·공중교통수단)", basis: "시행령 제10조제2호", notice: true,
    uses: [
      { k: "가", label: "시행령 제10조제2호가목", name: "인력·시설·장비 확보·유지와 안전점검",
        text: "법 제9조제2항제4호의 안전ㆍ보건 관계 법령에 따른 인력ㆍ시설 및 장비 등의 확보ㆍ유지와 안전점검 등의 실시" },
      { k: "나", label: "시행령 제10조제2호나목", name: "안전계획의 이행",
        text: "제4호에 따라 수립된 안전계획의 이행" },
      { k: "다", label: "시행령 제10조제2호다목", name: "국토교통부장관 고시 사항",
        text: "그 밖에 공중이용시설 또는 공중교통수단과 그 이용자나 그 밖의 사람의 안전에 관하여 국토교통부장관이 정하여 고시하는 사항",
        note: "국토교통부 고시 「공중이용시설 및 공중교통수단의 재해예방에 필요한 인력 및 예산 편성 지침」" },
      { ...OUT, name: "교육·훈련비 · 기타" },
    ],
    items: [
      { item: "안전관리 인력비", use: "가" },
      { item: "안전점검비", use: "가" },
      { item: "보수·보강비", use: "나" },
      { item: "안전조치비", use: "다" },
      { item: "교육·훈련비", use: "밖" },
      { item: "기타", use: "밖" },
    ],
  },
  M: {
    area: "M", tab: "중대시민재해(원료·제조물)", basis: "시행령 제8조제2호", notice: true,
    uses: [
      { k: "가", label: "시행령 제8조제2호가목", name: "인력·시설·장비 확보·유지",
        text: "법 제9조제1항제4호의 안전ㆍ보건 관계 법령에 따른 인력ㆍ시설 및 장비 등의 확보ㆍ유지" },
      { k: "나", label: "시행령 제8조제2호나목", name: "점검과 위험징후 대응",
        text: "유해ㆍ위험요인의 점검과 위험징후 발생 시 대응" },
      { k: "다", label: "시행령 제8조제2호다목", name: "기후에너지환경부장관 고시 사항",
        text: "그 밖에 원료ㆍ제조물 관련 안전ㆍ보건 관리를 위해 기후에너지환경부장관이 정하여 고시하는 사항",
        note: "기후에너지환경부 고시 「원료 및 제조물로 인한 중대시민재해 예방에 필요한 인력 및 예산 편성 지침」" },
      { ...OUT, name: "기타" },
    ],
    items: [
      { item: "안전·보건 인력비", use: "가" },
      { item: "시설·장비 확보·유지비", use: "가" },
      { item: "안전점검비", use: "나" },
      { item: "긴급조치·보수비", use: "나" },
      { item: "의무교육비", use: "다" },
      { item: "기타", use: "밖" },
    ],
  },
};

export const isArea = (a: string): a is AreaKey => (AREAS as string[]).includes(a);
/** 목 이름 짧게 — 표·배지용. */
export const useShort = (f: Frame, k: UseKey) => (k === "밖" ? f.uses.find((u) => u.k === "밖")!.label : `${k}목`);

const KIND_ITEM: Record<string, string> = {
  인력: "안전·보건 인력비", 시설: "시설·장비 구입비", 장비: "시설·장비 구입비",
  교육: "교육·훈련비", 점검: "운영비", 개선: "유해·위험요인 개선비", 기타: "기타",
};

/** 예산 한 줄 — `area` 가 빈 줄(재해 구분 전)은 중대산업재해 틀로 읽는다(예전 줄은 모두 제4조제4호로 편성됐다). */
export type Bud = Row & { item: string; use: UseKey; tab: AreaKey; p: number; e: number };
/** 집행 기록 한 건(budget_exec). 금액은 원. */
export type Exec = Row & { amt: number };

/** 줄의 용도(목) — 그 재해 구분 틀에 있는 항목이면 틀을 따르고, 없으면 적어 둔 근거가 같은 틀일 때만 믿는다. */
function useOf(f: Frame, item: string, r: Row): UseKey {
  const hit = f.items.find((x) => x.item === item);
  if (hit) return hit.use;
  const k = String(r.budget_use || "") as UseKey;
  return String(r.use_basis || "").startsWith(f.basis) && ["가", "나", "다"].includes(k) ? k : "밖";
}

export async function loadBudget() {
  const raw = await readTable("safety_budget", "budget_id");
  const rows: Bud[] = raw.map((r) => {
    const item = r.budget_item || KIND_ITEM[r.budget_kind] || "기타";
    const a = String(r.area || "").trim();
    const tab: AreaKey = isArea(a) ? a : "I";
    return { ...r, item, tab, use: useOf(FRAMES[tab], item, r), p: Number(r.planned_amount || 0), e: Number(r.executed_amount || 0) };
  });
  const execs: Exec[] = (await readTable("budget_exec", "exec_id"))
    .map((x): Exec => ({ ...x, amt: Number(x.amount || 0) }))
    .sort((a, b) => String(b.exec_date).localeCompare(String(a.exec_date)));
  const dl = (await depts()).filter((d: Row) => d.dept_id !== "D99");
  return { rows, execs, dl, deptName: new Map<string, string>(dl.map((d: Row) => [d.dept_id, d.dept_name])) };
}

export const sum = (rs: Bud[]) => ({ p: rs.reduce((a, r) => a + r.p, 0), e: rs.reduce((a, r) => a + r.e, 0) });
export const rate = (p: number, e: number) => (p > 0 ? Math.floor((e / p) * 100 + 1e-9) : 0);   // 09-26 사용자: 소수점은 보수적으로 버림
/** 집행률 경계 — 60% 미만 주의, 40% 미만 위험, 100% 초과는 편성 초과. */
export const rateTone = (p: number, e: number) =>
  p <= 0 ? "none" : e > p ? "bad" : rate(p, e) < 40 ? "bad" : rate(p, e) < 60 ? "warn" : "ok";
/** 금액을 백만원 단위로 — 표·그래프 공통. */
export const mil = (n: number) => (n / 1e6).toLocaleString(undefined, { maximumFractionDigits: 1 });
/** 금액을 천원 단위로 — 입력 칸·집행 기록 공통(참고 명세 「편성액 (천원)」). */
export const chon = (n: number) => Math.round(n / 1000).toLocaleString();
