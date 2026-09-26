// [캡처 v2] K03 증빙 파일 첨부 — 공통 부품 하나(2026-09-24).
//   「파일 첨부」 한 칸 + 이미 올린 파일이 있으면 그 이름을 링크로. 서버 쪽은 lib/attach.ts attachOf 가 받는다.
//   파일을 고르지 않으면 옆의 이름 칸 글자만 저장된다(지금까지와 같다).
//   서버·클라이언트 어느 쪽 부품 안에서도 쓸 수 있게 상태·이벤트를 두지 않는다.

/** 올린 파일 이름 — 주소가 있으면 새 창 링크, 없으면 글자만. 표 칸에도 쓴다. */
export function FileLink({ name, url, max = 14, empty }: { name?: string; url?: string; max?: number; empty?: React.ReactNode }) {
  const n = String(name || "").trim();
  if (!n && !url) return <>{empty ?? <span className="muted">—</span>}</>;
  const label = (n || "파일").length > max ? `${(n || "파일").slice(0, max)}…` : n || "파일";
  return url
    ? <a className="flink" href={url} target="_blank" rel="noreferrer" title={n || "파일"}>{label}</a>
    : <span title={n}>{label}</span>;
}

/**
 * 파일 고르기 칸.
 *   as="div"   — `<div><label>파일 첨부</label><input/></div>` (격자 양식 · 기본)
 *   as="label" — `<label>파일 첨부<input/></label>` (라벨이 칸을 감싸는 양식)
 *   as="bare"  — 입력 칸만(한 줄짜리 양식)
 */
export default function FileAttach({
  name = "evidence_file", label = "파일 첨부", current, as = "div", accept,
}: {
  name?: string; label?: string; current?: { name?: string; url?: string }; as?: "div" | "label" | "bare"; accept?: string;
}) {
  const input = <input className="fattach-in" type="file" name={name} accept={accept} aria-label={label} />;
  const cur = current && (current.url || current.name)
    ? <span className="fattach-cur"><FileLink name={current.name} url={current.url} max={24} /></span> : null;
  if (as === "bare") return <>{input}{cur}</>;
  if (as === "label") return <label className="fattach">{label}{input}{cur}</label>;
  return <div className="fattach"><label>{label}</label>{input}{cur}</div>;
}
