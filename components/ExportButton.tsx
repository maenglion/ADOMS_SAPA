/** 엑셀 내려받기 단추 — 화면과 같은 숫자를 엑셀(xlsx)로 내린다(09-25 사용자: CSV → 엑셀). */
export default function ExportButton({ what, half, label = "엑셀 내려받기", extra }:
  { what: "tasks" | "status" | "duties" | "contracts"; half?: string; label?: string; extra?: Record<string, string> }) {
  // [캡처 v2] extra — 지금 보는 표 그대로 받기(재해 구분·연도·보기 등, 09-24)
  const q = new URLSearchParams({ what, ...(half ? { half } : {}), ...(extra || {}) });
  return <a className="btn ghost sm" href={`/api/export?${q.toString()}`}>{label}</a>;
}
