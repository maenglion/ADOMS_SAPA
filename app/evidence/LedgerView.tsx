// [캡처 v2] 조문 인용 카드·하단 설명 삭제 → 칩 하나 · 표 6칸 한 줄 15행(09-22)
// [캡처 v2] K03 — 입력 화면(체계 기록·예산·교육·재발방지·도급 …)의 첨부도 모은다. 「연결」 칸은 과제 또는 그 화면(09-24)
// 09-26 사용자: 증빙 대장 합치기 — 의무이행 단계(/perform/ws|fc|mt/[step])에서 올린 증빙도 싣는다(읽을 때 합침 · 자료 이동 없음).
//   「연결」 칸 → 「출처」 칸(증빙 등록·결재 / 입력 화면 기록 / 의무이행 단계 — 대상 · 단계). 걸러 보기 o=reg|step|screen|both.
//   같은 파일이 두 곳에 다 있으면 한 줄로 묶고 「두 곳」 표시. 엑셀도 같은 걸러 보기로(/evidence/export).
//   09-26 사용자(2차): 입력 화면 기록 → 의무이행 단계 갈래(칩 셋) · 묶인 줄에 「다른 파일로 나누기」, 나눈 줄에 「나눔」·「다시 묶기」(총괄·관리자 · evidence_split).
import Link from "next/link";
import { Stat } from "@/components/bits";
import { idKo } from "@/lib/labels";
import { loadLedger, filterLedger, originText, ORIGIN_LABEL, KEEP_YEARS, SOON_DAYS, SPLIT_ROLES, type LedgerRow } from "./ledger";
import { splitBundle } from "./actions";   // 09-26 사용자(2차): 증빙 대장 합치기 — 다른 파일로 나누기·다시 묶기

const STATE_TONE: Record<LedgerRow["state"], string> = { "보존 중": "ok", "만료 임박": "warn", "보존 기간 지남": "bad" };

/** 증빙 대장 — 시행령 제13조 「이행한 날부터 5년간 보관」. */
export default async function LedgerView({ sp, role }: { sp: Record<string, string>; role: string }) {
  const SHOW = sp.all ? 300 : 15;
  const all = await loadLedger({ steps: true });   // 09-26 사용자: 증빙 대장 합치기 — 의무이행 단계 증빙 포함
  const rows = filterLedger(all, sp);                 // 09-26 사용자: 증빙 대장 합치기 — 화면·엑셀 같은 걸러 보기

  const noFile = all.filter((r) => !r.hasFile).length;
  const soon = all.filter((r) => r.state === "만료 임박").length;
  const gone = all.filter((r) => r.state === "보존 기간 지남").length;
  const nextExp = all.find((r) => r.left >= 0)?.expires || "-";

  const q = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams({ role, view: "ledger" });
    const m: Record<string, string | undefined> = { area: sp.area, f: sp.f, code: sp.code, o: sp.o, all: sp.all, ...o };
    Object.entries(m).forEach(([k, v]) => v && p.set(k, v));
    return `/evidence?${p.toString()}`;
  };
  const withRole = (h: string) => { const [p, hash] = h.split("#"); return `${p}${p.includes("?") ? "&" : "?"}role=${role}${hash ? `#${hash}` : ""}`; };
  // 09-26 사용자: 증빙 대장 합치기 — 엑셀은 의무이행 단계 증빙까지 담는 /evidence/export 로(옛 /api/export?what=evidence 는 그대로 둔다)
  const xp = new URLSearchParams({ role });
  Object.entries({ area: sp.area, f: sp.f, code: sp.code, o: sp.o }).forEach(([k, v]) => v && xp.set(k, v));
  const xlsxHref = `/evidence/export?${xp.toString()}`;

  // 09-26 사용자: 증빙 대장 합치기 — 출처별 건수. 2차: 입력 화면 기록은 의무이행 단계 갈래로(칩 셋 — 전체 · 증빙 등록·결재 · 의무이행 단계).
  //   두 곳에 다 있어 묶인 줄은 양쪽 칩에 다 센다 → 두 칩의 합이 전체보다 클 수 있다(filterLedger 와 같은 셈).
  const nReg = filterLedger(all, { o: "reg" }).length;
  const nStep = filterLedger(all, { o: "step" }).length;
  // 09-26 사용자(2차): 「다른 파일로 나누기」·「다시 묶기」는 총괄·관리자에게만 보인다(서버 동작도 같은 역할만 받는다)
  const canSplit = SPLIT_ROLES.has(role);
  const back = q({});
  const SplitForm = ({ r, act, keys }: { r: LedgerRow; act: "나눔" | "다시 묶기"; keys: string[] }) => (
    <form action={splitBundle} className="ev26-split">
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="back" value={back} />
      <input type="hidden" name="act" value={act} />
      <input type="hidden" name="file_name" value={r.file_name} />
      {keys.map((k) => <input key={k} type="hidden" name="key" value={k} />)}
      <button className="btn sm ghost" title={act === "나눔" ? "이름만 같고 다른 파일이면 두 줄로 나눈다" : "같은 파일이면 다시 한 줄로 묶는다"}>
        {act === "나눔" ? "다른 파일로 나누기" : "다시 묶기"}
      </button>
    </form>
  );

  return (
    <>
      <div className="chips" style={{ marginTop: 8 }}>
        <span className="badge none">시행령 제13조 · {KEEP_YEARS}년 보관</span>
      </div>

      <div className="grid g4" style={{ marginTop: 12 }}>
        <Stat n={all.length} l="보관 증빙" href={q({ f: undefined })} />
        <Stat n={noFile} l="파일 없음" tone={noFile ? "warn" : "ok"} href={q({ f: "nofile" })} />
        <Stat n={soon + gone} l={`만료 ${SOON_DAYS}일 안·지남`} tone={gone ? "bad" : soon ? "warn" : "ok"} href={q({ f: "soon" })} />
        <Stat n={nextExp} l="첫 만료일" />
      </div>

      {/* 09-26 사용자: 증빙 대장 합치기 — 출처 걸러 보기 */}
      <div className="chips" style={{ marginTop: 12 }}>
        {([["", "전체", all.length], ["reg", ORIGIN_LABEL.reg, nReg], ["step", ORIGIN_LABEL.step, nStep]] as [string, string, number][]).map(([k, l, n]) => (
          <Link key={k || "all"} className={`chip ${(sp.o || "") === k ? "on" : ""}`} href={q({ o: k || undefined })}>
            {l} {n.toLocaleString()}
          </Link>
        ))}
      </div>

      <div className="chips" style={{ marginTop: 8 }}>
        {[["", "전체"], ["I", "중대산업재해"], ["F", "중대시민재해(공중이용시설·공중교통수단)"], ["M", "중대시민재해(원료·제조물)"]].map(([k, l]) => (
          <Link key={k} className={`chip ${(sp.area || "") === k ? "on" : ""}`} href={q({ area: k || undefined })}>
            {l} {(k ? all.filter((r) => r.area === k) : all).length.toLocaleString()}
          </Link>
        ))}
        {[["", "모두"], ["file", "파일 있음"], ["nofile", "파일 없음"], ["soon", "만료 임박"]].map(([k, l]) => (
          <Link key={k} className={`chip ${(sp.f || "") === k ? "on" : ""}`} href={q({ f: k || undefined })}>{l}</Link>
        ))}
        {sp.code && <Link className="chip on" href={q({ code: undefined })}>{sp.code} ✕</Link>}
        <span style={{ flex: 1 }} />
        <a className="btn sm ghost" href={xlsxHref}>엑셀 받기</a>
      </div>

      <table className="v2t" style={{ marginTop: 10 }}>
        <thead>
          <tr>
            <th>증빙</th>
            <th>의무</th>
            <th>출처</th>{/* 09-26 사용자: 증빙 대장 합치기 — 옛 「연결」 */}
            <th className="dt">이행일</th>
            <th className="dt">만료일</th>
            <th>첨부</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, SHOW).map((r) => (
            <tr key={`${r.origin || "task"}:${r.src || ""}:${r.evidence_id}`}>
              <td title={`${r.kind} · ${idKo(r.evidence_id)} · ${r.file_name}`}>
                {r.file_url ? <a href={r.file_url} target="_blank" rel="noreferrer">{r.file_name}</a> : r.file_name}
              </td>
              <td title={`${r.sapa || ""} · ${r.law} ${r.unit} · ${r.duty}`}>
                {r.code36 ? <Link href={q({ code: r.code36 })}>{r.code36} {r.code36_name}</Link> : r.duty}
              </td>
              {/* 09-26 사용자: 증빙 대장 합치기 — 출처 칸. 두 곳에 다 있으면 「두 곳」 표시(전체 글은 칸에 마우스를 올리면) */}
              {/* 09-26 사용자(2차): 입력 화면 기록도 「의무이행 단계」 갈래 — 세부 출처(입력 화면 · 어느 화면)는 그대로. 나눈 줄은 「나눔」 */}
              <td title={`${originText(r)}${r.split && r.split.length ? ` · 나눔(다른 파일): ${r.split.map((s) => s.label).join(" / ")}` : ""}${r.dept_name || r.dept_id ? ` · ${r.dept_name || r.dept_id}` : ""}${r.target && r.origin !== "step" ? ` · ${r.target}` : ""}`}>
                {r.also && r.also.length ? <span className="badge warn" style={{ marginRight: 6 }}>두 곳</span> : null}
                {r.split && r.split.length ? <span className="badge none" style={{ marginRight: 6 }}>나눔</span> : null}
                {r.origin === "step"
                  ? <><span className="muted">{ORIGIN_LABEL.step} · </span><Link href={withRole(r.href || "/")}>{r.src}</Link></>
                  : r.task_id
                    ? <><span className="muted">{ORIGIN_LABEL.reg} · </span><Link href={`/evidence?role=${role}&t=${r.task_id}`}>{idKo(r.task_id)}</Link></>
                    : <><span className="muted">{ORIGIN_LABEL.step} · 입력 화면 · </span><Link href={withRole(r.href || "/")}>{r.src}</Link></>}
                {canSplit && r.also && r.also.length ? <SplitForm r={r} act="나눔" keys={r.also.map((a) => a.key)} /> : null}
                {canSplit && r.split && r.split.length ? <SplitForm r={r} act="다시 묶기" keys={r.split.map((s) => s.key)} /> : null}
              </td>
              <td className="dt" title={r.doneBasis}>{r.doneDate || "-"}</td>
              <td className="dt">
                <span className={`badge ${STATE_TONE[r.state]}`} title={r.expires || ""}>
                  {r.state === "보존 중" ? (r.expires || "-") : r.state === "만료 임박" ? `D-${r.left}` : `${-r.left}일 지남`}
                </span>
              </td>
              <td>{r.hasFile ? <span className="badge ok">있음</span> : <span className="badge warn">이름만</span>}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={6} className="muted">없음</td></tr>}
        </tbody>
      </table>
      {rows.length > SHOW && (sp.all
        ? <span className="more muted">{rows.length.toLocaleString()}건 중 {SHOW} · 전부는 엑셀</span>
        : <Link className="more" href={q({ all: "1" })}>전체 {rows.length.toLocaleString()}건 →</Link>)}
    </>
  );
}
