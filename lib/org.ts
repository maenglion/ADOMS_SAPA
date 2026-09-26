import "server-only";
import { readTable } from "@/lib/data";

/**
 * [캡처 v2] 기관 프로파일(2026-09-23 사용자 지시) — 설정 › 기관 정보.
 * 원래는 고객(기관)에게 받아야 하는 값이다. 데모라 용인특례시 공개 자료를 찾아 넣었다 — 출처를 칸마다 적는다.
 * 저장은 덮개의 `org_profile` 표 한 행(키 `org_id`)에 수정분으로 쌓인다. 기본값은 아래 표.
 */
export type OrgField = { key: string; label: string; group: string; unit?: string; wide?: boolean };

export const ORG_FIELDS: OrgField[] = [
  { key: "org_name", label: "기관명", group: "기관" },
  { key: "org_type", label: "기관 유형", group: "기관" },
  { key: "ceo_title", label: "경영책임자", group: "기관" },
  { key: "disaster_agency", label: "재난관리책임기관", group: "기관" },
  { key: "sapa_scope", label: "중대재해처벌법 적용", group: "기관", wide: true },
  { key: "hq_addr", label: "본청사 주소", group: "본청사", wide: true },
  { key: "hq_built", label: "준공", group: "본청사" },
  { key: "hq_floors", label: "층수", group: "본청사" },
  { key: "hq_gfa", label: "연면적", group: "본청사", unit: "㎡" },
  { key: "hq_site", label: "대지면적", group: "본청사", unit: "㎡" },
  { key: "hq_annex", label: "부속 건물", group: "본청사", wide: true },
  { key: "area_km2", label: "관할 면적", group: "관할", unit: "㎢" },
  { key: "population", label: "인구", group: "관할", unit: "명" },
  { key: "districts", label: "행정구역", group: "관할", wide: true },
  { key: "phone", label: "대표 전화", group: "관할" },
];

/** 기본값 — 공개 자료(2026-09-23 확인). 비어 있는 칸은 공개 자료에서 찾지 못한 것이다(지어 넣지 않았다). */
export const ORG_DEFAULT: Record<string, string> = {
  org_id: "ORG-YONGIN",
  org_name: "용인특례시",
  org_type: "지방자치단체(특례시 · 2022-01-13 지정)",
  ceo_title: "시장(중대재해처벌법 제2조제9호나목 「경영책임자등」)",
  disaster_agency: "예(재난 및 안전관리 기본법 제3조제5호)",
  sapa_scope: "중대산업재해 · 중대시민재해(공중이용시설·공중교통수단) · 중대시민재해(원료·제조물)",
  hq_addr: "경기도 용인시 처인구 중부대로 1199(삼가동) — 문화복지행정타운",
  hq_built: "2005-06",
  hq_floors: "지하 2층 · 지상 18층",
  hq_gfa: "80,254.87",
  hq_site: "",
  hq_annex: "시의회 청사(지하 1·지상 5) · 청소년수련관(지하 1·지상 4) · 노인복지관(지상 3) · 처인구보건소(지하 1·지상 3) · 문화예술원(지하 1·지상 4)",
  area_km2: "591.36",
  population: "1,075,566(2023)",
  districts: "3구(처인·기흥·수지) 5읍 2면 32동(2026-01-02 양지면 → 양지읍)",
  phone: "031-6193-2114",
};

/** 칸마다 출처 — 화면에 작게 보인다(마우스를 올리면). */
export const ORG_SOURCE: Record<string, string> = {
  hq_addr: "용인특례시 누리집 「찾아오시는 길」",
  hq_built: "나무위키 「용인시청」(확인 필요)",
  hq_floors: "나무위키 「용인시청」(확인 필요)",
  hq_gfa: "문화복지행정타운 전체 연면적 — 언론·위키 인용(확인 필요)",
  hq_annex: "나무위키 「용인시청」(확인 필요)",
  area_km2: "용인특례시 누리집(경기도의 5.8%)",
  population: "위키백과(2023) — 최신 주민등록 인구로 바꿀 것",
  districts: "위키백과 「용인시의 행정 구역」",
  phone: "114 전화번호 안내",
  org_type: "용인특례시 누리집 「특례시란」",
};

export async function orgProfile(): Promise<Record<string, string>> {
  const rows = await readTable("org_profile", "org_id");
  const hit = rows.find((r) => r.org_id === ORG_DEFAULT.org_id);
  return { ...ORG_DEFAULT, ...(hit || {}) };
}
