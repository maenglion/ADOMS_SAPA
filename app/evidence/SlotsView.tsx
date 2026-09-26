// [캡처 v2] 탭의 조문 번호·출처 문단·하단 설명 삭제 · 칸 한 줄(09-22)
import Link from "next/link";
import { Stat } from "@/components/bits";
import { loadSlots, SLOT_SOURCE_F, SLOT_SOURCE_I, SLOT_SOURCE_M, type SlotHit } from "./ledger";

type Group = Awaited<ReturnType<typeof loadSlots>>["F"][number];

const tone = (h: SlotHit) => (h.state === "있음" ? "ok" : h.state === "이름만" ? "warn" : "bad");
const label = (h: SlotHit) =>
  h.state === "있음" ? `있음 ${h.withFile}`
    : h.files.length ? `이름만 ${h.files.length}`
      : h.state === "이름만" ? "화면 기록만" : "없음";

/** 호별 필수 증빙 — 「이 서류가 있어야 한다」 목록과 지금 올라온 것을 한 화면에서 대조. */
export default async function SlotsView({ sp, role }: { sp: Record<string, string>; role: string }) {
  const S = await loadSlots();
  const side = sp.side === "I" ? "I" : sp.side === "M" ? "M" : "F";
  const groups = side === "I" ? S.I : side === "M" ? S.M : S.F;
  const hits = groups.flatMap((g) => g.hits.filter((h) => h.doc.need === "필수"));
  const q = (o: Record<string, string>) => `/evidence?${new URLSearchParams({ role, view: "slots", ...o }).toString()}`;
  const src = side === "I" ? SLOT_SOURCE_I : side === "M" ? SLOT_SOURCE_M : SLOT_SOURCE_F;

  return (
    <>
      <div className="chips" style={{ marginTop: 12 }}>
        <Link className={`chip ${side === "F" ? "on" : ""}`} href={q({ side: "F" })} title="시행령 제10조 · 법 제9조제2항">중대시민재해(공중이용시설·공중교통수단)</Link>
        <Link className={`chip ${side === "M" ? "on" : ""}`} href={q({ side: "M" })} title="시행령 제8조 · 제9조제2항">중대시민재해(원료·제조물)</Link>
        <Link className={`chip ${side === "I" ? "on" : ""}`} href={q({ side: "I" })} title="시행령 제4조">중대산업재해</Link>
        <span className="badge none" title={src}>출처</span>
        {side === "M" && S.mGate && (
          <Link className="badge warn" href={`/system?role=${role}&area=M`} title={S.mGate}>해당 여부 확인 필요</Link>
        )}
      </div>

      <div className="grid g4" style={{ marginTop: 8 }}>
        <Stat n={hits.length} l="필수 서류" />
        <Stat n={hits.filter((h) => h.state === "있음").length} l="있음" tone="ok" />
        <Stat n={hits.filter((h) => h.state === "이름만").length} l="이름만" tone="warn" />
        <Stat n={hits.filter((h) => h.state === "없음").length} l="없음" tone="bad" />
      </div>

      <table className="v2t" style={{ marginTop: 14 }}>
        <thead>
          <tr>
            <th>호</th>
            <th>있어야 할 서류</th>
            <th>지금</th>
            <th>올라온 것</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g: Group) => g.hits.map((h, k) => (
            <tr key={`${g.key}-${k}`}>
              {k === 0 && (
                <td rowSpan={g.hits.length} title={`${g.name}${g.cond ? ` · ${g.cond}` : ""} · 의무조항 ${g.codes.join(" · ")} · 증빙 ${g.evN}`} style={{ verticalAlign: "top" }}>
                  <b>{g.ref}</b>{" "}
                  <Link href={`/evidence?role=${role}&view=ledger&code=${g.codes[0]}`}>대장</Link>
                </td>
              )}
              <td title={h.doc.name}>
                {h.doc.name} {h.doc.need === "선택" && <span className="badge none">선택</span>}
              </td>
              <td><span className={`badge ${tone(h)}`}>{label(h)}</span></td>
              {/* 09-26 사용자(2차): 증빙 대장 합치기 — 의무이행 단계 증빙도 센다(loadSlots 기본). 마우스를 올리면 어디서 온 것인지 보인다 */}
              <td title={[...h.files.map((f) => `${f.file_name} · ${f.doneDate}${f.src ? ` · ${f.src}` : ""}`), h.rec ? `화면 기록: ${h.rec}` : ""].filter(Boolean).join("\n")}>
                {h.files[0]
                  ? (h.files[0].file_url ? <a href={h.files[0].file_url} target="_blank" rel="noreferrer">{h.files[0].file_name}</a> : h.files[0].file_name)
                  : h.rec ? <span className="muted">화면 기록</span> : <span className="muted">—</span>}
                {h.files.length > 1 && <span className="muted"> 외 {h.files.length - 1}</span>}
              </td>
            </tr>
          )))}
        </tbody>
      </table>
    </>
  );
}
